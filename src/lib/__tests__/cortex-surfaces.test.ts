import { describe, it, expect, beforeEach } from 'vitest';
import {
  openSurfacePanel, closeSurfacePanel, clearSurfacePanels,
  movePanelToZone, arrangeSurfacePanels, resolvePanelRef,
  zoneFromPhrase, zoneLabel, describePanelLocation, getSurfaceSnapshot,
  hydrateSurfacePanelsForTest,
  ALL_ZONES,
} from '../cortex-surfaces';
import type { CortexArtifact } from '../cortex-artifacts';

const statArt = (title: string): CortexArtifact =>
  ({ kind: 'stat', title, value: '42', source: 'test' }) as CortexArtifact;
const imgArt = (title: string): CortexArtifact =>
  ({ kind: 'image', title, url: 'https://x.test/i.png', source: 'test' }) as CortexArtifact;

beforeEach(() => clearSurfacePanels());

describe('zone assignment', () => {
  it('assigns distinct zones to consecutive panels', () => {
    const zones = [0, 1, 2, 3].map((i) =>
      openSurfacePanel({ kind: 'artifact', title: `p${i}`, artifact: statArt(`p${i}`) })!.zone);
    expect(new Set(zones).size).toBe(4);
  });

  it('honors preferredZone when free', () => {
    const p = openSurfacePanel({ kind: 'cctv', title: 'cam', preferredZone: 'bottom-5' })!;
    expect(p.zone).toBe('bottom-5');
  });

  it('falls back when preferredZone is occupied', () => {
    openSurfacePanel({ kind: 'cctv', title: 'a', preferredZone: 'mid-0' });
    const p2 = openSurfacePanel({ kind: 'cctv', title: 'b', preferredZone: 'mid-0' })!;
    expect(p2.zone).not.toBe('mid-0');
  });
});

describe('movePanelToZone', () => {
  it('moves a panel to a free zone', () => {
    const p = openSurfacePanel({ kind: 'artifact', title: 'chart', artifact: statArt('chart') })!;
    movePanelToZone(p.id, 'top-5');
    expect(getSurfaceSnapshot().panels.find((x) => x.id === p.id)!.zone).toBe('top-5');
  });

  it('swaps occupants instead of stacking', () => {
    const a = openSurfacePanel({ kind: 'artifact', title: 'a', artifact: statArt('a'), preferredZone: 'mid-0' })!;
    const b = openSurfacePanel({ kind: 'artifact', title: 'b', artifact: statArt('b'), preferredZone: 'mid-5' })!;
    movePanelToZone(a.id, 'mid-5');
    const panels = getSurfaceSnapshot().panels;
    expect(panels.find((x) => x.id === a.id)!.zone).toBe('mid-5');
    expect(panels.find((x) => x.id === b.id)!.zone).toBe('mid-0');
    expect(new Set(panels.map((x) => x.zone)).size).toBe(2);
  });
});

describe('arrangeSurfacePanels', () => {
  it('redistributes panels in reading order', () => {
    openSurfacePanel({ kind: 'artifact', title: 'one', artifact: statArt('one') });
    openSurfacePanel({ kind: 'artifact', title: 'two', artifact: statArt('two') });
    openSurfacePanel({ kind: 'artifact', title: 'three', artifact: statArt('three') });
    arrangeSurfacePanels();
    const zones = getSurfaceSnapshot().panels.map((p) => p.zone);
    expect(zones).toEqual(['top-0', 'top-1', 'top-2']);
  });
});

describe('resolvePanelRef', () => {
  it('"that"/"it" resolves to the most recently active panel', () => {
    openSurfacePanel({ kind: 'artifact', title: 'first', artifact: statArt('first') });
    const b = openSurfacePanel({ kind: 'artifact', title: 'second', artifact: statArt('second') })!;
    expect(resolvePanelRef('that')!.id).toBe(b.id);
    expect(resolvePanelRef('it')!.id).toBe(b.id);
  });

  it('resolves kind words to matching panels', () => {
    openSurfacePanel({ kind: 'artifact', title: 'my pic', artifact: imgArt('my pic') });
    openSurfacePanel({ kind: 'artifact', title: 'sales', artifact: statArt('sales') });
    expect(resolvePanelRef('the picture')!.title).toBe('my pic');
    expect(resolvePanelRef('the stat')!.title).toBe('sales');
  });

  it('resolves by title substring', () => {
    openSurfacePanel({ kind: 'document', title: 'Quarterly Report' });
    expect(resolvePanelRef('quarterly')!.title).toBe('Quarterly Report');
  });

  it('returns null for unknown refs', () => {
    openSurfacePanel({ kind: 'artifact', title: 'x', artifact: statArt('x') });
    expect(resolvePanelRef('banana')).toBeNull();
  });
});

describe('zoneFromPhrase', () => {
  it.each([
    ['top left', 'top-0'], ['upper right', 'top-4'],
    ['middle right', 'mid-4'], ['center', 'mid-2'],
    ['bottom left', 'bottom-0'], ['lower right', 'bottom-4'],
    ['left', 'mid-0'], ['right', 'mid-4'],
    ['top', 'top-2'], ['bottom', 'bottom-2'],
    ['far left', 'mid-0'], ['outer right', 'mid-5'],
  ])('maps "%s" → %s', (phrase, zone) => {
    expect(zoneFromPhrase(phrase)).toBe(zone);
  });

  it('returns null for non-positions', () => {
    expect(zoneFromPhrase('noon')).toBeNull();
    expect(zoneFromPhrase('3pm')).toBeNull();
  });
});

describe('labels', () => {
  it('speaks zones naturally', () => {
    expect(zoneLabel('mid-5')).toBe('middle far right');
    expect(zoneLabel('top-0')).toBe('top far left');
    expect(zoneLabel('mid-2')).toBe('middle center left');
  });
  it('describes panel location', () => {
    const p = openSurfacePanel({ kind: 'artifact', title: 'c', artifact: statArt('c'), preferredZone: 'mid-4' })!;
    expect(describePanelLocation(p)).toBe('docked middle right');
  });
  it('ALL_ZONES has 18 unique zones', () => {
    expect(ALL_ZONES.length).toBe(18);
    expect(new Set(ALL_ZONES).size).toBe(18);
  });
});

describe('persistence hardening', () => {
  const KEY = 'cortex-surface-panels-v1';
  const mem = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
  it('drops panels with missing/duplicate ids and invalid kinds', async () => {
    const { hydrateSurfacePanelsForTest } = await import('../cortex-surfaces');
    localStorage.setItem(KEY, JSON.stringify({ panels: [
      { id: 'a', kind: 'artifact', title: 'ok', zone: 'top-left', createdAt: 1 },
      { id: 'a', kind: 'artifact', title: 'dup', zone: 'top-right', createdAt: 2 },
      { id: 'b', kind: 'bogus', title: 'bad kind', zone: 'mid-left', createdAt: 3 },
      { kind: 'artifact', title: 'no id', zone: 'mid-right', createdAt: 4 },
    ]}));
    hydrateSurfacePanelsForTest();
    const panels = getSurfaceSnapshot().panels;
    expect(panels.length).toBe(1);
    expect(panels[0].id).toBe('a');
    localStorage.removeItem(KEY);
  });

  it('survives corrupt JSON', async () => {
    const { hydrateSurfacePanelsForTest } = await import('../cortex-surfaces');
    localStorage.setItem(KEY, '{not json');
    hydrateSurfacePanelsForTest();
    expect(getSurfaceSnapshot().panels.length).toBe(0);
    localStorage.removeItem(KEY);
  });

  it('preserves web and sheet payloads across hydration', async () => {
    const { hydrateSurfacePanelsForTest } = await import('../cortex-surfaces');
    localStorage.setItem(KEY, JSON.stringify({
      panels: [
        {
          id: 'p-web-1',
          kind: 'web',
          title: 'Web — tasks-dashboard',
          zone: 'top-left',
          pinned: true,
          web: { url: '/sandbox/tasks-dashboard/index.html', slug: 'tasks-dashboard' },
          createdAt: 10,
        },
        {
          id: 'p-sheet-1',
          kind: 'sheet',
          title: 'Financial Model',
          zone: 'top-right',
          pinned: true,
          sheet: {
            title: 'Financial Model',
            columns: ['Metric', 'Target'],
            rows: [['MRR', '$42,500']],
          },
          createdAt: 20,
        },
      ],
    }));
    hydrateSurfacePanelsForTest();
    const panels = getSurfaceSnapshot().panels;
    expect(panels.length).toBe(2);
    const webPanel = panels.find((p) => p.kind === 'web');
    const sheetPanel = panels.find((p) => p.kind === 'sheet');
    expect(webPanel?.web?.url).toBe('/sandbox/tasks-dashboard/index.html');
    expect(sheetPanel?.sheet?.rows[0][1]).toBe('$42,500');
    localStorage.removeItem(KEY);
  });

  it('auto-migrates legacy sample website placeholder document to web panel', () => {
    localStorage.setItem(KEY, JSON.stringify({
      panels: [
        {
          id: 'panel-legacy-sample-site',
          kind: 'document',
          title: 'Sample Website',
          zone: 'center',
          pinned: true,
          artifact: {
            id: 'art-legacy-html',
            kind: 'document',
            title: 'Sample Website',
            format: 'markdown',
            content: '<html>...</html>',
          },
          createdAt: 10,
        },
      ],
    }));
    hydrateSurfacePanelsForTest();
    const panels = getSurfaceSnapshot().panels;
    const sampleSitePanel = panels.find((p) => p.title.includes('Sample Website'));
    expect(sampleSitePanel).toBeDefined();
    expect(sampleSitePanel?.kind).toBe('web');
    expect(sampleSitePanel?.web?.url).toBe('/sandbox/sample-website/index.html');
    expect(sampleSitePanel?.web?.slug).toBe('sample-website');
    expect(sampleSitePanel?.artifact).toBeUndefined();
    localStorage.removeItem(KEY);
  });
});

describe('web and sheet panels', () => {
  it('openSurfacePanel preserves web payload and resolves ref', () => {
    const p = openSurfacePanel({
      kind: 'web',
      title: 'Web — nexusflow',
      web: { url: '/sandbox/nexusflow/index.html', slug: 'nexusflow' },
      pinned: true,
    })!;
    expect(p).toBeDefined();
    expect(p.web?.url).toBe('/sandbox/nexusflow/index.html');
    expect(resolvePanelRef('the web app')?.id).toBe(p.id);
  });

  it('openSurfacePanel preserves sheet payload and resolves ref', () => {
    const p = openSurfacePanel({
      kind: 'sheet',
      title: 'Q1 Forecast',
      sheet: {
        title: 'Q1 Forecast',
        columns: ['Month', 'Rev'],
        rows: [['Jan', '100k']],
      },
      pinned: true,
    })!;
    expect(p).toBeDefined();
    expect(p.sheet?.columns).toEqual(['Month', 'Rev']);
    expect(resolvePanelRef('the spreadsheet')?.id).toBe(p.id);
  });
});
