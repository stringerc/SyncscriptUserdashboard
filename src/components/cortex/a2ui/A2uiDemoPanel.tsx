/**
 * A2uiDemoPanel
 * -------------
 * Self-contained demo of the Cortex A2UI generative-UI surface.
 *
 * DEMO DATA — NOT FUNCTIONAL: the message stream below is hardcoded sample
 * payload in the exact A2UI v0.9 wire format (`createSurface` →
 * `updateComponents` → `updateDataModel`). It renders an agent status card
 * with two metrics and an action button so the surface can be verified
 * visually without any backend/agent wiring. Replace `messages` (or mount
 * `CortexA2uiSurface` directly) with a live stream to go functional.
 */

import type { A2uiMessage } from '@a2ui/web_core/v0_9';
import { CortexA2uiSurface } from './CortexA2uiSurface';
import { cortexA2uiCatalog } from './cortexA2uiCatalog';

/**
 * DEMO DATA — hardcoded A2UI v0.9 message stream.
 * Surface id: `cortex-demo`. Catalog: the merged Cortex catalog.
 */
export const A2UI_DEMO_MESSAGES: A2uiMessage[] = [
  {
    version: 'v0.9',
    createSurface: {
      surfaceId: 'cortex-demo',
      catalogId: cortexA2uiCatalog.id,
    },
  },
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId: 'cortex-demo',
      components: [
        // Root layout container (basic catalog component).
        { id: 'root', component: 'Column', children: ['status-card'], weight: 1 },

        // Cortex-branded status card with header + body children.
        {
          id: 'status-card',
          component: 'CortexCard',
          title: { path: '/agent/title' },
          subtitle: { path: '/agent/subtitle' },
          accent: 'cyan',
          children: ['metric-row', 'badge-row', 'action-row'],
        },

        // Two CortexMetric readouts side by side (basic Row layout).
        {
          id: 'metric-row',
          component: 'Row',
          children: ['metric-signals', 'metric-latency'],
          justify: 'start',
          align: 'stretch',
        },
        {
          id: 'metric-signals',
          component: 'CortexMetric',
          label: 'Signals/sec',
          value: { path: '/metrics/signalsPerSec' },
          unit: { path: '/metrics/signalsUnit' },
          tone: 'cyan',
        },
        {
          id: 'metric-latency',
          component: 'CortexMetric',
          label: 'Neural latency',
          value: { path: '/metrics/latencyMs' },
          unit: 'ms',
          tone: 'emerald',
        },

        // Status badge row.
        {
          id: 'badge-row',
          component: 'Row',
          children: ['badge-state'],
          justify: 'start',
        },
        {
          id: 'badge-state',
          component: 'CortexBadge',
          text: { path: '/agent/state' },
          tone: 'violet',
        },

        // Action button row — action.name is emitted back to the agent runtime.
        {
          id: 'action-row',
          component: 'Row',
          children: ['btn-approve'],
          justify: 'end',
        },
        {
          id: 'btn-approve',
          component: 'CortexButton',
          label: { path: '/actions/approveLabel' },
          variant: 'primary',
          action: {
            event: {
              name: 'cortex.demo.approve',
              context: { surface: 'cortex-demo', initiatedBy: 'a2ui-demo' },
            },
          },
        },
      ],
    },
  },
  {
    version: 'v0.9',
    updateDataModel: {
      surfaceId: 'cortex-demo',
      path: '/',
      value: {
        agent: {
          title: 'CORTEX // AGENT STATUS',
          subtitle: 'surface cortex-demo · catalog cortex/v0.9',
          state: 'REASONING',
        },
        metrics: {
          signalsPerSec: '1,284',
          signalsUnit: 'evt/s',
          latencyMs: '42',
        },
        actions: {
          approveLabel: 'Authorize surface',
        },
      },
    },
  },
];

export function A2uiDemoPanel() {
  return (
    <CortexA2uiSurface
      messages={A2UI_DEMO_MESSAGES}
      surfaceId="cortex-demo"
      title="A2UI // GENERATIVE SURFACE"
      statusLabel="demo"
      // DEMO DATA: log actions to the console; no backend is wired.
      onAction={action => {
        console.info('[A2uiDemoPanel] agent action:', action.name, action.context);
      }}
    />
  );
}

export default A2uiDemoPanel;
