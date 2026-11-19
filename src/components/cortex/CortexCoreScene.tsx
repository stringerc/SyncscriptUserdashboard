/**
 * CortexCoreScene — cinematic R3F presence for /cortex/visualizer
 *
 * "The Sovereign Core" — a layered neural sanctum:
 *   · fbm nebula shell (deep-space atmosphere)
 *   · dual parallax starfields with twinkle
 *   · hero core: domain-warped ridged-noise shader sphere, fresnel rim,
 *     latitudinal energy bands — displaced by live voice level
 *   · 3 gyroscopic orbit rings with flowing energy shaders + satellites
 *   · parametric satellite constellation (8 bodies)
 *   · neural web: drifting nodes + synapse edges
 *   · click shockwaves, pointer parallax, intro dolly, level-reactive bloom
 *
 * All motion/state driven by cortexSignalBus (idle|listening|thinking|
 * speaking|working + 0..1 audio level + live text).
 */

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { Effect, BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import {
  cortexSignalBus,
  type CortexSignalBusPayload,
  type CortexVoiceState,
} from './CortexVisualizer';
import { agentsClient, type AgentClient, type ModelClient } from '../../lib/cortex-agents-client';
import { neuroAudio } from '../../lib/cortex-neuro-audio';

// ── Shared GLSL ──────────────────────────────────────────────────────────

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

// ── State palette ────────────────────────────────────────────────────────

const c = (hex: string) => new THREE.Color(hex);

const STATE_COLORS: Record<CortexVoiceState, { core: string; rim: string; deep: string; energy: number; cCore: THREE.Color; cRim: THREE.Color; cDeep: THREE.Color }> = {
  idle: { core: '#124a5e', rim: '#38d9f5', deep: '#020a12', energy: 0.45, cCore: c('#124a5e'), cRim: c('#38d9f5'), cDeep: c('#020a12') },
  listening: { core: '#063d2e', rim: '#34d399', deep: '#020d08', energy: 0.5, cCore: c('#063d2e'), cRim: c('#34d399'), cDeep: c('#020d08') },
  thinking: { core: '#2e1065', rim: '#a78bfa', deep: '#0a0618', energy: 0.75, cCore: c('#2e1065'), cRim: c('#a78bfa'), cDeep: c('#0a0618') },
  speaking: { core: '#3a2c05', rim: '#fcd34d', deep: '#120c02', energy: 1.0, cCore: c('#3a2c05'), cRim: c('#fcd34d'), cDeep: c('#120c02') },
  working: { core: '#4a044e', rim: '#e879f9', deep: '#12041a', energy: 0.68, cCore: c('#4a044e'), cRim: c('#e879f9'), cDeep: c('#12041a') },
};

interface LiveSignal {
  state: CortexVoiceState;
  level: number;      // smoothed 0..1
  rawLevel: number;
  energy: number;     // smoothed state energy
  kick: number;       // state-transition energy burst, decays
  clockT: number;     // latest r3f clock time (for shockwave sync)
  colorCore: THREE.Color;
  colorRim: THREE.Color;
  colorDeep: THREE.Color;
  text: string;
  phi: number;        // raw IIT-Φ from the bus (0 = unknown)
  phiS: number;       // smoothed Φ — drives shader shimmer speed
  think: number;      // smoothed 0..1 — cognitive-load envelope (thinking/working)
  missionProgress: number; // 0..1, -1 when no mission
  missionTitle: string;
  channel: string;    // chat | voice | phone | proactive | mic | visualizer
  eventSeq: number;   // discrete-event edge counter
  ingest: number;     // 0..1 impulse — core flinch when agent work arrives
  ingestColor: THREE.Color; // hue of the last arriving packet
}

function makeLive(): LiveSignal {
  return {
    state: 'idle',
    level: 0,
    rawLevel: 0,
    energy: STATE_COLORS.idle.energy,
    kick: 0,
    clockT: 0,
    colorCore: c(STATE_COLORS.idle.core),
    colorRim: c(STATE_COLORS.idle.rim),
    colorDeep: c(STATE_COLORS.idle.deep),
    text: '',
    phi: 0,
    phiS: 0,
    think: 0,
    missionProgress: -1,
    missionTitle: '',
    channel: '',
    eventSeq: 0,
    ingest: 0,
    ingestColor: c('#67e8f9'),
  };
}

/** Advance shared smoothed signal once per frame. */
function tickLive(live: LiveSignal, delta: number, t: number) {
  const target = STATE_COLORS[live.state];
  const attack = live.rawLevel > live.level ? 16 : 5;
  live.level += (live.rawLevel - live.level) * Math.min(1, delta * attack);
  live.energy += (target.energy - live.energy) * Math.min(1, delta * 3.2);
  live.kick *= Math.exp(-delta * 2.4);
  live.ingest *= Math.exp(-delta * 2.8);
  live.clockT = t;
  live.colorCore.lerp(target.cCore, Math.min(1, delta * 2.4));
  live.colorRim.lerp(target.cRim, Math.min(1, delta * 2.4));
  live.colorDeep.lerp(target.cDeep, Math.min(1, delta * 2.0));
  // Φ drifts slowly — it's a tonic signal, not a VU meter
  live.phiS += (live.phi - live.phiS) * Math.min(1, delta * 0.8);
  // Cognitive load: ramps in over ~0.8s, decays over ~2.5s so the thought
  // swarm eases in and out instead of popping.
  const thinkTarget = live.state === 'thinking' || live.state === 'working' ? 1 : 0;
  live.think += (thinkTarget - live.think) * Math.min(1, delta * (thinkTarget > live.think ? 1.4 : 0.5));
}

// ── Nebula shell (Original Domain-Warped Nebula: 60% Blue, 30% Orange, Pushed Far Back & Left of Core) ──

const nebulaVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w; // pin to far plane
  }
`;

const nebulaFragment = /* glsl */ `
  uniform float uEnergy;
  uniform float uLevel;
  uniform vec3 uDeep;
  uniform vec3 uRim;
  varying vec3 vDir;

  void main() {
    vec3 d = normalize(vDir);

    // Deep cosmic space base: pitch-black velvet with subtle ambient rim glow
    vec3 colSpace = uDeep;
    float centerGlow = pow(max(dot(d, vec3(0.0, 0.0, -1.0)), 0.0), 3.0);
    vec3 baseSpace = colSpace + uRim * centerGlow * (0.03 + uEnergy * 0.05);

    gl_FragColor = vec4(baseSpace, 1.0);
  }
`;

function Nebula({ live }: { live: React.MutableRefObject<LiveSignal> }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uEnergy: { value: 0.2 },
          uLevel: { value: 0 },
          uDeep: { value: c('#020610') },
          uRim: { value: c('#22d3ee') },
        },
        vertexShader: nebulaVertex,
        fragmentShader: nebulaFragment,
      }),
    []
  );

  useFrame((state, delta) => {
    const sig = live.current;
    mat.uniforms.uTime.value += delta;
    mat.uniforms.uEnergy.value = sig.energy;
    mat.uniforms.uLevel.value = sig.level;
    mat.uniforms.uDeep.value.copy(sig.colorDeep);
    mat.uniforms.uRim.value.copy(sig.colorRim).multiplyScalar(0.55);
  });

  return (
    <mesh material={mat} renderOrder={-10}>
      <sphereGeometry args={[30, 48, 48]} />
    </mesh>
  );
}

// ── Starfields (two parallax layers) ────────────────────────────────────

const starVertex = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uTwinkle;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 1.8) + aSeed * 40.0);
    vAlpha = tw * uTwinkle;
    vColor = mix(vec3(0.65, 0.85, 1.0), vec3(1.0), aSeed * 0.7);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (160.0 / -mv.z) * (0.7 + 0.3 * tw);
  }
`;

const starFragment = /* glsl */ `
  uniform vec3 uTint;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.05, d) * vAlpha;
    gl_FragColor = vec4(mix(vColor, uTint, 0.35) * a, a);
  }
`;

function makeStars(count: number, rMin: number, rMax: number, sMin: number, sMax: number) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = rMin + Math.random() * (rMax - rMin);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7; // slight disc bias
    pos[i * 3 + 2] = r * Math.cos(phi);
    size[i] = sMin + Math.random() * (sMax - sMin);
    seed[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  return geo;
}

function StarLayer({
  live,
  count,
  rMin,
  rMax,
  sMin,
  sMax,
  rotSpeed,
  twinkle,
}: {
  live: React.MutableRefObject<LiveSignal>;
  count: number;
  rMin: number;
  rMax: number;
  sMin: number;
  sMax: number;
  rotSpeed: number;
  twinkle: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const geometry = useMemo(() => makeStars(count, rMin, rMax, sMin, sMax), [count, rMin, rMax, sMin, sMax]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
          uTwinkle: { value: twinkle },
          uTint: { value: c('#22d3ee') },
        },
        vertexShader: starVertex,
        fragmentShader: starFragment,
      }),
    [twinkle]
  );

  useFrame((state, delta) => {
    const sig = live.current;
    material.uniforms.uTime.value += delta;
    material.uniforms.uPixelRatio.value = state.viewport.dpr;
    material.uniforms.uTint.value.copy(sig.colorRim).lerp(c('#ffffff'), 0.4);
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * rotSpeed * (0.4 + sig.energy * 0.6);
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}

// ── Hero core ────────────────────────────────────────────────────────────

const coreVertex = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uEnergy;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPos;
  varying float vDisp;

  ${NOISE_GLSL}

  void main() {
    vec3 n = normalize(position);
    float t = uTime * 0.20;
    // domain warp: sample noise through noise for organic ridges
    vec3 q = vec3(
      fbm(n * 1.8 + vec3(0.0, t * 0.8, t * 0.5)),
      fbm(n * 1.8 + vec3(5.2, t * 0.6, -t * 0.7)),
      fbm(n * 1.8 + vec3(1.3, -t * 0.5, t * 0.9))
    );
    float ridge = 1.0 - abs(2.0 * fbm(n * 3.2 + q * 0.9 + vec3(t * 0.35)) - 1.0);
    float detail = vnoise(n * 7.0 + vec3(t, -t * 0.7, t * 0.4));
    float amp = (0.10 + uEnergy * 0.42 + uLevel * 0.85) * (0.75 + 0.25 * sin(uTime * 4.2));
    float d = (ridge - 0.45) * 0.75 + (detail - 0.5) * 0.25;
    vDisp = clamp(d * amp, -0.5, 0.5);
    vec3 displaced = position + n * vDisp;

    vec4 wp = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vNormal = normalize(mat3(modelMatrix) * n);
    vViewPosition = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const coreFragment = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uEnergy;
  uniform float uPhi;
  uniform float uThink;
  uniform vec3 uColorCore;
  uniform vec3 uColorRim;
  uniform vec3 uColorHot;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPos;
  varying float vDisp;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - abs(dot(n, viewDir)), 2.1);
    // Brightness responds mostly to STATE; level drives displacement/bloom instead
    float energy = 0.5 + uEnergy * 0.55 + uLevel * 0.35;

    // plasma bands flowing over the displaced surface — Φ quickens the flow
    float flow = 1.4 + uPhi * 1.5;
    float bands = 0.5 + 0.5 * sin(vWorldPos.y * 7.0 + uTime * flow + vDisp * 18.0);
    float bands2 = 0.5 + 0.5 * sin(vWorldPos.x * 5.0 - uTime * flow * 0.8 + vDisp * 12.0);
    float centerGlow = pow(max(dot(n, viewDir), 0.0), 1.4);
    // crest highlight where displacement peaks; Φ adds a consciousness shimmer
    float crest = smoothstep(0.10, 0.42, vDisp);
    float shimmer = 0.5 + 0.5 * sin(uTime * (2.0 + uPhi * 3.0) + vWorldPos.y * 9.0);

    vec3 col = uColorCore * (0.6 + centerGlow * 1.25);
    col += uColorHot * crest * (0.28 + uLevel * 0.3);
    col += uColorRim * fresnel * (1.45 + uLevel * 0.6);
    col += uColorRim * (bands * 0.16 + bands2 * 0.10) * energy;
    col += uColorHot * shimmer * uPhi * 0.05 * (0.4 + energy);
    // Cognitive sweep — a bright meridian scans the surface while thinking
    float sweepAng = atan(vWorldPos.z, vWorldPos.x);
    float sweep = pow(0.5 + 0.5 * sin(sweepAng * 2.0 - uTime * 3.2), 18.0);
    col += uColorRim * sweep * uThink * (0.30 + uLevel * 0.2);
    col *= 0.55 + energy * 0.55;
    col = min(col, vec3(1.0)); // HDR ceiling — bloom picks up headroom, never clips to white

    gl_FragColor = vec4(col, 1.0);
  }
`;

function Core({ live }: { live: React.MutableRefObject<LiveSignal> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uEnergy: { value: 0.2 },
      uPhi: { value: 0 },
      uThink: { value: 0 },
      uColorCore: { value: c('#124a5e') },
      uColorRim: { value: c('#38d9f5') },
      uColorHot: { value: c('#e0faff') },
    }),
    []
  );

  useFrame((state, delta) => {
    const m = meshRef.current;
    if (!m) return;
    const sig = live.current;
    uniforms.uTime.value += delta;
    uniforms.uLevel.value = sig.level;
    uniforms.uPhi.value = sig.phiS;
    uniforms.uThink.value = sig.think;
    // Ingestion flinch: agent packets arriving kick the core's energy and
    // briefly tint its rim toward the arriving agent's hue.
    uniforms.uEnergy.value = sig.energy + sig.kick * 0.55 + sig.ingest * 0.9;
    uniforms.uColorCore.value.copy(sig.colorCore);
    uniforms.uColorRim.value.copy(sig.colorRim);
    uniforms.uColorHot.value.copy(sig.colorRim).lerp(c('#ffffff'), 0.55);
    if (sig.ingest > 0.01) {
      uniforms.uColorRim.value.lerp(sig.ingestColor, sig.ingest * 0.45);
    }

    m.rotation.y += delta * 0.10 * (0.5 + sig.energy);
    m.rotation.x = Math.sin(uniforms.uTime.value * 0.19) * 0.14;
    const s = 1 + sig.level * 0.05 + sig.ingest * 0.07 + Math.sin(uniforms.uTime.value * 1.2) * 0.006;
    m.scale.setScalar(s);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial vertexShader={coreVertex} fragmentShader={coreFragment} uniforms={uniforms} />
    </mesh>
  );
}

// ── Orbit rings (flow-energy gyroscope) ─────────────────────────────────

const ringVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ringFragment = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uEnergy;
  uniform vec3 uColor;
  uniform float uSpeed;
  uniform float uBeads;
  varying vec2 vUv;
  void main() {
    // vUv.x wraps once around the torus
    float flow = pow(0.5 + 0.5 * sin(vUv.x * 6.2831 * uBeads - uTime * uSpeed), 6.0);
    float base = 0.05 + uEnergy * 0.10 + uLevel * 0.22;
    float a = base + flow * (0.5 + uLevel * 0.8);
    // fade tube edges for soft ribbon look
    float edge = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
    gl_FragColor = vec4(uColor * a * edge * 2.2, a * edge);
  }
`;

interface RingSpec {
  radius: number;
  tube: number;
  tiltX: number; // degrees
  tiltZ: number;
  speed: number; // flow speed
  beads: number;
  spin: number; // group rotation speed
  phase: number;
}

const RINGS: RingSpec[] = [
  { radius: 1.62, tube: 0.008, tiltX: 78, tiltZ: 0, speed: 2.2, beads: 3, spin: 0.16, phase: 0 },
  { radius: 2.05, tube: 0.006, tiltX: 64, tiltZ: 38, speed: -1.6, beads: 5, spin: -0.11, phase: 2.1 },
  { radius: 2.5, tube: 0.005, tiltX: 88, tiltZ: -52, speed: 1.1, beads: 2, spin: 0.07, phase: 4.2 },
];

function OrbitRing({ spec, live, index }: { spec: RingSpec; live: React.MutableRefObject<LiveSignal>; index: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const satRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: spec.phase * 10 },
          uLevel: { value: 0 },
          uEnergy: { value: 0.2 },
          uColor: { value: c('#22d3ee') },
          uSpeed: { value: spec.speed },
          uBeads: { value: spec.beads },
        },
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
      }),
    [spec]
  );

  useFrame((state, delta) => {
    const sig = live.current;
    material.uniforms.uTime.value += delta;
    material.uniforms.uLevel.value = sig.level;
    material.uniforms.uEnergy.value = sig.energy;
    material.uniforms.uColor.value.copy(sig.colorRim);

    const g = groupRef.current;
    if (g) {
      g.rotation.z += delta * spec.spin * (0.5 + sig.energy);
      g.rotation.x = THREE.MathUtils.degToRad(spec.tiltX) + Math.sin(material.uniforms.uTime.value * 0.3 + index) * 0.05;
      g.rotation.y = THREE.MathUtils.degToRad(spec.tiltZ);
    }
    // satellite bead riding the ring
    if (satRef.current) {
      const a = material.uniforms.uTime.value * spec.speed * 0.9 + spec.phase;
      satRef.current.position.set(Math.cos(a) * spec.radius, 0, Math.sin(a) * spec.radius);
    }
  });

  return (
    <group ref={groupRef} rotation={[THREE.MathUtils.degToRad(spec.tiltX), THREE.MathUtils.degToRad(spec.tiltZ), 0]}>
      <mesh material={material}>
        <torusGeometry args={[spec.radius, spec.tube, 8, 220]} />
      </mesh>
      <mesh ref={satRef}>
        <sphereGeometry args={[0.028, 12, 12]} />
        <meshBasicMaterial color="#dff6ff" transparent opacity={0.95} />
      </mesh>
    </group>
  );
}

// ── Satellite constellation — the fleet, embodied ────────────────────────
// The first N orbiting bodies ARE the Nexus Foundry agents: role-colored,
// pulsing while working, dimmed when idle, red on error, ghosted when
// retired. Slots beyond the agent count stay ambient motes.

/** Screen-space anchors for agent motes — written every frame by Satellites,
 *  read by the DOM inspect card so it rides the agent's orbit. */
export const agentScreenAnchors: Record<string, { x: number; y: number; behind: boolean }> = {};

/** 3D World space positions for agent motes — written every frame by Satellites,
 *  used by CameraRig to smoothly lock on and chase active agents in orbit. */
export const agentWorldPositions: Record<string, THREE.Vector3> = {};

/** One persisted runtime event reduced to what the chrono replay camera needs. */
export interface ReplayTrackEvent { seq: number; at: number; type: string; agentId: string | null; }

/** Live pointer to the event currently under the chrono replay cursor —
 *  written every frame by CameraRig, polled by the DOM HUD. */
export const chronoNow: { seq: number; type: string; agentId: string | null } = { seq: 0, type: '', agentId: null };

const SAT_COUNT = 24;
export const SAT_AGENT_COLORS: Record<string, string> = {
  antigravity: '#c084fc', devin: '#38bdf8', claudecode: '#f97316', openclaw: '#06b6d4', hermes: '#ef4444', curator: '#8b5cf6', sentinel: '#67e8f9', scout: '#e879f9', librarian: '#fbbf24', builder: '#34d399', reviewer: '#fb7185', runner: '#a3e635', distributor: '#fb923c', warden: '#818cf8', prep: '#f472b6', forecaster: '#2dd4bf', strategist: '#e879f9',
};
export const SAT_AGENT_ORDER = ['antigravity', 'devin', 'claudecode', 'openclaw', 'hermes', 'curator', 'sentinel', 'scout', 'librarian', 'builder', 'reviewer', 'runner', 'distributor', 'warden', 'prep', 'forecaster', 'strategist'];
const satSpawnHue = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
};
const satAgentSort = (a: AgentClient, b: AgentClient) => {
  const ia = SAT_AGENT_ORDER.indexOf(a.id), ib = SAT_AGENT_ORDER.indexOf(b.id);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.id.localeCompare(b.id);
};
const satAgentColor = (a: AgentClient) =>
  SAT_AGENT_COLORS[a.id] || (a.spawnSpec ? `hsl(${satSpawnHue(a.id)} 85% 68%)` : '#94a3b8');
/** Enterprise fleet (revenue agents + self-spawned) gets celestial halo presence. */
const satIsEnterprise = (a?: AgentClient | null) =>
  !!a && (a.tier === 'enterprise' || !!a.spawnSpec);
/** Sovereign apex cognitive nodes: Antigravity & Devin. */
const satIsApex = (a?: AgentClient | null) =>
  !!a && (a.id === 'antigravity' || a.id === 'devin');
/** Omni-syndication carrier distribution hub. */
const satIsDistributor = (a?: AgentClient | null) =>
  !!a && a.id === 'distributor';
/** Omnidirectional sensor astrolabes. */
const satIsSentinel = (a?: AgentClient | null) =>
  !!a && (a.id === 'sentinel' || a.id === 'warden');

// Soft radial glow sprite texture — shared by all agent vessel halos.
let glowTex: THREE.CanvasTexture | null = null;
function getGlowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(cv);
  return glowTex;
}

// Canvas-generated text sprite — no font/CDN dependency, always available.
const textTextureCache = new Map<string, THREE.CanvasTexture>();
function textTexture(text: string, color: string): THREE.CanvasTexture {
  const key = `${text}|${color}`;
  const hit = textTextureCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 96;
  const g = cv.getContext('2d')!;
  g.font = '700 30px "IBM Plex Mono", ui-monospace, monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 6;
  g.fillStyle = color;
  g.fillText(text.slice(0, 24), 256, 50);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  textTextureCache.set(key, tex);
  return tex;
}

// Shared color allocations for sacred geometry materials in useFrame.
const COLOR_WHITE = new THREE.Color('#ffffff');
const COLOR_CRIMSON = new THREE.Color('#ef4444');
const COLOR_SLATE = new THREE.Color('#94a3b8');
const COLOR_LIGHT_SLATE = new THREE.Color('#e2e8f0');

function Satellites({ live }: { live: React.MutableRefObject<LiveSignal> }) {
  const groupRef = useRef<THREE.Group>(null);
  const sats = useMemo(
    () =>
      Array.from({ length: SAT_COUNT }, (_, i) => ({
        radius: 1.85 + (i % 3) * 0.42 + Math.random() * 0.25,
        speed: (0.14 + Math.random() * 0.22) * (i % 2 === 0 ? 1 : -1),
        incl: (Math.random() - 0.5) * 1.5,
        phase: Math.random() * Math.PI * 2,
        size: 0.018 + Math.random() * 0.022,
      })),
    []
  );
  // Pure-light vessels: every satellite is an additive glow mote — no hard
  // geometry. Working agents feed the core through an ember current: a swarm
  // of glowing motes flowing along a slowly-bending curved path, with bright
  // packet leaders riding the same curve. Ambient slots stay faint embers.
  const EMBER_COUNT = 9;
  const moteRefs = useRef<(THREE.Sprite | null)[]>([]);
  const emberRefs = useRef<(THREE.Sprite | null)[][]>([]);
  const packetRefs = useRef<(THREE.Sprite | null)[][]>([]);
  const trailRefs = useRef<(THREE.Sprite | null)[][]>([]);
  const impactRefs = useRef<(THREE.Sprite | null)[]>([]);
  const progRef = useRef<number[]>([]);
  const impactLife = useRef<number[]>([]);
  const surgeRef = useRef<number[]>([]);
  const lastEventAt = useRef(0);
  const agentsRef = useRef<AgentClient[]>([]);
  const agentColorsRef = useRef<THREE.Color[]>([]);
  const tagRefs = useRef<(THREE.Sprite | null)[]>([]);
  // 3D Crystalline Neural Astrolabe vessels — sacred geometric resonators
  // riding orbit slots for all active agents.
  const satMeshRefs = useRef<(THREE.Group | null)[]>([]);
  const satCoreRefs = useRef<((THREE.Group | THREE.Mesh) | null)[]>([]);
  const satCoreMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const satCageRefs = useRef<(THREE.Mesh | null)[]>([]);
  const satCageMatRefs = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const satWireMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const satRing1Refs = useRef<(THREE.Mesh | null)[]>([]);
  const satRing1MatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const satRing2Refs = useRef<(THREE.Mesh | null)[]>([]);
  const satRing2MatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const satEnterpriseGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const satRing3MatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const satCoronaRefs = useRef<(THREE.Sprite | null)[]>([]);
  const satMitosisRefs = useRef<(THREE.Mesh | null)[]>([]);
  const satMitosisMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const satLatticeRefs = useRef<(THREE.Mesh | null)[][]>([]);
  const satLatticeMatRefs = useRef<(THREE.MeshBasicMaterial | null)[][]>([]);
  // Inter-agent token photons — real agent.comm traffic rendered as light
  // packets flying satellite → satellite (or → core) in world space.
  const PHOTON_COUNT = 10;
  const photonRefs = useRef<(THREE.Sprite | null)[]>([]);
  const photons = useRef<{ from: string; to: string; t0: number; slot: number; color: string }[]>([]);
  const lastCommScan = useRef(0);
  const tmpW = useMemo(() => new THREE.Vector3(), []);
  const tmpT = useMemo(() => new THREE.Vector3(), []);
  const basisMat = useMemo(() => new THREE.Matrix4(), []);
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const tmpDir = useMemo(() => new THREE.Vector3(), []);
  const tmpCtrl = useMemo(() => new THREE.Vector3(), []);
  const tmpPerp = useMemo(() => new THREE.Vector3(), []);
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  const rebuildTags = () => {
    const group = groupRef.current;
    if (!group) return;
    for (const tag of tagRefs.current) {
      if (tag) {
        group.remove(tag);
        (tag.material as THREE.SpriteMaterial).map?.dispose();
        (tag.material as THREE.SpriteMaterial).dispose();
      }
    }
    tagRefs.current = agentsRef.current.map((a) => {
      const col = satAgentColor(a);
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textTexture(a.name, col), transparent: true, depthWrite: false, opacity: 0.55,
      }));
      tag.scale.set(0.62, 0.16, 1);
      tag.renderOrder = 5;
      group.add(tag);
      return tag;
    });
  };

  React.useEffect(() => {
    const sync = () => {
      const list = (agentsClient.snapshot.agents || [])
        .slice().sort(satAgentSort).slice(0, SAT_COUNT);
      agentsRef.current = list;
      agentColorsRef.current = list.map((a) => c(satAgentColor(a)));
      // Delivery surge: scan new runtime events for completed tasks and flag
      // the owning agent's satellite for a one-shot stream surge.
      for (const e of agentsClient.events) {
        const at = (e as { at?: number }).at ?? 0;
        if (at <= lastEventAt.current) continue;
        lastEventAt.current = Math.max(lastEventAt.current, at);
        const task = (e as { task?: { agentId?: string; status?: string } }).task;
        if (e.type === 'task.transition' && task?.status === 'completed' && task.agentId) {
          const idx = list.findIndex((a) => a.id === task.agentId);
          if (idx >= 0) surgeRef.current[idx] = 1;
        }
        // In-flight token photons: agent.comm events become real packets
        // traveling between the two agents' live orbital positions.
        const comm = e as { type?: string; at?: number; from?: string; to?: string };
        const commAt = comm.at ?? 0;
        if (comm.type === 'agent.comm' && commAt > lastCommScan.current) {
          lastCommScan.current = Math.max(lastCommScan.current, commAt);
          if (comm.from && comm.to && comm.to !== 'all' && photons.current.length < 64) {
            photons.current.push({
              from: comm.from,
              to: comm.to,
              t0: performance.now() / 1000,
              slot: photons.current.length % PHOTON_COUNT,
              color: SAT_AGENT_COLORS[comm.from] || '#67e8f9',
            });
          }
        }
      }
      rebuildTags();
    };
    agentsClient.start();
    sync();
    return agentsClient.subscribe(sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, delta) => {
    const sig = live.current;
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05 * (0.4 + sig.energy);
      groupRef.current.updateWorldMatrix(true, false);
    }
    const t = state.clock.elapsedTime;
    const cam = state.camera;
    const { width: vw, height: vh } = state.size;
    const seenAnchors = new Set<string>();
    sats.forEach((s, i) => {
      const agent = agentsRef.current[i];
      const col = agent ? agentColorsRef.current[i] : null;
      const a = t * s.speed + s.phase;
      // Spawned agents ride a wider outer orbit — core crew inner, spawn outer.
      const rad = s.radius * (agent?.spawnSpec ? 1.38 : 1);
      const px = Math.cos(a) * rad;
      const py = Math.sin(a * 0.7 + s.incl) * rad * 0.45;
      const pz = Math.sin(a) * rad;

      // Screen anchor & 3D world position — the DOM inspect card & camera chase ride this point.
      if (agent && groupRef.current) {
        seenAnchors.add(agent.id);
        const wp = tmpV.set(px, py, pz).applyMatrix4(groupRef.current.matrixWorld);
        if (!agentWorldPositions[agent.id]) {
          agentWorldPositions[agent.id] = new THREE.Vector3();
        }
        agentWorldPositions[agent.id].copy(wp);

        const proj = tmpV.clone().project(cam);
        agentScreenAnchors[agent.id] = {
          x: (proj.x * 0.5 + 0.5) * vw,
          y: (0.5 - proj.y * 0.5) * vh,
          behind: proj.z > 1,
        };
      }

      const mote = moteRefs.current[i];

      // Packet cycle — computed before the mote so anticipation can shape it.
      const working = !!(agent && col && agent.status === 'working');
      const rate = 0.42 + ((i * 37) % 10) * 0.03;
      const phase = ((i * 53) % 10) * 0.1;
      const prog = working ? (t * rate + phase) % 1 : 0;
      const prev = progRef.current[i] ?? 0;
      if (working && prog < prev - 0.5) {
        impactLife.current[i] = 1; // packet landed
        // The core feels the arrival: energy flinch tinted to this agent.
        sig.ingest = Math.min(1, sig.ingest + 0.55);
        sig.ingestColor.copy(col!);
        // Neuro-acoustic spatial feedback: crystal chime + sub-bass impact
        if (typeof window !== 'undefined') {
          neuroAudio.playPacketChime(SAT_AGENT_COLORS[agent.id] || '#38bdf8');
          neuroAudio.playCoreImpact();
        }
      }
      progRef.current[i] = prog;
      const eased = prog < 0.5 ? 4 * prog * prog * prog : 1 - Math.pow(-2 * prog + 2, 3) / 2;
      // Wind-up: mote inhales ~18% just before each packet launch.
      const wind = working && prog < 0.08 ? 1 - 0.18 * Math.sin((prog / 0.08) * Math.PI) : 1;

      // ── vessel mote: ambient ember when slot empty, celestial halo when agent active ──
      if (mote) {
        mote.position.set(px, py, pz);
        const mm = mote.material as THREE.SpriteMaterial;
        if (agent && col) {
          if (agent.status === 'working') {
            const pulse = (1 + 0.16 * Math.sin(t * 5.2 + i * 1.7)) * wind;
            mote.scale.setScalar(0.38 * pulse);
            mm.color.copy(col).lerp(COLOR_WHITE, 0.35 + 0.15 * Math.sin(t * 5.2 + i));
            mm.opacity = 0.65;
          } else if (agent.status === 'error') {
            mote.scale.setScalar(0.32 + 0.06 * Math.sin(t * 7 + i));
            mm.color.copy(COLOR_CRIMSON);
            mm.opacity = 0.6;
          } else if (agent.status === 'offline' || agent.status === 'retired') {
            mote.scale.setScalar(0.22);
            mm.color.copy(col).multiplyScalar(0.4);
            mm.opacity = 0.15;
          } else {
            mote.scale.setScalar(0.28 + 0.03 * Math.sin(t * 1.8 + i * 2));
            mm.color.copy(col);
            mm.opacity = 0.42;
          }
        } else {
          // ambient ember
          mote.scale.setScalar(0.16 + 0.03 * Math.sin(t * 2.4 + i * 1.3));
          mm.color.copy(sig.colorRim).lerp(COLOR_WHITE, 0.35);
          mm.opacity = 0.28 + 0.12 * Math.sin(t * 2 + i);
        }
      }

      // ── name tag: small, dim, status-gated ──
      const tag = tagRefs.current[i];
      if (tag) {
        tag.position.set(px, py - 0.3, pz);
        (tag.material as THREE.SpriteMaterial).opacity = !agent ? 0
          : agent.status === 'working' ? 0.85
            : agent.status === 'retired' ? 0.18
              : agent.status === 'offline' ? 0.3 : 0.5;
      }

      // ── Crystalline Neural Astrolabe: 3D cyber-celestial vessel ──
      const hull = satMeshRefs.current[i];
      if (hull) {
        hull.visible = !!agent;
        if (agent && col) {
          hull.position.set(px, py, pz);
          // Orient: tangential alignment with orbital arc + fluid Lissajous drift
          const a2 = a + 0.09;
          const rad2 = s.radius * (agent.spawnSpec ? 1.38 : 1);
          tmpW.set(
            Math.cos(a2) * rad2 - px,
            Math.sin(a2 * 0.7 + s.incl) * rad2 * 0.45 - py,
            Math.sin(a2) * rad2 - pz,
          ).normalize();
          tmpT.set(px, py, pz).normalize(); // radial outward
          const fwd = tmpDir.copy(tmpW).transformDirection(groupRef.current!.matrixWorld).normalize();
          const up = tmpPerp.copy(tmpT).transformDirection(groupRef.current!.matrixWorld).normalize();
          tmpCtrl.crossVectors(up, fwd).normalize();
          basisMat.makeBasis(tmpCtrl, up, fwd);
          hull.quaternion.setFromRotationMatrix(basisMat);

          // Ethereal hydrodynamic attitude sway
          const swayZ = Math.sin(t * 0.45 + i * 1.7) * 0.08 + Math.cos(t * 0.22 + i) * 0.04;
          const swayX = Math.cos(t * 0.38 + i * 2.1) * 0.06;
          hull.rotateZ(swayZ);
          hull.rotateX(swayX);

          const ent = satIsEnterprise(agent);
          const apex = satIsApex(agent);
          const dist = satIsDistributor(agent);
          const sent = satIsSentinel(agent);
          const dim = agent.status === 'offline' || agent.status === 'retired';
          const err = agent.status === 'error';
          const wrk = agent.status === 'working';

          // Quantum core: faceted star tetrahedron spinning & pulsing
          const core = satCoreRefs.current[i];
          const coreMat = satCoreMatRefs.current[i];
          if (core) {
            core.rotation.x = t * (wrk ? (apex ? 3.4 : 2.8) : (apex ? 1.3 : 0.95)) + i;
            core.rotation.y = t * (wrk ? (apex ? 4.2 : 3.6) : (apex ? 1.6 : 1.25)) + i * 1.4;
            const corePulse = wrk
              ? 1 + (apex ? 0.24 : 0.18) * Math.sin(t * 8.5 + i * 2)
              : err
                ? 0.9 + 0.25 * Math.sin(t * 14 + i)
                : 1 + 0.08 * Math.sin(t * 2.2 + i);
            core.scale.setScalar(corePulse);
          }
          if (coreMat) {
            coreMat.color.copy(col).lerp(COLOR_WHITE, wrk ? (apex ? 0.6 : 0.45) : 0.25);
            coreMat.emissive.copy(err ? COLOR_CRIMSON : col);
            coreMat.emissiveIntensity = dim
              ? 0.2
              : apex
                ? (wrk ? 2.4 + 0.5 * Math.sin(t * 7) : 1.4)
                : wrk
                  ? 1.8 + 0.4 * Math.sin(t * 6)
                  : err
                    ? 1.5 * (0.5 + 0.5 * Math.sin(t * 12))
                    : 0.9;
          }

          // Crystalline dodecahedron cage: counter-rotating iridescent refraction
          const cage = satCageRefs.current[i];
          const cageMat = satCageMatRefs.current[i];
          const wireMat = satWireMatRefs.current[i];
          if (cage) {
            cage.rotation.x = -t * (wrk ? 1.05 : 0.4) + i * 0.7;
            cage.rotation.y = t * (wrk ? 1.25 : 0.5) + i;
          }
          if (cageMat) {
            cageMat.emissive.copy(err ? COLOR_CRIMSON : col);
            cageMat.emissiveIntensity = dim ? 0.04 : apex ? (wrk ? 0.6 : 0.3) : wrk ? 0.48 + 0.15 * Math.sin(t * 4) : 0.22;
            cageMat.opacity = dim ? 0.3 : 0.88;
          }
          if (wireMat) {
            wireMat.color.copy(err ? COLOR_CRIMSON : col);
            wireMat.opacity = dim ? 0.1 : wrk ? 0.8 + 0.2 * Math.sin(t * 5) : 0.42;
          }

          // Astrolabe Gimbal Ring 1: equatorial rotation
          const r1 = satRing1Refs.current[i];
          const r1Mat = satRing1MatRefs.current[i];
          if (r1) {
            r1.rotation.z = t * (wrk ? 2.4 : 0.8) + i * 0.5;
            r1.rotation.x = Math.sin(t * 0.6 + i) * 0.24;
          }
          if (r1Mat) {
            r1Mat.color.copy(col).lerp(COLOR_LIGHT_SLATE, 0.45);
            r1Mat.emissive.copy(err ? COLOR_CRIMSON : col);
            r1Mat.emissiveIntensity = dim ? 0.08 : wrk ? 1.1 : 0.5;
          }

          // Astrolabe Gimbal Ring 2: polar gyroscopic precession
          const r2 = satRing2Refs.current[i];
          const r2Mat = satRing2MatRefs.current[i];
          if (r2) {
            r2.rotation.y = -t * (wrk ? 2.1 : 0.7) + i * 0.8;
            r2.rotation.z = Math.cos(t * 0.5 + i) * 0.24;
          }
          if (r2Mat) {
            r2Mat.color.copy(col).lerp(COLOR_SLATE, 0.3);
            r2Mat.emissive.copy(err ? COLOR_CRIMSON : col);
            r2Mat.emissiveIntensity = dim ? 0.08 : wrk ? 0.95 : 0.45;
          }

          // Enterprise Celestial Halo & Diamond Shards
          const entGroup = satEnterpriseGroupRefs.current[i];
          const r3Mat = satRing3MatRefs.current[i];
          if (entGroup) {
            entGroup.visible = ent || apex;
            if (entGroup.visible) {
              entGroup.rotation.z = t * (wrk ? 1.4 : 0.45) + i;
              entGroup.rotation.x = 0.62 + Math.sin(t * 0.35 + i) * 0.08;
            }
          }
          if (r3Mat) {
            r3Mat.color.copy(col).lerp(COLOR_WHITE, 0.6);
            r3Mat.emissive.copy(err ? COLOR_CRIMSON : col);
            r3Mat.emissiveIntensity = dim ? 0.1 : apex ? (wrk ? 1.5 : 0.9) : wrk ? 1.3 : 0.65;
          }

          // Harmonic Field Corona: central additive glow
          const corona = satCoronaRefs.current[i];
          if (corona) {
            const cm = corona.material as THREE.SpriteMaterial;
            cm.color.copy(err ? COLOR_CRIMSON : col);
            corona.scale.setScalar((dim ? 0.16 : wrk ? 0.42 + 0.08 * Math.sin(t * 7 + i) : 0.28 + 0.03 * Math.sin(t * 2 + i)) * (apex ? 1.4 : ent ? 1.25 : 1));
            cm.opacity = dim ? 0.12 : wrk ? 0.88 : 0.52;
          }

          // Vessel scale: apex singularities get +38% presence, enterprise get +28%
          const baseScale = (apex ? 0.36 : ent ? 0.32 : 0.26) * (wrk && !dim ? 1 + 0.08 * Math.sin(t * 5.2 + i * 1.7) : 1);
          hull.scale.setScalar(baseScale);

          // ── Mitotic Daughter Singularity (Cellular Morphogenesis & Division) ──
          const mito = satMitosisRefs.current[i];
          const mitoMat = satMitosisMatRefs.current[i];
          if (mito && mitoMat) {
            if (wrk && !dim) {
              mito.visible = true;
              const mitoAngle = t * 4.2 + i * 1.6;
              const mitoR = 0.22 + 0.04 * Math.sin(t * 6.5);
              mito.position.set(
                Math.cos(mitoAngle) * mitoR,
                Math.sin(mitoAngle * 1.5) * 0.08,
                Math.sin(mitoAngle) * mitoR
              );
              mito.rotation.y += delta * 4.8;
              mito.rotation.x += delta * 3.2;
              mitoMat.color.copy(col);
              mitoMat.emissive.copy(err ? COLOR_CRIMSON : col);
              mitoMat.emissiveIntensity = 1.6 + 0.6 * Math.sin(t * 8.0);
            } else {
              mito.visible = false;
            }
          }
        }
      }

      // ── ember current: curved particle stream agent → core ──
      // No beam geometry — just light motes flowing along a quadratic bezier
      // whose control point sways on two slow sines. Reads as energy in
      // motion (aurora/flow-field), never a straight line. Live agents keep a
      // faint "whisper" current even while idle; only working agents get the
      // full stream + packet leaders.
      const alive = !!(agent && col && agent.status !== 'offline' && agent.status !== 'retired');
      if (agent && col && alive) {
        // Path: agent mote → core origin, control point offset perpendicular
        // to the agent→core axis and breathing up/down slowly.
        tmpDir.set(-px, -py, -pz).normalize();
        tmpPerp.crossVectors(tmpDir, UP);
        if (tmpPerp.lengthSq() < 0.001) tmpPerp.set(1, 0, 0); else tmpPerp.normalize();
        const sway = Math.sin(t * 0.55 + i * 1.9) * 0.55 + Math.sin(t * 0.21 + i * 0.7) * 0.35;
        const lift = 0.35 + 0.25 * Math.sin(t * 0.4 + i * 2.1);
        tmpCtrl.set(px * 0.5, py * 0.5 + lift, pz * 0.5).addScaledVector(tmpPerp, sway);
        const quadAt = (u: number, out: THREE.Vector3) => {
          const v = 1 - u;
          const w0 = v * v, w1 = 2 * v * u;
          return out.set(
            w0 * px + w1 * tmpCtrl.x,
            w0 * py + w1 * tmpCtrl.y + u * u * 0.15,
            w0 * pz + w1 * tmpCtrl.z,
          );
        };

        // Delivery surge — a completed task briefly accelerates + brightens
        // the stream, a "delivery" beat tied to a real runtime event.
        const surge = Math.max(0, (surgeRef.current[i] || 0) - delta * 0.45);
        surgeRef.current[i] = surge;
        const speedMul = 1 + surge * 1.8;

        // Stream body. Working: 9 bright embers. Idle: 3 faint whisper motes.
        const embers = emberRefs.current[i] || [];
        const emberN = working ? EMBER_COUNT : 3;
        for (let k = 0; k < EMBER_COUNT; k++) {
          const em = embers[k];
          if (!em) continue;
          if (k >= emberN) { em.visible = false; continue; }
          const dur = (working ? 1.7 : 7.5) + ((i * 13 + k * 7) % 10) * 0.22;
          const ph = ((i * 29 + k * 11) % 10) * 0.1;
          const u = (((t / (dur / speedMul) + ph) % 1) + 1) % 1;
          quadAt(u, tmpV);
          // Subtle wander so the stream feels turbulent, not rail-guided.
          const wob = 0.02 * Math.sin(t * 2.6 + k * 2.4 + i) * (working ? 1 : 0.4);
          tmpV.x += tmpPerp.x * wob;
          tmpV.y += wob * 0.6;
          tmpV.z += tmpPerp.z * wob;
          em.visible = true;
          em.position.copy(tmpV);
          const em2 = em.material as THREE.SpriteMaterial;
          if (working) {
            const bright = Math.sin(u * Math.PI);
            em2.color.copy(col).lerp(c('#ffffff'), 0.25 + 0.45 * u);
            em2.opacity = 0.6 * bright * (1 + surge * 0.7);
            em.scale.setScalar(0.035 + 0.055 * bright * (0.7 + 0.3 * Math.sin(t * 3 + k)));
          } else {
            em2.color.copy(col).multiplyScalar(0.55);
            em2.opacity = 0.09 + 0.04 * Math.sin(t * 1.3 + k * 2 + i);
            em.scale.setScalar(0.028);
          }
        }

        // Three staggered packet leaders riding the same curve — working only.
        const packets = packetRefs.current[i] || [];
        const trails = trailRefs.current[i] || [];
        for (let p = 0; p < 3; p++) {
          const packet = packets[p];
          const trail = trails[p];
          if (!working) {
            if (packet) packet.visible = false;
            if (trail) trail.visible = false;
            continue;
          }
          const pp = ((prog - p / 3) % 1 + 1) % 1;
          const pe = pp < 0.5 ? 4 * pp * pp * pp : 1 - Math.pow(-2 * pp + 2, 3) / 2;
          const pfade = Math.sin(pp * Math.PI);
          if (packet) {
            packet.visible = true;
            quadAt(pe, packet.position);
            const pm = packet.material as THREE.SpriteMaterial;
            pm.color.copy(col).lerp(c('#ffffff'), p === 0 ? 0.5 : 0.25);
            pm.opacity = (p === 0 ? 0.95 : 0.6) * pfade;
            packet.scale.setScalar((p === 0 ? 0.2 : 0.15) + 0.08 * pfade);
          }
          if (trail) {
            trail.visible = true;
            quadAt(Math.max(0, pe - 0.045), trail.position);
            const tm = trail.material as THREE.SpriteMaterial;
            tm.color.copy(col);
            tm.opacity = 0.3 * pfade;
            trail.scale.setScalar(0.13);
          }
          // Cryptographic Proof Lattice — rotating zero-trust geometric cage
          const lattice = (satLatticeRefs.current[i] || [])[p];
          if (lattice) {
            lattice.visible = true;
            lattice.position.copy(packet ? packet.position : tmpV);
            lattice.rotation.x = t * 3.5 + p;
            lattice.rotation.y = t * 4.2 + p * 2;
            const lscale = (p === 0 ? 0.09 : 0.065) + 0.02 * Math.sin(t * 8.0 + p);
            lattice.scale.setScalar(lscale);
            const lm = (satLatticeMatRefs.current[i] || [])[p];
            if (lm) {
              lm.opacity = (p === 0 ? 0.85 : 0.45) * pfade;
              lm.color.copy(col).lerp(c('#34d399'), 0.7);
            }
          }
        }
      } else {
        // Offline/retired/ambient — hide the whole current.
        for (const em of emberRefs.current[i] || []) if (em) em.visible = false;
        for (const pk of packetRefs.current[i] || []) if (pk) pk.visible = false;
        for (const tr of trailRefs.current[i] || []) if (tr) tr.visible = false;
        for (const lt of satLatticeRefs.current[i] || []) if (lt) lt.visible = false;
      }
      // Core impact flash — fires when the packet arrives.
      const impact = impactRefs.current[i];
      if (impact) {
        const life = impactLife.current[i] || 0;
        if (life > 0) {
          impactLife.current[i] = life - delta * 1.6;
          const k = 1 - Math.max(0, impactLife.current[i]);
          impact.visible = true;
          impact.position.set(0, 0, 0);
          impact.scale.setScalar(0.4 + k * 1.6);
          const im = impact.material as THREE.SpriteMaterial;
          im.color.copy(col!);
          im.opacity = 0.8 * (1 - k);
        } else {
          impact.visible = false;
        }
      }
    });
    // ── Inter-agent token photons: agent.comm packets in world space ──
    const nowS = performance.now() / 1000;
    photons.current = photons.current.filter((ph) => {
      const age = nowS - ph.t0;
      if (age > 1.15) return false;
      const a = agentWorldPositions[ph.from];
      const b = ph.to === 'cortex' ? tmpV.set(0, 0, 0) : agentWorldPositions[ph.to];
      const spr = photonRefs.current[ph.slot];
      if (!a || !b || !spr) return false;
      const p = age / 1.15;
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      tmpDir.copy(b).sub(a);
      const chord = tmpDir.length();
      if (chord < 0.001) return false;
      tmpDir.normalize();
      tmpPerp.crossVectors(tmpDir, UP).normalize();
      if (tmpPerp.lengthSq() < 0.001) tmpPerp.set(0, 1, 0);
      const arc = Math.sin(p * Math.PI) * Math.min(0.6, chord * 0.18);
      tmpCtrl.copy(a).lerp(b, e).addScaledVector(tmpPerp, arc);
      spr.visible = true;
      spr.position.copy(tmpCtrl);
      const m = spr.material as THREE.SpriteMaterial;
      m.color.set(ph.color);
      m.opacity = Math.sin(p * Math.PI) * 0.9;
      spr.scale.setScalar(0.13 + 0.05 * Math.sin(p * Math.PI));
      return true;
    });
    for (let k = 0; k < PHOTON_COUNT; k++) {
      const inUse = photons.current.some((ph) => ph.slot === k);
      const spr = photonRefs.current[k];
      if (spr && !inUse) spr.visible = false;
    }

    // Prune anchors and world vectors for agents that left the visible fleet.
    for (const k of Object.keys(agentScreenAnchors)) {
      if (!seenAnchors.has(k)) {
        delete agentScreenAnchors[k];
        delete agentWorldPositions[k];
      }
    }
  });

  return (
    <>
    <group ref={groupRef}>
      {/* Lighting for the enterprise satellite hulls (standard materials).
          Sprites/basic materials are unlit and unaffected. The cyan point
          light at the core doubles as earthshine/rim on the hulls. */}
      <ambientLight intensity={0.55} color="#9db8d8" />
      <directionalLight position={[4, 6, 3]} intensity={1.5} color="#fff1d6" />
      <pointLight position={[0, 0, 0]} intensity={2.6} color="#67e8f9" distance={5} decay={2} />
      <pointLight position={[-4, -2, -3]} intensity={0.9} color="#f59e0b" distance={6} decay={2} />
      {sats.map((s, i) => (
        <group key={i}>
          <sprite
            ref={(el) => { moteRefs.current[i] = el; }}
            renderOrder={4}
            onClick={(e) => {
              e.stopPropagation();
              const ag = agentsRef.current[i];
              if (ag) window.dispatchEvent(new CustomEvent('cortex-agent-select', { detail: ag.id }));
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = ''; }}
          >
            <spriteMaterial
              map={getGlowTexture()}
              color="#9be8ff"
              transparent
              opacity={0.3}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
          {/* Crystalline Neural Astrolabe — sovereign resonance vessel.
              Celestial sacred geometry: faceted quantum core, translucent
              crystalline dodecahedron hull, and counter-rotating astrolabe rings. */}
          <group
            ref={(el) => { satMeshRefs.current[i] = el; }}
            visible={false}
            onClick={(e) => {
              e.stopPropagation();
              const ag = agentsRef.current[i];
              if (ag) window.dispatchEvent(new CustomEvent('cortex-agent-select', { detail: ag.id }));
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = ''; }}
          >
            {/* ── 1. Inner Quantum Singularity (Nested Star Tetrahedron) ── */}
            <group ref={(el) => { satCoreRefs.current[i] = el; }}>
              <mesh>
                <octahedronGeometry args={[0.042, 0]} />
                <meshStandardMaterial
                  ref={(el) => { satCoreMatRefs.current[i] = el; }}
                  color="#ffffff"
                  emissive="#67e8f9"
                  emissiveIntensity={1.35}
                  roughness={0.08}
                  metalness={0.92}
                />
              </mesh>
              {/* Counter-nested diamond spark forming sacred 3D merkaba */}
              <mesh rotation={[Math.PI / 4, 0, Math.PI / 4]}>
                <octahedronGeometry args={[0.024, 0]} />
                <meshBasicMaterial
                  color="#ffffff"
                  transparent
                  opacity={0.95}
                />
              </mesh>
            </group>

            {/* ── 2. Crystalline Prismatic Shard Hull (Iridescent Flint Glass) ── */}
            <mesh ref={(el) => { satCageRefs.current[i] = el; }}>
              <dodecahedronGeometry args={[0.078, 0]} />
              <meshPhysicalMaterial
                ref={(el) => { satCageMatRefs.current[i] = el; }}
                color="#f0f9ff"
                roughness={0.06}
                metalness={0.12}
                ior={1.62}
                iridescence={0.85}
                iridescenceIOR={1.33}
                clearcoat={1.0}
                clearcoatRoughness={0.04}
                transparent
                opacity={0.82}
                depthWrite={false}
              />
            </mesh>

            {/* ── 3. Geometric Laser Filament (Faceting Wireframe) ── */}
            <mesh>
              <dodecahedronGeometry args={[0.079, 0]} />
              <meshBasicMaterial
                ref={(el) => { satWireMatRefs.current[i] = el; }}
                color="#67e8f9"
                wireframe
                transparent
                opacity={0.42}
              />
            </mesh>

            {/* ── 4. Astrolabe Gimbal Rings (Nested Torus Gyroscopes) ── */}
            {/* Equatorial Ring */}
            <mesh ref={(el) => { satRing1Refs.current[i] = el; }}>
              <torusGeometry args={[0.118, 0.0032, 16, 56]} />
              <meshStandardMaterial
                ref={(el) => { satRing1MatRefs.current[i] = el; }}
                color="#e2e8f0"
                emissive="#67e8f9"
                emissiveIntensity={0.6}
                metalness={0.95}
                roughness={0.12}
              />
            </mesh>
            {/* Polar Ring */}
            <mesh
              ref={(el) => { satRing2Refs.current[i] = el; }}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[0.136, 0.0032, 16, 56]} />
              <meshStandardMaterial
                ref={(el) => { satRing2MatRefs.current[i] = el; }}
                color="#cbd5e1"
                emissive="#67e8f9"
                emissiveIntensity={0.55}
                metalness={0.95}
                roughness={0.12}
              />
            </mesh>

            {/* ── 5. Enterprise Celestial Halo & Cardinal Focus Diamonds ── */}
            <group
              ref={(el) => { satEnterpriseGroupRefs.current[i] = el; }}
              visible={false}
              rotation={[0.6, 0.2, 0]}
            >
              {/* Outer Celestial Ring */}
              <mesh>
                <torusGeometry args={[0.168, 0.0024, 16, 64]} />
                <meshStandardMaterial
                  ref={(el) => { satRing3MatRefs.current[i] = el; }}
                  color="#ffffff"
                  emissive="#67e8f9"
                  emissiveIntensity={0.7}
                  metalness={0.95}
                  roughness={0.1}
                />
              </mesh>
              {/* 4 Cardinal Diamond Micro-Focus Prisms */}
              {[
                [0.168, 0, 0],
                [-0.168, 0, 0],
                [0, 0.168, 0],
                [0, -0.168, 0],
              ].map((pos, pIdx) => (
                <mesh key={pIdx} position={pos as [number, number, number]}>
                  <octahedronGeometry args={[0.015, 0]} />
                  <meshStandardMaterial
                    color="#ffffff"
                    emissive="#67e8f9"
                    emissiveIntensity={1.0}
                    metalness={0.9}
                    roughness={0.1}
                  />
                </mesh>
              ))}
            </group>

            {/* ── 6. Additive Luminous Corona ── */}
            <sprite
              ref={(el) => { satCoronaRefs.current[i] = el; }}
              renderOrder={5}
            >
              <spriteMaterial
                map={getGlowTexture()}
                color="#67e8f9"
                transparent
                opacity={0.65}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </sprite>

            {/* ── 7. Mitotic Daughter Spark (Cellular Morphogenesis & Division) ── */}
            <mesh
              ref={(el) => { satMitosisRefs.current[i] = el; }}
              visible={false}
            >
              <octahedronGeometry args={[0.024, 0]} />
              <meshStandardMaterial
                ref={(el) => { satMitosisMatRefs.current[i] = el; }}
                color="#ffffff"
                emissive="#67e8f9"
                emissiveIntensity={1.8}
                roughness={0.06}
                metalness={0.92}
              />
            </mesh>
          </group>
          {/* Ember current — the stream body: motes flowing agent → core
              along a living curve. No geometry, pure additive light. */}
          {Array.from({ length: EMBER_COUNT }, (_, k) => (
            <sprite
              key={`em${k}`}
              ref={(el) => {
                if (!emberRefs.current[i]) emberRefs.current[i] = [];
                emberRefs.current[i][k] = el;
              }}
              visible={false}
              renderOrder={3}
            >
              <spriteMaterial
                map={getGlowTexture()}
                color="#67e8f9"
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </sprite>
          ))}
          {/* Asynchronous packet leaders riding the same curve (Relay pattern). */}
          {[0, 1, 2].map((p) => (
            <sprite
              key={`pk${p}`}
              ref={(el) => {
                if (!packetRefs.current[i]) packetRefs.current[i] = [];
                packetRefs.current[i][p] = el;
              }}
              visible={false}
              renderOrder={6}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (agent && typeof window !== 'undefined') {
                  const recent = (agentsClient.snapshot.tasks || []).find(
                    (t) => t.agentId === agent.id && (t.status === 'running' || t.status === 'queued')
                  );
                  window.dispatchEvent(
                    new CustomEvent('cortex-packet-hover', {
                      detail: {
                        agentId: agent.id,
                        agentName: agent.name,
                        color: SAT_AGENT_COLORS[agent.id] || '#38bdf8',
                        title: recent?.title || 'Telemetry packet streaming',
                        x: e.clientX,
                        y: e.clientY,
                      },
                    })
                  );
                }
              }}
              onPointerOut={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('cortex-packet-hover', { detail: null }));
                }
              }}
            >
              <spriteMaterial
                map={getGlowTexture()}
                color="#ffffff"
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </sprite>
          ))}
          {[0, 1, 2].map((p) => (
            <sprite
              key={`tr${p}`}
              ref={(el) => {
                if (!trailRefs.current[i]) trailRefs.current[i] = [];
                trailRefs.current[i][p] = el;
              }}
              visible={false}
              renderOrder={5}
            >
              <spriteMaterial
                map={getGlowTexture()}
                color="#67e8f9"
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </sprite>
          ))}
          {/* Cryptographic Proof Lattice Cages */}
          {[0, 1, 2].map((p) => (
            <mesh
              key={`lattice${p}`}
              ref={(el) => {
                if (!satLatticeRefs.current[i]) satLatticeRefs.current[i] = [];
                satLatticeRefs.current[i][p] = el;
              }}
              visible={false}
              renderOrder={7}
            >
              <icosahedronGeometry args={[1, 0]} />
              <meshBasicMaterial
                ref={(el) => {
                  if (!satLatticeMatRefs.current[i]) satLatticeMatRefs.current[i] = [];
                  satLatticeMatRefs.current[i][p] = el;
                }}
                wireframe
                color="#34d399"
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          ))}
          <sprite ref={(el) => { impactRefs.current[i] = el; }} visible={false} renderOrder={7} position={[0, 0, 0]}>
            <spriteMaterial
              map={getGlowTexture()}
              color="#67e8f9"
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        </group>
      ))}
    </group>
      {/* Inter-agent token photons — world-space sprites outside the rotating
          group so agentWorldPositions map 1:1 to scene coordinates. */}
      {Array.from({ length: PHOTON_COUNT }, (_, k) => (
        <sprite
          key={`photon${k}`}
          ref={(el) => { photonRefs.current[k] = el; }}
          visible={false}
          renderOrder={8}
        >
          <spriteMaterial
            map={getGlowTexture()}
            color="#67e8f9"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </>
  );
}

// ── Model constellation — the Sentinel's sky, made physical ──────────────
// Every probed/discovered model is a point on two counter-rotating shells
// outside the satellite ring. Color encodes real probe health; only the
// flagship healthy models carry name sprites (same rule as the Foundry).

const MODEL_LABEL_COUNT = 6;

function modelPointColor(m: ModelClient): THREE.Color {
  switch (m.status) {
    case 'healthy': return c('#bfefff');
    case 'degraded': return c('#fbbf24');
    case 'down': return c('#7f1d1d');
    default: return c('#6d5bd0'); // probation/unknown
  }
}

function ModelConstellation({ live }: { live: React.MutableRefObject<LiveSignal> }) {
  const groupA = useRef<THREE.Group>(null);
  const groupB = useRef<THREE.Group>(null);
  const [models, setModels] = React.useState<ModelClient[]>([]);

  React.useEffect(() => {
    const sync = () => setModels(agentsClient.snapshot.models || []);
    agentsClient.start();
    sync();
    return agentsClient.subscribe(sync);
  }, []);

  // Split models deterministically across two shells; positions are stable
  // per model id so health flicker never makes stars jump.
  const { geoA, geoB, labels } = useMemo(() => {
    const mk = (pairs: { m: ModelClient; i: number }[], ring: number) => {
      const pos = new Float32Array(pairs.length * 3);
      const col = new Float32Array(pairs.length * 3);
      const golden = Math.PI * (3 - Math.sqrt(5));
      pairs.forEach(({ m, i }, k) => {
        const a = i * golden + ring * 1.7;
        const r = 7.1 + ring * 0.9 + ((i * 37) % 10) * 0.16;
        const y = Math.sin(a * 2.3 + ring) * (0.9 + ring * 0.5);
        pos[k * 3] = Math.cos(a) * r;
        pos[k * 3 + 1] = y;
        pos[k * 3 + 2] = Math.sin(a) * r;
        const cc = modelPointColor(m);
        col[k * 3] = cc.r; col[k * 3 + 1] = cc.g; col[k * 3 + 2] = cc.b;
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    };
    const pairs = models.map((m, i) => ({ m, i }));
    const even = pairs.filter((p) => p.i % 2 === 0);
    const odd = pairs.filter((p) => p.i % 2 === 1);
    const flagships = models.filter((m) => m.status === 'healthy').slice(0, MODEL_LABEL_COUNT);
    // Recompute flagship positions on ring A's layout for label placement.
    const labelPts = flagships.map((m) => {
      const idx = models.indexOf(m);
      const ring = idx % 2;
      const golden = Math.PI * (3 - Math.sqrt(5));
      const a = idx * golden + ring * 1.7;
      const r = 7.1 + ring * 0.9 + ((idx * 37) % 10) * 0.16;
      return {
        ring,
        x: Math.cos(a) * r, y: Math.sin(a * 2.3 + ring) * (0.9 + ring * 0.5) - 0.28,
        z: Math.sin(a) * r, name: (String(m.id).split('/').pop() || m.id).slice(0, 24),
      };
    });
    return { geoA: mk(even, 0), geoB: mk(odd, 1), labels: labelPts };
  }, [models]);

  useFrame((_, delta) => {
    if (groupA.current) groupA.current.rotation.y += delta * 0.018;
    if (groupB.current) groupB.current.rotation.y -= delta * 0.011;
  });

  if (!models.length) return null;
  const shell = (geo: THREE.BufferGeometry, ref: React.RefObject<THREE.Group | null>, ring: number) => (
    <group ref={ref}>
      <points geometry={geo}>
        <pointsMaterial vertexColors size={ring === 0 ? 0.05 : 0.04} sizeAttenuation transparent opacity={ring === 0 ? 0.85 : 0.7} depthWrite={false} />
      </points>
      {labels.filter(l => l.ring === ring).map((l, i) => (
        <sprite key={i} position={[l.x, l.y, l.z]} scale={[1.15, 0.29, 1]} renderOrder={4}>
          <spriteMaterial map={textTexture(l.name, '#9be8ff')} transparent opacity={0.75} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
  return (
    <>
      {shell(geoA, groupA, 0)}
      {shell(geoB, groupB, 1)}
    </>
  );
}

// ── Neural web (nodes + synapses) ───────────────────────────────────────

const NODE_COUNT = 130;

const nodeVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uLevel;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 0.5 + 0.5 * sin(uTime * (0.8 + aSeed * 2.4) + aSeed * 50.0);
    vAlpha = 0.25 + tw * 0.55 + uLevel * 0.25;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.2 + aSeed * 2.4) * uPixelRatio * (120.0 / -mv.z);
  }
`;

const nodeFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(uColor * a * 1.6, a);
  }
`;

function NeuralWeb({ live }: { live: React.MutableRefObject<LiveSignal> }) {
  const groupRef = useRef<THREE.Group>(null);
  const nodeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
          uLevel: { value: 0 },
          uColor: { value: c('#67e8f9') },
        },
        vertexShader: nodeVertex,
        fragmentShader: nodeFragment,
      }),
    []
  );

  const { nodeGeo, edgeGeo } = useMemo(() => {
    const pos: number[] = [];
    const seed = new Float32Array(NODE_COUNT);
    for (let i = 0; i < NODE_COUNT; i++) {
      const r = 1.9 + Math.random() * 1.7;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
      seed[i] = Math.random();
    }
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    nodeGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    // edges: connect each node to its 2 nearest neighbours
    const verts: number[] = [];
    const p = new THREE.Vector3();
    for (let i = 0; i < NODE_COUNT; i++) {
      p.fromArray(pos, i * 3);
      const dists: { d: number; j: number }[] = [];
      for (let j = 0; j < NODE_COUNT; j++) {
        if (j === i) continue;
        const q = new THREE.Vector3().fromArray(pos, j * 3);
        dists.push({ d: p.distanceTo(q), j });
      }
      dists.sort((a, b) => a.d - b.d);
      for (let k = 0; k < 2; k++) {
        const j = dists[k].j;
        if (j > i) {
          verts.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
        }
      }
    }
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return { nodeGeo, edgeGeo };
  }, []);

  const edgeMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#22d3ee',
        transparent: true,
        opacity: 0.10,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  useFrame((state, delta) => {
    const sig = live.current;
    nodeMat.uniforms.uTime.value += delta;
    nodeMat.uniforms.uPixelRatio.value = state.viewport.dpr;
    nodeMat.uniforms.uLevel.value = sig.level;
    nodeMat.uniforms.uColor.value.copy(sig.colorRim);
    edgeMat.color.copy(sig.colorRim);
    edgeMat.opacity = 0.06 + sig.energy * 0.08 + sig.level * 0.10;
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.03 * (0.4 + sig.energy);
      groupRef.current.rotation.x = Math.sin(nodeMat.uniforms.uTime.value * 0.11) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <points geometry={nodeGeo} material={nodeMat} frustumCulled={false} />
      <lineSegments geometry={edgeGeo} material={edgeMat} frustumCulled={false} />
    </group>
  );
}

// ── Shockwaves (click pulses) ────────────────────────────────────────────

interface Shock { t0: number }

function Shockwaves({ fx }: { fx: React.MutableRefObject<{ shocks: Shock[] }> }) {
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.94, 1.0, 96), []);
  const ringMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uLife: { value: 1 }, uColor: { value: c('#67e8f9') } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uLife;
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            float a = (1.0 - uLife) * 0.85;
            gl_FragColor = vec4(uColor * a * 1.8, a);
          }
        `,
      }),
    []
  );
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    const shocks = fx.current.shocks;
    for (let i = 0; i < 4; i++) {
      const m = meshes.current[i];
      const s = shocks[i];
      if (!m) continue;
      if (!s) { m.visible = false; continue; }
      const life = (now - s.t0) / 1.1;
      if (life >= 1) { m.visible = false; shocks[i] = undefined as unknown as Shock; continue; }
      m.visible = true;
      const e = 1 - Math.pow(1 - life, 3); // ease-out cubic
      m.scale.setScalar(0.4 + e * 7.5);
      ringMat.uniforms.uLife.value = life;
      // orient roughly toward camera
      m.quaternion.copy(state.camera.quaternion);
    }
  });

  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(el) => { meshes.current[i] = el; }}
          geometry={ringGeo}
          material={ringMat}
          visible={false}
        />
      ))}
    </group>
  );
}

// ── Inner wire sphere (detail shell) ────────────────────────────────────

function DetailShell({ live }: { live: React.MutableRefObject<LiveSignal> }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((state, delta) => {
    const sig = live.current;
    if (ref.current) {
      ref.current.rotation.y += delta * 0.22 * (0.5 + sig.energy);
      ref.current.rotation.x -= delta * 0.07;
    }
    if (matRef.current) {
      matRef.current.opacity = 0.05 + sig.energy * 0.07 + sig.level * 0.12;
      matRef.current.color.copy(sig.colorRim);
    }
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.22, 2]} />
      <meshBasicMaterial ref={matRef} wireframe transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// ── Accretion disk (equatorial particle plane) ───────────────────────────

function AccretionDisk({ live }: { live: React.MutableRefObject<LiveSignal> }) {
  const pointsRef = useRef<THREE.Points>(null);
  const COUNT = 3200;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      // flat disk: radius band + thin vertical spread
      const r = 2.1 + Math.pow(Math.random(), 0.7) * 1.6;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * (0.1 + r * 0.05);
      pos[i * 3 + 2] = Math.sin(a) * r;
      seed[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uLevel: { value: 0 },
          uEnergy: { value: 0.3 },
          uColor: { value: c('#38d9f5') },
        },
        vertexShader: /* glsl */ `
          attribute float aSeed;
          uniform float uTime;
          uniform float uLevel;
          varying float vAlpha;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float tw = 0.4 + 0.6 * sin(uTime * (0.5 + aSeed * 1.5) + aSeed * 60.0);
            vAlpha = tw * (0.10 + aSeed * 0.22) * (0.7 + uLevel * 0.8);
            gl_Position = projectionMatrix * mv;
            float dist = -mv.z;
            gl_PointSize = (1.0 + aSeed * 2.2 + uLevel * 2.0) * (150.0 / dist);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vAlpha;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            float a = smoothstep(0.5, 0.0, d) * vAlpha;
            gl_FragColor = vec4(uColor * a * 1.4, a);
          }
        `,
      }),
    []
  );

  useFrame((state, delta) => {
    const sig = live.current;
    material.uniforms.uTime.value += delta;
    material.uniforms.uLevel.value = sig.level;
    material.uniforms.uEnergy.value = sig.energy;
    material.uniforms.uColor.value.copy(sig.colorRim).lerp(c('#ffffff'), 0.25);
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.045 * (0.5 + sig.energy);
    }
  });

  return (
    <group rotation={[1.32, 0, 0.12]}>
      <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}

// ── Voice Halo & Gravitational Lensing Ring ──────────────────────────────
// The native billboard ring wrapping the Sovereign Core.
// Breathes organically with live voice audio level, IIT-Φ Integrated Information,
// and cognitive thinking envelope with caustic optical deflection.

function VoiceHalo({ live }: { live: React.MutableRefObject<LiveSignal> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uLevel: { value: 0 },
          uPhi: { value: 0 },
          uThink: { value: 0 },
          uColor: { value: c('#38d9f5') },
          uColorLens: { value: c('#c084fc') },
          uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uLevel;
          uniform float uPhi;
          uniform float uThink;
          uniform float uTime;
          uniform vec3 uColor;
          uniform vec3 uColorLens;
          varying vec2 vUv;
          void main() {
            float edge = smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
            float pulse = 0.75 + 0.25 * sin(uTime * 4.5);
            // Relativistic caustic fringe & gravitational photon oscillation
            float wave = sin(atan(vUv.y - 0.5, vUv.x - 0.5) * 6.0 + uTime * 2.4);
            float caustic = 0.85 + 0.15 * wave;
            float intensity = (0.05 + uLevel * 0.5 + uPhi * 0.45 + uThink * 0.35) * edge * pulse * caustic;
            vec3 col = mix(uColor, uColorLens, clamp(uPhi * 0.75 + uThink * 0.4, 0.0, 1.0));
            gl_FragColor = vec4(col * intensity * 2.2, intensity);
          }
        `,
      }),
    []
  );

  useFrame((state, delta) => {
    const sig = live.current;
    const m = meshRef.current;
    if (!m) return;
    material.uniforms.uTime.value += delta;
    material.uniforms.uLevel.value = sig.level;
    material.uniforms.uPhi.value = sig.phiS ?? 0;
    material.uniforms.uThink.value = sig.think ?? 0;
    material.uniforms.uColor.value.copy(sig.colorRim);
    const s = 1.18 + sig.level * 0.55 + (sig.phiS ?? 0) * 0.18 + Math.sin(material.uniforms.uTime.value * 1.8) * 0.015;
    m.scale.setScalar(s);
    m.quaternion.copy(state.camera.quaternion); // billboard
  });

  return (
    <mesh ref={meshRef} material={material}>
      <ringGeometry args={[0.95, 1.03, 128]} />
    </mesh>
  );
}

// ── Thought swarm (cognitive-load accretion) ─────────────────────────────
// ~900 GPU particles on tilted orbital shells. Each has a lifecycle: spawn
// at outer radius → spiral inward → absorbed by the core → respawn. The
// infall rate and brightness are driven by live.think (thinking/working),
// so the swarm visibly "thinks" only when Cortex is actually processing.

const thoughtCount = 900;

const thoughtVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uThink;
  uniform float uPixelRatio;
  varying float vLife;   // 0 spawn → 1 absorbed
  varying float vGlow;
  void main() {
    float seed = aSeed;
    // per-particle constants derived from seed
    float orbitR   = 2.9 + seed * 2.8;                    // 2.9 .. 5.7
    float speed    = 0.10 + fract(seed * 13.7) * 0.22;    // orbit rad/s-ish
    float dir      = fract(seed * 7.31) > 0.5 ? 1.0 : -1.0;
    float band     = (fract(seed * 3.77) - 0.5) * 1.5;    // vertical band offset
    float infall   = 0.015 + fract(seed * 5.13) * 0.05;   // base drift rate

    // lifecycle: slow ambient drift when idle, fast accretion when thinking
    float rate = infall * (0.25 + uThink * 5.5);
    float life = fract(uTime * rate + seed * 11.3);
    // ease-in spiral: slow at first, accelerates toward the core
    float r = mix(orbitR, 1.12, life * life * (3.0 - 2.0 * life));

    float ang = seed * 6.2831 * 3.0 + uTime * speed * dir * (0.5 + uThink * 1.8);
    vec3 pos = vec3(
      cos(ang) * r,
      band * (0.4 + life * 1.4) + sin(uTime * 0.7 + seed * 40.0) * 0.18,
      sin(ang) * r * 0.82
    );

    vLife = life;
    vGlow = uThink * (0.25 + 0.75 * (1.0 - life)) + uThink * uThink * 0.4;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = (0.5 + fract(seed * 9.7) * 1.1) * (0.6 + life * 1.6);
    gl_PointSize = size * uPixelRatio * (46.0 / -mv.z);
  }
`;

const thoughtFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vLife;
  varying float vGlow;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.08, d) * vGlow;
    // hotter (whiter) as particles near absorption
    vec3 col = mix(uColor, vec3(1.0), vLife * vLife * 0.8);
    gl_FragColor = vec4(col * a * 1.8, a);
  }
`;

function ThoughtSwarm({ live }: { live: React.MutableRefObject<LiveSignal> }) {
  const material = useMemo(() => {
    const seeds = new Float32Array(thoughtCount);
    for (let i = 0; i < thoughtCount; i++) seeds[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(thoughtCount * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return {
      geo,
      mat: new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uThink: { value: 0 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
          uColor: { value: c('#a78bfa') },
        },
        vertexShader: thoughtVertex,
        fragmentShader: thoughtFragment,
      }),
    };
  }, []);

  useFrame((state, delta) => {
    const sig = live.current;
    material.mat.uniforms.uTime.value += delta;
    material.mat.uniforms.uPixelRatio.value = state.viewport.dpr;
    material.mat.uniforms.uThink.value = sig.think;
    material.mat.uniforms.uColor.value.copy(sig.colorRim).lerp(c('#ffffff'), 0.25);
  });

  return <points geometry={material.geo} material={material.mat} frustumCulled={false} />;
}

// ── Camera rig: intro dolly + parallax + level shake + orbit chase + chrono-dvr ───────

const CHRONO_SEG = 1.4; // seconds each replayed event holds the camera

function CameraRig({
  live,
  selectedAgentId: selectedProp,
  chronoTime,
  replayTrack,
  holoParallax = true,
  headParallax,
}: {
  live: React.MutableRefObject<LiveSignal>;
  selectedAgentId?: string | null;
  chronoTime?: number | null;
  replayTrack?: ReplayTrackEvent[] | null;
  holoParallax?: boolean;
  headParallax?: { x: number; y: number } | null;
}) {
  const { gl } = useThree();
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(selectedProp ?? null);
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const targetCamPos = useRef(new THREE.Vector3(0, 0.3, 5.6));
  const intro = useRef(0);

  // 360° Spherical orbital rotation & interactive zoom state
  const orbitState = useRef({
    isDragging: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    startTheta: 0,
    startPhi: 1.517, // ~0.3 Y elevation at 5.6 radius
    curTheta: 0,
    curPhi: 1.517,
    targetTheta: 0,
    targetPhi: 1.517,
    curRadius: 5.6,
    targetRadius: 5.6,
  });

  React.useEffect(() => {
    if (selectedProp !== undefined) {
      setSelectedAgentId(selectedProp);
    }
  }, [selectedProp]);

  React.useEffect(() => {
    const onSelect = (e: Event) => {
      const ce = e as CustomEvent<string | null>;
      setSelectedAgentId(ce.detail ?? null);
    };
    window.addEventListener('cortex-agent-select', onSelect);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedAgentId(null);
        window.dispatchEvent(new CustomEvent('cortex-agent-select', { detail: null }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('cortex-agent-select', onSelect);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  React.useEffect(() => {
    const el = gl.domElement;
    el.style.cursor = 'grab';

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const orb = orbitState.current;
      orb.isDragging = true;
      orb.hasMoved = false;
      orb.startX = e.clientX;
      orb.startY = e.clientY;
      orb.startTheta = orb.targetTheta;
      orb.startPhi = orb.targetPhi;
      el.style.cursor = 'grabbing';
    };

    const onPointerMove = (e: PointerEvent) => {
      const orb = orbitState.current;
      if (!orb.isDragging) return;
      const dx = e.clientX - orb.startX;
      const dy = e.clientY - orb.startY;
      if (!orb.hasMoved && Math.hypot(dx, dy) > 4) {
        orb.hasMoved = true;
        // Releasing agent chase if currently locked
        setSelectedAgentId(null);
        window.dispatchEvent(new CustomEvent('cortex-agent-select', { detail: null }));
      }
      if (orb.hasMoved) {
        orb.targetTheta = orb.startTheta - dx * 0.0055;
        orb.targetPhi = THREE.MathUtils.clamp(
          orb.startPhi - dy * 0.0055,
          0.15,
          Math.PI - 0.15
        );
      }
    };

    const onPointerUp = () => {
      const orb = orbitState.current;
      orb.isDragging = false;
      el.style.cursor = 'grab';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const orb = orbitState.current;
      const zoomDelta = e.deltaY * 0.004;
      orb.targetRadius = THREE.MathUtils.clamp(
        orb.targetRadius + zoomDelta,
        3.0,
        14.0
      );
    };

    const onDblClick = () => {
      const orb = orbitState.current;
      orb.targetTheta = 0;
      orb.targetPhi = 1.517;
      orb.targetRadius = 5.6;
    };

    const onReset = () => {
      onDblClick();
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dblclick', onDblClick);
    window.addEventListener('cortex-camera-reset', onReset);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dblclick', onDblClick);
      window.removeEventListener('cortex-camera-reset', onReset);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const sig = live.current;
    const { camera, pointer } = state;
    const t = state.clock.elapsedTime;
    const orb = orbitState.current;

    intro.current = Math.min(1, intro.current + delta / 2.6);
    const e = 1 - Math.pow(1 - intro.current, 3); // ease-out

    // Smooth orbital coordinate interpolation (buttery 60fps damping)
    orb.curTheta += (orb.targetTheta - orb.curTheta) * Math.min(1, delta * 6.5);
    orb.curPhi += (orb.targetPhi - orb.curPhi) * Math.min(1, delta * 6.5);
    orb.curRadius += (orb.targetRadius - orb.curRadius) * Math.min(1, delta * 6.5);

    const shake = sig.level * 0.012 + sig.energy * 0.004;
    const sx = (Math.sin(t * 41.3) + Math.sin(t * 23.7) * 0.5) * shake * 0.5;
    const sy = (Math.cos(t * 37.1) + Math.sin(t * 29.3) * 0.5) * shake * 0.5;

    // ── 1. 4D CHRONO-DVR REPLAY KINEMATICS ─────────────────────────────────
    // Event-sourced replay: when a persisted-event track is supplied, the
    // cursor walks REAL runtime events and the camera attends each event's
    // agent. Otherwise falls back to the scripted demo reel.
    if (chronoTime != null && chronoTime >= 0) {
      const ct = chronoTime;
      if (replayTrack && replayTrack.length > 0) {
        const idx = Math.min(Math.floor(ct / CHRONO_SEG), replayTrack.length - 1);
        const ev = replayTrack[idx];
        chronoNow.seq = ev.seq; chronoNow.type = ev.type; chronoNow.agentId = ev.agentId;
        const pos = ev.agentId ? agentWorldPositions[ev.agentId] : null;
        if (pos) {
          targetLookAt.current.lerp(pos, Math.min(1, delta * 3.8));
          const radial = pos.clone().normalize();
          if (radial.lengthSq() < 0.001) radial.set(0, 0, 1);
          const chasePos = pos.clone().add(radial.multiplyScalar(2.6));
          chasePos.y += 0.65 + Math.sin(t * 1.5) * 0.04;
          targetCamPos.current.lerp(chasePos, Math.min(1, delta * 3.2));
        } else {
          targetLookAt.current.lerp(tmpV.set(0, 0, 0), Math.min(1, delta * 2.4));
          targetCamPos.current.lerp(tmpV.set(0, 0.3, 5.6), Math.min(1, delta * 2.6));
        }
        camera.position.lerp(targetCamPos.current, Math.min(1, delta * 4.2));
        camera.lookAt(targetLookAt.current);
        return;
      }
      chronoNow.seq = 0; chronoNow.type = ''; chronoNow.agentId = null;
      if (ct < 2.5) {
        // Stage 1: Macro Swarm Orbit
        const p = ct / 2.5;
        const ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const angle = 0.5 + ep * 0.8;
        const dist = 5.2 - ep * 0.8;
        targetCamPos.current.set(dist * Math.sin(angle), 1.8 - ep * 0.4, dist * Math.cos(angle));
        targetLookAt.current.set(0, 0, 0);
      } else if (ct < 5.0) {
        // Stage 2: Target Lock on GovTech Scanner
        const p = (ct - 2.5) / 2.5;
        const ep = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        const scPos = agentWorldPositions['scanner'] || agentWorldPositions['librarian'] || new THREE.Vector3(2.2, 0.4, 1.2);
        targetCamPos.current.set(scPos.x + 1.4 * (1 - ep * 0.3), scPos.y + 0.65, scPos.z + 1.4 * (1 - ep * 0.3));
        targetLookAt.current.copy(scPos);
      } else if (ct < 7.2) {
        // Stage 3: Security Audit Lock on SkillSpector / Sentinel
        const p = (ct - 5.0) / 2.2;
        const ep = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        const secPos = agentWorldPositions['sentinel'] || agentWorldPositions['reviewer'] || new THREE.Vector3(-2.2, -0.3, 1.5);
        targetCamPos.current.set(secPos.x + 1.5 * Math.cos(p * 2.0), secPos.y + 0.6, secPos.z + 1.5 * Math.sin(p * 2.0));
        targetLookAt.current.copy(secPos);
      } else {
        // Stage 4: Command Convergence
        const p = (ct - 7.2) / 0.8;
        const ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        targetCamPos.current.set(4.2 + ep * 0.6, 1.6 + ep * 0.4, 3.8 + ep * 0.6);
        targetLookAt.current.set(0, 0, 0);
      }
      camera.position.lerp(targetCamPos.current, Math.min(1, delta * 4.5));
      camera.lookAt(targetLookAt.current);
      return;
    }

    // ── 2. LIVE REAL-TIME ORBIT CHASE MODE ──────────────────────────────────
    const agentWorldPos = selectedAgentId ? agentWorldPositions[selectedAgentId] : null;

    if (agentWorldPos) {
      targetLookAt.current.lerp(agentWorldPos, Math.min(1, delta * 3.8));
      const radial = agentWorldPos.clone().normalize();
      if (radial.lengthSq() < 0.001) radial.set(0, 0, 1);
      const chasePos = agentWorldPos.clone().add(radial.multiplyScalar(2.6));
      chasePos.y += 0.65 + Math.sin(t * 1.5) * 0.04;
      targetCamPos.current.lerp(chasePos, Math.min(1, delta * 3.2));
    } else {
      // ── 3. HOLOGRAPHIC WINDOW MACRO PARALLAX & 360° ORBIT ─────────────────
      targetLookAt.current.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, delta * 2.4));
      const hasHead = !orb.isDragging && !!headParallax;
      const inputX = hasHead ? headParallax.x : pointer.x;
      const inputY = hasHead ? headParallax.y : pointer.y;
      const pFactor = hasHead ? 1.35 : holoParallax ? 0.92 : 0.6;
      const tx = (orb.isDragging ? 0 : inputX * pFactor) + sx;
      const ty = (orb.isDragging ? 0 : inputY * (pFactor * 0.7)) + Math.sin(t * 0.35) * 0.06 + sy;

      const introRadius = THREE.MathUtils.lerp(8.2, orb.curRadius, e);
      const rad = introRadius - sig.level * 0.22 - sig.energy * 0.15;

      const sinPhi = Math.sin(orb.curPhi);
      const cosPhi = Math.cos(orb.curPhi);
      const sinTheta = Math.sin(orb.curTheta);
      const cosTheta = Math.cos(orb.curTheta);

      const bx = rad * sinPhi * sinTheta;
      const by = rad * cosPhi;
      const bz = rad * sinPhi * cosTheta;

      // Tangent right vector for screen-space horizontal parallax/shake
      const rightX = cosTheta;
      const rightZ = -sinTheta;

      targetCamPos.current.set(
        bx + rightX * tx,
        by + ty,
        bz + rightZ * tx
      );
    }

    camera.position.lerp(targetCamPos.current, Math.min(1, delta * 4.2));
    camera.lookAt(targetLookAt.current);

    // Subtle holographic perspective banking
    if (!agentWorldPos && (holoParallax || (headParallax && !orb.isDragging))) {
      const inputX = headParallax ? headParallax.x : pointer.x;
      camera.rotation.z += -inputX * (headParallax ? 0.055 : 0.035);
    }
  });

  return null;
}

// ── Post FX with level-reactive params & relativistic IIT-Φ warping ────

function PostFX({ live }: { live: React.MutableRefObject<LiveSignal> }) {
  const [bucket, setBucket] = React.useState(0);
  const smooth = useRef(0);
  const smoothPhi = useRef(0);
  const smoothThink = useRef(0);
  const lensing = React.useMemo(() => new LensingEffect(), []);
  const lensCenter = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    // Decay displayed level and smooth IIT-Phi and cognitive load
    smooth.current += (live.current.rawLevel - smooth.current) * Math.min(1, delta * 6);
    smoothPhi.current += ((live.current.phiS ?? 0) - smoothPhi.current) * Math.min(1, delta * 3.5);
    smoothThink.current += ((live.current.think ?? 0) - smoothThink.current) * Math.min(1, delta * 4.0);
    const b = Math.round(smooth.current * 4);
    setBucket((prev) => (prev === b ? prev : b));

    // Track the Sovereign Core's projected screen position so the lens stays
    // glued to it while the camera orbits or chases agents.
    lensCenter.current.set(0, 0, 0).project(state.camera);
    lensing.center.set((lensCenter.current.x + 1) / 2, (lensCenter.current.y + 1) / 2);
    lensing.aspect = state.size.width / Math.max(1, state.size.height);
    // Mass proxy: integrated information + cognitive load bend spacetime.
    lensing.strength = Math.min(0.012, smoothPhi.current * 0.004 + smoothThink.current * 0.003 + smooth.current * 0.002);
    lensing.updateUniforms();
  });

  const lvl = bucket / 4;
  // Relativistic spacetime warping: chromatic aberration & Einstein-radius contraction
  const phiDisp = smoothPhi.current * 0.0016 + smoothThink.current * 0.0012;
  const vigDarkness = 0.52 + lvl * 0.16 + smoothThink.current * 0.14;
  const vigOffset = Math.max(0.12, 0.28 - phiDisp * 15);

// ── Stylized gravitational lensing ──────────────────────────────────────
// A custom postprocessing effect that refracts the frame around the projected
// position of the Sovereign Core: a radial UV bend that magnifies toward the
// center, strongest when the core's live signal (phi/think) is high. This is
// a visualization of mass-bending-light, not a physical simulation.
const LENSING_FRAG = /* glsl */ `
  uniform vec2 uCenter;
  uniform float uStrength;
  uniform float uRadius;
  uniform float uAspect;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 delta = uv - uCenter;
    delta.x *= uAspect;
    float r = length(delta);
    float influence = 1.0 - smoothstep(uRadius * 0.45, uRadius, r);
    float bend = influence * influence * uStrength;
    vec2 dir = delta / max(r, 1e-4);
    vec2 offset = dir * bend;
    offset.x /= uAspect;
    outputColor = texture(inputBuffer, uv - offset);
  }
`;

class LensingEffect extends Effect {
  readonly center = new THREE.Vector2(0.5, 0.5);
  strength = 0;
  radius = 0.22;
  aspect = 1;
  private uCenter: THREE.Uniform;
  private uStrength: THREE.Uniform;
  private uRadius: THREE.Uniform;
  private uAspect: THREE.Uniform;

  constructor() {
    const uCenter = new THREE.Uniform(new THREE.Vector2(0.5, 0.5));
    const uStrength = new THREE.Uniform(0);
    const uRadius = new THREE.Uniform(0.22);
    const uAspect = new THREE.Uniform(1);
    super('LensingEffect', LENSING_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uCenter', uCenter],
        ['uStrength', uStrength],
        ['uRadius', uRadius],
        ['uAspect', uAspect],
      ]),
    });
    this.uCenter = uCenter;
    this.uStrength = uStrength;
    this.uRadius = uRadius;
    this.uAspect = uAspect;
  }

  updateUniforms() {
    (this.uCenter.value as THREE.Vector2).copy(this.center);
    this.uStrength.value = this.strength;
    this.uRadius.value = this.radius;
    this.uAspect.value = this.aspect;
  }
}

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        mipmapBlur
        intensity={0.80 + lvl * 0.55 + smoothPhi.current * 0.45}
        luminanceThreshold={Math.max(0.2, 0.42 - smoothPhi.current * 0.08)}
        luminanceSmoothing={0.25}
        radius={0.70 + smoothThink.current * 0.15}
      />
      <ChromaticAberration
        offset={[0.00035 + lvl * 0.0008 + phiDisp, 0.00035 + lvl * 0.0008 + phiDisp]}
        radialModulation
        modulationOffset={Math.max(0.1, 0.35 - smoothPhi.current * 0.12)}
      />
      <primitive object={lensing} />
      <Vignette
        eskil={false}
        offset={vigOffset}
        darkness={Math.min(0.88, vigDarkness)}
      />
    </EffectComposer>
  );
}

/** Advances the shared smoothed signal once per frame. */
function LiveTicker({ live }: { live: React.MutableRefObject<LiveSignal> }) {
  useFrame((state, delta) => {
    const sig = live.current;
    // Idle heartbeat — the core breathes even when Cortex is silent
    if (sig.state === 'idle' && sig.rawLevel < 0.05) {
      const t = state.clock.elapsedTime;
      sig.rawLevel = 0.09 + 0.045 * Math.sin(t * 0.9) + 0.03 * Math.sin(t * 2.3 + 1.7);
    }
    tickLive(sig, delta, state.clock.elapsedTime);
  });
  return null;
}

// ── Scene root ───────────────────────────────────────────────────────────

/** Fires the ignition shockwave once when the intro dolly completes. */
function Ignition({ fx }: { fx: React.MutableRefObject<{ shocks: Shock[] }> }) {
  const fired = useRef(false);
  useFrame((state) => {
    if (fired.current || state.clock.elapsedTime < 2.4) return;
    fired.current = true;
    const slot = fx.current.shocks.findIndex((s) => !s);
    fx.current.shocks[slot === -1 ? 0 : slot] = { t0: state.clock.elapsedTime };
  });
  return null;
}

function CortexCoreInner({
  fx,
  selectedAgentId,
  chronoTime,
  replayTrack,
  holoParallax,
  headParallax,
}: {
  fx: React.MutableRefObject<{ shocks: Shock[] }>;
  selectedAgentId?: string | null;
  chronoTime?: number | null;
  replayTrack?: ReplayTrackEvent[] | null;
  holoParallax?: boolean;
  headParallax?: { x: number; y: number } | null;
}) {
  const live = useRef<LiveSignal>(makeLive());

  React.useEffect(() => {
    return cortexSignalBus.subscribe((p: CortexSignalBusPayload) => {
      const prev = live.current.state;
      const prevEvent = live.current.eventSeq;
      live.current.state = p.state;
      live.current.rawLevel = p.level ?? 0;
      live.current.text = p.text ?? '';
      live.current.phi = p.phi ?? 0;
      live.current.missionProgress = p.missionProgress ?? -1;
      live.current.missionTitle = p.missionTitle ?? '';
      live.current.channel = p.channel ?? '';
      live.current.eventSeq = p.eventSeq ?? 0;
      const fired = p.state !== prev || (p.eventSeq ?? 0) !== prevEvent || p.event === 'wake';
      if (fired) {
        // State transition, wake-up event, or discrete event: energy kick + shockwave
        live.current.kick = p.event === 'wake' ? 1.8 : 1;
        const slot = fx.current.shocks.findIndex((s) => !s);
        fx.current.shocks[slot === -1 ? 0 : slot] = { t0: live.current.clockT };
      }
    });
  }, [fx]);

  return (
    <>
      <LiveTicker live={live} />
      <Ignition fx={fx} />
      <color attach="background" args={['#03040a']} />
      <Nebula live={live} />
      <StarLayer live={live} count={1400} rMin={14} rMax={30} sMin={0.7} sMax={1.8} rotSpeed={0.008} twinkle={0.8} />
      <StarLayer live={live} count={500} rMin={9} rMax={18} sMin={1.2} sMax={2.6} rotSpeed={-0.02} twinkle={1.0} />

      <group scale={0.75}>
        <Core live={live} />
        <DetailShell live={live} />
      </group>
      {RINGS.map((r, i) => (
        <OrbitRing key={i} spec={r} live={live} index={i} />
      ))}
      <Satellites live={live} />
      <ModelConstellation live={live} />
      <AccretionDisk live={live} />
      <NeuralWeb live={live} />
      <ThoughtSwarm live={live} />
      <Shockwaves fx={fx} />

      <CameraRig live={live} selectedAgentId={selectedAgentId} chronoTime={chronoTime} replayTrack={replayTrack} holoParallax={holoParallax} headParallax={headParallax} />
      <PostFX live={live} />
    </>
  );
}

function SceneWithInput({
  selectedAgentId,
  onSelectAgent,
  chronoTime,
  replayTrack,
  holoParallax,
  headParallax,
}: {
  selectedAgentId?: string | null;
  onSelectAgent?: (id: string | null) => void;
  chronoTime?: number | null;
  replayTrack?: ReplayTrackEvent[] | null;
  holoParallax?: boolean;
  headParallax?: { x: number; y: number } | null;
}) {
  const fx = useRef<{ shocks: Shock[] }>({ shocks: [] });
  const { gl, clock } = useThree();

  React.useEffect(() => {
    const el = gl.domElement;
    const onDown = () => {
      const slot = fx.current.shocks.findIndex((s) => !s);
      const idx = slot === -1 ? 0 : slot;
      // Same timebase as state.clock.elapsedTime inside useFrame
      fx.current.shocks[idx] = { t0: clock.elapsedTime };
    };
    el.addEventListener('pointerdown', onDown);
    return () => el.removeEventListener('pointerdown', onDown);
  }, [gl, clock]);

  return <CortexCoreInner fx={fx} selectedAgentId={selectedAgentId} chronoTime={chronoTime} replayTrack={replayTrack} holoParallax={holoParallax} headParallax={headParallax} />;
}

// Under prefers-reduced-motion the Canvas renders on demand: ambient
// animation stops, but every signal-bus publish still triggers a frame so
// state colors/labels stay truthful.
const InvalidateBridge: React.FC = () => {
  const invalidate = useThree((s) => s.invalidate);
  React.useEffect(() => {
    invalidate();
    return cortexSignalBus.subscribe(() => invalidate());
  }, [invalidate]);
  return null;
};

export interface CortexCoreSceneProps {
  selectedAgentId?: string | null;
  onSelectAgent?: (id: string | null) => void;
  chronoTime?: number | null;
  replayTrack?: ReplayTrackEvent[] | null;
  holoParallax?: boolean;
  headParallax?: { x: number; y: number } | null;
}

export const CortexCoreScene: React.FC<CortexCoreSceneProps> = ({
  selectedAgentId,
  onSelectAgent,
  chronoTime,
  replayTrack,
  holoParallax = true,
  headParallax,
}) => {
  const [reduced, setReduced] = React.useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [dpr, setDpr] = React.useState<number | [number, number]>(() => (reduced ? 1 : [1, 1.25]));
  const [contextLost, setContextLost] = React.useState(false);
  const [restoreCount, setRestoreCount] = React.useState(0);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = () => {
      setReduced(mq.matches);
      if (mq.matches) setDpr(1);
    };
    mq.addEventListener('change', onMq);
    return () => mq.removeEventListener('change', onMq);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Canvas
        key={restoreCount}
        frameloop={reduced || contextLost ? 'demand' : 'always'}
        dpr={dpr}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0.3, 8.2], fov: 42, near: 0.1, far: 120 }}
        style={{ position: 'absolute', inset: 0 }}
        onCreated={({ gl }) => {
          const domCanvas = gl.domElement;
          const onLost = (e: Event) => {
            e.preventDefault(); // Informs browser WebGL runtime that application handles recovery
            setContextLost(true);
            console.warn('[CortexCoreScene] WebGL context lost. Standing by for GPU restoration...');
            cortexSignalBus.emit('webgl:contextlost', 'GPU context suspended');
          };
          const onRestored = () => {
            setContextLost(false);
            setRestoreCount((c) => c + 1);
            console.info('[CortexCoreScene] WebGL context restored. Re-synchronizing neural core...');
            cortexSignalBus.emit('webgl:contextrestored', 'GPU context restored');
          };
          domCanvas.addEventListener('webglcontextlost', onLost, false);
          domCanvas.addEventListener('webglcontextrestored', onRestored, false);
        }}
      >
        {!reduced && (
          <PerformanceMonitor
            ms={250}
            iterations={8}
            threshold={0.85}
            onDecline={() => {
              // Adaptive GPU budget governor: throttle DPR down to 1.0 on low-power / integrated GPUs
              setDpr(1);
            }}
            onIncline={() => {
              // Performance recovered: restore crisp 1.25 DPR ceiling
              setDpr([1, 1.25]);
            }}
          />
        )}
        <SceneWithInput selectedAgentId={selectedAgentId} onSelectAgent={onSelectAgent} chronoTime={chronoTime} replayTrack={replayTrack} holoParallax={holoParallax} headParallax={headParallax} />
        {reduced && <InvalidateBridge />}
      </Canvas>
      {contextLost && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: 'rgba(3,4,10,0.94)',
          color: '#67e8f9', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10,
          letterSpacing: '0.24em', zIndex: 50, pointerEvents: 'none',
        }}>
          <div>◌ GPU CONTEXT RECOVERING</div>
          <div style={{ fontSize: 8, color: 'rgba(148,233,255,0.4)', marginTop: 4 }}>
            STANDBY · RE-INITIALIZING SHADERS
          </div>
        </div>
      )}
    </div>
  );
};
