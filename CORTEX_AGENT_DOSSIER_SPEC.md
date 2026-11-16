# Cortex Agent Dossier — Research Report & Specification

> Produced from `CORTEX_AGENT_DOSSIER_RESEARCH_PROMPT.md`. Every claim traces to a cited source; unverifiable items are flagged in §7. Date of research: session date. Product UIs change fast — re-verify before implementation details harden.

---

## 1. Taxonomy of agent-detail information elements

Every distinct element observed across studied products, with who shows it and why.

| # | Element | Products showing it | Why they show it | Source |
|---|---------|--------------------|------------------|--------|
| 1 | **Current action / live step** | Devin (Progress tab steps), Manus (running timer + file being edited + thinking status), ChatGPT agent (live sandbox window), Copilot Studio (session view), LangSmith (Trajectory view), AgentOps (session waterfall) | The #1 question is "what is it doing *right now*" — every leader surfaces the present-tense action, not just status | [Devin docs](https://docs.devin.ai/work-with-devin/devin-session-tools), [SaaSUI Manus teardown](https://www.saasui.design/application/manus), [OpenAI](https://openai.com/index/introducing-chatgpt-agent/) |
| 2 | **Plan / todo progress** | Manus (`todo.md` checklist, [x]/[ ] live), Devin (plan steps), Claude Code todos | Converts opaque autonomy into countable progress; user can see remaining work | [Manus teardown](https://www.kdjingpai.com/en/manus-pingshenmezhongban/) |
| 3 | **Activity timeline / event feed** | Vercel (deployment feed), AgentOps (session waterfall: LLM calls, tools, errors on a time axis), Langfuse (timeline view for latency), k8s dashboards (Events tab), Lindy (Tasks run history) | Answers "what has it done" and localizes failures | [AgentOps docs](https://docs.agentops.ai/v2/usage/dashboard-info), [Langfuse](https://langfuse.com/docs/observability/features/sessions), [Kubius](https://kubius.io/docs/pods) |
| 4 | **Health / reliability metrics** | Copilot Studio (success rate, fail rate, avg duration, tool success %), k8s (restart counts, conditions), Relevance AI (tasks-done sorting, productivity metrics), Braintrust (errors view, non-errors view) | Trust requires evidence of reliability over time, not a single status | [Copilot Studio Monitor](https://learn.microsoft.com/en-us/microsoft-copilot-studio/analytics-overview), [Relevance agents list](https://relevanceai.com/posts/2024-11-03-introducing-agents-list-view) |
| 5 | **Error detail with reason** | AgentOps (errors in waterfall), k8s (CrashLoopBackOff reason under name), Braintrust (error spans), our `task.telemetry.failureClass` | A failure without a reason is unactionable; leaders always pair status with cause | [Kubeglass](https://kubeglass.com/docs/guides/dashboard/), [Braintrust](https://docs.braintrust.dev/observe/view-logs) |
| 6 | **Cost / usage / quota** | AgentOps (token counts + cost tracking, "manage and visualize agent spend"), Copilot Studio ("Total estimated credits used"), Relevance AI (per-user credit bars, per-agent usage), Lindy (credit balance in sidebar) | Autonomous agents spend money; spend visibility is table stakes for anyone footing the bill | [AgentOps](https://www.agentops.ai/), [Copilot Studio agents analytics](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/analytics-overview), [Relevance per-user analytics](https://relevanceai.com/posts/2026-03-03-track-individual-team-member-ai-usage-with-detailed-per-user-analytics) |
| 7 | **Capabilities / tools / permissions** | Relevance AI (expand agent → connected tools/integrations), Lindy (integrations per agent), ChatGPT agent (connectors/apps enabled), Decagon (100% of logic on inspectable AOPs), Sierra (tools in journeys) | "What is it allowed to do" is a trust and safety question | [Relevance list view](https://relevanceai.com/posts/2024-11-03-introducing-agents-list-view), [Decagon vs Sierra](https://decagon.ai/vs/sierra) |
| 8 | **Model / provider used** | LangSmith (run metadata, model per run), Braintrust (model + tokens + cost per LLM span), Langfuse (generation metadata), our `task.model` | Debugging and cost attribution both need model identity | [Langfuse data model](https://langfuse.com/docs/observability/data-model), [Braintrust traces](https://www.braintrust.dev/product/observe) |
| 9 | **Human-in-the-loop state** | ChatGPT agent (confirmations before high-impact actions, Take Over browser, Watch Mode), Relevance AI Workforce (approval management: approve/reject/modify), Sierra (supervisors escalate to human) | Autonomy without visible oversight gates erodes trust; approvals must be a first-class state | [OpenAI help](https://help.openai.com/en/articles/11752874-chatgpt-agent), [Relevance task view](https://relevanceai.com/docs/build/workforces/workforce-features/workforce-task-view), [Sierra](https://sierra.ai/blog/confidence-in-every-conversation) |
| 10 | **Lineage / provenance / ownership** | k8s (owner controller, node, services per pod), Vercel (git commit author + branch per deployment), our `spawnSpec.proposedBy`/`spawnedAt` | "Who made this and when" matters for spawned/autonomous entities | [Kubius detail](https://kubius.io/docs/pods), [Vercel redesign](https://vercel.com/blog/dashboard-redesign) |
| 11 | **Audit trail / replay** | AgentOps ("full data trail of logs, errors"; time-travel debugging), Langfuse (session replay as public link), LangSmith (thread/trajectory replay), Sierra (Agent Traces: every decision, tool call, response) | Post-hoc accountability; also the substrate for evals | [AgentOps](https://www.agentops.ai/), [Langfuse sessions](https://langfuse.com/docs/observability/features/sessions), [Sierra Agent Studio](https://sierra.ai/product/agent-studio) |
| 12 | **Identity / role / description** | Universal — every product names and describes each agent (Relevance `name`/`description`/`avatar`, Lindy teammates, Copilot Studio agents) | Table stakes; humans organize around named entities | [Relevance SDK](https://relevanceai.com/docs/sdk/agents) |
| 13 | **Lifetime / tenure stats** | Relevance (tasks done sorting), our tasksCompleted/tasksFailed, k8s (age, restart count) | Distinguishes proven workers from new spawns | [Relevance](https://relevanceai.com/posts/2024-11-03-introducing-agents-list-view) |
| 14 | **Contact / escalation channel** | Lindy ("How to reach me": dedicated email + phone per agent), Sierra (escalate to care team with full context) | Every autonomous employee needs a way to reach its supervisor | [Lindy docs](https://www.lindy.ai/docs/teammate/home) |
| 15 | **Direct control (pause/stop/takeover)** | ChatGPT agent (interrupt, takeover, stop at any point), k8s (delete/scale), our mission console interrupt | Control must be adjacent to observation — a dossier you can't act on is half a feature | [OpenAI](https://openai.com/index/introducing-chatgpt-agent/) |
| 16 | **Inter-agent handoffs** | Datadog Agent Observability (handoffs between agents as first-class spans), Zapier (agent-to-agent calling), HoneyHive Threads (sub-agent internal messages) | In a fleet, "who handed work to whom" is core provenance — our spawn lineage is the static version | [Datadog](https://www.datadoghq.com/blog/monitor-ai-agents/) |
| 17 | **"Needs action" / approval-queue state** | Zapier ("Needs action" filter, 11 statuses incl. needs review/safely halted), ChatGPT agent (confirmations, watch mode), Relevance (awaiting-approval task state), UiPath (HITL as workflow step) | Pending human input must be impossible to miss — it's the difference between autonomy and abandonment | [Zapier help](https://help.zapier.com/hc/en-us/articles/33336184962573-Review-your-agent-s-activity), [13Labs analysis](https://www.13labs.au/guides/see-what-your-ai-agent-is-doing) |
| 18 | **Permission / scope inventory** | Datadog AI Agents Console (permissions across systems for third-party agents), ChatGPT agent (apps enabled per task), Lindy (integrations per agent), Relevance (connected tools) | For autonomous entities, "what can it touch" is a security question, not just a capability list | [Datadog](https://www.datadoghq.com/about/latest-news/press-releases/datadog-expands-llm-observability-with-new-capabilities-to-monitor-agentic-ai-accelerate-development-and-improve-model-performance/) |
| 19 | **Quality scores / evals as metrics** | AgentCore (eval scores → CloudWatch metrics + alarms), Galileo (continuous evals, Luna SLMs for 100% coverage), Copilot Studio (thumbs up/down reactions), Braintrust (online scoring on production traffic) | Quality treated as an SLO with thresholds — not a periodic report | [AgentCore evals](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/evaluations.html), [Galileo](https://galileo.ai/llms.txt) |
| 20 | **Failure clustering / named issues** | Arize AX Signal (recurring failures → ranked issues w/ evidence + proposed fix), HoneyHive (trajectories → datasets), AgentOps (error breakdowns) | Raw errors don't scale; clustered, named failure modes with evidence do | [Arize AX](https://arize.com/docs/ax) |

**Cross-cutting finding:** every elite product answers a *present-tense* question first (what is it doing now) before historical aggregates. Our current dossier leads with lifetime stats (DONE/FAILED/TSR) — the ordering is inverted relative to every comparator.

---

## 2. Per-product teardowns (top comparables)

### Devin (Cognition) — the gold standard for "watch your agent work"
Session UI splits chat (left) from workspace (right). The **Progress tab** unifies shell commands, code edits, and browser activity into one timeline; clicking any step drills into exactly what happened. Ask mode vs Agent mode is explicit. Takeover: pause Devin before editing, tell it what you changed on resume. Reviewer workflow: scan Progress → shell history for the diverging step → IDE for touched files → Desktop only for visual/auth issues. *Lesson for us:* progressive disclosure — summary first, forensic detail one click deeper. [docs.devin.ai](https://docs.devin.ai/work-with-devin/devin-session-tools), [fast.io teardown](https://fast.io/resources/devin-ide-guide/)

### Manus — the gold standard for plan visibility
`todo.md` is the agent's literal working memory: a Markdown checklist the model creates, updates, and checks off in real time. UI shows running timer, current file being edited, thinking status, stop control. Right panel = live computer (collapsible). Completed task → deliverable preview + rating + follow-up suggestions. *Lesson:* a visible, living plan converts autonomy into legibility. We don't have plans — but `task.title` + `progress` + `status` is our proto-plan. [SaaSUI](https://www.saasui.design/application/manus), [kdjingpai teardown](https://www.kdjingpai.com/en/manus-pingshenmezhongban/)

### ChatGPT agent (now "ChatGPT Work" cloud browser) — the gold standard for oversight gates
Confirmations before high-impact actions; **Watch Mode** requires active supervision on sensitive tasks (e.g., sending email); **Take Over** hands the browser to the human for passwords — and screenshots are *not* collected during takeover. Pause → progress summary → stop-with-partial-results are all first-class. *Lesson:* autonomy is sold as *controlled* autonomy; the dossier should make pending-approval and takeover states impossible to miss. [OpenAI launch](https://openai.com/index/introducing-chatgpt-agent/), [help center](https://help.openai.com/en/articles/11752874-chatgpt-agent)

### LangSmith — the gold standard for trace debugging
Three view modes on one run: **Trajectory** (flattened conversation for orientation), **Turns** (per-turn cards), **Details** (inputs, outputs, timing, token counts, errors, metadata). Keyboard-switchable (T/D). Monitoring tab: trace count, latency, error rate, feedback scores, costs over time. *Lesson:* separate "orient" from "forensic" views; don't make one panel do both. [docs.langchain.com](https://docs.langchain.com/langsmith/view-traces)

### AgentOps — the gold standard for session forensics
Session list (total execution time, SDK/framework versions) → Session Waterfall: left = time-visualization of every LLM call, action, tool call, error; right = details of selected event. Session Overview = meta-analysis across sessions. Token counts and cost tracking across agents. Time-travel replay. *Lesson:* the waterfall is the right pattern for task-level drill-down; our mission log + task detail is a primitive version. [docs.agentops.ai](https://docs.agentops.ai/v2/usage/dashboard-info)

### Relevance AI — the gold standard for "AI employee" management
Agents list: unified view, expand row → connected tools/integrations, sort by last run / tasks done / modified, productivity metrics. Workforce Task View: real-time task monitoring (active/completed/awaiting-approval/failed), manual triggers, approval management (approve/reject/modify), full conversation history. Per-user analytics: credits consumed per user with visual bars, per-agent breakdown. Agent metadata via SDK: name, description, avatar, region, createdAt. *Lesson:* the agent-as-employee metaphor implies HR fields — utilization, output count, cost — not just technical health. [agents list post](https://relevanceai.com/posts/2024-11-03-introducing-agents-list-view), [task view docs](https://relevanceai.com/docs/build/workforces/workforce-features/workforce-task-view)

### Microsoft Copilot Studio — the gold standard for outcome metrics
Monitor page: DAU/MAU, sessions, average duration, **success rate and fail rate**, reactions (thumbs up/down), **total estimated credits used**, sessions with per-session credits. Autonomous agents add: run outcomes chart, trigger use, tool use success, knowledge source use. Agent Insights Hub: 7 KPIs incl. tool success % and error count with period-over-period trends. *Lesson:* pair every volume metric with a rate metric (success %, tool success %); raw counts without denominators mislead. [analytics overview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/analytics-overview), [insights hub](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/kit-agent-insights-hub)

### Sierra / Decagon — the gold standard for enterprise agent governance
Sierra: "Supervisors" — parallel guardrail agents reviewing each response in real time, escalating to humans; "Monitors" review every conversation automatically; Agent Traces show every decision, tool call, response. Decagon: 100% of agent logic on inspectable natural-language AOPs; Watchtower reviews every conversation against custom criteria; Duet proposes agent updates with human approval. *Lesson:* for high-stakes agents, "who watches the watcher" is a dossier element — our WARDEN is literally this pattern. [Sierra blog](https://sierra.ai/blog/confidence-in-every-conversation), [Decagon vs Sierra](https://decagon.ai/vs/sierra)

### Kubernetes dashboards — the gold standard for entity health at scale
Pod list: status dot (green Running / orange Pending / red CrashLoop / grey Terminating), **restart count highlighted red >5**, age. Pod detail: Overview (info, conditions, owner, node, related resources), Events (newest first), Logs (live tail), YAML. Kubeglass: "problem" column derived server-side ("CrashLoopBackOff" with reason under name). *Lesson:* status color + reason + count + age is the minimal sufficient health tuple; our dossier should match this discipline. [Kubius](https://kubius.io/docs/pods), [Kubeglass](https://kubeglass.com/docs/guides/dashboard/)

### Vercel — the gold standard for deployment-as-feed
Whole dashboard organized around the deployment as the inspectable unit: reverse-chronological feed, status dot, commit message, branch, preview URL, streaming build logs, promote-to-production. Tabs reflect status in the browser favicon. *Lesson:* a feed of discrete work-units with status is more legible than aggregate charts; our Mission Log is already this pattern — the dossier should link *into* it. [vercel.com/blog/dashboard-redesign](https://vercel.com/blog/dashboard-redesign), [TYPENORM teardown](https://typenorm.com/apps/vercel)

### Lindy — the gold standard for ambient assistant presence
Home is conversational, not a config dashboard; cards fill in as the agent works (upcoming meetings, "what I've been up to" stats, recent learnings). Each agent has a reachable email + phone. Tasks view shows run history; observability via triggers on task events (created/succeeded/working/canceled/failed). *Lesson:* stats framed as outcomes ("emails triaged, time saved") beat raw counters for trust. [Lindy docs](https://www.lindy.ai/docs/teammate/home)

---

## 2b. Supplementary teardowns — full domain coverage

### Arize Phoenix / AX — open-telemetry-native agent tracing
Phoenix (OSS) + AX (enterprise) share OpenTelemetry/OpenInference semantics. AX workflow: Instrument → Observe → Evaluate → improve. **Signal** groups recurring failures across traces into ranked issues, each with trace evidence and a proposed fix; **Alyx** answers plain-language questions over your trace data. Sessions tab: sort/filter by duration, trace count, user ID, token count; session-level evals. Spans tab: cross-trace view of one operation type (all tool calls, all LLM calls). *Lesson:* "Signal" — clustering failures into named, evidence-backed issues — is the pattern our WARDEN patrols could feed; ranked-issue-with-evidence is more actionable than a raw error feed. [Arize AX docs](https://arize.com/docs/ax), [traces](https://arize.com/docs/ax/observe/tracing/view-and-manage-traces), [Phoenix vs AX](https://arize.com/products/phoenix-plus-arize-ax/)

### Datadog Agent Observability + AI Agents Console — the enterprise multi-agent map
Captures intra- AND inter-agent operations: tool usage, LLM calls, memory interactions, **handoffs between agents**, retries, errors — mapped across LangGraph DAGs, CrewAI chains, OpenAI planning abstractions to a unified model. Interactive execution graph shows decision path; drill into any agent for tools used, timing, errors. Token usage, latency, error rates per operation with alerts. **AI Agents Console** (preview): inventory of third-party agents (Operator, Agentforce, Claude) with permissions across systems. Online evaluators: failure-to-answer, topic relevance, toxicity/Pii. *Lesson:* for a fleet product, **inter-agent handoffs and per-agent permission scope** are first-class observability — our dossier's lineage element (Q5) is the consumer version of their Agents Console. [Datadog](https://www.datadoghq.com/products/ai/agent-observability/), [blog](https://www.datadoghq.com/blog/monitor-ai-agents/), [investigate docs](https://docs.datadoghq.com/llm_observability/investigate.md)

### AWS Bedrock AgentCore + CloudWatch "Agent view" — per-agent ops dashboard
CloudWatch Agent view: curated per-account agent dashboard — Agents/Endpoints count, Sessions, Traces, Error rate. Per-agent detail: Overview dashboards, **Evaluations tab** (evaluators with avg scores, expandable to sessions→traces→spans), token usage, latency. Evaluations sample real sessions and score with LLM-as-judge; scores become CloudWatch metrics with alarms. *Lesson:* evaluation scores as *metrics with alarms* — quality treated like an SLO, not a report. Our WARDEN findings could emit the same way. [CloudWatch agent view](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/agent-view.html), [evaluations](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/evaluations.html)

### Maxim — evals + observability unified
End-to-end: prompt IDE/versioning → simulation (test agents across scenarios/personas pre-release) → production observability (traces, timeline view, online evals, alerts to Slack/PagerDuty). Logs table columns: input, output, model, tokens, cost, latency, user feedback. Omnibar filtering + saved views. *Lesson:* simulation-before-ship is the pre-production half of the dossier story — our spawn proposals are a proto-version of gated deployment. [getmaxim.ai/evals](https://www.getmaxim.ai/evals), [observability cookbook](https://www.getmaxim.ai/docs/cookbooks/product-cookbooks/observability-processes-for-effective-error-analysis-as-a-pm)

### HoneyHive — trajectory-centric observability
Differentiated views: **Trajectories** (spot loops, stuck steps, outliers in long sessions as bubbles sized by duration/cost), **Threads** (session across sub-agents incl. internal messages), Agent Graphs, Timeline. Production failures → annotation queues → datasets → experiments (EDD loop). "Audit-ready evidence" positioning for risk officers. *Lesson:* bubbles sized by cost/duration is a compact way to show *where* an agent's time/money went — relevant if our dossier ever shows task economics. [honeyhive.ai](https://www.honeyhive.ai/), [docs](https://docs.honeyhive.ai/v2/introduction/what-is-hhai)

### Keywords AI / Respan — the unified data-model insight
Four views (Logs, Traces, Threads, Scores) over ONE underlying data structure — "different views of the same data." Per-request fields: prompt/completion tokens, cache hits, latency, TTFT, tokens/sec, **cost USD**, customer_identifier, environment. AI gateway routes 250+ models with fallback/load-balancing. *Lesson:* our dossier's NOW/RECORD/DOSSIER zones are the same pattern — one agent entity, multiple projections. Also: `customer_identifier`-style attribution (which user/task spawned the work) is standard in their schema — supports our lineage gap. [Keywords AI docs](https://keywordsai.mintlify.app/get-started/observability_data_model), [overview](https://keywordsai.mintlify.app/get-started/overview)

### Galileo — evaluation-as-guardrail
Three connected capabilities: Evaluation (pre-production golden sets), Observability (production monitoring), **Protection** (runtime guardrails in the request path). Luna-2 SLMs make evaluation cheap enough for 100% traffic coverage vs. sampled LLM-judge. Agent Graph Visualization for multi-agent behavior; automated Signals for failure detection. *Lesson:* the strongest enterprise pattern is closing the loop — production failures become evals become guardrails. Maps to our proposal→spawn→warden loop conceptually. [galileo.ai](https://galileo.ai/llms.txt), [Luna docs](https://docs.galileo.ai/concepts/luna/luna), [Moor Insights](https://moorinsightsstrategy.com/research-notes/galileo-brings-cisco-a-purpose-built-agent-evaluation-layer/)

### n8n — execution-as-unit, honestly scoped
Every workflow execution has a unique ID = root span; per-node child spans with status/duration/error; Executions tab per workflow with status filters (Failed/Running/Success/Waiting), retry-with-data. Native OTel export (traceparent propagation in/out, span links across waits). Node-level data includes prompts, completions, token usage, tool I/O — "the richest source n8n has." n8n positions itself as *complementing* dedicated observability, not replacing it. *Lesson:* execution-ID-as-correlation-root and retry-with-same-input are cheap, high-value patterns; our task IDs already work this way. [n8n blog](https://blog.n8n.io/ai-agent-observability/), [OTel tracing](https://blog.n8n.io/trace-n8n-workflow-and-node-executions-with-opentelemetry/), [executions docs](https://docs.n8n.io/build/understand-workflows/understand-executions/view-executions-for-a-single-workflow)

### Zapier Agents — the "AI employee" activity feed, consumer-grade
Activity dashboard: complete log of agent runs with status, apps used, timestamp; **"Needs action" filter** for runs awaiting human input; per-agent Activity page; **Pods** group related agents; run details show "how the agent interpreted and carried out the instructions"; 11 run statuses incl. "needs review" (Human-in-the-Loop), "safely halted"; pin runs to top; version control on agent instructions; agent-to-agent calling. *Lesson:* "Needs action" as a first-class filter is the approval-queue pattern at consumer scale — exactly what our dossier should surface when a task waits on human input. [Zapier help](https://help.zapier.com/hc/en-us/articles/33336184962573-Review-your-agent-s-activity), [agents guide](https://zapier.com/blog/zapier-agents-guide/), [pods/dashboards](https://zapier.com/blog/zapier-agents-pods-dashboards/)

### Make (Make AI Agents) — reasoning transparency
New AI Agents app: real-time animations showing thinking/tool calls in exact order; **Reasoning panel** — step-by-step logic of why the agent chose an action; build/test/debug in Scenario Builder; AI-assisted tool config. *Lesson:* Make shows agent reasoning — but note NN/g's warning that generated explanations can be inaccurate; Make's version works because it's tied to actual tool-call steps (evidence), not free-prose rationalization. [Make help](https://help.make.com/meet-the-new-make-ai-agents-app)

### UiPath — governance-first orchestration
Three-layer platform: Maestro Orchestrate (BPMN/Flow/Case — processes pause for approvals, resume without losing state; HITL as first-class workflow step), execution layer (agents reason within guardrails, RPA acts deterministically), Model Hub (centralized view of which models exist, where they run, traffic routing, config changes). **Action Center**: Autopilot answers "Why was this task escalated?" by summarizing the execution trace (agent, tools used, grounding docs); trace feedback feeds agent memory. Process Mining/Tracking: causality across humans, robots, systems. *Lesson:* "why was this escalated" as a queryable question is the killer feature — our dossier could answer the same for failed/flagged tasks. [UiPath platform](https://www.uipath.com/platform/agentic-automation), [foundation](https://www.uipath.com/platform/agentic-automation/foundation), [Action Center tools](https://docs.uipath.com/action-center/automation-cloud/latest/user-guide/tools-and-features-available)

### NASA Mission Control — the aesthetic ancestor, now sourced
MCC operational reality: ~500 selectable data displays; the governing principle was literally **"display a few parameters at a time with rapid access to all others"** (Apollo Experience Report, TN-7685) — progressive disclosure as engineering doctrine, not style. MOCR group displays controllable only by Flight Director/AFLIGHT via Manual Select Keyboards; five data groups (mission command, flight dynamics, systems ops, medical, comms). Flight Director Console Handbook: position sign-on IDs, recorded consoles, page presets per flight phase. MCT (Mission Control Technologies) composable displays. *Lesson:* our three-zone dossier IS the MCC pattern — a few parameters always visible (NOW), full library one keystroke away (RECORD/DOSSIER). The console sign-on/position-ID concept maps to agent identity + role. [TN-7685](https://ibiblio.org/apollo/Documents/TN-7685-ApolloExperienceReport-FlightControlNeeds.pdf), [MOCR displays](https://earlyspaceflight.nl/Mission_Management/JSC/MCC/MOCR/MOCR-page2.html), [MCT paper](https://ntrs.nasa.gov/api/citations/20110010878/downloads/20110010878.pdf), [FD Console Handbook](https://www.ibiblio.org/apollo/Shuttle/MCC/Flight%20Director%20Console%20Handbook.pdf)

---

## 3. The "five questions" test

A dossier succeeds if it answers these at a glance, in this order:

| Question | Information elements that answer it | Best demonstrators |
|----------|------------------------------------|--------------------|
| **Q1. What is it doing right now?** | Current task title, live status, progress %, elapsed time, current model/tool | Manus, Devin, ChatGPT agent |
| **Q2. Is it healthy?** | Status, heartbeat freshness, success rate, recent error + reason, restarts/failures | k8s dashboards, Copilot Studio, AgentOps |
| **Q3. What has it done?** | Lifetime counters, recent run list w/ outcomes + durations, deliverables | Relevance AI, Vercel feed, Langfuse sessions |
| **Q4. What is it allowed / capable of?** | Role, tools/scopes, model pin, budget, tier, spawn mission + TTL | Relevance (tools), ChatGPT (connectors), Decagon (AOPs) |
| **Q5. What does it cost / can I trust it?** | Spend vs. budget, failure transparency, lineage (who spawned it), audit trail | AgentOps (cost), Copilot (credits), Sierra/Decagon (traces + approval) |

Trust research grounding: Lee & See (2004) establish that trust should be *calibrated* — matched to actual trustworthiness; displays should support appropriate reliance, not maximize trust. The CHI 2023 survey (96 publications) confirms calibration interventions cluster around exposing capability + reliability evidence. NN/g's explainable-AI research warns that generated *explanations* are often inaccurate — the reliable pattern is showing **evidence** (traces, artifacts, outcomes) rather than prose rationales. Condens's AI-integration guidelines: scope tasks specifically, always connect output to verifiable evidence, keep core tasks doable without AI. [Lee & See 2004](https://journals.sagepub.com/doi/10.1518/hfes.46.1.50_30392), [CHI 2023 survey](https://dl.acm.org/doi/full/10.1145/3544548.3581197), [NN/g explainable AI](https://www.nngroup.com/articles/explainable-ai/), [NN/g Condens](https://www.nngroup.com/articles/ai-integration-condens/)

---

## 4. Ranked recommendation for Cortex

Mapping to our actual `AgentClient` / `AgentTaskClient` / `ModelClient` / snapshot fields. The dossier replaces the current bottom-sheet (name/role/blurb/DONE/FAILED/TSR/budget/pin/class + 5 tasks).

### Layout: three zones, top-to-bottom = Q1→Q5

**Zone A — "NOW" (answers Q1+Q2, always visible, ~120px)**

| Element | Our field | Priority | Notes |
|---------|-----------|----------|-------|
| Name + class badge | `name`, `tier` → STANDARD/ENTERPRISE | MUST | Enterprise gets satellite glyph |
| Live status pill | `status` | MUST | Color = vessel color; pulse when working |
| Current task title + kind | `currentTaskId` → task lookup | MUST | The single most important line on the panel |
| Live progress bar + % + elapsed | `task.progress`, `startedAt` | MUST | We have all of it — currently invisible |
| Current model | `task.model` | MUST | Short model name, lane color |
| Heartbeat freshness | `lastHeartbeatAt` | MUST | "beat 12s ago" — k8s-age pattern; silence = suspicion |
| Error banner (when status=error) | `task.error`, `telemetry.failureClass` | MUST | Reason inline, not buried |

**Zone B — "RECORD" (answers Q3, scrollable ~200px)**

| Element | Our field | Priority | Notes |
|---------|-----------|----------|-------|
| Lifetime stats row | `tasksCompleted`, `tasksFailed`, TSR% | MUST | Keep, but demote below NOW zone |
| Recent runs list (~8) | `tasks[]` filtered by agentId | MUST | Each row: status dot, title, duration, model, failureClass on fail. Tap → expand result/error |
| Task result preview | `task.result` | SHOULD | Show truncated result/error text on expand — Devin step-drill pattern |
| Deliverables/outputs | `task.result` (unstructured today) | COULD | Needs result schema work |

**Zone C — "DOSSIER" (answers Q4+Q5, collapsible sections)**

| Element | Our field | Priority | Notes |
|---------|-----------|----------|-------|
| Role + blurb | `role`, `blurb` | MUST | Already have |
| Capabilities / tools | `spawnSpec.tools[]` | MUST | We collect it, never display it — free win |
| Model pin | `modelPin.tier` (derived) + `task.model` | MUST | Show pinned tier + what it's actually running |
| Budget | `dailyBudget` | MUST | Show cap; pair with usage when available |
| Spawn lineage | `spawnSpec{callSign, mission, proposedBy, spawnedAt, ttlHours}` | MUST | "Spawned by X · 3d ago · TTL 19h left" — k8s owner pattern; spawned agents especially need this |
| Concurrency | `concurrency` | SHOULD | "Runs N tasks in parallel" |
| Health detail | `ModelClient` for pinned model: status, latencyMsP50, consecutiveFailures | SHOULD | Join task.model → model health; "its brain is degraded" is critical info |
| Approvals / pending oversight | — | COULD | No approval-gate concept yet; file as future |
| Cost per task / tokens | — | COULD | **Not collected** — biggest honest gap vs. every commercial comparator |
| Tool-call trace per task | `task.telemetry` (failureClass only today) | COULD | **Not collected** — AgentOps/Braintrust lead with this |
| Plan/todo checklist | — | COULD | **Not collected** — Manus/Devin lead with this |
| Audit/replay of full run | task history only | COULD | Partial — we have outcomes, not traces |

### Explicitly NOT recommended (anti-patterns, §5)

- Raw chain-of-thought or model reasoning text (NN/g: generated explanations are often inaccurate; OpenAI deliberately doesn't expose CoT)
- Unfiltered event/log streams as the primary view (AgentOps waterfall is a pro tool; consumer leaders summarize — our ticker + mission log already cover ambient awareness)
- Internal UUIDs as labels anywhere
- More than ~3 numeric stats in the header zone (Vercel lesson: terse beats comprehensive)

---

## 5. Anti-patterns observed

1. **Prose "AI explanations" of behavior** — NN/g (Dec 2025): current LLM-generated explanations are "often inaccurate, hidden, or confusing." Show artifacts (task titles, results, errors), not rationales.
2. **Aggregate dashboards without denominators** — Copilot Studio pairs every count with a rate; raw "42 tasks" without success rate misleads.
3. **Configuration-first agent pages** — Lindy explicitly rejects "dashboard of buttons to configure"; observation before configuration.
4. **Hidden cost** — every commercial product surfaces spend; hiding it is the fastest way to lose trust.
5. **Status without reason** — k8s learned this the hard way: "CrashLoopBackOff" alone is useless; the reason underneath is the product.

---

## 6. Data gaps requiring backend work (honest list)

| Desired element | Status today | Effort estimate |
|-----------------|--------------|-----------------|
| Per-task token/cost | Not collected — `AgentTaskClient` has no usage fields | Medium: capture from model matrix responses, aggregate per task |
| Tool-call trace | `telemetry.failureClass` only on failures | Medium-large: instrument task runner steps |
| Plan/todo state | Not collected | Large: needs agent protocol change (Manus todo.md pattern) |
| Approval gates | No concept exists | Large: new runtime feature, not just UI |
| "Needs action" state | Tasks have status but no awaiting-human state | Small-medium: add task status + surface in dossier/mission log |
| Inter-agent handoff trace | Spawn lineage is static (proposedBy); no runtime handoff record | Medium: tasks would need parent/spawnedBy task refs |
| Permission/scope inventory | `spawnSpec.tools[]` exists for spawned agents only; built-ins have implicit scopes | Small: declare tools per built-in agent, display uniformly |
| Eval/quality scores | WARDEN patrols exist but produce findings, not per-agent scores | Medium: aggregate warden findings per agent → score |
| Deliverable registry | `task.result` is `unknown` | Small-medium: schema-ify results per task kind |
| Spawn lineage on tasks | `proposedBy` lives on proposals, not tasks | Small: propagate at spawn time |
| Heartbeat display | `lastHeartbeatAt` exists, unused in UI | Trivial |
| Model health join | `ModelClient` exists, not joined in dossier | Trivial |

---

## 7. Source appendix

All sources accessed this session:

- LangSmith: https://docs.langchain.com/langsmith/view-traces · https://docs.langchain.com/langsmith/observability-concepts · https://www.langchain.com/blog/langsmith-trajectories-tracing
- AgentOps: https://www.agentops.ai/ · https://docs.agentops.ai/v2/usage/dashboard-info · https://docs.agentops.ai/v2/introduction · https://www.therundown.ai/tools/agentops
- Devin: https://docs.devin.ai/work-with-devin/devin-session-tools · https://docs.devin.ai/tutorial-library/ide-walkthrough · https://fast.io/resources/devin-ide-guide/ · https://nahi.dev/posts/I-tested-Devin/
- Manus: https://www.saasui.design/application/manus · https://manus.im/docs/introduction/quickstart · https://www.kdjingpai.com/en/manus-pingshenmezhongban/ · https://manus.im/docs/features/desktop
- ChatGPT agent: https://openai.com/index/introducing-chatgpt-agent/ · https://help.openai.com/en/articles/11752874-chatgpt-agent · https://arstechnica.com/information-technology/2025/07/chatgpts-new-ai-agent-can-browse-the-web-and-create-powerpoint-slideshows/ · https://9to5ai.tech/chatgpt-agent-mode-explained
- Lindy: https://www.lindy.ai/docs/teammate/home · https://lindyai.mintlify.app/testing/monitoring-your-agents · https://community.lindy.ai/x/share-your-lindy/25u6wclihecp/tracking-lindy-agent-activity-with-a-centralized-d
- Relevance AI: https://relevanceai.com/posts/2024-11-03-introducing-agents-list-view · https://relevanceai.com/docs/get-started/core-concepts/agents · https://relevanceai.com/docs/build/workforces/workforce-features/workforce-task-view · https://relevanceai.com/docs/sdk/agents · https://relevanceai.com/posts/2026-03-03-track-individual-team-member-ai-usage-with-detailed-per-user-analytics
- Copilot Studio: https://learn.microsoft.com/en-us/microsoft-copilot-studio/analytics-overview · https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/analytics-overview · https://learn.microsoft.com/en-us/microsoft-copilot-studio/analytics-improve-agent-health · https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/kit-agent-insights-hub · https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/agent-business-value-metrics-reference
- Sierra/Decagon: https://sierra.ai/blog/confidence-in-every-conversation · https://sierra.ai/product/agent-studio · https://sierra.ai/blog/enterprise-grade-agents · https://decagon.ai/vs/sierra · https://cresta.com/guides/decagon-vs-sierra
- Kubernetes: https://kubius.io/docs/pods · https://kubeglass.com/docs/guides/dashboard/ · https://docs.kubewatchlabs.com/dashboard/kubernetes · https://docs.whatap.io/en/kubernetes/resource-pod-list · https://radarhq.io/docs/features/resources
- Vercel: https://vercel.com/blog/dashboard-redesign · https://typenorm.com/apps/vercel · https://grasp.study/ (IA analysis) · https://vercel.com/docs/pricing/manage-and-optimize-usage.md · https://rauno.me/notes/2
- Langfuse: https://langfuse.com/docs · https://langfuse.com/docs/observability/features/sessions · https://langfuse.com/docs/observability/data-model · https://langfuse.com/docs/observability/best-practices
- Braintrust: https://www.braintrust.dev/ · https://www.braintrust.dev/product/observe · https://docs.braintrust.dev/observe · https://docs.braintrust.dev/observe/view-logs · https://docs.braintrust.dev/observe/examine-traces
- Trust/UX research: https://journals.sagepub.com/doi/10.1518/hfes.46.1.50_30392 (Lee & See 2004) · https://pmc.ncbi.nlm.nih.gov/articles/PMC8714273/ · https://pages.mtu.edu/~shanem/human_ai/ch-trust-definitions.html · https://dl.acm.org/doi/full/10.1145/3544548.3581197 (CHI 2023) · https://www.nngroup.com/articles/explainable-ai/ · https://www.nngroup.com/articles/crafting-ai-explanations/ · https://www.nngroup.com/articles/ai-integration-condens/ · https://www.nngroup.com/articles/machine-learning-ux/
- Arize: https://arize.com/docs/ax · https://arize.com/docs/ax/observe/tracing/view-and-manage-traces · https://arize.com/docs/phoenix · https://arize.com/products/phoenix-plus-arize-ax/
- Datadog: https://www.datadoghq.com/products/ai/agent-observability/ · https://www.datadoghq.com/blog/monitor-ai-agents/ · https://docs.datadoghq.com/llm_observability/investigate.md · https://www.datadoghq.com/blog/openai-agents-llm-observability/ · https://www.datadoghq.com/about/latest-news/press-releases/datadog-expands-llm-observability-with-new-capabilities-to-monitor-agentic-ai-accelerate-development-and-improve-model-performance/
- AWS: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/agent-view.html · https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/session-traces-evaluations.html · https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/results-and-output.html · https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/observability.html · https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/evaluations.html
- Maxim: https://www.getmaxim.ai/evals · https://www.getmaxim.ai/evals/products/experimentation · https://www.getmaxim.ai/docs/cookbooks/product-cookbooks/observability-processes-for-effective-error-analysis-as-a-pm · https://www.getmaxim.ai/articles/maximizing-ai-agent-observability-how-to-set-up-the-custom-dashboard-on-maxim-for-end-to-end-monitoring/ · https://www.getmaxim.ai/articles/top-5-ai-observability-platforms-in-2026/
- HoneyHive: https://www.honeyhive.ai/ · https://docs.honeyhive.ai/v2/introduction/what-is-hhai · https://www.honeyhive.ai/enterprise · https://www.honeyhive.ai/about · https://www.honeyhive.ai/pricing
- Keywords AI/Respan: https://keywordsai.mintlify.app/get-started/overview · https://keywordsai.mintlify.app/get-started/observability_data_model · https://keywordsai.mintlify.app/get-started/quickstart/gateway · https://keywordsai.mintlify.app/api-endpoints/observe/logs/request-logging-endpoint · https://clickhouse.com/blog/respan-ai-llm-observability
- Galileo: https://galileo.ai/llms.txt · https://docs.galileo.ai/concepts/luna/luna · https://galileo.ai/blog/introducing-galileo-luna-a-family-of-evaluation-foundation-models · https://moorinsightsstrategy.com/research-notes/galileo-brings-cisco-a-purpose-built-agent-evaluation-layer/ · https://docs.galileo.ai/concepts/luna/luna-metric-comparison
- n8n: https://blog.n8n.io/ai-agent-observability/ · https://blog.n8n.io/trace-n8n-workflow-and-node-executions-with-opentelemetry/ · https://docs.cognipeer.com/console/guide/observe/integrations/n8n · https://docs.n8n.io/build/build-and-manage-agents · https://docs.n8n.io/build/understand-workflows/understand-executions/view-executions-for-a-single-workflow
- Zapier/Make: https://help.zapier.com/hc/en-us/articles/33336184962573-Review-your-agent-s-activity · https://zapier.com/blog/zapier-agents-guide/ · https://zapier.com/blog/zapier-agents-pods-dashboards/ · https://help.make.com/meet-the-new-make-ai-agents-app · https://www.13labs.au/guides/see-what-your-ai-agent-is-doing
- UiPath: https://www.uipath.com/platform/agentic-automation · https://www.uipath.com/platform/agentic-automation/foundation · https://docs.uipath.com/action-center/automation-cloud/latest/user-guide/tools-and-features-available · https://docs.uipath.com/task-mining/automation-cloud/latest/user-guide/introduction-as · https://docs.uipath.com/process-mining/automation-cloud/latest/user-guide/process-tracking
- NASA MCC: https://ibiblio.org/apollo/Documents/TN-7685-ApolloExperienceReport-FlightControlNeeds.pdf · https://earlyspaceflight.nl/Mission_Management/JSC/MCC/MOCR/MOCR-page2.html · https://ntrs.nasa.gov/api/citations/20110010878/downloads/20110010878.pdf · https://www.ibiblio.org/apollo/Shuttle/MCC/Flight%20Director%20Console%20Handbook.pdf · https://klabs.org/history/history_docs/jsc_t/mcc_operational_configuration_as15.pdf

**Coverage status:** All prompt-designated domains now torn down: 10 observability platforms, 10 consumer/enterprise agent products, 5 fleet/infra analogues, NASA MCC conventions, and trust/UX research. Remaining thin spots: Galileo/Luna and HoneyHive trajectories got single-source teardowns (vendor docs + one analyst note each); n8n/Zapier/Make covered via official docs. A second independent research pass (see prompt's independent-run protocol) may surface additional sources.
