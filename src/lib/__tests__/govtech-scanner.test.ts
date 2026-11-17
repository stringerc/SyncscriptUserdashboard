import { describe, it, expect } from 'vitest';
import {
  scanOpportunities,
  filterOpportunities,
  MOCK_FEDERAL_OPPORTUNITIES,
} from '../../../storefront/tools/sam-gov-scanner.mjs';

describe('SAM.gov Ingestion Scanner Tool', () => {
  it('contains curated baseline federal opportunities with diverse NAICS and set-asides', () => {
    expect(MOCK_FEDERAL_OPPORTUNITIES.length).toBeGreaterThanOrEqual(4);
    expect(MOCK_FEDERAL_OPPORTUNITIES.some((o) => o.naicsCode === '541511')).toBe(true);
    expect(MOCK_FEDERAL_OPPORTUNITIES.some((o) => o.source === 'TRADEWINDS')).toBe(true);
  });

  it('filters opportunities strictly by NAICS, Small Business Set-Aside, and SAT <= $250k', () => {
    const filtered = filterOpportunities(MOCK_FEDERAL_OPPORTUNITIES, {
      satOnly: true,
      smallBusinessOnly: true,
      allowedNaics: ['541511', '541512'],
    });

    for (const opp of filtered) {
      expect(['541511', '541512']).toContain(opp.naicsCode);
      expect(opp.estimatedValue).toBeLessThanOrEqual(250000);
      const isSbsa =
        opp.setAside.includes('SMALL') ||
        opp.setAside.includes('SBSA') ||
        opp.setAside.includes('TOTAL_SMALL_BUSINESS');
      expect(isSbsa).toBe(true);
    }
  });

  it('performs full opportunity scan and returns Bayesian P(Win) scored opportunities', async () => {
    const result = await scanOpportunities({
      useMock: true,
      minPWin: 80.0,
      satOnly: true,
    });

    expect(result.scannedCount).toBeGreaterThanOrEqual(4);
    expect(result.qualifiedCount).toBeGreaterThanOrEqual(1);
    expect(result.opportunities.length).toBe(result.qualifiedCount);

    for (const opp of result.opportunities) {
      expect(opp.viable).toBe(true);
      expect(opp.pWin.pWinScore).toBeGreaterThanOrEqual(80.0);
      expect(opp.solicitation.estimatedValue).toBeLessThanOrEqual(250000);
    }
  });

  it('disqualifies solicitations with clearance requirements or low technical fit during scan', async () => {
    const result = await scanOpportunities({
      useMock: true,
      minPWin: 80.0,
      satOnly: false,
    });

    const disqualified = result.allEvaluations.filter((e) => !e.viable);
    expect(disqualified.length).toBeGreaterThan(0);
    expect(disqualified.some((d) => d.pWin.riskPenalty >= 50 || d.pWin.pWinScore < 80)).toBe(true);
  });

  it('enqueues qualified opportunities into distribution-queue.json adhering to QueueFile schema with status pending and createdAt', async () => {
    const result = await scanOpportunities({
      useMock: true,
      minPWin: 80.0,
      satOnly: true,
      enqueue: true,
    });

    expect(result.qualifiedCount).toBeGreaterThan(0);

    // Verify queue file format
    const fs = await import('node:fs');
    const path = await import('node:path');
    const queuePath = path.resolve(process.cwd(), 'storefront/distribution-queue.json');
    expect(fs.existsSync(queuePath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    expect(parsed).toHaveProperty('items');
    expect(Array.isArray(parsed.items)).toBe(true);

    const enqueued = parsed.items.find((i: any) => i.type === 'sam_gov_capture');
    expect(enqueued).toBeDefined();
    expect(enqueued.status).toBe('pending');
    expect(typeof enqueued.createdAt).toBe('number');
    expect(enqueued.staged_pending_human).toBe(true);
  });
});
