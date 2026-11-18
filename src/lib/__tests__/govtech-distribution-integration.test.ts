import { describe, it, expect } from 'vitest';
import { runSamGovCapture, ITEM_HANDLERS } from '../cortex-agents/distribution';
import type { AgentContext } from '../cortex-agents/types';
import fs from 'node:fs';
import path from 'node:path';

describe('Nexus Foundry Distributor Worker - SAM.gov GovTech Capture', () => {
  const dummyCtx: AgentContext = {
    task: {
      id: 'task-test-govtech',
      agentId: 'distributor',
      kind: 'sam_gov_capture',
      title: 'SAM.gov capture test',
      status: 'running',
      progress: 0,
      createdAt: Date.now(),
      input: {},
    },
    signal: new AbortController().signal,
    progress: () => {},
    emit: () => {},
    telemetry: { toolCalls: 0, toolFailures: 0, llmCalls: 0, tokensIn: 0, tokensOut: 0, llmMs: 0 },
    llm: async () => 'test',
  };

  it('registers sam_gov_capture in ITEM_HANDLERS', () => {
    expect(ITEM_HANDLERS.sam_gov_capture).toBeDefined();
    expect(typeof ITEM_HANDLERS.sam_gov_capture).toBe('function');
  });

  it('runs sam_gov_capture, synthesizes certified proposals, and pauses at staged_pending_human', async () => {
    const result = (await runSamGovCapture(dummyCtx, {
      noticeId: 'W911QX-26-Q-0042',
      useMock: true,
      humanApproved: false, // Invariant: human approval not granted yet
    })) as any;

    expect(result.ok).toBe(true);
    expect(result.noticeId).toBe('W911QX-26-Q-0042');
    expect(result.staged_pending_human).toBe(true);
    expect(result.awaitingHumanApproval).toBe(true);
    expect(result.proposal).toBeDefined();
    expect(result.proposal.contractor.cage).toBe('1AGF9');
    expect(result.proposal.contractor.uei).toBe('R435EYG6WTX4');
    expect(result.proposal.certified).toBe(true);

    // Verify dossier written to disk
    const reportPath = path.resolve(process.cwd(), '.cortex/reports/govtech/W911QX-26-Q-0042.json');
    expect(fs.existsSync(reportPath)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    expect(saved.noticeId).toBe('W911QX-26-Q-0042');
    expect(saved.staged_pending_human).toBe(true);
  });

  it('authorizes and dispatches proposal when humanApproved is explicitly true', async () => {
    const result = (await runSamGovCapture(dummyCtx, {
      noticeId: 'TRADEWINDS-CSO-2026-01',
      useMock: true,
      humanApproved: true, // Human clicked authorize!
    })) as any;

    expect(result.ok).toBe(true);
    expect(result.staged_pending_human).toBe(false);
    expect(result.authorized).toBe(true);
    expect(result.dispatchStatus).toBe('DISPATCHED_TO_PORTAL');
  });

  it('throws error when explicit noticeId is not found instead of silently substituting', async () => {
    await expect(
      runSamGovCapture(dummyCtx, {
        noticeId: 'NON-EXISTENT-SOLICITATION-99999',
        useMock: true,
      })
    ).rejects.toThrow(/not found/i);
  });
});
