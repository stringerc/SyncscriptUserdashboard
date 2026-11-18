import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'initiative-ledger-test-'));
process.env.CORTEX_AGENTS_STATE_DIR = tmp;

const ledger = await import('../cortex-initiative-ledger');

function prop(over: Record<string, unknown> = {}) {
  return {
    id: `p-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test proposal',
    summary: 'desc',
    category: 'system_resonance',
    urgency: 'medium',
    epistemicConfidence: 0.7,
    createdAt: Date.now(),
    requiresApproval: false,
    suggestedTool: 'cortex_goals',
    suggestedArgs: {},
    status: 'pending',
    ...over,
  };
}

beforeEach(() => {
  fs.writeFileSync(path.join(tmp, 'initiative-ledger.json'), JSON.stringify({ version: 1, proposals: [] }));
});

describe('initiative ledger', () => {
  it('upserts synced proposals and reads them back', () => {
    const p = prop({ id: 'sync-1' });
    const out = ledger.syncProposals([p]);
    expect(out.upserted).toBe(1);
    const all = ledger.listProposals();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('sync-1');
    expect(all[0].suggestedTool).toBe('cortex_goals');
    // persistence readback
    const raw = JSON.parse(fs.readFileSync(path.join(tmp, 'initiative-ledger.json'), 'utf8'));
    expect(raw.proposals).toHaveLength(1);
  });

  it('server-side approved status survives a client pending re-sync', () => {
    ledger.syncProposals([prop({ id: 'keep-1' })]);
    ledger.approveProposal('keep-1', 'agent:prep');
    ledger.syncProposals([prop({ id: 'keep-1', status: 'pending' })]);
    const p = ledger.getProposal('keep-1');
    expect(p?.status).toBe('approved');
    expect(p?.approvedBy).toBe('agent:prep');
  });

  it('client-reported executed/failed/dismissed statuses are adopted', () => {
    ledger.syncProposals([prop({ id: 'done-1', status: 'executed', executionResult: { ok: true, summary: 'ok', atMs: 1 } })]);
    const p = ledger.getProposal('done-1');
    expect(p?.status).toBe('executed');
    expect(p?.executionResult?.ok).toBe(true);
  });

  it('dedupes pending proposals by dedupeKey, keeps terminal ones', () => {
    ledger.syncProposals([
      prop({ id: 'a', dedupeKey: 'k1' }),
      prop({ id: 'b', dedupeKey: 'k1' }),
    ]);
    const pending = ledger.pendingDecisions();
    expect(pending).toHaveLength(1);
  });

  it('approveProposal only moves pending → approved', () => {
    ledger.syncProposals([prop({ id: 'ap-1' })]);
    expect(ledger.approveProposal('ap-1', 'crew')?.status).toBe('approved');
    expect(ledger.approveProposal('ap-1', 'crew')).toBeNull(); // no longer pending
    expect(ledger.approvedAwaitingPickup().map((p) => p.id)).toContain('ap-1');
  });

  it('reportExecuted flips approved → executed/failed with summary', () => {
    ledger.syncProposals([prop({ id: 'ex-1' })]);
    ledger.approveProposal('ex-1', 'crew');
    ledger.reportExecuted('ex-1', false, 'tool error');
    const p = ledger.getProposal('ex-1');
    expect(p?.status).toBe('failed');
    expect(p?.executionResult?.summary).toBe('tool error');
  });

  it('drainSafePending approves only safe tier-1 whitelisted tools', () => {
    ledger.syncProposals([
      prop({ id: 'safe-1', suggestedTool: 'cortex_goals', autonomyTier: 1 }),
      prop({ id: 'unsafe-1', suggestedTool: 'run_command', autonomyTier: 1 }),
      prop({ id: 'tier2-1', suggestedTool: 'cortex_goals', autonomyTier: 2, requiresApproval: true }),
    ]);
    const out = ledger.drainSafePending('agent:prep');
    expect(out.approved.map((p) => p.id)).toEqual(['safe-1']);
    expect(out.skipped).toBe(2);
    expect(ledger.getProposal('unsafe-1')?.status).toBe('pending');
    expect(ledger.getProposal('tier2-1')?.status).toBe('pending');
  });

  it('client-accepted proposals mirror as approved (awaiting pickup, not pending)', () => {
    ledger.syncProposals([prop({ id: 'acc-1', status: 'accepted' })]);
    const p = ledger.getProposal('acc-1');
    expect(p?.status).toBe('approved');
    expect(p?.approvedBy).toBe('client:auto');
    // and it is not re-approvable
    expect(ledger.approveProposal('acc-1', 'agent:prep')).toBeNull();
  });

  it('isSafeAutoProposal rejects tier-2 and non-whitelisted tools', () => {
    expect(ledger.isSafeAutoProposal({ autonomyTier: 1, requiresApproval: false, suggestedTool: 'cortex_metacognition' })).toBe(true);
    expect(ledger.isSafeAutoProposal({ autonomyTier: 1, requiresApproval: false, suggestedTool: 'cortex_search' })).toBe(true);
    expect(ledger.isSafeAutoProposal({ autonomyTier: 1, requiresApproval: false, suggestedTool: 'read_file' })).toBe(true);
    expect(ledger.isSafeAutoProposal({ autonomyTier: 1, requiresApproval: false, suggestedTool: 'cortex_govtech' })).toBe(true);
    expect(ledger.isSafeAutoProposal({ autonomyTier: 2, requiresApproval: false, suggestedTool: 'cortex_goals' })).toBe(false);
    expect(ledger.isSafeAutoProposal({ autonomyTier: 1, requiresApproval: true, suggestedTool: 'cortex_goals' })).toBe(false);
    expect(ledger.isSafeAutoProposal({ autonomyTier: 1, requiresApproval: false, suggestedTool: 'gmail_send' })).toBe(false);
    expect(ledger.isSafeAutoProposal({ autonomyTier: 1, requiresApproval: false, suggestedTool: 'run_command' })).toBe(false);
  });
});
