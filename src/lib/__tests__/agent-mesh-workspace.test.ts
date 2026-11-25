import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate runtime state before the modules under test load their paths.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-mesh-'));
process.env.CORTEX_AGENTS_STATE_DIR = TMP;

let ws: typeof import('../cortex-agents/agent-workspace');
let messages: typeof import('../cortex-agents/messages');
let mesh: typeof import('../cortex-agents/mesh');
let verification: typeof import('../cortex-agents/verification');
let skills: typeof import('../cortex-agents/skills');
let learning: typeof import('../cortex-agents/learning');

beforeAll(async () => {
  // Seed a registered-agent roster so meshSend's knownAgents() admits them.
  fs.writeFileSync(path.join(TMP, 'agents-state.json'), JSON.stringify({
    agents: ['reviewer', 'sentinel', 'scout', 'builder', 'warden'].map((id) => ({ id })),
  }));
  ws = await import('../cortex-agents/agent-workspace');
  messages = await import('../cortex-agents/messages');
  mesh = await import('../cortex-agents/mesh');
  verification = await import('../cortex-agents/verification');
  skills = await import('../cortex-agents/skills');
  learning = await import('../cortex-agents/learning');
});

describe('agent-workspace', () => {
  it('writes, reads, and CAS-transacts a pattern key', () => {
    const w = ws.wsWrite('scout', 'pattern:retry-backoff', 'default', { attempts: 3 });
    expect(w.ok).toBe(true);
    expect(w.version).toBe(1);

    const r = ws.wsRead('pattern:retry-backoff', 'default');
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ attempts: 3 });

    // Stale expectVersion conflicts; correct version CAS-writes.
    const wrong = ws.wsWrite('builder', 'pattern:retry-backoff', 'default', { attempts: 5 }, { expectVersion: 99 });
    expect(wrong.conflict).toBe(true);
    const cas = ws.wsWrite('builder', 'pattern:retry-backoff', 'default', { attempts: 5 }, { expectVersion: 1 });
    // version is still 1 — this one succeeds:
    expect(cas.ok).toBe(true);
    expect(cas.version).toBe(2);
    const after = ws.wsRead('pattern:retry-backoff', 'default');
    expect(after.value).toEqual({ attempts: 5 });
  });

  it('enforces namespace ACL: agents cannot write global or others agent ns', () => {
    expect(ws.wsWrite('scout', 'global', 'bulletin', 'x').ok).toBe(false);
    expect(ws.wsWrite('scout', 'agent:builder:notes', 'k', 'v').ok).toBe(false);
    expect(ws.wsWrite('scout', 'agent:scout:notes', 'k', 'v').ok).toBe(true);
    expect(ws.wsWrite('cortex', 'global', 'bulletin', 'x').ok).toBe(true);
  });

  it('rejects invalid namespaces and oversized values', () => {
    expect(ws.wsWrite('scout', 'bogus ns!', 'k', 'v').ok).toBe(false);
    expect(ws.wsWrite('scout', 'pattern:x', 'k', 'x'.repeat(9000)).ok).toBe(false);
  });

  it('executes fenced workspace_op blocks and queues read results', () => {
    const result = [
      'done',
      '```workspace_op',
      JSON.stringify({ op: 'write', ns: 'skill:deploy', key: 'runbook', value: { step: 1 } }),
      '```',
      '```workspace_op',
      JSON.stringify({ op: 'read', ns: 'pattern:retry-backoff', key: 'default' }),
      '```',
      '```workspace_op',
      JSON.stringify({ op: 'bogus', ns: 'pattern:x', key: 'k' }),
      '```',
    ].join('\n');
    const r = ws.extractWorkspaceOps('runner', result);
    expect(r.executed).toBe(2);
    expect(r.rejected).toBe(1);
    expect(ws.wsRead('skill:deploy', 'runbook').ok).toBe(true);

    // Op results surface once via workspaceBlock, then are consumed.
    const block1 = ws.workspaceBlock('runner');
    expect(block1).toContain('WORKSPACE OP RESULTS');
    expect(block1).toContain('retry-backoff');
    const block2 = ws.workspaceBlock('runner');
    expect(block2).not.toContain('WORKSPACE OP RESULTS');
  });
});

describe('agent-mesh', () => {
  it('sendMessage accepts channel/causationId/requiresAck and stamps ackedAt', () => {
    const r = messages.sendMessage({
      from: 'cortex', to: 'crew', type: 'request', channel: 'verdict.request',
      payload: 'verify finding', requiresAck: true, correlationId: 'corr-1',
    });
    expect(r.ok).toBe(true);
    const msg = r.message!;
    expect(msg.channel).toBe('verdict.request');
    expect(msg.requiresAck).toBe(true);

    // Bad channel rejected.
    expect(messages.sendMessage({ from: 'cortex', to: 'crew', type: 'signal', channel: 'nope' as any, payload: 'x' }).ok).toBe(false);

    // Ack correlates to the message id.
    const ack = messages.sendMessage({ from: 'crew', to: 'cortex', type: 'ack', payload: 'ack', correlationId: msg.id });
    expect(ack.ok).toBe(true);
    const after = messages.listMessages({ limit: 50 }).find((m) => m.id === msg.id);
    expect(after?.ackedAt).toBeDefined();
  });

  it('meshSend defaults envelope type per channel', () => {
    const r = mesh.meshSend({ from: 'cortex', to: 'crew', channel: 'task.delegate', payload: 'do thing' });
    expect(r.ok).toBe(true);
    expect(r.message?.type).toBe('handoff');
  });

  it('meshRequest times out honestly when no reply arrives', async () => {
    const res = await mesh.meshRequest({
      from: 'cortex', to: 'crew', channel: 'verdict.request', payload: 'ping', timeoutMs: 2_000,
    });
    expect(res.ok).toBe(false);
    expect(res.timedOut).toBe(true);
    expect(res.request?.requiresAck).toBe(true);
  }, 10_000);
});

describe('verification pipeline', () => {
  function vote(verifierId: string, verifId: string, vote: string, rationale = '') {
    return messages.sendMessage({
      from: verifierId, to: 'crew', type: 'signal', channel: 'verdict.request',
      payload: JSON.stringify({ vote, rationale }), correlationId: verifId,
    });
  }

  it('dispatches verdict.request envelopes and resolves on unanimous approve', () => {
    const r = verification.openVerification({
      subject: 'code review: auth refactor', claim: 'migration is safe to merge',
      evidence: 'diff attached', requestedBy: 'crew', verifierIds: ['reviewer', 'sentinel'],
    });
    expect(r.ok).toBe(true);
    expect(r.dispatched).toBe(2);
    const v = r.verification!;
    expect(v.status).toBe('open');

    // Dispatch envelopes are visible pending traffic to the verifiers.
    const inbox = verification.listVerifications({ limit: 10 }).find((x) => x.id === v.id);
    expect(inbox?.verifierIds).toEqual(['reviewer', 'sentinel']);

    expect(vote('reviewer', v.id, 'approve', 'diff clean').ok).toBe(true);
    expect(verification.getVerification(v.id)?.status).toBe('open'); // waiting on sentinel
    expect(vote('sentinel', v.id, 'approve').ok).toBe(true);
    const done = verification.getVerification(v.id);
    expect(done?.status).toBe('approved');
    expect(done?.votes).toHaveLength(2);
  });

  it('escalates a split verdict to the Initiative Inbox', () => {
    const r = verification.openVerification({
      subject: 'infra change', claim: 'restart is safe',
      requestedBy: 'crew', verifierIds: ['reviewer', 'sentinel'],
    });
    const v = r.verification!;
    vote('reviewer', v.id, 'approve');
    vote('sentinel', v.id, 'contest', 'downtime risk');
    const done = verification.getVerification(v.id);
    expect(done?.status).toBe('escalated');
    expect(done?.resolution).toContain('no consensus');
  });

  it('ignores votes from non-verifiers and duplicate votes', () => {
    const r = verification.openVerification({
      subject: 'default', claim: 'test', requestedBy: 'crew', verifierIds: ['reviewer', 'sentinel'],
    });
    const v = r.verification!;
    vote('scout', v.id, 'approve'); // not a verifier — ignored
    vote('reviewer', v.id, 'approve');
    vote('reviewer', v.id, 'contest'); // duplicate — ignored
    const cur = verification.getVerification(v.id);
    expect(cur?.votes).toHaveLength(1);
    expect(cur?.status).toBe('open');
  });
});

describe('skill marketplace', () => {
  it('registers, acquires with trust floor, composes, and records outcomes', () => {
    const reg = skills.registerSkill('scout', {
      name: 'graphql-to-trpc', version: '1.0.0', description: 'schema migration',
      capabilities: ['graphql', 'trpc', 'codemod'], trustScore: 0.9,
    });
    expect(reg.ok).toBe(true);

    // Trust floor: a 0.1-trust skill cannot be acquired.
    skills.registerSkill('scout', { name: 'sketchy', version: '0.1', description: 'x', capabilities: ['x'], trustScore: 0.1 });
    expect(skills.acquireSkill('builder', 'sketchy').ok).toBe(false);

    const acq = skills.acquireSkill('builder', 'graphql-to-trpc');
    expect(acq.ok).toBe(true);
    expect(acq.manifest?.capabilities).toContain('codemod');

    // Unacquired agent cannot compose it.
    expect(skills.composeSkills('scout', ['graphql-to-trpc']).ok).toBe(false);
    const comp = skills.composeSkills('builder', ['graphql-to-trpc']);
    expect(comp.ok).toBe(true);
    expect(comp.capabilities).toContain('trpc');

    // Outcomes move trustScore after enough samples.
    for (let i = 0; i < 3; i++) skills.recordSkillOutcome('graphql-to-trpc', true);
    expect(skills.getSkill('graphql-to-trpc')?.manifest.trustScore).toBe(1);
  });
});

describe('learning layer', () => {
  it('selects arms epsilon-greedily and records rewards', () => {
    const sel = learning.selectPolicy('builder', 'review');
    expect(learning.POLICY_ARMS.some((a) => a.id === sel.arm.id)).toBe(true);
    learning.recordPolicyReward('builder', 'review', sel.arm.id, 1);
    learning.recordPolicyReward('builder', 'review', sel.arm.id, 0);
    const stats = learning.policyStats('builder') as any;
    const bandit = stats['bandit:review'];
    expect(bandit).toBeDefined();
    expect(bandit.arms[sel.arm.id].pulls).toBe(2);
    expect(bandit.arms[sel.arm.id].rewardSum).toBeCloseTo(1);
  });
});
