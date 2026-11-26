import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  GenerativeAttentionLoop,
  type GalHost,
} from '../consciousness/generative-attention';
import type { Intention } from '../consciousness/volition';

function makeHost(overrides: Partial<GalHost> = {}): GalHost {
  return {
    getBaseMultipliers: () => ({ alpha: 1.2, beta: 0.8, gamma: 1.0, delta: 0.6 }),
    getAttentionTopics: () => ['alpha', 'beta', 'gamma', 'delta'],
    ...overrides,
  };
}

describe('GenerativeAttentionLoop', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gal-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates candidates including status quo and selects one', () => {
    const gal = new GenerativeAttentionLoop(makeHost(), { memoryPath: null });
    const sel = gal.deliberate();
    expect(sel.candidates.length).toBeGreaterThanOrEqual(4);
    expect(sel.candidates.some((c) => c.kind === 'status_quo')).toBe(true);
    expect(sel.candidates.some((c) => c.kind === 'topic_boost')).toBe(true);
    expect(sel.candidates.every((c) => c.predictedScore >= 0 && c.predictedScore <= 1)).toBe(true);
    expect(sel.chosen.vetoed).toBe(false);
    expect(sel.candidates.find((c) => c.id === sel.chosen.id)).toBeDefined();
  });

  it('status quo is never vetoed even when veto engine rejects everything', () => {
    const gal = new GenerativeAttentionLoop(makeHost({
      evaluateVeto: () => ({ shouldVeto: true, vetoScore: 0.99, reason: 'test veto' }),
    }), { memoryPath: null });
    const sel = gal.deliberate();
    expect(sel.chosen.kind).toBe('status_quo');
    expect(sel.allAlternativesVetoed).toBe(true);
    expect(sel.candidates.filter((c) => c.vetoed).length).toBe(sel.candidates.length - 1);
  });

  it('vetoed candidates are excluded from selection', () => {
    const gal = new GenerativeAttentionLoop(makeHost({
      evaluateVeto: (intention: Intention) => ({
        shouldVeto: intention.action.params?.kind === 'topic_boost',
        vetoScore: 0.8,
      }),
    }), { memoryPath: null });
    const sel = gal.deliberate();
    expect(sel.chosen.kind).not.toBe('topic_boost');
    expect(sel.chosen.vetoed).toBe(false);
  });

  it('recordOutcome closes the loop and updates the model', () => {
    const gal = new GenerativeAttentionLoop(makeHost(), { memoryPath: null });
    const sel = gal.deliberate();
    const ep = gal.recordOutcome({ score: 0.9, ignited: true, spread: 0.8, phi: 0.7 });
    expect(ep).not.toBeNull();
    expect(ep!.chosenId).toBe(sel.chosen.id);
    expect(ep!.actualScore).toBe(0.9);
    expect(gal.modelUpdates).toBe(1);
    expect(gal.episodeCount).toBe(1);
    // second deliberate without outcome should not double-count
    expect(gal.recordOutcome({ score: 0.5, ignited: false, spread: 0.2, phi: 0.3 })).toBeNull();
  });

  it('outcome model learns: repeated high outcomes raise predictions', () => {
    const gal = new GenerativeAttentionLoop(makeHost(), { memoryPath: null });
    // Run several episodes biased to high scores
    for (let i = 0; i < 15; i++) {
      gal.deliberate();
      gal.recordOutcome({ score: 0.95, ignited: true, spread: 0.9, phi: 0.8 });
    }
    const depth = gal.getVolitionalDepth();
    expect(depth.episodes).toBe(15);
    expect(depth.modelUpdates).toBe(15);
    expect(depth.score).toBeGreaterThan(0);
    // predictions should have moved toward the high target over time
    const lastEp = gal.getRecentEpisodes(1)[0];
    expect(lastEp.predictedScore).toBeGreaterThan(0.4);
  });

  it('persists episodes to JSONL memory and reloads tail', () => {
    const memPath = path.join(tmpDir, 'attention-memory.jsonl');
    const gal = new GenerativeAttentionLoop(makeHost(), { memoryPath: memPath });
    gal.deliberate();
    gal.recordOutcome({ score: 0.8, ignited: true, spread: 0.7, phi: 0.6 });
    gal.deliberate();
    gal.recordOutcome({ score: 0.4, ignited: false, spread: 0.3, phi: 0.4 });

    const raw = fs.readFileSync(memPath, 'utf8').trim().split('\n');
    expect(raw.length).toBe(2);
    const parsed = JSON.parse(raw[0]);
    expect(parsed.actualScore).toBe(0.8);

    const gal2 = new GenerativeAttentionLoop(makeHost(), { memoryPath: memPath });
    expect(gal2.episodeCount).toBe(2);
    expect(gal2.getRecentEpisodes(1)[0].actualScore).toBe(0.4);
  });

  it('volitionalDepth reports honest components', () => {
    const gal = new GenerativeAttentionLoop(makeHost(), { memoryPath: null });
    const depth = gal.getVolitionalDepth();
    expect(depth.score).toBeGreaterThanOrEqual(0);
    expect(depth.score).toBeLessThanOrEqual(1);
    expect(depth.episodes).toBe(0);
    expect(depth.predictionAccuracy).toBe(0.5); // no data → neutral prior
  });
});
