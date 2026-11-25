import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  agentForClass,
  autoApproveSafeStrategyProposals,
  fileStrategyProposals,
  fileBudgetProposal,
  fileDevinSessionProposal,
  listStrategyProposals,
  setOnProposalFiledHook,
} from '../cortex-agents/strategy-proposals';
import { AGENT_SPECS } from '../cortex-agents/runtime';
import { makePrepWorker } from '../cortex-agents/prep';

const TEST_RUNTIME_DIR = path.join(process.cwd(), '.cortex-runtime-test-drain');
const PROPOSALS_FILE = path.join(TEST_RUNTIME_DIR, 'strategy-proposals.json');

describe('Initiative Acceleration & Strategy Proposal Auto-Drain', () => {
  const origDir = process.env.CORTEX_AGENTS_STATE_DIR;

  beforeEach(() => {
    process.env.CORTEX_AGENTS_STATE_DIR = TEST_RUNTIME_DIR;
    fs.mkdirSync(TEST_RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(PROPOSALS_FILE, JSON.stringify([]));
  });

  afterEach(() => {
    try {
      fs.rmSync(TEST_RUNTIME_DIR, { recursive: true, force: true });
    } catch {}
    if (origDir) process.env.CORTEX_AGENTS_STATE_DIR = origDir;
    else delete process.env.CORTEX_AGENTS_STATE_DIR;
  });

  it('agentForClass routes work dynamically across fleet specialists', () => {
    // 'eval' is analysis work — runner is exec-only and rejects
    // instruction tasks ("requires input.command"); it goes to builder.
    expect(agentForClass('eval')).toBe('builder');
    expect(agentForClass('test')).toBe('runner');
    expect(agentForClass('rule')).toBe('librarian');
    expect(agentForClass('memory')).toBe('librarian');
    expect(agentForClass('review')).toBe('reviewer');
    expect(agentForClass('audit')).toBe('reviewer');
    expect(agentForClass('web')).toBe('openclaw');
    expect(agentForClass('portal')).toBe('openclaw');
    expect(agentForClass('scrape')).toBe('openclaw');
    expect(agentForClass('refactor')).toBe('claudecode');
    expect(agentForClass('deep_code')).toBe('claudecode');
    expect(agentForClass('process')).toBe('builder');
    expect(agentForClass('code')).toBe('builder');
  });

  it('elevates builder and runner dailyBudget and concurrency specs', () => {
    const builder = AGENT_SPECS.find((a) => a.id === 'builder');
    const runner = AGENT_SPECS.find((a) => a.id === 'runner');
    expect(builder).toBeDefined();
    expect(builder!.dailyBudget).toBeGreaterThanOrEqual(64);
    expect(builder!.concurrency).toBeGreaterThanOrEqual(2);

    expect(runner).toBeDefined();
    expect(runner!.dailyBudget).toBeGreaterThanOrEqual(96);
    expect(runner!.concurrency).toBeGreaterThanOrEqual(3);
  });

  it('autoApproveSafeStrategyProposals auto-executes budget raises and dispatches safe classes', async () => {
    // 1. File budget raise
    fileBudgetProposal({
      agentId: 'builder',
      agentName: 'BUILDER',
      currentBudget: 16,
      suggestedBudget: 64,
      error: 'BUILDER daily budget exhausted',
    });

    // 2. File safe action proposals
    fileStrategyProposals({
      planNote: 'note-1',
      planTaskId: 'task-1',
      actions: [
        '1. [eval | test] Verify matrix latency — evidence: log-1 — why quick check',
        '2. [rule | memory] Distill prompt pattern — evidence: log-2 — why keep memory',
      ],
    });

    // 3. File a devin task (which must remain gated for human operator)
    fileDevinSessionProposal({
      taskId: 'dev-task-1',
      title: 'Devin External PR push',
      instruction: 'Push external branch to github',
    });

    const pending = listStrategyProposals('pending');
    expect(pending.length).toBe(4);

    const submitted: any[] = [];
    let updatedBudget: { agentId: string; budget: number } | null = null;

    const mockRuntime = {
      submitTask: (agentId: any, kind: string, title: string, input: any) => {
        const id = `mock-task-${submitted.length + 1}`;
        submitted.push({ id, agentId, kind, title, input });
        return { ok: true, task: { id } };
      },
      setDailyBudget: (agentId: any, budget: number) => {
        updatedBudget = { agentId, budget };
        return true;
      },
    };

    const result = await autoApproveSafeStrategyProposals(mockRuntime, 'test:triage');

    // Budget raise was executed deterministically
    expect(result.executed.length).toBe(1);
    expect(updatedBudget).toEqual({ agentId: 'builder', budget: 64 });

    // 2 safe proposals were approved and dispatched
    expect(result.approved.length).toBe(2);
    expect(submitted.length).toBe(2);
    expect(submitted[0].agentId).toBe('builder'); // eval routed to builder (runner is exec-only)
    expect(submitted[1].agentId).toBe('librarian'); // rule routed to librarian

    // Devin task was skipped and remains pending for operator
    expect(result.skipped).toBe(1);
    const remainingPending = listStrategyProposals('pending');
    expect(remainingPending.length).toBe(1);
    expect(remainingPending[0].kind).toBe('devin_task');
  });

  it('prep worker initiative_drain routine auto-drains both proactive ledger and strategy proposals', async () => {
    fileStrategyProposals({
      planNote: 'note-2',
      planTaskId: 'task-2',
      actions: ['1. [prompt] Refine query template — evidence: ev-1 — why speed'],
      // [prompt] is a self-mod class — the P4 eval gate requires evidence.
      evalEvidence: [{ evalId: 'eval-drain-test', verdict: 'pass', passCaretK: { baseline: 0.5, candidate: 1 }, at: Date.now() }],
    });

    let mockSubmitted = false;
    const mockRuntime = {
      submitTask: () => {
        mockSubmitted = true;
        return { ok: true, task: { id: 'task-prep-drain-1' } };
      },
    };

    const prep = makePrepWorker({
      toolExecute: async () => ({ ok: true }),
      fetchInbox: async () => null,
      runtime: mockRuntime,
    });

    const res = (await prep({
      task: { kind: 'initiative_drain', input: {} } as any,
      progress: () => {},
      llm: async () => '',
      emit: () => {},
      signal: new AbortController().signal,
      telemetry: {} as any,
    })) as any;

    expect(res.ok).toBe(true);
    expect(res.strategyApproved.length).toBe(1);
    expect(mockSubmitted).toBe(true);
  });

  it('setOnProposalFiledHook receives event notification immediately upon filing for zero-latency intake', async () => {
    let capturedProposal: any = null;
    setOnProposalFiledHook((p) => {
      capturedProposal = p;
    });

    fileStrategyProposals({
      planNote: 'instant-note',
      planTaskId: 'task-instant',
      actions: ['1. [eval] Run fast test suite — evidence: ev-instant — why fast'],
    });

    expect(capturedProposal).not.toBeNull();
    expect(capturedProposal.title).toContain('Run fast test suite');
    expect(capturedProposal.agentId).toBe('builder'); // [eval] → builder, not exec-only runner

    setOnProposalFiledHook(null);
  });
});
