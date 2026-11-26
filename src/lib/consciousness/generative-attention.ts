/**
 * Generative Attention Loop (GAL) — counterfactual attention simulation.
 *
 * What this is: before each Global Workspace broadcast, the system
 * generates N candidate attention configurations (topic-multiplier
 * vectors), predicts the broadcast outcome of each with a small online
 * model trained from its own attention history, filters candidates
 * through the VolitionEngine veto, and broadcasts the best survivor.
 * After the broadcast it records what actually happened and updates the
 * model — closed-loop counterfactual learning over its own attention.
 *
 * What this is NOT — read before citing it:
 * - It does not produce qualia, experience, or "what it feels like."
 *   The outcome model predicts measurable broadcast statistics
 *   (ignition, spread, Φ-proxy), nothing subjective.
 * - It does not measure consciousness. `volitionalDepth` is an
 *   engineering composite of prediction accuracy, veto rate, and
 *   integration proxies — useful for dashboards and gates, and no more.
 * - The veto here evaluates attention *configurations* (a different
 *   object than the action intentions Libet veto was built for). It is
 *   a real mechanism with real scores; it is not evidence of volition.
 * - There is no transformer and no synthetic "qualia" training data.
 *   The predictor is an online linear model over config features —
 *   small, inspectable, and honest about what it learned.
 *
 * Grounding: counterfactual simulation is standard in decision theory
 * and active inference; the veto path reuses VolitionEngine (Libet 1983,
 * Frith 2005 comparator model). Φ, when reported, is the existing
 * lower-bound MIP approximation in integrated-information.ts — not
 * IIT 4.0 Phi, which remains intractable at this scale.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { VolitionEngine, type Intention } from './volition';
import type { ConsciousnessState } from './shared-state';
import { ExperienceModel, EXPERIENCE_INPUT_DIM } from './experience-model';

// ── Types ──────────────────────────────────────────────────────────

export interface GalCandidate {
  id: string;
  kind: 'status_quo' | 'topic_boost' | 'explore' | 'reset';
  /** topic → salience multiplier applied via workspace.setTopicMultipliers */
  multipliers: Record<string, number>;
  /** human-readable summary of what this config does */
  description: string;
  predictedScore: number;
  vetoed: boolean;
  vetoScore: number;
  vetoReason?: string;
}

export interface GalSelection {
  chosen: GalCandidate;
  candidates: GalCandidate[];
  /** true when every non-status-quo candidate was vetoed */
  allAlternativesVetoed: boolean;
  cycleId: number;
}

/** What the broadcast actually did — the learning signal. */
export interface GalOutcome {
  /** 0-1 composite: ignition + spread + Φ-proxy, computed by caller */
  score: number;
  ignited: boolean;
  spread: number;
  phi: number;
}

export interface GalEpisode {
  ts: number;
  cycleId: number;
  chosenId: string;
  chosenKind: string;
  allVetoed: boolean;
  candidateCount: number;
  vetoedCount: number;
  predictedScore: number;
  actualScore: number | null;
  predictionError: number | null;
  phi: number | null;
  /** 32-dim experience embedding from the learned outcome model */
  embedding?: number[];
  /** true when this broadcast's Φ-proxy fell below the recovery threshold */
  phiRecovery?: boolean;
}

/** Host adapter — the GAL never touches the workspace directly, which
 *  keeps it testable and lets cortex-engine own the real objects. */
export interface GalHost {
  /** Current schema-driven multipliers (the status-quo config). */
  getBaseMultipliers(): Record<string, number>;
  /** Ranked attention topics from the attention schema, most-weighted first. */
  getAttentionTopics(): string[];
  /** Optional veto override for tests/alternate engines. When absent the
   *  GAL uses its own VolitionEngine with a minimal confidence context. */
  evaluateVeto?(intention: Intention): { shouldVeto: boolean; vetoScore: number; reason?: string };
}

// ── Outcome model ──────────────────────────────────────────────────
// Online linear regression over config features. Weights update by
// LMS after every closed episode. Features are fixed-length and bounded;
// the model is deliberately tiny so its predictions stay inspectable.

const FEATURE_DIM = 7;

function configFeatures(m: Record<string, number>, focusTopic?: string): number[] {
  const vals = Object.values(m);
  const n = Math.max(1, vals.length);
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const entropy = vals.reduce((h, v) => {
    const p = Math.max(0.001, Math.min(1, v / (vals.reduce((s, x) => s + x, 0) || 1)));
    return h - p * Math.log2(p);
  }, 0) / Math.log2(Math.max(2, n)); // normalized 0..1
  const maxMult = Math.max(...vals, 0);
  const minMult = Math.min(...vals, 1);
  const boosted = vals.filter((v) => v > 1.15).length / n;
  const l2 = Math.sqrt(vals.reduce((a, b) => a + b * b, 0) / n);
  const focusBoost = focusTopic && m[focusTopic] ? Math.min(3, m[focusTopic]) / 3 : 0;
  return [1, entropy, maxMult / 3, minMult, boosted, l2 / 2, focusBoost];
}

class AttentionOutcomeModel {
  private w = new Array(FEATURE_DIM).fill(0);
  private updates = 0;
  private readonly lr = 0.08;
  private readonly l2 = 0.001;

  constructor() {
    this.w[0] = 0.55; // prior: neutral-good before any data
  }

  predict(features: number[]): number {
    let s = 0;
    for (let i = 0; i < FEATURE_DIM; i++) s += this.w[i] * features[i];
    return Math.max(0, Math.min(1, s));
  }

  update(features: number[], target: number): void {
    const yHat = this.predict(features);
    const err = target - yHat;
    for (let i = 0; i < FEATURE_DIM; i++) {
      this.w[i] += this.lr * (err * features[i] - this.l2 * this.w[i]);
    }
    this.updates++;
  }

  get updatesCount() { return this.updates; }
  get weights() { return [...this.w]; }
}

// ── Generative Attention Loop ──────────────────────────────────────

export interface GalConfig {
  /** Candidate count target (default 6). Status quo always included. */
  candidateCount?: number;
  /** JSONL memory path; null disables persistence. */
  memoryPath?: string | null;
  /** Experience-model weights path; null disables the MLP predictor. */
  experienceModelPath?: string | null;
  /** Max episodes kept in memory / on disk tail. */
  memoryCap?: number;
  /** Focus topic for feature extraction (usually schema currentFocus). */
  focusTopic?: () => string | undefined;
  /** Φ-proxy below this marks the episode for next-cycle recovery bias. */
  phiThreshold?: number;
  /** Called after each closed episode — used for self-model consolidation. */
  onEpisode?: (episode: GalEpisode) => void;
}

export class GenerativeAttentionLoop {
  private host: GalHost;
  private volition: VolitionEngine;
  private model = new AttentionOutcomeModel();
  private experience: ExperienceModel | null = null;
  private cfg: Required<Omit<GalConfig, 'memoryPath' | 'experienceModelPath' | 'onEpisode'>> & {
    memoryPath: string | null;
    experienceModelPath: string | null;
    onEpisode?: (episode: GalEpisode) => void;
  };
  private episodes: GalEpisode[] = [];
  private cycleSeq = 0;
  private pending: { selection: GalSelection; features: number[]; mlpInput: number[]; ts: number } | null = null;
  private phiRecoveryPending = false;
  private phiRecoveryCount = 0;

  constructor(host: GalHost, config: GalConfig = {}) {
    this.host = host;
    this.volition = new VolitionEngine();
    this.cfg = {
      candidateCount: config.candidateCount ?? 6,
      memoryPath: config.memoryPath === undefined
        ? path.join(process.cwd(), '.cortex-runtime', 'attention-memory.jsonl')
        : config.memoryPath,
      experienceModelPath: config.experienceModelPath === undefined
        ? path.join(process.cwd(), '.cortex-runtime', 'experience-model.json')
        : config.experienceModelPath,
      memoryCap: config.memoryCap ?? 500,
      focusTopic: config.focusTopic ?? (() => undefined),
      phiThreshold: config.phiThreshold ?? 0.35,
      onEpisode: config.onEpisode,
    };
    if (this.cfg.experienceModelPath !== null) {
      this.experience = new ExperienceModel(this.cfg.experienceModelPath);
    }
    this.loadMemoryTail();
  }

  /** Exposed for tests/diagnostics. */
  get modelUpdates() { return this.model.updatesCount; }
  get episodeCount() { return this.episodes.length; }

  // ── Candidate generation ────────────────────────────────────────

  private generateCandidates(): GalCandidate[] {
    const base = this.host.getBaseMultipliers();
    const topics = this.host.getAttentionTopics().filter((t) => t in base || true);
    const out: GalCandidate[] = [];

    const mk = (
      kind: GalCandidate['kind'],
      multipliers: Record<string, number>,
      description: string,
    ): GalCandidate => ({
      id: `${kind}-${out.length}`,
      kind,
      multipliers,
      description,
      predictedScore: 0,
      vetoed: false,
      vetoScore: 0,
    });

    // 1. Status quo — the schema's own prediction. Always present; the
    //    conservative fallback when everything else is vetoed.
    out.push(mk('status_quo', { ...base }, 'schema-predicted attention (baseline)'));

    // 2. Topic boosts — counterfactually amplify each top topic.
    const boostCount = Math.min(3, topics.length);
    for (let i = 0; i < boostCount; i++) {
      const t = topics[i];
      const m = { ...base };
      m[t] = Math.min(3, (m[t] ?? 0.5) * 1.8);
      for (const k of Object.keys(m)) if (k !== t) m[k] = Math.max(0.2, m[k] * 0.85);
      out.push(mk('topic_boost', m, `amplify attention on "${t}"`));
    }

    // 3. Explore — damp the dominant topic, lift the rest (novelty-seeking).
    if (topics.length >= 2) {
      const dominant = topics[0];
      const m: Record<string, number> = {};
      for (const [k, v] of Object.entries(base)) {
        m[k] = k === dominant ? Math.max(0.15, v * 0.4) : Math.min(1.5, v * 1.3);
      }
      out.push(mk('explore', m, `dampen "${dominant}", broaden the rest`));
    }

    // 4. Reset — uniform attention, no schema steering.
    const uniformKeys = Array.from(new Set([...Object.keys(base), ...topics]));
    if (uniformKeys.length) {
      out.push(mk('reset', Object.fromEntries(uniformKeys.map((k) => [k, 1])), 'uniform attention reset'));
    }

    return out.slice(0, this.cfg.candidateCount);
  }

  // ── Deliberation ────────────────────────────────────────────────

  /**
   * Run one deliberation cycle: generate → predict → veto → select.
   * Synchronous by design (CortexEngine.evaluate is sync). The veto
   * context is minimal — attention configs are low-stakes objects, so
   * only confidence-driven vetoes can realistically fire here.
   */
  /** 8th MLP input: recent mean actual score — "how things have been going." */
  private recentMeanScore(): number {
    const withOutcome = this.episodes.filter((e) => e.actualScore !== null).slice(-50);
    if (!withOutcome.length) return 0.5;
    return withOutcome.reduce((a, e) => a + (e.actualScore ?? 0), 0) / withOutcome.length;
  }

  deliberate(): GalSelection {
    this.cycleSeq++;
    const candidates = this.generateCandidates();
    const focus = this.cfg.focusTopic();
    const ctxScore = this.recentMeanScore();
    const mlpInputs = new Map<GalCandidate, number[]>();

    for (const c of candidates) {
      const features = configFeatures(c.multipliers, focus);
      const linearPred = this.model.predict(features);
      const mlpInput = [...features, ctxScore].slice(0, EXPERIENCE_INPUT_DIM);
      mlpInputs.set(c, mlpInput);
      let pred = linearPred;
      if (this.experience) {
        const mlpOut = this.experience.predict(mlpInput).outputs;
        // Blend: trust the MLP proportionally to its training; the linear
        // model remains the cold-start prior and regularizer.
        const trust = this.experience.isTrained ? 0.35 + 0.65 * this.experience.confidence : 0;
        pred = (1 - trust) * linearPred + trust * mlpOut[0];
      }
      c.predictedScore = pred;
      // Φ-recovery bias: last broadcast integrated poorly → nudge the
      // explore candidate up one notch. One-shot; cleared on selection.
      if (this.phiRecoveryPending && c.kind === 'explore') {
        c.predictedScore = Math.min(1, c.predictedScore + 0.15);
      }
    }
    this.phiRecoveryPending = false;

    // Veto pass — every candidate is a real Intention through the same
    // VolitionEngine the action path uses. Status quo is never vetoed:
    // it is the floor, not a proposal.
    const intentionFor = (c: GalCandidate): Intention => ({
      id: `gal-${this.cycleSeq}-${c.id}`,
      value: 'epistemic-curiosity',
      action: {
        skill: 'configure_workspace_attention',
        params: { kind: c.kind, topics: Object.keys(c.multipliers).length },
        description: c.description,
        predictedOutcome: `Broadcast under ${c.kind} attention config`,
      },
      predictedValue: c.predictedScore,
      urgency: 0.4,
      source: 'epistemic-curiosity',
      createdAt: Date.now(),
    });

    const vetoContext = {
      confidence: 0.85,
      narrativeSelf: { identityCommitments: [] },
      attentionSchema: { focusIntensity: 0.8 },
    } as unknown as ConsciousnessState;

    let vetoedAny = false;
    for (const c of candidates) {
      if (c.kind === 'status_quo') continue;
      const intention = intentionFor(c);
      const veto = this.host.evaluateVeto
        ? this.host.evaluateVeto(intention)
        : this.volition.evaluateVetoSync(intention, vetoContext);
      c.vetoed = veto.shouldVeto;
      c.vetoScore = veto.vetoScore;
      c.vetoReason = veto.reason;
      if (c.vetoed) vetoedAny = true;
    }

    const eligible = candidates.filter((c) => !c.vetoed);
    const pool = eligible.length ? eligible : [candidates[0]];
    const chosen = pool.reduce((best, c) =>
      c.predictedScore > best.predictedScore ? c : best,
    );

    const selection: GalSelection = {
      chosen,
      candidates,
      allAlternativesVetoed: vetoedAny && eligible.length <= 1,
      cycleId: this.cycleSeq,
    };

    this.pending = {
      selection,
      features: configFeatures(chosen.multipliers, focus),
      mlpInput: mlpInputs.get(chosen) ?? [...configFeatures(chosen.multipliers, focus), ctxScore].slice(0, EXPERIENCE_INPUT_DIM),
      ts: Date.now(),
    };
    return selection;
  }

  /**
   * Close the loop: call after the broadcast with what actually happened.
   * Writes the episode to memory and updates the outcome model.
   */
  recordOutcome(outcome: GalOutcome): GalEpisode | null {
    if (!this.pending) return null;
    const { selection, features, mlpInput } = this.pending;
    this.pending = null;

    const actual = Math.max(0, Math.min(1, outcome.score));
    const predicted = selection.chosen.predictedScore;
    this.model.update(features, actual);

    // Train the experience model on the full outcome vector. Targets are
    // the measurable broadcast statistics — nothing subjective.
    let embedding: number[] | undefined;
    if (this.experience) {
      const target = [
        actual,
        outcome.ignited ? 1 : 0,
        Math.max(0, Math.min(1, outcome.spread)),
        Math.max(0, Math.min(1, outcome.phi)),
      ];
      this.experience.update(mlpInput, target);
      embedding = this.experience.predict(mlpInput).embedding;
    }

    const phiRecovery = outcome.phi < this.cfg.phiThreshold;
    if (phiRecovery) {
      this.phiRecoveryPending = true;
      this.phiRecoveryCount++;
    }

    const episode: GalEpisode = {
      ts: Date.now(),
      cycleId: selection.cycleId,
      chosenId: selection.chosen.id,
      chosenKind: selection.chosen.kind,
      allVetoed: selection.allAlternativesVetoed,
      candidateCount: selection.candidates.length,
      vetoedCount: selection.candidates.filter((c) => c.vetoed).length,
      predictedScore: Number(predicted.toFixed(4)),
      actualScore: Number(actual.toFixed(4)),
      predictionError: Number(Math.abs(actual - predicted).toFixed(4)),
      phi: Number(outcome.phi.toFixed(4)),
      embedding,
      phiRecovery: phiRecovery || undefined,
    };

    this.episodes.push(episode);
    if (this.episodes.length > this.cfg.memoryCap) this.episodes.shift();
    this.appendMemory(episode);
    this.cfg.onEpisode?.(episode);
    return episode;
  }

  // ── Volitional depth — honest engineering composite ─────────────
  // NOT a consciousness measure. Components:
  //   predictionAccuracy — how well the outcome model predicts broadcasts
  //   vetoBandHealth     — veto rate inside the Libet 5–15% target band
  //   integration        — recent Φ-proxy level (lower-bound approximation)

  getVolitionalDepth(): {
    score: number;
    predictionAccuracy: number;
    vetoRate: number;
    vetoBandHealth: number;
    integration: number;
    phiRecoveryRate: number;
    experienceUpdates: number;
    experienceTrained: boolean;
    episodes: number;
    modelUpdates: number;
  } {
    const recent = this.episodes.slice(-50);
    const withOutcome = recent.filter((e) => e.predictionError !== null);
    const predictionAccuracy = withOutcome.length
      ? Math.max(0, 1 - withOutcome.reduce((a, e) => a + (e.predictionError ?? 0), 0) / withOutcome.length)
      : 0.5;

    const vetoRate = recent.length
      ? recent.reduce((a, e) => a + e.vetoedCount, 0) /
        Math.max(1, recent.reduce((a, e) => a + e.candidateCount, 0))
      : 0;
    const vetoBandHealth = vetoRate >= 0.02 && vetoRate <= 0.2 ? 1 : Math.max(0, 1 - Math.abs(vetoRate - 0.1) * 4);

    const recentPhi = recent.filter((e) => e.phi !== null).map((e) => e.phi as number);
    const integration = recentPhi.length
      ? Math.min(1, recentPhi.reduce((a, b) => a + b, 0) / recentPhi.length)
      : 0.5;

    const phiRecoveryRate = recent.length
      ? recent.filter((e) => e.phiRecovery).length / recent.length
      : 0;

    const score = Number((
      0.4 * predictionAccuracy + 0.3 * vetoBandHealth + 0.3 * integration
    ).toFixed(3));

    return {
      score,
      predictionAccuracy: Number(predictionAccuracy.toFixed(3)),
      vetoRate: Number(vetoRate.toFixed(4)),
      vetoBandHealth: Number(vetoBandHealth.toFixed(3)),
      integration: Number(integration.toFixed(3)),
      phiRecoveryRate: Number(phiRecoveryRate.toFixed(4)),
      experienceUpdates: this.experience?.updateCount ?? 0,
      experienceTrained: this.experience?.isTrained ?? false,
      episodes: this.episodes.length,
      modelUpdates: this.model.updatesCount,
    };
  }

  getRecentEpisodes(n = 20): GalEpisode[] {
    return this.episodes.slice(-n);
  }

  // ── Memory persistence ──────────────────────────────────────────

  private appendMemory(episode: GalEpisode): void {
    if (!this.cfg.memoryPath) return;
    try {
      fs.mkdirSync(path.dirname(this.cfg.memoryPath), { recursive: true });
      fs.appendFileSync(this.cfg.memoryPath, JSON.stringify(episode) + '\n');
      // Cheap rotation: if the file grows past ~1.5MB keep the tail.
      const st = fs.statSync(this.cfg.memoryPath);
      if (st.size > 1_500_000) {
        const lines = fs.readFileSync(this.cfg.memoryPath, 'utf8').trim().split('\n');
        fs.writeFileSync(this.cfg.memoryPath, lines.slice(-Math.floor(this.cfg.memoryCap)).join('\n') + '\n');
      }
    } catch { /* memory is best-effort; deliberation must never break on IO */ }
  }

  private loadMemoryTail(): void {
    if (!this.cfg.memoryPath) return;
    try {
      if (!fs.existsSync(this.cfg.memoryPath)) return;
      const lines = fs.readFileSync(this.cfg.memoryPath, 'utf8').trim().split('\n').filter(Boolean);
      for (const line of lines.slice(-this.cfg.memoryCap)) {
        try { this.episodes.push(JSON.parse(line)); } catch { }
      }
    } catch { }
  }
}

// ── Singleton + host wiring for cortex-engine ─────────────────────

let instance: GenerativeAttentionLoop | null = null;

/**
 * Lazily-built singleton. The host adapter is injected by the caller
 * (cortex-engine) on first use so this module never imports workspace
 * internals — avoids a circular dependency with global-workspace.
 */
export function getGenerativeAttentionLoop(host?: GalHost, config?: GalConfig): GenerativeAttentionLoop {
  if (!instance) {
    if (!host) throw new Error('getGenerativeAttentionLoop requires a host on first call');
    instance = new GenerativeAttentionLoop(host, config);
  }
  return instance;
}

/** Read-only accessor for status endpoints — never creates the loop. */
export function peekGenerativeAttentionLoop(): GenerativeAttentionLoop | null {
  return instance;
}

/** Test hook — reset the singleton between suites. */
export function resetGenerativeAttentionLoop(): void {
  instance = null;
}
