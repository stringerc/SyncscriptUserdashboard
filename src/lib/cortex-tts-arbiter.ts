/**
 * cortex-tts-arbiter — cross-tab speech mutex.
 *
 * Multiple Cortex surfaces (/cortex/visualizer, /cortex/chat, face page)
 * each run an independent voice pipeline with the same cortana voice.
 * With several tabs open, two tabs can answer the same moment and talk
 * over each other — "two voices, two different responses."
 *
 * This arbiter gives each tab a speech lock in localStorage (shared,
 * synchronous across tabs). Only the lock holder may start a new spoken
 * utterance; others stay silent but still render text. The lock is
 * heartbeat-refreshed while speaking and goes stale after LOCK_STALE_MS
 * so a crashed tab never mutes Cortex forever.
 */

const TAB_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const KEY = 'cortex_tts_speech_lock_v1';
const LOCK_STALE_MS = 8000;

let lastBeatWrite = 0;

function readLock(): { tab?: string; token?: string; ts?: number } | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLock(token: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ tab: TAB_ID, token, ts: Date.now() }));
  } catch { /* private mode — arbitration disabled */ }
}

/**
 * Try to become the speaking tab. Returns true when this tab may vocalize.
 * Verify-after-write resolves the last-writer-wins race: only the final
 * writer's token survives the re-read.
 */
export function tryClaimSpeech(): boolean {
  try {
    const cur = readLock();
    if (cur?.tab && cur.tab !== TAB_ID && typeof cur.ts === 'number' && Date.now() - cur.ts < LOCK_STALE_MS) {
      return false;
    }
    const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    writeLock(token);
    return readLock()?.token === token;
  } catch {
    return true; // no localStorage — fail open
  }
}

/** Refresh lock freshness while this tab is mid-utterance. Throttled. */
export function heartbeatSpeech() {
  const now = Date.now();
  if (now - lastBeatWrite < 900) return;
  lastBeatWrite = now;
  try {
    const cur = readLock();
    if (cur?.tab === TAB_ID) writeLock(cur.token || 'beat');
  } catch { /* ignore */ }
}

/** Release the lock if this tab holds it. */
export function releaseSpeech() {
  try {
    if (readLock()?.tab === TAB_ID) localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

/** True when another live tab currently holds the speech lock. */
export function speechLockedElsewhere(): boolean {
  try {
    const cur = readLock();
    return !!(cur?.tab && cur.tab !== TAB_ID && typeof cur.ts === 'number' && Date.now() - cur.ts < LOCK_STALE_MS);
  } catch {
    return false;
  }
}
