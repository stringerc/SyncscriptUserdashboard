# CORTEX ENTERPRISE CONSOLE — SPEC (RESEARCH SKILL LEG)

> Research leg: Cortex `research` skill. Method: verified codebase claims by
> direct file reads + external pattern survey (portfolio command centers,
> multi-project mission control, PE portfolio dashboards). All citations real.

## 0. VERIFIED GROUND TRUTH (read, not assumed)

- **No venture dimension exists.** `grep ventureId src/lib/cortex-agents/mission.ts
  runtime.ts src/lib/cortex-counsel.ts` → zero hits. `venture` appears only in
  `src/utils/goal-templates.ts` (unrelated). Tasks, goals, blocks, messages,
  proposals are all venture-blind today.
- **Omni is real**: `storefront/` (GUMROAD_LAUNCH_LOG.md, OMNI_STORE_SYNDICATION_*.md,
  TRAFFIC_PLAYBOOK.md, `distribution-queue.json`, `distribution-dashboard.html`).
- **GovTech is real**: `src/lib/govtech/` (compliance-matrix.ts, p-win-evaluator.ts,
  proposal-foundry.ts, sam-types.ts) + `.cortex/reports/govtech/` with live bid
  dossiers: FA8811-26-Q-0310.json, TRADEWINDS-CSO-2026-01.json, W911QX-26-Q-0042.json.
- **Surfaces that already exist**: Foundry left-rail views (TASKS/GOALS/CALENDAR/
  COUNSEL/COMMS/INBOX), `/api/cortex/mission`, `/api/cortex/agents/state`,
  PIPELINE panel, task archive `.cortex-runtime/task-archive.jsonl`.

## 1. EXTERNAL EVIDENCE

| Source | What it proves |
|---|---|
| kolabs.design Portfolio Command Center | Holding-level pattern: ranked "Today's Attention" queue, RAG heatmap company×metric, explicit ownership, stale-data flags, board export packs. Attention-queue-first, not grid-first. |
| klereti.com portfolio-operators | Workspace-per-entity isolation + ⌘K instant switching + roll-up reporting across entities. Same layout, different data. |
| joescharf/pm (GitHub) | Multi-repo CLI + health scoring (0-100 across git/activity/issues/releases) + embedded dashboard. Health-score composite is the transferable idea. |
| goktugozdem2/hermes-cockpit | Multi-project mission control for agent fleets: health cards, blocked/waiting/ready-to-ship states, cross-project alert queue, agent timeline. Closest analog to Cortex. |
| aceymagallanes/atlas-pmo-command-center | Portfolio dashboard: per-project RAG health, overdue work, critical risks, pending decisions, milestones — one view. |
| apps3k-com/orchid-dev-dashboard | Cross-repo PR board grouped by *status* (blocked/checks-failing/ready), not by repo first. Status-first IA. |
| hyphadev PE dashboard / Decision Tree 49-PortCo case | Standardized data model across entities is the hard part, not the UI. Roll-up requires identical metric definitions per entity. |

**Convergent finding**: every serious multi-entity console is (a) attention-queue
first, (b) entity-switcher second, (c) roll-up metrics third. None lead with a
grid of projects. Status taxonomy (blocked/waiting/ready/failed) is universal.

## 2. DECISION: hybrid — extend Foundry rail, do NOT build a new app surface

**Decision: hybrid.** A new `VENTURES` view in the Foundry left rail + a venture
scope chip/filter inside existing TASKS/GOALS/CALENDAR panels. Reject a standalone
page (duplicates the rail pattern, splits attention) and reject PIPELINE-only
(Pipeline is product-flow shaped, not entity-shaped — forcing ventures into it
would corrupt its semantics).

Reasoning: the rail already solved "one screen, many lenses." Ventures are a
*scope dimension*, not a new lens — the correct UX is scoping the existing lenses
(All Ventures / Omni / GovTech / Cortex-internal), exactly like the ALL/AGENTS/USER
filter already shipped in TASKS. Klereti's "same layout, different data" and
Orchid's "status-first" both confirm: scope-switcher + attention queue beats grid.

## 3. DATA MODEL

```ts
// .cortex-runtime/ventures.json — registry (new file, append-audited)
interface Venture {
  id: string;                    // 'omni' | 'govtech' | 'cortex-internal'
  name: string;                  // 'OMNI' | 'GOVTECH' | 'CORTEX'
  callSign: string;              // display
  status: 'active' | 'dormant' | 'archived';
  evidencePaths: string[];       // real dirs/files proving the venture exists
  metrics?: {                    // only what we can actually compute
    openTasks?: number; overdueTasks?: number;
    activeGoals?: number; pendingProposals?: number;
    lastActivityAt?: number;
  };
  budgetShare?: number;          // optional: fraction of fleet budget attributed
  notes?: string;
}
```

**Field additions (minimal, backward-compatible):**
- `ventureId?: string` on task records in agents-state/mission blocks/proposals —
  optional everywhere; absent = `cortex-internal` (default scope, zero migration
  risk). No existing data needs rewriting; the field simply starts appearing on
  new tasks.
- `ventureId` on goals in mission.json — same optional pattern.
- Messages/directives carry `ventureId` only when scoped; unscoped = broadcast.

**Migration path**: none required. Read paths treat missing `ventureId` as
`cortex-internal`. Write paths stamp it when the submitting context knows the
venture (distribution queue items → omni; govtech proposal tasks → govtech).

## 4. VENTURE REGISTRY — seed entries (evidence-backed, no invented metrics)

```json
[
  { "id": "omni", "name": "OMNI", "status": "active",
    "evidencePaths": ["storefront/", "storefront/distribution-queue.json",
      "storefront/GUMROAD_LAUNCH_LOG.md", "storefront/TRAFFIC_PLAYBOOK.md"] },
  { "id": "govtech", "name": "GOVTECH", "status": "active",
    "evidencePaths": ["src/lib/govtech/", ".cortex/reports/govtech/"] },
  { "id": "cortex", "name": "CORTEX INTERNAL", "status": "active",
    "evidencePaths": ["src/lib/cortex-agents/", ".cortex-runtime/"] }
]
```

## 5. UI SPEC

- **VENTURES view** in Foundry rail: one card per venture — name, status lamp,
  attention count (overdue tasks + pending proposals + stalled goals), last
  activity, evidence-path chip. Sorted by attention, not alphabetically
  (kolabs/atlas finding: attention queue first).
- **Scope chips** atop TASKS/GOALS/CALENDAR: `ALL · OMNI · GOVTECH · CORTEX`.
  Reuses the exact ALL/AGENTS/USER chip pattern already shipped.
- **Drill-down**: click venture card → same panels filtered to that ventureId.
- **States**: empty venture = "NO SCOPED WORK — venture dormant or untagged"
  (honest, never mock-filled); loading = existing skeleton pattern; error =
  inline red strip with retry.
- **Cross-venture strip** (the differentiator): "NEEDS ATTENTION ACROSS
  VENTURES" — overdue tasks and pending crew-decisions aggregated across all
  ventures, ranked. This is the portfolio heatmap Cortex can compute that
  Klereti/Atlas approximate manually.

## 6. AGENT INTEGRATION

- `ventureId` declared in task `input`/`spec` at submit time; runtime stamps it
  onto the archived record. Unknown ventureId → rejected with
  `unknown venture` (same validation style as unknown agent in messages.ts).
- Scoped directives/messages/proposals filter by ventureId in their injected
  blocks — an omni-scoped directive doesn't pollute govtech context.
- **Budget attribution**: task archive already records agentId+kind; adding
  ventureId enables per-venture yield in `budgetYieldReview` — "omni consumed
  62% of distributor budget" becomes computable. Phase 2.
- Counsel sessions get optional `ventureId` scope; unscoped sessions deliberate
  fleet-wide (current behavior preserved).

## 7. REPO/SKILL RECOMMENDATIONS

| Repo/Pattern | Verdict | Reason |
|---|---|---|
| hermes-cockpit (health cards + status taxonomy) | **ADOPT pattern** | blocked/waiting/ready/failed status chips map directly onto our task states; copy the taxonomy, not the code (Next.js/Supabase stack mismatch) |
| joescharf/pm health scoring | **EVALUATE** | 0-100 composite across dimensions is interesting but our evidence-archive yield metrics are richer; revisit if venture health scoring is wanted |
| kolabs attention-queue-first IA | **ADOPT pattern** | ranked attention queue over grid — already our INBOX pattern, confirms direction |
| klereti workspace isolation | **ADOPT concept** | venture = scoped workspace; validates ventureId-as-scope-dimension design |
| orchid-dev-dashboard | **REJECT** | GitHub-PR-centric; our work isn't PR-shaped. Its "writes via PR only" governance is already covered by our proposals/INBOX |
| atlas-pmo RAID logging | **REJECT for now** | RAID is PM-domain overhead; our incidents+proposals already cover risk tracking |
| Wholesale dashboard imports (any) | **REJECT** | Stack mismatch (Next.js/Supabase vs Vite/Express middleware); patterns only |

## 8. PHASED ROLLBETTE

- **Phase 1 (honest-empty safe)**: ventures.json registry + VENTURES view +
  scope chips. Untagged tasks show under CORTEX. Ships with real registry,
  zero invented metrics — cards show counts computed live from real state.
- **Phase 2**: `ventureId` stamping on new tasks (distribution→omni,
  govtech proposal work→govtech), per-venture budget attribution in
  budgetYieldReview, venture-scoped directives/messages.
- **Phase 3**: venture health score (evidence-weighted: task completion,
  proposal approval rate, incident count) — only after Phase 2 produces
  real per-venture data. No health scores before data exists.

## 9. OPEN QUESTIONS FOR THE CREW

1. Should untagged/legacy tasks default to `cortex-internal`, or should there
   be an explicit "unscoped" bucket so Cortex-internal stays clean?
2. Do you want per-venture budget caps (hard limits), or is attribution-only
   reporting enough for now?
3. Is GovTech a revenue venture or a capability/internal venture? Affects
   whether it gets a budget share or just visibility.
4. Should counsel sessions be venture-scopable, or stay fleet-wide always?
