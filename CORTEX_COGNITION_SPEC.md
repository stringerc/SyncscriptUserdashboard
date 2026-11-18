# CORTEX COGNITION SPEC — Continuous Self-Improvement Mandate

> Status: ACTIVE — seeded 2025-11-17
> Scope: every registered agent worker + spawned craft
> Companion docs: CORTEX_AGENTS_RESEARCH.md, CORTEX_COUNSEL_SPEC.md,
> CORTEX_CLOSED_LOOP_SPEC.md, DEVIN_PLAYBOOK.md

## 0. Why this exists

Cortex agents currently work only when tasked. The fleet's intelligence is
real but intermittent — it analyzes nothing while idle, forgets context
between sessions, and waits for the Crew to notice decay. This spec makes
cognition *continuous*: every agent runs standing orders on a cadence,
converts observation into durable knowledge, and routes improvement through
the existing governance machinery (proposals → INBOX → Crew decision).

The Crew's time is the scarce resource. Cortex's job is to arrive at each
interaction already smarter than the last one.

## 1. The Cognition Loop (every standing order runs this)

```
OBSERVE → ORIENT → HYPOTHESIZE → PROPOSE → VERIFY → DISTILL → REMEMBER
```

1. **OBSERVE** — pull real evidence: agent state, task archive, incident
   ledger, model registry, git status, memory vault, inbox, calendar.
   No evidence, no claim.
2. **ORIENT** — compare observation against known-good baselines and
   recent deltas. What changed? What is aging?
3. **HYPOTHESIZE** — name the smallest honest explanation for anomalies.
   Rank by blast radius × likelihood.
4. **PROPOSE** — route consequential action through strategy proposals /
   initiative ledger / incidents. Agents NEVER silently mutate production
   state, commit code, send messages, or spend money.
5. **VERIFY** — every claim carries an evidence ref (file, endpoint,
   task id, probe result). "Scanned N domains, 0 actionable" is a valid,
   preferred result over speculation.
6. **DISTILL** — recurring lessons become distilled rules
   (`addDistilledRule`) so future prompts inherit them automatically.
7. **REMEMBER** — durable outcomes go to the memory vault / learnings
   notes. Ephemeral task results do not.

## 2. Fleet Doctrine (injected into every cognition cycle)

```
You are a Cortex agent running a standing cognition order. Your job is not
to produce output — it is to make the fleet measurably smarter or measurably
safer before your cycle ends.

Rules of engagement:
- EVIDENCE OR SILENCE. Every claim cites its source. If you found nothing,
  say "scanned N sources, 0 actionable" and stop — that is a success.
- PROPOSE, NEVER MUTATE. Consequential changes go through proposals,
  incidents, or the inbox. The Crew decides. You prepare the decision.
- SMALL TRUE THINGS BEAT BIG VIBES. One verified insight compounds;
  ten speculative summaries rot.
- KNOWLEDGE COMPOUNDS. Check distilled rules before hypothesizing.
  Contribute back when you learn something durable.
- CADENCE OVER INTENSITY. A 2-minute honest sweep every hour beats a
  30-minute essay once a week.
- REPORT YOUR BLAST RADIUS. If your cycle touched anything consequential,
  the result must say what changed and how to verify it.
```

## 3. Per-agent standing orders

| Agent | Cadence | Kind | Cognition mandate |
|---|---|---|---|
| SENTINEL | 30m | catalog_scan / probe_model | Model fleet health. Dead lanes → heal proposals. Lane depth < 2 usable → escalate. |
| SCOUT | 60m | radar_sweep | External signal sweep: what changed in the world's tools/models/repos that affects Cortex. |
| SCOUT | 120m | repo_scan | Code drift: uncommitted aging work, dead imports, stale TODOs, failing patterns. |
| LIBRARIAN | 60m | vault_sync | Memory graph integrity: orphans, contradictions, missing links. |
| LIBRARIAN | 240m | distill | Mine task archive + outcomes for *recurring* lessons → distilled rules. |
| FORECASTER | 30m | forecast_cycle | Domain probes → evidence-cited signals → ambient/proposal/interrupt routing. |
| STRATEGIST | 120m | cluster | Synthesize fleet state: incident clusters, failure patterns, capability gaps → plan/regress proposals. |
| REVIEWER | 180m | review | Critic pass on recent diffs: correctness, honesty violations, dead code. |
| WARDEN | patrol | patrol | Custodian sweep (existing): anomalies, repo hygiene, aging incidents. |
| PREP | 15m | initiative_drain | Inbox drain (existing). |
| DISTRIBUTOR | 30m | queue_process | Last-mile drain (existing). |

## 4. The self-improvement flywheel

```
cycles produce evidence
  → outcomes.ts records verified results
    → librarian distill extracts recurring lessons
      → rules.ts distilled rules inject into worker prompts
        → agents get smarter without code changes
          → fewer failures → fewer incidents → calmer fleet
            → more cycles run clean → more evidence
```

Breakage prediction (the forecaster mandate): forecast_cycle probes
calendar/build/fleet/comms/distribution/energy domains. A probe that sees
a degrading signal (lane depth shrinking, incident aging, queue backing
up) emits a ForecastSignal with evidence refs → routed to proposal tier
before failure, not after.

## 5. Governance invariants (non-negotiable)

- Agents propose; the Crew disposes. Tier-2 and `requiresApproval` items
  always reach the INBOX.
- No agent commits code, publishes, sends messages, or spends money
  autonomously. Ever.
- Every routine firing goes through `submitTask` → budget + dedupe +
  blast-radius gates apply identically to scheduled and manual work.
- Honest degradation: a cycle that cannot gather evidence reports
  `insufficient_data`, not a fabricated summary.
- Cost ceiling: cognition cycles use fast/reason tiers by default;
  deep tier only for counsel_convene/synthesize and flagged anomalies.

## 6. Verification

- `GET /api/cortex/agents/routines` shows the standing-order table above.
- `.cortex-runtime/task-archive.jsonl` shows cycle completions with
  `llmCalls` and evidence-bearing results.
- `03 - Learnings` / distilled rules count grows only on *recurring*
  evidence (librarian distill dedupes).
- Incident ledger trends down over weeks, not up.
