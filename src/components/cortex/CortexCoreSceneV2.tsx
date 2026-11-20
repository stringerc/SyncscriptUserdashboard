/**
 * CortexCoreSceneV2 — clean-slate hero core for /cortex/visualizer.
 *
 * Built from scratch with one hard rule: NOTHING lives on the equator.
 *   · hero core: displaced fbm sphere, fresnel rim, plasma bands that
 *     precess around a drifting axis (never a fixed latitude ring)
 *   · volumetric mote haze: points filling the BALL, not a shell —
 *     shells project as limb rings, volumes don't
 *   · 3 gyroscopic rings at fixed high inclinations + bead riders
 *   · agent constellation on inclined circular orbits (incl + node)
 *   · lean post stack: bloom + vignette + chromatic aberration only
 *
 * Driven by the same cortexSignalBus LiveSignal as V1.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, BrightnessContrast } from '@react-three/postprocessing';
import * as THREE from 'three';
import {
  cortexSignalBus,
  type CortexSignalBusPayload,
  type CortexVoiceState,
} from './CortexVisualizer';
import { agentsClient, type AgentClient } from '../../lib/cortex-agents-client';
import {
  makeLiveForV2,
  tickLiveForV2,
  type LiveSignalV2,
} from './cortexCoreV2Shared';
import {
  agentWorldPositions,
  memoryWorldPositions,
  MEMORY_DOMAIN_COLORS,
  getMemoryDomain,
  hashMemory,
  chronoNow,
  type ReplayTrackEvent,
} from './CortexCoreScene';

const NOISE_GLSL = /* glsl */ `
  float hash13(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x),
          mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
          mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + vec3(11.3, 7.1, 5.7);
      a *= 0.5;
    }
    return v;
  }
`;

const c = (hex: string) => new THREE.Color(hex);
const HOT = c('#f0f9ff');

// ── Hero core ────────────────────────────────────────────────────────────

// ?v2disp=0 flattens vertex displacement — bisection for the equator hunt
const V2_DISP = typeof window !== 'undefined'
  ? +(new URLSearchParams(window.location.search).get('v2disp') ?? '1')
  : 1;

const coreVert = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uEnergy;
  uniform float uDisp;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  varying float vDisp;
  ${NOISE_GLSL}
  void main() {
    vec3 n = normalize(position);
    float t = uTime * 0.22;
    vec3 q = vec3(
      fbm(n * 1.9 + vec3(0.0, t * 0.8, t * 0.5)),
      fbm(n * 1.9 + vec3(5.2, t * 0.6, -t * 0.7)),
      fbm(n * 1.9 + vec3(1.3, -t * 0.5, t * 0.9))
    );
    float ridge = 1.0 - abs(2.0 * fbm(n * 3.1 + q * 0.9 + vec3(t * 0.35)) - 1.0);
    float detail = vnoise(n * 7.0 + vec3(t, -t * 0.7, t * 0.4));
    float amp = (0.09 + uEnergy * 0.38 + uLevel * 0.7) * (0.75 + 0.25 * sin(uTime * 4.2)) * uDisp;
    float d = (ridge - 0.45) * 0.7 + (detail - 0.5) * 0.22;
    vDisp = clamp(d * amp, -0.45, 0.45);
    vec3 displaced = position + n * vDisp;
    vec4 wp = modelMatrix * vec4(displaced, 1.0);
    vWorld = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vNormal = normalize(normalMatrix * n);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const coreFrag = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uEnergy;
  uniform float uPhi;
  uniform vec3 uColorCore;
  uniform vec3 uColorRim;
  uniform vec3 uColorHot;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  varying float vDisp;
  ${NOISE_GLSL}
  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(vView);
    float fres = pow(1.0 - abs(dot(n, viewDir)), 2.2);
    float energy = 0.5 + uEnergy * 0.55 + uLevel * 0.35;

    // Banding comes from 3D noise on the surface normal — there is no
    // axis, no latitude, no equator. The pattern drifts through the
    // noise field and wraps the whole sphere unevenly.
    float flow = 1.5 + uPhi * 1.4;
    vec3 drift = vec3(uTime * 0.31, -uTime * 0.23, uTime * 0.17) * flow * 0.35;
    float nb = fbm(n * 2.6 + drift);
    float bands = smoothstep(0.32, 0.72, nb);
    float nb2 = fbm(n * 5.2 - drift * 1.7 + vec3(7.3, 2.1, 4.9));
    float bands2 = smoothstep(0.38, 0.78, nb2);
    float mott = fbm(n * 9.0 + drift * 2.3);

    float centerGlow = pow(max(dot(n, viewDir), 0.0), 1.5);
    float crest = smoothstep(0.10, 0.40, vDisp);
    float shimmer = 0.5 + 0.5 * sin(uTime * (2.0 + uPhi * 3.0) + nb * 12.0);

    vec3 col = uColorCore * (0.6 + centerGlow * 1.2);
    col += uColorHot * crest * (0.26 + uLevel * 0.28);
    col += uColorRim * fres * (1.35 + uLevel * 0.55);
    col += uColorRim * (bands * 0.14 + bands2 * 0.09 + mott * 0.05) * energy;
    col += uColorHot * shimmer * uPhi * 0.045 * (0.4 + energy);
    col *= 0.55 + energy * 0.55;
    col = min(col, vec3(1.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function HeroCore({ live }: { live: React.MutableRefObject<LiveSignalV2> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uLevel: { value: 0 },
    uEnergy: { value: 0.4 },
    uDisp: { value: V2_DISP },
    uPhi: { value: 0 },
    uColorCore: { value: c('#124a5e') },
    uColorRim: { value: c('#38d9f5') },
    uColorHot: { value: c('#e0f2fe') },
  }), []);
  useFrame((state, delta) => {
    const sig = live.current;
    const m = meshRef.current;
    if (!m) return;
    uniforms.uTime.value += delta;
    uniforms.uLevel.value = sig.level;
    uniforms.uEnergy.value = sig.energy;
    uniforms.uPhi.value = sig.phiS ?? 0;
    uniforms.uColorCore.value.copy(sig.colorCore);
    uniforms.uColorRim.value.copy(sig.colorRim);
    uniforms.uColorHot.value.copy(sig.colorRim).lerp(HOT, 0.6);
    m.rotation.y += delta * 0.14 * (0.5 + sig.energy);
    m.rotation.x = Math.sin(uniforms.uTime.value * 0.17) * 0.12;
    const s = 1 + sig.level * 0.05 + sig.ingest * 0.06;
    m.scale.setScalar(s);
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 72, 72]} />
      <shaderMaterial vertexShader={coreVert} fragmentShader={coreFrag} uniforms={uniforms} />
    </mesh>
  );
}

// ── Volumetric mote haze (filled ball — no shell, no ring) ──────────────

// quality-tiered inside MoteHaze via perfMode
const moteVert = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uEnergy;
  varying float vGlow;
  float khash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float seed = aSeed;
    // uniform volume: cbrt radius + true spherical coords — no shell
    // (limb ring) and no polar squash (equatorial band)
    float rad = 1.35 + pow(khash(seed * 3.1), 0.34) * 3.4;
    float theta = khash(seed * 5.7) * 6.2831;
    float phi = acos(2.0 * khash(seed * 9.3) - 1.0);
    float sy = sin(phi);
    vec3 base = vec3(
      cos(theta) * sy * rad,
      cos(phi) * rad,
      sin(theta) * sy * rad
    );
    // slow differential drift — motes wander, never orbit a plane
    float sp = 0.05 + khash(seed * 7.9) * 0.12;
    base += vec3(
      sin(uTime * sp + seed * 40.0),
      sin(uTime * sp * 0.8 + seed * 17.0) * 0.7,
      cos(uTime * sp * 1.1 + seed * 23.0)
    ) * 0.35;
    vec4 mv = modelViewMatrix * vec4(base, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = (0.8 + khash(seed * 11.7) * 1.6) * (1.0 + uEnergy * 0.5);
    gl_PointSize = size * uPixelRatio * (46.0 / -mv.z);
    vGlow = 0.25 + 0.75 * khash(seed * 13.1);
  }
`;
const moteFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vGlow;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.08, d) * vGlow * 0.5;
    gl_FragColor = vec4(uColor * a * 1.5, a);
  }
`;

function MoteHaze({ live, perfMode }: {
  live: React.MutableRefObject<LiveSignalV2>;
  perfMode?: 'ultra' | 'smooth' | 'cinematic';
}) {
  const count = perfMode === 'ultra' ? 2200 : perfMode === 'smooth' ? 900 : 1600;
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = Math.random();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return g;
  }, [count]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uEnergy: { value: 0.3 },
      uColor: { value: c('#38d9f5') },
    },
    vertexShader: moteVert,
    fragmentShader: moteFrag,
  }), []);
  useFrame((state, delta) => {
    const sig = live.current;
    material.uniforms.uTime.value += delta;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    material.uniforms.uEnergy.value = sig.energy;
    material.uniforms.uColor.value.copy(sig.colorRim).lerp(c('#ffffff'), 0.3);
  });
  return <points geometry={geo} material={material} frustumCulled={false} />;
}

// ── Orbit rings — fixed high inclinations, never equatorial ─────────────

// incl rotates the XY-plane torus about X: 90° would lay it flat on the
// equator, so all inclinations stay well under that.
const RING_SPECS = [
  { radius: 1.75, tube: 0.006, incl: THREE.MathUtils.degToRad(14), node: 0.4, speed: 0.35, phase: 0 },
  { radius: 2.3, tube: 0.005, incl: THREE.MathUtils.degToRad(34), node: 2.4, speed: -0.22, phase: 2.1 },
  { radius: 2.9, tube: 0.004, incl: THREE.MathUtils.degToRad(54), node: 4.4, speed: 0.16, phase: 4.2 },
];

const ringFrag = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uEnergy;
  uniform vec3 uColor;
  uniform float uBeads;
  varying vec2 vUv;
  void main() {
    float flow = pow(0.5 + 0.5 * sin(vUv.x * 6.2831 * uBeads - uTime * 2.0), 6.0);
    float base = 0.04 + uEnergy * 0.08 + uLevel * 0.18;
    float a = base + flow * (0.4 + uLevel * 0.7);
    float edge = smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
    gl_FragColor = vec4(uColor * a * edge * 2.0, a * edge);
  }
`;

function OrbitRings({ live }: { live: React.MutableRefObject<LiveSignalV2> }) {
  return (
    <>
      {RING_SPECS.map((spec, i) => (
        <Ring key={i} spec={spec} live={live} index={i} />
      ))}
    </>
  );
}

function Ring({ spec, live, index }: {
  spec: typeof RING_SPECS[number];
  live: React.MutableRefObject<LiveSignalV2>;
  index: number;
}) {
  const beadRef = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: spec.phase * 10 },
      uLevel: { value: 0 },
      uEnergy: { value: 0.2 },
      uColor: { value: c('#22d3ee') },
      uBeads: { value: 3 + index },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: ringFrag,
  }), [spec, index]);

  useFrame((state, delta) => {
    const sig = live.current;
    material.uniforms.uTime.value += delta;
    material.uniforms.uLevel.value = sig.level;
    material.uniforms.uEnergy.value = sig.energy;
    material.uniforms.uColor.value.copy(sig.colorRim);
    if (beadRef.current) {
      // bead rides the torus in ring-local space; parent groups apply
      // node/inclination, so the local position is just the circle.
      const a = material.uniforms.uTime.value * spec.speed * 0.9 + spec.phase;
      beadRef.current.position.set(Math.cos(a) * spec.radius, Math.sin(a) * spec.radius, 0);
    }
  });

  return (
    <group rotation={[0, spec.node, 0]}>
      <group rotation={[spec.incl, 0, 0]}>
        <mesh material={material}>
          <torusGeometry args={[spec.radius, spec.tube, 8, 220]} />
        </mesh>
        <mesh ref={beadRef}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshBasicMaterial color="#dff6ff" transparent opacity={0.95} />
        </mesh>
      </group>
    </group>
  );
}

// ── Agent constellation — glowing motes on inclined orbits ──────────────

const AGENT_COUNT = 14;
const TRAIL_LEN = 26;

// agent name-tag textures — canvas-backed, regenerated only on rename
const labelTexCache = new Map<string, THREE.CanvasTexture>();
function agentLabelTexture(name: string, color: string): THREE.CanvasTexture {
  const key = `${name}|${color}`;
  const hit = labelTexCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 56;
  const ctx = cv.getContext('2d')!;
  ctx.font = '600 22px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.fillText(name.toUpperCase().slice(0, 18), 128, 28);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  labelTexCache.set(key, tex);
  return tex;
}
const trailMat = new THREE.LineBasicMaterial({
  vertexColors: true, transparent: true, opacity: 0.5,
  blending: THREE.AdditiveBlending, depthWrite: false,
});

function AgentField({ live, nightMode, selectedAgentId, onSelectAgent }: {
  live: React.MutableRefObject<LiveSignalV2>;
  nightMode?: boolean;
  selectedAgentId?: string | null;
  onSelectAgent?: (id: string | null) => void;
}) {
  const { scene } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const labels = useRef<(THREE.Sprite | null)[]>([]);
  const hoverRef = useRef<number>(-1);
  const nameRefs = useRef<string[]>([]);
  const agentsRef = useRef<AgentClient[]>([]);
  const trailRefs = useRef<{ line: THREE.Line; pos: Float32Array; col: Float32Array; head: number }[]>([]);
  const params = useMemo(() => Array.from({ length: AGENT_COUNT }, (_, i) => ({
    radius: 2.0 + (i % 3) * 0.45 + ((i * 37) % 10) * 0.04,
    speed: (0.16 + ((i * 13) % 10) * 0.02) * (i % 2 === 0 ? 1 : -1),
    incl: (((i * 61) % 100) / 100 - 0.5) * 2.2,
    node: ((i * 47) % 100) / 100 * Math.PI * 2,
    phase: ((i * 29) % 100) / 100 * Math.PI * 2,
    color: new THREE.Color().setHSL((i * 0.13) % 1, 0.7, 0.65),
  })), []);

  React.useEffect(() => {
    const sync = () => {
      agentsRef.current = (agentsClient.snapshot.agents || []).slice(0, AGENT_COUNT);
    };
    agentsClient.start();
    sync();
    return agentsClient.subscribe(sync);
  }, []);

  React.useEffect(() => () => {
    trailRefs.current.forEach((tr) => {
      scene.remove(tr.line);
      tr.line.geometry.dispose();
    });
    trailRefs.current = [];
  }, [scene]);

  useFrame((state, delta) => {
    const sig = live.current;
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.04 * (0.4 + sig.energy);
    }
    params.forEach((p, i) => {
      const sprite = sprites.current[i];
      if (!sprite) return;
      const agent = agentsRef.current[i];
      const id = agent?.id || `v2-agent-${i}`;
      const boost = (hoverRef.current === i || selectedAgentId === id) ? 1.35 : 1;
      // Night mode: constellation orbs burn brighter + larger so the neon
      // postfx has more emissive sources to bloom.
      const neon = nightMode ? 1.45 : 1;
      const a = t * p.speed + p.phase;
      const ca = Math.cos(a), sa = Math.sin(a);
      const si = Math.sin(p.incl), ci = Math.cos(p.incl);
      const nx = Math.cos(p.node), nz = Math.sin(p.node);
      const ox = ca * p.radius, oy = sa * p.radius * si, oz = sa * p.radius * ci;
      sprite.position.set(ox * nx + oz * nz, oy, -ox * nz + oz * nx);
      const m = sprite.material as THREE.SpriteMaterial;
      if (agent) {
        const wrk = agent.status === 'working';
        const err = agent.status === 'error';
        const dim = agent.status === 'offline' || agent.status === 'retired';
        const pulse = wrk ? 1 + 0.18 * Math.sin(t * 6 + i) : 1 + 0.05 * Math.sin(t * 2 + i);
        sprite.scale.setScalar((wrk ? 0.34 : 0.24) * pulse * boost * Math.sqrt(neon));
        m.color.copy(err ? c('#f43f5e') : p.color);
        m.opacity = dim ? Math.min(1, 0.15 * neon) : Math.min(1, (wrk ? 0.9 : 0.55) * neon);
      } else {
        sprite.scale.setScalar((0.14 + 0.03 * Math.sin(t * 2.2 + i)) * boost * Math.sqrt(neon));
        m.color.copy(sig.colorRim).lerp(c('#ffffff'), 0.4);
        m.opacity = Math.min(1, (0.25 + 0.1 * Math.sin(t * 1.8 + i)) * neon);
      }
      // name tag rides beneath the sprite
      const label = labels.current[i];
      if (label) {
        label.position.set(sprite.position.x, sprite.position.y - 0.52, sprite.position.z);
        const lname = agent?.name || agent?.id || `AGENT ${i + 1}`;
        if (nameRefs.current[i] !== lname) {
          nameRefs.current[i] = lname;
          const lm = label.material as THREE.SpriteMaterial;
          lm.map = agentLabelTexture(lname, m.color.getStyle());
          lm.needsUpdate = true;
        }
        const lm = label.material as THREE.SpriteMaterial;
        lm.opacity = selectedAgentId === id ? 0.95 : hoverRef.current === i ? 0.85 : agent ? 0.5 : 0;
        label.visible = !!agent;
      }
      // publish world position for chrono-replay camera chase (V1 contract)
      if (!agentWorldPositions[id]) agentWorldPositions[id] = new THREE.Vector3();
      sprite.getWorldPosition(agentWorldPositions[id]);
      // trail: shift-buffer recent world positions into a fading line
      if (!trailRefs.current[i]) {
        const pos = new Float32Array(TRAIL_LEN * 3);
        const col = new Float32Array(TRAIL_LEN * 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const line = new THREE.Line(g, trailMat);
        line.frustumCulled = false;
        scene.add(line); // world-space positions — must NOT inherit rig rotation
        trailRefs.current[i] = { line, pos, col, head: 0 };
      }
      const tr = trailRefs.current[i];
      tr.pos.copyWithin(0, 3);
      tr.pos[(TRAIL_LEN - 1) * 3] = agentWorldPositions[id].x;
      tr.pos[(TRAIL_LEN - 1) * 3 + 1] = agentWorldPositions[id].y;
      tr.pos[(TRAIL_LEN - 1) * 3 + 2] = agentWorldPositions[id].z;
      const base = sig.colorRim;
      for (let k = 0; k < TRAIL_LEN; k++) {
        const f = (k / (TRAIL_LEN - 1)) * 0.8;
        tr.col[k * 3] = base.r * f;
        tr.col[k * 3 + 1] = base.g * f;
        tr.col[k * 3 + 2] = base.b * f;
      }
      tr.line.geometry.attributes.position.needsUpdate = true;
      tr.line.geometry.attributes.color.needsUpdate = true;
    });
  });

  return (
    <group ref={groupRef}>
      {params.map((p, i) => (
        <React.Fragment key={i}>
          <sprite
            ref={(el) => { sprites.current[i] = el; }}
            onClick={(e) => {
              e.stopPropagation();
              const agent = agentsRef.current[i];
              const id = agent?.id || `v2-agent-${i}`;
              onSelectAgent?.(selectedAgentId === id ? null : id);
            }}
            onPointerOver={(e) => { e.stopPropagation(); hoverRef.current = i; document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { if (hoverRef.current === i) hoverRef.current = -1; document.body.style.cursor = ''; }}
          >
            <spriteMaterial map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <sprite ref={(el) => { labels.current[i] = el; }} scale={[1.6, 0.35, 1]} visible={false}>
            <spriteMaterial map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </React.Fragment>
      ))}
    </group>
  );
}

let _glowTex: THREE.CanvasTexture | null = null;
function glowTexture(): THREE.CanvasTexture {
  if (_glowTex) return _glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(cv);
  return _glowTex;
}

// ── Murmuration — shape-shifting orb flocks (boids-lite, GPU) ───────────
// Each particle orbits a wandering attractor on its own inclined plane
// with differential rotation speed. Radii breathe through noise so the
// cloud continuously morphs; energy kicks fire a scarecrow burst.

const murmurVert = /* glsl */ `
  attribute float aSeed;
  attribute float aSeed2;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uEnergy;
  uniform float uKick;
  uniform vec3 uCenter;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vGlow;
  varying vec3 vColor;
  float khash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float seed = aSeed;
    float seed2 = aSeed2;

    // flock heading: attractor sweeps waypoint-to-waypoint across the sky
    vec3 center = uCenter;

    // scarecrow: kicks inflate the whole cloud, then it regroups
    float scare = uKick * uKick * 2.4;

    // per-boid orbital plane + radius band
    float incl = (khash(seed * 3.7) - 0.5) * 2.4;
    float node = khash(seed * 5.1) * 6.2831;
    float baseR = (2.6 + khash(seed * 7.9) * 2.2) * (1.0 + scare * (0.4 + khash(seed2 * 9.3)));
    // breathing radius — the murmuration never holds a shape
    float breathe = 0.72 + 0.38 * sin(uTime * (0.14 + khash(seed * 11.7) * 0.22) + seed * 40.0);
    float rad = baseR * breathe;

    // differential rotation — inner faster, sheets shear past each other
    float dir = khash(seed * 13.3) > 0.5 ? 1.0 : -1.0;
    float ang = seed * 40.0 + uTime * dir * (0.22 + khash(seed * 17.9) * 0.4) * (2.8 / max(rad, 0.4));

    // position on inclined circle, then slight vertical bob (wingbeat-ish)
    float ca = cos(ang), sa = sin(ang);
    float si = sin(incl), ci = cos(incl);
    float ox = ca * rad, oy = sa * rad * si, oz = sa * rad * ci;
    float nx = cos(node), nz = sin(node);
    vec3 p = center + vec3(ox * nx + oz * nz, oy + sin(uTime * (2.0 + khash(seed2 * 3.1) * 3.0) + seed * 20.0) * 0.16, -ox * nz + oz * nx);

    // mild separation jitter so the cloud isn't a perfect shell
    p += vec3(
      sin(seed * 91.0 + uTime * 0.9),
      sin(seed * 57.0 - uTime * 0.7),
      cos(seed * 73.0 + uTime * 0.8)
    ) * 0.22;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = (0.9 + khash(seed * 19.7) * 1.4) * (1.0 + uEnergy * 0.4);
    gl_PointSize = size * uPixelRatio * (64.0 / -mv.z);
    vGlow = 0.55 + 0.45 * khash(seed2 * 23.9);
    // hot white core fading to rim-tinted edge — readable at any angle
    vColor = mix(vec3(1.0), uColorB, khash(seed * 29.1) * 0.55);
  }
`;
const murmurFrag = /* glsl */ `
  uniform float uOpacity;
  varying float vGlow;
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    // tighter falloff = denser-looking orb, less thin haze
    float a = smoothstep(0.5, 0.0, d) * vGlow * uOpacity;
    gl_FragColor = vec4(vColor * a * 2.2, a);
  }
`;

function MurmurationV2({ live, perfMode }: {
  live: React.MutableRefObject<LiveSignalV2>;
  perfMode?: 'ultra' | 'smooth' | 'cinematic';
}) {
  const count = perfMode === 'ultra' ? 5200 : perfMode === 'smooth' ? 1600 : 3200;
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uPixelRatio: { value: 1 }, uEnergy: { value: 0.4 },
      uKick: { value: 0 }, uOpacity: { value: 0.75 },
      uCenter: { value: new THREE.Vector3(0, 0.4, -3.5) },
      uColorA: { value: c('#38d9f5') }, uColorB: { value: c('#a78bfa') },
    },
    vertexShader: murmurVert, fragmentShader: murmurFrag,
  }), []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const s1 = new Float32Array(count), s2 = new Float32Array(count);
    for (let i = 0; i < count; i++) { s1[i] = Math.random(); s2[i] = Math.random(); }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(s1, 1));
    g.setAttribute('aSeed2', new THREE.BufferAttribute(s2, 1));
    return g;
  }, [count]);
  const kickSmooth = useRef(0);
  // flock heading state: waypoint target + sweep direction
  const wp = useRef({
    pos: new THREE.Vector3(0, 0.4, -3.5),
    target: new THREE.Vector3(4.5, 0.2, -2.0),
    dir: 1,
    timer: 0,
  });
  useFrame((state, delta) => {
    const sig = live.current;
    material.uniforms.uTime.value += delta;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    material.uniforms.uEnergy.value = sig.energy;
    kickSmooth.current += (sig.kick - kickSmooth.current) * Math.min(1, delta * 3);
    material.uniforms.uKick.value = kickSmooth.current;
    material.uniforms.uOpacity.value = 0.55 + sig.energy * 0.3;
    material.uniforms.uColorA.value.copy(sig.colorRim);
    material.uniforms.uColorB.value.copy(sig.colorRim).lerp(c('#a78bfa'), 0.6);

    // waypoint steering: long sweeps across the sky, alternating direction
    const w = wp.current;
    w.timer -= delta;
    if (w.timer <= 0) {
      w.dir *= -1; // turn around — dash left, then all the way right
      w.target.set(
        w.dir * (3.8 + Math.random() * 2.6),
        (Math.random() - 0.5) * 2.0,
        (Math.random() - 0.5) * 3.4 - 1.2
      );
      w.timer = 7 + Math.random() * 6;
    }
    // steady dash: ~7s travel matches the waypoint timer, always in motion
    const k = Math.min(1, delta * 0.3);
    w.pos.lerp(w.target, k);
    material.uniforms.uCenter.value.copy(w.pos);
  });
  return <points geometry={geo} material={material} frustumCulled={false} />;
}

// ── Memory engram constellation (V1 parity, V2-native) ──────────────────

function MemoryBankV2({ live, selectedMemoryId, onSelectMemory }: {
  live: React.MutableRefObject<LiveSignalV2>;
  selectedMemoryId?: string | null;
  onSelectMemory?: (id: string | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const [graphData, setGraphData] = React.useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });

  React.useEffect(() => {
    let active = true;
    const fetchGraph = async () => {
      try {
        const res = await fetch('/api/cortex/memory/graph');
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.ok && Array.isArray(data.nodes)) {
          setGraphData({ nodes: data.nodes, edges: data.edges || [] });
        }
      } catch { /* fail-soft */ }
    };
    fetchGraph();
    const interval = setInterval(fetchGraph, 8000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const orbs = useMemo(() => (graphData.nodes || []).slice(0, 48).map((n) => {
    const data = n.data || {};
    const id = String(data.id || Math.random());
    const label = String(data.label || 'Memory Engram');
    const context = String(data.context || 'cortex-runtime');
    const entities = String(data.entities || '');
    const domain = getMemoryDomain(context, label, entities);
    const hash = hashMemory(id);
    const domainBaseR = domain === 'runtime' ? 2.3 : domain === 'system' ? 2.85 : domain === 'venture' ? 3.4 : domain === 'working' ? 3.95 : 4.5;
    return {
      id, label,
      radius: domainBaseR + ((hash % 10) * 0.05),
      speed: (0.05 + ((hash >> 3) % 8) * 0.012) * ((hash % 2 === 0) ? 1 : -1),
      incl: (((hash >> 6) % 100) / 50 - 1) * 1.2,
      node: (((hash >> 14) % 1000) / 1000) * Math.PI * 2,
      phase: ((hash >> 10) % 360) * (Math.PI / 180),
      color: new THREE.Color(MEMORY_DOMAIN_COLORS[domain]),
    };
  }), [graphData]);

  useFrame((state, delta) => {
    const sig = live.current;
    const t = state.clock.elapsedTime;
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.03;
    orbs.forEach((o, i) => {
      const sprite = sprites.current[i];
      if (!sprite) return;
      const a = t * o.speed + o.phase;
      const ca = Math.cos(a), sa = Math.sin(a);
      const si = Math.sin(o.incl), ci = Math.cos(o.incl);
      const nx = Math.cos(o.node), nz = Math.sin(o.node);
      const ox = ca * o.radius, oy = sa * o.radius * si, oz = sa * o.radius * ci;
      sprite.position.set(ox * nx + oz * nz, oy, -ox * nz + oz * nx);
      const m = sprite.material as THREE.SpriteMaterial;
      const sel = selectedMemoryId === o.id;
      sprite.scale.setScalar(sel ? 0.4 : 0.2 + 0.04 * Math.sin(t * 1.6 + i));
      m.color.copy(sel ? c('#ffffff') : o.color);
      m.opacity = sel ? 0.95 : 0.4 + sig.energy * 0.15;
      if (!memoryWorldPositions[o.id]) memoryWorldPositions[o.id] = new THREE.Vector3();
      sprite.getWorldPosition(memoryWorldPositions[o.id]);
    });
  });

  return (
    <group ref={groupRef}>
      {orbs.map((o, i) => (
        <sprite
          key={o.id}
          ref={(el) => { sprites.current[i] = el; }}
          onClick={(e) => { e.stopPropagation(); onSelectMemory?.(selectedMemoryId === o.id ? null : o.id); }}
        >
          <spriteMaterial map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
  );
}

// ── Shockwaves — expanding rings on state kicks / discrete events ───────

interface V2Shock { mesh: THREE.Mesh; t: number; maxR: number }

function ShockwavesV2({ live }: { live: React.MutableRefObject<LiveSignalV2> }) {
  const groupRef = useRef<THREE.Group>(null);
  const shocks = useRef<V2Shock[]>([]);
  const matProto = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#7dd3fc', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }), []);
  const lastSeq = useRef(0);
  const tmpDir = useMemo(() => new THREE.Vector3(), []);

  const spawn = useCallback((dirY = 0) => {
    const g = groupRef.current;
    if (!g || shocks.current.length >= 6) return;
    const dir = tmpDir.set(
      Math.random() * 2 - 1, dirY + (Math.random() - 0.5) * 0.8, Math.random() * 2 - 1,
    ).normalize();
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 64), matProto.clone());
    mesh.position.copy(dir).multiplyScalar(1.02);
    mesh.lookAt(0, 0, 0);
    g.add(mesh);
    shocks.current.push({ mesh, t: 0, maxR: 2.2 + Math.random() * 1.6 });
  }, [matProto, tmpDir]);

  useFrame((_, delta) => {
    const sig = live.current;
    if (sig.eventSeq !== lastSeq.current) { lastSeq.current = sig.eventSeq; spawn(); }
    else if (sig.kick > 0.55) spawn(0.3);
    for (let i = shocks.current.length - 1; i >= 0; i--) {
      const s = shocks.current[i];
      s.t += delta * (1.6 + sig.energy);
      const p = Math.min(1, s.t);
      const e = 1 - Math.pow(1 - p, 3);
      s.mesh.scale.setScalar(0.4 + e * s.maxR);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.5;
      if (p >= 1) {
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
        groupRef.current?.remove(s.mesh);
        shocks.current.splice(i, 1);
      }
    }
  });

  return <group ref={groupRef} />;
}

// ── Neural web — drifting nodes + proximity filaments ───────────────────

const WEB_NODES = 90;

function NeuralWebV2({ live }: { live: React.MutableRefObject<LiveSignalV2> }) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const nodesRef = useRef<{ p: THREE.Vector3; s: number }[]>([]);
  const positions = useMemo(() => new Float32Array(WEB_NODES * WEB_NODES * 3), []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);
  const mat = useMemo(() => new THREE.LineBasicMaterial({
    color: '#38bdf8', transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), []);
  const rebuildFrame = useRef(0);

  if (nodesRef.current.length === 0) {
    nodesRef.current = Array.from({ length: WEB_NODES }, (_, i) => {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(1.7 + ((i * 37) % 10) * 0.09);
      return { p: v, s: 0.05 + ((i * 13) % 10) * 0.012 };
    });
  }

  useFrame((state, delta) => {
    const sig = live.current;
    const t = state.clock.elapsedTime;
    const nodes = nodesRef.current;
    for (const n of nodes) {
      n.p.x += Math.sin(t * n.s + n.p.y * 3.1) * delta * 0.35;
      n.p.y += Math.cos(t * n.s * 0.8 + n.p.z * 2.7) * delta * 0.3;
      n.p.z += Math.sin(t * n.s * 1.1 + n.p.x * 2.3) * delta * 0.35;
      const l = n.p.length();
      if (l > 2.9 || l < 1.2) n.p.multiplyScalar(2.0 / Math.max(l, 0.001));
    }
    rebuildFrame.current += delta;
    if (rebuildFrame.current > 0.4 && lineRef.current) {
      rebuildFrame.current = 0;
      let w = 0;
      for (let i = 0; i < WEB_NODES && w < positions.length / 3 - 6; i++) {
        for (let j = i + 1; j < WEB_NODES && w < positions.length / 3 - 6; j++) {
          if (nodes[i].p.distanceToSquared(nodes[j].p) < 0.35) {
            positions[w * 3] = nodes[i].p.x; positions[w * 3 + 1] = nodes[i].p.y; positions[w * 3 + 2] = nodes[i].p.z;
            positions[w * 3 + 3] = nodes[j].p.x; positions[w * 3 + 4] = nodes[j].p.y; positions[w * 3 + 5] = nodes[j].p.z;
            w += 2;
          }
        }
      }
      // zero-fill the tail so stale segments don't linger
      for (let k = w * 3; k < positions.length; k++) positions[k] = 0;
      lineRef.current.geometry.attributes.position.needsUpdate = true;
      lineRef.current.geometry.setDrawRange(0, w * 2);
    }
    mat.opacity = 0.08 + sig.energy * 0.12 + Math.min(sig.kick, 1) * 0.2;
    mat.color.copy(sig.colorRim).lerp(c('#ffffff'), 0.35);
  });

  return <lineSegments ref={lineRef} geometry={geo} material={mat} frustumCulled={false} />;
}

// ── Thought swarm — particles spiralling into the core ──────────────────

const thoughtVert = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uEnergy;
  varying float vGlow;
  float khash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float seed = aSeed;
    float life = fract(uTime * (0.03 + khash(seed * 3.3) * 0.05) + seed);
    float ang = seed * 40.0 + uTime * (0.25 + khash(seed * 7.1) * 0.4) * (khash(seed * 5.5) > 0.5 ? 1.0 : -1.0);
    float rad = mix(3.6, 0.9, pow(life, 0.8)) * (0.7 + khash(seed * 9.9) * 0.6);
    vec3 p = vec3(cos(ang) * rad, sin(ang * 0.7 + seed * 9.0) * rad * 0.55, sin(ang) * rad);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.6 + khash(seed * 11.3) * 1.1) * uPixelRatio * (40.0 / -mv.z) * (1.0 - life * 0.6);
    vGlow = (1.0 - life) * (0.3 + uEnergy * 0.5);
  }
`;
const thoughtFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vGlow;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.05, length(uv)) * vGlow * 0.55;
    gl_FragColor = vec4(uColor * a * 1.6, a);
  }
`;

function ThoughtSwarmV2({ live, perfMode }: {
  live: React.MutableRefObject<LiveSignalV2>;
  perfMode?: 'ultra' | 'smooth' | 'cinematic';
}) {
  const count = perfMode === 'ultra' ? 700 : perfMode === 'smooth' ? 300 : 500;
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uPixelRatio: { value: 1 }, uEnergy: { value: 0.4 },
      uColor: { value: c('#c4b5fd') },
    },
    vertexShader: thoughtVert, fragmentShader: thoughtFrag,
  }), []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = Math.random();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return g;
  }, [count]);
  useFrame((state, delta) => {
    const sig = live.current;
    material.uniforms.uTime.value += delta;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    material.uniforms.uEnergy.value = sig.energy;
    material.uniforms.uColor.value.copy(sig.colorRim).lerp(c('#c4b5fd'), 0.5);
  });
  return <points geometry={geo} material={material} frustumCulled={false} />;
}

// ── Distant model constellation — labelled-core glyphs on wide orbits ───

function ModelConstellationV2({ live }: { live: React.MutableRefObject<LiveSignalV2> }) {
  const groupRef = useRef<THREE.Group>(null);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const params = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    radius: 6.2 + ((i * 29) % 10) * 0.22,
    speed: (0.05 + ((i * 17) % 10) * 0.008) * (i % 2 === 0 ? 1 : -1),
    incl: (((i * 41) % 100) / 100 - 0.5) * 1.8,
    node: ((i * 23) % 100) / 100 * Math.PI * 2,
    phase: ((i * 31) % 100) / 100 * Math.PI * 2,
    color: new THREE.Color().setHSL((i * 0.11 + 0.55) % 1, 0.65, 0.6),
  })), []);
  useFrame((state, delta) => {
    const sig = live.current;
    const t = state.clock.elapsedTime;
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.02;
    params.forEach((p, i) => {
      const sprite = sprites.current[i];
      if (!sprite) return;
      const a = t * p.speed + p.phase;
      const ca = Math.cos(a), sa = Math.sin(a);
      const si = Math.sin(p.incl), ci = Math.cos(p.incl);
      const nx = Math.cos(p.node), nz = Math.sin(p.node);
      const ox = ca * p.radius, oy = sa * p.radius * si, oz = sa * p.radius * ci;
      sprite.position.set(ox * nx + oz * nz, oy, -ox * nz + oz * nx);
      const m = sprite.material as THREE.SpriteMaterial;
      sprite.scale.setScalar(0.5 + 0.06 * Math.sin(t * 0.9 + i * 2));
      m.color.copy(p.color).lerp(sig.colorRim, 0.3);
      m.opacity = 0.28 + sig.energy * 0.2;
    });
  });
  return (
    <group ref={groupRef}>
      {params.map((_, i) => (
        <sprite key={i} ref={(el) => { sprites.current[i] = el; }}>
          <spriteMaterial map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
  );
}

// ── Scene root ───────────────────────────────────────────────────────────

const CHRONO_SEG_V2 = 1.4;

function V2Scene({ live, headParallax, visualMode, chronoTime, replayTrack, perfMode, nightMode, selectedAgentId, onSelectAgent, selectedMemoryId, onSelectMemory }: {
  live: React.MutableRefObject<LiveSignalV2>;
  headParallax?: { x: number; y: number } | null;
  visualMode?: 'fleet' | 'memory' | 'both';
  chronoTime?: number | null;
  replayTrack?: ReplayTrackEvent[] | null;
  perfMode?: 'ultra' | 'smooth' | 'cinematic';
  nightMode?: boolean;
  selectedAgentId?: string | null;
  onSelectAgent?: (id: string | null) => void;
  selectedMemoryId?: string | null;
  onSelectMemory?: (id: string | null) => void;
}) {
  const { scene, camera, gl } = useThree();
  React.useEffect(() => {
    (window as any).__v2debug = { scene, camera, orbit, cur };
  }, [scene, camera]);
  const rigRef = useRef<THREE.Group>(null);

  // Orbit rig: drag rotates, wheel zooms, idle keeps a slow cinematic drift.
  // userYaw/userPitch/userZoom are persistent offsets; the drift term is
  // added on top so the camera never stops breathing.
  const orbit = useRef({
    yaw: typeof window !== 'undefined' ? +(new URLSearchParams(window.location.search).get('v2yaw') || 0) : 0,
    pitch: 0.06, zoom: 5.5, dragging: false, lx: 0, ly: 0,
  });
  const cur = useRef({ yaw: 0, pitch: 0.06, zoom: 0 });

  React.useEffect(() => {
    const el = gl.domElement;
    const o = orbit.current;
    const onDown = (e: PointerEvent) => {
      o.dragging = true; o.lx = e.clientX; o.ly = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };
    const onMove = (e: PointerEvent) => {
      if (!o.dragging) return;
      const dx = e.clientX - o.lx, dy = e.clientY - o.ly;
      o.lx = e.clientX; o.ly = e.clientY;
      o.yaw -= dx * 0.0052;
      o.pitch = THREE.MathUtils.clamp(o.pitch + dy * 0.004, -1.15, 1.15);
    };
    const onUp = (e: PointerEvent) => {
      o.dragging = false;
      el.style.cursor = 'grab';
      try { el.releasePointerCapture(e.pointerId); } catch {}
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      o.zoom = THREE.MathUtils.clamp(o.zoom + e.deltaY * 0.004, -3.6, 5.5);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.style.cursor = 'grab';
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [gl]);

  const chase = useRef({ pos: new THREE.Vector3(0, 0.3, 5.6), look: new THREE.Vector3() });
  const introT = useRef(0); // 0→1 cinematic dolly on mount (skipped during chrono)
  useFrame((state, delta) => {
    const sig = live.current;
    const t = state.clock.elapsedTime;
    const o = orbit.current;
    const px = headParallax ? headParallax.x : 0;
    const py = headParallax ? headParallax.y : 0;

    // 4D chrono replay: walk real persisted events, chase each agent.
    if (chronoTime != null && chronoTime >= 0) {
      if (replayTrack && replayTrack.length > 0) {
        const idx = Math.min(Math.floor(chronoTime / CHRONO_SEG_V2), replayTrack.length - 1);
        const ev = replayTrack[idx];
        chronoNow.seq = ev.seq; chronoNow.type = ev.type; chronoNow.agentId = ev.agentId;
        const pos = ev.agentId ? agentWorldPositions[ev.agentId] : null;
        if (pos) {
          chase.current.look.lerp(pos, Math.min(1, delta * 3.8));
          const radial = pos.clone().normalize();
          if (radial.lengthSq() < 0.001) radial.set(0, 0, 1);
          const desired = pos.clone().addScaledVector(radial, 2.6);
          desired.y += 0.65 + Math.sin(t * 1.5) * 0.04;
          chase.current.pos.lerp(desired, Math.min(1, delta * 3.2));
          state.camera.position.lerp(chase.current.pos, Math.min(1, delta * 3.2));
          state.camera.lookAt(chase.current.look);
        } else {
          chronoNow.seq = ev.seq; chronoNow.type = ev.type; chronoNow.agentId = ev.agentId;
          chase.current.look.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, delta * 2.4));
          chase.current.pos.lerp(new THREE.Vector3(0, 0.3, 5.6), Math.min(1, delta * 2.6));
          state.camera.position.lerp(chase.current.pos, Math.min(1, delta * 2.6));
          state.camera.lookAt(chase.current.look);
        }
        return;
      }
      chronoNow.seq = 0; chronoNow.type = ''; chronoNow.agentId = null;
      // scripted fallback reel — gentle orbit pull-back
      const p = Math.min(1, chronoTime / 8);
      const ang = 0.5 + p * 0.8;
      const dist = 5.2 - p * 0.8;
      chase.current.pos.set(dist * Math.sin(ang), 1.8 - p * 0.4, dist * Math.cos(ang));
      chase.current.look.set(0, 0, 0);
      state.camera.position.lerp(chase.current.pos, Math.min(1, delta * 2.2));
      state.camera.lookAt(chase.current.look);
      return;
    }
    chronoNow.seq = 0; chronoNow.type = ''; chronoNow.agentId = null;

    // intro dolly: sweep in from deep space on first load
    if (introT.current < 1 && !(chronoTime != null && chronoTime >= 0)) {
      introT.current = Math.min(1, introT.current + delta / 2.4);
      o.zoom *= Math.exp(-delta * 1.7);
      if (introT.current >= 1) o.zoom = 0;
    }

    // desired spherical position: slow drift yaw + user offsets
    const drift = t * 0.018 * (0.4 + sig.energy * 0.6);
    const yawT = o.yaw + drift;
    const pitchT = o.pitch;
    const rT = THREE.MathUtils.clamp(8.4 + o.zoom, 4.6, 14.5);
    const k = Math.min(1, delta * (o.dragging ? 14 : 4));
    cur.current.yaw += (yawT - cur.current.yaw) * k;
    cur.current.pitch += (pitchT - cur.current.pitch) * k;
    cur.current.zoom += (rT - cur.current.zoom) * k;

    const r = cur.current.zoom;
    const cp = Math.cos(cur.current.pitch);
    state.camera.position.set(
      r * cp * Math.sin(cur.current.yaw) + px * 0.6,
      r * Math.sin(cur.current.pitch) + 0.35 + py * 0.4,
      r * cp * Math.cos(cur.current.yaw)
    );
    state.camera.lookAt(0, 0, 0);
    // energy-reactive FOV: the whole frame breathes with the voice
    const cam = state.camera as THREE.PerspectiveCamera;
    const fovT = 42 + sig.energy * 1.6 + sig.level * 2.4 + Math.min(sig.kick, 1) * 1.2;
    if (Math.abs(cam.fov - fovT) > 0.01) {
      cam.fov += (fovT - cam.fov) * Math.min(1, delta * 3);
      cam.updateProjectionMatrix();
    }
    if (rigRef.current) {
      rigRef.current.rotation.y += delta * 0.02 * (0.4 + sig.energy);
    }
    // Night mode's darkness lives in the composer (BrightnessContrast
    // below) — renderer exposure is bypassed by the postprocessing chain.
  });
  // ?v2hide=core,motes,rings,agents — layer bisection for the equator hunt
  const hidden = useMemo(() => {
    if (typeof window === 'undefined') return new Set<string>();
    return new Set((new URLSearchParams(window.location.search).get('v2hide') || '').split(',').filter(Boolean));
  }, []);
  const postOff = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('v2post') === 'off';
  return (
    <>
      <color attach="background" args={['#03040a']} />
      <group ref={rigRef}>
        {!hidden.has('core') && <HeroCore live={live} />}
        {!hidden.has('motes') && <MoteHaze live={live} perfMode={perfMode} />}
        {!hidden.has('rings') && <OrbitRings live={live} />}
        {visualMode !== 'memory' && !hidden.has('agents') && (
          <AgentField live={live} nightMode={nightMode} selectedAgentId={selectedAgentId} onSelectAgent={onSelectAgent} />
        )}
        {visualMode !== 'fleet' && <MemoryBankV2 live={live} selectedMemoryId={selectedMemoryId} onSelectMemory={onSelectMemory} />}
        {!hidden.has('models') && <ModelConstellationV2 live={live} />}
        {!hidden.has('web') && <NeuralWebV2 live={live} />}
        {!hidden.has('thoughts') && <ThoughtSwarmV2 live={live} perfMode={perfMode} />}
        {!hidden.has('murmur') && <MurmurationV2 live={live} perfMode={perfMode} />}
        <ShockwavesV2 live={live} />
      </group>
      {!postOff && <PostFXV2 live={live} perfMode={perfMode} nightMode={nightMode} />}
    </>
  );
}

function PostFXV2({ live, perfMode, nightMode }: {
  live: React.MutableRefObject<LiveSignalV2>;
  perfMode?: 'ultra' | 'smooth' | 'cinematic';
  nightMode?: boolean;
}) {
  const smooth = useRef(0);
  const smoothPhi = useRef(0);
  useFrame((_, delta) => {
    smooth.current += (live.current.rawLevel - smooth.current) * Math.min(1, delta * 6);
    smoothPhi.current += ((live.current.phiS ?? 0) - smoothPhi.current) * Math.min(1, delta * 3.5);
  });
  const lvl = smooth.current;
  const bloomMul = (perfMode === 'smooth' ? 0.6 : perfMode === 'ultra' ? 1.2 : 1) * (nightMode ? 1.4 : 1);
  // Night mode: exposure drops to 0.5 so the stage crushes dark, while the
  // bloom threshold drops and intensity rises — emissive core/orbs punch
  // through as neon on a near-black field.
  const phiCap = nightMode ? 2.5 : 1.2;
  const threshold = nightMode ? 0.25 : 0.32;
  const radius = nightMode ? 0.95 : 0.75;
  const vigDarkness = nightMode ? 0.74 + lvl * 0.14 : 0.62 + lvl * 0.12;
  return (
    <EffectComposer multisampling={perfMode === 'cinematic' ? 4 : 0}>
      {/* Night: crush mids BEFORE bloom so only true emissives (core,
          working orbs) clear the threshold — dark field, neon sources. */}
      {nightMode && <BrightnessContrast brightness={-0.30} contrast={0.10} />}
      <Bloom
        mipmapBlur
        intensity={(0.7 + lvl * 0.5 + Math.min(smoothPhi.current, phiCap) * 0.4) * bloomMul}
        luminanceThreshold={threshold}
        luminanceSmoothing={0.3}
        radius={radius}
      />
      {perfMode !== 'smooth' && (
        <ChromaticAberration offset={new THREE.Vector2(0.0004 + lvl * 0.0007, 0.0004 + lvl * 0.0007)} radialModulation />
      )}
      <Vignette offset={0.25} darkness={vigDarkness} />
    </EffectComposer>
  );
}

// ── Public component (same props shape as V1) ───────────────────────────

export interface CortexCoreSceneV2Props {
  selectedAgentId?: string | null;
  onSelectAgent?: (id: string | null) => void;
  selectedMemoryId?: string | null;
  onSelectMemory?: (id: string | null) => void;
  visualMode?: 'fleet' | 'memory' | 'both';
  chronoTime?: number | null;
  replayTrack?: ReplayTrackEvent[] | null;
  holoParallax?: boolean;
  headParallax?: { x: number; y: number } | null;
  perfMode?: 'ultra' | 'smooth' | 'cinematic';
  onTogglePerfMode?: (mode: 'ultra' | 'smooth' | 'cinematic') => void;
  nightMode?: boolean;
}

export function CortexCoreSceneV2(props: CortexCoreSceneV2Props) {
  const live = useRef<LiveSignalV2>(makeLiveForV2());
  const [contextLost, setContextLost] = React.useState(false);
  const [restoreCount, setRestoreCount] = React.useState(0);
  const [docHidden, setDocHidden] = React.useState(() =>
    typeof document !== 'undefined' ? document.hidden : false);

  React.useEffect(() => {
    return cortexSignalBus.subscribe((p: CortexSignalBusPayload) => {
      const prev = live.current.state;
      const prevEvent = live.current.eventSeq;
      live.current.state = p.state;
      live.current.rawLevel = p.level ?? 0;
      live.current.text = p.text ?? '';
      live.current.phi = p.phi ?? 0;
      live.current.channel = p.channel ?? '';
      live.current.eventSeq = p.eventSeq ?? 0;
      if (p.emotion !== undefined) live.current.emotion = p.emotion;
      if (p.state !== prev || (p.eventSeq ?? 0) !== prevEvent || p.event === 'wake') {
        live.current.kick = p.event === 'wake' ? 1.8 : 1;
      }
    });
  }, []);

  React.useEffect(() => {
    const onVis = () => setDocHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // per-frame signal tick inside Canvas via a tiny component
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Canvas
        key={restoreCount}
        frameloop={docHidden || contextLost ? 'never' : 'always'}
        dpr={1.25}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        camera={{ position: [0, 0.4, 8.4], fov: 42, near: 0.1, far: 120 }}
        onPointerMissed={() => props.onSelectAgent?.(null)}
        style={{ position: 'absolute', inset: 0 }}
        onCreated={({ gl }) => {
          // cinematic color pipeline: filmic tonemap + sRGB output
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          const dom = gl.domElement;
          const onLost = (e: Event) => {
            e.preventDefault();
            setContextLost(true);
            cortexSignalBus.emit('webgl:contextlost', 'GPU context suspended');
          };
          const onRestored = () => {
            setContextLost(false);
            setRestoreCount((c) => c + 1);
            cortexSignalBus.emit('webgl:contextrestored', 'GPU context restored');
          };
          dom.addEventListener('webglcontextlost', onLost, false);
          dom.addEventListener('webglcontextrestored', onRestored, false);
        }}
      >
        <SignalTicker live={live} />
        <V2Scene
          live={live}
          headParallax={props.headParallax}
          visualMode={props.visualMode}
          chronoTime={props.chronoTime}
          replayTrack={props.replayTrack}
          perfMode={props.perfMode}
          nightMode={props.nightMode}
          selectedAgentId={props.selectedAgentId}
          onSelectAgent={props.onSelectAgent}
          selectedMemoryId={props.selectedMemoryId}
          onSelectMemory={props.onSelectMemory}
        />
      </Canvas>
    </div>
  );
}

function SignalTicker({ live }: { live: React.MutableRefObject<LiveSignalV2> }) {
  useFrame((state, delta) => tickLiveForV2(live.current, delta, state.clock.elapsedTime));
  return null;
}
