/**
 * Sovereign GovTech Autonomous Capture Fabric (SG-ACF)
 * Bayesian P(Win) Decision Engine
 *
 * Implements mathematical P(Win) scoring:
 * P(Win) = (w1 * T_fit) + (w2 * C_comp) + (w3 * S_margin) + (w4 * E_match) - P_risk
 *
 * Grounded in:
 * - CAGE: 1AGF9
 * - UEI: R435EYG6WTX4
 * - NAICS: 541511, 541512, 541519, 541513
 * - Set-Aside: Total Small Business Set-Aside (SBSA)
 */

import {
  FederalSolicitation,
  PWinMetrics,
  ViabilityAssessment,
  TARGET_CREDENTIALS,
} from './sam-types';

export const P_WIN_THRESHOLD = 80.0;

const WEIGHTS = {
  technicalFit: 0.35,
  competitionDensity: 0.25,
  scheduleFeasibility: 0.2,
  evaluationMatch: 0.2,
} as const;

/**
 * Evaluates Bayesian P(Win) metrics for a federal solicitation
 */
export function evaluatePWin(solicitation: FederalSolicitation): PWinMetrics {
  const corpus = `${solicitation.title} ${solicitation.sowSummary} ${solicitation.fullText || ''}`.toLowerCase();

  // 1. Technical Fit (0 - 100)
  let techScore = 30; // base score for IT software scope
  if (/(multi-agent|autonomous|orchestration|agentic|workflow fabric|specialist agent)/i.test(corpus)) {
    techScore += 25;
  }
  if (/(voice|audio|conversational|telemetry|streaming|speech|duplex)/i.test(corpus)) {
    techScore += 20;
  }
  if (/(typescript|node|javascript|web standards|api|rest|json)/i.test(corpus)) {
    techScore += 15;
  }
  if (/(self-healing|deterministic|testing|compliance|assurance|automated repair)/i.test(corpus)) {
    techScore += 15;
  }
  const technicalFit = Math.min(100, techScore);

  // 2. Competition Density (0 - 100: Higher score = less competition)
  let compScore = 15;
  const setAsideUpper = (solicitation.setAside || '').toUpperCase();
  if (setAsideUpper.includes('SMALL') || setAsideUpper.includes('SBSA') || setAsideUpper.includes('TOTAL_SMALL_BUSINESS')) {
    compScore += 40;
  } else if (setAsideUpper.includes('8A') || setAsideUpper.includes('HUBZONE') || setAsideUpper.includes('SDVOSB')) {
    compScore += 35;
  }

  const isSatEffective =
    solicitation.isSAT ??
    (solicitation.estimatedValue !== undefined && solicitation.estimatedValue <= TARGET_CREDENTIALS.satThreshold);
  if (isSatEffective) {
    compScore += 25;
  }

  if (solicitation.source === 'TRADEWINDS') {
    compScore += 20; // CSO direct awardable vehicle drastically narrows competition
  }
  const competitionDensity = Math.min(100, compScore);

  // 3. Schedule Feasibility (0 - 100)
  let scheduleFeasibility = 80;
  const now = Date.now();
  const deadline = new Date(solicitation.responseDeadLine).getTime();
  const daysRemaining = (deadline - now) / (1000 * 60 * 60 * 24);

  if (daysRemaining >= 20) {
    scheduleFeasibility = 95;
  } else if (daysRemaining >= 14) {
    scheduleFeasibility = 88;
  } else if (daysRemaining >= 7) {
    scheduleFeasibility = 72;
  } else if (daysRemaining >= 5) {
    scheduleFeasibility = 55;
  } else if (daysRemaining > 0) {
    scheduleFeasibility = 30;
  } else {
    scheduleFeasibility = 0; // Expired
  }

  // 4. Evaluation Match (0 - 100: NAICS & entity alignment)
  let evalScore = 40;
  const isPrimaryNaics = (TARGET_CREDENTIALS.primaryNaics as readonly string[]).includes(solicitation.naicsCode);
  if (isPrimaryNaics) {
    evalScore += 40;
  } else if (solicitation.naicsCode.startsWith('5415')) {
    evalScore += 25;
  }

  if (solicitation.source === 'TRADEWINDS' || isSatEffective) {
    evalScore += 20;
  }
  const evaluationMatch = Math.min(100, evalScore);

  // 5. Risk Penalty (0 - 100: Deductions)
  let riskPenalty = 2; // baseline minimal uncertainty

  const requiresClearance =
    solicitation.requiresSecurityClearance ||
    /(ts\/sci|top secret|facility clearance|active security clearance)/i.test(corpus);
  if (requiresClearance) {
    riskPenalty += 65;
  }

  const requiresHardware =
    solicitation.requiresHardwareManufacturing ||
    solicitation.naicsCode.startsWith('33') ||
    /(hardware manufacturing|cnc milling|printed circuit board fabrication|chassis manufacturing)/i.test(corpus);
  if (requiresHardware) {
    riskPenalty += 55;
  }

  if (daysRemaining < 5 && daysRemaining > 0) {
    riskPenalty += 15;
  }

  // Calculate Bayesian P(Win) Score
  const rawScore =
    WEIGHTS.technicalFit * technicalFit +
    WEIGHTS.competitionDensity * competitionDensity +
    WEIGHTS.scheduleFeasibility * scheduleFeasibility +
    WEIGHTS.evaluationMatch * evaluationMatch -
    riskPenalty;

  const pWinScore = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));

  return {
    technicalFit,
    competitionDensity,
    scheduleFeasibility,
    evaluationMatch,
    riskPenalty,
    pWinScore,
  };
}

/**
 * Determines whether a solicitation is viable for autonomous capture
 */
export function isBidViable(
  solicitation: FederalSolicitation,
  threshold: number = P_WIN_THRESHOLD
): ViabilityAssessment {
  const metrics = evaluatePWin(solicitation);
  const reasons: string[] = [];

  if (metrics.technicalFit >= 80) {
    reasons.push('High technical fit with Cortex multi-agent & voice orchestration architecture');
  }

  if (metrics.competitionDensity >= 70) {
    reasons.push('Favorable competition density under SBSA / SAT / Tradewinds vehicle');
  }

  const corpus = `${solicitation.title} ${solicitation.sowSummary} ${solicitation.fullText || ''}`.toLowerCase();
  const requiresClearance =
    solicitation.requiresSecurityClearance ||
    /(ts\/sci|top secret|facility clearance|active security clearance)/i.test(corpus);
  const requiresHardware =
    solicitation.requiresHardwareManufacturing ||
    solicitation.naicsCode.startsWith('33') ||
    /(hardware manufacturing|cnc milling|printed circuit board fabrication|chassis manufacturing)/i.test(corpus);

  if (requiresClearance) {
    reasons.push('Disqualified: Requires active TS/SCI security clearance exceeding commercial small business credentials');
  }
  if (requiresHardware) {
    reasons.push('Disqualified: Requires physical hardware manufacturing out of scope for pure software capture');
  }

  if (metrics.scheduleFeasibility < 50) {
    reasons.push('High turnaround risk: response window < 5 calendar days');
  }

  const viable = metrics.pWinScore >= threshold;

  return {
    viable,
    metrics,
    reasons,
  };
}
