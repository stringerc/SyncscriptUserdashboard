/**
 * CortexFoundryGoalCard — goal row for the Foundry GOALS tab.
 *
 * LifeGoal carries `signals` + `history` (weekly signal samples) and an
 * optional `driftScore`. There is no target value, so progress is shown
 * honestly as a signal sparkline + drift bar rather than a fake percentage.
 */

import type { LifeGoal } from '../../lib/cortex-goals';

const MONO = "'IBM Plex Mono', monospace";
const INK = '#e0f2fe';
const DIM = 'rgba(148,163,184,0.55)';
const CYAN = '#38bdf8';

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const w = 64, h = 18;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block', opacity: 0.9 }}>
      <polyline points={pts} fill="none" stroke={CYAN} strokeWidth="1.2" />
    </svg>
  );
}

export function CortexFoundryGoalCard({ goal }: { goal: LifeGoal }) {
  const signal = goal.signals?.[0];
  const series = signal
    ? goal.history.map(h => h.values?.[signal]).filter((v): v is number => typeof v === 'number').slice(-8)
    : [];
  const drift = typeof goal.driftScore === 'number' ? Math.round(goal.driftScore * 100) : null;

  return (
    <div style={{ border: '1px solid rgba(56,189,248,0.14)', borderRadius: 3, margin: '3px 0', padding: '5px 8px', background: 'rgba(56,189,248,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: INK, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>{goal.title}</span>
        {series.length >= 2 && <Spark values={series} />}
        <span style={{ fontSize: 8.5, color: DIM, whiteSpace: 'nowrap' }}>{goal.horizon.toUpperCase()} · {goal.status.toUpperCase()}</span>
        {goal.targetDate && <span style={{ fontSize: 9, color: DIM }}>{new Date(goal.targetDate).toLocaleDateString()}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
        {signal && <span style={{ fontSize: 8, color: 'rgba(125,211,252,0.7)', fontFamily: MONO }}>{signal}: {series.length ? series[series.length - 1].toFixed(1) : '—'}</span>}
        {drift != null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: drift > 30 ? '#f87171' : drift > 15 ? '#fbbf24' : '#34d399' }}>
            DRIFT {drift}%
            <span style={{ width: 48, height: 3, background: 'rgba(148,163,184,0.15)', borderRadius: 2, display: 'inline-block' }}>
              <span style={{ display: 'block', height: '100%', width: `${Math.min(100, drift)}%`, background: drift > 30 ? '#f87171' : drift > 15 ? '#fbbf24' : '#34d399', borderRadius: 2 }} />
            </span>
          </span>
        )}
        {goal.signals?.length ? <span style={{ fontSize: 8, color: DIM }}>{goal.signals.length} SIGNAL{goal.signals.length > 1 ? 'S' : ''}</span> : null}
      </div>
    </div>
  );
}
