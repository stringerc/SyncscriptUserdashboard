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
import { execSync } from 'node:child_process';
import type { WorkerHandler } from './runtime';
import type { AgentEvent } from './types';
import { rulesBlock } from './rules';
import { listIncidents, recordIncidentFailure, resolveIncidentsOnSuccess } from './incidents';
import { readArchive } from './archive';
import { runCounselPosition } from './counsel-position';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5173;
const BASE = `http://127.0.0.1:${PORT}`;

/** Heal-dispatch circuit breaker — see Pillar 1 block in wardenWorker. */
const HEAL_DISPATCH_COOLDOWN_MS = 30 * 60_000;
let lastHealDispatchAt = 0;

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

/** Repo-hygiene classification: paths that are regenerable runtime churn
 *  vs real uncommitted work. Default is 'real' — unknown paths err toward
 *  attention, not silence. Keep in sync with .gitignore churn rules. */
export function classifyRepoPath(p: string): 'real' | 'churn' {
  const clean = p.trim().replace(/^"|"$/g, '');
  if (!clean) return 'churn';
  return /^(\.cortex\/|\.cortex-runtime\/|\.superpowers\/|node_modules\/|dist\/|__pycache__\/|.*\.pyc$|tsconfig\.tsbuildinfo$|models\.matrix$|public\/screenshots\/|storefront\/browser\/latest\.|storefront\/distribution-(queue\.json|dashboard\.html)$|MEMORY\.md$|dream-log\.md$|morning-briefing\.md$|example\.txt$|<correct_path>$)/.test(clean)
    ? 'churn' : 'real';
}

export interface RepoHygieneReport {
  realCount: number;
  churnCount: number;
  /** Age in hours of the oldest REAL dirty path; null when none. */
  oldestRealAgeH: number | null;
  /** Up to 5 sample real paths for the report detail. */
  sampleFiles: string[];
}

/** Stale-work threshold: dirty for less than this is someone mid-task. */
export const REPO_STALE_HOURS = 4;
/** Minimum gap between repo_hygiene incident re-fires while one is open. */
export const REPO_INCIDENT_REFIRE_MS = 2 * 60 * 60 * 1000;
let lastRepoHygieneIncidentAt = 0;
let lastFileIntegrityIncidentAt = 0;

/** Real git probe — porcelain status + mtime aging. Injectable for tests. */
export function nodeRepoProbe(repoRoot = process.cwd()): () => RepoHygieneReport {
  return () => {
    let out = '';
    try {
      out = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf-8', timeout: 8000 });
    } catch {
      return { realCount: 0, churnCount: 0, oldestRealAgeH: null, sampleFiles: [] };
    }
    const realFiles: { p: string; ageH: number }[] = [];
    let churnCount = 0;
    for (const line of out.split('\n')) {
      if (line.length < 4) continue;
      let p = line.slice(3).trim();
      const arrow = p.indexOf(' -> ');
      if (arrow >= 0) p = p.slice(arrow + 4); // renames: report the new path
      p = p.replace(/^"|"$/g, '');
      if (classifyRepoPath(p) === 'churn') { churnCount++; continue; }
      let ageH = 999; // deleted/unstat-able paths count as maximally stale
      try {
        const st = fs.statSync(path.join(repoRoot, p));
        ageH = (Date.now() - st.mtimeMs) / 3600_000;
      } catch { /* deleted file — stays 999 */ }
      realFiles.push({ p, ageH });
    }
    realFiles.sort((a, b) => b.ageH - a.ageH);
    return {
      realCount: realFiles.length,
      churnCount,
      oldestRealAgeH: realFiles.length ? realFiles[0].ageH : null,
      sampleFiles: realFiles.slice(0, 5).map((f) => f.p),
    };
  };
}

// ── Critical-file integrity ────────────────────────────────────────
// A single bad agent edit can truncate a 13k-line config and take the
// whole API surface down silently (happened 2026-11-18: vite.config.ts
// lost 2,712 lines mid-file). Warden keeps a line-count snapshot plus a
// last-good backup of each watched file; a >40% shrink or a missing file
// is a warning-level anomaly that files a Crew-gated incident — Warden
// detects, never repairs.

export interface FileIntegrityReport {
  watched: number;
  /** Files whose line count fell below SHRINK_THRESHOLD of the snapshot. */
  truncated: string[];
  /** Watched files that no longer exist on disk. */
  missing: string[];
  /** Human-readable detail for the patrol check. */
  detail: string;
}

/** Files whose silent truncation has fleet-wide blast radius. */
export const FILE_INTEGRITY_WATCH = [
  'vite.config.ts',
  'src/lib/cortex-agents/runtime.ts',
  'src/lib/cortex-agents/workers.ts',
  'src/lib/cortex-agents/mission.ts',
  'src/lib/cortex-agents/strategy-proposals.ts',
  'src/lib/cortex-agents/directives.ts',
  'src/lib/cortex-agents/messages.ts',
  'src/lib/cortex-agents/warden.ts',
  'src/components/cortex/CortexFoundryNav.tsx',
];

/** Below this fraction of the snapshotted line count = truncation suspect. */
export const FILE_SHRINK_THRESHOLD = 0.6;

interface IntegritySnapshot {
  files: Record<string, { lines: number; mtimeMs: number }>;
}

function integrityPaths(repoRoot: string) {
  const stateDir = process.env.CORTEX_AGENTS_STATE_DIR || path.join(repoRoot, '.cortex-runtime');
  return {
    snapshot: path.join(stateDir, 'file-integrity.json'),
    backups: path.join(stateDir, 'file-backups'),
  };
}

function readIntegritySnapshot(p: string): IntegritySnapshot {
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return { files: d?.files && typeof d.files === 'object' ? d.files : {} };
  } catch { return { files: {} }; }
}

function countLines(file: string): number {
  try { return fs.readFileSync(file, 'utf-8').split('\n').length; }
  catch { return -1; }
}

/** Real probe: compares watched files against the persisted snapshot and
 *  maintains last-good backups. First run establishes the baseline. */
export function nodeFileIntegrityProbe(repoRoot = process.cwd()): () => FileIntegrityReport {
  return () => {
    const { snapshot: snapPath, backups } = integrityPaths(repoRoot);
    const snap = readIntegritySnapshot(snapPath);
    const truncated: string[] = [];
    const missing: string[] = [];
    const changed: Record<string, { lines: number; mtimeMs: number }> = {};
    let detail = '';

    for (const rel of FILE_INTEGRITY_WATCH) {
      const abs = path.join(repoRoot, rel);
      const prev = snap.files[rel];
      const lines = countLines(abs);
      if (lines < 0) {
        missing.push(rel);
        continue; // deleted file — never overwrite last-good snapshot
      }
      if (prev && lines < prev.lines * FILE_SHRINK_THRESHOLD) {
        truncated.push(`${rel} (${prev.lines}→${lines} lines)`);
        continue; // keep last-good snapshot + backup untouched
      }
      let mtimeMs = 0;
      try { mtimeMs = fs.statSync(abs).mtimeMs; } catch { /* ignore */ }
      // Accept the change: refresh snapshot and rotate a last-good backup.
      if (!prev || mtimeMs !== prev.mtimeMs || lines !== prev.lines) {
        try {
          fs.mkdirSync(backups, { recursive: true });
          const safe = rel.replace(/[^a-zA-Z0-9._-]/g, '_');
          fs.copyFileSync(abs, path.join(backups, safe));
        } catch { /* backup is best-effort */ }
        changed[rel] = { lines, mtimeMs };
      } else {
        changed[rel] = prev;
      }
    }

    // Persist merged snapshot (unchanged entries keep prior values).
    try {
      fs.mkdirSync(path.dirname(snapPath), { recursive: true });
      fs.writeFileSync(snapPath, JSON.stringify({ files: { ...snap.files, ...changed } }, null, 2));
    } catch { /* persistence best-effort */ }

    if (truncated.length || missing.length) {
      detail = [
        truncated.length ? `truncated: ${truncated.join(', ')}` : '',
        missing.length ? `missing: ${missing.join(', ')}` : '',
        `last-good backups in .cortex-runtime/file-backups/`,
      ].filter(Boolean).join(' · ');
    } else {
      detail = `${FILE_INTEGRITY_WATCH.length} critical files intact`;
    }
    return { watched: FILE_INTEGRITY_WATCH.length, truncated, missing, detail };
  };
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
  /** Repo hygiene — uncommitted-work aging. Injectable for tests. */
  repoProbe?: () => RepoHygieneReport;
  /** Critical-file integrity — truncation/shrink detection with last-good
   *  backups. Injectable for tests. */
  fileProbe?: () => FileIntegrityReport;
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

  // ── Repo hygiene: real uncommitted work aging past the stale threshold.
  //  Churn (runtime state, generated artifacts, agent memory docs) is
  //  classified out — only source/config/doc changes count. Warning-level:
  //  stale work is risk, not outage. Escalation to the Inbox happens in
  //  wardenWorker via the incident ledger — Warden never commits.
  checks.push(await timed('repo.hygiene', false, 10000, async () => {
    if (!deps.repoProbe) return 'skipped (no repo probe wired)';
    const r = deps.repoProbe();
    if (!r.realCount) return r.churnCount ? `${r.churnCount} churn paths ignored` : 'working tree clean';
    const age = r.oldestRealAgeH ?? 0;
    const detail = `${r.realCount} real uncommitted (oldest ${age >= 999 ? 'stale-deleted' : age.toFixed(1) + 'h'}): ${r.sampleFiles.join(', ')}`;
    if (age >= REPO_STALE_HOURS || age >= 999)
      throw new Error(`${detail} — aging uncommitted work`);
    return detail;
  }));

  // ── Critical-file integrity: silent truncation of fleet-wide files.
  //  Warning-level — detection files a Crew-gated incident; Warden never
  //  repairs. Last-good backups live in .cortex-runtime/file-backups/.
  checks.push(await timed('files.integrity', false, 8000, async () => {
    if (!deps.fileProbe) return 'skipped (no file probe wired)';
    const r = deps.fileProbe();
    if (r.truncated.length || r.missing.length) throw new Error(r.detail);
    return r.detail;
  }));

  // ── Fleet context pressure (ECC strategic-compact adaptation) ──
  // p95 tokensIn per agent over recent archived tasks — ECC watches one
  // session's transcript; Cortex watches every agent's real token burn.
  // Warning-level: pressure is a compaction/nudge signal, never silent
  // context discarding.
  checks.push(await timed('fleet.context_pressure', false, 5000, async () => {
    const records = readArchive({ limit: 300 });
    const byAgent = new Map<string, number[]>();
    for (const r of records) {
      const t = (r.telemetry as any)?.tokensIn;
      if (typeof t === 'number' && t > 0 && r.agentId) {
        if (!byAgent.has(r.agentId)) byAgent.set(r.agentId, []);
        byAgent.get(r.agentId)!.push(t);
      }
    }
    const pressured: string[] = [];
    let total = 0;
    for (const [agent, arr] of byAgent) {
      total += arr.length;
      arr.sort((a, b) => a - b);
      const p95 = arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.95))];
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      if (p95 > 9000 || avg > 6000) pressured.push(`${agent} p95=${p95}tok avg=${Math.round(avg)}tok (n=${arr.length})`);
    }
    if (!total) return 'no token telemetry yet';
    if (pressured.length) throw new Error(`context pressure: ${pressured.join('; ')} — review prompt sizes / enable compaction`);
    return `${total} tasks measured, all agents within context budget`;
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
    repoProbe: nodeRepoProbe(),
    fileProbe: nodeFileIntegrityProbe(),
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
  // Circuit breaker: a dead provider lane once turned every patrol into a
  // fresh heal_anomaly submission (198-count incident storm in ~22h).
  // Cooldown + in-flight check bound the burn; real failures still land
  // in the incident ledger.
  if (!report.healthy && report.anomalies.length > 0) {
    const now = Date.now();
    let inFlight = false;
    try {
      const st: any = await fetch(`${BASE}/api/cortex/agents/state`, { signal: AbortSignal.timeout(3000) }).then((r) => r.json());
      inFlight = (st?.tasks || []).some((t: any) => t.kind === 'heal_anomaly' && (t.status === 'queued' || t.status === 'running'));
    } catch { /* state read failure → allow dispatch; cooldown still bounds it */ }
    if (!inFlight && now - lastHealDispatchAt >= HEAL_DISPATCH_COOLDOWN_MS) {
      lastHealDispatchAt = now;
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
  }

  // Stale uncommitted work → incident ticket; the 60s sweeper turns it
  // into an Inbox proposal. Warden detects and escalates — never commits.
  // Re-fire cooldown: a persistent condition (e.g. an unresolved deletion)
  // would otherwise increment the ticket every patrol and keep it looking
  // freshly-broken forever. One open ticket + a refresh every 2h is enough.
  const repoCheck = report.checks.find((c) => c.name === 'repo.hygiene');
  if (repoCheck && !repoCheck.ok) {
    const alreadyOpen = listIncidents('open').some(
      (i) => i.agentId === 'warden' && i.kind === 'repo_hygiene',
    );
    if (!alreadyOpen || Date.now() - lastRepoHygieneIncidentAt > REPO_INCIDENT_REFIRE_MS) {
      lastRepoHygieneIncidentAt = Date.now();
      recordIncidentFailure({
        taskId: ctx.task.id,
        agentId: 'warden',
        agentName: 'WARDEN',
        kind: 'repo_hygiene',
        title: 'Aging uncommitted work in syncscript tree',
        failureClass: 'hygiene_stale',
        error: repoCheck.detail,
      });
    }
  } else if (repoCheck && repoCheck.ok) {
    resolveIncidentsOnSuccess('warden', 'repo_hygiene', ctx.task.id);
  }

  // Critical-file truncation → incident ticket → Crew-gated Inbox proposal.
  // Same cooldown discipline as repo_hygiene; restores stay a human call.
  const fileCheck = report.checks.find((c) => c.name === 'files.integrity');
  if (fileCheck && !fileCheck.ok) {
    const alreadyOpen = listIncidents('open').some(
      (i) => i.agentId === 'warden' && i.kind === 'file_integrity',
    );
    if (!alreadyOpen || Date.now() - lastFileIntegrityIncidentAt > REPO_INCIDENT_REFIRE_MS) {
      lastFileIntegrityIncidentAt = Date.now();
      recordIncidentFailure({
        taskId: ctx.task.id,
        agentId: 'warden',
        agentName: 'WARDEN',
        kind: 'file_integrity',
        title: 'Critical file truncation or deletion detected',
        failureClass: 'file_integrity',
        error: fileCheck.detail,
      });
    }
  } else if (fileCheck && fileCheck.ok) {
    resolveIncidentsOnSuccess('warden', 'file_integrity', ctx.task.id);
  }

  ctx.progress(1);
  return { report, alert };
};

export function registerWardenWorker(runtime: { registerWorker(id: string, h: WorkerHandler): void }) {
  runtime.registerWorker('warden', wardenWorker);
}
