/**
 * Lazy Sidecar Manager — wake-on-demand for the Cortex fleet.
 *
 * The resonance observer marks speaches, mlx-lm, parakeet-stt,
 * chatterbox-tts, and imsg-rpc as `lazy: true` — on-demand sidecars
 * kept dark to conserve the 16GB host's RAM. Their downtime is by
 * design, but when voice/TTS/STT/iMessage actually needs one, "dark"
 * becomes "degraded".
 *
 * This module closes the loop: ensureSidecar() probes health, spawns
 * the service detached on miss, and polls until ready (model loads
 * take 10–60s). Callers choose waitMs=0 for background warm (STT rung)
 * or a real budget where the request can absorb it (opt-in TTS).
 * sweepIdleSidecars() reaps spawned children after IDLE_MS so RAM
 * conservation resumes when the feature goes quiet.
 *
 * Spawn commands mirror the launchers documented in each tool dir.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PY = (v: string) => path.join(ROOT, 'tools', v, '.venv', 'bin', 'python');
const LOG_DIR = path.join(ROOT, '.cortex-runtime', 'sidecars');

/** stdout+stderr → .cortex-runtime/sidecars/<name>.log (append). */
function logFds(name: string): [number, number] {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const fd = fs.openSync(path.join(LOG_DIR, `${name}.log`), 'a');
    return [fd, fd];
  } catch {
    return ['ignore' as any, 'ignore' as any];
  }
}

interface SidecarDef {
  port: number;
  healthPath: string;
  bootTimeoutMs: number;
  spawn: () => ChildProcess;
}

const SIDECARS: Record<string, SidecarDef> = {
  'parakeet-stt': {
    port: 8179,
    healthPath: '/health',
    bootTimeoutMs: 90_000,
    spawn: () => spawn(PY('parakeet-stt'), [path.join(ROOT, 'tools/parakeet-stt/server.py')], {
      cwd: path.join(ROOT, 'tools/parakeet-stt'),
      env: { ...process.env, PORT: '8179' },
      stdio: ['ignore', ...logFds('parakeet-stt')],
      detached: true,
    }),
  },
  speaches: {
    port: 8932,
    healthPath: '/health',
    bootTimeoutMs: 120_000,
    spawn: () => spawn(PY('speaches'), [path.join(ROOT, 'tools/speaches/server.py')], {
      cwd: path.join(ROOT, 'tools/speaches'),
      env: { ...process.env, SPEACHES_PORT: '8932' },
      stdio: ['ignore', ...logFds('speaches')],
      detached: true,
    }),
  },
  'chatterbox-tts': {
    port: 8920,
    healthPath: '/',
    bootTimeoutMs: 120_000,
    spawn: () => spawn(PY('chatterbox-tts'), [
      path.join(ROOT, 'tools/chatterbox-tts/.venv/bin/mlx_audio.server'),
      '--host', '127.0.0.1', '--port', '8920',
    ], {
      cwd: path.join(ROOT, 'tools/chatterbox-tts'),
      env: { ...process.env },
      stdio: ['ignore', ...logFds('chatterbox-tts')],
      detached: true,
    }),
  },
  'mlx-lm': {
    port: 8931,
    healthPath: '/v1/models',
    bootTimeoutMs: 120_000,
    spawn: () => spawn('/opt/homebrew/bin/mlx_lm.server', [
      '--model', process.env.MLX_LM_MODEL || 'mlx-community/Qwen2.5-1.5B-Instruct-4bit',
      '--host', '127.0.0.1', '--port', '8931',
    ], {
      cwd: ROOT,
      env: { ...process.env, KMP_DUPLICATE_LIB_OK: 'TRUE' },
      stdio: ['ignore', ...logFds('mlx-lm')],
      detached: true,
    }),
  },
  'imsg-rpc': {
    port: 8930,
    healthPath: '/',
    bootTimeoutMs: 15_000,
    spawn: () => spawn(process.execPath, [path.join(ROOT, 'tools/imsg-rpc/server.mjs')], {
      cwd: ROOT,
      env: { ...process.env, IMSCG_RPC_PORT: '8930' },
      stdio: ['ignore', ...logFds('imsg-rpc')],
      detached: true,
    }),
  },
};

interface SidecarRuntime {
  child: ChildProcess | null;
  spawning: boolean;
  lastUsedAt: number;
  spawnCount: number;
}

const runtimes = new Map<string, SidecarRuntime>();
const IDLE_REAP_MS = 30 * 60 * 1000; // 30min quiet → sleep again

function rt(name: string): SidecarRuntime {
  let r = runtimes.get(name);
  if (!r) { r = { child: null, spawning: false, lastUsedAt: 0, spawnCount: 0 }; runtimes.set(name, r); }
  return r;
}

async function probe(def: SidecarDef): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${def.port}${def.healthPath}`, {
      signal: AbortSignal.timeout(2_000),
    });
    await res.arrayBuffer().catch(() => {});
    return res.status < 500;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Ensure a sidecar is reachable. waitMs=0 → background warm only
 * (returns current status immediately). waitMs>0 → polls until ready
 * or budget exhausted; returns true when healthy.
 */
export async function ensureSidecar(name: string, waitMs = 0): Promise<boolean> {
  const def = SIDECARS[name];
  if (!def) return false;
  const r = rt(name);

  if (await probe(def)) {
    r.lastUsedAt = Date.now();
    return true;
  }

  if (!r.spawning) {
    r.spawning = true;
    r.spawnCount += 1;
    try {
      const child = def.spawn();
      child.on('error', () => { r.spawning = false; r.child = null; });
      child.on('exit', () => { r.spawning = false; if (r.child === child) r.child = null; });
      child.unref?.();
      r.child = child;
      // Grace from birth — without this a booting sidecar has
      // lastUsedAt=0 and the idle sweeper SIGTERMs it mid-boot.
      r.lastUsedAt = Date.now();
    } catch {
      r.spawning = false;
      return false;
    }
  }

  if (waitMs <= 0) return false;
  const deadline = Date.now() + Math.min(waitMs, def.bootTimeoutMs);
  while (Date.now() < deadline) {
    await sleep(1_000);
    if (await probe(def)) {
      r.lastUsedAt = Date.now();
      return true;
    }
    if (!r.spawning && !r.child) return false; // died during boot
  }
  return false;
}

/** Fire-and-forget warm — for request paths that can't absorb cold start. */
export function warmSidecar(name: string): void {
  void ensureSidecar(name, 0);
}

/** Warm the voice-critical pair in parallel (background). */
export function warmVoiceStack(): void {
  warmSidecar('parakeet-stt');
  warmSidecar('chatterbox-tts');
}

/**
 * Reap sidecars we spawned that have been idle > IDLE_REAP_MS.
 * Only kills children THIS manager spawned — never touches services
 * started outside it (launchd, manual runs).
 */
export function sweepIdleSidecars(now = Date.now()): string[] {
  const reaped: string[] = [];
  for (const [name, r] of runtimes) {
    if (!r.child || r.spawning || now - r.lastUsedAt < IDLE_REAP_MS) continue;
    try { r.child.kill('SIGTERM'); } catch {}
    r.child = null;
    reaped.push(name);
  }
  return reaped;
}

/** Status snapshot for observability endpoints. */
export function sidecarStatus(): Record<string, { port: number; spawned: boolean; lastUsedAt: number; spawnCount: number }> {
  const out: Record<string, any> = {};
  for (const [name, def] of Object.entries(SIDECARS)) {
    const r = runtimes.get(name);
    out[name] = {
      port: def.port,
      spawned: !!r?.child,
      lastUsedAt: r?.lastUsedAt || 0,
      spawnCount: r?.spawnCount || 0,
    };
  }
  return out;
}
