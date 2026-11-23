/**
 * Attention schema — makes the competition for conscious access legible.
 *
 * Every ambient signal that could reach Cortex's awareness is registered
 * as a candidate with explicit factors: source kind weight, recency
 * decay, goal relevance, and interrupt cost. attend() picks the winner
 * deterministically and appends a trace record explaining WHY it won —
 * the scores of every loser included. Cortex can then truthfully say
 * "the memory-pressure alert won attention over the patrol note because
 * system signals outweigh ambient chatter by 3x and it was fresher."
 *
 * Trace: .cortex-runtime/attention-trace.jsonl (capped).
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), '.cortex-runtime');
const TRACE = path.join(DIR, 'attention-trace.jsonl');
const MAX_TRACE = 500;
const HALF_LIFE_MS = 10 * 60_000; // salience halves every 10 min

export type AttentionKind = 'system' | 'ambient' | 'goal' | 'user' | 'proprioception' | 'interoception';

const KIND_WEIGHT: Record<AttentionKind, number> = {
  user: 1.0,           // direct address always wins
  system: 0.9,         // alerts, crashes, budget walls
  goal: 0.7,           // drift, forecasts, escalations
  interoception: 0.65, // somatic surprise
  proprioception: 0.4, // limb state changes
  ambient: 0.35,       // observations, chatter
};

export interface AttentionCandidate {
  id: string;
  kind: AttentionKind;
  text: string;
  ts: number;
  goalRelevance?: number; // 0..1
  priority?: number;       // explicit 0..1 override
}

export interface ScoredCandidate extends AttentionCandidate {
  score: number;
  factors: { kindWeight: number; recency: number; relevance: number; priority: number };
}

export interface AttentionDecision {
  ts: number;
  winner: ScoredCandidate;
  reason: string;
  candidates: ScoredCandidate[];
}

export function scoreCandidate(c: AttentionCandidate, now = Date.now()): ScoredCandidate {
  const ageMs = Math.max(0, now - c.ts);
  const recency = Math.pow(0.5, ageMs / HALF_LIFE_MS);
  const kindWeight = KIND_WEIGHT[c.kind] ?? 0.4;
  const relevance = 1 + 0.5 * Math.min(1, Math.max(0, c.goalRelevance ?? 0));
  const priority = c.priority ?? 0.5;
  const score = kindWeight * (0.35 + 0.65 * recency) * relevance * (0.7 + 0.6 * priority);
  return { ...c, score: Math.round(score * 1000) / 1000, factors: { kindWeight, recency: Math.round(recency * 100) / 100, relevance: Math.round(relevance * 100) / 100, priority } };
}

function appendTrace(d: AttentionDecision) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(TRACE, JSON.stringify(d) + '\n');
    const lines = fs.readFileSync(TRACE, 'utf8').split('\n').filter(Boolean);
    if (lines.length > MAX_TRACE) fs.writeFileSync(TRACE, lines.slice(-MAX_TRACE).join('\n') + '\n');
  } catch {}
}

/** The competition: score every candidate, pick the argmax, explain why. */
export function attend(candidates: AttentionCandidate[], now = Date.now()): AttentionDecision | null {
  if (!candidates.length) return null;
  const scored = candidates.map((c) => scoreCandidate(c, now)).sort((a, b) => b.score - a.score);
  const winner = scored[0];
  const runnerUp = scored[1];
  const reason = runnerUp
    ? `"${winner.text.slice(0, 60)}" won over "${runnerUp.text.slice(0, 60)}" — score ${winner.score} vs ${runnerUp.score} (kind ${winner.kind} w=${winner.factors.kindWeight}, recency ${winner.factors.recency}, relevance ${winner.factors.relevance})`
    : `"${winner.text.slice(0, 60)}" won uncontested — score ${winner.score} (kind ${winner.kind})`;
  const decision: AttentionDecision = { ts: now, winner, reason, candidates: scored };
  appendTrace(decision);
  return decision;
}

export function attentionTrace(limit = 10): AttentionDecision[] {
  try {
    const lines = fs.readFileSync(TRACE, 'utf8').trim().split('\n').filter(Boolean).slice(-limit);
    return lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
  } catch { return []; }
}
