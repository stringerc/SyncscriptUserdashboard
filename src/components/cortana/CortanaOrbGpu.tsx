/**
 * CortanaOrbGpu — WebGPU/TSL spike for the Cortana orb.
 *
 * Renders the same mood-reactive particle ring as CortanaOrb.tsx, but on
 * three.js WebGPURenderer + TSL node materials instead of raw GLSL:
 *   · displaced fresnel core sphere (positionNode + mx_fractal_noise)
 *   · 1,200 billboarded instanced motes on the torus tube (WebGPU points are
 *     1px-only, so particles are instanced quads billboarded in the vertex stage)
 *   · shader-side ring spin/tilt, twinkle, traveling pulse — all node graph
 *
 * Falls back via onUnsupported() when WebGPU is unavailable or init fails;
 * CortanaLive then mounts the classic R3F orb instead.
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three/webgpu';
import { WebGPURenderer } from 'three/webgpu';
import {
  vec2,
  vec3,
  float,
  uniform,
  uv,
  positionGeometry,
  normalGeometry,
  positionWorld,
  normalWorld,
  cameraPosition,
  mix,
  smoothstep,
  sin,
  cos,
  pow,
  dot,
  normalize,
  distance,
  clamp,
  fract,
  exp,
  mx_fractal_noise_float,
  instancedBufferAttribute,
} from 'three/tsl';
import { MOOD_STATES } from './CortanaOrb';

const PARTICLE_COUNT = 1200;
const RING_RADIUS = 1.4;
const TUBE_RADIUS = 0.45;

interface MoodParams {
  color1: THREE.Color;
  color2: THREE.Color;
  expand: number;
  spread: number;
  noiseAmp: number;
  speed: number;
  brightness: number;
  opacity: number;
}

function makeTargets(mood: string) {
  const s = MOOD_STATES[mood] || MOOD_STATES.idle;
  return {
    color1: new THREE.Color(s.color1),
    color2: new THREE.Color(s.color2),
    expand: s.expand,
    spread: s.spread,
    noiseAmp: s.noiseAmp,
    speed: s.speed,
    brightness: s.brightness,
    opacity: s.opacity,
  };
}

export function CortanaOrbGpu({
  mood,
  onUnsupported,
}: {
  mood: string;
  onUnsupported?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const unsupportedRef = useRef(onUnsupported);
  unsupportedRef.current = onUnsupported;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let renderer: WebGPURenderer | null = null;
    const ro = new ResizeObserver(() => {
      // resize() is recreated per boot; the observer only needs to trigger it
      resizeRef.current?.();
    });
    const resizeRef = { current: null as null | (() => void) };

    const boot = async () => {
      if (!('gpu' in navigator)) {
        unsupportedRef.current?.();
        return;
      }
      try {
        renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true });
        await renderer.init();
        if (disposed) {
          renderer.dispose();
          return;
        }
      } catch (err) {
        console.warn('[CortanaOrbGpu] WebGPU init failed, falling back to WebGL:', err);
        unsupportedRef.current?.();
        return;
      }

      // ── Scene ──────────────────────────────────────────────────────
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 0, 5);

      // ── Shared uniforms ────────────────────────────────────────────
      const uTime = uniform(0);
      const uColor1 = uniform(new THREE.Vector3());
      const uColor2 = uniform(new THREE.Vector3());
      const uDeep = uniform(new THREE.Vector3());
      const uExpand = uniform(1);
      const uSpread = uniform(0);
      const uNoiseAmp = uniform(0.6);
      const uSpeed = uniform(0.7);
      const uBrightness = uniform(1.3);
      const uOpacity = uniform(0.9);
      const uSpin = uniform(0);
      const uTilt = uniform(Math.PI * 0.08);
      const uCamRight = uniform(new THREE.Vector3(1, 0, 0));
      const uCamUp = uniform(new THREE.Vector3(0, 1, 0));
      const uPxScale = uniform(0.001); // world units per CSS px at distance 1

      // ── Core sphere: displaced fresnel nebula ──────────────────────
      const coreMat = new THREE.MeshBasicNodeMaterial();
      coreMat.transparent = true;
      coreMat.depthWrite = false;
      coreMat.blending = THREE.AdditiveBlending;

      const nrm = normalGeometry;
      const nse = mx_fractal_noise_float(
        positionGeometry.mul(1.7).add(vec3(uTime.mul(0.12))),
        4,
        2.0,
        0.5
      );
      const disp = nse.sub(0.5).mul(uNoiseAmp.mul(0.28));
      coreMat.positionNode = positionGeometry.add(nrm.mul(disp));

      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const fres = pow(clamp(float(1).sub(dot(normalWorld, viewDir)), 0, 1), 2.2);
      const bands = sin(positionWorld.y.mul(6).add(uTime.mul(1.6)))
        .mul(0.5)
        .add(0.5);
      coreMat.colorNode = mix(uDeep, uColor1, fres)
        .add(uColor1.mul(bands.mul(0.18)))
        .mul(uBrightness.mul(0.6).add(0.4));
      coreMat.opacityNode = float(0.9).mul(uOpacity);

      const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 96, 96), coreMat);
      scene.add(core);

      // ── Particle ring: instanced billboarded quads ────────────────
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const seeds = new Float32Array(PARTICLE_COUNT);
      const sizes = new Float32Array(PARTICLE_COUNT);
      const angles = new Float32Array(PARTICLE_COUNT);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 2;
        const tubeR = TUBE_RADIUS * (0.3 + Math.random() * 0.7);
        positions[i * 3] = (RING_RADIUS + tubeR * Math.cos(phi)) * Math.cos(theta);
        positions[i * 3 + 1] = (RING_RADIUS + tubeR * Math.cos(phi)) * Math.sin(theta);
        positions[i * 3 + 2] = tubeR * Math.sin(phi);
        seeds[i] = Math.random();
        sizes[i] = 2.0 + Math.random() * 3.5;
        angles[i] = theta;
      }

      const iPos = new THREE.InstancedBufferAttribute(positions, 3);
      const iSeed = new THREE.InstancedBufferAttribute(seeds, 1);
      const iSize = new THREE.InstancedBufferAttribute(sizes, 1);
      const iAngle = new THREE.InstancedBufferAttribute(angles, 1);

      const moteMat = new THREE.MeshBasicNodeMaterial();
      moteMat.transparent = true;
      moteMat.depthWrite = false;
      moteMat.blending = THREE.AdditiveBlending;
      moteMat.side = THREE.DoubleSide;

      const iPosN = instancedBufferAttribute<"vec3">(iPos, 'vec3');
      const iSeedN = instancedBufferAttribute<"float">(iSeed, 'float');
      const iSizeN = instancedBufferAttribute<"float">(iSize, 'float');
      const iAngleN = instancedBufferAttribute<"float">(iAngle, 'float');

      // ring spin + static tilt, evaluated per-mote in the vertex stage
      const cs = cos(uSpin);
      const sn = sin(uSpin);
      const spun = vec3(
        iPosN.x.mul(cs).sub(iPosN.y.mul(sn)),
        iPosN.x.mul(sn).add(iPosN.y.mul(cs)),
        iPosN.z
      );
      const ct = cos(uTilt);
      const st = sin(uTilt);
      const ringPos = vec3(
        spun.x.mul(uExpand),
        spun.y.mul(ct).sub(spun.z.mul(st)).mul(uExpand),
        spun.y.mul(st).add(spun.z.mul(ct)).mul(uExpand)
      );

      // gentle noise wobble along the mote's radial direction
      const wob = mx_fractal_noise_float(
        ringPos.mul(1.3).add(vec3(uTime.mul(0.1))),
        3,
        2.0,
        0.5
      ).sub(0.5);
      const wobble = wob.mul(uNoiseAmp.mul(0.12).add(uSpread.mul(0.35)));
      const center = normalize(ringPos.add(vec3(0.001)));

      // billboard: corner offsets ride camera right/up, scaled to world size
      const corner = positionGeometry.xy;
      const dist = distance(cameraPosition, ringPos);
      const size = iSizeN.mul(uPxScale).mul(dist).mul(float(1).add(wobble.abs()));
      const worldPos = ringPos
        .add(center.mul(wobble))
        .add(uCamRight.mul(corner.x).mul(size))
        .add(uCamUp.mul(corner.y).mul(size));
      moteMat.positionNode = worldPos;

      // fragment: sharp core + thin halo, traveling pulse, mood color blend
      const d = distance(uv(), vec2(0.5));
      const coreA = smoothstep(float(0.12), float(0.0), d);
      const haloA = exp(d.mul(-18)).mul(0.2);
      const twinkle = sin(
        uTime.mul(uSpeed).add(iSeedN.mul(40)).add(iAngleN)
      ).mul(0.25).add(0.75);
      const travel = fract(iAngleN.div(6.2831).add(uTime.mul(0.03)));
      const pulse = sin(travel.mul(6.2831).mul(3).add(uTime.mul(0.5)))
        .mul(0.2).add(0.8);
      const shimmer = mix(
        pulse,
        pulse.mul(float(1).add(sin(travel.mul(6.2831).mul(5).sub(uTime.mul(2))).mul(0.35))),
        clamp(uBrightness.sub(1), 0, 1)
      );
      const alpha = coreA.mul(0.9).add(haloA)
        .mul(float(0.15).add(iSeedN.mul(0.35)))
        .mul(twinkle).mul(shimmer).mul(uOpacity);
      const mixAmt = fract(iAngleN.div(6.2831).add(iSeedN.mul(0.3)));
      const pColor = mix(uColor1, uColor2, mixAmt);
      const litColor = mix(pColor, vec3(1), coreA.mul(0.3).mul(uBrightness));
      moteMat.colorNode = litColor.mul(uBrightness.mul(0.7).add(0.3));
      moteMat.opacityNode = alpha;

      if (!renderer) return;
      const r = renderer;

      // build instanced geometry from a unit quad
      const quad = new THREE.PlaneGeometry(1, 1);
      const igeo = new THREE.InstancedBufferGeometry();
      igeo.index = quad.index;
      igeo.setAttribute('position', quad.getAttribute('position'));
      igeo.setAttribute('uv', quad.getAttribute('uv'));
      igeo.instanceCount = PARTICLE_COUNT;
      igeo.setAttribute('iPos', iPos);
      igeo.setAttribute('iSeed', iSeed);
      igeo.setAttribute('iSize', iSize);
      igeo.setAttribute('iAngle', iAngle);
      quad.dispose();
      const motes = new THREE.Mesh(igeo, moteMat);
      scene.add(motes);

      // ── Mood state + animation loop ────────────────────────────────
      const target = makeTargets(moodRef.current);
      const cur: MoodParams = {
        color1: target.color1.clone(),
        color2: target.color2.clone(),
        expand: target.expand,
        spread: target.spread,
        noiseAmp: target.noiseAmp,
        speed: target.speed,
        brightness: target.brightness,
        opacity: target.opacity,
      };

      const resize = () => {
        const parent = canvas.parentElement;
        const w = parent?.clientWidth ?? window.innerWidth;
        const h = parent?.clientHeight ?? window.innerHeight;
        const pr = Math.min(window.devicePixelRatio, 2);
        r.setPixelRatio(pr);
        r.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        // world units per device pixel at distance 1 (perspective)
        uPxScale.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / (h * pr);
      };
      resizeRef.current = resize;
      resize();
      if (canvas.parentElement) ro.observe(canvas.parentElement);

      const timer = new THREE.Timer();

      let t = 0;
      r.setAnimationLoop(() => {
        timer.update();
        const delta = Math.min(timer.getDelta(), 0.1);
        t += delta;
        const m = moodRef.current;
        const s = MOOD_STATES[m] || MOOD_STATES.idle;
        target.color1.set(s.color1);
        target.color2.set(s.color2);
        target.expand = s.expand;
        target.spread = s.spread;
        target.noiseAmp = s.noiseAmp;
        target.speed = s.speed;
        target.brightness = s.brightness;
        target.opacity = s.opacity;

        // same wave/shimmer + asymmetric lerp model as the WebGL orb
        const isSpeaking = m === 'speaking';
        const isListening = m === 'listening';
        const isActive = isSpeaking || isListening;
        const w1 = isActive ? Math.sin(t * (isSpeaking ? 1.8 : 0.8)) * 0.5 + 0.5 : 0;
        const w2 = isActive ? Math.sin(t * (isSpeaking ? 3.5 : 1.5) + 1.0) * 0.5 + 0.5 : 0;
        const w3 = isActive ? Math.max(0, Math.sin(t * (isSpeaking ? 6.0 : 2.5) + 2.0)) : 0;
        const effExpand = target.expand + (isActive ? w1 * (isSpeaking ? 0.8 : 0.15) + w3 * (isSpeaking ? 0.5 : 0.05) : 0);
        const effSpread = Math.max(0, target.spread + (isActive ? w1 * (isSpeaking ? 0.5 : 0.06) + w2 * (isSpeaking ? 0.15 : 0.02) : 0));
        const effNoise = target.noiseAmp + (isActive ? w3 * (isSpeaking ? 2.0 : 0.3) + w1 * (isSpeaking ? 0.6 : 0.1) : 0);
        const effSpeed = target.speed + (isActive ? w2 * (isSpeaking ? 1.5 : 0.3) + w3 * (isSpeaking ? 0.8 : 0.1) : 0);
        const effBright = target.brightness + (isActive ? w2 * (isSpeaking ? 1.2 : 0.2) + w3 * (isSpeaking ? 0.6 : 0.05) : 0);

        const lerpIn = isActive ? 0.15 : 0.04;
        const lerpOther = isActive ? 0.15 : 0.06;
        cur.color1.lerp(target.color1, lerpOther);
        cur.color2.lerp(target.color2, lerpOther);
        cur.expand += (effExpand - cur.expand) * lerpIn;
        cur.spread += (effSpread - cur.spread) * lerpIn;
        cur.noiseAmp += (effNoise - cur.noiseAmp) * lerpOther;
        cur.speed += (effSpeed - cur.speed) * lerpOther;
        cur.brightness += (effBright - cur.brightness) * lerpOther;
        cur.opacity += (target.opacity - cur.opacity) * lerpOther;

        uTime.value = t;
        uColor1.value.set(cur.color1.r, cur.color1.g, cur.color1.b);
        uColor2.value.set(cur.color2.r, cur.color2.g, cur.color2.b);
        uDeep.value.set(cur.color2.r * 0.12, cur.color2.g * 0.12, cur.color2.b * 0.12);
        uExpand.value = cur.expand;
        uSpread.value = cur.spread;
        uNoiseAmp.value = cur.noiseAmp;
        uSpeed.value = cur.speed;
        uBrightness.value = cur.brightness;
        uOpacity.value = cur.opacity;
        uSpin.value = t * 0.06;
        uTilt.value = Math.PI * 0.08 + Math.sin(t * 0.3) * 0.03;

        // billboard basis from camera world matrix
        camera.updateMatrixWorld();
        uCamRight.value.setFromMatrixColumn(camera.matrixWorld, 0);
        uCamUp.value.setFromMatrixColumn(camera.matrixWorld, 1);

        r.render(scene, camera);
      });

      // expose for debugging
      (canvas as HTMLCanvasElement & { __cortanaGpu?: unknown }).__cortanaGpu = {
        renderer,
        scene,
        camera,
      };
    };

    void boot();

    return () => {
      disposed = true;
      ro.disconnect();
      resizeRef.current = null;
      renderer?.setAnimationLoop(null);
      renderer?.dispose();
      renderer = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
}

export default CortanaOrbGpu;
