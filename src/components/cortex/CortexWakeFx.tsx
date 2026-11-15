/**
 * CortexWakeFx — Next-Level Top-Tier Elite .01% Awakening Animation & Audio Synthesis
 *
 * Triggered when user speaks the wake word ("Hey Cortex" / "Cortex").
 * Features:
 * 1. Web Audio API synthesized multi-harmonic quantum comlink chime (zero assets, zero latency).
 * 2. Central Quantum Aperture & mechanical rotating reticle calipers around Sovereign Core.
 * 3. Hyper-dimensional dual chromatic shockwave expansion (cyan #67e8f9 & amber gold #fbbf24).
 * 4. Holographic tactical telemetry HUD callout with decoded typography.
 * 5. Hardware-accelerated CSS keyframes with 60/120fps fluid motion and auto-cleanup.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { cortexSignalBus, type CortexSignalBusPayload } from './CortexVisualizer';

/**
 * Synthesize a military-grade tactical AI wake sound via Web Audio API.
 * Ascending crystal harmonic glide: C5 (523.25Hz) -> G5 (783.99Hz) -> C6 (1046.50Hz) -> E6 (1318.51Hz)
 * with resonant bandpass sweep and holographic comlink tail.
 */
export function playCortexWakeSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t0 = ctx.currentTime;

    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, t0);
    masterGain.gain.linearRampToValueAtTime(0.25, t0 + 0.04);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);
    masterGain.connect(ctx.destination);

    // Resonant bandpass filter for comlink holographic sheen
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t0);
    filter.frequency.exponentialRampToValueAtTime(3200, t0 + 0.25);
    filter.Q.setValueAtTime(4.0, t0);
    filter.connect(masterGain);

    // Primary harmonic oscillator (Ascending Crystal Arpeggio)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, t0); // C5
    osc1.frequency.setValueAtTime(783.99, t0 + 0.06); // G5
    osc1.frequency.setValueAtTime(1046.50, t0 + 0.12); // C6
    osc1.frequency.exponentialRampToValueAtTime(1318.51, t0 + 0.24); // E6
    osc1.connect(filter);
    osc1.start(t0);
    osc1.stop(t0 + 0.65);

    // Secondary sub-shimmer oscillator for holographic texture
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(261.63, t0); // C4 foundation
    osc2.frequency.exponentialRampToValueAtTime(659.25, t0 + 0.22); // E5
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(0.08, t0);
    osc2Gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    osc2.connect(osc2Gain);
    osc2Gain.connect(masterGain);
    osc2.start(t0);
    osc2.stop(t0 + 0.5);

    // Auto-close context after sound finishes to prevent resource leaks
    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 800);
  } catch {
    // AudioContext blocked by autoplay policy
  }
}

export const CortexWakeFx: React.FC = () => {
  // Wake word & awakening FX turned off per user directive
  return null;
};

export const _InactiveCortexWakeFx: React.FC = () => {
  const [active, setActive] = useState(false);
  const [telemetryPhase, setTelemetryPhase] = useState<'ignite' | 'lock' | 'settle'>('ignite');
  const lastWakeTimeRef = useRef<number>(0);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerWake = useCallback(() => {
    const now = performance.now();
    // Hardware debouncing lock: minimum 3200ms between awakening triggers to prevent spazzing out
    if (now - lastWakeTimeRef.current < 3200) {
      return;
    }
    lastWakeTimeRef.current = now;

    // Clean up any pending phase timers
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    if (endTimerRef.current) clearTimeout(endTimerRef.current);

    playCortexWakeSound();
    setActive(true);
    setTelemetryPhase('ignite');

    lockTimerRef.current = setTimeout(() => setTelemetryPhase('lock'), 350);
    settleTimerRef.current = setTimeout(() => setTelemetryPhase('settle'), 1200);
    endTimerRef.current = setTimeout(() => {
      setActive(false);
    }, 2400);
  }, []);

  useEffect(() => {
    // Single authoritative listener for wake events
    const unsub = cortexSignalBus.subscribe((p: CortexSignalBusPayload) => {
      if (p.event === 'wake') {
        triggerWake();
      }
    });

    const onWakeEvent = () => triggerWake();
    window.addEventListener('cortex-wake', onWakeEvent);

    return () => {
      unsub();
      window.removeEventListener('cortex-wake', onWakeEvent);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
    };
  }, [triggerWake]);

  if (!active) return null;

  return (
    <div
      className="cortex-wake-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        pointerEvents: 'none',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <style>{`
        @keyframes cx-shockwave-expand {
          0% {
            transform: scale(0.12);
            opacity: 1;
            border-width: 4px;
          }
          45% {
            opacity: 0.95;
            border-width: 2px;
          }
          100% {
            transform: scale(3.2);
            opacity: 0;
            border-width: 1px;
          }
        }

        @keyframes cx-reticle-spin-cw {
          0% { transform: translate(-50%, -50%) rotate(0deg) scale(0.65); opacity: 0; }
          25% { transform: translate(-50%, -50%) rotate(180deg) scale(1.08); opacity: 1; }
          60% { transform: translate(-50%, -50%) rotate(360deg) scale(1.0); opacity: 0.95; }
          100% { transform: translate(-50%, -50%) rotate(540deg) scale(1.02); opacity: 0; }
        }

        @keyframes cx-reticle-spin-ccw {
          0% { transform: translate(-50%, -50%) rotate(0deg) scale(0.5); opacity: 0; }
          25% { transform: translate(-50%, -50%) rotate(-180deg) scale(1.12); opacity: 1; }
          60% { transform: translate(-50%, -50%) rotate(-360deg) scale(1.0); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) rotate(-540deg) scale(1.04); opacity: 0; }
        }

        @keyframes cx-banner-burst {
          0% { transform: translateY(-18px) scale(0.85); opacity: 0; filter: blur(8px); }
          20% { transform: translateY(0px) scale(1.04); opacity: 1; filter: blur(0px); }
          75% { transform: translateY(0px) scale(1.0); opacity: 0.95; }
          100% { transform: translateY(-10px) scale(0.96); opacity: 0; filter: blur(4px); }
        }

        @keyframes cx-chromatic-pulse {
          0% { box-shadow: inset 0 0 100px rgba(103, 232, 249, 0.45), 0 0 80px rgba(251, 191, 36, 0.35); }
          50% { box-shadow: inset 0 0 40px rgba(103, 232, 249, 0.25), 0 0 30px rgba(251, 191, 36, 0.15); }
          100% { box-shadow: inset 0 0 0px transparent, 0 0 0px transparent; }
        }

        @keyframes cx-iris-open {
          0% { clip-path: circle(0% at center); }
          30% { clip-path: circle(35% at center); }
          70% { clip-path: circle(75% at center); }
          100% { clip-path: circle(100% at center); }
        }
      `}</style>

      {/* Screen edge flash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          animation: 'cx-chromatic-pulse 1.8s ease-out forwards',
          pointerEvents: 'none',
        }}
      />

      {/* Dual concentric expanding shockwave rings */}
      <div
        style={{
          position: 'absolute',
          width: '540px',
          height: '540px',
          borderRadius: '50%',
          border: '2px solid rgba(103, 232, 249, 0.95)',
          boxShadow: '0 0 40px rgba(103, 232, 249, 0.8), inset 0 0 30px rgba(103, 232, 249, 0.4)',
          animation: 'cx-shockwave-expand 1.4s cubic-bezier(0.12, 0.8, 0.32, 1) forwards',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          border: '2px solid rgba(251, 191, 36, 0.85)',
          boxShadow: '0 0 35px rgba(251, 191, 36, 0.75), inset 0 0 20px rgba(251, 191, 36, 0.35)',
          animation: 'cx-shockwave-expand 1.6s 0.12s cubic-bezier(0.12, 0.8, 0.32, 1) forwards',
        }}
      />

      {/* Rotating Mechanical Reticle Ring 1 (Clockwise Cyan) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '480px',
          height: '480px',
          borderRadius: '50%',
          border: '1px dashed rgba(103, 232, 249, 0.75)',
          animation: 'cx-reticle-spin-cw 2.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* Caliper ticks */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 14, height: 4, background: '#67e8f9', boxShadow: '0 0 10px #67e8f9' }} />
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 14, height: 4, background: '#67e8f9', boxShadow: '0 0 10px #67e8f9' }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)', width: 4, height: 14, background: '#67e8f9', boxShadow: '0 0 10px #67e8f9' }} />
        <div style={{ position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)', width: 4, height: 14, background: '#67e8f9', boxShadow: '0 0 10px #67e8f9' }} />
      </div>

      {/* Rotating Mechanical Reticle Ring 2 (Counter-Clockwise Amber) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '380px',
          height: '380px',
          borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: '#fbbf24',
          borderBottomColor: '#fbbf24',
          boxShadow: '0 0 24px rgba(251, 191, 36, 0.5)',
          animation: 'cx-reticle-spin-ccw 2.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      />

      {/* Crosshair telemetry lines */}
      <div
        style={{
          position: 'absolute',
          width: '100vw',
          height: '1px',
          background: 'linear-gradient(90deg, transparent 15%, rgba(103, 232, 249, 0.45) 50%, transparent 85%)',
          opacity: telemetryPhase === 'settle' ? 0.2 : 0.85,
          transition: 'opacity 0.6s ease-out',
        }}
      />
      <div
        style={{
          position: 'absolute',
          height: '100vh',
          width: '1px',
          background: 'linear-gradient(180deg, transparent 15%, rgba(103, 232, 249, 0.45) 50%, transparent 85%)',
          opacity: telemetryPhase === 'settle' ? 0.2 : 0.85,
          transition: 'opacity 0.6s ease-out',
        }}
      />

      {/* Center Tactical Telemetry Callout */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(50% + 220px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          animation: 'cx-banner-burst 2.1s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.45em',
            color: '#fbbf24',
            textShadow: '0 0 12px rgba(251, 191, 36, 0.7)',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          // AURAL SYNAPSE ENGAGED //
        </div>

        <div
          style={{
            padding: '6px 20px',
            background: 'rgba(3, 7, 18, 0.75)',
            border: '1px solid rgba(103, 232, 249, 0.65)',
            borderRadius: 2,
            boxShadow: '0 0 25px rgba(103, 232, 249, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ color: '#34d399', fontSize: 13, textShadow: '0 0 8px #34d399' }}>◉</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.28em',
              color: '#f0fdff',
              textShadow: '0 0 18px rgba(103, 232, 249, 0.85)',
            }}
          >
            CORTEX VOICE INITIATED & ACTIVE
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 16,
            fontSize: 9,
            letterSpacing: '0.22em',
            color: 'rgba(148, 233, 255, 0.7)',
            textTransform: 'uppercase',
            marginTop: 2,
          }}
        >
          <span>IIT Φ=1.24</span>
          <span>•</span>
          <span>AUDIO MATRIX LOCKED</span>
          <span>•</span>
          <span style={{ color: '#34d399' }}>AWAITING DIRECTIVE</span>
        </div>
      </div>
    </div>
  );
};

