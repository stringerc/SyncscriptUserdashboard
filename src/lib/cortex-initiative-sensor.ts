/**
 * cortex-initiative-sensor.ts — Proactive Initiative Sensor Bus (client poller)
 *
 * Periodically queries /api/cortex/initiative/sense for a live host snapshot
 * (git drift, memory pressure, free energy, email backlog heuristics) and feeds
 * it into CortexProactiveInitiativeEngine.evaluateInitiatives(). Proposals
 * surface in the Initiative Inbox panel and via voice.
 *
 * Design rules:
 * - Visibility-gated: never polls while the tab is hidden (battery/CPU).
 * - Fail-silent: a dead endpoint must never break the visualizer.
 * - Dedupe lives in the engine — polling is cheap and idempotent.
 */

import {
  getCortexProactiveInitiative,
  type InitiativeSensorOptions,
} from './cortex-proactive-initiative';
import { getCortexGoals } from './cortex-goals';
import { getCortexSomatic } from './cortex-somatic';

export interface InitiativeSenseResponse {
  ok: boolean;
  snapshot?: InitiativeSensorOptions & Record<string, unknown>;
  sources?: Record<string, 'live' | 'heuristic' | 'unavailable'>;
  timestamp?: number;
  error?: string;
}

export interface InitiativeSensorHandle {
  stop: () => void;
  poll: () => Promise<void>;
}

const DEFAULT_ENDPOINT = '/api/cortex/initiative/sense';
const DEFAULT_INTERVAL_MS = 30 * 1000; // 30 seconds (fast responsive initiative polling)
const FETCH_TIMEOUT_MS = 15_000;

export function fetchInitiativeSense(
  endpoint: string = DEFAULT_ENDPOINT,
): Promise<InitiativeSenseResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(endpoint, { signal: ctrl.signal, cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`sense endpoint HTTP ${res.status}`);
      return (await res.json()) as InitiativeSenseResponse;
    })
    .finally(() => clearTimeout(timer));
}

export function startInitiativeSensor(opts?: {
  endpoint?: string;
  intervalMs?: number;
  onError?: (err: unknown) => void;
}): InitiativeSensorHandle {
  const endpoint = opts?.endpoint ?? DEFAULT_ENDPOINT;
  const intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const engine = getCortexProactiveInitiative();
  let stopped = false;
  let inFlight = false;

  const poll = async (): Promise<void> => {
    if (stopped || inFlight) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    inFlight = true;
    try {
      const res = await fetchInitiativeSense(endpoint);
      if (!stopped && res?.ok && res.snapshot) {
        const snap = res.snapshot as InitiativeSensorOptions & Record<string, unknown>;
        // Merge client-side somatic samples (voice/manual logs) when the
        // server-side wearable channel has nothing fresh.
        const local = getCortexSomatic().state();
        if (local.fresh) {
          if (snap.hrvDeltaPct === undefined && local.hrvDeltaPct !== undefined) snap.hrvDeltaPct = local.hrvDeltaPct;
          if (snap.consecutiveLateNights === undefined) snap.consecutiveLateNights = local.consecutiveLateNights;
          if (snap.somaticStressScore === undefined) snap.somaticStressScore = local.stressScore;
          if (snap.sleepDebtHours === undefined) snap.sleepDebtHours = local.sleepDebtHours;
        }
        await engine.evaluateInitiatives(snap);
        // Pick up proposals an agent approved server-side while we were away.
        await engine.pickupApprovedProposals();
        // Weekly goal-drift review rides the same cadence (internally gated to 7d).
        const commits7d = Number(snap.commitsLast7d ?? snap.commits_last_7d ?? 0);
        getCortexGoals().reviewGoals({ commits_per_week: commits7d });
      }
    } catch (err) {
      if (!stopped) opts?.onError?.(err);
    } finally {
      inFlight = false;
    }
  };

  const timer = setInterval(() => { void poll(); }, intervalMs);
  void poll();

  return {
    poll,
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}
