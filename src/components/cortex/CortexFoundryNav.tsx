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
import { CortexFoundryCalendar } from './CortexFoundryCalendar';

const MONO = "'IBM Plex Mono', monospace";
const INK = '#e0f2fe';
const DIM = 'rgba(148,163,184,0.55)';

type FoundryView = 'dashboard' | 'tasks' | 'goals' | 'calendar' | 'agents' | 'counsel' | 'inbox' | 'incidents' | 'pipeline' | 'standup' | 'messages' | 'ventures' | 'voice';

const NAV_ITEMS: { id: FoundryView; glyph: string; label: string; hint: string }[] = [
  { id: 'dashboard', glyph: '◈', label: 'DASHBOARD', hint: 'Mission Control tower board' },
  { id: 'tasks', glyph: '▤', label: 'TASKS', hint: 'Agent task ledger' },
  { id: 'goals', glyph: '◎', label: 'GOALS', hint: 'Life-goal model & drift' },
  { id: 'calendar', glyph: '▦', label: 'CALENDAR', hint: 'Upcoming events (48h)' },
  { id: 'agents', glyph: '✦', label: 'AGENTS', hint: 'Mission Control roster' },
  { id: 'standup', glyph: '⚡', label: 'STANDUP', hint: 'Fleet roll call & daily bids' },
  { id: 'counsel', glyph: '⚖', label: 'COUNSEL', hint: 'Go/No-Go deliberation polls' },
  { id: 'inbox', glyph: '✉', label: 'INBOX', hint: 'Proposals awaiting your decision' },
  { id: 'incidents', glyph: '⚠', label: 'INCIDENTS', hint: 'Failure ticket ledger' },
  { id: 'pipeline', glyph: '⇶', label: 'PIPELINE', hint: 'Distribution / product flow' },
  { id: 'messages', glyph: '⇄', label: 'COMMS', hint: 'Agent message bus traffic' },
  { id: 'voice', glyph: '♪', label: 'VOICE', hint: 'Cortex voice engines — live test' },
  { id: 'ventures', glyph: '◈', label: 'VENTURES', hint: 'Enterprise scope — OMNI / GOVTECH / CORTEX' },
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

function Panel({ title, right, onClose, children }: { title: string; right?: React.ReactNode; onClose?: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', left: 80, top: '50%', transform: 'translateY(-50%)', zIndex: 25,
      width: 490, maxWidth: 'calc(100vw - 360px)', maxHeight: '76vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(165deg, rgba(8,14,24,0.96), rgba(5,8,15,0.94))',
      border: '1px solid rgba(103,232,249,0.25)', borderLeft: '3px solid #38bdf8', borderRadius: 4,
      padding: '12px 14px', fontFamily: MONO, backdropFilter: 'blur(12px)',
      boxShadow: '0 12px 48px rgba(0,0,0,0.7), 0 0 24px rgba(56,189,248,0.12)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 12, letterSpacing: '0.3em', color: '#67e8f9', fontWeight: 700 }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {right}
          {onClose && (
            <button
              onClick={onClose}
              title="Close panel"
              style={{
                background: 'transparent', border: '1px solid rgba(148,163,184,0.25)',
                borderRadius: 2, color: 'rgba(148,163,184,0.7)', cursor: 'pointer',
                fontFamily: MONO, fontSize: 9, padding: '1px 6px', lineHeight: 1.2,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = '#f87171'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.7)'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.25)'; }}
            >✕</button>
          )}
        </div>
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
  const [counsel, setCounsel] = useState<{ sessions: any[]; consoles: any[]; scorecard?: any[] } | null>(null);
  const [inbox, setInbox] = useState<any[] | null>(null);
  const [agentMsgs, setAgentMsgs] = useState<any[] | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<any | null>(null);
  const [voiceConfig, setVoiceConfig] = useState<{ defaultVoice?: string } | null>(null);
  const [voiceTest, setVoiceTest] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({});
  const [inboxNote, setInboxNote] = useState('');
  const [tasksScope, setTasksScope] = useState<'today' | 'all'>('today');
  const [taskSource, setTaskSource] = useState<'all' | 'agents' | 'user'>('all');
  const [userTasks, setUserTasks] = useState<any[] | null>(null);
  const [standup, setStandup] = useState<{ morning?: any; evening?: any } | null>(null);
  const [runningStandup, setRunningStandup] = useState(false);
  const [standupFilter, setStandupFilter] = useState<'all' | 'ready' | 'degraded'>('all');
  const [standupNote, setStandupNote] = useState('');
  const [ventures, setVentures] = useState<{ ventures?: any[]; unregisteredYield?: string[] } | null>(null);
  const [ventureFilter, setVentureFilter] = useState<string>('all');
  const [newTaskVenture, setNewTaskVenture] = useState<string>('');
  const [, setGoalsTick] = useState(0);
  const goals = getCortexGoals();
  const goalsUnsub = useRef<(() => void) | null>(null);

  // Sovereign Gateways status state (OpenClaw :18789 & Hermes :18880)
  const [gatewayStatus, setGatewayStatus] = useState<Record<string, {
    id: string;
    name: string;
    status: 'running' | 'down';
    port: number;
    latencyMs?: number;
    wsUrl?: string;
    url?: string;
  }> | null>(null);
  const [gatewayProbing, setGatewayProbing] = useState(false);

  // Task & Goal Creation states
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [newTaskTarget, setNewTaskTarget] = useState<'user' | 'agent'>('user');

  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalHorizon, setNewGoalHorizon] = useState<'week' | 'month' | 'quarter' | 'year' | 'life'>('quarter');

  const handleCreateTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    const now = new Date();
    const created = {
      id: `ut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      status: 'queued',
      completed: false,
      priority: newTaskPriority,
      dueDate: now.toISOString(),
      createdAt: now.toISOString(),
      ventureId: newTaskVenture || undefined,
    };

    setUserTasks((prev) => [created, ...(prev || [])]);

    try {
      const raw = localStorage.getItem('syncscript_tasks');
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(created);
      localStorage.setItem('syncscript_tasks', JSON.stringify(list));
    } catch { }

    try {
      const all = [created, ...(userTasks || [])];
      fetch('/api/cortex/tasks/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: all }),
      }).catch(() => { });
    } catch { }

    setNewTaskTitle('');
    setNewTaskVenture('');
    setShowNewTask(false);
  };

  const handleCreateGoal = () => {
    const title = newGoalTitle.trim();
    if (!title) return;
    goals.declare({
      title,
      horizon: newGoalHorizon,
    });
    setNewGoalTitle('');
    setShowNewGoal(false);
    setGoalsTick((t) => t + 1);
  };

  useEffect(() => () => goalsUnsub.current?.(), []);

  // Lazy-fetch section data when its view opens.
  useEffect(() => {
    if (view === 'calendar' && calendar === null) {
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('syncscript_calendar_events') : null;
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length) {
            setCalendar(parsed.map((e: any) => ({
              id: String(e.id || ''),
              title: String(e.title || ''),
              start: new Date(e.startTime).getTime(),
              end: new Date(e.endTime).getTime() || undefined,
              attendees: Array.isArray(e.teamMembers) ? e.teamMembers.length : 0,
            })));
          }
        }
      } catch { }
      fetch('/api/cortex/calendar/upcoming', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d?.events)) {
            setCalendar(d.events);
          }
        })
        .catch(() => setCalendar((c) => c || []));
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
    if (view === 'standup' && standup === null) {
      fetch('/api/cortex/standup/status', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setStandup(d?.standup || null))
        .catch(() => setStandup(null));
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

  // Venture registry poll while the VENTURES view is open.
  useEffect(() => {
    if (view !== 'ventures') return;
    const loadV = () => fetch('/api/cortex/ventures', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setVentures)
      .catch(() => setVentures({ ventures: [] }));
    loadV();
    const iv = setInterval(loadV, 30_000);
    return () => clearInterval(iv);
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

  // Agent message bus poll while the COMMS view is open.
  useEffect(() => {
    if (view !== 'messages') return;
    const load = () => {
      fetch('/api/cortex/agents/messages?limit=60', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setAgentMsgs(Array.isArray(d?.messages) ? d.messages : []))
        .catch(() => setAgentMsgs([]));
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [view]);

  // Voice engine status poll while the VOICE view is open.
  useEffect(() => {
    if (view !== 'voice') return;
    const load = () => {
      fetch('/api/cortex/tts/status', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setVoiceStatus(d))
        .catch(() => setVoiceStatus({ ok: false, error: 'status endpoint unreachable' }));
      fetch('/api/cortex/tts/config', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setVoiceConfig(d))
        .catch(() => { });
    };
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [view]);

  const setDefaultVoice = async (voiceId: string) => {
    try {
      const r = await fetch('/api/cortex/tts/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultVoice: voiceId }),
      });
      const d = await r.json().catch(() => null);
      if (d?.ok !== false) {
        setVoiceConfig(d);
        try { localStorage.setItem('cortex_cartesia_voice', voiceId); } catch { }
      }
    } catch { }
  };

  const testVoice = async (voiceId: string) => {
    setVoiceTest((m) => ({ ...m, [voiceId]: 'testing' }));
    const t0 = Date.now();
    try {
      const r = await fetch('/api/cortex/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Voice check. Systems nominal.', voice: voiceId }),
      });
      if (!r.ok) throw new Error(`http ${r.status}`);
      const blob = await r.blob();
      if (blob.size < 200) throw new Error('empty audio');
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      setVoiceTest((m) => ({ ...m, [voiceId]: 'ok' }));
      console.info(`[voice-test] ${voiceId} ok — ${blob.size}b in ${Date.now() - t0}ms`);
    } catch (e: any) {
      setVoiceTest((m) => ({ ...m, [voiceId]: 'fail' }));
      console.warn(`[voice-test] ${voiceId} failed:`, e?.message);
    }
  };

  // Counsel + inbox poll on their own cadence while their views are open.
  useEffect(() => {
    if (view !== 'counsel' && view !== 'inbox') return;
    const load = () => {
      if (view === 'counsel') {
        fetch('/api/cortex/counsel/sessions', { cache: 'no-store' })
          .then((r) => r.json())
          .then((d) => setCounsel({ sessions: d?.sessions || [], consoles: d?.consoles || [], scorecard: d?.scorecard || [] }))
          .catch(() => { });
      } else {
        fetch('/api/cortex/agents/proposals?status=pending', { cache: 'no-store' })
          .then((r) => r.json())
          .then((d) => setInbox(Array.isArray(d?.proposals) ? d.proposals : []))
          .catch(() => { });
      }
    };
    load();
    const iv = setInterval(load, view === 'counsel' ? 8000 : 10000);
    return () => clearInterval(iv);
  }, [view]);

  // Sovereign Gateways live monitoring poll (OpenClaw :18789 & Hermes :18880)
  useEffect(() => {
    if (view !== 'agents') return;
    let cancelled = false;
    const probeGateways = () => {
      setGatewayProbing(true);
      fetch('/api/cortex/gateways/status', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d?.ok && d?.gateways) {
            setGatewayStatus(d.gateways);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setGatewayStatus({
              openclaw: { id: 'openclaw', name: 'OpenClaw Gateway', status: 'down', port: 18789 },
              hermes: { id: 'hermes', name: 'Hermes Sovereign Host', status: 'down', port: 18880 },
            });
          }
        })
        .finally(() => {
          if (!cancelled) setGatewayProbing(false);
        });
    };
    probeGateways();
    const iv = setInterval(probeGateways, 8000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
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
      if (d) setCounsel({ sessions: d?.sessions || [], consoles: d?.consoles || [], scorecard: d?.scorecard || [] });
    } catch { }
  };

  const triggerRollCall = async (arm: 'A' | 'B' = 'A') => {
    setRunningStandup(true);
    setStandupNote('');
    try {
      const res = await fetch(`/api/cortex/standup/morning?arm=${arm}`, { method: 'POST' });
      const data = await res.json();
      if (data?.ok && data?.report) {
        setStandup((prev) => ({ ...prev, morning: data.report }));
        setStandupNote(`ROLL CALL COMPLETE (ARM ${arm}) · ${data.report.healthyCount}/${data.report.totalAgents} READY`);
      } else {
        setStandupNote(`ROLL CALL FAILED: ${data?.error || res.statusText}`);
      }
    } catch (e: any) {
      setStandupNote(`ROLL CALL FAILED: ${e?.message || String(e)}`);
    } finally {
      setRunningStandup(false);
    }
  };

  const approveBid = async (proposalId: string) => {
    setStandupNote('');
    try {
      const res = await fetch('/api/cortex/standup/bid/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      });
      const data = await res.json();
      if (data?.ok) {
        setStandupNote(`BID APPROVED → ${proposalId}`);
      } else {
        setStandupNote(`APPROVAL FAILED: ${data?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setStandupNote(`APPROVAL FAILED: ${e?.message || String(e)}`);
    }
  };

  const agents = snap.agents || [];
  const allTasks = snap.tasks || [];
  // Venture scope (enterprise console): 'all' shows everything; a venture id
  // filters to that scope; untagged work counts under 'cortex' — never dropped.
  const ventureOf = (t: any): string => String(t?.input?.ventureId || t?.ventureId || 'cortex');
  const inVentureScope = (t: any) => ventureFilter === 'all' || ventureOf(t) === ventureFilter;

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
  const scopedTasks = (tasksScope === 'today'
    ? allTasks.filter((t) => sameDay(t.createdAt, Date.now()))
    : allTasks).filter(inVentureScope);
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
    .filter(inVentureScope)
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
    .filter((b: any) => ventureFilter === 'all' || String(b.ventureId || 'cortex') === ventureFilter)
    .sort((a, b) => a.start - b.start);
  const plannedUserTaskIds = new Set(upcomingBlocks.map((b) => b.taskId).filter(Boolean));
  const userPendingToday = userList.filter((t) =>
    !t.completed && !plannedUserTaskIds.has(t.id) &&
    (sameDay(t.dueDate, Date.now()) || (!t.dueDate && sameDay(t.createdAt, Date.now()))));

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
        <Panel title="TASK LEDGER" onClose={() => setView(null)} right={
          <span style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowNewTask((prev) => !prev)}
              style={{
                background: showNewTask ? 'rgba(52,211,153,0.3)' : 'rgba(52,211,153,0.15)',
                border: '1px solid #34d399',
                color: '#6ee7b7',
                fontFamily: MONO,
                fontSize: 8.5,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 2,
                cursor: 'pointer',
                letterSpacing: '0.08em',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <span>+</span> NEW TASK
            </button>
            <span style={{ width: 4 }} />
            <button onClick={() => setTaskSource('all')} style={{ background: taskSource === 'all' ? 'rgba(52,211,153,0.14)' : 'none', border: `1px solid ${taskSource === 'all' ? 'rgba(52,211,153,0.5)' : 'rgba(103,232,249,0.16)'}`, color: taskSource === 'all' ? '#6ee7b7' : DIM, fontFamily: MONO, fontSize: 8.5, padding: '1px 6px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.1em' }}>ALL</button>
            <button onClick={() => setTaskSource('agents')} style={{ background: taskSource === 'agents' ? 'rgba(56,189,248,0.16)' : 'none', border: `1px solid ${taskSource === 'agents' ? 'rgba(56,189,248,0.55)' : 'rgba(103,232,249,0.16)'}`, color: taskSource === 'agents' ? '#7dd3fc' : DIM, fontFamily: MONO, fontSize: 8.5, padding: '1px 6px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.1em' }}>AGENTS</button>
            <button onClick={() => setTaskSource('user')} style={{ background: taskSource === 'user' ? 'rgba(251,191,36,0.14)' : 'none', border: `1px solid ${taskSource === 'user' ? 'rgba(251,191,36,0.5)' : 'rgba(103,232,249,0.16)'}`, color: taskSource === 'user' ? '#fcd34d' : DIM, fontFamily: MONO, fontSize: 8.5, padding: '1px 6px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.1em' }}>USER</button>
            <span style={{ width: 6 }} />
            <button onClick={() => setTasksScope('today')} style={{ background: tasksScope === 'today' ? 'rgba(56,189,248,0.16)' : 'none', border: `1px solid ${tasksScope === 'today' ? 'rgba(56,189,248,0.55)' : 'rgba(103,232,249,0.16)'}`, color: tasksScope === 'today' ? '#7dd3fc' : DIM, fontFamily: MONO, fontSize: 9, padding: '1px 7px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.12em' }}>TODAY {todayCount}</button>
            <button onClick={() => setTasksScope('all')} style={{ background: tasksScope === 'all' ? 'rgba(56,189,248,0.16)' : 'none', border: `1px solid ${tasksScope === 'all' ? 'rgba(56,189,248,0.55)' : 'rgba(103,232,249,0.16)'}`, color: tasksScope === 'all' ? '#7dd3fc' : DIM, fontFamily: MONO, fontSize: 9, padding: '1px 7px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.12em' }}>ALL {allTasks.length + userList.length}</button>
          </span>
        }>
          {/* Inline HUD Task Creation Drawer */}
          {showNewTask && (
            <div style={{
              background: 'rgba(15,23,42,0.92)',
              border: '1px solid rgba(52,211,153,0.45)',
              borderLeft: '3px solid #34d399',
              borderRadius: 3,
              padding: '10px 12px',
              marginBottom: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#34d399', letterSpacing: '0.14em' }}>
                  + CREATE NEW TASK
                </span>
                <button
                  onClick={() => setShowNewTask(false)}
                  style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 11 }}
                >
                  ✕
                </button>
              </div>

              <input
                type="text"
                placeholder="Task description / operational goal…"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTask(); }}
                style={{
                  background: 'rgba(8,14,24,0.8)',
                  border: '1px solid rgba(103,232,249,0.25)',
                  color: INK,
                  fontFamily: MONO,
                  fontSize: 10,
                  padding: '5px 8px',
                  borderRadius: 2,
                  outline: 'none',
                }}
                autoFocus
              />

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 8, color: DIM }}>PRIORITY:</span>
                {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewTaskPriority(p)}
                    style={{
                      background: newTaskPriority === p ? 'rgba(52,211,153,0.25)' : 'rgba(8,14,24,0.6)',
                      border: `1px solid ${newTaskPriority === p ? '#34d399' : 'rgba(103,232,249,0.18)'}`,
                      color: newTaskPriority === p ? '#6ee7b7' : DIM,
                      fontFamily: MONO,
                      fontSize: 8,
                      padding: '2px 6px',
                      borderRadius: 2,
                      cursor: 'pointer',
                    }}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}

                <span style={{ fontSize: 8, color: DIM, marginLeft: 4 }}>TARGET:</span>
                <button
                  type="button"
                  onClick={() => setNewTaskTarget('user')}
                  style={{
                    background: newTaskTarget === 'user' ? 'rgba(251,191,36,0.25)' : 'rgba(8,14,24,0.6)',
                    border: `1px solid ${newTaskTarget === 'user' ? '#fcd34d' : 'rgba(103,232,249,0.18)'}`,
                    color: newTaskTarget === 'user' ? '#fcd34d' : DIM,
                    fontFamily: MONO,
                    fontSize: 8,
                    padding: '2px 6px',
                    borderRadius: 2,
                    cursor: 'pointer',
                  }}
                >
                  USER
                </button>
                <button
                  type="button"
                  onClick={() => setNewTaskTarget('agent')}
                  style={{
                    background: newTaskTarget === 'agent' ? 'rgba(56,189,248,0.25)' : 'rgba(8,14,24,0.6)',
                    border: `1px solid ${newTaskTarget === 'agent' ? '#38bdf8' : 'rgba(103,232,249,0.18)'}`,
                    color: newTaskTarget === 'agent' ? '#7dd3fc' : DIM,
                    fontFamily: MONO,
                    fontSize: 8,
                    padding: '2px 6px',
                    borderRadius: 2,
                    cursor: 'pointer',
                  }}
                >
                  AGENT
                </button>

                <span style={{ fontSize: 8, color: DIM, marginLeft: 4 }}>VENTURE:</span>
                <button
                  type="button"
                  onClick={() => setNewTaskVenture('')}
                  style={{
                    background: !newTaskVenture ? 'rgba(148,163,184,0.2)' : 'rgba(8,14,24,0.6)',
                    border: `1px solid ${!newTaskVenture ? 'rgba(148,163,184,0.5)' : 'rgba(103,232,249,0.18)'}`,
                    color: !newTaskVenture ? INK : DIM,
                    fontFamily: MONO, fontSize: 8, padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
                  }}
                >FLEET</button>
                {(ventures?.ventures || []).map((v: any) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setNewTaskVenture(v.id)}
                    style={{
                      background: newTaskVenture === v.id ? 'rgba(167,139,250,0.25)' : 'rgba(8,14,24,0.6)',
                      border: `1px solid ${newTaskVenture === v.id ? '#a78bfa' : 'rgba(103,232,249,0.18)'}`,
                      color: newTaskVenture === v.id ? '#c4b5fd' : DIM,
                      fontFamily: MONO, fontSize: 8, padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
                    }}
                  >{v.callSign || v.id.toUpperCase()}</button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
                <button
                  onClick={() => setShowNewTask(false)}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(148,163,184,0.25)',
                    color: DIM,
                    fontFamily: MONO,
                    fontSize: 8.5,
                    padding: '3px 8px',
                    borderRadius: 2,
                    cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={!newTaskTitle.trim()}
                  style={{
                    background: '#059669',
                    border: '1px solid #34d399',
                    color: '#ffffff',
                    fontFamily: MONO,
                    fontSize: 8.5,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 2,
                    cursor: newTaskTitle.trim() ? 'pointer' : 'not-allowed',
                    boxShadow: '0 0 10px rgba(16,185,129,0.3)',
                  }}
                >
                  CONFIRM & DISPATCH
                </button>
              </div>
            </div>
          )}
          {/* VENTURE SCOPE CHIPS — enterprise console filter dimension */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
            <span style={{ fontSize: 8, color: DIM, letterSpacing: '0.14em', marginRight: 2 }}>SCOPE:</span>
            {(['all', ...(ventures?.ventures || []).map((v: any) => v.id)] as string[]).map((vid) => {
              const active = ventureFilter === vid;
              const label = vid === 'all' ? 'ALL' : (ventures?.ventures || []).find((v: any) => v.id === vid)?.callSign || vid.toUpperCase();
              return (
                <button
                  key={vid}
                  onClick={() => setVentureFilter(vid)}
                  style={{
                    background: active ? 'rgba(167,139,250,0.2)' : 'none',
                    border: `1px solid ${active ? 'rgba(167,139,250,0.6)' : 'rgba(148,163,184,0.16)'}`,
                    color: active ? '#c4b5fd' : DIM,
                    fontFamily: MONO, fontSize: 8, padding: '1px 6px', borderRadius: 2,
                    cursor: 'pointer', letterSpacing: '0.1em',
                  }}
                >{label}</button>
              );
            })}
          </div>
          {/* UP NEXT — today's plan: mission blocks + pending user tasks */}
          {(upcomingBlocks.length > 0 || userPendingToday.length > 0) && taskSource !== 'agents' && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.24em', color: '#fbbf24', padding: '3px 2px', borderBottom: '1px solid rgba(251,191,36,0.2)' }}>UP NEXT — TODAY</div>
              {upcomingBlocks.map((b) => (
                <Row key={b.id}>
                  <span style={{ color: '#fbbf24', minWidth: 42, fontSize: 8.5 }}>{new Date(b.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  <span style={{ color: b.kind === 'user_task' ? 'rgba(252,211,77,0.8)' : 'rgba(125,211,252,0.8)', fontSize: 8, minWidth: 52 }}>{b.kind === 'user_task' ? 'USER' : (b.agentId || 'agent').toUpperCase()}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: INK }}>{b.title}</span>
                  <span style={{ fontSize: 8, color: DIM }}>{b.kind === 'user_task' ? 'PLANNED' : 'AGENT'}</span>
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
        <Panel
          title="LIFE GOALS"
          onClose={() => setView(null)}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setShowNewGoal((prev) => !prev)}
                style={{
                  background: showNewGoal ? 'rgba(56,189,248,0.25)' : 'rgba(56,189,248,0.12)',
                  border: '1px solid #38bdf8',
                  color: '#7dd3fc',
                  fontFamily: MONO,
                  fontSize: 8.5,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 2,
                  cursor: 'pointer',
                  letterSpacing: '0.08em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <span>+</span> NEW GOAL
              </button>
              <span style={{ fontSize: 9.5, color: DIM }}>{goalList.length} DECLARED</span>
            </div>
          }
        >
          {/* Inline HUD Goal Creation Drawer */}
          {showNewGoal && (
            <div style={{
              background: 'rgba(15,23,42,0.92)',
              border: '1px solid rgba(56,189,248,0.45)',
              borderLeft: '3px solid #38bdf8',
              borderRadius: 3,
              padding: '10px 12px',
              marginBottom: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.14em' }}>
                  + DECLARE LIFE GOAL
                </span>
                <button
                  onClick={() => setShowNewGoal(false)}
                  style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 11 }}
                >
                  ✕
                </button>
              </div>

              <input
                type="text"
                placeholder="Goal objective (e.g. Master neural rendering, Run half-marathon)…"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGoal(); }}
                style={{
                  background: 'rgba(8,14,24,0.8)',
                  border: '1px solid rgba(103,232,249,0.25)',
                  color: INK,
                  fontFamily: MONO,
                  fontSize: 10,
                  padding: '5px 8px',
                  borderRadius: 2,
                  outline: 'none',
                }}
                autoFocus
              />

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 8, color: DIM }}>HORIZON:</span>
                {(['week', 'month', 'quarter', 'year', 'life'] as const).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setNewGoalHorizon(h)}
                    style={{
                      background: newGoalHorizon === h ? 'rgba(56,189,248,0.25)' : 'rgba(8,14,24,0.6)',
                      border: `1px solid ${newGoalHorizon === h ? '#38bdf8' : 'rgba(103,232,249,0.18)'}`,
                      color: newGoalHorizon === h ? '#7dd3fc' : DIM,
                      fontFamily: MONO,
                      fontSize: 8,
                      padding: '2px 6px',
                      borderRadius: 2,
                      cursor: 'pointer',
                    }}
                  >
                    {h.toUpperCase()}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
                <button
                  onClick={() => setShowNewGoal(false)}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(148,163,184,0.25)',
                    color: DIM,
                    fontFamily: MONO,
                    fontSize: 8.5,
                    padding: '3px 8px',
                    borderRadius: 2,
                    cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleCreateGoal}
                  disabled={!newGoalTitle.trim()}
                  style={{
                    background: 'rgba(56,189,248,0.25)',
                    border: '1px solid #38bdf8',
                    color: '#7dd3fc',
                    fontFamily: MONO,
                    fontSize: 8.5,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 2,
                    cursor: newGoalTitle.trim() ? 'pointer' : 'not-allowed',
                    boxShadow: '0 0 10px rgba(56,189,248,0.3)',
                  }}
                >
                  DECLARE GOAL
                </button>
              </div>
            </div>
          )}

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
        <Panel
          title="MISSION CALENDAR"
          onClose={() => setView(null)}
          right={<span style={{ fontSize: 9.5, color: DIM }}>{calendar ? `${calendar.length} TOTAL` : 'LOADING…'}</span>}
        >
          <CortexFoundryCalendar
            events={calendar || []}
            loading={calendar === null}
            onAddEvent={(newEvt) => setCalendar((prev) => [...(prev || []), newEvt])}
          />
        </Panel>
      )}

      {view === 'agents' && (
        <Panel
          title="MISSION CONTROL ROSTER"
          onClose={() => setView(null)}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {gatewayProbing && <span style={{ fontSize: 8.5, color: '#38bdf8', letterSpacing: '0.1em' }}>PROBING…</span>}
              <span style={{ fontSize: 9.5, color: DIM }}>{agents.length} REGISTERED</span>
            </div>
          }
        >
          {/* Sovereign Gateways Live Radar Strip */}
          <div style={{
            marginBottom: 10,
            padding: '8px 10px',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.85) 0%, rgba(2,6,23,0.7) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.28)',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', color: '#38bdf8' }}>
                SOVEREIGN GATEWAYS TELEMETRY
              </span>
              <span style={{ fontSize: 8.5, color: DIM, letterSpacing: '0.12em' }}>
                LOCAL SOCKET MONITOR
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {/* OpenClaw Gateway */}
              <div style={{
                padding: '6px 8px',
                background: gatewayStatus?.openclaw?.status === 'running' ? 'rgba(52, 211, 153, 0.08)' : 'rgba(248, 113, 113, 0.08)',
                border: `1px solid ${gatewayStatus?.openclaw?.status === 'running' ? 'rgba(52, 211, 153, 0.35)' : 'rgba(248, 113, 113, 0.35)'}`,
                borderRadius: 3,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Lamp status={gatewayStatus?.openclaw?.status || 'down'} />
                    <span style={{ fontWeight: 700, fontSize: 10, color: '#f8fafc' }}>OPENCLAW</span>
                  </div>
                  <span style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    color: gatewayStatus?.openclaw?.status === 'running' ? '#34d399' : '#f87171',
                    letterSpacing: '0.12em',
                  }}>
                    {gatewayStatus?.openclaw?.status === 'running' ? 'RUNNING' : 'DOWN'}
                  </span>
                </div>
                <div style={{ marginTop: 3, fontSize: 8.5, color: DIM, display: 'flex', justifyContent: 'space-between' }}>
                  <span>PORT 18789 · WS</span>
                  {gatewayStatus?.openclaw?.latencyMs !== undefined && (
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>{gatewayStatus.openclaw.latencyMs}ms</span>
                  )}
                </div>
              </div>

              {/* Hermes Gateway */}
              <div style={{
                padding: '6px 8px',
                background: gatewayStatus?.hermes?.status === 'running' ? 'rgba(52, 211, 153, 0.08)' : 'rgba(248, 113, 113, 0.08)',
                border: `1px solid ${gatewayStatus?.hermes?.status === 'running' ? 'rgba(52, 211, 153, 0.35)' : 'rgba(248, 113, 113, 0.35)'}`,
                borderRadius: 3,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Lamp status={gatewayStatus?.hermes?.status || 'down'} />
                    <span style={{ fontWeight: 700, fontSize: 10, color: '#f8fafc' }}>HERMES</span>
                  </div>
                  <span style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    color: gatewayStatus?.hermes?.status === 'running' ? '#34d399' : '#f87171',
                    letterSpacing: '0.12em',
                  }}>
                    {gatewayStatus?.hermes?.status === 'running' ? 'RUNNING' : 'DOWN'}
                  </span>
                </div>
                <div style={{ marginTop: 3, fontSize: 8.5, color: DIM, display: 'flex', justifyContent: 'space-between' }}>
                  <span>PORT 18880 · HTTP</span>
                  {gatewayStatus?.hermes?.latencyMs !== undefined && (
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>{gatewayStatus.hermes.latencyMs}ms</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {([
            { section: 'THE CREW', col: '#fbbf24', entries: [{ id: null, callSign: 'CREW COMMANDER', desc: 'Holds veto · Final GO/NO-GO', status: 'active' }] },
            { section: 'FLIGHT DIRECTOR', col: '#38bdf8', entries: [{ id: 'strategist', callSign: 'CORTEX CORE', desc: 'Owns console · Decides, never flies', status: 'idle' }] },
            {
              section: 'FLIGHT CONSOLES', col: '#67e8f9', entries: [
                { id: 'antigravity', callSign: 'GUIDANCE', desc: 'Strategy · Vision', status: 'idle' },
                { id: 'builder', callSign: 'FLT CONTROLS', desc: 'Execute · Builder', status: 'idle' },
                { id: 'runner', callSign: 'FLT CONTROLS', desc: 'Execute · Runner', status: 'idle' },
                { id: 'sentinel', callSign: 'EECOM', desc: 'Power/Compute · Model health', status: 'idle' },
                { id: 'capcom', callSign: 'CAPCOM', desc: 'Voice interface', status: 'idle' },
                { id: 'forecaster', callSign: 'FDO', desc: 'Trajectory · Forecasts', status: 'idle' },
                { id: 'warden', callSign: 'SURGEON', desc: 'Quality gate · Safety', status: 'idle' },
              ]
            },
            {
              section: 'SUPPORT CRAFT', col: '#a78bfa', entries: [
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
              )
            },
            {
              section: 'SOVEREIGN GATEWAYS & ENTERPRISE FLEET', col: '#ef4444', entries: [
                { id: 'hermes', callSign: 'HERMES', desc: 'Sovereign mutating tool host (:18880)', status: 'idle' },
                { id: 'curator', callSign: 'CURATOR', desc: 'Fleet intelligence & dynamic capabilities', status: 'idle' },
                { id: 'openclaw', callSign: 'OPENCLAW', desc: 'WebMCP browser copilot (:18789)', status: 'idle' },
                { id: 'claudecode', callSign: 'CLAUDE CODE', desc: 'Terminal architect & consensus auditor', status: 'idle' },
              ]
            },
            {
              section: 'GROUND SEGMENT', col: '#34d399', entries: [
                { id: null, callSign: 'LOCAL TOWER', desc: 'Mac host · voice loop · workspace', status: 'active' },
                { id: null, callSign: 'TDRS SATELLITE', desc: 'Oracle cloud · always-on node', status: 'idle' },
              ]
            },
          ] as { section: string; col: string; entries: { id: string | null; callSign: string; desc: string; status: string }[] }[]).map((sec) => (
            <div key={sec.section} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', color: sec.col, padding: '3px 2px 2px', borderBottom: `1px solid ${sec.col}33` }}>
                {sec.section}
              </div>
              {sec.entries.map((e) => {
                const a = e.id ? agents.find((x) => x.id === e.id) : null;
                let status = e.id ? (a?.status || 'offline') : e.status;
                let latencyText = '';
                if (e.id === 'openclaw') {
                  const gw = gatewayStatus?.openclaw;
                  if (gw) {
                    status = gw.status;
                    latencyText = gw.status === 'running' ? ` · ${gw.latencyMs ?? 0}ms` : ' · OFFLINE';
                  }
                } else if (e.id === 'hermes') {
                  const gw = gatewayStatus?.hermes;
                  if (gw) {
                    status = gw.status;
                    latencyText = gw.status === 'running' ? ` · ${gw.latencyMs ?? 0}ms` : ' · OFFLINE';
                  }
                }
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
                        <span style={{ color: DIM, fontSize: 9 }}> — {e.desc}{latencyText} · {status.toUpperCase()}</span>
                      </button>
                    ) : (
                      <span style={{ flex: 1, fontSize: 10.5, color: INK }}>
                        <span style={{ color: sec.col, fontWeight: 700 }}>{e.callSign}</span>
                        <span style={{ color: DIM, fontSize: 9 }}> — {e.desc}{latencyText} · {status.toUpperCase()}</span>
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
        <Panel title="THE COUNSEL — GO/NO-GO POLLS" onClose={() => setView(null)} right={
          <button onClick={() => { setView(null); onOpenTower(); }} style={{ background: 'none', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', fontFamily: MONO, fontSize: 9.5, padding: '2px 8px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.15em' }}>OPEN TOWER</button>
        }>
          {counsel === null && <div style={{ padding: '12px 0', color: DIM }}>LOADING…</div>}
          {counsel?.scorecard?.some((m: any) => m.grade || m.sessions > 0) && (
            <div style={{ marginBottom: 8, border: '1px solid rgba(192,132,252,0.18)', borderRadius: 3, padding: '6px 8px', background: 'rgba(192,132,252,0.04)' }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.22em', color: '#c084fc', marginBottom: 4 }}>CONSOLE SCORECARD — VERDICT ALIGNMENT</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
                {counsel.scorecard.filter((m: any) => m.id !== 'user').map((m: any) => (
                  <span key={m.id} title={m.flags?.length ? m.flags.join(' · ') : `${m.aligned}/${m.scored} aligned · ${m.positions} positions · ${m.rejected} rejected`} style={{ fontSize: 9, fontFamily: MONO }}>
                    <span style={{ color: DIM }}>{m.callSign.split(' ')[0]}</span>{' '}
                    <span style={{ color: !m.grade ? DIM : m.grade === 'A' ? '#34d399' : m.grade === 'B' ? '#7dd3fc' : m.grade === 'C' ? '#fbbf24' : '#f87171', fontWeight: 800 }}>
                      {m.grade || '—'}
                    </span>
                    {m.flags?.length ? <span style={{ color: '#f87171' }}> ⚑</span> : null}
                  </span>
                ))}
              </div>
            </div>
          )}
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
        <Panel title="INBOX — AWAITING YOUR DECISION" onClose={() => setView(null)} right={
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

      {view === 'messages' && (
        <Panel title="AGENT MESSAGE BUS" onClose={() => setView(null)} right={
          <span style={{ fontSize: 9.5, color: agentMsgs?.length ? '#67e8f9' : DIM }}>{agentMsgs?.length ?? '…'} MSGS</span>
        }>
          {agentMsgs === null && <div style={{ padding: '12px 0', color: DIM }}>LOADING…</div>}
          {agentMsgs !== null && !agentMsgs.length && <div style={{ padding: '12px 0', color: DIM }}>NO PEER TRAFFIC YET</div>}
          {(agentMsgs || []).slice().reverse().slice(0, 40).map((m: any) => {
            const stColor = m.status === 'consumed' ? '#34d399' : m.status === 'pending' ? '#fbbf24' : m.status === 'delivered' ? '#7dd3fc' : m.status === 'expired' ? '#64748b' : '#f87171';
            const typeColor = m.type === 'request' ? '#fbbf24' : m.type === 'handoff' ? '#38bdf8' : m.type === 'ack' ? '#34d399' : '#a78bfa';
            return (
              <div key={m.id} style={{ border: '1px solid rgba(103,232,249,0.12)', borderRadius: 3, padding: '6px 9px', marginBottom: 6, background: 'rgba(103,232,249,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: INK }}>{String(m.from).toUpperCase()} → {String(m.to).toUpperCase()}</span>
                  <span style={{ fontSize: 8.5, color: typeColor, letterSpacing: '0.12em', flexShrink: 0 }}>{m.priority === 'urgent' ? '⏫ ' : ''}{String(m.type).toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 10, color: DIM, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.payload}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <span style={{ fontSize: 8.5, color: DIM }}>{m.id}{m.correlationId ? ` · corr ${m.correlationId}` : ''}</span>
                  <span style={{ fontSize: 8.5, color: stColor, letterSpacing: '0.1em' }}>{String(m.status).toUpperCase()}</span>
                </div>
              </div>
            );
          })}
        </Panel>
      )}

      {view === 'voice' && (
        <Panel title="CORTEX VOICE — ENGINE STATUS" onClose={() => setView(null)} right={
          <button onClick={() => { setVoiceStatus(null); fetch('/api/cortex/tts/status', { cache: 'no-store' }).then((r) => r.json()).then(setVoiceStatus).catch(() => { }); }} style={{ background: 'none', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', fontFamily: MONO, fontSize: 9.5, padding: '2px 8px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.15em' }}>RE-PROBE</button>
        }>
          {voiceStatus === null && <div style={{ padding: '12px 0', color: DIM }}>PROBING ENGINES…</div>}
          {voiceStatus?.ok === false && <div style={{ padding: '12px 0', color: '#f87171' }}>STATUS ENDPOINT UNREACHABLE — VITE RESTART NEEDED?</div>}
          {voiceStatus?.engines && (
            <div style={{ marginBottom: 8 }}>
              {voiceStatus.engines.map((e: any) => (
                <Row key={e.id}>
                  <Lamp status={e.healthy ? 'healthy' : 'down'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: INK, fontWeight: 700 }}>{e.id.toUpperCase()}</div>
                    <div style={{ fontSize: 8.5, color: DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.url} · {e.role}</div>
                  </div>
                  <span style={{ fontSize: 8.5, color: e.healthy ? '#34d399' : '#f87171' }}>{e.healthy ? `${e.ms}ms` : 'DOWN'}</span>
                </Row>
              ))}
            </div>
          )}
          <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.22em', color: '#34d399', margin: '6px 0 4px' }}>VOICES — CLICK TEST TO HEAR{voiceConfig?.defaultVoice ? ` · DEFAULT: ${voiceConfig.defaultVoice.toUpperCase()}` : ''}</div>
          {(voiceStatus?.voices || []).map((v: any) => {
            const eng = voiceStatus?.engines?.find((e: any) => e.id === v.engine);
            const t = voiceTest[v.id] || 'idle';
            const isDefault = voiceConfig?.defaultVoice === v.id;
            return (
              <Row key={v.id}>
                <Lamp status={eng ? (eng.healthy ? 'healthy' : 'down') : 'idle'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: INK }}>{v.label}{isDefault ? <span style={{ color: '#34d399', fontSize: 8.5 }}> ◈ DEFAULT</span> : null}</div>
                  <div style={{ fontSize: 8.5, color: DIM }}>{v.id} → {v.engine}{eng && !eng.healthy ? ' (ENGINE DOWN)' : ''}</div>
                </div>
                <button
                  onClick={() => setDefaultVoice(v.id)}
                  title="Pin as Cortex default voice (survives restarts)"
                  style={{ background: isDefault ? 'rgba(52,211,153,0.18)' : 'none', border: `1px solid ${isDefault ? '#34d399' : 'rgba(251,191,36,0.3)'}`, color: isDefault ? '#34d399' : '#fbbf24', fontFamily: MONO, fontSize: 8.5, fontWeight: 700, padding: '3px 6px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.1em' }}
                >{isDefault ? 'PINNED' : 'SET'}</button>
                <button
                  onClick={() => testVoice(v.id)}
                  disabled={t === 'testing'}
                  style={{ background: t === 'ok' ? 'rgba(52,211,153,0.15)' : t === 'fail' ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.06)', border: `1px solid ${t === 'fail' ? 'rgba(248,113,113,0.5)' : 'rgba(52,211,153,0.35)'}`, color: t === 'fail' ? '#f87171' : '#34d399', fontFamily: MONO, fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 2, cursor: t === 'testing' ? 'wait' : 'pointer', letterSpacing: '0.12em' }}
                >{t === 'testing' ? '…' : t === 'ok' ? '✓' : t === 'fail' ? 'RETRY' : 'TEST'}</button>
              </Row>
            );
          })}
          {!voiceStatus?.voices?.length && voiceStatus !== null && <div style={{ padding: '8px 0', color: DIM, fontSize: 9.5 }}>NO VOICE DATA</div>}
        </Panel>
      )}

      {view === 'incidents' && (
        <Panel title="INCIDENT LEDGER" onClose={() => setView(null)} right={incidents === null ? <span style={{ fontSize: 9.5, color: DIM }}>LOADING…</span> : <span style={{ fontSize: 9.5, color: DIM }}>{incidents.filter((i) => i.status === 'open').length} OPEN</span>}>
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

      {view === 'pipeline' && (() => {
        const q = pipeline?.queue;
        const counts = q?.counts || {};
        const typeCounts: Record<string, number> = q?.typeCounts || {};
        const attention: any[] = q?.attention || [];
        const recent: any[] = q?.recent || [];
        // Venture scope derived from queue type prefixes — omni_*,
        // govtech_*/sam_gov_* → venture, everything else → GENERAL.
        const ventureOf = (t: string) =>
          t?.startsWith('omni') ? 'OMNI'
            : (t?.startsWith('govtech') || t?.startsWith('sam_gov')) ? 'GOVTECH'
              : 'GENERAL';
        const ventureCounts: Record<string, number> = {};
        for (const [t, n] of Object.entries(typeCounts)) {
          const v = ventureOf(t);
          ventureCounts[v] = (ventureCounts[v] || 0) + (n as number);
        }
        const age = (ts: number | null | undefined) => {
          if (!ts) return '';
          const m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
          if (m < 60) return `${m}m`;
          const h = Math.floor(m / 60);
          if (h < 48) return `${h}h`;
          return `${Math.floor(h / 24)}d`;
        };
        const VCOLOR: Record<string, string> = { OMNI: '#34d399', GOVTECH: '#fbbf24', GENERAL: '#67e8f9' };
        return (
          <Panel title="DISTRIBUTION PIPELINE" onClose={() => setView(null)}>
            {pipeline === null && <div style={{ padding: '12px 0', color: DIM }}>LOADING…</div>}
            {pipeline && !pipeline.error && (
              <div>
                {/* Queue depth + distributor health */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#34d399' }}>✓{counts.done || 0}</span>
                  <span style={{ color: '#fbbf24' }}>◌{counts.pending || 0}</span>
                  <span style={{ color: '#f87171' }}>✗{counts.failed || 0}</span>
                  <span style={{ color: 'rgba(148,163,184,0.3)' }}>|</span>
                  {pipeline.distributor ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Lamp status={pipeline.distributor.status} />
                      <span style={{ color: DIM }}>DISTRIBUTOR {pipeline.distributor.status}</span>
                      <span style={{ color: DIM }}>· {pipeline.distributor.tasksCompleted || 0}✓ {pipeline.distributor.tasksFailed || 0}✗</span>
                    </span>
                  ) : <span style={{ color: '#f87171' }}>DISTRIBUTOR NOT REGISTERED</span>}
                </div>

                {/* Venture scope chips — derived from queue type prefixes */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {['OMNI', 'GOVTECH', 'GENERAL'].map((v) => (
                    <span key={v} style={{
                      fontSize: 9, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 2,
                      border: `1px solid ${VCOLOR[v]}55`, color: VCOLOR[v],
                      background: `${VCOLOR[v]}0d`,
                    }}>{v} {ventureCounts[v] || 0}</span>
                  ))}
                  <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.4)', alignSelf: 'center' }}>scope = queue type prefix</span>
                </div>

                {/* Attention: failed + pending items needing Crew eyes */}
                {attention.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9.5, letterSpacing: '0.2em', color: '#fbbf24', marginBottom: 4 }}>ATTENTION ({attention.length})</div>
                    {attention.map((i: any) => (
                      <Row key={i.id}>
                        <span style={{ color: i.status === 'failed' ? '#f87171' : '#fbbf24', width: 10, flexShrink: 0 }}>{i.status === 'failed' ? '✗' : '◌'}</span>
                        <span style={{ color: '#67e8f9', flexShrink: 0 }}>{i.type}</span>
                        <span style={{ color: 'rgba(148,163,184,0.45)', flexShrink: 0 }}>{age(i.createdAt)} ago{(i.attempts || 0) > 1 ? ` ×${i.attempts}` : ''}</span>
                        <span style={{ color: 'rgba(248,113,113,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.error || ''}</span>
                      </Row>
                    ))}
                  </div>
                )}

                {/* Recent completed flow */}
                {recent.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9.5, letterSpacing: '0.2em', color: DIM, marginBottom: 4 }}>RECENT</div>
                    {recent.slice().reverse().map((i: any) => (
                      <Row key={i.id}>
                        <span style={{ color: i.status === 'done' ? '#34d399' : i.status === 'failed' ? '#f87171' : '#fbbf24', width: 10, flexShrink: 0 }}>{i.status === 'done' ? '✓' : i.status === 'failed' ? '✗' : '◌'}</span>
                        <span style={{ color: '#67e8f9', flexShrink: 0 }}>{i.type}</span>
                        <span style={{ color: VCOLOR[ventureOf(i.type)], fontSize: 9 }}>{ventureOf(i.type)}</span>
                      </Row>
                    ))}
                  </div>
                )}

                {!attention.length && !recent.length && (
                  <div style={{ padding: '12px 0', color: DIM }}>QUEUE EMPTY — NO DISTRIBUTION ITEMS</div>
                )}

                {/* Launch log tail — readable last lines, not JSON */}
                {pipeline.launchLogTail && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(148,163,184,0.1)' }}>
                    <div style={{ fontSize: 9.5, letterSpacing: '0.2em', color: DIM, marginBottom: 4 }}>LAUNCH LOG</div>
                    <pre style={{ fontSize: 9, color: 'rgba(148,163,184,0.6)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, maxHeight: 90, overflow: 'hidden' }}>
                      {pipeline.launchLogTail.slice(-900)}
                    </pre>
                  </div>
                )}
              </div>
            )}
            {pipeline?.error && <div style={{ padding: '12px 0', color: '#f87171' }}>PIPELINE STATUS UNREACHABLE</div>}
          </Panel>
        );
      })()}

      {view === 'standup' && (
        <Panel
          title="FLEET STANDUP & ROLL CALL (06:00 AM)"
          onClose={() => setView(null)}
          right={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={() => triggerRollCall('A')}
                disabled={runningStandup}
                style={{
                  background: runningStandup ? 'rgba(56,189,248,0.1)' : 'rgba(52,211,153,0.15)',
                  border: '1px solid rgba(52,211,153,0.5)',
                  color: runningStandup ? '#38bdf8' : '#34d399',
                  fontFamily: MONO,
                  fontSize: 9.5,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 2,
                  cursor: runningStandup ? 'wait' : 'pointer',
                  letterSpacing: '0.12em',
                }}
              >
                {runningStandup ? 'PROBING FLEET…' : '⚡ RUN ROLL CALL'}
              </button>
            </div>
          }
        >
          {standupNote && (
            <div
              style={{
                fontSize: 10,
                color: standupNote.startsWith('ROLL CALL FAILED') || standupNote.startsWith('APPROVAL FAILED')
                  ? '#f87171'
                  : '#34d399',
                marginBottom: 8,
                padding: '4px 6px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 2,
              }}
            >
              {standupNote}
            </div>
          )}

          {standup === null && <div style={{ padding: '12px 0', color: DIM }}>LOADING FLEET TELEMETRY…</div>}

          {standup && !standup.morning && (
            <div style={{ padding: '12px 0', color: DIM }}>
              NO MORNING ROLL CALL RECORDED YET TODAY. CLICK "RUN ROLL CALL" TO PROBE ALL 22 AGENTS.
            </div>
          )}

          {standup?.morning && (() => {
            const m = standup.morning;
            const checkIns: any[] = Array.isArray(m.checkIns) ? m.checkIns : Object.values(m.checkIns || {});
            const filtered = checkIns.filter((c: any) => {
              if (standupFilter === 'ready') return c.status === 'healthy';
              if (standupFilter === 'degraded') return c.status === 'degraded' || c.status === 'offline';
              return true;
            });

            return (
              <div>
                {/* Summary Banner */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 6,
                    padding: '8px 10px',
                    marginBottom: 10,
                    background: 'rgba(56,189,248,0.04)',
                    border: '1px solid rgba(56,189,248,0.18)',
                    borderRadius: 3,
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 9, color: DIM }}>AGENTS</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{m.totalAgents}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#34d399' }}>READY</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>{m.healthyCount}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#fbbf24' }}>DEGRADED</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{m.degradedCount}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#f87171' }}>OFFLINE</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>{m.offlineCount}</div>
                  </div>
                </div>

                {/* Filter Pills & Arm Meta */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                    fontSize: 9,
                  }}
                >
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['all', 'ready', 'degraded'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setStandupFilter(f)}
                        style={{
                          background: standupFilter === f ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${standupFilter === f ? '#38bdf8' : 'rgba(148,163,184,0.2)'}`,
                          color: standupFilter === f ? '#38bdf8' : DIM,
                          fontFamily: MONO,
                          fontSize: 8.5,
                          padding: '2px 6px',
                          borderRadius: 2,
                          cursor: 'pointer',
                        }}
                      >
                        {f === 'all'
                          ? `ALL (${checkIns.length})`
                          : f === 'ready'
                            ? `READY (${m.healthyCount})`
                            : `DEGRADED (${m.degradedCount + m.offlineCount})`}
                      </button>
                    ))}
                  </div>
                  <span style={{ color: DIM }}>ARM {m.arm || 'A'} · {String(m.timestamp || '').slice(11, 19)}</span>
                </div>

                {/* Agent Check-In Cards */}
                {filtered.map((c: any) => {
                  const p = c.probeTelemetry || {};
                  const isDegraded = c.status === 'degraded';
                  const isOffline = c.status === 'offline';
                  const cardBorder = isOffline
                    ? 'rgba(248,113,113,0.3)'
                    : isDegraded
                      ? 'rgba(251,191,36,0.3)'
                      : 'rgba(56,189,248,0.12)';
                  const cardBg = isOffline
                    ? 'rgba(248,113,113,0.04)'
                    : isDegraded
                      ? 'rgba(251,191,36,0.04)'
                      : 'rgba(15,23,42,0.4)';

                  return (
                    <div
                      key={c.agentId}
                      style={{
                        border: `1px solid ${cardBorder}`,
                        borderRadius: 3,
                        padding: '7px 9px',
                        marginBottom: 7,
                        background: cardBg,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Lamp status={c.status} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: INK }}>
                            {c.agentName || c.agentId.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 8.5, color: DIM }}>
                            ({c.tier || 'fleet'})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 8.5 }}>
                          <span style={{ color: DIM }}>{c.latencyMs}ms</span>
                          <span
                            style={{
                              color: isOffline ? '#f87171' : isDegraded ? '#fbbf24' : '#34d399',
                              fontWeight: 700,
                            }}
                          >
                            {c.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Diagnostic telemetry note */}
                      <div style={{ fontSize: 8.5, color: DIM, marginTop: 4 }}>
                        {p.toolEvidence
                          ? p.toolEvidence
                          : p.daemonResponding === false
                            ? 'Daemon: offline'
                            : `Reachability: ${p.reachability || c.status}`}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </div>

                      {/* Daily Mission Bid */}
                      {c.dailyMissionBid && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '5px 7px',
                            background: 'rgba(56,189,248,0.05)',
                            borderLeft: '2px solid #38bdf8',
                            borderRadius: 2,
                          }}
                        >
                          <div style={{ fontSize: 9.5, color: INK, fontWeight: 600 }}>
                            🎯 {c.dailyMissionBid.missionTitle}
                          </div>
                          <div style={{ fontSize: 8.5, color: DIM, marginTop: 2 }}>
                            {c.dailyMissionBid.initiative}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginTop: 5,
                            }}
                          >
                            <span style={{ fontSize: 8, color: '#67e8f9' }}>
                              Conf: {Math.round((c.dailyMissionBid.confidence || 0) * 100)}% · Impact: {c.dailyMissionBid.targetImpact || 'medium'}
                            </span>
                            <button
                              onClick={() => approveBid(`proposal-${c.agentId}-${new Date().toISOString().slice(0, 10)}`)}
                              style={{
                                background: 'rgba(52,211,153,0.12)',
                                border: '1px solid rgba(52,211,153,0.45)',
                                color: '#34d399',
                                fontFamily: MONO,
                                fontSize: 8,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 2,
                                cursor: 'pointer',
                                letterSpacing: '0.1em',
                              }}
                            >
                              [ ⚡ APPROVE ]
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Evening Retrospective section if available */}
                {standup?.evening && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '8px 10px',
                      background: 'rgba(192,132,252,0.05)',
                      border: '1px solid rgba(192,132,252,0.2)',
                      borderRadius: 3,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#c084fc', marginBottom: 4 }}>
                      EVENING RETROSPECTIVE (20:00 PM)
                    </div>
                    <div style={{ fontSize: 9, color: DIM }}>
                      Verified: {standup.evening.verifiedAccomplishments?.length || 0} tasks · Blockers: {standup.evening.reconciledBlockers?.length || 0} · Tomorrow Handoffs: {standup.evening.tomorrowHandoffs?.length || 0}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Panel>
      )}

      {view === 'ventures' && (
        <Panel title="VENTURES — ENTERPRISE SCOPE" onClose={() => setView(null)} right={
          ventures === null ? <span style={{ fontSize: 9.5, color: DIM }}>LOADING…</span> : <span style={{ fontSize: 9.5, color: DIM }}>{(ventures.ventures || []).length} REGISTERED</span>
        }>
          {ventures === null && <div style={{ padding: '16px 0', color: DIM }}>PROBING REGISTRY…</div>}
          {ventures !== null && !(ventures.ventures || []).length && <div style={{ padding: '16px 0', color: DIM }}>NO VENTURES REGISTERED — SEE .cortex-runtime/ventures.json</div>}
          {(ventures?.ventures || []).map((v: any) => {
            const y = v.yield7d || { runs: 0, completions: 0 };
            const yieldRate = y.runs ? Math.round((y.completions / y.runs) * 100) : null;
            const d = v.distribution || { pending: 0, done: 0, failed: 0 };
            return (
              <div key={v.id} style={{
                border: '1px solid rgba(167,139,250,0.22)', borderLeft: `3px solid ${v.status === 'active' ? '#a78bfa' : DIM}`,
                borderRadius: 3, padding: '8px 10px', marginBottom: 8, background: 'rgba(167,139,250,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#c4b5fd', letterSpacing: '0.12em' }}>{v.callSign || v.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Lamp status={v.status === 'active' ? 'healthy' : v.status === 'dormant' ? 'idle' : 'cancelled'} />
                    <span style={{ fontSize: 8, color: DIM, letterSpacing: '0.1em' }}>{String(v.status || 'active').toUpperCase()}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 9, color: DIM, marginBottom: 4 }}>
                  <span>OPEN TASKS <b style={{ color: INK }}>{v.openTasks ?? 0}</b></span>
                  <span>GOALS <b style={{ color: INK }}>{v.goals ?? 0}</b></span>
                  <span>OPS <b style={{ color: INK }}>{v.opsItems ?? 0}</b></span>
                  <span>BLOCKS <b style={{ color: INK }}>{v.openBlocks ?? 0}</b></span>
                  <span>DIST <b style={{ color: INK }}>{d.pending}◌ {d.done}✓ {d.failed}✗</b></span>
                  <span>YIELD 7D <b style={{ color: INK }}>{y.runs} runs{yieldRate != null ? ` · ${yieldRate}%` : ''}</b></span>
                </div>
                {(v.evidencePaths || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {v.evidencePaths.map((ep: string) => (
                      <span key={ep} style={{ fontSize: 7.5, color: 'rgba(103,232,249,0.6)', border: '1px solid rgba(103,232,249,0.15)', borderRadius: 2, padding: '0 4px' }}>{ep}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {(ventures?.unregisteredYield || []).length > 0 && (
            <div style={{ fontSize: 9, color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 3, padding: '6px 8px', marginTop: 4 }}>
              UNREGISTERED YIELD ACTIVITY: {ventures!.unregisteredYield!.join(', ')} — work exists outside the registry; register or re-scope it.
            </div>
          )}
          <div style={{ fontSize: 8, color: DIM, marginTop: 8, lineHeight: 1.6 }}>
            Venture scope is a filter dimension on TASKS — tasks, goals, ops items, and mission blocks carry ventureId. Untagged work counts under CORTEX. Registry: .cortex-runtime/ventures.json
          </div>
        </Panel>
      )}
    </>
  );
}
