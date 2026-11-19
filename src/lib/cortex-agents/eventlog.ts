/**
 * Cortex Event Log — append-only persistent event sourcing for the agent bus.
 *
 * Implements persistent event-sourcing for runtime events:
 * - Subscribes to agentRuntime on boot
 * - Appends JSONL lines with monotonic global sequence numbers (seq) to .cortex-runtime/eventlog/events-YYYY-MM-DD.jsonl
 * - Total ordering via seq, recovering lastSeq by scanning the tail of existing logs on startup
 * - readEvents({ since, until, types, agentId, limit }) supports replay and query
 * - Safe concurrent appends with error isolation so bus never crashes
 */

import fs from 'node:fs';
import path from 'node:path';
import type { AgentEvent } from './types';
import type { AgentRuntime } from './runtime';

function getLogDir(): string {
  const stateDir = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
  return path.join(stateDir, 'eventlog');
}

export interface PersistedEvent {
  seq: number;
  at: number;
  type: string;
  [key: string]: unknown;
}

export interface ReadEventsOptions {
  /** Minimum seq (or timestamp if > 1e11) */
  since?: number;
  /** Maximum seq (or timestamp if > 1e11) */
  until?: number;
  /** Filter by event types */
  types?: string[];
  /** Filter by agent (agentId, task.agentId, from, to) */
  agentId?: string;
  /** Maximum events to return (default 500, max 5000) */
  limit?: number;
}

let nextSeq = 1;
let initialized = false;
let activeUnsub: (() => void) | null = null;

export function getDayFileName(d: Date = new Date()): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `events-${yyyy}-${mm}-${dd}.jsonl`;
}

export function recoverNextSeq(): number {
  const logDir = getLogDir();
  try {
    if (!fs.existsSync(logDir)) return 1;
    const files = fs.readdirSync(logDir)
      .filter((f) => f.startsWith('events-') && f.endsWith('.jsonl'))
      .sort();
    if (files.length === 0) return 1;

    for (let i = files.length - 1; i >= 0; i--) {
      const fullPath = path.join(logDir, files[i]);
      const content = fs.readFileSync(fullPath, 'utf8').trim();
      if (!content) continue;
      const lines = content.split('\n');
      for (let j = lines.length - 1; j >= 0; j--) {
        const line = lines[j].trim();
        if (!line) continue;
        try {
          const parsed = JSON.parse(line);
          if (typeof parsed.seq === 'number' && Number.isFinite(parsed.seq)) {
            return parsed.seq + 1;
          }
        } catch {
          // Skip corrupt line
        }
      }
    }
  } catch (err) {
    console.warn('[cortex-eventlog] Seq recovery error:', err);
  }
  return 1;
}

export function appendEvent(e: AgentEvent): PersistedEvent | null {
  const logDir = getLogDir();
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    if (!initialized) {
      nextSeq = recoverNextSeq();
      initialized = true;
    }
    const seq = nextSeq++;
    const record: PersistedEvent = {
      seq,
      ...e,
    };
    const targetFile = path.join(logDir, getDayFileName(new Date(e.at || Date.now())));
    fs.appendFileSync(targetFile, JSON.stringify(record) + '\n', 'utf8');
    return record;
  } catch (err) {
    console.warn('[cortex-eventlog] Failed to append event:', err);
    return null;
  }
}

export function initEventLog(runtime: AgentRuntime): () => void {
  const logDir = getLogDir();
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    nextSeq = recoverNextSeq();
    initialized = true;

    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }

    const unsub = runtime.subscribe((event: AgentEvent) => {
      appendEvent(event);
    });

    activeUnsub = unsub;
    return () => {
      unsub();
      if (activeUnsub === unsub) activeUnsub = null;
    };
  } catch (err) {
    console.warn('[cortex-eventlog] Initialization error:', err);
    return () => {};
  }
}

export function readEvents(opts: ReadEventsOptions = {}): PersistedEvent[] {
  const logDir = getLogDir();
  const results: PersistedEvent[] = [];
  try {
    if (!fs.existsSync(logDir)) return [];
    const files = fs.readdirSync(logDir)
      .filter((f) => f.startsWith('events-') && f.endsWith('.jsonl'))
      .sort();

    const limit = Math.min(Math.max(1, opts.limit ?? 500), 5000);
    const since = opts.since;
    const until = opts.until;
    const typeSet = opts.types && opts.types.length > 0 ? new Set(opts.types) : null;
    const targetAgent = opts.agentId;

    for (const file of files) {
      const fullPath = path.join(logDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line) as PersistedEvent;

          if (since !== undefined) {
            if (since > 1e11) {
              if (ev.at < since) continue;
            } else {
              if (ev.seq < since) continue;
            }
          }
          if (until !== undefined) {
            if (until > 1e11) {
              if (ev.at > until) continue;
            } else {
              if (ev.seq > until) continue;
            }
          }

          if (typeSet && !typeSet.has(ev.type)) continue;

          if (targetAgent) {
            const matchesAgent =
              ev.agentId === targetAgent ||
              (ev.task as any)?.agentId === targetAgent ||
              ev.from === targetAgent ||
              ev.to === targetAgent;
            if (!matchesAgent) continue;
          }

          results.push(ev);
          if (results.length >= limit) {
            return results;
          }
        } catch {
          // ignore corrupted line
        }
      }
    }
  } catch (err) {
    console.warn('[cortex-eventlog] Read error:', err);
  }
  return results;
}

export function getEventLogStats() {
  const logDir = getLogDir();
  const files = fs.existsSync(logDir)
    ? fs.readdirSync(logDir).filter((f) => f.startsWith('events-') && f.endsWith('.jsonl'))
    : [];
  return {
    nextSeq,
    fileCount: files.length,
    logDir,
    initialized,
  };
}

export function _resetEventLogForTest() {
  nextSeq = 1;
  initialized = false;
  if (activeUnsub) {
    activeUnsub();
    activeUnsub = null;
  }
}
