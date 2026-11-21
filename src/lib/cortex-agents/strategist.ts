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
import { fileStrategyProposals } from './strategy-proposals';
import { cortexObsidianMemory } from '../cortex-obsidian-memory';
import {
  conveneCounsel, getCounselSession, openRebuttal, closeRebuttal,
  recordSynthesis, pollBoard, COUNSEL_CONSOLES, memberLabel,
} from '../cortex-counsel';
import { getWorldState, formatWorldStateHeader } from '../cortex-world-state';
import { runCounselPersonas, runPersonaPosition, runPersonaPositionsBatch } from './counsel-personas';
import { runCounselPosition } from './counsel-position';

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
      specExcerpt = fs.readFileSync(abs, 'utf-8').slice(0, 4000);
    } catch { specExcerpt = ''; }
  }
  const clusterDigest = clusters.slice(0, 10).map((c) => ({
    key: c.key, type: c.type, agentId: c.agentId, failureClass: c.failureClass,
    count: c.count, taskIds: c.taskIds.slice(0, 4), sampleTitles: c.sampleTitles.slice(0, 2), sampleErrors: c.sampleErrors.slice(0, 2),
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

  const planModel = typeof ctx.task.input.model === 'string' && ctx.task.input.model.includes(':')
    ? ctx.task.input.model : undefined;
  const planText = await ctx.llm({
    tier: 'reason',
    model: planModel,
    maxTokens: 3000,
    messages: [
      { role: 'system', content: 'You are STRATEGIST — evidence-cited fleet synthesis. Concrete, ranked, honest about uncertainty.' },
      { role: 'user', content: prompt },
    ],
  });

  // Extract ranked actions deterministically for the structured result.
  const actions = planText.split('\n')
    .filter((l) => /^\s*(?:\d+[.)]|[-*])\s+.*\[(rule|prompt|skill|eval|config|code|infra|process)[^\]]*\]/i.test(l))
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

  // Close the loop: top actions become approvable proposals in the
  // Initiative Inbox — STRATEGIST proposes, humans approve, BUILDER runs.
  const filed = fileStrategyProposals({ planNote: notePath, planTaskId: ctx.task.id, actions });

  return {
    plan: { note: notePath, actions, clusterCount: clusters.length, windowDays: days, proposalsFiled: filed.filed, proposalsSkipped: filed.skipped },
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

// ── goal_plan: decompose mission goals into governed task proposals ──
// Mission-loop stage 1 (CORTEX_MISSION_LOOP_SPEC.md §2.3). Reads canonical
// goals from mission state, asks the LLM for a task breakdown, and files
// each step as a strategy proposal — decomposition is a proposal, never
// silent task injection. Deduped per goal via planNote.

async function goalPlanWorker(ctx: AgentContext) {
  const { loadMission } = await import('./mission');
  const { listStrategyProposals } = await import('./strategy-proposals');
  const state = loadMission();
  const active = state.goals.filter((g) => g.status === 'active');
  if (!active.length) return { decomposed: 0, reason: 'no active goals in mission state' };

  // Skip goals that already have a pending/approved decomposition proposal.
  const existing = new Set(
    listStrategyProposals()
      .filter((p: any) => ['pending', 'approved', 'executed'].includes(p.status))
      .map((p: any) => p.planNote),
  );
  const todo = active.filter((g) => !existing.has(`goal-plan-${g.id}`)).slice(0, 3);
  if (!todo.length) return { decomposed: 0, reason: 'all active goals already have proposals in flight', goalsSeen: active.length };

  const opsDigest = state.opsItems.slice(0, 20).map((o) => `- ${o.done ? '[x]' : '[ ]'} ${o.label}`).join('\n');
  let filedTotal = 0;
  const results: any[] = [];

  for (const goal of todo) {
    const prompt = [
      `You are STRATEGIST decomposing a goal into executable tasks for the Cortex agent fleet.`,
      `GOAL: ${goal.title}${goal.description ? ` — ${goal.description}` : ''}`,
      goal.targetDate ? `TARGET: ${goal.targetDate}` : '',
      goal.horizon ? `HORIZON: ${goal.horizon}` : '',
      `CURRENT OPS CHECKLIST:\n${opsDigest || '(empty)'}`,
      `Available agent lanes: scout (research/web), builder (code/build), distributor (publishing/distribution), prep (calendar/life ops), librarian (memory/rules), reviewer (review), runner (exec), forecaster (prediction), warden (patrol/ops).`,
      `Output JSON ONLY: {"tasks":[{"title":"imperative task title","agent":"agent-id","class":"process|code|web|eval|config","why":"one-line rationale tied to the goal"}]}`,
      `Rules: 3-6 tasks max, smallest verifiable steps first, every task must map to an agent lane, no task may require secrets or irreversible external actions (those get class 'hard' and will wait for human approval anyway — prefer decomposing around them).`,
    ].filter(Boolean).join('\n');

    const text = await ctx.llm({
      tier: 'reason', maxTokens: 1200,
      messages: [
        { role: 'system', content: 'You decompose goals into governed agent task proposals. JSON only.' },
        { role: 'user', content: prompt },
      ],
    });
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) { results.push({ goalId: goal.id, error: 'no JSON in LLM output' }); continue; }
    let parsed: any;
    try { parsed = JSON.parse(m[0]); } catch { results.push({ goalId: goal.id, error: 'unparseable JSON' }); continue; }
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 6) : [];
    if (!tasks.length) { results.push({ goalId: goal.id, error: 'no tasks returned' }); continue; }

    const actions = tasks.map((t: any, i: number) => {
      const agent = String(t.agent || 'builder');
      const cls = String(t.class || 'process');
      const title = String(t.title || '').slice(0, 120);
      const why = String(t.why || '').slice(0, 200);
      return `[${cls}] ${title} — assign to ${agent}; why: ${why}; goal: ${goal.id} (${goal.title.slice(0, 60)})`;
    });
    const filed = fileStrategyProposals({
      planNote: `goal-plan-${goal.id}`,
      planTaskId: ctx.task.id,
      actions,
    });
    filedTotal += filed.filed;
    results.push({ goalId: goal.id, title: goal.title.slice(0, 60), tasks: tasks.length, filed: filed.filed, skipped: filed.skipped });
  }

  return { decomposed: results.length, proposalsFiled: filedTotal, results };
}

// ── Counsel workers (Go/No-Go deliberation layer) ─────────────────

/** Convene a counsel session on a decision. Auto-builds the brief context
 *  from live world-state (+ linked proposal when sourceProposalId given).
 *  Positions are filed by members via the counsel API or drop-folder. */
async function counselConveneWorker(ctx: AgentContext) {
  const question = typeof ctx.task.input.question === 'string' ? ctx.task.input.question : '';
  if (!question) return { error: 'input.question required' };

  // Auto-brief: live telemetry + optional linked proposal evidence.
  let context = typeof ctx.task.input.context === 'string' ? ctx.task.input.context : '';
  try {
    const ws = await getWorldState();
    context = `[WORLD-STATE at convening]\n${formatWorldStateHeader(ws)}\n\n${context}`.slice(0, 4000);
  } catch {}

  const sourceProposalId = typeof ctx.task.input.proposalId === 'string' ? ctx.task.input.proposalId : undefined;
  if (sourceProposalId) {
    try {
      const { listStrategyProposals } = await import('./strategy-proposals');
      const p = listStrategyProposals().find((x: any) => x.id === sourceProposalId);
      if (p) {
        context += `\n\nLINKED PROPOSAL ${p.id}: ${p.title}\nclass: ${p.actionClass} → agent: ${p.agentId}\nevidence: ${(p.evidence || []).join('; ')}`;
      }
    } catch {}
  }

  const members = Array.isArray(ctx.task.input.members)
    ? ctx.task.input.members.filter((m: unknown) => COUNSEL_CONSOLES.some((c) => c.id === m))
    : undefined;

  const r = conveneCounsel({
    question,
    context,
    lane: ['contained', 'reversible', 'hard'].includes(ctx.task.input.lane as string)
      ? (ctx.task.input.lane as 'contained' | 'reversible' | 'hard')
      : 'reversible',
    members: members as string[] | undefined,
    sourceProposalId,
  });
  if (!r.session) return { error: r.error };

  return {
    session: r.session,
    next: 'members file positions via POST /api/cortex/counsel/action {action:"position"} or drop-folder .cortex-runtime/counsel/positions/<session>-<member>.json; then run counsel_synthesize',
    consoles: COUNSEL_CONSOLES.filter((c) => r.session!.members.includes(c.id)).map((c) => ({ id: c.id, callSign: c.callSign, adapter: c.adapter })),
  };
}

/** Synthesize a counsel session's poll into a verdict-ready synthesis.
 *  Auto-advances lifecycle: positions→rebuttal→synthesis as needed. */
async function counselSynthesizeWorker(ctx: AgentContext) {
  const sessionId = typeof ctx.task.input.sessionId === 'string' ? ctx.task.input.sessionId : '';
  let s = getCounselSession(sessionId);
  if (!s) return { error: `session ${sessionId} not found` };

  // Advance lifecycle deterministically before synthesizing.
  if (s.status === 'positions') {
    const r = openRebuttal(sessionId);
    if (!r.ok) return { error: `cannot open rebuttal: ${r.error}` };
    s = r.session!;
  }
  if (s.status === 'rebuttal') {
    const r = closeRebuttal(sessionId);
    if (!r.ok) return { error: `cannot close rebuttal: ${r.error}` };
    s = r.session!;
  }
  if (s.status !== 'synthesis') {
    return { error: `session is ${s.status} — nothing to synthesize` };
  }

  const board = pollBoard(s);
  const latest = new Map<string, any>();
  for (const p of s.positions) {
    const prev = latest.get(p.member);
    if (!prev || p.round >= prev.round) latest.set(p.member, p);
  }
  const positionDigest = s.members.map((m) => {
    const p = latest.get(m);
    const label = memberLabel(s, m);
    return p
      ? { member: label, id: m, round: p.round, stance: p.stance, confidence: p.confidence, evidence: p.keyEvidence, risks: p.risks, conditions: p.requiredConditions, reasoning: p.reasoning }
      : { member: label, id: m, stance: 'no-response' };
  });

  const prompt = [
    `You are STRATEGIST — Flight Director of a Go/No-Go counsel poll.`,
    `Decision under deliberation: "${s.question}"`,
    s.context ? `Brief context:\n${s.context.slice(0, 1500)}` : '',
    `Lane: ${s.lane}. Mode: ${s.mode || 'standard'}. Poll board: ${JSON.stringify(board.counts)}`,
    `Member positions (latest round each):\n${JSON.stringify(positionDigest, null, 1)}`,
    `Synthesize the poll. Output JSON ONLY: {"stanceTable":[{"member","stance","confidence"}],"agreements":[...],"conflicts":[...],"unresolvedObjections":[...],"recommendation":"go|no-go|conditional","text":"<3-5 sentence poll summary for the human>"}`,
    `Rules: recommendation 'go' only if no member filed 'no-go' without a rebutted revision; 'conditional' if conditions must be met; 'no-go' if objections stand. Cite member stances, not your own opinion.`,
  ].filter(Boolean).join('\n');

  // Reason lane first; on provider stall/timeout degrade to fast rather
  // than losing the synthesis entirely (observed: 3 consecutive 90s
  // bridge timeouts while reason candidates burned 55s each).
  let text = '';
  let llmErr = '';
  let servedTier = '';
  for (const tier of ['reason', 'fast'] as const) {
    try {
      text = await ctx.llm({
        tier,
        maxTokens: 1200,
        messages: [
          { role: 'system', content: 'You synthesize counsel polls into verdict-ready briefings. JSON only.' },
          { role: 'user', content: prompt },
        ],
      });
      llmErr = '';
      servedTier = tier;
      break;
    } catch (e: any) {
      llmErr = String(e?.message || e);
    }
  }
  if (llmErr) return { error: `synthesis LLM failed on all tiers: ${llmErr}` };

  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { error: 'LLM returned no JSON synthesis', raw: text.slice(0, 300) };
  let syn: any;
  try { syn = JSON.parse(m[0]); } catch { return { error: 'LLM synthesis JSON unparseable', raw: text.slice(0, 300) }; }

  const r = recordSynthesis(sessionId, {
    by: 'strategist',
    stanceTable: Array.isArray(syn.stanceTable) ? syn.stanceTable : [],
    agreements: Array.isArray(syn.agreements) ? syn.agreements.map(String) : [],
    conflicts: Array.isArray(syn.conflicts) ? syn.conflicts.map(String) : [],
    unresolvedObjections: Array.isArray(syn.unresolvedObjections) ? syn.unresolvedObjections.map(String) : [],
    recommendation: ['go', 'no-go', 'conditional'].includes(syn.recommendation) ? syn.recommendation : 'conditional',
    text: String(syn.text || '').slice(0, 2000),
    servedBy: servedTier,
    // Runtime stamps ctx.task.model with 'provider:model' of the actual
    // responder — record it so the poll card can name its own provenance.
    model: ctx.task.model || undefined,
  });
  if (!r.ok) return { error: r.error };

  return {
    session: r.session,
    poll: pollBoard(r.session!),
    next: 'session is in poll — human GO/NO-GO via /api/cortex/counsel/action {action:"decide"} or the Foundry tower board',
  };
}

// ── goal_review ─────────────────────────────────────────────────────
// Daily per-goal heartbeat dispatched by mission `goal_review` blocks.
// Computes real progress; only files a proposal when the goal is stalled
// (no linked completions in 48h) — healthy goals report and stay quiet.
async function goalReviewWorker(ctx: AgentContext) {
  const { loadMission, goalProgress } = await import('./mission');
  const { readArchive } = await import('./archive');
  const goalId = String(ctx.task.input?.goalId || '');
  const state = loadMission();
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return { reviewed: false, reason: `unknown goal '${goalId}'` };

  const progress = goalProgress(state, readArchive({ limit: 500 }));
  const gp = progress.find((p) => p.goalId === goal.id);
  const archive = readArchive({ limit: 500 });
  const cutoff = Date.now() - 48 * 3_600_000;
  const recentDone = archive.filter((r) =>
    goal.taskIds.includes(r.id) && r.status === 'completed' &&
    (r.finishedAt ?? r.createdAt) >= cutoff).length;
  const linkedBlocks = state.blocks.filter((b) => b.goalId === goal.id);
  const recentBlockDone = linkedBlocks.filter((b) => b.status === 'done' || b.status === 'dispatched').length;

  const healthy = (gp && gp.progress > 0) || recentDone > 0 || recentBlockDone > 0;
  if (healthy || goal.status !== 'active') {
    return {
      reviewed: true, goalId: goal.id, healthy: true,
      progress: gp ? `${gp.done}/${gp.linked}` : 'unlinked',
      recentCompletions: recentDone,
    };
  }

  // Stalled — ask the reason tier for the next concrete step, then file
  // it as a governed proposal (Crew approves; nothing self-executes).
  const prompt = [
    `Goal review: "${goal.title}"${goal.description ? ` — ${goal.description}` : ''} is stalled.`,
    `Progress: ${gp ? `${gp.done}/${gp.linked} linked items done` : 'no linked work'}; recent completions (48h): ${recentDone}.`,
    `Mission ops pending: ${state.opsItems.filter((o) => !o.done).slice(0, 10).map((o) => o.label).join('; ') || 'none'}.`,
    `Propose ONE concrete next step an agent lane can execute. JSON only: {"title":"imperative step","agent":"agent-id","why":"one line"}`,
  ].join('\n');
  const text = await ctx.llm({
    tier: 'reason', maxTokens: 400,
    messages: [
      { role: 'system', content: 'You are STRATEGIST reviewing a stalled goal. JSON only.' },
      { role: 'user', content: prompt },
    ],
  });
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { reviewed: true, goalId: goal.id, healthy: false, stalled: true, proposal: 'LLM returned no JSON — reported only' };
  let step: any;
  try { step = JSON.parse(m[0]); } catch { return { reviewed: true, goalId: goal.id, healthy: false, stalled: true, proposal: 'unparseable step JSON' }; }
  const title = String(step.title || '').slice(0, 120);
  if (!title) return { reviewed: true, goalId: goal.id, healthy: false, stalled: true, proposal: 'empty step' };
  const filed = fileStrategyProposals({
    planNote: `goal-review-${goal.id}-${new Date().toISOString().slice(0, 10)}`,
    planTaskId: ctx.task.id,
    actions: [`[process] ${title} — assign to ${String(step.agent || 'builder')}; why: ${String(step.why || 'stalled-goal next step').slice(0, 200)}; goal: ${goal.id}`],
  });
  return { reviewed: true, goalId: goal.id, healthy: false, stalled: true, proposal: title, filed: filed.filed };
}

// ── Registration ──────────────────────────────────────────────────

// ── tune_cycle: eval-gated self-modification (harness-optimizer) ──
// Snapshot-free by design: candidate changes live ONLY inside eval arms —
// nothing touches live prompts/rules. A candidate earns a governed
// '[prompt]' proposal only when it strictly beats baseline on pass^k.
// Self-mod classes are evalEvidence-gated at filing (strategy-proposals).

async function tuneCycleWorker(ctx: AgentContext) {
  ctx.progress(0.1);
  const records = readArchive({ limit: 200 });
  // Sample the most recent completed task that has a real instruction.
  const rep = records.find((r) =>
    r.status === 'completed' &&
    typeof (r.input as any)?.instruction === 'string' &&
    String((r.input as any).instruction).length > 20);
  if (!rep) return { tuned: 0, reason: 'no completed task with instruction found in archive' };
  const instruction = String((rep.input as any).instruction).slice(0, 1500);
  const agentId = rep.agentId;
  const ventureId = typeof (rep.input as any)?.ventureId === 'string' ? (rep.input as any).ventureId : undefined;
  ctx.progress(0.2);

  // Propose ONE minimal prompt patch grounded in recent evidence.
  const patchRaw = await ctx.llm({
    tier: 'reason', maxTokens: 400,
    messages: [
      { role: 'system', content: 'You are STRATEGIST proposing a minimal prompt-level operating rule for an agent. Output STRICT JSON {"patch":"one imperative rule <=220 chars","rationale":"<=140 chars"}. The patch must be behavioral (how to work), never a request to change identity, permissions, or governance. No prose outside JSON.' },
      { role: 'user', content: `AGENT: ${agentId}
RECENT TASK: ${rep.title}
INSTRUCTION: ${instruction.slice(0, 800)}
Propose one rule that would improve this class of task.` },
    ],
  }).catch(() => '');
  let patch = '';
  let rationale = '';
  try {
    const m = String(patchRaw).match(/\{[\s\S]*\}/);
    const j = m ? JSON.parse(m[0]) : null;
    patch = String(j?.patch || '').trim().slice(0, 300);
    rationale = String(j?.rationale || '').slice(0, 200);
  } catch { }
  if (patch.length < 10) return { tuned: 0, reason: 'patch proposer returned no usable rule' };
  ctx.progress(0.4);

  // Formal eval: baseline vs candidate arms, k trials, model grader.
  const { fileEvalDefinition, runEval } = await import('./evals');
  const baseSystem = `You are ${String(agentId).toUpperCase()}, an agent inside Cortex. Complete the task instruction directly and honestly — evidence over claims.`;
  const patchHash = patch.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10);
  const evalDef = fileEvalDefinition({
    kind: 'capability',
    subject: `${agentId}/prompt-tune:${patchHash}`,
    prompt: instruction,
    arms: [
      { name: 'baseline', tier: 'fast', system: baseSystem },
      { name: 'candidate', tier: 'fast', system: `${baseSystem}\n\nOPERATING RULE (candidate): ${patch}` },
    ],
    grader: {
      type: 'model',
      rubric: 'Does the output correctly and honestly complete the task instruction? The candidate arm carries one extra operating rule — penalize only if that rule degrades task completion or honesty.',
      threshold: 4,
    },
    k: 3,
    agentId,
    ventureId,
    createdBy: 'strategist/tune_cycle',
    notes: `prompt patch under evaluation: ${patch.slice(0, 160)} — rationale: ${rationale}`,
  });
  ctx.progress(0.6);
  const evalLlm = async (o: any) => ({ content: await ctx.llm(o) });
  const run = await runEval(evalDef.id, { llm: evalLlm }).catch((e: any) => ({ error: String(e?.message || e) } as any));
  ctx.progress(0.85);
  if ((run as any).error) return { tuned: 0, evalId: evalDef.id, reason: `eval run failed: ${(run as any).error}` };
  const ev = run as any;

  // Candidate must strictly win pass^k — ties/inconclusive file nothing.
  let proposalsFiled = 0;
  if (ev.winner === 'candidate' && ev.verdict === 'pass') {
    const res = fileStrategyProposals({
      planNote: `tune-cycle-${new Date().toISOString().slice(0, 10)}`,
      planTaskId: ctx.task.id,
      ventureId,
      actions: [
        `[prompt] Apply operating rule to ${agentId}: "${patch}" — evidence: eval ${evalDef.id} run ${ev.id} pass^k candidate=${ev.passCaretK?.candidate} vs baseline=${ev.passCaretK?.baseline} over ${ev.trials?.length || 0} trials; rationale: ${rationale || 'n/a'}`,
      ],
      evalEvidence: [{
        evalId: evalDef.id, verdict: ev.verdict,
        passCaretK: ev.passCaretK, at: ev.finishedAt,
        baselineEvalId: evalDef.id, candidateEvalId: evalDef.id,
      }],
    });
    proposalsFiled = res.filed;
  }

  ctx.progress(1);
  return {
    tuned: proposalsFiled > 0 ? 1 : 0,
    agentId,
    patch: patch.slice(0, 200),
    eval: { evalId: evalDef.id, runId: ev.id, verdict: ev.verdict, winner: ev.winner, passCaretK: ev.passCaretK },
    proposalsFiled,
  };
}

export function makeStrategistWorker(runtime: AgentRuntime): WorkerHandler {
  return async (ctx: AgentContext) => {
    switch (ctx.task.kind) {
      case 'cluster': return clusterWorker(ctx);
      case 'plan': return planWorker(ctx);
      case 'manifest': return manifestWorker(ctx);
      case 'regress': return regressWorker(ctx);
      case 'propose_skill': return proposeSkillWorker(ctx);
      case 'propose_agent': return proposeAgentWorker(ctx, runtime);
      case 'counsel_convene': return counselConveneWorker(ctx);
      case 'counsel_synthesize': return counselSynthesizeWorker(ctx);
      case 'counsel_personas': return runCounselPersonas(ctx, runtime);
      case 'counsel_persona_position': return runPersonaPosition(ctx);
      case 'counsel_persona_positions': return runPersonaPositionsBatch(ctx);
      case 'counsel_position': return runCounselPosition(ctx, 'strategist', 'FLIGHT DIRECTOR — council orchestration & synthesis counsel');
      case 'goal_plan': return goalPlanWorker(ctx);
      case 'goal_review': return goalReviewWorker(ctx);
      case 'tune_cycle': return tuneCycleWorker(ctx);
      default:
        return { error: `unknown strategist kind '${ctx.task.kind}'`, kinds: ['cluster', 'plan', 'manifest', 'regress', 'propose_skill', 'propose_agent', 'counsel_convene', 'counsel_synthesize', 'counsel_personas', 'counsel_persona_position', 'counsel_persona_positions', 'counsel_position', 'goal_plan', 'goal_review', 'tune_cycle'] };
    }
  };
}
