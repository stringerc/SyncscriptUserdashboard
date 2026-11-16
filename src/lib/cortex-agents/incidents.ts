/**
 * Incident tickets — first-class failure tracking for the fleet.
 *
 * Every terminal task failure upserts an incident keyed by
 * agent|failureClass|kind: recurring signatures accumulate evidence
 * instead of scattering across the archive. A ticket auto-resolves when
 * a later task with the same signature completes — resolution is
 * verified by execution, not by elapsed time or a human saying so.
 *
 * Durable JSON (survives restarts). The Inbox renders open incidents;
 * fixes still flow through strategy proposals — incidents are the
 * ledger that answers "did it fail, and did anything actually fix it?"
 */

import fs from 'node:fs';
import path from 'node:path';

const STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const INCIDENTS_PATH = path.join(STATE_DIR, 'incidents.json');
const MAX_INCIDENTS = 100;
const MAX_EVIDENCE = 10;

export interface Incident {
  id: string;
  /** Dedup key: agentId|failureClass|kind */
  key: string;
  agentId: string;
  agentName?: string;
  kind: string;
  failureClass: string;
  title: string;
  status: 'open' | 'resolved' | 'dismissed';
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastTaskId?: string;
  lastError?: string;
  /** Recent failed task ids — the evidence trail. */
  evidence: string[];
  resolvedAt?: number;
  resolutionNote?: string;
}

function readAll(): Incident[] {
  try {
    if (!fs.existsSync(INCIDENTS_PATH)) return [];
    const data = JSON.parse(fs.readFileSync(INCIDENTS_PATH, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function writeAll(list: Incident[]) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(INCIDENTS_PATH, JSON.stringify(list.slice(-MAX_INCIDENTS), null, 1));
  } catch { /* best-effort */ }
}

const incidentKey = (agentId: string, failureClass: string, kind: string) =>
  `${agentId}|${failureClass}|${kind}`;

/** Upsert on task failure. Recurring signatures accumulate count+evidence;
 *  a resolved incident that fails again reopens with count preserved. */
export function recordIncidentFailure(opts: {
  taskId: string;
  agentId: string;
  agentName?: string;
  kind: string;
  title: string;
  failureClass: string;
  error?: string;
}): Incident | null {
  try {
    const all = readAll();
    const key = incidentKey(opts.agentId, opts.failureClass, opts.kind);
    let inc = all.find((i) => i.key === key);
    if (inc) {
      inc.count += 1;
      inc.lastSeenAt = Date.now();
      inc.lastTaskId = opts.taskId;
      inc.lastError = opts.error ? String(opts.error).slice(0, 300) : inc.lastError;
      inc.title = opts.title;
      if (inc.status !== 'open') {
        inc.status = 'open';
        inc.resolvedAt = undefined;
        inc.resolutionNote = undefined;
      }
      if (!inc.evidence.includes(opts.taskId)) {
        inc.evidence.push(opts.taskId);
        if (inc.evidence.length > MAX_EVIDENCE) inc.evidence.shift();
      }
    } else {
      inc = {
        id: `inc-${key.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}-${Date.now().toString(36)}`,
        key, agentId: opts.agentId, agentName: opts.agentName,
        kind: opts.kind, failureClass: opts.failureClass, title: opts.title,
        status: 'open', count: 1,
        firstSeenAt: Date.now(), lastSeenAt: Date.now(),
        lastTaskId: opts.taskId, lastError: opts.error ? String(opts.error).slice(0, 300) : undefined,
        evidence: [opts.taskId],
      };
      all.push(inc);
    }
    writeAll(all);
    return inc;
  } catch { return null; }
}

/** Auto-resolve: a completed task with the same agent+kind signature is
 *  execution-verified proof the failure mode is gone. Resolves ALL open
 *  incidents for that signature (any failure class). */
export function resolveIncidentsOnSuccess(agentId: string, kind: string, taskId: string): number {
  try {
    const all = readAll();
    const note = `verified by completed task ${taskId}`;
    let changed = 0;
    for (const inc of all) {
      if (inc.status === 'open' && inc.agentId === agentId && inc.kind === kind) {
        inc.status = 'resolved';
        inc.resolvedAt = Date.now();
        inc.resolutionNote = note;
        changed++;
      }
    }
    if (changed) writeAll(all);
    return changed;
  } catch { return 0; }
}

export function listIncidents(status?: string): Incident[] {
  const all = readAll();
  const filtered = status ? all.filter((i) => i.status === status) : all;
  return filtered.sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 50);
}
