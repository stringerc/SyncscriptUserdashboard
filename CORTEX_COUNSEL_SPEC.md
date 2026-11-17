# Cortex Counsel Spec — Go/No-Go Deliberation Layer + Foundry Command Board

Status: SPEC — implementation prompt.
Frame: Mission Control. Cortex = Flight Director. IDEs = specialist
consoles. You = the crew commander who says GO or NO-GO.

## 1. Why this exists (the gap, honestly stated)

Today Cortex has:
- **Hierarchy**: agent fleet, blast-radius lanes, budgets, proposals — real.
- **Gate**: strategy-proposals + Discord approval buttons — real.
- **No counsel**: when a decision is cross-domain, ONE agent (usually
  STRATEGIST) decides alone, or you decide with no structured input.
  IDEs (Antigravity, Claude Code, Cursor) are either inside Cortex
  (DEVIN bridge) or entirely outside it — no room where they confer.

The counsel is that room. It is a **deliberation primitive**, not a
chat room: bounded, evidenced, audited, and subordinate to the gate.

Research basis (why this shape):
- **NASA Go/No-Go poll** (Apollo/ Shuttle flight rules): before launch,
  every controller calls position; Flight Director decides; ground
  commander holds final authority. Proven under maximum stakes.
- **Delphi method**: independent anonymous positions → feedback round
  → convergence. Prevents anchoring and seniority bias.
- **Red team / premortem** (Gary Klein): explicitly assigning a
  dissenter improves decision quality more than adding agreeers.
- **ICJ/amici & Cabinet precedent**: counsel advises, never decides.

Design rule borrowed from all four: **positions are independent,
written, and evidence-attached; synthesis is a separate step; the
verdict is a recommendation, not an action.**

## 2. The Counsel Primitive

### 2.1 Session lifecycle

```
CONVENE → BRIEF → POSITIONS → (OPTIONAL REBUTTAL) → SYNTHESIS → POLL → VERDICT → CLEARANCE
```

1. **CONVENE** — triggered by: STRATEGIST flagging a Hard-lane or
   cross-domain decision, a user request ("get counsel on X"), or an
   incident escalation. Creates `counsel-session` state.
2. **BRIEF** — one identical brief packet to every member: the
   decision, constraints, evidence pack (world-state, relevant
   proposals/incidents/tasks). Same input for all — no information
   asymmetry, no anchoring order.
3. **POSITIONS** — each member returns a structured position:
   `{member, stance: 'go'|'no-go'|'conditional', confidence 0-1,
    key_evidence[], risks[], required_conditions[], reasoning≤400ch}`.
   Independent first round — members do NOT see each other's positions
   (Delphi). Uncited positions rejected (Evidence or Silence applies
   to counsel too).
4. **REBUTTAL (optional, max 1 round)** — anonymized positions are
   shared; members may revise stance with new evidence. Prevents
   bandwagon revision; log all revisions.
5. **SYNTHESIS** — STRATEGIST (Flight Director) produces the poll
   result: per-member stance table, points of agreement/conflict,
   unresolved objections, recommended verdict.
6. **POLL** — the verdict goes to the human as a GO/NO-GO card
   (Discord + Foundry board). Hard-lane items REQUIRE human GO;
   Reversible items may auto-clear after timeout ONLY if every member
   returned 'go'/'conditional' with no 'no-go' (configurable).
7. **VERDICT → CLEARANCE** — human GO converts the counsel outcome
   into a normal strategy-proposal/dispatch through the EXISTING
   approval plumbing. Counsel never dispatches directly.

### 2.2 Counsel members (consoles)

| Console | Member | Adapter | Status |
|---|---|---|---|
| FLIGHT DIRECTOR | Cortex core / STRATEGIST | internal | exists |
| GUIDANCE | Antigravity | file-drop or API brief exchange | P1 |
| FLIGHT DYNAMICS | DEVIN | `devin-bridge.ts` | exists |
| EECOM (power/compute) | SENTINEL + model-health | internal agent task | exists |
| FDO (trajectory) | FORECASTER | internal agent task | exists |
| CAPCOM (crew liaison) | BRIEF/DEBRIEF + voice | internal | exists |
| SURGEON (quality) | WARDEN | internal agent task (read-only) | exists |
| EXTERNAL COUNSEL | Claude Code / Cursor / user-pasted positions | manual file-drop `/counsel/positions/` | P2 |

"IDE counsel" does NOT mean remote IDEs join live sessions in v1.
v1 = structured async position exchange via files/API. Live multi-IDE
sessions are P3+ and need auth/isolation design first.

### 2.3 State & storage

- `.cortex-runtime/counsel/sessions/<id>.json` — session, brief,
  positions, synthesis, verdict, clearance ref.
- `.cortex-runtime/counsel/positions/<session>-<member>.json` —
  drop-folder for external/manual members (atomic write = filed).
- Append-only `counsel-log.jsonl` — every transition, for audit.
- Retention: sessions older than 30d archived, never deleted.

### 2.4 Governance invariants (non-negotiable)

- Counsel output is ADVISORY. It cannot approve, dispatch, post, or
  mutate. Clearance flows through existing proposal/budget/lane gates.
- Max 3 sessions/day default (env `CORTEX_COUNSEL_DAILY_CAP`), max 2
  rebuttal rounds, position timeout 15min → recorded as
  `no-response` (counts as neither go nor no-go, but is displayed).
- Every position and synthesis stored — the audit trail is the point.
- Evidence-or-Silence: positions without `key_evidence` are rejected
  at intake, same contract as PREP/brief sources.

## 3. Foundry Command Board (2D, `CortexAgentsScene`)

The Foundry deck (`faceMode === 'agents'`, `CortexAgentsScene.tsx`)
gains a **TOWER overlay mode** — toggled by a console button or
`?foundry=tower`. Do NOT touch `CortexCoreScene`/core face.

### 3.1 Layout (canvas, existing deck aesthetic)

```
┌─ COMMAND BOARD ──────────────────────────────────────────┐
│ FLIGHT DIRECTOR   Cortex — ● NOMINAL   GET 02:14:33      │
│ WORLD-STATE STRIP  8:29 AM EDT | Mac ● Oracle ● | 20 dirty│
├─ CONSOLE POSITIONS ──────────────────────────────────────┤
│ GUIDANCE    Antigravity   ○ idle     positions: 0        │
│ FLIGHT DYN  DEVIN         ● active   session: csl-8f2     │
│ EECOM       SENTINEL      ● probing  models: 5/6 ok       │
│ FDO         FORECASTER    ● open     forecasts: 3         │
│ CAPCOM      BRIEF/DEBRIEF ● delivered today: 2/2         │
│ SURGEON     WARDEN        ● clean    incidents: 0 open    │
│ EXTERNAL    Claude/Cursor ○ drop-folder ready            │
├─ GO / NO-GO QUEUE ───────────────────────────────────────┤
│ ● csl-8f2  "Ship omni-bundle v2?"   poll: 3 go/1 cond/0  │
│           [VIEW POLL] [OPEN PROPOSAL]                    │
│ ⚠ prop-91  BUILDER budget          waiting 6h2m           │
│ ⚠ cal-12   Calendar write Thu 2pm                       │
├─ MISSIONS ──────────────────────────────────────────────┤
│ SHYNED ●orbit  Lawbot ●orbit  Stores ●degraded           │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Behavior spec

- **Status lamps**: ● active/green, ○ idle/gray, ⚠ attention/amber,
  ✕ down/red. Derived from agents-state + world-state + counsel
  sessions — never hardcoded.
- **Console rows are clickable** → drill into that member's recent
  tasks/positions (reuse existing agents endpoints).
- **GO/NO-GO queue** = pending strategy-proposals + open counsel
  polls, sorted by wait time. This is the "gate pass" made visible.
- **Counsel poll card** expands inline: member stances as a poll
  board (Apollo-style), synthesis text, evidence links, and the
  approve/dismiss buttons wired to the EXISTING proposals POST
  endpoint — no new mutation path.
- Live updates via existing `/api/cortex/agents/stream` SSE or 4s
  poll (match deck's current cadence).
- Reduced-motion respected; lamps pulse only on state *change*.

### 3.3 New endpoint

`GET /api/cortex/tower` → composed board model:

```ts
{
  flightDirector: { status, worldStateHeader },
  consoles: [{ id, name, role, lamp, lastAction, counselCount }],
  polls: [{ sessionId, question, stances:{go,noGo,conditional,
           noResponse}, synthesis?, ageMinutes, proposalId? }],
  clearanceQueue: [/* existing proposals shape */],
  missions: [/* distribution/product status */]
}
```

Client may also compose from existing endpoints; prefer the composed
endpoint for one round-trip and a stable contract.

## 4. Build order

- **P0 — Counsel state machine + storage + tests** (pure TS):
  `src/lib/cortex-counsel.ts` — session lifecycle, position intake
  validation (evidence-required), synthesis record, verdict states.
  No LLM calls yet — positions can be filed manually via drop-folder.
- **P1 — Tower endpoint + Foundry board UI**: `/api/cortex/tower`,
  `CortexAgentsScene` tower overlay, console rows, GO/NO-GO queue.
  This delivers the *visual* hierarchy today with real data.
- **P2 — STRATEGIST convenes sessions**: brief fan-out to internal
  members (SENTINEL/FORECASTER/WARDEN as agent tasks), position
  collection, synthesis → strategy-proposal (enters existing gate).
- **P3 — External counsel adapters**: Antigravity file-drop round-
  trip documented; Claude Code/Cursor manual position filing.
- **P4 — Optional**: rebuttal round, auto-clear rules for
  all-go Reversible items, tower face promoted to 3D later.

## 5. Who builds what (honest division)

- **Devin builds**: state machine, endpoint, Foundry UI, tests,
  docs. Deterministic code, verified before "done".
- **Cortex/STRATEGIST runs**: sessions, synthesis, convening — once
  P0/P2 land. Counsel is a STRATEGIST duty, not a new agent.
- **Antigravity/other IDEs participate**: as counsel *members* via
  position papers — they advise, they don't build the gate.
- **User holds**: GO/NO-GO on Hard lane. Non-negotiable.

## 6. Verification

- Unit: session transitions, evidence-rejection, timeout→no-response,
  verdict gating (Hard never auto-clears), audit log append-only.
- Live: convene a test session → file 2 manual positions via
  drop-folder → synthesize → poll card appears on Foundry board →
  approve via existing proposals POST → task dispatches through
  normal gates.
- Visual: tower overlay renders all console lamps from live state;
  GO/NO-GO queue matches `/api/cortex/agents/proposals?status=pending`.

## 7. Non-goals (v1)

- No live multi-IDE streaming sessions.
- No counsel-initiated actions — advisory only, forever.
- No changes to `CortexCoreScene` / core visualizer face.
- No probabilistic gating — deterministic rules only (the FEP
  proposal stays rejected; hard gates are stronger).
- No claim of "omniscience" — the board shows only measured state
  with the same evidence-or-silence contract as everything else.
