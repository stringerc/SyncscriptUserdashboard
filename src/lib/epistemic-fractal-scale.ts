/**
 * Multi-scale free-energy geometry (fractal-inspired, not mystical).
 *
 * Maps classical complex dynamics ideas onto the MEMORY plant without claiming
 * that epistemic state *is* the Mandelbrot set:
 *
 *   Mandelbrot  z → z²+c boundedness  ≈  F stays under escape under operator load
 *   Self-similarity across scales     ≈  F(hot) ≈ F(spine) ≈ F(full) ≈ F(receipts)
 *   Boundary complexity               ≈ high scale-to-scale variance of F
 *   Lyapunov (already v2)             ≈ local exponential / jump sensitivity of F
 *
 * Canon: integrations/research/EPISTEMIC_FRACTAL_MANDELBROT_BRIDGE.md
 */

import { clamp01 } from './epistemic-homeostasis';

export type PlantScaleName = 'hot' | 'spine' | 'full' | 'receipts';

export interface ScaleFreeEnergy {
  name: PlantScaleName;
  freeEnergy: number;
  /** Relative mass (bytes or lines) — optional for weighting */
  mass?: number;
}

export type ScaleRegime = 'interior' | 'boundary' | 'escape';

export interface MultiScaleGeometry {
  /** 1 = all scales share nearly the same F (clean self-similarity of hygiene) */
  selfSimilarity: number;
  /** 0–1 rank of scale-to-scale spread of F (Mandelbrot *boundary* analogue) */
  boundaryIndex: number;
  /** max F across scales */
  maxScaleF: number;
  /** min F across scales */
  minScaleF: number;
  /** Range max−min */
  scaleRange: number;
  regime: ScaleRegime;
  /** Scale with worst F when regime is escape or boundary */
  criticalScale: PlantScaleName | null;
  samples: ScaleFreeEnergy[];
}

/**
 * Self-similarity of free energy across structural scales of MEMORY.
 * High self-similarity + low F = deep "interior" of a healthy plant set.
 * High boundaryIndex with moderate F = layer mismatch (hot clean, receipts rot, etc.).
 */
export function multiScaleGeometry(
  samples: ScaleFreeEnergy[],
  options?: { escapeThreshold?: number; boundaryThreshold?: number },
): MultiScaleGeometry {
  const escapeThreshold = options?.escapeThreshold ?? 0.25;
  const boundaryThreshold = options?.boundaryThreshold ?? 0.08;
  const usable = samples.filter((s) => Number.isFinite(s.freeEnergy));
  if (!usable.length) {
    return {
      selfSimilarity: 1,
      boundaryIndex: 0,
      maxScaleF: 0,
      minScaleF: 0,
      scaleRange: 0,
      regime: 'interior',
      criticalScale: null,
      samples: [],
    };
  }
  const values = usable.map((s) => clamp01(s.freeEnergy));
  const maxScaleF = Math.max(...values);
  const minScaleF = Math.min(...values);
  const scaleRange = maxScaleF - minScaleF;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, v) => a + (v - mean) * (v - mean), 0) / values.length;
  const std = Math.sqrt(variance);
  // Self-similarity high when F is coherent across scales (std→0).
  const selfSimilarity = clamp01(1 - std / 0.25);
  // Boundary index saturated by ~0.25 std (half the soft escape band).
  const boundaryIndex = clamp01(std / 0.12);

  let regime: ScaleRegime = 'interior';
  if (maxScaleF >= escapeThreshold) regime = 'escape';
  else if (scaleRange >= boundaryThreshold || boundaryIndex >= 0.55) regime = 'boundary';

  let criticalScale: PlantScaleName | null = null;
  if (regime !== 'interior') {
    const worst = usable.reduce((a, b) =>
      clamp01(a.freeEnergy) >= clamp01(b.freeEnergy) ? a : b,
    );
    criticalScale = worst.name;
  }

  return {
    selfSimilarity,
    boundaryIndex,
    maxScaleF,
    minScaleF,
    scaleRange,
    regime,
    criticalScale,
    samples: usable.map((s) => ({ ...s, freeEnergy: clamp01(s.freeEnergy) })),
  };
}

/**
 * Mandelbrot-style escape-time analogue on F history.
 * Count how many consecutive recent samples stay strictly below escapeThreshold
 * going backward from the present (including currentF). Deep interior ⇒ large time.
 */
export function freeEnergyEscapeTime(
  historyF: number[],
  currentF: number,
  options?: { escapeThreshold?: number; maxIter?: number },
): { iterations: number; escaped: boolean; escapeThreshold: number } {
  const escapeThreshold = options?.escapeThreshold ?? 0.25;
  const maxIter = options?.maxIter ?? 64;
  const series = [...historyF.map(clamp01), clamp01(currentF)].slice(-maxIter);
  let iterations = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] >= escapeThreshold) {
      return { iterations, escaped: iterations === 0 && series[i] >= escapeThreshold, escapeThreshold };
    }
    iterations++;
  }
  return { iterations, escaped: false, escapeThreshold };
}

/**
 * Discrete quadratic recurrence metaphor for "one more agent session."
 * z₀ = F, z_{n+1} = z_n² + c  with c = loadBias ∈ [0, 0.25].
 * If |z| exceeds escape, plant is predicted to leave the bounded set under that load.
 * Pure forecasting toy — not a physical claim. Used for "boundary load" introspection.
 */
export function forecastEscapeUnderLoad(
  freeEnergy: number,
  loadBias: number,
  options?: { maxIter?: number; escapeRadius?: number },
): { iterations: number; escaped: boolean; finalZ: number } {
  const maxIter = options?.maxIter ?? 32;
  const escapeRadius = options?.escapeRadius ?? 2;
  const c = clamp01(loadBias) * 0.25;
  let z = clamp01(freeEnergy);
  for (let n = 1; n <= maxIter; n++) {
    z = z * z + c;
    if (z >= escapeRadius || z >= 1) {
      return { iterations: n, escaped: true, finalZ: clamp01(z) };
    }
  }
  return { iterations: maxIter, escaped: false, finalZ: clamp01(z) };
}

/**
 * Hot-layer cut points mirror verify-memory-claims.mjs (declared, not inferred).
 */
export function hotLayerEndLine(doc: string, lines: string[]): number {
  if (doc === 'MEMORY.md') {
    const idx = lines.findIndex((l) => /^## /.test(l) && !/^## How to read/.test(l));
    return idx > 0 ? idx : lines.length;
  }
  if (doc === 'SESSION_START.md') {
    const idx = lines.findIndex((l) => /^## Last session/.test(l));
    return idx > 0 ? idx : lines.length;
  }
  return Math.min(80, lines.length);
}

/** Receipts: Working notes / Dated entries — fine structure of the plant. */
export function receiptsStartLine(lines: string[]): number {
  const idx = lines.findIndex(
    (l) =>
      /^## Working notes/i.test(l) ||
      /^## Dated entries/i.test(l) ||
      /^### Dated entries/i.test(l),
  );
  return idx >= 0 ? idx : Math.floor(lines.length * 0.55);
}

/** Spine: section map + ## headings index zone (coarse structure). */
export function spineSlice(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inMap = false;
  for (const line of lines) {
    if (/section map/i.test(line) || /^### Section map/i.test(line)) inMap = true;
    if (inMap) {
      out.push(line);
      if (/^## /.test(line) && out.length > 5 && !/section map/i.test(line)) {
        // stop at first real ## after dumping map table
        if (!/^## How to read/.test(line) && out.length > 30) break;
      }
    }
    if (/^## /.test(line) && !/^## How to read/.test(line)) {
      out.push(line);
    }
  }
  return out.join('\n') || lines.slice(0, Math.min(120, lines.length)).join('\n');
}
