import { describe, it, expect, beforeEach } from 'vitest';
import { curatorAuditSelf, curatorRadarAgents, curatorOptimizeAgent } from '../src/lib/cortex-agents/curator-tools';
import { AgentRuntime } from '../src/lib/cortex-agents/runtime';
import { registerAgentWorkers } from '../src/lib/cortex-agents/workers';

describe('6-Challenge Empirical A/B Benchmark Suite', () => {
  beforeEach(() => {
    const rt = new AgentRuntime();
    registerAgentWorkers(rt);
  });

  describe('Branch B (Cortex In-Fleet Curator Engine) Empirical Evaluation', () => {
    it('Challenge 1: OpenClaw Upstream Release & Upgrade Detection', async () => {
      const radar = await curatorRadarAgents();
      const target = radar.targets.openclaw;
      expect(target).toBeDefined();
      expect(target.localVersion).toMatch(/^2026\./);
      expect(target.upstreamVersion).toMatch(/^2026\./);
      expect(target.status).toBe('upgrade_available');
      expect(target.testedUpgradePath).toBe('npm install -g openclaw@latest');
      expect(target.advisory).toContain('available');
    });

    it('Challenge 2: Devin API & Architecture Playbook Synthesis', async () => {
      const radar = await curatorRadarAgents();
      const target = radar.targets.devin;
      expect(target).toBeDefined();
      expect(target.playbookReady).toBe(true);
      expect(target.status).toBe('verified');
      expect(target.advisory).toContain('sub-600ms token streaming');
    });

    it('Challenge 3: Cortex Self-Model Dynamic Capability Audit (Zero Hallucinations)', async () => {
      const audit = await curatorAuditSelf();
      expect(audit.ok).toBe(true);
      expect(audit.toolCount).toBeGreaterThanOrEqual(18);
      expect(audit.fleetAgentCount).toBeGreaterThanOrEqual(10);
      expect(audit.hallucinatedToolsCount).toBe(0);
      expect(audit.capabilities.tools).toContain('run_command');
      expect(audit.capabilities.tools).toContain('read_file');
      expect(audit.capabilities.agents).toContain('hermes');
      expect(audit.capabilities.agents).toContain('curator');
    });

    it('Challenge 4: Claude Code Terminal Architect & Consensus Auditor Integration', async () => {
      const radar = await curatorRadarAgents();
      const target = radar.targets.claudecode;
      expect(target).toBeDefined();
      expect(target.localVersion).toMatch(/^2\./);
      expect(target.consensusReady).toBe(true);
      expect(target.advisory).toContain('Auditor 1 in 2-IDE self-heal consensus gate');
    });

    it('Challenge 5: Antigravity Parallel DAG & Worktree Orchestration', async () => {
      const radar = await curatorRadarAgents();
      const target = radar.targets.antigravity;
      expect(target).toBeDefined();
      expect(target.orchestrationReady).toBe(true);
      expect(target.advisory).toContain('worktree');
    });

    it('Challenge 6: Hermes Sovereign Mutating Tool Execution Gateway', async () => {
      const radar = await curatorRadarAgents();
      const target = radar.targets.hermes;
      expect(target).toBeDefined();
      expect(typeof target.endpointValid).toBe('boolean');
      expect(target.advisory).toContain('127.0.0.1:18880');
    });
  });

  describe('Reflexive Prompt Optimization & Actionability Verification', () => {
    it('generates grounded, actionable prompt improvement proposals for fleet agents', async () => {
      const opt = await curatorOptimizeAgent('hermes', 'Ensure zero-trust idempotency keys on mutating tools');
      expect(opt.ok).toBe(true);
      expect(opt.agentId).toBe('hermes');
      expect(opt.optimizedPrompt).toContain('0.01% Optimized Operational Directive for HERMES');
      expect(opt.optimizedPrompt).toContain('Never emit simulated or hypothetical output when tools exist');
      expect(opt.proposalId).toBeDefined();
    });
  });
});
