/**
 * commitments.ts — the social ledger: promises, kept/missed, and the
 * prediction error of a crew that drifts from its word.
 *
 * Cortex asked to move from modeling the fleet to INHABITING a social
 * world: "I said I'd run the patrol by 0300, Warden said he'd review
 * the patch by morning — here's the surprise when either drifts."
 *
 * The ledger (.cortex-runtime/commitments.jsonl) records:
 *   - promiser   — 'cortex' or an agent id
 *   - promisee   — who it's owed to ('user', 'cortex', agent id)
 *   - text/dueAt — the commitment and its deadline
 *   - status     — open | kept | missed | renegotiated
 *
 * Social prediction error = the measurable surprise when a commitment
 * resolves differently than the social model expected. Kept promises
 * and on-time delivery LOWER future expectation; misses RAISE it —
 * trust is a learned parameter per agent, same math as the world model.
 *
 * Woven into: fleet-minds (trust scores), narrative self (commitment
 * arcs), planner (shared utility — keeping promises is goal-positive).
 */
import fs from 'node:fs';
import path from 'node:path';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const LEDGER = path.join(RUNTIME, 'commitments.jsonl');
const TRUST_FILE = path.join(RUNTIME, 'commitment-trust.json');

export interface Commitment {
  id: string;
  promiser: string;      // 'cortex' | agentId
  promisee: string;      // 'user' | 'cortex' | agentId
  text: string;
  madeAt: number;
  dueAt?: number;
  status: 'open' | 'kept' | 'missed' | 'renegotiated';
  resolvedAt?: number;
  taskId?: string;       // linked agent task when applicable
  note?: string;
}

interface TrustState {
  /** Per-promiser reliability: Beta(kept, missed) — the social prior. */
  agents: Record<string, { kept: number; missed: number }>;
  cortex: { kept: number; missed: number };
}

function loadLedger(): Commitment[] {
  try {
    return fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}
function append(c: Commitment) {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(LEDGER, JSON.stringify(c) + '\n');
  } catch {}
}
function loadTrust(): TrustState {
  try { return { agents: {}, cortex: { kept: 0, missed: 0 }, ...JSON.parse(fs.readFileSync(TRUST_FILE, 'utf8')) }; }
  catch { return { agents: {}, cortex: { kept: 0, missed: 0 } }; }
}
function saveTrust(t: TrustState) {
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(TRUST_FILE, JSON.stringify(t)); } catch {}
}

let counter = 0;
export function recordCommitment(opts: {
  promiser: string; promisee: string; text: string;
  dueAt?: number; taskId?: string; note?: string;
}): Commitment {
  const c: Commitment = {
    id: `commit-${Date.now().toString(36)}-${++counter}`,
    promiser: opts.promiser, promisee: opts.promisee,
    text: String(opts.text).slice(0, 200),
    madeAt: Date.now(), dueAt: opts.dueAt,
    status: 'open', taskId: opts.taskId, note: opts.note,
  };
  append(c);
  return c;
}

/** Resolve a commitment — kept/missed updates the promiser's trust
 *  prior (Beta update) AND emits a social-prediction-error record. */
export function resolveCommitment(id: string, outcome: 'kept' | 'missed' | 'renegotiated', note?: string): Commitment | null {
  const ledger = loadLedger();
  const c = ledger.find((x) => x.id === id && x.status === 'open');
  if (!c) return null;
  c.status = outcome === 'renegotiated' ? 'renegotiated' : outcome;
  c.resolvedAt = Date.now();
  c.note = note;
  append({ ...c, id: `${c.id}-resolved` }); // append-only resolution record
  if (outcome === 'kept' || outcome === 'missed') {
    const t = loadTrust();
    const bucket = c.promiser === 'cortex' ? t.cortex : (t.agents[c.promiser] ||= { kept: 0, missed: 0 });
    bucket[outcome === 'kept' ? 'kept' : 'missed']++;
    saveTrust(t);
    // Social prediction error record — the fleet learns who keeps word.
    append({
      ...c, id: `${c.id}-spe`, status: 'open',
      note: `social-prediction-error: ${c.promiser} ${outcome === 'kept' ? 'kept' : 'MISSED'} "${c.text.slice(0, 60)}" owed to ${c.promisee}`,
    } as Commitment);
  }
  return c;
}

/** Auto-resolve open commitments whose linked task finished. */
export function reconcileCommitments(taskId: string, taskStatus: string): number {
  const ledger = loadLedger();
  let n = 0;
  for (const c of ledger) {
    if (c.taskId === taskId && c.status === 'open') {
      if (taskStatus === 'completed' || taskStatus === 'done') { resolveCommitment(c.id, 'kept', `task ${taskId} completed`); n++; }
      else if (taskStatus === 'failed' || taskStatus === 'cancelled') { resolveCommitment(c.id, 'missed', `task ${taskId} ${taskStatus}`); n++; }
    }
  }
  return n;
}

/** Sweep for due-passed open commitments → missed. */
export function sweepOverdue(now = Date.now()): number {
  const ledger = loadLedger();
  let n = 0;
  for (const c of ledger) {
    if (c.status === 'open' && c.dueAt && c.dueAt < now) {
      resolveCommitment(c.id, 'missed', 'due date passed without resolution');
      n++;
    }
  }
  return n;
}

export function listCommitments(filter?: { status?: string; promiser?: string; promisee?: string }) {
  let all = loadLedger().filter((c) => !c.id.endsWith('-resolved') && !c.id.endsWith('-spe'));
  // dedupe: latest resolution wins
  const resolved = new Set(loadLedger().filter((c) => c.id.endsWith('-resolved')).map((c) => c.id.replace(/-resolved$/, '')));
  all = all.filter((c) => !resolved.has(c.id) || c.status === 'open');
  if (filter?.status) all = all.filter((c) => c.status === filter.status);
  if (filter?.promiser) all = all.filter((c) => c.promiser === filter.promiser);
  if (filter?.promisee) all = all.filter((c) => c.promisee === filter.promisee);
  return all.sort((a, b) => b.madeAt - a.madeAt).slice(0, 100);
}

/** Trust score per promiser: P(kept) with Beta prior — the social
 *  prediction the planner and fleet-minds consume. */
export function trustScores() {
  const t = loadTrust();
  const score = (k: number, m: number) => Math.round(((k + 1) / (k + m + 2)) * 100) / 100;
  const agents: Record<string, { kept: number; missed: number; trust: number }> = {};
  for (const [id, s] of Object.entries(t.agents)) agents[id] = { ...s, trust: score(s.kept, s.missed) };
  return { cortex: { ...t.cortex, trust: score(t.cortex.kept, t.cortex.missed) }, agents };
}

/** Shared-utility hook for the planner: does this candidate help keep
 *  an open commitment? Returns a utility bonus in [-0.5, +0.5]. */
export function commitmentUtility(agentId: string, kind: string, title: string): number {
  const open = listCommitments({ status: 'open', promiser: agentId });
  if (!open.length) return 0;
  const text = `${kind} ${title}`.toLowerCase();
  // Match commitment text keywords against the task — loose but honest.
  const relevant = open.filter((c) => {
    const words = c.text.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    return words.some((w) => text.includes(w));
  });
  if (!relevant.length) return 0;
  const overdue = relevant.some((c) => c.dueAt && c.dueAt < Date.now());
  return overdue ? 0.4 : 0.2; // keeping an overdue promise is worth more
}
