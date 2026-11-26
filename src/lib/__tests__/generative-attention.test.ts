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
    const gal = new GenerativeAttentionLoop(makeHost(), { memoryPath: null, experienceModelPath: null });
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
    }), { memoryPath: null, experienceModelPath: null });
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
    }), { memoryPath: null, experienceModelPath: null });
    const sel = gal.deliberate();
    expect(sel.chosen.kind).not.toBe('topic_boost');
    expect(sel.chosen.vetoed).toBe(false);
  });

  it('recordOutcome closes the loop and updates the model', () => {
    const gal = new GenerativeAttentionLoop(makeHost(), { memoryPath: null, experienceModelPath: null });
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
    const gal = new GenerativeAttentionLoop(makeHost(), { memoryPath: null, experienceModelPath: null });
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
    const gal = new GenerativeAttentionLoop(makeHost(), { memoryPath: memPath, experienceModelPath: null });
    gal.deliberate();
    gal.recordOutcome({ score: 0.8, ignited: true, spread: 0.7, phi: 0.6 });
    gal.deliberate();
    gal.recordOutcome({ score: 0.4, ignited: false, spread: 0.3, phi: 0.4 });

    const raw = fs.readFileSync(memPath, 'utf8').trim().split('\n');
    expect(raw.length).toBe(2);
    const parsed = JSON.parse(raw[0]);
    expect(parsed.actualScore).toBe(0.8);

    const gal2 = new GenerativeAttentionLoop(makeHost(), { memoryPath: memPath, experienceModelPath: null });
    expect(gal2.episodeCount).toBe(2);
    expect(gal2.getRecentEpisodes(1)[0].actualScore).toBe(0.4);
  });

  it('volitionalDepth reports honest components', () => {
    const gal = new GenerativeAttentionLoop(makeHost(), { memoryPath: null, experienceModelPath: null });
    const depth = gal.getVolitionalDepth();
    expect(depth.score).toBeGreaterThanOrEqual(0);
    expect(depth.score).toBeLessThanOrEqual(1);
    expect(depth.episodes).toBe(0);
    expect(depth.predictionAccuracy).toBe(0.5); // no data → neutral prior
  });

  it('attentionVeto hook replaces built-in veto and surfaces metaVetoed', () => {
    const gal = new GenerativeAttentionLoop(makeHost(), {
      memoryPath: null,
      experienceModelPath: null,
      attentionVeto: (req) => req.kind === 'explore'
        ? { shouldVeto: false, vetoScore: 0.5, metaVetoed: true, reason: 'meta' }
        : { shouldVeto: req.kind === 'reset', vetoScore: 0.9 },
    });
    const sel = gal.deliberate();
    const explore = sel.candidates.find((c) => c.kind === 'explore');
    expect(explore?.vetoed).toBe(false);
    expect(explore?.metaVetoed).toBe(true);
    const reset = sel.candidates.find((c) => c.kind === 'reset');
    expect(reset?.vetoed).toBe(true);
    expect(sel.chosen.vetoed).toBe(false);
  });

  it('selfSignal valence biases explore predictions (closed self-model loop)', () => {
    const neg = new GenerativeAttentionLoop(makeHost(), {
      memoryPath: null, experienceModelPath: null,
      selfSignal: () => ({ recentValence: -0.8, recentAgency: 0.9, attentionEpisodes: 12 }),
    });
    const pos = new GenerativeAttentionLoop(makeHost(), {
      memoryPath: null, experienceModelPath: null,
      selfSignal: () => ({ recentValence: 0.8, recentAgency: 0.9, attentionEpisodes: 12 }),
    });
    const negExplore = neg.deliberate().candidates.find((c) => c.kind === 'explore');
    const posExplore = pos.deliberate().candidates.find((c) => c.kind === 'explore');
    expect(negExplore).toBeDefined();
    expect(posExplore).toBeDefined();
    expect(posExplore!.predictedScore).toBeGreaterThan(negExplore!.predictedScore);

    // episode records the self-valence that biased the cycle
    const ep = pos.recordOutcome({ score: 0.7, ignited: true, spread: 0.5, phi: 0.5 });
    expect(ep?.selfValence).toBeCloseTo(0.8, 5);
  });

  it('same-cycle φ-recovery engages when trained and last broadcast integrated poorly', () => {
    const expPath = path.join(tmpDir, 'exp-model.json');
    const gal = new GenerativeAttentionLoop(makeHost(), {
      memoryPath: null, experienceModelPath: expPath,
    });
    // Train the experience model past the trust threshold with healthy φ.
    for (let i = 0; i < 25; i++) {
      gal.deliberate();
      gal.recordOutcome({ score: 0.8, ignited: true, spread: 0.7, phi: 0.7 });
    }
    // Collapse φ → recovery pending for next deliberation.
    gal.deliberate();
    gal.recordOutcome({ score: 0.4, ignited: false, spread: 0.2, phi: 0.05 });

    const sel = gal.deliberate();
    expect(sel.phiRecovery?.attempted).toBe(true);
    const ep = gal.recordOutcome({ score: 0.6, ignited: true, spread: 0.5, phi: 0.5 });
    expect(ep?.recoveryApplied).toBe(sel.phiRecovery?.applied === true || undefined);
  });

  it('untrained model falls back to next-cycle explore bias, not same-cycle recovery', () => {
    const gal = new GenerativeAttentionLoop(makeHost(), {
      memoryPath: null, experienceModelPath: null, // no MLP → cannot predict φ
    });
    gal.deliberate();
    gal.recordOutcome({ score: 0.4, ignited: false, spread: 0.2, phi: 0.05 });
    const sel = gal.deliberate();
    expect(sel.phiRecovery?.attempted).toBe(false);
  });

  it('temporalPhi integrates φ over the specious-present window', () => {
    const gal = new GenerativeAttentionLoop(makeHost(), { memoryPath: null, experienceModelPath: null });
    expect(gal.getTemporalPhi()).toBe(0.5); // empty → neutral prior
    for (let i = 0; i < 10; i++) {
      gal.deliberate();
      gal.recordOutcome({ score: 0.8, ignited: true, spread: 0.7, phi: 0.8 });
    }
    const tp = gal.getTemporalPhi();
    expect(tp).toBeGreaterThan(0.6);
    expect(tp).toBeLessThanOrEqual(1);
    const depth = gal.getVolitionalDepth();
    expect(depth.temporalPhi).toBeCloseTo(tp, 2);
  });

  it('lookahead stays off without gamma or without a trained model', () => {
    const gal = new GenerativeAttentionLoop(makeHost(), {
      memoryPath: null, experienceModelPath: null, lookaheadGamma: 0.3,
    });
    for (let i = 0; i < 25; i++) {
      gal.deliberate();
      gal.recordOutcome({ score: 0.8, ignited: true, spread: 0.7, phi: 0.7 });
    }
    // experienceModelPath null → no MLP → lookahead cannot engage
    const sel = gal.deliberate();
    expect(sel.lookahead).toBeUndefined();
  });

  it('lookahead engages when trained and reports whether it changed the argmax', () => {
    const expPath = path.join(tmpDir, 'exp-lookahead.json');
    const gal = new GenerativeAttentionLoop(makeHost(), {
      memoryPath: null, experienceModelPath: expPath, lookaheadGamma: 0.3,
    });
    for (let i = 0; i < 25; i++) {
      gal.deliberate();
      gal.recordOutcome({ score: 0.8, ignited: true, spread: 0.7, phi: 0.7 });
    }
    const sel = gal.deliberate();
    expect(sel.lookahead).toBeDefined();
    expect(typeof sel.lookahead!.changed).toBe('boolean');
    const ep = gal.recordOutcome({ score: 0.8, ignited: true, spread: 0.7, phi: 0.7 });
    // false = lookahead ran and kept the myopic pick; undefined = inactive
    expect(ep?.lookaheadChanged === undefined || typeof ep.lookaheadChanged === 'boolean').toBe(true);
  });

  it('records interoceptive error and the strongest suppressed future', () => {
    const gal = new GenerativeAttentionLoop(makeHost(), {
      memoryPath: null, experienceModelPath: null,
      interoception: () => ({ error: 0.9, surprise: 0.2, capacity: 0.1 }),
      attentionVeto: () => ({ shouldVeto: true, vetoScore: 0.9 }),
    });
    const sel = gal.deliberate();
    expect(sel.interoError).toBeCloseTo(0.9, 5);
    // every non-status-quo candidate vetoed → status quo survives
    expect(sel.chosen.kind).toBe('status_quo');
    const ep = gal.recordOutcome({ score: 0.5, ignited: false, spread: 0.3, phi: 0.4 });
    expect(ep?.interoError).toBeCloseTo(0.9, 3);
    expect(ep?.topVetoed).toBeDefined();
    expect(ep?.topVetoed?.kind).not.toBe('status_quo');
    expect(ep?.topVetoed?.vetoScore).toBe(0.9);
  });

  it('interoception absent → no interoError recorded', () => {
    const gal = new GenerativeAttentionLoop(makeHost(), {
      memoryPath: null, experienceModelPath: null,
    });
    const sel = gal.deliberate();
    expect(sel.interoError).toBeUndefined();
  });

  it('records graded veto margin on candidates and episodes', () => {
    const gal = new GenerativeAttentionLoop(makeHost(), {
      memoryPath: null, experienceModelPath: null,
      attentionVeto: () => ({ shouldVeto: false, vetoScore: 0.3, vetoThreshold: 0.62 }),
    });
    const sel = gal.deliberate();
    const nonSq = sel.candidates.find((c) => c.kind !== 'status_quo');
    expect(nonSq?.vetoMargin).toBeCloseTo(0.32, 5);
    const ep = gal.recordOutcome({ score: 0.7, ignited: true, spread: 0.5, phi: 0.5 });
    expect(ep?.chosenVetoMargin).not.toBeNull();
  });
});
