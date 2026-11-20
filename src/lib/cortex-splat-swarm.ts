/**
 * SwarmSim — Lagrangian particle physics driving a Gaussian-splat mesh.
 *
 * Each swarm splat has position + velocity in Float32Arrays. Per frame:
 * spring-to-anchor + precomputed neighbor boids (alignment / cohesion /
 * separation) + ambient curl + cursor repulsion with tangential swirl.
 * Velocity persists between frames — a mouse pass injects real momentum,
 * so particles recoil, orbit and settle instead of snapping home.
 *
 * Positions are written back into the mesh's packedArray via
 * utils.setPackedSplatCenter; needsUpdate re-uploads the splat texture.
 */
import * as THREE from 'three';
import { utils } from '@sparkjsdev/spark';

const SPRING_K = 6.0;
const DAMP_RATE = 2.4;
const ALIGN_K = 1.8;
const COHESION_K = 0.55;
const SEP_K = 0.9;
const AMB_K = 0.16;
const CURSOR_PUSH = 7.0;
const CURSOR_SWIRL = 3.4;
const CURSOR_RADIUS = 1.6;
const MAX_SPEED = 3.0;
const GRID_CELL = 0.42;
const MAX_NEIGHBORS = 10;
const NEIGHBOR_RADIUS = 0.62;

export class SwarmSim {
  readonly n: number;
  private px: Float32Array;
  private py: Float32Array;
  private pz: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;
  private hx: Float32Array;
  private hy: Float32Array;
  private hz: Float32Array;
  private neighbors: number[][] = [];
  private packed: Uint32Array | null = null;
  private packedSplats: any = null;
  time = 0;

  constructor(anchors: THREE.Vector3[] | Float32Array, packedSplats: any) {
    this.n = anchors instanceof Float32Array ? anchors.length / 3 : anchors.length;
    const n = this.n;
    this.px = new Float32Array(n); this.py = new Float32Array(n); this.pz = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.vz = new Float32Array(n);
    this.hx = new Float32Array(n); this.hy = new Float32Array(n); this.hz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = anchors instanceof Float32Array ? anchors[i * 3] : anchors[i].x;
      const y = anchors instanceof Float32Array ? anchors[i * 3 + 1] : anchors[i].y;
      const z = anchors instanceof Float32Array ? anchors[i * 3 + 2] : anchors[i].z;
      this.px[i] = this.hx[i] = x;
      this.py[i] = this.hy[i] = y;
      this.pz[i] = this.hz[i] = z;
    }
    this.buildNeighbors();
    if (packedSplats?.packedArray) {
      this.packed = packedSplats.packedArray;
      this.packedSplats = packedSplats;
    }
  }

  private buildNeighbors() {
    const n = this.n;
    const grid = new Map<string, number[]>();
    const key = (x: number, y: number, z: number) =>
      `${Math.floor(x / GRID_CELL)},${Math.floor(y / GRID_CELL)},${Math.floor(z / GRID_CELL)}`;
    for (let i = 0; i < n; i++) {
      const k = key(this.hx[i], this.hy[i], this.hz[i]);
      const cell = grid.get(k);
      if (cell) cell.push(i); else grid.set(k, [i]);
    }
    const r2 = NEIGHBOR_RADIUS * NEIGHBOR_RADIUS;
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(this.hx[i] / GRID_CELL);
      const cy = Math.floor(this.hy[i] / GRID_CELL);
      const cz = Math.floor(this.hz[i] / GRID_CELL);
      const scored: { j: number; d2: number }[] = [];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const cell = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
        if (!cell) continue;
        for (const j of cell) {
          if (j === i) continue;
          const ddx = this.hx[j] - this.hx[i];
          const ddy = this.hy[j] - this.hy[i];
          const ddz = this.hz[j] - this.hz[i];
          const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
          if (d2 < r2) scored.push({ j, d2 });
        }
      }
      scored.sort((a, b) => a.d2 - b.d2);
      this.neighbors[i] = scored.slice(0, MAX_NEIGHBORS).map(s => s.j);
    }
  }

  step(dt: number, cursor: THREE.Vector3, cursorStrength: number, gust: number, voice?: { speak?: number; listen?: number; think?: number }) {
    const n = this.n;
    const t = this.time;
    this.time += dt;
    const damp = Math.exp(-DAMP_RATE * dt);
    const speak = voice?.speak ?? 0;
    const listen = voice?.listen ?? 0;
    const think = voice?.think ?? 0;
    const amb = AMB_K * (1 + gust * 1.8) * (1 + speak * 2.4 + think * 0.9) * (1 - listen * 0.35);
    const cur = CURSOR_PUSH * cursorStrength * (1 + gust * 0.9);
    const swr = CURSOR_SWIRL * cursorStrength * (1 + gust * 0.9);
    const R2 = CURSOR_RADIUS * CURSOR_RADIUS;
    const px = this.px, py = this.py, pz = this.pz;
    const vx = this.vx, vy = this.vy, vz = this.vz;
    const hx = this.hx, hy = this.hy, hz = this.hz;
    const mx = cursor.x, my = cursor.y, mz = cursor.z;

    for (let i = 0; i < n; i++) {
      const x = px[i], y = py[i], z = pz[i];
      let ax = (hx[i] - x) * SPRING_K;
      let ay = (hy[i] - y) * SPRING_K;
      let az = (hz[i] - z) * SPRING_K;

      // Neighbor boids — alignment, gentle cohesion, short-range separation.
      const nb = this.neighbors[i];
      const kn = nb.length;
      if (kn >= 3) {
        let avx = 0, avy = 0, avz = 0, acx = 0, acy = 0, acz = 0;
        let sepX = 0, sepY = 0, sepZ = 0;
        for (let k = 0; k < kn; k++) {
          const j = nb[k];
          avx += vx[j]; avy += vy[j]; avz += vz[j];
          acx += px[j]; acy += py[j]; acz += pz[j];
          const ddx = x - px[j], ddy = y - py[j], ddz = z - pz[j];
          const d2 = ddx * ddx + ddy * ddy + ddz * ddz + 1e-5;
          if (d2 < 0.09) { const w = 1 / d2; sepX += ddx * w; sepY += ddy * w; sepZ += ddz * w; }
        }
        const inv = 1 / kn;
        ax += (avx * inv - vx[i]) * ALIGN_K;
        ay += (avy * inv - vy[i]) * ALIGN_K;
        az += (avz * inv - vz[i]) * ALIGN_K;
        ax += (acx * inv - x) * COHESION_K;
        ay += (acy * inv - y) * COHESION_K;
        az += (acz * inv - z) * COHESION_K;
        ax += sepX * SEP_K * 0.01;
        ay += sepY * SEP_K * 0.01;
        az += sepZ * SEP_K * 0.01;
      }

      // Ambient curl — cheap two-octave sine turbulence.
      ax += (Math.sin(y * 1.9 + t * 0.6) + 0.45 * Math.sin(z * 3.3 - t * 0.9)) * amb;
      ay += (Math.sin(z * 1.6 - t * 0.45) + 0.45 * Math.sin(x * 2.7 + t * 0.75)) * amb;
      az += (Math.sin(x * 2.1 + t * 0.55) + 0.45 * Math.sin(y * 3.0 + t * 1.05)) * amb;

      // Voice coupling — syllabic radial swell (per-particle phase via
      // index hash) + gentle implosion while listening.
      if (speak > 0.01 || listen > 0.01) {
        const vl = speak * (0.6 + 0.4 * Math.sin(t * 6.3 + i * 1.71));
        const il = 1 / (Math.sqrt(x * x + y * y + z * z) + 0.08);
        const vr = (vl - listen * 0.55) * 2.0;
        ax += x * il * vr;
        ay += y * il * vr;
        az += z * il * vr;
      }

      // Cursor repulsion + vertical-axis swirl. Velocity is integrated,
      // not applied as offset — momentum persists after the cursor leaves.
      if (cursorStrength > 0.001) {
        const ddx = x - mx, ddy = y - my, ddz = z - mz;
        const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
        if (d2 < R2 && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const infl = (1 - d / CURSOR_RADIUS);
          const w = infl * infl * cursorStrength * (1 + gust * 0.9);
          ax += (ddx / d) * CURSOR_PUSH * w;
          ay += (ddy / d) * CURSOR_PUSH * w * 0.6;
          az += (ddz / d) * CURSOR_PUSH * w;
          // swirl tangent around world-up through the cursor point
          ax += (-ddz / d) * swr * w;
          az += (ddx / d) * swr * w;
          ay += Math.sin(t * 3 + i * 0.7) * swr * w * 0.4;
        }
      }

      let nvx = (vx[i] + ax * dt) * damp;
      let nvy = (vy[i] + ay * dt) * damp;
      let nvz = (vz[i] + az * dt) * damp;
      const sp2 = nvx * nvx + nvy * nvy + nvz * nvz;
      if (sp2 > MAX_SPEED * MAX_SPEED) {
        const s = MAX_SPEED / Math.sqrt(sp2);
        nvx *= s; nvy *= s; nvz *= s;
      }
      vx[i] = nvx; vy[i] = nvy; vz[i] = nvz;
      px[i] = x + nvx * dt;
      py[i] = y + nvy * dt;
      pz[i] = z + nvz * dt;
    }

    // Write positions back into the packed splat texture.
    if (this.packed) {
      for (let i = 0; i < n; i++) {
        utils.setPackedSplatCenter(this.packed, i, px[i], py[i], pz[i]);
      }
      if (this.packedSplats) this.packedSplats.needsUpdate = true;
    }
  }
}
