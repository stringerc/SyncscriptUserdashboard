/**
 * Sensorimotor Grounding Loop — The Embodiment Layer
 *
 * Implements O'Regan & Noe's (2001) sensorimotor theory and
 * Varela's enactivism as a computational architecture.
 *
 * The problem: Our system is a "brain in a jar" — it computes,
 * decides, and evaluates, but never ACTS in the world and
 * receives FEEDBACK from those actions. It scores 2/10 on
 * embodiment because there's no sensorimotor loop.
 *
 * The human solution (O'Regan & Noe): Consciousness requires
 * MASTERY of sensorimotor contingencies — not just having
 * sensory input, but knowing how sensory input CHANGES when
 * you act. Vision is constituted by the implicit knowledge
 * of how retinal input transforms when you move your eyes,
 * head, or body. Perceiving IS doing.
 *
 * Varela's enactivism adds: cognition is sense-making through
 * structural coupling with an environment. You don't represent
 * the world — you enact it through your engagement.
 *
 * Friston's active inference makes it mathematical: agents act
 * to minimize expected free energy. They don't just predict —
 * they ACT to bring observations into alignment with expectations,
 * then UPDATE when the world pushes back.
 *
 * Our implementation:
 * - Every ActionGate approval triggers an ACTION in the environment
 * - The environment returns an OUTCOME (success/failure/partial)
 * - The OUTCOME diverges from PREDICTION by some amount
 * - This prediction error (free energy) is fed back into
 *   MetacognitiveState to update the generative model
 * - The agent LEARNS which actions produce which consequences
 *   in which contexts — sensorimotor contingency mastery
 *
 * This bridges our 2/10 gap in Embodiment from "pure computation"
 * to "structurally coupled system with environmental feedback."
 */

import { getActionGate, type ActionValidationResult } from './action-gate';
import { getProvenanceValidator, type EpistemicSourceType } from './epistemic-provenance';

// ── Types ──────────────────────────────────────────────────────────

/** The type of action the system can take in its environment */
export type ActionType =
  | 'deploy'          // Deploy code to environment
  | 'compile'         // Compile/build the project
  | 'test'            // Run tests
  | 'write_file'      // Write a file to disk
  | 'api_call'        // Make an external API request
  | 'database_write'  // Write to database
  | 'git_commit'      // Commit to git
  | 'git_push'        // Push to remote
  | 'search'          // Search the codebase or web
  | 'user_interaction'// Direct user interaction (question, approval)
  | 'inference';      // Pure internal reasoning (no environmental feedback)

/** The modality through which feedback arrives — O'Regan & Noe's sensorimotor contingency types */
export type FeedbackModality =
  | 'compilation'     // Build/compile output
  | 'test_result'     // Test pass/fail output
  | 'runtime_error'   // Runtime error from execution
  | 'http_response'   // HTTP status code and body
  | 'file_system'     // File read/write confirmation
  | 'git_status'      // Git operation result
  | 'user_response'   // Human feedback
  | 'search_result'   // Search output
  | 'none';           // No feedback (inference-only actions)

/** An action taken in the environment */
export interface SensorimotorAction {
  id: string;
  type: ActionType;
  description: string;
  collapseResult: ActionValidationResult;       // The gate decision that authorized this action
  prediction: {
    expectedOutcome: 'success' | 'failure' | 'partial';
    expectedConfidence: number;          // How confident were we this would work
    expectedSideEffects: string[];       // What we expected to change
  };
  timestamp: number;
  context: {
    agent: string;                       // Which agent took the action
    taskType: string;                    // What kind of task
    resonanceScore: number;              // Resonance at time of action
    metaAwarenessStatus: string;         // Meta-awareness at time of action
  };
}

/** The outcome the environment returns after an action */
export interface SensorimotorOutcome {
  actionId: string;
  actualOutcome: 'success' | 'failure' | 'partial' | 'timeout';
  feedbackModality: FeedbackModality;
  feedbackContent: string;              // Raw feedback from environment
  actualConfidence: number;             // Post-hoc: how well did it actually go (0-1)
  actualSideEffects: string[];          // What actually changed
  durationMs: number;                   // How long the action took
  timestamp: number;
  epistemicTag: EpistemicSourceType;    // This outcome IS a perception
  predictionError: number;              // |expected - actual| = free energy
}

/** A learned sensorimotor contingency — O'Regan & Noe's "mastery" */
export interface SensorimotorContingency {
  actionType: ActionType;
  context: string;                      // Task type or situation description
  expectedResult: string;
  actualResults: {
    successCount: number;
    failureCount: number;
    partialCount: number;
    avgDurationMs: number;
  };
  mastery: number;                      // 0-1: how well we know this action-outcome pair
  lastUpdated: number;
}

/** Full sensorimotor loop record */
export interface SensorimotorLoopRecord {
  action: SensorimotorAction;
  outcome: SensorimotorOutcome | null;  // null if action hasn't completed
  contingencyUpdated: boolean;          // Did this loop update our mastery?
  freeEnergyContributed: number;        // How much prediction error this loop added
}

// ── Implementation ─────────────────────────────────────────────────

export class SensorimotorLoop {
  private loops: SensorimotorLoopRecord[] = [];
  private contingencies = new Map<string, SensorimotorContingency>();
  private pendingActions = new Map<string, SensorimotorAction>();
  private maxLoopHistory = 200;
  private maxContingencies = 100;

  /**
   * Begin a sensorimotor loop: issue an action into the environment.
   * This is the "action" half of Friston's active inference.
   */
  issueAction(params: {
    type: ActionType;
    description: string;
    collapseResult: ActionValidationResult;
    prediction: SensorimotorAction['prediction'];
    agent: string;
    taskType: string;
    resonanceScore: number;
    metaAwarenessStatus: string;
  }): SensorimotorAction {
    const action: SensorimotorAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: params.type,
      description: params.description,
      collapseResult: params.collapseResult,
      prediction: params.prediction,
      timestamp: Date.now(),
      context: {
        agent: params.agent,
        taskType: params.taskType,
        resonanceScore: params.resonanceScore,
        metaAwarenessStatus: params.metaAwarenessStatus,
      },
    };

    this.pendingActions.set(action.id, action);

    // Create loop record (outcome pending)
    const record: SensorimotorLoopRecord = {
      action,
      outcome: null,
      contingencyUpdated: false,
      freeEnergyContributed: 0,
    };

    this.loops.push(record);
    if (this.loops.length > this.maxLoopHistory) {
      this.loops.shift();
    }

    return action;
  }

  /**
   * Receive environmental feedback: record the outcome.
   * This is the "perception" half of Friston's active inference.
   *
   * The outcome IS a perception (epistemicTag: 'perception') because
   * it came from the external environment, not from internal reasoning.
   */
  receiveOutcome(params: {
    actionId: string;
    actualOutcome: 'success' | 'failure' | 'partial' | 'timeout';
    feedbackModality: FeedbackModality;
    feedbackContent: string;
    actualConfidence: number;
    actualSideEffects: string[];
    durationMs: number;
  }): SensorimotorLoopRecord | null {
    const action = this.pendingActions.get(params.actionId);
    if (!action) return null;

    // Compute prediction error = Friston's free energy for this loop
    const expectedScore = action.prediction.expectedOutcome === 'success' ? 1 :
      action.prediction.expectedOutcome === 'failure' ? 0 : 0.5;
    const actualScore = params.actualOutcome === 'success' ? 1 :
      params.actualOutcome === 'failure' ? 0 : 0.5;

    const predictionError = Math.abs(expectedScore - actualScore);

    const outcome: SensorimotorOutcome = {
      actionId: params.actionId,
      actualOutcome: params.actualOutcome,
      feedbackModality: params.feedbackModality,
      feedbackContent: params.feedbackContent,
      actualConfidence: params.actualConfidence,
      actualSideEffects: params.actualSideEffects,
      durationMs: params.durationMs,
      timestamp: Date.now(),
      epistemicTag: 'perception',  // Environmental feedback IS perception
      predictionError,
    };

    // Update the loop record
    const record = this.loops.find(l => l.action.id === params.actionId);
    if (record) {
      record.outcome = outcome;
      record.freeEnergyContributed = predictionError;
    }

    // Update sensorimotor contingency mastery
    const contingencyUpdated = this.updateContingency(action, outcome);
    if (record) record.contingencyUpdated = contingencyUpdated;

    // Record outcome in ActionGate's calibration
    const gate = getActionGate();
    gate.recordOutcome(action.collapseResult, params.actualOutcome === 'success');

    // Remove from pending
    this.pendingActions.delete(params.actionId);

    return record ?? null;
  }

  /**
   * Record an outcome from an action that bypassed the gate (override).
   * These have special epistemic status — they're perceptions but
   * with low grounding because they weren't validated.
   */
  recordOverrideOutcome(params: {
    actionId: string;
    actualOutcome: 'success' | 'failure' | 'partial' | 'timeout';
    feedbackModality: FeedbackModality;
    feedbackContent: string;
    durationMs: number;
  }): void {
    const action = this.pendingActions.get(params.actionId);
    if (!action) return;

    const outcome: SensorimotorOutcome = {
      actionId: params.actionId,
      actualOutcome: params.actualOutcome,
      feedbackModality: params.feedbackModality,
      feedbackContent: params.feedbackContent,
      actualConfidence: 0.5, // Override outcomes get neutral confidence
      actualSideEffects: [],
      durationMs: params.durationMs,
      timestamp: Date.now(),
      epistemicTag: 'override',  // Came from bypass — tagged accordingly
      predictionError: 0.5,     // Unknown because prediction was skipped
    };

    // Update loop record
    const record = this.loops.find(l => l.action.id === params.actionId);
    if (record) {
      record.outcome = outcome;
      record.freeEnergyContributed = 0.5;
    }

    this.pendingActions.delete(params.actionId);
  }

  /**
   * Get sensorimotor mastery for a specific action type.
   * This IS O'Regan & Noe's "mastery of sensorimotor contingencies" —
   * the agent knows what will happen when it acts.
   *
   * Mastery = (successCount + partialCount * 0.5) / totalCount
   * Also factors in consistency: low variance = higher mastery
   */
  getMastery(actionType: ActionType, context?: string): number {
    const key = context ? `${actionType}:${context}` : actionType;
    const contingency = this.contingencies.get(key);
    if (!contingency) return 0.3; // No data = low baseline mastery

    return contingency.mastery;
  }

  /**
   * Get the overall embodiment score for the system.
   * How many action types have achieved mastery?
   * How many feedback modalities have been experienced?
   * This turns our 2/10 embodiment score into something measurable.
   */
  getEmbodimentScore(): {
    overall: number;           // 0-1
    actionTypesExperienced: number;
    feedbackModalitiesExperienced: number;
    avgMastery: number;
    totalLoopsCompleted: number;
    pendingActions: number;
  } {
    const completedLoops = this.loops.filter(l => l.outcome !== null);
    const actionTypes = new Set(completedLoops.map(l => l.action.type));
    const feedbackModalities = new Set(
      completedLoops.map(l => l.outcome?.feedbackModality).filter(Boolean)
    );

    const totalMastery = Array.from(this.contingencies.values())
      .reduce((sum, c) => sum + c.mastery, 0);
    const avgMastery = this.contingencies.size > 0
      ? totalMastery / this.contingencies.size
      : 0;

    // Overall: weighted combination of breadth and depth
    const breadth = Math.min(1, (actionTypes.size + feedbackModalities.size) / 12); // Max ~12 combos
    const depth = avgMastery;
    const volume = Math.min(1, completedLoops.length / 50); // 50 loops = full volume score

    const overall = breadth * 0.35 + depth * 0.45 + volume * 0.20;

    return {
      overall,
      actionTypesExperienced: actionTypes.size,
      feedbackModalitiesExperienced: feedbackModalities.size,
      avgMastery,
      totalLoopsCompleted: completedLoops.length,
      pendingActions: this.pendingActions.size,
    };
  }

  /**
   * Get recent sensorimotor loops for display.
   */
  getRecentLoops(count: number = 10): SensorimotorLoopRecord[] {
    return this.loops.slice(-count);
  }

  // ── Internal ─────────────────────────────────────────────────────

  private updateContingency(action: SensorimotorAction, outcome: SensorimotorOutcome): boolean {
    const key = `${action.type}:${action.context.taskType}`;
    const existing = this.contingencies.get(key);

    if (existing) {
      // Update existing contingency
      const results = existing.actualResults;
      if (outcome.actualOutcome === 'success') results.successCount++;
      else if (outcome.actualOutcome === 'failure') results.failureCount++;
      else results.partialCount++;

      results.avgDurationMs = results.avgDurationMs +
        (outcome.durationMs - results.avgDurationMs) /
        (results.successCount + results.failureCount + results.partialCount);

      // Mastery: proportion of successes, weighted by sample size
      const total = results.successCount + results.failureCount + results.partialCount;
      const successRate = (results.successCount + results.partialCount * 0.5) / total;
      const sampleConfidence = Math.min(1, total / 10); // 10 samples = full confidence
      existing.mastery = successRate * sampleConfidence + 0.5 * (1 - sampleConfidence);
      existing.lastUpdated = Date.now();
    } else {
      // Create new contingency
      this.contingencies.set(key, {
        actionType: action.type,
        context: action.context.taskType,
        expectedResult: action.prediction.expectedOutcome,
        actualResults: {
          successCount: outcome.actualOutcome === 'success' ? 1 : 0,
          failureCount: outcome.actualOutcome === 'failure' ? 1 : 0,
          partialCount: outcome.actualOutcome === 'partial' ? 1 : 0,
          avgDurationMs: outcome.durationMs,
        },
        mastery: 0.5, // Single sample = neutral mastery
        lastUpdated: Date.now(),
      });

      if (this.contingencies.size > this.maxContingencies) {
        // Evict oldest
        const oldest = Array.from(this.contingencies.entries())
          .sort(([, a], [, b]) => a.lastUpdated - b.lastUpdated)[0];
        if (oldest) this.contingencies.delete(oldest[0]);
      }
    }

    return true;
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let globalLoop: SensorimotorLoop | null = null;

export function getSensorimotorLoop(): SensorimotorLoop {
  if (!globalLoop) {
    globalLoop = new SensorimotorLoop();
  }
  return globalLoop;
}

export function resetSensorimotorLoop(): void {
  globalLoop = null;
}
