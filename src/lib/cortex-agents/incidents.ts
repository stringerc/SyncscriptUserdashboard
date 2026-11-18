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
import { fileIncidentProposal } from './strategy-proposals';

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

export function listIncidents(status?: string): (Incident & { ageHours: number })[] {
  const all = readAll();
  const now = Date.now();
  const filtered = status ? all.filter((i) => i.status === status) : all;
  return filtered
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, 50)
    .map((i) => ({ ...i, ageHours: Math.floor((now - i.firstSeenAt) / 3600_000) }));
}

/** An incident open longer than this gets a STRATEGIST investigation
 *  proposal auto-filed — "untended" becomes tracked work, not silence.
 *  1 minute: a terminal failure has already exhausted its retries, so
 *  anything older than that is genuinely waiting on a decision. */
export const STALE_INCIDENT_MINUTES = 1;

/**
 * Escalation sweep — runs every 60s from the dev-server sweeper.
 * Every open incident older than STALE_INCIDENT_MINUTES files one
 * deduped proposal asking for investigation, unless the same
 * agent+kind already has a queued/running task (active retry work
 * means the incident is being tended, not abandoned).
 * Returns how many new proposals were filed.
 */
export function escalateStaleIncidents(
  isActive?: (agentId: string, kind: string) => boolean,
): number {
  try {
    const cutoff = Date.now() - STALE_INCIDENT_MINUTES * 60_000;
    let filed = 0;
    for (const inc of readAll()) {
      if (inc.status !== 'open' || inc.firstSeenAt > cutoff) continue;
      if (isActive?.(inc.agentId, inc.kind)) continue;
      if (fileIncidentProposal(inc)) filed++;
    }
    return filed;
  } catch { return 0; }
}

/** An incident with no new failure for this long is considered dormant.
 *  Default 24h — long enough that transient provider brownouts (which
 *  recur within minutes when real) don't get swept, short enough that a
 *  healed lane doesn't leave a permanently-open ticket. */
export const INCIDENT_TTL_HOURS = Number(process.env.CORTEX_INCIDENT_TTL_HOURS || 24);

/**
 * TTL sweep — resolves open incidents whose lastSeenAt is older than the
 * TTL. This is NOT execution-verified healing: the resolutionNote says so
 * honestly, and any recurrence reopens the ticket via recordIncidentFailure.
 * It exists because incidents keyed on retry-storm signatures (e.g. a dead
 * provider lane) never get a same-key success to verify against — without
 * a TTL they stay open forever and drown the board.
 * Returns how many incidents were auto-expired.
 */
export function sweepIncidentTtl(opts: { ttlHours?: number; now?: number } = {}): number {
  try {
    const ttlMs = (opts.ttlHours ?? INCIDENT_TTL_HOURS) * 3600_000;
    const now = opts.now ?? Date.now();
    const all = readAll();
    let changed = 0;
    for (const inc of all) {
      if (inc.status !== 'open') continue;
      const dormantByLastSeen = now - inc.lastSeenAt >= ttlMs;
      const staleInactive = (now - inc.firstSeenAt >= ttlMs) && (now - inc.lastSeenAt >= 2 * 3600_000);
      if (!dormantByLastSeen && !staleInactive) continue;
      inc.status = 'resolved';
      inc.resolvedAt = now;
      inc.resolutionNote = dormantByLastSeen
        ? `auto-expired: no recurrence for ${Math.round(ttlMs / 3600_000)}h — unverified heal, reopens on failure`
        : `auto-expired: stale incident (>24h old, inactive for >2h) — unverified heal, reopens on failure`;
      changed++;
    }
    if (changed) writeAll(all);
    return changed;
  } catch { return 0; }
}

/** Dismiss an open incident ticket manually with an optional operator note. */
export function dismissIncident(idOrKey: string, note?: string): boolean {
  try {
    const all = readAll();
    const inc = all.find((i) => i.id === idOrKey || i.key === idOrKey);
    if (!inc || inc.status === 'dismissed') return false;
    inc.status = 'dismissed';
    inc.resolvedAt = Date.now();
    inc.resolutionNote = note || 'manually dismissed by operator';
    writeAll(all);
    return true;
  } catch { return false; }
}

/** Dismiss all or targeted open incident tickets in bulk. */
export function dismissAllIncidents(ids?: string[], note?: string): number {
  try {
    const all = readAll();
    let count = 0;
    const now = Date.now();
    const defaultNote = note || 'bulk dismissed by operator';
    const idSet = ids ? new Set(ids) : null;
    for (const inc of all) {
      if (inc.status === 'open' && (!idSet || idSet.has(inc.id) || idSet.has(inc.key))) {
        inc.status = 'dismissed';
        inc.resolvedAt = now;
        inc.resolutionNote = defaultNote;
        count++;
      }
    }
    if (count > 0) writeAll(all);
    return count;
  } catch { return 0; }
}

/**
 * Dispatch an active verification probe task to test and heal an incident.
 * When the dispatched task completes successfully, runtime resolution hooks
 * automatically transition the incident ticket to resolved.
 */
export function autoVerifyIncident(
  runtime: { submitTask: (agentId: string, kind: string, title: string, input?: any) => { ok: boolean; task?: any; error?: string } },
  idOrKey: string,
): { ok: boolean; taskId?: string; error?: string } {
  try {
    const all = readAll();
    const inc = all.find((i) => i.id === idOrKey || i.key === idOrKey);
    if (!inc) return { ok: false, error: 'incident not found' };

    const targetKind = inc.agentId === 'warden' ? 'patrol' : inc.kind;
    const input: Record<string, unknown> = {
      autoVerifyIncidentId: inc.id,
      probeKind: inc.kind,
      failureClass: inc.failureClass,
    };
    if (inc.agentId === 'runner' && inc.kind === 'incident-verify') {
      input.command = 'echo "incident verification probe"';
    }

    const t = runtime.submitTask(
      inc.agentId,
      targetKind,
      `Probe & verify: ${inc.title}`.slice(0, 120),
      input,
    );
    if (t.ok && t.task) {
      return { ok: true, taskId: t.task.id };
    }
    return { ok: false, error: t.error || 'task dispatch failed' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'unknown verify error' };
  }
}
