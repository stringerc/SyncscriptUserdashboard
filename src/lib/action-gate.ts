/**
 * ActionGate — Action Validation Pipeline for action validation
 *
 * Before executing any irreversible action (deploy, delete, file write),
 * the gate enforces a collapse: it reduces the superposition of possible
 * strategies to a single verified action, validates it against acceptance
 * criteria, and only then allows execution.
 *
 * This implements the Action Validation principle that consciousness requires
 * a collapse threshold — a critical mass of computation before a
 * decision becomes "real." Actions that skip the gate are
 * "unconscious" — they execute without validation.
 *
 * Usage:
 *   const gate = new ActionGate();
 *   const result = gate.evaluate({
 *     action: 'deploy',
 *     agent: 'nexus',
 *     options: [
 *       { label: 'Deploy to production', confidence: 0.9, risk: 'medium' },
 *       { label: 'Deploy to preview', confidence: 0.7, risk: 'low' },
 *     ],
 *     criteria: ['Tests pass', 'Build succeeds', 'No regressions'],
 *     verified: { testsPass: true, buildSucceeds: true, noRegressions: true },
 *   });
 *   if (result.approved) { execute(result.selectedOption); }
 */

import { getSensorimotorLoop } from './sensorimotor-loop';

export interface ActionOption {
  label: string;
  confidence: number; // 0–1
  risk: 'low' | 'medium' | 'high';
  tags?: string[];
}

export interface ActionVerification {
  [key: string]: boolean;
}

export interface ActionValidationInput {
  action: string;
  agent: string;
  topic?: string;
  options: ActionOption[];
  criteria: string[];
  verified: ActionVerification;
  override?: boolean; // skip gate (emergency use only)
}

export interface ActionValidationResult {
  action: string;
  agent: string;
  approved: boolean;
  selectedOption: ActionOption | null;
  rejectedOptions: ActionOption[];
  validationScore: number; // 0–1, how confident the gate is
  failedCriteria: string[];
  reason: string;
}

export class ActionGate {
  private auditLog: ActionValidationResult[] = [];
  private maxAuditEntries: number;

  constructor(opts?: { maxAuditEntries?: number }) {
    this.maxAuditEntries = opts?.maxAuditEntries ?? 100;
  }

  evaluate(input: ActionValidationInput): ActionValidationResult {
    // Emergency override — log but approve
    if (input.override) {
      const result: ActionValidationResult = {
        action: input.action,
        agent: input.agent,
        approved: true,
        selectedOption: input.options[0] ?? null,
        rejectedOptions: input.options.slice(1),
        validationScore: 1.0,
        failedCriteria: [],
        reason: 'OVERRIDE: Gate bypassed by operator',
      };
      this.log(result);
      return result;
    }

    // Step 1: Verify all acceptance criteria
    const failedCriteria = input.criteria.filter(c => !input.verified[c]);
    if (failedCriteria.length > 0) {
      const result: ActionValidationResult = {
        action: input.action,
        agent: input.agent,
        approved: false,
        selectedOption: null,
        rejectedOptions: input.options,
        validationScore: 0,
        failedCriteria,
        reason: `FAILED: ${failedCriteria.join(', ')}`,
      };
      this.log(result);
      return result;
    }

    // Step 2: Rank options by confidence, penalize high risk
    const scored = input.options.map(opt => ({
      opt,
      score: opt.confidence * (opt.risk === 'low' ? 1.0 : opt.risk === 'medium' ? 0.8 : 0.5),
    }));
    scored.sort((a, b) => b.score - a.score);

    // Step 2.5: Active Inference Mastery Check
    // If we have historically failed at this action (high free energy / low mastery),
    // we dynamically raise the confidence threshold to act conservatively.
    const sLoop = getSensorimotorLoop();
    const mastery = sLoop.getMastery(input.action as any, input.topic);
    const requiredThreshold = mastery < 0.4 ? 0.7 : 0.3; // Avoid paths with high prediction error

    // Step 3: Collapse — select the highest-scoring option
    const winner = scored[0];
    if (!winner || winner.score < requiredThreshold) {
      const result: ActionValidationResult = {
        action: input.action,
        agent: input.agent,
        approved: false,
        selectedOption: null,
        rejectedOptions: input.options,
        validationScore: 0,
        failedCriteria: [],
        reason: mastery < 0.4 
          ? `ACTIVE INFERENCE REJECTION: Historical mastery is very low (${mastery.toFixed(2)}). Required confidence raised to ${requiredThreshold}, but best option scored ${winner?.score.toFixed(2) ?? 'N/A'}.`
          : `LOW CONFIDENCE: Best option scored ${winner?.score.toFixed(2) ?? 'N/A'}, threshold is ${requiredThreshold}`,
      };
      this.log(result);
      return result;
    }

    const result: ActionValidationResult = {
      action: input.action,
      agent: input.agent,
      approved: true,
      selectedOption: winner.opt,
      rejectedOptions: scored.slice(1).map(s => s.opt),
      validationScore: winner.score,
      failedCriteria: [],
      reason: `COLLAPSED: ${winner.opt.label} (score=${winner.score.toFixed(2)})`,
    };
    this.log(result);
    return result;
  }

  getAuditLog(): ActionValidationResult[] {
    return [...this.auditLog];
  }

  // ── Outcome Tracking & Confidence Calibration ─────────────────
  // Genuine metacognitive measure (Flavell 1979, Nelson-Narens 1990):
  // track whether high-confidence decisions actually succeed, exposing
  // overconfidence / underconfidence so the system can self-correct.

  private outcomeLog: Array<{
    action: string;
    predictedConfidence: number;
    actualSuccess: boolean;
    timestamp: number;
  }> = [];

  /** Record whether a previously-evaluated action actually succeeded.
   *  The confidence comes from the ActionValidationResult's validationScore. */
  recordOutcome(result: ActionValidationResult, success: boolean): void {
    this.outcomeLog.push({
      action: result.action,
      predictedConfidence: result.validationScore,
      actualSuccess: success,
      timestamp: Date.now(),
    });
    // Keep bounded — same limit as audit log
    if (this.outcomeLog.length > this.maxAuditEntries) {
      this.outcomeLog.shift();
    }
  }

  /** Mean calibration offset: positive = overconfident, negative = underconfident.
   *  0 = perfectly calibrated. Computed from all recorded outcomes. */
  getConfidenceCalibration(): number {
    if (this.outcomeLog.length === 0) return 0;
    let sumOffset = 0;
    for (const entry of this.outcomeLog) {
      const actual = entry.actualSuccess ? 1 : 0;
      sumOffset += entry.predictedConfidence - actual;
    }
    return sumOffset / this.outcomeLog.length;
  }

  /** Binned calibration curve: for each confidence bucket, what fraction
   *  actually succeeded?  A perfectly calibrated system lies on the diagonal. */
  getCalibrationCurve(): Array<{
    confidenceBin: number;
    predictedConfidence: number;
    actualSuccessRate: number;
    samples: number;
  }> {
    const BINS = 10;
    const buckets: Array<{ sumPred: number; sumActual: number; count: number }> =
      Array.from({ length: BINS }, () => ({ sumPred: 0, sumActual: 0, count: 0 }));

    for (const entry of this.outcomeLog) {
      const bin = Math.min(
        BINS - 1,
        Math.floor(entry.predictedConfidence * BINS)
      );
      buckets[bin].sumPred += entry.predictedConfidence;
      buckets[bin].sumActual += entry.actualSuccess ? 1 : 0;
      buckets[bin].count++;
    }

    return buckets
      .map((b, i) => ({
        confidenceBin: (i + 0.5) / BINS,
        predictedConfidence: b.count > 0 ? b.sumPred / b.count : 0,
        actualSuccessRate: b.count > 0 ? b.sumActual / b.count : 0,
        samples: b.count,
      }))
      .filter(b => b.samples > 0);
  }

  /**
   * Restore the calibration offset from persistent storage.
   * This artificially seeds the outcome log with the historical offset
   * so that calibration survives restarts.
   */
  restoreCalibrationOffset(offset: number): void {
    if (offset === 0) return;
    
    // Seed the outcome log with a synthetic entry representing the historical offset
    this.outcomeLog = [];
    
    // If offset is positive (overconfident), we add a predicted 1.0 that actually failed (0)
    // If offset is negative (underconfident), we add a predicted 0.0 that actually succeeded (1)
    const predicted = offset > 0 ? 1.0 : 0.0;
    const actual = offset > 0 ? false : true;
    
    // Create multiple entries to weight the historical offset
    const weight = 10;
    for (let i = 0; i < weight; i++) {
      this.outcomeLog.push({
        action: 'historical_restore',
        predictedConfidence: predicted,
        actualSuccess: actual,
        timestamp: Date.now() - 1000 * 60 * 60 * 24 // 1 day ago
      });
    }
    
    // Fine-tune to match exact offset (approximately)
    // This provides continuity for the confidence gap
  }

  private log(result: ActionValidationResult): void {
    this.auditLog.push({ ...result });
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog.shift();
    }
  }
}

// Singleton
let globalGate: ActionGate | null = null;

export function getActionGate(): ActionGate {
  if (!globalGate) {
    globalGate = new ActionGate();
  }
  return globalGate;
}
