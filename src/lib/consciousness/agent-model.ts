/**
 * Agent Outcome Model — per-agent online predictor of task outcomes.
 *
 * What this is: a small two-layer MLP (8 → 24 tanh → 2 outputs) trained
 * online by backprop on an agent's own terminal-task history. It predicts
 * [P(success), durationNorm] for the agent's next task of a given kind
 * context. Hidden activations are inspectable state, same convention as
 * experience-model.ts.
 *
 * What this is NOT:
 * - Not a model of another agent's mind, beliefs, or experience. It
 *   predicts observable outcomes (did the task complete, how long did
 *   it take) from observable telemetry. Anything richer would be theater.
 * - Not pretrained on synthetic data — it learns only from real task
 *   archive rows, starting from a neutral prior, and reports confidence
 *   via `updates`/`isTrained`.
 *
 * Math: standard MLP, MSE loss, SGD, tanh hidden, linear outputs clamped
 * at read time. Weights persist to JSON per agent so learning survives
 * restarts.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export const AGENT_MODEL_INPUT_DIM = 8;
export const AGENT_MODEL_HIDDEN_DIM = 24;
export const AGENT_MODEL_OUTPUT_DIM = 2; // [successProb, durationNorm]

/** Input layout (all 0..1 normalized):
 *  [recentSuccessRate, recentFailRate, tasksLastHour/10,
 *   durationNormMean, isRepeatKind, sameStatusStreak/5,
 *   hoursSinceLastTask/24, kindFrequency/20] */

export interface AgentPrediction {
  /** P(task completes successfully), 0..1 */
  successProb: number;
  /** Expected duration normalized (durationMs / 300000), clamped 0..1 */
  durationNorm: number;
}

interface Weights {
  w1: number[][];
  b1: number[];
  w2: number[][];
  b2: number[];
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function initWeights(): Weights {
  const w1: number[][] = [];
  for (let i = 0; i < AGENT_MODEL_INPUT_DIM; i++) {
    w1.push(Array.from({ length: AGENT_MODEL_HIDDEN_DIM }, () => rand(-0.3, 0.3)));
  }
  const w2: number[][] = [];
  for (let h = 0; h < AGENT_MODEL_HIDDEN_DIM; h++) {
    w2.push(Array.from({ length: AGENT_MODEL_OUTPUT_DIM }, () => rand(-0.3, 0.3)));
  }
  return {
    w1, b1: new Array(AGENT_MODEL_HIDDEN_DIM).fill(0),
    w2, b2: new Array(AGENT_MODEL_OUTPUT_DIM).fill(0.5),
  };
}

export class AgentOutcomeModel {
  private w: Weights;
  private updates = 0;
  private readonly lr = 0.03;
  private readonly l2 = 0.0005;
  private persistPath: string | null;

  /** Below this many updates, predictions are prior-dominated. */
  readonly minTrustUpdates = 15;

  constructor(agentId: string, persistDir?: string | null) {
    this.persistPath = persistDir === null ? null : path.join(
      persistDir ?? path.join(process.cwd(), '.cortex-runtime', 'tom'),
      `${agentId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`,
    );
    this.w = this.load() ?? initWeights();
  }

  get updateCount() { return this.updates; }
  get isTrained() { return this.updates >= this.minTrustUpdates; }

  /** Confidence in predictions, 0..1 — saturates at ~150 updates. */
  get confidence(): number {
    return Math.min(1, this.updates / 150);
  }

  private forward(x: number[]): { hidden: number[]; out: number[] } {
    const hidden = new Array(AGENT_MODEL_HIDDEN_DIM);
    for (let h = 0; h < AGENT_MODEL_HIDDEN_DIM; h++) {
      let s = this.w.b1[h];
      for (let i = 0; i < AGENT_MODEL_INPUT_DIM; i++) s += x[i] * this.w.w1[i][h];
      hidden[h] = Math.tanh(s);
    }
    const out = new Array(AGENT_MODEL_OUTPUT_DIM);
    for (let o = 0; o < AGENT_MODEL_OUTPUT_DIM; o++) {
      let s = this.w.b2[o];
      for (let h = 0; h < AGENT_MODEL_HIDDEN_DIM; h++) s += hidden[h] * this.w.w2[h][o];
      out[o] = s;
    }
    return { hidden, out };
  }

  predict(x: number[]): AgentPrediction {
    const { out } = this.forward(x);
    return {
      successProb: Math.max(0, Math.min(1, out[0])),
      durationNorm: Math.max(0, Math.min(1, out[1])),
    };
  }

  /** Online SGD step on one terminal task. x = features, y = [success, durNorm]. */
  update(x: number[], y: number[]): void {
    const { hidden, out } = this.forward(x);
    const dOut = out.map((v, o) => (v - y[o]) * (2 / AGENT_MODEL_OUTPUT_DIM));

    const dHidden = new Array(AGENT_MODEL_HIDDEN_DIM).fill(0);
    for (let h = 0; h < AGENT_MODEL_HIDDEN_DIM; h++) {
      for (let o = 0; o < AGENT_MODEL_OUTPUT_DIM; o++) {
        this.w.w2[h][o] -= this.lr * (dOut[o] * hidden[h] + this.l2 * this.w.w2[h][o]);
        dHidden[h] += dOut[o] * this.w.w2[h][o];
      }
    }
    for (let o = 0; o < AGENT_MODEL_OUTPUT_DIM; o++) {
      let g = 0;
      for (let h = 0; h < AGENT_MODEL_HIDDEN_DIM; h++) g += dOut[o] * hidden[h];
      this.w.b2[o] -= this.lr * (g / AGENT_MODEL_HIDDEN_DIM + this.l2 * this.w.b2[o]);
    }

    for (let h = 0; h < AGENT_MODEL_HIDDEN_DIM; h++) {
      const dt = dHidden[h] * (1 - hidden[h] * hidden[h]);
      for (let i = 0; i < AGENT_MODEL_INPUT_DIM; i++) {
        this.w.w1[i][h] -= this.lr * (dt * x[i] + this.l2 * this.w.w1[i][h]);
      }
      this.w.b1[h] -= this.lr * (dt + this.l2 * this.w.b1[h]);
    }

    this.updates++;
    if (this.updates % 10 === 0) this.save();
  }

  flush(): void { this.save(); }

  private save(): void {
    if (!this.persistPath) return;
    try {
      fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
      fs.writeFileSync(this.persistPath, JSON.stringify({ updates: this.updates, w: this.w }));
    } catch { /* persistence best-effort */ }
  }

  private load(): Weights | null {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(this.persistPath, 'utf8'));
      if (raw?.w?.w1?.length === AGENT_MODEL_INPUT_DIM && raw?.w?.w2) {
        this.updates = raw.updates ?? 0;
        return raw.w as Weights;
      }
    } catch { }
    return null;
  }
}
