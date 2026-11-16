# CORTEX_DISCORD_RESEARCH

> Research output for `CORTEX_DISCORD_RESEARCH_PROMPT.md`. Sources cited inline.
> Date: 2026-07 — all claims verified against primary docs or cited articles.

---

## 1. Landscape scan

### 1.1 Personal AI assistants with chat surfaces

| Product/category | Channel | Interaction model | What they do well | What they fake/weak on |
|---|---|---|---|---|
| Lindy / Fyxer / Motion class | Email + web dashboard, some Slack | Async task delegation, approval emails | Structured task cards, clear "needs you" queue | Proactive digests are thin; mostly pull-based |
| Agent orchestrators (LangGraph, CrewAI, n8n, Dify) | Web chat embed / Slack | Thread-per-run, tool-call traces | Streaming output, interrupt/resume | No proactive push; chat is a debug console, not an assistant |
| SRE/ops bots (Discord incident channels) | Discord/Slack | Channel-per-incident, slash commands | Thread-per-incident isolation, role-gated commands | Reactive only — nobody gets "the jist" unprompted |
| Inbox "reply to everything" agents (Fyxer, Serif, Lorca) | Email draft + web review | Draft-and-approve queue | High-trust drafting, batch review UX | Confined to email; no cross-domain surface |
| Personal-agent bridges (OpenClaw, Conch, agent-tether, discord-threads, llmcord) | Discord + Telegram + Slack | Thread-per-session, button approvals | This is the closest prior art — see §1.4 | Fragmented; each bridge reinvents routing |

**Convergent primitives (table stakes):**
- Slash commands for explicit intents (`/status`, `/digest`)
- Thread-per-task/session isolation — *every* surveyed Claude-Code-in-Discord bridge uses it (buildnwrite.io survey)
- Button-based approvals with allowlisted clickers only (discord-threads, Conch ADR-0018)
- Structured output detail levels (`/outputmode low|medium|high` — OpenACP)

**Differentiators:**
- Auto-naming threads from first prompt (OpenACP)
- Tool-activity embed cards with colored status sidebar (OpenACP)
- Streaming message edits to minimize API calls (OpenACP)

### 1.2 Open-source bridges — the real prior art

Four production-grade personal-agent Discord bridges exist; Cortex should steal their proven shapes:

- **Conch (conchagent.com/decisions/0018)**: channels as connectors, not brains — same architecture Cortex needs. Approvals as inline-keyboard-style buttons; button data is a random key resolving to the pending question; a press only counts from an allowlisted user **in the chat where the question was asked**; when answered anywhere the message updates to show the decision. Telegram HTML/plain fallback, Discord Markdown, Slack mrkdwn. Batches messages within 700ms (photo albums). `/new`, `/stop`, `/help` conventions.
- **agent-tether (github.com/larsderidder/agent-tether)**: approval parsing (`allow`, `deny: reason`, `allow all`, `allow Bash`), auto-approve timers per session/tool/directory, pairing/authorization system for Discord.
- **discord-threads (folio.kz3.dev)**: permission prompts as Allow/Deny/Always-allow buttons; three safety rules — never fail silently (every path returns explicit allow/deny), redelivery idempotent (memoize per request id), buttons carry authority (click checked against same allowlist as inbound messages).
- **eve.dev Discord channel**: slash commands answered as the requester; DMs/mentions/replies answered as bot-behavior; mention in text channel starts a public thread = one session; requester-only approvals; ephemeral sign-in links.

### 1.3 Failure modes — what everyone gets wrong

- **Notification fatigue is measured, not vibes**: briefing systems cap at **3–5 proactive messages/user/day** as an architectural constraint (claudedrive.ai). LIA-Assistant defaults min 1 / max 3 proactive/day with a 2h global cooldown, 15-min post-chat cooldown, and anti-redundancy via recent-notification context (github.com/jgouviergmail/LIA-Assistant). Matches Cortex's existing 3/day spoken budget — Discord needs its own cap.
- **Approval UX**: buttons beat free-text for high-risk actions — "accept only structured replies like `APPROVE draft_123` or button payloads; ignore free-text 'looks good'" (aiagents.codeguides.io). Buttons also need: 3-second ack window (defer first for slow work), ephemeral responses for errors, `update()` to retire the buttons after decision.
- **Thread-per-task scales**: one thread per message is enforced by Discord's API (thread ID = message ID). Auto-archive (60min default) keeps channels clean. Concern about "dozens of daily tasks" is handled by archiving + digests, not by avoiding threads.
- **Bot honesty**: bridges that pretend to be human erode trust; honest "agent" identity + visible tool-activity cards builds it. Cortex's evidence-or-silence contract is stricter than anything surveyed — keep it.
- **Discord constraints** (betterclaw.io 2026 comparison): 2,000-char messages (4,000 Nitro), 5 msgs/5s per channel, 50 req/s global, components+embeds+markdown, native threads, no E2E (bot transcripts readable by Discord). Telegram: 4,096 chars, ~1 msg/s/chat, inline keyboards, better mobile UX, topics-as-threads.
- **Deliverability gotcha**: a Discord bot can only DM users who share a server (error 50278) — private guild required.

### 1.4 The "jist" problem — summarization surfaces

Best briefing formats converge on **one screen, three blocks**:

- **TLDL template**: `Today` (calendar, time-bounded) / `Needs you` (smallest set of unblocking actions) / `FYI` (one watch item max). Explicitly NO news section by default. "A briefing is 5 items that matter and a one-line confirmation that nothing else does" — not a digest of 40 emails (eucalipse.com).
- **Eucalipse production build**: `Needs a decision today` (2–5 items w/ proposed next step) / `Today's meetings` (1-para prep each) / `Waiting on others` / `Anomalies` / **`Everything else: handled`** — counts only ("31 emails triaged, 4 tasks auto-filed"). The "handled" line builds trust disproportionately.
- **Key architectural rule** (Eucalipse): **scoring is code, prose is LLM**. Deterministic scoring selects items; the LLM only writes. Cortex already does this — FORECASTER probes score, router ranks, LLM narrates only Tier-3.
- **Delivery timing**: score ~6am, compose ~6:30am, deliver 7:30am. Quiet hours enforced; missed briefing generates no backlog.
- **ClaudeDrive**: 3–5 items per delivery matching executive attention window; every claim links to source; parallel-run new format alongside old for 2–4 weeks before trusting it.

---

## 2. Kill / win / steal table

| Pattern | Verdict for Cortex | Why |
|---|---|---|
| Thread-per-task | **STEAL** | Universal consensus; Discord enforces one-thread-per-message; auto-archive handles scale |
| Button approvals w/ allowlist | **STEAL** | Proven in 3 independent bridges; matches Cortex `requiresApproval` gate |
| Slash commands for intents | **STEAL** | Zero parsing ambiguity; guild-scoped registration is instant |
| 3–5 proactive msgs/day cap | **STEAL** | Independently confirmed by LIA (1–3/day) and ClaudeDrive (3–5/day); aligns with voice budget |
| "Everything else: handled" counts line | **STEAL** | Cheapest trust-builder in briefing design; Cortex has the data (task counts, probe silence) |
| Streaming message edits | **STEAL later (P5)** | OpenACP pattern; defer until message volume justifies it |
| Auto-approve timers | **SKIP for now** | agent-tether feature; Cortex approvals should stay explicit — timers create un-audited actions |
| `/outputmode` detail levels | **STEAL (cheap)** | One slash command, big UX win for dense agent output |
| Pairing/authorization handshake | **STEAL (simplified)** | Single-user: allowlist = owner's Discord user ID; no pairing flow needed |
| Telegram instead of Discord | **DISAGREE — keep Discord** | Telegram wins mobile UX and simplicity, but: (a) user already has Discord bot infra in-repo (SyncScript Feedback Bot, app ID 1468755723587420300, prior `discord-vercel-proxy` work), (b) channels/threads/roles fit multi-agent visibility better, (c) switching costs > marginal UX gain. Revisit if mobile approvals become friction. |
| Self-bot / user-account automation | **KILL** | ToS violation, ban risk; dedicated bot only |

---

## 3. Answers to the prompt's required questions

1. **Discord vs alternatives**: Discord confirmed — existing bot app + repo infrastructure, channel topology fits agent fleet visibility, threads are first-class. Telegram remains the fallback if mobile approval friction emerges.
2. **Push vs pull**: **Both, asymmetric.** Pull = slash commands + thread replies (user-initiated, unlimited feel). Push = proposals, forecast tier-2, task completions, morning digest — hard-capped at ~5/day to respect attention budget. Never push ambient-tier noise.
3. **Structured output in Discord**: embeds for status cards (colored sidebar = urgency), code blocks for evidence lists, links to local artifact paths for full briefs. 2,000-char limit → split on paragraph boundaries; long briefs → file attachment or link, not wall-of-text.
4. **Approval flow**: **Buttons** (Approve/Dismiss) on a proposal card, custom_id encoding proposal ID, clicker verified against owner allowlist, `update()` retires buttons after decision, decision result edited into the same message (Conch pattern). Free-text `approve <id>` as fallback.
5. **Thread-per-task scalability**: yes — auto-archive (60min) + one thread per *conversation*, not per agent task. Agent task results post to the relevant channel or a per-domain thread; only interactive sessions get threads.
6. **Proactive without noise**: cap 5/day total across ALL push types (proposals + forecasts + digest share one budget); quiet hours; "handled" counts line carries ambient awareness without messages.

---

## 4. Existing Cortex assets this plugs into

- `/api/cortex/agents/state` — fleet snapshot (powers `/cortex status`, digest)
- `/api/cortex/initiative/*` — proposals with `requiresApproval` (powers approval cards)
- `/api/cortex/agents/llm` — fast-tier intent classification
- `submitTask` runtime — command surface dispatch
- `.cache/cortex-ambient.jsonl` — ambient notice pattern to mirror for Discord push budget
- `src/supabase/functions/server/openclaw-bridge.tsx` + `tests/discord-vercel-proxy-contract.test.mjs` — prior Discord HTTP-interactions work to reconcile with
- `YOUR_DISCORD_CREDENTIALS.md` (untracked) — existing bot token; spec uses env var only
