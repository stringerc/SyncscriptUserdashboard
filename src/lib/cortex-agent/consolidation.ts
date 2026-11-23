/**
 * consolidation.ts — offline memory reconsolidation ("dreaming").
 *
 * The online loop perceives→attends→plans→acts→learns in real time.
 * This module is the offline pass: it re-reads the episodic record and
 * does what online processing can't — cross-episode pattern mining,
 * narrative rewiring, and hypothesis generation.
 *
 * Three outputs, all evidence-backed:
 *   1. THREAD REWIRING — episodes clustered into chapters; recurring
 *      arcs compressed into durable narrative structure (not just a
 *      log — a story with shape).
 *   2. CROSS-EPISODE PATTERNS — lift-scored associations: which signal
 *      kinds precede which outcomes, at what rate vs baseline. Pure
 *      statistics over the JSONL record; no vibes.
 *   3. HYPOTHESES — candidate insights the online loop would never
 *      stumble into, each carrying its evidence count and confidence.
 *      Persisted to dream-insights.jsonl, deduped, decay-free until
 *      contradicted.
 *
 * State: .cortex-runtime/dream-state.json + dream-insights.jsonl
 */
import fs from 'node:fs';
import path from 'node:path';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const STATE_FILE = path.join(RUNTIME, 'dream-state.json');
const INSIGHTS_FILE = path.join(RUNTIME, 'dream-insights.jsonl');
const THREADS_FILE = path.join(RUNTIME, 'dream-threads.json');
const MIN_INTERVAL_MS = 20 * 60_000; // consolidation is expensive; 20min floor

const readJsonl = (f: string, tail = 800) => {
  try {
    return fs.readFileSync(path.join(RUNTIME, f), 'utf8').trim().split('\n').filter(Boolean).slice(-tail)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
};
const readJson = (f: string) => { try { return JSON.parse(fs.readFileSync(path.join(RUNTIME, f), 'utf8')); } catch { return null; } };

interface DreamState {
  lastRunAt: number;
  runs: number;
  episodesProcessed: number;
  insightsGenerated: number;
}

function loadState(): DreamState {
  try { return { lastRunAt: 0, runs: 0, episodesProcessed: 0, insightsGenerated: 0, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; }
  catch { return { lastRunAt: 0, runs: 0, episodesProcessed: 0, insightsGenerated: 0 }; }
}
function saveState(s: DreamState) {
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s)); } catch {}
}

// ── 1. Episode extraction (shared shape with selfhood) ─────────────────
interface Episode { ts: number; kind: string; signal: string; valence: string }

function extractEpisodes(): Episode[] {
  const trace = readJsonl('attention-trace.jsonl', 300);
  const POS = /resolved|achieved|completed|fired|ready|on.?track|hit/i;
  const NEG = /escalat|diversion|stall|miss|fail|error|critical|vetoed|defer/i;
  return trace.map((d: any) => {
    const w = d?.winner || {};
    const text = String(w.text || '');
    return {
      ts: Number(d?.ts || w.ts || 0),
      kind: String(w.kind || 'ambient'),
      signal: text.slice(0, 80),
      valence: POS.test(text) ? 'positive' : NEG.test(text) ? 'negative' : 'neutral',
    };
  }).filter((e) => e.ts > 0).sort((a, b) => a.ts - b.ts);
}

// ── 2. Thread rewiring: cluster episodes into narrative chapters ───────
interface Chapter {
  startTs: number; endTs: number;
  dominantKind: string;
  episodeCount: number;
  valenceMix: { positive: number; negative: number; neutral: number };
  summary: string;
}

function clusterChapters(eps: Episode[]): Chapter[] {
  if (!eps.length) return [];
  const GAP_MS = 2 * 3600_000; // >2h silence = new chapter
  const chapters: Episode[][] = [[eps[0]]];
  for (let i = 1; i < eps.length; i++) {
    if (eps[i].ts - eps[i - 1].ts > GAP_MS) chapters.push([eps[i]]);
    else chapters[chapters.length - 1].push(eps[i]);
  }
  return chapters.map((ch) => {
    const kindCount: Record<string, number> = {};
    const valenceMix = { positive: 0, negative: 0, neutral: 0 };
    for (const e of ch) {
      kindCount[e.kind] = (kindCount[e.kind] || 0) + 1;
      valenceMix[e.valence as keyof typeof valenceMix]++;
    }
    const dominantKind = Object.entries(kindCount).sort((a, b) => b[1] - a[1])[0][0];
    const durH = Math.round((ch[ch.length - 1].ts - ch[0].ts) / 3600_000 * 10) / 10;
    const topSignal = ch[ch.length - 1].signal.slice(0, 50);
    return {
      startTs: ch[0].ts, endTs: ch[ch.length - 1].ts,
      dominantKind, episodeCount: ch.length, valenceMix,
      summary: `${ch.length} attended moments over ${durH}h — attention dominated by ${dominantKind} signals; latest: "${topSignal}"`,
    };
  }).slice(-20);
}

// ── 3. Cross-episode pattern mining: lift-scored associations ──────────
interface Pattern {
  signalKind: string;
  outcomeKind: string;
  cooccurrences: number;
  lift: number;          // P(outcome|signal) / P(outcome)
  confidence: 'weak' | 'moderate' | 'strong';
}

function minePatterns(eps: Episode[], outcomes: any[]): Pattern[] {
  // Outcomes = task-archive completions + drift/verification events
  const outcomeKinds = outcomes.map((o) => String(o?.kind || o?.status || o?.type || ''));
  const patterns: Pattern[] = [];
  const signalKinds = [...new Set(eps.map((e) => e.kind))];
  // Drop near-universal outcomes — a signal that "predicts" something
  // that happens 40% of the time anyway carries no information. Lift
  // on a high base rate is a denominator artifact, not a discovery.
  const totalOutcomes = outcomeKinds.length || 1;
  const outcomeBase: Record<string, number> = {};
  for (const k of outcomeKinds) outcomeBase[k] = (outcomeBase[k] || 0) + 1;
  const outcomeSet = [...new Set(outcomeKinds.filter(Boolean))]
    .filter((k) => (outcomeBase[k] || 0) / totalOutcomes < 0.25);

  for (const sk of signalKinds) {
    const sigEps = eps.filter((e) => e.kind === sk);
    if (sigEps.length < 3) continue;
    for (const ok of outcomeSet.slice(0, 10)) {
      // Count outcomes within 30min AFTER a signal of this kind
      let co = 0;
      for (const e of sigEps) {
        for (const o of outcomes) {
          const ots = Number(o?.ts || o?.createdAt || o?.finishedAt || 0);
          if (ots > e.ts && ots <= e.ts + 30 * 60_000 && String(o?.kind || o?.status || o?.type || '') === ok) co++;
        }
      }
      if (co < 2) continue;
      const pOutGivenSig = co / sigEps.length;
      const pOut = (outcomeBase[ok] || 0) / totalOutcomes;
      const lift = pOut > 0 ? pOutGivenSig / pOut : 0;
      if (lift < 1.3) continue; // only positive associations
      patterns.push({
        signalKind: sk, outcomeKind: ok, cooccurrences: co,
        lift: Math.round(lift * 100) / 100,
        confidence: co >= 8 ? 'strong' : co >= 4 ? 'moderate' : 'weak',
      });
    }
  }
  return patterns.sort((a, b) => b.lift - a.lift).slice(0, 12);
}

// ── 4. Hypothesis generation ────────────────────────────────────────────
interface Hypothesis {
  id: string;
  claim: string;
  evidence: string;
  confidence: number;   // 0..1 from cooccurrence count + lift
  generatedAt: number;
  status: 'open' | 'supported' | 'contradicted';
}

function generateHypotheses(patterns: Pattern[], chapters: Chapter[], eps: Episode[]): Hypothesis[] {
  const out: Hypothesis[] = [];
  const now = Date.now();
  let n = 0;
  for (const p of patterns.slice(0, 6)) {
    const conf = Math.min(0.9, 0.3 + p.cooccurrences * 0.05 + Math.min(0.3, p.lift * 0.05));
    out.push({
      id: `hyp-${now.toString(36)}-${n++}`,
      claim: `${p.signalKind} attention episodes are followed by ${p.outcomeKind} outcomes at ${p.lift}× baseline rate (${p.cooccurrences} observations)`,
      evidence: `${p.cooccurrences} co-occurrences within 30min windows across ${eps.length} episodes`,
      confidence: Math.round(conf * 100) / 100,
      generatedAt: now, status: 'open',
    });
  }
  // Temporal hypothesis: chapters with negative valence clustering
  const negChapters = chapters.filter((c) => c.valenceMix.negative > c.valenceMix.positive);
  if (negChapters.length >= 2) {
    out.push({
      id: `hyp-${now.toString(36)}-${n++}`,
      claim: `${negChapters.length} of the last ${chapters.length} chapters ran negative-valence — sustained drift in the underlying conditions, not isolated events`,
      evidence: `${negChapters.map((c) => c.dominantKind).join(', ')} dominated the negative chapters`,
      confidence: Math.min(0.8, 0.4 + negChapters.length * 0.1),
      generatedAt: now, status: 'open',
    });
  }
  // Novel hypothesis: attention kind that NEVER precedes outcomes
  const kindsWithOutcomes = new Set(patterns.map((p) => p.signalKind));
  const silentKinds = [...new Set(eps.map((e) => e.kind))].filter((k) => !kindsWithOutcomes.has(k) && eps.filter((e) => e.kind === k).length >= 5);
  for (const k of silentKinds.slice(0, 2)) {
    out.push({
      id: `hyp-${now.toString(36)}-${n++}`,
      claim: `${k} signals recur (${eps.filter((e) => e.kind === k).length}×) but never precede recorded outcomes — either epiphenomenal or the outcome isn't being measured`,
      evidence: 'zero outcome co-occurrences in 30min windows',
      confidence: 0.4,
      generatedAt: now, status: 'open',
    });
  }
  return out;
}

function appendInsights(hyps: Hypothesis[]) {
  if (!hyps.length) return;
  try {
    const existing = readJsonl('dream-insights.jsonl', 500).map((h: any) => String(h?.claim || ''));
    const fresh = hyps.filter((h) => !existing.some((c) => c.includes(h.claim.slice(0, 50))));
    if (!fresh.length) return;
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(INSIGHTS_FILE, fresh.map((h) => JSON.stringify(h)).join('\n') + '\n');
  } catch {}
}

// ── Main consolidation pass ────────────────────────────────────────────
export interface ConsolidationResult {
  ranAt: number;
  skipped: boolean;
  reason?: string;
  episodes: number;
  chapters: number;
  patterns: number;
  hypotheses: number;
  topHypothesis?: string;
}

export function runConsolidation(now = Date.now(), force = false): ConsolidationResult {
  const state = loadState();
  if (!force && now - state.lastRunAt < MIN_INTERVAL_MS) {
    return { ranAt: now, skipped: true, reason: `cooldown (${Math.round((MIN_INTERVAL_MS - (now - state.lastRunAt)) / 60000)}min left)`, episodes: 0, chapters: 0, patterns: 0, hypotheses: 0 };
  }
  const eps = extractEpisodes();
  if (eps.length < 5) {
    return { ranAt: now, skipped: true, reason: 'insufficient episodes (<5) — dream needs material', episodes: eps.length, chapters: 0, patterns: 0, hypotheses: 0 };
  }

  // Outcomes stream: task archive + drift + verification events
  const outcomes = [
    ...readJsonl('task-archive.jsonl', 300),
    ...readJsonl('goal-drift.jsonl', 100),
  ].filter(Boolean);

  const chapters = clusterChapters(eps);
  const patterns = minePatterns(eps, outcomes);
  const hyps = generateHypotheses(patterns, chapters, eps);
  appendInsights(hyps);

  // Persist rewired threads
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.writeFileSync(THREADS_FILE, JSON.stringify({ computedAt: now, chapters, patterns: patterns.slice(0, 8) }));
  } catch {}

  state.lastRunAt = now;
  state.runs++;
  state.episodesProcessed += eps.length;
  state.insightsGenerated += hyps.length;
  saveState(state);

  return {
    ranAt: now, skipped: false,
    episodes: eps.length, chapters: chapters.length,
    patterns: patterns.length, hypotheses: hyps.length,
    topHypothesis: hyps[0]?.claim,
  };
}

export function getDreamState() {
  const state = loadState();
  const threads = readJson('dream-threads.json');
  const insights = readJsonl('dream-insights.jsonl', 20).reverse();
  return { ...state, threads, recentInsights: insights };
}
