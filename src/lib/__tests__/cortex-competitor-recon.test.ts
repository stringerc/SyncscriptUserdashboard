import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  probeCompetitorIntelligence,
  listCompetitorRadar,
} from '../cortex-competitor-recon';

vi.mock('../cortex-memory', () => ({
  retainCortexMemory: vi.fn().mockResolvedValue(true),
  recallCortexMemory: vi.fn().mockResolvedValue(''),
}));

describe('Cortex Competitor Recon Radar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists default reference competitors in radar', () => {
    const list = listCompetitorRadar();
    expect(list.length).toBeGreaterThanOrEqual(3);
    const domains = list.map((c) => c.domain);
    expect(domains).toContain('linear.app');
    expect(domains).toContain('cursor.com');
  });

  it('probes a new target domain and extracts structured intelligence', async () => {
    const record = await probeCompetitorIntelligence('https://raycast.com/pro');
    expect(record.domain).toBe('raycast.com');
    expect(record.brandName).toBe('RAYCAST');
    expect(record.headlineHook).toBeTruthy();
    expect(record.detectedPixels).toContain('Google Tag Manager');
    expect(record.longestRunningAdThemes.length).toBeGreaterThan(0);
    expect(record.communityObjections.length).toBeGreaterThan(0);
  });

  it('throws an error for empty target', async () => {
    await expect(probeCompetitorIntelligence('   ')).rejects.toThrow(
      'Target domain or URL is required'
    );
  });
});
