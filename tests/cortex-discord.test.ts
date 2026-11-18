import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  verifyDiscordSignature, handleDiscordInteraction, routeAskAgent,
  formatProposalCard, formatDigest, formatForecastList, formatFleetStatus,
  consumePushBudget, alreadyPosted, markPosted, digestAlreadySent, markDigestSent,
  buildCommandSpecs,
} from '../src/lib/cortex-discord';

// ── Signature verification ─────────────────────────────────────────

function makeKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' });
  const pubHex = Buffer.from(jwk.x!, 'base64url').toString('hex');
  return { pubHex, privateKey };
}

function sign(privateKey: crypto.KeyObject, timestamp: string, body: string): string {
  const sig = crypto.sign(null, Buffer.from(timestamp + body), privateKey);
  return sig.toString('hex');
}

test('verifyDiscordSignature accepts a valid Ed25519 signature', () => {
  const { pubHex, privateKey } = makeKeyPair();
  const body = JSON.stringify({ type: 1 });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = sign(privateKey, ts, body);
  assert.equal(verifyDiscordSignature(body, sig, ts, pubHex), true);
});

test('verifyDiscordSignature rejects tampered body and bad key', () => {
  const { pubHex, privateKey } = makeKeyPair();
  const body = '{"type":1}';
  const ts = '1700000000';
  const sig = sign(privateKey, ts, body);
  assert.equal(verifyDiscordSignature(body + 'x', sig, ts, pubHex), false);
  assert.equal(verifyDiscordSignature(body, sig, ts, 'ab'.repeat(32)), false);
  assert.equal(verifyDiscordSignature(body, 'zz', ts, pubHex), false);
});

// ── Interaction router ─────────────────────────────────────────────

function makeDeps(overrides: any = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cxdisc-'));
  return {
    ownerId: 'owner-1',
    getSnapshot: async () => ({
      agents: [
        { id: 'forecaster', status: 'idle', tasksFailed: 0 },
        { id: 'prep', status: 'active', tasksFailed: 1 },
      ],
      tasks: [
        { id: 't1', status: 'done', createdAt: Date.now() },
        { id: 't2', status: 'failed', createdAt: Date.now() },
        { id: 't3', status: 'queued', createdAt: Date.now() },
      ],
    }),
    getPendingProposals: () => ([
      { id: 'prop-1', title: 'Draft listing pages', summary: 'ev: a,b', urgency: 'high', epistemicConfidence: 0.9, category: 'forecast', createdAt: Date.now() },
    ]),
    acceptProposal: (id: string) => id === 'prop-1',
    dismissProposal: () => true,
    submitTask: () => ({ ok: true }),
    listForecasts: () => ([
      { domain: 'weather', claim: 'Severe thunderstorm watch', confidence: 0.9, urgency: 'high', tier: 3, evidence: [{ kind: 'nws', ref: 'GAZ036' }] },
    ]),
    listCalendarEvents: () => ([{ title: 'Standup', start: Date.now() + 3600_000 }]),
    getOutputMode: () => 'medium' as const,
    setOutputMode: () => {},
    stateDir: dir,
    ...overrides,
  };
}

test('PING interaction returns type 1', async () => {
  const res = await handleDiscordInteraction({ type: 1 }, makeDeps());
  assert.equal(res.type, 1);
});

test('non-owner is rejected on commands', async () => {
  const res = await handleDiscordInteraction(
    { type: 2, user: { id: 'intruder' }, data: { name: 'cortex', options: [{ name: 'status', type: 1 }] } },
    makeDeps(),
  );
  assert.equal(res.type, 4);
  assert.match(res.data!.content!, /owner-only/);
});

test('/cortex status returns fleet embed', async () => {
  const res = await handleDiscordInteraction(
    { type: 2, user: { id: 'owner-1' }, data: { name: 'cortex', options: [{ name: 'status', type: 1 }] } },
    makeDeps(),
  );
  assert.equal(res.type, 4);
  assert.ok(res.data!.embeds!.length > 0);
  assert.match(res.data!.embeds![0].fields!.map((f) => f.name).join(','), /Agents/);
});

test('/cortex forecast lists evidence-backed forecasts', async () => {
  const res = await handleDiscordInteraction(
    { type: 2, user: { id: 'owner-1' }, data: { name: 'cortex', options: [{ name: 'forecast', type: 1 }] } },
    makeDeps(),
  );
  assert.match(res.data!.content!, /Severe thunderstorm watch/);
  assert.match(res.data!.content!, /90%/);
});

test('/cortex proposals returns card with approve/dismiss buttons', async () => {
  const res = await handleDiscordInteraction(
    { type: 2, user: { id: 'owner-1' }, data: { name: 'cortex', options: [{ name: 'proposals', type: 1 }] } },
    makeDeps(),
  );
  assert.ok(res.data!.components!.length > 0);
  const btns = JSON.stringify(res.data!.components);
  assert.match(btns, /cxok:prop-1/);
  assert.match(btns, /cxdsm:prop-1/);
});

test('approve button accepts proposal and retires buttons', async () => {
  const res = await handleDiscordInteraction(
    {
      type: 3, user: { id: 'owner-1' }, channel_id: 'c1',
      data: { custom_id: 'cxok:prop-1' },
      message: { id: 'm1', embeds: [] },
    },
    makeDeps(),
  );
  assert.equal(res.type, 7);
  assert.match(res.data!.content!, /Approved/);
  assert.deepEqual(res.data!.components, []);
});

test('dismiss button by non-owner is rejected', async () => {
  const res = await handleDiscordInteraction(
    { type: 3, user: { id: 'intruder' }, data: { custom_id: 'cxdsm:prop-1' }, message: { id: 'm', embeds: [] } },
    makeDeps(),
  );
  assert.equal(res.type, 4);
  assert.match(res.data!.content!, /Not authorized/);
});

test('sx strategy proposal approve button resolves and retires buttons', async () => {
  let decidedId = '';
  let decisionMade = '';
  const deps = makeDeps({
    decideStrategyProposal: async (id: string, decision: 'approved' | 'dismissed') => {
      decidedId = id;
      decisionMade = decision;
      return { ok: true, note: 'dispatched to builder (task-99)' };
    },
  });
  const res = await handleDiscordInteraction(
    {
      type: 3, user: { id: 'owner-1' }, channel_id: 'c1',
      data: { custom_id: 'sxok:strat-standup-2026-11-18-0' },
      message: { id: 'm1', embeds: [] },
    },
    deps,
  );
  assert.equal(res.type, 7);
  assert.equal(decidedId, 'strat-standup-2026-11-18-0');
  assert.equal(decisionMade, 'approved');
  assert.match(res.data!.content!, /Approved/);
  assert.match(res.data!.content!, /dispatched to builder/);
  assert.deepEqual(res.data!.components, []);
});

test('counsel poll button records verdict and retires buttons', async () => {
  let pollSession = '';
  let pollDecision = '';
  const deps = makeDeps({
    decideCounsel: async (sessionId: string, decision: 'go' | 'no-go', userId: string) => {
      pollSession = sessionId;
      pollDecision = decision;
      return { ok: true, note: 'recorded' };
    },
  });
  const res = await handleDiscordInteraction(
    {
      type: 3, user: { id: 'owner-1' }, channel_id: 'c1',
      data: { custom_id: 'counsel:go:sess-abc' },
      message: { id: 'm1', embeds: [] },
    },
    deps,
  );
  assert.equal(res.type, 7);
  assert.equal(pollSession, 'sess-abc');
  assert.equal(pollDecision, 'go');
  assert.match(res.data!.content!, /GO/);
  assert.deepEqual(res.data!.components, []);
});

test('/cortex ask routes to agent and submits task', async () => {
  let submitted: any = null;
  const res = await handleDiscordInteraction(
    { type: 2, user: { id: 'owner-1' }, data: { name: 'cortex', options: [{ name: 'ask', type: 1, options: [{ name: 'text', type: 3, value: 'research competitor pricing' }] }] } },
    makeDeps({ submitTask: (a: string, k: string, t: string) => { submitted = { a, k, t }; return { ok: true }; } }),
  );
  assert.equal(submitted.a, 'scout');
  assert.match(res.data!.content!, /SCOUT/);
});

test('/cortex ask reports rejected task honestly', async () => {
  const res = await handleDiscordInteraction(
    { type: 2, user: { id: 'owner-1' }, data: { name: 'cortex', options: [{ name: 'ask', type: 1, options: [{ name: 'text', type: 3, value: 'do a thing' }] }] } },
    makeDeps({ submitTask: () => ({ ok: false, error: 'daily budget exhausted' }) }),
  );
  assert.match(res.data!.content!, /budget exhausted/);
});

test('/cortex approve resolves proposal by id', async () => {
  const res = await handleDiscordInteraction(
    { type: 2, user: { id: 'owner-1' }, data: { name: 'cortex', options: [{ name: 'approve', type: 1, options: [{ name: 'id', type: 3, value: 'prop-1' }] }] } },
    makeDeps(),
  );
  assert.match(res.data!.content!, /Approved/);
});

// ── Formatting ─────────────────────────────────────────────────────

test('formatDigest produces three-block structure', () => {
  const out = formatDigest({
    events: [{ title: 'Dentist', start: Date.now() + 7200_000 }],
    pendingProposals: [{ id: 'p', title: 'T', urgency: 'high' }],
    forecasts: [{ domain: 'fleet', claim: 'Builder failing streak', confidence: 0.7 }],
    snapshot: { agents: [{ id: 'scout', status: 'idle' }], tasks: [{ status: 'done', createdAt: Date.now() }] },
    now: Date.now(),
  });
  assert.match(out, /Morning — Cortex/);
  assert.match(out, /Needs you:[\s\S]*proposal/);
  assert.match(out, /Handled:/);
});

test('formatProposalCard builds embed + buttons', () => {
  const card = formatProposalCard({ id: 'x9', title: 'Do thing', urgency: 'high', epistemicConfidence: 0.8 });
  assert.equal(card.embeds[0].color, 0xed4245);
  assert.ok(JSON.stringify(card.components).includes('cxok:x9'));
});

test('formatForecastList handles empty honestly', () => {
  assert.match(formatForecastList([]), /No forecasts logged/);
});

test('formatFleetStatus reports zero state without fabricating', () => {
  const { embeds } = formatFleetStatus({ agents: [], tasks: [] });
  assert.equal(embeds[0].fields![0].value, '0/— active');
});

test('routeAskAgent keyword routing + worker-shaped inputs', () => {
  const research = routeAskAgent('research the competitor');
  assert.equal(research.agentId, 'scout');
  assert.equal(research.kind, 'research');
  assert.ok(research.input.query, 'scout research needs input.query');
  const prep = routeAskAgent('prep me for the board meeting');
  assert.equal(prep.agentId, 'prep');
  assert.ok(prep.input.title);
  const build = routeAskAgent('fix the login bug');
  assert.equal(build.agentId, 'builder');
  assert.ok(build.input.instruction, 'builder needs input.instruction');
  // Social listening routes to scout social_scan with detected channel.
  const reddit = routeAskAgent('what are people on reddit saying about u-pick farms');
  assert.equal(reddit.agentId, 'scout');
  assert.equal(reddit.kind, 'social_scan');
  assert.equal(reddit.input.channel, 'reddit');
  const yt = routeAskAgent('search youtube for sourdough tutorials');
  assert.equal(yt.kind, 'social_scan');
  assert.equal(yt.input.channel, 'youtube');
  // Memory lookups route to librarian recall, not web research.
  const mem = routeAskAgent('what do we know about the berry farm lead');
  assert.equal(mem.agentId, 'librarian');
  assert.equal(mem.kind, 'recall');
  assert.ok(mem.input.query);
  // Distributor needs structured payloads — free text must NOT route there.
  assert.notEqual(routeAskAgent('publish this to pinterest').agentId, 'distributor');
  // Unknown text defaults to scout research (has a real input.query).
  const dflt = routeAskAgent('hello there');
  assert.equal(dflt.agentId, 'scout');
  assert.ok(dflt.input.query);
});

// ── Push budget ────────────────────────────────────────────────────

test('push budget caps at 5/day and resets next day', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cxpush-'));
  const now = Date.now();
  for (let i = 0; i < 5; i++) assert.equal(consumePushBudget(dir, now), true);
  assert.equal(consumePushBudget(dir, now), false);
  assert.equal(consumePushBudget(dir, now + 86400000), true); // next day resets
});

test('posted tracking dedupes proposals and forecasts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cxpost-'));
  assert.equal(alreadyPosted(dir, 'proposal', 'p1'), false);
  markPosted(dir, 'proposal', 'p1');
  assert.equal(alreadyPosted(dir, 'proposal', 'p1'), true);
  markPosted(dir, 'forecast', 'f1');
  assert.equal(alreadyPosted(dir, 'forecast', 'f1'), true);
  assert.equal(alreadyPosted(dir, 'forecast', 'f2'), false);
});

test('digest sent once per day', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cxdig-'));
  const now = Date.now();
  assert.equal(digestAlreadySent(dir, now), false);
  markDigestSent(dir, now);
  assert.equal(digestAlreadySent(dir, now), true);
  assert.equal(digestAlreadySent(dir, now + 86400000), false);
});

test('buildCommandSpecs produces valid /cortex command', () => {
  const specs = buildCommandSpecs();
  assert.equal(specs.length, 1);
  assert.equal(specs[0].name, 'cortex');
  const subs = specs[0].options.map((o: any) => o.name);
  for (const s of ['status', 'digest', 'forecast', 'proposals', 'ask', 'outputmode', 'approve', 'dismiss']) {
    assert.ok(subs.includes(s), `missing subcommand ${s}`);
  }
});
