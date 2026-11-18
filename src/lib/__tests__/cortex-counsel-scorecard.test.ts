import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'counsel-sc-'));
process.env.CORTEX_AGENTS_STATE_DIR = tmp;
const { computeCounselScorecard } = await import('../cortex-agents/counsel-scorecard');
const { conveneCounsel, filePosition, decideCounsel, openRebuttal, closeRebuttal, recordSynthesis } = await import('../cortex-counsel');

function clear() {
  fs.rmSync(path.join(tmp, 'counsel'), { recursive: true, force: true });
}

function pos(member: string, stance: 'go' | 'no-go' | 'conditional', confidence = 0.8) {
  return { member, stance, confidence, keyEvidence: ['evidence-x'], reasoning: 'because reasons', risks: [], requiredConditions: [] };
}

/** Drive a session to 'cleared' with a given verdict. */
function runSession(verdict: 'go' | 'no-go', stances: Record<string, 'go' | 'no-go' | 'conditional'>) {
  const { session } = conveneCounsel({
    question: 'test question?',
    members: Object.keys(stances),
    lane: 'reversible',
  });
  const id = session!.id;
  for (const [m, s] of Object.entries(stances)) filePosition(id, pos(m, s));
  openRebuttal(id); closeRebuttal(id);
  recordSynthesis(id, { by: 'strategist', stanceTable: [], agreements: [], conflicts: [], unresolvedObjections: [], recommendation: verdict, text: 'syn' });
  decideCounsel(id, verdict, 'user');
  return id;
}

describe('counsel scorecard', () => {
  beforeEach(() => { clear(); });

  it('grades a consistently-aligned member A after enough sessions', () => {
    for (let i = 0; i < 3; i++) runSession('go', { devin: 'go', warden: 'no-go' });
    const sc = computeCounselScorecard();
    const devin = sc.find((m) => m.id === 'devin')!;
    const warden = sc.find((m) => m.id === 'warden')!;
    expect(devin.alignment).toBe(1);
    expect(devin.grade).toBe('A');
    expect(warden.alignment).toBe(0);
    expect(warden.grade).toBe('D');
    expect(warden.flags).toContain('below-coin-flip alignment');
  });

  it('excludes conditional stances from scoring', () => {
    for (let i = 0; i < 3; i++) runSession('go', { devin: 'conditional', sentinel: 'go' });
    const devin = computeCounselScorecard().find((m) => m.id === 'devin')!;
    expect(devin.scored).toBe(0);
    expect(devin.alignment).toBeNull();
    expect(devin.grade).toBeNull(); // nothing decisive to grade
  });

  it('returns null grades with small samples — honest, not punitive', () => {
    runSession('go', { devin: 'go', sentinel: 'go' });
    const devin = computeCounselScorecard().find((m) => m.id === 'devin')!;
    expect(devin.grade).toBeNull();
    expect(devin.flags[0]).toContain('insufficient sample');
  });
});
