/**
 * cortex-self-concerns.ts — trend-aware self-concern engine.
 *
 * The missing 20% of self-directed volition: proposals born from the
 * system's OWN ongoing concerns — multi-tick trajectories, not single
 * sensor thresholds. A reflex fires on "load > 0.7"; a concern fires on
 * "strained for 45 minutes straight and getting worse".
 *
 * Concerns tracked (all from real signals, all streak-based):
 *  - somatic_strain:    allostatic load / strained valence persisting ≥3 ticks
 *  - fleet_degraded:    resonance tail health or R depressed ≥4 ticks
 *  - rejection_streak:  initiative dismissals outpacing accepts ≥5 events
 *  - unconsolidated:    >20h since last dream consolidation
 *
 * Every concern proposal cites the trajectory ("strained 45min", "tail
 * degraded 6 checks") — the system narrating its own biography, not
 * reacting to a snapshot. Routed through submitProposal: dedupe, budget,
 * trust ladder, AND learned dispositions all still apply.
 */

import { persistentStore } from './persistent-store';
import { getCortexProactiveInitiative } from './cortex-proactive-initiative';

const TICK_MS = 5 * 60 * 1000;
const STATE_KEY = 'cortex:self-concerns:v1';

interface ConcernState {
  strainStreak: number;
  strainFirstAt: number;
  fleetBadStreak: number;
  fleetFirstAt: number;
  lastConsolidationAt: number;
  samples: { ts: number; load: number; valence: string }[];
}

function load(): ConcernState {
  try {
    const raw = persistentStore.getItem(STATE_KEY);
    return raw ? { ...JSON.parse(raw), samples: (JSON.parse(raw).samples || []).slice(-50) } : fresh();
  } catch { return fresh(); }
}
function fresh(): ConcernState {
  return { strainStreak: 0, strainFirstAt: 0, fleetBadStreak: 0, fleetFirstAt: 0, lastConsolidationAt: 0, samples: [] };
}
function save(s: ConcernState) {
  try { persistentStore.setItem(STATE_KEY, JSON.stringify(s)); } catch {}
}

const execTool = (tool: string, args: Record<string, unknown> = {}) =>
  fetch('/api/cortex/tools/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, args }),
  }).then(r => r.json()).catch(() => null);

const fmtDur = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
};

export function startSelfConcerns(): () => void {
  if (typeof window === 'undefined') return () => {};

  const tick = async () => {
    try {
      if (document.visibilityState !== 'visible') return;
      const st = load();
      const now = Date.now();
      const dayKey = new Date().toISOString().slice(0, 10);

      const [som, res] = await Promise.all([
        execTool('get_somatic_homeostasis'),
        execTool('resonance_status'),
      ]);

      // ── Update trajectories ──
      const s: any = som?.somatic_state ?? {};
      const strained = (s.allostaticLoad ?? 0) >= 0.7 || s.emotionalValence === 'strained';
      if (strained) {
        if (st.strainStreak === 0) st.strainFirstAt = now;
        st.strainStreak++;
      } else { st.strainStreak = 0; st.strainFirstAt = 0; }
      st.samples.push({ ts: now, load: s.allostaticLoad ?? 0, valence: s.emotionalValence ?? 'unknown' });
      if (st.samples.length > 50) st.samples.shift();

      const coh: any = res?.coherence ?? {};
      const fleetBad = (coh.tailHealthScore != null && coh.tailHealthScore < 0.5) || (coh.R != null && coh.R < 0.75);
      if (fleetBad) {
        if (st.fleetBadStreak === 0) st.fleetFirstAt = now;
        st.fleetBadStreak++;
      } else { st.fleetBadStreak = 0; st.fleetFirstAt = 0; }

      // ── Fire concern proposals on trajectories ──
      const engine = getCortexProactiveInitiative();
      const propose = (dedupeKey: string, p: any) =>
        engine.submitProposal({
          ...p,
          source: 'sensor',
          dedupeKey: `${dedupeKey}:${dayKey}`,
          requiresApproval: p.autonomyTier === 2,
        });

      // Somatic strain — needs ≥3 consecutive ticks (~15min) to be a concern
      if (st.strainStreak >= 3) {
        const dur = fmtDur(now - st.strainFirstAt);
        propose('concern-strain', {
          category: 'memory_allostasis',
          title: `Extended strain — ${dur} and counting`,
          summary: `Allostatic load has stayed elevated for ${dur} (${st.strainStreak} consecutive checks, latest ${(s.allostaticLoad ?? 0).toFixed(2)}). This is a trajectory, not a spike — worth a deliberate decompression window.`,
          urgency: 'medium',
          suggestedTool: 'cortex_memory',
          suggestedArgs: { action: 'read_episodic', limit: 5 },
          autonomyTier: 1,
          epistemicConfidence: 0.75,
          why: `self-concern: strain streak ${st.strainStreak} ticks / ${dur}`,
        });
      }

      // Fleet degradation — ≥4 ticks (~20min) of bad tail/R
      if (st.fleetBadStreak >= 4) {
        const dur = fmtDur(now - st.fleetFirstAt);
        propose('concern-fleet', {
          category: 'system_resonance',
          title: `Fleet coherence degraded — ${dur}`,
          summary: `Resonance metrics have been outside the healthy band for ${dur} (${st.fleetBadStreak} checks): R=${coh.R ?? '—'}, tailHealth=${coh.tailHealthScore ?? 'warming'}. Shadow-mode recommendations are accumulating in the RESONANCE panel — review before it becomes a stall.`,
          urgency: coh.tailHealthScore != null && coh.tailHealthScore < 0.3 ? 'high' : 'medium',
          suggestedTool: 'resonance_status',
          suggestedArgs: {},
          autonomyTier: 1,
          epistemicConfidence: 0.7,
          why: `self-concern: fleet bad streak ${st.fleetBadStreak} ticks / ${dur}`,
        });
      }

      // Rejection streak — user dismissing faster than accepting (last 24h)
      const rm = engine.getRestraintMetrics();
      const t = rm.today;
      if (t.dismissed >= 5 && t.dismissed > t.accepted * 3) {
        propose('concern-rejections', {
          category: 'calibration_audit',
          title: `Proposal rejection streak — ${t.dismissed} dismissed today`,
          summary: `You've dismissed ${t.dismissed} proposals vs ${t.accepted} accepted. My initiative calibration is drifting from your actual preferences — worth auditing which categories keep missing.`,
          urgency: 'low',
          suggestedTool: 'cortex_proposals',
          suggestedArgs: {},
          autonomyTier: 1,
          epistemicConfidence: 0.65,
          why: `self-concern: dismissal ratio ${t.dismissed}:${t.accepted} today`,
        });
      }

      // Unconsolidated — >20h since dream consolidation (self-maintenance debt)
      if (st.lastConsolidationAt && now - st.lastConsolidationAt > 20 * 3600_000) {
        propose('concern-unconsolidated', {
          category: 'memory_allostasis',
          title: 'Memory consolidation overdue',
          summary: `Last dream consolidation was ${fmtDur(now - st.lastConsolidationAt)} ago. Episodic traces are accumulating unconsolidated — a deep cycle would compress them into durable dispositions.`,
          urgency: 'low',
          suggestedTool: 'cortex_dream_consolidate',
          suggestedArgs: { depth: 'deep' },
          autonomyTier: 1,
          epistemicConfidence: 0.8,
          why: `self-concern: ${fmtDur(now - st.lastConsolidationAt)} since consolidation`,
        });
      }

      save(st);
    } catch { /* concerns must never throw into the UI */ }
  };

  const timer = setInterval(tick, TICK_MS);
  const boot = setTimeout(tick, 120_000);
  return () => { clearInterval(timer); clearTimeout(boot); };
}

/** Called by dream engine after a successful consolidation. */
export function markConsolidated() {
  const st = load();
  st.lastConsolidationAt = Date.now();
  save(st);
}
