/**
 * SplatPreview — lean Gaussian-splat viewer for `splat` artifacts.
 *
 * Minimal counterpart to CortexSplatScene: one SplatMesh on a SparkRenderer,
 * slow auto-rotation + gentle float, camera auto-framed to the splat's
 * bounding sphere. No GPU sim / swarm / postfx — cheap enough to live
 * inside artifact cards and surface panels.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

function SplatStage({ url, onReady, onFail }: {
  url: string;
  onReady: () => void;
  onFail: () => void;
}) {
  const { gl, scene, invalidate, camera } = useThree();
  const group = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const g = new THREE.Group();
    scene.add(g);
    group.current = g;
    const spark = new SparkRenderer({ renderer: gl, onDirty: () => invalidate() });
    g.add(spark);
    const mesh = new SplatMesh({ url });
    g.add(mesh);
    let cancelled = false;

    mesh.initialized.then(() => {
      if (cancelled) return;
      try {
        const bb: any = (mesh as any).geometry?.boundingSphere;
        if (bb?.radius && bb?.center) {
          // Recentre so the turntable spins on the splat's own centroid.
          mesh.position.sub(bb.center);
          const dist = Math.max(bb.radius * 2.3, 0.6);
          camera.position.set(0, bb.center.y * 0.15, dist);
          camera.near = Math.max(dist / 80, 0.01);
          camera.far = dist * 30;
          camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix();
        }
        onReady();
      } catch { onReady(); }
    }).catch(() => { if (!cancelled) onFail(); });

    return () => {
      cancelled = true;
      group.current = null;
      g.traverse((n: any) => { try { n.dispose?.(); } catch { /* noop */ } });
      scene.remove(g);
      try { spark.dispose(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, url]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * 0.22;
    g.position.y = Math.sin(performance.now() / 2600) * 0.045;
  });
  return null;
}

export default function SplatPreview({ url, height = 190 }: { url: string; height?: number }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Bare filenames resolve into /splats/ — artifacts may arrive unsanitized
  // (direct cortex-open-artifact dispatch) and a relative URL would hit the
  // SPA HTML fallback instead of the asset.
  const src = /^https?:\/\//.test(url) || url.startsWith('/') ? url : `/splats/${url}`;
  return (
    <div style={{
      position: 'relative', width: '100%', height,
      borderRadius: 8, overflow: 'hidden',
      background: 'radial-gradient(ellipse at 50% 60%, #0a1626 0%, #030812 100%)',
    }}>
      <Canvas
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        camera={{ position: [0, 0, 3], fov: 42, near: 0.02, far: 80 }}
        dpr={[1, 1.5]}
        style={{ position: 'absolute', inset: 0 }}
      >
        <SplatStage url={src} onReady={() => setReady(true)} onFail={() => setFailed(true)} />
      </Canvas>
      {!ready && !failed && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.3em', color: 'rgba(140,200,240,0.55)',
        }}>◌ LOADING SPLAT…</div>
      )}
      {failed && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.2em', color: 'rgba(255,140,140,0.6)',
        }}>SPLAT UNAVAILABLE</div>
      )}
      {ready && (
        <div style={{
          position: 'absolute', left: 10, bottom: 8, pointerEvents: 'none',
          fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.28em',
          color: 'rgba(140,220,255,0.45)',
        }}>GAUSSIAN SPLAT // LIVE</div>
      )}
    </div>
  );
}
