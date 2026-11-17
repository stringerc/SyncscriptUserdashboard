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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { agentsClient, type AgentsSnapshotClient, type AgentClient, type AgentTaskClient, type ModelClient } from '../../lib/cortex-agents-client';
import { cortexSignalBus } from './CortexVisualizer';
import { CortexTowerPanel } from './CortexTowerPanel';

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
/** Enterprise fleet (revenue agents + self-spawned) flies the outer satellite deck. */
const agentTier = (a?: AgentClient | null): 'enterprise' | 'standard' =>
  a?.tier === 'enterprise' || !!a?.spawnSpec ? 'enterprise' : 'standard';
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
      position: 'absolute', left: 216, top: '50%', transform: 'translateY(-50%)', zIndex: 7,
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
          <span style={{ fontSize: 7, letterSpacing: 0.1, color: agentTier(a) === 'enterprise' ? '#fbbf24' : DIM, marginLeft: 8, verticalAlign: 'middle' }}>
            {agentTier(a) === 'enterprise' ? 'ENTERPRISE' : 'STANDARD'}
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
  const mouse = useRef({ x: 0.5, y: 0.5, rawX: 0, rawY: 0, inside: false, isDragging: false, dragStartX: 0, dragStartY: 0 });
  const hoverEntity = useRef<{ type: 'agent' | 'room' | 'dock' | 'tower'; id: string; name: string; x: number; y: number } | null>(null);
  const stationStatus = useRef<Record<string, { busy: boolean; state: 'idle' | 'busy' | 'error' | 'unknown' }>>({});

  // StarNet-style Pan/Zoom Camera State
  const cam = useRef({ x: 0, y: 0, zoom: 1, targetX: 0, targetY: 0, targetZoom: 1 });

  // Persistent Agent Spatial Render State
  const agentAvatars = useRef<Map<string, {
    x: number; y: number;
    homeX: number; homeY: number;
    targetX: number; targetY: number;
    facing: number;
    walkTimer: number;
    state: 'idle' | 'walking' | 'working' | 'handoff';
    assignedRoom: string;
  }>>(new Map());

  // Background Starfield
  const stars = useMemo(() => {
    return Array.from({ length: 180 }, (_, i) => ({
      x: prand(i, 1) * 2400 - 1200,
      y: prand(i, 2) * 1800 - 900,
      size: 0.8 + prand(i, 3) * 1.6,
      twinkleSpeed: 0.8 + prand(i, 4) * 2.2,
      phase: prand(i, 5) * Math.PI * 2,
    }));
  }, []);

  // Energy Conduit Packets
  const packets = useRef<Array<{ route: number; t: number; speed: number; col: string }>>([
    { route: 0, t: 0.1, speed: 0.24, col: '#38bdf8' },
    { route: 1, t: 0.4, speed: 0.32, col: '#67e8f9' },
    { route: 2, t: 0.7, speed: 0.28, col: '#fbbf24' },
    { route: 3, t: 0.2, speed: 0.26, col: '#34d399' },
    { route: 4, t: 0.8, speed: 0.35, col: '#c084fc' },
  ]);

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

  // ── Station Spatial Room Definitions ──
  const ROOMS = useMemo(() => [
    {
      id: 'tower',
      name: 'APPROACH CONTROL // TOWER',
      sub: 'CORTEX FLIGHT ARBITRATION',
      x: -160, y: -90, w: 320, h: 180,
      color: '#38bdf8', icon: '📡',
      floorStyle: 'hex',
    },
    {
      id: 'counsel',
      name: 'COUNSEL DELIBERATION CHAMBER',
      sub: 'GO/NO-GO CLEARANCE DESK',
      x: -160, y: -310, w: 320, h: 160,
      color: '#c084fc', icon: '⚖️',
      floorStyle: 'plinth',
    },
    {
      id: 'sentinel',
      name: 'SENTINEL DEFENSE & GATEWAY',
      sub: 'SYSTEM PERIMETER FIREWALL',
      x: -430, y: -290, w: 210, h: 150,
      color: '#67e8f9', icon: '🛡️',
      floorStyle: 'grid',
    },
    {
      id: 'scout',
      name: 'SCOUT TELEMETRY & RECON',
      sub: 'DEEP SPACE SENSOR FEED',
      x: -430, y: -80, w: 210, h: 150,
      color: '#e879f9', icon: '🔭',
      floorStyle: 'grid',
    },
    {
      id: 'builder',
      name: 'BUILDER COMPILER FOUNDRY',
      sub: 'WORKSPACE CODE GANTRY',
      x: 220, y: -290, w: 210, h: 150,
      color: '#34d399', icon: '⚙️',
      floorStyle: 'grid',
    },
    {
      id: 'librarian',
      name: 'LIBRARIAN ENGRAM ARCHIVE',
      sub: 'VECTOR MEMORY CYLINDERS',
      x: 220, y: -80, w: 210, h: 150,
      color: '#fbbf24', icon: '📚',
      floorStyle: 'grid',
    },
    {
      id: 'runner',
      name: 'RUNNER EXECUTION LANES',
      sub: 'HIGH-VELOCITY DISPATCH',
      x: -430, y: 130, w: 210, h: 140,
      color: '#a3e635', icon: '⚡',
      floorStyle: 'grid',
    },
    {
      id: 'omni',
      name: 'OMNI // SYNDICATION BERTH',
      sub: 'CARGO OUTBOX & DOCKING AIRLOCK',
      x: -160, y: 150, w: 320, h: 160,
      color: '#fb923c', icon: '🚀',
      floorStyle: 'conveyor',
    },
  ], []);

  // ── Workstation Desks per Agent ──
  const DESKS: Record<string, { x: number; y: number; room: string; label: string }> = {
    antigravity: { x: -65, y: -235, room: 'counsel', label: 'AG-01 COMMAND' },
    devin: { x: 65, y: -235, room: 'counsel', label: 'DEV-02 CODE' },
    strategist: { x: 0, y: -275, room: 'counsel', label: 'STRAT-03 ARBITER' },
    sentinel: { x: -325, y: -215, room: 'sentinel', label: 'GATE SHIELD' },
    scout: { x: -325, y: -5, room: 'scout', label: 'RECON SCOPE' },
    builder: { x: 325, y: -215, room: 'builder', label: 'SYNTHESIS DOCK' },
    librarian: { x: 325, y: -5, room: 'librarian', label: 'ENGRAM CORE' },
    runner: { x: -325, y: 200, room: 'runner', label: 'RAPID DISPATCH' },
    distributor: { x: 0, y: 230, room: 'omni', label: 'SYNDICATION CRANE' },
    reviewer: { x: 325, y: 195, room: 'builder', label: 'AUDIT CONSOLE' },
    warden: { x: -325, y: -155, room: 'sentinel', label: 'WARDEN MONITOR' },
    prep: { x: 325, y: -155, room: 'builder', label: 'PREP BENCH' },
    forecaster: { x: -325, y: 70, room: 'scout', label: 'TELEMETRY PROBE' },
  };

  // ── Main Canvas Rendering Engine ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let lastTime = performance.now();

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

    // Mouse Interaction
    const onMouseDown = (ev: MouseEvent) => {
      if (ev.button !== 0) return;
      mouse.current.isDragging = true;
      mouse.current.dragStartX = ev.clientX - cam.current.x;
      mouse.current.dragStartY = ev.clientY - cam.current.y;
    };
    const onMouseMove = (ev: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.current.rawX = ev.clientX - r.left;
      mouse.current.rawY = ev.clientY - r.top;
      mouse.current.x = mouse.current.rawX / r.width;
      mouse.current.y = mouse.current.rawY / r.height;
      mouse.current.inside = true;

      if (mouse.current.isDragging) {
        cam.current.targetX = ev.clientX - mouse.current.dragStartX;
        cam.current.targetY = ev.clientY - mouse.current.dragStartY;
      }
    };
    const onMouseUp = () => {
      mouse.current.isDragging = false;
    };
    const onLeave = () => {
      mouse.current.inside = false;
      mouse.current.isDragging = false;
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const zoomFactor = ev.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.min(2.5, Math.max(0.55, cam.current.targetZoom * zoomFactor));
      cam.current.targetZoom = newZoom;
    };

    const onClick = (ev: MouseEvent) => {
      // If was dragging significantly, ignore click
      if (Math.hypot(ev.movementX, ev.movementY) > 4) return;
      if (hoverEntity.current) {
        const ent = hoverEntity.current;
        if (ent.type === 'agent') {
          setSelectedAgent(prev => prev === ent.id ? null : ent.id);
        } else if (ent.type === 'dock') {
          setSelectedStation(prev => prev === 'omni-syndication' ? null : 'omni-syndication');
        } else if (ent.type === 'tower') {
          setTowerOpen(prev => !prev);
        }
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('click', onClick);

    // ── Animation Frame Loop ──
    const draw = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const time = now / 1000;

      // Smooth Camera Lerp
      cam.current.x += (cam.current.targetX - cam.current.x) * 0.14;
      cam.current.y += (cam.current.targetY - cam.current.y) * 0.14;
      cam.current.zoom += (cam.current.targetZoom - cam.current.zoom) * 0.14;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.save();
      ctx.scale(dpr, dpr);

      // ── 1. Clear deep space ──
      ctx.fillStyle = '#02040a';
      ctx.fillRect(0, 0, w, h);

      // Deep space nebula glow
      const cx = w * 0.5, cy = h * 0.5;
      const bgGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.max(w, h) * 0.7);
      bgGrad.addColorStop(0, 'rgba(8,18,36,0.65)');
      bgGrad.addColorStop(0.5, 'rgba(4,9,20,0.5)');
      bgGrad.addColorStop(1, 'rgba(2,4,10,0.95)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Parallax Stars
      for (const s of stars) {
        const sx = cx + (s.x + cam.current.x * 0.25) % (w * 1.5) - w * 0.25;
        const sy = cy + (s.y + cam.current.y * 0.25) % (h * 1.5) - h * 0.25;
        const tw = 0.4 + 0.6 * Math.sin(time * s.twinkleSpeed + s.phase);
        ctx.fillStyle = `rgba(224,242,254,${tw * 0.75})`;
        ctx.fillRect(sx, sy, s.size, s.size);
      }

      // ── Station Coordinate Transform ──
      ctx.save();
      ctx.translate(cx + cam.current.x, cy + cam.current.y);
      ctx.scale(cam.current.zoom, cam.current.zoom);

      // Mouse in world coordinates
      const worldMouseX = (mouse.current.rawX - cx - cam.current.x) / cam.current.zoom;
      const worldMouseY = (mouse.current.rawY - cy - cam.current.y) / cam.current.zoom;

      hoverEntity.current = null;

      // ── 2. Structural Bulkhead Catwalks & Hallways ──
      // Wide corridors connecting rooms
      const CORRIDORS = [
        { x: -50, y: -160, w: 100, h: 70 }, // North (Tower -> Counsel)
        { x: -225, y: -45, w: 75, h: 90 }, // West (Tower -> Scout/Sentinel)
        { x: 150, y: -45, w: 80, h: 90 },  // East (Tower -> Builder/Librarian)
        { x: -50, y: 80, w: 100, h: 80 },  // South (Tower -> Omni Dock)
        { x: -340, y: -140, w: 60, h: 70 },// Sentinel to Scout vertical link
        { x: 310, y: -140, w: 60, h: 70 }, // Builder to Librarian vertical link
      ];

      for (const cor of CORRIDORS) {
        // Floor
        ctx.fillStyle = '#060d19';
        ctx.fillRect(cor.x, cor.y, cor.w, cor.h);
        // Hazard guide lines
        ctx.strokeStyle = 'rgba(103,232,249,0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cor.x, cor.y, cor.w, cor.h);
        // Floor centerline dash
        ctx.strokeStyle = 'rgba(251,191,36,0.22)';
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        if (cor.w > cor.h) {
          ctx.moveTo(cor.x, cor.y + cor.h * 0.5);
          ctx.lineTo(cor.x + cor.w, cor.y + cor.h * 0.5);
        } else {
          ctx.moveTo(cor.x + cor.w * 0.5, cor.y);
          ctx.lineTo(cor.x + cor.w * 0.5, cor.y + cor.h);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── 3. Station Rooms Render ──
      for (const rm of ROOMS) {
        const isHover = worldMouseX >= rm.x && worldMouseX <= rm.x + rm.w &&
                        worldMouseY >= rm.y && worldMouseY <= rm.y + rm.h;

        // Hull Floor
        ctx.fillStyle = isHover ? 'rgba(10,22,40,0.92)' : 'rgba(8,16,30,0.85)';
        ctx.fillRect(rm.x, rm.y, rm.w, rm.h);

        // Deck Tile Grid
        ctx.strokeStyle = 'rgba(148,163,184,0.06)';
        ctx.lineWidth = 1;
        const tileSize = 20;
        for (let gx = rm.x + tileSize; gx < rm.x + rm.w; gx += tileSize) {
          ctx.beginPath(); ctx.moveTo(gx, rm.y); ctx.lineTo(gx, rm.y + rm.h); ctx.stroke();
        }
        for (let gy = rm.y + tileSize; gy < rm.y + rm.h; gy += tileSize) {
          ctx.beginPath(); ctx.moveTo(rm.x, gy); ctx.lineTo(rm.x + rm.w, gy); ctx.stroke();
        }

        // Room Outer Bulkhead Walls
        ctx.strokeStyle = isHover ? rm.color : hexA(rm.color, 0.45);
        ctx.lineWidth = isHover ? 2 : 1.5;
        ctx.strokeRect(rm.x, rm.y, rm.w, rm.h);

        // Reinforced Corner Brackets
        const cb = 10;
        ctx.strokeStyle = rm.color;
        ctx.lineWidth = 2.5;
        // TL
        ctx.beginPath(); ctx.moveTo(rm.x, rm.y + cb); ctx.lineTo(rm.x, rm.y); ctx.lineTo(rm.x + cb, rm.y); ctx.stroke();
        // TR
        ctx.beginPath(); ctx.moveTo(rm.x + rm.w - cb, rm.y); ctx.lineTo(rm.x + rm.w, rm.y); ctx.lineTo(rm.x + rm.w, rm.y + cb); ctx.stroke();
        // BL
        ctx.beginPath(); ctx.moveTo(rm.x, rm.y + rm.h - cb); ctx.lineTo(rm.x, rm.y + rm.h); ctx.lineTo(rm.x + cb, rm.y + rm.h); ctx.stroke();
        // BR
        ctx.beginPath(); ctx.moveTo(rm.x + rm.w - cb, rm.y + rm.h); ctx.lineTo(rm.x + rm.w, rm.y + rm.h); ctx.lineTo(rm.x + rm.w, rm.y + rm.h - cb); ctx.stroke();

        // Room Header Badge
        ctx.fillStyle = hexA(rm.color, 0.12);
        ctx.fillRect(rm.x + 8, rm.y + 6, rm.w - 16, 20);
        ctx.font = `700 8px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = rm.color;
        ctx.fillText(`${rm.icon} ${rm.name}`, rm.x + 14, rm.y + 19);

        ctx.font = `600 7px ${MONO}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(148,233,255,0.45)';
        ctx.fillText(rm.sub, rm.x + rm.w - 14, rm.y + 19);

        // Check hover for room/dock
        if (isHover && !hoverEntity.current) {
          if (rm.id === 'omni') {
            hoverEntity.current = { type: 'dock', id: 'omni-syndication', name: 'OMNI SYNDICATION BERTH', x: rm.x + rm.w / 2, y: rm.y + rm.h / 2 };
          } else if (rm.id === 'tower') {
            hoverEntity.current = { type: 'tower', id: 'cortex-tower', name: 'APPROACH CONTROL TOWER', x: rm.x + rm.w / 2, y: rm.y + rm.h / 2 };
          } else {
            hoverEntity.current = { type: 'room', id: rm.id, name: rm.name, x: rm.x + rm.w / 2, y: rm.y + rm.h / 2 };
          }
        }
      }

      // ── 4. Room-Specific Interior Props & Visuals ──

      // [TOWER] Central Radar Scope & Voice Reactive Core
      {
        const trX = 0, trY = 0;
        // Radar Scope
        const radR = 48;
        ctx.save();
        ctx.beginPath();
        ctx.arc(trX, trY, radR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(4,24,36,0.75)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(56,189,248,0.5)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Range rings
        ctx.strokeStyle = 'rgba(56,189,248,0.18)';
        ctx.setLineDash([2, 4]);
        [radR * 0.33, radR * 0.66, radR * 0.95].forEach(r => {
          ctx.beginPath(); ctx.arc(trX, trY, r, 0, Math.PI * 2); ctx.stroke();
        });
        ctx.setLineDash([]);

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(trX - radR, trY); ctx.lineTo(trX + radR, trY);
        ctx.moveTo(trX, trY - radR); ctx.lineTo(trX, trY + radR);
        ctx.stroke();

        // Rotating Sweep Line
        const sweepAngle = (time * 1.4) % (Math.PI * 2);
        const sweepGrad = ctx.createConicGradient(sweepAngle, trX, trY);
        sweepGrad.addColorStop(0, 'rgba(56,189,248,0.55)');
        sweepGrad.addColorStop(0.12, 'rgba(56,189,248,0.0)');
        sweepGrad.addColorStop(1, 'rgba(56,189,248,0.0)');
        ctx.fillStyle = sweepGrad;
        ctx.beginPath();
        ctx.arc(trX, trY, radR, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing Core Monolith inside Radar
        const vLvl = Math.max(0.1, voiceLevel.current);
        const coreR = 7 + vLvl * 14;
        const coreG = ctx.createRadialGradient(trX, trY, 0, trX, trY, coreR);
        coreG.addColorStop(0, '#ffffff');
        coreG.addColorStop(0.35, '#38bdf8');
        coreG.addColorStop(1, 'rgba(56,189,248,0)');
        ctx.fillStyle = coreG;
        ctx.beginPath(); ctx.arc(trX, trY, coreR, 0, Math.PI * 2); ctx.fill();

        // Outer Hex Plinth
        ctx.strokeStyle = 'rgba(56,189,248,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(trX - 70, trY - 60, 140, 120);

        ctx.font = `700 7px ${MONO}`;
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText('RADAR 360° · APPROACH LIVE', trX, trY + radR + 14);

        ctx.restore();
      }

      // [COUNSEL] Triangular Deliberation Hologram Table
      {
        const tblX = 0, tblY = -230;
        ctx.save();
        // Table boundary
        ctx.fillStyle = 'rgba(192,132,252,0.1)';
        ctx.strokeStyle = 'rgba(192,132,252,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tblX, tblY - 35);
        ctx.lineTo(tblX + 45, tblY + 25);
        ctx.lineTo(tblX - 45, tblY + 25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Center holographic insignia
        const holoPulse = 0.5 + 0.5 * Math.sin(time * 3);
        ctx.fillStyle = `rgba(192,132,252,${0.3 + 0.3 * holoPulse})`;
        ctx.beginPath();
        ctx.arc(tblX, tblY - 2, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `700 7px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#c084fc';
        ctx.fillText('COUNSEL CHAMBER · 3 SEATS', tblX, tblY + 40);

        ctx.restore();
      }

      // [OMNI] Cargo Shuttle & Docking Clamps
      {
        const dX = 0, dY = 225;
        ctx.save();
        // Docking Clamps
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(dX - 80, dY - 25, 160, 50);
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(dX - 80, dY - 25, 160, 50);

        // Shuttle hull
        ctx.fillStyle = 'rgba(251,146,60,0.25)';
        ctx.beginPath();
        ctx.moveTo(dX - 50, dY + 15);
        ctx.lineTo(dX, dY - 18);
        ctx.lineTo(dX + 50, dY + 15);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fb923c';
        ctx.stroke();

        // Conveyor moving crates
        ctx.strokeStyle = 'rgba(251,146,60,0.4)';
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -time * 24;
        ctx.beginPath();
        ctx.moveTo(dX - 120, dY + 36);
        ctx.lineTo(dX + 120, dY + 36);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = `700 7px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fb923c';
        ctx.fillText('SOVEREIGN SHUTTLE · DOCKED', dX, dY + 54);
        ctx.restore();
      }

      // ── 5. Floor Conduits & Flowing Packets ──
      const CONDUIT_PATHS = [
        [{ x: 0, y: -90 }, { x: 0, y: -160 }, { x: 0, y: -230 }], // Tower to Counsel
        [{ x: -160, y: 0 }, { x: -225, y: 0 }, { x: -325, y: 0 }], // Tower to Scout
        [{ x: -160, y: -50 }, { x: -225, y: -50 }, { x: -325, y: -215 }], // Tower to Sentinel
        [{ x: 160, y: -50 }, { x: 225, y: -50 }, { x: 325, y: -215 }], // Tower to Builder
        [{ x: 160, y: 0 }, { x: 225, y: 0 }, { x: 325, y: 0 }], // Tower to Librarian
        [{ x: 0, y: 90 }, { x: 0, y: 150 }, { x: 0, y: 225 }], // Tower to Omni
      ];

      for (let pIdx = 0; pIdx < packets.current.length; pIdx++) {
        const p = packets.current[pIdx];
        p.t = (p.t + dt * p.speed) % 1;
        const path = CONDUIT_PATHS[p.route % CONDUIT_PATHS.length];
        if (path && path.length >= 2) {
          const segCount = path.length - 1;
          const totalT = p.t * segCount;
          const segIdx = Math.min(Math.floor(totalT), segCount - 1);
          const segT = totalT - segIdx;
          const p1 = path[segIdx], p2 = path[segIdx + 1];
          const px = p1.x + (p2.x - p1.x) * segT;
          const py = p1.y + (p2.y - p1.y) * segT;

          ctx.fillStyle = p.col;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── 6. Workstation Desks Render ──
      for (const [aId, d] of Object.entries(DESKS)) {
        const col = AGENT_COLORS[aId] || '#38bdf8';
        ctx.fillStyle = 'rgba(15,23,42,0.95)';
        ctx.fillRect(d.x - 18, d.y - 12, 36, 24);
        ctx.strokeStyle = hexA(col, 0.5);
        ctx.lineWidth = 1;
        ctx.strokeRect(d.x - 18, d.y - 12, 36, 24);

        // Terminal monitor glow
        ctx.fillStyle = hexA(col, 0.7);
        ctx.fillRect(d.x - 12, d.y - 8, 24, 7);

        ctx.font = `600 6px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(148,163,184,0.6)';
        ctx.fillText(d.label, d.x, d.y + 20);
      }

      // ── 7. Living Crew Members (Sprites) ──
      const agents = snap.agents || [];
      const currentTasks = snap.tasks || [];

      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        let avatar = agentAvatars.current.get(a.id);
        const desk = DESKS[a.id] || { x: -200 + (i % 5) * 80, y: 200, room: 'runner', label: a.id.toUpperCase() };

        if (!avatar) {
          avatar = {
            x: desk.x, y: desk.y,
            homeX: desk.x, homeY: desk.y,
            targetX: desk.x, targetY: desk.y,
            facing: 1,
            walkTimer: Math.random() * 10,
            state: a.status === 'working' ? 'working' : 'idle',
            assignedRoom: desk.room,
          };
          agentAvatars.current.set(a.id, avatar);
        }

        // Live state update
        if (a.status === 'working') {
          avatar.targetX = desk.x;
          avatar.targetY = desk.y;
          avatar.state = 'working';
        } else {
          avatar.walkTimer += dt;
          if (avatar.walkTimer > 8 + (i % 4) * 2) {
            avatar.walkTimer = 0;
            // Wander slightly around desk or room
            const offsetDist = 20;
            avatar.targetX = desk.x + (Math.random() - 0.5) * offsetDist * 2;
            avatar.targetY = desk.y + (Math.random() - 0.5) * offsetDist * 2;
          }
          avatar.state = 'idle';
        }

        // Move towards target
        const dx = avatar.targetX - avatar.x;
        const dy = avatar.targetY - avatar.y;
        const dist = Math.hypot(dx, dy);
        const isWalking = dist > 2;

        if (isWalking) {
          const speed = 40; // px/sec
          avatar.x += (dx / dist) * Math.min(dist, speed * dt);
          avatar.y += (dy / dist) * Math.min(dist, speed * dt);
          avatar.facing = dx >= 0 ? 1 : -1;
        }

        const ax = avatar.x, ay = avatar.y;
        const col = AGENT_COLORS[a.id] || `hsl(${spawnHue(a.id)}, 70%, 65%)`;

        // Check mouse hover on agent
        const isHoverAgent = Math.hypot(worldMouseX - ax, worldMouseY - ay) < 18;
        if (isHoverAgent) {
          hoverEntity.current = { type: 'agent', id: a.id, name: a.name, x: ax, y: ay };
        }

        // ── Render Pixel-Art Crew Character Sprite ──
        ctx.save();
        ctx.translate(ax, ay);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 8, 8, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Walking Bob
        const walkBob = isWalking ? Math.sin(time * 12) * 2 : 0;
        const legSwing = isWalking ? Math.sin(time * 12) * 4 : 0;

        // Legs
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-4 + legSwing * 0.5, 2 + walkBob, 3, 6);
        ctx.fillRect(1 - legSwing * 0.5, 2 + walkBob, 3, 6);

        // Body Torso (Uniform)
        ctx.fillStyle = col;
        ctx.fillRect(-5, -6 + walkBob, 10, 9);
        // Chest emblem / specialty stripe
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -4 + walkBob, 4, 3);

        // Head / Helmet
        ctx.fillStyle = '#334155';
        ctx.fillRect(-4, -13 + walkBob, 8, 7);
        // Helmet Visor Glow
        ctx.fillStyle = a.status === 'error' ? '#f87171' : a.status === 'working' ? '#67e8f9' : '#f8fafc';
        ctx.fillRect(-3, -11 + walkBob, 6, 2.5);

        // Working Terminal Light Cone
        if (a.status === 'working') {
          const coneG = ctx.createRadialGradient(0, -6, 2, 0, -6, 22);
          coneG.addColorStop(0, hexA(col, 0.45));
          coneG.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = coneG;
          ctx.beginPath();
          ctx.arc(0, -6, 22, -Math.PI * 0.3, Math.PI * 0.3);
          ctx.fill();
        }

        // Floating Tag / Nameplate
        ctx.font = `700 7px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = isHoverAgent ? '#ffffff' : col;
        ctx.fillText(a.name.slice(0, 10), 0, -18);

        // Active Task Progress Mini-bar
        const activeT = currentTasks.find(t => t.agentId === a.id && t.status === 'running');
        if (activeT) {
          const prg = activeT.progress ?? 0.5;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(-12, -26, 24, 3);
          ctx.fillStyle = col;
          ctx.fillRect(-12, -26, 24 * prg, 3);
        }

        ctx.restore();
      }

      ctx.restore(); // End station transform

      // ── 8. In-World Hover Glance Tooltip (StarNet Style) ──
      if (hoverEntity.current) {
        const ent = hoverEntity.current;
        const screenX = cx + cam.current.x + ent.x * cam.current.zoom;
        const screenY = cy + cam.current.y + ent.y * cam.current.zoom - 32 * cam.current.zoom;

        ctx.save();
        ctx.font = `700 9px ${MONO}`;
        ctx.textAlign = 'center';
        const txt = ent.type === 'agent' ? `${ent.name.toUpperCase()} · [INSPECT DOSSIER]`
                  : ent.type === 'dock' ? 'OMNI SYNDICATION BERTH · [CLICK TO AUDIT]'
                  : ent.type === 'tower' ? 'APPROACH CONTROL TOWER · [CLICK TO CONVENE]'
                  : `${ent.name} · [OPERATIONAL]`;
        const tw = ctx.measureText(txt).width + 16;
        const th = 20;

        ctx.fillStyle = 'rgba(10,18,32,0.95)';
        ctx.fillRect(screenX - tw / 2, screenY - th / 2, tw, th);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX - tw / 2, screenY - th / 2, tw, th);

        ctx.fillStyle = '#e0f2fe';
        ctx.fillText(txt, screenX, screenY + 3);
        ctx.restore();
      }

      // ── 9. CRT Screen Shading & Scanlines ──
      if (!reducedMotion.current) {
        // Soft scanlines
        ctx.fillStyle = 'rgba(255,255,255,0.012)';
        for (let sl = 0; sl < h; sl += 3) {
          ctx.fillRect(0, sl, w, 1);
        }
      }

      // Vignette
      const vig = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.45, cx, cy, Math.max(w, h) * 0.75);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(2,4,12,0.65)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('click', onClick);
    };
  }, [selectedAgent, selectedStation]);

  // ── DOM Overlay & HUD ──
  const agents = snap.agents || [];
  const workingCount = agents.filter(a => a.status === 'working').length;
  const healthyModels = (snap.models || []).filter(m => m.status === 'healthy').length;
  const runningTasks = (snap.tasks || []).filter(t => t.status === 'running');

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: '#02040a', overflow: 'hidden', userSelect: 'none' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, cursor: mouse.current.isDragging ? 'grabbing' : 'crosshair' }} />

      {/* Screen Corners Brackets */}
      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(pos => (
        <div key={pos} style={{
          position: 'absolute', width: 24, height: 24, zIndex: 6, pointerEvents: 'none',
          [pos.includes('top') ? 'top' : 'bottom']: 14,
          [pos.includes('left') ? 'left' : 'right']: 14,
          borderTop: pos.includes('top') ? '1px solid rgba(103,232,249,0.4)' : undefined,
          borderBottom: pos.includes('bottom') ? '1px solid rgba(103,232,249,0.4)' : undefined,
          borderLeft: pos.includes('left') ? '1px solid rgba(103,232,249,0.4)' : undefined,
          borderRight: pos.includes('right') ? '1px solid rgba(103,232,249,0.4)' : undefined,
        }} />
      ))}

      {/* Top Header Command Bar */}
      <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 6, textAlign: 'center' }}>
        <div style={{ fontSize: 13, letterSpacing: '0.45em', fontWeight: 800, color: 'rgba(224,242,254,0.95)', fontFamily: MONO, textShadow: '0 0 16px rgba(56,189,248,0.5)' }}>
          CORTEX MISSION CONTROL // NEXUS FOUNDRY
        </div>
        <div style={{ fontSize: 8, letterSpacing: '0.25em', color: 'rgba(148,233,255,0.65)', fontFamily: MONO, marginTop: 4 }}>
          {workingCount} CREW ACTIVE · {healthyModels}/{(snap.models || []).length} BRAINS ONLINE · {runningTasks.length} TASKS IN FLIGHT · DUAL-TOPOLOGY MAC+ORACLE
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
          <button
            onClick={() => setTowerOpen(o => !o)}
            style={{
              background: towerOpen ? 'rgba(251,191,36,0.18)' : 'rgba(56,189,248,0.1)',
              border: `1px solid ${towerOpen ? '#fbbf24' : 'rgba(56,189,248,0.4)'}`,
              color: towerOpen ? '#fbbf24' : '#a5f3fc',
              fontFamily: MONO, fontSize: 8, letterSpacing: '0.2em', padding: '3px 12px',
              borderRadius: 2, cursor: 'pointer',
            }}
          >
            {towerOpen ? '◈ TOWER CLEARANCE OPEN' : '◇ TOWER RADAR'}
          </button>
          <button
            onClick={() => {
              cam.current.targetX = 0;
              cam.current.targetY = 0;
              cam.current.targetZoom = 1;
            }}
            style={{
              background: 'rgba(148,163,184,0.1)',
              border: '1px solid rgba(148,163,184,0.3)',
              color: 'rgba(203,213,225,0.7)',
              fontFamily: MONO, fontSize: 8, letterSpacing: '0.2em', padding: '3px 10px',
              borderRadius: 2, cursor: 'pointer',
            }}
          >
            ⟲ RE-CENTER
          </button>
        </div>
      </div>

      {/* Right Rail: Station Telemetry */}
      <div style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 6, fontFamily: MONO, fontSize: 8, letterSpacing: '0.16em', color: 'rgba(148,233,255,0.5)', lineHeight: 2, textAlign: 'right' }}>
        <div style={{ color: 'rgba(56,189,248,0.7)', letterSpacing: '0.25em', marginBottom: 4 }}>STATION TELEMETRY</div>
        <div>STATION SECTOR: SEC-01 FOUNDRY</div>
        <div>APPROACH CONTROL: RADAR ACTIVE</div>
        <div>AIRSPACE HOLDING: 0 CONFLICTS</div>
        <div>COUNSEL ARBITRATION: ONLINE</div>
        <div>OMNI DOCKING: BERTH READY</div>
        <div>PAN / ZOOM: DRAG & SCROLL</div>
      </div>

      {/* Modals & Dossier Panels */}
      {selectedAgent && (() => {
        const a = agents.find(x => x.id === selectedAgent);
        if (!a) return null;
        return <AgentDossierPanel agent={a} snap={snap} now={nowTs} onClose={() => setSelectedAgent(null)} dockLeft={!narrow} />;
      })()}

      {selectedStation && (
        <OmniSyndicationPanel onClose={() => setSelectedStation(null)} dockLeft={!narrow} />
      )}

      {towerOpen && <CortexTowerPanel onClose={() => setTowerOpen(false)} />}
    </div>
  );
};

export default CortexAgentsScene;
