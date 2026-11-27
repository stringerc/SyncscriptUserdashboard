/**
 * Social Theory-of-Mind layer (depth-1) — per-agent outcome predictors.
 *
 * What this is: a registry of AgentOutcomeModels, one per observed
 * cortex-agent, trained online on terminal-task telemetry (task-archive
 * rows). `predict(agentId)` answers "how likely is this agent's next
 * task to succeed, and how long will it take?" from its own history.
 *
 * What this is NOT:
 * - Not recursive mind-reading. Depth-1 only: we model observable
 *   behavior (success/duration), never another agent's beliefs,
 *   experience, or workspace state. "I know that you know" claims
 *   would be theater — this predicts outputs, not minds.
 * - Not an intervention. Output is advisory: surfaced via summary()
 *   for status endpoints. Nothing routes or vetoes on it yet.
 *
 * Honest correlates: `tomPredictionAccuracy` can be measured by
 * logging predicted successProb vs actual terminal status.
 */

import { AgentOutcomeModel, AGENT_MODEL_INPUT_DIM } from './agent-model';

interface ObservedTask {
  agentId: string;
  kind: string;
  status: string;
  durationMs?: number;
  finishedAt?: number;
  createdAt?: number;
}

interface AgentHistory {
  recent: { success: boolean; durationNorm: number; at: number; kind: string; status: string }[];
  total: number;
}

const HISTORY_WINDOW = 20;
const FEATURE_NOW = () => Date.now();

export class SocialToMLayer {
  private models = new Map<string, AgentOutcomeModel>();
  private histories = new Map<string, AgentHistory>();
  private persistDir: string | null | undefined;
  /** Prediction log for tomPredictionAccuracy measurement: last N
   *  {agentId, predicted, actual} pairs. */
  private predictionLog: { agentId: string; predicted: number; actual: number; at: number }[] = [];

  constructor(persistDir?: string | null) {
    this.persistDir = persistDir === undefined
      ? undefined
      : persistDir;
  }

  private modelFor(agentId: string): AgentOutcomeModel {
    let m = this.models.get(agentId);
    if (!m) {
      m = new AgentOutcomeModel(agentId, this.persistDir === undefined ? undefined : this.persistDir);
      this.models.set(agentId, m);
    }
    return m;
  }

  private historyFor(agentId: string): AgentHistory {
    let h = this.histories.get(agentId);
    if (!h) {
      h = { recent: [], total: 0 };
      this.histories.set(agentId, h);
    }
    return h;
  }

  /** Feature vector from the agent's rolling history — computed BEFORE
   *  the current task is appended, so it describes the prior state. */
  private features(agentId: string, kind: string, now: number): number[] {
    const h = this.historyFor(agentId);
    const rec = h.recent;
    const n = rec.length;
    const last10 = rec.slice(-10);
    const successRate = n ? last10.filter((r) => r.success).length / Math.max(1, last10.length) : 0.5;
    const failRate = 1 - successRate;
    const hour = 3600_000;
    const lastHour = rec.filter((r) => now - r.at < hour).length;
    const durMean = n ? rec.reduce((s, r) => s + r.durationNorm, 0) / n : 0.5;
    const prev = rec[rec.length - 1];
    const isRepeatKind = prev && prev.kind === kind ? 1 : 0;
    // consecutive same-status streak
    let streak = 0;
    for (let i = rec.length - 1; i >= 0; i--) {
      if (rec[i].success === (rec[rec.length - 1]?.success ?? true)) streak++;
      else break;
    }
    const hoursSince = prev ? Math.min(24, (now - prev.at) / hour) : 24;
    const kindFreq = rec.filter((r) => r.kind === kind).length;
    return [
      successRate,
      failRate,
      Math.min(1, lastHour / 10),
      durMean,
      isRepeatKind,
      Math.min(1, streak / 5),
      Math.min(1, hoursSince / 24),
      Math.min(1, kindFreq / 20),
    ];
  }

  /** Observe one terminal task: update features→target and train. */
  observe(task: ObservedTask): void {
    const agentId = String(task.agentId || 'unknown');
    const kind = String(task.kind || 'unknown');
    const now = task.finishedAt ?? task.createdAt ?? FEATURE_NOW();
    const model = this.modelFor(agentId);
    const x = this.features(agentId, kind, now);

    const success = task.status === 'completed';
    const durationNorm = Math.max(0, Math.min(1, (task.durationMs ?? 0) / 300_000));
    const y = [success ? 1 : 0, durationNorm];

    // Log the prediction made BEFORE this outcome for accuracy tracking.
    if (model.isTrained) {
      const p = model.predict(x);
      this.predictionLog.push({ agentId, predicted: p.successProb, actual: y[0], at: now });
      if (this.predictionLog.length > 500) this.predictionLog.shift();
    }

    model.update(x, y);

    const h = this.historyFor(agentId);
    h.recent.push({ success, durationNorm, at: now, kind, status: task.status });
    h.total++;
    if (h.recent.length > HISTORY_WINDOW) h.recent.shift();
  }

  /** Predict the agent's next-task outcome. Returns null-ish priors
   *  (confidence 0) when the model is untrained — callers must check
   *  `trained` before trusting the numbers. */
  predict(agentId: string, kind?: string): {
    successProb: number; expectedDurationMs: number;
    confidence: number; updates: number; trained: boolean;
  } | null {
    const model = this.models.get(agentId);
    if (!model) return null;
    const now = FEATURE_NOW();
    const x = this.features(agentId, kind ?? '', now);
    const p = model.predict(x);
    return {
      successProb: p.successProb,
      expectedDurationMs: Math.round(p.durationNorm * 300_000),
      confidence: model.confidence,
      updates: model.updateCount,
      trained: model.isTrained,
    };
  }

  /** Replay historical terminal tasks (oldest→newest) to pretrain
   *  models — call once at boot with readArchive output. */
  bootstrap(tasks: ObservedTask[]): number {
    let n = 0;
    const sorted = [...tasks].sort((a, b) => (a.finishedAt ?? a.createdAt ?? 0) - (b.finishedAt ?? b.createdAt ?? 0));
    for (const t of sorted) { this.observe(t); n++; }
    return n;
  }

  /** tomPredictionAccuracy: mean |predicted - actual| over logged
   *  pre-outcome predictions (lower is better; 0.25 = coin-flip-ish). */
  predictionAccuracy(): { samples: number; mae: number | null } {
    if (!this.predictionLog.length) return { samples: 0, mae: null };
    const mae = this.predictionLog.reduce((s, r) => s + Math.abs(r.predicted - r.actual), 0) / this.predictionLog.length;
    return { samples: this.predictionLog.length, mae: Number(mae.toFixed(3)) };
  }

  /** Advisory summary for status endpoints — one row per modeled agent. */
  summary(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [agentId, model] of this.models) {
      const h = this.historyFor(agentId);
      const rec = h.recent;
      const last10 = rec.slice(-10);
      out[agentId] = {
        updates: model.updateCount,
        trained: model.isTrained,
        confidence: Number(model.confidence.toFixed(3)),
        observed: h.total,
        recentSuccessRate: rec.length ? Number((last10.filter((r) => r.success).length / Math.max(1, last10.length)).toFixed(3)) : null,
      };
    }
    const acc = this.predictionAccuracy();
    return { agents: out, accuracy: acc, modeledAgents: this.models.size };
  }

  flush(): void {
    for (const m of this.models.values()) m.flush();
  }
}
