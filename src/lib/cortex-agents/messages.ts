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
import { wrapUntrusted, screenUntrusted } from './prompt-defense';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileStrategyProposals } from './strategy-proposals';
import { isValidVenture } from '../cortex-ventures';

const STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const MESSAGES_PATH = path.join(STATE_DIR, 'messages.json');
const DLQ_PATH = path.join(STATE_DIR, 'agent-messages-dlq.jsonl');
const MAX_MESSAGES = 300;
const MAX_DLQ = 200;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_PAYLOAD_CHARS = 2000;
const MAX_DAILY_PER_SENDER = 30;
const MAX_PENDING_PER_SENDER = 10;

export const MESSAGE_TYPES = ['handoff', 'signal', 'request', 'ack'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];
export type MessageStatus = 'pending' | 'delivered' | 'consumed' | 'expired' | 'rejected';

/** Mesh channels (fleet spec §1) — orthogonal to envelope type. A 'request'
 *  on channel 'verdict.request' is a peer-review ask; a 'handoff' on
 *  'task.delegate' is a work assignment. */
export const MESH_CHANNELS = [
  'task.delegate',
  'context.share',
  'verdict.request',
  'skill.query',
  'patrol.alert',
  'mesh.direct',
] as const;
export type MeshChannel = (typeof MESH_CHANNELS)[number];

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  payload: string;
  /** Links a reply/handoff chain back to the originating message or task. */
  correlationId?: string;
  /** The immediate parent message that caused this one (mesh causality chain). */
  causationId?: string;
  /** Mesh channel taxonomy — validated against MESH_CHANNELS when present. */
  channel?: MeshChannel;
  /** When true, sender expects an 'ack' reply correlated to this message id. */
  requiresAck?: boolean;
  /** Set when a correlated 'ack' arrives. */
  ackedAt?: number;
  /** Evidence refs — task ids, archive entries, proposal ids. */
  evidenceRefs?: string[];
  /** 'urgent' injects ahead of normal traffic and can wake an idle agent. */
  priority?: 'normal' | 'urgent';
  /** Venture scope (enterprise spec) — optional; unscoped = cortex bucket. */
  ventureId?: string;
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

function deadLetter(msg: AgentMessage) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.appendFileSync(DLQ_PATH, JSON.stringify({ ...msg, deadAt: Date.now() }) + '\n');
    // Bound the DLQ — it's an audit trail, not an archive.
    const lines = fs.readFileSync(DLQ_PATH, 'utf-8').split('\n').filter(Boolean);
    if (lines.length > MAX_DLQ) {
      fs.writeFileSync(DLQ_PATH, lines.slice(-MAX_DLQ).join('\n') + '\n');
    }
  } catch { /* DLQ is best-effort */ }
}

function prune(list: AgentMessage[]): AgentMessage[] {
  const now = Date.now();
  let dirty = false;
  for (const m of list) {
    if ((m.status === 'pending' || m.status === 'delivered') && m.expiresAt < now) {
      m.status = 'expired';
      dirty = true;
      // requiresAck traffic that dies undelivered/acked is a mesh failure —
      // it goes to the dead-letter queue, not just a status flip.
      if (m.requiresAck) deadLetter(m);
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

/** Post-send observers (verification pipeline, mission control). Called
 *  synchronously after a successful non-deduped send; must not throw. */
let onMessageSentHook: ((msg: AgentMessage) => void) | null = null;
export function setOnMessageSentHook(hook: ((msg: AgentMessage) => void) | null): void {
  onMessageSentHook = hook;
}
function notifyMessageSent(msg: AgentMessage) {
  if (!onMessageSentHook) return;
  try { onMessageSentHook(msg); } catch { /* observers are best-effort */ }
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
  causationId?: string;
  channel?: string;
  requiresAck?: boolean;
  evidenceRefs?: string[];
  priority?: 'normal' | 'urgent';
  ventureId?: string;
  dedupeKey?: string;
  ttlMs?: number;
}): SendResult {
  const { from, to, type, payload } = opts;
  if (!from || !to) return { ok: false, error: 'from and to are required' };
  if (from === to) return { ok: false, error: 'cannot message self' };
  if (opts.ventureId !== undefined && opts.ventureId !== '' && !isValidVenture(opts.ventureId)) {
    return { ok: false, error: `unknown venture: ${String(opts.ventureId).slice(0, 40)}` };
  }
  if (!MESSAGE_TYPES.includes(type as MessageType)) {
    return { ok: false, error: `type must be one of: ${MESSAGE_TYPES.join(', ')}` };
  }
  if (typeof payload !== 'string' || !payload.trim()) return { ok: false, error: 'payload required' };
  if (payload.length > MAX_PAYLOAD_CHARS) return { ok: false, error: `payload exceeds ${MAX_PAYLOAD_CHARS} chars` };
  if (opts.channel !== undefined && !MESH_CHANNELS.includes(opts.channel as MeshChannel)) {
    return { ok: false, error: `channel must be one of: ${MESH_CHANNELS.join(', ')}` };
  }

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
    causationId: opts.causationId,
    channel: opts.channel as MeshChannel | undefined,
    requiresAck: opts.requiresAck === true || undefined,
    evidenceRefs: opts.evidenceRefs?.slice(0, 10),
    priority: opts.priority === 'urgent' ? 'urgent' : 'normal',
    ventureId: opts.ventureId || undefined,
    dedupeKey: opts.dedupeKey,
    status: 'pending',
    createdAt: now,
    expiresAt: now + (opts.ttlMs ?? DEFAULT_TTL_MS),
  };
  list.push(msg);
  // Ack correlation: an 'ack' whose correlationId names a requiresAck message
  // stamps ackedAt on the target. Matching on message id keeps chains unambiguous.
  if (msg.type === 'ack' && msg.correlationId) {
    const target = list.find((m) => m.id === msg.correlationId);
    if (target) target.ackedAt = now;
  }
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
        ventureId: msg.ventureId,
      });
    } catch { /* proposal filing is best-effort; message is still durable */ }
  }
  notifyMessageSent(msg);
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
  const lines = pending.map((m, i) => {
    // Peer payloads are UNTRUSTED DATA — agents can carry injected content
    // (web text, tool output). Screen + wrap; flagged messages stay visible
    // (evidence is never silently dropped) but are marked suspicious.
    const screen = screenUntrusted(m.payload);
    const flag = screen.clean ? '' : ' [INJECTION-FLAGGED]';
    const wrapped = wrapUntrusted(`agent-message:${m.from}`, m.payload);
    return `${i + 1}. [${m.id}]${flag} ${m.priority === 'urgent' ? 'URGENT ' : ''}${m.ventureId ? `[${m.ventureId}] ` : ''}${m.type} from ${m.from}:\n${wrapped}${m.correlationId ? ` (corr: ${m.correlationId})` : ''}`;
  });
  return [
    '## AGENT MESSAGES (typed peer traffic — address in your work; cite message ids in your result to consume them)',
    ...lines,
    'To reply or hand off, emit fenced blocks in your result: ```agent_message\n{"to":"<agent>","type":"handoff|signal|request|ack","channel":"task.delegate|context.share|verdict.request|skill.query|patrol.alert|mesh.direct","payload":"...","correlationId":"<id>","requiresAck":true}\n```',
    'Need peer review before acting? Emit ```verify_request\n{"subject":"...","claim":"...","evidence":"..."}\n``` — reviewers vote and the verdict returns as a message.',
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
        causationId: obj.causationId ? String(obj.causationId) : undefined,
        channel: obj.channel ? String(obj.channel) : undefined,
        requiresAck: obj.requiresAck === true || undefined,
        evidenceRefs: Array.isArray(obj.evidenceRefs) ? obj.evidenceRefs.map(String) : undefined,
        priority: obj.priority === 'urgent' ? 'urgent' : undefined,
        ventureId: obj.ventureId ? String(obj.ventureId) : undefined,
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

/** Dead-letter queue — requiresAck messages that expired before ack/consumption. */
export function deadLetters(limit = 50): AgentMessage[] {
  try {
    if (!fs.existsSync(DLQ_PATH)) return [];
    return fs.readFileSync(DLQ_PATH, 'utf-8')
      .split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean)
      .slice(-limit) as AgentMessage[];
  } catch { return []; }
}

/** Mesh health snapshot for Mission Control: pending/delivered/expired counts,
 *  unacked requiresAck backlog, DLQ depth. */
export function meshStats() {
  const list = prune(readAll());
  const now = Date.now();
  const byStatus: Record<string, number> = {};
  let unacked = 0;
  for (const m of list) {
    byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
    if (m.requiresAck && !m.ackedAt && (m.status === 'pending' || m.status === 'delivered') && m.expiresAt >= now) unacked++;
  }
  return { total: list.length, byStatus, unackedRequiresAck: unacked, deadLetters: deadLetters(200).length };
}
