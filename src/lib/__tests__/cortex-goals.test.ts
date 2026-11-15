import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCortexGoals } from '../cortex-goals';
import { getCortexProactiveInitiative } from '../cortex-proactive-initiative';

const goals = () => getCortexGoals();
const engine = () => getCortexProactiveInitiative();

beforeEach(() => {
  engine().clear();
  goals().clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('goal store', () => {
  it('declares, lists, and transitions goal status', () => {
    const g = goals().declare({ title: 'Ship Cortex Phase 1', horizon: 'quarter', signals: ['commits_per_week'] });
    expect(g.status).toBe('active');
    expect(goals().list('active')).toHaveLength(1);
    expect(goals().setStatus(g.id, 'paused')).toBe(true);
    expect(goals().list('active')).toHaveLength(0);
    expect(goals().list('paused')).toHaveLength(1);
    expect(goals().setStatus('nonexistent', 'achieved')).toBe(false);
  });

  it('records signal history per period', () => {
    const g = goals().declare({ title: 'G', signals: ['commits_per_week'] });
    expect(goals().recordSignal(g.id, { commits_per_week: 12 }, '2026-W40')).toBe(true);
    expect(goals().recordSignal(g.id, { commits_per_week: 10 }, '2026-W41')).toBe(true);
    const fetched = goals().get(g.id)!;
    expect(fetched.history).toHaveLength(2);
  });
});

describe('drift detection', () => {
  it('scores high drift when current signals collapse vs baseline', () => {
    const g = goals().declare({ title: 'Ship feature', signals: ['commits_per_week'] });
    goals().recordSignal(g.id, { commits_per_week: 10 }, '2026-W40');
    goals().recordSignal(g.id, { commits_per_week: 12 }, '2026-W41');
    const score = goals().computeDrift(goals().get(g.id)!, { commits_per_week: 1 });
    expect(score).toBe(1); // 1 < 0.4 * 11 baseline
  });

  it('scores zero drift when on baseline and when no baseline exists', () => {
    const g = goals().declare({ title: 'New goal', signals: ['commits_per_week'] });
    // no history → neutral
    expect(goals().computeDrift(goals().get(g.id)!, { commits_per_week: 0 })).toBe(0);
    goals().recordSignal(g.id, { commits_per_week: 8 }, '2026-W40');
    expect(goals().computeDrift(goals().get(g.id)!, { commits_per_week: 8 })).toBe(0);
  });

  it('emits a drift proposal after 2 consecutive drifted weekly reviews', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T12:00:00Z'));

    const g = goals().declare({ title: 'Ship Cortex', signals: ['commits_per_week'] });
    goals().recordSignal(g.id, { commits_per_week: 10 }, '2025-W50');

    // Week 1 review: drifted
    let r = goals().reviewGoals({ commits_per_week: 1 });
    expect(r.reviewed).toBe(1);
    expect(goals().get(g.id)!.driftWeeks).toBe(1);
    expect(engine().getPendingProposals().filter(p => p.dedupeKey === `goal_drift_${g.id}`)).toHaveLength(0);

    // Advance past weekly gate
    vi.setSystemTime(new Date('2026-01-13T12:00:00Z'));
    r = goals().reviewGoals({ commits_per_week: 1 });
    expect(goals().get(g.id)!.driftWeeks).toBe(2);
    const driftProps = engine().getPendingProposals().filter(p => p.dedupeKey === `goal_drift_${g.id}`);
    expect(driftProps).toHaveLength(1);
    expect(driftProps[0].suggestedTool).toBe('cortex_goals');
    expect(driftProps[0].autonomyTier).toBe(1);
    expect(driftProps[0].why).toContain('drift=');
  });

  it('resets drift streak when signals recover', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T12:00:00Z'));
    const g = goals().declare({ title: 'G', signals: ['commits_per_week'] });
    goals().recordSignal(g.id, { commits_per_week: 10 }, '2025-W50');
    goals().reviewGoals({ commits_per_week: 1 });
    expect(goals().get(g.id)!.driftWeeks).toBe(1);
    vi.setSystemTime(new Date('2026-01-13T12:00:00Z'));
    goals().reviewGoals({ commits_per_week: 10 }); // recovered
    expect(goals().get(g.id)!.driftWeeks).toBe(0);
  });
});

describe('baseline forecasting', () => {
  it('returns null below minimum sample size', () => {
    for (let i = 0; i < 7; i++) goals().recordPattern('weekday:thu:gym', true);
    expect(goals().forecast('weekday:thu:gym')).toBeNull();
  });

  it('forecasts skip rate with honest sample size', () => {
    // 10 skips out of 14 Thursdays
    for (let i = 0; i < 10; i++) goals().recordPattern('weekday:thu:gym', true);
    for (let i = 0; i < 4; i++) goals().recordPattern('weekday:thu:gym', false);
    const f = goals().forecast('weekday:thu:gym')!;
    expect(f.samples).toBe(14);
    expect(f.rate).toBeCloseTo(10 / 14, 5);
  });
});
