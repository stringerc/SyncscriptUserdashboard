/**
 * Libet veto window — the gap between "I am about to act" and "I act".
 *
 * Autonomous dispatchers (schedulers, watchdogs, reconciler relaunches)
 * call armVeto() instead of submitTask() directly. The intent is
 * persisted and a short window opens during which Cortex (or the user,
 * via /api/cortex/libet/veto) can cancel it — the engineering analogue
 * of the readiness potential being vetoed before movement.
 *
 * Vetoed intents are logged as 'vetoed'; fired intents log 'fired'.
 * Nothing here auto-approves governed work — it only delays *already
 * authorized* autonomous dispatch by a few seconds.
 */
import fs from 'node:fs';
import path from 'node:path';
import { speakInner } from './inner-speech';
import { getInteroceptiveState, interoceptiveGate } from './interoceptive';

const DIR = path.join(process.cwd(), '.cortex-runtime');
const FILE = path.join(DIR, 'libet-veto.json');
const LOG = path.join(DIR, 'libet-veto-log.jsonl');
const MAX_PENDING = 50;
const DEFAULT_WINDOW_MS = 4_000;

export interface VetoIntent {
  id: string;
  agentId: string;
  kind: string;
  title: string;
  reason: string;
  armedAt: number;
  fireAt: number;
  vetoWindowMs: number;
  /** Dispatch payload — amendable during the window, read at fire time. */
  input?: Record<string, unknown>;
  /** Body state at arm time — somatic marker for the decision gap. */
  armedCapacity?: number;
  /** Who armed this — 'self' (autonomous) vs 'external' (API/user). */
  origin?: 'self' | 'external';
  status: 'pending' | 'fired' | 'vetoed';
  resolvedAt?: number;
  resolvedBy?: string;
}

interface VetoState { pending: VetoIntent[]; fired: VetoIntent[] }

function load(): VetoState {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { pending: [], fired: [] }; }
}
function save(s: VetoState) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(s));
  } catch {}
}
function log(entry: Record<string, unknown>) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(LOG, JSON.stringify({ ts: Date.now(), ...entry }) + '\n');
  } catch {}
}

const timers = new Map<string, NodeJS.Timeout>();

/** Arm a dispatch intent. `fire` runs the real submitTask — only called
 *  if the window expires without a veto. Returns the intent id. */
export function armVeto(opts: {
  agentId: string; kind: string; title: string;
  reason: string; windowMs?: number;
  input?: Record<string, unknown>;
  origin?: 'self' | 'external';
  /** Receives the intent AT FIRE TIME — amendments made during the
   *  veto window are honored because fire reads the live record. */
  fire: (intent: VetoIntent) => unknown;
}): string {
  const now = Date.now();
  const id = `libet-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const windowMs = Math.max(500, Math.min(30_000, opts.windowMs ?? DEFAULT_WINDOW_MS));
  let armCapacity: number | undefined;
  try { armCapacity = getInteroceptiveState().capacity; } catch {}
  const intent: VetoIntent = {
    id, agentId: opts.agentId, kind: opts.kind, title: opts.title.slice(0, 120),
    reason: opts.reason.slice(0, 160), armedAt: now, fireAt: now + windowMs,
    vetoWindowMs: windowMs, status: 'pending',
    input: opts.input ? { ...opts.input } : undefined,
    armedCapacity: armCapacity,
    origin: opts.origin || 'self',
  };
  const state = load();
  state.pending = state.pending.filter((p) => p.status === 'pending' && now - p.armedAt < 120_000);
  state.pending.push(intent);
  if (state.pending.length > MAX_PENDING) state.pending.splice(0, state.pending.length - MAX_PENDING);
  save(state);
  try {
    speakInner({ kind: 'veto', source: 'libet', text: `About to dispatch ${opts.agentId}/${opts.kind}: "${opts.title.slice(0, 60)}" — ${windowMs}ms veto window open`, surprise: 0.2, valence: 0 });
  } catch {}
  const scheduleFire = () => {
    timers.set(id, setTimeout(() => {
      const s = load();
      const i = s.pending.find((p) => p.id === id);
      if (!i || i.status !== 'pending') return;
      // Hold extension: if fireAt moved forward, reschedule.
      const remaining = i.fireAt - Date.now();
      if (remaining > 0) { scheduleFire(); return; }
      // Somatic marker: the body gets a vote at fire time. If vitals
      // have gone critical since arming, non-essential intents are
      // stopped by physiology, not policy — resolvedBy says who said no.
      const gate = interoceptiveGate(i.kind, i.title);
      if (!gate.allow) {
        i.status = 'vetoed'; i.resolvedAt = Date.now(); i.resolvedBy = 'somatic-marker';
        s.pending = s.pending.filter((p) => p.id !== id);
        s.fired.push(i);
        if (s.fired.length > 100) s.fired = s.fired.slice(-100);
        save(s);
        log({ event: 'somatic-veto', id, agentId: i.agentId, kind: i.kind, title: i.title, reason: gate.reason });
        try { speakInner({ kind: 'veto', source: 'somatic', text: `BODY VETOED ${i.agentId}/${i.kind}: "${i.title.slice(0, 50)}" — ${gate.reason}`, surprise: 0.7, valence: -0.5 }); } catch {}
        timers.delete(id);
        return;
      }
      i.status = 'fired'; i.resolvedAt = Date.now(); i.resolvedBy = 'window-expired';
    s.pending = s.pending.filter((p) => p.id !== id);
    s.fired.push(i);
    if (s.fired.length > 100) s.fired = s.fired.slice(-100);
    save(s);
    log({ event: 'fired', id, agentId: i.agentId, kind: i.kind, title: i.title });
    try { speakInner({ kind: 'veto', source: 'libet', text: `Veto window expired — dispatching ${i.agentId}/${i.kind}: "${i.title.slice(0, 60)}"`, surprise: 0.1, valence: 0 }); } catch {}
      try { opts.fire({ ...i }); } catch (e: any) { log({ event: 'fire-error', id, error: String(e?.message || e) }); }
      timers.delete(id);
    }, Math.max(50, i0fireAt() - Date.now())));
    timers.get(id)!.unref?.();
  };
  // fireAt lookup helper — the persisted record is source of truth
  function i0fireAt(): number {
    const i = load().pending.find((p) => p.id === id);
    return i ? i.fireAt : Date.now() + windowMs;
  }
  scheduleFire();
  return id;
}

/** Amend a pending intent — real override, not just a report.
 *  Changes agentId/kind/title/input on the persisted record; the fire
 *  callback reads it at fire time so amendments take effect. */
export function amendLibet(id: string, patch: { agentId?: string; kind?: string; title?: string; reason?: string; input?: Record<string, unknown> }, by = 'cortex'): boolean {
  const s = load();
  const i = s.pending.find((p) => p.id === id);
  if (!i) return false;
  const changes: string[] = [];
  if (patch.agentId && patch.agentId !== i.agentId) { changes.push(`agent ${i.agentId}→${patch.agentId}`); i.agentId = patch.agentId; }
  if (patch.kind && patch.kind !== i.kind) { changes.push(`kind ${i.kind}→${patch.kind}`); i.kind = patch.kind; }
  if (patch.title && patch.title !== i.title) { changes.push('title'); i.title = patch.title.slice(0, 120); }
  if (patch.reason) { i.reason = patch.reason.slice(0, 160); changes.push('reason'); }
  if (patch.input) { i.input = { ...(i.input || {}), ...patch.input }; changes.push('input'); }
  save(s);
  log({ event: 'amended', id, by, changes, agentId: i.agentId, kind: i.kind, title: i.title });
  try { speakInner({ kind: 'veto', source: 'libet', text: `AMENDED pending dispatch ${i.agentId}/${i.kind}: "${i.title.slice(0, 60)}" (${changes.join(', ')}) by ${by}`, surprise: 0.4, valence: 0.1 }); } catch {}
  return true;
}

/** Extend the veto window — pause the decision gap, don't just watch it. */
export function holdLibet(id: string, extraMs: number, by = 'cortex'): boolean {
  const s = load();
  const i = s.pending.find((p) => p.id === id);
  if (!i) return false;
  const cap = 120_000; // never hold beyond 2min total
  const maxFire = i.armedAt + cap;
  i.fireAt = Math.min(maxFire, i.fireAt + Math.max(0, Math.min(60_000, extraMs)));
  save(s);
  log({ event: 'held', id, by, fireAt: i.fireAt, msUntilFire: i.fireAt - Date.now() });
  try { speakInner({ kind: 'veto', source: 'libet', text: `HELD dispatch ${i.agentId}/${i.kind} — window extended to ${Math.round((i.fireAt - Date.now()) / 1000)}s by ${by}`, surprise: 0.3, valence: 0 }); } catch {}
  return true;
}

/** Veto a pending intent. Returns true if it was pending and is now cancelled. */
export function vetoLibet(id: string, by = 'cortex'): boolean {
  const s = load();
  const i = s.pending.find((p) => p.id === id);
  if (!i) return false;
  i.status = 'vetoed'; i.resolvedAt = Date.now(); i.resolvedBy = by;
  s.pending = s.pending.filter((p) => p.id !== id);
  s.fired.push(i);
  if (s.fired.length > 100) s.fired = s.fired.slice(-100);
  save(s);
  const t = timers.get(id);
  if (t) { clearTimeout(t); timers.delete(id); }
  log({ event: 'vetoed', id, by, agentId: i.agentId, kind: i.kind, title: i.title });
  try { speakInner({ kind: 'veto', source: 'libet', text: `VETOED ${i.agentId}/${i.kind}: "${i.title.slice(0, 60)}" — cancelled by ${by} before firing`, surprise: 0.5, valence: -0.2 }); } catch {}
  return true;
}

export function listLibetPending() {
  const now = Date.now();
  return load().pending
    .filter((p) => p.status === 'pending' && now < p.fireAt + 5_000)
    .map((p) => ({ ...p, msUntilFire: Math.max(0, p.fireAt - now) }));
}

export function libetTrace(limit = 20) {
  try {
    const lines = fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).slice(-limit);
    return lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/** Re-arm timers for intents persisted before a restart. */
export function resumeLibetTimers() {
  const s = load();
  const now = Date.now();
  for (const p of s.pending) {
    if (p.status !== 'pending') continue;
    const remaining = p.fireAt - now;
    if (remaining <= 0) { vetoLibet(p.id, 'restart-expired'); continue; }
    // Fire callbacks can't be reconstructed after restart — mark expired-safe.
    // Pending intents that survive a restart are vetoed rather than fired
    // blind: dispatch state is unknowable, so the safe default is cancel.
    vetoLibet(p.id, 'restart-interrupted');
  }
}
