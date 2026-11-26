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
 *   A dedicated AttentionVetoAgent can own this veto via the
 *   `attentionVeto` hook — including depth-1 meta-veto and a homeostatic
 *   threshold regulating the veto rate toward the Libet 5–15% band.
 * - The self-model loop is closed: episodes consolidate into the
 *   autobiographical self-model (host-side), and the model's recent
 *   valence/agency feed back through `selfSignal` to bias the next
 *   deliberation. Feedback is bounded (±0.05 on one candidate kind).
 * - Same-cycle φ-recovery: when the last broadcast's φ-proxy fell below
 *   threshold and the experience model is trained, candidates are
 *   re-ranked by *predicted* φ inside the same deliberation — not just
 *   biased next cycle.
 * - There is no transformer and no synthetic "qualia" training data.
 *   The predictor is an online model over config features — small,
 *   inspectable, and honest about what it learned.
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
  /** distance from the veto boundary: threshold − impulse. Positive =
   *  safe margin; near-zero = the veto almost fired. Graded volition —
   *  agency as a continuum, not a switch. */
  vetoMargin?: number;
  /** true when the veto on this candidate was itself vetoed (depth-1 meta-veto) */
  metaVetoed?: boolean;
}

/** What an external veto authority (e.g. AttentionVetoAgent) receives. */
export interface GalVetoRequest {
  candidateId: string;
  kind: string;
  description: string;
  predictedScore: number;
  intention: Intention;
}

export interface GalVetoVerdict {
  shouldVeto: boolean;
  vetoScore: number;
  vetoThreshold?: number;
  reason?: string;
  metaVetoed?: boolean;
  valueAlignment?: number;
}

/** Read-back signal from the autobiographical self-model. The GAL consumes
 *  this to close the loop: attention outcomes consolidate into the self
 *  model, and the self model's recent valence/agency bias the next
 *  deliberation. Injected by the host — this module never imports the
 *  self-model directly. */
export interface GalSelfSignal {
  /** mean affectiveValence of recent gal-attention episodes, normalized [-1,1] */
  recentValence: number;
  /** mean agencyAttribution of those episodes [0,1] */
  recentAgency: number;
  /** how many gal-attention episodes the self-model holds */
  attentionEpisodes: number;
}

export interface GalSelection {
  chosen: GalCandidate;
  candidates: GalCandidate[];
  /** true when every non-status-quo candidate was vetoed */
  allAlternativesVetoed: boolean;
  cycleId: number;
  /** same-cycle φ-recovery outcome: attempted = low-φ pending + trained model;
   *  applied = a different candidate won on predicted φ. */
  phiRecovery?: { attempted: boolean; applied: boolean };
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
  /** same-cycle recovery detail carried from the selection */
  recoveryApplied?: boolean;
  /** true when the chosen config's veto was overridden by a meta-veto */
  chosenMetaVetoed?: boolean;
  /** self-model valence that biased this deliberation, [-1,1] */
  selfValence?: number;
  /** chosen candidate's distance from the veto boundary */
  chosenVetoMargin?: number;
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
  /** Optional dedicated veto authority (e.g. AttentionVetoAgent). When
   *  present it replaces both the host veto hook and the internal
   *  VolitionEngine for attention configs — one owner, one policy. */
  attentionVeto?: (req: GalVetoRequest) => GalVetoVerdict;
  /** Optional read-back from the autobiographical self-model. Supplies
   *  the feedback half of the loop: episodes consolidate into the self
   *  model, and its recent valence/agency bias future deliberation. */
  selfSignal?: () => GalSelfSignal | null;
}

export class GenerativeAttentionLoop {
  private host: GalHost;
  private volition: VolitionEngine;
  private model = new AttentionOutcomeModel();
  private experience: ExperienceModel | null = null;
  private cfg: Required<Omit<GalConfig, 'memoryPath' | 'experienceModelPath' | 'onEpisode' | 'attentionVeto' | 'selfSignal'>> & {
    memoryPath: string | null;
    experienceModelPath: string | null;
    onEpisode?: (episode: GalEpisode) => void;
    attentionVeto?: (req: GalVetoRequest) => GalVetoVerdict;
    selfSignal?: () => GalSelfSignal | null;
  };
  private episodes: GalEpisode[] = [];
  private phiTimeline: Array<{ ts: number; phi: number }> = [];
  private cycleSeq = 0;
  private pending: { selection: GalSelection; features: number[]; mlpInput: number[]; ts: number; selfValence?: number } | null = null;
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
      attentionVeto: config.attentionVeto,
      selfSignal: config.selfSignal,
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

  /** 9th MLP input: recent veto rate — is the veto agent restraining?
   *  Nominal Libet prior 0.10 until data exists. */
  private recentVetoRate(): number {
    const recent = this.episodes.slice(-50);
    const cand = recent.reduce((a, e) => a + e.candidateCount, 0);
    if (!cand) return 0.10;
    return recent.reduce((a, e) => a + e.vetoedCount, 0) / cand;
  }

  /** 10th MLP input: last broadcast's φ-proxy — was the previous breath
   *  integrated? Neutral 0.5 prior. */
  private lastPhi(): number {
    for (let i = this.episodes.length - 1; i >= 0; i--) {
      const p = this.episodes[i].phi;
      if (p !== null && p !== undefined) return p;
    }
    return 0.5;
  }

  private buildMlpInput(features: number[], ctxScore: number): number[] {
    return [...features, ctxScore, this.recentVetoRate(), this.lastPhi()]
      .slice(0, EXPERIENCE_INPUT_DIM);
  }

  deliberate(): GalSelection {
    this.cycleSeq++;
    const candidates = this.generateCandidates();
    const focus = this.cfg.focusTopic();
    const ctxScore = this.recentMeanScore();
    // Self-model read-back: recent autobiographical valence/agency from
    // attention episodes biases this deliberation. This is the return half
    // of the loop — outcomes → self-model → future predictions.
    const self = this.cfg.selfSignal?.() ?? null;
    const selfValence = self ? Math.max(-1, Math.min(1, self.recentValence)) : undefined;
    const mlpInputs = new Map<GalCandidate, number[]>();
    const mlpOutputs = new Map<GalCandidate, number[]>();
    const sameCycleRecovery = this.phiRecoveryPending && this.experience?.isTrained === true;

    for (const c of candidates) {
      const features = configFeatures(c.multipliers, focus);
      const linearPred = this.model.predict(features);
      const mlpInput = this.buildMlpInput(features, ctxScore);
      mlpInputs.set(c, mlpInput);
      let pred = linearPred;
      if (this.experience) {
        const mlpPred = this.experience.predict(mlpInput);
        mlpOutputs.set(c, mlpPred.outputs);
        // Blend: trust the MLP proportionally to its training; the linear
        // model remains the cold-start prior and regularizer.
        const trust = this.experience.isTrained ? 0.35 + 0.65 * this.experience.confidence : 0;
        pred = (1 - trust) * linearPred + trust * mlpPred.outputs[0];
      }
      // Self-model feedback: negative recent valence dampens novelty-seeking
      // (explore), positive valence amplifies it — bounded ±0.05 so the
      // signal steers but never overrides the outcome models.
      if (selfValence !== undefined && c.kind === 'explore') {
        pred = Math.max(0, Math.min(1, pred + selfValence * 0.05));
      }
      c.predictedScore = pred;
      // Φ-recovery fallback: when the experience model isn't trained enough
      // to predict φ per candidate, keep the next-cycle explore bias. When
      // it IS trained, same-cycle recovery below handles it instead.
      if (this.phiRecoveryPending && !sameCycleRecovery && c.kind === 'explore') {
        c.predictedScore = Math.min(1, c.predictedScore + 0.15);
      }
    }

    // Veto pass — every candidate is a real Intention. A dedicated veto
    // authority (AttentionVetoAgent) owns the decision when configured;
    // otherwise the host hook, otherwise the shared VolitionEngine. The
    // status quo is never vetoed: it is the floor, not a proposal.
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
      if (this.cfg.attentionVeto) {
        const verdict = this.cfg.attentionVeto({
          candidateId: c.id,
          kind: c.kind,
          description: c.description,
          predictedScore: c.predictedScore,
          intention,
        });
        c.vetoed = verdict.shouldVeto;
        c.vetoScore = verdict.vetoScore;
        c.vetoReason = verdict.reason;
        c.vetoMargin = (verdict.vetoThreshold ?? 0.62) - verdict.vetoScore;
        c.metaVetoed = verdict.metaVetoed === true || undefined;
      } else {
        const veto = this.host.evaluateVeto
          ? this.host.evaluateVeto(intention)
          : this.volition.evaluateVetoSync(intention, vetoContext);
        c.vetoed = veto.shouldVeto;
        c.vetoScore = veto.vetoScore;
        c.vetoReason = veto.reason;
        c.vetoMargin = ((veto as { vetoThreshold?: number }).vetoThreshold ?? 0.65) - veto.vetoScore;
      }
      if (c.vetoed) vetoedAny = true;
    }

    const eligible = candidates.filter((c) => !c.vetoed);
    const pool = eligible.length ? eligible : [candidates[0]];
    let chosen = pool.reduce((best, c) =>
      c.predictedScore > best.predictedScore ? c : best,
    );

    // Same-cycle Φ-recovery: last broadcast integrated poorly and the
    // experience model is trained → re-rank eligible candidates by
    // *predicted* φ (outputs[3]) and switch only on a clear margin.
    // This replaces "bias next cycle" with "fix it now" when possible.
    let recovery: { attempted: boolean; applied: boolean } | undefined;
    if (this.phiRecoveryPending) {
      recovery = { attempted: sameCycleRecovery, applied: false };
      if (sameCycleRecovery && pool.length > 1) {
        const phiOf = (c: GalCandidate): number => mlpOutputs.get(c)?.[3] ?? 0.5;
        const chosenPhi = phiOf(chosen);
        let bestPhiC = chosen;
        let bestPhi = chosenPhi;
        for (const c of pool) {
          const p = phiOf(c);
          if (p > bestPhi) { bestPhi = p; bestPhiC = c; }
        }
        if (bestPhiC !== chosen && bestPhi - chosenPhi > 0.05) {
          chosen = bestPhiC;
          recovery.applied = true;
        }
      }
    }
    this.phiRecoveryPending = false;

    const selection: GalSelection = {
      chosen,
      candidates,
      allAlternativesVetoed: vetoedAny && eligible.length <= 1,
      cycleId: this.cycleSeq,
      phiRecovery: recovery,
    };

    this.pending = {
      selection,
      features: configFeatures(chosen.multipliers, focus),
      mlpInput: mlpInputs.get(chosen) ?? this.buildMlpInput(configFeatures(chosen.multipliers, focus), ctxScore),
      ts: Date.now(),
      selfValence,
    };
    return selection;
  }

  /**
   * Close the loop: call after the broadcast with what actually happened.
   * Writes the episode to memory and updates the outcome model.
   */
  recordOutcome(outcome: GalOutcome): GalEpisode | null {
    if (!this.pending) return null;
    const { selection, features, mlpInput, selfValence } = this.pending;
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
    this.phiTimeline.push({ ts: Date.now(), phi: outcome.phi });
    if (this.phiTimeline.length > 200) this.phiTimeline.shift();

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
      recoveryApplied: selection.phiRecovery?.applied === true || undefined,
      chosenMetaVetoed: selection.chosen.metaVetoed === true || undefined,
      selfValence,
      chosenVetoMargin: selection.chosen.vetoMargin !== undefined
        ? Number(selection.chosen.vetoMargin.toFixed(3)) : undefined,
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

  /**
   * Temporal binding — "specious present." Time-weighted integral of the
   * φ-proxy over a sliding window: each episode contributes phi × the
   * elapsed time it represents (capped at 2× cadence so gaps don't
   * dominate). This is the honest lower-bound version of integrating
   * information over time — sustained integration, not a snapshot.
   */
  getTemporalPhi(windowMs = 5 * 60 * 1000): number {
    const now = Date.now();
    const inWindow = this.phiTimeline.filter((p) => now - p.ts <= windowMs);
    if (!inWindow.length) return 0.5;
    let num = 0, den = 0;
    let prevTs = inWindow[0].ts;
    for (let i = 1; i < inWindow.length; i++) {
      const dt = Math.min(inWindow[i].ts - prevTs, 120000); // cap gap weight
      num += inWindow[i - 1].phi * Math.max(1, dt);
      den += Math.max(1, dt);
      prevTs = inWindow[i].ts;
    }
    // tail: last point represents time since it up to now (capped)
    const tailDt = Math.min(now - prevTs, 120000);
    if (tailDt > 0) {
      num += inWindow[inWindow.length - 1].phi * tailDt;
      den += tailDt;
    }
    return den ? Math.max(0, Math.min(1, num / den)) : 0.5;
  }

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
    /** stdev of recent actual scores — regime stability signal consumed
     *  by the VetoAgent's adaptive Libet band. 0 = rock steady. */
    volatility: number;
    /** time-weighted φ integral over the specious-present window */
    temporalPhi: number;
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

    const scores = recent.filter((e) => e.actualScore !== null)
      .map((e) => e.actualScore as number).slice(-20);
    const volatility = scores.length > 1
      ? Math.sqrt(scores.reduce((a, s) => a + (s - scores.reduce((x, y) => x + y, 0) / scores.length) ** 2, 0) / scores.length)
      : 0.15;

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
      volatility: Number(volatility.toFixed(4)),
      temporalPhi: Number(this.getTemporalPhi().toFixed(3)),
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
