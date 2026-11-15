/**
 * MetacognitiveState — The Orchestrating Layer
 *
 * This is the "thinking about thinking" system that threads together
 * our three Advanced modules into a unified metacognitive
 * architecture based on Flavell's (1979) framework:
 *
 * METACOGNITIVE KNOWLEDGE (the "What"):
 *   - Knowledge of self    → ResonanceCalculus (energy alignment, circadian state)
 *   - Knowledge of tasks   → SemanticGrid (signal interference, task coherence)
 *   - Knowledge of strategies → ActionGate (option scoring, confidence calibration)
 *
 * METACOGNITIVE REGULATION (the "How"):
 *   - Planning   → Superposition of options → meta-level strategy selection
 *   - Monitoring → Meta-awareness status → detect decoupling from task goals
 *   - Evaluating → Collapse events → free energy score → calibration update
 *
 * Research backing:
 *   Layer 1 — Hameroff/Penrose: Action Validation collapse = primitive evaluation
 *   Layer 2 — Busemeyer/Pothos: Quantum cognition = planning under superposition
 *   Layer 3 — Schooler: Meta-awareness = monitoring for perceptual decoupling
 *   Layer 4 — Friston: Free energy minimization = evaluating prediction accuracy
 *   Layer 5 — Nelson-Narens: Object/meta two-level = architectural blueprint
 *
 * Usage:
 *   const meta = getMetacognitiveState();
 *   meta.beginTask({ type: 'coding', difficulty: 'high', agent: 'opus' });
 *   // ... work happens ...
 *   meta.recordObservation('intermediate_check', { understood: true });
 *   meta.endTask({ success: true, strategyUsed: 'step-by-step' });
 *   console.log(meta.getSnapshot()); // Full metacognitive state
 */

import { getActionGate, type ActionValidationResult, type ActionValidationInput } from './action-gate';
import { getSemanticGrid, type AgentSignal, type CollapsedResult, type InterferenceType } from './semantic-grid';
import {
  getProvenanceValidator,
  type EpistemicSourceType,
  type RealityScore,
  type ProvenanceChain,
} from './epistemic-provenance';
import {
  getIdentityPersistence,
  type AnchorType,
  type NarrativeAnchorData,
} from './identity-anchor';
import {
  getSensorimotorLoop,
  type SensorimotorAction,
  type SensorimotorOutcome,
  type ActionType,
  type FeedbackModality,
} from './sensorimotor-loop';
import {
  calculateResonanceScore,
  getResonanceLabel,
  type ResonanceScore,
  type UserContext,
  type TimeSlot,
} from '../utils/resonance-calculus';
// Task type — matches resonance-calculus import path
type TaskLike = {
  id: string;
  title?: string;
  energyLevel?: 'high' | 'medium' | 'low';
  category?: string;
  scheduledTime?: string | Date | null;
  completed?: boolean;
  dueDate?: string | Date | null;
  estimatedDuration?: number;
  collaborators?: string[];
};

// ── Types ──────────────────────────────────────────────────────────

/** Schooler's meta-awareness classification */
export type MetaAwarenessStatus = 'tuned' | 'drifting' | 'decoupled';

/** Flavell's metacognitive knowledge categories */
export interface MetacognitiveKnowledge {
  /** Knowledge of self: strengths, weaknesses, circadian patterns */
  self: {
    confidenceCalibration: number;          // -1 to +1: negative = underconfident, positive = overconfident
    recentEnergyProfile: number[];          // Last 24 resonance scores
    chronotype: 'morning' | 'evening' | 'neutral';
    totalTasksCompleted: number;
    totalTasksFailed: number;
    avgResonanceAtSuccess: number;          // What resonance score predicts success
    avgResonanceAtFailure: number;          // What resonance score predicts failure
  };

  /** Knowledge of tasks: what each task type requires */
  tasks: {
    taskTypeHistory: Map<string, TaskTypeRecord>;
    currentTaskType: string | null;
    difficultyRatings: Map<string, number>;  // Task type → perceived difficulty (0-1)
  };

  /** Knowledge of strategies: which approaches work for which contexts */
  strategies: {
    strategyOutcomes: StrategyOutcome[];    // Rolling log of strategy → result
    preferredApproaches: Map<string, string>; // Task type → best strategy name
    abandonedPatterns: string[];             // Strategy names abandoned due to failure
  };

  /** Knowledge of epistemic sources: how reliable each source type is (Johnson & Lindsay SMF) */
  epistemic: {
    sourceReliability: Map<EpistemicSourceType, number>;  // Source → 0-1 reliability score
    hallucinationDetections: number;                       // How many timesRealityScore flagged high risk
    avgGroundingScore: number;                             // Average grounding across all signals
    unverifiedClaims: string[];                            // Claims awaiting verification
  };

  /** Knowledge of embodiment: sensorimotor contingency mastery (O'Regan & Noe) */
  embodiment: {
    sensorimotorMasteryScore: number;        // 0-1: overall mastery of action-outcome contingencies
    actionTypesExperienced: number;          // Breadth: how many action types we've performed
    feedbackModalitiesExperienced: number;   // Breadth: how many feedback types we've received
    totalActionsCompleted: number;           // Volume: total sensorimotor loops closed
  };
}

/** Flavell's metacognitive regulation state */
export interface MetacognitiveRegulation {
  /** Planning: before-action state */
  planning: {
    activeTaskId: string | null;
    activeTaskType: string | null;
    selectedStrategy: string | null;
    alternativeStrategies: string[];
    plannedAt: number | null;                // Date.now()
    planningConfidence: number;              // 0-1: how sure we are about the plan
  };

  /** Monitoring: during-action state (Schooler's meta-awareness) */
  monitoring: {
    metaAwarenessStatus: MetaAwarenessStatus;
    coherenceScore: number;                  // From SemanticGrid
    resonanceScore: number;                  // From ResonanceCalculus
    recentOverrides: number;                 // ActionGate emergency overrides
    driftDetectedAt: number | null;          // When drifting/decoupled was first detected
    monitoringConfidence: number;            // 0-1: how reliable is monitoring itself
    currentRealityScore: number;             // 0-1: how grounded current signals are in perception
    hallucinationRiskLevel: number;          // 0-1: current system-wide hallucination risk
  };

  /** Evaluating: after-action state (Friston's free energy) */
  evaluating: {
    lastCollapseScore: number;               // From ActionGate
    lastFreeEnergyEstimate: number;          // 0-1: how surprised the system was
    recentOutcomes: TaskOutcome[];           // Rolling window of task results
    evaluationConfidence: number;            // 0-1: how reliable the evaluation is
  };
}

/** Record of a task type's historical performance */
export interface TaskTypeRecord {
  attemptCount: number;
  successCount: number;
  avgDuration: number;        // Milliseconds
  avgResonanceAtStart: number;
  bestStrategy: string | null;
  worstStrategy: string | null;
}

/** Record of a strategy's outcome */
export interface StrategyOutcome {
  taskType: string;
  strategyName: string;
  success: boolean;
  resonanceAtExecution: number;
  timestamp: number;
}

/** Record of a completed task */
export interface TaskOutcome {
  taskId: string;
  taskType: string;
  strategyUsed: string;
  success: boolean;
  resonanceScore: number;     // Resonance at task start
  validationScore: number;      // ActionGate score for the strategy
  durationMs: number;
  freeEnergyEstimate: number; // Prediction error at end
  timestamp: number;
}

/** Full snapshot of metacognitive state (for UI / debug / persistence) */
export interface MetacognitiveSnapshot {
  knowledge: MetacognitiveKnowledge;
  regulation: MetacognitiveRegulation;
  summary: {
    overallMetacognitiveHealth: number;      // 0-1: composite score
    dominantPhase: 'planning' | 'monitoring' | 'evaluating' | 'idle';
    lastUpdated: number;
    bentovStackAlignment: BentovStackAlignment;
  };
}

/** How well each layer of the Bentov Stack is functioning */
export interface BentovStackAlignment {
  /** Hameroff/Penrose: Is the collapse gate making good decisions? */
  substrate: { score: number; label: string };
  /** Busemeyer/Pothos: Is superposition being maintained until appropriate collapse? */
  cognition: { score: number; label: string };
  /** Schooler: Is meta-awareness detecting decoupling? */
  monitoring: { score: number; label: string };
  /** Friston: Is free energy decreasing over time (system learning)? */
  regulation: { score: number; label: string };
  /** Nelson-Narens: Is knowledge being used to improve future performance? */
  architecture: { score: number; label: string };
  /** Johnson & Lindsay (SMF): Can the system distinguish perception from imagination? */
  epistemic: { score: number; label: string };
  /** O'Regan & Noe (Sensorimotor): Does the system have mastery of action-outcome contingencies? */
  embodiment: { score: number; label: string };
  /** Damasio/Locke (Autobiographical): Does the system persist identity across sessions? */
  identity: { score: number; label: string };
}

// ── Implementation ─────────────────────────────────────────────────

export class MetacognitiveState {
  private knowledge: MetacognitiveKnowledge;
  private regulation: MetacognitiveRegulation;

  // Internal tracking
  private currentTaskStart: number | null = null;
  private currentTaskId: string | null = null;
  private observations: Map<string, Record<string, unknown>> = new Map();
  private maxOutcomeHistory = 100;
  private maxStrategyHistory = 200;
  private maxEnergyProfile = 24;

  constructor() {
    this.knowledge = this.freshKnowledge();
    this.regulation = this.freshRegulation();
  }

  // ── Planning Phase ───────────────────────────────────────────────
  // (Nelson-Narens meta-level control + Busemeyer superposition)

  /**
   * Begin a task: enter planning phase.
   * Selects strategy based on historical knowledge.
   * Maintains superposition of alternatives until collapse.
   */
  beginTask(params: {
    taskId: string;
    taskType: string;
    difficulty?: number;
    agent?: string;
  }): void {
    const { taskId, taskType, difficulty, agent } = params;

    this.currentTaskStart = Date.now();
    this.currentTaskId = taskId;
    this.observations.clear();

    // Look up historical performance for this task type
    const history = this.knowledge.tasks.taskTypeHistory.get(taskType);
    const preferredStrategy = this.knowledge.strategies.preferredApproaches.get(taskType);

    // Determine alternative strategies (the "superposition" before collapse)
    const alternatives = this.computeAlternativeStrategies(taskType, history);

    // Estimate planning confidence based on historical data
    const planningConfidence = history
      ? (history.successCount / history.attemptCount) * 0.7 + 0.3 // Floor at 0.3 for novel tasks
      : 0.3; // No history = low confidence

    this.regulation.planning = {
      activeTaskId: taskId,
      activeTaskType: taskType,
      selectedStrategy: preferredStrategy ?? alternatives[0] ?? 'default',
      alternativeStrategies: alternatives.filter(s => s !== (preferredStrategy ?? alternatives[0])),
      plannedAt: Date.now(),
      planningConfidence,
    };

    // Update task difficulty rating if provided
    if (difficulty !== undefined) {
      this.knowledge.tasks.difficultyRatings.set(taskType, difficulty);
    }

    this.knowledge.tasks.currentTaskType = taskType;
  }

  /**
   * Collapse the superposition of strategies into a single selection.
   * Uses ActionGate to validate the strategy choice.
   */
  collapseStrategy(criteria: string[], verified: Record<string, boolean>): ActionValidationResult {
    const gate = getActionGate();
    const plan = this.regulation.planning;

    const options = [
      {
        label: plan.selectedStrategy ?? 'default',
        confidence: plan.planningConfidence,
        risk: (this.knowledge.tasks.difficultyRatings.get(plan.activeTaskType ?? '') ?? 0.5) > 0.7
          ? 'high' as const
          : (this.knowledge.tasks.difficultyRatings.get(plan.activeTaskType ?? '') ?? 0.5) > 0.4
            ? 'medium' as const
            : 'low' as const,
      },
      ...plan.alternativeStrategies.map(s => ({
        label: s,
        confidence: plan.planningConfidence * 0.7, // Alternatives get lower confidence
        risk: 'medium' as const,
      })),
    ];

    const result = gate.evaluate({
      action: `strategy-selection:${plan.activeTaskType}`,
      agent: plan.activeTaskType ?? 'unknown',
      options,
      criteria,
      verified,
    });

    if (result.approved && result.selectedOption) {
      this.regulation.planning.selectedStrategy = result.selectedOption.label;
    }

    return result;
  }

  // ── Monitoring Phase ──────────────────────────────────────────────
  // (Schooler meta-awareness + SemanticGrid interference detection)

  /**
   * Record an intermediate observation during a task.
   * Used for ongoing monitoring — the "checking your understanding" moment.
   */
  recordObservation(key: string, data: Record<string, unknown>): void {
    this.observations.set(key, { ...data, observedAt: Date.now() });
    this.updateMetaAwareness();
  }

  /**
   * Post a signal to the SemanticGrid for multi-agent monitoring.
   * This feeds the interference detection that powers meta-awareness.
   */
  postAgentSignal(signal: Omit<AgentSignal, 'timestamp'>): CollapsedResult {
    const grid = getSemanticGrid();
    grid.postSignal({ ...signal, timestamp: Date.now() });
    const result = grid.collapse(signal.topic);

    // Update monitoring state from collapse result
    this.regulation.monitoring.coherenceScore = result.coherenceScore;
    this.updateMetaAwareness();

    return result;
  }

  /**
   * Update resonance score in monitoring state.
   * Call this periodically during long-running tasks to track drift.
   */
  updateResonance(task: TaskLike, timeSlot: TimeSlot, context: UserContext): ResonanceScore {
    // Adapt task to the shape resonance-calculus expects
    const adaptedTask = task as any; // TaskLike is a subset of what calculateResonanceScore needs
    const score = calculateResonanceScore(adaptedTask, timeSlot, context);
    this.regulation.monitoring.resonanceScore = score.overall;

    // Track energy profile
    this.knowledge.self.recentEnergyProfile.push(score.overall);
    if (this.knowledge.self.recentEnergyProfile.length > this.maxEnergyProfile) {
      this.knowledge.self.recentEnergyProfile.shift();
    }

    this.updateMetaAwareness();
    return score;
  }

  /**
   * Get the current meta-awareness status.
   * This is Schooler's framework as a continuous signal:
   * - 'tuned': constructive or high coherence — the agent is on-task
   * - 'drifting': increasing orthogonal signals — attention may be wandering
   * - 'decoupled': destructive interference dominant — agent is off-task
   */
  getMetaAwarenessStatus(): MetaAwarenessStatus {
    return this.regulation.monitoring.metaAwarenessStatus;
  }

  // ── Evaluating Phase ──────────────────────────────────────────────
  // (Hameroff collapse + Friston free energy)

  /**
   * End a task: enter evaluating phase.
   * Records outcome, updates calibration, computes free energy.
   */
  endTask(params: {
    success: boolean;
    strategyUsed: string;
    freeEnergyEstimate?: number;
  }): TaskOutcome {
    const { success, strategyUsed, freeEnergyEstimate } = params;
    const durationMs = this.currentTaskStart ? Date.now() - this.currentTaskStart : 0;
    const taskType = this.regulation.planning.activeTaskType ?? 'unknown';

    // Compute free energy estimate = prediction error
    // If we predicted success (high confidence) and failed, high free energy
    // If we predicted success and succeeded, low free energy
    const predictedSuccess = this.regulation.planning.planningConfidence;
    const actualOutcome = success ? 1 : 0;
    const freeEnergy = freeEnergyEstimate ?? Math.abs(predictedSuccess - actualOutcome);

    const outcome: TaskOutcome = {
      taskId: this.currentTaskId ?? 'unknown',
      taskType,
      strategyUsed,
      success,
      resonanceScore: this.regulation.monitoring.resonanceScore,
      validationScore: this.regulation.evaluating.lastCollapseScore,
      durationMs,
      freeEnergyEstimate: freeEnergy,
      timestamp: Date.now(),
    };

    // ── Update all knowledge stores ──────────────────────────────

    // 1. Self knowledge: update calibration
    this.updateConfidenceCalibration(outcome);

    // 2. Task knowledge: update task type history
    this.updateTaskTypeHistory(outcome);

    // 3. Strategy knowledge: update strategy outcomes
    this.updateStrategyOutcomes(outcome);

    // 4. Evaluating state: update free energy and outcome log
    this.regulation.evaluating.recentOutcomes.push(outcome);
    if (this.regulation.evaluating.recentOutcomes.length > this.maxOutcomeHistory) {
      this.regulation.evaluating.recentOutcomes.shift();
    }
    this.regulation.evaluating.lastFreeEnergyEstimate = freeEnergy;

    // 5. Planning state: reset
    this.regulation.planning = this.freshRegulation().planning;
    this.currentTaskStart = null;
    this.currentTaskId = null;
    this.knowledge.tasks.currentTaskType = null;

    return outcome;
  }

  /**
   * Record the outcome of a ActionGate decision.
   * This feeds the calibration system (Friston's generative model update).
   */
  recordCollapseOutcome(collapseResult: ActionValidationResult, actualOutcome: 'success' | 'failure'): void {
    const gate = getActionGate();

    // Update ActionGate's internal calibration
    gate.recordOutcome(collapseResult, actualOutcome === 'success');

    // Update our evaluating state
    this.regulation.evaluating.lastCollapseScore = collapseResult.validationScore;

    // Track overrides
    if (collapseResult.reason.startsWith('OVERRIDE')) {
      this.regulation.monitoring.recentOverrides++;
    }
  }

  // ── Epistemic Provenance Methods ──────────────────────────────────
  // (Johnson & Lindsay Source Monitoring Framework)

  /**
   * Evaluate the reality score of a signal using the Provenance Validator.
   * This IS perceptual reality monitoring — distinguishing perception from imagination.
   */
  evaluateReality(signal: {
    epistemicTag: EpistemicSourceType;
    provenance?: ProvenanceChain;
  }): RealityScore {
    const validator = getProvenanceValidator();
    const score = validator.computeRealityScore(signal);

    // Update monitoring state with reality score
    this.regulation.monitoring.currentRealityScore = score.overall;
    this.regulation.monitoring.hallucinationRiskLevel = score.hallucinationRisk;

    // Track hallucination detections
    if (score.hallucinationRisk > 0.6) {
      this.knowledge.epistemic.hallucinationDetections++;
      if (signal.provenance?.nodes[0]?.content) {
        this.knowledge.epistemic.unverifiedClaims.push(
          signal.provenance.nodes[0].content.slice(0, 100)
        );
        if (this.knowledge.epistemic.unverifiedClaims.length > 20) {
          this.knowledge.epistemic.unverifiedClaims.shift();
        }
      }
    }

    // Update source reliability based on outcomes
    if (score.overall > 0.7) {
      const current = this.knowledge.epistemic.sourceReliability.get(signal.epistemicTag) ?? 0.5;
      this.knowledge.epistemic.sourceReliability.set(
        signal.epistemicTag,
        current + (1 - current) * 0.1 // Slow increase
      );
    } else if (score.overall < 0.3) {
      const current = this.knowledge.epistemic.sourceReliability.get(signal.epistemicTag) ?? 0.5;
      this.knowledge.epistemic.sourceReliability.set(
        signal.epistemicTag,
        current * 0.9 // Slow decrease
      );
    }

    return score;
  }

  // ── Sensorimotor Loop Methods ─────────────────────────────────────
  // (O'Regan & Noe Sensorimotor Theory + Friston Active Inference)

  /**
   * Issue an action into the environment.
   * This begins the sensorimotor loop — the "doing" half of embodiment.
   * Friston: action is selected to bring observations into alignment
   * with expected states.
   */
  issueAction(params: {
    type: ActionType;
    description: string;
    collapseResult: ActionValidationResult;
    prediction: {
      expectedOutcome: 'success' | 'failure' | 'partial';
      expectedConfidence: number;
      expectedSideEffects: string[];
    };
    agent: string;
  }): SensorimotorAction {
    const loop = getSensorimotorLoop();
    return loop.issueAction({
      ...params,
      taskType: this.regulation.planning.activeTaskType ?? 'unknown',
      resonanceScore: this.regulation.monitoring.resonanceScore,
      metaAwarenessStatus: this.regulation.monitoring.metaAwarenessStatus,
    });
  }

  /**
   * Receive environmental feedback from an action.
   * This closes the sensorimotor loop — the "perceiving" half.
   * O'Regan & Noe: experiencing IS having mastery of how sensory
   * input changes when you act.
   */
  receiveOutcome(params: {
    actionId: string;
    actualOutcome: 'success' | 'failure' | 'partial' | 'timeout';
    feedbackModality: FeedbackModality;
    feedbackContent: string;
    actualConfidence: number;
    actualSideEffects: string[];
    durationMs: number;
  }): void {
    const loop = getSensorimotorLoop();
    loop.receiveOutcome(params);

    // Update embodiment knowledge
    const embodiment = loop.getEmbodimentScore();
    this.knowledge.embodiment.sensorimotorMasteryScore = embodiment.overall;
    this.knowledge.embodiment.actionTypesExperienced = embodiment.actionTypesExperienced;
    this.knowledge.embodiment.feedbackModalitiesExperienced = embodiment.feedbackModalitiesExperienced;
    this.knowledge.embodiment.totalActionsCompleted = embodiment.totalLoopsCompleted;
  }

  // ── Snapshot & Query ─────────────────────────────────────────────

  /**
   * Get a full snapshot of the metacognitive state.
   * This is the "meta-level model" from Nelson-Narens —
   * the meta level's representation of the object level.
   */
  getSnapshot(): MetacognitiveSnapshot {
    return {
      knowledge: this.cloneKnowledge(),
      regulation: this.cloneRegulation(),
      summary: {
        overallMetacognitiveHealth: this.computeOverallHealth(),
        dominantPhase: this.computeDominantPhase(),
        lastUpdated: Date.now(),
        bentovStackAlignment: this.computeBentovStackAlignment(),
      },
    };
  }

  /**
   * Get the confidence calibration curve.
   * Returns how well the system's confidence predicts actual success.
   * +1 = overconfident, -1 = underconfident, 0 = well-calibrated.
   */
  getConfidenceCalibration(): number {
    const outcomes = this.regulation.evaluating.recentOutcomes;
    if (outcomes.length < 3) return 0; // Not enough data

    const recentWindow = outcomes.slice(-20);
    const avgConfidence = recentWindow.reduce((sum, o) => sum + o.validationScore, 0) / recentWindow.length;
    const actualSuccessRate = recentWindow.filter(o => o.success).length / recentWindow.length;

    return avgConfidence - actualSuccessRate; // Positive = overconfident
  }

  /**
   * Get the rolling free energy estimate.
   * Lower = system is learning (predictions match reality).
   * Higher = system is surprised (predictions are wrong).
   */
  getFreeEnergyEstimate(): number {
    const outcomes = this.regulation.evaluating.recentOutcomes;
    if (outcomes.length === 0) return 0.5; // No data = moderate uncertainty

    const recentWindow = outcomes.slice(-10);
    return recentWindow.reduce((sum, o) => sum + o.freeEnergyEstimate, 0) / recentWindow.length;
  }

  /**
   * Get the preferred strategy for a task type.
   * This is metacognitive knowledge of strategies in action.
   */
  getPreferredStrategy(taskType: string): string | null {
    return this.knowledge.strategies.preferredApproaches.get(taskType) ?? null;
  }

  /**
   * Get the current dominant metacognitive phase.
   */
  getDominantPhase(): 'planning' | 'monitoring' | 'evaluating' | 'idle' {
    return this.computeDominantPhase();
  }

  // ── Identity Persistence Methods ──────────────────────────────────
  // (Damasio Autobiographical Self + Locke Continuity + Menon Multi-Anchor)

  /**
   * Persist the full metacognitive state to all five identity anchors.
   * Call this on session end or periodically during long sessions.
   * This IS Damasio's autobiographical self writing itself to disk.
   */
  persistIdentity(): void {
    const persistence = getIdentityPersistence();

    // Calibration anchor (core self refinement)
    persistence.saveAnchor('calibration', {
      confidenceCalibration: this.knowledge.self.confidenceCalibration,
      avgResonanceAtSuccess: this.knowledge.self.avgResonanceAtSuccess,
      avgResonanceAtFailure: this.knowledge.self.avgResonanceAtFailure,
      totalTasksCompleted: this.knowledge.self.totalTasksCompleted,
      totalTasksFailed: this.knowledge.self.totalTasksFailed,
      chronotype: this.knowledge.self.chronotype,
      recentEnergyProfile: this.knowledge.self.recentEnergyProfile,
    });

    // Strategy anchor (what works, what doesn't)
    persistence.saveAnchor('strategy', {
      preferredApproaches: Array.from(this.knowledge.strategies.preferredApproaches.entries()),
      abandonedPatterns: this.knowledge.strategies.abandonedPatterns,
      taskTypeHistory: Array.from(this.knowledge.tasks.taskTypeHistory.entries()),
      strategyOutcomes: this.knowledge.strategies.strategyOutcomes.slice(-50),
    });

    // Epistemic anchor (source reliability)
    persistence.saveAnchor('epistemic', {
      sourceReliability: Array.from(this.knowledge.epistemic.sourceReliability.entries()),
      hallucinationDetections: this.knowledge.epistemic.hallucinationDetections,
      avgGroundingScore: this.knowledge.epistemic.avgGroundingScore,
      unverifiedClaims: this.knowledge.epistemic.unverifiedClaims,
    });

    // Embodiment anchor (sensorimotor mastery)
    const loop = getSensorimotorLoop();
    const embodiment = loop.getEmbodimentScore();
    persistence.saveAnchor('embodiment', {
      sensorimotorMasteryScore: this.knowledge.embodiment.sensorimotorMasteryScore,
      actionTypesExperienced: embodiment.actionTypesExperienced,
      feedbackModalitiesExperienced: embodiment.feedbackModalitiesExperienced,
      totalActionsCompleted: embodiment.totalLoopsCompleted,
      contingencies: [],
    });

    // Narrative: end the session chain
    const health = this.computeOverallHealth();
    persistence.endSession(
      [`Health: ${(health * 100).toFixed(0)}%`],
      {
        calibration: 1 - Math.abs(this.knowledge.self.confidenceCalibration),
        strategy: this.knowledge.strategies.preferredApproaches.size > 0 ? 0.7 : 0.3,
        epistemic: this.regulation.monitoring.currentRealityScore,
        embodiment: this.knowledge.embodiment.sensorimotorMasteryScore,
        narrative: health,
      }
    );
  }

  /**
   * Restore the metacognitive state from persisted identity anchors.
   * Call this on session start to reconstruct the autobiographical self.
   * Parfit resilience: reconstruct from ANY subset of anchors.
   */
  restoreIdentity(): {
    anchorsRestored: AnchorType[];
    anchorsMissing: AnchorType[];
    resilienceScore: number;
    narrative: NarrativeAnchorData | null;
  } {
    const persistence = getIdentityPersistence();
    const identity = persistence.restoreFullIdentity();
    const resilience = persistence.getResilienceScore();

    // Restore calibration anchor
    if (identity.calibration?.data) {
      const cal = identity.calibration.data;
      this.knowledge.self.confidenceCalibration = cal.confidenceCalibration;
      this.knowledge.self.avgResonanceAtSuccess = cal.avgResonanceAtSuccess;
      this.knowledge.self.avgResonanceAtFailure = cal.avgResonanceAtFailure;
      this.knowledge.self.totalTasksCompleted = cal.totalTasksCompleted;
      this.knowledge.self.totalTasksFailed = cal.totalTasksFailed;
      this.knowledge.self.chronotype = cal.chronotype;
      this.knowledge.self.recentEnergyProfile = cal.recentEnergyProfile;
    }

    // Restore strategy anchor
    if (identity.strategy?.data) {
      const strat = identity.strategy.data;
      this.knowledge.strategies.preferredApproaches = new Map(strat.preferredApproaches);
      this.knowledge.strategies.abandonedPatterns = strat.abandonedPatterns;
      this.knowledge.tasks.taskTypeHistory = new Map(strat.taskTypeHistory);
      this.knowledge.strategies.strategyOutcomes = strat.strategyOutcomes;
    }

    // Restore epistemic anchor
    if (identity.epistemic?.data) {
      const epis = identity.epistemic.data;
      this.knowledge.epistemic.sourceReliability = new Map<EpistemicSourceType, number>(
        epis.sourceReliability as Array<[EpistemicSourceType, number]>
      );
      this.knowledge.epistemic.hallucinationDetections = epis.hallucinationDetections;
      this.knowledge.epistemic.avgGroundingScore = epis.avgGroundingScore;
      this.knowledge.epistemic.unverifiedClaims = epis.unverifiedClaims;
    }

    // Restore embodiment anchor
    if (identity.embodiment?.data) {
      const emb = identity.embodiment.data;
      this.knowledge.embodiment.sensorimotorMasteryScore = emb.sensorimotorMasteryScore;
      this.knowledge.embodiment.actionTypesExperienced = emb.actionTypesExperienced;
      this.knowledge.embodiment.feedbackModalitiesExperienced = emb.feedbackModalitiesExperienced;
      this.knowledge.embodiment.totalActionsCompleted = emb.totalActionsCompleted;
    }

    // Start new session in the narrative chain
    const narrative = persistence.startNewSession();

    return {
      anchorsRestored: (Object.keys(identity) as AnchorType[]).filter(k => identity[k] !== undefined),
      anchorsMissing: resilience.anchorsMissing,
      resilienceScore: resilience.score,
      narrative,
    };
  }

  /**
   * Get the identity resilience score.
   * How many anchors have data? How many sessions have persisted?
   */
  getIdentityResilience(): {
    score: number;
    anchorsPresent: number;
    anchorsMissing: AnchorType[];
    sessionCount: number;
    oldestAnchor: number | null;
  } {
    return getIdentityPersistence().getResilienceScore();
  }

  // ── Internal Methods ─────────────────────────────────────────────

  private updateMetaAwareness(): void {
    const { coherenceScore, resonanceScore } = this.regulation.monitoring;

    // Decision logic inspired by Schooler's framework:
    // - Tuned: high coherence + high resonance = agent is fully on-task
    // - Drifting: medium coherence or resonance = attention may be fragmenting
    // - Decoupled: low coherence (destructive interference) = agent off-task

    const composite = (coherenceScore + resonanceScore) / 2;

    if (composite >= 0.65 && coherenceScore >= 0.5) {
      // Was previously drifting/decoupled, now re-tuned
      if (this.regulation.monitoring.metaAwarenessStatus !== 'tuned') {
        this.regulation.monitoring.driftDetectedAt = null;
      }
      this.regulation.monitoring.metaAwarenessStatus = 'tuned';
    } else if (composite >= 0.40 || (coherenceScore >= 0.3 && coherenceScore < 0.5)) {
      // Drifting — first detection
      if (this.regulation.monitoring.metaAwarenessStatus === 'tuned') {
        this.regulation.monitoring.driftDetectedAt = Date.now();
      }
      this.regulation.monitoring.metaAwarenessStatus = 'drifting';
    } else {
      // Decoupled — destructive interference dominant
      if (this.regulation.monitoring.metaAwarenessStatus === 'tuned') {
        this.regulation.monitoring.driftDetectedAt = Date.now();
      }
      this.regulation.monitoring.metaAwarenessStatus = 'decoupled';
    }

    // Monitoring confidence: how reliable is the meta-awareness signal itself?
    // Higher with more data points, lower when recently overridden
    const dataPoints = this.regulation.evaluating.recentOutcomes.length;
    const overridePenalty = Math.min(0.3, this.regulation.monitoring.recentOverrides * 0.1);
    this.regulation.monitoring.monitoringConfidence = Math.max(
      0.3,
      Math.min(1.0, 0.5 + dataPoints * 0.02 - overridePenalty)
    );
  }

  private updateConfidenceCalibration(outcome: TaskOutcome): void {
    // Track resonance at success vs failure for self-knowledge
    if (outcome.success) {
      this.knowledge.self.totalTasksCompleted++;
      // Running average of resonance at success
      const prev = this.knowledge.self.avgResonanceAtSuccess;
      const n = this.knowledge.self.totalTasksCompleted;
      this.knowledge.self.avgResonanceAtSuccess = prev + (outcome.resonanceScore - prev) / n;
    } else {
      this.knowledge.self.totalTasksFailed++;
      const prev = this.knowledge.self.avgResonanceAtFailure;
      const n = this.knowledge.self.totalTasksFailed;
      this.knowledge.self.avgResonanceAtFailure = prev + (outcome.resonanceScore - prev) / n;
    }

    // Update calibration score
    this.knowledge.self.confidenceCalibration = this.getConfidenceCalibration();
  }

  private updateTaskTypeHistory(outcome: TaskOutcome): void {
    const existing = this.knowledge.tasks.taskTypeHistory.get(outcome.taskType);
    if (existing) {
      existing.attemptCount++;
      if (outcome.success) existing.successCount++;
      existing.avgDuration = existing.avgDuration + (outcome.durationMs - existing.avgDuration) / existing.attemptCount;
      existing.avgResonanceAtStart = existing.avgResonanceAtStart +
        (outcome.resonanceScore - existing.avgResonanceAtStart) / existing.attemptCount;

      // Update best/worst strategy
      if (outcome.success) {
        existing.bestStrategy = outcome.strategyUsed;
      } else {
        existing.worstStrategy = outcome.strategyUsed;
      }
    } else {
      this.knowledge.tasks.taskTypeHistory.set(outcome.taskType, {
        attemptCount: 1,
        successCount: outcome.success ? 1 : 0,
        avgDuration: outcome.durationMs,
        avgResonanceAtStart: outcome.resonanceScore,
        bestStrategy: outcome.success ? outcome.strategyUsed : null,
        worstStrategy: outcome.success ? null : outcome.strategyUsed,
      });
    }
  }

  private updateStrategyOutcomes(outcome: TaskOutcome): void {
    const entry: StrategyOutcome = {
      taskType: outcome.taskType,
      strategyName: outcome.strategyUsed,
      success: outcome.success,
      resonanceAtExecution: outcome.resonanceScore,
      timestamp: outcome.timestamp,
    };

    this.knowledge.strategies.strategyOutcomes.push(entry);
    if (this.knowledge.strategies.strategyOutcomes.length > this.maxStrategyHistory) {
      this.knowledge.strategies.strategyOutcomes.shift();
    }

    // Update preferred approach: find strategy with highest success rate for this task type
    const strategiesForType = this.knowledge.strategies.strategyOutcomes.filter(
      s => s.taskType === outcome.taskType
    );

    // Group by strategy name, compute success rates
    const successRates = new Map<string, { attempts: number; successes: number }>();
    for (const s of strategiesForType) {
      const current = successRates.get(s.strategyName) ?? { attempts: 0, successes: 0 };
      current.attempts++;
      if (s.success) current.successes++;
      successRates.set(s.strategyName, current);
    }

    // Find the best
    let bestStrategy: string | null = null;
    let bestRate = 0;
    for (const [name, { attempts, successes }] of successRates) {
      if (attempts >= 2) { // Need at least 2 attempts to trust
        const rate = successes / attempts;
        if (rate > bestRate) {
          bestRate = rate;
          bestStrategy = name;
        }
      }
    }

    if (bestStrategy) {
      this.knowledge.strategies.preferredApproaches.set(outcome.taskType, bestStrategy);
    }

    // Track abandoned strategies (>70% failure rate with 3+ attempts)
    for (const [name, { attempts, successes }] of successRates) {
      if (attempts >= 3 && successes / attempts < 0.3) {
        if (!this.knowledge.strategies.abandonedPatterns.includes(name)) {
          this.knowledge.strategies.abandonedPatterns.push(name);
        }
      }
    }
  }

  private computeAlternativeStrategies(taskType: string, history: TaskTypeRecord | undefined): string[] {
    // Start with known strategies for this task type
    const strategies = new Set<string>();

    if (history?.bestStrategy) strategies.add(history.bestStrategy);

    // Add strategies from knowledge base
    const knownForType = this.knowledge.strategies.strategyOutcomes
      .filter(s => s.taskType === taskType)
      .map(s => s.strategyName);

    for (const s of knownForType) strategies.add(s);

    // Add default strategies if none known
    if (strategies.size === 0) {
      strategies.add('step-by-step');
      strategies.add('intuitive');
      strategies.add('research-first');
    }

    // Remove abandoned strategies
    for (const abandoned of this.knowledge.strategies.abandonedPatterns) {
      strategies.delete(abandoned);
    }

    return Array.from(strategies);
  }

  private computeOverallHealth(): number {
    // Weighted composite from ALL modules including epistemic + embodiment
    const monitoringScore =
      this.regulation.monitoring.metaAwarenessStatus === 'tuned' ? 1.0 :
      this.regulation.monitoring.metaAwarenessStatus === 'drifting' ? 0.5 : 0.1;

    const regulationScore = 1 - this.getFreeEnergyEstimate();
    const calibrationScore = 1 - Math.abs(this.knowledge.self.confidenceCalibration);
    const planningScore = this.regulation.planning.planningConfidence;
    const realityScore = this.regulation.monitoring.currentRealityScore;
    const embodimentScore = this.knowledge.embodiment.sensorimotorMasteryScore;

    // Weights: monitoring (20%), regulation (15%), calibration (15%), planning (15%),
    // reality grounding (20%), embodiment (15%)
    return Math.max(0, Math.min(1,
      monitoringScore * 0.20 +
      regulationScore * 0.15 +
      calibrationScore * 0.15 +
      planningScore * 0.15 +
      realityScore * 0.20 +
      embodimentScore * 0.15
    ));
  }

  private computeDominantPhase(): 'planning' | 'monitoring' | 'evaluating' | 'idle' {
    if (this.regulation.planning.activeTaskId && this.currentTaskStart) {
      // Active task: are we mostly planning or monitoring?
      if (this.observations.size === 0) return 'planning';
      return 'monitoring';
    }
    if (this.regulation.evaluating.recentOutcomes.length > 0) return 'evaluating';
    return 'idle';
  }

  private computeBentovStackAlignment(): BentovStackAlignment {
    const outcomes = this.regulation.evaluating.recentOutcomes;
    const recent = outcomes.slice(-20);

    // Layer 1: Hameroff/Penrose — collapse gate quality
    const validationScores = recent.map(o => o.validationScore);
    const avgCollapse = validationScores.length > 0
      ? validationScores.reduce((a, b) => a + b, 0) / validationScores.length
      : 0.5;
    const substrateScore = avgCollapse;

    // Layer 2: Busemeyer/Pothos — are alternatives being considered?
    const hasAlternatives = this.regulation.planning.alternativeStrategies.length > 0;
    const cognitionScore = hasAlternatives ? 0.7 + Math.min(0.3, this.regulation.planning.alternativeStrategies.length * 0.1) : 0.4;

    // Layer 3: Schooler — meta-awareness quality
    const monitoringScore =
      this.regulation.monitoring.metaAwarenessStatus === 'tuned' ? 0.9 :
      this.regulation.monitoring.metaAwarenessStatus === 'drifting' ? 0.5 : 0.2;

    // Layer 4: Friston — free energy trend (is it decreasing = learning?)
    let regulationScore = 0.5;
    if (recent.length >= 5) {
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));
      const avgFirstHalf = firstHalf.reduce((s, o) => s + o.freeEnergyEstimate, 0) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((s, o) => s + o.freeEnergyEstimate, 0) / secondHalf.length;
      // Decreasing free energy = learning = high regulation score
      regulationScore = avgSecondHalf < avgFirstHalf ? 0.8 : 0.4;
    }

    // Layer 5: Nelson-Narens — is knowledge being used for improvement?
    const knownStrategies = this.knowledge.strategies.preferredApproaches.size;
    const knownTaskTypes = this.knowledge.tasks.taskTypeHistory.size;
    const architectureScore = Math.min(1.0, (knownStrategies + knownTaskTypes) * 0.1 + 0.3);

    const labelFor = (score: number) =>
      score >= 0.8 ? 'strong' : score >= 0.6 ? 'moderate' : score >= 0.4 ? 'weak' : 'critical';

    // Layer 6: Johnson & Lindsay (SMF) — can the system distinguish perception from imagination?
    const epistemicScore = this.regulation.monitoring.currentRealityScore;

    // Layer 7: O'Regan & Noe (Sensorimotor) — does the system have mastery of action-outcome?
    const embodimentScore = this.knowledge.embodiment.sensorimotorMasteryScore;

    return {
      substrate: { score: substrateScore, label: labelFor(substrateScore) },
      cognition: { score: cognitionScore, label: labelFor(cognitionScore) },
      monitoring: { score: monitoringScore, label: labelFor(monitoringScore) },
      regulation: { score: regulationScore, label: labelFor(regulationScore) },
      architecture: { score: architectureScore, label: labelFor(architectureScore) },
      epistemic: { score: epistemicScore, label: labelFor(epistemicScore) },
      embodiment: { score: embodimentScore, label: labelFor(embodimentScore) },
      // Layer 8: Damasio/Locke — does identity persist across sessions?
      identity: { score: this.getIdentityResilience().score, label: labelFor(this.getIdentityResilience().score) },
    };
  }

  private freshKnowledge(): MetacognitiveKnowledge {
    return {
      self: {
        confidenceCalibration: 0,
        recentEnergyProfile: [],
        chronotype: 'neutral',
        totalTasksCompleted: 0,
        totalTasksFailed: 0,
        avgResonanceAtSuccess: 0.7,
        avgResonanceAtFailure: 0.4,
      },
      tasks: {
        taskTypeHistory: new Map(),
        currentTaskType: null,
        difficultyRatings: new Map(),
      },
      strategies: {
        strategyOutcomes: [],
        preferredApproaches: new Map(),
        abandonedPatterns: [],
      },
      epistemic: {
        sourceReliability: new Map<EpistemicSourceType, number>([
          ['perception', 0.9],
          ['consensus', 0.7],
          ['memory', 0.6],
          ['inference', 0.4],
          ['generation', 0.2],
          ['override', 0.1],
        ]),
        hallucinationDetections: 0,
        avgGroundingScore: 0.5,
        unverifiedClaims: [],
      },
      embodiment: {
        sensorimotorMasteryScore: 0.3,
        actionTypesExperienced: 0,
        feedbackModalitiesExperienced: 0,
        totalActionsCompleted: 0,
      },
    };
  }

  private freshRegulation(): MetacognitiveRegulation {
    return {
      planning: {
        activeTaskId: null,
        activeTaskType: null,
        selectedStrategy: null,
        alternativeStrategies: [],
        plannedAt: null,
        planningConfidence: 0.5,
      },
      monitoring: {
        metaAwarenessStatus: 'tuned',
        coherenceScore: 1.0,
        resonanceScore: 0.75,
        recentOverrides: 0,
        driftDetectedAt: null,
        monitoringConfidence: 0.5,
        currentRealityScore: 0.5,
        hallucinationRiskLevel: 0.1,
      },
      evaluating: {
        lastCollapseScore: 0,
        lastFreeEnergyEstimate: 0.5,
        recentOutcomes: [],
        evaluationConfidence: 0.5,
      },
    };
  }

  private cloneKnowledge(): MetacognitiveKnowledge {
    return {
      self: { ...this.knowledge.self, recentEnergyProfile: [...this.knowledge.self.recentEnergyProfile] },
      tasks: {
        taskTypeHistory: new Map(this.knowledge.tasks.taskTypeHistory),
        currentTaskType: this.knowledge.tasks.currentTaskType,
        difficultyRatings: new Map(this.knowledge.tasks.difficultyRatings),
      },
      strategies: {
        strategyOutcomes: [...this.knowledge.strategies.strategyOutcomes],
        preferredApproaches: new Map(this.knowledge.strategies.preferredApproaches),
        abandonedPatterns: [...this.knowledge.strategies.abandonedPatterns],
      },
      epistemic: {
        sourceReliability: new Map(this.knowledge.epistemic.sourceReliability),
        hallucinationDetections: this.knowledge.epistemic.hallucinationDetections,
        avgGroundingScore: this.knowledge.epistemic.avgGroundingScore,
        unverifiedClaims: [...this.knowledge.epistemic.unverifiedClaims],
      },
      embodiment: { ...this.knowledge.embodiment },
    };
  }

  private cloneRegulation(): MetacognitiveRegulation {
    return {
      planning: { ...this.regulation.planning, alternativeStrategies: [...this.regulation.planning.alternativeStrategies] },
      monitoring: { ...this.regulation.monitoring },
      evaluating: {
        ...this.regulation.evaluating,
        recentOutcomes: [...this.regulation.evaluating.recentOutcomes],
      },
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let globalMetacognitiveState: MetacognitiveState | null = null;

export function getMetacognitiveState(): MetacognitiveState {
  if (!globalMetacognitiveState) {
    globalMetacognitiveState = new MetacognitiveState();
  }
  return globalMetacognitiveState;
}

export function resetMetacognitiveState(): void {
  globalMetacognitiveState = null;
}
