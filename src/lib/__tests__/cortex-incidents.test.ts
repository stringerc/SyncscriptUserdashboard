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
  dismissIncident,
  dismissAllIncidents,
  autoVerifyIncident,
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

  it('expires stale incidents older than 24h that have been inactive for >2h', () => {
    const inc = fail('reddit_scan', 'distributor');
    // First seen 26h ago, last seen 3h ago
    const now = Date.now();
    inc.firstSeenAt = now - 26 * 3600_000;
    inc.lastSeenAt = now - 3 * 3600_000;
    const fs = require('node:fs');
    const path = require('node:path');
    fs.writeFileSync(path.join(tmp, 'incidents.json'), JSON.stringify([inc], null, 1));

    const swept = sweepIncidentTtl({ ttlHours: 24, now });
    expect(swept).toBe(1);
    const [resolved] = listIncidents('resolved');
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolutionNote).toMatch(/stale incident.*inactive for >2h/i);
  });
});

describe('incident manual dismissal', () => {
  beforeEach(() => {
    const fs = require('node:fs');
    const path = require('node:path');
    fs.rmSync(path.join(tmp, 'incidents.json'), { force: true });
  });

  it('dismisses a single open incident by id or key', () => {
    const inc = fail();
    expect(dismissIncident(inc.id, 'dismissed test')).toBe(true);
    const [d] = listIncidents('dismissed');
    expect(d.status).toBe('dismissed');
    expect(d.resolutionNote).toBe('dismissed test');
  });

  it('dismisses all open incidents in bulk', () => {
    fail('kind1', 'builder');
    fail('kind2', 'runner');
    expect(listIncidents('open').length).toBe(2);
    const dismissedCount = dismissAllIncidents(undefined, 'cleared by operator');
    expect(dismissedCount).toBe(2);
    expect(listIncidents('open').length).toBe(0);
    expect(listIncidents('dismissed').length).toBe(2);
  });
});

describe('incident auto-verify probe', () => {
  beforeEach(() => {
    const fs = require('node:fs');
    const path = require('node:path');
    fs.rmSync(path.join(tmp, 'incidents.json'), { force: true });
  });

  it('dispatches a verification task for warden patrol', () => {
    const inc = recordIncidentFailure({
      taskId: 't-1',
      agentId: 'warden',
      kind: 'repo_hygiene',
      title: 'stale repo uncommitted',
      failureClass: 'hygiene_stale',
      error: 'dirty',
    })!;

    let submittedAgent = '';
    let submittedKind = '';
    const fakeRuntime = {
      submitTask: (agentId: string, kind: string, title: string, input?: any) => {
        submittedAgent = agentId;
        submittedKind = kind;
        return { ok: true, task: { id: 'task-probe-1' } };
      },
    };

    const res = autoVerifyIncident(fakeRuntime, inc.id);
    expect(res.ok).toBe(true);
    expect(res.taskId).toBe('task-probe-1');
    expect(submittedAgent).toBe('warden');
    expect(submittedKind).toBe('patrol');
  });
});
