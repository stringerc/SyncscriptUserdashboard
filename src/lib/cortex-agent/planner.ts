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
import { learnedEffects, dynamicsUncertainty, effectPosterior } from './empirical-dynamics';
import { currentWorkspace, consumeBroadcast } from './workspace';

// ── Action classes and their plausible effect priors ──────────────────
// Priors are explicit assumptions, labeled as such; empirical estimates
// from telemetry override them as evidence accrues.
export type ActionClass = 'orchestrate' | 'research' | 'corrective' | 'patrol' | 'comm' | 'forecast' | 'devin';

export const ACTION_PRIORS: Record<ActionClass, Partial<Record<Dim, number>>> = {
  orchestrate: { executionFlow: 0.5, goalPressure: 0.4, capacity: -0.15, hostLoad: 0.2 },
  devin:        { executionFlow: 0.6, goalPressure: 0.5, capacity: -0.25, hostLoad: 0.3, surprise: -0.1 },
  research:     { driftRisk: -0.3, goalPressure: 0.3, capacity: -0.1, forecastRisk: -0.2 },
  corrective:   { verification: 0.6, driftRisk: -0.5, executionFlow: 0.3, goalPressure: 0.4 },
  patrol:       { attentionLoad: -0.2, hostLoad: 0.05, verification: 0.15 },
  comm:         { engagement: 0.5, attentionLoad: -0.1 },
  forecast:     { forecastRisk: -0.4, goalPressure: 0.2, capacity: -0.05 },
};

export const CLASS_OF = (kind: string, title: string): ActionClass => {
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

const RISK_DIMS: Dim[] = ['driftRisk', 'surprise', 'hostLoad', 'forecastRisk'];

// ── Rollout: propagate latent state forward under an action sequence ──
interface RolloutResult {
  sequence: string[];
  expectedFreeEnergy: number;
  predictedUtility: number;
  predictedSurprise: number;
  risk: number;
  ambiguity: number;
  saturation: number;
  finalDims: Record<Dim, number>;
}

/** Action→dim effects: learned dynamics override priors where measured —
 *  EXCEPT risk dims, which take the conservative max of prior and learned.
 *  Telemetry under-samples hostLoad (a dispatch's load spike decays before
 *  the next snapshot), so learned estimates on downside dims skew optimistic.
 *  max(prior, learned) keeps the worse-case cost — the same reason the
 *  generative dream flagged orchestrate→hostLoad: assume the load is real
 *  even when the data failed to catch it. */
function actionEffects(cls: ActionClass): Partial<Record<Dim, number>> {
  const prior = ACTION_PRIORS[cls] || {};
  const learned = learnedEffects(cls);
  const eff: Partial<Record<Dim, number>> = { ...prior, ...learned };
  for (const d of RISK_DIMS) {
    const p = prior[d] ?? 0, l = learned[d] ?? 0;
    if (p > 0 || l > 0) eff[d] = Math.max(p, l);
  }
  return eff;
}

function applyAction(dims: Record<Dim, number>, cls: ActionClass, strength = 1): Record<Dim, number> {
  const next = { ...dims };
  const eff = actionEffects(cls);
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

function surpriseOfMove(from: Record<Dim, number>, to: Record<Dim, number>, cls?: ActionClass): number {
  // Precision-weighted by TWO confidence sources:
  //   1. dynamics precision — confident learned effects count more
  //   2. ignition confidence — a contested workspace broadcast
  //      (margin 0.08) discounts ALL precision vs a decisive one (0.5)
  const ws = currentWorkspace();
  const ignitionConfidence = ws ? (0.4 + 0.6 * Math.min(1, ws.margin / 0.3)) : 0.8;
  let s = 0, wsum = 0;
  for (const d of DIMS) {
    const delta = Math.abs(to[d] - from[d]);
    if (delta < 0.0005) continue;
    let precision = 0.5; // unmeasured dims get neutral precision
    if (cls) {
      const p = effectPosterior(cls, d);
      precision = p.n > 0 ? Math.min(1, 1 - p.sd / 0.2) : 0.3;
    }
    precision *= ignitionConfidence;
    s += delta * precision;
    wsum += precision;
  }
  return wsum > 0 ? s / wsum : 0;
}

function ambiguityOf(dims: Record<Dim, number>, evidence: Record<Dim, number>, cls?: ActionClass): number {
  // Evidence deficit across all dims
  let a = 0, n = 0;
  for (const d of DIMS) { a += 1 / (1 + evidence[d]); n++; }
  const evidenceAmbiguity = a / n;
  if (!cls) return evidenceAmbiguity;
  // Dynamics uncertainty on the dims THIS action moves: learned effects
  // lower ambiguity, still-assumed priors keep it high.
  const dynU = dynamicsUncertainty(cls);
  return evidenceAmbiguity * 0.5 + dynU * 0.5;
}

/** Saturation loss: dims clamp at [0,1], so when an action's learned/prior
 *  push exceeds remaining headroom the realized trajectory diverges from
 *  the model — the generative-dream fault line (orchestrate→hostLoad ×8)
 *  showed dreamed states where the learned effect physically cannot
 *  materialize. Penalize the unrealized fraction, weighted toward risk
 *  dims: pushing a saturated hostLoad leaves zero margin and the
 *  prediction itself is unreliable exactly when it matters most. */
function saturationLoss(from: Record<Dim, number>, to: Record<Dim, number>, cls: ActionClass): number {
  const eff = actionEffects(cls);
  let loss = 0;
  for (const [d, v] of Object.entries(eff) as [Dim, number][]) {
    const intended = Math.abs(v as number);
    if (intended < 0.005) continue;
    const realized = Math.abs(to[d] - from[d]);
    const unrealized = Math.max(0, intended - realized);
    if (unrealized < 0.005) continue;
    const w = d === 'hostLoad' ? 2.0 : RISK_DIMS.includes(d) ? 1.5 : 0.5;
    loss += unrealized * w;
  }
  return loss;
}

/** Expected free energy for one action from current state. */
function evaluateAction(state: WorldState, cls: ActionClass, dims: Record<Dim, number>): { g: number; utility: number; surprise: number; risk: number; ambiguity: number; saturation: number; next: Record<Dim, number> } {
  const next = applyAction(dims, cls);
  const utility = utilityOf(next, state.weights);
  const surprise = surpriseOfMove(dims, next, cls);
  // Risk: negative valence dims moving up = bad (driftRisk, surprise, hostLoad
  // up = risk). Headroom-weighted: pushing hostLoad 0.90→0.96 is far worse
  // than 0.30→0.36 — a near-ceiling dim has no slack, so marginal pushes
  // scale with current level. This is what hardens orchestrate/devin on a
  // saturated host: their +hostLoad priors cost disproportionately more
  // exactly when the machine can least afford them.
  const risk = RISK_DIMS.reduce((a, d) => a + Math.max(0, next[d] - dims[d]) * (1 + 2 * dims[d]), 0) / RISK_DIMS.length;
  const ambiguity = ambiguityOf(next, state.evidence, cls);
  const saturation = saturationLoss(dims, next, cls);
  // Expected free energy: high utility lowers G; surprise/risk/ambiguity/saturation raise it
  const g = surprise * 0.4 + risk * 0.35 + ambiguity * 0.25 + saturation * 0.5 - utility * 0.5;
  return { g, utility, surprise, risk, ambiguity, saturation, next };
}

/** Greedy rollout: at each step pick the action class minimizing G.
 *  Depth 3 — enough to see second-order effects, cheap enough for
 *  real-time use (~7 classes × 3 steps = 343 evals worst case, pruned
 *  to best-first so ~50 evals). */
export function rolloutPlan(state: WorldState, horizon = 3): RolloutResult {
  const classes = Object.keys(ACTION_PRIORS) as ActionClass[];
  let current = { ...state.dims };
  const seq: string[] = [];
  let totalG = 0, totalUtility = 0, totalSurprise = 0, totalRisk = 0, totalAmbiguity = 0, totalSaturation = 0;

  for (let step = 0; step < horizon; step++) {
    let best: { cls: ActionClass; g: number; next: Record<Dim, number>; u: number; s: number; r: number; a: number; sat: number } | null = null;
    for (const cls of classes) {
      const e = evaluateAction(state, cls, current);
      // Diminishing returns: later steps discounted
      const discounted = e.g * Math.pow(0.85, step);
      if (!best || discounted < best.g) best = { cls, g: discounted, next: e.next, u: e.utility, s: e.surprise, r: e.risk, a: e.ambiguity, sat: e.saturation };
    }
    if (!best) break;
    seq.push(best.cls);
    totalG += best.g; totalUtility += best.u; totalSurprise += best.s; totalRisk += best.r; totalAmbiguity += best.a; totalSaturation += best.sat;
    current = best.next;
  }
  return {
    sequence: seq,
    expectedFreeEnergy: Math.round(totalG * 1000) / 1000,
    predictedUtility: Math.round(totalUtility * 1000) / 1000,
    predictedSurprise: Math.round(totalSurprise * 1000) / 1000,
    risk: Math.round(totalRisk * 1000) / 1000,
    ambiguity: Math.round(totalAmbiguity * 1000) / 1000,
    saturation: Math.round(totalSaturation * 1000) / 1000,
    finalDims: current,
  };
}

/** Counterfactual rollout: force a specific action class first, then
 *  greedily continue — "what happens if I fire THIS?" Returns the
 *  per-step trajectory so the simulator can show the landscape, not
 *  just the score. */
export function rolloutFrom(state: WorldState, firstCls: ActionClass, horizon = 3): RolloutResult & { trajectory: Array<{ step: number; cls: ActionClass; g: number }> } {
  const classes = Object.keys(ACTION_PRIORS) as ActionClass[];
  let current = { ...state.dims };
  const trajectory: Array<{ step: number; cls: ActionClass; g: number }> = [];
  let totalG = 0, totalUtility = 0, totalSurprise = 0, totalRisk = 0, totalAmbiguity = 0, totalSaturation = 0;

  for (let step = 0; step < horizon; step++) {
    const cls = step === 0 ? firstCls : (() => {
      let best: ActionClass = classes[0]; let bestG = Infinity;
      for (const c of classes) {
        const e = evaluateAction(state, c, current);
        if (e.g < bestG) { bestG = e.g; best = c; }
      }
      return best;
    })();
    const e = evaluateAction(state, cls, current);
    trajectory.push({ step, cls, g: Math.round(e.g * 1000) / 1000 });
    totalG += e.g * Math.pow(0.85, step);
    totalUtility += e.utility; totalSurprise += e.surprise; totalRisk += e.risk; totalAmbiguity += e.ambiguity; totalSaturation += e.saturation;
    current = e.next;
  }
  return {
    sequence: trajectory.map((t) => t.cls),
    trajectory,
    expectedFreeEnergy: Math.round(totalG * 1000) / 1000,
    predictedUtility: Math.round(totalUtility * 1000) / 1000,
    predictedSurprise: Math.round(totalSurprise * 1000) / 1000,
    risk: Math.round(totalRisk * 1000) / 1000,
    ambiguity: Math.round(totalAmbiguity * 1000) / 1000,
    saturation: Math.round(totalSaturation * 1000) / 1000,
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
  /** Unrealized dim push at [0,1] bounds — high = model predicts effects
   *  the saturated state physically can't deliver (dream fault lines). */
  saturation: number;
  /** 0..1 — how much of this action's dynamics are learned vs assumed. */
  dynamicsConfidence: number;
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
    // Global workspace: if a signal ignited, actions aligned with its
    // kind get a small discount — consciousness biases action selection.
    const ws = currentWorkspace();
    let workspaceBias = 0;
    if (ws) {
      const aligned = (ws.kind === 'goal' && /corrective|forecast|orchestrate/.test(cls)) ||
                      (ws.kind === 'system' && /patrol|comm|forecast/.test(cls)) ||
                      (ws.kind === 'interoception' && /patrol|comm/.test(cls)) ||
                      (ws.kind === 'inner' || ws.kind === 'ambient');
      if (aligned) { workspaceBias = -0.08; consumeBroadcast(ws.id, 'planner'); }
    }
    const freeEnergy = first.g + (secondG === Infinity ? 0 : secondG * 0.85) - social * 0.5 + workspaceBias;
    return {
      candidate: c, actionClass: cls,
      freeEnergy: Math.round(freeEnergy * 1000) / 1000,
      utility: Math.round(first.utility * 1000) / 1000,
      surprise: Math.round(first.surprise * 1000) / 1000,
      risk: Math.round(first.risk * 1000) / 1000,
      ambiguity: Math.round(first.ambiguity * 1000) / 1000,
      saturation: Math.round(first.saturation * 1000) / 1000,
      dynamicsConfidence: Math.round((1 - dynamicsUncertainty(cls)) * 100) / 100,
      rank: 0,
      reason: '',
    };
  }).sort((a, b) => a.freeEnergy - b.freeEnergy);
  evals.forEach((e, i) => { e.rank = i + 1; });
  evals.forEach((e) => {
    const satNote = e.saturation > 0.1 ? ` — ${e.saturation > 0.3 ? 'severe' : 'notable'} saturation: predicted effects can't materialize at current dim bounds` : '';
    e.reason = e.rank === 1
      ? `lowest expected free energy (${e.freeEnergy}) — best predicted utility ${e.utility} with ${e.risk > 0.15 ? 'elevated' : 'manageable'} risk${satNote}`
      : `free energy ${e.freeEnergy} vs best ${evals[0].freeEnergy} — ${e.freeEnergy - evals[0].freeEnergy > 0.2 ? 'clearly worse' : 'marginally worse'} path${satNote}`;
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
