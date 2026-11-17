/**
 * Cortex Counsel — the Go/No-Go deliberation layer.
 *
 * A counsel session convenes specialist "consoles" (IDE agents, internal
 * agents, human members) to file independent, evidence-attached positions
 * on a decision. STRATEGIST synthesizes the poll; the human holds GO/NO-GO.
 *
 * Invariants (CORTEX_COUNSEL_SPEC.md):
 *  - Advisory only: nothing here dispatches, approves, or mutates.
 *  - Evidence or Silence: positions without key_evidence are rejected.
 *  - Positions in round 1 are independent — members never see each
 *    other's positions until the rebuttal round opens.
 *  - Hard-lane sessions can never auto-clear.
 *  - Everything is append-only audited in counsel-log.jsonl.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const COUNSEL_DIR = path.join(STATE_DIR, 'counsel');
const SESSIONS_DIR = path.join(COUNSEL_DIR, 'sessions');
const POSITIONS_DIR = path.join(COUNSEL_DIR, 'positions');
const LOG_FILE = path.join(COUNSEL_DIR, 'counsel-log.jsonl');

const MAX_REASONING_CHARS = 400;
const MAX_EVIDENCE_ITEMS = 6;
const POSITION_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_DAILY_CAP = 3;
const SESSION_TTL_MS = 72 * 3600 * 1000;

// ── Types ───────────────────────────────────────────────────────────────────

export type CounselLane = 'contained' | 'reversible' | 'hard';
export type CounselStance = 'go' | 'no-go' | 'conditional';
export type CounselSessionStatus =
  | 'positions'      // round 1 open, collecting positions
  | 'rebuttal'       // round 1 complete, rebuttals invited
  | 'synthesis'      // awaiting STRATEGIST synthesis
  | 'poll'           // verdict rendered, awaiting human GO/NO-GO
  | 'cleared'        // human decided
  | 'expired'        // TTL passed without clearance
  | 'cancelled';

export interface CounselConsole {
  id: string;
  callSign: string;
  role: string;
  adapter: 'internal' | 'devin' | 'file-drop' | 'manual';
}

/** The console roster — Mission Control positions. */
export const COUNSEL_CONSOLES: CounselConsole[] = [
  { id: 'strategist', callSign: 'FLIGHT DIRECTOR', role: 'Synthesizes the poll', adapter: 'internal' },
  { id: 'antigravity', callSign: 'GUIDANCE', role: 'Architecture & strategy counsel', adapter: 'file-drop' },
  { id: 'devin', callSign: 'FLIGHT DYNAMICS', role: 'Engineering & verification counsel', adapter: 'devin' },
  { id: 'sentinel', callSign: 'EECOM', role: 'Compute/power & model-health counsel', adapter: 'internal' },
  { id: 'forecaster', callSign: 'FDO', role: 'Trajectory & forecast counsel', adapter: 'internal' },
  { id: 'warden', callSign: 'SURGEON', role: 'Quality & blast-radius counsel (read-only)', adapter: 'internal' },
  { id: 'user', callSign: 'CREW COMMANDER', role: 'Final GO/NO-GO authority', adapter: 'manual' },
];

export interface CounselPosition {
  member: string;
  stance: CounselStance;
  confidence: number; // 0..1
  keyEvidence: string[];
  risks: string[];
  requiredConditions: string[];
  reasoning: string;
  round: 1 | 2;
  filedAt: number;
}

export interface CounselSession {
  id: string;
  question: string;
  context: string;
  lane: CounselLane;
  status: CounselSessionStatus;
  members: string[];
  positions: CounselPosition[];
  rebuttalOpenAt?: number;
  synthesis?: {
    by: string;
    stanceTable: { member: string; stance: CounselStance | 'no-response'; confidence?: number }[];
    agreements: string[];
    conflicts: string[];
    unresolvedObjections: string[];
    recommendation: 'go' | 'no-go' | 'conditional';
    text: string;
    generatedAt: number;
  };
  verdict?: {
    decision: 'go' | 'no-go';
    by: string;
    note?: string;
    proposalId?: string;
    at: number;
  };
  /** Strategy proposal this session deliberates, if convened from one. */
  sourceProposalId?: string;
  /** Set when the poll card was pushed to Discord — notify once. */
  discordNotifiedAt?: number;
  /** Set when auto-clear rules fired — audit distinguishes human vs auto. */
  autoCleared?: boolean;
  createdAt: number;
  positionDeadline: number;
  updatedAt: number;
}

// ── Storage ─────────────────────────────────────────────────────────────────

function ensureDirs() {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  fs.mkdirSync(POSITIONS_DIR, { recursive: true });
}

function sessionPath(id: string) {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

function readSession(id: string): CounselSession | null {
  try {
    const p = sessionPath(id);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8')) as CounselSession;
  } catch { return null; }
}

function writeSession(s: CounselSession) {
  ensureDirs();
  s.updatedAt = Date.now();
  const tmp = sessionPath(s.id) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(s, null, 1));
  fs.renameSync(tmp, sessionPath(s.id));
}

function audit(event: string, data: Record<string, unknown>) {
  try {
    ensureDirs();
    fs.appendFileSync(LOG_FILE, JSON.stringify({ ts: Date.now(), event, ...data }) + '\n');
  } catch { /* audit is best-effort, never block the session */ }
}

function listSessionFiles(): string[] {
  try {
    return fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  } catch { return []; }
}

// ── Validation ──────────────────────────────────────────────────────────────

const STANCES: CounselStance[] = ['go', 'no-go', 'conditional'];

function validatePosition(p: Partial<CounselPosition>): string | null {
  if (!p.member || typeof p.member !== 'string') return 'member required';
  if (!STANCES.includes(p.stance as CounselStance)) return 'stance must be go|no-go|conditional';
  if (typeof p.confidence !== 'number' || p.confidence < 0 || p.confidence > 1) return 'confidence must be 0..1';
  if (!Array.isArray(p.keyEvidence) || p.keyEvidence.filter((e) => typeof e === 'string' && e.trim()).length === 0) {
    return 'keyEvidence required — uncited positions are rejected (Evidence or Silence)';
  }
  if (typeof p.reasoning !== 'string' || !p.reasoning.trim()) return 'reasoning required';
  if (p.reasoning.length > MAX_REASONING_CHARS) return `reasoning exceeds ${MAX_REASONING_CHARS} chars`;
  return null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Sessions convened today (local day) — enforces the daily cap. */
export function counselSessionsToday(): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return listSessionFiles()
    .map((id) => readSession(id))
    .filter((s): s is CounselSession => !!s && s.createdAt >= start.getTime())
    .length;
}

/** Convene a new counsel session. Returns the session or an error string. */
export function conveneCounsel(opts: {
  question: string;
  context?: string;
  lane?: CounselLane;
  members?: string[];
  sourceProposalId?: string;
}): { session?: CounselSession; error?: string } {
  const question = String(opts.question || '').trim();
  if (!question) return { error: 'question required' };
  if (question.length > 500) return { error: 'question exceeds 500 chars' };

  const cap = Number(process.env.CORTEX_COUNSEL_DAILY_CAP || DEFAULT_DAILY_CAP);
  if (counselSessionsToday() >= cap) {
    return { error: `daily counsel cap reached (${cap}/day)` };
  }

  const validIds = new Set(COUNSEL_CONSOLES.map((c) => c.id));
  const members = (opts.members || ['strategist', 'devin', 'sentinel', 'forecaster', 'warden', 'user'])
    .filter((m) => validIds.has(m));
  if (members.length < 2) return { error: 'at least 2 valid members required' };

  const now = Date.now();
  const session: CounselSession = {
    id: `csl-${crypto.randomBytes(4).toString('hex')}`,
    question,
    context: String(opts.context || '').slice(0, 4000),
    lane: (['contained', 'reversible', 'hard'] as CounselLane[]).includes(opts.lane as CounselLane)
      ? (opts.lane as CounselLane)
      : 'reversible',
    status: 'positions',
    members,
    positions: [],
    createdAt: now,
    positionDeadline: now + POSITION_TIMEOUT_MS,
    updatedAt: now,
    sourceProposalId: opts.sourceProposalId?.slice(0, 80),
  };

  writeSession(session);
  audit('convened', { id: session.id, lane: session.lane, members });
  return { session };
}

/** File a round-1 or round-2 position. Rejects uncited/invalid positions. */
export function filePosition(
  sessionId: string,
  pos: Partial<CounselPosition>,
): { ok: boolean; error?: string; session?: CounselSession } {
  const s = readSession(sessionId);
  if (!s) return { ok: false, error: 'session not found' };
  if (s.status === 'cleared' || s.status === 'expired' || s.status === 'cancelled') {
    return { ok: false, error: `session is ${s.status}` };
  }

  const member = String(pos.member || '');
  if (!s.members.includes(member)) return { ok: false, error: `${member} is not a member of this session` };

  const round: 1 | 2 = s.status === 'rebuttal' ? 2 : 1;
  if (round === 1 && s.status !== 'positions') return { ok: false, error: `session is ${s.status}, not collecting round-1 positions` };
  if (round === 2 && s.status !== 'rebuttal') return { ok: false, error: `session is ${s.status}, rebuttal not open` };

  // One position per member per round.
  if (s.positions.some((p) => p.member === member && p.round === round)) {
    return { ok: false, error: `${member} already filed a round-${round} position` };
  }

  const err = validatePosition(pos);
  if (err) return { ok: false, error: err };

  const clean: CounselPosition = {
    member,
    stance: pos.stance as CounselStance,
    confidence: Math.min(1, Math.max(0, pos.confidence as number)),
    keyEvidence: (pos.keyEvidence as string[]).map((e) => String(e).slice(0, 300)).slice(0, MAX_EVIDENCE_ITEMS),
    risks: (pos.risks || []).map((r) => String(r).slice(0, 200)).slice(0, MAX_EVIDENCE_ITEMS),
    requiredConditions: (pos.requiredConditions || []).map((c) => String(c).slice(0, 200)).slice(0, MAX_EVIDENCE_ITEMS),
    reasoning: String(pos.reasoning).trim().slice(0, MAX_REASONING_CHARS),
    round,
    filedAt: Date.now(),
  };

  s.positions.push(clean);
  writeSession(s);
  audit('position', { id: s.id, member, round, stance: clean.stance });
  return { ok: true, session: s };
}

/** Close round 1 and open the rebuttal window (positions anonymized). */
export function openRebuttal(sessionId: string): { ok: boolean; error?: string; session?: CounselSession } {
  const s = readSession(sessionId);
  if (!s) return { ok: false, error: 'session not found' };
  if (s.status !== 'positions') return { ok: false, error: `session is ${s.status}` };
  const round1 = s.positions.filter((p) => p.round === 1);
  if (round1.length === 0) return { ok: false, error: 'no round-1 positions filed' };
  s.status = 'rebuttal';
  s.rebuttalOpenAt = Date.now();
  writeSession(s);
  audit('rebuttal_open', { id: s.id, round1: round1.length });
  return { ok: true, session: s };
}

/** Close rebuttal and move to synthesis. */
export function closeRebuttal(sessionId: string): { ok: boolean; error?: string; session?: CounselSession } {
  const s = readSession(sessionId);
  if (!s) return { ok: false, error: 'session not found' };
  if (s.status !== 'rebuttal') return { ok: false, error: `session is ${s.status}` };
  s.status = 'synthesis';
  writeSession(s);
  audit('rebuttal_closed', { id: s.id });
  return { ok: true, session: s };
}

/** Record STRATEGIST's synthesis of the poll. */
export function recordSynthesis(
  sessionId: string,
  syn: Omit<NonNullable<CounselSession['synthesis']>, 'generatedAt'>,
): { ok: boolean; error?: string; session?: CounselSession } {
  const s = readSession(sessionId);
  if (!s) return { ok: false, error: 'session not found' };
  if (s.status !== 'synthesis') return { ok: false, error: `session is ${s.status}, expected synthesis` };
  if (!syn.text || !syn.text.trim()) return { ok: false, error: 'synthesis text required' };
  if (!['go', 'no-go', 'conditional'].includes(syn.recommendation)) return { ok: false, error: 'invalid recommendation' };
  s.synthesis = { ...syn, generatedAt: Date.now(), text: syn.text.slice(0, 2000) };
  s.status = 'poll';
  writeSession(s);
  audit('synthesis', { id: s.id, recommendation: syn.recommendation });
  return { ok: true, session: s };
}

/** Render the poll board: latest-round stance per member + no-response count. */
export function pollBoard(s: CounselSession) {
  const latest = new Map<string, CounselPosition>();
  for (const p of s.positions) {
    const prev = latest.get(p.member);
    if (!prev || p.round >= prev.round) latest.set(p.member, p);
  }
  const stances = s.members.map((m) => {
    const p = latest.get(m);
    return p
      ? { member: m, stance: p.stance, confidence: p.confidence }
      : { member: m, stance: 'no-response' as const };
  });
  return {
    counts: {
      go: stances.filter((x) => x.stance === 'go').length,
      noGo: stances.filter((x) => x.stance === 'no-go').length,
      conditional: stances.filter((x) => x.stance === 'conditional').length,
      noResponse: stances.filter((x) => x.stance === 'no-response').length,
    },
    stances,
  };
}

/** Human GO/NO-GO — the only path to 'cleared'. Hard lane never auto-clears. */
export function decideCounsel(
  sessionId: string,
  decision: 'go' | 'no-go',
  by: string,
  note?: string,
  proposalId?: string,
): { ok: boolean; error?: string; session?: CounselSession } {
  const s = readSession(sessionId);
  if (!s) return { ok: false, error: 'session not found' };
  if (s.status !== 'poll') return { ok: false, error: `session is ${s.status}, not awaiting decision` };
  s.status = 'cleared';
  s.verdict = { decision, by, note: note?.slice(0, 300), proposalId, at: Date.now() };
  writeSession(s);
  audit('verdict', { id: s.id, decision, by });
  return { ok: true, session: s };
}

/** Cancel a session (any non-cleared status). */
export function cancelCounsel(sessionId: string, by: string): { ok: boolean; error?: string; session?: CounselSession } {
  const s = readSession(sessionId);
  if (!s) return { ok: false, error: 'session not found' };
  if (s.status === 'cleared') return { ok: false, error: 'session already cleared' };
  if (s.status === 'cancelled' || s.status === 'expired') return { ok: false, error: `session is ${s.status}` };
  s.status = 'cancelled';
  writeSession(s);
  audit('cancelled', { id: s.id, by });
  return { ok: true, session: s };
}

/** Reconcile stale sessions: TTL → expired. Does NOT auto-clear anything. */
export function reconcileCounselSessions(): number {
  let touched = 0;
  for (const id of listSessionFiles()) {
    const s = readSession(id);
    if (!s) continue;
    if ((s.status === 'positions' || s.status === 'rebuttal' || s.status === 'synthesis' || s.status === 'poll')
      && Date.now() - s.createdAt > SESSION_TTL_MS) {
      s.status = 'expired';
      writeSession(s);
      audit('expired', { id: s.id });
      touched++;
    }
  }
  return touched;
}

/** Mark a session's poll as Discord-notified (idempotent). */
export function markCounselDiscordNotified(id: string): boolean {
  const s = readSession(id);
  if (!s || s.discordNotifiedAt) return false;
  s.discordNotifiedAt = Date.now();
  writeSession(s);
  return true;
}

/** Auto-clear sweep: reversible-lane polls with zero no-go votes may
 *  self-clear after the configured timeout — ONLY when
 *  CORTEX_COUNSEL_AUTO_CLEAR is enabled. Hard lane can never auto-clear. */
export function autoClearCounselPolls(opts?: { now?: number; pollTimeoutMs?: number }): number {
  if (process.env.CORTEX_COUNSEL_AUTO_CLEAR !== '1') return 0;
  const now = opts?.now ?? Date.now();
  const timeout = opts?.pollTimeoutMs ?? Number(process.env.CORTEX_COUNSEL_POLL_TIMEOUT_MIN || 120) * 60_000;
  let cleared = 0;
  for (const id of listSessionFiles()) {
    const s = readSession(id);
    if (!s || s.status !== 'poll' || s.lane === 'hard') continue;
    if (now - s.createdAt < timeout) continue;
    const board = pollBoard(s);
    if (board.counts.noGo > 0) continue; // any standing objection blocks auto-clear
    if (board.counts.go + board.counts.conditional === 0) continue; // need at least one actual position
    s.status = 'cleared';
    s.autoCleared = true;
    s.verdict = { decision: 'go', by: 'auto-counsel', note: `auto-cleared: ${board.counts.go} go / ${board.counts.conditional} conditional / ${board.counts.noGo} no-go after ${Math.round(timeout / 60000)}m`, at: now };
    writeSession(s);
    audit('auto_cleared', { id: s.id, counts: board.counts });
    cleared++;
  }
  return cleared;
}

export function getCounselSession(id: string): CounselSession | null {
  return readSession(id);
}

export function listCounselSessions(opts?: { status?: CounselSessionStatus }): CounselSession[] {
  reconcileCounselSessions();
  return listSessionFiles()
    .map((id) => readSession(id))
    .filter((s): s is CounselSession => !!s)
    .filter((s) => !opts?.status || s.status === opts.status)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50);
}
