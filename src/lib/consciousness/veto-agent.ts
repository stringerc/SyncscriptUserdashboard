/**
 * AttentionVetoAgent — dedicated micro-agent owning attention-config vetoes.
 *
 * What this is: the "veto agent" from the Consciousness Breath plan, made
 * real. It is a WorkspaceSpecialist (its own Global Workspace slot) that
 * evaluates every counterfactual attention configuration the Generative
 * Attention Loop proposes. Unlike the shared VolitionEngine path — which
 * scores attention configs at ~0.11 against a 0.65 threshold and therefore
 * can never fire — this agent computes its own veto impulse from signals
 * that actually vary for attention objects:
 *
 *   impulse = 0.55·(1 − predictedScore)      // models predict a flop → veto
 *           + 0.20·disruption(kind)          // kind-level attention risk
 *           + 0.15·(1 − valueAlignment)      // identity-commitment check
 *           + 0.10·(1 − metacognitiveConfidence)
 *
 * What this is NOT:
 * - Not a separate mind. It is one specialist with inspectable stats,
 *   adaptive threshold, and persisted state — a mechanism, not a persona.
 * - Its vetoes are not evidence of volition. The Libet 5–15% band is a
 *   *target the threshold regulates toward*, the same convention
 *   VolitionEngine documents; hitting the band proves the regulator works,
 *   not that anything was freely chosen.
 * - Meta-veto ("veto-a-veto") is depth-1 only: a veto may be overridden
 *   once, and the override cannot itself be vetoed. Deeper recursion is
 *   explicitly out of scope — unbounded self-negation is not a feature.
 *
 * Homeostasis: every ~20 evaluations the veto threshold drifts to keep the
 * observed veto rate inside the Libet band — down when vetoing too rarely,
 * up when vetoing too often. That is real adaptive regulation over its
 * own selectivity, and it is reported honestly in getStats().
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { VolitionEngine, type Intention } from './volition';
import type { ConsciousnessState } from './shared-state';
import type {
  WorkspaceBid,
  WorkspaceBroadcast,
  WorkspaceSpecialist,
} from '../global-workspace';
import type { GalVetoRequest, GalVetoVerdict } from './generative-attention';

// ── Tunables (declared, inspectable) ────────────────────────────────

/** Attention-kind disruption priors: how much each config class tends to
 *  disturb the schema's own steering. status_quo is never evaluated. */
const KIND_DISRUPTION: Record<string, number> = {
  status_quo: 0,
  topic_boost: 0.3,
  explore: 0.6,
  reset: 0.8,
};

/** Libet band — the veto rate the threshold regulates toward. */
const VETO_RATE_MIN = 0.05;
const VETO_RATE_MAX = 0.15;
const VETO_WINDOW = 50;          // evaluations in the rate estimate
const THRESHOLD_ADJUST_EVERY = 20;
const THRESHOLD_MIN = 0.3;
const THRESHOLD_MAX = 0.9;
const META_VETO_MARGIN = 0.12;   // veto must be this close to threshold to be marginal
const META_VETO_MIN_PREDICTION = 0.65;

interface VetoAgentPersist {
  threshold: number;
  evaluations: number;
  vetoes: number;
  metaVetoes: number;
  recent: Array<{ vetoed: boolean; metaVetoed: boolean }>;
}

/** Adaptive band edges — the Libet 5–15% target widens when the system is
 *  stable (let restraint roam) and narrows when volatile (conserve it). */
function bandFor(volatility: number | null): { min: number; max: number } {
  if (volatility == null) return { min: VETO_RATE_MIN, max: VETO_RATE_MAX };
  if (volatility < 0.08) return { min: 0.03, max: 0.22 };
  if (volatility > 0.22) return { min: 0.07, max: 0.12 };
  return { min: VETO_RATE_MIN, max: VETO_RATE_MAX };
}

// ── The agent ───────────────────────────────────────────────────────

export class AttentionVetoAgent implements WorkspaceSpecialist, GalVetoEvaluator {
  readonly id = 'attention-veto-agent';
  readonly name = 'VetoAgent';

  private volition = new VolitionEngine();
  private threshold = 0.62;
  private evaluations = 0;
  private vetoes = 0;
  private metaVetoes = 0;
  private recent: Array<{ vetoed: boolean; metaVetoed: boolean }> = [];
  private broadcasts: WorkspaceBroadcast[] = [];
  private persistPath: string | null;
  private volatilitySignal: (() => number | null) | null = null;
  private affectSignal: (() => { valence: number } | null) | null = null;

  /** Host-injected regime signal: recent outcome volatility [0,1]. When
   *  absent the agent regulates to the fixed Libet band. */
  setVolatilitySignal(fn: () => number | null): void {
    this.volatilitySignal = fn;
  }

  /** Host-injected affective state — grounds vetoes in how the system
   *  is actually feeling (homeostatic valence), not just predictions.
   *  explore fits appetitive states, reset fits aversive/cautious ones. */
  setAffectSignal(fn: () => { valence: number } | null): void {
    this.affectSignal = fn;
  }

  /** Affective congruence of an attention kind with current valence.
   *  Returns null when no affect signal — the term is skipped entirely. */
  private affectiveFit(kind: string): number | null {
    const v = this.affectSignal?.()?.valence;
    if (v == null) return null;
    const valence = Math.max(-1, Math.min(1, v));
    switch (kind) {
      case 'explore': return (valence + 1) / 2;          // novelty fits flourishing
      case 'reset': return (1 - valence) / 2;            // uniformity fits caution
      case 'topic_boost': return 0.5 + valence * 0.25;   // mild positive lean
      default: return 0.5;
    }
  }

  private band() { return bandFor(this.volatilitySignal?.() ?? null); }

  constructor(persistPath?: string | null, opts?: {
    initialThreshold?: number;
    volatilitySignal?: () => number | null;
    affectSignal?: () => { valence: number } | null;
  }) {
    this.persistPath = persistPath === undefined
      ? path.join(process.cwd(), '.cortex-runtime', 'veto-agent.json')
      : persistPath;
    this.threshold = opts?.initialThreshold ?? 0.62;
    this.volatilitySignal = opts?.volatilitySignal ?? null;
    this.affectSignal = opts?.affectSignal ?? null;
    this.load(); // persisted state (if any) wins over the constructor default
  }

  // ── GAL interface ────────────────────────────────────────────────

  /**
   * Evaluate one attention-config intention. Returns the verdict GAL
   * applies to the candidate. Meta-veto is depth-1: when a marginal veto
   * targets a clearly valuable config, the veto itself is vetoed once.
   */
  evaluate(req: GalVetoRequest): GalVetoVerdict {
    const verdict = this.score(req, true);
    this.recordEvaluation(verdict.shouldVeto || verdict.metaVetoed === true, verdict.metaVetoed === true);
    return verdict;
  }

  /** Side-effect-free verdict for counterfactual simulation: identical
   *  scoring, but no counters, no persistence, no band adjustment.
   *  Used by the GAL's lookahead planner to ask "would this imagined
   *  future config survive the veto?" without polluting the ledger. */
  preview(req: GalVetoRequest): GalVetoVerdict {
    return this.score(req, false);
  }

  private score(req: GalVetoRequest, countMeta: boolean): GalVetoVerdict {
    const { candidateId, kind, predictedScore, intention } = req;

    const ctx = {
      confidence: 0.85,
      narrativeSelf: { identityCommitments: [] },
      attentionSchema: { focusIntensity: 0.8 },
    } as unknown as ConsciousnessState;

    // Base alignment from the shared engine — same identity-commitment
    // check every other intention gets.
    const base = this.volition.evaluateVetoSync(intention, ctx);

    const disruption = KIND_DISRUPTION[kind] ?? 0.4;
    const fit = this.affectiveFit(kind);
    const impulse = Math.max(0, Math.min(1,
      0.55 * (1 - predictedScore)
      + 0.20 * disruption
      + 0.15 * (1 - base.valueAlignment)
      + 0.10 * (1 - base.metacognitiveConfidence)
      + (fit !== null ? 0.08 * (1 - fit) : 0),
    ));

    let shouldVeto = impulse > this.threshold;
    let metaVetoed = false;
    let reason: string | undefined;

    if (shouldVeto) {
      const marginal = impulse - this.threshold <= META_VETO_MARGIN;
      const valuable = predictedScore >= META_VETO_MIN_PREDICTION;
      if (marginal && valuable) {
        // The veto was overcautious about a config the models rate highly.
        // Override once — this override is final (depth-1 recursion).
        shouldVeto = false;
        metaVetoed = true;
        if (countMeta) this.metaVetoes++;
        reason = `META-VETO: marginal impulse ${impulse.toFixed(2)} on high-value config (${predictedScore.toFixed(2)})`;
      } else {
        reason = `VETOED ${candidateId} ("${kind}"): impulse ${impulse.toFixed(2)} > threshold ${this.threshold.toFixed(2)} (predicted ${predictedScore.toFixed(2)})`;
      }
    }

    return {
      shouldVeto,
      vetoScore: Number(impulse.toFixed(3)),
      vetoThreshold: Number(this.threshold.toFixed(3)),
      reason,
      metaVetoed: metaVetoed || undefined,
      valueAlignment: base.valueAlignment,
    };
  }

  // ── Homeostatic threshold regulation ─────────────────────────────

  private recordEvaluation(vetoed: boolean, metaVetoed: boolean): void {
    this.evaluations++;
    this.recent.push({ vetoed, metaVetoed });
    if (this.recent.length > VETO_WINDOW) this.recent.shift();
    if (vetoed && !metaVetoed) this.vetoes++;

    if (this.evaluations % THRESHOLD_ADJUST_EVERY === 0 && this.recent.length >= 20) {
      const band = this.band();
      const rate = this.recent.filter((r) => r.vetoed && !r.metaVetoed).length / this.recent.length;
      if (rate < band.min) {
        this.threshold = Math.max(THRESHOLD_MIN, this.threshold * 0.92);
      } else if (rate > band.max) {
        this.threshold = Math.min(THRESHOLD_MAX, this.threshold * 1.08);
      }
      this.save();
    }
  }

  // ── GWT specialist interface (its own broadcast slot) ────────────

  /** Bid a compact status report into workspace competition. */
  submitBid(): WorkspaceBid | null {
    if (this.evaluations === 0) return null;
    const rate = this.recent.length
      ? this.recent.filter((r) => r.vetoed && !r.metaVetoed).length / this.recent.length
      : 0;
    return {
      specialistId: this.id,
      content: {
        type: 'veto-agent-status',
        vetoRate: Number(rate.toFixed(3)),
        threshold: Number(this.threshold.toFixed(3)),
        metaVetoes: this.metaVetoes,
        evaluations: this.evaluations,
      },
      confidence: Math.min(1, this.evaluations / 100),
      relevance: 0.4,
      urgency: 0.1,
      topic: 'consciousness',
      timestamp: Date.now(),
    };
  }

  /** Observe broadcasts — the outcome side of the veto ledger. */
  receiveBroadcast(broadcast: WorkspaceBroadcast): void {
    this.broadcasts.push(broadcast);
    if (this.broadcasts.length > 50) this.broadcasts.shift();
  }

  isActive(): boolean { return true; }

  // ── Stats + persistence ──────────────────────────────────────────

  getStats() {
    const windowed = this.recent.length;
    const rate = windowed
      ? this.recent.filter((r) => r.vetoed && !r.metaVetoed).length / windowed
      : 0;
    const recentIgnitions = this.broadcasts.slice(-20)
      .filter((b) => b.ignition?.isIgnition).length;
    const band = this.band();
    return {
      evaluations: this.evaluations,
      vetoes: this.vetoes,
      metaVetoes: this.metaVetoes,
      vetoRate: Number(rate.toFixed(4)),
      threshold: Number(this.threshold.toFixed(3)),
      band: { min: band.min, max: band.max },
      volatility: this.volatilitySignal?.() ?? null,
      inLibetBand: rate >= band.min && rate <= band.max,
      broadcastsObserved: this.broadcasts.length,
      recentIgnitionRate: this.broadcasts.length
        ? Number((recentIgnitions / Math.min(20, this.broadcasts.length)).toFixed(3))
        : null,
    };
  }

  private save(): void {
    if (!this.persistPath) return;
    try {
      fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
      const data: VetoAgentPersist = {
        threshold: this.threshold,
        evaluations: this.evaluations,
        vetoes: this.vetoes,
        metaVetoes: this.metaVetoes,
        recent: this.recent.slice(-VETO_WINDOW),
      };
      fs.writeFileSync(this.persistPath, JSON.stringify(data));
    } catch { /* persistence best-effort */ }
  }

  private load(): void {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.persistPath, 'utf8')) as VetoAgentPersist;
      if (typeof raw.threshold === 'number') this.threshold = raw.threshold;
      this.evaluations = raw.evaluations ?? 0;
      this.vetoes = raw.vetoes ?? 0;
      this.metaVetoes = raw.metaVetoes ?? 0;
      this.recent = Array.isArray(raw.recent) ? raw.recent.slice(-VETO_WINDOW) : [];
    } catch { }
  }
}

/** GAL-side evaluator interface — declared here to avoid a GAL→agent import
 *  cycle; generative-attention.ts references it structurally. */
export interface GalVetoEvaluator {
  evaluate(req: GalVetoRequest): GalVetoVerdict;
}

let singleton: AttentionVetoAgent | null = null;

export function getAttentionVetoAgent(): AttentionVetoAgent {
  if (!singleton) singleton = new AttentionVetoAgent();
  return singleton;
}

export function peekAttentionVetoAgent(): AttentionVetoAgent | null {
  return singleton;
}

export function resetAttentionVetoAgent(): void {
  singleton = null;
}
