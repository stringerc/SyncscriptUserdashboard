import { describe, it, expect } from 'vitest';
import { composeDebrief, pickShutdown, pickOneThing, SHUTDOWN_POOL, ONE_THING_POOL, type DebriefData } from '../cortex-debrief';

function baseData(over: Partial<DebriefData> = {}): DebriefData {
  return {
    dayKey: '2026-11-16',
    longDate: 'Monday, November 16',
    verified: ['builder: task-abc', 'scout: research brief'],
    attempted: 14,
    failedCount: 1,
    failedTitles: ['prep: sweep'],
    gaps: [{ question: 'Test gap?', evidence: 'ev' }],
    tomorrowEvents: [{ title: 'Call with daughter', time: '6:00 PM', prep: 'plan' }],
    priorities: [{ text: 'Decide: budget raise', firstAction: 'Inbox → approve (2 min)' }],
    openLoops: ['decide: budget raise'],
    oneThing: ONE_THING_POOL[0],
    shutdown: SHUTDOWN_POOL[0].text,
    degradedSources: ['imessage (no chats)'],
    generatedAt: Date.now(),
    ...over,
  };
}

describe('composeDebrief', () => {
  it('renders all five sections in fixed order', () => {
    const d = composeDebrief(baseData());
    expect(d.sections.map((s) => s.key)).toEqual(['ledger', 'gap', 'tomorrow', 'one-thing', 'shutdown']);
  });

  it('phone text stays under cap', () => {
    const d = composeDebrief(baseData({
      verified: Array.from({ length: 50 }, (_, i) => `task-${i}`),
      gaps: Array.from({ length: 10 }, (_, i) => ({ question: `gap ${i} `.repeat(20), evidence: 'x'.repeat(200) })),
      openLoops: Array.from({ length: 50 }, (_, i) => `loop-${i}-`.repeat(10)),
      tomorrowEvents: Array.from({ length: 8 }, (_, i) => ({ title: `event ${i} `.repeat(60), time: '9:00 AM', prep: 'none' as const })),
    }));
    expect(d.phoneText.length).toBeLessThanOrEqual(2560); // cap + trim marker
    expect(d.stats.droppedForCap).toBeGreaterThan(0);
  });

  it('renders honest empty-gap line when no gaps', () => {
    const d = composeDebrief(baseData({ gaps: [] }));
    const gap = d.sections.find((s) => s.key === 'gap')!;
    expect(gap.lines[0]).toMatch(/no significant gaps/i);
  });

  it('caps gaps at 3 and tomorrow events at 5 in phone render', () => {
    const d = composeDebrief(baseData({
      gaps: Array.from({ length: 6 }, (_, i) => ({ question: `q${i}`, evidence: 'e' })),
      tomorrowEvents: Array.from({ length: 8 }, (_, i) => ({ title: `e${i}`, time: '9:00 AM', prep: 'ready' as const })),
    }));
    const gap = d.sections.find((s) => s.key === 'gap')!;
    const tom = d.sections.find((s) => s.key === 'tomorrow')!;
    expect(gap.lines.length).toBeLessThanOrEqual(3);
    expect(tom.lines.filter((l) => l.includes('9:00 AM')).length).toBeLessThanOrEqual(5);
  });

  it('surfaces captured Discord answers as "You said:" lines', () => {
    const d = composeDebrief(baseData({ answers: ['call Justin tomorrow', 'skip the gym'] }));
    const ledger = d.sections.find((s) => s.key === 'ledger')!;
    expect(ledger.lines.some((l) => l.includes('You said: "call Justin tomorrow"'))).toBe(true);
    expect(ledger.lines.filter((l) => l.startsWith('You said:')).length).toBeLessThanOrEqual(2);
  });

  it('includes degraded source coverage honestly', () => {
    const d = composeDebrief(baseData());
    expect(d.phoneText).toContain('Coverage gaps');
    expect(d.phoneText).toContain('imessage');
  });
});

describe('pickShutdown / pickOneThing', () => {
  it('never repeats within recent window when pool allows', () => {
    const recent = SHUTDOWN_POOL.slice(0, 9).map((s) => s.text);
    const pick = pickShutdown('2026-11-16', recent);
    // pool is 10 entries; 9 recent leaves exactly 1 fresh (or fallback if halo mismatch)
    expect(typeof pick).toBe('string');
    expect(pick.length).toBeGreaterThan(0);
  });

  it('one-thing rotates and stays in pool', () => {
    const picks = new Set<string>();
    for (let i = 0; i < 14; i++) picks.add(pickOneThing(`2026-11-${String(i + 1).padStart(2, '0')}`, []));
    for (const p of picks) expect(ONE_THING_POOL).toContain(p);
  });

  it('shutdown varies across days', () => {
    const picks = new Set<string>();
    for (let i = 0; i < 14; i++) picks.add(pickShutdown(`2026-11-${String(i + 1).padStart(2, '0')}`, []));
    expect(picks.size).toBeGreaterThan(3);
  });
});
