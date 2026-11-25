/**
 * Verification Pipeline — mandatory multi-agent peer review (fleet spec §5).
 *
 * A finding, mutation, or claim can be opened for peer review: the requester
 * dispatches verdict.request envelopes to N verifier agents (role-affinity
 * selection, requester excluded). Verifiers reply through the normal
 * agent_message channel; a post-send hook in messages.ts routes correlated
 * replies here as votes.
 *
 * Consensus rules:
 *   - unanimous approve  → status 'approved'
 *   - unanimous contest  → status 'contested'
 *   - split vote         → 'escalated' (Initiative Inbox via strategy proposals)
 *   - deadline with no/unresolved consensus → 'expired' → escalated
 *
 * Escalation always carries the full evidence packet — subject, claim,
 * evidence, every vote cast, and who never answered. Nothing resolves
 * silently: an expired verification is a visible proposal, not a shrug.
 *
 * Persistence: .cortex-runtime/verifications.json (bounded ring).
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { sendMessage, setOnMessageSentHook, type AgentMessage } from './messages';
import { fileStrategyProposals } from './strategy-proposals';

const STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const STORE_PATH = path.join(STATE_DIR, 'verifications.json');
const MAX_VERIFICATIONS = 100;
const DEFAULT_WINDOW_MS = 5 * 60 * 1000; // spec: verify-or-contest within 5 min
const MAX_EVIDENCE_CHARS = 4_000;

export type Verdict = 'approve' | 'contest' | 'abstain';
export type VerificationStatus = 'open' | 'approved' | 'contested' | 'escalated' | 'expired';

export interface VerificationVote {
  verifierId: string;
  verdict: Verdict;
  rationale?: string;
  at: number;
}

export interface Verification {
  id: string;
  subject: string;
  claim: string;
  evidence: string;
  requestedBy: string;
  verifierIds: string[];
  votes: VerificationVote[];
  status: VerificationStatus;
  createdAt: number;
  deadline: number;
  resolvedAt?: number;
  resolution?: string;
}

function load(): Verification[] {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function persist(list: Verification[]) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(list.slice(-MAX_VERIFICATIONS), null, 2));
  } catch { /* best-effort */ }
}

/** Role-affinity defaults: reviewer critiques, sentinel watches infra. */
const AFFINITY: Record<string, string[]> = {
  code: ['reviewer', 'builder'],
  security: ['sentinel', 'reviewer'],
  infra: ['sentinel', 'warden'],
  research: ['scout', 'librarian'],
  default: ['reviewer', 'sentinel'],
};

export function pickVerifiers(subject: string, exclude: string, override?: string[]): string[] {
  if (override?.length) return override.filter((v) => v !== exclude).slice(0, 3);
  const key = Object.keys(AFFINITY).find((k) => k !== 'default' && subject.toLowerCase().includes(k)) ?? 'default';
  return AFFINITY[key].filter((v) => v !== exclude).slice(0, 3);
}

function evidencePacket(v: Verification): string {
  const votes = v.votes.length
    ? v.votes.map((vote) => `  - ${vote.verifierId}: ${vote.verdict}${vote.rationale ? ` — ${vote.rationale}` : ''}`).join('\n')
    : '  - (no votes cast)';
  const silent = v.verifierIds.filter((id) => !v.votes.some((vote) => vote.verifierId === id));
  return [
    `verification ${v.id} — ${v.status}`,
    `subject: ${v.subject}`,
    `claim: ${v.claim}`,
    `evidence: ${v.evidence.slice(0, MAX_EVIDENCE_CHARS)}`,
    `requestedBy: ${v.requestedBy}  window: ${new Date(v.createdAt).toISOString()} → ${new Date(v.deadline).toISOString()}`,
    'votes:', votes,
    `never answered: ${silent.join(', ') || 'none'}`,
  ].join('\n');
}

function escalate(v: Verification, finalStatus: 'escalated' | 'expired' = 'escalated') {
  v.status = finalStatus;
  v.resolvedAt = Date.now();
  v.resolution = finalStatus === 'expired'
    ? 'verification window closed without consensus — escalated to Initiative Inbox'
    : 'no consensus — escalated to Initiative Inbox';
  try {
    fileStrategyProposals({
      planNote: `verification ${v.id} escalated`,
      planTaskId: v.id,
      actions: [`[process] Peer-review escalation — ${v.subject}: ${v.claim}\n${evidencePacket(v)}`],
    });
  } catch { /* escalation is best-effort; the record itself is durable */ }
}

/** Resolve if consensus is reached or the window has closed. */
function maybeResolve(v: Verification) {
  if (v.status !== 'open') return;
  resolveOpen(v);
  if (v.status !== 'open') notifyResolved(v);
}

function resolveOpen(v: Verification) {
  const votes = v.votes.filter((vote) => vote.verdict !== 'abstain');
  const allVoted = v.verifierIds.every((id) => v.votes.some((vote) => vote.verifierId === id));

  if (votes.length === v.verifierIds.length && votes.length > 0) {
    const approves = votes.filter((vote) => vote.verdict === 'approve').length;
    const contests = votes.filter((vote) => vote.verdict === 'contest').length;
    if (approves === votes.length) {
      v.status = 'approved'; v.resolvedAt = Date.now(); v.resolution = 'unanimous approve'; return;
    }
    if (contests === votes.length) {
      v.status = 'contested'; v.resolvedAt = Date.now(); v.resolution = 'unanimous contest'; return;
    }
    escalate(v); return; // split verdict — no consensus
  }
  if (allVoted) {
    // Everyone answered but some abstained: consensus only if no contests.
    if (!votes.some((vote) => vote.verdict === 'contest')) {
      v.status = 'approved'; v.resolvedAt = Date.now(); v.resolution = 'no objections (abstentions allowed)';
    } else {
      escalate(v);
    }
    return;
  }
  if (Date.now() >= v.deadline) {
    escalate(v, 'expired');
  }
}

/** Resolution observers (patrol heal-gate, mission control). Fired once when
 *  an open verification reaches any terminal status. */
let onResolvedHook: ((v: Verification) => void) | null = null;
export function setOnVerificationResolvedHook(fn: ((v: Verification) => void) | null): void {
  onResolvedHook = fn;
}
function notifyResolved(v: Verification) {
  if (!onResolvedHook) return;
  try { onResolvedHook(v); } catch { /* observers are best-effort */ }
}

/** Open a peer review and dispatch verdict.request envelopes to verifiers. */
export function openVerification(opts: {
  subject: string;
  claim: string;
  evidence?: string;
  requestedBy?: string;
  verifierIds?: string[];
  windowMs?: number;
}): { ok: boolean; verification?: Verification; error?: string; dispatched?: number } {
  const requestedBy = opts.requestedBy || 'cortex';
  if (!opts.subject?.trim() || !opts.claim?.trim()) return { ok: false, error: 'subject and claim required' };
  const verifierIds = pickVerifiers(opts.subject, requestedBy, opts.verifierIds);
  if (!verifierIds.length) return { ok: false, error: 'no verifiers available' };

  const now = Date.now();
  const v: Verification = {
    id: `ver-${randomUUID().slice(0, 8)}`,
    subject: opts.subject.trim().slice(0, 200),
    claim: opts.claim.trim().slice(0, 1_000),
    evidence: (opts.evidence ?? '').slice(0, MAX_EVIDENCE_CHARS),
    requestedBy,
    verifierIds,
    votes: [],
    status: 'open',
    createdAt: now,
    deadline: now + Math.min(Math.max(opts.windowMs ?? DEFAULT_WINDOW_MS, 30_000), 60 * 60 * 1000),
  };

  const list = load();
  list.push(v);
  persist(list);

  const payload = JSON.stringify({
    verificationId: v.id,
    subject: v.subject,
    claim: v.claim,
    evidence: v.evidence,
    windowMinutes: Math.round((v.deadline - now) / 60_000),
    instruction: 'Reply with an agent_message to the requester on channel verdict.request, correlationId = this verificationId, payload JSON {"vote":"approve|contest|abstain","rationale":"..."}.',
  });
  let dispatched = 0;
  for (const vid of verifierIds) {
    const r = sendMessage({
      from: requestedBy,
      to: vid,
      type: 'request',
      channel: 'verdict.request',
      payload,
      correlationId: v.id,
      requiresAck: true,
      ttlMs: v.deadline - now + 60_000,
    });
    if (r.ok) dispatched++;
  }
  return { ok: true, verification: v, dispatched };
}

function parseVotePayload(payload: string): { vote: Verdict; rationale?: string } {
  try {
    const obj = JSON.parse(payload);
    const raw = String(obj.vote || obj.verdict || '').toLowerCase();
    const vote: Verdict = raw === 'approve' || raw === 'confirmed' || raw === 'agree' ? 'approve'
      : raw === 'contest' || raw === 'reject' || raw === 'disagree' ? 'contest'
      : 'abstain';
    return { vote, rationale: obj.rationale ? String(obj.rationale).slice(0, 300) : undefined };
  } catch {
    const p = payload.toLowerCase();
    const vote: Verdict = /\b(approve|confirmed|agree|verified|lgtm)\b/.test(p) ? 'approve'
      : /\b(contest|reject|disagree|false|wrong|fail)\b/.test(p) ? 'contest'
      : 'abstain';
    return { vote, rationale: payload.slice(0, 300) };
  }
}

/** Post-send hook: a verdict.request-channel reply whose correlationId names
 *  an open verification and whose sender is a listed verifier records a vote. */
function onMessageSent(msg: AgentMessage) {
  if (msg.channel !== 'verdict.request' || !msg.correlationId) return;
  const list = load();
  const v = list.find((item) => item.id === msg.correlationId && item.status === 'open');
  if (!v) return;
  if (!v.verifierIds.includes(msg.from)) return;
  if (v.votes.some((vote) => vote.verifierId === msg.from)) return; // one vote per verifier

  const { vote, rationale } = parseVotePayload(msg.payload);
  v.votes.push({ verifierId: msg.from, verdict: vote, rationale, at: Date.now() });
  maybeResolve(v);
  persist(list);
}

setOnMessageSentHook(onMessageSent);

/** Lazily expire open verifications past deadline (called on reads). */
function sweep(list: Verification[]): boolean {
  let dirty = false;
  for (const v of list) {
    if (v.status === 'open') {
      const before = v.status;
      maybeResolve(v); // handles deadline expiry internally now
      if (v.status !== before) dirty = true;
    }
  }
  return dirty;
}

export function listVerifications(opts?: { status?: VerificationStatus; limit?: number }): Verification[] {
  const list = load();
  if (sweep(list)) persist(list);
  let out = list;
  if (opts?.status) out = out.filter((v) => v.status === opts.status);
  return out.slice(-(opts?.limit ?? 50));
}

export function getVerification(id: string): Verification | undefined {
  const list = load();
  if (sweep(list)) persist(list);
  return list.find((v) => v.id === id);
}

export function verificationStats() {
  const list = load();
  if (sweep(list)) persist(list);
  const byStatus: Record<string, number> = {};
  for (const v of list) byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
  return { total: list.length, byStatus, open: list.filter((v) => v.status === 'open').length };
}
