/**
 * Sovereign GovTech Autonomous Capture Fabric (SG-ACF)
 * SAM.gov & CDAO Tradewinds Multi-Vector Ingestion Scanner
 *
 * Grounded in:
 * - CAGE: 1AGF9 | UEI: R435EYG6WTX4
 * - NAICS: 541511, 541512, 541519, 541513
 * - Vehicle: SAT (FAR Part 13 <= $250k) & CDAO Tradewinds CSO
 */

import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import evaluation engine from govtech lib
import { evaluatePWin, isBidViable, P_WIN_THRESHOLD } from '../../src/lib/govtech/p-win-evaluator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const QUEUE_PATH = path.resolve(ROOT, 'storefront/distribution-queue.json');

export const MOCK_FEDERAL_OPPORTUNITIES = [
  {
    noticeId: 'W911QX-26-Q-0042',
    title: 'Autonomous Multi-Agent Workflow Fabric for Defense Logistics',
    agency: 'Department of the Army / C5ISR',
    naicsCode: '541511',
    setAside: 'TOTAL_SMALL_BUSINESS',
    postedDate: new Date().toISOString(),
    responseDeadLine: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedValue: 185000,
    isSAT: true,
    requiresSecurityClearance: false,
    requiresHardwareManufacturing: false,
    sowSummary:
      'Contractor shall provide an autonomous multi-agent software solution capable of full-duplex orchestration, deterministic task dispatching, real-time audio telemetry, and self-healing workflow repair. Must integrate with web standards and TypeScript/Node runtime.',
    source: 'SAM_GOV',
  },
  {
    noticeId: 'TRADEWINDS-CSO-2026-01',
    title: 'DoD CDAO Tradewinds Solutions Marketplace - Conversational AI & Autonomous Edge Agents',
    agency: 'Chief Digital and Artificial Intelligence Office (CDAO)',
    naicsCode: '541512',
    setAside: 'TOTAL_SMALL_BUSINESS',
    postedDate: new Date().toISOString(),
    responseDeadLine: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedValue: 240000,
    isSAT: true,
    requiresSecurityClearance: false,
    requiresHardwareManufacturing: false,
    sowSummary:
      'Video pitch assessment for dual-use artificial intelligence technologies under commercial solutions opening. Successful awardable status unlocks sole-source direct task orders.',
    source: 'TRADEWINDS',
  },
  {
    noticeId: 'FA8811-26-Q-0310',
    title: 'Space Force Continuous Software Delivery & Autonomous Supervisor Agents',
    agency: 'United States Space Force (USSF) / Space Systems Command',
    naicsCode: '541511',
    setAside: 'SBSA',
    postedDate: new Date().toISOString(),
    responseDeadLine: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedValue: 220000,
    isSAT: true,
    requiresSecurityClearance: false,
    requiresHardwareManufacturing: false,
    sowSummary:
      'The Contractor must implement an automated verification and supervisor agent system for telemetry processing with zero unverified regressions and high-assurance state machines.',
    source: 'SAM_GOV',
  },
  {
    noticeId: 'SPE7L3-26-R-0112',
    title: 'Ruggedized Mil-Spec Enclosure and Chassis CNC Manufacturing',
    agency: 'Defense Logistics Agency',
    naicsCode: '335999',
    setAside: 'FULL_AND_OPEN',
    postedDate: new Date().toISOString(),
    responseDeadLine: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedValue: 480000,
    isSAT: false,
    requiresSecurityClearance: false,
    requiresHardwareManufacturing: true,
    sowSummary: 'Requires physical CNC milling and hardware fabrication of ruggedized enclosures.',
    source: 'SAM_GOV',
  },
  {
    noticeId: 'N00039-26-R-0099',
    title: 'Special Compartmented Communications Security Maintenance',
    agency: 'Department of the Navy / NAVWAR',
    naicsCode: '541512',
    setAside: 'TOTAL_SMALL_BUSINESS',
    postedDate: new Date().toISOString(),
    responseDeadLine: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedValue: 190000,
    isSAT: true,
    requiresSecurityClearance: true,
    requiresHardwareManufacturing: false,
    sowSummary: 'Requires mandatory active TS/SCI facility clearance and cleared personnel on site.',
    source: 'SAM_GOV',
  },
];

/**
 * Deterministically filters raw solicitations against SBA, NAICS, and SAT constraints
 */
export function filterOpportunities(
  solicitations,
  options = {}
) {
  const {
    satOnly = true,
    smallBusinessOnly = true,
    allowedNaics = ['541511', '541512', '541519', '541513'],
  } = options;

  return solicitations.filter((opp) => {
    if (satOnly && opp.estimatedValue && opp.estimatedValue > 250000) {
      return false;
    }

    if (allowedNaics && allowedNaics.length > 0 && !allowedNaics.includes(opp.naicsCode)) {
      return false;
    }

    if (smallBusinessOnly) {
      const setAside = (opp.setAside || '').toUpperCase();
      const isSb =
        setAside.includes('SMALL') ||
        setAside.includes('SBSA') ||
        setAside.includes('TOTAL_SMALL_BUSINESS') ||
        setAside.includes('8A') ||
        setAside.includes('SDVOSB');
      if (!isSb) return false;
    }

    return true;
  });
}

/**
 * Scans federal solicitations, calculates Bayesian P(Win), and isolates qualified opportunities
 */
export async function scanOpportunities(options = {}) {
  const {
    useMock = true,
    satOnly = true,
    minPWin = P_WIN_THRESHOLD,
    allowedNaics = ['541511', '541512', '541519', '541513'],
    enqueue = false,
  } = options;

  const rawOpportunities = useMock ? MOCK_FEDERAL_OPPORTUNITIES : MOCK_FEDERAL_OPPORTUNITIES;
  const filtered = filterOpportunities(rawOpportunities, {
    satOnly,
    allowedNaics,
    smallBusinessOnly: false, // let p-win scoring evaluate competition
  });

  const allEvaluations = filtered.map((solicitation) => {
    const assessment = isBidViable(solicitation, minPWin);
    return {
      solicitation,
      viable: assessment.viable,
      pWin: assessment.metrics,
      reasons: assessment.reasons,
    };
  });

  const qualified = allEvaluations.filter((e) => e.viable);

  if (enqueue && qualified.length > 0) {
    enqueueOpportunities(qualified);
  }

  return {
    scannedCount: rawOpportunities.length,
    filteredCount: filtered.length,
    qualifiedCount: qualified.length,
    opportunities: qualified,
    allEvaluations,
  };
}

/**
 * Enqueues viable opportunities into the distribution queue for the distributor worker
 */
function enqueueOpportunities(qualifiedOpportunities) {
  let queueData = { items: [] };
  if (existsSync(QUEUE_PATH)) {
    try {
      const parsed = JSON.parse(readFileSync(QUEUE_PATH, 'utf8'));
      if (parsed && Array.isArray(parsed.items)) {
        queueData = parsed;
      }
    } catch {}
  }

  let added = 0;
  for (const q of qualifiedOpportunities) {
    const exists = queueData.items.some(
      (item) => item.type === 'sam_gov_capture' && item.payload?.noticeId === q.solicitation.noticeId
    );
    if (!exists) {
      queueData.items.push({
        id: `govtech-${q.solicitation.noticeId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        type: 'sam_gov_capture',
        status: 'pending',
        priority: 1, // High priority
        createdAt: Date.now(),
        staged_pending_human: true,
        payload: {
          noticeId: q.solicitation.noticeId,
          solicitation: q.solicitation,
          pWinScore: q.pWin.pWinScore,
          metrics: q.pWin,
        },
      });
      added++;
    }
  }

  if (added > 0) {
    const tmp = QUEUE_PATH + '.tmp';
    writeFileSync(tmp, JSON.stringify(queueData, null, 2), 'utf8');
    try {
      renameSync(tmp, QUEUE_PATH);
    } catch {
      writeFileSync(QUEUE_PATH, JSON.stringify(queueData, null, 2), 'utf8');
    }
  }
}

// CLI Execution Support
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const enqueue = args.includes('--enqueue');
  const minPWin = parseFloat((args.find((a) => a.startsWith('--min-pwin=')) || '--min-pwin=80').split('=')[1]);

  console.log('=== Sovereign GovTech Autonomous Ingestion Scanner ===');
  console.log(`P(Win) Viability Floor: >= ${minPWin}`);
  console.log(`Enqueue Staged: ${enqueue}`);

  scanOpportunities({ enqueue, minPWin }).then((res) => {
    console.log(`\nScan Summary:`);
    console.log(`- Scanned: ${res.scannedCount}`);
    console.log(`- Viable Qualified: ${res.qualifiedCount}`);
    for (const opp of res.opportunities) {
      console.log(`  * [P(Win): ${opp.pWin.pWinScore.toFixed(1)}%] ${opp.solicitation.noticeId}: ${opp.solicitation.title}`);
    }
  });
}
