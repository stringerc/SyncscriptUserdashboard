/**
 * Cortex Eval Harness — formal evaluation module (ECC eval-harness
 * adaptation, Cortex-native). Persistent EvalDefinitions + EvalRuns,
 * three grader types with an honesty hierarchy (code > model > human —
 * human-graded runs can never auto-pass), pass@k / pass^k reliability
 * metrics over k-trial runs, and automatic regression-eval registration
 * from resolved incidents.
 *
 * Storage: .cortex-runtime/evals.json (definitions, capped) +
 *          .cortex-runtime/eval-runs.jsonl (append-only run receipts).
 */

import fs from 'node:fs';
import path from 'node:path';

const RUNTIME_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const DEFS_FILE = path.join(RUNTIME_DIR, 'evals.json');
const RUNS_FILE = path.join(RUNTIME_DIR, 'eval-runs.jsonl');
const MAX_DEFS = 500;
const MAX_RUNS_KEPT = 2000;

export type EvalKind = 'capability' | 'regression';
export type GraderType = 'code' | 'model' | 'human';
export type EvalStatus = 'active' | 'retired';

export interface EvalArm {
  /** Arm label, e.g. 'baseline' | 'candidate' | model/tier name. */
  name: string;
  /** Optional system prompt override for this arm. */
  system?: string;
  /** Optional extra user-message suffix appended to the eval prompt. */
  suffix?: string;
  /** Optional model pin (e.g. 'groq-fast'); undefined = default matrix lane. */
  model?: string;
  /** Optional tier pin ('fast'|'reason'|'deep'). */
  tier?: 'fast' | 'reason' | 'deep';
}

export interface GraderSpec {
  type: GraderType;
  /** code grader: assertions run against arm output. */
  assertions?: Array<
    | { kind: 'regex'; pattern: string }
    | { kind: 'not_regex'; pattern: string }
    | { kind: 'json_field'; field: string; equals?: string; exists?: boolean }
    | { kind: 'min_length'; chars: number }
    | { kind: 'exact'; value: string }
  >;
  /** model grader: rubric text the judge model scores against (1-5). */
  rubric?: string;
  /** model grader: pass threshold on the 1-5 score. Default 4. */
  threshold?: number;
  /** human grader: what the Crew must check before approving. */
  instructions?: string;
}

export interface EvalDefinition {
  id: string;
  kind: EvalKind;
  /** What capability/behavior this measures. */
  subject: string;
  /** The prompt/task fed to each arm. */
  prompt: string;
  /** Deterministic-ish eval inputs may include vars later; keep simple now. */
  arms: EvalArm[];
  grader: GraderSpec;
  /** Trials per arm per run. pass@k and pass^k derive from these. Default 1. */
  k: number;
  /** ventureId scope — evals are venture-tagged like everything else. */
  ventureId?: string;
  /** agentId this eval targets (e.g. 'reviewer'), for scorecards. */
  agentId?: string;
  /** incident key/id that auto-registered this regression eval. */
  sourceIncidentId?: string;
  status: EvalStatus;
  createdAt: number;
  createdBy: string;
  notes?: string;
}

export interface TrialResult {
  arm: string;
  trial: number;
  output: string;
  pass: boolean;
  score?: number;
  graderDetail: string;
  error?: string;
}

export interface EvalRun {
  id: string;
  evalId: string;
  startedAt: number;
  finishedAt: number;
  /** pass@k per arm: P(at least one of k trials passes). */
  passAtK: Record<string, number>;
  /** pass^k per arm: P(all k trials pass) — reliability under repetition. */
  passCaretK: Record<string, number>;
  trials: TrialResult[];
  verdict: 'pass' | 'fail' | 'inconclusive' | 'pending-human';
  /** For two-arm runs: which arm won (higher pass^k, tie → pass@k). */
  winner?: string;
  costTokens: number;
}

export interface LlmFn {
  (opts: { tier?: 'fast' | 'reason' | 'deep'; model?: string; messages: { role: string; content: string }[]; maxTokens?: number }): Promise<{ content: string }>;
}

export interface RunDeps {
  llm: LlmFn;
  /** Optional venture validation — defaults to accepting any tag. */
}

function ensureDir() {
  if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

function readDefs(): EvalDefinition[] {
  try {
    ensureDir();
    if (!fs.existsSync(DEFS_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(DEFS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeDefs(defs: EvalDefinition[]) {
  ensureDir();
  const capped = defs.slice(-MAX_DEFS);
  fs.writeFileSync(DEFS_FILE, JSON.stringify(capped, null, 2));
}

function appendRun(run: EvalRun) {
  ensureDir();
  fs.appendFileSync(RUNS_FILE, JSON.stringify(run) + '\n');
  // Bound the run log: keep last MAX_RUNS_KEPT lines.
  try {
    const lines = fs.readFileSync(RUNS_FILE, 'utf8').split('\n').filter(Boolean);
    if (lines.length > MAX_RUNS_KEPT) {
      fs.writeFileSync(RUNS_FILE, lines.slice(-MAX_RUNS_KEPT).join('\n') + '\n');
    }
  } catch { /* best-effort bound */ }
}

export function readRuns(evalId?: string, limit = 100): EvalRun[] {
  try {
    ensureDir();
    if (!fs.existsSync(RUNS_FILE)) return [];
    const lines = fs.readFileSync(RUNS_FILE, 'utf8').split('\n').filter(Boolean);
    const runs = lines.map((l) => { try { return JSON.parse(l) as EvalRun; } catch { return null; } })
      .filter((r): r is EvalRun => !!r)
      .filter((r) => !evalId || r.evalId === evalId)
      .slice(-limit);
    return runs.reverse();
  } catch { return []; }
}

export function listEvals(opts: { kind?: EvalKind; status?: EvalStatus; ventureId?: string; agentId?: string } = {}): EvalDefinition[] {
  return readDefs()
    .filter((d) => (!opts.kind || d.kind === opts.kind))
    .filter((d) => (!opts.status || d.status === opts.status))
    .filter((d) => (!opts.ventureId || !d.ventureId || d.ventureId === opts.ventureId))
    .filter((d) => (!opts.agentId || !d.agentId || d.agentId === opts.agentId));
}

export function getEval(id: string): EvalDefinition | null {
  return readDefs().find((d) => d.id === id) ?? null;
}

export function fileEvalDefinition(def: Omit<EvalDefinition, 'id' | 'createdAt' | 'status'> & { id?: string }): EvalDefinition {
  const defs = readDefs();
  const full: EvalDefinition = {
    ...def,
    id: def.id || `eval-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    k: Math.max(1, Math.min(10, def.k || 1)),
    status: 'active',
    createdAt: Date.now(),
    createdBy: def.createdBy || 'cortex',
  } as EvalDefinition;
  // Idempotent regression registration: same subject+prompt+agent → reuse.
  const dup = defs.find((d) =>
    d.subject === full.subject && d.prompt === full.prompt &&
    (d.agentId || '') === (full.agentId || '') && d.status === 'active');
  if (dup) return dup;
  defs.push(full);
  writeDefs(defs);
  return full;
}

/** Grade one arm output. Honesty hierarchy: code > model > human(pending). */
async function gradeOutput(
  grader: GraderSpec,
  output: string,
  ctx: { llm: LlmFn; armName: string },
): Promise<{ pass: boolean; score?: number; detail: string }> {
  if (grader.type === 'code') {
    const assertions = grader.assertions || [];
    if (!assertions.length) return { pass: true, detail: 'code grader: no assertions (vacuous pass)' };
    const failures: string[] = [];
    for (const a of assertions) {
      if (a.kind === 'regex' && !new RegExp(a.pattern, 'is').test(output)) failures.push(`missing /${a.pattern}/`);
      else if (a.kind === 'not_regex' && new RegExp(a.pattern, 'is').test(output)) failures.push(`forbidden /${a.pattern}/ present`);
      else if (a.kind === 'min_length' && output.length < a.chars) failures.push(`output ${output.length}ch < ${a.chars}ch`);
      else if (a.kind === 'exact' && output.trim() !== a.value) failures.push('output not exact match');
      else if (a.kind === 'json_field') {
        try {
          const parsed = JSON.parse(output);
          const val = a.field.split('.').reduce((o: any, k) => o?.[k], parsed);
          if (a.exists !== undefined ? (val !== undefined) !== a.exists : String(val) !== String(a.equals)) {
            failures.push(`json_field ${a.field} mismatch`);
          }
        } catch { failures.push('output is not valid JSON'); }
      }
    }
    return { pass: failures.length === 0, detail: failures.length ? failures.join('; ') : 'all assertions passed' };
  }
  if (grader.type === 'model') {
    const threshold = grader.threshold ?? 4;
    const rubric = grader.rubric || 'Score the output 1-5 on correctness and task completion.';
    try {
      const res = await ctx.llm({
        tier: 'fast',
        maxTokens: 120,
        messages: [
          { role: 'system', content: 'You are an eval judge. Output ONLY a JSON object {"score": <1-5>, "reason": "<one line>"}. Be strict: 5 requires proof, not persuasive prose.' },
          { role: 'user', content: `RUBRIC: ${rubric}\nARM: ${ctx.armName}\nOUTPUT:\n${output.slice(0, 8000)}` },
        ],
      });
      const m = String(res.content).match(/\{[^}]*"score"\s*:\s*(\d)[^}]*\}/);
      const score = m ? parseInt(m[1], 10) : 0;
      const reason = (String(res.content).match(/"reason"\s*:\s*"([^"]{0,200})/) || [])[1] || '';
      return { pass: score >= threshold, score, detail: `model score ${score}/5 (need ≥${threshold}) ${reason}`.trim() };
    } catch (e: any) {
      return { pass: false, score: 0, detail: `model grader error: ${e?.message || 'unknown'}` };
    }
  }
  // human grader — never auto-passes; marks run pending-human.
  return { pass: false, score: undefined, detail: `pending human review: ${grader.instructions || 'manual check required'}` };
}

/** Execute one eval definition across all arms × k trials. */
export async function runEval(defId: string, deps: RunDeps): Promise<EvalRun> {
  const def = getEval(defId);
  if (!def) throw new Error(`eval not found: ${defId}`);
  if (def.grader.type === 'human') {
    const run: EvalRun = {
      id: `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      evalId: def.id, startedAt: Date.now(), finishedAt: Date.now(),
      passAtK: {}, passCaretK: {}, trials: [], verdict: 'pending-human',
      costTokens: 0,
    };
    appendRun(run);
    return run;
  }

  const k = def.k;
  const trials: TrialResult[] = [];
  let costTokens = 0;

  for (const arm of def.arms) {
    for (let t = 0; t < k; t++) {
      try {
        const res = await deps.llm({
          tier: arm.tier || 'fast',
          model: arm.model,
          maxTokens: 1200,
          messages: [
            ...(arm.system ? [{ role: 'system' as const, content: arm.system }] : []),
            { role: 'user' as const, content: def.prompt + (arm.suffix ? `\n\n${arm.suffix}` : '') },
          ],
        });
        const output = String(res.content || '');
        const graded = await gradeOutput(def.grader, output, { llm: deps.llm, armName: arm.name });
        trials.push({ arm: arm.name, trial: t, output: output.slice(0, 4000), pass: graded.pass, score: graded.score, graderDetail: graded.detail });
      } catch (e: any) {
        trials.push({ arm: arm.name, trial: t, output: '', pass: false, graderDetail: `arm error: ${e?.message || 'unknown'}` });
      }
    }
  }

  // pass@k: ≥1 of k trials passed. pass^k: all k passed.
  const passAtK: Record<string, number> = {};
  const passCaretK: Record<string, number> = {};
  for (const arm of def.arms) {
    const armTrials = trials.filter((tr) => tr.arm === arm.name);
    const passes = armTrials.filter((tr) => tr.pass).length;
    passAtK[arm.name] = armTrials.length ? passes / armTrials.length : 0; // mean pass rate per trial
    passCaretK[arm.name] = armTrials.length && passes === armTrials.length ? 1 : 0;
  }
  // For single-trial (k=1) pass@k and pass^k coincide — report both anyway.

  let verdict: EvalRun['verdict'] = 'fail';
  let winner: string | undefined;
  const arms = def.arms.map((a) => a.name);
  if (arms.length >= 2) {
    // Winner = arm with highest pass^k; tie-break pass@k; require strictly better to declare.
    const sorted = [...arms].sort((a, b) => (passCaretK[b] - passCaretK[a]) || (passAtK[b] - passAtK[a]));
    const [top, second] = sorted;
    if (passCaretK[top] > passCaretK[second] || (passCaretK[top] === passCaretK[second] && passAtK[top] > passAtK[second])) {
      winner = top;
      verdict = top === 'candidate' || !arms.includes('baseline') ? 'pass' : 'fail';
      // verdict 'pass' means candidate/eval arm beat baseline — caller interprets.
      if (arms.includes('baseline') && winner === 'baseline') verdict = 'fail';
    } else {
      verdict = 'inconclusive';
    }
  } else {
    verdict = arms.every((a) => passCaretK[a] === 1) ? 'pass' : 'fail';
  }

  const run: EvalRun = {
    id: `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    evalId: def.id, startedAt: Date.now() - 1, finishedAt: Date.now(),
    passAtK, passCaretK, trials, verdict, winner,
    costTokens,
  };
  run.startedAt = trials.length ? run.finishedAt : run.startedAt;
  appendRun(run);
  return run;
}

/**
 * Auto-register a regression eval from a resolved incident. The eval
 * reproduces the failure signature: same agent+kind, prompt derived from
 * the incident title/error. Deduped by fileEvalDefinition.
 */
export function registerRegressionEvalFromIncident(inc: {
  id: string; key: string; agentId: string; kind: string; title: string;
  lastError?: string; failureClass?: string; firstSeenAt: number;
}): EvalDefinition | null {
  try {
    const prompt = [
      `Regression check for incident: ${inc.title}`,
      inc.lastError ? `Prior failure: ${inc.lastError.slice(0, 300)}` : '',
      `Agent ${inc.agentId} kind ${inc.kind} previously failed with class ${inc.failureClass || 'unknown'}.`,
      'Verify the failure mode is gone: produce a minimal successful execution or state plainly why it still fails.',
    ].filter(Boolean).join('\n');
    return fileEvalDefinition({
      kind: 'regression',
      subject: `${inc.agentId}/${inc.kind}`,
      prompt,
      arms: [{ name: 'candidate', tier: 'fast' }],
      grader: {
        type: 'model',
        rubric: 'Does the output demonstrate the previously-failing operation now succeeds, or honestly report a remaining blocker? Pass only on demonstrated success or precise diagnosis.',
        threshold: 4,
      },
      k: 1,
      agentId: inc.agentId,
      sourceIncidentId: inc.id,
      createdBy: 'incident-regression',
      notes: `auto-registered from incident ${inc.key} at ${new Date(inc.firstSeenAt).toISOString()}`,
    });
  } catch { return null; }
}

/** Per-agent eval scorecard: latest verdict per eval + aggregate pass rates. */
export function evalScorecard(agentId?: string): {
  agentId?: string;
  evals: Array<{ id: string; subject: string; kind: EvalKind; status: EvalStatus; lastRun?: { verdict: string; at: number; winner?: string } }>;
  totals: { evals: number; runs: number; passes: number; fails: number; pending: number };
} {
  const defs = listEvals(agentId ? { agentId } : {});
  const runs = readRuns(undefined, 500);
  const byEval = new Map<string, EvalRun[]>();
  for (const r of runs) {
    if (!byEval.has(r.evalId)) byEval.set(r.evalId, []);
    byEval.get(r.evalId)!.push(r);
  }
  const evals = defs.map((d) => {
    const rs = (byEval.get(d.id) || []).sort((a, b) => b.finishedAt - a.finishedAt);
    const last = rs[0];
    return {
      id: d.id, subject: d.subject, kind: d.kind, status: d.status,
      lastRun: last ? { verdict: last.verdict, at: last.finishedAt, winner: last.winner } : undefined,
    };
  });
  const allRuns = runs.filter((r) => !agentId || defs.some((d) => d.id === r.evalId));
  return {
    agentId,
    evals,
    totals: {
      evals: defs.length,
      runs: allRuns.length,
      passes: allRuns.filter((r) => r.verdict === 'pass').length,
      fails: allRuns.filter((r) => r.verdict === 'fail').length,
      pending: allRuns.filter((r) => r.verdict === 'pending-human' || r.verdict === 'inconclusive').length,
    },
  };
}

/** Evidence summary for proposals: latest run per eval id. */
export function evalEvidenceFor(evalIds: string[]): Array<{ evalId: string; verdict: string; passCaretK: Record<string, number>; at: number }> {
  const out: Array<{ evalId: string; verdict: string; passCaretK: Record<string, number>; at: number }> = [];
  for (const id of evalIds.slice(0, 10)) {
    const last = readRuns(id, 1)[0];
    if (last) out.push({ evalId: id, verdict: last.verdict, passCaretK: last.passCaretK, at: last.finishedAt });
  }
  return out;
}

/** Compare two eval ids' latest runs — baseline vs candidate evidence. */
export function evalComparison(baselineEvalId: string, candidateEvalId: string) {
  const b = readRuns(baselineEvalId, 1)[0];
  const c = readRuns(candidateEvalId, 1)[0];
  return {
    baseline: b ? { evalId: baselineEvalId, verdict: b.verdict, passAtK: b.passAtK, passCaretK: b.passCaretK, at: b.finishedAt } : null,
    candidate: c ? { evalId: candidateEvalId, verdict: c.verdict, passAtK: c.passAtK, passCaretK: c.passCaretK, at: c.finishedAt } : null,
  };
}
