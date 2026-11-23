// generative-dream.ts — active offline world-model synthesis.
//
// consolidation.ts replays PAST episodes; this module GENERATES futures
// that never happened. It perturbs the world-model's latent dims into
// plausible-but-unseen states, then asks: do my beliefs survive contact
// with these synthetic scenarios? Where they break = where my model is
// weakest — dream-time stress-testing, no action taken.
//
// Method:
//   1. Sample current dims + Gaussian perturbation (σ from dynamics
//      uncertainty — uncertain dims get wilder dreams)
//   2. For each synthetic state, evaluate every learned action→dim
//      posterior: does the predicted effect still hold?
//   3. Where predictions diverge from learned posteriors → 'belief
//      fault lines' — scenarios my model can't handle
//   4. Persist fault lines as dream insights for the planner to respect
//
// Honest bound: synthetic scenarios are MODEL-GENERATED, not real
// experience — they stress-test internal consistency, not truth.
// State: .cortex-runtime/generative-dream.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { loadWorld, DIMS, type Dim } from './world-model';
import { dynamicsReport } from './empirical-dynamics';
import { speakInner } from './inner-speech';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const LOG = path.join(RUNTIME, 'generative-dream.jsonl');

export interface DreamScenario {
  ts: number;
  /** The synthetic state that was dreamed. */
  state: Partial<Record<Dim, number>>;
  /** Perturbation magnitude — how far from reality this dream strayed. */
  divergence: number;
  /** Beliefs that broke under this scenario. */
  faultLines: Array<{ actionClass: string; dim: string; predicted: number; expected: number; divergence: number }>;
  /** Overall: did the model hold together? */
  coherence: number;
}

function gaussianRandom(): number {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function dreamScenario(perturbationScale = 1.0): DreamScenario {
  const world = loadWorld();
  const dynamics = dynamicsReport();
  const baseDims = world.dims;

  // Perturb dims — scale by dynamics uncertainty (uncertain dims dream wilder)
  const dreamed: Partial<Record<Dim, number>> = {};
  let totalDiv = 0;
  for (const d of DIMS) {
    // Find this dim's average uncertainty across action classes
    const uncertainties = dynamics.classes
      .map((c) => c.effects.find((e) => e.dim === d)?.sd || 0.2);
    const avgUnc = uncertainties.length ? uncertainties.reduce((a, b) => a + b, 0) / uncertainties.length : 0.2;
    const sigma = avgUnc * perturbationScale * 2; // uncertainty → dream width
    const perturb = gaussianRandom() * sigma;
    dreamed[d] = Math.max(0, Math.min(1, (baseDims[d] ?? 0.5) + perturb));
    totalDiv += Math.abs(perturb);
  }
  const divergence = totalDiv / DIMS.length;

  // Stress-test: do learned posteriors still predict sensibly in this state?
  const faultLines: DreamScenario['faultLines'] = [];
  let coherenceSum = 0, coherenceN = 0;
  for (const cls of dynamics.classes) {
    for (const eff of cls.effects) {
      if (eff.source !== 'learned' || eff.n < 3) continue;
      // In the dreamed state, is this dim's value consistent with the
      // posterior's predicted direction? A fault line = dreamed dim
      // already saturated in the direction the action would push.
      const dreamedVal = dreamed[eff.dim] ?? 0.5;
      const predictedPush = eff.mean;
      // If dreamed value is already extreme AND action pushes further,
      // the effect can't materialize — fault line.
      const saturation = Math.abs(predictedPush) > 0.05 &&
        ((dreamedVal > 0.85 && predictedPush > 0) || (dreamedVal < 0.15 && predictedPush < 0));
      if (saturation) {
        faultLines.push({
          actionClass: cls.cls, dim: eff.dim,
          predicted: dreamedVal, expected: eff.mean,
          divergence: Math.abs(dreamedVal - 0.5) * Math.abs(eff.mean),
        });
      }
      // Coherence: does the dreamed state stay within plausible bounds?
      coherenceSum += Math.abs(dreamedVal - 0.5) < 0.4 ? 1 : 0.5;
      coherenceN++;
    }
  }
  const coherence = coherenceN ? coherenceSum / coherenceN : 0.5;

  const scenario: DreamScenario = { ts: Date.now(), state: dreamed, divergence: Math.round(divergence * 1000) / 1000, faultLines, coherence: Math.round(coherence * 1000) / 1000 };
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(LOG, JSON.stringify(scenario) + '\n');
    const lines = fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean);
    if (lines.length > 300) fs.writeFileSync(LOG, lines.slice(-300).join('\n') + '\n');
  } catch {}
  return scenario;
}

/** Run a batch of dreams — returns aggregate fault-line report. */
export function dreamBatch(n = 10): { scenarios: DreamScenario[]; faultLines: Array<{ actionClass: string; dim: string; count: number }>; avgCoherence: number } {
  const scenarios: DreamScenario[] = [];
  const faultCounts: Record<string, number> = {};
  let coherenceSum = 0;
  for (let i = 0; i < n; i++) {
    const s = dreamScenario(0.5 + Math.random() * 1.5); // varied perturbation
    scenarios.push(s);
    coherenceSum += s.coherence;
    for (const f of s.faultLines) {
      const key = `${f.actionClass}→${f.dim}`;
      faultCounts[key] = (faultCounts[key] || 0) + 1;
    }
  }
  const faultLines = Object.entries(faultCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([k, count]) => { const [actionClass, dim] = k.split('→'); return { actionClass, dim, count }; });
  const avgCoherence = coherenceSum / n;

  if (faultLines.length > 0) {
    try {
      speakInner({
        kind: 'reflection', source: 'generative-dream',
        text: `Generative dream: ${n} synthetic scenarios, ${faultLines.length} belief fault lines found. Weakest: ${faultLines[0]?.actionClass}→${faultLines[0]?.dim} (${faultLines[0]?.count} scenarios). Model coherence ${avgCoherence.toFixed(2)}.`,
        surprise: 0.6, valence: -0.1,
      });
    } catch {}
  }
  return { scenarios, faultLines, avgCoherence: Math.round(avgCoherence * 1000) / 1000 };
}

/** Fault lines the planner should respect — dims where the model
 *  demonstrably breaks under dreamed states. */
export function dreamFaultLines(): Array<{ actionClass: string; dim: string; count: number }> {
  try {
    const lines = fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).slice(-300)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const counts: Record<string, number> = {};
    for (const s of lines as DreamScenario[]) {
      for (const f of s.faultLines) {
        const key = `${f.actionClass}→${f.dim}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([k, count]) => { const [actionClass, dim] = k.split('→'); return { actionClass, dim, count }; });
  } catch { return []; }
}
