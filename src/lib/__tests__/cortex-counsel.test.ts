import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate counsel state into a temp dir before importing the module.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'counsel-test-'));
process.env.CORTEX_AGENTS_STATE_DIR = tmp;

const {
  conveneCounsel,
  filePosition,
  openRebuttal,
  closeRebuttal,
  recordSynthesis,
  decideCounsel,
  cancelCounsel,
  pollBoard,
  listCounselSessions,
  getCounselSession,
} = await import('../cortex-counsel');

const validPos = {
  member: 'devin',
  stance: 'go' as const,
  confidence: 0.8,
  keyEvidence: ['endpoint returns 200'],
  risks: [],
  requiredConditions: [],
  reasoning: 'verified live',
};

describe('Cortex Counsel', () => {
  beforeEach(() => {
    fs.rmSync(path.join(tmp, 'counsel'), { recursive: true, force: true });
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('convenes a session with sane defaults', () => {
    const { session, error } = conveneCounsel({ question: 'Ship bundle v2?' });
    expect(error).toBeUndefined();
    expect(session!.id).toMatch(/^csl-/);
    expect(session!.status).toBe('positions');
    expect(session!.lane).toBe('reversible');
    expect(session!.members.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects empty question and single-member sessions', () => {
    expect(conveneCounsel({ question: '  ' }).error).toBeTruthy();
    expect(conveneCounsel({ question: 'x', members: ['devin'] }).error).toBeTruthy();
  });

  it('rejects positions without evidence (Evidence or Silence)', () => {
    const { session } = conveneCounsel({ question: 'q' });
    const bad = filePosition(session!.id, { ...validPos, keyEvidence: [] });
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/keyEvidence/);
    const noReasoning = filePosition(session!.id, { ...validPos, reasoning: '' });
    expect(noReasoning.ok).toBe(false);
  });

  it('rejects non-members and duplicate round-1 positions', () => {
    const { session } = conveneCounsel({ question: 'q' });
    expect(filePosition(session!.id, { ...validPos, member: 'nobody' }).ok).toBe(false);
    expect(filePosition(session!.id, validPos).ok).toBe(true);
    expect(filePosition(session!.id, validPos).ok).toBe(false);
    expect(filePosition(session!.id, validPos).error).toMatch(/already filed/);
  });

  it('walks the full lifecycle to cleared', () => {
    const { session } = conveneCounsel({ question: 'Ship it?', lane: 'hard' });
    filePosition(session!.id, validPos);
    filePosition(session!.id, { ...validPos, member: 'warden', stance: 'conditional', confidence: 0.6 });

    expect(openRebuttal(session!.id).ok).toBe(true);
    // Round-2 positions allowed now.
    expect(filePosition(session!.id, { ...validPos, member: 'devin', stance: 'go' }).ok).toBe(true);
    // But round-1 is closed — a member that skipped r1 cannot file r1 now.
    expect(closeRebuttal(session!.id).ok).toBe(true);

    const s = getCounselSession(session!.id)!;
    expect(s.status).toBe('synthesis');
    const syn = recordSynthesis(session!.id, {
      by: 'strategist',
      stanceTable: [], agreements: ['cost is low'], conflicts: [],
      unresolvedObjections: [], recommendation: 'go',
      text: 'Both members go; ship it.',
    });
    expect(syn.ok).toBe(true);
    expect(getCounselSession(session!.id)!.status).toBe('poll');

    const board = pollBoard(getCounselSession(session!.id)!);
    expect(board.counts.go).toBe(1);
    expect(board.counts.noResponse).toBeGreaterThan(0);

    const d = decideCounsel(session!.id, 'go', 'chris', 'looks good', 'prop-1');
    expect(d.ok).toBe(true);
    expect(getCounselSession(session!.id)!.verdict!.decision).toBe('go');
    expect(getCounselSession(session!.id)!.verdict!.proposalId).toBe('prop-1');
  });

  it('cannot decide before poll stage', () => {
    const { session } = conveneCounsel({ question: 'q' });
    expect(decideCounsel(session!.id, 'go', 'chris').ok).toBe(false);
  });

  it('enforces the daily cap', () => {
    process.env.CORTEX_COUNSEL_DAILY_CAP = '1';
    const first = conveneCounsel({ question: 'one' });
    expect(first.session).toBeTruthy();
    const second = conveneCounsel({ question: 'two' });
    expect(second.error).toMatch(/daily counsel cap/);
    delete process.env.CORTEX_COUNSEL_DAILY_CAP;
  });

  it('cancel works on open sessions but not cleared ones', () => {
    const { session } = conveneCounsel({ question: 'q' });
    expect(cancelCounsel(session!.id, 'chris').ok).toBe(true);
    expect(cancelCounsel(session!.id, 'chris').ok).toBe(false);
  });

  it('lists sessions newest-first', () => {
    conveneCounsel({ question: 'a' });
    conveneCounsel({ question: 'b' });
    const list = listCounselSessions();
    expect(list.length).toBe(2);
    expect(list[0].question).toBe('b');
  });
});
