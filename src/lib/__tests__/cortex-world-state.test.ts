import { describe, it, expect } from 'vitest';
import {
  formatWorldStateHeader,
  getFastGitBranch,
  getTopology,
  getSomaticVitals,
  getWorldState,
  type WorldState,
} from '../cortex-world-state';

describe('Cortex Living World State Blackboard', () => {
  it('formats a compact telemetry header under 60 words (<80 tokens)', () => {
    const mockState: WorldState = {
      topology: {
        instance: 'mac',
        localTime: '07:25 AM EDT',
        timezone: 'America/New_York',
        utcDeltaHours: -4,
        hostname: 'MacBook-Pro.local',
      },
      user: {
        activeApp: 'Cursor',
        frontmostWindow: 'CortexCoreScene.tsx — syncscript',
        activeFile: 'CortexCoreScene.tsx',
      },
      host: {
        loadAvg1m: 1.4,
        memUsedPct: 42,
        uptimeHours: 36.5,
        batteryPct: 91,
      },
      codebase: {
        branch: 'security-hardening',
        isClean: false,
        dirtyCount: 3,
      },
      fleet: {
        activeAgentCount: 2,
        oracleAlive: true,
      },
      cachedAt: Date.now(),
    };

    const header = formatWorldStateHeader(mockState);
    expect(header).toContain('[WORLD-STATE: 07:25 AM EDT');
    expect(header).toContain('App: Cursor (CortexCoreScene.tsx)');
    expect(header).toContain('Git: 3 dirty (security-hardening)');
    expect(header).toContain('Host: Mac (Local)');
    expect(header).toContain('Load: 1.4');
    expect(header).toContain('Mem: 42%');
    expect(header).toContain('Batt: 91%');

    // Token & length check: ensure it stays tight
    const wordCount = header.split(/\s+/).length;
    expect(wordCount).toBeLessThan(35);
  });

  it('correctly labels Oracle cloud instances vs Mac local', () => {
    const mockOracleState: WorldState = {
      topology: {
        instance: 'oracle',
        localTime: '11:25 AM UTC',
        timezone: 'UTC',
        utcDeltaHours: 0,
        hostname: 'syncscript-a1-retry-2',
      },
      user: {
        activeApp: 'Linux/Cloud',
        frontmostWindow: 'Headless Session',
      },
      host: {
        loadAvg1m: 0.2,
        memUsedPct: 28,
        uptimeHours: 120.1,
      },
      codebase: {
        branch: 'main',
        isClean: true,
        dirtyCount: 0,
      },
      fleet: {
        activeAgentCount: 6,
        oracleAlive: true,
      },
      cachedAt: Date.now(),
    };

    const header = formatWorldStateHeader(mockOracleState);
    expect(header).toContain('Host: Oracle (UTC)');
    expect(header).toContain('Git: clean (main)');
  });

  it('reads git branch synchronously from .git/HEAD', () => {
    const branch = getFastGitBranch();
    expect(typeof branch).toBe('string');
    expect(branch.length).toBeGreaterThan(0);
    expect(branch).toBe('security-hardening');
  });

  it('gathers somatic host vitals without throwing', () => {
    const vitals = getSomaticVitals();
    expect(vitals.memUsedPct).toBeGreaterThanOrEqual(0);
    expect(vitals.memUsedPct).toBeLessThanOrEqual(100);
    expect(vitals.loadAvg1m).toBeGreaterThanOrEqual(0);
    expect(vitals.uptimeHours).toBeGreaterThan(0);
  });

  it('returns valid topology state with local time and timezone', () => {
    const topology = getTopology();
    expect(['mac', 'oracle']).toContain(topology.instance);
    expect(typeof topology.localTime).toBe('string');
    expect(typeof topology.utcDeltaHours).toBe('number');
  });

  it('retrieves living world state with caching', async () => {
    const state1 = await getWorldState();
    expect(state1).toBeDefined();
    expect(state1.topology).toBeDefined();
    expect(state1.user).toBeDefined();
    expect(state1.codebase).toBeDefined();

    const t1 = state1.cachedAt;
    // Rapid immediate follow-up call should return cached object
    const state2 = await getWorldState();
    expect(state2.cachedAt).toBe(t1);
  });
});
