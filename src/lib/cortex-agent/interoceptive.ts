/**
 * interoceptive.ts — the missing free-energy term.
 *
 * Cortex asked for somatic homeostasis readings to enter the SAME
 * minimization process as environmental prediction error — not a
 * parallel monitor, but interoceptive error as a first-class cost in
 * action selection. This module is that term.
 *
 * Signals (all cheap, all sync, ~0ms hot path):
 *   - process.memoryUsage()      — live rss/heap (fresh, not 5-min-old)
 *   - os.loadavg()               — host load vs core count
 *   - getCachedMemFreePct()      — kern.memorystatus_level (honest macOS
 *                                   memory accounting; os.freemem lies)
 *   - self-regulation latest.json— event-loop lag p99 (the monitor lives
 *                                   there; we read its freshest sample)
 *
 * error ∈ [0,1] = weighted normalized exceedance. capacity = 1 − error.
 *
 * Action-selection semantics (the governor):
 *   error < 0.50  → full capacity, all dispatch allowed
 *   0.50–0.75     → HEAVY kinds deferred (orchestrate/devin/research/
 *                   build/sprint/mission); light kinds pass
 *   > 0.75        → only essential kinds pass (patrol/status/comm/watchdog)
 * Deferred ≠ denied: the caller returns a governance reason and the work
 * can be retried when capacity recovers. Nothing is silently dropped.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getCachedMemFreePct, getSomaticVitals } from '../cortex-world-state';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const SELF_LATEST = path.join(RUNTIME, 'self-regulation', 'latest.json');
const HISTORY_FILE = path.join(RUNTIME, 'interoceptive-history.json');
const HISTORY_MAX = 120;          // ~2h at 1 sample/min
const HISTORY_MIN_GAP_MS = 45_000;
const CACHE_TTL_MS = 15_000;

export interface InteroceptiveVitals {
  rssMB: number;
  heapUsedMB: number;
  loadAvg1m: number;
  cores: number;
  memFreePct?: number;
  lagP99Ms?: number;
  vitalsAgeMs?: number;
}

export interface InteroceptivePrediction {
  rssMB: number; heapUsedMB: number; loadAvg1m: number; memFreePct?: number;
}

export interface InteroceptiveState {
  /** 0..1 — weighted interoceptive prediction error (homeostasis + surprise). */
  error: number;
  /** 0..1 — somatic surprise: |predicted − actual| trajectory deviation. */
  surprise: number;
  /** Next-tick vitals forecast from the somatic trajectory. */
  predicted?: InteroceptivePrediction;
  /** 0..1 — usable capacity for discretionary work. */
  capacity: number;
  level: 'nominal' | 'strained' | 'critical';
  vitals: InteroceptiveVitals;
  computedAt: number;
}

// ── Normalization anchors (from self-regulation thresholds + host reality)
const RSS_FULL_MB = 4096;      // rss/4GB → full strain
const HEAP_FULL_MB = 2048;     // heap/2GB → full strain
const LOAD_FULL = 8;           // load1 == cores → half strain (×0.5 weight)
const MEM_FREE_FLOOR_PCT = 20; // free% at/below → full strain
const LAG_FULL_MS = 1500;      // self-regulation p99 warn → full strain

// Weights sum to 1. Memory (self + host) dominates — it's the resource
// that actually kills the fleet; lag is the responsiveness term.
const W = { rss: 0.22, heap: 0.18, load: 0.10, mem: 0.28, lag: 0.22 };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function readSelfRegulationLag(): { lagP99Ms?: number; ageMs?: number } {
  try {
    const raw = JSON.parse(fs.readFileSync(SELF_LATEST, 'utf8'));
    const at = Number(raw?.vitals?.at || 0);
    const lag = Number(raw?.vitals?.lagP99Ms);
    return {
      lagP99Ms: Number.isFinite(lag) ? lag : undefined,
      ageMs: at ? Date.now() - at : undefined,
    };
  } catch { return {}; }
}

// ── Somatic trajectory prediction (active inference, turned inward) ──
// Cortex doesn't just sense her vitals — she predicts where they're
// heading and registers surprise when reality deviates. History is a
// thin JSON ring (~1 sample/min); prediction is damped linear
// extrapolation so a single spike can't fabricate a trend.

interface VitalsSample { ts: number; rssMB: number; heapUsedMB: number; loadAvg1m: number; memFreePct?: number }

function readHistory(): VitalsSample[] {
  try { const a = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); return Array.isArray(a) ? a : []; } catch { return []; }
}
function appendHistory(sample: VitalsSample) {
  try {
    const h = readHistory();
    if (h.length && sample.ts - h[h.length - 1].ts < HISTORY_MIN_GAP_MS) return;
    h.push(sample);
    if (h.length > HISTORY_MAX) h.splice(0, h.length - HISTORY_MAX);
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(h));
  } catch {}
}
/** Damped linear forecast: slope over the window, clamped to sane drift. */
function predict(samples: VitalsSample[], horizonMs: number): InteroceptivePrediction | undefined {
  if (samples.length < 3) return undefined;
  const first = samples[0], last = samples[samples.length - 1];
  const span = Math.max(1, last.ts - first.ts);
  const perMs = horizonMs / span;
  const slope = (cur: number, prev: number) => {
    const raw = (cur - prev) * perMs;
    // damp: trust at most 60% of the observed slope — vitals are noisy
    return cur + raw * 0.6;
  };
  return {
    rssMB: Math.max(0, Math.round(slope(last.rssMB, first.rssMB))),
    heapUsedMB: Math.max(0, Math.round(slope(last.heapUsedMB, first.heapUsedMB))),
    loadAvg1m: Math.max(0, Math.round(slope(last.loadAvg1m, first.loadAvg1m) * 100) / 100),
    memFreePct: last.memFreePct != null ? Math.max(0, Math.min(100, Math.round(slope(last.memFreePct, first.memFreePct ?? last.memFreePct) * 10) / 10)) : undefined,
  };
}
/** Normalized |actual − predicted| across channels, each on its own scale. */
function surpriseOf(v: InteroceptiveVitals, p: InteroceptivePrediction): number {
  const dRss = Math.abs(v.rssMB - p.rssMB) / RSS_FULL_MB;
  const dHeap = Math.abs(v.heapUsedMB - p.heapUsedMB) / HEAP_FULL_MB;
  const dLoad = Math.abs(v.loadAvg1m - p.loadAvg1m) / LOAD_FULL;
  const dMem = (v.memFreePct != null && p.memFreePct != null)
    ? Math.abs(v.memFreePct - p.memFreePct) / 50 : 0;
  return clamp01((dRss + dHeap + dLoad + dMem) / 4);
}

let cache: { at: number; state: InteroceptiveState } | null = null;

/** Compute (or return cached ≤15s) interoceptive state. ~0ms hot path. */
export function getInteroceptiveState(nowMs: number = Date.now()): InteroceptiveState {
  if (cache && nowMs - cache.at < CACHE_TTL_MS) return cache.state;

  const mem = process.memoryUsage();
  const cores = os.cpus().length || 8;
  const load1 = os.loadavg()[0] || 0;
  const memFreePct = getCachedMemFreePct();
  const { lagP99Ms, ageMs: vitalsAgeMs } = readSelfRegulationLag();
  const host = getSomaticVitals();

  const vitals: InteroceptiveVitals = {
    rssMB: Math.round(mem.rss / 1048576),
    heapUsedMB: Math.round(mem.heapUsed / 1048576),
    loadAvg1m: Math.round(load1 * 100) / 100,
    cores,
    memFreePct: memFreePct ?? host.memFreePct,
    lagP99Ms,
    vitalsAgeMs,
  };

  // Per-signal strain 0..1
  const sRss = clamp01(vitals.rssMB / RSS_FULL_MB);
  const sHeap = clamp01(vitals.heapUsedMB / HEAP_FULL_MB);
  const sLoad = clamp01((load1 / cores) * 2) * 0.5; // load==cores → 0.5
  const sMem = vitals.memFreePct != null
    ? clamp01((MEM_FREE_FLOOR_PCT + 15 - vitals.memFreePct) / (MEM_FREE_FLOOR_PCT + 15)) // 35%→0, 20%→1
    : clamp01((host.memUsedPct || 0) / 100);
  // Stale vitals (>10min) get half weight — old pain is not current pain.
  const lagFresh = vitalsAgeMs != null && vitalsAgeMs < 600_000;
  const sLag = vitals.lagP99Ms != null ? clamp01(vitals.lagP99Ms / LAG_FULL_MS) * (lagFresh ? 1 : 0.5) : 0;

  const homeostasis = clamp01(
    sRss * W.rss + sHeap * W.heap + sLoad * W.load + sMem * W.mem + sLag * W.lag
  );

  // Inward active inference: record the sample, forecast the next tick,
  // and let trajectory surprise join homeostasis in the free-energy term.
  appendHistory({ ts: nowMs, rssMB: vitals.rssMB, heapUsedMB: vitals.heapUsedMB, loadAvg1m: vitals.loadAvg1m, memFreePct: vitals.memFreePct });
  const history = readHistory();
  const predicted = predict(history, 60_000);
  const surprise = predicted ? surpriseOf(vitals, predicted) : 0;

  // Free energy = homeostatic strain + w·somatic surprise. Surprise is
  // capped at 0.4 contribution so a noisy forecast can't paralyze her.
  const error = Math.round(clamp01(homeostasis * 0.85 + surprise * 0.15) * 1000) / 1000;
  const capacity = Math.round((1 - error) * 1000) / 1000;
  const level: InteroceptiveState['level'] = error < 0.5 ? 'nominal' : error < 0.75 ? 'strained' : 'critical';

  const state: InteroceptiveState = {
    error, surprise: Math.round(surprise * 1000) / 1000, predicted,
    capacity, level, vitals, computedAt: nowMs,
  };
  cache = { at: nowMs, state };
  return state;
}

// ── Action-selection gate ──────────────────────────────────────────────

const HEAVY_RE = /orchestrate|devin|research|build|sprint|deep|mission|code|generate|video|image/i;
const ESSENTIAL_RE = /patrol|status|comm|handoff|watchdog|heartbeat|distill/i;

export interface GateDecision {
  allow: boolean;
  reason?: string;
  level: InteroceptiveState['level'];
  capacity: number;
}

/** Should this agent task dispatch under current interoceptive load?
 *  Deferred work should be retried later — the reason string says why. */
export function interoceptiveGate(kind: string, title: string, state?: InteroceptiveState): GateDecision {
  const s = state || getInteroceptiveState();
  const text = `${kind} ${title}`;
  if (s.level === 'nominal') return { allow: true, level: s.level, capacity: s.capacity };
  if (ESSENTIAL_RE.test(text)) return { allow: true, level: s.level, capacity: s.capacity };
  if (s.level === 'strained' && !HEAVY_RE.test(text)) return { allow: true, level: s.level, capacity: s.capacity };
  if (s.level === 'critical' && ESSENTIAL_RE.test(text)) return { allow: true, level: s.level, capacity: s.capacity };
  const what = s.level === 'critical' ? 'host capacity critical' : 'host capacity strained';
  return {
    allow: false,
    level: s.level,
    capacity: s.capacity,
    reason: `${what} (interoceptive error ${Math.round(s.error * 100)}%, capacity ${Math.round(s.capacity * 100)}%) — ${HEAVY_RE.test(text) ? 'heavy' : 'discretionary'} work deferred until vitals recover`,
  };
}
