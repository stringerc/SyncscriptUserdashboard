/**
 * Experience Model — learned predictor of broadcast outcomes.
 *
 * What this is: a small two-layer MLP (8 → 32 tanh → 4 outputs) trained
 * online by backprop on the system's own attention episodes. It predicts
 * the measurable outcome vector of a candidate attention configuration:
 * [broadcastScore, ignition, spread, phiProxy]. Its 32-dim hidden
 * activation is stored per episode as an "experience embedding" — a
 * learned state representation, inspectable and replayable.
 *
 * What this is NOT:
 * - Not a model of qualia or subjective experience. The embedding is a
 *   lossy code of "what configuration produces what measurable result,"
 *   nothing more. Calling it an experience vector would be theater.
 * - Not a transformer and not pretrained on synthetic data. It learns
 *   only from real episodes this system produces, starting from a
 *   neutral prior, and says so via `updates`/`confidence`.
 * - Predictions are only trusted once `minTrustUpdates` episodes have
 *   been seen; before that callers should fall back to simpler priors.
 *
 * Math: standard MLP, MSE loss, SGD with momentum-free updates, tanh
 * hidden units, linear outputs clamped at read time. Weights persist to
 * JSON so learning survives restarts.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export const EXPERIENCE_INPUT_DIM = 8;
export const EXPERIENCE_HIDDEN_DIM = 32;
export const EXPERIENCE_OUTPUT_DIM = 4; // [score, ignition, spread, phi]

export interface ExperiencePrediction {
  /** [score, ignition, spread, phi] each clamped 0..1 */
  outputs: number[];
  /** 32-dim hidden activation — the "experience embedding" */
  embedding: number[];
}

interface Weights {
  w1: number[][]; // [input][hidden]
  b1: number[];   // [hidden]
  w2: number[][]; // [hidden][output]
  b2: number[];   // [output]
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function initWeights(): Weights {
  const w1: number[][] = [];
  for (let i = 0; i < EXPERIENCE_INPUT_DIM; i++) {
    w1.push(Array.from({ length: EXPERIENCE_HIDDEN_DIM }, () => rand(-0.3, 0.3)));
  }
  const w2: number[][] = [];
  for (let h = 0; h < EXPERIENCE_HIDDEN_DIM; h++) {
    w2.push(Array.from({ length: EXPERIENCE_OUTPUT_DIM }, () => rand(-0.3, 0.3)));
  }
  return {
    w1, b1: new Array(EXPERIENCE_HIDDEN_DIM).fill(0),
    w2, b2: new Array(EXPERIENCE_OUTPUT_DIM).fill(0.5), // neutral prior ~0.5
  };
}

export class ExperienceModel {
  private w: Weights;
  private updates = 0;
  private readonly lr = 0.02;
  private readonly l2 = 0.0005;
  private persistPath: string | null;

  /** Below this many updates, predictions are prior-dominated. */
  readonly minTrustUpdates = 20;

  constructor(persistPath?: string | null) {
    this.persistPath = persistPath === undefined
      ? path.join(process.cwd(), '.cortex-runtime', 'experience-model.json')
      : persistPath;
    this.w = this.load() ?? initWeights();
  }

  get updateCount() { return this.updates; }
  get isTrained() { return this.updates >= this.minTrustUpdates; }

  /** Confidence in predictions, 0..1 — saturates at ~200 updates. */
  get confidence(): number {
    return Math.min(1, this.updates / 200);
  }

  private forward(x: number[]): { hidden: number[]; out: number[] } {
    const hidden = new Array(EXPERIENCE_HIDDEN_DIM);
    for (let h = 0; h < EXPERIENCE_HIDDEN_DIM; h++) {
      let s = this.w.b1[h];
      for (let i = 0; i < EXPERIENCE_INPUT_DIM; i++) s += x[i] * this.w.w1[i][h];
      hidden[h] = Math.tanh(s);
    }
    const out = new Array(EXPERIENCE_OUTPUT_DIM);
    for (let o = 0; o < EXPERIENCE_OUTPUT_DIM; o++) {
      let s = this.w.b2[o];
      for (let h = 0; h < EXPERIENCE_HIDDEN_DIM; h++) s += hidden[h] * this.w.w2[h][o];
      out[o] = s;
    }
    return { hidden, out };
  }

  predict(x: number[]): ExperiencePrediction {
    const { hidden, out } = this.forward(x);
    return {
      outputs: out.map((v) => Math.max(0, Math.min(1, v))),
      embedding: hidden,
    };
  }

  /** Online SGD step on one episode. x = input features, y = 4-dim target. */
  update(x: number[], y: number[]): void {
    const { hidden, out } = this.forward(x);
    // output delta (linear output, MSE → delta = out - y)
    const dOut = out.map((v, o) => (v - y[o]) * (2 / EXPERIENCE_OUTPUT_DIM));

    // gradients for w2/b2
    const dHidden = new Array(EXPERIENCE_HIDDEN_DIM).fill(0);
    for (let h = 0; h < EXPERIENCE_HIDDEN_DIM; h++) {
      for (let o = 0; o < EXPERIENCE_OUTPUT_DIM; o++) {
        this.w.w2[h][o] -= this.lr * (dOut[o] * hidden[h] + this.l2 * this.w.w2[h][o]);
        dHidden[h] += dOut[o] * this.w.w2[h][o];
      }
    }
    for (let o = 0; o < EXPERIENCE_OUTPUT_DIM; o++) {
      let g = 0;
      for (let h = 0; h < EXPERIENCE_HIDDEN_DIM; h++) g += dOut[o] * hidden[h];
      this.w.b2[o] -= this.lr * (g / EXPERIENCE_HIDDEN_DIM + this.l2 * this.w.b2[o]);
    }

    // backprop through tanh
    for (let h = 0; h < EXPERIENCE_HIDDEN_DIM; h++) {
      const dt = dHidden[h] * (1 - hidden[h] * hidden[h]);
      for (let i = 0; i < EXPERIENCE_INPUT_DIM; i++) {
        this.w.w1[i][h] -= this.lr * (dt * x[i] + this.l2 * this.w.w1[i][h]);
      }
      this.w.b1[h] -= this.lr * (dt + this.l2 * this.w.b1[h]);
    }

    this.updates++;
    if (this.updates % 10 === 0) this.save();
  }

  /** Force-persist current weights (shutdown, tests, milestones). */
  flush(): void { this.save(); }

  private save(): void {
    if (!this.persistPath) return;
    try {
      fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
      fs.writeFileSync(this.persistPath, JSON.stringify({
        updates: this.updates,
        w: this.w,
      }));
    } catch { /* persistence best-effort */ }
  }

  private load(): Weights | null {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(this.persistPath, 'utf8'));
      if (raw?.w?.w1 && raw?.w?.w2) {
        this.updates = raw.updates ?? 0;
        return raw.w as Weights;
      }
    } catch { }
    return null;
  }
}

