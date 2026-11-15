/**
 * Signal detection theory for metacognition — type-1 d′ and type-2 meta-d′.
 *
 * Why this module exists: the platform previously reported Goodman-Kruskal γ
 * and Brier score as "metacognition" metrics. Both conflate three separable
 * quantities — task sensitivity, response bias, and metacognitive sensitivity.
 * A system that simply gets better at the task scores higher on both without
 * its self-knowledge improving at all.
 *
 * meta-d′ (Maniscalco & Lau) is expressed in the same units as d′, which is
 * what makes the M-ratio (meta-d′/d′) able to hold task performance constant
 * while metacognitive access varies. That is the quantity a blindsight-like
 * dissociation is defined over: type-1 performance preserved, type-2
 * sensitivity destroyed.
 *
 * Data format follows the standard convention. `nR_S1` and `nR_S2` are
 * response-count vectors of length 2*nRatings, ordered:
 *
 *   [S1-response @ highest conf ... S1 @ lowest, S2 @ lowest ... S2 @ highest]
 *
 * `nR_S1[i]` counts trials where the stimulus was S1 and the observer gave
 * response/confidence combination i.
 *
 * Estimation method: meta-d′ is the type-1 sensitivity that an ideal observer
 * would need in order to produce the observed type-2 ROC area, holding the
 * observed type-1 criterion fixed. This is the definitional reading of
 * meta-d′, obtained by matching type-2 AUC rather than by full maximum
 * likelihood over confidence criteria. It is monotone in d, so a bisection
 * solves it, and it is checkable against two analytic anchors:
 *
 *   - an ideal observer whose confidence is |evidence - criterion| must
 *     return M-ratio ≈ 1 (metacognition as good as the task allows)
 *   - random confidence must return meta-d′ ≈ 0 (no metacognitive access)
 *
 * `validateEstimator()` asserts both. Do not trust an M-ratio from this file
 * without running it.
 */

// ── Normal distribution ────────────────────────────────────────────

const SQRT_2PI = Math.sqrt(2 * Math.PI);

export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

/** Abramowitz & Stegun 7.1.26 for erf; |error| < 1.5e-7. */
export function normalCdf(x: number): number {
  const z = x / Math.SQRT2;
  const sign = z < 0 ? -1 : 1;
  const a = Math.abs(z);
  const t = 1 / (1 + 0.3275911 * a);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-a * a);
  return 0.5 * (1 + sign * erf);
}

/** Inverse normal CDF (Acklam's rational approximation + one Halley step). */
export function normalInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
             1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
             6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
             -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
             3.754408661907416];

  const pLow = 0.02425;
  let x: number;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pLow) {
    const q = p - 0.5;
    const r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
         ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  // Halley refinement
  const e = normalCdf(x) - p;
  const u = e * SQRT_2PI * Math.exp(0.5 * x * x);
  return x - u / (1 + 0.5 * x * u);
}

// ── Type-1 SDT ─────────────────────────────────────────────────────

export interface Type1Result {
  dPrime: number;
  criterion: number;
  hitRate: number;
  faRate: number;
  /** Proportion correct, for reference only — not a sensitivity measure. */
  accuracy: number;
  trials: number;
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/**
 * Type-1 sensitivity with the log-linear correction (Hautus) applied
 * unconditionally, which is the recommended practice rather than only
 * patching extreme cells.
 */
export function type1SDT(nR_S1: number[], nR_S2: number[]): Type1Result {
  const nBins = nR_S1.length;
  const nRatings = nBins / 2;
  const adj = 1 / nBins;

  const s1 = nR_S1.map((n) => n + adj);
  const s2 = nR_S2.map((n) => n + adj);

  const nS1 = sum(s1);
  const nS2 = sum(s2);

  // "Respond S2" occupies the upper half of each vector.
  const faRate = sum(s1.slice(nRatings)) / nS1;
  const hitRate = sum(s2.slice(nRatings)) / nS2;

  const zH = normalInv(hitRate);
  const zF = normalInv(faRate);

  const correct = sum(nR_S1.slice(0, nRatings)) + sum(nR_S2.slice(nRatings));
  const trials = sum(nR_S1) + sum(nR_S2);

  return {
    dPrime: zH - zF,
    criterion: -0.5 * (zH + zF),
    hitRate,
    faRate,
    accuracy: trials > 0 ? correct / trials : 0,
    trials,
  };
}

// ── Type-2 ROC ─────────────────────────────────────────────────────

export interface Type2ROC {
  /** (falseAlarmRate, hitRate) pairs over confidence thresholds. */
  points: Array<{ far2: number; hr2: number }>;
  /** Area under the type-2 ROC. 0.5 = confidence carries no information. */
  auc: number;
}

/**
 * Observed type-2 ROC: how well does confidence discriminate correct from
 * incorrect responses? Swept over confidence thresholds, pooled across the
 * two responses.
 */
export function type2ROCFromCounts(nR_S1: number[], nR_S2: number[]): Type2ROC {
  const nBins = nR_S1.length;
  const nRatings = nBins / 2;
  const adj = 1 / nBins;

  // Confidence level per bin index: highest at the outer edges.
  // Correct = (S1 stimulus, S1 response) or (S2 stimulus, S2 response).
  const correctByConf = new Array<number>(nRatings).fill(0);
  const incorrectByConf = new Array<number>(nRatings).fill(0);

  for (let i = 0; i < nBins; i++) {
    const respondedS2 = i >= nRatings;
    // Distance from the midpoint gives the confidence rank.
    const conf = respondedS2 ? i - nRatings : nRatings - 1 - i;

    const cS1 = nR_S1[i] + adj;
    const cS2 = nR_S2[i] + adj;

    // Stimulus S1 with an S1 response is correct; with an S2 response, wrong.
    if (respondedS2) {
      incorrectByConf[conf] += cS1;
      correctByConf[conf] += cS2;
    } else {
      correctByConf[conf] += cS1;
      incorrectByConf[conf] += cS2;
    }
  }

  const totalCorrect = sum(correctByConf);
  const totalIncorrect = sum(incorrectByConf);

  // Sweep from the highest confidence downward.
  const points: Array<{ far2: number; hr2: number }> = [{ far2: 0, hr2: 0 }];
  let cumC = 0;
  let cumI = 0;
  for (let conf = nRatings - 1; conf >= 0; conf--) {
    cumC += correctByConf[conf];
    cumI += incorrectByConf[conf];
    points.push({
      far2: totalIncorrect > 0 ? cumI / totalIncorrect : 0,
      hr2: totalCorrect > 0 ? cumC / totalCorrect : 0,
    });
  }
  if (points[points.length - 1].far2 < 1 || points[points.length - 1].hr2 < 1) {
    points.push({ far2: 1, hr2: 1 });
  }

  let auc = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].far2 - points[i - 1].far2;
    auc += dx * (points[i].hr2 + points[i - 1].hr2) * 0.5;
  }

  return { points, auc };
}

/**
 * Expected type-2 ROC area for an ideal observer with sensitivity `d` and
 * type-1 criterion `c`, whose confidence is the distance of the evidence
 * sample from the criterion.
 *
 * Evidence is N(-d/2, 1) under S1 and N(+d/2, 1) under S2, equal base rates.
 * Confidence u = |x - c|. AUC = ∫ f_correct(u) · F_incorrect(u) du.
 */
export function idealObserverType2AUC(d: number, c: number, gridPoints = 2001): number {
  const uMax = 10 + Math.abs(d);
  const du = uMax / (gridPoints - 1);

  const fc = new Float64Array(gridPoints);
  const fi = new Float64Array(gridPoints);

  for (let k = 0; k < gridPoints; k++) {
    const u = k * du;
    // Two evidence values map to this confidence.
    for (const x of [c + u, c - u]) {
      const pS1 = 0.5 * normalPdf(x + d / 2);
      const pS2 = 0.5 * normalPdf(x - d / 2);
      if (x > c) {
        // Responded S2: correct under S2, incorrect under S1.
        fc[k] += pS2;
        fi[k] += pS1;
      } else {
        fc[k] += pS1;
        fi[k] += pS2;
      }
    }
  }

  let totC = 0;
  let totI = 0;
  for (let k = 0; k < gridPoints; k++) {
    totC += fc[k];
    totI += fi[k];
  }
  if (totC <= 0 || totI <= 0) return 0.5;

  // AUC = P(u_correct > u_incorrect) + 0.5·P(tie)
  let cumI = 0;
  let auc = 0;
  for (let k = 0; k < gridPoints; k++) {
    const pc = fc[k] / totC;
    const pi = fi[k] / totI;
    auc += pc * (cumI + 0.5 * pi);
    cumI += pi;
  }
  return auc;
}

// ── meta-d′ ────────────────────────────────────────────────────────

export interface MetaDResult {
  dPrime: number;
  metaDPrime: number;
  /** meta-d′ / d′. 1.0 = metacognition as good as the evidence allows. */
  mRatio: number;
  /** meta-d′ − d′, the additive form. */
  mDiff: number;
  observedType2AUC: number;
  /** True when d′ was too small for the ratio to be meaningful. */
  degenerate: boolean;
  trials: number;
}

const MIN_DPRIME_FOR_RATIO = 0.1;

/**
 * Fit meta-d′ by finding the ideal-observer sensitivity whose expected
 * type-2 AUC matches the observed type-2 AUC, at the observed criterion.
 */
export function fitMetaDPrime(nR_S1: number[], nR_S2: number[]): MetaDResult {
  const t1 = type1SDT(nR_S1, nR_S2);
  const observed = type2ROCFromCounts(nR_S1, nR_S2).auc;

  let metaD: number;
  if (observed <= 0.5) {
    metaD = 0;
  } else {
    // AUC is monotone increasing in d, so bisect.
    let lo = 0;
    let hi = 6;
    if (idealObserverType2AUC(hi, t1.criterion) < observed) {
      metaD = hi;
    } else {
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (idealObserverType2AUC(mid, t1.criterion) < observed) lo = mid;
        else hi = mid;
      }
      metaD = (lo + hi) / 2;
    }
  }

  const degenerate = Math.abs(t1.dPrime) < MIN_DPRIME_FOR_RATIO;

  return {
    dPrime: t1.dPrime,
    metaDPrime: metaD,
    mRatio: degenerate ? NaN : metaD / t1.dPrime,
    mDiff: metaD - t1.dPrime,
    observedType2AUC: observed,
    degenerate,
    trials: t1.trials,
  };
}

// ── Trial-level helpers ────────────────────────────────────────────

export interface Trial {
  /** True stimulus class. */
  stimulus: 0 | 1;
  /** Observer's response. */
  response: 0 | 1;
  /** Confidence rating, 1..nRatings (1 = lowest). */
  confidence: number;
}

/** Convert trials into the nR_S1 / nR_S2 count vectors. */
export function trialsToCounts(
  trials: Trial[],
  nRatings: number,
): { nR_S1: number[]; nR_S2: number[] } {
  const nR_S1 = new Array<number>(nRatings * 2).fill(0);
  const nR_S2 = new Array<number>(nRatings * 2).fill(0);

  for (const t of trials) {
    const conf = Math.min(nRatings, Math.max(1, Math.round(t.confidence)));
    const idx =
      t.response === 1
        ? nRatings + (conf - 1)
        : nRatings - conf;
    if (t.stimulus === 0) nR_S1[idx]++;
    else nR_S2[idx]++;
  }

  return { nR_S1, nR_S2 };
}

export interface CI {
  estimate: number;
  lower: number;
  upper: number;
}

/**
 * Percentile bootstrap over trials. Reports the estimate from the full
 * sample and the 2.5/97.5 percentiles of the resampled distribution.
 */
export function bootstrapMetaD(
  trials: Trial[],
  nRatings: number,
  rng: () => number,
  iterations = 250,
): { dPrime: CI; mRatio: CI; metaDPrime: CI } {
  const fullCounts = trialsToCounts(trials, nRatings);
  const full = fitMetaDPrime(fullCounts.nR_S1, fullCounts.nR_S2);

  const dS: number[] = [];
  const mS: number[] = [];
  const mdS: number[] = [];

  for (let it = 0; it < iterations; it++) {
    const resample: Trial[] = new Array(trials.length);
    for (let i = 0; i < trials.length; i++) {
      resample[i] = trials[(rng() * trials.length) | 0];
    }
    const counts = trialsToCounts(resample, nRatings);
    const fit = fitMetaDPrime(counts.nR_S1, counts.nR_S2);
    dS.push(fit.dPrime);
    mdS.push(fit.metaDPrime);
    if (Number.isFinite(fit.mRatio)) mS.push(fit.mRatio);
  }

  const pct = (xs: number[], p: number): number => {
    if (xs.length === 0) return NaN;
    const s = [...xs].sort((a, b) => a - b);
    const i = Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))));
    return s[i];
  };

  return {
    dPrime: { estimate: full.dPrime, lower: pct(dS, 0.025), upper: pct(dS, 0.975) },
    metaDPrime: { estimate: full.metaDPrime, lower: pct(mdS, 0.025), upper: pct(mdS, 0.975) },
    mRatio: { estimate: full.mRatio, lower: pct(mS, 0.025), upper: pct(mS, 0.975) },
  };
}

// ── Estimator validation ───────────────────────────────────────────

/** Deterministic RNG so every reported figure is reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller, using the supplied uniform source. */
export function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface EstimatorCheck {
  name: string;
  pass: boolean;
  detail: string;
}

/**
 * Two analytic anchors. If these fail, no M-ratio produced by this module
 * means anything, and the dissociation suite should refuse to report.
 */
export function validateEstimator(seed = 20260804): EstimatorCheck[] {
  const checks: EstimatorCheck[] = [];
  const nRatings = 4;
  const n = 6000;
  const trueD = 1.5;

  // Anchor 1 — ideal observer: confidence is |x − c|, so metacognition is
  // as good as the evidence permits. M-ratio should sit near 1.
  {
    const rng = mulberry32(seed);
    const trials: Trial[] = [];
    for (let i = 0; i < n; i++) {
      const stimulus: 0 | 1 = rng() < 0.5 ? 0 : 1;
      const x = (stimulus === 1 ? trueD / 2 : -trueD / 2) + gaussian(rng);
      const response: 0 | 1 = x > 0 ? 1 : 0;
      // Quartile bins on |x| keep the rating scale populated.
      const a = Math.abs(x);
      const confidence = a < 0.32 ? 1 : a < 0.68 ? 2 : a < 1.15 ? 3 : 4;
      trials.push({ stimulus, response, confidence });
    }
    const c = trialsToCounts(trials, nRatings);
    const fit = fitMetaDPrime(c.nR_S1, c.nR_S2);
    const pass = fit.mRatio > 0.85 && fit.mRatio < 1.15;
    checks.push({
      name: 'ideal-observer-mratio-near-1',
      pass,
      detail: `d′=${fit.dPrime.toFixed(3)}, meta-d′=${fit.metaDPrime.toFixed(3)}, M-ratio=${fit.mRatio.toFixed(3)} (expect 0.85–1.15)`,
    });
  }

  // Anchor 2 — random confidence: type-1 performance identical, but
  // confidence carries no information, so meta-d′ should collapse to ~0.
  {
    const rng = mulberry32(seed + 1);
    const trials: Trial[] = [];
    for (let i = 0; i < n; i++) {
      const stimulus: 0 | 1 = rng() < 0.5 ? 0 : 1;
      const x = (stimulus === 1 ? trueD / 2 : -trueD / 2) + gaussian(rng);
      const response: 0 | 1 = x > 0 ? 1 : 0;
      const confidence = 1 + ((rng() * nRatings) | 0);
      trials.push({ stimulus, response, confidence });
    }
    const c = trialsToCounts(trials, nRatings);
    const fit = fitMetaDPrime(c.nR_S1, c.nR_S2);
    const pass = fit.metaDPrime < 0.25 && fit.dPrime > 1.0;
    checks.push({
      name: 'random-confidence-metad-near-0',
      pass,
      detail: `d′=${fit.dPrime.toFixed(3)} (type-1 intact), meta-d′=${fit.metaDPrime.toFixed(3)} (expect <0.25)`,
    });
  }

  // Anchor 3 — inverse CDF round-trip, since everything rests on it.
  {
    let worst = 0;
    for (const p of [0.001, 0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 0.999]) {
      worst = Math.max(worst, Math.abs(normalCdf(normalInv(p)) - p));
    }
    checks.push({
      name: 'normal-inverse-roundtrip',
      pass: worst < 1e-6,
      detail: `max |Φ(Φ⁻¹(p)) − p| = ${worst.toExponential(2)} (expect <1e-6)`,
    });
  }

  return checks;
}
