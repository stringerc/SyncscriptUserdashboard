# CORTEX_DISCORD_SPEC

> Chat surface for Cortex. Research basis: `CORTEX_DISCORD_RESEARCH.md`.
> Status: **v1 implemented locally** — live Discord delivery UNVERIFIED until
> `DISCORD_BOT_TOKEN` / `DISCORD_PUBLIC_KEY` are set and a private guild exists.

---

## 1. Architecture decision

**Discord is a surface, not a brain.** All agent logic stays in the existing
Node-side Cortex runtime (`src/lib/cortex-agents`). Discord is a thin
transport: interactions in → runtime calls → messages out.

Two Discord integration paths exist in-repo; this spec uses neither directly:

- `supabase/functions/make-server-57781ad9/discord-routes.tsx` — community
  feedback bot (Nexus agents, public guild, OAuth provisioning). Different
  product surface; left untouched.
- `api/phone/_route-discord.ts` — Vercel proxy to Edge interactions. Production
  path for the *public* bot. Cortex Discord runs **local-first in the Vite dev
  server** (`/api/cortex/discord/*` middleware), same pattern as every other
  `/api/cortex/*` endpoint. If Cortex Discord needs production reach later, the
  same handler mounts behind a serverless route — the module is transport-agnostic.

## 2. Connection model

Discord interactions are HTTP webhooks — **no gateway/websocket, no discord.js
dependency**. The Vite middleware verifies the Ed25519 signature
(`DISCORD_PUBLIC_KEY`) and responds within Discord's 3-second window.

Outbound posts use the bot-token REST API (`DISCORD_BOT_TOKEN`) via plain
`fetch` — no SDK.

### Env vars (never committed)

| Var | Purpose |
|---|---|
| `DISCORD_BOT_TOKEN` | Bot REST auth (post/edit messages, register commands) |
| `DISCORD_PUBLIC_KEY` | Ed25519 verification of inbound interactions |
| `DISCORD_OWNER_ID` | Allowlist — only this user may run commands/approve |
| `DISCORD_CHANNEL_ID` | Default channel for proactive posts + digest |
| `DISCORD_DIGEST_HOUR` | Local hour for morning digest (default 7) |

## 3. Channel topology (private guild)

| Channel | Contents |
|---|---|
| `#cortex` | Command surface — slash commands, `ask` threads |
| `#inbox` | Initiative proposal cards with Approve/Dismiss buttons |
| `#alerts` | FORECASTER tier-2 pushes (severe weather, failures) |
| `#briefs` | Morning digest + PREP brief notifications |

`DISCORD_CHANNEL_ID` is the default; per-channel IDs can be added later via
`DISCORD_CHANNEL_INBOX` / `DISCORD_CHANNEL_ALERTS` / `DISCORD_CHANNEL_BRIEFS`.

## 4. Commands (P0–P2)

All guild-scoped, registered via `POST /api/cortex/discord/sync-commands`.

| Command | Behavior | Backend |
|---|---|---|
| `/cortex status` | Fleet snapshot: agents online, tasks today, failures | `agentRuntime.snapshot()` |
| `/cortex digest` | One-screen brief: Today / Needs you / FYI / handled counts | calendar-upcoming + proposals + forecast ledger + runtime |
| `/cortex forecast` | Last 5 evidence-backed forecasts w/ domain+confidence | `.cortex-runtime/forecasts.jsonl` tail |
| `/cortex proposals` | Pending initiative proposals (id, title, urgency) | `getCortexProactiveInitiative().getPendingProposals()` |
| `/cortex ask <text>` | Free-text → agent routing → `submitTask` | runtime + keyword router (research→scout, build→builder, forecast→forecaster, prep→prep, else→runner) |
| `/cortex outputmode <low\|medium\|high>` | Detail level for ask replies (stored per-user) | discord-push state |

Non-owner users get an ephemeral "not authorized" — allowlist enforced on
every interaction, same rule as inbound messages (Conch/discord-threads pattern).

## 5. Approvals (P3)

Pending `requiresApproval` proposals are pushed to `#inbox` as embed cards:

- Title, summary (evidence lines), confidence, domain
- Buttons: `Approve` (success style) / `Dismiss` (danger), `custom_id`
  `cxok:<proposalId>` / `cxdsm:<proposalId>`
- Click verified against `DISCORD_OWNER_ID`; `acceptProposal()` /
  `dismissProposal()` on the **server-side** initiative engine (the same
  singleton FORECASTER submits to — closes the gap where server-side proposals
  were invisible to the browser UI)
- Original message edited in place to show the decision + decider (Conch pattern)
- Fallback: `/cortex approve <id>` / `/cortex dismiss <id>`

**Honest limitation:** `acceptProposal` marks status `accepted` server-side;
execution of `suggestedTool` currently lives in the browser event path
(`cortex-initiative-accept`). Discord approval = recorded decision; tool
execution wiring is a documented follow-up, not faked.

## 6. Proactive push (P4) — budgeted

Poller inside the Vite server (`configureServer`, 5-min cadence):

- **Proposal cards**: new pending proposals → `#inbox` (not budgeted — they ARE
  the approval queue)
- **Forecast pushes**: tier≥2 forecast ledger entries → `#alerts`
- **Digest**: once daily at `DISCORD_DIGEST_HOUR` → `#briefs`
- **Budget**: `.cortex-runtime/discord-push.json` caps proactive posts at
  **5/day** shared across alerts+digest (research: 3–5/day ceiling). Command
  replies don't count. State survives restarts; quiet hours = no digest before
  hour, missed digest doesn't backlog.

## 7. Jist layer (P5) — digest format

One screen, three blocks (TLDL/Eucalipse pattern):

```
Morning — Cortex
Today:    <up to 3 calendar events, time-bounded>
Needs you: <pending proposals count + top forecast needing action>
FYI:      <one watch item — worst forecast or fleet anomaly>
Handled:  <counts — tasks completed today, probes silent, proposals dismissed>
```

Scoring is code (runtime snapshot + ledger + calendar file); prose is minimal
templating — no LLM in the digest path, matching "scoring is code, prose is LLM".

## 8. Honesty contract

- Every message traces to a real object: snapshot, ledger line, proposal, or
  task result. No "all good" without a check behind it.
- Failed Discord posts are logged server-side (`[cortex-discord]`), never
  silently swallowed; command handlers return Discord error responses on
  internal failure.
- If `DISCORD_*` env is absent: interactions endpoint returns 503 with a clear
  message; poller no-ops. Feature degrades honestly, not noisily.

## 9. Files

| File | Role |
|---|---|
| `src/lib/cortex-discord.ts` | Pure module: signature verify, REST client, command specs, message builders, interaction router, push-budget state |
| `vite.config.ts` | Middleware: `/api/cortex/discord/interactions`, `/sync-commands`, `/state`; 5-min poller in `configureServer` |
| `tests/cortex-discord.test.ts` | Unit tests: signature verify (fixture), command routing, budget cap, message formatting, allowlist |
| `.env.example` | Document the five env vars (no values) |

## 10. Build order → status

| Phase | Scope | Status |
|---|---|---|
| P0 | Signature verify, `/cortex status`, command registration | Implemented |
| P1 | digest / forecast / proposals read commands | Implemented |
| P2 | `/cortex ask` intent→submitTask, outputmode | Implemented |
| P3 | Proposal cards + Approve/Dismiss buttons | Implemented |
| P4 | Poller: proposal push, forecast push, 5/day budget | Implemented |
| P5 | Morning digest format | Implemented |
| P6 | Thread-per-ask: `/cortex ask` spawns a thread on a bot message; 45s REST poller posts task results into it and routes new thread replies to follow-up tasks (auto-archive 24h, no gateway needed) | Implemented |

## 11. Known gaps (honest list)

- Live Discord delivery unverified — needs token + guild + channel IDs
- Slash-command registration is manual (`sync-commands` endpoint) — not auto on boot
- Discord approvals record the decision; suggestedTool execution still needs the
  Cortex UI event path (or a follow-up executor)
- ~~No thread-per-ask-session yet~~ — implemented (P6). Remaining nuance:
  thread replies route through the keyword agent-router, not full conversational
  context; deep multi-turn sessions would need the gateway or richer context passing
- Production deployment path undefined (local Vite only for now)
