/**
 * ArtifactRenderer — renders CortexArtifact objects as HUD instrument cards.
 * Shared by /cortex/chat message list, the visualizer chat drawer, and the
 * Phase-2 surface layer. Design language: 1px hairline borders, corner ticks,
 * 9px mono uppercase labels, state-color accents, spring entrance.
 */
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { ExternalLink, Pin, X } from 'lucide-react';
import { C } from '../cortex-demo-helpers';
import type { CortexArtifact, ChartArtifact, TableArtifact, ImageArtifact, DocumentArtifact, FeedArtifact, StatArtifact, WeatherArtifact } from '../../../lib/cortex-artifacts';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

// ── MurmurationField — starling-flock particle backdrop ──────────────────
// ~140 boids driven by layered sine flow-fields; each bird is a small
// chevron stroke. Runs on rAF, pauses offscreen/hidden, honors
// prefers-reduced-motion (renders one static frame).
function MurmurationField({ density = 1, className }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let running = false;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const N = Math.max(40, Math.round(130 * density));
    const birds = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0009, vy: (Math.random() - 0.5) * 0.0009,
      phase: Math.random() * Math.PI * 2,
      hue: [187, 318, 45, 265][Math.floor(Math.random() * 4)],
      size: 0.8 + Math.random() * 1.4,
      flap: Math.random() * Math.PI * 2,
    }));
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const flow = (x: number, y: number, t: number) => {
      // Layered sines ≈ cheap curl-noise; returns a heading angle.
      return Math.sin(x * 6.1 + t * 0.00042) * 1.9
        + Math.cos(y * 4.3 - t * 0.00031) * 1.6
        + Math.sin((x + y) * 3.2 + t * 0.00053) * 1.1;
    };

    const tick = (now: number) => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      const t = now;
      for (const b of birds) {
        const px = b.x * w, py = b.y * h;
        const ang = flow(b.x, b.y, t) + b.phase * 0.35;
        // Steer velocity toward flow heading, keep a minimum cruise speed.
        const targetVx = Math.cos(ang) * 0.0016, targetVy = Math.sin(ang) * 0.0016;
        b.vx += (targetVx - b.vx) * 0.02;
        b.vy += (targetVy - b.vy) * 0.02;
        b.x += b.vx * 60 * 0.016 * 60 * 0.016; // ~px/frame at 60fps
        b.y += b.vy * 60 * 0.016 * 60 * 0.016;
        // Soft wrap edges so the flock never leaves.
        const m = 0.04;
        if (b.x < -m) b.x += 1 + 2 * m; else if (b.x > 1 + m) b.x -= 1 + 2 * m;
        if (b.y < -m) b.y += 1 + 2 * m; else if (b.y > 1 + m) b.y -= 1 + 2 * m;
        b.flap += 0.35;
        const heading = Math.atan2(b.vy, b.vx);
        const s = b.size * (w / 900 + 0.4);
        const flapAmp = Math.sin(b.flap) * s * 0.9;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(heading);
        ctx.strokeStyle = `hsla(${b.hue}, 90%, 72%, 0.5)`;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        // Starling dart: two swept wings meeting at a point.
        ctx.beginPath();
        ctx.moveTo(-s * 1.6, -flapAmp * 0.4);
        ctx.quadraticCurveTo(-s * 0.4, -s * 0.9 - flapAmp, 0, 0);
        ctx.quadraticCurveTo(-s * 0.4, s * 0.9 + flapAmp, -s * 1.6, flapAmp * 0.4);
        ctx.stroke();
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([e]) => {
      const vis = e.isIntersecting && !document.hidden;
      if (vis && !running) { running = true; raf = requestAnimationFrame(tick); }
      else if (!vis && running) { running = false; cancelAnimationFrame(raf); }
    }, { threshold: 0.02 });
    io.observe(canvas);
    if (reduced) {
      // One static scatter frame for reduced-motion users.
      running = true; tick(0); running = false;
    }
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [density]);
  return <canvas ref={ref} className={className} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true" />;
}

// ── MurmurationGather — orbs swarm in and assemble the panel frame ───────
// On mount, ~100 glowing motes spawn scattered (some beyond the edges),
// seek their slot on the panel's perimeter ring with arrival damping and
// perpendicular wander, shimmer in formation, then dissolve — the "modal
// creates itself out of nothing" entrance. Self-terminating: the rAF loop
// stops and the canvas goes transparent once the fade completes.
export function MurmurationGather({ count = 96, duration = 1700 }: { count?: number; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const PAD = 7; // ring inset — sits inside the panel's padding channel

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // Ring targets: even spacing around the rectangle perimeter.
    const ring: { x: number; y: number }[] = [];
    const buildRing = () => {
      ring.length = 0;
      const x0 = PAD, y0 = PAD, x1 = w - PAD, y1 = h - PAD;
      if (x1 <= x0 || y1 <= y0) return;
      const top = x1 - x0, side = y1 - y0;
      const per = 2 * top + 2 * side;
      const n = Math.max(24, Math.min(count * 2, Math.round(per / 9)));
      for (let i = 0; i < n; i++) {
        let d = (i / n) * per;
        let x: number, y: number;
        if (d < top) { x = x0 + d; y = y0; }
        else if ((d -= top) < side) { x = x1; y = y0 + d; }
        else if ((d -= side) < top) { x = x1 - d; y = y1; }
        else { d -= top; x = x0; y = y1 - d; }
        ring.push({ x: x + (Math.random() - 0.5) * 3, y: y + (Math.random() - 0.5) * 3 });
      }
    };
    buildRing();
    const ro = new ResizeObserver(() => { resize(); buildRing(); });
    ro.observe(canvas);

    const palette = [187, 318, 45, 265, 200];
    const ERUPT = 480; // ms of radial burst before seek takes over
    const FRAME = 1000 / 60;
    const parts = Array.from({ length: count }, (_, i) => {
      // Starlings boil up from the panel's heart: each bird gets an evenly
      // spread eruption bearing, bursts radially with swirl, then peels
      // into its perimeter slot as the glass panel fades in beneath.
      const tx = ring.length ? ring[i % ring.length].x : w / 2;
      const ty = ring.length ? ring[i % ring.length].y : h / 2;
      const spread = Math.min(w, h) * 0.1;
      const eruptDist = Math.hypot(tx - w / 2, ty - h / 2) || 1;
      return {
        x: w / 2 + (Math.random() - 0.5) * spread,
        y: h / 2 + (Math.random() - 0.5) * spread,
        vx: 0, vy: 0,
        ang: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.7,
        eruptSpeed: (eruptDist / (ERUPT / FRAME)) * 1.35,
        tx, ty,
        hue: palette[i % palette.length],
        r: 1.0 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        delay: Math.random() * 140, // tight stagger — one boiling flock
      };
    });

    if (reduced) {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        ctx.beginPath();
        ctx.arc(p.tx, p.ty, p.r, 0, 6.2832);
        ctx.fillStyle = `hsla(${p.hue}, 95%, 75%, 0.5)`;
        ctx.fill();
      }
      ro.disconnect();
      return () => ro.disconnect();
    }

    const start = performance.now();
    const FADE = 420;
    const tick = (now: number) => {
      const t = now - start;
      const globalAlpha = t < duration - FADE ? 1 : Math.max(0, (duration - t) / FADE);
      if (globalAlpha <= 0) { ro.disconnect(); return; }
      ctx.clearRect(0, 0, w, h);
      // Reactor-core glow at the spawn centroid — sells the "energy ball"
      // the orbs condense from before they expand into the frame.
      const coreA = Math.max(0, 1 - t / 520) * globalAlpha;
      if (coreA > 0.01 && w > 0 && h > 0) {
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.4);
        g.addColorStop(0, `rgba(140,220,255,${0.22 * coreA})`);
        g.addColorStop(0.45, `rgba(232,121,249,${0.09 * coreA})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      for (const p of parts) {
        const lt = t - p.delay;
        if (lt < 0) continue; // not launched yet
        // Eruption → seek blend: pure radial burst for the first half of
        // ERUPT, then smoothly hands off to perimeter seeking.
        const b = Math.min(1, Math.max(0, (lt - ERUPT * 0.5) / (ERUPT * 0.9)));
        const ramp = Math.min(1, lt / (ERUPT * 0.7));
        const swirl = Math.sin(lt * 0.006 + p.phase) * 0.55;
        const ea = p.ang + swirl;
        const evx = Math.cos(ea) * p.eruptSpeed * ramp;
        const evy = Math.sin(ea) * p.eruptSpeed * ramp;
        const dx = p.tx - p.x, dy = p.ty - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = Math.min(3.4, dist * 0.006 + 0.15);
        // Perpendicular wander keeps the flock alive, not robotic.
        const wob = Math.sin(lt * 0.004 + p.phase) * 0.35;
        const nx = dx / dist, ny = dy / dist;
        const svx = nx * speed - ny * wob;
        const svy = ny * speed + nx * wob;
        p.vx += ((evx * (1 - b) + svx * b) - p.vx) * 0.14;
        p.vy += ((evy * (1 - b) + svy * b) - p.vy) * 0.14;
        p.x += p.vx; p.y += p.vy;
        const shimmer = 0.55 + 0.45 * Math.sin(lt * 0.012 + p.phase);
        const a = Math.min(1, lt / 200) * globalAlpha * shimmer;
        if (a <= 0.01) continue;
        // Starling dart: chevron wings swept along the velocity heading,
        // orb glow at the body — reads as a glowing bird, not a dot.
        const heading = Math.atan2(p.vy, p.vx);
        const s = (1.4 + p.r * 1.5) * (Math.min(w, h) / 620 + 0.3);
        const flap = Math.sin(lt * 0.028 + p.phase) * s * 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.4, 0, 6.2832);
        ctx.fillStyle = `hsla(${p.hue}, 95%, 70%, ${a * 0.14})`;
        ctx.fill();
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(heading);
        ctx.strokeStyle = `hsla(${p.hue}, 95%, 74%, ${a * 0.9})`;
        ctx.lineWidth = 1.15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-s * 1.5, -flap * 0.5);
        ctx.quadraticCurveTo(-s * 0.3, -s * 0.85 - flap, 0, 0);
        ctx.quadraticCurveTo(-s * 0.3, s * 0.85 + flap, -s * 1.5, flap * 0.5);
        ctx.stroke();
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [count, duration]);
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }} aria-hidden="true" />;
}

interface TelemetrySample { state: string; level: number; text: string; ts: number }
let telemetryCache: TelemetrySample | null = null;
const telemetrySubs = new Set<(t: TelemetrySample) => void>();
let telemetryTimer: ReturnType<typeof setInterval> | null = null;

/** Shared poller for Cortex's own signal bus — live artifacts subscribe here. */
function useTelemetry(): TelemetrySample | null {
  const [t, setT] = useState<TelemetrySample | null>(telemetryCache);
  useEffect(() => {
    const sub = (v: TelemetrySample) => setT(v);
    telemetrySubs.add(sub);
    if (!telemetryTimer) {
      const poll = async () => {
        try {
          const r = await fetch('/api/cortex/bus/state', { cache: 'no-store' });
          const d = await r.json();
          telemetryCache = {
            state: String(d?.state || 'idle'),
            level: Number(d?.level ?? 0),
            text: String(d?.text || ''),
            ts: Date.now(),
          };
          telemetrySubs.forEach((f) => f(telemetryCache!));
        } catch {}
      };
      void poll();
      telemetryTimer = setInterval(poll, 2000);
    }
    return () => {
      telemetrySubs.delete(sub);
      // Last subscriber gone → stop polling so closed panels don't leak timers.
      if (!telemetrySubs.size && telemetryTimer) {
        clearInterval(telemetryTimer);
        telemetryTimer = null;
      }
    };
  }, []);
  return t;
}

/** Live value overlay for stat artifacts bound to liveSource 'telemetry'. */
function useLiveStatValue(a: StatArtifact): { value: string; stale: boolean } | null {
  const t = useTelemetry();
  if (!a.live || a.liveSource !== 'telemetry' || !t) return null;
  const stale = Date.now() - t.ts > 30_000;
  const pct = Math.round(Math.min(100, Math.max(0, t.level)));
  return { value: `${pct}%`, stale };
}

const TONE_COLOR: Record<string, string> = {
  ok: C.green, warn: C.amber, alert: C.red, info: C.cyan,
};

const CHART_COLORS = [C.cyan, C.purple, C.magenta, C.green, C.amber, '#67e8f9'];

function CornerTicks() {
  const t = { position: 'absolute' as const, width: 7, height: 7, borderColor: C.borderBright, borderStyle: 'solid' as const, opacity: 0.8 };
  return (
    <>
      <span style={{ ...t, top: -1, left: -1, borderWidth: '1px 0 0 1px' }} />
      <span style={{ ...t, top: -1, right: -1, borderWidth: '1px 1px 0 0' }} />
      <span style={{ ...t, bottom: -1, left: -1, borderWidth: '0 0 1px 1px' }} />
      <span style={{ ...t, bottom: -1, right: -1, borderWidth: '0 1px 1px 0' }} />
    </>
  );
}

export function ArtifactShell({
  title, source, createdAt, live, children, onExpand, onPin, onClose, compact,
}: {
  title: string;
  source?: string;
  createdAt?: number;
  live?: boolean;
  children: React.ReactNode;
  onExpand?: () => void;
  onPin?: () => void;
  onClose?: () => void;
  compact?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onExpand}
      style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}
    >
      {/* Starling swarm erupts from the panel's heart and draws the frame
          while the frosted glass fades in beneath it — canvas sits above
          the panel so the flock is visible against the live visualizer. */}
      <MurmurationGather count={compact ? 64 : 96} />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
        position: 'relative',
        background: 'linear-gradient(155deg, rgba(13,32,30,0.46) 0%, rgba(9,20,32,0.38) 52%, rgba(16,10,34,0.44) 100%)',
        backdropFilter: 'blur(22px) saturate(1.6)', WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
        border: `1px solid ${hover ? 'rgba(160,245,255,0.55)' : 'rgba(255,255,255,0.13)'}`,
        borderRadius: 10,
        padding: compact ? '8px 10px' : '10px 12px',
        cursor: onExpand ? 'pointer' : 'default',
        transition: 'border-color 0.2s ease, box-shadow 0.25s ease',
        boxShadow: hover
          ? '0 18px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(255,255,255,0.04), 0 0 30px rgba(103,232,249,0.14)'
          : '0 12px 38px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(255,255,255,0.03)',
        fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
        overflow: 'hidden',
      }}
      >
      <CornerTicks />
      {/* Starling murmuration — ambient flock drifting behind the panel. */}
      <MurmurationField density={compact ? 0.45 : 0.8} />
      {/* Glass sheen — top-light specular streak across the frosted surface. */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 22%, transparent 42%)',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {live && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}`, animation: 'pulse 1.4s infinite', flexShrink: 0 }} />
        )}
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.24em', color: C.cyan,
          fontFamily: MONO, textTransform: 'uppercase', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </span>
        <div style={{ display: 'flex', gap: 4, opacity: hover ? 1 : 0.35, transition: 'opacity 0.15s' }}
          onClick={(e) => e.stopPropagation()}>
          {onPin && (
            <button onClick={onPin} title="Pin to surface" style={iconBtn}><Pin size={10} /></button>
          )}
          {onExpand && (
            <button onClick={onExpand} title="Expand" style={iconBtn}><ExternalLink size={10} /></button>
          )}
          {onClose && (
            <button onClick={onClose} title="Close" style={iconBtn}><X size={10} /></button>
          )}
        </div>
      </div>
      {children}
      {(source || createdAt) && (
        <div style={{
          marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.border}`,
          fontSize: 8.5, letterSpacing: '0.14em', color: C.dim, fontFamily: MONO,
          display: 'flex', justifyContent: 'space-between', gap: 8,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source || ''}</span>
          {createdAt && (
            <span style={{ flexShrink: 0 }}>
              {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
      </div>
      </motion.div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: C.dim,
  padding: 3, display: 'flex', alignItems: 'center', borderRadius: 3,
};

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 120, h = 28, min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block', marginTop: 6, opacity: 0.9 }}>
      <polyline points={pts} fill="none" stroke={C.cyan} strokeWidth="1.2" />
    </svg>
  );
}

function StatBody({ a }: { a: StatArtifact }) {
  const live = useLiveStatValue(a);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          fontSize: 26, fontWeight: 300, color: live?.stale ? C.dim : C.text,
          fontFamily: MONO, letterSpacing: '-0.02em', transition: 'color 0.4s',
        }}>
          {live ? live.value : a.value}
        </span>
        {live && <span style={{ fontSize: 9, color: live.stale ? C.amber : C.green, fontFamily: MONO, letterSpacing: '0.16em' }}>{live.stale ? 'STALE' : 'LIVE'}</span>}
        {a.unit && <span style={{ fontSize: 11, color: C.dim, fontFamily: MONO }}>{a.unit}</span>}
        {a.delta && (
          <span style={{
            fontSize: 10, fontFamily: MONO, marginLeft: 'auto',
            color: a.delta.startsWith('-') ? C.red : a.delta.startsWith('+') ? C.green : C.dim,
          }}>{a.delta}</span>
        )}
      </div>
      {a.spark && <Sparkline data={a.spark} />}
    </div>
  );
}

function ChartBody({ a }: { a: ChartArtifact }) {
  // Merge all series into one row set keyed by x.
  const merged = new Map<string | number, Record<string, any>>();
  for (const s of a.series) {
    for (const p of s.points) {
      const key = String(p.x);
      const row = merged.get(key) ?? { x: p.x };
      row[s.name || 'value'] = p.y;
      merged.set(key, row);
    }
  }
  const rows = Array.from(merged.values()).slice(0, 200);
  const tooltipStyle = {
    background: 'rgba(4,8,14,0.92)', border: `1px solid ${C.borderBright}`, borderRadius: 4,
    fontSize: 10, fontFamily: MONO, color: C.text,
  } as const;

  if (a.chartType === 'pie') {
    const pieData = a.series[0]?.points.map((p, i) => ({ name: String(p.x), value: p.y, fill: CHART_COLORS[i % CHART_COLORS.length] })) ?? [];
    return (
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={28} outerRadius={58} paddingAngle={2} strokeWidth={0}>
              {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const common = (
    <>
      <CartesianGrid stroke="rgba(148,233,255,0.07)" vertical={false} />
      <XAxis dataKey="x" tick={{ fontSize: 9, fill: C.dim, fontFamily: MONO }} tickLine={false} axisLine={{ stroke: C.border }} interval="preserveStartEnd" />
      <YAxis tick={{ fontSize: 9, fill: C.dim, fontFamily: MONO }} tickLine={false} axisLine={false} width={34} />
      <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(148,233,255,0.25)' }} />
    </>
  );
  return (
    <div style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        {a.chartType === 'bar' ? (
          <BarChart data={rows}>{common}
            {a.series.map((s, i) => <Bar key={i} dataKey={s.name || `s${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[2, 2, 0, 0]} maxBarSize={22} />)}
          </BarChart>
        ) : a.chartType === 'area' ? (
          <AreaChart data={rows}>{common}
            {a.series.map((s, i) => <Area key={i} type="monotone" dataKey={s.name || `s${i}`} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.12} strokeWidth={1.5} />)}
          </AreaChart>
        ) : (
          <LineChart data={rows}>{common}
            {a.series.map((s, i) => <Line key={i} type="monotone" dataKey={s.name || `s${i}`} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={1.6} dot={false} />)}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function TableBody({ a }: { a: TableArtifact }) {
  return (
    <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: MONO }}>
        <thead>
          <tr>
            {a.columns.map((c, i) => (
              <th key={i} style={{
                textAlign: 'left', padding: '5px 8px', color: C.cyan,
                fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
                borderBottom: `1px solid ${C.borderBright}`, whiteSpace: 'nowrap',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {a.rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              {r.map((c, j) => (
                <td key={j} style={{ padding: '5px 8px', color: C.text, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImageBody({ a, fitHeight, fitSize }: { a: ImageArtifact; fitHeight?: number; fitSize?: { w: number; h: number } }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const aspect = a.aspect === '16:9' ? '16 / 9' : a.aspect === '4:3' ? '4 / 3' : '1 / 1';
  // Exact-size mode (hug panels): container matches the image's own aspect
  // ratio at the given pixel size — nothing is cropped, nothing letterboxed.
  if (fitSize) {
    return (
      <div style={{
        position: 'relative', width: fitSize.w, height: fitSize.h,
        borderRadius: 4, overflow: 'hidden', background: 'rgba(148,233,255,0.04)',
        border: `1px solid ${C.border}`, margin: '0 auto',
      }}>
        {state === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, letterSpacing: '0.22em', color: C.dim, fontFamily: MONO, textTransform: 'uppercase',
          }}>
            <span style={{ animation: 'pulse 1.2s infinite' }}>Materializing…</span>
          </div>
        )}
        {state === 'error' ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: C.red, fontFamily: MONO, padding: 12, textAlign: 'center',
          }}>Image unavailable</div>
        ) : (
          <img
            src={a.url}
            alt={a.prompt || a.title}
            onLoad={() => setState('ready')}
            onError={() => setState('error')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: state === 'ready' ? 'block' : 'none' }}
          />
        )}
      </div>
    );
  }
  const img = (
    <img
      src={a.url}
      alt={a.prompt || a.title}
      onLoad={() => setState('ready')}
      onError={() => setState('error')}
      style={fitHeight
        ? { maxWidth: '100%', maxHeight: fitHeight, objectFit: 'contain', display: state === 'ready' ? 'block' : 'none' }
        : { width: '100%', height: '100%', objectFit: 'cover', display: state === 'ready' ? 'block' : 'none' }}
    />
  );
  const prompt = a.prompt && (
    <div style={{ marginTop: 6, fontSize: 10, color: C.dim, fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
      “{a.prompt}”
    </div>
  );
  // Panel-constrained mode: show the WHOLE image fitted inside fitHeight
  // (letterboxed) instead of cropping a slice of a fixed-aspect box.
  if (fitHeight) {
    return (
      <div>
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 60, maxHeight: fitHeight, borderRadius: 4, overflow: 'hidden',
          background: 'rgba(148,233,255,0.04)', border: `1px solid ${C.border}`,
        }}>
          {state === 'loading' && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, letterSpacing: '0.22em', color: C.dim, fontFamily: MONO, textTransform: 'uppercase',
            }}>
              <span style={{ animation: 'pulse 1.2s infinite' }}>Materializing…</span>
            </div>
          )}
          {state === 'error' ? (
            <div style={{
              padding: 16, fontSize: 10, color: C.red, fontFamily: MONO, textAlign: 'center',
            }}>Image unavailable</div>
          ) : img}
        </div>
        {prompt}
      </div>
    );
  }
  return (
    <div>
      <div style={{
        position: 'relative', width: '100%', aspectRatio: aspect,
        borderRadius: 4, overflow: 'hidden', background: 'rgba(148,233,255,0.04)',
        border: `1px solid ${C.border}`,
      }}>
        {state === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, letterSpacing: '0.22em', color: C.dim, fontFamily: MONO, textTransform: 'uppercase',
          }}>
            <span style={{ animation: 'pulse 1.2s infinite' }}>Materializing…</span>
          </div>
        )}
        {state === 'error' ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: C.red, fontFamily: MONO, padding: 12, textAlign: 'center',
          }}>Image unavailable</div>
        ) : img}
      </div>
      {prompt}
    </div>
  );
}

function renderStyledMarkdown(markdownText: string, onToggleTodo?: (lineIndex: number) => void) {
  const lines = markdownText.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = (key: string) => {
    if (inList && listItems.length > 0) {
      renderedElements.push(
        <ul key={key} style={{ margin: '4px 0 8px 8px', padding: 0, listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const parseInline = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
    let lastIndex = 0;
    let match;
    let counter = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(<strong key={counter++} style={{ color: '#f8fafc', fontWeight: 700 }}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={counter++} style={{ background: 'rgba(103,232,249,0.12)', color: '#38bdf8', padding: '1px 5px', borderRadius: 3, fontFamily: MONO, fontSize: 10 }}>
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(<em key={counter++} style={{ color: '#94a3b8', fontStyle: 'italic' }}>{token.slice(1, -1)}</em>);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      flushList(`list-flush-${i}`);
      continue;
    }

    if (line === '---' || line === '***') {
      flushList(`list-hr-${i}`);
      renderedElements.push(
        <div key={`hr-${i}`} style={{ height: 1, background: 'linear-gradient(90deg, rgba(103,232,249,0.4), rgba(232,121,249,0.3) 60%, transparent)', margin: '10px 0' }} />
      );
      continue;
    }

    // Federal / SAM.gov Credentials Badge Box
    if (line.includes('SAM.gov') && (line.includes('UEI:') || line.includes('CAGE') || line.includes('Contractor'))) {
      flushList(`fed-badge-${i}`);
      renderedElements.push(
        <div key={`fed-${i}`} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,10,18,0.7))',
          border: '1px solid rgba(16,185,129,0.35)', borderRadius: 4, margin: '6px 0',
          fontSize: 9, fontFamily: MONO, color: '#34d399',
        }}>
          <span style={{ fontSize: 10 }}>🛡️</span>
          <span style={{ fontWeight: 700, letterSpacing: '0.12em' }}>ACTIVE FEDERAL CREDENTIAL:</span>
          <span>{parseInline(line.replace(/^[*-]\s+/, ''))}</span>
        </div>
      );
      continue;
    }

    // H1 Header
    if (line.startsWith('# ')) {
      flushList(`h1-${i}`);
      renderedElements.push(
        <div key={`h1-${i}`} style={{
          fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', color: '#f8fafc',
          textTransform: 'uppercase', paddingBottom: 4, marginTop: 4, marginBottom: 2,
          borderBottom: '2px solid rgba(103,232,249,0.5)',
        }}>
          {line.slice(2)}
        </div>
      );
      continue;
    }

    // H2 / H3 Header
    if (line.startsWith('## ') || line.startsWith('### ')) {
      flushList(`h3-${i}`);
      const text = line.replace(/^#{2,3}\s+/, '');
      renderedElements.push(
        <div key={`h3-${i}`} style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.cyan,
          textTransform: 'uppercase', marginTop: 10, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ color: C.magenta, fontSize: 10 }}>◈</span>
          <span>{text}</span>
        </div>
      );
      continue;
    }

    // H4 Header
    if (line.startsWith('#### ')) {
      flushList(`h4-${i}`);
      renderedElements.push(
        <div key={`h4-${i}`} style={{
          fontSize: 10.5, fontWeight: 600, color: '#e2e8f0', marginTop: 6, marginBottom: 2,
        }}>
          {parseInline(line.slice(5))}
        </div>
      );
      continue;
    }

    // Interactive Task / Checkbox item: - [ ] or - [x]
    const todoMatch = line.match(/^[-*•]\s+\[([ xX])\]\s+(.*)$/);
    if (todoMatch) {
      inList = true;
      const isChecked = todoMatch[1].toLowerCase() === 'x';
      const itemText = todoMatch[2];
      const lineIdx = i;
      listItems.push(
        <li
          key={`todo-${i}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleTodo?.(lineIdx);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 10.5,
            lineHeight: 1.5,
            color: isChecked ? '#64748b' : '#e2e8f0',
            textDecoration: isChecked ? 'line-through' : 'none',
            cursor: onToggleTodo ? 'pointer' : 'default',
            padding: '3px 6px',
            borderRadius: 4,
            background: isChecked ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
            transition: 'all 0.15s ease',
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1.5px solid ${isChecked ? '#10b981' : 'rgba(148, 233, 255, 0.5)'}`,
              background: isChecked ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              color: '#10b981',
              fontSize: 10,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {isChecked ? '✓' : ''}
          </span>
          <div style={{ flex: 1 }}>{parseInline(itemText)}</div>
        </li>
      );
      continue;
    }

    // Bullet item
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      inList = true;
      const itemText = line.replace(/^[-*•]\s+/, '');
      listItems.push(
        <li key={`li-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 10, lineHeight: 1.5, color: '#cbd5e1' }}>
          <span style={{ color: C.cyan, fontSize: 8, marginTop: 3 }}>▪</span>
          <div style={{ flex: 1 }}>{parseInline(itemText)}</div>
        </li>
      );
      continue;
    }

    // Normal paragraph
    flushList(`p-${i}`);
    renderedElements.push(
      <p key={`p-${i}`} style={{ margin: '3px 0 6px 0', fontSize: 10.5, lineHeight: 1.55, color: '#94a3b8' }}>
        {parseInline(line)}
      </p>
    );
  }
  flushList('final-flush');
  return renderedElements;
}

function DocumentBody({ a }: { a: DocumentArtifact }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'compiled' | 'raw'>('compiled');
  const [content, setContent] = useState(a.content);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const isHtml = a.format === 'html' || a.lang === 'html' || /<html[\s>]|<!DOCTYPE\s+html/i.test(content);
  const isPlaceholderHtml = content.trim() === '<html>...</html>' || content.trim() === '<html />' || (isHtml && content.trim().length < 50);
  const isSampleSite = isHtml && (a.title?.toLowerCase().includes('sample') || isPlaceholderHtml);

  const docxUrl = a.docxPath || (a.title.toLowerCase().includes('resume') ? '/docs/Chris_Stringer_Executive_Resume.docx' : null);
  const pdfUrl = a.pdfPath || (a.title.toLowerCase().includes('resume') ? '/docs/Chris_Stringer_Executive_Resume.pdf' : null);

  const handleToggleTodo = (lineIndex: number) => {
    const lines = content.split('\n');
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      let updatedLine = line;
      let isDone = false;
      let taskTitle = '';
      if (line.includes('- [ ]') || line.includes('* [ ]') || line.includes('• [ ]')) {
        updatedLine = line.replace(/([-*•]\s+)\[ \]/, '$1[x]');
        isDone = true;
        taskTitle = line.replace(/^[-*•]\s+\[ \]\s+/, '').trim();
      } else if (/[-*•]\s+\[[xX]\]/.test(line)) {
        updatedLine = line.replace(/([-*•]\s+)\[[xX]\]/, '$1[ ]');
        isDone = false;
        taskTitle = line.replace(/^[-*•]\s+\[[xX]\]\s+/, '').trim();
      }
      lines[lineIndex] = updatedLine;
      const updated = lines.join('\n');
      setContent(updated);
      a.content = updated;

      // Update surface panels in localStorage so it persists across views/reloads
      try {
        const raw = localStorage.getItem('cortex-surface-panels-v1');
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data?.panels)) {
            const panel = data.panels.find((p: any) => p?.artifact?.id === a.id || p?.id === a.id);
            if (panel && panel.artifact) {
              panel.artifact.content = updated;
              localStorage.setItem('cortex-surface-panels-v1', JSON.stringify(data));
            }
          }
        }
      } catch {}

      // Dispatch event for UI or calendar synchronization
      if (typeof window !== 'undefined' && taskTitle) {
        window.dispatchEvent(new CustomEvent('cortex-task-toggle', {
          detail: { title: taskTitle, done: isDone, line: lineIndex }
        }));
      }
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/cortex/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cortex-key': 'sovereign-local' },
        body: JSON.stringify({
          tool: 'create_document',
          args: {
            title: a.title || 'Document',
            format: 'docx',
            content,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveStatus('SAVED & RECOMPILED');
        setTimeout(() => {
          setEditing(false);
          setSaveStatus(null);
        }, 1200);
      } else {
        setSaveStatus('SAVE FAILED');
      }
    } catch {
      setSaveStatus('SAVE FAILED');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              width: '100%',
              minHeight: 280,
              maxHeight: 480,
              fontSize: 11,
              lineHeight: 1.55,
              color: '#f8fafc',
              fontFamily: MONO,
              background: 'rgba(5, 10, 20, 0.95)',
              borderRadius: 4,
              padding: '10px 12px',
              border: `1px solid ${C.cyan}`,
              outline: 'none',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                ...iconBtn,
                padding: '4px 10px',
                borderRadius: 3,
                background: 'rgba(34, 211, 238, 0.2)',
                border: `1px solid ${C.cyan}`,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.14em',
                fontFamily: MONO,
                color: C.cyan,
              }}
            >
              {saving ? 'COMPILING DOCX…' : saveStatus || 'SAVE & RECOMPILE'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(false); }}
              style={{
                ...iconBtn,
                padding: '4px 8px',
                borderRadius: 3,
                border: `1px solid ${C.border}`,
                fontSize: 9,
                fontFamily: MONO,
                color: C.dim,
              }}
            >
              CANCEL
            </button>
          </div>
        </div>
      ) : (
        <>
          {viewMode === 'compiled' ? (
            isHtml ? (
              <div
                style={{
                  width: '100%',
                  height: expanded ? '65vh' : 280,
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: `1px solid ${C.border}`,
                  background: '#0b0f19',
                }}
              >
                <iframe
                  src={isSampleSite ? '/sandbox/sample-website/index.html' : undefined}
                  srcDoc={isSampleSite ? undefined : content}
                  title={a.title || 'HTML Application'}
                  sandbox="allow-scripts allow-forms"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            ) : (
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.55,
                  color: C.text,
                  fontFamily: "'DM Sans', sans-serif",
                  maxHeight: expanded ? '65vh' : 220,
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 4,
                  padding: '10px 12px',
                  border: `1px solid ${C.border}`,
                }}
              >
                {renderStyledMarkdown(content, handleToggleTodo)}
              </div>
            )
          ) : (
            <pre
              style={{
                margin: 0,
                fontSize: 11,
                lineHeight: 1.55,
                color: C.text,
                fontFamily: MONO,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: expanded ? '65vh' : 220,
                overflow: 'auto',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 4,
                padding: '10px 12px',
                border: `1px solid ${C.border}`,
              }}
            >
              {content}
            </pre>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {content.length > 400 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                  style={{ ...iconBtn, fontSize: 9, letterSpacing: '0.14em', fontFamily: MONO, color: C.cyan }}
                >
                  {expanded ? 'COLLAPSE' : 'EXPAND'}
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setViewMode(viewMode === 'compiled' ? 'raw' : 'compiled'); }}
                style={{ ...iconBtn, fontSize: 9, letterSpacing: '0.14em', fontFamily: MONO, color: C.dim }}
              >
                {viewMode === 'compiled' ? 'RAW' : 'COMPILED'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                style={{ ...iconBtn, fontSize: 9, letterSpacing: '0.14em', fontFamily: MONO, color: C.green }}
              >
                EDIT IN PLACE
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {docxUrl && (
                <a
                  href={docxUrl}
                  download
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 9,
                    fontFamily: MONO,
                    color: '#38bdf8',
                    textDecoration: 'none',
                    padding: '2px 6px',
                    borderRadius: 3,
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    background: 'rgba(56, 189, 248, 0.08)',
                  }}
                >
                  DOWNLOAD .DOCX
                </a>
              )}
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 9,
                    fontFamily: MONO,
                    color: '#a78bfa',
                    textDecoration: 'none',
                    padding: '2px 6px',
                    borderRadius: 3,
                    border: '1px solid rgba(167, 139, 250, 0.3)',
                    background: 'rgba(167, 139, 250, 0.08)',
                  }}
                >
                  VIEW PDF
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── WeatherBody — animated condition-graded sky scene ────────────────────
// Pure CSS/SVG atmosphere: gradient sky, sun/moon disc, drifting cloud
// banks, rain/snow/fog layers — the "picture" weather panels were missing.
interface WxScene {
  sky: [string, string, string];       // top → mid → horizon
  sun: 'day' | 'night' | null;
  clouds: number;                      // 0-3 cloud banks
  rain: boolean; snow: boolean; fog: boolean; storm: boolean;
}

function weatherScene(cond?: string, period?: string): WxScene {
  const c = (cond || '').toLowerCase();
  const night = /tonight|night|evening/.test((period || '').toLowerCase()) || /clear|sunny/.test(c) === false && /night/.test(c);
  if (/thunder|storm|heavy rain|downpour/.test(c))
    return { sky: ['#0b0714', '#1b1030', '#2a1440'], sun: null, clouds: 3, rain: true, snow: false, fog: false, storm: true };
  if (/snow|flurr|sleet|wintry/.test(c))
    return { sky: ['#0e1626', '#22344f', '#3a5070'], sun: null, clouds: 2, rain: false, snow: true, fog: false, storm: false };
  if (/rain|shower|drizzle|precip/.test(c))
    return { sky: ['#0a1220', '#16283e', '#24405c'], sun: null, clouds: 3, rain: true, snow: false, fog: false, storm: false };
  if (/fog|haze|mist|smoky/.test(c))
    return { sky: ['#141c26', '#2a3644', '#47525e'], sun: null, clouds: 1, rain: false, snow: false, fog: true, storm: false };
  if (/overcast|cloudy|mostly cloudy/.test(c))
    return { sky: ['#10161f', '#1d2836', '#31435a'], sun: null, clouds: 3, rain: false, snow: false, fog: false, storm: false };
  if (/partly|mostly clear|mostly sunny/.test(c))
    return { sky: ['#0a1a33', '#14406b', '#2e6a96'], sun: night ? 'night' : 'day', clouds: 1, rain: false, snow: false, fog: false, storm: false };
  // clear / sunny / default
  return { sky: ['#050b1e', '#0d2b52', '#1e5a86'], sun: night ? 'night' : 'day', clouds: 0, rain: false, snow: false, fog: false, storm: false };
}

function WeatherBody({ a }: { a: WeatherArtifact }) {
  const scene = weatherScene(a.condition, a.period);
  const [skyTop, skyMid, skyHor] = scene.sky;
  return (
    <div className="cx-wx-scene" style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 6, overflow: 'hidden', minHeight: 150 }}>
      {/* Sky gradient */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${skyTop} 0%, ${skyMid} 52%, ${skyHor} 100%)` }} />
      {/* Sun / moon disc */}
      {scene.sun && (
        <div style={{
          position: 'absolute', top: '14%', right: '16%', width: 54, height: 54, borderRadius: '50%',
          background: scene.sun === 'day'
            ? 'radial-gradient(circle at 38% 35%, #fff7d6, #ffd76a 55%, #ff9d3c)'
            : 'radial-gradient(circle at 38% 35%, #f4f7ff, #b9c8e8 55%, #7d90c0)',
          boxShadow: scene.sun === 'day' ? '0 0 42px 14px rgba(255,205,110,0.45)' : '0 0 34px 10px rgba(190,205,255,0.35)',
          animation: 'cx-wx-bob 7s ease-in-out infinite',
        }} />
      )}
      {/* Cloud banks — soft blurred ellipses drifting */}
      {Array.from({ length: scene.clouds }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: `${12 + i * 16}%`, left: `${-10 + i * 8}%`,
          width: `${44 + i * 10}%`, height: 34 + i * 8,
          borderRadius: '50%',
          background: scene.storm || scene.rain
            ? 'radial-gradient(ellipse at center, rgba(30,36,52,0.85), rgba(30,36,52,0) 70%)'
            : 'radial-gradient(ellipse at center, rgba(220,232,255,0.28), rgba(220,232,255,0) 70%)',
          filter: 'blur(6px)',
          animation: `cx-wx-drift ${26 + i * 9}s linear infinite`,
          animationDelay: `${-i * 9}s`,
        }} />
      ))}
      {/* Precipitation layers */}
      {scene.rain && (
        <div style={{
          position: 'absolute', inset: '-20% 0 0 0',
          background: 'repeating-linear-gradient(105deg, transparent 0 7px, rgba(170,205,255,0.28) 7px 8px)',
          animation: 'cx-wx-rain 0.9s linear infinite',
        }} />
      )}
      {scene.snow && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(235,244,255,0.75) 1px, transparent 1.6px), radial-gradient(rgba(235,244,255,0.5) 1px, transparent 1.6px)',
          backgroundSize: '34px 34px, 58px 58px',
          backgroundPosition: '0 0, 17px 23px',
          animation: 'cx-wx-snow 7s linear infinite',
        }} />
      )}
      {scene.fog && (
        <div style={{
          position: 'absolute', inset: '30% 0 0 0',
          background: 'repeating-linear-gradient(180deg, transparent 0 26px, rgba(200,214,228,0.12) 26px 44px)',
          animation: 'cx-wx-fog 11s ease-in-out infinite alternate',
        }} />
      )}
      {/* Horizon haze */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '34%', background: 'linear-gradient(180deg, transparent, rgba(2,6,14,0.55))' }} />
      {/* Readout overlay */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {a.temp && (
            <span style={{
              fontSize: 40, fontWeight: 200, color: '#f2fbff', lineHeight: 1,
              fontFamily: MONO, letterSpacing: '-0.03em',
              textShadow: '0 2px 18px rgba(0,0,0,0.6)',
            }}>{a.temp}</span>
          )}
          <div style={{ paddingTop: 4 }}>
            {a.period && <div style={{ fontSize: 9, letterSpacing: '0.26em', color: 'rgba(190,225,255,0.75)', fontFamily: MONO, textTransform: 'uppercase' }}>{a.period}</div>}
            {a.condition && <div style={{ fontSize: 12, color: '#eaf4ff', fontWeight: 600, marginTop: 2, textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>{a.condition}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 9.5, color: 'rgba(200,224,255,0.85)', fontFamily: MONO, letterSpacing: '0.08em' }}>
            {[a.city, a.wind ? `wind ${a.wind}` : null].filter(Boolean).join(' · ')}
          </div>
          {a.summary && (
            <div style={{ fontSize: 8.5, color: 'rgba(170,200,230,0.6)', fontFamily: MONO, letterSpacing: '0.06em', maxWidth: '55%', textAlign: 'right', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {a.summary}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes cx-wx-drift { from { transform: translateX(-6%); } to { transform: translateX(112%); } }
        @keyframes cx-wx-rain { from { transform: translateY(-30%); } to { transform: translateY(30%); } }
        @keyframes cx-wx-snow { from { transform: translateY(-30px); } to { transform: translateY(30px); } }
        @keyframes cx-wx-fog { from { opacity: 0.5; transform: translateX(-2%); } to { opacity: 0.95; transform: translateX(2%); } }
        @keyframes cx-wx-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @media (prefers-reduced-motion: reduce) {
          .cx-wx-scene * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function FeedBody({ a }: { a: FeedArtifact }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {a.items.slice(0, 8).map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: TONE_COLOR[it.tone || 'info'] || C.cyan, flexShrink: 0 }} />
          <span style={{ color: C.dim, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
          <span style={{ color: C.text, fontFamily: MONO, fontSize: 10.5 }}>{it.value}</span>
        </div>
      ))}
      {a.items.length > 8 && (
        <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, letterSpacing: '0.14em', marginTop: 2 }}>
          +{a.items.length - 8} MORE
        </div>
      )}
    </div>
  );
}

function MapBody({ a, onOpenGlobe }: { a: Extract<CortexArtifact, { kind: 'map' }>; onOpenGlobe?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        border: `1px solid ${C.borderBright}`,
        background: 'radial-gradient(circle at 35% 35%, rgba(103,232,249,0.25), rgba(4,8,14,0.8))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: C.cyan,
      }}>◎</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {a.summary || 'Map view updated'}
        </div>
        <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, letterSpacing: '0.16em', marginTop: 2 }}>
          GLOBE // LIVE VIEW
        </div>
      </div>
      {onOpenGlobe && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenGlobe(); }}
          style={{
            ...iconBtn, border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 10px',
            fontSize: 9, letterSpacing: '0.2em', fontFamily: MONO, color: C.cyan,
          }}
        >OPEN</button>
      )}
    </div>
  );
}

export function ArtifactRenderer({
  artifact, onExpand, onPin, onClose, onOpenGlobe, compact, fitHeight, fitSize, bare,
}: {
  artifact: CortexArtifact;
  onExpand?: (a: CortexArtifact) => void;
  onPin?: (a: CortexArtifact) => void;
  onClose?: (a: CortexArtifact) => void;
  onOpenGlobe?: (a: CortexArtifact) => void;
  compact?: boolean;
  /** Panel-constrained image fit: whole image letterboxed to this px height. */
  fitHeight?: number;
  /** Hug-panel exact image box in px (aspect-matched, no crop/letterbox). */
  fitSize?: { w: number; h: number };
  /** When true, renders body directly without outer duplicate ArtifactShell title bar */
  bare?: boolean;
}) {
  const shell = (title: string, children: React.ReactNode) => (
    bare ? (
      <div style={{ position: 'relative', width: '100%' }}>
        <MurmurationGather />
        {children}
      </div>
    ) : (
      <ArtifactShell
        title={title}
        source={artifact.source}
        createdAt={artifact.createdAt}
        live={artifact.live}
        compact={compact}
        onExpand={onExpand ? () => onExpand(artifact) : undefined}
        onPin={onPin ? () => onPin(artifact) : undefined}
        onClose={onClose ? () => onClose(artifact) : undefined}
      >
        {children}
      </ArtifactShell>
    )
  );

  switch (artifact.kind) {
    case 'stat': return shell(artifact.title, <StatBody a={artifact} />);
    case 'chart': return shell(artifact.title, <ChartBody a={artifact} />);
    case 'table': return shell(artifact.title, <TableBody a={artifact} />);
    case 'image': return fitSize
      ? <ImageBody a={artifact} fitSize={fitSize} />
      : shell(artifact.title, <ImageBody a={artifact} fitHeight={fitHeight} />);
    case 'document': return shell(artifact.title, <DocumentBody a={artifact} />);
    case 'feed': return shell(artifact.title, <FeedBody a={artifact} />);
    case 'map': return shell(artifact.title, <MapBody a={artifact} onOpenGlobe={onOpenGlobe ? () => onOpenGlobe(artifact) : undefined} />);
    case 'weather': return shell(artifact.title, <WeatherBody a={artifact} />);
    default: return null;
  }
}

export default ArtifactRenderer;
