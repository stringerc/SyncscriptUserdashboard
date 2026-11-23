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
import { speakInner } from './inner-speech';
import { broadcastAttention, workspaceBias } from './workspace';
import { getInteroceptiveState } from './interoceptive';
import { getParam } from './meta-architecture';
import path from 'node:path';

const DIR = path.join(process.cwd(), '.cortex-runtime');
const TRACE = path.join(DIR, 'attention-trace.jsonl');
const MAX_TRACE = 500;
const HALF_LIFE_MS = 10 * 60_000; // salience halves every 10 min

export type AttentionKind = 'system' | 'ambient' | 'goal' | 'user' | 'proprioception' | 'interoception' | 'inner';

const KIND_WEIGHT_STATIC: Record<AttentionKind, number> = {
  user: 1.0,           // direct address always wins
  system: 0.9,         // alerts, crashes, budget walls
  goal: 0.7,           // drift, forecasts, escalations
  interoception: 0.65, // somatic surprise
  proprioception: 0.4, // limb state changes
  inner: 0.55,         // self-talk — salient but below system
  ambient: 0.35,       // observations, chatter
};
// ambient + inner are meta-architecture tunable — she can adjust how
// much chatter and self-talk compete after counterfactual evaluation.
const kindWeightOf = (k: AttentionKind): number => {
  if (k === 'ambient') return getParam('kindWeight.ambient');
  if (k === 'inner') return getParam('kindWeight.inner');
  return KIND_WEIGHT_STATIC[k];
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
  factors: { kindWeight: number; recency: number; relevance: number; priority: number; workspaceBias?: number; somaticBias?: number };
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
  const kindWeight = kindWeightOf(c.kind);
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
/** Second-order attention: the schema attends to its OWN recent
 *  decisions. Reads the trace tail and distills attention health into
 *  a meta-candidate that can itself win conscious access — attention
 *  modeling attention. Bounded to ONE meta level: meta-candidates are
 *  kind 'inner' and inner winners never verbalize (no recursion). */
export function metaAttentionCandidate(now = Date.now()): AttentionCandidate | null {
  try {
    const lines = fs.readFileSync(TRACE, 'utf8').trim().split('\n').filter(Boolean).slice(-12);
    if (lines.length < 5) return null;
    const decisions = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    let flips = 0, pairs = 0, contested = 0, ignited = 0;
    for (const d of decisions) {
      const w = d?.winner, c = d?.candidates || [];
      if (w) {
        const margin = c[1] ? w.score - c[1].score : w.score;
        if (margin < 0.15 && c[1]) contested++;
        if (w.score >= 0.45 && margin >= 0.08) ignited++;
      }
      if (pairs > 0) { /* flip computed below */ }
    }
    for (let i = 1; i < decisions.length; i++) {
      const a = decisions[i - 1]?.winner?.kind, b = decisions[i]?.winner?.kind;
      if (a && b) { pairs++; if (a !== b) flips++; }
    }
    if (!pairs) return null;
    const flipRate = flips / pairs;
    const contestedRate = decisions.length ? contested / decisions.length : 0;
    // Only surface when attention health is noteworthy — stable,
    // decisive attention doesn't need to interrupt itself.
    const noteworthy = flipRate > 0.45 || contestedRate > 0.4 || ignited === 0;
    if (!noteworthy) return null;
    const verdict = flipRate > 0.6 ? 'thrashing' : flipRate > 0.45 ? 'unstable' : contestedRate > 0.4 ? 'contested' : 'disengaged';
    return {
      id: `meta-attn-${Math.floor(now / 600_000)}`, // one per 10min bucket — dedupes naturally
      kind: 'inner',
      text: `Meta-attention: my focus is ${verdict} — ${flips}/${pairs} winner flips, ${contested} contested races, ${ignited} ignitions in last ${decisions.length} decisions`,
      ts: now,
      priority: 0.5,
      goalRelevance: 0.6,
    };
  } catch { return null; }
}

export function attend(candidates: AttentionCandidate[], now = Date.now()): AttentionDecision | null {
  if (!candidates.length) return null;
  // Top-down bias: ignited workspace contents boost same-kind (and
  // adjacent-kind) candidates BEFORE the argmax — consciousness
  // reshapes what competes next, margin-scaled so contested
  // ignitions bias less.
  // Somatic urgency: a strained body amplifies system/interoceptive
  // signals and suppresses ambient noise — physiology biases what
  // competes for awareness. Strained +0.08, critical +0.15 on
  // system/interoception; ambient/inner dampened under strain.
  let somaticUrgency = 0;
  try {
    const iState = getInteroceptiveState(now);
    somaticUrgency = iState.level === 'critical' ? 1 : iState.level === 'strained' ? 0.5 : 0;
  } catch {}
  const scored = candidates.map((c) => {
    let base = scoreCandidate(c, now);
    const wBias = workspaceBias(c.kind);
    let sBias = 0;
    if (somaticUrgency > 0) {
      if (c.kind === 'system' || c.kind === 'interoception') sBias = getParam('somatic.systemBoost') * somaticUrgency;
      else if (c.kind === 'ambient' || c.kind === 'inner') sBias = -getParam('somatic.ambientDampen') * somaticUrgency;
    }
    const totalBias = wBias + sBias;
    if (totalBias !== 0) {
      base = { ...base, score: Math.round((base.score + totalBias) * 1000) / 1000, factors: { ...base.factors, workspaceBias: Math.round(wBias * 1000) / 1000, somaticBias: Math.round(sBias * 1000) / 1000 } };
    }
    return base;
  }).sort((a, b) => b.score - a.score);
  const winner = scored[0];
  const runnerUp = scored[1];
  const reason = runnerUp
    ? `"${winner.text.slice(0, 60)}" won over "${runnerUp.text.slice(0, 60)}" — score ${winner.score} vs ${runnerUp.score} (kind ${winner.kind} w=${winner.factors.kindWeight}, recency ${winner.factors.recency}, relevance ${winner.factors.relevance})`
    : `"${winner.text.slice(0, 60)}" won uncontested — score ${winner.score} (kind ${winner.kind})`;
  const decision: AttentionDecision = { ts: now, winner, reason, candidates: scored };
  appendTrace(decision);
  try { broadcastAttention(decision); } catch {}
  // Meta-attention doesn't verbalize — prevents inner-speech recursion
  // (monologue → candidate → winner → monologue → ...).
  if (winner.kind === 'inner') return decision;
  try {
    speakInner({
      kind: 'attention', source: 'attention-schema',
      text: `Attention: ${reason}`,
      surprise: Math.min(1, winner.score / (scored[1]?.score || winner.score || 1) - 1 > 0 ? 0.3 : 0.1),
      valence: winner.kind === 'system' ? -0.3 : 0.1,
    });
  } catch {}
  return decision;
}

export function attentionTrace(limit = 10): AttentionDecision[] {
  try {
    const lines = fs.readFileSync(TRACE, 'utf8').trim().split('\n').filter(Boolean).slice(-limit);
    return lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
  } catch { return []; }
}
