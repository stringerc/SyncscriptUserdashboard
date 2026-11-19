# CORTEX ENTERPRISE CONSOLE — SPEC (DEVIN leg)

> Bake-off entry. Every codebase claim verified by reading the file or
> hitting the live endpoint on 2026-11-18. External claims cite real URLs.

## 1. Decision: NEW rail view `ENTERPRISE`, not a PIPELINE evolution

PIPELINE today is a raw-JSON dump of `/api/cortex/distribution/status`
(`CortexFoundryNav.tsx` ~line 700). It answers "what's in the distribution
queue" — a single-question surface. The enterprise console answers a
different question: "how is each venture doing across tasks, goals,
calendar, agents, and evidence?" Overloading PIPELINE would make both
worse. Every comparable product converges on a dedicated portfolio layer
with drill-down (Klereti, Venture OS IC Dashboard, Atlas PMO, PortSight —
see §6).

## 2. The verified gap

**No venture dimension exists in the data model.** Confirmed by reading
`mission.ts`, the task schema, and the archive: goals, ops items, blocks,
and agent tasks cannot declare which venture they serve. BUT the
 Distribution queue already self-tags by venture in item types —
`omni_publish-*`, `govtech-*` (sam_gov_capture), `reddit_comment-*`,
`pinterest_pin-*` — verified live via
`GET /api/cortex/distribution/status` (35 done / 4 failed / 4 pending).
And `.cortex/reports/govtech/*.json` holds three real bid dossiers with
`noticeId`, `complianceMatrix`, `pWin`, `redTeamAudit` fields.

So: venture identity exists in *artifacts* but not in *mission state*.
The console's first job is making it first-class.

## 3. Data model — minimal, additive, honest

```
.cortex-runtime/ventures.json          ← venture registry (new)
  { id, name, charter, evidencePaths[], agentScopes[], createdAt }

ventureId?: string                     ← optional field added to:
  - mission goals        (goal objects)
  - mission ops items    (ops items)
  - mission blocks       (planned calendar blocks)
  - agent task input     (task.input.ventureId — no schema break)
```

- `ventureId` is **optional everywhere** — untagged work stays visible
  under an "UNTAGGED / FLEET" bucket rather than being silently dropped
  or force-fit. This preserves the honest-empty invariant.
- Distribution queue needs **zero changes** — venture is derivable from
  `type` prefix (`omni_*` → omni, `govtech-*`/`sam_gov_*` → govtech).
  Derivation beats migration: less state to keep truthful.
- Mission summary endpoint (`/api/cortex/agents/state` → mission block)
  gains `ventures: [{id, name, goals, opsDone, opsTotal, blocksToday,
  tasks24h, evidenceCount}]` computed from existing state — no new
  telemetry, just a rollup.

## 4. Seed registry (real evidence only)

| id | name | charter | evidence |
|---|---|---|---|
| `omni` | OMN-COMMERCE | Storefront products → distribution → sales | `storefront/distribution-queue.json`, `storefront/products/catalog-v2.json`, `omni_publish-*` queue items |
| `govtech` | GOVTECH CAPTURE | SAM.gov opportunity → p-win → compliant proposal | `src/lib/govtech/*`, `.cortex/reports/govtech/*.json`, `govtech-*`/`sam_gov_capture` queue items |
| `fleet` | CORTEX FLEET | The agent ecosystem itself (implicit) | task archive, mission state, incidents |

## 5. UI spec — ENTERPRISE rail view

Left rail gains `⬡ ENTERPRISE` between AGENTS and STANDUP.

**Level 1 — Portfolio strip** (always visible in panel):
- One card per venture: name, status lamp, `goals x/y`, `ops done/total`,
  `tasks 24h`, `queue pending`, `open incidents`
- **"NEEDS ATTENTION" ranked row** at top — the convergent pattern across
  every product studied: ventures sorted by (open incidents desc,
  stalled goals, pending proposals, stale ops). This is the killer
  feature; everything else supports it.
- UNTAGGED/FLEET card last, dimmed — honest about unscoped work.

**Level 2 — Venture detail** (click card → expands in place or swaps
panel):
- Goal progress bars (existing `goalProgress` math, filtered by ventureId)
- Today's planned blocks for that venture (times + titles)
- Last 10 archive tasks tagged to it (kind, status, age)
- Pending INBOX proposals whose instruction/evidence references it
- Distribution queue slice (derived from type prefix)
- For govtech specifically: latest dossier summary from
  `.cortex/reports/govtech/` (noticeId, pWin, compliance status) —
  read-only, evidence-linked

**States**: loading skeleton; honest-empty ("NO VENTURE-SCOPED WORK
YET — tag a goal or task") rather than mock numbers.

## 6. Prior art evaluated

| Source | What it proves | Adopt? |
|---|---|---|
| Klereti (klereti.com/solutions/portfolio-operators) | Per-venture isolated workspace + roll-up reporting + ⌘K switching | Pattern: venture-scoped views with shared shell — yes |
| Kolabs Portfolio Command Center | "Today's Attention" ranked queue + ownership + stale-data flags | Pattern: attention queue is THE feature — yes |
| Venture OS IC Dashboard (app.be-venture.partners) | Stat tiles by governance status, sortable venture table, score queue | Pattern: status-tile rollup — yes |
| Atlas PMO Command Center (github.com/aceymagallanes/atlas-pmo-command-center) | Portfolio RAG health + RAID + decision log | Pattern only — our incidents+proposals already cover it |
| CushLabs OS (cushlabs.ai/projects/cushlabs-OS-dashboard) | Multi-project consultancy dashboard; enrichment overlay merges live data + curated context at request time | Architecture pattern matches ours exactly — yes |
| PortSight (github.com/RaynishaJain/PortSight) | Health scores, risk heatmap, decision log, project ranking | Reject wholesale — different stack/auth model; borrow ranking idea |
| Sanctuary Parc OS (github.com/0xbeam/sanctuary) | Venture studio OS with per-project branch conventions + git hooks | Adopt the *idea*: venture-scoped branches (`venture/govtech-*`) — pairs with the new branch protection |
| Growth Forge Portfolio Dashboard | Stage-gate project comparison on consistent criteria | Pattern: compare ventures on shared metrics — yes |

**No repo adopted wholesale** — consistent with the agent-comms
verdict: Cortex already owns the primitives; these products validate
the *shape*, not the code.

## 7. Agent integration

- Task submission gains optional `input.ventureId`; workers pass it
  through to results so the archive carries the dimension
- `agent_message` envelopes gain optional `ventureId` for scoping
- Directives/proposals unchanged — venture is attribution, not authority
- Venture-scoped budgets: later phase — `budgetYieldReview` already
  computes per-agent yield; adding per-venture attribution is a
  rollup, not new machinery

## 8. Phased rollout

- **Phase 1 (honest-empty)**: ventures.json registry + ventureId fields +
  ENTERPRISE panel reading existing state. Ships with Omni+GovTech+Fleet
  seeded; ventures with no tagged work show zeroes, not invented metrics.
- **Phase 2**: tag in-flight work — strategist `goal_plan` outputs get
  ventureId; distribution items auto-derive; ops items taggable via API.
- **Phase 3**: venture detail drill-down + govtech dossier card +
  per-venture capacity/contention view (agent budget attribution).
- **Phase 4 (optional)**: venture-scoped agent routing — an agent's
  context window filtered to its venture's evidence.

## 9. Open questions for the Crew

1. Should `fleet` (Cortex itself) be a first-class venture card, or stay
   implicit background? (I seeded it — it's where most agent work lives.)
2. Naming: ENTERPRISE vs. VENTURES vs. PORTFOLIO for the rail label?
3. Do you want venture-scoped branches (`venture/govtech-proposal-x`)
   enforced for agent work, extending today's main-branch protection?
