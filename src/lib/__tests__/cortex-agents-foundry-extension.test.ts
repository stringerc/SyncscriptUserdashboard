import { describe, it, expect, vi } from 'vitest';
import { AGENT_SPECS, AgentRuntime } from '../cortex-agents/runtime';
import type { AgentId } from '../cortex-agents/types';
import { registerAgentWorkers } from '../cortex-agents/workers';
import { AGENT_COLORS, AGENT_ORDER, agentOrbitTier } from '../../components/cortex/CortexAgentsScene';

describe('Nexus Foundry Agent Fleet Extension — Claude Code & OpenClaw', () => {
  describe('Agent Specifications (AGENT_SPECS) - Sovereign Production Engine Roles', () => {
    it('defines claudecode spec with Terminal Architect & Consensus Auditor role and deep model pin', () => {
      const spec = AGENT_SPECS.find((s) => s.id === 'claudecode');
      expect(spec).toBeDefined();
      expect(spec?.name).toBe('CLAUDE_CODE');
      expect(spec?.role).toBe('Terminal Architect & Consensus Auditor');
      expect(spec?.tier).toBe('enterprise');
      expect(spec?.concurrency).toBe(1);
      expect(spec?.dailyBudget).toBe(24);
      expect(spec?.modelPin?.tier).toBe('deep');
      expect(spec?.blurb).toMatch(/Auditor 1/i);
      expect(spec?.blurb).toMatch(/consensus gate/i);
    });

    it('defines openclaw spec with Sovereign WebMCP & Portal Navigator role and fast model pin', () => {
      const spec = AGENT_SPECS.find((s) => s.id === 'openclaw');
      expect(spec).toBeDefined();
      expect(spec?.name).toBe('OPENCLAW');
      expect(spec?.role).toBe('Sovereign WebMCP & Portal Navigator');
      expect(spec?.tier).toBe('enterprise');
      expect(spec?.concurrency).toBe(1);
      expect(spec?.dailyBudget).toBe(32);
      expect(spec?.modelPin?.tier).toBe('fast');
      expect(spec?.blurb).toMatch(/procurement portals|storefront syndication/i);
      expect(spec?.blurb).toMatch(/Chrome/i);
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
      expect(claude?.role).toBe('Terminal Architect & Consensus Auditor');
      expect(openclaw).toBeDefined();
      expect(openclaw?.name).toBe('OPENCLAW');
      expect(openclaw?.role).toBe('Sovereign WebMCP & Portal Navigator');
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

    it('executes an audit_diff task via claudecode worker (Auditor 1 in consensus gate)', async () => {
      const rt = new AgentRuntime();
      registerAgentWorkers(rt);
      rt.setLLMBridge(async () => ({
        content: JSON.stringify({
          approved: true,
          score: 9,
          risk: 'low',
          critique: 'Patch maintains TypeScript safety and preserves zero-allocation invariants.',
          invariantsChecked: ['TypeSafety', 'ZeroRegression', 'ZeroAllocationLoop'],
          status: 'verified',
        }),
        model: 'free-proxy:claude-fable-5-2',
        usage: { tokensIn: 200, tokensOut: 80 },
      }));
      rt.start();

      const { ok, task } = rt.submitTask('claudecode', 'audit_diff', 'Audit Self-Heal Candidate Patch', {
        instruction: 'Review patch for TypeScript safety and zero-allocation regressions',
        diff: '--- a/cortex.ts\n+++ b/cortex.ts\n@@ -1,5 +1,5 @@',
      });

      expect(ok).toBe(true);
      expect(task).toBeDefined();

      await vi.waitFor(() => {
        const t = rt.snapshot().tasks.find((x) => x.id === task!.id);
        expect(t?.status).toBe('completed');
      }, { timeout: 4000 });

      const finished = rt.snapshot().tasks.find((x) => x.id === task!.id);
      expect(finished?.status).toBe('completed');
      const res = finished?.result as any;
      expect(res.ok).toBe(true);
      expect(res.agent).toBe('claudecode');
      expect(res.approved).toBe(true);
      expect(res.score).toBe(9);
      expect(res.risk).toBe('low');
      expect(res.invariantsChecked).toContain('TypeSafety');
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

    it('executes a portal_submit task via openclaw worker (GovTech & Storefront Navigation)', async () => {
      const rt = new AgentRuntime();
      registerAgentWorkers(rt);
      rt.setLLMBridge(async () => ({
        content: JSON.stringify({
          action: 'submit',
          status: 'submitted',
          portal: 'sam.gov',
          confirmationId: 'CONF-SAM-2026-9912',
          summary: 'Successfully navigated Section K and submitted certified proposal.',
        }),
        model: 'groq-fast:openai/gpt-oss-20b',
        usage: { tokensIn: 150, tokensOut: 60 },
      }));
      rt.start();

      const { ok, task } = rt.submitTask('openclaw', 'portal_submit', 'Submit SAM.gov Defense Proposal', {
        portal: 'sam.gov',
        noticeId: 'W911QX-26-Q-0042',
        instruction: 'Submit certified 4-volume proposal package to Army Contracting Command',
        dossierPath: '.cortex/reports/govtech/W911QX-26-Q-0042.json',
      });

      expect(ok).toBe(true);
      expect(task).toBeDefined();

      await vi.waitFor(() => {
        const t = rt.snapshot().tasks.find((x) => x.id === task!.id);
        expect(t?.status).toBe('completed');
      }, { timeout: 4000 });

      const finished = rt.snapshot().tasks.find((x) => x.id === task!.id);
      expect(finished?.status).toBe('completed');
      const res = finished?.result as any;
      expect(res.ok).toBe(true);
      expect(res.agent).toBe('openclaw');
      expect(res.portal).toBe('sam.gov');
      expect(res.confirmationId).toBe('CONF-SAM-2026-9912');
      rt.stop();
    });

    it('executes a dom_inspect task via openclaw worker (Sensory E2E Verification)', async () => {
      const rt = new AgentRuntime();
      registerAgentWorkers(rt);
      rt.setLLMBridge(async () => ({
        content: JSON.stringify({
          action: 'inspect',
          status: 'verified',
          inspected: true,
          elementsFound: 14,
          fps: 60,
          summary: 'Visualizer canvas verified active and rendering at 60fps.',
        }),
        model: 'groq-fast:openai/gpt-oss-20b',
        usage: { tokensIn: 100, tokensOut: 40 },
      }));
      rt.start();

      const { ok, task } = rt.submitTask('openclaw', 'dom_inspect', 'Inspect Visualizer 3D Canvas Rendering', {
        url: 'http://127.0.0.1:5173/cortex/visualizer',
        selector: 'canvas',
        instruction: 'Verify canvas is rendering smoothly without WebGL context loss',
      });

      expect(ok).toBe(true);
      expect(task).toBeDefined();

      await vi.waitFor(() => {
        const t = rt.snapshot().tasks.find((x) => x.id === task!.id);
        expect(t?.status).toBe('completed');
      }, { timeout: 4000 });

      const finished = rt.snapshot().tasks.find((x) => x.id === task!.id);
      expect(finished?.status).toBe('completed');
      const res = finished?.result as any;
      expect(res.ok).toBe(true);
      expect(res.agent).toBe('openclaw');
      expect(res.inspected).toBe(true);
      expect(res.fps).toBe(60);
      rt.stop();
    });
  });
});
