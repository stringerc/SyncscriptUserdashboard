/**
 * STRATEGIST — fleet synthesist (CORTEX_SYNTHESIS_ROLE_SPEC.md).
 *
 * The missing decision layer: SCOUT senses, WARDEN patrols, LIBRARIAN
 * remembers — STRATEGIST consumes the durable task archive + outcome
 * notes + rules inventory and emits ranked, evidence-cited action plans.
 *
 * Authority boundary (spec §authority): STRATEGIST may write strategy
 * notes, regression cases, skill proposals, and spawn proposals — it may
 * NEVER modify rules, prompts, code, or deploy anything. Every artifact
 * it produces is a proposal awaiting human review.
 *
 * Kinds:
 *  - cluster   deterministic failure/outcome clustering over the archive
 *  - plan      LLM synthesis → ranked action plan written to the vault
 *  - manifest  rules-manifest inventory (closed-loop stages 4+6)
 *  - regress   promote a failure cluster into regression cases (stage 5)
 *  - propose_skill   file an executable-skill proposal (stage 8)
 *  - propose_agent  file a governed spawn proposal via runtime.proposeSpawn
 */

import fs from 'node:fs';
import path from 'node:path';
import type { AgentContext, AgentRuntime, WorkerHandler } from './runtime';
import type { SpawnSpec } from './types';
import { readArchive, type TaskArchiveRecord } from './archive';
import { RULES_DIR, vaultFolder, listMd } from './rules';
import { LEARNINGS_DIR } from './outcomes';
import { cortexObsidianMemory } from '../cortex-obsidian-memory';

const STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const STRATEGY_DIR = '05 - Strategy';
const REGRESSION_DIR = '06 - Regressions';
// Stage 8: executable-knowledge artifacts. proposed/ → human review →
// active/ → retired/. Nothing lands in active/ without a human move.
const SKILLS_PROPOSED = path.join(STATE_DIR, 'skills', 'proposed');

// ── Deterministic clustering (no LLM — evidence first) ────────────

export interface IssueCluster {
  key: string;
  agentId: string;
  failureClass: string | null;
  count: number;
  taskIds: string[];
  sampleTitles: string[];
  sampleErrors: string[];
  firstSeen: number;
  lastSeen: number;
  /** 'failure' clusters come from failed/vetoed tasks; 'pattern' clusters
   *  from repeated same agent+kind completions (possible drift/loops). */
  type: 'failure' | 'pattern';
}

const NON_TERMINAL_OK = new Set(['completed']);

export function clusterArchive(records: TaskArchiveRecord[]): IssueCluster[] {
  const groups = new Map<string, IssueCluster>();
  for (const r of records) {
    const failed = !NON_TERMINAL_OK.has(r.status);
    // Failure clusters key on agent+class; pattern clusters on agent+kind
    // for completed work that repeats suspiciously (>=4 same kind/day).
    const key = failed
      ? `fail|${r.agentId}|${r.telemetry?.failureClass ?? 'unclassified'}`
      : `pat|${r.agentId}|${r.kind}`;
    let c = groups.get(key);
    if (!c) {
      c = {
        key, agentId: r.agentId,
        failureClass: failed ? (String(r.telemetry?.failureClass ?? 'unclassified') as string) : null,
        count: 0, taskIds: [], sampleTitles: [], sampleErrors: [],
        firstSeen: r.finishedAt ?? r.createdAt, lastSeen: 0,
        type: failed ? 'failure' as const : 'pattern' as const,
      };
      groups.set(key, c);
    }
    c.count++;
    if (c.taskIds.length < 8) c.taskIds.push(r.id);
    if (c.sampleTitles.length < 3) c.sampleTitles.push(r.title.slice(0, 120));
    if (failed && c.sampleErrors.length < 3 && r.error) c.sampleErrors.push(String(r.error).slice(0, 200));
    const t = r.finishedAt ?? r.createdAt;
    c.firstSeen = Math.min(c.firstSeen, t);
    c.lastSeen = Math.max(c.lastSeen, t);
  }
  // Only surface actionable clusters: failures always; patterns need >=4.
  return [...groups.values()]
    .filter((c) => c.type === 'failure' || c.count >= 4)
    .sort((a, b) => (b.type === 'failure' ? 1 : 0) - (a.type === 'failure' ? 1 : 0) || b.count - a.count);
}

// ── Vault helpers ─────────────────────────────────────────────────

function writeVaultNote(dir: string, file: string, body: string, meta: Record<string, unknown>): string | null {
  try {
    cortexObsidianMemory.ensureVaultInitialized();
    const ok = cortexObsidianMemory.writeNote(dir, file, body, meta);
    return ok ? `${dir}/${file}.md` : null;
  } catch { return null; }
}

// ── Kinds ─────────────────────────────────────────────────────────

async function clusterWorker(ctx: AgentContext) {
  const days = typeof ctx.task.input.days === 'number' ? ctx.task.input.days : 7;
  const since = Date.now() - days * 86_400_000;
  const records = readArchive({ since, limit: 500 });
  const clusters = clusterArchive(records);
  return {
    window: { days, records: records.length },
    clusters: clusters.map((c) => ({
      key: c.key, type: c.type, agentId: c.agentId, failureClass: c.failureClass,
      count: c.count, taskIds: c.taskIds, sampleTitles: c.sampleTitles,
      sampleErrors: c.sampleErrors,
      firstSeen: new Date(c.firstSeen).toISOString(), lastSeen: new Date(c.lastSeen).toISOString(),
    })),
  };
}

async function planWorker(ctx: AgentContext) {
  const days = typeof ctx.task.input.days === 'number' ? ctx.task.input.days : 7;
  const since = Date.now() - days * 86_400_000;
  const records = readArchive({ since, limit: 500 });
  const clusters = clusterArchive(records);

  // Rules + learnings inventory — the "what does the fleet already know" side.
  const rulesDir = vaultFolder(RULES_DIR);
  const rules = listMd(rulesDir).map((f) => {
    try {
      const st = fs.statSync(path.join(rulesDir!, f));
      return { file: f, bytes: st.size, mtime: st.mtime.toISOString() };
    } catch { return { file: f, bytes: 0, mtime: '' }; }
  });
  const learningsDir = vaultFolder(LEARNINGS_DIR);
  const learningsCount = listMd(learningsDir).length;

  const focus = typeof ctx.task.input.focus === 'string' ? ctx.task.input.focus : '';
  // Optional local evidence file (e.g. a spec the plan must audit against).
  // Read server-side, capped — the archive/outcome notes remain primary.
  let specExcerpt = '';
  const specPath = typeof ctx.task.input.specPath === 'string' ? ctx.task.input.specPath : '';
  if (specPath) {
    try {
      const abs = path.isAbsolute(specPath) ? specPath : path.join(process.cwd(), specPath);
      specExcerpt = fs.readFileSync(abs, 'utf-8').slice(0, 12000);
    } catch { specExcerpt = ''; }
  }
  const clusterDigest = clusters.slice(0, 15).map((c) => ({
    key: c.key, type: c.type, agentId: c.agentId, failureClass: c.failureClass,
    count: c.count, taskIds: c.taskIds, sampleTitles: c.sampleTitles, sampleErrors: c.sampleErrors,
  }));

  const prompt = [
    `You are STRATEGIST, the synthesis layer of the Cortex agent fleet.`,
    `Consume the evidence below and emit a RANKED ACTION PLAN. Rules:`,
    `- Every action must cite evidence: task ids from the clusters, rule files, or outcome notes.`,
    `- Classify each action: rule | prompt | skill | eval | config | code | infra | process`,
    `- Prefer interventions that close loops (measurement, gating, versioning) over one-off fixes.`,
    `- Flag anything that looks like Goodhart risk (optimizing a metric instead of the outcome).`,
    `- You propose; humans approve. Never claim an action is already applied.`,
    `- If evidence is thin, say so explicitly rather than inventing certainty.`,
    focus ? `\nHUMAN FOCUS: ${focus}` : '',
    specExcerpt ? `\nSPEC CONTEXT (file: ${specPath}):\n${specExcerpt}` : '',
    `\nEVIDENCE WINDOW: last ${days} days, ${records.length} archived tasks, ${learningsCount} outcome notes, ${rules.length} distilled rules.`,
    `\nFAILURE/PATTERN CLUSTERS (ranked):\n${JSON.stringify(clusterDigest, null, 1)}`,
    `\nRULES INVENTORY:\n${JSON.stringify(rules.slice(0, 30), null, 1)}`,
    `\nEmit markdown: ## Ranked actions (1..N), each with [class] title — evidence: <refs> — why — risk. Then ## What we should NOT do yet. Then ## Evidence gaps.`,
  ].filter(Boolean).join('\n');

  const planText = await ctx.llm({
    tier: 'reason',
    maxTokens: 1800,
    messages: [
      { role: 'system', content: 'You are STRATEGIST — evidence-cited fleet synthesis. Concrete, ranked, honest about uncertainty.' },
      { role: 'user', content: prompt },
    ],
  });

  // Extract ranked actions deterministically for the structured result.
  const actions = planText.split('\n')
    .filter((l) => /^\s*(?:\d+[.)]|[-*])\s+.*\[(rule|prompt|skill|eval|config|code|infra|process)\]/i.test(l))
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*])\s+/, '').trim().slice(0, 300))
    .slice(0, 12);

  const stamp = new Date().toISOString().slice(0, 10);
  const file = `plan-${stamp}-${Date.now().toString(36)}`;
  const body =
    `# STRATEGIST action plan — ${stamp}\n\n` +
    `> Window: last ${days} days · ${records.length} archived tasks · ${clusters.length} clusters · ${learningsCount} outcomes · ${rules.length} rules\n` +
    (focus ? `> Focus: ${focus}\n` : '') +
    `> Task: ${ctx.task.title}\n\n` +
    `## Clusters consumed\n\n` +
    clusters.slice(0, 15).map((c) => `- \`${c.key}\` ×${c.count} (${c.type}${c.failureClass ? `, ${c.failureClass}` : ''}) — evidence: ${c.taskIds.join(', ')}`).join('\n') +
    `\n\n## Ranked actions\n\n${planText}\n\n` +
    `---\n*Filed by STRATEGIST task ${ctx.task.id}. Proposal only — nothing here is applied.*\n`;
  const notePath = writeVaultNote(STRATEGY_DIR, file, body, {
    created: new Date().toISOString(), agent: 'STRATEGIST', kind: 'action-plan',
  });

  return {
    plan: { note: notePath, actions, clusterCount: clusters.length, windowDays: days },
    text: planText.slice(0, 4000),
  };
}

async function manifestWorker(ctx: AgentContext) {
  const rulesDir = vaultFolder(RULES_DIR);
  const files = listMd(rulesDir);
  const rules = files.map((f) => {
    try {
      const p = path.join(rulesDir!, f);
      const content = fs.readFileSync(p, 'utf-8');
      const st = fs.statSync(p);
      const heading = content.match(/^#\s*(?:Rule|DISTILLED RULE):?\s*(.+)$/im)?.[1]?.trim().slice(0, 160)
        ?? content.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('---'))?.slice(0, 160) ?? '';
      return { file: f, rule: heading, bytes: st.size, ageDays: Math.round((Date.now() - st.mtimeMs) / 86_400_000), scoped: /agent:|kind:|scope:/i.test(content) };
    } catch { return { file: f, rule: '', bytes: 0, ageDays: -1, scoped: false }; }
  });
  // Duplicate detection: identical rule text under different filenames.
  const seen = new Map<string, string[]>();
  for (const r of rules) {
    const k = r.rule.toLowerCase().replace(/\W+/g, ' ').trim();
    if (!k) continue;
    seen.set(k, [...(seen.get(k) ?? []), r.file]);
  }
  const duplicates = [...seen.entries()].filter(([, fs_]) => fs_.length > 1).map(([rule, fs_]) => ({ rule: rule.slice(0, 120), files: fs_ }));

  const stamp = new Date().toISOString().slice(0, 10);
  const body =
    `# Rules manifest — ${stamp}\n\n` +
    `> Closed-loop stages 4+6: inventory every distilled rule so measurement,\n` +
    `> scoping, and retirement become possible. Generated by STRATEGIST.\n\n` +
    `## Inventory (${rules.length} rules)\n\n` +
    rules.map((r) => `- \`${r.file}\` — ${r.rule || '(no extractable text)'} — ${r.ageDays}d old — ${r.scoped ? 'scoped' : '**unscoped**'}`).join('\n') +
    `\n\n## Findings\n\n` +
    `- Unscoped rules: ${rules.filter((r) => !r.scoped).length} / ${rules.length} (stage 7 gap — rules apply fleet-wide via token overlap only)\n` +
    `- Duplicate rule texts: ${duplicates.length ? duplicates.map((d) => `\`${d.files.join('`, `')}\``).join(', ') : 'none'}\n` +
    `- Measurement gap: injection counts are not yet tracked — rule retirement requires outcome correlation (stage 4).\n\n` +
    `---\n*Manifest is a snapshot; regenerate via STRATEGIST 'manifest' kind.*\n`;
  const notePath = writeVaultNote(STRATEGY_DIR, `rules-manifest-${stamp}`, body, {
    created: new Date().toISOString(), agent: 'STRATEGIST', kind: 'rules-manifest',
  });
  return { manifest: { note: notePath, rules: rules.length, unscoped: rules.filter((r) => !r.scoped).length, duplicates }, rules };
}

async function regressWorker(ctx: AgentContext) {
  // input.clusterKey like 'fail|scout|provider' OR input.agentId — promote a
  // failure cluster into a regression checklist (stage 5 artifact).
  const clusterKey = typeof ctx.task.input.clusterKey === 'string' ? ctx.task.input.clusterKey : null;
  const agentId = typeof ctx.task.input.agentId === 'string' ? ctx.task.input.agentId : null;
  const records = readArchive({ limit: 500 });
  const clusters = clusterArchive(records);
  const target = clusterKey
    ? clusters.find((c) => c.key === clusterKey)
    : agentId
      ? clusters.filter((c) => c.agentId === agentId && c.type === 'failure').sort((a, b) => b.count - a.count)[0]
      : null;
  if (!target) {
    return { error: 'no matching failure cluster', hint: 'run cluster kind first or pass clusterKey/agentId', clusters: clusters.slice(0, 10).map((c) => c.key) };
  }
  const evidence = records.filter((r) => target.taskIds.includes(r.id));
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = target.key.replace(/[^a-z0-9]+/gi, '-').slice(0, 60);
  const body =
    `# Regression case — ${target.key}\n\n` +
    `> Promoted from failure cluster by STRATEGIST ${new Date().toISOString().slice(0, 10)}.\n` +
    `> Stage 5 artifact: when a fix lands, replay these cases before merge.\n\n` +
    `## Cluster\n\n` +
    `- Type: ${target.type} · Agent: ${target.agentId} · Class: ${target.failureClass ?? 'n/a'}\n` +
    `- Occurrences: ${target.count} · Window: ${new Date(target.firstSeen).toISOString().slice(0, 10)} → ${new Date(target.lastSeen).toISOString().slice(0, 10)}\n\n` +
    `## Evidence tasks\n\n` +
    evidence.map((r) =>
      `- \`${r.id}\` — ${r.title.slice(0, 140)} — ${r.status} — ${(r.error ?? '').slice(0, 160)}\n  - model: ${r.model ?? 'n/a'} · duration: ${r.durationMs ?? 'n/a'}ms · telemetry: ${JSON.stringify(r.telemetry ?? {})}`
    ).join('\n') +
    `\n\n## Acceptance check\n\n` +
    `- [ ] Re-run the failing inputs above after the fix; expect non-failure status\n` +
    `- [ ] Verify no new failure cluster forms for \`${target.agentId}\` in the next 7-day window\n` +
    `- [ ] Outcome notes for the replay cite this regression file\n\n` +
    `---\n*Regression cases are versioned by filename date; do not edit historical entries.*\n`;
  const notePath = writeVaultNote(REGRESSION_DIR, `regression-${slug}-${stamp}`, body, {
    created: new Date().toISOString(), agent: 'STRATEGIST', kind: 'regression-case', cluster: target.key,
  });
  return { regression: { note: notePath, cluster: target.key, evidenceTasks: evidence.length } };
}

async function proposeSkillWorker(ctx: AgentContext) {
  // Stage 8: a "skill" is a versioned, reusable procedure (markdown +
  // optional script reference) distilled from a proven pattern. STRATEGIST
  // can only file proposals — promotion to active/ is a human file move.
  const name = typeof ctx.task.input.name === 'string' ? ctx.task.input.name : '';
  const body = typeof ctx.task.input.body === 'string' ? ctx.task.input.body : '';
  const evidence = Array.isArray(ctx.task.input.evidence) ? ctx.task.input.evidence : [];
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(name)) return { error: 'input.name must be kebab-case, 2-61 chars' };
  if (body.length < 40 || body.length > 8000) return { error: 'input.body must be 40-8000 chars (the reusable procedure)' };
  try {
    fs.mkdirSync(SKILLS_PROPOSED, { recursive: true });
    const file = `${name}-${Date.now().toString(36)}.md`;
    const content =
      `---\nname: ${name}\nstatus: proposed\nproposedBy: STRATEGIST\nproposedAt: ${new Date().toISOString()}\n` +
      `evidence: ${JSON.stringify(evidence).slice(0, 500)}\n---\n\n${body}\n`;
    fs.writeFileSync(path.join(SKILLS_PROPOSED, file), content);
    return { skill: { file: path.join('skills', 'proposed', file), status: 'proposed', promote: 'move to skills/active/ after review' } };
  } catch (e: any) {
    return { error: `skill proposal write failed: ${e?.message || e}` };
  }
}

async function proposeAgentWorker(ctx: AgentContext, runtime: AgentRuntime) {
  const spec = ctx.task.input.spec as SpawnSpec | undefined;
  if (!spec || typeof spec.callSign !== 'string' || typeof spec.mission !== 'string') {
    return { error: 'input.spec must be a SpawnSpec {callSign, role, mission, tools, modelPin, dataScopes, dailyBudget, ttlHours, systemBrief, doneCriteria}' };
  }
  const evidence = Array.isArray(ctx.task.input.evidence)
    ? ctx.task.input.evidence as { kind: string; refs: string[]; summary: string }[]
    : [];
  const res = runtime.proposeSpawn(spec, evidence, 'strategist');
  return res.ok ? { proposal: res.proposal } : { error: res.reason };
}

// ── Registration ──────────────────────────────────────────────────

export function makeStrategistWorker(runtime: AgentRuntime): WorkerHandler {
  return async (ctx: AgentContext) => {
    switch (ctx.task.kind) {
      case 'cluster': return clusterWorker(ctx);
      case 'plan': return planWorker(ctx);
      case 'manifest': return manifestWorker(ctx);
      case 'regress': return regressWorker(ctx);
      case 'propose_skill': return proposeSkillWorker(ctx);
      case 'propose_agent': return proposeAgentWorker(ctx, runtime);
      default:
        return { error: `unknown strategist kind '${ctx.task.kind}'`, kinds: ['cluster', 'plan', 'manifest', 'regress', 'propose_skill', 'propose_agent'] };
    }
  };
}
