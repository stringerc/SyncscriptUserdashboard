# Cortex Self-Creating Agents — Specification

> Status: SPEC. Nothing in this document is implemented.
> Core invariant (unchanged): **agent creation is a proposal, never an action.**
> Every spawned agent is evidence-backed, capability-checked, human-approved,
> constrained at birth, and fully auditable.

---

## 0. Why this is viable now

The Nexus Foundry runtime (`src/lib/cortex-agents/`) already provides every
primitive self-creation needs:

| Primitive | Already exists |
|---|---|
| Agent registry + lifecycle | `AGENT_SPECS`, `AgentState`, status machine |
| Task queues, budgets, concurrency | `submitTask`, `dailyCount`, `GLOBAL_CONCURRENCY` |
| Model routing per agent | `modelPin` → matrix `ordered()` |
| Governed execution | `toolExecute` → `/api/cortex/tools/execute` (sovereign key) |
| Event-sourced status | `AgentEvent` bus → SSE → Foundry scene |
| Persistence | `.cortex-runtime/agents-state.json` |
| Human gate | Initiative Inbox + trust ledger (tier-2 = typed ACCEPT) |

Self-creation is therefore a **registry + proposal + lifecycle** problem,
not an execution-machinery problem.

## 1. Prior art (researched)

| System | Pattern worth stealing |
|---|---|
| **Anthropic multi-agent Research** (production) | Orchestrator-worker split; subagents get *self-contained briefs* (objective, output format, tool list, done-criteria); separate verification pass for claims; stateful checkpointing because "errors compound" in agents |
| **AutoGen v0.4** | Actor model — agents are async message processors; dynamic workflows as a first-class runtime concept |
| **AgentScope 2.0** | `AgentCreate`/`AgentInvite` tools; role-based tool visibility (leader vs worker); per-member session isolation with shared team identity |
| **OpenSage** | Two-step creation: parent emits an *agent configuration* (metadata: model, system instruction, tools, description, initial memory) → engine parses and instantiates; sub-agent pool with search/register/invoke; vertical (sequential) and horizontal (ensemble) topologies |
| **Voyager (NVIDIA)** | Skill library — verified-working behaviors are stored as reusable "skills"; agents get better by accumulating, not by proliferating |
| **Kour dynamic-spawning pattern** | Lifecycle: Decompose → Check Cache → Generate → Assemble → Execute → Synthesize → Release/Cache/Refine |

**Synthesis:** every serious system converges on the same shape — *a pool of
agents with search/reuse, creation as a first-class tool call, role-scoped
tooling, and explicit lifecycle (release/cache/refine)*. Cortex already has
the pool (`agents` map) and the gate (initiative inbox). What's missing is
the *creation tool*, the *evidence contract*, and *ephemeral lifecycle*.

## 2. The need gate — "do we actually need this agent?"

Creation proposals must clear ALL of these. The gate is deterministic code,
not LLM judgment — the LLM proposes, the gate disposes.

### 2.1 Evidence requirement (hard gate)

A `propose_agent` call must cite at least one of:

- **Repeated failure**: ≥3 same-kind task failures for an existing agent in
  the trailing 7 days, with the failure reason clustering on a missing
  capability (extracted from `task.error` fields).
- **Budget saturation**: an agent hit its daily budget ≥3 days in the last 7
  AND queued tasks were rejected (observable via `submitTask` rejections).
- **Latency deficit**: median task duration for a kind exceeds 3× the
  fleet median for 5+ consecutive tasks.
- **Capability gap**: a proposal explicitly requests a tool/scope no existing
  agent's spec covers (checked against a capability registry).

The proposal payload carries the evidence refs (task IDs, dates, counts).
The gate re-derives them from runtime state — a proposal that cites tasks
which don't exist or don't match is auto-rejected as fabricated.

### 2.2 Capability-overlap check

Before a proposal reaches the inbox, compute overlap against existing agents:
role keywords, tool scopes, model tier. If overlap > threshold (Jaccard ≥0.6
on capability tags), the proposal is folded into a comment on the existing
agent's spec instead ("extend SCOUT's scope") — proliferation is the failure
mode this gate exists to prevent.

### 2.3 Need recurrence

One-off tasks never justify agents. The evidence window (7 days) plus a
minimum count (3) means the need must *recur*. A single impressive failure
does not spawn anything.

## 3. Proposal → approval flow

```
agent/worker detects pattern
  → cortex_agents {action:"propose_agent", spec, evidence}
  → runtime.validateProposal()          // deterministic gate (§2)
  → initiative.submitProposal({
      kind: 'agent_spawn', tier: 2,     // typed ACCEPT always required
      payload: spec + evidence + overlap report
    })
  → Inbox card: "SCOUT proposes AGENT-X 'Compliance Analyst' —
     evidence: 4 failed finance tasks this week; scope: read-only;
     TTL: 72h; budget: 8/day"
  → human ACCEPT → runtime.spawnAgent(spec, approvedBy, proposalId)
```

**Tier-2 forever.** Agent creation is never eligible for trust-ladder
graduation — same invariant as destructive tools. Even read-only agents
require one human ACCEPT. (Future relaxation path: after N clean ephemeral
agents, a *class* of agents — e.g. "read-only research, 24h TTL" — could be
proposed for auto-approval; that decision is deliberately out of scope.)

## 4. The AgentSpec contract (birth certificate)

```ts
interface SpawnSpec {
  // identity
  callSign: string;              // 'COMPLIANCE-7' — generated, not chosen by LLM freely
  role: string;                  // 'Compliance Analyst'
  mission: string;               // one paragraph, human-readable in the Inbox
  parentAgentId?: AgentId;       // lineage — who proposed it

  // capability envelope (least privilege at birth)
  tools: ToolScope;              // explicit allowlist; default = read-only set
  modelPin: AgentPin;            // tier + optional provider excludes
  dataScopes: string[];          // e.g. ['repo:read', 'gmail:metadata'] — no secrets

  // constraints
  dailyBudget: number;           // hard cap, small (default 8)
  ttlHours: number;              // ephemeral by default (default 72h)
  maxTasksTotal?: number;        // optional absolute cap
  concurrency: 1;                // spawned agents never exceed 1

  // behavior
  systemBrief: string;           // the worker's standing instructions
  doneCriteria: string;          // what "finished" means for its tasks
}
```

### 4.1 Generic ephemeral worker

Spawned agents share ONE worker implementation (`ephemeralWorker`) —
they differ only by spec, not code:

1. Receive task (kind + input) from queue.
2. Load `systemBrief` + `doneCriteria` + recent memory snapshot.
3. Plan → act via `toolExecute` on allowlisted tools only.
4. Verify `doneCriteria` against real outputs before reporting completion.
5. Emit standard lifecycle events (Foundry renders them identically to
   built-ins — no special-casing).

This is the OpenSage/AgentScope pattern: creation produces *configuration*,
not new code. Code-generating agents (agents that write their own worker
logic) are explicitly **out of scope v1** — config-only spawning keeps the
governed surface auditable.

### 4.2 Tool scoping

`ToolScope` maps to the existing tool registry:

- `read` — read_file, list_dir, search_code, web_search, cortex_memory(search)
- `write` — write_file, edit_file (repo paths only, still governed)
- `exec` — run_command (always tier-2 proposals for destructive patterns,
  enforced by the existing DESTRUCTIVE_RE/TIER2_RE gates)
- `surface` — cortex_surface, cortex_map (UI effects only)

Default spawn scope: `read` only. Any scope beyond read requires the
proposal to say so explicitly AND the human ACCEPT covers it.

## 5. Lifecycle — birth, probation, retirement

| Phase | Duration | Behavior |
|---|---|---|
| **Gestation** | proposal → ACCEPT | Spec frozen; no execution. Dedupe key = callSign + mission hash. |
| **Infancy** | first 3 tasks or 24h | All tasks emit extra telemetry; failures count double against retirement. |
| **Active** | until TTL or `maxTasksTotal` | Normal operation; budget enforced per UTC day. |
| **Retirement** | TTL expiry / budget-exhausted streak / human revoke | Queue drains (running tasks finish or cancel per policy); agent → `retired`, spec + task history retained for audit; Foundry shows it dimmed with RETIRED badge. |
| **Reactivation** | human only | Retired agents never self-restart. A new proposal must justify anew. |

**Auto-retire triggers** (any one):
- TTL expires with no completed task in final 24h
- 3 consecutive task failures
- Daily budget exhausted 3 days running (the need evaporated)
- Parent agent that proposed it is retired/removed

## 6. Fleet-level guardrails

- **Hard cap**: max 4 spawned agents concurrently (built-ins don't count).
  Fleet total ≤ 8.
- **Restraint metric**: `agents_spawned`, `agents_retired`, `spawn_proposals_rejected`
  join the existing restraint counters — shown in Foundry telemetry.
- **LLM concurrency**: spawned agents share `GLOBAL_CONCURRENCY`; ephemeral
  workers yield to built-ins (priority queue: sentinel > scout/librarian >
  builder > ephemeral).
- **No nesting**: spawned agents cannot propose agents (depth-1 only).
  Prevents recursive proliferation — the single most important anti-cancer
  rule.
- **Audit**: every spawn/retire/task emits `agent.spawn`, `agent.retire`,
  standard `task.*` events — full lineage reconstructable from the event log.

## 7. Foundry UI implications

- Spawned agents render on a **second, outer orbital ring** — visually
  distinct (thinner hull, dashed orbit, "EPHEMERAL" tag, TTL countdown).
- Retired agents fade to 15% opacity, desaturate, keep their task history
  in the dossier.
- Telemetry panel gains: `SPAWNED: n/4 · PROPOSALS PENDING: n · RETIRED: n`.
- Inbox proposal cards for `agent_spawn` get a dedicated layout: spec
  summary, evidence table, scope badges, TTL/budget chips.

## 8. What this spec deliberately excludes

- **Self-modifying code**: agents never write their own worker logic.
- **Persistent identity**: no long-term memory promotion for ephemeral
  agents (their results flow back to the proposer / vault via tasks).
- **Inter-agent negotiation**: spawned agents take tasks from the runtime
  queue only — no peer messaging (diplomacy spec covers Cortex↔Cortex later).
- **Auto-approval**: even the safest class requires one human ACCEPT in v1.
- **Model self-selection**: `modelPin` is set at proposal time by the
  proposer but validated against matrix health at spawn.

## 9. Build order (when approved)

1. `SpawnSpec` types + `runtime.spawnAgent()` / `retireAgent()` + ephemeral worker
2. `propose_agent` gate (§2) — evidence re-derivation + overlap check
3. `agent_spawn` initiative kind + Inbox card layout
4. Foundry outer-ring rendering + telemetry counters
5. `cortex_agents {action:"propose_agent"}` tool + prompt documentation
6. Tests: gate rejection cases, TTL retirement, scope enforcement, no-nesting

## 10. Open questions for the user

- Should spawned agents be able to *write* at all in v1, or read-only until
  the trust ladder proves the pattern?
- TTL default: 72h feel right, or shorter (24h) for first iteration?
- Should the Foundry show a "proposed agents" ghost ring (pending ACCEPT)?
