/**
 * CortexAgentsScene — "The Nexus Foundry" Space Air Traffic Control (SATC) Command Deck.
 *
 * Implements the 4-Tier Orbital Space Air Traffic Control architecture directly mapped
 * to the master visual artwork (/images/cortex_satc_nexus_foundry.jpg):
 *  - Central Crystalline Spire & Golden Astrolabe Core with Voice-Reactive Luminescence.
 *  - Tier 3 (Upper Zenith): The Counsel Deck Flagship Battlecruisers (Antigravity, Devin, Strategist)
 *    with Dynamic Photon Datalink Lattice & Counsel Deliberation Grid.
 *  - Tier 1 (Inner Track): Active High-Speed Vector Flight Corridor with glowing cyan plasma wakes
 *    and forward-projected task trajectory vectors.
 *  - Tier 2 (Mid Track): Orbital Holding Patterns (Stack Alpha FL120 & Stack Bravo FL240)
 *    with synchronized port (red) / starboard (green) anti-collision navigation strobes.
 *  - Tier 4 (Lower Nadir): Enterprise Mooring Berth 01 (Omni Syndication) with magnetic docking clamps.
 *  - 360° Planar Radar Sweep with real-time target ping flashes & Mode-S transponder blips.
 *  - Aviation Flight Progress Strips, Mission Control Telemetry, and Interactive Dossiers.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  agentsClient,
  type AgentsSnapshotClient,
  type AgentClient,
  type AgentTaskClient,
  type ModelClient,
} from '../../lib/cortex-agents-client';
import { cortexSignalBus } from './CortexVisualizer';
import { CortexTowerPanel } from './CortexTowerPanel';

// ── Aviation Color Palette & Identity ──
const AGENT_COLORS: Record<string, string> = {
  antigravity: '#c084fc',
  devin: '#38bdf8',
  sentinel: '#67e8f9',
  scout: '#e879f9',
  librarian: '#fbbf24',
  builder: '#34d399',
  reviewer: '#fb7185',
  runner: '#a3e635',
  distributor: '#fb923c',
  warden: '#818cf8',
  prep: '#f472b6',
  forecaster: '#2dd4bf',
  strategist: '#e879f9',
};

const AGENT_ORDER = [
  'antigravity',
  'devin',
  'strategist',
  'sentinel',
  'scout',
  'librarian',
  'builder',
  'reviewer',
  'runner',
  'distributor',
  'warden',
  'prep',
  'forecaster',
];

interface SatcProfile {
  callsign: string;
  role: string;
  squawk: string;
  defaultLane: string;
  tier: 'counsel' | 'enterprise' | 'standard';
}

const SATC_PROFILES: Record<string, SatcProfile> = {
  antigravity: { callsign: 'AG-01', role: 'APEX STRATEGIST', squawk: '7701', defaultLane: 'FL380 [HARD]', tier: 'counsel' },
  devin: { callsign: 'DEV-02', role: 'AUTONOMOUS ENG', squawk: '4210', defaultLane: 'FL340 [HARD]', tier: 'counsel' },
  strategist: { callsign: 'STR-03', role: 'CHIEF STRATEGIST', squawk: '5520', defaultLane: 'FL320 [HARD]', tier: 'counsel' },
  reviewer: { callsign: 'REV-04', role: 'AUDIT COUNSEL', squawk: '5540', defaultLane: 'FL300 [HARD]', tier: 'counsel' },
  sentinel: { callsign: 'SNT-05', role: 'RADAR GUARDIAN', squawk: '1240', defaultLane: 'FL240 [REV]', tier: 'standard' },
  scout: { callsign: 'SCT-06', role: 'AIRSPACE RECON', squawk: '1250', defaultLane: 'FL240 [REV]', tier: 'standard' },
  builder: { callsign: 'BLD-07', role: 'SYSTEM FORGE', squawk: '1270', defaultLane: 'FL240 [REV]', tier: 'standard' },
  warden: { callsign: 'WRD-08', role: 'PERIMETER GATE', squawk: '1290', defaultLane: 'FL240 [REV]', tier: 'standard' },
  forecaster: { callsign: 'FCT-09', role: 'TRAJECTORY PREDICT', squawk: '1320', defaultLane: 'FL240 [REV]', tier: 'standard' },
  librarian: { callsign: 'LIB-10', role: 'KNOWLEDGE NAV', squawk: '1260', defaultLane: 'FL120 [CONT]', tier: 'standard' },
  runner: { callsign: 'RUN-11', role: 'VECTOR RUNNER', squawk: '1280', defaultLane: 'FL120 [CONT]', tier: 'standard' },
  prep: { callsign: 'PRP-12', role: 'FLIGHT STAGING', squawk: '1310', defaultLane: 'FL120 [CONT]', tier: 'standard' },
  distributor: { callsign: 'DST-13', role: 'SYNDICATION CARRIER', squawk: '3150', defaultLane: 'FL120 [CONT]', tier: 'enterprise' },
};

const spawnHue = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
};

const getFlightData = (a: AgentClient): SatcProfile => {
  if (SATC_PROFILES[a.id]) return SATC_PROFILES[a.id];
  const h = spawnHue(a.id);
  const num = 20 + (h % 79);
  const sq = (1000 + (h * 19) % 6777).toString(8).padStart(4, '0');
  const isEnt = a.tier === 'enterprise' || !!a.spawnSpec;
  return {
    callsign: `${a.id.slice(0, 3).toUpperCase()}-${num}`,
    role: a.role ? a.role.toUpperCase() : 'MISSION CRAFT',
    squawk: sq,
    defaultLane: isEnt ? 'FL120 [CONT]' : 'FL240 [REV]',
    tier: isEnt ? 'enterprise' : 'standard',
  };
};

const agentSort = (a: AgentClient, b: AgentClient) => {
  const ia = AGENT_ORDER.indexOf(a.id), ib = AGENT_ORDER.indexOf(b.id);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.id.localeCompare(b.id);
};

const agentTier = (a?: AgentClient | null): 'counsel' | 'enterprise' | 'standard' => {
  if (!a) return 'standard';
  if (a.id === 'antigravity' || a.id === 'devin' || a.id === 'strategist' || a.id === 'reviewer') return 'counsel';
  if (a.tier === 'enterprise' || a.id === 'distributor' || !!a.spawnSpec) return 'enterprise';
  return 'standard';
};

const INK = '#e0f2fe';
const DIM = 'rgba(148,163,184,0.55)';
const MONO = "'IBM Plex Mono', monospace";

function modelStarColor(m: ModelClient): string {
  switch (m.status) {
    case 'healthy': return '#a5f3fc';
    case 'degraded': return '#fcd34d';
    case 'down': return 'rgba(248,113,113,0.55)';
    default: return 'rgba(148,163,184,0.4)';
  }
}

const fmtElapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const prand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ── Enterprise Mooring Berths (Tier 4) ──
interface BusinessStation {
  id: string;
  name: string;
  callsign: string;
  squawk: string;
  statusUrl?: string;
}

const BUSINESS_STATIONS: BusinessStation[] = [
  {
    id: 'omni-syndication',
    name: 'OMNI // SYNDICATION',
    callsign: 'OMNI-X',
    squawk: '7000',
    statusUrl: '/api/cortex/distribution/status',
  },
];

/** Roster Aviation Glyph */
const AgentGlyph: React.FC<{ tier: 'counsel' | 'enterprise' | 'standard'; color: string }> = ({ tier, color }) =>
  tier === 'counsel' ? (
    <svg width="24" height="24" viewBox="-12 -12 24 24" style={{ flexShrink: 0 }}>
      <circle cx="0" cy="0" r="10" fill="none" stroke={color} strokeOpacity="0.6" strokeWidth="1" strokeDasharray="3 3" />
      <polygon points="0,-9 8,6 0,2 -8,6" fill="#060a16" stroke={color} strokeWidth="1.3" />
      <circle cx="0" cy="0" r="2" fill="#ffffff" />
    </svg>
  ) : tier === 'enterprise' ? (
    <svg width="24" height="24" viewBox="-12 -12 24 24" style={{ flexShrink: 0 }}>
      <circle cx="0" cy="0" r="10" fill="none" stroke={color} strokeOpacity="0.4" strokeWidth="0.8" strokeDasharray="3 3" />
      <circle cx="0" cy="0" r="6.5" fill="none" stroke="#e2e8f0" strokeOpacity="0.75" strokeWidth="1" />
      <polygon points="0,-5.5 4.5,0 0,5.5 -4.5,0" fill="#060a16" stroke={color} strokeWidth="1.2" />
      <circle cx="0" cy="0" r="1.8" fill="#ffffff" />
    </svg>
  ) : (
    <svg width="20" height="24" viewBox="-10 -12 20 24" style={{ flexShrink: 0 }}>
      <polygon points="0,-9.5 7,0 0,9.5 -7,0" fill="#060a16" stroke={color} strokeWidth="1.3" />
      <polygon points="0,-4 3.5,0 0,4 -3.5,0" fill="none" stroke={color} strokeOpacity="0.75" strokeWidth="0.8" />
      <circle cx="-1.5" cy="-3.5" r="1" fill="#ffffff" opacity="0.85" />
    </svg>
  );

function eventLine(e: { type: string; at: number; [k: string]: unknown }): string {
  const t = new Date(e.at).toLocaleTimeString('en-US', { hour12: false });
  switch (e.type) {
    case 'agent.status': return `${t}  ATC // ${String(e.agentId).toUpperCase()} ➔ ${String(e.status).toUpperCase()}`;
    case 'task.transition': {
      const task = e.task as any;
      return `${t}  FLIGHT // ${String(task?.agentId || '?').toUpperCase()} ${String(task?.status || '').toUpperCase()} — ${String(task?.title || '').slice(0, 36)}`;
    }
    case 'task.progress': return `${t}  TRACK ${String(e.taskId).slice(-6)} ➔ ${Math.round(Number(e.progress) * 100)}% VECTOR`;
    case 'model.health': {
      const m = e.model as any;
      return `${t}  BRAIN ${String(m?.status || '?').toUpperCase()} ${String(m?.id || '').split('/').pop()?.slice(0, 26)}`;
    }
    case 'agent.comm': {
      const from = String(e.from || 'ANTIGRAVITY').toUpperCase();
      const to = String(e.to || 'ALL').toUpperCase();
      return `${t}  📡 ${from} ➔ ${to}: ${String(e.message || '').slice(0, 48)}`;
    }
    case 'matrix.changed': return `${t}  AIRSPACE ${String(e.tier).toUpperCase()} corridor re-balanced`;
    default: return `${t}  ${e.type}`;
  }
}

// ── Agent Dossier & Sub-Panels ──
const STATUS_COLOR: Record<string, string> = {
  working: '#34d399', idle: '#67e8f9', error: '#f87171',
  cooldown: '#fbbf24', offline: DIM, retired: DIM,
};

const ModelHealthLine: React.FC<{ model?: string; models: ModelClient[] }> = ({ model, models }) => {
  if (!model) return null;
  const [prov, ...rest] = model.split(':');
  const mid = rest.join(':') || model;
  const h = models.find((m) => m.provider === prov && m.id === mid) || models.find((m) => m.id === mid || m.id.endsWith(mid));
  if (!h) return <span style={{ color: DIM }}>model health: unprobed</span>;
  const col = modelStarColor(h);
  return (
    <span style={{ color: col }}>
      brain: {h.status}{h.latencyMsP50 != null ? ` · ${h.latencyMsP50}ms p50` : ''}{h.consecutiveFailures ? ` · ${h.consecutiveFailures} fails` : ''}
    </span>
  );
};

const TaskRow: React.FC<{ t: AgentTaskClient; now: number }> = ({ t, now }) => {
  const [open, setOpen] = useState(false);
  const col = t.status === 'failed' || t.status === 'vetoed' ? '#f87171' : t.status === 'completed' ? '#34d399' : '#fbbf24';
  const dur = t.finishedAt && t.startedAt ? fmtElapsed(t.finishedAt - t.startedAt) : t.startedAt ? fmtElapsed(now - t.startedAt) : '';
  const telem = t.telemetry;
  return (
    <div style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: 'flex', width: '100%', alignItems: 'center', gap: 6, background: 'none', border: 'none',
        padding: '4px 0', cursor: 'pointer', fontFamily: MONO, textAlign: 'left',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0, boxShadow: `0 0 6px ${col}` }} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9, color: 'rgba(203,213,225,0.75)' }}>
          {t.title}
        </span>
        <span style={{ fontSize: 8, color: DIM, whiteSpace: 'nowrap' }}>
          {t.status.toUpperCase()}{dur ? ` · ${dur}` : ''}{t.model ? ` · ${t.model.split('/').pop()?.slice(0, 18)}` : ''}
          {telem?.failureClass ? ` · ${String(telem.failureClass).toUpperCase()}` : ''}
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 0 8px 12px', fontSize: 8, fontFamily: MONO, color: 'rgba(148,163,184,0.7)', lineHeight: 1.6 }}>
          {t.error && <div style={{ color: '#f87171' }}>error: {t.error}</div>}
          {telem && (
            <div>
              telemetry: {telem.llmCalls ?? 0} llm · {telem.tokensIn ?? 0}in/{telem.tokensOut ?? 0}tok · {telem.toolCalls ?? 0} tools({telem.toolFailures ?? 0} fail)
              {telem.durationMs != null ? ` · ${telem.durationMs}ms` : ''}
            </div>
          )}
          {t.result != null && (
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 140, overflow: 'auto', background: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 4, marginTop: 4 }}>
              {typeof t.result === 'string' ? t.result.slice(0, 2000) : JSON.stringify(t.result, null, 1).slice(0, 2000)}
            </pre>
          )}
          {!t.error && t.result == null && <div>no result payload recorded</div>}
        </div>
      )}
    </div>
  );
};

const AgentDossierPanel: React.FC<{ agent: AgentClient; snap: AgentsSnapshotClient; now: number; onClose: () => void; dockLeft?: boolean }> = ({ agent: a, snap, now, onClose, dockLeft }) => {
  const [dossierOpen, setDossierOpen] = useState(false);
  const col = AGENT_COLORS[a.id] || `hsl(${spawnHue(a.id)}, 70%, 65%)`;
  const current = a.currentTaskId ? snap.tasks.find((t) => t.id === a.currentTaskId) : null;
  const agentTasks = snap.tasks.filter((t) => t.agentId === a.id);
  const decided = agentTasks.filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'vetoed');
  const tsr = decided.length ? Math.round((decided.filter((t) => t.status === 'completed').length / decided.length) * 100) : null;
  const recent = agentTasks.slice(0, 8);
  const beatAge = a.lastHeartbeatAt ? now - a.lastHeartbeatAt : null;
  const beatCol = beatAge == null ? DIM : beatAge < 30_000 ? '#34d399' : beatAge < 120_000 ? '#fbbf24' : '#f87171';
  const spawn = a.spawnSpec;
  const ttlLeft = spawn?.ttlHours && a.spawnedAt ? a.spawnedAt + spawn.ttlHours * 3_600_000 - now : null;
  const statusCol = STATUS_COLOR[a.status] || DIM;
  const flight = getFlightData(a);

  return (
    <div style={dockLeft ? {
      position: 'absolute', left: 220, top: '50%', transform: 'translateY(-50%)', zIndex: 7,
      width: 530, maxWidth: 'calc(100vw - 250px)', maxHeight: '74vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(165deg, rgba(8,14,24,0.96), rgba(4,7,16,0.93))',
      border: `1px solid ${hexA(col, 0.45)}`, borderLeft: `3px solid ${col}`, borderRadius: 3, padding: '14px 18px',
      backdropFilter: 'blur(16px)', boxShadow: `0 0 44px ${hexA(col, 0.18)}`, overflow: 'hidden',
    } : {
      position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 7,
      width: 560, maxWidth: '92vw', maxHeight: '62vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(165deg, rgba(8,14,24,0.96), rgba(4,7,16,0.93))',
      border: `1px solid ${hexA(col, 0.45)}`, borderRadius: 3, padding: '14px 18px',
      backdropFilter: 'blur(16px)', boxShadow: `0 0 44px ${hexA(col, 0.18)}`, overflow: 'hidden',
    }}>
      <style>{'@keyframes cortexPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }'}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexShrink: 0 }}>
        <div>
          <span style={{ fontSize: 11, letterSpacing: '0.3em', color: col, fontFamily: MONO, fontWeight: 700 }}>
            {flight.callsign} // {a.name}
          </span>
          <span style={{ fontSize: 7, letterSpacing: 0.15, color: flight.tier === 'counsel' ? '#c084fc' : flight.tier === 'enterprise' ? '#fbbf24' : '#67e8f9', marginLeft: 8, verticalAlign: 'middle', border: '1px solid rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: 2 }}>
            {flight.tier.toUpperCase()} DECK · {flight.defaultLane}
          </span>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 8, color: DIM, fontFamily: MONO }}>SQWK {flight.squawk}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 11, fontFamily: MONO, padding: 0 }}>✕</button>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexShrink: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusCol, boxShadow: `0 0 8px ${statusCol}`, animation: a.status === 'working' ? 'cortexPulse 1.2s infinite' : 'none' }} />
        <span style={{ fontSize: 9, color: statusCol, fontFamily: MONO, letterSpacing: 0.15 }}>{a.status.toUpperCase()}</span>
        <span style={{ fontSize: 8, color: beatCol, fontFamily: MONO }}>beat {beatAge == null ? 'never' : `${fmtElapsed(beatAge)} ago`}</span>
        {a.modelPin?.tier && <span style={{ fontSize: 8, color: DIM, fontFamily: MONO }}>PIN {a.modelPin.tier.toUpperCase()}</span>}
      </div>

      {current ? (
        <div style={{ marginTop: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 9, fontFamily: MONO }}>
            <span style={{ color: 'rgba(203,213,225,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {current.title} <span style={{ color: DIM }}>· {current.kind}</span>
            </span>
            <span style={{ color: col, whiteSpace: 'nowrap' }}>
              {current.status === 'queued' ? 'QUEUED' : `${Math.round((current.progress ?? 0) * 100)}%`}
              {current.model && <span style={{ color: DIM }}> · {current.model.split('/').pop()?.slice(0, 22)}</span>}
            </span>
          </div>
          <div style={{ height: 3, background: 'rgba(148,163,184,0.12)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.round((current.progress ?? 0) * 100)}%`, height: '100%',
              background: `linear-gradient(90deg, ${hexA(col, 0.6)}, ${col})`, transition: 'width 0.4s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'rgba(148,163,184,0.45)', fontFamily: MONO, marginTop: 2 }}>
            <span>{current.startedAt ? `${fmtElapsed(now - current.startedAt)} elapsed` : ''}</span>
            <ModelHealthLine model={current.model} models={snap.models} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 9, color: DIM, fontFamily: MONO, marginTop: 8, flexShrink: 0 }}>
          {a.status === 'working' ? 'FLIGHT VECTOR DISPATCHING…' : 'HOLDING ORBIT — STANDING BY FOR FLIGHT CLEARANCE'}
        </div>
      )}

      {a.status === 'error' && (
        <div style={{ fontSize: 8, color: '#f87171', fontFamily: MONO, marginTop: 6, padding: '4px 6px', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 3, background: 'rgba(248,113,113,0.06)', flexShrink: 0 }}>
          last failure{current?.telemetry?.failureClass ? ` [${current.telemetry.failureClass}]` : ''}: {(current?.error || agentTasks.find((t) => t.status === 'failed')?.error || 'unknown').slice(0, 160)}
        </div>
      )}

      <div style={{ marginTop: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 8, color: 'rgba(148,233,255,0.55)', fontFamily: MONO, marginBottom: 4 }}>
          <span>{a.tasksCompleted} CLEARED</span><span>{a.tasksFailed} FAILED</span>
          {tsr !== null && <span title="Mission Success Rate">TSR {tsr}%</span>}
          <span>BUDGET {a.dailyBudget}/DAY</span>
          <span style={{ marginLeft: 'auto', color: DIM }}>{recent.length} FLIGHTS LOGGED</span>
        </div>
        <div className="ambient-scrollbar" style={{ overflowY: 'auto', maxHeight: 150, flexShrink: 1 }}>
          {recent.map((t) => <TaskRow key={t.id} t={t} now={now} />)}
          {!recent.length && <div style={{ fontSize: 8, color: DIM, fontFamily: MONO, padding: '4px 0' }}>NO RECORDED FLIGHT PLANS — AWAITING FIRST VECTOR</div>}
        </div>
      </div>

      <button onClick={() => setDossierOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: MONO, fontSize: 8, color: DIM, letterSpacing: 0.15, padding: '8px 0 0', textTransform: 'uppercase',
      }}>
        <span style={{ color: col }}>{dossierOpen ? '▾' : '▸'}</span> dossier — callsign · clearances · avionics
      </button>
      {dossierOpen && (
        <div className="ambient-scrollbar" style={{ overflowY: 'auto', fontSize: 8, fontFamily: MONO, color: 'rgba(203,213,225,0.7)', lineHeight: 1.7, paddingTop: 6 }}>
          <div style={{ color: 'rgba(203,213,225,0.85)', marginBottom: 2 }}>{a.blurb}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1px 10px' }}>
            <span style={{ color: DIM }}>SQUAWK</span>
            <span>{flight.squawk} (MODE-S IFF)</span>
            <span style={{ color: DIM }}>BLAST RADIUS</span>
            <span>{flight.defaultLane}</span>
            <span style={{ color: DIM }}>TOOLS</span>
            <span>{spawn?.tools?.length ? spawn.tools.join(', ') : 'built-in governed scopes'}</span>
            <span style={{ color: DIM }}>MODEL PIN</span>
            <span>{a.modelPin?.tier ? `${a.modelPin.tier.toUpperCase()}${a.modelPin.excludeProviders?.length ? ` (excl: ${a.modelPin.excludeProviders.join(', ')})` : ''}` : 'auto (matrix-routed)'}</span>
            <span style={{ color: DIM }}>CONCURRENCY</span>
            <span>{a.concurrency} parallel vectors</span>
            {spawn && (
              <>
                <span style={{ color: DIM }}>LINEAGE</span>
                <span>
                  {spawn.callSign || a.id}{spawn.parentAgentId ? ` · parent ${spawn.parentAgentId}` : ''}
                  {a.spawnedAt ? ` · spawned ${fmtElapsed(now - a.spawnedAt)} ago` : ''}
                  {ttlLeft != null ? ` · TTL ${ttlLeft > 0 ? `${Math.round(ttlLeft / 3_600_000)}h left` : 'EXPIRED'}` : ''}
                </span>
                <span style={{ color: DIM }}>MISSION</span>
                <span>{spawn.mission || spawn.role || '—'}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const OmniSyndicationPanel: React.FC<{
  onClose: () => void;
  dockLeft?: boolean;
}> = ({ onClose, dockLeft }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchStatus = () => {
    fetch('/api/cortex/distribution/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setData(j); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 6000);
    return () => clearInterval(iv);
  }, []);

  const triggerPublish = async (dryRun = true) => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/cortex/agents/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'distributor',
          kind: 'omni_publish',
          title: `Omni Syndication ${dryRun ? '(Staging Audit)' : '(Active CDP Sync)'}`,
          input: { platform: 'all', dryRun },
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setMsg(`Task dispatched to DISTRIBUTOR (${j.task?.id})`);
        setTimeout(fetchStatus, 1500);
      } else {
        setMsg(`Failed: ${j.error || 'unknown'}`);
      }
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const rep = data?.omniStagingReport;
  const col = '#fbbf24';

  return (
    <div
      style={
        dockLeft
          ? {
              position: 'absolute',
              left: 220,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 7,
              width: 540,
              maxWidth: 'calc(100vw - 250px)',
              maxHeight: '78vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(165deg, rgba(8,14,24,0.96), rgba(5,8,15,0.92))',
              border: `1px solid ${hexA(col, 0.4)}`,
              borderLeft: `3px solid ${col}`,
              borderRadius: 3,
              padding: '14px 18px',
              backdropFilter: 'blur(16px)',
              boxShadow: `0 0 40px ${hexA(col, 0.18)}`,
              overflow: 'hidden',
            }
          : {
              position: 'absolute',
              bottom: 18,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 7,
              width: 560,
              maxWidth: '92vw',
              maxHeight: '68vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(165deg, rgba(8,14,24,0.96), rgba(5,8,15,0.92))',
              border: `1px solid ${hexA(col, 0.4)}`,
              borderRadius: 3,
              padding: '14px 18px',
              backdropFilter: 'blur(16px)',
              boxShadow: `0 0 40px ${hexA(col, 0.18)}`,
              overflow: 'hidden',
            }
      }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexShrink: 0 }}>
        <span style={{ fontSize: 11, letterSpacing: '0.25em', color: col, fontFamily: MONO, fontWeight: 700 }}>
          OMNI // SYNDICATION
          <span style={{ fontSize: 7, letterSpacing: 0.1, color: '#38bdf8', marginLeft: 8, verticalAlign: 'middle' }}>
            TIER 4 · MOORING BERTH 01
          </span>
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 11, fontFamily: MONO, padding: 0 }}>✕</button>
      </div>

      <div style={{ fontSize: 9, color: 'rgba(203,213,225,0.85)', fontFamily: MONO, marginTop: 4 }}>
        {rep?.title || 'The Sovereign Real Estate OS & Marketing Engine'}
        <span style={{ color: DIM, marginLeft: 6 }}>({rep?.productId || 'sovereign-real-estate-os'})</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, flexShrink: 0 }}>
        <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 4, padding: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: MONO }}>
            <span style={{ color: '#fb923c', fontWeight: 700 }}>GUMROAD</span>
            <span style={{ color: '#34d399' }}>$47</span>
          </div>
          <div style={{ fontSize: 8, color: DIM, fontFamily: MONO, marginTop: 2 }}>Master ZIP · 16,235 bytes</div>
          <div style={{ fontSize: 7, color: '#a5f3fc', fontFamily: MONO, marginTop: 4 }}>STATUS: STAGED VERIFIED</div>
        </div>

        <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 4, padding: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: MONO }}>
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>ETSY</span>
            <span style={{ color: '#34d399' }}>$24.99</span>
          </div>
          <div style={{ fontSize: 8, color: DIM, fontFamily: MONO, marginTop: 2 }}>Canva Access PDF + 13 Tags</div>
          <div style={{ fontSize: 7, color: '#a5f3fc', fontFamily: MONO, marginTop: 4 }}>STATUS: DRAFT STAGED</div>
        </div>

        <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 4, padding: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: MONO }}>
            <span style={{ color: '#60a5fa', fontWeight: 700 }}>AMAZON KDP</span>
            <span style={{ color: '#34d399' }}>$14.99</span>
          </div>
          <div style={{ fontSize: 8, color: DIM, fontFamily: MONO, marginTop: 2 }}>124-Pg Interior + Wrap PDF</div>
          <div style={{ fontSize: 7, color: '#a5f3fc', fontFamily: MONO, marginTop: 4 }}>STATUS: DRAFT STAGED</div>
        </div>

        <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 4, padding: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: MONO }}>
            <span style={{ color: '#f472b6', fontWeight: 700 }}>REDBUBBLE</span>
            <span style={{ color: '#34d399' }}>POD</span>
          </div>
          <div style={{ fontSize: 8, color: DIM, fontFamily: MONO, marginTop: 2 }}>4500x5400 300DPI Blueprint</div>
          <div style={{ fontSize: 7, color: '#a5f3fc', fontFamily: MONO, marginTop: 4 }}>STATUS: PRIVATE STAGED</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
        <button
          onClick={() => triggerPublish(true)}
          disabled={loading}
          style={{
            background: 'rgba(251,191,36,0.15)',
            border: '1px solid #fbbf24',
            color: '#fbbf24',
            fontSize: 8,
            fontFamily: MONO,
            fontWeight: 700,
            padding: '6px 12px',
            borderRadius: 3,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'DISPATCHING…' : 'RUN STAGING AUDIT'}
        </button>
        <button
          onClick={() => triggerPublish(false)}
          disabled={loading}
          style={{
            background: 'rgba(56,189,248,0.15)',
            border: '1px solid #38bdf8',
            color: '#38bdf8',
            fontSize: 8,
            fontFamily: MONO,
            fontWeight: 700,
            padding: '6px 12px',
            borderRadius: 3,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          ACTIVE CDP SYNC
        </button>
        {msg && <span style={{ fontSize: 8, color: '#34d399', fontFamily: MONO, marginLeft: 'auto' }}>{msg}</span>}
      </div>

      {rep?.timestamp && (
        <div style={{ fontSize: 7, color: DIM, fontFamily: MONO, marginTop: 8 }}>
          Last Audit: {new Date(rep.timestamp).toLocaleTimeString()} · All Deliverables Verified: {rep.allVerified ? 'YES' : 'NO'}
        </div>
      )}
    </div>
  );
};

// ── Main Scene Component ──
export const CortexAgentsScene: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const snapRef = useRef<AgentsSnapshotClient>({ agents: [], models: [], tasks: [], matrix: {}, offline: true });
  const [snap, setSnap] = useState<AgentsSnapshotClient>(snapRef.current);
  const [events, setEvents] = useState(agentsClient.events);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [towerOpen, setTowerOpen] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  const reducedMotion = useRef(false);
  const voiceLevel = useRef(0);
  const voiceState = useRef<string>('idle');
  const mouse = useRef({ x: 0.5, y: 0.5, inside: false });
  const hoverTarget = useRef<{ id: string; type: 'agent' | 'station' } | null>(null);
  const stationStatus = useRef<Record<string, { busy: boolean; state: 'idle' | 'busy' | 'error' | 'unknown' }>>({});

  useEffect(() => {
    agentsClient.start();
    const unsub = agentsClient.subscribe(() => {
      snapRef.current = agentsClient.snapshot;
      setSnap(agentsClient.snapshot);
      setEvents([...agentsClient.events]);
    });
    snapRef.current = agentsClient.snapshot;
    setSnap(agentsClient.snapshot);
    setEvents([...agentsClient.events]);
    reducedMotion.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    const unsubBus = cortexSignalBus.subscribe((p) => {
      voiceLevel.current = p.level ?? 0;
      voiceState.current = p.state ?? 'idle';
    });
    return unsubBus;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = () => {
      for (const st of BUSINESS_STATIONS) {
        if (!st.statusUrl) continue;
        fetch(st.statusUrl, { cache: 'no-store' })
          .then((r) => r.json())
          .then((j: any) => {
            if (!alive || !j?.ok) return;
            const tasks: any[] = j.tasks || [];
            const busy = j.distributor?.status === 'working'
              || tasks.some((t) => t.status === 'running' || t.status === 'queued');
            const errored = j.distributor?.status === 'error';
            stationStatus.current[st.id] = {
              busy: !!busy,
              state: errored ? 'error' : busy ? 'busy' : 'idle',
            };
          })
          .catch(() => {});
      }
    };
    poll();
    const iv = setInterval(poll, 15_000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(container.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(container.clientHeight * dpr));
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const onMouse = (ev: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.current = { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height, inside: true };
    };
    const onLeave = () => { mouse.current.inside = false; };

    // ── Coordinate Mapping to Master Artwork (1376x768) ──
    const getArtworkBounds = (w: number, h: number) => {
      const xOff = narrow ? 0 : 100;
      const areaW = w - xOff;
      const areaH = h;
      const imgAspect = 1376 / 768;
      const areaAspect = areaW / areaH;
      let imgW: number, imgH: number, imgX: number, imgY: number;

      if (areaAspect > imgAspect) {
        imgH = areaH;
        imgW = areaH * imgAspect;
        imgX = xOff + (areaW - imgW) / 2;
        imgY = 0;
      } else {
        imgW = areaW;
        imgH = areaW / imgAspect;
        imgX = xOff;
        imgY = (areaH - imgH) / 2;
      }
      return { imgX, imgY, imgW, imgH };
    };

    const getCraftCoordinates = (
      agents: AgentClient[],
      w: number,
      h: number,
      t: number,
    ) => {
      const { imgX, imgY, imgW, imgH } = getArtworkBounds(w, h);
      const toX = (u: number) => imgX + u * imgW;
      const toY = (v: number) => imgY + v * imgH;

      const map = new Map<string, {
        x: number; y: number; heading: number; tier: 'counsel' | 'active' | 'holding' | 'enterprise';
        flightLevel: string; squawk: string; callsign: string; role: string;
      }>();

      // 1. Tier 3: The 3 Counsel Flagship Battlecruisers in Artwork
      // Left Cruiser: Antigravity
      const ag = agents.find(a => a.id === 'antigravity');
      if (ag) {
        const flight = getFlightData(ag);
        map.set('antigravity', {
          x: toX(0.258), y: toY(0.248), heading: 0.12, tier: 'counsel',
          flightLevel: flight.defaultLane, squawk: flight.squawk, callsign: flight.callsign, role: flight.role,
        });
      }

      // Right Cruiser: Devin
      const dev = agents.find(a => a.id === 'devin');
      if (dev) {
        const flight = getFlightData(dev);
        map.set('devin', {
          x: toX(0.758), y: toY(0.208), heading: -0.15, tier: 'counsel',
          flightLevel: flight.defaultLane, squawk: flight.squawk, callsign: flight.callsign, role: flight.role,
        });
      }

      // Top-Center Cruiser: Strategist / Reviewer
      const strat = agents.find(a => a.id === 'strategist') || agents.find(a => a.id === 'reviewer');
      if (strat) {
        const flight = getFlightData(strat);
        map.set(strat.id, {
          x: toX(0.442), y: toY(0.155), heading: 0, tier: 'counsel',
          flightLevel: flight.defaultLane, squawk: flight.squawk, callsign: flight.callsign, role: flight.role,
        });
      }

      // Remaining agents distributed along the real flight decks in the artwork
      const standardAgents = agents.filter(a => a.id !== 'antigravity' && a.id !== 'devin' && a.id !== strat?.id);
      const activeAgents = standardAgents.filter(a => a.status === 'working');
      const holdingAgents = standardAgents.filter(a => a.status !== 'working');

      // 2. Tier 1: Inner Glowing Runway Track (Small fast vector crafts)
      // Ellipse Center: (0.50, 0.553), rx: 0.22*imgW, ry: 0.088*imgH
      const innerCx = toX(0.50);
      const innerCy = toY(0.553);
      const innerRx = 0.225 * imgW;
      const innerRy = 0.088 * imgH;

      const numActive = Math.max(activeAgents.length, 1);
      activeAgents.forEach((a, i) => {
        const flight = getFlightData(a);
        const ang = (i / numActive) * Math.PI * 2 + (reducedMotion.current ? 0 : t * 0.32);
        const x = innerCx + Math.cos(ang) * innerRx;
        const y = innerCy + Math.sin(ang) * innerRy;
        const heading = ang + Math.PI / 2;
        map.set(a.id, {
          x, y, heading, tier: 'active',
          flightLevel: 'FL180 [ACTIVE]', squawk: flight.squawk, callsign: flight.callsign, role: flight.role,
        });
      });

      // 3. Tier 2: Mid Glowing Runway Deck (Holding Craft with Navigation Strobes)
      // Ellipse Center: (0.50, 0.560), rx: 0.33*imgW, ry: 0.135*imgH
      const midCx = toX(0.50);
      const midCy = toY(0.560);
      const midRx = 0.332 * imgW;
      const midRy = 0.135 * imgH;

      const numHolding = Math.max(holdingAgents.length, 1);
      holdingAgents.forEach((a, i) => {
        const flight = getFlightData(a);
        const isCounter = i % 2 === 1;
        const ang = (i / numHolding) * Math.PI * 2 + (reducedMotion.current ? 0 : t * (isCounter ? -0.06 : 0.08));
        const x = midCx + Math.cos(ang) * midRx;
        const y = midCy + Math.sin(ang) * midRy;
        const heading = ang + (isCounter ? -Math.PI / 2 : Math.PI / 2);
        map.set(a.id, {
          x, y, heading, tier: isCounter ? 'holding' : 'holding',
          flightLevel: isCounter ? 'FL240 [REV]' : 'FL120 [CONT]', squawk: flight.squawk, callsign: flight.callsign, role: flight.role,
        });
      });

      return map;
    };

    const onClick = (ev: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const w = r.width, h = r.height;
      const agents = (snapRef.current.agents || []).slice().sort(agentSort);
      const { imgX, imgY, imgW, imgH } = getArtworkBounds(w, h);
      const mx = ev.clientX - r.left, my = ev.clientY - r.top;

      let hit = false;

      // 1. Check Primary Nadir Mooring Berth (Omni Syndication) at (u=0.50, v=0.835)
      const omniX = imgX + 0.50 * imgW;
      const omniY = imgY + 0.835 * imgH;
      if (Math.hypot(mx - omniX, my - omniY) < 55) {
        hit = true;
        setSelectedStation(cur => cur === 'omni-syndication' ? null : 'omni-syndication');
        setSelectedAgent(null);
      }

      // 2. Check Agents / Starships
      if (!hit) {
        const coords = getCraftCoordinates(agents, w, h, time);
        agents.forEach((a) => {
          const pt = coords.get(a.id);
          const hitRadius = pt?.tier === 'counsel' ? 65 : 36;
          if (pt && Math.hypot(mx - pt.x, my - pt.y) < hitRadius) {
            hit = true;
            setSelectedAgent(cur => cur === a.id ? null : a.id);
            setSelectedStation(null);
          }
        });
      }
    };

    canvas.addEventListener('mousemove', onMouse);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('click', onClick);

    interface Trail { x: number; y: number; life: number }
    const trails = new Map<string, Trail[]>();
    let raf = 0, time = 0, last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      if (!reducedMotion.current) time += dt;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr, h = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const { imgX, imgY, imgW, imgH } = getArtworkBounds(w, h);
      const toX = (u: number) => imgX + u * imgW;
      const toY = (v: number) => imgY + v * imgH;

      const agents = (snapRef.current.agents || []).slice().sort(agentSort);
      const craftCoords = getCraftCoordinates(agents, w, h, time);

      // Core Coordinates
      const coreX = toX(0.50);
      const coreY = toY(0.468);
      const astrolabeY = toY(0.553);
      const vl = voiceLevel.current;

      // ── 1. Voice-Reactive Luminescent Aura on Central Monolith ──
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const corePulse = 0.5 + 0.5 * Math.sin(time * 2.5);
      const flareR = 80 * (1 + vl * 0.8 + corePulse * 0.15);
      const coreG = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, flareR);
      coreG.addColorStop(0, `rgba(224,242,254,${0.65 + vl * 0.35})`);
      coreG.addColorStop(0.3, `rgba(56,189,248,${0.35 + vl * 0.35})`);
      coreG.addColorStop(0.7, 'rgba(56,189,248,0.08)');
      coreG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreG;
      ctx.beginPath();
      ctx.arc(coreX, coreY, flareR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── 2. The Counsel Datalink Lattice (Photons on the Artwork Web) ──
      const agPt = craftCoords.get('antigravity');
      const devPt = craftCoords.get('devin');
      const stratPt = agents.find(a => a.id === 'strategist' || a.id === 'reviewer');
      const stratCoords = stratPt ? craftCoords.get(stratPt.id) : null;

      const drawLatticePacket = (x1: number, y1: number, x2: number, y2: number, col: string, offset: number) => {
        const prog = (time * 0.85 + offset) % 1;
        const px = x1 + (x2 - x1) * prog;
        const py = y1 + (y2 - y1) * prog;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hexA(col, 0.85);
        ctx.beginPath(); ctx.arc(px, py, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };

      if (agPt && devPt) drawLatticePacket(agPt.x, agPt.y, devPt.x, devPt.y, '#38bdf8', 0);
      if (agPt) drawLatticePacket(agPt.x, agPt.y, coreX, coreY, '#c084fc', 0.33);
      if (devPt) drawLatticePacket(devPt.x, devPt.y, coreX, coreY, '#38bdf8', 0.66);
      if (stratCoords && agPt) drawLatticePacket(stratCoords.x, stratCoords.y, agPt.x, agPt.y, '#e879f9', 0.5);

      // ── 3. 360° Planar Radar Sweep & Ping Intersections ──
      const sweepAngle = (time * 0.62) % (Math.PI * 2);
      const sweepMaxR = 0.50 * imgW;

      ctx.save();
      // Semi-transparent phosphor wake sector
      const sectorArc = 0.42;
      const swGrad = ctx.createRadialGradient(coreX, astrolabeY, 0, coreX, astrolabeY, sweepMaxR);
      swGrad.addColorStop(0, 'rgba(56,189,248,0.20)');
      swGrad.addColorStop(0.5, 'rgba(56,189,248,0.06)');
      swGrad.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = swGrad;
      ctx.beginPath();
      ctx.moveTo(coreX, astrolabeY);
      ctx.arc(coreX, astrolabeY, sweepMaxR, sweepAngle - sectorArc, sweepAngle);
      ctx.closePath();
      ctx.fill();

      // Sharp sweep line
      ctx.strokeStyle = 'rgba(224,242,254,0.75)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(coreX, astrolabeY);
      ctx.lineTo(coreX + Math.cos(sweepAngle) * sweepMaxR, astrolabeY + Math.sin(sweepAngle) * sweepMaxR);
      ctx.stroke();
      ctx.restore();

      // Ping detection on all tracked craft
      craftCoords.forEach((craft) => {
        const dx = craft.x - coreX;
        const dy = craft.y - astrolabeY;
        let ang = Math.atan2(dy, dx);
        if (ang < 0) ang += Math.PI * 2;
        let diff = (sweepAngle - ang) % (Math.PI * 2);
        if (diff < 0) diff += Math.PI * 2;
        if (diff < 0.28) {
          const pingFactor = 1 - diff / 0.28;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(165,243,252,${pingFactor * 0.8})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(craft.x, craft.y, 8 + (1 - pingFactor) * 26, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      });

      // ── 4. Hover Detection ──
      let bestTarget: { id: string; type: 'agent' | 'station' } | null = null;
      if (mouse.current.inside) {
        const mx = mouse.current.x * w, my = mouse.current.y * h;
        let bestDist = 45;

        // Check Omni station at Berth 01
        const omniX = toX(0.50);
        const omniY = toY(0.835);
        const dOmni = Math.hypot(mx - omniX, my - omniY);
        if (dOmni < 55 && dOmni < bestDist) {
          bestDist = dOmni;
          bestTarget = { id: 'omni-syndication', type: 'station' };
        }

        // Check craft & cruisers
        agents.forEach((a) => {
          const pt = craftCoords.get(a.id);
          if (pt) {
            const hitR = pt.tier === 'counsel' ? 65 : 36;
            const d = Math.hypot(mx - pt.x, my - pt.y);
            if (d < hitR && d < bestDist) {
              bestDist = d;
              bestTarget = { id: a.id, type: 'agent' };
            }
          }
        });
        hoverTarget.current = bestTarget;
        canvas.style.cursor = bestTarget ? 'pointer' : 'crosshair';
      } else {
        hoverTarget.current = null;
        canvas.style.cursor = 'crosshair';
      }

      // ── 5. Draw Dynamic Craft Layers Over Artwork ──
      agents.forEach((a) => {
        const pt = craftCoords.get(a.id);
        if (!pt) return;

        const col = AGENT_COLORS[a.id] || (a.spawnSpec ? `hsl(${spawnHue(a.id)} 85% 68%)` : '#94a3b8');
        const working = a.status === 'working';
        const isHovered = hoverTarget.current?.type === 'agent' && hoverTarget.current.id === a.id;
        const isSelected = selectedAgent === a.id;
        const hot = isHovered || isSelected;

        // Active Craft: Luminous Cyan Engine Trail
        if (pt.tier === 'active') {
          const tr = trails.get(a.id) || [];
          tr.push({ x: pt.x, y: pt.y, life: 1 });
          if (tr.length > 28) tr.shift();
          trails.set(a.id, tr);

          for (let k = tr.length - 1; k >= 0; k--) {
            const tp = tr[k];
            tp.life -= dt * 1.8;
            if (tp.life <= 0) { tr.splice(k, 1); continue; }
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(56,189,248,${tp.life * 0.4})`;
            ctx.beginPath(); ctx.arc(tp.x, tp.y, 2.5 * tp.life + 0.5, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
          }

          // Active Vector Heading Projection
          const vLen = 48;
          const vx = pt.x + Math.cos(pt.heading) * vLen;
          const vy = pt.y + Math.sin(pt.heading) * vLen;
          ctx.save();
          ctx.strokeStyle = 'rgba(56,189,248,0.85)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(vx, vy);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(vx, vy, 2, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }

        // Holding Craft: Synchronized Port/Starboard Navigation Strobes
        if (pt.tier === 'holding') {
          const flash = Math.sin(time * 6) > 0.6;
          ctx.save();
          // Port (Red)
          ctx.fillStyle = flash ? '#ef4444' : 'rgba(239,68,68,0.3)';
          ctx.beginPath(); ctx.arc(pt.x - 6, pt.y, 1.8, 0, Math.PI * 2); ctx.fill();
          // Starboard (Green)
          ctx.fillStyle = flash ? '#22c55e' : 'rgba(34,197,94,0.3)';
          ctx.beginPath(); ctx.arc(pt.x + 6, pt.y, 1.8, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }

        // Craft / Cruiser Target Reticle & Callsign Badge
        if (pt.tier === 'counsel') {
          // Counsel Cruiser Target Box
          ctx.save();
          ctx.strokeStyle = hexA(col, hot ? 0.9 : 0.45);
          ctx.lineWidth = 1;
          const bw = 55, bh = 22;
          // Corner brackets
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
            ctx.beginPath();
            ctx.moveTo(pt.x + sx * bw, pt.y + sy * bh - sy * 6);
            ctx.lineTo(pt.x + sx * bw, pt.y + sy * bh);
            ctx.lineTo(pt.x + sx * bw - sx * 6, pt.y + sy * bh);
            ctx.stroke();
          });

          // Callsign Tag
          ctx.font = `700 8px ${MONO}`;
          ctx.textAlign = 'center';
          ctx.fillStyle = col;
          ctx.fillText(pt.callsign, pt.x, pt.y - bh - 6);
          ctx.font = `7px ${MONO}`;
          ctx.fillStyle = 'rgba(224,242,254,0.7)';
          ctx.fillText(a.name.toUpperCase(), pt.x, pt.y + bh + 12);
          ctx.restore();
        } else {
          // Standard / Active Craft Blip
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2); ctx.stroke();

          ctx.font = `700 8px ${MONO}`;
          ctx.textAlign = 'center';
          ctx.fillStyle = INK;
          ctx.fillText(pt.callsign, pt.x, pt.y + 14);
          ctx.restore();
        }

        // Tactical Hover Card
        if (hot) {
          const boxW = 165, boxH = 50;
          const bx = Math.min(Math.max(pt.x + 20, 10), w - boxW - 10);
          const by = Math.min(Math.max(pt.y - 25, 10), h - boxH - 10);

          ctx.save();
          ctx.fillStyle = 'rgba(6,10,22,0.94)';
          ctx.strokeStyle = hexA(col, 0.85);
          ctx.lineWidth = 1;
          ctx.fillRect(bx, by, boxW, boxH);
          ctx.strokeRect(bx, by, boxW, boxH);

          ctx.strokeStyle = hexA(col, 0.5);
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(bx, by + 12);
          ctx.stroke();

          ctx.textAlign = 'left';
          ctx.font = `700 8px ${MONO}`;
          ctx.fillStyle = col;
          ctx.fillText(`${pt.callsign} // ${a.name}`, bx + 8, by + 12);
          ctx.font = `7px ${MONO}`;
          ctx.fillStyle = 'rgba(203,213,225,0.85)';
          ctx.fillText(`ALT: ${pt.flightLevel} | SQWK: ${pt.squawk}`, bx + 8, by + 23);
          ctx.fillText(`ROLE: ${pt.role.slice(0, 24)}`, bx + 8, by + 33);
          ctx.fillStyle = working ? '#34d399' : DIM;
          ctx.fillText(`STATUS: ${a.status.toUpperCase()}`, bx + 8, by + 43);
          ctx.restore();
        }
      });

      // ── 6. Tier 4: Enterprise Mooring Berth 01 (Omni Syndication) ──
      const omniX = toX(0.50);
      const omniY = toY(0.835);
      const stt = stationStatus.current['omni-syndication'] || { busy: false, state: 'unknown' as const };
      const omniHot = hoverTarget.current?.type === 'station' && hoverTarget.current.id === 'omni-syndication';
      const omniSelected = selectedStation === 'omni-syndication';

      ctx.save();
      ctx.strokeStyle = omniHot || omniSelected ? '#fbbf24' : 'rgba(251,191,36,0.6)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(omniX - 38, omniY - 18, 76, 36);

      // Flowing umbilical energy particles when busy
      if (stt.busy) {
        ctx.fillStyle = '#fbbf24';
        const flowY = omniY - 18 + ((time * 30) % 36);
        ctx.beginPath(); ctx.arc(omniX, flowY, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      ctx.font = `700 8px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('OMNI // SYNDICATION', omniX, omniY + 30);
      ctx.font = `7px ${MONO}`;
      ctx.fillStyle = stt.state === 'error' ? '#f87171' : stt.busy ? '#fbbf24' : DIM;
      ctx.fillText(`BERTH 01 · ${stt.state.toUpperCase()} · SQWK 7000`, omniX, omniY + 40);
      ctx.restore();

      // ── 7. Inter-Agent Communications (`agent.comm`) ──
      const recentComms = events.filter((e) => e.type === 'agent.comm' && (Date.now() - e.at < 12_000));
      recentComms.forEach((comm: any) => {
        const fromPt = craftCoords.get(comm.from);
        const toPt = (comm.to === 'cortex' || comm.to === 'all') ? { x: coreX, y: coreY } : craftCoords.get(comm.to);

        if (fromPt && toPt) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const age = Math.min(1, (Date.now() - comm.at) / 12_000);
          const alpha = (1 - age) * 0.9;
          const commCol = AGENT_COLORS[comm.from] || '#c084fc';

          ctx.strokeStyle = hexA(commCol, alpha * 0.8);
          ctx.lineWidth = 1.8;
          ctx.setLineDash([8, 4]);
          ctx.beginPath();
          ctx.moveTo(fromPt.x, fromPt.y);
          ctx.lineTo(toPt.x, toPt.y);
          ctx.stroke();
          ctx.setLineDash([]);

          const pProg = (((Date.now() - comm.at) * 0.0025) % 1);
          const ptx = fromPt.x + (toPt.x - fromPt.x) * pProg;
          const pty = fromPt.y + (toPt.y - fromPt.y) * pProg;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(ptx, pty, 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = hexA(commCol, 0.9);
          ctx.beginPath(); ctx.arc(ptx, pty, 6, 0, Math.PI * 2); ctx.fill();

          const midX = (fromPt.x + toPt.x) / 2;
          const midY = (fromPt.y + toPt.y) / 2 - 14;
          ctx.font = '700 8px monospace';
          const txt = `📡 ${String(comm.from).toUpperCase()} ➔ ${String(comm.to).toUpperCase()}: ${String(comm.message || '').slice(0, 36)}`;
          const tw = ctx.measureText(txt).width;
          ctx.fillStyle = 'rgba(6,10,22,0.92)';
          ctx.strokeStyle = hexA(commCol, alpha * 0.9);
          ctx.lineWidth = 1;
          ctx.fillRect(midX - tw / 2 - 6, midY - 7, tw + 12, 14);
          ctx.strokeRect(midX - tw / 2 - 6, midY - 7, tw + 12, 14);
          ctx.fillStyle = hexA(commCol, 0.95);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(txt, midX, midY);
          ctx.restore();
        }
      });

      // ── 8. Tactical Targeting Reticle ──
      if (mouse.current.inside && !reducedMotion.current) {
        const mx = mouse.current.x * w, my = mouse.current.y * h;
        ctx.strokeStyle = 'rgba(165,243,252,0.5)';
        ctx.lineWidth = 1;
        const R = 15;
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => {
          ctx.beginPath();
          ctx.moveTo(mx + dx * R * 0.5, my + dy * R * 0.5);
          ctx.lineTo(mx + dx * R, my + dy * R);
          ctx.stroke();
        });
        ctx.beginPath(); ctx.arc(mx, my, 2, 0, Math.PI * 2); ctx.stroke();

        const bearing = ((Math.atan2(my - astrolabeY, mx - coreX) * 180 / Math.PI) + 360) % 360;
        const distNM = (Math.hypot(mx - coreX, my - astrolabeY) / (0.45 * imgW) * 60).toFixed(1);
        ctx.font = `7px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(165,243,252,0.7)';
        ctx.fillText(`BRG ${bearing.toFixed(0).padStart(3, '0')}°  RNG ${distNM} NM`, mx + 16, my - 10);
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('mousemove', onMouse);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('click', onClick);
    };
  }, [selectedAgent, selectedStation, narrow]);

  // ── Overlay Derived Data ──
  const agents = snap.agents || [];
  const workingCount = agents.filter(a => a.status === 'working').length;
  const holdingCount = agents.filter(a => a.status !== 'working').length;
  const healthyModels = (snap.models || []).filter(m => m.status === 'healthy').length;
  const tickerEvents = events.slice(-6).reverse();
  const agentName = new Map(agents.map(a => [a.id, a.name]));
  const missionTasks = (snap.tasks || []).slice(0, 14);

  const TASK_STATUS_COLOR: Record<string, string> = {
    running: '#67e8f9', queued: '#fbbf24', completed: '#34d399',
    failed: '#f87171', cancelled: '#64748b',
  };

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: '#020308', overflow: 'hidden' }}>
      {/* ── Photographic Master Artwork Backdrop ── */}
      <img
        src="/images/cortex_satc_nexus_foundry.jpg"
        alt="Cortex SATC Nexus Foundry"
        style={{
          position: 'absolute',
          left: narrow ? 0 : 100,
          top: 0,
          width: narrow ? '100%' : 'calc(100% - 100px)',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 1,
        }}
      />

      {/* ── Dynamic Simulation & Interactivity Canvas ── */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 2 }} />

      {/* Screen Corner Reticles */}
      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(pos => (
        <div key={pos} style={{
          position: 'absolute', width: 28, height: 28, zIndex: 6, pointerEvents: 'none',
          [pos.includes('top') ? 'top' : 'bottom']: 14,
          [pos.includes('left') ? 'left' : 'right']: 14,
          borderTop: pos.includes('top') ? '1px solid rgba(103,232,249,0.45)' : undefined,
          borderBottom: pos.includes('bottom') ? '1px solid rgba(103,232,249,0.45)' : undefined,
          borderLeft: pos.includes('left') ? '1px solid rgba(103,232,249,0.45)' : undefined,
          borderRight: pos.includes('right') ? '1px solid rgba(103,232,249,0.45)' : undefined,
        }} />
      ))}

      {/* ── Top Center: Space Air Traffic Control Command Header ── */}
      <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 5, textAlign: 'center' }}>
        <div style={{ fontSize: 13, letterSpacing: '0.55em', fontWeight: 700, color: 'rgba(224,242,254,0.95)', fontFamily: MONO, textShadow: '0 0 18px rgba(103,232,249,0.5)' }}>
          NEXUS FOUNDRY // AIR TRAFFIC CONTROL
        </div>
        <div style={{ fontSize: 8, letterSpacing: '0.25em', color: 'rgba(148,233,255,0.55)', fontFamily: MONO, marginTop: 4 }}>
          {workingCount} IN FLIGHT · {holdingCount} IN HOLDING STACKS · COUNSEL LATTICE: SYNCHRONIZED
        </div>
        <button
          onClick={() => setTowerOpen(o => !o)}
          style={{
            marginTop: 8, background: towerOpen ? 'rgba(251,191,36,0.15)' : 'rgba(103,232,249,0.08)',
            border: `1px solid ${towerOpen ? 'rgba(251,191,36,0.55)' : 'rgba(103,232,249,0.35)'}`,
            color: towerOpen ? '#fbbf24' : 'rgba(165,243,252,0.85)',
            fontFamily: MONO, fontSize: 8, letterSpacing: '0.25em', padding: '4px 14px',
            borderRadius: 2, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >{towerOpen ? '◈ MISSION CONTROL TOWER OPEN' : '◇ MISSION CONTROL TOWER'}</button>
      </div>

      {/* ── Right Rail: Air Traffic Radar Telemetry ── */}
      <div style={{ position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)', zIndex: 5, fontFamily: MONO, fontSize: 8, letterSpacing: '0.18em', color: 'rgba(148,233,255,0.4)', lineHeight: 2, textAlign: 'right' }}>
        <div style={{ color: 'rgba(165,243,252,0.65)', letterSpacing: '0.28em', marginBottom: 4 }}>SPACE AIR TRAFFIC CONTROL</div>
        <div>RADAR SWEEP: 0.62 HZ // PRIMARY</div>
        <div>AIRSPACE: CLASS-ALPHA GOVERNED</div>
        <div>FLIGHT RULES: IFR STRICT</div>
        <div>IFF TRANSPONDERS: MODE-S ACTIVE</div>
        <div>HOLDING STACKS: ALPHA / BRAVO</div>
        <div>COUNSEL LATTICE: SYNCHRONIZED</div>
        <div>MODELS VERIFIED: {healthyModels}/{(snap.models || []).length}</div>
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(103,232,249,0.14)', paddingTop: 8 }}>
          EVENT BUS: {snap.runtime?.eventCount ?? 0}
        </div>
        <div>UPTIME: {snap.runtime ? fmtElapsed(Date.now() - snap.runtime.startedAt) : '—'}</div>
        <div>STATE: {snap.offline ? 'OFFLINE' : 'RADAR LIVE'}</div>
      </div>

      {/* ── Left Rail: Aviation Flight Progress Strips (Roster) ── */}
      {!narrow && (
        <div style={{
          position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 5,
          width: 200, fontFamily: MONO,
          background: 'rgba(4,8,18,0.72)', border: '1px solid rgba(103,232,249,0.14)',
          borderRadius: 4, backdropFilter: 'blur(8px)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '7px 10px', borderBottom: '1px solid rgba(103,232,249,0.14)',
            color: 'rgba(165,243,252,0.75)', fontWeight: 700, letterSpacing: '0.28em', fontSize: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>FLIGHT STRIPS</span>
            <span style={{ color: 'rgba(148,233,255,0.35)', letterSpacing: '0.15em' }}>{agents.length} CRAFT</span>
          </div>
          <div className="ambient-scrollbar" style={{ maxHeight: '62vh', overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {agents.slice().sort(agentSort).map(a => {
              const col = AGENT_COLORS[a.id] || (a.spawnSpec ? `hsl(${spawnHue(a.id)} 85% 68%)` : '#94a3b8');
              const tier = agentTier(a);
              const offline = a.status === 'offline' || a.status === 'retired';
              const active = selectedAgent === a.id;
              const flight = getFlightData(a);
              const statusCol = a.status === 'working' ? col : a.status === 'error' ? '#f87171' : offline ? 'rgba(100,116,139,0.8)' : 'rgba(148,163,184,0.5)';
              return (
                <div key={a.id}
                  onClick={() => setSelectedAgent(active ? null : a.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', cursor: 'pointer',
                    borderBottom: '1px solid rgba(148,233,255,0.05)',
                    background: active ? hexA(col, 0.12) : 'transparent',
                    opacity: offline ? 0.55 : 1,
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(103,232,249,0.05)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = active ? hexA(col, 0.12) : 'transparent'; }}
                >
                  <AgentGlyph tier={tier} color={col} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 9, letterSpacing: '0.12em', fontWeight: 700,
                      color: active ? col : 'rgba(224,242,254,0.9)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {flight.callsign} <span style={{ color: DIM, fontWeight: 400 }}>· {a.name}</span>
                    </div>
                    <div style={{ fontSize: 7, letterSpacing: '0.15em', color: statusCol, marginTop: 1 }}>
                      SQWK {flight.squawk} · {a.status.toUpperCase()}
                    </div>
                  </div>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', background: statusCol, flexShrink: 0,
                    boxShadow: a.status === 'working' ? `0 0 6px ${col}` : 'none',
                  }} />
                </div>
              );
            })}
            {agents.length === 0 && (
              <div style={{ padding: '12px 10px', color: 'rgba(148,233,255,0.3)', letterSpacing: '0.15em', fontSize: 8 }}>
                NO CRAFT IN AIRSPACE
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom Right: Mission Log ── */}
      <div style={{
        position: 'absolute', right: 22, bottom: 40, zIndex: 5, width: 310,
        fontFamily: MONO, fontSize: 8, letterSpacing: '0.1em',
        background: 'rgba(4,8,18,0.78)', border: '1px solid rgba(103,232,249,0.16)',
        borderRadius: 4, backdropFilter: 'blur(8px)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '7px 10px', borderBottom: '1px solid rgba(103,232,249,0.14)',
          color: 'rgba(165,243,252,0.75)', fontWeight: 700, letterSpacing: '0.28em', fontSize: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>FLIGHT LOG</span>
          <span style={{ color: 'rgba(148,233,255,0.35)', letterSpacing: '0.15em' }}>
            {missionTasks.filter(t => t.status === 'running' || t.status === 'queued').length} ACTIVE
          </span>
        </div>
        <div className="ambient-scrollbar" style={{ maxHeight: 190, overflowY: 'auto', scrollbarWidth: 'thin' }}>
          {missionTasks.length === 0 && (
            <div style={{ padding: '12px 10px', color: 'rgba(148,233,255,0.3)', letterSpacing: '0.15em' }}>
              NO FLIGHTS THIS SESSION — DISPATCH WORK VIA VOICE OR API
            </div>
          )}
          {missionTasks.map(t => {
            const col = TASK_STATUS_COLOR[t.status] || '#64748b';
            const elapsed = t.status === 'running' || t.status === 'queued'
              ? fmtElapsed(nowTs - (t.startedAt || t.createdAt))
              : t.finishedAt && t.startedAt ? fmtElapsed(t.finishedAt - t.startedAt) : '—';
            const agentCol = AGENT_COLORS[t.agentId] || (agents.find(a => a.id === t.agentId)?.spawnSpec ? `hsl(${spawnHue(t.agentId)} 85% 68%)` : '#94a3b8');
            return (
              <div key={t.id} style={{
                padding: '6px 10px', borderBottom: '1px solid rgba(148,233,255,0.05)',
                display: 'flex', gap: 8, alignItems: 'baseline',
                background: t.status === 'running' ? 'rgba(103,232,249,0.04)' : 'transparent',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0,
                  alignSelf: 'center',
                  boxShadow: t.status === 'running' ? `0 0 6px ${col}` : 'none',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'rgba(224,242,254,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.title}
                  </div>
                  <div style={{ color: 'rgba(148,233,255,0.4)', marginTop: 2, display: 'flex', gap: 6 }}>
                    <span style={{ color: agentCol }}>{agentName.get(t.agentId) || t.agentId}</span>
                    <span>·</span>
                    <span style={{ color: col }}>{t.status.toUpperCase()}</span>
                    {t.model && <><span>·</span><span style={{ color: 'rgba(196,181,253,0.55)' }}>{String(t.model).split(':').pop()?.slice(0, 20)}</span></>}
                  </div>
                </div>
                <span style={{ color: 'rgba(148,233,255,0.45)', flexShrink: 0 }}>{elapsed}</span>
              </div>
            );
          })}
        </div>
      </div>

      {snap.offline && (
        <div style={{ position: 'absolute', bottom: 76, left: '50%', transform: 'translateX(-50%)', zIndex: 7, fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', color: '#fb923c', background: 'rgba(30,15,5,0.8)', border: '1px solid rgba(251,146,60,0.4)', padding: '8px 20px', borderRadius: 3 }}>
          ◌ AIRSPACE TRANSPONDERS OFFLINE — IS DEV SERVER RUNNING?
        </div>
      )}

      {/* Live Event Ticker */}
      {tickerEvents.length > 0 && (
        <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 6, fontFamily: MONO, fontSize: 8, letterSpacing: '0.12em', color: 'rgba(165,243,252,0.55)', textAlign: 'center', lineHeight: 1.9, pointerEvents: 'none' }}>
          {tickerEvents.map((e, i) => (
            <div key={`${e.at}-${i}`} style={{ opacity: 1 - i * 0.16 }}>{eventLine(e)}</div>
          ))}
        </div>
      )}

      {selectedAgent && (() => {
        const a = agents.find(x => x.id === selectedAgent);
        if (!a) return null;
        return <AgentDossierPanel agent={a} snap={snap} now={nowTs} onClose={() => setSelectedAgent(null)} dockLeft={!narrow} />;
      })()}

      {selectedStation && (
        <OmniSyndicationPanel onClose={() => setSelectedStation(null)} dockLeft={!narrow} />
      )}

      {towerOpen && <CortexTowerPanel onClose={() => setTowerOpen(false)} />}

      {/* Subtle CRT Radar Scanline */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 8, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 3px)' }} />
    </div>
  );
};

export default CortexAgentsScene;
