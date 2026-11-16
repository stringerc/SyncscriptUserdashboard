# Cortex Agent Dossier — SCOUT/ LIBRARIAN Arm (Independent Research Run)

> **Provenance:** This report was produced by the Cortex agent fleet, not a frontier-model session. Method: 6 SCOUT `research` tasks (kind=research, depth=3) dispatched via `/api/cortex/agents/task` on 2026-… session date, one per research domain from `CORTEX_AGENT_DOSSIER_RESEARCH_PROMPT.md`. Each task ran web_search → top-page fetch → LLM brief (reasoning tier, ~900 token cap). Task IDs: task-mwj9qbpe-12 through task-mwj9qbqj-17. All completed; one auto-retried after timeout.
>
> **Blind protocol:** SCOUT had no access to `CORTEX_AGENT_DOSSIER_SPEC.md`. Its only inputs were the domain queries below.
>
> **Fidelity caveat (read first):** SCOUT's pipeline produces *briefs*, not deep reports — 900-token LLM cap, 6 search results, 3 fetched pages per task. This document compiles its raw briefs faithfully. Gaps and suspected errors are flagged inline and in §5.

---

## 1. Domain briefs (verbatim compilation)

### 1a. Agent observability platforms
**Task:** LangSmith, Langfuse, AgentOps, Braintrust, Arize Phoenix, Datadog LLM Obs, AgentCore, Maxim, HoneyHive, Galileo — per-agent/per-run detail elements.

**Brief findings:** SCOUT identified 10 elements it claims appear across platforms: current action/next step, plan/todo, timeline, health metrics (latency/throughput/error rate), error reasons (step + nature + codes), cost/tokens, tools/capabilities, model used (architecture + version), approvals (grant/deny + timestamp + responsible user), audit trail, lineage.

**Sources returned:** mostly SEO/listicle roundups (marktechpost, aimultiple, morphllm, analyticsvidhya, langchain resource page) + one DuckDuckGo ad redirect (honeycomb.io). **No primary vendor docs surfaced.**

### 1b. Consumer agent products
**Task:** Devin, Manus, ChatGPT agent, Claude Code, Cursor, MultiOn detail views.

**Brief findings:** Session/timeline views with Steps+Actions (Devin), "Mission Control" dashboards (Manus, MultiOn — note: this is SCOUT's phrasing, not verified product naming), chat-log-as-progress (ChatGPT agent, Claude Code), IDE-integrated timeline (Cursor). Manual override / approval pauses noted for Devin, Manus, Cursor.

**Sources returned:** teacherandtask.com blog, Microsoft Copilot learn pages, Deloitte, taskade blog, Microsoft agent design guidelines. **No primary docs (docs.devin.ai, manus.im/docs, openai.com absent).**

**⚠️ Verified error:** Brief labels "Devin (NVIDIA)" and "Manus (NVIDIA)" — both wrong. Devin is Cognition; Manus is Butterfly Effect / Manus AI. Neither is an NVIDIA product. Likely conflation from listicle sources.

### 1c. AI employee platforms
**Task:** Lindy, Relevance AI, Zapier, Make, n8n, Copilot Studio, Sierra, Decagon, UiPath.

**Brief findings:** Only Relevance AI yielded data — per-agent dashboard: Tasks completed + % trend, **Tasks to Review** (awaiting human approval), Actions Used (tool executions/API calls), Credits Used + trend, Benchmarks (avg error rate, avg credits/task), breakdowns by workforce/agent/action, date-range filters. All other vendors: "no per-agent dashboard field data in fetched sources."

**Sources returned:** relevanceai.com/docs/enterprise/analytics (primary — good hit), thecrunch.io comparison, lindy.ai blog/home/docs, saner.ai listicle.

### 1d. Fleet & mission control analogues
**Task:** k8s dashboards, Vercel, Stripe, NASA MCC.

**Brief findings:** Only Kubernetes covered — Grafana/kube-prometheus-stack dashboards, object hierarchy navigation (cluster→namespace→workload→node→container), per-pod CPU/mem/network/fs metrics. Brief honestly reports: "sources do not specify whether pod dashboards display status, restarts, events, logs, or owner." **Vercel, Stripe, NASA MCC: explicitly "no source provided."**

**Sources returned:** kubernetes.recipes, grafana.com docs, kubeprometheusstack.com, oneuptime, grafana dashboard 21298, site24x7.

### 1e. Trust & calibrated reliance
**Task:** Lee & See 2004, CHI 2023 survey, NN/g explainable AI.

**Brief findings:** Calibrated trust = alignment of user judgments with actual capability; transparency critical; dashboards should show confidence/uncertainty, decision explanations, performance metrics, override capability; overtrust prevention via appropriate transparency, real-time accuracy feedback, capability boundaries, user control.

**Sources returned:** sagepub Lee & See (primary ✓), researchgate mirrors, PMC article, cell.com Patterns, ACM CHI 2023 (dl.acm.org ✓). Best-sourced brief of the six.

### 1f. Cross-product pattern synthesis
**Task:** most common info elements across agent products.

**Brief findings:** Core (nearly all): current action/next step, progress/state, health/monitoring. Secondary (some): history/evidence trail, capabilities, cost ("limited explicit cost tracking in reviewed interfaces" — contradicts my finding that cost is near-universal in commercial products), oversight/approvals (variable; Across AI "Ready for review" decision packages, Automation Anywhere governance).

**Sources returned:** across.ai, automationanywhere.com, kanerika, promptessor, designveloper — all vendor/SEO, no observability-platform primaries.

---

## 2. SCOUT arm's implied dossier recommendation

Compiling its taxonomy into our layout terms, SCOUT's arm converges on:

- **NOW-equivalent:** current action/next step + progress/state + health metrics — matches my Zone A
- **RECORD-equivalent:** history/evidence trail — matches Zone B
- **DOSSIER-equivalent:** capabilities, approvals/oversight, audit trail, lineage — matches Zone C
- **Unique emphasis:** "Tasks to Review" / approval-pending state (from Relevance) and "evidence behind every decision" (Across AI) — aligns with my added elements #17-20

## 3. Convergence vs. my report (`CORTEX_AGENT_DOSSIER_SPEC.md`)

| Element | My report | SCOUT arm | Verdict |
|---------|-----------|-----------|---------|
| Current action/live step | MUST | core element | ✅ converged |
| Progress/state | MUST | core element | ✅ converged |
| Health metrics | MUST | core element | ✅ converged |
| Error reasons | MUST | present | ✅ converged |
| Timeline/activity feed | MUST | present | ✅ converged |
| Cost/tokens | SHOULD (gap flagged) | "limited explicit tracking" | ⚠️ partial — I found stronger evidence (AgentOps, Copilot credits, Relevance credits) |
| Tools/capabilities | MUST | secondary | ✅ converged |
| Approvals/HITL | SHOULD + gap | secondary, variable | ✅ converged direction |
| Audit trail | SHOULD | present | ✅ converged |
| Lineage/provenance | MUST (spawn) | present | ✅ converged |
| Model used | MUST | present | ✅ converged |
| Inter-agent handoffs | element #16 | absent | ❌ missed (Datadog/Zapier sources not reached) |
| "Needs action" state | element #17 | partial (Relevance "Tasks to Review") | ✅ converged independently |
| Failure clustering/Signals | element #20 | absent | ❌ missed (Arize AX not reached) |
| Plan/todo (Manus) | SHOULD | present but generic | ⚠️ converged, less specific |

## 4. What SCOUT's arm adds

- **Relevance AI enterprise analytics** (Tasks to Review, avg error rate, avg credits/task benchmarks) — a source I didn't cite; worth merging into §4 Zone C as a benchmark pattern ("avg credits/task" is a great per-agent efficiency metric).
- **Across AI** "versioned reasoning graph / evidence behind every decision" and "Ready for review" decision packages — new named products I didn't cover; supports the evidence-over-explanation thesis.
- **Automation Anywhere** governance/APA monitoring — another enterprise data point.

## 5. Honest quality assessment of the fleet arm

**Strengths:** correct on the big rocks (the converged core is real); honestly reported coverage gaps ("no source provided" rather than hallucinating Vercel/Stripe/NASA); best sourcing on the academic trust domain; surfaced 3 products I missed.

**Weaknesses:**
1. **Source quality** — leaned on SEO listicles/blog roundups; rarely reached primary docs (only relevanceai.com/docs and the academic papers were primary). My report used ~60 primary sources.
2. **Coverage** — 3 of 6 domains returned partial or no data for named products (fleet: 1/4 covered; AI employees: 1/9 covered).
3. **Hallucination** — "Devin (NVIDIA)", "Manus (NVIDIA)" factual errors; "Mission Control dashboard" attribution unverified.
4. **Depth ceiling** — 900-token brief cap structurally prevents the taxonomy/table/teardown deliverables; SCOUT is a scout, not a report writer. The synthesis burden fell to the reader.
5. **Cost finding contradicts** — claimed "limited explicit cost tracking" while AgentOps/Copilot/Relevance all surface spend prominently; its sources didn't include those products' docs.

**Verdict:** SCOUT's arm is a legitimate *first-pass scout* — good for breadth signals and gap flags, insufficient alone for a spec. This mirrors its designed role. For a true second opinion arm, the same prompt should go to another frontier model (the prompt's blind-run protocol supports `CORTEX_AGENT_DOSSIER_SPEC.<model>.md` outputs).

## 6. Sources (SCOUT-returned)

relevanceai.com/docs/enterprise/analytics · journals.sagepub.com/doi/10.1518/hfes.46.1.50_30392 · dl.acm.org/doi/fullHtml/10.1145/3544548.3581197 · pmc.ncbi.nlm.nih.gov/articles/PMC8562383/ · cell.com/patterns/fulltext/S2666-3899(24)00187-9 · kubernetes.recipes · grafana.com/docs · kubeprometheusstack.com · oneuptime.com · grafana.com/grafana/dashboards/21298 · site24x7.com · across.ai/platform · automationanywhere.com · lindy.ai (+docs) · teacherandtask.com · microsoft.com copilot/learn · deloitte.com · taskade.com · thecrunch.io · saner.ai · marktechpost.com · aimultiple.com · langchain.com/resources · morphllm.com · analyticsvidhya.com · kanerika.com · promptessor.com · designveloper.com · researchgate.net (×2)
