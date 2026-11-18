import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Isolate test state directory
const TEST_STATE_DIR = '/tmp/cortex-standup-test-state';
vi.hoisted(() => {
  process.env.CORTEX_AGENTS_STATE_DIR = '/tmp/cortex-standup-test-state';
});

import {
  runMorningFleetStandup,
  runEveningFleetDebrief,
  getLatestFleetStandup,
  ensureMorningFleetStandup,
} from '../src/lib/cortex-agents/standup';

describe('Cortex Fleet Standup Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(TEST_STATE_DIR, 'standup'), { recursive: true });
  });

  it('runs Arm A morning parallel standup across agents and persists report', async () => {
    const report = await runMorningFleetStandup({
      arm: 'A',
      dryRun: true,
      dateKey: '2026-11-18',
    });

    expect(report).toBeDefined();
    expect(report.phase).toBe('morning');
    expect(report.arm).toBe('A');
    expect(report.totalAgents).toBeGreaterThanOrEqual(20);
    expect(report.wallClockDurationMs).toBeGreaterThan(0);
    expect(report.checkIns).toBeDefined();

    // Check specific known agents
    expect(report.checkIns['devin']).toBeDefined();
    expect(report.checkIns['openclaw']).toBeDefined();
    expect(report.checkIns['hermes']).toBeDefined();
    expect(report.checkIns['sentinel']).toBeDefined();

    // Hermes should reflect truthful port probe (degraded if :18880 unreachable in test)
    expect(['healthy', 'degraded', 'offline', 'ready']).toContain(report.checkIns['hermes'].status);

    // Verify persistence
    const saved = getLatestFleetStandup('morning');
    expect(saved).not.toBeNull();
    expect(saved?.id).toBe(report.id);
  });

  it('runs Arm B curator-triaged standup and compiles central report', async () => {
    const report = await runMorningFleetStandup({
      arm: 'B',
      dryRun: true,
      dateKey: '2026-11-18',
    });

    expect(report.arm).toBe('B');
    expect(report.phase).toBe('morning');
    expect(report.totalAgents).toBeGreaterThanOrEqual(20);
    expect(report.wallClockDurationMs).toBeGreaterThan(0);
  });

  it('runs evening retrospective debrief reconciling task completions', async () => {
    // Seed fake archive
    const archivePath = path.join(TEST_STATE_DIR, 'task-archive.jsonl');
    fs.writeFileSync(
      archivePath,
      JSON.stringify({ id: 'task-1', agentId: 'scout', title: 'Research task', status: 'completed', ts: Date.now() }) + '\n' +
      JSON.stringify({ id: 'task-2', agentId: 'builder', title: 'Fix bug', status: 'failed', ts: Date.now() }) + '\n',
      'utf8'
    );

    const retro = await runEveningFleetDebrief({
      dryRun: true,
      dateKey: '2026-11-18',
    });

    expect(retro).toBeDefined();
    expect(retro.phase).toBe('evening');
    expect(retro.totalAgents).toBeGreaterThanOrEqual(20);
    expect(retro.checkIns['scout']).toBeDefined();
    expect(retro.checkIns['scout'].eveningRetro).toBeDefined();
  });

  it('ensureMorningFleetStandup provides idempotent daily memoization', async () => {
    const first = await ensureMorningFleetStandup('2026-11-18');
    const second = await ensureMorningFleetStandup('2026-11-18');

    expect(second.id).toBe(first.id);
    expect(second.timestamp).toBe(first.timestamp);
  });
});
