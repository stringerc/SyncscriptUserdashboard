# CORTEX WARDEN — Systems Custodian Agent

> Status: IMPLEMENTED (v1)
> Role: the agent that watches Cortex itself. Sentinel watches *models*;
> Warden watches *the machine*. Read-only by design — it detects and
> reports, it never repairs.

## Why this exists

Before Warden, nothing verified that Cortex's own subsystems were alive.
Model Sentinel probes provider catalogs; workers execute tasks; the
self-heal MCP fires only reactively. A stalled SSE stream, a dead
accomplishment ledger, or a broken tools endpoint would go unnoticed
until a human looked. Warden closes that gap so the fleet can be
trusted during active development.

## Design contract

- **Read-only.** Warden holds no write/exec tool scope. Its only outputs
  are patrol reports (task results), runtime events, and ledger entries
  via the existing task-completed hook. It cannot fix, restart, or
  mutate anything — by construction, not by policy.
- **Evidence or silence.** Every check is a real HTTP/fs probe with a
  measured latency. A check that cannot run reports `ok:false` — never
  assumed healthy.
- **Cheap lane.** `modelPin: { tier: 'fast' }`, concurrency 1,
  dailyBudget 160 (≈10-minute patrol cadence + manual runs).
- **Bootstrap honesty.** Like Sentinel, Warden's probes are raw fetches
  — they do not depend on the LLM matrix they partially monitor. The
  single LLM touchpoint (`llm.fast` check) is itself a check: if the
  matrix is down, that check fails and is reported as an anomaly.

## Patrol check suite (v1)

| Check | Probe | Critical |
|---|---|---|
| `agents.runtime` | `GET /api/cortex/agents/state` → 200, agents array, `offline:false` | yes |
| `agents.stream` | `GET /api/cortex/agents/stream` → first SSE bytes within 3s | yes |
| `models.matrix` | `GET /api/cortex/models/health` → per-lane usable count; anomaly if a lane has zero usable candidates | yes |
| `cortex.tools` | `GET /api/cortex/tools` → 200 | yes |
| `cortex.vigilance` | `GET /api/cortex/vigilance/status` → 200 | no |
| `llm.fast` | `ctx.llm({tier:'fast'})` minimal completion — end-to-end matrix proof | yes |
| `tts.neural` | probes every configured neural TTS endpoint (kokoro/voicestudio/pocket, same defaults as `/api/cortex/tts`); critical anomaly when **all** are dead — that's when voice silently degrades to robotic browser synth | yes |
| `state.persistence` | `.cortex-runtime/` writable + `agents-state.json` parses, mtime < 24h | yes |
| `ledger.accomplishments` | `~/.openclaw/memory/accomplishments/` exists + writable | no |

Future checks slot into `runPatrolChecks()` as new entries — the report
schema (`{name, ok, ms, detail}`) is already generic. Candidate v2
checks: vault graph freshness, initiative inbox backlog age, spawned-
agent TTL sweep verification, MCP bridge reachability, visualizer SSE
client count.

## Cadence & escalation

- Scheduler (vite.config): submits `warden/patrol` every
  `CORTEX_WARDEN_INTERVAL_MS` (default 10 min), deduped against queued/
  running warden tasks. First patrol ~20s after boot.
- Every patrol emits `warden.patrol` — Foundry mission log, event
  ticker, and core-scene crew chip pick it up automatically.
- Task completion auto-logs to the accomplishments ledger → daily
  briefings include patrol health.
- **Anomalies**: when `healthy:false`, the worker makes one cheap fast-
  tier LLM call to write a 2-sentence alert summary returned as
  `alert`. v1 deliberately does NOT auto-file initiative proposals —
  alert fatigue is the failure mode; tune thresholds first, automate
  escalation later.

## What Warden is NOT

- Not a repair agent. Detection → report → human/initiative decides.
- Not a spawned agent. Custodians are built-ins; they don't need
  approval to exist and can't be retired by TTL.
- Not a replacement for Sentinel. Sentinel owns model truth; Warden
  consumes `/api/cortex/models/health` as ONE check among many.
