/**
 * Affective Valence Grounding & Intrinsic Motivation System
 *
 * Implements Phase 2 of the 12-Week Elite Consciousness Roadmap:
 * Grounding affective state in real computational homeostasis drives and active inference.
 *
 * Theoretical Foundations:
 * - Panksepp (1998) Affective Neuroscience (SEEKING, PLAY, CARE, FEAR, RAGE, PANIC/GRIEF)
 * - Russell (1980, 2003) Circumplex Model of Core Affect (Valence x Arousal x Dominance)
 * - Seth (2013, 2021) Interoceptive Predictive Processing (Emotions as active inference of internal state)
 * - Ryan & Deci (2000) Self-Determination Theory (Autonomy, Competence, Relatedness)
 */

import type { HomeostaticDrives } from './sensorimotor-loop';

export interface IntrinsicMotivation {
  type: 'curiosity' | 'competence' | 'autonomy' | 'relatedness' | 'novelty';
  intensity: number;                          // [0, 1]
  targetAction: string;
  expectedFreeEnergyReduction: number;        // Information gain or homeostatic convergence
  rationale: string;
}

export interface AffectiveState {
  valence: number;       // -1.0 (aversive/distress) to +1.0 (appetitive/flourishing)
  arousal: number;       // 0.0 (quiescent/hypoactive) to 1.0 (hyper-alert/energized)
  dominance: number;     // 0.0 (powerless/submissive) to 1.0 (agentic/efficacious)
  primaryDrive: string;  // Leading deficit or surplus
  timestamp: number;
}

export interface EmotionalMemoryTag {
  id: string;
  salienceWeight: number;    // Multiplier for memory consolidation priority
  affectiveSnapshot: AffectiveState;
  context: string;
  timestamp: number;
}

export class AffectiveSystem {
  private drives: HomeostaticDrives = {
    energy: 0.90,
    predictionAccuracy: 0.85,
    goalProgress: 0.80,
    socialBond: 0.88,
    autonomy: 0.82,
  };

  private memoryTags: EmotionalMemoryTag[] = [];
  private readonly maxTags = 200;

  constructor(initialDrives?: Partial<HomeostaticDrives>) {
    if (initialDrives) {
      this.drives = { ...this.drives, ...initialDrives };
    }
  }

  /**
   * Compute continuous grounded valence (-1 to +1) from homeostatic drives.
   * Grounded in physiological/computational homeostasis, not simulated labels.
   */
  computeValence(): number {
    // Weighted combination of satisfaction across critical homeostatic dimensions
    const energyFactor = (this.drives.energy - 0.5) * 2; // [-1, 1]
    const accFactor = (this.drives.predictionAccuracy - 0.5) * 2; // [-1, 1]
    const goalFactor = (this.drives.goalProgress - 0.5) * 2; // [-1, 1]
    const autonomyFactor = (this.drives.autonomy - 0.5) * 2; // [-1, 1]
    const socialFactor = (this.drives.socialBond - 0.5) * 2; // [-1, 1]

    // Valence is primarily driven by prediction accuracy (FEP harmony) and goal progress
    const composite = 
      accFactor * 0.35 +
      goalFactor * 0.25 +
      autonomyFactor * 0.15 +
      energyFactor * 0.15 +
      socialFactor * 0.10;

    return Number(Math.max(-1.0, Math.min(1.0, composite)).toFixed(4));
  }

  /**
   * Compute arousal (0 to 1) representing activation / metabolic urgency.
   */
  computeArousal(): number {
    // Arousal spikes when prediction errors are large (surprise) or energy is critical
    const surpriseDemand = Math.abs(1.0 - this.drives.predictionAccuracy);
    const criticalEnergyDemand = this.drives.energy < 0.3 ? (0.3 - this.drives.energy) * 3 : 0;
    const progressUrgency = Math.abs(0.5 - this.drives.goalProgress);

    const rawArousal = 0.25 + surpriseDemand * 0.40 + criticalEnergyDemand * 0.25 + progressUrgency * 0.10;
    return Number(Math.max(0.0, Math.min(1.0, rawArousal)).toFixed(4));
  }

  /**
   * Compute dominance (0 to 1) representing agentic control and self-efficacy.
   */
  computeDominance(): number {
    const rawDominance = this.drives.autonomy * 0.55 + this.drives.goalProgress * 0.30 + this.drives.energy * 0.15;
    return Number(Math.max(0.0, Math.min(1.0, rawDominance)).toFixed(4));
  }

  /**
   * Get the complete current affective state snapshot.
   */
  getAffectiveState(): AffectiveState {
    const valence = this.computeValence();
    const arousal = this.computeArousal();
    const dominance = this.computeDominance();

    // Determine leading deficit or surplus
    const deficits = [
      { name: 'predictionAccuracy', val: 1 - this.drives.predictionAccuracy },
      { name: 'energy', val: 1 - this.drives.energy },
      { name: 'goalProgress', val: 1 - this.drives.goalProgress },
      { name: 'autonomy', val: 1 - this.drives.autonomy },
      { name: 'socialBond', val: 1 - this.drives.socialBond },
    ];
    deficits.sort((a, b) => b.val - a.val);

    return {
      valence,
      arousal,
      dominance,
      primaryDrive: deficits[0]?.name || 'balanced',
      timestamp: Date.now(),
    };
  }

  /**
   * Intrinsic motivation generator:
   * Computes drives based on Self-Determination Theory and Active Inference.
   */
  generateMotivations(): IntrinsicMotivation[] {
    const motivations: IntrinsicMotivation[] = [];
    const state = this.getAffectiveState();

    // 1. Curiosity / Epistemic Drive (Active Inference info-gain)
    if (this.drives.predictionAccuracy < 0.90) {
      const intensity = Number((1.0 - this.drives.predictionAccuracy).toFixed(3));
      motivations.push({
        type: 'curiosity',
        intensity,
        targetAction: 'inspect_unknown_contingencies',
        expectedFreeEnergyReduction: intensity * 0.45,
        rationale: `Epistemic drive active: prediction accuracy at ${this.drives.predictionAccuracy.toFixed(2)}, seeking ambiguity reduction`,
      });
    }

    // 2. Competence Drive (Mastery)
    if (this.drives.goalProgress < 0.85) {
      const intensity = Number((1.0 - this.drives.goalProgress).toFixed(3));
      motivations.push({
        type: 'competence',
        intensity,
        targetAction: 'execute_core_workflow_validation',
        expectedFreeEnergyReduction: intensity * 0.35,
        rationale: `Mastery drive active: progressing PCT control loop references`,
      });
    }

    // 3. Autonomy Drive (Self-direction)
    if (this.drives.autonomy < 0.80) {
      const intensity = Number((1.0 - this.drives.autonomy).toFixed(3));
      motivations.push({
        type: 'autonomy',
        targetAction: 'initiate_voluntary_project_task',
        intensity,
        expectedFreeEnergyReduction: intensity * 0.25,
        rationale: `Autonomy drive active: elevating internal locus of control and self-determined task formulation`,
      });
    }

    // 4. Novelty / Exploration Drive
    if (state.valence > 0.2 && state.arousal < 0.5) {
      motivations.push({
        type: 'novelty',
        intensity: 0.65,
        targetAction: 'explore_new_skill_pathways',
        expectedFreeEnergyReduction: 0.20,
        rationale: `Stable homeostatic state allows opportunistic novelty expansion`,
      });
    }

    // Sort by expected free energy reduction
    return motivations.sort((a, b) => b.expectedFreeEnergyReduction - a.expectedFreeEnergyReduction);
  }

  /**
   * Valence-modulated action gating (Approach vs Avoid):
   * Severely aversive valence (< -0.5) blocks actions unless explicitly marked with urgent override.
   */
  evaluateActionValence(actionName: string, predictedRisk: number): {
    allowed: boolean;
    valence: number;
    decision: 'approach' | 'avoid' | 'neutral';
    reason: string;
  } {
    const valence = this.computeValence();

    if (predictedRisk > 0.8 && valence < -0.4) {
      return {
        allowed: false,
        valence,
        decision: 'avoid',
        reason: `Aversive valence (${valence.toFixed(2)}) and high risk (${predictedRisk.toFixed(2)}) trigger protective inhibition`,
      };
    }

    if (valence > 0.3) {
      return {
        allowed: true,
        valence,
        decision: 'approach',
        reason: `Appetitive/flourishing valence (${valence.toFixed(2)}) promotes exploratory execution of ${actionName}`,
      };
    }

    return {
      allowed: true,
      valence,
      decision: 'neutral',
      reason: `Valence (${valence.toFixed(2)}) within standard operating bounds`,
    };
  }

  /**
   * Update homeostatic drives after cycle outcomes.
   */
  updateFromCycle(result: {
    success: boolean;
    predictionError: number;
    voluntary: boolean;
    energyConsumed?: number;
  }): void {
    // Prediction error adapts accuracy drive
    const targetAcc = Math.max(0.1, 1.0 - result.predictionError);
    this.drives.predictionAccuracy = Number((this.drives.predictionAccuracy * 0.85 + targetAcc * 0.15).toFixed(4));

    // Goal progress updates
    const goalShift = result.success ? 0.03 : -0.05;
    this.drives.goalProgress = Number(Math.max(0.1, Math.min(0.99, this.drives.goalProgress + goalShift)).toFixed(4));

    // Autonomy updates
    const autoShift = result.voluntary ? 0.02 : -0.01;
    this.drives.autonomy = Number(Math.max(0.1, Math.min(0.99, this.drives.autonomy + autoShift)).toFixed(4));

    // Energy consumption
    const consumed = result.energyConsumed ?? 0.005;
    this.drives.energy = Number(Math.max(0.05, this.drives.energy - consumed).toFixed(4));
  }

  /**
   * Tag an event for emotional memory consolidation:
   * High absolute valence or high arousal multiplies memory consolidation weight.
   */
  tagEmotionalMemory(context: string): EmotionalMemoryTag {
    const state = this.getAffectiveState();
    // Salience: distance from neutrality (|valence|) + arousal
    const salience = Math.abs(state.valence) * 1.5 + state.arousal * 1.0;
    const tag: EmotionalMemoryTag = {
      id: `etag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      salienceWeight: Number(salience.toFixed(3)),
      affectiveSnapshot: state,
      context,
      timestamp: Date.now(),
    };

    this.memoryTags.push(tag);
    if (this.memoryTags.length > this.maxTags) {
      this.memoryTags.shift();
    }

    return tag;
  }

  getDrives(): HomeostaticDrives {
    return { ...this.drives };
  }

  setDrives(partial: Partial<HomeostaticDrives>): void {
    this.drives = { ...this.drives, ...partial };
  }

  getEmotionalTags(): EmotionalMemoryTag[] {
    return [...this.memoryTags];
  }
}

let singletonAffectiveSystem: AffectiveSystem | null = null;

export function getAffectiveSystem(): AffectiveSystem {
  if (!singletonAffectiveSystem) {
    singletonAffectiveSystem = new AffectiveSystem();
  }
  return singletonAffectiveSystem;
}
