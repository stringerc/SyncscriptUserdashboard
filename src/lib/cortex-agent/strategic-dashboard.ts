/**
 * strategic-dashboard.ts — live Strategic Review data assembly.
 *
 * One readout joining every goal-health source the system already
 * keeps: the goals engine (declarations, steps, drift score), the
 * effort stream (task archive + commit attributions + verified ops),
 * goal-drift.jsonl (findings + verification records), the pre-mortem
 * log, goal-verification.json (pending verifications), and the
 * initiative ledger (corrective + escalation proposals).
 *
 * Served by GET /api/cortex/strategic/dashboard and rendered by the
 * 'strategic' surface panel — the quarterly review as a live glance,
 * not a manual compilation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getCortexGoals, type LifeGoal } from '../cortex-goals';
import { loadMission } from '../cortex-agents/mission';
import { collectEffortEvents } from './goal-drift';
import { computeGoalForecasts } from './goal-forecast';
import { calibrationReport } from './goal-calibration';
import type { CalibrationReport } from '../cortex-strategic-dashboard-types';
import type { GoalHealth, GoalTrendPoint, StrategicDashboard } from '../cortex-strategic-dashboard-types';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const DRIFT_LOG = path.join(RUNTIME, 'goal-drift.jsonl');
const PREMORTEM_LOG = path.join(RUNTIME, 'goal-premortems.jsonl');
const VERIFY_STATE = path.join(RUNTIME, 'goal-verification.json');
const LEDGER_PATH = path.join(RUNTIME, 'initiative-ledger.json');
const DAY_MS = 86400_000;
const TREND_DAYS = 30;

function readJsonl<T>(file: string, cap = 4000): T[] {
  try {
    if (!fs.existsSync(file)) return [];
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const out: T[] = [];
    for (let i = Math.max(0, lines.length - cap); i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      try { out.push(JSON.parse(l)); } catch {}
    }
    return out;
  } catch { return []; }
}

function readJsonSafe<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Daily buckets for `days` ending today (oldest→newest), zero-filled. */
function bucketSeries(events: Array<{ ts: number }>, days: number, nowMs: number): GoalTrendPoint[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const k = dayKey(e.ts);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const out: GoalTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(nowMs - i * DAY_MS);
    const k = dayKey(d.getTime());
    out.push({ day: k.slice(5), count: counts.get(k) || 0 });
  }
  return out;
}

export function getStrategicDashboard(nowMs: number = Date.now()): StrategicDashboard {
  const goalsEngine = getCortexGoals();
  const activeGoals = goalsEngine.list('active');

  // ── Shared streams (computed once) ──
  const effort = collectEffortEvents(nowMs - TREND_DAYS * DAY_MS);
  const byGoal = new Map<string, Array<{ ts: number }>>();
  const unattributed: Array<{ ts: number }> = [];
  for (const e of effort) {
    if (e.goalId) {
      const arr = byGoal.get(e.goalId) || [];
      arr.push({ ts: e.ts });
      byGoal.set(e.goalId, arr);
    } else {
      unattributed.push({ ts: e.ts });
    }
  }
  const hostEffort30d = bucketSeries(effort, TREND_DAYS, nowMs);

  const driftRecords = readJsonl<any>(DRIFT_LOG);
  const premortems = readJsonl<any>(PREMORTEM_LOG);
  const verifyState = readJsonSafe<{ pending?: Record<string, any> }>(VERIFY_STATE, {});
  const ledger = readJsonSafe<any>(LEDGER_PATH, { proposals: [] });
  const proposals: any[] = Array.isArray(ledger?.proposals) ? ledger.proposals
    : Array.isArray(ledger) ? ledger : [];

  const mission = readJsonSafe<any>(path.join(RUNTIME, 'mission.json'), { opsItems: [] });
  const opsItems: any[] = mission?.opsItems || [];
  const commitEvents: Array<{ ts: number; goalId: string }> = [];
  try {
    const af = path.join(RUNTIME, 'goal-attribution.jsonl');
    if (fs.existsSync(af)) {
      for (const line of fs.readFileSync(af, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const a = JSON.parse(line);
          if (a?.goalId && a?.ts) commitEvents.push({ ts: Number(a.ts), goalId: String(a.goalId) });
        } catch {}
      }
    }
  } catch {}

  const forecasts = computeGoalForecasts(nowMs);
  const forecastByGoal = new Map(forecasts.map((f) => [f.goalId, f]));

  const goals: GoalHealth[] = activeGoals.map((g: LifeGoal) => {
    const gid = g.id;
    // Ops linked to this goal
    const linkedOps = opsItems.filter((o: any) => o.goalId === gid);
    const opsDone = linkedOps.filter((o: any) => o.done).length;

    // Commits this week
    const weekAgo = nowMs - 7 * DAY_MS;
    const commits7d = commitEvents.filter((c) => c.goalId === gid && c.ts >= weekAgo).length;

    // Effort: attributed events for this goal
    const goalEvents = byGoal.get(gid) || [];
    const effort7d = goalEvents.filter((e) => e.ts >= weekAgo).length;
    const trend = bucketSeries(goalEvents, TREND_DAYS, nowMs);
    const trendMax = Math.max(1, ...trend.map((t) => t.count));

    // Drift findings (non-verification records) for this goal, newest first
    const findings = driftRecords
      .filter((r: any) => r.goalId === gid && r.kind && !String(r.kind).startsWith('verification'))
      .slice(-5)
      .reverse()
      .map((r: any) => ({ kind: String(r.kind), detail: String(r.detail || '').slice(0, 220), severity: String(r.severity || 'low'), ts: Number(r.ts || 0) }));

    // Verification outcomes for this goal
    const verifs = driftRecords.filter((r: any) => r.goalId === gid && String(r.kind).startsWith('verification'));
    const lastResolved = [...verifs].reverse().find((r: any) => r.kind === 'verification_resolved');
    const lastEscalated = [...verifs].reverse().find((r: any) => r.kind === 'verification_escalated');
    const lastVerification = lastResolved && (!lastEscalated || Number(lastResolved.ts) > Number(lastEscalated.ts))
      ? { outcome: 'resolved' as const, correctiveKind: String(lastResolved.correctiveKind || ''), ts: Number(lastResolved.ts) }
      : lastEscalated
        ? { outcome: 'escalated' as const, correctiveKind: String(lastEscalated.correctiveKind || ''), ts: Number(lastEscalated.ts) }
        : null;

    // Pending verification from state file
    const pendKey = Object.keys(verifyState.pending || {}).find((k) => k.startsWith(`${gid}:`));
    const pend = pendKey ? verifyState.pending![pendKey] : null;

    // Pre-mortems for this goal (latest per kind, max 3)
    const goalPremorts = premortems
      .filter((p: any) => p.goalId === gid)
      .slice(-6)
      .reverse()
      .slice(0, 3)
      .map((p: any) => ({
        kind: String(p.kind || p.correctiveKind || 'premortem'),
        headline: String(p.headline || p.narrative || p.summary || '').slice(0, 180),
        engine: String(p.engine || 'template'),
        ts: Number(p.ts || 0),
      }));

    // Corrective + escalation proposals from the ledger
    const correctives = proposals
      .filter((p: any) => {
        const gidInArgs = p?.suggestedArgs?.input?.goalId === gid;
        const idMatch = String(p?.id || '').startsWith('goalcorrective:') && String(p?.id || '').includes(gid);
        return gidInArgs || idMatch;
      })
      .map((p: any) => ({
        id: String(p.id), title: String(p.title || '').slice(0, 90),
        status: String(p.status || 'pending'),
        agentId: String(p?.suggestedArgs?.agentId || p?.suggestedArgs?.input?.agentId || ''),
        createdAtMs: Number(p.createdAtMs || 0),
      }));
    const escalations = proposals
      .filter((p: any) => String(p?.id || '').startsWith('goalescalation:') && String(p?.id || '').includes(gid))
      .map((p: any) => ({ id: String(p.id), title: String(p.title || '').slice(0, 90), status: String(p.status || 'pending'), createdAtMs: Number(p.createdAtMs || 0) }));

    // ── Status derivation ──
    const twoDaysAgo = nowMs - 2 * DAY_MS;
    const hasRecentFinding = findings.some((f) => f.ts >= twoDaysAgo);
    const hasPendingEscalation = escalations.some((e) => e.status === 'pending');
    const hasEscalatedVerification = lastVerification?.outcome === 'escalated' && nowMs - lastVerification.ts < 7 * DAY_MS;
    const status: GoalHealth['status'] =
      hasPendingEscalation || hasEscalatedVerification ? 'escalated'
      : hasRecentFinding || (g.driftScore || 0) > 0.4 ? 'drifting'
      : 'on-track';

    const targetTs = g.targetDate ? new Date(g.targetDate).getTime() : null;
    return {
      id: gid,
      title: g.title,
      horizon: g.horizon,
      targetDate: targetTs ? new Date(targetTs).toISOString().slice(0, 10) : null,
      daysLeft: targetTs ? Math.max(0, Math.ceil((targetTs - nowMs) / DAY_MS)) : null,
      status,
      driftScore: g.driftScore || 0,
      ops: { done: opsDone, total: linkedOps.length },
      commits7d,
      effort7d,
      trend,
      trendMax,
      findings,
      premortems: goalPremorts,
      pendingVerification: pend ? {
        kind: String(pend.kind || ''),
        correctiveTitle: String(pend.correctiveTitle || '').slice(0, 90),
        finishedAt: Number(pend.finishedAt || 0),
      } : null,
      lastVerification,
      correctives,
      escalations,
      forecast: forecastByGoal.get(gid) || null,
    };
  });

  let calibration: CalibrationReport | undefined;
  try { calibration = calibrationReport(); } catch {}
  return { generatedAt: nowMs, goals, hostEffort30d, calibration };
}
