import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SocialToMLayer } from '../consciousness/social-tom';
import { AgentOutcomeModel } from '../consciousness/agent-model';

const TMP = path.join(process.cwd(), '.cortex-runtime', '__tom_test__');

function task(agentId: string, kind: string, status: string, durationMs = 60_000, at = Date.now()) {
  return { agentId, kind, status, durationMs, finishedAt: at, createdAt: at - durationMs };
}

describe('AgentOutcomeModel', () => {
  it('starts untrained with neutral priors', () => {
    const m = new AgentOutcomeModel('test-agent', null);
    const p = m.predict(new Array(8).fill(0.5));
    expect(m.isTrained).toBe(false);
    expect(m.updateCount).toBe(0);
    expect(p.successProb).toBeGreaterThanOrEqual(0);
    expect(p.successProb).toBeLessThanOrEqual(1);
  });

  it('learns a consistent success pattern', () => {
    const m = new AgentOutcomeModel('test-agent', null);
    const x = [0.9, 0.1, 0.2, 0.3, 1, 0.2, 0.1, 0.5];
    for (let i = 0; i < 60; i++) m.update(x, [1, 0.2]);
    expect(m.isTrained).toBe(true);
    const p = m.predict(x);
    expect(p.successProb).toBeGreaterThan(0.7);
  });

  it('learns a consistent failure pattern distinctly', () => {
    const m = new AgentOutcomeModel('test-agent', null);
    const xGood = [0.9, 0.1, 0.2, 0.3, 1, 0.2, 0.1, 0.5];
    const xBad = [0.1, 0.9, 0.8, 0.9, 0, 0.9, 0.9, 0.1];
    for (let i = 0; i < 60; i++) { m.update(xGood, [1, 0.2]); m.update(xBad, [0, 0.9]); }
    expect(m.predict(xGood).successProb).toBeGreaterThan(m.predict(xBad).successProb);
  });

  it('persists and reloads weights', () => {
    fs.mkdirSync(TMP, { recursive: true });
    const m1 = new AgentOutcomeModel('persist-agent', TMP);
    const x = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    for (let i = 0; i < 30; i++) m1.update(x, [1, 0.3]);
    m1.flush();
    const m2 = new AgentOutcomeModel('persist-agent', TMP);
    expect(m2.updateCount).toBe(30);
    expect(m2.isTrained).toBe(true);
    fs.rmSync(TMP, { recursive: true, force: true });
  });
});

describe('SocialToMLayer', () => {
  let tom: SocialToMLayer;

  beforeEach(() => {
    tom = new SocialToMLayer(null);
  });
  afterEach(() => fs.rmSync(TMP, { recursive: true, force: true }));

  it('returns null for unmodeled agents', () => {
    expect(tom.predict('ghost')).toBeNull();
    expect(tom.summary().modeledAgents).toBe(0);
  });

  it('observes tasks and builds per-agent models', () => {
    for (let i = 0; i < 30; i++) {
      tom.observe(task('scout', 'scan', i % 5 === 0 ? 'failed' : 'completed', 30_000, Date.now() - (30 - i) * 60_000));
    }
    const p = tom.predict('scout', 'scan');
    expect(p).not.toBeNull();
    expect(p!.updates).toBe(30);
    expect(p!.trained).toBe(true);
    const s = tom.summary() as any;
    expect(s.modeledAgents).toBe(1);
    expect(s.agents.scout.observed).toBe(30);
  });

  it('keeps agents separate', () => {
    for (let i = 0; i < 20; i++) tom.observe(task('scout', 'scan', 'completed'));
    for (let i = 0; i < 20; i++) tom.observe(task('librarian', 'distill', 'failed'));
    const sp = tom.predict('scout')!;
    const lp = tom.predict('librarian')!;
    expect(sp.successProb).toBeGreaterThan(lp.successProb);
    expect((tom.summary() as any).modeledAgents).toBe(2);
  });

  it('bootstrap replays history oldest→newest', () => {
    const rows = [
      task('scout', 'a', 'failed', 10_000, 1000),
      task('scout', 'a', 'completed', 10_000, 2000),
      task('scout', 'a', 'completed', 10_000, 3000),
    ];
    const n = tom.bootstrap(rows);
    expect(n).toBe(3);
    const p = tom.predict('scout');
    expect(p!.updates).toBe(3);
  });

  it('predictionAccuracy logs pre-outcome predictions once trained', () => {
    for (let i = 0; i < 25; i++) tom.observe(task('scout', 'k', 'completed'));
    tom.observe(task('scout', 'k', 'completed'));
    const acc = tom.predictionAccuracy();
    expect(acc.samples).toBeGreaterThanOrEqual(1);
    expect(acc.mae).not.toBeNull();
  });
});
