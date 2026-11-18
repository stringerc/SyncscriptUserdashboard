/**
 * cortex-goals.ts — Life-goal model, drift detection, and baseline forecasting.
 *
 * Cortex holds a model of what the user is *becoming*, not just what they're
 * doing. Goals are declarable by voice ("my goal this quarter is X"), persisted,
 * and never auto-modified — drift surfaces as tier-1 proposals only.
 *
 * Drift: each goal declares observable signal proxies (e.g. 'commits_per_week').
 * A weekly review compares the trailing window against the goal's own baseline
 * history. driftScore > 0.6 for 2 consecutive weeks → initiative proposal.
 *
 * Forecasting v1: frequency tables over the user's own recorded outcomes —
 * "you skip gym Thursdays 70% of the time (n=14)". No ML; honest sample sizes.
 */

import { persistentStore } from './persistent-store';
import { getCortexProactiveInitiative } from './cortex-proactive-initiative';

export type GoalHorizon = 'week' | 'month' | 'quarter' | 'year' | 'life';
export type GoalStatus = 'active' | 'paused' | 'achieved' | 'abandoned';

export interface GoalSignalPoint {
  period: string; // e.g. '2026-W47'
  values: Record<string, number>;
}

export interface LifeGoal {
  id: string;
  title: string;
  horizon: GoalHorizon;
  status: GoalStatus;
  declaredAt: number;
  targetDate?: number;
  /** Observable proxy metric names, e.g. 'commits_per_week', 'calls_made'. */
  signals: string[];
  history: GoalSignalPoint[];
  driftScore?: number;
  driftWeeks?: number;
  lastReviewAt?: number;
  /** Venture scope (enterprise spec) — absent = fleet/personal. */
  ventureId?: string;
}

export interface PatternRecord {
  key: string;          // e.g. 'weekday:thu:gym'
  occurred: number;     // times the predicted-bad outcome happened
  total: number;        // times the pattern was observed
}

interface GoalsState {
  goals: LifeGoal[];
  patterns: Record<string, PatternRecord>;
  lastWeeklyReviewAt: number;
}

const STORAGE_KEY = 'cortex:goals:v1';
const DRIFT_THRESHOLD = 0.6;
const DRIFT_WEEKS_REQUIRED = 2;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_FORECAST_SAMPLES = 8;
const MAX_HISTORY_POINTS = 52;

function emptyState(): GoalsState {
  return { goals: [], patterns: {}, lastWeeklyReviewAt: 0 };
}

function isoWeek(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return `${date.getUTCFullYear()}-W${String(Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)).padStart(2, '0')}`;
}

export class CortexGoals {
  private state: GoalsState = emptyState();
  private listeners = new Set<() => void>();

  constructor() {
    try {
      const raw = persistentStore.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.state = {
          goals: Array.isArray(parsed?.goals) ? parsed.goals : [],
          patterns: parsed?.patterns && typeof parsed.patterns === 'object' ? parsed.patterns : {},
          lastWeeklyReviewAt: Number(parsed?.lastWeeklyReviewAt) || 0,
        };
      }
    } catch {}
  }

  public subscribe(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private notify(): void {
    for (const l of this.listeners) { try { l(); } catch {} }
  }

  private save(): void {
    try { persistentStore.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch {}
  }

  // ── Goal CRUD ────────────────────────────────────────────────────

  public declare(input: { title: string; horizon?: GoalHorizon; signals?: string[]; targetDate?: number; ventureId?: string }): LifeGoal {
    const title = input.title.trim();
    // Dedupe: accepting the same proposal twice must not spam duplicate goals.
    const existing = this.state.goals.find(g => g.status === 'active' && g.title === title);
    if (existing) return { ...existing };
    const goal: LifeGoal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      horizon: input.horizon ?? 'quarter',
      status: 'active',
      declaredAt: Date.now(),
      targetDate: input.targetDate,
      signals: input.signals ?? [],
      ventureId: input.ventureId || undefined,
      history: [],
      driftWeeks: 0,
    };
    this.state.goals.push(goal);
    this.save();
    this.notify();
    return { ...goal };
  }

  public setStatus(id: string, status: GoalStatus): boolean {
    const g = this.state.goals.find(x => x.id === id);
    if (!g) return false;
    g.status = status;
    if (status !== 'active') { g.driftScore = undefined; g.driftWeeks = 0; }
    this.save();
    this.notify();
    return true;
  }

  public list(status?: GoalStatus): LifeGoal[] {
    return this.state.goals
      .filter(g => !status || g.status === status)
      .map(g => ({ ...g }));
  }

  public get(id: string): LifeGoal | null {
    const g = this.state.goals.find(x => x.id === id);
    return g ? { ...g } : null;
  }

  /** Record a signal observation. `period` defaults to the current ISO week (backfill/test hook). */
  public recordSignal(goalId: string, values: Record<string, number>, period?: string): boolean {
    const g = this.state.goals.find(x => x.id === goalId);
    if (!g || g.status !== 'active') return false;
    const p = period ?? isoWeek();
    let point = g.history.find(h => h.period === p);
    if (!point) {
      point = { period: p, values: {} };
      g.history.push(point);
      if (g.history.length > MAX_HISTORY_POINTS) g.history.shift();
    }
    Object.assign(point.values, values);
    this.save();
    this.notify();
    return true;
  }

  // ── Drift detection ──────────────────────────────────────────────

  /**
   * driftScore in [0,1]: 0 = on baseline, 1 = fully drifted.
   * Compares current signal values against the goal's trailing baseline mean.
   * A signal counts as drifted when current < 40% of baseline (or baseline is
   * zero and current is zero while the goal expects activity — treated as
   * neutral, not drift, to avoid false positives on new goals).
   */
  public computeDrift(goal: LifeGoal, current: Record<string, number>): number {
    const activeSignals = goal.signals.filter(s => s in current);
    if (activeSignals.length === 0) return 0;
    let drifted = 0;
    for (const sig of activeSignals) {
      const histVals = goal.history
        .map(h => h.values[sig])
        .filter((v): v is number => typeof v === 'number');
      const baseline = histVals.length
        ? histVals.reduce((a, b) => a + b, 0) / histVals.length
        : null;
      const cur = current[sig];
      if (baseline === null) continue; // no baseline yet → neutral
      if (baseline <= 0) {
        if (cur <= 0) drifted += 1; // expected activity, none observed
        continue;
      }
      if (cur < baseline * 0.4) drifted += 1;
    }
    return drifted / activeSignals.length;
  }

  /**
   * Weekly review: updates driftScore/driftWeeks and emits an initiative
   * proposal when drift persists. `signalValues` maps signal name → current
   * period value (e.g. commits in last 7 days).
   */
  public reviewGoals(signalValues: Record<string, number> = {}): { reviewed: number; proposals: string[] } {
    const now = Date.now();
    if (now - this.state.lastWeeklyReviewAt < WEEK_MS - 60_000) {
      return { reviewed: 0, proposals: [] }; // weekly cadence gate
    }
    this.state.lastWeeklyReviewAt = now;

    const engine = getCortexProactiveInitiative();
    const proposals: string[] = [];
    for (const g of this.state.goals) {
      if (g.status !== 'active' || g.signals.length === 0) continue;
      g.lastReviewAt = now;
      const current: Record<string, number> = {};
      for (const s of g.signals) {
        if (s in signalValues) current[s] = signalValues[s];
      }
      const score = this.computeDrift(g, current);
      g.driftScore = Math.round(score * 100) / 100;
      if (score > DRIFT_THRESHOLD) {
        g.driftWeeks = (g.driftWeeks ?? 0) + 1;
      } else {
        g.driftWeeks = 0;
      }
      if ((g.driftWeeks ?? 0) >= DRIFT_WEEKS_REQUIRED) {
        const proposal = engine.submitProposal?.({
          category: 'system_resonance',
          title: `Drift from "${g.title}"`,
          summary: `Cortex's weekly review shows ${Math.round(score * 100)}% signal decay over ${g.driftWeeks} consecutive weeks. Recommit, restructure, or drop it?`,
          urgency: 'medium',
          suggestedTool: 'cortex_goals',
          suggestedArgs: { action: 'list', goalId: g.id },
          requiresApproval: false,
          autonomyTier: 1,
          source: 'sensor',
          dedupeKey: `goal_drift_${g.id}`,
          why: `goal.${g.id}.drift=${score.toFixed(2)} for ${g.driftWeeks}w; signals=${g.signals.join(',')}`,
          epistemicConfidence: 0.7,
        });
        if (proposal) proposals.push(proposal.id);
      }
    }
    this.save();
    this.notify();
    return { reviewed: this.state.goals.length, proposals };
  }

  // ── Baseline forecasting (frequency tables) ──────────────────────

  /** Record an observation for a recurring pattern. */
  public recordPattern(key: string, badOutcome: boolean): void {
    const p = this.state.patterns[key] ?? { key, occurred: 0, total: 0 };
    p.total += 1;
    if (badOutcome) p.occurred += 1;
    this.state.patterns[key] = p;
    this.save();
    this.notify();
  }

  /**
   * Forecast skip/failure rate for a pattern.
   * Returns null until MIN_FORECAST_SAMPLES observations exist.
   */
  public forecast(key: string): { rate: number; samples: number; key: string } | null {
    const p = this.state.patterns[key];
    if (!p || p.total < MIN_FORECAST_SAMPLES) return null;
    return { rate: p.occurred / p.total, samples: p.total, key };
  }

  public listPatterns(): PatternRecord[] {
    return Object.values(this.state.patterns).map(p => ({ ...p }));
  }

  /** Test/reset hook — wipes goals, patterns, and review cadence. */
  public clear(): void {
    this.state = emptyState();
    this.save();
    this.notify();
  }
}

let globalGoals: CortexGoals | null = null;

export function getCortexGoals(): CortexGoals {
  if (!globalGoals) globalGoals = new CortexGoals();
  return globalGoals;
}
