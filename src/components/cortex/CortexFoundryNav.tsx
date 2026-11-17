/**
 * CortexFoundryNav — left-rail mission navigation for the Foundry deck.
 *
 * Slim icon rail on the far left edge; selecting a section opens a
 * docked panel fed by live sources:
 *   dashboard → Mission Control tower board
 *   tasks     → agent task ledger (live snap)
 *   goals     → life-goal model (cortex-goals, localStorage-backed)
 *   calendar  → /api/cortex/calendar/upcoming
 *   agents    → fleet roster grid (live snap)
 *   incidents → /api/cortex/agents/incidents
 *   pipeline  → /api/cortex/distribution/status
 */

import React, { useEffect, useRef, useState } from 'react';
import type { AgentsSnapshotClient, AgentClient, AgentTaskClient } from '../../lib/cortex-agents-client';
import { getCortexGoals, type LifeGoal } from '../../lib/cortex-goals';
import { CortexTowerPanel } from './CortexTowerPanel';

const MONO = "'IBM Plex Mono', monospace";
const INK = '#e0f2fe';
const DIM = 'rgba(148,163,184,0.55)';

type FoundryView = 'dashboard' | 'tasks' | 'goals' | 'calendar' | 'agents' | 'incidents' | 'pipeline';

const NAV_ITEMS: { id: FoundryView; glyph: string; label: string; hint: string }[] = [
  { id: 'dashboard', glyph: '◈', label: 'DASHBOARD', hint: 'Mission Control tower board' },
  { id: 'tasks', glyph: '▤', label: 'TASKS', hint: 'Agent task ledger' },
  { id: 'goals', glyph: '◎', label: 'GOALS', hint: 'Life-goal model & drift' },
  { id: 'calendar', glyph: '▦', label: 'CALENDAR', hint: 'Upcoming events (48h)' },
  { id: 'agents', glyph: '✦', label: 'AGENTS', hint: 'Fleet roster' },
  { id: 'incidents', glyph: '⚠', label: 'INCIDENTS', hint: 'Failure ticket ledger' },
  { id: 'pipeline', glyph: '⇶', label: 'PIPELINE', hint: 'Distribution / product flow' },
];

const STATUS_COLOR: Record<string, string> = {
  running: '#34d399', working: '#34d399', queued: '#fbbf24',
  completed: '#67e8f9', failed: '#f87171', error: '#f87171',
  cancelled: '#64748b', resolved: '#34d399', open: '#f87171',
  healthy: '#34d399', degraded: '#fbbf24', down: '#f87171', idle: '#64748b',
};

function Lamp({ status }: { status: string }) {
  const c = STATUS_COLOR[status] || DIM;
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, boxShadow: c === '#34d399' ? `0 0 5px ${c}` : 'none', flexShrink: 0 }} />;
}

function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', left: 64, top: '50%', transform: 'translateY(-50%)', zIndex: 6,
      width: 460, maxWidth: 'calc(100vw - 320px)', maxHeight: '78vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(165deg, rgba(8,14,24,0.94), rgba(5,8,15,0.9))',
      border: '1px solid rgba(103,232,249,0.22)', borderLeft: '3px solid #38bdf8', borderRadius: 3,
      padding: '12px 14px', fontFamily: MONO, backdropFilter: 'blur(10px)',
      boxShadow: '0 0 40px rgba(0,0,0,0.6)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.3em', color: '#67e8f9', fontWeight: 700 }}>{title}</span>
        {right}
      </div>
      <div className="ambient-scrollbar" style={{ overflowY: 'auto', flex: 1, minHeight: 0, fontSize: 9, color: DIM, lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}

const Row: React.FC<{ children: React.ReactNode; border?: boolean }> = ({ children, border = true }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', borderBottom: border ? '1px solid rgba(148,163,184,0.07)' : 'none' }}>
    {children}
  </div>
);

interface Props {
  snap: AgentsSnapshotClient;
  onSelectAgent: (id: string | null) => void;
  selectedAgent: string | null;
  onOpenTower: () => void;
}

export function CortexFoundryNav({ snap, onSelectAgent, selectedAgent, onOpenTower }: Props) {
  const [view, setView] = useState<FoundryView | null>(null);
  const [calendar, setCalendar] = useState<any[] | null>(null);
  const [incidents, setIncidents] = useState<any[] | null>(null);
  const [pipeline, setPipeline] = useState<any | null>(null);
  const [, setGoalsTick] = useState(0);
  const goals = getCortexGoals();
  const goalsUnsub = useRef<(() => void) | null>(null);

  useEffect(() => () => goalsUnsub.current?.(), []);

  // Lazy-fetch section data when its view opens.
  useEffect(() => {
    if (view === 'calendar' && calendar === null) {
      fetch('/api/cortex/calendar/upcoming', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setCalendar(Array.isArray(d?.events) ? d.events : []))
        .catch(() => setCalendar([]));
    }
    if (view === 'incidents' && incidents === null) {
      fetch('/api/cortex/agents/incidents', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setIncidents(Array.isArray(d?.incidents) ? d.incidents : []))
        .catch(() => setIncidents([]));
    }
    if (view === 'pipeline' && pipeline === null) {
      fetch('/api/cortex/distribution/status', { cache: 'no-store' })
        .then((r) => r.json())
        .then(setPipeline)
        .catch(() => setPipeline({ error: true }));
    }
    if (view === 'goals') {
      goalsUnsub.current?.();
      goalsUnsub.current = goals.subscribe(() => setGoalsTick((t) => t + 1));
      setGoalsTick((t) => t + 1);
    } else {
      goalsUnsub.current?.(); goalsUnsub.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const agents = snap.agents || [];
  const tasks = (snap.tasks || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const goalList: LifeGoal[] = goals.list();

  const select = (id: FoundryView) => {
    if (id === 'dashboard') { setView(null); onOpenTower(); return; }
    setView((v) => (v === id ? null : id));
  };

  return (
    <>
      {/* Left nav rail */}
      <div style={{
        position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 7,
        width: 48, display: 'flex', flexDirection: 'column', gap: 3,
        fontFamily: MONO,
      }}>
        {NAV_ITEMS.map((n) => {
          const active = view === n.id;
          return (
            <button
              key={n.id}
              onClick={() => select(n.id)}
              title={`${n.label} — ${n.hint}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                padding: '6px 2px', cursor: 'pointer',
                background: active ? 'rgba(56,189,248,0.14)' : 'rgba(4,8,18,0.72)',
                border: `1px solid ${active ? 'rgba(56,189,248,0.55)' : 'rgba(103,232,249,0.16)'}`,
                borderRadius: 3, color: active ? '#7dd3fc' : 'rgba(165,243,252,0.65)',
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>{n.glyph}</span>
              <span style={{ fontSize: 6, letterSpacing: '0.12em', fontWeight: 700 }}>{n.label.slice(0, 4)}</span>
            </button>
          );
        })}
      </div>

      {/* Section panels */}
      {view === 'tasks' && (
        <Panel title="TASK LEDGER" right={<span style={{ fontSize: 8, color: DIM }}>{tasks.length} RECENT</span>}>
          {tasks.slice(0, 40).map((t: AgentTaskClient) => (
            <Row key={t.id}>
              <Lamp status={t.status} />
              <span style={{ color: 'rgba(165,243,252,0.85)', minWidth: 70 }}>{t.agentId.toUpperCase()}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
              <span style={{ color: STATUS_COLOR[t.status] || DIM, fontSize: 8 }}>{t.status.toUpperCase()}</span>
            </Row>
          ))}
          {!tasks.length && <div style={{ padding: '12px 0', color: DIM }}>NO TASKS RECORDED</div>}
        </Panel>
      )}

      {view === 'goals' && (
        <Panel title="LIFE GOALS" right={<span style={{ fontSize: 8, color: DIM }}>{goalList.length} DECLARED</span>}>
          {goalList.map((g) => (
            <Row key={g.id}>
              <Lamp status={g.status === 'active' ? 'healthy' : g.status === 'achieved' ? 'completed' : 'idle'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</div>
                <div style={{ fontSize: 7.5, color: DIM }}>{g.horizon.toUpperCase()} · {g.status.toUpperCase()}{g.driftScore != null ? ` · DRIFT ${Math.round(g.driftScore * 100)}%` : ''}</div>
              </div>
              {g.targetDate && <span style={{ fontSize: 7.5, color: DIM }}>{new Date(g.targetDate).toLocaleDateString()}</span>}
            </Row>
          ))}
          {!goalList.length && <div style={{ padding: '12px 0', color: DIM }}>NO GOALS DECLARED — USE VOICE: "set a goal to …"</div>}
        </Panel>
      )}

      {view === 'calendar' && (
        <Panel title="CALENDAR — NEXT 48H" right={calendar === null ? <span style={{ fontSize: 8, color: DIM }}>LOADING…</span> : undefined}>
          {(calendar || []).slice(0, 20).map((e: any, i: number) => (
            <Row key={e.id || i}>
              <span style={{ color: '#fbbf24', minWidth: 78, fontSize: 8 }}>{e.start ? new Date(e.start).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: INK }}>{e.title || '(untitled)'}</span>
            </Row>
          ))}
          {calendar !== null && !calendar.length && <div style={{ padding: '12px 0', color: DIM }}>NO EVENTS IN WINDOW — CLIENT HASN'T PUSHED CALENDAR YET</div>}
        </Panel>
      )}

      {view === 'agents' && (
        <Panel title="FLEET ROSTER" right={<span style={{ fontSize: 8, color: DIM }}>{agents.length} REGISTERED</span>}>
          {agents.map((a: AgentClient) => (
            <Row key={a.id}>
              <Lamp status={a.status} />
              <button
                onClick={() => { onSelectAgent(selectedAgent === a.id ? null : a.id); }}
                style={{
                  flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: selectedAgent === a.id ? '#7dd3fc' : INK, fontFamily: MONO, fontSize: 9,
                }}
              >
                {a.name} <span style={{ color: DIM, fontSize: 7.5 }}>· {a.status.toUpperCase()}</span>
              </button>
              <span style={{ fontSize: 7.5, color: DIM }}>{a.tasksCompleted}✓ {a.tasksFailed}✗</span>
            </Row>
          ))}
          {!agents.length && <div style={{ padding: '12px 0', color: DIM }}>NO AGENTS — RUNTIME OFFLINE?</div>}
        </Panel>
      )}

      {view === 'incidents' && (
        <Panel title="INCIDENT LEDGER" right={incidents === null ? <span style={{ fontSize: 8, color: DIM }}>LOADING…</span> : <span style={{ fontSize: 8, color: DIM }}>{incidents.filter((i) => i.status === 'open').length} OPEN</span>}>
          {(incidents || []).slice(0, 20).map((i: any) => (
            <Row key={i.id}>
              <Lamp status={i.status === 'open' ? 'failed' : 'resolved'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: i.status === 'open' ? '#fca5a5' : DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</div>
                <div style={{ fontSize: 7.5, color: DIM }}>{i.agentId?.toUpperCase()} · {i.kind} · ×{i.count} · {i.ageHours ?? '?'}h</div>
              </div>
            </Row>
          ))}
          {incidents !== null && !incidents.length && <div style={{ padding: '12px 0', color: DIM }}>NO INCIDENTS ON RECORD</div>}
        </Panel>
      )}

      {view === 'pipeline' && (
        <Panel title="DISTRIBUTION PIPELINE">
          {pipeline === null && <div style={{ padding: '12px 0', color: DIM }}>LOADING…</div>}
          {pipeline && !pipeline.error && (
            <pre style={{ fontSize: 8, color: DIM, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {JSON.stringify(pipeline, null, 1).slice(0, 3000)}
            </pre>
          )}
          {pipeline?.error && <div style={{ padding: '12px 0', color: '#f87171' }}>PIPELINE STATUS UNREACHABLE</div>}
        </Panel>
      )}
    </>
  );
}
