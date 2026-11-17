/**
 * CortexAgentsScene — "The Nexus Foundry" Agents command deck.
 *
 * Zero-dependency Canvas2D command deck:
 *  - Nebula backdrop, animated perspective grid, parallax starfield,
 *    shooting stars, mouse reticle with telemetry readout.
 *  - Layered reactor core: plasma orb, rune rings, ember sparks,
 *    breathing with Cortex's real voice level.
 *  - Agent vessels on orbital rings with motion trails, specular
 *    highlights, data conduits, shockwave transitions.
 *  - Model constellation: twinkling health stars, filament web,
 *    labeled flagship models.
 *  - HUD chrome: corner brackets, telemetry columns, event ticker,
 *    task windows, agent dossier.
 *
 * Every visual state traces to the live agentsClient snapshot/events.
 */

import React, { useEffect, useRef, useState } from 'react';
import { agentsClient, type AgentsSnapshotClient, type AgentClient, type AgentTaskClient, type ModelClient } from '../../lib/cortex-agents-client';
import { cortexSignalBus } from './CortexVisualizer';
import { CortexTowerPanel } from './CortexTowerPanel';
import { CortexFoundryNav } from './CortexFoundryNav';

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
const AGENT_ORDER = ['antigravity', 'sentinel', 'scout', 'librarian', 'builder', 'devin', 'reviewer', 'runner', 'distributor', 'warden', 'prep', 'forecaster', 'strategist'];
// Deterministic hue for spawned agents from their callSign — stable across renders.
const spawnHue = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
};
const agentSort = (a: AgentClient, b: AgentClient) => {
  const ia = AGENT_ORDER.indexOf(a.id), ib = AGENT_ORDER.indexOf(b.id);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.id.localeCompare(b.id);
};
/**
 * Apollo Mission Control Orbital Tiers:
 *  - 'console': Flight Console Specialists (closest to Cortex Core on the inner ring)
 *  - 'support': Support Craft & Specialist Agents (standard mid ring)
 *  - 'enterprise': Enterprise fleet & spawned vessels (outer satellite deck)
 */
export const FLIGHT_CONSOLE_SPECIALIST_IDS = new Set([
  'antigravity', // GUIDANCE (Strategy · Vision)
  'builder',     // FLIGHT CONTROLS (Execute · Builder)
  'runner',      // FLIGHT CONTROLS (Execute · Runner)
  'sentinel',    // EECOM (Power/Compute · Models Health)
  'forecaster',  // FDO (Trajectory · Orbits)
  'warden',      // SURGEON (Quality Gate · Safety)
  'strategist',  // FLIGHT DIRECTOR
]);

export type AgentOrbitTier = 'console' | 'support' | 'enterprise';

export const agentOrbitTier = (a?: AgentClient | null): AgentOrbitTier => {
  if (!a) return 'support';
  if (a.tier === 'enterprise' || !!a.spawnSpec) return 'enterprise';
  if (FLIGHT_CONSOLE_SPECIALIST_IDS.has(a.id)) return 'console';
  return 'support';
};

const agentTier = (a?: AgentClient | null): 'enterprise' | 'console' | 'support' =>
  agentOrbitTier(a);
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

// ── Enterprise stations — the outer orbit is for businesses, not agents.
// Each entry is a running venture with its own sprite + live status feed.
// `busy` drives the activity animation (orbiting sparks, pulsing ring).
interface BusinessStation {
  id: string;
  name: string;
  statusUrl?: string;
  phase: number;
  size: { w: number; h: number };
}
const BUSINESS_STATIONS: BusinessStation[] = [
  {
    id: 'omni-syndication',
    name: 'OMNI // SYNDICATION',
    statusUrl: '/api/cortex/distribution/status',
    phase: 0.9,
    size: { w: 104, h: 56 },
  },
];

/** 2D Sacred Foundry Citadel — sovereign enterprise syndication nexus.
 *  Tri-concentric astrolabe rings with coordinate ticks, micro-diamonds,
 *  radiant quantum core, and directional flux emitter arrays. */
function drawStationGlyph(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number,
  t: number, busy: boolean, col: string,
) {
  ctx.save();
  ctx.translate(x, y);

  // 1. Ambient coronal flare
  const pulse = busy ? 0.7 + 0.3 * Math.sin(t * 8) : 0.35 + 0.15 * Math.sin(t * 2);
  const qg = ctx.createRadialGradient(0, 0, 0, 0, 0, 28 * s);
  qg.addColorStop(0, hexA(col, pulse * 0.45));
  qg.addColorStop(0.5, hexA(col, pulse * 0.12));
  qg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = qg;
  ctx.beginPath();
  ctx.arc(0, 0, 28 * s, 0, Math.PI * 2);
  ctx.fill();

  // 2. Counter-rotating outer astrolabe calibration ring
  ctx.save();
  ctx.rotate(t * (busy ? 1.4 : 0.45));
  ctx.strokeStyle = hexA(col, 0.45);
  ctx.lineWidth = 1 * s;
  ctx.setLineDash([3 * s, 6 * s]);
  ctx.beginPath();
  ctx.arc(0, 0, 22 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // 4 cardinal orbital diamond nodes
  for (let k = 0; k < 4; k++) {
    const ka = (k * Math.PI) / 2;
    const dx = Math.cos(ka) * 22 * s;
    const dy = Math.sin(ka) * 22 * s;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(dx, dy - 2.5 * s);
    ctx.lineTo(dx + 2.5 * s, dy);
    ctx.lineTo(dx, dy + 2.5 * s);
    ctx.lineTo(dx - 2.5 * s, dy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 3. Counter-rotating inner polar ring with micro ticks
  ctx.save();
  ctx.rotate(-t * (busy ? 1.8 : 0.6));
  ctx.strokeStyle = 'rgba(226,232,240,0.7)';
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.arc(0, 0, 15 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = hexA(col, 0.85);
  for (let deg = 0; deg < 8; deg++) {
    const da = (deg * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(da) * 13 * s, Math.sin(da) * 13 * s);
    ctx.lineTo(Math.cos(da) * 16.5 * s, Math.sin(da) * 16.5 * s);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Central Sacred Hex-Core / Sovereign Prismatic Nexus
  ctx.fillStyle = '#060a16';
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  for (let h = 0; h < 6; h++) {
    const ha = (h * Math.PI) / 3;
    const hx = Math.cos(ha) * 8.5 * s;
    const hy = Math.sin(ha) * 8.5 * s;
    if (h === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 5. Radiating carrier waveforms when busy (omni-syndication flux)
  if (busy) {
    for (let w = 1; w <= 3; w++) {
      const wavePhase = (t * 2.5 + w * 0.7) % 3;
      const waveR = (9 + wavePhase * 10) * s;
      const waveAlpha = Math.max(0, 0.7 - (wavePhase / 3) * 0.7);
      ctx.strokeStyle = hexA(col, waveAlpha);
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.arc(0, 0, waveR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 6. Singularity nucleus
  const nucG = ctx.createRadialGradient(0, 0, 0, 0, 0, 4.5 * s);
  nucG.addColorStop(0, '#ffffff');
  nucG.addColorStop(0.4, col);
  nucG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = nucG;
  ctx.beginPath();
  ctx.arc(0, 0, 4.5 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Roster glyph — mirrors the sacred astrolabes:
 *  Sacred multi-ring astrolabe for enterprise/spawned,
 *  faceted quantum prism for standard agents. Pure SVG. */
const AgentGlyph: React.FC<{ enterprise?: boolean; color: string }> = ({ enterprise, color }) =>
  enterprise ? (
    <svg width="26" height="26" viewBox="-13 -13 26 26" style={{ flexShrink: 0 }}>
      {/* Outer astrolabe resonance ring */}
      <circle cx="0" cy="0" r="11" fill="none" stroke={color} strokeOpacity="0.4" strokeWidth="0.8" strokeDasharray="3 3" />
      {/* Inner polar gimbal ring */}
      <circle cx="0" cy="0" r="7.5" fill="none" stroke="#e2e8f0" strokeOpacity="0.75" strokeWidth="1" />
      {/* Sacred faceted diamond core */}
      <polygon points="0,-6.5 5,0 0,6.5 -5,0" fill="#060a16" stroke={color} strokeWidth="1.2" />
      {/* 4 Cardinal focus diamond pips */}
      <circle cx="0" cy="-11" r="1.2" fill="#ffffff" />
      <circle cx="11" cy="0" r="1.2" fill="#ffffff" />
      <circle cx="0" cy="11" r="1.2" fill="#ffffff" />
      <circle cx="-11" cy="0" r="1.2" fill="#ffffff" />
      {/* Quantum singularity core */}
      <circle cx="0" cy="0" r="2" fill="#ffffff" />
    </svg>
  ) : (
    <svg width="20" height="24" viewBox="-10 -12 20 24" style={{ flexShrink: 0 }}>
      {/* Faceted octahedral prism */}
      <polygon points="0,-9.5 7,0 0,9.5 -7,0" fill="#060a16" stroke={color} strokeWidth="1.3" />
      {/* Inner diamond resonance lattice */}
      <polygon points="0,-4 3.5,0 0,4 -3.5,0" fill="none" stroke={color} strokeOpacity="0.75" strokeWidth="0.8" />
      {/* Specular glint */}
      <circle cx="-1.5" cy="-3.5" r="1" fill="#ffffff" opacity="0.85" />
    </svg>
  );

function eventLine(e: { type: string; at: number; [k: string]: unknown }): string {
  const t = new Date(e.at).toLocaleTimeString('en-US', { hour12: false });
  switch (e.type) {
    case 'agent.status': return `${t}  ${String(e.agentId).toUpperCase()} → ${String(e.status).toUpperCase()}`;
    case 'task.transition': {
      const task = e.task as any;
      return `${t}  ${String(task?.agentId || '?').toUpperCase()} ${String(task?.status || '').toUpperCase()} — ${String(task?.title || '').slice(0, 42)}`;
    }
    case 'task.progress': return `${t}  TASK ${String(e.taskId).slice(-6)} → ${Math.round(Number(e.progress) * 100)}%`;
    case 'model.health': {
      const m = e.model as any;
      return `${t}  MODEL ${String(m?.status || '?').toUpperCase()} ${String(m?.id || '').split('/').pop()?.slice(0, 30)}`;
    }
    case 'model.discovered': {
      const m = e.model as any;
      return `${t}  DISCOVERED ${String(m?.id || '').split('/').pop()?.slice(0, 34)}`;
    }
    case 'agent.comm': {
      const from = String(e.from || 'ANTIGRAVITY').toUpperCase();
      const to = String(e.to || 'ALL').toUpperCase();
      return `${t}  📡 ${from} ➔ ${to}: ${String(e.message || '').slice(0, 52)}`;
    }
    case 'matrix.changed': return `${t}  MATRIX ${String(e.tier).toUpperCase()} lane re-ordered`;
    default: return `${t}  ${e.type}`;
  }
}

// ── Agent dossier — NOW / RECORD / DOSSIER (CORTEX_AGENT_DOSSIER_SPEC.md) ──
// Zone A answers "what is it doing right now"; Zone B "how has it performed";
// Zone C "what is it allowed to be". Progressive disclosure, MCC doctrine.

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

  return (
    <div style={dockLeft ? {
      // Docked to the roster rail: extends rightward from it, vertically centered.
      position: 'absolute', left: 290, top: '50%', transform: 'translateY(-50%)', zIndex: 7,
      width: 520, maxWidth: 'calc(100vw - 240px)', maxHeight: '74vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(165deg, rgba(8,14,24,0.94), rgba(5,8,15,0.9))',
      border: `1px solid ${hexA(col, 0.35)}`, borderLeft: `3px solid ${col}`, borderRadius: 3, padding: '12px 16px',
      backdropFilter: 'blur(14px)', boxShadow: `0 0 40px ${hexA(col, 0.15)}`, overflow: 'hidden',
    } : {
      position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 7,
      width: 560, maxWidth: '92vw', maxHeight: '62vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(165deg, rgba(8,14,24,0.94), rgba(5,8,15,0.9))',
      border: `1px solid ${hexA(col, 0.35)}`, borderRadius: 3, padding: '12px 16px',
      backdropFilter: 'blur(14px)', boxShadow: `0 0 40px ${hexA(col, 0.15)}`, overflow: 'hidden',
    }}>
      <style>{'@keyframes cortexPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }'}</style>
      {/* ── ZONE A: NOW ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexShrink: 0 }}>
        <span style={{ fontSize: 11, letterSpacing: '0.3em', color: col, fontFamily: MONO, fontWeight: 700 }}>
          {a.name}
          <span style={{ fontSize: 7, letterSpacing: 0.1, color: agentOrbitTier(a) === 'enterprise' ? '#fbbf24' : agentOrbitTier(a) === 'console' ? '#38bdf8' : DIM, marginLeft: 8, verticalAlign: 'middle' }}>
            {agentOrbitTier(a) === 'enterprise' ? 'ENTERPRISE' : agentOrbitTier(a) === 'console' ? 'FLIGHT CONSOLE' : 'SUPPORT CRAFT'}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 8, color: DIM, fontFamily: MONO }}>{a.role}</span>
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
          {a.status === 'working' ? 'TASK DISPATCHING…' : 'NO ACTIVE TASK — STANDING BY'}
        </div>
      )}

      {a.status === 'error' && (
        <div style={{ fontSize: 8, color: '#f87171', fontFamily: MONO, marginTop: 6, padding: '4px 6px', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 3, background: 'rgba(248,113,113,0.06)', flexShrink: 0 }}>
          last failure{current?.telemetry?.failureClass ? ` [${current.telemetry.failureClass}]` : ''}: {(current?.error || agentTasks.find((t) => t.status === 'failed')?.error || 'unknown').slice(0, 160)}
        </div>
      )}

      {/* ── ZONE B: RECORD ── */}
      <div style={{ marginTop: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 8, color: 'rgba(148,233,255,0.55)', fontFamily: MONO, marginBottom: 4 }}>
          <span>{a.tasksCompleted} DONE</span><span>{a.tasksFailed} FAILED</span>
          {tsr !== null && <span title="Success rate over retained task window">TSR {tsr}%</span>}
          <span>BUDGET {a.dailyBudget}/DAY</span>
          <span style={{ marginLeft: 'auto', color: DIM }}>{recent.length} RECENT</span>
        </div>
        <div className="ambient-scrollbar" style={{ overflowY: 'auto', maxHeight: 150, flexShrink: 1 }}>
          {recent.map((t) => <TaskRow key={t.id} t={t} now={now} />)}
          {!recent.length && <div style={{ fontSize: 8, color: DIM, fontFamily: MONO, padding: '4px 0' }}>NO TASK HISTORY — AWAITING FIRST ASSIGNMENT</div>}
        </div>
      </div>

      {/* ── ZONE C: DOSSIER (collapsible) ── */}
      <button onClick={() => setDossierOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: MONO, fontSize: 8, color: DIM, letterSpacing: 0.15, padding: '8px 0 0', textTransform: 'uppercase',
      }}>
        <span style={{ color: col }}>{dossierOpen ? '▾' : '▸'}</span> dossier — identity · tools · lineage
      </button>
      {dossierOpen && (
        <div className="ambient-scrollbar" style={{ overflowY: 'auto', fontSize: 8, fontFamily: MONO, color: 'rgba(203,213,225,0.7)', lineHeight: 1.7, paddingTop: 6 }}>
          <div style={{ color: 'rgba(203,213,225,0.85)', marginBottom: 2 }}>{a.blurb}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1px 10px' }}>
            <span style={{ color: DIM }}>TOOLS</span>
            <span>{spawn?.tools?.length ? spawn.tools.join(', ') : 'built-in governed scopes'}</span>
            <span style={{ color: DIM }}>MODEL PIN</span>
            <span>{a.modelPin?.tier ? `${a.modelPin.tier.toUpperCase()}${a.modelPin.excludeProviders?.length ? ` (excl: ${a.modelPin.excludeProviders.join(', ')})` : ''}` : 'auto (matrix-routed)'}</span>
            <span style={{ color: DIM }}>CONCURRENCY</span>
            <span>{a.concurrency} parallel</span>
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
              left: 216,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 7,
              width: 540,
              maxWidth: 'calc(100vw - 240px)',
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
            ENTERPRISE DECK
          </span>
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 11, fontFamily: MONO, padding: 0 }}>✕</button>
      </div>

      <div style={{ fontSize: 9, color: 'rgba(203,213,225,0.85)', fontFamily: MONO, marginTop: 4 }}>
        {rep?.title || 'The Sovereign Real Estate OS & Marketing Engine'}
        <span style={{ color: DIM, marginLeft: 6 }}>({rep?.productId || 'sovereign-real-estate-os'})</span>
      </div>

      {/* Grid of 4 platforms */}
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

      {/* Action Bar */}
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
  const hoverAgent = useRef<string | null>(null);
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

  // 1s heartbeat so mission-log elapsed timers tick between SSE events.
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Enterprise stations: preload sprites and poll each station's live
  // status feed. Busy = the venture is actively working right now.
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
          .catch(() => { });
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
    const onClick = (ev: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const w = r.width, h = r.height;
      const agents = (snapRef.current.agents || []).slice().sort(agentSort);
      const cx = w / 2 + (w >= 900 ? 100 : 0), cy = h / 2 + h * 0.05;
      const mx = ev.clientX - r.left, my = ev.clientY - r.top;

      let hitStation = false;
      const stRx = Math.min(w * 0.37, 580) * 1.48;
      const stRy = Math.min(h * 0.32, 320) * 1.48;
      BUSINESS_STATIONS.forEach((st, si) => {
        const a = st.phase + time * 0.022 + si * 2.1;
        const sx = cx + Math.cos(a) * stRx;
        const sy = cy + Math.sin(a) * stRy;
        if (Math.hypot(mx - sx, my - sy) < 45) {
          hitStation = true;
          setSelectedStation((cur) => (cur === st.id ? null : st.id));
          setSelectedAgent(null);
        }
      });

      if (!hitStation) {
        agents.forEach((a) => {
          const { x: ax, y: ay } = agentPos(agents, a, w, h, cx, cy, time);
          if (Math.hypot(mx - ax, my - ay) < 34) {
            setSelectedAgent((cur) => (cur === a.id ? null : a.id));
            setSelectedStation(null);
          }
        });
      }
    };
    canvas.addEventListener('mousemove', onMouse);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('click', onClick);

    interface Mote { x: number; y: number; z: number; r: number; tw: number }
    const motes: Mote[] = Array.from({ length: 160 }, (_, i) => ({
      x: prand(i, 1), y: prand(i, 2), z: prand(i, 3),
      r: 0.4 + prand(i, 4) * 1.4, tw: prand(i, 5) * Math.PI * 2,
    }));
    interface Trail { x: number; y: number; life: number }
    const trails = new Map<string, Trail[]>();
    const pulses = new Map<string, number[]>();
    const embers: { a: number; r: number; s: number }[] = Array.from({ length: 26 }, (_, i) => ({
      a: prand(i, 11) * Math.PI * 2, r: 0.4 + prand(i, 12) * 0.6, s: 0.3 + prand(i, 13) * 0.9,
    }));
    interface Meteor { x: number; y: number; vx: number; vy: number; life: number }
    const meteors: Meteor[] = [];
    let meteorTimer = 4;
    let lastAgentKey = '';
    const prevStatus = new Map<string, string>();
    let raf = 0, time = 0, last = performance.now();

    // Gradient caches — CanvasGradient objects are expensive to allocate;
    // rebuild only when the quantized inputs actually change.
    let bgCache: { key: string; g: CanvasGradient } | null = null;
    let horizonCache: { key: string; g: CanvasGradient } | null = null;

    const par = () => ({
      x: reducedMotion.current || !mouse.current.inside ? 0 : (mouse.current.x - 0.5) * 18,
      y: reducedMotion.current || !mouse.current.inside ? 0 : (mouse.current.y - 0.5) * 12,
    });

    const agentPos = (agents: AgentClient[], agent: AgentClient, w: number, h: number, cx: number, cy: number, t: number) => {
      const tier = agentOrbitTier(agent);
      const group = agents.filter((x) => agentOrbitTier(x) === tier);
      const i = Math.max(0, group.indexOf(agent));
      const n = Math.max(group.length, 1);
      const baseA = (i / n) * Math.PI * 2 - Math.PI / 2 + (tier === 'enterprise' ? 0.31 : tier === 'console' ? 0.18 : 0);
      const wob = reducedMotion.current ? 0 : Math.sin(t * 0.6 + i * 1.9 + (tier === 'enterprise' ? 2.2 : tier === 'console' ? 1.2 : 0)) * 0.05;
      const k = tier === 'console' ? 0.60 : tier === 'enterprise' ? 1.28 : 1.0;
      const rx = Math.min(w * 0.37, 580) * k, ry = Math.min(h * 0.32, 320) * k;
      return { x: cx + Math.cos(baseA + wob) * rx, y: cy + Math.sin(baseA + wob) * ry, a: baseA, tier };
    };

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      if (!reducedMotion.current) time += dt;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr, h = canvas.height / dpr;
      const p = par();
      ctx.save(); ctx.scale(dpr, dpr);

      // ── 1. Deep space base ──
      ctx.globalCompositeOperation = 'source-over';
      const bgKey = `${w}x${h}|${p.x.toFixed(1)}|${p.y.toFixed(1)}`;
      if (!bgCache || bgCache.key !== bgKey) {
        const bg = ctx.createRadialGradient(w / 2 + p.x * 0.3, h * 0.42 + p.y * 0.3, 0, w / 2, h * 0.5, Math.max(w, h) * 0.75);
        bg.addColorStop(0, '#080c18');
        bg.addColorStop(0.45, '#04060d');
        bg.addColorStop(1, '#020308');
        bgCache = { key: bgKey, g: bg };
      }
      ctx.fillStyle = bgCache.g;
      ctx.fillRect(0, 0, w, h);

      // Shift the whole scene right when the roster rail is visible so the
      // orbit clears it (roster ~200px at left).
      const cx = w / 2 + (w >= 900 ? 100 : 0) + p.x, cy = h / 2 + h * 0.05 + p.y;

      // ── 2. Animated perspective grid — lines rush toward viewer ──
      const horizon = h * 0.70 + p.y * 0.4;
      const scroll = (time * 0.35) % 1;
      ctx.strokeStyle = 'rgba(103,232,249,0.08)';
      ctx.lineWidth = 1;
      const gridRows = 10;
      for (let i = 0; i < gridRows; i++) {
        const pz = ((i / gridRows) + scroll) % 1;
        const y = horizon + Math.pow(pz, 2.4) * (h - horizon);
        ctx.globalAlpha = 0.12 + pz * 0.8;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const gridCols = 18;
      for (let i = -gridCols; i <= gridCols; i++) {
        const xTop = cx + (i / gridCols) * w * 0.05;
        const xBot = cx + (i / gridCols) * w * 0.8;
        ctx.strokeStyle = 'rgba(103,232,249,0.055)';
        ctx.beginPath(); ctx.moveTo(xTop, horizon); ctx.lineTo(xBot, h); ctx.stroke();
      }
      const hzKey = `${bgKey}|${horizon.toFixed(1)}`;
      if (!horizonCache || horizonCache.key !== hzKey) {
        const hg = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 4);
        hg.addColorStop(0, 'rgba(103,232,249,0)');
        hg.addColorStop(1, 'rgba(103,232,249,0.32)');
        horizonCache = { key: hzKey, g: hg };
      }
      ctx.fillStyle = horizonCache.g;
      ctx.fillRect(0, horizon - 40, w, 44);

      // ── 3. Starfield + model constellation (parallax depth) ──
      const models = snapRef.current.models || [];
      const pp = { x: p.x * 0.4, y: p.y * 0.4 }; // far layer moves less
      for (const m of motes) {
        if (!reducedMotion.current) {
          m.y += m.z * dt * 0.006;
          if (m.y > 1) { m.y = 0; m.x = prand(Math.random() * 9999, 7); }
        }
        const tw = 0.5 + 0.5 * Math.sin(time * 1.4 + m.tw);
        ctx.fillStyle = `rgba(186,230,253,${(0.05 + m.z * 0.10) * tw})`;
        ctx.fillRect(m.x * w + pp.x, m.y * h + pp.y, m.r, m.r);
      }
      // model stars — halo ring with filament web between neighbors.
      // Constrained to a safe ellipse that clears the left/right telemetry
      // columns and top/bottom HUD strips so labels never collide.
      const starPos: { x: number; y: number; m: ModelClient; i: number }[] = [];
      const starRx = Math.min(w * 0.34, 560) - 0; // keeps |dx| < w/2 - ~190 at w>=1280
      const starRy = Math.min(h * 0.30, 290);
      models.forEach((m, i) => {
        const a = (i / Math.max(models.length, 1)) * Math.PI * 2 + time * 0.015;
        starPos.push({ x: cx + Math.cos(a) * starRx + pp.x, y: cy + Math.sin(a) * starRy + pp.y, m, i });
      });
      // faint filaments between adjacent healthy stars
      ctx.lineWidth = 0.6;
      for (let i = 0; i < starPos.length - 1; i++) {
        const A = starPos[i], B = starPos[i + 1];
        if (A.m.status === 'healthy' && B.m.status === 'healthy' && prand(i, 21) > 0.72) {
          ctx.strokeStyle = 'rgba(165,243,252,0.06)';
          ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        }
      }
      starPos.forEach(({ x, y, m, i }) => {
        const healthy = m.status === 'healthy';
        const tw = 0.6 + 0.4 * Math.sin(time * 2.2 + i * 1.3);
        const alpha = healthy ? 0.85 * tw : m.status === 'degraded' ? 0.5 : m.status === 'down' ? 0.2 : 0.35;
        ctx.globalCompositeOperation = 'lighter';
        const glowR = healthy ? 8 : 4;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        glow.addColorStop(0, modelStarColor(m));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, glowR, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = modelStarColor(m);
        ctx.beginPath(); ctx.arc(x, y, healthy ? 2 : 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      });
      // labels for flagship healthy models (top 6 by lane order)
      ctx.font = `7px ${MONO}`;
      ctx.textAlign = 'center';
      starPos.filter(s => s.m.status === 'healthy'
        && s.x > 200 && s.x < w - 200 && s.y > 80 && s.y < h - 90
      ).slice(0, 6).forEach(({ x, y, m }) => {
        const label = String(m.id).split('/').pop() || m.id;
        ctx.fillStyle = 'rgba(165,243,252,0.4)';
        ctx.fillText(label.slice(0, 26), x, y - 8);
      });

      // ── 3b. Shooting stars ──
      meteorTimer -= dt;
      if (meteorTimer <= 0 && meteors.length < 3) {
        meteorTimer = 5 + Math.random() * 9;
        const dir = Math.random() > 0.5 ? 1 : -1;
        meteors.push({ x: Math.random() * w, y: Math.random() * h * 0.3, vx: dir * (260 + Math.random() * 200), vy: 120 + Math.random() * 120, life: 1 });
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const mt = meteors[i];
        mt.x += mt.vx * dt; mt.y += mt.vy * dt; mt.life -= dt * 1.1;
        if (mt.life <= 0 || mt.x < -50 || mt.x > w + 50) { meteors.splice(i, 1); continue; }
        const grad = ctx.createLinearGradient(mt.x, mt.y, mt.x - mt.vx * 0.18, mt.y - mt.vy * 0.18);
        grad.addColorStop(0, `rgba(224,242,254,${0.8 * mt.life})`);
        grad.addColorStop(1, 'rgba(224,242,254,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(mt.x, mt.y); ctx.lineTo(mt.x - mt.vx * 0.18, mt.y - mt.vy * 0.18); ctx.stroke();
      }

      // ── 4. Reactor core — plasma, rune rings, ember sparks, voice-reactive ──
      const vl = voiceLevel.current;
      const vocal = voiceState.current === 'speaking' || voiceState.current === 'listening';
      const coreR = Math.min(w, h) * 0.075 * (1 + Math.sin(time * 1.6) * 0.05 + vl * 0.35 + (vocal ? 0.12 : 0));
      ctx.globalCompositeOperation = 'lighter';
      const plasma = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * (4 + vl * 2));
      plasma.addColorStop(0, `rgba(240,249,255,${0.7 + vl * 0.3})`);
      plasma.addColorStop(0.18, `rgba(103,232,249,${0.38 + vl * 0.32})`);
      plasma.addColorStop(0.5, 'rgba(56,189,248,0.13)');
      plasma.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = plasma;
      ctx.beginPath(); ctx.arc(cx, cy, coreR * (4 + vl * 2), 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      const body = ctx.createRadialGradient(cx - coreR * 0.3, cy - coreR * 0.3, 0, cx, cy, coreR);
      body.addColorStop(0, '#f0f9ff');
      body.addColorStop(0.6, '#7dd3fc');
      body.addColorStop(1, '#0369a1');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();
      // inner rotating hexagon
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-time * 0.8);
      ctx.strokeStyle = 'rgba(224,242,254,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const rr = coreR * 0.62;
        i === 0 ? ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.stroke();
      ctx.restore();
      // rune rings
      ctx.save(); ctx.translate(cx, cy);
      for (const [ringR, speed, dash, alpha] of [[coreR * 1.55, 0.5, 10, 0.5], [coreR * 1.95, -0.32, 4, 0.3], [coreR * 2.4, 0.18, 2, 0.18]] as const) {
        ctx.save(); ctx.rotate(time * speed);
        ctx.strokeStyle = `rgba(165,243,252,${alpha})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([dash, dash * 2.2]);
        ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const long = i % 6 === 0;
          ctx.strokeStyle = `rgba(165,243,252,${alpha * (long ? 1.6 : 0.7)})`;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * ringR, Math.sin(a) * ringR);
          ctx.lineTo(Math.cos(a) * (ringR + (long ? 7 : 3)), Math.sin(a) * (ringR + (long ? 7 : 3)));
          ctx.stroke();
        }
        ctx.restore();
      }
      // ember sparks orbiting the core
      ctx.globalCompositeOperation = 'lighter';
      for (const e of embers) {
        if (!reducedMotion.current) e.a += dt * e.s * 0.4;
        const er = coreR * (1.7 + e.r * 0.9);
        const ex = Math.cos(e.a + time * 0.1) * er, ey = Math.sin(e.a + time * 0.1) * er * 0.55;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 2 + e.a * 3));
        ctx.fillStyle = `rgba(165,243,252,${0.5 * tw})`;
        ctx.beginPath(); ctx.arc(ex, ey, 1.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      // ── 5. Agents ──
      const s = snapRef.current;
      const agents = (s.agents || []).slice().sort(agentSort);

      // ── Three Hierarchical Orbital Rings ──
      const baseRx = Math.min(w * 0.37, 580);
      const baseRy = Math.min(h * 0.32, 320);

      // 1. Inner Ring — Flight Consoles (Specialists closest to Cortex Core)
      const hasConsoles = agents.some((a) => agentOrbitTier(a) === 'console');
      if (hasConsoles) {
        ctx.strokeStyle = 'rgba(56,189,248,0.24)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, baseRx * 0.60, baseRy * 0.60, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = `700 7px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(56,189,248,0.6)';
        ctx.fillText('FLIGHT CONSOLES // SPECIALIST RING', cx, cy - baseRy * 0.60 - 7);
      }

      // 2. Mid Ring — Support Craft
      const hasSupport = agents.some((a) => agentOrbitTier(a) === 'support');
      if (hasSupport) {
        ctx.strokeStyle = 'rgba(103,232,249,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 7]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, baseRx, baseRy, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = `7px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(103,232,249,0.35)';
        ctx.fillText('SUPPORT CRAFT // MID ORBIT', cx, cy - baseRy - 8);
      }

      // 3. Outer Ring — Enterprise Satellite Deck (Missions)
      const hasEnterprise = agents.some((a) => agentOrbitTier(a) === 'enterprise');
      if (hasEnterprise) {
        ctx.strokeStyle = 'rgba(251,191,36,0.18)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, baseRx * 1.28, baseRy * 1.28, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = `7px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(251,191,36,0.5)';
        ctx.fillText('ENTERPRISE DECK', cx, cy - baseRy * 1.28 - 8);
      }
      ctx.setLineDash([]);

      const agentKey = agents.map(a => `${a.id}:${a.status}:${a.currentTaskId}`).join('|');
      if (agentKey !== lastAgentKey) {
        const prev = lastAgentKey;
        lastAgentKey = agentKey;
        if (prev) {
          agents.forEach((a) => {
            const old = prevStatus.get(a.id);
            if (old && old !== a.status) {
              const arr = pulses.get(a.id) || [];
              arr.push(0);
              pulses.set(a.id, arr);
            }
            prevStatus.set(a.id, a.status);
          });
        } else agents.forEach(a => prevStatus.set(a.id, a.status));
      }

      // hover detection
      if (mouse.current.inside) {
        let best: string | null = null, bestD = 34;
        agents.forEach((a) => {
          const { x: ax, y: ay } = agentPos(agents, a, w, h, cx, cy, time);
          const d = Math.hypot(mouse.current.x * w - ax, mouse.current.y * h - ay);
          if (d < bestD) { bestD = d; best = a.id; }
        });
        hoverAgent.current = best;
        canvas.style.cursor = best ? 'pointer' : 'crosshair';
      } else {
        hoverAgent.current = null;
        canvas.style.cursor = 'crosshair';
      }

      // ── Inter-Agent Communication Conduits (agent.comm) ──
      const recentComms = events.filter((e) => e.type === 'agent.comm' && (Date.now() - e.at < 12_000));
      recentComms.forEach((comm: any) => {
        const fromAgent = agents.find((x) => x.id === comm.from);
        const toAgent = (comm.to === 'cortex' || comm.to === 'all')
          ? null
          : agents.find((x) => x.id === comm.to);
        if (fromAgent) {
          const fromP = agentPos(agents, fromAgent, w, h, cx, cy, time);
          const toX = toAgent ? agentPos(agents, toAgent, w, h, cx, cy, time).x : cx;
          const toY = toAgent ? agentPos(agents, toAgent, w, h, cx, cy, time).y : cy;

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const age = Math.min(1, (Date.now() - comm.at) / 12_000);
          const alpha = (1 - age) * 0.88;
          const commCol = AGENT_COLORS[comm.from] || '#c084fc';

          // Glowing laser conduit line
          ctx.strokeStyle = hexA(commCol, alpha * 0.7);
          ctx.lineWidth = 1.8;
          ctx.setLineDash([7, 4]);
          ctx.beginPath();
          ctx.moveTo(fromP.x, fromP.y);
          ctx.lineTo(toX, toY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Traveling photon packet
          const packetT = (((Date.now() - comm.at) * 0.0025) % 1);
          const ptx = fromP.x + (toX - fromP.x) * packetT;
          const pty = fromP.y + (toY - fromP.y) * packetT;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(ptx, pty, 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = hexA(commCol, 0.9);
          ctx.beginPath(); ctx.arc(ptx, pty, 6, 0, Math.PI * 2); ctx.fill();

          // Speech / Directive HUD tag near mid-beam
          const midX = (fromP.x + toX) / 2;
          const midY = (fromP.y + toY) / 2 - 14;
          ctx.font = '700 8px monospace';
          const txt = `📡 ${String(comm.from).toUpperCase()} ➔ ${String(comm.to).toUpperCase()}: ${String(comm.message || '').slice(0, 38)}`;
          const tw = ctx.measureText(txt).width;
          ctx.fillStyle = 'rgba(6,10,22,0.88)';
          ctx.strokeStyle = hexA(commCol, alpha * 0.85);
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

      agents.forEach((a, i) => {
        const { x: ax, y: ay } = agentPos(agents, a, w, h, cx, cy, time);
        const enterprise = agentTier(a) === 'enterprise';
        const col = AGENT_COLORS[a.id] || (a.spawnSpec ? `hsl(${spawnHue(a.id)} 85% 68%)` : '#94a3b8');
        const working = a.status === 'working';
        const errored = a.status === 'error';
        const offline = a.status === 'offline' || a.status === 'retired';
        const hot = hoverAgent.current === a.id || selectedAgent === a.id;

        // trail
        const tr = trails.get(a.id) || [];
        tr.push({ x: ax, y: ay, life: 1 });
        if (tr.length > 46) tr.shift();
        trails.set(a.id, tr);
        for (let k = tr.length - 1; k >= 0; k--) {
          const tp = tr[k];
          tp.life -= dt * 1.4;
          if (tp.life <= 0) { tr.splice(k, 1); continue; }
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = hexA(col, tp.life * 0.17);
          ctx.beginPath(); ctx.arc(tp.x, tp.y, 2.3 * tp.life + 0.4, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }

        // shockwave pulses
        const ps = pulses.get(a.id) || [];
        for (let k = ps.length - 1; k >= 0; k--) {
          ps[k] += dt * 1.8;
          if (ps[k] >= 1) { ps.splice(k, 1); continue; }
          ctx.strokeStyle = errored ? `rgba(248,113,113,${0.6 * (1 - ps[k])})` : hexA(col, 0.55 * (1 - ps[k]));
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(ax, ay, 12 + ps[k] * 48, 0, Math.PI * 2); ctx.stroke();
        }

        // data conduit to core while working
        if (working) {
          ctx.globalCompositeOperation = 'lighter';
          const beam = ctx.createLinearGradient(ax, ay, cx, cy);
          beam.addColorStop(0, hexA(col, 0.18));
          beam.addColorStop(1, hexA(col, 0.02));
          ctx.strokeStyle = beam;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy); ctx.stroke();
          const prog = (time * 0.9 + i * 0.37) % 1;
          const px2 = ax + (cx - ax) * prog, py2 = ay + (cy - ay) * prog;
          ctx.fillStyle = hexA(col, 0.95);
          ctx.beginPath(); ctx.arc(px2, py2, 2.8, 0, Math.PI * 2); ctx.fill();
          // packet wake
          ctx.fillStyle = hexA(col, 0.3);
          ctx.beginPath(); ctx.arc(ax + (cx - ax) * Math.max(0, prog - 0.04), ay + (cy - ay) * Math.max(0, prog - 0.04), 1.4, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }

        // vessel glow + hull — enterprise satellites get a larger frame
        const vr = (working ? 15 : hot ? 13 : 10) + (enterprise ? 4 : 0);
        ctx.globalCompositeOperation = 'lighter';
        const vg = ctx.createRadialGradient(ax, ay, 0, ax, ay, vr * 3.6);
        vg.addColorStop(0, hexA(col, offline ? 0.10 : hot ? 0.6 : 0.45));
        vg.addColorStop(1, hexA(col, 0));
        ctx.globalAlpha = offline ? 0.4 : 1;
        ctx.fillStyle = vg;
        ctx.beginPath(); ctx.arc(ax, ay, vr * 3.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = offline ? 0.3 : 1;

        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(Math.atan2(ay - cy, ax - cx) + Math.PI / 2);
        // engine flare when working
        if (working) {
          const fl = 0.6 + 0.4 * Math.sin(time * 9 + i);
          ctx.globalCompositeOperation = 'lighter';
          const eg = ctx.createRadialGradient(0, vr * 1.3, 0, 0, vr * 1.3, vr * 1.6);
          eg.addColorStop(0, hexA(col, 0.5 * fl));
          eg.addColorStop(1, hexA(col, 0));
          ctx.fillStyle = eg;
          ctx.beginPath(); ctx.arc(0, vr * 1.3, vr * 1.6, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        // ── Cyber-Celestial Sacred Geometry Architecture ──
        if (a.id === 'antigravity' || a.id === 'devin') {
          // ── 1. APEX SINGULARITIES: Antigravity & Devin ──
          // Sovereign apex vessels: dual counter-rotating tachyon rings + Forerunner diamond + quantum core
          const ringRad = vr * 1.75;
          ctx.save();
          // Counter-rotating calibration ring 1
          ctx.rotate(time * (working ? 3.0 : 1.4));
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.4;
          ctx.setLineDash([7, 5]);
          ctx.beginPath(); ctx.arc(0, 0, ringRad, 0, Math.PI * 2); ctx.stroke();
          // Counter-rotating polar ring 2 with 4 cardinal diamond ticks
          ctx.rotate(-time * (working ? 4.2 : 2.2));
          ctx.strokeStyle = '#e0f2fe';
          ctx.lineWidth = 1.0;
          ctx.setLineDash([3, 5]);
          ctx.beginPath(); ctx.arc(0, 0, ringRad * 1.28, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          for (let k = 0; k < 4; k++) {
            const ka = (k * Math.PI) / 2;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(Math.cos(ka) * ringRad * 1.28, Math.sin(ka) * ringRad * 1.28, 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          // Singularity Hull: Forerunner Diamond Prism
          ctx.fillStyle = '#060814';
          ctx.strokeStyle = working ? '#f472b6' : col;
          ctx.lineWidth = working ? 2.6 : 1.9;
          ctx.beginPath();
          ctx.moveTo(0, -vr * 1.45);
          ctx.lineTo(vr * 1.08, 0);
          ctx.lineTo(0, vr * 1.45);
          ctx.lineTo(-vr * 1.08, 0);
          ctx.closePath();
          ctx.fill(); ctx.stroke();

          // Inner facet lattice
          ctx.strokeStyle = hexA(col, 0.45);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -vr * 1.45); ctx.lineTo(0, vr * 1.45);
          ctx.moveTo(-vr * 1.08, 0); ctx.lineTo(vr * 1.08, 0);
          ctx.stroke();

          // Quantum Singularity Core
          const qg = ctx.createRadialGradient(0, 0, 0, 0, 0, vr * 0.72);
          qg.addColorStop(0, '#ffffff');
          qg.addColorStop(0.35, col);
          qg.addColorStop(0.8, '#38bdf8');
          qg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = qg;
          ctx.beginPath(); ctx.arc(0, 0, vr * 0.72, 0, Math.PI * 2); ctx.fill();

          // Specular glint
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath(); ctx.arc(0, -vr * 0.65, 1.8, 0, Math.PI * 2); ctx.fill();
        } else if (a.id === 'distributor') {
          // ── 2. OMNI-SYNDICATION HARMONIC ASTROLABE: Distributor ──
          // Radiant tri-torus wave emitter + hexagonal resonance core
          const hubR = vr * 1.35;
          ctx.save();
          ctx.rotate(time * (working ? 2.5 : 0.8));
          ctx.strokeStyle = hexA(col, 0.6);
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 6]);
          ctx.beginPath(); ctx.arc(0, 0, hubR, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          // 4 cardinal orbital diamond nodes
          for (let k = 0; k < 4; k++) {
            const ka = (k * Math.PI) / 2;
            const dx = Math.cos(ka) * hubR, dy = Math.sin(ka) * hubR;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(dx, dy - 2); ctx.lineTo(dx + 2, dy); ctx.lineTo(dx, dy + 2); ctx.lineTo(dx - 2, dy);
            ctx.closePath(); ctx.fill();
          }
          ctx.restore();

          // Hexagonal Resonance Core
          ctx.fillStyle = '#060a16';
          ctx.strokeStyle = col;
          ctx.lineWidth = working ? 2.2 : 1.6;
          ctx.beginPath();
          for (let h = 0; h < 6; h++) {
            const ha = (h * Math.PI) / 3;
            const hx = Math.cos(ha) * vr * 0.95;
            const hy = Math.sin(ha) * vr * 0.95;
            if (h === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.fill(); ctx.stroke();

          // Radiating Carrier Waveforms when working
          if (working) {
            for (let w = 1; w <= 3; w++) {
              const wavePhase = (time * 3 + w * 0.8) % 3;
              const waveR = vr * (1.1 + wavePhase * 0.8);
              ctx.strokeStyle = hexA(col, Math.max(0, 0.65 - wavePhase * 0.22));
              ctx.lineWidth = 1.1;
              ctx.beginPath(); ctx.arc(0, 0, waveR, 0, Math.PI * 2); ctx.stroke();
            }
          }

          // Central Nucleus
          const dg = ctx.createRadialGradient(0, 0, 0, 0, 0, vr * 0.55);
          dg.addColorStop(0, '#ffffff');
          dg.addColorStop(0.4, col);
          dg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = dg;
          ctx.beginPath(); ctx.arc(0, 0, vr * 0.55, 0, Math.PI * 2); ctx.fill();
        } else if (a.id === 'sentinel' || a.id === 'warden') {
          // ── 3. OMNIDIRECTIONAL SENSOR ASTROLABE: Sentinel & Warden ──
          // Continuous planar sweep radar beam + concentric cross-hair reticle
          ctx.save();
          // Radar sweep line
          const sweepAngle = time * (working ? 6.0 : 2.4);
          ctx.strokeStyle = hexA(col, 0.8);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(sweepAngle) * vr * 1.5, Math.sin(sweepAngle) * vr * 1.5);
          ctx.stroke();
          // Radar scan sector gradient
          const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, vr * 1.5);
          sg.addColorStop(0, hexA(col, 0.35));
          sg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, vr * 1.5, sweepAngle - 0.7, sweepAngle);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Calibrated Outer Ring
          ctx.strokeStyle = hexA(col, 0.5);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(0, 0, vr * 1.4, 0, Math.PI * 2); ctx.stroke();

          // Faceted Sensor Octagon
          ctx.fillStyle = '#060a16';
          ctx.strokeStyle = col;
          ctx.lineWidth = working ? 2.2 : 1.6;
          ctx.beginPath();
          for (let o = 0; o < 8; o++) {
            const oa = (o * Math.PI) / 4;
            const ox = Math.cos(oa) * vr * 0.85;
            const oy = Math.sin(oa) * vr * 0.85;
            if (o === 0) ctx.moveTo(ox, oy);
            else ctx.lineTo(ox, oy);
          }
          ctx.closePath();
          ctx.fill(); ctx.stroke();

          // Sensor Core Tachyon Pip
          ctx.fillStyle = working ? '#ffffff' : col;
          ctx.beginPath(); ctx.arc(0, 0, vr * 0.35, 0, Math.PI * 2); ctx.fill();
        } else if (a.id === 'builder' || a.id === 'runner') {
          // ── 4. HYPER-TESSERACT MATRIX: Builder & Runner ──
          // Isometric 4D hypercube lattice rotating on diagonal axes
          ctx.save();
          ctx.rotate(time * (working ? 2.6 : 0.7));
          // Outer isometric cube
          ctx.fillStyle = '#060a16';
          ctx.strokeStyle = col;
          ctx.lineWidth = working ? 2.0 : 1.4;
          const cw = vr * 0.88;
          ctx.beginPath();
          ctx.strokeRect(-cw, -cw, cw * 2, cw * 2);
          // Inner rotated hypercube
          ctx.rotate(Math.PI / 4);
          ctx.strokeStyle = hexA(col, 0.75);
          ctx.strokeRect(-cw * 0.65, -cw * 0.65, cw * 1.3, cw * 1.3);
          ctx.restore();

          // Central Kinetic Spark
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(0, 0, vr * 0.32, 0, Math.PI * 2); ctx.fill();
        } else {
          // ── 5. SACRED VECTOR ASTROLABE: Specialists & Spawned Fleet ──
          // Concentric celestial ring with faceted octahedron prism
          if (enterprise) {
            ctx.save();
            ctx.rotate(time * (working ? 2.2 : 0.6));
            ctx.strokeStyle = hexA(col, 0.55);
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 6]);
            ctx.beginPath(); ctx.arc(0, 0, vr * 1.5, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            // 4 orbital micro-focus diamonds
            for (let k = 0; k < 4; k++) {
              const ka = (k * Math.PI) / 2;
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(Math.cos(ka) * vr * 1.5, Math.sin(ka) * vr * 1.5, 1.2, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }

          // Faceted Diamond Hull
          ctx.fillStyle = '#060a16';
          ctx.strokeStyle = col;
          ctx.lineWidth = working ? 2.2 : hot ? 1.8 : 1.3;
          ctx.beginPath();
          ctx.moveTo(0, -vr * 1.22);
          ctx.lineTo(vr * 0.78, 0);
          ctx.lineTo(0, vr * 1.22);
          ctx.lineTo(-vr * 0.78, 0);
          ctx.closePath();
          ctx.fill(); ctx.stroke();

          // Internal Resonance Lattice
          ctx.save();
          ctx.rotate(time * (working ? 2.0 : 0.5));
          ctx.strokeStyle = hexA(col, working ? 0.9 : 0.45);
          ctx.lineWidth = 1;
          ctx.strokeRect(-vr * 0.32, -vr * 0.32, vr * 0.64, vr * 0.64);
          ctx.restore();

          // Specular glint
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath(); ctx.arc(-vr * 0.2, -vr * 0.32, 1.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;

        if (working) {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(ax, ay, 3, 0, Math.PI * 2); ctx.fill();
        }
        if (errored) {
          const pr = 15 + Math.sin(time * 7) * 5;
          ctx.strokeStyle = 'rgba(248,113,113,0.75)';
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(ax, ay, pr, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(ax, ay, pr * 0.6, 0, Math.PI * 2); ctx.stroke();
        }
        if (hot) {
          ctx.strokeStyle = hexA(col, 0.65);
          ctx.setLineDash([3, 5]);
          ctx.beginPath(); ctx.arc(ax, ay, vr * 2.15, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          // floating name tag on hover
          ctx.font = `700 9px ${MONO}`;
          ctx.textAlign = 'center';
          ctx.fillStyle = hexA(col, 0.9);
          ctx.fillText(a.name, ax, ay - vr * 1.5 - 8);
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = offline ? 'rgba(100,116,139,0.75)' : INK;
        ctx.font = `700 10px ${MONO}`;
        ctx.fillText(a.name, ax, ay + vr * 1.15 + 16);
        ctx.fillStyle = errored ? '#f87171' : working ? col : DIM;
        ctx.font = `8px ${MONO}`;
        const tier = agentOrbitTier(a);
        const tierPrefix = tier === 'enterprise' ? 'SAT·' : tier === 'console' ? 'CON·' : '';
        ctx.fillText(`${tierPrefix}${a.status.toUpperCase()}`, ax, ay + vr * 1.15 + 27);
      });

      // ── 5b. Enterprise stations — businesses on the outer orbit ──
      {
        const stRx = Math.min(w * 0.37, 580) * 1.24 * 1.10;
        const stRy = Math.min(h * 0.32, 320) * 1.24 * 1.10;
        ctx.strokeStyle = 'rgba(251,191,36,0.10)';
        ctx.setLineDash([1, 9]);
        ctx.beginPath(); ctx.ellipse(cx, cy, stRx, stRy, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `7px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(251,191,36,0.35)';
        ctx.fillText('ENTERPRISES', cx, cy - stRy - 8);

        BUSINESS_STATIONS.forEach((st, si) => {
          const stt = stationStatus.current[st.id] || { busy: false, state: 'unknown' as const };
          const a = st.phase + time * (stt.busy ? 0.05 : 0.022) + si * 2.1;
          const sx = cx + Math.cos(a) * stRx;
          const sy = cy + Math.sin(a) * stRy;
          const iw = st.size.w, ih = st.size.h;
          const col = stt.state === 'error' ? '#f87171' : '#fbbf24';
          const pulse = stt.busy
            ? 0.55 + 0.3 * Math.sin(time * 5)
            : 0.26 + 0.08 * Math.sin(time * 1.2 + si);

          // ambient glow
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, iw * 0.95);
          g.addColorStop(0, hexA(col, pulse * 0.45));
          g.addColorStop(1, hexA(col, 0));
          ctx.fillStyle = g;
          ctx.fillRect(sx - iw, sy - ih, iw * 2, ih * 2);

          // busy: rotating dashed halo + orbiting sparks = work in progress
          if (stt.busy && !reducedMotion.current) {
            ctx.strokeStyle = hexA(col, 0.55);
            ctx.setLineDash([4, 6]);
            ctx.lineDashOffset = -time * 34;
            ctx.beginPath(); ctx.ellipse(sx, sy, iw * 0.72, ih * 0.72, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
            for (let k = 0; k < 4; k++) {
              const sa = time * 2.4 + k * (Math.PI / 2) + si * 1.7;
              ctx.fillStyle = hexA(col, 0.85);
              ctx.beginPath();
              ctx.arc(sx + Math.cos(sa) * iw * 0.72, sy + Math.sin(sa) * ih * 0.72, 1.6, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          drawStationGlyph(ctx, sx, sy, 1, time + si * 2.4, stt.busy, col);

          // name + live status — Foundry face only
          ctx.font = `700 8px ${MONO}`;
          ctx.fillStyle = stt.busy ? col : 'rgba(251,191,36,0.75)';
          ctx.fillText(st.name, sx, sy + ih / 2 + 12);
          ctx.font = `7px ${MONO}`;
          ctx.fillStyle = stt.state === 'error' ? '#f87171' : stt.busy ? col : DIM;
          ctx.fillText(stt.state === 'unknown' ? 'LINKING' : stt.state.toUpperCase(), sx, sy + ih / 2 + 21);
        });
      }

      // ── 6. Reticle + coordinate readout ──
      if (mouse.current.inside && !reducedMotion.current) {
        const mx = mouse.current.x * w, my = mouse.current.y * h;
        ctx.strokeStyle = 'rgba(165,243,252,0.35)';
        ctx.lineWidth = 1;
        const R = 14;
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => {
          ctx.beginPath();
          ctx.moveTo(mx + dx * R * 0.5, my + dy * R * 0.5);
          ctx.lineTo(mx + dx * R, my + dy * R);
          ctx.stroke();
        });
        ctx.beginPath(); ctx.arc(mx, my, 1.6, 0, Math.PI * 2); ctx.stroke();
        const bearing = ((Math.atan2(my - cy, mx - cx) * 180 / Math.PI) + 360) % 360;
        const dist = Math.round(Math.hypot(mx - cx, my - cy));
        ctx.font = `7px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(165,243,252,0.5)';
        ctx.fillText(`BRG ${bearing.toFixed(0).padStart(3, '0')}°  RNG ${dist}`, mx + 18, my - 10);
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
  }, [selectedAgent, selectedStation]);

  // ── DOM overlay data ──
  const tasksByAgent = new Map<string, AgentTaskClient[]>();
  for (const t of snap.tasks || []) {
    if (t.status === 'running' || t.status === 'queued') {
      const arr = tasksByAgent.get(t.agentId) || [];
      arr.push(t); tasksByAgent.set(t.agentId, arr);
    }
  }
  const agents = snap.agents || [];
  const workingCount = agents.filter(a => a.status === 'working').length;
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
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />

      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(pos => (
        <div key={pos} style={{
          position: 'absolute', width: 26, height: 26, zIndex: 6, pointerEvents: 'none',
          [pos.includes('top') ? 'top' : 'bottom']: 14,
          [pos.includes('left') ? 'left' : 'right']: 14,
          borderTop: pos.includes('top') ? '1px solid rgba(103,232,249,0.35)' : undefined,
          borderBottom: pos.includes('bottom') ? '1px solid rgba(103,232,249,0.35)' : undefined,
          borderLeft: pos.includes('left') ? '1px solid rgba(103,232,249,0.35)' : undefined,
          borderRight: pos.includes('right') ? '1px solid rgba(103,232,249,0.35)' : undefined,
        }} />
      ))}

      <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 5, textAlign: 'center' }}>
        <div style={{ fontSize: 13, letterSpacing: '0.55em', fontWeight: 700, color: 'rgba(224,242,254,0.95)', fontFamily: MONO, textShadow: '0 0 18px rgba(103,232,249,0.5)' }}>
          NEXUS FOUNDRY
        </div>
        <div style={{ fontSize: 8, letterSpacing: '0.3em', color: 'rgba(148,233,255,0.45)', fontFamily: MONO, marginTop: 4 }}>
          {workingCount} AGENTS ACTIVE · {healthyModels}/{(snap.models || []).length} MODELS VERIFIED · {(snap.tasks || []).filter(t => t.status === 'running').length} TASKS IN FLIGHT
        </div>
        <button
          onClick={() => setTowerOpen(o => !o)}
          style={{
            marginTop: 8, background: towerOpen ? 'rgba(251,191,36,0.12)' : 'rgba(103,232,249,0.06)',
            border: `1px solid ${towerOpen ? 'rgba(251,191,36,0.5)' : 'rgba(103,232,249,0.3)'}`,
            color: towerOpen ? '#fbbf24' : 'rgba(165,243,252,0.8)',
            fontFamily: MONO, fontSize: 8, letterSpacing: '0.25em', padding: '3px 12px',
            borderRadius: 2, cursor: 'pointer',
          }}
        >{towerOpen ? '◈ TOWER OPEN' : '◇ TOWER'}</button>
      </div>

      {/* Right rail: merged foundry telemetry — sentinel rotation, model
          lanes, probation pool, event bus. Roster owns the left side. */}
      <div style={{ position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)', zIndex: 5, fontFamily: MONO, fontSize: 8, letterSpacing: '0.18em', color: 'rgba(148,233,255,0.4)', lineHeight: 2, textAlign: 'right' }}>
        <div style={{ color: 'rgba(165,243,252,0.55)', letterSpacing: '0.28em', marginBottom: 4 }}>FOUNDRY TELEMETRY</div>
        <div>SENTINEL ROTATION: LIVE</div>
        <div>PROBATION POOL: {(snap.models || []).filter(m => m.status === 'unknown').length}</div>
        <div>LANES: {Object.entries(snap.matrix || {}).map(([k, v]) => `${k.toUpperCase()} ${Array.isArray(v) ? v.length : 0}`).join(' · ')}</div>
        <div>UPTIME: {snap.runtime ? fmtElapsed(Date.now() - snap.runtime.startedAt) : '—'}</div>
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(103,232,249,0.12)', paddingTop: 8 }}>
          EVENT BUS: {snap.runtime?.eventCount ?? 0}
        </div>
        <div>AGENTS: {agents.length} REGISTERED</div>
        <div>SPAWNS: {(snap.proposals || []).length} PENDING · {agents.filter(a => a.spawnSpec).length} LIVE</div>
        <div>STATE: {snap.offline ? 'OFFLINE' : 'LIVE'}</div>
      </div>

      {/* ── Left rail: Mission Control Roster — Apollo Flight Hierarchy ── */}
      {!narrow && (
        <div style={{
          position: 'absolute', left: 64, top: '50%', transform: 'translateY(-50%)', zIndex: 5,
          width: 218, fontFamily: MONO,
          background: 'rgba(4,8,18,0.85)', border: '1px solid rgba(103,232,249,0.18)',
          borderRadius: 4, backdropFilter: 'blur(8px)', overflow: 'hidden',
          boxShadow: '0 0 32px rgba(0,0,0,0.7)',
        }}>
          <div style={{
            padding: '8px 10px', borderBottom: '1px solid rgba(103,232,249,0.16)',
            color: 'rgba(165,243,252,0.9)', fontWeight: 800, letterSpacing: '0.22em', fontSize: 8.5,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'linear-gradient(90deg, rgba(56,189,248,0.12), transparent)',
          }}>
            <span>MISSION CONTROL ROSTER</span>
            <span style={{ color: '#fbbf24', fontSize: 7, letterSpacing: '0.12em' }}>APOLLO MAPPING</span>
          </div>
          <div className="ambient-scrollbar" style={{ maxHeight: '72vh', overflowY: 'auto', scrollbarWidth: 'thin', padding: '6px 8px' }}>
            {/* 1. THE CREW (Chris) */}
            <div style={{ marginBottom: 6, padding: '5px 7px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '0.16em', color: '#fbbf24' }}>THE CREW (CHRIS)</span>
                <span style={{ width: 5.5, height: 5.5, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 6px #fbbf24' }} />
              </div>
              <div style={{ fontSize: 7, color: 'rgba(254,240,138,0.9)', marginTop: 2 }}>HOLDS VETO · FINAL GO / NO-GO</div>
              <div style={{ fontSize: 6.5, color: DIM, marginTop: 1 }}>Approves Hard-lane only</div>
            </div>

            {/* 2. FLIGHT DIRECTOR — CORTEX CORE */}
            <div
              onClick={() => setTowerOpen(true)}
              style={{
                marginBottom: 6, padding: '5px 7px', background: 'rgba(56,189,248,0.06)',
                border: '1px solid rgba(56,189,248,0.32)', borderRadius: 3, cursor: 'pointer',
              }}
              title="Click to open Flight Director Console"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '0.16em', color: '#38bdf8' }}>FLIGHT DIRECTOR</span>
                <span style={{ width: 5.5, height: 5.5, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
              </div>
              <div style={{ fontSize: 7, color: 'rgba(224,242,254,0.9)', marginTop: 2 }}>CORTEX CORE (STRATEGIST)</div>
              <div style={{ fontSize: 6.5, color: DIM, marginTop: 1 }}>Owns console · Decides, never flies</div>
            </div>

            {/* 3. FLIGHT CONSOLES (Specialists) */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 6.8, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(165,243,252,0.65)', padding: '2px 3px', marginBottom: 2 }}>
                FLIGHT CONSOLES (SPECIALISTS)
              </div>
              {[
                { id: 'antigravity', callSign: 'GUIDANCE', agentId: 'antigravity', desc: 'Strategy · Vision', col: '#c084fc' },
                { id: 'builder', callSign: 'FLT CONTROLS', agentId: 'builder', desc: 'Execute (Builder)', col: '#34d399' },
                { id: 'runner', callSign: 'FLT CONTROLS', agentId: 'runner', desc: 'Execute (Runner)', col: '#a3e635' },
                { id: 'sentinel', callSign: 'EECOM', agentId: 'sentinel', desc: 'Power/Compute (電力/計算)', col: '#67e8f9' },
                { id: 'capcom', callSign: 'CAPCOM', agentId: 'voice', desc: 'Talk to Crew (Voice)', col: '#f472b6', isVoice: true },
                { id: 'forecaster', callSign: 'FDO', agentId: 'forecaster', desc: 'Trajectory · Orbits', col: '#2dd4bf' },
                { id: 'warden', callSign: 'SURGEON', agentId: 'warden', desc: 'Quality Gate · Safety', col: '#818cf8' },
              ].map(item => {
                const a = agents.find(x => x.id === item.agentId);
                const active = a && selectedAgent === a.id;
                const status = item.isVoice ? (voiceState.current || 'idle') : (a?.status || 'standby');
                const lampCol = status === 'working' || status === 'active' || status === 'speaking' ? '#34d399' : status === 'error' ? '#f87171' : 'rgba(148,163,184,0.45)';
                return (
                  <div
                    key={item.id}
                    onClick={() => { if (a) setSelectedAgent(active ? null : a.id); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '3.5px 6px',
                      borderRadius: 2, marginBottom: 2, cursor: a ? 'pointer' : 'default',
                      background: active ? hexA(item.col, 0.16) : 'rgba(15,23,42,0.45)',
                      border: `1px solid ${active ? hexA(item.col, 0.45) : 'rgba(148,163,184,0.08)'}`,
                    }}
                  >
                    <span style={{ fontSize: 7, fontWeight: 700, color: item.col, minWidth: 60, letterSpacing: '0.06em' }}>{item.callSign}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 7.5, color: active ? '#ffffff' : 'rgba(224,242,254,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a?.name || item.desc}
                      </div>
                      <div style={{ fontSize: 6.5, color: DIM }}>{item.desc}</div>
                    </div>
                    <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: lampCol, flexShrink: 0, boxShadow: lampCol === '#34d399' ? '0 0 5px #34d399' : 'none' }} />
                  </div>
                );
              })}
            </div>

            {/* 4. THE COUNSEL */}
            <div
              onClick={() => setTowerOpen(true)}
              style={{
                marginBottom: 6, padding: '5px 7px', background: 'rgba(192,132,252,0.06)',
                border: '1px solid rgba(192,132,252,0.3)', borderRadius: 3, cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '0.16em', color: '#c084fc' }}>THE COUNSEL</span>
                <span style={{ fontSize: 6.5, color: '#fbbf24' }}>GO/NO-GO ➔</span>
              </div>
              <div style={{ fontSize: 6.5, color: DIM, marginTop: 1 }}>Specialists file · Director synthesizes</div>
            </div>

            {/* 5. SUPPORT CRAFT */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 6.8, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(165,243,252,0.65)', padding: '2px 3px', marginBottom: 2 }}>
                SUPPORT CRAFT (AGENTS)
              </div>
              {agents.filter(a => !['strategist', 'antigravity', 'builder', 'runner', 'sentinel', 'forecaster', 'warden'].includes(a.id)).map(a => {
                const col = AGENT_COLORS[a.id] || (a.spawnSpec ? `hsl(${spawnHue(a.id)} 85% 68%)` : '#94a3b8');
                const active = selectedAgent === a.id;
                const statusCol = a.status === 'working' ? col : a.status === 'error' ? '#f87171' : 'rgba(148,163,184,0.45)';
                return (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAgent(active ? null : a.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px',
                      borderRadius: 2, marginBottom: 2, cursor: 'pointer',
                      background: active ? hexA(col, 0.16) : 'transparent',
                      borderBottom: '1px solid rgba(148,233,255,0.04)',
                    }}
                  >
                    <AgentGlyph enterprise={agentTier(a) === 'enterprise'} color={col} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 7.5, fontWeight: 700, color: active ? col : 'rgba(224,242,254,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.name}
                      </div>
                      <div style={{ fontSize: 6.5, color: DIM }}>{a.role.slice(0, 24)}</div>
                    </div>
                    <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: statusCol, flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>

            {/* 6. MISSIONS & GROUND SEGMENT */}
            <div style={{ borderTop: '1px solid rgba(103,232,249,0.12)', paddingTop: 5, marginTop: 4 }}>
              <div style={{ fontSize: 6.8, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(165,243,252,0.65)', padding: '2px 3px', marginBottom: 2 }}>
                MISSIONS (PIPELINES)
              </div>
              <div style={{ fontSize: 6.5, color: DIM, padding: '1px 3px', display: 'flex', justifyContent: 'space-between' }}>
                <span>SHYNED · LAWBOT · STORES</span>
                <span style={{ color: '#34d399' }}>ACTIVE</span>
              </div>
              <div style={{ fontSize: 6.8, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(165,243,252,0.65)', padding: '2px 3px', marginTop: 4, marginBottom: 2 }}>
                GROUND SEGMENT
              </div>
              <div style={{ fontSize: 6.5, color: DIM, padding: '1px 3px', display: 'flex', justifyContent: 'space-between' }}>
                <span>MAC (LOCAL) + ORACLE (TDRS)</span>
                <span style={{ color: '#34d399' }}>● LINKED</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mission Log: always-on feed of real agent tasks ── */}
      <div style={{
        position: 'absolute', right: 22, bottom: 40, zIndex: 5, width: 300,
        fontFamily: MONO, fontSize: 8, letterSpacing: '0.1em',
        background: 'rgba(4,8,18,0.72)', border: '1px solid rgba(103,232,249,0.16)',
        borderRadius: 4, backdropFilter: 'blur(6px)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '7px 10px', borderBottom: '1px solid rgba(103,232,249,0.14)',
          color: 'rgba(165,243,252,0.75)', fontWeight: 700, letterSpacing: '0.28em', fontSize: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>MISSION LOG</span>
          <span style={{ color: 'rgba(148,233,255,0.35)', letterSpacing: '0.15em' }}>
            {missionTasks.filter(t => t.status === 'running' || t.status === 'queued').length} ACTIVE
          </span>
        </div>
        <div className="ambient-scrollbar" style={{ maxHeight: 190, overflowY: 'auto', scrollbarWidth: 'thin' }}>
          {missionTasks.length === 0 && (
            <div style={{ padding: '12px 10px', color: 'rgba(148,233,255,0.3)', letterSpacing: '0.15em' }}>
              NO TASKS THIS SESSION — SUBMIT WORK VIA VOICE OR API
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
                  animation: t.status === 'running' ? 'none' : undefined,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'rgba(224,242,254,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.title}
                  </div>
                  <div style={{ color: 'rgba(148,233,255,0.4)', marginTop: 2, display: 'flex', gap: 6 }}>
                    <span style={{ color: agentCol }}>{agentName.get(t.agentId) || t.agentId}</span>
                    <span>·</span>
                    <span style={{ color: col }}>{t.status.toUpperCase()}</span>
                    {t.model && <><span>·</span><span style={{ color: 'rgba(196,181,253,0.55)' }}>{String(t.model).split(':').pop()?.slice(0, 22)}</span></>}
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
          ◌ AGENT RUNTIME OFFLINE — IS THE DEV SERVER RUNNING?
        </div>
      )}

      {/* live event ticker */}
      {tickerEvents.length > 0 && (
        <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 6, fontFamily: MONO, fontSize: 8, letterSpacing: '0.12em', color: 'rgba(165,243,252,0.55)', textAlign: 'center', lineHeight: 1.9, pointerEvents: 'none' }}>
          {tickerEvents.map((e, i) => (
            <div key={`${e.at}-${i}`} style={{ opacity: 1 - i * 0.16 }}>{eventLine(e)}</div>
          ))}
        </div>
      )}

      {agents.map((a, i) => {
        const col = AGENT_COLORS[a.id] || (a.spawnSpec ? `hsl(${spawnHue(a.id)} 85% 68%)` : '#94a3b8');
        const tasks = tasksByAgent.get(a.id) || [];
        if (!tasks.length) return null;
        const baseA = (i / Math.max(agents.length, 1)) * Math.PI * 2 - Math.PI / 2;
        const left = (narrow ? 50 : 57) + Math.cos(baseA) * (narrow ? 36 : 33);
        const top = 50 + Math.sin(baseA) * 28;
        return (
          <div key={a.id} onClick={() => setSelectedAgent(selectedAgent === a.id ? null : a.id)}
            style={{
              position: 'absolute', left: `${left}%`, top: `${top}%`, transform: 'translate(-50%,-100%)',
              zIndex: 6, width: 250, cursor: 'pointer',
              background: 'linear-gradient(160deg, rgba(8,14,24,0.88), rgba(5,8,15,0.82))',
              border: `1px solid ${hexA(col, 0.4)}`, borderRadius: 3,
              backdropFilter: 'blur(12px)', padding: '9px 11px',
              boxShadow: `0 0 32px ${hexA(col, 0.18)}, inset 0 0 18px ${hexA(col, 0.04)}`,
            }}>
            <div style={{ position: 'absolute', top: -1, left: -1, width: 8, height: 8, borderTop: `1px solid ${col}`, borderLeft: `1px solid ${col}` }} />
            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderBottom: `1px solid ${col}`, borderRight: `1px solid ${col}` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 9, letterSpacing: '0.24em', color: col, fontFamily: MONO, fontWeight: 700 }}>{a.name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 8, color: DIM, fontFamily: MONO }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: a.status === 'working' ? col : a.status === 'error' ? '#f87171' : 'rgba(148,163,184,0.4)', boxShadow: a.status === 'working' ? `0 0 6px ${col}` : 'none' }} />
                {a.status.toUpperCase()}
              </span>
            </div>
            {tasks.slice(0, 2).map(t => (
              <div key={t.id} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: 'rgba(226,232,240,0.9)', fontFamily: MONO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div style={{ flex: 1, height: 3, background: 'rgba(148,163,184,0.14)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${Math.round((t.progress ?? 0) * 100)}%`, height: '100%', background: `linear-gradient(90deg, ${hexA(col, 0.6)}, ${col})`, boxShadow: `0 0 8px ${hexA(col, 0.6)}`, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: 8, color: 'rgba(148,233,255,0.6)', fontFamily: MONO, whiteSpace: 'nowrap' }}>
                    {t.status === 'queued' ? 'QUEUED' : `${Math.round((t.progress ?? 0) * 100)}%`}
                    {t.model && <span style={{ color: hexA(col, 0.9) }}> · {t.model.split('/').pop()?.split(':').pop()?.slice(0, 16)}</span>}
                  </span>
                </div>
                {t.startedAt && <div style={{ fontSize: 7, color: 'rgba(148,163,184,0.4)', fontFamily: MONO, marginTop: 2, textAlign: 'right' }}>{fmtElapsed(Date.now() - t.startedAt)} ELAPSED</div>}
              </div>
            ))}
            {tasks.length > 2 && <div style={{ fontSize: 8, color: 'rgba(148,233,255,0.45)', fontFamily: MONO }}>+{tasks.length - 2} MORE IN QUEUE</div>}
          </div>
        );
      })}

      {selectedAgent && (() => {
        const a = agents.find(x => x.id === selectedAgent);
        if (!a) return null;
        return <AgentDossierPanel agent={a} snap={snap} now={nowTs} onClose={() => setSelectedAgent(null)} dockLeft={!narrow} />;
      })()}

      {selectedStation && (
        <OmniSyndicationPanel onClose={() => setSelectedStation(null)} dockLeft={!narrow} />
      )}

      <CortexFoundryNav
        snap={snap}
        onSelectAgent={setSelectedAgent}
        selectedAgent={selectedAgent}
        onOpenTower={() => setTowerOpen(true)}
      />
      {towerOpen && <CortexTowerPanel onClose={() => setTowerOpen(false)} />}

      <div style={{ position: 'absolute', inset: 0, zIndex: 8, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 3px)' }} />
    </div>
  );
};

export default CortexAgentsScene;
