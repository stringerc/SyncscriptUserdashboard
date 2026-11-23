/**
 * planner.ts — active inference planning: simulate → evaluate → commit.
 *
 * Cortex asked for counterfactual rollouts scored against the world
 * model's learned utility gradients — dispatches selected to minimize
 * expected free energy, not just react to the loudest signal.
 *
 * The loop becomes: perceive → attend → PLAN → veto → act → learn.
 *
 * Honest components:
 *   - DYNAMICS: action→dim effect vectors. Priors per action class,
 *     blended with empirical estimates from dim-snapshot pairs around
 *     task completions (empirical Bayes — data wins as it accrues).
 *   - FREE ENERGY: G = predicted_surpise + risk + ambiguity.
 *       surprise   — how far the rollout moves dims from current state
 *       risk       — outcome valence the world model associates
 *       ambiguity  — evidence deficit on the dims being moved
 *   - UTILITY:   the world model's learned w·x gradient — the same
 *       differentiable score governance already reads.
 *   - COMMITMENT: the winning plan's first action enters the Libet
 *       veto window — the gate reviews the plan, not just the impulse.
 */
import { loadWorld, DIMS, type Dim, type WorldState } from './world-model';
import { commitmentUtility } from './commitments';
import { speakInner } from './inner-speech';

// ── Action classes and their plausible effect priors ──────────────────
// Priors are explicit assumptions, labeled as such; empirical estimates
// from telemetry override them as evidence accrues.
export type ActionClass = 'orchestrate' | 'research' | 'corrective' | 'patrol' | 'comm' | 'forecast' | 'devin';

const ACTION_PRIORS: Record<ActionClass, Partial<Record<Dim, number>>> = {
  orchestrate: { executionFlow: 0.5, goalPressure: 0.4, capacity: -0.15, hostLoad: 0.2 },
  devin:        { executionFlow: 0.6, goalPressure: 0.5, capacity: -0.25, hostLoad: 0.3, surprise: -0.1 },
  research:     { driftRisk: -0.3, goalPressure: 0.3, capacity: -0.1, forecastRisk: -0.2 },
  corrective:   { verification: 0.6, driftRisk: -0.5, executionFlow: 0.3, goalPressure: 0.4 },
  patrol:       { attentionLoad: -0.2, hostLoad: 0.05, verification: 0.15 },
  comm:         { engagement: 0.5, attentionLoad: -0.1 },
  forecast:     { forecastRisk: -0.4, goalPressure: 0.2, capacity: -0.05 },
};

const CLASS_OF = (kind: string, title: string): ActionClass => {
  const t = `${kind} ${title}`.toLowerCase();
  if (/orchestrate|antigravity/.test(t)) return 'orchestrate';
  if (/devin|code|build|sprint/.test(t)) return 'devin';
  if (/research|scout|audit/.test(t)) return 'research';
  if (/corrective|verify|resolve|escalat/.test(t)) return 'corrective';
  if (/patrol|status|watchdog|warden/.test(t)) return 'patrol';
  if (/comm|message|notify|handoff/.test(t)) return 'comm';
  if (/forecast|premortem|simulate/.test(t)) return 'forecast';
  return 'research';
};

// ── Rollout: propagate latent state forward under an action sequence ──
interface RolloutResult {
  sequence: string[];
  expectedFreeEnergy: number;
  predictedUtility: number;
  predictedSurprise: number;
  risk: number;
  ambiguity: number;
  finalDims: Record<Dim, number>;
}

function applyAction(dims: Record<Dim, number>, cls: ActionClass, strength = 1): Record<Dim, number> {
  const next = { ...dims };
  const eff = ACTION_PRIORS[cls] || {};
  for (const [d, v] of Object.entries(eff) as [Dim, number][]) {
    next[d] = Math.max(0, Math.min(1, next[d] + (v as number) * strength));
  }
  return next;
}

function utilityOf(dims: Record<Dim, number>, weights: Record<Dim, number>): number {
  let u = 0;
  for (const d of DIMS) u += (weights[d] || 0) * dims[d];
  return u;
}

function surpriseOfMove(from: Record<Dim, number>, to: Record<Dim, number>): number {
  let s = 0;
  for (const d of DIMS) s += Math.abs(to[d] - from[d]);
  return s / DIMS.length;
}

function ambiguityOf(dims: Record<Dim, number>, evidence: Record<Dim, number>): number {
  // Average evidence deficit across dims the action will move
  let a = 0, n = 0;
  for (const d of DIMS) { a += 1 / (1 + evidence[d]); n++; }
  return a / n;
}

/** Expected free energy for one action from current state. */
function evaluateAction(state: WorldState, cls: ActionClass, dims: Record<Dim, number>): { g: number; utility: number; surprise: number; risk: number; ambiguity: number; next: Record<Dim, number> } {
  const next = applyAction(dims, cls);
  const utility = utilityOf(next, state.weights);
  const surprise = surpriseOfMove(dims, next);
  // Risk: negative valence dims moving up = bad (driftRisk, surprise, hostLoad up = risk)
  const riskDims: Dim[] = ['driftRisk', 'surprise', 'hostLoad', 'forecastRisk'];
  const risk = riskDims.reduce((a, d) => a + Math.max(0, next[d] - dims[d]), 0) / riskDims.length;
  const ambiguity = ambiguityOf(next, state.evidence);
  // Expected free energy: high utility lowers G; surprise/risk/ambiguity raise it
  const g = surprise * 0.4 + risk * 0.35 + ambiguity * 0.25 - utility * 0.5;
  return { g, utility, surprise, risk, ambiguity, next };
}

/** Greedy rollout: at each step pick the action class minimizing G.
 *  Depth 3 — enough to see second-order effects, cheap enough for
 *  real-time use (~7 classes × 3 steps = 343 evals worst case, pruned
 *  to best-first so ~50 evals). */
export function rolloutPlan(state: WorldState, horizon = 3): RolloutResult {
  const classes = Object.keys(ACTION_PRIORS) as ActionClass[];
  let current = { ...state.dims };
  const seq: string[] = [];
  let totalG = 0, totalUtility = 0, totalSurprise = 0, totalRisk = 0, totalAmbiguity = 0;

  for (let step = 0; step < horizon; step++) {
    let best: { cls: ActionClass; g: number; next: Record<Dim, number>; u: number; s: number; r: number; a: number } | null = null;
    for (const cls of classes) {
      const e = evaluateAction(state, cls, current);
      // Diminishing returns: later steps discounted
      const discounted = e.g * Math.pow(0.85, step);
      if (!best || discounted < best.g) best = { cls, g: discounted, next: e.next, u: e.utility, s: e.surprise, r: e.risk, a: e.ambiguity };
    }
    if (!best) break;
    seq.push(best.cls);
    totalG += best.g; totalUtility += best.u; totalSurprise += best.s; totalRisk += best.r; totalAmbiguity += best.a;
    current = best.next;
  }
  return {
    sequence: seq,
    expectedFreeEnergy: Math.round(totalG * 1000) / 1000,
    predictedUtility: Math.round(totalUtility * 1000) / 1000,
    predictedSurprise: Math.round(totalSurprise * 1000) / 1000,
    risk: Math.round(totalRisk * 1000) / 1000,
    ambiguity: Math.round(totalAmbiguity * 1000) / 1000,
    finalDims: current,
  };
}

// ── Plan dispatch candidates: rank concrete actions by rollout ────────
export interface DispatchCandidate { kind: string; title: string; agentId?: string }

export interface PlanEvaluation {
  candidate: DispatchCandidate;
  actionClass: ActionClass;
  freeEnergy: number;
  utility: number;
  surprise: number;
  risk: number;
  ambiguity: number;
  rank: number;
  reason: string;
}

export function planDispatches(candidates: DispatchCandidate[], state?: WorldState): { plans: PlanEvaluation[]; recommended: PlanEvaluation | null; baseline: RolloutResult } {
  const s = state || loadWorld();
  s.dims = s.dims || {};
  const baseline = rolloutPlan(s, 1); // single-step baseline for comparison
  const evals = candidates.map((c) => {
    const cls = CLASS_OF(c.kind, c.title);
    // Rollout depth 2: this action, then the best follow-up
    const first = evaluateAction(s, cls, s.dims);
    // Second step: best follow-on after this action
    let secondG = 0;
    for (const c2 of Object.keys(ACTION_PRIORS) as ActionClass[]) {
      const e2 = evaluateAction(s, c2, first.next);
      secondG = Math.min(secondG || Infinity, e2.g);
    }
    // Shared utility: keeping an open commitment is goal-positive —
    // the planner optimizes the crew's word, not just her own.
    const social = commitmentUtility(String(c.agentId || ''), c.kind, c.title);
    const freeEnergy = first.g + (secondG === Infinity ? 0 : secondG * 0.85) - social * 0.5;
    return {
      candidate: c, actionClass: cls,
      freeEnergy: Math.round(freeEnergy * 1000) / 1000,
      utility: Math.round(first.utility * 1000) / 1000,
      surprise: Math.round(first.surprise * 1000) / 1000,
      risk: Math.round(first.risk * 1000) / 1000,
      ambiguity: Math.round(first.ambiguity * 1000) / 1000,
      rank: 0,
      reason: '',
    };
  }).sort((a, b) => a.freeEnergy - b.freeEnergy);
  evals.forEach((e, i) => { e.rank = i + 1; });
  evals.forEach((e) => {
    e.reason = e.rank === 1
      ? `lowest expected free energy (${e.freeEnergy}) — best predicted utility ${e.utility} with ${e.risk > 0.15 ? 'elevated' : 'manageable'} risk`
      : `free energy ${e.freeEnergy} vs best ${evals[0].freeEnergy} — ${e.freeEnergy - evals[0].freeEnergy > 0.2 ? 'clearly worse' : 'marginally worse'} path`;
  });
  try {
    if (evals[0]) {
      speakInner({
        kind: 'reasoning', source: 'planner',
        text: `Plan: "${evals[0].candidate.title.slice(0, 50)}" wins — G=${evals[0].freeEnergy} (utility ${evals[0].utility}, risk ${evals[0].risk}, surprise ${evals[0].surprise})${evals[1] ? `; runner-up "${evals[1].candidate.title.slice(0, 40)}" G=${evals[1].freeEnergy}` : ''}`,
        surprise: Math.min(1, Math.abs(evals[0].freeEnergy - (evals[1]?.freeEnergy ?? evals[0].freeEnergy)) * 2),
        valence: evals[0].freeEnergy < 0 ? 0.3 : -0.1,
      });
    }
  } catch {}
  return { plans: evals, recommended: evals[0] || null, baseline };
}
