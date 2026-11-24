/**
 * Continuity Kernel — durable cross-session memory for Cortex turns.
 *
 * The chat transcript already persists client-side (localStorage +
 * /api/cortex/chat-history) and the Intentions ledger persists pending
 * offers — but the *server* had no durable record of what was said
 * across sessions, and the episodic-continuity engine's Node backing
 * (persistentStore) is an in-process Map that dies with the dev server.
 *
 * This ledger lives at .cortex-runtime/continuity.json and records a
 * compact turn digest per session: timestamp, truncated user/ai text.
 * It powers the [SESSION CONTINUITY] brief injected into the system
 * prompt when a session starts cold (new sessionId or thin client
 * history) — so Cortex never has to ask "where were we?" after a
 * reload, restart, or fresh tab.
 *
 * Privacy/scope: only the last TURNS_PER_SESSION exchanges per session
 * and SESSIONS_MAX sessions are kept. No tool args, no file contents —
 * just conversational digests.
 */

import fs from 'node:fs';
import path from 'node:path';
import { peekPending } from './intentions';

const RUNTIME_DIR = path.resolve(process.cwd(), '.cortex-runtime');
const STATE_FILE = path.join(RUNTIME_DIR, 'continuity.json');

const TURNS_PER_SESSION = 30;
const SESSIONS_MAX = 20;
const USER_CLIP = 140;
const AI_CLIP = 220;
const TOPICS_MAX = 4;

export interface ContinuityTurn {
  ts: number;
  user: string;
  ai: string;
}

interface SessionContinuity {
  lastActiveAt: number;
  turns: ContinuityTurn[];
}

interface ContinuityState {
  sessions: Record<string, SessionContinuity>;
  /** Session id that produced the most recent recorded turn — used to
   *  detect "a different surface/tab picked up the conversation". */
  lastSessionId: string | null;
}

function clip(s: string, n: number): string {
  const clean = String(s || '').replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}

function loadState(): ContinuityState {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && parsed.sessions && typeof parsed.sessions === 'object') {
      return {
        sessions: parsed.sessions,
        lastSessionId: typeof parsed.lastSessionId === 'string' ? parsed.lastSessionId : null,
      };
    }
  } catch { /* missing/corrupt — start fresh */ }
  return { sessions: {}, lastSessionId: null };
}

function saveState(state: ContinuityState): void {
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    // Bound total size: evict oldest sessions beyond SESSIONS_MAX.
    const ids = Object.keys(state.sessions);
    if (ids.length > SESSIONS_MAX) {
      ids.sort((a, b) => (state.sessions[a]?.lastActiveAt || 0) - (state.sessions[b]?.lastActiveAt || 0));
      for (const id of ids.slice(0, ids.length - SESSIONS_MAX)) delete state.sessions[id];
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch { /* non-fatal — continuity is best-effort */ }
}

function ago(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 90) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 90) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Record a completed conversational turn. Called once per nexus-guest
 * turn after the final assistant text is known. Cheap: one JSON write.
 */
export function recordContinuityTurn(sessionId: string, userMsg: string, aiText: string): void {
  const sid = String(sessionId || 'cortex-shared').slice(0, 80);
  if (!userMsg && !aiText) return;
  const state = loadState();
  const sess = state.sessions[sid] || { lastActiveAt: 0, turns: [] };
  sess.turns.push({ ts: Date.now(), user: clip(userMsg, USER_CLIP), ai: clip(aiText, AI_CLIP) });
  if (sess.turns.length > TURNS_PER_SESSION) sess.turns = sess.turns.slice(-TURNS_PER_SESSION);
  sess.lastActiveAt = Date.now();
  state.sessions[sid] = sess;
  state.lastSessionId = sid;
  saveState(state);
}

/**
 * Build the warm-start brief injected into the system prompt.
 *
 * Returns null when continuity adds nothing (same session continuing
 * with a healthy client-side transcript). Injects when:
 *  - the client sent thin history (< THIN_HISTORY) — fresh tab/device
 *  - this sessionId has never been seen by the ledger (new identity)
 *  - the most recent turn globally came from a DIFFERENT sessionId
 *    (another surface/tab was talking — worth a one-line handoff note)
 */
export function getContinuityBrief(sessionId: string, clientMsgCount: number): string | null {
  const sid = String(sessionId || 'cortex-shared').slice(0, 80);
  const state = loadState();
  const sess = state.sessions[sid];
  const thinHistory = clientMsgCount < 8;
  const unseenSession = !sess || sess.turns.length === 0;
  const foreignLast = !!state.lastSessionId && state.lastSessionId !== sid;

  if (!thinHistory && !unseenSession && !foreignLast) return null;

  const lines: string[] = ['[SESSION CONTINUITY — durable memory across restarts]'];

  // Most recent activity anywhere — grounds "when did we last talk".
  let newest: { sid: string; ts: number } | null = null;
  for (const [id, s] of Object.entries(state.sessions)) {
    if (s.lastActiveAt && (!newest || s.lastActiveAt > newest.ts)) newest = { sid: id, ts: s.lastActiveAt };
  }
  if (newest) {
    lines.push(`Last conversation activity: ${ago(newest.ts)}${newest.sid === sid ? ' (this session)' : ' (another surface/tab)'}.`);
  }

  // This session's recent exchanges — the "where were we" answer.
  if (sess && sess.turns.length) {
    const recent = sess.turns.slice(-4);
    lines.push(`Recent exchanges in this session (${sess.turns.length} recorded; digests are clipped — treat details as approximate, age shown per turn):`);
    for (const t of recent) {
      lines.push(`- [${ago(t.ts)}] user: "${t.user}" → cortex: "${t.ai}"`);
    }
  } else {
    // New identity — borrow the global tail so the model still has context.
    const all: { sid: string; turn: ContinuityTurn }[] = [];
    for (const [id, s] of Object.entries(state.sessions)) {
      for (const t of s.turns.slice(-3)) all.push({ sid: id, turn: t });
    }
    all.sort((a, b) => a.turn.ts - b.turn.ts);
    const tail = all.slice(-4);
    if (tail.length) {
      lines.push('No prior turns recorded for this session identity — most recent exchanges elsewhere (digests clipped, ages shown):');
      for (const { turn: t } of tail) {
        lines.push(`- [${ago(t.ts)}] user: "${t.user}" → cortex: "${t.ai}"`);
      }
    }
  }

  // Pending intention for this session — "go ahead" may still be live.
  try {
    const pending = peekPending(sid);
    if (pending) {
      lines.push(`Pending intention awaiting affirmation: "${pending.tool}" — if the user says yes/go ahead, execute it.`);
    }
  } catch { /* intentions optional */ }

  lines.push('Use this to continue seamlessly — do not ask "where were we?" unless genuinely ambiguous.');
  return lines.join('\n');
}
