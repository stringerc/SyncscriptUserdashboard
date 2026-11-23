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
}

export interface StrategicDashboard {
  generatedAt: number;
  goals: GoalHealth[];
  hostEffort30d: GoalTrendPoint[];
}
