/**
 * world-model.ts — the living strategic latent state.
 *
 * Cortex asked for a continuously-updated compressed representation that
 * answers "what matters right now?" without being asked — reactive
 * sensors fire, but nothing holds a persistent, queryable understanding
 * across context switches.
 *
 * Honest engineering, no pretend-neural:
 *   - Latent vector = EMA sufficient statistics over REAL telemetry
 *     (goal-drift, task-archive, verification, pace-watch, interoception,
 *     attention-trace, forecast log). Every stream we already write is
 *     tailed by byte-offset — zero new instrumentation.
 *   - "Training" = an online linear outcome model over the latent dims:
 *     w += lr·(label − σ(w·x))·x — a real gradient step on real labels
 *     (goal-positive vs goal-negative outcomes). Differentiable: the
 *     governance loop can read ∂utility/∂dim directly.
 *   - Uncertainty is split honestly:
 *       epistemic  — per-dim evidence counts; sparse dims get wide error
 *       aleatoric  — Beta(α,β) outcome variance; irreducible noise
 *   - Queryable: keyword→dimension retrieval + learned-weight narrative.
 *   - Governance advisory: scoreDispatch() estimates goal-utility of a
 *     candidate action — judgment as a score, policy as the gate.
 *
 * State: .cortex-runtime/world-model.json (dims, weights, offsets, stats)
 */
import fs from 'node:fs';
import path from 'node:path';
import { getInteroceptiveState } from './interoceptive';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const STATE_FILE = path.join(RUNTIME, 'world-model.json');
const LR = 0.08;
const EMA_ALPHA = 0.25;
const POSITIVE_KINDS = new Set(['verification_resolved', 'goal_achieved', 'ops_done', 'forecast_hit']);
const NEGATIVE_KINDS = new Set(['verification_escalated', 'diversion', 'stall', 'forecast_miss', 'decay']);

// ── Latent dimensions ─────────────────────────────────────────────────
export const DIMS = [
  'goalPressure',   // active goals + open ops weight
  'driftRisk',      // recent drift findings
  'paceHealth',     // accepted-trajectory adherence
  'capacity',       // interoceptive headroom
  'surprise',       // somatic prediction error
  'hostLoad',       // machine busyness
  'attentionLoad',  // signal competition pressure
  'executionFlow',  // task completion throughput
  'verification',   // corrective loop health
  'forecastRisk',   // P(miss) across active forecasts
  'engagement',     // recent interaction/ambient rate
] as const;
export type Dim = typeof DIMS[number];

interface WorldState {
  dims: Record<Dim, number>;
  /** EMA counts — evidence mass behind each dim (epistemic proxy). */
  evidence: Record<Dim, number>;
  /** Online linear weights: dim → outcome correlation. */
  weights: Record<Dim, number>;
  /** Beta outcome stats: successes/failures of goal-positive events. */
  outcomes: { alpha: number; beta: number };
  /** Byte offsets per tailed file. */
  offsets: Record<string, number>;
  observations: number;
  lastUpdate: number;
}

function freshState(): WorldState {
  const dims = {} as Record<Dim, number>;
  const evidence = {} as Record<Dim, number>;
  const weights = {} as Record<Dim, number>;
  for (const d of DIMS) { dims[d] = 0.5; evidence[d] = 0; weights[d] = 0; }
  return { dims, evidence, weights, outcomes: { alpha: 1, beta: 1 }, offsets: {}, observations: 0, lastUpdate: 0 };
}

export function loadWorld(): WorldState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const base = freshState();
    return {
      ...base, ...raw,
      dims: { ...base.dims, ...(raw.dims || {}) },
      evidence: { ...base.evidence, ...(raw.evidence || {}) },
      weights: { ...base.weights, ...(raw.weights || {}) },
      outcomes: { ...(base.outcomes), ...(raw.outcomes || {}) },
      offsets: raw.offsets || {},
    };
  } catch { return freshState(); }
}
function saveWorld(s: WorldState) {
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s)); } catch {}
}

// ── Telemetry tailing ──────────────────────────────────────────────────
function tailJsonl(file: string, state: WorldState): any[] {
  const fp = path.join(RUNTIME, file);
  try {
    const size = fs.statSync(fp).size;
    const off = state.offsets[file] ?? Math.max(0, size - 200_000); // first run: last ~200KB
    if (size <= off) return [];
    const fd = fs.openSync(fp, 'r');
    const buf = Buffer.alloc(size - off);
    fs.readSync(fd, buf, 0, buf.length, off);
    fs.closeSync(fd);
    state.offsets[file] = size;
    return buf.toString('utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

function bump(state: WorldState, dim: Dim, target: number, strength = 1) {
  state.dims[dim] = Math.round((state.dims[dim] + (target - state.dims[dim]) * EMA_ALPHA * strength) * 1000) / 1000;
  state.evidence[dim] = Math.min(1000, state.evidence[dim] + strength);
}

/** One online gradient step: pull weights toward predicting the outcome. */
function learn(state: WorldState, label: number) {
  const x = state.dims;
  let z = 0;
  for (const d of DIMS) z += (state.weights[d] || 0) * x[d];
  const p = 1 / (1 + Math.exp(-z));
  const err = label - p;
  for (const d of DIMS) state.weights[d] = Math.round(((state.weights[d] || 0) + LR * err * x[d]) * 10000) / 10000;
  if (label === 1) state.outcomes.alpha += 1; else state.outcomes.beta += 1;
}

/** Fold one telemetry event into the latent state + learner. */
function ingest(state: WorldState, ev: any, now: number) {
  const kind = String(ev?.kind || ev?.event || ev?.type || ev?.status || '');
  const status = String(ev?.status || ev?.outcome || '');
  const text = `${kind} ${status} ${ev?.title || ev?.text || ev?.goalTitle || ''}`.toLowerCase();
  const recent = now - Number(ev?.ts || ev?.createdAt || ev?.finishedAt || 0) < 6 * 3600_000;

  // Dim updates from event semantics
  if (/drift|stall|diversion|decay/.test(kind)) bump(state, 'driftRisk', 0.85);
  if (/verification_resolved|resolved/.test(kind)) bump(state, 'verification', 0.8);
  if (/verification_escalated|escalat/.test(kind)) bump(state, 'verification', 0.25);
  if (/completed|done|finished/.test(kind) && /task|ops/.test(text)) bump(state, 'executionFlow', 0.75);
  if (/failed|error|cancel/.test(kind)) bump(state, 'executionFlow', 0.3);
  if (/premortem|forecast/.test(kind)) bump(state, 'forecastRisk', /miss|low|risk/.test(text) ? 0.8 : 0.5);
  if (recent && /ambient|user|message|chat/.test(kind)) bump(state, 'engagement', 0.7);

  // Live dims refreshed from sibling modules (cheap reads)
  try {
    const pace = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'goal-pace-watch.json'), 'utf8'));
    const watches = Object.values(pace?.watches || {}) as any[];
    if (watches.length) {
      const ratios = watches.map((w) => (w.expected > 0 ? Math.min(1.2, w.actual / w.expected) : 1)).filter((r) => r > 0);
      if (ratios.length) bump(state, 'paceHealth', Math.min(1, ratios.reduce((a, b) => a + b, 0) / ratios.length), 0.5);
    }
  } catch {}
  try {
    const inter = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'interoceptive-history.json'), 'utf8'));
    if (Array.isArray(inter) && inter.length) {
      const last = inter[inter.length - 1];
      bump(state, 'hostLoad', Math.min(1, (last.loadAvg1m || 0) / 16), 0.4);
    }
  } catch {}

  // Learner labels — status carries task/ops outcomes; kind carries
  // lifecycle events (drift findings, verification, forecasts).
  if (POSITIVE_KINDS.has(kind) || /resolved|achieved|completed|done/.test(`${kind} ${status}`)) learn(state, 1);
  else if (NEGATIVE_KINDS.has(kind) || /escalated|diversion|stall|miss|failed|cancelled/.test(`${kind} ${status}`)) learn(state, 0);
  state.observations++;
  state.lastUpdate = now;
}

const SOURCES: Array<[string, (e: any) => string]> = [
  ['goal-drift.jsonl', (e) => e.kind || 'drift'],
  ['task-archive.jsonl', (e) => e.status || 'task'],
  ['goal-verification.json', () => 'verification'],
  ['goal-forecast-log.jsonl', (e) => e.outcome || 'forecast'],
  ['attention-trace.jsonl', () => 'attention'],
  ['libet-veto-log.jsonl', (e) => e.event || 'libet'],
];

/** Refresh the latent state from all telemetry streams. Idempotent,
 *  offset-based — safe to call on every read. */
export function observeWorld(now = Date.now()): WorldState {
  const state = loadWorld();
  for (const [file] of SOURCES) {
    // goal-verification.json is a single object, not jsonl — handle inline
    if (file === 'goal-verification.json') {
      try {
        const v = JSON.parse(fs.readFileSync(path.join(RUNTIME, file), 'utf8'));
        const pend = Object.keys(v?.pending || {}).length;
        bump(state, 'verification', pend > 0 ? 0.4 : 0.7, 0.3);
      } catch {}
      continue;
    }
    for (const ev of tailJsonl(file, state)) ingest(state, ev, now);
  }
  // Interoceptive + attention dims from live modules (import-light reads)
  try {
    const i = getInteroceptiveState(now);
    bump(state, 'capacity', i.capacity, 0.6);
    bump(state, 'surprise', i.surprise ?? 0, 0.6);
  } catch {}
  saveWorld(state);
  return state;
}

// ── Query: "what matters right now?" ───────────────────────────────────
const QUERY_DIMS: Array<[RegExp, Dim]> = [
  [/block|stuck|drift|stall|divert|behind|risk/, 'driftRisk'],
  [/pace|speed|cadence|ops|progress|ship/, 'paceHealth'],
  [/goal|quarter|launch|custody|target|deadline/, 'goalPressure'],
  [/host|memory|load|cpu|slow|strain|capacity|tired/, 'capacity'],
  [/surprise|unexpected|anomal|weird|error/, 'surprise'],
  [/forecast|predict|chance|probability|hit/, 'forecastRisk'],
  [/attention|distract|noise|focus|signal/, 'attentionLoad'],
  [/verify|corrective|escalat|intervention/, 'verification'],
  [/work|task|agent|dispatch|throughput|flow/, 'executionFlow'],
  [/engag|interact|talk|chat|user/, 'engagement'],
];

export interface WorldQueryResult {
  query: string;
  matchedDim: Dim | null;
  activation: number;
  weight: number;
  narrative: string;
  epistemicUncertainty: number;
  aleatoricUncertainty: number;
  topDims: Array<{ dim: Dim; value: number; weight: number; evidence: number }>;
}

export function queryWorldModel(q: string, state?: WorldState): WorldQueryResult {
  const s = state || observeWorld();
  const text = q.toLowerCase();
  const match = QUERY_DIMS.find(([re]) => re.test(text));
  const dim = match?.[1] ?? null;
  const topDims = DIMS
    .map((d) => ({ dim: d, value: s.dims[d], weight: s.weights[d], evidence: s.evidence[d] }))
    .sort((a, b) => Math.abs(b.weight * (b.value - 0.5)) - Math.abs(a.weight * (a.value - 0.5)))
    .slice(0, 5);

  // Uncertainty decomposition
  const epistemic = dim ? Math.round((1 / (1 + s.evidence[dim])) * 100) / 100 : null;
  const { alpha, beta } = s.outcomes;
  const aleatoric = Math.round(Math.sqrt((alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1))) * 100) / 100;

  let narrative: string;
  if (dim) {
    const v = s.dims[dim];
    const w = s.weights[dim];
    const ev = s.evidence[dim];
    const direction = v > 0.6 ? 'elevated' : v < 0.4 ? 'low' : 'moderate';
    const learned = Math.abs(w) > 0.05
      ? ` Learned association: ${w > 0 ? 'this state has preceded goal-positive outcomes' : 'this state has preceded goal-negative outcomes'} (w=${w}).`
      : ' Not enough outcome history to know if this helps or hurts goals yet.';
    const unsure = ev < 5 ? ' Evidence is thin — treat as hypothesis, not conclusion.' : '';
    narrative = `${dim} is ${direction} (${Math.round(v * 100)}%).${learned}${unsure}`;
  } else {
    const top = topDims[0];
    narrative = top
      ? `No specific dimension matched. Highest-leverage signal right now: ${top.dim} at ${Math.round(top.value * 100)}% (learned weight ${top.weight}, ${top.evidence} observations).`
      : 'World model has not observed enough telemetry yet.';
  }
  return {
    query: q, matchedDim: dim,
    activation: dim ? s.dims[dim] : 0,
    weight: dim ? s.weights[dim] : 0,
    narrative, epistemicUncertainty: epistemic ?? 0, aleatoricUncertainty: aleatoric,
    topDims,
  };
}

// ── "What matters right now" — the leverage point ─────────────────────
export function topLeverage(state?: WorldState) {
  const s = state || observeWorld();
  return DIMS
    .map((d) => ({
      dim: d, value: s.dims[d], weight: s.weights[d], evidence: s.evidence[d],
      leverage: Math.abs(s.weights[d]) * Math.abs(s.dims[d] - 0.5) * Math.min(1, s.evidence[d] / 10),
    }))
    .sort((a, b) => b.leverage - a.leverage)
    .slice(0, 3);
}

// ── Governance advisory: judgment as a score ──────────────────────────
/** Estimate goal-utility of a candidate dispatch. This is ADVISORY —
 *  the interoceptive gate remains the hard policy; this adds the
 *  learned "is this the right thing to do" term. */
export function scoreDispatch(kind: string, title: string, state?: WorldState) {
  const s = state || observeWorld();
  const text = `${kind} ${title}`.toLowerCase();
  // Action features: what dims does this action plausibly move?
  const feat: Partial<Record<Dim, number>> = {};
  if (/orchestrate|devin|build|code|sprint/.test(text)) { feat.executionFlow = 0.8; feat.goalPressure = 0.6; }
  if (/research|scout/.test(text)) { feat.driftRisk = -0.5; feat.goalPressure = 0.4; }
  if (/patrol|status|watchdog|comm/.test(text)) { feat.attentionLoad = -0.3; feat.verification = 0.3; }
  if (/corrective|verify|resolve/.test(text)) { feat.verification = 0.9; feat.driftRisk = -0.7; }
  if (/forecast|premortem/.test(text)) { feat.forecastRisk = -0.4; }
  let utility = 0;
  for (const [d, f] of Object.entries(feat) as [Dim, number][]) {
    utility += (s.weights[d] || 0) * f * (0.5 + s.dims[d]);
  }
  const evidenceMass = DIMS.reduce((a, d) => a + s.evidence[d], 0);
  return {
    utility: Math.round(utility * 1000) / 1000,
    confidence: Math.round(Math.min(1, evidenceMass / 200) * 100) / 100,
    interpretation: utility > 0.05 ? 'likely goal-positive'
      : utility < -0.05 ? 'likely goal-negative or neutral'
      : 'neutral — insufficient learned signal',
    topLeverage: topLeverage(s)[0],
  };
}
