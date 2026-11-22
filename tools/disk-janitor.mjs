#!/usr/bin/env node
/**
 * disk-janitor.mjs — periodic cleaner for the three temp-dir leaks that
 * filled the boot disk to 100% (2026-11-21 incident: 114MB free → ENOSPC →
 * vite crash-loop → swap exhaustion).
 *
 * Leak classes cleaned (all regenerable/orphaned — never user data):
 *   1. node-compile-cache  — V8 compile cache, grows unboundedly across
 *      node versions; entries older than NCC_MAX_AGE_DAYS are purged.
 *   2. Chrome code_sign_clone — macOS signature-validation clones that are
 *      never reaped; clones older than CLONE_MAX_AGE_DAYS are removed.
 *   3. Instruments xrtmp__<pid>.* — recording temp dirs orphaned when the
 *      recording process dies; removed when the PID is dead AND the dir is
 *      older than XR_TMP_MAX_AGE_DAYS.
 *   4. remotion-webpack-bundle-* — stale bundler temp dirs > 1 day.
 *   5. devin-overflows-* — old tool-output captures > 14 days.
 *
 * Guard: if the data volume drops below DISK_WARN_GB free (or DISK_WARN_PCT
 * capacity), it logs + notifies — alert only, never deletes user files.
 *
 * Runs weekly via com.cortex.disk-janitor.plist (StartCalendarInterval).
 * Manual run: node tools/disk-janitor.mjs [--dry-run]
 */
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const NOW = Date.now();
const DAY = 24 * 3600 * 1000;

const NCC_MAX_AGE_DAYS = Number(process.env.JANITOR_NCC_DAYS || 7);
const CLONE_MAX_AGE_DAYS = Number(process.env.JANITOR_CLONE_DAYS || 2);
const XR_TMP_MAX_AGE_DAYS = Number(process.env.JANITOR_XR_DAYS || 1);
const BUNDLE_MAX_AGE_DAYS = 1;
const OVERFLOW_MAX_AGE_DAYS = 14;
const DISK_WARN_GB = Number(process.env.JANITOR_WARN_GB || 20);
const DISK_WARN_PCT = Number(process.env.JANITOR_WARN_PCT || 10);

const USER_TEMP = process.env.TMPDIR; // e.g. /var/folders/2c/.../T/  (per-user temp)
const USER_CACHE = process.env.TMPDIR ? USER_TEMP.replace(/\/T\/$/, '/C/') : null;
const CHROME_CLONES = USER_TEMP ? path.join(USER_TEMP.replace(/\/T\/$/, '/X/'), 'com.google.Chrome.code_sign_clone') : null;
const RUNTIME = path.join(process.cwd(), '.cortex-runtime', 'eventlog');
const LOG = path.join(RUNTIME, 'disk-janitor.log');

function log(line) {
  const ts = new Date().toISOString();
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.appendFileSync(LOG, `${ts} ${line}\n`); } catch { }
  console.log(`${ts} ${line}`);
}

function notify(title, body) {
  log(`NOTIFY ${title}: ${body}`);
  execFile('osascript', ['-e', `display notification "${String(body).replace(/"/g, '\\"').slice(0, 200)}" with title "${title}"`], () => { });
}

function dirSizeBytes(p) {
  let total = 0;
  try {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const fp = path.join(p, e.name);
      try {
        if (e.isDirectory()) total += dirSizeBytes(fp);
        else total += fs.statSync(fp).size;
      } catch { }
    }
  } catch { }
  return total;
}

function rmrfSafe(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); return true; } catch { return false; }
}

/** Remove entries inside `dir` older than maxAgeDays; returns bytes freed. */
function cleanDirByAge(dir, maxAgeDays, nameFilter) {
  let freed = 0, removed = 0;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return { freed, removed }; }
  const cutoff = NOW - maxAgeDays * DAY;
  for (const e of entries) {
    if (nameFilter && !nameFilter(e.name)) continue;
    const fp = path.join(dir, e.name);
    try {
      const st = fs.statSync(fp);
      if (st.mtimeMs > cutoff) continue;
      freed += dirSizeBytes(fp);
      removed++;
      if (!DRY_RUN) rmrfSafe(fp);
    } catch { }
  }
  return { freed, removed };
}

/** Parse "xrtmp__<pid>.<suffix>" → pid, or null. */
function xrtmpPid(name) {
  const m = /^xrtmp__(\d+)\./.exec(name);
  return m ? parseInt(m[1], 10) : null;
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function dfAvailGB() {
  try {
    const out = execFileSyncText('df', ['-k', '/System/Volumes/Data']);
    const line = out.trim().split('\n').pop();
    const availKB = parseInt(line.split(/\s+/)[3], 10);
    return Number.isFinite(availKB) ? availKB / 1024 / 1024 : null;
  } catch { return null; }
}
function dfUsedPct() {
  try {
    const out = execFileSyncText('df', ['-k', '/System/Volumes/Data']);
    const line = out.trim().split('\n').pop();
    const used = parseInt(line.split(/\s+/)[2], 10);
    const total = parseInt(line.split(/\s+/)[1], 10);
    return total ? Math.round((used / total) * 100) : null;
  } catch { return null; }
}
function execFileSyncText(cmd, args) { return execFileSync(cmd, args, { encoding: 'utf8' }); }

function main() {
  log(`disk-janitor ${DRY_RUN ? '(DRY RUN) ' : ''}start — TMPDIR=${USER_TEMP}`);
  let totalFreed = 0;

  // 1. node-compile-cache — purge entries older than NCC_MAX_AGE_DAYS
  const nccDir = USER_TEMP ? path.join(USER_TEMP, 'node-compile-cache') : null;
  if (nccDir && fs.existsSync(nccDir)) {
    const r = cleanDirByAge(nccDir, NCC_MAX_AGE_DAYS);
    // version dirs hold nested cache files — if top-level dirs are young but
    // huge, recurse one level
    let nested = { freed: 0, removed: 0 };
    for (const e of fs.readdirSync(nccDir, { withFileTypes: true })) {
      const fp = path.join(nccDir, e.name);
      if (e.isDirectory()) {
        const inner = cleanDirByAge(fp, NCC_MAX_AGE_DAYS);
        nested.freed += inner.freed; nested.removed += inner.removed;
      }
    }
    const freed = r.freed + nested.freed, removed = r.removed + nested.removed;
    totalFreed += freed;
    log(`node-compile-cache: ${removed} entr${removed === 1 ? 'y' : 'ies'} older than ${NCC_MAX_AGE_DAYS}d → ${(freed / 1e9).toFixed(2)} GB`);
  }

  // 2. Chrome code_sign_clone — clones older than CLONE_MAX_AGE_DAYS
  if (CHROME_CLONES && fs.existsSync(CHROME_CLONES)) {
    const r = cleanDirByAge(CHROME_CLONES, CLONE_MAX_AGE_DAYS, (n) => n.startsWith('code_sign_clone.'));
    totalFreed += r.freed;
    log(`chrome code_sign_clone: ${r.removed} clones older than ${CLONE_MAX_AGE_DAYS}d → ${(r.freed / 1e9).toFixed(2)} GB`);
  }

  // 3. Instruments xrtmp__<pid>.* — dead PID AND older than XR_TMP_MAX_AGE_DAYS
  const xrDir = USER_CACHE ? path.join(USER_CACHE, 'com.apple.dt.Instruments', 'path_manager') : null;
  if (xrDir && fs.existsSync(xrDir)) {
    let freed = 0, removed = 0;
    const cutoff = NOW - XR_TMP_MAX_AGE_DAYS * DAY;
    for (const e of fs.readdirSync(xrDir, { withFileTypes: true })) {
      if (!e.isDirectory() || !e.name.startsWith('xrtmp__')) continue;
      const pid = xrtmpPid(e.name);
      const fp = path.join(xrDir, e.name);
      try {
        const st = fs.statSync(fp);
        if (st.mtimeMs > cutoff) continue;
        if (pid !== null && pidAlive(pid)) continue; // live recording — leave it
        freed += dirSizeBytes(fp);
        removed++;
        if (!DRY_RUN) rmrfSafe(fp);
      } catch { }
    }
    totalFreed += freed;
    log(`instruments xrtmp: ${removed} orphaned recordings → ${(freed / 1e9).toFixed(2)} GB`);
  }

  // 4. remotion-webpack-bundle-* older than 1 day
  if (USER_TEMP) {
    const r = cleanDirByAge(USER_TEMP, BUNDLE_MAX_AGE_DAYS, (n) => n.startsWith('remotion-webpack-bundle-'));
    totalFreed += r.freed;
    if (r.removed) log(`remotion bundles: ${r.removed} stale dirs → ${(r.freed / 1e9).toFixed(2)} GB`);
  }

  // 5. devin-overflows-* older than 14 days
  if (USER_TEMP) {
    const r = cleanDirByAge(USER_TEMP, OVERFLOW_MAX_AGE_DAYS, (n) => n.startsWith('devin-overflows-'));
    totalFreed += r.freed;
    if (r.removed) log(`devin-overflows: ${r.removed} old captures → ${(r.freed / 1e9).toFixed(2)} GB`);
  }

  // Guard: disk-free alarm (alert only)
  const avail = dfAvailGB(), usedPct = dfUsedPct();
  if (avail !== null) {
    const warn = avail < DISK_WARN_GB || (usedPct !== null && usedPct >= 100 - DISK_WARN_PCT);
    if (warn) {
      const msg = `Data volume low — ${avail.toFixed(1)} GB free (${usedPct}% used). Janitor freed ${(totalFreed / 1e9).toFixed(1)} GB this run.`;
      log(`WARN ${msg}`);
      notify('Disk space critical', msg);
    } else {
      log(`disk guard ok — ${avail.toFixed(1)} GB free (${usedPct}% used); freed ${(totalFreed / 1e9).toFixed(2)} GB total${DRY_RUN ? ' (dry run)' : ''}`);
    }
  }
}

main();
