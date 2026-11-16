# CORTEX CLOSED-LOOP SPEC — Self-Improving Agent Ecosystem

**Author:** Devin (frontier-model arm)
**Date:** 2026-11-16
**Prompt:** `CORTEX_CLOSED_LOOP_RESEARCH_PROMPT.md`
**A/B counterpart:** `CORTEX_CLOSED_LOOP_SPEC.SCOUT.md` (independent SCOUT fleet run)
**Standard:** every factual claim carries a primary source URL; marketing claims are labeled as such; unverified items are in §8.

---

## 1. Executive verdict

Cortex has the **skeleton** of a learning loop — outcome notes, clustering, rule distillation, prompt injection, warden patrols — but it is a **open-loop-with-leaks** system, not a closed loop. The research is unambiguous about what "closed" requires, and every elite system converges on the same architecture:

> **Capture → Curate → Retrieve → Measure → Gate → Version.**

The single most important finding across all six research domains: **no successful system treats "distilled text rules injected into prompts" as the learning mechanism.** Every production-grade loop stores *structured, retrievable artifacts* (skills, trajectories, eval datasets, context playbooks) and *measures whether retrieval improved outcomes*. Cortex currently does step 3 of 6 and skips measurement entirely.

---

## 2. Loop maturity model

| Stage | Capability | Cortex today | Exemplars |
|---|---|---|---|
| L0 No learning | Stateless tasks | — | — |
| L1 Outcome notes | Task results recorded | ✅ `03 - Learnings/agent-*.md` | All observability platforms |
| L2 Clustered distillation | Recurring patterns → rules | ⚠️ `distillLearnings` — needs ≥3 same agent+kind, ≥2 non-green | LangSmith datasets |
| L3 Rule injection | Learnings reach prompts | ⚠️ builder/runner only; scout/librarian/etc. excluded | Reflexion episodic buffer |
| L4 Structured skill store | Reusable executable/natural artifacts, not just prose rules | ❌ rules are flat markdown, no retrieval ranking beyond token overlap | Voyager skill library |
| L5 Outcome measurement | Every injected artifact has a measured effect | ❌ no linkage between rule → outcome delta | LangSmith experiments, DSPy metrics |
| L6 Versioned self-modification | Prompt/policy changes versioned, diffed, reversible, gated | ❌ rules are append-only files | LangSmith prompt hub commits/tags |
| L7 Collective learning | Fleet shares validated learnings with per-agent scoping | ❌ rules are global-by-token-match only | CrewAI shared memory + scoped views |
| L8 RL/optimizer loop | Trajectories → automatic prompt/policy optimization | ❌ | GEPA, Agent Lightning |

**Cortex sits at L2–L3 with leaks.** The path to L5–L6 is where all the value is; L7–L8 are where the frontier is.

---

## 3. Mechanism taxonomy (what actually works, with sources)

### 3.1 Trace → Dataset → Experiment → Deploy (the observability loop)

**LangSmith** documents the canonical production loop: traces → datasets (curated test cases from production failures) → evaluators (human/code/LLM-judge/pairwise) → experiments (run app version against dataset) → compare → ship. Both offline (pre-ship) and online (production traffic) evaluation are first-class. Sources: https://docs.langchain.com/langsmith/evaluation, https://docs.langchain.com/langsmith/evaluate-llm-application

**Key mechanism:** *a production failure becomes a permanent regression test.* This is the loop Cortex lacks — our outcome notes are write-only; nothing converts a failure into a test that future changes must pass.

### 3.2 Verbal reinforcement / episodic reflection

**Reflexion** (NeurIPS 2023): agents store self-reflections on failures in an episodic buffer and retry with that context — 91% pass@1 on HumanEval vs GPT-4's 80%, no weight updates. Source: https://arxiv.org/abs/2303.11366

**Mechanism:** failure → natural-language reflection → stored → retrieved on similar future tasks. Cortex's outcome notes are *descriptive* (what happened); Reflexion's are *prescriptive* (what to do differently). Our `distillLearnings` does produce prescriptive rules — but only after 3+ clustered failures, and only for builder/runner.

### 3.3 Experiential learning with insight extraction

**ExpeL** (AAAI 2024 oral): agent autonomously gathers experiences, extracts *insights* (natural-language lessons) and recalls them as in-context examples at inference — performance improves consistently as experiences accumulate, including transfer to new tasks. Source: https://arxiv.org/abs/2308.10144

**ACE** (ICLR 2026): treats context as an *evolving playbook* — generator produces trajectories, reflector critiques successes vs failures, curator incrementally updates a structured context store. Explicitly solves "context collapse" (iterative rewriting erodes knowledge) via incremental updates. +10.6% on agent benchmarks, works without labels using execution feedback. Sources: https://arxiv.org/abs/2510.04618, https://ace-agent.github.io/

**Mechanism:** the *playbook/context itself* is the learned artifact — richer than isolated rules. Cortex's `04 - Rules/` is a proto-playbook but lacks the reflector/curator structure and collapse protection.

### 3.4 Executable skill libraries

**Voyager** (NVIDIA et al.): automatic curriculum + ever-growing skill library of *executable code* + iterative prompting with environment feedback, execution errors, and self-verification. Skills are compositional, retrievable by embedding, and transfer to new worlds. 3.3× more unique items, 15.3× faster tech-tree progress vs prior SOTA. Sources: https://arxiv.org/abs/2305.16291, https://github.com/MineDojo/Voyager

**Mechanism:** learnings stored as *callable artifacts*, not prose. This is the ceiling above text rules — a Cortex equivalent would be worker-level reusable routines (e.g., a proven research query template, a proven browser-automation sequence) stored and retrieved like Voyager's skills.

### 3.5 Prompt optimization via reflection (GEPA/DSPy)

**GEPA** (ICLR 2026): reflective prompt evolution — samples trajectories, reflects in natural language on what went wrong, proposes prompt updates, maintains a Pareto frontier of candidates. Outperforms GRPO by 6pp avg (up to 20pp) with up to 35× fewer rollouts; beats MIPROv2 by 10pp+. Key: uses *textual feedback* (error messages, failed parses) not just scalar rewards. Sources: https://arxiv.org/abs/2507.19457, https://dspy.ai/current/diving-deeper/gepa-in-depth/

**Mechanism:** the optimizer needs *rich textual feedback per failure* — our outcome notes have a `Summary` field but no structured failure-class/trace. Without trajectory-level feedback, GEPA-style optimization can't run on Cortex.

### 3.6 Production failure detection → fix pipeline

**Arize AX Signal:** managed agent scans production traces on a schedule, groups recurring failure patterns into *ranked issues* with evidence (trace IDs), likely cause, and a *proposed fix* (prompt/code/config/eval change). Distinguishes known issues from emerging patterns. Can open GitHub PRs — but **developers review and merge; managed agents never deploy directly**. Sources: https://arize.com/products/signal, https://arize.com/docs/ax/observe/signal

**Mechanism:** this is exactly what our WARDEN patrols *should* become — currently warden produces findings but there's no evidence-linked issue ranking or proposed-fix artifact.

### 3.7 Always-on supervision (Sierra)

**Sierra** runs multiple supervisory agents per production agent: input filtering (threat/jailbreak detection), real-time output interception (policy compliance, tone), and always-on monitors (LLM-as-judge reviewing *every* conversation). Supervisors can escalate to humans. Crucially: "who monitors the monitors" — each monitor itself goes through an evaluation loop against team-labeled conversations until models agree. Sources: https://sierra.ai/blog/confidence-in-every-conversation, https://sierra.ai/blog/enterprise-grade-agents, https://sierra.ai/blog/agent-monitoring

**Mechanism:** supervision is itself a measured, evaluated component — not a static rule layer. Cortex's WARDEN is the proto-supervisor but has no per-monitor eval.

### 3.8 Shared fleet memory with scoped views

**CrewAI Cognition Memory:** one shared memory pool; agents share by default but can have private scopes; agents proactively `remember`/`recall` as tools; different recall weightings per role (planner weights importance, executor weights recency). Source: https://crewai.com/blog/how-we-built-cognitive-memory-for-agentic-systems, https://docs.crewai.com/edge/en/concepts/memory

**AutoGen task-centric memory:** agents learn from user advice, corrections, demonstrations, and their own experience via a `MemoryController` storing task-insight pairs. Source: https://github.com/microsoft/autogen/tree/main/python/samples/task_centric_memory

**Mechanism:** *one pool, scoped visibility, agent-controlled recall.* Cortex's vault is shared but rules injection is global-by-token-match — no per-agent scoping, no agent-initiated recall.

### 3.9 RL on real harnesses (the frontier)

**Agent Lightning** (Microsoft, v1.0): RL training with ZERO agent code changes — agents run as K8s jobs, a proxy captures trajectories, verl/vLLM trains the policy. Qwen3.5-9B improved 41.8%→56.4% on SWE-bench Verified with ~6K samples. Source: https://arxiv.org/abs/2508.03680, https://github.com/microsoft/agent-lightning

**Mechanism:** this is L8 — requires trajectory capture at the harness level (our `telemetry.llmCalls/tokensIn/toolCalls` fields are the seeds of this, currently under-instrumented).

---

## 4. Documented failure modes (what kills self-improvement loops)

| Failure | Evidence | Cortex exposure |
|---|---|---|
| **Eval Goodhart** — eval set becomes optimization target, scores rise while production degrades | https://thehardparts.dev/failure-modes/eval-goodhart, https://www.scien.cx/2026/06/21/goodharts-law-comes-for-your-agent-evals-why-your-green-dashboard-stops-meaning-anything/ | HIGH — our "rules" have no held-out measurement at all |
| **Eval-set drift** — offline scores improve, production gets worse; user behavior + model upgrades shift the distribution | https://tianpan.co/blog/2026/04/27/eval-set-as-simulator-drift | HIGH — no production signal tied to rule changes |
| **Context collapse / brevity bias** — iterative context rewriting erodes detail over time | ACE paper https://arxiv.org/abs/2510.04618 | MEDIUM — `relevantRules` slices rule text to 220 chars; repeated distillation could compress knowledge |
| **Self-reinforcing hallucination** — agent learns its own errors as "truth" | Documented risk in self-training literature; ACE/GEPA mitigate via execution feedback + Pareto diversity | MEDIUM — distillLearnings has an evidence-filename gate (good) but no outcome verification that rules helped |
| **Memory poisoning** — adversarial or wrong "learnings" persist and compound | CrewAI/memorygraph docs acknowledge scope controls as mitigation | MEDIUM — rules are global, unscoped, append-only, never retired |
| **Supervisor blind spots** — the monitor itself drifts | Sierra "who monitors the monitors" https://sierra.ai/blog/agent-monitoring | HIGH — WARDEN has no self-eval |
| **Metric lag** — standard metrics miss 4/7 production failure modes entirely, detect 3 others only after multiple cycles | https://arxiv.org/html/2605.01604 | HIGH — we have no production eval framework at all |

---

## 5. Cortex gap analysis (verified against code)

| Mechanism | Status | Evidence |
|---|---|---|
| Outcome notes on task completion | ✅ EXISTS | `agent-*.md` in `03 - Learnings/`, written by runtime |
| Outcome notes for non-runtime work (A/B arms, manual sessions, failed dispatches) | ❌ MISSING | Had to hand-write 6 notes for the dossier A/B |
| Clustered distillation | ⚠️ PARTIAL | `distillLearnings()` workers.ts ~L314 — ≥3 notes, ≥2 non-green, ≤3 rules, evidence-filename gate |
| Rule injection into prompts | ⚠️ PARTIAL | `relevantRules()` workers.ts ~L296 — builder (~L863) + runner (~L1086) ONLY; scout/librarian/sentinel/distributor/warden/forecaster/prep + spawned agents get nothing |
| Rule retrieval quality | ⚠️ WEAK | deterministic token-overlap, last-40-files window, 220-char truncation — no semantic ranking, no usage stats |
| Rule retirement/measurement | ❌ MISSING | Rules are append-only; nothing measures whether an injected rule changed outcomes |
| Failure → regression test | ❌ MISSING | No dataset/test artifact is created from failures |
| Structured skill store | ❌ MISSING | No executable/natural-language skill library; rules are the only artifact type |
| Trajectory-level feedback for optimization | ❌ MISSING | `AgentTaskClient.telemetry` has llmCalls/tokensIn/toolCalls counters but no per-call traces or failure-class detail beyond `telemetry.failureClass` |
| Per-agent scoped memory | ❌ MISSING | Rules vault is global; `relevantRules` has no agentId parameter |
| Supervisor self-evaluation | ❌ MISSING | WARDEN patrols produce findings; no eval of warden's own precision/recall |
| Human approval gate for self-modification | ⚠️ PARTIAL | Spawn proposals have approval flow; rule distillation writes directly with no gate |
| Versioning/reversibility of learnings | ❌ MISSING | Rules are files with timestamps; no diff, no rollback, no "which rules were active when" |
| Collective vs individual learning | ❌ UNRESOLVED | Rules are global — every agent gets the same top-3 by token match; no mechanism to scope a scout-learned rule to scout only |

---

## 6. The airtight loop proposal (Cortex architecture)

Ordered by dependency. Each stage names the Cortex component it touches.

### Stage 1 — Universal capture (fixes the biggest leak)
Every task outcome must produce an outcome note **regardless of origin**: runtime tasks (already works), manually-dispatched research arms, failed dispatches, warden findings that result in action, UI-initiated experiments. Concretely: a `recordOutcome(agentId, kind, title, outcome, summary)` helper in `workers.ts` (or a new `src/lib/cortex-agents/outcomes.ts`) that any code path can call — not just the runtime completion hook. The A/B dossier experiment proved this is needed: 6 real outcomes existed only because I hand-wrote them.

### Stage 2 — Rule injection for ALL workers
`relevantRules(instruction, agentId)` — add agentId param, inject into every worker's LLM call (scout, librarian, sentinel, distributor, warden, forecaster, prep, spawned). One-line-per-worker change; the function already exists. This is the single highest-leverage fix: today the fleet's research arm literally cannot learn from its own distilled rules.

### Stage 3 — Structured outcome notes
Extend outcome notes with fields the distiller can cluster on: `failureClass` (already in telemetry), `durationMs`, `tokensIn/tokensOut` (already in telemetry), `model`, `retryLineage`. The data exists in `AgentTaskClient.telemetry` — it's just not written to the note. Enables clustering by failure mode, not just agent+kind.

### Stage 4 — Rule measurement (close the loop)
When a rule is written, tag it with the cluster it came from. After N tasks in that cluster, compare post-rule outcomes vs pre-rule outcomes. Rules with no measurable improvement get flagged for retirement. This is the LangSmith experiment loop at fleet scale — crude but honest. WARDEN can run this as a patrol kind.

### Stage 5 — Failure → test artifact
When `distillLearnings` finds a qualifying cluster, ALSO write a `03 - Learnings/regression-<cluster>.md` capturing the failure pattern as a checklist. Builder/reviewer prompts inject the checklist alongside rules. This is the "production failure becomes a permanent test" mechanism — currently absent.

### Stage 6 — Versioned learnings
Rules directory gets a manifest: `rules-manifest.json` tracking {ruleId, created, sourceCluster, status: active|retired|measuring, injectedCount, outcomeDelta}. Enables rollback (retire a harmful rule) and audit (which rules were active when a task ran). Cheap: a JSON file + writeNote wrapper.

### Stage 7 — Scoped memory (fleet learning, done right)
`relevantRules(instruction, agentId, scope)` where scope ∈ {global, agent-private, cluster-shared}. Scout-discovered research-quality rules should reach scout + researcher-type spawned agents, not distributor. CrewAI's model: one pool, scoped views, agent-controlled recall. Start with two scopes (global + agent-private) — don't over-build.

### Stage 8 — Skill library (the Voyager ceiling)
For worker kinds with repetitive structure (research queries, browser automation sequences, distill prompts), store *proven templates* as skills in the vault: `skills/<kind>/<name>.md` with {trigger description, template, successCount, lastVerified}. `relevantRules` graduates to `relevantContext` returning rules AND skills. This is L4 — the jump from "learned prose" to "learned capability."

### Stage 9 — Trajectory capture for future optimization
Enrich `AgentTaskClient.telemetry` to store per-LLM-call records {tier, tokensIn, tokensOut, latencyMs, failureClass?} in a rolling per-task buffer (cap ~50 calls). This is the data GEPA/Agent-Lightning-style optimization needs. Defer the optimizer itself — capture first, optimize later.

### Stage 10 — WARDEN self-evaluation
WARDEN findings get outcome-tracked like everything else: did the flagged issue get acted on? Did the action resolve it? WARDEN's own precision becomes a measurable metric. Sierra's "who monitors the monitors" — the supervisor is itself evaluated.

### What NOT to build yet
- **RL fine-tuning (Agent Lightning style)** — requires trajectory infra (Stage 9) plus training pipeline; 6-12 months out. Capture the data now, decide later.
- **Automatic prompt deployment** — every self-modification above rule-injection level goes through Warden/human approval (Arize Signal's model: agents propose fixes, humans merge).
- **Cross-fleet shared memory beyond vault** — one pool (the vault) with scopes is enough; don't build a second memory system.

---

## 7. Five-question test

| Question | Does the proposal answer it? |
|---|---|
| What is happening now? | Outcome notes + telemetry already show it; Stage 3 enriches notes with failureClass/duration/tokens |
| What changed because of learning? | Rules manifest (Stage 6) + rule injection logs; visible in dossier "active rules" count |
| Can I see the evidence? | Every rule cites outcome filenames (existing gate); Stage 4 adds outcome deltas |
| Can I undo it? | Rules manifest status:retired; skills versioned; no auto-deployment |
| Does it make the fleet better or just busier? | Stage 4 measurement retires rules that don't help; Stage 10 evaluates the evaluator |

---

## 8. Ranked recommendations

### MUST (this sprint — all <1 day each)
1. **Inject `relevantRules` into all workers** — add agentId param, call in scout/librarian/sentinel/distributor/warden/forecaster/prep workers. Fixes the biggest leak. ~2h.
2. **Universal `recordOutcome` helper** — extract outcome-note writing into a callable function; runtime hook uses it; document it for manual/agent use. ~3h.
3. **Enrich outcome notes** — add failureClass, durationMs, tokensIn/Out, model from `task.telemetry` at write time. ~1h.

### SHOULD (next sprint)
4. **Rules manifest** — `rules-manifest.json` with status tracking; retirement flag. ~4h.
5. **Rule measurement patrol** — WARDEN kind comparing pre/post-rule outcomes per cluster. ~1 day.
6. **Failure → regression checklist** — distillLearnings writes a checklist artifact alongside rules. ~3h.

### COULD (quarter)
7. **Scoped rules** — agent-private vs global rule visibility. ~1 day.
8. **Skill library** — proven templates for repetitive worker kinds. ~3 days.
9. **Trajectory buffer** — per-LLM-call records in telemetry for future optimization. ~1 day.
10. **Warden self-eval** — track warden finding precision over time. ~2 days.

---

## 9. Anti-patterns (do NOT build)

- **Text-rule-only learning.** Every elite system stores structured retrievable artifacts (skills, trajectories, datasets, playbooks). Prose rules are the weakest form. (Voyager, ACE, LangSmith all agree.)
- **Unmeasured self-modification.** A rule that can't show outcome improvement is a hypothesis, not knowledge. (LangSmith experiment loop, Arize Signal proposed-fix review.)
- **Global unscoped memory.** One-size-fits-all rule injection ignores that a research-quality lesson is irrelevant to a distributor. (CrewAI scoped views.)
- **Automatic deployment of learned changes.** Arize Signal: "managed agents do not deploy directly to production." Cortex should match — propose, gate, version, never silent-auto-apply above rule level.
- **Eval sets as static artifacts.** They drift; they become Goodhart targets. (thehardparts.dev, tianpan.co, scien.cx.)
- **Learning from own outputs without execution feedback.** GEPA/ACE both emphasize *environmental/execution* feedback over self-critique alone — self-critique reinforces hallucination. (ACE paper, GEPA paper.)

---

## 10. Source appendix

### Primary (papers/docs/repos)
- Reflexion: https://arxiv.org/abs/2303.11366
- Voyager: https://arxiv.org/abs/2305.16291 · https://github.com/MineDojo/Voyager
- ExpeL: https://arxiv.org/abs/2308.10144 · https://github.com/LeapLabTHU/ExpeL
- ACE: https://arxiv.org/abs/2510.04618 · https://ace-agent.github.io/
- GEPA: https://arxiv.org/abs/2507.19457 · https://dspy.ai/current/diving-deeper/gepa-in-depth/
- Agent Lightning: https://arxiv.org/abs/2508.03680 · https://github.com/microsoft/agent-lightning
- LangSmith evals: https://docs.langchain.com/langsmith/evaluation · https://docs.langchain.com/langsmith/evaluate-llm-application
- CrewAI memory: https://docs.crewai.com/edge/en/concepts/memory · https://crewai.com/blog/how-we-built-cognitive-memory-for-agentic-systems
- AutoGen task-centric memory: https://github.com/microsoft/autogen/tree/main/python/samples/task_centric_memory
- Arize AX Signal: https://arize.com/products/signal · https://arize.com/docs/ax/observe/signal · https://arize.com/blog/debug-production-ai-agents-with-signal-tutorial/
- Sierra supervision: https://sierra.ai/blog/confidence-in-every-conversation · https://sierra.ai/blog/enterprise-grade-agents · https://sierra.ai/blog/agent-monitoring
- Production agentic eval framework: https://arxiv.org/html/2605.01604

### Secondary (failure-mode analysis — labeled as such)
- Eval Goodhart: https://thehardparts.dev/failure-modes/eval-goodhart
- Eval-set drift: https://tianpan.co/blog/2026/04/27/eval-set-as-simulator-drift
- Goodhart's law for agent evals: https://www.scien.cx/2026/06/21/goodharts-law-comes-for-your-agent-evals-why-your-green-dashboard-stops-meaning-anything/
- AI incident postmortem template: https://www.aievals.co/learn/production/incident-response

---

## 11. What this means for the dossier work

The NOW/RECORD/DOSSIER dossier spec is unaffected — it answers "what is this agent doing," not "how does the fleet learn." But Stage 6 (rules manifest) gives the dossier a new element: **active learnings count** per agent — "this agent is operating under 4 distilled rules" — which is exactly the kind of trust signal the dossier research said elite products show. Add it to the DOSSIER zone when we implement.
