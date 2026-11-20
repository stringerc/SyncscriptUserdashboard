/**
 * CortexA2uiSurface
 * -----------------
 * Cortex-styled host for A2UI (Agent-to-UI) generative surfaces.
 *
 * Two input modes:
 *  1. `surface`   — a live `SurfaceModel` already owned by a `MessageProcessor`
 *                  (e.g. a persistent processor fed by a transport). The surface
 *                  stays reactive: data-model and component updates re-render
 *                  automatically through the A2UI node layer.
 *  2. `messages`  — a (possibly static) A2UI v0.9 message stream. A
 *                  `MessageProcessor` is created per `messages` identity,
 *                  fed the stream, and the surface named by `surfaceId`
 *                  (or the first created surface) is rendered. Re-pass a new
 *                  array to replay a stream; for incremental streaming prefer
 *                  mode 1 with a long-lived processor.
 *
 * The panel chrome (border, header strip, translucent obsidian background)
 * follows the Cortex visual language; the `--a2ui-*` CSS custom properties
 * below retheme the basic catalog's Web Components to match.
 */

import React, { useMemo } from 'react';
import { A2uiSurface } from '@a2ui/react/v0_9';
import type { ReactCatalogComponent } from '@a2ui/react/v0_9';
import {
  MessageProcessor,
  type ActionListener,
  type Catalog,
  type ProcessableMessagePayload,
  type SurfaceModel,
} from '@a2ui/web_core/v0_9';
import { cortexA2uiCatalog } from './cortexA2uiCatalog';
import { CORTEX_COLORS, CORTEX_SPACING, CORTEX_TYPOGRAPHY } from '../../../lib/cortex-design-tokens';

export interface CortexA2uiSurfaceProps {
  /** Live surface model (preferred for streaming). Takes precedence over `messages`. */
  surface?: SurfaceModel<ReactCatalogComponent>;
  /** A2UI message stream (single message, array, or `{messages: [...]}` wrapper). */
  messages?: ProcessableMessagePayload;
  /** Catalog the processor is built with. Defaults to the merged Cortex catalog. */
  catalog?: Catalog<any>;
  /** Surface id to render when `messages` is used. Defaults to the first surface. */
  surfaceId?: string;
  /** Global action handler for buttons/functions in `messages` mode. */
  onAction?: ActionListener;
  /** Header-strip label. */
  title?: string;
  /** Optional status text rendered next to the title (e.g. surface id). */
  statusLabel?: string;
  className?: string;
}

/**
 * CSS custom properties that retheme the basic catalog's self-contained Web
 * Components (Text, Button, Row, Column, Card, ...) to the Cortex palette.
 * The Cortex* React components read CORTEX_* tokens directly.
 */
const A2UI_CORTEX_THEME_VARS = {
  '--a2ui-color-on-background': '#dff6ff',
  '--a2ui-color-on-surface': 'rgba(223, 246, 255, 0.6)',
  '--a2ui-color-background': 'transparent',
  '--a2ui-color-surface': CORTEX_COLORS.obsidian.card,
  '--a2ui-color-border': CORTEX_COLORS.cyan.border,
  '--a2ui-color-primary': CORTEX_COLORS.cyan.neon,
  '--a2ui-color-primary-dark': CORTEX_COLORS.cyan.deep,
  '--a2ui-color-primary-light': CORTEX_COLORS.cyan.bright,
  '--a2ui-color-primary-hover': CORTEX_COLORS.cyan.base,
  '--a2ui-color-on-primary': '#001018',
  '--a2ui-border-radius': `${CORTEX_SPACING.borderRadiusSmall}px`,
  '--a2ui-font-family-title': CORTEX_TYPOGRAPHY.fontMono,
  '--a2ui-font-family-monospace': CORTEX_TYPOGRAPHY.fontMono,
  '--a2ui-font-size-xs': '10px',
  '--a2ui-font-size-s': '11px',
  '--a2ui-font-size-m': '12px',
  '--a2ui-spacing-xs': '4px',
  '--a2ui-spacing-s': '8px',
  '--a2ui-spacing-m': '12px',
  '--a2ui-spacing-l': '16px',
} as React.CSSProperties;

const panelStyle: React.CSSProperties = {
  border: `1px solid ${CORTEX_COLORS.cyan.border}`,
  borderRadius: CORTEX_SPACING.borderRadiusCard,
  background: 'rgba(7, 7, 13, 0.72)',
  backdropFilter: 'blur(8px)',
  boxShadow: `0 0 32px ${CORTEX_COLORS.cyan.glow}, inset 0 0 48px rgba(0, 0, 0, 0.35)`,
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 14px',
  borderBottom: `1px solid ${CORTEX_COLORS.cyan.border}`,
  background: 'linear-gradient(90deg, rgba(0, 229, 255, 0.08), rgba(7, 7, 13, 0.4) 55%, transparent)',
  fontFamily: CORTEX_TYPOGRAPHY.fontMono,
};

const headerDotStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: CORTEX_COLORS.cyan.neon,
  boxShadow: `0 0 8px ${CORTEX_COLORS.cyan.neon}`,
  flexShrink: 0,
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.3em',
  color: CORTEX_COLORS.cyan.base,
  textTransform: 'uppercase',
};

const headerStatusStyle: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: '9px',
  letterSpacing: '0.18em',
  color: 'rgba(223, 246, 255, 0.45)',
  textTransform: 'uppercase',
};

const bodyStyle: React.CSSProperties = { padding: '14px' };

const emptyStyle: React.CSSProperties = {
  fontFamily: CORTEX_TYPOGRAPHY.fontMono,
  fontSize: '10px',
  letterSpacing: '0.2em',
  color: 'rgba(223, 246, 255, 0.4)',
  textTransform: 'uppercase',
  padding: '18px 4px',
  textAlign: 'center',
};

export function CortexA2uiSurface({
  surface,
  messages,
  catalog = cortexA2uiCatalog,
  surfaceId,
  onAction,
  title = 'A2UI // GENERATIVE SURFACE',
  statusLabel,
  className,
}: CortexA2uiSurfaceProps) {
  const resolvedSurface = useMemo<SurfaceModel<ReactCatalogComponent> | undefined>(() => {
    if (surface) return surface;
    if (messages == null) return undefined;

    const processor = new MessageProcessor<ReactCatalogComponent>([catalog], onAction);
    processor.processMessages(messages);

    if (surfaceId) {
      return processor.model.getSurface(surfaceId);
    }
    return processor.model.surfacesMap.values().next().value;
  }, [surface, messages, catalog, surfaceId, onAction]);

  const effectiveStatus = statusLabel ?? resolvedSurface?.id;

  return (
    <div
      className={className ? `cx-a2ui-surface ${className}` : 'cx-a2ui-surface'}
      style={{ ...panelStyle, ...A2UI_CORTEX_THEME_VARS }}
      data-a2ui-surface={resolvedSurface?.id}
    >
      <div style={headerStyle}>
        <span style={headerDotStyle} aria-hidden />
        <span style={headerTitleStyle}>{title}</span>
        {effectiveStatus != null && <span style={headerStatusStyle}>{effectiveStatus}</span>}
      </div>
      <div style={bodyStyle}>
        {resolvedSurface ? (
          <A2uiSurface surface={resolvedSurface} />
        ) : (
          <div style={emptyStyle}>Awaiting agent surface signal…</div>
        )}
      </div>
    </div>
  );
}

export default CortexA2uiSurface;
