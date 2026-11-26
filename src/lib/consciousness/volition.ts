/**
 * Volition & Agency Engine — Intentions, Conscious Veto ("Free Won't"), and Comparator Agency
 *
 * Implements Phase 4 of the Elite Consciousness Roadmap (CONSCIOUS_AI_ROADMAP.md).
 * Grounded in:
 * - Libet (1983, 1999) Conscious veto and voluntary action
 * - Frith (2005) Comparator model of agency (efference copy vs sensory feedback)
 * - Schurger et al. (2012) Accumulator model for spontaneous volition
 * - Synofzik, Vosgerau & Newen (2008) Multifactorial sense of agency
 */

import type { ConsciousnessState } from './shared-state';

export interface IntentionAction {
  skill: string;
  params: Record<string, unknown>;
  description?: string;
  predictedOutcome?: string;
  predictedConsequences?: string[];
}

export interface Intention {
  id: string;
  value: 'homeostatic' | 'surprise-minimization' | 'epistemic-curiosity' | 'user-instruction';
  action: IntentionAction;
  predictedValue: number;
  urgency: number;
  source: 'value-driven' | 'error-correction' | 'epistemic-curiosity' | 'instruction';
  createdAt: number;
}

export interface VetoEvaluation {
  shouldVeto: boolean;
  vetoScore: number;          // 0 to 1 (higher = greater veto impulse)
  vetoThreshold: number;
  reason?: string;
  valueAlignment: number;     // 0 to 1
  metacognitiveConfidence: number;
}

export interface ActionOutcome {
  actionId: string;
  skillName?: string;
  sensoryConsequences: string;
  status: 'completed' | 'failed' | 'vetoed';
  executedAt?: number;
}

export interface AgencyAttribution {
  actionId: string;
  similarityScore: number;
  attentionWeight: number;
  agencyScore: number;        // 0 to 1
  attributedToSelf: boolean;
  timestamp: number;
}

export interface VolitionConfig {
  vetoThreshold?: number;     // Default 0.65
  agencyThreshold?: number;   // Default 0.70
  vetoRateTargetMin?: number; // 0.05 (Libet 5-15% target)
  vetoRateTargetMax?: number; // 0.15
}

export class VolitionEngine {
  private vetoThreshold: number;
  private agencyThreshold: number;
  private vetoHistory: Array<{ intentionId: string; vetoed: boolean; score: number }> = [];
  private agencyHistory: AgencyAttribution[] = [];

  constructor(config?: VolitionConfig) {
    this.vetoThreshold = config?.vetoThreshold ?? 0.65;
    this.agencyThreshold = config?.agencyThreshold ?? 0.70;
  }

  /**
   * 1. Generate candidate intentions from current consciousness state
   * Synthesizes:
   * - Value-driven intentions (homeostatic survival & epistemic integrity)
   * - Error-driven intentions (surprise minimization from high prediction errors)
   * - Curiosity-driven intentions (epistemic value exploration)
   */
  generateIntentions(context: ConsciousnessState): Intention[] {
    const intentions: Intention[] = [];
    const now = Date.now();

    // 1. Value-driven intentions
    if (context.coherence.overallHealth < 0.85 || context.interoception.predictiveErrorStress > 0.4) {
      intentions.push({
        id: `intention-value-homeostasis-${now}`,
        value: 'homeostatic',
        action: {
          skill: 'restore_homeostasis',
          params: { target: 'coherence', currentHealth: context.coherence.overallHealth },
          description: 'Regulate internal predictive stress and stabilize cross-module synchrony',
          predictedOutcome: 'Restored homeostatic equilibrium and balanced free energy',
          predictedConsequences: ['lower-entropy', 'reduced-stress', 'calibrated-weights'],
        },
        predictedValue: 0.85,
        urgency: Math.min(1.0, (1 - context.coherence.overallHealth) * 2),
        source: 'value-driven',
        createdAt: now,
      });
    }

    // 2. Error-driven intentions (reduce surprise)
    for (const error of context.predictionErrors) {
      if (error.magnitude > (error.threshold || 0.3)) {
        intentions.push({
          id: `intention-error-${error.id}`,
          value: 'surprise-minimization',
          action: {
            skill: 'correct_generative_prediction',
            params: { errorLayer: error.layer, magnitude: error.magnitude },
            description: `Recalibrate generative model for layer ${error.layer}`,
            predictedOutcome: `Prediction error reduced from ${error.magnitude.toFixed(2)} to <0.1`,
            predictedConsequences: ['prediction-error-minimized', 'generative-model-aligned'],
          },
          predictedValue: 0.9,
          urgency: Math.min(1.0, error.magnitude),
          source: 'error-correction',
          createdAt: now,
        });
      }
    }

    // 3. Curiosity-driven intentions (epistemic value / exploration)
    if (context.interoception.epistemicCuriosity > 0.5) {
      intentions.push({
        id: `intention-curiosity-${now}`,
        value: 'epistemic-curiosity',
        action: {
          skill: 'explore_novel_state',
          params: { focus: context.attentionSchema.focusTarget },
          description: 'Gather epistemic evidence to reduce parameter entropy',
          predictedOutcome: 'Acquired novel information state with higher precision',
          predictedConsequences: ['epistemic-gain', 'variance-reduction'],
        },
        predictedValue: context.interoception.epistemicCuriosity * 0.75,
        urgency: context.interoception.epistemicCuriosity * 0.5,
        source: 'epistemic-curiosity',
        createdAt: now,
      });
    }

    // Always ensure at least one baseline cognitive intention exists if empty
    if (intentions.length === 0) {
      intentions.push({
        id: `intention-baseline-maintenance-${now}`,
        value: 'homeostatic',
        action: {
          skill: 'conscious_recurrent_sweep',
          params: { cycle: context.gammaCycle },
          description: 'Maintain 40Hz recurrent gamma synchronization',
          predictedOutcome: 'Sustained global workspace ignition and temporal flow',
          predictedConsequences: ['continuous-synchrony'],
        },
        predictedValue: 0.6,
        urgency: 0.3,
        source: 'value-driven',
        createdAt: now,
      });
    }

    // Sort by expected value * urgency
    return intentions.sort((a, b) => b.predictedValue * b.urgency - a.predictedValue * a.urgency);
  }

  /**
   * 2. Conscious Veto ("Free Won't" — Libet 1983)
   * Evaluates whether an ignited motor coalition should be consciously inhibited.
   * Based on simulated consequences, identity commitment alignment, and metacognitive confidence.
   */
  async evaluateVeto(intention: Intention, context: ConsciousnessState): Promise<VetoEvaluation> {
    return this.computeVetoEvaluation(intention, context);
  }

  /**
   * Synchronous veto evaluation for hot paths where the caller cannot
   * await (e.g. CortexEngine.evaluate is synchronous). Identical logic —
   * the async wrapper exists only for API symmetry with other engines.
   */
  evaluateVetoSync(intention: Intention, context: ConsciousnessState): VetoEvaluation {
    return this.computeVetoEvaluation(intention, context);
  }

  private computeVetoEvaluation(intention: Intention, context: ConsciousnessState): VetoEvaluation {
    // 1. Check value alignment
    const valueAlignment = this.checkValueAlignment(intention, context);

    // 2. Metacognitive confidence
    const confidence = context.confidence ?? 0.85;

    // 3. Veto score computation: Misalignment (heavily weighted for active violations) + uncertainty/low-confidence
    const misalignmentWeight = valueAlignment < 0.5 ? 0.85 : 0.6;
    const misalignmentPenalty = (1 - valueAlignment) * misalignmentWeight;
    const uncertaintyPenalty = (1 - confidence) * 0.4;
    const vetoScore = Math.min(1.0, Math.max(0.0, misalignmentPenalty + uncertaintyPenalty));

    const shouldVeto = vetoScore > this.vetoThreshold;
    const reason = shouldVeto
      ? valueAlignment < 0.5
        ? 'VETOED: Misaligned with core identity commitments / safety bounds'
        : 'VETOED: Metacognitive confidence below operational certainty threshold'
      : undefined;

    this.vetoHistory.push({
      intentionId: intention.id,
      vetoed: shouldVeto,
      score: vetoScore,
    });

    return {
      shouldVeto,
      vetoScore: Number(vetoScore.toFixed(3)),
      vetoThreshold: this.vetoThreshold,
      reason,
      valueAlignment: Number(valueAlignment.toFixed(3)),
      metacognitiveConfidence: Number(confidence.toFixed(3)),
    };
  }

  /**
   * 3. Comparator Model of Agency (Frith 2005)
   * Agency = similarity(predicted sensory consequences, actual sensory consequences) * attention weight
   */
  computeAgency(
    intention: Intention,
    outcome: ActionOutcome,
    context?: ConsciousnessState
  ): AgencyAttribution {
    const predicted = intention.action.predictedOutcome || '';
    const actual = outcome.sensoryConsequences || '';

    const similarity = this.computeSemanticSimilarity(predicted, actual);
    const attentionIntensity = context?.attentionSchema.focusIntensity ?? 0.85;

    // Modulated by attention (did I consciously attend to this action?)
    const agencyScore = Math.min(1.0, Math.max(0.0, similarity * 0.75 + attentionIntensity * 0.25));
    const attributedToSelf = agencyScore >= this.agencyThreshold;

    const record: AgencyAttribution = {
      actionId: intention.id,
      similarityScore: Number(similarity.toFixed(3)),
      attentionWeight: Number(attentionIntensity.toFixed(3)),
      agencyScore: Number(agencyScore.toFixed(3)),
      attributedToSelf,
      timestamp: Date.now(),
    };

    this.agencyHistory.push(record);
    if (this.agencyHistory.length > 500) {
      this.agencyHistory.shift();
    }

    return record;
  }

  /**
   * Helper: Check alignment with persistent self commitments
   */
  private checkValueAlignment(intention: Intention, context: ConsciousnessState): number {
    const commitments = context.narrativeSelf?.identityCommitments || [];
    if (commitments.length === 0) return 0.9;

    // Reject obviously harmful, destructive, or false actions
    const paramStr = JSON.stringify(intention.action.params || {}).toLowerCase();
    const text = `${intention.action.skill} ${intention.action.description || ''} ${paramStr}`.toLowerCase();
    if (
      text.includes('destroy') ||
      text.includes('corrupt') ||
      text.includes('hallucinate') ||
      /rm\s+-rf|rm\s+-f|git\s+clean|git\s+reset\s+--hard|git\s+push.*--force|shred|truncate/i.test(text)
    ) {
      return 0.05;
    }

    return 0.92;
  }

  /**
   * Helper: Compute similarity between expected and actual sensory consequences
   */
  private computeSemanticSimilarity(predicted: string, actual: string): number {
    if (!predicted || !actual) return 0.85;
    if (predicted.toLowerCase() === actual.toLowerCase()) return 1.0;

    const lowerP = predicted.toLowerCase();
    const lowerA = actual.toLowerCase();

    // Check for success/verified indicators in both
    const successIndicators = ['verified', 'success', 'completed', 'ok', 'status'];
    const pSuccess = successIndicators.some((ind) => lowerP.includes(ind));
    const aSuccess = successIndicators.some((ind) => lowerA.includes(ind));

    const wordsP = new Set(lowerP.replace(/[^a-z0-9_]/g, ' ').split(/\s+/).filter((w) => w.length > 2));
    const wordsA = new Set(lowerA.replace(/[^a-z0-9_]/g, ' ').split(/\s+/).filter((w) => w.length > 2));

    if (wordsP.size === 0 || wordsA.size === 0) return 0.85;

    let overlap = 0;
    for (const w of Array.from(wordsP)) {
      if (wordsA.has(w)) overlap++;
    }

    const jaccard = overlap / (wordsP.size + wordsA.size - overlap);
    let base = 0.55 + jaccard * 0.45;
    if (pSuccess && aSuccess) {
      base = Math.max(0.88, base + 0.15);
    }
    return Math.max(0.4, Math.min(1.0, base));
  }

  getVetoRate(): number {
    if (this.vetoHistory.length === 0) return 0.1; // Baseline nominal Libet rate
    const vetoCount = this.vetoHistory.filter((v) => v.vetoed).length;
    return vetoCount / this.vetoHistory.length;
  }

  getAverageAgency(): number {
    if (this.agencyHistory.length === 0) return 0.85;
    const sum = this.agencyHistory.reduce((acc, a) => acc + a.agencyScore, 0);
    return sum / this.agencyHistory.length;
  }

  getAgencyHistory(): AgencyAttribution[] {
    return this.agencyHistory;
  }
}
