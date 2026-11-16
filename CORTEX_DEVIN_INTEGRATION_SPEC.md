# CORTEX DEVIN INTEGRATION SPEC

> Route governed Cortex tasks to real Devin sessions via the Devin API v3,
> so the fleet can delegate deep engineering work to an actual Devin
> instance — with the same honesty, governance, and evidence rules that
> govern every other worker.

Status: SPEC — not implemented. Requires `DEVIN_API_KEY` + `DEVIN_ORG_ID`.

---

## 1. Why this exists

The Foundry's `devin` agent (added `54386ef`) is a *local* deep-tier worker
running on NIM. It embodies the operating contract but is not Devin — it
has no persistent repository context, no PR workflow, no long-horizon
autonomy. The Devin API gives Cortex a real Devin session: a cloud
agent that clones repos, writes code, runs tests, and opens PRs.

The integration must preserve Cortex's core invariant: **nothing external
executes without evidence and governance.** A Devin session can push code
and open PRs — that is tier-2 blast radius. It is never a silent lane.

## 2. Verified API surface (docs.devin.ai, v3)

Base: `https://api.devin.ai` — auth: `Authorization: Bearer <service-user key>`
(org-scoped, RBAC). Org id prefix `org-`, session id prefix `devin-`.

| Endpoint | Purpose |
|---|---|
| `POST /v3/organizations/{org_id}/sessions` | Create session. Body supports `prompt`, `devin_mode` (enum incl. `swe-2-medium`, `fusion`), `bypass_approval` (must stay `false`), tags. |
| `POST /v3/organizations/{org_id}/sessions/{devin_id}/messages` | Send message to active session; auto-resumes suspended sessions. |
| `GET /v3/organizations/{org_id}/sessions/{devin_id}` | Session detail: status, `status_detail` (enum incl. limit/contract/error states), `pull_requests`, usage. |
| `GET /v3/organizations/{org_id}/sessions` | List sessions (filter by tags/status) — for reconciliation after restarts. |
| `GET /v3/organizations/{org_id}/sessions/{devin_id}/insights` | Session insights incl. PR list — for outcome evidence. |
| `GET/POST /v3/organizations/{org_id}/sessions/{devin_id}/tags` | Session tags — use `cortex:<taskId>` for ledger correlation. |

Notes:
- Sessions are long-running (minutes). Cortex tasks are request/response.
  The bridge is **asynchronous by design** (see §4).
- `bypass_approval: true` exists in the schema — Cortex must NEVER set it.
  Devin's own approval gates stay intact as a second governance layer.
- No webhooks confirmed in the searched docs — poll `GET session` on a
  cadence; treat `status_detail` values as the state machine.

## 3. Credentials & config

Env (never committed, `.env.cortex` pattern already in repo):

```
DEVIN_API_KEY=...        # service-user key, org-scoped
DEVIN_ORG_ID=org-...     # organization id
CORTEX_DEVIN_MAX_SESSIONS_PER_DAY=4   # hard cap — ACU spend control
CORTEX_DEVIN_POLL_MS=60000            # session status poll cadence
```

Missing creds → bridge reports `unconfigured` honestly; the `devin`
local worker is unaffected (it never routes through the API).

## 4. Architecture

```
submitTask('devin', 'devin_task', ...)
        │
        ▼
devinBridgeWorker (thin — does NOT wait for Devin)
        │  1. governance check: blastLane('devin_session') = HARD
        │     → if not pre-approved, return proposal payload, stop
        │  2. POST /sessions {prompt, tags:[cortex:<taskId>],
        │     devin_mode, bypass_approval:false}
        │  3. record {taskId → devin_id, createdAt} in
        │     .cortex-runtime/devin-sessions.json (durable)
        │  4. task completes: {sessionId, status:'launched',
        │     pollAfter: now+60s} — honest: launched ≠ finished
        ▼
devinSessionPoller (setInterval, 60s, in vite.config.ts runtime hooks)
        │  for each open session record:
        │    GET /sessions/{devin_id}
        │    ├─ working/blocked → heartbeat event, keep polling
        │    ├─ finished → GET insights → PR urls, summary
        │    │            → archive result, emit task.completed
        │    │            → resolveIncidentsOnSuccess if signature match
        │    ├─ expired/error/limit → recordIncidentFailure(provider)
        │    └─ stale > CORTEX_DEVIN_SESSION_TTL (default 4h) → incident
        ▼
Inbox / Foundry / archive — same surfaces as every other agent
```

Key files:
- `src/lib/cortex-agents/devin-bridge.ts` — API client + session ledger
  (read/write `.cortex-runtime/devin-sessions.json`, atomic rename).
- `src/lib/cortex-agents/workers.ts` — `devinBridgeWorker` +
  `registerDevinPoller(runtime)` export.
- `vite.config.ts` — start poller alongside WARDEN sweeper; route
  `kind: 'devin_task'` submissions through the same `/agents/task` API.

## 5. Governance mapping

| Cortex concept | Devin bridge behavior |
|---|---|
| Blast lanes | `devin_session` is **hard** — creating a session that can push code is external mutation. Requires approved proposal OR explicit `input.approvedProposalId`. Read-only kinds (`devin_ask`, prompt→answer, `bypass_approval:false`, no repo write intent) may be `reversible`. |
| Daily budget | `CORTEX_DEVIN_MAX_SESSIONS_PER_DAY` counter in the session ledger — separate from token budgets; sessions cost ACUs. Exhaustion → one deduped proposal per day (reuse `fileBudgetProposal` pattern). |
| Incidents | API 401/403 → `config` incident (bad key/RBAC — human fix). 429 → `provider` + cooldown. Session `status_detail: error/contract_expired` → `provider`. Poll timeout → `timeout`. |
| Evidence | Every transition archived: session id, status_detail history, PR urls, message count. "Launched" and "finished" are distinct recorded states — never conflated. |
| Proposals | Task result includes `deepLink` to the Devin session UI so the operator can watch live. |

## 6. Task contract

`input` for `kind: 'devin_task'`:

```json
{
  "instruction": "Fix the flaky reddit-post selector on modern Reddit",
  "repo": "syncscript",                // optional — Devin's own repo config
  "mode": "swe-2-medium",              // optional devin_mode override
  "context": "...",                    // distilled rules / incident refs
  "approvedProposalId": "prop-..."     // required for hard-lane tasks
}
```

Result (phase 1, launch):
```json
{ "sessionId": "devin-...", "status": "launched",
  "deepLink": "https://app.devin.ai/sessions/devin-...",
  "note": "Session running — result arrives via poller, not this response." }
```

Result (phase 2, via archive/poller completion event):
```json
{ "sessionId": "...", "status": "finished",
  "pullRequests": ["https://github.com/.../pull/123"],
  "summary": "...", "verified": "pr-opened" }
```

## 7. Phased rollout

- **P0 — plumbing:** creds in env, `devin-bridge.ts` client, session
  ledger, launch-only path (`devin_ask` read-only kind first —
  prompt in, session created, answer polled back). No repo mutation.
- **P1 — governed writes:** `devin_task` hard-lane → proposal → approved
  session with `bypass_approval:false`. Poller writes PR evidence to
  archive + incidents.
- **P2 — loop closure:** message channel (`POST .../messages`) so Cortex
  can answer Devin's questions mid-session; STRATEGIST consumes Devin
  outcomes into rules; WARDEN patrol checks session-ledger drift
  (sessions open > TTL, finished-but-unarchived).
- **P3 — bidirectional:** Devin session completions emit
  `task.transition` events → Foundry visuals + optional voice notice
  (closes the FAIL-04 voice black-hole for cloud work too).

## 8. Honest limitations

- Devin API sessions cost ACUs — real money. The daily cap is not
  optional; start at 4/day.
- Session latency is minutes, not seconds. Anything needing instant
  answers stays on local `devin` worker / NIM lanes.
- `status_detail` semantics must be validated against live responses
  during P0 — do not assume enum completeness from docs alone.
- Devin's repo access is configured in Devin's own settings, not here.
  Cortex governs *whether* a session launches, not *what Devin can see*.
- This spec covers v3 org-scoped API. If the account is on v1 personal
  endpoints (`/v1/sessions`), the paths differ — confirm org type first.

## 9. Open questions for operator

1. `DEVIN_ORG_ID` + service-user API key — do you have org access, or a
   personal-account key (v1 API)?
2. Which repos should Devin sessions be allowed to touch?
3. ACU budget ceiling per day?
4. Should `devin_task` require Inbox approval every time (recommended
   until trust is earned), or auto-approve for read-only kinds?
