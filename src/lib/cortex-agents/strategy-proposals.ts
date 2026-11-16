/**
 * Strategy proposals — the approval bridge between STRATEGIST's plans
 * and the human gate.
 *
 * STRATEGIST files ranked actions here; the Initiative Inbox renders them;
 * approval dispatches a real agent task; the decision is written back.
 * Durable JSON (survives restarts) — the vault plan note remains the
 * long-form evidence document, this file is the actionable queue.
 */

import fs from 'node:fs';
import path from 'node:path';

const STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const PROPOSALS_PATH = path.join(STATE_DIR, 'strategy-proposals.json');
const MAX_FILED_PER_PLAN = 3;
const MAX_PENDING = 12;

export interface StrategyProposal {
  id: string;
  planNote: string;
  planTaskId: string;
  actionIndex: number;
  title: string;
  /** Intervention class from the plan: rule|prompt|skill|eval|config|code|infra|process */
  actionClass: string;
  /** Agent that would execute on approval. */
  agentId: string;
  /** Task kind + input.instruction for POST /api/cortex/agents/task. */
  kind: string;
  instruction: string;
  evidence: string[];
  status: 'pending' | 'approved' | 'dismissed' | 'executed' | 'failed';
  createdAt: number;
  decidedAt?: number;
  decisionNote?: string;
  /** Agent task dispatched on approval — reconciled to executed/failed. */
  dispatchedTaskId?: string;
  /** Deterministic action executed on approval instead of agent dispatch —
   *  e.g. budgetRaise adjusts the agent's dailyBudget directly. */
  action?: { type: 'budgetRaise'; agentId: string; budget: number };
}

function readAll(): StrategyProposal[] {
  try {
    if (!fs.existsSync(PROPOSALS_PATH)) return [];
    const data = JSON.parse(fs.readFileSync(PROPOSALS_PATH, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function writeAll(list: StrategyProposal[]) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(PROPOSALS_PATH, JSON.stringify(list.slice(-100), null, 1));
  } catch { /* best-effort */ }
}

/** Class → executing agent. Everything routes through BUILDER's governed
 *  tool path for now; eval/process items still become builder tasks with
 *  an explicit instruction (builder's own blast-radius gate applies). */
function agentForClass(cls: string): string {
  return 'builder';
}

/**
 * File up to MAX_FILED_PER_PLAN proposals from a plan's action lines.
 * Action lines look like: `1. [eval | process] Title — evidence: ... — why ...`
 * Dedupe: same planNote + actionIndex never files twice.
 */
export function fileStrategyProposals(opts: {
  planNote: string | null;
  planTaskId: string;
  actions: string[];
}): { filed: number; skipped: number } {
  const all = readAll();
  const pending = all.filter((p) => p.status === 'pending').length;
  let filed = 0, skipped = 0;
  for (let i = 0; i < Math.min(opts.actions.length, MAX_FILED_PER_PLAN); i++) {
    const raw = opts.actions[i];
    if (!raw) continue;
    const dedupeId = `strat-${(opts.planNote || opts.planTaskId).replace(/[^a-z0-9]+/gi, '-').slice(-40)}-${i}`;
    if (all.some((p) => p.id === dedupeId)) { skipped++; continue; }
    if (pending + filed >= MAX_PENDING) { skipped++; continue; }
    const clsMatch = raw.match(/\[([^\]]+)\]/);
    const actionClass = (clsMatch?.[1] || 'process').split('|')[0].trim().toLowerCase();
    const title = raw.replace(/\[[^\]]+\]/, '').split('—')[0].split('–')[0].trim().slice(0, 140) || `Strategy action ${i + 1}`;
    const evidence = (raw.match(/evidence:\s*([^—]+)/i)?.[1] || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6);
    const proposal: StrategyProposal = {
      id: dedupeId,
      planNote: opts.planNote || '',
      planTaskId: opts.planTaskId,
      actionIndex: i,
      title,
      actionClass,
      agentId: agentForClass(actionClass),
      kind: 'task',
      instruction: `[STRATEGIST plan ${opts.planNote || opts.planTaskId}] ${raw.slice(0, 1200)}`,
      evidence,
      status: 'pending',
      createdAt: Date.now(),
    };
    all.push(proposal);
    filed++;
  }
  if (filed) writeAll(all);
  return { filed, skipped };
}

/**
 * File a budget-raise proposal when an agent exhausts its daily budget.
 * One pending proposal per agent — repeated rejections don't spam the Inbox.
 * Approval executes the deterministic budgetRaise action (no BUILDER task).
 */
export function fileBudgetProposal(opts: { agentId: string; agentName: string; currentBudget: number; suggestedBudget: number; error: string }): boolean {
  const all = readAll();
  if (all.some((p) => p.status === 'pending' && p.action?.type === 'budgetRaise' && p.action.agentId === opts.agentId)) return false;
  if (all.filter((p) => p.status === 'pending').length >= MAX_PENDING) return false;
  const day = new Date().toISOString().slice(0, 10);
  all.push({
    id: `budget-${opts.agentId}-${day}`,
    planNote: '',
    planTaskId: `budget-guard-${opts.agentId}`,
    actionIndex: 0,
    title: `${opts.agentName} daily budget exhausted — raise to ${opts.suggestedBudget}?`,
    actionClass: 'config',
    agentId: 'runtime',
    kind: 'budget',
    instruction: `${opts.error}. Options: approve raises ${opts.agentName} dailyBudget ${opts.currentBudget}→${opts.suggestedBudget} (persists until changed), or dismiss and wait for tomorrow's reset.`,
    evidence: [`${opts.agentId} budget ${opts.currentBudget}/day exhausted`],
    status: 'pending',
    createdAt: Date.now(),
    action: { type: 'budgetRaise', agentId: opts.agentId, budget: opts.suggestedBudget },
  });
  writeAll(all);
  return true;
}

/**
 * File an investigation proposal for a stale incident (auto-escalation
 * from the Warden patrol sweep). One pending proposal per incident key —
 * recurring patrols don't spam the Inbox. Returns true when filed.
 */
export function fileIncidentProposal(inc: {
  key: string; agentId: string; agentName?: string; kind: string;
  failureClass: string; title: string; count: number;
  firstSeenAt: number; lastError?: string; evidence: string[];
}): boolean {
  const all = readAll();
  const dedupeId = `incident-${inc.key.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}`;
  if (all.some((p) => p.id === dedupeId)) return false;
  if (all.filter((p) => p.status === 'pending').length >= MAX_PENDING) return false;
  const ageH = Math.floor((Date.now() - inc.firstSeenAt) / 3600_000);
  all.push({
    id: dedupeId,
    planNote: '',
    planTaskId: `incident-${inc.key.slice(0, 40)}`,
    actionIndex: 0,
    title: `Investigate stale incident: ${inc.agentName || inc.agentId} ${inc.kind} (${inc.failureClass})`,
    actionClass: 'process',
    agentId: 'builder',
    kind: 'task',
    instruction: `[INCIDENT ESCALATION] Ticket open ${ageH}h, seen ${inc.count}x.\nFailure: ${inc.failureClass} on ${inc.kind}\nTitle: ${inc.title}\nLast error: ${inc.lastError || 'none'}\nEvidence tasks: ${inc.evidence.slice(-5).join(', ')}\nInvestigate root cause and propose or implement a verified fix. The incident auto-resolves only when a matching task completes.`,
    evidence: inc.evidence.slice(-5),
    status: 'pending',
    createdAt: Date.now(),
  });
  writeAll(all);
  return true;
}

export function listStrategyProposals(status?: string): StrategyProposal[] {
  const all = readAll();
  const filtered = status ? all.filter((p) => p.status === status) : all;
  return filtered.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
}

export function decideStrategyProposal(id: string, decision: 'approved' | 'dismissed' | 'executed' | 'failed', note?: string, dispatchedTaskId?: string): StrategyProposal | null {
  const all = readAll();
  const p = all.find((x) => x.id === id);
  if (!p || p.status !== 'pending' && p.status !== 'approved') return null;
  p.status = decision;
  p.decidedAt = Date.now();
  if (note) p.decisionNote = note.slice(0, 300);
  if (dispatchedTaskId) p.dispatchedTaskId = dispatchedTaskId;
  writeAll(all);
  return p;
}

/**
 * Reconcile approved proposals against terminal task states. Called on
 * read so the Inbox reflects reality: approved + task failed → 'failed',
 * task completed → 'executed'. Never throws.
 */
export function reconcileStrategyProposals(
  taskStatus: (taskId: string) => { status: string; error?: string; result?: unknown } | null,
  onExecuted?: (proposal: StrategyProposal) => void,
): number {
  const all = readAll();
  let changed = 0;
  for (const p of all) {
    if (p.status !== 'approved') continue;
    // Backfill: v1 stored the task id inside decisionNote.
    if (!p.dispatchedTaskId) {
      const m = p.decisionNote?.match(/dispatched\s+(task-[a-z0-9-]+)/i);
      if (m) p.dispatchedTaskId = m[1];
    }
    if (!p.dispatchedTaskId) continue;
    const t = taskStatus(p.dispatchedTaskId);
    if (!t) continue;
    if (t.status === 'completed') {
      p.status = 'executed';
      p.decidedAt = Date.now();
      changed++;
      try { onExecuted?.(p); } catch { /* requeue hook must never break reads */ }
    } else if (['failed', 'vetoed', 'cancelled'].includes(t.status)) {
      p.status = 'failed';
      p.decidedAt = Date.now();
      p.decisionNote = `task ${t.status}${t.error ? `: ${String(t.error).slice(0, 200)}` : ''}`;
      changed++;
    }
  }
  if (changed) writeAll(all);
  return changed;
}
