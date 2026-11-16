# CORTEX_DISCORD_RESEARCH_PROMPT

> **Purpose:** Research how the best personal-AI-assistant and agent-orchestration products handle chat surfaces (Discord, Telegram, Slack, iMessage, custom web), extract what works and what everyone copies badly, then spec a Cortex Discord integration that beats the pattern — not copies it.
>
> **Deliverable:** `CORTEX_DISCORD_RESEARCH.md` + updated `CORTEX_DISCORD_SPEC.md` (create it; does not exist yet).

---

## Context (read first)

- Product root: `/Users/Apple/syncscript`
- Master map: `CORTEX.md` — read this first for architecture, agent roster, and endpoint index
- Prior art in-repo: `src/DISCORD_*.md` docs, `src/supabase/functions/server/openclaw-bridge.tsx` (untracked), `YOUR_DISCORD_CREDENTIALS.md` (untracked, contains real credentials — do NOT copy values anywhere)
- Agent runtime: `src/lib/cortex-agents/runtime.ts` — `submitTask`, budgets, dedupe, spawn governance
- Voice/ambient: `src/lib/cortex-proactive-voice.ts`, `.cache/cortex-ambient.jsonl`
- Initiative approvals: `/api/cortex/initiative/*` — proposals require human approval
- Design constraint from user: assistant should "reply to everything including social media and give the jist" — Discord is the **surface**, Cortex is the brain. Every claim/action must be evidence-backed; no fabricated status.

---

## Phase 1 — Research (`CORTEX_DISCORD_RESEARCH.md`)

### 1.1 Landscape scan — who does chat-surface agents well

Research how these categories handle messaging surfaces, and for each answer: **what channel(s), what the interaction model is, what they do better than expected, what they fake:**

- **Personal AI assistants with chat UIs**: Lindy, Fyxer, Motion, Reclaim, Serif, Martin, Ohai
- **Agent orchestrators with chat frontends**: LangChain/LangGraph agent inboxes, CrewAI control surfaces, AutoGPT platforms, n8n chat triggers, Dify/Flowise chat embeds
- **Community/ops bots done right**: Discord bots for SRE (incident channels), GitHub→Discord bridges, Linear/Slack bots, status-page bots
- **"Reply to everything" assistants**: Superhuman AI, Fyxer email triage, Lorca/serif-style inbox agents — how do they handle approval vs. auto-send?
- **Open-source references**: discord.py/discord.js bot patterns, Matrix/Element bridges, Mattermost bots, Signal/Telegram bot frameworks

For each: capture the **interaction primitives** they converged on (slash commands, threads-per-task, reaction approvals, digest messages, typing indicators, rich embeds/cards) and which primitives are table stakes vs. differentiators.

### 1.2 Failure modes — what everyone gets wrong

- Alert/notification fatigue in chat surfaces (research the numbers — how many proactive messages/day before mute)
- Approval UX: reaction-emoji approvals vs. button approvals vs. reply-to-approve — which have highest completion rates?
- Thread-per-task vs. single-channel-scroll — evidence on which keeps context usable
- Bots that pretend to be human vs. bots that are honest about being agents — user trust research
- Rate limits and deliverability: Discord vs. Telegram vs. Slack bot API constraints, message length limits, embed vs. markdown rendering of structured data (tables, evidence lists)
- Mobile experience: which surfaces work well on phone for quick approve/dismiss

### 1.3 The "jist" problem — summarization surfaces

The user wants "the jist of everything" — research:
- How do the best digest/morning-briefing products format summaries (length, structure, drill-down links)?
- Morning briefing bots (e.g., briefing-style Discord/Telegram bots, Dayflow, Reclaim morning plans)
- How do agent systems expose "why" — evidence trails in chat vs. links to dashboards

### 1.4 Gap analysis — kill / win / steal table

Map findings against Cortex's unique assets:
- Live agent fleet with budgets, dedupe, audit ledgers, SSE telemetry
- Initiative engine with `requiresApproval` proposals
- Ambient voice path (`.cache/cortex-ambient.jsonl` → `announce()` with policy)
- Globe/visualizer for spatial events
- Gmail/calendar/distribution data pipes
- FORECASTER (tiered routing), PREP (cited briefs), SCOUT (research)

Questions the research MUST answer:
1. Discord vs. Telegram vs. Slack vs. custom web — which surface best fits "command + approve + get the jist" for a single-user personal assistant? (Discord chosen provisionally — verify or challenge)
2. Should agent output be pushed (bot posts) or pulled (slash commands query state)? Both?
3. How to render structured agent output (forecasts, briefs, proposals) in Discord's limited markdown — embeds? files? links to local artifacts?
4. Approval flow: buttons vs. reactions vs. reply commands — pick one, cite evidence
5. Thread-per-task model: does it scale to dozens of daily agent tasks?
6. What do the best bots do for **proactive** messaging without becoming noise?

---

## Phase 2 — Spec (`CORTEX_DISCORD_SPEC.md`)

Write the spec incorporating research findings. Must cover:

- **Bot architecture**: discord.js vs. discord.py vs. raw gateway — pick one, justify; where it runs (vite dev server middleware? separate node process? Supabase Edge?)
- **Channel topology**: recommended private-server layout (`#cortex`, `#agents`, `#inbox`, `#alerts`, `#briefs`) — or challenge it with research
- **Intent routing**: how a Discord message becomes a Cortex task — reuse `/api/cortex/agents/*` endpoints, `submitTask`, LLM intent classification (`ctx.llm` fast tier)
- **Approval flow**: initiative proposals → Discord card → approve/dismiss → `/api/cortex/initiative/*` resolution
- **Digest/"jist" surface**: daily briefing message format, per-agent digest commands, forecast rollup
- **Outbound pipeline**: which Cortex events push to Discord (task completions, proposals, forecast tier-2+, ambient notices) vs. which stay ambient-only — respect the interruption budget (3 spoken/day; Discord should have its own budget)
- **Identity & permissions**: dedicated bot account, private guild, role-gating, no self-bot
- **Credential handling**: bot token in `.env` only — reference `YOUR_DISCORD_CREDENTIALS.md` exists but spec must not embed secrets
- **Honesty contract**: every message the bot sends must trace to a real result object — no fabricated "done" messages; failures post as failures
- **Phased build order**: v1 read-only digest + slash commands → v2 intent→task → v3 approvals → v4 proactive push

---

## Phase 3 — Implementation order (in spec)

Sequence the build so each phase is shippable:

1. **P0 — Bot skeleton**: private guild, bot posts a heartbeat/status command response, slash command `/cortex status` returning agent fleet state
2. **P1 — Read surface**: `/cortex digest` (fleet + forecasts + pending proposals), `/cortex forecast`, `/cortex prep <meeting>`
3. **P2 — Command surface**: free-text intent → fast-tier LLM classification → `submitTask` → result posted in-thread
4. **P3 — Approvals**: initiative proposals post as cards with approve/dismiss buttons wired to existing endpoints
5. **P4 — Proactive push**: FORECASTER tier-2 + task completions → Discord, with daily message budget
6. **P5 — Jist layer**: morning briefing digest, per-domain summaries, drill-down links to artifacts

Each phase: files touched, endpoints used, tests, honest gaps.

---

## Rules

- **No mock data.** If a Discord capability can't be verified locally (no bot token in dev), mark it `UNVERIFIED` and say what's needed.
- **Evidence-or-silence** applies to bot messages too — no "all good!" messages without a real check behind them.
- Keep the research doc under ~400 lines; the spec under ~300. Tables over prose.
- Cite sources (URLs) for every claim about other products' behavior.
- Do NOT paste or commit any credentials found in `YOUR_DISCORD_CREDENTIALS.md` or `.env` files.
- English only.
