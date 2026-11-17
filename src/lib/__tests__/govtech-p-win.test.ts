import { describe, it, expect } from 'vitest';
import { evaluatePWin, isBidViable } from '../govtech/p-win-evaluator';
import type { FederalSolicitation } from '../govtech/sam-types';

describe('Bayesian P(Win) Decision Engine', () => {
  const baseSolicitation: FederalSolicitation = {
    noticeId: 'W911QX-26-Q-0042',
    title: 'Autonomous Multi-Agent Workflow Fabric for Defense Logistics',
    agency: 'Department of the Army / C5ISR',
    naicsCode: '541511', // Custom Computer Programming Services
    setAside: 'TOTAL_SMALL_BUSINESS',
    postedDate: new Date().toISOString(),
    responseDeadLine: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(), // 21 days
    estimatedValue: 185000, // SAT (< $250k)
    isSAT: true,
    requiresSecurityClearance: false,
    requiresHardwareManufacturing: false,
    sowSummary:
      'Contractor shall provide an autonomous multi-agent software solution capable of full-duplex orchestration, deterministic task dispatching, real-time audio telemetry, and self-healing workflow repair. Must integrate with web standards and TypeScript/Node runtime.',
    source: 'SAM_GOV',
  };

  it('evaluates high-fit SBSA AI solicitation above 80.0 threshold', () => {
    const metrics = evaluatePWin(baseSolicitation);
    expect(metrics.pWinScore).toBeGreaterThanOrEqual(80.0);
    expect(metrics.technicalFit).toBeGreaterThanOrEqual(85.0);
    expect(metrics.competitionDensity).toBeGreaterThanOrEqual(75.0);
    expect(metrics.riskPenalty).toBeLessThan(15.0);

    const viability = isBidViable(baseSolicitation);
    expect(viability.viable).toBe(true);
    expect(viability.metrics.pWinScore).toBeGreaterThanOrEqual(80.0);
    expect(viability.reasons).toContain('High technical fit with Cortex multi-agent & voice orchestration architecture');
  });

  it('disqualifies solicitations requiring TS/SCI clearance with heavy risk penalty', () => {
    const tsSciSolicitation: FederalSolicitation = {
      ...baseSolicitation,
      noticeId: 'N00039-26-R-0099',
      requiresSecurityClearance: true,
      sowSummary: 'Requires Top Secret / SCI active facility clearance and TS/SCI cleared personnel on site.',
    };

    const metrics = evaluatePWin(tsSciSolicitation);
    expect(metrics.pWinScore).toBeLessThan(80.0);
    expect(metrics.riskPenalty).toBeGreaterThanOrEqual(50.0);

    const viability = isBidViable(tsSciSolicitation);
    expect(viability.viable).toBe(false);
    expect(viability.reasons.some((r) => r.includes('security clearance') || r.includes('TS/SCI'))).toBe(true);
  });

  it('disqualifies solicitations requiring physical hardware manufacturing', () => {
    const hardwareSolicitation: FederalSolicitation = {
      ...baseSolicitation,
      noticeId: 'SPE7L3-26-R-0112',
      naicsCode: '335999', // Miscellaneous electrical equipment and component manufacturing
      requiresHardwareManufacturing: true,
      sowSummary: 'CNC milling and mil-spec ruggedized circuit board fabrication.',
    };

    const metrics = evaluatePWin(hardwareSolicitation);
    expect(metrics.pWinScore).toBeLessThan(80.0);

    const viability = isBidViable(hardwareSolicitation);
    expect(viability.viable).toBe(false);
    expect(viability.reasons.some((r) => r.includes('hardware manufacturing'))).toBe(true);
  });

  it('scores CDAO Tradewinds open CSO fast-track solicitations with high win probability', () => {
    const tradewindsSolicitation: FederalSolicitation = {
      noticeId: 'TRADEWINDS-CSO-2026-01',
      title: 'DoD CDAO Tradewinds Solutions Marketplace - Conversational AI & Autonomous Edge Agents',
      agency: 'Chief Digital and Artificial Intelligence Office (CDAO)',
      naicsCode: '541512',
      setAside: 'TOTAL_SMALL_BUSINESS',
      postedDate: new Date().toISOString(),
      responseDeadLine: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      estimatedValue: 240000,
      isSAT: true,
      requiresSecurityClearance: false,
      requiresHardwareManufacturing: false,
      sowSummary:
        'Video pitch assessment for dual-use artificial intelligence technologies under commercial solutions opening. Successful awardable status unlocks sole-source direct task orders.',
      source: 'TRADEWINDS',
    };

    const viability = isBidViable(tradewindsSolicitation);
    expect(viability.viable).toBe(true);
    expect(viability.metrics.pWinScore).toBeGreaterThanOrEqual(85.0);
  });

  it('penalizes short turnaround windows (< 5 days)', () => {
    const tightDeadlineSolicitation: FederalSolicitation = {
      ...baseSolicitation,
      responseDeadLine: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
    };

    const metrics = evaluatePWin(tightDeadlineSolicitation);
    expect(metrics.scheduleFeasibility).toBeLessThan(50.0);
    expect(metrics.riskPenalty).toBeGreaterThanOrEqual(10.0);
  });

  it('includes disqualification reasons when clearance or hardware is detected from corpus alone', () => {
    const corpusOnlyClearance: FederalSolicitation = {
      ...baseSolicitation,
      requiresSecurityClearance: undefined, // undefined on object
      sowSummary: 'The Contractor shall provide TS/SCI cleared analysts for Top Secret access on site.',
    };

    const viability = isBidViable(corpusOnlyClearance);
    expect(viability.viable).toBe(false);
    expect(viability.reasons.some((r) => r.includes('TS/SCI') || r.includes('security clearance'))).toBe(true);
  });
});
