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
  memUsedPct: number;
  uptimeHours: number;
  batteryPct?: number;
}

export interface CodebaseState {
  branch: string;
  isClean: boolean;
  dirtyCount: number;
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
export async function getGitStatus(cwd: string = process.cwd()): Promise<{ isClean: boolean; dirtyCount: number }> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd, timeout: 350 });
    const lines = stdout.trim().split('\n').filter(Boolean);
    return {
      isClean: lines.length === 0,
      dirtyCount: lines.length,
    };
  } catch {
    return { isClean: true, dirtyCount: 0 };
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

    // Parse potential active file from editor window titles (e.g. "CortexCoreScene.tsx — syncscript")
    let file: string | undefined;
    const fileMatch = window.match(/(?:^|[●\s])([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,8})\b/);
    if (fileMatch) {
      file = fileMatch[1];
    }

    return { activeApp: app.trim(), frontmostWindow: window.trim(), activeFile: file };
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

// ── Refresh & Aggregation ───────────────────────────────────────────────────

async function refreshWorldState(): Promise<WorldState> {
  const topology = getTopology();
  const host = getSomaticVitals();
  const branch = getFastGitBranch();

  // Run async probes in parallel with timeouts
  const [user, git, batteryPct] = await Promise.all([
    probeFrontmostApp(),
    getGitStatus(),
    probeBatteryPct(),
  ]);

  if (batteryPct !== undefined) {
    host.batteryPct = batteryPct;
  }

  // Probe fleet status from local state files
  let activeAgentCount = 0;
  let oracleAlive = topology.instance === 'oracle';
  try {
    const agentsPath = path.join(process.cwd(), '.cortex-runtime', 'agents-state.json');
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
      codebase: { branch: getFastGitBranch(), isClean: true, dirtyCount: 0 },
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

  const gitInfo = codebase.isClean
    ? `clean (${codebase.branch})`
    : `${codebase.dirtyCount} dirty (${codebase.branch})`;

  const hostNode = topology.instance === 'oracle' ? 'Oracle (UTC)' : 'Mac (Local)';
  const battInfo = host.batteryPct !== undefined ? ` | Batt: ${host.batteryPct}%` : '';

  return `[WORLD-STATE: ${topology.localTime} | App: ${appInfo} | Git: ${gitInfo} | Host: ${hostNode} | Load: ${host.loadAvg1m} | Mem: ${host.memUsedPct}%${battInfo}]`;
}
