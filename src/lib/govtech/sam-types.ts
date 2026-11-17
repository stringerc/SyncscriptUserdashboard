/**
 * Sovereign GovTech Autonomous Capture Fabric (SG-ACF)
 * Core Data Contracts for SAM.gov, CDAO Tradewinds, and Federal Capture
 *
 * Grounded in verified entity credentials:
 * - Entity: Active Federal Contractor (SAM.gov Purpose: "All Awards", through March 16, 2027)
 * - UEI: R435EYG6WTX4
 * - CAGE: 1AGF9
 * - NAICS: 541511, 541512, 541519, 541513
 * - Set-Aside Eligibility: Total Small Business Set-Aside (SBSA)
 */

export type FederalSource = 'SAM_GOV' | 'TRADEWINDS' | 'FPDS' | 'MANUAL';

export type SetAsideType =
  | 'TOTAL_SMALL_BUSINESS'
  | 'SBSA'
  | '8A'
  | 'HUBZONE'
  | 'SDVOSB'
  | 'WOSB'
  | 'FULL_AND_OPEN'
  | 'NONE';

export interface FederalSolicitation {
  noticeId: string;
  title: string;
  agency: string;
  naicsCode: string;
  setAside: SetAsideType | string;
  postedDate: string;
  responseDeadLine: string;
  estimatedValue?: number;
  isSAT?: boolean; // Simplified Acquisition Threshold <= $250,000 under FAR Part 13
  requiresSecurityClearance?: boolean;
  requiresHardwareManufacturing?: boolean;
  sowSummary: string;
  fullText?: string;
  source: FederalSource;
  contactEmail?: string;
  solicitationNumber?: string;
  officeAddress?: string;
}

export interface PWinMetrics {
  technicalFit: number;        // 0 - 100: Alignment with voice, agent fleets, full-duplex, TypeScript
  competitionDensity: number;  // 0 - 100: Higher score = lower competition (e.g. SBSA, SAT, Tradewinds)
  scheduleFeasibility: number; // 0 - 100: Turnaround window feasibility (>= 14 days optimal)
  evaluationMatch: number;     // 0 - 100: Best value tradeoff & Section M compliance
  riskPenalty: number;         // 0 - 100: Deductions for clearance, hardware, foreign flags
  pWinScore: number;           // 0 - 100: Bayesian aggregate win probability
}

export interface ViabilityAssessment {
  viable: boolean;
  metrics: PWinMetrics;
  reasons: string[];
}

export const TARGET_CREDENTIALS = {
  cageCode: '1AGF9',
  uei: 'R435EYG6WTX4',
  legalBusinessName: 'SyncScript',
  location: 'Snellville, GA',
  primaryNaics: ['541511', '541512', '541519', '541513'],
  sbaDesignation: 'Total Small Business Set-Aside (SBSA)',
  activeRegistrationThrough: '2027-03-16',
  satThreshold: 250000,
} as const;
