/**
 * CortexGazeLayer — opt-in WebGazer eye-tracking overlay for /cortex.
 *
 * Mounted only when ?gaze=1. Flow: acquire camera → 9-point calibration
 * (auto-advancing dwell dots) → glowing gaze reticle + live gaze stream
 * for camera parallax. Everything runs client-side; nothing is uploaded.
 */
import React, { useEffect, useRef, useState } from 'react';
import { cortexGaze } from '../../lib/cortex-gaze';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

export default function CortexGazeLayer() {
  const [phase, setPhase] = useState<'loading' | 'calibrating' | 'locked' | 'error'>('loading');
  const [pointIdx, setPointIdx] = useState(0);
  const [msg, setMsg] = useState('ACQUIRING EYE LOCK…');
  const reticleRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  // Calibration sequence — each point dwells ~1.5s while facemesh settles,
  // then records one screen-position sample and advances.
  useEffect(() => {
    let cancelled = false;
    const points = cortexGaze.calibrationPoints;
    const run = async () => {
      try {
        await cortexGaze.clearCalibration();
        await cortexGaze.begin();
        if (cancelled) return;
        for (let i = 0; i < points.length; i++) {
          if (cancelled) return;
          setPointIdx(i);
          setPhase('calibrating');
          setMsg(`CALIBRATING ${i + 1}/${points.length} — HOLD GAZE`);
          await new Promise((r) => setTimeout(r, 1500));
          if (cancelled) return;
          await cortexGaze.calibrateAt(points[i][0], points[i][1]);
        }
        if (cancelled) return;
        doneRef.current = true;
        setPhase('locked');
        setMsg('');
      } catch (e: any) {
        if (!cancelled) { setPhase('error'); setMsg(`GAZE UNAVAILABLE — ${e?.message || 'camera denied'}`); }
      }
    };
    void run();
    return () => { cancelled = true; void cortexGaze.end(); };
  }, []);

  // Reticle follows raw gaze — direct DOM writes, no react re-render per frame.
  useEffect(() => {
    return cortexGaze.subscribe((g) => {
      const el = reticleRef.current;
      if (!el) return;
      if (!g) { el.style.opacity = '0'; return; }
      el.style.opacity = '1';
      el.style.transform = `translate3d(${g.x - 7}px, ${g.y - 7}px, 0)`;
    });
  }, []);

  if (phase === 'locked') {
    return (
      <>
        {/* Gaze reticle — cursor ring that trails the eyes. */}
        <div
          ref={reticleRef}
          aria-hidden="true"
          style={{
            position: 'fixed', top: 0, left: 0, zIndex: 9999,
            width: 14, height: 14, borderRadius: '50%',
            border: '1.5px solid rgba(125,240,255,0.9)',
            boxShadow: '0 0 12px rgba(103,232,249,0.6), inset 0 0 6px rgba(103,232,249,0.4)',
            pointerEvents: 'none', opacity: 0,
            transition: 'opacity 0.3s',
          }}
        />
        <div style={{
          position: 'fixed', bottom: 14, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, fontFamily: MONO, fontSize: 9, letterSpacing: '0.22em',
          color: 'rgba(125,240,255,0.75)', padding: '4px 10px',
          background: 'rgba(4,12,18,0.6)', border: '1px solid rgba(103,232,249,0.25)',
          borderRadius: 4, backdropFilter: 'blur(8px)', pointerEvents: 'none',
        }}>
          ◉ EYE LOCK
        </div>
      </>
    );
  }

  if (phase === 'error') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10000, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(2,6,10,0.82)', backdropFilter: 'blur(10px)',
        fontFamily: MONO, fontSize: 11, letterSpacing: '0.2em', color: '#f87171',
      }}>
        {msg}
        <button
          onClick={() => window.location.search = window.location.search.replace(/([?&])gaze=1&?/, '$1').replace(/[?&]$/, '')}
          style={{ marginLeft: 16, background: 'none', border: '1px solid rgba(248,113,113,0.5)', color: '#f87171', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em' }}
        >
          DISMISS
        </button>
      </div>
    );
  }

  // Calibration / loading overlay.
  const pts = cortexGaze.calibrationPoints;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(2,6,10,0.55)', backdropFilter: 'blur(6px)',
      fontFamily: MONO,
    }}>
      {phase === 'calibrating' && pts.map(([fx, fy], i) => {
        const active = i === pointIdx;
        const done = i < pointIdx;
        return (
          <div key={i} style={{
            position: 'absolute', left: `${fx * 100}%`, top: `${fy * 100}%`,
            width: active ? 18 : 10, height: active ? 18 : 10, borderRadius: '50%',
            transform: 'translate(-50%,-50%)',
            border: `1.5px solid ${active ? 'rgba(125,240,255,0.95)' : done ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.25)'}`,
            background: active ? 'rgba(103,232,249,0.25)' : 'transparent',
            boxShadow: active ? '0 0 24px rgba(103,232,249,0.7)' : 'none',
            transition: 'all 0.25s',
          }} />
        );
      })}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-160%)',
        fontSize: 10, letterSpacing: '0.26em', color: 'rgba(125,240,255,0.85)',
        textShadow: '0 0 12px rgba(103,232,249,0.6)', whiteSpace: 'nowrap',
      }}>
        {msg}
      </div>
      {phase === 'calibrating' && (
        <button
          onClick={() => { doneRef.current = true; setPhase('locked'); setMsg(''); }}
          style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(4,12,18,0.7)', border: '1px solid rgba(103,232,249,0.3)',
            color: 'rgba(148,233,255,0.8)', padding: '6px 16px', borderRadius: 4,
            cursor: 'pointer', fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em',
          }}
        >
          SKIP CALIBRATION
        </button>
      )}
    </div>
  );
}
