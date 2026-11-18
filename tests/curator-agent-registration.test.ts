import { describe, it, expect } from 'vitest';
import { AgentRuntime } from '../src/lib/cortex-agents/runtime';
import { registerAgentWorkers } from '../src/lib/cortex-agents/workers';
import { AGENT_COLORS, AGENT_ORDER, agentOrbitTier } from '../src/components/cortex/CortexAgentsScene';
import { SAT_AGENT_COLORS, SAT_AGENT_ORDER } from '../src/components/cortex/CortexCoreScene';

describe('Curator Agent Registration & Foundry Visibility', () => {
  it('registers curator as an enterprise-tier agent with correct spec and model pin', () => {
    const rt = new AgentRuntime();
    registerAgentWorkers(rt);
    const curator = rt.getAgent('curator' as any);
    expect(curator).toBeDefined();
    expect(curator?.id).toBe('curator');
    expect(curator?.tier).toBe('enterprise');
    expect(curator?.modelPin?.tier).toBe('reason');
    expect(curator?.role).toContain('Curator');
  });

  it('renders curator in the Foundry 2D/3D Sacred Citadel with theme color and order', () => {
    expect(AGENT_COLORS['curator']).toBeDefined();
    expect(AGENT_COLORS['curator']).toBe('#8b5cf6');
    expect(AGENT_ORDER).toContain('curator');
    expect(agentOrbitTier({ id: 'curator' as any, tier: 'enterprise' } as any)).toBe('enterprise');
  });

  it('renders curator in the Core 3D visualizer satellite constellation', () => {
    expect(SAT_AGENT_COLORS['curator']).toBeDefined();
    expect(SAT_AGENT_COLORS['curator']).toBe('#8b5cf6');
    expect(SAT_AGENT_ORDER).toContain('curator');
  });

  it('registers standing routines for continuous capability audit and radar sweeps', () => {
    const rt = new AgentRuntime();
    registerAgentWorkers(rt);
    const routines = rt.listRoutines();
    const curatorRoutines = routines.filter(r => r.agentId === 'curator');
    expect(curatorRoutines.length).toBeGreaterThanOrEqual(2);
    expect(curatorRoutines.some(r => r.kind === 'audit_self')).toBe(true);
    expect(curatorRoutines.some(r => r.kind === 'radar_sweep')).toBe(true);
  });

  it('handles curator task submission and delegation', async () => {
    const rt = new AgentRuntime();
    registerAgentWorkers(rt);
    rt.start();
    const { ok, task } = rt.submitTask(
      'curator' as any,
      'audit_self',
      'Curator Test Self Audit',
      {}
    );
    expect(ok).toBe(true);
    expect(task).toBeDefined();
    expect(task?.agentId).toBe('curator');
  });
});
