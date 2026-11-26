import { describe, it, expect } from 'vitest';
import { describeAttentionMeta } from '../consciousness/attention-meta';
import type { GalEpisode } from '../consciousness/generative-attention';

function ep(kind: string, i: number): GalEpisode {
  return {
    ts: i * 30000, cycleId: i, chosenId: `${kind}-${i}`, chosenKind: kind,
    allVetoed: false, candidateCount: 6, vetoedCount: 0,
    predictedScore: 0.7, actualScore: 0.8, predictionError: 0.1, phi: 0.5,
  };
}

describe('describeAttentionMeta', () => {
  it('reports insufficient data honestly', () => {
    const m = describeAttentionMeta([ep('reset', 0), ep('reset', 1), ep('reset', 2)]);
    expect(m.regime).toBe('insufficient');
    expect(m.n).toBe(3);
  });

  it('detects a narrow regime when one kind dominates', () => {
    const eps = [...Array(20)].map((_, i) => ep('reset', i));
    const m = describeAttentionMeta(eps);
    expect(m.regime).toBe('narrow');
    expect(m.dominantShare).toBe(1);
    expect(m.meanDwell).toBe(20);
    expect(m.switchRate).toBe(0);
  });

  it('detects drifting when kinds alternate', () => {
    const kinds = ['reset', 'explore', 'topic_boost', 'status_quo'];
    const eps = [...Array(20)].map((_, i) => ep(kinds[i % 4], i));
    const m = describeAttentionMeta(eps);
    expect(m.switchRate).toBeGreaterThan(0.9);
    expect(['drifting', 'broad']).toContain(m.regime);
  });

  it('detects stable mixed attention', () => {
    // Two kinds in uneven blocks — no dominant kind (>0.7), low switch
    // rate, only 2 distinct kinds → 'stable' rather than 'broad'.
    const eps = [
      ...[...Array(7)].map((_, i) => ep('reset', i)),
      ...[...Array(7)].map((_, i) => ep('topic_boost', i + 7)),
      ...[...Array(6)].map((_, i) => ep('reset', i + 14)),
    ];
    const m = describeAttentionMeta(eps);
    expect(m.regime).toBe('stable');
    expect(m.switchRate).toBeCloseTo(2 / 19, 2);
  });
});
