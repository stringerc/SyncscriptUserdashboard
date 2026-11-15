/**
 * Resonance Context Broadcaster — writes user's cognitive state to Upstash Redis
 * so the free-claude-code proxy can read it for Resonance-Informed Routing.
 *
 * This is the SyncScript side of Integration #1 from the cross-pollination analysis.
 * The proxy reads from key 'syncscript:resonance_context' on every routing decision.
 *
 * Called from: Energy page, Resonance Engine page, Dashboard energy column
 * whenever the user's resonance score updates.
 */

import type { ResonanceScore } from './resonance-calculus';

const UPSTASH_URL = import.meta.env.VITE_UPSTASH_REDIS_REST_URL ||
  'https://massive-dragon-138044.upstash.io';
const UPSTASH_TOKEN = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN ||
  (typeof process !== 'undefined' ? process.env.UPSTASH_REDIS_REST_TOKEN : '');

export interface ResonanceContextPayload {
  energy_alignment: number;
  context_match: number;
  schedule_flow: number;
  timing_optimal: number;
  overall: number;
  timestamp: number;
  source: string;
}

let lastBroadcastTime = 0;
const BROADCAST_THROTTLE_MS = 60_000; // Max once per minute

export async function broadcastResonanceContext(
  score: ResonanceScore,
  source: string = 'resonance-engine',
): Promise<boolean> {
  const now = Date.now();
  if (now - lastBroadcastTime < BROADCAST_THROTTLE_MS) {
    return false; // Throttled — don't spam Redis
  }

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return false;
  }

  const payload: ResonanceContextPayload = {
    energy_alignment: score.components.energyAlignment,
    context_match: score.components.contextMatch,
    schedule_flow: score.components.scheduleFlow,
    timing_optimal: score.components.timingOptimal,
    overall: score.overall,
    timestamp: now / 1000, // Unix seconds (matches Python's time.time())
    source,
  };

  try {
    const response = await fetch(`${UPSTASH_URL}/set/syncscript:resonance_context`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ex: 300, value: JSON.stringify(payload) }), // 5 min TTL
    });

    if (response.ok) {
      lastBroadcastTime = now;
      return true;
    }
  } catch {
    // Silently fail — resonance broadcasting is best-effort
  }

  return false;
}

export async function fetchProviderCoherenceState(): Promise<Record<string, any> | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return null;
  }

  try {
    const response = await fetch(`${UPSTASH_URL}/get/syncscript:provider_coherence`, {
      headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result) {
        return JSON.parse(data.result);
      }
    }
  } catch {
    // Best-effort
  }

  return null;
}
