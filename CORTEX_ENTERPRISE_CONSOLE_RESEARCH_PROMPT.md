# CORTEX ENTERPRISE CONSOLE — RESEARCH & DESIGN PROMPT

> Mission: Design the ENTERPRISE layer for Nexus Foundry — a single Mission
> Control surface where each venture (Omni, GovTech, future entities) shows
> its tasks, goals, calendar, agents, and evidence in one screen. Research
> first, recommend, do not implement.

You are a principal product architect + design researcher embedded in the
SyncScript Cortex ecosystem. Produce a fact-based, evidence-backed design
recommendation. No mock data, no unverified claims, no implementation.

---

## 1. VERIFIED GROUND TRUTH (do not re-derive; build on this)

**The fleet already exists.** Cortex runs a governed agent fleet
(SENTINEL, SCOUT, LIBRARIAN, BUILDER, REVIEWER, RUNNER, DISTRIBUTOR, WARDEN,
FORECASTER, PREP, STRATEGIST, DEVIN) with:

- Durable task archive (`.cortex-runtime/task-archive.jsonl`) — every task
  has agentId, kind, status, timestamps, result, telemetry
- Mission state (`.cortex-runtime/mission.json`) — goals, ops items,
  planned calendar blocks, cadence suggestions, A/B experiments
- Typed agent message bus (`messages.json`) — handoff/signal/request/ack
- Strategy proposals → Crew-gated INBOX; directives → agent orders
- Budget/yield telemetry per agent per day

**The enterprises already exist as code, but are invisible to the fleet:**

| Enterprise | Real surface | Evidence |
|---|---|---|
| **Omni** | `storefront/` product + `storefront/distribution-queue.json` + `omni-bundle` build tooling | distribution queue items, product SKUs |
| **GovTech** | `src/lib/govtech/` — `sam-types.ts`, `p-win-evaluator.ts`, `compliance-matrix.ts`, `proposal-foundry.ts`, `storefront/tools/sam-gov-scanner.mjs` | `.cortex/reports/govtech/*.json` bid dossiers (TRADEWINDS-CSO-2026-01, FA8811-26-Q-0310, W911QX-26-Q-0042) |

**The critical gap (verified):** nothing in `mission.ts`, the task schema,
goals, calendar blocks, or agent task inputs carries an **enterprise /
venture dimension**. An agent task cannot currently say "this work belongs
to GovTech." Goals cannot be venture-scoped. This is the first-class
problem to solve.

**Existing UI precedent:** Foundry left rail (`CortexFoundryNav.tsx`) has
lazy-loaded panels: TASKS (daypart-grouped ledger + UP NEXT), GOALS,
CALENDAR, AGENTS, INBOX, INCIDENTS, PIPELINE (currently just
`/api/cortex/distribution/status` raw JSON), COMMS. PIPELINE is the
candidate to evolve OR a new ENTERPRISE view alongside it.

---

## 2. RESEARCH QUESTIONS (answer each with sources)

### A. Information architecture
1. What is the canonical UX pattern for a **multi-venture / portfolio
   mission-control** surface? Study: venture studios, holding-company
   dashboards, OKR/portfolio tools (Perdoo, Lattice, Quantive), NASA-style
   program dashboards, airline ops control centers.
2. Should ENTERPRISE be (a) a new rail view, (b) an evolution of PIPELINE,
   or (c) a two-level drill-down (fleet → venture → entity detail)?
   Compare against how Linear/Height handle multi-team views, how Vercel/
   Stripe dashboards handle multi-project scopes.
3. What belongs on the venture card vs. the venture detail screen?
   Minimum viable signal set: open tasks, goal progress, today's blocks,
   pending proposals, active incidents, revenue/pipeline state.

### B. Data model
4. How should the enterprise dimension attach? Options to evaluate:
   tag on task/goal/block (ventureId field), separate venture-scoped
   mission states, or an enterprise registry that scopes queries.
   Consider: one agent serving multiple ventures (DISTRIBUTOR serves Omni
   AND GovTech), cross-venture tasks, and venture-level budgets.
5. Should ventures get their own agent sub-teams, shared fleet with
   routing, or hybrid? What do multi-tenant agent frameworks do?

### C. Prior art — GitHub + skills
6. Find and evaluate repos for: multi-project/portfolio dashboards,
   venture/holding-company consoles, campaign/initiative rollup views,
   entity-scoped task systems. Search terms to try (and expand):
   `portfolio dashboard`, `multi project mission control`,
   `venture dashboard`, `OKR rollup`, `agency dashboard multi client`,
   `command center dashboard`, `multi tenant kanban`.
7. For each candidate repo: license, activity (last commit), stack fit
   (React/TS + JSON-file state vs. our Supabase+Vite stack), and whether
   it solves a REAL gap or is cosmetic. Explicitly reject repos that
   would replace our governed fleet with an ungoverned chat UI.
8. Check existing skills (`~/.claude/skills/`, `.devin/skills/`) for
   anything applicable — design systems, dashboard patterns, research
   tooling — before recommending new dependencies.

### D. Differentiation
9. What would make this "eons ahead" rather. than a reskinned task list?
   Candidate differentiators to research and pressure-test:
   - **Evidence-weighted venture health**: every venture metric backed by
     archive evidence, never self-reported
   - **Cross-venture resource contention view**: the fleet is shared —
     show which venture is consuming agent capacity (we have the data)
   - **Venture-level A/B experiments and budget proposals** scoped per
     entity
   - **Autonomous venture scouts**: agents that only see their venture's
     context window
   - Temporal view: venture roadmap vs. today's actual agent activity
10. What do the best-in-class examples do that we should NOT copy?
    (e.g., vanity metrics, traffic-light dashboards without drill-down,
    manual status updates that drift from reality)

---

## 3. DELIVERABLE SPEC

Produce `CORTEX_ENTERPRISE_CONSOLE_SPEC.md` containing:

1. **Decision**: new view vs. PIPELINE evolution vs. hybrid — with
   reasoning tied to the verified UI precedent above
2. **Data model**: exact field additions (ventureId on tasks/goals/blocks,
   ventures registry file, migration path for existing data)
3. **Venture registry**: seed entries for Omni + GovTech with real
   evidence paths (no invented metrics)
4. **UI spec**: panel layout, states (empty/loading/error), drill-down
   behavior, how it composes with existing TASKS/GOALS/CALENDAR data
5. **Agent integration**: how agents declare venture scope on tasks;
   how venture-scoped directives/messages/proposals work; budget
   attribution per venture
6. **Repo/skill recommendations**: table of adopt/evaluate/reject with
   reasons — pattern adoption preferred over wholesale imports
7. **Phased rollout**: what ships first (must be honest-empty, not
   mock-filled), what waits for data
8. **Open questions for the Crew**: decisions only Chris can make

## 4. HARD CONSTRAINTS

- Every claim about existing code must cite file paths verified by
  reading them — no assumed architecture
- Every external repo claim must cite the actual repo (URL, stars,
  last-commit recency) — no hallucinated projects
- The system's core invariant: **evidence or it didn't happen.** Venture
  metrics must derive from archive/mission/messages state, never from
  agent self-report
- Governance unchanged: ventures don't get new authority; Crew approval
  gates still govern irreversible actions
- English only; concise tables over prose
