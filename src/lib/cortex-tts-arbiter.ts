/**
 * cortex-tts-arbiter — cross-context speech mutex.
 *
 * Cortex has many independent voice producers: six useVoiceStream hook
 * instances (visualizer, /cortex/chat, face page, cortana page, Nexus
 * call context, voice conversation engine), proactive announcements,
 * chat-drawer read-aloud, and the mobile companion — all sharing the
 * same cortana voice. Without arbitration, two of them talk over each
 * other: "two voices, two different responses."
 *
 * Ownership is PER-INSTANCE (not per-tab): every hook instance and every
 * ad-hoc player gets a unique ownerId, so even two voice stacks inside
 * the SAME tab serialize correctly. The lock lives in localStorage —
 * shared synchronously across every tab of the origin.
 *
 * Semantics:
 *   tryClaim() — first-come-first-served; fails while another owner
 *                holds a fresh lock (< LOCK_STALE_MS). Used for
 *                unprompted/queued speech (turn replies, proactive).
 *   steal()    — unconditional claim; used when the user explicitly
 *                starts a turn (typed message, PTT, call) so their
 *                surface bars in over whatever was speaking.
 *   heartbeat()— call ~1/s while vocalizing. Returns 'stolen' when the
 *                lock now belongs to someone else → caller should
 *                stopSpeaking() for a true cross-tab barge-in.
 *   release()  — owner-only unlock when speech drains or is stopped.
 *
 * Lock goes stale after LOCK_STALE_MS so a crashed tab never mutes
 * Cortex forever. Verify-after-write resolves the claim race (only the
 * final writer's token survives the re-read).
 */

const KEY = 'cortex_tts_speech_lock_v1';
const LOCK_STALE_MS = 8000;

export interface SpeechArbiter {
  readonly ownerId: string;
  tryClaim(): boolean;
  steal(): void;
  heartbeat(): 'ok' | 'stolen' | 'none';
  release(): void;
  lockedElsewhere(): boolean;
}

interface LockRecord {
  owner?: string;
  tab?: string; // legacy field — pre-refactor locks wrote `tab`
  token?: string;
  ts?: number;
}

let instanceCounter = 0;
function nextOwnerId(prefix: string): string {
  instanceCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${instanceCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLock(): LockRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lockOwner(l: LockRecord | null): string | undefined {
  return l?.owner ?? l?.tab;
}

function lockFresh(l: LockRecord | null): boolean {
  return !!l && typeof l.ts === 'number' && Date.now() - l.ts < LOCK_STALE_MS;
}

export function createSpeechArbiter(ownerId?: string): SpeechArbiter {
  const owner = ownerId ?? nextOwnerId('arb');
  let lastBeatWrite = 0;
  let heldToken: string | null = null;

  const writeLock = (token: string) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ owner, token, ts: Date.now() }));
    } catch { /* private mode — arbitration disabled */ }
  };

  const tryClaim = (): boolean => {
    try {
      const cur = readLock();
      const curOwner = lockOwner(cur);
      if (curOwner && curOwner !== owner && lockFresh(cur)) return false;
      const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      writeLock(token);
      const won = readLock()?.token === token;
      if (won) heldToken = token;
      return won;
    } catch {
      return true; // no localStorage — fail open
    }
  };

  const steal = () => {
    try {
      const token = `steal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      writeLock(token);
      if (readLock()?.token === token) heldToken = token;
    } catch { /* ignore */ }
  };

  const heartbeat = (): 'ok' | 'stolen' | 'none' => {
    const now = Date.now();
    try {
      const cur = readLock();
      const curOwner = lockOwner(cur);
      if (!curOwner) return 'none';
      if (curOwner !== owner) return lockFresh(cur) ? 'stolen' : 'none';
      // We own it — refresh freshness (throttled).
      if (now - lastBeatWrite >= 900) {
        lastBeatWrite = now;
        writeLock(cur.token || heldToken || 'beat');
      }
      return 'ok';
    } catch {
      return 'ok';
    }
  };

  const release = () => {
    heldToken = null;
    try {
      if (lockOwner(readLock()) === owner) localStorage.removeItem(KEY);
    } catch { /* ignore */ }
  };

  const lockedElsewhere = (): boolean => {
    try {
      const cur = readLock();
      const curOwner = lockOwner(cur);
      return !!(curOwner && curOwner !== owner && lockFresh(cur));
    } catch {
      return false;
    }
  };

  return { ownerId: owner, tryClaim, steal, heartbeat, release, lockedElsewhere };
}

// ── Default shared arbiter ─────────────────────────────────────────
// For ad-hoc callers that don't own a hook instance (one-shot players).
// Each callsite should prefer createSpeechArbiter with a stable ownerId.

const defaultArbiter = createSpeechArbiter('default');

export function tryClaimSpeech(): boolean {
  return defaultArbiter.tryClaim();
}
export function stealSpeech(): void {
  defaultArbiter.steal();
}
export function heartbeatSpeech(): 'ok' | 'stolen' | 'none' {
  return defaultArbiter.heartbeat();
}
export function releaseSpeech(): void {
  defaultArbiter.release();
}
export function speechLockedElsewhere(): boolean {
  return defaultArbiter.lockedElsewhere();
}
