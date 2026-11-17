/**
 * Cortex Session Handoff — "The Relay Baton"
 *
 * Enables seamless, zero-loss operational handoffs between AI agents
 * (e.g., Antigravity -> Devin failover when token/quota pressure occurs,
 * or Devin -> Antigravity when deep synthesis is required).
 *
 * Invariant: Handoff data is durable on disk (.cortex-runtime/session-handoff.json)
 * and structured so the backup agent does NOT need to spend turns or tokens
 * re-exploring the codebase.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface SessionHandoff {
  id: string;
  timestamp: number;
  fromAgent: string;
  toAgent: string;
  mission: string;
  currentPhase: string;
  filesModified: string[];
  verifiedTests: string[];
  immediateNextStep: string;
  knownBlockers?: string;
  verifyCommand: string;
  contextSummary?: string;
  status: 'pending' | 'claimed' | 'completed';
}

const RUNTIME_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const HANDOFF_FILE = path.join(RUNTIME_DIR, 'session-handoff.json');

export function getSessionHandoffPath(): string {
  return HANDOFF_FILE;
}

export function writeSessionHandoff(opts: Omit<SessionHandoff, 'id' | 'timestamp' | 'status'>): SessionHandoff {
  const handoff: SessionHandoff = {
    ...opts,
    id: `handoff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    status: 'pending',
  };
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(HANDOFF_FILE, JSON.stringify(handoff, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[cortex-handoff] Failed to write session handoff:', e?.message || e);
  }
  return handoff;
}

export function readSessionHandoff(): SessionHandoff | null {
  try {
    if (!fs.existsSync(HANDOFF_FILE)) return null;
    const raw = fs.readFileSync(HANDOFF_FILE, 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && data.mission ? data as SessionHandoff : null;
  } catch {
    return null;
  }
}

export function markHandoffClaimed(agentId: string): boolean {
  try {
    const handoff = readSessionHandoff();
    if (!handoff || handoff.status !== 'pending') return false;
    handoff.status = 'claimed';
    handoff.toAgent = agentId;
    fs.writeFileSync(HANDOFF_FILE, JSON.stringify(handoff, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function clearSessionHandoff(): boolean {
  try {
    if (fs.existsSync(HANDOFF_FILE)) {
      fs.unlinkSync(HANDOFF_FILE);
      return true;
    }
  } catch {}
  return false;
}
