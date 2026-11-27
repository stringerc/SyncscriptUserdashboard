/**
 * plan-coherence.ts — strategic coherence as a first-class vital.
 *
 * Goals are typed objects; plans were prose. This module makes the
 * mission plan (goal → opsItems nodes) into measured state:
 *
 *   planContextFor()  — stamps every dispatched task with the live
 *                       plan snapshot (pending/done counts, top pending
 *                       node labels, coherence score) so the archive
 *                       records WHICH plan state the work was accepted
 *                       under. Predicted-vs-actual becomes auditable.
 *
 *   planCoherence()   — the vital: per-goal node coverage + 24h goal-
 *                       attributed task momentum → coherence score and
 *                       level (coherent/drifting/stalled). Exposed on
 *                       the breath endpoint; the body can feel drift.
 *
 *   planGate()        — action-selection term alongside the
 *                       interoceptive gate: when coherence is stalled,
 *                       heavy discretionary work that carries NO
 *                       explicit goalId defers — busywork that isn't
 *                       serving the plan stops compounding drift.
 *                       Explicitly goal-attributed work (corrective
 *                       missions, planned dispatches) always passes.
 */

import { getCortexGoals, type LifeGoal } from '../cortex-goals';
import { loadMission, type OpsItem } from '../cortex-agents/mission';
import { resolvePrimaryGoal } from './goal-linker';
import { readArchive } from '../cortex-agents/archive';

const DAY = 86_400_000;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export interface PlanNodeView {
  id: string;
  label: string;
  done: boolean;
  status?: string;
  ageH: number;
}

export interface GoalCoherence {
  goalId: string;
  goalTitle: string;
  nodes: number;
  done: number;
  pending: number;
  stale: number;
  /** Goal-attributed agent tasks finished in the last 24h. */
  tasks24h: number;
  /** Oldest still-pending node age in hours. */
  oldestPendingH: number | null;
  /** 0..1 — 0.5·node coverage + 0.5·momentum (≥3 goal tasks/day = full). */
  score: number;
  level: 'coherent' | 'drifting' | 'stalled' | 'empty';
}

export interface PlanCoherenceReport {
  computedAt: number;
  primaryGoalId: string | null;
  goals: GoalCoherence[];
  /** Worst active-goal level — the vital the breath reports. */
  level: 'coherent' | 'drifting' | 'stalled' | 'empty';
  score: number;
}

function clip(s: string, n: number): string {
  const clean = (s || '').replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}

/** Nodes for a goal: mission opsItems carrying its goalId. */
function nodesForGoal(goalId: string): OpsItem[] {
  try {
    return loadMission().opsItems.filter((o) => o.goalId === goalId);
  } catch {
    return [];
  }
}

/** Count terminal agent tasks attributed to a goal in the last 24h.
 *  Reads the durable archive tail — input.goalId rides every task. */
function goalTasksLast24h(goalId: string, now: number): number {
  try {
    const rows = readArchive({ limit: 800 }) as any[];
    const since = now - DAY;
    let n = 0;
    for (const r of rows) {
      const gid = r?.input?.goalId;
      if (gid !== goalId) continue;
      const t = r.finishedAt ?? r.createdAt ?? 0;
      if (t >= since && ['completed', 'failed', 'vetoed', 'cancelled'].includes(r.status)) n++;
    }
    return n;
  } catch {
    return 0;
  }
}

function coherenceForGoal(goal: LifeGoal, now: number): GoalCoherence {
  const nodes = nodesForGoal(goal.id);
  const total = nodes.length;
  const done = nodes.filter((n) => n.done).length;
  const pendingNodes = nodes.filter((n) => !n.done);
  const stale = pendingNodes.filter((n) => n.lastStatus === 'stale' ||
    (n.staleAfterDays && now - n.createdAt > n.staleAfterDays * DAY)).length;
  const pending = pendingNodes.length;
  const tasks24h = goalTasksLast24h(goal.id, now);
  const oldestPendingH = pendingNodes.length
    ? Math.round(Math.max(...pendingNodes.map((n) => (now - n.createdAt) / 3_600_000)))
    : null;
  const coverage = total ? done / total : 0;
  const momentum = Math.min(1, tasks24h / 3);
  const score = total === 0 ? 0 : Math.round(clamp01(coverage * 0.5 + momentum * 0.5) * 1000) / 1000;
  let level: GoalCoherence['level'];
  if (total === 0) level = 'empty';
  else if (score >= 0.66) level = 'coherent';
  else if (pending > 0 && tasks24h === 0 && (oldestPendingH ?? 0) > 48) level = 'stalled';
  else level = 'drifting';
  return {
    goalId: goal.id, goalTitle: goal.title,
    nodes: total, done, pending, stale, tasks24h,
    oldestPendingH, score, level,
  };
}

const LEVEL_RANK = { coherent: 0, empty: 0, drifting: 1, stalled: 2 } as const;

/** Full coherence report across active goals. Cheap enough for the
 *  breath endpoint (one archive tail-read + one mission read). */
export function planCoherence(now: number = Date.now()): PlanCoherenceReport {
  const primary = resolvePrimaryGoal();
  let goals: LifeGoal[] = [];
  try { goals = getCortexGoals().list('active'); } catch {}
  if (!goals.length && primary) goals = [primary];
  const rows = goals.map((g) => coherenceForGoal(g, now));
  const worst = rows.reduce((w, r) => LEVEL_RANK[r.level] > LEVEL_RANK[w.level] ? r : w, rows[0] ?? { level: 'empty' } as GoalCoherence);
  const score = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length * 1000) / 1000 : 0;
  return {
    computedAt: now,
    primaryGoalId: primary?.id ?? null,
    goals: rows,
    level: (worst as GoalCoherence)?.level ?? 'empty',
    score,
  };
}

/** Compact plan snapshot stamped onto task input — the plan state the
 *  dispatch was accepted under. Null when no goal resolves. */
export function planContextFor(input: Record<string, unknown>): Record<string, unknown> | null {
  const gid = typeof input.goalId === 'string' ? input.goalId : null;
  if (!gid) return null;
  try {
    const nodes = nodesForGoal(gid);
    const pending = nodes.filter((n) => !n.done);
    const rep = planCoherence();
    const g = rep.goals.find((x) => x.goalId === gid);
    const title = typeof input.goalTitle === 'string' ? input.goalTitle : g?.goalTitle || '';
    return {
      goalId: gid,
      goalTitle: clip(title, 60),
      nodes: nodes.length,
      done: nodes.length - pending.length,
      pending: pending.length,
      coherence: g?.score ?? null,
      topPending: pending.slice(0, 4).map((n) => clip(n.label, 48)),
    };
  } catch {
    return null;
  }
}

// ── Action-selection gate ──────────────────────────────────────────

const PLAN_EXEMPT_RE = /patrol|status|comm|handoff|watchdog|heartbeat|distill|corrective|verify|message_flush/i;
const PLAN_HEAVY_RE = /orchestrate|devin|research|build|sprint|deep|mission|code|generate|video|image|goal/i;

export interface PlanGateDecision {
  allow: boolean;
  reason?: string;
  level: PlanCoherenceReport['level'];
  score: number;
}

/** Strategic-coherence gate: when the plan is stalled, heavy
 *  discretionary work WITHOUT explicit goal attribution defers —
 *  the system stops compounding drift with busywork. Explicitly
 *  goal-attributed tasks (correctives carry goalId in their draft
 *  input) and essential kinds always pass. Deferred ≠ denied. */
export function planGate(kind: string, title: string, explicitGoal: boolean, rep?: PlanCoherenceReport): PlanGateDecision {
  const r = rep || planCoherence();
  const base = { level: r.level, score: r.score };
  if (r.level !== 'stalled') return { allow: true, ...base };
  const text = `${kind} ${title}`;
  if (PLAN_EXEMPT_RE.test(text) || explicitGoal) return { allow: true, ...base };
  if (!PLAN_HEAVY_RE.test(text)) return { allow: true, ...base };
  const worst = r.goals.find((g) => g.level === 'stalled');
  const detail = worst
    ? `${worst.pending} pending plan nodes, ${worst.tasks24h} goal tasks in 24h (oldest pending ${worst.oldestPendingH ?? '?'}h)`
    : 'plan stalled';
  return {
    allow: false,
    ...base,
    reason: `strategic coherence stalled — ${detail}; unattributed heavy work deferred until plan momentum resumes or the goal is descoped`,
  };
}
