#!/usr/bin/env node
/**
 * verify-fcc-proxy-stream — assert the free-claude-code proxy returns a *well-formed*
 * Anthropic stream, not merely HTTP 200.
 *
 * Why this exists (2026-08-04)
 * ----------------------------
 * Claude Code reported: "API returned an empty or malformed response (HTTP 200) — check for
 * a proxy or gateway intercepting the request". The proxy was answering 200 and then
 * emitting nothing but `event: ping` keepalives for minutes, because its failover chain
 * retried an exhausted OpenRouter daily quota 15 times with exponential backoff. The
 * terminal error event existed but arrived long after the client gave up.
 *
 * The existing smoke test passed throughout, because it asserted on substrings: it grepped
 * for `text_delta` and the proxy was delivering its own error text as a `text_delta`. A gate
 * that cannot tell an answer from an error message about the absence of an answer is worse
 * than no gate.
 *
 * So this asserts structure and classifies the outcome:
 *
 *   ok           message_start + real content + message_stop
 *   ping-only    200 with no content events — the exact reported bug
 *   error-event  the proxy reported a real upstream failure (quota, auth, outage)
 *   malformed    started a message and never closed it
 *
 * It also reports which upstream model answered. A pass on the local last-resort model is
 * not the same result as a pass on the configured primary: it means every remote provider
 * failed and the chain fell all the way through. Use --require-remote to make that a
 * failure rather than a footnote.
 *
 * Usage:
 *   node scripts/verify-fcc-proxy-stream.mjs
 *   node scripts/verify-fcc-proxy-stream.mjs --timeout 60
 *   node scripts/verify-fcc-proxy-stream.mjs --require-remote
 */

const PORT = process.env.FCC_PROXY_PORT ?? '8082';
const BASE = `http://127.0.0.1:${PORT}`;
// Local placeholder the proxy is configured to accept; not a provider credential.
const LOCAL_KEY = process.env.FCC_PROXY_KEY ?? 'freecc';
const argTimeout = Number(process.argv[process.argv.indexOf('--timeout') + 1]);
const TIMEOUT_MS = (Number.isFinite(argTimeout) && argTimeout > 0 ? argTimeout : 45) * 1000;
const REQUIRE_REMOTE = process.argv.includes('--require-remote');

/** Models served from this machine, i.e. the end of the fallback chain. */
const LOCAL_MODEL = /^ollama|qwen2\.5-coder|llama\.cpp|127\.0\.0\.1|localhost/i;

const ok = (m) => console.log(`OK:   ${m}`);
const fail = (m) => console.log(`FAIL: ${m}`);
const info = (m) => console.log(`      ${m}`);

/** Text the proxy emits *about* a failure, which must never be mistaken for an answer. */
const PROXY_ERROR_TEXT =
  /provider rate limit reached|provider api request failed|daily free-tier quota is exhausted|all providers|no healthy provider|invalid request sent to provider|provider model is unavailable|provider authentication failed/i;

function classify(raw) {
  const events = [];
  for (const block of raw.split('\n\n')) {
    const type = /^event: (\S+)/m.exec(block)?.[1];
    const dataLine = /^data: (.*)$/m.exec(block)?.[1];
    if (!type) continue;
    let data;
    try {
      data = dataLine ? JSON.parse(dataLine) : undefined;
    } catch {
      data = undefined;
    }
    events.push({ type, data });
  }

  const counts = {};
  for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;

  const text = events
    .filter((e) => e.type === 'content_block_delta')
    .map((e) => e.data?.delta?.text ?? '')
    .join('');

  const errorEvent = events.find((e) => e.type === 'error');
  // The upstream model that actually answered — the only place the chain's outcome is
  // visible to the client, and the difference between "primary worked" and "fell through
  // to the local last resort".
  const servedModel = events.find((e) => e.type === 'message_start')?.data?.message?.model ?? null;
  const started = counts.message_start > 0;
  const stopped = counts.message_stop > 0;
  const contentful = text.trim().length > 0 && !PROXY_ERROR_TEXT.test(text);

  let verdict;
  if (errorEvent) verdict = 'error-event';
  else if (text.trim() && PROXY_ERROR_TEXT.test(text)) verdict = 'error-as-text';
  else if (!started && !contentful) verdict = 'ping-only';
  else if (started && contentful && stopped) verdict = 'ok';
  else verdict = 'malformed';

  return { verdict, counts, text, errorEvent, servedModel, events: events.length };
}

const body = {
  model: 'claude-sonnet-4-20250514',
  max_tokens: 64,
  stream: true,
  messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
  // Agent-shaped: Claude Code / ACP panels send tools, which exercises a different path.
  tools: [
    {
      name: 'Bash',
      description: 'run',
      input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    },
  ],
};

console.log('== verify-fcc-proxy-stream ==');
console.log(`target=${BASE}/v1/messages?beta=true  timeout=${TIMEOUT_MS / 1000}s\n`);

const started = Date.now();
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

let res;
try {
  res = await fetch(`${BASE}/v1/messages?beta=true`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': LOCAL_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
} catch (err) {
  clearTimeout(timer);
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (err.name === 'AbortError') {
    fail(`no complete response within ${TIMEOUT_MS / 1000}s — the proxy is holding the connection open`);
    info('This is the shape of the reported bug. Check the failover retry budget in');
    info('~/src/free-claude-code/api/services.py (_iter_fallback_stream, max_total_sleep_seconds).');
  } else {
    fail(`could not reach the proxy after ${secs}s: ${err.message}`);
    info('If this is ConnectionRefused, run: npm run verify:fcc-proxy-persistence');
  }
  process.exit(1);
}

let raw = '';
try {
  raw = await res.text();
} catch (err) {
  clearTimeout(timer);
  fail(`stream aborted while reading: ${err.message}`);
  process.exit(1);
}
clearTimeout(timer);
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

if (res.status === 401) {
  fail(`HTTP 401 from the proxy — local key rejected (set FCC_PROXY_KEY)`);
  process.exit(1);
}

const { verdict, counts, text, errorEvent, servedModel, events } = classify(raw);
info(`HTTP ${res.status} in ${elapsed}s · ${events} SSE event(s) · ${JSON.stringify(counts)}`);

if (res.status !== 200 && verdict !== 'error-event') {
  // A real HTTP error is honest behaviour: the client can surface it. Not a pass, but not
  // the silent-200 failure either.
  fail(`HTTP ${res.status} — upstream failure surfaced as a status code`);
  info(raw.slice(0, 300));
  process.exit(1);
}

switch (verdict) {
  case 'ok': {
    ok(`well-formed stream in ${elapsed}s — message_start, content, message_stop`);
    info(`served by: ${servedModel ?? '(model not reported by proxy)'}`);
    info(`model said: ${JSON.stringify(text.trim().slice(0, 80))}`);

    const local = servedModel !== null && LOCAL_MODEL.test(servedModel);
    if (local) {
      info('');
      info('DEGRADED: answered by the local last-resort model, so every remote provider in');
      info('the chain failed. The stream is fine; the routing is not. Check MODEL_*_FALLBACK');
      info('and tail the proxy log for QUOTA_EXHAUSTED / FAILOVER lines.');
      if (REQUIRE_REMOTE) {
        console.log('\nSummary: FAILED (--require-remote) — well-formed, but no remote provider served it.');
        process.exit(1);
      }
    }
    console.log(
      `\nSummary: PASSED — proxy returns a real answer, not a 200 with no content.${local ? ' (locally served)' : ''}`
    );
    process.exit(0);
  }

  case 'ping-only':
    fail(`HTTP 200 with no content events after ${elapsed}s — THIS IS THE REPORTED BUG`);
    info('Claude Code renders this as "API returned an empty or malformed response (HTTP 200)".');
    info('The proxy accepted the request, committed a 200, then produced only keepalives.');
    info('Triage: tail ~/src/free-claude-code/server.log for FAILOVER / QUOTA_EXHAUSTED lines.');
    process.exit(1);

  case 'error-event':
  case 'error-as-text': {
    const msg = errorEvent?.data?.error?.message ?? text.trim();
    fail(`proxy reported an upstream failure in ${elapsed}s (no model output)`);
    info(`reason: ${msg.slice(0, 240)}`);
    if (/quota is exhausted|rate limit/i.test(msg)) {
      info('Quota, not code. A chain of same-provider fallbacks shares one quota bucket —');
      info('configure a fallback on a different provider in MODEL_*_FALLBACK.');
    }
    // Failing loudly and quickly is the *fixed* behaviour, but it is still not a working
    // proxy, so the gate must not report success.
    process.exit(1);
  }

  default:
    fail(`malformed stream after ${elapsed}s — started a message it never closed`);
    info(`counts: ${JSON.stringify(counts)}`);
    info(raw.slice(0, 300));
    process.exit(1);
}
