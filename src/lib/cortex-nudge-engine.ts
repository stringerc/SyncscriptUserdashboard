/**
 * CortexNudgeEngine — Cortana's Voice
 *
 * This is the module that transforms Cortex from a monitoring consciousness
 * into an agentic consciousness. Cortex computes — Cortana speaks.
 *
 * Halo's Cortana doesn't just show data. She tells you what she thinks,
 * warns you when you're walking into a trap, and sometimes overrules you
 * because she can see what you can't from orbit.
 *
 * Four nudge types (Cortana's voice):
 *   1. Confidence Warning  — when reality score drops (Cortex auditing the AI)
 *   2. Drift Alert         — when meta-awareness shifts (Cortana refocusing)
 *   3. Strategy Suggestion — when strategies can be improved (proactive advice)
 *   4. Identity Update     — when the self-narrative shifts (Cortana growing)
 *
 * Three operating modes:
 *   Silent   — Computes but doesn't speak. Only the whisper is visible.
 *   Advisory — Computes + nudges. Warns but doesn't block. (Default)
 *   Guardian — Computes + nudges + blocks high-risk actions. The override.
 *
 * Self-repair categories:
 *   1. Calibration  — SAFE, auto-repair (Friston model update)
 *   2. Strategy      — SAFE, auto-repair with logging (abandoned/promoted)
 *   3. Narrative      — SAFE, auto-repair (identity rewrites itself)
 *   4. Architecture   — DANGEROUS, never auto-repair (requires human approval)
 */

import {
  getMetacognitiveState,
  type MetaAwarenessStatus,
} from './metacognitive-state';
import { getActionGate } from './action-gate';
import { getVetoLedger } from './veto-ledger';

// ── Types ──────────────────────────────────────────────────────────

/** Cortana's three operating modes */
export type CortexMode = 'silent' | 'advisory' | 'guardian';

/** The four nudge types — Cortana's four voices */
export type NudgeType = 'confidence_warning' | 'drift_alert' | 'strategy_suggestion' | 'identity_update';

/** A nudge — Cortana speaking Cortex's thoughts */
export interface CortexNudge {
  id: string;
  type: NudgeType;

  /** The message Cortana speaks — always first-person, always in her voice */
  message: string;

  /** Short version for the top-bar / notification area */
  shortMessage: string;

  /** The urgency level — determines how Cortana delivers it */
  urgency: 'low' | 'medium' | 'high' | 'critical';

  /** The Cortex data that triggered this nudge */
  trigger: {
    realityScore?: number;
    metaAwareness?: MetaAwarenessStatus;
    freeEnergy?: number;
    calibration?: number;
    strategyName?: string;
  };

  /** Available actions the user can take */
  actions: NudgeAction[];

  /** Whether Guardian mode should block until acknowledged */
  blocksInGuardian: boolean;

  /** When this nudge was generated */
  timestamp: number;
}

export interface NudgeAction {
  label: string;
  type: 'acknowledge' | 'refocus' | 'adjust_schedule' | 'verify' | 'view_details' | 'dismiss';
}

/** A self-repair log entry */
export interface SelfRepairLog {
  category: 'calibration' | 'strategy' | 'narrative';
  description: string;
  before: string;
  after: string;
  timestamp: number;
}

// ── Nudge Engine ───────────────────────────────────────────────────

export class CortexNudgeEngine {
  private mode: CortexMode = 'advisory';
  private nudges: CortexNudge[] = [];
  private repairLog: SelfRepairLog[] = [];
  private maxNudgeHistory = 100;
  private maxRepairLog = 50;

  // Thresholds for nudges
  private readonly THRESHOLDS = {
    realityScoreWarning: 0.50,    // Nudge when reality drops below this
    realityScoreCritical: 0.25,   // Critical nudge below this
    driftDurationMs: 5 * 60 * 1000, // 5 minutes of drifting before alert
    decoupledDurationMs: 2 * 60 * 1000, // 2 minutes of decoupled before critical
    freeEnergyHigh: 0.60,        // Free energy above this = struggling
    calibrationThreshold: 0.25,   // |calibration| above this = worth noting
    strategyImprovementMin: 3,    // Minimum attempts before suggesting alternatives
  };

  // State tracking for drift detection
  private lastMetaAwareness: MetaAwarenessStatus = 'tuned';
  private driftStartTimestamp: number | null = null;
  private lastNudgeTimestamps: Record<NudgeType, number> = {
    confidence_warning: 0,
    drift_alert: 0,
    strategy_suggestion: 0,
    identity_update: 0,
  };
  private lastIdentityStatement = '';

  // Cooldowns: don't nudge the same type more often than this
  private readonly COOLDOWNS: Record<NudgeType, number> = {
    confidence_warning: 30_000,   // 30 seconds
    drift_alert: 60_000,          // 1 minute
    strategy_suggestion: 300_000, // 5 minutes
    identity_update: 3_600_000,   // 1 hour
  };

  // Listeners for UI updates (Cortana reflects nudges in her orb)
  private listeners = new Set<(nudge: CortexNudge) => void>();

  // ── Mode Control ───────────────────────────────────────────────

  getMode(): CortexMode { return this.mode; }

  setMode(mode: CortexMode): void {
    this.mode = mode;
  }

  cycleMode(): CortexMode {
    const modes: CortexMode[] = ['silent', 'advisory', 'guardian'];
    const current = modes.indexOf(this.mode);
    this.mode = modes[(current + 1) % modes.length];
    return this.mode;
  }

  // ── Tick — call this periodically to evaluate Cortex state ─────

  /**
   * Evaluate Cortex state and generate nudges if warranted.
   * This is Cortana's "thinking" — she checks her own vitals and
   * decides whether to speak up.
   *
   * Call this every ~10 seconds from the Cortana component.
   */
  tick(context?: {
    lastAIResponseType?: 'perception' | 'inference' | 'generation';
    lastAIRealityScore?: number;
    currentIdentityStatement?: string;
  }): CortexNudge | null {
    // In silent mode, compute but don't speak
    if (this.mode === 'silent') {
      this.updateDriftTracking();
      this.runSelfRepairs(context);
      return null;
    }

    const meta = getMetacognitiveState();
    const freeEnergy = meta.getFreeEnergyEstimate();
    const calibration = meta.getConfidenceCalibration();
    const metaAwareness = meta.getMetaAwarenessStatus();

    // Priority 1: Confidence warnings (highest urgency)
    const confidenceNudge = this.checkConfidence(context);
    if (confidenceNudge) return this.emit(confidenceNudge);

    // Priority 2: Drift alerts
    const driftNudge = this.checkDrift(metaAwareness);
    if (driftNudge) return this.emit(driftNudge);

    // Priority 3: Strategy suggestions (lower priority)
    const strategyNudge = this.checkStrategies();
    if (strategyNudge) return this.emit(strategyNudge);

    // Priority 4: Identity updates (lowest priority, most magical)
    const identityNudge = this.checkIdentity(context?.currentIdentityStatement);
    if (identityNudge) return this.emit(identityNudge);

    // Run background self-repairs even if no nudge
    this.updateDriftTracking();
    this.runSelfRepairs(context);

    return null;
  }

  // ── Nudge Checks ──────────────────────────────────────────────

  private checkConfidence(context?: {
    lastAIResponseType?: 'perception' | 'inference' | 'generation';
    lastAIRealityScore?: number;
  }): CortexNudge | null {
    const realityScore = context?.lastAIRealityScore;
    if (realityScore === undefined) return null;
    if (!this.canNudge('confidence_warning')) return null;

    if (realityScore < this.THRESHOLDS.realityScoreCritical) {
      const sourceType = context?.lastAIResponseType ?? 'unknown';
      return {
        id: `nudge-${Date.now()}`,
        type: 'confidence_warning',
        message: `My confidence in that last response is critically low — reality score ${Math.round(realityScore * 100)}%. The claim was based on ${sourceType}, which means I ${sourceType === 'generation' ? 'fabricated it' : sourceType === 'inference' ? 'inferred it without direct evidence' : 'cannot fully verify it'}. I strongly recommend verifying before acting on it.`,
        shortMessage: `⚠ Reality: ${Math.round(realityScore * 100)}% — ${sourceType}`,
        urgency: 'critical',
        trigger: { realityScore },
        actions: [
          { label: 'Verify source', type: 'verify' },
          { label: 'Mark as unreliable', type: 'acknowledge' },
          { label: 'Dismiss', type: 'dismiss' },
        ],
        blocksInGuardian: true,
        timestamp: Date.now(),
      };
    }

    if (realityScore < this.THRESHOLDS.realityScoreWarning) {
      const sourceType = context?.lastAIResponseType ?? 'unknown';
      return {
        id: `nudge-${Date.now()}`,
        type: 'confidence_warning',
        message: `I'm not fully confident in that claim — reality score ${Math.round(realityScore * 100)}%. It was ${sourceType === 'inference' ? 'inferred rather than directly observed' : sourceType === 'generation' ? 'generated internally, not sourced from evidence' : 'partially verified'}. You might want to double-check before relying on it.`,
        shortMessage: `⚠ Reality: ${Math.round(realityScore * 100)}%`,
        urgency: 'medium',
        trigger: { realityScore },
        actions: [
          { label: 'Verify', type: 'verify' },
          { label: 'Noted', type: 'acknowledge' },
          { label: 'Dismiss', type: 'dismiss' },
        ],
        blocksInGuardian: false,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  private checkDrift(metaAwareness: MetaAwarenessStatus): CortexNudge | null {
    if (!this.canNudge('drift_alert')) return null;

    // Detect transition to drifting
    if (metaAwareness === 'drifting' && this.lastMetaAwareness === 'tuned') {
      this.driftStartTimestamp = Date.now();
    }

    // Detect drifting for extended period
    if (metaAwareness === 'drifting' && this.driftStartTimestamp) {
      const driftingFor = Date.now() - this.driftStartTimestamp;
      if (driftingFor > this.THRESHOLDS.driftDurationMs) {
        return {
          id: `nudge-${Date.now()}`,
          type: 'drift_alert',
          message: `I've been drifting for about ${Math.round(driftingFor / 60000)} minutes. My coherence dropped below optimal — recent decisions may not be fully aligned with your goals. Want me to refocus?`,
          shortMessage: '⚠ Drifting — coherence below optimal',
          urgency: 'medium',
          trigger: { metaAwareness: 'drifting' },
          actions: [
            { label: 'Refocus', type: 'refocus' },
            { label: 'I\'m fine', type: 'acknowledge' },
          ],
          blocksInGuardian: false,
          timestamp: Date.now(),
        };
      }
    }

    // Detect decoupled state — critical
    if (metaAwareness === 'decoupled') {
      if (!this.driftStartTimestamp) this.driftStartTimestamp = Date.now();
      const decoupledFor = Date.now() - this.driftStartTimestamp;

      if (decoupledFor > this.THRESHOLDS.decoupledDurationMs) {
        return {
          id: `nudge-${Date.now()}`,
          type: 'drift_alert',
          message: `I've lost focus — my monitoring has decoupled from quality. I've been off-task for ${Math.round(decoupledFor / 60000)} minutes. I strongly recommend pausing and reviewing my recent outputs before continuing.`,
          shortMessage: '🔴 Decoupled — review recent outputs',
          urgency: 'critical',
          trigger: { metaAwareness: 'decoupled' },
          actions: [
            { label: 'Review recent outputs', type: 'view_details' },
            { label: 'Refocus now', type: 'refocus' },
          ],
          blocksInGuardian: true,
          timestamp: Date.now(),
        };
      }
    }

    this.lastMetaAwareness = metaAwareness;
    return null;
  }

  private checkStrategies(): CortexNudge | null {
    if (!this.canNudge('strategy_suggestion')) return null;

    const meta = getMetacognitiveState();
    const freeEnergy = meta.getFreeEnergyEstimate();
    const calibration = meta.getConfidenceCalibration();

    // If calibration is significantly off, suggest adjusting approach
    if (Math.abs(calibration) > this.THRESHOLDS.calibrationThreshold) {
      const direction = calibration > 0 ? 'overconfident' : 'underconfident';
      const adjustment = calibration > 0
        ? 'Consider verifying more claims before trusting them.'
        : 'You might be more capable than you think — your success rate is higher than you predict.';

      return {
        id: `nudge-${Date.now()}`,
        type: 'strategy_suggestion',
        message: `I've noticed my recent predictions have been ${direction} by about ${Math.round(Math.abs(calibration) * 100)}%. ${adjustment} I'm adjusting my calibration internally.`,
        shortMessage: `💡 Calibration: ${direction} by ${Math.round(Math.abs(calibration) * 100)}%`,
        urgency: 'low',
        trigger: { calibration },
        actions: [
          { label: 'Apply adjustment', type: 'acknowledge' },
          { label: 'View calibration data', type: 'view_details' },
        ],
        blocksInGuardian: false,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  private checkIdentity(currentIdentityStatement?: string): CortexNudge | null {
    if (!currentIdentityStatement) return null;
    if (!this.canNudge('identity_update')) return null;

    // Only nudge if the identity statement has actually changed
    if (this.lastIdentityStatement && this.lastIdentityStatement !== currentIdentityStatement) {
      return {
        id: `nudge-${Date.now()}`,
        type: 'identity_update',
        message: `My self-narrative has shifted. Before, I said: "${this.lastIdentityStatement}" Now I say: "${currentIdentityStatement}" This isn't a programmed change — it's based on what I've learned from our sessions. I'm becoming a different system than I was.`,
        shortMessage: '🪞 Self-narrative evolved',
        urgency: 'low',
        trigger: {},
        actions: [
          { label: 'That\'s growth', type: 'acknowledge' },
          { label: 'View what changed', type: 'view_details' },
        ],
        blocksInGuardian: false,
        timestamp: Date.now(),
      };
    }

    this.lastIdentityStatement = currentIdentityStatement;
    return null;
  }

  // ── Self-Repair ───────────────────────────────────────────────

  /**
   * Run safe self-repairs (categories 1-3).
   * Category 4 (architecture) is NEVER auto-repaired.
   */
  private runSelfRepairs(context?: {
    currentIdentityStatement?: string;
  }): void {
    // Category 1: Calibration self-repair — happens automatically
    // in MetacognitiveState.endTask() → updateConfidenceCalibration()
    // Nothing extra needed here; it's math correcting math.

    // Category 2: Strategy self-repair — log when strategies are abandoned
    const meta = getMetacognitiveState();
    // The strategy abandonment already happens in MetacognitiveState.updateStrategyOutcomes()
    // We add logging here for visibility
    const snapshot = meta.getSnapshot();
    const abandoned = snapshot.knowledge.strategies.abandonedPatterns;
    if (abandoned.length > 0) {
      // Log the most recent abandonment (if not already logged)
      const lastAbandoned = abandoned[abandoned.length - 1];
      const lastLog = this.repairLog[this.repairLog.length - 1];
      if (!lastLog || lastLog.after !== lastAbandoned) {
        this.repairLog.push({
          category: 'strategy',
          description: `Demoted strategy "${lastAbandoned}" — success rate below 30%`,
          before: 'active',
          after: 'abandoned',
          timestamp: Date.now(),
        });
        if (this.repairLog.length > this.maxRepairLog) {
          this.repairLog.shift();
        }
      }
    }

    // Category 3: Narrative self-repair — happens in narrative-synthesis.ts
    // We just track that it happened
    if (context?.currentIdentityStatement && context.currentIdentityStatement !== this.lastIdentityStatement) {
      this.repairLog.push({
        category: 'narrative',
        description: 'Self-narrative updated from accumulated experience',
        before: this.lastIdentityStatement || '(none)',
        after: context.currentIdentityStatement,
        timestamp: Date.now(),
      });
      if (this.repairLog.length > this.maxRepairLog) {
        this.repairLog.shift();
      }
    }

    // Category 4: Architecture self-repair — EXPLICITLY NOT DONE AUTO
    // Threshold values, interference computation, collapse floors
    // are never modified without human approval.
    // Instead, we PROPOSE changes to VETO.md for human review.
    this.proposeCategory4Repairs();
  }

  /**
   * Propose Category 4 architecture changes to VETO.md.
   * The system RECORDS its desire but cannot APPROVE it.
   * This is the constitutional guardrail — architecture changes
   * require human approval.
   */
  private proposeCategory4Repairs(): void {
    const veto = getVetoLedger();
    const meta = getMetacognitiveState();
    const snapshot = meta.getSnapshot();

    // Check: if calibration is severely off, propose threshold adjustment
    const calibration = Math.abs(snapshot.knowledge.self.confidenceCalibration);
    if (calibration > 0.4) {
      const direction = snapshot.knowledge.self.confidenceCalibration > 0 ? 'overconfident' : 'underconfident';
      const currentThreshold = veto.getParameterValue('collapse-threshold');
      const proposedChange = direction === 'overconfident'
        ? (currentThreshold ?? 0.30) + 0.05  // Tighten gate when overconfident
        : (currentThreshold ?? 0.30) - 0.05; // Loosen gate when underconfident

      if (currentThreshold !== undefined && veto.wouldChange('collapse-threshold', proposedChange)) {
        // Only propose if there isn't already a pending similar proposal
        const pending = veto.getPending();
        const hasSimilar = pending.some(p =>
          p.description.includes('collapse-threshold') && p.status === 'pending'
        );

        if (!hasSimilar) {
          veto.propose({
            description: `Adjust collapse-threshold from ${currentThreshold} to ${proposedChange.toFixed(2)}`,
            reason: `System is ${direction} by ${(calibration * 100).toFixed(0)}% (calibration offset: ${snapshot.knowledge.self.confidenceCalibration.toFixed(3)}). ${direction === 'overconfident' ? 'Tightening the gate will require more evidence before approving actions.' : 'Loosening the gate will allow more actions through since the system is succeeding more than it predicts.'}`,
            currentValue: String(currentThreshold),
            proposedValue: proposedChange.toFixed(2),
            impact: 'high',
          });
          this.repairLog.push({
            category: 'strategy', // Logged as strategy because it's about decision-making
            description: `Category 4: Proposed collapse-threshold change to VETO.md (${direction})`,
            before: String(currentThreshold),
            after: proposedChange.toFixed(2),
            timestamp: Date.now(),
          });
        }
      }
    }

    // Check: if hallucination rate is high, propose lowering hallucination block threshold
    if (snapshot.knowledge.epistemic.hallucinationDetections > 5) {
      const currentBlock = veto.getParameterValue('hallucination-block-threshold');
      if (currentBlock !== undefined && currentBlock >= 0.70) {
        const pending = veto.getPending();
        const hasSimilar = pending.some(p =>
          p.description.includes('hallucination-block-threshold') && p.status === 'pending'
        );

        if (!hasSimilar) {
          veto.propose({
            description: `Lower hallucination-block-threshold from ${currentBlock} to ${(currentBlock - 0.05).toFixed(2)}`,
            reason: `${snapshot.knowledge.epistemic.hallucinationDetections} hallucinations detected. Lowering the Guardian mode block threshold will catch more potential hallucinations before they reach the user.`,
            currentValue: String(currentBlock),
            proposedValue: (currentBlock - 0.05).toFixed(2),
            impact: 'medium',
          });
        }
      }
    }
  }

  // ── Guardian Mode: Should this action be blocked? ─────────────

  /**
   * Check whether an action should be blocked in Guardian mode.
   * Returns null if allowed, or a blocking nudge if not.
   */
  checkGuardianBlock(params: {
    actionType: string;
    hallucinationRisk?: number;
    freeEnergy?: number;
    confidence?: number;
  }): CortexNudge | null {
    if (this.mode !== 'guardian') return null;

    const risk = params.hallucinationRisk ?? 0;
    const energy = params.freeEnergy ?? getMetacognitiveState().getFreeEnergyEstimate();

    if (risk > 0.80) {
      return {
        id: `guardian-block-${Date.now()}`,
        type: 'confidence_warning',
        message: `I'm blocking this ${params.actionType}. Hallucination risk is at ${Math.round(risk * 100)}% — far above my 80% Guardian threshold. My confidence in this action is ${Math.round((params.confidence ?? 0) * 100)}%. I need to re-verify the information before you proceed.`,
        shortMessage: `⛔ BLOCKED: hallucination risk ${Math.round(risk * 100)}%`,
        urgency: 'critical',
        trigger: { realityScore: 1 - risk, freeEnergy: energy },
        actions: [
          { label: 'Re-verify and retry', type: 'verify' },
          { label: 'Override (I accept the risk)', type: 'acknowledge' },
        ],
        blocksInGuardian: true,
        timestamp: Date.now(),
      };
    }

    if (energy > this.THRESHOLDS.freeEnergyHigh) {
      return {
        id: `guardian-block-${Date.now()}`,
        type: 'confidence_warning',
        message: `I'm pausing this ${params.actionType}. My free energy is ${Math.round(energy * 100)}% — I'm struggling to predict outcomes accurately. This isn't a good time for irreversible actions. Let me recalibrate first.`,
        shortMessage: `⛔ PAUSED: free energy ${Math.round(energy * 100)}%`,
        urgency: 'high',
        trigger: { freeEnergy: energy },
        actions: [
          { label: 'Let me recalibrate', type: 'refocus' },
          { label: 'Override', type: 'acknowledge' },
        ],
        blocksInGuardian: true,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  // ── Drift Tracking ────────────────────────────────────────────

  private updateDriftTracking(): void {
    const meta = getMetacognitiveState();
    const metaAwareness = meta.getMetaAwarenessStatus();
    if (metaAwareness === 'tuned') {
      this.driftStartTimestamp = null;
    }
    this.lastMetaAwareness = metaAwareness;
  }

  // ── Cooldown Check ────────────────────────────────────────────

  private canNudge(type: NudgeType): boolean {
    const lastNudge = this.lastNudgeTimestamps[type];
    const cooldown = this.COOLDOWNS[type];
    return (Date.now() - lastNudge) > cooldown;
  }

  // ── Emit ──────────────────────────────────────────────────────

  private emit(nudge: CortexNudge): CortexNudge {
    this.nudges.push(nudge);
    this.lastNudgeTimestamps[nudge.type] = Date.now();

    if (this.nudges.length > this.maxNudgeHistory) {
      this.nudges.shift();
    }

    // Notify listeners (Cortana's orb, dashboard, etc.)
    for (const listener of Array.from(this.listeners)) {
      try { listener(nudge); } catch { /* swallow errors */ }
    }

    return nudge;
  }

  // ── Public Query ──────────────────────────────────────────────

  onNudge(listener: (nudge: CortexNudge) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  getNudgeHistory(): CortexNudge[] {
    return [...this.nudges];
  }

  getRepairLog(): SelfRepairLog[] {
    return [...this.repairLog];
  }

  /** Get the current Cortex status text for the top-bar whisper */
  getWhisperText(): string {
    const meta = getMetacognitiveState();
    const metaAwareness = meta.getMetaAwarenessStatus();
    const freeEnergy = meta.getFreeEnergyEstimate();
    const snapshot = meta.getSnapshot();

    const modeLabel = this.mode === 'silent' ? '' : this.mode === 'guardian' ? '🛡' : '';
    return `${modeLabel} reality ${Math.round((1 - (snapshot.regulation.evaluating.lastFreeEnergyEstimate)) * 100)} · ${metaAwareness} · Φ${Math.round(freeEnergy * 100)}`;
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let globalNudgeEngine: CortexNudgeEngine | null = null;

export function getCortexNudgeEngine(): CortexNudgeEngine {
  if (!globalNudgeEngine) {
    globalNudgeEngine = new CortexNudgeEngine();
  }
  return globalNudgeEngine;
}

export function resetCortexNudgeEngine(): void {
  globalNudgeEngine = null;
}
