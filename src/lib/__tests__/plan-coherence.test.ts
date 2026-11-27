import { describe, it, expect } from 'vitest';
import { strategyClassOf } from '../consciousness/social-tom';
import { planGate, planContextFor, type GoalCoherence, type PlanCoherenceReport } from '../cortex-agent/plan-coherence';

describe('strategyClassOf', () => {
  it('classifies kinds by approach', () => {
    expect(strategyClassOf('repo_scan')).toBe('research');
    expect(strategyClassOf('recall')).toBe('memory');
    expect(strategyClassOf('handoff')).toBe('comms');
    expect(strategyClassOf('catalog_scan')).toBe('watch');
    expect(strategyClassOf('verify_gate')).toBe('verify');
    expect(strategyClassOf('goal_plan')).toBe('strategy');
    expect(strategyClassOf('reddit_draft')).toBe('distribution');
    expect(strategyClassOf('orchestrate')).toBe('build');
    expect(strategyClassOf('zzz_unknown')).toBe('general');
  });
});

function rep(level: GoalCoherence['level'], over: Partial<GoalCoherence> = {}): PlanCoherenceReport {
  const g: GoalCoherence = {
    goalId: 'g1', goalTitle: 'Test goal', nodes: 4, done: 1, pending: 3,
    stale: 0, tasks24h: 0, oldestPendingH: 72, score: 0.2, level, ...over,
  };
  return { computedAt: Date.now(), primaryGoalId: 'g1', goals: [g], level, score: g.score };
}

describe('planGate', () => {
  it('allows everything when coherent', () => {
    const d = planGate('orchestrate', 'big mission', false, rep('coherent'));
    expect(d.allow).toBe(true);
  });

  it('defers unattributed heavy work when stalled', () => {
    const d = planGate('orchestrate', 'rebuild the pipeline', false, rep('stalled'));
    expect(d.allow).toBe(false);
    expect(d.reason).toMatch(/coherence stalled/);
  });

  it('passes explicitly goal-attributed work even when stalled', () => {
    const d = planGate('orchestrate', 'corrective mission', true, rep('stalled'));
    expect(d.allow).toBe(true);
  });

  it('passes essential kinds when stalled', () => {
    expect(planGate('patrol', 'fleet check', false, rep('stalled')).allow).toBe(true);
    expect(planGate('comm', 'say hello', false, rep('stalled')).allow).toBe(true);
  });

  it('passes light work when stalled', () => {
    expect(planGate('recall', 'look something up', false, rep('stalled')).allow).toBe(true);
  });
});

describe('planContextFor', () => {
  it('returns null without a goalId', () => {
    expect(planContextFor({})).toBeNull();
    expect(planContextFor({ goalId: 42 })).toBeNull();
  });
});
