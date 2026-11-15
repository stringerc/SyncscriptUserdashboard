/**
 * Epistemic homeostasis — pure measures for the MEMORY-centred plant.
 *
 * This is not a consciousness score. It quantifies how much free energy
 * (prediction error / rot / surprise) lives in the durable operator substrate,
 * and how close that plant sits to harmony under Resonance Homeostasis.
 *
 * Formal control story (research canon):
 *   integrations/research/EPISTEMIC_HOMEOSTASIS_MEMORY_RESONANCE.md
 *
 * Math is deliberately small:
 *   rates ∈ [0, 1]
 *   free energy F = weighted sum of rates (higher = more rot)
 *   harmony H = (1 − F) × circadian proxy β̂ ∈ [0, 1]
 * No parallel "harmonic calculus" library — cosinor β lives in resonance-calculus.
 *
 * v2 increments (2026-08-04):
 *   + contradictionDensity (claim graph)
 *   + sensorFailRate (live / cached prod + proxy sensors)
 * Claim graph + Lyapunov + sensors: epistemic-claim-graph.ts
 * Meta-d′ cortex remains orthogonal — never a term in F.
 */

export type Rate = number; // expected [0, 1]

export interface EpistemicRateInputs {
  /** Documented npm scripts missing from package.json */
  deadCommandRate: Rate;
  /** Backticked repo paths that do not exist (excluding historical markers) */
  missingPathRate: Rate;
  /** § navigation targets that do not resolve to headings */
  unresolvedSectionRate: Rate;
  /** Fraction of critical plant files missing */
  plantGapRate: Rate;
  /** Soft rot: undated ops-looking claims / conflict markers (0–1) */
  ambiguityRate: Rate;
  /**
   * Fraction of required operator verify scripts that are defined.
   * High coverage reduces free energy (good).
   */
  verifyCoverage: Rate;
  /** Claim-graph contradiction density (0 = none, 1 = saturated). Optional default 0. */
  contradictionDensity?: Rate;
  /** Live sensor fail rate (prod-build / proxy stream). Optional default 0 when unknown. */
  sensorFailRate?: Rate;
}

export interface FreeEnergyWeights {
  deadCommand: number;
  missingPath: number;
  unresolvedSection: number;
  plantGap: number;
  ambiguity: number;
  verifyGap: number;
  contradiction: number;
  sensorFail: number;
}

/**
 * Default weights prioritise "confident wrong instructions" over soft style noise.
 * v2: rebalanced to include claim conflicts + live sensors without erasing path/command dominance.
 */
export const DEFAULT_FREE_ENERGY_WEIGHTS: FreeEnergyWeights = {
  deadCommand: 0.24,
  missingPath: 0.15,
  unresolvedSection: 0.1,
  plantGap: 0.16,
  ambiguity: 0.06,
  verifyGap: 0.1,
  contradiction: 0.12,
  sensorFail: 0.07,
};

export interface EpistemicSnapshot {
  freeEnergy: number;
  harmony: number;
  verifyGap: number;
  components: Required<EpistemicRateInputs>;
  weights: FreeEnergyWeights;
  circadianProxy: number;
  graded: 'harmony' | 'stable' | 'stressed' | 'entropic';
}

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

/**
 * Cosinor-like β proxy for *when* heavy epistemic compaction is cheap.
 * Matches the spirit of getCircadianCurve without coupling product UI tasks.
 * Peak mid-afternoon local hour; trough at night. Heuristic only — not medical.
 */
export function epistemicCircadianProxy(hourLocal: number): number {
  const h = ((hourLocal % 24) + 24) % 24;
  // Cosinor midpoint ~14:00, amplitude so night stays usable (~0.55 floor).
  const phase = ((h - 14) / 24) * 2 * Math.PI;
  return clamp01(0.78 + 0.22 * Math.cos(phase));
}

export function verifyGapFromCoverage(verifyCoverage: Rate): number {
  return clamp01(1 - clamp01(verifyCoverage));
}

function normalizeRates(rates: EpistemicRateInputs): Required<EpistemicRateInputs> {
  return {
    deadCommandRate: clamp01(rates.deadCommandRate),
    missingPathRate: clamp01(rates.missingPathRate),
    unresolvedSectionRate: clamp01(rates.unresolvedSectionRate),
    plantGapRate: clamp01(rates.plantGapRate),
    ambiguityRate: clamp01(rates.ambiguityRate),
    verifyCoverage: clamp01(rates.verifyCoverage),
    contradictionDensity: clamp01(rates.contradictionDensity ?? 0),
    sensorFailRate: clamp01(rates.sensorFailRate ?? 0),
  };
}

/**
 * Free energy of the plant: higher means agents should trust MEMORY less until repaired.
 * Weights must sum ≈ 1; if not, they are renormalized so absolute levels stay comparable.
 */
export function computeFreeEnergy(
  rates: EpistemicRateInputs,
  weights: FreeEnergyWeights = DEFAULT_FREE_ENERGY_WEIGHTS,
): number {
  const r = normalizeRates(rates);
  const wSum =
    weights.deadCommand +
    weights.missingPath +
    weights.unresolvedSection +
    weights.plantGap +
    weights.ambiguity +
    weights.verifyGap +
    weights.contradiction +
    weights.sensorFail;
  const n = wSum > 0 ? wSum : 1;
  const verifyGap = verifyGapFromCoverage(r.verifyCoverage);
  const f =
    (weights.deadCommand * r.deadCommandRate +
      weights.missingPath * r.missingPathRate +
      weights.unresolvedSection * r.unresolvedSectionRate +
      weights.plantGap * r.plantGapRate +
      weights.ambiguity * r.ambiguityRate +
      weights.verifyGap * verifyGap +
      weights.contradiction * r.contradictionDensity +
      weights.sensorFail * r.sensorFailRate) /
    n;
  return clamp01(f);
}

/** Harmony is not a separate algebra — it is low free energy under timing β̂. */
export function computeHarmony(freeEnergy: number, circadianProxy: number): number {
  return clamp01((1 - clamp01(freeEnergy)) * clamp01(circadianProxy));
}

export function gradeHarmony(harmony: number): EpistemicSnapshot['graded'] {
  const h = clamp01(harmony);
  if (h >= 0.85) return 'harmony';
  if (h >= 0.7) return 'stable';
  if (h >= 0.5) return 'stressed';
  return 'entropic';
}

export function buildEpistemicSnapshot(
  rates: EpistemicRateInputs,
  options?: {
    weights?: FreeEnergyWeights;
    hourLocal?: number;
    circadianProxy?: number;
  },
): EpistemicSnapshot {
  const weights = options?.weights ?? DEFAULT_FREE_ENERGY_WEIGHTS;
  const components = normalizeRates(rates);
  const freeEnergy = computeFreeEnergy(components, weights);
  const circadianProxy =
    options?.circadianProxy != null
      ? clamp01(options.circadianProxy)
      : epistemicCircadianProxy(options?.hourLocal ?? new Date().getHours());
  const harmony = computeHarmony(freeEnergy, circadianProxy);
  return {
    freeEnergy,
    harmony,
    verifyGap: verifyGapFromCoverage(components.verifyCoverage),
    components,
    weights,
    circadianProxy,
    graded: gradeHarmony(harmony),
  };
}

/** Rate helper used by the Node measurer (keeps division-by-zero honest). */
export function rate(bad: number, total: number): Rate {
  if (!Number.isFinite(bad) || !Number.isFinite(total) || total <= 0) return 0;
  return clamp01(bad / total);
}

/**
 * Soft ambiguity score from inexpensive lexical markers.
 * Not an LLM judge — a floor detector for uncommitted ops prose.
 */
export function scoreAmbiguityMarkers(text: string): {
  undatedClaimHits: number;
  conflictHits: number;
  openLoopHits: number;
  ambiguityRate: Rate;
} {
  const lines = text.split('\n');
  let undatedClaimHits = 0;
  let conflictHits = 0;
  let openLoopHits = 0;
  for (const line of lines) {
    if (
      /^\s*[-*]\s+.+\bmust\b/i.test(line) &&
      !/\b20\d{2}-\d{2}-\d{2}\b/.test(line) &&
      line.length > 40
    ) {
      undatedClaimHits++;
    }
    if (/\b(contradicts?|conflicts with|mutually exclusive|but actually|or is it\?)\b/i.test(line)) {
      conflictHits++;
    }
    if (/\b(TODO|FIXME|XXX|WIP|not sure|TBD)\b/.test(line)) {
      openLoopHits++;
    }
  }
  // Soft-cap counts so one dense section cannot dominate free energy.
  const raw =
    Math.min(1, undatedClaimHits / 40) * 0.35 +
    Math.min(1, conflictHits / 12) * 0.4 +
    Math.min(1, openLoopHits / 25) * 0.25;
  return {
    undatedClaimHits,
    conflictHits,
    openLoopHits,
    ambiguityRate: clamp01(raw),
  };
}

/**
 * Wall-clock repair estimate: remaining free energy times a scale (seconds).
 * Used only as operator intuition when previous snapshot had higher F.
 */
export function estimateRepairSeconds(
  freeEnergyNow: number,
  freeEnergyBefore: number | null,
  scaleSeconds = 600,
): number | null {
  if (freeEnergyBefore == null || freeEnergyBefore <= freeEnergyNow) return null;
  const delta = freeEnergyBefore - freeEnergyNow;
  return Math.round(delta * scaleSeconds);
}

/** Soft gate thresholds (release gate). */
export const EPISTEMIC_SOFT_THRESHOLDS = {
  maxFreeEnergy: 0.25,
  minHarmony: 0.55,
  /** Max upward ΔF over rolling 24h without an active exception. */
  maxLyapunovUpDelta: 0.08,
  lyapunovWindowMs: 24 * 60 * 60 * 1000,
} as const;
