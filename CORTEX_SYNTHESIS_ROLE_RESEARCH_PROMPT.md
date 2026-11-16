# RESEARCH PROMPT — The Missing Synthesis Role + Remaining Closed-Loop Stages

> **Purpose:** Produce `CORTEX_SYNTHESIS_ROLE_SPEC.md` — an elite, fact-based specification answering two linked questions:
> 1. What is the best architecture for the **missing synthesis/planning role** — the agent (or mechanism) that converts research briefs, A/B reports, patrol findings, distill outputs, and task outcomes into prioritized, governed action plans?
> 2. How do elite ecosystems implement the **remaining closed-loop maturity stages** — rule measurement/retirement, failure→regression artifacts, versioned learnings, scoped memory, and skill libraries?
>
> **Standard:** .01% research. Every factual claim needs a primary source URL. No SEO listicles as evidence. Unverifiable claims go in an explicit gap list.
> **Independent-run protocol:** External models/agents must NOT read `CORTEX_CLOSED_LOOP_SPEC.md`, `CORTEX_CLOSED_LOOP_SPEC.SCOUT.md`, `CORTEX_AGENT_DOSSIER_SPEC*.md`, or this repo's `src/lib/cortex-agents/` first. Save output as `CORTEX_SYNTHESIS_ROLE_SPEC.<model-name>.md`.

---

## 0. The observed gap (case study — read first)

Cortex's fleet today: SCOUT senses (web/social/repo research), LIBRARIAN remembers (vault, distill→rules), BUILDER writes code, REVIEWER critiques diffs, RUNNER executes commands, WARDEN patrols systems, DISTRIBUTOR publishes, FORECASTER predicts, PREP briefs meetings, plus spawned ephemeral agents.

**The missing role:** nothing converts *findings* into *action plans*. Concrete evidence from 2026-11-16:

- Two A/B research arms (dossier spec, closed-loop spec) produced reports containing MUST/SHOULD/COUED recommendations — a human had to read them and decide what to implement. No agent turned "SCOUT arm found X, Devin arm found Y, converged on Z" into a proposal.
- LIBRARIAN's `distillLearnings` writes rules to `04 - Rules/` — but nothing reviews whether a rule is still valid, whether it helped, or whether it should be retired.
- WARDEN patrols produce anomaly reports — alerts get written, but nothing owns "anomaly → diagnosed cause → proposed fix → verified resolution."
- REVIEWER exists but is scoped to code diffs only; it never sees research reports, specs, or fleet findings.

This is the classic **sense → decide → act** gap. Every healthy organization has a role that does it: flight director, incident commander, product manager, chief of staff. The question is what that role looks like for an agent fleet.

---

## 1. Cortex ground truth (verify against code, don't assume)

| Component | Where | Relevant behavior |
|---|---|---|
| Outcome capture | `src/lib/cortex-agents/outcomes.ts` | `recordAgentOutcome()` — universal, telemetry-enriched, just shipped |
| Rule retrieval | `src/lib/cortex-agents/rules.ts` | `relevantRules()`/`rulesBlock()` — token-overlap, last-40-files, now injected into ALL workers |
| Distillation | `workers.ts` `distillLearnings()` | clusters `agent+kind` outcomes, needs ≥3 notes + ≥2 non-green, writes ≤3 rules with evidence filenames |
| Spawn proposals | `/api/cortex/agents/spawn/propose` | agents propose new agents with evidence; human approves in Inbox |
| Task proposals | initiative proposal path | builder vetoes/tier-2 → proposal objects |
| Reviewer | `reviewerWorker` | code-diff critic only; no auto-dispatch; never sees reports/specs |
| Warden | `warden.ts` | read-only patrol; anomalies → terse alert; no diagnosis→fix→verify chain |
| Task runtime | `runtime.ts` | submitTask dedupe, budgets, telemetry, completion hook → outcome note + distill counter |

---

## 2. Research domains (all required, primary sources only)

### Domain A — The sense→decide→act routing pattern in agent products
How do Devin, Manus, ChatGPT agent, Claude Code, Copilot Studio, Agentforce, Sierra, Decagon, Relevance AI, Lindy, Zapier Agents route findings/reports/outputs into next actions? Specifically: is there a distinct "planner/synthesist" component, or does the orchestrator do it inline? What gets proposed vs auto-executed vs escalated? Cite product docs/engineering blogs.

### Domain B — Multi-agent topology: where does synthesis live?
Orchestrator-worker vs supervisor vs blackboard vs market-based patterns. Sources: AutoGen, CrewAI, MetaGPT, LangGraph supervisor docs, OpenAI Agents SDK handoffs, Google ADK, MCP/A2A specs, plus academic multi-agent topology papers. Key question: should synthesis be a dedicated agent, an orchestrator function, or a human-gated proposal type?

### Domain C — Incident command / OODA / flight-director analogues
NASA mission control flight director role, SRE incident command, military C2 decision cycles, hospital triage. What do these teach about a single role that owns "what happens next" across many sensors? Focus on: decision rights, escalation thresholds, span of control limits.

### Domain D — Closed-loop stages 4–8 implementation patterns
For each, find how real systems do it:
- **Rule/artifact measurement & retirement** — how do systems know a learned rule/prompt/skill still helps? (LangSmith experiment comparison, prompt versioning metrics, skill utilization stats)
- **Failure→regression artifacts** — trace-to-dataset pipelines (LangSmith, Arize, Braintrust)
- **Versioned learnings** — prompt registries, policy versioning, audit trails (LangSmith hub, Microsoft AGT, policy-as-code)
- **Scoped memory** — CrewAI scoped views, AutoGen memory controller, governed shared memory papers
- **Skill libraries** — Voyager retrieval mechanics, skill utilization/deprecation, compositional skills

### Domain E — The human-gate boundary
Where should synthesis output auto-execute vs require approval? Research: blast-radius classification, tiered autonomy, progressive delegation, "earned autonomy" patterns. Sierra supervisor escalation, Decagon approvals, Copilot Studio human-in-loop, Agentforce topics/guardrails.

### Domain F — Failure modes of synthesis roles
What goes wrong when a planner/synthesist agent exists: proposal spam, analysis paralysis, conflicting recommendations, optimizer capture (planner serves its own metrics), single-point bottleneck. Documented cases required.

---

## 3. Required deliverables in `CORTEX_SYNTHESIS_ROLE_SPEC.md`

1. **Role taxonomy** — every distinct "turn findings into action" pattern found, with mechanism, sources, adopters.
2. **Per-system teardowns** — top ~8 systems' sense→decide→act architecture.
3. **The recommendation** — for Cortex specifically: new agent (name it), REVIEWER expansion, orchestrator function, or hybrid. Must answer: what does it read, what does it write, what can it auto-execute, what needs approval, how is it measured.
4. **Stages 4–8 implementation spec** — concrete Cortex architecture for rule measurement/retirement, regression artifacts, rules manifest, scoping, skill library. Each with file-level touchpoints.
5. **Five-question test** + MUST/SHOULD/COULD ranking + anti-patterns + source appendix.

---

## 4. Hard rules

- No claim without URL. Distinguish documented mechanism from marketing.
- "Thin coverage" beats padding. If a domain lacks primary sources, say so.
- Cortex mapping must reference real files. "Unverified" beats guessing.
- The deliverable is a spec: tables over prose, every recommendation traceable.
