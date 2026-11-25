import { describe, it, expect } from 'vitest';
import {
  pickGreeting, GREETING_POOL, composeBrief, pickSpotlight,
  type BriefData,
} from '../cortex-morning-brief';
import { normalizeMentions, parseExtractionResponse, type LifeEvent } from '../cortex-life-radar';

const DAY = 86_400_000;

function baseData(over: Partial<BriefData> = {}): BriefData {
  return {
    dayKey: '2026-11-17',
    longDate: 'Tuesday, November 17',
    greeting: 'Good morning, Chief.',
    decisions: [{ id: 'd1', text: 'Appeal call with Justin White — ask: status + next filing window?', deadline: '10:00', source: 'proposal:x' }],
    events: [{ id: 'e1', title: 'Team sync', start: Date.now() + 3600_000, attendees: 3, hasPrepBrief: true }],
    stats: { completed: 12, verified: 9, failed: 2, failedTitles: ['builder: reddit draft', 'scout: scan'] },
    watchItems: [{ text: 'Incident open 14min', severity: 'warn' }],
    personalEvents: [{ id: 'p1', title: 'Call daughter', start: Date.now() + 8 * 3600_000, kind: 'family' }],
    radarHits: [{ id: 'r1', text: 'birthday: Justin White — Sat', needsApproval: true }],
    spotlight: { text: 'Old proposal about pricing', ageDays: 6 },
    prepStatus: { ready: 1, pending: 1, titles: ['team-sync'] },
    pendingProposalCount: 2,
    coverage: [{ source: 'gmail', ok: true }, { source: 'imessage', ok: false, note: 'permission denied' }],
    generatedAt: Date.now(),
    ...over,
  };
}

describe('greeting engine', () => {
  it('never repeats within 7 days across a month of picks', () => {
    const used: string[] = [];
    for (let i = 0; i < 30; i++) {
      const day = `2026-11-${String(i + 1).padStart(2, '0')}`;
      const g = pickGreeting(day, used);
      expect(used.slice(-7)).not.toContain(g);
      used.push(g);
    }
  });

  it('is deterministic for the same day+history', () => {
    expect(pickGreeting('2026-11-17', [])).toBe(pickGreeting('2026-11-17', []));
  });

  it('pool has no duplicate texts', () => {
    const texts = GREETING_POOL.map((g) => g.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('composeBrief', () => {
  it('puts decisions first (BLUF)', () => {
    const b = composeBrief(baseData());
    expect(b.sections[0].key).toBe('decisions');
    expect(b.phoneText.indexOf('DECISIONS NEEDED')).toBeLessThan(b.phoneText.indexOf('OVERNIGHT'));
  });

  it('stays under phone cap with realistic data', () => {
    const b = composeBrief(baseData());
    expect(b.phoneText.length).toBeLessThanOrEqual(3900);
  });

  it('personal events get their own billing section', () => {
    const b = composeBrief(baseData());
    const shape = b.sections.find((s) => s.key === 'shape');
    expect(shape?.lines.join('\n')).toContain('PERSONAL / FAMILY');
    expect(shape?.lines.join('\n')).toContain('Call daughter');
  });

  it('omits empty sections', () => {
    const b = composeBrief(baseData({ decisions: [], watchItems: [], radarHits: [], spotlight: undefined, prepStatus: { ready: 0, pending: 0, titles: [] } }));
    const keys = b.sections.map((s) => s.key);
    expect(keys).not.toContain('decisions');
    expect(keys).not.toContain('watch');
    expect(keys).not.toContain('radar');
    expect(keys).not.toContain('spotlight');
    expect(keys).not.toContain('prep');
    expect(keys).toContain('signoff'); // always present
  });

  it('names failures honestly in accomplishments', () => {
    const b = composeBrief(baseData());
    const acc = b.sections.find((s) => s.key === 'accomplishments');
    expect(acc?.lines.join('\n')).toContain('2 failed');
    expect(acc?.lines.join('\n')).toContain('reddit draft');
  });

  it('renders print HTML with all sections', () => {
    const b = composeBrief(baseData());
    expect(b.printHtml).toContain('<!DOCTYPE html>');
    expect(b.printHtml).toContain('DECISIONS NEEDED');
    expect(b.printHtml).toContain('PERSONAL');
  });

  it('keeps phone text plain and free of glyph/markdown noise', () => {
    const b = composeBrief(baseData());
    expect(b.phoneText).not.toContain('■');
    expect(b.phoneText).not.toContain('•');
    expect(b.phoneText).not.toContain('✗');
    expect(b.phoneText).not.toContain('_(');
    expect(b.phoneText).toContain('DECISIONS NEEDED');
    expect(b.phoneText).toContain('OVERNIGHT ACCOMPLISHMENTS');
  });

  it('dedupes watch items by severity and normalized text', () => {
    const b = composeBrief(baseData({
      watchItems: [
        { text: '10 distribution queue item(s) failed', severity: 'warn' },
        { text: '  10   DISTRIBUTION queue item(s) failed ', severity: 'warn' },
        { text: '10 distribution queue item(s) failed', severity: 'info' },
      ],
    }));
    const watch = b.sections.find((s) => s.key === 'watch');
    expect(watch?.lines).toHaveLength(2);
    expect(watch?.lines.join('\n')).toContain('[warn]');
    expect(watch?.lines.join('\n')).toContain('[info]');
  });

  it('stays under phone cap with oversized watch and radar input', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      text: `watch item ${i} `.repeat(8),
      severity: 'warn' as const,
    }));
    const radar = Array.from({ length: 30 }, (_, i) => ({
      id: `r${i}`,
      text: `radar item ${i} `.repeat(8),
      needsApproval: true,
    }));
    const b = composeBrief(baseData({ watchItems: many, radarHits: radar }));
    expect(b.phoneText.length).toBeLessThanOrEqual(3800);
    expect(b.phoneText).toContain('sources OK:');
  });
});

describe('life radar normalize', () => {
  const now = Date.now();
  const sourceText = 'Hey, don\'t forget court date is March 3rd at 9am. Also Justin White\'s birthday is coming up.';
  const existing: LifeEvent[] = [];
  const cal: { title: string; start: number }[] = [];

  it('accepts cited items above confidence floor', () => {
    const { events, dropped } = normalizeMentions([
      { kind: 'hard_date', title: 'Court date', dateStart: now + 30 * DAY, confidence: 0.9, quote: 'court date is March 3rd', people: [] },
    ], 'gmail', sourceText, existing, cal, now);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('candidate');
    expect(dropped).toHaveLength(0);
  });

  it('drops uncited items (quote not verbatim in source)', () => {
    const { events, dropped } = normalizeMentions([
      { kind: 'deadline', title: 'Fake deadline', dateStart: now + DAY, confidence: 0.9, quote: 'this phrase is not in the source at all' },
    ], 'gmail', sourceText, existing, cal, now);
    expect(events).toHaveLength(0);
    expect(dropped[0].reason).toBe('uncited');
  });

  it('drops low-confidence items', () => {
    const { events, dropped } = normalizeMentions([
      { kind: 'commitment', title: 'Maybe call someone', confidence: 0.4, quote: 'court date is March 3rd' },
    ], 'gmail', sourceText, existing, cal, now);
    expect(events).toHaveLength(0);
    expect(dropped[0].reason).toBe('low-confidence');
  });

  it('dedupes against existing ledger events', () => {
    const first = normalizeMentions([
      { kind: 'birthday', title: "Justin White's birthday", dateStart: now + 60 * DAY, confidence: 0.9, quote: 'birthday is coming up', recurrence: 'yearly' },
    ], 'gmail', sourceText, [], cal, now);
    const second = normalizeMentions(first.events.map((e) => ({
      kind: e.kind, title: e.title, dateStart: e.dateStart, confidence: 0.9,
      quote: 'birthday is coming up',
    })), 'imessage', sourceText, first.events, cal, now);
    expect(second.events).toHaveLength(0);
    expect(second.dropped[0].reason).toBe('dup-ledger');
  });

  it('dedupes against calendar feed', () => {
    const { events, dropped } = normalizeMentions([
      { kind: 'hard_date', title: 'Court hearing', dateStart: now + 30 * DAY + 3600_000, confidence: 0.9, quote: 'court date is March 3rd' },
    ], 'gmail', sourceText, [], [{ title: 'Court hearing today', start: now + 30 * DAY }], now);
    expect(events).toHaveLength(0);
    expect(dropped[0].reason).toBe('dup-calendar');
  });
});

describe('radar extraction parsing', () => {
  it('parses JSON array from model output', () => {
    const out = parseExtractionResponse('Here are items:\n[{"kind":"birthday","title":"X","confidence":0.9,"quote":"q"}]\nDone.');
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('birthday');
  });
  it('returns empty on non-JSON', () => {
    expect(parseExtractionResponse('no json here')).toHaveLength(0);
  });
});

describe('spotlight rotation', () => {
  it('requires age >= 3 days', () => {
    expect(pickSpotlight({ dayKey: '2026-11-17', oldestPendingProposal: { title: 'x', ageDays: 2 } })).toBeUndefined();
    expect(pickSpotlight({ dayKey: '2026-11-17', oldestPendingProposal: { title: 'old thing', ageDays: 5 } })?.text).toBe('old thing');
  });
});
