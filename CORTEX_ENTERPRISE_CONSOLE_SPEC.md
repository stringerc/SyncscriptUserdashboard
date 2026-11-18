# CORTEX ENTERPRISE CONSOLE — CANONICAL SPEC

> Merged from the bake-off winners: DEVIN leg (data-model derivation insight)
> + RESEARCH leg (IA evidence, repo survey). Antigravity leg failed to
> produce a deliverable — see bake-off notes in git history.
>
> Status: SPEC ONLY — no implementation yet. Phase 1 is honest-empty safe.

## 1. DECISION: scope dimension on existing Foundry surfaces — not a new app, not PIPELINE

Enterprise is a **scope**, not a lens. The Foundry left rail already solved
"one screen, many lenses"; ventures belong *inside* TASKS/GOALS/CALENDAR as a
filter dimension (same pattern as the shipped ALL/AGENTS/USER chips), plus one
new `VENTURES` roll-up view for cross-venture attention.

Rejected alternatives:
- **Standalone page/app** — splits attention, duplicates the rail pattern.
- **PIPELINE evolution** — Pipeline is distribution-flow-shaped; ventures span
  tasks/goals/calendar/agents/evidence. Overloading it corrupts both.

Evidence: kolabs.design Portfolio Command Center, klereti.com portfolio
operators, aceymagallanes/atlas-pmo-command-center, goktugozdem2/hermes-cockpit
all converge on attention-queue-first + entity-switcher + roll-up metrics.

## 2. DATA MODEL — minimal, additive, derivation-first

```ts
// .cortex-runtime/ventures.json — registry (new file)
interface Venture {
  id: string;                    // 'omni' | 'govtech' | 'cortex'
  name: string;
  callSign: string;
  status: 'active' | 'dormant' | 'archived';
  evidencePaths: string[];       // real paths proving the venture exists
}
```

**`ventureId?: string`** — optional field on mission goals, ops items,
planned blocks, and `task.input.ventureId`. Absent = unscoped → shows under
CORTEX/FLEET bucket. Zero migration; no existing data rewritten.

**Derivation beats migration** (Devin leg's key finding): venture identity
already exists implicitly in the distribution queue — item types
`omni_publish-*`, `govtech-*`/`sam_gov_*` self-tag. Phase 1 derives venture
from queue `type` prefix; Phase 2 stamps `ventureId` on new agent tasks.

Verified live: `/api/cortex/distribution/status` → 35 done / 4 failed /
4 pending items across venture-prefixed types.

## 3. VENTURE REGISTRY — seed (evidence-backed only)

| id | name | evidencePaths |
|---|---|---|
| `omni` | OMNI | `storefront/`, `storefront/distribution-queue.json`, `storefront/GUMROAD_LAUNCH_LOG.md`, `storefront/TRAFFIC_PLAYBOOK.md` |
| `govtech` | GOVTECH | `src/lib/govtech/`, `.cortex/reports/govtech/` (FA8811-26-Q-0310, TRADEWINDS-CSO-2026-01, W911QX-26-Q-0042 bid dossiers) |
| `cortex` | CORTEX INTERNAL | `src/lib/cortex-agents/`, `.cortex-runtime/` |

No invented metrics. Cards compute counts live from real state.

## 4. UI SPEC

- **`VENTURES` view** in Foundry rail: card per venture — name, status lamp,
  live counts (open tasks, pending proposals, stalled goals, last activity),
  evidence-path chip. Sorted by attention, not alphabetically.
- **Scope chips** atop TASKS/GOALS/CALENDAR: `ALL · OMNI · GOVTECH · CORTEX`.
  Untagged work lands in CORTEX — nothing silently dropped (honest-empty).
- **Cross-venture attention strip**: overdue tasks + pending crew decisions
  aggregated across ventures, ranked — the portfolio heatmap Cortex can
  compute that manual PMO tools approximate.
- **States**: empty venture → "NO SCOPED WORK — dormant or untagged"; loading →
  existing skeleton; error → inline red strip + retry. Never mock-filled.

## 5. AGENT INTEGRATION

- `ventureId` declared in task `input`/`spec`; runtime stamps onto archive.
  Unknown ventureId → rejected `unknown venture` (same validation style as
  messages.ts unknown-recipient).
- Scoped directives/messages/proposals filter by ventureId in injected blocks.
- **Budget attribution** (Phase 2): `budgetYieldReview` gains per-venture
  yield — "omni consumed 62% of distributor budget" becomes computable.
- Counsel sessions stay fleet-wide for now (open question §7).

## 6. REPO RECOMMENDATIONS

| Source | Verdict | Reason |
|---|---|---|
| hermes-cockpit status taxonomy | ADOPT pattern | blocked/waiting/ready/failed chips map to our task states |
| kolabs attention-queue-first | ADOPT pattern | confirms INBOX-style ranking over grids |
| klereti workspace isolation | ADOPT concept | venture = scoped workspace |
| joescharf/pm health score | EVALUATE | revisit when venture health scoring lands (Phase 3) |
| orchid-dev-dashboard | REJECT | PR-shaped; our governance already covers it |
| atlas-pmo RAID | REJECT for now | incidents+proposals already cover risk |
| Wholesale dashboard imports | REJECT | stack mismatch (Next.js/Supabase vs Vite middleware) |

## 7. PHASED ROLLOUT

- **Phase 1** (honest-empty safe): ventures.json + VENTURES view + scope chips
  + distribution-queue venture derivation. Live counts only.
- **Phase 2**: `ventureId` stamping on new tasks, scoped directives/messages,
  per-venture budget attribution.
- **Phase 3**: venture health score — only after Phase 2 yields real data.

## 8. OPEN QUESTIONS FOR THE CREW

1. Untagged work → CORTEX bucket, or explicit "unscoped" bucket?
2. Per-venture budget caps (hard) or attribution-only reporting?
3. Is GovTech a revenue venture or capability/internal? (affects budget share)
4. Should counsel sessions ever be venture-scoped?
