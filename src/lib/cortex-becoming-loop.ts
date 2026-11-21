/**
 * cortex-becoming-loop.ts — the self-becoming sensor suite, page-agnostic.
 *
 * Mounts the three loops that turn internal state into behavior:
 *   - startSelfConcerns()     — trajectory-based concern proposals
 *   - startMemorySurfacing()  — strain × episodic-memory surfacing
 *   - dream consolidation scheduler — disposition-mutating nightly cycle
 *
 * Previously these lived only in CortexDemo (/cortex chat), so the visualizer
 * voice surface accumulated nothing. Both pages now call startBecomingLoop().
 *
 * Cross-tab leadership: sensors + dream scheduler write shared persistent
 * state (dispositions, concern streaks, last-run markers). A localStorage
 * lease ensures only ONE visible tab runs them at a time — the first to claim
 * leads; if its heartbeat goes stale (>2min, e.g. frozen/backgrounded), another
 * tab takes over. Fail-open: if the lease store errors, sensors run anyway —
 * duplicated sensing is noisy, dead sensing is worse.
 */

import { persistentStore } from './persistent-store';
import { startSelfConcerns } from './cortex-self-concerns';
import { startMemorySurfacing } from './cortex-memory-surfacing';
import { runDreamConsolidation, getLastDreamRun } from './cortex-dream-engine';

const LEASE_KEY = 'cortex:becoming:leader:v1';
const LEASE_TTL_MS = 2 * 60 * 1000;
const RENEW_MS = 30 * 1000;

let activeCleanup: (() => void) | null = null;

export function startBecomingLoop(): () => void {
  if (typeof window === 'undefined') return () => {};
  // Already running in this tab (StrictMode double-mount, HMR) — no-op.
  if (activeCleanup) return activeCleanup;

  const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const isLeader = (): boolean => {
    try {
      const raw = persistentStore.getItem(LEASE_KEY);
      const lease = raw ? JSON.parse(raw) : null;
      const now = Date.now();
      if (!lease || lease.tabId === tabId || (lease.expiresAt ?? 0) < now) {
        persistentStore.setItem(LEASE_KEY, JSON.stringify({ tabId, expiresAt: now + LEASE_TTL_MS }));
        return true;
      }
      return false;
    } catch {
      return true; // fail-open
    }
  };

  const bootSensors = () => {
    if (activeCleanup) return;
    const cleanups: Array<() => void> = [startSelfConcerns(), startMemorySurfacing()];

    // Dream consolidation scheduler — runs when >20h since last cycle,
    // checks hourly. Real consolidation mutating dispositions, not a stub.
    const dreamTick = async () => {
      try {
        const last = getLastDreamRun();
        if (last?.at && Date.now() - last.at < 20 * 3600_000) return;
        await runDreamConsolidation('deep');
      } catch {}
    };
    const dreamBoot = setTimeout(dreamTick, 180_000);
    const dreamInterval = setInterval(dreamTick, 3600_000);
    cleanups.push(() => { clearTimeout(dreamBoot); clearInterval(dreamInterval); });

    activeCleanup = () => cleanups.forEach((fn) => { try { fn(); } catch {} });
  };

  if (isLeader()) bootSensors();
  const renew = setInterval(() => { if (isLeader()) bootSensors(); }, RENEW_MS);

  return () => {
    clearInterval(renew);
    if (activeCleanup) { activeCleanup(); activeCleanup = null; }
    try {
      const raw = persistentStore.getItem(LEASE_KEY);
      const lease = raw ? JSON.parse(raw) : null;
      if (lease?.tabId === tabId) persistentStore.removeItem(LEASE_KEY);
    } catch {}
  };
}
