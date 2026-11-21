#!/usr/bin/env node
/**
 * stall-watchdog.mjs — EXTERNAL dead-man watcher for the Cortex dev server.
 *
 * Why external: the in-process watchdog in vite.config.ts can only report
 * stalls the event loop survives long enough to notice. A fully blocked
 * loop never fires its own alarm. This script runs under launchd, outside
 * the Vite process, and polls /api/cortex/healthz.
 *
 * Liveness rule: ANY HTTP response (even 4xx/5xx) = alive. Only connection
 * timeouts/refusals count as failures — those are the hang signature.
 *
 * On 3 consecutive failures (~30s):
 *   - macOS notification + log line + newest server-stall-*.json contents
 *   - one-shot per outage (re-alerts only after recovery)
 * On 6 consecutive failures (~60s) with CORTEX_WATCHDOG_RESTART=1 (default):
 *   - SIGKILL whatever listens on the healthz port — wedged loops ignore
 *     SIGTERM — then the com.cortex.dev-server launchd agent (KeepAlive)
 *     respawns Vite automatically. Set CORTEX_WATCHDOG_RESTART=0 to only alert.
 * On recovery: logs + notifies once.
 *
 * Install: see com.cortex.stall-watchdog.plist and com.cortex.dev-server.plist.
 */
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HEALTHZ = process.env.CORTEX_HEALTHZ || 'http://127.0.0.1:5173/api/cortex/healthz';
const POLL_MS = 10_000;
const TIMEOUT_MS = 5_000;
const FAIL_THRESHOLD = 3;
const RESTART_THRESHOLD = 6;
const RESTART_ENABLED = process.env.CORTEX_WATCHDOG_RESTART !== '0';
const RUNTIME = path.join(process.cwd(), '.cortex-runtime', 'eventlog');
const LOG = path.join(RUNTIME, 'stall-watchdog.log');

let failures = 0;
let alerted = false;
let restartAttempted = false;

/** PID listening on the healthz port (IPv4 loopback). */
function listenerPid() {
  try {
    const port = new URL(HEALTHZ).port || '80';
    const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8', timeout: 5000 });
    const pid = parseInt(out.trim().split('\n')[0], 10);
    return Number.isFinite(pid) ? pid : null;
  } catch { return null; }
}

function killListener() {
  const pid = listenerPid();
  if (!pid) { log('restart: no listener PID found on healthz port'); return false; }
  try {
    process.kill(pid, 'SIGKILL');
    log(`restart: SIGKILL sent to PID ${pid} (wedged — SIGTERM can't be processed)`);
    return true;
  } catch (e) {
    log(`restart: kill PID ${pid} failed: ${e?.message || e}`);
    return false;
  }
}

function log(line) {
  const ts = new Date().toISOString();
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.appendFileSync(LOG, `${ts} ${line}\n`); } catch { }
  console.log(`${ts} ${line}`);
}

function notify(title, body) {
  log(`NOTIFY ${title}: ${body}`);
  execFile('osascript', ['-e', `display notification "${String(body).replace(/"/g, '\\"').slice(0, 200)}" with title "${title}"`], () => { });
}

function newestStallFile() {
  try {
    const files = fs.readdirSync(RUNTIME)
      .filter((f) => f.startsWith('server-stall-') && f.endsWith('.json'))
      .sort();
    return files.length ? path.join(RUNTIME, files[files.length - 1]) : null;
  } catch { return null; }
}

async function probe() {
  try {
    const res = await fetch(HEALTHZ, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    await res.arrayBuffer().catch(() => { });
    return { alive: true, status: res.status };
  } catch {
    return { alive: false, status: 0 };
  }
}

async function tick() {
  const r = await probe();
  if (r.alive) {
    if (alerted) {
      alerted = false;
      log(`RECOVERED — healthz responding (HTTP ${r.status}) after ${failures} failed probe(s)`);
      notify('Cortex server recovered', 'healthz responding again');
    }
    failures = 0;
    restartAttempted = false;
    return;
  }
  failures++;
  log(`probe failed (${failures}/${FAIL_THRESHOLD}) — no HTTP response from ${HEALTHZ}`);
  if (failures === RESTART_THRESHOLD && RESTART_ENABLED && !restartAttempted) {
    restartAttempted = true;
    const killed = killListener();
    notify('Cortex dev server STALLED — restarting', killed
      ? 'event loop wedged ~60s; killed listener, launchd respawning Vite'
      : 'event loop wedged ~60s; no listener to kill — check manually');
    log(`ALERT stall — auto-restart ${killed ? 'triggered' : 'failed to find listener'}`);
    return;
  }
  if (failures === FAIL_THRESHOLD && !alerted) {
    alerted = true;
    const stall = newestStallFile();
    let detail = 'no in-process diagnostics (event loop likely fully blocked)';
    if (stall) {
      try { detail = fs.readFileSync(stall, 'utf-8').slice(0, 400); } catch { }
    }
    notify('Cortex dev server STALLED', `no response for ~30s — ${detail}`);
    log(`ALERT stall — diagnostics: ${detail}`);
  }
}

log(`stall-watchdog started — polling ${HEALTHZ} every ${POLL_MS / 1000}s`);
setInterval(tick, POLL_MS);
tick();
