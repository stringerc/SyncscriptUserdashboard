/**
 * Episode Themes — unsupervised clustering of attention-episode
 * experience embeddings.
 *
 * What this is: a small deterministic k-means over the 32-dim hidden
 * activations the ExperienceModel produces per deliberation. It groups
 * "what kind of attention state produced what kind of outcome" into a
 * handful of recurring themes — the closest honest thing to a narrative
 * self-model summary the embeddings support.
 *
 * What this is NOT:
 * - Not semantic analysis. The embeddings are lossy codes of config→
 *   outcome statistics; clusters mean "these attention configs landed in
 *   the same region of outcome-space," nothing more.
 * - Not sentence-transformer anything — there is no text and no
 *   pretrained encoder. K-means on raw vectors, inspectable centroids.
 */

export interface ThemeEpisode {
  embedding?: number[];
  phi?: number | null;
  actualScore?: number | null;
  chosenKind?: string;
}

export interface EpisodeTheme {
  cluster: number;
  size: number;
  /** mean φ-proxy and outcome score within the cluster */
  meanPhi: number | null;
  meanActual: number | null;
  /** most common chosenKind among member episodes */
  dominantKind: string;
}

function dist2(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return s;
}

/** Deterministic k-means (fixed init = evenly spaced members, 12 iters).
 *  Returns themes sorted by cluster size desc. Needs ≥ k episodes with
 *  embeddings or it returns fewer/empty — never fabricates clusters. */
export function clusterEpisodeEmbeddings(
  episodes: ThemeEpisode[],
  k = 3,
): EpisodeTheme[] {
  const pts = episodes
    .filter((e): e is ThemeEpisode & { embedding: number[] } =>
      Array.isArray(e.embedding) && e.embedding.length >= 8)
    .map((e, i) => ({ e, i, v: e.embedding }));
  if (pts.length < k) return [];

  // Evenly-spaced init — deterministic, no RNG.
  const centroids: number[][] = [];
  for (let c = 0; c < k; c++) {
    centroids.push([...pts[Math.floor((c + 0.5) * pts.length / k)].v]);
  }

  const assign = new Array(pts.length).fill(0);
  for (let iter = 0; iter < 12; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist2(pts[i].v, centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assign[i] !== best) { assign[i] = best; moved = true; }
    }
    // recompute centroids
    const sums = centroids.map(() => new Array(pts[0].v.length).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < pts.length; i++) {
      const c = assign[i];
      counts[c]++;
      for (let j = 0; j < pts[i].v.length; j++) sums[c][j] += pts[i].v[j];
    }
    for (let c = 0; c < k; c++) {
      if (!counts[c]) continue;
      for (let j = 0; j < sums[c].length; j++) centroids[c][j] = sums[c][j] / counts[c];
    }
    if (!moved && iter > 2) break;
  }

  return centroids.map((_, c) => {
    const members = pts.filter((_, i) => assign[i] === c).map((p) => p.e);
    if (!members.length) return null;
    const mean = (xs: (number | null | undefined)[]) => {
      const v = xs.filter((x): x is number => typeof x === 'number');
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const kinds = new Map<string, number>();
    for (const m of members) {
      const knd = m.chosenKind ?? '?';
      kinds.set(knd, (kinds.get(knd) ?? 0) + 1);
    }
    const dominantKind = [...kinds.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return {
      cluster: c,
      size: members.length,
      meanPhi: mean(members.map((m) => m.phi)),
      meanActual: mean(members.map((m) => m.actualScore)),
      dominantKind,
    };
  }).filter((t): t is EpisodeTheme => t !== null)
    .sort((a, b) => b.size - a.size);
}
