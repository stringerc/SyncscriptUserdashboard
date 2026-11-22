/**
 * CortexFoundryGoalCard — goal row for the Foundry GOALS tab.
 *
 * LifeGoal carries `signals` + `history` (weekly signal samples) and an
 * optional `driftScore`. There is no target value, so progress is shown
 * honestly as a signal sparkline + drift bar rather than a fake percentage.
 *
 * Expandable detail: plan STEPS (checkboxes, persisted via
 * CortexGoals.updateDetails) and RESOURCES (add/remove).
 */

import { useState } from 'react';
import type { LifeGoal } from '../../lib/cortex-goals';
import { getCortexGoals } from '../../lib/cortex-goals';

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
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const [addingStep, setAddingStep] = useState(false);
  const [stepName, setStepName] = useState('');
  const [addingRes, setAddingRes] = useState(false);
  const [resName, setResName] = useState('');

  const signal = goal.signals?.[0];
  const series = signal
    ? goal.history.map(h => h.values?.[signal]).filter((v): v is number => typeof v === 'number').slice(-8)
    : [];
  const drift = typeof goal.driftScore === 'number' ? Math.round(goal.driftScore * 100) : null;
  const steps = goal.steps || [];
  const resources = goal.resources || [];
  const stepPct = steps.length ? Math.round((steps.filter(s => s.completed).length / steps.length) * 100) : null;

  const patch = (fn: (g: LifeGoal) => { steps?: LifeGoal['steps']; resources?: LifeGoal['resources'] }) => {
    const cur = getCortexGoals().get(goal.id);
    if (!cur) return;
    const p = fn(cur);
    getCortexGoals().updateDetails(goal.id, p);
    setTick(t => t + 1);
  };
  const toggleStep = (id: string) =>
    patch(g => ({ steps: (g.steps || []).map(s => s.id === id ? { ...s, completed: !s.completed } : s) }));
  const addStep = () => {
    const title = stepName.trim(); if (!title) return;
    patch(g => ({ steps: [...(g.steps || []), { id: `gst-${Date.now()}`, title, completed: false }] }));
    setStepName(''); setAddingStep(false);
  };
  const removeStep = (id: string) =>
    patch(g => ({ steps: (g.steps || []).filter(s => s.id !== id) }));
  const addResource = () => {
    const name = resName.trim(); if (!name) return;
    patch(g => ({ resources: [...(g.resources || []), { id: `gres-${Date.now()}`, name }] }));
    setResName(''); setAddingRes(false);
  };
  const removeResource = (id: string) =>
    patch(g => ({ resources: (g.resources || []).filter(r => r.id !== id) }));

  return (
    <div style={{ border: '1px solid rgba(56,189,248,0.14)', borderRadius: 3, margin: '3px 0', background: 'rgba(56,189,248,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <span style={{ color: INK, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>{goal.title}</span>
        {series.length >= 2 && <Spark values={series} />}
        {stepPct != null && stepPct > 0 && stepPct < 100 && (
          <span style={{ fontSize: 8, color: '#7dd3fc', minWidth: 30, textAlign: 'right' }}>{stepPct}%</span>
        )}
        <span style={{ fontSize: 8.5, color: DIM, whiteSpace: 'nowrap' }}>{goal.horizon.toUpperCase()} · {goal.status.toUpperCase()}</span>
        {goal.targetDate && <span style={{ fontSize: 9, color: DIM }}>{new Date(goal.targetDate).toLocaleDateString()}</span>}
        <span style={{ fontSize: 8, color: DIM }}>{open ? '▾' : '▸'}</span>
      </div>
      {stepPct != null && stepPct > 0 && stepPct < 100 && (
        <div style={{ height: 3, background: 'rgba(148,163,184,0.12)', margin: '0 8px 4px', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${stepPct}%`, background: 'linear-gradient(90deg,#38bdf8,#67e8f9)', borderRadius: 2, transition: 'width 0.4s' }} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 4px' }}>
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
      {open && (
        <div onClick={e => e.stopPropagation()} style={{ padding: '2px 10px 8px', fontSize: 9.5, color: DIM, lineHeight: 1.6 }}>
          <div style={{ margin: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', color: '#7dd3fc' }}>STEPS</span>
              <button onClick={() => setAddingStep(a => !a)} style={{ background: 'none', border: '1px solid rgba(125,211,252,0.4)', color: '#7dd3fc', fontFamily: MONO, fontSize: 8, padding: '0 6px', borderRadius: 2, cursor: 'pointer' }}>+ ADD STEP</button>
            </div>
            {steps.map((s: any) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={!!s.completed} onChange={() => toggleStep(s.id)} style={{ accentColor: '#38bdf8' }} />
                  <span style={{ textDecoration: s.completed ? 'line-through' : 'none', opacity: s.completed ? 0.5 : 1 }}>{s.title}</span>
                </label>
                <button onClick={() => removeStep(s.id)} style={{ background: 'none', border: 'none', color: '#fb7185', fontSize: 9, cursor: 'pointer', padding: '0 2px' }}>✕</button>
              </div>
            ))}
            {!steps.length && !addingStep && <div style={{ opacity: 0.6 }}>no steps yet</div>}
            {addingStep && (
              <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                <input value={stepName} onChange={e => setStepName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addStep()}
                  placeholder="step description…" autoFocus
                  style={{ flex: 1, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(125,211,252,0.4)', color: INK, fontFamily: MONO, fontSize: 9, padding: '2px 6px', borderRadius: 2, outline: 'none' }} />
                <button onClick={addStep} style={{ background: 'rgba(56,189,248,0.2)', border: '1px solid #7dd3fc', color: '#bae6fd', fontFamily: MONO, fontSize: 8, padding: '0 8px', borderRadius: 2, cursor: 'pointer' }}>ADD</button>
              </div>
            )}
          </div>
          <div style={{ margin: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', color: '#a78bfa' }}>RESOURCES</span>
              <button onClick={() => setAddingRes(a => !a)} style={{ background: 'none', border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa', fontFamily: MONO, fontSize: 8, padding: '0 6px', borderRadius: 2, cursor: 'pointer' }}>+ ADD</button>
            </div>
            {resources.map((r: any) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 0' }}>
                <span style={{ flex: 1 }}>· {r.name}{r.type ? ` (${r.type})` : ''}</span>
                <button onClick={() => removeResource(r.id)} style={{ background: 'none', border: 'none', color: '#fb7185', fontSize: 9, cursor: 'pointer', padding: '0 2px' }}>✕</button>
              </div>
            ))}
            {!resources.length && !addingRes && <div style={{ opacity: 0.6 }}>none attached</div>}
            {addingRes && (
              <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                <input value={resName} onChange={e => setResName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addResource()}
                  placeholder="resource name / link…" autoFocus
                  style={{ flex: 1, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(167,139,250,0.4)', color: INK, fontFamily: MONO, fontSize: 9, padding: '2px 6px', borderRadius: 2, outline: 'none' }} />
                <button onClick={addResource} style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid #a78bfa', color: '#c4b5fd', fontFamily: MONO, fontSize: 8, padding: '0 8px', borderRadius: 2, cursor: 'pointer' }}>ADD</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
