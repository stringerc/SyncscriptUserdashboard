/**
 * cortex-dispositions.ts — learned behavior adjustments.
 *
 * This is the piece that makes consolidation ALTER future behavior instead of
 * storing notes. Every proposal outcome (accepted / executed / failed /
 * dismissed / snoozed) updates a per-category disposition score. Dispositions
 * feed back into submitProposal: categories the user keeps dismissing get
 * deprioritized and require approval; categories that keep succeeding get
 * more autonomy. Dream consolidation reviews and prunes them.
 *
 * A disposition is evidence-weighted, not a vibe: it needs ≥ MIN_EVENTS
 * observations before it influences anything, and it decays with time so
 * stale lessons fade.
 */

import { persistentStore } from './persistent-store';

const STORAGE_KEY = 'cortex:dispositions:v1';
const MIN_EVENTS = 3;
const DECAY_HALF_LIFE_DAYS = 14;

export interface Disposition {
  category: string;
  /** net score: +1 per accept/execute, -1 per dismiss, -0.5 per snooze, -2 per fail */
  score: number;
  events: number;
  lastEventAt: number;
  /** learned suggestion for submitProposal */
  learnedUrgency?: 'high' | 'medium' | 'low';
  learnedTier?: 0 | 1 | 2;
  note?: string;
}

interface Store { dispositions: Record<string, Disposition> }

function load(): Store {
  try {
    const raw = persistentStore.getItem(STORAGE_KEY);
    const s = raw ? JSON.parse(raw) : { dispositions: {} };
    return s?.dispositions ? s : { dispositions: {} };
  } catch { return { dispositions: {} }; }
}

function save(s: Store) {
  try { persistentStore.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

function decay(d: Disposition, now: number): Disposition {
  const days = (now - d.lastEventAt) / 86_400_000;
  if (days <= 0) return d;
  const factor = Math.pow(0.5, days / DECAY_HALF_LIFE_DAYS);
  return { ...d, score: +(d.score * factor).toFixed(3), events: Math.max(0, Math.round(d.events * factor)) };
}

/** Record a proposal outcome — call from accept/dismiss/snooze/execute/fail. */
export function recordOutcome(category: string, outcome: 'accepted' | 'executed' | 'failed' | 'dismissed' | 'snoozed'): void {
  const s = load();
  const now = Date.now();
  const key = category || 'unknown';
  const d = decay(s.dispositions[key] ?? { category: key, score: 0, events: 0, lastEventAt: now }, now);
  const delta = { accepted: 0.5, executed: 1, failed: -2, dismissed: -1, snoozed: -0.5 }[outcome];
  d.score = +(d.score + delta).toFixed(3);
  d.events += 1;
  d.lastEventAt = now;
  // Refresh learned suggestion from current score
  if (d.events >= MIN_EVENTS) {
    if (d.score <= -2) { d.learnedUrgency = 'low'; d.learnedTier = 2; d.note = 'user consistently rejects — deprioritize'; }
    else if (d.score <= -0.5) { d.learnedUrgency = 'low'; d.learnedTier = 1; d.note = 'user often dismisses — soften'; }
    else if (d.score >= 2) { d.learnedUrgency = 'medium'; d.learnedTier = 0; d.note = 'consistently valued — can self-execute'; }
  }
  s.dispositions[key] = d;
  save(s);
}

export interface DispositionAdjustment {
  urgency?: 'high' | 'medium' | 'low';
  tier?: 0 | 1 | 2;
  /** 0..1 — probability this category should be suppressed entirely */
  suppressBias: number;
  note?: string;
}

/** What submitProposal consults — returns null until enough evidence exists. */
export function getAdjustment(category: string): DispositionAdjustment | null {
  const s = load();
  const d = s.dispositions[category || 'unknown'];
  if (!d || d.events < MIN_EVENTS) return null;
  const live = decay(d, Date.now());
  const suppressBias = live.score <= -2 ? 0.7 : live.score <= -0.5 ? 0.3 : live.score >= 2 ? -0.2 : 0;
  return {
    urgency: live.learnedUrgency,
    tier: live.learnedTier,
    suppressBias,
    note: live.note,
  };
}

export function getAllDispositions(): Disposition[] {
  const s = load();
  const now = Date.now();
  return Object.values(s.dispositions)
    .map(d => decay(d, now))
    .filter(d => d.events >= 1)
    .sort((a, b) => b.events - a.events);
}

/** Dream consolidation hook — prune noise, return what changed. */
export function consolidateDispositions(): { pruned: number; retained: number; topLearned: Disposition[] } {
  const s = load();
  const now = Date.now();
  let pruned = 0;
  for (const k of Object.keys(s.dispositions)) {
    const live = decay(s.dispositions[k], now);
    if (live.events < 1 && Math.abs(live.score) < 0.1) { delete s.dispositions[k]; pruned++; }
    else s.dispositions[k] = live;
  }
  save(s);
  const all = getAllDispositions();
  return { pruned, retained: all.length, topLearned: all.slice(0, 5) };
}
