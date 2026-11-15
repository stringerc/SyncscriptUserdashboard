import { describe, it, expect } from 'vitest';
import {
  validateCitedLines,
  parseBriefSections,
  renderBriefMarkdown,
  type PrepBrief,
  type PrepSource,
} from '../cortex-agents/prep';

const SRC = (kind: string, ref: string, text = 'x'): PrepSource => ({ kind: kind as any, ref, label: ref, text });
const known = new Map<string, PrepSource>([
  ['gmail:t1', SRC('gmail', 't1')],
  ['memory:alice', SRC('memory', 'alice')],
]);

describe('validateCitedLines — evidence contract', () => {
  it('keeps cited lines and drops uncited ones', () => {
    const r = validateCitedLines([
      '- Alice asked about the Q3 numbers — src: gmail:t1',
      '- Bob hates meetings', // no citation → dropped
      '- Prior sync covered pricing — src: memory:alice',
      '- Invented claim with fake src — src: gmail:nonexistent',
    ], known);
    expect(r.kept).toHaveLength(2);
    expect(r.dropped).toBe(2);
    expect(r.kept[0]).toContain('gmail:t1');
  });

  it('keeps headings untouched', () => {
    const r = validateCitedLines(['## History', '- item — src: gmail:t1'], known);
    expect(r.kept).toEqual(['## History', '- item — src: gmail:t1']);
  });

  it('is case-insensitive on kind but requires exact ref', () => {
    const r = validateCitedLines(['- x — src: GMAIL:t1'], known);
    expect(r.kept).toHaveLength(1);
  });
});

describe('parseBriefSections', () => {
  it('routes bullets to the right sections', () => {
    const p = parseBriefSections([
      'HISTORY',
      '- met in March — src: gmail:t1',
      'OPEN ITEMS',
      '- pricing TBD — src: memory:alice',
      'WATCH FOR',
      '- budget sensitivity',
    ].join('\n'));
    expect(p.history).toHaveLength(1);
    expect(p.openItems).toHaveLength(1);
    expect(p.watchFor).toHaveLength(1);
    expect(p.agenda).toHaveLength(0);
  });

  it('ignores bullets before any header', () => {
    const p = parseBriefSections('- orphan\nHISTORY\n- real — src: gmail:t1');
    expect(p.history).toHaveLength(1);
  });
});

describe('renderBriefMarkdown', () => {
  it('renders sections and notes dropped uncited claims', () => {
    const brief: PrepBrief = {
      id: 'prep-x',
      meetingTitle: 'Sync with Alice',
      attendees: ['Alice'],
      sections: { history: ['- a — src: gmail:t1'], openItems: [], agenda: [], watchFor: [] },
      sources: [SRC('gmail', 't1')],
      droppedUncited: 3,
      createdAt: 0,
    };
    const md = renderBriefMarkdown(brief);
    expect(md).toContain('# Prep — Sync with Alice');
    expect(md).toContain('## History');
    expect(md).toContain('3 uncited claim(s) dropped');
    expect(md).toContain('Sources: gmail:t1');
  });
});
