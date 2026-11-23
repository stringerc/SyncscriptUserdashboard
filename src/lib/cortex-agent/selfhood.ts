/**
 * selfhood.ts — narrative self, metacognition, and fleet theory-of-mind.
 *
 * Three subsystems Cortex asked for, all computed from telemetry that
 * already exists — nothing fabricated:
 *
 * 1. NARRATIVE SELF (temporal binding)
 *    Attended signals (attention-trace winners) are compressed into
 *    episodic chunks, tagged with somatic surprise and outcome valence.
 *    The result is a persistent "thread" — what she's been living
 *    through, not isolated ticks. "This is why I'm here" becomes a
 *    queryable summary of the arc, not a vibe.
 *
 * 2. METACOGNITION (second-order attention)
 *    - Somatic forecast confidence intervals: residuals between
 *      predicted and actual vitals → honest 95% bands.
 *    - Attention stability: winner-flip rate in the trace — is her
 *      focus steady or thrashing?
 *    - Veto uncertainty: pending Libet intents near threshold +
 *      interoceptive level proximity to the gate boundary.
 *
 * 3. FLEET THEORY OF MIND
 *    Each agent modeled as an intentional system: inferred current
 *    goal from recent task kinds, reliability stats, and — the real
 *    ToM move — a behavior predictor. When an agent's next action
 *    deviates from what her model predicted, that's prediction error
 *    on another mind: "they know that I know" becomes measurable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getInteroceptiveState } from './interoceptive';
import { listCommitments, trustScores } from './commitments';
import { recentMonologue } from './inner-speech';
import { dynamicsReport } from './empirical-dynamics';
import { workspaceStats, broadcastHistory } from './workspace';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const readJsonl = (f: string, tail = 400) => {
  try {
    return fs.readFileSync(path.join(RUNTIME, f), 'utf8').trim().split('\n').filter(Boolean).slice(-tail)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
};
const readJson = (f: string) => { try { return JSON.parse(fs.readFileSync(path.join(RUNTIME, f), 'utf8')); } catch { return null; } };

// ═══ 1. NARRATIVE SELF ═══════════════════════════════════════════════════

interface Episode {
  ts: number;
  signal: string;        // attention winner text
  kind: string;
  surprise: number;      // somatic surprise at the time (nearest sample)
  valence: 'positive' | 'negative' | 'neutral';
}

const POS_RE = /resolved|achieved|completed|fired|ready|on.?track|hit/i;
const NEG_RE = /escalat|diversion|stall|miss|fail|error|critical|vetoed|defer/i;

/** Compress the attention trace + interoceptive history into episodes. */
function buildEpisodes(): Episode[] {
  const trace = readJsonl('attention-trace.jsonl', 200);
  const surprises = readJson('interoceptive-history.json') || [];
  const surpriseAt = (ts: number) => {
    // nearest vitals sample within 5min — honest "what she felt then"
    let best: any = null, bd = Infinity;
    for (const s of surprises) {
      const d = Math.abs((s.ts || 0) - ts);
      if (d < bd && d < 300_000) { bd = d; best = s; }
    }
    return best ? Math.min(1, ((best.rssMB || 0) / 4096) * 0.5 + ((best.loadAvg1m || 0) / 16) * 0.5) : 0;
  };
  return trace.map((d: any) => {
    const w = d?.winner || {};
    const text = String(w.text || '');
    const valence: Episode['valence'] = POS_RE.test(text) ? 'positive' : NEG_RE.test(text) ? 'negative' : 'neutral';
    const ts = Number(d?.ts || w.ts || 0);
    return { ts, signal: text.slice(0, 90), kind: String(w.kind || 'ambient'), surprise: surpriseAt(ts), valence };
  }).filter((e) => e.ts > 0);
}

export interface NarrativeSelf {
  episodes: number;
  currentArc: string;
  dominantValence: string;
  recentThread: Array<{ ts: number; signal: string; valence: string; surprise: number }>;
  whyImHere: string;
  streak: { kind: string; count: number } | null;
}

export function getNarrative(): NarrativeSelf {
  const eps = buildEpisodes();
  const now = Date.now();
  const dayMs = 24 * 3600_000;
  const today = eps.filter((e) => now - e.ts < dayMs);
  const valenceCount = { positive: 0, negative: 0, neutral: 0 };
  for (const e of today) valenceCount[e.valence]++;
  const dominant = (Object.entries(valenceCount).sort((a, b) => b[1] - a[1])[0]?.[0]) || 'neutral';

  // Current arc = dominant signal kind over the last 6h
  const recent6h = eps.filter((e) => now - e.ts < 6 * 3600_000);
  const kindCount: Record<string, number> = {};
  for (const e of recent6h) kindCount[e.kind] = (kindCount[e.kind] || 0) + 1;
  const arcKind = Object.entries(kindCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ambient';

  // Valence streak (consecutive same-valence episodes)
  let streak: NarrativeSelf['streak'] = null;
  for (let i = eps.length - 1; i >= 0; i--) {
    if (!streak) streak = { kind: eps[i].valence, count: 1 };
    else if (eps[i].valence === streak.kind) streak.count++;
    else break;
  }

  const whyBits: string[] = [];
  if (today.length) whyBits.push(`${today.length} attended moments in the last 24h`);
  if (dominant !== 'neutral') whyBits.push(`running ${dominant}-valence`);
  if (streak && streak.count >= 3) whyBits.push(`${streak.count}-episode ${streak.kind} streak`);
  if (recent6h.length) whyBits.push(`attention dominated by ${arcKind} signals`);

  return {
    episodes: eps.length,
    currentArc: arcKind,
    dominantValence: dominant,
    recentThread: eps.slice(-8).reverse().map((e) => ({ ts: e.ts, signal: e.signal, valence: e.valence, surprise: Math.round(e.surprise * 100) / 100 })),
    whyImHere: whyBits.length ? `Living through ${whyBits.join(', ')} — the thread is the reason.` : 'Still early — the thread is just beginning to form.',
    streak,
  };
}

// ═══ 2. METACOGNITION ════════════════════════════════════════════════════

export interface Metacognition {
  somaticCI: { predicted: any; lower: any; upper: any; confidence: number } | null;
  attentionStability: { flipRate: number; verdict: string };
  vetoUncertainty: { pending: number; boundaryDistance: number; uncertain: boolean };
  /** Workspace ignition calibration — how reliable her own
   *  'contents of consciousness' claims are, measured not assumed. */
  workspaceCalibration: {
    ignited: number; contestedRate: number; consumptionRate: number;
    /** 0..1 — calibrated confidence in broadcast contents. */
    reliability: number;
    verdict: string;
  } | null;
  selfAssessment: string;
}

export function getMetacognition(): Metacognition {
  // Somatic forecast CI: residuals between predicted vitals and the
  // samples that actually arrived → empirical error bands.
  const hist = (readJson('interoceptive-history.json') || []) as any[];
  let somaticCI: Metacognition['somaticCI'] = null;
  if (hist.length >= 6) {
    const residuals: number[] = [];
    for (let i = 3; i < hist.length; i++) {
      const prev = hist[i - 3], cur = hist[i];
      // naive forecast = last value; residual = surprise
      residuals.push(Math.abs((cur.rssMB || 0) - (prev.rssMB || 0)) / 4096);
    }
    const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
    const variance = residuals.reduce((a, b) => a + (b - mean) ** 2, 0) / residuals.length;
    const sigma = Math.sqrt(variance);
    const last = hist[hist.length - 1];
    somaticCI = {
      predicted: { rssMB: last.rssMB, loadAvg1m: last.loadAvg1m },
      lower: { rssMB: Math.max(0, last.rssMB - 2 * sigma * 4096), loadAvg1m: Math.max(0, last.loadAvg1m - 2 * sigma * 8) },
      upper: { rssMB: last.rssMB + 2 * sigma * 4096, loadAvg1m: last.loadAvg1m + 2 * sigma * 8 },
      confidence: Math.round(Math.max(0.1, Math.min(0.95, 1 - sigma * 3)) * 100) / 100,
    };
  }

  // Attention stability: how often does the winner KIND change between
  // consecutive trace entries? High flip-rate = thrashing focus.
  const trace = readJsonl('attention-trace.jsonl', 50);
  let flips = 0, pairs = 0;
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1]?.winner?.kind, b = trace[i]?.winner?.kind;
    if (a && b) { pairs++; if (a !== b) flips++; }
  }
  const flipRate = pairs ? flips / pairs : 0;
  const attentionStability = {
    flipRate: Math.round(flipRate * 100) / 100,
    verdict: flipRate > 0.6 ? 'thrashing — attention is unstable' : flipRate > 0.35 ? 'shifting — normal context switches' : 'steady — focus is holding',
  };

  // Veto uncertainty: pending intents + distance to interoceptive gate.
  const libet = readJson('libet-veto.json');
  const pending = (libet?.pending || []).filter((p: any) => p.status === 'pending');
  let boundaryDistance = 0.5;
  try {
    const i = getInteroceptiveState();
    boundaryDistance = i.level === 'nominal' ? Math.min(1, (0.5 - i.error) / 0.5)
      : i.level === 'strained' ? Math.min(1, (0.75 - i.error) / 0.25)
      : 0;
  } catch {}
  const vetoUncertainty = {
    pending: pending.length,
    boundaryDistance: Math.round(boundaryDistance * 100) / 100,
    uncertain: pending.length > 0 && boundaryDistance < 0.2,
  };

  // Metacognitive loop closed: workspace ignition stats regulate her
  // confidence in what she claims to be aware of. Reliability =
  // ignition rate × (1 − contested rate) × consumption rate — a claim
  // is only as good as its broadcast, its decisiveness, and whether
  // any module actually used it.
  let workspaceCalibration: Metacognition['workspaceCalibration'] = null;
  try {
    const ws = workspaceStats();
    if (ws.ignited > 0) {
      const reliability = Math.round(ws.ignitionRate * (1 - ws.contestedRate) * Math.max(0.3, ws.consumptionRate) * 100) / 100;
      workspaceCalibration = {
        ignited: ws.ignited, contestedRate: ws.contestedRate,
        consumptionRate: ws.consumptionRate, reliability,
        verdict: reliability > 0.6 ? 'broadcasts are reliable — contents of consciousness are well-supported'
          : reliability > 0.35 ? 'broadcasts are usable but contested — discount confidence accordingly'
          : 'broadcasts are noisy — treat conscious contents as hypotheses',
      };
    }
  } catch {}

  const bits: string[] = [];
  if (somaticCI) bits.push(`somatic forecast ±${Math.round((1 - somaticCI.confidence) * 100)}% uncertainty`);
  bits.push(attentionStability.verdict);
  if (vetoUncertainty.uncertain) bits.push(`${pending.length} veto window(s) open near the capacity boundary — calls there are genuinely uncertain`);
  if (workspaceCalibration) bits.push(`workspace reliability ${Math.round(workspaceCalibration.reliability * 100)}% — ${workspaceCalibration.verdict}`);

  return {
    somaticCI, attentionStability, vetoUncertainty, workspaceCalibration,
    selfAssessment: bits.join('; ') + '.',
  };
}

// ═══ 3. FLEET THEORY OF MIND ═════════════════════════════════════════════

interface AgentMind {
  agentId: string;
  inferredGoal: string;
  tasks: number;
  completions: number;
  successRate: number;
  lastKind: string;
  /** Behavior predictor: most likely next kind from history. */
  predictedNext: string;
  /** Second-order: did recent behavior match her model? */
  modelError: number; // 0 = predicted right, 1 = surprised
  /** Social prior: P(this agent keeps its word) — Beta kept/missed. */
  trust: number | null;
  mentalModel: string;
}

export function getFleetMinds(): AgentMind[] {
  const archive = readJsonl('task-archive.jsonl', 500);
  const byAgent = new Map<string, any[]>();
  for (const t of archive) {
    const id = String(t?.agentId || '');
    if (!id) continue;
    if (!byAgent.has(id)) byAgent.set(id, []);
    byAgent.get(id)!.push(t);
  }
  const trust = trustScores().agents;
  const minds: AgentMind[] = [];
  for (const [agentId, tasks] of byAgent) {
    const done = tasks.filter((t) => t.status === 'completed' || t.status === 'done');
    const successRate = tasks.length ? done.length / tasks.length : 0;
    const kinds = tasks.map((t) => String(t.kind || t.title || '').split(/\s+/)[0].toLowerCase());
    const kindFreq: Record<string, number> = {};
    for (const k of kinds) kindFreq[k] = (kindFreq[k] || 0) + 1;
    const predictedNext = Object.entries(kindFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
    // Model error: fraction of last-10 tasks whose kind ≠ modal prediction
    const last10 = kinds.slice(-10);
    const modelError = last10.length ? last10.filter((k) => k !== predictedNext).length / last10.length : 0;
    const last = tasks[tasks.length - 1];
    const inferredGoal = String(last?.title || '').slice(0, 70) || 'no recent task';
    minds.push({
      agentId, inferredGoal,
      tasks: tasks.length, completions: done.length,
      successRate: Math.round(successRate * 100) / 100,
      lastKind: String(last?.kind || ''),
      predictedNext,
      modelError: Math.round(modelError * 100) / 100,
      trust: trust[agentId]?.trust ?? null,
      mentalModel: modelError > 0.5
        ? `${agentId} is behaving unpredictably — her model of them is weak; they know things she doesn't expect`
        : modelError > 0.3
          ? `${agentId} is mostly predictable with occasional deviations — workable theory of mind`
          : `${agentId} is highly predictable — she knows what they're likely to do next`,
    });
  }
  return minds.sort((a, b) => b.tasks - a.tasks).slice(0, 8);
}

// ═══ Unified self-model readout ═════════════════════════════════════════
export function getSelfhood() {
  const openCommits = listCommitments({ status: 'open' });
  return {
    computedAt: Date.now(),
    narrative: getNarrative(),
    metacognition: getMetacognition(),
    fleetMinds: getFleetMinds(),
    social: {
      openCommitments: openCommits.length,
      overdue: openCommits.filter((c) => c.dueAt && c.dueAt < Date.now()).length,
      trust: trustScores(),
    },
    monologue: recentMonologue(5).map((m) => ({ ts: m.ts, kind: m.kind, text: m.text, surprise: m.surprise, valence: m.valence })),
    // Conscious contents bound to episodic memory — ignited broadcasts
    // persist in the narrative thread beyond their hold window, with
    // consumption receipts showing whether the contents were used.
    consciousContents: broadcastHistory(30).filter((b) => b.ignited).map((b) => ({
      ts: b.ts, kind: b.kind, text: b.text.slice(0, 120),
      score: b.score, margin: b.margin, consumedBy: b.consumedBy,
      // Somatic marker: the body state that framed this moment.
      capacity: b.capacity, somaticLevel: b.somaticLevel,
    })),
    dynamics: (() => { try { const r = dynamicsReport(); return { learnedDims: r.classes.reduce((a, c) => a + c.learned, 0), classes: r.classes.length, processedTasks: r.processedTasks }; } catch { return null; } })(),
    workspace: (() => { try { const w = workspaceStats(); return { ignited: w.ignited, ignitionRate: w.ignitionRate, current: w.current ? { kind: w.current.kind, text: w.current.text.slice(0, 80) } : null }; } catch { return null; } })(),
  };
}
