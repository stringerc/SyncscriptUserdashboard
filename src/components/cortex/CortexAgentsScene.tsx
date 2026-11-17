/// <reference path="../cortana/r3f-jsx.d.ts" />
/**
 * CortexAgentsScene — "The Nexus Foundry" 3D Space Air Traffic Control (SATC) Command Deck.
 *
 * Full Real-Time 3D React Three Fiber (R3F) Simulation:
 *  - Centerpiece: 3D Crystalline Spire & Interlocking Golden Astrolabe Gyroscope Rings
 *    with real-time voice-reactive luminescence.
 *  - Tier 3 (Upper Zenith): Three Massive 3D Counsel Battlecruisers (Antigravity, Devin, Strategist)
 *    linked by the 3D Glowing Counsel Datalink Laser Lattice with pulsing photon packets.
 *  - Tier 1 (Inner Runway): 3D High-Speed Active Flight Corridor with banking delta-wing spaceships,
 *    glowing cyan engine wakes, and forward vector trajectory lines.
 *  - Tier 2 (Mid Runway): 3D Staggered Orbital Holding Patterns (Stack Alpha & Bravo)
 *    with synchronized port (red) / starboard (green) anti-collision navigation strobes.
 *  - Tier 4 (Outer Ring): 3D Industrial Space Station with 24 Radial Docking Piers, moored freighters
 *    with amber engine exhausts, and the Sovereign Omni Syndication Docking Citadel.
 *  - 3D Planar Radar Sweep Plane revolving across the airspace with real-time target pings.
 *  - 3D Camera with cinematic downward angle & pointer parallax depth.
 *  - Seamless DOM Flight Strips, Telemetry HUD, Task Feeds, Dossiers, and Tower Command Panel.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

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

// ── Roster Aviation SVG Glyph ──
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

// ── 3D Scene Primitives & Models ──

/** 3D Twinkling Deep Space Starfield */
function DeepSpace3D() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 2200;

  const [geo, mat] = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 40 + Math.random() * 90;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.75;
      pos[i * 3 + 2] = r * Math.cos(phi);

      const isCyan = Math.random() > 0.45;
      col[i * 3] = isCyan ? 0.65 : 1.0;
      col[i * 3 + 1] = isCyan ? 0.9 : 0.95;
      col[i * 3 + 2] = 1.0;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const m = new THREE.PointsMaterial({
      size: 0.38,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    return [g, m];
  }, [count]);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.008;
    }
  });

  return <primitive object={useMemo(() => new THREE.Points(geo, mat), [geo, mat])} ref={pointsRef} />;
}

/** The Central 3D Crystalline Obelisk / Spire */
function CentralSpire3D({ voiceLevel }: { voiceLevel: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const crystalMesh = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0, 2.2, 16, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: '#00f0ff',
      emissive: '#00b4d8',
      emissiveIntensity: 0.8,
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.9,
    });
    return new THREE.Mesh(geo, mat);
  }, []);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.18;
      const pulse = Math.sin(Date.now() * 0.003) * 0.15;
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + voiceLevel * 2.5 + pulse;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 3.5 + voiceLevel * 7;
    }
  });

  return (
    <group position={[0, 4, 0]}>
      <primitive object={crystalMesh} ref={meshRef} scale={[1, 1.25, 1]} />
      <pointLight ref={lightRef} color="#38bdf8" intensity={3.5} distance={28} />
    </group>
  );
}

/** 3 Interlocking Golden Astrolabe / Gyroscope Rings */
function GoldenAstrolabe3D() {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  const goldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f59e0b',
        emissive: '#78350f',
        emissiveIntensity: 0.35,
        metalness: 0.92,
        roughness: 0.2,
      }),
    []
  );

  const [r1, r2, r3] = useMemo(() => {
    const g1 = new THREE.TorusGeometry(5.2, 0.38, 16, 72);
    const g2 = new THREE.TorusGeometry(5.8, 0.34, 16, 72);
    const g3 = new THREE.TorusGeometry(6.4, 0.30, 16, 72);
    const m1 = new THREE.Mesh(g1, goldMat);
    m1.rotation.x = Math.PI / 2;
    const m2 = new THREE.Mesh(g2, goldMat);
    m2.rotation.set(0.9, 0.4, 0);
    const m3 = new THREE.Mesh(g3, goldMat);
    m3.rotation.set(-0.8, -0.5, 0.6);
    return [m1, m2, m3];
  }, [goldMat]);

  useFrame((_, delta) => {
    if (ring1Ref.current) ring1Ref.current.rotation.y += delta * 0.22;
    if (ring2Ref.current) ring2Ref.current.rotation.z -= delta * 0.18;
    if (ring3Ref.current) ring3Ref.current.rotation.x += delta * 0.15;
  });

  return (
    <group position={[0, 4, 0]}>
      <primitive object={r1} ref={ring1Ref} />
      <primitive object={r2} ref={ring2Ref} />
      <primitive object={r3} ref={ring3Ref} />
    </group>
  );
}

/** 3D Counsel Battlecruiser Model */
function CounselCruiser3D({
  name,
  callsign,
  position,
  rotation,
  color,
  isWorking,
  isHovered,
  isSelected,
  onPointerOver,
  onPointerOut,
  onClick,
}: {
  name: string;
  callsign: string;
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  isWorking: boolean;
  isHovered: boolean;
  isSelected: boolean;
  onPointerOver: () => void;
  onPointerOut: () => void;
  onClick: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const cruiserMesh = useMemo(() => {
    const grp = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({
      color: '#070c18',
      metalness: 0.85,
      roughness: 0.35,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
      metalness: 0.5,
    });

    // Main Arrowhead Hull
    const prow = new THREE.Mesh(new THREE.ConeGeometry(2.4, 7, 4), hullMat);
    prow.position.set(0, 0, 1);
    prow.rotation.y = Math.PI / 4;
    grp.add(prow);

    // Bridge Deck Superstructure
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 3), hullMat);
    bridge.position.set(0, 0.9, -1);
    grp.add(bridge);

    // Observation Bridge Slit
    const slit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.25, 0.2), trimMat);
    slit.position.set(0, 1.2, 0);
    grp.add(slit);

    // Outrigger Wing Sponsons
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 3.2), hullMat);
    wingL.position.set(-2.4, -0.2, -1.2);
    const wingR = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 3.2), hullMat);
    wingR.position.set(2.4, -0.2, -1.2);
    grp.add(wingL);
    grp.add(wingR);

    // Twin Aft Warp Nacelles
    const nacL = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 12), trimMat);
    nacL.position.set(-1.2, 0, -3.2);
    nacL.rotation.x = Math.PI / 2;
    const nacR = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 12), trimMat);
    nacR.position.set(1.2, 0, -3.2);
    nacR.rotation.x = Math.PI / 2;
    grp.add(nacL);
    grp.add(nacR);

    // Engine Exhaust Flares
    const flameMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.8 });
    const flameL = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.5, 12), flameMat);
    flameL.position.set(-1.2, 0, -4.5);
    flameL.rotation.x = Math.PI / 2;
    const flameR = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.5, 12), flameMat);
    flameR.position.set(1.2, 0, -4.5);
    flameR.rotation.x = Math.PI / 2;
    grp.add(flameL);
    grp.add(flameR);

    return grp;
  }, [color]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(Date.now() * 0.0015 + position[0]) * 0.25;
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onPointerOver={(e) => { e.stopPropagation(); onPointerOver(); }}
      onPointerOut={(e) => { e.stopPropagation(); onPointerOut(); }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      scale={isHovered || isSelected ? [1.12, 1.12, 1.12] : [1, 1, 1]}
    >
      <primitive object={cruiserMesh} />
    </group>
  );
}

/** 3D Counsel Datalink Laser Lattice */
function CounselLattice3D({
  p1,
  p2,
  p3,
  spirePos,
}: {
  p1: [number, number, number];
  p2: [number, number, number];
  p3: [number, number, number];
  spirePos: [number, number, number];
}) {
  const lineMesh = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pts = [
      ...p1, ...p2,
      ...p2, ...p3,
      ...p3, ...p1,
      ...p1, ...spirePos,
      ...p2, ...spirePos,
      ...p3, ...spirePos,
    ];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: '#67e8f9',
      transparent: true,
      opacity: 0.6,
    });
    return new THREE.LineSegments(geo, mat);
  }, [p1, p2, p3, spirePos]);

  const p1Mesh = useMemo(() => new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })), []);
  const p2Mesh = useMemo(() => new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshBasicMaterial({ color: '#38bdf8' })), []);
  const p3Mesh = useMemo(() => new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshBasicMaterial({ color: '#c084fc' })), []);

  const photon1Ref = useRef<THREE.Mesh>(null);
  const photon2Ref = useRef<THREE.Mesh>(null);
  const photon3Ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const t = (Date.now() * 0.001) % 1;
    if (photon1Ref.current) {
      photon1Ref.current.position.set(
        p1[0] + (p2[0] - p1[0]) * t,
        p1[1] + (p2[1] - p1[1]) * t,
        p1[2] + (p2[2] - p1[2]) * t
      );
    }
    if (photon2Ref.current) {
      photon2Ref.current.position.set(
        p2[0] + (p3[0] - p2[0]) * t,
        p2[1] + (p3[1] - p2[1]) * t,
        p2[2] + (p3[2] - p2[2]) * t
      );
    }
    if (photon3Ref.current) {
      photon3Ref.current.position.set(
        p1[0] + (spirePos[0] - p1[0]) * t,
        p1[1] + (spirePos[1] - p1[1]) * t,
        p1[2] + (spirePos[2] - p1[2]) * t
      );
    }
  });

  return (
    <group>
      <primitive object={lineMesh} />
      <primitive object={p1Mesh} ref={photon1Ref} />
      <primitive object={p2Mesh} ref={photon2Ref} />
      <primitive object={p3Mesh} ref={photon3Ref} />
    </group>
  );
}

/** 3D Inner Flight Runway & Moving Active Spaceships */
function ActiveRunway3D({
  activeAgents,
  onHover,
  onClick,
}: {
  activeAgents: AgentClient[];
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}) {
  const radius = 10.5;
  const numActive = Math.max(activeAgents.length, 1);

  const runwayMesh = useMemo(() => {
    const geo = new THREE.RingGeometry(radius - 0.8, radius + 0.8, 64);
    const mat = new THREE.MeshStandardMaterial({
      color: '#071526',
      emissive: '#0284c7',
      emissiveIntensity: 0.35,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = Math.PI / 2;
    return m;
  }, [radius]);

  return (
    <group position={[0, -0.2, 0]}>
      <primitive object={runwayMesh} />
      {activeAgents.map((a, i) => {
        const col = AGENT_COLORS[a.id] || '#38bdf8';
        return (
          <ActiveShip3D
            key={a.id}
            agent={a}
            index={i}
            total={numActive}
            radius={radius}
            color={col}
            onHover={onHover}
            onClick={onClick}
          />
        );
      })}
    </group>
  );
}

function ActiveShip3D({
  agent,
  index,
  total,
  radius,
  color,
  onHover,
  onClick,
}: {
  agent: AgentClient;
  index: number;
  total: number;
  radius: number;
  color: string;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}) {
  const shipRef = useRef<THREE.Group>(null);

  const craftMesh = useMemo(() => {
    const grp = new THREE.Group();
    // Delta-wing fighter
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 1.8, 3),
      new THREE.MeshStandardMaterial({ color: '#081020', emissive: color, emissiveIntensity: 0.6 })
    );
    cone.rotation.x = Math.PI / 2;
    grp.add(cone);

    // Glowing Ion Engine Wake
    const wake = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 1.4, 8),
      new THREE.MeshBasicMaterial({ color: '#00f0ff', transparent: true, opacity: 0.75 })
    );
    wake.position.set(0, 0, -1.2);
    wake.rotation.x = Math.PI / 2;
    grp.add(wake);

    return grp;
  }, [color]);

  useFrame(() => {
    const t = Date.now() * 0.0006;
    const ang = (index / total) * Math.PI * 2 + t * 0.8;
    if (shipRef.current) {
      shipRef.current.position.set(Math.cos(ang) * radius, 0.3, Math.sin(ang) * radius);
      shipRef.current.rotation.y = -ang;
      shipRef.current.rotation.z = -0.35; // bank inward
    }
  });

  return (
    <group
      ref={shipRef}
      onPointerOver={(e) => { e.stopPropagation(); onHover(agent.id); }}
      onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
      onClick={(e) => { e.stopPropagation(); onClick(agent.id); }}
    >
      <primitive object={craftMesh} />
    </group>
  );
}

/** 3D Mid Orbital Holding Runway & Patrol Ships */
function HoldingRunway3D({
  holdingAgents,
  onHover,
  onClick,
}: {
  holdingAgents: AgentClient[];
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}) {
  const radius = 16.5;
  const numHolding = Math.max(holdingAgents.length, 1);

  const runwayMesh = useMemo(() => {
    const geo = new THREE.RingGeometry(radius - 0.6, radius + 0.6, 64);
    const mat = new THREE.MeshStandardMaterial({
      color: '#050c18',
      emissive: '#1e3a8a',
      emissiveIntensity: 0.25,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = Math.PI / 2;
    return m;
  }, [radius]);

  return (
    <group position={[0, -0.6, 0]}>
      <primitive object={runwayMesh} />
      {holdingAgents.map((a, i) => {
        const col = AGENT_COLORS[a.id] || '#94a3b8';
        return (
          <HoldingShip3D
            key={a.id}
            agent={a}
            index={i}
            total={numHolding}
            radius={radius}
            color={col}
            onHover={onHover}
            onClick={onClick}
          />
        );
      })}
    </group>
  );
}

function HoldingShip3D({
  agent,
  index,
  total,
  radius,
  color,
  onHover,
  onClick,
}: {
  agent: AgentClient;
  index: number;
  total: number;
  radius: number;
  color: string;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}) {
  const shipRef = useRef<THREE.Group>(null);
  const portStrobe = useRef<THREE.Mesh>(null);
  const stbdStrobe = useRef<THREE.Mesh>(null);
  const isCounter = index % 2 === 1;

  const [craftMesh, pMesh, sMesh] = useMemo(() => {
    const grp = new THREE.Group();
    const oct = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7, 0),
      new THREE.MeshStandardMaterial({ color: '#080e1a', emissive: color, emissiveIntensity: 0.4 })
    );
    grp.add(oct);

    const port = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
    port.position.set(-0.8, 0, 0);
    const stbd = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: '#22c55e' }));
    stbd.position.set(0.8, 0, 0);
    grp.add(port);
    grp.add(stbd);

    return [grp, port, stbd];
  }, [color]);

  useFrame(() => {
    const t = Date.now() * 0.0003;
    const ang = (index / total) * Math.PI * 2 + t * (isCounter ? -0.4 : 0.4);
    if (shipRef.current) {
      shipRef.current.position.set(Math.cos(ang) * radius, 0.2, Math.sin(ang) * radius);
      shipRef.current.rotation.y = isCounter ? ang : -ang;
    }

    const flash = Math.sin(Date.now() * 0.008) > 0.6;
    (pMesh.material as THREE.MeshBasicMaterial).color.set(flash ? '#ef4444' : '#450a0a');
    (sMesh.material as THREE.MeshBasicMaterial).color.set(flash ? '#22c55e' : '#052e16');
  });

  return (
    <group
      ref={shipRef}
      onPointerOver={(e) => { e.stopPropagation(); onHover(agent.id); }}
      onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
      onClick={(e) => { e.stopPropagation(); onClick(agent.id); }}
    >
      <primitive object={craftMesh} />
    </group>
  );
}

/** 3D Outer Ring Space Station with Radial Docking Piers */
function OuterStationRing3D({
  onOmniClick,
}: {
  onOmniClick: () => void;
}) {
  const innerR = 22.5;
  const outerR = 25.5;

  const stationGroup = useMemo(() => {
    const grp = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(innerR, outerR, 72);
    const stationMat = new THREE.MeshStandardMaterial({
      color: '#080f1e',
      emissive: '#0369a1',
      emissiveIntensity: 0.25,
      roughness: 0.6,
      metalness: 0.8,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, stationMat);
    ringMesh.rotation.x = Math.PI / 2;
    grp.add(ringMesh);

    const pierMat = new THREE.MeshStandardMaterial({ color: '#050a14', metalness: 0.85, roughness: 0.4 });
    const amberMat = new THREE.MeshBasicMaterial({ color: '#fbbf24' });

    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const isOmni = i === 6; // forward nadir berth
      const px = Math.cos(ang) * (outerR + 2.2);
      const pz = Math.sin(ang) * (outerR + 2.2);

      const pierGrp = new THREE.Group();
      pierGrp.position.set(px, 0, pz);
      pierGrp.rotation.y = -ang + Math.PI / 2;

      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 4.4), pierMat);
      pierGrp.add(arm);

      const ship = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 3.2), isOmni ? amberMat : pierMat);
      ship.position.set(0, 0.4, 0.8);
      pierGrp.add(ship);

      const exhaust = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6), new THREE.MeshBasicMaterial({ color: '#fb923c' }));
      exhaust.position.set(0, 0.4, 2.5);
      pierGrp.add(exhaust);

      grp.add(pierGrp);
    }

    return grp;
  }, [innerR, outerR]);

  return (
    <group position={[0, -1.2, 0]} onClick={onOmniClick}>
      <primitive object={stationGroup} />
    </group>
  );
}

/** 3D Planar Radar Sweep Plane */
function RadarSweep3D() {
  const sweepRef = useRef<THREE.Group>(null);
  const sweepR = 28;

  const sweepGroup = useMemo(() => {
    const grp = new THREE.Group();
    const sweepGeo = new THREE.RingGeometry(0.1, sweepR, 32, 1, 0, 0.45);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const sMesh = new THREE.Mesh(sweepGeo, sweepMat);
    sMesh.rotation.x = Math.PI / 2;
    grp.add(sMesh);

    // Leading edge line
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, Math.cos(0.45) * sweepR, 0, Math.sin(0.45) * sweepR], 3)
    );
    const lineMat = new THREE.LineBasicMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.8 });
    grp.add(new THREE.Line(lineGeo, lineMat));

    return grp;
  }, [sweepR]);

  useFrame((_, delta) => {
    if (sweepRef.current) {
      sweepRef.current.rotation.y += delta * 0.45;
    }
  });

  return (
    <group ref={sweepRef} position={[0, -0.4, 0]}>
      <primitive object={sweepGroup} />
    </group>
  );
}

/** 3D Camera Rig with Cinematic Downward Perspective & Parallax */
function CameraRig3D() {
  const { camera, pointer } = useThree();

  useFrame(() => {
    const targetX = pointer.x * 4;
    const targetY = 18 - pointer.y * 3;
    const targetZ = 34;

    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    camera.lookAt(0, 1.5, -2);
  });

  return null;
}

// ── Complete 3D Scene Assembly ──
function SpaceAirTrafficScene({
  agents,
  voiceLevel,
  hoveredAgent,
  selectedAgent,
  onHover,
  onClick,
  onOmniClick,
}: {
  agents: AgentClient[];
  voiceLevel: number;
  hoveredAgent: string | null;
  selectedAgent: string | null;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
  onOmniClick: () => void;
}) {
  const standardAgents = agents.filter(a => agentTier(a) !== 'counsel');
  const activeAgents = standardAgents.filter(a => a.status === 'working');
  const holdingAgents = standardAgents.filter(a => a.status !== 'working');

  const posAG: [number, number, number] = [-16, 10, -10];
  const posDev: [number, number, number] = [16, 9, -12];
  const posStrat: [number, number, number] = [-2, 14, -18];
  const spireApex: [number, number, number] = [0, 12, 0];

  const ag = agents.find(a => a.id === 'antigravity');
  const dev = agents.find(a => a.id === 'devin');
  const strat = agents.find(a => a.id === 'strategist') || agents.find(a => a.id === 'reviewer');

  return (
    <>
      <CameraRig3D />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 25, 15]} intensity={1.2} />
      <directionalLight position={[-15, 10, -10]} intensity={0.6} color="#38bdf8" />

      {/* 1. Deep Space & Twinkling Stars */}
      <DeepSpace3D />

      {/* 2. Central Crystalline Spire & Interlocking Golden Astrolabe Rings */}
      <CentralSpire3D voiceLevel={voiceLevel} />
      <GoldenAstrolabe3D />

      {/* 3. Tier 3: The 3 Counsel Flagship Battlecruisers */}
      {ag && (
        <CounselCruiser3D
          name="ANTIGRAVITY"
          callsign="AG-01"
          position={posAG}
          rotation={[0.1, 0.45, -0.05]}
          color="#c084fc"
          isWorking={ag.status === 'working'}
          isHovered={hoveredAgent === 'antigravity'}
          isSelected={selectedAgent === 'antigravity'}
          onPointerOver={() => onHover('antigravity')}
          onPointerOut={() => onHover(null)}
          onClick={() => onClick('antigravity')}
        />
      )}

      {dev && (
        <CounselCruiser3D
          name="DEVIN"
          callsign="DEV-02"
          position={posDev}
          rotation={[0.1, -0.45, 0.05]}
          color="#38bdf8"
          isWorking={dev.status === 'working'}
          isHovered={hoveredAgent === 'devin'}
          isSelected={selectedAgent === 'devin'}
          onPointerOver={() => onHover('devin')}
          onPointerOut={() => onHover(null)}
          onClick={() => onClick('devin')}
        />
      )}

      {strat && (
        <CounselCruiser3D
          name={strat.name}
          callsign="STR-03"
          position={posStrat}
          rotation={[0.2, 0, 0]}
          color="#e879f9"
          isWorking={strat.status === 'working'}
          isHovered={hoveredAgent === strat.id}
          isSelected={selectedAgent === strat.id}
          onPointerOver={() => onHover(strat.id)}
          onPointerOut={() => onHover(null)}
          onClick={() => onClick(strat.id)}
        />
      )}

      {/* 3D Counsel Datalink Lattice */}
      <CounselLattice3D p1={posAG} p2={posDev} p3={posStrat} spirePos={spireApex} />

      {/* 4. Tier 1: Inner Glowing Runway Track & Moving Active Ships */}
      <ActiveRunway3D activeAgents={activeAgents} onHover={onHover} onClick={onClick} />

      {/* 5. Tier 2: Mid Orbital Holding Runway & Holding Patrol Ships */}
      <HoldingRunway3D holdingAgents={holdingAgents} onHover={onHover} onClick={onClick} />

      {/* 6. Tier 4: Outer Ring Station & Radial Mooring Piers */}
      <OuterStationRing3D onOmniClick={onOmniClick} />

      {/* 7. 3D Planar Radar Sweep */}
      <RadarSweep3D />

      {/* Post-Processing Bloom & Vignette */}
      <EffectComposer>
        <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} intensity={1.2} />
        <Vignette eskil={false} offset={0.15} darkness={0.8} />
      </EffectComposer>
    </>
  );
}

// ── Main Exported Component with HUD Overlays ──
export const CortexAgentsScene: React.FC = () => {
  const snapRef = useRef<AgentsSnapshotClient>({ agents: [], models: [], tasks: [], matrix: {}, offline: true });
  const [snap, setSnap] = useState<AgentsSnapshotClient>(snapRef.current);
  const [events, setEvents] = useState(agentsClient.events);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [towerOpen, setTowerOpen] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [voiceLevel, setVoiceLevel] = useState(0);

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
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    const unsubBus = cortexSignalBus.subscribe((p) => {
      setVoiceLevel(p.level ?? 0);
    });
    return unsubBus;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

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
    <div style={{ position: 'absolute', inset: 0, background: '#010206', overflow: 'hidden' }}>
      {/* ── Real-Time 3D Space Air Traffic Control Canvas ── */}
      <Canvas
        camera={{ position: [0, 18, 36], fov: 42 }}
        dpr={Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2)}
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      >
        <PerformanceMonitor />
        <SpaceAirTrafficScene
          agents={agents}
          voiceLevel={voiceLevel}
          hoveredAgent={hoveredAgent}
          selectedAgent={selectedAgent}
          onHover={setHoveredAgent}
          onClick={(id) => { setSelectedAgent(id); setSelectedStation(null); }}
          onOmniClick={() => { setSelectedStation('omni-syndication'); setSelectedAgent(null); }}
        />
      </Canvas>

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
      <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 5, textAlign: 'center', pointerEvents: 'auto' }}>
        <div style={{ fontSize: 13, letterSpacing: '0.55em', fontWeight: 700, color: 'rgba(224,242,254,0.95)', fontFamily: MONO, textShadow: '0 0 18px rgba(103,232,249,0.5)' }}>
          NEXUS FOUNDRY // AIR TRAFFIC CONTROL
        </div>
        <div style={{ fontSize: 8, letterSpacing: '0.25em', color: 'rgba(148,233,255,0.55)', fontFamily: MONO, marginTop: 4 }}>
          {workingCount} ACTIVE IN FLIGHT · {holdingCount} IN HOLDING STACKS · COUNSEL LATTICE: SYNCHRONIZED
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
      <div style={{ position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)', zIndex: 5, fontFamily: MONO, fontSize: 8, letterSpacing: '0.18em', color: 'rgba(148,233,255,0.4)', lineHeight: 2, textAlign: 'right', pointerEvents: 'none' }}>
        <div style={{ color: 'rgba(165,243,252,0.65)', letterSpacing: '0.28em', marginBottom: 4 }}>SPACE AIR TRAFFIC CONTROL</div>
        <div>RADAR SWEEP: 0.45 HZ // 3D PRIMARY</div>
        <div>AIRSPACE: CLASS-ALPHA GOVERNED</div>
        <div>FLIGHT RULES: IFR STRICT</div>
        <div>IFF TRANSPONDERS: MODE-S ACTIVE</div>
        <div>HOLDING STACKS: ALPHA / BRAVO</div>
        <div>COUNSEL LATTICE: 3D MESH ACTIVE</div>
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
          borderRadius: 4, backdropFilter: 'blur(8px)', overflow: 'hidden', pointerEvents: 'auto',
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
                  onMouseEnter={() => setHoveredAgent(a.id)}
                  onMouseLeave={() => setHoveredAgent(null)}
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
          </div>
        </div>
      )}

      {/* ── Bottom Right: Mission Log ── */}
      <div style={{
        position: 'absolute', right: 22, bottom: 40, zIndex: 5, width: 310,
        fontFamily: MONO, fontSize: 8, letterSpacing: '0.1em',
        background: 'rgba(4,8,18,0.78)', border: '1px solid rgba(103,232,249,0.16)',
        borderRadius: 4, backdropFilter: 'blur(8px)', overflow: 'hidden', pointerEvents: 'auto',
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
        <div style={{ position: 'absolute', bottom: 76, left: '50%', transform: 'translateX(-50%)', zIndex: 7, fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', color: '#fb923c', background: 'rgba(30,15,5,0.8)', border: '1px solid rgba(251,146,60,0.4)', padding: '8px 20px', borderRadius: 3, pointerEvents: 'none' }}>
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

      {/* Selected Dossier Modal */}
      {selectedAgent && (() => {
        const a = agents.find(x => x.id === selectedAgent);
        if (!a) return null;
        return <AgentDossierPanel agent={a} snap={snap} now={nowTs} onClose={() => setSelectedAgent(null)} dockLeft={!narrow} />;
      })()}

      {/* Omni Syndication Modal */}
      {selectedStation && (
        <OmniSyndicationPanel onClose={() => setSelectedStation(null)} dockLeft={!narrow} />
      )}

      {/* Tower Modal */}
      {towerOpen && <CortexTowerPanel onClose={() => setTowerOpen(false)} />}

      {/* Subtle CRT Scanline */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 8, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 3px)' }} />
    </div>
  );
};

export default CortexAgentsScene;
