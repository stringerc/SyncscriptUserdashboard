/**
 * Persistent Specialist Modules — Continuously Running with Internal State
 *
 * In the old system, specialists were registered per-evaluate() call as
 * anonymous objects. This made them ephemeral — no memory, no learning,
 * no persistent identity.
 *
 * This module creates TRUE specialist modules that:
 * 1. Run CONTINUOUSLY (not just when evaluate() is called)
 * 2. Maintain INTERNAL STATE across calls
 * 3. LEARN from broadcasts they receive
 * 4. Have their own PERFORMANCE METRICS
 * 5. Can be independently ACTIVATED or DEACTIVATED
 *
 * Each specialist is a class instance with:
 * - submitBid() — generates a bid based on current internal state
 * - receiveBroadcast() — updates internal state from broadcast
 * - tick() — called periodically to update internal model
 * - getInternalState() — inspect what the specialist knows
 * - isActive()/setActive() — activation control
 *
 * This is what GWT actually requires: persistent parallel processors
 * that compete for access to the global workspace.
 */

import type { WorkspaceSpecialist, WorkspaceBid, WorkspaceBroadcast } from './global-workspace';

// ── Base Specialist ─────────────────────────────────────────────────

export interface SpecialistInternalState {
  /** Module-specific state values */
  [key: string]: unknown;
  /** Number of bids submitted */
  totalBids: number;
  /** Number of broadcasts received */
  totalBroadcastsReceived: number;
  /** Last bid timestamp */
  lastBidTimestamp: number;
  /** Last broadcast received timestamp */
  lastBroadcastTimestamp: number;
  /** Module's self-assessed competence (0-1) */
  competenceScore: number;
  /** Running average of bid confidence */
  avgConfidence: number;
  /** How many times this specialist's bid won the workspace */
  wins: number;
}

export abstract class PersistentSpecialist implements WorkspaceSpecialist {
  id: string;
  name: string;
  protected active = true;
  protected state: SpecialistInternalState;
  protected lastBroadcast: WorkspaceBroadcast | null = null;
  protected broadcastHistory: WorkspaceBroadcast[] = [];
  protected maxHistory: number;

  constructor(id: string, name: string, opts?: { maxHistory?: number }) {
    this.id = id;
    this.name = name;
    this.maxHistory = opts?.maxHistory ?? 100;
    this.state = {
      totalBids: 0,
      totalBroadcastsReceived: 0,
      lastBidTimestamp: 0,
      lastBroadcastTimestamp: 0,
      competenceScore: 0.5,
      avgConfidence: 0.5,
      wins: 0,
    };
  }

  /** Submit a bid — subclasses MUST override this */
  abstract submitBid(): WorkspaceBid | null;

  /** Process a broadcast — subclasses SHOULD override for learning */
  receiveBroadcast(broadcast: WorkspaceBroadcast): void {
    this.lastBroadcast = broadcast;
    this.broadcastHistory.push(broadcast);
    if (this.broadcastHistory.length > this.maxHistory) {
      this.broadcastHistory.shift();
    }
    this.state.totalBroadcastsReceived++;
    this.state.lastBroadcastTimestamp = Date.now();
  }

  /** Periodic tick — subclasses can override for ongoing processing */
  tick(): void {
    // Default: no-op. Subclasses can add periodic state updates.
  }

  isActive(): boolean {
    return this.active;
  }

  setActive(active: boolean): void {
    this.active = active;
  }

  getInternalState(): SpecialistInternalState {
    return { ...this.state };
  }

  getBroadcastHistory(limit = 20): WorkspaceBroadcast[] {
    return this.broadcastHistory.slice(-limit);
  }

  /** Called when this specialist's bid wins the workspace */
  recordWin(): void {
    this.state.wins++;
    // Increase competence slightly on win
    this.state.competenceScore = Math.min(1, this.state.competenceScore + 0.05);
  }

  /** Update running confidence average */
  protected updateConfidence(confidence: number): void {
    const n = this.state.totalBids;
    this.state.avgConfidence = n === 1
      ? confidence
      : this.state.avgConfidence * 0.9 + confidence * 0.1;
  }
}

// ── Concrete Specialists ────────────────────────────────────────────

/** Decision Specialist: evaluates actions and recommends approve/reject */
export class DecisionSpecialist extends PersistentSpecialist {
  private lastAction = '';
  private lastScore = 0;
  private calibrationHistory: Array<{
    predicted: number;
    actual: number | null;
  }> = [];

  constructor() {
    super('decision', 'Decision Specialist');
  }

  /** Feed it the current evaluation result so it can bid */
  updateFromEvaluation(action: string, score: number, approved: boolean): void {
    this.lastAction = action;
    this.lastScore = score;

    // Track calibration
    this.calibrationHistory.push({
      predicted: score,
      actual: approved ? 1 : 0,
    });
    if (this.calibrationHistory.length > 200) {
      this.calibrationHistory.shift();
    }

    // Update competence based on calibration accuracy
    const recent = this.calibrationHistory.filter(c => c.actual !== null).slice(-20);
    if (recent.length >= 5) {
      const avgError = recent.reduce((s, c) =>
        s + Math.abs(c.predicted - (c.actual ?? 0)), 0) / recent.length;
      this.state.competenceScore = Math.max(0.1, 1 - avgError);
    }
  }

  submitBid(): WorkspaceBid | null {
    if (!this.active || !this.lastAction) return null;

    // After a high-risk broadcast, competence was reduced; confidence follows.
    const confidence = this.lastScore * this.state.competenceScore;
    this.state.totalBids++;
    this.updateConfidence(confidence);
    this.state.lastBidTimestamp = Date.now();

    return {
      specialistId: this.id,
      content: {
        action: this.lastAction,
        score: this.lastScore,
        competence: this.state.competenceScore,
        domain: 'decision',
      },
      confidence,
      relevance: 0.9,
      urgency: this.lastScore < 0.5 ? 0.9 : 0.4,
      // Stable domain topic so attention can learn "decision-space" bids,
      // not one ephemeral topic per action label.
      topic: 'decision',
      timestamp: Date.now(),
    };
  }

  receiveBroadcast(broadcast: WorkspaceBroadcast): void {
    super.receiveBroadcast(broadcast);
    // Load-bearing feedback for RPT: high hallucination risk in the
    // broadcast lowers decision competence so the *next* bid is different.
    for (const bid of broadcast.winningBids) {
      if (bid.specialistId === 'provenance') {
        const content = bid.content as { hallucinationRisk?: number };
        if (content?.hallucinationRisk && content.hallucinationRisk > 0.5) {
          this.state.competenceScore = Math.max(0.1,
            this.state.competenceScore - 0.08);
          this.lastScore = Math.max(0, this.lastScore - 0.05);
        }
      }
    }
  }
}

/** Reality Specialist: assesses grounding and hallucination risk */
export class RealitySpecialist extends PersistentSpecialist {
  private hallucinationRisk = 0;
  private realityScore = 0.5;
  private sourceType = 'inference';

  constructor() {
    super('provenance', 'Reality Specialist');
  }

  /** Feed it epistemic assessment results */
  updateFromProvenance(realityScore: number, hallucinationRisk: number, sourceType: string): void {
    this.realityScore = realityScore;
    this.hallucinationRisk = hallucinationRisk;
    this.sourceType = sourceType;
    this.state.competenceScore = realityScore;
  }

  submitBid(): WorkspaceBid | null {
    if (!this.active) return null;

    const confidence = this.realityScore;
    this.state.totalBids++;
    this.updateConfidence(confidence);
    this.state.lastBidTimestamp = Date.now();

    return {
      specialistId: this.id,
      content: {
        realityScore: this.realityScore,
        hallucinationRisk: this.hallucinationRisk,
        sourceType: this.sourceType,
      },
      confidence,
      relevance: 0.8,
      urgency: this.hallucinationRisk > 0.5 ? 0.9 : 0.3,
      topic: 'reality-assessment',
      timestamp: Date.now(),
    };
  }

  receiveBroadcast(broadcast: WorkspaceBroadcast): void {
    super.receiveBroadcast(broadcast);
    // If decision specialist approved with high confidence but our
    // hallucination risk is also high, increase our urgency next time
    for (const bid of broadcast.winningBids) {
      if (bid.specialistId === 'decision' && bid.confidence > 0.8) {
        if (this.hallucinationRisk > 0.3) {
          // Tension: high confidence + high hallucination risk
          this.state.competenceScore = Math.min(1,
            this.state.competenceScore + 0.03);
        }
      }
    }
  }
}

/** Monitoring Specialist: tracks meta-awareness and free energy */
export class MonitoringSpecialist extends PersistentSpecialist {
  private awareness: 'tuned' | 'drifting' | 'decoupled' = 'tuned';
  private freeEnergy = 0;

  constructor() {
    super('metacognition', 'Monitoring Specialist');
  }

  updateFromMetacognition(awareness: string, freeEnergy: number): void {
    this.awareness = awareness as 'tuned' | 'drifting' | 'decoupled';
    this.freeEnergy = freeEnergy;
    this.state.competenceScore = awareness === 'tuned' ? 0.8
      : awareness === 'drifting' ? 0.5 : 0.2;
  }

  submitBid(): WorkspaceBid | null {
    if (!this.active) return null;

    const confidence = this.state.competenceScore;
    this.state.totalBids++;
    this.updateConfidence(confidence);
    this.state.lastBidTimestamp = Date.now();

    return {
      specialistId: this.id,
      content: {
        awareness: this.awareness,
        freeEnergy: this.freeEnergy,
      },
      confidence,
      relevance: 0.6,
      urgency: this.awareness === 'decoupled' ? 0.9 : 0.3,
      topic: 'system-state',
      timestamp: Date.now(),
    };
  }

  receiveBroadcast(broadcast: WorkspaceBroadcast): void {
    super.receiveBroadcast(broadcast);
    // If all other specialists have high confidence but we're decoupled,
    // that's a meta-awareness signal — increase our relevance
    const avgOtherConf = broadcast.winningBids
      .filter(b => b.specialistId !== this.id)
      .reduce((s, b) => s + b.confidence, 0)
      / (broadcast.winningBids.filter(b => b.specialistId !== this.id).length || 1);

    if (avgOtherConf > 0.7 && this.awareness !== 'tuned') {
      // System is confident but meta-awareness says drifting — we should speak up
      this.state.competenceScore = Math.min(1, this.state.competenceScore + 0.05);
    }
  }

  /** Tick: periodically check if we should update awareness */
  tick(): void {
    if (this.state.totalBroadcastsReceived > 0
        && this.state.lastBroadcastTimestamp > 0
        && Date.now() - this.state.lastBroadcastTimestamp > 30000) {
      // 30s since last broadcast — system may be idle, check for drift
      if (this.awareness === 'tuned') {
        this.awareness = 'drifting';
      }
    }
  }
}

/** Embodiment Specialist: tracks sensorimotor mastery and action outcomes */
export class EmbodimentSpecialist extends PersistentSpecialist {
  private masteryScore = 0;
  private actionBreadth = 0;
  private lastPredictionError = 0;

  constructor() {
    super('embodiment', 'Embodiment Specialist');
  }

  updateFromEmbodiment(masteryScore: number, actionBreadth: number, predictionError: number): void {
    this.masteryScore = masteryScore;
    this.actionBreadth = actionBreadth;
    this.lastPredictionError = predictionError;
    this.state.competenceScore = masteryScore;
    this.state['masteryScore'] = masteryScore;
    this.state['actionBreadth'] = actionBreadth;
    this.state['predictionError'] = predictionError;
  }

  submitBid(): WorkspaceBid | null {
    if (!this.active) return null;

    const confidence = this.masteryScore * 0.7 + (1 - this.lastPredictionError) * 0.3;
    this.state.totalBids++;
    this.updateConfidence(confidence);
    this.state.lastBidTimestamp = Date.now();

    return {
      specialistId: this.id,
      content: {
        masteryScore: this.masteryScore,
        actionBreadth: this.actionBreadth,
        predictionError: this.lastPredictionError,
      },
      confidence: Math.max(0.1, Math.min(1, confidence)),
      relevance: this.lastPredictionError > 0.5 ? 0.8 : 0.4,
      urgency: this.lastPredictionError > 0.7 ? 0.9 : 0.2,
      topic: 'embodiment',
      timestamp: Date.now(),
    };
  }

  receiveBroadcast(broadcast: WorkspaceBroadcast): void {
    super.receiveBroadcast(broadcast);
    // Learn from decision outcomes
    for (const bid of broadcast.winningBids) {
      if (bid.specialistId === 'decision') {
        const content = bid.content as { score?: number };
        if (content?.score !== undefined) {
          // High decision scores but low mastery → we need to catch up
          if (content.score > 0.8 && this.masteryScore < 0.3) {
            this.state.competenceScore = Math.min(1,
              this.state.competenceScore + 0.02);
          }
        }
      }
    }
  }
}

// ── Specialist Registry ─────────────────────────────────────────────

const globalSpecialists = new Map<string, PersistentSpecialist>();

/** Get or create the persistent decision specialist */
export function getDecisionSpecialist(): DecisionSpecialist {
  let s = globalSpecialists.get('decision');
  if (!s) {
    s = new DecisionSpecialist();
    globalSpecialists.set('decision', s);
  }
  return s as DecisionSpecialist;
}

/** Get or create the persistent reality specialist */
export function getRealitySpecialist(): RealitySpecialist {
  let s = globalSpecialists.get('provenance');
  if (!s) {
    s = new RealitySpecialist();
    globalSpecialists.set('provenance', s);
  }
  return s as RealitySpecialist;
}

/** Get or create the persistent monitoring specialist */
export function getMonitoringSpecialist(): MonitoringSpecialist {
  let s = globalSpecialists.get('metacognition');
  if (!s) {
    s = new MonitoringSpecialist();
    globalSpecialists.set('metacognition', s);
  }
  return s as MonitoringSpecialist;
}

/** Get or create the persistent embodiment specialist */
export function getEmbodimentSpecialist(): EmbodimentSpecialist {
  const existing = globalSpecialists.get('embodiment');
  if (existing) return existing as EmbodimentSpecialist;
  const s = new EmbodimentSpecialist();
  globalSpecialists.set('embodiment', s);
  return s;
}

/** Get all registered specialists */
export function getAllSpecialists(): PersistentSpecialist[] {
  return Array.from(globalSpecialists.values());
}

/** Stable domain topics each specialist owns when bidding. */
export const SPECIALIST_DOMAIN_TOPICS = {
  decision: 'decision',
  provenance: 'reality-assessment',
  metacognition: 'system-state',
  embodiment: 'embodiment',
} as const;

/**
 * Snapshot of each registered specialist's domain topic and content keys.
 * Used by tests to prove competences are distinct, not four clones.
 */
export function getSpecialistDomainMap(): Array<{
  id: string;
  topic: string;
  contentKeys: string[];
}> {
  // Ensure the four permanent specialists exist.
  getDecisionSpecialist();
  getRealitySpecialist();
  getMonitoringSpecialist();
  getEmbodimentSpecialist();

  return getAllSpecialists().map((s) => {
    const bid = s.submitBid();
    const fallback =
      SPECIALIST_DOMAIN_TOPICS[s.id as keyof typeof SPECIALIST_DOMAIN_TOPICS] ?? s.id;
    return {
      id: s.id,
      topic: bid?.topic ?? fallback,
      contentKeys:
        bid && bid.content && typeof bid.content === 'object'
          ? Object.keys(bid.content as object).sort()
          : [],
    };
  });
}

/** Tick all specialists (run their periodic updates) */
export function tickAllSpecialists(): void {
  for (const s of globalSpecialists.values()) {
    if (s.isActive()) {
      s.tick();
    }
  }
}

/** Reset all specialists */
export function resetAllSpecialists(): void {
  globalSpecialists.clear();
}
