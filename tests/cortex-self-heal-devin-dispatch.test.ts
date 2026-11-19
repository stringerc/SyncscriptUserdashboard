import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  dispatchDevinSession,
  buildDevinPrompt,
  generateMarkdownSummary,
  type EscalationRequest,
} from '../src/utils/cortex-self-heal.ts';

const req = (problem = 'Devin repeatedly failing to write calls'): EscalationRequest => ({
  problemDescription: problem,
  componentPath: 'src/utils/cortex-self-heal.ts',
});

function fakeFetch(responses: Array<{ status: number; body?: any } | Error>) {
  const calls: Array<{ url: string; init: any }> = [];
  const impl = (async (url: string, init: any) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('unexpected extra fetch');
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const queueFiles = (root: string) => {
  const dir = join(root, '.cache/cortex_devin_queue');
  return existsSync(dir) ? readdirSync(dir).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))) : [];
};

test.beforeEach(() => {
  process.env.DEVIN_API_KEY = 'test-key';
});

test('prompt names the target repo and base branch', () => {
  const prompt = buildDevinPrompt(req());
  assert.match(prompt, /stringerc\/SyncscriptUserdashboard/);
  assert.match(prompt, /base branch: security-hardening/);
  assert.ok(buildDevinPrompt(req('x'.repeat(40000))).length <= 30000);
});

test('creates an idempotent session and caches it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'heal-'));
  const { impl, calls } = fakeFetch([{ status: 200, body: { session_id: 'devin-abc', url: 'https://app.devin.ai/sessions/abc' } }]);
  const res = await dispatchDevinSession(req(), root, { fetchImpl: impl, retryDelayMs: 0 });
  assert.equal(res.ok, true);
  assert.equal(res.sessionId, 'devin-abc');
  assert.equal(calls.length, 1);
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.idempotent, true);
  assert.match(sent.prompt, /security-hardening/);
  const cache = JSON.parse(readFileSync(join(root, '.cache/cortex_devin_sessions.json'), 'utf8'));
  assert.equal(cache[0].sessionId, 'devin-abc');
  assert.ok(cache[0].dedupeKey);
});

test('repeat escalation inside the window reuses the session without a new API call', async () => {
  const root = mkdtempSync(join(tmpdir(), 'heal-'));
  const first = fakeFetch([{ status: 200, body: { session_id: 'devin-1', url: 'u1' } }]);
  await dispatchDevinSession(req(), root, { fetchImpl: first.impl, retryDelayMs: 0 });
  const second = fakeFetch([]);
  const res = await dispatchDevinSession(req(), root, { fetchImpl: second.impl, retryDelayMs: 0 });
  assert.equal(res.reused, true);
  assert.equal(res.sessionId, 'devin-1');
  assert.equal(second.calls.length, 0);
});

test('a different problem is not deduped', async () => {
  const root = mkdtempSync(join(tmpdir(), 'heal-'));
  const f = fakeFetch([
    { status: 200, body: { session_id: 'devin-1', url: 'u1' } },
    { status: 200, body: { session_id: 'devin-2', url: 'u2' } },
  ]);
  await dispatchDevinSession(req('problem A'), root, { fetchImpl: f.impl, retryDelayMs: 0 });
  const res = await dispatchDevinSession(req('problem B'), root, { fetchImpl: f.impl, retryDelayMs: 0 });
  assert.equal(res.sessionId, 'devin-2');
  assert.equal(f.calls.length, 2);
});

test('changing the target branch does not reuse the previous target session', async () => {
  const root = mkdtempSync(join(tmpdir(), 'heal-'));
  const f = fakeFetch([
    { status: 200, body: { session_id: 'devin-1', url: 'u1' } },
    { status: 200, body: { session_id: 'devin-2', url: 'u2' } },
  ]);
  await dispatchDevinSession(req(), root, { fetchImpl: f.impl, retryDelayMs: 0 });
  process.env.DEVIN_TARGET_BRANCH = 'other-branch';
  try {
    const res = await dispatchDevinSession(req(), root, { fetchImpl: f.impl, retryDelayMs: 0 });
    assert.equal(res.sessionId, 'devin-2');
    assert.equal(f.calls.length, 2);
  } finally {
    delete process.env.DEVIN_TARGET_BRANCH;
  }
});

test('overlapping escalations keep both sessions in the cache', async () => {
  const root = mkdtempSync(join(tmpdir(), 'heal-'));
  const slow = (id: string, ms: number) =>
    (async () => {
      await new Promise((r) => setTimeout(r, ms));
      return new Response(JSON.stringify({ session_id: id, url: id }), { status: 200 });
    }) as unknown as typeof fetch;
  await Promise.all([
    dispatchDevinSession(req('problem A'), root, { fetchImpl: slow('devin-a', 20), retryDelayMs: 0 }),
    dispatchDevinSession(req('problem B'), root, { fetchImpl: slow('devin-b', 5), retryDelayMs: 0 }),
  ]);
  const cache = JSON.parse(readFileSync(join(root, '.cache/cortex_devin_sessions.json'), 'utf8'));
  assert.deepEqual(cache.map((s: any) => s.sessionId).sort(), ['devin-a', 'devin-b']);
});

test('transient 503 / network errors are retried', async () => {
  const root = mkdtempSync(join(tmpdir(), 'heal-'));
  const f = fakeFetch([new Error('ECONNRESET'), { status: 503 }, { status: 200, body: { session_id: 'devin-r', url: 'ur' } }]);
  const res = await dispatchDevinSession(req(), root, { fetchImpl: f.impl, retryDelayMs: 0 });
  assert.equal(res.ok, true);
  assert.equal(res.attempts, 3);
  assert.equal(queueFiles(root).length, 0);
});

test('non-retryable 401 stops after one attempt and is recorded in the queue', async () => {
  const root = mkdtempSync(join(tmpdir(), 'heal-'));
  const f = fakeFetch([{ status: 401, body: { detail: 'bad key' } }]);
  const res = await dispatchDevinSession({ ...req(), incidentId: 'inc-401' }, root, { fetchImpl: f.impl, retryDelayMs: 0 });
  assert.equal(res.ok, false);
  assert.equal(res.attempts, 1);
  assert.match(res.error || '', /HTTP 401/);
  const [entry] = queueFiles(root);
  assert.equal(entry.status, 'dispatch_failed');
  assert.equal(entry.httpStatus, 401);
});

test('exhausted retries are recorded in the queue', async () => {
  const root = mkdtempSync(join(tmpdir(), 'heal-'));
  const f = fakeFetch([{ status: 500 }, { status: 502 }, { status: 429 }]);
  const res = await dispatchDevinSession(req(), root, { fetchImpl: f.impl, retryDelayMs: 0 });
  assert.equal(res.ok, false);
  assert.equal(res.attempts, 3);
  assert.equal(queueFiles(root)[0].status, 'dispatch_failed');
});

test('missing API key stages the escalation without calling the API', async () => {
  delete process.env.DEVIN_API_KEY;
  const root = mkdtempSync(join(tmpdir(), 'heal-'));
  const f = fakeFetch([]);
  const res = await dispatchDevinSession(req(), root, { fetchImpl: f.impl });
  assert.equal(res.ok, false);
  assert.equal(f.calls.length, 0);
  assert.equal(queueFiles(root)[0].status, 'staged_pending_api_key');
});

test('markdown report surfaces a failed Devin hand-off', () => {
  const md = generateMarkdownSummary(req(), {
    diagnostician: 'Devin Autonomous Engine',
    patch: {
      diagnostician: 'Devin Autonomous Engine',
      summary: 's',
      affectedFiles: [],
      unifiedDiff: '',
      explanation: '',
      devinDispatchError: 'Devin API HTTP 401: bad key',
    },
    deployed: false,
    voiceSummary: '',
    success: false,
  });
  assert.match(md, /Devin Autonomous Session\*\*: FAILED — Devin API HTTP 401/);
});
