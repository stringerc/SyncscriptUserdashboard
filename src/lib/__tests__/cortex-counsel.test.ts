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
  markCounselDiscordNotified,
  autoClearCounselPolls,
  detectBeliefClashes,
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

  it('auto-clear respects env gate, lane, no-go votes, and timeout', () => {
    // Build a poll-stage reversible session with only go/conditional votes.
    const { session } = conveneCounsel({ question: 'auto?', lane: 'reversible' });
    filePosition(session!.id, validPos);
    openRebuttal(session!.id);
    closeRebuttal(session!.id);
    recordSynthesis(session!.id, {
      by: 'strategist', stanceTable: [], agreements: [], conflicts: [],
      unresolvedObjections: [], recommendation: 'go', text: 'go',
    });
    expect(getCounselSession(session!.id)!.status).toBe('poll');

    // Gate OFF by default → nothing clears.
    expect(autoClearCounselPolls()).toBe(0);

    // Gate ON but timeout not reached → nothing clears.
    process.env.CORTEX_COUNSEL_AUTO_CLEAR = '1';
    expect(autoClearCounselPolls()).toBe(0);

    // Timeout reached → clears with autoCleared flag.
    const future = Date.now() + 200 * 60_000;
    expect(autoClearCounselPolls({ now: future, pollTimeoutMs: 120 * 60_000 })).toBe(1);
    const cleared = getCounselSession(session!.id)!;
    expect(cleared.status).toBe('cleared');
    expect(cleared.autoCleared).toBe(true);
    expect(cleared.verdict!.by).toBe('auto-counsel');
    delete process.env.CORTEX_COUNSEL_AUTO_CLEAR;
  });

  it('auto-clear never fires on hard lane or with a no-go vote', () => {
    process.env.CORTEX_COUNSEL_AUTO_CLEAR = '1';
    const future = Date.now() + 300 * 60_000;

    // Hard lane poll.
    const h = conveneCounsel({ question: 'hard?', lane: 'hard' });
    filePosition(h.session!.id, validPos);
    openRebuttal(h.session!.id); closeRebuttal(h.session!.id);
    recordSynthesis(h.session!.id, { by: 's', stanceTable: [], agreements: [], conflicts: [], unresolvedObjections: [], recommendation: 'go', text: 'x' });
    expect(autoClearCounselPolls({ now: future, pollTimeoutMs: 1 })).toBe(0);
    expect(getCounselSession(h.session!.id)!.status).toBe('poll');

    // Reversible but a member said no-go.
    const n = conveneCounsel({ question: 'nogo?', lane: 'reversible' });
    filePosition(n.session!.id, { ...validPos, stance: 'no-go' });
    openRebuttal(n.session!.id); closeRebuttal(n.session!.id);
    recordSynthesis(n.session!.id, { by: 's', stanceTable: [], agreements: [], conflicts: [], unresolvedObjections: [], recommendation: 'no-go', text: 'x' });
    expect(autoClearCounselPolls({ now: future, pollTimeoutMs: 1 })).toBe(0);
    expect(getCounselSession(n.session!.id)!.status).toBe('poll');
    delete process.env.CORTEX_COUNSEL_AUTO_CLEAR;
  });

  it('discord notify marker is idempotent', () => {
    const { session } = conveneCounsel({ question: 'q' });
    // Not in poll yet — mark anyway is allowed (sweep only calls on poll);
    // marker itself is a plain flag.
    expect(markCounselDiscordNotified(session!.id)).toBe(true);
    expect(markCounselDiscordNotified(session!.id)).toBe(false);
  });

  it('lists sessions newest-first', () => {
    conveneCounsel({ question: 'a' });
    conveneCounsel({ question: 'b' });
    const list = listCounselSessions();
    expect(list.length).toBe(2);
    expect(list[0].question).toBe('b');
  });
});

// ── Internal console position worker + Discord decide buttons ──────

const { runCounselPosition } = await import('../cortex-agents/counsel-position');
const { handleDiscordInteraction } = await import('../cortex-discord');

function stubCtx(sessionId: string, llmJson: string) {
  return {
    task: { kind: 'counsel_position', input: { sessionId } },
    progress: () => {},
    llm: async () => llmJson,
  } as any;
}

describe('counsel_position worker', () => {
  beforeEach(() => {
    fs.rmSync(path.join(tmp, 'counsel'), { recursive: true, force: true });
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const GO_JSON = JSON.stringify({
    stance: 'go', confidence: 0.7,
    keyEvidence: ['endpoint verified 200'], risks: [], requiredConditions: [],
    reasoning: 'evidence-backed go',
  });

  it('files an evidence-backed position on an open session', async () => {
    const { session } = conveneCounsel({ question: 'ship it?', members: ['sentinel', 'user'] });
    const res: any = await runCounselPosition(stubCtx(session!.id, GO_JSON), 'sentinel', 'EECOM');
    expect(res.filed).toBe(true);
    expect(res.round).toBe(1);
    const s = getCounselSession(session!.id)!;
    expect(s.positions.some((p) => p.member === 'sentinel' && p.round === 1)).toBe(true);
  });

  it('refuses non-member consoles and closed sessions', async () => {
    const { session } = conveneCounsel({ question: 'q', members: ['devin', 'user'] });
    const res: any = await runCounselPosition(stubCtx(session!.id, GO_JSON), 'sentinel', 'EECOM');
    expect(res.error).toMatch(/not a member/);

    const c = conveneCounsel({ question: 'q2', members: ['sentinel', 'user'] });
    cancelCounsel(c.session!.id, 'user');
    const res2: any = await runCounselPosition(stubCtx(c.session!.id, GO_JSON), 'sentinel', 'EECOM');
    expect(res2.error).toMatch(/not collecting|not found|cancelled/i);
  });

  it('dedupes a second filing in the same round', async () => {
    const { session } = conveneCounsel({ question: 'q', members: ['sentinel', 'user'] });
    await runCounselPosition(stubCtx(session!.id, GO_JSON), 'sentinel', 'EECOM');
    const res: any = await runCounselPosition(stubCtx(session!.id, GO_JSON), 'sentinel', 'EECOM');
    expect(res.error).toMatch(/already filed/);
  });
});

describe('Discord counsel buttons', () => {
  beforeEach(() => {
    fs.rmSync(path.join(tmp, 'counsel'), { recursive: true, force: true });
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const deps: any = {
    ownerId: 'OWNER',
    decideCounsel: (sid: string, decision: string) => decideCounsel(sid, decision as any, 'discord:OWNER'),
  };
  const click = (customId: string, userId = 'OWNER') =>
    handleDiscordInteraction({ type: 3, user: { id: userId }, data: { custom_id: customId } }, deps);

  it('owner GO button records a poll verdict', async () => {
    const { session } = conveneCounsel({ question: 'q', lane: 'reversible' });
    filePosition(session!.id, validPos);
    openRebuttal(session!.id); closeRebuttal(session!.id);
    recordSynthesis(session!.id, { by: 's', stanceTable: [], agreements: [], conflicts: [], unresolvedObjections: [], recommendation: 'go', text: 'x' });
    expect(getCounselSession(session!.id)!.status).toBe('poll');

    const res: any = await click(`counsel:go:${session!.id}`);
    expect(res.type).toBe(7);
    expect(getCounselSession(session!.id)!.status).toBe('cleared');
  });

  it('non-owner is rejected before the button handler', async () => {
    const { session } = conveneCounsel({ question: 'q' });
    const res: any = await click(`counsel:nogo:${session!.id}`, 'RANDO');
    expect(res.type).toBe(4);
    expect(getCounselSession(session!.id)!.status).not.toBe('cleared');
  });

  it('double-decision on a decided session reports failure honestly', async () => {
    const { session } = conveneCounsel({ question: 'q', lane: 'reversible' });
    filePosition(session!.id, validPos);
    openRebuttal(session!.id); closeRebuttal(session!.id);
    recordSynthesis(session!.id, { by: 's', stanceTable: [], agreements: [], conflicts: [], unresolvedObjections: [], recommendation: 'go', text: 'x' });
    await click(`counsel:go:${session!.id}`);
    const res2: any = await click(`counsel:nogo:${session!.id}`);
    expect(res2.type).toBe(7);
    expect(String(res2.data.content)).toMatch(/Could not resolve|already/i);
    expect(getCounselSession(session!.id)!.status).toBe('cleared');
  });

  it('detects belief clashes when members hold opposing high-confidence stances', () => {
    const { session } = conveneCounsel({
      question: 'Migrate to SQLite?',
      members: ['builder', 'sentinel', 'strategist', 'user'],
    });
    const p1 = filePosition(session!.id, {
      member: 'builder',
      stance: 'go',
      confidence: 0.9,
      keyEvidence: ['clean single-file portability'],
      risks: [],
      requiredConditions: [],
      reasoning: 'SQLite reduces operational overhead significantly',
    });
    expect(p1.ok).toBe(true);

    const p2 = filePosition(session!.id, {
      member: 'sentinel',
      stance: 'no-go',
      confidence: 0.85,
      keyEvidence: ['concurrent write contention under burst traffic'],
      risks: ['database lock timeouts'],
      requiredConditions: [],
      reasoning: 'Multi-agent write concurrency causes database lock contention',
    });
    expect(p2.ok).toBe(true);

    const clashes = detectBeliefClashes([getCounselSession(session!.id)!]);
    expect(clashes).toHaveLength(1);
    expect(clashes[0].memberA).toBe('builder');
    expect(clashes[0].memberB).toBe('sentinel');
    expect(clashes[0].severity).toBe('critical');
    expect(clashes[0].divergenceScore).toBeCloseTo(0.875);
  });
});
