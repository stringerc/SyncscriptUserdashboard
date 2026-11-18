import { describe, it, expect, beforeEach } from 'vitest';
import { getPersistentSelfModel, PersistentSelfModel } from '../src/lib/consciousness/persistent-self-model';
import { curatorAuditSelf } from '../src/lib/cortex-agents/curator-tools';
import { AgentRuntime } from '../src/lib/cortex-agents/runtime';
import { registerAgentWorkers } from '../src/lib/cortex-agents/workers';

describe('Dynamic Self-Model Capabilities Hydration', () => {
  beforeEach(() => {
    const rt = new AgentRuntime();
    registerAgentWorkers(rt);
  });

  it('hydrates PersistentSelfModel bodySchema with audited host tools and effectors', async () => {
    const audit = await curatorAuditSelf();
    const selfModel = new PersistentSelfModel();

    const initialSchema = selfModel.getBodySchema();
    // Initially has only 4 modalities and 3 effectors
    expect(initialSchema.motorEffectorTypes.length).toBeLessThan(10);

    // Hydrate from dynamic audit
    selfModel.hydrateFromDynamicCapabilities(audit.capabilities);

    const hydratedSchema = selfModel.getBodySchema();
    // Must now contain real host tools and fleet effectors
    expect(hydratedSchema.motorEffectorTypes).toContain('run_command');
    expect(hydratedSchema.motorEffectorTypes).toContain('read_file');
    expect(hydratedSchema.motorEffectorTypes).toContain('write_file');
    expect(hydratedSchema.motorEffectorTypes).toContain('hermes_tool_execution');
    expect(hydratedSchema.perceptualModalities).toContain('curator_fleet_radar');
    expect(hydratedSchema.motorEffectorTypes.length).toBeGreaterThanOrEqual(15);
  });
});
