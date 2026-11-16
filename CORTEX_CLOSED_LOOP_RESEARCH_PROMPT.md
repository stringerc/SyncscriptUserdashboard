# RESEARCH PROMPT — Closed-Loop Self-Improving Agent Ecosystems

> **Purpose:** Produce `CORTEX_CLOSED_LOOP_SPEC.md` — an elite, fact-based specification for how Cortex's agent fleet should close the learning loop so the ecosystem measurably improves with every task.
> **Standard:** .01% research. Every factual claim needs a primary source URL. No SEO listicles as evidence. Unverifiable claims go in an explicit gap list, not the body.
> **Independent-run protocol:** If you are an external model/agent executing this prompt, do NOT read `CORTEX_AGENT_DOSSIER_SPEC.md`, `CORTEX_AGENT_DOSSIER_SPEC.SCOUT.md`, or any prior Cortex spec first. Save output as `CORTEX_CLOSED_LOOP_SPEC.<model-name>.md`. Blind independence is what makes A/B comparison meaningful.

---

## 0. The case study that motivates this (read first)

On 2026-11-16 we ran an A/B experiment: the same agent-dossier research prompt was executed by (a) a frontier model and (b) our own SCOUT fleet (6 parallel `research` tasks, depth 3). Results:

- **Converged:** both arms independently identified the same core dossier elements (current action, progress, health, error reasons, timeline, progressive disclosure).
- **SCOUT fell short on:** source quality (SEO listicles vs primary docs), coverage (1/4 fleet products, 1/9 AI-employee vendors), one factual hallucination (wrong company attribution), and a structural ceiling (900-token output cap prevents spec-grade synthesis).
- **The loop did NOT close automatically.** The findings existed only in markdown reports. Nothing fed them back into agent behavior. We had to hand-write outcome notes into the vault before `distillLearnings` could even see them.

**The meta-lesson:** Cortex has the *bones* of a learning loop (outcome notes → clustering → distilled rules → prompt injection → warden patrols → spawn proposals) but it is leaky at every joint. This research must identify how the best systems make the loop *airtight, automatic, and compounding*.

---

## 1. Cortex's current architecture (ground truth — verify against code, don't assume)

Before recommending anything, ground yourself in what actually exists in `/Users/Apple/syncscript`:

| Component | Where | What it does today |
|---|---|---|
| Agent workers | `src/lib/cortex-agents/workers.ts` | sentinel, scout, librarian, builder, reviewer, runner, distributor, warden, forecaster, prep + spawned enterprise agents |
| Outcome notes | `~/.cortex/vault/03 - Learnings/agent-<id>-<kind>-<ts>.md` | Written on task completion with fields: Task / Outcome / Retry lineage / Summary |
| Distillation | `distillLearnings()` workers.ts ~L314 | Clusters outcomes by agent+kind; needs ≥3 notes AND ≥2 non-green signals; LLM distills ≤3 rules with evidence filenames; writes `04 - Rules/rule-*.md` |
| Rule injection | `relevantRules()` workers.ts ~L296 | Token-overlap scores last 40 rule notes; injects top 3 into **builder and runner prompts ONLY** |
| Warden | wardenWorker | Scheduled patrols producing findings/proposals |
| Spawn lifecycle | proposals → spawnSpec | Agents proposed, approved, spawned with TTL; lineage tracked on proposals |
| Narrative layer | `src/lib/narrative-synthesis.ts` | Tracks confidence vs outcomes, hallucination risk, abandoned strategies — but unclear if it feeds back to agents |
| Task telemetry | `AgentTaskClient` | status, progress, model, error, result, timing — no tokens/cost, no tool traces |

**Known leaks (already observed, verify and expand):**
1. `scoutWorker` does NOT call `relevantRules()` — research agents never see distilled rules.
2. `distillLearnings` requires recurring clusters — one-off experiments and frontier-model work bypass the loop entirely.
3. Outcome notes only written by runtime task completion; manual sessions, A/B arms, and failed dispatches leave no trace.
4. Rules are text injections, not versioned constraints — no measurement of whether a rule actually changed outcomes.
5. No feedback path from UI observations (e.g., "user noticed only 1 satellite") into agent behavior.

---

## 2. Research domains (all required, primary sources only)

### Domain A — Production agent observability → improvement loops
LangSmith (LangChain), Langfuse, Braintrust, Arize Phoenix/AX, Datadog LLM Observability, AgentOps, Galileo, Maxim, HoneyHive, AWS Bedrock AgentCore. For each: how do traces/evals become *datasets*, how do datasets become *experiments*, how do experiments change deployed prompts/agents? Cite their evals-and-datasets documentation specifically.

### Domain B — Self-improving agent architectures (research + product)
- **Skill/memory libraries:** Voyager (Minecraft skill library), Generative Agents memory stream, Reflexion, ExpeL, ACE (Agentic Context Engineering), Dynamic Cheatsheet
- **Prompt/optimizer loops:** DSPy (MIPRO, GEPA, BootstrapFewShot), TextGrad, OPRO, PromptBreeder
- **Production self-improvement:** Devin (Cognition) session learning, Manus, ChatGPT agent memory, Claude's context editing, Sierra, Decagon Duet, UiPath agent trace feedback, Microsoft Agent Lightning, AFlow/EvoAgent
- For each: what is the actual mechanism that makes the agent better over time — and what is merely marketing?

### Domain C — Failure detection → repair loops
How do systems detect *that* an agent is degrading (not just that a task failed)? Coverage: anomaly detection on trajectories, eval score drift, failure clustering (Arize AX "Signals"), circuit breakers, automatic rollback, human-in-the-loop escalation. Include chaos/fault-injection practices if documented.

### Domain D — Multi-agent fleet learning
When agents work in fleets (our case): do agents learn individually or collectively? Shared memory vs per-agent rules, cross-agent distillation, orchestrator-level learning, A2A protocol observability, swarm self-organization claims vs evidence. Sources: AutoGen/CrewAI/MetaGPT docs and papers, OpenAI Swarm/Agents SDK, Google ADK.

### Domain E — The trust/calibration constraint
Self-improvement loops can decay trust if they change behavior silently. Research: how do systems version prompts/policies, A/B test agent changes, maintain audit trails of *why the agent changed*, and let humans approve self-modifications? Sierra's supervisor model, constitutional AI approaches, model cards for agents.

### Domain F — Honest limits
Find documented cases where self-improvement loops FAILED or plateaued: Goodhart's law on eval metrics, memory poisoning, prompt drift, self-reinforcing hallucination loops, catastrophic forgetting in agent memory. Cite postmortems, papers, or engineering blogs.

---

## 3. Required deliverables in `CORTEX_CLOSED_LOOP_SPEC.md`

1. **Loop maturity model** — stages from "no learning" → "outcome notes" → "distilled rules" → "measured rule impact" → "automatic prompt/policy versioning" → "fleet-level collective learning." Place Cortex on it honestly, place each comparator on it.
2. **Mechanism taxonomy** — every distinct closed-loop mechanism found, with: name, how it works, source URL, which systems use it, evidence of effectiveness (or explicit "unproven").
3. **Per-system teardowns** — top ~10 systems, each: the loop architecture, what feeds it, what it outputs, how changes are gated, sources.
4. **Cortex gap analysis** — map each mechanism to our actual code. For each: EXISTS / PARTIAL / MISSING / NOT-APPLICABLE, with file references.
5. **The airtight loop proposal** — a concrete architecture for Cortex covering:
   - Capture: every task/experiment/manual session produces outcome notes automatically (including non-runtime work)
   - Cluster: recurring patterns surface without waiting for arbitrary thresholds
   - Distill: rules AND prompt fragments AND capability changes — not just text rules
   - Inject: rules reach ALL agent types that need them (fix the scoutWorker gap class of bug systematically)
   - Measure: every injected rule/rule-set has an outcome metric; rules that don't help get retired
   - Gate: self-modifications above a blast-radius threshold require Warden/human approval
   - Version: prompt/policy changes are versioned and reversible
   - Collective: what (if anything) should be shared across agents vs kept per-agent
6. **Five-question test** — does every recommendation answer: what is happening now, what changed because of learning, can I see the evidence, can I undo it, does it make the fleet better or just busier?
7. **Ranked recommendations** — MUST / SHOULD / COULD with effort estimates and which Cortex component each touches.
8. **Anti-patterns** — specific things NOT to build, with sources.
9. **Source appendix** — every URL used, labeled primary/secondary.

---

## 4. Hard rules

- No claim without a URL. "LangSmith has evals" → link the evals doc. "Voyager has a skill library" → link the paper/repo.
- Distinguish **documented mechanism** from **vendor marketing claim**. If a vendor says "self-improving" but documents no loop, say so.
- If a domain yields thin primary sources, say "thin coverage" — do not pad with listicles.
- Cortex mapping must reference real files/functions. If you haven't read the code, say "unverified" rather than guessing.
- The deliverable is a spec, not an essay. Tables over prose. Every recommendation traceable to a source or to observed Cortex behavior.
