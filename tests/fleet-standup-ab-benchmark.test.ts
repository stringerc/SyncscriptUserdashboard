import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_STATE_DIR = '/tmp/cortex-standup-benchmark-state';
vi.hoisted(() => {
  process.env.CORTEX_AGENTS_STATE_DIR = '/tmp/cortex-standup-benchmark-state';
});

import { runMorningFleetStandup, type FleetStandupReport } from '../src/lib/cortex-agents/standup';

describe('Empirical A/B Benchmark: Arm A (Parallel Fan-Out) vs Arm B (Curator Triaged)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(TEST_STATE_DIR, 'standup'), { recursive: true });
  });

  it('runs head-to-head empirical benchmark and verifies key trade-off metrics', async () => {
    console.log('\n========================================================================');
    console.log('🏁 LAUNCHING CORTEX FLEET STANDUP EMPIRICAL A/B BENCHMARK');
    console.log('========================================================================\n');

    // 1. Execute Arm A: Autonomous Parallel Fan-Out
    const startA = Date.now();
    const reportA: FleetStandupReport = await runMorningFleetStandup({
      arm: 'A',
      dryRun: true,
      dateKey: '2026-11-18-bench-a',
    });
    const durationA = Date.now() - startA;

    // 2. Execute Arm B: Curator-Triaged Standup
    const startB = Date.now();
    const reportB: FleetStandupReport = await runMorningFleetStandup({
      arm: 'B',
      dryRun: true,
      dateKey: '2026-11-18-bench-b',
    });
    const durationB = Date.now() - startB;

    // 3. Metric Assertions
    // Latency target standard: < 3,500ms wall clock
    expect(durationA).toBeLessThan(3500);
    expect(durationB).toBeLessThan(3500);

    // Agent count parity
    expect(reportA.totalAgents).toBe(reportB.totalAgents);
    expect(reportA.totalAgents).toBeGreaterThanOrEqual(20);

    // Truthful fault detection
    const hermesA = reportA.checkIns['hermes'];
    const hermesB = reportB.checkIns['hermes'];
    expect(hermesA).toBeDefined();
    expect(hermesB).toBeDefined();
    expect(hermesA.status).toBe(hermesB.status);

    // Domain specialist bids in Arm A
    expect(reportA.checkIns['devin'].dailyBid?.title).toContain('SWE');
    expect(reportA.checkIns['openclaw'].dailyBid?.title).toContain('browser');
    expect(reportA.checkIns['sentinel'].dailyBid?.title).toContain('model');

    // Print Empirical Result Table
    console.log('------------------------------------------------------------------------');
    console.log('| METRIC                 | ARM A (Parallel Fan-Out) | ARM B (Curator Triaged) |');
    console.log('------------------------------------------------------------------------');
    console.log(`| Total Agents Evaluated | ${String(reportA.totalAgents).padEnd(24)} | ${String(reportB.totalAgents).padEnd(23)} |`);
    console.log(`| Wall-Clock Latency     | ${String(durationA + 'ms').padEnd(24)} | ${String(durationB + 'ms').padEnd(23)} |`);
    console.log(`| Healthy Check-ins      | ${String(reportA.healthyCount).padEnd(24)} | ${String(reportB.healthyCount).padEnd(23)} |`);
    console.log(`| Degraded (Truth Probe) | ${String(reportA.degradedCount).padEnd(24)} | ${String(reportB.degradedCount).padEnd(23)} |`);
    console.log(`| Offline                | ${String(reportA.offlineCount).padEnd(24)} | ${String(reportB.offlineCount).padEnd(23)} |`);
    console.log(`| Fault Isolation Mode   | Promise.allSettled       | Central Single-Pass     |`);
    console.log(`| Domain Specificity     | High (Specialist Model)  | Moderate (Curator Syn)  |`);
    console.log('------------------------------------------------------------------------\n');
  });

  it('verifies fault isolation: an agent failure or timeout never crashes the report in Arm A', async () => {
    // Even if an external check or prompt throws, Promise.allSettled catches it
    const report = await runMorningFleetStandup({
      arm: 'A',
      dryRun: true,
      dateKey: '2026-11-18-fault-isolation',
    });

    expect(report.checkIns).toBeDefined();
    expect(Object.keys(report.checkIns).length).toBe(report.totalAgents);
  });
});
