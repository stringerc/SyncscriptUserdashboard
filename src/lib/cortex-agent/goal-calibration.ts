/**
 * goal-calibration.ts — the forecast learns its own error.
 *
 * Every forecast is a probability claim. This module keeps the ledger
 * of claims (goal-forecast-log.jsonl), resolves outcomes when they
 * become knowable (goal done → hit; target date passed while still
 * active → miss), and measures calibration: when the model says 70%,
 * how often does it actually hit?
 *
 * Correction policy (honest about thin data):
 *   - Bucket predictions into 10% bands; observed hit-rate per bucket.
 *   - A bucket needs ≥3 resolved outcomes before it influences
 *     forecasts; correction = 50% raw + 50% observed (never fully
 *     trusting a small sample).
 *   - With zero resolved outcomes the calibration factor is 1.0 —
 *     the model ships uncalibrated and says so.
 *
 * Resolution honesty: 'achieved' goals count as hits; goals whose
 * targetDate passed while still 'active' count as misses; paused/
 * abandoned goals are excluded (deliberate holds ≠ forecast error).
 */

import fs from 'node:fs';
import path from 'node:path';
import { getCortexGoals } from '../cortex-goals';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const LOG_PATH = path.join(RUNTIME, 'goal-forecast-log.jsonl');
const OUTCOMES_PATH = path.join(RUNTIME, 'goal-forecast-outcomes.jsonl');
const DAY_MS = 86400_000;

export interface ForecastClaim {
  goalId: string; goalTitle: string; targetDate: string;
  probability: number; rawProbability?: number;
  basis: string; observations: number; computedAt: number;
}

export interface ForecastOutcome {
  goalId: string; goalTitle: string; targetDate: string;
  lastProbability: number; outcome: 'hit' | 'miss'; resolvedAt: number;
}

export interface CalibrationBucket { band: string; predicted: number; observed: number; n: number }

export interface CalibrationReport {
  claims: number; outcomes: number; resolvedGoals: number;
  buckets: CalibrationBucket[];
  overallBias: number | null; // mean(predicted) - hitRate; + = overconfident
  sufficientData: boolean;
}

function appendJsonl(file: string, entry: object): void {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(file, JSON.stringify({ ...entry, ts: Date.now() }) + '\n');
  } catch {}
}

function readJsonl<T>(file: string, cap = 20000): T[] {
  try {
    if (!fs.existsSync(file)) return [];
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const out: T[] = [];
    for (let i = Math.max(0, lines.length - cap); i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      try { out.push(JSON.parse(l)); } catch {}
    }
    return out;
  } catch { return []; }
}

/** Log a forecast claim — deduped: max one per goal per day unless the
 *  probability moved ≥5 points since the last claim. */
export function logForecastClaim(c: ForecastClaim): void {
  try {
    const existing = readJsonl<ForecastClaim>(LOG_PATH);
    const last = [...existing].reverse().find((x) => x.goalId === c.goalId);
    const today = new Date(c.computedAt).toISOString().slice(0, 10);
    if (last) {
      const lastDay = new Date(last.computedAt).toISOString().slice(0, 10);
      const moved = Math.abs((last.probability ?? 0) - (c.probability ?? 0)) >= 0.05;
      if (lastDay === today && !moved) return;
    }
    appendJsonl(LOG_PATH, c);
  } catch {}
}

/** Resolve outcomes: called from the forecast watch. A goal resolves
 *  once — done→hit, targetDate passed & still active→miss. */
export function resolveForecastOutcomes(nowMs: number = Date.now()): number {
  const claims = readJsonl<ForecastClaim>(LOG_PATH);
  const existing = new Set(readJsonl<ForecastOutcome>(OUTCOMES_PATH).map((o) => o.goalId));
  const goals = getCortexGoals().list();
  let resolved = 0;
  for (const g of goals) {
    if (existing.has(g.id) || !g.targetDate) continue;
    const targetTs = g.targetDate;
    const isDone = g.status === 'achieved';
    const isMiss = g.status === 'active' && targetTs < nowMs;
    if (!isDone && !isMiss) continue;
    const goalClaims = claims.filter((c) => c.goalId === g.id && c.targetDate === new Date(targetTs).toISOString().slice(0, 10));
    if (!goalClaims.length) continue; // no prediction was ever made — nothing to score
    const lastP = goalClaims[goalClaims.length - 1].probability;
    appendJsonl(OUTCOMES_PATH, {
      goalId: g.id, goalTitle: g.title,
      targetDate: new Date(targetTs).toISOString().slice(0, 10),
      lastProbability: lastP,
      outcome: isDone ? 'hit' : 'miss',
      resolvedAt: nowMs,
    } satisfies ForecastOutcome);
    resolved++;
  }
  return resolved;
}

/** Bucketed calibration + overall bias. */
export function calibrationReport(): CalibrationReport {
  const claims = readJsonl<ForecastClaim>(LOG_PATH);
  const outcomes = readJsonl<ForecastOutcome>(OUTCOMES_PATH);
  const byGoal = new Map<string, ForecastOutcome>();
  for (const o of outcomes) if (!byGoal.has(o.goalId)) byGoal.set(o.goalId, o);
  const resolved = [...byGoal.values()];

  const buckets: CalibrationBucket[] = [];
  for (let lo = 0; lo < 100; lo += 10) {
    const bandOutcomes = resolved.filter((o) => o.lastProbability >= lo / 100 && o.lastProbability < (lo + 10) / 100);
    if (!bandOutcomes.length) continue;
    const predicted = bandOutcomes.reduce((a, o) => a + o.lastProbability, 0) / bandOutcomes.length;
    const observed = bandOutcomes.filter((o) => o.outcome === 'hit').length / bandOutcomes.length;
    buckets.push({ band: `${lo}-${lo + 10}%`, predicted: Math.round(predicted * 100) / 100, observed: Math.round(observed * 100) / 100, n: bandOutcomes.length });
  }
  const hitRate = resolved.length ? resolved.filter((o) => o.outcome === 'hit').length / resolved.length : null;
  const meanPred = resolved.length ? resolved.reduce((a, o) => a + o.lastProbability, 0) / resolved.length : null;
  return {
    claims: claims.length,
    outcomes: outcomes.length,
    resolvedGoals: resolved.length,
    buckets,
    overallBias: hitRate != null && meanPred != null ? Math.round((meanPred - hitRate) * 100) / 100 : null,
    sufficientData: resolved.length >= 5,
  };
}

/**
 * Calibration-corrected probability. With <3 outcomes in the prediction's
 * bucket, returns raw unchanged (honest: no correction on thin data).
 * Otherwise blends 50/50 raw + observed bucket rate.
 */
export function applyCalibration(rawP: number): { probability: number; calibrated: boolean; n: number } {
  try {
    const outcomes = readJsonl<ForecastOutcome>(OUTCOMES_PATH);
    const lo = Math.floor(rawP * 10) * 10;
    const bucket = outcomes.filter((o) => o.lastProbability >= lo / 100 && o.lastProbability < (lo + 10) / 100);
    if (bucket.length < 3) return { probability: rawP, calibrated: false, n: bucket.length };
    const observed = bucket.filter((o) => o.outcome === 'hit').length / bucket.length;
    const blended = Math.round((rawP * 0.5 + observed * 0.5) * 100) / 100;
    return { probability: Math.min(0.98, Math.max(0.02, blended)), calibrated: true, n: bucket.length };
  } catch {
    return { probability: rawP, calibrated: false, n: 0 };
  }
}
