import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// State dir captured at module load — set env BEFORE dynamic import so tests
// never touch real .cortex-runtime state.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-msgs-'));
process.env.CORTEX_AGENTS_STATE_DIR = tmp;
const {
  sendMessage, pendingMessages, messagesBlock, markMessagesDelivered,
  extractAndSendMessages, consumeMentioned, listMessages,
} = await import('../cortex-agents/messages');

const AGENTS = ['scout', 'builder', 'distributor'];

function seedAgents() {
  fs.writeFileSync(path.join(tmp, 'agents-state.json'), JSON.stringify({
    agents: AGENTS.map((id) => ({ id, name: id.toUpperCase() })),
  }));
}

function clear() {
  for (const f of ['messages.json', 'agents-state.json', 'strategy-proposals.json']) {
    fs.rmSync(path.join(tmp, f), { force: true });
  }
}

describe('agent message bus', () => {
  beforeEach(() => { clear(); seedAgents(); });

  it('sends a valid typed message and lists it pending', () => {
    const r = sendMessage({ from: 'scout', to: 'builder', type: 'handoff', payload: 'found 3 repos' });
    expect(r.ok).toBe(true);
    expect(r.message?.status).toBe('pending');
    expect(pendingMessages('builder')).toHaveLength(1);
    expect(pendingMessages('scout')).toHaveLength(0);
  });

  it('rejects invalid type, self-send, and unknown endpoints', () => {
    expect(sendMessage({ from: 'scout', to: 'builder', type: 'dm', payload: 'x' }).ok).toBe(false);
    expect(sendMessage({ from: 'scout', to: 'scout', type: 'signal', payload: 'x' }).ok).toBe(false);
    expect(sendMessage({ from: 'scout', to: 'ghost', type: 'signal', payload: 'x' }).ok).toBe(false);
    expect(sendMessage({ from: 'ghost', to: 'builder', type: 'signal', payload: 'x' }).ok).toBe(false);
    expect(sendMessage({ from: 'scout', to: 'builder', type: 'signal', payload: '' }).ok).toBe(false);
  });

  it('dedupes on dedupeKey while message is live', () => {
    const a = sendMessage({ from: 'scout', to: 'builder', type: 'signal', payload: 'x', dedupeKey: 'k1' });
    const b = sendMessage({ from: 'scout', to: 'builder', type: 'signal', payload: 'y', dedupeKey: 'k1' });
    expect(a.ok && b.ok).toBe(true);
    expect(b.deduped).toBe(true);
    expect(b.message?.id).toBe(a.message?.id);
    expect(listMessages({ status: 'pending' })).toHaveLength(1);
  });

  it('delivers once, then consumes on id citation', () => {
    const r = sendMessage({ from: 'scout', to: 'builder', type: 'request', payload: 'review spec', correlationId: 'corr-1' });
    const id = r.message!.id;
    const block = messagesBlock('builder');
    expect(block).toContain(id);
    expect(block).toContain('corr-1');
    markMessagesDelivered('builder', 'task-1');
    expect(pendingMessages('builder')).toHaveLength(0);
    consumeMentioned('builder', `done, addressed ${id}`);
    const m = listMessages({ agentId: 'builder' })[0];
    expect(m.status).toBe('consumed');
    expect(m.deliveredTaskId).toBe('task-1');
  });

  it('expires stale pending messages honestly', () => {
    sendMessage({ from: 'scout', to: 'builder', type: 'signal', payload: 'old', ttlMs: -1000 });
    expect(pendingMessages('builder')).toHaveLength(0);
    expect(listMessages({ status: 'expired' })).toHaveLength(1);
  });

  it('extractAndSendMessages parses fenced blocks and enforces validation', () => {
    const result = [
      'work done',
      '```agent_message',
      '{"to":"builder","type":"handoff","payload":"spec ready","correlationId":"corr-9"}',
      '```',
      '```agent_message',
      '{"to":"ghost","type":"signal","payload":"bad"}',
      '```',
      '```agent_message',
      'not json',
      '```',
    ].join('\n');
    const { sent, rejected } = extractAndSendMessages('scout', result);
    expect(sent).toBe(1);
    expect(rejected).toBe(2);
    const msgs = pendingMessages('builder');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].correlationId).toBe('corr-9');
    expect(msgs[0].from).toBe('scout');
  });

  it('crew-bound messages file an INBOX proposal', () => {
    const r = sendMessage({ from: 'scout', to: 'crew', type: 'request', payload: 'approve budget raise' });
    expect(r.ok).toBe(true);
    const proposals = JSON.parse(fs.readFileSync(path.join(tmp, 'strategy-proposals.json'), 'utf-8'));
    expect(proposals.length).toBe(1);
    expect(proposals[0].status).toBe('pending');
    expect(proposals[0].instruction).toContain('approve budget raise');
  });

  it('agent-to-agent request types also file an INBOX proposal', () => {
    sendMessage({ from: 'scout', to: 'builder', type: 'request', payload: 'need sign-off on approach' });
    const proposals = JSON.parse(fs.readFileSync(path.join(tmp, 'strategy-proposals.json'), 'utf-8'));
    expect(proposals.length).toBe(1);
    expect(proposals[0].instruction).toContain('need sign-off');
    // non-request traffic does not file proposals
    sendMessage({ from: 'scout', to: 'builder', type: 'signal', payload: 'fyi only' });
    const after = JSON.parse(fs.readFileSync(path.join(tmp, 'strategy-proposals.json'), 'utf-8'));
    expect(after.length).toBe(1);
  });

  it('urgent messages inject ahead of normal traffic', () => {
    sendMessage({ from: 'scout', to: 'builder', type: 'signal', payload: 'normal first', dedupeKey: 'n1' });
    sendMessage({ from: 'scout', to: 'builder', type: 'signal', payload: 'urgent second', dedupeKey: 'u1', priority: 'urgent' });
    const pending = pendingMessages('builder');
    expect(pending[0].payload).toBe('urgent second');
    expect(pending[0].priority).toBe('urgent');
    expect(messagesBlock('builder').indexOf('URGENT')).toBeLessThan(messagesBlock('builder').indexOf('normal first'));
  });

  it('enforces the per-sender daily cap', () => {
    for (let i = 0; i < 30; i++) {
      sendMessage({ from: 'scout', to: 'builder', type: 'signal', payload: `m${i}`, dedupeKey: `d${i}` });
      markMessagesDelivered('builder', 't'); // keep pending under its own cap
    }
    const over = sendMessage({ from: 'scout', to: 'builder', type: 'signal', payload: 'overflow' });
    expect(over.ok).toBe(false);
    expect(over.error).toContain('daily cap');
  });
});
