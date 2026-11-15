#!/usr/bin/env node
/**
 * update-cortex-memory-gate — write one measured line into MEMORY.md + SESSION_START.md
 *
 * Cortex must help MEMORY as **truth + anti-rot**, not as an author of prose.
 * This script never streams workspace cycles, Φ, or bid logs into MEMORY.
 * It only refreshes the delimited "Last cortex gate" block with:
 *   pass/fail · Results · per-theory coverage · AVG · git SHA · ISO time
 *
 * Usage:
 *   node scripts/update-cortex-memory-gate.mjs              # re-run cortex-70, then write
 *   node scripts/update-cortex-memory-gate.mjs --from-log path.txt
 *   node scripts/update-cortex-memory-gate.mjs --dry-run
 *
 * Called by: npm run verify:cortex (after suites pass)
 */

import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DRY = process.argv.includes('--dry-run');
const fromLogIdx = process.argv.indexOf('--from-log');
const fromLog = fromLogIdx >= 0 ? process.argv[fromLogIdx + 1] : null;

const START = '<!-- cortex-gate:start -->';
const END = '<!-- cortex-gate:end -->';

function captureCortex70() {
  if (fromLog) {
    return readFileSync(resolve(fromLog), 'utf8');
  }
  try {
    return execFileSync('npx', ['tsx', 'src/lib/__tests__/cortex-70-validation.ts'], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      env: process.env,
    });
  } catch (err) {
    // Suite may exit non-zero; stdout still has Results + coverage when run via spawn failures.
    const out = (err.stdout && String(err.stdout)) || '';
    const errOut = (err.stderr && String(err.stderr)) || '';
    return out || errOut || String(err.message || err);
  }
}

function parseGate(log) {
  const results = log.match(/Results:\s*(\d+)\s+passed,\s*(\d+)\s+failed/);
  const passed = results ? Number(results[1]) : NaN;
  const failed = results ? Number(results[2]) : NaN;
  const theories = {};
  for (const name of ['GWT', 'IIT', 'HOT', 'RPT', 'AST', 'PP']) {
    const m = log.match(new RegExp(`^\\s*${name}\\s+([0-9.]+)\\s+\\(`, 'm'));
    if (m) theories[name] = m[1];
  }
  const avgM = log.match(/^\s*AVG\s+([0-9.]+)/m);
  const avg = avgM ? avgM[1] : null;
  const ok = Number.isFinite(failed) && failed === 0 && Number.isFinite(passed) && passed > 0;
  return { ok, passed, failed, theories, avg, rawOk: /Results:/.test(log) };
}

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function formatBlock(gate) {
  const iso = new Date().toISOString();
  const sha = gitSha();
  const theoryBits = ['GWT', 'AST', 'PP', 'RPT', 'HOT', 'IIT']
    .filter((k) => gate.theories[k] != null)
    .map((k) => `${k} ${gate.theories[k]}`)
    .join(' · ');
  const status = gate.ok ? 'PASS' : 'FAIL';
  const results =
    Number.isFinite(gate.passed) && Number.isFinite(gate.failed)
      ? `${gate.passed}/${gate.passed + gate.failed}`
      : 'unparsed';
  const avg = gate.avg != null ? gate.avg : 'n/a';

  // Single bullet for MEMORY / SESSION_START — dense, no Φ dumps.
  return [
    START,
    `**Last cortex gate (${iso}):** **${status}** · cortex-70 ${results} · coverage AVG **${avg}**` +
      (theoryBits ? ` (${theoryBits})` : '') +
      ` · git \`${sha}\` · source: \`npm run verify:cortex\` · **not a consciousness score**`,
    END,
  ].join('\n');
}

function upsertBlock(filePath, block) {
  if (!existsSync(filePath)) {
    console.log(`SKIP: ${filePath} missing`);
    return false;
  }
  let text = readFileSync(filePath, 'utf8');
  if (text.includes(START) && text.includes(END)) {
    const re = new RegExp(
      `${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'm',
    );
    text = text.replace(re, block);
  } else {
    // Insert after Current state heading if present, else append under Cortex section.
    const anchor = '### Current state (2026-08-04 — verified)';
    if (text.includes(anchor)) {
      // Prefer replacing placeholder sentence; else insert after first table
      const insertAfter = text.indexOf(anchor);
      const nextH = text.indexOf('\n### ', insertAfter + 10);
      const sliceEnd = nextH > 0 ? nextH : insertAfter + 400;
      // Fallback: put at start of file region — leave as append near end of cortex
      const marker = '**Verify (always re-measure before quoting scores):**';
      if (text.includes(marker)) {
        text = text.replace(marker, `${block}\n\n${marker}`);
      } else {
        text = `${text.trimEnd()}\n\n${block}\n`;
      }
    } else {
      text = `${text.trimEnd()}\n\n${block}\n`;
    }
  }
  if (DRY) {
    console.log(`--- dry-run ${filePath} ---\n${block}\n`);
    return true;
  }
  writeFileSync(filePath, text);
  console.log(`OK:   updated gate block in ${filePath}`);
  return true;
}

function ensureSessionStartMarker(text) {
  if (text.includes(START)) return text;
  // Place under Last session for operators who only open SESSION_START.
  const needle = '## Last session (update each time)';
  if (!text.includes(needle)) {
    return `${text.trimEnd()}\n\n${START}\n**Last cortex gate:** run \`npm run verify:cortex\`\n${END}\n`;
  }
  return text.replace(
    needle,
    `${needle}\n\n${START}\n**Last cortex gate:** run \`npm run verify:cortex\`\n${END}`,
  );
}

console.log('== update-cortex-memory-gate ==');
const log = captureCortex70();
const gate = parseGate(log);
if (!gate.rawOk) {
  console.log('FAIL: could not parse cortex-70 Results line from suite output');
  process.exitCode = 1;
  process.exit();
}

const block = formatBlock(gate);
console.log(block.replace(START, '').replace(END, '').trim());

upsertBlock('MEMORY.md', block);

let session = readFileSync('SESSION_START.md', 'utf8');
session = ensureSessionStartMarker(session);
if (!DRY) writeFileSync('SESSION_START.md', session);
upsertBlock('SESSION_START.md', block);

if (!gate.ok) {
  console.log('WARN: gate status is FAIL — MEMORY block still updated with FAIL marker');
  process.exitCode = 1;
} else {
  console.log('Summary: PASSED — MEMORY and SESSION_START carry the measured gate line only.');
}
