/**
 * Attention Schema — The System Models Its Own Attentional State
 *
 * Graziano's Attention Schema Theory (AST): consciousness arises because
 * the brain constructs a simplified INTERNAL MODEL of its own attention.
 * This model is NOT attention itself — it's a representation OF attention.
 *
 * Key distinction:
 * - ATTENTION = the actual selection process (which bids win the workspace)
 * - ATTENTION SCHEMA = the system's MODEL of how its attention works
 *
 * If the system has attention but no schema, it selects but doesn't
 * UNDERSTAND its selection. With a schema, it can:
 * 1. PREDICT what it will attend to next
 * 2. EXPLAIN why it attended to something
 * 3. DELIBERATELY redirect attention when the schema predicts failure
 * 4. DETECT when its attention model is wrong (schema error)
 *
 * This module:
 * - Maintains a model: "what topics will I likely attend to?"
 * - Updates the model from actual workspace outcomes
 * - Checks: did the prediction match reality? (schema accuracy)
 * - Can REDIRECT attention by adjusting bid relevance weights
 * - Tracks schema error over time (how well does the model predict?)
 */

import type { WorkspaceBid, WorkspaceBroadcast } from './global-workspace';

// ── Types ──────────────────────────────────────────────────────────

export interface AttentionPrediction {
  /** Predicted winning topics (ranked) */
  predictedTopics: string[];
  /** Predicted confidence of the winning bid */
  predictedWinningConfidence: number;
  /** Predicted number of specialists that will be activated */
  predictedIgnitionSpread: number;
  /** Timestamp of this prediction */
  timestamp: number;
}

export interface AttentionOutcome {
  /** Actual winning topics */
  actualTopics: string[];
  /** Actual winning confidence */
  actualWinningConfidence: number;
  /** Actual ignition spread */
  actualIgnitionSpread: number;
  /** Timestamp of this outcome */
  timestamp: number;
}

export interface AttentionSchemaState {
  /** Current topic attention weights (topic → weight 0-1) */
  topicWeights: Record<string, number>;
  /** Running schema prediction accuracy (0-1) */
  schemaAccuracy: number;
  /** Number of predictions made */
  totalPredictions: number;
  /** Number of correct predictions */
  correctPredictions: number;
  /** Current attentional focus */
  currentFocus: string | null;
  /** Attentional breadth (how many topics are active) */
  breadth: number;
  /** Schema error (0 = perfect model, 1 = terrible model) */
  schemaError: number;
  /** Whether the system can redirect its own attention */
  canRedirectAttention: boolean;
}

// ── Attention Schema ───────────────────────────────────────────────

export class AttentionSchema {
  /** Learned topic weights from observation */
  private topicWeights: Record<string, number> = {};
  /** Prediction→outcome history */
  private predictions: Array<{
    prediction: AttentionPrediction;
    outcome: AttentionOutcome | null;
  }> = [];
  /** Deliberate redirect multipliers active until released or overwritten. */
  private activeRedirect: Record<string, number> | null = null;
  /** How many times redirect actually changed who the next winner was. */
  private redirectCorrections = 0;
  /** Predictions whose #1 topic matched the outcome #1. */
  private correctTopPredictions = 0;
  /** Total closed prediction pairs. */
  private closedPredictions = 0;
  /** Current focus */
  private currentFocus: string | null = null;
  /** Attentional breadth */
  private breadth = 1;
  /** How many broadcasts we've observed */
  private observed = 0;
  private maxPredictions: number;

  constructor(opts?: { maxPredictions?: number }) {
    this.maxPredictions = opts?.maxPredictions ?? 200;
  }

  /** Predict what the workspace will attend to next.
   *  This IS the attention schema in action — the system is
   *  using its model to predict its own attentional state. */
  predict(): AttentionPrediction {
    // Rank topics by learned weights
    const ranked = Object.entries(this.topicWeights)
      .sort((a, b) => b[1] - a[1]);

    const predictedTopics = ranked.slice(0, 3).map(([topic]) => topic);
    const predictedWinningConfidence = ranked.length > 0
      ? ranked[0][1]
      : 0.5;
    const predictedIgnitionSpread = this.breadth;

    const prediction: AttentionPrediction = {
      predictedTopics,
      predictedWinningConfidence,
      predictedIgnitionSpread,
      timestamp: Date.now(),
    };

    this.predictions.push({ prediction, outcome: null });
    if (this.predictions.length > this.maxPredictions) {
      this.predictions.shift();
    }

    return prediction;
  }

  /**
   * Multipliers the workspace applies during the next competition.
   *
   * Soft: learned topic weights map onto [0.5, 1.5].
   * Hard: an active redirect (from schema error correction) multiplies on top.
   * This is the control pathway — without it, the schema is only a diary.
   */
  getCompetitionMultipliers(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [topic, w] of Object.entries(this.topicWeights)) {
      out[topic] = 0.5 + Math.max(0, Math.min(1, w));
    }
    if (this.activeRedirect) {
      for (const [topic, m] of Object.entries(this.activeRedirect)) {
        out[topic] = (out[topic] ?? 1) * m;
      }
    }
    // Seed known specialist domains so first redirects still have effect
    // before any broadcast has trained weights.
    for (const domain of SPECIALIST_DOMAINS) {
      if (out[domain] === undefined) out[domain] = 1;
    }
    return out;
  }

  /** Record the actual outcome of a workspace competition.
   *  This updates the attention schema — the system learns
   *  whether its model of attention is accurate. */
  recordOutcome(broadcast: WorkspaceBroadcast): void {
    this.observed++;

    const outcome: AttentionOutcome = {
      actualTopics: [...new Set(broadcast.winningBids.map(b => b.topic))],
      actualWinningConfidence: broadcast.winningBids.length > 0
        ? broadcast.winningBids.reduce((s, b) => s + b.confidence, 0) / broadcast.winningBids.length
        : 0,
      actualIgnitionSpread: broadcast.ignitionSpread,
      timestamp: Date.now(),
    };

    // Update the most recent prediction with this outcome
    const lastPrediction = [...this.predictions].reverse().find(
      (p) => p.outcome === null,
    );
    if (lastPrediction) {
      lastPrediction.outcome = outcome;
      this.closedPredictions++;
      const predictedTop = lastPrediction.prediction.predictedTopics[0];
      const actualTop = outcome.actualTopics[0];
      if (predictedTop && actualTop && predictedTop === actualTop) {
        this.correctTopPredictions++;
      } else if (actualTop && this.observed >= 2) {
        // Schema error drives correction: boost the topic that actually won
        // so the next competition is steered by the error signal.
        this.redirectAttention(actualTop);
        this.redirectCorrections++;
      }
    }

    // Update topic weights from actual outcomes (learning)
    for (const topic of outcome.actualTopics) {
      this.topicWeights[topic] = Math.min(1,
        (this.topicWeights[topic] ?? 0.3) + 0.1);
    }

    // Decay non-winning topics
    for (const [topic, weight] of Object.entries(this.topicWeights)) {
      if (!outcome.actualTopics.includes(topic)) {
        this.topicWeights[topic] = Math.max(0, weight - 0.02);
      }
    }

    // Update current focus and breadth
    this.currentFocus = outcome.actualTopics[0] ?? null;
    this.breadth = outcome.actualTopics.length;
  }

  /** Get the current state of the attention schema */
  getState(): AttentionSchemaState {
    const { correct, total } = this.computeAccuracy();
    const schemaAccuracy = total > 0 ? correct / total : 0;

    return {
      topicWeights: { ...this.topicWeights },
      schemaAccuracy,
      totalPredictions: total,
      correctPredictions: correct,
      currentFocus: this.currentFocus,
      breadth: this.breadth,
      schemaError: 1 - schemaAccuracy,
      canRedirectAttention: Object.keys(this.topicWeights).length >= 2
        && this.observed >= 2,
    };
  }

  getRedirectCorrectionCount(): number {
    return this.redirectCorrections;
  }

  getPredictionHitRate(): number {
    return this.closedPredictions > 0
      ? this.correctTopPredictions / this.closedPredictions
      : 0;
  }

  /** REDIRECT ATTENTION — deliberately shift focus to a new topic.
   *  This is the key AST capability: the attention schema enables
   *  deliberate control of the actual attention process.
   *  Returns adjusted bid relevance multipliers. */
  redirectAttention(targetTopic: string): Record<string, number> {
    const multipliers: Record<string, number> = {};

    const topics = new Set([
      ...Object.keys(this.topicWeights),
      ...SPECIALIST_DOMAINS,
      targetTopic,
    ]);

    for (const topic of topics) {
      if (topic === targetTopic) {
        multipliers[topic] = 2.0;
      } else {
        multipliers[topic] = 0.45;
      }
    }

    if (!(targetTopic in this.topicWeights)) {
      this.topicWeights[targetTopic] = 0.8;
    }

    this.activeRedirect = multipliers;
    this.currentFocus = targetTopic;

    return multipliers;
  }

  clearRedirect(): void {
    this.activeRedirect = null;
  }

  /** Compute schema prediction accuracy */
  private computeAccuracy(): { correct: number; total: number } {
    const withOutcome = this.predictions.filter(p => p.outcome !== null);
    if (withOutcome.length === 0) return { correct: 0, total: 0 };

    let correct = 0;
    for (const p of withOutcome) {
      const predictedTop = p.prediction.predictedTopics[0];
      const actualTop = p.outcome!.actualTopics[0];
      if (predictedTop && actualTop && predictedTop === actualTop) {
        correct++;
      }
    }

    return { correct, total: withOutcome.length };
  }

  /** Get topic weights for inspection */
  getTopicWeights(): Record<string, number> {
    return { ...this.topicWeights };
  }

  /** Reset the schema */
  reset(): void {
    this.topicWeights = {};
    this.predictions = [];
    this.activeRedirect = null;
    this.redirectCorrections = 0;
    this.correctTopPredictions = 0;
    this.closedPredictions = 0;
    this.currentFocus = null;
    this.breadth = 1;
    this.observed = 0;
  }
}

/** Domain topics of the four permanent specialists. */
const SPECIALIST_DOMAINS = [
  'decision',
  'reality-assessment',
  'system-state',
  'embodiment',
] as const;

// ── Singleton ──────────────────────────────────────────────────────

let globalAttentionSchema: AttentionSchema | null = null;

export function getAttentionSchema(): AttentionSchema {
  if (!globalAttentionSchema) {
    globalAttentionSchema = new AttentionSchema();
  }
  return globalAttentionSchema;
}

export function resetAttentionSchema(): void {
  globalAttentionSchema = null;
}
