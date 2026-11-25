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

beforeAll(async () => {
  ws = await import('../cortex-agents/agent-workspace');
  messages = await import('../cortex-agents/messages');
  mesh = await import('../cortex-agents/mesh');
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
