/**
 * Cortex Surface Layer — dockable panel store for the visualizer workspace.
 * Module-level store (same pattern as cortex-chat-store) so panels survive
 * SPA navigation and are drivable from voice, transcript cards, and tools.
 *
 * Layout: a 3×3 zone grid inside HUD safe-area insets. Panels own exactly one
 * zone — occupancy is enforced, moves swap, and the grid is computed by
 * CortexSurfaceLayer from the live viewport (rail/drawer aware). Cortex always
 * knows where every panel is, so it can never stack them.
 */
import { useSyncExternalStore } from 'react';
import type { CortexArtifact } from './cortex-artifacts';
import { MAX_VISIBLE_PANELS } from './cortex-artifacts';
import { computeSpatialClusterLayout } from './cortex-spatial-cluster';
import { cortexObsidianMemory } from './cortex-obsidian-memory';

/** 6 columns × 3 rows = 18 dockable slots. Legacy 3×3 names migrate on hydrate. */
export type SurfaceZone = `${'top' | 'mid' | 'bottom'}-${0 | 1 | 2 | 3 | 4 | 5}`;

/** Legacy 3×3 zone ids → nearest slot in the 6×3 grid. */
export const LEGACY_ZONE_MAP: Record<string, SurfaceZone> = {
  'top-left': 'top-0', 'top-center': 'top-2', 'top-right': 'top-5',
  'mid-left': 'mid-0', 'center': 'mid-2', 'mid-right': 'mid-5',
  'bottom-left': 'bottom-0', 'bottom-center': 'bottom-2', 'bottom-right': 'bottom-5',
};

export function normalizeZone(z: string): SurfaceZone | null {
  if ((LEGACY_ZONE_MAP as Record<string, SurfaceZone>)[z]) return LEGACY_ZONE_MAP[z];
  const m = z.match(/^(top|mid|bottom)-([0-5])$/);
  return m ? (`${m[1]}-${m[2]}` as SurfaceZone) : null;
}

export type SurfacePanelKind = 'artifact' | 'map' | 'cctv' | 'telemetry' | 'document' | 'web' | 'sheet' | 'inbox' | 'email' | 'initiative';

export interface SurfacePanel {
  id: string;
  kind: SurfacePanelKind;
  title: string;
  zone: SurfaceZone;
  pinned: boolean;
  /** Artifact payload for kind 'artifact'/'document'/'map'. */
  artifact?: CortexArtifact;
  /** Web sandbox payload for kind 'web'. */
  web?: { url: string; slug?: string };
  /** Spreadsheet payload for kind 'sheet'. */
  sheet?: { title: string; columns: string[]; rows: (string | number)[][] };
  /** Email inbox payload for kind 'inbox'. */
  inbox?: {
    account: string;
    unreadCount: number;
    categories: { name: string; count: number }[];
    threads: { id: string; from: string; subject: string; snippet: string; date: string; unread?: boolean; tag?: string }[];
  };
  /** Email message payload for kind 'email'. */
  email?: {
    id: string;
    from: string;
    to?: string;
    subject: string;
    date: string;
    body: string;
    snippet?: string;
    unread?: boolean;
    tag?: string;
    attachments?: Array<{
      id: string;
      name: string;
      size: string;
      type: string;
      docType?: 'pdf' | 'doc' | 'court' | 'finance' | 'certificate';
      content?: string;
    }>;
  };
  /** Document attachment payload for kind 'document'. */
  document?: {
    id: string;
    title: string;
    fileName: string;
    fileSize: string;
    fileType: string;
    issuer?: string;
    date?: string;
    content: string;
    badge?: string;
  };
  /** 'hug' panels size to content (images); 'fill' panels take the whole zone. */
  fit?: 'fill' | 'hug';
  /** CCTV payload: camera name/url/coords when known. */
  cctv?: { name?: string; url?: string; lat?: number; lon?: number };
  /** Semantic cluster identification and holographic color styling */
  clusterId?: number;
  clusterLabel?: string;
  clusterColor?: string;
  clusterGlow?: string;
  /** Continuous spatial coordinates [-1, 1] from UMAP/MDS manifold projection */
  spatialCoord?: { x: number; y: number; z: number };
  /** Custom interactive resize dimensions (pixels) */
  customSize?: { w: number; h: number };
  /**
   * Free-canvas position: normalized 0-1 coords of the panel's top-left
   * within the workspace area. Set by any pointer drag drop (default);
   * while present the panel renders at this position instead of its zone
   * rect and does NOT occupy the zone (another panel can dock there).
   * movePanelToZone/arrange/cluster clear it — voice "move it left"
   * always re-docks.
   */
  free?: { x: number; y: number };
  createdAt: number;
}

interface SurfaceState {
  panels: SurfacePanel[];
  focusMode: boolean;
}

let state: SurfaceState = { panels: [], focusMode: false };
const listeners = new Set<() => void>();

// ── Persistence ──────────────────────────────────────────────────────
// Panels + zones survive reloads. Snapshot on every mutation; hydrate once
// at module load. Quota/parse failures degrade silently to empty state.
const STORAGE_KEY = 'cortex-surface-panels-v1';
const MAX_PERSIST_BYTES = 400_000;

function persist() {
  try {
    const raw = JSON.stringify({ panels: state.panels, focusMode: state.focusMode });
    if (raw.length <= MAX_PERSIST_BYTES) {
      localStorage.setItem(STORAGE_KEY, raw);
    } else {
      // Over-cap: never leave a stale snapshot that would resurrect closed panels.
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Quota/unavailable — drop the snapshot rather than keep stale state.
    try { localStorage.removeItem(STORAGE_KEY); } catch { }
  }
}

const VALID_KINDS = new Set<SurfacePanelKind>(['artifact', 'map', 'cctv', 'telemetry', 'document', 'web', 'sheet', 'inbox', 'email', 'initiative']);

function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.panels)) return;
    const panels: SurfacePanel[] = [];
    const seenIds = new Set<string>();
    let migrated = false;
    for (let p of data.panels) {
      if (!p || typeof p !== 'object') continue;
      if (typeof p.id !== 'string' || !p.id || seenIds.has(p.id)) continue;
      if (typeof p.title !== 'string' || typeof p.zone !== 'string') continue;

      // Auto-migrate legacy or placeholder sample website panels to live sandbox web panel
      const titleLower = String(p.title || '').toLowerCase();
      const artTitleLower = String(p.artifact?.title || '').toLowerCase();
      const artContent = typeof p.artifact?.content === 'string' ? p.artifact.content.trim() : '';
      const isSampleSite =
        titleLower.includes('sample website') ||
        titleLower.includes('sample site') ||
        artTitleLower.includes('sample website') ||
        artTitleLower.includes('sample site') ||
        artContent === '<html>...</html>' ||
        artContent === '<html />' ||
        (p.kind === 'document' && /<html[\s>]|<!DOCTYPE\s+html/i.test(artContent) && artContent.length < 50);

      if (isSampleSite) {
        p = {
          ...p,
          kind: 'web',
          title: 'Web — Sample Website',
          web: {
            url: '/sandbox/sample-website/index.html',
            slug: 'sample-website',
          },
          artifact: undefined,
        };
        migrated = true;
      }

      if (!VALID_KINDS.has(p.kind)) continue;
      if (panels.length >= MAX_VISIBLE_PANELS) break;
      const zone = normalizeZone(p.zone);
      const resolved = zone && ALL_ZONES.includes(zone) && !panels.some((q) => q.zone === zone && !q.free)
        ? zone
        : pickZone();
      if (!resolved) break;
      seenIds.add(p.id);
      panels.push({
        ...p, zone: resolved, pinned: p.pinned === true,
        createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
      });
    }
    state = { panels, focusMode: !!data.focusMode };
    if (migrated) {
      persist();
    }
  } catch { /* corrupt snapshot — start clean */ }
}

/** Test hook — re-run hydration (module hydrates once at import). */
export function hydrateSurfacePanelsForTest() { hydrate(); }

function emit() { persist(); listeners.forEach((l) => l()); }
export function getSurfaceSnapshot(): SurfaceState { return state; }
export function subscribeSurfaces(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
export function useSurfacePanels(): SurfacePanel[] {
  return useSyncExternalStore(subscribeSurfaces, () => state.panels);
}
export function useSurfaceFocusMode(): boolean {
  return useSyncExternalStore(subscribeSurfaces, () => state.focusMode);
}

const ZONE_ROWS = ['top', 'mid', 'bottom'] as const;
const ZONE_COLS = [0, 1, 2, 3, 4, 5] as const;

export const ALL_ZONES: SurfaceZone[] = ZONE_ROWS.flatMap((r) =>
  ZONE_COLS.map((c) => `${r}-${c}` as SurfaceZone));

/** Reading order — used by "arrange panels" to lay everything out left→right, top→bottom. */
export const ZONE_READING_ORDER: SurfaceZone[] = ALL_ZONES;

/** Auto-assign preference: dock beside the core first, edges last. */
const ZONE_PREFERENCE: SurfaceZone[] = [
  'mid-1', 'mid-4', 'top-1', 'top-4', 'mid-0', 'mid-5',
  'top-0', 'top-5', 'mid-2', 'mid-3', 'bottom-1', 'bottom-4',
  'top-2', 'top-3', 'bottom-0', 'bottom-5', 'bottom-2', 'bottom-3',
];

function zoneOccupied(zone: SurfaceZone, excludeId?: string): boolean {
  // Free-canvas panels keep a fallback zone but don't hold it — the slot
  // stays open for docked panels.
  return state.panels.some((p) => p.zone === zone && p.id !== excludeId && !p.free);
}

function pickZone(preferred?: SurfaceZone): SurfaceZone | null {
  if (preferred && !zoneOccupied(preferred)) return preferred;
  for (const z of ZONE_PREFERENCE) {
    if (!zoneOccupied(z)) return z;
  }
  return null;
}

// ── Positional awareness ─────────────────────────────────────────────
let lastActivePanelId: string | null = null;

export function getLastActivePanel(): SurfacePanel | null {
  return state.panels.find((p) => p.id === lastActivePanelId) || state.panels[state.panels.length - 1] || null;
}

/** Human phrase for a zone — "middle right", "top left". */
export function zoneLabel(zone: SurfaceZone): string {
  const [row, colStr] = zone.split('-');
  const col = Number(colStr);
  const r = row === 'mid' ? 'middle' : row;
  const c = col <= 0 ? 'far left' : col === 1 ? 'left' : col === 2 ? 'center left'
    : col === 3 ? 'center right' : col === 4 ? 'right' : 'far right';
  return `${r} ${c}`;
}

export function describePanelLocation(panel: SurfacePanel): string {
  return `docked ${zoneLabel(panel.zone)}`;
}

/**
 * Move a panel to a zone. If the zone is occupied the two panels swap —
 * nothing is ever hidden behind another panel.
 */
export function movePanelToZone(panelId: string, zone: SurfaceZone): SurfacePanel | null {
  const panel = state.panels.find((p) => p.id === panelId);
  if (!panel) return null;
  if (panel.zone === zone) { lastActivePanelId = panelId; return panel; }
  const occupant = state.panels.find((p) => p.zone === zone && !p.free);
  const panels = state.panels.map((p) => {
    if (p.id === panelId) return { ...p, zone, free: undefined };
    if (occupant && p.id === occupant.id) return { ...p, zone: panel.zone, free: undefined };
    return p;
  });
  state = { ...state, panels };
  lastActivePanelId = panelId;
  emit();
  return panels.find((p) => p.id === panelId) ?? null;
}

/**
 * Place a panel freely on the canvas (⌥-drag drop). x/y are normalized
 * 0-1 within the workspace area; clamped so the panel can't fully leave.
 */
export function movePanelFree(panelId: string, x: number, y: number): SurfacePanel | null {
  const panel = state.panels.find((p) => p.id === panelId);
  if (!panel) return null;
  const clamp = (v: number) => Math.max(0, Math.min(0.95, v));
  const free = { x: clamp(x), y: clamp(y) };
  state = { ...state, panels: state.panels.map((p) => (p.id === panelId ? { ...p, free } : p)) };
  lastActivePanelId = panelId;
  emit();
  return state.panels.find((p) => p.id === panelId) ?? null;
}

/** "Arrange panels" — redistribute all open panels in reading order. */
export function arrangeSurfacePanels(): number {
  const sorted = [...state.panels].sort((a, b) => a.createdAt - b.createdAt);
  const panels = sorted.map((p, i) => ({
    ...p,
    zone: ZONE_READING_ORDER[i] ?? p.zone,
    free: undefined,
  }));
  state = { ...state, panels };
  if (panels[0]) lastActivePanelId = panels[0].id;
  emit();
  return panels.length;
}

/**
 * "Cluster panels" — Top-tier elite semantic pin clustering.
 * Automatically computes multimodal embeddings, discovers cohesive groups,
 * and reassigns panels to contiguous, coherent 3×3 zones with zero overlap.
 */
export function clusterSurfacePanels(): { count: number; clusterCount: number; summary: string } {
  if (!state.panels.length) {
    return { count: 0, clusterCount: 0, summary: 'No panels open to cluster.' };
  }
  const result = computeSpatialClusterLayout(state.panels);
  const clusterMap = new Map<number, typeof result.clusters[0]>();
  result.clusters.forEach((c) => clusterMap.set(c.clusterId, c));

  const panels = state.panels.map((p) => {
    const coords = result.panelCoordinates[p.id];
    const newZone = result.zoneAssignments[p.id] ?? p.zone;
    const cId = coords?.clusterId;
    const cluster = cId !== undefined ? clusterMap.get(cId) : undefined;
    return {
      ...p,
      zone: newZone,
      clusterId: cId,
      clusterLabel: cluster?.label,
      clusterColor: cluster?.color,
      clusterGlow: cluster?.glow,
      spatialCoord: coords ? { x: coords.x, y: coords.y, z: coords.z } : p.spatialCoord,
      free: undefined,
    };
  });

  state = { ...state, panels };
  if (panels[0]) lastActivePanelId = panels[0].id;
  emit();

  // Dispatch custom event for 3D visualizer and components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cortex-panels-clustered', {
      detail: { result, panels: state.panels }
    }));
  }

  return {
    count: panels.length,
    clusterCount: result.clusters.length,
    summary: result.summary,
  };
}

// ── Voice panel references ───────────────────────────────────────────
const KIND_WORDS: Array<[RegExp, (p: SurfacePanel) => boolean]> = [
  [/\b(camera|cctv|webcam|cam)\b/, (p) => p.kind === 'cctv'],
  [/\b(map|globe|map view)\b/, (p) => p.kind === 'map'],
  [/\b(document|doc|file|report|resume|cv)\b/, (p) => p.kind === 'document' || p.artifact?.kind === 'document' || !!p.document],
  [/\b(chart|graph|plot)\b/, (p) => p.kind === 'artifact' && p.artifact?.kind === 'chart'],
  [/\b(table|spreadsheet|grid|sheet)\b/, (p) => p.kind === 'sheet' || (p.kind === 'artifact' && p.artifact?.kind === 'table')],
  [/\b(web|app|sandbox|website)\b/, (p) => p.kind === 'web'],
  [/\b(image|picture|photo|art|illustration)\b/, (p) => p.kind === 'artifact' && p.artifact?.kind === 'image'],
  [/\b(stat|metric|gauge|number)\b/, (p) => p.kind === 'artifact' && p.artifact?.kind === 'stat'],
  [/\b(feed|feed panel)\b/, (p) => p.kind === 'artifact' && p.artifact?.kind === 'feed'],
  [/\b(telemetry|status panel)\b/, (p) => p.kind === 'telemetry'],
  [/\b(email|emails|inbox|mail|gmail|messages?)\b/, (p) => p.kind === 'inbox' || p.kind === 'email' || p.title.toLowerCase().includes('inbox') || p.title.toLowerCase().includes('email')],
];

/**
 * Resolve a spoken panel reference ("the chart", "that", "the camera")
 * against open panels. Returns null when nothing matches.
 */
/** All panels matching a spoken ref — for ambiguity detection ("which one?"). */
export function resolvePanelCandidates(ref: string): SurfacePanel[] {
  const r = ref.trim().toLowerCase().replace(/^(?:the|my|that|this|it)\s+/, '').replace(/\s*panel$/, '').trim();
  if (!r || /^(that|this|it|panel|one|surface)$/.test(r)) {
    const last = getLastActivePanel();
    return last ? [last] : [];
  }
  const out: SurfacePanel[] = [];
  const push = (p: SurfacePanel | undefined) => { if (p && !out.includes(p)) out.push(p); };
  for (const [re, test] of KIND_WORDS) {
    if (re.test(r)) for (const p of state.panels) if (test(p)) push(p);
  }
  for (const p of state.panels) {
    const title = p.title.toLowerCase();
    if (title && (title.includes(r) || r.includes(title.slice(0, 20)))) push(p);
  }
  return out;
}

export function resolvePanelRef(ref: string): SurfacePanel | null {
  return resolvePanelCandidates(ref)[0] ?? null;
}

/** Map a spoken position phrase to a zone. Returns null when unrecognized. */
export function zoneFromPhrase(phrase: string): SurfaceZone | null {
  const p = phrase.toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const has = (...words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`).test(p));
  const left = has('left');
  const right = has('right');
  const top = has('top', 'upper');
  const bottom = has('bottom', 'lower');
  const mid = has('middle', 'mid', 'center', 'centre');
  const farLeft = has('far', 'outer') && left;
  const farRight = has('far', 'outer') && right;
  if (!top && !bottom && !left && !right && !mid) return null;
  const row: 'top' | 'mid' | 'bottom' = top ? 'top' : bottom ? 'bottom' : 'mid';
  let col = 2;
  if (farLeft || (left && !right && !mid)) col = 0;
  else if (left) col = 1;
  else if (right && !left) col = farRight ? 5 : 4;
  else if (mid) col = 2;
  return `${row}-${col}` as SurfaceZone;
}

export interface OpenPanelInput {
  kind: SurfacePanelKind;
  title: string;
  artifact?: CortexArtifact;
  web?: SurfacePanel['web'];
  sheet?: SurfacePanel['sheet'];
  inbox?: SurfacePanel['inbox'];
  email?: SurfacePanel['email'];
  document?: SurfacePanel['document'];
  cctv?: SurfacePanel['cctv'];
  pinned?: boolean;
  preferredZone?: SurfaceZone;
  customSize?: { w: number; h: number };
}

/**
 * Open a panel. Returns the panel on success, null when caps are hit
 * (caller should surface an honest notice — never silently drop).
 */
export function openSurfacePanel(input: OpenPanelInput): SurfacePanel | null {
  if (state.panels.length >= MAX_VISIBLE_PANELS) return null;
  // Deduplicate: same kind+title+artifact id (or cctv url / web url / sheet title / inbox account / email id / doc id) already open → pin it.
  const existing = state.panels.find((p) =>
    p.kind === input.kind && p.title === input.title &&
    (p.artifact?.id ?? '') === (input.artifact?.id ?? '') &&
    (p.cctv?.url ?? '') === (input.cctv?.url ?? '') &&
    (p.web?.url ?? '') === (input.web?.url ?? '') &&
    (p.sheet?.title ?? '') === (input.sheet?.title ?? '') &&
    (p.inbox?.account ?? '') === (input.inbox?.account ?? '') &&
    (p.email?.id ?? '') === (input.email?.id ?? '') &&
    (p.document?.id ?? '') === (input.document?.id ?? ''));
  if (existing) {
    if (input.pinned && !existing.pinned) {
      state = { ...state, panels: state.panels.map((p) => p.id === existing.id ? { ...p, pinned: true } : p) };
      emit();
    }
    lastActivePanelId = existing.id;
    return existing;
  }
  const zone = pickZone(input.preferredZone);
  if (!zone) return null;
  const panel: SurfacePanel = {
    id: `panel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: input.kind,
    title: input.title.slice(0, 120),
    zone,
    pinned: !!input.pinned,
    artifact: input.artifact,
    fit: input.artifact?.kind === 'image' ? 'hug' : 'fill',
    cctv: input.cctv,
    web: input.web,
    sheet: input.sheet,
    inbox: input.inbox,
    email: input.email,
    document: input.document,
    customSize: input.customSize,
    createdAt: Date.now(),
  };
  state = { ...state, panels: [...state.panels, panel] };
  lastActivePanelId = panel.id;
  emit();
  return panel;
}

export function resizeSurfacePanel(id: string, size?: { w: number; h: number } | null): SurfacePanel | null {
  const panel = state.panels.find((p) => p.id === id);
  if (!panel) return null;
  state = {
    ...state,
    panels: state.panels.map((p) => (p.id === id ? { ...p, customSize: size || undefined } : p)),
  };
  lastActivePanelId = id;
  emit();
  return state.panels.find((p) => p.id === id) || null;
}

export function updateSurfacePanel(id: string, patch: Partial<SurfacePanel>): SurfacePanel | null {
  const panel = state.panels.find((p) => p.id === id);
  if (!panel) return null;
  state = {
    ...state,
    panels: state.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
  lastActivePanelId = id;
  emit();
  return state.panels.find((p) => p.id === id) || null;
}

export function closeSurfacePanel(id: string) {
  if (lastActivePanelId === id) lastActivePanelId = null;
  state = { ...state, panels: state.panels.filter((p) => p.id !== id) };
  emit();
}

export function pinSurfacePanel(id: string) {
  let pinnedPanel: SurfacePanel | undefined;
  state = {
    ...state,
    panels: state.panels.map((p) => {
      if (p.id === id) {
        const nextPinned = !p.pinned;
        if (nextPinned) pinnedPanel = { ...p, pinned: true };
        return { ...p, pinned: nextPinned };
      }
      return p;
    }),
  };
  lastActivePanelId = id;
  emit();

  // Vector B: Auto-synthesize pinned surfaces into Obsidian Knowledge Graph
  if (pinnedPanel) {
    try {
      cortexObsidianMemory.synthesizeSurfaceNote({
        id: pinnedPanel.id,
        kind: pinnedPanel.kind,
        title: pinnedPanel.title,
        web: pinnedPanel.web,
        sheet: pinnedPanel.sheet,
        artifact: pinnedPanel.artifact,
        clusterLabel: pinnedPanel.clusterLabel,
      });
    } catch { }
  }
}

export function closeAllSurfacePanels(keepPinned = true) {
  state = {
    ...state,
    panels: keepPinned ? state.panels.filter((p) => p.pinned) : [],
  };
  lastActivePanelId = null;
  emit();
}

export function setSurfaceFocusMode(on: boolean) {
  state = { ...state, focusMode: on };
  emit();
}

export function clearSurfacePanels() {
  state = { panels: [], focusMode: false };
  lastActivePanelId = null;
  emit();
}

// Hydrate after ALL_ZONES/pickZone are initialized (module bottom).
hydrate();

if (typeof window !== 'undefined') {
  (window as any).__cortexSurfaces = {
    openPanel: openSurfacePanel,
    closePanel: closeSurfacePanel,
    pinPanel: pinSurfacePanel,
    closeAll: closeAllSurfacePanels,
    clear: clearSurfacePanels,
    cluster: clusterSurfacePanels,
    resize: resizeSurfacePanel,
    getState: getSurfaceSnapshot,
  };
}

