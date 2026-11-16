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
import { makeStrategistWorker } from './strategist';
import { getCortexProactiveInitiative } from '../cortex-proactive-initiative';
import { cortexObsidianMemory } from '../cortex-obsidian-memory';
import { relevantRules, rulesBlock, RULES_DIR, vaultFolder, listMd } from './rules';
import { LEARNINGS_DIR } from './outcomes';

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
async function webSearch(query: string, maxResults = 6): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const q = encodeURIComponent(query);
  const attempts: Array<{ name: string; url: string; parse: (h: string, n: number) => ReturnType<typeof parseDdgResults> }> = [
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
      anyBackendOk = true;
      const results = a.parse(await res.text(), maxResults);
      if (results.length) return results;
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

async function githubRepoSearch(query: string, sinceDays: number): Promise<{ items: any[]; status: number }> {
  const since = new Date(Date.now() - sinceDays * 24 * 3600_000).toISOString().slice(0, 10);
  const q = `${query} created:>${since}`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=8`;
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

  const shortlist = repos.sort((a, b) => b.stars - a.stars).slice(0, 15);
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

  const brief = [
    `# Repo Scan — ${new Date().toISOString().slice(0, 10)}`,
    `Scanned ${repos.length} candidates across ${queries.length} queries (last ${sinceDays}d).`,
    '',
    ...picks.map((p) => `- **${p.action?.toUpperCase()}** ${p.name} (fit ${p.fit}) — ${p.why}`),
    picks.length ? '' : '_No repos cleared the fit bar this cycle._',
    '',
    '## Shortlist',
    ...shortlist.slice(0, 10).map((r) => `- ${r.name} ★${r.stars} — ${r.description} (${r.url})`),
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
  return { scanned: repos.length, picks: picks.length, note: '02 - Projects/repo-scan' };
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
        ].join(' ') + rulesBlock('agent ideas spawn proposals capability gap fleet health', 'constraints learned from accepted agent outcomes — follow unless they conflict with the ideation task'),
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

const scoutWorker: WorkerHandler = async (ctx) => {
  const kind = ctx.task.kind || 'research';
  if (kind === 'repo_scan') return repoScanWorker(ctx);
  if (kind === 'agent_ideas') return agentIdeasWorker(ctx);
  if (kind === 'social_scan') return socialScanWorker(ctx);
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
        content: 'You are REVIEWER, Cortex\'s read-only code critic. Produce a prioritized review: CRITICAL (bugs, security, data loss), WARNINGS (design, maintainability, error handling), SUGGESTIONS (style, nits). Be specific — cite file and line where possible. Never rewrite code; describe the fix in one line. If the material is clean, say so plainly. Output concise markdown.' + rulesBlock(instruction || files.join(' ') || 'code review', 'constraints learned from accepted agent outcomes — follow unless they conflict with the review task'),
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

// ── Forecaster: evidence-cited prediction cycle ────────────────────
// Probes emit ForecastSignals; the router tiers them (ambient → initiative
// proposal → rationed spoken). No LLM in the loop for detection — signals
// are deterministic reads of real state. LLM composition comes later for
// interrupt-class narration only.

const forecasterWorker = (runtime: AgentRuntime): WorkerHandler => async (ctx) => {
  const kind = ctx.task.kind || 'forecast_cycle';
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
  const instruction = str(ctx.task.input.instruction || ctx.task.input.query);
  if (!instruction) throw new Error('devin requires input.instruction');

  ctx.progress(0.05);
  const distilledRules = relevantRules(instruction);
  const spec = await expandTaskSpec(ctx.llm, instruction + retryNote(ctx.task.input), 'deep');
  ctx.progress(0.15);

  const planMessages = [
    { role: 'system', content: DEVIN_SYSTEM + (distilledRules ? `\n\nDISTILLED RULES (constraints learned from accepted outcomes — follow unless they conflict with governance):\n${distilledRules}` : '') },
    { role: 'user', content: instruction + specBlock(spec) + retryNote(ctx.task.input) },
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

// ── Registration ──────────────────────────────────────────────────

export function registerAgentWorkers(runtime: AgentRuntime) {
  runtime.registerWorker('sentinel', sentinelWorker);
  runtime.registerWorker('scout', scoutWorker);
  runtime.registerWorker('librarian', librarianWorker);
  runtime.registerWorker('builder', builderWorker);
  runtime.registerWorker('devin', devinWorker);
  runtime.registerWorker('reviewer', reviewerWorker);
  runtime.registerWorker('runner', runnerWorker);
  registerDistributorWorker(runtime);
  runtime.registerWorker('forecaster', forecasterWorker(runtime));
  runtime.registerWorker('prep', makePrepWorker({
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
  registerWardenWorker(runtime);
  runtime.registerWorker('strategist', makeStrategistWorker(runtime));
}
