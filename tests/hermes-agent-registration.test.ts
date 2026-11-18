import { describe, it, expect } from 'vitest';
import { AgentRuntime } from '../src/lib/cortex-agents/runtime';
import { registerAgentWorkers } from '../src/lib/cortex-agents/workers';
import { AGENT_COLORS, AGENT_ORDER, agentOrbitTier } from '../src/components/cortex/CortexAgentsScene';
import { SAT_AGENT_COLORS, SAT_AGENT_ORDER } from '../src/components/cortex/CortexCoreScene';

describe('Hermes Agent Registration & Foundry Visibility', () => {
  it('registers hermes as an enterprise-tier agent with correct spec', () => {
    const rt = new AgentRuntime();
    registerAgentWorkers(rt);
    const hermes = rt.getAgent('hermes' as any);
    expect(hermes).toBeDefined();
    expect(hermes?.id).toBe('hermes');
    expect(hermes?.tier).toBe('enterprise');
    expect(hermes?.role).toContain('Sovereign Tool Execution Host');
  });

  it('renders hermes in the Foundry 2D/3D Sacred Citadel with theme color and order', () => {
    expect(AGENT_COLORS['hermes']).toBeDefined();
    expect(AGENT_COLORS['hermes']).toBe('#ef4444');
    expect(AGENT_ORDER).toContain('hermes');
    expect(agentOrbitTier({ id: 'hermes' as any, tier: 'enterprise' } as any)).toBe('enterprise');
  });

  it('renders hermes in the Core 3D visualizer satellite constellation', () => {
    expect(SAT_AGENT_COLORS['hermes']).toBeDefined();
    expect(SAT_AGENT_COLORS['hermes']).toBe('#ef4444');
    expect(SAT_AGENT_ORDER).toContain('hermes');
  });

  it('handles hermes task submission and invocation delegate', async () => {
    const rt = new AgentRuntime();
    registerAgentWorkers(rt);
    rt.start();
    const { ok, task } = rt.submitTask(
      'hermes' as any,
      'tool_invoke',
      'Test Hermes Ping',
      { tool: 'hermes_ping', arguments: {} }
    );
    expect(ok).toBe(true);
    expect(task).toBeDefined();
    expect(task?.agentId).toBe('hermes');
  });
});
