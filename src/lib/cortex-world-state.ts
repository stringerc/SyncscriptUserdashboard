/**
 * Cortex Living World State Blackboard
 *
 * Consolidates fragmented ambient telemetry (window/app context, somatic vitals,
 * git status, fleet topology) into an in-memory blackboard with a 2000ms
 * stale-while-revalidate cache.
 *
 * Produces a compact, 60-80 token [WORLD-STATE: ...] header injected into the
 * voice persona and agent turns for zero-tool-call immediate situational awareness.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const RUNTIME_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');

/** Strip control chars/newlines and cap length — window titles are user-controlled text. */
function sanitizeTelemetry(text: string, max = 120): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export interface TopologyState {
  instance: 'mac' | 'oracle';
  localTime: string;
  timezone: string;
  utcDeltaHours: number;
  hostname: string;
}

export interface UserContextState {
  activeApp: string;
  frontmostWindow: string;
  activeFile?: string;
}

export interface HostSomaticState {
  loadAvg1m: number;
  /** freemem-based used% — misleading on macOS (see probeMemorystatusFreePct);
   *  prefer memFreePct when present. */
  memUsedPct: number;
  /** Kernel accounting: % of memory the system considers free
   *  (kern.memorystatus_level). The honest pressure signal on macOS. */
  memFreePct?: number;
  /** Estimated truly-free MB derived from memFreePct — replaces the
   *  misleading os.freemem() figure in the header. */
  memFreeMB?: number;
  uptimeHours: number;
  batteryPct?: number;
}

export interface CodebaseState {
  branch: string;
  isClean: boolean;
  dirtyCount: number;
  /** False when `git status` failed/timed out — header must not claim clean. */
  statusKnown?: boolean;
  /** Epoch ms of last detected source-tree change (fs.watch), if watcher active. */
  lastRepoChangeAt?: number;
  /** Recently changed source files (path → epoch ms), newest first, capped.
   *  The "state of your files" sense — Cortex knows WHAT changed, not
   *  just THAT something changed. */
  recentChanges?: { path: string; at: number }[];
}

export interface FleetState {
  activeAgentCount: number;
  oracleAlive: boolean;
}

export interface WorldState {
  topology: TopologyState;
  user: UserContextState;
  host: HostSomaticState;
  codebase: CodebaseState;
  fleet: FleetState;
  cachedAt: number;
}

// ── In-Memory Blackboard Cache ──────────────────────────────────────────────
let cachedState: WorldState | null = null;
let lastFetchMs = 0;
let isRefreshing = false;
const CACHE_TTL_MS = 2000;

// ── Sensor Probes ───────────────────────────────────────────────────────────

/** Read current git branch directly from .git/HEAD without spawning git process (0ms). */
export function getFastGitBranch(cwd: string = process.cwd()): string {
  try {
    const headPath = path.join(cwd, '.git', 'HEAD');
    if (!fs.existsSync(headPath)) return 'unknown';
    const headContent = fs.readFileSync(headPath, 'utf8').trim();
    if (headContent.startsWith('ref: refs/heads/')) {
      return headContent.replace('ref: refs/heads/', '');
    }
    return headContent.slice(0, 8); // detached commit hash
  } catch {
    return 'unknown';
  }
}

/** Check dirty status quickly via fast git status porcelain. */
export async function getGitStatus(cwd: string = process.cwd()): Promise<{ isClean: boolean; dirtyCount: number; ok: boolean }> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd, timeout: 1500 });
    const lines = stdout.trim().split('\n').filter(Boolean);
    return {
      isClean: lines.length === 0,
      dirtyCount: lines.length,
      ok: true,
    };
  } catch {
    // Unknown ≠ clean. Report failure honestly so the header can say "?".
    return { isClean: false, dirtyCount: 0, ok: false };
  }
}

/** Probe frontmost macOS application and window title via osascript. */
export async function probeFrontmostApp(): Promise<UserContextState> {
  if (process.platform !== 'darwin') {
    return { activeApp: 'Linux/Cloud', frontmostWindow: 'Headless Session' };
  }

  const script = `
    tell application "System Events"
      set frontApp to first application process whose frontmost is true
      set frontAppName to name of frontApp
      try
        set winTitle to name of front window of frontApp
      on error
        set winTitle to ""
      end try
      return frontAppName & "|||" & winTitle
    end tell
  `;

  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 350 });
    const [app = 'macOS', window = ''] = stdout.trim().split('|||');
    const cleanWindow = sanitizeTelemetry(window);

    // Parse potential active file from editor window titles (e.g. "CortexCoreScene.tsx — syncscript")
    let file: string | undefined;
    const fileMatch = cleanWindow.match(/(?:^|[●\s])([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,8})\b/);
    if (fileMatch) {
      file = sanitizeTelemetry(fileMatch[1], 80);
    }

    return { activeApp: sanitizeTelemetry(app, 60) || 'macOS', frontmostWindow: cleanWindow, activeFile: file };
  } catch {
    return { activeApp: 'macOS', frontmostWindow: '' };
  }
}

/** Probe battery level on macOS. */
export async function probeBatteryPct(): Promise<number | undefined> {
  if (process.platform !== 'darwin') return undefined;
  try {
    const { stdout } = await execFileAsync('pmset', ['-g', 'batt'], { timeout: 300 });
    const match = stdout.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : undefined;
  } catch {
    return undefined;
  }
}

// macOS memory truth: os.freemem() is nearly ALWAYS ~0 because the kernel
// uses idle RAM for cache/compressed/inactive pages — computing "used"
// from it reports ~99% permanently and makes every pressure alert a false
// positive (observed: governor fired "critical" while the kernel reported
// 45% free). kern.memorystatus_level is the kernel's own accounting —
// the same number `memory_pressure` prints as "System-wide memory free
// percentage". This is the honest signal.
let memLevelCache: { at: number; value: number | undefined } | null = null;
let memProbeWarnAt = 0;
const MEM_LEVEL_TTL_MS = 15_000;

export async function probeMemorystatusFreePct(): Promise<number | undefined> {
  if (process.platform !== 'darwin') return undefined;
  const now = Date.now();
  if (memLevelCache && now - memLevelCache.at < MEM_LEVEL_TTL_MS) {
    return memLevelCache.value;
  }
  let value: number | undefined;
  try {
    // 1.5s timeout — under heavy load (load>20 observed) sysctl can take
    // >400ms; a too-tight timeout made the probe silently return undefined
    // and the honest metric never reached the header.
    const { stdout } = await execFileAsync('sysctl', ['-n', 'kern.memorystatus_level'], { timeout: 1500 });
    const n = parseInt(String(stdout).trim(), 10);
    if (Number.isFinite(n) && n >= 0 && n <= 100) value = n;
  } catch (e: any) {
    // Throttled: failures aren't cached (fresh retry each tick) but the
    // warning shouldn't spam the log every 3s if sysctl stays broken.
    if (Date.now() - memProbeWarnAt > 60_000) {
      memProbeWarnAt = Date.now();
      console.warn('[world-state] memorystatus probe failed:', e?.message || e);
    }
  }
  // Only cache successes — a timed-out probe shouldn't blind us for 15s.
  if (value !== undefined) {
    memLevelCache = { at: now, value };
    // Publish to globalThis so SYNC consumers (system_info tool, somatic
    // tools) read the honest kernel figure without async plumbing. The
    // sampler refreshes it every ~3s — fresh enough for telemetry.
    (globalThis as any).__cortexMemFreePct = value;
  }
  return value;
}

/** Synchronous read of the last kernel free% — for tool handlers that
 *  can't await. Undefined until the first successful probe (~3s after
 *  server start). */
export function getCachedMemFreePct(): number | undefined {
  return (globalThis as any).__cortexMemFreePct;
}

/** Determine host topology (Mac local vs. Oracle UTC cloud). */
export function getTopology(): TopologyState {
  const hostname = os.hostname();
  const isOracle =
    process.env.CORTEX_INSTANCE === 'oracle' ||
    hostname.includes('syncscript-a1') ||
    (process.platform === 'linux' && process.arch === 'arm64');

  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  const utcDeltaHours = -offsetMinutes / 60;

  const localTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(now);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  return {
    instance: isOracle ? 'oracle' : 'mac',
    localTime,
    timezone,
    utcDeltaHours,
    hostname,
  };
}

// ── Oracle liveness probe (60s cache — ssh is too heavy for the 2s SWR path) ──
let oracleProbeCache: { alive: boolean; ts: number } | null = null;
const ORACLE_PROBE_TTL_MS = 60_000;

/** Probe Oracle runtime over ssh (BatchMode, bounded). On Oracle itself, trivially true. */
export async function probeOracleAlive(instance: 'mac' | 'oracle'): Promise<boolean> {
  if (instance === 'oracle') return true;
  const now = Date.now();
  if (oracleProbeCache && now - oracleProbeCache.ts < ORACLE_PROBE_TTL_MS) {
    return oracleProbeCache.alive;
  }
  try {
    await execFileAsync(
      'ssh',
      ['-o', 'ConnectTimeout=4', '-o', 'BatchMode=yes', 'oracle', 'true'],
      { timeout: 6000 },
    );
    oracleProbeCache = { alive: true, ts: now };
    return true;
  } catch {
    oracleProbeCache = { alive: false, ts: now };
    return false;
  }
}

// Frontmost-app probe spawns osascript (~50-150ms CPU each call). At the
// 3s sampler cadence that's ~2-5% of a core burned on telemetry — TTL it
// so app context refreshes every ~10s while vitals stay per-tick.
let frontmostCache: { at: number; value: UserContextState } | null = null;
const FRONTMOST_TTL_MS = 10_000;

async function probeFrontmostAppCached(): Promise<UserContextState> {
  const now = Date.now();
  if (frontmostCache && now - frontmostCache.at < FRONTMOST_TTL_MS) {
    return frontmostCache.value;
  }
  const value = await probeFrontmostApp();
  frontmostCache = { at: now, value };
  return value;
}

/** Gather somatic vitals (memory, CPU load, uptime). */
export function getSomaticVitals(): HostSomaticState {
  const total = os.totalmem();
  const free = os.freemem();
  const memUsedPct = total > 0 ? Math.round(((total - free) / total) * 100) : 0;
  const load = os.loadavg();
  const loadAvg1m = Math.round((load[0] || 0) * 10) / 10;
  const uptimeHours = Math.round((os.uptime() / 3600) * 10) / 10;

  return {
    loadAvg1m,
    memUsedPct,
    uptimeHours,
  };
}

// ── Repo-change watcher (FSEvents-backed fs.watch, macOS/Windows recursive) ──
// Watches src/ recursively plus key root manifests. .cortex-runtime and other
// runtime writes live outside src/, so they don't keep this timestamp hot.
// State lives on globalThis: Vite restarts re-evaluate this module but
// cannot cancel the previous module's fs.watch handles or intervals —
// module-level vars would let each restart stack duplicate watchers that
// write into dead state. Sharing via globalThis keeps one watcher set and
// one recency map across reloads.
const REPO_STATE_KEY = '__cortexRepoWatchState';
interface RepoWatchState {
  started: boolean;
  lastChangeAt?: number;
  pending: boolean;
  recent: Map<string, number>;
}
const g = globalThis as any;
if (!g[REPO_STATE_KEY]) {
  g[REPO_STATE_KEY] = { started: false, pending: false, recent: new Map<string, number>() } as RepoWatchState;
}
const repoState: RepoWatchState = g[REPO_STATE_KEY];
const RECENT_CHANGES_MAX = 30;
const RECENT_CHANGES_TTL_MS = 10 * 60_000;
const recentChanges = repoState.recent;

function recordRepoChange(filename: string | Buffer | null, watchRoot: string) {
  repoState.pending = true;
  if (!filename) return;
  // fs.watch reports paths relative to the WATCHED dir (src/, scripts/),
  // not the repo root — resolve against watchRoot then relativize to cwd.
  const rel = path.relative(process.cwd(), path.join(watchRoot, String(filename))).replace(/\\/g, '/');
  if (!rel || rel.startsWith('..')) return;
  recentChanges.set(rel, Date.now());
  if (recentChanges.size > RECENT_CHANGES_MAX) {
    // Evict oldest entries first.
    const entries = [...recentChanges.entries()].sort((a, b) => a[1] - b[1]);
    for (const [k] of entries.slice(0, recentChanges.size - RECENT_CHANGES_MAX)) {
      recentChanges.delete(k);
    }
  }
}

function prunedRecentChanges(): { path: string; at: number }[] {
  const cutoff = Date.now() - RECENT_CHANGES_TTL_MS;
  const out: { path: string; at: number }[] = [];
  for (const [p, at] of recentChanges) {
    if (at >= cutoff) out.push({ path: p, at });
    else recentChanges.delete(p);
  }
  return out.sort((a, b) => b.at - a.at).slice(0, 8);
}

function ensureRepoWatcher(): void {
  if (repoState.started || process.env.CORTEX_WORLD_STATE_WATCH === '0') return;
  repoState.started = true;
  const root = process.cwd();
  const targets = [path.join(root, 'src'), path.join(root, 'scripts')];
  for (const t of targets) {
    // Per-watcher closure: fs.watch filenames are relative to THEIR
    // watched dir, so each watcher needs its own root binding.
    const onEvent = (_ev: string, filename: string | Buffer | null) => {
      recordRepoChange(filename, t);
    };
    try {
      fs.watch(t, { recursive: true }, onEvent);
    } catch {
      // recursive unsupported (linux) or dir missing — fall back to shallow watch
      try { fs.watch(t, onEvent); } catch {}
    }
  }
  // Root manifests that affect the build but live outside watched dirs.
  for (const f of ['vite.config.ts', 'package.json', 'tsconfig.json']) {
    try { fs.watch(path.join(root, f), () => recordRepoChange(f, root)); } catch {}
  }
  const flusher = setInterval(() => {
    if (repoState.pending) {
      repoState.pending = false;
      repoState.lastChangeAt = Date.now();
    }
  }, 2000);
  flusher.unref?.();
}

// ── Refresh & Aggregation ───────────────────────────────────────────────────

// Slow-probe caches: the ambient sampler refreshes every ~3s, but git
// status porcelain and pmset are too heavy for that cadence — reuse
// their results on a slower TTL. App/vitals probes stay per-refresh.
const GIT_STATUS_TTL_MS = 15_000;
const BATTERY_TTL_MS = 60_000;
let gitStatusCache: { at: number; value: { isClean: boolean; dirtyCount: number; ok: boolean } } | null = null;
let batteryCache: { at: number; value: number | undefined } | null = null;

async function refreshWorldState(): Promise<WorldState> {
  ensureRepoWatcher();
  const now = Date.now();
  const topology = getTopology();
  const host = getSomaticVitals();
  const branch = getFastGitBranch();

  const gitP = (!gitStatusCache || now - gitStatusCache.at >= GIT_STATUS_TTL_MS)
    ? getGitStatus().then((v) => { gitStatusCache = { at: Date.now(), value: v }; return v; })
    : Promise.resolve(gitStatusCache.value);
  const battP = (!batteryCache || now - batteryCache.at >= BATTERY_TTL_MS)
    ? probeBatteryPct().then((v) => { batteryCache = { at: Date.now(), value: v }; return v; })
    : Promise.resolve(batteryCache.value);
  const memLevelP = probeMemorystatusFreePct();

  // Run async probes in parallel with timeouts
  const [user, git, batteryPct, oracleAlive, memFreePct] = await Promise.all([
    probeFrontmostAppCached(),
    gitP,
    battP,
    probeOracleAlive(topology.instance),
    memLevelP,
  ]);

  if (batteryPct !== undefined) {
    host.batteryPct = batteryPct;
  }
  // Fresh probe failed (sysctl can time out under heavy load) → fall back
  // to the last successful kernel reading published on globalThis. Stale-
  // by-seconds honest data beats the freemem artifact every time.
  const effectiveMemFreePct = memFreePct ?? getCachedMemFreePct();
  if (effectiveMemFreePct !== undefined) {
    host.memFreePct = effectiveMemFreePct;
    // Estimated absolute headroom from kernel accounting — honest "XGB
    // free" instead of the ~140MB freemem artifact macOS always reports.
    host.memFreeMB = Math.round((effectiveMemFreePct / 100) * os.totalmem() / 1048576);
  }

  // Probe fleet status from local state files
  let activeAgentCount = 0;
  try {
    const agentsPath = path.join(RUNTIME_DIR, 'agents-state.json');
    if (fs.existsSync(agentsPath)) {
      const data = JSON.parse(fs.readFileSync(agentsPath, 'utf8'));
      if (Array.isArray(data?.agents)) {
        activeAgentCount = data.agents.filter((a: any) => a.status === 'busy' || a.status === 'active').length;
      }
    }
  } catch {}

  const state: WorldState = {
    topology,
    user,
    host,
    codebase: {
      branch,
      isClean: git.isClean,
      dirtyCount: git.dirtyCount,
      statusKnown: git.ok,
      lastRepoChangeAt: repoState.lastChangeAt,
      recentChanges: prunedRecentChanges(),
    },
    fleet: {
      activeAgentCount,
      oracleAlive,
    },
    cachedAt: Date.now(),
  };

  cachedState = state;
  lastFetchMs = Date.now();
  return state;
}

/**
 * Get current living world state with 2000ms stale-while-revalidate caching.
 * Guaranteed never to throw; returns stale cache or fallback on error.
 */
export async function getWorldState(): Promise<WorldState> {
  const now = Date.now();

  // If cache is fresh, return immediately
  if (cachedState && now - lastFetchMs < CACHE_TTL_MS) {
    return cachedState;
  }

  // If stale but cached exists, trigger async refresh and return stale
  if (cachedState) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshWorldState()
        .catch(() => {})
        .finally(() => {
          isRefreshing = false;
        });
    }
    return cachedState;
  }

  // Cold start: perform synchronous first fetch
  try {
    return await refreshWorldState();
  } catch (err) {
    // Fallback safe state if catastrophic failure
    return {
      topology: getTopology(),
      user: { activeApp: 'macOS', frontmostWindow: '' },
      host: getSomaticVitals(),
      codebase: { branch: getFastGitBranch(), isClean: false, dirtyCount: 0, statusKnown: false },
      fleet: { activeAgentCount: 0, oracleAlive: false },
      cachedAt: Date.now(),
    };
  }
}

/**
 * Format the Living World State into a compact, 40-70 token context header
 * to be prepended to the system prompt or voice turn.
 */
export function formatWorldStateHeader(state: WorldState): string {
  const { topology, user, host, codebase } = state;

  const appInfo = user.activeFile
    ? `${user.activeApp} (${user.activeFile})`
    : user.activeApp !== 'macOS'
    ? user.activeApp
    : 'Desktop';

  const gitInfo = state.codebase.statusKnown === false
    ? `? (${codebase.branch})`
    : codebase.isClean
    ? `clean (${codebase.branch})`
    : `${codebase.dirtyCount} dirty (${codebase.branch})`;

  const hostNode = topology.instance === 'oracle' ? 'Oracle (UTC)' : 'Mac (Local)';
  const battInfo = host.batteryPct !== undefined ? ` | Batt: ${host.batteryPct}%` : '';
  // Fleet health only surfaced on Mac — on Oracle the host label already says where we are.
  const fleetInfo = topology.instance === 'mac'
    ? ` | Oracle: ${state.fleet.oracleAlive ? 'up' : 'DOWN'}`
    : '';

  // "Alive" signal: surface a just-happened edit so Cortex can reference
  // recency without a tool call. Only when the watcher saw a change <2min ago.
  const editAgeS = state.codebase.lastRepoChangeAt
    ? Math.max(0, Math.round((Date.now() - state.codebase.lastRepoChangeAt) / 1000))
    : undefined;
  const editInfo = editAgeS !== undefined && editAgeS < 120 ? ` | edit: ${editAgeS}s ago` : '';

  // Named recent file changes — "state of your files" sense. Top 3 with
  // ages, e.g. "files: loop.ts(8s) mission.ts(41s)".
  const rc = state.codebase.recentChanges;
  const fileInfo = rc?.length
    ? ` | files: ${rc.slice(0, 3).map(c => `${c.path.split('/').pop()}(${Math.max(0, Math.round((Date.now() - c.at) / 1000))}s)`).join(' ')}`
    : '';

  // Kernel accounting (memFreePct) is authoritative on macOS — freemem
  // reports ~0 permanently and would claim 99% used forever.
  const memInfo = host.memFreePct !== undefined
    ? ` | Mem: ${100 - host.memFreePct}% used (~${host.memFreeMB}MB free)`
    : host.memFreeMB !== undefined
      ? ` | Mem: ${host.memUsedPct}% (${host.memFreeMB}MB free)`
      : ` | Mem: ${host.memUsedPct}%`;

  return `[WORLD-STATE: ${topology.localTime} | App: ${appInfo} | Git: ${gitInfo} | Host: ${hostNode} | Load: ${host.loadAvg1m}${memInfo}${battInfo}${fleetInfo}${editInfo}${fileInfo}]`;
}

// ── Ambient sampler ─────────────────────────────────────────────────────────
// Cortex's wish: "perfect, instantaneous, lossless integration between the
// abstract models and the concrete, messy reality of the host." The SWR
// cache only refreshed when a turn asked — meaning the FIRST turn after a
// quiet period paid probe latency and saw stale state. This sampler keeps
// the blackboard perpetually warm: every turn now reads a sub-ms fresh
// snapshot instead of triggering probes. Slow probes (git/battery) are
// TTL-cached inside refreshWorldState, so a 3s cadence stays cheap.
// Guard on globalThis, not module scope: Vite restarts re-evaluate this
// module but can't cancel the old module's setInterval — a module-level
// flag would let each restart stack another 3s probe loop forever.
const SAMPLER_KEY = '__cortexWorldStateSampler';

// ── Host memory-pressure governor ──────────────────────────────────────────
// Cortex's wish included "never having to worry about an OOM kill in the
// middle of a critical operation." Infinite headroom isn't real — but
// acting BEFORE the kill is. The sampler already samples memUsedPct every
// 3s; this turns crossings into edge-triggered events so vite.config can
// reclaim RAM (idle sidecars, runtime prune) before the host thrashes.
// Hysteresis prevents flapping; state + listeners live on globalThis so a
// Vite restart can't orphan the governor on a dead module instance.
type PressureLevel = 'ok' | 'warn' | 'critical';
interface PressureState {
  level: PressureLevel;
  listeners: Set<(level: PressureLevel, pct: number) => void>;
}
const PRESSURE_KEY = '__cortexHostMemoryPressure';
const gPressure = globalThis as any;
if (!gPressure[PRESSURE_KEY]) {
  gPressure[PRESSURE_KEY] = { level: 'ok', listeners: new Set() } as PressureState;
}
const pressure: PressureState = gPressure[PRESSURE_KEY];

// Thresholds are on FREE percentage (kern.memorystatus_level): lower =
// worse. warn <25% free, critical <12% free, de-escalate only above 30% —
// the 25→30 band is the hysteresis that prevents flapping.
const PRESSURE_WARN_FREE_PCT = 25;
const PRESSURE_CRITICAL_FREE_PCT = 12;
const PRESSURE_EXIT_FREE_PCT = 30;

function nextPressureLevel(freePct: number): PressureLevel {
  if (pressure.level === 'critical' || pressure.level === 'warn') {
    return freePct < PRESSURE_CRITICAL_FREE_PCT ? 'critical'
      : freePct < PRESSURE_EXIT_FREE_PCT ? 'warn' : 'ok';
  }
  return freePct < PRESSURE_CRITICAL_FREE_PCT ? 'critical'
    : freePct < PRESSURE_WARN_FREE_PCT ? 'warn' : 'ok';
}

function checkHostMemoryPressure(freePct: number): void {
  if (!Number.isFinite(freePct) || freePct < 0 || freePct > 100) return;
  const next = nextPressureLevel(freePct);
  if (next === pressure.level) return;
  pressure.level = next;
  for (const fn of [...pressure.listeners]) {
    try { fn(next, freePct); } catch {}
  }
}

/** Register a host-memory-pressure listener. Fires only on level
 *  transitions (ok→warn→critical and back), never per-tick. Returns an
 *  unsubscribe function. */
export function onHostMemoryPressure(fn: (level: PressureLevel, pct: number) => void): () => void {
  pressure.listeners.add(fn);
  return () => { pressure.listeners.delete(fn); };
}

// ── World-state sample stream ──────────────────────────────────────────────
// Cortex's latest wish: "every file change, memory spike, and process death
// present in my awareness the instant it happens, before it becomes a
// crisis." The header is pull-telemetry — she still has to attend to it.
// This stream is push-telemetry: every fresh sampler tick emits the full
// snapshot to subscribers, and vite.config diffs consecutive samples into
// ambient events ("memory just spiked", "heavy edit burst"). The boundary
// between observation and action moves from query-time to event-time.
// globalThis-backed for the same restart-survival reason as the sampler.
type WorldSampleListener = (state: WorldState) => void;
const SAMPLE_KEY = '__cortexWorldStateSamples';
const gSamples = globalThis as any;
if (!gSamples[SAMPLE_KEY]) {
  gSamples[SAMPLE_KEY] = { listeners: new Set<WorldSampleListener>() };
}
const sampleBus: { listeners: Set<WorldSampleListener> } = gSamples[SAMPLE_KEY];

/** Subscribe to every fresh world-state sample (~3s cadence). Returns
 *  unsubscribe. Listeners must be cheap — they run on the sampler tick. */
export function onWorldStateSample(fn: WorldSampleListener): () => void {
  sampleBus.listeners.add(fn);
  return () => { sampleBus.listeners.delete(fn); };
}

function emitWorldSample(state: WorldState): void {
  for (const fn of [...sampleBus.listeners]) {
    try { fn(state); } catch {}
  }
}

export function startWorldStateSampler(intervalMs = 3000): void {
  const g = globalThis as any;
  // Publish THIS module instance's refresh — the surviving timer (armed by
  // whichever module loaded first) dispatches through this indirection so
  // after a Vite restart the newest code keeps the blackboard warm instead
  // of the zombie module probing forever with stale logic.
  g.__cortexWsRefresh = refreshWorldState;
  if (g[SAMPLER_KEY]) return;
  const tick = () => {
    void (g.__cortexWsRefresh?.() ?? refreshWorldState())
      .then((s: WorldState) => {
        // Prefer kernel free% (honest); fall back to 100-freemem%-used
        // only where sysctl doesn't exist (non-macOS hosts).
        const freePct = s?.host?.memFreePct
          ?? (s?.host?.memUsedPct !== undefined ? 100 - s.host.memUsedPct : NaN);
        checkHostMemoryPressure(freePct);
        emitWorldSample(s);
      })
      .catch(() => {});
  };
  tick(); // warm immediately — first turn shouldn't pay cold-start either
  g[SAMPLER_KEY] = setInterval(tick, intervalMs);
  g[SAMPLER_KEY].unref?.();
}
