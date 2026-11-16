/**
 * Task archive — durable evidence layer for agent work.
 *
 * In-memory task state caps at ~200 entries for the UI; research briefs,
 * specs, and failure evidence would otherwise evict within hours. Every
 * terminal task appends one compact JSONL record here so STRATEGIST,
 * distillation, and the dossier RECORD zone can read full history.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { AgentTask } from './types';

const STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const ARCHIVE_PATH = path.join(STATE_DIR, 'task-archive.jsonl');
const RESULT_CAP = 8192;

export interface TaskArchiveRecord {
  id: string;
  agentId: string;
  agentName?: string;
  kind: string;
  title: string;
  status: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
  model?: string;
  error?: string;
  telemetry?: Record<string, unknown> | null;
  /** Result payload capped — briefs/specs survive eviction. */
  result?: unknown;
  input?: Record<string, unknown>;
}

function capResult(result: unknown): unknown {
  if (result == null) return undefined;
  try {
    const s = JSON.stringify(result);
    if (s.length <= RESULT_CAP) return result;
    return { _truncated: true, preview: s.slice(0, RESULT_CAP) };
  } catch {
    return { _unserializable: true };
  }
}

/** Append one terminal-task record. Never throws — archiving must not
 *  break the runtime hook chain. */
export function archiveTask(task: AgentTask, agentName?: string): void {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const rec: TaskArchiveRecord = {
      id: task.id,
      agentId: task.agentId,
      agentName,
      kind: task.kind,
      title: task.title,
      status: task.status,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
      durationMs: task.telemetry?.durationMs ?? (task.startedAt && task.finishedAt ? task.finishedAt - task.startedAt : undefined),
      model: task.model,
      error: task.error ? String(task.error).slice(0, 300) : undefined,
      telemetry: task.telemetry ? { ...task.telemetry } : null,
      result: capResult(task.result),
      input: task.input && typeof task.input === 'object' ? task.input as Record<string, unknown> : undefined,
    };
    fs.appendFileSync(ARCHIVE_PATH, JSON.stringify(rec) + '\n');
  } catch { /* archive is best-effort */ }
}

export interface ArchiveQuery {
  agentId?: string;
  kind?: string;
  status?: string;
  limit?: number;
  since?: number;
}

/** Read the tail of the archive, newest first, with optional filters. */
export function readArchive(query: ArchiveQuery = {}): TaskArchiveRecord[] {
  try {
    if (!fs.existsSync(ARCHIVE_PATH)) return [];
    const lines = fs.readFileSync(ARCHIVE_PATH, 'utf-8').split('\n').filter(Boolean);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
    const out: TaskArchiveRecord[] = [];
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      try {
        const rec = JSON.parse(lines[i]) as TaskArchiveRecord;
        if (query.agentId && rec.agentId !== query.agentId) continue;
        if (query.kind && rec.kind !== query.kind) continue;
        if (query.status && rec.status !== query.status) continue;
        if (query.since && (rec.finishedAt ?? rec.createdAt) < query.since) continue;
        out.push(rec);
      } catch { /* skip malformed line */ }
    }
    return out;
  } catch {
    return [];
  }
}
