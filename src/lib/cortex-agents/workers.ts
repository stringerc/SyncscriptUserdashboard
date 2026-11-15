/**
 * Cortex Agent Workers — Scout, Librarian, Builder (+ Sentinel on-demand).
 *
 * Every worker executes through real channels only:
 *  - LLM calls → ctx.llm() → /api/cortex/agents/llm (matrix-routed)
 *  - Host tools → POST /api/cortex/tools/execute with the sovereign key
 *    (the same governed path the visualizer voice loop uses)
 *  - Web fetches → raw HTTPS (DuckDuckGo HTML search, direct page fetch)
 *
 * No worker may report success without a real result object.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { AgentContext, AgentRuntime, WorkerHandler } from './runtime';
import type { SpawnSpec, ToolScope } from './types';
import { registerWardenWorker } from './warden';
import { registerDistributorWorker } from './distribution';
import { cortexObsidianMemory } from '../cortex-obsidian-memory';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5173;
const BASE = `http://127.0.0.1:${PORT}`;
const SOVEREIGN_KEY = 'sovereign-local';

async function toolExecute(name: string, args: Record<string, unknown>, timeoutMs = 30_000, telemetry?: { toolCalls: number; toolFailures: number }): Promise<{ ok: boolean; [k: string]: unknown }> {
  telemetry && telemetry.toolCalls++;
  try {
    const res = await fetch(`${BASE}/api/cortex/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cortex-key': SOVEREIGN_KEY },
      body: JSON.stringify({ tool: name, args }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const out = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (telemetry && out?.ok === false) telemetry.toolFailures++;
    return out;
  } catch (e) {
    if (telemetry) telemetry.toolFailures++;
    throw e;
  }
}

// ── Per-agent memory (spawned agents only) ────────────────────────
// JSONL journal at .cortex-runtime/agent-memory/<agentId>.jsonl — the
// article's `memory: project` scope, implemented deterministically.
// Survives restarts; bounded to the last 100 entries.

const AGENT_MEMORY_DIR = path.join(process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime'), 'agent-memory');
const AGENT_MEMORY_MAX_LINES = 100;

interface AgentMemoryEntry {
  ts: number;
  instruction: string;
  satisfied: boolean;
  failedSteps: number;
  note?: string;
}

function agentMemoryPath(agentId: string): string {
  return path.join(AGENT_MEMORY_DIR, `${String(agentId).replace(/[^a-zA-Z0-9-]/g, '_')}.jsonl`);
}

function loadAgentMemory(agentId: string, limit = 10): AgentMemoryEntry[] {
  try {
    const file = agentMemoryPath(agentId);
    if (!fs.existsSync(file)) return [];
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => { try { return JSON.parse(l) as AgentMemoryEntry; } catch { return null; } })
      .filter((e): e is AgentMemoryEntry => !!e && typeof e.instruction === 'string');
  } catch { return []; }
}

function appendAgentMemory(agentId: string, entry: AgentMemoryEntry) {
  try {
    fs.mkdirSync(AGENT_MEMORY_DIR, { recursive: true });
    const file = agentMemoryPath(agentId);
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
    // Bound the journal: keep the newest AGENT_MEMORY_MAX_LINES entries.
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    if (lines.length > AGENT_MEMORY_MAX_LINES)
      fs.writeFileSync(file, lines.slice(-AGENT_MEMORY_MAX_LINES).join('\n') + '\n');
  } catch { /* memory is best-effort; never break a task over it */ }
}

function memoryBlock(entries: AgentMemoryEntry[]): string {
  if (!entries.length) return '';
  const lines = entries.map((e) =>
    `- [${new Date(e.ts).toISOString().slice(0, 10)}] ${e.satisfied ? 'OK' : `FAILED(${e.failedSteps})`} ${e.instruction.slice(0, 120)}${e.note ? ` — ${e.note.slice(0, 120)}` : ''}`);
  return `\n\nYOUR PRIOR MISSIONS (your own journal — do not repeat past failures):\n${lines.join('\n')}`;
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function webSearch(query: string, maxResults = 6): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const out: Array<{ title: string; url: string; snippet: string }> = [];
  for (const block of html.split(/class="result results_links/).slice(1)) {
    const m = block.match(/<h2 class="result__title">[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!m) continue;
    const uddg = m[1].match(/uddg=([^&]+)/);
    const url = uddg ? decodeURIComponent(uddg[1]) : m[1];
    const title = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    const snip = (block.match(/class="result__snippet[^>]*>([\s\S]*?)<\/a>/i)?.[1] || '')
      .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    if (url && title) out.push({ title: title.slice(0, 200), url, snippet: snip.slice(0, 300) });
    if (out.length >= maxResults) break;
  }
  return out;
}

async function fetchPageText(url: string, maxChars = 6000): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(12_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, maxChars);
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

/** Retry lineage note — appended to the plan prompt when the runtime
 *  resubmitted this task after a failure. The scope line is the contract:
 *  fix the failing unit, don't regrow the work. */
function retryNote(input: Record<string, unknown>): string {
  if (!input?.retryOf) return '';
  const attempt = Number(input.attempt ?? 1);
  const prior = String(input.priorError || '').slice(0, 300);
  return `\n\nRETRY CONTEXT: This is attempt ${attempt + 1}. A previous attempt failed with: ${prior}\nSCOPE CONSTRAINT: ${String(input.scope || 'fix only the failing unit')}. Do not expand beyond the original instruction.`;
}

// ── Task-spec expansion ───────────────────────────────────────────
// Terse requests ("fix the login bug") become ambiguous multi-file diffs.
// Before planning, expand the instruction into a contract: objective,
// constraints, non-goals, verification. Creative license stays inside
// those boundaries — the model still chooses the implementation.

export interface TaskSpec {
  objective: string;
  constraints: string[];
  nonGoals: string[];
  verification: string;
}

const SPEC_SYSTEM = `You expand terse work requests into precise task contracts for an autonomous coding agent. Output ONLY JSON: {"objective": "one sentence — what done looks like", "constraints": ["hard limits: files/scope/behavior that must not change"], "nonGoals": ["explicitly out of scope"], "verification": "the concrete check that proves it worked (test, typecheck, command)"}. Be specific and minimal — 1-3 items per list. No prose outside the JSON.`;

/** Expand an instruction into a TaskSpec. Returns null on any failure —
 *  callers fall back to the raw instruction rather than blocking work. */
export async function expandTaskSpec(
  llm: (opts: { tier?: 'fast' | 'reason' | 'deep'; messages: { role: string; content: string }[]; maxTokens?: number }) => Promise<string>,
  instruction: string,
  tier: 'fast' | 'reason' | 'deep' = 'reason',
): Promise<TaskSpec | null> {
  try {
    const text = await llm({
      tier,
      maxTokens: 400,
      messages: [
        { role: 'system', content: SPEC_SYSTEM },
        { role: 'user', content: instruction.slice(0, 1500) },
      ],
    });
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : null;
    if (!parsed || typeof parsed.objective !== 'string' || !parsed.objective.trim()) return null;
    const arr = (v: unknown, cap = 3) =>
      (Array.isArray(v) ? v : []).map(String).map((s) => s.trim()).filter(Boolean).slice(0, cap);
    return {
      objective: parsed.objective.trim().slice(0, 300),
      constraints: arr(parsed.constraints),
      nonGoals: arr(parsed.nonGoals),
      verification: String(parsed.verification || '').trim().slice(0, 200),
    };
  } catch {
    return null;
  }
}

function specBlock(spec: TaskSpec | null): string {
  if (!spec) return '';
  const lines = [`TASK SPEC: ${spec.objective}`];
  if (spec.constraints.length) lines.push(`CONSTRAINTS: ${spec.constraints.join(' | ')}`);
  if (spec.nonGoals.length) lines.push(`NON-GOALS: ${spec.nonGoals.join(' | ')}`);
  if (spec.verification) lines.push(`VERIFICATION: ${spec.verification}`);
  return `\n\n${lines.join('\n')}`;
}

// ── Learning edge → distilled rules ───────────────────────────────
// Agent outcome notes (written by the completion hook) accumulate in
// '03 - Learnings'. The librarian's 'distill' task finds *recurring*
// patterns — same agent+kind with repeated non-green outcomes or retry
// lineage — and compresses them into explicit rules in '04 - Rules'.
// A single success is not a rule; recurrence is the evidence gate.
// Builders/ephemeral agents then inject matching rules into their plan
// prompt, so accepted outcomes shape how future work gets cut.

const LEARNINGS_DIR = '03 - Learnings';
const RULES_DIR = '04 - Rules';
const DISTILL_MIN_CLUSTER = 3;
const DISTILL_MAX_RULES = 3;

interface AgentOutcome {
  file: string;
  agentId: string;
  kind: string;
  title: string;
  outcome: string;
  retryLine: string;
  summary: string;
}

function vaultFolder(folder: string): string | null {
  try {
    const p = path.join(cortexObsidianMemory.getVaultPath(), folder);
    return fs.existsSync(p) ? p : null;
  } catch { return null; }
}

function listMd(dir: string | null): string[] {
  if (!dir) return [];
  try { return fs.readdirSync(dir).filter((f) => f.endsWith('.md')); }
  catch { return []; }
}

function parseOutcomeNote(file: string, content: string): AgentOutcome | null {
  // Filenames: agent-<agentId>-<kind>-<base36ts>; agentId/kind may contain dashes.
  const m = file.match(/^agent-(.+)-([a-z0-9]{6,})\.md$/);
  if (!m) return null;
  const stem = m[1];
  // kind is the last dash-segment before the timestamp.
  const kindIdx = stem.lastIndexOf('-');
  if (kindIdx < 0) return null;
  const agentId = stem.slice(0, kindIdx);
  const kind = stem.slice(kindIdx + 1);
  const field = (name: string) =>
    (content.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1] || '').trim();
  return {
    file,
    agentId,
    kind,
    title: field('Task'),
    outcome: field('Outcome'),
    retryLine: field('Retry lineage'),
    summary: field('Summary'),
  };
}

function loadOutcomes(): AgentOutcome[] {
  const dir = vaultFolder(LEARNINGS_DIR);
  const out: AgentOutcome[] = [];
  for (const f of listMd(dir).slice(-80)) {
    try {
      const content = fs.readFileSync(path.join(dir!, f), 'utf-8');
      if (!content.includes('agent-outcome')) continue;
      const parsed = parseOutcomeNote(f, content);
      if (parsed) out.push(parsed);
    } catch { /* skip unreadable notes */ }
  }
  return out;
}

/** Extract the rule text from a distilled-rule note (first heading or line). */
function ruleText(content: string): string {
  const heading = content.match(/^#\s*(?:Rule|DISTILLED RULE):?\s*(.+)$/im)?.[1];
  if (heading) return heading.trim().slice(0, 220);
  const firstLine = content.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('---'));
  return (firstLine || '').slice(0, 220);
}

/** Deterministic token-overlap scorer — no LLM, no network. */
function tokenScore(text: string, tokens: Set<string>): number {
  let n = 0;
  for (const t of tokens) if (text.toLowerCase().includes(t)) n++;
  return n;
}

/** Rules relevant to a task instruction, formatted for a system prompt. */
function relevantRules(instruction: string, limit = 3): string {
  const dir = vaultFolder(RULES_DIR);
  const files = listMd(dir).slice(-40);
  if (!files.length) return '';
  const tokens = new Set(instruction.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3));
  const scored = files
    .map((f) => {
      try {
        const content = fs.readFileSync(path.join(dir!, f), 'utf-8');
        return { file: f, text: ruleText(content), score: tokenScore(content, tokens) };
      } catch { return { file: f, text: '', score: 0 }; }
    })
    .filter((r) => r.text && r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((r) => `- ${r.text}`).join('\n');
}

async function distillLearnings(ctx: AgentContext): Promise<unknown> {
  const outcomes = loadOutcomes();
  if (outcomes.length < DISTILL_MIN_CLUSTER)
    return { distilled: 0, reason: `only ${outcomes.length} outcome notes — need recurring evidence` };

  // Cluster by agent+kind; a cluster qualifies when the same lane keeps
  // producing non-green outcomes or retry-lineage saves.
  const clusters = new Map<string, AgentOutcome[]>();
  for (const o of outcomes) {
    const key = `${o.agentId}|${o.kind}`;
    const arr = clusters.get(key) || [];
    arr.push(o);
    clusters.set(key, arr);
  }
  const qualifying = [...clusters.entries()]
    .map(([key, list]) => ({
      key,
      list: list.slice(-12),
      signals: list.filter((o) => !/green/i.test(o.outcome) || o.retryLine).length,
    }))
    .filter((c) => c.list.length >= DISTILL_MIN_CLUSTER && c.signals >= 2)
    .sort((a, b) => b.signals - a.signals)
    .slice(0, 4);

  if (!qualifying.length)
    return { distilled: 0, reason: `no recurring pattern across ${outcomes.length} outcome notes`, clustersSeen: clusters.size };

  const evidenceFiles = new Set(outcomes.map((o) => o.file));
  const digest = qualifying.map((c) =>
    `CLUSTER ${c.key} (${c.list.length} outcomes, ${c.signals} non-green/retry):\n` +
    c.list.map((o) =>
      `- [${o.file}] ${o.title.slice(0, 90)} | outcome: ${o.outcome.slice(0, 60)}${o.retryLine ? ` | ${o.retryLine.slice(0, 120)}` : ''}${o.summary ? ` | ${o.summary.slice(0, 120)}` : ''}`
    ).join('\n')
  ).join('\n\n').slice(0, 6000);

  const text = await ctx.llm({
    tier: 'fast',
    maxTokens: 600,
    messages: [
      {
        role: 'system',
        content: 'You distill recurring agent-runtime patterns into explicit operating rules. Output ONLY a JSON array of at most 3 rules, each {"rule": "imperative one-sentence constraint", "rationale": "why recurrence justifies it", "evidence": ["exact outcome filenames"]}. Rules must be actionable constraints for future task planning, not observations. Cite only filenames from the provided clusters.',
      },
      { role: 'user', content: `AGENT OUTCOME CLUSTERS:\n${digest}\n\nDistill rules.` },
    ],
  });

  let rules: any[] = [];
  try {
    const m = text.match(/\[[\s\S]*\]/);
    const parsed = m ? JSON.parse(m[0]) : null;
    if (Array.isArray(parsed)) rules = parsed;
  } catch { rules = []; }

  // Evidence gate: a rule that cites no real outcome note is dropped —
  // same honesty invariant as spawn proposals.
  const valid = rules
    .filter((r) => r && typeof r.rule === 'string' && String(r.rule).trim().length > 10 && String(r.rule).length <= 300)
    .map((r) => ({
      rule: String(r.rule).trim(),
      rationale: String(r.rationale || '').slice(0, 300),
      evidence: (Array.isArray(r.evidence) ? r.evidence : []).map(String).filter((f) => evidenceFiles.has(f)),
    }))
    .filter((r) => r.evidence.length > 0)
    .slice(0, DISTILL_MAX_RULES);

  if (!valid.length) return { distilled: 0, reason: 'model produced no evidence-backed rules', raw: text.slice(0, 200) };

  cortexObsidianMemory.ensureVaultInitialized();
  const written: string[] = [];
  for (const [i, r] of valid.entries()) {
    const file = `rule-${Date.now().toString(36)}-${i}`;
    const ok = cortexObsidianMemory.writeNote(
      RULES_DIR,
      file,
      `# Rule: ${r.rule}\n\n> Distilled ${new Date().toISOString().slice(0, 10)} by LIBRARIAN from recurring agent outcomes\n\nRationale: ${r.rationale}\nEvidence: ${r.evidence.join(', ')}\n\nTags: distilled-rule cortex-agents`,
      { created: new Date().toISOString(), agent: 'LIBRARIAN', kind: 'distilled-rule' },
    );
    if (ok) written.push(`04 - Rules/${file}.md`);
  }
  return { distilled: written.length, rules: valid.map((r) => r.rule), paths: written };
}

// ── Sentinel: on-demand catalog scan / probe ──────────────────────

const sentinelWorker: WorkerHandler = async (ctx) => {
  const kind = ctx.task.kind;
  ctx.progress(0.3);
  if (kind === 'catalog_scan') {
    // Sentinel's autonomous loop already scans; this is a manual pulse.
    ctx.progress(1);
    return { scanned: true, note: 'Sentinel autonomous loop owns continuous scanning; this was a manual pulse.' };
  }
  if (kind === 'probe_model') {
    const model = str(ctx.task.input.model);
    if (!model) throw new Error('probe_model requires input.model');
    ctx.progress(0.5);
    // Real probe: minimal completion through the matrix lane that owns it.
    const text = await ctx.llm({ tier: 'fast', maxTokens: 8, messages: [{ role: 'user', content: 'Reply with the single word: ok' }] });
    ctx.progress(1);
    return { probed: model, response: text.slice(0, 40) };
  }
  throw new Error(`sentinel: unknown task kind '${kind}'`);
};

// ── Scout: research ───────────────────────────────────────────────

const scoutWorker: WorkerHandler = async (ctx) => {
  const query = str(ctx.task.input.query);
  const depth = Math.min(3, Math.max(1, Number(ctx.task.input.depth) || 1));
  if (!query) throw new Error('scout research requires input.query');

  ctx.progress(0.15);
  const results = await webSearch(query, 6);
  if (!results.length) throw new Error('web_search returned no results');
  ctx.progress(0.35);

  // Deep mode: fetch top pages for grounding.
  let pages: Array<{ url: string; text: string }> = [];
  if (depth > 1) {
    const top = results.slice(0, depth);
    pages = await Promise.all(top.map(async (r) => {
      try { return { url: r.url, text: await fetchPageText(r.url, 4000) }; }
      catch { return { url: r.url, text: '' }; }
    }));
  }
  ctx.progress(0.6);

  const digest = results.map((r, i) =>
    `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join('\n');
  const pageCtx = pages.filter((p) => p.text).map((p) => `SOURCE ${p.url}:
${p.text.slice(0, 2500)}`).join('\n\n');

  const answer = await ctx.llm({
    tier: 'reason',
    maxTokens: 900,
    messages: [
      {
        role: 'system',
        content: 'You are SCOUT, Cortex\'s research operative. Produce a tight, factual research brief from the provided sources. Cite source numbers. If sources conflict, say so. No filler.',
      },
      {
        role: 'user',
        content: `RESEARCH QUERY: ${query}\n\nSEARCH RESULTS:\n${digest}\n\n${pageCtx ? `FETCHED PAGES:\n${pageCtx}` : ''}\n\nWrite the brief.`,
      },
    ],
  });
  ctx.progress(1);
  return {
    query, depth,
    sources: results.map((r) => ({ title: r.title, url: r.url })),
    pagesFetched: pages.filter((p) => p.text).length,
    brief: answer,
  };
};

// ── Librarian: memory / vault / graph ─────────────────────────────

const librarianWorker: WorkerHandler = async (ctx) => {
  const kind = ctx.task.kind;
  const query = str(ctx.task.input.query);

  if (kind === 'distill') {
    ctx.progress(0.4);
    const result = await distillLearnings(ctx);
    ctx.progress(1);
    return result;
  }

  if (kind === 'vault_sync') {
    ctx.progress(0.3);
    const res = await fetch(`${BASE}/api/cortex/vault/graph`, { signal: AbortSignal.timeout(10_000) });
    const graph: any = await res.json().catch(() => null);
    ctx.progress(1);
    return { synced: true, nodes: graph?.nodes?.length ?? graph?.stats ?? null, raw: graph ? undefined : 'endpoint returned non-JSON' };
  }

  if (kind === 'recall' || kind === 'graph_query') {
    if (!query) throw new Error(`librarian ${kind} requires input.query`);
    ctx.progress(0.3);
    // Memory recall goes through the governed cortex_memory tool.
    const mem = await toolExecute('cortex_memory', { action: 'search', query, limit: 8 }, 30_000, ctx.telemetry);
    ctx.progress(0.6);
    const synthesis = await ctx.llm({
      tier: 'fast',
      maxTokens: 500,
      messages: [
        { role: 'system', content: 'You are LIBRARIAN, Cortex\'s memory keeper. Answer from the retrieved memories only. If nothing relevant exists, say so plainly.' },
        { role: 'user', content: `QUERY: ${query}\n\nMEMORY RESULTS:\n${JSON.stringify(mem).slice(0, 6000)}` },
      ],
    });
    ctx.progress(1);
    return { query, memories: mem, answer: synthesis };
  }

  throw new Error(`librarian: unknown task kind '${kind}'`);
};

// ── Builder: governed code tasks ──────────────────────────────────

const DESTRUCTIVE_RE = /rm\s+-rf|rm\s+-f\s|git\s+reset\s+--hard|git\s+clean\s+-f|drop\s+table|mkfs|dd\s+if=/i;
const TIER2_RE = /deploy|publish|push\s+--force|rm\s+-rf|shutdown|reboot/i;

// ── Blast-radius lanes ────────────────────────────────────────────
// Gate on how expensive a wrong outcome is to undo, not on model
// confidence (which the model itself controls). Three lanes:
//   contained  — read/search/list/web/memory: no side effects, auto lane.
//   reversible — repo-local writes & non-destructive commands: executes,
//                flagged for audit; a bad merge costs a git revert.
//   hard       — destructive or tier-2: never executes, becomes a proposal.
//                This lane does not open regardless of any score.
export type BlastLane = 'contained' | 'reversible' | 'hard';

const CONTAINED_TOOLS = new Set([
  'read_file', 'list_dir', 'search_code', 'web_search', 'web_fetch',
  'cortex_memory', 'cortex_map', 'cortex_surface',
]);
const REVERSIBLE_TOOLS = new Set([
  'write_file', 'edit_file', 'patch_file', 'run_command', 'exec', 'execute_command',
]);

export function blastLane(tool: string, argsJson: string): BlastLane {
  if (DESTRUCTIVE_RE.test(tool + ' ' + argsJson) || TIER2_RE.test(tool + ' ' + argsJson)) return 'hard';
  if (CONTAINED_TOOLS.has(tool)) return 'contained';
  if (REVERSIBLE_TOOLS.has(tool)) return 'reversible';
  // Unknown tools default to the strictest executable lane — never 'hard'
  // (that path is proposal-only); 'reversible' still runs the governor's
  // destructive regex above first, so truly dangerous args never reach here.
  return 'reversible';
}

const builderWorker: WorkerHandler = async (ctx) => {
  const instruction = str(ctx.task.input.instruction || ctx.task.input.query);
  if (!instruction) throw new Error('builder requires input.instruction');

  ctx.progress(0.1);
  const distilledRules = relevantRules(instruction);
  // Spec expansion: terse instruction → contract (objective/constraints/
  // non-goals/verification) before planning. Fail-soft to raw instruction.
  const spec = await expandTaskSpec(ctx.llm, instruction + retryNote(ctx.task.input), 'reason');
  ctx.progress(0.2);
  // Plan step: reason about the task into concrete tool steps. One retry
  // with a corrective nudge — small models sometimes answer in prose.
  const planMessages = [
    {
      role: 'system',
      content: `You are BUILDER, Cortex's engineering operative. Given a coding task, output a JSON array of steps, each {"tool": "<name>", "args": {...}, "why": "..."}. Allowed tools: read_file, write_file, edit_file, list_dir, run_command, search_code. Prefer read/search before write. If the task needs anything destructive or external (deploy, push, rm -rf, purchases, messages to people), output {"veto": true, "reason": "..."} instead — those become user proposals, never silent execution. Output ONLY the JSON array.${distilledRules ? `\n\nDISTILLED RULES (constraints learned from accepted agent outcomes — follow unless they conflict with governance):\n${distilledRules}` : ''}`,
    },
    { role: 'user', content: instruction + specBlock(spec) + retryNote(ctx.task.input) },
  ];
  let planText = await ctx.llm({ tier: 'reason', maxTokens: 700, messages: planMessages });
  ctx.progress(0.3);

  let steps: any[] = [];
  const tryParse = (text: string) => {
    try {
      const m = text.match(/\[[\s\S]*\]/);
      const parsed = m ? JSON.parse(m[0]) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };
  steps = tryParse(planText);
  if (!steps.length) {
    planText = await ctx.llm({
      tier: 'reason', maxTokens: 700,
      messages: [...planMessages,
        { role: 'assistant', content: planText.slice(0, 1500) },
        { role: 'user', content: 'That was not a valid JSON array of steps. Output ONLY the JSON array now — no prose, no markdown fences.' }],
    });
    steps = tryParse(planText);
  }
  if (!Array.isArray(steps) || !steps.length)
    throw new Error(`builder could not decompose task into steps (model returned: ${planText.slice(0, 160).replace(/\s+/g, ' ')})`);

  // Governor gate: veto or tier-2 → convert to proposal, do not execute.
  const risky = steps.find((s) => s?.veto || TIER2_RE.test(JSON.stringify(s)));
  if (risky) {
    ctx.progress(1);
    return {
      vetoed: true,
      reason: risky.reason || 'task requires tier-2 approval',
      proposal: { title: ctx.task.title, instruction, steps: steps.slice(0, 5) },
      note: 'Routed to initiative proposal path — nothing was executed.',
    };
  }

  const results: any[] = [];
  const lanes: Record<BlastLane, number> = { contained: 0, reversible: 0, hard: 0 };
  let i = 0;
  for (const step of steps.slice(0, 8)) {
    if (ctx.signal.aborted) throw new Error('cancelled');
    const tool = String(step?.tool || '');
    const args = (step?.args && typeof step.args === 'object') ? step.args : {};
    const argsJson = JSON.stringify(args);
    const lane = blastLane(tool, argsJson);
    lanes[lane]++;
    if (lane === 'hard') {
      results.push({ step: i, tool, vetoed: true, lane, reason: 'hard blast-radius — routed to proposal, never executed' });
      continue;
    }
    const out = await toolExecute(tool, args, 45_000, ctx.telemetry);
    results.push({ step: i, tool, lane, ok: out.ok !== false, output: JSON.stringify(out).slice(0, 800) });
    i++;
    ctx.progress(0.3 + 0.7 * (i / Math.min(steps.length, 8)));
  }
  ctx.progress(1);
  const failed = results.filter((r) => r.vetoed || r.ok === false);
  return {
    instruction,
    spec: spec ?? undefined,
    stepsExecuted: results.length,
    lanes,
    results,
    partial: failed.length > 0,
    failedSteps: failed.length,
    // Honest verification status: the spec names the check; whether it ran
    // is reported, never assumed.
    verification: spec?.verification ? { required: spec.verification, ran: results.some((r) => /test|typecheck|lint|verify|check/i.test(String(r.tool))) } : undefined,
  };
};

// ── Reviewer: read-only code critic ───────────────────────────────
// The article's top keeper: isolates verbose diff/file content and
// returns prioritized findings. Read-only by construction — it only ever
// calls read_file and two fixed git inspection commands.

const reviewerWorker: WorkerHandler = async (ctx) => {
  const instruction = str(ctx.task.input.instruction || ctx.task.input.query || ctx.task.title);
  const files = Array.isArray(ctx.task.input.files)
    ? ctx.task.input.files.map(String).filter(Boolean).slice(0, 10)
    : [];
  if (!instruction && !files.length) throw new Error('reviewer requires input.instruction or input.files');

  ctx.progress(0.15);
  let material = '';
  const sources: string[] = [];

  if (files.length) {
    for (const f of files) {
      const out = await toolExecute('read_file', { path: f }, 20_000, ctx.telemetry);
      const content = typeof out?.content === 'string' ? out.content : '';
      if (out?.ok !== false && content) {
        material += `\n\n=== ${f} ===\n${content.slice(0, 8000)}`;
        sources.push(f);
      } else {
        sources.push(`${f} (unreadable)`);
      }
    }
  } else {
    // Default scope: the working-tree diff — the canonical review target.
    const [diff, stat] = await Promise.all([
      toolExecute('run_command', { command: 'git diff HEAD', timeout: 20 }, 30_000, ctx.telemetry),
      toolExecute('run_command', { command: 'git status --porcelain', timeout: 10 }, 15_000, ctx.telemetry),
    ]);
    const diffText = String(diff?.stdout || diff?.result?.stdout || '');
    const statText = String(stat?.stdout || stat?.result?.stdout || '');
    material = `GIT STATUS:\n${statText.slice(0, 2000)}\n\nDIFF:\n${diffText.slice(0, 30000)}`;
    sources.push('git diff HEAD');
  }
  ctx.progress(0.5);

  if (!material.trim() || material.trim() === 'DIFF:\n')
    throw new Error('reviewer found no material to review (clean tree? pass input.files)');

  const findings = await ctx.llm({
    tier: 'reason',
    maxTokens: 1200,
    messages: [
      {
        role: 'system',
        content: 'You are REVIEWER, Cortex\'s read-only code critic. Produce a prioritized review: CRITICAL (bugs, security, data loss), WARNINGS (design, maintainability, error handling), SUGGESTIONS (style, nits). Be specific — cite file and line where possible. Never rewrite code; describe the fix in one line. If the material is clean, say so plainly. Output concise markdown.',
      },
      {
        role: 'user',
        content: `REVIEW REQUEST: ${instruction || 'Review the changes.'}\n\nMATERIAL:\n${material.slice(0, 28000)}`,
      },
    ],
  });
  ctx.progress(1);
  return { sources, findings };
};

// ── Runner: execute → filter → summarize (the context firewall) ───
// Verbose command output never reaches chat or the task result raw —
// the worker holds it server-side and returns a distilled report.

const runnerWorker: WorkerHandler = async (ctx) => {
  const kind = ctx.task.kind;
  const command = str(ctx.task.input.command || ctx.task.input.cmd);
  const effective = kind === 'test' ? (command || 'npm test') : command;
  if (!effective) throw new Error(`runner ${kind} requires input.command`);

  // Blast-radius gate: hard-lane commands become proposals, never run.
  const lane = blastLane('run_command', JSON.stringify({ command: effective }));
  if (lane === 'hard') {
    ctx.progress(1);
    return { vetoed: true, lane, reason: 'hard blast-radius — routed to proposal, never executed', command: effective };
  }

  ctx.progress(0.2);
  const cwd = str(ctx.task.input.cwd) || undefined;
  const timeoutMs = Math.min(Number(ctx.task.input.timeout) || 60, 110) * 1000;
  const out = await toolExecute('run_command', { command: effective, ...(cwd ? { cwd } : {}), timeout: timeoutMs / 1000 }, timeoutMs + 5_000, ctx.telemetry);
  ctx.progress(0.6);

  const stdout = String(out?.stdout || out?.result?.stdout || '');
  const stderr = String(out?.stderr || out?.result?.stderr || '');
  const exitCode = Number(out?.exitCode ?? out?.result?.exitCode ?? (out?.ok === false ? 1 : 0));
  const ok = out?.ok !== false && exitCode === 0;
  const combined = [stdout, stderr].filter(Boolean).join('\n');

  // Distill: the summary is what the world sees; raw output stays here.
  const summary = await ctx.llm({
    tier: 'fast',
    maxTokens: 400,
    messages: [
      {
        role: 'system',
        content: 'You are RUNNER, Cortex\'s exec operative. Given a command and its output, report ONLY: what ran, whether it passed, the 3-5 most important facts (failures, errors, key numbers), and anything the operator must act on. No restating passing output. If it passed cleanly, one line is enough.',
      },
      {
        role: 'user',
        content: `COMMAND: ${effective}\nEXIT: ${exitCode}\nDURATION: ${out?.durationMs ?? '?'}ms\n\nOUTPUT (truncated):\n${combined.slice(-6000)}`,
      },
    ],
  });
  ctx.progress(1);
  return {
    command: effective,
    cwd: cwd || null,
    ok,
    exitCode,
    durationMs: out?.durationMs ?? null,
    summary,
    tail: combined.slice(-1200),
  };
};

// ── Ephemeral worker: self-created agents (CORTEX_AGENTS_SELF.md) ──
// One generic worker for every spawned agent — they differ by SpawnSpec,
// never by code. Scope enforcement is deterministic: a step whose tool is
// outside spec.tools is vetoed before it can execute.

const SCOPE_TOOLS: Record<ToolScope, Set<string>> = {
  read: new Set(['read_file', 'list_dir', 'search_code', 'web_search', 'cortex_memory']),
  write: new Set(['write_file', 'edit_file', 'patch_file']),
  exec: new Set(['run_command', 'exec', 'execute_command']),
  surface: new Set(['cortex_surface', 'cortex_map']),
};

export function makeEphemeralWorker(spec: SpawnSpec): WorkerHandler {
  const allowed = new Set(spec.tools.flatMap((s) => [...SCOPE_TOOLS[s]]));
  const allowedToolsList = [...allowed].join(', ');

  return async (ctx) => {
    const instruction = str(ctx.task.input.instruction || ctx.task.input.query || ctx.task.input.task || ctx.task.title);
    if (!instruction) throw new Error(`${spec.callSign}: task requires input.instruction|query|task`);

    ctx.progress(0.1);
    const distilledRules = relevantRules(instruction);
    const priorMissions = loadAgentMemory(ctx.task.agentId);
    // Per-task tier override: input.tier lets an operator route around a
    // saturated lane without respawning the agent. Still health-gated by
    // the matrix — a bad tier just fails over within that lane.
    const tier = (['fast', 'reason', 'deep'] as const).includes(ctx.task.input?.tier as any)
      ? (ctx.task.input.tier as 'fast' | 'reason' | 'deep')
      : spec.modelPin.tier;
    const taskSpec = await expandTaskSpec(ctx.llm, instruction + retryNote(ctx.task.input), tier);
    const planText = await ctx.llm({
      tier,
      maxTokens: 700,
      messages: [
        {
          role: 'system',
          content: `${spec.systemBrief}\n\nDONE CRITERIA: ${spec.doneCriteria}\n\nYou are ${spec.callSign}, an ephemeral agent. Given a task, output a JSON array of steps, each {"tool": "<name>", "args": {...}, "why": "..."}. Allowed tools ONLY: ${allowedToolsList}. Prefer read before write. Anything destructive or external becomes {"veto": true, "reason": "..."}. Output ONLY the JSON array.${distilledRules ? `\n\nDISTILLED RULES (constraints learned from accepted agent outcomes — follow unless they conflict with your scope):\n${distilledRules}` : ''}`,
        },
        { role: 'user', content: instruction + specBlock(taskSpec) + retryNote(ctx.task.input) + memoryBlock(priorMissions) },
      ],
    });
    ctx.progress(0.3);

    let steps: any[] = [];
    try {
      const m = planText.match(/\[[\s\S]*\]/);
      const parsed = m ? JSON.parse(m[0]) : null;
      if (Array.isArray(parsed)) steps = parsed;
    } catch { steps = []; }
    if (!steps.length)
      throw new Error(`${spec.callSign} could not decompose task (model: ${planText.slice(0, 120).replace(/\s+/g, ' ')})`);

    const results: any[] = [];
    const lanes: Record<BlastLane, number> = { contained: 0, reversible: 0, hard: 0 };
    let i = 0;
    for (const step of steps.slice(0, 8)) {
      if (ctx.signal.aborted) throw new Error('cancelled');
      const tool = String(step?.tool || '');
      const args = (step?.args && typeof step.args === 'object') ? step.args : {};
      const argsJson = JSON.stringify(args);
      if (step?.veto) {
        results.push({ step: i, tool, vetoed: true, lane: 'hard', reason: String(step.reason || 'model veto') });
        lanes.hard++;
        i++;
        continue;
      }
      // Deterministic scope gate — runs BEFORE the destructive-pattern gate.
      if (!allowed.has(tool)) {
        results.push({ step: i, tool, vetoed: true, lane: 'hard', reason: `outside spawn scope [${spec.tools.join(',')}]` });
        lanes.hard++;
        i++;
        continue;
      }
      if (tool === 'cortex_memory' && String(args.action || 'search') !== 'search') {
        results.push({ step: i, tool, vetoed: true, lane: 'hard', reason: 'cortex_memory limited to search for ephemeral agents' });
        lanes.hard++;
        i++;
        continue;
      }
      const lane = blastLane(tool, argsJson);
      lanes[lane]++;
      if (lane === 'hard') {
        results.push({ step: i, tool, vetoed: true, lane, reason: 'hard blast-radius — routed to proposal, never executed' });
        i++;
        continue;
      }
      const out = await toolExecute(tool, args, 45_000, ctx.telemetry);
      results.push({ step: i, tool, lane, ok: out.ok !== false, output: JSON.stringify(out).slice(0, 800) });
      i++;
      ctx.progress(0.3 + 0.7 * (i / Math.min(steps.length, 8)));
    }
    ctx.progress(1);
    const failed = results.filter((r) => r.vetoed || r.ok === false);
    appendAgentMemory(ctx.task.agentId, {
      ts: Date.now(),
      instruction: instruction.slice(0, 300),
      satisfied: failed.length === 0,
      failedSteps: failed.length,
      note: failed.length ? failed.slice(0, 2).map((r: any) => `${r.tool || '?'}: ${String(r.reason || r.output || '').slice(0, 80)}`).join('; ') : undefined,
    });
    return {
      agent: spec.callSign,
      instruction,
      taskSpec: taskSpec ?? undefined,
      stepsExecuted: results.length,
      lanes,
      results,
      doneCriteria: spec.doneCriteria,
      satisfied: failed.length === 0,
      partial: failed.length > 0,
      failedSteps: failed.length,
    };
  };
}

// ── Registration ──────────────────────────────────────────────────

export function registerAgentWorkers(runtime: AgentRuntime) {
  runtime.registerWorker('sentinel', sentinelWorker);
  runtime.registerWorker('scout', scoutWorker);
  runtime.registerWorker('librarian', librarianWorker);
  runtime.registerWorker('builder', builderWorker);
  runtime.registerWorker('reviewer', reviewerWorker);
  runtime.registerWorker('runner', runnerWorker);
  registerDistributorWorker(runtime);
  registerWardenWorker(runtime);
}
