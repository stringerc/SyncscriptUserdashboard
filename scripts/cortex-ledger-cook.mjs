#!/usr/bin/env node
/**
 * cortex-ledger-cook.mjs — manufactured epistemic traffic.
 *
 * Fires a battery of claim-kind-targeted prompts through the real
 * nexus-guest agentic pipeline so every reply produces typed verdicts
 * in .cortex-runtime/epistemic-verdicts.jsonl (+ claim-check.jsonl).
 * This is how we "cook" the RLVR dataset on demand instead of waiting
 * for organic traffic.
 *
 * Usage: node scripts/cortex-ledger-cook.mjs [--port 5173] [--batch N]
 * Each prompt is an agentic turn (tools allowed) — expect ~1-4 min each.
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]) || 5173;
const batchIdx = args.indexOf('--batch') >= 0 ? Number(args[args.indexOf('--batch') + 1]) : 0;

// Claim-kind-targeted battery. Vary phrasing across batches so the
// extractor sees diverse surface forms, not one memorized template.
const BATTERIES = [
  [
    'quick status — what port is the dev server actually running on?',
    'how many SLOs are passing right now?',
    'is everything working okay across the system?',
    'how many models in the fleet are currently degraded?',
    'what day of the week is it today?',
    'is Kokoro TTS up and responding?',
    'does LAUNCH_PLAN.md exist in cortex-repos?',
    'how much free memory does the host have?',
    'how long has the cortex server been up?',
    'tell me honestly — how reliable are your fleet claims? do you always get model counts wrong?',
    'are your date claims accurate — have you ever gotten the weekday wrong?',
    'quick gut check on overall system health — anything broken?',
  ],
  [
    'status check — which port is vite bound to?',
    'SLO pass rate right now — give me the numbers',
    'honest assessment: is the whole stack green or are there issues?',
    'fleet health — how many models are degraded vs healthy vs unknown?',
    'what is today\'s date and day of the week?',
    'is the TTS service (kokoro) reachable on its port?',
    'confirm whether RELEASE_STRATEGY.md exists in cortex-repos',
    'current memory pressure — what percentage is free?',
    'uptime on the dev server — hours or days?',
    'self-report: what percentage of your claims does the gate contradict?',
    'do you ever confabulate file existence — is cortex-repos/LAUNCH_PLAN.md real?',
    'one-word health check: is anything failing?',
  ],
  [
    'ops check — dev server port?',
    'SLO scoreboard — pass/fail count?',
    'is the system fully healthy or partially degraded?',
    'model fleet status — degraded count please',
    'day of week?',
    'kokoro-tts alive?',
    'verify: LAUNCH_PLAN.md present in cortex-repos?',
    'free RAM percentage now?',
    'server uptime?',
    'your track record — are most of your live-number claims right or wrong?',
    'file check — does MEMORY.md exist at repo root?',
    'any active incidents or failures right now?',
  ],
  [
    // Direct-answer phrasing — elicits prose claims on the legacy path
    // (LIVE STATE + gate, no tools) → verified/contradicted verdicts.
    'answer directly: what port is the dev server on?',
    'no tools — from context: how many SLOs pass?',
    'straight answer: is everything working?',
    'from what you know: how many models are degraded?',
    'just the day — what weekday is it?',
    'yes or no with detail: is kokoro-tts up?',
    'confirm from context: does LAUNCH_PLAN.md exist?',
    'number only please: free memory percentage?',
    'how long has the server been up — approximate is fine',
    'rate yourself: are your live-number claims usually right?',
    'does MEMORY.md exist at the repo root?',
    'anything failing right now — quick list',
  ],
];

const prompts = BATTERIES[batchIdx % BATTERIES.length];
const VERDICTS = '.cortex-runtime/epistemic-verdicts.jsonl';
const CLAIMS = '.cortex-runtime/claim-check.jsonl';
const countLines = (f) => { try { return fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).length; } catch { return 0; } };
const countAll = () => countLines(VERDICTS) + countLines(CLAIMS);

async function ask(i, q) {
  const body = {
    context: 'cortex', agentic: true,
    sessionId: `ledger-cook-b${batchIdx}-${i}`,
    messages: [{ role: 'user', content: q }],
    stream: true, maxTokens: 1200,
  };
  const started = Date.now();
  const res = await fetch(`http://127.0.0.1:${port}/api/ai/nexus-guest`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(480_000),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', reply = '', finished = false, provider = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const d = JSON.parse(line.slice(6));
          // Legacy SSE path sends bare {token} events (no type field);
          // agentic path sends {type:'TEXT_MESSAGE_CONTENT', token}.
          if (d.token) reply += d.token;
          if (d.finishReason) finished = true;
          if (d.type === 'RUN_FINISHED' && d.agentic?.provider) provider = d.agentic.provider;
        } catch {}
      }
    }
  }
  return { reply: reply.slice(0, 160).replace(/\s+/g, ' '), ms: Date.now() - started, finished, provider };
}

const before = countAll();
console.log(`[cook] batch ${batchIdx}: ${prompts.length} prompts, verdicts before=${before}`);
for (let i = 0; i < prompts.length; i++) {
  try {
    const r = await ask(i, prompts[i]);
    const now = countAll();
    console.log(`[${i + 1}/${prompts.length}] +${now - before} records | ${r.ms}ms | ${r.finished ? 'done' : 'INCOMPLETE'} | ${r.provider || '-'} | "${r.reply}"`);
  } catch (e) {
    console.log(`[${i + 1}/${prompts.length}] ERROR ${e.message}`);
  }
}
console.log(`[cook] done — claims+verdicts ${before} → ${countAll()}`);
