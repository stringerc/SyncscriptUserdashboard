/**
 * Metacognitive Controller — Two-Level Architecture (Nelson-Narens)
 *
 * This implements the REAL Nelson-Narens (1994) metacognitive model:
 *
 *   OBJECT LEVEL ─── processes that DO the actual work
 *       ↕ monitoring (observe) + control (adjust)
 *   META LEVEL  ─── processes that MONITOR and CONTROL the object level
 *
 * The critical difference from our old MetacognitiveState (which was
 * just a data structure tracking its own numbers): THIS controller
 * actually CHANGES object-level behavior based on metacognitive judgments.
 *
 * Key capabilities:
 * 1. MONITORING: observe object-level processes and assess their quality
 * 2. CONTROL: adjust object-level behavior based on monitoring judgments
 * 3. FEELING-OF-KNOWING: predict whether the system CAN solve a problem
 *    before attempting it (and this prediction must be better than chance)
 * 4. ERROR PREDICTION: before generating output, predict whether it
 *    will be correct (these predictions must be calibrated over time)
 *
 * The calibration requirement is strict: if FoK predictions don't
 * correlate with actual outcomes, the system is NOT metacognitive —
 * it's just generating numbers. We verify this with:
 * - Gamma correlation (Goodman-Kruskal) between FoK and outcomes
 * - Calibration curves (predicted vs actual success rate by bin)
 * - Brier scores for error predictions
 */

import { getActionGate } from './action-gate';
import { getMetacognitiveState } from './metacognitive-state';

// ── Types ──────────────────────────────────────────────────────────

export type ProcessingPhase = 'analysis' | 'generation' | 'verification' | 'execution';
export type ConfidenceJudgment = 'high' | 'medium' | 'low' | 'very-low';
export type AllocationDecision = 'proceed' | 'verify-first' | 'request-help' | 'abort';

/** Object-level process state */
export interface ObjectLevelState {
  phase: ProcessingPhase;
  taskType: string;
  taskId: string;
  startedAt: number;
  /** The object level's own confidence estimate */
  selfReportedConfidence: number;
}

/** Meta-level monitoring judgment */
export interface MonitoringJudgment {
  taskId: string;
  /** Is the object-level process on track? */
  onTrack: boolean;
  /** Meta-level confidence in the object-level's output (0-1) */
  metaConfidence: number;
  /** Feeling-of-knowing judgment: can the system solve this? */
  feelingOfKnowing: ConfidenceJudgment;
  /** Predicted probability of success (0-1) */
  predictedSuccessProbability: number;
  /** Should additional verification be allocated? */
  needsVerification: boolean;
  /** Should help be requested? */
  needsHelp: boolean;
  /** Reasoning for this judgment */
  reasoning: string;
  timestamp: number;
}

/** Meta-level control decision */
export interface ControlDecision {
  taskId: string;
  /** What should the object-level do? */
  allocation: AllocationDecision;
  /** How much additional time/effort to allocate (0-1) */
  effortMultiplier: number;
  /** Should the strategy be changed? If so, to what? */
  strategyChange: string | null;
  /** Reasoning */
  reasoning: string;
  timestamp: number;
}

/** Outcome of a task that was monitored */
export interface TaskOutcome {
  taskId: string;
  success: boolean;
  actualConfidence: number;
  durationMs: number;
}

// ── Higher-Order Thought (HOT) Types (Rosenthal 1986, 2005) ────────

/** Modality of a first-order cognitive state */
export type FirstOrderModality = 'perception' | 'memory' | 'action' | 'evaluation' | 'affect';

/** Epistemic propositional attitude of the higher-order thought */
export type HigherOrderAttitude = 'asserts' | 'doubts' | 'hypothesizes' | 'expects' | 'verifies';

/** Epistemic grounding status of the higher-order representation */
export type EpistemicStatus = 'grounded' | 'inferential' | 'speculative' | 'confabulated';

/**
 * First-Order Mental State (Rosenthal HOT Theory):
 * Direct domain state representing an external or internal stimulus (e.g. sensor detection, action command).
 */
export interface FirstOrderState {
  id: string;
  modality: FirstOrderModality;
  target: string;
  content: Record<string, unknown>;
  rawConfidence: number;
  activationLevel: number;
  timestamp: number;
}

/**
 * Higher-Order Representation (HOR / HOT):
 * A meta-representational thought that takes a first-order mental state as its intentional object.
 * Under Rosenthal's HOT theory, conscious awareness is constituted when a first-order state is
 * monitored and represented by a suitable higher-order thought.
 */
export interface HigherOrderRepresentation {
  id: string;
  firstOrderStateId: string;
  modality: FirstOrderModality;
  attitude: HigherOrderAttitude;
  /** Meta-level intentional content: e.g. "System represents that it is perceiving stimulus X" */
  metaContent: string;
  higherOrderConfidence: number;
  epistemicStatus: EpistemicStatus;
  /** Whether the first-order state is globally accessible and reportable via the HOT */
  accessibleToReport: boolean;
  /** Estimated risk that HOT misrepresents or confabulates the first-order state (HOT discrepancy) */
  misrepresentationRisk: number;
  timestamp: number;
}

// ── Metacognitive Controller ────────────────────────────────────────

export class MetacognitiveController {
  /** Active object-level processes being monitored */
  private activeProcesses = new Map<string, ObjectLevelState>();

  /** First-order mental states monitored under HOT architecture */
  private firstOrderStates = new Map<string, FirstOrderState>();

  /** Higher-order representations (HORs) structuring first-order mental states */
  private higherOrderRepresentations = new Map<string, HigherOrderRepresentation>();

  /** History of monitoring judgments + their outcomes */
  private judgmentHistory: Array<{
    judgment: MonitoringJudgment;
    outcome: TaskOutcome | null;
  }> = [];

  /** History of control decisions + whether they helped */
  private controlHistory: Array<{
    decision: ControlDecision;
    outcomeImproved: boolean | null;
  }> = [];

  private maxHistory: number;

  constructor(opts?: { maxHistory?: number }) {
    this.maxHistory = opts?.maxHistory ?? 500;
  }

  // ── Object-Level Registration ──────────────────────────────────

  /** Register an object-level process for monitoring */
  registerProcess(state: ObjectLevelState): void {
    this.activeProcesses.set(state.taskId, state);
  }

  /** Update an object-level process state */
  updateProcess(taskId: string, update: Partial<ObjectLevelState>): void {
    const existing = this.activeProcesses.get(taskId);
    if (existing) {
      Object.assign(existing, update);
    }
  }

  /** Deregister an object-level process */
  deregisterProcess(taskId: string): void {
    this.activeProcesses.delete(taskId);
  }

  // ── Monitoring (Meta-Level Observes Object-Level) ──────────────

  /** Make a monitoring judgment about an object-level process.
   *  This IS metacognition in the Nelson-Narens sense. */
  monitor(taskId: string): MonitoringJudgment | null {
    const process = this.activeProcesses.get(taskId);
    if (!process) return null;

    const meta = getMetacognitiveState();
    const gate = getActionGate();
    const snapshot = meta.getSnapshot();

    // 1. Base meta-confidence on calibration history
    const calibration = gate.getConfidenceCalibration();
    const selfConfidence = process.selfReportedConfidence;

    // Adjust: if system is overconfident (positive calibration), reduce meta-confidence
    // If underconfident (negative calibration), increase meta-confidence
    const adjustedConfidence = Math.max(0, Math.min(1,
      selfConfidence - calibration * 0.5,
    ));

    // 2. Feeling-of-knowing judgment
    // Based on: self-confidence (primary signal), category-specific success rate,
    // calibration, and free energy
    const completedHistory = this.judgmentHistory.filter(h => h.outcome !== null);
    const recentSuccessRate = completedHistory.length >= 5
      ? completedHistory.filter(h => h.outcome?.success).length / completedHistory.length
      : 0.5;

    // Category-specific success rate: tasks with HIGH self-confidence
    // should succeed more often than tasks with LOW self-confidence.
    // If we have evidence of this correlation, weight it heavily.
    const highConfHistory = completedHistory.filter(
      h => h.judgment.metaConfidence > 0.6
    );
    const lowConfHistory = completedHistory.filter(
      h => h.judgment.metaConfidence <= 0.6
    );
    const highConfSuccessRate = highConfHistory.length >= 3
      ? highConfHistory.filter(h => h.outcome?.success).length / highConfHistory.length
      : 0.7; // Prior: high confidence usually means success
    const lowConfSuccessRate = lowConfHistory.length >= 3
      ? lowConfHistory.filter(h => h.outcome?.success).length / lowConfHistory.length
      : 0.3; // Prior: low confidence usually means failure

    // Use category-specific rate matched to current confidence
    const matchedSuccessRate = adjustedConfidence > 0.6
      ? highConfSuccessRate
      : lowConfSuccessRate;

    const freeEnergy = snapshot.regulation.evaluating.lastFreeEnergyEstimate;
    const fokRaw = matchedSuccessRate * 0.5 + adjustedConfidence * 0.3 + (1 - freeEnergy) * 0.2;

    const feelingOfKnowing: ConfidenceJudgment =
      fokRaw > 0.8 ? 'high' :
      fokRaw > 0.6 ? 'medium' :
      fokRaw > 0.4 ? 'low' : 'very-low';

    // 3. Predicted success probability
    const predictedSuccessProbability = Math.max(0, Math.min(1,
      matchedSuccessRate * 0.5 + adjustedConfidence * 0.4 + (1 - freeEnergy) * 0.1
    ));

    // 4. Verification and help decisions
    const needsVerification = adjustedConfidence < 0.6 || freeEnergy > 0.5;
    const needsHelp = adjustedConfidence < 0.3 && freeEnergy > 0.7;

    const judgment: MonitoringJudgment = {
      taskId,
      onTrack: adjustedConfidence > 0.5,
      metaConfidence: adjustedConfidence,
      feelingOfKnowing,
      predictedSuccessProbability,
      needsVerification,
      needsHelp,
      reasoning: `calibration=${calibration.toFixed(3)}, selfConf=${selfConfidence.toFixed(2)}, adjusted=${adjustedConfidence.toFixed(2)}, fok=${feelingOfKnowing}, freeEnergy=${freeEnergy.toFixed(3)}, recentSuccess=${recentSuccessRate.toFixed(2)}`,
      timestamp: Date.now(),
    };

    this.judgmentHistory.push({ judgment, outcome: null });
    if (this.judgmentHistory.length > this.maxHistory) {
      this.judgmentHistory.shift();
    }

    return judgment;
  }

  // ── Control (Meta-Level Adjusts Object-Level) ──────────────────

  /** Make a control decision based on a monitoring judgment.
   *  This IS metacognitive control — the meta-level changing
   *  the object-level's behavior. */
  control(judgment: MonitoringJudgment): ControlDecision {
    let allocation: AllocationDecision;
    let effortMultiplier = 1.0;
    let strategyChange: string | null = null;

    if (judgment.needsHelp) {
      allocation = 'request-help';
      effortMultiplier = 2.0;
    } else if (judgment.needsVerification || judgment.feelingOfKnowing === 'low') {
      // Prefer verification over hard abort when uncertainty is high.
      // High free-energy / low FoK is exactly when active inference should
      // spend effort checking, not when it should refuse everything blindly.
      allocation = 'verify-first';
      effortMultiplier = 1.5;
      const meta = getMetacognitiveState();
      const preferred = meta.getPreferredStrategy('reasoning');
      if (preferred && preferred !== 'intuitive') {
        strategyChange = preferred;
      }
    } else if (judgment.feelingOfKnowing === 'very-low') {
      // Only abort when FoK is rock bottom *and* verification was not flagged
      // (needsVerification already handled above).
      allocation = 'abort';
      effortMultiplier = 0;
    } else {
      allocation = 'proceed';
      effortMultiplier = 1.0;
    }

    const decision: ControlDecision = {
      taskId: judgment.taskId,
      allocation,
      effortMultiplier,
      strategyChange,
      reasoning: `FoK=${judgment.feelingOfKnowing}, metaConf=${judgment.metaConfidence.toFixed(2)}, predicted=${judgment.predictedSuccessProbability.toFixed(2)}, allocation=${allocation}, effort=${effortMultiplier.toFixed(1)}x`,
      timestamp: Date.now(),
    };

    this.controlHistory.push({ decision, outcomeImproved: null });
    if (this.controlHistory.length > this.maxHistory) {
      this.controlHistory.shift();
    }

    return decision;
  }

  // ── Outcome Registration (Closes the Learning Loop) ────────────

  /** Register the outcome of a monitored task.
   *  This is how the system LEARNS whether its metacognitive
   *  judgments are accurate. */
  registerOutcome(taskId: string, outcome: TaskOutcome): void {
    // Find the matching judgment
    const entry = [...this.judgmentHistory].reverse().find(
      (h: { judgment: MonitoringJudgment; outcome: TaskOutcome | null }) => h.judgment.taskId === taskId
    );
    if (entry) {
      entry.outcome = outcome;
    }

    // Update FoK calibration in metacognitive state
    const meta = getMetacognitiveState();
    meta.endTask({
      success: outcome.success,
      strategyUsed: 'metacognitive-monitoring',
    });
  }

  // ── Verification Metrics ───────────────────────────────────────

  /** Goodman-Kruskal gamma for FoK-accuracy correlation.
   *  Measures whether FoK judgments actually predict outcomes.
   *  Range: -1 to 1. >0 = metacognitive, 0 = random, <0 = anti. */
  getFoKGamma(): number {
    const withOutcome = this.judgmentHistory.filter(
      h => h.outcome !== null
    );
    if (withOutcome.length < 5) return 0;

    // Simplified gamma: compare all pairs
    let concordant = 0;
    let discordant = 0;

    for (let i = 0; i < withOutcome.length; i++) {
      for (let j = i + 1; j < withOutcome.length; j++) {
        const a = withOutcome[i];
        const b = withOutcome[j];
        const fokA = a.judgment.predictedSuccessProbability;
        const fokB = b.judgment.predictedSuccessProbability;
        const outcomeA = a.outcome!.success ? 1 : 0;
        const outcomeB = b.outcome!.success ? 1 : 0;

        if (fokA === fokB) continue; // tied

        const fokHigher = fokA > fokB;
        const outcomeHigher = outcomeA > outcomeB;

        if (fokHigher === outcomeHigher) {
          concordant++;
        } else {
          discordant++;
        }
      }
    }

    const total = concordant + discordant;
    return total === 0 ? 0 : (concordant - discordant) / total;
  }

  /** Brier score for prediction accuracy (0=perfect, 0.25=random, 1=worst). */
  getBrierScore(): number {
    const withOutcome = this.judgmentHistory.filter(
      h => h.outcome !== null
    );
    if (withOutcome.length === 0) return 0.25;

    let sumSqError = 0;
    for (const h of withOutcome) {
      const predicted = h.judgment.predictedSuccessProbability;
      const actual = h.outcome!.success ? 1 : 0;
      sumSqError += (predicted - actual) ** 2;
    }
    return sumSqError / withOutcome.length;
  }

  /** Is the metacognitive system functioning above chance?
   *  Gamma > 0 AND Brier < 0.25 = genuinely metacognitive. */
  isMetacognitive(): { value: boolean; evidence: string } {
    const gamma = this.getFoKGamma();
    const brier = this.getBrierScore();
    const n = this.judgmentHistory.filter(h => h.outcome !== null).length;

    const value = gamma > 0 && brier < 0.25 && n >= 10;
    const evidence = value
      ? `gamma=${gamma.toFixed(3)} (>0), brier=${brier.toFixed(3)} (<0.25), n=${n} (>=10) → ABOVE CHANCE`
      : `gamma=${gamma.toFixed(3)}, brier=${brier.toFixed(3)}, n=${n} → ${n < 10 ? 'insufficient data' : 'at or below chance'}`;

    return { value, evidence };
  }

  /** Get monitoring judgment history */
  getJudgmentHistory(limit = 20): typeof this.judgmentHistory {
    return this.judgmentHistory.slice(-limit);
  }

  /** Get control decision history */
  getControlHistory(limit = 20): typeof this.controlHistory {
    return this.controlHistory.slice(-limit);
  }

  // ── Higher-Order Thought (HOT) Architecture ───────────────────────

  /** Register an incoming first-order mental state (e.g. perception, action signal) */
  registerFirstOrderState(state: FirstOrderState): void {
    this.firstOrderStates.set(state.id, state);
  }

  /** Retrieve a first-order mental state */
  getFirstOrderState(id: string): FirstOrderState | undefined {
    return this.firstOrderStates.get(id);
  }

  /**
   * Generates a Higher-Order Representation (HOR) targeting a first-order mental state.
   * Under Rosenthal's HOT theory, this transforms an unconscious first-order state into
   * a consciously accessible mental state represented as "I am in state S".
   */
  generateHigherOrderRepresentation(
    firstOrderId: string,
    options?: Partial<HigherOrderRepresentation>
  ): HigherOrderRepresentation | null {
    const firstOrder = this.firstOrderStates.get(firstOrderId);
    if (!firstOrder) return null;

    const horId = `hor-${firstOrderId}-${Date.now()}`;
    const attitude: HigherOrderAttitude = options?.attitude ?? (
      firstOrder.rawConfidence > 0.75 ? 'asserts' :
      firstOrder.rawConfidence > 0.45 ? 'hypothesizes' : 'doubts'
    );

    // Meta-confidence reflects calibrated assessment of the first-order state
    const calibration = getActionGate().getConfidenceCalibration();
    const metaConfidence = Math.max(0.01, Math.min(0.99,
      options?.higherOrderConfidence ?? (firstOrder.rawConfidence - calibration * 0.3)
    ));

    const epistemicStatus: EpistemicStatus = options?.epistemicStatus ?? (
      firstOrder.activationLevel > 0.6 ? 'grounded' : 'inferential'
    );

    const misrepresentationRisk = Math.max(0, Math.min(1,
      (1 - metaConfidence) * 0.5 + Math.abs(firstOrder.rawConfidence - metaConfidence) * 0.5
    ));

    const metaContent = options?.metaContent ?? (
      `System represents that it ${attitude} first-order ${firstOrder.modality} state [${firstOrder.target}] with confidence ${metaConfidence.toFixed(2)}`
    );

    // In HOT theory, access to verbal/global report requires both activation and HOR presence
    const accessibleToReport = options?.accessibleToReport ?? (
      firstOrder.activationLevel >= 0.3 && metaConfidence >= 0.4
    );

    const hor: HigherOrderRepresentation = {
      id: horId,
      firstOrderStateId: firstOrderId,
      modality: firstOrder.modality,
      attitude,
      metaContent,
      higherOrderConfidence: metaConfidence,
      epistemicStatus,
      accessibleToReport,
      misrepresentationRisk,
      timestamp: Date.now(),
    };

    this.higherOrderRepresentations.set(horId, hor);
    return hor;
  }

  /** Retrieve a higher-order representation by ID */
  getHigherOrderRepresentation(horId: string): HigherOrderRepresentation | undefined {
    return this.higherOrderRepresentations.get(horId);
  }

  /** Retrieve the most recent higher-order representation monitoring a given first-order state */
  getHORForFirstOrder(firstOrderId: string): HigherOrderRepresentation | undefined {
    const matching = Array.from(this.higherOrderRepresentations.values())
      .filter((h) => h.firstOrderStateId === firstOrderId)
      .sort((a, b) => b.timestamp - a.timestamp);
    return matching[0];
  }

  /** Retrieve all active higher-order representations */
  getActiveHigherOrderRepresentations(): HigherOrderRepresentation[] {
    return Array.from(this.higherOrderRepresentations.values());
  }

  /**
   * Evaluates metacognitive access under HOT:
   * A state has reportable conscious access iff it is accompanied by an active HOR.
   */
  evaluateMetaCognitiveAccess(firstOrderId: string): {
    hasHOR: boolean;
    reportable: boolean;
    hor: HigherOrderRepresentation | null;
  } {
    const hor = this.getHORForFirstOrder(firstOrderId) ?? null;
    return {
      hasHOR: hor !== null,
      reportable: hor !== null && hor.accessibleToReport,
      hor,
    };
  }

  /** Clear all state (used in reset) */
  reset(): void {
    this.activeProcesses.clear();
    this.judgmentHistory = [];
    this.controlHistory = [];
    this.firstOrderStates.clear();
    this.higherOrderRepresentations.clear();
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let globalController: MetacognitiveController | null = null;

export function getMetacognitiveController(): MetacognitiveController {
  if (!globalController) {
    globalController = new MetacognitiveController();
  }
  return globalController;
}

export function resetMetacognitiveController(): void {
  if (globalController) {
    globalController.reset();
  }
  globalController = null;
}
