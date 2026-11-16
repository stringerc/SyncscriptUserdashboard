#!/usr/bin/env node
/**
 * verify-cortex-and-memory — typecheck + suites + one MEMORY gate line.
 * Does not dump runtime cortex state into MEMORY; only the Last cortex gate block.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function run(label, cmd, args) {
  console.log(`\n== ${label} ==`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: process.env, shell: false });
  if (r.status !== 0) {
    console.log(`FAIL: ${label} exit ${r.status}`);
    process.exit(r.status ?? 1);
  }
}

run('guard:cortex-typecheck', 'node', ['scripts/guard-cortex-typecheck.mjs']);
run('cortex-full-validation', 'npx', ['tsx', 'src/lib/__tests__/cortex-full-validation.ts']);
run('cortex-openclaw-phase1', 'npx', ['vitest', 'run', 'src/lib/__tests__/cortex-openclaw-phase1.test.ts']);
run('cortex-hermes-phase2', 'npx', ['vitest', 'run', 'src/lib/__tests__/cortex-hermes-phase2.test.ts']);
run('cortex-phase3-continuity', 'npx', ['vitest', 'run', 'src/lib/__tests__/cortex-phase3-continuity.test.ts']);
run('cortex-agents', 'npx', ['vitest', 'run', 'src/lib/__tests__/cortex-agents.test.ts']);
run('cortex-chat-verification', 'node', ['scripts/verify-cortex-chat.mjs']);

console.log('\n== cortex-70-validation ==');
const seventy = spawnSync('npx', ['tsx', 'src/lib/__tests__/cortex-70-validation.ts'], {
  encoding: 'utf8',
  env: process.env,
  maxBuffer: 20 * 1024 * 1024,
});
process.stdout.write(seventy.stdout || '');
process.stderr.write(seventy.stderr || '');
const logPath = join(tmpdir(), `cortex70-gate-${process.pid}.log`);
writeFileSync(logPath, `${seventy.stdout || ''}\n${seventy.stderr || ''}`);
if (seventy.status !== 0) {
  console.log(`FAIL: cortex-70 exit ${seventy.status}`);
  // Still attempt gate update so FAIL is durable in MEMORY.
  spawnSync('node', ['scripts/update-cortex-memory-gate.mjs', '--from-log', logPath], {
    stdio: 'inherit',
    env: process.env,
  });
  process.exit(seventy.status ?? 1);
}

const up = spawnSync('node', ['scripts/update-cortex-memory-gate.mjs', '--from-log', logPath], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(up.status ?? 0);
