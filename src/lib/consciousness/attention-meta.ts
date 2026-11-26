/**
 * Attention Meta-State — second-order description of attention dynamics.
 *
 * What this is: the implementable core of "meta-attention" (Graziano's
 * attention schema applied to itself). Given the sequence of chosen
 * attention configs, it reports how attention is *moving*: is the system
 * narrowing onto one topic, drifting between configs, or holding a broad
 * field? Descriptive statistics only — "I notice my attention is
 * narrowing" made measurable, nothing more.
 *
 * What this is NOT: not a claim of meta-awareness. These are summary
 * statistics over the episode log; the system reports its own attention
 * dynamics the same way a dashboard reports CPU usage.
 */

import type { GalEpisode } from './generative-attention';

export interface AttentionMeta {
  /** episodes analyzed */
  n: number;
  /** Shannon entropy over chosenKind distribution, normalized 0..1 */
  kindEntropy: number;
  /** fraction of consecutive episodes that switched kind */
  switchRate: number;
  /** share held by the single most-picked kind */
  dominantShare: number;
  /** mean run-length (in episodes) of identical consecutive kinds */
  meanDwell: number;
  /** qualitative regime label */
  regime: 'narrow' | 'drifting' | 'broad' | 'stable' | 'insufficient';
}

export function describeAttentionMeta(episodes: GalEpisode[]): AttentionMeta {
  const recent = episodes.slice(-30).filter((e) => e.chosenKind);
  const n = recent.length;
  if (n < 4) {
    return { n, kindEntropy: 0, switchRate: 0, dominantShare: 0, meanDwell: 0, regime: 'insufficient' };
  }

  const counts = new Map<string, number>();
  for (const e of recent) counts.set(e.chosenKind, (counts.get(e.chosenKind) ?? 0) + 1);
  const total = recent.length;
  const kindEntropy = -[...counts.values()].reduce((h, c) => {
    const p = c / total;
    return h + p * Math.log2(p);
  }, 0) / Math.log2(Math.max(2, counts.size));
  const dominantShare = Math.max(...counts.values()) / total;

  let switches = 0;
  let runLen = 1;
  let dwellSum = 0;
  let dwellCount = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].chosenKind === recent[i - 1].chosenKind) {
      runLen++;
    } else {
      switches++;
      dwellSum += runLen;
      dwellCount++;
      runLen = 1;
    }
  }
  dwellSum += runLen;
  dwellCount++;

  const switchRate = switches / (n - 1);
  const meanDwell = dwellSum / dwellCount;
  const distinctKinds = counts.size;

  let regime: AttentionMeta['regime'];
  if (dominantShare > 0.7) regime = 'narrow';
  else if (switchRate > 0.5) regime = 'drifting';
  else if (distinctKinds >= 3 && kindEntropy > 0.8) regime = 'broad';
  else regime = 'stable';

  return {
    n,
    kindEntropy: Number(kindEntropy.toFixed(3)),
    switchRate: Number(switchRate.toFixed(3)),
    dominantShare: Number(dominantShare.toFixed(3)),
    meanDwell: Number(meanDwell.toFixed(2)),
    regime,
  };
}
