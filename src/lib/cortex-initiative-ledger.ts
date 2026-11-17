/**
 * cortex-initiative-ledger.ts — server-side mirror of the Initiative Inbox.
 *
 * The client engine (cortex-proactive-initiative.ts) stays the executor and
 * remains authoritative for proposal content + execution results. This ledger
 * is the durable, runtime-visible queue so console agents (Prep drain,
 * Warden escalation) can see and approve proposals while the visualizer tab
 * is closed.
 *
 * Status model:
 *   pending   — awaiting a decision (client or agent)
 *   approved  — an agent approved; awaiting client pickup + execTool run
 *   dismissed — decided no
 *   snoozed   — deferred until snoozedUntilMs
 *   executed  — client reported ok
 *   failed    — client reported failure
 *
 * Governance: agents may only move pending→approved for SAFE_AUTO proposals
 * (tier<=1 + whitelisted read/announce tools). Everything else stays pending
 * for the Crew. The server never executes anything itself.
 */

import fs from 'node:fs';
import path from 'node:path';

const RUNTIME_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const LEDGER_PATH = path.join(RUNTIME_DIR, 'initiative-ledger.json');
const MAX_RECORDS = 500;

export type LedgerStatus = 'pending' | 'approved' | 'dismissed' | 'snoozed' | 'executed' | 'failed';

export interface LedgerProposal {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  rationale: string;
  suggestedTool: string;
  suggestedArgs?: Record<string, unknown>;
  requiresApproval: boolean;
  autonomyTier: number;
  source: string;
  dedupeKey?: string;
  status: LedgerStatus;
  createdAtMs: number;
  updatedAtMs: number;
  snoozedUntilMs?: number;
  approvedBy?: string;
  approvedAtMs?: number;
  decisionNote?: string;
  executionResult?: { ok: boolean; summary: string; atMs: number };
}

interface LedgerFile {
  version: 1;
  proposals: LedgerProposal[];
}

function readLedger(): LedgerFile {
  try {
    const raw = fs.readFileSync(LEDGER_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.proposals)) return parsed;
  } catch { /* missing/corrupt → start fresh */ }
  return { version: 1, proposals: [] };
}

function writeLedger(data: LedgerFile): void {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const tmp = LEDGER_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, LEDGER_PATH);
}

/** Tools an agent may approve without the Crew. Everything else waits. */
export const SAFE_AUTO_TOOLS = new Set([
  'cortex_goals',
  'cortex_metacognition',
  'cortex_accomplishments',
]);

export function isSafeAutoProposal(p: Pick<LedgerProposal, 'autonomyTier' | 'requiresApproval' | 'suggestedTool'>): boolean {
  return p.autonomyTier <= 1 && !p.requiresApproval && SAFE_AUTO_TOOLS.has(p.suggestedTool);
}

function normalize(input: any): LedgerProposal | null {
  if (!input || typeof input !== 'object') return null;
  const id = String(input.id || input.dedupeKey || '').trim();
  if (!id) return null;
  const tier = Number.isFinite(Number(input.autonomyTier)) ? Number(input.autonomyTier) : 2;
  const tool = String(input.suggestedTool || '');
  return {
    id,
    title: String(input.title || id).slice(0, 300),
    description: String(input.description || '').slice(0, 2000),
    category: String(input.category || 'system_resonance'),
    urgency: (['low', 'medium', 'high', 'critical'] as const).includes(input.urgency) ? input.urgency : 'medium',
    confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0)),
    rationale: String(input.rationale || '').slice(0, 1000),
    suggestedTool: tool,
    suggestedArgs: input.suggestedArgs && typeof input.suggestedArgs === 'object' ? input.suggestedArgs : undefined,
    requiresApproval: Boolean(input.requiresApproval),
    autonomyTier: tier,
    source: String(input.source || 'engine'),
    dedupeKey: input.dedupeKey ? String(input.dedupeKey) : undefined,
    status: 'pending',
    createdAtMs: Number(input.createdAtMs) || Date.now(),
    updatedAtMs: Date.now(),
  };
}

/**
 * Upsert client-synced proposals. Client is authoritative for content and
 * execution outcomes; server-side decisions (approved/dismissed-by-agent)
 * are preserved — a client 'pending' never overwrites an 'approved' record.
 */
export function syncProposals(inputs: any[]): { upserted: number; keptDecisions: number } {
  const ledger = readLedger();
  const byId = new Map(ledger.proposals.map((p) => [p.id, p]));
  let upserted = 0, keptDecisions = 0;
  for (const raw of Array.isArray(inputs) ? inputs : []) {
    const inc = normalize(raw);
    if (!inc) continue;
    const existing = byId.get(inc.id);
    // Client 'accepted' means it already dispatched execTool locally — mirror
    // as 'approved' so the ledger reflects reality without re-queueing it.
    const incomingAccepted = String(raw.status) === 'accepted';
    if (!existing) {
      const st = String(raw.status);
      if (['dismissed', 'snoozed', 'executed', 'failed'].includes(st)) {
        inc.status = st as LedgerStatus;
        if (raw.snoozedUntilMs) inc.snoozedUntilMs = Number(raw.snoozedUntilMs);
        if (raw.executionResult) inc.executionResult = raw.executionResult;
      } else if (incomingAccepted) {
        inc.status = 'approved';
        inc.approvedBy = 'client:auto';
        inc.approvedAtMs = Date.now();
      }
      ledger.proposals.push(inc);
      byId.set(inc.id, inc);
      upserted++;
      continue;
    }
    const terminalOrDecided = ['approved', 'dismissed', 'executed', 'failed'].includes(existing.status);
    if (terminalOrDecided && inc.status === 'pending') {
      keptDecisions++;
      continue;
    }
    // Client reports a lifecycle outcome — adopt status + result.
    if (['dismissed', 'snoozed', 'executed', 'failed'].includes(String(raw.status))) {
      existing.status = raw.status as LedgerStatus;
      if (raw.snoozedUntilMs) existing.snoozedUntilMs = Number(raw.snoozedUntilMs);
      if (raw.executionResult) existing.executionResult = raw.executionResult;
    } else if (incomingAccepted && (existing.status === 'pending' || existing.status === 'snoozed')) {
      existing.status = 'approved';
      existing.approvedBy = existing.approvedBy || 'client:auto';
      existing.approvedAtMs = existing.approvedAtMs || Date.now();
    } else if (existing.status === 'pending' || existing.status === 'snoozed') {
      existing.status = 'pending';
    }
    // Refresh content fields but keep server decision metadata.
    const { status: _s, approvedBy: _a, approvedAtMs: _t, decisionNote: _n, executionResult: _e, ...content } = inc;
    Object.assign(existing, content, { updatedAtMs: Date.now() });
    upserted++;
  }
  // Dedupe by dedupeKey: drop older pending duplicates.
  const seen = new Set<string>();
  ledger.proposals = ledger.proposals
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .filter((p) => {
      const key = p.dedupeKey || p.id;
      if (['executed', 'failed', 'dismissed'].includes(p.status)) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_RECORDS);
  writeLedger(ledger);
  return { upserted, keptDecisions };
}

export function listProposals(filter?: { status?: LedgerStatus; limit?: number }): LedgerProposal[] {
  const all = readLedger().proposals;
  const filtered = filter?.status ? all.filter((p) => p.status === filter.status) : all;
  return filtered
    .slice()
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, Math.min(filter?.limit ?? 200, 500));
}

/** Proposals awaiting a decision: pending, or snoozed whose time has passed. */
export function pendingDecisions(now = Date.now()): LedgerProposal[] {
  return readLedger().proposals.filter((p) =>
    p.status === 'pending' || (p.status === 'snoozed' && (p.snoozedUntilMs ?? 0) <= now),
  );
}

/** Approved proposals the client hasn't picked up yet. */
export function approvedAwaitingPickup(): LedgerProposal[] {
  return readLedger().proposals.filter((p) => p.status === 'approved');
}

export function getProposal(id: string): LedgerProposal | undefined {
  return readLedger().proposals.find((p) => p.id === id);
}

/** pending → approved. Caller must have verified isSafeAutoProposal or crew authority. */
export function approveProposal(id: string, by: string, note?: string): LedgerProposal | null {
  const ledger = readLedger();
  const p = ledger.proposals.find((x) => x.id === id);
  if (!p || p.status !== 'pending') return null;
  p.status = 'approved';
  p.approvedBy = by;
  p.approvedAtMs = Date.now();
  if (note) p.decisionNote = note.slice(0, 500);
  p.updatedAtMs = Date.now();
  writeLedger(ledger);
  return p;
}

export function dismissProposal(id: string, by: string, note?: string): LedgerProposal | null {
  const ledger = readLedger();
  const p = ledger.proposals.find((x) => x.id === id);
  if (!p || ['executed', 'failed', 'dismissed'].includes(p.status)) return null;
  p.status = 'dismissed';
  p.decisionNote = `${by}${note ? `: ${note}` : ''}`.slice(0, 500);
  p.updatedAtMs = Date.now();
  writeLedger(ledger);
  return p;
}

/** Client-reported execution outcome. */
export function reportExecuted(id: string, ok: boolean, summary: string): LedgerProposal | null {
  const ledger = readLedger();
  const p = ledger.proposals.find((x) => x.id === id);
  if (!p) return null;
  p.status = ok ? 'executed' : 'failed';
  p.executionResult = { ok, summary: String(summary || '').slice(0, 500), atMs: Date.now() };
  p.updatedAtMs = Date.now();
  writeLedger(ledger);
  return p;
}

/** Drain pass for console agents: approve every safe-auto pending proposal. */
export function drainSafePending(by: string): { approved: LedgerProposal[]; skipped: number } {
  const approved: LedgerProposal[] = [];
  let skipped = 0;
  for (const p of pendingDecisions()) {
    if (isSafeAutoProposal(p)) {
      const done = approveProposal(p.id, by, 'auto-approved: safe tier-1 tool');
      if (done) approved.push(done); else skipped++;
    } else {
      skipped++;
    }
  }
  return { approved, skipped };
}
