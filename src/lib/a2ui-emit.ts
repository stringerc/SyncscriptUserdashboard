/**
 * a2ui-emit — compiles an agent-friendly surface spec into the A2UI v0.9
 * wire format consumed by CortexA2uiSurface.
 *
 * The agent never writes raw A2UI messages; it calls `emit_surface` with a
 * compact spec and this module produces createSurface → updateComponents →
 * updateDataModel messages with data bound via `{path}` references.
 *
 * Supported item types map onto the merged Cortex catalog:
 *   metric  → CortexMetric  {label, value, unit?, tone?}
 *   badge   → CortexBadge   {text, tone?}
 *   text    → Text          {text}          (basic catalog)
 *   button  → CortexButton  {label, action, variant?}
 *
 * Buttons emit `action.event.name` back through the surface's onAction
 * listener — the frontend routes `cortex.surface.*` events to the governed
 * /api/cortex/tools/execute path (see CortexVisualizerPage wiring).
 */

export const CORTEX_A2UI_CATALOG_ID = 'https://cortex.syncscript.local/catalogs/a2ui/v0.9.json';

export type SurfaceTone = 'cyan' | 'magenta' | 'violet' | 'emerald' | 'amber' | 'crimson';

export interface SurfaceMetric { type: 'metric'; label: string; value: string; unit?: string; tone?: SurfaceTone }
export interface SurfaceBadge { type: 'badge'; text: string; tone?: SurfaceTone }
export interface SurfaceText { type: 'text'; text: string }
export interface SurfaceButton { type: 'button'; label: string; action: string; variant?: 'primary' | 'ghost' | 'danger' }
export type SurfaceItem = SurfaceMetric | SurfaceBadge | SurfaceText | SurfaceButton;

export interface SurfaceSpec {
  title?: string;
  subtitle?: string;
  items?: SurfaceItem[];
}

const MAX_ITEMS = 12;
const MAX_TEXT = 500;

function clip(s: unknown, max = MAX_TEXT): string {
  return String(s ?? '').slice(0, max);
}

/**
 * Build A2UI v0.9 messages for a surface spec. Deterministic surfaceId
 * per call unless provided — surfaces are single-shot panels, not streams.
 */
export function surfaceSpecToMessages(spec: SurfaceSpec, surfaceId?: string): any[] {
  const sid = (surfaceId || `cortex-surface-${Date.now().toString(36)}`).replace(/[^a-zA-Z0-9_-]/g, '-');
  const items = (spec.items || []).slice(0, MAX_ITEMS);

  const components: any[] = [
    { id: 'root', component: 'Column', children: ['card'], weight: 1 },
    {
      id: 'card',
      component: 'CortexCard',
      title: { path: '/card/title' },
      subtitle: { path: '/card/subtitle' },
      accent: 'cyan',
      children: items.map((_, i) => `item-${i}`),
    },
  ];

  const data: any = {
    card: {
      title: clip(spec.title || 'CORTEX // SURFACE', 120),
      subtitle: clip(spec.subtitle || `surface ${sid}`, 160),
    },
  };

  items.forEach((item, i) => {
    const id = `item-${i}`;
    switch (item.type) {
      case 'metric':
        components.push({
          id, component: 'CortexMetric',
          label: clip(item.label, 80),
          value: { path: `/items/${i}/value` },
          unit: item.unit ? clip(item.unit, 24) : undefined,
          tone: item.tone || 'cyan',
        });
        data.items = data.items || {};
        data.items[i] = { value: clip(item.value, 80) };
        break;
      case 'badge':
        components.push({
          id, component: 'CortexBadge',
          text: { path: `/items/${i}/text` },
          tone: item.tone || 'cyan',
        });
        data.items = data.items || {};
        data.items[i] = { text: clip(item.text, 80) };
        break;
      case 'text':
        components.push({ id, component: 'Text', text: { path: `/items/${i}/text` } });
        data.items = data.items || {};
        data.items[i] = { text: clip(item.text) };
        break;
      case 'button':
        components.push({
          id, component: 'CortexButton',
          label: { path: `/items/${i}/label` },
          variant: item.variant || 'primary',
          action: {
            event: {
              name: `cortex.surface.${clip(item.action, 60).replace(/[^a-zA-Z0-9._-]/g, '-')}`,
              context: { surface: sid, item: i },
            },
          },
        });
        data.items = data.items || {};
        data.items[i] = { label: clip(item.label, 60) };
        break;
    }
  });

  return [
    { version: 'v0.9', createSurface: { surfaceId: sid, catalogId: CORTEX_A2UI_CATALOG_ID } },
    { version: 'v0.9', updateComponents: { surfaceId: sid, components } },
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/', value: data } },
  ];
}
