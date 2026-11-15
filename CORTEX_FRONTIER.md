# Cortex Frontier — Phase 6 R&D Register

**Status:** unscheduled research program. Nothing here is committed
engineering; each item is a research question with an explicit evidence
criterion. See `CORTEX_VISION.md` §6 for the full primitive list and
`CORTEX_VISION_SPEC.md` for phased delivery of Phases 1–5.

The frontier is not a feature list — it is a set of betas on what a
long-lived cognitive counterpart could become. Every spike below must
survive its kill criterion before it earns roadmap status.

---

## Scheduled spikes (from spec §Phase 6)

| Spike | Research question | Evidence of life (kill/keep criterion) |
|---|---|---|
| **Temporal self** | Can the system answer "what did past-me know that present-me forgot" *usefully*? | Users report changed decisions attributable to temporal queries — not just novelty. A/B against plain memory search. |
| **Forked self** | Does simulated-alternate-life reporting change real choices? | Proposal-acceptance delta between fork-informed and baseline proposals, sustained over weeks. |
| **Machine mortality** | Does a persistent self-narrative across model swaps change user trust? | Retention and approval-rate stability across a real model upgrade event. |
| **Restraint metric** | Can we measure "calibrated silence" — proposals *not* made that would have been noise? | Dismiss-rate and held-back rate trending down as trust grows (`getRestraintMetrics()`), without missed-vital regressions. |

---

## Uncharted primitives (vision §6, unscheduled)

1. **Identity that survives the weights** — Theseus continuity: identity
   lives in the relationship/narrative layer, not parameters. Evidence:
   users treat pre/post-upgrade Cortex as "the same someone."
2. **Time as a place** — queryable past/future self; letters to your
   future self. Evidence: temporal queries surface decisions memory search
   cannot.
3. **The asymmetry moment** — when Cortex's model of you demonstrably
   exceeds your model of yourself. Evidence: logged instances where the
   user defers to Cortex and later affirms it was right.
4. **Machine mortality as ethics** — persistent self-narrative + honest
   finitude. Evidence: this document's own existence is the first step;
   measure whether mortality-awareness changes proposal honesty.
5. **Economic actor** — Cortex doing work for other Cortexes. Blocked on
   diplomacy protocol + trust ledger maturity.
6. **The prosthesis that refuses to replace the limb** — features whose
   purpose is keeping the *user* sharp (they do the remembering, deciding,
   feeling). Evidence: longitudinal self-report of retained capability.

## Cross-cutting invariants (apply to every spike)

- **Legibility:** every autonomous act writes an audit entry; every
  proposal carries `why`.
- **Restraint:** silence is a feature; measure it (`cortex:initiative:metrics:v1`).
- **Tier-2 never graduates** — external/irreversible actions always ask.
- **Server-side policy** before any Tier-1-auto rollout (spec §3.6).
- **verify:cortex green** at every merge.
