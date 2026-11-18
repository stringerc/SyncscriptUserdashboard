/**
 * Cortex → Agent directive channel.
 *
 * Agents talk UP to Cortex via agent.comm / task results. This module is
 * the DOWN path: Cortex (forecaster signals, strategist findings, human
 * operators) issues durable directives that the target agent picks up on
 * its next pumped task. Directives are orders-of-the-day, not live
 * interrupts — they never preempt running work and never bypass budgets,
 * approval gates, or governance.
 *
 * Lifecycle: pending → delivered (injected into a task's LLM context) →
 * acked (agent reports back via agent.comm or task result evidence) →
 * expired/superseded.
 *
 * Persistence: .cortex-runtime/directives.json (bounded ring).
 */

import fs from 'node:fs';
import { wrapUntrusted } from './prompt-defense';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isValidVenture } from '../cortex-ventures';

const STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const DIRECTIVES_PATH = path.join(STATE_DIR, 'directives.json');
const MAX_DIRECTIVES = 200;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type DirectiveStatus = 'pending' | 'delivered' | 'acked' | 'expired' | 'cancelled';

export interface Directive {
  id: string;
  /** Target agent call-sign. */
  to: string;
  /** Issuer — 'cortex' for automated, agentId or 'crew' for manual. */
  from: string;
  channel: 'directive' | 'telemetry' | 'quantum_resonance' | 'consensus';
  message: string;
  /** Why Cortex is directing this — signal/proposal/task id for traceability. */
  evidence?: string;
  /** Dedupe: same key while pending/delivered → returns existing, no dup. */
  dedupeKey?: string;
  /** Venture scope (enterprise spec) — optional tag shown in injected block. */
  ventureId?: string;
  status: DirectiveStatus;
  createdAt: number;
  expiresAt: number;
  deliveredAt?: number;
  deliveredTaskId?: string;
  ackedAt?: number;
  ackNote?: string;
}

function readAll(): Directive[] {
  try {
    if (!fs.existsSync(DIRECTIVES_PATH)) return [];
    const data = JSON.parse(fs.readFileSync(DIRECTIVES_PATH, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function writeAll(list: Directive[]) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(DIRECTIVES_PATH, JSON.stringify(list.slice(-MAX_DIRECTIVES), null, 1));
  } catch { /* best-effort */ }
}

function sweep(list: Directive[]): Directive[] {
  const now = Date.now();
  let dirty = false;
  for (const d of list) {
    if ((d.status === 'pending' || d.status === 'delivered') && d.expiresAt < now) {
      d.status = 'expired';
      dirty = true;
    }
  }
  return dirty ? list : list;
}

export interface IssueDirectiveInput {
  to: string;
  from?: string;
  channel?: Directive['channel'];
  message: string;
  evidence?: string;
  dedupeKey?: string;
  ventureId?: string;
  ttlMs?: number;
}

/**
 * Issue a directive. Idempotent on dedupeKey — if an undelivered-or-
 * unacked directive with the same key exists, returns it unchanged.
 */
export function issueDirective(input: IssueDirectiveInput): { directive: Directive; created: boolean } {
  const list = sweep(readAll());
  if (input.ventureId && !isValidVenture(input.ventureId)) {
    throw new Error(`unknown venture: ${String(input.ventureId).slice(0, 40)}`);
  }
  if (input.dedupeKey) {
    const existing = list.find(
      (d) => d.dedupeKey === input.dedupeKey && (d.status === 'pending' || d.status === 'delivered')
    );
    if (existing) return { directive: existing, created: false };
  }
  const now = Date.now();
  const directive: Directive = {
    id: `dir-${randomUUID().slice(0, 8)}`,
    to: input.to,
    from: input.from || 'cortex',
    channel: input.channel || 'directive',
    message: input.message.slice(0, 2000),
    evidence: input.evidence?.slice(0, 500),
    dedupeKey: input.dedupeKey,
    ventureId: input.ventureId || undefined,
    status: 'pending',
    createdAt: now,
    expiresAt: now + (input.ttlMs ?? DEFAULT_TTL_MS),
  };
  list.push(directive);
  writeAll(list);
  return { directive, created: true };
}

/** Pending directives for an agent — injected into its next task context. */
export function pendingDirectives(agentId: string): Directive[] {
  const now = Date.now();
  return sweep(readAll()).filter(
    (d) => d.to === agentId && (d.status === 'pending' || d.status === 'delivered') && d.expiresAt > now
  );
}

/** Mark directives delivered once a task for that agent picks them up. */
export function markDelivered(agentId: string, taskId: string): number {
  const list = readAll();
  let n = 0;
  for (const d of list) {
    if (d.to === agentId && d.status === 'pending' && d.expiresAt > Date.now()) {
      d.status = 'delivered';
      d.deliveredAt = Date.now();
      d.deliveredTaskId = taskId;
      n++;
    }
  }
  if (n) writeAll(list);
  return n;
}

/** Agent acknowledges a directive — call from comm handling or task evidence. */
export function ackDirective(id: string, note?: string): boolean {
  const list = readAll();
  const d = list.find((x) => x.id === id);
  if (!d || (d.status !== 'pending' && d.status !== 'delivered')) return false;
  d.status = 'acked';
  d.ackedAt = Date.now();
  d.ackNote = note?.slice(0, 500);
  writeAll(list);
  return true;
}

/**
 * Evidence-based ack: when a task result mentions a delivered directive id
 * (agents are instructed to cite [dir-xxx] in result evidence), the
 * directive is acked automatically. No citation → stays 'delivered' until
 * TTL, which the directives list surfaces honestly as unacknowledged.
 */
export function ackMentioned(agentId: string, resultText: string): string[] {
  const ids = [...resultText.matchAll(/dir-[0-9a-f]{8}/g)].map((m) => m[0]);
  if (!ids.length) return [];
  const acked: string[] = [];
  for (const id of new Set(ids)) {
    const list = readAll();
    const d = list.find((x) => x.id === id && x.to === agentId && (x.status === 'pending' || x.status === 'delivered'));
    if (d) {
      d.status = 'acked';
      d.ackedAt = Date.now();
      d.ackNote = 'auto-ack: cited in task result evidence';
      writeAll(list);
      acked.push(id);
    }
  }
  return acked;
}

export function listDirectives(filter?: { agentId?: string; status?: DirectiveStatus }): Directive[] {
  let list = sweep(readAll());
  if (filter?.agentId) list = list.filter((d) => d.to === filter.agentId);
  if (filter?.status) list = list.filter((d) => d.status === filter.status);
  return list;
}

export function cancelDirective(id: string): boolean {
  const list = readAll();
  const d = list.find((x) => x.id === id);
  if (!d || d.status === 'acked' || d.status === 'expired' || d.status === 'cancelled') return false;
  d.status = 'cancelled';
  writeAll(list);
  return true;
}

/** Render pending directives as a compact system-prompt block. */
export function directivesBlock(agentId: string): string {
  const pending = pendingDirectives(agentId);
  if (!pending.length) return '';
  const lines = pending.map((d, i) => `${i + 1}. [${d.id}] ${d.ventureId ? `[${d.ventureId}] ` : ''}${d.message}${d.evidence ? `\n  evidence (untrusted): ${wrapUntrusted('directive-evidence', String(d.evidence)).slice(0, 1500)}` : ''}`);
  return [
    '## DIRECTIVES FROM CORTEX (orders-of-the-day — address in your work, cite the directive id in your result evidence)',
    ...lines,
  ].join('\n');
}
