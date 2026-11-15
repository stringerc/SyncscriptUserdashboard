/**
 * cortex-attention-firewall.ts — Attention firewall (Phase 5.2 spike).
 *
 * Scores every inbound item (email, notification, calendar invite, proposal)
 * against the user's active goals and vital-signal keywords, then decides
 * interrupt vs. suppress. Default-deny for non-vital interruptions — the
 * highest-trust-risk feature, so every decision carries a reason and all
 * outcomes are counted for before/after measurement.
 *
 * Kill criterion (spec 5.2): if suppressing non-vital interrupts causes
 * missed-vital regressions, the firewall ships advisory-only.
 */

import { persistentStore } from './persistent-store';
import { getCortexGoals } from './cortex-goals';

export interface InboundItem {
  source: string;              // 'email' | 'notification' | 'calendar' | 'initiative' | ...
  title?: string;
  body?: string;
  from?: string;
  /** Items the user has explicitly marked vital always interrupt. */
  vital?: boolean;
}

export interface FirewallVerdict {
  interrupt: boolean;
  score: number;               // 0..1 relevance/urgency
  reason: string;
  matchedGoal?: string;
}

interface FirewallStats {
  interrupted: number;
  suppressed: number;
  byDay: Record<string, { interrupted: number; suppressed: number }>;
}

const STORAGE_KEY = 'cortex:attention:v1';
const VITAL_RE =
  /\b(urgent|emergency|critical|deadline|court|legal|attorney|security|breach|fraud|payment failed|past due|server down|outage|asap|immediately|911|evacuation)\b/i;
const INTERRUPT_THRESHOLD = 0.45;

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadStats(): FirewallStats {
  try {
    const raw = persistentStore.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { interrupted: 0, suppressed: 0, byDay: {} };
}

export class CortexAttentionFirewall {
  private stats: FirewallStats = loadStats();

  /** Token-overlap relevance between item text and a goal title. */
  private goalRelevance(text: string, goalTitle: string): number {
    const stop = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'my', 'is', 'are']);
    const itemTokens = new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2 && !stop.has(t)));
    const goalTokens = goalTitle.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2 && !stop.has(t));
    if (goalTokens.length === 0 || itemTokens.size === 0) return 0;
    const hits = goalTokens.filter(t => itemTokens.has(t)).length;
    return hits / goalTokens.length;
  }

  public evaluate(item: InboundItem): FirewallVerdict {
    const text = `${item.title || ''} ${item.body || ''} ${item.from || ''}`;

    if (item.vital) {
      this.record(true);
      return { interrupt: true, score: 1, reason: 'marked vital by source' };
    }
    if (VITAL_RE.test(text)) {
      this.record(true);
      return { interrupt: true, score: 0.95, reason: 'vital keyword match' };
    }

    // Goal relevance: interrupt only when strongly tied to an active goal.
    const activeGoals = getCortexGoals().list('active');
    let best: { goal: string; rel: number } | null = null;
    for (const g of activeGoals) {
      const rel = this.goalRelevance(text, g.title);
      if (!best || rel > best.rel) best = { goal: g.title, rel };
    }
    if (best && best.rel >= 0.5) {
      const score = 0.5 + best.rel * 0.4;
      if (score >= INTERRUPT_THRESHOLD) {
        this.record(true);
        return { interrupt: true, score, reason: `aligned with goal "${best.goal}"`, matchedGoal: best.goal };
      }
      this.record(false);
      return { interrupt: false, score, reason: `weak goal alignment (${Math.round(best.rel * 100)}%) with "${best.goal}"`, matchedGoal: best.goal };
    }

    this.record(false);
    return { interrupt: false, score: best?.rel ?? 0, reason: 'no vital signal, no goal alignment — suppressed' };
  }

  private record(interrupted: boolean): void {
    if (interrupted) this.stats.interrupted++; else this.stats.suppressed++;
    const d = dayKey();
    const day = this.stats.byDay[d] ?? { interrupted: 0, suppressed: 0 };
    if (interrupted) day.interrupted++; else day.suppressed++;
    this.stats.byDay[d] = day;
    // Keep 30 days of daily stats.
    const keys = Object.keys(this.stats.byDay).sort();
    if (keys.length > 30) delete this.stats.byDay[keys[0]];
    try { persistentStore.setItem(STORAGE_KEY, JSON.stringify(this.stats)); } catch {}
  }

  public stats_(): { interrupted: number; suppressed: number; today: { interrupted: number; suppressed: number } } {
    return {
      interrupted: this.stats.interrupted,
      suppressed: this.stats.suppressed,
      today: this.stats.byDay[dayKey()] ?? { interrupted: 0, suppressed: 0 },
    };
  }
}

let globalFirewall: CortexAttentionFirewall | null = null;

export function getCortexAttentionFirewall(): CortexAttentionFirewall {
  if (!globalFirewall) globalFirewall = new CortexAttentionFirewall();
  return globalFirewall;
}
