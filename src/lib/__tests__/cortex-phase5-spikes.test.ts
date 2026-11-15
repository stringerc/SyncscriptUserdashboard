import { describe, it, expect, beforeEach } from 'vitest';
import { deriveSomaticState, type SomaticSample } from '../cortex-somatic';
import { getCortexAttentionFirewall } from '../cortex-attention-firewall';
import { getCortexGoals } from '../cortex-goals';
import { negotiateMeetingSlot } from '../cortex-diplomacy';
import { getCortexProactiveInitiative } from '../cortex-proactive-initiative';

const engine = () => getCortexProactiveInitiative();

beforeEach(() => {
  engine().clear();
  getCortexGoals().clear();
});

// ── 5.1 Somatic signals ────────────────────────────────────────────

describe('somatic state derivation', () => {
  const base = 1_700_000_000_000;
  const mk = (i: number, over: Partial<SomaticSample>): SomaticSample => ({
    at: base + i * 86400_000, source: 'wearable', ...over,
  });

  it('detects HRV drop vs baseline', () => {
    const samples: SomaticSample[] = [];
    for (let i = 0; i < 10; i++) samples.push(mk(i, { hrvMs: 50 }));
    samples.push(mk(10, { hrvMs: 35 })); // -30%
    const st = deriveSomaticState(samples, base + 11 * 86400_000);
    expect(st.hrvDeltaPct).toBeCloseTo(-0.3, 1);
    expect(st.stressScore).toBeGreaterThan(0.4);
  });

  it('counts consecutive late nights and sleep debt', () => {
    const samples: SomaticSample[] = [
      mk(0, { bedtimeHour: 22, sleepHours: 8 }),
      mk(1, { bedtimeHour: 25.5, sleepHours: 5 }),
      mk(2, { bedtimeHour: 26, sleepHours: 4 }),
      mk(3, { bedtimeHour: 25, sleepHours: 6 }),
    ];
    const st = deriveSomaticState(samples, base + 4 * 86400_000);
    expect(st.consecutiveLateNights).toBe(3);
    expect(st.sleepDebtHours).toBeGreaterThan(0);
  });

  it('somatic proposer fires on HRV drop + late nights', async () => {
    const audit = await engine().evaluateInitiatives({
      hrvDeltaPct: -0.25,
      consecutiveLateNights: 4,
      somaticStressScore: 0.8,
      sleepDebtHours: 6,
    });
    const props = engine().getPendingProposals();
    expect(props.some(p => p.dedupeKey === 'somatic_recovery')).toBe(true);
    expect(audit.anomaliesDetected).toBeGreaterThan(0);
  });
});

// ── 5.2 Attention firewall ─────────────────────────────────────────

describe('attention firewall', () => {
  it('always interrupts vital items', () => {
    const fw = getCortexAttentionFirewall();
    const v = fw.evaluate({ source: 'email', title: 'URGENT: server down in production' });
    expect(v.interrupt).toBe(true);
    expect(v.score).toBeGreaterThan(0.9);
  });

  it('suppresses non-vital noise by default', () => {
    const fw = getCortexAttentionFirewall();
    const v = fw.evaluate({ source: 'notification', title: 'You have a new follower' });
    expect(v.interrupt).toBe(false);
    expect(v.reason).toContain('suppressed');
  });

  it('interrupts items strongly aligned with an active goal', () => {
    getCortexGoals().declare({ title: 'Ship Cortex visualizer', horizon: 'month' });
    const fw = getCortexAttentionFirewall();
    const v = fw.evaluate({ source: 'email', title: 'Cortex visualizer regression report from CI' });
    expect(v.interrupt).toBe(true);
    expect(v.matchedGoal).toBe('Ship Cortex visualizer');
  });
});

// ── 5.3 Diplomacy prototype ────────────────────────────────────────

describe('cortex diplomacy prototype', () => {
  const t = (h: number) => 1_700_000_000_000 + h * 3600_000;
  const slot = (h: number) => ({ start: t(h), end: t(h + 1), label: `slot-${h}` });

  it('agrees immediately on shared top choice', () => {
    const r = negotiateMeetingSlot('cortex-a', 'cortex-b', [slot(14)], [slot(14)], 'escrow-1');
    expect(r.agreed?.start).toBe(t(14));
    expect(r.escrowed).toBe(true);
    expect(r.transcript.map(m => m.type)).toEqual(['proposal', 'accept']);
  });

  it('negotiates down ranked lists to a mutual slot', () => {
    const r = negotiateMeetingSlot(
      'cortex-a', 'cortex-b',
      [slot(9), slot(14), slot(16)],
      [slot(14), slot(16)],
    );
    expect(r.agreed?.start).toBe(t(14));
    expect(r.transcript.some(m => m.type === 'counter')).toBe(true);
  });

  it('aborts when no mutual slot exists', () => {
    const r = negotiateMeetingSlot('cortex-a', 'cortex-b', [slot(9)], [slot(18)]);
    expect(r.agreed).toBeNull();
    expect(r.transcript.at(-1)?.type).toBe('abort');
  });

  it('commitment without escrow ref is flagged unsecured', () => {
    const r = negotiateMeetingSlot('cortex-a', 'cortex-b', [slot(10)], [slot(10)]);
    expect(r.agreed).not.toBeNull();
    expect(r.escrowed).toBe(false); // agreed but NOT human-escrowed
  });
});
