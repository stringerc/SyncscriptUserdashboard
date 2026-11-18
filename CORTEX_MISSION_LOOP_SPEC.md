# CORTEX MISSION LOOP SPEC

> Doctrine for the Goal → Task → Calendar → Agent → Evidence → Progress loop.
> Companion to CORTEX_COGNITION_SPEC.md. Same contract: evidence or silence,
> propose never mutate (except bounded, reversible internal config),
> knowledge compounds.

## 1. The problem this solves

Today the loop is broken at every joint:

- **Goals don't persist.** `useGoals` seeds from `enhancedGoalsData` (static
  array) into `useState`. There is no server-side goal store. A goal is a
  React render, not a fact.
- **Tasks persist but float.** Tasks live in Supabase with `dueDate`, but
  nothing decomposes goals into them and nothing schedules them against the
  real calendar.
- **Calendar is write-only from the client's perspective.** The client pushes
  its next 48h into `.cortex-runtime/calendar-upcoming.json`; nothing reads it
  to *place* work.
- **Today's Ops checklist is a stale static file**
  (`storefront/today-checklist.json`, dated 2026-11-15). `done` flags are
  manual — nobody checks whether the work actually happened.
- **Routines run blind.** Cadence is a constant chosen at seed time. A scout
  sweep that finds actionable signal every hour pays the same cost as one
  that finds nothing for a week.

Result: the Crew is the integration layer. This spec removes the Crew from
*tracking* while keeping the Crew as *authority*.

## 2. Architecture

```
                    ┌─────────────────────────────────────────┐
                    │         MISSION STATE (.cortex-runtime) │
                    │  mission.json: goals, ops, blocks,      │
                    │  cadence table, alignment snapshot       │
                    └─────────────────────────────────────────┘
                          ▲          │              │
            register/plan │          │ verify       │ schedule
                          │          ▼              ▼
   GOALS ──decompose──▶ TASKS ──slot──▶ CALENDAR ──▶ AGENTS ──▶ EVIDENCE
   (mission store)   (Supabase /      (free/busy     (routines +     (archive,
                     agent runtime)    mirror +       ad-hoc)        outcomes,
                                      energy prefs)                distribution)
```

### 2.1 Mission state — `mission.ts`

Single persisted document at `.cortex-runtime/mission.json`:

```ts
interface MissionState {
  goals: MissionGoal[];        // id, title, horizon, targetDate, status,
                                //   taskIds[], progress (computed, not stored)
  opsItems: OpsItem[];         // id, label, evidence spec, done, verifiedAt
  blocks: ScheduleBlock[];     // id, title, agentKind, start, end, status
  cadence: CadenceEntry[];     // routineId, agentId, kind, intervalMin,
                                //   yield stats, lastAdjustment
  updatedAt: number;
}
```

Goals in the mission store are the **canonical planning goals**. The
TasksGoalsPage UI can mirror them later; v1 truth lives server-side so
agents can read it without a browser.

### 2.2 Ops items — evidence or manual, never vibes

Every ops item declares how `done` is proven:

```ts
{ id: 'first-sale', label: 'First off-platform sale',
  evidence: { type: 'distribution', minSales: 1 }, done: false }
{ id: 'calendar-cadence', label: 'Post calendar cadence events',
  evidence: { type: 'agent_tasks', agentId: 'prep', kind: 'calendar_post',
              withinHours: 48, minCount: 1 }, done: false }
{ id: 'reddit-comments', label: 'Draft + post Reddit comments',
  evidence: { type: 'manual' }, done: false }   // honest: no sensor exists
```

Verifier (`verifyOpsItem`) reads the real sources — task archive, outcomes
ledger, distribution status, calendar mirror — and returns
`done | pending | stale | unverifiable`. `manual` items stay manual but get
**stale detection**: an unchecked manual item older than N days surfaces as
`stale` in the ops report instead of silently rotting.

This directly fixes Today's Ops: same items, but `done` is *computed*.

### 2.3 Goal → task decomposition

`goal_plan` work is strategist-shaped and **governed**: a strategist routine
(or manual trigger) reads active goals, proposes task breakdowns as strategy
proposals (actionClass `process`/`code` as appropriate). Approved proposals
dispatch builder tasks that create real tasks. No silent task injection —
decomposition is a proposal, execution is evidence.

v1 ships the *state + alignment math*; the decomposition routine is a
follow-up once the store is proven.

### 2.4 Task → calendar scheduling

`POST /api/cortex/mission/schedule` — deterministic, no LLM:

1. Read busy blocks from `calendar-upcoming.json` (real events).
2. Read mission `blocks` (planned agent work).
3. Fill free slots inside work-hours prefs (default 08:00–22:00 local,
   configurable) by priority: goal-critical first, then routine-adjacent.
4. Write `blocks[]` with status `planned → dispatched → verified`.

Blocks are *intent*, not calendar writes — v1 does not mutate Google
Calendar. Writing real events is a tier-2 action behind approval.

### 2.5 Adaptive cadence — yield-driven intervals

Every routine already stamps `routineId` into task input, and the archive
records outcome. Yield per routine over a trailing window:

```
yield = completed / total        (reliability)
value = actionable outputs / run (signal — judged by result content or
                                  proposal/incidents it spawned)
```

`cadenceAdvisor` rules (bounded, auditable):

- yield < 0.5 over ≥6 runs → **increase** interval (×1.5, cap 4× base)
- yield ≥ 0.9 AND value > 0 for ≥6 runs → **decrease** interval (×0.75,
  floor 15min — `ROUTINE_MIN_MINUTES`)
- otherwise → hold

Adjustments go through `runtime.updateRoutine` (new) which preserves
`runCount`/`lastRunAt` and appends a `cadence` audit entry with reason.
Cadence changes are **internal reversible config** — auto-applied within
bounds, logged, and reported. Anything outside bounds (interval < 15m,
> 4× base, or disabling a routine) files an INBOX proposal instead.

### 2.6 Alignment snapshot

`GET /api/cortex/mission/state` returns, per goal: progress =
`verifiedTasks / plannedTasks`, plus orphan detection — tasks/blocks with
no goal linkage, goals with no tasks. This is the "are we working on the
right things" answer, computed not narrated.

## 3. A/B testing the ecosystem

Trainer already does offline A/B for *rules*. Mission loop extends the
same discipline to *cadence and scheduling*:

- **Cadence A/B**: split comparable routines into control/variant cohorts.
  Control keeps interval A; variant gets B for a fixed window (≥3 days or
  ≥10 runs). Compare yield + value + token cost per run. Winner becomes the
  new baseline; result logged as a distilled rule ("scout radar every 45m
  beats 60m on actionable yield").
- **No live traffic risk**: routines are internal; worst case is wasted
  compute, not wrong user-facing behavior. Still bounded by budget caps.
- **Interleaved option**: for high-frequency routines, alternate intervals
  day-over-day to cancel drift (day effects, provider outages).

v1 ships yield metrics + advisor. Formal cohort A/B is spec'd here and
implements once ≥2 weeks of routine telemetry exist.

## 4. What v1 ships

| Piece | Status |
|---|---|
| `mission.ts` state store (goals/ops/blocks/cadence) | ✅ |
| Ops evidence verifiers + stale detection | ✅ |
| `/api/cortex/mission/*` endpoints | ✅ |
| `runtime.updateRoutine` for cadence | ✅ |
| Cadence advisor (bounded auto + proposal outside) | ✅ |
| Alignment/orphan math in state endpoint | ✅ |
| Goal decomposition routine | ⏳ spec'd, follow-up |
| Calendar block → real Google event write | ⏳ tier-2 approval |
| UI wiring (TasksGoals/Calendar tabs read mission state) | ⏳ follow-up |
| Formal cadence A/B cohorts | ⏳ needs telemetry window |

## 5. Invariants

1. **Evidence or silence** — an ops item is `done` only when its evidence
   spec verifies. `manual` means honestly manual.
2. **Propose never mutate** — goal decomposition, calendar writes, and
   out-of-bounds cadence changes are proposals. Bounded cadence tuning is
   the sole auto-mutation, and it is reversible + audited.
3. **No silent scheduling** — blocks record *why* (which goal/task, which
   free slot) so the Crew can audit the plan, not just the outcome.
4. **Stale is a first-class state** — unchecked work surfaces as stale;
   it never rots invisibly (the exact failure mode of today-checklist.json).
