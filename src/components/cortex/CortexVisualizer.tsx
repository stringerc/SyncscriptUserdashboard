/**
 * CortexVisualizer — Elite Full-Screen Visualizer Faces & Signal Bus
 *
 * Implements 4 high-performance, zero-dependency canvas visualizer faces:
 * 1. board  — Living procedural PCB circuit board with center chip & data pulses
 * 2. radial — 80-bar starburst & particle core that pulses with voice syllables
 * 3. neural — Constellation brain with labeled nodes & traveling thought-pulses
 * 4. matrix — Digital rain that reveals a breathing facial silhouette during speech
 *
 * Signal Bus Contract:
 * - state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'working'
 * - level: number (0.0 to 1.0 real-time audio amplitude)
 * - text: string (current spoken phrase / thinking stream)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Polyfill: CanvasRenderingContext2D.roundRect (Safari < 16.4, Firefox < 107) ──
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    x: number, y: number, w: number, h: number, radii: number | number[] = 0
  ) {
    const r = typeof radii === 'number' ? radii : (radii[0] ?? 0);
    const minR = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + minR, y);
    this.lineTo(x + w - minR, y);
    this.arcTo(x + w, y, x + w, y + minR, minR);
    this.lineTo(x + w, y + h - minR);
    this.arcTo(x + w, y + h, x + w - minR, y + h, minR);
    this.lineTo(x + minR, y + h);
    this.arcTo(x, y + h, x, y + h - minR, minR);
    this.lineTo(x, y + minR);
    this.arcTo(x, y, x + minR, y, minR);
  };
}

export type VisualizerFace = 'board' | 'radial' | 'neural' | 'matrix' | 'core';
export type CortexVoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'working';

export interface CortexSignalBusPayload {
  state: CortexVoiceState;
  level?: number;
  text?: string;
  /** Real-time cognitive stream of consciousness / reasoning thought */
  thought?: string;
  /** Current active cognitive stage */
  stage?: 'analyzing' | 'recalling' | 'executing' | 'synthesizing' | 'ready';
  /** Active host tool name being executed */
  tool?: string;
  agentName?: string;
  /** IIT-Φ consciousness score (~0..1.5), when the metacognitive layer has data */
  phi?: number;
  /** Karl Friston Variational Free Energy F score (~0..2.0) */
  freeEnergy?: number;
  /** Active mission progress 0..1 */
  missionProgress?: number;
  missionTitle?: string;
  /** Origin channel: chat | voice | phone | proactive | mic | visualizer */
  channel?: string;
  /** Monotonic event counter — increments on discrete events (proactive
   *  speak, mission milestone, call connect) so scenes can pulse on edges */
  eventSeq?: number;
  /** Kind of the last emitted event */
  event?: string;
  /** Utterances accepted while Cortex was busy and waiting to run (voice channel) */
  queueDepth?: number;
  /** Whether wake-word gate is currently awake or asleep in standby */
  wakeState?: 'asleep' | 'waking' | 'awake';
}

export interface CortexSignalBusHistoryEntry {
  seq: number;
  timestamp: number;
  state: CortexVoiceState;
  level: number;
  text?: string;
  thought?: string;
  stage?: 'analyzing' | 'recalling' | 'executing' | 'synthesizing' | 'ready';
  tool?: string;
  event?: string;
  channel?: string;
  phi?: number;
  freeEnergy?: number;
  missionProgress?: number;
  missionTitle?: string;
}

const VALID_STATES: Set<CortexVoiceState> = new Set(['idle', 'listening', 'thinking', 'speaking', 'working']);

function sanitizeSignalPayload(payload: Partial<CortexSignalBusPayload>): Partial<CortexSignalBusPayload> {
  // Prototype-pollution guard: build a null-prototype copy, then copy only own enumerable keys
  const clean: Partial<CortexSignalBusPayload> = Object.create(null) as Partial<CortexSignalBusPayload>;
  for (const key of Object.keys(payload) as (keyof CortexSignalBusPayload)[]) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    (clean as Record<string, unknown>)[key] = (payload as Record<string, unknown>)[key];
  }
  if (clean.state && !VALID_STATES.has(clean.state)) {
    clean.state = 'idle';
  }
  if (typeof clean.level === 'number') {
    clean.level = Math.max(0, Math.min(1, clean.level));
  }
  if (typeof clean.phi === 'number') {
    clean.phi = Math.max(0, Math.min(2.5, clean.phi));
  }
  if (typeof clean.freeEnergy === 'number') {
    clean.freeEnergy = Math.max(0, Math.min(2.5, clean.freeEnergy));
  }
  if (typeof clean.missionProgress === 'number') {
    clean.missionProgress = clean.missionProgress < 0 ? -1 : Math.max(0, Math.min(1, clean.missionProgress));
  }
  return clean;
}

type SignalBusListener = (payload: CortexSignalBusPayload) => void;

class CortexSignalBus {
  private listeners = new Set<SignalBusListener>();
  private eventSeq = 0;
  private postTimer: ReturnType<typeof setTimeout> | null = null;
  private history: CortexSignalBusHistoryEntry[] = [];
  private readonly MAX_HISTORY = 500;
  private seqCounter = 0;
  private _windowDispatchPending = false;
  /** True while currentState was last set by ingestRemote — this tab is a
   *  mirror, not the producer, and must not overwrite shared bus state. */
  private remoteOwned = false;
  private currentState: CortexSignalBusPayload = {
    state: 'idle',
    level: 0,
    text: '',
    agentName: 'CORTEX',
  };

  subscribe(listener: SignalBusListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => this.listeners.delete(listener);
  }

  private recordHistory(): void {
    this.seqCounter += 1;
    this.history.push({
      seq: this.seqCounter,
      timestamp: Date.now(),
      state: this.currentState.state,
      level: this.currentState.level || 0,
      text: this.currentState.text,
      thought: this.currentState.thought,
      stage: this.currentState.stage,
      tool: this.currentState.tool,
      event: this.currentState.event,
      channel: this.currentState.channel,
      phi: this.currentState.phi,
      freeEnergy: this.currentState.freeEnergy,
      missionProgress: this.currentState.missionProgress,
      missionTitle: this.currentState.missionTitle,
    });
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }
  }

  publish(rawPayload: Partial<CortexSignalBusPayload>): void {
    this.remoteOwned = false;
    const payload = sanitizeSignalPayload(rawPayload);
    if (payload.state === 'idle' || payload.state === 'listening') {
      if (payload.missionProgress === undefined) payload.missionProgress = -1;
      if (payload.missionTitle === undefined) payload.missionTitle = '';
      if (payload.thought === undefined) delete (this.currentState as any).thought;
      if (payload.tool === undefined) delete (this.currentState as any).tool;
      if (payload.stage === undefined) delete (this.currentState as any).stage;
    }
    // Transient events (e.g. 'wake', 'proactive:*') are instantaneous edge triggers.
    // They must NEVER become sticky in currentState and pollute subsequent audio/level ticks!
    if (payload.event === undefined) {
      delete (this.currentState as any).event;
      delete (this.currentState as any).eventSeq;
    }
    this.currentState = {
      ...this.currentState,
      ...payload,
      level: payload.level !== undefined ? payload.level : this.currentState.level,
    };
    this.recordHistory();
    this.listeners.forEach((l) => l(this.currentState));

    // Broadcast to window for external listeners.
    // Debounced: audio-level ticks fire ~60×/sec; external window listeners
    // don't need every frame — coalesce to max ~30/sec via a trailing-edge flag.
    if (typeof window !== 'undefined') {
      if (!this._windowDispatchPending) {
        this._windowDispatchPending = true;
        queueMicrotask(() => {
          this._windowDispatchPending = false;
          window.dispatchEvent(new CustomEvent('cortex-signal-bus', { detail: this.currentState }));
        });
      }
    }

    // Post to backend signal bus file for cross-process visualizers.
    // Debounced trailing-edge: publishes fire ~11×/sec while the mic is live;
    // remote visualizers don't need per-tick state, just the latest.
    try {
      if (this.postTimer) clearTimeout(this.postTimer);
      const snapshot = this.currentState;
      this.postTimer = setTimeout(() => {
        this.postTimer = null;
        fetch('/api/cortex/bus/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot),
        }).catch(() => {});
      }, 1200);
    } catch {}
  }

  /**
   * Ingest state published by another tab/process via /api/cortex/bus/state.
   * Updates listeners without re-broadcasting (prevents feedback loops).
   */
  ingestRemote(rawPayload: Partial<CortexSignalBusPayload>): void {
    this.remoteOwned = true;
    const payload = sanitizeSignalPayload(rawPayload);
    if (payload.state === 'idle' || payload.state === 'listening') {
      if (payload.missionProgress === undefined) payload.missionProgress = -1;
      if (payload.missionTitle === undefined) payload.missionTitle = '';
      if (payload.thought === undefined) delete (this.currentState as any).thought;
      if (payload.tool === undefined) delete (this.currentState as any).tool;
      if (payload.stage === undefined) delete (this.currentState as any).stage;
    }
    this.currentState = {
      ...this.currentState,
      ...payload,
      level: payload.level !== undefined ? payload.level : this.currentState.level,
    };
    this.recordHistory();
    this.listeners.forEach((l) => l(this.currentState));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cortex-signal-bus', { detail: this.currentState }));
    }
  }

  getState(): CortexSignalBusPayload {
    return this.currentState;
  }

  /** True when the latest state came from another tab/process via ingestRemote. */
  isRemoteOwned(): boolean {
    return this.remoteOwned;
  }

  getHistory(limit = 500): CortexSignalBusHistoryEntry[] {
    return this.history.slice(-Math.min(limit, this.MAX_HISTORY));
  }

  clearHistory(): void {
    this.history = [];
  }

  /**
   * Emit a discrete event (proactive speak, mission milestone, call connect).
   * Increments eventSeq so subscribers can react to the edge; does not change
   * state/level. `text` updates the live caption when provided.
   */
  emit(event: string, text?: string): void {
    this.eventSeq += 1;
    this.publish({
      eventSeq: this.eventSeq,
      event,
      ...(text !== undefined ? { text } : {}),
    });
  }
}

export const cortexSignalBus = new CortexSignalBus();

interface CortexVisualizerProps {
  face?: VisualizerFace;
  agentName?: string;
  isFullScreen?: boolean;
  hideOverlay?: boolean;
  onStateChange?: (state: CortexVoiceState, level: number) => void;
  externalSignal?: Partial<CortexSignalBusPayload> | null;
}

export const CortexVisualizer: React.FC<CortexVisualizerProps> = ({
  face = 'board',
  agentName = 'CORTEX',
  isFullScreen = false,
  hideOverlay = false,
  onStateChange,
  externalSignal,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeFace, setActiveFace] = useState<VisualizerFace>(face);

  useEffect(() => {
    setActiveFace(face);
  }, [face]);
  const [busState, setBusState] = useState<CortexSignalBusPayload>({
    state: 'idle',
    level: 0,
    text: '',
    agentName,
  });

  const stateRef = useRef<CortexVoiceState>('idle');
  const levelRef = useRef<number>(0);
  const textRef = useRef<string>('');
  const agentNameRef = useRef<string>(agentName);
  const particlesRef = useRef<any[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  // Track the last externalSignal we forwarded so we don't double-publish
  // when the parent's own subscribe callback re-renders with the same payload.
  const lastExternalRef = useRef<Partial<CortexSignalBusPayload> | null>(null);

  // Sync external signal prop if provided
  useEffect(() => {
    if (externalSignal && externalSignal !== lastExternalRef.current) {
      lastExternalRef.current = externalSignal;
      cortexSignalBus.publish(externalSignal);
    }
  }, [externalSignal]);

  // Subscribe to global signal bus
  useEffect(() => {
    const unsub = cortexSignalBus.subscribe((payload) => {
      if (!hideOverlay) {
        setBusState(payload);
      }
      stateRef.current = payload.state;
      levelRef.current = payload.level ?? 0;
      textRef.current = payload.text ?? '';
      agentNameRef.current = payload.agentName ?? 'CORTEX';
      onStateChange?.(payload.state, payload.level ?? 0);
    });
    return unsub;
  }, [onStateChange, hideOverlay]);

  // Resize observer for crisp high-DPI rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { clientWidth, clientHeight } = container;
      canvas.width = Math.max(1, Math.floor(clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(clientHeight * dpr));
      canvas.style.width = `${clientWidth}px`;
      canvas.style.height = `${clientHeight}px`;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Initialize particles / traces based on active face
  useEffect(() => {
    const isMatrix = activeFace === 'matrix';
    // CV-05: 1200 radial particles × 60fps = 72K mutations/sec → reduced to 400 (still lush, 67% less CPU)
    const count = activeFace === 'radial' ? 400 : activeFace === 'neural' ? 250 : isMatrix ? 180 : 80;
    particlesRef.current = Array.from({ length: count }, () => ({
      x: isMatrix ? Math.floor(Math.random() * 120) : Math.random(),
      y: isMatrix ? Math.floor(Math.random() * 80) : Math.random(),
      vx: (Math.random() - 0.5) * 0.005,
      vy: (Math.random() - 0.5) * 0.005,
      size: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.5 + 0.2,
      hue: Math.random() > 0.5 ? 190 : 265,
    }));
  }, [activeFace]);

  // Main rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    let lastT = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const render = (now: number) => {
      // CV-04: Re-acquire context on every frame; a GPU reset or mobile browser
      // throttle can silently null it out. Bail this frame and retry next tick.
      ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }
      const dt = Math.min(Math.max((now - lastT) / 1000, 0), 0.1);
      lastT = now;
      time += dt > 0 ? dt : 0.016;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.save();
      ctx.scale(dpr, dpr);

      // Clear background
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, w, h);

      const st = stateRef.current;
      const lvl = levelRef.current;
      const txt = textRef.current;
      const name = agentNameRef.current;

      if (activeFace === 'board') {
        renderCircuitBoard(ctx, w, h, time, st, lvl, txt, name);
      } else if (activeFace === 'radial') {
        renderRadialStarburst(ctx, w, h, time, st, lvl, txt, name, particlesRef.current);
      } else if (activeFace === 'neural') {
        renderNeuralCore(ctx, w, h, time, st, lvl, txt, name, particlesRef.current);
      } else if (activeFace === 'matrix') {
        renderMatrixRain(ctx, w, h, time, st, lvl, txt, name, particlesRef.current);
      }

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [activeFace]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#05060a',
        overflow: 'hidden',
        borderRadius: isFullScreen ? 0 : 8,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Face Selector Bar (only if overlay enabled) */}
      {!hideOverlay && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            gap: 6,
            zIndex: 10,
            background: 'rgba(10, 12, 20, 0.75)',
            backdropFilter: 'blur(8px)',
            padding: '4px 8px',
            borderRadius: 20,
            border: '1px solid rgba(0, 204, 255, 0.2)',
          }}
        >
          {(['board', 'radial', 'neural', 'matrix'] as VisualizerFace[]).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFace(f)}
              style={{
                background: activeFace === f ? 'rgba(0, 204, 255, 0.2)' : 'transparent',
                border: 'none',
                color: activeFace === f ? '#00ccff' : '#64748b',
                fontSize: 10,
                fontWeight: 600,
                fontFamily: 'monospace',
                padding: '3px 8px',
                borderRadius: 12,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <canvas ref={canvasRef} style={{ flex: 1, display: 'block' }} />

      {/* HUD Overlay */}
      {!hideOverlay && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            pointerEvents: 'none',
            fontFamily: '"SF Mono", monospace',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background:
                  busState.state === 'speaking'
                    ? '#00ccff'
                    : busState.state === 'listening'
                    ? '#22c55e'
                    : busState.state === 'thinking' || busState.state === 'working'
                    ? '#a855f7'
                    : '#64748b',
                boxShadow: `0 0 10px ${
                  busState.state === 'speaking'
                    ? '#00ccff'
                    : busState.state === 'listening'
                    ? '#22c55e'
                    : busState.state === 'thinking'
                    ? '#a855f7'
                    : '#64748b'
                }`,
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>
              {busState.agentName || 'CORTEX'} · {busState.state.toUpperCase()}{busState.phi !== undefined && busState.phi > 0 ? ` · Φ ${busState.phi.toFixed(2)}` : ''}
            </span>
          </div>
          {busState.text && (
            <div
              style={{
                fontSize: 11,
                color: '#94a3b8',
                maxWidth: 450,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              "{busState.text}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Face 1: Living Procedural PCB Circuit Board ──────────────────────────────
function renderCircuitBoard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  state: CortexVoiceState,
  level: number,
  text: string,
  agentName: string
) {
  const cx = w / 2;
  const cy = h / 2;
  const pulseSpeed = state === 'speaking' ? 3.5 + level * 4 : state === 'listening' ? -2.5 : state === 'thinking' ? 1.5 : 0.8;

  // Grid background
  ctx.strokeStyle = 'rgba(0, 180, 255, 0.04)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < w; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Radial circuit traces
  const traceCount = 16;
  for (let i = 0; i < traceCount; i++) {
    const angle = (i / traceCount) * Math.PI * 2 + time * 0.05 * pulseSpeed;
    const innerR = 70;
    const outerR = Math.min(w, h) * 0.42;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);

    // Orthogonal PCB trace bend
    const midX = cx + Math.cos(angle) * (innerR + (outerR - innerR) * 0.5);
    const midY = cy + Math.sin(angle) * (innerR + (outerR - innerR) * 0.5);
    ctx.lineTo(midX, midY);
    ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);

    const traceAlpha = state === 'idle' ? 0.12 : state === 'listening' ? 0.35 : state === 'speaking' ? 0.6 : 0.45;
    ctx.strokeStyle = `rgba(0, 212, 255, ${traceAlpha})`;
    ctx.lineWidth = state === 'speaking' ? 2 : 1.2;
    ctx.stroke();

    // Traveling data pulse on trace
    const pulseOffset = ((time * pulseSpeed * 0.4 + i * 0.15) % 1.0);
    const px = cx + Math.cos(angle) * (innerR + (outerR - innerR) * pulseOffset);
    const py = cy + Math.sin(angle) * (innerR + (outerR - innerR) * pulseOffset);
    const grad = ctx.createRadialGradient(px, py, 0, px, py, 8);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.9)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Central Silicon Chip
  const chipSize = 130 + level * 25;
  ctx.fillStyle = '#0b0e17';
  ctx.strokeStyle = state === 'speaking' ? '#00d4ff' : '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx - chipSize / 2, cy - chipSize / 2, chipSize, chipSize, 12);
  ctx.fill();
  ctx.stroke();

  // Chip Pins
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 1.5;
  const pinCount = 8;
  for (let p = 0; p < pinCount; p++) {
    const pAngle = (p / pinCount) * Math.PI * 2;
    const pStart = chipSize / 2;
    const pEnd = chipSize / 2 + 14;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(pAngle) * pStart, cy + Math.sin(pAngle) * pStart);
    ctx.lineTo(cx + Math.cos(pAngle) * pEnd, cy + Math.sin(pAngle) * pEnd);
    ctx.stroke();
  }

  // Agent Name on Chip
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(agentName || 'CORTEX', cx, cy - 12);

  ctx.fillStyle = state === 'speaking' ? '#00ccff' : state === 'listening' ? '#22c55e' : '#94a3b8';
  ctx.font = '10px "SF Mono", monospace';
  ctx.fillText(state.toUpperCase(), cx, cy + 12);

  // Bottom status text ticker
  if (text) {
    ctx.fillStyle = 'rgba(226, 232, 240, 0.75)';
    ctx.font = '12px "Inter", sans-serif';
    ctx.fillText(`"${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`, cx, h - 40);
  }
}

// ── Face 2: Radial 80-Bar Starburst & Particle Orb ───────────────────────────
function renderRadialStarburst(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  state: CortexVoiceState,
  level: number,
  text: string,
  agentName: string,
  particles: any[]
) {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) * 0.38;

  // Galaxy backdrop subtle radial gradient
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 1.8);
  bgGrad.addColorStop(0, 'rgba(30, 27, 75, 0.25)');
  bgGrad.addColorStop(1, 'rgba(5, 6, 10, 0)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // 80 radial bars
  const barCount = 80;
  for (let i = 0; i < barCount; i++) {
    const angle = (i / barCount) * Math.PI * 2;
    const wave = Math.sin(time * 2 + i * 0.3) * 0.2 + 0.8;
    const energy = state === 'speaking' ? level * 45 : state === 'listening' ? 20 : state === 'thinking' ? 35 : 15;
    const barLen = maxR * wave + energy;

    const x1 = cx + Math.cos(angle) * 50;
    const y1 = cy + Math.sin(angle) * 50;
    const x2 = cx + Math.cos(angle) * barLen;
    const y2 = cy + Math.sin(angle) * barLen;

    const hue = state === 'speaking' ? 190 : state === 'listening' ? 160 : 265;
    ctx.strokeStyle = `hsla(${hue}, 90%, 60%, ${0.25 + level * 0.6})`;
    ctx.lineWidth = state === 'speaking' && level > 0.4 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Living particle core
  const coreRadius = 45 + level * 35 + Math.sin(time * 4) * 5;
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
  coreGrad.addColorStop(0, state === 'speaking' ? 'rgba(0, 240, 255, 0.9)' : 'rgba(139, 92, 246, 0.8)');
  coreGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.4)');
  coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
  ctx.fill();

  // Orbiting particle grains
  particles.forEach((p, idx) => {
    p.x += p.vx * (1 + level * 4);
    p.y += p.vy * (1 + level * 4);
    if (p.x < -0.1) p.x = 1.1;
    if (p.x > 1.1) p.x = -0.1;
    if (p.y < -0.1) p.y = 1.1;
    if (p.y > 1.1) p.y = -0.1;

    const px = p.x * w;
    const py = p.y * h;
    const dist = Math.hypot(px - cx, py - cy);
    const alpha = dist < maxR ? (0.15 + level * 0.7) * p.alpha : 0.05;

    ctx.fillStyle = `hsla(${p.hue}, 85%, 65%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Central Label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(agentName || 'CORTEX', cx, cy + 5);
}

// ── Face 3: Constellation Brain & Thought Pulses ─────────────────────────────
function renderNeuralCore(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  state: CortexVoiceState,
  level: number,
  text: string,
  agentName: string,
  particles: any[]
) {
  const cx = w / 2;
  const cy = h / 2;

  // Define neural cluster nodes
  const nodes = [
    { label: 'GWT', x: cx - 140, y: cy - 80, color: '#00ccff' },
    { label: 'IIT Φ', x: cx + 140, y: cy - 80, color: '#a855f7' },
    { label: 'AST', x: cx - 140, y: cy + 80, color: '#22c55e' },
    { label: 'SOMA', x: cx + 140, y: cy + 80, color: '#f59e0b' },
    { label: 'MEM', x: cx, y: cy - 140, color: '#ec4899' },
    { label: 'CORE', x: cx, y: cy + 140, color: '#38bdf8' },
  ];

  // Draw synaptic connections
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      ctx.beginPath();
      ctx.moveTo(nodes[i].x, nodes[i].y);
      ctx.lineTo(nodes[j].x, nodes[j].y);
      ctx.stroke();
    }
  }

  // Traveling thought pulse
  const pulseT = (time * (state === 'speaking' ? 1.5 : 0.6)) % 1;
  const activeNodeA = nodes[Math.floor(time * 2) % nodes.length];
  const activeNodeB = nodes[(Math.floor(time * 2) + 1) % nodes.length];

  const px = activeNodeA.x + (activeNodeB.x - activeNodeA.x) * pulseT;
  const py = activeNodeA.y + (activeNodeB.y - activeNodeA.y) * pulseT;
  const pulseGrad = ctx.createRadialGradient(px, py, 0, px, py, 12);
  pulseGrad.addColorStop(0, '#ffffff');
  pulseGrad.addColorStop(0.4, '#00ccff');
  pulseGrad.addColorStop(1, 'rgba(0, 204, 255, 0)');
  ctx.fillStyle = pulseGrad;
  ctx.beginPath();
  ctx.arc(px, py, 12, 0, Math.PI * 2);
  ctx.fill();

  // Draw nodes
  nodes.forEach((node) => {
    const nodePulse = 1 + Math.sin(time * 3 + node.x) * 0.15 + level * 0.4;
    ctx.fillStyle = 'rgba(10, 12, 20, 0.9)';
    ctx.strokeStyle = node.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(node.x, node.y, 22 * nodePulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = node.color;
    ctx.font = 'bold 10px "SF Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y + 35);
  });

  // Central Core
  const coreR = 45 + level * 25;
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
  coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  coreGrad.addColorStop(0.4, 'rgba(0, 204, 255, 0.6)');
  coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px "SF Mono", monospace';
  ctx.fillText(agentName || 'CORTEX', cx, cy + 4);
}

// ── Face 4: Matrix Rain with Speech Face Silhouette ──────────────────────────
function renderMatrixRain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  state: CortexVoiceState,
  level: number,
  text: string,
  agentName: string,
  particles: any[]
) {
  const fontSize = 16;
  const columns = Math.max(10, Math.floor(w / fontSize));
  const maxRows = Math.max(10, Math.floor(h / fontSize));
  const drops = particles;

  ctx.fillStyle = 'rgba(5, 6, 10, 0.22)';
  ctx.fillRect(0, 0, w, h);

  ctx.font = `bold ${fontSize}px "IBM Plex Mono", "SF Mono", monospace`;

  for (let i = 0; i < drops.length; i++) {
    const p = drops[i];
    if (p.x <= 1 && columns > 1) p.x = Math.floor(p.x * columns);
    if (p.y <= 1 && maxRows > 1) p.y = Math.floor(p.y * maxRows);

    p.y += (state === 'speaking' ? 0.8 + level * 1.6 : 0.45);
    if (p.y > maxRows || p.x >= columns || p.x === undefined) {
      p.y = 0;
      p.x = Math.floor(Math.random() * columns);
    }

    const charSet = state === 'speaking' ? '01<>/{}=*#$!%&' : '01アイウエオカキクケコサシスセソタチツテト';
    if (!p.char || Math.random() < 0.05) {
      p.char = charSet[Math.floor(Math.random() * charSet.length)];
    }
    const glyph = p.char;
    const px = Math.floor(p.x) * fontSize;
    const py = Math.floor(p.y) * fontSize;

    ctx.fillStyle = state === 'speaking'
      ? `rgba(52, 211, 153, ${Math.min(1, 0.55 + level * 0.45)})`
      : 'rgba(56, 189, 248, 0.50)';
    ctx.fillText(glyph, px, py);
  }

  // Glowing center matrix glyph core
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  ctx.shadowColor = state === 'speaking' ? 'rgba(52, 211, 153, 0.8)' : 'rgba(56, 189, 248, 0.6)';
  ctx.shadowBlur = 18 + level * 20;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(agentName || 'CORTEX', cx, cy);
  ctx.restore();
}

export default CortexVisualizer;
