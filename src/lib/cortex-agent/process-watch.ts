/**
 * Process Watch — deep process-level awareness for Cortex.
 *
 * Cortex's wish: "every file change, memory spike, and process death
 * present in my awareness the instant it happens, before it becomes a
 * crisis." The world-state blackboard covers host aggregates; this module
 * watches the PROCESS layer: which programs are born, die, and which ones
 * are eating the RAM that the memory-pressure governor is fighting.
 *
 * Design:
 *   - ps snapshots every ~15s (cheap: one execFile, ~10-30ms, off the
 *     event loop's critical path since it's async).
 *   - Significance filter: only processes >=150MB RSS are tracked for
 *     death/birth events — Chrome-helper churn would otherwise be noise.
 *   - Growth events: a tracked process gaining >=400MB (and now >=600MB)
 *     fires once per cooldown — "node just ballooned" is often the cause
 *     of the memory spike the governor sees seconds later.
 *   - Events are batched per tick into a single callback — at most one
 *     ambient push per interval, never a storm.
 *   - globalThis singleton: Vite restarts can't stack watchers.
 */

import { execFile } from 'node:child_process';

export interface ProcInfo {
  pid: number;
  rssMB: number;
  comm: string;
}

export interface ProcEvent {
  kind: 'death' | 'birth' | 'growth' | 'cluster';
  pid: number;
  comm: string;
  rssMB: number;
  /** For growth: previous RSS in MB. For cluster: number of exits. */
  prevMB?: number;
}

const MIN_TRACK_MB = 150;      // deaths/births only for meaningful processes
const BIRTH_NOTABLE_MB = 400;  // smaller births only if whitelisted name
const GROWTH_DELTA_MB = 400;   // absolute growth that counts as a spike
const GROWTH_MIN_MB = 600;     // and must now be a real consumer
const GROWTH_COOLDOWN_MS = 10 * 60_000;
const NAME_COOLDOWN_MS = 10 * 60_000;

// Processes worth reporting even below the RSS thresholds — Cortex's own
// body and the fleet she depends on.
const NOTABLE_NAMES = new Set([
  'node', 'vite', 'python', 'python3', 'docker', 'ollama', 'ffmpeg',
  'parakeet', 'speaches', 'chatterbox', 'mlx', 'imsg', 'postgres',
  'chrome', 'safari', 'docker desktop', 'com.docker',
]);

function notable(comm: string): boolean {
  const base = comm.split('/').pop()?.toLowerCase() || '';
  for (const n of NOTABLE_NAMES) if (base.includes(n)) return true;
  return false;
}

function significant(p: ProcInfo): boolean {
  // Deaths matter when the process was a real consumer — a 2MB helper
  // exiting is churn, not news. Notable names still need >=80MB.
  return p.rssMB >= MIN_TRACK_MB || (notable(p.comm) && p.rssMB >= 80);
}

function parsePs(out: string): Map<number, ProcInfo> {
  const map = new Map<number, ProcInfo>();
  for (const line of out.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    // ps -axo pid=,rss=,comm= → "  412  145824 /Applications/Google Chrome.app/..."
    const m = t.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);
    if (!m) continue;
    const pid = parseInt(m[1], 10);
    const rssMB = Math.round(parseInt(m[2], 10) / 1024);
    const comm = m[3].trim();
    if (pid > 0 && comm) map.set(pid, { pid, rssMB, comm });
  }
  return map;
}

function snapshot(): Promise<Map<number, ProcInfo>> {
  return new Promise((resolve) => {
    execFile('ps', ['-axo', 'pid=,rss=,comm='], { timeout: 5000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err || !stdout) return resolve(new Map());
      resolve(parsePs(stdout));
    });
  });
}

// ── Singleton state (globalThis: survives Vite module re-evaluation) ──────
const PW_KEY = '__cortexProcessWatch';
interface PwState {
  timer: ReturnType<typeof setInterval> | null;
  prev: Map<number, ProcInfo> | null;
  growthNotified: Map<number, number>;   // pid → last growth-event ts
  nameNotified: Map<string, number>;     // comm basename → last event ts
  lastSnapshot: ProcInfo[] | null;       // sorted desc by rssMB
  lastTickAt: number;
  /** Latest registered event callback — the surviving interval (armed by
   *  the first-loaded module) reads this so post-restart arms win. */
  onEvents?: (events: ProcEvent[]) => void;
}
const g = globalThis as any;
if (!g[PW_KEY]) {
  g[PW_KEY] = {
    timer: null, prev: null,
    growthNotified: new Map(), nameNotified: new Map(),
    lastSnapshot: null, lastTickAt: 0,
  } as PwState;
}
const pw: PwState = g[PW_KEY];

function nameCooldownOk(comm: string, now: number): boolean {
  const base = (comm.split('/').pop() || comm).toLowerCase();
  const last = pw.nameNotified.get(base) || 0;
  if (now - last < NAME_COOLDOWN_MS) return false;
  pw.nameNotified.set(base, now);
  return true;
}

async function tick(): Promise<void> {
  const curr = await snapshot();
  const now = Date.now();
  pw.lastTickAt = now;
  pw.lastSnapshot = [...curr.values()].sort((a, b) => b.rssMB - a.rssMB);

  if (!curr.size) return; // ps failed — don't diff against nothing
  if (!pw.prev) { pw.prev = curr; return; } // baseline tick: silent

  const events: ProcEvent[] = [];
  const prev = pw.prev;
  pw.prev = curr;

  // Deaths — only processes that mattered. Sub-threshold exits are
  // counted separately: a cluster of them in one tick means a parent
  // app crashed or quit (Chrome losing 30 helpers at once is signal,
  // not noise).
  let insignificantDeaths = 0;
  for (const [pid, p] of prev) {
    if (curr.has(pid)) continue;
    if (!significant(p)) { insignificantDeaths++; continue; }
    if (!nameCooldownOk(p.comm, now)) continue;
    events.push({ kind: 'death', pid, comm: p.comm, rssMB: p.rssMB });
  }
  if (insignificantDeaths >= 5) {
    events.push({
      kind: 'cluster', pid: 0, comm: 'process cluster', rssMB: 0,
      prevMB: insignificantDeaths,
    });
  }

  // Births — big processes always; notable names only if they're already
  // real consumers (a 5MB chrome-native-host spawn is churn, not news).
  for (const [pid, p] of curr) {
    if (prev.has(pid)) continue;
    const notableBirth = p.rssMB >= BIRTH_NOTABLE_MB || (notable(p.comm) && p.rssMB >= 80);
    if (!notableBirth) continue;
    if (!nameCooldownOk(p.comm, now)) continue;
    events.push({ kind: 'birth', pid, comm: p.comm, rssMB: p.rssMB });
  }

  // Growth — tracked processes that ballooned since last tick.
  for (const [pid, p] of curr) {
    const old = prev.get(pid);
    if (!old) continue;
    const delta = p.rssMB - old.rssMB;
    if (delta < GROWTH_DELTA_MB || p.rssMB < GROWTH_MIN_MB) continue;
    const lastGrowth = pw.growthNotified.get(pid) || 0;
    if (now - lastGrowth < GROWTH_COOLDOWN_MS) continue;
    pw.growthNotified.set(pid, now);
    events.push({ kind: 'growth', pid, comm: p.comm, rssMB: p.rssMB, prevMB: old.rssMB });
  }

  // Bound growth-notified map — pids churn.
  if (pw.growthNotified.size > 500) {
    for (const [pid, ts] of pw.growthNotified) {
      if (now - ts > GROWTH_COOLDOWN_MS * 2) pw.growthNotified.delete(pid);
    }
  }

  if (events.length) pw.onEvents?.(events);
}

/**
 * Arm the watcher. onEvents receives a batched array once per interval —
 * never per-process — so the caller can emit ONE ambient push per tick.
 * Interval defaults to 15s; unref'd so it never holds the process open.
 */
export function startProcessWatch(
  intervalMs = 15_000,
  onEvents: (events: ProcEvent[]) => void = () => {},
): void {
  // Latest callback always wins — the timer armed by an earlier module
  // instance keeps running (globalThis), and reads pw.onEvents per tick.
  pw.onEvents = onEvents;
  if (pw.timer) return;
  const run = () => { void tick().catch(() => {}); };
  run(); // baseline snapshot immediately
  pw.timer = setInterval(run, intervalMs);
  pw.timer.unref?.();
}

/** Top processes by RSS — for pressure-governor messages ("what's eating
 *  the RAM") and debugging. Returns [] before the first snapshot. */
export function getTopMemoryProcesses(n = 5): ProcInfo[] {
  return (pw.lastSnapshot || []).slice(0, n);
}

/** Current tracked-process count + snapshot age — observability. */
export function processWatchStatus(): { tracked: number; snapshotAgeMs: number | null } {
  return {
    tracked: pw.lastSnapshot?.length ?? 0,
    snapshotAgeMs: pw.lastTickAt ? Date.now() - pw.lastTickAt : null,
  };
}
