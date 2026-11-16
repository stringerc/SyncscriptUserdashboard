# Cortex Agent Dossier — Elite Research Prompt

> **Independent-run protocol:** This prompt is executed blind. Do NOT read `CORTEX_AGENT_DOSSIER_SPEC.md` or any prior output before producing your report — this research is being run across multiple independent models for A/B comparison, and prior outputs would contaminate the comparison. Produce your own report from sources only, then save it as `CORTEX_AGENT_DOSSIER_SPEC.<model-name>.md`. Differences between independent reports are signal, not noise.

> **Mission:** Determine what an agent detail view ("dossier") should display when a user clicks an agent, by studying the most successful agent platforms, observability tools, and mission-control interfaces in production today — with cited, verifiable sources for every claim.
>
> **Standard:** This is .01% research. Every factual claim must trace to a primary source (official docs, product UI, engineering blog, conference talk, SEC filing, or named journalist/reviewer). No SEO listicles, no unsourced "best practices," no hallucinated features. If a claim cannot be sourced, it does not go in the report. Label every recommendation with the evidence tier that supports it.

---

## 1. Context — what we are designing for

SyncScript Cortex is a self-hosted "mission control" for a fleet of autonomous AI agents. Agents have: identity (name, role, blurb), lifecycle status (idle/working/queued/error/offline/retired), task history (completed/failed counts, per-task progress, model used, failure class), budgets (dailyBudget, concurrency), model pins, spawn specs (callSign, mission, TTL, tools), heartbeat timestamps, and tier (standard = inner moon, enterprise = outer satellite). The current dossier shows only: name, role, blurb, DONE/FAILED counts, TSR%, budget, model pin tier, class, and 5 recent tasks. We believe this is under-powered.

The dossier appears when clicking an agent vessel on the Foundry canvas or a row in the roster rail. It must work at a glance (what is this agent doing *right now*?) and on inspection (is it healthy? what has it done? what can it do? what does it cost? can I trust it?).

## 2. Research domains — cover ALL of these

### A. AI agent observability / control planes (the direct comparables)
For each: what does the per-agent or per-run detail panel show? Where are screenshots/docs?
- **LangSmith** (LangChain) — trace/agent run views
- **Langfuse** — agent observations, sessions
- **Braintrust** — evals + logs per span
- **AgentOps** — "AI agent observability" dashboard, per-session replay
- **Helicone** — request/session views
- **Arize Phoenix / AX** — agent tracing UI
- **Weights & Biases Weave / Weave Scorers** — agent telemetry
- **Galileo** — agent evaluations
- **Datadog LLM Observability / AWS Bedrock AgentCore observability** — enterprise agent monitoring
- **LangWatch, Maxim, HoneyHive, Keywords AI** — smaller but relevant players

### B. Consumer/prosumer agent products (what end users expect)
- **Devin (Cognition)** — session UI: plan, actions, shell, browser, diffs
- **Manus** — agent task detail: todo list, live actions, files
- **MultiOn, Adept (archived), Imbue** — earlier agent UX
- **ChatGPT Agent mode / Operator** — take-over UI, approval gates
- **Claude Code / Cursor agents** — run timelines, diffs, permissions
- **Lindy, Relevance AI, Gumloop, Stack AI, n8n AI Agent node, Zapier Agents, Make AI** — "AI employee" dashboards: what fields do they show per agent? (name, role, status, last run, connected tools, cost)
- **Sierra, Decagon, Intercom Fin** — enterprise agent consoles (support agents): what do supervisors see?
- **Microsoft Copilot Studio / Agent 365, Google Agentspace, Salesforce Agentforce** — enterprise agent management views

### C. Infrastructure/fleet analogues (boring but elite)
- **Kubernetes dashboard / Lens / k9s** — pod detail: status, restarts, resources, logs, events
- **Datadog/NinjaOne/Canvas RMM** — device/host detail panels
- **Stripe Dashboard / Vercel / Cloudflare** — entity detail page conventions (status pill, usage, recent events, settings)
- **Linear / GitHub Projects agent integrations** — how agent work items surface
- **NASA Mission Control / SpaceX telemetry conventions** — since our product is literally styled as mission control: what do flight director screens show per crew/vehicle? (This is aesthetic ancestry, cite NASA docs/SP-2010-3407 "Mission Operations Concept" if findable.)

### D. Design/UX research
- Nielsen Norman Group or similar on **progress visibility, trust in automation, automation transparency** (cite actual articles)
- Papers on **calibrated trust in AI agents** (e.g., work by researchers on appropriate reliance — find real papers, e.g. "calibrated trust" Lee & See 2004, or recent CHI work)
- **Approval/oversight UX** patterns for autonomous systems

## 3. Required deliverables

Produce a single report with these sections:

1. **Taxonomy of agent-detail information elements** — a table of every distinct piece of information any studied product shows in an agent/run detail view (e.g., "current action," "plan/todo progress," "token/cost usage," "tool calls," "approval state," "error/failure reason," "uptime/heartbeat," "capabilities/scopes," "audit log," "kill switch," "model used," "latency," "owner/human," "spawn lineage," "budget/quota," "recent runs"). For each element: which products show it, source URL, and one-line note on *why* they show it.

2. **Per-product teardowns** — for the top 8-12 most relevant products: a short structured teardown (what the detail view shows, screenshot/doc URL, what it does well, what it omits). Prioritize Devin, Manus, LangSmith, AgentOps, Lindy/Relevance-style "AI employee" tools, Copilot Studio, and Kubernetes dashboards.

3. **The "five questions" test** — define the questions a user must be able to answer from the dossier (we propose: What is it doing now? Is it healthy? What has it done? What is it allowed/capable of? What does it cost/trust me?). For each question, list which information elements answer it and which products demonstrate the pattern.

4. **Ranked recommendation for Cortex** — a concrete dossier layout proposal: sections, elements, priority order, mapped to OUR actual data model fields (listed below). Mark each element: MUST (table stakes across ≥3 elite products), SHOULD (shown by leaders, differentiating), COULD (nice-to-have). Explicitly call out which elements require new backend data we don't currently collect.

5. **Anti-patterns** — what successful products deliberately do NOT show, and why (e.g., raw chain-of-thought, overwhelming log streams, internal IDs).

6. **Source appendix** — every URL used, grouped by domain, with access date.

## 4. Our data model (what we CAN show today)

```
AgentClient: id, name, role, blurb, status, currentTaskId, concurrency,
             dailyBudget, lastHeartbeatAt, tasksCompleted, tasksFailed,
             spawnSpec{callSign, role, mission, ttlHours, dailyBudget, tools[]},
             spawnedAt, tier(standard|enterprise)
AgentTaskClient: id, agentId, kind, title, status, progress, model,
                 result, error, createdAt, startedAt, finishedAt
ModelClient: id, provider, tierFit[], status, latencyMsP50, lastCheckAt,
             consecutiveFailures
Snapshot extras: matrix{tier: model[]}, proposals[], runtime{startedAt, eventCount}
```

Note what we do NOT have: per-token cost, tool-call traces, plan/todo state, approval gates, capabilities beyond spawnSpec.tools, human owner, lineage beyond spawnSpec.proposedBy (proposals carry proposedBy — tasks do not carry parent agent).

## 5. Constraints

- English only. Dense, factual, no filler.
- Prefer official product docs and engineering blogs; journalism (TechCrunch, The Information) acceptable for product existence/positioning claims; peer-reviewed or arXiv for trust/calibration claims.
- Date-stamp everything; note product versions where relevant (these UIs change fast).
- Explicitly flag anything you could NOT verify — an honest gap list is worth more than a confident guess.
- Output: a markdown report, ~3000-5000 words, ready to become `CORTEX_AGENT_DOSSIER_SPEC.md`.
