/**
 * CortexSplatScene — Gaussian-splat viewer for /cortex?splat=1.
 *
 * Renders .ply/.splat/.ply assets through @sparkjsdev/spark (SparkRenderer
 * discovers SplatMesh objects in the scene and draws them each frame).
 * Drop any trained splat into public/splats/ and pass ?splat=<name> — the
 * default is the procedural cortex-core.ply from scripts/gen-demo-splat.py.
 */
import React, { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

function SparkStage({ url, onReady }: { url: string; onReady: () => void }) {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const spark = new SparkRenderer({ renderer: gl, onDirty: () => invalidate() });
    scene.add(spark);
    const mesh = new SplatMesh({ url });
    scene.add(mesh);
    let cancelled = false;
    mesh.initialized.then(() => { if (!cancelled) onReady(); }).catch(() => {});
    return () => {
      cancelled = true;
      scene.remove(spark);
      scene.remove(mesh);
      try { spark.dispose(); } catch {}
      try { (mesh as any).dispose?.(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, url]);
  return null;
}

export default function CortexSplatScene({ splat }: { splat?: string }) {
  const name = (splat || 'cortex-core').replace(/[^a-zA-Z0-9_-]/g, '');
  const url = `/splats/${name}.ply`;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'radial-gradient(ellipse at center, #050a14 0%, #01030a 100%)' }}>
      <Canvas
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0.15, 3.1], fov: 45, near: 0.1, far: 60 }}
        dpr={[1, 1.75]}
      >
        <SparkStage url={url} onReady={() => setReady(true)} />
        <OrbitControls
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.55}
          minDistance={1.4}
          maxDistance={8}
          enableDamping
          dampingFactor={0.06}
        />
      </Canvas>

      {/* HUD chrome */}
      <div style={{
        position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)',
        fontFamily: MONO, fontSize: 9, letterSpacing: '0.34em',
        color: 'rgba(125,240,255,0.6)', pointerEvents: 'none',
        textShadow: '0 0 14px rgba(103,232,249,0.4)',
      }}>
        GAUSSIAN SPLAT // {name.toUpperCase()}
      </div>
      <div style={{
        position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
        fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.22em',
        color: 'rgba(148,233,255,0.4)', pointerEvents: 'none',
      }}>
        {ready ? 'DRAG TO ORBIT · SCROLL TO ZOOM' : failed ? 'SPLAT LOAD FAILED' : 'DECOMPRESSING GAUSSIANS…'}
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
