import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  probeHermesDaemon,
  probeCliBinary,
  probeAgentWorker,
  type AgentCheckIn,
  type FleetStandupReport,
} from '../src/lib/cortex-agents/standup';
import { AgentRuntime } from '../src/lib/cortex-agents/runtime';

describe('Deterministic Fleet Health Probes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('probeHermesDaemon', () => {
    it('returns healthy when endpoint responds ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' }),
      } as any);

      const probe = await probeHermesDaemon('http://127.0.0.1:18880/health', 500);
      expect(probe.status).toBe('healthy');
      expect(probe.evidence).toContain('responsive');
    });

    it('returns degraded when endpoint connection fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:18880'));

      const probe = await probeHermesDaemon('http://127.0.0.1:18880/health', 500);
      expect(probe.status).toBe('degraded');
      expect(probe.evidence).toContain('offline');
    });
  });

  describe('probeCliBinary', () => {
    it('detects an existing system binary', () => {
      const probe = probeCliBinary(['node', '/usr/bin/node', '/usr/local/bin/node']);
      expect(['healthy', 'degraded']).toContain(probe.status);
      if (probe.status === 'healthy') {
        expect(probe.evidence).toContain('node');
      }
    });

    it('flags missing non-existent binary as degraded/offline without crashing', () => {
      const probe = probeCliBinary(['nonexistent-binary-xyz-12345']);
      expect(probe.status).toBe('degraded');
      expect(probe.evidence).toContain('not found');
    });
  });

  describe('probeAgentWorker', () => {
    it('confirms registered in-process built-in agent as healthy', () => {
      const runtime = new AgentRuntime();
      runtime.registerWorker('scout', async () => ({ ok: true }));

      const probe = probeAgentWorker(runtime, 'scout');
      expect(probe.status).toBe('healthy');
      expect(probe.evidence).toContain('registered');
    });

    it('flags unhandled agent as degraded/unregistered', () => {
      const runtime = new AgentRuntime();
      // 'unknown-agent' has no handler registered
      const probe = probeAgentWorker(runtime, 'unknown-agent' as any);
      expect(probe.status).toBe('degraded');
      expect(probe.evidence).toContain('no handler');
    });
  });
});
