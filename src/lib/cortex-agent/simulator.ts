// simulator.ts — the imagination engine: counterfactual deliberation.
//
// The Libet window lets Cortex amend/hold/veto a pending intent, but
// until now she couldn't ask "what happens if I fire THIS vs THAT?"
// This module rolls candidate intents through the full cognitive
// stack — world-model dynamics, planner free energy, interoceptive
// gate, commitment utility, workspace bias — and returns the decision
// LANDSCAPE: predicted trajectories, not just scores.
//
// Deliberation = perceive → compete → ignite → broadcast → consume →
// plan → SIMULATE → veto-window → act → learn → dream.
//
// Honesty: trajectories are predictions over learned dynamics + priors,
// stamped with dynamicsConfidence so she knows when she's imagining
// over measured vs assumed physics.
import { observeWorld, type WorldState } from './world-model';
import { rolloutFrom, planDispatches, CLASS_OF, type ActionClass, type DispatchCandidate } from './planner';
import { interoceptiveGate } from './interoceptive';
import { commitmentUtility } from './commitments';
import { currentWorkspace, consumeBroadcast } from './workspace';
import { speakInner } from './inner-speech';
import { listLibetPending, type VetoIntent } from './libet-veto';
import { learnValence, valencePrior } from './valence-memory';
import { expectedReaction } from './selfhood';

export interface SimulatedAction {
  candidate: DispatchCandidate;
  actionClass: ActionClass;
  /** Expected free energy — lower is better. */
  freeEnergy: number;
  utility: number;
  surprise: number;
  risk: number;
  ambiguity: number;
  /** 0..1 — learned-vs-assumed dynamics confidence. */
  dynamicsConfidence: number;
  /** Predicted 3-step trajectory: forced action + greedy continuation. */
  trajectory: Array<{ step: number; cls: ActionClass; g: number }>;
  /** Predicted dim movement from current state (top 3 by |delta|). */
  predictedShifts: Array<{ dim: string; delta: number }>;
  /** Would the body allow this right now? */
  somaticGate: { allow: boolean; reason?: string; level: string; capacity: number };
  /** Commitment-ledger pull on this action. */
  socialUtility: number;
  /** Global-workspace alignment discount applied. */
  workspaceBias: number;
  /** Preference learning: historical outcome valence for this class.
   *  Positive valence lowers free energy — she prefers trajectories
   *  that historically reduced prediction error. */
  preference: { mean: number; n: number } | null;
  /** Social cognition: predicted reaction of the target agent. */
  socialExpectation: { expectation: string; confidence: number; expectedValence: number } | null;
  rank: number;
  verdict: string;
}

/** Simulate a set of dispatch candidates — the decision landscape.
 *  Each candidate is rolled out independently; results ranked by
 *  total predicted free energy including somatic/social/workspace
 *  adjustments. */
export function simulateDispatches(candidates: DispatchCandidate[], world?: WorldState): { landscape: SimulatedAction[]; best: SimulatedAction | null; simulatedAt: number } {
  learnValence(); // fold new outcomes into preference memory first
  const s = world || observeWorld();
  const base = planDispatches(candidates, s);
  const ws = currentWorkspace();

  const landscape: SimulatedAction[] = candidates.map((c) => {
    const cls = CLASS_OF(c.kind, c.title);
    const traj = rolloutFrom(s, cls, 3);
    const gate = interoceptiveGate(c.kind, c.title);
    const social = commitmentUtility(String(c.agentId || ''), c.kind, c.title);
    // Preference learning: outcomes that historically felt good lower G
    const vp = valencePrior(cls);
    const preferenceAdjustment = vp ? -vp.mean * 0.3 : 0;
    // Social cognition: what will the target agent likely feel?
    const reaction = c.agentId ? expectedReaction(String(c.agentId), c.kind, c.title) : null;

    // Workspace alignment — same rule as planDispatches
    let workspaceBias = 0;
    if (ws) {
      const aligned = (ws.kind === 'goal' && /corrective|forecast|orchestrate/.test(cls)) ||
                      (ws.kind === 'system' && /patrol|comm|forecast/.test(cls)) ||
                      (ws.kind === 'interoception' && /patrol|comm/.test(cls)) ||
                      (ws.kind === 'inner' || ws.kind === 'ambient');
      if (aligned) { workspaceBias = -0.08; consumeBroadcast(ws.id, 'simulator'); }
    }

    // Somatic cost: a gated action isn't free — deferred work carries
    // the cost of waiting (risk dims stay elevated longer)
    const somaticPenalty = gate.allow ? 0 : 0.3;

    // plans are sorted — match by candidate identity, not index
    const evalPlan = base.plans.find((pl) => pl.candidate === c);
    const freeEnergy = (evalPlan?.freeEnergy ?? traj.expectedFreeEnergy) + somaticPenalty + preferenceAdjustment
      + (reaction && reaction.expectedValence < -0.2 ? 0.15 : 0); // socially costly dispatches pay a little

    // Predicted shifts: top dim movements over the trajectory
    const shifts = Object.keys(traj.finalDims)
      .map((d) => ({ dim: d, delta: Math.round(((traj.finalDims as any)[d] - (s.dims as any)[d]) * 1000) / 1000 }))
      .filter((x) => Math.abs(x.delta) > 0.01)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);

    return {
      candidate: c,
      actionClass: cls,
      freeEnergy: Math.round(freeEnergy * 1000) / 1000,
      utility: evalPlan?.utility ?? traj.predictedUtility,
      surprise: evalPlan?.surprise ?? traj.predictedSurprise,
      risk: evalPlan?.risk ?? traj.risk,
      ambiguity: evalPlan?.ambiguity ?? traj.ambiguity,
      dynamicsConfidence: evalPlan?.dynamicsConfidence ?? 0.5,
      trajectory: traj.trajectory,
      predictedShifts: shifts,
      somaticGate: { allow: gate.allow, reason: gate.reason, level: gate.level, capacity: gate.capacity },
      socialUtility: Math.round(social * 1000) / 1000,
      workspaceBias,
      preference: vp,
      socialExpectation: reaction ? { expectation: reaction.expectation, confidence: reaction.confidence, expectedValence: reaction.expectedValence } : null,
      rank: 0,
      verdict: '',
    };
  }).sort((a, b) => a.freeEnergy - b.freeEnergy);

  landscape.forEach((a, i) => {
    a.rank = i + 1;
    const gated = !a.somaticGate.allow ? ' — BODY GATED (deferred)' : '';
    const learned = a.dynamicsConfidence > 0.6 ? 'measured dynamics' : a.dynamicsConfidence > 0.3 ? 'partially learned' : 'mostly assumed physics';
    a.verdict = a.rank === 1
      ? `best predicted path — G=${a.freeEnergy} over ${learned}${gated}`
      : `${a.freeEnergy - landscape[0].freeEnergy > 0.3 ? 'clearly worse' : 'marginally worse'} than best (ΔG=${Math.round((a.freeEnergy - landscape[0].freeEnergy) * 1000) / 1000})${gated}`;
  });

  // Deliberation speaks — the imagination engine narrating its landscape
  if (landscape.length > 1) {
    try {
      const top2 = landscape.slice(0, 2);
      speakInner({
        kind: 'reasoning', source: 'simulator',
        text: `Deliberated ${landscape.length} options: "${top2[0].candidate.title.slice(0, 40)}" G=${top2[0].freeEnergy} vs "${top2[1].candidate.title.slice(0, 40)}" G=${top2[1].freeEnergy} — ${top2[0].verdict.split('—')[0].trim()}`,
        surprise: Math.min(1, Math.abs(top2[0].freeEnergy - top2[1].freeEnergy) * 2),
        valence: top2[0].freeEnergy < 0 ? 0.2 : -0.1,
      });
    } catch {}
  }

  return { landscape, best: landscape[0] || null, simulatedAt: Date.now() };
}

/** Deliberate on the actual pending Libet intents — "what happens if
 *  each of these fires?" The decision gap becomes a decision landscape. */
export function simulatePendingLibet(world?: WorldState) {
  const pending = listLibetPending();
  const candidates: DispatchCandidate[] = pending.map((p: VetoIntent) => ({
    kind: p.kind, title: p.title, agentId: p.agentId,
  }));
  if (!candidates.length) return { landscape: [], best: null, pending: 0, simulatedAt: Date.now() };
  const result = simulateDispatches(candidates, world);
  return { ...result, pending: pending.length };
}
