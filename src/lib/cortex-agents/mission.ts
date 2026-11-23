/**
 * MISSION LOOP — goals → tasks → calendar → agents → evidence → progress.
 * See CORTEX_MISSION_LOOP_SPEC.md. Server-side canonical planning state at
 * .cortex-runtime/mission.json so agents can read goals/ops without a browser.
 *
 * Contracts (spec §5):
 *  - Evidence or silence: ops `done` is computed from real sources only.
 *  - `manual` evidence is honest — tracked with stale detection, never faked.
 *  - Cadence adjustments are bounded + audited; out-of-bounds → proposal.
 */
import fs from 'fs';
import path from 'path';
import { readArchive } from './archive';
import { fileBudgetProposal, fileBudgetTrimProposal } from './strategy-proposals';

const STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const MISSION_PATH = path.join(STATE_DIR, 'mission.json');

// ---------------------------------------------------------------- types

export type GoalStatus = 'active' | 'done' | 'archived';
export interface MissionGoal {
  id: string;
  title: string;
  description?: string;
  horizon?: string;
  targetDate?: string;           // ISO date
  status: GoalStatus;
  /** Agent task ids / mission block ids this goal decomposes into. */
  taskIds: string[];
  /** Venture scope (enterprise spec) — absent = cortex/fleet bucket. */
  ventureId?: string;
  createdAt: number;
}

export type OpsEvidence =
  | { type: 'agent_tasks'; agentId?: string; kind?: string; status?: string; withinHours: number; minCount: number }
  | { type: 'distribution'; itemStatus?: string; minCount: number }
  | { type: 'calendar_event'; match: string; withinHours: number }
  | { type: 'manual' };

export type OpsStatus = 'done' | 'pending' | 'stale' | 'unverifiable';
export interface OpsItem {
  id: string;
  label: string;
  evidence: OpsEvidence;
  done: boolean;                 // only set by verify — never hand-edited true
  verifiedAt?: number;
  lastStatus?: OpsStatus;
  staleAfterDays?: number;       // manual items rot visibly after this
  /** Venture scope (enterprise spec). */
  ventureId?: string;
  /** Life-goal link (cortex-goals id) — effort attribution: which
   *  declared life goal this ops item serves. */
  goalId?: string;
  createdAt: number;
}

export type BlockStatus = 'planned' | 'dispatched' | 'done' | 'skipped';
export interface ScheduleBlock {
  id: string;
  title: string;
  agentId?: string;
  kind?: string;
  goalId?: string;
  taskId?: string;
  /** Venture scope — carried into the dispatched task's input. */
  ventureId?: string;
  start: number;                 // epoch ms
  end: number;
  status: BlockStatus;
  reason: string;                // why this slot — auditable plan
  createdAt: number;
}

export interface CadenceEntry {
  routineId: string;
  agentId: string;
  kind: string;
  intervalMin: number;
  baseMin: number;               // seed interval — bounds are relative to this
  runs: number;
  completions: number;
  adjustments: { at: number; from: number; to: number; reason: string }[];
}

/** Before/after A/B experiment on a single routine's cadence (spec §3).
 *  Baseline yield is measured over the trailing window at start; the variant
 *  interval runs until enough post-change runs accrue, then a verdict is
 *  computed. Honest interrupted time-series — provider drift is the known
 *  confound, mitigated by requiring minimum sample sizes. */
export interface AbExperiment {
  id: string;
  routineId: string;
  agentId: string;
  kind: string;
  baseline: { intervalMin: number; runs: number; completions: number; windowDays: number };
  variant: { intervalMin: number };
  startedAt: number;
  minVariantRuns: number;        // evidence floor before verdict
  status: 'running' | 'concluded';
  verdict?: 'keep' | 'revert' | 'inconclusive';
  result?: { controlRate: number; variantRate: number; variantRuns: number };
}

export interface MissionPrefs {
  workStartMin: number;          // minutes past local midnight, default 480 (08:00)
  workEndMin: number;            // default 1320 (22:00)
  slotMin: number;               // default 30
}

export interface MissionState {
  goals: MissionGoal[];
  opsItems: OpsItem[];
  blocks: ScheduleBlock[];
  cadence: CadenceEntry[];
  experiments: AbExperiment[];
  prefs: MissionPrefs;
  updatedAt: number;
}

// ------------------------------------------------------------- persistence

function emptyState(): MissionState {
  return {
    goals: [], opsItems: [], blocks: [], cadence: [], experiments: [],
    prefs: { workStartMin: 480, workEndMin: 1320, slotMin: 30 },
    updatedAt: Date.now(),
  };
}

export function loadMission(): MissionState {
  try {
    const raw = JSON.parse(fs.readFileSync(MISSION_PATH, 'utf8'));
    return { ...emptyState(), ...raw, prefs: { ...emptyState().prefs, ...(raw.prefs || {}) } };
  } catch {
    return emptyState();
  }
}

export function saveMission(state: MissionState): void {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    state.updatedAt = Date.now();
    fs.writeFileSync(MISSION_PATH, JSON.stringify(state, null, 2));
  } catch { /* persistence best-effort */ }
}

// ------------------------------------------------------------- goals

export function upsertGoal(state: MissionState, g: Partial<MissionGoal> & { title: string }): MissionGoal {
  const now = Date.now();
  const existing = g.id ? state.goals.find((x) => x.id === g.id) : undefined;
  const goal: MissionGoal = {
    id: existing?.id ?? g.id ?? `goal-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: g.title,
    description: g.description ?? existing?.description,
    horizon: g.horizon ?? existing?.horizon,
    targetDate: g.targetDate ?? existing?.targetDate,
    status: g.status ?? existing?.status ?? 'active',
    taskIds: g.taskIds ?? existing?.taskIds ?? [],
    ventureId: g.ventureId ?? existing?.ventureId,
    createdAt: existing?.createdAt ?? now,
  };
  if (existing) state.goals = state.goals.map((x) => (x.id === goal.id ? goal : x));
  else state.goals.push(goal);
  return goal;
}

// ------------------------------------------------------------- ops verify

export interface OpsSources {
  /** Archive records already filtered to the query window by caller or read here. */
  archive?: { agentId: string; kind: string; status: string; finishedAt?: number; createdAt: number }[];
  distributionItems?: { status: string }[];
  calendarEvents?: { title: string; start: number; end?: number }[];
  now?: number;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Compute ops status from real sources. Pure — sources injected for tests. */
export function verifyOpsItem(item: OpsItem, src: OpsSources): OpsStatus {
  const now = src.now ?? Date.now();
  const ev = item.evidence;
  if (ev.type === 'manual') {
    if (item.done) return 'done';
    const staleAfter = (item.staleAfterDays ?? 3) * DAY;
    return now - item.createdAt > staleAfter ? 'stale' : 'pending';
  }
  if (ev.type === 'agent_tasks') {
    const since = now - ev.withinHours * HOUR;
    const hits = (src.archive || []).filter((r) => {
      if (ev.agentId && r.agentId !== ev.agentId) return false;
      if (ev.kind && r.kind !== ev.kind) return false;
      // Evidence of work means completion — a failed run proves nothing.
      const wantStatus = ev.status ?? 'completed';
      if (r.status !== wantStatus) return false;
      const t = r.finishedAt ?? r.createdAt;
      return t >= since;
    }).length;
    return hits >= ev.minCount ? 'done' : 'pending';
  }
  if (ev.type === 'distribution') {
    const hits = (src.distributionItems || []).filter((i) =>
      !ev.itemStatus || i.status === ev.itemStatus).length;
    return hits >= ev.minCount ? 'done' : 'pending';
  }
  if (ev.type === 'calendar_event') {
    const since = now - ev.withinHours * HOUR;
    const hit = (src.calendarEvents || []).some((e) =>
      e.title.toLowerCase().includes(ev.match.toLowerCase()) &&
      e.start >= since - DAY && e.start <= now + DAY);
    return hit ? 'done' : 'pending';
  }
  return 'unverifiable';
}

/** Verify every ops item against live sources; mutates done/verifiedAt/status. */
export function verifyOps(state: MissionState, src: OpsSources): OpsItem[] {
  const now = src.now ?? Date.now();
  for (const item of state.opsItems) {
    const status = verifyOpsItem(item, { ...src, now });
    item.lastStatus = status;
    item.verifiedAt = now;
    // Evidence-backed done flips automatically; manual done is Crew-set and
    // sticks until the Crew unchecks it.
    if (item.evidence.type !== 'manual') item.done = status === 'done';
  }
  return state.opsItems;
}

// ------------------------------------------------------------- scheduling

interface BusySpan { start: number; end: number }

/** Find the next `durMs` free slot inside work hours, after `after`, avoiding busy spans. */
export function findFreeSlot(
  after: number, durMs: number, busy: BusySpan[], prefs: MissionPrefs,
): { start: number; end: number } | null {
  const dayStart = new Date(after);
  dayStart.setHours(0, 0, 0, 0);
  const dayMs = 86_400_000;
  for (let d = 0; d < 14; d++) {
    const base = dayStart.getTime() + d * dayMs;
    const ws = base + prefs.workStartMin * 60_000;
    const we = base + prefs.workEndMin * 60_000;
    let cursor = Math.max(after, ws);
    const sorted = [...busy].sort((a, b) => a.start - b.start);
    for (const b of sorted) {
      if (b.end <= cursor) continue;
      if (b.start >= cursor + durMs) break;
      cursor = Math.max(cursor, b.end);
    }
    if (cursor + durMs <= we) return { start: cursor, end: cursor + durMs };
  }
  return null;
}

/** Plan blocks for pending work items into free calendar slots. */
export function planBlocks(
  state: MissionState,
  items: { title: string; agentId?: string; kind?: string; goalId?: string; taskId?: string; ventureId?: string; durMin?: number }[],
  busy: BusySpan[],
  now = Date.now(),
  notAfter?: number,
): ScheduleBlock[] {
  const created: ScheduleBlock[] = [];
  let cursor = now;
  for (const it of items) {
    const durMs = (it.durMin ?? state.prefs.slotMin) * 60_000;
    const slot = findFreeSlot(cursor, durMs, busy, state.prefs);
    if (!slot || (notAfter != null && slot.start > notAfter)) break;
    const block: ScheduleBlock = {
      id: `blk-${now.toString(36)}-${created.length}-${Math.random().toString(36).slice(2, 5)}`,
      title: it.title, agentId: it.agentId, kind: it.kind,
      goalId: it.goalId, taskId: it.taskId, ventureId: it.ventureId,
      start: slot.start, end: slot.end, status: 'planned',
      reason: `free slot ${new Date(slot.start).toISOString()} — ${it.goalId ? `goal ${it.goalId}` : 'unlinked'}${it.taskId ? ` task ${it.taskId}` : ''}`,
      createdAt: now,
    };
    created.push(block);
    busy.push({ start: slot.start, end: slot.end });
    cursor = slot.end;
  }
  state.blocks.push(...created);
  return created;
}

// ------------------------------------------------------------- alignment

export interface GoalProgress {
  goalId: string;
  title: string;
  status: GoalStatus;
  linked: number;
  done: number;
  progress: number;              // 0..1 — done/linked, 0 when unlinked
  orphaned: boolean;             // active goal with zero linked work
}

export function goalProgress(state: MissionState, archive: { id: string; status: string }[]): GoalProgress[] {
  return state.goals.map((g) => {
    const linkedBlocks = state.blocks.filter((b) => b.goalId === g.id);
    const linkedTasks = archive.filter((t) => g.taskIds.includes(t.id));
    const total = linkedBlocks.length + linkedTasks.length;
    const done = linkedBlocks.filter((b) => b.status === 'done').length +
      linkedTasks.filter((t) => t.status === 'completed').length;
    return {
      goalId: g.id, title: g.title, status: g.status,
      linked: total, done,
      progress: total === 0 ? 0 : done / total,
      orphaned: g.status === 'active' && total === 0,
    };
  });
}

// ------------------------------------------------------------- cadence

export const CADENCE_MIN_MIN = 15;
export const CADENCE_MAX_FACTOR = 4;

/** Trailing-window yield per routineId from archive records. */
export function routineYield(
  archive: { input?: Record<string, unknown>; status: string; finishedAt?: number; createdAt: number }[],
  sinceMs: number,
): Map<string, { runs: number; completions: number }> {
  const out = new Map<string, { runs: number; completions: number }>();
  for (const r of archive) {
    const rid = r.input?.routineId;
    if (typeof rid !== 'string') continue;
    const t = r.finishedAt ?? r.createdAt;
    if (t < sinceMs) continue;
    const e = out.get(rid) ?? { runs: 0, completions: 0 };
    e.runs++;
    if (r.status === 'completed') e.completions++;
    out.set(rid, e);
  }
  return out;
}

export interface CadenceSuggestion {
  routineId: string;
  agentId: string;
  kind: string;
  fromMin: number;
  toMin: number;
  reason: string;
  autoApply: boolean;            // false → must go through INBOX proposal
}

/** Bounded cadence advice. Auto-apply only inside [15m, 4×base]; else proposal. */
export function suggestCadence(
  entry: CadenceEntry, yieldStats: { runs: number; completions: number },
): CadenceSuggestion | null {
  if (yieldStats.runs < 6) return null;   // not enough evidence
  const rate = yieldStats.completions / yieldStats.runs;
  const minFloor = CADENCE_MIN_MIN;
  const maxCeil = entry.baseMin * CADENCE_MAX_FACTOR;
  if (rate < 0.5) {
    const to = Math.min(Math.round(entry.intervalMin * 1.5), maxCeil);
    if (to === entry.intervalMin) return null;
    return {
      routineId: entry.routineId, agentId: entry.agentId, kind: entry.kind,
      fromMin: entry.intervalMin, toMin: to,
      reason: `yield ${(rate * 100).toFixed(0)}% over ${yieldStats.runs} runs — backing off`,
      autoApply: to <= maxCeil && to >= minFloor,
    };
  }
  if (rate >= 0.9) {
    const to = Math.max(Math.round(entry.intervalMin * 0.75), minFloor);
    if (to === entry.intervalMin) return null;
    return {
      routineId: entry.routineId, agentId: entry.agentId, kind: entry.kind,
      fromMin: entry.intervalMin, toMin: to,
      reason: `yield ${(rate * 100).toFixed(0)}% over ${yieldStats.runs} runs — healthy, tightening`,
      autoApply: true,
    };
  }
  return null;
}

// ------------------------------------------------------------- A/B experiments

export const EXPERIMENT_MIN_VARIANT_RUNS = 8;

/** Start a before/after cadence experiment on one routine. Baseline yield is
 *  measured from the archive over the trailing 7d; the caller is responsible
 *  for actually applying variant.intervalMin via runtime.updateRoutine. */
export function startExperiment(
  state: MissionState,
  routine: { id: string; agentId: string; kind: string; everyMinutes: number },
  variantMin: number,
  archive: { input?: Record<string, unknown>; status: string; finishedAt?: number; createdAt: number }[],
  now = Date.now(),
): { ok: boolean; experiment?: AbExperiment; reason?: string } {
  if (state.experiments.some((e) => e.routineId === routine.id && e.status === 'running'))
    return { ok: false, reason: 'experiment already running for this routine' };
  const since = now - 7 * 86_400_000;
  const y = routineYield(archive, since).get(routine.id) ?? { runs: 0, completions: 0 };
  if (y.runs < 6)
    return { ok: false, reason: `insufficient baseline evidence (${y.runs} runs in 7d, need ≥6)` };
  if (!Number.isFinite(variantMin) || variantMin < CADENCE_MIN_MIN || variantMin === routine.everyMinutes)
    return { ok: false, reason: `variantMin must be ≥${CADENCE_MIN_MIN} and differ from current ${routine.everyMinutes}` };
  const exp: AbExperiment = {
    id: `ab-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    routineId: routine.id, agentId: routine.agentId, kind: routine.kind,
    baseline: { intervalMin: routine.everyMinutes, runs: y.runs, completions: y.completions, windowDays: 7 },
    variant: { intervalMin: Math.floor(variantMin) },
    startedAt: now,
    minVariantRuns: EXPERIMENT_MIN_VARIANT_RUNS,
    status: 'running',
  };
  state.experiments.push(exp);
  return { ok: true, experiment: exp };
}

export interface ExperimentReport {
  experiment: AbExperiment;
  variantRuns: number;
  variantRate: number | null;
  controlRate: number;
  ready: boolean;
  verdict?: 'keep' | 'revert' | 'inconclusive';
}

/** Evaluate running experiments against post-change archive records.
 *  Concludes (does not auto-revert) — the caller decides whether to apply
 *  the verdict via updateRoutine; reverting is a separate explicit action. */
export function reportExperiments(
  state: MissionState,
  archive: { input?: Record<string, unknown>; status: string; finishedAt?: number; createdAt: number }[],
  now = Date.now(),
): ExperimentReport[] {
  const out: ExperimentReport[] = [];
  for (const exp of state.experiments.filter((e) => e.status === 'running')) {
    const post = archive.filter((r) => {
      const rid = r.input?.routineId;
      return rid === exp.routineId && (r.finishedAt ?? r.createdAt) >= exp.startedAt;
    });
    const runs = post.length;
    const completions = post.filter((r) => r.status === 'completed').length;
    const controlRate = exp.baseline.runs ? exp.baseline.completions / exp.baseline.runs : 0;
    const variantRate = runs ? completions / runs : null;
    const ready = runs >= exp.minVariantRuns;
    let verdict: ExperimentReport['verdict'];
    if (ready && variantRate != null) {
      verdict = variantRate >= controlRate ? 'keep' : 'revert';
      exp.status = 'concluded';
      exp.verdict = verdict;
      exp.result = { controlRate, variantRate, variantRuns: runs };
    }
    out.push({ experiment: exp, variantRuns: runs, variantRate, controlRate, ready, verdict });
  }
  return out;
}

// ------------------------------------------------------------- day planner

/**
 * Nightly/intraday planner — keeps UP NEXT filled with real work.
 *  - `user_task` blocks mirror pending user tasks due within ~36h (or
 *    created today with no due date). Display-only: dispatch_due_blocks
 *    marks them done without spawning agent work.
 *  - `goal_review` blocks give each active goal one strategist pass per
 *    day — the mission loop's "is this goal moving?" heartbeat.
 * Dedupes by taskId and goalId+day; safe to run on a short cadence.
 */
export function runMissionPlan(now = Date.now()) {
  const state = loadMission();
  const horizon = now + 36 * 3_600_000;
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);

  const readJson = (name: string, key: string): any[] => {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(STATE_DIR, name), 'utf8'));
      return Array.isArray(raw?.[key]) ? raw[key] : [];
    } catch { return []; }
  };
  const calEvents = readJson('calendar-upcoming.json', 'events');
  const userTasks = readJson('tasks-snapshot.json', 'tasks');

  const busy = [
    ...calEvents.map((e: any) => ({ start: Number(e.start), end: Number(e.end) || Number(e.start) + 3_600_000 }))
      .filter((b: any) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start),
    ...state.blocks.filter((b) => b.status === 'planned').map((b) => ({ start: b.start, end: b.end })),
  ];

  const plannedTaskIds = new Set(state.blocks.map((b) => b.taskId).filter(Boolean));
  const items: Parameters<typeof planBlocks>[1] = [];
  for (const t of userTasks) {
    if (t.completed || plannedTaskIds.has(t.id)) continue;
    const due = t.dueDate ? new Date(t.dueDate).getTime() : NaN;
    const created = t.createdAt ? new Date(t.createdAt).getTime() : NaN;
    const dueSoon = !Number.isNaN(due) && due >= now - 12 * 3_600_000 && due <= horizon;
    const freshUndated = Number.isNaN(due) && !Number.isNaN(created) && created >= dayStart.getTime();
    if (!dueSoon && !freshUndated) continue;
    items.push({ title: `USER TASK — ${String(t.title).slice(0, 140)}`, kind: 'user_task', taskId: t.id, durMin: 30 });
  }

  // Tomorrow's goal reviews — one per active goal, deduped per calendar day.
  const tomorrow = new Date(dayStart.getTime() + 86_400_000);
  const tomorrowStart = tomorrow.getTime() + (state.prefs?.workStartMin ?? 480) * 60_000;
  const goalItems: Parameters<typeof planBlocks>[1] = [];
  const sameDay = (a: number, b: number) => {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
  };
  for (const g of state.goals.filter((g) => g.status === 'active')) {
    const already = state.blocks.some((b) => b.goalId === g.id && b.kind === 'goal_review' && sameDay(b.start, tomorrowStart));
    if (already) continue;
    goalItems.push({
      title: `Goal review — ${g.title}: assess progress since last review; if stalled, file a governed proposal for the next concrete step`,
      agentId: 'strategist', kind: 'goal_review', goalId: g.id, ventureId: g.ventureId,
      durMin: state.prefs?.slotMin ?? 30,
    });
  }

  let created = planBlocks(state, items, busy, now, horizon);
  if (goalItems.length) {
    const busy2 = [...busy, ...created.map((b) => ({ start: b.start, end: b.end }))];
    const tomorrowEnd = tomorrow.getTime() + (state.prefs?.workEndMin ?? 1320) * 60_000;
    created = created.concat(planBlocks(state, goalItems, busy2, tomorrowStart, tomorrowEnd));
  }
  // Yield-proportional budget review — starved high-yield agents get raise
  // proposals (auto-execute ≤128), low-yield hogs get Crew-gated trims.
  let budgetFiled = 0;
  try {
    const agents = readJson('agents-state.json', 'agents')
      .map((a: any) => ({ id: String(a.id || ''), name: a.name, dailyBudget: Number(a.dailyBudget) || 0 }))
      .filter((a: any) => a.id && a.dailyBudget > 0);
    const suggestions = budgetYieldReview(readArchive({ limit: 500 }), agents, now);
    for (const s of suggestions) {
      const filed = s.direction === 'raise'
        ? fileBudgetProposal({ agentId: s.agentId, agentName: s.agentName, currentBudget: s.currentBudget, suggestedBudget: s.suggestedBudget, error: s.reason })
        : fileBudgetTrimProposal({ agentId: s.agentId, agentName: s.agentName, currentBudget: s.currentBudget, suggestedBudget: s.suggestedBudget, evidence: s.evidence });
      if (filed) budgetFiled++;
    }
  } catch { /* budget review is best-effort — never break planning */ }

  if (created.length) saveMission(state);
  return {
    planned: created.length,
    userBlocks: created.filter((b) => b.kind === 'user_task').length,
    goalReviews: created.filter((b) => b.kind === 'goal_review').length,
    budgetProposalsFiled: budgetFiled,
  };
}

// ------------------------------------------------------------- budget yield

const BOOKKEEPING_KIND_SET = new Set(['initiative_drain']);

export interface BudgetSuggestion {
  agentId: string;
  agentName: string;
  currentBudget: number;
  suggestedBudget: number;
  direction: 'raise' | 'trim';
  reason: string;
  evidence: string[];
}

/**
 * Yield-proportional budget review — the strategic allocation layer.
 * Per agent over the trailing 7d of archive: completion yield vs budget
 * pressure (tasks/day vs dailyBudget). High-yield agents running at
 * capacity get raise proposals (auto-execute ≤128 via existing triage);
 * low-yield budget hogs get trim proposals (Crew-gated, never auto).
 * Bookkeeping kinds are excluded — they no longer consume budget.
 */
export function budgetYieldReview(
  archive: { agentId: string; kind: string; status: string; finishedAt?: number; createdAt: number }[],
  budgets: { id: string; name?: string; dailyBudget: number }[],
  now = Date.now(),
): BudgetSuggestion[] {
  const since = now - 7 * 86_400_000;
  const stats = new Map<string, { runs: number; completions: number }>();
  for (const r of archive) {
    const t = r.finishedAt ?? r.createdAt;
    if (t < since || BOOKKEEPING_KIND_SET.has(r.kind)) continue;
    const e = stats.get(r.agentId) ?? { runs: 0, completions: 0 };
    e.runs++;
    if (r.status === 'completed') e.completions++;
    stats.set(r.agentId, e);
  }
  const out: BudgetSuggestion[] = [];
  for (const b of budgets) {
    const s = stats.get(b.id);
    if (!s || s.runs < 10) continue;                    // evidence floor
    const rate = s.completions / s.runs;
    const tasksPerDay = s.runs / 7;
    const pressure = tasksPerDay / Math.max(1, b.dailyBudget);
    if (rate >= 0.7 && pressure >= 0.8) {
      const suggested = Math.min(128, b.dailyBudget + Math.max(8, Math.round(b.dailyBudget * 0.5)));
      if (suggested > b.dailyBudget) {
        out.push({
          agentId: b.id, agentName: b.name || b.id.toUpperCase(),
          currentBudget: b.dailyBudget, suggestedBudget: suggested, direction: 'raise',
          reason: `${(rate * 100).toFixed(0)}% yield over ${s.runs} runs, using ${(pressure * 100).toFixed(0)}% of daily budget`,
          evidence: [`${s.runs} runs / ${s.completions} completions in 7d`, `${tasksPerDay.toFixed(1)} tasks/day vs budget ${b.dailyBudget}`],
        });
      }
    } else if (rate < 0.5 && b.dailyBudget > 12) {
      const suggested = Math.max(8, Math.floor(b.dailyBudget * 0.75));
      if (suggested < b.dailyBudget) {
        out.push({
          agentId: b.id, agentName: b.name || b.id.toUpperCase(),
          currentBudget: b.dailyBudget, suggestedBudget: suggested, direction: 'trim',
          reason: `${(rate * 100).toFixed(0)}% yield over ${s.runs} runs — low return on ${b.dailyBudget}/day budget`,
          evidence: [`${s.runs} runs / ${s.completions} completions in 7d`, `${(s.runs - s.completions)} failures`],
        });
      }
    }
  }
  return out;
}

/** Per-venture yield attribution (enterprise spec Phase 2) — reporting
 *  only, no hard caps. Groups trailing-7d archive runs/completions by
 *  task input.ventureId; unscoped work lands in 'cortex' (never dropped). */
export function ventureYieldBreakdown(
  archive: { agentId: string; kind: string; status: string; createdAt: number; finishedAt?: number; input?: Record<string, unknown> }[],
  now = Date.now(),
): Record<string, { runs: number; completions: number; agents: Record<string, { runs: number; completions: number }> }> {
  const since = now - 7 * 86_400_000;
  const out: Record<string, { runs: number; completions: number; agents: Record<string, { runs: number; completions: number }> }> = {};
  for (const r of archive) {
    const t = r.finishedAt ?? r.createdAt;
    if (t < since || BOOKKEEPING_KIND_SET.has(r.kind)) continue;
    const vid = String(r.input?.ventureId || 'cortex');
    const v = out[vid] ??= { runs: 0, completions: 0, agents: {} };
    const done = r.status === 'completed';
    v.runs++; if (done) v.completions++;
    const a = v.agents[r.agentId] ??= { runs: 0, completions: 0 };
    a.runs++; if (done) a.completions++;
  }
  return out;
}
