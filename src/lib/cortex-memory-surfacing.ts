/**
 * cortex-memory-surfacing.ts — temporal-memory × affect × restraint fusion.
 *
 * The missing loop: memory only appeared when asked. This sensor periodically
 * checks whether the user's current state (somatic strain, fleet coherence)
 * makes a past memory *worth surfacing unprompted* — then files it as a
 * ProactiveProposal through CortexProactiveInitiativeEngine.submitProposal,
 * which applies the same dedupe + daily-budget + trust-ladder rules as every
 * other initiative. Restraint decides; this module only senses and proposes.
 *
 * Design contract:
 *  - Runs only while the tab is visible; 5-minute cadence.
 *  - Surfaces at most when strain is real (allostaticLoad ≥ 0.7 or valence
 *    'strained') AND a relevant episodic memory actually exists.
 *  - Dedupe key is per-memory-per-day — the same memory can surface once/day.
 *  - Never executes anything itself; proposals go through the governed inbox.
 */

import { getCortexProactiveInitiative } from './cortex-proactive-initiative';

const TICK_MS = 5 * 60 * 1000;
const STRAIN_LOAD = 0.7;
const MAX_SURFACES_PER_DAY = 3;

const execTool = (tool: string, args: Record<string, unknown>) =>
  fetch('/api/cortex/tools/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, args }),
  }).then(r => r.json()).catch(() => null);

interface Somatic { allostaticLoad?: number; emotionalValence?: string }

async function sense(): Promise<{ strained: boolean; memory: string | null }> {
  const [som, mem] = await Promise.all([
    execTool('get_somatic_homeostasis', {}),
    execTool('cortex_memory', { action: 'recall', query: 'stress energy mood recent struggle', limit: 3 }),
  ]);

  const s: Somatic = som?.somatic_state ?? {};
  const strained = (s.allostaticLoad ?? 0) >= STRAIN_LOAD || s.emotionalValence === 'strained';

  // Pull the top memory snippet — recall returns { result: { results: [...] } }
  const results = mem?.result?.results ?? mem?.results ?? [];
  const top = Array.isArray(results) ? results[0] : null;
  const snippet = top ? String(top.snippet || top.content || '').replace(/\s+/g, ' ').slice(0, 240) : null;
  const memKey = top ? String(top.id || top.path || top.title || snippet!.slice(0, 40)) : null;

  return { strained, memory: snippet && memKey ? `${memKey}::${snippet}` : null };
}

export function startMemorySurfacing(): () => void {
  if (typeof window === 'undefined') return () => {};

  let surfacesToday = 0;
  let dayKey = new Date().toISOString().slice(0, 10);

  const tick = async () => {
    try {
      if (document.visibilityState !== 'visible') return;
      const today = new Date().toISOString().slice(0, 10);
      if (today !== dayKey) { dayKey = today; surfacesToday = 0; }
      if (surfacesToday >= MAX_SURFACES_PER_DAY) return;

      const { strained, memory } = await sense();
      if (!strained || !memory) return;

      const [memKey, snippet] = memory.split('::');
      const proposal = getCortexProactiveInitiative().submitProposal({
        category: 'memory_allostasis',
        title: `Surfacing a relevant memory — you seem stretched`,
        summary: `Current allostatic state is strained. A past memory may be relevant: "${snippet}"`,
        urgency: 'low',
        suggestedTool: 'cortex_memory',
        suggestedArgs: { action: 'recall', query: snippet.slice(0, 120), limit: 3 },
        requiresApproval: false,
        autonomyTier: 1,
        epistemicConfidence: 0.6,
        source: 'sensor',
        dedupeKey: `memsurf:${dayKey}:${memKey}`,
        why: `somatic strain detected + episodic match found — temporal memory surfacing (fusion loop)`,
      });

      if (proposal) surfacesToday++;
    } catch { /* sensor must never throw into the UI */ }
  };

  const timer = setInterval(tick, TICK_MS);
  // First pass shortly after boot so a stressed session surfaces early
  const boot = setTimeout(tick, 90_000);
  return () => { clearInterval(timer); clearTimeout(boot); };
}
