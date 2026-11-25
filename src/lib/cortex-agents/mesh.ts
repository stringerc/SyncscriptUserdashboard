/**
 * Agent Mesh — structured inter-agent communication (fleet spec §1).
 *
 * Layered on the governed bus in messages.ts: envelopes, rate limits, TTL,
 * injection screening, and task-context delivery already live there. This
 * module adds the mesh semantics the spec calls for:
 *
 *   - Channels: task.delegate / context.share / verdict.request / skill.query
 *     / patrol.alert / mesh.direct (validated allowlist, orthogonal to type)
 *   - Causality: correlationId chains a conversation, causationId names the
 *     immediate parent message
 *   - RPC: meshRequest sends a 'request' envelope and polls for the correlated
 *     reply — honest timeout, never a fabricated response
 *   - Acknowledgement: requiresAck envelopes expect an 'ack' reply; unacked
 *     expiries dead-letter to agent-messages-dlq.jsonl (see messages.ts)
 *
 * Delivery is still at-least-once-via-task-injection: a request only gets a
 * response after the recipient's next pumped task runs, so timeouts are the
 * caller's problem to size (default 60s, cap 300s).
 */

import {
  sendMessage,
  listMessages,
  deadLetters,
  meshStats,
  MESH_CHANNELS,
  type AgentMessage,
  type MeshChannel,
  type MessageType,
  type SendResult,
} from './messages';

export { MESH_CHANNELS, meshStats, deadLetters };
export type { MeshChannel, AgentMessage };

/** Sensible envelope type per channel; callers may override. */
const CHANNEL_DEFAULT_TYPE: Record<MeshChannel, MessageType> = {
  'task.delegate': 'handoff',
  'context.share': 'signal',
  'verdict.request': 'request',
  'skill.query': 'request',
  'patrol.alert': 'signal',
  'mesh.direct': 'signal',
};

export interface MeshSendOpts {
  from: string;
  to: string;
  channel: MeshChannel;
  payload: string;
  /** Override the channel's default envelope type. */
  type?: MessageType;
  correlationId?: string;
  /** Immediate parent message id — the direct cause of this send. */
  causationId?: string;
  requiresAck?: boolean;
  evidenceRefs?: string[];
  priority?: 'normal' | 'urgent';
  ventureId?: string;
  dedupeKey?: string;
  ttlMs?: number;
}

export function meshSend(opts: MeshSendOpts): SendResult {
  return sendMessage({
    from: opts.from,
    to: opts.to,
    type: opts.type ?? CHANNEL_DEFAULT_TYPE[opts.channel],
    payload: opts.payload,
    correlationId: opts.correlationId,
    causationId: opts.causationId,
    channel: opts.channel,
    requiresAck: opts.requiresAck,
    evidenceRefs: opts.evidenceRefs,
    priority: opts.priority,
    ventureId: opts.ventureId,
    dedupeKey: opts.dedupeKey,
    ttlMs: opts.ttlMs,
  });
}

/** Acknowledge a requiresAck message — correlationId must be the target's id. */
export function meshAck(opts: { from: string; to: string; messageId: string; payload?: string }): SendResult {
  return sendMessage({
    from: opts.from,
    to: opts.to,
    type: 'ack',
    channel: 'mesh.direct',
    payload: opts.payload ?? `ack ${opts.messageId}`,
    correlationId: opts.messageId,
  });
}

export interface MeshRequestResult {
  ok: boolean;
  /** The correlated reply message, if one arrived in time. */
  response?: AgentMessage;
  /** The outbound request envelope. */
  request?: AgentMessage;
  error?: string;
  timedOut?: boolean;
}

const POLL_MS = 750;
const MAX_TIMEOUT_MS = 300_000;
const DEFAULT_TIMEOUT_MS = 60_000;

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/** True when `m` is a reply to request `req`: sent by the target, after the
 *  request, and correlated to either the request id or its chain id. */
function isReplyTo(m: AgentMessage, req: AgentMessage): boolean {
  if (m.from !== req.to || m.createdAt <= req.createdAt) return false;
  return m.correlationId === req.id || (req.correlationId !== undefined && m.correlationId === req.correlationId);
}

/**
 * Synchronous-style RPC over the async bus. Sends a 'request' envelope with
 * requiresAck, then polls the store for a correlated non-pending reply.
 * Returns timedOut honestly — a missing reply is data, not an exception.
 */
export async function meshRequest(opts: {
  from: string;
  to: string;
  channel: MeshChannel;
  payload: string;
  timeoutMs?: number;
  correlationId?: string;
  causationId?: string;
  evidenceRefs?: string[];
  ventureId?: string;
}): Promise<MeshRequestResult> {
  const timeoutMs = Math.min(Math.max(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1_000), MAX_TIMEOUT_MS);
  const sent = meshSend({
    from: opts.from,
    to: opts.to,
    channel: opts.channel,
    type: 'request',
    payload: opts.payload,
    correlationId: opts.correlationId,
    causationId: opts.causationId,
    requiresAck: true,
    evidenceRefs: opts.evidenceRefs,
    ventureId: opts.ventureId,
    // Request TTL must outlive the poll window or the reply can arrive
    // after the envelope already expired.
    ttlMs: timeoutMs + 60_000,
  });
  if (!sent.ok || !sent.message) return { ok: false, error: sent.error ?? 'send failed' };
  const req = sent.message;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const reply = listMessages({ limit: 300 })
      .find((m) => isReplyTo(m, req) && m.status !== 'pending');
    if (reply) return { ok: true, response: reply, request: req };
    await sleep(POLL_MS);
  }
  return { ok: false, request: req, timedOut: true, error: `no correlated reply within ${timeoutMs}ms` };
}

/** Read-side helpers for Mission Control / patrols. */
export function meshInbox(agentId: string) {
  return listMessages({ agentId, status: 'pending' });
}

export function meshThread(correlationId: string): AgentMessage[] {
  return listMessages({ limit: 300 }).filter((m) => m.correlationId === correlationId || m.id === correlationId);
}
