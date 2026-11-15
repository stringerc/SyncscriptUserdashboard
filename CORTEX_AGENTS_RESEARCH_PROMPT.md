# CORTEX FORECASTER + PREP — Deep Research & Implementation Prompt

Mission: before building FORECASTER and PREP, run an in-depth, fact-based
research pass on what already exists — forecasting agents, meeting-prep
agents, AI chiefs of staff, and the underlying forecast/anomaly-detection
patterns — then implement what survives scrutiny. Novelty is a goal, not a
requirement; honest gaps beat borrowed theater.

## Phase 1 — Research (write CORTEX_AGENTS_RESEARCH.md)

### A. Forecasting & anticipatory agents — who claims this?

Survey the actual landscape, not the marketing:

- **AI chief-of-staff / executive-assistant agents**: Lindy, Relevance AI,
  11x, Artisan, Sintra, Fyxer, Clarify, Serif, Motion, Reclaim, Clockwise,
  Saner.ai, Trevor AI, Vocci, Martin, Ohai, Lindy-style "digital workers".
  For each: what do they actually DO (task automation vs. prediction),
  what signals do they read, how do they decide when to interrupt, what do
  users complain about (reviews, Reddit, HN threads)?
- **Predictive systems that aren't chat agents**: SRE anomaly detection
  (Datadog Watchdog, Honeycomb Triggers, Grafana anomaly), capacity
  forecasting (Cloudability, ProsperOps), clinical early-warning scores,
  predictive maintenance. What makes THEIR forecasts trustworthy —
  precision/recall discipline, calibration, abstention?
- **Calendar/schedule intelligence**: how do Motion/Reclaim/Clockwise
  actually optimize — constraint solving vs. LLM guessing?
- **The honest question for each**: does it forecast with cited evidence,
  or generate plausible-sounding prose? Collect concrete examples of
  forecast UX (what the user sees, when, how they dismiss/act).

### B. Meeting-prep agents — what exists and where they fail

- Granola, Otter, Fireflies, Fathom, Read.ai, Circleback, Krisp, Avoma,
  tl;dv — which generate prep briefs vs. only post-meeting notes?
- CRM-side prep: Salesforce/Salesforce Einstein activity capture, HubSpot
  Breeze, Attio AI, Folk — how do they assemble "who is this person and
  what do we owe them"?
- Prep-brief quality complaints: search Reddit/HN/G2 for "meeting prep
  AI useless", "Granola vs", "AI notes wrong" — collect the top failure
  modes verbatim.
- Document/artifact generation: which tools turn a brief into a leave-
  behind, one-pager, or deck — and at what quality cost?

### C. Alert-fatigue & interruption science (applies to both)

- Notification/interruption research relevant to proactive agents:
  when do proactive alerts help vs. train users to ignore?
  (Interruption science, alarm fatigue in clinical/ops contexts,
  "AI assistant too proactive" complaints.)
- Best-practice thresholds: how many proactive interruptions/day before
  trust degrades — find actual numbers, not vibes.
- Confidence calibration: how do trustworthy systems display uncertainty
  (ranges, abstention, "I don't know")?

### D. Gap analysis → what Cortex can uniquely do

Map findings against Cortex's actual sensorium:

- Live globe with weather/fire/disaster/cctv/places layers — nobody else
  renders forecasts spatially on a real-time globe.
- Governed action tiers (ambient visual → initiative proposal → spoken)
  with evidence requirements — most agents have one flat notification pipe.
- Agent fleet with budgets and audit ledgers — forecasts can cite internal
  state (CI streaks, queue stalls) that external tools can't see.
- resonance-calculus.ts — personal timing layer for when forecasts matter
  to THIS user. Nobody else has a circadian/coherence model in the loop.
- Google Places entity resolution — local-business demand signals.

Output a **kill/win table**: for each surveyed capability, verdict =
STEAL (with source), AVOID (with reason), or NOVEL (Cortex-only).

## Phase 2 — Spec updates

Update `CORTEX_FORECASTER_SPEC.md` and write `CORTEX_PREP_SPEC.md`:

- FORECASTER: absorb research — probe list additions/removals, confidence
  calibration method borrowed from the best predictive systems, Tier-3
  interruption budget grounded in the alert-fatigue numbers found.
- PREP: scope from research — what a credible v1 brief contains (attendees,
  history, open items, agenda, cited sources), which competitors' features
  are worth stealing, which are theater to skip.
- Both: explicit "what we will NOT do" list driven by observed failure
  modes.

## Phase 3 — Implement (in order)

1. FORECASTER skeleton: ForecastSignal types, probe registry, scoring
   router, tiered action dispatch, agent registration in AGENT_SPECS
   (standard tier, reason pin, concurrency 1).
2. v1 probes in reliability order: fleet + calendar (local data first),
   then weather (GEV), comms, build, distribution, energy.
3. PREP v1: calendar probe → context gather → cited brief artifact →
   initiative proposal.
4. Tier-1 visual events on globe/visualizer (forecast "incoming" rendering).
5. Calibration loop: outcome logging → per-probe confidence adjustment.

## Constraints

- Evidence-or-silence contract is non-negotiable — no forecast without
  cited EvidenceRefs.
- Tier-3 spoken alerts: start conservative (research-derived budget),
  self-demote if fired too often.
- PREP briefs: every claim cites a source (email id, doc path, calendar
  event). No invented attendee history — ever.
- Keys stay server-side; no new paid APIs without a budget note.
- Honest reporting: "scanned N domains, 0 actionable" beats manufactured
  forecasts. Wrong forecasts get logged and shown.

## Verification

- Research doc cites sources (URLs) for every non-obvious claim.
- Unit tests: signal schema, dedupe, scoring, tier routing, demotion,
  evidence-required enforcement, prep-brief citation completeness.
- Live: seeded signal → correct tier; real calendar event → prep-window
  forecast; GEV weather layer → spatial forecast event; brief cites real
  Gmail/doc sources only.
