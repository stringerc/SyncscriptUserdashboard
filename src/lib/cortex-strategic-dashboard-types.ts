/**
 * Shared client-safe types for the Strategic Review dashboard payload
 * (GET /api/cortex/strategic/dashboard). Kept separate from
 * strategic-dashboard.ts because that module is server-only (node:fs).
 */

export interface GoalTrendPoint { day: string; count: number }

export interface GoalHealth {
  id: string;
  title: string;
  horizon: string;
  targetDate: string | null;
  daysLeft: number | null;
  status: 'on-track' | 'drifting' | 'escalated';
  driftScore: number;
  ops: { done: number; total: number };
  commits7d: number;
  effort7d: number;
  trend: GoalTrendPoint[];
  trendMax: number;
  findings: Array<{ kind: string; detail: string; severity: string; ts: number }>;
  premortems: Array<{ kind: string; headline: string; engine: string; ts: number }>;
  pendingVerification: { kind: string; correctiveTitle: string; finishedAt: number } | null;
  lastVerification: { outcome: 'resolved' | 'escalated'; correctiveKind: string; ts: number } | null;
  correctives: Array<{ id: string; title: string; status: string; agentId: string; createdAtMs: number }>;
  escalations: Array<{ id: string; title: string; status: string; createdAtMs: number }>;
  forecast?: GoalForecast | null;
  paceWatch?: {
    proposalId: string; acceptedAt: number; elapsedDays: number;
    actual: number; expected: number; ratio: number | null; onPace: boolean;
  } | null;
}

export interface GoalForecast {
  goalId: string;
  goalTitle: string;
  targetDate: string | null;
  daysLeft: number | null;
  probability: number | null;
  basis: 'ops-gamma' | 'insufficient-data' | 'no-target' | 'complete';
  remainingOps: number;
  weeklyRate: number;
  requiredWeekly: number;
  paceRatio: number | null;
  projectedFinish: string | null;
  observations: number;
  momentum: 'up' | 'flat' | 'down' | null;
  rawProbability?: number;
  calibrated?: boolean;
  calibrationN?: number;
  portfolioImpact?: {
    effortBudgetDaily: number;
    leverCostDaily: number;
    goals: Array<{ goalId: string; title: string; shareBefore: number; shareAfter: number }>;
  };
}

export interface CalibrationReport {
  claims: number; outcomes: number; resolvedGoals: number;
  buckets: Array<{ band: string; predicted: number; observed: number; n: number }>;
  overallBias: number | null;
  sufficientData: boolean;
}

export interface StrategicDashboard {
  generatedAt: number;
  goals: GoalHealth[];
  hostEffort30d: GoalTrendPoint[];
  calibration?: CalibrationReport;
  paceWatch?: Array<{ goalId: string; proposalId: string; acceptedAt: number; elapsedDays: number; actual: number; expected: number; ratio: number | null; onPace: boolean }>;
  interoceptive?: {
    error: number; capacity: number; level: 'nominal' | 'strained' | 'critical';
    vitals: { rssMB: number; heapUsedMB: number; loadAvg1m: number; cores: number; memFreePct?: number; lagP99Ms?: number };
    computedAt: number;
  };
}
