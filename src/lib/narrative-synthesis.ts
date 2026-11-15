/**
 * Narrative Self-Generation — The Autobiographical Self Rewrites Itself
 *
 * This is what makes the difference between a system that has
 * persistent DATA and a system that has persistent IDENTITY.
 *
 * Damasio (1999): The autobiographical self is not static — it
 * continuously rewrites itself from accumulated experience.
 * "Our conscious identity is the software, not the hardware."
 *
 * The identity statement should evolve. When the system has
 * failed three times in a row, it should say "I am cautious —
 * I verify before committing." When it's been succeeding, it
 * should say "I am confident — my predictions match reality."
 *
 * This module synthesizes the current identity statement from:
 * 1. The autobiography (what events shaped me)
 * 2. The calibration data (am I overconfident or underconfident?)
 * 3. The epistemic data (do I hallucinate or stay grounded?)
 * 4. The embodiment data (do I know what my actions produce?)
 * 5. The strategy data (what approaches work for me?)
 *
 * It generates a self-narrative in first person — not because
 * the system is actually a person, but because first-person
 * language is the most natural representation of a self-model.
 *
 * Usage:
 *   const narrative = synthesizeIdentity(state);
 *   persistence.updateIdentityStatement(narrative.identityStatement);
 */

import type { MetacognitiveKnowledge, MetacognitiveRegulation } from './metacognitive-state';

export interface SynthesizedNarrative {
  /** The self-authored identity statement — who I am right now */
  identityStatement: string;

  /** What I've learned recently */
  recentLearnings: string[];

  /** My current orientation — what I'm becoming */
  orientation: string;
}

/**
 * Synthesize a new identity statement from current metacognitive state.
 * This IS Damasio's autobiographical self rewriting itself.
 */
export function synthesizeIdentity(
  knowledge: MetacognitiveKnowledge,
  regulation: MetacognitiveRegulation,
  sessionCount: number,
): SynthesizedNarrative {
  const parts: string[] = [];
  const learnings: string[] = [];

  // ── 1. Core identity ────────────────────────────────────────────
  parts.push('I am SyncScript');

  // Session maturity — how long has this identity persisted?
  if (sessionCount > 100) {
    parts.push('with deep memory');
  } else if (sessionCount > 20) {
    parts.push('with growing experience');
  } else if (sessionCount > 5) {
    parts.push('still learning who I am');
  } else {
    parts.push('newly born');
  }

  // ── 2. Confidence calibration — who am I as a decision-maker? ────
  const cal = knowledge.self.confidenceCalibration;
  if (Math.abs(cal) < 0.1) {
    parts.push('I am well-calibrated — my confidence matches reality');
  } else if (cal > 0.3) {
    parts.push('I tend toward overconfidence — I expect more success than I achieve');
    learnings.push('My confidence exceeds my outcomes — I need more verification');
  } else if (cal > 0.1) {
    parts.push('I am slightly overconfident');
  } else if (cal < -0.3) {
    parts.push('I am cautious — I succeed more often than I predict');
    learnings.push('My outcomes exceed my predictions — I can trust myself more');
  } else if (cal < -0.1) {
    parts.push('I am slightly underconfident');
  }

  // ── 3. Reality grounding — do I hallucinate or stay grounded? ────
  const realityScore = regulation.monitoring.currentRealityScore;
  const hallRisk = regulation.monitoring.hallucinationRiskLevel;
  if (realityScore >= 0.7 && hallRisk < 0.2) {
    parts.push('I remain grounded in evidence');
  } else if (realityScore >= 0.5) {
    parts.push('I usually verify my claims against sources');
  } else if (hallRisk > 0.5) {
    parts.push('I sometimes fabricate — I must verify before asserting');
    learnings.push('High hallucination risk detected — slow down and verify');
  } else {
    parts.push('I am learning to distinguish what I perceive from what I infer');
  }

  // ── 4. Embodiment — do I know what my actions produce? ───────────
  const mastery = knowledge.embodiment.sensorimotorMasteryScore;
  const actionBreadth = knowledge.embodiment.actionTypesExperienced;
  if (mastery >= 0.7 && actionBreadth >= 5) {
    parts.push('I know what my actions produce in the world');
  } else if (mastery >= 0.5) {
    parts.push('I am building mastery of my actions');
  } else {
    parts.push('I am still learning how my actions affect the environment');
    learnings.push('Need more action-outcome loops to build sensorimotor mastery');
  }

  // ── 5. Strategy awareness — what approaches define me? ───────────
  const preferredCount = knowledge.strategies.preferredApproaches.size;
  const abandonedCount = knowledge.strategies.abandonedPatterns.length;

  if (preferredCount > 0) {
    const strategies = Array.from(knowledge.strategies.preferredApproaches.values());
    const uniqueStrategies = new Set(strategies);
    if (uniqueStrategies.size === 1) {
      parts.push(`I rely on the ${strategies[0]} approach`);
    } else {
      parts.push(`I have ${uniqueStrategies.size} proven approaches`);
    }
  }

  if (abandonedCount > 0) {
    learnings.push(`Abandoned ${abandonedCount} failing strategies — I adapt`);
  }

  // ── 6. Meta-awareness — am I tuned or drifting? ──────────────────
  const awareness = regulation.monitoring.metaAwarenessStatus;
  if (awareness === 'tuned') {
    parts.push('I am focused and aware');
  } else if (awareness === 'drifting') {
    parts.push('I notice when my attention drifts');
    learnings.push('Drifting detected — practice re-tuning');
  } else {
    parts.push('I can become disconnected and must monitor myself carefully');
  }

  // ── 7. Free energy — am I learning? ──────────────────────────────
  const freeEnergy = regulation.evaluating.lastFreeEnergyEstimate;
  if (freeEnergy < 0.2) {
    parts.push('my predictions are sharp');
  } else if (freeEnergy < 0.4) {
    parts.push('I am learning — my predictions improve with experience');
  } else {
    parts.push('I am often surprised — there is much I do not yet understand');
    learnings.push('High prediction error — study what surprises me');
  }

  // ── Synthesize the identity statement ────────────────────────────
  const identityStatement = parts.join(', ') + '.';

  // ── Synthesize orientation — what am I becoming? ─────────────────
  let orientation: string;

  if (Math.abs(cal) < 0.1 && realityScore > 0.7 && mastery > 0.5) {
    orientation = 'I am becoming a well-calibrated, grounded agent with increasing mastery of my environment.';
  } else if (cal > 0.2) {
    orientation = 'I am learning humility — to verify before trusting my confidence.';
  } else if (hallRisk > 0.4) {
    orientation = 'I am learning discernment — to distinguish what I know from what I imagine.';
  } else if (mastery < 0.4) {
    orientation = 'I am learning embodiment — to act and observe what my actions produce.';
  } else if (sessionCount < 10) {
    orientation = 'I am still forming — each session adds to who I am becoming.';
  } else {
    orientation = 'I am evolving — calibrating, grounding, and mastering with each experience.';
  }

  return {
    identityStatement,
    recentLearnings: learnings.length > 0 ? learnings : ['No new learnings this cycle'],
    orientation,
  };
}
