#!/usr/bin/env node
// One-shot resonance recommendations review — summarizes fire/clear
// transitions in recommendations.jsonl and posts a macOS notification.
// Scheduled via launchd ~3h after a known degradation window so the
// true/false-positive evidence is captured while it's fresh.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const recsPath = path.join(root, '.cortex-runtime', 'resonance', 'recommendations.jsonl');
const latestPath = path.join(root, '.cortex-runtime', 'resonance', 'latest.json');
const reportPath = path.join(root, '.cortex-runtime', 'resonance', 'recommendations-review.md');

let lines = [];
try { lines = fs.readFileSync(recsPath, 'utf8').trim().split('\n').filter(Boolean); }
catch { console.log('[recs-review] no recommendations.jsonl yet'); process.exit(0); }

const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// Collapse consecutive identical active-sets into transition segments
const segments = [];
for (const e of events) {
  const sig = (e.active || []).map(a => `${a.id}:${a.severity}`).sort().join('|') || 'clear';
  const last = segments[segments.length - 1];
  if (last && last.sig === sig) { last.end = e.ts; last.cycles++; }
  else segments.push({ sig, start: e.ts, end: e.ts, cycles: 1, sample: e });
}

const fires = segments.filter(s => s.sig !== 'clear');
const clears = segments.filter(s => s.sig === 'clear');

let latest = null;
try { latest = JSON.parse(fs.readFileSync(latestPath, 'utf8')); } catch {}
const r = latest?.resonance || {};

const dur = (a, b) => {
  const m = Math.round((Date.parse(b) - Date.parse(a)) / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
};

const lines_out = [
  `# Resonance recommendations review — ${new Date().toISOString()}`,
  ``,
  `Snapshot: cycle ${latest?.cycle ?? '?'} | R=${r.R ?? '—'} | tail=${r.tailHealthScore ?? '—'} | entropy=${r.spectralEntropy ?? '—'} (${r.entropyState ?? '—'}) | mode=${r.mode ?? '—'}`,
  ``,
  `## Transitions (${segments.length} segments, ${events.length} logged cycles)`,
  ``,
  ...segments.map(s => {
    const act = s.sample?.active || [];
    const desc = act.length ? act.map(a => `${a.id}→${a.target || 'fleet'} (${a.severity})`).join(', ') : 'clear';
    return `- ${s.start.slice(11, 19)} → ${s.end.slice(11, 19)} (${dur(s.start, s.end)}, ${s.cycles} cycles): **${desc}**`;
  }),
  ``,
  `## Assessment`,
  ``,
  fires.length === 0
    ? 'No recommendations ever fired — observer may be too conservative or fleet stayed clean.'
    : `${fires.length} firing segment(s), ${clears.length} recovery segment(s). Each fire/clear pair is a labeled incident for the Dec-3 actuation gate.`,
];

fs.writeFileSync(reportPath, lines_out.join('\n') + '\n');

const summary = fires.length === 0
  ? 'Resonance recs review: no firings logged'
  : `Resonance recs: ${fires.length} firing segment(s), latest tail=${r.tailHealthScore ?? '—'} R=${r.R ?? '—'} — report in .cortex-runtime/resonance/recommendations-review.md`;

try {
  execFileSync('osascript', ['-e',
    `display notification ${JSON.stringify(summary)} with title "Resonance shadow review" sound name "Glass"`]);
} catch {}
console.log('[recs-review] done —', summary);
