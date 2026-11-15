/**
 * cortex-somatic.ts — Somatic/embodied signal channel (Phase 5.1 spike).
 *
 * Ingests wellness samples (HRV, sleep, resting HR) from wearables, Apple
 * Health exports, or manual voice logs. Derives interoceptive state the
 * initiative engine can propose from — "HRV down 20% + late nights → move
 * the hard block".
 *
 * Kill criterion (spec 5.1): if signal quality can't beat calendar-only
 * heuristics after 2 weeks of real data, this channel gets cut.
 */

import { persistentStore } from './persistent-store';

export interface SomaticSample {
  at: number;
  source: 'apple_health' | 'wearable' | 'manual' | 'voice';
  hrvMs?: number;        // RMSSD, ms
  sleepHours?: number;   // last night
  bedtimeHour?: number;  // local hour sleep began (e.g. 23.5)
  restingHr?: number;
}

export interface SomaticState {
  sampleCount: number;
  latestAt?: number;
  hrvDeltaPct?: number;          // vs trailing baseline
  consecutiveLateNights: number;  // bedtimeHour >= 24 (midnight) streak
  sleepDebtHours: number;        // vs 8h target over last 7 samples
  stressScore: number;           // 0..1 composite
  fresh: boolean;                // data within 48h
}

const STORAGE_KEY = 'cortex:somatic:v1';
const MAX_SAMPLES = 200;
const LATE_BEDTIME_HOUR = 24; // midnight
const BASELINE_WINDOW = 14;
const STALE_MS = 48 * 3600 * 1000;

/** Pure derivation — shared by the client store and the server /sense endpoint. */
export function deriveSomaticState(samples: SomaticSample[], now = Date.now()): SomaticState {
  const n = samples.length;
  const latest = samples[n - 1];
  const fresh = !!latest && now - latest.at < STALE_MS;

  let hrvDeltaPct: number | undefined;
  const hrvHist = samples.filter(s => typeof s.hrvMs === 'number').map(s => s.hrvMs!);
  if (latest?.hrvMs !== undefined && hrvHist.length >= 5) {
    const prior = hrvHist.slice(0, -1).slice(-BASELINE_WINDOW);
    const baseline = prior.reduce((a, b) => a + b, 0) / prior.length;
    if (baseline > 0) hrvDeltaPct = (latest.hrvMs - baseline) / baseline;
  }

  let consecutiveLateNights = 0;
  for (let i = n - 1; i >= 0; i--) {
    const bt = samples[i].bedtimeHour;
    if (bt === undefined) break;
    if (bt >= LATE_BEDTIME_HOUR) consecutiveLateNights++;
    else break;
  }

  const recentSleep = samples.filter(s => typeof s.sleepHours === 'number').slice(-7);
  const sleepDebtHours = recentSleep.length
    ? recentSleep.reduce((acc, s) => acc + Math.max(0, 8 - (s.sleepHours ?? 8)), 0)
    : 0;

  const hrvStress = hrvDeltaPct !== undefined ? Math.min(1, Math.max(0, -hrvDeltaPct / 0.3)) : 0;
  const lateStress = Math.min(1, consecutiveLateNights / 4);
  const debtStress = Math.min(1, sleepDebtHours / 10);
  const stressScore = Math.min(1, hrvStress * 0.5 + lateStress * 0.3 + debtStress * 0.2);

  return {
    sampleCount: n,
    latestAt: latest?.at,
    hrvDeltaPct,
    consecutiveLateNights,
    sleepDebtHours: Math.round(sleepDebtHours * 10) / 10,
    stressScore: Math.round(stressScore * 100) / 100,
    fresh,
  };
}

function load(): SomaticSample[] {
  try {
    const raw = persistentStore.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(-MAX_SAMPLES) : [];
  } catch { return []; }
}

export class CortexSomatic {
  private samples: SomaticSample[] = load();

  public ingest(sample: Omit<SomaticSample, 'at'> & { at?: number }): SomaticSample {
    const s: SomaticSample = { ...sample, at: sample.at ?? Date.now() };
    this.samples.push(s);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
    this.save();
    return s;
  }

  public getSamples(limit = 50): SomaticSample[] {
    return this.samples.slice(-limit);
  }

  public state(): SomaticState {
    return deriveSomaticState(this.samples);
  }

  public clear(): void {
    this.samples = [];
    this.save();
  }

  private save(): void {
    try { persistentStore.setItem(STORAGE_KEY, JSON.stringify(this.samples)); } catch {}
  }
}

let globalSomatic: CortexSomatic | null = null;

export function getCortexSomatic(): CortexSomatic {
  if (!globalSomatic) globalSomatic = new CortexSomatic();
  return globalSomatic;
}
