/**
 * CortexTimelineScene — TVA Sacred Timeline, horizontal edition.
 *
 * Loki-style: glowing strands stretch left→right — past on the left,
 * NOW gate on the right — stacked in depth like the TVA wall. Each
 * strand is a real stream from /api/cortex/replay; each node a real
 * event positioned by timestamp on a shared global time axis. Forks
 * mark pruned branches at significant events. Nothing fabricated.
 *
 * Intro: the core's event-orbs detonate from center and lock onto
 * their strand positions, igniting the timeline left→right.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cortexSpeak } from '../../lib/cortex-speech';

// ── Types ────────────────────────────────────────────────────────────────

interface ReplayEvent {
  seq?: number;
  ts?: number;
  type: string;
  agentId?: string | null;
  taskId?: string;
  summary?: string;
}

interface StrandEvent {
  ev: ReplayEvent;
  x: number;          // 0..1 normalized time → screen x
  significant: boolean;
  warn: boolean;
}

interface Strand {
  id: string;
  label: string;
  color: string;
  depth: number;      // 0 = nearest/bottom, 1 = farthest/top
  phase: number;
  events: StrandEvent[];
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  delay: number;
  target: { x: number; y: number } | null;
  ev: StrandEvent | null;
  strandIdx: number;
}

interface Fork {
  strand: number;
  evX: number;        // normalized x of fork origin
  dir: 1 | -1;
  seed: number;
}

// ── Constants ────────────────────────────────────────────────────────────

const STRAND_COLORS = ['#67e8f9', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#7dd3fc', '#e879f9'];
const GOLD = '#fbbf24';
const WARN = '#fb923c';
const DIM = 'rgba(148,163,184,0.55)';
const MONO = "'IBM Plex Mono', monospace";

const SIGNIFICANT_RE = /fail|error|incident|verdict|cleared|milestone|completed|approved|rejected|crash|stall|alert/i;
const WARN_RE = /warn|retry|timeout|degrad|pressure|truncat/i;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ── Strand geometry: horizontal, left→right, depth-stacked ──────────────
// xNorm: 0 = far left (oldest), 1 = NOW gate (right edge).
// Returns screen y for a strand at normalized time xNorm — gentle
// organic wave + subtle convergence toward the horizon on the right.

function strandY(s: Strand, xNorm: number, w: number, h: number): number {
  const horizonY = h * (0.30 + s.depth * 0.10);          // far strands sit higher
  const nearY = h * (0.78 - s.depth * 0.34);             // near strands lower
  const base = nearY + (horizonY - nearY) * Math.pow(xNorm, 1.6);
  const wave = Math.sin(xNorm * 9 + s.phase) * h * 0.012 * (1 - s.depth * 0.5);
  const wave2 = Math.sin(xNorm * 23 + s.phase * 2.7) * h * 0.006;
  return base + wave + wave2;
}

function strandX(xNorm: number, w: number): number {
  const left = w * 0.07;
  const right = w * 0.86; // leave right ~14% for the NOW gate
  return left + xNorm * (right - left);
}

function strandThickness(s: Strand): number {
  return 2.6 - s.depth * 1.4; // far strands thinner
}

function strandAlpha(s: Strand): number {
  return 0.85 - s.depth * 0.45;
}

// ── Data shaping ─────────────────────────────────────────────────────────

function shapeStrands(events: ReplayEvent[]): { strands: Strand[]; forks: Fork[]; spanMs: number } {
  const buckets = new Map<string, ReplayEvent[]>();
  for (const ev of events) {
    const key = ev.agentId || (ev.type && ev.type !== 'unknown' ? `sys:${ev.type}` : 'fleet');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(ev);
  }
  const sorted = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length);
  const top = sorted.slice(0, 7);

  // Global time axis shared by all strands.
  const allT = events.map((e) => e.ts ?? e.seq ?? 0).filter((v) => v > 0);
  const gMin = allT.length ? Math.min(...allT) : 0;
  const gMax = allT.length ? Math.max(...allT) : 1;
  const gSpan = Math.max(1, gMax - gMin);

  const strands: Strand[] = top.map(([id, evs], i) => {
    let items: StrandEvent[] = evs.map((ev) => {
      const t = ev.ts ?? ev.seq ?? gMin;
      const x = Math.min(0.985, Math.max(0.015, (t - gMin) / gSpan));
      const text = `${ev.type} ${ev.summary || ''}`;
      return { ev, x, significant: SIGNIFICANT_RE.test(text), warn: WARN_RE.test(text) };
    }).sort((a, b) => a.x - b.x);

    // Cap dense streams — keep significant, uniform-sample the rest.
    const MAX_NODES = 64;
    if (items.length > MAX_NODES) {
      const sig = items.filter((e) => e.significant || e.warn);
      const rest = items.filter((e) => !(e.significant || e.warn));
      const keepRest = Math.max(10, MAX_NODES - sig.length);
      const stride = rest.length / keepRest;
      const sampled = Array.from({ length: keepRest }, (_, i) => rest[Math.floor(i * stride)]);
      items = [...sig, ...sampled].sort((a, b) => a.x - b.x);
    }

    return {
      id,
      label: id.replace(/^sys:/, '').slice(0, 14).toUpperCase(),
      color: STRAND_COLORS[i % STRAND_COLORS.length],
      depth: i / Math.max(1, top.length - 1),
      phase: (hashStr(id) % 628) / 100,
      events: items,
    };
  });

  const forks: Fork[] = strands.flatMap((s, si) =>
    s.events.filter((e) => e.significant).slice(0, 2).map((e) => ({
      strand: si,
      evX: e.x,
      dir: (hashStr(s.id + e.x) & 1) === 0 ? 1 : -1,
      seed: hashStr(s.id + ':' + e.x),
    }))
  );

  const spanMs = allT.length > 1 ? Math.max(...allT) - Math.min(...allT) : 0;
  return { strands, forks, spanMs };
}

// ── Component ────────────────────────────────────────────────────────────

export function CortexTimelineScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<ReplayEvent[] | null>(null);
  const [selected, setSelected] = useState<{ strand: number; ev: StrandEvent; x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const parRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const reduced = useRef(false);

  useEffect(() => {
    let dead = false;
    const load = () => {
      fetch('/api/cortex/replay?limit=500')
        .then((r) => r.json())
        .then((d) => { if (!dead) setEvents(Array.isArray(d?.events) ? d.events : []); })
        .catch(() => { if (!dead) setEvents([]); });
    };
    load();
    const id = setInterval(load, 45_000);
    return () => { dead = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    reduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      parRef.current.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      parRef.current.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);

  const { strands, forks, spanMs } = useMemo(() => shapeStrands(events ?? []), [events]);
  const totalEvents = strands.reduce((n, s) => n + s.events.length, 0);
  const spanLabel = spanMs > 0
    ? spanMs > 3600_000 ? `${(spanMs / 3600_000).toFixed(1)}h` : `${Math.max(1, Math.round(spanMs / 60_000))}m`
    : '—';

  // Precompute node screen positions for particles + hit-testing.
  const nodePos = useMemo(() => {
    if (!size.w || !size.h) return new Map<string, { x: number; y: number }>();
    const map = new Map<string, { x: number; y: number }>();
    strands.forEach((s, si) => {
      s.events.forEach((ev, ei) => {
        map.set(`${si}:${ei}`, {
          x: strandX(ev.x, size.w),
          y: strandY(s, ev.x, size.w, size.h),
        });
      });
    });
    return map;
  }, [strands, size]);

  // ── Render loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !size.w || !size.h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = size.w * dpr;
    cv.height = size.h * dpr;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const start = performance.now();
    const EXPLODE_MS = 2600;
    let raf = 0;

    // Explosion particles: significant events first, assigned to nodes.
    const particles: Particle[] = [];
    const flat: { si: number; ei: number; s: Strand; ev: StrandEvent }[] = [];
    strands.forEach((s, si) => s.events.forEach((ev, ei) => flat.push({ si, ei, s, ev })));
    flat.sort((a, b) => Number(b.ev.significant) - Number(a.ev.significant) || a.ev.x - b.ev.x);
    const cx0 = size.w / 2, cy0 = size.h * 0.45;
    flat.slice(0, 60).forEach((f, i) => {
      const ang = (i / 60) * Math.PI * 2 + (hashStr(f.ev.ev.type + i) % 100) / 100;
      const sp = 2.4 + (hashStr(f.ev.ev.summary || '') % 40) / 16;
      const tgt = nodePos.get(`${f.si}:${f.ei}`);
      particles.push({
        x: cx0, y: cy0,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.7 - 0.4,
        life: 0,
        delay: (i % 15) * 70 + Math.floor(i / 15) * 150,
        target: tgt ?? null,
        ev: f.ev,
        strandIdx: f.si,
      });
    });

    const draw = (nowMs: number) => {
      const t = (nowMs - start) / 1000;
      const explodeT = Math.min(1, (nowMs - start) / EXPLODE_MS);
      const w = size.w, h = size.h;
      parRef.current.x += (parRef.current.tx - parRef.current.x) * 0.04;
      parRef.current.y += (parRef.current.ty - parRef.current.y) * 0.04;
      const px = parRef.current.x * 10, py = parRef.current.y * 6;

      // Background void + starfield
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(w * 0.55, h * 0.4, 0, w * 0.55, h * 0.5, Math.max(w, h) * 0.8);
      bg.addColorStop(0, 'rgba(9,14,30,0.92)');
      bg.addColorStop(0.6, 'rgba(3,6,16,0.97)');
      bg.addColorStop(1, 'rgba(1,2,8,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      for (let i = 0; i < 120; i++) {
        const sx = ((hashStr('sx' + i) % 1000) / 1000) * w;
        const sy = ((hashStr('sy' + i) % 1000) / 1000) * h;
        const tw = 0.25 + 0.55 * Math.abs(Math.sin(t * 0.6 + i));
        ctx.fillStyle = `rgba(148,197,255,${(tw * 0.3).toFixed(3)})`;
        ctx.fillRect(sx, sy, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
      }
      ctx.restore();

      const n = strands.length;
      if (n === 0) {
        drawGate(ctx, w, h, t, explodeT);
        raf = requestAnimationFrame(draw);
        return;
      }

      // Depth order: far strands first (painter's algorithm).
      const order = strands.map((_, i) => i).sort((a, b) => strands[b].depth - strands[a].depth);

      // ── Strands: horizontal polylines, ignite wave left→right ──
      for (const si of order) {
        const s = strands[si];
        const igniteDelay = si * 0.18;
        const prog = reduced.current ? 1 : Math.min(1, Math.max(0, (explodeT * 1.4 - igniteDelay) / 0.75));
        if (prog <= 0) continue;
        const drawToX = 0.05 + prog * 0.9;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = strandAlpha(s) * 0.55 * prog;
        ctx.lineWidth = strandThickness(s) * 1.8;
        ctx.beginPath();
        const STEPS = 90;
        for (let k = 0; k <= STEPS * drawToX; k++) {
          const xn = k / STEPS;
          const X = strandX(xn, w) + px;
          const Y = strandY(s, xn, w, h) + py;
          if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        }
        ctx.stroke();
        // bright core
        ctx.shadowBlur = 0;
        ctx.globalAlpha = strandAlpha(s) * 0.9 * prog;
        ctx.strokeStyle = 'rgba(240,253,255,0.85)';
        ctx.lineWidth = Math.max(0.6, strandThickness(s) * 0.45);
        ctx.stroke();
        ctx.restore();
      }

      // ── Forks (pruned branches) — curve up/down from significant nodes ──
      for (const f of forks) {
        const s = strands[f.strand];
        if (!s) continue;
        const xn = f.evX;
        const localT = Math.min(1, Math.max(0, (explodeT * 1.4 - f.strand * 0.18) / 0.75));
        if (xn > 0.05 + localT * 0.9) continue;
        const bx = strandX(xn, w) + px;
        const by = strandY(s, xn, w, h) + py;
        const len = h * (0.10 + (f.seed % 7) / 100);
        const ex = bx + len * 1.4;
        const ey = by + f.dir * len * (0.7 + (f.seed % 5) / 10);
        ctx.save();
        ctx.strokeStyle = 'rgba(244,114,182,0.55)';
        ctx.shadowColor = '#f472b6';
        ctx.shadowBlur = 9;
        ctx.lineWidth = 1.1;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + len * 0.7, by + f.dir * len * 0.25, ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(244,114,182,0.85)';
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(ex, ey, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // ── Event nodes (depth order) ──
      for (const si of order) {
        const s = strands[si];
        s.events.forEach((ev, ei) => {
          const localT = Math.min(1, Math.max(0, (explodeT * 1.4 - si * 0.18) / 0.75));
          if (ev.x > 0.05 + localT * 0.9) return;
          const p = nodePos.get(`${si}:${ei}`);
          if (!p) return;
          const X = p.x + px, Y = p.y + py;
          const dim = 0.4 + (1 - s.depth) * 0.6;
          const col = ev.significant ? GOLD : ev.warn ? WARN : s.color;
          const r = (ev.significant ? 3.2 : 2.0) * (1.15 - s.depth * 0.5);
          const pulse = reduced.current ? 0.8 : 0.65 + 0.35 * Math.sin(t * 2.2 + ev.x * 18 + si);
          ctx.save();
          ctx.globalAlpha = dim * pulse;
          ctx.shadowColor = col;
          ctx.shadowBlur = ev.significant ? 15 : 8;
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath(); ctx.arc(X, Y, r * 0.36, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        });
      }

      // ── Explosion particles → capture to nodes ──
      if (explodeT < 1 || particles.some((p) => p.life < 1)) {
        for (const p of particles) {
          const pt = (nowMs - start - p.delay) / 1000;
          if (pt < 0 || !p.target || !p.ev) continue;
          if (pt < 0.9) {
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.94; p.vy = p.vy * 0.94 + 0.05;
            p.life = Math.min(1, pt / 0.9);
            ctx.save();
            ctx.globalAlpha = (1 - p.life * 0.4) * 0.9;
            ctx.shadowColor = p.ev.significant ? GOLD : strands[p.strandIdx]?.color || '#67e8f9';
            ctx.shadowBlur = 11;
            ctx.fillStyle = p.ev.significant ? GOLD : '#e0f2fe';
            ctx.beginPath(); ctx.arc(p.x, p.y, 2.5 * (1 - p.life * 0.5), 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          } else {
            const cap = Math.min(1, (pt - 0.9) / 0.7);
            const e2 = 1 - Math.pow(1 - cap, 3);
            const X = p.x + (p.target.x + px - p.x) * e2;
            const Y = p.y + (p.target.y + py - p.y) * e2;
            ctx.save();
            ctx.globalAlpha = e2 * 0.95;
            ctx.shadowColor = p.ev.significant ? GOLD : strands[p.strandIdx]?.color || '#67e8f9';
            ctx.shadowBlur = 13;
            ctx.fillStyle = p.ev.significant ? GOLD : '#e0f2fe';
            ctx.beginPath(); ctx.arc(X, Y, 2.6, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            if (cap >= 1) p.life = 1;
          }
        }
      }

      // ── NOW gate: vertical TVA chevrons at right ──
      drawGate(ctx, w, h, t, explodeT);

      // ── Strand labels at left edge ──
      strands.forEach((s, si) => {
        const localT = Math.min(1, Math.max(0, (explodeT * 1.4 - si * 0.18) / 0.75));
        if (localT < 0.35) return;
        const yMid = strandY(s, 0.03, w, h) + py;
        ctx.save();
        ctx.font = `8.5px ${MONO}`;
        ctx.fillStyle = s.color;
        ctx.globalAlpha = 0.7;
        ctx.textAlign = 'left';
        ctx.fillText(s.label, 14, yMid);
        ctx.restore();
      });

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [strands, forks, nodePos, size, reduced]);

  // ── Hit testing ──
  const pickNode = (mx: number, my: number) => {
    const el = wrapRef.current;
    if (!el || strands.length === 0) return null;
    let best: { strand: number; ev: StrandEvent; d: number; x: number; y: number } | null = null;
    strands.forEach((s, si) => {
      s.events.forEach((ev, ei) => {
        const p = nodePos.get(`${si}:${ei}`);
        if (!p) return;
        const d = Math.hypot(p.x - mx, p.y - my);
        if (d < 14 && (!best || d < best.d)) best = { strand: si, ev, d, x: p.x, y: p.y };
      });
    });
    return best;
  };

  const onClick = (e: React.MouseEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const hit = pickNode(e.clientX - r.left, e.clientY - r.top);
    if (hit) {
      setSelected({ strand: hit.strand, ev: hit.ev, x: hit.x, y: hit.y });
      cortexSpeak?.(`Event: ${hit.ev.ev.type}.`);
    } else {
      setSelected(null);
    }
  };

  const onMove = (e: React.MouseEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const hit = pickNode(e.clientX - r.left, e.clientY - r.top);
    e.currentTarget.style.cursor = hit ? 'pointer' : 'default';
  };

  const selEv = selected ? selected.ev.ev : null;
  const selStrand = selected ? strands[selected.strand] : null;

  return (
    <div
      ref={wrapRef}
      onClick={onClick}
      onMouseMove={onMove}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#02030a' }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* HUD header */}
      <div style={{ position: 'absolute', top: 84, left: 64, zIndex: 8, pointerEvents: 'none' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.5em', color: '#67e8f9', fontFamily: MONO, fontWeight: 800 }}>
          ⌛ TVA // SACRED TIMELINE
        </div>
        <div style={{ fontSize: 9, letterSpacing: '0.22em', color: DIM, fontFamily: MONO, marginTop: 5 }}>
          {strands.length} BRANCHES · {totalEvents} EVENTS · SPAN {spanLabel}
          {forks.length > 0 ? ` · ${forks.length} PRUNED` : ''}
        </div>
      </div>

      {/* Strand legend — bottom left */}
      {strands.length > 0 && (
        <div style={{
          position: 'absolute', left: 64, bottom: 90, zIndex: 8, pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {strands.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 14, height: 1.5, background: s.color, boxShadow: `0 0 6px ${s.color}`, opacity: 0.9 }} />
              <span style={{ fontSize: 8.5, letterSpacing: '0.18em', color: DIM, fontFamily: MONO }}>
                {s.label} · {s.events.length}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* NOW marker — right side */}
      <div style={{
        position: 'absolute', right: 56, top: '50%', transform: 'translateY(-50%)',
        zIndex: 8, pointerEvents: 'none', textAlign: 'center',
      }}>
        <div style={{
          fontSize: 9, letterSpacing: '0.4em', color: '#e0f2fe', fontFamily: MONO, fontWeight: 800,
          textShadow: '0 0 14px rgba(103,232,249,0.8)', writingMode: 'vertical-rl',
        }}>◈ NOW</div>
        <div style={{ width: 1, height: 90, margin: '8px auto 0', background: 'linear-gradient(180deg, transparent, #67e8f9, transparent)' }} />
      </div>

      {/* Time direction hint */}
      <div style={{
        position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)',
        zIndex: 8, pointerEvents: 'none',
        fontSize: 8.5, letterSpacing: '0.4em', color: 'rgba(148,163,184,0.4)', fontFamily: MONO,
      }}>
        PAST ◂——————— TIME ———————▸ FUTURE
      </div>

      {/* Event detail card */}
      {selected && selEv && selStrand && (
        <div style={{
          position: 'absolute',
          left: Math.min(Math.max(selected.x + 16, 20), (size.w || 800) - 300),
          top: Math.min(Math.max(selected.y - 20, 110), (size.h || 600) - 160),
          zIndex: 12, width: 280, pointerEvents: 'auto',
          border: '1px solid rgba(103,232,249,0.35)', borderRadius: 3,
          background: 'rgba(4,8,18,0.92)', backdropFilter: 'blur(10px)',
          padding: '10px 12px', boxShadow: '0 0 30px rgba(103,232,249,0.15)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: '0.24em', color: selStrand.color, fontFamily: MONO, fontWeight: 800 }}>
              {selStrand.label}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setSelected(null); }}
              style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 11, fontFamily: MONO }}
            >✕</button>
          </div>
          <div style={{ fontSize: 11, color: '#e0f2fe', fontFamily: MONO, fontWeight: 700, marginBottom: 4 }}>
            {selEv.type}
          </div>
          {selEv.summary && (
            <div style={{ fontSize: 9.5, color: 'rgba(203,213,225,0.85)', fontFamily: MONO, lineHeight: 1.5, marginBottom: 6 }}>
              {selEv.summary}
            </div>
          )}
          <div style={{ fontSize: 8.5, color: DIM, fontFamily: MONO, letterSpacing: '0.12em' }}>
            {selEv.ts ? new Date(selEv.ts).toLocaleString() : `SEQ ${selEv.seq ?? '—'}`}
            {selEv.agentId ? ` · ${selEv.agentId}` : ''}
          </div>
        </div>
      )}

      {/* Empty state */}
      {events !== null && strands.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.4em', color: 'rgba(103,232,249,0.6)', fontFamily: MONO }}>
              NO EVENTS ON RECORD
            </div>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: DIM, fontFamily: MONO, marginTop: 8 }}>
              THE TIMELINE AWAITS ITS FIRST BRANCH
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TVA NOW gate ─────────────────────────────────────────────────────────

function drawGate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  explodeT: number,
) {
  const gx = w * 0.93;
  const gy = h * 0.52;
  const breathe = 0.75 + 0.25 * Math.sin(t * 1.4);
  const R = Math.min(w, h) * 0.075 * (0.6 + explodeT * 0.4);

  ctx.save();
  ctx.translate(gx, gy);

  const glow = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 2.8);
  glow.addColorStop(0, `rgba(103,232,249,${0.2 * breathe})`);
  glow.addColorStop(1, 'rgba(103,232,249,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, R * 2.8, 0, Math.PI * 2); ctx.fill();

  // Vertical TVA chevrons « » rotated for the horizontal timeline
  ctx.strokeStyle = '#67e8f9';
  ctx.shadowColor = '#67e8f9';
  ctx.shadowBlur = 18 * breathe;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  const a = R * 0.62;
  const gap = R * 0.34;
  // top chevron ∧
  ctx.beginPath();
  ctx.moveTo(-a, gap); ctx.lineTo(0, -a * 0.4); ctx.lineTo(a, gap);
  ctx.stroke();
  // bottom chevron ∨
  ctx.beginPath();
  ctx.moveTo(-a, -gap); ctx.lineTo(0, a * 0.4); ctx.lineTo(a, -gap);
  ctx.stroke();
  // core dot
  ctx.fillStyle = 'rgba(224,242,254,0.95)';
  ctx.shadowBlur = 22;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.1 * breathe, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}
