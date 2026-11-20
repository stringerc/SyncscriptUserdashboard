/**
 * CortexSplatScene — Gaussian-splat viewer for /cortex?splat=1.
 *
 * Renders .ply/.splat/.ply assets through @sparkjsdev/spark (SparkRenderer
 * discovers SplatMesh objects in the scene and draws them each frame).
 * Drop any trained splat into public/splats/ and pass ?splat=<name> — the
 * default is the procedural cortex-core.ply from scripts/gen-demo-splat.py.
 *
 * Hero mode (cortex-core): core + counter-rotating ring meshes, breathing
 * scale, GPU spore layers with gust events (auto ~26s + click to trigger),
 * zoom-through-the-core camera, Bloom/ChromaticAberration/Vignette,
 * pointer parallax.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { SparkRenderer, SplatMesh, generators } from '@sparkjsdev/spark';
import { createFlowModifier, pointerToSphere, type FlowUniforms } from '../../lib/cortex-splat-flow';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const GUST_PERIOD = 26; // seconds between auto gusts

function SparkStage({ url, onReady, onFail, onGust }: {
  url: string;
  onReady: () => void;
  onFail: () => void;
  onGust?: (active: boolean) => void;
}) {
  const { gl, scene, invalidate, pointer } = useThree();
  const holder = useRef<THREE.Group | null>(null);
  const ambient = useRef<{ snow: any; fallVelocity: any; wanderScale: any; opacity: any }[]>([]);
  const meshes = useRef<{ mesh: SplatMesh; role: 'core' | 'ring' | 'asset' }[]>([]);
  const flowRef = useRef<FlowUniforms | null>(null);
  const mouseTarget = useRef(new THREE.Vector3(0, 0, 5));
  const cursorActive = useRef(false);
  const lastMoveAt = useRef(-999);
  const manualGustAt = useRef(-999);
  const gustWas = useRef(false);
  const clockRef = useRef<THREE.Clock | null>(null);

  useEffect(() => {
    const g = new THREE.Group();
    scene.add(g);
    holder.current = g;
    const spark = new SparkRenderer({ renderer: gl, onDirty: () => invalidate() });
    g.add(spark);

    // Living ambient field — GPU-animated spore layers (dandelion seeds
    // blown through the core). snowBox wraps positions in a box and
    // perturbs them with sin-noise; uniforms stay live for gusts.
    const box = new THREE.Box3(new THREE.Vector3(-3.4, -2.4, -3.4), new THREE.Vector3(3.4, 2.4, 3.4));
    const mk = (opts: Parameters<typeof generators.snowBox>[0]) => {
      const r = generators.snowBox(opts);
      g.add(r.snow);
      ambient.current.push(r as any);
      return r;
    };
    // Spores — large slow seeds, ice<->amber, strong wander
    mk({
      box, numSplats: 12000,
      fallDirection: new THREE.Vector3(0.22, -1, 0.12).normalize(),
      fallVelocity: 0.03, wanderScale: 0.32, wanderVariance: 3.2,
      anisoScale: new THREE.Vector3(1, 1.7, 1),
      minScale: 0.005, maxScale: 0.014,
      color1: new THREE.Color(0.55, 0.85, 1.0), color2: new THREE.Color(1.0, 0.72, 0.4),
      opacity: 0.55,
    });
    // Motes — fine far dust, dim blue-white
    mk({
      box, numSplats: 14000,
      fallDirection: new THREE.Vector3(-0.1, -1, 0.25).normalize(),
      fallVelocity: 0.014, wanderScale: 0.1, wanderVariance: 4,
      minScale: 0.0018, maxScale: 0.005,
      color1: new THREE.Color(0.5, 0.75, 1.0), color2: new THREE.Color(0.85, 0.9, 1.0),
      opacity: 0.35,
    });
    // Embers — warm sparks rising against the fall
    mk({
      box, numSplats: 4000,
      fallDirection: new THREE.Vector3(0.08, 1, -0.04).normalize(),
      fallVelocity: 0.045, wanderScale: 0.22, wanderVariance: 2.5,
      minScale: 0.003, maxScale: 0.009,
      color1: new THREE.Color(1.0, 0.55, 0.2), color2: new THREE.Color(1.0, 0.9, 0.6),
      opacity: 0.7,
    });

    // GPU flow field — ambient liquid motion + cursor parting, shared
    // across meshes so the whole field moves coherently.
    const flow = createFlowModifier();
    flowRef.current = flow.uniforms;

    // Splat meshes — cortex-core gets a counter-rotating ring sibling.
    const isHero = url.includes('cortex-core');
    const urls: { url: string; role: 'core' | 'ring' | 'asset' }[] = isHero
      ? [{ url, role: 'core' }, { url: '/splats/cortex-ring.ply', role: 'ring' }]
      : [{ url, role: 'asset' }];

    let pending = urls.length;
    let cancelled = false;
    for (const { url: u, role } of urls) {
      const mesh = new SplatMesh({ url: u, worldModifier: flow.modifier });
      g.add(mesh);
      meshes.current.push({ mesh, role });
      mesh.initialized.then(() => {
        if (cancelled) return;
        try {
          const ps: any = (mesh as any).packedSplats;
          const bb: any = (mesh as any).geometry?.boundingSphere;
          console.log('[splat] initialized', role, {
            numSplats: ps?.numSplats ?? ps?.splats?.length,
            hasExt: !!(mesh as any).extSplats,
            boundingSphere: bb ? { c: bb.center.toArray(), r: bb.radius } : null,
          });
        } catch (e) { console.log('[splat] init-log-fail', e); }
        if (--pending === 0) onReady();
      }).catch((e) => {
        if (cancelled) return;
        console.log('[splat] init FAILED', role, e);
        onFail();
      });
    }

    // Click anywhere on the canvas triggers a manual gust; pointer
    // activity arms the flow field's cursor interaction.
    const onDown = () => {
      const et = clockRef.current?.elapsedTime;
      if (et != null) manualGustAt.current = et;
    };
    const onMove = () => {
      const et = clockRef.current?.elapsedTime;
      if (et != null) { cursorActive.current = true; lastMoveAt.current = et; }
    };
    const onEnter = () => { cursorActive.current = true; };
    const onLeave = () => { cursorActive.current = false; };
    gl.domElement.addEventListener('pointerdown', onDown);
    gl.domElement.addEventListener('pointermove', onMove);
    gl.domElement.addEventListener('pointerenter', onEnter);
    gl.domElement.addEventListener('pointerleave', onLeave);

    return () => {
      cancelled = true;
      holder.current = null;
      ambient.current = [];
      meshes.current = [];
      flowRef.current = null;
      gl.domElement.removeEventListener('pointerdown', onDown);
      gl.domElement.removeEventListener('pointermove', onMove);
      gl.domElement.removeEventListener('pointerenter', onEnter);
      gl.domElement.removeEventListener('pointerleave', onLeave);
      g.traverse((n: any) => { try { n.dispose?.(); } catch {} });
      scene.remove(g);
      try { spark.dispose(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, url]);

  // Pointer parallax + breathing core + counter-rotating ring + gusts.
  useFrame((state, dt) => {
    const g = holder.current;
    if (!g) return;
    clockRef.current = state.clock;
    const k = 1 - Math.exp(-4 * dt);
    g.rotation.y += (pointer.x * 0.14 - g.rotation.y) * k;
    g.rotation.x += (-pointer.y * 0.09 - g.rotation.x) * k;

    const t = state.clock.elapsedTime;
    const layers = ambient.current;

    // Gust envelope — auto every GUST_PERIOD, manual on click. Attack
    // ~0.4s, decay ~3s; spores surge, ring spins up, core swells.
    const autoPhase = t % GUST_PERIOD;
    const autoGust = autoPhase < 3.6 ? Math.sin((autoPhase / 3.6) * Math.PI) * (0.75 + 0.25 * Math.sin(autoPhase * 6)) : 0;
    const manPhase = t - manualGustAt.current;
    const manGust = manPhase >= 0 && manPhase < 3.2 ? Math.exp(-manPhase * 1.4) * Math.sin(Math.min(1, manPhase / 0.35) * Math.PI * 0.5) : 0;
    const gust = Math.min(1, Math.max(autoGust, manGust));
    const gusting = gust > 0.3;
    if (gusting !== gustWas.current) { gustWas.current = gusting; onGust?.(gusting); }

    // Flow-field uniforms — cursor ray → sphere point, smoothed for a
    // liquid wake; strength eases in on activity, decays on idle.
    const flow = flowRef.current;
    if (flow) {
      flow.time.value = t;
      flow.gust.value = gust;
      const cam = state.camera;
      pointerToSphere(pointer, cam, new THREE.Vector3(0, 0, 0), 1.5, mouseTarget.current);
      const mk = 1 - Math.exp(-7 * dt);
      (flow.mouse.value as THREE.Vector3).lerp(mouseTarget.current, mk);
      const active = cursorActive.current && t - lastMoveAt.current < 4;
      const targetStrength = active ? 1 : 0;
      const sk = 1 - Math.exp(-(active ? 9 : 2.2) * dt);
      flow.strength.value += (targetStrength - flow.strength.value) * sk;
    }

    // Core breathing — two detuned sines + gust swell.
    const breathe = 1 + 0.022 * Math.sin(t * 0.83) + 0.012 * Math.sin(t * 1.71 + 1.2) + 0.03 * gust;
    // Ring counter-rotation — opposite sign, gust spins it up.
    const ringSpin = -(0.1 + 0.35 * gust);

    for (const { mesh, role } of meshes.current) {
      if (role === 'core') {
        mesh.rotation.y += 0.05 * dt;
        mesh.scale.setScalar(breathe);
      } else if (role === 'ring') {
        mesh.rotation.y += ringSpin * dt;
        mesh.scale.setScalar(1 + 0.018 * Math.sin(t * 0.83 + 1.3) - 0.02 * gust);
      }
    }

    if (layers.length === 3) {
      layers[0].fallVelocity.value = 0.03 * Math.max(0.15, (0.65 + 0.5 * Math.sin(t * 0.31) + 0.25 * Math.sin(t * 0.83 + 1.7)) * (1 + 5.5 * gust));
      layers[0].wanderScale.value = 0.32 * (0.8 + 0.35 * Math.sin(t * 0.47 + 0.6)) * (1 + 1.6 * gust);
      layers[0].opacity.value = Math.min(0.95, 0.55 * (0.85 + 0.15 * Math.sin(t * 0.9)) * (1 + 0.7 * gust));
      layers[1].fallVelocity.value = 0.014 * (0.9 + 0.3 * Math.sin(t * 0.21 + 2.2)) * (1 + 3 * gust);
      layers[1].opacity.value = Math.min(0.9, 0.35 * (0.9 + 0.2 * Math.sin(t * 0.66)) * (1 + 0.8 * gust));
      layers[2].fallVelocity.value = 0.045 * (0.85 + 0.3 * Math.sin(t * 0.57 + 4.0)) * (1 + 2.5 * gust);
      layers[2].opacity.value = Math.min(0.95, 0.7 * (0.85 + 0.15 * Math.sin(t * 1.1 + 0.4)) * (1 + 0.9 * gust));
    }
  });
  return null;
}

export default function CortexSplatScene({ splat }: { splat?: string }) {
  const raw = (splat || 'cortex-core').replace(/[^a-zA-Z0-9._-]/g, '');
  const url = raw.includes('.') ? `/splats/${raw}` : `/splats/${raw}.ply`;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [gusting, setGusting] = useState(false);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'radial-gradient(ellipse at center, #050a14 0%, #01030a 100%)' }}>
      <Canvas
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0.15, 3.1], fov: 45, near: 0.05, far: 60 }}
        dpr={[1, 1.75]}
      >
        <SparkStage url={url} onReady={() => setReady(true)} onFail={() => setFailed(true)} onGust={setGusting} />
        <OrbitControls
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.55}
          minDistance={0.12}
          maxDistance={7}
          enableDamping
          dampingFactor={0.06}
        />
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.85}
            luminanceThreshold={0.28}
            luminanceSmoothing={0.3}
            mipmapBlur
            radius={0.7}
          />
          <ChromaticAberration offset={new THREE.Vector2(0.0007, 0.0007)} modulationOffset={0.2} radialModulation />
          <Vignette offset={0.22} darkness={0.68} />
        </EffectComposer>
      </Canvas>

      {/* HUD chrome */}
      <div style={{
        position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)',
        fontFamily: MONO, fontSize: 9, letterSpacing: '0.34em',
        color: gusting ? 'rgba(255,190,110,0.85)' : 'rgba(125,240,255,0.6)',
        pointerEvents: 'none',
        textShadow: gusting ? '0 0 18px rgba(255,170,80,0.7)' : '0 0 14px rgba(103,232,249,0.4)',
        transition: 'color 300ms, text-shadow 300ms',
      }}>
        {gusting ? '✦ SOLAR GUST ✦' : `GAUSSIAN SPLAT // ${raw.toUpperCase()}`}
      </div>
      <div style={{
        position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
        fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.22em',
        color: 'rgba(148,233,255,0.4)', pointerEvents: 'none',
      }}>
        {ready ? 'DRAG TO ORBIT · SCROLL — ZOOM INSIDE · CLICK FOR GUST' : failed ? 'SPLAT LOAD FAILED' : 'DECOMPRESSING GAUSSIANS…'}
      </div>
      {!ready && !failed && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 34, height: 34, borderRadius: '50%',
          border: '1.5px solid rgba(103,232,249,0.15)',
          borderTopColor: 'rgba(125,240,255,0.9)',
          animation: 'spin 0.9s linear infinite',
        }} />
      )}
      <style>{`@keyframes spin { to { transform: translate(-50%,-50%) rotate(360deg); } }`}</style>
    </div>
  );
}
