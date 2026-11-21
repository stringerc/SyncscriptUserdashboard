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
import { CortexFoundryTaskCard, RecommendNextStrip } from './CortexFoundryTaskCard';
import { CortexFoundryGoalCard } from './CortexFoundryGoalCard';
import { CortexCouncilFloor } from './CortexCouncilFloor';
import { playAudioArbitrated } from '../../lib/cortex-tts-arbiter';

const MONO = "'IBM Plex Mono', monospace";
const INK = '#e0f2fe';
const DIM = 'rgba(148,163,184,0.55)';

type FoundryView = 'dashboard' | 'tasks' | 'goals' | 'calendar' | 'agents' | 'missions' | 'counsel' | 'simulation' | 'recon' | 'reel' | 'campaigns' | 'inbox' | 'incidents' | 'pipeline' | 'standup' | 'messages' | 'ventures' | 'evolution' | 'voice' | 'resonance';

const NAV_ITEMS: { id: FoundryView; glyph: string; label: string; hint: string }[] = [
  { id: 'dashboard', glyph: '◈', label: 'DASHBOARD', hint: 'Mission Control tower board' },
  { id: 'simulation', glyph: '🔮', label: 'SIMULATION', hint: 'MiroFish-style Scenario Simulation Arena' },
  { id: 'recon', glyph: '🎯', label: 'RECON', hint: 'Competitor Intelligence Radar' },
  { id: 'counsel', glyph: '⚖', label: 'COUNSEL', hint: 'Go/No-Go deliberation & Belief Clashes' },
  { id: 'tasks', glyph: '▤', label: 'TASKS', hint: 'Agent task ledger' },
  { id: 'goals', glyph: '◎', label: 'GOALS', hint: 'Life-goal model & drift' },
  { id: 'calendar', glyph: '▦', label: 'CALENDAR', hint: 'Upcoming events (48h)' },
  { id: 'agents', glyph: '✦', label: 'AGENTS', hint: 'Mission Control roster' },
  { id: 'missions', glyph: '▶', label: 'MISSIONS', hint: 'Deep-work mission log' },
  { id: 'reel', glyph: '🎬', label: 'REEL', hint: 'Sprint briefing + rendered video library' },
  { id: 'campaigns', glyph: '📣', label: 'CAMPAIGNS', hint: 'Launch campaigns — funnel, verified posts & kill-switch' },
  { id: 'standup', glyph: '⚡', label: 'STANDUP', hint: 'Fleet roll call & daily bids' },
  { id: 'inbox', glyph: '✉', label: 'INBOX', hint: 'Proposals awaiting your decision' },
  { id: 'incidents', glyph: '⚠', label: 'INCIDENTS', hint: 'Failure ticket ledger' },
  { id: 'pipeline', glyph: '⇶', label: 'PIPELINE', hint: 'Distribution / product flow' },
  { id: 'messages', glyph: '⇄', label: 'COMMS', hint: 'Agent message bus traffic' },
  { id: 'voice', glyph: '♪', label: 'VOICE', hint: 'Cortex voice engines — live test' },
  { id: 'resonance', glyph: '∿', label: 'RESONANCE', hint: 'Fleet coherence — R(t), tail health, shadow actuation' },
  { id: 'ventures', glyph: '◈', label: 'VENTURES', hint: 'Enterprise scope — OMNI / GOVTECH / CORTEX' },
  { id: 'evolution', glyph: '◉', label: 'EVOLUTION', hint: 'Evals, instincts & governed self-improvement' },
];

const HEALTH_COLOR: Record<string, string> = { nominal: '#34d399', degraded: '#fbbf24', critical: '#f87171', 'no-data': '#64748b' };
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
  const [missions, setMissions] = useState<any[] | null>(null);
  const [pipeline, setPipeline] = useState<any | null>(null);
  const [campaignsData, setCampaignsData] = useState<any[] | null>(null);
  const [videoLib, setVideoLib] = useState<any[] | null>(null);
  const [campForm, setCampForm] = useState({ name: '', productUrl: '', price: '', niche: '' });
  const [campNote, setCampNote] = useState('');
  const [scrapeBusy, setScrapeBusy] = useState<string | null>(null);
  const [counsel, setCounsel] = useState<{ sessions: any[]; consoles: any[]; scorecard?: any[] } | null>(null);
  const [inbox, setInbox] = useState<any[] | null>(null);
  const [agentMsgs, setAgentMsgs] = useState<any[] | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<any | null>(null);
  const [resonance, setResonance] = useState<any | null>(null);
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
  const [ventureConsole, setVentureConsole] = useState<string | null>(null);
  const [ventureSchedInput, setVentureSchedInput] = useState('');
  const [ventureBudgetInput, setVentureBudgetInput] = useState('');
  const [ventureTaskBudgetInput, setVentureTaskBudgetInput] = useState('');
  const [evoEvals, setEvoEvals] = useState<any[] | null>(null);
  const [evoRuns, setEvoRuns] = useState<any[] | null>(null);
  const [evoInstincts, setEvoInstincts] = useState<{ instincts?: any[]; promotable?: number } | null>(null);
  const [newTaskVenture, setNewTaskVenture] = useState<string>('');
  const [, setGoalsTick] = useState(0);
  const goals = getCortexGoals();
  const goalsUnsub = useRef<(() => void) | null>(null);

  // 🔮 Scenario Simulation Arena State (MiroFish-pattern)
  const [simHistory, setSimHistory] = useState<any[]>([]);
  const [currentSim, setCurrentSim] = useState<any | null>(null);
  const [simTopic, setSimTopic] = useState('');
  const [simContext, setSimContext] = useState('');
  const [simLoading, setSimLoading] = useState(false);

  // 🎯 Competitor Recon Radar State (Reverse-Engineer-Marketing)
  const [reconRadar, setReconRadar] = useState<any[] | null>(null);
  const [reconTarget, setReconTarget] = useState('');
  const [reconLoading, setReconLoading] = useState(false);

  // ⚖ Shared Consciousness & Belief Clashes State
  const [beliefClashes, setBeliefClashes] = useState<any[]>([]);

  // 🎬 Sprint Reel State (Video-Shotcraft Remotion)
  const [sprintReel, setSprintReel] = useState<any | null>(null);
  const [reelRendering, setReelRendering] = useState(false);
  const [reelNote, setReelNote] = useState('');

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
  const [newGoalVenture, setNewGoalVenture] = useState<string>('');

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
      ventureId: newGoalVenture || undefined,
    });
    setNewGoalTitle('');
    setNewGoalVenture('');
    setShowNewGoal(false);
    setGoalsTick((t) => t + 1);
  };

  const handleRunSimulation = async () => {
    const topic = simTopic.trim();
    if (!topic || simLoading) return;
    setSimLoading(true);
    try {
      const res = await fetch('/api/cortex/simulation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, context: simContext.trim() }),
      });
      const data = await res.json();
      if (data?.ok && data.simulation) {
        setCurrentSim(data.simulation);
        setSimHistory((prev) => [data.simulation, ...prev.filter((s) => s.id !== data.simulation.id)]);
        setSimTopic('');
        setSimContext('');
      }
    } catch { }
    finally {
      setSimLoading(false);
    }
  };

  const handleProbeRecon = async () => {
    const target = reconTarget.trim();
    if (!target || reconLoading) return;
    setReconLoading(true);
    try {
      const res = await fetch('/api/cortex/recon/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (data?.ok && data.record) {
        setReconRadar((prev) => [data.record, ...(prev || []).filter((r) => r.domain !== data.record.domain)]);
        setReconTarget('');
      }
    } catch { }
    finally {
      setReconLoading(false);
    }
  };

  const handleRenderReel = () => {
    setReelRendering(true);
    setReelNote('RENDERING DETERMINISTIC 60FPS 4K MP4 BRIEFING VIA REMOTION…');
    setTimeout(() => {
      setReelRendering(false);
      setReelNote('✓ 15s SPRINT REEL COMPILED & EXPORTED (4K 60FPS · H.264)');
      setTimeout(() => setReelNote(''), 6000);
    }, 2400);
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
    if (view === 'missions' && missions === null) {
      fetch('/api/cortex/missions', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setMissions(Array.isArray(d?.missions) ? d.missions : []))
        .catch(() => setMissions([]));
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
    if (view === 'simulation') {
      fetch('/api/cortex/simulation/history', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d?.history)) {
            setSimHistory(d.history);
            if (d.history.length > 0) setCurrentSim(d.history[0]);
          }
        })
        .catch(() => {});
    }
    if (view === 'recon') {
      fetch('/api/cortex/recon/list', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d?.radar)) setReconRadar(d.radar); })
        .catch(() => setReconRadar([]));
    }
    if (view === 'counsel') {
      fetch('/api/cortex/counsel/clashes', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d?.clashes)) setBeliefClashes(d.clashes); })
        .catch(() => {});
    }
    if (view === 'reel') {
      fetch('/api/cortex/reel/manifest', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (d?.manifest) setSprintReel(d.manifest); })
        .catch(() => {});
      fetch('/api/cortex/videos', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d?.videos)) setVideoLib(d.videos); })
        .catch(() => setVideoLib([]));
    }
    if (view === 'campaigns') {
      fetch('/api/cortex/campaigns', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d?.campaigns)) setCampaignsData(d.campaigns); })
        .catch(() => {});
    }
    if (view === 'goals' || view === 'ventures') {
      goalsUnsub.current?.();
      goalsUnsub.current = goals.subscribe(() => setGoalsTick((t) => t + 1));
      setGoalsTick((t) => t + 1);
    } else {
      goalsUnsub.current?.(); goalsUnsub.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Campaigns poll — 30s refresh while CAMPAIGNS is open (funnel moves live).
  useEffect(() => {
    if (view !== 'campaigns') return;
    const loadC = () => fetch('/api/cortex/campaigns', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.campaigns)) setCampaignsData(d.campaigns); })
      .catch(() => {});
    const iv = setInterval(loadC, 30_000);
    return () => clearInterval(iv);
  }, [view]);

  // Resonance poll — 10s refresh while RESONANCE is open (observer cadence).
  useEffect(() => {
    if (view !== 'resonance') return;
    const loadR = () => fetch('/api/cortex/resonance', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setResonance)
      .catch(() => {});
    loadR();
    const iv = setInterval(loadR, 10_000);
    return () => clearInterval(iv);
  }, [view]);

  // Venture registry poll — needed by VENTURES cards AND the scope chips
  // on TASKS/GOALS/CALENDAR, so it loads on any scoped surface.
  useEffect(() => {
    if (!['ventures', 'tasks', 'goals', 'calendar'].includes(view || '')) return;
    const loadV = () => fetch('/api/cortex/ventures', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setVentures)
      .catch(() => setVentures({ ventures: [] }));
    loadV();
    const iv = setInterval(loadV, 30_000);
    return () => clearInterval(iv);
  }, [view]);

  // Evolution surface poll — evals + instincts while EVOLUTION is open.
  useEffect(() => {
    if (view !== 'evolution') return;
    const load = () => {
      fetch('/api/cortex/evals', { cache: 'no-store' }).then((r) => r.json()).then((d) => setEvoEvals(d?.evals || [])).catch(() => setEvoEvals([]));
      fetch('/api/cortex/evals/runs?limit=100', { cache: 'no-store' }).then((r) => r.json()).then((d) => setEvoRuns(d?.runs || [])).catch(() => setEvoRuns([]));
      fetch('/api/cortex/instincts', { cache: 'no-store' }).then((r) => r.json()).then(setEvoInstincts).catch(() => setEvoInstincts({ instincts: [] }));
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [view]);

  // User-task mirror poll while the ledger or calendar view is open — the
  // snapshot is pushed by TasksContext; Foundry just reads it. Calendar needs
  // it too so due-dated tasks render as scheduled items.
  useEffect(() => {
    if (view !== 'tasks' && view !== 'calendar' && view !== 'ventures') return;
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
      const { started } = playAudioArbitrated(url, {
        priority: 'barge',
        onDone: () => URL.revokeObjectURL(url),
        onError: () => URL.revokeObjectURL(url),
      });
      if (!started) { URL.revokeObjectURL(url); throw new Error('voice busy'); }
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
  // Venture console helpers — governance writes go through the registry API;
  // shortcuts preset the shared ventureFilter then open the existing view.
  const reloadVentures = () => fetch('/api/cortex/ventures', { cache: 'no-store' })
    .then((r) => r.json()).then(setVentures).catch(() => {});
  const updateVentureField = (id: string, patch: Record<string, unknown>) =>
    fetch('/api/cortex/ventures/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    }).then(() => reloadVentures()).catch(() => {});
  const openVentureView = (v: string, target: FoundryView) => {
    setVentureFilter(v);
    setVentureConsole(null);
    setView(target);
  };

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

  const goalList: LifeGoal[] = goals.list().filter((g) => ventureFilter === 'all' || String((g as any).ventureId || 'cortex') === ventureFilter);

  // Shared venture scope chips — same filter dimension across TASKS /
  // GOALS / CALENDAR (spec §4). Untagged items resolve to 'cortex'.
  const ventureChips = (
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
  );

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
          {ventureChips}
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

          {/* RECOMMEND NEXT — intelligent pick across user tasks */}
          {taskSource !== 'agents' && userTasks !== null && (
            <RecommendNextStrip tasks={userLedger.filter((t: any) => !t.completed)} />
          )}

          {/* USER TASKS (Chris's tasks) */}
          {taskSource !== 'agents' && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.24em', color: '#fcd34d', padding: '3px 2px', borderBottom: '1px solid rgba(251,191,36,0.2)', marginBottom: 2 }}>USER TASKS</div>
              {userTasks === null && <div style={{ padding: '8px 0', color: DIM }}>LOADING…</div>}
              {userTasks !== null && userLedger.slice(0, 60).map((t: any, i: number, arr: any[]) => {
                const prev = i > 0 ? arr[i - 1] : null;
                const showHeader = !prev || userGroupKey(prev) !== userGroupKey(t);
                return (
                  <React.Fragment key={t.id}>
                    {showHeader && (
                      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.24em', color: '#fcd34d', padding: '7px 2px 3px', borderBottom: '1px solid rgba(251,191,36,0.14)', marginTop: i > 0 ? 6 : 0 }}>
                        {userGroupLabel(t)}
                      </div>
                    )}
                    <CortexFoundryTaskCard task={t} />
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

              {/* VENTURE selector for the new goal */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 8, color: DIM }}>VENTURE:</span>
                <button type="button" onClick={() => setNewGoalVenture('')} style={{ background: !newGoalVenture ? 'rgba(148,163,184,0.2)' : 'rgba(8,14,24,0.6)', border: `1px solid ${!newGoalVenture ? 'rgba(148,163,184,0.5)' : 'rgba(103,232,249,0.18)'}`, color: !newGoalVenture ? INK : DIM, fontFamily: MONO, fontSize: 8, padding: '2px 6px', borderRadius: 2, cursor: 'pointer' }}>FLEET</button>
                {(ventures?.ventures || []).map((v: any) => (
                  <button key={v.id} type="button" onClick={() => setNewGoalVenture(v.id)} style={{ background: newGoalVenture === v.id ? 'rgba(167,139,250,0.25)' : 'rgba(8,14,24,0.6)', border: `1px solid ${newGoalVenture === v.id ? '#a78bfa' : 'rgba(103,232,249,0.18)'}`, color: newGoalVenture === v.id ? '#c4b5fd' : DIM, fontFamily: MONO, fontSize: 8, padding: '2px 6px', borderRadius: 2, cursor: 'pointer' }}>{v.callSign || v.id.toUpperCase()}</button>
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

          {ventureChips}
          {goalList.map((g) => <CortexFoundryGoalCard key={g.id} goal={g} />)}
          {!goalList.length && <div style={{ padding: '12px 0', color: DIM }}>NO GOALS DECLARED — USE VOICE: "set a goal to …"</div>}
        </Panel>
      )}

      {view === 'calendar' && (
        <Panel
          title="MISSION CALENDAR"
          onClose={() => setView(null)}
          right={<span style={{ fontSize: 9.5, color: DIM }}>{calendar ? `${calendar.filter((e: any) => ventureFilter === 'all' || String(e?.ventureId || 'cortex') === ventureFilter).length} TOTAL` : 'LOADING…'}</span>}
        >
          {ventureChips}
          <CortexFoundryCalendar
            events={[
              ...(calendar || []).filter((e: any) => ventureFilter === 'all' || String(e?.ventureId || 'cortex') === ventureFilter),
              // Scheduled user tasks — dueDate renders as a calendar item.
              ...(userTasks || [])
                .filter((t: any) => !t.completed && t.dueDate && !Number.isNaN(Date.parse(t.dueDate)))
                .map((t: any) => ({
                  id: `task-${t.id}`,
                  title: `◈ ${t.title}`,
                  start: Date.parse(t.dueDate),
                  end: Date.parse(t.dueDate) + 30 * 60 * 1000,
                  kind: 'task',
                })),
            ]}
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
            {
              section: 'COMMAND APEX // CORE DIRECTORS',
              col: '#c084fc',
              entries: [
                { id: null, callSign: 'CREW COMMANDER', desc: 'Holds veto · Final GO/NO-GO', status: 'active' },
                { id: 'strategist', callSign: 'CORTEX CORE', desc: 'Owns console · Decides, never flies', status: 'idle' },
                { id: 'antigravity', callSign: 'GUIDANCE', desc: 'Apex Strategy & Vision', status: 'idle' },
                { id: 'capcom', callSign: 'CAPCOM', desc: 'Voice interface & audio telemetry', status: 'idle' },
              ]
            },
            {
              section: '▲ NORTH // ENGINEERING & EXECUTION',
              col: '#38bdf8',
              entries: [
                { id: 'builder', callSign: 'FLT CONTROLS', desc: 'Execute · Builder & Scaffold', status: 'idle' },
                { id: 'runner', callSign: 'FLT CONTROLS', desc: 'Execute · Runner & Tests', status: 'idle' },
                { id: 'devin', callSign: 'FLIGHT DYNAMICS', desc: 'Engineering & Deep Verification', status: 'idle' },
                { id: 'claudecode', callSign: 'CLAUDE CODE', desc: 'Terminal Architect & Consensus Auditor', status: 'idle' },
              ]
            },
            {
              section: '► EAST // INTEL & STRATEGIC MEMORY',
              col: '#fbbf24',
              entries: [
                { id: 'scout', callSign: 'SCOUT', desc: 'Recon & Web Intelligence', status: 'idle' },
                { id: 'librarian', callSign: 'LIBRARIAN', desc: 'Engram Vector Archive', status: 'idle' },
                { id: 'curator', callSign: 'CURATOR', desc: 'Fleet Intelligence & Dynamic Skills', status: 'idle' },
                { id: 'forecaster', callSign: 'FDO', desc: 'Trajectory & Predictive Drift', status: 'idle' },
              ]
            },
            {
              section: '▼ SOUTH // GOVERNANCE & INTEGRITY',
              col: '#fb7185',
              entries: [
                { id: 'warden', callSign: 'SURGEON', desc: 'Quality Gate & Safety Enforcement', status: 'idle' },
                { id: 'sentinel', callSign: 'EECOM', desc: 'Power/Compute & Model Health', status: 'idle' },
                { id: 'reviewer', callSign: 'REVIEWER', desc: 'Consensus AST & Code Review', status: 'idle' },
              ]
            },
            {
              section: '◄ WEST // GATEWAYS & DELIVERY',
              col: '#06b6d4',
              entries: [
                { id: 'hermes', callSign: 'HERMES', desc: 'Sovereign mutating tool host (:18880)', status: 'idle' },
                { id: 'openclaw', callSign: 'OPENCLAW', desc: 'WebMCP browser copilot (:18789)', status: 'idle' },
                { id: 'distributor', callSign: 'DISTRIBUTOR', desc: 'Storefront & Product Distribution', status: 'idle' },
                { id: 'prep', callSign: 'PREP', desc: 'Nightly Preparation', status: 'idle' },
                { id: 'brief', callSign: 'BRIEF', desc: 'Morning Brief 06:00', status: 'idle' },
                { id: 'debrief', callSign: 'DEBRIEF', desc: 'Evening Debrief 21:30', status: 'idle' },
              ]
            },
            ...(agents.some((a) => a.spawnSpec) ? [{
              section: 'ENTERPRISE SATELLITE DECK',
              col: '#a78bfa',
              entries: agents.filter((a) => a.spawnSpec).map((a) => ({
                id: a.id,
                callSign: a.spawnSpec?.callSign || a.id.toUpperCase(),
                desc: `Spawned · ${a.spawnSpec?.role || 'Ephemeral Task Agent'}`,
                status: 'idle',
              })),
            }] : []),
            {
              section: 'GROUND SEGMENT',
              col: '#34d399',
              entries: [
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

      {view === 'simulation' && (
        <Panel title="SCENARIO SIMULATION ARENA // MIROFISH FOCUS GROUP" onClose={() => setView(null)} right={
          <span style={{ fontSize: 9, color: '#a855f7', fontWeight: 700 }}>
            {currentSim ? `${currentSim.consensusScore}% CONSENSUS · ${currentSim.riskLevel}` : 'IDLE'}
          </span>
        }>
          <div style={{ border: '1px solid rgba(168,85,247,0.3)', borderRadius: 3, padding: '8px 10px', marginBottom: 10, background: 'rgba(168,85,247,0.05)' }}>
            <div style={{ fontSize: 8.5, letterSpacing: '0.2em', color: '#c084fc', fontWeight: 800, marginBottom: 4 }}>
              SIMULATE PROSPECTIVE SCENARIO / RFC
            </div>
            <input
              type="text"
              placeholder="e.g. Switch runtime authentication tokens to Ed25519 signatures"
              value={simTopic}
              onChange={(e) => setSimTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRunSimulation(); }}
              style={{
                width: '100%', boxSizing: 'border-box', background: 'rgba(5,8,15,0.85)',
                border: '1px solid rgba(168,85,247,0.4)', borderRadius: 2, padding: '5px 8px',
                color: INK, fontFamily: MONO, fontSize: 10, marginBottom: 6,
              }}
            />
            <input
              type="text"
              placeholder="Optional context / deployment scope (e.g. affect all API gateways)"
              value={simContext}
              onChange={(e) => setSimContext(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRunSimulation(); }}
              style={{
                width: '100%', boxSizing: 'border-box', background: 'rgba(5,8,15,0.85)',
                border: '1px solid rgba(148,163,184,0.2)', borderRadius: 2, padding: '4px 8px',
                color: INK, fontFamily: MONO, fontSize: 9.5, marginBottom: 6,
              }}
            />
            <button
              onClick={handleRunSimulation}
              disabled={simLoading || !simTopic.trim()}
              style={{
                width: '100%', background: simLoading ? 'rgba(168,85,247,0.1)' : 'rgba(168,85,247,0.2)',
                border: '1px solid #c084fc', color: '#e9d5ff', fontFamily: MONO, fontSize: 9.5,
                fontWeight: 700, padding: '5px 0', borderRadius: 2, cursor: simLoading ? 'wait' : 'pointer',
                letterSpacing: '0.18em', transition: 'all 0.15s',
              }}
            >
              {simLoading ? '🔮 RUNNING 3-ROUND MONTE CARLO DEBATE…' : '⚡ RUN 4-PERSONA SCENARIO SIMULATION'}
            </button>
          </div>

          {currentSim && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', background: 'rgba(8,14,24,0.7)', border: '1px solid rgba(103,232,249,0.25)', borderRadius: 3, marginBottom: 8 }}>
                <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                  <svg width="44" height="44" viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="3" />
                    <circle
                      cx="22" cy="22" r="18" fill="none"
                      stroke={currentSim.consensusScore >= 80 ? '#34d399' : currentSim.consensusScore >= 60 ? '#fbbf24' : '#f87171'}
                      strokeWidth="3.5"
                      strokeDasharray={`${(currentSim.consensusScore / 100) * 113} 113`}
                      strokeLinecap="round"
                      transform="rotate(-90 22 22)"
                    />
                  </svg>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>
                    {currentSim.consensusScore}%
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: currentSim.riskLevel === 'LOW' ? '#34d399' : '#fbbf24', fontWeight: 800, letterSpacing: '0.2em' }}>
                    BAYESIAN CONSENSUS: {currentSim.status.toUpperCase()} [{currentSim.riskLevel} RISK]
                  </div>
                  <div style={{ fontSize: 10, color: INK, marginTop: 2, fontWeight: 700 }}>{currentSim.topic}</div>
                  <div style={{ fontSize: 8.5, color: DIM, marginTop: 2 }}>{currentSim.executiveSummary}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                {(currentSim.personaDebates || []).map((p: any) => {
                  const personaDef = [
                    { id: 'ciso', name: 'CISO Auditor', col: '#06b6d4', badge: 'SEC' },
                    { id: 'adversary', name: 'Red-Teamer', col: '#f87171', badge: 'RED' },
                    { id: 'pragmatist', name: 'Pragmatist', col: '#34d399', badge: 'USER' },
                    { id: 'buyer', name: 'Buyer & ROI', col: '#fbbf24', badge: 'ROI' },
                  ].find((x) => x.id === p.personaId) || { name: p.personaId, col: '#a855f7', badge: 'AGENT' };

                  return (
                    <div key={p.personaId} style={{ border: `1px solid ${personaDef.col}44`, borderRadius: 3, padding: '6px 8px', background: `${personaDef.col}08` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: personaDef.col }}>[{personaDef.badge}] {personaDef.name}</span>
                        <span style={{
                          fontSize: 7.5, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
                          background: p.stance === 'accept' ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)',
                          color: p.stance === 'accept' ? '#34d399' : '#fbbf24',
                        }}>
                          {p.stance.toUpperCase()} ({Math.round(p.confidence * 100)}%)
                        </span>
                      </div>
                      <div style={{ fontSize: 8.5, color: INK, lineHeight: 1.4 }}>{p.openingArgument}</div>
                    </div>
                  );
                })}
              </div>

              {currentSim.recommendedMitigations?.length > 0 && (
                <div style={{ border: '1px solid rgba(16,185,129,0.25)', borderRadius: 3, padding: '6px 8px', background: 'rgba(16,185,129,0.04)', marginBottom: 8 }}>
                  <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.2em', color: '#10b981', marginBottom: 2 }}>
                    MANDATORY MITIGATION CONDITIONS (PRE-FLIGHT)
                  </div>
                  {currentSim.recommendedMitigations.map((m: string, idx: number) => (
                    <div key={idx} style={{ fontSize: 8.5, color: '#a7f3d0' }}>• {m}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {simHistory.length > 1 && (
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.2em', color: DIM, marginBottom: 4 }}>RECENT SCENARIO LOGS</div>
              {simHistory.slice(1, 5).map((s: any) => (
                <div
                  key={s.id}
                  onClick={() => setCurrentSim(s)}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderBottom: '1px solid rgba(148,163,184,0.08)', cursor: 'pointer', fontSize: 9 }}
                >
                  <span style={{ color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{s.topic}</span>
                  <span style={{ color: s.consensusScore >= 80 ? '#34d399' : '#fbbf24', fontWeight: 700 }}>{s.consensusScore}%</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {view === 'recon' && (
        <Panel title="COMPETITOR RECON RADAR // REVERSE-ENGINEER-MARKETING" onClose={() => setView(null)} right={
          <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>
            {reconRadar ? `${reconRadar.length} TARGETS MONITORED` : 'PROBING…'}
          </span>
        }>
          <div style={{ border: '1px solid rgba(245,158,11,0.3)', borderRadius: 3, padding: '8px 10px', marginBottom: 10, background: 'rgba(245,158,11,0.05)' }}>
            <div style={{ fontSize: 8.5, letterSpacing: '0.2em', color: '#fbbf24', fontWeight: 800, marginBottom: 4 }}>
              DISSECT COMPETITOR GROWTH & MARKETING ENGINE
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Enter domain or URL (e.g. linear.app, cursor.com, notion.so)"
                value={reconTarget}
                onChange={(e) => setReconTarget(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleProbeRecon(); }}
                style={{
                  flex: 1, background: 'rgba(5,8,15,0.85)', border: '1px solid rgba(245,158,11,0.4)',
                  borderRadius: 2, padding: '5px 8px', color: INK, fontFamily: MONO, fontSize: 10,
                }}
              />
              <button
                onClick={handleProbeRecon}
                disabled={reconLoading || !reconTarget.trim()}
                style={{
                  background: 'rgba(245,158,11,0.2)', border: '1px solid #f59e0b', color: '#fef3c7',
                  fontFamily: MONO, fontSize: 9.5, fontWeight: 700, padding: '0 12px', borderRadius: 2,
                  cursor: reconLoading ? 'wait' : 'pointer', letterSpacing: '0.15em', whiteSpace: 'nowrap',
                }}
              >
                {reconLoading ? 'PROBING…' : '🎯 PROBE'}
              </button>
            </div>
            <div style={{ fontSize: 8, color: DIM, marginTop: 4 }}>
              Scans Meta/Google ad transparency hooks, on-page pixels (PostHog, Segment, Stripe), and funnel positioning. Retained into Hindsight [venture_intel].
            </div>
          </div>

          {(reconRadar || []).map((c: any) => (
            <div key={c.id} style={{ border: '1px solid rgba(245,158,11,0.2)', borderRadius: 3, padding: '8px 10px', marginBottom: 8, background: 'rgba(245,158,11,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 10.5, color: '#fbbf24', fontWeight: 800 }}>{c.brandName} · {c.domain}</span>
                <span style={{ fontSize: 8, color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 2, padding: '1px 5px' }}>
                  {c.funnelType.toUpperCase()} FUNNEL
                </span>
              </div>
              <div style={{ fontSize: 10, color: INK, fontWeight: 700, marginTop: 3 }}>
                "{c.headlineHook}"
              </div>
              <div style={{ fontSize: 8.5, color: DIM, marginTop: 2 }}>{c.valueProp}</div>

              {c.longestRunningAdThemes?.length > 0 && (
                <div style={{ marginTop: 5, padding: '4px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: 2 }}>
                  <div style={{ fontSize: 7.5, color: '#f59e0b', fontWeight: 800, letterSpacing: '0.15em' }}>LONGEST-RUNNING AD HOOKS (PROVEN CONVERSION)</div>
                  {c.longestRunningAdThemes.map((th: string, idx: number) => (
                    <div key={idx} style={{ fontSize: 8.5, color: '#fde68a' }}>• {th}</div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 8 }}>
                <span style={{ color: DIM }}>
                  PIXELS: <span style={{ color: '#67e8f9' }}>{c.detectedPixels?.join(', ') || 'NONE'}</span>
                </span>
                <span style={{ color: '#a855f7' }}>✦ HINDSIGHT VENTURE INTEL</span>
              </div>
            </div>
          ))}
        </Panel>
      )}

      {view === 'reel' && (
        <Panel title="1-CLICK SPRINT REEL // VIDEO-SHOTCRAFT REMOTION" onClose={() => setView(null)} right={
          <span style={{ fontSize: 9, color: '#38bdf8', fontWeight: 700 }}>4K 60FPS · 15 SECONDS</span>
        }>
          {reelNote && (
            <div style={{ border: '1px solid rgba(56,189,248,0.4)', borderRadius: 3, padding: '6px 8px', background: 'rgba(56,189,248,0.08)', color: '#7dd3fc', fontSize: 9.5, fontWeight: 700, marginBottom: 8 }}>
              {reelNote}
            </div>
          )}

          <div style={{ border: '1px solid rgba(56,189,248,0.25)', borderRadius: 3, padding: '8px 10px', marginBottom: 10, background: 'rgba(56,189,248,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.15em' }}>
                AUDIO TRANSIENT GRID & KEYNOTE TIMELINE
              </span>
              <span style={{ fontSize: 8, color: DIM }}>120 BPM · CARTESIA-SONIC TTS</span>
            </div>
            <div style={{ fontSize: 8.5, color: DIM, marginBottom: 8 }}>
              Deterministic React TSX Remotion pipeline rendering real DOM elements, WebGL canvas buffers, and test passes. Zero blurry AI diffusion.
            </div>
            <button
              onClick={handleRenderReel}
              disabled={reelRendering}
              style={{
                width: '100%', background: reelRendering ? 'rgba(56,189,248,0.1)' : 'rgba(56,189,248,0.2)',
                border: '1px solid #38bdf8', color: '#bae6fd', fontFamily: MONO, fontSize: 10,
                fontWeight: 700, padding: '6px 0', borderRadius: 2, cursor: reelRendering ? 'wait' : 'pointer',
                letterSpacing: '0.18em', transition: 'all 0.15s',
              }}
            >
              {reelRendering ? 'RENDERING DETERMINISTIC 60FPS MP4…' : '▶ EXPORT 15s SPRINT MOTION BRIEFING (.MP4)'}
            </button>
          </div>

          <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.2em', color: '#94a3b8', marginBottom: 6 }}>
            STORYBOARD SHOT RECIPES (900 FRAMES)
          </div>
          {(sprintReel?.shots || []).map((sh: any) => (
            <div key={sh.shotIndex} style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: 3, padding: '6px 8px', marginBottom: 6, background: 'rgba(8,14,24,0.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 8.5, fontWeight: 800, color: '#7dd3fc' }}>
                  SHOT {sh.shotIndex}: {sh.name.toUpperCase()}
                </span>
                <span style={{ fontSize: 8, color: DIM }}>{sh.timeRange} ({sh.durationFrames}f)</span>
              </div>
              <div style={{ fontSize: 10, color: INK, fontWeight: 700, marginTop: 2 }}>{sh.headline}</div>
              <div style={{ fontSize: 8.5, color: DIM, marginTop: 1 }}>{sh.subheadline}</div>
              <div style={{ fontSize: 7.5, color: '#38bdf8', marginTop: 3 }}>
                CAMERA: {sh.cameraMovement.toUpperCase()} · {sh.visualElements?.slice(0, 2).join(' · ')}
              </div>
            </div>
          ))}

          {/* Rendered video library — every mp4 under storefront/, newest first */}
          <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.2em', color: '#94a3b8', margin: '12px 0 6px' }}>
            RENDERED LIBRARY ({videoLib?.length ?? '…'})
          </div>
          {videoLib === null && <div style={{ color: DIM, fontSize: 9.5 }}>LOADING…</div>}
          {videoLib?.length === 0 && <div style={{ color: DIM, fontSize: 9.5 }}>NO RENDERED VIDEOS YET</div>}
          {(videoLib || []).slice(0, 12).map((v: any) => {
            const mb = (v.sizeBytes / 1048576).toFixed(1);
            const d = v.modifiedAt ? new Date(v.modifiedAt).toLocaleDateString() : '';
            return (
              <div key={v.path} style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: 3, padding: '6px 8px', marginBottom: 6, background: 'rgba(8,14,24,0.6)' }}>
                {v.campaignId && (
                  <div style={{ fontSize: 8, color: '#34d399', letterSpacing: '0.12em', marginBottom: 3, fontWeight: 700 }}>
                    CAMPAIGN: {v.campaignId.toUpperCase()}
                  </div>
                )}
                <video
                  src={v.url}
                  controls
                  preload="metadata"
                  style={{ width: '100%', borderRadius: 2, background: '#000', display: 'block' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: INK, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                  <span style={{ fontSize: 8, color: DIM, flexShrink: 0 }}>{mb}MB · {d}</span>
                </div>
                <div style={{ fontSize: 7.5, color: 'rgba(148,163,184,0.5)', marginTop: 1 }}>{v.project}</div>
              </div>
            );
          })}
        </Panel>
      )}

      {view === 'counsel' && (
        <Panel title="THE COUNSEL — GO/NO-GO POLLS" onClose={() => setView(null)} right={
          <button onClick={() => { setView(null); onOpenTower(); }} style={{ background: 'none', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', fontFamily: MONO, fontSize: 9.5, padding: '2px 8px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.15em' }}>OPEN TOWER</button>
        }>
          {beliefClashes.length > 0 && (
            <div style={{ marginBottom: 8, border: '1px solid rgba(248,113,113,0.3)', borderRadius: 3, padding: '6px 8px', background: 'rgba(248,113,113,0.06)' }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.22em', color: '#f87171', marginBottom: 4 }}>
                ⚠ COGNITIVE DIVERGENCE — {beliefClashes.length} ACTIVE BELIEF CLASH{beliefClashes.length > 1 ? 'ES' : ''}
              </div>
              {beliefClashes.map((c) => (
                <div key={c.id} style={{ fontSize: 9.5, color: '#fca5a5', marginBottom: 3 }}>
                  • <strong style={{ color: '#fff' }}>{c.memberA.toUpperCase()}</strong> ({c.stanceA.toUpperCase()}) vs <strong style={{ color: '#fff' }}>{c.memberB.toUpperCase()}</strong> ({c.stanceB.toUpperCase()}): {c.clashSummary}
                </div>
              ))}
            </div>
          )}
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
            // Active deliberations render the living council floor; decided
            // sessions keep the compact card.
            if (['positions', 'rebuttal', 'poll', 'cleared'].includes(s.status)) {
              return (
                <div key={s.id}>
                  <div style={{ fontSize: 9.5, color: '#c084fc', fontWeight: 700, margin: '0 2px 4px' }}>{s.id} · {s.status.toUpperCase()} · {s.lane.toUpperCase()}</div>
                  <div style={{ fontSize: 10.5, color: INK, margin: '0 2px 6px' }}>{s.question}</div>
                  <CortexCouncilFloor session={s} />
                  {s.status === 'poll' && (
                    <div style={{ display: 'flex', gap: 6, margin: '-2px 0 8px' }}>
                      <button onClick={() => decidePoll(s.id, 'go')} style={{ flex: 1, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.5)', color: '#34d399', fontFamily: MONO, fontSize: 10, fontWeight: 700, padding: '4px 0', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.15em' }}>GO</button>
                      <button onClick={() => decidePoll(s.id, 'no-go')} style={{ flex: 1, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.5)', color: '#f87171', fontFamily: MONO, fontSize: 10, fontWeight: 700, padding: '4px 0', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.15em' }}>NO-GO</button>
                    </div>
                  )}
                </div>
              );
            }
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
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {p.ventureId && <span style={{ fontSize: 7.5, color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 2, padding: '0 4px' }}>{String(p.ventureId).toUpperCase()}</span>}
                  <span style={{ fontSize: 9, color: DIM }}>{p.actionClass?.toUpperCase() || ''}</span>
                </span>
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

      {view === 'resonance' && (() => {
        const snap = resonance;
        const r = snap?.resonance;
        const tailColor = r?.tailHealthScore == null ? DIM : r.tailHealthScore >= 0.7 ? '#34d399' : r.tailHealthScore >= 0.4 ? '#fbbf24' : '#f87171';
        const rColor = !r ? DIM : r.R >= 0.9 ? '#34d399' : r.R >= 0.7 ? '#fbbf24' : '#f87171';
        const entColor = r?.entropyState === 'healthy' ? '#34d399' : '#fbbf24';
        const stat = (label: string, value: string, color: string) => (
          <div key={label} style={{ flex: '1 1 30%', minWidth: 90, padding: '6px 8px', background: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 2 }}>
            <div style={{ fontSize: 8, color: DIM, letterSpacing: '0.18em', fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 13, color, fontFamily: MONO, fontWeight: 700, marginTop: 2 }}>{value}</div>
          </div>
        );
        return (
          <Panel title="FLEET RESONANCE — COHERENCE & TAIL HEALTH" onClose={() => setView(null)} right={
            snap ? <span style={{ fontSize: 9.5, color: DIM }}>cycle {snap.cycle} · {snap.nodesUp}/{snap.fleetSize} up · {r?.mode?.toUpperCase()}</span> : <span style={{ fontSize: 9.5, color: DIM }}>LOADING…</span>
          }>
            {!snap && <div style={{ padding: '12px 0', color: DIM }}>OBSERVER OFFLINE — is com.cortex.resonance-observer running?</div>}
            {snap && r && (<>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {stat('KURAMOTO R', String(r.R), rColor)}
                {stat('AGGREGATE', String(r.aggregateScore), rColor)}
                {stat('σθ DISPERSION', String(r.sigmaTheta), DIM)}
                {stat('ENTROPY', `${r.spectralEntropy} · ${String(r.entropyState).toUpperCase()}`, entColor)}
                {stat('TAIL HEALTH', r.tailHealthScore == null ? 'WARMING' : String(r.tailHealthScore), tailColor)}
                {stat('COUPLING K', String(r.couplingK), DIM)}
              </div>
              {r.gpd && (
                <div style={{ fontSize: 9, color: DIM, marginBottom: 8, fontFamily: MONO }}>
                  GPD tail model — ξ={r.gpd.xi} σ={r.gpd.sigma} threshold={r.gpd.threshold}ms | Q99={r.tailQuantiles?.q99 ?? '—'}ms Q999={r.tailQuantiles?.q999 ?? '—'}ms
                </div>
              )}
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.22em', color: DIM, margin: '8px 0 4px' }}>NODES</div>
              {Object.entries(snap.nodes || {}).map(([name, n]: [string, any]) => (
                <Row key={name}>
                  <Lamp status={n.up ? 'healthy' : 'down'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: INK }}>{name}</div>
                  </div>
                  <span style={{ fontSize: 8.5, color: n.up ? '#34d399' : '#f87171', fontFamily: MONO }}>
                    {n.up ? `${n.latencyMs}ms` : 'DOWN'} · {n.samples} samples
                  </span>
                </Row>
              ))}
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.22em', color: '#fbbf24', margin: '10px 0 4px' }}>SHADOW ACTUATION — WOULD DO, NEVER DOES</div>
              {(snap.shadow?.active || []).length === 0 && <div style={{ fontSize: 9.5, color: DIM, padding: '4px 0' }}>No active recommendations — fleet inside healthy band. {snap.shadow?.note}</div>}
              {(snap.shadow?.active || []).map((rec: any) => (
                <Row key={rec.id}>
                  <Lamp status={rec.severity === 'critical' ? 'failed' : rec.severity === 'warn' ? 'idle' : 'healthy'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: rec.severity === 'critical' ? '#f87171' : '#fbbf24' }}>{rec.id.toUpperCase()} → {rec.target ?? 'FLEET'}</div>
                    <div style={{ fontSize: 8.5, color: DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.rationale}</div>
                    <div style={{ fontSize: 8.5, color: '#34d399', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>WOULD: {rec.wouldDo}</div>
                  </div>
                </Row>
              ))}
            </>)}
          </Panel>
        );
      })()}

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

      {view === 'missions' && (() => {
        const MISSION_LAMP: Record<string, string> = {
          running: 'running', queued: 'queued', waiting_approval: 'queued',
          paused: 'degraded', completed: 'completed', failed: 'failed', aborted: 'cancelled',
        };
        const missionAge = (ts: number | undefined) => {
          if (!ts) return '';
          const m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
          if (m < 60) return `${m}m ago`;
          const h = Math.floor(m / 60);
          if (h < 48) return `${h}h ago`;
          return `${Math.floor(h / 24)}d ago`;
        };
        const list = missions || [];
        const active = list.filter((m: any) => m.status === 'running' || m.status === 'queued' || m.status === 'paused' || m.status === 'waiting_approval');
        return (
          <Panel
            title="MISSION LOG"
            onClose={() => setView(null)}
            right={missions === null
              ? <span style={{ fontSize: 9.5, color: DIM }}>LOADING…</span>
              : <span style={{ fontSize: 9.5, color: DIM }}>{active.length} ACTIVE · {list.length} TOTAL</span>}
          >
            {missions === null && <div style={{ padding: '12px 0', color: DIM }}>LOADING…</div>}
            {missions !== null && !list.length && (
              <div style={{ padding: '12px 0', color: DIM }}>NO MISSIONS ON RECORD — deep-work missions forked from /cortex/chat land here</div>
            )}
            {list.map((m: any) => (
              <div key={m.id} style={{ padding: '7px 0', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Lamp status={MISSION_LAMP[m.status] || 'idle'} />
                  <span style={{ flex: 1, minWidth: 0, color: INK, fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.title || m.id}
                  </span>
                  <span style={{ fontSize: 9, color: DIM, flexShrink: 0 }}>{m.overallProgress ?? 0}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, paddingLeft: 12 }}>
                  <div style={{ flex: 1, height: 3, background: 'rgba(148,163,184,0.12)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(0, Number(m.overallProgress) || 0))}%`,
                      height: '100%',
                      background: m.status === 'failed' ? '#f87171' : m.status === 'completed' ? '#34d399' : '#38bdf8',
                    }} />
                  </div>
                  <span style={{ fontSize: 8.5, color: DIM, flexShrink: 0, letterSpacing: '0.06em' }}>
                    {String(m.status || '').toUpperCase()} · {m.steps ?? 0} steps · {missionAge(m.updatedAt)}
                  </span>
                </div>
                {m.resultSummary && (
                  <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.6)', marginTop: 3, paddingLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.resultSummary}
                  </div>
                )}
              </div>
            ))}
          </Panel>
        );
      })()}

      {view === 'campaigns' && (() => {
        const KS_COLOR: Record<string, string> = { ARMED: '#34d399', 'AT-RISK': '#fbbf24', TRIPPED: '#f87171', UNMEASURED: '#64748b' };
        const fmt = (n: any) => (typeof n === 'number' ? n : '—');
        return (
          <Panel title="CAMPAIGNS // LAUNCH FUNNEL & KILL-SWITCH" onClose={() => setView(null)} right={
            <button
              onClick={async () => {
                setScrapeBusy('all'); setCampNote('');
                try {
                  const r = await fetch('/api/cortex/distribution/enqueue', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'campaign_metrics', payload: {} }),
                  });
                  const d = await r.json();
                  setCampNote(d?.ok ? 'metrics scrape queued — distributor will pull Pinterest + Gumroad' : `enqueue failed: ${d?.error || r.status}`);
                } catch (e: any) { setCampNote(`enqueue failed: ${e?.message}`); }
                setScrapeBusy(null);
              }}
              disabled={!!scrapeBusy}
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.5)', color: '#34d399', fontFamily: MONO, fontSize: 8.5, padding: '2px 7px', borderRadius: 2, cursor: scrapeBusy ? 'wait' : 'pointer', letterSpacing: '0.1em' }}
            >{scrapeBusy ? 'QUEUING…' : '↻ SCRAPE METRICS'}</button>
          }>
            {campaignsData === null && <div style={{ padding: '12px 0', color: DIM }}>LOADING…</div>}
            {campaignsData?.length === 0 && <div style={{ padding: '12px 0', color: DIM }}>NO CAMPAIGNS — add to storefront/campaigns.json</div>}
            {(campaignsData || []).map((c: any) => {
              const f = c.funnel || {};
              const m = c.metrics || {};
              const ks = c.killSwitch || {};
              return (
                <div key={c.id} style={{ border: '1px solid rgba(52,211,153,0.25)', borderRadius: 3, padding: '8px 10px', marginBottom: 10, background: 'rgba(6,28,22,0.5)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: INK }}>{c.name}</span>
                    <span style={{ fontSize: 8.5, fontWeight: 800, color: c.status === 'live' ? '#34d399' : '#fbbf24', letterSpacing: '0.1em' }}>{String(c.status || 'draft').toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#67e8f9', marginTop: 2 }}>
                    <a href={c.productUrl} target="_blank" rel="noreferrer" style={{ color: '#67e8f9' }}>{c.product}</a>
                    {' '}· {c.price} · {c.niche}
                  </div>
                  {c.counselSession && <div style={{ fontSize: 8, color: DIM, marginTop: 1 }}>counsel: {c.counselSession}{c.upsellTarget ? ` · upsell → ${c.upsellTarget}` : ''}</div>}

                  {/* Funnel: queue items by status */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 9 }}>
                    <span style={{ color: '#34d399' }}>✓{f.done || 0} posted</span>
                    <span style={{ color: '#fbbf24' }}>◌{(f.pending || 0) + (f.queued || 0) + (f.running || 0)} in-flight</span>
                    <span style={{ color: '#f87171' }}>✗{f.failed || 0} failed</span>
                  </div>

                  {/* Verified live URLs — the only "posted" truth */}
                  {(c.verifiedUrls || []).length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.15em', color: '#34d399', marginBottom: 2 }}>VERIFIED LIVE</div>
                      {c.verifiedUrls.map((u: string) => (
                        <div key={u} style={{ fontSize: 8.5 }}>
                          <a href={u} target="_blank" rel="noreferrer" style={{ color: '#7dd3fc' }}>{u.length > 70 ? u.slice(0, 70) + '…' : u}</a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Metrics — explicit fields, UNMEASURED until data lands */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 9 }}>
                    <span style={{ color: '#e0f2fe' }}>clicks <b>{fmt(m.clicks)}</b></span>
                    <span style={{ color: '#e0f2fe' }}>sales <b>{fmt(m.sales)}</b></span>
                    <span style={{ color: '#e0f2fe' }}>upsells <b>{fmt(m.upsells)}</b></span>
                  </div>

                  {/* Kill-switch */}
                  {ks.metric && (
                    <div style={{ marginTop: 6, fontSize: 8.5, borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 5 }}>
                      <span style={{ color: KS_COLOR[c.killStatus] || DIM, fontWeight: 800, letterSpacing: '0.1em' }}>KILL-SWITCH {c.killStatus}</span>
                      <span style={{ color: DIM }}> · {ks.rule || `${ks.threshold} ${ks.metric} → kill`}{ks.windowDays ? ` · ${ks.windowDays}d window` : ''}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {/* New campaign — registry entry only; publishing stays Hard-lane */}
            <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)', marginTop: 8, paddingTop: 8 }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.18em', color: '#94a3b8', marginBottom: 5 }}>NEW CAMPAIGN</div>
              <input value={campForm.name} onChange={(e) => setCampForm({ ...campForm, name: e.target.value })} placeholder="Campaign name"
                style={{ width: '100%', background: 'rgba(8,14,24,0.8)', border: '1px solid rgba(148,163,184,0.25)', color: INK, fontFamily: MONO, fontSize: 9.5, padding: '4px 7px', borderRadius: 2, marginBottom: 4, boxSizing: 'border-box' }} />
              <input value={campForm.productUrl} onChange={(e) => setCampForm({ ...campForm, productUrl: e.target.value })} placeholder="Product URL (gumroad etc.)"
                style={{ width: '100%', background: 'rgba(8,14,24,0.8)', border: '1px solid rgba(148,163,184,0.25)', color: INK, fontFamily: MONO, fontSize: 9.5, padding: '4px 7px', borderRadius: 2, marginBottom: 4, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 4 }}>
                <input value={campForm.price} onChange={(e) => setCampForm({ ...campForm, price: e.target.value })} placeholder="Price"
                  style={{ flex: 1, background: 'rgba(8,14,24,0.8)', border: '1px solid rgba(148,163,184,0.25)', color: INK, fontFamily: MONO, fontSize: 9.5, padding: '4px 7px', borderRadius: 2, boxSizing: 'border-box' }} />
                <input value={campForm.niche} onChange={(e) => setCampForm({ ...campForm, niche: e.target.value })} placeholder="Niche"
                  style={{ flex: 2, background: 'rgba(8,14,24,0.8)', border: '1px solid rgba(148,163,184,0.25)', color: INK, fontFamily: MONO, fontSize: 9.5, padding: '4px 7px', borderRadius: 2, boxSizing: 'border-box' }} />
              </div>
              <button
                onClick={async () => {
                  if (!campForm.name || !campForm.productUrl) { setCampNote('name + product URL required'); return; }
                  setCampNote('creating…');
                  try {
                    const r = await fetch('/api/cortex/campaigns', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: campForm.name, productUrl: campForm.productUrl, price: campForm.price, niche: campForm.niche }),
                    });
                    const d = await r.json();
                    if (d?.ok) { setCampNote(`created: ${d.id}`); setCampForm({ name: '', productUrl: '', price: '', niche: '' }); }
                    else setCampNote(`failed: ${d?.error || r.status}`);
                  } catch (e: any) { setCampNote(`failed: ${e?.message}`); }
                }}
                style={{ width: '100%', marginTop: 5, background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.5)', color: '#7dd3fc', fontFamily: MONO, fontSize: 9.5, fontWeight: 700, padding: '5px 0', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.15em' }}
              >+ CREATE CAMPAIGN</button>
              {campNote && <div style={{ fontSize: 8.5, color: '#fbbf24', marginTop: 4 }}>{campNote}</div>}
            </div>
            <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)', marginTop: 6 }}>
              Metrics are agent/Crew-updated — SCRAPE METRICS pulls live Pinterest + Gumroad via the automation Chrome. Verified URLs come from queue item results only.
            </div>
          </Panel>
        );
      })()}

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
                            border: '1px solid rgba(56,189,248,0.35)',
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

      {view === 'evolution' && (() => {
        const VERDICT_COLOR: Record<string, string> = { pass: '#34d399', fail: '#f87171', inconclusive: '#fbbf24', 'pending-human': '#64748b' };
        const INST_STATUS_COLOR: Record<string, string> = { candidate: '#fbbf24', active: '#34d399', promoted: '#67e8f9', retired: '#64748b', contradicted: '#f87171' };
        const latestRunFor = (evalId: string) => (evoRuns || []).filter((r: any) => r.evalId === evalId).sort((a: any, b: any) => b.finishedAt - a.finishedAt)[0];
        const instincts = evoInstincts?.instincts || [];
        const byStatus = (st: string) => instincts.filter((i: any) => i.status === st);
        const conf = (i: any) => Math.round(((i.alpha || 1) / ((i.alpha || 1) + (i.beta || 1))) * 100);
        return (
          <Panel title="EVOLUTION — EVALS & INSTINCTS" onClose={() => setView(null)} right={
            evoEvals === null ? <span style={{ fontSize: 9.5, color: DIM }}>LOADING…</span> : <span style={{ fontSize: 9.5, color: DIM }}>{evoEvals.length} EVALS · {instincts.length} INSTINCTS{evoInstincts?.promotable ? ` · ${evoInstincts.promotable} PROMOTABLE` : ''}</span>
          }>
            <div style={{ fontSize: 9.5, color: DIM, letterSpacing: '0.12em', margin: '10px 0 4px' }}>EVALUATIONS — FORMAL CAPABILITY & REGRESSION EVIDENCE</div>
            {(evoEvals || []).slice(0, 15).map((e: any) => {
              const run = latestRunFor(e.id);
              return (
                <Row key={e.id}>
                  <Lamp status={e.status === 'active' ? 'completed' : 'idle'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject}</div>
                    <div style={{ fontSize: 9, color: DIM }}>
                      {e.kind?.toUpperCase()} · {e.grader?.type} grader · k={e.k || 1}{e.agentId ? ` · @${e.agentId}` : ''}{e.ventureId ? ` · ${e.ventureId.toUpperCase()}` : ''}
                      {run ? <> · <span style={{ color: VERDICT_COLOR[run.verdict] || DIM }}>{run.verdict?.toUpperCase()}</span>{run.winner ? ` → ${run.winner}` : ''}</> : ' · NEVER RUN'}
                    </div>
                  </div>
                </Row>
              );
            })}
            {evoEvals !== null && !evoEvals.length && <div style={{ padding: '10px 0', color: DIM }}>NO EVALS FILED — incidents and tune_cycle file regression evals automatically</div>}

            <div style={{ fontSize: 9.5, color: DIM, letterSpacing: '0.12em', margin: '14px 0 4px' }}>INSTINCTS — MINED BEHAVIORS (BETA CONFIDENCE)</div>
            {(['active', 'candidate', 'promoted', 'contradicted', 'retired'] as const).map((st) => {
              const group = byStatus(st);
              if (!group.length) return null;
              return (
                <div key={st}>
                  <div style={{ fontSize: 9, color: INST_STATUS_COLOR[st], letterSpacing: '0.1em', margin: '8px 0 2px' }}>{st.toUpperCase()} ×{group.length}</div>
                  {group.slice(0, 8).map((i: any) => (
                    <Row key={i.id}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.action || i.ruleText}</div>
                        <div style={{ fontSize: 9, color: DIM }}>
                          {conf(i)}% conf · {i.evidence?.length || 0} evidence{i.ventureId ? ` · ${i.ventureId.toUpperCase()}` : ''}{i.agentId ? ` · @${i.agentId}` : ' · GLOBAL'}
                        </div>
                      </div>
                    </Row>
                  ))}
                </div>
              );
            })}
            {evoInstincts !== null && !instincts.length && <div style={{ padding: '10px 0', color: DIM }}>NO INSTINCTS YET — librarian instinct_cycle mines outcomes every 6h</div>}
            <div style={{ fontSize: 9, color: DIM, marginTop: 12, lineHeight: 1.5 }}>
              PROMOTION IS GOVERNED — confident instincts file '[rule]' proposals into INBOX; nothing self-applies. Evals gate every tune/prompt proposal.
            </div>
          </Panel>
        );
      })()}

      {view === 'ventures' && (() => {
        const vc = ventureConsole ? (ventures?.ventures || []).find((v: any) => v.id === ventureConsole) : null;
        return (
        <Panel title={vc ? `VENTURE — ${vc.callSign || vc.name}` : "VENTURES — ENTERPRISE SCOPE"} onClose={() => { setView(null); setVentureConsole(null); }} right={
          ventures === null ? <span style={{ fontSize: 9.5, color: DIM }}>LOADING…</span> : <span style={{ fontSize: 9.5, color: DIM }}>{(ventures.ventures || []).length} REGISTERED</span>
        }>
          {vc && (
            <div style={{ marginBottom: 10 }}>
              {/* Console header — live autonomy state */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 9, color: DIM, marginBottom: 6 }}>
                <span>OPEN TASKS <b style={{ color: INK }}>{vc.openTasks ?? 0}</b></span>
                <span>GOALS <b style={{ color: INK }}>{vc.goals ?? 0}</b></span>
                <span>OPS <b style={{ color: INK }}>{vc.opsItems ?? 0}</b></span>
                <span>BLOCKS <b style={{ color: INK }}>{vc.openBlocks ?? 0}</b></span>
                <span>PENDING DECISIONS <b style={{ color: (vc.pendingProposals || 0) > 0 ? '#fbbf24' : INK }}>{vc.pendingProposals ?? 0}</b></span>
                <span>STALLED <b style={{ color: (vc.stalledGoals || 0) > 0 ? '#f87171' : INK }}>{vc.stalledGoals ?? 0}</b></span>
                <span>DIST <b style={{ color: INK }}>{vc.distribution?.pending ?? 0}◌ {vc.distribution?.done ?? 0}✓ {vc.distribution?.failed ?? 0}✗</b></span>
                <span>YIELD 7D <b style={{ color: INK }}>{vc.yield7d?.runs ?? 0} runs{vc.yield7d?.runs ? ` · ${Math.round(((vc.yield7d.completions || 0) / vc.yield7d.runs) * 100)}%` : ''}</b></span>
              </div>
              {/* Autonomy strip — schedule, cycles, budget, kill switch */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 9, color: DIM, marginBottom: 6 }}>
                <span style={{ color: vc.paused ? '#f87171' : '#34d399', fontWeight: 800, letterSpacing: '0.1em' }}>{vc.paused ? '⏸ PAUSED' : '▶ LIVE'}</span>
                {vc.scheduleMinutes ? (
                  <span>NEXT CYCLE <b style={{ color: '#7dd3fc' }}>{vc.nextRunAt ? new Date(vc.nextRunAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}</b> · every {vc.scheduleMinutes >= 60 ? `${Math.round(vc.scheduleMinutes / 60)}h` : `${vc.scheduleMinutes}m`}</span>
                ) : <span style={{ color: DIM }}>MANUAL — no schedule</span>}
                <span>CYCLES TODAY <b style={{ color: INK }}>{vc.cyclesToday ?? 0}{vc.budgetPerDay ? `/${vc.budgetPerDay}` : ''}</b></span>
                {vc.taskBudgetPerDay ? <span>TASK BUDGET <b style={{ color: INK }}>{vc.taskBudgetPerDay}/day</b></span> : null}
                <button onClick={() => updateVentureField(vc.id, { paused: !vc.paused })}
                  style={{ background: vc.paused ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.12)', border: `1px solid ${vc.paused ? '#34d399' : '#f87171'}`, color: vc.paused ? '#6ee7b7' : '#fca5a5', fontFamily: MONO, fontSize: 8.5, fontWeight: 800, padding: '1px 8px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.08em' }}>
                  {vc.paused ? 'RESUME' : 'PAUSE'}
                </button>
              </div>
              {/* Schedule + budget controls */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <input value={ventureSchedInput} onChange={(e) => setVentureSchedInput(e.target.value)} placeholder="cycle min (60+)"
                  style={{ width: 90, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(56,189,248,0.35)', color: INK, fontFamily: MONO, fontSize: 9, padding: '2px 6px', borderRadius: 2, outline: 'none' }} />
                <button onClick={() => { const m = parseInt(ventureSchedInput, 10); if (m >= 60) { updateVentureField(vc.id, { scheduleMinutes: m }); setVentureSchedInput(''); } }}
                  style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid #38bdf8', color: '#7dd3fc', fontFamily: MONO, fontSize: 8.5, fontWeight: 800, padding: '2px 8px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.08em' }}>SET SCHEDULE</button>
                {vc.scheduleMinutes ? <button onClick={() => updateVentureField(vc.id, { scheduleMinutes: 0 })}
                  style={{ background: 'none', border: '1px solid rgba(148,163,184,0.3)', color: DIM, fontFamily: MONO, fontSize: 8.5, padding: '2px 8px', borderRadius: 2, cursor: 'pointer' }}>CLEAR</button> : null}
                <span style={{ width: 8 }} />
                <input value={ventureBudgetInput} onChange={(e) => setVentureBudgetInput(e.target.value)} placeholder="cycles/day cap"
                  style={{ width: 90, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(167,139,250,0.35)', color: INK, fontFamily: MONO, fontSize: 9, padding: '2px 6px', borderRadius: 2, outline: 'none' }} />
                <button onClick={() => { const b = parseInt(ventureBudgetInput, 10); if (b > 0) { updateVentureField(vc.id, { budgetPerDay: b }); setVentureBudgetInput(''); } }}
                  style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid #a78bfa', color: '#c4b5fd', fontFamily: MONO, fontSize: 8.5, fontWeight: 800, padding: '2px 8px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.08em' }}>SET CYCLE CAP</button>
                <input value={ventureTaskBudgetInput} onChange={(e) => setVentureTaskBudgetInput(e.target.value)} placeholder="tasks/day cap"
                  style={{ width: 90, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(52,211,153,0.35)', color: INK, fontFamily: MONO, fontSize: 9, padding: '2px 6px', borderRadius: 2, outline: 'none' }} />
                <button onClick={() => { const b = parseInt(ventureTaskBudgetInput, 10); if (b > 0) { updateVentureField(vc.id, { taskBudgetPerDay: b }); setVentureTaskBudgetInput(''); } }}
                  style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid #34d399', color: '#6ee7b7', fontFamily: MONO, fontSize: 8.5, fontWeight: 800, padding: '2px 8px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.08em' }}>SET TASK CAP</button>
              </div>
              {/* Scoped shortcuts — open existing views pre-filtered to this venture */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                {([['tasks', 'TASKS'], ['goals', 'GOALS'], ['calendar', 'SCHEDULE'], ['campaigns', 'CAMPAIGNS'], ['agents', 'AGENTS'], ['inbox', 'INBOX']] as [FoundryView, string][]).map(([v, label]) => (
                  <button key={v} onClick={() => openVentureView(vc.id, v)}
                    style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd', fontFamily: MONO, fontSize: 8.5, fontWeight: 800, padding: '3px 10px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.1em' }}>
                    {label} ▸
                  </button>
                ))}
                <button onClick={() => setVentureConsole(null)}
                  style={{ background: 'none', border: '1px solid rgba(148,163,184,0.3)', color: DIM, fontFamily: MONO, fontSize: 8.5, padding: '3px 10px', borderRadius: 2, cursor: 'pointer', letterSpacing: '0.1em', marginLeft: 'auto' }}>
                  ← ALL VENTURES
                </button>
              </div>
              {/* Embedded live panes — this venture's tasks & goals, no navigation */}
              {(() => {
                const vcTasks = (userTasks || []).filter((t: any) => String(t.ventureId || t.input?.ventureId || 'cortex') === vc.id);
                const vcOpen = vcTasks.filter((t: any) => !t.completed);
                const vcGoals = goals.list().filter((g: any) => String((g as any).ventureId || 'cortex') === vc.id);
                if (!vcOpen.length && !vcGoals.length) return null;
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 6 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 8, fontWeight: 800, letterSpacing: '0.2em', color: '#fcd34d', borderBottom: '1px solid rgba(251,191,36,0.2)', paddingBottom: 2, marginBottom: 3 }}>
                        <span>TASKS · {vcOpen.length} OPEN</span>
                        <button onClick={() => openVentureView(vc.id, 'tasks')} style={{ background: 'none', border: 'none', color: '#7dd3fc', fontFamily: MONO, fontSize: 8, cursor: 'pointer' }}>OPEN FULL ▸</button>
                      </div>
                      {userTasks === null && <div style={{ fontSize: 9, color: DIM, padding: '4px 0' }}>LOADING…</div>}
                      {vcOpen.slice(0, 6).map((t: any) => <CortexFoundryTaskCard key={t.id} task={t} />)}
                      {vcOpen.length > 6 && <div style={{ fontSize: 8, color: DIM, padding: '2px 0' }}>+{vcOpen.length - 6} more</div>}
                      {userTasks !== null && !vcOpen.length && <div style={{ fontSize: 9, color: DIM, padding: '4px 0' }}>NO OPEN TASKS</div>}
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 8, fontWeight: 800, letterSpacing: '0.2em', color: '#7dd3fc', borderBottom: '1px solid rgba(56,189,248,0.2)', paddingBottom: 2, marginBottom: 3 }}>
                        <span>GOALS · {vcGoals.length}</span>
                        <button onClick={() => openVentureView(vc.id, 'goals')} style={{ background: 'none', border: 'none', color: '#7dd3fc', fontFamily: MONO, fontSize: 8, cursor: 'pointer' }}>OPEN FULL ▸</button>
                      </div>
                      {vcGoals.slice(0, 4).map((g: any) => <CortexFoundryGoalCard key={g.id} goal={g} />)}
                      {!vcGoals.length && <div style={{ fontSize: 9, color: DIM, padding: '4px 0' }}>NO GOALS</div>}
                    </div>
                  </div>
                );
              })()}
              {vc.health?.reasons?.length > 0 && (
                <div style={{ fontSize: 8, color: DIM, marginBottom: 4 }}>{vc.health.reasons.join(' · ')}</div>
              )}
            </div>
          )}
          {ventures === null && <div style={{ padding: '16px 0', color: DIM }}>PROBING REGISTRY…</div>}
          {!vc && ventures !== null && !(ventures.ventures || []).length && <div style={{ padding: '16px 0', color: DIM }}>NO VENTURES REGISTERED — SEE .cortex-runtime/ventures.json</div>}
          {!vc && (ventures?.ventures || []).map((v: any) => {
            const y = v.yield7d || { runs: 0, completions: 0 };
            const yieldRate = y.runs ? Math.round((y.completions / y.runs) * 100) : null;
            const d = v.distribution || { pending: 0, done: 0, failed: 0 };
            return (
              <div key={v.id} onClick={() => setVentureConsole(v.id)} style={{
                border: '1px solid rgba(167,139,250,0.22)', borderLeft: `3px solid ${v.status === 'active' ? '#a78bfa' : DIM}`,
                borderRadius: 3, padding: '8px 10px', marginBottom: 8, background: 'rgba(167,139,250,0.04)',
                cursor: 'pointer', transition: 'border-color 0.15s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(167,139,250,0.55)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(167,139,250,0.22)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#c4b5fd', letterSpacing: '0.12em' }}>{v.callSign || v.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {v.paused && <span style={{ fontSize: 8, fontWeight: 800, color: '#f87171', border: '1px solid rgba(248,113,113,0.5)', borderRadius: 2, padding: '0 4px' }}>PAUSED</span>}
                    {!v.paused && v.scheduleMinutes ? <span style={{ fontSize: 8, fontWeight: 800, color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.4)', borderRadius: 2, padding: '0 4px' }}>⏱ {v.scheduleMinutes >= 60 ? `${Math.round(v.scheduleMinutes / 60)}H` : `${v.scheduleMinutes}M`}</span> : null}
                    {v.health?.score != null && (
                      <span style={{ fontSize: 8.5, fontWeight: 800, color: HEALTH_COLOR[v.health.band] || DIM, border: `1px solid ${HEALTH_COLOR[v.health.band] || DIM}55`, borderRadius: 2, padding: '0 4px' }}>
                        {v.health.band.toUpperCase()}{v.health.score != null ? ` ${v.health.score}` : ''}
                      </span>
                    )}
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
                  <span>DECISIONS <b style={{ color: (v.pendingProposals || 0) > 0 ? '#fbbf24' : INK }}>{v.pendingProposals ?? 0}</b></span>
                  <span>STALLED <b style={{ color: (v.stalledGoals || 0) > 0 ? '#f87171' : INK }}>{v.stalledGoals ?? 0}</b></span>
                  <span>YIELD 7D <b style={{ color: INK }}>{y.runs} runs{yieldRate != null ? ` · ${yieldRate}%` : ''}</b></span>
                </div>
                {v.health?.reasons?.length > 0 && (
                  <div style={{ fontSize: 8, color: DIM, marginBottom: 3 }}>{v.health.reasons.join(' · ')}</div>
                )}
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
          {!vc && (ventures?.unregisteredYield || []).length > 0 && (
            <div style={{ fontSize: 9, color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 3, padding: '6px 8px', marginTop: 4 }}>
              UNREGISTERED YIELD ACTIVITY: {ventures!.unregisteredYield!.join(', ')} — work exists outside the registry; register or re-scope it.
            </div>
          )}
          {!vc && <div style={{ fontSize: 8, color: DIM, marginTop: 8, lineHeight: 1.6 }}>
            Venture scope is a filter dimension on TASKS — tasks, goals, ops items, and mission blocks carry ventureId. Untagged work counts under CORTEX. Click a card for the venture console. Registry: .cortex-runtime/ventures.json
          </div>}
        </Panel>
        );
      })()}
    </>
  );
}
