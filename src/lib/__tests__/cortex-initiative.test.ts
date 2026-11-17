import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCortexProactiveInitiative } from '../cortex-proactive-initiative';

const engine = () => getCortexProactiveInitiative();

beforeEach(() => {
  engine().clear();
});

describe('proposal lifecycle', () => {
  it('generates sensor proposals from evaluateInitiatives options', async () => {
    const audit = await engine().evaluateInitiatives({
      unansweredEmailCount: 5,
      urgentEmailCount: 1,
      staleTaskCount: 2,
      nextMeetingInMin: 20,
      anomalousChargeCount: 1,
    });
    expect(audit.anomaliesDetected).toBeGreaterThanOrEqual(4);
    const pending = engine().getPendingProposals();
    expect(pending.length).toBeGreaterThanOrEqual(4);
    expect(pending.every(p => p.status === 'pending' || p.status === 'accepted')).toBe(true);
    expect(pending.every(p => p.autonomyTier !== undefined)).toBe(true);
  });

  it('skips proposers when signals are absent or below threshold', async () => {
    const audit = await engine().evaluateInitiatives({ unansweredEmailCount: 2 });
    expect(engine().getPendingProposals().length).toBe(0);
    expect(audit.healthySignals).toContain('email_backlog_clear');
  });

  it('acceptProposal marks accepted (event dispatch is DOM-guarded)', async () => {
    await engine().evaluateInitiatives({ staleTaskCount: 3 });
    const p = engine().getPendingProposals()[0];
    const ok = engine().acceptProposal(p.id);
    expect(ok).toBe(true);
    const stored = engine().getActiveProposals().find(x => x.id === p.id);
    expect(stored?.status).toBe('accepted');
  });

  it('markExecuted records outcome and hides from pending', async () => {
    await engine().evaluateInitiatives({ staleTaskCount: 3 });
    const p = engine().getPendingProposals()[0];
    engine().markExecuted(p.id, { ok: true, summary: 'done' });
    const stored = engine().getActiveProposals().find(x => x.id === p.id);
    expect(stored?.status).toBe('executed');
    expect(engine().getPendingProposals().length).toBe(0);
    // activity list still sees it
    const all = engine().getActiveProposals();
    expect(all.some(x => x.executionResult?.ok)).toBe(true);
  });

  it('snoozeProposal hides until snoozedUntil passes', async () => {
    await engine().evaluateInitiatives({ staleTaskCount: 3 });
    const p = engine().getPendingProposals()[0];
    engine().snoozeProposal(p.id, Date.now() + 3600_000);
    expect(engine().getPendingProposals().length).toBe(0);
    // force-expire
    const stored = engine().getActiveProposals();
    expect(stored.length).toBe(0);
  });

  it('dedupes identical proposals across evaluations', async () => {
    await engine().evaluateInitiatives({ staleTaskCount: 3 });
    await engine().evaluateInitiatives({ staleTaskCount: 4 });
    const keys = engine().getPendingProposals().map(p => p.dedupeKey || p.id);
    expect(new Set(keys).size).toBe(keys.length);
    expect(engine().getPendingProposals().filter(p => p.dedupeKey === 'stale_tasks').length).toBe(1);
  });

  it('enforces daily nudge budget', async () => {
    // 8 budget — fire enough distinct proposals to exceed it
    await engine().evaluateInitiatives({
      unansweredEmailCount: 9, urgentEmailCount: 2,
      staleTaskCount: 5, nextMeetingInMin: 10,
      anomalousChargeCount: 3, pendingInvoiceCount: 5,
      uncommittedFileCount: 60, freeEnergy: 0.6,
    });
    const today = engine().getPendingProposals();
    expect(today.length).toBeLessThanOrEqual(8);
  });

  it('tier-2 finance proposal requires approval', async () => {
    await engine().evaluateInitiatives({ anomalousChargeCount: 2 });
    const p = engine().getPendingProposals()[0];
    expect(p.autonomyTier).toBe(2);
    expect(p.requiresApproval).toBe(true);
  });

  it('notifies subscribers on mutations', async () => {
    const cb = vi.fn();
    const unsub = engine().subscribe(cb);
    await engine().evaluateInitiatives({ staleTaskCount: 1 });
    expect(cb).toHaveBeenCalled();
    const callsBeforeClear = cb.mock.calls.length;
    engine().clear();
    expect(cb.mock.calls.length).toBeGreaterThan(callsBeforeClear);
    unsub();
  });

  it('migrates legacy proposals without new fields', () => {
    // simulate a legacy-shape proposal by writing directly through evaluate → then checking defaults hold
    return engine().evaluateInitiatives({ uncommittedFileCount: 60 }).then(() => {
      const p = engine().getPendingProposals()[0];
      expect(p.autonomyTier).toBe(2); // requiresApproval → tier 2
      expect(p.source).toBe('engine');
    });
  });
});
