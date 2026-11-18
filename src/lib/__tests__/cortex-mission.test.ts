import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mission state dir is captured at module load — set env BEFORE the dynamic
// import (static imports hoist above assignments and would leak into the
// real .cortex-runtime state).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mission-'));
process.env.CORTEX_AGENTS_STATE_DIR = tmp;
const {
  loadMission, saveMission, upsertGoal, verifyOpsItem, verifyOps,
  findFreeSlot, planBlocks, goalProgress, routineYield, suggestCadence,
} = await import('../cortex-agents/mission');
type MissionState = import('../cortex-agents/mission').MissionState;
type OpsItem = import('../cortex-agents/mission').OpsItem;
type CadenceEntry = import('../cortex-agents/mission').CadenceEntry;

const HOUR = 3_600_000;
const DAY = 86_400_000;
const NOW = Date.now();

function baseState(): MissionState {
  return {
    goals: [], opsItems: [], blocks: [], cadence: [],
    prefs: { workStartMin: 480, workEndMin: 1320, slotMin: 30 },
    updatedAt: NOW,
  };
}

describe('mission state', () => {
  beforeEach(() => { fs.rmSync(path.join(tmp, 'mission.json'), { force: true }); });

  it('persists and reloads goals/ops', () => {
    const s = baseState();
    upsertGoal(s, { title: 'Ship Cortex mission loop', targetDate: '2026-12-01' });
    s.opsItems.push({ id: 'o1', label: 'x', evidence: { type: 'manual' }, done: false, createdAt: NOW });
    saveMission(s);
    const back = loadMission();
    expect(back.goals).toHaveLength(1);
    expect(back.goals[0].title).toBe('Ship Cortex mission loop');
    expect(back.opsItems[0].id).toBe('o1');
    expect(back.prefs.workStartMin).toBe(480);
  });

  it('upsertGoal updates in place by id', () => {
    const s = baseState();
    const g = upsertGoal(s, { id: 'g1', title: 'A' });
    upsertGoal(s, { id: 'g1', title: 'A2', status: 'done' });
    expect(s.goals).toHaveLength(1);
    expect(s.goals[0].title).toBe('A2');
    expect(s.goals[0].status).toBe('done');
    expect(g.id).toBe('g1');
  });
});

describe('ops verification — evidence or silence', () => {
  const item = (evidence: OpsItem['evidence'], done = false): OpsItem =>
    ({ id: 'x', label: 'x', evidence, done, createdAt: NOW });

  it('agent_tasks requires minCount hits and honors agentId filter', () => {
    const it = item({ type: 'agent_tasks', agentId: 'scout', kind: 'catalog_scan', withinHours: 24, minCount: 1 });
    const wrongAgent = verifyOpsItem(it, { now: NOW, archive: [{ agentId: 'builder', kind: 'catalog_scan', status: 'completed', createdAt: NOW - HOUR }] });
    expect(wrongAgent).toBe('pending');
    const failedRun = verifyOpsItem(it, { now: NOW, archive: [{ agentId: 'scout', kind: 'catalog_scan', status: 'failed', createdAt: NOW - HOUR }] });
    // status filter absent → defaults to 'completed'; failures prove nothing
    expect(failedRun).toBe('pending');
    const doneRun = verifyOpsItem(it, { now: NOW, archive: [{ agentId: 'scout', kind: 'catalog_scan', status: 'completed', createdAt: NOW - HOUR }] });
    expect(doneRun).toBe('done');
  });

  it('agent_tasks matches kind+status within window', () => {
    const it = item({ type: 'agent_tasks', kind: 'catalog_scan', status: 'completed', withinHours: 24, minCount: 1 });
    const hit = verifyOpsItem(it, { now: NOW, archive: [{ agentId: 'scout', kind: 'catalog_scan', status: 'completed', createdAt: NOW - HOUR }] });
    expect(hit).toBe('done');
    const stale = verifyOpsItem(it, { now: NOW, archive: [{ agentId: 'scout', kind: 'catalog_scan', status: 'completed', createdAt: NOW - 30 * HOUR }] });
    expect(stale).toBe('pending');
  });

  it('distribution evidence counts queue items by status', () => {
    const it = item({ type: 'distribution', itemStatus: 'published', minCount: 2 });
    expect(verifyOpsItem(it, { now: NOW, distributionItems: [{ status: 'published' }, { status: 'published' }, { status: 'queued' }] })).toBe('done');
    expect(verifyOpsItem(it, { now: NOW, distributionItems: [{ status: 'published' }] })).toBe('pending');
  });

  it('calendar_event evidence matches title within window', () => {
    const it = item({ type: 'calendar_event', match: 'focus block', withinHours: 48 });
    expect(verifyOpsItem(it, { now: NOW, calendarEvents: [{ title: 'Deep Focus Block', start: NOW - HOUR }] })).toBe('done');
    expect(verifyOpsItem(it, { now: NOW, calendarEvents: [{ title: 'Lunch', start: NOW - HOUR }] })).toBe('pending');
  });

  it('manual items stay manual: done sticks, unchecked goes stale', () => {
    const fresh = item({ type: 'manual' });
    expect(verifyOpsItem(fresh, { now: NOW })).toBe('pending');
    const old = { ...fresh, createdAt: NOW - 5 * DAY };
    expect(verifyOpsItem(old, { now: NOW })).toBe('stale');
    const doneIt = { ...fresh, done: true };
    expect(verifyOpsItem(doneIt, { now: NOW })).toBe('done');
  });

  it('verifyOps never hand-sets done on evidence items; Crew done sticks on manual', () => {
    const s = baseState();
    s.opsItems.push(
      { id: 'ev', label: 'evidence item', evidence: { type: 'agent_tasks', kind: 'x', withinHours: 1, minCount: 1 }, done: true, createdAt: NOW }, // hand-set true must be overridden
      { id: 'man', label: 'manual item', evidence: { type: 'manual' }, done: true, createdAt: NOW },
    );
    verifyOps(s, { now: NOW, archive: [] });
    expect(s.opsItems.find((o) => o.id === 'ev')!.done).toBe(false);
    expect(s.opsItems.find((o) => o.id === 'man')!.done).toBe(true);
  });
});

describe('scheduling', () => {
  it('findFreeSlot avoids busy spans inside work hours', () => {
    const prefs = { workStartMin: 480, workEndMin: 1320, slotMin: 30 };
    // NOW at arbitrary time — build a busy span covering the rest of today.
    const dayStart = new Date(NOW); dayStart.setHours(0, 0, 0, 0);
    const busyAllDay = { start: dayStart.getTime() + 480 * 60_000, end: dayStart.getTime() + 1320 * 60_000 };
    const slot = findFreeSlot(NOW, 30 * 60_000, [busyAllDay], prefs);
    expect(slot).not.toBeNull();
    // Must land outside today's work hours — tomorrow morning.
    expect(slot!.start).toBeGreaterThanOrEqual(dayStart.getTime() + DAY + 480 * 60_000 - 1000);
  });

  it('findFreeSlot returns null beyond 14-day horizon', () => {
    const prefs = { workStartMin: 0, workEndMin: 1439, slotMin: 30 };
    const forever = { start: 0, end: NOW + 30 * DAY };
    expect(findFreeSlot(NOW, HOUR, [forever], prefs)).toBeNull();
  });

  it('planBlocks creates reasoned, non-overlapping blocks', () => {
    const s = baseState();
    const busy: { start: number; end: number }[] = [];
    const created = planBlocks(s, [
      { title: 'A', durMin: 30 }, { title: 'B', durMin: 30 },
    ], busy, NOW);
    expect(created).toHaveLength(2);
    expect(created[1].start).toBeGreaterThanOrEqual(created[0].end);
    expect(created[0].reason).toContain('free slot');
    expect(s.blocks).toHaveLength(2);
  });
});

describe('goal progress + orphans', () => {
  it('computes progress from linked blocks and archive tasks', () => {
    const s = baseState();
    upsertGoal(s, { id: 'g1', title: 'Goal', taskIds: ['t1'] });
    upsertGoal(s, { id: 'g2', title: 'Orphan' });
    s.blocks.push({ id: 'b1', title: 'b', goalId: 'g1', start: NOW, end: NOW + HOUR, status: 'done', reason: 'r', createdAt: NOW });
    const prog = goalProgress(s, [{ id: 't1', status: 'completed' }]);
    const g1 = prog.find((p) => p.goalId === 'g1')!;
    const g2 = prog.find((p) => p.goalId === 'g2')!;
    expect(g1.progress).toBe(1);
    expect(g1.orphaned).toBe(false);
    expect(g2.orphaned).toBe(true);
    expect(g2.progress).toBe(0);
  });
});

describe('cadence advisor', () => {
  const entry = (intervalMin: number, baseMin = intervalMin): CadenceEntry => ({
    routineId: 'r1', agentId: 'scout', kind: 'radar_sweep',
    intervalMin, baseMin, runs: 0, completions: 0, adjustments: [],
  });

  it('routineYield attributes archive records by input.routineId', () => {
    const since = NOW - 7 * DAY;
    const y = routineYield([
      { input: { routineId: 'r1' }, status: 'completed', createdAt: NOW - HOUR },
      { input: { routineId: 'r1' }, status: 'failed', createdAt: NOW - 2 * HOUR },
      { input: {}, status: 'completed', createdAt: NOW - HOUR },          // no routineId → ignored
      { input: { routineId: 'r1' }, status: 'completed', createdAt: NOW - 30 * DAY }, // too old
    ], since);
    expect(y.get('r1')).toEqual({ runs: 2, completions: 1 });
  });

  it('suggests backing off on low yield, bounded by 4x base', () => {
    const e = entry(60, 60);
    const s = suggestCadence(e, { runs: 10, completions: 3 })!;
    expect(s.toMin).toBe(90);           // 60*1.5
    expect(s.autoApply).toBe(true);
    const s2 = suggestCadence(entry(120, 60), { runs: 10, completions: 2 })!;
    expect(s2.toMin).toBe(180);         // 120*1.5
    expect(suggestCadence(entry(240, 60), { runs: 10, completions: 2 })).toBeNull(); // already at 4x ceiling → hold
  });

  it('suggests tightening on high yield, floored at 15m', () => {
    const e = entry(20, 60);
    const s = suggestCadence(e, { runs: 8, completions: 8 })!;
    expect(s.toMin).toBe(15);           // 20*0.75=15
    const s2 = suggestCadence(entry(16, 60), { runs: 8, completions: 8 })!;
    expect(s2.toMin).toBe(15);          // floor holds
  });

  it('returns null without enough evidence or at steady state', () => {
    expect(suggestCadence(entry(60), { runs: 5, completions: 5 })).toBeNull();
    expect(suggestCadence(entry(60), { runs: 10, completions: 7 })).toBeNull(); // 70% → hold
  });
});
