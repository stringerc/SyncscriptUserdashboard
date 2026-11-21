/**
 * cortex-dream-engine.ts — consolidation that ALTERS future behavior.
 *
 * The old cortex_dream_consolidate wrote a hardcoded template report —
 * fake consolidation. This engine does the real thing, client-side where
 * the state lives:
 *
 *   1. consolidateDispositions() — decay/prune learned adjustments
 *   2. Read restraint metrics + dispositions + resonance snapshot
 *   3. Write a REAL report note into the vault (cortex_memory)
 *   4. markConsolidated() — resets the unconsolidated concern clock
 *
 * The behavior alteration is structural: dispositions learned from YOUR
 * accept/dismiss/executed outcomes feed back into submitProposal —
 * categories you reject get softened, proven ones earn autonomy. Sleep
 * doesn't just store memories; it rewrites tomorrow's priorities.
 */

import { persistentStore } from './persistent-store';
import { getCortexProactiveInitiative } from './cortex-proactive-initiative';
import { getAllDispositions, consolidateDispositions } from './cortex-dispositions';
import { markConsolidated } from './cortex-self-concerns';

const LAST_RUN_KEY = 'cortex:dream:last-run:v1';

const execTool = (tool: string, args: Record<string, unknown> = {}) =>
  fetch('/api/cortex/tools/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, args }),
  }).then(r => r.json()).catch(() => null);

export interface DreamResult {
  ok: boolean;
  reportPath?: string;
  dispositionsPruned: number;
  dispositionsRetained: number;
  topLearned: { category: string; score: number; note?: string }[];
  restraintToday: { proposed: number; admitted: number; dismissed: number; accepted: number; autoExecuted: number };
  durationMs: number;
}

export async function runDreamConsolidation(depth: 'quick' | 'deep' = 'deep'): Promise<DreamResult> {
  const t0 = Date.now();
  const result: DreamResult = {
    ok: false, dispositionsPruned: 0, dispositionsRetained: 0,
    topLearned: [], restraintToday: { proposed: 0, admitted: 0, dismissed: 0, accepted: 0, autoExecuted: 0 },
    durationMs: 0,
  };

  try {
    // 1. Consolidate dispositions — decay, prune, refresh learned hints
    const cons = consolidateDispositions();
    result.dispositionsPruned = cons.pruned;
    result.dispositionsRetained = cons.retained;
    result.topLearned = cons.topLearned.map(d => ({ category: d.category, score: d.score, note: d.note }));

    // 2. Gather real state
    const rm = getCortexProactiveInitiative().getRestraintMetrics();
    const t = rm.today;
    result.restraintToday = {
      proposed: t.proposed, admitted: t.admitted, dismissed: t.dismissed,
      accepted: t.accepted, autoExecuted: t.autoExecuted ?? 0,
    };

    const proposals = getCortexProactiveInitiative().getActiveProposals();
    const pendingCount = proposals.filter(p => p.status === 'pending').length;

    let resonanceLine = 'unavailable';
    try {
      const res = await execTool('resonance_status');
      const c = res?.coherence;
      if (c) resonanceLine = `R=${c.R} entropy=${c.spectralEntropy}(${c.entropyState}) tail=${c.tailHealthScore ?? 'warming'} K=${c.couplingK} nodes=${res?.fleet?.up}/${res?.fleet?.total}`;
    } catch {}

    // 3. Write the real report into the vault
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const learnedLines = result.topLearned.length
      ? result.topLearned.map(d => `- **${d.category}** (score ${d.score}): ${d.note || 'adjusting priority'}`).join('\n')
      : '- No learned dispositions yet — need ≥3 outcomes per category before behavior shifts.';

    const report = `# Dream Consolidation — ${dateStr} ${now.toTimeString().slice(0, 5)}
**Depth:** ${depth} | **Pending proposals:** ${pendingCount}

## Restraint ledger (today)
proposed=${result.restraintToday.proposed} admitted=${result.restraintToday.admitted} accepted=${result.restraintToday.accepted} (auto=${result.restraintToday.autoExecuted}) dismissed=${result.restraintToday.dismissed}

## Fleet state
${resonanceLine}

## Dispositions consolidated
pruned=${result.dispositionsPruned} retained=${result.dispositionsRetained}
${learnedLines}

## What changed behaviorally
Dispositions with sufficient evidence now bias submitProposal: rejected categories get softened urgency + forced approval; proven categories earn autonomy. This report IS the consolidation — the adjustments above are live in the next proposal cycle.`;

    const note = await execTool('cortex_memory', {
      action: 'vault_write_note',
      filename: `Dream Consolidation ${dateStr}`,
      folder: '03 - Learnings',
      content: report,
      tags: 'dream,consolidation,reflexive',
    });
    result.reportPath = note?.path || note?.result?.path || undefined;

    // 4. Close the loop
    markConsolidated();
    persistentStore.setItem(LAST_RUN_KEY, JSON.stringify({ at: Date.now(), depth, ...result }));
    result.ok = true;
  } catch (e: any) {
    result.ok = false;
  }
  result.durationMs = Date.now() - t0;
  return result;
}

export function getLastDreamRun(): any {
  try { return JSON.parse(persistentStore.getItem(LAST_RUN_KEY) || 'null'); } catch { return null; }
}
