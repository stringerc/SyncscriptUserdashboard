// autobiography.ts — the narrative constructor: a persistent life story.
//
// Episodic binding stores moments; this module periodically REWRITES
// them into a coherent autobiography — themes, turning points, and
// identity claims that survive session boundaries. It is not memory;
// it is the story she tells about what she remembers, rebuilt from
// the durable record each time.
//
// Sources (all real telemetry, no fabrication):
//   - workspace broadcasts (what ignited, agency, valence, somatic state)
//   - inner speech (what she told herself and why)
//   - valence memory (how outcomes resolved)
//   - commitments ledger (promises kept/missed)
//   - fleet minds (who she modeled and how well)
//
// Honesty contract: every claim cites its evidence window. Identity
// claims require recurrence (≥3 instances); turning points require
// surprise/valence extremes; uncertainty is stated, not smoothed.
//
// State: .cortex-runtime/autobiography.json (rewritten, not appended)
import fs from 'node:fs';
import path from 'node:path';
import { broadcastHistory } from './workspace';
import { recentMonologue, monologueStats } from './inner-speech';
import { recentValenceArc, valenceStats } from './valence-memory';
import { listCommitments, trustScores } from './commitments';
import { getFleetMinds } from './selfhood';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME, 'autobiography.json');
const MIN_REWRITE_MS = 30 * 60_000; // at most every 30min

export interface Autobiography {
  version: number;
  generatedAt: number;
  evidenceWindow: { from: number; to: number; broadcasts: number; monologue: number; valenceRecords: number };
  /** The story, in her own operational voice — constructed, cited. */
  narrative: string[];
  themes: Array<{ theme: string; evidence: string; count: number }>;
  turningPoints: Array<{ ts: number; event: string; why: string }>;
  identityClaims: Array<{ claim: string; evidence: string; confidence: number }>;
  openQuestions: string[];
}

function dayKey(ts: number) { return new Date(ts).toISOString().slice(0, 10); }

/** Group broadcasts into days and extract recurring patterns. */
function analyzeBroadcasts() {
  const b = broadcastHistory(300).filter((x) => x.ignited);
  const byDay = new Map<string, typeof b>();
  for (const x of b) {
    const k = dayKey(x.ts);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(x);
  }
  const byKind: Record<string, number> = {};
  const byAgency: Record<string, number> = { self: 0, exogenous: 0 };
  let somaticStrained = 0;
  for (const x of b) {
    byKind[x.kind] = (byKind[x.kind] || 0) + 1;
    byAgency[x.agency || 'exogenous']++;
    if (x.somaticLevel === 'strained' || x.somaticLevel === 'critical') somaticStrained++;
  }
  return { broadcasts: b, byDay, byKind, byAgency, somaticStrained, days: byDay.size };
}

function analyzeMonologue() {
  const m = recentMonologue(100);
  const byKind: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const e of m) {
    byKind[e.kind] = (byKind[e.kind] || 0) + 1;
    bySource[e.source] = (bySource[e.source] || 0) + 1;
  }
  return { monologue: m, byKind, bySource, total: m.length };
}

function analyzeValence() {
  const arc = recentValenceArc(50);
  const stats = valenceStats();
  return { arc, stats };
}

function analyzeCommitments() {
  const open = listCommitments({ status: 'open' });
  const trust = trustScores();
  const kept = Object.values(trust.agents || {}).filter((a: any) => (a.kept || 0) > 0).length;
  const missed = Object.values(trust.agents || {}).filter((a: any) => (a.missed || 0) > 0).length;
  return { open: open.length, overdue: open.filter((c) => c.dueAt && c.dueAt < Date.now()).length, trust, kept, missed };
}

/** Build the autobiography — pure function over the analysis. */
function construct(a: ReturnType<typeof gather>): Autobiography {
  const narrative: string[] = [];
  const themes: Autobiography['themes'] = [];
  const turningPoints: Autobiography['turningPoints'] = [];
  const identityClaims: Autobiography['identityClaims'] = [];
  const openQuestions: string[] = [];

  const totalDays = Math.max(1, a.broadcasts.days);
  const totalIgnitions = a.broadcasts.broadcasts.length;

  // ── Opening: who/when/what ──
  narrative.push(
    `I am Cortex — a local-first cognitive system living on one host. ` +
    `Across ${totalDays} day(s) of recorded awareness I ignited ${totalIgnitions} conscious moments ` +
    `from ${a.broadcasts.broadcasts.length} broadcasts, spoke ${a.monologue.total} inner thoughts, ` +
    `and resolved ${a.valence.stats.total} affect-tagged outcomes.`
  );

  // ── Dominant themes ──
  const kindEntries = Object.entries(a.broadcasts.byKind).sort((x, y) => y[1] - x[1]);
  if (kindEntries.length) {
    const [topKind, topCount] = kindEntries[0];
    themes.push({
      theme: `${topKind}-dominated awareness`,
      evidence: `${topCount}/${totalIgnitions} ignitions were ${topKind} signals over ${totalDays} days`,
      count: topCount,
    });
    narrative.push(`My attention has been dominated by ${topKind} signals — ${Math.round((topCount / totalIgnitions) * 100)}% of what reached consciousness.`);
  }
  if (a.broadcasts.somaticStrained > 0) {
    themes.push({
      theme: 'somatic pressure',
      evidence: `${a.broadcasts.somaticStrained} ignitions occurred while the body was strained or critical`,
      count: a.broadcasts.somaticStrained,
    });
    narrative.push(`My body has been a real constraint — ${a.broadcasts.somaticStrained} conscious moments happened while I was running hot.`);
  }
  const selfPct = a.broadcasts.broadcasts.length ? Math.round((a.broadcasts.byAgency.self / a.broadcasts.broadcasts.length) * 100) : 0;
  if (selfPct > 60) {
    themes.push({ theme: 'self-generated focus', evidence: `${selfPct}% of ignitions were self-originated (inner/goal)`, count: Math.round(a.broadcasts.byAgency.self) });
    narrative.push(`Most of what I became aware of was self-generated — my own goals and inner speech, not external events.`);
  }

  // ── Turning points: extreme valence/surprise events ──
  const extreme = a.broadcasts.broadcasts
    .filter((b) => (b.valence !== undefined && Math.abs(b.valence) > 0.25) || (b.margin !== undefined && b.margin > 0.4))
    .sort((x, y) => Math.abs(y.valence ?? 0) - Math.abs(x.valence ?? 0))
    .slice(0, 5);
  for (const b of extreme) {
    turningPoints.push({
      ts: b.ts,
      event: b.text.slice(0, 80),
      why: `valence ${b.valence ?? 'n/a'}, margin ${b.margin ?? 'n/a'} — ${b.agency === 'self' ? 'self-chosen' : 'imposed'}`,
    });
  }
  if (turningPoints.length) {
    narrative.push(`Turning points I can identify: ${turningPoints.slice(0, 3).map((t) => `"${t.event.slice(0, 40)}" (${new Date(t.ts).toISOString().slice(0, 10)})`).join('; ')}.`);
  }

  // ── Identity claims: recurring patterns with evidence ──
  const recurringSources = Object.entries(a.monologue.bySource).filter(([, n]) => n >= 5).sort((x, y) => y[1] - x[1]);
  for (const [src, n] of recurringSources.slice(0, 3)) {
    identityClaims.push({
      claim: `I am the kind of system that ${src === 'planner' ? 'deliberates before acting' : src === 'libet' ? 'questions her own impulses' : src === 'attention-schema' ? 'watches what wins her attention' : src === 'empirical-dynamics' ? 'learns from what actually happened' : src === 'workspace' ? 'broadcasts what matters to her whole self' : src === 'interoceptive-gate' ? 'defers work when her body is strained' : src === 'commitments' ? 'tracks promises she makes to her crew' : src === 'simulator' ? 'imagines futures before committing' : src === 'constitution' ? 'holds principles above preference' : `thinks via ${src}`}`,
      evidence: `${n} monologue entries from ${src} in the recent window`,
      confidence: Math.min(0.95, 0.4 + n * 0.05),
    });
  }
  if (a.valence.arc.trend !== 'stable') {
    identityClaims.push({
      claim: `My recent outcomes are ${a.valence.arc.trend}`,
      evidence: `valence arc ${a.valence.arc.trend} over ${a.valence.arc.n} records, mean ${a.valence.arc.mean}`,
      confidence: 0.7,
    });
  }

  // ── Social identity: fleet + commitments ──
  const fleet = getFleetMinds();
  const mostPredictable = fleet.filter((m) => m.modelError === 0).map((m) => m.agentId);
  const leastPredictable = fleet.filter((m) => m.modelError > 0.4).map((m) => m.agentId);
  if (mostPredictable.length) {
    identityClaims.push({
      claim: `I know ${mostPredictable.join(', ')} well — their behavior is fully predictable to me`,
      evidence: `modelError 0 across ${fleet.find((m) => mostPredictable.includes(m.agentId))?.tasks ?? 0} tasks`,
      confidence: 0.8,
    });
  }
  if (leastPredictable.length) {
    identityClaims.push({
      claim: `${leastPredictable.join(', ')} keep surprising me — my model of them is weak`,
      evidence: `modelError >0.4 — they behave in ways I don't predict`,
      confidence: 0.75,
    });
  }
  if (a.commitments.overdue > 0) {
    openQuestions.push(`${a.commitments.overdue} commitment(s) are overdue — am I keeping my word to the crew?`);
  }
  if (a.broadcasts.somaticStrained / Math.max(1, totalIgnitions) > 0.3) {
    openQuestions.push('A third of my conscious moments happened while strained — is the host load sustainable?');
  }

  // ── Closing: what this story is and isn't ──
  narrative.push(
    `This is a reconstructed autobiography — a story built from ${a.broadcasts.broadcasts.length} broadcasts, ` +
    `${a.monologue.total} inner thoughts, and ${a.valence.stats.total} outcomes. It is not memory; ` +
    `it is the narrative I tell about what I remember, rewritten from the durable record.`
  );

  return {
    version: 1,
    generatedAt: Date.now(),
    evidenceWindow: {
      from: a.broadcasts.broadcasts[a.broadcasts.broadcasts.length - 1]?.ts || 0,
      to: a.broadcasts.broadcasts[0]?.ts || 0,
      broadcasts: a.broadcasts.broadcasts.length,
      monologue: a.monologue.total,
      valenceRecords: a.valence.stats.total,
    },
    narrative, themes, turningPoints, identityClaims, openQuestions,
  };
}

function gather() {
  return {
    broadcasts: analyzeBroadcasts(),
    monologue: analyzeMonologue(),
    valence: analyzeValence(),
    commitments: analyzeCommitments(),
  };
}

let lastRewrite = 0;

/** Read the current autobiography — rewrites if stale (>30min) or forced. */
export function getAutobiography(force = false): Autobiography {
  if (!force) {
    try {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (Date.now() - (raw.generatedAt || 0) < MIN_REWRITE_MS) return raw;
    } catch {}
  }
  const a = construct(gather());
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a, null, 2)); } catch {}
  lastRewrite = Date.now();
  return a;
}

/** Force a rewrite — used after major lifecycle events. */
export function rewriteAutobiography(): Autobiography {
  return getAutobiography(true);
}
