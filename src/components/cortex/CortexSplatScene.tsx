/**
 * CortexSplatScene — Gaussian-splat viewer for /cortex?splat=1.
 *
 * Renders .ply/.splat/.ply assets through @sparkjsdev/spark (SparkRenderer
 * discovers SplatMesh objects in the scene and draws them each frame).
 * Drop any trained splat into public/splats/ and pass ?splat=<name> — the
 * default is the procedural cortex-core.ply from scripts/gen-demo-splat.py.
 *
 * Quality stack: extSplats encoding + LoD "quality" + EffectComposer
 * (Bloom / ChromaticAberration / Vignette) + pointer parallax.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

function SparkStage({ url, onReady, onFail }: { url: string; onReady: () => void; onFail: () => void }) {
  const { gl, scene, invalidate, pointer } = useThree();
  const holder = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const g = new THREE.Group();
    scene.add(g);
    holder.current = g;
    const spark = new SparkRenderer({ renderer: gl, onDirty: () => invalidate() });
    g.add(spark);
    const mesh = new SplatMesh({ url });
    g.add(mesh);
    let cancelled = false;
    mesh.initialized.then(() => {
      if (cancelled) return;
      try {
        const ps: any = (mesh as any).packedSplats;
        const bb: any = (mesh as any).geometry?.boundingSphere;
        console.log('[splat] initialized', {
          numSplats: ps?.numSplats ?? ps?.splats?.length,
          hasExt: !!(mesh as any).extSplats,
          boundingSphere: bb ? { c: bb.center.toArray(), r: bb.radius } : null,
        });
      } catch (e) { console.log('[splat] init-log-fail', e); }
      onReady();
    }).catch((e) => { console.log('[splat] init FAILED', e); onFail(); });
    return () => {
      cancelled = true;
      holder.current = null;
      g.remove(spark);
      g.remove(mesh);
      scene.remove(g);
      try { spark.dispose(); } catch {}
      try { (mesh as any).dispose?.(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, url]);

  // Pointer parallax — the whole splat field leans toward the cursor.
  useFrame((_, dt) => {
    const g = holder.current;
    if (!g) return;
    const k = 1 - Math.exp(-4 * dt);
    g.rotation.y += (pointer.x * 0.14 - g.rotation.y) * k;
    g.rotation.x += (-pointer.y * 0.09 - g.rotation.x) * k;
  });
  return null;
}

export default function CortexSplatScene({ splat }: { splat?: string }) {
  const raw = (splat || 'cortex-core').replace(/[^a-zA-Z0-9._-]/g, '');
  const url = raw.includes('.') ? `/splats/${raw}` : `/splats/${raw}.ply`;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'radial-gradient(ellipse at center, #050a14 0%, #01030a 100%)' }}>
      <Canvas
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0.15, 3.1], fov: 45, near: 0.1, far: 60 }}
        dpr={[1, 1.75]}
      >
        <SparkStage url={url} onReady={() => setReady(true)} onFail={() => setFailed(true)} />
        <OrbitControls
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.55}
          minDistance={1.4}
          maxDistance={8}
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
          <ChromaticAberration offset={new THREE.Vector2(0.0007, 0.0007)} radialModulation />
          <Vignette offset={0.22} darkness={0.68} />
        </EffectComposer>
      </Canvas>

      {/* HUD chrome */}
      <div style={{
        position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)',
        fontFamily: MONO, fontSize: 9, letterSpacing: '0.34em',
        color: 'rgba(125,240,255,0.6)', pointerEvents: 'none',
        textShadow: '0 0 14px rgba(103,232,249,0.4)',
      }}>
        GAUSSIAN SPLAT // {raw.toUpperCase()}
      </div>
      <div style={{
        position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
        fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.22em',
        color: 'rgba(148,233,255,0.4)', pointerEvents: 'none',
      }}>
        {ready ? 'DRAG TO ORBIT · SCROLL TO ZOOM · MOVE TO PARALLAX' : failed ? 'SPLAT LOAD FAILED' : 'DECOMPRESSING GAUSSIANS…'}
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
