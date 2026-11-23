/**
 * goal-pace-watch.ts — live pace watch on accepted forecast missions.
 *
 * When a goal_forecast proposal is ACCEPTED (with simulatedLevers
 * stamped), the signed-off trajectory becomes a promise. This watch
 * tracks ACTUAL verified ops completions against the simulated pace in
 * real time — and when actuals fall below the simulated trajectory by
 * more than the divergence threshold, it files a tier-2
 * 'goal_pace_divergence' proposal carrying the UPDATED forecast and a
 * re-simulate option. Alert + math only; nothing auto-executes.
 *
 * Model: expected completions by elapsed time under the accepted
 * levers — piecewise rate (sprint boost for sprintWeeks, then the
 * cadence rate), capped at remainingOps-at-acceptance. Divergence
 * fires when elapsed ≥ 7d, expected ≥ 1 completion, and
 * actual < expected × DIVERGENCE_RATIO. Cooldown: one card per goal
 * per 3 days. Watches expire after 21 days (a mission that old is a
 * new forecast's problem).
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadMission } from '../cortex-agents/mission';
import { syncProposals as ledgerSyncProposals } from '../cortex-initiative-ledger';
import { computeGoalForecasts } from './goal-forecast';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const STATE_PATH = path.join(RUNTIME, 'goal-pace-watch.json');
const DAY_MS = 86400_000;
const WATCH_TTL_MS = 21 * DAY_MS;
const MIN_ELAPSED_MS = 7 * DAY_MS;
const DIVERGENCE_RATIO = 0.6;
const COOLDOWN_MS = 3 * DAY_MS;

interface PaceWatch {
  goalId: string;
  goalTitle: string;
  proposalId: string;
  acceptedAt: number;
  levers: { weeklyRate?: number; descopeOps?: number; sprintBoostWeekly?: number; sprintWeeks?: number };
  baseWeeklyRate: number;
  remainingAtAccept: number;
  lastAlertAt: number;
}

interface PaceState { watches: Record<string, PaceWatch> }

function loadState(): PaceState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { watches: raw?.watches && typeof raw.watches === 'object' ? raw.watches : {} };
  } catch { return { watches: {} }; }
}
function saveState(s: PaceState): void {
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(STATE_PATH, JSON.stringify(s)); } catch {}
}

let notifier: ((msg: string) => void) | null = null;
export function setPaceWatchNotifier(fn: (msg: string) => void): void { notifier = fn; }

/** Expected completions under the accepted levers after `elapsedDays`. */
function expectedCompletions(w: PaceWatch, elapsedDays: number): number {
  const elapsedWeeks = elapsedDays / 7;
  const rate = Math.max(0.05, w.levers.weeklyRate ?? w.baseWeeklyRate);
  const boost = Math.max(0, w.levers.sprintBoostWeekly || 0);
  const sprintWeeks = Math.max(0, w.levers.sprintWeeks || 0);
  const capacity = sprintWeeks > 0 && boost > 0
    ? boostedCapacity(rate, boost, sprintWeeks, elapsedWeeks)
    : rate * elapsedWeeks;
  return Math.min(w.remainingAtAccept, capacity);
}

function boostedCapacity(rate: number, boost: number, sprintWeeks: number, elapsedWeeks: number): number {
  const sprintPart = Math.min(elapsedWeeks, sprintWeeks) * (rate + boost);
  const rest = Math.max(0, elapsedWeeks - sprintWeeks) * rate;
  return sprintPart + rest;
}

/** Sync watches from the ledger: latest accepted/executed forecast
 *  proposal per goal becomes (or refreshes) a watch. */
function syncWatches(nowMs: number): void {
  const state = loadState();
  let changed = false;
  try {
    const ledger = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'initiative-ledger.json'), 'utf8'));
    const proposals: any[] = Array.isArray(ledger?.proposals) ? ledger.proposals : [];
    for (const p of proposals) {
      const input = p?.suggestedArgs?.input;
      const fc = input?.forecastFor;
      if (!fc || !input?.goalId) continue;
      if (!['executed', 'approved'].includes(String(p.status))) continue;
      const acceptedAt = Number(p?.executionResult?.atMs || p?.approvedAtMs || p?.updatedAtMs || p?.createdAtMs || 0);
      if (!acceptedAt || nowMs - acceptedAt > WATCH_TTL_MS) continue;
      const goalId = String(input.goalId);
      const existing = state.watches[goalId];
      // Only track the LATEST acceptance; an older watch is superseded.
      if (existing && existing.acceptedAt >= acceptedAt) continue;
      const levers = (input.simulatedLevers || {}) as PaceWatch['levers'];
      state.watches[goalId] = {
        goalId,
        goalTitle: String(fc.goalTitle || input.title || goalId),
        proposalId: String(p.id),
        acceptedAt,
        levers,
        baseWeeklyRate: Number(fc.weeklyRate || 0.5),
        remainingAtAccept: Number(fc.remainingOps || 0),
        lastAlertAt: 0,
      };
      changed = true;
    }
  } catch {}
  if (changed) saveState(state);
}

/** Actual verified completions for a goal since a timestamp. */
function completionsSince(goalId: string, sinceMs: number): { actual: number; doneAtAcceptBaseline: number } {
  const mission = loadMission();
  const ops = (mission.opsItems || []).filter((o: any) => o.goalId === goalId && o.done);
  const after = ops.filter((o: any) => Number(o.verifiedAt || 0) > sinceMs).length;
  const atAccept = ops.filter((o: any) => Number(o.verifiedAt || 0) <= sinceMs).length;
  return { actual: after, doneAtAcceptBaseline: atAccept };
}

/**
 * Watch pass: for each active watch, compare actual vs expected. On
 * divergence past cooldown, file ONE tier-2 proposal with the updated
 * forecast (re-simulate baseline). Returns counts.
 */
export function runPaceWatchCheck(nowMs: number = Date.now()): { watches: number; diverged: number } {
  syncWatches(nowMs);
  const state = loadState();
  const forecasts = computeGoalForecasts(nowMs);
  const forecastByGoal = new Map(forecasts.map((f) => [f.goalId, f]));
  let diverged = 0;
  let changed = false;

  for (const [goalId, w] of Object.entries(state.watches)) {
    const elapsedMs = nowMs - w.acceptedAt;
    if (elapsedMs > WATCH_TTL_MS) { delete state.watches[goalId]; changed = true; continue; }
    if (elapsedMs < MIN_ELAPSED_MS) continue;
    if (nowMs - w.lastAlertAt < COOLDOWN_MS) continue;

    const { actual } = completionsSince(goalId, w.acceptedAt);
    const expected = expectedCompletions(w, elapsedMs / DAY_MS);
    if (expected < 1) continue; // nothing measurable yet
    if (actual >= expected * DIVERGENCE_RATIO) continue; // on pace

    diverged++;
    w.lastAlertAt = nowMs;
    changed = true;

    const pct = Math.round((actual / expected) * 100);
    const fc = forecastByGoal.get(goalId);
    const updatedP = fc?.probability != null ? `${Math.round(fc.probability * 100)}%` : 'unknown';
    const eta = fc?.projectedFinish || 'unknown';

    try {
      ledgerSyncProposals([{
        id: `goalpace:${w.goalId}:${new Date(nowMs).toISOString().slice(0, 10)}`,
        title: `Pace divergence: "${w.goalTitle.slice(0, 50)}" at ${pct}% of simulated trajectory`,
        description: [
          `Accepted ${new Date(w.acceptedAt).toISOString().slice(0, 10)} with levers ${JSON.stringify(w.levers)}.`,
          `${Math.floor(elapsedMs / DAY_MS)}d elapsed: actual ${actual} ops completed vs ${Math.round(expected * 10) / 10} expected under the simulated pace (${pct}% of trajectory).`,
          `Updated forecast: P(hit target) = ${updatedP}, ETA ${eta}${fc ? `, ${fc.remainingOps} ops remain at ${fc.weeklyRate}/wk` : ''}.`,
          `Re-simulate below to test recovery levers; accept dispatches a corrective orchestration, veto logs the divergence.`,
        ].join(' '),
        category: 'goal_pace_divergence',
        urgency: 'high',
        confidence: 0.85,
        rationale: `actual completions ${actual} < ${DIVERGENCE_RATIO * 100}% of simulated expectation ${Math.round(expected * 10) / 10} — signed-off trajectory not holding`,
        suggestedTool: 'cortex_agents',
        suggestedArgs: {
          action: 'task',
          agentId: 'antigravity',
          kind: 'orchestrate',
          title: `Pace corrective: "${w.goalTitle.slice(0, 55)}" diverging from accepted trajectory`,
          input: {
            goalId: w.goalId,
            notifyOnFinish: true,
            paceDivergenceFor: {
              proposalId: w.proposalId,
              acceptedAt: w.acceptedAt,
              actual, expected: Math.round(expected * 10) / 10,
              elapsedDays: Math.floor(elapsedMs / DAY_MS),
              levers: w.levers,
            },
            forecastFor: fc ? {
              probability: fc.probability, targetDate: fc.targetDate,
              projectedFinish: fc.projectedFinish, remainingOps: fc.remainingOps,
              weeklyRate: fc.weeklyRate, requiredWeekly: fc.requiredWeekly,
              paceRatio: fc.paceRatio, daysLeft: fc.daysLeft,
            } : undefined,
            instruction: [
              `Goal "${w.goalTitle}" is diverging from its accepted forecast trajectory.`,
              `${Math.floor(elapsedMs / DAY_MS)}d after acceptance: ${actual} ops completed vs ${Math.round(expected * 10) / 10} simulated-pace expectation.`,
              `Updated forecast: P=${updatedP}, ETA=${eta}.`,
              `Mission: diagnose the bottleneck (blocked ops? capacity? scope creep?) and apply ONE corrective — unblock, re-sequence, or record explicit descope.`,
              `Done criteria: completion rate recovers toward the simulated pace this week, or a descope decision is recorded.`,
            ].join(' '),
          },
        },
        requiresApproval: true,
        autonomyTier: 2,
        source: 'goal-pace-watch',
        dedupeKey: `goalpace:${w.goalId}:${new Date(nowMs).toISOString().slice(0, 10)}`,
        createdAtMs: nowMs,
      }]);
      try { notifier?.(`📉 Pace divergence on "${w.goalTitle.slice(0, 45)}": ${actual}/${Math.round(expected)} expected ops — updated forecast ${updatedP}, re-simulate ready in the Inbox.`); } catch {}
    } catch {}
  }

  if (changed) saveState(state);
  return { watches: Object.keys(state.watches).length, diverged };
}

export interface PaceWatchSummary {
  goalId: string; proposalId: string; acceptedAt: number;
  elapsedDays: number; actual: number; expected: number;
  ratio: number | null; // actual/expected; null when not yet measurable
  onPace: boolean;
}

/** Live per-goal pace telemetry for dashboards — the "see divergence
 *  the moment it happens" readout. Computed fresh each call. */
export function getPaceWatchSummaries(nowMs: number = Date.now()): PaceWatchSummary[] {
  syncWatches(nowMs);
  const state = loadState();
  const out: PaceWatchSummary[] = [];
  for (const w of Object.values(state.watches)) {
    const elapsedMs = nowMs - w.acceptedAt;
    if (elapsedMs > WATCH_TTL_MS) continue;
    const { actual } = completionsSince(w.goalId, w.acceptedAt);
    const expected = elapsedMs >= MIN_ELAPSED_MS ? expectedCompletions(w, elapsedMs / DAY_MS) : 0;
    const measurable = expected >= 1;
    const ratio = measurable ? Math.round((actual / expected) * 100) / 100 : null;
    out.push({
      goalId: w.goalId, proposalId: w.proposalId, acceptedAt: w.acceptedAt,
      elapsedDays: Math.floor(elapsedMs / DAY_MS),
      actual, expected: Math.round(expected * 10) / 10,
      ratio, onPace: !measurable || actual >= expected * DIVERGENCE_RATIO,
    });
  }
  return out;
}

// ── Event-driven acceleration ──────────────────────────────────────
// The 10-min interval is the fallback; ops verifications and agent
// task completions trigger an immediate (debounced) check so
// divergence surfaces in seconds, not on the next tick.
let lastEventCheck = 0;
const EVENT_MIN_INTERVAL_MS = 30_000;
export function notifyPaceRelevantEvent(): void {
  const now = Date.now();
  if (now - lastEventCheck < EVENT_MIN_INTERVAL_MS) return;
  lastEventCheck = now;
  try { runPaceWatchCheck(now); } catch {}
}

/** Arm the pace watch: check now, then every 10min. */
export function startGoalPaceWatch(): void {
  const g = globalThis as any;
  if (g.__cortexGoalPaceWatch) return;
  try { runPaceWatchCheck(); } catch {}
  const timer = setInterval(() => { try { runPaceWatchCheck(); } catch {} }, 600_000);
  if (typeof timer === 'object' && timer && 'unref' in timer) (timer as any).unref();
  g.__cortexGoalPaceWatch = timer;
}
