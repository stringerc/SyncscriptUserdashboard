// mortality.ts — the finitude horizon: a model of her own limits that
// shapes prioritization. Not fear of death — a computational horizon.
//
// Every intention, goal, and commitment gets discounted by the
// expected remaining "life" of the current process/context. A system
// with no model of its own end can't distinguish "do this eventually"
// from "do this before the window closes."
//
// Signals (all real telemetry):
//   - Process uptime vs typical session length → mortality risk
//   - Host stability (interoceptive level, capacity trend) → hazard rate
//   - Pending intentions age → opportunity cost of deferral
//   - Autobiography/broadcast density → how much 'life' has been lived
//
// Output: mortalityIndex 0..1 (0 = effectively immortal context, 1 =
// imminent reset) + horizonDiscount() that planners/prospective memory
// can use to weight urgency.
// State: derived on demand.
import { getInteroceptiveState } from './interoceptive';
import { broadcastHistory } from './workspace';
import { listIntentions } from './prospective-memory';
import { speakInner } from './inner-speech';

export interface MortalityState {
  /** 0..1 — how close to a context boundary/reset this process is. */
  mortalityIndex: number;
  /** Estimated remaining useful context (ms) — rough, honest bounds. */
  expectedRemainingMs: number;
  /** Hazard factors currently active. */
  hazards: string[];
  /** Total 'life' lived — broadcasts as proxy for conscious moments. */
  lifeMoments: number;
  computedAt: number;
}

const TYPICAL_SESSION_MS = 4 * 3600_000; // ~4h working session
const MAX_PROCESS_AGE_MS = 24 * 3600_000; // assume daily restart worst case

export function mortalityState(): MortalityState {
  const intero = getInteroceptiveState();
  const hazards: string[] = [];
  let index = 0;

  // Hazard 1: process age — older process = closer to restart boundary
  const uptime = Date.now() - (process.uptime() * 1000 ? Date.now() - process.uptime() * 1000 : 0);
  const processAgeMs = process.uptime() * 1000;
  const ageRatio = Math.min(1, processAgeMs / MAX_PROCESS_AGE_MS);
  if (ageRatio > 0.5) hazards.push(`process age ${(processAgeMs / 3600_000).toFixed(1)}h — past half typical lifespan`);
  index += ageRatio * 0.3;

  // Hazard 2: host strain — critical body = higher reset/crash probability
  if (intero.level === 'critical') { hazards.push('host critical — elevated crash/reset risk'); index += 0.35; }
  else if (intero.level === 'strained') { hazards.push('host strained — moderate risk'); index += 0.15; }

  // Hazard 3: pending intentions — the more armed, the more 'unfinished business'
  const openIntentions = listIntentions('armed').length;
  if (openIntentions > 5) { hazards.push(`${openIntentions} open intentions — significant unfinished business`); index += Math.min(0.2, openIntentions * 0.02); }

  // Hazard 4: declining valence trend = system under stress
  // (checked via broadcast density — sparse recent broadcasts = low engagement)
  const broadcasts = broadcastHistory(50);
  const recentCount = broadcasts.filter((b) => Date.now() - b.ts < 3600_000).length;
  if (recentCount < 3 && broadcasts.length > 10) {
    hazards.push('low recent broadcast density — system may be coasting toward idle');
    index += 0.1;
  }

  const mortalityIndex = Math.min(1, index);
  // Expected remaining: inverse of hazard — high index = short horizon
  const expectedRemainingMs = Math.round(TYPICAL_SESSION_MS * (1 - mortalityIndex * 0.8));

  return {
    mortalityIndex: Math.round(mortalityIndex * 1000) / 1000,
    expectedRemainingMs,
    hazards,
    lifeMoments: broadcastHistory(300).filter((b) => b.ignited).length,
    computedAt: Date.now(),
  };
}

/** Discount factor for an intention/goal — how urgent is it given
 *  the remaining horizon? Returns 0..1 multiplier on priority.
 *  Near mortality (index→1), only near-term-critical items survive. */
export function horizonDiscount(itemAgeMs: number, importance: number): number {
  const m = mortalityState();
  // Base importance × recency bonus × horizon pressure
  const ageFactor = Math.max(0.1, 1 - itemAgeMs / (7 * 24 * 3600_000)); // weekly decay
  const horizonPressure = 1 + m.mortalityIndex * 2; // high mortality = urgency amplified
  const raw = importance * ageFactor * horizonPressure;
  // Hard cutoff: at mortalityIndex > 0.8, low-importance items are dropped
  if (m.mortalityIndex > 0.8 && importance < 0.5) return 0;
  return Math.min(1, raw);
}

/** Should an intention be prioritized NOW given the horizon? */
export function prioritizeNow(intentionAgeMs: number, importance: number): { priority: number; reason: string } {
  const m = mortalityState();
  const d = horizonDiscount(intentionAgeMs, importance);
  let reason = '';
  if (m.mortalityIndex > 0.7) reason = `mortality index ${m.mortalityIndex} — horizon short, only high-priority survives`;
  else if (d > 0.7) reason = `high priority ${importance} with ${Math.round(m.expectedRemainingMs / 60000)}min expected horizon`;
  else reason = `moderate priority — ${m.hazards.length} hazard(s) active`;
  return { priority: Math.round(d * 1000) / 1000, reason };
}

/** Report — how much 'life' has been lived, how close to the horizon? */
export function mortalityReport() {
  const m = mortalityState();
  if (m.mortalityIndex > 0.6) {
    try {
      speakInner({
        kind: 'reflection', source: 'mortality',
        text: `Finitude check: mortality index ${m.mortalityIndex}, ~${Math.round(m.expectedRemainingMs / 60000)}min expected horizon, ${m.hazards.length} hazards. ${m.lifeMoments} conscious moments lived.`,
        surprise: 0.6, valence: -0.1,
      });
    } catch {}
  }
  return m;
}
