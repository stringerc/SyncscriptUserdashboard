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
const RECS = path.join(OUT_DIR, 'recommendations.jsonl');
const HISTORY_CAP = 5000;
const RECS_CAP = 2000;

const POLL_MS = 10_000;
const PROBE_TIMEOUT_MS = 2_500;
const TS_BUFFER = 120;   // completion timestamps kept per service (20 min @ 10s)
const LAT_BUFFER = 240;  // latency samples per service (40 min @ 10s)
const ENTROPY_WINDOW = 60; // cycles fed to STFT (~10 min)
const WARMUP_CYCLES = 12;  // ~2 min before scoring

interface FleetNode { name: string; url: string; lazy?: boolean }

// lazy = on-demand sidecar, expected to be dark until called (RAM conservation
// after the 16GB freeze). Their cold-start latency is signal, but their
// downtime is BY DESIGN — capacity rules must not fire on them.
const FLEET: FleetNode[] = [
  { name: 'cortex-vite',     url: 'http://127.0.0.1:5173/api/cortex/healthz' },
  { name: 'magpie',          url: 'http://127.0.0.1:3425/v1/models' },
  { name: 'phoenix',         url: 'http://127.0.0.1:6006/' },
  { name: 'perception-vlm',  url: 'http://127.0.0.1:8940/', lazy: true },
  { name: 'emotion-ser',     url: 'http://127.0.0.1:8941/', lazy: true },
  { name: 'speaches',        url: 'http://127.0.0.1:8932/health', lazy: true },
  { name: 'mlx-lm',          url: 'http://127.0.0.1:8931/v1/models', lazy: true },
  { name: 'parakeet-stt',    url: 'http://127.0.0.1:8179/', lazy: true },
  { name: 'chatterbox-tts',  url: 'http://127.0.0.1:8920/', lazy: true },
  { name: 'imsg-rpc',        url: 'http://127.0.0.1:8930/', lazy: true },
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
  // Capacity denominator = always-on infra only. Lazy sidecars are
  // expected-dark by design; counting them makes every idle moment a
  // permanent warning (alarm fatigue — the worst kind of monitoring).
  const infraNodes = FLEET.filter(n => !n.lazy);
  const infraUp = infraNodes.filter(n => state.get(n.name)!.lastUp).length;
  const uptimeRatio = upNodes.length / FLEET.length;
  const infraUptimeRatio = infraUp / infraNodes.length;

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
    coherenceScore = clamp01(R * infraUptimeRatio); // expected-dark lazy nodes don't decohere
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
      gpd = fitGPD_PWM(exceedances, threshold, exceedances.length / allLat.length);
      const q99 = tailQuantileFromGPD(0.99, gpd);
      const q999 = tailQuantileFromGPD(0.999, gpd);
      if (!Number.isFinite(q99) || !Number.isFinite(q999)) {
        throw new Error('non-finite tail quantile — treating as insufficient exceedances');
      }
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

  const lazyDown = FLEET.filter(n => n.lazy && !state.get(n.name)!.lastUp).map(n => n.name);
  const infraDown = infraNodes.filter(n => !state.get(n.name)!.lastUp).map(n => n.name);
  return {
    ts: new Date().toISOString(),
    cycle,
    fleetSize: FLEET.length,
    nodesUp: upNodes.length,
    uptimeRatio: +uptimeRatio.toFixed(3),
    infraUp,
    infraTotal: infraNodes.length,
    infraUptimeRatio: +infraUptimeRatio.toFixed(3),
    // Honest capacity view: lazy sidecars dark by design (RAM conservation)
    // are expected-dark, not failures. Consumers must read infraDown for
    // real outages — uptimeRatio alone makes idle-by-design look broken.
    lazyDark: lazyDown,
    infraDown,
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

// ── Shadow-mode actuation ──────────────────────────────────────────
// The controller's would-be actions are computed and logged every cycle
// but NEVER executed — observe mode stays observe. Each recommendation
// carries the actuator hint the patent framework defines (micro-delay,
// batch sizing, coupling, pre-warm) so the Dec-3 gate can validate
// predictions against real events in recommendations.jsonl.

interface Recommendation {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  actuator: 'micro_delay' | 'batch_size' | 'coupling' | 'prewarm' | 'reroute';
  target: string | null;
  rationale: string;
  wouldDo: string;
}

function deriveRecommendations(snap: any): Recommendation[] {
  const recs: Recommendation[] = [];
  const r = snap.resonance;
  const nodes: Record<string, { up: boolean; latencyMs: number | null }> = snap.nodes;

  const upLat = Object.values(nodes)
    .filter(n => n.up && n.latencyMs !== null)
    .map(n => n.latencyMs as number)
    .sort((a, b) => a - b);
  const medianLat = upLat.length ? upLat[Math.floor(upLat.length / 2)] : null;
  const slowest = Object.entries(nodes)
    .filter(([, n]) => n.up && n.latencyMs !== null)
    .sort((a, b) => (b[1].latencyMs as number) - (a[1].latencyMs as number))[0]?.[0] ?? null;

  // Tail degradation — the headline signal
  if (r.tailHealthScore !== null && r.tailHealthScore < 0.5) {
    const sev = r.tailHealthScore < 0.3 ? 'critical' : 'warn';
    recs.push({
      id: 'tail-degraded', severity: sev, actuator: 'prewarm', target: slowest,
      rationale: `tailHealth=${r.tailHealthScore} Q99=${r.tailQuantiles?.q99 ?? '?'}ms — extreme latencies rising above GPD model`,
      wouldDo: `pre-warm ${slowest ?? 'slowest node'} model weights; suggest +${Math.round((1 - r.tailHealthScore) * 60)}ms micro-delay budget on interactive path`,
    });
  }

  // Fleet decoherence — phases drifting
  if (r.scoredNodes >= 3 && r.R < 0.75) {
    recs.push({
      id: 'fleet-decoherence', severity: r.R < 0.5 ? 'critical' : 'warn',
      actuator: 'coupling', target: slowest,
      rationale: `R=${r.R} σθ=${r.sigmaTheta} across ${r.scoredNodes} nodes — timing homogeneity breaking down`,
      wouldDo: `raise coupling K toward ${Math.min(2.5, +(r.couplingK * 1.5).toFixed(2))}; investigate ${slowest ?? 'phase outlier'}`,
    });
  }

  // Rhythm anomaly — too rigid or too noisy
  if (r.entropyState === 'too_noisy' || r.entropyState === 'too_rigid') {
    recs.push({
      id: 'rhythm-anomaly', severity: 'warn', actuator: 'batch_size', target: null,
      rationale: `spectral entropy ${r.spectralEntropy} = ${r.entropyState} — fleet latency rhythm outside healthy band`,
      wouldDo: r.entropyState === 'too_noisy'
        ? 'reduce batch sizes / stagger probe-aligned work to smooth bursts'
        : 'fleet suspiciously metronomic — check for synchronized stall pattern',
    });
  }

  // Single-node thermal outlier — one service 3x slower than fleet median
  if (medianLat !== null && slowest) {
    const slowLat = nodes[slowest].latencyMs as number;
    if (slowLat > medianLat * 3 && slowLat > 500) {
      recs.push({
        id: 'node-outlier', severity: 'warn', actuator: 'reroute', target: slowest,
        rationale: `${slowest} latency ${slowLat}ms vs fleet median ${medianLat}ms`,
        wouldDo: `reroute non-critical ${slowest} traffic to healthy peer or queue behind micro-delay`,
      });
    }
  }

  // Capacity — majority of always-on infra dark (lazy sidecars excluded:
  // they're expected-dark by design, not a degradation signal)
  const capRatio = snap.infraUptimeRatio ?? snap.uptimeRatio;
  const capUp = snap.infraUp ?? snap.nodesUp;
  const capTotal = snap.infraTotal ?? snap.fleetSize;
  if (capRatio < 0.6 && capUp >= 1) {
    recs.push({
      id: 'capacity-degraded', severity: capRatio < 0.4 ? 'critical' : 'warn',
      actuator: 'reroute', target: null,
      rationale: `only ${capUp}/${capTotal} always-on nodes up (infra ratio ${capRatio})`,
      wouldDo: 'consolidate traffic onto live infra nodes; suppress work targeting down services',
    });
  }

  return recs;
}

// Recommendation-set change detection — log only on transitions so
// recommendations.jsonl is an event timeline, not 8,640 identical lines/day.
let lastRecSignature = '';
function logRecommendationTransitions(snap: any, recs: Recommendation[]) {
  const sig = recs.map(x => `${x.id}:${x.severity}`).sort().join('|');
  if (sig === lastRecSignature) return;
  lastRecSignature = sig;
  try {
    fs.appendFileSync(RECS, JSON.stringify({
      ts: snap.ts, cycle: snap.cycle, mode: 'shadow',
      active: recs,
      context: {
        R: snap.resonance.R, tail: snap.resonance.tailHealthScore,
        entropy: snap.resonance.spectralEntropy, up: snap.nodesUp,
      },
    }) + '\n');
    const lines = fs.readFileSync(RECS, 'utf8').trim().split('\n');
    if (lines.length > RECS_CAP) fs.writeFileSync(RECS, lines.slice(-RECS_CAP).join('\n') + '\n');
  } catch {}
  if (recs.length) {
    console.log(`[resonance] SHADOW ${recs.map(x => `${x.id}(${x.severity})->${x.target ?? 'fleet'}`).join(', ')}`);
  }
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
  const recs = cycle >= WARMUP_CYCLES ? deriveRecommendations(snap) : [];
  (snap as any).shadow = { mode: 'observe', active: recs, note: 'recommendations computed, never actuated — validation window until Dec-3 gate' };
  persist(snap);
  logRecommendationTransitions(snap, recs);
  const r = snap.resonance;
  console.log(`[resonance] cycle ${cycle} — up ${snap.nodesUp}/${snap.fleetSize} | R=${r.R} agg=${r.aggregateScore} σθ=${r.sigmaTheta} H=${r.spectralEntropy}(${r.entropyState}) K=${r.couplingK} tail=${r.tailHealthScore ?? 'warming'}`);
}

console.log(`[resonance] observer started — ${FLEET.length} nodes, ${POLL_MS / 1000}s cadence, warmup ${WARMUP_CYCLES} cycles`);
tick();
setInterval(tick, POLL_MS);
