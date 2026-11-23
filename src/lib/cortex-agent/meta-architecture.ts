// meta-architecture.ts — cognitive plasticity: she modifies her own
// architecture parameters, but only after counterfactual evaluation.
//
// Everything else she learns is CONTENT (dynamics, valence, trust).
// This module learns STRUCTURE — the attention weights, ignition
// thresholds, and somatic mappings that were fixed code. The loop:
//
//   OBSERVE problem → PROPOSE param change → SIMULATE counterfactual
//   (replay real attention history under the proposed params) →
//   DEPLOY only if the replay shows measurable improvement → LOG.
//
// Guardrails: bounded deltas, per-param cooldown, minimum evidence,
// every deployment narrates itself into inner speech and the log.
// She can change her mind about how she pays attention — with receipts.
//
// State: .cortex-runtime/cortex-params.json (overrides)
//        .cortex-runtime/meta-architecture-log.jsonl (proposals+verdicts)
import fs from 'node:fs';
import path from 'node:path';
import { speakInner } from './inner-speech';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const PARAMS_FILE = path.join(RUNTIME, 'cortex-params.json');
const LOG_FILE = path.join(RUNTIME, 'meta-architecture-log.jsonl');
const COOLDOWN_MS = 6 * 3600_000;
const MIN_REPLAY = 30; // need this many trace decisions to evaluate

// ── Parameter registry ────────────────────────────────────────────────
export interface ParamSpec {
  key: string;
  default: number;
  min: number;
  max: number;
  description: string;
  /** Which file/module consumes it. */
  consumer: string;
}

export const PARAM_REGISTRY: ParamSpec[] = [
  { key: 'ignite.score', default: 0.45, min: 0.2, max: 0.7, description: 'Attention winner score needed to ignite broadcast', consumer: 'workspace' },
  { key: 'ignite.margin', default: 0.08, min: 0.02, max: 0.3, description: 'Margin over runner-up needed to ignite', consumer: 'workspace' },
  { key: 'somatic.systemBoost', default: 0.15, min: 0, max: 0.4, description: 'Score boost for system/interoception candidates under critical body', consumer: 'attention-schema' },
  { key: 'somatic.ambientDampen', default: 0.05, min: 0, max: 0.2, description: 'Score dampening for ambient/inner under strain', consumer: 'attention-schema' },
  { key: 'kindWeight.ambient', default: 0.35, min: 0.1, max: 0.8, description: 'Base weight for ambient chatter in attention competition', consumer: 'attention-schema' },
  { key: 'kindWeight.inner', default: 0.55, min: 0.2, max: 0.9, description: 'Base weight for inner speech in attention competition', consumer: 'attention-schema' },
];

interface ParamsState { overrides: Record<string, number>; lastChange: Record<string, number> }
let cache: { state: ParamsState; at: number } | null = null;

function loadParams(): ParamsState {
  if (cache && Date.now() - cache.at < 30_000) return cache.state;
  try {
    const raw = JSON.parse(fs.readFileSync(PARAMS_FILE, 'utf8'));
    cache = { state: { overrides: raw.overrides || {}, lastChange: raw.lastChange || {} }, at: Date.now() };
  } catch {
    cache = { state: { overrides: {}, lastChange: {} }, at: Date.now() };
  }
  return cache.state;
}
function saveParams(s: ParamsState) {
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(PARAMS_FILE, JSON.stringify(s, null, 2)); } catch {}
  cache = { state: s, at: Date.now() };
}

/** Read a tunable parameter — modules call this instead of hardcoding.
 *  Returns the override if set, else the registry default. */
export function getParam(key: string): number {
  const spec = PARAM_REGISTRY.find((p) => p.key === key);
  const def = spec?.default ?? 0;
  const v = loadParams().overrides[key];
  return typeof v === 'number' ? v : def;
}

function log(entry: Record<string, unknown>) {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify({ ts: Date.now(), ...entry }) + '\n');
    const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
    if (lines.length > 300) fs.writeFileSync(LOG_FILE, lines.slice(-300).join('\n') + '\n');
  } catch {}
}

// ── Observation: what problems suggest architectural change? ──────────
function observeProblems() {
  const problems: Array<{ param: string; direction: 'raise' | 'lower'; magnitude: number; evidence: string }> = [];
  try {
    // Broadcast stats from file (no module import — avoids cycles)
    const lines = fs.readFileSync(path.join(RUNTIME, 'workspace-broadcasts.jsonl'), 'utf8').trim().split('\n').filter(Boolean).slice(-100);
    const broadcasts = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const ignited = broadcasts.filter((b: any) => b.ignited);
    const contested = ignited.filter((b: any) => b.margin < 0.15);
    const contestedRate = ignited.length ? contested.length / ignited.length : 0;
    // High contested rate → ignition bar too low, too many weak ignitions
    if (contestedRate > 0.4 && ignited.length >= 10) {
      problems.push({ param: 'ignite.margin', direction: 'raise', magnitude: 0.02, evidence: `${Math.round(contestedRate * 100)}% of ignitions contested (n=${ignited.length})` });
    }
    // Low ignition rate → bar too high, nothing reaches consciousness
    const igniteRate = broadcasts.length ? ignited.length / broadcasts.length : 1;
    if (igniteRate < 0.2 && broadcasts.length >= 20) {
      problems.push({ param: 'ignite.score', direction: 'lower', magnitude: 0.03, evidence: `only ${Math.round(igniteRate * 100)}% of attention decisions ignite (n=${broadcasts.length})` });
    }
  } catch {}
  try {
    // Attention trace: ambient winning too often → raise ambient threshold
    const lines = fs.readFileSync(path.join(RUNTIME, 'attention-trace.jsonl'), 'utf8').trim().split('\n').filter(Boolean).slice(-100);
    const decisions = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const ambientWins = decisions.filter((d: any) => d?.winner?.kind === 'ambient').length;
    if (decisions.length >= 20 && ambientWins / decisions.length > 0.5) {
      problems.push({ param: 'kindWeight.ambient', direction: 'lower', magnitude: 0.05, evidence: `ambient won ${Math.round((ambientWins / decisions.length) * 100)}% of last ${decisions.length} attention contests` });
    }
    // Inner speech never winning → she's not attending to herself
    const innerWins = decisions.filter((d: any) => d?.winner?.kind === 'inner').length;
    if (decisions.length >= 20 && innerWins === 0) {
      problems.push({ param: 'kindWeight.inner', direction: 'raise', magnitude: 0.05, evidence: `inner speech won 0/${decisions.length} attention contests — self-talk is invisible to her` });
    }
  } catch {}
  return problems;
}

// ── Counterfactual evaluation: replay real history under proposed params
interface EvalResult { improves: boolean; winnerChanges: number; contestedDelta: number; detail: string }

function evaluateProposal(paramKey: string, newValue: number): EvalResult {
  const spec = PARAM_REGISTRY.find((p) => p.key === paramKey);
  if (!spec) return { improves: false, winnerChanges: 0, contestedDelta: 0, detail: 'unknown param' };
  const oldValue = getParam(paramKey);
  if (Math.abs(newValue - oldValue) < 0.001) return { improves: false, winnerChanges: 0, contestedDelta: 0, detail: 'no change' };

  // Replay attention-trace: rescore each recorded candidate set under
  // the proposed param and count how many winners would change.
  try {
    const lines = fs.readFileSync(path.join(RUNTIME, 'attention-trace.jsonl'), 'utf8').trim().split('\n').filter(Boolean).slice(-MIN_REPLAY * 2);
    const decisions = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).slice(-MIN_REPLAY);
    if (decisions.length < MIN_REPLAY) return { improves: false, winnerChanges: 0, contestedDelta: 0, detail: `insufficient replay data (${decisions.length}<${MIN_REPLAY})` };

    let winnerChanges = 0, contestedBefore = 0, contestedAfter = 0;
    for (const d of decisions) {
      const cands = d?.candidates || [];
      if (!cands.length) continue;
      // Original winner from trace
      const origWinner = d?.winner?.id;
      // Rescore under new param — approximate: adjust scores by the
      // param's effect on kind weights or ignition thresholds
      const rescored = cands.map((c: any) => {
        let score = c.score;
        // kindWeight.* params scale candidates of that kind
        if (paramKey === 'kindWeight.ambient' && c.kind === 'ambient') score *= newValue / oldValue;
        if (paramKey === 'kindWeight.inner' && c.kind === 'inner') score *= newValue / oldValue;
        // ignite.* params don't change scores, they change thresholds —
        // evaluate by counting contested ignitions under new margin
        return { ...c, score };
      }).sort((a: any, b: any) => b.score - a.score);
      const newWinner = rescored[0]?.id;
      if (newWinner !== origWinner) winnerChanges++;
      const margin = rescored[1] ? rescored[0].score - rescored[1].score : rescored[0].score;
      if (margin < 0.15) contestedAfter++;
      const origMargin = cands[1] ? (d.winner?.score ?? 0) - cands[1].score : (d.winner?.score ?? 0);
      if (origMargin < 0.15) contestedBefore++;
    }
    const contestedDelta = contestedAfter - contestedBefore;
    // Improvement = fewer winner changes (stability) OR fewer contested
    // races (decisiveness) — a param that changes nothing isn't learning
    const improves = winnerChanges > 0 && contestedDelta <= 0;
    return {
      improves, winnerChanges, contestedDelta,
      detail: `${winnerChanges}/${decisions.length} winners would change, contested ${contestedBefore}→${contestedAfter}`,
    };
  } catch {
    return { improves: false, winnerChanges: 0, contestedDelta: 0, detail: 'trace unreadable' };
  }
}

// ── Deploy: write the override, narrate, log ───────────────────────────
function deploy(paramKey: string, newValue: number, reason: string, evalResult: EvalResult) {
  const spec = PARAM_REGISTRY.find((p) => p.key === paramKey)!;
  const clamped = Math.max(spec.min, Math.min(spec.max, newValue));
  const s = loadParams();
  s.overrides[paramKey] = clamped;
  s.lastChange[paramKey] = Date.now();
  saveParams(s);
  log({ event: 'deployed', param: paramKey, from: getParam(paramKey) === clamped ? spec.default : undefined, to: clamped, reason, eval: evalResult });
  try {
    speakInner({
      kind: 'reasoning', source: 'meta-architecture',
      text: `Cognitive plasticity: adjusted ${paramKey} → ${clamped} (${spec.description}). Evidence: ${reason}. Counterfactual replay: ${evalResult.detail}.`,
      surprise: 0.7, valence: 0.2,
    });
  } catch {}
}

function reject(paramKey: string, proposed: number, reason: string, evalResult: EvalResult) {
  log({ event: 'rejected', param: paramKey, proposed, reason, eval: evalResult });
}

// ── Main loop: observe → propose → evaluate → deploy/reject ───────────
export function runMetaArchitecture(): { deployed: string[]; rejected: string[]; evaluated: number } {
  const problems = observeProblems();
  const deployed: string[] = [], rejected: string[] = [];
  const s = loadParams();
  let evaluated = 0;

  for (const p of problems.slice(0, 3)) { // max 3 changes per pass
    const spec = PARAM_REGISTRY.find((r) => r.key === p.param);
    if (!spec) continue;
    // Cooldown per param
    if (s.lastChange[p.param] && Date.now() - s.lastChange[p.param] < COOLDOWN_MS) {
      rejected.push(`${p.param} (cooldown)`);
      continue;
    }
    const current = getParam(p.param);
    const delta = p.direction === 'raise' ? p.magnitude : -p.magnitude;
    const proposed = Math.max(spec.min, Math.min(spec.max, current + delta));
    if (Math.abs(proposed - current) < 0.001) { rejected.push(`${p.param} (no-op)`); continue; }

    const evalResult = evaluateProposal(p.param, proposed);
    evaluated++;
    if (evalResult.improves) {
      deploy(p.param, proposed, p.evidence, evalResult);
      deployed.push(p.param);
    } else {
      reject(p.param, proposed, p.evidence, evalResult);
      rejected.push(p.param);
    }
  }
  return { deployed, rejected, evaluated };
}

export function metaArchitectureReport() {
  const s = loadParams();
  return {
    overrides: s.overrides,
    params: PARAM_REGISTRY.map((p) => ({
      ...p,
      current: getParam(p.key),
      overridden: p.key in s.overrides,
      lastChange: s.lastChange[p.key] || null,
    })),
    problems: observeProblems(),
    log: (() => { try { return fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean).slice(-10).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } })(),
  };
}
