# FORECASTER — Agent Spec

Status: SPEC (not yet implemented)
Tier: standard (earns enterprise by proving useful — same path as satellites)
Depends on: cortex-agents runtime, initiative inbox, calendar-linked-api,
GEV forecast/weather layers, Gmail triage, resonance-calculus.ts

## Mission

FORECASTER is Cortex's anticipator. Every other agent reacts to state that
already exists; FORECASTER predicts the states that are forming and routes
each prediction to the cheapest channel that will get it acted on.

Prime directive: **evidence first, silence over vibes.** A forecast without
cited evidence and a confidence score is noise and must not be emitted.

## Architecture — probes, not a monolith

"Forecast everything" is achievable only as a modular system. FORECASTER is
a router + scoring layer; each domain is a **probe** that emits
`ForecastSignal`s on a cadence. Coverage grows by adding probes, never by
making one agent smarter.

```ts
interface ForecastSignal {
  id: string;                  // dedupe key: domain + subject + horizon bucket
  domain: 'calendar' | 'weather' | 'build' | 'fleet' | 'comms' | 'distribution' | 'energy' | ...;
  claim: string;               // one sentence, human-readable
  evidence: EvidenceRef[];     // REQUIRED — file, API row, layer stat, email id
  why?: string;                // root-cause attachment (Tellius pattern: anomaly + why)
  confidence: number;          // 0-1, probe-assigned with stated basis
  horizon: { notBefore: number; notAfter: number }; // epoch ms window
  trigger?: string;            // "IF X THEN Y" condition, when applicable
  suggestedAction?: string;    // what Cortex could do about it
  urgency: 'ambient' | 'proposal' | 'interrupt';
  // User-tunable topics (Rhythms pattern): probes register signal topics
  // the user can weight/disable — "watch vendor X", "track this project".
  topic?: string;
}
```

### Probe registry (v1 scope)

| Probe | Signals it emits | Data source (already exists) |
|---|---|---|
| `calendar` | back-to-back meeting days, meetings with no prep window, timezone traps, overdue follow-ups | calendar-linked-api |
| `weather` | storm/fire/cyclone windows overlapping calendar events or assets; flood watches (Bhote Koshi precedent) | GEV weather/fire/cyclone layers |
| `build` | CI failure streaks, flaky-test patterns, dependency drift, files churned by many agents | git + CI + cortex task ledger |
| `fleet` | agent task failure-rate climbs, queue stalls, budget burn anomalies | agents runtime events |
| `comms` | Gmail threads going cold before deadlines, unanswered high-priority senders | gmail triage |
| `distribution` | listing gaps ("top-rated local businesses with no website"), cadence drift, channel decay | places search + distribution queue |
| `energy` | resonance-calculus scores: when forecasts matter TO THIS USER | resonance-calculus.ts |

v2+ probes (added as sensors come online): code-risk radar (churn ×
complexity × agent-edit hotspots), demand radar (underserved local
businesses), legal/court-date watch.

## Scoring & routing

Each signal gets a routing score:

```
routeScore = evidenceStrength × personalRelevance × urgencyDecay
```

- `evidenceStrength` — probe confidence, discounted when evidence is stale
- `personalRelevance` — does it touch the user's calendar, assets, or goals?
  (the `energy` probe supplies circadian/coherence context)
- `urgencyDecay` — how close to `horizon.notBefore`

Routing by score AND declared urgency:

- **Tier 1 — Ambient (always):** render as a visual event. Globe marker for
  geographic forecasts (storm cells, flood windows); incoming-vessel
  animation on the visualizer approach lane for dated events (deadlines,
  court dates, meetings needing prep). Zero interruption cost.
- **Tier 2 — Initiative inbox:** forecasts with a concrete suggestedAction
  become proposals the user approves/dismisses. Async by design.
- **Tier 3 — Spoken:** ONLY `interrupt`-class signals: high confidence
  (>0.8), high impact, time-sensitive, AND inside a reasonable waking
  window. Voice is the most expensive channel Cortex owns — rationed.

**Interruption budget (research-grounded, CORTEX_AGENTS_RESEARCH.md §C):**
the measured ceiling for unsolicited AI updates is ~3–5/day across ALL
sources combined. Cortex enforces a hard cap of **3 Tier-3 utterances/day
system-wide** (not per-probe). Over budget → demote to Tier-2 proposal and
log the demotion. Dismissed-without-reading counts against the probe's
precision score.

Anti-goal: alert fatigue. If Tier 3 fires more than ~2×/day on average,
FORECASTER demotes its own threshold and reports the demotion honestly.

## Resonance calculus — where it fits (and where it doesn't)

Resonance calculus (`src/utils/resonance-calculus.ts`) models **c(t) × β(t)**:
coherence between a task and its context, times the circadian service
curve. That is a *personal timing and relevance* model — it answers "when
does this matter to THIS user, and when can they act on it?"

Correct uses inside FORECASTER:

- Time Tier-3 spoken alerts into high-coherence, waking windows — never
  interrupt deep work or sleep for an ambient-class forecast.
- Schedule prep briefs to land before the user's peak β(t) block, not
  randomly.
- Weight `personalRelevance` — a forecast about YOUR 2pm meeting outranks
  an identical forecast about a stranger's.

Explicitly NOT its job:

- It does not predict code correctness, CI outcomes, or weather. Those are
  probe domains with their own evidence. Forcing resonance math onto them
  would be category error — the same reason SENTINEL doesn't do research.
- It is explicitly not medical/diagnostic (existing disclaimer carries over).

## PREP agent handoff

FORECASTER does not prepare anything itself. When a `calendar` probe emits
"meeting X in N hours with no prep artifact," the suggestedAction routes to
the PREP pipeline (separate spec): detect → gather context (attendees from
Gmail, related files via LIBRARIAN/memory, open items) → write prep brief →
file as Cortex artifact + initiative proposal. Every claim in a brief cites
its source — a prep agent that invents attendee history is worse than none.

## Honesty contract

- Every ForecastSignal carries ≥1 EvidenceRef or it is dropped at emit time.
- Confidence is probe-assigned with a stated basis; the UI shows it.
- "No forecast" is a valid, silent outcome — FORECASTER reports probe
  health ("scanned 6 domains, 0 actionable") rather than manufacturing
  activity.
- Forecasts that fired and were wrong get logged; probe calibration reads
  that log. A probe that cries wolf gets its confidence floor raised.

## Agent runtime registration

```ts
{
  id: 'forecaster',
  name: 'FORECASTER',
  role: 'Anticipator',
  blurb: 'Predicts forming states across calendar, weather, build, fleet, comms and distribution — evidence-cited, tiered alerts, silence over vibes.',
  concurrency: 1,
  dailyBudget: 32,   // probe cycles are cheap; LLM only on signal composition
  modelPin: { tier: 'reason' },  // forecast composition deserves reasoning tier
  // tier: 'standard' — earns enterprise by proving forecast precision
}
```

## Build phases

1. **Spec + skeleton**: ForecastSignal types, probe registry interface,
   router/scoring, agent spec registration, event emission to bus.
2. **v1 probes**: calendar + fleet first (data is local and reliable),
   then weather (GEV bridge), comms, build, distribution, energy.
3. **Routing surfaces**: Tier-1 globe/visualizer events, Tier-2 initiative
   proposals, Tier-3 spoken path with demotion logic.
4. **PREP handoff**: calendar probe → prep-brief pipeline (own spec).
5. **Calibration loop**: forecast outcome logging → per-probe confidence
   adjustment.

## Verification

- Unit: signal schema validation, dedupe, scoring, tier routing,
  demotion logic, evidence-required enforcement.
- Live: seeded signals → correct tier routing; a real calendar event
  produces a prep-window forecast; weather probe picks up a live GEV layer.
- Honesty: probe emitting zero evidence is dropped; wrong forecasts are
  logged and visible.
