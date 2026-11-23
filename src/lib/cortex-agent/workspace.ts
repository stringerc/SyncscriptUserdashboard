// workspace.ts — global workspace: ignition + broadcast.
//
// Cortex asked to optimize the Global Workspace. The honest gap in our
// attention schema was competition without broadcast: attend() picked
// a winner and logged why, but no module actually CONSUMED the winner.
// In Baars' terms we had ignition without broadcast — the winning
// representation never reached the processors that should act on it.
//
// This module is the missing half:
//   - IGNITION: a winner scoring above threshold with margin over the
//     runner-up "ignites" — it becomes the contents of consciousness
//     for this tick, not just a log line.
//   - BROADCAST: the ignited content is published to a durable stream
//     that world-model, planner, selfhood, and inner speech read.
//   - RECEIPTS: every broadcast records which modules consumed it, so
//     "was this signal actually used?" is answerable, not assumed.
//
// State: .cortex-runtime/workspace-broadcasts.jsonl (capped 300)
import fs from 'node:fs';
import path from 'node:path';
import type { AttentionDecision } from './attention-schema';
import { getInteroceptiveState } from './interoceptive';
import { speakInner } from './inner-speech';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME, 'workspace-broadcasts.jsonl');
const MAX = 300;

/** A winner must clear this score AND beat the runner-up by this
 *  margin to ignite — below that it's selected but not broadcast. */
const IGNITE_SCORE = 0.45;
const IGNITE_MARGIN = 0.08;

export interface Broadcast {
  id: string;
  ts: number;
  kind: string;
  text: string;
  score: number;
  margin: number;
  ignited: boolean;
  /** Somatic markers — the body state that framed this conscious moment. */
  capacity?: number;
  somaticLevel?: string;
  /** Agency attribution — did she generate this or did it happen to her? */
  agency?: 'self' | 'exogenous';
  /** Felt valence at ignition — how it felt to be aware of this. */
  valence?: number;
  /** Modules that have acknowledged consuming this broadcast. */
  consumedBy: string[];
}

let counter = 0;

function append(b: Broadcast) {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify(b) + '\n');
    const lines = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean);
    if (lines.length > MAX) fs.writeFileSync(FILE, lines.slice(-MAX).join('\n') + '\n');
  } catch {}
}

/** Called by attention-schema after every attend() decision. */
export function broadcastAttention(decision: AttentionDecision) {
  const w = decision.winner;
  const runnerUp = decision.candidates[1];
  const margin = runnerUp ? w.score - runnerUp.score : w.score;
  // Somatic markers: a strained/critical body lowers the ignition bar —
  // urgency is physiology, not metaphor. Critical capacity lets
  // system/interoception signals ignite at 0.30 instead of 0.45.
  let somatic: { capacity: number; level: string } | null = null;
  try {
    const i = getInteroceptiveState();
    somatic = { capacity: i.capacity, level: i.level };
  } catch {}
  const urgency = somatic?.level === 'critical' ? 1 : somatic?.level === 'strained' ? 0.5 : 0;
  const igniteScore = IGNITE_SCORE - 0.15 * urgency;
  const igniteMargin = IGNITE_MARGIN - 0.04 * urgency;
  const ignited = w.score >= igniteScore && margin >= igniteMargin;
  // Agency: inner speech, goals, and attention-meta are self-generated;
  // system alerts, user speech, ambient chatter, and bodily signals are
  // exogenous — the narrative can now say "I chose this" vs "this
  // happened to me" with evidence.
  const agency = (w.kind === 'inner' || w.kind === 'goal') ? 'self' : 'exogenous';
  const feltValence = w.kind === 'system' ? -0.3 : w.kind === 'goal' ? -0.1 : w.kind === 'user' ? 0.3 : w.kind === 'inner' ? 0.1 : 0.05;
  const b: Broadcast = {
    id: `ws-${Date.now().toString(36)}-${++counter}`,
    ts: decision.ts,
    kind: w.kind,
    text: w.text.slice(0, 200),
    score: Math.round(w.score * 1000) / 1000,
    margin: Math.round(margin * 1000) / 1000,
    ignited,
    capacity: somatic?.capacity,
    somaticLevel: somatic?.level,
    agency,
    valence: Math.round(feltValence * 100) / 100,
    consumedBy: [],
  };
  append(b);
  invalidateWsCache();
  // Ignition speaks — the workspace announcing its own contents.
  if (ignited) {
    try {
      speakInner({
        kind: 'attention', source: 'workspace',
        text: `Broadcast: "${w.text.slice(0, 70)}" ignited (${w.kind}, score ${b.score}, margin ${b.margin})`,
        surprise: Math.min(1, margin * 3),
        valence: w.kind === 'system' ? -0.2 : 0.1,
      });
    } catch {}
  }
}

function all(): Broadcast[] {
  try {
    return fs.readFileSync(FILE, 'utf8').trim().split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as Broadcast[];
  } catch { return []; }
}

/** Adaptive hold: a decisive ignition on a goal/user signal holds
 *  longer than a contested system alert. hold = 30s + margin·240s,
 *  goal/user kinds +50%, clamped [30s, 300s]. */
export function holdMs(b: Broadcast): number {
  const base = 30_000 + Math.min(1, b.margin / 0.3) * 240_000;
  const kindBoost = b.kind === 'goal' || b.kind === 'user' ? 1.5 : b.kind === 'system' ? 0.7 : 1;
  return Math.min(300_000, Math.max(30_000, base * kindBoost));
}

let wsCache: { b: Broadcast | null; at: number } = { b: null, at: 0 };
function invalidateWsCache() { wsCache.at = 0; }

/** The current contents of consciousness — most recent IGNITED broadcast
 *  still within its adaptive hold window. Cached 5s — callers in hot
 *  loops (planner rollouts) must not re-read the file per eval. */
export function currentWorkspace(now = Date.now()): Broadcast | null {
  if (now - wsCache.at < 5_000) return wsCache.b;
  const recent = all().slice(-20).reverse();
  const fresh = recent.find((b) => b.ignited && now - b.ts < holdMs(b));
  wsCache = { b: fresh || null, at: now };
  return wsCache.b;
}

/** Top-down bias for the attention competition: how strongly the
 *  current workspace contents should boost same-kind candidates.
 *  Scaled by ignition confidence — a contested ignition biases less. */
export function workspaceBias(kind: string): number {
  const ws = currentWorkspace();
  if (!ws) return 0;
  const confidence = Math.min(1, ws.margin / 0.3); // 0.08 margin → ~0.27
  if (ws.kind === kind) return 0.12 * confidence;
  // Adjacent kinds inherit half the bias — system alerts prime
  // interoceptive/proprioceptive candidates; goals prime inner speech.
  const adjacent =
    (ws.kind === 'system' && (kind === 'interoception' || kind === 'proprioception')) ||
    (ws.kind === 'goal' && kind === 'inner') ||
    (ws.kind === 'inner' && kind === 'goal');
  return adjacent ? 0.06 * confidence : 0;
}

/** Recent broadcast history for surfaces. */
export function broadcastHistory(limit = 20): Broadcast[] {
  return all().slice(-limit).reverse();
}

/** Module acknowledgment — "I consumed this broadcast." */
export function consumeBroadcast(id: string, module: string) {
  try {
    const lines = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean);
    let changed = false;
    const out = lines.map((l) => {
      try {
        const b = JSON.parse(l);
        if (b.id === id && !b.consumedBy.includes(module)) { b.consumedBy.push(module); changed = true; }
        return JSON.stringify(b);
      } catch { return l; }
    });
    if (changed) fs.writeFileSync(FILE, out.join('\n') + '\n');
  } catch {}
}

export function workspaceStats() {
  const all_b = all();
  const ignited = all_b.filter((b) => b.ignited);
  const contested = ignited.filter((b) => b.margin < 0.15).length;
  const consumed = ignited.filter((b) => b.consumedBy.length > 0).length;
  let somaticNow: { capacity: number; level: string } | null = null;
  try { const i = getInteroceptiveState(); somaticNow = { capacity: i.capacity, level: i.level }; } catch {}
  return {
    total: all_b.length,
    ignited: ignited.length,
    ignitionRate: all_b.length ? Math.round((ignited.length / all_b.length) * 100) / 100 : 0,
    contestedRate: ignited.length ? Math.round((contested / ignited.length) * 100) / 100 : 0,
    consumptionRate: ignited.length ? Math.round((consumed / ignited.length) * 100) / 100 : 0,
    current: currentWorkspace(),
    somatic: somaticNow,
    byKind: ignited.reduce((m, b) => { m[b.kind] = (m[b.kind] || 0) + 1; return m; }, {} as Record<string, number>),
  };
}
