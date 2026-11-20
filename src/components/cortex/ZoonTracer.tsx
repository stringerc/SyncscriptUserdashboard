/**
 * ZoonTracer — velocity-streak particle layer inspired by the zoon_works
 * TouchDesigner motion-blur study: near-white motes on black leaving long
 * directional trails, with periodic radial bursts.
 *
 * Each particle is an instanced camera-facing streak quad whose long axis is
 * aligned to its screen-space velocity and whose alpha fades tail→head.
 * One draw call, CPU-integrated physics, additive blending.
 *
 * Kill switch: localStorage.cortexZoon === 'off'
 */

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { LiveSignal } from './CortexCoreScene';

const MAX = 3200;

const vertexShader = /* glsl */ `
  attribute vec3 iPos;
  attribute vec3 iVel;
  attribute float iLife;   // 0..1 remaining
  attribute float iSeed;
  attribute vec2 aCorner;  // x: -1..1 across, y: -1..1 along (head=+1)

  uniform float uTime;
  uniform float uStretch;  // world units of trail per unit speed
  uniform float uWidth;
  uniform float uEnergy;

  varying float vAlong;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec4 head = projectionMatrix * viewMatrix * vec4(iPos, 1.0);
    vAlong = 0.0;
    vAlpha = 0.0;
    vSeed = iSeed;
    if (head.w <= 0.0) {
      // Behind camera — collapse to a degenerate off-screen point.
      gl_Position = vec4(0.0, 0.0, -10.0, 1.0);
      return;
    }
    float speed = length(iVel);
    // Trail extends backwards along velocity; clamp so slow motes don't smear.
    vec3 tailWorld = iPos - iVel * uStretch * min(speed, 6.0) * (0.35 + 0.65 * iSeed);
    vec4 tail = projectionMatrix * viewMatrix * vec4(tailWorld, 1.0);

    vec2 dir = tail.xy / max(tail.w, 1e-4) - head.xy / max(head.w, 1e-4);
    float dl = length(dir);
    dir = dl > 1e-5 ? dir / dl : vec2(0.0, 1.0);
    vec2 perp = vec2(-dir.y, dir.x);

    // Length in NDC ~ proportional to screen-space streak; clamp for stability.
    float lenNdc = clamp(dl * 2.0, 0.004, 0.35);
    float widNdc = uWidth * (0.5 + 0.8 * iSeed) * (1.0 + uEnergy * 0.4);

    vec2 offset = dir * aCorner.y * lenNdc + perp * aCorner.x * widNdc;
    vec4 clip = head;
    clip.xy += offset * head.w;
    gl_Position = clip;

    vAlong = aCorner.y * 0.5 + 0.5;          // 1 at head, 0 at tail
    // Life envelope: quick attack, long decay; extra shimmer on seed.
    float env = smoothstep(0.0, 0.12, iLife) * (0.25 + 0.75 * iLife);
    vAlpha = env * (0.55 + 0.45 * sin(uTime * (2.0 + iSeed * 5.0) + iSeed * 40.0));
    vSeed = iSeed;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uHead;
  uniform vec3 uTail;
  uniform float uOpacity;
  varying float vAlong;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    // Soft edge across the streak, hot head fading into the tail.
    float across = 1.0 - abs(vAlong - 0.5) * 2.0;
    float a = vAlpha * uOpacity * pow(max(across, 0.0), 1.6);
    // Head carries the energy colour, tail cools toward deep cyan-grey.
    vec3 col = mix(uTail, uHead, pow(vAlong, 2.2));
    gl_FragColor = vec4(col * a, a);
  }
`;

interface P {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;   // 0..1
  lifeMax: number;
  size: number;
  seed: number;
  alive: boolean;
}

export function ZoonTracer({
  live,
  count = MAX,
}: {
  live: React.MutableRefObject<LiveSignal>;
  count?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const particles = useRef<P[]>([]);
  const burstTimer = useRef(2.5);

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.InstancedBufferGeometry();
    // Base quad: two triangles, 4 corners.
    const pos = new Float32Array([
      -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0,
      -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
    ]);
    const corner = new Float32Array([
      -1, -1, 1, -1, 1, 1,
      -1, -1, 1, 1, 1, -1, 1,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    geo.instanceCount = count;

    const iPos = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    const iVel = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    const iLife = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    const iSeed = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    iPos.setUsage(THREE.DynamicDrawUsage);
    iVel.setUsage(THREE.DynamicDrawUsage);
    iLife.setUsage(THREE.DynamicDrawUsage);
    iSeed.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', iPos);
    geo.setAttribute('iVel', iVel);
    geo.setAttribute('iLife', iLife);
    geo.setAttribute('iSeed', iSeed);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uStretch: { value: 0.16 },
        uWidth: { value: 0.012 },
        uOpacity: { value: 0.85 },
        uEnergy: { value: 0.3 },
        uHead: { value: new THREE.Color('#f4f8ff') },
        uTail: { value: new THREE.Color('#0e7490') },
      },
      vertexShader,
      fragmentShader,
    });
    return { geometry: geo, material: mat };
  }, [count]);

  // Particle pool init — deterministic-ish seeds, ambient shell distribution.
  React.useEffect(() => {
    const arr: P[] = [];
    for (let i = 0; i < count; i++) {
      const seed = Math.random();
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 5 + Math.random() * 11;
      arr.push({
        pos: new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta) * 0.7,
          r * Math.cos(phi) * 0.8 - 2,
        ),
        vel: new THREE.Vector3(),
        life: 1,
        lifeMax: 2.5 + Math.random() * 5,
        size: 0.5 + Math.random(),
        seed,
        alive: false,
      });
      // scatter initial lives so the field fades in organically
      arr[i].life = Math.random();
    }
    particles.current = arr;
    // Seed attribute is static — write once.
    const iSeedAttr = geometry.getAttribute('iSeed') as THREE.InstancedBufferAttribute;
    for (let i = 0; i < count; i++) iSeedAttr.setX(i, arr[i].seed);
    iSeedAttr.needsUpdate = true;
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [count, geometry, material]);

  const spawnAmbient = (p: P) => {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 5 + Math.random() * 11;
    p.pos.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.7,
      r * Math.cos(phi) * 0.8 - 2,
    );
    // Slow drift + slight inward pull — long lazy streaks.
    p.vel.set(
      (Math.random() - 0.5) * 1.6,
      (Math.random() - 0.5) * 1.2,
      (Math.random() - 0.5) * 1.6,
    );
    p.lifeMax = 3 + Math.random() * 6;
    p.life = 1;
    p.alive = true;
  };

  const spawnBurst = (cx: number, cy: number, cz: number, energy: number) => {
    // Radial burst — the video's signature "detonation" moments.
    const n = Math.floor(90 + energy * 220);
    let spawned = 0;
    for (const p of particles.current) {
      if (spawned >= n) break;
      if (p.alive && p.life > p.lifeMax * 0.5) continue;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = (2.5 + Math.random() * 7) * (0.6 + energy * 0.8);
      p.pos.set(cx + (Math.random() - 0.5) * 0.6, cy + (Math.random() - 0.5) * 0.6, cz + (Math.random() - 0.5) * 0.6);
      p.vel.set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed * 0.8,
        Math.cos(phi) * speed * 0.7,
      );
      p.lifeMax = 0.9 + Math.random() * 2.4;
      p.life = 1;
      p.alive = true;
      spawned++;
    }
  };

  useFrame((state, delta) => {
    const sig = live.current;
    const dt = Math.min(delta, 0.05);
    const geo = geometry;
    const iPos = geo.getAttribute('iPos') as THREE.InstancedBufferAttribute;
    const iVel = geo.getAttribute('iVel') as THREE.InstancedBufferAttribute;
    const iLife = geo.getAttribute('iLife') as THREE.InstancedBufferAttribute;
    const iSeed = geo.getAttribute('iSeed') as THREE.InstancedBufferAttribute;
    const arr = particles.current;
    if (!arr.length) return;

    // Periodic bursts + energy/kick-reactive bursts (voice events = detonations).
    burstTimer.current -= dt;
    const kick = sig.kick + sig.ingest;
    if (burstTimer.current <= 0 || kick > 0.9) {
      const energy = Math.min(1, 0.25 + sig.energy * 0.5 + kick * 0.6);
      // Burst from a random point in the core region — not always dead centre.
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * 4;
      spawnBurst(Math.cos(a) * rr, (Math.random() - 0.5) * 3, Math.sin(a) * rr - 2, energy);
      burstTimer.current = kick > 0.9 ? 0.4 : 5 + Math.random() * 7;
    }

    const drag = Math.exp(-0.55 * dt);
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (!p.alive) {
        // Trickle ambient respawns to keep the field alive.
        if (Math.random() < dt * 14) spawnAmbient(p);
        else { iLife.setX(i, 0); continue; }
      }
      p.life -= dt / p.lifeMax;
      if (p.life <= 0) { p.alive = false; iLife.setX(i, 0); continue; }
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(drag);
      // Gentle containment — keep motes in the observable shell.
      const d2 = p.pos.lengthSq();
      if (d2 > 420) {
        p.vel.multiplyScalar(-0.4);
        p.pos.multiplyScalar(0.98);
      }
      iPos.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
      iVel.setXYZ(i, p.vel.x, p.vel.y, p.vel.z);
      iLife.setX(i, Math.max(0, Math.min(1, p.life)));
    }
    iPos.needsUpdate = true;
    iVel.needsUpdate = true;
    iLife.needsUpdate = true;

    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uEnergy.value = Math.min(1, sig.energy + sig.kick * 0.5);
    material.uniforms.uOpacity.value = 0.55 + sig.energy * 0.4;
    material.uniforms.uHead.value.copy(sig.colorRim).lerp(new THREE.Color('#ffffff'), 0.55);
    material.uniforms.uTail.value.copy(sig.colorDeep).lerp(new THREE.Color('#155e75'), 0.5);
  });

  if (typeof window !== 'undefined' && window.localStorage?.getItem('cortexZoon') === 'off') {
    return null;
  }

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={20} />
  );
}
