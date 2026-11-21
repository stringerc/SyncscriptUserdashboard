/**
 * CortexFoundryTaskCard — rich user-task card for the Foundry TASKS tab.
 *
 * Ports the TasksGoalsPage capabilities into the visualizer surface:
 *   - progress bar (explicit progress, else derived from milestones/subtasks)
 *   - expandable milestones & subtasks with completion toggles
 *   - resource list + inline "add resource"
 *   - RECOMMEND NEXT strip scored on priority × due-date urgency × momentum
 *
 * Mutations (milestone/subtask toggles, resource adds) persist to a
 * localStorage override layer (`cortex:task-overrides:v1`) keyed by task id —
 * Foundry-local until a real mutation API exists; the app mirror keeps
 * overwriting snapshot data, so overrides apply on top at render time.
 */

import { useMemo, useState } from 'react';

const MONO = "'IBM Plex Mono', monospace";
const INK = '#e0f2fe';
const DIM = 'rgba(148,163,184,0.55)' ;
const AMBER = '#fcd34d';

const OVERRIDE_KEY = 'cortex:task-overrides:v1';

type Overrides = Record<string, {
  milestoneDone?: Record<string, boolean>;
  subtaskDone?: Record<string, boolean>;
  resources?: { id: string; name: string; type?: string }[];
}>;

function loadOverrides(): Overrides {
  try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}'); } catch { return {}; }
}
function saveOverrides(o: Overrides) {
  try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o)); } catch {}
}

function progressOf(t: any): number {
  if (typeof t.progress === 'number') return Math.max(0, Math.min(100, Math.round(t.progress)));
  const ms = t.milestones || [], ss = t.subtasks || [];
  const items = [...ms, ...ss];
  if (!items.length) return t.completed ? 100 : 0;
  const done = items.filter((i: any) => i.completed).length;
  return Math.round((done / items.length) * 100);
}

const PRIORITY_W: Record<string, number> = { urgent: 40, high: 30, medium: 18, low: 8 };

function recommendNext(tasks: any[]): any | null {
  const open = tasks.filter(t => !t.completed && t.status !== 'completed');
  if (!open.length) return null;
  const now = Date.now();
  const scored = open.map(t => {
    let score = PRIORITY_W[String(t.priority || '').toLowerCase()] ?? 10;
    const due = t.dueDate ? Date.parse(t.dueDate) : NaN;
    if (!Number.isNaN(due)) {
      const days = (due - now) / 86400000;
      if (days < 0) score += 35; else if (days <= 1) score += 28; else if (days <= 3) score += 18; else if (days <= 7) score += 8;
    }
    const p = progressOf(t);
    if (p > 0 && p < 100) score += 12; // momentum: started but unfinished
    if (t.status === 'in-progress') score += 10;
    return { t, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.t ?? null;
}

export function CortexFoundryTaskCard({ task }: { task: any }) {
  const [open, setOpen] = useState(false);
  const [ov, setOv] = useState<Overrides>(() => loadOverrides());
  const [addingRes, setAddingRes] = useState(false);
  const [resName, setResName] = useState('');

  const o = ov[task.id] || {};
  const msDone = { ...(Object.fromEntries((task.milestones || []).map((m: any) => [m.id, !!m.completed]))), ...(o.milestoneDone || {}) };
  const ssDone = { ...(Object.fromEntries((task.subtasks || []).map((s: any) => [s.id, !!s.completed]))), ...(o.subtaskDone || {}) };
  const resources = [...(task.resources || []), ...(o.resources || [])];
  const pct = progressOf({ ...task, milestones: (task.milestones || []).map((m: any) => ({ ...m, completed: msDone[m.id] })), subtasks: (task.subtasks || []).map((s: any) => ({ ...s, completed: ssDone[s.id] })) });

  const mutate = (fn: (cur: Overrides) => Overrides) => {
    setOv(prev => { const next = fn(prev); saveOverrides(next); return next; });
  };
  const toggleMs = (id: string, cur: boolean) =>
    mutate(p => ({ ...p, [task.id]: { ...p[task.id], milestoneDone: { ...(p[task.id]?.milestoneDone || {}), [id]: !cur } } }));
  const toggleSs = (id: string, cur: boolean) =>
    mutate(p => ({ ...p, [task.id]: { ...p[task.id], subtaskDone: { ...(p[task.id]?.subtaskDone || {}), [id]: !cur } } }));
  const addResource = () => {
    const name = resName.trim(); if (!name) return;
    mutate(p => ({ ...p, [task.id]: { ...p[task.id], resources: [...(p[task.id]?.resources || []), { id: `res-${Date.now()}`, name }] } }));
    setResName(''); setAddingRes(false);
  };

  const hasDetail = (task.milestones || []).length + (task.subtasks || []).length + resources.length > 0 || !!task.description;

  return (
    <div style={{ border: '1px solid rgba(251,191,36,0.14)', borderRadius: 3, margin: '3px 0', background: 'rgba(251,191,36,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', cursor: hasDetail ? 'pointer' : 'default' }} onClick={() => hasDetail && setOpen(o => !o)}>
        <span style={{ color: AMBER, fontSize: 9, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: task.completed ? 'line-through' : 'none', opacity: task.completed ? 0.5 : 1 }}>{task.title}</span>
        {pct > 0 && pct < 100 && (
          <span style={{ fontSize: 8, color: '#7dd3fc', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
        )}
        <span style={{ fontSize: 8, color: task.completed ? '#34d399' : DIM }}>{task.completed ? 'DONE' : (task.status || 'OPEN').toUpperCase()}</span>
        {hasDetail && <span style={{ fontSize: 8, color: DIM }}>{open ? '▾' : '▸'}</span>}
      </div>
      {/* progress bar */}
      {pct > 0 && pct < 100 && (
        <div style={{ height: 3, background: 'rgba(148,163,184,0.12)', margin: '0 8px 4px', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#38bdf8,#67e8f9)', borderRadius: 2, transition: 'width 0.4s' }} />
        </div>
      )}
      {open && (
        <div style={{ padding: '2px 10px 8px', fontSize: 9.5, color: DIM, lineHeight: 1.6 }}>
          {task.description && <div style={{ marginBottom: 4, color: 'rgba(224,242,254,0.7)' }}>{task.description}</div>}
          {(task.milestones || []).length > 0 && (
            <div style={{ margin: '4px 0' }}>
              <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', color: AMBER, marginBottom: 2 }}>MILESTONES</div>
              {[...task.milestones].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)).map((m: any) => (
                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!msDone[m.id]} onChange={() => toggleMs(m.id, !!msDone[m.id])} style={{ accentColor: '#38bdf8' }} />
                  <span style={{ textDecoration: msDone[m.id] ? 'line-through' : 'none', opacity: msDone[m.id] ? 0.5 : 1 }}>{m.title}</span>
                </label>
              ))}
            </div>
          )}
          {(task.subtasks || []).length > 0 && (
            <div style={{ margin: '4px 0' }}>
              <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', color: '#7dd3fc', marginBottom: 2 }}>STEPS</div>
              {task.subtasks.map((s: any) => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!ssDone[s.id]} onChange={() => toggleSs(s.id, !!ssDone[s.id])} style={{ accentColor: '#38bdf8' }} />
                  <span style={{ textDecoration: ssDone[s.id] ? 'line-through' : 'none', opacity: ssDone[s.id] ? 0.5 : 1 }}>{s.title}</span>
                </label>
              ))}
            </div>
          )}
          <div style={{ margin: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', color: '#a78bfa' }}>RESOURCES</span>
              <button onClick={() => setAddingRes(a => !a)} style={{ background: 'none', border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa', fontFamily: MONO, fontSize: 8, padding: '0 6px', borderRadius: 2, cursor: 'pointer' }}>+ ADD</button>
            </div>
            {resources.map((r: any) => (
              <div key={r.id || r.name} style={{ padding: '1px 0' }}>· {r.name}{r.type ? ` (${r.type})` : ''}</div>
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

export function RecommendNextStrip({ tasks }: { tasks: any[] }) {
  const pick = useMemo(() => recommendNext(tasks), [tasks]);
  if (!pick) return null;
  const pct = progressOf(pick);
  return (
    <div style={{ border: '1px solid rgba(56,189,248,0.35)', borderLeft: '3px solid #38bdf8', borderRadius: 3, padding: '6px 9px', marginBottom: 8, background: 'rgba(56,189,248,0.05)' }}>
      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.2em', color: '#7dd3fc', marginBottom: 2 }}>⚡ RECOMMEND NEXT</div>
      <div style={{ fontSize: 10, color: INK }}>{pick.title}</div>
      <div style={{ fontSize: 8.5, color: DIM, marginTop: 2 }}>
        {(pick.priority || 'medium')} priority{pct > 0 ? ` · ${pct}% done — momentum favors finishing` : ''}
        {pick.dueDate ? ` · due ${new Date(pick.dueDate).toLocaleDateString()}` : ''}
      </div>
    </div>
  );
}
