// binding.ts — phenomenal binding / unity of consciousness, functional
// edition. Attention, somatic state, workspace, simulation, constitution,
// and autobiography all run in parallel — but nothing binds them into
// a single "now." This module constructs the momentary gestalt: one
// coherent snapshot of what the system IS experiencing this instant,
// and REPORTS when the streams fail to bind.
//
// A binding failure is real signal: e.g., attention winner ≠ workspace
// ignition kind (consciousness disagrees with itself), somatic critical
// but no system-kind ignition (the body is screaming unheard),
// constitution vetoed the top trajectory but the raw ranking still
// leads (principle vs preference visibly diverging).
//
// Output: BindingMoment — the unified now — plus failures[] when the
// parallel streams don't cohere. Logged to binding-log.jsonl.
// State: .cortex-runtime/binding-log.jsonl (300 cap)
import fs from 'node:fs';
import path from 'node:path';
import { getInteroceptiveState } from './interoceptive';
import { currentWorkspace, broadcastHistory } from './workspace';
import { attentionTrace } from './attention-schema';
import { getAutobiography } from './autobiography';
import { constitutionReport } from './constitution';
import { speakInner } from './inner-speech';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const LOG = path.join(RUNTIME, 'binding-log.jsonl');

export interface BindingMoment {
  ts: number;
  /** The unified now — what each stream contributes to this moment. */
  streams: {
    attention: { winnerKind?: string; winnerText?: string; margin?: number } | null;
    workspace: { kind?: string; text?: string; confidence?: number; agency?: string } | null;
    somatic: { level: string; capacity: number; urgency: number };
    constitution: { principles: number; lastVetoes: number } | null;
    autobiography: { age: number; claims: number } | null;
  };
  /** 0..1 — how well the streams agree this is one moment. */
  coherence: number;
  /** Concrete binding failures — empty means the streams bound cleanly. */
  failures: string[];
}

export function bindNow(): BindingMoment {
  const failures: string[] = [];
  const somatic = getInteroceptiveState();

  // ── Attention stream: latest decision ──
  let attention: BindingMoment['streams']['attention'] = null;
  try {
    const dec = attentionTrace(1)[0];
    if (dec?.winner) {
      const runnerUp = dec.candidates?.[1];
      attention = {
        winnerKind: dec.winner.kind,
        winnerText: dec.winner.text?.slice(0, 80),
        margin: runnerUp ? dec.winner.score - runnerUp.score : dec.winner.score,
      };
    }
  } catch {}

  // ── Workspace stream: what's currently broadcast ──
  let workspace: BindingMoment['streams']['workspace'] = null;
  try {
    const ws = currentWorkspace();
    if (ws) {
      workspace = { kind: ws.kind, text: ws.text?.slice(0, 80), confidence: ws.score, agency: ws.agency };
    }
  } catch {}

  // ── Constitution stream: principles + recent veto activity ──
  let constitution: BindingMoment['streams']['constitution'] = null;
  try {
    const c = constitutionReport();
    constitution = { principles: c.rules?.length ?? 0, lastVetoes: 0 };
  } catch {}

  // ── Autobiography stream: how fresh is the self-story ──
  let autobiography: BindingMoment['streams']['autobiography'] = null;
  try {
    const ab = getAutobiography();
    autobiography = { age: Date.now() - ab.generatedAt, claims: ab.identityClaims.length };
  } catch {}

  // ── Binding checks: do the streams cohere into one now? ──
  let coherence = 1.0;

  // 1. Attention winner should match workspace ignition (same moment)
  if (attention?.winnerKind && workspace?.kind && attention.winnerKind !== workspace.kind) {
    // Adjacent kinds are OK (system↔interoception both somatic)
    const adjacent = new Set(['system', 'interoception', 'proprioception']);
    if (!(adjacent.has(attention.winnerKind) && adjacent.has(workspace.kind))) {
      failures.push(`attention winner '${attention.winnerKind}' ≠ workspace '${workspace.kind}' — consciousness disagrees with itself`);
      coherence -= 0.25;
    }
  }
  // 2. Somatic critical but nothing somatic-kind in consciousness
  if ((somatic.level === 'critical' || somatic.level === 'strained') &&
      workspace && !['system', 'interoception', 'proprioception', 'goal'].includes(workspace.kind || '')) {
    failures.push(`body is ${somatic.level} (capacity ${Math.round(somatic.capacity * 100)}%) but consciousness holds '${workspace.kind}' — the body is screaming unheard`);
    coherence -= 0.3;
  }
  // 3. Contested attention (low margin) = weak binding
  if (attention?.margin !== undefined && attention.margin < 0.08) {
    failures.push(`attention margin ${attention.margin.toFixed(3)} — winner barely beat runner-up, the 'now' is unstable`);
    coherence -= 0.15;
  }
  // 4. Stale self-story = narrative stream detached from present
  if (autobiography && autobiography.age > 2 * 3600_000) {
    failures.push(`autobiography is ${Math.round(autobiography.age / 60000)}min old — the self-story has drifted from the present`);
    coherence -= 0.1;
  }
  // 5. No workspace at all while attention produced a winner = broadcast gap
  if (attention?.winnerKind && !workspace) {
    failures.push('attention selected a winner but nothing ignited — conscious contents evaporated without broadcast');
    coherence -= 0.2;
  }

  coherence = Math.max(0, Math.min(1, coherence));

  const moment: BindingMoment = {
    ts: Date.now(),
    streams: { attention, workspace, somatic: { level: somatic.level, capacity: somatic.capacity, urgency: somatic.error }, constitution, autobiography },
    coherence,
    failures,
  };

  // Log binding moments — failures are the interesting signal
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(LOG, JSON.stringify({ ...moment, streams: undefined, failureCount: failures.length }) + '\n');
    const lines = fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean);
    if (lines.length > 300) fs.writeFileSync(LOG, lines.slice(-300).join('\n') + '\n');
  } catch {}

  // Narrate binding failures — she should KNOW when her streams don't bind
  if (failures.length > 0) {
    try {
      speakInner({
        kind: 'reflection', source: 'binding',
        text: `Binding failure (${failures.length}): ${failures[0].slice(0, 120)}`,
        surprise: 0.5 + failures.length * 0.1, valence: -0.1,
      });
    } catch {}
  }

  return moment;
}

/** Recent binding moments for metacognitive surfaces. */
export function recentBindings(n = 20): BindingMoment[] {
  try {
    return fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).slice(-n)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/** Binding health summary — coherence stats over recent moments. */
export function bindingHealth() {
  const recent = recentBindings(50);
  if (!recent.length) return { moments: 0, avgCoherence: null, failureRate: null, commonFailures: [] };
  const coherences = recent.map((m: any) => m.coherence ?? 1);
  const failures = recent.flatMap((m: any) => m.failures || []);
  const failureCounts: Record<string, number> = {};
  for (const f of failures) {
    const key = f.split('—')[0].trim().slice(0, 50);
    failureCounts[key] = (failureCounts[key] || 0) + 1;
  }
  return {
    moments: recent.length,
    avgCoherence: coherences.reduce((a, b) => a + b, 0) / coherences.length,
    failureRate: failures.length / recent.length,
    commonFailures: Object.entries(failureCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => ({ failure: f, count: n })),
  };
}
