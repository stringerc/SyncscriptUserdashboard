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

type FoundryView = 'dashboard' | 'tasks' | 'goals' | 'calendar' | 'agents' | 'counsel' | 'inbox' | 'incidents' | 'pipeline';

const NAV_ITEMS: { id: FoundryView; glyph: string; label: string; hint: string }[] = [
  { id: 'dashboard', glyph: '◈', label: 'DASHBOARD', hint: 'Mission Control tower board' },
  { id: 'tasks', glyph: '▤', label: 'TASKS', hint: 'Agent task ledger' },
  { id: 'goals', glyph: '◎', label: 'GOALS', hint: 'Life-goal model & drift' },
  { id: 'calendar', glyph: '▦', label: 'CALENDAR', hint: 'Upcoming events (48h)' },
  { id: 'agents', glyph: '✦', label: 'AGENTS', hint: 'Mission Control roster' },
  { id: 'counsel', glyph: '⚖', label: 'COUNSEL', hint: 'Go/No-Go deliberation polls' },
  { id: 'inbox', glyph: '✉', label: 'INBOX', hint: 'Proposals awaiting your decision' },
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
      position: 'absolute', left: 80, top: '50%', transform: 'translateY(-50%)', zIndex: 6,
      width: 490, maxWidth: 'calc(100vw - 360px)', maxHeight: '78vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(165deg, rgba(8,14,24,0.94), rgba(5,8,15,0.9))',
      border: '1px solid rgba(103,232,249,0.22)', borderLeft: '3px solid #38bdf8', borderRadius: 3,
      padding: '12px 14px', fontFamily: MONO, backdropFilter: 'blur(10px)',
      boxShadow: '0 0 40px rgba(0,0,0,0.6)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 12, letterSpacing: '0.3em', color: '#67e8f9', fontWeight: 700 }}>{title}</span>
        {right}
      </div>
      <div className="ambient-scrollbar" style={{ overflowY: 'auto', flex: 1, minHeight: 0, fontSize: 10.5, color: DIM, lineHeight: 1.7 }}>
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
  const [counsel, setCounsel] = useState<{ sessions: any[]; consoles: any[] } | null>(null);
  const [inbox, setInbox] = useState<any[] | null>(null);
  const [inboxNote, setInboxNote] = useState('');
  const [tasksScope, setTasksScope] = useState<'today' | 'all'>('today');
  const [taskSource, setTaskSource] = useState<'all' | 'agents' | 'user'>('all');
  const [userTasks, setUserTasks] = useState<any[] | null>(null);
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

  // User-task mirror poll while the ledger view is open — the snapshot is
  // pushed by TasksContext; Foundry just reads it.
  useEffect(() => {
    if (view !== 'tasks') return;
    const load = () => {
      fetch('/api/cortex/tasks/snapshot', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setUserTasks(Array.isArray(d?.tasks) ? d.tasks : []))
        .catch(() => setUserTasks([]));
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [view]);

  // Counsel + inbox poll on their own cadence while their views are open.
  useEffect(() => {
    if (view !== 'counsel' && view !== 'inbox') return;
    const load = () => {
      if (view === 'counsel') {
        fetch('/api/cortex/counsel/sessions', { cache: 'no-store' })
          .then((r) => r.json())
          .then((d) => setCounsel({ sessions: d?.sessions || [], consoles: d?.consoles || [] }))
          .catch(() => {});
      } else {
        fetch('/api/cortex/agents/proposals?status=pending', { cache: 'no-store' })
          .then((r) => r.json())
          .then((d) => setInbox(Array.isArray(d?.proposals) ? d.proposals : []))
          .catch(() => {});
      }
    };
    load();
    const iv = setInterval(load, view === 'counsel' ? 8000 : 10000);
    return () => clearInterval(iv);
  }, [view]);

  const decideProposal = async (id: string, decision: 'approved' | 'dismissed') => {
    setInboxNote('');
    try {
      const r = await fetch('/api/cortex/agents/proposals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision }),
      });
      const j: any = await r.json().catch(() => null);
      if (!r.ok || j?.ok === false) setInboxNote(`DECISION FAILED: ${j?.error || r.status}`);
      else setInboxNote(decision === 'approved' ? `APPROVED — ${j?.note || 'dispatched'}` : 'DISMISSED');
      const d = await fetch('/api/cortex/agents/proposals?status=pending', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
      setInbox(Array.isArray(d?.proposals) ? d.proposals : []);
    } catch (e: any) {
      setInboxNote(`DECISION FAILED: ${e?.message || e}`);
    }
  };

  const decidePoll = async (sessionId: string, decision: 'go' | 'no-go') => {
    try {
      await fetch('/api/cortex/counsel/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide', sessionId, decision, by: 'foundry-nav' }),
      });
      const d = await fetch('/api/cortex/counsel/sessions', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      if (d) setCounsel({ sessions: d?.sessions || [], consoles: d?.consoles || [] });
    } catch {}
  };

  const agents = snap.agents || [];
  const allTasks = snap.tasks || [];

  // ── Task ledger dayparting ──
  // Today scope: only tasks created today, grouped Morning → Night.
  // All scope: history grouped by calendar day (newest first) then daypart.
  // Buckets by creation hour: morning 05-12, afternoon 12-17, evening 17-21,
  // night 21-05. Undated → 'anytime' last.
  const DAYPART_ORDER = ['morning', 'afternoon', 'evening', 'night', 'anytime'];
  const toMs = (v?: number | string | null): number => {
    if (v == null) return NaN;
    const t = typeof v === 'string' ? new Date(v).getTime() : v;
    return Number.isNaN(t) ? NaN : t;
  };
  const daypartOf = (ts?: number | string | null): string => {
    const t = toMs(ts);
    if (Number.isNaN(t)) return 'anytime';
    const h = new Date(t).getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  };
  const sameDay = (a?: number | string | null, b?: number | string | null) => {
    const ta = toMs(a), tb = toMs(b);
    if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
    const da = new Date(ta), db = new Date(tb);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
  };
  const dayKey = (ts?: number | string | null) => {
    const t = toMs(ts);
    if (Number.isNaN(t)) return 'undated';
    const d = new Date(t);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };
  const scopedTasks = tasksScope === 'today'
    ? allTasks.filter((t) => sameDay(t.createdAt, Date.now()))
    : allTasks;
  const taskGroupKey = (t: AgentTaskClient) =>
    tasksScope === 'today' ? daypartOf(t.createdAt) : `${dayKey(t.createdAt)}|${daypartOf(t.createdAt)}`;
  const tasks = scopedTasks.slice().sort((a, b) => {
    const ga = taskGroupKey(a), gb = taskGroupKey(b);
    if (ga !== gb) {
      if (tasksScope === 'today') return DAYPART_ORDER.indexOf(ga) - DAYPART_ORDER.indexOf(gb);
      // 'all': newest day first, then daypart order within the day
      const dayA = dayKey(a.createdAt), dayB = dayKey(b.createdAt);
      if (dayA !== dayB) return dayB.localeCompare(dayA);
      return DAYPART_ORDER.indexOf(ga.split('|')[1]) - DAYPART_ORDER.indexOf(gb.split('|')[1]);
    }
    return (b.createdAt || 0) - (a.createdAt || 0); // newest first within group
  });
  const todayCount = allTasks.filter((t) => sameDay(t.createdAt, Date.now())).length;
  const groupLabel = (t: AgentTaskClient) => {
    const dp = daypartOf(t.createdAt);
    const dpStr = dp === 'anytime' ? 'ANY TIME' : dp.toUpperCase();
    if (tasksScope === 'today') return dpStr;
    if (!t.createdAt) return `UNDATED · ${dpStr}`;
    const d = new Date(t.createdAt);
    const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return `${dateStr} · ${dpStr}`;
  };
  // ── User tasks (Chris's tasks) — mirrored snapshot, ISO date strings ──
  const userList: any[] = userTasks || [];
  const userGroupKey = (t: any) => {
    const ts = t?.createdAt || t?.dueDate;
    const dp = daypartOf(ts);
    return tasksScope === 'today' ? dp : `${dayKey(ts)}|${dp}`;
  };
  const userLedger = userList
    .filter((t) => tasksScope === 'all' || sameDay(t.createdAt || t.dueDate, Date.now()))
    .slice()
    .sort((a, b) => {
      const ga = userGroupKey(a), gb = userGroupKey(b);
      if (ga !== gb) {
        if (tasksScope === 'today') return DAYPART_ORDER.indexOf(ga) - DAYPART_ORDER.indexOf(gb);
        const dayA = dayKey(a.createdAt || a.dueDate), dayB = dayKey(b.createdAt || b.dueDate);
        if (dayA !== dayB) return dayB.localeCompare(dayA);
        return DAYPART_ORDER.indexOf(ga.split('|')[1]) - DAYPART_ORDER.indexOf(gb.split('|')[1]);
      }
      return toMs(b.createdAt || b.dueDate) - toMs(a.createdAt || a.dueDate);
    });
  const userGroupLabel = (t: any) => {
    const ts = t?.createdAt || t?.dueDate;
    const dp = daypartOf(ts);
    const dpStr = dp === 'anytime' ? 'ANY TIME' : dp.toUpperCase();
    if (tasksScope === 'today') return dpStr;
    const tms = toMs(ts);
    if (Number.isNaN(tms)) return `UNDATED · ${dpStr}`;
    return `${new Date(tms).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${dpStr}`;
  };
  // UP NEXT — today's plan: mission blocks + pending user tasks due/created today.
  const upcomingBlocks = (snap.mission?.upcomingBlocks || [])
    .filter((b) => sameDay(b.start, Date.now()))
    .sort((a, b) => a.start - b.start);
  const userPendingToday = userList.filter((t) =>
    !t.completed && (sameDay(t.dueDate, Date.now()) || (!t.dueDate && sameDay(t.createdAt, Date.now()))));

  const goalList: LifeGoal[] = goals.list();

  const select = (id: FoundryView) => {
    if (id === 'dashboard') { setView(null); onOpenTower(); return; }
    setView((v) => (v === id ? null : id));
  };

  return (
    <>
      {/* Left nav rail */}
      <div style={{
        position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', zIndex: 7,
        width: 62, display: 'flex', flexDirection: 'column', gap: 4,
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
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '9px 3px', cursor: 'pointer',
                background: active ? 'rgba(56,189,248,0.14)' : 'rgba(4,8,18,0.72)',
                border: `1px solid ${active ? 'rgba(56,189,248,0.55)' : 'rgba(103,232,249,0.16)'}`,
                borderRadius: 3, color: active ? '#7dd3fc' : 'rgba(165,243,252,0.65)',
              }}
            >
              <span style={{ fontSize: 19, lineHeight: 1 }}>{n.glyph}</span>
              <span style={{ fontSize: 9.5, letterSpacing: '0.04em', fontWeight: 700 }}>{n.label}</span>
            </button>
          );
        })}
      </div>

      {/* Section panels */}
      {view === 'tasks' && (
        <Panel title="TASK LEDGER" right={
          <span style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={() => setTaskSource('all')} style={{ background: taskSource === 'all' ? 'rgba(52,211,153,0.14)' : 'none', border: `1px solid ${taskSource === 'all' ? 'rgba(52,211,153,0.5)' : 'rgba(103,232,249,0.16)'}`, color: taskSource === 'all' ? '#6ee7b7' : DIM, fontFamily: MONO, fontSize: 8.5, padding: '1px 6px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.1em' }}>ALL</button>
            <button onClick={() => setTaskSource('agents')} style={{ background: taskSource === 'agents' ? 'rgba(56,189,248,0.16)' : 'none', border: `1px solid ${taskSource === 'agents' ? 'rgba(56,189,248,0.55)' : 'rgba(103,232,249,0.16)'}`, color: taskSource === 'agents' ? '#7dd3fc' : DIM, fontFamily: MONO, fontSize: 8.5, padding: '1px 6px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.1em' }}>AGENTS</button>
            <button onClick={() => setTaskSource('user')} style={{ background: taskSource === 'user' ? 'rgba(251,191,36,0.14)' : 'none', border: `1px solid ${taskSource === 'user' ? 'rgba(251,191,36,0.5)' : 'rgba(103,232,249,0.16)'}`, color: taskSource === 'user' ? '#fcd34d' : DIM, fontFamily: MONO, fontSize: 8.5, padding: '1px 6px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.1em' }}>USER</button>
            <span style={{ width: 6 }} />
            <button onClick={() => setTasksScope('today')} style={{ background: tasksScope === 'today' ? 'rgba(56,189,248,0.16)' : 'none', border: `1px solid ${tasksScope === 'today' ? 'rgba(56,189,248,0.55)' : 'rgba(103,232,249,0.16)'}`, color: tasksScope === 'today' ? '#7dd3fc' : DIM, fontFamily: MONO, fontSize: 9, padding: '1px 7px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.12em' }}>TODAY {todayCount}</button>
            <button onClick={() => setTasksScope('all')} style={{ background: tasksScope === 'all' ? 'rgba(56,189,248,0.16)' : 'none', border: `1px solid ${tasksScope === 'all' ? 'rgba(56,189,248,0.55)' : 'rgba(103,232,249,0.16)'}`, color: tasksScope === 'all' ? '#7dd3fc' : DIM, fontFamily: MONO, fontSize: 9, padding: '1px 7px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.12em' }}>ALL {allTasks.length + userList.length}</button>
          </span>
        }>
          {/* UP NEXT — today's plan: mission blocks + pending user tasks */}
          {(upcomingBlocks.length > 0 || userPendingToday.length > 0) && taskSource !== 'agents' && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.24em', color: '#fbbf24', padding: '3px 2px', borderBottom: '1px solid rgba(251,191,36,0.2)' }}>UP NEXT — TODAY</div>
              {upcomingBlocks.map((b) => (
                <Row key={b.id}>
                  <span style={{ color: '#fbbf24', minWidth: 42, fontSize: 8.5 }}>{new Date(b.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  <span style={{ color: 'rgba(125,211,252,0.8)', fontSize: 8, minWidth: 52 }}>{(b.agentId || 'agent').toUpperCase()}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: INK }}>{b.title}</span>
                  <span style={{ fontSize: 8, color: DIM }}>PLANNED</span>
                </Row>
              ))}
              {userPendingToday.map((t: any) => (
                <Row key={`u-${t.id}`}>
                  <span style={{ color: '#fcd34d', minWidth: 42, fontSize: 8.5 }}>{t.dueDate ? new Date(t.dueDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</span>
                  <span style={{ color: 'rgba(252,211,77,0.8)', fontSize: 8, minWidth: 52 }}>USER</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: INK }}>{t.title}</span>
                  <span style={{ fontSize: 8, color: DIM }}>PENDING</span>
                </Row>
              ))}
            </div>
          )}

          {/* AGENT LEDGER */}
          {taskSource !== 'user' && (
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.24em', color: '#67e8f9', padding: '3px 2px', borderBottom: '1px solid rgba(103,232,249,0.2)', marginBottom: 2 }}>AGENT TASKS</div>
              {tasks.slice(0, 60).map((t: AgentTaskClient, i: number, arr: AgentTaskClient[]) => {
                const prev = i > 0 ? arr[i - 1] : null;
                const showHeader = !prev || taskGroupKey(prev) !== taskGroupKey(t);
                return (
                  <React.Fragment key={t.id}>
                    {showHeader && (
                      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.24em', color: '#67e8f9', padding: '7px 2px 3px', borderBottom: '1px solid rgba(103,232,249,0.14)', marginTop: i > 0 ? 6 : 0 }}>
                        {groupLabel(t)}
                      </div>
                    )}
                    <Row>
                      <Lamp status={t.status} />
                      <span style={{ color: 'rgba(165,243,252,0.85)', minWidth: 70 }}>{t.agentId.toUpperCase()}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                      <span style={{ color: DIM, fontSize: 8 }}>{t.createdAt ? new Date(t.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</span>
                      <span style={{ color: STATUS_COLOR[t.status] || DIM, fontSize: 8 }}>{t.status.toUpperCase()}</span>
                    </Row>
                  </React.Fragment>
                );
              })}
              {!tasks.length && <div style={{ padding: '12px 0', color: DIM }}>{tasksScope === 'today' ? 'NO AGENT TASKS TODAY YET' : 'NO AGENT TASKS RECORDED'}</div>}
            </div>
          )}

          {/* USER TASKS (Chris's tasks) */}
          {taskSource !== 'agents' && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.24em', color: '#fcd34d', padding: '3px 2px', borderBottom: '1px solid rgba(251,191,36,0.2)', marginBottom: 2 }}>USER TASKS</div>
              {userTasks === null && <div style={{ padding: '8px 0', color: DIM }}>LOADING…</div>}
              {userTasks !== null && userLedger.slice(0, 60).map((t: any, i: number, arr: any[]) => {
                const prev = i > 0 ? arr[i - 1] : null;
                const showHeader = !prev || userGroupKey(prev) !== userGroupKey(t);
                const ts = t.createdAt || t.dueDate;
                return (
                  <React.Fragment key={t.id}>
                    {showHeader && (
                      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.24em', color: '#fcd34d', padding: '7px 2px 3px', borderBottom: '1px solid rgba(251,191,36,0.14)', marginTop: i > 0 ? 6 : 0 }}>
                        {userGroupLabel(t)}
                      </div>
                    )}
                    <Row>
                      <Lamp status={t.completed ? 'completed' : t.status === 'in-progress' ? 'running' : 'queued'} />
                      <span style={{ color: 'rgba(252,211,77,0.85)', minWidth: 70, fontSize: 9 }}>USER</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.completed ? DIM : INK }}>{t.title}</span>
                      <span style={{ color: DIM, fontSize: 8 }}>{ts ? new Date(toMs(ts)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</span>
                      <span style={{ color: t.completed ? '#34d399' : DIM, fontSize: 8 }}>{t.completed ? 'DONE' : (t.status || 'OPEN').toUpperCase()}</span>
                    </Row>
                  </React.Fragment>
                );
              })}
              {userTasks !== null && !userLedger.length && <div style={{ padding: '12px 0', color: DIM }}>{tasksScope === 'today' ? 'NO USER TASKS TODAY' : 'NO USER TASKS SYNCED YET — OPEN THE APP ONCE'}</div>}
            </div>
          )}
        </Panel>
      )}

      {view === 'goals' && (
        <Panel title="LIFE GOALS" right={<span style={{ fontSize: 9.5, color: DIM }}>{goalList.length} DECLARED</span>}>
          {goalList.map((g) => (
            <Row key={g.id}>
              <Lamp status={g.status === 'active' ? 'healthy' : g.status === 'achieved' ? 'completed' : 'idle'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</div>
                <div style={{ fontSize: 9, color: DIM }}>{g.horizon.toUpperCase()} · {g.status.toUpperCase()}{g.driftScore != null ? ` · DRIFT ${Math.round(g.driftScore * 100)}%` : ''}</div>
              </div>
              {g.targetDate && <span style={{ fontSize: 9, color: DIM }}>{new Date(g.targetDate).toLocaleDateString()}</span>}
            </Row>
          ))}
          {!goalList.length && <div style={{ padding: '12px 0', color: DIM }}>NO GOALS DECLARED — USE VOICE: "set a goal to …"</div>}
        </Panel>
      )}

      {view === 'calendar' && (
        <Panel title="CALENDAR — NEXT 48H" right={calendar === null ? <span style={{ fontSize: 9.5, color: DIM }}>LOADING…</span> : undefined}>
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
        <Panel title="MISSION CONTROL ROSTER" right={<span style={{ fontSize: 9.5, color: DIM }}>{agents.length} REGISTERED</span>}>
          {([
            { section: 'THE CREW', col: '#fbbf24', entries: [{ id: null, callSign: 'CREW COMMANDER', desc: 'Holds veto · Final GO/NO-GO', status: 'active' }] },
            { section: 'FLIGHT DIRECTOR', col: '#38bdf8', entries: [{ id: 'strategist', callSign: 'CORTEX CORE', desc: 'Owns console · Decides, never flies', status: 'idle' }] },
            { section: 'FLIGHT CONSOLES', col: '#67e8f9', entries: [
              { id: 'antigravity', callSign: 'GUIDANCE', desc: 'Strategy · Vision', status: 'idle' },
              { id: 'builder', callSign: 'FLT CONTROLS', desc: 'Execute · Builder', status: 'idle' },
              { id: 'runner', callSign: 'FLT CONTROLS', desc: 'Execute · Runner', status: 'idle' },
              { id: 'sentinel', callSign: 'EECOM', desc: 'Power/Compute · Model health', status: 'idle' },
              { id: 'capcom', callSign: 'CAPCOM', desc: 'Voice interface', status: 'idle' },
              { id: 'forecaster', callSign: 'FDO', desc: 'Trajectory · Forecasts', status: 'idle' },
              { id: 'warden', callSign: 'SURGEON', desc: 'Quality gate · Safety', status: 'idle' },
            ]},
            { section: 'SUPPORT CRAFT', col: '#a78bfa', entries: [
              { id: 'devin', callSign: 'FLIGHT DYNAMICS', desc: 'Engineering & verification', status: 'idle' },
              { id: 'scout', callSign: 'SCOUT', desc: 'Recon & web intelligence', status: 'idle' },
              { id: 'librarian', callSign: 'LIBRARIAN', desc: 'Engram vector archive', status: 'idle' },
              { id: 'distributor', callSign: 'DISTRIBUTOR', desc: 'Product distribution', status: 'idle' },
              { id: 'prep', callSign: 'PREP', desc: 'Nightly preparation', status: 'idle' },
              { id: 'brief', callSign: 'BRIEF', desc: 'Morning brief 06:00', status: 'idle' },
              { id: 'debrief', callSign: 'DEBRIEF', desc: 'Evening debrief 21:30', status: 'idle' },
              { id: 'reviewer', callSign: 'REVIEWER', desc: 'Code review', status: 'idle' },
            ].concat(
              agents.filter((a) => a.spawnSpec).map((a) => ({ id: a.id, callSign: a.spawnSpec?.callSign || a.id.toUpperCase(), desc: `Spawned · ${a.spawnSpec?.role || ''}`, status: 'idle' }))
            )},
            { section: 'SOVEREIGN GATEWAYS & ENTERPRISE FLEET', col: '#ef4444', entries: [
              { id: 'hermes', callSign: 'HERMES', desc: 'Sovereign mutating tool host (:18880)', status: 'idle' },
              { id: 'curator', callSign: 'CURATOR', desc: 'Fleet intelligence & dynamic capabilities', status: 'idle' },
              { id: 'openclaw', callSign: 'OPENCLAW', desc: 'WebMCP browser copilot (:18789)', status: 'idle' },
              { id: 'claudecode', callSign: 'CLAUDE CODE', desc: 'Terminal architect & consensus auditor', status: 'idle' },
            ]},
            { section: 'GROUND SEGMENT', col: '#34d399', entries: [
              { id: null, callSign: 'LOCAL TOWER', desc: 'Mac host · voice loop · workspace', status: 'active' },
              { id: null, callSign: 'TDRS SATELLITE', desc: 'Oracle cloud · always-on node', status: 'idle' },
            ]},
          ] as { section: string; col: string; entries: { id: string | null; callSign: string; desc: string; status: string }[] }[]).map((sec) => (
            <div key={sec.section} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', color: sec.col, padding: '3px 2px 2px', borderBottom: `1px solid ${sec.col}33` }}>
                {sec.section}
              </div>
              {sec.entries.map((e) => {
                const a = e.id ? agents.find((x) => x.id === e.id) : null;
                const status = e.id ? (a?.status || 'offline') : e.status;
                return (
                  <Row key={e.callSign + e.desc}>
                    <Lamp status={status} />
                    {e.id && a ? (
                      <button
                        onClick={() => onSelectAgent(a.id)}
                        style={{
                          flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          color: selectedAgent === a.id ? '#7dd3fc' : INK, fontFamily: MONO, fontSize: 10.5,
                        }}
                      >
                        <span style={{ color: sec.col, fontWeight: 700 }}>{e.callSign}</span>
                        <span style={{ color: DIM, fontSize: 9 }}> — {e.desc} · {status.toUpperCase()}</span>
                      </button>
                    ) : (
                      <span style={{ flex: 1, fontSize: 10.5, color: INK }}>
                        <span style={{ color: sec.col, fontWeight: 700 }}>{e.callSign}</span>
                        <span style={{ color: DIM, fontSize: 9 }}> — {e.desc}</span>
                      </span>
                    )}
                    {a && <span style={{ fontSize: 9, color: DIM }}>{a.tasksCompleted}✓</span>}
                  </Row>
                );
              })}
            </div>
          ))}
        </Panel>
      )}

      {view === 'counsel' && (
        <Panel title="THE COUNSEL — GO/NO-GO POLLS" right={
          <button onClick={() => { setView(null); onOpenTower(); }} style={{ background: 'none', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', fontFamily: MONO, fontSize: 9.5, padding: '2px 8px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.15em' }}>OPEN TOWER</button>
        }>
          {counsel === null && <div style={{ padding: '12px 0', color: DIM }}>LOADING…</div>}
          {counsel && !counsel.sessions.length && <div style={{ padding: '12px 0', color: DIM }}>NO SESSIONS — CONVENE FROM THE TOWER BOARD</div>}
          {(counsel?.sessions || []).map((s: any) => {
            const stanceCounts = (s.positions || []).reduce((m: any, p: any) => { m[p.stance] = (m[p.stance] || 0) + 1; return m; }, {} as Record<string, number>);
            return (
              <div key={s.id} style={{ border: '1px solid rgba(192,132,252,0.2)', borderRadius: 3, padding: '7px 9px', marginBottom: 7, background: 'rgba(192,132,252,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 9.5, color: '#c084fc', fontWeight: 700 }}>{s.id} · {s.status.toUpperCase()}</span>
                  <span style={{ fontSize: 9, color: DIM }}>{s.lane.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 10.5, color: INK, marginTop: 3 }}>{s.question}</div>
                <div style={{ fontSize: 9, color: DIM, marginTop: 3 }}>
                  GO {stanceCounts.go || 0} · CONDITIONAL {stanceCounts.conditional || 0} · NO-GO {stanceCounts['no-go'] || 0}
                  {s.members?.length ? ` · MEMBERS ${s.members.join(', ')}` : ''}
                </div>
                {s.status === 'poll' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button onClick={() => decidePoll(s.id, 'go')} style={{ flex: 1, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.5)', color: '#34d399', fontFamily: MONO, fontSize: 10, fontWeight: 700, padding: '4px 0', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.15em' }}>GO</button>
                    <button onClick={() => decidePoll(s.id, 'no-go')} style={{ flex: 1, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.5)', color: '#f87171', fontFamily: MONO, fontSize: 10, fontWeight: 700, padding: '4px 0', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.15em' }}>NO-GO</button>
                  </div>
                )}
              </div>
            );
          })}
        </Panel>
      )}

      {view === 'inbox' && (
        <Panel title="INBOX — AWAITING YOUR DECISION" right={
          <span style={{ fontSize: 9.5, color: inbox?.length ? '#fbbf24' : DIM }}>{inbox?.length ?? '…'} PENDING</span>
        }>
          {inboxNote && <div style={{ fontSize: 10, color: inboxNote.startsWith('DECISION FAILED') ? '#f87171' : '#34d399', marginBottom: 6 }}>{inboxNote}</div>}
          {inbox === null && <div style={{ padding: '12px 0', color: DIM }}>LOADING…</div>}
          {inbox !== null && !inbox.length && <div style={{ padding: '12px 0', color: DIM }}>NOTHING WAITING ON YOU</div>}
          {(inbox || []).map((p: any) => (
            <div key={p.id} style={{ border: '1px solid rgba(251,191,36,0.2)', borderRadius: 3, padding: '7px 9px', marginBottom: 7, background: 'rgba(251,191,36,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 9.5, color: '#fbbf24', fontWeight: 700 }}>{p.agentId?.toUpperCase() || 'STRATEGIST'} · {p.kind?.toUpperCase()}</span>
                <span style={{ fontSize: 9, color: DIM }}>{p.actionClass?.toUpperCase() || ''}</span>
              </div>
              <div style={{ fontSize: 10.5, color: INK, marginTop: 3 }}>{p.title}</div>
              {p.instruction && <div style={{ fontSize: 9, color: DIM, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.instruction}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => decideProposal(p.id, 'approved')} style={{ flex: 1, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.5)', color: '#34d399', fontFamily: MONO, fontSize: 10, fontWeight: 700, padding: '4px 0', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.15em' }}>APPROVE → DISPATCH</button>
                <button onClick={() => decideProposal(p.id, 'dismissed')} style={{ flex: 1, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.35)', color: DIM, fontFamily: MONO, fontSize: 10, fontWeight: 700, padding: '4px 0', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.15em' }}>DISMISS</button>
              </div>
            </div>
          ))}
        </Panel>
      )}

      {view === 'incidents' && (
        <Panel title="INCIDENT LEDGER" right={incidents === null ? <span style={{ fontSize: 9.5, color: DIM }}>LOADING…</span> : <span style={{ fontSize: 9.5, color: DIM }}>{incidents.filter((i) => i.status === 'open').length} OPEN</span>}>
          {(incidents || []).slice(0, 20).map((i: any) => (
            <Row key={i.id}>
              <Lamp status={i.status === 'open' ? 'failed' : 'resolved'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: i.status === 'open' ? '#fca5a5' : DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</div>
                <div style={{ fontSize: 9, color: DIM }}>{i.agentId?.toUpperCase()} · {i.kind} · ×{i.count} · {i.ageHours ?? '?'}h</div>
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
            <pre style={{ fontSize: 9.5, color: DIM, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {JSON.stringify(pipeline, null, 1).slice(0, 3000)}
            </pre>
          )}
          {pipeline?.error && <div style={{ padding: '12px 0', color: '#f87171' }}>PIPELINE STATUS UNREACHABLE</div>}
        </Panel>
      )}
    </>
  );
}
