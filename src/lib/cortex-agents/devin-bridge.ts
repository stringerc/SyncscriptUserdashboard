/**
 * Devin Bridge — governed delegation to real Devin sessions via API v3.
 *
 * Verified surface (docs.devin.ai, probed live 2026-11-16):
 *   POST /v3/organizations/{org}/sessions              → create
 *   GET  /v3/organizations/{org}/sessions/{id}         → status/detail/PRs
 *   POST /v3/organizations/{org}/sessions/{id}/messages→ message (resume)
 *
 * Design contract:
 * - LAUNCHED ≠ FINISHED. The worker returns at launch; a 60s poller
 *   tracks terminal states and records evidence in the session ledger.
 * - bypass_approval is NEVER set — Devin's own approval gates stay on.
 * - Daily session cap (ACU spend control) enforced before every create.
 * - All state durable in .cortex-runtime/devin-sessions.json.
 */
import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'https://api.devin.ai';
const RUNTIME_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const LEDGER_FILE = path.join(RUNTIME_DIR, 'devin-sessions.json');
const MAX_SESSIONS_PER_DAY = Math.max(1, Number(process.env.CORTEX_DEVIN_MAX_SESSIONS_PER_DAY || 4));
const SESSION_TTL_MS = Math.max(30 * 60_000, Number(process.env.CORTEX_DEVIN_SESSION_TTL_MS || 4 * 60 * 60_000));

export interface DevinSessionRecord {
  taskId: string;
  kind: 'devin_ask' | 'devin_task';
  devinId: string;
  url: string;
  title: string;
  status: string;
  statusDetail: string | null;
  pullRequests: string[];
  structuredOutput: unknown;
  createdAt: number;
  updatedAt: number;
  lastPollAt: number;
  finishedAt: number | null;
  /** Set when an ask-session was nudged to conclude (waiting_for_user). */
  nudgedAt?: number;
  terminal: 'finished' | 'failed' | 'expired' | null;
  error?: string;
}

interface Ledger { sessions: DevinSessionRecord[] }

function readLedger(): Ledger {
  try {
    const j = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
    return { sessions: Array.isArray(j?.sessions) ? j.sessions : [] };
  } catch { return { sessions: [] }; }
}

function writeLedger(l: Ledger) {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const tmp = LEDGER_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(l, null, 2));
  fs.renameSync(tmp, LEDGER_FILE);
}

export function devinConfig() {
  const key = process.env.DEVIN_API_KEY_COG || process.env.DEVIN_API_KEY || '';
  const org = process.env.DEVIN_ORG_ID || '';
  return { key, org, configured: Boolean(key && org) };
}

export class DevinApiError extends Error {
  constructor(public status: number, message: string, public retryable = false) { super(message); }
}

async function apiFetch<T>(method: string, apiPath: string, body?: unknown): Promise<T> {
  const { key, org } = devinConfig();
  if (!key || !org) throw new DevinApiError(0, 'devin bridge not configured (DEVIN_API_KEY + DEVIN_ORG_ID)');
  const res = await fetch(`${API_BASE}/v3/organizations/${org}${apiPath}`, {
    method,
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = j?.detail || j?.title || `devin api http ${res.status}`;
    throw new DevinApiError(res.status, String(msg), res.status === 429 || res.status >= 500);
  }
  return j as T;
}

interface ApiSession {
  session_id: string;
  url?: string;
  status?: string;
  status_detail?: string | null;
  pull_requests?: { url?: string; pr_url?: string }[] | string[];
  structured_output?: unknown;
  acus_consumed?: number;
}

const TERMINAL_STATUSES = new Set(['finished', 'expired', 'stopped', 'exit', 'suspended']);
const TERMINAL_DETAILS = new Set(['error', 'contract_expired', 'usage_limit_exceeded', 'total_session_limit_exceeded', 'out_of_credits', 'payment_declined']);

function mapSession(s: ApiSession): Pick<DevinSessionRecord, 'status' | 'statusDetail' | 'pullRequests' | 'structuredOutput' | 'terminal'> {
  const status = String(s.status || 'unknown');
  const detail = s.status_detail ?? null;
  const prs = (s.pull_requests || []).map((p: any) => String(p?.url || p?.pr_url || p)).filter(Boolean);
  let terminal: DevinSessionRecord['terminal'] = null;
  if (TERMINAL_DETAILS.has(String(detail))) terminal = 'failed';
  else if (status === 'finished' || status === 'expired') terminal = status === 'finished' ? 'finished' : 'expired' as any;
  else if (TERMINAL_STATUSES.has(status) && detail === 'inactivity') terminal = 'finished'; // suspended after work done
  return { status, statusDetail: detail, pullRequests: prs, structuredOutput: s.structured_output ?? null, terminal };
}

function sessionsToday(l: Ledger): number {
  const dayStart = new Date().setUTCHours(0, 0, 0, 0);
  return l.sessions.filter((s) => s.createdAt >= dayStart).length;
}

/** Launch a Devin session. Returns the ledger record. Throws DevinApiError. */
export async function launchDevinSession(opts: {
  taskId: string; kind: 'devin_ask' | 'devin_task'; title: string;
  prompt: string; tags?: string[];
}): Promise<DevinSessionRecord> {
  const { configured } = devinConfig();
  if (!configured) throw new DevinApiError(0, 'devin bridge not configured');
  const l = readLedger();
  if (sessionsToday(l) >= MAX_SESSIONS_PER_DAY)
    throw new DevinApiError(0, `devin daily session cap reached (${MAX_SESSIONS_PER_DAY}/day)`);

  const created = await apiFetch<ApiSession>('POST', '/sessions', {
    prompt: opts.prompt,
    title: opts.title.slice(0, 200),
    tags: [...(opts.tags || []), `cortex:${opts.taskId}`, `cortex-kind:${opts.kind}`],
    bypass_approval: false,
  });
  const mapped = mapSession(created);
  const rec: DevinSessionRecord = {
    taskId: opts.taskId, kind: opts.kind,
    devinId: created.session_id, url: created.url || `https://app.devin.ai/sessions/${created.session_id}`,
    title: opts.title.slice(0, 200),
    ...mapped,
    createdAt: Date.now(), updatedAt: Date.now(), lastPollAt: 0,
    finishedAt: null,
  };
  l.sessions.push(rec);
  writeLedger(l);
  return rec;
}

export interface PollTransition {
  record: DevinSessionRecord;
  changed: boolean;
  justFinished: boolean;
}

/** Poll all non-terminal sessions once. Returns transitions for the caller to emit/archive. */
export async function pollDevinSessions(): Promise<PollTransition[]> {
  const l = readLedger();
  const out: PollTransition[] = [];
  const open = l.sessions.filter((s) => !s.terminal);
  for (const rec of open) {
    // Stale guard: a session open past TTL is an incident, not infinite polling.
    if (Date.now() - rec.createdAt > SESSION_TTL_MS) {
      rec.terminal = 'failed';
      rec.error = `session exceeded TTL ${Math.round(SESSION_TTL_MS / 60000)}m`;
      rec.finishedAt = Date.now();
      rec.updatedAt = Date.now();
      out.push({ record: { ...rec }, changed: true, justFinished: true });
      continue;
    }
    try {
      const s = await apiFetch<ApiSession>('GET', `/sessions/${rec.devinId}`);
      const mapped = mapSession(s);
      // Ask-sessions end in waiting_for_user, not a terminal state — nudge
      // once to conclude, then the suspended/inactivity mapping finishes it.
      if (rec.kind === 'devin_ask' && mapped.statusDetail === 'waiting_for_user' && !rec.nudgedAt) {
        try {
          await sendDevinMessage(rec.devinId, 'Please provide your final answer now and conclude the session.');
          rec.nudgedAt = Date.now();
        } catch { /* nudge is best-effort */ }
      }
      const changed = mapped.status !== rec.status || mapped.statusDetail !== rec.statusDetail;
      Object.assign(rec, mapped, { updatedAt: Date.now(), lastPollAt: Date.now() });
      if (rec.terminal && !rec.finishedAt) rec.finishedAt = Date.now();
      out.push({ record: { ...rec }, changed, justFinished: Boolean(rec.terminal && changed) });
    } catch (e: any) {
      // API failure on poll ≠ session failure — record but keep polling.
      rec.error = String(e?.message || e).slice(0, 200);
      rec.updatedAt = Date.now();
      out.push({ record: { ...rec }, changed: false, justFinished: false });
    }
  }
  writeLedger(l);
  return out;
}

export function listDevinSessions(status?: string): DevinSessionRecord[] {
  const l = readLedger();
  return status ? l.sessions.filter((s) => s.terminal === status || s.status === status) : l.sessions;
}

export async function sendDevinMessage(devinId: string, message: string) {
  return apiFetch('POST', `/sessions/${devinId}/messages`, { message });
}
