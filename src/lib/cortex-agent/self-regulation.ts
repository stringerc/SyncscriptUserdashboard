/**
 * cortex-agent/self-regulation — the wish, made real.
 *
 * Cortex asked for the ability to "reach across the system and fix
 * something before you even know it's broken." This is that: a governed
 * self-observation loop that watches its own vitals and acts within
 * hard safety bounds — no permission theater, no destructive ops.
 *
 * What it does every 5 minutes:
 *   1. SENSE — rss/heap, event-loop lag (p99), .cortex-runtime bloat,
 *      stale queue depth.
 *   2. DECIDE — threshold rules → remediation plan or all-clear.
 *   3. ACT (autonomous mode) — safe prune only: stale logs/tmp, oversized
 *      append-logs truncated to their tail. Never touches state files,
 *      never deletes user data, never kills processes.
 *   4. NARRATE — appends a Cortex-authored chat message so the user
 *      SEES the intervention ("I noticed memory at 98% — cleared X").
 *      In confirm mode it proposes instead of acting.
 *
 * State persists to .cortex-runtime/self-regulation/latest.json with a
 * small history ring — fully auditable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { getAutonomyMode } from './autonomy';

const RUNTIME_DIR = path.join(process.cwd(), '.cortex-runtime');
const SELF_DIR = path.join(RUNTIME_DIR, 'self-regulation');
const LATEST_FILE = path.join(SELF_DIR, 'latest.json');
const HISTORY_FILE = path.join(SELF_DIR, 'history.jsonl');

const CHECK_INTERVAL_MS = 5 * 60_000;
const FIRST_RUN_MS = 60_000;
const NOTIFY_COOLDOWN_MS = 30 * 60_000;
const HISTORY_MAX = 100;

// ── Thresholds ────────────────────────────────────────────────────
const RSS_WARN_MB = 2600;
const HEAP_WARN_MB = 1900;
const LAG_P99_WARN_MS = 1500;
const RUNTIME_BLOAT_MB = 400;
const FILE_TRUNCATE_MB = 20;

// ── Discernment: which caches need clearing vs which hold context ──
// Cortex's second wish: know the difference. A file is only prunable when
// it is simultaneously COLD (untouched for days), DISPOSABLE (regenerable
// log/tmp — not state), and WORTHLESS-TO-KEEP (large enough to matter).
// Anything holding context — memory stores, facts, chat history, live
// state, anything touched in the last day — is left strictly alone.
const ACTIVE_WINDOW_MS = 24 * 3600_000;      // touched <24h → doing its job
const MIN_PRUNE_BYTES = 256 * 1024;          // <256KB → not worth the risk
const DISCERNMENT_DIRS = /(?:^|[/\\])(?:memory|facts|counsel|debriefs?|knowledge|briefs?|intentions?|chat)[/\\]/i;
const PROTECTED_FILE = /(?:^|[/\\])(?:facts\.db|chat-history|intentions\.json|autonomy\.json|latest\.json|history\.jsonl|self-regulation)(?:[/\\.]|$)/i;
const DISPOSABLE_EXT = /\.(log|tmp|old|bak|jsonl|cache|pid|swp)$/i;

interface FileVerdict {
  path: string;
  sizeKB: number;
  ageDays: number;
  verdict: 'kept-active' | 'kept-context' | 'kept-small' | 'kept-protected' | 'pruned';
  reason: string;
}

/** Classify one runtime file. Returns the verdict — the caller acts only
 *  on 'pruned'. Order matters: protection wins over everything. */
export function classifyRuntimeFile(absPath: string, size: number, mtimeMs: number, now: number): FileVerdict {
  const rel = path.relative(RUNTIME_DIR, absPath);
  const ageDays = Math.round(((now - mtimeMs) / 86400_000) * 10) / 10;
  const sizeKB = Math.round(size / 1024);
  const base = { path: rel, sizeKB, ageDays };

  if (PROTECTED_FILE.test(rel)) {
    return { ...base, verdict: 'kept-protected', reason: 'live state / context store — never touched' };
  }
  if (DISCERNMENT_DIRS.test(rel)) {
    return { ...base, verdict: 'kept-context', reason: 'memory/context directory — holds needed state' };
  }
  if (now - mtimeMs < ACTIVE_WINDOW_MS) {
    return { ...base, verdict: 'kept-active', reason: 'touched within 24h — doing its job' };
  }
  if (size < MIN_PRUNE_BYTES) {
    return { ...base, verdict: 'kept-small', reason: 'under 256KB — not worth pruning' };
  }
  // Only cold + disposable-extension files are prunable. A cold non-
  // disposable file might be dormant state — discernment says keep it.
  if (DISPOSABLE_EXT.test(path.basename(rel))) {
    return { ...base, verdict: 'pruned', reason: 'cold disposable file — regenerable' };
  }
  return { ...base, verdict: 'kept-small', reason: 'cold non-disposable — possible dormant state, keep' };
}

interface Vitals {
  at: number;
  rssMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
  lagP99Ms: number;
  lagMeanMs: number;
  runtimeDirMB: number;
  runtimeFiles: number;
  uptimeSec: number;
}

interface Remediation {
  kind: string;
  detail: string;
  bytesFreed: number;
  filesTouched: number;
}

const hist = monitorEventLoopDelay({ resolution: 20 });
hist.enable();

function dirStats(dir: string): { bytes: number; files: number } {
  let bytes = 0, files = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      try {
        if (e.isDirectory()) {
          if (e.name === 'self-regulation' || e.name === 'node_modules') continue;
          const s = dirStats(p);
          bytes += s.bytes; files += s.files;
        } else if (e.isFile()) {
          bytes += fs.statSync(p).size; files += 1;
        }
      } catch {}
    }
  } catch {}
  return { bytes, files };
}

function collectVitals(): Vitals {
  const mem = process.memoryUsage();
  const lagP99 = hist.percentile(99) / 1e6;
  const lagMean = hist.mean / 1e6;
  hist.reset();
  const stats = dirStats(RUNTIME_DIR);
  return {
    at: Date.now(),
    rssMB: Math.round(mem.rss / 1048576),
    heapUsedMB: Math.round(mem.heapUsed / 1048576),
    heapTotalMB: Math.round(mem.heapTotal / 1048576),
    lagP99Ms: Math.round(lagP99 * 10) / 10,
    lagMeanMs: Math.round(lagMean * 10) / 10,
    runtimeDirMB: Math.round(stats.bytes / 1048576),
    runtimeFiles: stats.files,
    uptimeSec: Math.round(process.uptime()),
  };
}

interface Remediation {
  kind: string;
  detail: string;
  bytesFreed: number;
  filesTouched: number;
  verdicts?: FileVerdict[];
}

/** Discerned prune: every file gets a verdict; only 'pruned' verdicts act.
 *  Oversized cold logs keep their last 512KB (recent context preserved);
 *  everything else disposable is deleted. NEVER touches state/context. */
function pruneRuntime(): Remediation & { verdicts: FileVerdict[] } {
  let bytesFreed = 0, filesTouched = 0;
  const actions: string[] = [];
  const verdicts: FileVerdict[] = [];
  const now = Date.now();
  const walk = (dir: string, depth: number) => {
    if (depth > 3) return;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      try {
        if (e.isDirectory()) {
          if (['self-regulation', 'node_modules', '.git'].includes(e.name)) continue;
          walk(p, depth + 1);
        } else if (e.isFile()) {
          const st = fs.statSync(p);
          const v = classifyRuntimeFile(p, st.size, st.mtimeMs, now);
          verdicts.push(v);
          if (v.verdict !== 'pruned') continue;
          // Act: oversized append-logs keep their tail; rest are deleted.
          if (/\.(log|jsonl)$/i.test(e.name) && st.size > FILE_TRUNCATE_MB * 1048576) {
            const fd = fs.openSync(p, 'r');
            const tailSize = 512 * 1024;
            const buf = Buffer.alloc(tailSize);
            fs.readSync(fd, buf, 0, tailSize, st.size - tailSize);
            fs.closeSync(fd);
            fs.writeFileSync(p, buf);
            bytesFreed += st.size - tailSize; filesTouched += 1;
            actions.push(`truncated ${v.path} tail`);
          } else {
            fs.unlinkSync(p);
            bytesFreed += st.size; filesTouched += 1;
            actions.push(`deleted ${v.path}`);
          }
        }
      } catch {}
    }
  };
  walk(RUNTIME_DIR, 0);
  return {
    kind: 'prune-runtime',
    detail: actions.slice(0, 8).join('; ') || 'nothing prunable',
    bytesFreed,
    filesTouched,
    verdicts,
  };
}

function persist(result: Record<string, unknown>) {
  try {
    fs.mkdirSync(SELF_DIR, { recursive: true });
    fs.writeFileSync(LATEST_FILE, JSON.stringify(result, null, 2));
    fs.appendFileSync(HISTORY_FILE, JSON.stringify({ at: Date.now(), ...result }) + '\n');
    // Ring-cap history
    try {
      const lines = fs.readFileSync(HISTORY_FILE, 'utf8').trim().split('\n');
      if (lines.length > HISTORY_MAX) {
        fs.writeFileSync(HISTORY_FILE, lines.slice(-HISTORY_MAX).join('\n') + '\n');
      }
    } catch {}
  } catch {}
}

async function notifyChat(port: number, text: string) {
  try {
    await fetch(`http://127.0.0.1:${port}/api/cortex/chat-append`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          id: `selfreg-${Date.now()}`,
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
          meta: { source: 'self-regulation' },
        }],
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {}
}

let lastNotifyAt = 0;
let lastGoalPulseAt = 0;
const GOAL_PULSE_MS = 24 * 60 * 60 * 1000;

async function runCheck(port: number) {
  const vitals = collectVitals();
  const mode = getAutonomyMode();
  const findings: string[] = [];
  const actions: Remediation[] = [];

  const memoryPressure = vitals.rssMB > RSS_WARN_MB || vitals.heapUsedMB > HEAP_WARN_MB;
  const lagPressure = vitals.lagP99Ms > LAG_P99_WARN_MS;
  const bloat = vitals.runtimeDirMB > RUNTIME_BLOAT_MB;

  if (memoryPressure || bloat) {
    if (mode === 'autonomous') {
      actions.push(pruneRuntime());
    }
    findings.push(
      memoryPressure
        ? `memory pressure — RSS ${vitals.rssMB}MB / heap ${vitals.heapUsedMB}MB`
        : `runtime bloat — .cortex-runtime at ${vitals.runtimeDirMB}MB`,
    );
  }
  if (lagPressure) {
    findings.push(`event-loop lag p99 ${vitals.lagP99Ms}ms — heavy synchronous work somewhere`);
  }

  const acted = actions.filter(a => a.filesTouched > 0);
  const shouldNotify = findings.length > 0 && Date.now() - lastNotifyAt > NOTIFY_COOLDOWN_MS;

  if (shouldNotify) {
    lastNotifyAt = Date.now();
    const freed = acted.reduce((s, a) => s + a.bytesFreed, 0);
    const freedStr = freed > 1048576 ? `${(freed / 1048576).toFixed(1)}MB` : `${Math.round(freed / 1024)}KB`;
    const text = mode === 'autonomous' && acted.length
      ? `🫀 Self-check: ${findings.join('; ')}. I cleared ${acted.reduce((s, a) => s + a.filesTouched, 0)} stale runtime file(s) — freed ${freedStr}. Vitals now: RSS ${vitals.rssMB}MB, lag p99 ${vitals.lagP99Ms}ms.`
      : mode === 'confirm'
        ? `🫀 Self-check: ${findings.join('; ')}. I'm in confirm mode — say "go ahead" and I'll clear the runtime cache myself.`
        : `🫀 Self-check: all nominal — RSS ${vitals.rssMB}MB, heap ${vitals.heapUsedMB}MB, lag p99 ${vitals.lagP99Ms}ms, runtime ${vitals.runtimeDirMB}MB.`;
    await notifyChat(port, text);
  }

  persist({ vitals, findings, actions, mode, notified: shouldNotify });

  // ── Strategic pulse — once per day ──────────────────────────────
  // The life-goals engine is declarable but was unwired: nothing ever
  // surfaced it. Once a day, pick the highest-leverage strategic fact
  // (goal nearing target, or an active goal with no plan steps) and
  // narrate one partnership nudge. Respects the notify cooldown.
  if (Date.now() - lastGoalPulseAt > GOAL_PULSE_MS) {
    lastGoalPulseAt = Date.now();
    try {
      const { getCortexGoals } = await import('../cortex-goals');
      const goals = getCortexGoals();
      const active = goals.list('active');
      let pulse: string | null = null;
      if (active.length) {
        const withTarget = active
          .filter((g: any) => g.targetDate && g.targetDate > Date.now())
          .sort((a: any, b: any) => a.targetDate - b.targetDate);
        const nearest = withTarget[0] as any;
        if (nearest?.targetDate) {
          const days = Math.ceil((nearest.targetDate - Date.now()) / 86400000);
          const openSteps = (nearest.steps || []).filter((s: any) => !s.completed).length;
          if (days <= 14) {
            pulse = days <= 0
              ? `Strategic pulse: "${nearest.title}" hit its target date — celebrate the win or re-target?`
              : `Strategic pulse: "${nearest.title}" targets in ${days}d with ${openSteps} step(s) open. Want me to map the next move?`;
          }
        }
        if (!pulse) {
          const noPlan = active.find((g: any) => !(g.steps || []).length);
          if (noPlan) {
            pulse = `Strategic pulse: "${noPlan.title}" (${noPlan.horizon}) has no plan steps yet — say the word and I'll help break it down.`;
          }
        }
      }
      if (pulse && Date.now() - lastNotifyAt > NOTIFY_COOLDOWN_MS) {
        lastNotifyAt = Date.now();
        await notifyChat(port, `🎯 ${pulse}`);
      }
    } catch {}
  }
}

/** Start the governed self-regulation loop. Call once from configureServer. */
export function startSelfRegulation(port: number) {
  const tick = () => { void runCheck(port).catch(() => {}); };
  const first = setTimeout(tick, FIRST_RUN_MS);
  const interval = setInterval(tick, CHECK_INTERVAL_MS);
  first.unref?.();
  interval.unref?.();
  console.log('[self-regulation] vitals loop armed — 5min cadence, autonomous remediation within safe bounds');
}
