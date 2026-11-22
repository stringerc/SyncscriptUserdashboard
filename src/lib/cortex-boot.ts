/**
 * cortex-boot.ts — staged startup sequencer for the Cortex visualizer.
 *
 * Problem it solves: on page load ~15 independent systems all fire at once —
 * SSE feeds, half a dozen pollers, the proactive-initiative sensor (whose
 * first evaluateInitiatives pass floods the Inbox and auto-opens a panel),
 * the becoming loop, chat-history hydration, and two auto-pinned dashboard
 * iframes. The main thread and the local proxy saturate, so the chat
 * composer feels frozen until the storm drains.
 *
 * Phases (ms after module eval, roughly):
 *   core    — t=0. Anything the user is looking at or typing into:
 *             scene, chat drawer + hydration, signal bus, agent SSE,
 *             input/voice listeners.
 *   ready   — first paint settled, chat is usable. Telemetry that only
 *             feeds HUD readouts: memory graph, ambient/vigilance,
 *             forecast markers, geo, lights.
 *   ambient — background cognition: initiative sensor, becoming loop,
 *             spawn bridge, pinned dashboard panels. By now the page is
 *             interactive and the sensor's first evaluation burst lands
 *             on an already-busy-but-breathing UI.
 *   idle    — requestIdleCallback (or ~9s fallback): truly optional work.
 *
 * Design rules:
 * - Idempotent per tab: each phase callback fires once; late subscribers
 *   to an already-passed phase run on the next microtask.
 * - Survives HMR/StrictMode double-mount via module state.
 * - Every callback is try/caught — a failing subsystem must never stall
 *   the phases behind it.
 */

export type BootPhase = 'core' | 'ready' | 'ambient' | 'idle';

const PHASE_DELAY_MS: Record<BootPhase, number> = {
  core: 0,
  ready: 1200,
  ambient: 4000,
  idle: 9000,
};

const ORDER: BootPhase[] = ['core', 'ready', 'ambient', 'idle'];

let currentPhase: BootPhase = 'core';
let started = false;
const pending = new Map<BootPhase, Array<() => void>>();
const fired = new Set<BootPhase>();

function runPhase(phase: BootPhase) {
  if (fired.has(phase)) return;
  fired.add(phase);
  currentPhase = phase;
  const cbs = pending.get(phase) || [];
  pending.delete(phase);
  for (const cb of cbs) {
    try { cb(); } catch { /* subsystem failure must not stall boot */ }
  }
}

/** Begin the boot clock. Safe to call multiple times — only the first counts. */
export function startBoot(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const t0 = performance.now();
  for (const phase of ORDER) {
    const elapsed = PHASE_DELAY_MS[phase];
    if (elapsed === 0) {
      // Defer 'core' one microtask so all mount effects have subscribed first.
      queueMicrotask(() => runPhase('core'));
      continue;
    }
    const wait = Math.max(0, elapsed - (performance.now() - t0));
    setTimeout(() => runPhase(phase), wait);
  }
  // 'idle' also fires on real idle time if it comes sooner than the 9s cap.
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;
  if (typeof ric === 'function') {
    ric(() => runPhase('idle'), { timeout: PHASE_DELAY_MS.idle });
  }
}

/**
 * Register fn to run when `phase` (or any later phase) begins.
 * If the phase already passed, fn runs ASAP on a microtask.
 */
export function onBootPhase(phase: BootPhase, fn: () => void): void {
  const idx = ORDER.indexOf(phase);
  const reached = ORDER.findIndex((p) => p === currentPhase);
  if (reached >= idx && started) {
    queueMicrotask(() => { try { fn(); } catch {} });
    return;
  }
  if (!started) {
    // Not started yet — queue under the requested phase.
    const list = pending.get(phase) || [];
    list.push(fn);
    pending.set(phase, list);
    return;
  }
  const list = pending.get(phase) || [];
  list.push(fn);
  pending.set(phase, list);
}

/** Current phase — useful for conditional render gates. */
export function bootPhase(): BootPhase {
  return currentPhase;
}
