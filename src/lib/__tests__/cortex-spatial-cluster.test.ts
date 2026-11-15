import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractMultimodalVector,
  cosineSimilarity,
  clusterPanels,
  projectSpatialPositions,
  assignCoherentZones,
  computeSpatialClusterLayout,
  CLUSTER_PALETTES,
} from '../cortex-spatial-cluster';
import {
  openSurfacePanel,
  clearSurfacePanels,
  getSurfaceSnapshot,
  clusterSurfacePanels,
  type SurfacePanel,
} from '../cortex-surfaces';
import { runSurfaceCommand } from '../cortex-surface-commands';

describe('cortex-spatial-cluster', () => {
  beforeEach(() => {
    clearSurfacePanels();
  });

  const mockImagePanel: SurfacePanel = {
    id: 'p-img-1',
    kind: 'artifact',
    title: 'Satellite Recon Bravo',
    zone: 'top-0',
    pinned: true,
    artifact: {
      id: 'art-1',
      kind: 'image',
      title: 'Satellite Recon Bravo',
      url: 'https://cdn.cortex.internal/recon_bravo.jpg',
    } as any,
    fit: 'hug',
    createdAt: 1000,
  };

  const mockCctvPanel: SurfacePanel = {
    id: 'p-cctv-1',
    kind: 'cctv',
    title: 'Perimeter Camera 04',
    zone: 'top-5',
    pinned: false,
    cctv: { name: 'Perimeter Camera 04', url: 'https://cctv.local/cam4.m3u8' },
    createdAt: 2000,
  };

  const mockTelemetryPanel: SurfacePanel = {
    id: 'p-telem-1',
    kind: 'telemetry',
    title: 'Core Fusion Telemetry',
    zone: 'bottom-0',
    pinned: false,
    createdAt: 3000,
  };

  const mockDocPanel: SurfacePanel = {
    id: 'p-doc-1',
    kind: 'document',
    title: 'Directive 447 Protocol',
    zone: 'bottom-5',
    pinned: true,
    artifact: {
      id: 'art-2',
      kind: 'document',
      title: 'Directive 447 Protocol',
      content: 'Classified operational briefing for planetary defense.',
    } as any,
    createdAt: 4000,
  };

  describe('Feature Extraction & Similarity', () => {
    it('produces normalized unit vectors of dimension 64', () => {
      const vec = extractMultimodalVector(mockImagePanel);
      expect(vec.length).toBe(64);

      let sumSq = 0;
      for (let i = 0; i < vec.length; i++) sumSq += vec[i] * vec[i];
      expect(Math.sqrt(sumSq)).toBeCloseTo(1.0, 4);
    });

    it('computes expected cosine similarities', () => {
      const v1 = extractMultimodalVector(mockImagePanel);
      const v2 = extractMultimodalVector(mockCctvPanel); // both visual
      const v3 = extractMultimodalVector(mockDocPanel);   // text doc

      const simVisual = cosineSimilarity(v1, v2);
      const simCross = cosineSimilarity(v1, v3);

      expect(simVisual).toBeGreaterThan(simCross);
    });
  });

  describe('Graph Clustering & Spatial Projection', () => {
    it('clusters panels into cohesive semantic groups', () => {
      const panels = [mockImagePanel, mockCctvPanel, mockTelemetryPanel, mockDocPanel];
      const { clusters, panelToCluster } = clusterPanels(panels);

      expect(clusters.length).toBeGreaterThanOrEqual(2);
      expect(panelToCluster[mockImagePanel.id]).toBeDefined();
      expect(panelToCluster[mockTelemetryPanel.id]).toBeDefined();

      // Check visual panels group together
      expect(panelToCluster[mockImagePanel.id]).toBe(panelToCluster[mockCctvPanel.id]);
    });

    it('projects panels into continuous 2D/3D space without collision', () => {
      const panels = [mockImagePanel, mockCctvPanel, mockTelemetryPanel, mockDocPanel];
      const { clusters, panelToCluster } = clusterPanels(panels);
      const { coords } = projectSpatialPositions(panels, panelToCluster, clusters);

      for (const p of panels) {
        const c = coords[p.id];
        expect(c).toBeDefined();
        expect(c.x).toBeGreaterThanOrEqual(-1.0);
        expect(c.x).toBeLessThanOrEqual(1.0);
        expect(c.y).toBeGreaterThanOrEqual(-1.0);
        expect(c.y).toBeLessThanOrEqual(1.0);
        expect(c.z).toBeGreaterThanOrEqual(-1.0);
        expect(c.z).toBeLessThanOrEqual(1.0);
      }
    });

    it('assigns unique, non-overlapping zones for all panels', () => {
      const panels = [mockImagePanel, mockCctvPanel, mockTelemetryPanel, mockDocPanel];
      const { clusters, panelToCluster } = clusterPanels(panels);
      const { coords } = projectSpatialPositions(panels, panelToCluster, clusters);
      const zoneAssignments = assignCoherentZones(panels, coords);

      const assignedZones = Object.values(zoneAssignments);
      const uniqueZones = new Set(assignedZones);
      expect(uniqueZones.size).toBe(panels.length);
    });
  });

  describe('Full Pipeline & Surface Store Integration', () => {
    it('executes computeSpatialClusterLayout and outputs summary', () => {
      const panels = [mockImagePanel, mockCctvPanel, mockTelemetryPanel];
      const layout = computeSpatialClusterLayout(panels);

      expect(layout.clusters.length).toBeGreaterThan(0);
      expect(layout.summary).toContain('Clustered 3 panels');
      expect(Object.keys(layout.zoneAssignments).length).toBe(3);
    });

    it('clusters active panels via clusterSurfacePanels() in store', () => {
      openSurfacePanel({
        kind: 'artifact',
        title: 'Tactical Recon Photo',
        artifact: { id: 'a1', kind: 'image', title: 'Tactical Recon Photo' } as any,
      });
      openSurfacePanel({
        kind: 'cctv',
        title: 'Hangar Feed',
        cctv: { name: 'Hangar Feed', url: 'https://cctv.local/h1' },
      });
      openSurfacePanel({
        kind: 'telemetry',
        title: 'Reactor Shield Telemetry',
      });

      const res = clusterSurfacePanels();
      expect(res.count).toBe(3);
      expect(res.clusterCount).toBeGreaterThanOrEqual(2);

      const snap = getSurfaceSnapshot();
      for (const p of snap.panels) {
        expect(p.clusterId).toBeDefined();
        expect(p.clusterColor).toBeDefined();
        expect(p.clusterLabel).toBeDefined();
        expect(p.spatialCoord).toBeDefined();
      }
    });

    it('responds to voice cluster commands', async () => {
      openSurfacePanel({ kind: 'telemetry', title: 'Telemetry Alpha' });
      openSurfacePanel({ kind: 'cctv', title: 'Cam Beta', cctv: { url: 'https://cam' } });

      const reply1 = await runSurfaceCommand('cluster panels');
      expect(reply1).toContain('Clustered 2 panels');

      const reply2 = await runSurfaceCommand('cluster pins');
      expect(reply2).toContain('Clustered 2 panels');

      const reply3 = await runSurfaceCommand('group similar items');
      expect(reply3).toContain('Clustered 2 panels');
    });
  });
});

