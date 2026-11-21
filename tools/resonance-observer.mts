/**
 * resonance-observer.mts — Resonance platform fleet observer for Cortex.
 *
 * Treats every local Cortex service as a phase oscillator and computes the
 * Resonance Calculus metrics the patent framework defines:
 *   R(t)        — Kuramoto order parameter over service response phases
 *   sigmaTheta  — phase dispersion (circular spread)
 *   H_s         — spectral entropy of fleet latency rhythm (STFT → Shannon)
 *   tailHealth  — GPD/PWM tail model over pooled response latencies
 *   K(t)        — adaptive coupling suggestion (observe mode: reported, not actuated)
 *
 * Phase mapping: each service's probe-completion timestamps are fed through
 * PhaseEstimator — services answering on a shared cadence cluster in phase
 * (high R); independent/drifting schedules decohere (low R). Dead services
 * are excluded from R but counted in uptimeRatio — a half-dead fleet cannot
 * score well.
 *
 * Output: .cortex-runtime/resonance/latest.json + history.jsonl (ring-capped)
 * Served read-only at GET /api/cortex/resonance.
 *
 * Run: npx tsx tools/resonance-observer.mts   (launchd: com.cortex.resonance-observer)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { orderParameter, circularStdDev } from './resonance/resonance-core/kuramoto';
import { adaptK, estimateP99Risk } from './resonance/resonance-core/adaptive_coupling';
import { spectralEntropy, getEntropyState } from './resonance/spectral/spectral_entropy';
import { stft } from './resonance/spectral/stft';
import {
  fitGPD_PWM,
  tailQuantileFromGPD,
  aggregateResonance,
} from './resonance/resonance-math/resonance_calculus';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.cortex-runtime', 'resonance');
const LATEST = path.join(OUT_DIR, 'latest.json');
const HISTORY = path.join(OUT_DIR, 'history.jsonl');
const HISTORY_CAP = 5000;

const POLL_MS = 10_000;
const PROBE_TIMEOUT_MS = 2_500;
const TS_BUFFER = 120;   // completion timestamps kept per service (20 min @ 10s)
const LAT_BUFFER = 240;  // latency samples per service (40 min @ 10s)
const ENTROPY_WINDOW = 60; // cycles fed to STFT (~10 min)
const WARMUP_CYCLES = 12;  // ~2 min before scoring

interface FleetNode { name: string; url: string }

const FLEET: FleetNode[] = [
  { name: 'cortex-vite',     url: 'http://127.0.0.1:5173/api/cortex/healthz' },
  { name: 'magpie',          url: 'http://127.0.0.1:3425/v1/models' },
  { name: 'perception-vlm',  url: 'http://127.0.0.1:8940/' },
  { name: 'emotion-ser',     url: 'http://127.0.0.1:8941/' },
  { name: 'speaches',        url: 'http://127.0.0.1:8932/health' },
  { name: 'mlx-lm',          url: 'http://127.0.0.1:8931/v1/models' },
  { name: 'parakeet-stt',    url: 'http://127.0.0.1:8179/' },
  { name: 'chatterbox-tts',  url: 'http://127.0.0.1:8920/' },
  { name: 'imsg-rpc',        url: 'http://127.0.0.1:8930/' },
  { name: 'phoenix',         url: 'http://127.0.0.1:6006/' },
];

interface NodeState {
  completions: number[]; // ms epoch of each successful probe completion
  latencies: number[];   // ms
  lastUp: boolean;
  lastLatencyMs: number | null;
}

const state = new Map<string, NodeState>(FLEET.map(n => [n.name, {
  completions: [], latencies: [], lastUp: false, lastLatencyMs: null,
}]));
const fleetLatencySeries: number[] = []; // per-cycle mean latency of UP nodes
let cycle = 0;

async function probe(node: FleetNode): Promise<void> {
  const s = state.get(node.name)!;
  const t0 = Date.now();
  try {
    const res = await fetch(node.url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    await res.arrayBuffer().catch(() => {});
    s.lastUp = true;
    s.lastLatencyMs = Date.now() - t0;
    s.completions.push(Date.now());
    s.latencies.push(s.lastLatencyMs);
  } catch {
    s.lastUp = false;
    s.lastLatencyMs = null;
    // Dead nodes keep their history — a returning node resumes its phase track
  }
  if (s.completions.length > TS_BUFFER) s.completions.splice(0, s.completions.length - TS_BUFFER);
  if (s.latencies.length > LAT_BUFFER) s.latencies.splice(0, s.latencies.length - LAT_BUFFER);
}

function clamp01(x: number): number { return Math.min(1, Math.max(0, x)); }

function computeMetrics() {
  const upNodes = FLEET.filter(n => state.get(n.name)!.lastUp);
  const uptimeRatio = upNodes.length / FLEET.length;

  // ── Phase coherence across responsive nodes ──
  // Polled request/response can't observe internal oscillators — completion
  // timestamps are slaved to the probe schedule (R≈1 artifact). The honest
  // phase signal available is each node's response-time angle: θ_i maps
  // latency onto [0, 2π) at 1s = full turn. Services with similar response
  // profiles cluster (high R = fleet timing homogeneity); a slowing service
  // drifts in phase and decoheres the fleet — exactly what the controller
  // is meant to detect.
  const phases: { name: string; phase: number }[] = [];
  for (const n of upNodes) {
    const s = state.get(n.name)!;
    if (s.lastLatencyMs === null) continue;
    phases.push({ name: n.name, phase: (clamp01(s.lastLatencyMs / 1000)) * 2 * Math.PI });
  }

  let R = 0, sigmaTheta = 0, meanPhase = 0, coherenceScore = 0, K = 0;
  if (phases.length >= 3) {
    const ph = phases.map(p => p.phase);
    const kur = orderParameter(ph);
    R = kur.R;
    meanPhase = kur.psi;
    sigmaTheta = circularStdDev(ph);
    coherenceScore = clamp01(R * uptimeRatio); // dead fleet drags coherence
    const p99Risk = estimateP99Risk(
      FLEET.flatMap(n => state.get(n.name)!.latencies.slice(-30)), 250);
    K = adaptK(0.8, sigmaTheta, p99Risk, { min: 0.1, max: 2.5 });
  } else {
    coherenceScore = 0;
  }

  // ── Spectral entropy of fleet latency rhythm ──
  let entropy = 0.5, entropyState = 'unknown';
  if (fleetLatencySeries.length >= 24) {
    const win = Math.min(16, Math.floor(fleetLatencySeries.length / 2));
    const spec = stft(fleetLatencySeries.slice(-ENTROPY_WINDOW), win, Math.max(1, Math.floor(win / 2)));
    const avgMag = Array.from({ length: spec.frequencyBins }, (_, f) =>
      spec.magnitudes.reduce((a, frame) => a + (frame[f] || 0), 0) / Math.max(1, spec.magnitudes.length));
    entropy = spectralEntropy(avgMag);
    entropyState = getEntropyState(entropy);
  }

  // ── Tail health: pooled latencies → GPD/PWM → Q99/Q999 ──
  let tailHealthScore: number | null = null, gpd: any = null, tailQuantiles: any = null;
  const allLat = FLEET.flatMap(n => state.get(n.name)!.latencies);
  if (allLat.length >= 50) {
    const sorted = [...allLat].sort((a, b) => a - b);
    const threshold = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
    const exceedances = sorted.filter(x => x > threshold).map(x => x - threshold);
    try {
      gpd = fitGPD_PWM(exceedances, threshold);
      const q99 = tailQuantileFromGPD(0.99, gpd);
      const q999 = tailQuantileFromGPD(0.999, gpd);
      tailQuantiles = { q99: Math.round(q99 * 10) / 10, q999: Math.round(q999 * 10) / 10 };
      tailHealthScore = clamp01(threshold / Math.max(q99, 1e-9));
      gpd = { xi: +gpd.xi.toFixed(4), sigma: +gpd.sigma.toFixed(2), threshold: Math.round(threshold * 10) / 10, tailFrac: +gpd.tailFrac.toFixed(4) };
    } catch { /* insufficient exceedances — stays null */ }
  }

  // ── Aggregate (equal weights; timing skipped — no dep graph in v1) ──
  const aggregate = tailHealthScore !== null
    ? aggregateResonance(
        { coherenceScore, tailHealthScore, timingScore: 0.5 },
        { wC: 1, wT: 1, wTiming: 0.0001 }) // ~2-component aggregate
    : coherenceScore;

  return {
    ts: new Date().toISOString(),
    cycle,
    fleetSize: FLEET.length,
    nodesUp: upNodes.length,
    uptimeRatio: +uptimeRatio.toFixed(3),
    nodes: Object.fromEntries(FLEET.map(n => {
      const s = state.get(n.name)!;
      return [n.name, { up: s.lastUp, latencyMs: s.lastLatencyMs, samples: s.latencies.length }];
    })),
    resonance: {
      R: +R.toFixed(4),
      meanPhase: +meanPhase.toFixed(4),
      sigmaTheta: +sigmaTheta.toFixed(4),
      coherenceScore: +coherenceScore.toFixed(4),
      couplingK: +K.toFixed(4),
      spectralEntropy: +entropy.toFixed(4),
      entropyState,
      tailHealthScore: tailHealthScore === null ? null : +tailHealthScore.toFixed(4),
      gpd,
      tailQuantiles,
      aggregateScore: +aggregate.toFixed(4),
      scoredNodes: phases.length,
      mode: 'observe',
    },
  };
}

function persist(snap: any) {
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(LATEST, JSON.stringify(snap, null, 2));
    fs.appendFileSync(HISTORY, JSON.stringify({
      ts: snap.ts, R: snap.resonance.R, agg: snap.resonance.aggregateScore,
      up: snap.nodesUp, entropy: snap.resonance.spectralEntropy,
      tail: snap.resonance.tailHealthScore,
    }) + '\n');
    // cap history
    const lines = fs.readFileSync(HISTORY, 'utf8').trim().split('\n');
    if (lines.length > HISTORY_CAP) fs.writeFileSync(HISTORY, lines.slice(-HISTORY_CAP).join('\n') + '\n');
  } catch (e: any) {
    console.error('[resonance] persist failed:', e?.message);
  }
}

async function tick() {
  cycle++;
  await Promise.all(FLEET.map(probe));
  const upLat = FLEET.map(n => state.get(n.name)!.lastLatencyMs).filter((x): x is number => x !== null);
  fleetLatencySeries.push(upLat.length ? upLat.reduce((a, b) => a + b, 0) / upLat.length : 0);
  if (fleetLatencySeries.length > ENTROPY_WINDOW * 2) fleetLatencySeries.shift();

  const snap = computeMetrics();
  persist(snap);
  const r = snap.resonance;
  console.log(`[resonance] cycle ${cycle} — up ${snap.nodesUp}/${snap.fleetSize} | R=${r.R} agg=${r.aggregateScore} σθ=${r.sigmaTheta} H=${r.spectralEntropy}(${r.entropyState}) K=${r.couplingK} tail=${r.tailHealthScore ?? 'warming'}`);
}

console.log(`[resonance] observer started — ${FLEET.length} nodes, ${POLL_MS / 1000}s cadence, warmup ${WARMUP_CYCLES} cycles`);
tick();
setInterval(tick, POLL_MS);
