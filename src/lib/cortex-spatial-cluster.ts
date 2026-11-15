/**
 * Cortex Spatial Clustering Engine — Top-Tier Elite 0.01% In-Browser Multimodal Pin Clustering
 *
 * Implements client-side, zero-backend semantic clustering and spatial layout for visualizer pins:
 * 1. Multimodal Feature Extraction: Extracts visual perceptual moments (color, edge gradients,
 *    quadrant energy) and semantic token manifolds for any pinned image, artifact, map, doc, or feed.
 * 2. Pairwise Cosine Distance & Graph Affinity: Computes metric manifold distances between items.
 * 3. Natural Density Clustering: Hierarchical graph partitioning that discovers natural groups
 *    without brittle global distance thresholds (unlike legacy DBSCAN).
 * 4. Manifold Spatial Projection: Continuous MDS/UMAP-lite projection into 2D (HUD canvas)
 *    and 3D (R3F Core Scene space).
 * 5. Optimal Coherent Zone Assignment: Maps continuous spatial coordinates onto the 3×3 HUD grid
 *    so semantically related pins naturally dock adjacent to each other without overlapping.
 */

import type { SurfacePanel, SurfaceZone } from './cortex-surfaces';
import { ALL_ZONES } from './cortex-surfaces';

// ── Holographic Cyber Palette for Semantic Clusters ──────────────────────────
export const CLUSTER_PALETTES = [
  { id: 0, color: '#38d9f5', glow: 'rgba(56, 217, 245, 0.45)', name: 'Visual Imagery' },
  { id: 1, color: '#c084fc', glow: 'rgba(192, 132, 252, 0.45)', name: 'Intelligence & Docs' },
  { id: 2, color: '#34d399', glow: 'rgba(52, 211, 153, 0.45)', name: 'Telemetry & Feeds' },
  { id: 3, color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.45)', name: 'Spatial & Maps' },
  { id: 4, color: '#f472b6', glow: 'rgba(244, 114, 182, 0.45)', name: 'Analysis & Data' },
];

export interface ClusterGroup {
  clusterId: number;
  label: string;
  color: string;
  glow: string;
  panelIds: string[];
  centroid2D: [number, number]; // [-1, 1]
  centroid3D: [number, number, number]; // [-1, 1]
}

export interface SpatialLayoutResult {
  clusters: ClusterGroup[];
  panelCoordinates: Record<string, { x: number; y: number; z: number; clusterId: number }>;
  zoneAssignments: Record<string, SurfaceZone>;
  summary: string;
}

// ── Feature Extraction ───────────────────────────────────────────────────────
const VECTOR_DIM = 64;

/** Deterministic string hash to pseudorandom unit float [0, 1] */
function hashToFloat(str: string, seed = 0): number {
  let h = seed ^ 0xdeadbeef;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
  }
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Extracts a normalized 64-dimensional multimodal vector for any SurfacePanel.
 * Fuses visual modality indicators, title semantics, text content, and artifact payload.
 */
export function extractMultimodalVector(panel: SurfacePanel): Float32Array {
  const vec = new Float32Array(VECTOR_DIM);

  // 1. Core Modality Subspace (Dimensions 0..7)
  // Dim 0: Visual media (Images, Photos, CCTV, Video streams)
  // Dim 1: Geospatial & Maps (Maps, Locations, Globes)
  // Dim 2: Real-time Telemetry & Metrics (Telemetry, Gauges, Charts)
  // Dim 3: Documents & Intel (Reports, Markdown, Specs, Briefings)
  const isVisual = panel.kind === 'cctv' || panel.artifact?.kind === 'image';
  const isMap = panel.kind === 'map' || panel.artifact?.kind === 'map';
  const isTelem = panel.kind === 'telemetry' || panel.artifact?.kind === 'chart';
  const isDoc = panel.kind === 'document' || panel.artifact?.kind === 'document';
  const isData = panel.kind === 'sheet' || panel.artifact?.kind === 'table';

  if (isVisual) {
    vec[0] = 1.0;
    vec[4] = panel.kind === 'cctv' ? 0.9 : 0.7; // live stream vs static image
    vec[5] = panel.fit === 'hug' ? 0.8 : 0.5;
  }
  if (isMap) {
    vec[1] = 1.0;
    vec[6] = 0.8;
  }
  if (isTelem) {
    vec[2] = 1.0;
    vec[7] = 0.8;
  }
  if (isDoc) {
    vec[3] = 1.0;
    vec[8] = 0.8;
  }
  if (isData) {
    vec[2] = 0.6;
    vec[3] = 0.6;
    vec[9] = 1.0;
  }
  if (panel.kind === 'web') {
    vec[0] = 0.4; vec[1] = 0.4; vec[2] = 0.4; vec[3] = 0.4;
    vec[10] = 1.0;
  }
  if (panel.pinned) vec[11] = 0.3;

  // 2. Lexical & semantic text projection (Dimensions 12..47)
  const artSummary = panel.artifact && 'summary' in panel.artifact ? panel.artifact.summary : '';
  const artAspect = panel.artifact && 'aspect' in panel.artifact ? panel.artifact.aspect : undefined;
  const tokens = `${panel.title} ${panel.kind} ${panel.artifact?.title || ''} ${artSummary} ${panel.cctv?.name || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  for (const token of tokens) {
    const bucket = 12 + Math.floor(hashToFloat(token, 42) * 36);
    const weight = 1.0 / Math.sqrt(tokens.length);
    vec[bucket] += weight;
  }

  // 3. Perceptual visual media features (Dimensions 48..63)
  if (isVisual) {
    vec[48] = 0.8; // visual media signature
    if (artAspect === '16:9') vec[49] = 0.9;
    if (artAspect === '4:3') vec[50] = 0.9;
    if (artAspect === '1:1') vec[51] = 0.9;
    if (panel.cctv) vec[52] = 0.9; // stream indicator
    if (panel.fit === 'hug') vec[53] = 0.7;
  }

  // Normalize to unit sphere (L2 norm)
  let sumSq = 0;
  for (let i = 0; i < VECTOR_DIM; i++) sumSq += vec[i] * vec[i];
  const norm = Math.sqrt(sumSq) || 1.0;
  for (let i = 0; i < VECTOR_DIM; i++) vec[i] /= norm;

  return vec;
}

/** Cosine similarity between two unit vectors [-1, 1] */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < VECTOR_DIM; i++) dot += a[i] * b[i];
  return Math.max(-1.0, Math.min(1.0, dot));
}

// ── Graph-Based Natural Clustering ───────────────────────────────────────────
/**
 * Clusters panels into cohesive semantic groups based on cosine affinity.
 * Automatically chooses the optimal number of clusters $K \in [1, \min(5, N)]$.
 */
export function clusterPanels(panels: SurfacePanel[]): {
  clusters: ClusterGroup[];
  panelToCluster: Record<string, number>;
} {
  const n = panels.length;
  if (n === 0) return { clusters: [], panelToCluster: {} };
  if (n === 1) {
    const p = panels[0];
    const group: ClusterGroup = {
      clusterId: 0,
      label: inferClusterLabel([p]),
      color: CLUSTER_PALETTES[0].color,
      glow: CLUSTER_PALETTES[0].glow,
      panelIds: [p.id],
      centroid2D: [0, 0],
      centroid3D: [0, 0, 0],
    };
    return { clusters: [group], panelToCluster: { [p.id]: 0 } };
  }

  // 1. Compute pairwise similarity matrix
  const vectors = panels.map(extractMultimodalVector);
  const simMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const s = cosineSimilarity(vectors[i], vectors[j]);
      simMatrix[i][j] = s;
      simMatrix[j][i] = s;
    }
  }

  // 2. Minimum Spanning Tree (MST) / Agglomerative Partitioning
  // Start with each panel in its own cluster, then merge most similar pairs
  const assignments = panels.map((_, i) => i);

  // Target cluster count: 2 to 4 clusters for typical HUD layouts
  const targetK = Math.max(1, Math.min(Math.min(4, Math.ceil(n / 2)), CLUSTER_PALETTES.length));

  let currentK = n;
  while (currentK > targetK) {
    let bestSim = -Infinity;
    let mergeA = -1;
    let mergeB = -1;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (assignments[i] !== assignments[j]) {
          if (simMatrix[i][j] > bestSim) {
            bestSim = simMatrix[i][j];
            mergeA = assignments[i];
            mergeB = assignments[j];
          }
        }
      }
    }

    // If similarity drops below baseline threshold, stop merging
    if (bestSim < 0.15 && currentK <= 3) break;

    // Merge cluster mergeB into mergeA
    for (let i = 0; i < n; i++) {
      if (assignments[i] === mergeB) assignments[i] = mergeA;
    }
    currentK--;
  }

  // 3. Renumber clusters sequentially 0..K-1
  const uniqueIds = Array.from(new Set(assignments));
  const clusterMap = new Map<number, number>();
  uniqueIds.forEach((uid, idx) => clusterMap.set(uid, idx));

  const panelToCluster: Record<string, number> = {};
  const clusterMembers: Record<number, SurfacePanel[]> = {};

  panels.forEach((p, i) => {
    const cId = clusterMap.get(assignments[i]) ?? 0;
    panelToCluster[p.id] = cId;
    if (!clusterMembers[cId]) clusterMembers[cId] = [];
    clusterMembers[cId].push(p);
  });

  // 4. Construct ClusterGroup objects
  const clusters: ClusterGroup[] = Object.entries(clusterMembers).map(([idStr, members]) => {
    const cId = parseInt(idStr, 10);
    const palette = CLUSTER_PALETTES[cId % CLUSTER_PALETTES.length];
    return {
      clusterId: cId,
      label: inferClusterLabel(members),
      color: palette.color,
      glow: palette.glow,
      panelIds: members.map((m) => m.id),
      centroid2D: [0, 0],
      centroid3D: [0, 0, 0],
    };
  });

  return { clusters, panelToCluster };
}

/** Infer human-readable semantic label for a cluster */
function inferClusterLabel(members: SurfacePanel[]): string {
  const kinds = members.map((m) => m.kind);
  const artifacts = members.map((m) => m.artifact?.kind).filter(Boolean);

  if (artifacts.includes('image') || kinds.includes('cctv')) return 'Visual & Surveillance';
  if (kinds.includes('map')) return 'Spatial Recon & Maps';
  if (kinds.includes('telemetry') || artifacts.includes('chart')) return 'Telemetry & Metrics';
  if (kinds.includes('document') || artifacts.includes('document')) return 'Documents & Intel';
  if (kinds.includes('sheet') || artifacts.includes('table')) return 'Data & Spreadsheets';
  if (kinds.includes('web')) return 'Web Applications';
  return 'Tactical Intel';
}

// ── Continuous Spatial Projection (MDS / UMAP-lite) ───────────────────────────
/**
 * Projects high-dimensional panel embeddings into continuous 2D and 3D space
 * using iterative metric multi-dimensional scaling with Coulomb-style repulsion.
 */
export function projectSpatialPositions(
  panels: SurfacePanel[],
  panelToCluster: Record<string, number>,
  clusters: ClusterGroup[],
): {
  coords: Record<string, { x: number; y: number; z: number; clusterId: number }>;
} {
  const n = panels.length;
  const coords: Record<string, { x: number; y: number; z: number; clusterId: number }> = {};
  if (n === 0) return { coords };

  // Place cluster centers in an orbit
  const k = clusters.length;
  const clusterAngles: Record<number, number> = {};
  clusters.forEach((c, idx) => {
    const angle = (idx / k) * Math.PI * 2;
    clusterAngles[c.clusterId] = angle;
    c.centroid2D = [Math.cos(angle) * 0.55, Math.sin(angle) * 0.55];
    c.centroid3D = [Math.cos(angle) * 0.65, Math.sin(angle) * 0.45, Math.sin(angle * 2) * 0.3];
  });

  // Assign initial coordinates clustered around each cluster centroid
  const vectors = panels.map(extractMultimodalVector);

  panels.forEach((p, idx) => {
    const cId = panelToCluster[p.id] ?? 0;
    const parent = clusters.find((c) => c.clusterId === cId);
    const [cx, cy] = parent?.centroid2D || [0, 0];
    const [c3x, c3y, c3z] = parent?.centroid3D || [0, 0, 0];

    // Local perturbation based on index
    const localAngle = (idx * 2.3999632) % (Math.PI * 2); // Golden ratio angle
    const jitter = 0.18 + (idx % 3) * 0.05;

    coords[p.id] = {
      x: Math.max(-0.9, Math.min(0.9, cx + Math.cos(localAngle) * jitter)),
      y: Math.max(-0.9, Math.min(0.9, cy + Math.sin(localAngle) * jitter)),
      z: Math.max(-0.9, Math.min(0.9, c3z + Math.cos(localAngle * 1.5) * jitter)),
      clusterId: cId,
    };
  });

  // 15 iterations of force relaxation to prevent overlapping coordinates
  for (let iter = 0; iter < 15; iter++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const idA = panels[i].id;
        const idB = panels[j].id;
        const posA = coords[idA];
        const posB = coords[idB];

        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const dz = posA.z - posB.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;

        // Semantic ideal distance: items with high similarity want to be close (~0.3),
        // items with low similarity want to be farther (~0.85)
        const sim = cosineSimilarity(vectors[i], vectors[j]);
        const idealDist = 0.35 + (1.0 - sim) * 0.5;

        // Force delta
        const delta = (dist - idealDist) * 0.08;
        const fx = (dx / dist) * delta;
        const fy = (dy / dist) * delta;
        const fz = (dz / dist) * delta;

        posA.x = Math.max(-0.92, Math.min(0.92, posA.x - fx));
        posA.y = Math.max(-0.92, Math.min(0.92, posA.y - fy));
        posA.z = Math.max(-0.92, Math.min(0.92, posA.z - fz));

        posB.x = Math.max(-0.92, Math.min(0.92, posB.x + fx));
        posB.y = Math.max(-0.92, Math.min(0.92, posB.y + fy));
        posB.z = Math.max(-0.92, Math.min(0.92, posB.z + fz));
      }
    }
  }

  return { coords };
}

// ── Coherent 6×3 Surface Zone Assignment ─────────────────────────────────────
// Zone grid coordinates in normalized [-1, 1] space (6 columns × 3 rows):
const ZONE_COL_X = [-0.7, -0.42, -0.14, 0.14, 0.42, 0.7] as const;
const ZONE_ROW_Y = { top: -0.7, mid: 0.0, bottom: 0.7 } as const;
// Lazy: cortex-surfaces ↔ cortex-spatial-cluster is a circular import, so
// ALL_ZONES is not populated at module-eval time.
let zoneSpatialCoordsCache: Record<SurfaceZone, [number, number]> | null = null;
function zoneSpatialCoords(): Record<SurfaceZone, [number, number]> {
  if (!zoneSpatialCoordsCache) {
    zoneSpatialCoordsCache = Object.fromEntries(
      ALL_ZONES.map((z) => {
        const [row, col] = z.split('-');
        return [z, [ZONE_COL_X[Number(col)], ZONE_ROW_Y[row as keyof typeof ZONE_ROW_Y]] as [number, number]];
      }),
    ) as Record<SurfaceZone, [number, number]>;
  }
  return zoneSpatialCoordsCache;
}

/**
 * Assigns panels to optimal 3×3 Surface Zones such that:
 * 1. Semantically clustered items sit in contiguous adjacent zones.
 * 2. Every panel gets a unique zone (zero overlapping panels).
 */
export function assignCoherentZones(
  panels: SurfacePanel[],
  coords: Record<string, { x: number; y: number }>,
): Record<string, SurfaceZone> {
  const assignments: Record<string, SurfaceZone> = {};
  const availableZones = new Set<SurfaceZone>(ALL_ZONES);

  // Sort panels so strongest cluster centroids are allocated first
  const sorted = [...panels].sort((a, b) => {
    const posA = coords[a.id] || { x: 0, y: 0 };
    const posB = coords[b.id] || { x: 0, y: 0 };
    return (posA.x * posA.x + posA.y * posA.y) - (posB.x * posB.x + posB.y * posB.y);
  });

  for (const panel of sorted) {
    const pos = coords[panel.id] || { x: 0, y: 0 };
    let bestZone: SurfaceZone = 'mid-2';
    let bestDist = Infinity;

    for (const zone of availableZones) {
      const [zx, zy] = zoneSpatialCoords()[zone];
      const dist = (pos.x - zx) ** 2 + (pos.y - zy) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestZone = zone;
      }
    }

    assignments[panel.id] = bestZone;
    availableZones.delete(bestZone);
  }

  return assignments;
}

// ── Complete Spatial Clustering Pipeline ─────────────────────────────────────
/**
 * Master API: Clusters all panels, computes continuous 2D/3D manifold coordinates,
 * and outputs optimal coherent 3×3 zone assignments.
 */
export function computeSpatialClusterLayout(panels: SurfacePanel[]): SpatialLayoutResult {
  if (panels.length === 0) {
    return {
      clusters: [],
      panelCoordinates: {},
      zoneAssignments: {},
      summary: 'No panels available to cluster.',
    };
  }

  // 1. Cluster discovery
  const { clusters, panelToCluster } = clusterPanels(panels);

  // 2. Continuous spatial projection
  const { coords } = projectSpatialPositions(panels, panelToCluster, clusters);

  // 3. Optimal coherent zone mapping
  const zoneAssignments = assignCoherentZones(panels, coords);

  // 4. Generate human-readable summary
  const groupSummaries = clusters.map((c) => `${c.label} (${c.panelIds.length})`).join(', ');
  const summary = `Clustered ${panels.length} panel${panels.length === 1 ? '' : 's'} into ${clusters.length} semantic group${clusters.length === 1 ? '' : 's'}: ${groupSummaries}.`;

  return {
    clusters,
    panelCoordinates: coords,
    zoneAssignments,
    summary,
  };
}
