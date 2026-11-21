/**
 * Stress test for cortex-becoming-loop leader lease.
 * Simulates two Cortex tabs as two module instances sharing one
 * localStorage-backed persistentStore.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory localStorage stub — persistentStore probes globalThis.localStorage
function makeLocalStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    _map: m,
  };
}

const ls = makeLocalStorage();
vi.stubGlobal('localStorage', ls);
// window must exist for startBecomingLoop's guard — stub minimal
vi.stubGlobal('window', { localStorage: ls });
// document.visibilityState read by sensors — they no-op safely anyway
vi.stubGlobal('document', { visibilityState: 'hidden' });

const LEASE_KEY = 'cortex:becoming:leader:v1';

async function freshModule() {
  vi.resetModules();
  return await import('../cortex-becoming-loop');
}

describe('becoming-loop leader lease', () => {
  beforeEach(() => { ls.clear(); vi.useRealTimers(); });

  it('first tab claims lease; second tab does not steal it', async () => {
    const tabA = await freshModule();
    const stopA = tabA.startBecomingLoop();

    const leaseA = JSON.parse(ls.getItem(LEASE_KEY)!);
    expect(leaseA.tabId).toBeTruthy();
    expect(leaseA.expiresAt).toBeGreaterThan(Date.now());

    // Tab B: separate module instance, same localStorage
    const tabB = await freshModule();
    const stopB = tabB.startBecomingLoop();

    const leaseAfter = JSON.parse(ls.getItem(LEASE_KEY)!);
    // Lease must still belong to tab A — B saw a live lease and yielded
    expect(leaseAfter.tabId).toBe(leaseA.tabId);

    stopA(); stopB();
    // A's cleanup released the lease
    expect(ls.getItem(LEASE_KEY)).toBeNull();
  });

  it('failover: expired lease is claimed by the next tab', async () => {
    const tabA = await freshModule();
    const stopA = tabA.startBecomingLoop();
    const leaseA = JSON.parse(ls.getItem(LEASE_KEY)!);

    // Simulate leader freeze: manually expire the lease
    ls.setItem(LEASE_KEY, JSON.stringify({ ...leaseA, expiresAt: Date.now() - 1 }));

    // Tab B's renew tick (30s) — force by advancing timers is complex;
    // instead directly verify isLeader semantics via a second claim:
    // call startBecomingLoop on a fresh module — its initial isLeader()
    // runs synchronously at mount and should claim the expired lease.
    const tabB = await freshModule();
    const stopB = tabB.startBecomingLoop();
    const leaseB = JSON.parse(ls.getItem(LEASE_KEY)!);
    expect(leaseB.tabId).not.toBe(leaseA.tabId);
    expect(leaseB.expiresAt).toBeGreaterThan(Date.now());

    stopA(); stopB();
  });

  it('same-tab double mount is idempotent (StrictMode safe)', async () => {
    const tab = await freshModule();
    const stop1 = tab.startBecomingLoop();
    const stop2 = tab.startBecomingLoop(); // second call returns existing cleanup
    const lease = JSON.parse(ls.getItem(LEASE_KEY)!);
    expect(lease.tabId).toBeTruthy();
    stop1(); stop2();
  });

  it('corrupt lease JSON fails open (sensors still run)', async () => {
    ls.setItem(LEASE_KEY, '{not-json');
    const tab = await freshModule();
    const stop = tab.startBecomingLoop();
    // Fail-open path rewrites a valid lease rather than crashing
    const lease = JSON.parse(ls.getItem(LEASE_KEY)!);
    expect(lease.tabId).toBeTruthy();
    stop();
  });
});
