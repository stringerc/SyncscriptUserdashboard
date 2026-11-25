# Hermes Contract & Architecture Documentation

## Overview
Hermes is the dedicated mutating tool execution bridge for SyncScript and Cortex — the fleet's single audited chokepoint for every mutation. All mutating write tools route exclusively through Hermes `/v1/invoke` with idempotency verification, server-side policy enforcement, and a persistent invoke journal.

## Architecture (v2)

```
caller (UI / fleet agent / worker)
  → Supabase Edge hermes-bridge  (auth: user JWT OR HERMES_SERVICE_TOKEN)
  → HERMES_BASE_URL resolution   (kv_store hermes:tunnel_url → env fallback)
  → cloudflared tunnel           (hermes-tunnel.service on Oracle VM, self-publishing)
  → hermes-executor :18880       (integrations/hermes-executor-server.mjs v2)
```

- **Executor host**: Oracle VM, `hermes-executor.service` (systemd), code at `/opt/syncscript/integrations/hermes-executor-server.mjs`. Repo copy is source of truth.
- **Transport**: `hermes-tunnel.service` runs `hermes-tunnel-supervisor.sh` — quick cloudflared tunnel to :18880 that republishes its ephemeral URL to `POST /hermes/tunnel-url` (secret: `HERMES_TUNNEL_SECRET`) on every start/restart. Self-healing: tunnel URL drift can no longer silently kill the bridge.
- **Local dev**: `com.syncscript.hermes-executor` LaunchAgent runs the same file on :18880 (fs/git roots = repo cwd).

## Authentication

| Caller | Credential | Allowed tools |
|---|---|---|
| Signed-in user | Supabase JWT (forwarded) | all |
| Fleet service | `Authorization: Bearer $HERMES_SERVICE_TOKEN` | `serviceOk: true` tools only — user-scoped tools (`apply_task_patch`, `create_calendar_hold`) refused |

Bridge forwards `X-Hermes-Caller: user|service` so the executor enforces policy server-side.

## Tool Registry (v2)

Each tool declares `cls` (read/mutate/dangerous), `serviceOk`, `needsUserJwt`, JSON schema, and supports `dry_run`.

- `list_tools` — catalog introspection (read)
- `apply_task_patch` — task field update via Edge PUT /tasks/:id (mutate, user only)
- `create_calendar_hold` — calendar hold via Edge POST /calendar/hold (mutate, user only)
- `fs_read` — rooted file read, truncates at max_bytes (read)
- `fs_write` — rooted file write, before/after sha256 journaled (mutate)
- `fs_patch` — exact-string replace, ambiguity-safe (mutate)
- `shell_exec` — allowlisted binaries only, no shell, deny-regex, rooted cwd, capped output (mutate)
- `http_request` — http(s) to HERMES_HTTP_ALLOWLIST hosts only (mutate)
- `git_op` — status/diff/log/show/branch/add/commit/push inside git roots (read/mutate/dangerous per op)

## Scoping & Safety

- **FS/GIT roots**: `HERMES_FS_ROOTS` / `HERMES_GIT_ROOTS` (default: executor cwd). Realpath-resolved; traversal rejected.
- **Secret-file deny**: `.env*`, `*.pem/key/p12/pfx`, `id_rsa/id_ed25519`, `credentials`, `*token*.json|txt` refused regardless of roots.
- **Shell**: `HERMES_SHELL_ALLOWLIST` executables, `HERMES_SHELL_DENY` regex (rm -rf, pipes-to-shell, eval, etc). Note: allowlist is a guardrail, not a sandbox — `node`/`python3` can do anything; the trust boundary is the tunnel + caller policy.
- **HTTP egress**: `HERMES_HTTP_ALLOWLIST` host suffixes (default: supabase project + localhost).
- **Rate limit**: `HERMES_RATE_PER_MIN` per caller+tool (default 60).
- **Output caps**: `HERMES_MAX_OUTPUT` (default 64KB) on exec/http/fs.

## Endpoints

- `GET /health` — status, version, roots, tool count, journal path
- `GET /v1/tools` — full registry with schemas + policy classes
- `POST /v1/invoke` — `{tool, arguments, idempotency_key, dry_run?}` → `{ok, tool, run_id, result, trace[], error?, deduped?, dry_run?}`
- `GET /v1/runs?limit&tool&caller&ok` — invoke journal query
- `GET /v1/runs/:id` — single journal entry

Bridge adds: `GET /hermes/health`, `GET /hermes/tools`, `POST /hermes/invoke`, `POST /hermes/tunnel-url`.

## Dock Event Integration
During tool invocation, `invokeHermesTool` maps `trace[]` → contract dock events for the dashboard:
- `agent.run.started`
- `agent.run.step`
- `agent.run.completed`
- `agent.run.failed`

## Journal

Every invoke appends a JSONL record to `HERMES_JOURNAL_PATH` (default `<cwd>/hermes-journal.jsonl`, rotates at `HERMES_JOURNAL_MAX_BYTES`): run_id, ts, tool, cls, caller, ok, dry_run, redacted args (token/secret/key fields stripped), error, duration_ms, trace. Query via `/v1/runs`.

## Env Reference (executor)

`SYNCSCRIPT_EDGE_BASE`, `HERMES_EXECUTOR_PORT`, `HERMES_FS_ROOTS`, `HERMES_GIT_ROOTS`, `HERMES_SHELL_ALLOWLIST`, `HERMES_SHELL_DENY`, `HERMES_HTTP_ALLOWLIST`, `HERMES_JOURNAL_PATH`, `HERMES_JOURNAL_MAX_BYTES`, `HERMES_RATE_PER_MIN`, `HERMES_MAX_OUTPUT`.

## Verification

- `HERMES_REQUIRE_CONNECTED=1 HERMES_VERIFY_INVOKE=1 HERMES_SERVICE_TOKEN=… npm run verify:hermes:edge-live`
- Resilience SLO `hermes gateway connected` (src/lib/cortex-agent/resilience.ts experiment 8)
- Fleet health: `/api/cortex/gateways/status` reports edge/local layers; standup `probeHermesDaemon` probes Edge first.
