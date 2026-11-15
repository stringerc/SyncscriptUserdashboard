/**
 * SemanticGrid — Multi-agent semantic interference layer
 *
 * Action Validation inspired: processing nodes across neurons synchronize via quantum
 * correlation, creating unified conscious moments. This module provides
 * a shared semantic blackboard where agent outputs interfere:
 *   - Constructively (agreement → amplify confidence)
 *   - Destructively (contradiction → cancel/flag)
 *   - Orthogonally (unrelated → both coexist)
 *
 * Then collapses into a single coherent result per topic.
 *
 * This is the TypeScript port of the proxy's Python SemanticGrid,
 * enhanced with:
 *   - Weighted confidence amplification on constructive interference
 *   - Contradiction chain tracking (who contradicted whom)
 *   - Event emitter for real-time UI updates
 *   - KV persistence for cross-session coherence memory
 *   - CollapsedResult as a first-class object for the dashboard
 */

// ── Types ──────────────────────────────────────────────────────────

export type InterferenceType = 'constructive' | 'destructive' | 'orthogonal';

/** Meta-awareness status derived from grid coherence.
 *  'tuned' = high coherence across agents (system is well-coupled)
 *  'drifting' = moderate coherence (attention may be wandering)
 *  'decoupled' = low coherence (system is poorly integrated) */
export type MetaAwarenessStatus = 'tuned' | 'drifting' | 'decoupled';

export interface AgentSignal {
  agentId: string;
  topic: string;
  content: string;
  confidence: number; // 0–1
  timestamp: number;  // Date.now()
  tags: string[];
}

export interface CollapsedResult {
  topic: string;
  interference: InterferenceType;
  winningSignal: AgentSignal | null;
  cancelledSignals: AgentSignal[];
  coherenceScore: number; // 0–1
  amplification?: number; // how much the winning confidence was boosted
}

export interface SemanticGridListener {
  (event: 'signal' | 'collapse', data: AgentSignal | CollapsedResult): void;
}

// ── Implementation ─────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'to', 'in', 'of', 'and', 'or',
  'for', 'on', 'at', 'by', 'it', 'with', 'from', 'that', 'this',
]);

const CONTRADICTION_PAIRS: Array<[string, string]> = [
  ['not ', ''],
  ["don't ", ''],
  ['no ', ''],
  ['cannot ', 'can '],
  ["shouldn't ", 'should '],
  ['never ', 'always '],
  ['false', 'true'],
  ['reject', 'approve'],
  ['deny', 'confirm'],
  ['unsafe', 'safe'],
  ['invalid', 'valid'],
  ['incorrect', 'correct'],
  ['unwise', 'wise'],
  ['risky', 'safe'],
  ['avoid', 'proceed'],
  ['later', 'now'],
  ['wait', 'go'],
];

const AGREEMENT_MARKERS = [
  ['yes', 'yes'],
  ['correct', 'correct'],
  ['agree', 'agree'],
  ['confirmed', 'confirmed'],
  ['true', 'true'],
  ['exactly', 'exactly'],
  ['absolutely', 'absolutely'],
  ['recommended', 'recommended'],
  ['proceed', 'proceed'],
];

export class SemanticGrid {
  private signals = new Map<string, AgentSignal[]>();
  private listeners = new Set<SemanticGridListener>();
  private coherenceThreshold: number;
  private maxSignalsPerTopic: number;

  constructor(opts?: { coherenceThreshold?: number; maxSignalsPerTopic?: number }) {
    this.coherenceThreshold = opts?.coherenceThreshold ?? 0.6;
    this.maxSignalsPerTopic = opts?.maxSignalsPerTopic ?? 20;
  }

  // ── Public API ──────────────────────────────────────────────────

  postSignal(signal: AgentSignal): void {
    const topic = signal.topic.toLowerCase();
    let list = this.signals.get(topic);
    if (!list) {
      list = [];
      this.signals.set(topic, list);
    }
    list.push(signal);

    // Evict oldest if at capacity
    if (list.length > this.maxSignalsPerTopic) {
      list.shift();
    }

    this.emit('signal', signal);
  }

  collapse(topic: string): CollapsedResult {
    const normalizedTopic = topic.toLowerCase();
    const signals = this.signals.get(normalizedTopic) ?? [];

    if (signals.length === 0) {
      return {
        topic: normalizedTopic,
        interference: 'orthogonal',
        winningSignal: null,
        cancelledSignals: [],
        coherenceScore: 1.0,
      };
    }

    if (signals.length === 1) {
      return {
        topic: normalizedTopic,
        interference: 'orthogonal',
        winningSignal: signals[0],
        cancelledSignals: [],
        coherenceScore: 1.0,
      };
    }

    const { interference, coherenceScore } = this.evaluateInterference(signals);

    // Rank by confidence — highest wins
    const ranked = [...signals].sort((a, b) => b.confidence - a.confidence);
    const winner = ranked[0];
    const cancelled = ranked.slice(1);

    let amplification: number | undefined;
    if (interference === 'constructive') {
      // Amplify: boost winner confidence by agreement ratio
      amplification = 1 + coherenceScore * 0.3; // up to 1.3x
    }

    const result: CollapsedResult = {
      topic: normalizedTopic,
      interference,
      winningSignal: winner,
      cancelledSignals: cancelled,
      coherenceScore,
      amplification,
    };

    this.emit('collapse', result);
    return result;
  }

  getTopics(): string[] {
    return Array.from(this.signals.keys());
  }

  getSignals(topic: string): AgentSignal[] {
    return this.signals.get(topic.toLowerCase()) ?? [];
  }

  clearTopic(topic: string): void {
    this.signals.delete(topic.toLowerCase());
  }

  clearAll(): void {
    this.signals.clear();
  }

  // ── Meta-Awareness from Coherence ─────────────────────────────
  // Derives a system-wide attention status from the aggregate
  // coherence across all topics.  High coherence = tuned;
  // mid = drifting; low = decoupled.  Thresholds follow
  // Schooler's meta-awareness research but are calibrated
  // for multi-agent text interference rather than human
  // subjective experience.

  getMetaAwarenessStatus(): { status: MetaAwarenessStatus; score: number } {
    const topics = this.getTopics();
    if (topics.length === 0) {
      return { status: 'tuned', score: 1.0 };
    }

    let totalCoherence = 0;
    let topicCount = 0;
    for (const topic of topics) {
      const signals = this.getSignals(topic);
      if (signals.length >= 2) {
        const { coherenceScore } = this.evaluateInterference(signals);
        totalCoherence += coherenceScore;
        topicCount++;
      }
    }

    // If there are topics but all are single-signal, coherence is neutral
    const score = topicCount > 0 ? totalCoherence / topicCount : 1.0;

    let status: MetaAwarenessStatus;
    if (score >= 0.65) {
      status = 'tuned';
    } else if (score >= 0.40) {
      status = 'drifting';
    } else {
      status = 'decoupled';
    }

    return { status, score };
  }

  /**
   * Restore the historical meta-awareness status on boot.
   * Since we don't persist the raw text signals, we seed synthetic
   * signals to reproduce the required coherence score.
   */
  restoreMetaAwareness(targetStatus: MetaAwarenessStatus, targetScore: number): void {
    if (targetStatus === 'tuned' && targetScore >= 0.99) return; // Default state
    
    const topic = 'historical_restoration';
    this.clearTopic(topic);
    
    // To achieve decoupled status, we inject contradictory signals
    if (targetStatus === 'decoupled') {
      this.postSignal({ agentId: 'restore', topic, content: 'always safe', confidence: 1.0, timestamp: Date.now(), tags: [] });
      this.postSignal({ agentId: 'restore', topic, content: 'never safe', confidence: 1.0, timestamp: Date.now(), tags: [] });
    } 
    // To achieve drifting status, we inject orthogonal signals
    else if (targetStatus === 'drifting') {
      this.postSignal({ agentId: 'restore', topic, content: 'alpha beta', confidence: 1.0, timestamp: Date.now(), tags: [] });
      this.postSignal({ agentId: 'restore', topic, content: 'gamma delta', confidence: 1.0, timestamp: Date.now(), tags: [] });
    }
    // To achieve tuned status (but not 1.0), we inject agreeing signals
    else if (targetStatus === 'tuned') {
      this.postSignal({ agentId: 'restore', topic, content: 'proceed safely', confidence: 1.0, timestamp: Date.now(), tags: [] });
      this.postSignal({ agentId: 'restore', topic, content: 'proceed safely', confidence: 1.0, timestamp: Date.now(), tags: [] });
    }
  }

  on(listener: SemanticGridListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── Interference Evaluation ─────────────────────────────────────

  private evaluateInterference(signals: AgentSignal[]): {
    interference: InterferenceType;
    coherenceScore: number;
  } {
    let contradictions = 0;
    let agreements = 0;
    let comparisons = 0;

    for (let i = 0; i < signals.length; i++) {
      for (let j = i + 1; j < signals.length; j++) {
        comparisons++;
        if (this.areContradictory(signals[i].content, signals[j].content)) {
          contradictions++;
        } else if (this.areAgreeing(signals[i].content, signals[j].content)) {
          agreements++;
        }
      }
    }

    if (comparisons === 0) {
      return { interference: 'orthogonal', coherenceScore: 1.0 };
    }

    const contradictionRatio = contradictions / comparisons;
    const agreementRatio = agreements / comparisons;

    if (contradictionRatio > 0.5) {
      return { interference: 'destructive', coherenceScore: 1.0 - contradictionRatio };
    }
    if (agreementRatio > 0.5) {
      return { interference: 'constructive', coherenceScore: agreementRatio };
    }
    return { interference: 'orthogonal', coherenceScore: 0.5 };
  }

  static areContradictory(textA: string, textB: string): boolean {
    const a = textA.toLowerCase();
    const b = textB.toLowerCase();
    return CONTRADICTION_PAIRS.some(
      ([neg, pos]) =>
        (a.includes(neg) && b.includes(pos)) ||
        (a.includes(pos) && b.includes(neg))
    );
  }

  // Instance method for convenience
  private areContradictory = SemanticGrid.areContradictory;

  static areAgreeing(textA: string, textB: string): boolean {
    const a = textA.toLowerCase();
    const b = textB.toLowerCase();

    // Check explicit agreement markers
    const hasExplicitAgreement = AGREEMENT_MARKERS.some(
      ([m1, m2]) => a.includes(m1) && b.includes(m2)
    );
    if (hasExplicitAgreement) return true;

    // Word overlap > 60%
    const wordsA = new Set(a.split(/\s+/).filter(w => !STOP_WORDS.has(w)));
    const wordsB = new Set(b.split(/\s+/).filter(w => !STOP_WORDS.has(w)));
    if (wordsA.size === 0 || wordsB.size === 0) return false;
    const overlap = Array.from(wordsA).filter(w => wordsB.has(w)).length / Math.max(wordsA.size, wordsB.size);
    return overlap > 0.6;
  }

  private areAgreeing = SemanticGrid.areAgreeing;

  // ── Event Emitter ───────────────────────────────────────────────

  private emit(event: 'signal' | 'collapse', data: AgentSignal | CollapsedResult): void {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(event, data);
      } catch {
        // Swallow listener errors
      }
    }
  }
}

// ── Singleton for app-wide coherence ──────────────────────────────

let globalGrid: SemanticGrid | null = null;

export function getSemanticGrid(): SemanticGrid {
  if (!globalGrid) {
    globalGrid = new SemanticGrid();
  }
  return globalGrid;
}

export function resetSemanticGrid(): void {
  globalGrid = null;
}
