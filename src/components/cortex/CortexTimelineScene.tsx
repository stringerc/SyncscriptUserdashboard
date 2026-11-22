/**
 * CortexTimelineScene — TVA Sacred Timeline.
 *
 * The Sovereign Core's hero orb detonates into a fan of event-orbs that
 * lock onto strand paths and ignite the timeline. Each strand is a real
 * data stream from /api/cortex/replay (agentId buckets); each node is a
 * real logged event positioned by timestamp. Forks mark pruned/alternate
 * branches (error & incident events). Nothing is fabricated — empty
 * streams simply don't render.
 *
 * Rendered inside the visualizer face swap: clicking TIMELINE mounts this
 * scene (orb explosion intro), clicking CORE unmounts it (face transition
 * fades back to the sanctum).
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
  u: number;          // 0 = far/deep past, 1 = near gate (now)
  significant: boolean;
  warn: boolean;
}

interface Strand {
  id: string;
  label: string;
  color: string;
  events: StrandEvent[];
  forkAt: number[];   // strand-param positions where a pruned branch forks
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  tx: number; ty: number;   // target = assigned event node
  life: number;             // 0..1 progress
  delay: number;
  hue: number;
  strand: number;
}

interface Fork {
  strand: number;
  u: number;
  dir: 1 | -1;
  len: number;
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

// ── Strand geometry: cubic bezier gate → vanishing point ─────────────────

interface StrandGeom { p0: Pt; c1: Pt; c2: Pt; p1: Pt }
interface Pt { x: number; y: number }

function strandGeom(i: number, n: number, w: number, h: number, par: { x: number; y: number }): StrandGeom {
  const cx = w / 2 + par.x * 18;
  const spread = Math.min(w * 0.16, 190);
  const off = (i - (n - 1) / 2) * spread * 1.9;
  const gateY = h * 0.9;
  const vpY = h * 0.34 + par.y * 10;
  return {
    p0: { x: cx + off * 0.16 + par.x * 10, y: gateY },
    c1: { x: cx + off * 0.72, y: h * 0.72 },
    c2: { x: cx + off * 1.15, y: vpY + h * 0.16 },
    p1: { x: cx + off * 0.5 + par.x * 6, y: vpY },
  };
}

function cubic(g: StrandGeom, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * g.p0.x + 3 * u * u * t * g.c1.x + 3 * u * t * t * g.c2.x + t * t * t * g.p1.x,
    y: u * u * u * g.p0.y + 3 * u * u * t * g.c1.y + 3 * u * t * t * g.c2.y + t * t * t * g.p1.y,
  };
}

function cubicTan(g: StrandGeom, t: number): Pt {
  const u = 1 - t;
  return {
    x: 3 * u * u * (g.c1.x - g.p0.x) + 6 * u * t * (g.c2.x - g.c1.x) + 3 * t * t * (g.p1.x - g.c2.x),
    y: 3 * u * u * (g.c1.y - g.p0.y) + 6 * u * t * (g.c2.y - g.c1.y) + 3 * t * t * (g.p1.y - g.c2.y),
  };
}

// ── Data shaping ─────────────────────────────────────────────────────────

function shapeStrands(events: ReplayEvent[]): { strands: Strand[]; forks: Fork[]; spanMs: number } {
  // Bucket events by agentId; keep the busiest streams as strands.
  const buckets = new Map<string, ReplayEvent[]>();
  for (const ev of events) {
    const key = ev.agentId || (ev.type && ev.type !== 'unknown' ? `sys:${ev.type}` : 'fleet');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(ev);
  }
  const sorted = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length);
  const top = sorted.slice(0, 7);
  // Global time axis — strands must share depth, not normalize per-stream.
  const allT = events.map((e) => e.ts ?? e.seq ?? 0).filter((v) => v > 0);
  const gMin = allT.length ? Math.min(...allT) : 0;
  const gMax = allT.length ? Math.max(...allT) : 1;
  const gSpan = Math.max(1, gMax - gMin);
  const strands: Strand[] = top.map(([id, evs], i) => {
    let items: StrandEvent[] = evs.map((ev) => {
      const t = ev.ts ?? ev.seq ?? gMin;
      const u = Math.min(0.96, Math.max(0.06, 1 - (t - gMin) / gSpan)); // newest → near gate
      const text = `${ev.type} ${ev.summary || ''}`;
      return { ev, u, significant: SIGNIFICANT_RE.test(text), warn: WARN_RE.test(text) };
    }).sort((a, b) => a.u - b.u);
    // Cap dense streams (e.g. model.health pings): keep every significant
    // event, uniform-sample the rest so no strand becomes a blob.
    const MAX_NODES = 72;
    if (items.length > MAX_NODES) {
      const sig = items.filter((e) => e.significant || e.warn);
      const rest = items.filter((e) => !(e.significant || e.warn));
      const keepRest = Math.max(12, MAX_NODES - sig.length);
      const stride = rest.length / keepRest;
      const sampled = Array.from({ length: keepRest }, (_, i) => rest[Math.floor(i * stride)]);
      items = [...sig, ...sampled].sort((a, b) => a.u - b.u);
    }
    return {
      id,
      label: id.replace(/^sys:/, '').slice(0, 14).toUpperCase(),
      color: STRAND_COLORS[i % STRAND_COLORS.length],
      events: items,
      forkAt: items.filter((e) => e.significant).slice(0, 2).map((e) => e.u),
    };
  });
  const forks: Fork[] = strands.flatMap((s, si) =>
    s.forkAt.map((u, fi) => ({
      strand: si, u,
      dir: (hashStr(s.id + fi) & 1) === 0 ? 1 : -1,
      len: 0.1 + ((hashStr(s.id) >>> 4) % 10) / 100,
      seed: hashStr(s.id + ':' + fi),
    }))
  );
  const allTs = events.map((e) => e.ts ?? 0).filter((v) => v > 0);
  const spanMs = allTs.length > 1 ? Math.max(...allTs) - Math.min(...allTs) : 0;
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
  const hoverRef = useRef<{ strand: number; ev: StrandEvent; x: number; y: number } | null>(null);
  const reduced = useRef(false);

  // Load replay events (real data only); refresh every 45s.
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

  // Canvas sizing + reduced-motion probe
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    reduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    return () => ro.disconnect();
  }, []);

  // Mouse parallax
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

  const { strands, forks, spanMs } = useMemo(
    () => shapeStrands(events ?? []),
    [events]
  );

  const totalEvents = strands.reduce((n, s) => n + s.events.length, 0);
  const spanLabel = spanMs > 0
    ? spanMs > 3600_000 ? `${(spanMs / 3600_000).toFixed(1)}h` : `${Math.max(1, Math.round(spanMs / 60_000))}m`
    : '—';

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
    let raf = 0;
    const EXPLODE_MS = 2400;

    // Precompute explosion particles → assigned event nodes (significant first)
    const particles: Particle[] = [];
    const flat: { strand: number; ev: StrandEvent }[] = [];
    strands.forEach((s, si) => s.events.forEach((ev) => flat.push({ strand: si, ev })));
    flat.sort((a, b) => Number(b.ev.significant) - Number(a.ev.significant) || a.ev.u - b.ev.u);
    const cx0 = size.w / 2, cy0 = size.h * 0.62;
    flat.slice(0, 56).forEach((f, i) => {
      const ang = (i / 56) * Math.PI * 2 + hashStr(f.ev.ev.type + i) * 0.1;
      const sp = 2.2 + (hashStr(f.ev.ev.summary || '') % 40) / 18;
      particles.push({
        x: cx0, y: cy0,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.7 - 0.6,
        tx: 0, ty: 0,
        life: 0,
        delay: (i % 14) * 90 + Math.floor(i / 14) * 160,
        hue: f.ev.significant ? 38 : 190,
        strand: f.strand,
      });
      // stash target event ref via strand+index trick: store on particle later
      (particles[particles.length - 1] as any).__ev = f.ev;
      (particles[particles.length - 1] as any).__strand = f.strand;
    });

    const draw = (nowMs: number) => {
      const t = (nowMs - start) / 1000;
      const explodeT = Math.min(1, (nowMs - start) / EXPLODE_MS);
      const w = size.w, h = size.h;
      parRef.current.x += (parRef.current.tx - parRef.current.x) * 0.04;
      parRef.current.y += (parRef.current.ty - parRef.current.y) * 0.04;
      const par = { x: parRef.current.x, y: parRef.current.y };

      // ── Background: void + starfield ──
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.55, Math.max(w, h) * 0.75);
      bg.addColorStop(0, 'rgba(10,16,32,0.9)');
      bg.addColorStop(0.55, 'rgba(4,8,18,0.96)');
      bg.addColorStop(1, 'rgba(2,3,10,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // starfield dust (deterministic)
      ctx.save();
      for (let i = 0; i < 130; i++) {
        const sx = (hashStr('sx' + i) % 1000) / 1000 * w;
        const sy = (hashStr('sy' + i) % 1000) / 1000 * h;
        const tw = 0.25 + 0.55 * Math.abs(Math.sin(t * 0.6 + i));
        ctx.fillStyle = `rgba(148,197,255,${(tw * 0.35).toFixed(3)})`;
        ctx.fillRect(sx, sy, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
      }
      ctx.restore();

      const n = strands.length;
      if (n === 0) {
        // Empty state: dormant gate only
        drawGate(ctx, w, h, t, par, explodeT);
        raf = requestAnimationFrame(draw);
        return;
      }

      const geoms = strands.map((_, i) => strandGeom(i, n, w, h, par));

      // ── Strands: ignite wave far→near staggered per strand ──
      strands.forEach((s, si) => {
        const g = geoms[si];
        const igniteDelay = si * 0.22;
        const prog = reduced.current ? 1 : Math.min(1, Math.max(0, (explodeT * 1.35 - igniteDelay) / 0.8));
        if (prog <= 0) return;
        const endT = 0.08 + prog * 0.9;
        ctx.save();
        ctx.lineCap = 'round';
        // glow pass
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = 0.5 * prog;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        const STEPS = 40;
        for (let k = 0; k <= STEPS * endT; k++) {
          const u = (k / STEPS);
          const p = cubic(g, u);
          const depth = 1 - u * 0.55; // far = thinner/dimmer
          if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          void depth;
        }
        ctx.stroke();
        // bright core pass
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.85 * prog;
        ctx.strokeStyle = 'rgba(240,253,255,0.9)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      });

      // ── Forks (pruned branches) ──
      forks.forEach((f) => {
        const g = geoms[f.strand];
        if (!g) return;
        const base = cubic(g, f.u);
        const tan = cubicTan(g, f.u);
        const tl = Math.hypot(tan.x, tan.y) || 1;
        const px = -tan.y / tl, py = tan.x / tl;
        const fl = f.len * Math.min(w, h) * 0.4;
        const ex = base.x + px * fl * f.dir;
        const ey = base.y + py * fl * f.dir * 0.5 - fl * 0.16;
        ctx.save();
        ctx.strokeStyle = 'rgba(244,114,182,0.5)';
        ctx.shadowColor = '#f472b6';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.quadraticCurveTo(base.x + (ex - base.x) * 0.4 + px * 14 * f.dir, base.y + (ey - base.y) * 0.4, ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        // pruned tip dot
        ctx.fillStyle = 'rgba(244,114,182,0.8)';
        ctx.beginPath(); ctx.arc(ex, ey, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      // ── Event nodes ──
      strands.forEach((s, si) => {
        const g = geoms[si];
        const strandDelay = si * 0.22;
        s.events.forEach((ev) => {
          const localT = Math.min(1, Math.max(0, (explodeT * 1.35 - strandDelay) / 0.8));
          if (ev.u > 0.08 + localT * 0.9) return; // not ignited yet
          const p = cubic(g, ev.u);
          const depthDim = 0.35 + (1 - ev.u) * 0.65;
          const col = ev.significant ? GOLD : ev.warn ? WARN : s.color;
          const r = (ev.significant ? 3.4 : 2.1) * (0.6 + (1 - ev.u) * 0.5);
          const pulse = reduced.current ? 0.8 : 0.65 + 0.35 * Math.sin(t * 2.2 + ev.u * 20 + si);
          ctx.save();
          ctx.globalAlpha = depthDim * pulse;
          ctx.shadowColor = col;
          ctx.shadowBlur = ev.significant ? 16 : 9;
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          // hot core
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.38, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        });
      });

      // ── Explosion particles → snap to nodes ──
      if (explodeT < 1 || particles.some((p) => p.life < 1)) {
        particles.forEach((p) => {
          const pt = (nowMs - start - p.delay) / 1000;
          if (pt < 0) return;
          const tgt = (p as any).__ev as StrandEvent | undefined;
          const tsi = (p as any).__strand as number;
          if (!tgt || !geoms[tsi]) return;
          const gp = cubic(geoms[tsi], tgt.u);
          if (pt < 0.9) {
            // burst phase: velocity decay
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.94; p.vy = p.vy * 0.94 + 0.05;
            p.life = Math.min(1, pt / 0.9);
            ctx.save();
            ctx.globalAlpha = (1 - p.life * 0.4) * 0.9;
            ctx.shadowColor = p.hue > 100 ? GOLD : '#67e8f9';
            ctx.shadowBlur = 12;
            ctx.fillStyle = p.hue > 100 ? GOLD : '#67e8f9';
            ctx.beginPath(); ctx.arc(p.x, p.y, 2.6 * (1 - p.life * 0.5), 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          } else {
            // capture phase: lerp to node
            const cap = Math.min(1, (pt - 0.9) / 0.7);
            const e = 1 - Math.pow(1 - cap, 3);
            const x = p.x + (gp.x - p.x) * e;
            const y = p.y + (gp.y - p.y) * e;
            ctx.save();
            ctx.globalAlpha = e * 0.95;
            ctx.shadowColor = tgt.significant ? GOLD : strands[tsi]?.color || '#67e8f9';
            ctx.shadowBlur = 14;
            ctx.fillStyle = tgt.significant ? GOLD : '#e0f2fe';
            ctx.beginPath(); ctx.arc(x, y, 2.8, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            if (cap >= 1) p.life = 1;
          }
        });
      }

      // ── TVA Nexus Gate at foreground center ──
      drawGate(ctx, w, h, t, par, explodeT);

      // ── Strand labels near gate ──
      strands.forEach((s, si) => {
        const g = geoms[si];
        const p = cubic(g, 0.03);
        const localT = Math.min(1, Math.max(0, (explodeT * 1.35 - si * 0.22) / 0.8));
        if (localT < 0.4) return;
        ctx.save();
        ctx.font = `9px ${MONO}`;
        ctx.fillStyle = s.color;
        ctx.globalAlpha = 0.75;
        ctx.textAlign = 'center';
        ctx.fillText(s.label, p.x, p.y + 16);
        ctx.restore();
      });

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [strands, forks, size, reduced]);

  // ── Hit testing for event nodes ──
  const pickNode = (mx: number, my: number) => {
    const el = wrapRef.current;
    if (!el || strands.length === 0) return null;
    const r = el.getBoundingClientRect();
    const w = r.width, h = r.height;
    const par = { x: parRef.current.x, y: parRef.current.y };
    const n = strands.length;
    let best: { strand: number; ev: StrandEvent; d: number; x: number; y: number } | null = null;
    strands.forEach((s, si) => {
      const g = strandGeom(si, n, w, h, par);
      s.events.forEach((ev) => {
        const p = cubic(g, ev.u);
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
    hoverRef.current = hit;
    if (hit) e.currentTarget.style.cursor = 'pointer';
    else e.currentTarget.style.cursor = 'default';
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

      {/* HUD — TVA header */}
      <div style={{ position: 'absolute', top: 84, left: 64, zIndex: 8, pointerEvents: 'none' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.5em', color: '#67e8f9', fontFamily: MONO, fontWeight: 800 }}>
          ⌛ TVA // SACRED TIMELINE
        </div>
        <div style={{ fontSize: 9, letterSpacing: '0.22em', color: DIM, fontFamily: MONO, marginTop: 5 }}>
          {strands.length} BRANCHES · {totalEvents} EVENTS · SPAN {spanLabel}
          {forks.length > 0 ? ` · ${forks.length} PRUNED` : ''}
        </div>
      </div>

      {/* Strand legend */}
      {strands.length > 0 && (
        <div style={{
          position: 'absolute', left: 64, bottom: 90, zIndex: 8, pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {strands.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 14, height: 1.5, background: s.color, boxShadow: `0 0 6px ${s.color}`, opacity: 0.9 }} />
              <span style={{ fontSize: 8.5, letterSpacing: '0.18em', color: DIM, fontFamily: MONO }}>
                {s.label} · {s.events.length}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* NOW marker */}
      <div style={{
        position: 'absolute', bottom: 58, left: '50%', transform: 'translateX(-50%)',
        zIndex: 8, pointerEvents: 'none', textAlign: 'center',
      }}>
        <div style={{
          fontSize: 9, letterSpacing: '0.4em', color: '#e0f2fe', fontFamily: MONO, fontWeight: 800,
          textShadow: '0 0 14px rgba(103,232,249,0.8)',
        }}>◈ NOW — NEXUS GATE</div>
        <div style={{ width: 120, height: 1, margin: '5px auto 0', background: 'linear-gradient(90deg, transparent, #67e8f9, transparent)' }} />
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

// ── TVA Nexus Gate ───────────────────────────────────────────────────────

function drawGate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  par: { x: number; y: number },
  explodeT: number,
) {
  const cx = w / 2 + par.x * 14;
  const gy = h * 0.9 + par.y * 8;
  const breathe = reducedSafe(t);
  const gateScale = 0.6 + explodeT * 0.4;
  const R = Math.min(w, h) * 0.085 * gateScale;

  ctx.save();
  ctx.translate(cx, gy);

  // outer glow ring
  const glow = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 2.6);
  glow.addColorStop(0, `rgba(103,232,249,${0.22 * breathe})`);
  glow.addColorStop(1, 'rgba(103,232,249,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, R * 2.6, 0, Math.PI * 2); ctx.fill();

  // TVA-style angular chevrons (double bracket gate)
  ctx.strokeStyle = '#67e8f9';
  ctx.shadowColor = '#67e8f9';
  ctx.shadowBlur = 18 * breathe;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  const a = R * 0.62;
  const gap = R * 0.34;
  // left chevron «
  ctx.beginPath();
  ctx.moveTo(-a, -gap); ctx.lineTo(-a * 0.45, 0); ctx.lineTo(-a, gap);
  ctx.stroke();
  // right chevron »
  ctx.beginPath();
  ctx.moveTo(a, -gap); ctx.lineTo(a * 0.45, 0); ctx.lineTo(a, gap);
  ctx.stroke();
  // inner core dot
  ctx.fillStyle = 'rgba(224,242,254,0.95)';
  ctx.shadowBlur = 22;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.1 * breathe, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function reducedSafe(t: number): number {
  return 0.75 + 0.25 * Math.sin(t * 1.4);
}
