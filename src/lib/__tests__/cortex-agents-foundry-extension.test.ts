import { describe, it, expect, vi } from 'vitest';
import { AGENT_SPECS, AgentRuntime } from '../cortex-agents/runtime';
import type { AgentId } from '../cortex-agents/types';
import { registerAgentWorkers } from '../cortex-agents/workers';
import { AGENT_COLORS, AGENT_ORDER, agentOrbitTier } from '../../components/cortex/CortexAgentsScene';

describe('Nexus Foundry Agent Fleet Extension — Claude Code & OpenClaw', () => {
  describe('Agent Specifications (AGENT_SPECS)', () => {
    it('defines claudecode spec with enterprise tier, terminal architect role, and deep model pin', () => {
      const spec = AGENT_SPECS.find((s) => s.id === 'claudecode');
      expect(spec).toBeDefined();
      expect(spec?.name).toBe('CLAUDE_CODE');
      expect(spec?.role).toBe('Terminal Architect');
      expect(spec?.tier).toBe('enterprise');
      expect(spec?.concurrency).toBe(1);
      expect(spec?.dailyBudget).toBe(24);
      expect(spec?.modelPin?.tier).toBe('deep');
      expect(spec?.blurb).toMatch(/claude code/i);
    });

    it('defines openclaw spec with enterprise tier, browser copilot role, and fast model pin', () => {
      const spec = AGENT_SPECS.find((s) => s.id === 'openclaw');
      expect(spec).toBeDefined();
      expect(spec?.name).toBe('OPENCLAW');
      expect(spec?.role).toBe('WebMCP Browser Copilot');
      expect(spec?.tier).toBe('enterprise');
      expect(spec?.concurrency).toBe(1);
      expect(spec?.dailyBudget).toBe(32);
      expect(spec?.modelPin?.tier).toBe('fast');
      expect(spec?.blurb).toMatch(/webmcp|browser/i);
    });
  });

  describe('3D Visualizer Scene Consistency', () => {
    it('contains theme colors for claudecode and openclaw', () => {
      expect(AGENT_COLORS['claudecode']).toBeDefined();
      expect(AGENT_COLORS['openclaw']).toBeDefined();
      expect(AGENT_COLORS['claudecode']).toBe('#f97316');
      expect(AGENT_COLORS['openclaw']).toBe('#06b6d4');
    });

    it('includes claudecode and openclaw in AGENT_ORDER', () => {
      expect(AGENT_ORDER).toContain('claudecode');
      expect(AGENT_ORDER).toContain('openclaw');
    });

    it('resolves enterprise orbital tier for both claudecode and openclaw', () => {
      const claudecodeAgent = { id: 'claudecode' as AgentId, tier: 'enterprise' as const };
      const openclawAgent = { id: 'openclaw' as AgentId, tier: 'enterprise' as const };
      expect(agentOrbitTier(claudecodeAgent as any)).toBe('enterprise');
      expect(agentOrbitTier(openclawAgent as any)).toBe('enterprise');
    });
  });

  describe('Runtime Integration & Worker Handlers', () => {
    it('initializes claudecode and openclaw in the AgentRuntime', () => {
      const rt = new AgentRuntime();
      const claude = rt.getAgent('claudecode');
      const openclaw = rt.getAgent('openclaw');

      expect(claude).toBeDefined();
      expect(claude?.name).toBe('CLAUDE_CODE');
      expect(openclaw).toBeDefined();
      expect(openclaw?.name).toBe('OPENCLAW');
    });

    it('registers worker handlers for claudecode and openclaw without error', () => {
      const rt = new AgentRuntime();
      expect(() => registerAgentWorkers(rt)).not.toThrow();
    });

    it('executes a refactor task via claudecode worker with simulated LLM bridge', async () => {
      const rt = new AgentRuntime();
      registerAgentWorkers(rt);
      rt.setLLMBridge(async () => ({
        content: JSON.stringify({
          summary: 'Refactored matrix inversion to use 4-lane SIMD float arrays.',
          diff: '--- a/math.ts\n+++ b/math.ts\n@@ -1,3 +1,3 @@',
          invariantsPreserved: ['NumericalPrecision', 'ZeroAllocationLoop'],
          status: 'verified',
        }),
        model: 'nvidia-nim-550b:nemotron-3-ultra-550b',
        usage: { tokensIn: 120, tokensOut: 60 },
      }));
      rt.start();

      const { ok, task } = rt.submitTask('claudecode', 'refactor', 'Optimize Matrix Inversion Routine', {
        instruction: 'Refactor math routine for SIMD acceleration',
        context: 'export function invert(m) { ... }',
      });

      expect(ok).toBe(true);
      expect(task).toBeDefined();

      await vi.waitFor(() => {
        const t = rt.snapshot().tasks.find((x) => x.id === task!.id);
        expect(t?.status).toBe('completed');
      }, { timeout: 4000 });

      const finished = rt.snapshot().tasks.find((x) => x.id === task!.id);
      expect(finished?.status).toBe('completed');
      expect((finished?.result as any)?.ok).toBe(true);
      expect((finished?.result as any)?.agent).toBe('claudecode');
      expect((finished?.result as any)?.summary).toBeDefined();
      rt.stop();
    });

    it('executes a browser navigation task via openclaw worker', async () => {
      const rt = new AgentRuntime();
      registerAgentWorkers(rt);
      rt.setLLMBridge(async () => ({
        content: JSON.stringify({ action: 'navigate', status: 'navigated', inspected: true }),
        model: 'groq-fast:openai/gpt-oss-20b',
        usage: { tokensIn: 80, tokensOut: 30 },
      }));
      rt.start();

      const { ok, task } = rt.submitTask('openclaw', 'browser_navigate', 'Inspect Gumroad Analytics Page', {
        url: 'https://app.gumroad.com/analytics',
        action: 'navigate',
      });

      expect(ok).toBe(true);
      expect(task).toBeDefined();

      await vi.waitFor(() => {
        const t = rt.snapshot().tasks.find((x) => x.id === task!.id);
        expect(t?.status).toBe('completed');
      }, { timeout: 4000 });

      const finished = rt.snapshot().tasks.find((x) => x.id === task!.id);
      expect(finished?.status).toBe('completed');
      expect((finished?.result as any)?.ok).toBe(true);
      expect((finished?.result as any)?.agent).toBe('openclaw');
      rt.stop();
    });
  });
});
