/**
 * HoloHandOverlay.tsx — 21-joint holographic hand skeleton & pinch reticle HUD.
 *
 * Renders:
 *  - Full 21-bone wireframe skeleton for primary & secondary hands (SVG overlay)
 *  - Dynamic pinch energy arc between thumb tip (#4) and index tip (#8)
 *  - Precision reticle with mode telemetry (PINCH_LOCK, SPATIAL_CLUTCH, BIMANUAL, FPS)
 */

import React from 'react';
import type { HandPinchState } from '../../lib/cortex-webcam-parallax';
import type { Point3D } from '../../lib/one-euro-filter';

const HAND_CONNECTIONS: Array<[number, number]> = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm bridge
  [5, 9], [9, 13], [13, 17],
];

function HandSkeleton({
  landmarks,
  accent,
  showPinchArc,
}: {
  landmarks: Point3D[];
  accent: string;
  showPinchArc?: boolean;
}) {
  const thumb = landmarks[4];
  const index = landmarks[8];

  return (
    <g>
      {HAND_CONNECTIONS.map(([a, b], i) => {
        const pa = landmarks[a];
        const pb = landmarks[b];
        if (!pa || !pb) return null;
        return (
          <line
            key={i}
            x1={`${pa.x * 100}%`}
            y1={`${pa.y * 100}%`}
            x2={`${pb.x * 100}%`}
            y2={`${pb.y * 100}%`}
            stroke={accent}
            strokeOpacity={0.55}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        );
      })}
      {showPinchArc && thumb && index && (
        <line
          x1={`${thumb.x * 100}%`}
          y1={`${thumb.y * 100}%`}
          x2={`${index.x * 100}%`}
          y2={`${index.y * 100}%`}
          stroke={accent}
          strokeOpacity={0.95}
          strokeWidth={2.4}
          strokeDasharray="3 3"
        />
      )}
      {landmarks.map((pt, idx) => {
        const isTip = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;
        const isPrimaryTip = idx === 4 || idx === 8;
        return (
          <circle
            key={idx}
            cx={`${pt.x * 100}%`}
            cy={`${pt.y * 100}%`}
            r={isPrimaryTip ? 4.2 : isTip ? 3.0 : 2.1}
            fill={isPrimaryTip ? accent : '#e0f2fe'}
            fillOpacity={isPrimaryTip ? 0.95 : 0.75}
            stroke={accent}
            strokeWidth={isPrimaryTip ? 1.2 : 0.6}
          />
        );
      })}
    </g>
  );
}

export const HoloHandOverlay: React.FC<{ hand: HandPinchState | null }> = ({ hand }) => {
  if (!hand || !hand.detected) return null;

  const isPinch = !!hand.pinching;
  const isClutch = !!hand.clutching;
  const accent = isPinch ? '#34d399' : isClutch ? '#f59e0b' : '#38bdf8';

  const statusLabel = isPinch
    ? '◉ PINCH LOCKED'
    : isClutch
    ? '⏸ SPATIAL CLUTCH'
    : hand.bimanual?.active
    ? '◈ BIMANUAL 3D'
    : hand.gesture && hand.gesture !== 'TRACKING'
    ? `◌ ${hand.gesture}`
    : '◌ PINCH TO GRAB';

  const engineTag =
    hand.engine === 'mediapipe-gpu'
      ? 'MP·GPU'
      : hand.engine === 'mediapipe-cpu'
      ? 'MP·CPU'
      : 'OPT';

  return (
    <>
      {(hand.landmarks || hand.secondaryLandmarks) && (
        <svg
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 58,
            filter: `drop-shadow(0 0 6px ${accent}55)`,
          }}
        >
          {hand.landmarks && (
            <HandSkeleton landmarks={hand.landmarks} accent={accent} showPinchArc />
          )}
          {hand.secondaryLandmarks && (
            <HandSkeleton landmarks={hand.secondaryLandmarks} accent="#a78bfa" />
          )}
        </svg>
      )}

      {/* Precision Hand Cursor & Telemetry Pill */}
      <div
        style={{
          position: 'fixed',
          left: hand.x,
          top: hand.y,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 60,
          transition: 'transform 0.03s linear',
        }}
      >
        <div
          style={{
            width: isPinch ? 28 : isClutch ? 36 : 44,
            height: isPinch ? 28 : isClutch ? 36 : 44,
            borderRadius: '50%',
            border: `2px solid ${accent}`,
            background: isPinch
              ? 'rgba(52,211,153,0.22)'
              : isClutch
              ? 'rgba(245,158,11,0.16)'
              : 'rgba(56,189,248,0.08)',
            boxShadow: `0 0 ${isPinch ? 26 : 14}px ${accent}99, inset 0 0 10px ${accent}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.12s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: accent,
              boxShadow: `0 0 8px ${accent}`,
            }}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 6,
            fontSize: 8.5,
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: '0.13em',
            fontWeight: 700,
            color: accent,
            background: 'rgba(4,8,16,0.9)',
            padding: '2px 7px',
            borderRadius: 3,
            border: `1px solid ${accent}66`,
            whiteSpace: 'nowrap',
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <span>{statusLabel}</span>
          <span style={{ opacity: 0.6, fontSize: 7.5 }}>
            {engineTag}
            {hand.fps ? `·${hand.fps}` : ''}
          </span>
        </div>
      </div>
    </>
  );
};

export default HoloHandOverlay;
