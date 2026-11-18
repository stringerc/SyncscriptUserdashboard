/**
 * Agent → Agent typed message bus (governed).
 *
 * Directives are Cortex → agent orders. This module is the peer channel:
 * agents exchange bounded, typed envelopes — handoff / signal / request /
 * ack — that Cortex records, validates, rate-limits, and delivers into the
 * recipient's next pumped task. Messages never preempt running work, never
 * bypass budgets, and never authorize actions: consequential work still
 * flows through directives, strategy proposals, and Crew approval.
 *
 * Lifecycle: pending → delivered (injected into a task's LLM context) →
 * consumed (recipient cites the message id in its result) →
 * expired/rejected.
 *
 * Persistence: .cortex-runtime/messages.json (bounded ring). Every send is
 * also appended to the durable task archive via the caller's archive hook.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileStrategyProposals } from './strategy-proposals';

const STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const MESSAGES_PATH = path.join(STATE_DIR, 'messages.json');
const MAX_MESSAGES = 300;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_PAYLOAD_CHARS = 2000;
const MAX_DAILY_PER_SENDER = 30;
const MAX_PENDING_PER_SENDER = 10;

export const MESSAGE_TYPES = ['handoff', 'signal', 'request', 'ack'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];
export type MessageStatus = 'pending' | 'delivered' | 'consumed' | 'expired' | 'rejected';

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  payload: string;
  /** Links a reply/handoff chain back to the originating message or task. */
  correlationId?: string;
  /** Evidence refs — task ids, archive entries, proposal ids. */
  evidenceRefs?: string[];
  /** 'urgent' injects ahead of normal traffic and can wake an idle agent. */
  priority?: 'normal' | 'urgent';
  /** Dedupe: same key while pending/delivered → returns existing, no dup. */
  dedupeKey?: string;
  status: MessageStatus;
  createdAt: number;
  expiresAt: number;
  deliveredAt?: number;
  deliveredTaskId?: string;
  consumedAt?: number;
}

function readAll(): AgentMessage[] {
  try {
    if (!fs.existsSync(MESSAGES_PATH)) return [];
    const data = JSON.parse(fs.readFileSync(MESSAGES_PATH, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function writeAll(list: AgentMessage[]) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const trimmed = list.slice(-MAX_MESSAGES);
    fs.writeFileSync(MESSAGES_PATH, JSON.stringify(trimmed, null, 2));
  } catch { /* best-effort persistence */ }
}

function prune(list: AgentMessage[]): AgentMessage[] {
  const now = Date.now();
  let dirty = false;
  for (const m of list) {
    if ((m.status === 'pending' || m.status === 'delivered') && m.expiresAt < now) {
      m.status = 'expired';
      dirty = true;
    }
  }
  return dirty ? (writeAll(list), list) : list;
}

/** Registered agent ids — read from the runtime state so the bus can't address ghosts. */
function knownAgents(): Set<string> {
  try {
    const p = path.join(STATE_DIR, 'agents-state.json');
    if (!fs.existsSync(p)) return new Set();
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const agents = data?.agents ?? data;
    if (Array.isArray(agents)) return new Set(agents.map((a: any) => a?.id ?? a?.agentId).filter(Boolean));
    if (agents && typeof agents === 'object') return new Set(Object.keys(agents));
  } catch { /* fall through */ }
  return new Set();
}

export interface SendResult {
  ok: boolean;
  message?: AgentMessage;
  error?: string;
  /** True when dedupeKey matched an existing live message. */
  deduped?: boolean;
}

/**
 * Send a typed message. Validation is strict: known sender/recipient,
 * allowlisted type, bounded payload, per-sender rate + pending caps.
 * Crew/Cortex may send via sendOperatorMessage (bypasses agent caps).
 */
export function sendMessage(opts: {
  from: string;
  to: string;
  type: string;
  payload: string;
  correlationId?: string;
  evidenceRefs?: string[];
  priority?: 'normal' | 'urgent';
  dedupeKey?: string;
  ttlMs?: number;
}): SendResult {
  const { from, to, type, payload } = opts;
  if (!from || !to) return { ok: false, error: 'from and to are required' };
  if (from === to) return { ok: false, error: 'cannot message self' };
  if (!MESSAGE_TYPES.includes(type as MessageType)) {
    return { ok: false, error: `type must be one of: ${MESSAGE_TYPES.join(', ')}` };
  }
  if (typeof payload !== 'string' || !payload.trim()) return { ok: false, error: 'payload required' };
  if (payload.length > MAX_PAYLOAD_CHARS) return { ok: false, error: `payload exceeds ${MAX_PAYLOAD_CHARS} chars` };

  const list = prune(readAll());
  const agents = knownAgents();
  // 'crew'/'cortex' are valid endpoints for observability; agents must be registered.
  const validTo = to === 'crew' || to === 'cortex' || agents.has(to);
  const validFrom = from === 'crew' || from === 'cortex' || agents.has(from);
  if (!validTo) return { ok: false, error: `unknown recipient: ${to}` };
  if (!validFrom) return { ok: false, error: `unknown sender: ${from}` };

  // Dedupe on live messages.
  if (opts.dedupeKey) {
    const existing = list.find((m) =>
      m.dedupeKey === opts.dedupeKey && (m.status === 'pending' || m.status === 'delivered'));
    if (existing) return { ok: true, message: existing, deduped: true };
  }

  // Per-sender caps (agent senders only — operators bypass).
  const isAgentSender = agents.has(from);
  if (isAgentSender) {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const sentToday = list.filter((m) => m.from === from && m.createdAt > dayAgo).length;
    if (sentToday >= MAX_DAILY_PER_SENDER) return { ok: false, error: `sender daily cap (${MAX_DAILY_PER_SENDER}) reached` };
    const pendingOut = list.filter((m) => m.from === from && m.status === 'pending').length;
    if (pendingOut >= MAX_PENDING_PER_SENDER) return { ok: false, error: `sender pending cap (${MAX_PENDING_PER_SENDER}) reached` };
  }

  const now = Date.now();
  const msg: AgentMessage = {
    id: `msg-${randomUUID().slice(0, 8)}`,
    from, to,
    type: type as MessageType,
    payload: payload.trim(),
    correlationId: opts.correlationId,
    evidenceRefs: opts.evidenceRefs?.slice(0, 10),
    priority: opts.priority === 'urgent' ? 'urgent' : 'normal',
    dedupeKey: opts.dedupeKey,
    status: 'pending',
    createdAt: now,
    expiresAt: now + (opts.ttlMs ?? DEFAULT_TTL_MS),
  };
  list.push(msg);
  writeAll(list);
  // Crew/Cortex-bound traffic — and ANY 'request' type, since a request is
  // by definition asking for something — surfaces in the INBOX as a governed
  // proposal. Agents may ask; only the Crew disposes.
  if (to === 'crew' || to === 'cortex' || msg.type === 'request') {
    try {
      fileStrategyProposals({
        planNote: `agent-message ${msg.id}`,
        planTaskId: msg.id,
        actions: [`[process] Agent message ${msg.type} from ${from}: ${payload.slice(0, 900)}`],
      });
    } catch { /* proposal filing is best-effort; message is still durable */ }
  }
  return { ok: true, message: msg };
}

/** Pending (undelivered, unexpired) messages for an agent — injected into its next task. */
export function pendingMessages(agentId: string): AgentMessage[] {
  return prune(readAll())
    .filter((m) => m.to === agentId && m.status === 'pending' && m.expiresAt >= Date.now())
    .sort((a, b) => (b.priority === 'urgent' ? 1 : 0) - (a.priority === 'urgent' ? 1 : 0) || a.createdAt - b.createdAt);
}

/** Render pending messages as a compact system-prompt block, like directivesBlock. */
export function messagesBlock(agentId: string): string {
  const pending = pendingMessages(agentId);
  if (!pending.length) return '';
  const lines = pending.map((m, i) =>
    `${i + 1}. [${m.id}] ${m.priority === 'urgent' ? 'URGENT ' : ''}${m.type} from ${m.from}: ${m.payload}${m.correlationId ? ` (corr: ${m.correlationId})` : ''}`);
  return [
    '## AGENT MESSAGES (typed peer traffic — address in your work; cite message ids in your result to consume them)',
    ...lines,
    'To reply or hand off, emit fenced blocks in your result: ```agent_message\n{"to":"<agent>","type":"handoff|signal|request|ack","payload":"...","correlationId":"<id>"}\n```',
  ].join('\n');
}

/** Mark pending messages delivered when injected into a task. */
export function markMessagesDelivered(agentId: string, taskId: string) {
  const list = readAll();
  const now = Date.now();
  let dirty = false;
  for (const m of list) {
    if (m.to === agentId && m.status === 'pending' && m.expiresAt >= now) {
      m.status = 'delivered';
      m.deliveredAt = now;
      m.deliveredTaskId = taskId;
      dirty = true;
    }
  }
  if (dirty) writeAll(list);
}

/** Parse ```agent_message fenced JSON blocks from a task result and send them. */
export function extractAndSendMessages(agentId: string, resultText: string): { sent: number; rejected: number } {
  let sent = 0, rejected = 0;
  const re = /```agent_message\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(resultText))) {
    try {
      const obj = JSON.parse(match[1].trim());
      const r = sendMessage({
        from: agentId,
        to: String(obj.to || ''),
        type: String(obj.type || ''),
        payload: String(obj.payload || ''),
        correlationId: obj.correlationId ? String(obj.correlationId) : undefined,
        evidenceRefs: Array.isArray(obj.evidenceRefs) ? obj.evidenceRefs.map(String) : undefined,
        priority: obj.priority === 'urgent' ? 'urgent' : undefined,
      });
      if (r.ok && !r.deduped) sent++; else if (!r.ok) rejected++;
    } catch { rejected++; }
  }
  return { sent, rejected };
}

/** Consume delivered messages whose ids appear in the result text. */
export function consumeMentioned(agentId: string, resultText: string) {
  const list = readAll();
  const now = Date.now();
  let dirty = false;
  for (const m of list) {
    if (m.to === agentId && m.status === 'delivered' && resultText.includes(m.id)) {
      m.status = 'consumed';
      m.consumedAt = now;
      dirty = true;
    }
  }
  if (dirty) writeAll(list);
}

export function listMessages(opts?: { agentId?: string; status?: string; limit?: number }): AgentMessage[] {
  let list = prune(readAll());
  if (opts?.agentId) list = list.filter((m) => m.from === opts.agentId || m.to === opts.agentId);
  if (opts?.status) list = list.filter((m) => m.status === opts.status);
  return list.slice(-(opts?.limit ?? 100));
}
