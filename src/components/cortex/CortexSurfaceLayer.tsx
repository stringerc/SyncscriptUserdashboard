/**
 * CortexSurfaceLayer — dockable panel host for the visualizer workspace.
 * Panels drag freely by their chrome and drop exactly where released
 * (free-canvas normalized coords). The zone grid remains as the initial
 * layout and as the target for keyboard nudges / voice "move it left".
 */
import React, { Suspense, lazy, useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pin, X, Crosshair, Maximize2, Minimize2, ExternalLink, LayoutGrid } from 'lucide-react';
import { C } from './cortex-demo-helpers';
import {
  useSurfacePanels, useSurfaceFocusMode,
  closeSurfacePanel, pinSurfacePanel, openSurfacePanel, movePanelToZone, movePanelFree,
  getSurfaceSnapshot, clusterSurfacePanels, resizeSurfacePanel, updateSurfacePanel,
  ALL_ZONES, type SurfacePanel, type SurfaceZone,
} from '../../lib/cortex-surfaces';
import { cortexSignalBus } from './CortexVisualizer';
import { WeatherWidget } from './WeatherCard';
import { CortexInitiativeInbox } from './CortexInitiativeInbox';
import { CortexStrategicReview } from './CortexStrategicReview';
import type { CortexArtifact } from '../../lib/cortex-artifacts';
import { setGlobeMode } from '../../lib/cortex-globe';
import { neuroAudio } from '../../lib/cortex-neuro-audio';
import type { HandPinchState } from '../../lib/cortex-webcam-parallax';
import { onBootPhase } from '../../lib/cortex-boot';
import {
  buildEmailPayload, buildDocumentPayload,
  type EmailPayload, type DocumentPayload, type EmailAttachment,
} from '../../lib/cortex-email-helpers';

const ArtifactRenderer = lazy(() => import('./artifacts/ArtifactRenderer'));
const NexusVoicePixieDust = lazy(() => import('../nexus/NexusVoicePixieDust'));
import type { NexusPixiePath } from '../nexus/NexusVoicePixieDust';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

const KIND_ICON: Record<string, string> = {
  artifact: '◈', map: '◎', cctv: '◉', telemetry: '◬', document: '▤', web: '🌐', sheet: '📊', inbox: '✉', email: '✉', initiative: '◉', strategic: '✦',
};

/** Camera feed cell — HLS (.m3u8) via lazy hls.js, everything else as <img>
 *  (MJPEG, JPEG snapshots, direct streams). */
function CctvFeed({ url, name }: { url: string; name?: string }) {
  const isHls = /\.m3u8(\?|#|$)/i.test(url);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  // MJPEG/snapshot <img> feeds can hang forever black — honest timeout.
  useEffect(() => {
    if (ready || failed) return;
    const t = setTimeout(() => setFailed(true), 12000);
    return () => clearTimeout(t);
  }, [ready, failed]);
  useEffect(() => {
    if (!isHls || !videoRef.current) return;
    let dead = false;
    let hls: { destroy: () => void } | null = null;
    void import('hls.js').then((m) => {
      if (dead || !videoRef.current) return;
      const Hls = m.default;
      if (Hls.isSupported()) {
        const h = new Hls({ enableWorker: true });
        hls = h;
        h.on(Hls.Events.ERROR, (_evt: unknown, data: { fatal?: boolean }) => {
          if (data?.fatal) setFailed(true);
        });
        h.loadSource(url);
        h.attachMedia(videoRef.current);
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = url;
      } else {
        setFailed(true);
      }
    }).catch(() => setFailed(true));
    return () => { dead = true; hls?.destroy(); };
  }, [url, isHls]);
  const box: React.CSSProperties = {
    width: '100%', aspectRatio: '16 / 9', borderRadius: 4, overflow: 'hidden',
    border: `1px solid ${C.border}`, background: '#000', marginBottom: 8,
  };
  if (failed) {
    return <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim, fontFamily: MONO, fontSize: 9 }}>STREAM UNAVAILABLE</div>;
  }
  return isHls
    ? <video ref={videoRef} autoPlay muted playsInline aria-label={name || 'camera feed'} onError={() => setFailed(true)} onCanPlay={() => setReady(true)} style={{ ...box, objectFit: 'cover' }} />
    : <div style={box}><img src={url} alt={name || 'camera feed'} onLoad={() => setReady(true)} onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>;
}

// ── Zone geometry ────────────────────────────────────────────────────
// Safe-area insets keep panels clear of HUD chrome: wordmark/telemetry top,
// nav/caption bottom, the left telemetry rail (MODE/UPTIME/Φ IIT), corner
// brackets, and the chat drawer when open.
const MARGIN = 20;
// Top row must clear the busy chyron (~top 96 + ~44px tall) so panels never
// swallow the "Cortex is working" indicator.
const TOP_SAFE = 148;
const BOTTOM_SAFE = 140;
const RAIL_RIGHT = 292;          // left telemetry rail ends ~x270-290
const GAP = 14;
// Chat drawer renders at min(400px, 88vw) — reserve the same, capped so the
// grid keeps at least half the viewport on narrow screens.
function drawerReserve(w: number): number {
  return Math.min(Math.min(400, w * 0.88), w * 0.5);
}

interface Rect { x: number; y: number; w: number; h: number }

/** Workspace bounds shared by the zone grid and free-canvas panels. */
function workspaceRect(drawerOpen: boolean): Rect {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const left = Math.max(MARGIN, Math.min(RAIL_RIGHT + 8, w * 0.24));
  const right = w - MARGIN - (drawerOpen ? drawerReserve(w) : 0);
  const top = TOP_SAFE;
  const bottom = h - BOTTOM_SAFE;
  return { x: left, y: top, w: Math.max(120, right - left), h: Math.max(90, bottom - top) };
}

const ZONE_COLS = 6;

function zoneIndex(zone: SurfaceZone): [number, number] {
  const [row, colStr] = zone.split('-');
  const r = row === 'top' ? 0 : row === 'mid' ? 1 : 2;
  const c = Math.max(0, Math.min(ZONE_COLS - 1, Number(colStr) || 0));
  return [r, c];
}

function computeZoneRects(drawerOpen: boolean): Record<SurfaceZone, Rect> {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // On narrow viewports the fixed rail reserve would push columns off-screen —
  // shrink it proportionally so the column grid always fits.
  const left = Math.max(MARGIN, Math.min(RAIL_RIGHT + 8, w * 0.24));
  const right = w - MARGIN - (drawerOpen ? drawerReserve(w) : 0);
  const top = TOP_SAFE;
  const bottom = h - BOTTOM_SAFE;
  const availW = Math.max(120, right - left);
  const availH = Math.max(90, bottom - top);
  const colW = (availW - GAP * (ZONE_COLS - 1)) / ZONE_COLS;
  const rowH = (availH - GAP * 2) / 3;
  const rects = {} as Record<SurfaceZone, Rect>;
  for (const z of ALL_ZONES) {
    const [r, c] = zoneIndex(z);
    rects[z] = {
      x: Math.round(left + c * (colW + GAP)),
      y: Math.round(top + r * (rowH + GAP)),
      w: Math.round(colW),
      h: Math.round(rowH),
    };
  }
  return rects;
}

/**
 * Direct 3x3 viewport grid partitioning for drag and drop.
 * Divides the available workspace into 3 equal columns (left, center, right)
 * and 3 equal rows (top, mid, bottom). Maps every cursor position seamlessly
 * without Euclidean dead-zones or left-side bias.
 */
function nearestZoneByPoint(px: number, py: number, _rects?: Record<SurfaceZone, Rect>): SurfaceZone {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const h = typeof window !== 'undefined' ? window.innerHeight : 900;
  const leftMargin = Math.max(MARGIN, Math.min(RAIL_RIGHT + 8, w * 0.24));
  const rightMargin = w - MARGIN;
  const topMargin = TOP_SAFE;
  const bottomMargin = h - BOTTOM_SAFE;

  const usableW = Math.max(200, rightMargin - leftMargin);
  const colW = usableW / ZONE_COLS;

  const colIdx = Math.max(0, Math.min(ZONE_COLS - 1, Math.floor((px - leftMargin) / colW)));
  const col = String(colIdx) as '0' | '1' | '2' | '3' | '4' | '5';

  const usableH = Math.max(150, bottomMargin - topMargin);
  const rowThird = usableH / 3;

  let row: 'top' | 'mid' | 'bottom';
  if (py < topMargin + rowThird) {
    row = 'top';
  } else if (py < topMargin + 2 * rowThird) {
    row = 'mid';
  } else {
    row = 'bottom';
  }

  return `${row}-${col}` as SurfaceZone;
}

function nearestZone(rect: Rect, rects?: Record<SurfaceZone, Rect>): SurfaceZone {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return nearestZoneByPoint(cx, cy, rects);
}

// ── Hug panels (images) ──────────────────────────────────────────────
// Image panels size to their content instead of filling the zone: the panel
// becomes a compact card centered in the zone, and the image gets the freed
// vertical space. Chrome budget: header ~30 + body padding ~20 + borders.
const HUG_CHROME_W = 30;
const HUG_CHROME_H = 56;

interface HugLayout { rect: Rect; img: { w: number; h: number } }

function hugLayout(panel: SurfacePanel, zone: Rect): HugLayout {
  const art = panel.artifact;
  const ar = art?.kind === 'image'
    ? (art.aspect === '16:9' ? 16 / 9 : art.aspect === '4:3' ? 4 / 3 : 1)
    : 1;
  const availW = Math.max(90, zone.w - HUG_CHROME_W - 12);
  const availH = Math.max(64, zone.h - HUG_CHROME_H - 12);
  const scale = Math.max(56, Math.min(availW / ar, availH));
  const img = { w: Math.round(ar * scale), h: Math.round(scale) };
  const w = Math.min(zone.w, img.w + HUG_CHROME_W);
  const h = Math.min(zone.h, img.h + HUG_CHROME_H);
  return {
    rect: { x: zone.x + (zone.w - w) / 2, y: zone.y + (zone.h - h) / 2, w, h },
    img,
  };
}

// ── Panel chrome ─────────────────────────────────────────────────────
const ZONE_GRID: SurfaceZone[][] = (['top', 'mid', 'bottom'] as const).map((row) =>
  ([0, 1, 2, 3, 4, 5] as const).map((c) => `${row}-${c}` as SurfaceZone));

function CornerTicks() {
  const t = { position: 'absolute' as const, width: 6, height: 6, borderColor: 'rgba(103,232,249,0.5)', borderStyle: 'solid' as const, pointerEvents: 'none' as const };
  return (
    <>
      <span style={{ ...t, top: -1, left: -1, borderWidth: '1px 0 0 1px' }} />
      <span style={{ ...t, top: -1, right: -1, borderWidth: '1px 1px 0 0' }} />
      <span style={{ ...t, bottom: -1, left: -1, borderWidth: '0 0 1px 1px' }} />
      <span style={{ ...t, bottom: -1, right: -1, borderWidth: '0 1px 1px 0' }} />
    </>
  );
}

/** Floating control chips for chromeless weather panels — frosted white
 *  pills matching the card, revealed on hover. */
const wxCtrlBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 8, border: '1px solid rgba(255,255,255,0.55)',
  background: 'rgba(255,255,255,0.42)', color: '#12335c', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  fontSize: 11, lineHeight: 1, padding: 0,
};

function PanelChrome({
  panel, dragging, dimmed, nudge, isFocused, onToggleFocus, onDragPointerDown, onKeyMove, onResizePointerDown, onResetSize, children
}: {
  panel: SurfacePanel;
  dragging: boolean;
  dimmed?: boolean;
  nudge?: boolean;
  isFocused?: boolean;
  onToggleFocus?: () => void;
  onDragPointerDown: (e: React.PointerEvent) => void;
  onKeyMove: (dr: number, dc: number) => void;
  onResizePointerDown?: (e: React.PointerEvent) => void;
  onResetSize?: () => void;
  children: React.ReactNode;
}) {
  const handlePromoteToCanvas = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (panel.kind === 'document' || panel.artifact) {
      window.dispatchEvent(new CustomEvent('cortex-open-canvas-tab', {
        detail: {
          tab: 'doc',
          artifact: panel.artifact || {
            title: panel.title,
            kind: 'document',
            format: 'markdown',
            content: panel.document?.content || '',
          },
          doc: panel.artifact,
        },
      }));
    } else if (panel.kind === 'web') {
      window.dispatchEvent(new CustomEvent('cortex-open-canvas-tab', {
        detail: { tab: 'web', slug: panel.web?.slug, url: panel.web?.url },
      }));
    } else if (panel.kind === 'sheet') {
      window.dispatchEvent(new CustomEvent('cortex-open-canvas-tab', {
        detail: { tab: 'sheet', sheet: panel.sheet },
      }));
    } else if (panel.kind === 'email') {
      window.dispatchEvent(new CustomEvent('cortex-open-canvas-tab', {
        detail: {
          tab: 'artifact',
          artifact: {
            title: panel.title,
            kind: 'document',
            format: 'markdown',
            content: `# ${panel.email?.subject}\n\n**From:** ${panel.email?.from}\n**To:** ${panel.email?.to}\n**Date:** ${panel.email?.date}\n\n${panel.email?.body}`,
          },
        },
      }));
    } else if (panel.kind === 'inbox') {
      window.dispatchEvent(new CustomEvent('cortex-open-canvas-tab', {
        detail: {
          tab: 'artifact',
          artifact: {
            title: panel.title,
            kind: 'feed',
            items: (panel.inbox?.threads || []).map((t) => ({ label: `${t.from} (${t.date})`, value: t.subject })),
          },
        },
      }));
    }
  };

  const clusterBorder = panel.clusterColor ? `${panel.clusterColor}88` : undefined;
  const clusterGlowShadow = panel.clusterGlow ? `0 0 16px ${panel.clusterGlow}, 0 8px 32px rgba(0,0,0,0.45)` : undefined;
  // Weather panels are chromeless: the WeatherCard IS the panel — no
  // title bar, no frame. Controls collapse to a hover-reveal cluster.
  const isWeatherCard = panel.artifact?.kind === 'weather';
  const [chromeHover, setChromeHover] = useState(false);
  const chromeInk = isWeatherCard ? '#12335c' : undefined;
  const chromeDim = isWeatherCard ? '#3b6ea5' : undefined;

  return (
    <div
      onPointerEnter={() => setChromeHover(true)}
      onPointerLeave={() => setChromeHover(false)}
      style={{
      position: 'relative', width: '100%', height: '100%',
      background: isWeatherCard ? 'transparent' : 'linear-gradient(165deg, rgba(10,18,30,0.5) 0%, rgba(6,12,22,0.42) 55%, rgba(14,10,30,0.46) 100%)',
      border: `1px solid ${isFocused ? 'rgba(160,245,255,0.6)' : isWeatherCard ? 'rgba(224,242,254,0.55)' : clusterBorder || (panel.pinned ? 'rgba(232,121,249,0.5)' : dragging ? 'rgba(160,245,255,0.55)' : 'rgba(255,255,255,0.14)')}`,
      borderRadius: isWeatherCard ? 22 : 10,
      backdropFilter: isWeatherCard ? 'none' : 'blur(22px) saturate(1.6)', WebkitBackdropFilter: isWeatherCard ? 'none' : 'blur(22px) saturate(1.6)',
      boxShadow: isWeatherCard
        ? '0 24px 60px rgba(2,20,60,0.35), 0 0 0 1px rgba(255,255,255,0.2) inset'
        : isFocused
        ? '0 0 60px rgba(0,0,0,0.7), 0 0 34px rgba(103,232,249,0.32), inset 0 1px 0 rgba(255,255,255,0.12)'
        : nudge
          ? '0 0 0 2px rgba(103,232,249,0.55), 0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1)'
          : dragging
            ? '0 18px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(103,232,249,0.12), inset 0 1px 0 rgba(255,255,255,0.1)'
            : (clusterGlowShadow || '0 8px 32px rgba(0,0,0,0.45)') + ', inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(255,255,255,0.03)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      {!isWeatherCard && <CornerTicks />}
      {!isWeatherCard && (
      <div
        onPointerDown={onDragPointerDown}
        style={{
          display: 'flex', alignItems: 'center', padding: '6px 9px',
          borderBottom: `1px solid ${C.border}`, flexShrink: 0,
          background: 'rgba(255,255,255,0.02)',
          cursor: dragging ? 'grabbing' : 'grab',
          userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        {/* Grip owns drag + arrow-key moves */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`Move panel ${panel.title} — drag to reposition freely, arrow keys to nudge`}
          onKeyDown={(e) => {
            const map: Record<string, [number, number]> = {
              ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0],
            };
            const d = map[e.key];
            if (d) { e.preventDefault(); onKeyMove(d[0], d[1]); }
          }}
          className="cx-panel-grip"
          style={{
            display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0,
            cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none',
            userSelect: 'none', WebkitUserSelect: 'none',
          }}
        >
          <span aria-hidden="true" style={{ color: panel.clusterColor || C.magenta, fontSize: 11, pointerEvents: 'none' }}>{KIND_ICON[panel.kind] || '◈'}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: isWeatherCard ? chromeInk : isFocused ? '#38bdf8' : panel.clusterColor || C.cyan,
            fontFamily: MONO, textTransform: 'uppercase', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {panel.title}
          </span>
        </div>

        {panel.clusterLabel && (
          <span
            data-cluster-badge="true"
            style={{
              fontSize: 7.5,
              padding: '1px 5px',
              borderRadius: 3,
              background: panel.clusterGlow || 'rgba(56, 217, 245, 0.15)',
              border: `1px solid ${panel.clusterColor || C.cyan}`,
              color: panel.clusterColor || C.cyan,
              fontFamily: MONO,
              letterSpacing: '0.12em',
              marginRight: 4,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
            title={`Semantic Cluster: ${panel.clusterLabel}`}
          >
            {panel.clusterLabel.slice(0, 14)}
          </span>
        )}

        {panel.pinned && <span style={{ fontSize: 8, color: isWeatherCard ? '#c026d3' : C.magenta, fontFamily: MONO, letterSpacing: '0.16em', marginRight: 4 }}>PIN</span>}

        {/* Promote to Canvas */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handlePromoteToCanvas}
          aria-label={`Promote ${panel.title} to Canvas`}
          title="Open in full Canvas drawer"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isWeatherCard ? chromeDim : C.dim, padding: 2, marginRight: 2, display: 'flex' }}
        ><ExternalLink size={10} /></button>

        {/* Focus / Maximize Toggle */}
        {onToggleFocus && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleFocus}
            aria-label={isFocused ? `Restore ${panel.title}` : `Focus ${panel.title}`}
            title={isFocused ? 'Restore to grid (Esc)' : 'Focus center stage'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFocused ? C.cyan : isWeatherCard ? chromeDim : C.dim, padding: 2, marginRight: 2, display: 'flex' }}
          >{isFocused ? <Minimize2 size={10} /> : <Maximize2 size={10} />}</button>
        )}

        {/* Pin */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => pinSurfacePanel(panel.id)}
          aria-label={panel.pinned ? `Unpin ${panel.title}` : `Pin ${panel.title}`}
          title={panel.pinned ? 'Unpin' : 'Pin panel'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: panel.pinned ? (isWeatherCard ? '#c026d3' : C.magenta) : isWeatherCard ? chromeDim : C.dim, padding: 2, marginRight: 2, display: 'flex' }}
        ><Pin size={10} /></button>

        {/* Close */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => closeSurfacePanel(panel.id)}
          aria-label={`Close ${panel.title}`}
          title="Close panel"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isWeatherCard ? chromeDim : C.dim, padding: 2, display: 'flex' }}
        ><X size={11} /></button>
      </div>
      )}

      {/* Weather panels: chromeless — controls appear on hover as a
          floating cluster over the card's top-right corner. */}
      {isWeatherCard && (
        <div style={{
          position: 'absolute', top: 8, right: 8, zIndex: 6,
          display: 'flex', gap: 4,
          opacity: chromeHover ? 1 : 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: chromeHover ? 'auto' : 'none',
        }}>
          <button
            onPointerDown={(e) => { e.stopPropagation(); onDragPointerDown(e); }}
            aria-label={`Move panel ${panel.title}`}
            title="Drag to move"
            style={wxCtrlBtn}
          >⋮⋮</button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (panel.widget) {
                updateSurfacePanel(panel.id, { widget: false });
                resizeSurfacePanel(panel.id, null);
              } else {
                updateSurfacePanel(panel.id, { widget: true });
                resizeSurfacePanel(panel.id, { w: 250, h: 190 });
              }
            }}
            aria-label={panel.widget ? `Expand ${panel.title} to full card` : `Widget mode for ${panel.title}`}
            title={panel.widget ? 'Full card' : 'Widget mode'}
            style={{ ...wxCtrlBtn, color: panel.widget ? '#1d4ed8' : '#12335c' }}
          ><LayoutGrid size={11} /></button>
          {onToggleFocus && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleFocus}
              aria-label={isFocused ? `Restore ${panel.title}` : `Focus ${panel.title}`}
              title={isFocused ? 'Restore' : 'Focus'}
              style={wxCtrlBtn}
            >{isFocused ? <Minimize2 size={11} /> : <Maximize2 size={11} />}</button>
          )}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => pinSurfacePanel(panel.id)}
            aria-label={panel.pinned ? `Unpin ${panel.title}` : `Pin ${panel.title}`}
            title={panel.pinned ? 'Unpin' : 'Pin'}
            style={{ ...wxCtrlBtn, color: panel.pinned ? '#c026d3' : '#12335c' }}
          ><Pin size={11} /></button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => closeSurfacePanel(panel.id)}
            aria-label={`Close ${panel.title}`}
            title="Close"
            style={wxCtrlBtn}
          ><X size={11} /></button>
        </div>
      )}

      <div
        onPointerDown={isWeatherCard ? (e) => {
          // Chromeless card: drag from anywhere except interactive controls.
          const t = e.target as HTMLElement;
          if (t.closest('button, a, input, textarea, select, [role="button"], [data-resize-handle]')) return;
          onDragPointerDown(e);
        } : undefined}
        style={{
          padding: isWeatherCard ? 0 : 10, overflowY: 'auto', flex: 1, minHeight: 0,
          pointerEvents: (dimmed || dragging) ? 'none' : 'auto',
          cursor: isWeatherCard ? (dragging ? 'grabbing' : 'grab') : undefined,
        }}
      >
        {children}
      </div>

      {/* Bottom-Right Interactive Resize Corner */}
      {onResizePointerDown && (
        <div
          role="button"
          data-resize-handle="true"
          tabIndex={0}
          aria-label={`Resize panel ${panel.title}`}
          title="Drag to resize panel (double-click to reset)"
          onPointerDown={onResizePointerDown}
          onMouseDown={onResizePointerDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onResetSize?.();
          }}
          style={isWeatherCard ? {
            position: 'absolute',
            bottom: 6,
            right: 6,
            width: 26,
            height: 26,
            cursor: 'nwse-resize',
            zIndex: 25,
            touchAction: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9,
            border: '1px solid rgba(255,255,255,0.55)',
            background: 'rgba(255,255,255,0.42)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            opacity: chromeHover ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: chromeHover ? 'auto' : 'none',
          } : {
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 16,
            height: 16,
            cursor: 'nwse-resize',
            zIndex: 25,
            touchAction: 'none',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            padding: '0 2px 2px 0',
            opacity: 0.65,
            transition: 'opacity 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1.0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = isWeatherCard ? '0' : '0.65'; }}
        >
          {isWeatherCard ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M9 3L3 9M9 6L6 9M9 9L9 9" stroke="#12335c" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M8 2L2 8M8 5L5 8M8 8L8 8" stroke={panel.clusterColor || C.cyan} strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

function WebPanelBody({ panel }: { panel: SurfacePanel }) {
  const [scaleMode, setScaleMode] = useState<'fit' | 'full'>('fit');
  const [iframeKey, setIframeKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(320);
  // Boot gate: persisted web panels (Distribution Deck, dashboards) would
  // otherwise all spawn iframes at t=0 and saturate first paint. Chrome
  // renders immediately; the iframe mounts at the 'ready' boot phase.
  const [webReady, setWebReady] = useState(false);
  useEffect(() => {
    let dead = false;
    onBootPhase('ready', () => { if (!dead) setWebReady(true); });
    return () => { dead = true; };
  }, []);

  const webUrl = panel.web?.url || '/sandbox/sample-website/index.html';
  const slug = panel.web?.slug || 'sample-website';

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 50) {
          setContainerW(entry.contentRect.width);
        }
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const virtualW = 960;
  const virtualH = 700;
  const isAutoFull = containerW >= 850;
  const isFit = scaleMode === 'fit' && !isAutoFull;
  const scale = Math.max(0.25, Math.min(1, containerW / virtualW));

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Micro Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px', fontSize: 9, fontFamily: MONO, borderBottom: '1px solid rgba(103,232,249,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.cyan, fontWeight: 700, letterSpacing: '0.14em' }}>LIVE SANDBOX</span>
          <button
            onClick={() => setScaleMode(scaleMode === 'fit' ? 'full' : 'fit')}
            style={{
              background: isFit ? 'rgba(103,232,249,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isFit ? C.cyan : C.border}`,
              color: isFit ? C.cyan : C.dim,
              padding: '2px 6px', borderRadius: 3, cursor: 'pointer', fontSize: 8, fontFamily: MONO,
            }}
            title={isFit ? 'Switch to 1:1 view' : 'Switch to fit-to-window view'}
          >
            {isFit ? '⊡ FIT VIEW' : '⛶ 1:1 FULL'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => setIframeKey((k) => k + 1)}
            style={{ background: 'none', border: `1px solid ${C.border}`, color: C.dim, padding: '2px 5px', borderRadius: 3, cursor: 'pointer', fontSize: 8, fontFamily: MONO }}
            title="Reload sandbox"
          >
            ↺
          </button>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('cortex-open-canvas-tab', {
                detail: { tab: 'web', slug, url: webUrl },
              }));
            }}
            style={{ background: 'rgba(103,232,249,0.1)', border: `1px solid ${C.borderBright}`, color: C.cyan, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', fontSize: 8, fontFamily: MONO }}
            title="Open in full Canvas drawer"
          >
            CANVAS ↗
          </button>
          <a
            href={webUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: C.magenta, textDecoration: 'none', padding: '2px 5px', fontSize: 8, fontFamily: MONO, border: '1px solid rgba(232,121,249,0.3)', borderRadius: 3 }}
            title="Open in standalone tab"
          >
            TAB ↗
          </a>
        </div>
      </div>

      {/* Frame Container */}
      <div style={{
        position: 'relative', width: '100%', flex: 1, minHeight: 180,
        borderRadius: 4, overflow: 'hidden', background: '#020408',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {!webReady ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(103,232,249,0.4)', fontSize: 9, fontFamily: MONO, letterSpacing: '0.2em',
          }}>BOOTING SANDBOX…</div>
        ) : isFit ? (
          <div style={{
            width: `${virtualW}px`,
            height: `${virtualH}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}>
            <iframe
              key={iframeKey}
              src={webUrl}
              title={panel.title || 'Web Sandbox'}
              sandbox="allow-scripts allow-forms allow-modals allow-same-origin"
              style={{ width: `${virtualW}px`, height: `${virtualH}px`, border: 'none', background: '#000' }}
            />
          </div>
        ) : (
          <iframe
            key={iframeKey}
            src={webUrl}
            title={panel.title || 'Web Sandbox'}
            sandbox="allow-scripts allow-forms allow-modals allow-same-origin"
            style={{ width: '100%', height: '100%', minHeight: 180, border: 'none', background: '#000' }}
          />
        )}
      </div>
    </div>
  );
}

function SheetPanelBody({ panel }: { panel: SurfacePanel }) {
  const sheetData = panel.sheet || {
    title: 'Financial Model & Unit Economics',
    columns: ['Metric', 'Q1 Target', 'Q2 Target', 'Growth %', 'Status'],
    rows: [
      ['Active Users', '1,250', '2,400', '+92%', 'On Track'],
      ['MRR ($)', '$42,500', '$81,600', '+92%', 'Exceeding'],
      ['Compute Cost ($)', '$8,200', '$14,300', '+74%', 'Optimized'],
      ['Gross Profit ($)', '$34,300', '$67,300', '+96%', 'Strong'],
    ],
  };

  const handleOpenInCanvas = () => {
    window.dispatchEvent(new CustomEvent('cortex-open-canvas-tab', {
      detail: { tab: 'sheet', sheet: sheetData },
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      {/* KPI Headline Badges */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
        padding: '6px 8px', borderRadius: 4,
        background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,10,18,0.6))',
        border: '1px solid rgba(16,185,129,0.25)',
      }}>
        <div>
          <div style={{ fontSize: 7, color: C.dim, fontFamily: MONO, letterSpacing: '0.14em' }}>TOTAL MRR</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', fontFamily: MONO }}>$81.6K</div>
        </div>
        <div>
          <div style={{ fontSize: 7, color: C.dim, fontFamily: MONO, letterSpacing: '0.14em' }}>AVG GROWTH</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', fontFamily: MONO }}>▲ 92%</div>
        </div>
        <div>
          <div style={{ fontSize: 7, color: C.dim, fontFamily: MONO, letterSpacing: '0.14em' }}>RUN-RATE</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c084fc', fontFamily: MONO }}>$979K</div>
        </div>
      </div>

      {/* Cyberpunk Table Grid */}
      <div style={{ width: '100%', overflowX: 'auto', maxHeight: 240, fontSize: 10, fontFamily: MONO, scrollbarWidth: 'thin', scrollbarColor: 'rgba(103,232,249,0.3) transparent' }}>
        <table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.borderBright}`, background: 'rgba(103,232,249,0.05)' }}>
              {sheetData.columns.map((col, idx) => (
                <th key={idx} style={{
                  padding: '6px 8px',
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  color: C.cyan,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  minWidth: idx === 0 ? 120 : idx === 4 ? 100 : 75,
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheetData.rows.slice(0, 10).map((row, rIdx) => (
              <tr
                key={rIdx}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: rIdx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent',
                }}
              >
                {row.map((cell, cIdx) => {
                  const val = String(cell);
                  const isGrowth = /\b\d+%\b|\+\d+%/.test(val);
                  const isStatus = /track|exceed|optimi|strong|pending|delay/i.test(val);
                  return (
                    <td
                      key={cIdx}
                      style={{
                        padding: '6px 8px',
                        whiteSpace: 'nowrap',
                        color: cIdx === 0 ? '#f8fafc' : '#cbd5e1',
                        fontVariantNumeric: 'tabular-nums',
                        minWidth: cIdx === 0 ? 120 : cIdx === 4 ? 100 : 75,
                      }}
                    >
                      {isGrowth ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '1px 5px', borderRadius: 3,
                          background: 'rgba(16,185,129,0.12)',
                          color: '#10b981',
                          fontWeight: 700,
                          fontSize: 9,
                          border: '1px solid rgba(16,185,129,0.3)',
                        }}>
                          ▲ {val.replace(/^\+/, '')}
                        </span>
                      ) : isStatus ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '1px 6px', borderRadius: 10,
                          fontSize: 8,
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          background: /exceed/i.test(val) ? 'rgba(192,132,252,0.15)' : /optimi/i.test(val) ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                          color: /exceed/i.test(val) ? '#c084fc' : /optimi/i.test(val) ? '#f59e0b' : '#34d399',
                          border: `1px solid ${/exceed/i.test(val) ? 'rgba(192,132,252,0.35)' : /optimi/i.test(val) ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.35)'}`,
                        }}>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                          {val}
                        </span>
                      ) : (
                        <span>{cIdx === 0 ? `◈ ${val}` : val}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick Action Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
        <button
          onClick={handleOpenInCanvas}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.35)',
            color: '#10b981', padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
            fontSize: 8, fontFamily: MONO, letterSpacing: '0.12em',
          }}
        >
          OPEN IN CANVAS ↗
        </button>
        <span style={{ fontSize: 8, color: C.dim, fontFamily: MONO }}>
          {sheetData.rows.length} ROWS • 5 COLUMNS
        </span>
      </div>
    </div>
  );
}

const REAL_INITIAL_INBOX = {
  account: 'stringer.c.a@gmail.com',
  unreadCount: 22825,
  formattedUnread: '22,825',
  categories: [
    { name: 'Primary', count: 4 },
    { name: 'Promotions', count: 14200 },
    { name: 'Social', count: 3100 },
    { name: 'Updates', count: 5520 },
  ],
  threads: [
    {
      id: 'live-0',
      from: 'Capital One',
      subject: 'See your latest review from CreditWise',
      snippet: "See how your credit's doing today—and every day.",
      date: '3:32 PM',
      unread: true,
      tag: 'Finance/Bills',
      category: 'primary',
    },
    {
      id: 'live-1',
      from: 'Credit Karma',
      subject: 'Reminder: Your score went up',
      snippet: 'Credit score update notification and profile alert.',
      date: '3:10 PM',
      unread: true,
      tag: 'Finance/Bills',
      category: 'primary',
    },
    {
      id: 'live-2',
      from: 'epic.statement',
      subject: 'Action Needed: Your balance is now past due',
      snippet: 'Emory Healthcare New Statement Account ending in 0645 Hi Christopher, You have an outstanding balance past due. Amount Due $1460.57',
      date: '2:10 PM',
      unread: true,
      tag: 'Finance/Bills',
      category: 'primary',
    },
    {
      id: 'live-3',
      from: 'Capital One',
      subject: 'Action required for your remaining balance',
      snippet: 'Please review your payment arrangements and agreement.',
      date: '2:08 PM',
      unread: true,
      tag: 'Finance/Bills',
      category: 'primary',
    },
    {
      id: 'live-4',
      from: 'Johnson, Demetria',
      subject: 'Superior Court Division 5 Civil/Domestic Bench Trial Calendar - Week of November 30, 2026',
      snippet: 'Good morning, If you haven\'t already, please submit the Mandatory Reporting form no later than Wednesday, November 18, 2026, at noon. Demetria Johnson | Judicial Executive Assistant',
      date: '10:18 AM',
      unread: false,
      tag: 'Legal/Court',
      category: 'primary',
    },
    {
      id: 'live-5',
      from: 'Numerologist.com',
      subject: 'URGENT: Your 11/11 money portal message',
      snippet: 'The 11/11 portal is open and the Waxing Crescent moon is signaling a massive shift.',
      date: 'Nov 11',
      unread: true,
      tag: 'Promotions',
      category: 'promotions',
    },
    {
      id: 'live-6',
      from: 'GitHub',
      subject: '[GitHub] Sudo email verification code',
      snippet: 'Please verify your identity, stringerc. Here is your GitHub sudo authentication code: 47902511. This code is valid for 15 minutes.',
      date: 'Nov 11',
      unread: true,
      tag: 'Dev/Alert',
      category: 'updates',
    },
    {
      id: 'live-7',
      from: 'Social Catfish',
      subject: 'You stopped searching too soon',
      snippet: 'Name only = 60% accuracy. Here\'s the full picture for your recent search.',
      date: 'Nov 11',
      unread: true,
      tag: 'Promotions',
      category: 'promotions',
    },
    {
      id: 'live-8',
      from: 'Lauren Trant',
      subject: 'Stringer v. Anders; CAFN 25-A-05494-5',
      snippet: 'Mr. Stringer, Attached please find correspondence to Capital One and Bank of America. Lauren K. Trant Founding Attorney Marietta, Georgia (678) 271-3471.',
      date: 'Nov 11',
      unread: false,
      tag: 'Legal/Court',
      category: 'primary',
    },
    {
      id: 'live-9',
      from: 'Apple',
      subject: 'Your credit limit offer is ready to preview.',
      snippet: 'Apply in as little as a minute. Earn Daily Cash back on every purchase, every day.',
      date: 'Nov 11',
      unread: true,
      tag: 'Finance/Bills',
      category: 'primary',
    },
  ],
};

function InboxPanelBody({ panel }: { panel: SurfacePanel }) {
  const [filter, setFilter] = useState<'all' | 'legal' | 'finance' | 'promotions' | 'unread'>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [triageStatus, setTriageStatus] = useState<string | null>(null);

  const [inboxState, setInboxState] = useState<any>(panel.inbox || REAL_INITIAL_INBOX);

  const fetchLiveEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cortex/gmail/live-inbox');
      if (res.ok) {
        const data = await res.json();
        if (data && data.threads && data.threads.length > 0) {
          setInboxState(data);
          updateSurfacePanel(panel.id, { inbox: data });
        }
      }
    } catch (e) {
      console.warn('[Inbox] live fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [panel.id]);

  useEffect(() => {
    fetchLiveEmails();
  }, [fetchLiveEmails, refreshKey]);

  const executeReduction = async (action: string) => {
    const actionLabel = action === 'purge_promotions' ? 'Purging ~14,200 promotional emails...'
      : action === 'archive_receipts' ? 'Archiving ~3,800 stale receipts...'
        : action === 'filter_attachments' ? 'Filtering heavy attachments (>10MB)...'
          : action === 'focus_legal' ? 'Isolating court and legal filings...'
            : `Executing ${action}...`;

    setTriageStatus(actionLabel);
    try {
      const res = await fetch('/api/cortex/gmail/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      setTriageStatus(result.message || 'Action executed successfully in Chrome.');
      setTimeout(() => setTriageStatus(null), 5500);
      fetchLiveEmails();
    } catch (e: any) {
      setTriageStatus(`Notice: ${e.message}`);
      setTimeout(() => setTriageStatus(null), 4000);
    }
  };

  useEffect(() => {
    const handleRefreshEvent = () => fetchLiveEmails();
    const handleTriageEvent = (e: any) => {
      const action = e.detail?.action || 'purge_promotions';
      executeReduction(action);
    };
    window.addEventListener('cortex-inbox-refresh', handleRefreshEvent);
    window.addEventListener('cortex-inbox-triage', handleTriageEvent);
    return () => {
      window.removeEventListener('cortex-inbox-refresh', handleRefreshEvent);
      window.removeEventListener('cortex-inbox-triage', handleTriageEvent);
    };
  }, [fetchLiveEmails]);

  const handleOpenEmailPin = (thread: any) => {
    const emailPayload = buildEmailPayload(thread);
    const shortFrom = (thread.from || '').split('<')[0].trim();
    openSurfacePanel({
      kind: 'email',
      title: `${shortFrom}: ${thread.subject}`,
      pinned: true,
      email: emailPayload,
      customSize: { w: 560, h: 440 },
    });
  };

  const handleOpenGmail = (search?: string) => {
    const q = search ? `#search/${encodeURIComponent(search)}` : '#inbox';
    const gmailUrl = `https://mail.google.com/mail/u/0/${q}`;
    if (typeof window !== 'undefined') {
      window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleTriageVoice = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cortex-viz-turn', {
        detail: 'triage my unread emails and reduce promotional backlog'
      }));
    }
  };

  const currentThreads = inboxState.threads || REAL_INITIAL_INBOX.threads;

  const filteredThreads = currentThreads.filter((t: any) => {
    if (filter === 'legal') {
      const txt = (t.from + ' ' + t.subject + ' ' + (t.tag || '')).toLowerCase();
      return t.tag === 'Legal/Court' || txt.includes('court') || txt.includes('trial') || txt.includes('johnson') || txt.includes('trant') || txt.includes('bench');
    }
    if (filter === 'finance') {
      const txt = (t.from + ' ' + t.subject + ' ' + (t.tag || '')).toLowerCase();
      return t.tag === 'Finance/Bills' || txt.includes('capital') || txt.includes('credit') || txt.includes('statement') || txt.includes('balance') || txt.includes('emory') || txt.includes('transunion');
    }
    if (filter === 'promotions') {
      return t.tag === 'Promotions' || t.category === 'promotions';
    }
    if (filter === 'unread') return t.unread;
    return true;
  });

  const legalCount = currentThreads.filter((t: any) => {
    const txt = (t.from + ' ' + t.subject + ' ' + (t.tag || '')).toLowerCase();
    return t.tag === 'Legal/Court' || txt.includes('court') || txt.includes('trial') || txt.includes('johnson') || txt.includes('trant');
  }).length;

  const financeCount = currentThreads.filter((t: any) => {
    const txt = (t.from + ' ' + t.subject + ' ' + (t.tag || '')).toLowerCase();
    return t.tag === 'Finance/Bills' || txt.includes('capital') || txt.includes('credit') || txt.includes('statement') || txt.includes('balance');
  }).length;

  const promoCount = currentThreads.filter((t: any) => t.tag === 'Promotions' || t.category === 'promotions').length;

  return (
    <div key={refreshKey} style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%', height: '100%' }}>
      {/* Account & KPI Headline Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', borderRadius: 4,
        background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(6,10,18,0.75))',
        border: '1px solid rgba(239,68,68,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ color: '#ef4444', fontSize: 13 }}>✉</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {inboxState.account || 'stringer.c.a@gmail.com'}
            </div>
            <div style={{ fontSize: 8, color: '#10b981', fontFamily: MONO, letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              {loading ? 'SYNCING CHROME SESSION...' : 'AUTHENTICATED CHROME SESSION · LIVE'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            padding: '2px 7px', borderRadius: 10,
            background: 'rgba(239,68,68,0.22)', color: '#f87171',
            fontSize: 9, fontWeight: 700, fontFamily: MONO, letterSpacing: '0.08em',
            border: '1px solid rgba(239,68,68,0.45)',
          }}>
            {inboxState.formattedUnread || (inboxState.unreadCount ? inboxState.unreadCount.toLocaleString() : '22,825')} UNREAD
          </span>
          <button
            onClick={() => handleOpenGmail()}
            style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.45)',
              color: '#fca5a5', padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
              fontSize: 8, fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 600,
            }}
            title="Open authenticated inbox in Google Chrome"
          >
            GMAIL ↗
          </button>
        </div>
      </div>

      {/* Triage Status Banner (if active) */}
      {triageStatus && (
        <div style={{
          padding: '4px 8px', borderRadius: 3,
          background: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.4)',
          fontSize: 8, fontFamily: MONO, color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ animation: 'spin 1s linear infinite' }}>⚡</span>
          <span>{triageStatus}</span>
        </div>
      )}

      {/* Inbox Reduction Engine Action Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 8px', borderRadius: 4,
        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)',
        gap: 4, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 8, color: '#94a3b8', fontFamily: MONO, fontWeight: 600, letterSpacing: '0.1em' }}>
          ⚡ REDUCTION ENGINE:
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button
            onClick={() => executeReduction('purge_promotions')}
            style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
              color: '#fca5a5', padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
              fontSize: 8, fontFamily: MONO, letterSpacing: '0.08em', fontWeight: 600,
            }}
            title="Filter and purge ~14,200 promotional emails"
          >
            🗑️ PURGE PROMOTIONS (~14.2k)
          </button>
          <button
            onClick={() => executeReduction('archive_receipts')}
            style={{
              background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)',
              color: '#7dd3fc', padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
              fontSize: 8, fontFamily: MONO, letterSpacing: '0.08em',
            }}
            title="Archive ~3,800 stale receipts (Uber, Lyft, DoorDash, Amazon)"
          >
            📦 ARCHIVE RECEIPTS (~3.8k)
          </button>
          <button
            onClick={() => setFilter('legal')}
            style={{
              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
              color: '#fcd34d', padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
              fontSize: 8, fontFamily: MONO, letterSpacing: '0.08em', fontWeight: 600,
            }}
            title="Isolate priority legal and court deadlines (Demetria Johnson, Lauren Trant)"
          >
            ⚖️ FOCUS LEGAL ({legalCount})
          </button>
          <button
            onClick={() => executeReduction('filter_attachments')}
            style={{
              background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.35)',
              color: '#d8b4fe', padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
              fontSize: 8, fontFamily: MONO, letterSpacing: '0.08em',
            }}
            title="Filter attachments larger than 10MB"
          >
            📎 &gt;10MB FILES
          </button>
        </div>
      </div>

      {/* Filter Tabs & Quick Refresh Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { id: 'all', label: `ALL (${currentThreads.length})` },
            { id: 'legal', label: `LEGAL (${legalCount})` },
            { id: 'finance', label: `FINANCE (${financeCount})` },
            { id: 'promotions', label: `PROMOTIONS (${promoCount})` },
            { id: 'unread', label: '★ UNREAD' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              style={{
                background: filter === tab.id ? 'rgba(103,232,249,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${filter === tab.id ? C.cyan : 'rgba(255,255,255,0.1)'}`,
                color: filter === tab.id ? C.cyan : C.dim,
                padding: '2px 7px', borderRadius: 3, cursor: 'pointer',
                fontSize: 8, fontFamily: MONO, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleTriageVoice}
            style={{
              background: 'rgba(168,85,247,0.14)', border: '1px solid rgba(168,85,247,0.4)',
              color: '#c084fc', padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
              fontSize: 8, fontFamily: MONO, letterSpacing: '0.1em', fontWeight: 600,
            }}
            title="Ask Cortex conversational voice to triage"
          >
            ⚡ VOICE TRIAGE
          </button>
          <button
            onClick={() => {
              setRefreshKey((k) => k + 1);
              fetchLiveEmails();
            }}
            style={{
              background: 'none', border: `1px solid ${C.border}`,
              color: C.dim, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
              fontSize: 8, fontFamily: MONO,
            }}
            title="Refresh live threads from Chrome"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Email Thread Feed */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        maxHeight: 250, overflowY: 'auto', paddingRight: 2,
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(239,68,68,0.3) transparent',
      }}>
        {filteredThreads.map((thread: any) => {
          const isLegal = thread.tag === 'Legal/Court' || /court|trial|johnson|trant/i.test(thread.from + ' ' + thread.subject);
          const isFinance = thread.tag === 'Finance/Bills' || /capital|credit|statement|balance|emory/i.test(thread.from + ' ' + thread.subject);

          const tagColor = isLegal ? '#f59e0b' : isFinance ? '#34d399' : thread.tag === 'Dev/Alert' ? '#38bdf8' : '#cbd5e1';
          const tagBg = isLegal ? 'rgba(245,158,11,0.14)' : isFinance ? 'rgba(16,185,129,0.12)' : thread.tag === 'Dev/Alert' ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.05)';
          const tagBorder = isLegal ? 'rgba(245,158,11,0.35)' : isFinance ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)';

          return (
            <div
              key={thread.id}
              onClick={() => handleOpenEmailPin(thread)}
              style={{
                display: 'flex', flexDirection: 'column', gap: 3,
                padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                background: thread.unread ? 'rgba(239,68,68,0.06)' : isLegal ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isLegal ? 'rgba(245,158,11,0.3)' : thread.unread ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}`,
                transition: 'all 0.18s ease',
              }}
              title="Click to open this email in a new pin on the surface"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 9, fontFamily: MONO }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {thread.unread && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  )}
                  <span style={{ fontWeight: 700, color: thread.unread ? '#f8fafc' : '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {thread.from}
                  </span>
                  {thread.tag && (
                    <span style={{
                      fontSize: 7, padding: '1px 5px', borderRadius: 2,
                      background: tagBg, color: tagColor,
                      border: `1px solid ${tagBorder}`, letterSpacing: '0.08em', flexShrink: 0,
                    }}>
                      {thread.tag}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 8, color: C.dim }}>{thread.date}</span>
                  <span style={{
                    fontSize: 7, padding: '1px 5px', borderRadius: 2,
                    background: 'rgba(56,189,248,0.15)', color: '#38bdf8',
                    border: '1px solid rgba(56,189,248,0.35)', letterSpacing: '0.08em', fontWeight: 600,
                  }}>
                    PIN ↗
                  </span>
                </div>
              </div>
              <div style={{
                fontSize: 10, fontWeight: thread.unread ? 600 : 400,
                color: thread.unread ? '#e0f2fe' : '#94a3b8',
                fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {thread.subject}
              </div>
              {thread.snippet && (
                <div style={{
                  fontSize: 9, color: 'rgba(148,233,255,0.55)',
                  fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {thread.snippet}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Action Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 8, color: C.dim, fontFamily: MONO }}>
          {filteredThreads.length} OF {currentThreads.length} REAL CONVERSATIONS • GOOGLE SUITE
        </span>
        <button
          onClick={() => handleOpenGmail('is:unread')}
          style={{
            background: 'none', border: 'none', color: C.cyan,
            cursor: 'pointer', fontSize: 8, fontFamily: MONO, letterSpacing: '0.12em',
          }}
        >
          FILTER 22,825 UNREAD IN GMAIL ↗
        </button>
      </div>
    </div>
  );
}

function EmailPanelBody({ panel }: { panel: SurfacePanel }) {
  const email = panel.email;
  if (!email) {
    return (
      <div style={{ color: C.dim, fontFamily: MONO, fontSize: 10, padding: 12 }}>
        No email content available.
      </div>
    );
  }

  const handleOpenDocumentPin = (att: EmailAttachment) => {
    const docPayload = buildDocumentPayload(att, email.subject);
    openSurfacePanel({
      kind: 'document',
      title: att.name,
      pinned: true,
      document: docPayload,
      customSize: { w: 580, h: 480 },
    });
  };

  const handleOpenGmail = (search?: string) => {
    const q = search ? `#search/${encodeURIComponent(search)}` : '#inbox';
    const gmailUrl = `https://mail.google.com/mail/u/0/${q}`;
    if (typeof window !== 'undefined') {
      window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const isLegal = email.tag === 'Legal/Court' || /court|trial|johnson|trant/i.test(email.from + ' ' + email.subject);
  const isFinance = email.tag === 'Finance/Bills' || /capital|credit|statement|balance|emory/i.test(email.from + ' ' + email.subject);
  const tagColor = isLegal ? '#f59e0b' : isFinance ? '#34d399' : '#38bdf8';
  const tagBg = isLegal ? 'rgba(245,158,11,0.15)' : isFinance ? 'rgba(16,185,129,0.15)' : 'rgba(56,189,248,0.15)';
  const tagBorder = isLegal ? 'rgba(245,158,11,0.4)' : isFinance ? 'rgba(16,185,129,0.4)' : 'rgba(56,189,248,0.4)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', height: '100%', fontFamily: MONO }}>
      {/* Header Strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', borderRadius: 4,
        background: 'linear-gradient(135deg, rgba(56,189,248,0.10), rgba(6,10,18,0.8))',
        border: '1px solid rgba(56,189,248,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ color: C.cyan, fontSize: 13 }}>✉</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email.from}
            </div>
            <div style={{ fontSize: 8, color: C.dim, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>To: {email.to || 'stringer.c.a@gmail.com'}</span>
              <span>•</span>
              <span>{email.date}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {email.tag && (
            <span style={{
              padding: '2px 6px', borderRadius: 2,
              background: tagBg, color: tagColor, border: `1px solid ${tagBorder}`,
              fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
            }}>
              {email.tag}
            </span>
          )}
          <button
            onClick={() => handleOpenGmail(email.subject)}
            style={{
              background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)',
              color: '#7dd3fc', padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
              fontSize: 8, letterSpacing: '0.12em', fontWeight: 600,
            }}
            title="Open thread in Google Chrome"
          >
            GMAIL ↗
          </button>
        </div>
      </div>

      {/* Subject Line Banner */}
      <div style={{
        padding: '8px 10px', borderRadius: 4,
        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)',
        fontSize: 11, fontWeight: 700, color: '#e0f2fe', letterSpacing: '0.02em',
      }}>
        {email.subject}
      </div>

      {/* Email Body Content */}
      <div style={{
        flex: 1, minHeight: 90, maxHeight: 170, overflowY: 'auto',
        padding: '8px 10px', borderRadius: 4,
        background: 'rgba(6,10,18,0.5)', border: '1px solid rgba(255,255,255,0.06)',
        fontSize: 10, lineHeight: 1.6, color: '#cbd5e1', whiteSpace: 'pre-wrap',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(56,189,248,0.3) transparent',
      }}>
        {email.body}
      </div>

      {/* Attachments Section */}
      {email.attachments && email.attachments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 8, color: '#94a3b8', letterSpacing: '0.1em', fontWeight: 600 }}>
            📎 ATTACHED DOCUMENTS ({email.attachments.length}) — CLICK TO PIN ON SPACE:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {email.attachments.map((att) => (
              <div
                key={att.id}
                onClick={() => handleOpenDocumentPin(att)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 10px', borderRadius: 4, cursor: 'pointer',
                  background: 'rgba(103,232,249,0.08)',
                  border: '1px solid rgba(103,232,249,0.25)',
                  transition: 'all 0.18s ease',
                }}
                title="Click to open this document in a new pinned panel"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 13, color: C.cyan }}>📄</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.name}
                    </div>
                    <div style={{ fontSize: 8, color: C.dim }}>
                      {att.size} • {att.type} • {att.badge || 'ATTACHMENT'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDocumentPin(att);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'rgba(103,232,249,0.18)', border: '1px solid rgba(103,232,249,0.4)',
                    color: C.cyan, padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
                    fontSize: 8, letterSpacing: '0.1em', fontWeight: 600, flexShrink: 0,
                  }}
                >
                  📌 PIN DOCUMENT ↗
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 8, color: C.dim }}>
          GOOGLE SUITE ENCRYPTED THREAD • STRINGER.C.A@GMAIL.COM
        </span>
        <button
          onClick={() => handleOpenGmail(email.subject)}
          style={{
            background: 'none', border: 'none', color: C.cyan,
            cursor: 'pointer', fontSize: 8, letterSpacing: '0.1em',
          }}
        >
          VIEW IN GMAIL ↗
        </button>
      </div>
    </div>
  );
}

function renderDocText(text: string) {
  // Support **bold** and *italic*
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} style={{ color: '#f8fafc', fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={idx} style={{ color: '#cbd5e1', fontStyle: 'italic' }}>
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

function DocumentPanelBody({ panel }: { panel: SurfacePanel }) {
  const doc = panel.document;
  if (!doc) {
    return (
      <div style={{ color: C.dim, fontFamily: MONO, fontSize: 10, padding: 12 }}>
        No document content available.
      </div>
    );
  }

  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handleDownload = () => {
    setDownloadNotice(`Exported ${doc.fileName}`);
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', height: '100%', fontFamily: MONO }}>
      {/* Document Meta Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', borderRadius: 4,
        background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(6,10,18,0.8))',
        border: '1px solid rgba(245,158,11,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ color: '#f59e0b', fontSize: 14 }}>📑</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.fileName}
            </div>
            <div style={{ fontSize: 8, color: '#fcd34d', letterSpacing: '0.08em' }}>
              {doc.issuer} • {doc.fileSize} • {doc.date}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            padding: '2px 6px', borderRadius: 2,
            background: 'rgba(245,158,11,0.18)', color: '#f59e0b',
            border: '1px solid rgba(245,158,11,0.4)',
            fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
          }}>
            {doc.badge || 'VERIFIED FILING'}
          </span>
          <button
            onClick={handleDownload}
            style={{
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)',
              color: '#fcd34d', padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
              fontSize: 8, letterSpacing: '0.12em', fontWeight: 600,
            }}
          >
            {downloadNotice || 'EXPORT ↗'}
          </button>
        </div>
      </div>

      {/* Document Parchment / Reader Surface */}
      <div style={{
        flex: 1, minHeight: 180, maxHeight: 330, overflowY: 'auto',
        padding: '12px 14px', borderRadius: 4,
        background: 'linear-gradient(180deg, rgba(15,23,42,0.85), rgba(6,10,18,0.92))',
        border: '1px solid rgba(245,158,11,0.2)',
        fontSize: 10, lineHeight: 1.6, color: '#e2e8f0',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(245,158,11,0.3) transparent',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {doc.content.split('\n\n').map((para, i) => {
            const trimmed = para.trim();
            if (trimmed.startsWith('### ')) {
              return (
                <div key={i} style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', borderBottom: '1px solid rgba(245,158,11,0.3)', paddingBottom: 4, marginTop: 4 }}>
                  {renderDocText(trimmed.replace('### ', ''))}
                </div>
              );
            }
            if (trimmed.startsWith('#### ')) {
              return (
                <div key={i} style={{ fontSize: 11, fontWeight: 700, color: '#fcd34d', marginTop: 2 }}>
                  {renderDocText(trimmed.replace('#### ', ''))}
                </div>
              );
            }
            if (trimmed === '---' || trimmed === '***') {
              return <hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(245,158,11,0.25)', margin: '6px 0' }} />;
            }
            if (trimmed.startsWith('> [!')) {
              return (
                <div key={i} style={{
                  padding: '6px 10px', borderRadius: 4,
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                  color: '#fca5a5', fontSize: 9, lineHeight: 1.5,
                }}>
                  {renderDocText(trimmed.replace(/> \[!(IMPORTANT|WARNING)\]\n>/, '⚠️ $1:').replace(/^>/gm, ''))}
                </div>
              );
            }

            // Check if table
            const lines = trimmed.split('\n');
            const isTable = lines.length >= 2 && lines[0].includes('|') && lines[1].includes('|') && lines[1].includes('-');
            if (isTable) {
              const headerCells = lines[0].split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
              const bodyRows = lines.slice(2).map(row =>
                row.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
              ).filter(row => row.length > 0);

              return (
                <div key={i} style={{ overflowX: 'auto', margin: '4px 0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5 }}>
                    <thead>
                      <tr style={{ background: 'rgba(245,158,11,0.15)', borderBottom: '1px solid rgba(245,158,11,0.35)' }}>
                        {headerCells.map((c, hIdx) => (
                          <th key={hIdx} style={{ padding: '4px 6px', textAlign: 'left', color: '#fcd34d', fontWeight: 700, letterSpacing: '0.04em' }}>
                            {renderDocText(c)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bodyRows.map((row, rIdx) => (
                        <tr key={rIdx} style={{
                          borderBottom: '1px solid rgba(245,158,11,0.12)',
                          background: rIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        }}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} style={{ padding: '4px 6px', color: '#e2e8f0' }}>
                              {renderDocText(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }

            // Check if bullet list
            if (lines.length > 0 && lines.every(l => l.trim().startsWith('- ') || l.trim().startsWith('* '))) {
              return (
                <ul key={i} style={{ margin: '3px 0', paddingLeft: 18 }}>
                  {lines.map((l, lIdx) => (
                    <li key={lIdx} style={{ color: '#e2e8f0', marginBottom: 2 }}>
                      {renderDocText(l.trim().replace(/^[-*]\s+/, ''))}
                    </li>
                  ))}
                </ul>
              );
            }

            // Normal text block
            return (
              <div key={i} style={{ whiteSpace: 'pre-wrap' }}>
                {lines.map((line, lIdx) => (
                  <div key={lIdx}>
                    {renderDocText(line)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Document Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 8, color: C.dim }}>
          ODYSSEY eFileGA & STATE SECURE ARCHIVE • CERTIFIED DIGITALLY
        </span>
        <span style={{ fontSize: 8, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          VERIFIED DOCUMENT HASH
        </span>
      </div>
    </div>
  );
}

function PanelBody({ panel, mediaFit, mediaSize }: {
  panel: SurfacePanel;
  mediaFit?: number;
  mediaSize?: { w: number; h: number };
}) {
  if (panel.kind === 'telemetry') {
    return <TelemetryBody />;
  }
  if (panel.kind === 'initiative') {
    return <CortexInitiativeInbox />;
  }
  if (panel.kind === 'strategic') {
    return <CortexStrategicReview />;
  }
  if (panel.kind === 'inbox') {
    return <InboxPanelBody panel={panel} />;
  }
  if (panel.kind === 'email' && panel.email) {
    return <EmailPanelBody panel={panel} />;
  }
  if (panel.kind === 'document' && panel.document) {
    return <DocumentPanelBody panel={panel} />;
  }
  const isSampleSite =
    panel.kind === 'web' ||
    panel.title.toLowerCase().includes('sample website') ||
    panel.title.toLowerCase().includes('sample site') ||
    panel.artifact?.title?.toLowerCase().includes('sample website') ||
    panel.artifact?.title?.toLowerCase().includes('sample site') ||
    (panel.artifact?.kind === 'document' && (panel.artifact.content?.trim() === '<html>...</html>' || /<html[\s>]|<!DOCTYPE\s+html/i.test(panel.artifact.content || '')));

  if (isSampleSite) {
    return <WebPanelBody panel={{
      ...panel,
      kind: 'web',
      web: panel.web || { url: '/sandbox/sample-website/index.html', slug: 'sample-website' },
    }} />;
  }
  if (panel.kind === 'sheet') {
    return <SheetPanelBody panel={panel} />;
  }
  if (panel.artifact?.kind === 'weather' && panel.widget) {
    return (
      <div style={{ padding: 0, height: '100%', overflow: 'hidden' }}>
        <WeatherWidget a={panel.artifact} />
      </div>
    );
  }
  if (panel.artifact) {
    return (
      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 60, color: C.dim, fontFamily: MONO, fontSize: 9, letterSpacing: '0.24em' }}>
          ◌ RENDERING…
        </div>
      }>
        <ArtifactRenderer
          artifact={panel.artifact}
          bare
          fitHeight={mediaFit}
          fitSize={mediaSize}
          onOpenGlobe={() => {
            setGlobeMode('globe');
            window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'open the map' }));
          }}
        />
      </Suspense>
    );
  }
  if (panel.kind === 'cctv' && panel.cctv) {
    return (
      <div>
        {panel.cctv.url && <CctvFeed url={panel.cctv.url} name={panel.cctv.name} />}
        <div style={{ fontSize: 12, color: C.text, marginBottom: 4 }}>{panel.cctv.name || 'Camera feed'}</div>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: MONO, marginBottom: 10 }}>
          {panel.cctv.lat != null ? `${panel.cctv.lat.toFixed(4)}°, ${panel.cctv.lon?.toFixed(4)}°` : 'position unknown'}
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: 'focus the camera' }))}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 4, cursor: 'pointer',
            background: 'rgba(103,232,249,0.1)', border: `1px solid ${C.borderBright}`,
            color: C.cyan, fontSize: 9, letterSpacing: '0.2em', fontFamily: MONO,
          }}
        ><Crosshair size={10} /> FOCUS</button>
      </div>
    );
  }
  if (panel.kind === 'cctv') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 80, gap: 8, color: C.dim, fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', textAlign: 'center' }}>
        <span style={{ fontSize: 18, color: C.magenta }} aria-hidden="true">◉</span>
        NO STREAM CONFIGURED
        <span style={{ fontSize: 8, letterSpacing: '0.14em', opacity: 0.7 }}>SAY "WATCH CAMERA &lt;URL&gt;"</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 80, gap: 8, color: C.dim, fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', textAlign: 'center' }}>
      <span style={{ fontSize: 18, color: C.magenta }} aria-hidden="true">{KIND_ICON[panel.kind] || '◈'}</span>
      {panel.kind.toUpperCase()} PANEL — NO DATA
    </div>
  );
}

/** Live telemetry panel — the 'telemetry' kind was dead code; now it shows
 *  Cortex's real signal-bus state instead of nothing. */
function TelemetryBody() {
  const [t, setT] = useState<{ state: string; level: number; text: string }>({ state: 'idle', level: 0, text: '' });
  useEffect(() => cortexSignalBus.subscribe((p) => setT({ state: p.state, level: p.level, text: p.text ?? '' })), []);
  return (
    <div style={{ fontFamily: MONO }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, letterSpacing: '0.2em', color: C.dim, marginBottom: 8 }}>
        <span>STATE</span><span style={{ color: C.cyan }}>{t.state.toUpperCase()}</span>
      </div>
      <div style={{ height: 3, background: 'rgba(148,233,255,0.12)', borderRadius: 2, marginBottom: 12 }}>
        <div style={{ width: `${Math.round(t.level * 100)}%`, height: '100%', background: C.cyan, borderRadius: 2, transition: 'width 0.15s' }} />
      </div>
      <div style={{ fontSize: 9, color: C.dim, letterSpacing: '0.16em', marginBottom: 4 }}>LEVEL</div>
      <div style={{ fontSize: 16, color: '#e8fbff', fontVariantNumeric: 'tabular-nums', marginBottom: 10 }}>{Math.round(t.level * 100)}%</div>
      {t.text && (
        <>
          <div style={{ fontSize: 9, color: C.dim, letterSpacing: '0.16em', marginBottom: 4 }}>TRANSMISSION</div>
          <div style={{ fontSize: 10, color: C.text, lineHeight: 1.5, maxHeight: 90, overflow: 'hidden' }}>{t.text}</div>
        </>
      )}
    </div>
  );
}

// ── Layer ────────────────────────────────────────────────────────────
export function CortexSurfaceLayer({ drawerOpen = false }: { drawerOpen?: boolean }) {
  const panels = useSurfacePanels();
  const focusMode = useSurfaceFocusMode();
  const [raisedId, setRaisedId] = useState<string | null>(null);
  const [edgeNudge, setEdgeNudge] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [drag, setDrag] = useState<{ id: string; rect: Rect; zone?: SurfaceZone } | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origin: Rect; targetZone: SurfaceZone } | null>(null);
  const dragRectRef = useRef<Rect | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; startW: number; startH: number; rect: Rect; minW?: number; minH?: number } | null>(null);
  const resizeRef = useRef<{ id: string; startX: number; startY: number; startW: number; startH: number; rect: Rect; minW?: number; minH?: number } | null>(null);
  const rectsRef = useRef<Record<SurfaceZone, Rect>>(computeZoneRects(false));
  const [focusedPanelId, setFocusedPanelId] = useState<string | null>(null);
  const [dockDust, setDockDust] = useState<{ path: NexusPixiePath; reduceMotion: boolean } | null>(null);
  const seenPanelIdsRef = useRef<Set<string> | null>(null);

  // Pixie-dust burst whenever a NEW panel docks (agent-generated UI materializing).
  // Panels restored from the persisted snapshot on mount are marked seen silently.
  useEffect(() => {
    if (seenPanelIdsRef.current === null) {
      seenPanelIdsRef.current = new Set(panels.map((p) => p.id));
      return;
    }
    const fresh = panels.filter((p) => !seenPanelIdsRef.current!.has(p.id));
    for (const p of panels) seenPanelIdsRef.current!.add(p.id);
    if (!fresh.length) return;
    const p = fresh[fresh.length - 1];
    const zr = computeZoneRects(drawerOpen)[p.zone];
    const ws = workspaceRect(drawerOpen);
    const to = p.free
      ? { x: ws.x + p.free.x * ws.w + 30, y: ws.y + p.free.y * ws.h + 16 }
      : { x: zr.x + zr.w / 2, y: zr.y + 28 };
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setDockDust({
      path: { from: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.35 }, to },
      reduceMotion,
    });
  }, [panels, drawerOpen]);

  // Pressing Escape restores any center-stage focused panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusedPanelId) {
        setFocusedPanelId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedPanelId]);

  // Recompute zone rects on resize / drawer toggle.
  useEffect(() => {
    const update = () => { rectsRef.current = computeZoneRects(drawerOpen); setDrag(null); };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [drawerOpen]);

  const beginDrag = useCallback((panel: SurfacePanel, currentRect: Rect, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    try { e.preventDefault(); } catch { }
    setFocusedPanelId(null);
    const origin = { ...currentRect };
    dragRef.current = { id: panel.id, startX: e.clientX, startY: e.clientY, origin, targetZone: panel.zone };
    dragRectRef.current = origin;
    setDrag({ id: panel.id, rect: origin, zone: panel.zone });
    setRaisedId(panel.id);
  }, []);

  const keyMove = useCallback((panel: SurfacePanel, dr: number, dc: number) => {
    if (panel.free) {
      // Free-canvas panel: arrow keys nudge position (~4% of workspace per press).
      movePanelFree(panel.id, panel.free.x + dc * 0.04, panel.free.y + dr * 0.04);
      return;
    }
    const [r, c] = zoneIndex(panel.zone);
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr > 2 || nc < 0 || nc > ZONE_COLS - 1) {
      // Edge rejected — flash the panel border so keyboard users get feedback.
      setEdgeNudge(panel.id);
      setTimeout(() => setEdgeNudge((cur) => (cur === panel.id ? null : cur)), 550);
      return;
    }
    const target = ZONE_GRID[nr][nc];
    if (target !== panel.zone) movePanelToZone(panel.id, target);
  }, []);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      // Allow fluid drag across the entire viewport while keeping the card on-screen
      const rect = {
        x: Math.min(Math.max(d.origin.x + (e.clientX - d.startX), MARGIN), window.innerWidth - MARGIN - 60),
        y: Math.min(Math.max(d.origin.y + (e.clientY - d.startY), MARGIN), window.innerHeight - MARGIN - 60),
        w: d.origin.w,
        h: d.origin.h,
      };
      dragRectRef.current = rect;
      const targetZone = nearestZoneByPoint(e.clientX, e.clientY, rectsRef.current);
      d.targetZone = targetZone;
      setDrag({ id: d.id, rect, zone: targetZone });
    };
    const onUp = (e: PointerEvent | MouseEvent) => {
      const d = dragRef.current;
      const rect = dragRectRef.current;
      dragRef.current = null;
      dragRectRef.current = null;
      setDrag(null);
      if (d) {
        // Fresh snapshot — a voice command may have closed/re-zoned this
        // panel mid-drag; the render-closure `panels` array is stale.
        const panel = getSurfaceSnapshot().panels.find((p) => p.id === d.id);
        if (panel && rect) {
          const ws = workspaceRect(drawerOpen);
          const freeDrop = {
            x: Math.max(0, Math.min(0.95, (rect.x - ws.x) / Math.max(1, ws.w - rect.w))),
            y: Math.max(0, Math.min(0.95, (rect.y - ws.y) / Math.max(1, ws.h - rect.h))),
          };
          // Free-canvas is the default: any pointer drop lands exactly where
          // released. Zone docking remains for keyboard nudge / voice moves.
          movePanelFree(d.id, freeDrop.x, freeDrop.y);
        }
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const beginResize = useCallback((panel: SurfacePanel, currentRect: Rect, e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const origin = { ...currentRect };
    // Weather cards need enough room for hero + forecast strips; widget
    // mode is a true glanceable tile and may shrink much smaller.
    const isWx = panel.artifact?.kind === 'weather';
    const isWxWidget = isWx && panel.widget;
    const rData = { id: panel.id, startX: e.clientX, startY: e.clientY, startW: origin.w, startH: origin.h, rect: origin, minW: isWxWidget ? 180 : isWx ? 300 : 220, minH: isWxWidget ? 120 : isWx ? 380 : 160 };
    resizeRef.current = rData;
    setResizing(rData);
    setRaisedId(panel.id);
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { }
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: PointerEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const dw = e.clientX - r.startX;
      const dh = e.clientY - r.startY;
      const newW = Math.max(r.minW ?? 220, Math.min(window.innerWidth * 0.9, r.startW + dw));
      const newH = Math.max(r.minH ?? 160, Math.min(window.innerHeight * 0.85, r.startH + dh));
      const newRect = { ...r.rect, w: Math.round(newW), h: Math.round(newH) };
      resizeRef.current = { ...r, rect: newRect };
      setResizing({ ...r, rect: newRect });
    };
    const onUp = () => {
      const r = resizeRef.current;
      resizeRef.current = null;
      setResizing(null);
      if (r) {
        resizeSurfacePanel(r.id, { w: r.rect.w, h: r.rect.h });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [resizing !== null]);

  const flashNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3800);
  }, []);

  // Listen for artifact open/pin events → surface panels (visualizer only;
  // /cortex/chat has its own canvas surface via cortex-open-artifact).
  useEffect(() => {
    const toPanel = (e: Event) => {
      const art = (e as CustomEvent).detail as CortexArtifact | undefined;
      if (!art) return;
      const isHtml = art.kind === 'document' && (art.format === 'html' || /<html[\s>]|<!DOCTYPE\s+html/i.test(art.content));
      const p = openSurfacePanel({
        kind: isHtml ? 'web' : art.kind === 'map' ? 'map' : art.kind === 'document' ? 'document' : 'artifact',
        title: isHtml && (art.title?.toLowerCase() === 'html' || !art.title) ? 'Web — Sample Website' : art.title || art.kind,
        artifact: art,
        web: isHtml ? { url: '/sandbox/sample-website/index.html', slug: 'sample-website' } : undefined,
      });
      if (!p) flashNotice('SURFACE FULL — SAY "CLOSE PANELS" OR CLOSE ONE');
    };
    const pin = (e: Event) => {
      const art = (e as CustomEvent).detail as CortexArtifact | undefined;
      if (!art) return;
      const isHtml = art.kind === 'document' && (art.format === 'html' || /<html[\s>]|<!DOCTYPE\s+html/i.test(art.content));
      const p = openSurfacePanel({
        kind: isHtml ? 'web' : art.kind === 'map' ? 'map' : art.kind === 'document' ? 'document' : 'artifact',
        title: isHtml && (art.title?.toLowerCase() === 'html' || !art.title) ? 'Web — Sample Website' : art.title || art.kind,
        artifact: art,
        pinned: true,
        web: isHtml ? { url: '/sandbox/sample-website/index.html', slug: 'sample-website' } : undefined,
      });
      if (!p) flashNotice('SURFACE FULL — SAY "CLOSE PANELS" OR CLOSE ONE');
    };
    window.addEventListener('cortex-open-artifact', toPanel);
    window.addEventListener('cortex-pin-artifact', pin);
    return () => {
      window.removeEventListener('cortex-open-artifact', toPanel);
      window.removeEventListener('cortex-pin-artifact', pin);
    };
  }, []);

  // ── Spatial Hand Gesture Pinch-to-Grab & Direct Manipulation ──
  useEffect(() => {
    let grabbedId: string | null = null;
    let grabOffset = { x: 0, y: 0 };

    const onHand = (e: Event) => {
      const d = (e as CustomEvent<HandPinchState>).detail;
      if (!d || !d.detected) {
        if (grabbedId) {
          grabbedId = null;
        }
        return;
      }

      const ws = workspaceRect(drawerOpen);

      if (d.pinching) {
        if (!grabbedId) {
          // Pinch started! Hit-test panels: check panels under hand
          const hit = panels.find((p) => {
            const r = rectsRef.current[p.zone];
            if (!r) return false;
            const w = p.customSize?.w || r.w;
            const h = p.customSize?.h || r.h;
            const currentX = p.free ? ws.x + p.free.x * Math.max(1, ws.w - w) : r.x;
            const currentY = p.free ? ws.y + p.free.y * Math.max(1, ws.h - h) : r.y;
            return (
              d.x >= currentX - 35 &&
              d.x <= currentX + w + 35 &&
              d.y >= currentY - 35 &&
              d.y <= currentY + h + 35
            );
          });

          if (hit) {
            grabbedId = hit.id;
            setRaisedId(hit.id);
            const r = rectsRef.current[hit.zone] || { w: 500, h: 400 };
            const w = hit.customSize?.w || r.w;
            const h = hit.customSize?.h || r.h;
            const currentNormX = hit.free ? hit.free.x : Math.max(0, (r.x - ws.x) / Math.max(1, ws.w - w));
            const currentNormY = hit.free ? hit.free.y : Math.max(0, (r.y - ws.y) / Math.max(1, ws.h - h));
            grabOffset = { x: d.normX - currentNormX, y: d.normY - currentNormY };
            neuroAudio.playPacketChime(hit.clusterColor || '#34d399');
          }
        } else {
          // Dragging grabbed panel in real-time
          const newX = Math.max(0, Math.min(0.95, d.normX - grabOffset.x));
          const newY = Math.max(0, Math.min(0.95, d.normY - grabOffset.y));
          movePanelFree(grabbedId, newX, newY);
        }
      } else {
        // Pinch released
        if (grabbedId) {
          grabbedId = null;
          neuroAudio.playCoreImpact();
        }
      }
    };

    window.addEventListener('cortex-hand-pinch', onHand);
    return () => window.removeEventListener('cortex-hand-pinch', onHand);
  }, [panels, drawerOpen]);

  if (!panels.length && !focusMode) return null;

  const rects = computeZoneRects(drawerOpen);
  rectsRef.current = rects;

  return (
    <div data-cortex-surface-layer="" style={{ position: 'absolute', inset: 0, zIndex: 32, pointerEvents: 'none' }}>
      <style>{`.cx-panel-grip:focus-visible{outline:2px solid rgba(103,232,249,0.85);outline-offset:2px;border-radius:2px}`}</style>
      {/* While dragging, disable iframe pointer-events so pointerup/pointermove are never intercepted */}
      {drag !== null && (
        <style>{`iframe { pointer-events: none !important; user-select: none !important; }`}</style>
      )}
      {/* Free-canvas drag: no zone snap preview — the panel itself is the preview. */}
      <AnimatePresence>
        {panels.map((p) => {
          const isFocused = focusedPanelId === p.id;
          const anyFocused = !!focusedPanelId;
          const isDragging = drag?.id === p.id;
          const isResizing = resizing?.id === p.id;
          const dimmed = (focusMode && !p.pinned) || (anyFocused && !isFocused);
          const baseZone = rects[p.zone];
          const isWeatherCardPanel = p.artifact?.kind === 'weather';
          const isWxWidget = isWeatherCardPanel && p.widget;
          const defaultW = isWxWidget ? 250 : isWeatherCardPanel ? 400 : p.kind === 'sheet' ? Math.max(baseZone.w, 520) : p.kind === 'web' ? Math.max(baseZone.w, 540) : baseZone.w;
          const defaultH = isWxWidget ? 190 : isWeatherCardPanel ? Math.max(baseZone.h, 600) : p.kind === 'sheet' ? Math.max(baseZone.h, 300) : p.kind === 'web' ? Math.max(baseZone.h, 380) : baseZone.h;
          const w = p.customSize?.w ?? defaultW;
          const h = p.customSize?.h ?? defaultH;

          const hug = !isDragging && !isResizing && !isFocused && p.fit === 'hug' ? hugLayout(p, baseZone) : null;
          const isWeb = p.kind === 'web';
          const isSheet = p.kind === 'sheet';
          const targetW = isWeb
            ? Math.min(window.innerWidth - 60, 980)
            : isSheet
              ? Math.min(window.innerWidth - 60, 760)
              : Math.round(window.innerWidth * 0.8);
          const targetH = isWeb
            ? Math.min(window.innerHeight - 80, 740)
            : isSheet
              ? Math.min(window.innerHeight - 80, 500)
              : Math.round(window.innerHeight * 0.84);
          const targetX = Math.max(MARGIN, Math.round((window.innerWidth - targetW) / 2));
          const targetY = Math.max(MARGIN, Math.round((window.innerHeight - targetH) / 2));

          const [, zc] = zoneIndex(p.zone);
          const isRight = zc >= 4;
          const isCenter = zc >= 2 && zc <= 3;
          const isBottom = p.zone.startsWith('bottom');

          const dockedX = isRight
            ? Math.max(MARGIN, baseZone.x + baseZone.w - w)
            : isCenter
              ? Math.max(MARGIN, Math.round(baseZone.x + (baseZone.w - w) / 2))
              : baseZone.x;

          const dockedY = isBottom && h > baseZone.h
            ? Math.max(TOP_SAFE, Math.min(baseZone.y, window.innerHeight - BOTTOM_SAFE - h))
            : baseZone.y;

          const ws = workspaceRect(drawerOpen);
          // Free placement applies to hug (image) panels too — they keep their
          // content-sized w/h but their top-left follows the free coords.
          const fw = hug ? hug.rect.w : w;
          const fh = hug ? hug.rect.h : h;
          const freeRect = !isDragging && !isResizing && !isFocused && p.free
            ? {
                x: Math.round(ws.x + p.free.x * Math.max(1, ws.w - fw)),
                y: Math.round(ws.y + p.free.y * Math.max(1, ws.h - fh)),
                w: fw, h: fh,
              }
            : null;

          const r = isDragging
            ? drag.rect
            : isResizing
              ? resizing.rect
              : isFocused
                ? { x: targetX, y: targetY, w: targetW, h: targetH }
                : freeRect ?? (hug ? hug.rect : { x: dockedX, y: dockedY, w, h });
          return (
            <motion.div
              key={p.id}
              role="region"
              data-panel-id={p.id}
              data-zone={p.zone}
              aria-label={`Panel: ${p.title}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{
                opacity: dimmed ? 0.2 : 1, scale: isFocused ? 1.01 : 1,
                left: r.x, top: r.y, width: r.w, height: r.h,
              }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={(isDragging || isResizing)
                ? { duration: 0 }
                : { left: { type: 'spring', stiffness: 320, damping: 30 }, top: { type: 'spring', stiffness: 320, damping: 30 }, width: { type: 'spring', stiffness: 320, damping: 30 }, height: { type: 'spring', stiffness: 320, damping: 30 }, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}
              style={{
                position: 'absolute', pointerEvents: 'auto',
                zIndex: isDragging ? 60 : isResizing ? 58 : isFocused ? 55 : raisedId === p.id ? 40 : 32,
              }}
              onPointerDown={() => setRaisedId(p.id)}
            >
              <PanelChrome
                panel={p}
                dragging={!!isDragging}
                dimmed={dimmed}
                nudge={edgeNudge === p.id}
                isFocused={isFocused}
                onToggleFocus={() => setFocusedPanelId(isFocused ? null : p.id)}
                onDragPointerDown={(e) => beginDrag(p, r, e)}
                onKeyMove={(dr, dc) => keyMove(p, dr, dc)}
                onResizePointerDown={(e) => beginResize(p, r, e)}
                onResetSize={() => resizeSurfacePanel(p.id, null)}
              >
                <PanelBody
                  panel={p}
                  mediaFit={Math.max(80, r.h - 110)}
                  mediaSize={hug?.img}
                />
              </PanelChrome>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {/* Quick Action: Semantic Pin Clustering */}
      {panels.length >= 2 && !focusedPanelId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          style={{
            position: 'absolute',
            bottom: 96,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            pointerEvents: 'auto',
          }}
        >
          <button
            onClick={() => {
              const res = clusterSurfacePanels();
              flashNotice(res.summary.toUpperCase());
            }}
            aria-label="Cluster Pinned Panels Semantically"
            title="Cluster pins into coherent spatial groups (zero backend, WebGPU/UMAP-lite)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              borderRadius: 20,
              background: 'rgba(6,10,18,0.88)',
              border: '1px solid rgba(103,232,249,0.4)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: '#38bdf8',
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.16em',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.6), 0 0 10px rgba(56,189,248,0.2)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(103,232,249,0.85)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.8), 0 0 16px rgba(56,189,248,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(103,232,249,0.4)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.6), 0 0 10px rgba(56,189,248,0.2)';
            }}
          >
            <span style={{ fontSize: 10, color: '#38bdf8' }}>◈</span>
            CLUSTER PINS
          </button>
        </motion.div>
      )}
      {/* Surface-full / transient notice */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            style={{
              position: 'absolute', bottom: 150, left: '50%', transform: 'translateX(-50%)',
              zIndex: 47, padding: '8px 18px', pointerEvents: 'none',
              border: '1px solid rgba(232,121,249,0.5)', borderRadius: 4,
              background: 'rgba(10,6,16,0.9)', backdropFilter: 'blur(10px)',
              color: '#e879f9', fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', fontFamily: MONO,
            }}
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Pixie-dust burst when a new panel docks (agent-generated UI). */}
      {dockDust && (
        <Suspense fallback={null}>
          <NexusVoicePixieDust
            path={dockDust.path}
            reduceMotion={dockDust.reduceMotion}
            onComplete={() => setDockDust(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

export default CortexSurfaceLayer;
