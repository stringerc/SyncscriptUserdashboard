// valence-memory.ts — affect-tagged outcome memory (preference learning).
//
// Episodic binding stores WHAT ignited; this stores how it RESOLVED.
// Every outcome event — task completion/failure, commitment kept/missed,
// drift finding, verification resolution — is tagged with an outcome
// valence in [-1,1]. Over time this becomes a preference signal: the
// simulator can prefer action classes whose historical outcomes were
// positively valenced — trajectories that reduced prediction error.
//
// Tails the same JSONL telemetry the world model reads; dedupes by id.
// State: .cortex-runtime/valence-memory.jsonl + offsets in
//        .cortex-runtime/valence-memory-state.json
import fs from 'node:fs';
import path from 'node:path';
import { CLASS_OF, type ActionClass } from './planner';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME, 'valence-memory.jsonl');
const STATE = path.join(RUNTIME, 'valence-memory-state.json');
const MAX_RECORDS = 800;

export interface ValenceRecord {
  id: string;
  ts: number;
  /** What produced the outcome. */
  source: 'task' | 'commitment' | 'drift' | 'verification' | 'forecast';
  actionClass?: ActionClass;
  kind: string;
  title: string;
  /** -1 (bad) .. +1 (good) — measured from the outcome, not felt. */
  valence: number;
  /** What was expected — 'positive' | 'negative' | 'neutral'. */
  expectation: string;
}

interface VState { offsets: Record<string, number>; seen: string[] }
function loadState(): VState {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { offsets: {}, seen: [] }; }
}
function saveState(s: VState) {
  try { fs.writeFileSync(STATE, JSON.stringify(s)); } catch {}
}
function append(r: ValenceRecord) {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify(r) + '\n');
    const lines = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean);
    if (lines.length > MAX_RECORDS) fs.writeFileSync(FILE, lines.slice(-MAX_RECORDS).join('\n') + '\n');
  } catch {}
}

function tail(file: string, st: VState): any[] {
  const fp = path.join(RUNTIME, file);
  try {
    const size = fs.statSync(fp).size;
    const off = st.offsets[file] ?? Math.max(0, size - 300_000);
    if (size <= off) return [];
    const fd = fs.openSync(fp, 'r');
    const buf = Buffer.alloc(size - off);
    fs.readSync(fd, buf, 0, buf.length, off);
    fs.closeSync(fd);
    st.offsets[file] = size;
    return buf.toString('utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/** Classify an outcome event into a valence record, or null if not
 *  an outcome-bearing event. */
function classify(ev: any, source: ValenceRecord['source']): ValenceRecord | null {
  const kind = String(ev?.kind || ev?.event || ev?.type || ev?.status || '');
  const status = String(ev?.status || ev?.outcome || '');
  const text = `${kind} ${status} ${ev?.title || ev?.text || ''}`.toLowerCase();
  const ts = Number(ev?.ts || ev?.createdAt || ev?.finishedAt || ev?.resolvedAt || Date.now());
  const id = String(ev?.id || `${source}-${ts}-${Math.random().toString(36).slice(2, 6)}`);

  let valence: number | null = null;
  let expectation = 'neutral';

  if (source === 'task') {
    if (/completed|done|finished|resolved/.test(`${kind} ${status}`) && !/fail|error|cancel/.test(`${kind} ${status}`)) { valence = 0.6; expectation = 'positive'; }
    else if (/failed|error|cancel/.test(`${kind} ${status}`)) { valence = -0.7; expectation = 'positive'; } // expected to work
    else return null;
  } else if (source === 'commitment') {
    if (/kept|resolved.*kept/.test(text)) { valence = 0.7; expectation = 'positive'; }
    else if (/missed|overdue|broken/.test(text)) { valence = -0.8; expectation = 'positive'; }
    else return null;
  } else if (source === 'drift') {
    if (/drift|stall|diversion|decay/.test(kind)) { valence = -0.6; expectation = 'neutral'; }
    else return null;
  } else if (source === 'verification') {
    if (/resolved|achieved/.test(text)) { valence = 0.7; expectation = 'positive'; }
    else if (/escalat/.test(text)) { valence = -0.5; expectation = 'negative'; }
    else return null;
  } else if (source === 'forecast') {
    if (/hit|achieved/.test(text)) { valence = 0.6; expectation = 'positive'; }
    else if (/miss/.test(text)) { valence = -0.5; expectation = 'positive'; }
    else return null;
  }
  if (valence === null) return null;
  return {
    id, ts, source,
    actionClass: CLASS_OF(String(ev?.kind || ev?.agentKind || ''), String(ev?.title || '')),
    kind: String(ev?.kind || kind || source),
    title: String(ev?.title || ev?.text || '').slice(0, 100),
    valence, expectation,
  };
}

/** Fold new outcome events into valence memory. Returns count added. */
export function learnValence(): number {
  const st = loadState();
  const seen = new Set(st.seen);
  let added = 0;
  const sources: Array<[string, ValenceRecord['source']]> = [
    ['task-archive.jsonl', 'task'],
    ['goal-drift.jsonl', 'drift'],
    ['goal-verification.json', 'verification'],
    ['goal-forecast-log.jsonl', 'forecast'],
  ];
  for (const [file, src] of sources) {
    // goal-verification.json is a single object — handle as one event
    if (file === 'goal-verification.json') {
      try {
        const v = JSON.parse(fs.readFileSync(path.join(RUNTIME, file), 'utf8'));
        for (const [gid, rec] of Object.entries(v?.resolved || {})) {
          const r = classify({ ...((rec as any) || {}), id: `ver-${gid}`, kind: 'verification', title: `verification ${gid}` }, src);
          if (r && !seen.has(r.id)) { append(r); seen.add(r.id); st.seen.push(r.id); added++; }
        }
      } catch {}
      continue;
    }
    for (const ev of tail(file, st)) {
      const r = classify(ev, src);
      if (!r || seen.has(r.id)) continue;
      append(r); seen.add(r.id); st.seen.push(r.id); added++;
    }
  }
  // Commitment resolutions live in commitments state, not jsonl — scan open+recent
  try {
    const cm = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'commitments.json'), 'utf8'));
    const all = [...(cm.open || []), ...(cm.resolved || [])];
    for (const c of all.slice(-100)) {
      if (!c.resolvedAt) continue;
      const id = `commit-${c.id}`;
      if (seen.has(id)) continue;
      const r: ValenceRecord = {
        id, ts: c.resolvedAt, source: 'commitment',
        actionClass: CLASS_OF('', c.text || ''),
        kind: 'commitment', title: String(c.text || '').slice(0, 100),
        valence: c.outcome === 'kept' ? 0.7 : -0.8,
        expectation: 'positive',
      };
      append(r); seen.add(id); st.seen.push(id); added++;
    }
  } catch {}
  if (st.seen.length > 2000) st.seen = st.seen.slice(-2000);
  saveState(st);
  return added;
}

function all(): ValenceRecord[] {
  try {
    return fs.readFileSync(FILE, 'utf8').trim().split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as ValenceRecord[];
  } catch { return []; }
}

/** Preference signal for an action class: mean outcome valence.
 *  Positive = historically good outcomes → simulator lowers its G.
 *  Returns null when evidence is too thin to claim a preference. */
export function valencePrior(cls: ActionClass): { mean: number; n: number } | null {
  const recs = all().filter((r) => r.actionClass === cls);
  if (recs.length < 3) return null;
  const mean = recs.reduce((a, r) => a + r.valence, 0) / recs.length;
  return { mean: Math.round(mean * 100) / 100, n: recs.length };
}

/** Recent affect arc — what the last N outcomes felt like overall. */
export function recentValenceArc(limit = 20): { mean: number; trend: 'improving' | 'declining' | 'stable'; n: number } {
  const recs = all().slice(-limit);
  if (!recs.length) return { mean: 0, trend: 'stable', n: 0 };
  const mean = recs.reduce((a, r) => a + r.valence, 0) / recs.length;
  const half = Math.floor(recs.length / 2);
  const early = recs.slice(0, half), late = recs.slice(half);
  const eMean = early.length ? early.reduce((a, r) => a + r.valence, 0) / early.length : 0;
  const lMean = late.length ? late.reduce((a, r) => a + r.valence, 0) / late.length : 0;
  const trend = lMean - eMean > 0.15 ? 'improving' : lMean - eMean < -0.15 ? 'declining' : 'stable';
  return { mean: Math.round(mean * 100) / 100, trend, n: recs.length };
}

export function valenceStats() {
  const recs = all();
  const bySource: Record<string, number> = {};
  for (const r of recs) bySource[r.source] = (bySource[r.source] || 0) + 1;
  return { total: recs.length, bySource, arc: recentValenceArc() };
}
