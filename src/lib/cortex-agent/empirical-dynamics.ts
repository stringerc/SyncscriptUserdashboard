// empirical-dynamics.ts — learned action→dim transition dynamics.
//
// The planner's effect priors were stated assumptions. This module
// closes the loop: it pairs completed task outcomes with the world
// model's dim-snapshot ring, building (state, action, next-state)
// triples, then runs a Bayesian update per (actionClass, dim) so the
// planner reasons over MEASURED dynamics with honest posterior
// uncertainty — not fixed priors.
//
// Honest framing: deltas are associational — dims drift from ALL
// telemetry during a task window, so effects are "observed during"
// not "caused by". Confidence scales with n and window quality; thin
// dims stay flagged 'assumed' and feed the planner's ambiguity term.
//
// State: .cortex-runtime/dynamics-learned.json
//   effects[cls][dim] = { n, mean, m2 }  (Welford → Normal posterior)
//   processed: task ids already folded in (dedup across runs)
//   emitted:  (cls,dim) keys already announced to inner speech
import fs from 'node:fs';
import path from 'node:path';
import { DIMS, loadWorld, type Dim, type WorldState } from './world-model';
import { ACTION_PRIORS, CLASS_OF, type ActionClass } from './planner';
import { speakInner } from './inner-speech';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME, 'dynamics-learned.json');
const TASK_ARCHIVE = path.join(RUNTIME, 'task-archive.jsonl');

/** Equivalent prior sample size — how much data outweighs the prior. */
const PRIOR_N = 4;
/** Minimum pairs before a dim counts as 'learned' rather than 'assumed'. */
const MIN_LEARNED_N = 3;
/** Snapshot must bracket the task within this window (ms). */
const SNAP_TOLERANCE = 10 * 60_000;
/** Posterior sd floor — even infinite data keeps ±this much noise. */
const SD_FLOOR = 0.01;

interface EffectStat { n: number; mean: number; m2: number }
interface DynamicsState {
  effects: Partial<Record<ActionClass, Partial<Record<Dim, EffectStat>>>>;
  processed: string[];
  emitted: string[];
  lastLearnTs: number;
}

function fresh(): DynamicsState { return { effects: {}, processed: [], emitted: [], lastLearnTs: 0 }; }

export function loadDynamics(): DynamicsState {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return {
      effects: raw.effects || {},
      processed: Array.isArray(raw.processed) ? raw.processed.slice(-2000) : [],
      emitted: Array.isArray(raw.emitted) ? raw.emitted.slice(-2000) : [],
      lastLearnTs: raw.lastLearnTs || 0,
    };
  } catch { return fresh(); }
}
function save(s: DynamicsState) {
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s)); } catch {}
}

// ── Posterior: Normal with unknown variance, prior = ACTION_PRIORS ────
// Conjugate update per observation x (dim delta):
//   posterior mean = (PRIOR_N·prior + n·x̄) / (PRIOR_N + n)
//   posterior var = (m2 + PRIOR_N·(x̄−prior)²·n/(PRIOR_N+n)) / (PRIOR_N+n−1)... simplified:
// we use the standard shrinkage form — honest and stable at small n.

export interface EffectPosterior {
  cls: ActionClass; dim: Dim;
  /** Posterior mean effect (delta per action). */
  mean: number;
  /** Posterior sd — the planner's ambiguity input. */
  sd: number;
  n: number;
  /** 'learned' when n ≥ MIN_LEARNED_N, else 'assumed'. */
  source: 'learned' | 'assumed';
  prior: number;
}

/** Posterior for one (class, dim). Returns null only for unknown dims. */
export function effectPosterior(cls: ActionClass, dim: Dim, st?: DynamicsState): EffectPosterior {
  const s = st || loadDynamics();
  const prior = ACTION_PRIORS[cls]?.[dim] ?? 0;
  const stat = s.effects[cls]?.[dim];
  const n = stat?.n || 0;
  if (n === 0) {
    // Pure prior — uncertainty reflects "we have no data on this".
    return { cls, dim, mean: prior, sd: 0.2, n: 0, source: 'assumed', prior };
  }
  // Welford → sample stats
  const sampleMean = stat!.mean;
  const sampleVar = n > 1 ? stat!.m2 / (n - 1) : 0.04; // weak default var
  // Shrinkage: prior counts as PRIOR_N pseudo-observations
  const wData = n / (n + PRIOR_N);
  const mean = prior * (1 - wData) + sampleMean * wData;
  // Posterior sd: sampling uncertainty + residual variance, floored
  const sd = Math.max(SD_FLOOR, Math.sqrt(sampleVar / (n + PRIOR_N) + 0.002));
  return { cls, dim, mean: Math.round(mean * 10000) / 10000, sd: Math.round(sd * 10000) / 10000, n, source: n >= MIN_LEARNED_N ? 'learned' : 'assumed', prior };
}

/** Mean posterior uncertainty across the dims an action class moves —
 *  the planner's epistemic ambiguity term. */
export function dynamicsUncertainty(cls: ActionClass, st?: DynamicsState): number {
  const s = st || loadDynamics();
  const dims = new Set<Dim>([...(Object.keys(ACTION_PRIORS[cls] || {}) as Dim[]), ...(Object.keys(s.effects[cls] || {}) as Dim[])]);
  if (!dims.size) return 0.2;
  let sum = 0;
  for (const d of dims) sum += effectPosterior(cls, d, s).sd;
  return sum / dims.size;
}

/** Learned effect vector for applyAction — posteriors where data exists. */
export function learnedEffects(cls: ActionClass, st?: DynamicsState): Partial<Record<Dim, number>> {
  const s = st || loadDynamics();
  const out: Partial<Record<Dim, number>> = {};
  const dims = new Set<Dim>([...(Object.keys(ACTION_PRIORS[cls] || {}) as Dim[]), ...(Object.keys(s.effects[cls] || {}) as Dim[])]);
  for (const d of dims) {
    const p = effectPosterior(cls, d, s);
    if (p.n > 0) out[d] = p.mean; // learned dims override prior
  }
  return out;
}

// ── Pairing: task windows → snapshot deltas ────────────────────────────
function nearestSnap(snaps: Array<{ ts: number; dims: Record<Dim, number> }>, ts: number, dir: 'before' | 'after'): { ts: number; dims: Record<Dim, number> } | null {
  let best: { ts: number; dims: Record<Dim, number> } | null = null;
  for (const s of snaps) {
    if (dir === 'before' && s.ts <= ts && (!best || s.ts > best.ts)) best = s;
    if (dir === 'after' && s.ts >= ts && (!best || s.ts < best.ts)) best = s;
  }
  return best;
}

function welfordAdd(stat: EffectStat | undefined, x: number): EffectStat {
  if (!stat) return { n: 1, mean: x, m2: 0 };
  const n = stat.n + 1;
  const delta = x - stat.mean;
  const mean = stat.mean + delta / n;
  const m2 = stat.m2 + delta * (x - mean);
  return { n, mean, m2 };
}

/** Fold newly-completed tasks into the dynamics estimate. Returns count
 *  of new (task × dim) observations absorbed. */
export function learnDynamics(world?: WorldState): { paired: number; skipped: number; learnedDims: number } {
  const s = loadDynamics();
  const w = world || loadWorld();
  const snaps = w.snapshots || [];
  if (!snaps.length) return { paired: 0, skipped: 0, learnedDims: 0 };

  let raw = '';
  try { raw = fs.readFileSync(TASK_ARCHIVE, 'utf8'); } catch { return { paired: 0, skipped: 0, learnedDims: 0 }; }
  const lines = raw.trim().split('\n');
  // Only scan the tail — old tasks lack snapshot coverage anyway
  const tail = lines.slice(-400);
  const seen = new Set(s.processed);
  let paired = 0, skipped = 0, newLearned = 0;

  for (const line of tail) {
    let t: any; try { t = JSON.parse(line); } catch { continue; }
    const id = String(t.id || '');
    if (!id || seen.has(id)) continue;
    const status = String(t.status || '');
    if (status !== 'completed' && status !== 'failed') { skipped++; continue; }
    const start = Number(t.startedAt || t.createdAt || 0);
    const end = Number(t.finishedAt || t.completedAt || t.updatedAt || 0);
    if (!start || !end || end <= start) { skipped++; continue; }

    const pre = nearestSnap(snaps, start, 'before');
    const post = nearestSnap(snaps, end, 'after');
    if (!pre || !post || post.ts - pre.ts > 45 * 60_000) { skipped++; seen.add(id); s.processed.push(id); continue; }
    if (Math.abs(pre.ts - start) > SNAP_TOLERANCE || Math.abs(post.ts - end) > SNAP_TOLERANCE) { skipped++; seen.add(id); s.processed.push(id); continue; }

    const cls = CLASS_OF(String(t.kind || ''), String(t.title || ''));
    s.effects[cls] = s.effects[cls] || {};
    for (const d of DIMS) {
      const delta = (post.dims[d] ?? 0.5) - (pre.dims[d] ?? 0.5);
      if (Math.abs(delta) < 0.001) continue;
      s.effects[cls]![d] = welfordAdd(s.effects[cls]![d], delta);
      paired++;
      // Learning event: first crossing into 'learned', or a large shift
      const key = `${cls}:${d}`;
      const p = effectPosterior(cls, d, s);
      if (!s.emitted.includes(key) && p.n >= MIN_LEARNED_N) {
        s.emitted.push(key);
        const prior = ACTION_PRIORS[cls]?.[d] ?? 0;
        const dir = p.mean > prior + 0.02 ? 'raises' : p.mean < prior - 0.02 ? 'lowers' : '≈prior on';
        speakInner({
          kind: 'reasoning', source: 'empirical-dynamics',
          text: `Learned: ${cls} ${dir} ${d} by ${p.mean >= 0 ? '+' : ''}${p.mean.toFixed(2)} ± ${p.sd.toFixed(2)} (n=${p.n}) — prior assumed ${prior >= 0 ? '+' : ''}${prior.toFixed(2)}`,
          surprise: Math.min(1, Math.abs(p.mean - prior) * 4),
          valence: p.mean > 0 ? 0.1 : -0.1,
        });
        newLearned++;
      }
    }
    seen.add(id); s.processed.push(id);
  }
  if (s.processed.length > 2000) s.processed = s.processed.slice(-2000);
  if (s.emitted.length > 2000) s.emitted = s.emitted.slice(-2000);
  s.lastLearnTs = Date.now();
  save(s);
  const learnedDims = Object.values(s.effects).reduce((a, e) => a + Object.values(e || {}).filter((x) => (x?.n || 0) >= MIN_LEARNED_N).length, 0);
  return { paired, skipped, learnedDims: learnedDims + newLearned };
}

/** Full report for endpoints/UI — every class's learned-vs-assumed map. */
export function dynamicsReport(world?: WorldState) {
  const s = loadDynamics();
  const w = world || loadWorld();
  const classes = Object.keys(ACTION_PRIORS) as ActionClass[];
  return {
    generatedAt: Date.now(),
    lastLearnTs: s.lastLearnTs,
    processedTasks: s.processed.length,
    classes: classes.map((cls) => {
      const dims = new Set<Dim>([...(Object.keys(ACTION_PRIORS[cls] || {}) as Dim[]), ...(Object.keys(s.effects[cls] || {}) as Dim[])]);
      const effects = [...dims].map((d) => effectPosterior(cls, d, s));
      return {
        cls,
        uncertainty: Math.round(dynamicsUncertainty(cls, s) * 1000) / 1000,
        learned: effects.filter((e) => e.source === 'learned').length,
        effects: effects.sort((a, b) => b.n - a.n),
      };
    }),
    snapshots: (w.snapshots || []).length,
    minLearnedN: MIN_LEARNED_N,
  };
}
