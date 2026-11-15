import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let forecaster: typeof import('../cortex-agents/forecaster');
let tmpDir: string;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forecaster-test-'));
  process.env.CORTEX_AGENTS_STATE_DIR = tmpDir;
  forecaster = await import('../cortex-agents/forecaster');
});

afterAll(() => {
  delete process.env.CORTEX_AGENTS_STATE_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const NOW = Date.now();
const ev = (ref = 'x') => [{ kind: 'test', ref }];

function sig(over: Partial<import('../cortex-agents/forecaster').ForecastSignal> = {}) {
  return {
    id: 'test:1',
    domain: 'fleet' as const,
    claim: 'test claim',
    evidence: ev(),
    confidence: 0.9,
    horizon: { notBefore: NOW, notAfter: NOW + 3600_000 },
    urgency: 'proposal' as const,
    ...over,
  };
}

describe('routeSignals — evidence & dedupe', () => {
  it('drops signals with zero evidence', () => {
    const { routed, dropped } = forecaster.routeSignals(
      [sig({ id: 'a', evidence: [] }), sig({ id: 'b' })],
      forecaster.freshRouterState(NOW), NOW,
    );
    expect(dropped).toBe(1);
    expect(routed.map((r) => r.id)).toEqual(['b']);
  });

  it('dedupes by id keeping highest confidence', () => {
    const { routed } = forecaster.routeSignals(
      [sig({ id: 'dup', confidence: 0.5 }), sig({ id: 'dup', confidence: 0.9 })],
      forecaster.freshRouterState(NOW), NOW,
    );
    expect(routed).toHaveLength(1);
    expect(routed[0].confidence).toBe(0.9);
  });
});

describe('routeSignals — tier routing & budget', () => {
  it('maps urgency to tiers', () => {
    const { routed } = forecaster.routeSignals(
      [
        sig({ id: 'a', urgency: 'ambient' }),
        sig({ id: 'b', urgency: 'proposal' }),
        sig({ id: 'c', urgency: 'interrupt', confidence: 0.95 }),
      ],
      forecaster.freshRouterState(NOW), NOW,
    );
    expect(routed.find((r) => r.id === 'a')?.tier).toBe(1);
    expect(routed.find((r) => r.id === 'b')?.tier).toBe(2);
    expect(routed.find((r) => r.id === 'c')?.tier).toBe(3);
  });

  it('demotes interrupt signals under 0.8 confidence to proposals', () => {
    const { routed } = forecaster.routeSignals(
      [sig({ id: 'x', urgency: 'interrupt', confidence: 0.7 })],
      forecaster.freshRouterState(NOW), NOW,
    );
    expect(routed[0].tier).toBe(2);
    expect(routed[0].demoted).toBe(true);
  });

  it('enforces the 3/day spoken budget then demotes', () => {
    const state = { spokenToday: 3, spokenDay: new Date(NOW).toISOString().slice(0, 10) };
    const { routed } = forecaster.routeSignals(
      [sig({ id: 'i1', urgency: 'interrupt', confidence: 0.95 })],
      state, NOW,
    );
    expect(routed[0].tier).toBe(2);
    expect(routed[0].demoted).toBe(true);
  });

  it('spoken counter resets on a new day', () => {
    const state = { spokenToday: 3, spokenDay: '2000-01-01' };
    const { routed } = forecaster.routeSignals(
      [sig({ id: 'i1', urgency: 'interrupt', confidence: 0.95 })],
      state, NOW,
    );
    expect(routed[0].tier).toBe(3);
  });
});

describe('fleetProbe', () => {
  it('emits stalled + failstreak signals from a snapshot', async () => {
    const signals = await forecaster.fleetProbe.run({
      now: NOW, base: 'http://x', fetchImpl: fetch as any,
      getAgentSnapshot: () => ({
        agents: [
          { id: 'scout', status: 'error', lastHeartbeatAt: NOW },
          { id: 'builder', status: 'idle', lastHeartbeatAt: NOW },
          { id: 'warden', status: 'idle', lastHeartbeatAt: NOW - 20 * 60_000 },
        ],
        tasks: [
          { agentId: 'scout', status: 'queued', createdAt: NOW },
          { agentId: 'builder', status: 'failed', createdAt: NOW - 1 },
          { agentId: 'builder', status: 'failed', createdAt: NOW - 2 },
          { agentId: 'builder', status: 'failed', createdAt: NOW - 3 },
        ],
      }),
    });
    const ids = signals.map((s) => s.id);
    expect(ids).toContain('fleet:scout:stalled');
    expect(ids).toContain('fleet:builder:failstreak');
    expect(ids).toContain('fleet:warden:stalehb');
    for (const s of signals) expect(s.evidence.length).toBeGreaterThan(0);
  });

  it('returns empty when no snapshot source is configured', async () => {
    expect(await forecaster.fleetProbe.run({ now: NOW, base: 'http://x', fetchImpl: fetch as any })).toEqual([]);
  });
});

describe('calendarProbe', () => {
  it('flags meetings inside 3h without a prep brief', async () => {
    const signals = await forecaster.calendarProbe.run({
      now: NOW, base: 'http://x', fetchImpl: fetch as any,
      listUpcomingEvents: async () => [
        { id: 'e1', title: 'Client sync', start: NOW + 2 * 3600_000, attendees: 3, hasPrepBrief: false },
        { id: 'e2', title: 'Already prepped', start: NOW + 3600_000, attendees: 2, hasPrepBrief: true },
        { id: 'e3', title: 'Far away', start: NOW + 10 * 3600_000, attendees: 2 },
      ],
    });
    expect(signals.map((s) => s.id)).toEqual(['calendar:e1:noprep']);
    expect(signals[0].urgency).toBe('proposal');
    expect(signals[0].personalRelevance).toBe(1);
  });
});

describe('runForecastCycle', () => {
  it('runs probes, routes, files proposals, persists budget', async () => {
    const proposals: string[] = [];
    const result = await forecaster.runForecastCycle(
      {
        now: NOW, base: 'http://x', fetchImpl: fetch as any,
        getAgentSnapshot: () => ({ agents: [{ id: 'scout', status: 'error', lastHeartbeatAt: NOW }], tasks: [{ agentId: 'scout', status: 'queued', createdAt: NOW }] }),
      },
      {
        state: forecaster.freshRouterState(NOW),
        submitProposal: (r) => { proposals.push(r.id); return { id: r.id }; },
      },
    );
    expect(result.signalsFound).toBeGreaterThan(0);
    expect(result.routed.length).toBe(result.signalsFound);
    expect(result.droppedNoEvidence).toBe(0);
    expect(proposals.length).toBe(result.routed.filter((r) => r.tier === 2).length);
    // Ledger + state files were written under the tmp dir.
    expect(fs.existsSync(path.join(tmpDir, 'forecaster-state.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'forecasts.jsonl'))).toBe(true);
  });
});

describe('commsProbe', () => {
  const deps = (inbox: any) => ({
    now: NOW, base: 'http://x', fetchImpl: fetch as any,
    getInboxSummary: async () => inbox,
  });
  it('emits backlog signal at >=1000 unread', async () => {
    const out = await forecaster.commsProbe.run(deps({ found: true, unreadCount: 22825, threads: [] }));
    expect(out.map((s) => s.id)).toContain('comms:backlog');
    expect(out[0].urgency).toBe('proposal');
  });
  it('silent when inbox not found or unread low', async () => {
    expect(await forecaster.commsProbe.run(deps({ found: false }))).toEqual([]);
    expect(await forecaster.commsProbe.run(deps({ found: true, unreadCount: 12, threads: [] }))).toEqual([]);
    expect(await forecaster.commsProbe.run({ now: NOW, base: 'http://x', fetchImpl: fetch as any })).toEqual([]);
  });
  it('flags stale unread threads', async () => {
    const old = new Date(NOW - 20 * 24 * 3600_000).toISOString();
    const threads = Array.from({ length: 12 }, (_, i) => ({ unread: true, date: old, subject: `t${i}` }));
    const out = await forecaster.commsProbe.run(deps({ found: true, unreadCount: 5000, threads }));
    expect(out.map((s) => s.id)).toContain('comms:stale-threads');
  });
});

describe('buildProbe', () => {
  const deps = (snap: any) => ({
    now: NOW, base: 'http://x', fetchImpl: fetch as any,
    getSenseSnapshot: async () => snap,
  });
  it('emits uncommitted-debt and no-commits', async () => {
    const out = await forecaster.buildProbe.run(deps({ uncommittedFileCount: 87, commitsLast7d: 0 }));
    expect(out.map((s) => s.id).sort()).toEqual(['build:no-commits', 'build:uncommitted-debt']);
  });
  it('silent on healthy repo', async () => {
    expect(await forecaster.buildProbe.run(deps({ uncommittedFileCount: 3, commitsLast7d: 5 }))).toEqual([]);
    expect(await forecaster.buildProbe.run({ now: NOW, base: 'http://x', fetchImpl: fetch as any })).toEqual([]);
  });
});

describe('distributionProbe', () => {
  const deps = (status: any) => ({
    now: NOW, base: 'http://x', fetchImpl: fetch as any,
    getDistributionStatus: async () => status,
  });
  it('emits failed-items proposal', async () => {
    const out = await forecaster.distributionProbe.run(deps({ queue: { counts: { failed: 2, pending: 3, done: 10 } } }));
    expect(out[0].id).toBe('distribution:failed-items');
    expect(out[0].urgency).toBe('proposal');
  });
  it('silent when queue healthy or status absent', async () => {
    expect(await forecaster.distributionProbe.run(deps({ queue: { counts: { failed: 0, pending: 2, done: 9 } } }))).toEqual([]);
    expect(await forecaster.distributionProbe.run({ now: NOW, base: 'http://x', fetchImpl: fetch as any })).toEqual([]);
  });
});

describe('weatherProbe', () => {
  const deps = (alerts: any) => ({
    now: NOW, base: 'http://x', fetchImpl: fetch as any,
    getWeatherAlerts: async () => alerts,
  });
  it('interrupts on severe alert in watched region', async () => {
    const out = await forecaster.weatherProbe.run(deps({ count: 2, maxSeverity: 'Severe', regions: ['GAZ053'] }));
    expect(out).toHaveLength(1);
    expect(out[0].urgency).toBe('interrupt');
    expect(out[0].personalRelevance).toBe(1);
  });
  it('silent on moderate or absent alerts', async () => {
    expect(await forecaster.weatherProbe.run(deps({ count: 3, maxSeverity: 'Moderate', regions: ['GAZ053'] }))).toEqual([]);
    expect(await forecaster.weatherProbe.run(deps(null))).toEqual([]);
    expect(await forecaster.weatherProbe.run({ now: NOW, base: 'http://x', fetchImpl: fetch as any })).toEqual([]);
  });
});

describe('energyProbe', () => {
  it('emits trough advisory during low-circadian hours', async () => {
    const trough = new Date(NOW);
    trough.setHours(14, 0, 0, 0);
    const out = await forecaster.energyProbe.run({ now: trough.getTime(), base: 'http://x', fetchImpl: fetch as any });
    expect(out.map((s) => s.id)).toContain(`energy:trough:${new Date(trough.getTime()).toISOString().slice(0, 10)}`);
    expect(out[0].urgency).toBe('ambient');
  });
  it('silent during peak hours', async () => {
    const peak = new Date(NOW);
    peak.setHours(10, 0, 0, 0);
    expect(await forecaster.energyProbe.run({ now: peak.getTime(), base: 'http://x', fetchImpl: fetch as any })).toEqual([]);
  });
});

describe('calendarProbe prep handoff', () => {
  it('attaches a PREP handoff to noprep signals', async () => {
    const start = NOW + 2 * 3600_000;
    const out = await forecaster.calendarProbe.run({
      now: NOW, base: 'http://x', fetchImpl: fetch as any,
      listUpcomingEvents: async () => [{
        id: 'ev1', title: 'Q3 Review', start, end: start + 3600_000,
        attendees: 3, attendeeNames: ['alice@x.com', 'bob@x.com'],
      }],
    });
    const noprep = out.find((s) => s.id === 'calendar:ev1:noprep');
    expect(noprep?.handoff?.agent).toBe('prep');
    expect(noprep?.handoff?.kind).toBe('prep_brief');
    expect(noprep?.handoff?.input.attendees).toEqual(['alice@x.com', 'bob@x.com']);
  });
});
