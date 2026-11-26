import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AttentionVetoAgent } from '../consciousness/veto-agent';
import type { GalVetoRequest } from '../consciousness/generative-attention';
import type { Intention } from '../consciousness/volition';
import type { WorkspaceBroadcast } from '../global-workspace';

function makeReq(predictedScore: number, kind = 'topic_boost'): GalVetoRequest {
  const intention: Intention = {
    id: `test-${kind}-${predictedScore}`,
    value: 'epistemic-curiosity',
    action: {
      skill: 'configure_workspace_attention',
      params: { kind },
      description: `test ${kind} config`,
      predictedOutcome: 'broadcast',
    },
    predictedValue: predictedScore,
    urgency: 0.4,
    source: 'epistemic-curiosity',
    createdAt: Date.now(),
  };
  return {
    candidateId: `${kind}-0`,
    kind,
    description: `test ${kind} config`,
    predictedScore,
    intention,
  };
}

describe('AttentionVetoAgent', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'veto-agent-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scores veto impulse from predicted value and kind disruption', () => {
    const agent = new AttentionVetoAgent(null);
    const bad = agent.evaluate(makeReq(0.05, 'reset'));
    const good = agent.evaluate(makeReq(0.9, 'topic_boost'));
    expect(bad.vetoScore).toBeGreaterThan(good.vetoScore);
    expect(bad.vetoScore).toBeGreaterThan(0.5);
    expect(good.vetoScore).toBeLessThan(0.5);
  });

  it('vetoes configs the models predict will flop', () => {
    const agent = new AttentionVetoAgent(null);
    const verdict = agent.evaluate(makeReq(0.02, 'reset'));
    expect(verdict.shouldVeto).toBe(true);
    expect(verdict.reason).toContain('VETOED');
  });

  it('does not veto high-value configs', () => {
    const agent = new AttentionVetoAgent(null);
    const verdict = agent.evaluate(makeReq(0.9, 'topic_boost'));
    expect(verdict.shouldVeto).toBe(false);
    expect(verdict.metaVetoed).toBeUndefined();
  });

  it('meta-veto overrides a marginal veto on a clearly valuable config (depth-1)', () => {
    // impulse = 0.55·(1−p) + 0.20·disruption + ~0.03 constants.
    // pred 0.65 'reset' → 0.1925+0.16+0.03 ≈ 0.38: over a 0.35 threshold
    // by 0.03 (marginal ≤0.12) and predictedScore ≥0.65 (valuable) → meta.
    const agent = new AttentionVetoAgent(null, { initialThreshold: 0.35 });
    const verdict = agent.evaluate(makeReq(0.65, 'reset'));
    expect(verdict.vetoScore).toBeGreaterThan(0.35);
    expect(verdict.vetoScore - 0.35).toBeLessThanOrEqual(0.12);
    expect(verdict.shouldVeto).toBe(false);
    expect(verdict.metaVetoed).toBe(true);
    expect(verdict.reason).toContain('META-VETO');
    expect(agent.getStats().metaVetoes).toBe(1);
  });

  it('meta-veto does not fire when the veto is decisive', () => {
    const agent = new AttentionVetoAgent(null, { initialThreshold: 0.4 });
    // predictedScore 0.66 is valuable but barely; use 'reset' + we need
    // impulse far above threshold → impossible at pred 0.66; instead verify
    // a non-marginal veto stands: predictedScore 0.3 is NOT valuable, so
    // even a marginal impulse vetoes permanently.
    const verdict = agent.evaluate(makeReq(0.3, 'reset'));
    expect(verdict.shouldVeto).toBe(true);
    expect(verdict.metaVetoed).toBeUndefined();
  });

  it('adaptive threshold drifts down when veto rate sits below the Libet band', () => {
    const agent = new AttentionVetoAgent(null);
    const before = agent.getStats().threshold;
    // 100 mid-value evals → impulse ~0.43 < 0.62 → zero vetoes → threshold drops
    for (let i = 0; i < 100; i++) agent.evaluate(makeReq(0.5, 'topic_boost'));
    const after = agent.getStats();
    expect(after.evaluations).toBe(100);
    expect(after.vetoes).toBe(0);
    expect(after.threshold).toBeLessThan(before);
  });

  it('threshold drifts up when veto rate exceeds the band', () => {
    const agent = new AttentionVetoAgent(null, { initialThreshold: 0.3 });
    // pred 0.4 reset → impulse ≈ 0.55*0.6+0.16+~0.03 ≈ 0.52 > 0.3 → vetoes
    for (let i = 0; i < 100; i++) agent.evaluate(makeReq(0.4, 'reset'));
    const after = agent.getStats();
    expect(after.vetoRate).toBeGreaterThan(0.5);
    expect(after.threshold).toBeGreaterThan(0.3);
  });

  it('competes as a GWT specialist: bids status, observes broadcasts', () => {
    const agent = new AttentionVetoAgent(null);
    expect(agent.isActive()).toBe(true);
    expect(agent.submitBid()).toBeNull(); // abstains before any evaluations
    agent.evaluate(makeReq(0.8, 'topic_boost'));
    const bid = agent.submitBid();
    expect(bid).not.toBeNull();
    expect(bid!.specialistId).toBe('attention-veto-agent');
    expect(bid!.topic).toBe('consciousness');
    const broadcast = {
      cycleId: 1, winningBids: [], content: {}, recipientCount: 3,
      ignitionLatencyMs: 5, ignitionSpread: 0.7, timestamp: Date.now(),
      ignition: { cycleId: 1, timestamp: Date.now(), coalitionSize: 2, spread: 0.7, peakSalience: 0.8, latencyMs: 5, isIgnition: true, isGwtConsistent: true },
      decoupled: false,
    } as WorkspaceBroadcast;
    agent.receiveBroadcast(broadcast);
    expect(agent.getStats().broadcastsObserved).toBe(1);
    expect(agent.getStats().recentIgnitionRate).toBe(1);
  });

  it('adaptive band widens when stable and narrows when volatile', () => {
    const stable = new AttentionVetoAgent(null, { volatilitySignal: () => 0.02 });
    expect(stable.getStats().band).toEqual({ min: 0.03, max: 0.22 });
    const volatile = new AttentionVetoAgent(null, { volatilitySignal: () => 0.3 });
    expect(volatile.getStats().band).toEqual({ min: 0.07, max: 0.12 });
    const mid = new AttentionVetoAgent(null, { volatilitySignal: () => 0.15 });
    expect(mid.getStats().band).toEqual({ min: 0.05, max: 0.15 });
    const none = new AttentionVetoAgent(null);
    expect(none.getStats().band).toEqual({ min: 0.05, max: 0.15 });
  });

  it('persists threshold and counters across restarts', () => {
    const p = path.join(tmpDir, 'veto-agent.json');
    const agent = new AttentionVetoAgent(p);
    for (let i = 0; i < 20; i++) agent.evaluate(makeReq(0.5, 'topic_boost'));
    const saved = JSON.parse(fs.readFileSync(p, 'utf8'));
    expect(saved.evaluations).toBe(20);

    const agent2 = new AttentionVetoAgent(p);
    expect(agent2.getStats().evaluations).toBe(20);
    expect(agent2.getStats().threshold).toBeCloseTo(saved.threshold, 2);
  });
});
