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
import { applyCalibration, logForecastClaim, resolveForecastOutcomes } from './goal-calibration';
import { getInteroceptiveState } from './interoceptive';

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
  rawProbability?: number; // pre-calibration estimate
  calibrated?: boolean;    // whether calibration data influenced this
  calibrationN?: number;   // resolved outcomes behind the correction
  capacityFactor?: number; // host interoceptive capacity 0..1 at compute time
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

/** Observed weekly completion rate λ for a goal (28d window, discounted
 *  all-time fallback). Returns { lambda, observations } or null when there
 *  isn't enough history to forecast honestly. */
function baseWeeklyRate(g: LifeGoal, doneOps: any[], nowMs: number): { lambda: number; observations: number } | null {
  const windowStart = nowMs - 28 * DAY_MS;
  const recentCompletions = doneOps.filter((o: any) => Number(o.verifiedAt || 0) >= windowStart).length;
  const lifetimeCompletions = doneOps.length;
  const ageWeeks = Math.max(1, (nowMs - g.declaredAt) / WEEK_MS);
  let lambda = recentCompletions / 4;
  if (lambda <= 0 && lifetimeCompletions >= MIN_LIFETIME_COMPLETIONS) {
    lambda = (lifetimeCompletions / ageWeeks) * 0.5;
  }
  if (lifetimeCompletions < MIN_LIFETIME_COMPLETIONS || lambda <= 0) return null;
  return { lambda, observations: recentCompletions || lifetimeCompletions };
}

export interface ForecastLevers {
  /** Override weekly completions rate (cadence lever). */
  weeklyRate?: number;
  /** Ops removed from remaining (descope lever). */
  descopeOps?: number;
  /** Temporary rate boost ops/week for the first N weeks (parallel sprint). */
  sprintBoostWeekly?: number;
  sprintWeeks?: number;
}

/**
 * Project P(finish ≤ weeksLeft) for arbitrary remaining work / rate,
 * optionally with a temporary sprint boost for the first `sprintWeeks`.
 * Gamma→Normal approximation, same honesty gates as the base forecast.
 */
function projectHit(remainingOps: number, weeklyRate: number, weeksLeft: number, observations: number, sprintBoostWeekly = 0, sprintWeeks = 0): { probability: number; finishWeeks: number } {
  const n = Math.max(observations, 1);
  const inflate = Math.sqrt(1 + 2 / n);
  if (sprintBoostWeekly > 0 && sprintWeeks > 0 && weeksLeft > 0) {
    const boosted = weeklyRate + sprintBoostWeekly;
    const sprintCapacity = boosted * Math.min(sprintWeeks, weeksLeft);
    if (remainingOps <= sprintCapacity) {
      // Finishes inside the sprint window — compress the clock.
      const effWeeks = remainingOps / boosted;
      const sigma = (Math.sqrt(Math.max(remainingOps, 1)) / boosted) * inflate;
      const z = (Math.min(weeksLeft, effWeeks * 2) - effWeeks) / Math.max(sigma, 0.05);
      return { probability: Math.round(Math.min(0.98, Math.max(0.02, phi(z))) * 100) / 100, finishWeeks: effWeeks };
    }
    // Sprint completes sprintCapacity ops; remainder at base rate.
    const rest = remainingOps - sprintCapacity;
    const mu = Math.min(sprintWeeks, weeksLeft) + rest / weeklyRate;
    const sigma = (Math.sqrt(rest) / weeklyRate) * inflate;
    const z = (weeksLeft - mu) / Math.max(sigma, 0.05);
    return { probability: Math.round(Math.min(0.98, Math.max(0.02, phi(z))) * 100) / 100, finishWeeks: mu };
  }
  const mu = remainingOps / weeklyRate;
  const sigma = (Math.sqrt(remainingOps) / weeklyRate) * inflate;
  const z = (weeksLeft - mu) / Math.max(sigma, 0.05);
  return { probability: Math.round(Math.min(0.98, Math.max(0.02, phi(z))) * 100) / 100, finishWeeks: mu };
}

export interface PortfolioGoalImpact { goalId: string; title: string; shareBefore: number; shareAfter: number }
export interface PortfolioImpact {
  effortBudgetDaily: number;   // host effort events/day (7d avg, all sources)
  leverCostDaily: number;      // extra effort/day demanded by the levers
  goals: PortfolioGoalImpact[]; // OTHER active goals' effort shares
}

/**
 * Cross-goal contention: a cadence/sprint lever on one goal spends from
 * the shared effort pool. Estimate the daily effort cost (extra ops/week
 * × observed effort-per-completion) and show how every OTHER active
 * goal's effort share shrinks when the pool is reallocated proportionally.
 * Honest simplification: proportional draw, unattributed effort absorbs
 * first-order slack — shares are indicative, not accounting.
 */
export function portfolioImpactFor(goalId: string, extraWeeklyOps: number, nowMs: number = Date.now()): PortfolioImpact {
  const events = collectEffortEvents(nowMs - 7 * DAY_MS);
  const perGoal = new Map<string, number>();
  let total = 0;
  for (const e of events) { total++; if (e.goalId) perGoal.set(e.goalId, (perGoal.get(e.goalId) || 0) + 1); }
  const budgetDaily = total / 7;
  const goalEvents = perGoal.get(goalId) || 0;
  // effort-per-completion for THIS goal: attributed events / verified ops
  // completed in window; fallback 25 events/op (observed fleet average-ish).
  const mission = loadMission();
  const doneOps = (mission.opsItems || []).filter((o: any) => o.goalId === goalId && o.done && Number(o.verifiedAt || 0) >= nowMs - 28 * DAY_MS);
  const eventsPerOp = doneOps.length ? Math.max(5, goalEvents / Math.max(doneOps.length, 1)) : 25;
  // Strained host → the same lever costs more real capacity; floor at 0.3
  // so a critical reading doesn't make the cost infinite (it's a model).
  const capacity = Math.max(0.3, getInteroceptiveState(nowMs).capacity);
  const leverCostDaily = (Math.max(0, extraWeeklyOps) * eventsPerOp / 7) / capacity;
  const scale = budgetDaily > 0 ? Math.max(0, (budgetDaily - leverCostDaily) / budgetDaily) : 1;
  const goals = getCortexGoals().list('active')
    .filter((g) => g.id !== goalId)
    .map((g) => {
      const before = total > 0 ? (perGoal.get(g.id) || 0) / total : 0;
      return {
        goalId: g.id, title: g.title,
        shareBefore: Math.round(before * 10000) / 100,
        shareAfter: Math.round(before * scale * 10000) / 100,
      };
    });
  return { effortBudgetDaily: Math.round(budgetDaily * 10) / 10, leverCostDaily: Math.round(leverCostDaily * 10) / 10, goals };
}

/**
 * What-if simulator: recompute a goal's forecast under lever overrides.
 * Same model as computeGoalForecasts — this is the cockpit math, not a
 * second model. Returns null when the goal can't be forecast honestly.
 */
export function simulateGoalForecast(goalId: string, levers: ForecastLevers, nowMs: number = Date.now()): (GoalForecast & { levers: ForecastLevers; portfolioImpact?: PortfolioImpact }) | null {
  const g = getCortexGoals().get(goalId);
  if (!g || !g.targetDate) return null;
  const mission = loadMission();
  const linked = (mission.opsItems || []).filter((o: any) => o.goalId === goalId);
  const doneOps = linked.filter((o: any) => o.done);
  const base = baseWeeklyRate(g, doneOps, nowMs);
  const remainingOps = Math.max(0, linked.length - doneOps.length - Math.max(0, levers.descopeOps || 0));
  const daysLeft = Math.max(0, (g.targetDate - nowMs) / DAY_MS);
  const weeksLeft = daysLeft / 7;
  const out: GoalForecast & { levers: ForecastLevers; portfolioImpact?: PortfolioImpact } = {
    goalId, goalTitle: g.title,
    targetDate: new Date(g.targetDate).toISOString().slice(0, 10),
    daysLeft: Math.round(daysLeft),
    probability: null, basis: 'insufficient-data',
    remainingOps, weeklyRate: 0, requiredWeekly: 0,
    paceRatio: null, projectedFinish: null, observations: base?.observations || 0,
    momentum: effortMomentum(goalId, nowMs),
    capacityFactor: getInteroceptiveState(nowMs).capacity,
    levers,
  };
  if (daysLeft <= 0) { out.basis = 'no-target'; return out; }
  if (remainingOps === 0) { out.basis = 'complete'; out.probability = 1; return out; }
  if (!linked.length || !base) return out;

  const lambda = Math.max(0.05, levers.weeklyRate ?? base.lambda);
  out.weeklyRate = Math.round(lambda * 10) / 10;
  out.requiredWeekly = Math.round((remainingOps / Math.max(weeksLeft, 0.25)) * 10) / 10;
  out.paceRatio = Math.round((lambda / Math.max(out.requiredWeekly, 0.01)) * 100) / 100;
  const sprintBoost = Math.max(0, levers.sprintBoostWeekly || 0);
  const sprintWeeks = Math.max(0, levers.sprintWeeks || 0);
  const hit = projectHit(remainingOps, lambda, weeksLeft, base.observations, sprintBoost, sprintWeeks);
  const cal = applyCalibration(hit.probability);
  out.rawProbability = hit.probability;
  out.probability = cal.probability;
  out.calibrated = cal.calibrated;
  out.calibrationN = cal.n;
  out.projectedFinish = new Date(nowMs + hit.finishWeeks * WEEK_MS).toISOString().slice(0, 10);
  out.basis = 'ops-gamma';
  // Portfolio contention: extra weekly ops demanded vs the base rate,
  // plus sprint capacity — priced in shared effort units.
  const extraWeekly = Math.max(0, out.weeklyRate - base.lambda)
    + (sprintBoost > 0 ? (sprintBoost * Math.min(sprintWeeks, 4)) / 4 : 0);
  out.portfolioImpact = portfolioImpactFor(goalId, extraWeekly, nowMs);
  return out;
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
      capacityFactor: getInteroceptiveState(nowMs).capacity,
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
    const rawP = Math.round(Math.min(0.98, Math.max(0.02, p)) * 100) / 100;
    const cal = applyCalibration(rawP);
    base.rawProbability = rawP;
    base.probability = cal.probability;
    base.calibrated = cal.calibrated;
    base.calibrationN = cal.n;
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
  try { resolveForecastOutcomes(nowMs); } catch {}
  const forecasts = computeGoalForecasts(nowMs);
  for (const f of forecasts) {
    if (f.probability == null) continue;
    try {
      logForecastClaim({
        goalId: f.goalId, goalTitle: f.goalTitle, targetDate: f.targetDate || '',
        probability: f.probability, rawProbability: f.rawProbability,
        basis: f.basis, observations: f.observations, computedAt: nowMs,
      });
    } catch {}
  }
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
            forecastFor: { probability: f.probability, targetDate: f.targetDate, projectedFinish: f.projectedFinish, remainingOps: f.remainingOps, weeklyRate: f.weeklyRate, requiredWeekly: f.requiredWeekly, paceRatio: f.paceRatio, daysLeft: f.daysLeft },
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
