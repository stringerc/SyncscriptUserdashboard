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

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
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

const coreVert = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uEnergy;
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
    float amp = (0.09 + uEnergy * 0.38 + uLevel * 0.7) * (0.75 + 0.25 * sin(uTime * 4.2));
    float d = (ridge - 0.45) * 0.7 + (detail - 0.5) * 0.22;
    vDisp = clamp(d * amp, -0.45, 0.45);
    vec3 displaced = position + n * vDisp;
    vec4 wp = modelMatrix * vec4(displaced, 1.0);
    vWorld = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vNormal = normalize(mat3(modelMatrix) * n);
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

const moteCount = 1600;
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

function MoteHaze({ live }: { live: React.MutableRefObject<LiveSignalV2> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(moteCount);
    for (let i = 0; i < moteCount; i++) seeds[i] = Math.random();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(moteCount * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return g;
  }, []);
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

function AgentField({ live }: { live: React.MutableRefObject<LiveSignalV2> }) {
  const groupRef = useRef<THREE.Group>(null);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const agentsRef = useRef<AgentClient[]>([]);
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
        sprite.scale.setScalar((wrk ? 0.34 : 0.24) * pulse);
        m.color.copy(err ? c('#f43f5e') : p.color);
        m.opacity = dim ? 0.15 : wrk ? 0.9 : 0.55;
      } else {
        sprite.scale.setScalar(0.14 + 0.03 * Math.sin(t * 2.2 + i));
        m.color.copy(sig.colorRim).lerp(c('#ffffff'), 0.4);
        m.opacity = 0.25 + 0.1 * Math.sin(t * 1.8 + i);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {params.map((p, i) => (
        <sprite key={i} ref={(el) => { sprites.current[i] = el; }}>
          <spriteMaterial map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
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

// ── Scene root ───────────────────────────────────────────────────────────

function V2Scene({ live, headParallax }: {
  live: React.MutableRefObject<LiveSignalV2>;
  headParallax?: { x: number; y: number } | null;
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
    pitch: 0.06, zoom: 0, dragging: false, lx: 0, ly: 0,
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

  useFrame((state, delta) => {
    const sig = live.current;
    const t = state.clock.elapsedTime;
    const o = orbit.current;
    const px = headParallax ? headParallax.x : 0;
    const py = headParallax ? headParallax.y : 0;

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
    if (rigRef.current) {
      rigRef.current.rotation.y += delta * 0.02 * (0.4 + sig.energy);
    }
  });
  // ?v2hide=core,motes,rings,agents — layer bisection for the equator hunt
  const hidden = useMemo(() => {
    if (typeof window === 'undefined') return new Set<string>();
    return new Set((new URLSearchParams(window.location.search).get('v2hide') || '').split(',').filter(Boolean));
  }, []);
  return (
    <>
      <color attach="background" args={['#03040a']} />
      <group ref={rigRef}>
        {!hidden.has('core') && <HeroCore live={live} />}
        {!hidden.has('motes') && <MoteHaze live={live} />}
        {!hidden.has('rings') && <OrbitRings live={live} />}
        {!hidden.has('agents') && <AgentField live={live} />}
      </group>
      <PostFXV2 live={live} />
    </>
  );
}

function PostFXV2({ live }: { live: React.MutableRefObject<LiveSignalV2> }) {
  const smooth = useRef(0);
  const smoothPhi = useRef(0);
  useFrame((_, delta) => {
    smooth.current += (live.current.rawLevel - smooth.current) * Math.min(1, delta * 6);
    smoothPhi.current += ((live.current.phiS ?? 0) - smoothPhi.current) * Math.min(1, delta * 3.5);
  });
  const lvl = smooth.current;
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        mipmapBlur
        intensity={0.7 + lvl * 0.5 + smoothPhi.current * 0.4}
        luminanceThreshold={0.32}
        luminanceSmoothing={0.3}
        radius={0.75}
      />
      <ChromaticAberration offset={new THREE.Vector2(0.0004 + lvl * 0.0007, 0.0004 + lvl * 0.0007)} radialModulation />
      <Vignette offset={0.25} darkness={0.62 + lvl * 0.12} />
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
  replayTrack?: unknown[] | null;
  holoParallax?: boolean;
  headParallax?: { x: number; y: number } | null;
  perfMode?: 'ultra' | 'smooth' | 'cinematic';
  onTogglePerfMode?: (mode: 'ultra' | 'smooth' | 'cinematic') => void;
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
        style={{ position: 'absolute', inset: 0 }}
        onCreated={({ gl }) => {
          const dom = gl.domElement;
          const onLost = (e: Event) => { e.preventDefault(); setContextLost(true); };
          const onRestored = () => { setContextLost(false); setRestoreCount((c) => c + 1); };
          dom.addEventListener('webglcontextlost', onLost, false);
          dom.addEventListener('webglcontextrestored', onRestored, false);
        }}
      >
        <SignalTicker live={live} />
        <V2Scene live={live} headParallax={props.headParallax} />
      </Canvas>
    </div>
  );
}

function SignalTicker({ live }: { live: React.MutableRefObject<LiveSignalV2> }) {
  useFrame((state, delta) => tickLiveForV2(live.current, delta, state.clock.elapsedTime));
  return null;
}
