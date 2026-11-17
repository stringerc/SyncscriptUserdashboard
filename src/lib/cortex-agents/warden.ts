/**
 * Cortex Warden — systems custodian.
 *
 * Read-only patrol agent: probes Cortex's own subsystems with real HTTP/fs
 * checks and reports anomalies. It never repairs — detection and honest
 * reporting only (spec: CORTEX_WARDEN.md).
 *
 * Every check is injectable (fetchImpl/fsImpl) so the suite is unit-
 * testable without a live server.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { WorkerHandler } from './runtime';
import type { AgentEvent } from './types';
import { rulesBlock } from './rules';
import { listIncidents } from './incidents';
import { runCounselPosition } from './counsel-position';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5173;
const BASE = `http://127.0.0.1:${PORT}`;

export interface PatrolCheck {
  name: string;
  ok: boolean;
  ms: number;
  detail?: string;
  critical: boolean;
}

export interface PatrolReport {
  at: number;
  durationMs: number;
  healthy: boolean;
  checks: PatrolCheck[];
  anomalies: string[];
  warnings: string[];
}

type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string>;
}>;

const defaultFetch: FetchLike = (url, init) => fetch(url, init) as any;

async function timed(
  name: string, critical: boolean, budgetMs: number,
  fn: () => Promise<string | undefined>,
): Promise<PatrolCheck> {
  const started = Date.now();
  try {
    const detail = await Promise.race([
      fn(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), budgetMs)),
    ]);
    return { name, ok: true, ms: Date.now() - started, critical, ...(detail ? { detail } : {}) };
  } catch (e: any) {
    return { name, ok: false, ms: Date.now() - started, critical, detail: String(e?.message || e).slice(0, 140) };
  }
}

async function getJson(url: string, fetchImpl: FetchLike, timeoutMs = 6000) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface PatrolDeps {
  base?: string;
  fetchImpl?: FetchLike;
  /** End-to-end LLM probe — returns true if a minimal completion succeeded. */
  llmProbe?: () => Promise<boolean>;
  /** Filesystem probes — injectable for tests. */
  fsImpl?: {
    stateDir: string;
    accomplishmentsDir: string;
    exists(p: string): boolean;
    writable(dir: string): boolean;
    newestMtimeMs(dir: string, suffix: string): number | null;
  };
  /** QC probes — incident ledger age + storefront product readiness.
   *  Injectable so the patrol suite stays unit-testable. */
  qcProbe?: {
    incidents(): { open: number; stale: number };
    productReadiness(): { total: number; ready: number; missing: string[] };
  };
}

/** Run the full patrol suite. Pure orchestration — every probe is real. */
export async function runPatrolChecks(deps: PatrolDeps = {}): Promise<PatrolReport> {
  const base = deps.base || BASE;
  const f = deps.fetchImpl || defaultFetch;
  const started = Date.now();
  const checks: PatrolCheck[] = [];

  // ── Agent runtime API ──
  checks.push(await timed('agents.runtime', true, 6000, async () => {
    const j: any = await getJson(`${base}/api/cortex/agents/state`, f);
    if (j?.offline) throw new Error('runtime reports offline');
    const n = Array.isArray(j?.agents) ? j.agents.length : 0;
    return `${n} agents registered`;
  }));

  // ── SSE stream liveness: first bytes within 3s ──
  checks.push(await timed('agents.stream', true, 4000, async () => {
    const res = await f(`${base}/api/cortex/agents/stream`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Consume until first SSE frame or body end.
    const reader = (res as any).body?.getReader?.();
    if (reader) {
      const { value } = await Promise.race([
        reader.read(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('no SSE bytes in 3s')), 3000)),
      ]);
      reader.cancel().catch(() => {});
      if (!value?.length) throw new Error('empty SSE stream');
      return 'SSE live';
    }
    return 'SSE endpoint reachable';
  }));

  // ── Model matrix: every lane must have ≥1 usable candidate ──
  checks.push(await timed('models.matrix', true, 6000, async () => {
    const j: any = await getJson(`${base}/api/cortex/models/health`, f);
    const health: any[] = j?.models || [];
    const matrix: Record<string, string[]> = j?.matrix || {};
    const now = Date.now();
    const laneReport: string[] = [];
    let deadLanes = 0;
    for (const tier of ['fast', 'reason', 'deep']) {
      const members = matrix[tier] || [];
      const usable = members.filter((mk) => {
        const h = health.find((x) => `${x.provider}:${x.id}` === mk || x.id === mk.split(':')[1]);
        if (!h) return true; // unprobed config candidates are allowed once
        if (h.status === 'down') return false;
        if (h.cooldownUntil && h.cooldownUntil > now) return false;
        return true;
      });
      if (!usable.length) deadLanes++;
      laneReport.push(`${tier}:${usable.length}/${members.length}`);
    }
    if (deadLanes) throw new Error(`lanes with zero usable models: ${laneReport.join(' ')}`);
    const down = health.filter((h) => h.status === 'down').length;
    return `${laneReport.join(' ')} · ${down} down`;
  }));

  // ── Governed tools endpoint ──
  checks.push(await timed('cortex.tools', true, 6000, async () => {
    const res = await f(`${base}/api/cortex/tools`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'tools catalog reachable';
  }));

  // ── Vigilance / free-energy engine ──
  checks.push(await timed('cortex.vigilance', false, 6000, async () => {
    const res = await f(`${base}/api/cortex/vigilance/status`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'vigilance status ok';
  }));

  // ── End-to-end LLM proof through the matrix ──
  checks.push(await timed('llm.fast', true, 20000, async () => {
    if (!deps.llmProbe) return 'skipped (no probe wired)';
    const ok = await deps.llmProbe();
    if (!ok) throw new Error('fast-lane completion failed');
    return 'fast lane answered';
  }));

  // ── External research backends ──
  // Scout's web_search failovers across DDG html → DDG lite → Mojeek.
  // Probe each; a dead backend narrows failover silently otherwise.
  checks.push(await timed('ext.search_backends', false, 25000, async () => {
    const q = encodeURIComponent('cortex healthcheck');
    const backends = [
      { name: 'ddg-html', url: `https://html.duckduckgo.com/html/?q=${q}` },
      { name: 'ddg-lite', url: `https://lite.duckduckgo.com/lite/?q=${q}` },
      { name: 'mojeek', url: `https://www.mojeek.com/search?q=${q}` },
    ];
    const alive: string[] = [];
    const down: string[] = [];
    for (const b of backends) {
      try {
        const r = await f(b.url, { headers: { 'User-Agent': 'cortex-warden/1.0' }, signal: AbortSignal.timeout(8000) });
        (r.ok ? alive : down).push(`${b.name}(${r.status})`);
      } catch { down.push(b.name); }
    }
    if (!alive.length) throw new Error(`all search backends down: ${down.join(', ')}`);
    return `alive: ${alive.map((a) => a.split('(')[0]).join(', ')}${down.length ? ` · down: ${down.join(', ')}` : ''}`;
  }));

  // ── Neural TTS chain: every configured endpoint probed; if ALL are dead
  // the client silently falls back to robotic browser speechSynthesis.
  checks.push(await timed('tts.neural', true, 15000, async () => {
    // Same endpoints the /api/cortex/tts handler resolves. vite.config
    // publishes the loadEnv()-resolved chain as CORTEX_TTS_ENDPOINTS; the
    // process.env singles + defaults are the fallback for tests/manual runs.
    let configured: { kokoro?: string | null; voicestudio?: string | null; pocket?: string | null } = {};
    try { configured = JSON.parse(process.env.CORTEX_TTS_ENDPOINTS || '{}'); } catch { /* ignore */ }
    const endpoints = [
      { name: 'kokoro', url: configured.kokoro || process.env.KOKORO_TTS_URL || null },
      { name: 'voicestudio', url: configured.voicestudio || process.env.VOICESTUDIO_URL || 'http://127.0.0.1:3900' },
      { name: 'pocket', url: configured.pocket || process.env.POCKET_TTS_URL || 'http://127.0.0.1:8890' },
    ].filter((e): e is { name: string; url: string } => !!e.url);
    if (!endpoints.length) return 'no neural TTS configured';
    const alive: string[] = [];
    const down: string[] = [];
    for (const ep of endpoints) {
      let ok = false;
      for (const p of ['/v1/models', '/health', '/']) {
        try {
          const r = await f(`${ep.url}${p}`, { signal: AbortSignal.timeout(3000) });
          // Any HTTP response means the server is alive — even 404/405.
          if (r.ok || r.status === 404 || r.status === 405) { ok = true; break; }
        } catch { /* try next path */ }
      }
      (ok ? alive : down).push(ep.name);
    }
    if (!alive.length)
      throw new Error(`all neural TTS down (${down.join(', ')}) — voice on browser synth`);
    return `alive: ${alive.join(', ')}${down.length ? ` · down: ${down.join(', ')}` : ''}`;
  }));

  // ── Runtime persistence ──
  checks.push(await timed('state.persistence', true, 5000, async () => {
    const fs = deps.fsImpl;
    if (!fs) return 'skipped (no fs probe wired)';
    if (!fs.exists(fs.stateDir)) throw new Error(`state dir missing: ${fs.stateDir}`);
    if (!fs.writable(fs.stateDir)) throw new Error('state dir not writable');
    const mtime = fs.newestMtimeMs(fs.stateDir, '.json');
    if (mtime == null) throw new Error('no state file found');
    const ageH = (Date.now() - mtime) / 3600_000;
    if (ageH > 24) throw new Error(`state file stale (${ageH.toFixed(1)}h)`);
    return `state fresh (${ageH.toFixed(1)}h)`;
  }));

  // ── Accomplishments ledger ──
  checks.push(await timed('ledger.accomplishments', false, 5000, async () => {
    const fs = deps.fsImpl;
    if (!fs) return 'skipped (no fs probe wired)';
    if (!fs.exists(fs.accomplishmentsDir)) throw new Error('accomplishments dir missing');
    if (!fs.writable(fs.accomplishmentsDir)) throw new Error('accomplishments dir not writable');
    return 'ledger writable';
  }));

  // ── QC: incident ledger aging ──
  // Stale tickets (open >24h) are untended work — surface them as a
  // warning every patrol so silence can't masquerade as health.
  checks.push(await timed('qc.incidents', false, 5000, async () => {
    if (!deps.qcProbe) return 'skipped (no qc probe wired)';
    const { open, stale } = deps.qcProbe.incidents();
    if (stale > 0) throw new Error(`${stale} incident(s) open >24h (${open} total open)`);
    return open ? `${open} open, none stale` : 'no open incidents';
  }));

  // ── QC: storefront product readiness ──
  // Every catalog product must have its deliverable files on disk —
  // a listing without a ZIP is vaporware, and vaporware must be loud.
  checks.push(await timed('qc.products', false, 5000, async () => {
    if (!deps.qcProbe) return 'skipped (no qc probe wired)';
    const r = deps.qcProbe.productReadiness();
    if (!r.total) return 'no catalog products';
    if (r.missing.length) throw new Error(`${r.missing.length}/${r.total} products missing files: ${r.missing.slice(0, 3).join(', ')}${r.missing.length > 3 ? '…' : ''}`);
    return `${r.ready}/${r.total} products have deliverables`;
  }));

  const anomalies = checks.filter((c) => !c.ok && c.critical).map((c) => `${c.name}: ${c.detail || 'failed'}`);
  const warnings = checks.filter((c) => !c.ok && !c.critical).map((c) => `${c.name}: ${c.detail || 'failed'}`);
  return {
    at: Date.now(),
    durationMs: Date.now() - started,
    healthy: anomalies.length === 0,
    checks,
    anomalies,
    warnings,
  };
}

/** Real fs probes for production use (server-side only). */
export function nodeFsProbes() {
  const stateDir = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
  const accomplishmentsDir = path.join(os.homedir(), '.openclaw', 'memory', 'accomplishments');
  return {
    stateDir,
    accomplishmentsDir,
    exists: (p: string) => fs.existsSync(p),
    writable: (dir: string) => {
      try {
        const probe = path.join(dir, `.warden-probe-${Date.now()}`);
        fs.writeFileSync(probe, 'ok');
        fs.unlinkSync(probe);
        return true;
      } catch { return false; }
    },
    newestMtimeMs: (dir: string, suffix: string) => {
      try {
        const files = fs.readdirSync(dir).filter((f) => f.endsWith(suffix));
        if (!files.length) return null;
        return Math.max(...files.map((f) => fs.statSync(path.join(dir, f)).mtimeMs));
      } catch { return null; }
    },
  };
}

/** Real QC probes — incident ledger + storefront catalog on local fs. */
export function nodeQcProbes() {
  const storefrontDir = path.join(process.cwd(), 'storefront');
  const catalogPath = path.join(storefrontDir, 'products', 'catalog-v2.json');
  // QC "stale" = open >30min. Escalation proposals file after 1min, so a
  // ticket still open at 30min means the filed investigation hasn't
  // produced a verified fix yet — that's the number worth warning on.
  const STALE_MIN = 30;
  return {
    incidents() {
      const open = listIncidents('open');
      const cutoff = Date.now() - STALE_MIN * 60_000;
      return {
        open: open.length,
        stale: open.filter((i) => i.firstSeenAt <= cutoff).length,
      };
    },
    productReadiness() {
      try {
        const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
        const products: any[] = Array.isArray(raw) ? raw : (raw.products || []);
        const missing: string[] = [];
        let ready = 0;
        for (const p of products) {
          const files: string[] = Array.isArray(p.files) ? p.files : [];
          const hasDeliverable = files.length > 0 && files.every((f) =>
            fs.existsSync(path.join(storefrontDir, String(f))));
          if (hasDeliverable) ready++;
          else missing.push(String(p.slug || p.name || '?'));
        }
        return { total: products.length, ready, missing };
      } catch {
        return { total: 0, ready: 0, missing: [] };
      }
    },
  };
}

const wardenWorker: WorkerHandler = async (ctx) => {
  if (ctx.task.kind === 'counsel_position')
    return runCounselPosition(ctx, 'warden', 'SURGEON — quality & blast-radius counsel (read-only)');
  if (ctx.task.kind !== 'patrol')
    throw new Error(`warden: unknown task kind '${ctx.task.kind}' (expected 'patrol')`);

  ctx.progress(0.1);
  const report = await runPatrolChecks({
    llmProbe: async () => {
      const text = await ctx.llm({
        tier: 'fast', maxTokens: 6,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      });
      return text.trim().length > 0;
    },
    fsImpl: nodeFsProbes(),
    qcProbe: nodeQcProbes(),
  });
  ctx.progress(0.8);

  // One cheap synthesis pass ONLY when something is wrong — healthy patrols
  // stay silent so the mission log isn't spammed with good news.
  let alert: string | null = null;
  if (!report.healthy) {
    try {
      alert = await ctx.llm({
        tier: 'fast', maxTokens: 160,
        messages: [{
          role: 'system',
          content: 'You are WARDEN, Cortex\'s systems custodian. A patrol found anomalies. Write ONE terse alert (max 2 sentences): what broke, likely cause, suggested first check. No speculation beyond the evidence.' + rulesBlock('warden patrol system anomalies alert custodian', 'constraints learned from accepted agent outcomes — follow unless they conflict with the alert task'),
        }, {
          role: 'user',
          content: `ANOMALIES:\n${report.anomalies.join('\n')}\nWARNINGS:\n${report.warnings.join('\n') || 'none'}`,
        }],
      });
    } catch { alert = null; }
  }

  ctx.emit({
    type: 'warden.patrol',
    report: {
      at: report.at, healthy: report.healthy,
      anomalies: report.anomalies, warnings: report.warnings,
      checks: report.checks.map((c) => ({ name: c.name, ok: c.ok, ms: c.ms })),
    },
    at: Date.now(),
  } as AgentEvent);

  // ── Pillar 1: Autonomous Immune System ──
  // When an anomaly is detected, auto-dispatch a self-healing mission to Antigravity (or Devin failover)
  if (!report.healthy && report.anomalies.length > 0) {
    const anomalySummary = report.anomalies[0].slice(0, 72);
    try {
      fetch(`${BASE}/api/cortex/agents/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'antigravity',
          kind: 'heal_anomaly',
          title: `Autonomous Anomaly Repair: ${anomalySummary}`,
          input: {
            anomalies: report.anomalies,
            warnings: report.warnings,
            instruction: `Analyze and resolve the system anomaly flagged by Warden: ${report.anomalies.join('; ')}. Verify with npm run verify:cortex before completing.`,
            autoHeal: true,
          },
        }),
      }).catch(() => {});
    } catch {}
  }

  ctx.progress(1);
  return { report, alert };
};

export function registerWardenWorker(runtime: { registerWorker(id: string, h: WorkerHandler): void }) {
  runtime.registerWorker('warden', wardenWorker);
}
