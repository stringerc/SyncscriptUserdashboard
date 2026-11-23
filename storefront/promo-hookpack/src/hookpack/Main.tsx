import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';

// HookPackPromo — 15s @30fps direct-response promo for the $12 AI Listing
// Hook Pack (Gumroad /l/sbiozo). Four shots, one message each.
// Deterministic: springs + interpolate only, no Date.now/Math.random.

export const HP_SHOTS = {
  hook: { from: 0, duration: 90 },     // 0–3.0s  problem slam
  product: { from: 90, duration: 120 },// 3.0–7.0s real Gumroad page push-in
  hooks: { from: 210, duration: 150 }, // 7.0–12.0s 4 real hooks deal in
  cta: { from: 360, duration: 90 },    // 12.0–15.0s offer + URL hold
} as const;

export const HP_TOTAL = 450;

const NAVY = '#0a1424';
const INK = '#eef2f8';
const ACCENT = '#f5b83d';
const MUTED = '#8fa3c0';

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const enter = (frame: number, start: number, fps: number) =>
  spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 120, mass: 0.9 } });

const fade = (frame: number, start: number, dur = 12) =>
  interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

// ── Shot 1: the scroll-stopping problem ─────────────────────────────
const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l1 = enter(frame, 6, fps);
  const l2 = enter(frame, 34, fps);
  const sub = fade(frame, 62);
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 55% at 50% 42%, rgba(245,184,61,0.10), transparent 70%)',
      }} />
      <div style={{ transform: `translateY(${(1 - l1) * 60}px)`, opacity: l1, textAlign: 'center' }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 92, letterSpacing: -2, color: INK, lineHeight: 1.02 }}>
          YOUR LISTING GETS<br />8 SECONDS.
        </div>
      </div>
      <div style={{ transform: `translateY(${(1 - l2) * 60}px)`, opacity: l2, textAlign: 'center', marginTop: 18 }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 92, letterSpacing: -2, color: ACCENT, lineHeight: 1.02 }}>
          MAKE THEM COUNT.
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 120, fontFamily: SANS, fontSize: 30, fontWeight: 600, color: MUTED, opacity: sub, letterSpacing: 4 }}>
        THE FIRST LINE DECIDES EVERYTHING
      </div>
    </AbsoluteFill>
  );
};

// ── Shot 2: the real product page, slow push + price pop ────────────
const SceneProduct: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const push = interpolate(frame, [0, 120], [1.0, 1.07], { extrapolateRight: 'clamp' });
  const drift = interpolate(frame, [0, 120], [0, -18], { extrapolateRight: 'clamp' });
  const badge = enter(frame, 30, fps);
  const cap = fade(frame, 70);
  return (
    <AbsoluteFill style={{ backgroundColor: '#050b16', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: '50%', top: '50%', width: 1920, height: 1080,
        transform: `translate(-50%, -50%) translateY(${drift}px) scale(${push})`,
        transformOrigin: '50% 38%',
      }}>
        <Img src={staticFile('textures/gumroad-product.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      {/* price badge */}
      <div style={{
        position: 'absolute', top: 96, right: 120,
        transform: `scale(${badge})`, opacity: badge,
        backgroundColor: ACCENT, color: NAVY, borderRadius: 18, padding: '18px 34px',
        fontFamily: SANS, fontWeight: 800, fontSize: 56, boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
      }}>
        $12
      </div>
      <div style={{
        position: 'absolute', bottom: 72, left: 0, right: 0, textAlign: 'center',
        fontFamily: SANS, fontSize: 34, fontWeight: 700, color: INK, opacity: cap,
        textShadow: '0 2px 16px rgba(0,0,0,0.8)', letterSpacing: 1,
      }}>
        50 READY-TO-USE HOOKS · 5 CATEGORIES · FILL IN [BRACKETS]
      </div>
    </AbsoluteFill>
  );
};

// ── Shot 3: real hooks deal in ──────────────────────────────────────
const HOOKS = [
  { cat: 'LIFESTYLE', text: 'The kind of home where Sunday mornings don’t have an alarm clock.' },
  { cat: 'SPECIFICITY', text: 'Built in [year], updated in [year] — the kitchen you see is the kitchen you’ll cook in on day one.' },
  { cat: 'CURIOSITY', text: 'There’s a reason the buyers who tour this place don’t want to leave.' },
  { cat: 'PROOF', text: 'Taxes are $[amount]/year. HOA is $[amount]/month. No surprises hiding in the fine print.' },
];

const SceneHooks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = fade(frame, 4);
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, padding: '90px 140px' }}>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 44, color: INK, letterSpacing: 2, opacity: head, marginBottom: 44 }}>
        INSIDE THE PACK — REAL HOOKS, NOT THEORY
      </div>
      {HOOKS.map((h, i) => {
        const start = 18 + i * 30;
        const p = enter(frame, start, fps);
        const out = i === HOOKS.length - 1 ? 1 : interpolate(frame, [start + 95, start + 115], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 28, marginBottom: 26,
            transform: `translateX(${(1 - p) * -80}px)`, opacity: p * out,
          }}>
            <div style={{
              fontFamily: SANS, fontSize: 20, fontWeight: 800, color: NAVY, backgroundColor: ACCENT,
              borderRadius: 8, padding: '8px 16px', minWidth: 190, textAlign: 'center', letterSpacing: 1,
            }}>{h.cat}</div>
            <div style={{
              fontFamily: SANS, fontSize: 38, fontWeight: 600, color: INK, lineHeight: 1.25,
              borderLeft: `4px solid ${ACCENT}`, paddingLeft: 24, flex: 1,
            }}>{h.text}</div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', bottom: 60, left: 140, fontFamily: SANS, fontSize: 26, color: MUTED, opacity: fade(frame, 130) }}>
        + 46 MORE ACROSS NEIGHBORHOOD, CURATION &amp; OPEN-LOOP PATTERNS
      </div>
    </AbsoluteFill>
  );
};

// ── Shot 4: offer + URL hold ────────────────────────────────────────
const SceneCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t1 = enter(frame, 4, fps);
  const t2 = enter(frame, 22, fps);
  const url = enter(frame, 40, fps);
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(245,184,61,0.12), transparent 70%)' }} />
      <div style={{ opacity: t1, transform: `translateY(${(1 - t1) * 40}px)`, textAlign: 'center' }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 76, color: INK, letterSpacing: -1, lineHeight: 1.05 }}>
          50 SCROLL-STOPPING<br />OPENING LINES.
        </div>
      </div>
      <div style={{ opacity: t2, transform: `translateY(${(1 - t2) * 40}px)`, marginTop: 26, fontFamily: SANS, fontSize: 34, color: MUTED, fontWeight: 600 }}>
        FOR REAL ESTATE LISTINGS — STEAL THEM, FILL THE BRACKETS, SHIP
      </div>
      <div style={{
        marginTop: 54, opacity: url, transform: `scale(${0.8 + url * 0.2})`,
        backgroundColor: ACCENT, color: NAVY, borderRadius: 999, padding: '22px 52px',
        fontFamily: SANS, fontWeight: 800, fontSize: 44, letterSpacing: 0.5,
        boxShadow: '0 16px 60px rgba(245,184,61,0.35)',
      }}>
        $12 · gumroad.com/l/sbiozo
      </div>
    </AbsoluteFill>
  );
};

// ── SFX — reuse template's Mixkit kit, pinned to beats ──────────────
const SFX: { from: number; src: string; volume: number }[] = [
  { from: 8, src: 'whoosh-big.mp3', volume: 0.5 },     // line 1 lands
  { from: 36, src: 'impact-cine.mp3', volume: 0.5 },  // line 2 slams
  { from: 92, src: 'transition-soft.mp3', volume: 0.4 }, // → product page
  { from: 122, src: 'whoosh-fast.mp3', volume: 0.45 },   // push-in
  { from: 122, src: 'pop.mp3', volume: 0.4 },            // $12 badge
  { from: 212, src: 'swoosh-quick.mp3', volume: 0.4 },   // → hooks
  { from: 230, src: 'pop.mp3', volume: 0.38 },
  { from: 262, src: 'pop.mp3', volume: 0.34 },
  { from: 294, src: 'pop.mp3', volume: 0.3 },
  { from: 326, src: 'pop.mp3', volume: 0.28 },
  { from: 362, src: 'riser-cine.mp3', volume: 0.45 },   // → CTA
  { from: 402, src: 'impact-cine.mp3', volume: 0.55 },  // offer stamps
  { from: 420, src: 'sparkle.mp3', volume: 0.3 },       // URL glint
];

export const HookPackMain: React.FC = () => {
  const sfxDur = (s: { src: string }) => (s.src === 'riser-cine.mp3' ? 60 : 90);
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      {SFX.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={sfxDur(s)}>
          <Audio src={staticFile(`audio/${s.src}`)} volume={s.volume} />
        </Sequence>
      ))}
      <Sequence from={HP_SHOTS.hook.from} durationInFrames={HP_SHOTS.hook.duration}><SceneHook /></Sequence>
      <Sequence from={HP_SHOTS.product.from} durationInFrames={HP_SHOTS.product.duration}><SceneProduct /></Sequence>
      <Sequence from={HP_SHOTS.hooks.from} durationInFrames={HP_SHOTS.hooks.duration}><SceneHooks /></Sequence>
      <Sequence from={HP_SHOTS.cta.from} durationInFrames={HP_SHOTS.cta.duration}><SceneCTA /></Sequence>
    </AbsoluteFill>
  );
};
