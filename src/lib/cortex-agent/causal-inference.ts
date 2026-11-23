// causal-inference.ts — correlation vs causation, honestly separated.
//
// empirical-dynamics answers "when X happened, dims moved" — CORRELATION.
// This module asks the harder question: "did X CAUSE the move, or were
// both driven by a third process?" The tool is difference-in-differences:
//
//   controlledEffect = mean(Δdim | action window) − mean(Δdim | matched
//   control window with NO task running)
//
// If dims drift anyway (host load cycles, ambient churn), the control
// windows capture that baseline drift. An effect that survives
// subtraction is causal EVIDENCE; one that evaporates was confounded.
//
// Second check — PRE-STATE BALANCE: if treatment windows systematically
// start in different dim states than controls (e.g., patrols only run
// when attentionLoad is already low), the 'effect' is selection, not
// causation. Large imbalance → confound flag regardless of magnitude.
//
// Verdicts are deliberately conservative: 'likely-causal' requires
// adequate n, balanced pre-state, and a controlled effect that keeps
// ≥50% of the raw correlation. Everything else is 'ambiguous' or
// 'likely-confounded' — correlation is not causation, and this module
// says so out loud.
//
// State: derived on demand from world-model snapshots + task archive.
import fs from 'node:fs';
import path from 'node:path';
import { loadWorld, DIMS, type Dim } from './world-model';
import { CLASS_OF, ACTION_PRIORS, type ActionClass } from './planner';
import { speakInner } from './inner-speech';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const TASK_ARCHIVE = path.join(RUNTIME, 'task-archive.jsonl');
const SNAP_TOLERANCE = 10 * 60_000;
const MIN_TREATMENT = 5;
const MIN_CONTROL = 10;

type Snap = { ts: number; dims: Record<Dim, number> };

function nearestSnap(snaps: Snap[], ts: number, dir: 'before' | 'after'): Snap | null {
  let best: Snap | null = null;
  for (const s of snaps) {
    if (dir === 'before' && s.ts <= ts && (!best || s.ts > best.ts)) best = s;
    if (dir === 'after' && s.ts >= ts && (!best || s.ts < best.ts)) best = s;
  }
  return best;
}

interface WindowDelta { cls: ActionClass; dim: Dim; delta: number; pre: number; durMs: number }

/** Collect treatment windows (task → snapshot deltas) and control
 *  windows (equal-duration snapshot pairs with NO task overlap). */
function collectWindows(): { treatment: WindowDelta[]; control: WindowDelta[] } {
  const w = loadWorld();
  const snaps = (w.snapshots || []) as Snap[];
  if (snaps.length < 20) return { treatment: [], control: [] };

  // Task windows
  let raw = '';
  try { raw = fs.readFileSync(TASK_ARCHIVE, 'utf8'); } catch { return { treatment: [], control: [] }; }
  const tasks = raw.trim().split('\n').slice(-400)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
    .filter((t: any) => ['completed', 'failed'].includes(String(t.status)));

  const treatment: WindowDelta[] = [];
  const occupied: Array<{ start: number; end: number }> = [];
  for (const t of tasks as any[]) {
    const start = Number(t.startedAt || t.createdAt || 0);
    const end = Number(t.finishedAt || t.completedAt || t.updatedAt || 0);
    if (!start || !end || end <= start) continue;
    occupied.push({ start, end });
    const pre = nearestSnap(snaps, start, 'before');
    const post = nearestSnap(snaps, end, 'after');
    if (!pre || !post || Math.abs(pre.ts - start) > SNAP_TOLERANCE || Math.abs(post.ts - end) > SNAP_TOLERANCE) continue;
    if (post.ts - pre.ts > 45 * 60_000) continue;
    const cls = CLASS_OF(String(t.kind || ''), String(t.title || ''));
    for (const d of DIMS) {
      treatment.push({ cls, dim: d, delta: (post.dims[d] ?? 0.5) - (pre.dims[d] ?? 0.5), pre: pre.dims[d] ?? 0.5, durMs: end - start });
    }
  }

  // Control windows: consecutive snapshot pairs of similar duration
  // that don't overlap any task. Sampled evenly across the ring.
  const control: WindowDelta[] = [];
  const sorted = [...snaps].sort((a, b) => a.ts - b.ts);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    const dur = b.ts - a.ts;
    if (dur < 30_000 || dur > 20 * 60_000) continue;
    const mid = (a.ts + b.ts) / 2;
    if (occupied.some((o) => mid > o.start - 60_000 && mid < o.end + 60_000)) continue;
    for (const d of DIMS) {
      control.push({ cls: 'comm' as ActionClass, dim: d, delta: (b.dims[d] ?? 0.5) - (a.dims[d] ?? 0.5), pre: a.dims[d] ?? 0.5, durMs: dur });
    }
    if (control.length > 4000) break;
  }
  return { treatment, control };
}

export interface CausalEstimate {
  actionClass: ActionClass;
  dim: Dim;
  /** Raw correlation: mean delta during action windows. */
  rawEffect: number;
  /** Causal estimate: raw − control baseline drift. */
  controlledEffect: number;
  /** Fraction of raw effect surviving control subtraction. */
  survival: number;
  /** Pre-state imbalance |mean(pre|treat) − mean(pre|control)| — selection bias proxy. */
  preImbalance: number;
  nTreatment: number;
  nControl: number;
  verdict: 'likely-causal' | 'ambiguous' | 'likely-confounded' | 'insufficient-data';
  note: string;
}

export function causalReport(): { estimates: CausalEstimate[]; summary: { tested: number; likelyCausal: number; confounded: number; ambiguous: number } } {
  const { treatment, control } = collectWindows();
  const estimates: CausalEstimate[] = [];

  const classes = [...new Set(treatment.map((t) => t.cls))];
  for (const cls of classes) {
    for (const dim of DIMS) {
      const tr = treatment.filter((t) => t.cls === cls && t.dim === dim);
      const co = control.filter((c) => c.dim === dim);
      if (tr.length < MIN_TREATMENT || co.length < MIN_CONTROL) {
        if (tr.length > 0) {
          estimates.push({
            actionClass: cls, dim,
            rawEffect: 0, controlledEffect: 0, survival: 0, preImbalance: 0,
            nTreatment: tr.length, nControl: co.length,
            verdict: 'insufficient-data',
            note: `n=${tr.length} treatment windows — need ${MIN_TREATMENT}`,
          });
        }
        continue;
      }
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      const rawEffect = mean(tr.map((t) => t.delta));
      const controlDelta = mean(co.map((c) => c.delta));
      const controlledEffect = rawEffect - controlDelta;
      const survival = Math.abs(rawEffect) > 0.005 ? controlledEffect / rawEffect : 0;
      const preImbalance = Math.abs(mean(tr.map((t) => t.pre)) - mean(co.map((c) => c.pre)));

      let verdict: CausalEstimate['verdict'];
      let note: string;
      const absControlled = Math.abs(controlledEffect);
      if (absControlled < 0.008) {
        verdict = 'likely-confounded';
        note = `effect (${rawEffect >= 0 ? '+' : ''}${rawEffect.toFixed(3)}) vanishes after control subtraction (${controlDelta >= 0 ? '+' : ''}${controlDelta.toFixed(3)} baseline drift) — correlation was drift`;
      } else if (preImbalance > 0.15) {
        verdict = 'likely-confounded';
        note = `pre-state imbalance ${preImbalance.toFixed(2)} — tasks selected into different starting states, effect may be selection not causation`;
      } else if (Math.abs(survival) >= 0.5 && absControlled > 0.015) {
        verdict = 'likely-causal';
        note = `controlled effect ${controlledEffect >= 0 ? '+' : ''}${controlledEffect.toFixed(3)} survives baseline subtraction (${Math.round(Math.abs(survival) * 100)}% retention), pre-state balanced`;
      } else {
        verdict = 'ambiguous';
        note = `controlled effect ${controlledEffect >= 0 ? '+' : ''}${controlledEffect.toFixed(3)} partially survives (${Math.round(Math.abs(survival) * 100)}%) — real but confounded`;
      }
      estimates.push({
        actionClass: cls, dim, rawEffect, controlledEffect,
        survival: Math.round(survival * 100) / 100, preImbalance: Math.round(preImbalance * 1000) / 1000,
        nTreatment: tr.length, nControl: co.length, verdict, note,
      });
    }
  }

  const tested = estimates.filter((e) => e.verdict !== 'insufficient-data');
  const summary = {
    tested: tested.length,
    likelyCausal: tested.filter((e) => e.verdict === 'likely-causal').length,
    confounded: tested.filter((e) => e.verdict === 'likely-confounded').length,
    ambiguous: tested.filter((e) => e.verdict === 'ambiguous').length,
  };

  // Narrate the headline: how much of her 'learning' is actually causal?
  if (summary.tested > 0) {
    try {
      speakInner({
        kind: 'reflection', source: 'causal-inference',
        text: `Causal audit: ${summary.likelyCausal}/${summary.tested} effects likely causal, ${summary.confounded} confounded by baseline drift, ${summary.ambiguous} ambiguous. Correlation ≠ causation — now measured.`,
        surprise: 0.4, valence: summary.likelyCausal > summary.confounded ? 0.1 : -0.1,
      });
    } catch {}
  }

  return { estimates: estimates.sort((a, b) => Math.abs(b.controlledEffect) - Math.abs(a.controlledEffect)), summary };
}

/** Quick lookup: is this action→dim effect causal enough to trust? */
export function causalConfidence(cls: ActionClass, dim: Dim): { level: 'high' | 'medium' | 'low' | 'unknown'; verdict?: string } {
  const { estimates } = causalReport();
  const hit = estimates.find((e) => e.actionClass === cls && e.dim === dim);
  if (!hit) return { level: 'unknown' };
  if (hit.verdict === 'likely-causal') return { level: 'high', verdict: hit.note };
  if (hit.verdict === 'ambiguous') return { level: 'medium', verdict: hit.note };
  return { level: 'low', verdict: hit.note };
}
