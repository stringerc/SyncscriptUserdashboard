/**
 * goal-forecast.ts — trajectory projection layer on top of the dashboard.
 *
 * "Here's where we're headed if nothing changes." For each active goal
 * with a targetDate, estimate the probability of hitting it at current
 * pace — BEFORE drift fires — and file a governed initiative proposal
 * when the forecast turns sour.
 *
 * Model (deliberately simple and honest):
 *   - Work remaining R = open mission ops items linked to the goal.
 *   - Completion rate λ = verified ops completions per week, measured
 *     over the trailing 28d (fallback: all-time rate since declaredAt,
 *     discounted). Goals with <2 lifetime completions are 'insufficient-
 *     data' — no probability is fabricated.
 *   - Time-to-finish T ~ Gamma(R, λ) (sum of R exponential waits).
 *     P(T ≤ weeksLeft) via the normal approximation to the gamma —
 *     defensible at R≥2, flagged as approximate. Variance is inflated
 *     when λ rests on few observations.
 *   - Goals without linked ops have no measurable work-remaining
 *     denominator → 'insufficient-data', never a guessed number.
 *
 * Proposals: p < 0.5 → tier-2 initiative proposal (requiresApproval)
 * routed to Antigravity orchestration with the concrete bottleneck math
 * (required vs actual weekly cadence) and suggested corrective levers.
 * Dedupe: one per goal per ISO week. Nothing auto-executes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getCortexGoals, type LifeGoal } from '../cortex-goals';
import { loadMission } from '../cortex-agents/mission';
import { syncProposals as ledgerSyncProposals } from '../cortex-initiative-ledger';
import { collectEffortEvents } from './goal-drift';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const STATE_PATH = path.join(RUNTIME, 'goal-forecast-state.json');
const DAY_MS = 86400_000;
const WEEK_MS = 7 * DAY_MS;
const PROPOSAL_THRESHOLD = 0.5;
const MIN_LIFETIME_COMPLETIONS = 2;

export interface GoalForecast {
  goalId: string;
  goalTitle: string;
  targetDate: string | null;
  daysLeft: number | null;
  /** null = insufficient data to forecast honestly */
  probability: number | null;
  basis: 'ops-gamma' | 'insufficient-data' | 'no-target' | 'complete';
  remainingOps: number;
  weeklyRate: number;      // observed completions/week (λ)
  requiredWeekly: number;  // completions/week needed to finish in time
  paceRatio: number | null;
  projectedFinish: string | null;
  observations: number;    // completions in the 28d measurement window
  momentum: 'up' | 'flat' | 'down' | null; // effort trend last 7d vs prior 21d
}

interface ForecastState { lastProposalWeek: Record<string, string> }

function loadState(): ForecastState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { lastProposalWeek: raw?.lastProposalWeek || {} };
  } catch { return { lastProposalWeek: {} }; }
}
function saveState(s: ForecastState): void {
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(STATE_PATH, JSON.stringify(s)); } catch {}
}

function isoWeek(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return `${date.getUTCFullYear()}-W${String(Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)).padStart(2, '0')}`;
}

/** Standard normal CDF via erf approximation (Abramowitz-Stegun 7.1.26). */
function phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Effort momentum: mean daily attributed events, last 7d vs prior 21d. */
function effortMomentum(goalId: string, nowMs: number): GoalForecast['momentum'] {
  const events = collectEffortEvents(nowMs - 28 * DAY_MS).filter((e) => e.goalId === goalId);
  const recent = events.filter((e) => e.ts >= nowMs - 7 * DAY_MS).length / 7;
  const prior = events.filter((e) => e.ts < nowMs - 7 * DAY_MS).length / 21;
  if (recent > prior * 1.25 && recent > 0.05) return 'up';
  if (recent < prior * 0.75 && prior > 0.05) return 'down';
  return 'flat';
}

/**
 * Compute the forecast for every active goal with a targetDate.
 * Pure read — the watch decides whether to propose.
 */
export function computeGoalForecasts(nowMs: number = Date.now()): GoalForecast[] {
  const goalsEngine = getCortexGoals();
  const activeGoals = goalsEngine.list('active').filter((g) => g.targetDate);
  if (!activeGoals.length) return [];

  const mission = loadMission();
  const opsItems: any[] = mission.opsItems || [];
  const windowStart = nowMs - 28 * DAY_MS;

  const out: GoalForecast[] = [];
  for (const g of activeGoals) {
    const targetTs = g.targetDate!;
    const daysLeft = Math.max(0, (targetTs - nowMs) / DAY_MS);
    const weeksLeft = daysLeft / 7;
    const base: GoalForecast = {
      goalId: g.id, goalTitle: g.title,
      targetDate: new Date(targetTs).toISOString().slice(0, 10),
      daysLeft: Math.round(daysLeft),
      probability: null, basis: 'insufficient-data',
      remainingOps: 0, weeklyRate: 0, requiredWeekly: 0,
      paceRatio: null, projectedFinish: null, observations: 0,
      momentum: effortMomentum(g.id, nowMs),
    };
    if (daysLeft <= 0) { base.basis = 'no-target'; out.push(base); continue; }

    const linked = opsItems.filter((o: any) => o.goalId === g.id);
    const doneOps = linked.filter((o: any) => o.done);
    const remainingOps = linked.length - doneOps.length;
    base.remainingOps = remainingOps;
    if (remainingOps === 0 && linked.length > 0) {
      base.basis = 'complete'; base.probability = 1; out.push(base); continue;
    }
    if (!linked.length) { out.push(base); continue; } // no measurable denominator

    // λ: completions in trailing 28d; fallback all-time rate since declaredAt
    // (discounted 50% — stale rate, honest uncertainty).
    const recentCompletions = doneOps.filter((o: any) => Number(o.verifiedAt || 0) >= windowStart).length;
    const lifetimeCompletions = doneOps.length;
    const ageWeeks = Math.max(1, (nowMs - g.declaredAt) / WEEK_MS);
    let lambda = recentCompletions / 4;
    if (lambda <= 0 && lifetimeCompletions >= MIN_LIFETIME_COMPLETIONS) {
      lambda = (lifetimeCompletions / ageWeeks) * 0.5;
    }
    if (lifetimeCompletions < MIN_LIFETIME_COMPLETIONS || lambda <= 0) {
      out.push(base); continue; // honest: not enough history to forecast
    }

    const requiredWeekly = remainingOps / Math.max(weeksLeft, 0.25);
    base.weeklyRate = Math.round(lambda * 10) / 10;
    base.requiredWeekly = Math.round(requiredWeekly * 10) / 10;
    base.paceRatio = Math.round((lambda / requiredWeekly) * 100) / 100;

    // P(finish ≤ weeksLeft): T ~ Gamma(R, λ) → Normal(μ=R/λ, σ=√R/λ),
    // variance inflated ×(1 + 2/n) when n is small.
    const n = recentCompletions || lifetimeCompletions;
    const mu = remainingOps / lambda;
    const sigma = (Math.sqrt(remainingOps) / lambda) * Math.sqrt(1 + 2 / Math.max(n, 1));
    const z = (weeksLeft - mu) / sigma;
    let p = phi(z);
    // Projected finish date at current λ.
    base.projectedFinish = new Date(nowMs + mu * WEEK_MS).toISOString().slice(0, 10);
    base.probability = Math.round(Math.min(0.98, Math.max(0.02, p)) * 100) / 100;
    base.basis = 'ops-gamma';
    base.observations = n;
    out.push(base);
  }
  return out;
}

let notifier: ((msg: string) => void) | null = null;
export function setForecastNotifier(fn: (msg: string) => void): void { notifier = fn; }

/**
 * Watch pass: compute forecasts; for any goal with p < threshold and a
 * target in the future, file ONE governed proposal per ISO week.
 * Routed to Antigravity (orchestration is the lever: cadence, parallel
 * dispatch, or explicit descope). Returns counts for observability.
 */
export function runGoalForecastCheck(nowMs: number = Date.now()): { evaluated: number; proposed: number } {
  const forecasts = computeGoalForecasts(nowMs);
  const state = loadState();
  const week = isoWeek();
  let proposed = 0;
  let changed = false;

  for (const f of forecasts) {
    if (f.probability == null || f.probability >= PROPOSAL_THRESHOLD) continue;
    if (f.daysLeft == null || f.daysLeft <= 0) continue;
    if (state.lastProposalWeek[f.goalId] === week) continue;
    state.lastProposalWeek[f.goalId] = week;
    changed = true;
    proposed++;

    const pct = Math.round(f.probability * 100);
    const momentumNote = f.momentum === 'down' ? ' Effort momentum is DECLINING (last 7d vs prior 21d).' : f.momentum === 'up' ? ' Effort momentum is rising.' : '';
    const levers = [
      f.requiredWeekly > (f.weeklyRate || 0) * 1.5
        ? `Increase weekly ops cadence from ~${f.weeklyRate}/wk to ~${Math.ceil(f.requiredWeekly)}/wk`
        : null,
      `Parallelize remaining ops via an orchestrated agent sprint (Antigravity decomposes; Devin/Scout execute)`,
      `Explicit descope: reduce remaining ops from ${f.remainingOps} by cutting or merging low-value items`,
    ].filter(Boolean).join('; ');

    try {
      ledgerSyncProposals([{
        id: `goalfc:${f.goalId}:${week}`,
        title: `Forecast: ${pct}% chance "${f.goalTitle.slice(0, 50)}" hits ${f.targetDate}`,
        description: [
          `Trajectory projection: ${f.remainingOps} ops remain, current pace ${f.weeklyRate}/wk vs required ${f.requiredWeekly}/wk (pace ratio ${f.paceRatio}×).`,
          `Projected finish at current pace: ${f.projectedFinish} — target ${f.targetDate} (${f.daysLeft}d left). Probability of hitting target: ${pct}%.`,
          `Basis: ${f.basis}, ${f.observations} completion observations.${momentumNote}`,
          `Suggested levers: ${levers}.`,
          `Accept dispatches an orchestration mission to accelerate or descope; veto means the forecast is accepted risk.`,
        ].join(' '),
        category: 'goal_forecast',
        urgency: f.probability < 0.25 ? 'high' : 'medium',
        confidence: Math.min(0.9, 0.4 + f.observations * 0.05),
        rationale: `forecast probability ${pct}% < ${Math.round(PROPOSAL_THRESHOLD * 100)}% threshold — pre-emptive correction before drift fires`,
        suggestedTool: 'cortex_agents',
        suggestedArgs: {
          action: 'task',
          agentId: 'antigravity',
          kind: 'orchestrate',
          title: `Forecast corrective: "${f.goalTitle.slice(0, 60)}" at ${pct}%`,
          input: {
            goalId: f.goalId,
            notifyOnFinish: true,
            forecastFor: { probability: f.probability, targetDate: f.targetDate, projectedFinish: f.projectedFinish },
            instruction: [
              `Forecast says goal "${f.goalTitle}" has only ${pct}% probability of hitting ${f.targetDate} at current pace.`,
              `Math: ${f.remainingOps} ops remain, pace ${f.weeklyRate}/wk vs required ${f.requiredWeekly}/wk.`,
              `Mission: choose and execute ONE corrective lever — increase cadence, parallelize via agent sprint, or record an explicit descope decision.`,
              `Done criteria: ops completion rate measurably increases this week, OR a descope decision is recorded in episodic memory.`,
            ].join(' '),
          },
        },
        requiresApproval: true,
        autonomyTier: 2,
        source: 'goal-forecast',
        dedupeKey: `goalfc:${f.goalId}:${week}`,
        createdAtMs: nowMs,
      }]);
      try { notifier?.(`📉 Forecast alert: "${f.goalTitle.slice(0, 45)}" has ${pct}% chance of hitting ${f.targetDate} — corrective proposal filed.`); } catch {}
    } catch {}
  }

  if (changed) saveState(state);
  return { evaluated: forecasts.length, proposed };
}

/** Arm the forecast watch: check now, then every 10min. */
export function startGoalForecastWatch(): void {
  const g = globalThis as any;
  if (g.__cortexGoalForecast) return;
  try { runGoalForecastCheck(); } catch {}
  const timer = setInterval(() => { try { runGoalForecastCheck(); } catch {} }, 600_000);
  if (typeof timer === 'object' && timer && 'unref' in timer) (timer as any).unref();
  g.__cortexGoalForecast = timer;
}
