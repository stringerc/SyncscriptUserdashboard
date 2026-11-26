import { describe, it, expect } from 'vitest';
import { clusterEpisodeEmbeddings } from '../consciousness/episode-themes';

function emb(seed: number): number[] {
  // deterministic pseudo-random 32-dim embedding
  const v: number[] = [];
  let s = seed;
  for (let i = 0; i < 32; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    v.push(((s / 2147483648) * 2 - 1) * 0.5);
  }
  return v;
}

describe('clusterEpisodeEmbeddings', () => {
  it('returns empty when fewer episodes than clusters', () => {
    expect(clusterEpisodeEmbeddings([
      { embedding: emb(1), phi: 0.5, actualScore: 0.7, chosenKind: 'reset' },
    ], 3)).toEqual([]);
  });

  it('clusters episodes and reports dominant kind + means', () => {
    // Two tight clusters: seeds 1-3 similar-ish region A via small perturbation,
    // seeds 100-102 region B. k-means on 32-dim random vectors will separate
    // by construction distance — assert structure not exact partition.
    const eps = [
      ...[1, 2, 3].map((s) => ({ embedding: emb(s), phi: 0.6, actualScore: 0.8, chosenKind: 'topic_boost' })),
      ...[101, 102, 103].map((s) => ({ embedding: emb(s), phi: 0.3, actualScore: 0.4, chosenKind: 'explore' })),
    ];
    const themes = clusterEpisodeEmbeddings(eps, 2);
    expect(themes.length).toBe(2);
    expect(themes.reduce((a, t) => a + t.size, 0)).toBe(6);
    for (const t of themes) {
      expect(['topic_boost', 'explore']).toContain(t.dominantKind);
      expect(t.meanPhi).not.toBeNull();
      expect(t.meanActual).not.toBeNull();
    }
    // clusters sorted by size desc
    expect(themes[0].size).toBeGreaterThanOrEqual(themes[1].size);
  });

  it('skips episodes without embeddings', () => {
    const eps = [
      { phi: 0.5, actualScore: 0.7, chosenKind: 'reset' }, // no embedding
      ...[1, 2, 3, 4].map((s) => ({ embedding: emb(s), phi: 0.5, actualScore: 0.6, chosenKind: 'reset' })),
    ];
    const themes = clusterEpisodeEmbeddings(eps, 2);
    expect(themes.reduce((a, t) => a + t.size, 0)).toBe(4);
  });
});
