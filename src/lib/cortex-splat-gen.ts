/**
 * cortex-splat-gen — procedural Gaussian-splat scene generators.
 *
 * Seeded, parametric splat scenes written as binary_little_endian INRIA
 * 3DGS PLY (same layout scripts/gen-demo-splat.py emits — Spark reads it
 * natively). Every call produces a unique asset: seed + palette + count
 * are the generative knobs. No training, no GPU — pure math, ~ms per
 * thousand splats.
 */
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

// ── Seeded RNG (mulberry32) ──────────────────────────────────────────────
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = (r: () => number, a: number, b: number) => a + r() * (b - a);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ── Palettes ─────────────────────────────────────────────────────────────
export const SPLAT_PALETTES: Record<string, [number, number, number][]> = {
  aurora:  [[0.35, 0.95, 0.75], [0.25, 0.75, 1.0], [0.55, 0.45, 1.0]],
  ember:   [[1.0, 0.85, 0.35], [1.0, 0.5, 0.15], [0.9, 0.2, 0.35]],
  ocean:   [[0.3, 0.85, 1.0], [0.15, 0.45, 0.95], [0.6, 0.9, 1.0]],
  violet:  [[0.85, 0.55, 1.0], [0.5, 0.3, 0.95], [1.0, 0.7, 0.95]],
  mono:    [[0.9, 0.95, 1.0], [0.5, 0.65, 0.95], [0.3, 0.4, 0.7]],
  prism:   [[1.0, 0.4, 0.5], [0.4, 1.0, 0.6], [0.4, 0.6, 1.0], [1.0, 0.9, 0.4]],
};

export const SPLAT_SCENES = ['orb', 'butterfly', 'flower', 'helix', 'galaxy', 'ridge', 'flow'] as const;
export type SplatSceneKind = (typeof SPLAT_SCENES)[number];

interface SplatPt { x: number; y: number; z: number; r: number; g: number; b: number; s: number; o: number; }

function palColor(pal: [number, number, number][], t: number, r: () => number): [number, number, number] {
  const tt = clamp01(t);
  const f = tt * (pal.length - 1);
  const i = Math.min(pal.length - 2, Math.floor(f));
  const k = f - i;
  const a = pal[i], b = pal[i + 1];
  // slight per-splat jitter so fields don't band
  const j = () => (r() - 0.5) * 0.08;
  return [clamp01(lerp(a[0], b[0], k) + j()), clamp01(lerp(a[1], b[1], k) + j()), clamp01(lerp(a[2], b[2], k) + j())];
}

// ── Scene generators: each appends SplatPt[] ─────────────────────────────

function genOrb(pts: SplatPt[], n: number, pal: [number, number, number][], r: () => number) {
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const shell = r();
    const rad = shell < 0.55 ? rand(r, 0.55, 0.8) : shell < 0.85 ? rand(r, 0.8, 1.05) : rand(r, 1.05, 1.45);
    const y = 1 - (i / (n - 1)) * 2;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const th = ga * i + rand(r, -0.05, 0.05);
    const [cr, cg, cb] = palColor(pal, y * 0.5 + 0.5 + rand(r, -0.08, 0.08), r);
    pts.push({
      x: Math.cos(th) * rr * rad, y: y * rad * 0.9, z: Math.sin(th) * rr * rad,
      r: cr, g: cg, b: cb,
      s: rand(r, 0.006, 0.02) * (1.4 - shell * 0.5),
      o: rand(r, 0.3, 0.75),
    });
  }
}

function genButterfly(pts: SplatPt[], n: number, pal: [number, number, number][], r: () => number) {
  // Two wing membranes as parametric surfaces + body + antennae.
  // Wing: u in [0,1] span, v in [0,1] chord; butterfly curve gives the
  // scalloped trailing edge; z displaces by a gentle camber.
  const wing = (side: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const u = Math.pow(r(), 0.8);            // denser near body
      const v = r();
      // forewing/hindwing split by u
      const chord = u < 0.62 ? 0.62 : 0.42;
      const vv = u < 0.62 ? v : v * 0.8;
      // scalloped trailing edge
      const edge = Math.sin(vv * Math.PI * 3 + u * 2) * 0.05 * vv;
      const x = side * (0.06 + u * (0.85 + edge));
      const y = 0.15 + Math.sin(u * Math.PI) * 0.55 - vv * chord * 0.55;
      const z = Math.sin(u * Math.PI * 0.9) * 0.16 * (1 - vv * 0.5) + rand(r, -0.015, 0.015);
      const [cr, cg, cb] = palColor(pal, u * 0.7 + vv * 0.3, r);
      pts.push({ x, y, z, r: cr, g: cg, b: cb, s: rand(r, 0.008, 0.022), o: rand(r, 0.55, 0.9) });
    }
  };
  const half = Math.floor(n * 0.44);
  wing(1, half); wing(-1, half);
  // Body — elongated ellipsoid down the center
  const nb = Math.floor(n * 0.1);
  for (let i = 0; i < nb; i++) {
    const t = r();
    const y = lerp(-0.75, 0.85, t);
    const rad = 0.05 * (1 - Math.abs(t - 0.4) * 0.9);
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * rad;
    const [cr, cg, cb] = palColor(pal, 0.15 + t * 0.3, r);
    pts.push({ x: Math.cos(a) * rr, y, z: Math.sin(a) * rr, r: cr * 0.7, g: cg * 0.7, b: cb * 0.8, s: rand(r, 0.01, 0.025), o: rand(r, 0.6, 0.95) });
  }
  // Antennae — two curling filaments
  for (const side of [-1, 1]) {
    for (let i = 0; i < n * 0.01; i++) {
      const t = i / (n * 0.01);
      const curl = t * t * 2.2;
      pts.push({
        x: side * (0.03 + Math.sin(curl) * 0.1 * t + t * 0.12),
        y: 0.9 + t * 0.55,
        z: Math.cos(curl) * 0.08 * t,
        r: 0.9, g: 0.85, b: 0.7, s: 0.008, o: 0.7,
      });
    }
  }
}

function genFlower(pts: SplatPt[], n: number, pal: [number, number, number][], r: () => number) {
  const petals = 7 + Math.floor(r() * 3);
  const petalN = Math.floor(n * 0.82);
  for (let i = 0; i < petalN; i++) {
    const p = i % petals;
    const t = Math.floor(i / petals) / (petalN / petals); // along petal
    const ang = (p / petals) * Math.PI * 2 + rand(r, -0.06, 0.06);
    const len = 0.55 + rand(r, -0.08, 0.12);
    const wid = 0.16 * (1 - t * 0.55);
    const rad = t * len;
    const off = rand(r, -wid, wid) * (1 - t * 0.4);
    const cup = Math.sin(t * Math.PI) * 0.1;
    const x = Math.cos(ang) * rad - Math.sin(ang) * off;
    const y = Math.sin(ang) * rad + Math.cos(ang) * off;
    const z = cup + rand(r, -0.01, 0.01);
    const [cr, cg, cb] = palColor(pal, t * 0.85 + (p % 2) * 0.08, r);
    pts.push({ x, y, z, r: cr, g: cg, b: cb, s: rand(r, 0.009, 0.02) * (1.2 - t * 0.4), o: rand(r, 0.5, 0.88) });
  }
  // Center stamen — bright core
  const nc = n - petalN;
  for (let i = 0; i < nc; i++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.14;
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, z: rand(r, -0.03, 0.05), r: 1.0, g: 0.9, b: 0.5, s: rand(r, 0.008, 0.016), o: rand(r, 0.7, 0.95) });
  }
}

function genHelix(pts: SplatPt[], n: number, pal: [number, number, number][], r: () => number) {
  const turns = 2.2 + r() * 1.4;
  const h = 1.9, rad = 0.42;
  const perStrand = Math.floor(n * 0.46);
  for (let s = 0; s < 2; s++) {
    const phase = s * Math.PI;
    for (let i = 0; i < perStrand; i++) {
      const t = i / perStrand;
      const a = t * turns * Math.PI * 2 + phase;
      // slight radius breathing + vertical wobble
      const rr = rad * (1 + 0.06 * Math.sin(t * 9 + s * 3));
      const [cr, cg, cb] = palColor(pal, t, r);
      pts.push({
        x: Math.cos(a) * rr, y: (t - 0.5) * h, z: Math.sin(a) * rr,
        r: cr, g: cg, b: cb, s: rand(r, 0.007, 0.016), o: rand(r, 0.55, 0.9),
      });
    }
  }
  // Rungs — base pairs bridging the strands
  const nr = n - perStrand * 2;
  const rungs = Math.max(8, Math.floor(nr / 3));
  for (let i = 0; i < rungs; i++) {
    const t = (i + r() * 0.7) / rungs;
    const a = t * turns * Math.PI * 2;
    const steps = 3;
    for (let j = 0; j < steps; j++) {
      const f = j / (steps - 1);
      const x = lerp(Math.cos(a) * rad, Math.cos(a + Math.PI) * rad, f);
      const z = lerp(Math.sin(a) * rad, Math.sin(a + Math.PI) * rad, f);
      pts.push({ x, y: (t - 0.5) * h, z, r: 0.85, g: 0.9, b: 1.0, s: rand(r, 0.005, 0.01), o: rand(r, 0.3, 0.6) });
    }
  }
}

function genGalaxy(pts: SplatPt[], n: number, pal: [number, number, number][], r: () => number) {
  const arms = 2 + Math.floor(r() * 3);
  const spin = 4.5 + r() * 3;
  for (let i = 0; i < n; i++) {
    // log-spiral: radius grows with angle; arm assignment by angle mod
    const arm = i % arms;
    const t = Math.pow(r(), 0.6);                    // more splats mid-disc
    const ang = arm * (Math.PI * 2 / arms) + t * spin + rand(r, -0.22, 0.22);
    const rad = 0.15 + t * 1.5;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    const y = rand(r, -1, 1) * (0.16 * (1 - t * 0.6)) * (1 + t * 0.5); // disc thickness flares
    const core = t < 0.18;
    const [cr, cg, cb] = core ? [1.0, 0.95, 0.85] : palColor(pal, t * 0.9, r);
    pts.push({
      x, y, z, r: cr, g: cg, b: cb,
      s: rand(r, 0.006, 0.018) * (1.3 - t * 0.6),
      o: rand(r, 0.3, 0.8) * (core ? 1.2 : 1),
    });
  }
}

function genRidge(pts: SplatPt[], n: number, pal: [number, number, number][], r: () => number) {
  // Layered ridgeline — fbm-ish noise heightfield sliced into contour
  // bands, densest near the crest. Reads as a mountain range at dusk.
  const layers = 4;
  const per = Math.floor(n / layers);
  const noise = (x: number, z: number) =>
    Math.sin(x * 2.1 + z * 1.3) * 0.5 + Math.sin(x * 4.7 - z * 2.9) * 0.3 + Math.sin(x * 9.1 + z * 5.3) * 0.2;
  for (let L = 0; L < layers; L++) {
    const baseY = -0.9 + L * 0.55;
    for (let i = 0; i < per; i++) {
      const x = rand(r, -2.2, 2.2);
      const z = rand(r, -1.4, 1.4) - L * 0.28;
      const h = noise(x * 0.8 + L * 7, z * 0.8) * 0.55;
      const crest = Math.exp(-Math.pow((h + 0.2) * 2.2, 2)); // density peaks near crest
      if (r() > crest * 1.4) continue;
      const [cr, cg, cb] = palColor(pal, clamp01(0.15 + L * 0.22 + h * 0.4), r);
      pts.push({
        x, y: baseY + h + rand(r, -0.05, 0.05), z,
        r: cr * (1 - L * 0.06), g: cg * (1 - L * 0.04), b: cb,
        s: rand(r, 0.01, 0.03), o: rand(r, 0.35, 0.75),
      });
    }
  }
}

function genFlow(pts: SplatPt[], n: number, pal: [number, number, number][], r: () => number) {
  // Curl-ish flow field — particles advected through a divergence-free
  // sinusoidal field, leaving luminous trails. The "living" scene.
  const field = (x: number, y: number, z: number, t: number): [number, number, number] => [
    Math.sin(y * 1.7 + t * 0.4) + Math.cos(z * 1.3 - t * 0.3),
    Math.sin(z * 1.9 - t * 0.35) + Math.cos(x * 1.1 + t * 0.25),
    Math.sin(x * 1.5 + t * 0.3) + Math.cos(y * 1.4 - t * 0.2),
  ];
  // n is a TOTAL splat budget: ~20 trail points per advected particle.
  const particles = Math.max(50, Math.floor(n / 20));
  const perParticle = Math.floor(n / particles);
  for (let i = 0; i < particles; i++) {
    let x = rand(r, -1.6, 1.6), y = rand(r, -1.1, 1.1), z = rand(r, -1.6, 1.6);
    const steps = Math.min(perParticle, 14 + Math.floor(r() * 22));
    const t0 = rand(r, 0, 6.28);
    for (let s = 0; s < steps; s++) {
      const [vx, vy, vz] = field(x, y, z, t0 + s * 0.35);
      x += vx * 0.045; y += vy * 0.045; z += vz * 0.045;
      const fade = 1 - s / steps;
      const [cr, cg, cb] = palColor(pal, s / steps + rand(r, -0.05, 0.05), r);
      pts.push({
        x, y, z, r: cr, g: cg, b: cb,
        s: rand(r, 0.004, 0.011) * (0.5 + fade),
        o: rand(r, 0.25, 0.7) * fade,
      });
    }
  }
}

const GENERATORS: Record<SplatSceneKind, (pts: SplatPt[], n: number, pal: [number, number, number][], r: () => number) => void> = {
  orb: genOrb, butterfly: genButterfly, flower: genFlower, helix: genHelix,
  galaxy: genGalaxy, ridge: genRidge, flow: genFlow,
};

// ── Binary INRIA 3DGS PLY writer ──────────────────────────────────────────
// Property order matches gen-demo-splat.py: pos3, normal3, f_dc3 (SH DC),
// opacity logit1, scale log3, rot quat4 — 17 float32 per splat.
export function writeSplatPly(pts: SplatPt[]): Buffer {
  const header = [
    'ply', 'format binary_little_endian 1.0',
    `element vertex ${pts.length}`,
    'property float x', 'property float y', 'property float z',
    'property float nx', 'property float ny', 'property float nz',
    'property float f_dc_0', 'property float f_dc_1', 'property float f_dc_2',
    'property float opacity',
    'property float scale_0', 'property float scale_1', 'property float scale_2',
    'property float rot_0', 'property float rot_1', 'property float rot_2', 'property float rot_3',
    'end_header',
  ].join('\n') + '\n';
  const hbuf = Buffer.from(header, 'ascii');
  const body = Buffer.alloc(pts.length * 17 * 4);
  let o = 0;
  for (const p of pts) {
    const op = Math.min(0.999, Math.max(0.001, p.o));
    const logit = Math.log(op / (1 - op));
    const ls = Math.log(p.s);
    body.writeFloatLE(p.x, o); body.writeFloatLE(p.y, o + 4); body.writeFloatLE(p.z, o + 8);
    body.writeFloatLE(0, o + 12); body.writeFloatLE(0, o + 16); body.writeFloatLE(0, o + 20);
    body.writeFloatLE((p.r - 0.5) / 0.28209479, o + 24);
    body.writeFloatLE((p.g - 0.5) / 0.28209479, o + 28);
    body.writeFloatLE((p.b - 0.5) / 0.28209479, o + 32);
    body.writeFloatLE(logit, o + 36);
    body.writeFloatLE(ls, o + 40); body.writeFloatLE(ls, o + 44); body.writeFloatLE(ls, o + 48);
    body.writeFloatLE(1, o + 52); body.writeFloatLE(0, o + 56); body.writeFloatLE(0, o + 60); body.writeFloatLE(0, o + 64);
    o += 68;
  }
  return Buffer.concat([hbuf, body]);
}

export interface GenSplatOptions {
  scene?: string;
  seed?: number;
  palette?: string;
  count?: number;
}

export interface GenSplatResult {
  file: string;          // absolute path written
  url: string;           // /splats/<name>.ply
  name: string;
  scene: SplatSceneKind | 'photo';
  splats: number;
  seed: number;
  palette: string;
}

/** Generate a procedural splat scene → public/splats/gen-<scene>-<hash>.ply */
export function generateSplat(opts: GenSplatOptions = {}): GenSplatResult {
  const scene = (SPLAT_SCENES as readonly string[]).includes(opts.scene || '')
    ? (opts.scene as SplatSceneKind) : 'orb';
  const seed = Number.isFinite(opts.seed) ? Math.abs(Math.floor(opts.seed!)) : Math.floor(Math.random() * 2 ** 31);
  const palette = SPLAT_PALETTES[opts.palette || ''] ? opts.palette! : 'aurora';
  const count = Math.min(Math.max(Math.floor(opts.count || 60000), 4000), 200000);

  const r = rng(seed);
  const pts: SplatPt[] = [];
  GENERATORS[scene](pts, count, SPLAT_PALETTES[palette], r);

  const hash = Math.abs(seed * 2654435761 % 2 ** 31).toString(36);
  const name = `gen-${scene}-${hash}`;
  const dir = path.join(process.cwd(), 'public', 'splats');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.ply`);
  writeFileSync(file, writeSplatPly(pts));
  return { file, url: `/splats/${name}.ply`, name, scene, splats: pts.length, seed, palette };
}
