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

export function listStrategyProposals(status?: string): StrategyProposal[] {
  const all = readAll();
  const filtered = status ? all.filter((p) => p.status === status) : all;
  return filtered.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
}

export function decideStrategyProposal(id: string, decision: 'approved' | 'dismissed' | 'executed' | 'failed', note?: string): StrategyProposal | null {
  const all = readAll();
  const p = all.find((x) => x.id === id);
  if (!p || p.status !== 'pending' && p.status !== 'approved') return null;
  p.status = decision;
  p.decidedAt = Date.now();
  if (note) p.decisionNote = note.slice(0, 300);
  writeAll(all);
  return p;
}
