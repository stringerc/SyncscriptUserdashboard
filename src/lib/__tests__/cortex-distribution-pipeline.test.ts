import { describe, it, expect } from 'vitest';
import { runOmniPublish, ITEM_HANDLERS, enqueueDistributionItem, verifyPublicUrl } from '../cortex-agents/distribution';
import type { AgentContext } from '../cortex-agents/runtime';

describe('cortex-distribution-pipeline', () => {
  it('registers omni_publish and platform item handlers', () => {
    expect(ITEM_HANDLERS.omni_publish).toBeDefined();
    expect(typeof ITEM_HANDLERS.omni_publish).toBe('function');
    expect(ITEM_HANDLERS.kdp_publish).toBeDefined();
    expect(ITEM_HANDLERS.redbubble_publish).toBeDefined();
    expect(ITEM_HANDLERS.gumroad_publish).toBeDefined();
  });

  it('verifies public URL with closed-loop HTTP probe', async () => {
    // Verified live product on Gumroad
    const res = await verifyPublicUrl('https://syncmaster1.gumroad.com/l/sovereign-real-estate-os');
    expect(res).toBeDefined();
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);

    // Non-existent or invalid domain
    const badRes = await verifyPublicUrl('https://this-is-a-completely-invalid-subdomain-12345.com');
    expect(badRes.ok).toBe(false);
  }, 15000);

  it('enqueues omni_publish queue item with deduplication', () => {
    const payload = { productId: 'sovereign-real-estate-os', platform: 'all', dryRun: true };
    const res1 = enqueueDistributionItem('omni_publish', payload);
    expect(res1.ok).toBe(true);
    expect(res1.item).toBeDefined();

    // Second enqueue with identical payload should dedupe
    const res2 = enqueueDistributionItem('omni_publish', payload);
    expect(res2.ok).toBe(true);
    expect(res2.reason).toMatch(/duplicate/i);
  });

  it('executes omni_publish with dryRun reporting staged status', async () => {
    const mockCtx: AgentContext = {
      task: {
        id: 't-test-omni',
        kind: 'omni_publish',
        agentId: 'distributor',
        title: 'Run Omni Publisher',
        status: 'running',
        createdAt: Date.now(),
        progress: 0,
        input: {},
      },
      progress: () => {},
      llm: async () => '',
      emit: () => {},
      signal: new AbortController().signal,
      telemetry: { toolCalls: 0, toolFailures: 0 },
    };

    const res: any = await runOmniPublish(mockCtx, { platform: 'all', dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(res.staged).toBe(true);
    expect(res.exitCode).toBe(0);
  }, 15000);
});
