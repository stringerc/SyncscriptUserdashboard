/**
 * Shared Cortex session identity.
 *
 * Previously voice used sessionStorage('cortex_voice_session') and chat
 * used sessionStorage('cortex_agent_session') — two identities that both
 * died on tab close. The Intention Kernel and Continuity Kernel key
 * pending offers, open loops, and turn digests by sessionId, so a
 * fragmented identity = fragmented memory.
 *
 * One localStorage identity now serves every surface: survives tab
 * close, reloads, and dev-server restarts; shared across tabs on the
 * same browser profile. Cleared only by explicit storage wipe (the
 * honest boundary — server-side continuity.json still holds the
 * durable turn digests regardless).
 */

const KEY = 'cortex_session_id';
const LEGACY_KEYS = ['cortex_voice_session', 'cortex_agent_session'];

export function getCortexSessionId(): string {
  try {
    let sid = localStorage.getItem(KEY);
    if (!sid) {
      // Migrate whichever legacy identity exists so pending intentions
      // recorded under it remain reachable.
      for (const k of LEGACY_KEYS) {
        const legacy = sessionStorage.getItem(k);
        if (legacy) { sid = legacy; break; }
      }
      if (!sid) {
        sid = `cortex-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      }
      localStorage.setItem(KEY, sid);
    }
    return sid;
  } catch {
    return 'cortex-shared';
  }
}
