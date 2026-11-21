#!/usr/bin/env node
// Daily resonance milestone checker — fires macOS notifications when a
// milestone's `due` date passes and it hasn't been notified yet.
// State lives in .cortex-runtime/resonance/milestones.json.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const file = path.join(root, '.cortex-runtime', 'resonance', 'milestones.json');

let data;
try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch {
  process.exit(0); // no milestones file — nothing to do
}

const now = Date.now();
let changed = false;

for (const m of data.milestones || []) {
  if (m.notified) continue;
  const due = Date.parse(m.due);
  if (Number.isNaN(due) || now < due) continue;

  try {
    execFileSync('osascript', ['-e',
      `display notification ${JSON.stringify(m.label)} with title "Resonance milestone: ${m.id}" sound name "Glass"`]);
  } catch { /* notification failure is non-fatal */ }

  m.notified = true;
  changed = true;
  console.log(`[milestones] fired: ${m.id}`);
}

if (changed) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); } catch {}
}
