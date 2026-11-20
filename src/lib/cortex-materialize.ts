/**
 * cortex-materialize — "pixie dust → matter" birth animation for objects
 * spawned into the 3D scene (scene splats, holo decks).
 *
 * makeMaterializeRig() returns a wrapper Group plus a Points cloud of
 * multicolored dust motes scattered in a shell around the origin.
 * tickMaterialize() implodes the dust into the center while scaling the
 * rig from 0.15 → 1 — the object condenses out of sparkle. After the
 * burst completes the Points are disposed so steady-state cost is zero.
 */
import * as THREE from 'three';

export const MATERIALIZE_DURATION = 1.5;

export interface MaterializeRig {
  /** Wrapper group — position/rotation targets go here, scale is animated. */
  rig: THREE.Group;
  /** Inner content should be added by the caller via rig.add(...). */
  burst: THREE.Points | null;
  /** Seconds since spawn — advanced by tickMaterialize. */
  age: number;
}

const DUST_COLORS = [0xbfe9ff, 0x7dd3fc, 0xa5b4fc, 0xe0f2fe, 0x67e8f9];

export function makeMaterializeRig(count = 260, radius = 1.5): MaterializeRig {
  const rig = new THREE.Group();
  const n = count;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    // Uniform-ish shell: random direction, radius biased toward surface
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const r = radius * (0.35 + Math.random() * 0.75);
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = s * Math.cos(th) * r;
    pos[i * 3 + 1] = u * r;
    pos[i * 3 + 2] = s * Math.sin(th) * r;
    c.setHex(DUST_COLORS[i % DUST_COLORS.length]);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.045,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const burst = new THREE.Points(geo, mat);
  burst.frustumCulled = false;
  rig.add(burst);
  return { rig, burst, age: 0 };
}

/** Advance the materialize animation by `delta` seconds. */
export function tickMaterialize(m: MaterializeRig, delta: number): void {
  if (m.age >= MATERIALIZE_DURATION && !m.burst) return;
  m.age += delta;
  const k = Math.min(1, m.age / MATERIALIZE_DURATION);
  const e = 1 - Math.pow(1 - k, 3); // easeOutCubic — dust rushes in, matter settles
  m.rig.scale.setScalar(0.15 + 0.85 * e);
  if (m.burst) {
    const mat = m.burst.material as THREE.PointsMaterial;
    m.burst.scale.setScalar(Math.max(0.001, 1 - e) * 1.7);
    mat.opacity = 0.95 * (1 - k * k);
    if (k >= 1) {
      m.rig.remove(m.burst);
      m.burst.geometry.dispose();
      mat.dispose();
      m.burst = null;
      m.rig.scale.setScalar(1);
    }
  }
}

/** True when the user asked for reduced motion — callers skip the burst. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
