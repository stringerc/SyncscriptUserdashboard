import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// RUNTIME_DIR is captured at module import — hoist the env override.
vi.hoisted(() => {
  process.env.CORTEX_AGENTS_STATE_DIR = '/tmp/cortex-worktree-test-state';
});

import { AgentRuntime } from '../cortex-agents/runtime';
import type { WorkerHandler } from '../cortex-agents/runtime';
import type { SpawnSpec } from '../cortex-agents/types';

const TEST_STATE = '/tmp/cortex-worktree-test-state';
const repoRoot = process.cwd();

describe('Cortex worktree isolation (orca-pattern)', () => {
  const baseSpec: SpawnSpec = {
    callSign: 'WT-TEST',
    role: 'sandbox probe',
    mission: 'zxq probe write sentinel file inside isolated checkout',
    tools: ['write'],
    modelPin: { tier: 'fast' },
    dataScopes: [],
    dailyBudget: 10,
    ttlHours: 1,
    systemBrief: 'test',
    doneCriteria: 'file exists',
  };
  const evidence = [{ kind: 'capability_gap' as const, refs: [] as string[], summary: 'need isolated checkout probe' }];

  beforeEach(() => {
    fs.rmSync(TEST_STATE, { recursive: true, force: true });
    fs.mkdirSync(TEST_STATE, { recursive: true });
  });

  afterEach(() => {
    // Clean any leftover worktrees/branches from failed runs.
    try {
      const out = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: repoRoot }).toString();
      for (const line of out.split('\n')) {
        if (line.startsWith('worktree ') && line.includes('cortex-worktree-test-state')) {
          execFileSync('git', ['worktree', 'remove', '--force', line.slice(9)], { cwd: repoRoot, stdio: 'pipe' });
        }
      }
      execFileSync('git', ['worktree', 'prune'], { cwd: repoRoot, stdio: 'pipe' });
      execFileSync('git', ['branch', '--list', 'agent/spawn-wt-test-*'], { cwd: repoRoot }).toString()
        .split('\n').filter(Boolean).forEach((b) => {
          try { execFileSync('git', ['branch', '-D', b.trim()], { cwd: repoRoot, stdio: 'pipe' }); } catch { }
        });
    } catch { }
    fs.rmSync(TEST_STATE, { recursive: true, force: true });
  });

  function makeRuntime() {
    const rt = new AgentRuntime();
    rt.setSpawnWorkerFactory((() => async () => ({ ok: true })) as unknown as (spec: SpawnSpec) => WorkerHandler);
    return rt;
  }

  it('provisions a worktree on approveSpawn when spec.worktree is set', () => {
    const rt = makeRuntime();
    const res = rt.proposeSpawn({ ...baseSpec, worktree: true }, evidence, 'builder');
    expect(res.ok).toBe(true);
    const approval = rt.approveSpawn(res.proposal!.id, 'test');
    expect(approval.ok).toBe(true);
    const agentId = approval.agentId!;
    const agent = rt.snapshot().agents.find((a) => a.id === agentId);
    expect(agent?.worktreePath).toBeTruthy();
    expect(agent!.worktreePath).toContain('cortex-worktree-test-state');
    expect(fs.existsSync(path.join(agent!.worktreePath!, 'package.json'))).toBe(true);
    const list = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: repoRoot }).toString();
    expect(list).toContain(agent!.worktreePath!);
  }, 90_000);

  it('does not provision a worktree when spec.worktree is absent', () => {
    const rt = makeRuntime();
    const res = rt.proposeSpawn(baseSpec, evidence, 'builder');
    const approval = rt.approveSpawn(res.proposal!.id, 'test');
    expect(approval.ok).toBe(true);
    const agent = rt.snapshot().agents.find((a) => a.id === approval.agentId);
    expect(agent?.worktreePath).toBeUndefined();
  });

  it('removes the worktree and branch on retireAgent', () => {
    const rt = makeRuntime();
    const res = rt.proposeSpawn({ ...baseSpec, worktree: true }, evidence, 'builder');
    const approval = rt.approveSpawn(res.proposal!.id, 'test');
    const agentId = approval.agentId!;
    const wtPath = rt.snapshot().agents.find((a) => a.id === agentId)!.worktreePath!;
    expect(rt.retireAgent(agentId, 'test retire')).toBe(true);
    expect(fs.existsSync(wtPath)).toBe(false);
    const list = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: repoRoot }).toString();
    expect(list).not.toContain(wtPath);
  }, 90_000);
});
