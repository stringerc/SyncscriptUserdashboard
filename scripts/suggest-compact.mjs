#!/usr/bin/env node
/**
 * suggest-compact — context-pressure nudge for agentic coding sessions.
 *
 * Cortex adaptation of ECC's strategic-compact/suggest-compact.js, rebuilt
 * self-contained (no ECC lib dependency chain). Reads a session transcript
 * (Claude Code JSONL format), measures current context occupancy from the
 * latest assistant usage record, and emits a compact suggestion when usage
 * crosses window-scaled thresholds.
 *
 * Usage:
 *   node scripts/suggest-compact.mjs [--transcript <path>] [--window <tokens>]
 *                                   [--json] [--state <path>]
 *
 * Hook mode (Claude Code SessionStart / PreToolUse): pipe the hook payload
 * on stdin — {"transcript_path": "...", "session_id": "..."} — or pass
 * --transcript explicitly. Always exits 0; never blocks a session.
 *
 * Thresholds (fraction of context window):
 *   >= 60%  → notice   ("context filling — plan compaction soon")
 *   >= 80%  → warning  ("compact now — approaching window limit")
 *   >= 92%  → critical ("compact immediately — next turn may truncate")
 * Re-reminds only after +RENOTIFY_GROWTH tokens of additional usage so a
 * long session isn't spammed every turn.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const RENOTIFY_GROWTH = 60_000;
const THRESHOLDS = [
  { pct: 0.92, level: 'critical', msg: 'Context is at {pct}% of the model window — compact immediately; the next turn risks silent truncation.' },
  { pct: 0.80, level: 'warning',  msg: 'Context is at {pct}% of the model window — run /compact or summarize state before continuing.' },
  { pct: 0.60, level: 'notice',   msg: 'Context is at {pct}% of the model window — plan compaction before the session gets long.' },
];

function arg(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const has = (flag) => process.argv.includes(flag);

function readStdin() {
  try {
    const buf = fs.readFileSync(0, 'utf8');
    return buf.trim() ? JSON.parse(buf) : {};
  } catch { return {}; }
}

/** Latest context occupancy: the most recent assistant usage record's
 *  input + cache-read + cache-creation tokens approximates live context
 *  size far better than summing every turn (which double-counts). */
function latestUsage(transcriptPath) {
  const st = fs.statSync(transcriptPath);
  const fd = fs.openSync(transcriptPath, 'r');
  try {
    // Read the tail — usage lives on assistant lines; last one wins.
    const size = Math.min(st.size, 4 * 1024 * 1024);
    const buf = Buffer.alloc(size);
    fs.readSync(fd, buf, 0, size, st.size - size);
    const lines = buf.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      let j;
      try { j = JSON.parse(line); } catch { continue; }
      const u = j?.message?.usage || j?.usage;
      if (!u) continue;
      const input = (u.input_tokens || u.inputTokens || u.prompt_tokens || 0)
        + (u.cache_read_input_tokens || u.cacheReadInputTokens || 0)
        + (u.cache_creation_input_tokens || u.cacheCreationInputTokens || 0);
      if (input > 0) return { input, output: u.output_tokens || u.outputTokens || u.completion_tokens || 0, model: j?.message?.model || j?.model || '' };
    }
  } finally { fs.closeSync(fd); }
  return null;
}

function main() {
  const stdinPayload = has('--transcript') ? {} : readStdin();
  const transcript = arg('--transcript', stdinPayload.transcript_path || stdinPayload.transcriptPath || '');
  if (!transcript || !fs.existsSync(transcript)) {
    if (has('--json')) console.log(JSON.stringify({ ok: true, suggest: false, reason: 'no transcript' }));
    return;
  }
  const usage = latestUsage(transcript);
  if (!usage) {
    if (has('--json')) console.log(JSON.stringify({ ok: true, suggest: false, reason: 'no usage records' }));
    return;
  }
  const window = parseInt(arg('--window', process.env.SUGGEST_COMPACT_WINDOW || '200000'), 10) || 200000;
  const stateFile = arg('--state', path.join(os.tmpdir(), `suggest-compact-${process.env.USER || 'u'}.json`));
  let state = {};
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { }

  // Model-aware window override for known large/small windows.
  const model = String(usage.model || '').toLowerCase();
  let win = window;
  if (/1m|gemini.*pro|claude.*(sonnet|opus).*\[1m\]/.test(model)) win = Math.max(win, 1_000_000);
  else if (/haiku/.test(model)) win = Math.min(win, 200_000);

  const pct = usage.input / win;
  const hit = THRESHOLDS.find((t) => pct >= t.pct); // ordered critical→notice; first match = highest breached level
  if (!hit) {
    if (has('--json')) console.log(JSON.stringify({ ok: true, suggest: false, pct: Math.round(pct * 100), tokens: usage.input, window: win }));
    return;
  }
  // Anti-spam: re-notify only after meaningful growth since last notice at
  // this level or higher.
  const lastNotified = state[hit.level] || 0;
  const growth = usage.input - (state.lastTokens || 0);
  const levelRank = { notice: 1, warning: 2, critical: 3 };
  const escalated = levelRank[hit.level] > (levelRank[state.lastLevel] || 0);
  if (!escalated && growth < RENOTIFY_GROWTH) {
    if (has('--json')) console.log(JSON.stringify({ ok: true, suggest: false, reason: 'below renotify growth', pct: Math.round(pct * 100), tokens: usage.input, window: win }));
    return;
  }
  state[hit.level] = usage.input;
  state.lastLevel = hit.level;
  state.lastTokens = usage.input;
  try { fs.writeFileSync(stateFile, JSON.stringify(state)); } catch { }

  const msg = hit.msg.replace('{pct}', String(Math.round(pct * 100)));
  if (has('--json')) {
    console.log(JSON.stringify({ ok: true, suggest: true, level: hit.level, pct: Math.round(pct * 100), tokens: usage.input, window: win, message: msg, model: usage.model || undefined }));
  } else {
    console.log(`[suggest-compact] ${msg} (${usage.input.toLocaleString()}/${win.toLocaleString()} tokens, model: ${usage.model || 'unknown'})`);
  }
}

try { main(); } catch { /* hooks must never break the host session */ }
process.exit(0);
