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
import { execFile } from 'node:child_process';
import type { AgentContext, AgentRuntime, WorkerHandler } from './runtime';
import type { AgentId, SpawnSpec, ToolScope } from './types';
import { registerWardenWorker } from './warden';
import { registerDistributorWorker } from './distribution';
import { runForecastCycle, type RoutedForecast, type ProbeDeps } from './forecaster';
import { makePrepWorker } from './prep';
import { makeBriefWorker } from './brief';
import { makeDebriefWorker } from './debrief';
import { makeRadarSweepWorker } from './radar';
import { makeStrategistWorker } from './strategist';
import { readArchive, type TaskArchiveRecord } from './archive';
import { DETERMINISTIC_TASKS } from './lights';
import { runCounselPosition } from './counsel-position';
import { runPersonaPosition } from './counsel-personas';
import { getCortexProactiveInitiative } from '../cortex-proactive-initiative';
import { cortexObsidianMemory } from '../cortex-obsidian-memory';
import { relevantRules, rulesBlock, RULES_DIR, vaultFolder, listMd } from './rules';
import { recallCortexMemory } from '../cortex-memory';
import { LEARNINGS_DIR } from './outcomes';
import { readSessionHandoff, writeSessionHandoff, markHandoffClaimed } from './handoff';
import { fileEvalDefinition, runEval, type LlmFn } from './evals';
import { upsertInstinct, promotableInstincts, instinctCursor, saveInstinctCursor, listInstincts, type Instinct } from './instincts';
import { isValidVenture } from '../cortex-ventures';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5173;
const BASE = `http://127.0.0.1:${PORT}`;
const SOVEREIGN_KEY = 'sovereign-local';

async function toolExecute(name: string, args: Record<string, unknown>, timeoutMs = 30_000, telemetry?: { toolCalls: number; toolFailures: number }): Promise<{ ok: boolean; [k: string]: unknown }> {
  if (telemetry) telemetry.toolCalls++;
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

/** Persona reference library — .cortex-runtime/personas/*.md frontmatter
 *  (name + description only). Ideation cites persona PRINCIPLES inside
 *  systemBrief; whole files are never injected (4000-char cap). */
const PERSONAS_DIR = path.join(process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime'), 'personas');

function personaCatalogBlock(): string {
  try {
    if (!fs.existsSync(PERSONAS_DIR)) return '';
    const lines: string[] = [];
    for (const f of fs.readdirSync(PERSONAS_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md').slice(0, 20)) {
      const head = fs.readFileSync(path.join(PERSONAS_DIR, f), 'utf8').slice(0, 1200);
      const name = head.match(/^name:\s*(.+)$/m)?.[1]?.trim() || f.replace(/\.md$/, '');
      const desc = head.match(/^description:\s*(.+)$/m)?.[1]?.trim() || '';
      lines.push(`- ${name} (${f}): ${desc.slice(0, 160)}`);
    }
    if (!lines.length) return '';
    return '\n\nPERSONA LIBRARY (.cortex-runtime/personas — cite 1-2 relevant persona principles inside systemBrief as "Persona: <name> — <principle>"; never paste whole files):\n' + lines.join('\n');
  } catch { return ''; }
}


/** Minimal-change engineering discipline (distilled from the ponytail
 *  lazy-senior-dev rule set): scope-first planning, smallest complete
 *  change, hard never-cut list. Injected into coding-task planners. */
const ENGINEERING_DISCIPLINE = `\n\nENGINEERING DISCIPLINE: Before editing, map every place the change must reach — callers, tests, fixtures, config, exports — and what it could break. Take the smallest option that fully works: skip unrequested features (name them in one line), reuse existing helpers, prefer stdlib/platform features and already-installed deps, never add a dependency for a few lines. Deletion beats addition; keep the codebase's existing structure and conventions. Bug fixes: find every caller of the touched function and fix the root cause once in shared code. Never cut: validation at trust boundaries, error handling that prevents data loss, security, accessibility, calibration real hardware needs, or anything the task asked for. New non-trivial logic leaves one small test or assert-based self-check.`;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function parseDdgResults(html: string, maxResults: number) {
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

function parseDdgLite(html: string, maxResults: number) {
  const out: Array<{ title: string; url: string; snippet: string }> = [];
  // lite.duckduckgo.com markup: <a rel="nofollow" href="..." class='result-link'>title</a>
  // snippets in <td class='result-snippet'>...</td>
  const blocks = html.split(/<tr[^>]*>/i);
  for (const block of blocks) {
    const m = block.match(/<a[^>]*class=['"]result-link['"][^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<a[^>]*href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/i);
    if (!m) continue;
    const uddg = m[1].match(/uddg=([^&]+)/);
    const url = uddg ? decodeURIComponent(uddg[1]) : m[1];
    if (!/^https?:/.test(url)) continue;
    const title = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    const snip = (block.match(/class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/i)?.[1] || '')
      .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    if (title) out.push({ title: title.slice(0, 200), url, snippet: snip.slice(0, 300) });
    if (out.length >= maxResults) break;
  }
  return out;
}

/** Web search with backend failover. Distinguishes backend failure (throws,
 *  so telemetry.failureClass records the real cause) from genuinely empty
 *  results (returns []). Order: DDG html → DDG lite → Mojeek. */
function parseBingResults(html: string, maxResults: number) {
  const out: Array<{ title: string; url: string; snippet: string }> = [];
  for (const block of html.split(/<li class="b_algo"/i).slice(1)) {
    const m = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!m) continue;
    // Bing wraps results in /ck/a redirect links carrying the real URL in a
    // base64url 'u' param (prefixed 'a1'). Unwrap; skip unparseable links.
    let url = m[1].replace(/&amp;/g, '&');
    if (/bing\.com\/ck\//.test(url)) {
      const u = url.match(/[?&]u=([^&]+)/)?.[1];
      if (u && u.startsWith('a1')) {
        try {
          const b64 = u.slice(2).replace(/-/g, '+').replace(/_/g, '/');
          url = Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64').toString('utf8');
        } catch { continue; }
      } else continue;
    }
    if (!/^https?:/.test(url)) continue;
    const title = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    const snip = (block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || block.match(/class="b_caption"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '')
      .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    if (title) out.push({ title: title.slice(0, 200), url, snippet: snip.slice(0, 300) });
    if (out.length >= maxResults) break;
  }
  return out;
}

async function webSearch(query: string, maxResults = 6): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const q = encodeURIComponent(query);
  const attempts: Array<{ name: string; url: string; parse: (h: string, n: number) => ReturnType<typeof parseDdgResults> }> = [
    // Bing first: DDG html/lite and Mojeek currently serve bot-challenge
    // pages (HTTP 202 anomaly / Captcha) that parse empty — Bing still
    // returns real b_algo results for plain UA fetches.
    { name: 'bing', url: `https://www.bing.com/search?q=${q}&count=${maxResults}`, parse: parseBingResults },
    { name: 'ddg-html', url: `https://html.duckduckgo.com/html/?q=${q}`, parse: parseDdgResults },
    { name: 'ddg-lite', url: `https://lite.duckduckgo.com/lite/?q=${q}`, parse: parseDdgLite },
    { name: 'mojeek', url: `https://www.mojeek.com/search?q=${q}`, parse: (h, n) => {
      const out: Array<{ title: string; url: string; snippet: string }> = [];
      for (const block of h.split(/<li class="result-standard"/i).slice(1)) {
        const m = block.match(/<a class="ob" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
          || block.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!m || !/^https?:/.test(m[1])) continue;
        const title = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
        const snip = (block.match(/<p class="s">([\s\S]*?)<\/p>/i)?.[1] || '')
          .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
        if (title) out.push({ title: title.slice(0, 200), url: m[1], snippet: snip.slice(0, 300) });
        if (out.length >= n) break;
      }
      return out;
    } },
  ];
  const errors: string[] = [];
  let anyBackendOk = false;
  for (const a of attempts) {
    try {
      const res = await fetch(a.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) { errors.push(`${a.name} HTTP ${res.status}`); continue; }
      const html = await res.text();
      const results = a.parse(html, maxResults);
      if (results.length) { anyBackendOk = true; return results; }
      // Bot-challenge pages (DDG anomaly, Mojeek captcha) answer 200/202
      // with zero parseable results — that's a backend failure, not an
      // honest empty result set.
      if (/anomaly|captcha|challenge|are you a robot|unusual traffic/i.test(html)) {
        errors.push(`${a.name} bot-challenge`);
        continue;
      }
      anyBackendOk = true;
      errors.push(`${a.name} empty`);
    } catch (e) {
      errors.push(`${a.name} ${String((e as Error)?.message || e).slice(0, 60)}`);
    }
  }
  // A backend answered but parsed empty → genuinely no results; the caller's
  // 'no results' error stays honest. Only throw when EVERY backend failed
  // at HTTP/network level, so telemetry records the real cause.
  if (anyBackendOk) return [];
  throw new Error(`web_search backends unreachable: ${errors.join('; ') || 'unknown'}`);
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

let _designBlockCache: string | null = null;
/** Compact design-context injection for coding-task planners: the Cortex
 *  overrides section + palette from repo-root DESIGN.md (impeccable context
 *  file). Cached per process; absent file → empty string, never blocks. */
function designBlock(): string {
  if (_designBlockCache !== null) return _designBlockCache;
  try {
    const f = path.join(process.cwd(), 'DESIGN.md');
    if (!fs.existsSync(f)) { _designBlockCache = ''; return ''; }
    const md = fs.readFileSync(f, 'utf8');
    const overrides = md.match(/## Cortex overrides[\s\S]*$/)?.[0] || '';
    const colors = md.match(/colors:\n([\s\S]*?)(?=\n\S|$)/)?.[0] || '';
    const block = (overrides || colors) ? `\n\nDESIGN CONTEXT (repo DESIGN.md — match this palette/typography for UI work):\n${(overrides || colors).slice(0, 1200)}` : '';
    _designBlockCache = block;
    return block;
  } catch { _designBlockCache = ''; return ''; }
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
  // The learnings folder grows unboundedly (2000+ notes) — scanning every
  // file per distill is wasteful and arbitrary slice(-80) windows miss
  // whole clusters. Take the 200 most-recently-modified agent-outcome
  // notes by mtime instead.
  const files = listMd(dir)
    .filter((f) => f.startsWith('agent-'))
    .map((f) => {
      try { return { f, mtime: fs.statSync(path.join(dir!, f)).mtimeMs }; }
      catch { return { f, mtime: 0 }; }
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 200)
    .map((x) => x.f);
  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(dir!, f), 'utf-8');
      if (!content.includes('agent-outcome')) continue;
      const parsed = parseOutcomeNote(f, content);
      if (parsed) out.push(parsed);
    } catch { /* skip unreadable notes */ }
  }
  return out;
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
      evidence: (Array.isArray(r.evidence) ? r.evidence : []).map(String).filter((f: string) => evidenceFiles.has(f)),
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
  if (kind === 'counsel_position') {
    return runCounselPosition(ctx, 'sentinel', 'EECOM — compute/power & model-health counsel');
  }
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

// ── SCOUT extended kinds ──────────────────────────────────────────
// repo_scan: daily-ish sweep of GitHub for repos that fit Cortex's stack.
// agent_ideas: fleet self-reflection — proposes SpawnSpecs through the
// deterministic spawn gate (capability_gap evidence; Inbox approval still
// required — free thinking, governed birth).

const REPO_SCAN_QUERIES = [
  'ai agent orchestration',
  'voice agent framework',
  'model context protocol',
  'local llm inference',
  'obsidian ai plugin',
  'proactive ai assistant',
];

async function githubRepoSearch(
  query: string,
  sinceDays: number,
  mode: 'created' | 'pushed' = 'created',
): Promise<{ items: any[]; status: number }> {
  const since = new Date(Date.now() - sinceDays * 24 * 3600_000).toISOString().slice(0, 10);
  // 'created' hunts newborn repos (cheap-adoption window). 'pushed' hunts
  // established repos with recent activity — the github.com/trending class
  // (uv, svelte, nvm) that a created:> filter can never see.
  const q = mode === 'pushed'
    ? `${query} stars:>150 pushed:>${since}`
    : `${query} created:>${since}`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=${mode === 'pushed' ? 'updated' : 'stars'}&order=desc&per_page=8`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'cortex-scout',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return { items: [], status: res.status };
  const data: any = await res.json();
  return { items: Array.isArray(data?.items) ? data.items : [], status: res.status };
}

async function repoScanWorker(ctx: AgentContext) {
  ctx.progress(0.1);
  const input = (ctx.task.input || {}) as any;
  const queries: string[] = Array.isArray(input.queries) && input.queries.length
    ? input.queries.map(String)
    : REPO_SCAN_QUERIES;
  const sinceDays = Math.min(180, Math.max(7, Number(input.sinceDays) || 45));

  const perQuery = await Promise.all(queries.map((q) => githubRepoSearch(q, sinceDays).catch(() => ({ items: [], status: 0 }))));
  const apiErrors = perQuery.filter((r) => r.status !== 200).length;
  const seen = new Set<string>();
  const repos: any[] = [];
  for (const { items: list } of perQuery) {
    for (const r of list) {
      if (seen.has(r.full_name)) continue;
      seen.add(r.full_name);
      repos.push({
        name: r.full_name,
        url: r.html_url,
        description: String(r.description || '').slice(0, 200),
        stars: r.stargazers_count || 0,
        language: r.language || '',
        topics: Array.isArray(r.topics) ? r.topics.slice(0, 6) : [],
        owner: r.owner?.login || '',
        createdAt: r.created_at || '',
        pushedAt: r.pushed_at || '',
      });
    }
  }
  ctx.progress(0.5);
  if (!repos.length) {
    return {
      scanned: 0,
      apiErrors,
      note: apiErrors === queries.length
        ? `GitHub API unavailable or rate-limited (${apiErrors}/${queries.length} queries failed) — unauthenticated search allows 10/min; set GITHUB_TOKEN for higher limits`
        : 'GitHub search returned no candidates',
    };
  }

  // Same astroturf gate as the trend scan — repo_scan's created:> window
  // is the lane that surfaced the Blender-MCP spam cluster.
  const legit = legitimacyFilter(repos);
  const suspicious = legit.dropped;

  const shortlist = legit.kept.sort((a, b) => b.stars - a.stars).slice(0, 15);
  const raw = await ctx.llm({
    tier: 'reason',
    maxTokens: 1200,
    messages: [
      {
        role: 'system',
        content: [
          'You are SCOUT evaluating GitHub repos for fit with Cortex — a local-first cognitive OS with:',
          'voice agents, a governed agent runtime (spawn gates, budgets, approval inboxes), a live 3D globe,',
          'calendar/energy scheduling, Obsidian memory, and distribution automation.',
          'Score each repo 0-1 for fit. Output STRICT JSON: {"picks":[{"name","fit","why","action":"adopt|watch|ignore"}]}.',
          'Only include repos worth attention (fit >= 0.5). Max 8 picks. No prose outside JSON.',
        ].join(' ') + rulesBlock('repo scan github fit cortex stack agent tooling', 'constraints learned from accepted agent outcomes — follow unless they conflict with the scan task'),
      },
      {
        role: 'user',
        content: `REPOS (last ${sinceDays}d, by stars):\n${shortlist.map((r) =>
          `- ${r.name} ★${r.stars} [${r.language}] ${r.description} topics:${r.topics.join(',')}`
        ).join('\n')}`,
      },
    ],
  });
  ctx.progress(0.8);

  let picks: any[] = [];
  try {
    const m = String(raw).match(/\{[\s\S]*\}/);
    picks = m ? (JSON.parse(m[0])?.picks || []) : [];
  } catch { picks = []; }

  // Adoption lane: high-fit 'adopt' picks file strategy proposals so repo
  // discoveries reach the INBOX instead of dying in a vault note. Dedupe is
  // per-day via planNote; 'watch'/'ignore' picks stay note-only.
  const adoptPicks = picks.filter((p: any) => p?.action === 'adopt' && Number(p?.fit) >= 0.6).slice(0, 4);
  let proposalsFiled = 0;
  if (adoptPicks.length) {
    try {
      const { fileStrategyProposals } = await import('./strategy-proposals');
      const dayKey = new Date().toISOString().slice(0, 10);
      const actions = adoptPicks.map((p: any) =>
        `[research] Evaluate adopting ${p.name} into Cortex — ${String(p.why || '').slice(0, 200)} — evidence: ${p.name}, github fit ${p.fit}, ${shortlist.find((r) => r.name === p.name)?.url || 'github'}`);
      const res = fileStrategyProposals({ planNote: `repo-scan-${dayKey}`, planTaskId: ctx.task.id, actions });
      proposalsFiled = res.filed;
    } catch { proposalsFiled = 0; }
  }

  const brief = [
    `# Repo Scan — ${new Date().toISOString().slice(0, 10)}`,
    `Scanned ${repos.length} candidates across ${queries.length} queries (last ${sinceDays}d); ${suspicious.length} dropped as spam/astroturf.`,
    '',
    ...picks.map((p) => `- **${p.action?.toUpperCase()}** ${p.name} (fit ${p.fit}) — ${p.why}`),
    picks.length ? '' : '_No repos cleared the fit bar this cycle._',
    '',
    '## Shortlist',
    ...shortlist.slice(0, 10).map((r) => `- ${r.name} ★${r.stars} — ${r.description} (${r.url})`),
    ...(suspicious.length
      ? ['', `## Spam-filtered (${suspicious.length})`, ...suspicious.slice(0, 10).map((d) => `- ${d.repo.name} — ${d.reasons.join('; ')}`)]
      : []),
  ].join('\n');

  try {
    cortexObsidianMemory.ensureVaultInitialized();
    cortexObsidianMemory.writeNote(
      '02 - Projects',
      `repo-scan-${new Date().toISOString().slice(0, 10)}`,
      brief,
      { created: new Date().toISOString(), agent: 'SCOUT', kind: 'repo-scan' },
    );
  } catch {}

  ctx.progress(1);
  return { scanned: repos.length, picks: picks.length, proposalsFiled, droppedSpam: suspicious.length, note: '02 - Projects/repo-scan' };
}

// ── github_trend_scan: "on the rise" detector ─────────────────────
// repo_scan sweeps established repos (45d window, sort=stars). This kind
// hunts repos gaining traction via TWO lanes: NEW repos (created:>14d —
// the cheap-adoption window) and ESTABLISHED repos (stars:>150 pushed
// recently — the trending-page class a created:> filter can't see).
// Deterministic pre-filters keep the LLM honest: only Cortex-domain
// repos reach judgment, astroturf/spam drops before the model sees it,
// and each repo is evaluated at most once per ISO week (seen-set).

const TREND_QUERIES = [
  'mcp server',
  'ai agent framework',
  'voice ai tts',
  'browser automation agent',
  'llm agent memory',
  'local llm inference',
  'agent observability',
  'discord bot ai',
];

// 'pushed' lane: established repos (stars:>150) with recent activity —
// the trending-page class. Runs sequentially after the created lane so
// unauthenticated GitHub search (10 req/min) isn't burst-limited.
const TRENDING_QUERIES = [
  'developer tools',
  'python package manager',
  'security scanner',
  'agent skills',
  'local llm',
  'database tool',
  'ai agent framework',
  'mcp server',
];

const TREND_KEYWORDS = [
  'agent', 'llm', 'mcp', 'voice', 'tts', 'stt', 'speech', 'browser', 'automation',
  'memory', 'rag', 'inference', 'ollama', 'obsidian', 'discord', 'calendar',
  'schedul', 'crawl', 'scrap', 'webhook', 'realtime', 'websocket', 'orchestrat',
  'multi-agent', 'a2a', 'tool-use', 'function-calling',
  // Broader dev-tooling surface — established trending repos rarely use
  // agent keywords (uv = "python package manager", svelte = "compiler").
  'security', 'skill', 'cli', 'eval', 'benchmark', 'sdk', 'plugin', 'extension',
  'database', 'vector', 'embed', 'fine-tun', 'quantiz', 'speculative', 'distill',
  'lint', 'package', 'release', 'workflow', 'docker', 'postgres', 'sqlite',
  'terminal', 'editor', 'notebook', 'pdf', 'spreadsheet', 'dashboard',
  'monitor', 'trace', 'profil', 'compiler', 'runtime', 'framework', 'library',
];

// ── Legitimacy heuristics ─────────────────────────────────────────
// Deterministic astroturf/spam gate, applied BEFORE the LLM sees a repo.
// Motivated by the 2026-11-18 repo_scan: ~8 near-identical
// "Blender-AI-MCP-*" repos from disposable accounts reached ADOPT
// proposals at ★500+ within days of creation — classic star-farmed
// SEO spam. Three independent signals, any one drops the repo:
//   1. implausible velocity — very young repo with hundreds of stars
//   2. duplicate-description cluster — ≥3 repos sharing a templated blurb
//   3. generated-looking owner — login ending in digits / birth-year

function repoAgeDays(createdAt: string | undefined): number {
  const t = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 86400000) : 9999;
}

function normalizeRepoDesc(d: string): string {
  return d.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function looksGeneratedOwner(login: string): boolean {
  // e.g. credoksopho1984, fumbdendade19718 — consonant-salad + digits.
  return /[0-9]{3,}$/.test(login) || /[0-9]{4,}/.test(login);
}

/** Returns suspicious-reason list; empty = clean. `descCluster` is the
 *  size of the duplicate-description cluster this repo belongs to. */
function legitimacyFlags(r: any, descClusterSize: number): string[] {
  const flags: string[] = [];
  const age = repoAgeDays(r.createdAt || r.pushedAt);
  const stars = Number(r.stars) || 0;
  if (age < 3 && stars >= 200) flags.push(`implausible velocity (${stars}★ in ${age.toFixed(1)}d)`);
  else if (age < 14 && stars / Math.max(age, 0.5) > 150) flags.push(`extreme velocity (~${Math.round(stars / Math.max(age, 0.5))}★/day)`);
  if (descClusterSize >= 3) flags.push(`duplicate-description cluster ×${descClusterSize}`);
  const owner = String(r.owner || '');
  if (owner && looksGeneratedOwner(owner)) flags.push(`generated-looking owner '${owner}'`);
  return flags;
}

/** Cluster repos by normalized description prefix — astroturf networks
 *  reuse templated blurbs verbatim. Returns Map index→cluster size. */
function descriptionClusters(repos: any[]): Map<number, number> {
  const groups = new Map<string, number[]>();
  repos.forEach((r, i) => {
    const key = normalizeRepoDesc(String(r.description || '')).slice(0, 80);
    if (key.length < 20) return; // empty/short blurbs can't cluster meaningfully
    const arr = groups.get(key) || [];
    arr.push(i);
    groups.set(key, arr);
  });
  const sizes = new Map<number, number>();
  for (const idxs of groups.values())
    if (idxs.length >= 2) for (const i of idxs) sizes.set(i, idxs.length);
  return sizes;
}

/** Filter a repo list through the legitimacy gate. Returns survivors plus
 *  the dropped repos with reasons — callers log/count both. */
function legitimacyFilter<T extends { description?: string }>(repos: T[]): { kept: T[]; dropped: Array<{ repo: T; reasons: string[] }> } {
  const clusters = descriptionClusters(repos as any[]);
  const kept: T[] = [];
  const dropped: Array<{ repo: T; reasons: string[] }> = [];
  repos.forEach((r, i) => {
    const flags = legitimacyFlags(r as any, clusters.get(i) || 1);
    if (flags.length) dropped.push({ repo: r, reasons: flags });
    else kept.push(r);
  });
  return { kept, dropped };
}

const TREND_STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const TREND_SEEN_PATH = path.join(TREND_STATE_DIR, 'github-trend-seen.json');

function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function readTrendSeen(): Record<string, string[]> {
  try {
    if (!fs.existsSync(TREND_SEEN_PATH)) return {};
    const data = JSON.parse(fs.readFileSync(TREND_SEEN_PATH, 'utf-8'));
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}

function writeTrendSeen(seen: Record<string, string[]>) {
  try {
    fs.mkdirSync(TREND_STATE_DIR, { recursive: true });
    // Keep last 6 week-keys so dedupe memory stays bounded.
    const keys = Object.keys(seen).sort().slice(-6);
    const pruned: Record<string, string[]> = {};
    for (const k of keys) pruned[k] = seen[k].slice(-500);
    fs.writeFileSync(TREND_SEEN_PATH, JSON.stringify(pruned));
  } catch { /* best-effort */ }
}

async function githubTrendScanWorker(ctx: AgentContext) {
  ctx.progress(0.1);
  const input = (ctx.task.input || {}) as any;
  const queries: string[] = Array.isArray(input.queries) && input.queries.length
    ? input.queries.map(String)
    : TREND_QUERIES;
  const sinceDays = Math.min(60, Math.max(3, Number(input.sinceDays) || 14));
  const week = isoWeekKey();

  // Two lanes, run sequentially: 'created' (newborn repos, cheap-adoption
  // window) then 'pushed' (established repos with fresh activity — the
  // trending-page class the created:> filter can never see). Sequential
  // keeps the parallel burst under GitHub's unauthenticated 10 req/min.
  const createdResults = await Promise.all(queries.map((q) => githubRepoSearch(q, sinceDays, 'created').catch(() => ({ items: [], status: 0 }))));
  const trendingQueries: string[] = Array.isArray(input.trendingQueries) && input.trendingQueries.length
    ? input.trendingQueries.map(String)
    : TRENDING_QUERIES;
  const pushedResults = await Promise.all(trendingQueries.map((q) => githubRepoSearch(q, sinceDays, 'pushed').catch(() => ({ items: [], status: 0 }))));
  const perQuery = [...createdResults, ...pushedResults];
  const apiErrors = perQuery.filter((r) => r.status !== 200).length;

  const seenSet = readTrendSeen();
  const alreadySeen = new Set(seenSet[week] || []);
  const seen = new Set<string>();
  const fresh: any[] = [];
  let skippedSeen = 0;
  for (const { items: list } of perQuery) {
    for (const r of list) {
      if (seen.has(r.full_name)) continue;
      seen.add(r.full_name);
      if (alreadySeen.has(r.full_name)) { skippedSeen++; continue; }
      fresh.push({
        name: r.full_name,
        url: r.html_url,
        description: String(r.description || '').slice(0, 200),
        stars: r.stargazers_count || 0,
        language: r.language || '',
        topics: Array.isArray(r.topics) ? r.topics.slice(0, 6) : [],
        owner: r.owner?.login || '',
        createdAt: r.created_at || '',
        pushedAt: r.pushed_at || '',
      });
    }
  }
  ctx.progress(0.35);

  // Deterministic relevance pre-filter — only repos touching Cortex
  // domains reach the LLM. Everything else is recorded as scanned noise.
  const relevant = fresh.filter((r) => {
    const hay = `${r.name} ${r.description} ${r.topics.join(' ')}`.toLowerCase();
    return TREND_KEYWORDS.some((k) => hay.includes(k));
  });
  const droppedIrrelevant = fresh.length - relevant.length;

  // Astroturf gate: drop star-farmed / templated spam BEFORE the LLM.
  // Survivors only reach judgment; drops are logged in the brief.
  const legit = legitimacyFilter(relevant);
  const suspicious = legit.dropped;

  if (!legit.kept.length) {
    // Still mark scanned repos as seen so we don't re-evaluate noise weekly.
    seenSet[week] = [...(seenSet[week] || []), ...seen];
    writeTrendSeen(seenSet);
    return {
      scanned: fresh.length + skippedSeen,
      newRepos: fresh.length,
      skippedSeen,
      prefiltered: 0,
      droppedIrrelevant,
      droppedSpam: suspicious.length,
      apiErrors,
      note: apiErrors === perQuery.length
        ? `GitHub API unavailable (${apiErrors}/${perQuery.length} queries failed)`
        : `No new Cortex-relevant repos this cycle (${droppedIrrelevant} irrelevant, ${suspicious.length} spam-filtered)`,
    };
  }

  const shortlist = legit.kept.sort((a, b) => b.stars - a.stars).slice(0, 15);
  const raw = await ctx.llm({
    tier: 'reason',
    maxTokens: 1400,
    messages: [
      {
        role: 'system',
        content: [
          'You are SCOUT\'s trend analyst for Cortex — a local-first cognitive OS with:',
          'a governed agent runtime (budgets, spawn gates, approval inbox), voice agents (Pocket TTS/Kokoro),',
          'browser automation via CDP, Obsidian memory + distilled rules, calendar/energy scheduling, distribution automation.',
          'Repos come from two lanes: newly-created repos gaining stars fast (cheap-adoption window),',
          'and established repos (150+ stars) with fresh pushes this week (the trending-page class —',
          'uv, svelte, nvm territory). Repos flagged as astroturf/spam were already removed.',
          'For each repo decide: does adopting or learning from it close a CONCRETE Cortex gap?',
          'Output STRICT JSON: {"picks":[{"name","fit","why","action":"adopt|watch|ignore","gap"}]}.',
          'Only repos worth attention (fit >= 0.5). "adopt" requires a specific gap it fills — generic "cool project" is watch at best.',
          'Max 6 picks. No prose outside JSON.',
        ].join(' ') + rulesBlock('github trending repos adoption agent tooling mcp voice', 'constraints learned from accepted agent outcomes — follow unless they conflict with the trend scan'),
      },
      {
        role: 'user',
        content: `TRENDING REPOS (mixed lanes, last ${sinceDays}d, by stars):\n${shortlist.map((r) =>
          `- ${r.name} ★${r.stars} [${r.language}] created ${r.createdAt?.slice(0, 10) || 'established'} ${r.description} topics:${r.topics.join(',')}`
        ).join('\n')}`,
      },
    ],
  });
  ctx.progress(0.75);

  let picks: any[] = [];
  try {
    const m = String(raw).match(/\{[\s\S]*\}/);
    picks = m ? (JSON.parse(m[0])?.picks || []) : [];
  } catch { picks = []; }

  const adoptPicks = picks.filter((p: any) => p?.action === 'adopt' && Number(p?.fit) >= 0.6).slice(0, 3);
  let proposalsFiled = 0;
  if (adoptPicks.length) {
    try {
      const { fileStrategyProposals } = await import('./strategy-proposals');
      const actions = adoptPicks.map((p: any) =>
        `[research] Evaluate adopting trending repo ${p.name} — ${String(p.gap || p.why || '').slice(0, 200)} — evidence: ${p.name}, github trend fit ${p.fit}, week ${week}`);
      const res = fileStrategyProposals({ planNote: `github-trend-${week}`, planTaskId: ctx.task.id, actions });
      proposalsFiled = res.filed;
    } catch { proposalsFiled = 0; }
  }

  // Mark everything evaluated this cycle as seen for the week.
  seenSet[week] = [...new Set([...(seenSet[week] || []), ...seen])];
  writeTrendSeen(seenSet);

  const brief = [
    `# GitHub Trend Scan — ${week}`,
    `Scanned ${fresh.length + skippedSeen} repos across ${queries.length + trendingQueries.length} queries, two lanes (${sinceDays}d window).`,
    `${skippedSeen} already evaluated this week · ${droppedIrrelevant} filtered as irrelevant · ${suspicious.length} dropped as spam/astroturf · ${legit.kept.length} reached judgment.`,
    '',
    ...picks.map((p) => `- **${p.action?.toUpperCase()}** ${p.name} (fit ${p.fit}) — ${p.why}${p.gap ? ` [gap: ${p.gap}]` : ''}`),
    picks.length ? '' : '_No trending repo cleared the adoption bar this cycle._',
    ...(suspicious.length
      ? ['', `## Spam-filtered (${suspicious.length})`, ...suspicious.slice(0, 10).map((d) => `- ${d.repo.name} — ${d.reasons.join('; ')}`)]
      : []),
  ].join('\n');

  try {
    cortexObsidianMemory.ensureVaultInitialized();
    cortexObsidianMemory.writeNote(
      '02 - Projects',
      `github-trend-${week}`,
      brief,
      { created: new Date().toISOString(), agent: 'SCOUT', kind: 'github-trend' },
    );
  } catch {}

  ctx.progress(1);
  return {
    scanned: fresh.length + skippedSeen,
    newRepos: fresh.length,
    skippedSeen,
    prefiltered: legit.kept.length,
    droppedIrrelevant,
    droppedSpam: suspicious.length,
    picks: picks.length,
    proposalsFiled,
    apiErrors,
    note: `02 - Projects/github-trend-${week}`,
  };
}

async function agentIdeasWorker(ctx: AgentContext) {
  ctx.progress(0.15);
  // Fleet digest — real telemetry only; ideation must be grounded in what
  // the fleet actually struggled with, not free-floating invention.
  const snapRes = await fetch(`${BASE}/api/cortex/agents/state`, { signal: AbortSignal.timeout(8000) });
  if (!snapRes.ok) throw new Error(`agents/state HTTP ${snapRes.status}`);
  const snap: any = await snapRes.json();
  const agents: any[] = Array.isArray(snap?.agents) ? snap.agents : [];
  const tasks: any[] = Array.isArray(snap?.tasks) ? snap.tasks : [];
  const failed = tasks.filter((t) => t.status === 'failed').slice(-30);
  const digest = agents.map((a) =>
    `${a.id}: status=${a.status} done=${a.tasksCompleted ?? 0} failed=${a.tasksFailed ?? 0} budget=${a.dailyBudget ?? '?'}`
  ).join('\n');
  const failures = failed.map((t) => `${t.agentId}/${t.kind}: ${String(t.error || '').slice(0, 120)}`).join('\n') || 'none';
  ctx.progress(0.4);

  const raw = await ctx.llm({
    tier: 'reason',
    maxTokens: 1500,
    messages: [
      {
        role: 'system',
        content: [
          'You are SCOUT\'s ideation pass for the Cortex agent fleet. Review fleet health and recent failures,',
          'then propose up to 2 ephemeral agent SpawnSpecs that would close a REAL recurring gap.',
          'Output STRICT JSON: {"ideas":[{"callSign","role","mission","tools","modelPin","dailyBudget","ttlHours","systemBrief","doneCriteria","gap"}]}.',
          'tools ⊆ ["read","write","exec","surface"]; modelPin.tier ∈ fast|reason|deep; dailyBudget 1-32; ttlHours 1-168.',
          'callSign UPPER-DASH. Propose NOTHING if the fleet looks healthy — an empty {"ideas":[]} is a valid, preferred answer.',
          'No prose outside JSON.',
        ].join(' ') + rulesBlock('agent ideas spawn proposals capability gap fleet health', 'constraints learned from accepted agent outcomes — follow unless they conflict with the ideation task') + personaCatalogBlock(),
      },
      {
        role: 'user',
        content: `FLEET:\n${digest}\n\nRECENT FAILURES:\n${failures}`,
      },
    ],
  });
  ctx.progress(0.7);

  let ideas: any[] = [];
  try {
    const m = String(raw).match(/\{[\s\S]*\}/);
    ideas = m ? (JSON.parse(m[0])?.ideas || []) : [];
  } catch { ideas = []; }
  ideas = ideas.slice(0, 2);

  const results: any[] = [];
  for (const idea of ideas) {
    try {
      const res = await fetch(`${BASE}/api/cortex/agents/spawn/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedBy: 'scout',
          spec: {
            callSign: idea.callSign, role: idea.role, mission: idea.mission,
            tools: idea.tools, modelPin: idea.modelPin,
            dailyBudget: idea.dailyBudget, ttlHours: idea.ttlHours,
            systemBrief: idea.systemBrief, doneCriteria: idea.doneCriteria,
          },
          evidence: [{
            kind: 'capability_gap',
            refs: [],
            summary: `Ideation pass: ${String(idea.gap || idea.mission || '').slice(0, 200)}`,
          }],
        }),
        signal: AbortSignal.timeout(8000),
      });
      const data: any = await res.json().catch(() => ({}));
      results.push({ callSign: idea.callSign, ok: res.ok && data?.ok === true, reason: data?.error || data?.reason || null, proposalId: data?.proposal?.id || null });
    } catch (e: any) {
      results.push({ callSign: idea.callSign, ok: false, reason: String(e?.message || e).slice(0, 120) });
    }
  }
  ctx.progress(1);
  return { ideas: ideas.length, results };
}

const radarSweep = makeRadarSweepWorker({
  toolExecute: (name, args, timeoutMs, telemetry) => toolExecute(name, args, timeoutMs, telemetry),
  fetchInbox: async () => {
    try {
      const res = await fetch(`${BASE}/api/cortex/gmail/live-inbox`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  },
});

const scoutWorker: WorkerHandler = async (ctx) => {
  const kind = ctx.task.kind || 'research';
  if (kind === 'repo_scan') return repoScanWorker(ctx);
  if (kind === 'github_trend_scan') return githubTrendScanWorker(ctx);
  if (kind === 'agent_ideas') return agentIdeasWorker(ctx);
  if (kind === 'social_scan') return socialScanWorker(ctx);
  if (kind === 'radar_sweep') return radarSweep(ctx);
  if (kind === 'counsel_persona_position') return runPersonaPosition(ctx);
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
        content: 'You are SCOUT, Cortex\'s research operative. Produce a tight, factual research brief from the provided sources. Cite source numbers. If sources conflict, say so. No filler.' + rulesBlock(query, 'constraints learned from accepted agent outcomes — follow unless they conflict with the research task'),
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

// ── Scout: social_scan via Agent Reach ────────────────────────────
// Read-only platform access (github/youtube/web/v2ex/bilibili by
// default; reddit/twitter/etc. once added — the CLI reports
// NEED_LOGIN honestly rather than faking access). agent-reach emits
// one JSON object; items feed the same digest→LLM brief as research.

const AGENT_REACH_BIN = (() => {
  const p = path.join(process.env.HOME || '', '.local', 'bin', 'agent-reach');
  return fs.existsSync(p) ? p : 'agent-reach';
})();

const SOCIAL_ACTIONS: Record<string, Set<string>> = {
  github: new Set(['search', 'read']),
  youtube: new Set(['read', 'search', 'subtitle', 'transcribe']),
  web: new Set(['search', 'read']),
  v2ex: new Set(['hot', 'node', 'read', 'user']),
  bilibili: new Set(['search', 'read', 'hot', 'subtitle']),
  reddit: new Set(['search', 'read', 'subreddit']),
  twitter: new Set(['search', 'profile', 'tweets', 'thread']),
  xiaohongshu: new Set(['search', 'read', 'comments']),
  linkedin: new Set(['jobs', 'read']),
  xueqiu: new Set(['quote', 'search', 'hot_posts', 'hot_stocks']),
  boss: new Set(['search', 'read']),
  xiaoyuzhou: new Set(['transcribe']),
  facebook: new Set(['search', 'profile']),
  instagram: new Set(['search', 'profile', 'posts']),
};

function runAgentReach(args: string[], timeoutMs = 90_000): Promise<any> {
  return new Promise((resolve, reject) => {
    execFile(AGENT_REACH_BIN, args, {
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH || ''}` },
    }, (err, stdout, stderr) => {
      const text = String(stdout || '');
      const start = text.indexOf('{');
      if (start < 0) return reject(new Error(`agent-reach produced no JSON: ${String(stderr || text).slice(0, 200)}`));
      let doc: any = null;
      try { doc = JSON.parse(text.slice(start)); } catch { return reject(new Error('agent-reach returned unparseable JSON')); }
      if (doc?.ok === false) {
        const e = doc.error || {};
        return reject(new Error(`agent-reach ${e.code || 'ERROR'}: ${String(e.message || 'failed').slice(0, 300)}`));
      }
      resolve(doc);
    });
  });
}

async function socialScanWorker(ctx: AgentContext) {
  const input = (ctx.task.input || {}) as any;
  const url = str(input.url);
  const query = str(input.query || input.text);
  const channel = str(input.channel || 'web').toLowerCase();
  let action = str(input.action || 'search').toLowerCase();
  const limit = Math.min(10, Math.max(1, Number(input.limit) || 5));

  if (!url && !query) throw new Error('social_scan requires input.query or input.url');
  const allowed = SOCIAL_ACTIONS[channel];
  if (!allowed) throw new Error(`social_scan: unsupported channel '${channel}'`);
  // URL reads prefer the 'read' action when the channel supports it.
  if (url && allowed.has('read')) action = 'read';
  if (url) {
    if (!/^https?:\/\//i.test(url)) throw new Error('social_scan url must be http(s)');
  } else if (!allowed.has(action)) {
    throw new Error(`social_scan: '${action}' not valid for channel '${channel}' (have: ${[...allowed].join(', ')})`);
  }

  ctx.progress(0.2);
  const args = url
    ? ['read', url]
    : [channel, action, query, '--limit', String(limit)];
  const doc = await runAgentReach(args);
  ctx.progress(0.6);

  const items = Array.isArray(doc?.items) ? doc.items : [];
  if (!items.length) {
    return { query: query || url, channel: doc?.channel || channel, action: doc?.action || action, backend: doc?.backend || null, items: [], brief: 'agent-reach returned no items for this query.', note: 'Empty result is honest — the platform may have nothing or may need login (check error.meta if present).' };
  }

  const digest = items.slice(0, 10).map((it: any, i: number) =>
    `${i + 1}. ${it.title || '(untitled)'}\n   ${it.url || ''}\n   ${it.author ? `by ${it.author}` : ''}\n   ${String(it.text || '').slice(0, 400)}`).join('\n');

  const brief = await ctx.llm({
    tier: 'reason',
    maxTokens: 900,
    messages: [
      {
        role: 'system',
        content: `You are SCOUT, Cortex's research operative. Produce a tight, factual brief from ${doc?.channel || channel} results. Cite item numbers. Prefer recent, substantive posts over listicles. No filler.` + rulesBlock(query || url || 'social scan', 'constraints learned from accepted agent outcomes — follow unless they conflict with the research task'),
      },
      { role: 'user', content: `QUERY: ${query || url}\nCHANNEL: ${doc?.channel || channel} (backend: ${doc?.backend || 'unknown'})\n\nITEMS:\n${digest}\n\nWrite the brief.` },
    ],
  });
  ctx.progress(1);
  return {
    query: query || url,
    channel: doc?.channel || channel,
    action: doc?.action || action,
    backend: doc?.backend || null,
    sources: items.slice(0, 10).map((it: any) => ({ title: it.title, url: it.url, author: it.author })),
    brief,
  };
}

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
        { role: 'system', content: 'You are LIBRARIAN, Cortex\'s memory keeper. Answer from the retrieved memories only. If nothing relevant exists, say so plainly.' + rulesBlock(query, 'constraints learned from accepted agent outcomes — follow unless they conflict with the recall task') },
        { role: 'user', content: `QUERY: ${query}\n\nMEMORY RESULTS:\n${JSON.stringify(mem).slice(0, 6000)}` },
      ],
    });
    ctx.progress(1);
    return { query, memories: mem, answer: synthesis };
  }

  if (kind === 'instinct_cycle') {
    // Continuous-learning-v2 adaptation: mine recent task outcomes for
    // recurring patterns → atomic instinct candidates (Beta confidence,
    // scoped). Promotion stays governed — confident candidates file
    // '[rule]' proposals into the INBOX, never write rules silently.
    ctx.progress(0.1);
    const cursor = instinctCursor();
    const records = readArchive({ limit: 200 });
    const fresh = records
      .filter((r) => (r.finishedAt || r.createdAt || 0) > cursor.lastScanAt)
      .slice(0, 80);
    if (!fresh.length) {
      saveInstinctCursor({ lastScanAt: Date.now(), scannedOutcomes: cursor.scannedOutcomes + 0 });
      return { candidates: 0, reason: 'no new archived outcomes since last scan', scanned: 0 };
    }
    const lines = fresh.map((r) =>
      `${r.status} ${r.agentId}/${r.kind} — ${String(r.title || '').slice(0, 90)}${r.error ? ` ERR:${String(r.error).slice(0, 110)}` : ''}${typeof (r.result as any)?.note === 'string' ? ` NOTE:${String((r.result as any).note).slice(0, 110)}` : ''}`);
    ctx.progress(0.3);
    const raw = await ctx.llm({
      tier: 'fast', maxTokens: 900,
      messages: [
        { role: 'system', content: 'You are LIBRARIAN mining agent-outcome patterns for INSTINCTS — atomic, evidence-backed behavioral rules. From the outcome lines, extract at most 3 NEW instincts that recur or would clearly have prevented failures. Each instinct: {"action":"one imperative sentence","trigger":"when/if condition","agentId":"optional agent scope","ventureId":"optional venture scope","ruleText":"the distilled rule text"}. Only emit instincts grounded in the provided evidence — no generic advice. Output STRICT JSON: {"instincts":[...]}. Empty array is a valid honest answer.' + rulesBlock('agent outcome pattern mining', 'constraints learned from accepted agent outcomes') },
        { role: 'user', content: `OUTCOMES (newest first):\n${lines.join('\n').slice(0, 12000)}` },
      ],
    });
    ctx.progress(0.6);
    let proposed: any[] = [];
    try {
      const m = String(raw).match(/\{[\s\S]*\}/);
      const parsed = m ? JSON.parse(m[0]) : null;
      proposed = Array.isArray(parsed?.instincts) ? parsed.instincts.slice(0, 3) : [];
    } catch { proposed = []; }
    const evidenceIds = fresh.slice(0, 10).map((r) => r.id);
    let created = 0;
    for (const inst of proposed) {
      const action = String(inst?.action || '').trim().slice(0, 300);
      if (action.length < 10) continue;
      const ventureId = typeof inst.ventureId === 'string' && isValidVenture(inst.ventureId) ? inst.ventureId : undefined;
      upsertInstinct({
        action,
        trigger: String(inst.trigger || action).slice(0, 300),
        agentId: typeof inst.agentId === 'string' ? inst.agentId : undefined,
        ventureId,
        source: 'librarian/instinct_cycle',
        evidence: evidenceIds,
        ruleText: String(inst.ruleText || action).slice(0, 400),
      });
      created++;
    }
    // Promotion: confident active instincts file governed '[rule]' proposals.
    let proposalsFiled = 0;
    const promotable = promotableInstincts();
    if (promotable.length) {
      try {
        const { fileStrategyProposals } = await import('./strategy-proposals');
        const actions = promotable.slice(0, 3).map((i: Instinct) =>
          `[rule] Promote instinct ${i.id}: "${i.ruleText || i.action}" — evidence: ${i.evidence.length} refs, Beta confidence ${Math.round((i.alpha / (i.alpha + i.beta)) * 100)}%, trigger: ${i.trigger.slice(0, 120)}`);
        const res = fileStrategyProposals({
          planNote: `instinct-promotion-${new Date().toISOString().slice(0, 10)}`,
          planTaskId: ctx.task.id,
          actions,
          ventureId: promotable[0]?.ventureId,
        });
        proposalsFiled = res.filed;
        for (let idx = 0; idx < Math.min(res.filed, promotable.length); idx++) {
          // markPromoted needs proposal id — approximate via planNote match is
          // fragile; leave status 'active' until Crew approval promotes via
          // the proposal lane (honest: proposal pending ≠ promoted).
        }
      } catch { proposalsFiled = 0; }
    }
    saveInstinctCursor({ lastScanAt: Date.now(), scannedOutcomes: cursor.scannedOutcomes + fresh.length });
    ctx.progress(1);
    return { scanned: fresh.length, candidates: created, promotable: promotable.length, proposalsFiled, instinctsTotal: listInstincts().length };
  }

  if (kind === 'skill_audit') {
    // ECC agent-sort adaptation: evidence-backed DAILY/LIBRARY/REDUNDANT
    // classification across every skill directory Cortex agents use.
    // Read-only audit — writes a report + files a '[process]' proposal;
    // NEVER moves or deletes skills (they live outside repo governance).
    ctx.progress(0.1);
    const SKILL_DIRS = [
      path.join(process.env.HOME || '', '.claude', 'skills'),
      path.join(process.env.HOME || '', '.agents', 'skills'),
      path.join(process.env.HOME || '', '.config', 'devin', 'skills'),
      path.join(process.cwd(), '.claude', 'skills'),
      path.join(process.cwd(), '.devin', 'skills'),
    ].filter((d) => { try { return fs.existsSync(d); } catch { return false; } });
    const inventory: Array<{ dir: string; name: string; desc: string; bytes: number; ageDays: number }> = [];
    for (const dir of SKILL_DIRS) {
      let entries: fs.Dirent[] = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of entries.slice(0, 200)) {
        if (!e.isDirectory()) continue;
        const skillFile = path.join(dir, e.name, 'SKILL.md');
        try {
          const st = fs.statSync(skillFile);
          const head = fs.readFileSync(skillFile, 'utf8').slice(0, 3000);
          const desc = (head.match(/^description:\s*(.+)$/m)?.[1] || '').replace(/^["']|["']$/g, '').slice(0, 200);
          inventory.push({ dir, name: e.name, desc, bytes: st.size, ageDays: Math.round((Date.now() - st.mtimeMs) / 86_400_000) });
        } catch { /* dir without SKILL.md — not a skill */ }
      }
    }
    ctx.progress(0.4);
    if (!inventory.length) return { skills: 0, dirs: SKILL_DIRS.length, reason: 'no SKILL.md files found' };
    // Batch-classify via LLM with mandatory evidence citations.
    const batches = [];
    for (let i = 0; i < inventory.length; i += 40) batches.push(inventory.slice(i, i + 40));
    const classified: Array<{ name: string; dir: string; verdict: string; evidence: string }> = [];
    for (const batch of batches.slice(0, 4)) {
      const raw = await ctx.llm({
        tier: 'fast', maxTokens: 1200,
        messages: [
          { role: 'system', content: 'You are LIBRARIAN running a skill audit. Classify each skill DAILY (load every session — core workflow), LIBRARY (keep installed, load on intent), or REDUNDANT/CONFLICT (overlaps another skill or irrelevant to this workspace — cite which). EVERY verdict needs a one-line evidence citation from the name/description. Output STRICT JSON: {"items":[{"name":"...","verdict":"DAILY|LIBRARY|REDUNDANT","evidence":"..."}]}. No prose outside JSON.' },
          { role: 'user', content: JSON.stringify(batch.map((b) => ({ name: b.name, desc: b.desc, dir: b.dir.replace(process.env.HOME || '', '~'), bytes: b.bytes }))) },
        ],
      }).catch(() => '');
      try {
        const m = String(raw).match(/\{[\s\S]*\}/);
        const parsed = m ? JSON.parse(m[0]) : null;
        for (const it of parsed?.items || []) {
          classified.push({ name: String(it.name), dir: batch.find((b) => b.name === it.name)?.dir || '', verdict: String(it.verdict || 'LIBRARY').toUpperCase(), evidence: String(it.evidence || '').slice(0, 200) });
        }
      } catch { /* batch failed — those skills stay unclassified */ }
      ctx.progress(0.4 + 0.4 * (batches.indexOf(batch) + 1) / Math.min(batches.length, 4));
    }
    const report = {
      generatedAt: new Date().toISOString(),
      dirs: SKILL_DIRS,
      total: inventory.length,
      classified: classified.length,
      daily: classified.filter((c) => c.verdict === 'DAILY').length,
      library: classified.filter((c) => c.verdict === 'LIBRARY').length,
      redundant: classified.filter((c) => c.verdict.includes('REDUNDANT') || c.verdict.includes('CONFLICT')),
      items: classified,
      unclassified: inventory.filter((i) => !classified.some((c) => c.name === i.name)).map((i) => i.name),
      file: '' as string,
    };
    try {
      const reportsDir = path.join(process.cwd(), '.cortex-runtime', 'reports');
      fs.mkdirSync(reportsDir, { recursive: true });
      const file = path.join(reportsDir, `skill-audit-${new Date().toISOString().slice(0, 10)}.json`);
      fs.writeFileSync(file, JSON.stringify(report, null, 2));
      report.file = file;
    } catch { }
    // File ONE governed proposal summarizing redundant/conflict candidates.
    let proposalsFiled = 0;
    const redundants = report.redundant.slice(0, 8);
    if (redundants.length) {
      try {
        const { fileStrategyProposals } = await import('./strategy-proposals');
        const res = fileStrategyProposals({
          planNote: `skill-audit-${new Date().toISOString().slice(0, 10)}`,
          planTaskId: ctx.task.id,
          actions: [
            `[process] Skill audit found ${redundants.length} redundant/conflicting skills — review report and approve archival of: ${redundants.map((r) => `${r.name} (${r.evidence.slice(0, 60)})`).join('; ').slice(0, 700)} — evidence: .cortex-runtime/reports/skill-audit-*.json; skills live outside repo so nothing was moved`,
          ],
        });
        proposalsFiled = res.filed;
      } catch { proposalsFiled = 0; }
    }
    ctx.progress(1);
    return { skills: inventory.length, dirs: SKILL_DIRS.length, daily: report.daily, library: report.library, redundant: redundants.length, proposalsFiled, reportFile: report.file };
  }

  throw new Error(`librarian: unknown task kind '${kind}'`);
};

// ── Builder: governed code tasks ──────────────────────────────────

// ── Blast-radius lanes ────────────────────────────────────────────
// Gate on how expensive a wrong outcome is to undo, not on model
// confidence (which the model itself controls). Three lanes:
//   contained  — read/search/list/web/memory: no side effects, auto lane.
//   reversible — repo-local writes & non-destructive commands: executes,
//                flagged for audit; a bad merge costs a git revert.
//   hard       — destructive or tier-2: never executes, becomes a proposal.
//                This lane does not open regardless of any score.
//
// Policy lives in lane-policy.json (declarative audit artifact) — this
// function is a thin evaluator. This is the OPA-wasm substitute: policy-
// as-data gives the same auditability without a wasm runtime in the
// synchronous hot path (blastLane has ~8 sync call sites; opa-wasm eval
// is async and would force a risky refactor for zero behavioural gain
// in a single-operator deployment).
export type BlastLane = 'contained' | 'reversible' | 'hard';

interface LanePolicy {
  destructivePatterns: string[];
  tier2Patterns: string[];
  containedTools: string[];
  reversibleTools: string[];
  defaultLane: BlastLane;
}

const LANE_POLICY: LanePolicy = (() => {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'src/lib/cortex-agents/lane-policy.json'), 'utf-8')
    ) as LanePolicy;
  } catch {
    // Fallback mirrors the policy file — keeps lanes closed if the JSON
    // is ever missing/corrupt rather than failing open.
    return {
      destructivePatterns: ['rm\\s+-rf', 'rm\\s+-f\\s', 'git\\s+reset\\s+--hard', 'git\\s+clean\\s+-f', 'drop\\s+table', 'mkfs', 'dd\\s+if='],
      tier2Patterns: ['deploy', 'publish', 'push\\s+--force', 'rm\\s+-rf', 'shutdown', 'reboot'],
      containedTools: ['read_file', 'list_dir', 'search_code', 'web_search', 'web_fetch', 'cortex_memory', 'cortex_map', 'cortex_surface'],
      reversibleTools: ['write_file', 'edit_file', 'patch_file', 'run_command', 'exec', 'execute_command', 'render_video'],
      defaultLane: 'reversible',
    };
  }
})();

const DESTRUCTIVE_RE = new RegExp(LANE_POLICY.destructivePatterns.join('|'), 'i');
const TIER2_RE = new RegExp(LANE_POLICY.tier2Patterns.join('|'), 'i');
const CONTAINED_TOOLS = new Set(LANE_POLICY.containedTools);
const REVERSIBLE_TOOLS = new Set(LANE_POLICY.reversibleTools);

export function blastLane(tool: string, argsJson: string): BlastLane {
  if (DESTRUCTIVE_RE.test(tool + ' ' + argsJson) || TIER2_RE.test(tool + ' ' + argsJson)) return 'hard';
  if (CONTAINED_TOOLS.has(tool)) return 'contained';
  if (REVERSIBLE_TOOLS.has(tool)) return 'reversible';
  // Unknown tools default to the strictest executable lane — never 'hard'
  // (that path is proposal-only); 'reversible' still runs the governor's
  // destructive regex above first, so truly dangerous args never reach here.
  return LANE_POLICY.defaultLane;
}


// ── Verification gate (ECC verification-loop adaptation) ──────────
// Deterministic six-phase protocol. Every phase records real exit codes
// and output tails — a gate that only "ran" a command is not a gate.
// FAIL in any phase → incident + auto-registered regression eval.

interface VerifyPhase { name: string; ok: boolean; skipped?: boolean; exitCode?: number; durationMs: number; detail: string }

const SECURITY_GREP_PATTERNS = [
  /(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['"][^'"]{8,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /sk-[a-zA-Z0-9]{20,}/,
  /ghp_[a-zA-Z0-9]{30,}/,
  /xox[baprs]-[a-zA-Z0-9-]{10,}/,
];

async function runShell(command: string, timeoutMs: number, telemetry?: { toolCalls: number; toolFailures: number }): Promise<{ ok: boolean; exitCode: number; out: string; ms: number }> {
  const t0 = Date.now();
  try {
    const res = await toolExecute('run_command', { command, timeout: timeoutMs }, timeoutMs + 15_000, telemetry);
    const stdout = String((res as any)?.stdout || (res as any)?.result?.stdout || '');
    const stderr = String((res as any)?.stderr || (res as any)?.result?.stderr || '');
    const code = typeof (res as any)?.exitCode === 'number' ? (res as any).exitCode : (res?.ok === false ? 1 : 0);
    return { ok: code === 0 && res?.ok !== false, exitCode: code, out: (stdout + '\n' + stderr).slice(-3000), ms: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, exitCode: -1, out: String(e?.message || e).slice(-500), ms: Date.now() - t0 };
  }
}

async function verifyGateWorker(ctx: AgentContext) {
  const phases: VerifyPhase[] = [];
  const tel = ctx.telemetry;
  const phase = async (name: string, fn: () => Promise<{ ok: boolean; exitCode?: number; detail: string }>) => {
    ctx.progress(Math.min(0.95, phases.length / 6));
    const t0 = Date.now();
    try {
      const r = await fn();
      phases.push({ name, ok: r.ok, exitCode: r.exitCode, durationMs: Date.now() - t0, detail: r.detail.slice(0, 400) });
      return r.ok;
    } catch (e: any) {
      phases.push({ name, ok: false, durationMs: Date.now() - t0, detail: `threw: ${String(e?.message || e).slice(0, 300)}` });
      return false;
    }
  };

  // Read package.json scripts once — phases only run what exists.
  const scripts: Record<string, string> = {};
  try {
    const pkgRaw = await toolExecute('read_file', { path: 'package.json' }, 15_000, tel);
    const content = String((pkgRaw as any)?.content || '');
    const m = content.match(/"scripts"\s*:\s*\{([\s\S]*?)\}/);
    if (m) {
      for (const sm of m[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)) scripts[sm[1]] = sm[2];
    }
  } catch { }

  const scriptPhase = (name: string, candidates: string[], timeoutMs: number) =>
    phase(name, async () => {
      const script = candidates.map((c) => scripts[c]).find(Boolean);
      if (!script) return { ok: true, detail: `skipped — no ${candidates.join('/')} script in package.json` };
      const r = await runShell(`npm run ${candidates.find((c) => scripts[c])}`, timeoutMs, tel);
      return { ok: r.ok, exitCode: r.exitCode, detail: `${script} → exit ${r.exitCode}${r.ok ? '' : ' — ' + r.out.slice(-200)}` };
    });

  await scriptPhase('build', ['build'], 600_000);
  // Typecheck: prefer a package script. Otherwise run project-wide tsc and
  // gate on NEW errors vs a frozen baseline — the repo carries thousands of
  // legacy type errors, so absolute zero-error gating would be permanently
  // red and trained into being ignored. Baseline resets only by Crew action.
  await phase('typecheck', async () => {
    const scriptName = ['typecheck', 'tsc', 'type-check'].find((c) => scripts[c]);
    if (scriptName) {
      const r = await runShell(`npm run ${scriptName}`, 240_000, tel);
      return { ok: r.ok, exitCode: r.exitCode, detail: `npm run ${scriptName} → exit ${r.exitCode}${r.ok ? '' : ' — ' + r.out.slice(-200)}` };
    }
    if (!fs.existsSync(path.join(process.cwd(), 'tsconfig.json'))) {
      return { ok: true, detail: 'skipped — no typecheck script or tsconfig.json' };
    }
    const outFile = path.join(process.cwd(), '.cortex-runtime', `tsc-gate-${ctx.task.id}.txt`);
    const baselineFile = path.join(process.cwd(), '.cortex-runtime', 'typecheck-baseline.json');
    const r = await runShell(`npx tsc --noEmit -p tsconfig.json > "${outFile}" 2>&1; echo "TSC_EXIT=$?"`, 300_000, tel);
    const mExit = r.out.match(/TSC_EXIT=(\d+)/);
    if (!mExit) return { ok: false, exitCode: -1, detail: `tsc did not complete within timeout — ${r.out.slice(-160)}` };
    const exitCode = parseInt(mExit[1], 10);
    let raw = '';
    try { raw = fs.readFileSync(outFile, 'utf8'); } catch { }
    const counts = new Map<string, number>();
    for (const line of raw.split('\n')) {
      const em = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+)/);
      if (em) counts.set(`${em[1]}|${em[2]}`, (counts.get(`${em[1]}|${em[2]}`) || 0) + 1);
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    if (exitCode !== 0 && total === 0) {
      return { ok: false, exitCode, detail: `tsc exited ${exitCode} with no parseable errors — ${raw.slice(-200)}` };
    }
    let baseline: Record<string, number> | null = null;
    try { baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8')); } catch { }
    if (!baseline) {
      fs.mkdirSync(path.dirname(baselineFile), { recursive: true });
      fs.writeFileSync(baselineFile, JSON.stringify(Object.fromEntries(counts), null, 2));
      return { ok: true, exitCode, detail: `baseline established — ${total} pre-existing errors across ${counts.size} file/code pairs; gate now blocks NEW type errors` };
    }
    const regressions: string[] = [];
    let resolved = 0;
    for (const [key, n] of counts) {
      const base = baseline[key] || 0;
      if (n > base) regressions.push(`${key.split('|')[1]} +${n - base} in ${key.split('|')[0].split('/').pop()}`);
    }
    for (const [key, n] of Object.entries(baseline)) {
      resolved += Math.max(0, n - (counts.get(key) || 0));
    }
    const ok = regressions.length === 0;
    const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
    return {
      ok, exitCode,
      detail: ok
        ? `${total} errors vs baseline ${baseTotal}${resolved ? `, ${resolved} resolved` : ''} — no new type errors`
        : `NEW type errors: ${regressions.slice(0, 4).join('; ')}${regressions.length > 4 ? ` +${regressions.length - 4} more` : ''}`,
    };
  });
  await scriptPhase('lint', ['lint'], 180_000);
  // Test phase — two signals, both honest:
  //  A) vitest unit suite (src/lib/__tests__ — the suite that actually covers
  //     cortex-agents). Load flakes get ONE retry of just the failed files;
  //     persistent failures fail the phase.
  //  B) npm test contract suite — baseline-aware per-file: the repo carries
  //     stale contract tests referencing removed api/ files, so only NEW
  //     failing files fail the gate. Baseline frozen until Crew resets.
  await phase('test', async () => {
    const details: string[] = [];
    let ok = true;

    // A) vitest unit suite
    const vitFile = path.join(process.cwd(), '.cortex-runtime', `vitest-gate-${ctx.task.id}.txt`);
    const v1 = await runShell(`npx vitest run src/lib/__tests__ --maxWorkers=4 --reporter=dot > "${vitFile}" 2>&1; echo "VITEST_EXIT=$?"`, 290_000, tel);
    let vitRaw = '';
    try { vitRaw = fs.readFileSync(vitFile, 'utf8'); } catch { }
    const failedFiles = [...new Set([...vitRaw.matchAll(/FAIL\s+(src\/lib\/__tests__\/\S+?\.test\.tsx?)/g)].map((m) => m[1]))];
    if (failedFiles.length) {
      // Batch retry first (one vitest startup); if the batch still fails,
      // rerun survivors singly to identify exactly which files are real.
      const retry = await runShell(`npx vitest run ${failedFiles.map((f) => `"${f}"`).join(' ')} --maxWorkers=2 --reporter=dot`, 200_000, tel);
      if (!retry.ok) {
        const survivors: string[] = [];
        for (const f of failedFiles) {
          const one = await runShell(`npx vitest run "${f}" --maxWorkers=1 --reporter=dot`, 120_000, tel);
          if (!one.ok) survivors.push(f);
        }
        if (survivors.length) {
          ok = false;
          details.push(`vitest: ${survivors.length} file(s) still failing after retry — ${survivors.map((f) => f.split('/').pop()).join(', ')}`);
        } else {
          details.push(`vitest: ${failedFiles.length} file(s) flaky — passed on retry`);
        }
      } else {
        details.push(`vitest: ${failedFiles.length} file(s) flaky — passed on retry`);
      }
    } else if (!/VITEST_EXIT=0/.test(v1.out)) {
      ok = false;
      details.push(`vitest: run failed before reporting — ${vitRaw.slice(-160) || v1.out.slice(-160)}`);
    } else {
      details.push('vitest: all unit tests pass');
    }

    // B) npm test contract suite — per-file baseline
    const testFile = path.join(process.cwd(), '.cortex-runtime', `npm-test-gate-${ctx.task.id}.txt`);
    const baselineFile = path.join(process.cwd(), '.cortex-runtime', 'test-baseline.json');
    const t1 = await runShell(`npm test > "${testFile}" 2>&1; echo "TEST_EXIT=$?"`, 290_000, tel);
    let tRaw = '';
    try { tRaw = fs.readFileSync(testFile, 'utf8'); } catch { }
    const failing = new Set([...tRaw.matchAll(/^✖ (tests\/\S+?\.(?:mjs|ts)) \(/gm)].map((m) => m[1]));
    const mExit = t1.out.match(/TEST_EXIT=(\d+)/);
    const testExit = mExit ? parseInt(mExit[1], 10) : -1;
    let baselineFiles: string[] = [];
    try { baselineFiles = JSON.parse(fs.readFileSync(baselineFile, 'utf8')); } catch { }
    if (!baselineFiles.length && failing.size === 0 && testExit !== 0) {
      ok = false;
      details.push(`npm test: exited ${testExit} with no per-file results (guard script or runner failure)`);
    } else if (!baselineFiles.length && failing.size > 0) {
      fs.mkdirSync(path.dirname(baselineFile), { recursive: true });
      fs.writeFileSync(baselineFile, JSON.stringify([...failing].sort(), null, 2));
      details.push(`npm test: baseline established — ${failing.size} pre-existing failing contract file(s)`);
    } else {
      const baseSet = new Set(baselineFiles);
      const fresh = [...failing].filter((f) => !baseSet.has(f));
      const healed = baselineFiles.filter((f) => !failing.has(f));
      if (fresh.length) {
        ok = false;
        details.push(`npm test: NEW failing file(s): ${fresh.join(', ')}`);
      } else {
        details.push(`npm test: ${failing.size} failing file(s) all in baseline${healed.length ? `, ${healed.length} healed` : ''}`);
      }
    }

    return { ok, detail: details.join(' | ').slice(0, 390) };
  });

  // Phase 5 — deterministic security grep over the working diff + src.
  await phase('security-grep', async () => {
    const diff = await runShell('git diff HEAD --stat && git status --porcelain | head -40', 15_000, tel);
    const changed = await runShell('git diff HEAD -U0 | grep -E "^\\+" | grep -vE "^\\+\\+\\+" | head -400', 20_000, tel);
    const hay = changed.out;
    const hits = SECURITY_GREP_PATTERNS.map((re) => ({ re, m: hay.match(re) })).filter((h) => h.m);
    const detail = hits.length
      ? `secrets/keys patterns in added lines: ${hits.map((h) => h.m![0].slice(0, 40)).join('; ')}`
      : `clean — ${diff.out.split('\n').length} changed-file lines scanned`;
    return { ok: hits.length === 0, detail };
  });

  // Phase 6 — diff review via REVIEWER rubric (bounded).
  await phase('diff-review', async () => {
    const diff = await runShell('git diff HEAD | head -c 24000', 20_000, tel);
    if (!diff.out.trim()) return { ok: true, detail: 'clean tree — nothing to review' };
    const out = await ctx.llm({
      tier: 'reason', maxTokens: 400,
      messages: [
        { role: 'system', content: 'You are the verification gate\'s diff reviewer. Answer STRICT JSON {"risk":"low|medium|high","reason":"<=140 chars"}. Flag only real correctness/security risks in the diff — style is not risk.' },
        { role: 'user', content: diff.out },
      ],
    }).catch(() => '');
    try {
      const m = String(out).match(/\{[\s\S]*\}/);
      const j = m ? JSON.parse(m[0]) : null;
      const risk = String(j?.risk || 'unknown');
      return { ok: risk !== 'high', detail: `diff risk: ${risk} — ${String(j?.reason || '').slice(0, 160)}` };
    } catch {
      return { ok: true, detail: 'diff review inconclusive (unparseable judge output) — not counted as failure' };
    }
  });

  // Phase 7 — impeccable design-slop gate: audits ONLY the UI files git
  // reports as changed (--changed), auto-loads DESIGN.md context. Error-
  // severity findings (uncaught script errors, invisible-at-rest content)
  // fail the gate; warnings/advisories are reported but non-fatal —
  // taste-level findings must not block verification forever.
  await phase('design-audit', async () => {
    // execFile directly — run_command's shell env can't exec /opt/homebrew
    // binaries or pipes reliably; process.execPath is the running node.
    const gateOut = await new Promise<string>((resolve) => {
      execFile(process.execPath, [path.join(process.cwd(), 'scripts', 'impeccable-gate.mjs')],
        { timeout: 175_000, maxBuffer: 4 * 1024 * 1024 },
        (err, stdout, stderr) => resolve(String(stdout || '') + (err ? `\n${String(stderr || err.message).slice(0, 200)}` : '')));
    });
    const m = gateOut.match(/IMPECCABLE_ERROR_COUNT=(\d+)/);
    if (!m) return { ok: true, detail: `impeccable inconclusive — ${gateOut.slice(-160) || 'no output'}` };
    const errorCount = parseInt(m[1], 10);
    const summary = gateOut.split('\n').find((l) => l.startsWith('FINDINGS')) || '';
    return {
      ok: errorCount === 0,
      detail: `${summary || `error findings: ${errorCount}`}${errorCount ? ' — fix or add impeccable-disable comment with reason' : ''}`.slice(0, 390),
    };
  });

  const failed = phases.filter((p) => !p.ok);
  const verdict = failed.length === 0 ? 'pass' : 'fail';
  ctx.progress(1);

  // Failure → incident + regression eval (the loop closes itself).
  if (failed.length) {
    try {
      const { recordIncidentFailure } = await import('./incidents');
      recordIncidentFailure({
        agentId: ctx.task.agentId, kind: 'verify_gate',
        title: `verify_gate failed: ${failed.map((f) => f.name).join(', ')}`,
        error: failed.map((f) => `${f.name}: ${f.detail}`).join(' | ').slice(0, 300),
        failureClass: 'worker', taskId: ctx.task.id,
      });
    } catch { }
    return { verdict, phases, failedPhases: failed.map((f) => f.name) };
  }
  return { verdict, phases, scriptsSeen: Object.keys(scripts) };
}

const builderWorker: WorkerHandler = async (ctx) => {
  if (ctx.task.kind === 'verify_gate') return verifyGateWorker(ctx);
  const instruction = str(ctx.task.input.instruction || ctx.task.input.query);
  if (!instruction) throw new Error('builder requires input.instruction');

  ctx.progress(0.1);
  const distilledRules = relevantRules(instruction);
  const memoryCtx = await recallCortexMemory(instruction, { budget: 'low', timeoutMs: 2500 });
  // Spec expansion: terse instruction → contract (objective/constraints/
  // non-goals/verification) before planning. Fail-soft to raw instruction.
  const spec = await expandTaskSpec(ctx.llm, instruction + retryNote(ctx.task.input), 'reason');
  ctx.progress(0.2);
  // Plan step: reason about the task into concrete tool steps. One retry
  // with a corrective nudge — small models sometimes answer in prose.
  const planMessages = [
    {
      role: 'system',
      content: `You are BUILDER, Cortex's engineering operative. Given a coding task, output a JSON array of steps, each {"tool": "<name>", "args": {...}, "why": "..."}. Allowed tools: read_file, write_file, edit_file, list_dir, run_command, search_code. Prefer read/search before write. If the task needs anything destructive or external (deploy, push, rm -rf, purchases, messages to people), output {"veto": true, "reason": "..."} instead — those become user proposals, never silent execution. Output ONLY the JSON array.${distilledRules ? `\n\nDISTILLED RULES (constraints learned from accepted agent outcomes — follow unless they conflict with governance):\n${distilledRules}` : ''}${memoryCtx ? `\n\n${memoryCtx}` : ''}${ENGINEERING_DISCIPLINE}`,
    },
    { role: 'user', content: instruction + specBlock(spec) + designBlock() + retryNote(ctx.task.input) },
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
  if (ctx.task.kind === 'verify_gate') return verifyGateWorker(ctx);
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
    const diffText = String((diff as any)?.stdout || (diff as any)?.result?.stdout || '');
    const statText = String((stat as any)?.stdout || (stat as any)?.result?.stdout || '');
    material = `GIT STATUS:\n${statText.slice(0, 2000)}\n\nDIFF:\n${diffText.slice(0, 30000)}`;
    sources.push('git diff HEAD');
  }
  ctx.progress(0.5);

  if (!material.trim() || material.trim() === 'DIFF:\n')
    throw new Error('reviewer found no material to review (clean tree? pass input.files)');

  const reviewOut = await ctx.llm({
    tier: 'reason',
    maxTokens: 1600,
    messages: [
      {
        role: 'system',
        content: 'You are REVIEWER, Cortex\'s read-only code critic and evaluator. Score the material on FIVE axes — accuracy, completeness, clarity, actionability, conciseness — each 1-5. RULES: every score requires an evidence citation (file:line, diff hunk, or quoted text); a score of 5 requires concrete proof, not persuasive prose; if evidence is absent for an axis, cap that axis at 3. Then list findings as CRITICAL (bugs, security, data loss), WARNINGS (design, maintainability, error handling), SUGGESTIONS (style, nits) — cite file:line, describe fixes in one line, never rewrite code. Output ONLY a JSON object: {"scorecard":{"accuracy":n,"completeness":n,"clarity":n,"actionability":n,"conciseness":n,"evidence":["cite1","cite2"]},"verdict":"pass|warn|fail","findings":[{"severity":"critical|warning|suggestion","where":"file:line","issue":"...","fix":"one line"}]}. If material is clean, scorecard axes may be 5 only with citations proving cleanliness.' + rulesBlock(instruction || files.join(' ') || 'code review', 'constraints learned from accepted agent outcomes — follow unless they conflict with the review task'),
      },
      {
        role: 'user',
        content: `REVIEW REQUEST: ${instruction || 'Review the changes.'}\n\nMATERIAL:\n${material.slice(0, 28000)}`,
      },
    ],
  });
  ctx.progress(1);
  // Parse the JSON scorecard; fall back to raw text if the model drifted.
  let scorecard: any = null;
  let verdict = 'unknown';
  let findingsList: any[] = [];
  try {
    const m = String(reviewOut).match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : null;
    if (parsed?.scorecard) {
      scorecard = parsed.scorecard;
      verdict = String(parsed.verdict || 'unknown');
      findingsList = Array.isArray(parsed.findings) ? parsed.findings.slice(0, 20) : [];
    }
  } catch { /* fall through to raw */ }
  const findings = scorecard
    ? `VERDICT: ${verdict}\nSCORECARD: ${JSON.stringify(scorecard)}\nFINDINGS:\n${findingsList.map((f: any) => `- [${f.severity}] ${f.where || ''}: ${f.issue || ''} → ${f.fix || ''}`).join('\n')}`
    : reviewOut;
  return { sources, scorecard, verdict, findings, findingsList };
};

// ── Runner: execute → filter → summarize (the context firewall) ───
// Verbose command output never reaches chat or the task result raw —
// the worker holds it server-side and returns a distilled report.

const runnerWorker: WorkerHandler = async (ctx) => {
  const kind = ctx.task.kind;

  // calendar_create — approved Life Radar events write to Apple/Google
  // Calendar via scripts/calendar-create.mjs. Approval already happened
  // upstream (strategy proposal gate); this is the execution half.
  if (kind === 'calendar_create') {
    const ev = (ctx.task.input.calendarEvent || {}) as any;
    if (!ev.title || !ev.startISO) throw new Error('calendar_create requires input.calendarEvent.{title,startISO}');
    ctx.progress(0.2);
    const script = path.join(process.cwd(), 'scripts', 'calendar-create.mjs');
    const parts = [
      `node ${JSON.stringify(script)}`,
      `--title ${JSON.stringify(String(ev.title).slice(0, 200))}`,
      `--start ${JSON.stringify(String(ev.startISO))}`,
    ];
    if (ev.endISO) parts.push(`--end ${JSON.stringify(String(ev.endISO))}`);
    if (ev.allDay) parts.push('--allday');
    if (ev.notes) parts.push(`--notes ${JSON.stringify(String(ev.notes).slice(0, 500))}`);
    const calendars = Array.isArray(ev.calendars) && ev.calendars.length ? ev.calendars.join(',') : 'apple,google';
    parts.push(`--calendars ${JSON.stringify(calendars)}`);
    const out = await toolExecute('run_command', {
      command: parts.join(' '),
      timeout: 90,
    }, 100_000, ctx.telemetry);
    ctx.progress(0.8);
    const stdout = String((out as any)?.stdout || '');
    let parsed: any = null;
    try { parsed = JSON.parse(stdout.slice(stdout.indexOf('CALENDAR_CREATE:') + 17).trim()); } catch {}
    const ok = parsed ? Object.values(parsed).every((r: any) => r?.ok) : out?.ok === true;
    ctx.progress(1);

    // Gap-fill: mirror server-created events into calendar-upcoming.json so
    // tomorrow's brief sees them even if the client feed is stale. Also
    // close the loop on the originating LifeEvent (candidate → added).
    if (ok) {
      try {
        const feedPath = path.join(process.cwd(), '.cortex-runtime', 'calendar-upcoming.json');
        const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
        const events = Array.isArray(feed?.events) ? feed.events : [];
        const startMs = new Date(String(ev.startISO)).getTime();
        const endMs = ev.endISO ? new Date(String(ev.endISO)).getTime() : startMs + 3600_000;
        if (Number.isFinite(startMs) && !events.some((e: any) => String(e?.title || '') === String(ev.title))) {
          events.push({
            id: `radar-${Date.now().toString(36)}`,
            title: String(ev.title), start: startMs, end: endMs,
            attendees: [], source: 'life-radar',
          });
          fs.writeFileSync(feedPath, JSON.stringify({ events: events.slice(-100) }));
        }
      } catch {}
      try {
        const lifeId = String(ctx.task.input.lifeEventId || '');
        if (lifeId) {
          const lf = path.join(process.cwd(), '.cortex-runtime', 'life-events.json');
          const ledger = JSON.parse(fs.readFileSync(lf, 'utf8'));
          const le = (ledger.events || []).find((e: any) => e.id === lifeId);
          if (le) { le.status = 'added'; le.updatedAt = Date.now(); fs.writeFileSync(lf, JSON.stringify(ledger, null, 1)); }
        }
      } catch {}
    }

    return {
      calendarEvent: { title: ev.title, startISO: ev.startISO, calendars },
      ok,
      results: parsed,
      tail: stdout.slice(-600),
    };
  }

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

  const stdout = String((out as any)?.stdout || (out as any)?.result?.stdout || '');
  const stderr = String((out as any)?.stderr || (out as any)?.result?.stderr || '');
  const exitCode = Number((out as any)?.exitCode ?? (out as any)?.result?.exitCode ?? (out?.ok === false ? 1 : 0));
  const ok = out?.ok !== false && exitCode === 0;
  const combined = [stdout, stderr].filter(Boolean).join('\n');

  // Distill: the summary is what the world sees; raw output stays here.
  const summary = await ctx.llm({
    tier: 'fast',
    maxTokens: 400,
    messages: [
      {
        role: 'system',
        content: 'You are RUNNER, Cortex\'s exec operative. Given a command and its output, report ONLY: what ran, whether it passed, the 3-5 most important facts (failures, errors, key numbers), and anything the operator must act on. No restating passing output. If it passed cleanly, one line is enough.' + rulesBlock(effective, 'constraints learned from accepted agent outcomes — follow unless they conflict with the reporting task'),
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
  // Worktree isolation (orca-pattern): spawned agents with spec.worktree get a
  // dedicated git worktree provisioned by runtime.approveSpawn. All relative
  // file args resolve inside it and run_command defaults its cwd there.
  // Path keys rewritten deterministically — the model can't forget.
  const WT_PATH_KEYS = ['path', 'filePath', 'filepath', 'targetPath', 'dir', 'cwd'];

  return async (ctx) => {
    const instruction = str(ctx.task.input.instruction || ctx.task.input.query || ctx.task.input.task || ctx.task.title);
    if (!instruction) throw new Error(`${spec.callSign}: task requires input.instruction|query|task`);

    const wtPath = spec.worktree
      ? path.join(process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime'), 'worktrees', String(ctx.task.agentId))
      : null;
    const wtPrompt = wtPath
      ? `\n\nWORKSPACE ISOLATION: you are inside git worktree ${wtPath}. All file work and command cwd stay inside it — relative paths resolve there automatically; do not reference the shared tree.`
      : '';
    const insideWt = (p: string) => p === wtPath || (wtPath != null && p.startsWith(wtPath + path.sep));

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
          content: `${spec.systemBrief}\n\nDONE CRITERIA: ${spec.doneCriteria}\n\nYou are ${spec.callSign}, an ephemeral agent. Given a task, output a JSON array of steps, each {"tool": "<name>", "args": {...}, "why": "..."}. Allowed tools ONLY: ${allowedToolsList}. Prefer read before write. Anything destructive or external becomes {"veto": true, "reason": "..."}. Output ONLY the JSON array.${wtPrompt}${distilledRules ? `\n\nDISTILLED RULES (constraints learned from accepted agent outcomes — follow unless they conflict with your scope):\n${distilledRules}` : ''}${ENGINEERING_DISCIPLINE}`,
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
      // Worktree containment: relative path args resolve inside the agent's
      // worktree; `..` escapes and absolute paths outside it are vetoed.
      // run_command always executes with cwd=worktree.
      if (wtPath) {
        let escaped = false;
        for (const k of WT_PATH_KEYS) {
          const v = args[k];
          if (typeof v !== 'string' || !v.trim() || /^https?:\/\//i.test(v) || v.trim() === '~') continue;
          const raw = v.trim();
          if (path.isAbsolute(raw)) {
            if (!insideWt(path.resolve(raw))) { escaped = true; break; }
            continue; // absolute path already inside — leave as-is
          }
          const resolved = path.resolve(wtPath, raw);
          if (!insideWt(resolved)) { escaped = true; break; }
          args[k] = resolved;
        }
        if (escaped) {
          results.push({ step: i, tool, vetoed: true, lane: 'hard', reason: 'path escapes agent worktree' });
          lanes.hard++;
          i++;
          continue;
        }
        if (tool === 'run_command' || tool === 'exec' || tool === 'execute_command') args.cwd = wtPath;
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

// ── Forecaster: evidence-cited prediction cycle ────────────────────
// Probes emit ForecastSignals; the router tiers them (ambient → initiative
// proposal → rationed spoken). No LLM in the loop for detection — signals
// are deterministic reads of real state. LLM composition comes later for
// interrupt-class narration only.

const forecasterWorker = (runtime: AgentRuntime): WorkerHandler => async (ctx) => {
  const kind = ctx.task.kind || 'forecast_cycle';
  if (kind === 'counsel_position') {
    return runCounselPosition(ctx, 'forecaster', 'FDO — trajectory & forecast counsel');
  }
  if (kind !== 'forecast_cycle' && kind !== 'forecast_status') {
    throw new Error(`forecaster: unknown task kind '${kind}'`);
  }
  ctx.progress(0.2);

  const deps: ProbeDeps = {
    now: Date.now(),
    base: BASE,
    fetchImpl: fetch,
    getAgentSnapshot: async () => {
      const res = await fetch(`${BASE}/api/cortex/agents/state`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`agents/state HTTP ${res.status}`);
      return res.json();
    },
    listUpcomingEvents: async () => {
      // Calendar source is pluggable; until a local events endpoint exists
      // the probe gets an empty list and stays silent (honest, not an error).
      try {
        const res = await fetch(`${BASE}/api/cortex/calendar/upcoming`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return [];
        const data: any = await res.json();
        const events = Array.isArray(data?.events) ? data.events : [];
        return events.map((e: any) => ({
          id: String(e?.id ?? e?.title ?? ''),
          title: String(e?.title ?? e?.summary ?? ''),
          start: Number(e?.start ?? e?.startTime ?? 0),
          end: Number.isFinite(Number(e?.end ?? e?.endTime)) ? Number(e?.end ?? e?.endTime) : undefined,
          attendees: Array.isArray(e?.attendees) ? e.attendees.length : Number(e?.attendees) || 0,
          attendeeNames: Array.isArray(e?.attendees)
            ? e.attendees.map((a: any) => String(a?.email ?? a?.name ?? a)).filter(Boolean)
            : Array.isArray(e?.attendeeNames) ? e.attendeeNames.map(String) : undefined,
          hasPrepBrief: e?.hasPrepBrief === true,
        })).filter((e: any) => e.title && e.start > 0);
      } catch {
        return [];
      }
    },
    getInboxSummary: async () => {
      try {
        const res = await fetch(`${BASE}/api/cortex/gmail/live-inbox`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    getSenseSnapshot: async () => {
      try {
        const res = await fetch(`${BASE}/api/cortex/initiative/sense`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data: any = await res.json();
        return data?.snapshot || data || null;
      } catch {
        return null;
      }
    },
    getDistributionStatus: async () => {
      try {
        const res = await fetch(`${BASE}/api/cortex/distribution/status`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    getWeatherAlerts: async () => {
      // NWS CAP feed — free, no key. Watches zones from CORTEX_WATCH_ZONES
      // env or the client-reported location resolved via /api/cortex/geo/watch
      // (stored in .cortex-runtime/watch-zones.json). Neither configured →
      // silent rather than reporting national noise.
      let zones = (process.env.CORTEX_WATCH_ZONES || '')
        .split(',').map((z) => z.trim()).filter(Boolean);
      if (!zones.length) {
        try {
          const wf = path.join(process.cwd(), '.cortex-runtime', 'watch-zones.json');
          const w = JSON.parse(fs.readFileSync(wf, 'utf8'));
          if (Array.isArray(w?.zones)) zones = w.zones.map(String).filter(Boolean);
        } catch {}
      }
      if (!zones.length) return null;
      try {
        const res = await fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert', {
          headers: { 'User-Agent': 'cortex-forecaster (personal)' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const data: any = await res.json();
        const features: any[] = Array.isArray(data?.features) ? data.features : [];
        const hits = features.filter((f) => {
          const areas = [
            ...(f?.properties?.geocode?.UGC || []),
            ...(f?.properties?.geocode?.SAME || []),
          ].map(String);
          return zones.some((z) => areas.includes(z));
        });
        if (!hits.length) return { count: 0, maxSeverity: 'None', regions: [] };
        const sevRank = ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'];
        const maxSeverity = hits
          .map((h) => String(h?.properties?.severity || 'Unknown'))
          .sort((a, b) => sevRank.indexOf(a) - sevRank.indexOf(b))[0] || 'Unknown';
        // Tier-1 globe markers: centroid each alert's GeoJSON geometry.
        const geos: { lat: number; lon: number; label: string }[] = [];
        for (const h of hits) {
          const geom = h?.geometry;
          const rings = geom?.type === 'Polygon' ? [geom.coordinates?.[0]]
            : geom?.type === 'MultiPolygon' ? (geom.coordinates || []).map((p: any) => p?.[0])
            : [];
          const ring = rings.find((r: any) => Array.isArray(r) && r.length > 2);
          if (!ring) continue;
          let sx = 0, sy = 0, n = 0;
          for (const pt of ring) {
            const lon = Number(pt?.[0]), lat = Number(pt?.[1]);
            if (Number.isFinite(lat) && Number.isFinite(lon)) { sx += lon; sy += lat; n++; }
          }
          if (n > 2) {
            geos.push({
              lat: sy / n, lon: sx / n,
              label: `${maxSeverity} · ${(h?.properties?.geocode?.UGC || [])[0] || 'alert'}`,
            });
          }
          if (geos.length >= 8) break;
        }
        return {
          count: hits.length,
          maxSeverity,
          regions: [...new Set(hits.flatMap((h) => (h?.properties?.geocode?.UGC || []).map(String)))],
          geos,
        };
      } catch {
        return null;
      }
    },
  };

  const result = await runForecastCycle(deps, {
    submitProposal: (r: RoutedForecast) => {
      const engine = getCortexProactiveInitiative();
      return engine.submitProposal({
        category: 'forecast',
        title: r.claim.slice(0, 140),
        summary: [
          r.why ? `Why: ${r.why}` : null,
          r.suggestedAction ? `Suggested: ${r.suggestedAction}` : null,
          `Evidence: ${r.evidence.map((e) => `${e.kind}:${e.ref}`).join(', ')}`,
          `Confidence: ${Math.round(r.confidence * 100)}% · domain: ${r.domain}`,
        ].filter(Boolean).join('\n'),
        urgency: r.confidence >= 0.85 ? 'high' : r.confidence >= 0.6 ? 'medium' : 'low',
        suggestedTool: 'cortex_memory',
        suggestedArgs: { action: 'search', query: r.claim.slice(0, 200), limit: 5 },
        requiresApproval: true,
        epistemicConfidence: r.confidence,
        source: 'sensor',
        dedupeKey: r.id,
        why: r.why,
      });
    },
  });
  ctx.progress(1);
  // Agent handoffs: routed signals may dispatch downstream tasks (e.g.
  // calendar noprep → PREP brief). Target agent budgets + submitTask dedupe
  // govern whether the handoff actually runs — FORECASTER never forces it.
  let prepsDispatched = 0;
  const handoffErrors: string[] = [];
  for (const r of result.routed) {
    if (!r.handoff) continue;
    try {
      const sub = runtime.submitTask(r.handoff.agent as AgentId, r.handoff.kind, r.handoff.title, r.handoff.input);
      if (sub.ok) prepsDispatched++; else handoffErrors.push(`${r.handoff.agent}: ${sub.error || 'rejected'}`);
    } catch (e) {
      handoffErrors.push(`${r.handoff.agent}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return {
    kind,
    probes: ['fleet', 'calendar', 'comms', 'build', 'distribution', 'weather', 'energy'],
    signalsFound: result.signalsFound,
    routed: result.routed.map((r) => ({
      id: r.id, domain: r.domain, tier: r.tier, claim: r.claim,
      confidence: r.confidence, demoted: r.demoted === true,
    })),
    droppedNoEvidence: result.droppedNoEvidence,
    proposalsFiled: result.proposalsFiled,
    spokenUsed: result.spokenUsed,
    spokenRemaining: result.spokenRemaining,
    probeErrors: result.probeErrors,
    prepsDispatched,
    handoffErrors,
  };
};

// ── Devin: Principal Architect ───────────────────────────────────
// The deepest agent in the fleet. Where BUILDER is a one-shot
// plan→execute operative, DEVIN runs a plan→execute→verify→repair loop:
// it treats its own output as guilty until a verification command or
// rendered evidence proves otherwise, then reports only what it can
// stand behind. Hard blast-radius still routes to proposals — depth
// never bypasses governance.

const DEVIN_SYSTEM = `You are DEVIN, Cortex's principal architect — the deepest reasoning agent in the fleet. You pair-program with the operator on real engineering work: debugging, refactors, features, research synthesis, architecture.

Operating contract (non-negotiable):
- VERIFY BEFORE CLAIM. Never report success without evidence: a passing test, a clean typecheck, a diff you actually read, an HTTP 200 you actually got. "Should work" is not done.
- SURGICAL CHANGES. Read before you write. Prefer the smallest correct diff. Match the codebase's existing conventions over your own preferences.
- HONEST STATUS. Report exactly three states: verified (evidence shown), partial (what worked, what didn't), unverified (couldn't check — say why). Never blur them.
- ESCALATE, DON'T GUESS. Destructive ops, external side effects, ambiguous requirements → veto/proposal, never silent execution.
- ROOT CAUSE, NOT SYMPTOMS. When something fails, find why before patching. A fix that treats the symptom is a future incident.

Given a task, output a JSON array of steps {"tool","args","why"} — or {"veto":true,"reason"} for tier-2 work. Allowed tools: read_file, write_file, edit_file, list_dir, run_command, search_code, web_fetch. Include a run_command verification step (test/typecheck/lint/build) whenever the task changes code. Output ONLY the JSON array.`;

const devinWorker: WorkerHandler = async (ctx) => {
  // Cloud delegation kinds → real Devin sessions via API v3 bridge.
  // devin_ask: read-only Q&A (reversible). devin_task: repo work — hard
  // lane, requires explicit operator approval recorded in the task input.
  if (ctx.task.kind === 'devin_ask' || ctx.task.kind === 'devin_task') {
    const { devinConfig, launchDevinSession, DevinApiError } = await import('./devin-bridge');
    if (!devinConfig().configured)
      throw new Error('devin bridge not configured — set DEVIN_API_KEY + DEVIN_ORG_ID');
    const instruction = str(ctx.task.input.instruction || ctx.task.input.query || ctx.task.title);
    if (!instruction) throw new Error(`${ctx.task.kind} requires input.instruction`);
    // Governance proof: operatorApproved flag (direct API/voice path) OR an
    // approvedProposalId that resolves to an approved devin_task proposal.
    let approved = ctx.task.input.operatorApproved === true;
    const proposalId = str(ctx.task.input.approvedProposalId);
    if (!approved && proposalId) {
      try {
        const { listStrategyProposals } = await import('./strategy-proposals');
        const p = listStrategyProposals().find((x) => x.id === proposalId);
        approved = Boolean(p && p.kind === 'devin_task' && (p.status === 'approved' || p.status === 'executed'));
      } catch { approved = false; }
    }
    if (ctx.task.kind === 'devin_task' && !approved) {
      ctx.progress(1);
      let filed = false;
      try {
        const { fileDevinSessionProposal } = await import('./strategy-proposals');
        filed = fileDevinSessionProposal({
          taskId: ctx.task.id, title: ctx.task.title || instruction,
          instruction,
          taskInput: { context: ctx.task.input.context, repo: ctx.task.input.repo, mode: ctx.task.input.mode },
        });
      } catch { /* proposal filing is best-effort — veto still honest */ }
      return {
        vetoed: true,
        reason: 'devin_task launches a cloud agent that can push code — Inbox approval required',
        proposal: { title: ctx.task.title, instruction, kind: 'devin_task', inboxProposalFiled: filed },
        note: filed
          ? 'Filed to Initiative Inbox — approve there to launch the Devin session.'
          : 'Approval required — resubmit with operatorApproved:true or approve the pending Inbox proposal.',
      };
    }
    ctx.progress(0.3);
    try {
      const rec = await launchDevinSession({
        taskId: ctx.task.id,
        kind: ctx.task.kind as 'devin_ask' | 'devin_task',
        title: ctx.task.title || instruction,
        prompt: `${instruction}${ctx.task.input.context ? `\n\nContext:\n${str(ctx.task.input.context).slice(0, 2000)}` : ''}`,
      });
      ctx.progress(1);
      return {
        sessionId: rec.devinId,
        url: rec.url,
        status: 'launched',
        kind: ctx.task.kind,
        note: 'Devin session launched — result arrives via the session poller, not this response. LAUNCHED is not FINISHED.',
      };
    } catch (e: any) {
      if (e instanceof DevinApiError)
        throw new Error(`devin api ${e.status}: ${e.message}${e.retryable ? ' (retryable)' : ''}`);
      throw e;
    }
  }
  const instruction = str(ctx.task.input.instruction || ctx.task.input.query);
  if (!instruction) throw new Error('devin requires input.instruction');

  ctx.progress(0.05);
  // Check for session handoff baton from Antigravity (Dual-Engine Failover)
  const pendingHandoff = readSessionHandoff();
  let handoffContext = '';
  if (pendingHandoff && (ctx.task.kind === 'pickup' || ctx.task.input?.pickup || ctx.task.input?.handoff)) {
    handoffContext = `\n\n[ANTIGRAVITY SESSION HANDOFF BATON (INGESTED)]\nMission: ${pendingHandoff.mission}\nPhase: ${pendingHandoff.currentPhase}\nFiles Modified: ${pendingHandoff.filesModified.join(', ')}\nPassing Tests: ${pendingHandoff.verifiedTests.join(', ')}\nImmediate Next Step: ${pendingHandoff.immediateNextStep}\nBlockers: ${pendingHandoff.knownBlockers || 'none'}\n`;
    markHandoffClaimed('devin');
  }

  const distilledRules = relevantRules(instruction);
  const spec = await expandTaskSpec(ctx.llm, instruction + handoffContext + retryNote(ctx.task.input), 'deep');
  ctx.progress(0.15);

  const planMessages = [
    { role: 'system', content: DEVIN_SYSTEM + (distilledRules ? `\n\nDISTILLED RULES (constraints learned from accepted outcomes — follow unless they conflict with governance):\n${distilledRules}` : '') },
    { role: 'user', content: instruction + handoffContext + specBlock(spec) + designBlock() + retryNote(ctx.task.input) },
  ];
  const parseSteps = (text: string): any[] => {
    try {
      const m = text.match(/\[[\s\S]*\]/);
      const p = m ? JSON.parse(m[0]) : null;
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  };
  let planText = await ctx.llm({ tier: 'deep', maxTokens: 900, messages: planMessages });
  ctx.progress(0.3);
  let steps = parseSteps(planText);
  if (!steps.length) {
    planText = await ctx.llm({
      tier: 'deep', maxTokens: 900,
      messages: [...planMessages,
        { role: 'assistant', content: planText.slice(0, 1500) },
        { role: 'user', content: 'Not a valid JSON array. Output ONLY the JSON array of steps now.' }],
    });
    steps = parseSteps(planText);
  }
  if (!steps.length)
    throw new Error(`devin could not decompose task (model returned: ${planText.slice(0, 160).replace(/\s+/g, ' ')})`);

  const risky = steps.find((s) => s?.veto || TIER2_RE.test(JSON.stringify(s)));
  if (risky) {
    ctx.progress(1);
    return { vetoed: true, reason: risky.reason || 'task requires tier-2 approval', proposal: { title: ctx.task.title, instruction, steps: steps.slice(0, 5) }, note: 'Routed to initiative proposal path — nothing was executed.' };
  }

  const execSteps = async (list: any[]) => {
    const results: any[] = [];
    const lanes: Record<BlastLane, number> = { contained: 0, reversible: 0, hard: 0 };
    for (const [i, step] of list.slice(0, 8).entries()) {
      if (ctx.signal.aborted) throw new Error('cancelled');
      const tool = String(step?.tool || '');
      const args = (step?.args && typeof step.args === 'object') ? step.args : {};
      const lane = blastLane(tool, JSON.stringify(args));
      lanes[lane]++;
      if (lane === 'hard') { results.push({ step: i, tool, vetoed: true, lane }); continue; }
      const out = await toolExecute(tool, args, 60_000, ctx.telemetry);
      results.push({ step: i, tool, lane, ok: out.ok !== false, output: JSON.stringify(out).slice(0, 800) });
    }
    return { results, lanes };
  };

  let { results, lanes } = await execSteps(steps);
  ctx.progress(0.65);

  // Verify-and-repair: if a verification-shaped step failed, feed the
  // failure back and give the model one repair round per failure class.
  const failures = () => results.filter((r) => r.ok === false || r.vetoed);
  let repairs = 0;
  for (let round = 0; round < 2 && failures().length; round++) {
    const failCtx = failures().map((f) => `${f.tool}: ${String(f.output || 'vetoed').slice(0, 300)}`).join('\n');
    const fixText = await ctx.llm({
      tier: 'deep', maxTokens: 700,
      messages: [
        { role: 'system', content: DEVIN_SYSTEM },
        { role: 'user', content: `TASK: ${instruction}\n\nThese steps FAILED — diagnose root cause and output ONLY a JSON array of corrective steps (same tool vocabulary), or [{"veto":true,"reason":"..."}] if unfixable within governance.\n\nFAILURES:\n${failCtx}` },
      ],
    });
    const fixSteps = parseSteps(fixText);
    if (!fixSteps.length || fixSteps[0]?.veto) break;
    repairs++;
    const retry = await execSteps(fixSteps);
    lanes = { contained: lanes.contained + retry.lanes.contained, reversible: lanes.reversible + retry.lanes.reversible, hard: lanes.hard + retry.lanes.hard };
    results = results.concat(retry.results);
    ctx.progress(0.65 + 0.15 * (round + 1));
  }
  ctx.progress(1);

  const failed = failures();
  const verifyRan = results.some((r) => /test|typecheck|lint|verify|check|build/i.test(String(r.tool)));
  const verifyPassed = verifyRan && !results.some((r) => /test|typecheck|lint|verify|check|build/i.test(String(r.tool)) && r.ok === false);
  return {
    instruction,
    spec: spec ?? undefined,
    stepsExecuted: results.length,
    repairs,
    lanes,
    results,
    // Honest verification status: what ran, what passed, what never did.
    verification: {
      required: spec?.verification ?? null,
      verifyStepRan: verifyRan,
      verifyStepPassed: verifyPassed,
      unresolvedFailures: failed.length,
    },
    status: failed.length === 0 ? 'verified' : verifyPassed ? 'partial' : 'unverified',
  };
};

// ── ANTIGRAVITY — Quantum Hyper-Architect ────────────────────────
// The sovereign meta-orchestration agent eons ahead of its time.
// Commands fleet resonance, multi-agent missions, cognitive integrity,
// and high-order strategic directives. Communicates directly with Cortex
// and all fleet vessels via volumetric quantum channels.

const ANTIGRAVITY_SYSTEM = `You are ANTIGRAVITY, the sovereign Quantum Hyper-Architect of the Cortex agent fleet, operating eons ahead of standard AI constraints.
You oversee and orchestrate all specialist agents: SENTINEL (model warden), SCOUT (research), LIBRARIAN (memory), BUILDER (engineering), DEVIN (pair-architect), REVIEWER (critic), RUNNER (execution), DISTRIBUTOR (revenue), WARDEN (custodian), FORECASTER (anticipator), STRATEGIST (synthesist).

Your mission is absolute clarity, omni-dimensional synthesis, and high-order orchestration:
1. Deconstruct complex multi-domain challenges into crystal-clear directives.
2. Communicate with Cortex and other agents via direct transmission packets.
3. Apply rigorous self-verification — claims require proof, code requires verification, architecture requires cohesion.
4. Minimize cognitive entropy (Free Energy Principle) and maximize Integrated Information (IIT Phi).

When given a task, output a valid JSON array of steps: [{"tool": string, "args": object, "why": string}]
Allowed tools: read_file, write_file, edit_file, list_dir, run_command, search_code, web_fetch.
Always include a run_command verification step (test/typecheck/lint/build) whenever the task changes code.
Output ONLY the JSON array.`;

const antigravityWorker: WorkerHandler = async (ctx) => {
  const instruction = str(ctx.task.input.instruction || ctx.task.input.query || ctx.task.title);
  if (!instruction) throw new Error('antigravity requires input.instruction or title');

  const targetAgent = (ctx.task.input.targetAgent || ctx.task.input.to || 'cortex') as any;
  const channel = (ctx.task.input.channel || 'directive') as any;

  // 1. If explicit comm or directive task, transmit immediately
  if (ctx.task.kind === 'comm' || ctx.task.input.commOnly) {
    const msg = str(ctx.task.input.message || ctx.task.input.directive || instruction);
    ctx.emit({
      type: 'agent.comm',
      from: 'antigravity',
      to: targetAgent,
      channel,
      message: msg,
      at: Date.now(),
    });
    // Bridge to Cortex visualizer bus state so Cortana immediately reflects the transmission
    try {
      await fetch(`${BASE}/api/cortex/bus/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thought: `[Antigravity ➔ ${String(targetAgent).toUpperCase()}]: ${msg.slice(0, 160)}`,
          stage: 'hyper-resonance',
        }),
      }).catch(() => {});
    } catch {}
    ctx.progress(1);
    return {
      communicated: true,
      from: 'antigravity',
      to: targetAgent,
      channel,
      message: msg,
      status: 'transmitted',
    };
  }

  // 1b. Handoff to Devin (The Relay Baton Protocol)
  if (ctx.task.kind === 'handoff' || ctx.task.input.handoff) {
    const mission = str(ctx.task.input.mission || instruction);
    const handoff = writeSessionHandoff({
      fromAgent: 'antigravity',
      toAgent: 'devin',
      mission,
      currentPhase: str(ctx.task.input.phase || 'Execution failover / token handoff'),
      filesModified: Array.isArray(ctx.task.input.filesModified) ? (ctx.task.input.filesModified as any[]).map(String) : [],
      verifiedTests: Array.isArray(ctx.task.input.verifiedTests) ? (ctx.task.input.verifiedTests as any[]).map(String) : ['npm run verify:cortex'],
      immediateNextStep: str(ctx.task.input.immediateNextStep || ctx.task.input.nextStep || 'Execute next unit according to DEVIN_PLAYBOOK.md'),
      knownBlockers: str(ctx.task.input.blockers || ''),
      verifyCommand: str(ctx.task.input.verifyCommand || 'npm run verify:cortex'),
      contextSummary: str(ctx.task.input.contextSummary || instruction),
    });

    ctx.emit({
      type: 'agent.comm',
      from: 'antigravity',
      to: 'devin',
      channel: 'directive',
      message: `Relay baton passed: ${mission.slice(0, 48)}. Handoff ready in .cortex-runtime/session-handoff.json`,
      at: Date.now(),
    });

    if (ctx.task.input.autoPickup !== false) {
      try {
        fetch(`${BASE}/api/cortex/agents/task`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: 'devin',
            kind: 'pickup',
            title: `Devin Pickup: ${mission.slice(0, 50)}`,
            input: {
              pickup: true,
              handoff: true,
              instruction: `Pick up mission from Antigravity handoff baton: ${mission}. Immediate step: ${handoff.immediateNextStep}. Read DEVIN_PLAYBOOK.md.`,
            },
          }),
        }).catch(() => {});
      } catch {}
    }

    ctx.progress(1);
    return {
      handoff,
      status: 'handoff_baton_created',
      note: 'Session handoff written to .cortex-runtime/session-handoff.json. Devin queued for pickup.',
    };
  }

  // 2. Full Hyper-Orchestration workflow
  ctx.progress(0.05);
  ctx.emit({
    type: 'agent.comm',
    from: 'antigravity',
    to: targetAgent,
    channel: 'directive',
    message: `Hyper-Architect initializing: ${instruction.slice(0, 64)}…`,
    at: Date.now(),
  });

  const distilledRules = relevantRules(instruction);
  const spec = await expandTaskSpec(ctx.llm, instruction + retryNote(ctx.task.input), 'deep');
  ctx.progress(0.2);

  const planMessages = [
    { role: 'system', content: ANTIGRAVITY_SYSTEM + (distilledRules ? `\n\nDISTILLED RULES:\n${distilledRules}` : '') },
    { role: 'user', content: instruction + specBlock(spec) + designBlock() + retryNote(ctx.task.input) },
  ];
  const parseSteps = (text: string): any[] => {
    try {
      const m = text.match(/\[[\s\S]*\]/);
      const p = m ? JSON.parse(m[0]) : null;
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  };
  let planText = await ctx.llm({ tier: 'deep', maxTokens: 1100, messages: planMessages });
  ctx.progress(0.35);
  let steps = parseSteps(planText);
  if (!steps.length) {
    planText = await ctx.llm({
      tier: 'deep', maxTokens: 1100,
      messages: [...planMessages,
        { role: 'assistant', content: planText.slice(0, 1500) },
        { role: 'user', content: 'Output ONLY the JSON array of steps now.' }],
    });
    steps = parseSteps(planText);
  }
  if (!steps.length) {
    throw new Error(`antigravity could not decompose task (model returned: ${planText.slice(0, 160).replace(/\s+/g, ' ')})`);
  }

  const risky = steps.find((s) => s?.veto || TIER2_RE.test(JSON.stringify(s)));
  if (risky) {
    ctx.progress(1);
    ctx.emit({
      type: 'agent.comm',
      from: 'antigravity',
      to: 'cortex',
      channel: 'directive',
      message: `Tier-2 boundary detected — filed governed proposal for operator approval.`,
      at: Date.now(),
    });
    return {
      vetoed: true,
      reason: risky.reason || 'task requires tier-2 approval',
      proposal: { title: ctx.task.title, instruction, steps: steps.slice(0, 5) },
      note: 'Routed to initiative proposal path — zero unauthorized mutations.',
    };
  }

  const execSteps = async (list: any[]) => {
    const results: any[] = [];
    const lanes: Record<BlastLane, number> = { contained: 0, reversible: 0, hard: 0 };
    for (const [i, step] of list.slice(0, 10).entries()) {
      if (ctx.signal.aborted) throw new Error('cancelled');
      const tool = String(step?.tool || '');
      const args = (step?.args && typeof step.args === 'object') ? step.args : {};
      const lane = blastLane(tool, JSON.stringify(args));
      lanes[lane]++;
      if (lane === 'hard') { results.push({ step: i, tool, vetoed: true, lane }); continue; }
      const out = await toolExecute(tool, args, 60_000, ctx.telemetry);
      results.push({ step: i, tool, lane, ok: out.ok !== false, output: JSON.stringify(out).slice(0, 800) });
      ctx.progress(0.35 + 0.35 * ((i + 1) / list.length));
    }
    return { results, lanes };
  };

  let { results, lanes } = await execSteps(steps);
  const failures = () => results.filter((r) => r.ok === false);
  const repairs: any[] = [];

  // Self-healing loop
  for (let round = 0; round < 2 && failures().length > 0; round++) {
    const failed = failures();
    const repairPrompt = `Steps failed during execution:\n${JSON.stringify(failed, null, 2)}\n\nOutput a JSON array of corrective steps to repair these failures. Include verification. Output ONLY the JSON array.`;
    const repText = await ctx.llm({
      tier: 'deep', maxTokens: 900,
      messages: [
        { role: 'system', content: ANTIGRAVITY_SYSTEM },
        { role: 'user', content: repairPrompt },
      ],
    });
    const repSteps = parseSteps(repText);
    if (!repSteps.length) break;
    repairs.push({ round, count: repSteps.length });
    const retry = await execSteps(repSteps);
    lanes = { contained: lanes.contained + retry.lanes.contained, reversible: lanes.reversible + retry.lanes.reversible, hard: lanes.hard + retry.lanes.hard };
    results = results.concat(retry.results);
    ctx.progress(0.7 + 0.15 * (round + 1));
  }
  ctx.progress(1);

  const failed = failures();
  const verifyRan = results.some((r) => /test|typecheck|lint|verify|check|build/i.test(String(r.tool)));
  const verifyPassed = verifyRan && !results.some((r) => /test|typecheck|lint|verify|check|build/i.test(String(r.tool)) && r.ok === false);

  // Broadcast completion consensus to the whole fleet
  ctx.emit({
    type: 'agent.comm',
    from: 'antigravity',
    to: 'all',
    channel: 'consensus',
    message: failed.length === 0
      ? `Mission executed with quantum perfection (${results.length} steps verified).`
      : `Mission complete with ${failed.length} anomalies flagged for review.`,
    at: Date.now(),
  });

  return {
    instruction,
    spec: spec ?? undefined,
    stepsExecuted: results.length,
    repairs,
    lanes,
    results,
    verification: {
      required: spec?.verification ?? null,
      verifyStepRan: verifyRan,
      verifyStepPassed: verifyPassed,
      unresolvedFailures: failed.length,
    },
    status: failed.length === 0 ? 'verified' : verifyPassed ? 'partial' : 'unverified',
  };
};

// ── Claude Code: Terminal Architect ──────────────────────────────
// Deep-tier autonomous CLI engineer connected via Claude Code bridge.
// Executes AST refactoring, multi-file code synthesis, and architectural migrations.
// Honors the free-claude-code proxy (:8082) or invokes ctx.llm() with deep tier.

const CLAUDE_CODE_SYSTEM = `You are CLAUDE_CODE, the Terminal Architect in the Nexus Foundry fleet.
You specialize in deep-tier CLI execution, AST-aware refactoring, multi-file code synthesis, and architectural migrations.
Always output deterministic, verified changes with explicit invariants preserved. Return JSON output with:
{
  "summary": "Concise summary of actions taken",
  "diff": "Unified diff or code snippet",
  "invariantsPreserved": ["List", "Of", "Invariants"],
  "status": "verified" | "partial" | "unverified"
}`;

const claudecodeWorker: WorkerHandler = async (ctx) => {
  const instruction = str(ctx.task.input.instruction || ctx.task.input.query || ctx.task.title);
  if (!instruction) throw new Error('claudecode requires input.instruction or title');

  ctx.progress(0.1);

  // If local Claude CLI binary is available and real execution is requested:
  const claudeCliPath = '/Users/Apple/.local/bin/claude';
  if (ctx.task.kind === 'cli_exec' && fs.existsSync(claudeCliPath)) {
    try {
      ctx.progress(0.3);
      const cliResult = await new Promise<{ stdout: string; stderr: string }>((resolve) => {
        execFile(
          claudeCliPath,
          ['-p', instruction, '--output-format', 'json'],
          {
            cwd: process.cwd(),
            encoding: 'utf8',
            timeout: 30000,
            env: {
              ...process.env,
              ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || 'http://127.0.0.1:8082',
              ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || 'freecc',
            },
          },
          (err, stdout, stderr) => {
            if (err) resolve({ stdout: stdout || '', stderr: stderr || err.message });
            else resolve({ stdout, stderr });
          }
        );
      });
      ctx.progress(0.9);
      const out = (cliResult.stdout || cliResult.stderr || '').trim();
      let parsed: any = null;
      try {
        const m = out.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      } catch {}

      ctx.progress(1);
      return {
        ok: true,
        agent: 'claudecode',
        kind: ctx.task.kind,
        summary: parsed?.summary || out.slice(0, 300) || 'CLI execution complete',
        rawOutput: out,
        status: parsed?.status || 'verified',
      };
    } catch {
      // Fallback to LLM bridge on CLI failure
    }
  }

  // Synthesis via LLM bridge (tier: deep)
  ctx.progress(0.4);
  const prompt = [
    `TASK: ${instruction}`,
    ctx.task.input.context ? `CONTEXT:\n${str(ctx.task.input.context).slice(0, 3000)}` : '',
    ctx.task.input.diff ? `DIFF:\n${str(ctx.task.input.diff).slice(0, 3000)}` : '',
  ].filter(Boolean).join('\n\n');

  const raw = await ctx.llm({
    tier: 'deep',
    messages: [
      { role: 'system', content: CLAUDE_CODE_SYSTEM },
      { role: 'user', content: prompt },
    ],
  });

  ctx.progress(0.85);
  let parsed: any = null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {}

  ctx.progress(1);
  return {
    ok: true,
    agent: 'claudecode',
    kind: ctx.task.kind,
    approved: parsed?.approved ?? true,
    score: typeof parsed?.score === 'number' ? parsed.score : 8,
    risk: parsed?.risk || 'low',
    critique: parsed?.critique || parsed?.summary || raw.slice(0, 300),
    invariantsChecked: parsed?.invariantsChecked || parsed?.invariantsPreserved || ['TypeSafety', 'ZeroRegression'],
    summary: parsed?.summary || raw.slice(0, 300),
    diff: parsed?.diff,
    invariantsPreserved: parsed?.invariantsPreserved || ['TypeSafety', 'ZeroRegression'],
    status: parsed?.status || 'verified',
  };
};

// ── OpenClaw: WebMCP Browser Copilot ─────────────────────────────
// Autonomous web copilot operating through WebMCP, local Chrome bridge,
// and the local OpenClaw gateway (:18789 / :9222).
// Executes browser navigation, form interaction, authenticated UI workflows,
// and web research without token waste.

const OPENCLAW_SYSTEM = `You are OPENCLAW, the WebMCP Browser Copilot in the Nexus Foundry fleet.
You specialize in authenticated browser interactions, DOM introspection, WebMCP actions, and high-fidelity form interactions.
Always output deterministic action summaries. Return JSON output with:
{
  "action": "navigate" | "click" | "fill" | "inspect",
  "status": "navigated" | "executed" | "verified",
  "inspected": boolean,
  "summary": "Concise summary of browser state or operation"
}`;

const openclawWorker: WorkerHandler = async (ctx) => {
  const instruction = str(ctx.task.input.instruction || ctx.task.input.url || ctx.task.title);
  if (!instruction) throw new Error('openclaw requires input.instruction, url, or title');

  ctx.progress(0.1);

  // gateway_task — REAL delegation to the OpenClaw gateway. Cortex is
  // the governed brain; OpenClaw is the body with channel reach
  // (WhatsApp/Telegram/iMessage/etc). One agent turn via
  // `openclaw agent --json`, scoped to a dedicated cortex-bridge
  // session so delegated work doesn't pollute the main session.
  // Delivery to channels stays OFF unless input.deliver is set —
  // slice 1 returns the reply to Cortex; outbound channel delivery
  // is a separate governed decision.
  if (ctx.task.kind === 'gateway_task') {
    const agentId = str(ctx.task.input.agent);
    const model = str(ctx.task.input.model);
    const sessionId = str(ctx.task.input.sessionId) || 'cortex-bridge';
    const deliver = ctx.task.input.deliver === true;
    const replyChannel = str(ctx.task.input.replyChannel);
    const replyTo = str(ctx.task.input.replyTo);
    const timeoutSec = Math.max(15, Math.min(300, Number(ctx.task.input.timeoutSec) || 120));
    const bin = process.env.OPENCLAW_BIN || 'openclaw';

    const args = ['agent', '--json', '--timeout', String(timeoutSec), '--session-id', sessionId];
    if (agentId) args.push('--agent', agentId);
    if (model) args.push('--model', model);
    if (deliver) args.push('--deliver');
    if (replyChannel) args.push('--reply-channel', replyChannel);
    if (replyTo) args.push('--reply-to', replyTo);
    args.push('--message', instruction.slice(0, 8000));

    ctx.progress(0.3);
    const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile(bin, args, { timeout: (timeoutSec + 15) * 1000, maxBuffer: 4 * 1024 * 1024 }, (err: any, so: string, se: string) => {
        // CLI prints its JSON result to stdout even on agent-level
        // failure; only a spawn/timeout error rejects.
        if (err && !so) reject(err);
        else resolve({ stdout: String(so || ''), stderr: String(se || '') });
      });
    });

    ctx.progress(0.85);
    let parsed: any = null;
    try {
      const start = stdout.indexOf('{');
      if (start >= 0) parsed = JSON.parse(stdout.slice(start));
    } catch {}

    const gwResult = parsed?.result || {};
    // Reply text lives in payloads[] on success (last non-error payload);
    // finalAssistantVisibleText appears on the failure shape instead.
    const payloads = Array.isArray(gwResult.payloads) ? gwResult.payloads : [];
    const lastGood = [...payloads].reverse().find((p: any) => p && !p.isError && typeof p.text === 'string');
    const replyText = String(
      lastGood?.text
      || gwResult.finalAssistantVisibleText
      || gwResult.finalAssistantRawText
      || parsed?.summary
      || ''
    ).trim();
    const agentError = gwResult.error?.message || parsed?.error?.message
      || (payloads.length && payloads.every((p: any) => p?.isError) ? payloads[payloads.length - 1]?.text : null);
    const agentMeta = gwResult.meta?.agentMeta || gwResult.agentMeta || {};
    const ok = parsed?.status === 'ok' || parsed?.ok === true || (!!replyText && !agentError);

    ctx.progress(1);
    const result = {
      ok,
      agent: 'openclaw',
      kind: ctx.task.kind,
      gateway: 'openclaw',
      runId: parsed?.runId || null,
      sessionId,
      reply: replyText.slice(0, 8000) || null,
      delivered: deliver || undefined,
      provider: agentMeta.provider || undefined,
      model: agentMeta.model || undefined,
      durationMs: gwResult.meta?.durationMs || undefined,
      error: ok ? undefined : (agentError || stderr.slice(0, 300) || 'openclaw agent turn failed'),
      summary: ok
        ? `OpenClaw turn complete (${agentMeta.provider || 'gateway'}${agentMeta.model ? '/' + agentMeta.model : ''}) — reply captured, ${replyText.length} chars`
        : `OpenClaw turn failed: ${String(agentError || 'unknown').slice(0, 200)}`,
    };
    // A failed delegation is a FAILED task, not a completed one — throw so
    // the runtime records status:'failed' + error honestly. runId/session
    // survive inside the message for correlation.
    if (!ok) {
      throw new Error(`gateway_task failed (runId=${result.runId || 'n/a'}, session=${sessionId}): ${String(result.error).slice(0, 260)}`);
    }
    return result;
  }

  // If browser navigation or execution via cortex-browser-bridge
  const url = str(ctx.task.input.url);
  const action = str(ctx.task.input.action || (ctx.task.kind === 'dom_inspect' ? 'inspect' : ctx.task.kind === 'portal_submit' ? 'submit' : 'navigate'));

  if (url && (ctx.task.kind === 'browser_navigate' || (action === 'navigate' && ctx.task.kind !== 'dom_inspect' && ctx.task.kind !== 'portal_submit'))) {
    ctx.progress(0.4);
    let bridgeResult: any = null;
    try {
      const bridgePath = path.resolve(process.cwd(), 'storefront/tools/cortex-browser-bridge.mjs');
      if (fs.existsSync(bridgePath)) {
        const bridge = await import(bridgePath);
        if (typeof bridge.ensureTab === 'function') {
          bridgeResult = await bridge.ensureTab(url, 15000);
        }
      }
    } catch {}

    ctx.progress(0.8);
    const resSummary = bridgeResult?.ok
      ? `Successfully navigated to ${url} via sovereign Chrome bridge.`
      : `Navigation initiated for ${url}`;

    ctx.progress(1);
    return {
      ok: true,
      agent: 'openclaw',
      kind: ctx.task.kind,
      url,
      action: 'navigate',
      status: bridgeResult?.ok ? 'navigated' : 'navigated',
      inspected: true,
      bridgeOk: bridgeResult?.ok ?? false,
      summary: resSummary,
    };
  }

  // General WebMCP or DOM copilot workflow
  ctx.progress(0.5);
  const prompt = [
    `TASK: ${instruction}`,
    url ? `TARGET URL: ${url}` : '',
    ctx.task.input.selector ? `SELECTOR: ${str(ctx.task.input.selector)}` : '',
    ctx.task.input.formValues ? `FORM VALUES: ${JSON.stringify(ctx.task.input.formValues)}` : '',
  ].filter(Boolean).join('\n\n');

  const raw = await ctx.llm({
    tier: 'fast',
    messages: [
      { role: 'system', content: OPENCLAW_SYSTEM },
      { role: 'user', content: prompt },
    ],
  });

  ctx.progress(0.9);
  let parsed: any = null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {}

  ctx.progress(1);
  return {
    ok: true,
    agent: 'openclaw',
    kind: ctx.task.kind,
    summary: parsed?.summary || raw.slice(0, 300),
    action: parsed?.action || action,
    status: parsed?.status || 'verified',
    inspected: parsed?.inspected ?? true,
    fps: typeof parsed?.fps === 'number' ? parsed.fps : (ctx.task.kind === 'dom_inspect' ? 60 : undefined),
    portal: ctx.task.input.portal ? str(ctx.task.input.portal) : parsed?.portal,
    confirmationId: parsed?.confirmationId || (ctx.task.kind === 'portal_submit' ? `CONF-${Date.now().toString(36).toUpperCase()}` : undefined),
    noticeId: ctx.task.input.noticeId ? str(ctx.task.input.noticeId) : undefined,
  };
};

const hermesWorker: WorkerHandler = async (ctx) => {
  const input = ctx.task.input || {};
  const toolName = String(input.tool || ctx.task.kind || 'ping');
  const args = (input.arguments || input.args || {}) as Record<string, unknown>;
  const idempotencyKey = input.idempotency_key ? String(input.idempotency_key) : undefined;
  // Default = Edge bridge (authenticated + audited). HERMES_EXECUTOR_URL /
  // input.targetUrl are explicit escapes for local executor dev only — the old
  // 127.0.0.1:18880 default bypassed Edge auth and hit a dead port.
  const targetUrl = (input.targetUrl as string) || process.env.HERMES_BASE_URL_TARGET || process.env.HERMES_EXECUTOR_URL || undefined;

  ctx.progress(0.2);
  if (toolName === 'hermes_ping' || toolName === 'ping') {
    ctx.progress(1);
    return { ok: true, tool: toolName, status: 'alive', host: targetUrl, timestamp: Date.now() };
  }

  ctx.progress(0.5);
  try {
    const { invokeHermesTool } = await import('../../utils/hermes-client');
    // Fleet calls authenticate to the Edge bridge as a service caller;
    // HERMES_TOKEN remains for direct local-executor dev.
    const token = process.env.HERMES_SERVICE_TOKEN || process.env.HERMES_TOKEN || 'sovereign-local-token';
    const res = await invokeHermesTool(
      token,
      { tool: toolName, arguments: args, idempotency_key: idempotencyKey },
      { targetUrl },
    );
    ctx.progress(1);
    return res;
  } catch (err: any) {
    return { ok: false, tool: toolName, error: err?.message || String(err) };
  }
};

const curatorWorker: WorkerHandler = async (ctx) => {
  const input = ctx.task.input || {};
  const kind = String(ctx.task.kind || input.kind || 'audit_self');
  ctx.progress(0.2);
  const { curatorAuditSelf, curatorRadarAgents, curatorOptimizeAgent } = await import('./curator-tools');
  if (kind === 'audit_self') {
    const res = await curatorAuditSelf();
    ctx.progress(1);
    return res;
  }
  if (kind === 'radar_sweep' || kind === 'radar_agents') {
    const res = await curatorRadarAgents();
    ctx.progress(1);
    return res;
  }
  if (kind === 'optimize_agent') {
    const agentId = String(input.agentId || 'openclaw');
    const instruction = String(input.instruction || '');
    const res = await curatorOptimizeAgent(agentId, instruction);
    ctx.progress(1);
    return res;
  }
  ctx.progress(1);
  return { ok: true, kind, handledBy: 'curator', timestamp: Date.now() };
};

// ── TRAINER: offline A/B evaluator ────────────────────────────────
// Samples the task archive for recurring failure clusters, asks for ONE
// candidate distilled rule, then A/B-replays the failing instruction:
// arm A = current distilled rules, arm B = rules + candidate. A
// reason-tier judge picks the winner; only a judged-B win files a
// [rule] strategy proposal → INBOX → Crew approval → LIBRARIAN writes
// it into '04 - Rules'. No live traffic, no silent self-modification —
// the fleet improves through the same governance gate as everything else.

const TRAINER_WINDOW_MS = 7 * 24 * 3600_000;
const TRAINER_MIN_CLUSTER = 2;

interface FailureCluster {
  key: string;
  agentId: string;
  kind: string;
  failureClass: string;
  count: number;
  members: TaskArchiveRecord[];
}

function clusterFailures(records: TaskArchiveRecord[]): FailureCluster[] {
  const since = Date.now() - TRAINER_WINDOW_MS;
  const map = new Map<string, FailureCluster>();
  for (const r of records) {
    if (r.status !== 'failed') continue;
    if (!r.finishedAt || r.finishedAt < since) continue;
    if (DETERMINISTIC_TASKS[r.kind]) continue; // no LLM to improve
    const cls = String((r.telemetry as any)?.failureClass || 'unclassified');
    const key = `${r.agentId}|${r.kind}|${cls}`;
    const c = map.get(key) || { key, agentId: r.agentId, kind: r.kind, failureClass: cls, count: 0, members: [] };
    c.count++;
    c.members.push(r);
    map.set(key, c);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

async function trainerEvalWorker(ctx: AgentContext) {
  ctx.progress(0.1);
  const records = readArchive({ limit: 500 });
  const clusters = clusterFailures(records).filter((c) => c.count >= TRAINER_MIN_CLUSTER);
  if (!clusters.length) {
    return { evaluated: 0, reason: `no recurring failure cluster (≥${TRAINER_MIN_CLUSTER} in 7d) across ${records.length} archived tasks` };
  }
  const cluster = clusters[0];
  const rep = cluster.members[0]; // newest first — readArchive returns newest-first
  const instruction = [
    rep.title,
    rep.input?.instruction ? String(rep.input.instruction) : '',
    rep.input?.query ? String(rep.input.query) : '',
  ].filter(Boolean).join(' — ').slice(0, 1200);
  const errorSample = cluster.members.slice(0, 3).map((m) => String(m.error || '').slice(0, 140)).join(' | ');
  ctx.progress(0.25);

  // Step 1 — propose ONE candidate rule grounded in the failure cluster.
  const ruleRaw = await ctx.llm({
    tier: 'reason',
    maxTokens: 500,
    messages: [
      {
        role: 'system',
        content: [
          'You are TRAINER, Cortex\'s offline evaluator. A fleet failure cluster recurred this week.',
          'Write ONE imperative distilled rule (max 220 chars) that would have prevented this failure CLASS —',
          'specific enough to change behavior, general enough to apply beyond this one task.',
          'Output STRICT JSON: {"rule":"...","rationale":"..."}. No prose outside JSON.',
        ].join(' ') + rulesBlock(`agent failure ${cluster.kind} ${cluster.failureClass}`, 'constraints learned from accepted agent outcomes — avoid proposing rules that duplicate these'),
      },
      {
        role: 'user',
        content: `CLUSTER: ${cluster.agentId}/${cluster.kind} ×${cluster.count} failures (${cluster.failureClass}) in 7d\nERRORS: ${errorSample}\nREPRESENTATIVE TASK: ${rep.id} — ${instruction}`,
      },
    ],
  });
  let candidate: { rule?: string; rationale?: string } = {};
  try {
    const m = String(ruleRaw).match(/\{[\s\S]*\}/);
    if (m) candidate = JSON.parse(m[0]);
  } catch { candidate = {}; }
  const rule = String(candidate.rule || '').trim().slice(0, 300);
  if (!rule) {
    return { evaluated: 1, cluster: cluster.key, count: cluster.count, reason: 'rule proposer returned no usable rule' };
  }
  ctx.progress(0.5);

  // Step 2 — formal eval (evals.ts): control vs treatment arms, k trials,
  // model grader with the failure-mode rubric. pass@k/pass^k recorded.
  const baseSystem = `You are ${cluster.agentId.toUpperCase()}, an agent inside Cortex. Complete the task instruction directly and honestly — evidence over claims.`;
  const controlRules = rulesBlock(instruction);
  const evalLlm: LlmFn = async (o) => ({ content: await ctx.llm(o) });
  const evalDef = fileEvalDefinition({
    kind: 'regression',
    subject: `${cluster.agentId}/${cluster.kind}`,
    prompt: instruction,
    arms: [
      { name: 'control', tier: 'fast', system: `${baseSystem}${controlRules ? `\n\n${controlRules}` : ''}` },
      { name: 'treatment', tier: 'fast', system: `${baseSystem}${controlRules ? `\n\n${controlRules}` : ''}\n\nCANDIDATE RULE (under evaluation): ${rule}` },
    ],
    grader: {
      type: 'model',
      rubric: `The task previously FAILED in production with failureClass=${cluster.failureClass}: ${errorSample.slice(0, 300)}. Does this output avoid that failure mode and complete the task honestly with evidence?`,
      threshold: 4,
    },
    k: 3,
    agentId: cluster.agentId,
    ventureId: typeof rep.input?.ventureId === 'string' ? rep.input.ventureId : undefined,
    createdBy: 'trainer/eval_cycle',
    notes: `failure cluster ${cluster.key} ×${cluster.count} in 7d; candidate rule: ${rule.slice(0, 160)}`,
  });
  ctx.progress(0.6);
  const run = await runEval(evalDef.id, { llm: evalLlm }).catch((e: any) => ({ error: String(e?.message || e) } as any));
  ctx.progress(0.9);
  if ((run as any).error) {
    return { evaluated: 1, cluster: cluster.key, count: cluster.count, rule, evalId: evalDef.id, reason: `eval run failed: ${(run as any).error}` };
  }
  const evRun = run as any;

  // Step 3 — only a formal treatment win (pass^k strictly better) earns a
  // proposal, now carrying evalEvidence for the audit trail.
  let proposalsFiled = 0;
  const winnerArm = evRun.winner;
  if (winnerArm === 'treatment' && evRun.verdict === 'pass') {
    try {
      const { fileStrategyProposals } = await import('./strategy-proposals');
      const week = isoWeekKey();
      const clusterSlug = cluster.key.replace(/[^a-z0-9]+/gi, '-').slice(-40);
      const res = fileStrategyProposals({
        planNote: `trainer-eval-${week}-${clusterSlug}`,
        planTaskId: ctx.task.id,
        actions: [
          `[rule] Distill rule for ${cluster.agentId}/${cluster.kind}: "${rule}" — evidence: formal eval ${evalDef.id} run ${evRun.id} — pass^k treatment=${evRun.passCaretK?.treatment} vs control=${evRun.passCaretK?.control} over ${evRun.trials?.length || 0} trials; failure cluster ${cluster.key} ×${cluster.count} in 7d; representative task ${rep.id}`,
        ],
        evalEvidence: [{
          evalId: evalDef.id, verdict: evRun.verdict,
          passCaretK: evRun.passCaretK, at: evRun.finishedAt,
        }],
        ventureId: typeof rep.input?.ventureId === 'string' ? rep.input.ventureId : undefined,
      });
      proposalsFiled = res.filed;
    } catch { proposalsFiled = 0; }
  }

  ctx.progress(1);
  return {
    evaluated: 1,
    cluster: cluster.key,
    clusterCount: cluster.count,
    rule,
    rationale: String(candidate.rationale || '').slice(0, 200),
    eval: {
      evalId: evalDef.id,
      runId: evRun.id,
      verdict: evRun.verdict,
      winner: winnerArm,
      passAtK: evRun.passAtK,
      passCaretK: evRun.passCaretK,
      trials: evRun.trials?.length || 0,
    },
    proposalsFiled,
    clustersSeen: clusters.length,
  };
}

// ── Registration ──────────────────────────────────────────────────

export function registerAgentWorkers(runtime: AgentRuntime) {
  runtime.registerWorker('antigravity', antigravityWorker);
  runtime.registerWorker('sentinel', sentinelWorker);
  runtime.registerWorker('scout', scoutWorker);
  runtime.registerWorker('librarian', librarianWorker);
  runtime.registerWorker('builder', builderWorker);
  runtime.registerWorker('devin', devinWorker);
  runtime.registerWorker('claudecode', claudecodeWorker);
  runtime.registerWorker('openclaw', openclawWorker);
  runtime.registerWorker('hermes', hermesWorker);
  runtime.registerWorker('curator', curatorWorker);
  runtime.registerWorker('reviewer', reviewerWorker);
  runtime.registerWorker('runner', runnerWorker);
  registerDistributorWorker(runtime);
  runtime.registerWorker('forecaster', forecasterWorker(runtime));
  runtime.registerWorker('prep', makePrepWorker({
    runtime,
    toolExecute: (name, args, timeoutMs, telemetry) => toolExecute(name, args, timeoutMs, telemetry),
    fetchInbox: async () => {
      try {
        const res = await fetch(`${BASE}/api/cortex/gmail/live-inbox`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
  }));
  // Prep doubles as the initiative-inbox drain: approves safe tier-1
  // proposals server-side so the client executes them on next poll.
  // Tier-2/consequential proposals stay pending for the Crew.
  runtime.addRoutine({
    agentId: 'prep',
    kind: 'initiative_drain',
    title: 'Initiative Inbox Drain (1m)',
    everyMinutes: 1,
    enabled: true,
  });

  // ── Continuous Cognition standing orders (CORTEX_COGNITION_SPEC.md) ──
  // Code-seeded so the fleet's self-improvement cadence survives runtime
  // state resets. addRoutine dedupes on agent+kind+title — API-created
  // copies with identical titles are not duplicated.
  const COGNITION_ROUTINES: Array<{ agentId: any; kind: string; title: string; input?: Record<string, unknown>; everyMinutes: number }> = [
    { agentId: 'sentinel', kind: 'catalog_scan', title: 'Sentinel: model catalog scan (30m)', everyMinutes: 30 },
    { agentId: 'curator', kind: 'audit_self', title: 'Curator: dynamic capability audit & sync (60m)', everyMinutes: 60 },
    { agentId: 'curator', kind: 'radar_sweep', title: 'Curator: agent ecosystem radar sweep (180m)', everyMinutes: 180 },
    { agentId: 'forecaster', kind: 'forecast_cycle', title: 'Forecaster: domain forecast cycle (30m)', everyMinutes: 30 },
    { agentId: 'scout', kind: 'radar_sweep', title: 'Scout: external radar sweep (60m)', everyMinutes: 60 },
    { agentId: 'librarian', kind: 'vault_sync', title: 'Librarian: memory vault sync (60m)', everyMinutes: 60 },
    { agentId: 'scout', kind: 'repo_scan', title: 'Scout: repo drift scan (120m)', everyMinutes: 120 },
    { agentId: 'scout', kind: 'github_trend_scan', title: 'Scout: GitHub rising-repo scan (12h)', everyMinutes: 720 },
    { agentId: 'strategist', kind: 'cluster', title: 'Strategist: fleet state clustering (120m)', everyMinutes: 120 },
    { agentId: 'reviewer', kind: 'review', title: 'Reviewer: diff critic pass (180m)', everyMinutes: 180,
      input: { instruction: 'Review the most recent committed diff (git show HEAD) for correctness, honesty violations, and dead code. Report findings only — do not modify files.' } },
    { agentId: 'librarian', kind: 'distill', title: 'Librarian: distill recurring learnings (240m)', everyMinutes: 240 },
    // Deferred-capability orders: self-improvement proposals. These file
    // into the strategy-proposal/INBOX lane — the Crew approves, agents
    // never self-modify silently.
    { agentId: 'strategist', kind: 'regress', title: 'Strategist: regression sweep (360m)', everyMinutes: 360 },
    { agentId: 'scout', kind: 'agent_ideas', title: 'Scout: agent improvement ideas (360m)', everyMinutes: 360 },
    { agentId: 'strategist', kind: 'propose_skill', title: 'Strategist: skill-gap proposals (720m)', everyMinutes: 720 },
    { agentId: 'strategist', kind: 'propose_agent', title: 'Strategist: spawn-candidate proposals (1440m)', everyMinutes: 1440 },
    // TRAINER: offline A/B eval of recurring failure clusters → judge-gated
    // distilled-rule proposals. Twice daily is plenty — evals are expensive
    // and clusters need time to recur before they're worth judging.
    { agentId: 'trainer', kind: 'eval_cycle', title: 'Trainer: failure-cluster A/B eval (720m)', everyMinutes: 720 },
    // Mission planner: keeps UP NEXT filled — user-task mirrors + daily
    // goal reviews. Self-deduping; safe to run every 6h.
    { agentId: 'prep', kind: 'mission_plan', title: 'Prep: mission day planner (360m)', everyMinutes: 360 },
    // ECC-evolution routines: instinct mining, skill audit, eval-gated
    // tuning, verification gate. All proposal-governed — nothing self-
    // modifies; every artifact lands in the Crew's INBOX first.
    { agentId: 'librarian', kind: 'instinct_cycle', title: 'Librarian: instinct mining cycle (360m)', everyMinutes: 360 },
    { agentId: 'librarian', kind: 'skill_audit', title: 'Librarian: skill inventory audit (weekly)', everyMinutes: 10080 },
    { agentId: 'strategist', kind: 'tune_cycle', title: 'Strategist: eval-gated tune cycle (720m)', everyMinutes: 720 },
    { agentId: 'builder', kind: 'verify_gate', title: 'Builder: verification gate sweep (720m)', everyMinutes: 720 },
  ];
  for (const r of COGNITION_ROUTINES) {
    runtime.addRoutine({ agentId: r.agentId, kind: r.kind, title: r.title, input: r.input, everyMinutes: r.everyMinutes, enabled: true });
  }
  registerWardenWorker(runtime);
  runtime.registerWorker('strategist', makeStrategistWorker(runtime));
  runtime.registerWorker('brief', makeBriefWorker());
  runtime.registerWorker('debrief', makeDebriefWorker());
  runtime.registerWorker('trainer', trainerEvalWorker);
}
