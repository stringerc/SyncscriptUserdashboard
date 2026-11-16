# CORTEX SYNTHESIS ROLE SPEC — The Missing Sense→Decide→Act Component

**Author:** Devin (frontier-model arm)
**Date:** 2026-11-16
**Prompt:** `CORTEX_SYNTHESIS_ROLE_RESEARCH_PROMPT.md`
**A/B counterpart:** `CORTEX_SYNTHESIS_ROLE_SPEC.SCOUT.md`
**Builds on:** `CORTEX_CLOSED_LOOP_SPEC.md` (stages 1–3 shipped 2026-11-16)
**Standard:** primary source URLs for all factual claims.

---

## 1. Executive verdict

The missing role is real, and the research converges on a specific answer: **a dedicated synthesis agent — the fleet's Planner — that reads findings and emits governed proposals, never executes.** Three independent traditions point to the same shape:

- **Agent products:** Devin's Fusion architecture runs a frontier "lead" that owns the plan, interpretation of ambiguity, and review while delegating execution to a sidekick — "the lead always reviews the work… and can take control back." (https://cognition.com/blog/local-fusion)
- **Multi-agent frameworks:** LangGraph's supervisor pattern puts a dedicated orchestrator agent in charge of routing and delegation — now the recommended pattern over handoff libraries. (https://docs.langchain.com/oss/python/langchain/multi-agent)
- **Incident command:** Google's SRE incident response assigns an Incident Commander who "commands and coordinates… does NOT do the technical work themselves" — with a separate Planning role that "turns objectives into a time-boxed plan and captures decisions and evidence." (https://sre.google/workbook/incident-response/, https://rootly.com/incident-response/incident-commander)

Cortex's REVIEWER is the wrong host for this — it is a *critic of artifacts* (diffs, files), not a *owner of decisions*. WARDEN detects but doesn't plan. The gap is a **decision layer**, and the correct design is a new agent — call it **STRATEGIST** (or PLANNER) — sitting between sensing and doing.

---

## 2. Role taxonomy — how "findings → action" works across systems

| Pattern | Mechanism | Adopters | Cortex fit |
|---|---|---|---|
| **Dedicated planner agent** | Separate agent reads findings, produces plan/proposals; humans or gates approve | Devin Fusion lead, LangGraph supervisor, SRE Planning/IC roles | ✅ Best fit — matches fleet's specialist-agent architecture |
| **Orchestrator-inline** | The routing layer itself decides next steps | LangGraph subagents pattern, CrewAI manager | ⚠️ Our runtime has no reasoning orchestrator — it's a task queue |
| **Proposal-type escalation** | Findings become typed proposals in an approval inbox; no dedicated agent | Our spawn proposals, builder vetoes, Arize Signal→PR (human merges) | ✅ Already exists — the synthesis role's *output* should be this |
| **Human-gated everything** | All findings surface to human; human is the synthesist | Early Copilot Studio, most current Cortex workflows | ⚠️ Current state — doesn't scale, user is the bottleneck |
| **Market/auction** | Agents bid on tasks | Research-stage (auction-based MAS papers) | ❌ Overkill |

**Key distinction the research surfaced:** synthesis is not just "summarizing findings" — it's *owning the decision rights*: what gets proposed, in what priority order, with what evidence, gated at what blast radius. SRE's IC "makes strategic decisions (escalation, external communication)… does NOT do the technical work." Devin's lead "owns the plan, interpretation of ambiguity, and review."

---

## 3. Per-system teardowns (the sense→decide→act path)

### Devin (Cognition)
- **Sense:** codebase index, session traces, Ask Devin Q&A
- **Decide:** Plan mode produces a Markdown plan file for approval; Fusion lead interprets ambiguity and reviews sidekick work
- **Act:** Agent mode executes; lead can take back control
- **Gate:** Plan approval before implementation; permission modes (Code/Smart/Ask/Plan/Bypass)
- **Lesson for Cortex:** the planner produces a *persistent artifact* (plan file) that survives across sessions — our proposals are ephemeral JSON

### LangGraph Supervisor
- **Sense:** agent outputs, handoff tools
- **Decide:** supervisor LLM routes to specialized agents via `transfer_to_*` tools; manages message history/context engineering
- **Act:** subagents execute; supervisor synthesizes results
- **Lesson:** supervisor is a *first-class graph node*, not a prompt hack — and LangChain now recommends the tool-calling supervisor pattern over the handoff library
- Sources: https://docs.langchain.com/oss/python/langchain/multi-agent, https://reference.langchain.com/python/langgraph-supervisor/supervisor/create_supervisor

### Google SRE Incident Response
- **Sense:** alerts, dashboards, reports
- **Decide:** Incident Commander owns objectives/strategy; Planning role builds time-boxed Incident Action Plan; severity levels drive resourcing
- **Act:** Ops Lead executes technical fixes — the *only* role allowed to change the system
- **Gate:** IC approves plan changes, resource moves, external comms; blameless postmortem action items get owners + due dates tracked to completion
- **Lesson:** "A postmortem whose actions are never done is just theatre" — synthesis output must have owners and verification, not just recommendations
- Sources: https://sre.google/workbook/incident-response/, https://sre.google/sre-book/postmortem-culture/, https://www.stephane-robert.info/en/docs/devsecops/reliability/incidents-postmortems/

### LangSmith Prompt Hub (versioned learnings reference)
- **Mechanism:** prompts are versioned commits with tags (`staging`/`production`); each version can be run against datasets/evaluators so history is "what changed AND whether it got better" — not just diffs
- **Lesson:** this is exactly what Cortex's `04 - Rules/` lacks — rules are append-only markdown with no version, no eval linkage, no retirement
- Sources: https://docs.langchain.com/langsmith/manage-prompts, https://teachyou.ai/blog/langsmith-prompt-hub

### Sierra (supvised agents)
- **Decide:** multiple supervisory agents per production agent — input filtering, output interception, always-on monitors; supervisors can escalate to humans; each monitor itself is evaluated against labeled conversations ("who monitors the monitors")
- **Lesson:** supervision is a measured component, not a static layer — Cortex's WARDEN has no self-eval yet (Stage 10 in closed-loop spec)
- Source: https://sierra.ai/blog/confidence-in-every-conversation, https://sierra.ai/blog/agent-monitoring

---

## 4. The recommendation: STRATEGIST — Cortex's synthesis agent

### Identity
**STRATEGIST** — the fleet's chief of staff / planner. Reads findings, owns prioritization, emits governed proposals. Never executes code, never modifies rules directly, never talks to users unprompted.

### What it reads (inputs — all already exist)
- `03 - Learnings/` outcome notes (now telemetry-enriched)
- `02 - Projects/` research briefs, repo scans
- A/B spec reports (`CORTEX_*_SPEC*.md`) — via file read or vault
- WARDEN patrol reports and alerts
- LIBRARIAN distill output (new rules awaiting review)
- Spawn proposals pending in Inbox
- Fleet snapshot (`/api/cortex/agents/state`)

### What it writes (outputs)
- **Action proposals** → existing initiative proposal path / Inbox (priority-ranked, evidence-cited)
- **Rule reviews** → verdicts on distilled rules: `keep | retire | needs-evidence` (writes to rules manifest)
- **Synthesis briefs** → vault notes connecting findings across sources ("SCOUT found X, WARDEN confirmed Y, converged recommendation: Z")
- **Escalations** → items requiring human decision, surfaced in Inbox with blast-radius classification

### What it can auto-execute (the earned-autonomy ladder)
| Action class | Authority |
|---|---|
| Write synthesis brief to vault | Auto (contained lane) |
| File action proposal to Inbox | Auto (reversible — human approves) |
| Retire a rule flagged `needs-evidence` twice | Auto after manifest gate |
| Submit tasks to other agents (e.g., "SCOUT, verify claim X") | Auto within dailyBudget |
| Modify rules, spawn agents, change worker prompts | NEVER — always proposal |

### How it's measured
- Proposal acceptance rate (human approves vs rejects)
- Rule verdict accuracy (retired rules that later prove needed = false positive)
- Findings→action latency (time from outcome note to proposal)
- Duplicate/suppressed proposal rate (spam metric — the key failure mode)

### Why not the alternatives
- **REVIEWER expansion:** reviewer is artifact-shaped (diff/file in → findings out). Synthesis is fleet-shaped (many signal types in → prioritized actions out). Different inputs, different outputs, different authority. Keep reviewer for code; add strategist for fleet.
- **Orchestrator function:** our runtime is a task queue, not a reasoning router — there's no supervisor LLM in the dispatch path. Building one is a bigger change than a new agent worker.
- **Human-gated only:** doesn't scale — the user is already the bottleneck; the whole point of the fleet is absorbing this load.

---

## 5. Stages 4–8 implementation spec (from CORTEX_CLOSED_LOOP_SPEC)

These ship *with* STRATEGIST — several are literally its job.

### Stage 4 — Rule measurement & retirement → STRATEGIST patrol kind
- `rules-manifest.json` in vault `04 - Rules/`: `{ruleId, file, created, sourceCluster, status: active|measuring|retired, injectedCount, outcomeDelta}`
- STRATEGIST periodic task (`strategist_review`, every ~20 outcomes): for each active rule, compare outcomes in its source cluster before/after rule creation
- Rules with no measurable improvement after N tasks → `status: retired`; `relevantRules` filters retired rules
- **File touchpoints:** `rules.ts` (manifest read + status filter), new `strategist.ts` worker, manifest JSON in vault

### Stage 5 — Failure → regression artifacts
- `distillLearnings` already clusters; extend it to also write `03 - Learnings/regression-<cluster>.md` — a checklist of the failure pattern
- Builder/reviewer system prompts inject the checklist for matching clusters (via `rulesBlock`-style retrieval on regression dir)
- **Touchpoints:** `workers.ts` distillLearnings, `rules.ts` (second retrieval dir)

### Stage 6 — Versioned learnings (rules manifest covers rules; extend to skills later)
- Manifest tracks rule versions: when a rule is superseded, old version marked `superseded-by` rather than deleted — audit trail
- Each outcome note could record which rules were injected (add `rulesInjected: [...]` to telemetry) — enables per-rule outcome attribution
- **Touchpoints:** `outcomes.ts` (record injected rule IDs), `rules.ts` (manifest), runtime telemetry

### Stage 7 — Scoped rules
- Extend manifest/rule notes with `scope: global | agent:<id> | kind:<kind>`
- `relevantRules(instruction, agentId)` filters: global + matching agent/kind scopes
- Scout-learned research rules reach scout + spawned researchers, not distributor
- **Touchpoints:** `rules.ts` signature change (add agentId), all `rulesBlock` call sites pass `ctx.task.agentId`

### Stage 8 — Skill library (defer mechanism, prepare storage)
- `skills/<kind>/<name>.md` vault dir: `{trigger, template, successCount, lastVerified, sourceTaskIds}`
- STRATEGIST promotes proven patterns (≥3 green outcomes same pattern) into skill notes
- `relevantRules` graduates to return rules + matching skills
- **This is the Voyager ceiling — build storage now, retrieval promotion later**

---

## 6. Five-question test

| Question | Answer |
|---|---|
| What is happening now? | STRATEGIST digest shows pending proposals, rule health, finding backlog — visible in Foundry roster + dossier |
| What changed because of learning? | Rules manifest status changes, retired rules, new skills — all versioned |
| Can I see the evidence? | Every proposal cites outcome filenames + cluster data; every rule verdict cites pre/post outcome comparison |
| Can I undo it? | STRATEGIST can't modify rules/prompts directly; proposals are rejectable; manifest supports un-retire |
| Does it make the fleet better or just busier? | Proposal acceptance rate + duplicate rate are the metrics; spam = failure signal |

---

## 7. Ranked recommendations

### MUST
1. **STRATEGIST worker** (`strategist.ts`) — reads learnings/outcomes/proposals, emits proposals + rule verdicts + synthesis briefs. ~1 day.
2. **Rules manifest** (`rules-manifest.json` + read/write helpers in `rules.ts`) — foundation for measurement/retirement/scoping. ~4h.
3. **Record injected rule IDs in outcome telemetry** — enables per-rule attribution. ~1h.

### SHOULD
4. **STRATEGIST review patrol** — periodic rule verdicts + proposal prioritization. ~1 day (part of #1).
5. **Failure→regression artifacts** in distillLearnings. ~3h.
6. **Scoped rules** — agentId param through rulesBlock call sites. ~half day.

### COULD
7. **Skill library storage + promotion** — vault dir + STRATEGIST promotion logic. ~2 days.
8. **STRATEGIST dossier visibility** — proposals authored, acceptance rate, rule verdicts in agent dossier. ~half day (pairs with NOW/RECORD/DOSSIER work).

---

## 8. Anti-patterns

- **Synthesist that executes.** SRE IC "does NOT do the technical work"; Devin lead delegates execution. STRATEGIST proposes, never executes — the moment it can act, it stops being a check on the fleet and becomes another thing to check.
- **Proposal spam.** The #1 failure mode of planner agents — every finding becomes a proposal and the Inbox drowns. Mitigate: dedupe by cluster, rate-limit proposals per cycle, require evidence threshold (≥2 corroborating sources or recurring outcomes).
- **Analysis without owners.** "A postmortem whose actions are never done is just theatre" — every STRATEGIST proposal must name an owner agent or `human` and a verification signal.
- **Rules that can't be retired.** Append-only learnings accumulate noise; Goodhart applies to rules too — a rule injected 100× with no outcome delta is dead weight.
- **Single synthesist bottleneck.** STRATEGIST output is only as good as its inputs — if outcome notes are sparse, its proposals are guesses. Universal capture (shipped today) is the prerequisite.

---

## 9. Source appendix

### Primary
- Devin Fusion architecture: https://cognition.com/blog/local-fusion
- Devin modes/planning: https://docs.devin.ai/desktop/devin-local/modes, https://docs.devin.ai/get-started/first-run, https://docs.devin.ai/learn-about-devin/prompting
- LangGraph multi-agent patterns: https://docs.langchain.com/oss/python/langchain/multi-agent
- LangGraph supervisor: https://reference.langchain.com/python/langgraph-supervisor/supervisor/create_supervisor, https://github.com/langchain-ai/langgraph-supervisor-py
- Google SRE incident response: https://sre.google/workbook/incident-response/
- Google SRE blameless postmortem: https://sre.google/sre-book/postmortem-culture/
- Incident commander role: https://rootly.com/incident-response/incident-commander
- Incident management guide: https://software-engineering-guide.github.io/software-engineering-guide/chapters/09-03-incident-management/
- LangSmith prompt management: https://docs.langchain.com/langsmith/manage-prompts, https://docs.langchain.com/langsmith/prompt-context-hub
- LangSmith prompt hub versioning: https://teachyou.ai/blog/langsmith-prompt-hub (secondary)
- Sierra supervision: https://sierra.ai/blog/confidence-in-every-conversation, https://sierra.ai/blog/agent-monitoring
- CrewAI memory: https://docs.crewai.com/edge/en/concepts/memory
- AutoGen task-centric memory: https://github.com/microsoft/autogen/tree/main/python/samples/task_centric_memory

### Carried forward from CORTEX_CLOSED_LOOP_SPEC.md
Voyager, Reflexion, ExpeL, ACE, GEPA, Agent Lightning, Arize AX Signal, LangSmith evals, CrewAI cognition memory — all sources listed there remain valid.
