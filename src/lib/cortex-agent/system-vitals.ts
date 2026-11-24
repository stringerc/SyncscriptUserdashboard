/**
 * system-vitals.ts — live host truth for Cortex's own narration.
 *
 * Failure mode this kills: the agent citing stale numbers from context
 * ("10/10 SLOs", "port 5180", "26 dirty files", "memory 98%") instead of
 * measuring. One deterministic call returns the current truth: server,
 * git, resilience gate, memory, model fleet, workspace roots.
 * Everything is a local file read or bounded exec — sub-100ms, no LLM.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');

export const WORKSPACE_ROOTS = [
  { path: process.cwd(), role: 'SyncScript repo root (Cortex source, vite.config.ts)' },
  { path: '/Users/Apple/cortex-repos', role: 'Cortex packages + LAUNCH_PLAN.md + RELEASE_STRATEGY.md' },
  { path: '/Users/Apple/openclaw-node', role: 'OpenClaw source' },
  { path: '/Users/Apple/.openclaw', role: 'OpenClaw state, skills, config, gateway logs' },
  { path: RUNTIME, role: 'Cortex runtime state (tenants.json, tenant1.key, health/capability/resilience JSONL)' },
];

function gitVitals(): Record<string, unknown> {
  try {
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: process.cwd(), encoding: 'utf8', timeout: 4000 });
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: process.cwd(), encoding: 'utf8', timeout: 3000 }).trim();
    const dirty = status.split('\n').filter((l) => l.trim()).length;
    return { branch, dirtyFiles: dirty };
  } catch (e: any) {
    return { error: String(e?.message || e).slice(0, 120) };
  }
}

function resilienceVitals(): Record<string, unknown> {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'resilience-report.json'), 'utf8'));
    const slos = Array.isArray(r?.slos) ? r.slos : [];
    const ranAt = Number(r?.ranAt) || 0;
    return {
      pass: r?.pass === true,
      slosTotal: slos.length,
      slosPassing: slos.filter((s: any) => s?.pass).length,
      ranAt,
      ageMinutes: ranAt ? Math.round((Date.now() - ranAt) / 60000) : null,
      stale: ranAt ? Date.now() - ranAt > 24 * 3600_000 : true,
    };
  } catch {
    return { error: 'no resilience report — run POST /api/cortex/resilience {run:true}' };
  }
}

function modelVitals(): Record<string, unknown> {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'model-registry.json'), 'utf8'));
    const models = Array.isArray(r?.models) ? r.models : [];
    const by: Record<string, number> = {};
    for (const m of models) by[String(m?.status || 'unknown')] = (by[String(m?.status || 'unknown')] || 0) + 1;
    return { total: models.length, byStatus: by, savedAt: r?.savedAt ?? null };
  } catch {
    return { error: 'no model registry — sentinel has not run yet' };
  }
}

function memVitals(): Record<string, unknown> {
  // os.freemem() on macOS counts only truly-free pages and reads near-zero
  // under normal pressure — misleading. memory_pressure's "free percentage"
  // includes purgeable/inactive and matches what Activity Monitor shows.
  try {
    const out = execFileSync('memory_pressure', [], { encoding: 'utf8', timeout: 3000 });
    const m = out.match(/System-wide memory free percentage:\s*(\d+)%/);
    if (m) return { freePct: Number(m[1]), source: 'memory_pressure' };
  } catch {}
  const totalMem = os.totalmem();
  return { freePct: Math.round((os.freemem() / totalMem) * 100), source: 'os.freemem (fallback — reads low on macOS)' };
}

export function getSystemVitals(): Record<string, unknown> {
  return {
    ts: Date.now(),
    server: {
      port: process.env.PORT ? Number(process.env.PORT) : 5173,
      cwd: process.cwd(),
      uptimeSec: Math.round(process.uptime()),
    },
    host: {
      ...memVitals(),
      loadavg: os.loadavg().map((n) => Math.round(n * 100) / 100),
    },
    git: gitVitals(),
    resilience: resilienceVitals(),
    models: modelVitals(),
    workspaceRoots: WORKSPACE_ROOTS,
    note: 'Live measured values — cite these instead of remembered numbers. For file existence checks use list_dir/read_file on the workspaceRoots paths.',
  };
}
