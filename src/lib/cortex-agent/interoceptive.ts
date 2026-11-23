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

export interface InteroceptiveState {
  /** 0..1 — weighted interoceptive prediction error. */
  error: number;
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

  const error = Math.round(clamp01(
    sRss * W.rss + sHeap * W.heap + sLoad * W.load + sMem * W.mem + sLag * W.lag
  ) * 1000) / 1000;
  const capacity = Math.round((1 - error) * 1000) / 1000;
  const level: InteroceptiveState['level'] = error < 0.5 ? 'nominal' : error < 0.75 ? 'strained' : 'critical';

  const state: InteroceptiveState = { error, capacity, level, vitals, computedAt: nowMs };
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
