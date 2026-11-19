import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const BG = "#050810";
const CYAN = "#00e5ff";
const GRID_COLS = 24;
const GRID_ROWS = 14;

const DotGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const dots: React.ReactNode[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const phase = (r * GRID_COLS + c) % 97;
      const pulse =
        0.55 +
        0.45 *
          Math.sin(frame / 18 + phase * 0.35) *
          Math.cos(frame / 23 + phase * 0.21);
      dots.push(
        <div
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            left: `${(c / (GRID_COLS - 1)) * 100}%`,
            top: `${(r / (GRID_ROWS - 1)) * 100}%`,
            width: 6,
            height: 6,
            marginLeft: -3,
            marginTop: -3,
            borderRadius: "50%",
            backgroundColor: CYAN,
            opacity: 0.12 + 0.35 * pulse,
          }}
        />
      );
    }
  }
  return <AbsoluteFill>{dots}</AbsoluteFill>;
};

export interface CortexPromoProps {
  /** Wordmark text — defaults preserve the original look. */
  title?: string;
  /** Subtitle line under the wordmark. */
  subtitle?: string;
}

export const CortexPromo: React.FC<CortexPromoProps> = ({
  title = "CORTEX",
  subtitle = "SOVEREIGN AGENT FLEET",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const scaleIn = spring({
    frame: frame - 15,
    fps,
    config: { damping: 12, stiffness: 90, mass: 1 },
  });
  const scale = interpolate(scaleIn, [0, 1], [0.4, 1]);
  const wordmarkOpacity = interpolate(frame, [15, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleY = interpolate(
    spring({
      frame: frame - 60,
      fps,
      config: { damping: 16, stiffness: 70 },
    }),
    [0, 1],
    [60, 0]
  );
  const subtitleOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateRight: "clamp",
  });

  const progress = frame / (durationInFrames - 1);
  const glowOpacity =
    0.25 + 0.2 * Math.sin(frame / 30) + interpolate(frame, [400, 449], [0, 1], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        fontFamily:
          '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif',
      }}
    >
      {/* cyan glow behind the wordmark */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "42%",
          width: 1200,
          height: 500,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `radial-gradient(ellipse at center, ${CYAN}33 0%, transparent 65%)`,
          opacity: glowOpacity,
        }}
      />

      <DotGrid />

      {/* CORTEX wordmark */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "34%",
          display: "flex",
          justifyContent: "center",
          opacity: wordmarkOpacity,
        }}
      >
        <div
          style={{
            fontSize: 190,
            fontWeight: 800,
            letterSpacing: 18,
            color: "#f4fbff",
            transform: `scale(${scale})`,
            textShadow: `0 0 40px ${CYAN}66`,
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "54%",
          display: "flex",
          justifyContent: "center",
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
        }}
      >
        <div
          style={{
            fontSize: 54,
            fontWeight: 300,
            letterSpacing: 14,
            color: CYAN,
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* progress bar */}
      <div
        style={{
          position: "absolute",
          left: "10%",
          right: "10%",
          bottom: "9%",
          height: 4,
          borderRadius: 2,
          backgroundColor: "rgba(0, 229, 255, 0.15)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            borderRadius: 2,
            backgroundColor: CYAN,
            boxShadow: `0 0 12px ${CYAN}`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
