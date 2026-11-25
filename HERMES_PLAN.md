# PLAN — Hermes Restoration & Elevation

## Verified Diagnosis (facts, measured this session)

**Hermes is not down. The path to it is.** Measured live:

| Layer | State | Evidence |
|---|---|---|
| Executor (Oracle VM) | **UP 7mo+** | `hermes-executor.service` active; `GET /health` → `{"status":"ok","edge_configured":true}` |
| Public transport | **UP, fragile** | orphaned `cloudflared --url http://127.0.0.1:18880` quick tunnel — ephemeral `*.trycloudflare.com` URL stored in Supabase `HERMES_BASE_URL` secret |
| Edge bridge | **UP** | `GET .../hermes/health` → `hermesStatus:"connected", httpStatus:200` |
| Local `:18880` | **DOWN** | nothing listening on Mac; local LaunchAgent `com.syncscript.hermes-executor` exit 1 — plist points at `integrations/hermes-executor-server.mjs`, **deleted from repo** (canonical copy lives only on VM `/opt/syncscript/`) |
| Fleet agent `hermes` | registered, **0 tasks ever** | `agents-state.json`: idle, tasksCompleted 0 |
| `hermesWorker` | **broken by default** | `workers.ts:3199` defaults `targetUrl` → `http://127.0.0.1:18880` (dead) unless `HERMES_EXECUTOR_URL` set — and **bypasses Edge auth/audit entirely** |
| `executeGatedTool` | same bug | `cortex-openclaw-adapter.ts:483` same localhost default |
| Gateway status probe | **reports false "down"** | `vite.config.ts:17920` probes `127.0.0.1:18880` only — never checks the real Edge path |

**Root cause of "hermes agent is down":** the system moved the executor to the Oracle VM ~7 months ago, but three local surfaces still assume localhost: the health probe, the fleet worker, and the gated-tool adapter. The LaunchAgent is a corpse pointing at a deleted file. Edge→VM path is healthy but invisible to every local instrument.

## Phase 0 — Truth Restoration (make "down" mean down)

1. `vite.config.ts` gateways/status: probe **Edge `/hermes/health`** as primary (that's the production path), report `executor` (VM direct, best-effort via stored tunnel URL) + `edge` + `local` as separate fields — no more single misleading boolean.
2. `workers.ts` hermesWorker + `cortex-openclaw-adapter.ts`: **stop defaulting to `127.0.0.1:18880`**. Default = Edge bridge (pass no `targetUrl` → `invokeHermesTool` uses `BRIDGE_BASE/invoke` — authenticated, audited). `HERMES_EXECUTOR_URL` remains an explicit escape hatch for local dev.
3. Restore `integrations/hermes-executor-server.mjs` into the repo (pull canonical 263-line copy from VM) so the LaunchAgent has a real file and local dev can run a genuine executor; or retire the plist if we decide local executor is dead weight. **Decision needed.**
4. Fleet probe: `hermes` agent status should reflect Edge health, not localhost.

## Phase 1 — Durable Transport

5. Replace quick tunnel with **named Cloudflare tunnel** on VM (`hermes-tunnel.service`, systemd, auto-restart) → stable hostname e.g. `hermes.cortex-syncscript.<domain>` → update `HERMES_BASE_URL` secret **once**. Eliminates the silent-outage mode where cloudflared restart orphans the secret.
6. `scripts/bringup-hermes-tunnel-supabase.sh`: add named-tunnel mode as default; keep quick tunnel as fallback.
7. Add hermes health to **resilience gate** + sentinel probe rotation (currently absent — hermes-down is invisible to the gates that watch everything else).

## Phase 2 — Elite Hermes (the "eons ahead" layer)

Today Hermes has 3 tools (`list_tools`, `apply_task_patch`, `create_calendar_hold`) — a narrow write gateway. The elite version makes it **the single audited chokepoint for every mutation Cortex performs**:

8. **Capability registry** — tool catalog becomes declarative: each tool = JSON-schema input + policy class (mutating/read-only) + dry-run support + rate limit. Executor enforces policy **server-side** (defense in depth — never trust the caller's gate alone).
9. **Tool surface expansion** (priority order):
   - `fs_read`/`fs_write`/`fs_patch` — scoped to allowlisted roots, path-traversal safe, before/after hash journal
   - `shell_exec` — allowlisted commands only, timeout, output caps, no shell=True
   - `http_request` — egress allowlist, method restrictions
   - `git_op` — status/diff/commit scoped to repo roots
   - existing task/calendar tools stay
10. **Invoke journal** — every `/v1/invoke` persists `{run_id, tool, args-hash, result, trace, before/after}` → `GET /v1/runs/:id` + `GET /v1/runs?tool=` — full forensic replay. Enables **rollback** for fs/git mutations.
11. **Dry-run mode** — `arguments.dry_run: true` returns what *would* happen without mutating. Lets Cortex preview destructive actions before approval.
12. **Fleet wiring** — hermes agent gets real routed kinds (`executor`, `tool_invoke`); results feed fleet24h honestly; `infra` failure class on transport-down.

## Phase 3 — Verification Gates

13. `verify:hermes:edge-live` already exists → extend to assert: health connected, tools catalog non-empty, invoke dry-run round-trip, journal entry retrievable.
14. Contract tests for every new tool (schema validation, idempotency dedupe, policy deny, traversal rejection).
15. Add hermes to `cortex-full-validation` suite.

## Risks / honest caveats

- **Secrets**: `HERMES_BASE_URL` update needs `supabase secrets set` — I'll prep the command, user runs or approves.
- **VM file drift**: repo copy and `/opt/syncscript` copy will diverge unless VM pulls from repo — plan: repo becomes source of truth, VM deploys via script.
- **Scope**: Phase 2 items 8-12 is the big build. Phase 0+1 alone makes the agent *honestly up*; Phase 2 makes it *elite*.

## Open decision for user

- **Local executor**: restore `hermes-executor-server.mjs` to repo + fix LaunchAgent (local dev parity), or retire local :18880 entirely and make Edge the only path?
