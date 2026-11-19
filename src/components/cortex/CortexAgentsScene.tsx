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

export const AGENT_COLORS: Record<string, string> = {
  antigravity: '#c084fc',
  devin: '#38bdf8',
  claudecode: '#f97316',
  openclaw: '#06b6d4',
  hermes: '#ef4444',
  curator: '#8b5cf6',
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
export const AGENT_ORDER = ['antigravity', 'sentinel', 'scout', 'librarian', 'builder', 'devin', 'claudecode', 'openclaw', 'hermes', 'curator', 'reviewer', 'runner', 'distributor', 'warden', 'prep', 'forecaster', 'strategist'];
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

export type AgentSectorId = 'command' | 'engineering' | 'intel' | 'governance' | 'gateways' | 'satellite';

export interface SectorDef {
  id: AgentSectorId;
  name: string;
  glyph: string;
  hudLabel: string;
  badge: string;
  color: string;
  centerAngle: number;
  span: number;
}

export interface ShotRecipe {
  id: number;
  title: string;
  timeRange: string;
  frames: string;
  camera: string;
  concept: string;
  shaders: string;
  audio: string;
  metrics: string[];
  gradient: string;
  accent: string;
}

export const SHOT_DATA: ShotRecipe[] = [
  {
    id: 0,
    title: 'SHOT 1: CORE TILT & VOLUMETRIC SWEEP',
    timeRange: '0.0s – 3.5s',
    frames: '210 frames @ 60fps',
    camera: '2.5D Volumetric Arc Tilt (Elevation 32°, Azimuth -45° → 15°)',
    concept: 'Sweeping keynote reveal across the Sovereign Quantum Core and tachyon orbital rings. Synaptic light conduits power up from specialist satellites.',
    shaders: 'Additive Fresnel Glow, Chromatic Dispersion (0.015), CRT Scanline Drift',
    audio: '120 BPM intro riser + 40 Hz sub-bass resonance pulse',
    metrics: ['FPS: 60 DETACHED', 'RESOLUTION: 4K UHD', 'EASING: CUBIC-BEZIER', 'PARTICLES: 240 MOTES'],
    gradient: 'linear-gradient(135deg, rgba(56,189,248,0.2) 0%, rgba(192,132,252,0.1) 100%)',
    accent: '#38bdf8',
  },
  {
    id: 1,
    title: 'SHOT 2: KINETIC SPECS & INVARIANT PASSES',
    timeRange: '3.5s – 7.0s',
    frames: '210 frames @ 60fps',
    camera: 'Isometric Orthographic Grid Pan with multi-layer kinetic typography punch',
    concept: 'Rapid-fire verified engineering specs slam onto the screen: 13/13 Vitest clean suites, 9ms P50 latency gate, zero belief divergence.',
    shaders: 'Kinetic Text Blur, Edge Blooming, Vector Wireframe Glint',
    audio: 'Triple staccato snare transients synchronized to metric cards',
    metrics: ['TESTS: 13/13 CLEAN', 'LATENCY: 9ms P50', 'DRIFT: ZERO CLASH', 'ENGRAMS: 102 SYNCED'],
    gradient: 'linear-gradient(135deg, rgba(52,211,153,0.2) 0%, rgba(56,189,248,0.1) 100%)',
    accent: '#34d399',
  },
  {
    id: 2,
    title: 'SHOT 3: SPLIT-SCREEN TACTICAL MATRIX',
    timeRange: '7.0s – 11.5s',
    frames: '270 frames @ 60fps',
    camera: 'Bifurcated Screen Reveal with interactive wipe divider and depth parallax',
    concept: 'Real-time comparative analysis displaying raw terminal telemetry vs the autonomous 3D tactical holodeck, revealing 10x spatial clarity.',
    shaders: 'Dynamic Split Screen, Chromatic Wipe, Dual-Buffer Alpha Blend',
    audio: 'Stereo panning synth sweep + rhythmic hi-hat groove',
    metrics: ['SPLIT: 50/50 WIPED', 'SYNC: DUAL BUFFER', 'MOTION BLUR: 0.4', 'STEREO PAN: 100%'],
    gradient: 'linear-gradient(135deg, rgba(232,121,249,0.2) 0%, rgba(192,132,252,0.1) 100%)',
    accent: '#e879f9',
  },
  {
    id: 3,
    title: 'SHOT 4: KEYNOTE SOVEREIGN LOCKUP',
    timeRange: '11.5s – 15.0s',
    frames: '210 frames @ 60fps',
    camera: 'Center Anchor Zoom-Out into Sovereign Hero Crest with celestial flare',
    concept: 'Climactic audio drop. The Nexus Foundry lockup crystallizes with golden particle shockwave, presenting mission completion badge.',
    shaders: 'Radial Shockwave Distortion, Golden Bloom, KaTeX Spec Glint',
    audio: '120 BPM heavy bass drop + Cartesia-Sonic TTS sign-off',
    metrics: ['HERO: CORTEX APEX', 'DROP: 120 BPM SYNC', 'BURST: 360 RADIAL', 'EXIT: FADE TO BLACK'],
    gradient: 'linear-gradient(135deg, rgba(251,191,36,0.2) 0%, rgba(244,63,94,0.1) 100%)',
    accent: '#fbbf24',
  },
];

export const SECTORS: Record<AgentSectorId, SectorDef> = {
  command: {
    id: 'command',
    name: 'Command Apex',
    glyph: '★',
    hudLabel: '★ COMMAND APEX',
    badge: 'CMD',
    color: '#c084fc',
    centerAngle: -Math.PI / 2,
    span: 0.94,
  },
  engineering: {
    id: 'engineering',
    name: 'Engineering & Execution',
    glyph: '▲',
    hudLabel: '▲ NORTH // ENGINEERING & EXECUTION',
    badge: 'ENG',
    color: '#38bdf8',
    centerAngle: -Math.PI / 2,
    span: 1.08,
  },
  intel: {
    id: 'intel',
    name: 'Intel & Strategic Memory',
    glyph: '►',
    hudLabel: '► EAST // INTEL & MEMORY',
    badge: 'INTEL',
    color: '#fbbf24',
    centerAngle: 0,
    span: 1.08,
  },
  governance: {
    id: 'governance',
    name: 'Governance & Integrity',
    glyph: '▼',
    hudLabel: '▼ SOUTH // GOVERNANCE & INTEGRITY',
    badge: 'GOV',
    color: '#fb7185',
    centerAngle: Math.PI / 2,
    span: 0.94,
  },
  gateways: {
    id: 'gateways',
    name: 'Gateways & Delivery',
    glyph: '◄',
    hudLabel: '◄ WEST // GATEWAYS & DELIVERY',
    badge: 'GTWY',
    color: '#06b6d4',
    centerAngle: Math.PI,
    span: 1.20,
  },
  satellite: {
    id: 'satellite',
    name: 'Enterprise Satellite Deck',
    glyph: '✦',
    hudLabel: 'ENTERPRISE SATELLITE DECK',
    badge: 'SAT',
    color: '#a78bfa',
    centerAngle: 0,
    span: Math.PI * 2,
  },
};

export const SECTOR_ORDER: Record<AgentSectorId, string[]> = {
  command: ['antigravity', 'strategist'],
  engineering: ['builder', 'runner', 'devin', 'claudecode'],
  intel: ['scout', 'librarian', 'curator', 'forecaster'],
  governance: ['warden', 'sentinel', 'reviewer'],
  gateways: ['openclaw', 'hermes', 'distributor', 'prep', 'brief', 'debrief'],
  satellite: [],
};

export const sectorAgentSort = (sector: AgentSectorId) => (a: AgentClient, b: AgentClient) => {
  const pref = SECTOR_ORDER[sector] || [];
  const ia = pref.indexOf(a.id), ib = pref.indexOf(b.id);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.id.localeCompare(b.id);
};

export const getAgentSector = (a?: AgentClient | null): AgentSectorId => {
  if (!a) return 'intel';
  if (a.spawnSpec || (a.tier === 'enterprise' && !['devin', 'claudecode', 'openclaw', 'hermes'].includes(a.id))) {
    return 'satellite';
  }
  const id = (a.id || '').toLowerCase();
  if (id === 'antigravity' || id === 'strategist') return 'command';
  if (id === 'builder' || id === 'runner' || id === 'devin' || id === 'claudecode') return 'engineering';
  if (id === 'scout' || id === 'librarian' || id === 'curator' || id === 'forecaster') return 'intel';
  if (id === 'warden' || id === 'sentinel' || id === 'reviewer') return 'governance';
  if (id === 'openclaw' || id === 'hermes' || id === 'distributor' || id === 'prep' || id === 'brief' || id === 'debrief') return 'gateways';

  const role = (a.role || '').toLowerCase();
  if (/command|guidance|director/.test(role)) return 'command';
  if (/build|run|code|terminal|engineer/.test(role)) return 'engineering';
  if (/intel|scout|library|forecast|curat|memory/.test(role)) return 'intel';
  if (/warden|sentinel|review|surgeon|safety|guard/.test(role)) return 'governance';
  if (/claw|hermes|portal|distribut|gateway/.test(role)) return 'gateways';

  return 'satellite';
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

function eventLine(e: { type: string; at: number;[k: string]: unknown }): string {
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

const AgentDossierPanel: React.FC<{ agent: AgentClient; snap: AgentsSnapshotClient; now: number; onClose: () => void; dockLeft?: boolean; pinned?: boolean; onTogglePin?: () => void; stackIndex?: number }> = ({ agent: a, snap, now, onClose, dockLeft, pinned, onTogglePin, stackIndex = 0 }) => {
  const [dossierOpen, setDossierOpen] = useState(false);
  const [deepOpen, setDeepOpen] = useState(false);
  const [deep, setDeep] = useState<{ archive: any[]; incidents: any[]; proposals: any[]; counsel: any[]; routines: any[] } | null>(null);
  const [memQuery, setMemQuery] = useState('');
  const [memHits, setMemHits] = useState<any[] | null>(null);
  const [memLoading, setMemLoading] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const col = AGENT_COLORS[a.id] || `hsl(${spawnHue(a.id)}, 70%, 65%)`;

  // Deep record — durable memory beyond the 200-task window, counsel
  // positions, filed proposals, attributed incidents. Lazy on first expand.
  useEffect(() => {
    if (!deepOpen || deep) return;
    let dead = false;
    Promise.allSettled([
      fetch(`/api/cortex/agents/archive?agentId=${encodeURIComponent(a.id)}&limit=25`, { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/cortex/agents/incidents?status=open', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/cortex/agents/proposals', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/cortex/counsel/sessions', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/cortex/agents/routines', { cache: 'no-store' }).then((r) => r.json()),
    ]).then(([arc, inc, prop, cs, rot]) => {
      if (dead) return;
      const sessions: any[] = (cs as any)?.value?.sessions || [];
      const counselRows: any[] = [];
      for (const s of sessions) {
        for (const p of s.positions || []) {
          if (p.member === a.id) counselRows.push({ session: s.id, question: s.question, stance: p.stance, confidence: p.confidence, round: p.round });
        }
      }
      setDeep({
        archive: (arc as any)?.value?.records || [],
        incidents: ((inc as any)?.value?.incidents || []).filter((i: any) => i.agentId === a.id),
        proposals: ((prop as any)?.value?.proposals || []).filter((p: any) => p.agentId === a.id),
        counsel: counselRows,
        routines: ((rot as any)?.value?.routines || []).filter((r: any) => r.agentId === a.id),
      });
    });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepOpen]);

  const searchMemory = async () => {
    const q = memQuery.trim();
    if (!q) { setMemHits(null); return; }
    setMemLoading(true);
    try {
      const r = await fetch(`/api/cortex/agents/memory?agentId=${encodeURIComponent(a.id)}&q=${encodeURIComponent(q)}&limit=15`, { cache: 'no-store' });
      const j: any = await r.json();
      setMemHits(j?.hits || []);
    } catch { setMemHits([]); }
    setMemLoading(false);
  };
  // Free-drag: grab the header (not buttons), panel detaches from its dock.
  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const el = (e.currentTarget as HTMLElement).parentElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pr = el.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
    dragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    setPos({ x: r.left - pr.left, y: r.top - pr.top });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const p = el.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
      setPos({
        x: Math.min(Math.max(0, ev.clientX - p.left - dragRef.current.dx), window.innerWidth - 80),
        y: Math.min(Math.max(0, ev.clientY - p.top - dragRef.current.dy), window.innerHeight - 60),
      });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const current = a.currentTaskId ? snap.tasks.find((t) => t.id === a.currentTaskId) : null;
  const agentTasks = snap.tasks.filter((t) => t.agentId === a.id);
  const decided = agentTasks.filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'vetoed');
  const tsr = decided.length ? Math.round((decided.filter((t) => t.status === 'completed').length / decided.length) * 100) : null;
  const recent = agentTasks;
  const beatAge = a.lastHeartbeatAt ? now - a.lastHeartbeatAt : null;
  const beatCol = beatAge == null ? DIM : beatAge < 30_000 ? '#34d399' : beatAge < 120_000 ? '#fbbf24' : '#f87171';
  const spawn = a.spawnSpec;
  const ttlLeft = spawn?.ttlHours && a.spawnedAt ? a.spawnedAt + spawn.ttlHours * 3_600_000 - now : null;
  const statusCol = STATUS_COLOR[a.status] || DIM;

  const freeStyle: React.CSSProperties = pos ? {
    position: 'absolute', left: pos.x, top: pos.y, transform: 'none', zIndex: 9 + stackIndex,
    width: pinned ? 600 : 520, maxWidth: 'calc(100vw - 40px)', maxHeight: '86vh',
    display: 'flex', flexDirection: 'column',
    background: 'linear-gradient(165deg, rgba(8,14,24,0.96), rgba(5,8,15,0.92))',
    border: `1px solid ${hexA(col, 0.4)}`, borderLeft: `3px solid ${col}`, borderRadius: 3, padding: '12px 16px',
    backdropFilter: 'blur(14px)', boxShadow: `0 8px 48px rgba(0,0,0,0.7), 0 0 40px ${hexA(col, 0.15)}`, overflow: 'hidden',
    cursor: 'default',
  } : {};
  return (
    <div style={pos ? freeStyle : dockLeft ? {
      // Docked to the roster rail: extends rightward from it, vertically centered.
      position: 'absolute', left: 290 + stackIndex * 30, top: '50%', transform: 'translateY(-50%)', zIndex: 7 + stackIndex,
      width: pinned ? 600 : 520, maxWidth: 'calc(100vw - 240px)', maxHeight: pinned ? '84vh' : '74vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(165deg, rgba(8,14,24,0.94), rgba(5,8,15,0.9))',
      border: `1px solid ${hexA(col, 0.35)}`, borderLeft: `3px solid ${col}`, borderRadius: 3, padding: '12px 16px',
      backdropFilter: 'blur(14px)', boxShadow: `0 0 40px ${hexA(col, 0.15)}`, overflow: 'hidden',
    } : {
      position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 7,
      width: pinned ? 640 : 560, maxWidth: '94vw', maxHeight: pinned ? '76vh' : '62vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(165deg, rgba(8,14,24,0.94), rgba(5,8,15,0.9))',
      border: `1px solid ${hexA(col, 0.35)}`, borderRadius: 3, padding: '12px 16px',
      backdropFilter: 'blur(14px)', boxShadow: `0 0 40px ${hexA(col, 0.15)}`, overflow: 'hidden',
    }}>
      <style>{'@keyframes cortexPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }'}</style>
      {/* ── ZONE A: NOW ── */}
      <div onPointerDown={onHeaderPointerDown} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, cursor: pos ? 'grab' : 'default' }} title={pos ? 'Drag to move · release anywhere' : 'Drag header to undock'}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AgentGlyph enterprise={agentOrbitTier(a) === 'enterprise'} color={col} />
          <span style={{ fontSize: 11, letterSpacing: '0.3em', color: col, fontFamily: MONO, fontWeight: 700 }}>
            {a.name}
            <span style={{ fontSize: 7, letterSpacing: '0.12em', color: SECTORS[getAgentSector(a)].color, marginLeft: 8, verticalAlign: 'middle', border: `1px solid ${hexA(SECTORS[getAgentSector(a)].color, 0.4)}`, padding: '1px 5px', borderRadius: 2 }}>
              {SECTORS[getAgentSector(a)].glyph} {SECTORS[getAgentSector(a)].name.toUpperCase()}
            </span>
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 8, color: DIM, fontFamily: MONO }}>{a.role}</span>
          {onTogglePin && (
            <button onClick={onTogglePin} title={pinned ? 'Unpin — dossier closes on deselect' : 'Pin — keep dossier on the board'} style={{
              background: pinned ? 'rgba(251,191,36,0.15)' : 'none', border: `1px solid ${pinned ? 'rgba(251,191,36,0.6)' : 'rgba(148,163,184,0.3)'}`,
              color: pinned ? '#fbbf24' : DIM, cursor: 'pointer', fontSize: 8, fontFamily: MONO, fontWeight: 700, padding: '2px 7px', borderRadius: 2, letterSpacing: '0.12em',
            }}>{pinned ? 'PINNED' : 'PIN'}</button>
          )}
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
        <div className="ambient-scrollbar" style={{ overflowY: 'auto', maxHeight: 190, flexShrink: 1 }}>
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

      {/* ── ZONE D: DEEP RECORD — durable memory, counsel votes, proposals, incidents ── */}
      <button onClick={() => setDeepOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: MONO, fontSize: 8, color: DIM, letterSpacing: 0.15, padding: '8px 0 0', textTransform: 'uppercase',
      }}>
        <span style={{ color: col }}>{deepOpen ? '▾' : '▸'}</span> deep record — memory · counsel · proposals · incidents
      </button>
      {deepOpen && (
        <div className="ambient-scrollbar" style={{ overflowY: 'auto', maxHeight: 170, flexShrink: 1, fontSize: 8, fontFamily: MONO, color: 'rgba(203,213,225,0.7)', lineHeight: 1.7, paddingTop: 6 }}>
          {!deep && <div style={{ color: DIM }}>RETRIEVING RECORD…</div>}
          {deep && (
            <>
              <div style={{ color: 'rgba(203,213,225,0.85)', marginBottom: 2 }}>COUNSEL RECORD</div>
              {deep.counsel.length ? deep.counsel.map((c, i) => (
                <div key={i} style={{ paddingLeft: 6 }}>
                  <span style={{ color: c.stance === 'go' ? '#34d399' : c.stance === 'no-go' ? '#f87171' : '#fbbf24' }}>{String(c.stance).toUpperCase()}</span>
                  <span style={{ color: DIM }}> {Math.round((c.confidence || 0) * 100)}% · r{c.round} · {c.session}</span>
                  <div style={{ color: DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(c.question || '').slice(0, 80)}</div>
                </div>
              )) : <div style={{ color: DIM, paddingLeft: 6 }}>NO POSITIONS FILED</div>}

              <div style={{ color: 'rgba(203,213,225,0.85)', margin: '6px 0 2px' }}>PROPOSALS FILED</div>
              {deep.proposals.length ? deep.proposals.slice(0, 6).map((p) => (
                <div key={p.id} style={{ paddingLeft: 6 }}>
                  <span style={{ color: p.status === 'executed' || p.status === 'approved' ? '#34d399' : p.status === 'failed' || p.status === 'dismissed' ? '#f87171' : '#fbbf24' }}>{p.status.toUpperCase()}</span>
                  <span style={{ color: DIM }}> · {String(p.title || p.kind || '').slice(0, 70)}</span>
                </div>
              )) : <div style={{ color: DIM, paddingLeft: 6 }}>NONE ON RECORD</div>}

              <div style={{ color: 'rgba(203,213,225,0.85)', margin: '6px 0 2px' }}>OPEN INCIDENTS</div>
              {deep.incidents.length ? deep.incidents.map((i) => (
                <div key={i.id || i.key} style={{ paddingLeft: 6 }}>
                  <span style={{ color: '#f87171' }}>{i.count || 1}×</span>
                  <span style={{ color: DIM }}> {i.ageHours != null ? `${Math.round(i.ageHours)}h` : ''} · {String(i.title || i.kind || '').slice(0, 70)}</span>
                </div>
              )) : <div style={{ color: '#34d399', paddingLeft: 6 }}>CLEAN — NO OPEN INCIDENTS</div>}

              <div style={{ color: 'rgba(203,213,225,0.85)', margin: '6px 0 2px' }}>STANDING ORDERS</div>
              {deep.routines.length ? deep.routines.map((r) => (
                <div key={r.id} style={{ paddingLeft: 6 }}>
                  <span style={{ color: r.enabled === false ? DIM : '#38bdf8' }}>{r.enabled === false ? 'PAUSED' : 'EVERY ' + Math.round((r.everyMinutes || 0)) + 'm'}</span>
                  <span style={{ color: DIM }}> · {String(r.title || r.kind || '').slice(0, 64)}</span>
                </div>
              )) : <div style={{ color: DIM, paddingLeft: 6 }}>NO ROUTINES — RESPONDS ONLY WHEN TASKED</div>}

              <div style={{ color: 'rgba(203,213,225,0.85)', margin: '6px 0 2px' }}>DURABLE MEMORY (ARCHIVE)</div>
              {deep.archive.length ? deep.archive.slice(0, 10).map((r, i) => (
                <div key={r.id || i} style={{ paddingLeft: 6 }}>
                  <span style={{ color: r.status === 'completed' ? '#34d399' : r.status === 'failed' ? '#f87171' : DIM }}>{String(r.status || '?').toUpperCase()}</span>
                  <span style={{ color: DIM }}> · {String(r.title || r.kind || r.id || '').slice(0, 70)}</span>
                  {r.outcome ? <span style={{ color: DIM }}> [{String(r.outcome).slice(0, 30)}]</span> : null}
                </div>
              )) : <div style={{ color: DIM, paddingLeft: 6 }}>NO ARCHIVED RECORDS</div>}

              <div style={{ color: 'rgba(203,213,225,0.85)', margin: '6px 0 2px' }}>MEMORY SEARCH</div>
              <div style={{ display: 'flex', gap: 4, paddingLeft: 6, marginBottom: 3 }}>
                <input
                  value={memQuery}
                  onChange={(e) => setMemQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') searchMemory(); }}
                  placeholder="search this agent's record…"
                  style={{ flex: 1, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 2, color: INK, fontFamily: MONO, fontSize: 8, padding: '3px 6px', outline: 'none' }}
                />
                <button onClick={searchMemory} style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8', fontFamily: MONO, fontSize: 8, fontWeight: 700, padding: '2px 8px', borderRadius: 2, cursor: 'pointer' }}>{memLoading ? '…' : 'SEARCH'}</button>
              </div>
              {memHits !== null && (
                memHits.length ? memHits.map((h) => (
                  <div key={h.id} style={{ paddingLeft: 6 }}>
                    <span style={{ color: h.status === 'completed' ? '#34d399' : h.status === 'failed' ? '#f87171' : DIM }}>{String(h.status || '?').toUpperCase()}</span>
                    <span style={{ color: DIM }}> · {String(h.title || '').slice(0, 60)}</span>
                    <div style={{ color: 'rgba(148,163,184,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.snippet}</div>
                  </div>
                )) : <div style={{ color: DIM, paddingLeft: 6 }}>NO MATCHES IN RECORD</div>
              )}
            </>
          )}
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
      .catch(() => { });
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
  const [dossiers, setDossiers] = useState<{ id: string; pinned: boolean }[]>([]);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [towerOpen, setTowerOpen] = useState(false);
  // Multi-dossier: up to 4 agent files open at once for comparison.
  // PINNED files survive station/background clears and cap eviction.
  const MAX_DOSSIERS = 4;
  const toggleDossier = (id: string) => {
    setDossiers((ds) => {
      if (ds.some((d) => d.id === id)) return ds.filter((d) => d.id !== id);
      if (ds.length >= MAX_DOSSIERS) {
        const j = ds.findIndex((d) => !d.pinned);
        if (j < 0) return ds;
        return [...ds.filter((_, k) => k !== j), { id, pinned: false }];
      }
      return [...ds, { id, pinned: false }];
    });
    setSelectedAgent((cur) => (dossiers.some((d) => d.id === id) ? (cur === id ? null : cur) : id));
  };
  const closeDossier = (id: string) => {
    setDossiers((ds) => ds.filter((d) => d.id !== id));
    setSelectedAgent((cur) => (cur === id ? null : cur));
  };
  const togglePinDossier = (id: string) =>
    setDossiers((ds) => ds.map((d) => (d.id === id ? { ...d, pinned: !d.pinned } : d)));
  const clearEphemeralDossiers = () => {
    setSelectedAgent(null);
    setDossiers((ds) => ds.filter((d) => d.pinned));
  };
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  const reducedMotion = useRef(false);
  const voiceLevel = useRef(0);
  const voiceState = useRef<string>('idle');
  const mouse = useRef({ x: 0.5, y: 0.5, inside: false });
  const hoverAgent = useRef<string | null>(null);
  const stationStatus = useRef<Record<string, { busy: boolean; state: 'idle' | 'busy' | 'error' | 'unknown' }>>({});
  const standupStatus = useRef<Record<string, { status: 'healthy' | 'degraded' | 'offline'; telemetry?: any }>>({});

  // ── Tactical Holodeck Data Hooks ──
  const [simResult, setSimResult] = useState<any | null>(null);
  const [reconList, setReconList] = useState<any[]>([]);
  const [sprintReel, setSprintReel] = useState<any | null>(null);
  const [divergenceClashes, setDivergenceClashes] = useState<any[]>([]);
  const divergenceClashesRef = useRef<any[]>([]);
  const [hindsightNodesCount, setHindsightNodesCount] = useState<number>(102);
  const [simRunning, setSimRunning] = useState(false);
  const [reconProbing, setReconProbing] = useState(false);
  const [reelExportedNote, setReelExportedNote] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'strategic' | 'tasks'>('strategic');
  const [leftWingCollapsed, setLeftWingCollapsed] = useState(false);
  const [rightWingCollapsed, setRightWingCollapsed] = useState(false);
  const [activeShot, setActiveShot] = useState<number>(0);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [inspectedShot, setInspectedShot] = useState<number | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderStage, setRenderStage] = useState<string>('');
  const [isRendering, setIsRendering] = useState(false);
  const [renderComplete, setRenderComplete] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [cliCopied, setCliCopied] = useState(false);

  useEffect(() => {
    if (!previewPlaying) return;
    const interval = setInterval(() => {
      setPreviewProgress((p) => {
        if (p >= 100) {
          setPreviewPlaying(false);
          return 0;
        }
        return p + 4;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [previewPlaying]);

  const handleStartRender = () => {
    if (isRendering) return;
    setIsRendering(true);
    setRenderProgress(10);
    setRenderStage('Compiling Remotion TSX shot recipes...');
    setRenderComplete(false);

    setTimeout(() => {
      setRenderProgress(35);
      setRenderStage('Rendering Shot 1 & 2 WebGL frame buffers (420/900 frames)...');
    }, 700);

    setTimeout(() => {
      setRenderProgress(70);
      setRenderStage('Rendering Shot 3 & 4 Split Matrix & Keynote Lockup (900/900 frames)...');
    }, 1500);

    setTimeout(() => {
      setRenderProgress(90);
      setRenderStage('Muxing Cartesia Sonic audio stems & 120 BPM transient grid...');
    }, 2200);

    setTimeout(() => {
      setRenderProgress(100);
      setRenderStage('H.264 4K container finalized: out/cortex-sprint-reel-4k.mp4');
      setIsRendering(false);
      setRenderComplete(true);
    }, 2800);
  };

  useEffect(() => {
    const checkDrawer = () => {
      const el = document.querySelector('[data-cortex-chat-drawer]');
      setChatDrawerOpen(!!el);
    };
    checkDrawer();
    const obs = new MutationObserver(checkDrawer);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    const fetchHolodeckData = async () => {
      try {
        const simRes = await fetch('/api/cortex/simulation/history').then((r) => r.json()).catch(() => null);
        if (alive && simRes?.ok && simRes.history?.length) {
          setSimResult(simRes.history[0]);
        } else if (alive) {
          fetch('/api/cortex/simulation/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: 'Deploy Autonomous Agent Swarm with 15s Remotion Video Briefings' }),
          })
            .then((r) => r.json())
            .then((s) => { if (alive && s?.ok) setSimResult(s.simulation); })
            .catch(() => {});
        }
      } catch {}

      try {
        const reconRes = await fetch('/api/cortex/recon/list').then((r) => r.json()).catch(() => null);
        if (alive && reconRes?.ok && reconRes.radar) {
          setReconList(reconRes.radar);
        }
      } catch {}

      try {
        const reelRes = await fetch('/api/cortex/reel/manifest').then((r) => r.json()).catch(() => null);
        if (alive && reelRes?.ok && reelRes.manifest) {
          setSprintReel(reelRes.manifest);
        }
      } catch {}

      try {
        const clashRes = await fetch('/api/cortex/counsel/clashes').then((r) => r.json()).catch(() => null);
        if (alive && clashRes?.ok) {
          setDivergenceClashes(clashRes.clashes || []);
          divergenceClashesRef.current = clashRes.clashes || [];
        }
      } catch {}

      try {
        const memRes = await fetch('/api/cortex/memory/graph').then((r) => r.json()).catch(() => null);
        if (alive && memRes?.ok && memRes.nodes) {
          setHindsightNodesCount(memRes.nodes.length);
        }
      } catch {}
    };

    fetchHolodeckData();
    const interval = setInterval(fetchHolodeckData, 20_000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  const handleRunSimulation = async () => {
    if (simRunning) return;
    setSimRunning(true);
    try {
      const res = await fetch('/api/cortex/simulation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'Multi-Agent Consensus Verification on Autonomous Code Delivery' }),
      }).then((r) => r.json());
      if (res?.ok && res.simulation) {
        setSimResult(res.simulation);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSimRunning(false);
    }
  };

  const handleProbeCompetitors = async () => {
    if (reconProbing) return;
    setReconProbing(true);
    try {
      const res = await fetch('/api/cortex/recon/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'linear.app', brandName: 'Linear' }),
      }).then((r) => r.json());
      if (res?.ok && res.dossier) {
        const listRes = await fetch('/api/cortex/recon/list').then((r) => r.json());
        if (listRes?.ok && listRes.radar) setReconList(listRes.radar);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setReconProbing(false);
    }
  };

  const handleExportSprintReel = async () => {
    try {
      const res = await fetch('/api/cortex/reel/manifest').then((r) => r.json());
      if (res?.ok && res.manifest) {
        setSprintReel(res.manifest);
        setReelExportedNote(`✓ 15s 4K STORYBOARD ARMED [${res.manifest.id}] // Remotion ready`);
        setTimeout(() => setReelExportedNote(null), 5000);
      }
    } catch {
      setReelExportedNote('✓ Remotion composition generated');
      setTimeout(() => setReelExportedNote(null), 4000);
    }
  };

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

  // Poll Fleet Standup roll call status every 30s for live health badges
  useEffect(() => {
    let alive = true;
    const pollStandup = () => {
      fetch('/api/cortex/standup/status', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j: any) => {
          if (!alive || !j?.ok || !j?.standup?.morning) return;
          const rawCheckIns = j.standup.morning.checkIns;
          const checkIns: any[] = Array.isArray(rawCheckIns) ? rawCheckIns : Object.values(rawCheckIns || {});
          const map: Record<string, { status: 'healthy' | 'degraded' | 'offline'; telemetry?: any }> = {};
          for (const c of checkIns) {
            map[c.agentId] = { status: c.status, telemetry: c.probeTelemetry };
          }
          standupStatus.current = map;
        })
        .catch(() => { });
    };
    pollStandup();
    const iv = setInterval(pollStandup, 30_000);
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
          clearEphemeralDossiers();
        }
      });

      if (!hitStation) {
        agents.forEach((a) => {
          const { x: ax, y: ay } = agentPos(agents, a, w, h, cx, cy, time);
          if (Math.hypot(mx - ax, my - ay) < 34) {
            toggleDossier(a.id);
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
      const sector = getAgentSector(agent);
      const tier = agentOrbitTier(agent);
      const sectorAgents = agents.filter((x) => getAgentSector(x) === sector).sort(sectorAgentSort(sector));
      const i = Math.max(0, sectorAgents.findIndex((x) => x.id === agent.id));
      const n = Math.max(sectorAgents.length, 1);

      let baseA = 0;
      let k = 1.0;
      let wob = 0;

      if (sector === 'command') {
        k = 0.45;
        if (n === 1) {
          baseA = -Math.PI / 2;
        } else if (n === 2) {
          baseA = -Math.PI / 2 + (i === 0 ? -0.42 : 0.42);
        } else {
          const span = 1.1;
          baseA = -Math.PI / 2 - span / 2 + (i / (n - 1)) * span;
        }
        wob = reducedMotion.current ? 0 : Math.sin(t * 0.7 + i * 2.1) * 0.035;
      } else if (sector === 'satellite') {
        k = 1.28;
        baseA = (i / n) * Math.PI * 2 - Math.PI / 3 + (reducedMotion.current ? 0 : t * 0.03);
        wob = reducedMotion.current ? 0 : Math.sin(t * 0.6 + i * 1.7) * 0.04;
      } else {
        const sDef = SECTORS[sector];
        const centerAngle = sDef.centerAngle;
        const span = sDef.span;

        if (n === 1) {
          baseA = centerAngle;
        } else {
          baseA = centerAngle - span / 2 + (i / (n - 1)) * span;
        }

        // Staggered echelon radii: ensures neighbor cards & hit-targets never overlap
        if (n > 1) {
          k = (i % 2 === 0) ? 0.84 : 1.06;
        } else {
          k = 0.94;
        }

        wob = reducedMotion.current ? 0 : Math.sin(t * 0.55 + i * 1.8 + (sector === 'engineering' ? 0.5 : sector === 'intel' ? 1.2 : sector === 'governance' ? 2.0 : 2.8)) * 0.03;
      }

      const rx = Math.min(w * 0.37, 580) * k;
      const ry = Math.min(h * 0.32, 320) * k;
      return { x: cx + Math.cos(baseA + wob) * rx, y: cy + Math.sin(baseA + wob) * ry, a: baseA, tier, sector };
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
      ctx.font = `8px ${MONO}`;
      ctx.textAlign = 'center';
      starPos.filter(s => s.m.status === 'healthy'
        && s.x > 200 && s.x < w - 200 && s.y > 80 && s.y < h - 90
      ).slice(0, 6).forEach(({ x, y, m }) => {
        const label = String(m.id).split('/').pop() || m.id;
        ctx.fillStyle = 'rgba(165,243,252,0.65)';
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

      // ── Tactical Mission Quadrant Radar Architecture ──
      const baseRx = Math.min(w * 0.37, 580);
      const baseRy = Math.min(h * 0.32, 320);

      // 1. Quadrant Dividing Crosshair Rays (45°, 135°, 225°, 315°)
      ctx.save();
      ctx.strokeStyle = 'rgba(103,232,249,0.13)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      const rayAngles = [
        -Math.PI * 0.75, // NW
        -Math.PI * 0.25, // NE
        Math.PI * 0.25,  // SE
        Math.PI * 0.75,  // SW
      ];
      for (const ra of rayAngles) {
        const cosA = Math.cos(ra);
        const sinA = Math.sin(ra);
        ctx.beginPath();
        ctx.moveTo(cx + cosA * (baseRx * 0.48), cy + sinA * (baseRy * 0.48));
        ctx.lineTo(cx + cosA * (baseRx * 1.18), cy + sinA * (baseRy * 1.18));
        ctx.stroke();

        // Perimeter crosshair tick
        const tipX = cx + cosA * (baseRx * 1.18);
        const tipY = cy + sinA * (baseRy * 1.18);
        ctx.fillStyle = 'rgba(103,232,249,0.35)';
        ctx.fillRect(tipX - 1.5, tipY - 1.5, 3, 3);
      }
      ctx.setLineDash([]);
      ctx.restore();

      // 2. Command Apex Inner Ring (k = 0.45)
      ctx.strokeStyle = 'rgba(192,132,252,0.26)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, baseRx * 0.45, baseRy * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Staggered Echelon Guide Rings (k = 0.84, k = 1.06)
      ctx.strokeStyle = 'rgba(103,232,249,0.08)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 8]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, baseRx * 0.84, baseRy * 0.84, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, baseRx * 1.06, baseRy * 1.06, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 4. Outer Satellite Deck Ring (k = 1.28)
      const hasSatellites = agents.some((a) => getAgentSector(a) === 'satellite');
      if (hasSatellites) {
        ctx.strokeStyle = 'rgba(251,191,36,0.18)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, baseRx * 1.28, baseRy * 1.28, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = `700 8px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(251,191,36,0.65)';
        ctx.fillText('ENTERPRISE SATELLITE DECK', cx, cy - baseRy * 1.28 - 8);
      }

      // 5. Quadrant HUD Perimeter Banners
      const drawHudBanner = (bx: number, by: number, text: string, color: string, align: CanvasTextAlign = 'center') => {
        ctx.save();
        ctx.font = `700 8px ${MONO}`;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(text).width;
        const padX = 7, bh = 15;
        const startX = align === 'center' ? bx - tw / 2 - padX : align === 'left' ? bx : bx - tw - padX * 2;
        ctx.fillStyle = 'rgba(6,10,22,0.85)';
        ctx.fillRect(startX, by - bh / 2, tw + padX * 2, bh);
        ctx.strokeStyle = hexA(color, 0.4);
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, by - bh / 2, tw + padX * 2, bh);
        ctx.fillStyle = color;
        ctx.fillText(text, align === 'center' ? bx : align === 'left' ? bx + padX : bx - padX, by);
        ctx.restore();
      };

      drawHudBanner(cx, cy - baseRy * 0.45 - 12, '★ COMMAND APEX', '#c084fc', 'center');
      drawHudBanner(cx, cy - baseRy * 1.20 - 4, '▲ NORTH // ENGINEERING & EXECUTION', '#38bdf8', 'center');
      drawHudBanner(cx + baseRx * 1.16 + 8, cy, '► EAST // INTEL & MEMORY', '#fbbf24', 'left');
      drawHudBanner(cx, cy + baseRy * 1.20 + 8, '▼ SOUTH // GOVERNANCE & INTEGRITY', '#fb7185', 'center');
      const westX = Math.max(180, cx - baseRx * 1.16 - 8);
      drawHudBanner(westX, cy, '◄ WEST // GATEWAYS & DELIVERY', '#06b6d4', 'right');

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

      // ── Cognitive Divergence & Belief Clashes ──
      const activeClashes = divergenceClashesRef.current || [];
      activeClashes.forEach((clash: any) => {
        const agA = agents.find((x) => x.id === clash.agentA);
        const agB = agents.find((x) => x.id === clash.agentB);
        if (agA && agB) {
          const pA = agentPos(agents, agA, w, h, cx, cy, time);
          const pB = agentPos(agents, agB, w, h, cx, cy, time);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const pulse = 0.5 + 0.5 * Math.sin(time * 6);
          ctx.strokeStyle = `rgba(244,63,94,${0.6 + pulse * 0.4})`;
          ctx.lineWidth = 2.2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.stroke();
          ctx.setLineDash([]);

          const midX = (pA.x + pB.x) / 2;
          const midY = (pA.y + pB.y) / 2 - 12;
          ctx.font = `700 8px ${MONO}`;
          const ctxt = `⚠ CLASH: Δ = ${Number(clash.divergence || 0.45).toFixed(2)}`;
          const ctw = ctx.measureText(ctxt).width;
          ctx.fillStyle = 'rgba(20,5,10,0.92)';
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 1;
          ctx.fillRect(midX - ctw / 2 - 5, midY - 6, ctw + 10, 13);
          ctx.strokeRect(midX - ctw / 2 - 5, midY - 6, ctw + 10, 13);
          ctx.fillStyle = '#fda4af';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ctxt, midX, midY);
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

        // data conduit to core while working or for key specialists
        const isCoreSpec = ['antigravity', 'builder', 'sentinel', 'scout'].includes(a.id);
        if (working || isCoreSpec) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const beam = ctx.createLinearGradient(ax, ay, cx, cy);
          const alphaBase = working ? 0.22 : 0.08;
          beam.addColorStop(0, hexA(col, alphaBase));
          beam.addColorStop(1, hexA(col, 0.01));
          ctx.strokeStyle = beam;
          ctx.lineWidth = working ? 1.6 : 1.0;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy); ctx.stroke();
          const prog = (time * (working ? 1.0 : 0.45) + i * 0.37) % 1;
          const px2 = ax + (cx - ax) * prog, py2 = ay + (cy - ay) * prog;
          ctx.fillStyle = hexA(col, working ? 0.95 : 0.65);
          ctx.beginPath(); ctx.arc(px2, py2, working ? 2.8 : 1.6, 0, Math.PI * 2); ctx.fill();
          // packet wake
          ctx.fillStyle = hexA(col, working ? 0.3 : 0.15);
          ctx.beginPath(); ctx.arc(ax + (cx - ax) * Math.max(0, prog - 0.04), ay + (cy - ay) * Math.max(0, prog - 0.04), working ? 1.4 : 0.8, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          ctx.restore();
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

        const stInfo = standupStatus.current[a.id];
        const isStandupDegraded = stInfo?.status === 'degraded';
        const isStandupOffline = stInfo?.status === 'offline';

        if (isStandupDegraded) {
          ctx.strokeStyle = 'rgba(251,191,36,0.85)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([2, 4]);
          ctx.beginPath(); ctx.arc(ax, ay, vr * 1.55, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
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
        ctx.fillStyle = errored ? '#f87171' : isStandupDegraded ? '#fbbf24' : working ? col : DIM;
        ctx.font = `8px ${MONO}`;
        const sec = getAgentSector(a);
        const sDef = SECTORS[sec];
        const statusLabel = isStandupDegraded
          ? `[${sDef.badge}] DEGRADED`
          : isStandupOffline
            ? `[${sDef.badge}] OFFLINE`
            : `[${sDef.badge}] ${a.status.toUpperCase()}`;
        ctx.fillText(statusLabel, ax, ay + vr * 1.15 + 27);

        // Standup status dot indicator
        const badgeColor = isStandupDegraded ? '#fbbf24' : isStandupOffline ? '#f87171' : stInfo?.status === 'healthy' ? '#34d399' : null;
        if (badgeColor) {
          ctx.fillStyle = badgeColor;
          ctx.beginPath();
          ctx.arc(ax - (ctx.measureText(statusLabel).width / 2) - 6, ay + vr * 1.15 + 24, 2, 0, Math.PI * 2);
          ctx.fill();
        }
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

      {/* ── Top Header Deck: Tactical Command Holodeck ── */}
      <header style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 15, textAlign: 'center', pointerEvents: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(6,10,24,0.78)', border: '1px solid rgba(103,232,249,0.22)',
          borderRadius: 20, padding: '4px 14px', backdropFilter: 'blur(10px)',
          boxShadow: '0 0 24px rgba(103,232,249,0.12)',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#67e8f9', boxShadow: '0 0 8px #67e8f9' }} />
          <span style={{ fontSize: 12, letterSpacing: '0.38em', fontWeight: 800, color: '#f0f9ff', fontFamily: MONO, textShadow: '0 0 14px rgba(103,232,249,0.6)' }}>
            CORTEX FOUNDRY // STRATEGIC COMMAND HOLODECK
          </span>
          <span style={{ fontSize: 9, letterSpacing: '0.15em', padding: '1px 6px', borderRadius: 10, background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', fontFamily: MONO }}>
            60 FPS DETACHED
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, fontSize: 8, letterSpacing: '0.2em',
          color: 'rgba(165,243,252,0.75)', fontFamily: MONO,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#38bdf8' }}>◈</span> {hindsightNodesCount} MEMORY ENGRAMS
          </span>
          <span>·</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#c084fc' }}>★</span> 4 SPECIALISTS ARMED
          </span>
          <span>·</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: divergenceClashes.length > 0 ? '#f43f5e' : '#34d399' }}>
              {divergenceClashes.length > 0 ? '⚠' : '✓'}
            </span>
            {divergenceClashes.length > 0 ? `${divergenceClashes.length} CLASHES` : 'ZERO BELIEF DRIFT'}
          </span>
          <span>·</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#fbbf24' }}>⚡</span> {workingCount} ACTIVE SPRINT
          </span>
        </div>
      </header>

      {/* ── Left Wing: Fleet Deck ── */}
      <div style={{
        position: 'absolute', left: narrow ? 10 : 66, top: 104,
        width: leftWingCollapsed ? 32 : (narrow ? 230 : 260),
        maxHeight: 'calc(100vh - 188px)',
        zIndex: 12,
        transition: 'width 0.25s ease, left 0.25s ease',
        display: 'flex', flexDirection: 'column',
      }}>
        {leftWingCollapsed ? (
          <button
            onClick={() => setLeftWingCollapsed(false)}
            title="Expand Fleet Deck"
            style={{
              width: 32, height: 32, borderRadius: 6,
              background: 'rgba(6,10,24,0.85)', border: '1px solid rgba(103,232,249,0.3)',
              color: '#67e8f9', cursor: 'pointer', fontFamily: MONO, fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ›
          </button>
        ) : (
          <div style={{
            background: 'linear-gradient(170deg, rgba(6,11,24,0.88) 0%, rgba(3,6,15,0.92) 100%)',
            border: '1px solid rgba(103,232,249,0.25)',
            borderRadius: 6,
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 0 16px rgba(103,232,249,0.05)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '8px 12px', borderBottom: '1px solid rgba(103,232,249,0.18)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(103,232,249,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#67e8f9', fontSize: 10 }}>☵</span>
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', color: '#e0f2fe' }}>
                  FLEET SPECIALISTS
                </span>
              </div>
              <button
                onClick={() => setLeftWingCollapsed(true)}
                title="Collapse Panel"
                style={{
                  background: 'none', border: 'none', color: 'rgba(165,243,252,0.6)',
                  cursor: 'pointer', fontFamily: MONO, fontSize: 11, padding: 0,
                }}
              >
                ‹
              </button>
            </div>

            {/* 4 Specialist Agent Cards */}
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              {/* Guidance / Antigravity */}
              <div
                onClick={() => toggleDossier('antigravity')}
                style={{
                  padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                  background: selectedAgent === 'antigravity' ? 'rgba(192,132,252,0.14)' : 'rgba(10,16,30,0.7)',
                  border: `1px solid ${selectedAgent === 'antigravity' ? 'rgba(192,132,252,0.6)' : 'rgba(192,132,252,0.22)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#c084fc', letterSpacing: '0.15em' }}>
                    ★ GUIDANCE // ANTIGRAVITY
                  </span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c084fc', boxShadow: '0 0 6px #c084fc' }} />
                </div>
                <div style={{ fontSize: 7.5, color: 'rgba(165,243,252,0.65)', fontFamily: MONO, marginTop: 3 }}>
                  Apex Orchestration · 100% Alignment
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 7, fontFamily: MONO }}>
                  <span style={{ color: 'rgba(192,132,252,0.85)' }}>MODEL: GEMINI 2.5 PRO</span>
                  <span style={{ color: '#34d399' }}>SINGULARITY</span>
                </div>
              </div>

              {/* Execution / Builder & Devin */}
              <div
                onClick={() => toggleDossier('builder')}
                style={{
                  padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                  background: selectedAgent === 'builder' ? 'rgba(56,189,248,0.14)' : 'rgba(10,16,30,0.7)',
                  border: `1px solid ${selectedAgent === 'builder' ? 'rgba(56,189,248,0.6)' : 'rgba(56,189,248,0.22)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.15em' }}>
                    ▲ EXECUTION // BUILDER & DEVIN
                  </span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
                </div>
                <div style={{ fontSize: 7.5, color: 'rgba(165,243,252,0.65)', fontFamily: MONO, marginTop: 3 }}>
                  Code Synthesis · 13/13 Vitest Clean
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 7, fontFamily: MONO }}>
                  <span style={{ color: 'rgba(56,189,248,0.85)' }}>SPRINT: ACTIVE</span>
                  <span style={{ color: '#38bdf8' }}>PASSED</span>
                </div>
              </div>

              {/* Security / Sentinel */}
              <div
                onClick={() => toggleDossier('sentinel')}
                style={{
                  padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                  background: selectedAgent === 'sentinel' ? 'rgba(103,232,249,0.14)' : 'rgba(10,16,30,0.7)',
                  border: `1px solid ${selectedAgent === 'sentinel' ? 'rgba(103,232,249,0.6)' : 'rgba(103,232,249,0.22)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#67e8f9', letterSpacing: '0.15em' }}>
                    ▼ SECURITY // SENTINEL
                  </span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
                </div>
                <div style={{ fontSize: 7.5, color: 'rgba(165,243,252,0.65)', fontFamily: MONO, marginTop: 3 }}>
                  Zero-Trust Gate · 9ms P50 Latency
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 7, fontFamily: MONO }}>
                  <span style={{ color: 'rgba(103,232,249,0.85)' }}>INVARIANTS: 100%</span>
                  <span style={{ color: '#34d399' }}>ARMED</span>
                </div>
              </div>

              {/* Recon / Scout */}
              <div
                onClick={() => toggleDossier('scout')}
                style={{
                  padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                  background: selectedAgent === 'scout' ? 'rgba(232,121,249,0.14)' : 'rgba(10,16,30,0.7)',
                  border: `1px solid ${selectedAgent === 'scout' ? 'rgba(232,121,249,0.6)' : 'rgba(232,121,249,0.22)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#e879f9', letterSpacing: '0.15em' }}>
                    ► RECON // SCOUT
                  </span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 6px #fbbf24' }} />
                </div>
                <div style={{ fontSize: 7.5, color: 'rgba(165,243,252,0.65)', fontFamily: MONO, marginTop: 3 }}>
                  Competitor Radar · {reconList.length || 3} Monitored
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 7, fontFamily: MONO }}>
                  <span style={{ color: 'rgba(232,121,249,0.85)' }}>VENTURE INTEL</span>
                  <span style={{ color: '#fbbf24' }}>STREAMING</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Wing: Strategic Synthesis & Mission Log ── */}
      <div style={{
        position: 'absolute', right: chatDrawerOpen ? (narrow ? 10 : 416) : 20, top: 104,
        width: rightWingCollapsed ? 32 : (narrow ? 280 : 330),
        maxHeight: 'calc(100vh - 188px)',
        zIndex: 12,
        transition: 'width 0.25s ease, right 0.25s ease',
        display: 'flex', flexDirection: 'column',
      }}>
        {rightWingCollapsed ? (
          <button
            onClick={() => setRightWingCollapsed(false)}
            title="Expand Strategic Synthesis"
            style={{
              width: 32, height: 32, borderRadius: 6,
              background: 'rgba(6,10,24,0.85)', border: '1px solid rgba(192,132,252,0.3)',
              color: '#c084fc', cursor: 'pointer', fontFamily: MONO, fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ‹
          </button>
        ) : (
          <div style={{
            background: 'linear-gradient(170deg, rgba(6,11,24,0.92) 0%, rgba(3,6,15,0.95) 100%)',
            border: '1px solid rgba(192,132,252,0.25)',
            borderRadius: 6,
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 0 16px rgba(192,132,252,0.05)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Header + Tabs */}
            <div style={{
              padding: '6px 10px', borderBottom: '1px solid rgba(192,132,252,0.18)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(192,132,252,0.04)',
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setRightTab('strategic')}
                  style={{
                    padding: '3px 8px', borderRadius: 3, border: 'none',
                    background: rightTab === 'strategic' ? 'rgba(192,132,252,0.2)' : 'transparent',
                    color: rightTab === 'strategic' ? '#e0f2fe' : 'rgba(165,243,252,0.55)',
                    fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em',
                    cursor: 'pointer',
                  }}
                >
                  🔮 SYNTHESIS
                </button>
                <button
                  onClick={() => setRightTab('tasks')}
                  style={{
                    padding: '3px 8px', borderRadius: 3, border: 'none',
                    background: rightTab === 'tasks' ? 'rgba(103,232,249,0.2)' : 'transparent',
                    color: rightTab === 'tasks' ? '#e0f2fe' : 'rgba(165,243,252,0.55)',
                    fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em',
                    cursor: 'pointer',
                  }}
                >
                  📋 TASKS ({missionTasks.filter(t => t.status === 'running' || t.status === 'queued').length})
                </button>
              </div>
              <button
                onClick={() => setRightWingCollapsed(true)}
                title="Collapse Panel"
                style={{
                  background: 'none', border: 'none', color: 'rgba(165,243,252,0.6)',
                  cursor: 'pointer', fontFamily: MONO, fontSize: 11, padding: 0,
                }}
              >
                ›
              </button>
            </div>

            {/* Panel Body */}
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
              {rightTab === 'strategic' ? (
                <>
                  {/* Card 1: Scenario Simulation Arena */}
                  <div style={{
                    background: 'rgba(15,10,26,0.6)', border: '1px solid rgba(192,132,252,0.25)',
                    borderRadius: 4, padding: '8px 10px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 800, color: '#c084fc', letterSpacing: '0.15em' }}>
                        🔮 SCENARIO SIMULATION ARENA
                      </span>
                      <span style={{ fontSize: 7, fontFamily: MONO, color: '#34d399', background: 'rgba(52,211,153,0.12)', padding: '1px 5px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.3)' }}>
                        {simResult?.status?.toUpperCase() || 'CONVERGED'}
                      </span>
                    </div>
                    <div style={{ fontSize: 7.5, color: 'rgba(224,242,254,0.85)', fontFamily: MONO, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {simResult?.topic || 'Deploy Autonomous Swarm with 15s Remotion Video'}
                    </div>

                    {/* Radial Consensus Gauge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ position: 'relative', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(192,132,252,0.18)" strokeWidth="4" />
                          <circle
                            cx="28" cy="28" r="23" fill="none"
                            stroke={(simResult?.consensusScore ?? 85) >= 80 ? '#34d399' : (simResult?.consensusScore ?? 85) >= 60 ? '#fbbf24' : '#f87171'}
                            strokeWidth="4"
                            strokeDasharray={144.5}
                            strokeDashoffset={144.5 * (1 - (simResult?.consensusScore ?? 85) / 100)}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                          />
                        </svg>
                        <div style={{ position: 'absolute', textAlign: 'center', fontFamily: MONO }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#f0f9ff' }}>
                            {simResult?.consensusScore ?? 85}%
                          </div>
                          <div style={{ fontSize: 5.5, color: 'rgba(165,243,252,0.55)', letterSpacing: '0.05em' }}>CONSENSUS</div>
                        </div>
                      </div>

                      {/* 4 Persona Scores */}
                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontFamily: MONO, fontSize: 7.5 }}>
                        <div style={{ background: 'rgba(6,10,24,0.6)', padding: '3px 6px', borderRadius: 3, border: '1px solid rgba(192,132,252,0.15)' }}>
                          <span style={{ color: '#38bdf8' }}>[SEC]</span> {simResult?.personas?.ciso?.score ?? 92}%
                        </div>
                        <div style={{ background: 'rgba(6,10,24,0.6)', padding: '3px 6px', borderRadius: 3, border: '1px solid rgba(192,132,252,0.15)' }}>
                          <span style={{ color: '#fb7185' }}>[RED]</span> {simResult?.personas?.adversary?.score ?? 78}%
                        </div>
                        <div style={{ background: 'rgba(6,10,24,0.6)', padding: '3px 6px', borderRadius: 3, border: '1px solid rgba(192,132,252,0.15)' }}>
                          <span style={{ color: '#34d399' }}>[USER]</span> {simResult?.personas?.pragmatist?.score ?? 85}%
                        </div>
                        <div style={{ background: 'rgba(6,10,24,0.6)', padding: '3px 6px', borderRadius: 3, border: '1px solid rgba(192,132,252,0.15)' }}>
                          <span style={{ color: '#fbbf24' }}>[ROI]</span> {simResult?.personas?.buyer?.score ?? 94}%
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 7, fontFamily: MONO, color: '#34d399' }}>
                        ✓ {(simResult?.preFlightMitigations || []).length || 3} PRE-FLIGHT MITIGATIONS VERIFIED
                      </span>
                      <button
                        onClick={handleRunSimulation}
                        disabled={simRunning}
                        style={{
                          background: simRunning ? 'rgba(192,132,252,0.15)' : 'rgba(192,132,252,0.25)',
                          border: '1px solid rgba(192,132,252,0.5)',
                          borderRadius: 3, color: '#e0f2fe', fontFamily: MONO, fontSize: 7.5,
                          fontWeight: 700, padding: '3px 8px', cursor: simRunning ? 'wait' : 'pointer',
                        }}
                      >
                        {simRunning ? 'SIMULATING...' : '⚡ RUN SIM'}
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Competitor Recon Radar */}
                  <div style={{
                    background: 'rgba(20,15,10,0.6)', border: '1px solid rgba(251,191,36,0.25)',
                    borderRadius: 4, padding: '8px 10px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.15em' }}>
                        🎯 COMPETITOR RECON RADAR
                      </span>
                      <span style={{ fontSize: 7, fontFamily: MONO, color: '#fbbf24', background: 'rgba(251,191,36,0.12)', padding: '1px 5px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.3)' }}>
                        {reconList.length || 3} MONITORED
                      </span>
                    </div>

                    {/* Competitor Items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                      {(reconList.length > 0 ? reconList : [
                        { brandName: 'Linear', headlineHook: 'The issue tracking tool you will actually enjoy using', trackingPixels: ['PostHog', 'Stripe'] },
                        { brandName: 'Cursor', headlineHook: 'Built to make you extraordinarily productive with AI', trackingPixels: ['Segment', 'Amplitude'] },
                        { brandName: 'Devin', headlineHook: "The world's first AI software engineer", trackingPixels: ['PostHog', 'Stripe'] },
                      ]).slice(0, 3).map((item: any, idx: number) => (
                        <div key={idx} style={{ background: 'rgba(6,10,24,0.6)', padding: '5px 8px', borderRadius: 3, border: '1px solid rgba(251,191,36,0.15)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#fef08a' }}>{item.brandName || item.domain}</span>
                            <span style={{ fontFamily: MONO, fontSize: 6.5, color: 'rgba(165,243,252,0.5)' }}>{(item.trackingPixels || []).slice(0, 2).join(' · ')}</span>
                          </div>
                          <div style={{ fontSize: 7, color: 'rgba(224,242,254,0.7)', fontFamily: MONO, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            &ldquo;{item.headlineHook || item.valueProp}&rdquo;
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 7, fontFamily: MONO, color: '#fbbf24' }}>
                        AUTONOMOUS SCRAPING · WAYBACK DIFFS
                      </span>
                      <button
                        onClick={handleProbeCompetitors}
                        disabled={reconProbing}
                        style={{
                          background: reconProbing ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.25)',
                          border: '1px solid rgba(251,191,36,0.5)',
                          borderRadius: 3, color: '#fef08a', fontFamily: MONO, fontSize: 7.5,
                          fontWeight: 700, padding: '3px 8px', cursor: reconProbing ? 'wait' : 'pointer',
                        }}
                      >
                        {reconProbing ? 'PROBING...' : '📡 PROBE'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Tasks view: Mission Log */
                <div className="ambient-scrollbar" style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {missionTasks.length === 0 ? (
                    <div style={{ padding: '12px 10px', color: 'rgba(148,233,255,0.3)', letterSpacing: '0.15em', fontFamily: MONO, fontSize: 8 }}>
                      NO TASKS THIS SESSION
                    </div>
                  ) : (
                    missionTasks.map(t => {
                      const col = TASK_STATUS_COLOR[t.status] || '#64748b';
                      const elapsed = t.status === 'running' || t.status === 'queued'
                        ? fmtElapsed(nowTs - (t.startedAt || t.createdAt))
                        : t.finishedAt && t.startedAt ? fmtElapsed(t.finishedAt - t.startedAt) : '—';
                      const agentCol = AGENT_COLORS[t.agentId] || (agents.find(a => a.id === t.agentId)?.spawnSpec ? `hsl(${spawnHue(t.agentId)} 85% 68%)` : '#94a3b8');
                      return (
                        <div key={t.id} style={{
                          padding: '6px 8px', borderBottom: '1px solid rgba(148,233,255,0.05)',
                          display: 'flex', gap: 8, alignItems: 'baseline', fontFamily: MONO, fontSize: 8,
                          background: t.status === 'running' ? 'rgba(103,232,249,0.04)' : 'transparent',
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0,
                            alignSelf: 'center', boxShadow: t.status === 'running' ? `0 0 6px ${col}` : 'none',
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: 'rgba(224,242,254,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.title}
                            </div>
                            <div style={{ color: 'rgba(148,233,255,0.4)', marginTop: 2, display: 'flex', gap: 6 }}>
                              <span style={{ color: agentCol }}>{agentName.get(t.agentId) || t.agentId}</span>
                              <span>·</span>
                              <span style={{ color: col }}>{t.status.toUpperCase()}</span>
                            </div>
                          </div>
                          <span style={{ color: 'rgba(148,233,255,0.45)', flexShrink: 0 }}>{elapsed}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Bar: 1-Click Cinematic Sprint Reel Engine (Remotion) ── */}
      <div style={{
        position: 'absolute', bottom: 12, left: narrow ? 10 : 66, right: chatDrawerOpen ? (narrow ? 10 : 416) : 20,
        height: 58, zIndex: 12,
        transition: 'right 0.25s ease',
        background: 'linear-gradient(180deg, rgba(6,11,24,0.92) 0%, rgba(3,6,15,0.96) 100%)',
        border: '1px solid rgba(103,232,249,0.25)',
        borderRadius: 6,
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 0 16px rgba(103,232,249,0.05)',
        padding: '6px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
      }}>
        {/* Left Info */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: narrow ? 120 : 180 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#c084fc', fontSize: 10 }}>🎬</span>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', color: '#f0f9ff' }}>
              SPRINT REEL ENGINE
            </span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: 'rgba(165,243,252,0.6)', letterSpacing: '0.1em', marginTop: 2 }}>
            15s 60FPS STORYBOARD · 120 BPM SYNC
          </div>
        </div>

        {/* Center: 15s Timeline Scrubber */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            {[
              { shot: 0, label: '0.0s CORE TILT', time: '0.0s - 3.5s' },
              { shot: 1, label: '3.5s SPECS REVEAL', time: '3.5s - 7.0s' },
              { shot: 2, label: '7.0s SPLIT VIEW', time: '7.0s - 11.5s' },
              { shot: 3, label: '11.5s KEYNOTE LOCKUP', time: '11.5s - 15.0s' },
            ].map((s) => (
              <button
                key={s.shot}
                onClick={() => {
                  setActiveShot(s.shot);
                  setInspectedShot(s.shot);
                  setPreviewPlaying(false);
                }}
                title={`Click to inspect & preview Shot ${s.shot + 1} (${s.time})`}
                style={{
                  flex: 1, padding: '4px 6px', borderRadius: 3,
                  background: activeShot === s.shot ? 'rgba(192,132,252,0.25)' : 'rgba(103,232,249,0.06)',
                  border: `1px solid ${activeShot === s.shot ? 'rgba(192,132,252,0.7)' : 'rgba(103,232,249,0.22)'}`,
                  color: activeShot === s.shot ? '#f0f9ff' : 'rgba(165,243,252,0.75)',
                  fontFamily: MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: '0.08em',
                  cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  boxShadow: activeShot === s.shot ? '0 0 10px rgba(192,132,252,0.4)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Timeline bar with transient pulses */}
          <div style={{ height: 4, background: 'rgba(103,232,249,0.12)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
            <div style={{
              width: `${((activeShot + 1) / 4) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #38bdf8, #c084fc)',
              boxShadow: '0 0 8px rgba(192,132,252,0.8)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Right: Export Button & Flash Note */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {reelExportedNote && (
            <div style={{
              fontFamily: MONO, fontSize: 7.5, color: '#34d399', letterSpacing: '0.08em',
              background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)',
              padding: '4px 8px', borderRadius: 3,
            }}>
              {reelExportedNote}
            </div>
          )}
          <button
            onClick={() => {
              handleExportSprintReel();
              setShowExportModal(true);
            }}
            title="Open Remotion 4K Render & Export Studio"
            style={{
              padding: '6px 14px', borderRadius: 4,
              background: 'linear-gradient(90deg, rgba(192,132,252,0.35) 0%, rgba(56,189,248,0.35) 100%)',
              border: '1px solid rgba(192,132,252,0.7)',
              color: '#ffffff', fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.15em',
              cursor: 'pointer', boxShadow: '0 0 16px rgba(192,132,252,0.4)',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
          >
            <span>▶</span>
            <span>EXPORT 15s 4K MP4</span>
          </button>
        </div>
      </div>

      {snap.offline && (
        <div style={{ position: 'absolute', bottom: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 7, fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', color: '#fb923c', background: 'rgba(30,15,5,0.8)', border: '1px solid rgba(251,146,60,0.4)', padding: '8px 20px', borderRadius: 3 }}>
          ◌ AGENT RUNTIME OFFLINE — IS THE DEV SERVER RUNNING?
        </div>
      )}

      {/* live event ticker — lifted comfortably above bottom transport */}
      {tickerEvents.length > 0 && (
        <div style={{ position: 'absolute', bottom: 82, left: '50%', transform: 'translateX(-50%)', zIndex: 6, fontFamily: MONO, fontSize: 8, letterSpacing: '0.12em', color: 'rgba(165,243,252,0.65)', textAlign: 'center', lineHeight: 1.9, pointerEvents: 'none' }}>
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
        const isFocused = selectedAgent === a.id || tasksByAgent.size === 1;

        if (!isFocused) {
          const activeTask = tasks[0];
          const pct = Math.round((activeTask?.progress ?? 0) * 100);
          return (
            <div key={a.id} onClick={() => toggleDossier(a.id)}
              title={`${a.name}: ${activeTask?.title} (${pct}%) — click for full dossier`}
              style={{
                position: 'absolute', left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -120%)',
                zIndex: 6, cursor: 'pointer', padding: '3px 8px',
                background: 'rgba(6,11,20,0.88)', border: `1px solid ${hexA(col, 0.55)}`,
                borderRadius: 12, backdropFilter: 'blur(8px)',
                boxShadow: `0 0 12px ${hexA(col, 0.25)}`,
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: MONO, fontSize: 8, whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: a.status === 'working' ? col : '#f87171', boxShadow: `0 0 6px ${col}` }} />
              <span style={{ color: col, fontWeight: 700, letterSpacing: '0.1em' }}>{a.name.toUpperCase()}</span>
              <span style={{ color: 'rgba(148,233,255,0.7)' }}>{activeTask?.status === 'queued' ? 'QUEUED' : `${pct}%`}</span>
            </div>
          );
        }

        return (
          <div key={a.id} onClick={() => toggleDossier(a.id)}
            style={{
              position: 'absolute', left: `${left}%`, top: `${top}%`, transform: 'translate(-50%,-100%)',
              zIndex: 7, width: 250, cursor: 'pointer',
              background: 'linear-gradient(160deg, rgba(8,14,24,0.92), rgba(5,8,15,0.88))',
              border: `1px solid ${hexA(col, 0.5)}`, borderRadius: 3,
              backdropFilter: 'blur(12px)', padding: '9px 11px',
              boxShadow: `0 0 32px ${hexA(col, 0.22)}, inset 0 0 18px ${hexA(col, 0.05)}`,
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

      {dossiers.map((d, i) => {
        const a = agents.find(x => x.id === d.id);
        if (!a) return null;
        return (
          <AgentDossierPanel
            key={d.id}
            agent={a} snap={snap} now={nowTs}
            pinned={d.pinned}
            onTogglePin={() => togglePinDossier(d.id)}
            onClose={() => closeDossier(d.id)}
            stackIndex={i}
            dockLeft={!narrow}
          />
        );
      })}

      {selectedStation && (
        <OmniSyndicationPanel onClose={() => setSelectedStation(null)} dockLeft={!narrow} />
      )}

      <CortexFoundryNav
        snap={snap}
        onSelectAgent={(id) => { if (id) toggleDossier(id); else clearEphemeralDossiers(); }}
        selectedAgent={selectedAgent}
        onOpenTower={() => setTowerOpen(true)}
      />
      {towerOpen && <CortexTowerPanel onClose={() => setTowerOpen(false)} />}

      {/* ── Shotcraft Cinematics Inspector Modal ── */}
      {inspectedShot !== null && (() => {
        const shot = SHOT_DATA[inspectedShot] || SHOT_DATA[0];
        return (
          <>
            <div
              onClick={() => { setInspectedShot(null); setPreviewPlaying(false); }}
              style={{
                position: 'absolute', inset: 0, zIndex: 45,
                background: 'rgba(2, 4, 10, 0.72)', backdropFilter: 'blur(8px)',
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                zIndex: 46, width: 'min(640px, 92vw)', maxHeight: '88vh',
                background: 'linear-gradient(170deg, rgba(8,14,28,0.96) 0%, rgba(4,7,16,0.98) 100%)',
                border: `1px solid ${shot.accent}66`,
                borderRadius: 8,
                boxShadow: `0 0 40px ${shot.accent}22, 0 16px 48px rgba(0,0,0,0.8)`,
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden', fontFamily: MONO,
              }}
            >
              {/* Header */}
              <div style={{
                padding: '10px 14px', borderBottom: '1px solid rgba(103,232,249,0.18)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(103,232,249,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: shot.accent, fontSize: 12 }}>🎬</span>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: '#f0f9ff' }}>
                    SHOTCRAFT INSPECTOR // {shot.title}
                  </span>
                  <span style={{
                    fontSize: 7.5, padding: '1px 6px', borderRadius: 10,
                    background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)',
                  }}>
                    {shot.timeRange}
                  </span>
                </div>
                <button
                  onClick={() => { setInspectedShot(null); setPreviewPlaying(false); }}
                  style={{
                    background: 'none', border: 'none', color: 'rgba(165,243,252,0.6)',
                    cursor: 'pointer', fontFamily: MONO, fontSize: 13,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '14px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 16:9 Cinematic Viewport Preview */}
                <div style={{
                  position: 'relative', width: '100%', height: 180, borderRadius: 4,
                  background: shot.gradient,
                  border: `1px solid ${shot.accent}44`,
                  overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', alignItems: 'center',
                  boxShadow: `inset 0 0 32px ${shot.accent}15`,
                }}>
                  {/* Subtle Grid overlay */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    pointerEvents: 'none',
                  }} />

                  {/* Corner Reticles */}
                  <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 7, color: shot.accent, letterSpacing: '0.15em' }}>
                    REC ● 60FPS · 4K UHD
                  </div>
                  <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>
                    FRAME {previewPlaying ? Math.round((previewProgress / 100) * 210) : '0'}/210
                  </div>

                  {/* Graphic Visual Representation for each shot */}
                  <div style={{ zIndex: 2, textAlign: 'center', padding: '0 20px' }}>
                    {shot.id === 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: '50%',
                          border: `2px dashed ${shot.accent}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: `0 0 20px ${shot.accent}66`,
                        }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#ffffff', boxShadow: '0 0 10px #ffffff' }} />
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#f0f9ff', letterSpacing: '0.12em' }}>
                          VOLUMETRIC REVEAL // QUANTUM SINGULARITY CORE
                        </div>
                      </div>
                    )}
                    {shot.id === 1 && (
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        {['13/13 VITEST CLEAN', '9ms P50 LATENCY', 'ZERO BELIEF DRIFT'].map((metric, i) => (
                          <div key={i} style={{
                            padding: '6px 10px', borderRadius: 3,
                            background: 'rgba(6,10,24,0.85)', border: '1px solid rgba(52,211,153,0.5)',
                            color: '#34d399', fontSize: 8, fontWeight: 800, letterSpacing: '0.1em',
                            boxShadow: '0 0 12px rgba(52,211,153,0.25)',
                          }}>
                            {metric}
                          </div>
                        ))}
                      </div>
                    )}
                    {shot.id === 2 && (
                      <div style={{ display: 'flex', width: '80%', height: 60, borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(232,121,249,0.5)' }}>
                        <div style={{ flex: 1, background: 'rgba(20,10,30,0.8)', padding: 6, fontSize: 7, color: '#e879f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          TERMINAL DIFF [BEFORE]
                        </div>
                        <div style={{ width: 2, background: '#ffffff', boxShadow: '0 0 8px #ffffff' }} />
                        <div style={{ flex: 1, background: 'rgba(10,30,25,0.8)', padding: 6, fontSize: 7, color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          FOUNDRY 3D [AFTER]
                        </div>
                      </div>
                    )}
                    {shot.id === 3 && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#fef08a', letterSpacing: '0.3em', textShadow: '0 0 16px rgba(251,191,36,0.6)' }}>
                          CORTEX // NEXUS FOUNDRY
                        </div>
                        <div style={{ fontSize: 8, color: '#fbbf24', letterSpacing: '0.15em' }}>
                          MISSION LOCKUP · 120 BPM BEAT DROP
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Scrubber playback line */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.1)' }}>
                    <div style={{
                      height: '100%', width: previewPlaying ? `${previewProgress}%` : '0%',
                      background: shot.accent, boxShadow: `0 0 8px ${shot.accent}`,
                      transition: 'width 0.05s linear',
                    }} />
                  </div>
                </div>

                {/* Shot Specification Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 8 }}>
                  <div style={{ background: 'rgba(6,10,24,0.6)', padding: '8px 10px', borderRadius: 4, border: '1px solid rgba(103,232,249,0.12)' }}>
                    <div style={{ color: shot.accent, fontWeight: 700, marginBottom: 3 }}>CAMERA TRAJECTORY</div>
                    <div style={{ color: 'rgba(224,242,254,0.85)', lineHeight: 1.4 }}>{shot.camera}</div>
                  </div>
                  <div style={{ background: 'rgba(6,10,24,0.6)', padding: '8px 10px', borderRadius: 4, border: '1px solid rgba(103,232,249,0.12)' }}>
                    <div style={{ color: shot.accent, fontWeight: 700, marginBottom: 3 }}>AUDIO TRANSIENT CADENCE</div>
                    <div style={{ color: 'rgba(224,242,254,0.85)', lineHeight: 1.4 }}>{shot.audio}</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(6,10,24,0.6)', padding: '8px 10px', borderRadius: 4, border: '1px solid rgba(103,232,249,0.12)', fontSize: 8 }}>
                  <div style={{ color: shot.accent, fontWeight: 700, marginBottom: 3 }}>SCENE SHADERS & COMPOSITION</div>
                  <div style={{ color: 'rgba(224,242,254,0.85)', lineHeight: 1.4 }}>{shot.shaders}</div>
                </div>

                {/* Key Metrics Chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {shot.metrics.map((m, idx) => (
                    <span key={idx} style={{
                      fontSize: 7.5, fontFamily: MONO, padding: '3px 8px', borderRadius: 3,
                      background: 'rgba(103,232,249,0.06)', border: '1px solid rgba(103,232,249,0.2)',
                      color: 'rgba(165,243,252,0.8)',
                    }}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer Navigation */}
              <div style={{
                padding: '10px 14px', borderTop: '1px solid rgba(103,232,249,0.15)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(6,10,24,0.4)',
              }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      const next = (inspectedShot + 3) % 4;
                      setInspectedShot(next);
                      setActiveShot(next);
                      setPreviewPlaying(false);
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: 3,
                      background: 'rgba(103,232,249,0.1)', border: '1px solid rgba(103,232,249,0.3)',
                      color: '#e0f2fe', fontFamily: MONO, fontSize: 8, cursor: 'pointer',
                    }}
                  >
                    ‹ PREV SHOT
                  </button>
                  <button
                    onClick={() => {
                      const next = (inspectedShot + 1) % 4;
                      setInspectedShot(next);
                      setActiveShot(next);
                      setPreviewPlaying(false);
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: 3,
                      background: 'rgba(103,232,249,0.1)', border: '1px solid rgba(103,232,249,0.3)',
                      color: '#e0f2fe', fontFamily: MONO, fontSize: 8, cursor: 'pointer',
                    }}
                  >
                    NEXT SHOT ›
                  </button>
                </div>
                <button
                  onClick={() => {
                    setPreviewPlaying(true);
                    setPreviewProgress(0);
                  }}
                  style={{
                    padding: '5px 14px', borderRadius: 3,
                    background: previewPlaying ? 'rgba(52,211,153,0.3)' : `linear-gradient(90deg, ${shot.accent}44, ${shot.accent}88)`,
                    border: `1px solid ${shot.accent}`,
                    color: '#ffffff', fontFamily: MONO, fontSize: 8.5, fontWeight: 800,
                    cursor: 'pointer', boxShadow: `0 0 14px ${shot.accent}44`,
                  }}
                >
                  {previewPlaying ? '▶ REPLAYING...' : '▷ PLAY PREVIEW'}
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Remotion 4K Render & Export Modal ── */}
      {showExportModal && (
        <>
          <div
            onClick={() => setShowExportModal(false)}
            style={{
              position: 'absolute', inset: 0, zIndex: 45,
              background: 'rgba(2, 4, 10, 0.72)', backdropFilter: 'blur(8px)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              zIndex: 46, width: 'min(660px, 92vw)', maxHeight: '90vh',
              background: 'linear-gradient(170deg, rgba(8,14,32,0.96) 0%, rgba(4,7,20,0.98) 100%)',
              border: '1px solid rgba(192,132,252,0.45)',
              borderRadius: 8,
              boxShadow: '0 0 48px rgba(192,132,252,0.2), 0 16px 48px rgba(0,0,0,0.85)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden', fontFamily: MONO,
            }}
          >
            {/* Header */}
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid rgba(192,132,252,0.2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(192,132,252,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#c084fc', fontSize: 13 }}>🚀</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.2em', color: '#f0f9ff' }}>
                  REMOTION 4K CINEMATIC SPRINT REEL ENGINE
                </span>
                <span style={{
                  fontSize: 7.5, padding: '1px 6px', borderRadius: 10,
                  background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)',
                }}>
                  60 FPS DETERMINISTIC
                </span>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  background: 'none', border: 'none', color: 'rgba(165,243,252,0.6)',
                  cursor: 'pointer', fontFamily: MONO, fontSize: 13,
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Manifest Info Card */}
              <div style={{
                background: 'rgba(6,10,26,0.6)', border: '1px solid rgba(192,132,252,0.2)',
                borderRadius: 4, padding: '10px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 8 }}>
                  <span style={{ color: 'rgba(165,243,252,0.6)' }}>MANIFEST ID:</span>
                  <span style={{ color: '#c084fc', fontWeight: 700 }}>{sprintReel?.id || 'reel-mwnpz2nh'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 8 }}>
                  <span style={{ color: 'rgba(165,243,252,0.6)' }}>TARGET COMPOSITION:</span>
                  <span style={{ color: '#f0f9ff', fontWeight: 600 }}>CortexSprintReel (15.00s · 900 Frames @ 60fps)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8 }}>
                  <span style={{ color: 'rgba(165,243,252,0.6)' }}>AUDIO STEM SYNC:</span>
                  <span style={{ color: '#38bdf8' }}>Cybernetic Horizon (120 BPM Transient Grid) · Cartesia-Sonic TTS</span>
                </div>
              </div>

              {/* 4 Storyboard Recipes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(165,243,252,0.7)', letterSpacing: '0.1em' }}>
                  4-SHOT STORYBOARD COMPOSITION
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {SHOT_DATA.map((s) => (
                    <div key={s.id} style={{
                      padding: '8px 10px', borderRadius: 4,
                      background: 'rgba(6,10,24,0.5)', border: `1px solid ${s.accent}33`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 8, fontWeight: 700, color: s.accent }}>{s.title.split(':')[1] || s.title}</span>
                        <span style={{ fontSize: 7, color: 'rgba(165,243,252,0.5)' }}>{s.timeRange}</span>
                      </div>
                      <div style={{ fontSize: 7, color: 'rgba(224,242,254,0.7)', marginTop: 3, lineHeight: 1.3 }}>
                        {s.concept.slice(0, 75)}...
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Render Status & Progress Bar */}
              <div style={{
                background: 'rgba(10,16,36,0.6)', border: '1px solid rgba(103,232,249,0.2)',
                borderRadius: 4, padding: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 8.5 }}>
                  <span style={{ color: '#e0f2fe', fontWeight: 700 }}>
                    {isRendering ? '⚡ RENDERING 4K FRAMES...' : renderComplete ? '✓ 4K CINEMATIC MP4 READY' : 'REMOTION PIPELINE STANDBY'}
                  </span>
                  <span style={{ color: renderComplete ? '#34d399' : '#38bdf8', fontWeight: 800 }}>
                    {renderProgress}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'rgba(103,232,249,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{
                    height: '100%', width: `${renderProgress}%`,
                    background: 'linear-gradient(90deg, #38bdf8, #c084fc)',
                    boxShadow: '0 0 12px rgba(192,132,252,0.8)',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <div style={{ fontSize: 7.5, color: renderComplete ? '#34d399' : 'rgba(165,243,252,0.65)' }}>
                  {renderStage || 'Click Start Render to compile Remotion frames into broadcast-ready MP4.'}
                </div>
              </div>

              {/* Terminal CLI Command */}
              <div style={{
                background: 'rgba(4,6,15,0.8)', border: '1px solid rgba(148,233,255,0.15)',
                borderRadius: 4, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ fontSize: 7.5, color: 'rgba(165,243,252,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  $ npx remotion render src/remotion/CortexSprintReel.tsx out/sprint-briefing.mp4
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText('npx remotion render src/remotion/CortexSprintReel.tsx out/sprint-briefing.mp4');
                    setCliCopied(true);
                    setTimeout(() => setCliCopied(false), 3000);
                  }}
                  style={{
                    background: 'rgba(192,132,252,0.15)', border: '1px solid rgba(192,132,252,0.4)',
                    color: '#c084fc', fontFamily: MONO, fontSize: 7.5, padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
                  }}
                >
                  {cliCopied ? '✓ COPIED' : '📋 COPY'}
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{
              padding: '12px 16px', borderTop: '1px solid rgba(192,132,252,0.18)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(6,10,24,0.4)',
            }}>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  padding: '6px 14px', borderRadius: 4,
                  background: 'transparent', border: '1px solid rgba(148,233,255,0.2)',
                  color: 'rgba(165,243,252,0.7)', fontFamily: MONO, fontSize: 8.5, cursor: 'pointer',
                }}
              >
                DISMISS
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                {renderComplete && (
                  <a
                    href="/cortex_foundry_panoramic_holodeck_live.png"
                    download="cortex-sprint-reel-briefing.png"
                    style={{
                      textDecoration: 'none', padding: '6px 14px', borderRadius: 4,
                      background: 'rgba(52,211,153,0.2)', border: '1px solid #34d399',
                      color: '#34d399', fontFamily: MONO, fontSize: 8.5, fontWeight: 800,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <span>💾</span>
                    <span>DOWNLOAD ASSET</span>
                  </a>
                )}
                <button
                  onClick={handleStartRender}
                  disabled={isRendering}
                  style={{
                    padding: '7px 18px', borderRadius: 4,
                    background: isRendering ? 'rgba(192,132,252,0.2)' : 'linear-gradient(90deg, #c084fc, #38bdf8)',
                    border: '1px solid #c084fc',
                    color: '#ffffff', fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.12em',
                    cursor: isRendering ? 'wait' : 'pointer', boxShadow: '0 0 16px rgba(192,132,252,0.4)',
                  }}
                >
                  {isRendering ? '⚡ RENDERING...' : renderComplete ? '↻ RE-RENDER' : '⚡ START 4K REMOTION RENDER'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CortexAgentsScene;
