import { describe, it, expect } from 'vitest';
import { validateOmniManifest, loadOmniManifest } from '../storefront/omni-manifest';
import { runOmniPublish } from '../cortex-agents/distribution';
import type { AgentContext } from '../cortex-agents/runtime';

describe('validateOmniManifest', () => {
  it('validates a complete 4-platform product configuration', () => {
    const validConfig = {
      productId: 'sovereign-real-estate-os',
      version: '2.0.0',
      title: 'The Sovereign Real Estate OS',
      platforms: {
        gumroad: { channel: 'api', price: 47, files: ['dist/gumroad/sovereign-real-estate-os.zip'] },
        etsy: { channel: 'cdp', price: 24.99, digitalFile: 'dist/etsy/access-canva-templates.pdf', tags: ['real estate canva'] },
        kdp: { channel: 'cdp', price: 14.99, interiorPdf: 'dist/kdp/interior-8.5x11.pdf', coverPdf: 'dist/kdp/cover-wrap.pdf' },
        redbubble: { channel: 'cdp', artwork: 'dist/redbubble/art-4500x5400-blueprint.png', tags: ['realtor'] },
      },
    };
    const res = validateOmniManifest(validConfig);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('rejects missing productId or invalid pricing', () => {
    const invalidConfig = { productId: '', platforms: { gumroad: { price: -5 } } };
    const res = validateOmniManifest(invalidConfig);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('validates root metadata fields title and version', () => {
    const missingTitle = {
      productId: 'test-id',
      version: '1.0.0',
      platforms: {},
    };
    const res = validateOmniManifest(missingTitle);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e: string) => e.includes('title'))).toBe(true);

    const missingVersion = {
      productId: 'test-id',
      title: 'Valid Title',
      platforms: {},
    };
    const res2 = validateOmniManifest(missingVersion);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e: string) => e.includes('version'))).toBe(true);
  });

  it('verifies platform requirements for Etsy tags and KDP PDFs', () => {
    const missingKdpPdfs = {
      productId: 'test',
      title: 'Test Product',
      platforms: {
        kdp: { channel: 'cdp', price: 10 },
      },
    };
    const res = validateOmniManifest(missingKdpPdfs);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e: string) => e.includes('interiorPdf'))).toBe(true);
  });
});

describe('runOmniPublish', () => {
  it('executes omni-publisher with AgentContext and reports staged status', async () => {
    let progressVal = 0;
    const mockCtx: AgentContext = {
      task: {
        id: 't-test',
        kind: 'omni_publish',
        agentId: 'distributor',
        title: 'Publish Omni Products',
        status: 'running',
        createdAt: Date.now(),
        progress: 0,
        input: {},
      },
      progress: (p: number) => { progressVal = p; },
      llm: async () => '',
      emit: () => {},
      signal: new AbortController().signal,
      telemetry: { toolCalls: 0, toolFailures: 0 },
    };

    const res = await runOmniPublish(mockCtx, { platform: 'all', dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(res.exitCode).toBe(0);
    expect(res.staged).toBe(true);
    expect(progressVal).toBe(1);
  }, 15000);
});
