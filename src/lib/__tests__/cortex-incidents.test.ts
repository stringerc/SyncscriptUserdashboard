import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'incidents-test-'));
process.env.CORTEX_AGENTS_STATE_DIR = tmp;

const {
  recordIncidentFailure,
  resolveIncidentsOnSuccess,
  sweepIncidentTtl,
  listIncidents,
} = await import('../cortex-agents/incidents');

const fail = (kind = 'heal_anomaly', agentId = 'antigravity') =>
  recordIncidentFailure({
    taskId: `task-${Math.random().toString(36).slice(2, 8)}`,
    agentId, kind, title: 'test failure', failureClass: 'provider', error: 'lane down',
  })!;

describe('incident TTL sweep', () => {
  beforeEach(() => fs.rmSync(path.join(tmp, 'incidents.json'), { force: true }));
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('expires incidents dormant past the TTL and says so honestly', () => {
    fail();
    const future = Date.now() + 25 * 3600_000;
    expect(sweepIncidentTtl({ now: future })).toBe(1);
    const [inc] = listIncidents('resolved');
    expect(inc.status).toBe('resolved');
    expect(inc.resolutionNote).toMatch(/auto-expired.*unverified heal/i);
  });

  it('leaves recently-seen incidents open', () => {
    fail();
    expect(sweepIncidentTtl({ now: Date.now() + 3600_000 })).toBe(0);
    expect(listIncidents('open').length).toBe(1);
  });

  it('a recurrence after expiry reopens the ticket with count preserved', () => {
    const inc = fail();
    sweepIncidentTtl({ ttlHours: 0.0001, now: Date.now() + 1000 });
    expect(listIncidents('resolved').length).toBe(1);
    const again = recordIncidentFailure({
      taskId: 'task-again', agentId: 'antigravity', kind: 'heal_anomaly',
      title: 'test failure', failureClass: 'provider', error: 'still down',
    })!;
    expect(again.status).toBe('open');
    expect(again.count).toBe(inc.count + 1);
  });

  it('does not touch already-resolved incidents', () => {
    fail('orchestrate', 'antigravity');
    resolveIncidentsOnSuccess('antigravity', 'orchestrate', 'task-ok');
    const n = sweepIncidentTtl({ ttlHours: 0.0001, now: Date.now() + 1000 });
    expect(n).toBe(0);
    expect(listIncidents('resolved').length).toBe(1);
  });
});
