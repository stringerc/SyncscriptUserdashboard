#!/usr/bin/env node
/**
 * guard-cortex-typecheck — type-check the consciousness/cortex surface.
 *
 * Why this exists (2026-08-04)
 * ----------------------------
 * `CONSCIOUSNESS_STATUS.md` claimed "zero TypeScript errors in all cortex files" and
 * "50/50 validation tests pass". Both were true when written and neither was checkable
 * afterwards, so when `src/lib/global-workspace.ts` was later replaced by a simpler
 * key-value blackboard — dropping the `WorkspaceSpecialist` / `WorkspaceBid` /
 * `WorkspaceBroadcast` / `IgnitionSignature` / `resetGlobalWorkspace` exports that six
 * consumers import — nothing objected.
 *
 * Nothing objected because nothing was looking:
 *
 *   - `npm run build` is bare `vite build`; esbuild strips types without checking them
 *   - there is no `typecheck` script in package.json
 *   - `npm run lint` covers `src/components/app` and one context file
 *   - none of the three cortex validation suites are in `npm test`
 *
 * A research claim with no runner is not a result, it is a memory of one. This is the
 * cheapest gate that would have caught it.
 *
 * Usage:
 *   node scripts/guard-cortex-typecheck.mjs
 *   node scripts/guard-cortex-typecheck.mjs --list   # print every error, not just a summary
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const LIST_ALL = process.argv.includes('--list');

/** The consciousness/cortex surface. Errors anywhere in here fail the gate. */
const SURFACE = [
  /^src\/lib\/cortex-/,
  /^src\/lib\/global-workspace\.ts/,
  /^src\/lib\/registry\.ts/,
  /^src\/lib\/attention-schema\.ts/,
  /^src\/lib\/integrated-information\.ts/,
  /^src\/lib\/metacognitive-/,
  /^src\/lib\/identity-(anchor|spine)\.ts/,
  /^src\/lib\/narrative-synthesis\.ts/,
  /^src\/lib\/hierarchical-generative-model\.ts/,
  /^src\/lib\/sensorimotor-loop\.ts/,
  /^src\/lib\/action-(gate|observer)\.ts/,
  /^src\/lib\/semantic-grid\.ts/,
  /^src\/lib\/veto-ledger\.ts/,
  /^src\/lib\/(causal-model|structural-equation-model)\.ts/,
  /^src\/lib\/epistemic-provenance\.ts/,
  /^src\/lib\/environmental-(coupling|interceptors)\.ts/,
  /^src\/lib\/memory-substrate\.ts/,
  /^src\/lib\/state-persistence\.ts/,
  /^src\/lib\/system-integration-check\.ts/,
  /^src\/lib\/consciousness\//,
  /^src\/lib\/__tests__\//,
];

const ok = (m) => console.log(`OK:   ${m}`);
const fail = (m) => console.log(`FAIL: ${m}`);
const info = (m) => console.log(`      ${m}`);

console.log('== guard-cortex-typecheck ==\n');

if (!existsSync('tsconfig.json')) {
  fail('no tsconfig.json at the repo root');
  process.exit(1);
}

let raw = '';
try {
  // tsc exits non-zero when it reports errors, which is the expected path here.
  raw = execFileSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  });
} catch (err) {
  raw = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  if (!raw.trim()) {
    fail(`could not run tsc: ${err.message}`);
    process.exit(1);
  }
}

const ERROR_LINE = /^(\S+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const surfaceErrors = [];
let totalErrors = 0;

for (const line of raw.split('\n')) {
  const m = ERROR_LINE.exec(line.trim());
  if (!m) continue;
  totalErrors += 1;
  const [, file, lineNo, , code, message] = m;
  if (SURFACE.some((re) => re.test(file))) {
    surfaceErrors.push({ file, lineNo, code, message });
  }
}

const elsewhere = totalErrors - surfaceErrors.length;

if (surfaceErrors.length === 0) {
  ok(`cortex surface type-checks clean (${totalErrors} error(s) elsewhere in the repo, not this gate's concern)`);
  console.log('\nSummary: PASSED');
  process.exit(0);
}

fail(`${surfaceErrors.length} type error(s) on the cortex surface`);

// Missing exports are the specific regression this gate was built for, so name them.
const missingExports = new Map();
for (const e of surfaceErrors) {
  const m = /has no exported member(?: named)? '([^']+)'/.exec(e.message);
  if (!m) continue;
  const mod = /Module '"([^"]+)"'|'"([^"]+)"'/.exec(e.message);
  const key = m[1];
  if (!missingExports.has(key)) missingExports.set(key, new Set());
  missingExports.get(key).add(`${e.file}${mod ? '' : ''}`);
}

if (missingExports.size > 0) {
  info('');
  info('Missing exports — a module was replaced and its consumers were not updated:');
  for (const [name, files] of missingExports) {
    info(`  ${name}  <- required by ${files.size} file(s): ${[...files].join(', ')}`);
  }
}

const byFile = new Map();
for (const e of surfaceErrors) byFile.set(e.file, (byFile.get(e.file) ?? 0) + 1);
info('');
info('Errors by file:');
for (const [file, count] of [...byFile].sort((a, b) => b[1] - a[1])) {
  info(`  ${String(count).padStart(3)}  ${file}`);
}

if (LIST_ALL) {
  info('');
  for (const e of surfaceErrors) info(`  ${e.file}:${e.lineNo} ${e.code} ${e.message}`);
} else {
  info('');
  info('Re-run with --list for every error.');
}

if (elsewhere > 0) info(`(${elsewhere} further error(s) outside the cortex surface are not gated here.)`);

console.log('\nSummary: FAILED — the cortex surface does not compile, so its published');
console.log('validation scores cannot currently be reproduced. See MEMORY.md');
console.log('§ Cortex consciousness research platform.');
process.exit(1);
