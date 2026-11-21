/**
 * CortexHoloDeck — dashboard artifacts rendered as curved holographic
 * planes INSIDE the R3F scene, not DOM cards.
 *
 * Listens for `cortex-spawn-holo` events carrying a sanitized dashboard
 * artifact ({title, tiles}). Each deck is a curved glass panel with a
 * CanvasTexture face (stat/chart/feed drawn in 2D canvas) and any splat
 * tile becomes a real SplatMesh hovering just behind the glass — a live
 * splat inside the dashboard volume. Acks via `cortex-holo-ack` so tool
 * callers can fall back to a card on surfaces with no 3D scene.
 */
import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { CortexArtifact, DashboardArtifact } from '../../lib/cortex-artifacts';
import { makeMaterializeRig, tickMaterialize, prefersReducedMotion, MATERIALIZE_DURATION, type MaterializeRig } from '../../lib/cortex-materialize';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const SANS = "'DM Sans', ui-sans-serif, system-ui, sans-serif";
const MAX_DECKS = 2;

// ── Canvas painter — dashboard tiles → 2D canvas ─────────────────────────
function paintDeck(a: DashboardArtifact, w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;

  // Deep-space glass background + faint grid
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, 'rgba(8,18,34,0.92)');
  bg.addColorStop(1, 'rgba(4,10,22,0.94)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(120,190,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  // Header
  ctx.fillStyle = 'rgba(160,220,255,0.9)';
  ctx.font = `600 15px ${MONO}`;
  ctx.fillText((a.title || 'DASHBOARD').toUpperCase(), 22, 30);
  ctx.fillStyle = 'rgba(120,170,220,0.45)';
  ctx.font = `9px ${MONO}`;
  ctx.fillText(`${a.tiles.length} MODULES · LIVE`, 22, 46);
  ctx.strokeStyle = 'rgba(140,210,255,0.25)';
  ctx.beginPath(); ctx.moveTo(22, 58); ctx.lineTo(w - 22, 58); ctx.stroke();

  const light = a.tiles.filter((t) => t.kind !== 'splat');
  const splatTile = a.tiles.find((t) => t.kind === 'splat');
  const cols = Math.min(3, Math.max(1, light.length));
  const pad = 18, gap = 12;
  const top = 70;
  const tileH = Math.max(90, Math.floor((h - top - pad - (splatTile ? 130 : 0)) / Math.max(1, Math.ceil(light.length / cols))));
  const tileW = (w - pad * 2 - gap * (cols - 1)) / cols;

  const PALETTE = ['#5ee7ff', '#8ab4ff', '#c084fc', '#6ee7b7', '#fbbf24', '#fb7185'];
  light.forEach((t, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = pad + col * (tileW + gap), y = top + row * (tileH + gap);
    // tile glass
    ctx.fillStyle = 'rgba(140,200,255,0.06)';
    ctx.strokeStyle = 'rgba(140,200,255,0.16)';
    ctx.beginPath();
    ctx.roundRect(x, y, tileW, tileH, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(150,200,240,0.55)';
    ctx.font = `8px ${MONO}`;
    ctx.fillText((t.title || t.kind).toUpperCase().slice(0, 22), x + 12, y + 18);
    drawTileBody(ctx, t as CortexArtifact, x + 12, y + 26, tileW - 24, tileH - 34, PALETTE[i % PALETTE.length]);
  });

  // Splat tile — reserved dark well; the live SplatMesh renders behind it
  if (splatTile) {
    const y = h - pad - 118;
    ctx.fillStyle = 'rgba(2,8,18,0.85)';
    ctx.strokeStyle = 'rgba(140,200,255,0.14)';
    ctx.beginPath(); ctx.roundRect(pad, y, w - pad * 2, 106, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(150,200,240,0.55)';
    ctx.font = `8px ${MONO}`;
    ctx.fillText(`◈ ${(splatTile.title || 'LIVE SPLAT').toUpperCase()} — RENDERING IN VOLUME`, pad + 14, y + 20);
    ctx.fillStyle = 'rgba(120,170,220,0.3)';
    ctx.font = `10px ${SANS}`;
    const cap = (splatTile as any).caption;
    if (cap) ctx.fillText(String(cap).slice(0, 90), pad + 14, y + 92);
  }
  return cv;
}

function drawTileBody(ctx: CanvasRenderingContext2D, t: CortexArtifact, x: number, y: number, w: number, h: number, color: string) {
  if (t.kind === 'stat') {
    ctx.fillStyle = '#eaf6ff';
    ctx.font = `700 ${Math.min(30, h * 0.42)}px ${SANS}`;
    ctx.fillText(String((t as any).value ?? '—'), x, y + h * 0.45);
    const unit = (t as any).unit ? ` ${String((t as any).unit)}` : '';
    ctx.fillStyle = 'rgba(160,210,250,0.6)';
    ctx.font = `10px ${MONO}`;
    ctx.fillText(`${unit} ${(t as any).delta || ''}`.trim(), x, y + h * 0.72);
    const spark = (t as any).spark as number[] | undefined;
    if (spark && spark.length > 1) {
      const mn = Math.min(...spark), mx = Math.max(...spark), rg = mx - mn || 1;
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath();
      spark.forEach((v, i) => {
        const px = x + (i / (spark.length - 1)) * w;
        const py = y + h * 0.85 - ((v - mn) / rg) * h * 0.3;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      });
      ctx.stroke();
    }
    return;
  }
  if (t.kind === 'chart') {
    const c = t as any;
    const series = (c.series?.[0]?.points || []) as { x: any; y: number }[];
    if (!series.length) return;
    const ys = series.map((p) => p.y), mn = Math.min(...ys), mx = Math.max(...ys), rg = mx - mn || 1;
    const pts = series.map((p, i) => [x + (i / Math.max(1, series.length - 1)) * w, y + h * 0.9 - ((p.y - mn) / rg) * h * 0.75] as const);
    if (c.chartType === 'bar') {
      const bw = w / series.length;
      series.forEach((p, i) => {
        const bh = ((p.y - mn) / rg) * h * 0.75 + 2;
        ctx.fillStyle = color + 'cc';
        ctx.fillRect(x + i * bw + 2, y + h * 0.9 - bh, bw - 4, bh);
      });
    } else {
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, color + '55'); grad.addColorStop(1, color + '05');
      ctx.beginPath();
      ctx.moveTo(pts[0][0], y + h * 0.9);
      pts.forEach(([px, py]) => ctx.lineTo(px, py));
      ctx.lineTo(pts[pts.length - 1][0], y + h * 0.9);
      ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
      ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.stroke();
    }
    ctx.fillStyle = 'rgba(160,210,250,0.45)';
    ctx.font = `8px ${MONO}`;
    ctx.fillText(`${mn.toFixed(0)}–${mx.toFixed(0)}`, x, y + h * 0.97);
    return;
  }
  if (t.kind === 'feed') {
    const items = ((t as any).items || []) as { label: string; value: string; tone?: string }[];
    const toneColor = (tone?: string) => tone === 'ok' ? '#6ee7b7' : tone === 'warn' ? '#fbbf24' : tone === 'alert' ? '#fb7185' : '#8ab4ff';
    items.slice(0, Math.floor(h / 22)).forEach((it, i) => {
      const iy = y + i * 22;
      ctx.fillStyle = 'rgba(200,230,255,0.75)';
      ctx.font = `9px ${SANS}`;
      ctx.fillText(String(it.label).slice(0, 18), x, iy + 12);
      ctx.fillStyle = toneColor(it.tone);
      ctx.font = `9px ${MONO}`;
      ctx.fillText(String(it.value).slice(0, 16), x + w * 0.55, iy + 12);
    });
    return;
  }
  if (t.kind === 'image') {
    ctx.fillStyle = 'rgba(160,210,250,0.4)';
    ctx.font = `9px ${MONO}`;
    ctx.fillText('▣ IMAGE MODULE', x, y + h * 0.4);
  }
}

// ── Deck mesh builder ────────────────────────────────────────────────────
function buildDeck(a: DashboardArtifact): { group: THREE.Group; splatUrl?: string } {
  const group = new THREE.Group();
  const cv = paintDeck(a, 1024, 640);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  // Curved holo panel — gentle arc so it reads as a physical object
  const W = 4.4, H = 2.75, SEG = 24;
  const geo = new THREE.PlaneGeometry(W, H, SEG, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, (x * x) / (W * W) * 0.55); // parabolic bow
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    map: tex,
    transparent: true,
    opacity: 0.94,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const panel = new THREE.Mesh(geo, mat);
  group.add(panel);

  // Fresnel-ish edge frame — additive wire glow
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 24),
    new THREE.LineBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending }),
  );
  edges.position.z = 0.01;
  group.add(edges);

  const splatTile = a.tiles.find((t) => t.kind === 'splat');
  return { group, splatUrl: splatTile ? (splatTile as any).splat : undefined };
}

// ── Component ────────────────────────────────────────────────────────────
interface DeckItem { deck: THREE.Group; mat: MaterializeRig; phase: number; baseY: number; vel: THREE.Vector3 }

export function CortexHoloDeck() {
  const { gl, scene, invalidate, camera } = useThree();
  const host = useRef<THREE.Group | null>(null);
  const items = useRef<DeckItem[]>([]);
  const sparkMod = useRef<{ SparkRenderer: any; SplatMesh: any } | null>(null);
  const sparkObj = useRef<any>(null);
  const sparkReady = useRef(false);
  const pending = useRef<DashboardArtifact[]>([]);

  React.useEffect(() => {
    const g = new THREE.Group();
    scene.add(g);
    host.current = g;
    let cancelled = false;

    const spawnDeck = (a: DashboardArtifact) => {
      if (!host.current) return;
      const { group, splatUrl } = buildDeck(a);
      const idx = items.current.length;
      const ang = idx * 2.39996 + 0.8;
      const rad = 4.6 + idx * 0.7;
      const baseY = idx === 0 ? 0.55 : -0.5;
      // Materialize rig: deck condenses out of a pixie-dust implosion.
      const mat = prefersReducedMotion()
        ? { rig: new THREE.Group(), burst: null, age: MATERIALIZE_DURATION }
        : makeMaterializeRig();
      mat.rig.position.set(Math.cos(ang) * rad, baseY, Math.sin(ang) * rad - 2.2);
      mat.rig.add(group);
      host.current.add(mat.rig);
      // Free drift — orbit slot is the entry point; the deck then wanders.
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.16,
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.16,
      );
      items.current.push({ deck: group, mat, phase: idx * 2.1, baseY, vel });
      while (items.current.length > MAX_DECKS) {
        const old = items.current.shift()!;
        host.current.remove(old.mat.rig);
      }

      // Live splat behind the glass — the tile's SplatMesh floats in the
      // deck's volume so charts/stat read as holograms in front of it.
      if (splatUrl && sparkMod.current && sparkObj.current) {
        const mesh = new sparkMod.current.SplatMesh({ url: splatUrl });
        mesh.position.set(0, -0.28, -0.85);
        group.add(mesh);
        mesh.initialized?.then(() => {
          const bs = (mesh as any).geometry?.boundingSphere;
          if (bs && bs.radius > 0.0001) mesh.scale.setScalar(1.5 / bs.radius);
        }).catch(() => {});
      }
      invalidate();
    };

    void (async () => {
      const mod = await import('@sparkjsdev/spark');
      if (cancelled) return;
      sparkMod.current = mod as any;
      const spark = new mod.SparkRenderer({ renderer: gl, onDirty: () => invalidate() });
      sparkObj.current = spark;
      g.add(spark as any);
      sparkReady.current = true;
      for (const a of pending.current.splice(0)) spawnDeck(a);
    })().catch(() => {
      // Spark failed to load — still mount queued decks; splat tiles
      // degrade to their canvas well instead of dropping the dashboard.
      sparkReady.current = true;
      for (const a of pending.current.splice(0)) spawnDeck(a);
    });

    const onSpawn = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.kind !== 'dashboard' || !Array.isArray(d.tiles)) return;
      // Ack on ACCEPT — including queued spawns — so tool callers suppress
      // the card immediately instead of timing out while Spark loads.
      window.dispatchEvent(new CustomEvent('cortex-holo-ack', { detail: { id: d.id } }));
      const needsSpark = d.tiles.some((t: any) => t?.kind === 'splat');
      if (needsSpark && !sparkReady.current) {
        if (pending.current.length < 3) pending.current.push(d as DashboardArtifact);
        return;
      }
      spawnDeck(d as DashboardArtifact);
    };
    window.addEventListener('cortex-spawn-holo', onSpawn);
    return () => {
      cancelled = true;
      window.removeEventListener('cortex-spawn-holo', onSpawn);
      scene.remove(g);
    };
  }, [gl, scene, invalidate]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const v = new THREE.Vector3();
    const dbg: any[] = [];
    for (const it of items.current) {
      tickMaterialize(it.mat, delta);
      // Drift through the habitat sphere; soft walls keep decks clear of
      // the core and inside the orbit space.
      it.mat.rig.position.addScaledVector(it.vel, delta);
      const r = it.mat.rig.position.length();
      if (r > 8) {
        it.mat.rig.position.multiplyScalar(8 / r);
        it.vel.multiplyScalar(-0.6);
      } else if (r < 2.4 && r > 0.001) {
        it.mat.rig.position.multiplyScalar(2.4 / r);
        it.vel.multiplyScalar(-0.6);
      }
      // Bob on the inner deck so it layers over drift.
      it.deck.position.y = Math.sin(t * 0.4 + it.phase) * 0.12;
      // Yaw-only billboard — the deck face tracks the CAMERA on the
      // horizon plane so text stays readable from any orbit angle
      // (a core-facing lookAt showed users the mirrored back face).
      const dx = camera.position.x - it.mat.rig.position.x;
      const dz = camera.position.z - it.mat.rig.position.z;
      it.deck.rotation.y = Math.atan2(dx, dz);
      // Screen-space debug projection — lets probes verify the deck is
      // actually in front of the camera instead of trusting the ack.
      // Projects the panel's four corners → CSS-pixel bbox for clipping.
      const w = (window as any).innerWidth, h = (window as any).innerHeight;
      const corners = [[-2.2, -1.375], [2.2, -1.375], [2.2, 1.375], [-2.2, 1.375]]
        .map(([cx, cy]) => {
          v.set(cx, cy, 0).applyMatrix4(it.deck.matrixWorld).project(camera);
          return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
        });
      const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
      const ctr = v.setFromMatrixPosition(it.mat.rig.matrixWorld).project(camera);
      dbg.push({
        cx: +(((ctr.x + 1) / 2) * w).toFixed(0), cy: +(((1 - ctr.y) / 2) * h).toFixed(0),
        bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((n) => Math.round(n)),
        visible: ctr.z < 1 && Math.abs(ctr.x) < 1.2 && Math.abs(ctr.y) < 1.2,
        scale: +it.mat.rig.scale.x.toFixed(3),
        settled: it.mat.age >= MATERIALIZE_DURATION,
      });
    }
    (window as any).__cortexHoloDecks = dbg;
  });

  return null;
}

export default CortexHoloDeck;
