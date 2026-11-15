/**
 * Environmental Coupling — Real Sensorimotor Interface to the System
 *
 * This module provides the system's sensory interface to its operational
 * environment. It gathers REAL metrics, not just the clock:
 *
 * 1. System performance (API response times, error rates)
 * 2. AI model performance (latency, success rates per provider)
 * 3. User activity patterns (active vs idle detection)
 * 4. Time-of-day awareness (circadian modeling)
 * 5. Network connectivity state
 *
 * These metrics feed into:
 * - The ActionObserver for automatic action tracking
 * - The MetacognitiveState for environmental resonance scoring
 * - The SensorimotorLoop for embodied mastery tracking
 *
 * Design principle: every metric here must be DERIVED from real
 * observations, not hardcoded. The circadian model can have priors,
 * but they must update from evidence.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface EnvironmentState {
  /** Current time in local timezone */
  time: {
    hour: number;
    minute: number;
    dayOfWeek: number;
    timezone: string;
    isBusinessHours: boolean;
    isWeekend: boolean;
  };

  /** Device state — null if unavailable */
  device: {
    batteryLevel: number | null;
    isCharging: boolean | null;
    isOnline: boolean | null;
    connectionType: string | null;
    screenAreaPx: number | null;
  } | null;

  /** System performance metrics — derived from actual observations */
  system: {
    /** Mean API response time (ms) over last hour */
    meanApiLatencyMs: number;
    /** API error rate (0-1) over last hour */
    apiErrorRate: number;
    /** Total API calls in current session */
    totalApiCalls: number;
    /** AI model average latency (ms) over last hour */
    meanAiLatencyMs: number;
    /** AI model success rate (0-1) over last hour */
    aiSuccessRate: number;
    /** Total AI calls in current session */
    totalAiCalls: number;
  };

  /** Derived environmental resonance — how aligned is the env with cognitive work? */
  environmentalResonance: number;

  timestamp: number;
}

// ── Internal tracking ──────────────────────────────────────────────

interface ApiObservation {
  timestamp: number;
  latencyMs: number;
  success: boolean;
  category: 'api' | 'ai';
}

const apiObservations: ApiObservation[] = [];
const MAX_OBSERVATIONS = 500;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;

/** Record an API call result. Call this from anywhere in the system
 *  when an API call completes — e.g., from fetch wrappers, AI SDK
 *  callbacks, or the ActionObserver. */
export function recordApiObservation(
  category: 'api' | 'ai',
  latencyMs: number,
  success: boolean,
): void {
  apiObservations.push({ timestamp: Date.now(), latencyMs, success, category });
  if (apiObservations.length > MAX_OBSERVATIONS) {
    apiObservations.shift();
  }
}

// ── User activity tracking ─────────────────────────────────────────

let lastUserActivityTs = 0;
const ACTIVITY_IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min = idle

/** Call this when user interaction is detected (clicks, typing, scrolls). */
export function recordUserActivity(): void {
  lastUserActivityTs = Date.now();
}

/** Is the user currently active (interacted within last 5 min)? */
export function isUserActive(): boolean {
  if (lastUserActivityTs === 0) return false;
  return Date.now() - lastUserActivityTs < ACTIVITY_IDLE_THRESHOLD_MS;
}

// ── Circadian model with learning ──────────────────────────────────

/** Hour-of-day → observed productivity score (updated from evidence) */
const circadianEvidence: Array<{ hour: number; productivity: number; samples: number }> =
  Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    // Default prior: peak 9-12, dip at lunch, secondary peak 14-16
    productivity: h >= 9 && h <= 12 ? 0.85 :
                  h >= 13 && h <= 14 ? 0.55 :
                  h >= 15 && h <= 16 ? 0.7 :
                  h >= 17 && h <= 20 ? 0.5 :
                  h >= 7 && h <= 8 ? 0.6 :
                  0.3,
    samples: 0,
  }));

/** Update the circadian model with observed productivity for a given hour.
 *  Call this when a task completes with a measurable success metric. */
export function updateCircadianModel(hour: number, productivity: number): void {
  if (hour < 0 || hour > 23) return;
  const slot = circadianEvidence[hour];
  if (!slot) return;

  if (slot.samples === 0) {
    slot.productivity = productivity;
  } else {
    // Exponential moving average — recent evidence weighted more
    slot.productivity = 0.7 * slot.productivity + 0.3 * productivity;
  }
  slot.samples++;
}

// ── Main sampling function ─────────────────────────────────────────

/**
 * Sample the current environment state.
 * Returns real metrics where available, null otherwise.
 */
export function sampleEnvironment(): EnvironmentState {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  const isBusinessHours = hour >= 9 && hour < 17 && dayOfWeek >= 1 && dayOfWeek <= 5;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let timezone = 'unknown';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch { /* fallback */ }

  // Device state — browser APIs
  let batteryLevel: number | null = null;
  let isCharging: boolean | null = null;
  let isOnline: boolean | null = null;
  let connectionType: string | null = null;
  let screenAreaPx: number | null = null;

  if (typeof navigator !== 'undefined') {
    isOnline = navigator.onLine;
    if (typeof screen !== 'undefined') {
      screenAreaPx = screen.width * screen.height;
    }
    try {
      const conn = (navigator as unknown as Record<string, unknown>).connection as
        { effectiveType?: string } | undefined;
      if (conn?.effectiveType) connectionType = conn.effectiveType;
    } catch { /* unavailable */ }
  }

  // System metrics from real observations
  const cutoff = Date.now() - HOURLY_WINDOW_MS;
  const recentApi = apiObservations.filter(o => o.category === 'api' && o.timestamp > cutoff);
  const recentAi = apiObservations.filter(o => o.category === 'ai' && o.timestamp > cutoff);

  const meanApiLatencyMs = recentApi.length > 0
    ? recentApi.reduce((s, o) => s + o.latencyMs, 0) / recentApi.length
    : 0;
  const apiErrorRate = recentApi.length > 0
    ? recentApi.filter(o => !o.success).length / recentApi.length
    : 0;
  const meanAiLatencyMs = recentAi.length > 0
    ? recentAi.reduce((s, o) => s + o.latencyMs, 0) / recentAi.length
    : 0;
  const aiSuccessRate = recentAi.length > 0
    ? recentAi.filter(o => o.success).length / recentAi.length
    : 0;

  // Environmental resonance — weighted from real metrics
  const circadianScore = circadianEvidence[hour]?.productivity ?? 0.5;
  const activityBonus = isUserActive() ? 0.1 : -0.05;
  const networkBonus = isOnline !== false ? 0.05 : -0.2;
  const apiHealthBonus = apiErrorRate < 0.1 ? 0.05 : apiErrorRate > 0.3 ? -0.15 : 0;
  const batteryPenalty = batteryLevel !== null && batteryLevel < 0.2 ? -0.1 : 0;

  const environmentalResonance = Math.max(0, Math.min(1,
    circadianScore + activityBonus + networkBonus + apiHealthBonus + batteryPenalty
  ));

  return {
    time: { hour, minute: now.getMinutes(), dayOfWeek, timezone, isBusinessHours, isWeekend },
    device: { batteryLevel, isCharging, isOnline, connectionType, screenAreaPx },
    system: {
      meanApiLatencyMs,
      apiErrorRate,
      totalApiCalls: apiObservations.filter(o => o.category === 'api').length,
      meanAiLatencyMs,
      aiSuccessRate,
      totalAiCalls: apiObservations.filter(o => o.category === 'ai').length,
    },
    environmentalResonance,
    timestamp: Date.now(),
  };
}
