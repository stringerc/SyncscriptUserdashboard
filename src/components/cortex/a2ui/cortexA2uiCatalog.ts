/**
 * Cortex A2UI Catalog
 * -------------------
 * A2UI v0.9 catalog that extends the standard `basicCatalog` with
 * Cortex-branded generative-UI components. The agent runtime targets these
 * component names inside `updateComponents` payloads; the React renderer
 * (`@a2ui/react`) binds their Zod schemas to native React implementations
 * created via `createComponentImplementation`.
 *
 * The catalog is a single merged catalog: every basic component (Row, Column,
 * Text, Button, Card, ...) plus the Cortex* components below. A surface created
 * with `catalogId = cortexA2uiCatalog.id` can freely mix both families, which
 * keeps v0.9 payloads simple (v0.9 has no reliable per-component `catalogId`).
 *
 * Protocol: A2UI v0.9 (`version: 'v0.9'` on every message).
 * Spec/renderer docs: https://a2ui.org/ and https://github.com/a2ui-project/a2ui
 */

import React from 'react';
import { z } from 'zod';
import {
  Catalog,
  CommonSchemas,
  type ResolvedChildRef,
} from '@a2ui/web_core/v0_9';
import { basicCatalog } from '@a2ui/web_core/v0_9/basic_catalog';
import type { WebComponentImplementation } from '@a2ui/web_core/v0_9/universal';
import {
  createComponentImplementation,
  type ReactComponentImplementation,
} from '@a2ui/react/v0_9';
import { CORTEX_COLORS, CORTEX_SPACING, CORTEX_TYPOGRAPHY } from '../../../lib/cortex-design-tokens';

/* ------------------------------------------------------------------ */
/* Catalog identity + agent-facing instructions                       */
/* ------------------------------------------------------------------ */

export const CORTEX_A2UI_CATALOG_ID =
  'https://cortex.syncscript.local/catalogs/a2ui/v0.9.json';

const CORTEX_CATALOG_INSTRUCTIONS = `# Cortex A2UI Catalog

You are generating UI for the Cortex observability surface. Prefer Cortex*
components for branded widgets and the basic layout components (Column, Row,
Card, Text, Divider) for structure.

## Cortex components

- CortexCard: titled container. Props: title?, subtitle?, accent?, children.
- CortexMetric: single KPI readout. Props: label, value, unit?, tone?.
- CortexBadge: small status pill. Props: text, tone?.
- CortexButton: action button. Props: label, action {name, context?}, variant?.

## Conventions

- accent/tone values: cyan | magenta | violet | emerald | amber | crimson.
- CortexButton.action is {event: {name, context?}}; event.name is the action
  sent back to the agent runtime (e.g. "cortex.approve", "cortex.retry").
- All text props accept literals or {path: "/data/..."} bindings into the
  surface data model.
- Wrap content in a root Column; CortexCard children go inside its children
  list by component id.`;

/* ------------------------------------------------------------------ */
/* Shared schema fragments                                             */
/* ------------------------------------------------------------------ */

const CORTEX_TONES = ['cyan', 'magenta', 'violet', 'emerald', 'amber', 'crimson'] as const;

/** Common envelope props every Cortex component accepts (mirrors basic catalog). */
const cortexCommonProps = {
  weight: z.number().optional(),
  accessibility: CommonSchemas.AccessibilityAttributes.optional(),
};

/* ------------------------------------------------------------------ */
/* Component APIs (Zod schemas — the agent/renderer contract)          */
/* ------------------------------------------------------------------ */

const CortexCardApi = {
  name: 'CortexCard',
  schema: z.object({
    title: CommonSchemas.DynamicString.optional(),
    subtitle: CommonSchemas.DynamicString.optional(),
    accent: z.enum(CORTEX_TONES).optional(),
    children: CommonSchemas.ChildList.optional(),
    ...cortexCommonProps,
  }),
};

const CortexMetricApi = {
  name: 'CortexMetric',
  schema: z.object({
    label: CommonSchemas.DynamicString,
    value: CommonSchemas.DynamicString,
    unit: CommonSchemas.DynamicString.optional(),
    tone: z.enum(CORTEX_TONES).optional(),
    ...cortexCommonProps,
  }),
};

const CortexBadgeApi = {
  name: 'CortexBadge',
  schema: z.object({
    text: CommonSchemas.DynamicString,
    tone: z.enum(CORTEX_TONES).optional(),
    ...cortexCommonProps,
  }),
};

const CortexButtonApi = {
  name: 'CortexButton',
  schema: z.object({
    label: CommonSchemas.DynamicString,
    variant: z.enum(['primary', 'ghost', 'danger']).optional(),
    action: CommonSchemas.Action.optional(),
    ...cortexCommonProps,
  }),
};

/* ------------------------------------------------------------------ */
/* Cortex styling helpers (inline styles — no global CSS required)    */
/* ------------------------------------------------------------------ */

const MONO = CORTEX_TYPOGRAPHY.fontMono;

function toneColor(tone: (typeof CORTEX_TONES)[number] | undefined): string {
  switch (tone) {
    case 'magenta': return CORTEX_COLORS.magenta.neon;
    case 'violet': return CORTEX_COLORS.violet.neon;
    case 'emerald': return CORTEX_COLORS.emerald.neon;
    case 'amber': return CORTEX_COLORS.amber.neon;
    case 'crimson': return CORTEX_COLORS.crimson.neon;
    case 'cyan':
    default: return CORTEX_COLORS.cyan.neon;
  }
}

const cortexPanelStyle: React.CSSProperties = {
  border: `1px solid ${CORTEX_COLORS.cyan.border}`,
  borderRadius: CORTEX_SPACING.borderRadiusCard,
  background: 'rgba(7, 7, 13, 0.78)',
  backdropFilter: 'blur(6px)',
  fontFamily: MONO,
  color: '#dff6ff',
  padding: '14px 16px',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  marginBottom: '10px',
  paddingBottom: '8px',
  borderBottom: '1px solid rgba(103, 232, 249, 0.14)',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: CORTEX_COLORS.cyan.base,
};

const cardSubtitleStyle: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.08em',
  color: 'rgba(223, 246, 255, 0.55)',
};

const cardBodyStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '8px' };

const metricStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  padding: '8px 10px',
  border: '1px solid rgba(103, 232, 249, 0.16)',
  borderRadius: 4,
  background: 'rgba(0, 229, 255, 0.04)',
  minWidth: '96px',
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: '9px',
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
  color: 'rgba(223, 246, 255, 0.5)',
};

const metricValueStyle = (tone: string): React.CSSProperties => ({
  fontSize: '20px',
  fontWeight: 600,
  lineHeight: 1.1,
  color: tone,
  textShadow: `0 0 12px ${tone}55`,
});

const metricUnitStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'rgba(223, 246, 255, 0.45)',
  marginLeft: '4px',
};

const badgeBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  alignSelf: 'flex-start',
  padding: '3px 10px',
  borderRadius: 999,
  fontSize: '9px',
  fontWeight: 600,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
};

function badgeStyle(tone: string): React.CSSProperties {
  return {
    ...badgeBaseStyle,
    color: tone,
    border: `1px solid ${tone}66`,
    background: `${tone}14`,
    boxShadow: `0 0 10px ${tone}33`,
  };
}

function buttonStyle(variant: 'primary' | 'ghost' | 'danger' | undefined, tone: string): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    padding: '8px 18px',
    borderRadius: 3,
    cursor: 'pointer',
    transition: 'box-shadow 140ms ease, background 140ms ease, color 140ms ease',
  };
  if (variant === 'danger') {
    return { ...base, color: CORTEX_COLORS.crimson.neon, border: `1px solid ${CORTEX_COLORS.crimson.neon}88`, background: 'transparent' };
  }
  if (variant === 'ghost') {
    return { ...base, color: tone, border: `1px solid ${tone}55`, background: 'transparent' };
  }
  // primary (default)
  return {
    ...base,
    color: '#001018',
    border: `1px solid ${tone}`,
    background: tone,
    boxShadow: `0 0 16px ${tone}55`,
  };
}

/* ------------------------------------------------------------------ */
/* Child-list rendering helper                                         */
/* ------------------------------------------------------------------ */

type BuildChildFn = (id: string, basePath?: string) => React.ReactNode;

/**
 * Renders a resolved A2UI `ChildList` prop. The generic binder resolves it to
 * `(string | ResolvedChildRef)[]`; template items arrive as `{id, basePath}`.
 */
function renderChildList(
  children: (string | ResolvedChildRef)[] | undefined,
  buildChild: BuildChildFn,
): React.ReactNode {
  if (!children || children.length === 0) return null;
  return children.map((child, index) => {
    const id = typeof child === 'string' ? child : child.id;
    const basePath = typeof child === 'string' ? undefined : child.basePath;
    return React.createElement(React.Fragment, { key: id ?? index }, buildChild(id, basePath));
  });
}

/* ------------------------------------------------------------------ */
/* React implementations (bound by @a2ui/react's generic binder)      */
/* ------------------------------------------------------------------ */

const h = React.createElement;

export const CortexCard = createComponentImplementation(CortexCardApi, ({ props, buildChild }) => {
  const accent = toneColor(props.accent);
  const hasHeader = props.title != null || props.subtitle != null;
  const body = renderChildList(props.children, buildChild);
  return h(
    'div',
    {
      className: 'cx-a2ui-card',
      style: {
        ...cortexPanelStyle,
        borderLeft: `2px solid ${accent}`,
        boxShadow: `0 0 24px ${accent}22, inset 0 0 32px rgba(0,0,0,0.35)`,
      },
    },
    hasHeader &&
      h(
        'div',
        { className: 'cx-a2ui-card__head', style: cardHeaderStyle },
        props.title != null && h('div', { className: 'cx-a2ui-card__title', style: cardTitleStyle }, props.title),
        props.subtitle != null &&
          h('div', { className: 'cx-a2ui-card__subtitle', style: cardSubtitleStyle }, props.subtitle),
      ),
    body != null && h('div', { className: 'cx-a2ui-card__body', style: cardBodyStyle }, body),
  );
});

export const CortexMetric = createComponentImplementation(CortexMetricApi, ({ props }) => {
  const tone = toneColor(props.tone);
  return h(
    'div',
    { className: 'cx-a2ui-metric', style: { ...metricStyle, borderColor: `${tone}44` } },
    h('div', { className: 'cx-a2ui-metric__label', style: metricLabelStyle }, props.label),
    h(
      'div',
      { className: 'cx-a2ui-metric__value', style: { display: 'flex', alignItems: 'baseline' } },
      h('span', { style: metricValueStyle(tone) }, props.value),
      props.unit != null && h('span', { className: 'cx-a2ui-metric__unit', style: metricUnitStyle }, props.unit),
    ),
  );
});

export const CortexBadge = createComponentImplementation(CortexBadgeApi, ({ props }) => {
  const tone = toneColor(props.tone);
  return h(
    'span',
    { className: 'cx-a2ui-badge', style: badgeStyle(tone) },
    h('span', {
      style: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: tone,
        boxShadow: `0 0 8px ${tone}`,
        display: 'inline-block',
      },
    }),
    props.text,
  );
});

export const CortexButton = createComponentImplementation(CortexButtonApi, ({ props }) => {
  const tone = toneColor(props.variant === 'danger' ? 'crimson' : 'cyan');
  const action = props.action;
  return h(
    'button',
    {
      type: 'button',
      className: 'cx-a2ui-button',
      style: buttonStyle(props.variant, tone),
      onClick: () => {
        if (action) void action();
      },
      onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.boxShadow = `0 0 22px ${tone}88`;
      },
      onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.boxShadow = props.variant === 'primary' ? `0 0 16px ${tone}55` : 'none';
      },
    },
    props.label,
  );
});

/* ------------------------------------------------------------------ */
/* Catalog assembly                                                    */
/* ------------------------------------------------------------------ */

/** Any catalog entry the React renderer can host (React impl or Web Component impl). */
export type CortexCatalogComponent = WebComponentImplementation | ReactComponentImplementation;

export const cortexComponents = [CortexCard, CortexMetric, CortexBadge, CortexButton] as const;

/**
 * The merged Cortex catalog: every basic-catalog component plus the Cortex*
 * implementations above, under a single catalog id so v0.9 surfaces can mix
 * both families without per-component `catalogId` fields.
 */
export const cortexA2uiCatalog = new Catalog<CortexCatalogComponent>(
  CORTEX_A2UI_CATALOG_ID,
  'v0.9',
  [...basicCatalog.components.values(), ...cortexComponents],
  [...basicCatalog.functions.values()],
  undefined,
  CORTEX_CATALOG_INSTRUCTIONS,
);
