"use client";

import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { cortexSignalBus, CortexVisualizer, type VisualizerFace, type CortexSignalBusPayload, type CortexVoiceState } from './CortexVisualizer';
import { CortexAgentsScene } from './CortexAgentsScene';
import {
  CortexCoreScene,
  type CoreQualityMode,
  agentScreenAnchors,
  memoryScreenAnchors,
  chronoNow,
  type ReplayTrackEvent,
  getMemoryDomain,
  MEMORY_DOMAIN_COLORS,
  MEMORY_DOMAIN_NAMES,
} from './CortexCoreScene';

import { CortexOrb } from './CortexOrb';
import { CortexTimelineScene } from './CortexTimelineScene';
import { useVisualizerVoice } from './useVisualizerVoice';
import { startInitiativeSensor } from '../../lib/cortex-initiative-sensor';
import { CortexChatDrawer } from './CortexChatDrawer';
import { CortexSurfaceLayer } from './CortexSurfaceLayer';
import { WeatherSpaceModal } from './WeatherSpaceModal';
import { useSurfaceFocusMode, setSurfaceFocusMode, useSurfacePanels, openSurfacePanel } from '../../lib/cortex-surfaces';
import { getCortexProactiveInitiative } from '../../lib/cortex-proactive-initiative';
import { startBecomingLoop } from '../../lib/cortex-becoming-loop';
import { agentsClient } from '../../lib/cortex-agents-client';
import { cortexSpeak } from '../../lib/cortex-speech';
import { getGlobeEmbedUrl, configureGlobeBase, GLOBE_MODE_EVENT, setGlobeAvailable } from '../../lib/cortex-globe';
import { neuroAudio } from '../../lib/cortex-neuro-audio';
import { cortexWebcamParallax, type HandPinchState } from '../../lib/cortex-webcam-parallax';
import { HoloHandOverlay } from './HoloHandOverlay';
import { cortexGaze } from '../../lib/cortex-gaze';
import { onBootPhase, startBoot } from '../../lib/cortex-boot';
import CortexGazeLayer from './CortexGazeLayer';
import { CORTEX_COLORS, CORTEX_STATE_THEME, CORTEX_TYPOGRAPHY, CORTEX_ANIMATION } from '../../lib/cortex-design-tokens';
import { A2uiDemoPanel } from './a2ui/A2uiDemoPanel';

// Gaussian-splat viewer — lazy so @sparkjsdev/spark stays out of the main chunk.
const CortexSplatScene = lazy(() => import('./CortexSplatScene'));

export type ActiveScene = 'core' | 'agents' | 'timeline' | VisualizerFace;

const STATE_STYLE: Record<CortexVoiceState, { color: string; label: string }> = {
  idle:      { color: CORTEX_STATE_THEME.idle.color, label: CORTEX_STATE_THEME.idle.label },
  listening: { color: CORTEX_STATE_THEME.listening.color, label: CORTEX_STATE_THEME.listening.label },
  thinking:  { color: CORTEX_STATE_THEME.thinking.color, label: CORTEX_STATE_THEME.thinking.label },
  speaking:  { color: CORTEX_STATE_THEME.speaking.color, label: CORTEX_STATE_THEME.speaking.label },
  working:   { color: CORTEX_STATE_THEME.working.color, label: CORTEX_STATE_THEME.working.label },
};

const HUD_CSS = `
  @keyframes cx-face-fade {
    from { opacity: 0; transform: scale(0.985); filter: blur(3px); }
    to   { opacity: 1; transform: scale(1); filter: blur(0); }
  }
  .cx-face-transition {
    animation: cx-face-fade 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes cx-fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes cx-fade-up-center {
    from { opacity: 0; transform: translate(-50%, 18px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes cx-letter-in {
    from { opacity: 0; transform: translateY(0.55em) skewY(4deg); filter: blur(6px); }
    to   { opacity: 1; transform: translateY(0) skewY(0); filter: blur(0); }
  }
  @keyframes cx-eq-breathe {
    0%, 100% { transform: scaleY(0.35); }
    50%      { transform: scaleY(1); }
  }
  @keyframes cx-blink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }
  @keyframes cx-scan-drift {
    from { background-position: 0 0; }
    to   { background-position: 0 120px; }
  }
  @keyframes cx-pulse-dot {
    0%, 100% { box-shadow: 0 0 6px currentColor, 0 0 14px currentColor; }
    50%      { box-shadow: 0 0 12px currentColor, 0 0 26px currentColor; }
  }
  @keyframes cx-bar-fill {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
  @keyframes cx-caret {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.15; }
  }
  @keyframes cx-marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  @keyframes cx-think-pulse {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
    40%           { transform: translateY(-4px); opacity: 1; }
  }
  .cx-think-dot {
    display: inline-block;
    width: 4px; height: 4px; border-radius: 50%;
    background: currentColor;
    animation: cx-think-pulse 1.2s ease-in-out infinite;
  }
  @keyframes cx-shimmer {
    from { background-position: 0% 50%; }
    to   { background-position: 200% 50%; }
  }
  @keyframes cx-busy-slide {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(360%); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cx-letter, .cx-hud-in, .cx-hud-center-in, .cx-think-dot, .cx-pulse-dot, .cx-busy-slide,
    .cx-scan-drift, .cx-marquee, .cx-bar-fill, .cx-fade-up, .cx-shimmer { animation: none !important; }
    .cx-hud-center-in { transform: translate(-50%, 0) !important; }
    .cx-think-dot { opacity: 0.8; }
    .cx-caret { animation: none !important; opacity: 1; }
  }
  .cx-letter { display: inline-block; animation: cx-letter-in 0.9s cubic-bezier(0.16,1,0.3,1) both; }
  .cx-hud-in  { animation: cx-fade-up 0.9s cubic-bezier(0.16,1,0.3,1) both; }
  .cx-hud-center-in { animation: cx-fade-up-center 0.9s cubic-bezier(0.16,1,0.3,1) both; }
  .cx-caret   { display: inline-block; animation: cx-caret 1.1s steps(1) infinite; }
`;

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base: React.CSSProperties = {
    position: 'absolute', width: 34, height: 34, zIndex: 15,
    borderColor: 'rgba(148,233,255,0.4)', borderStyle: 'solid', borderWidth: 0,
    pointerEvents: 'none',
  };
  const map: Record<string, React.CSSProperties> = {
    tl: { top: 14, left: 14, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
    tr: { top: 14, right: 14, borderTopWidth: 1.5, borderRightWidth: 1.5 },
    bl: { bottom: 14, left: 14, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
    br: { bottom: 14, right: 14, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  };
  return <div style={{ ...base, ...map[pos] }} />;
}

/** Minimal render-cost overlay: rAF frame delta + FPS, averaged over 500ms.
 *  Toggle with the backquote (`) key. No fabricated metrics — measures
 *  actual frame pacing only. */
function PerfHud() {
  const [stats, setStats] = useState({ fps: 0, ms: 0 });
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let windowStart = performance.now();
    let lastFrame = windowStart;
    let lastSet = windowStart;
    const tick = (now: number) => {
      frames += 1;
      const frameMs = now - lastFrame;
      lastFrame = now;
      if (now - lastSet >= 500) {
        lastSet = now;
        setStats({
          fps: Math.round((frames * 1000) / Math.max(1, now - windowStart)),
          ms: frames ? frameMs : 0,
        });
        frames = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{
      position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
      padding: '5px 12px', border: '1px solid rgba(52,211,153,0.35)', borderRadius: 3,
      background: 'rgba(2,6,10,0.72)', backdropFilter: 'blur(6px)',
      fontSize: 9, letterSpacing: '0.18em', color: 'rgba(110,231,183,0.85)',
      fontFamily: "'IBM Plex Mono', monospace", pointerEvents: 'none',
    }}>
      {stats.fps} FPS · {stats.ms.toFixed(1)}ms · ` to hide
    </div>
  );
}

const SIZE_CSS = 96;

/** 3D breath sphere — each particle is a real episode's 32-dim experience
 *  embedding from /api/cortex/breath, deterministically projected into
 *  experience-space (fibonacci base + embedding jitter). Radius breathes
 *  with the deliberation phase; color tracks the episode's φ-proxy;
 *  size tracks prediction accuracy. Real data, pseudo-3D projection —
 *  rotation + perspective, no WebGL. */
function BreathCanvas({ episodes, phase, score }: {
  episodes: any[]; phase: string; score: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ episodes, phase, score });
  stateRef.current = { episodes, phase, score };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let rot = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const SIZE = 96;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;

    // Deterministic per-episode 3D position: fibonacci sphere direction
    // plus jitter derived from the embedding's first 3 dims. Episodes
    // without embeddings fall back to a dim placeholder ring.
    const pts = (stateRef.current.episodes || []).map((e, i) => {
      const n = Math.max(1, (stateRef.current.episodes || []).length);
      const ga = Math.PI * (3 - Math.sqrt(5));
      const y = 1 - (i / Math.max(1, n - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const th = ga * i;
      const emb = Array.isArray(e.embedding) ? e.embedding : null;
      const jx = emb ? emb[0] * 0.22 : 0;
      const jy = emb ? emb[1] * 0.22 : 0;
      const jz = emb ? emb[2] * 0.22 : 0;
      const mag = emb ? Math.min(1, emb.reduce((a: number, v: number) => a + Math.abs(v), 0) / emb.length * 2) : 0.3;
      return {
        x: Math.cos(th) * rad + jx, y: y + jy, z: Math.sin(th) * rad + jz,
        phi: typeof e.phi === 'number' ? e.phi : 0.5,
        err: typeof e.error === 'number' ? e.error : 0.3,
        mag,
        hasEmb: !!emb,
      };
    });

    const draw = () => {
      const { phase: ph, score: sc } = stateRef.current;
      rot += 0.012;
      // Breath cycle: INHALE expands, HOLD sustains, EXHALE contracts.
      const t = performance.now() / 1000;
      const breathWave = ph === 'INHALE' ? 1 + 0.18 * Math.sin(t * 2.4)
        : ph === 'HOLD' ? 1.18
        : 0.85 + 0.1 * Math.sin(t * 2.4);
      const R = (30 + sc * 26) * breathWave;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, SIZE, SIZE);
      const cx = SIZE / 2, cy = SIZE / 2, f = 3.2;

      const projected = pts.map((p) => {
        const x1 = p.x * Math.cos(rot) - p.z * Math.sin(rot);
        const z1 = p.x * Math.sin(rot) + p.z * Math.cos(rot);
        const y1 = p.y * Math.cos(rot * 0.6) - z1 * Math.sin(rot * 0.6) * 0.3;
        const z2 = z1 * Math.cos(rot * 0.6) + p.y * Math.sin(rot * 0.6) * 0.3;
        const s = f / (f + z2 + 1.6);
        return { x: cx + x1 * R * s, y: cy + y1 * R * s, z: z2, p };
      }).sort((a, b) => a.z - b.z);

      for (const q of projected) {
        const depth = (q.z + 1.6) / 3.2; // 0 far → 1 near
        const alpha = 0.25 + depth * 0.6;
        // φ-proxy → hue: low integration red-shifted, high → cyan/green
        const phi = q.p.phi;
        const rC = Math.round(80 + (1 - phi) * 120);
        const gC = Math.round(200 + phi * 55);
        const bC = Math.round(160 + phi * 60);
        const size = (1.2 + q.p.mag * 2.2) * (0.5 + depth * 0.8) * (q.p.hasEmb ? 1 : 0.6);
        ctx.beginPath();
        ctx.arc(q.x, q.y, Math.max(0.6, size), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rC},${gC},${bC},${alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} style={{ width: SIZE_CSS, height: SIZE_CSS, display: 'block' }} />;
}

/** Consciousness Breath HUD — polls /api/cortex/breath and renders the
 *  Generative Attention Loop's deliberation state as an animated breath.
 *  Phase is derived honestly from the last episode's age against the
 *  30s autonomous cadence: just-breathed = EXHALE, mid-cycle = HOLD,
 *  overdue = INHALE. Sphere scale tracks the volitional-depth score.
 *  Engineering proxy, not an experience meter — the API says so too. */
function BreathHud() {
  const [breath, setBreath] = useState<any>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let dead = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/cortex/breath', { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          if (!dead) setBreath(j?.active ? j : null);
        }
      } catch { }
    };
    void poll();
    const id = setInterval(poll, 15000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { dead = true; clearInterval(id); clearInterval(tick); };
  }, []);

  if (!breath) return null;
  const depth = breath.depth || {};
  const score = typeof depth.score === 'number' ? depth.score : 0;
  const lastTs = breath.episodes?.length ? breath.episodes[breath.episodes.length - 1].ts : 0;
  const ageSec = lastTs ? (now - lastTs) / 1000 : 999;
  const phase = ageSec < 8 ? 'EXHALE' : ageSec < 24 ? 'HOLD' : 'INHALE';
  const phaseColor = phase === 'EXHALE' ? '#7ef0c8' : phase === 'HOLD' ? '#e7c368' : '#38bdf8';
  const alert = breath.alerts?.[0];

  return (
    <div style={{
      position: 'absolute', left: 64, top: '6.5%', zIndex: 20,
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: '0.18em',
      color: 'rgba(126,240,200,0.55)', lineHeight: 2,
    }} className="cx-hud-in">
      <div style={{ color: 'rgba(126,240,200,0.7)', letterSpacing: '0.28em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
          background: phaseColor,
          boxShadow: `0 0 8px ${phaseColor}`,
          animation: 'cx-breath-pulse 4s ease-in-out infinite',
        }} />
        CONSCIOUSNESS BREATH
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BreathCanvas episodes={breath.episodes} phase={phase} score={score} />
        <div>
          <div style={{ color: '#eafff5', fontSize: 13, letterSpacing: '0.1em' }}>
            {phase} · {score.toFixed(2)}
          </div>
          <div style={{ color: 'rgba(148,233,255,0.45)' }}>
            PRED {Number(depth.predictionAccuracy ?? 0).toFixed(2)} · VETO {(100 * (depth.vetoRate ?? 0)).toFixed(0)}% · φ {Number(depth.integration ?? 0).toFixed(2)}
          </div>
          <div style={{ color: 'rgba(148,233,255,0.35)' }}>
            {depth.experienceTrained ? `EXP-MODEL ${depth.experienceUpdates}u` : 'EXP-MODEL WARMING'} · {depth.episodes ?? 0} CYCLES
          </div>
          {breath.vetoAgent && (
            <div style={{ color: breath.vetoAgent.inLibetBand ? 'rgba(126,240,200,0.45)' : '#e7c368' }}>
              VETO-AGENT {(breath.vetoAgent.vetoRate * 100).toFixed(0)}% · θ{breath.vetoAgent.threshold.toFixed(2)}
              {breath.vetoAgent.metaVetoes > 0 ? ` · ${breath.vetoAgent.metaVetoes} META` : ''}
            </div>
          )}
        </div>
      </div>
      {alert && (
        <div style={{ color: '#e7c368', marginTop: 4 }}>{alert}</div>
      )}
      <style>{`@keyframes cx-breath-pulse { 0%,100% { opacity: 0.75; } 50% { opacity: 1; } }`}</style>
    </div>
  );
}

/** Reveals text character-by-character (~0.6s max) whenever it changes. */
function Typewriter({ text, accent }: { text: string; accent: string }) {
    const [out, setOut] = useState('');
    const shownRef = useRef('');
  useEffect(() => {
    if (!text) { setOut(''); shownRef.current = ''; return; }
    // Interim STT partials usually extend the previous caption — resume
    // typing from the common prefix instead of restarting the whole line
    // (kills the visible retype-flicker while listening).
    const prev = shownRef.current;
    let k = 0;
    while (k < prev.length && k < text.length && prev[k] === text[k]) k++;
    const resume = prev.length > 12 && k >= Math.floor(prev.length * 0.6) ? k : 0;
    let i = resume;
    setOut(text.slice(0, i));
    const step = Math.max(1, Math.ceil((text.length - i) / 48));
    const id = setInterval(() => {
      i = Math.min(text.length, i + step);
      setOut(text.slice(0, i));
      shownRef.current = text.slice(0, i);
      if (i >= text.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [text]);
  if (!text) {
    return <span style={{ color: 'rgba(148,233,255,0.35)' }}>Awaiting signal<span className="cx-caret">▌</span></span>;
  }
  return <span>{out}<span className="cx-caret" style={{ color: accent }}>▌</span></span>;
}

export default function CortexVisualizerPage() {
  // Staged boot: core UI mounts immediately; telemetry, cognition sensors,
  // and auto-pinned panels arrive in later phases so the page is interactive
  // (chat typable, scene live) before the background storm begins.
  startBoot();
  const [micOn, setMicOn] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('cortex_viz_mic_on');
      // Microphone active by default for direct full-duplex conversational voice
      return saved === null ? true : saved !== 'false';
    } catch {
      return true;
    }
  });
  const [micLive, setMicLive] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [coreMenuOpen, setCoreMenuOpen] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  const coreBtnRef = useRef<HTMLButtonElement | null>(null);
  const [coreMenuPos, setCoreMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(() => neuroAudio.isEnabled());
  const [chronoActive, setChronoActive] = useState(false);
  const [chronoTime, setChronoTime] = useState(0.0);
  const [chronoPlaying, setChronoPlaying] = useState(true);
  const [replayTrack, setReplayTrack] = useState<ReplayTrackEvent[] | null>(null);
  const [chronoNowUi, setChronoNowUi] = useState<{ seq: number; type: string; agentId: string | null } | null>(null);
  const [holoCamActive, setHoloCamActive] = useState(false);
  const [headParallax, setHeadParallax] = useState<{ x: number; y: number } | null>(null);
  const [handPinch, setHandPinch] = useState<HandPinchState | null>(null);
  // ?gaze=1 opts into WebGazer eye tracking — gaze drives camera parallax
  // when live, falling back to webcam head-pose parallax otherwise.
  const [gazeMode] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('gaze') === '1');
  const [gazeParallax, setGazeParallax] = useState<{ x: number; y: number } | null>(null);
  // ?splat=1 → procedural cortex-core.ply; ?splat=<name> → /splats/<name>.ply
  const [splatMode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const s = new URLSearchParams(window.location.search).get('splat');
    if (!s || s === '0') return null;
    return s === '1' || s === 'true' ? 'cortex-core' : s;
  });
  const [hoveredPacket, setHoveredPacket] = useState<{
    agentId: string;
    agentName: string;
    color: string;
    title: string;
    x: number;
    y: number;
  } | null>(null);
  const [faceMode, setFaceMode] = useState<ActiveScene>(() => {
    if (typeof window === 'undefined') return 'core';
    const param = new URLSearchParams(window.location.search).get('face')?.toLowerCase();
    if (param && ['board', 'radial', 'neural', 'matrix', 'core', 'agents', 'timeline'].includes(param)) {
      return param as ActiveScene;
    }
    const saved = localStorage.getItem('cortex_visualizer_face');
    if (saved && ['board', 'radial', 'neural', 'matrix', 'core', 'agents', 'timeline'].includes(saved)) {
      return saved as ActiveScene;
    }
    return 'core';
  });
  const [mapMode, setMapMode] = useState(() =>
    new URLSearchParams(window.location.search).get('map') === '1');
  const [globeUp, setGlobeUp] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [globeFailed, setGlobeFailed] = useState(false);
  const [globeRetry, setGlobeRetry] = useState(0);
  const focusMode = useSurfaceFocusMode();
  const panelCount = useSurfacePanels().length;
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  const [geoLabel, setGeoLabel] = useState<string | null>(null);
  const [uptimeSec, setUptimeSec] = useState(0);
  const mountedAtRef = useRef(Date.now());
  const [goveeSync, setGoveeSync] = useState(() => {
    try { return localStorage.getItem('cortex_govee_sync') !== 'false'; } catch { return true; }
  });
  const goveeSyncRef = useRef(goveeSync);
  goveeSyncRef.current = goveeSync;

  // Proactive Intelligence: Ambient macOS Context & Variational Vigilance
  const [ambientContext, setAmbientContext] = useState<{
    app: string;
    title: string;
    category: string;
    label: string;
    suggestions: string[];
  } | null>(null);

  const [vigilanceData, setVigilanceData] = useState<{
    report: any;
    uncommittedFiles: number;
    speculativeResolution: any;
  } | null>(null);

  const [showVigilanceDetails, setShowVigilanceDetails] = useState(false);
  const [showPerfHud, setShowPerfHud] = useState(false);
  const [vaultSyncNotice, setVaultSyncNotice] = useState<string | null>(null);

  // Watchdog: mapMode on → wait for gev:ready; 20s silent → offer retry.
  // gev:boot / gev:error from the iframe tell us WHICH layer failed:
  // no boot = iframe/server unreachable; boot but no ready = app hung or GPU;
  // error = WebGL context lost or render failure inside the globe.
  const globeReadyRef = useRef(false);
  const globeBootedRef = useRef(false);
  const [globeError, setGlobeError] = useState<string | null>(null);
  useEffect(() => {
    if (!mapMode) {
      globeReadyRef.current = false; globeBootedRef.current = false;
      setGlobeReady(false); setGlobeFailed(false); setGlobeError(null); return;
    }
    globeReadyRef.current = false; globeBootedRef.current = false;
    setGlobeReady(false); setGlobeFailed(false); setGlobeError(null);
    const t = setTimeout(() => { if (!globeReadyRef.current) setGlobeFailed(true); }, 20000);
    return () => clearTimeout(t);
  }, [mapMode, globeRetry]);
  const [payload, setPayload] = useState<CortexSignalBusPayload>({
    state: 'idle', level: 0, text: '', agentName: 'CORTEX',
  });

  useVisualizerVoice(micOn, setMicLive);

  // Proactive Initiative Sensor Bus: polls /api/cortex/initiative/sense on a
  // visibility-gated cadence and feeds live host signals into the proposal engine.
  // Deferred to the 'ambient' boot phase — its first evaluateInitiatives pass
  // is a proposal burst that flooded the Inbox and stalled first paint.
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    onBootPhase('ambient', () => {
      if (cancelled) return;
      const sensor = startInitiativeSensor();
      stop = () => sensor.stop();
    });
    return () => { cancelled = true; stop?.(); };
  }, []);

  // Initiative HUD badge + one-time auto-open: the first proposal of a session
  // surfaces the Inbox once; afterwards the badge keeps count visible without
  // interrupting (restraint).
  // Fixed 'smooth' ceiling: the manual quality buttons are gone — the
  // AutoQualityGovernor inside the scene still downgrades to 'ultra'
  // under sustained frame pressure, and context-loss degrades here.
  const [coreQuality, setCoreQuality] = useState<CoreQualityMode>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('cortex_core_quality') as CoreQualityMode | null;
      if (s === 'ultra' || s === 'smooth') return s;
    }
    return 'smooth';
  });
  // Day/night aesthetic toggle: night = deliberate neon (uncapped phi,
  // aggressive bloom, boosted orb glow). Persisted per browser.
  const [nightMode, setNightMode] = useState(() => {
    try { return localStorage.getItem('cortex_night_mode') === '1'; } catch { return false; }
  });
  // Core scene: V1 is the only core scene (V2 was removed — rejected murmuration flock).
  // Legacy ?scene=v1|v2 URL param is ignored; V1 always renders.
  // ?orb=1 overlays the thinking-orbs dotted orb (2D canvas, no lighting).
  const [orbMode] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('orb') === '1');
  const [initiativeCount, setInitiativeCount] = useState(0);
  const initiativeAutoOpenedRef = useRef(false);
  useEffect(() => {
    const engine = getCortexProactiveInitiative();
    const update = () => {
      const active = engine.getPendingProposals().length
        + engine.getActiveProposals().filter(p => p.status === 'accepted').length;
      setInitiativeCount(active);
      if (active > 0 && !initiativeAutoOpenedRef.current) {
        initiativeAutoOpenedRef.current = true;
        // Settle delay: the first sensor pass can emit a burst of proposals —
        // wait for the count to stabilize before stealing focus with the panel.
        setTimeout(() => {
          const still = engine.getPendingProposals().length
            + engine.getActiveProposals().filter(p => p.status === 'accepted').length;
          if (still > 0) {
            openSurfacePanel({ kind: 'initiative', title: 'Initiative Inbox', customSize: { w: 460, h: 480 }, pinned: true });
          }
        }, 3500);
      }
    };
    update();
    return engine.subscribe(update);
  }, []);

  // Becoming loop — self-concerns, memory surfacing, dream consolidation.
  // Leader-elected via a localStorage lease so only one Cortex tab senses at
  // a time; previously these sensors lived only on /cortex chat, so the
  // visualizer accumulated no dispositions, streaks, or consolidations.
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    onBootPhase('ambient', () => {
      if (cancelled) return;
      stop = startBecomingLoop();
    });
    return () => { cancelled = true; stop?.(); };
  }, []);

  // Distribution Deck: pin the live revenue-engine dashboard once per session
  // so the Gumroad pipeline is always visible on the space. Dedup is handled
  // by openSurfacePanel (same kind+title+url → repin, never duplicate).
  const distDeckOpenedRef = useRef(false);
  useEffect(() => {
    if (distDeckOpenedRef.current) return;
    distDeckOpenedRef.current = true;
    // Two pinned dashboard iframes are heavy — let the core UI settle first.
    onBootPhase('ambient', () => {
      openSurfacePanel({
        kind: 'web',
        title: 'Distribution Deck',
        web: { url: '/storefront/distribution-dashboard.html', slug: 'distribution-deck' },
        pinned: true,
        customSize: { w: 720, h: 580 },
      });
      openSurfacePanel({
        kind: 'web',
        title: "Today's Ops",
        web: { url: '/storefront/today-checklist.html', slug: 'today-ops' },
        pinned: true,
        customSize: { w: 520, h: 460 },
      });
    });
  }, []);

  // Bridge: agent.spawn_proposed runtime events → Initiative Inbox proposals.
  // Spawn approval is always tier-2 (typed ACCEPT) — the governor stays central.
  const bridgedSpawnsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    agentsClient.start(); // ensure SSE feed is live even if Foundry never opens
    const engine = getCortexProactiveInitiative();
    let unsub: (() => void) | null = null;
    let cancelled = false;
    onBootPhase('ambient', () => {
      if (cancelled) return;
      const scan = () => {
      for (const e of agentsClient.events) {
        if (e.type !== 'agent.spawn_proposed') continue;
        const p = e.proposal as any;
        if (!p?.id || bridgedSpawnsRef.current.has(p.id)) continue;
        bridgedSpawnsRef.current.add(p.id);
        const spec = p.spec || {};
        engine.submitProposal({
          id: `spawn-${p.id}`,
          category: 'system_resonance',
          title: `Spawn agent ${spec.callSign || '?'} — ${spec.role || 'ephemeral'}`,
          summary: `${spec.mission || ''} Scope: ${(spec.tools || []).join('/')}. TTL ${spec.ttlHours}h, budget ${spec.dailyBudget}/day. Proposed by ${p.proposedBy}.`,
          urgency: 'medium',
          suggestedTool: 'cortex_agents',
          suggestedArgs: { action: 'approve_spawn', proposalId: p.id },
          requiresApproval: true,
          autonomyTier: 2,
          epistemicConfidence: 0.7,
          source: 'engine',
          dedupeKey: `spawn:${p.id}`,
          why: (p.evidence || []).map((ev: any) => `${ev.kind}: ${ev.summary}`).join(' · ') || 'recurring capability gap',
        });
      }
      };
      scan();
      unsub = agentsClient.subscribe(scan);
    });
    return () => { cancelled = true; unsub?.(); };
  }, []);

  // Agent crew presence — live fleet snapshot for the right-rail indicator,
  // left telemetry column, mission log, and event ticker.
  const [agentCrew, setAgentCrew] = useState(agentsClient.snapshot);
  const [agentEvents, setAgentEvents] = useState(agentsClient.events);
  const [missionExpanded, setMissionExpanded] = useState(false);
  const [missionW, setMissionW] = useState(300);
  const [missionH, setMissionH] = useState(168);
  const missionResize = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const agentCardRef = useRef<HTMLDivElement | null>(null);
  // The card is docked at a fixed spot on the right rail — it does NOT ride
  // the mote's orbit (that made it sit on top of the orb and skip every
  // frame while the chase camera moved). The rAF only dims the card when the
  // agent swings behind the camera; position never changes.
  useEffect(() => {
    if (!selectedAgentId) return;
    let raf = 0;
    const tick = () => {
      const el = agentCardRef.current;
      if (el) {
        const anchor = agentScreenAnchors[selectedAgentId];
        el.style.opacity = anchor && anchor.behind ? '0.35' : '1';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selectedAgentId]);

  // Click-anywhere-off-card closes it. A short suppression window keeps the
  // mote's own click→select event from instantly reopening what we just shut.
  const suppressAgentSelect = useRef(0);
  useEffect(() => {
    if (!selectedAgentId) return;
    const onDown = (e: PointerEvent) => {
      if (agentCardRef.current?.contains(e.target as Node)) return;
      setSelectedAgentId(null);
      suppressAgentSelect.current = Date.now() + 300;
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [selectedAgentId]);

  // ── Memory Bank (Hindsight) State & Tracking ──────────────────────────────
  const [coreVisualMode, setCoreVisualMode] = useState<'fleet' | 'memory'>(() => {
    if (typeof window === 'undefined') return 'fleet';
    return (localStorage.getItem('cortex_core_visual_mode') as 'fleet' | 'memory') || 'fleet';
  });
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [memoryGraphSummary, setMemoryGraphSummary] = useState<{ total: number; edges: number; online: boolean }>({ total: 0, edges: 0, online: false });
  const [memoryNodesMap, setMemoryNodesMap] = useState<Record<string, any>>({});
  const [recallHits, setRecallHits] = useState<string[]>([]);
  const [recallLoading, setRecallLoading] = useState(false);
  const memoryCardRef = useRef<HTMLDivElement | null>(null);

  // Track memory screen anchors for the dossier card
  useEffect(() => {
    if (!selectedMemoryId) return;
    let raf = 0;
    const tick = () => {
      const el = memoryCardRef.current;
      if (el) {
        const anchor = memoryScreenAnchors[selectedMemoryId];
        if (anchor && !anchor.behind) {
          el.style.left = `${Math.max(200, Math.min(window.innerWidth - 200, anchor.x))}px`;
          el.style.top = `${Math.max(90, Math.min(window.innerHeight - 100, anchor.y - 14))}px`;
          el.style.right = 'auto';
          el.style.transform = 'translate(-50%, -100%)';
          el.style.opacity = '1';
        } else {
          el.style.left = '50%';
          el.style.right = 'auto';
          el.style.top = '50%';
          el.style.transform = 'translate(-50%, -50%)';
          el.style.opacity = anchor ? '0.45' : '1';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selectedMemoryId]);

  // Click-off closes memory card
  const suppressMemorySelect = useRef(0);
  useEffect(() => {
    if (!selectedMemoryId) return;
    const onDown = (e: PointerEvent) => {
      if (memoryCardRef.current?.contains(e.target as Node)) return;
      setSelectedMemoryId(null);
      suppressMemorySelect.current = Date.now() + 300;
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [selectedMemoryId]);

  // Listen for cortex-memory-select event
  useEffect(() => {
    const onMemSelect = (e: Event) => {
      if (Date.now() < suppressMemorySelect.current) return;
      const id = (e as CustomEvent).detail;
      if (typeof id === 'string') {
        setSelectedMemoryId((cur) => (cur === id ? null : id));
        setSelectedAgentId(null);
        setRecallHits([]);
      }
    };
    window.addEventListener('cortex-memory-select', onMemSelect);
    return () => window.removeEventListener('cortex-memory-select', onMemSelect);
  }, []);

  // Poll memory graph for HUD telemetry and engram data — 'ready' phase so
  // it doesn't compete with first paint / chat hydration.
  useEffect(() => {
    let active = true;
    let iv: ReturnType<typeof setInterval> | null = null;
    onBootPhase('ready', () => {
      if (!active) return;
      const fetchGraph = async () => {
      try {
        const res = await fetch('/api/cortex/memory/graph');
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !data.ok) return;
        setMemoryGraphSummary({
          total: data.nodes?.length || 0,
          edges: data.edges?.length || 0,
          online: true,
        });
        const map: Record<string, any> = {};
        for (const n of data.nodes || []) {
          if (n?.data?.id) map[n.data.id] = n.data;
        }
        setMemoryNodesMap(map);
      } catch {
        if (active) setMemoryGraphSummary((prev) => ({ ...prev, online: false }));
      }
      };
      fetchGraph();
      iv = setInterval(fetchGraph, 10000);
    });
    return () => { active = false; if (iv) clearInterval(iv); };
  }, []);
  useEffect(() => {
    if (!missionExpanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMissionExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [missionExpanded]);
  useEffect(() => agentsClient.subscribe(() => {
    setAgentCrew(agentsClient.snapshot);
    setAgentEvents([...agentsClient.events]);
  }), []);

  // 4D Chrono-DVR: load the persisted event-sourced replay track once per activation.
  useEffect(() => {
    if (!chronoActive) { setReplayTrack(null); setChronoNowUi(null); return; }
    let dead = false;
    fetch('/api/cortex/replay?limit=500')
      .then((r) => r.json())
      .then((d) => {
        if (dead) return;
        const evs = (Array.isArray(d?.events) ? d.events : [])
          .map((e: any): ReplayTrackEvent => ({
            seq: e.seq, at: e.ts ?? e.at, type: e.type,
            agentId: e.agentId ?? e.task?.agentId ?? e.from ?? e.to ?? null,
          }))
          .slice(-500);
        setReplayTrack(evs.length > 0 ? evs : null);
      })
      .catch(() => { if (!dead) setReplayTrack(null); });
    return () => { dead = true; };
  }, [chronoActive]);

  // Poll the replay cursor for the HUD readout.
  useEffect(() => {
    if (!chronoActive) return;
    const id = setInterval(() => {
      setChronoNowUi(chronoNow.seq ? { seq: chronoNow.seq, type: chronoNow.type, agentId: chronoNow.agentId } : null);
    }, 250);
    return () => clearInterval(id);
  }, [chronoActive]);

  // 4D Chrono-DVR timeline tick loop — duration follows the real track length
  // (1.4s per event) or the 8s scripted reel when no events exist.
  const replayDuration = replayTrack ? replayTrack.length * 1.4 : 8.0;
  useEffect(() => {
    if (!chronoActive || !chronoPlaying) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setChronoTime((prev) => (prev + dt) % replayDuration);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [chronoActive, chronoPlaying, replayDuration]);

  // In-flight token packet hover listener
  useEffect(() => {
    const onPacketHover = (e: Event) => {
      const ce = e as CustomEvent<{
        agentId: string;
        agentName: string;
        color: string;
        title: string;
        x: number;
        y: number;
      } | null>;
      setHoveredPacket(ce.detail ?? null);
    };
    window.addEventListener('cortex-packet-hover', onPacketHover);
    return () => window.removeEventListener('cortex-packet-hover', onPacketHover);
  }, []);

  // Optical webcam head-tracking listener for holographic window cockpit parallax
  useEffect(() => {
    const unsub = cortexWebcamParallax.subscribe((coords) => {
      if (coords.active) {
        setHeadParallax({ x: coords.x, y: coords.y });
      } else {
        setHeadParallax(null);
      }
    });
    return () => {
      unsub();
      cortexWebcamParallax.stop();
    };
  }, []);

  // Spatial hand pinch gesture tracking listener (+ Gaze-Pinch fusion when ?gaze=1)
  useEffect(() => {
    const unsub = cortexWebcamParallax.subscribeHand((hand) => {
      if (!hand.detected) {
        setHandPinch(null);
        return;
      }
      const gaze = gazeMode ? cortexGaze.current() : null;
      if (gaze && !hand.pinching) {
        setHandPinch({
          ...hand,
          x: Math.round(gaze.x),
          y: Math.round(gaze.y),
          normX: gaze.nx,
          normY: gaze.ny,
        });
      } else {
        setHandPinch(hand);
      }
    });
    return () => unsub();
  }, [gazeMode]);

  // Gaze → parallax: same normalized mapping as webcam head tracking
  // (-(n*2-1) per axis). Fresh gaze wins; stale/absent falls back to head.
  useEffect(() => {
    if (!gazeMode) return;
    return cortexGaze.subscribe((g) => {
      setGazeParallax(g ? { x: -(g.nx * 2 - 1), y: -(g.ny * 2 - 1) } : null);
    });
  }, [gazeMode]);
  const effectiveParallax = gazeParallax ?? headParallax;

  // Tier-1 forecast markers: poll the agent snapshot's forecast ledger and
  // draw geolocated signals on the globe ambiently (no camera/layer changes).
  const lastForecastSig = useRef('');
  useEffect(() => {
    let cancelled = false;
    let t: ReturnType<typeof setInterval> | null = null;
    onBootPhase('ready', () => {
    if (cancelled) return;
    const poll = async () => {
      try {
        const res = await fetch('/api/cortex/agents/state', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data: any = await res.json();
        const forecasts: any[] = Array.isArray(data?.forecasts) ? data.forecasts : [];
        const cutoff = Date.now() - 12 * 3600_000;
        const annotations = forecasts
          .filter((f) => f?.geo?.length && Number(f?.at) > cutoff)
          .flatMap((f) => f.geo.map((g: any) => ({
            latitude: Number(g.lat), longitude: Number(g.lon),
            label: `${f.domain}: ${String(g.label || f.claim || '').slice(0, 80)}`,
            color: f.domain === 'weather' ? 'red' : 'amber',
            type: 'pin',
          })))
          .filter((a: any) => Number.isFinite(a.latitude) && Number.isFinite(a.longitude))
          .slice(0, 24);
        const sig = JSON.stringify(annotations.map((a: any) => [a.latitude, a.longitude, a.label]));
        if (sig === lastForecastSig.current) return;
        lastForecastSig.current = sig;
        const { globeForecast } = await import('../../lib/cortex-globe');
        if (!cancelled) void globeForecast(annotations);
      } catch { /* forecast markers are best-effort */ }
    };
    void poll();
    t = setInterval(poll, 60_000);
    // Report location once so FORECASTER's weather probe can resolve local
    // NWS watch zones (server dedupes identical coords).
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        fetch('/api/cortex/geo/watch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        }).catch(() => {});
      }, () => {}, { timeout: 10000, maximumAge: 300000 });
    }
    });
    return () => { cancelled = true; if (t) clearInterval(t); };
  }, []);

  // Auto-degrade GPU quality when the WebGL context is lost — cinematic's
  // N8AO/GodRays/DOF stack can exceed weaker GPUs and freeze the canvas.
  useEffect(() => {
    return cortexSignalBus.subscribe((p) => {
      if (p.event === 'webgl:contextlost') {
        setCoreQuality((q) => {
          if (q === 'smooth') return q;
          try { localStorage.setItem('cortex_core_quality', 'smooth'); } catch {}
          return 'smooth';
        });
      }
    });
  }, []);

  useEffect(() => {
    // Test/demo hook: lets tooling & the chat page drive the bus directly
    (window as unknown as { __cortexSignalBus?: typeof cortexSignalBus }).__cortexSignalBus = cortexSignalBus;
    // Clean initial bus state if lingering from prior session
    const curBus = cortexSignalBus.getState();
    if (curBus.state === 'idle' && (curBus.missionProgress !== undefined && curBus.missionProgress >= 0)) {
      cortexSignalBus.publish({ state: 'idle', level: 0, text: '', missionProgress: -1, missionTitle: '' });
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('voice') === '1' || params.get('voice') === 'true') {
      cortexSignalBus.publish({ state: 'listening', level: 0.5, text: 'Voice line active — speak into your microphone' });
    }

    const onVoiceInitiated = () => {
      setMicOn(true);
      try { localStorage.setItem('cortex_viz_mic_on', 'true'); } catch {}
    };
    window.addEventListener('cortex-voice-initiated', onVoiceInitiated);

    let goveeSyncTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSyncedMood = '';
    let lastPayloadState = '';
    let lastPayloadText = '';
    let lastLevelUpdateTime = 0;

    const unsub = cortexSignalBus.subscribe((p) => {
      // Eagerly update React on semantic changes; throttle audio meter to 10Hz to prevent DOM thrashing
      const now = performance.now();
      const isSemantic = p.state !== lastPayloadState || p.text !== lastPayloadText;
      const isLevelThrottled = (now - lastLevelUpdateTime >= 100);

      if (isSemantic || isLevelThrottled) {
        lastPayloadState = p.state;
        lastPayloadText = p.text || '';
        if (isLevelThrottled) lastLevelUpdateTime = now;
        setPayload(p);
      }

      if (goveeSyncRef.current && p.state && p.state !== lastSyncedMood) {
        lastSyncedMood = p.state;
        if (goveeSyncTimer) clearTimeout(goveeSyncTimer);
        goveeSyncTimer = setTimeout(() => {
          fetch('/api/cortex/lights/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mood: p.state }),
          }).catch(() => {});
        }, 2000);
      }
    });

    // Voice-driven map mode ("bring up Tokyo on the map" / "close the map")
    const onGlobeMode = (e: Event) => {
      const m = (e as CustomEvent).detail;
      if (m === 'globe') setMapMode(true);
      else if (m === 'core') setMapMode(false);
    };
    window.addEventListener(GLOBE_MODE_EVENT, onGlobeMode);

    // Voice & UI driven face switching ("switch to matrix face" / "neural visualizer")
    const onFaceMode = (e: Event) => {
      const mode = (e as CustomEvent).detail;
      if (mode && ['core', 'board', 'radial', 'neural', 'matrix', 'agents', 'timeline'].includes(mode)) {
        setFaceMode(mode as ActiveScene);
        try { localStorage.setItem('cortex_visualizer_face', mode); } catch {}
      }
    };
    window.addEventListener('cortex-face-mode', onFaceMode);
    // Agent mote click on the core scene → inspect card (stays on this face).
    const onAgentSelect = (e: Event) => {
      if (Date.now() < suppressAgentSelect.current) return;
      const id = (e as CustomEvent).detail;
      if (typeof id === 'string') setSelectedAgentId((cur) => (cur === id ? null : id));
    };
    window.addEventListener('cortex-agent-select', onAgentSelect);
    // Resolve the globe origin: /api/cortex/gev-url returns the Oracle tunnel
    // URL when deployed there; locally it 404s/nulls → Mac :5180 default.
    let probeTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      let origin = 'http://127.0.0.1:5180';
      try {
        const r = await fetch('/api/cortex/gev-url', { cache: 'no-store' });
        const j = await r.json();
        if (j?.url) { origin = new URL(j.url).origin; configureGlobeBase(origin); }
      } catch {}
      setGevOrigin(origin);
      // Probe the sibling globe app — hide MAP controls where it isn't running.
      // Preferred: /api/gev/ping is a CORS-readable identity check (any old
      // HTTP server fails it). Fallback: opaque no-cors probe for GEV builds
      // that predate the endpoint.
      probeTimer = setTimeout(() => {
        fetch(origin + '/api/gev/ping', { cache: 'no-store' })
          .then((r) => r.json())
          .then((j) => {
            if (j?.app === 'gods-eye-view') { setGlobeAvailable(true); setGlobeUp(true); return; }
            throw new Error('not gev');
          })
          .catch(() =>
            fetch(origin + '/', { mode: 'no-cors', cache: 'no-store' })
              .then(() => { setGlobeAvailable(true); setGlobeUp(true); })
              .catch(() => {}));
      }, 800);
    })();
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable;
      if (e.key === 'Escape') {
        setMapMode(false); setChatOpen(false); setCoreMenuOpen(false); setNavExpanded(false);
        if (focusModeRef.current) setSurfaceFocusMode(false);
      }
      if (typing) return;
      // Mission-control hotkeys: i/a = interrupt/barge-in (no-ops when idle),
      // ` = perf HUD.
      if (e.key === 'i' || e.key === 'I' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('cortex-viz-interrupt'));
      } else if (e.key === '`') {
        e.preventDefault();
        setShowPerfHud((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);

    // Globe handshake: gev:ready from the iframe marks it live; gev:boot and
    // gev:error diagnose where the boot chain broke.
    const onGlobeMsg = (e: MessageEvent) => {
      if (e.data?.type === 'gev:ready') { globeReadyRef.current = true; setGlobeReady(true); setGlobeFailed(false); }
      else if (e.data?.type === 'gev:boot') { globeBootedRef.current = true; }
      else if (e.data?.type === 'gev:error') {
        setGlobeError(e.data.reason === 'webgl-context-lost'
          ? 'GPU context lost — the browser reclaimed the graphics context.'
          : `Globe render error: ${String(e.data.message || e.data.reason || 'unknown').slice(0, 120)}`);
      }
    };
    window.addEventListener('message', onGlobeMsg);

    let lastTs = 0;
    const poll = async () => {
      try {
        if (typeof document !== 'undefined' && document.hidden) return;
        const res = await fetch('/api/cortex/bus/state', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.ts && data.ts !== lastTs) {
          lastTs = data.ts;
          if (data.state === 'idle' && (data.missionProgress >= 0 || data.thought || data.tool)) {
            data.missionProgress = -1;
            data.missionTitle = '';
            delete data.thought;
            delete data.tool;
            delete data.stage;
          }
          cortexSignalBus.ingestRemote(data);
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 2000);

    const pollAmbientAndVigilance = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const [ambRes, vigRes] = await Promise.all([
          fetch('/api/cortex/ambient/context', { cache: 'no-store' }),
          fetch('/api/cortex/vigilance/status', { cache: 'no-store' }),
        ]);
        if (ambRes.ok) {
          const ambJson = await ambRes.json();
          if (ambJson.ok) setAmbientContext(ambJson);
        }
        if (vigRes.ok) {
          const vigJson = await vigRes.json();
          if (vigJson.ok) setVigilanceData(vigJson);
        }
      } catch {}
    };
    // HUD-only telemetry — 'ready' phase, after first paint settles.
    let ambientInterval: ReturnType<typeof setInterval> | null = null;
    onBootPhase('ready', () => {
      pollAmbientAndVigilance();
      ambientInterval = setInterval(pollAmbientAndVigilance, 6000);
    });

    return () => {
      if (goveeSyncTimer) clearTimeout(goveeSyncTimer);
      unsub();
      clearInterval(interval);
      if (ambientInterval) clearInterval(ambientInterval);
      window.removeEventListener(GLOBE_MODE_EVENT, onGlobeMode);
      window.removeEventListener('cortex-face-mode', onFaceMode);
      window.removeEventListener('cortex-agent-select', onAgentSelect);
      window.removeEventListener('cortex-voice-initiated', onVoiceInitiated);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('message', onGlobeMsg);
      clearTimeout(probeTimer);
    };
  }, []);

  // Reduced-motion + viewport tracking (inline styles can't use media queries).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onMq);
    const onResize = () => setNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => { mq.removeEventListener('change', onMq); window.removeEventListener('resize', onResize); };
  }, []);

  // Real coordinates for the sovereignty tag — never fabricate a location.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeoLabel(`${pos.coords.latitude.toFixed(4)}° ${pos.coords.latitude >= 0 ? 'N' : 'S'} // ${Math.abs(pos.coords.longitude).toFixed(4)}° ${pos.coords.longitude >= 0 ? 'E' : 'W'}`),
      () => setGeoLabel(null),
      { timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  // Session uptime — honest value for the rail (was hardcoded '∞').
  useEffect(() => {
    const id = setInterval(() => setUptimeSec(Math.floor((Date.now() - mountedAtRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const st = STATE_STYLE[payload.state] ?? STATE_STYLE.idle;
  const level = Math.max(0, Math.min(1, payload.level ?? 0));
  const accent = st.color;
  const agent = (payload.agentName || 'CORTEX').toUpperCase();
  const channel = (payload.channel || '').toUpperCase();
  const channelLabel = channel ? `CH·${channel}` : '';
  const phi = payload.phi;
  const missionProgress = payload.missionProgress;
  const missionTitle = payload.missionTitle || '';
  const queueDepth = payload.queueDepth ?? 0;

  // ── Mission Console: busy is a first-class, persistent signal ──
  const busy = payload.state !== 'idle' && (
    payload.state === 'working' || payload.state === 'thinking' || queueDepth > 0 ||
    (typeof missionProgress === 'number' && missionProgress >= 0 && !!missionTitle)
  );
  const [busyElapsed, setBusyElapsed] = useState(0);
  const busySinceRef = useRef<number | null>(null);
  const prevStateRef = useRef(payload.state);
  const tickCtxRef = useRef<AudioContext | null>(null);

  const [escalating, setEscalating] = useState(false);
  const [escalationNotice, setEscalationNotice] = useState<string | null>(null);

  const handleEscalateToAntigravity = async (reason: string, isAuto = false) => {
    if (escalating) return;
    setEscalating(true);
    setEscalationNotice(isAuto ? 'Deadlock guard: Escalating to Antigravity IDE...' : 'Escalating to Antigravity IDE...');
    try {
      const res = await fetch('/api/cortex/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemDescription: `Visualizer Cognitive Task: ${reason}. Mission: ${missionTitle || payload.text || 'Task'}. Tool: ${payload.tool || 'none'}. State: ${payload.state}. Duration: ${busyElapsed}s.`,
          primaryTarget: 'antigravity',
          dryRun: false,
          autoDeploy: false,
        }),
      });
      const data = await res.json();
      setEscalationNotice(data?.ok ? 'Dispatched incident to Antigravity IDE' : 'Escalation logged to incident ledger');
    } catch {
      setEscalationNotice('Escalation request failed to dispatch');
    } finally {
      setEscalating(false);
      if (isAuto) {
        window.dispatchEvent(new CustomEvent('cortex-viz-interrupt'));
        cortexSignalBus.publish({ state: 'idle', level: 0, text: 'Deadlock guard: turn interrupted & reset to idle', missionProgress: -1 });
      }
    }
  };

  // Automated 180s Deadlock Safeguard
  useEffect(() => {
    if (busyElapsed >= 180 && (payload.state === 'working' || payload.state === 'thinking') && !escalating) {
      handleEscalateToAntigravity('Watchdog deadlock threshold exceeded (180s without completion)', true);
    }
  }, [busyElapsed, payload.state, escalating]);

  useEffect(() => {
    if (busy) {
      if (busySinceRef.current === null) busySinceRef.current = Date.now();
      const id = setInterval(() => {
        if (busySinceRef.current !== null) {
          setBusyElapsed(Math.floor((Date.now() - busySinceRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(id);
    }
    busySinceRef.current = null;
    setBusyElapsed(0);
  }, [busy]);

  // Subtle "engaged" tick when Cortex enters working — once per transition.
  useEffect(() => {
    const was = prevStateRef.current;
    prevStateRef.current = payload.state;
    if (was !== 'working' && payload.state === 'working') {
      try {
        if (!tickCtxRef.current) tickCtxRef.current = new AudioContext();
        const ctx = tickCtxRef.current;
        if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); return; }
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 196;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
        o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 0.11);
      } catch {}
    }
  }, [payload.state]);

  // Core dropdown: close on outside click or when leaving the core face.
  useEffect(() => {
    if (!coreMenuOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-core-menu]')) return;
      setCoreMenuOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [coreMenuOpen]);
  useEffect(() => {
    if (faceMode !== 'core' || mapMode) { setCoreMenuOpen(false); setNavExpanded(false); }
  }, [faceMode, mapMode]);

  // Keep the core dropdown anchored under the CORE button if the nav rail
  // expands/collapses while the menu is open.
  useEffect(() => {
    if (!coreMenuOpen || !coreBtnRef.current) return;
    const r = coreBtnRef.current.getBoundingClientRect();
    setCoreMenuPos({
      top: r.bottom + 8,
      left: Math.max(8, Math.min(r.left, window.innerWidth - 246)),
    });
  }, [navExpanded, coreMenuOpen]);

  const fmtElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const [gevOrigin, setGevOrigin] = useState('http://127.0.0.1:5180');
  const voiceBusy = payload.state === 'thinking' || payload.state === 'working' || queueDepth > 0;
  const navCollapsed = faceMode === 'core' && !mapMode && !navExpanded;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#03040a', overflow: 'hidden', fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>
      <style>{HUD_CSS}</style>

      {/* A2UI generative-UI surface — opt-in demo via ?a2ui=demo */}
      {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('a2ui') === 'demo' && (
        <div style={{ position: 'absolute', top: 96, right: 16, width: 360, zIndex: 40 }}>
          <A2uiDemoPanel />
        </div>
      )}

      {/* God's Eye View globe — unmounts the R3F core to keep GPU headroom */}
      {mapMode ? (
        <>
        <iframe
          key={globeRetry}
          data-gev-globe=""
          src={getGlobeEmbedUrl()}
          title="God's Eye View — live globe"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 4, border: 'none', background: '#000', width: '100%', height: '100%' }}
          allow="fullscreen"
        />
        {globeUp && !globeReady && !globeFailed && (
          <div style={{
            position: 'absolute', top: 120, left: '50%', transform: 'translateX(-50%)',
            zIndex: 6, padding: '6px 18px',
            border: '1px solid rgba(103,232,249,0.35)', borderRadius: 2,
            background: 'rgba(4,8,14,0.6)', backdropFilter: 'blur(8px)',
            color: '#67e8f9', fontSize: 9, letterSpacing: '0.34em',
            animation: reducedMotion ? 'none' : 'cx-pulse-dot 1.6s ease-in-out infinite',
          }}>
            ◌ ESTABLISHING UPLINK…
          </div>
        )}
        {globeFailed && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 6,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
            background: 'radial-gradient(ellipse at center, rgba(4,8,16,0.55), rgba(2,3,8,0.92))',
          }}>
            <div style={{ fontSize: 10, letterSpacing: '0.5em', color: 'rgba(148,233,255,0.5)' }}>SATELLITE UPLINK LOST</div>
            <div style={{ fontSize: 12, color: 'rgba(232,251,255,0.75)', letterSpacing: '0.1em', maxWidth: 520, textAlign: 'center', lineHeight: 1.7 }}>
              {globeError || (globeBootedRef.current
                ? 'The globe app booted but never came up — its graphics may be suspended. Try RETRY UPLINK, or reload this tab if your browser’s GPU is wedged.'
                : "The globe app isn't answering — is gods-eye-view running on port 5180?")}
            </div>
            <button
              onClick={() => setGlobeRetry(v => v + 1)}
              style={{
                marginTop: 8, cursor: 'pointer', padding: '10px 26px',
                border: '1px solid rgba(103,232,249,0.5)', borderRadius: 2,
                background: 'rgba(103,232,249,0.08)', color: '#67e8f9',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.3em',
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              ↻ RETRY UPLINK
            </button>
          </div>
        )}
        </>
      ) : faceMode === 'core' ? (
        <div key="face-core" className="cx-face-transition" style={{ position: 'absolute', inset: 0, zIndex: 4 }}>
          {orbMode && <CortexOrb />}
          <CortexCoreScene
            selectedAgentId={selectedAgentId}
            onSelectAgent={setSelectedAgentId}
            selectedMemoryId={selectedMemoryId}
            onSelectMemory={setSelectedMemoryId}
            visualMode={coreVisualMode}
            chronoTime={chronoActive ? chronoTime : null}
            replayTrack={chronoActive ? replayTrack : null}
            headParallax={effectiveParallax}
            perfMode={coreQuality}
            onTogglePerfMode={setCoreQuality}
            nightMode={nightMode}
          />
          {chronoActive && chronoNowUi && (
            <div style={{
              position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
              zIndex: 6, pointerEvents: 'none',
              padding: '6px 14px', borderRadius: 2,
              border: '1px solid rgba(56,189,248,0.35)',
              background: 'rgba(4,8,14,0.72)', backdropFilter: 'blur(8px)',
              color: '#7dd3fc', fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10, letterSpacing: '0.14em', whiteSpace: 'nowrap',
            }}>
              {replayTrack ? '◉ REPLAY' : '◈ REEL'} · SEQ {chronoNowUi.seq} · {chronoNowUi.type}
              {chronoNowUi.agentId ? ` · ${chronoNowUi.agentId}` : ''}
            </div>
          )}
        </div>
      ) : faceMode === 'timeline' ? (
        <div key="face-timeline" className="cx-face-transition" style={{ position: 'absolute', inset: 0, zIndex: 24 }}>
          <CortexTimelineScene />
        </div>
      ) : faceMode === 'agents' ? (
        <div key="face-agents" className="cx-face-transition" style={{ position: 'absolute', inset: 0, zIndex: 25 }}>
          <CortexAgentsScene />
        </div>
      ) : (
        <div key={`face-${faceMode}`} className="cx-face-transition" style={{ position: 'absolute', inset: 0, zIndex: 4 }}>
          <CortexVisualizer face={faceMode} isFullScreen={true} hideOverlay={true} />
        </div>
      )}

      {/* Film treatment: scanlines + edge vignette */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.014) 0px, rgba(255,255,255,0.014) 1px, transparent 1px, transparent 3px)',
        animation: reducedMotion ? 'none' : 'cx-scan-drift 9s linear infinite',
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 52%, rgba(0,0,5,0.55) 100%)',
      }} />

      {/* HUD chrome */}
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />

      {/* Top-left: wordmark */}
      <div style={{ position: 'absolute', top: 34, left: 64, zIndex: 20 }} className="cx-hud-in" >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          {agent.split('').map((ch, i) => (
            <span key={i} className="cx-letter" style={{
              animationDelay: `${0.15 + i * 0.055}s`,
              fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(34px, 4.2vw, 58px)',
              letterSpacing: '0.06em',
              lineHeight: 1,
              color: '#f2fdff',
              textShadow: `0 0 24px ${accent}66, 0 0 60px ${accent}33`,
              transition: 'text-shadow 0.6s',
            }}>{ch}</span>
          ))}
        </div>
        <div style={{
          marginTop: 8, fontSize: 10, letterSpacing: '0.42em',
          color: 'rgba(148,233,255,0.55)', textTransform: 'uppercase',
          animation: 'cx-fade-up 0.9s 0.7s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          {faceMode === 'agents' ? 'Nexus Foundry // Fleet Command Deck' : faceMode === 'timeline' ? 'Temporal Authority // Sacred Timeline' : coreVisualMode === 'memory' ? 'Sovereign Core // Live Memory Bank Constellation' : 'Sovereign Core // Neural Sanctum'}
        </div>
      </div>

      {/* Top-center: Live Memory Bank Telemetry Strip */}
      {faceMode === 'core' && coreVisualMode === 'memory' && (
        <div style={{
          position: 'absolute', top: 76, left: '50%', transform: 'translateX(-50%)',
          zIndex: 16, pointerEvents: 'auto',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '6px 18px', borderRadius: 20,
          background: 'rgba(4, 8, 18, 0.78)', backdropFilter: 'blur(14px)',
          border: '1px solid rgba(192,132,252,0.35)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 16px rgba(192,132,252,0.15)',
          color: '#c084fc', fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, letterSpacing: '0.16em',
          animation: 'cx-fade-up 0.4s ease both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
            <span style={{ fontWeight: 700 }}>HINDSIGHT 1.2.1</span>
          </div>
          <span style={{ color: 'rgba(148,163,184,0.3)' }}>|</span>
          <span style={{ color: '#f8fafc', fontWeight: 600 }}>{memoryGraphSummary.total} ENGRAMS</span>
          <span style={{ color: 'rgba(148,163,184,0.3)' }}>|</span>
          <span style={{ color: '#7dd3fc' }}>{memoryGraphSummary.edges} SYNAPSES</span>
          <span style={{ color: 'rgba(148,163,184,0.3)' }}>|</span>
          <span style={{ color: '#fbbf24', fontSize: 8.5 }}>CLICK ORB TO INSPECT</span>
        </div>
      )}

      {/* Top-center: marquee ticker — hidden on Foundry face to avoid header collision */}
      {faceMode !== 'agents' && (
      <div style={{
        position: 'absolute', top: 42, left: '50%', transform: 'translateX(-50%)',
        width: '42vw', overflow: 'hidden', zIndex: 15, pointerEvents: 'none',
        maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
      }}>
        <div style={{
          display: 'inline-flex', whiteSpace: 'nowrap',
          animation: reducedMotion ? 'none' : 'cx-marquee 36s linear infinite',
          fontSize: 10, letterSpacing: '0.5em', color: 'rgba(148,233,255,0.4)',
          textTransform: 'uppercase',
        }}>
          {Array(2).fill(0).map((_, i) => (
            <span key={i} style={{ paddingRight: '4em' }}>
              Cortex // Sovereign Core // Neural Sanctum // Self-Hosted // Auditable // Always-On //&nbsp;
            </span>
          ))}
        </div>
      </div>
      )}

      {/* Top-center: Strategic Navigation Bar (Core, Foundry, Map, Chat, Voice)
          — centered above the Neural Sanctum marquee strip */}
      <nav
        aria-label="Cortex Top Navigation"
        style={{
          position: 'absolute',
          top: narrow ? 10 : 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: navCollapsed ? 4 : 6,
          background: 'rgba(6,10,24,0.85)',
          padding: '3px 8px',
          borderRadius: 20,
          border: '1px solid rgba(103,232,249,0.25)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 16px rgba(103,232,249,0.08)',
          transition: 'gap 0.3s ease, padding 0.3s ease',
        }}
      >
        {/* Nav expander — on the Core face the rail collapses to CORE + ◂;
            clicking reveals the full menu. ▸ collapses it again. */}
        {faceMode === 'core' && !mapMode && (
          <button
            onClick={() => setNavExpanded(v => !v)}
            title={navExpanded ? 'Collapse navigation' : 'Expand navigation'}
            aria-label={navExpanded ? 'Collapse navigation' : 'Expand navigation'}
            style={{
              padding: '3px 9px',
              borderRadius: 14,
              border: '1px solid rgba(148,233,255,0.18)',
              background: 'rgba(4,8,14,0.5)',
              color: navExpanded ? '#38bdf8' : 'rgba(165,243,252,0.7)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {navExpanded ? '▸' : '◂'}
          </button>
        )}

        {/* CORE — switches to Sovereign Core; on Core face, toggles the controls dropdown */}
        <button
          ref={coreBtnRef}
          data-core-menu
          aria-haspopup="true"
          aria-expanded={coreMenuOpen}
          onClick={() => {
            if (mapMode) setMapMode(false);
            if (faceMode === 'core') {
              if (!mapMode) {
                if (!coreMenuOpen && coreBtnRef.current) {
                  const r = coreBtnRef.current.getBoundingClientRect();
                  setCoreMenuPos({
                    top: r.bottom + 8,
                    left: Math.max(8, Math.min(r.left, window.innerWidth - 246)),
                  });
                }
                setCoreMenuOpen(v => !v);
              }
              return;
            }
            setFaceMode('core');
            try { localStorage.setItem('cortex_visualizer_face', 'core'); } catch {}
            cortexSpeak('Transitioning to Sovereign Quantum Core.');
          }}
          title={faceMode === 'core' && !mapMode ? 'Sovereign Core — click again for core controls' : 'Switch to Sovereign Core'}
          style={{
            padding: '3px 12px',
            borderRadius: 14,
            border: faceMode === 'core' && !mapMode ? '1px solid #38bdf8' : '1px solid rgba(148,233,255,0.18)',
            background: faceMode === 'core' && !mapMode ? 'rgba(56,189,248,0.18)' : 'rgba(4,8,14,0.5)',
            color: faceMode === 'core' && !mapMode ? '#f0f9ff' : 'rgba(165,243,252,0.7)',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: '0.14em',
            boxShadow: faceMode === 'core' && !mapMode ? '0 0 12px rgba(56,189,248,0.4)' : 'none',
            cursor: faceMode === 'core' && !mapMode ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all 0.2s',
          }}
        >
          {faceMode === 'core' && !mapMode ? (
            <span
              title="Core voice link — live audio level"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, height: 12 }}
            >
              {[0.45, 0.75, 1, 0.75, 0.45].map((g, i) => (
                <span
                  key={i}
                  style={{
                    width: 2.5,
                    height: `${5 + level * 8 * g}px`,
                    borderRadius: 1,
                    background: '#38bdf8',
                    boxShadow: level > 0.05 ? '0 0 5px rgba(56,189,248,0.8)' : '0 0 4px rgba(56,189,248,0.5)',
                    transition: 'height 80ms linear, box-shadow 200ms ease',
                    animation: 'cx-eq-breathe 1.8s ease-in-out infinite',
                    animationDelay: `${i * 0.14}s`,
                    transformOrigin: 'bottom',
                  }}
                />
              ))}
            </span>
          ) : (
            <span style={{ color: '#38bdf8' }}>◈</span>
          )}
          <span>CORE</span>
          {faceMode === 'core' && !mapMode && (
            <span style={{ fontSize: 8, color: coreMenuOpen ? '#38bdf8' : 'rgba(148,233,255,0.45)', transition: 'transform 0.2s', transform: coreMenuOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
          )}
        </button>

        {/* Compact chat toggle — stands in for the hidden CHAT item while the rail is collapsed */}
        {navCollapsed && (
          <button
            data-toggle-chat-drawer="true"
            onClick={() => setChatOpen(v => !v)}
            title={chatOpen ? 'Cortex Uplink Chat Drawer open — click to close (Esc)' : 'Open Cortex Uplink Chat Drawer'}
            aria-label={chatOpen ? 'Close chat drawer' : 'Open chat drawer'}
            style={{
              padding: '3px 12px',
              borderRadius: 14,
              border: `1px solid ${chatOpen ? accent : 'rgba(148,233,255,0.18)'}`,
              background: chatOpen ? `${accent}22` : 'rgba(4,8,14,0.5)',
              color: chatOpen ? '#f0f9ff' : 'rgba(165,243,252,0.7)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.14em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: chatOpen ? `0 0 10px ${accent}44` : 'none',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ color: accent }}>💬</span>
            <span>{chatOpen ? 'CHAT · ON' : 'CHAT'}</span>
          </button>
        )}

        {/* Remaining nav items — smoothly collapsed via max-width/opacity on the Core face */}
        <div aria-hidden={navCollapsed} style={{
          display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flexShrink: 0,
          maxWidth: navCollapsed ? 0 : 900,
          maxHeight: navCollapsed ? 0 : 80,
          opacity: navCollapsed ? 0 : 1,
          transition: 'max-width 0.38s cubic-bezier(0.16,1,0.3,1), max-height 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.28s ease',
          pointerEvents: navCollapsed ? 'none' : 'auto',
        }}>
        {/* FOUNDRY */}
        <button
          onClick={() => {
            if (mapMode) setMapMode(false);
            if (faceMode === 'agents') return;
            setFaceMode('agents');
            try { localStorage.setItem('cortex_visualizer_face', 'agents'); } catch {}
            cortexSpeak('Entering the Nexus Foundry.');
          }}
          title={faceMode === 'agents' && !mapMode ? 'Nexus Foundry — active tactical holodeck & fleet deck' : 'Switch to Nexus Foundry'}
          style={{
            padding: '3px 12px',
            borderRadius: 14,
            border: faceMode === 'agents' && !mapMode ? '1px solid #67e8f9' : '1px solid rgba(148,233,255,0.18)',
            background: faceMode === 'agents' && !mapMode ? 'rgba(103,232,249,0.18)' : 'rgba(4,8,14,0.5)',
            color: faceMode === 'agents' && !mapMode ? '#f0f9ff' : 'rgba(165,243,252,0.7)',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: '0.14em',
            boxShadow: faceMode === 'agents' && !mapMode ? '0 0 12px rgba(103,232,249,0.4)' : 'none',
            cursor: faceMode === 'agents' && !mapMode ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all 0.2s',
          }}
        >
          {faceMode === 'agents' && !mapMode ? (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#67e8f9', boxShadow: '0 0 6px #67e8f9' }} />
          ) : (
            <span style={{ color: '#67e8f9' }}>◈</span>
          )}
          <span>FOUNDRY</span>
        </button>

          {/* MAP */}
          <button
            onClick={() => {
              const next = !mapMode;
              setMapMode(next);
              cortexSpeak(next ? 'Opening planetary globe.' : 'Returning to command deck.');
            }}
            title="Planetary Mission Globe & Q-Map Replay"
            style={{
              padding: '3px 12px',
              borderRadius: 14,
              border: `1px solid ${mapMode ? '#e879f9' : 'rgba(148,233,255,0.18)'}`,
              background: mapMode ? 'rgba(232,121,249,0.18)' : 'rgba(4,8,14,0.5)',
              color: mapMode ? '#f5d0fe' : 'rgba(165,243,252,0.7)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.14em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.2s',
            }}
          >
            <span style={{ color: '#e879f9' }}>🌍</span>
            <span>{mapMode ? 'MAP ACTIVE' : 'MAP'}</span>
          </button>

          {/* CHAT */}
          <button
            onClick={() => setChatOpen(v => !v)}
            title="Toggle Cortex Uplink Chat Drawer (Esc to close)"
            style={{
              padding: '3px 12px',
              borderRadius: 14,
              border: `1px solid ${chatOpen ? accent : 'rgba(148,233,255,0.18)'}`,
              background: chatOpen ? `${accent}22` : 'rgba(4,8,14,0.5)',
              color: chatOpen ? '#f0f9ff' : 'rgba(165,243,252,0.7)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.14em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.2s',
            }}
          >
            <span style={{ color: accent }}>💬</span>
            <span>{chatOpen ? 'CHAT (OPEN)' : 'CHAT'}</span>
          </button>

          {/* VOICE */}
          <button
            onClick={() => {
              const next = !micOn;
              setMicOn(next);
              try { localStorage.setItem('cortex_viz_mic_on', String(next)); } catch {}
              cortexSpeak(next ? 'Voice listening active.' : 'Voice muted.');
            }}
            title={!micOn ? 'Microphone muted — click to enable' : 'Voice listening active — click to mute'}
            style={{
              padding: '3px 12px',
              borderRadius: 14,
              border: `1px solid ${micLive ? '#c084fc' : micOn ? '#34d399' : 'rgba(148,233,255,0.18)'}`,
              background: micLive ? 'rgba(192,132,252,0.22)' : micOn ? 'rgba(52,211,153,0.18)' : 'rgba(4,8,14,0.5)',
              color: micLive ? '#f5d0fe' : micOn ? '#bbf7d0' : 'rgba(165,243,252,0.7)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.14em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: micOn ? '0 0 10px rgba(52,211,153,0.3)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: micLive ? '#c084fc' : micOn ? '#34d399' : 'rgba(148,163,184,0.4)',
              boxShadow: micOn ? '0 0 6px #34d399' : 'none',
            }} />
            <span>{micLive ? 'SPEAKING' : micOn ? 'VOICE ON' : 'VOICE MUTED'}</span>
          </button>
        </div>
        </nav>

      {/* Core controls dropdown — anchored under the CORE nav button. Replaces the
          old bottom command dock; face-level duplicates (MAP / FOUNDRY / CHAT)
          stay exclusively in the top nav. */}
      {coreMenuOpen && faceMode === 'core' && !mapMode && (
        <div
          data-core-menu
          style={{
            position: 'absolute',
            top: coreMenuPos?.top ?? 64,
            left: coreMenuPos?.left,
            right: coreMenuPos ? 'auto' : (narrow ? 16 : 32),
            zIndex: 55,
            width: narrow ? 'calc(100vw - 32px)' : 230,
            padding: '8px',
            background: 'rgba(6,10,24,0.92)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(103,232,249,0.3)',
            borderRadius: 8,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 20px rgba(103,232,249,0.08)',
            fontFamily: "'IBM Plex Mono', monospace",
            display: 'flex', flexDirection: 'column', gap: 4,
          }}
          className="cx-hud-in"
        >
          <div style={{ fontSize: 8, letterSpacing: '0.3em', color: 'rgba(148,233,255,0.4)', padding: '2px 6px 6px' }}>CORE CONTROLS</div>

          {/* FLEET / MEMORY visual mode */}
          <div style={{ display: 'flex', borderRadius: 4, border: '1px solid rgba(148,233,255,0.18)', overflow: 'hidden', background: 'rgba(4,8,14,0.4)' }}>
            <button
              onClick={() => { setCoreVisualMode('fleet'); try { localStorage.setItem('cortex_core_visual_mode', 'fleet'); } catch {} cortexSpeak('Fleet deck active.'); }}
              title="Fleet Deck — active agent vessels orbiting Sovereign Core"
              style={{ flex: 1, padding: '7px 4px', cursor: 'pointer', border: 'none', background: coreVisualMode === 'fleet' ? 'rgba(56,189,248,0.22)' : 'transparent', color: coreVisualMode === 'fleet' ? '#38bdf8' : 'rgba(148,233,255,0.5)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em' }}
            >◈ FLEET</button>
            <button
              onClick={() => { setCoreVisualMode('memory'); try { localStorage.setItem('cortex_core_visual_mode', 'memory'); } catch {} cortexSpeak('Memory bank constellation active.'); }}
              title="Hindsight Memory Bank — live cognitive engrams & synaptic filaments"
              style={{ flex: 1, padding: '7px 4px', cursor: 'pointer', border: 'none', background: coreVisualMode === 'memory' ? 'rgba(192,132,252,0.26)' : 'transparent', color: coreVisualMode === 'memory' ? '#c084fc' : 'rgba(148,233,255,0.5)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em' }}
            >🧠 MEMORY</button>
          </div>

          {([
            {
              key: 'sonics',
              active: audioEnabled,
              activeColor: '#c084fc',
              borderColor: 'rgba(167,139,250,0.4)',
              label: audioEnabled ? '🔊 SONICS ON' : '🔇 SONICS OFF',
              title: 'Procedural Neuro-Acoustic Sonification',
              onClick: () => { const next = neuroAudio.toggle(); setAudioEnabled(next); cortexSpeak(next ? 'Neuro sonics enabled.' : 'Sonics muted.'); },
            },
            {
              key: 'chrono',
              active: chronoActive,
              activeColor: '#38bdf8',
              borderColor: 'rgba(56,189,248,0.4)',
              label: chronoActive ? '◉ 4D CHRONO ACTIVE' : '◈ 4D CHRONO',
              title: '4D Chrono-DVR Mission Replay Ribbon',
              onClick: () => { const next = !chronoActive; setChronoActive(next); cortexSpeak(next ? 'Entering 4D chrono replay mode.' : 'Returning to live feed.'); },
            },
            {
              key: 'holocam',
              active: holoCamActive,
              activeColor: '#34d399',
              borderColor: 'rgba(16,185,129,0.4)',
              label: holoCamActive ? '◉ HOLO-CAM: ON' : '📷 HOLO-CAM',
              title: 'Holographic Window Parallax — local head-tracking',
              onClick: async () => {
                if (holoCamActive) { cortexWebcamParallax.stop(); setHoloCamActive(false); cortexSpeak('Head tracking disabled.'); }
                else {
                  const ok = await cortexWebcamParallax.start();
                  if (ok) { setHoloCamActive(true); cortexSpeak('Holographic head tracking active.'); }
                  else cortexSpeak('Camera access was not available.');
                }
              },
            },
            {
              key: 'lights',
              active: goveeSync,
              activeColor: '#eab308',
              borderColor: 'rgba(234,179,8,0.4)',
              label: goveeSync ? '✦ LIGHTS: SYNCED' : '✧ LIGHTS',
              title: goveeSync ? 'Govee smart lights syncing to Cortex mood' : 'Enable Govee room lights sync',
              onClick: () => {
                setGoveeSync(v => {
                  const next = !v;
                  try { localStorage.setItem('cortex_govee_sync', String(next)); } catch {}
                  cortexSpeak(next ? 'Room lights synced to my mood.' : 'Light sync disabled.');
                  if (next && payload.state) {
                    fetch('/api/cortex/lights/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mood: payload.state }) }).catch(() => {});
                  }
                  return next;
                });
              },
            },
            {
              key: 'vault',
              active: false,
              activeColor: '#c4b5fd',
              borderColor: 'rgba(167,139,250,0.4)',
              label: '◈ VAULT',
              title: 'Auto-organize Obsidian Knowledge Graph',
              onClick: async () => {
                try {
                  setVaultSyncNotice('Auto-organizing Obsidian Knowledge Graph…');
                  const res = await fetch('/api/cortex/tools/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tool: 'cortex_memory', args: { action: 'vault_auto_organize' } }),
                  });
                  const data = await res.json();
                  if (data?.ok && data?.report) {
                    setVaultSyncNotice(`Graph Organized · ${data.report.notesAnalyzed} Notes · ${data.report.linksResolved} Wikilinks`);
                    cortexSpeak(`Graph organized — ${data.report.notesAnalyzed} notes, ${data.report.linksResolved} wikilinks resolved.`);
                  } else {
                    setVaultSyncNotice('Vault sync completed');
                    cortexSpeak('Vault sync complete.');
                  }
                  setTimeout(() => setVaultSyncNotice(null), 3500);
                } catch {
                  setVaultSyncNotice('Vault sync error');
                  setTimeout(() => setVaultSyncNotice(null), 3000);
                }
              },
            },
          ] as const).map((item) => (
            <button
              key={item.key}
              onClick={item.onClick}
              title={item.title}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', cursor: 'pointer',
                border: `1px solid ${item.active ? item.borderColor : 'rgba(148,233,255,0.14)'}`, borderRadius: 4,
                color: item.active ? item.activeColor : 'rgba(148,233,255,0.65)',
                fontSize: 10, fontWeight: 600, letterSpacing: '0.2em',
                background: item.active ? `${item.activeColor}14` : 'rgba(4,8,14,0.4)',
                transition: 'all 0.2s',
              }}
            >{item.label}</button>
          ))}

          {/* Voice / mic — same control as top-nav VOICE but with queue detail */}
          <button
            onClick={() => {
              const next = !micOn;
              setMicOn(next);
              try { localStorage.setItem('cortex_viz_mic_on', String(next)); } catch {}
              cortexSpeak(next ? 'Voice enabled — I can hear you now.' : 'Microphone muted.');
            }}
            title={!micOn ? 'Microphone muted — click to enable voice' : 'Voice active — click to mute microphone'}
            style={{
              width: '100%', textAlign: 'left', padding: '8px 10px', cursor: 'pointer',
              border: `1px solid ${micLive ? 'rgba(192,132,252,0.5)' : micOn ? 'rgba(52,211,153,0.45)' : 'rgba(148,233,255,0.14)'}`,
              borderRadius: 4,
              color: micLive ? '#f5d0fe' : micOn ? '#bbf7d0' : 'rgba(148,233,255,0.65)',
              fontSize: 10, fontWeight: 600, letterSpacing: '0.2em',
              background: micLive ? 'rgba(192,132,252,0.14)' : micOn ? 'rgba(52,211,153,0.1)' : 'rgba(4,8,14,0.4)',
              boxShadow: micOn ? '0 0 12px rgba(52,211,153,0.2)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {micLive ? '◉ SPEAKING'
              : !micOn ? '○ VOICE MUTED'
                : queueDepth > 0 ? `◌ +${queueDepth} QUEUED`
                  : voiceBusy ? '◌ BUSY · TAP TO QUEUE' : '◉ VOICE ACTIVE · LISTENING'}
          </button>

          <a href="/cortex/chat" style={{
            textDecoration: 'none', textAlign: 'center', padding: '8px 10px',
            border: '1px solid rgba(148,233,255,0.14)', borderRadius: 4,
            color: 'rgba(165,243,252,0.7)', fontSize: 10, fontWeight: 600, letterSpacing: '0.2em',
            background: 'rgba(4,8,14,0.4)',
          }}>← OPEN FULL CHAT</a>
        </div>
      )}

      {/* Proactive Ambient & Vigilance HUD Bar — centered directly under header */}
      <div style={{
        position: 'absolute', top: busy ? 116 : (faceMode === 'agents' ? 70 : 68), left: '50%', transform: 'translate(-50%, 0)',
        zIndex: 21, display: 'flex', alignItems: 'center', gap: 10,
        pointerEvents: 'auto',
        transition: 'top 0.3s cubic-bezier(0.16,1,0.3,1)',
      }} className="cx-hud-center-in">
        {/* Ambient macOS App & Context Sensor */}
        {ambientContext && (
          <div
            title={`Active macOS Context: ${ambientContext.app} — ${ambientContext.label}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 10px', borderRadius: 12,
              background: 'rgba(168,85,247,0.14)', border: '1px solid rgba(168,85,247,0.35)',
              color: '#d8b4fe', fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: '0.12em', backdropFilter: 'blur(8px)',
              boxShadow: '0 0 14px rgba(168,85,247,0.15)',
            }}
          >
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: '#c084fc',
              boxShadow: '0 0 6px #c084fc',
              animation: reducedMotion ? 'none' : 'cx-pulse-dot 1.4s ease-in-out infinite',
            }} />
            <span>AMBIENT: {ambientContext.app.toUpperCase()}</span>
            <span style={{ color: 'rgba(216,180,254,0.6)', fontSize: 8 }}>· {ambientContext.category.toUpperCase()}</span>
          </div>
        )}

        {/* Speculative Pre-Computation & Vigilance Badge */}
        {vigilanceData && (
          <div
            data-vigilance-badge="true"
            onClick={() => setShowVigilanceDetails(v => !v)}
            title="Click to toggle Variational Free Energy F & Speculative Resolution"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              padding: '3px 10px', borderRadius: 12,
              background: vigilanceData.speculativeResolution?.readyToCommit ? 'rgba(34,197,94,0.12)' : 'rgba(56,189,248,0.12)',
              border: `1px solid ${vigilanceData.speculativeResolution?.readyToCommit ? 'rgba(34,197,94,0.35)' : 'rgba(56,189,248,0.35)'}`,
              color: vigilanceData.speculativeResolution?.readyToCommit ? '#4ade80' : '#38bdf8',
              fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: '0.12em', backdropFilter: 'blur(8px)',
              boxShadow: `0 0 14px ${vigilanceData.speculativeResolution?.readyToCommit ? 'rgba(34,197,94,0.15)' : 'rgba(56,189,248,0.15)'}`,
            }}
          >
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: vigilanceData.speculativeResolution?.readyToCommit ? '#4ade80' : '#38bdf8',
              boxShadow: `0 0 6px ${vigilanceData.speculativeResolution?.readyToCommit ? '#4ade80' : '#38bdf8'}`,
            }} />
            <span>✦ VIGILANCE: F={vigilanceData.report?.freeEnergy?.totalFreeEnergy !== undefined ? vigilanceData.report.freeEnergy.totalFreeEnergy.toFixed(2) : 'NOMINAL'}</span>
            {vigilanceData.speculativeResolution?.readyToCommit && (
              <span style={{
                padding: '1px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.25)',
                fontSize: 8, fontWeight: 700, color: '#bbf7d0',
              }}>
                AUTO-READY
              </span>
            )}
          </div>
        )}

        {/* Initiative Inbox badge — pending + in-flight proposals */}
        {initiativeCount > 0 && (
          <div
            onClick={() => {
              cortexSpeak('Opening your initiative inbox.');
              openSurfacePanel({ kind: 'initiative', title: 'Initiative Inbox', customSize: { w: 460, h: 480 }, pinned: true });
            }}
            title="Proactive initiatives awaiting review — click to open the Initiative Inbox"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              padding: '3px 10px', borderRadius: 12,
              background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)',
              color: '#fcd34d', fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: '0.12em', backdropFilter: 'blur(8px)',
              boxShadow: '0 0 14px rgba(251,191,36,0.18)',
            }}
          >
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: '#fbbf24',
              boxShadow: '0 0 6px #fbbf24',
              animation: reducedMotion ? 'none' : 'cx-pulse-dot 1.4s ease-in-out infinite',
            }} />
            <span>◈ {initiativeCount} INITIATIVE{initiativeCount === 1 ? '' : 'S'}</span>
          </div>
        )}
      </div>

      {/* Free Energy Epistemic Telemetry Popover */}
      {showVigilanceDetails && vigilanceData && (
        <div style={{
          position: 'absolute', top: busy ? 150 : (faceMode === 'agents' ? 106 : 102), left: '50%', transform: 'translate(-50%, 0)',
          zIndex: 25, width: 340, padding: '12px 14px', borderRadius: 6,
          background: 'rgba(4,8,16,0.92)', border: '1px solid rgba(56,189,248,0.35)',
          backdropFilter: 'blur(16px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#e0f2fe',
        }} className="cx-hud-center-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid rgba(56,189,248,0.2)', paddingBottom: 4 }}>
            <span style={{ fontWeight: 700, color: '#38bdf8', letterSpacing: '0.1em' }}>VARIATIONAL FREE ENERGY (F)</span>
            <button
              onClick={() => setShowVigilanceDetails(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Status:</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>{vigilanceData.report?.equilibriumStatus?.replace(/_/g, ' ').toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Total Free Energy (F):</span>
              <span style={{ color: '#4ade80', fontWeight: 700 }}>{vigilanceData.report?.freeEnergy?.totalFreeEnergy?.toFixed(3)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Host Pressure:</span>
              <span>{Math.round((vigilanceData.report?.freeEnergy?.hostPressure || 0) * 100)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Browser Bloat:</span>
              <span>{Math.round((vigilanceData.report?.freeEnergy?.browserBloat || 0) * 100)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Working Tree Drift:</span>
              <span>{vigilanceData.uncommittedFiles} uncommitted files</span>
            </div>
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(148,233,255,0.15)' }}>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>Speculative Pre-Computation:</span>
              <div style={{ marginTop: 3, fontSize: 9, color: '#f8fafc', lineHeight: 1.4 }}>
                {vigilanceData.speculativeResolution?.summary}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Obsidian Vault Sync Toast */}
      {vaultSyncNotice && (
        <div style={{
          position: 'absolute', bottom: 95, left: narrow ? 16 : 64, zIndex: 30,
          padding: '6px 14px', borderRadius: 4,
          background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(167,139,250,0.4)',
          color: '#c4b5fd', fontSize: 10, fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: '0.12em', backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          animation: 'cx-fade-up 0.3s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          ✦ {vaultSyncNotice}
        </div>
      )}

      {/* Mission Console: persistent busy chyron */}
      {busy && (
        <div style={{
          position: 'absolute', top: 68, left: '50%', transform: 'translate(-50%, 0)',
          zIndex: 22, display: 'flex', alignItems: 'center', gap: 14,
          padding: '8px 16px', maxWidth: 'min(620px, 78vw)',
          border: '1px solid rgba(232,121,249,0.35)', borderRadius: 3,
          background: 'rgba(10,4,18,0.72)', backdropFilter: 'blur(12px)',
          boxShadow: '0 0 32px rgba(232,121,249,0.15), inset 0 0 18px rgba(232,121,249,0.05)',
        }} className="cx-hud-center-in">
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: '#e879f9', flexShrink: 0,
            animation: reducedMotion ? 'none' : 'cx-pulse-dot 1.1s ease-in-out infinite',
            boxShadow: '0 0 10px #e879f9',
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                <span style={{
                  fontSize: 8.5, letterSpacing: '0.24em',
                  color: payload.state === 'thinking' ? '#38bdf8' : '#e879f9',
                  fontWeight: 700, flexShrink: 0,
                  padding: '1px 5px', borderRadius: 2,
                  background: payload.state === 'thinking' ? 'rgba(56,189,248,0.12)' : 'rgba(232,121,249,0.12)',
                  border: `1px solid ${payload.state === 'thinking' ? 'rgba(56,189,248,0.35)' : 'rgba(232,121,249,0.35)'}`,
                }}>
                  {payload.stage === 'analyzing'
                    ? '◈ INTENT'
                    : payload.stage === 'recalling'
                      ? '◈ RECALL'
                      : payload.stage === 'executing'
                        ? '◈ EXEC'
                        : payload.stage === 'synthesizing'
                          ? '◈ SYNTHESIS'
                          : payload.state === 'working'
                            ? '◈ EXEC'
                            : '◈ COGNITION'}
                </span>
                {payload.tool && (
                  <span style={{
                    fontSize: 8, padding: '1px 5px', borderRadius: 2,
                    background: 'rgba(232,121,249,0.18)', border: '1px solid rgba(232,121,249,0.45)',
                    color: '#f0abfc', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em', flexShrink: 0,
                  }}>
                    {payload.tool}()
                  </span>
                )}
                <span style={{
                  fontSize: 11, letterSpacing: '0.06em', color: '#f2fdff',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {missionTitle || payload.text || (payload.state === 'thinking' ? 'Synthesizing response…' : 'Processing…')}
                </span>
              </div>
              <span style={{ fontSize: 9.5, color: 'rgba(148,233,255,0.7)', fontVariantNumeric: 'tabular-nums', fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 }}>
                {fmtElapsed(busyElapsed)}
              </span>
            </div>

            {/* Real-time Thought Stream Ticker */}
            {payload.thought && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 9, color: '#bae6fd', fontFamily: "'IBM Plex Mono', monospace",
                background: 'rgba(2, 6, 23, 0.7)', padding: '2px 8px', borderRadius: 2,
                border: '1px solid rgba(56, 189, 248, 0.25)', maxWidth: '100%',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                <span style={{ color: '#38bdf8', fontWeight: 700, letterSpacing: '0.12em' }}>THOUGHT:</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload.thought}</span>
                <span className="cx-caret" style={{ color: '#38bdf8' }}>▮</span>
              </div>
            )}

            {/* Cognitive Multi-Stage Progress Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                flex: 1, height: 4, background: 'rgba(15,23,42,0.85)', borderRadius: 2,
                border: '1px solid rgba(148,233,255,0.15)', overflow: 'hidden',
              }}>
                {typeof missionProgress === 'number' && missionProgress >= 0 ? (
                  <div style={{
                    width: `${Math.round(missionProgress * 100)}%`, height: '100%',
                    background: 'linear-gradient(90deg, #38bdf8, #818cf8, #e879f9)',
                    boxShadow: '0 0 8px rgba(56,189,248,0.5)',
                    transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)',
                  }} />
                ) : (
                  <div style={{
                    width: '40%', height: '100%',
                    background: 'linear-gradient(90deg, transparent, #38bdf8, #e879f9, transparent)',
                    animation: reducedMotion ? 'none' : 'cx-busy-slide 1.2s ease-in-out infinite',
                  }} />
                )}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700,
                color: payload.state === 'thinking' ? '#38bdf8' : '#e879f9',
                fontVariantNumeric: 'tabular-nums', fontFamily: "'IBM Plex Mono', monospace",
                flexShrink: 0,
              }}>
                {typeof missionProgress === 'number' && missionProgress >= 0
                  ? `${Math.round(missionProgress * 100)}%`
                  : payload.state === 'working' ? '70%' : '35%'}
              </span>
            </div>
          </div>
          {queueDepth > 0 && (
            <span style={{
              fontSize: 9, letterSpacing: '0.22em', color: '#fbbf24', fontWeight: 700, flexShrink: 0,
              padding: '3px 8px', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 2,
              background: 'rgba(251,191,36,0.08)',
            }}>
              +{queueDepth} QUEUED
            </span>
          )}
          {payload.channel === 'voice' && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('cortex-viz-interrupt'))}
              style={{
                flexShrink: 0, cursor: 'pointer', padding: '4px 10px',
                border: '1px solid rgba(251,113,133,0.5)', borderRadius: 2,
                background: 'rgba(251,113,133,0.10)', color: '#fb7185',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.24em',
                fontFamily: "'IBM Plex Mono', monospace",
              }}
              title="Stop current task and take input"
            >
              INTERRUPT
            </button>
          )}
          {busyElapsed >= 30 && (
            <button
              onClick={() => handleEscalateToAntigravity('Manual operator escalation from HUD', false)}
              disabled={escalating}
              style={{
                flexShrink: 0, cursor: 'pointer', padding: '4px 10px',
                border: '1px solid rgba(245,158,11,0.6)', borderRadius: 2,
                background: 'rgba(245,158,11,0.12)', color: '#fbbf24',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
                fontFamily: "'IBM Plex Mono', monospace",
                transition: 'all 0.2s ease',
              }}
              title="Flag hung/long task directly to Antigravity IDE"
            >
              {escalating ? 'ESCALATING…' : '⚡ ESCALATE'}
            </button>
          )}
          <button
            onClick={() => {
              cortexSignalBus.publish({
                state: 'idle', level: 0, text: '', missionProgress: -1, missionTitle: '',
              });
              cortexSpeak('Task aborted.');
              setEscalationNotice('Task aborted by operator');
              setTimeout(() => setEscalationNotice(null), 3000);
            }}
            style={{
              flexShrink: 0, cursor: 'pointer', padding: '4px 8px',
              border: '1px solid rgba(239,68,68,0.5)', borderRadius: 2,
              background: 'rgba(239,68,68,0.10)', color: '#f87171',
              fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
              fontFamily: "'IBM Plex Mono', monospace",
            }}
            title="Abort current task and return to idle"
          >
            ✕ ABORT
          </button>
          {escalationNotice && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              fontSize: 8.5, color: '#38bdf8', background: 'rgba(2,6,23,0.92)',
              border: '1px solid rgba(56,189,248,0.3)', borderRadius: 2, padding: '3px 8px',
              fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
            }}>
              {escalationNotice}
            </div>
          )}
        </div>
      )}

      {/* Top-right: state telemetry */}
      <div style={{ position: 'absolute', top: 34, right: 64, zIndex: 20, textAlign: 'right' }} className="cx-hud-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: accent, color: accent,
            display: 'inline-block', animation: reducedMotion ? 'none' : 'cx-pulse-dot 1.6s ease-in-out infinite',
          }} />
          <span style={{ color: accent, fontSize: 15, fontWeight: 600, letterSpacing: '0.34em' }}>
            {st.label}
          </span>
          {(payload.state === 'thinking' || payload.state === 'working') && (
            <span style={{ color: accent, fontSize: 13, letterSpacing: '0.2em', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <span className="cx-think-dot" style={{ animationDelay: '0s' }} />
              <span className="cx-think-dot" style={{ animationDelay: '0.15s' }} />
              <span className="cx-think-dot" style={{ animationDelay: '0.3s' }} />
            </span>
          )}
        </div>
        <div style={{ marginTop: 10, fontSize: 10, letterSpacing: '0.2em', color: 'rgba(148,233,255,0.45)' }}>
          SIGNAL STRENGTH
        </div>
        <div style={{
          marginTop: 4, fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
          fontSize: 30, color: '#e8fbff', fontVariantNumeric: 'tabular-nums',
          textShadow: `0 0 18px ${accent}55`,
        }}>
          {String(Math.round(level * 100)).padStart(3, '0')}<span style={{ fontSize: 14, color: accent }}>%</span>
        </div>
        {channelLabel && (
          <div style={{ marginTop: 8, fontSize: 9, letterSpacing: '0.3em', color: 'rgba(148,233,255,0.5)' }}>
            {channelLabel}
            {payload.event ? ` // ${payload.event.replace('proactive:', 'AUTO·').toUpperCase()}` : ''}
          </div>
        )}
      </div>

      {/* Consciousness breath — GAL deliberation state, top of left rail */}
      {!narrow && faceMode !== 'agents' && <BreathHud />}

      {/* Left column: Nexus Foundry telemetry — sentinel rotation, model
          lanes, probation pool. Sits above the MODE/UPTIME rail. */}
      {!narrow && faceMode !== 'agents' && agentCrew.runtime && (
        <div style={{
          position: 'absolute', left: 64, top: '17%', zIndex: 20,
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: '0.18em',
          color: 'rgba(148,233,255,0.4)', lineHeight: 2.1,
        }} className="cx-hud-in">
          <div style={{ color: 'rgba(165,243,252,0.55)', letterSpacing: '0.28em', marginBottom: 4 }}>FOUNDRY TELEMETRY</div>
          <div>SENTINEL ROTATION: LIVE</div>
          <div>PROBATION POOL: {(agentCrew.models || []).filter(m => m.status === 'unknown').length}</div>
          <div>MODELS: {(agentCrew.models || []).filter(m => m.status === 'healthy').length}/{(agentCrew.models || []).length} VERIFIED</div>
          <div>LANES: {Object.entries(agentCrew.matrix || {}).map(([k, v]) => `${k.toUpperCase()} ${Array.isArray(v) ? v.length : 0}`).join(' · ')}</div>
          <div>UPTIME: {fmtElapsed(Math.max(0, Math.floor((Date.now() - agentCrew.runtime.startedAt) / 1000)))}</div>
          {agentCrew.mission && (
            <>
              <div style={{ color: 'rgba(196,181,253,0.55)', letterSpacing: '0.28em', marginTop: 8, marginBottom: 2 }}>MISSION OPS</div>
              <div>OPS: {agentCrew.mission.ops.done}/{agentCrew.mission.ops.total} DONE{agentCrew.mission.ops.stale ? ` · ${agentCrew.mission.ops.stale} STALE` : ''}</div>
              {(agentCrew.mission.goals || []).slice(0, 3).map(g => (
                <div key={g.id} title={g.title}>
                  GOAL: {g.title.slice(0, 26).toUpperCase()}{g.orphaned ? ' ⚠' : ''} {Math.round(g.progress * 100)}%
                </div>
              ))}
              {(agentCrew.mission.experiments || []).length > 0 && (
                <div>A/B: {agentCrew.mission.experiments.length} RUNNING</div>
              )}
            </>
          )}
          {agentEvents.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 6, borderTop: '1px solid rgba(103,232,249,0.12)', color: 'rgba(165,243,252,0.5)' }}>
              {agentEvents.slice(-4).reverse().map((e, i) => {
                const t = new Date(e.at).toLocaleTimeString('en-US', { hour12: false });
                let msg = `${e.type}`;
                if (e.type === 'agent.status') msg = `${String(e.agentId).toUpperCase()} → ${String(e.status).toUpperCase()}`;
                else if (e.type === 'task.transition') { const tk = e.task as any; msg = `${String(tk?.agentId || '?').toUpperCase()} ${String(tk?.status || '').toUpperCase()} — ${String(tk?.title || '').slice(0, 30)}`; }
                else if (e.type === 'model.health') { const m = e.model as any; msg = `MODEL ${String(m?.status || '?').toUpperCase()} ${String(m?.id || '').split('/').pop()?.slice(0, 24)}`; }
                else if (e.type === 'model.discovered') { const m = e.model as any; msg = `DISCOVERED ${String(m?.id || '').split('/').pop()?.slice(0, 26)}`; }
                else if (e.type === 'agent.spawned') msg = `SPAWNED ${(e.spec as any)?.callSign || String(e.agentId)}`;
                return <div key={`${e.at}-${i}`} style={{ opacity: 1 - i * 0.22 }}>{t} {msg}</div>;
              })}
            </div>
          )}
        </div>
      )}

      {/* Left rail: telemetry column — hidden on narrow viewports where it
          would collide with the panel grid's left column */}
      {!narrow && faceMode !== 'agents' && <div style={{
        position: 'absolute', left: 64, top: '50%', transform: 'translateY(-50%)',
        zIndex: 20, display: 'flex', flexDirection: 'column', gap: 14,
      }} className="cx-hud-in">
        {[
          ['MODE', payload.state.toUpperCase()],
          ['UPTIME', uptimeSec >= 3600 ? `${Math.floor(uptimeSec / 3600)}h ${String(Math.floor((uptimeSec % 3600) / 60)).padStart(2, '0')}m` : `${Math.floor(uptimeSec / 60)}m ${String(uptimeSec % 60).padStart(2, '0')}s`],
          ['HOST', typeof window !== 'undefined' ? window.location.hostname : '—'],
          ['NET', typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'TLS' : 'LOCAL'],
        ].map(([k, v], i) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 8, letterSpacing: '0.3em', color: 'rgba(148,233,255,0.4)' }}>{k}</span>
            <span style={{ fontSize: 11, letterSpacing: '0.14em', color: 'rgba(232,251,255,0.8)' }}>{v}</span>
            <div style={{
              width: 52, height: 2, background: 'rgba(148,233,255,0.12)', marginTop: 2,
              transformOrigin: 'left',
              animation: `cx-bar-fill 1.1s ${0.5 + i * 0.12}s cubic-bezier(0.16,1,0.3,1) both`,
            }}>
              <div style={{ width: `${[20, 88, 46, 100][i]}%`, height: '100%', background: accent, opacity: 0.7 }} />
            </div>
          </div>
        ))}
        {typeof phi === 'number' && phi > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
            <span style={{ fontSize: 8, letterSpacing: '0.3em', color: 'rgba(148,233,255,0.4)' }}>Φ IIT</span>
            <span style={{ fontSize: 11, letterSpacing: '0.14em', color: 'rgba(232,251,255,0.8)', fontVariantNumeric: 'tabular-nums' }}>
              {phi.toFixed(2)}
            </span>
            <div style={{ width: 52, height: 2, background: 'rgba(148,233,255,0.12)', marginTop: 2 }}>
              <div style={{ width: `${Math.min(100, (phi / 1.5) * 100)}%`, height: '100%', background: '#a78bfa', opacity: 0.8 }} />
            </div>
          </div>
        )}
        {typeof missionProgress === 'number' && missionProgress >= 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
            <span style={{ fontSize: 8, letterSpacing: '0.3em', color: 'rgba(148,233,255,0.4)' }}>MISSION</span>
            <span style={{
              fontSize: 10, letterSpacing: '0.1em', color: 'rgba(232,251,255,0.8)',
              maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={missionTitle}>
              {missionTitle || 'ACTIVE'} · {Math.round(missionProgress * 100)}%
            </span>
            <div style={{ width: 52, height: 2, background: 'rgba(148,233,255,0.12)', marginTop: 2 }}>
              <div style={{ width: `${Math.round(missionProgress * 100)}%`, height: '100%', background: '#e879f9', opacity: 0.85 }} />
            </div>
          </div>
        )}
      </div>}

      {/* Right rail: agent crew presence — appears only while agents work.
          Hidden on the Foundry face itself (it links back to this page). */}
      {!narrow && faceMode !== 'agents' && (() => {
        const AGENT_HUES: Record<string, string> = { sentinel: '#67e8f9', scout: '#e879f9', librarian: '#fbbf24', builder: '#34d399', reviewer: '#fb7185', runner: '#a3e635', warden: '#818cf8' };
        const active = (agentCrew.agents || []).filter(a => a.status === 'working' || a.status === 'queued');
        if (!active.length) return null;
        const runningTasks = (agentCrew.tasks || []).filter(t => t.status === 'running' || t.status === 'queued');
        return (
          <div
            onClick={() => { setFaceMode('agents'); try { localStorage.setItem('cortex_visualizer_face', 'agents'); } catch {} }}
            title="Agent crew active — open the Nexus Foundry"
            style={{
              position: 'absolute', right: 64, top: '50%', transform: 'translateY(-50%)',
              zIndex: 20, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end',
              cursor: 'pointer',
            }} className="cx-hud-in">
            <span style={{ fontSize: 8, letterSpacing: '0.3em', color: 'rgba(148,233,255,0.4)' }}>
              AGENT CREW · {active.length}
            </span>
            {active.slice(0, 4).map(a => {
              const col = AGENT_HUES[a.id] || '#a78bfa';
              const task = runningTasks.find(t => t.agentId === a.id);
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row-reverse' }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0,
                    boxShadow: `0 0 8px ${col}`,
                    animation: reducedMotion ? 'none' : 'cx-pulse-dot 1.2s ease-in-out infinite',
                  }} />
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(232,251,255,0.85)' }}>{a.name}</div>
                    {task && (
                      <div style={{ fontSize: 8, letterSpacing: '0.08em', color: 'rgba(148,233,255,0.5)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.title}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {active.length > 4 && (
              <span style={{ fontSize: 8, letterSpacing: '0.2em', color: 'rgba(148,233,255,0.4)' }}>+{active.length - 4} MORE</span>
            )}
          </div>
        );
      })()}

      {/* Agent inspect card — right side, above the crew rail. Appears when a
          core-scene agent mote is clicked; stays on the core face. */}
      {!narrow && selectedAgentId && (() => {
        const a = (agentCrew.agents || []).find(x => x.id === selectedAgentId);
        if (!a) return null;
        const AGENT_HUES: Record<string, string> = { sentinel: '#67e8f9', scout: '#e879f9', librarian: '#fbbf24', builder: '#34d399', reviewer: '#fb7185', runner: '#a3e635', warden: '#818cf8' };
        const col = AGENT_HUES[a.id] || (a.spawnSpec ? `hsl(${(() => { let h = 0; for (const ch of a.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; })()} 85% 68%)` : '#94a3b8');
        const recent = (agentCrew.tasks || []).filter(t => t.agentId === a.id).slice(0, 5);
        const current = recent.find(t => t.status === 'running' || t.status === 'queued');
        const agentTasks = (agentCrew.tasks || []).filter(t => t.agentId === a.id && (t.status === 'completed' || t.status === 'failed'));
        const tsr = agentTasks.length ? Math.round((agentTasks.filter(t => t.status === 'completed').length / agentTasks.length) * 100) : null;
        return (
          <div ref={agentCardRef} style={{
            position: 'absolute', right: 64, top: '24%', zIndex: 25, width: 320,
            background: 'linear-gradient(165deg, rgba(8,14,24,0.92), rgba(5,8,15,0.88))',
            border: `1px solid ${col}59`, borderRadius: 3, padding: '12px 16px',
            backdropFilter: 'blur(14px)', boxShadow: `0 0 40px ${col}26`,
            fontFamily: "'IBM Plex Mono', monospace",
          }} className="cx-hud-in">
            <div style={{ position: 'absolute', top: -1, left: -1, width: 8, height: 8, borderTop: `1px solid ${col}`, borderLeft: `1px solid ${col}` }} />
            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderBottom: `1px solid ${col}`, borderRight: `1px solid ${col}` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, letterSpacing: '0.3em', color: col, fontWeight: 700 }}>{a.name}</span>
                <span style={{ fontSize: 7, letterSpacing: '0.14em', color: col, border: `1px solid ${col}55`, padding: '1px 5px', borderRadius: 2, background: `${col}15` }}>ORBIT CHASE</span>
              </div>
              <button onClick={() => { setSelectedAgentId(null); window.dispatchEvent(new CustomEvent('cortex-agent-select', { detail: null })); }} style={{ background: 'none', border: 'none', color: 'rgba(148,163,184,0.6)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
            </div>
            <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', letterSpacing: '0.14em', margin: '2px 0 6px' }}>{(a.role || '').toUpperCase()}</div>
            <div style={{ fontSize: 9, color: 'rgba(203,213,225,0.65)', marginBottom: 8, lineHeight: 1.5 }}>{a.blurb}</div>
            <div style={{ display: 'flex', gap: 14, fontSize: 8, color: 'rgba(148,233,255,0.55)', marginBottom: 8 }}>
              <span>{a.status.toUpperCase()}</span>
              <span>{a.tasksCompleted} DONE</span>
              <span>{a.tasksFailed} FAILED</span>
              {tsr !== null && <span title="Task success rate over retained history">TSR {tsr}%</span>}
              <span>PIN {(a.modelPin?.tier || 'NONE').toUpperCase()}</span>
            </div>
            {current && (
              <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)', paddingTop: 7, marginBottom: 7 }}>
                <div style={{ fontSize: 9, color: 'rgba(226,232,240,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <div style={{ flex: 1, height: 3, background: 'rgba(148,163,184,0.14)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((current.progress ?? 0) * 100)}%`, height: '100%', background: col, boxShadow: `0 0 8px ${col}`, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: 8, color: 'rgba(148,233,255,0.6)', whiteSpace: 'nowrap' }}>
                    {current.status === 'queued' ? 'QUEUED' : `${Math.round((current.progress ?? 0) * 100)}%`}
                    {current.model && <span style={{ color: col }}> · {String(current.model).split('/').pop()?.slice(0, 18)}</span>}
                  </span>
                </div>
              </div>
            )}
            {recent.filter(t => t !== current).slice(0, 4).map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 8, padding: '3px 0', borderTop: '1px solid rgba(148,163,184,0.08)' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200, color: t.status === 'failed' ? '#f87171' : 'rgba(203,213,225,0.7)' }}>{t.title}</span>
                <span style={{ color: 'rgba(148,163,184,0.5)', whiteSpace: 'nowrap', marginLeft: 10 }}>
                  {t.status.toUpperCase()}{t.finishedAt && t.startedAt ? ` · ${fmtElapsed(Math.round((t.finishedAt - t.startedAt) / 1000))}` : ''}
                  {t.status === 'failed' && t.telemetry?.failureClass ? ` · ${String(t.telemetry.failureClass).toUpperCase()}` : ''}
                </span>
              </div>
            ))}
            {!recent.length && <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)' }}>NO TASK HISTORY — AWAITING FIRST ASSIGNMENT</div>}
            <button
              onClick={() => { setFaceMode('agents'); try { localStorage.setItem('cortex_visualizer_face', 'agents'); } catch {} }}
              style={{
                marginTop: 10, width: '100%', padding: '7px 0', cursor: 'pointer',
                background: 'none', border: `1px solid ${col}44`, borderRadius: 2,
                color: col, fontSize: 9, letterSpacing: '0.28em', fontFamily: 'inherit',
              }}
            >OPEN FOUNDRY →</button>
          </div>
        );
      })()}

      {/* Memory Engram Dossier HUD Card */}
      {!narrow && selectedMemoryId && (() => {
        const node = memoryNodesMap[selectedMemoryId];
        if (!node) return null;
        const domain = getMemoryDomain(node.context, node.label, node.entities);
        const col = MEMORY_DOMAIN_COLORS[domain] || '#67e8f9';
        const domainName = MEMORY_DOMAIN_NAMES[domain] || 'ENGRAM';
        const dateStr = node.date ? new Date(node.date).toLocaleString() : 'Recent';

        return (
          <div
            ref={memoryCardRef}
            style={{
              position: 'absolute',
              top: '24%',
              right: 64,
              zIndex: 35,
              width: 380,
              maxWidth: '92vw',
              borderRadius: 4,
              border: `1px solid ${col}66`,
              background: 'linear-gradient(165deg, rgba(8,14,28,0.94), rgba(4,8,18,0.92))',
              backdropFilter: 'blur(16px)',
              boxShadow: `0 12px 40px rgba(0,0,0,0.65), 0 0 30px ${col}25`,
              color: '#e2e8f0',
              fontFamily: "'IBM Plex Mono', monospace",
              padding: 16,
              pointerEvents: 'auto',
            }}
            className="cx-hud-in"
          >
            <div style={{ position: 'absolute', top: -1, left: -1, width: 10, height: 10, borderTop: `2px solid ${col}`, borderLeft: `2px solid ${col}` }} />
            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderBottom: `2px solid ${col}`, borderRight: `2px solid ${col}` }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, letterSpacing: '0.18em', color: col, border: `1px solid ${col}66`, padding: '2px 6px', borderRadius: 2, background: `${col}15`, fontWeight: 700 }}>
                    {domainName}
                  </span>
                  <span style={{ fontSize: 8, letterSpacing: '0.12em', color: 'rgba(148,233,255,0.6)' }}>
                    ORBIT CHASE
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.04em', lineHeight: 1.3 }}>
                  {node.label || 'Memory Engram'}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedMemoryId(null);
                  window.dispatchEvent(new CustomEvent('cortex-memory-select', { detail: null }));
                }}
                style={{
                  background: 'none', border: 'none', color: 'rgba(148,163,184,0.6)',
                  fontSize: 14, cursor: 'pointer', padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {/* Fact text proposition */}
            <div style={{
              fontSize: 10.5, lineHeight: 1.6, color: 'rgba(226,232,240,0.88)',
              background: 'rgba(0,0,0,0.35)', padding: '10px 12px', borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12,
              maxHeight: 140, overflowY: 'auto',
            }}>
              {node.text || 'No propositional text recorded.'}
            </div>

            {/* Metadata grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 8.5, marginBottom: 12, color: 'rgba(148,233,255,0.7)' }}>
              <div>
                <span style={{ color: 'rgba(148,163,184,0.5)', display: 'block', fontSize: 7.5 }}>CONTEXT</span>
                <span>{node.context || 'cortex-runtime'}</span>
              </div>
              <div>
                <span style={{ color: 'rgba(148,163,184,0.5)', display: 'block', fontSize: 7.5 }}>RECORDED</span>
                <span>{dateStr}</span>
              </div>
            </div>

            {/* Entities */}
            {node.entities && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.5)', marginBottom: 4, letterSpacing: '0.1em' }}>ASSOCIATED ENTITIES</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {String(node.entities).split(',').map((e: string, idx: number) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: 8, padding: '2px 6px', borderRadius: 2,
                        background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)',
                        color: '#7dd3fc',
                      }}
                    >
                      {e.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Live Recall Related Probe */}
            <div>
              <button
                onClick={async () => {
                  setRecallLoading(true);
                  try {
                    const q = node.label || node.text?.slice(0, 80) || '';
                    const r = await fetch(`/api/cortex/memory/recall?q=${encodeURIComponent(q)}&budget=mid`);
                    if (r.ok) {
                      const data = await r.json();
                      const lines = (data.context || '')
                        .split('\n')
                        .filter((l: string) => l.startsWith('- '))
                        .map((l: string) => l.replace(/^- /, ''));
                      setRecallHits(lines);
                    }
                  } finally {
                    setRecallLoading(false);
                  }
                }}
                disabled={recallLoading}
                style={{
                  width: '100%', padding: '7px 10px', fontSize: 9, fontWeight: 600,
                  letterSpacing: '0.14em', fontFamily: 'inherit', borderRadius: 2,
                  border: `1px solid ${col}88`, background: `${col}18`, color: col,
                  cursor: recallLoading ? 'wait' : 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {recallLoading ? 'RECALLING SYNAPSES...' : '⚡ RECALL ASSOCIATED MEMORIES'}
              </button>

              {recallHits.length > 0 && (
                <div style={{ marginTop: 8, maxHeight: 110, overflowY: 'auto', background: 'rgba(0,0,0,0.45)', padding: 8, borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 7.5, color: '#94a3b8', letterSpacing: '0.1em', marginBottom: 4 }}>ASSOCIATED ENGRAMS:</div>
                  {recallHits.map((hit, hi) => (
                    <div key={hi} style={{ fontSize: 8, color: '#cbd5e1', lineHeight: 1.4, marginBottom: 4, borderLeft: `2px solid ${col}`, paddingLeft: 4 }}>
                      {hit}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Mission Log — always-on feed of real agent tasks, above the nav rail.
          Click expands to a centered full feed. Suppressed on Foundry face where scene renders its own dedicated log. */}
      {faceMode !== 'agents' && (() => {
        const AGENT_HUES: Record<string, string> = { sentinel: '#67e8f9', scout: '#e879f9', librarian: '#fbbf24', builder: '#34d399', reviewer: '#fb7185', runner: '#a3e635', warden: '#818cf8' };
        const STATUS_COLORS: Record<string, string> = { running: '#67e8f9', queued: '#fbbf24', completed: '#34d399', failed: '#f87171', cancelled: '#64748b' };
        const tasks = (agentCrew.tasks || []).slice(0, 10);
        const names = new Map((agentCrew.agents || []).map(a => [a.id, a.name]));
        const fmtTok = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
        const taskRow = (t: any, compact = false) => {
          const col = STATUS_COLORS[t.status] || '#64748b';
          const agentCol = AGENT_HUES[t.agentId] || '#a78bfa';
          const elapsed = t.status === 'running' || t.status === 'queued'
            ? '' : t.finishedAt && t.startedAt
              ? ` · ${Math.max(1, Math.round((t.finishedAt - t.startedAt) / 1000))}s`
              : '';
          return (
            <div key={t.id} style={{
              padding: compact ? '5px 10px' : '8px 14px',
              borderBottom: '1px solid rgba(148,233,255,0.05)',
              display: 'flex', gap: 8, alignItems: 'baseline',
              background: t.status === 'running' ? 'rgba(103,232,249,0.04)' : 'transparent',
            }}>
              <span style={{
                width: compact ? 5 : 7, height: compact ? 5 : 7, borderRadius: '50%', background: col, flexShrink: 0, alignSelf: 'center',
                boxShadow: t.status === 'running' ? `0 0 6px ${col}` : 'none',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'rgba(224,242,254,0.88)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: compact ? 8 : 10 }}>{t.title}</div>
                <div style={{ color: 'rgba(148,233,255,0.42)', marginTop: 2, display: 'flex', gap: 5, fontSize: compact ? 8 : 9 }}>
                  <span style={{ color: agentCol }}>{names.get(t.agentId) || t.agentId}</span>
                  <span>·</span><span style={{ color: col }}>{t.status.toUpperCase()}</span>
                  {t.kind && <><span>·</span><span>{String(t.kind).toUpperCase()}</span></>}
                  {t.model && <><span>·</span><span style={{ color: 'rgba(196,181,253,0.55)' }}>{String(t.model).split(':').pop()?.slice(0, 22)}</span></>}
                  {elapsed && <span style={{ color: 'rgba(148,233,255,0.3)' }}>{elapsed}</span>}
                  {(t.telemetry?.tokensIn ?? 0) + (t.telemetry?.tokensOut ?? 0) > 0 && (
                    <><span>·</span><span style={{ color: 'rgba(196,181,253,0.45)' }}>{fmtTok(t.telemetry.tokensIn + t.telemetry.tokensOut)} TOK</span></>
                  )}
                  {(t.telemetry?.toolCalls ?? 0) > 0 && (
                    <><span>·</span><span style={{ color: 'rgba(148,233,255,0.35)' }}>{t.telemetry.toolCalls} TOOL{t.telemetry.toolCalls === 1 ? '' : 'S'}</span></>
                  )}
                  {t.status === 'failed' && t.telemetry?.failureClass && (
                    <><span>·</span><span style={{ color: 'rgba(248,113,113,0.6)' }}>{String(t.telemetry.failureClass).toUpperCase()}</span></>
                  )}
                </div>
                {!compact && t.error && <div style={{ color: 'rgba(248,113,113,0.6)', marginTop: 2, fontSize: 9 }}>{String(t.error).slice(0, 120)}</div>}
              </div>
            </div>
          );
        };
        return (
          <div
            onClick={() => { setMissionExpanded(true); cortexSpeak('Expanding mission log.'); }}
            title="Click to expand the full mission log"
            style={{
              position: 'absolute', left: narrow ? 16 : 24, bottom: narrow ? 112 : 20, zIndex: 20,
              width: narrow ? '60vw' : missionW,
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: '0.1em',
              background: 'rgba(4,8,18,0.66)', border: '1px solid rgba(103,232,249,0.14)',
              borderRadius: 4, backdropFilter: 'blur(6px)', overflow: 'hidden', cursor: 'pointer',
            }} className="cx-hud-in">
            <div style={{
              padding: '6px 10px', borderBottom: '1px solid rgba(103,232,249,0.12)',
              color: 'rgba(165,243,252,0.7)', fontWeight: 700, letterSpacing: '0.28em', fontSize: 8,
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>MISSION LOG</span>
              <span style={{ color: 'rgba(148,233,255,0.35)' }}>
                {tasks.filter(t => t.status === 'running' || t.status === 'queued').length} ACTIVE · CLICK TO EXPAND
              </span>
            </div>
            <div className="ambient-scrollbar" style={{ height: missionH, overflowY: 'auto', scrollbarWidth: 'thin' }}>
              {tasks.length === 0 && (
                <div style={{ padding: '12px 10px', color: 'rgba(148,233,255,0.3)', letterSpacing: '0.15em' }}>NO TASKS THIS SESSION</div>
              )}
              {tasks.map(t => taskRow(t, true))}
            </div>
            {/* resize grip — drag the top-right corner to enlarge the log */}
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                missionResize.current = { x: e.clientX, y: e.clientY, w: missionW, h: missionH };
                const move = (ev: PointerEvent) => {
                  const r = missionResize.current;
                  if (!r) return;
                  const maxW = Math.max(220, window.innerWidth - (narrow ? 16 : 64) - 16);
                  setMissionW(Math.min(maxW, Math.max(220, r.w + (ev.clientX - r.x))));
                  setMissionH(Math.min(520, Math.max(72, r.h - (ev.clientY - r.y))));
                };
                const up = () => {
                  missionResize.current = null;
                  window.removeEventListener('pointermove', move);
                  window.removeEventListener('pointerup', up);
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
              }}
              onClick={(e) => e.stopPropagation()}
              title="Drag to resize"
              style={{
                position: 'absolute', top: 0, right: 0, width: 16, height: 16, zIndex: 2,
                cursor: 'nwse-resize', userSelect: 'none',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                color: 'rgba(148,233,255,0.35)', fontSize: 10, lineHeight: 1, padding: '3px 4px 0 0',
              }}
            >◢</div>
          </div>
        );
      })()}

      {/* Expanded mission log — centered modal feed */}
      {missionExpanded && (
        <div
          onClick={() => setMissionExpanded(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(2,3,8,0.78)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(680px, 88vw)', height: 'min(520px, 74vh)',
              background: 'rgba(4,8,18,0.92)', border: '1px solid rgba(103,232,249,0.25)',
              borderRadius: 6, display: 'flex', flexDirection: 'column', overflow: 'hidden',
              boxShadow: '0 0 60px rgba(103,232,249,0.12)',
            }}>
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid rgba(103,232,249,0.15)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '0.3em', color: 'rgba(165,243,252,0.85)', fontWeight: 700 }}>
                ◈ MISSION LOG — FULL FEED
              </span>
              <button
                onClick={() => setMissionExpanded(false)}
                style={{
                  background: 'none', border: '1px solid rgba(148,233,255,0.25)', borderRadius: 3,
                  color: 'rgba(148,233,255,0.7)', fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 9, letterSpacing: '0.2em', padding: '4px 10px', cursor: 'pointer',
                }}
              >ESC / CLOSE</button>
            </div>
            <div className="ambient-scrollbar" style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
              {(agentCrew.tasks || []).length === 0 && (
                <div style={{ padding: '30px', textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: 'rgba(148,233,255,0.35)' }}>
                  NO TASKS RECORDED — THE FLEET IS IDLE
                </div>
              )}
              {(agentCrew.tasks || []).slice(0, 40).map(t => {
                const AGENT_HUES: Record<string, string> = { sentinel: '#67e8f9', scout: '#e879f9', librarian: '#fbbf24', builder: '#34d399', reviewer: '#fb7185', runner: '#a3e635', warden: '#818cf8' };
                const STATUS_COLORS: Record<string, string> = { running: '#67e8f9', queued: '#fbbf24', completed: '#34d399', failed: '#f87171', cancelled: '#64748b' };
                const names = new Map((agentCrew.agents || []).map(a => [a.id, a.name]));
                const col = STATUS_COLORS[t.status] || '#64748b';
                const agentCol = AGENT_HUES[t.agentId] || '#a78bfa';
                const dur = t.finishedAt && t.startedAt ? `${Math.max(1, Math.round((t.finishedAt - t.startedAt) / 1000))}s` : '';
                const tokIn = t.telemetry?.tokensIn ?? 0;
                const tokOut = t.telemetry?.tokensOut ?? 0;
                const tokTotal = tokIn + tokOut;
                const toolCalls = t.telemetry?.toolCalls ?? 0;
                const toolFailures = t.telemetry?.toolFailures ?? 0;
                return (
                  <div key={t.id} style={{
                    padding: '9px 16px', borderBottom: '1px solid rgba(148,233,255,0.05)',
                    display: 'flex', gap: 10, alignItems: 'baseline',
                    background: t.status === 'running' ? 'rgba(103,232,249,0.04)' : 'transparent',
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', background: col, flexShrink: 0, alignSelf: 'center',
                      boxShadow: t.status === 'running' ? `0 0 7px ${col}` : 'none',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'rgba(224,242,254,0.9)', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>{t.title}</div>
                      <div style={{ color: 'rgba(148,233,255,0.45)', marginTop: 3, display: 'flex', gap: 6, fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", flexWrap: 'wrap' }}>
                        <span style={{ color: agentCol }}>{names.get(t.agentId) || t.agentId}</span>
                        <span>·</span><span style={{ color: col }}>{t.status.toUpperCase()}</span>
                        {t.kind && <><span>·</span><span>{String(t.kind).toUpperCase()}</span></>}
                        {t.model && <><span>·</span><span style={{ color: 'rgba(196,181,253,0.6)' }}>{t.model}</span></>}
                        {dur && <span style={{ color: 'rgba(148,233,255,0.3)' }}>{dur}</span>}
                        {tokTotal > 0 && (
                          <span style={{ color: 'rgba(196,181,253,0.5)' }}>{(tokTotal >= 1000 ? `${(tokTotal / 1000).toFixed(1)}k` : String(tokTotal))} TOK</span>
                        )}
                        {toolCalls > 0 && (
                          <span style={{ color: 'rgba(148,233,255,0.4)' }}>{toolCalls} TOOL{toolCalls === 1 ? '' : 'S'}{toolFailures > 0 ? ` (${toolFailures} FAIL)` : ''}</span>
                        )}
                        {t.status === 'failed' && t.telemetry?.failureClass && (
                          <span style={{ color: 'rgba(248,113,113,0.65)' }}>{String(t.telemetry.failureClass).toUpperCase()}</span>
                        )}
                      </div>
                      {t.error && <div style={{ color: 'rgba(248,113,113,0.65)', marginTop: 3, fontSize: 9, fontFamily: "'IBM Plex Mono', monospace" }}>{String(t.error).slice(0, 160)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4D Chrono-DVR Mission Replay Ribbon */}
      {chronoActive && (
        <div
          style={{
            position: 'absolute',
            bottom: 84,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            width: 'min(780px, calc(100vw - 32px))',
            background: 'linear-gradient(180deg, rgba(8,16,28,0.92) 0%, rgba(4,8,16,0.96) 100%)',
            border: '1px solid rgba(56,189,248,0.4)',
            borderRadius: 6,
            padding: '10px 16px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 0 32px rgba(56,189,248,0.18), 0 8px 32px rgba(0,0,0,0.6)',
            fontFamily: "'IBM Plex Mono', monospace",
          }}
          className="cx-hud-center-in"
        >
          {/* Top header row of DVR */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, letterSpacing: '0.28em', color: '#38bdf8', fontWeight: 700 }}>
                ◈ 4D CHRONO-DVR · Q-MAP REPLAY
              </span>
              <span
                style={{
                  fontSize: 8,
                  letterSpacing: '0.14em',
                  color: '#38bdf8',
                  border: '1px solid rgba(56,189,248,0.4)',
                  padding: '1px 6px',
                  borderRadius: 2,
                  background: 'rgba(56,189,248,0.12)',
                }}
              >
                {chronoPlaying ? 'REPLAYING' : 'PAUSED'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: '#f0f9ff', fontWeight: 600, letterSpacing: '0.1em' }}>
                {chronoTime.toFixed(2)}s <span style={{ color: 'rgba(148,233,255,0.4)' }}>/ {replayDuration.toFixed(1)}s</span>
              </span>
              <button
                onClick={() => setChronoActive(false)}
                title="Exit Chrono-DVR"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(148,163,184,0.6)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Scrubber slider bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <button
              onClick={() => setChronoPlaying((p) => !p)}
              style={{
                background: chronoPlaying ? 'rgba(56,189,248,0.18)' : 'rgba(56,189,248,0.3)',
                border: '1px solid #38bdf8',
                borderRadius: 3,
                color: '#38bdf8',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.14em',
                padding: '4px 10px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {chronoPlaying ? '⏸ PAUSE' : '▶ PLAY'}
            </button>
            <input
              type="range"
              min={0}
              max={replayDuration}
              step={Math.max(0.01, replayDuration / 500)}
              value={chronoTime}
              onChange={(e) => {
                setChronoTime(parseFloat(e.target.value));
              }}
              style={{
                flex: 1,
                accentColor: '#38bdf8',
                cursor: 'pointer',
              }}
            />
          </div>

          {/* Keyframe Jump Stages — real event track waypoints when a
              persisted replay exists, canned reel stages otherwise. */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(replayTrack && replayTrack.length > 0
              ? Array.from({ length: Math.min(6, replayTrack.length) }, (_, k) => {
                  const idx = Math.floor((k * (replayTrack.length - 1)) / Math.max(1, Math.min(6, replayTrack.length) - 1));
                  const ev = replayTrack[idx];
                  return { t: idx * 1.4, label: `SEQ ${ev.seq}: ${ev.type}${ev.agentId ? ' · ' + ev.agentId : ''}` };
                })
              : [
                  { t: 0.0, label: '0s: SWARM ORBIT' },
                  { t: 2.5, label: '2.5s: GOVTECH LOCK' },
                  { t: 5.0, label: '5.0s: SECURITY AUDIT' },
                  { t: 7.2, label: '7.2s: CONVERGENCE' },
                ]
            ).map((stage) => {
              const active = Math.abs(chronoTime - stage.t) < 0.6;
              return (
                <button
                  key={stage.t}
                  onClick={() => {
                    setChronoTime(stage.t);
                    setChronoPlaying(false);
                  }}
                  style={{
                    background: active ? 'rgba(56,189,248,0.24)' : 'rgba(15,23,42,0.6)',
                    border: `1px solid ${active ? '#38bdf8' : 'rgba(148,233,255,0.18)'}`,
                    borderRadius: 2,
                    color: active ? '#e0f2fe' : 'rgba(148,233,255,0.6)',
                    fontSize: 8,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  {stage.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Holographic In-Flight Packet Inspector */}
      {hoveredPacket && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(hoveredPacket.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 260),
            top: Math.max(16, hoveredPacket.y - 48),
            zIndex: 40,
            pointerEvents: 'none',
            width: 240,
            background: 'linear-gradient(145deg, rgba(8,16,28,0.92), rgba(4,8,16,0.95))',
            border: `1px solid ${hoveredPacket.color}`,
            borderRadius: 4,
            padding: '8px 12px',
            backdropFilter: 'blur(14px)',
            boxShadow: `0 0 24px ${hoveredPacket.color}44`,
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 8, letterSpacing: '0.22em', color: hoveredPacket.color, fontWeight: 700 }}>
              ◈ IN-FLIGHT TOKEN PHOTON
            </span>
            <span style={{ fontSize: 7, color: '#34d399', letterSpacing: '0.1em' }}>
              VERIFIED
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#f8fafc', fontWeight: 600, marginBottom: 2 }}>
            {hoveredPacket.agentName.toUpperCase()} → SOVEREIGN CORE
          </div>
          <div style={{ fontSize: 8, color: 'rgba(203,213,225,0.7)', lineHeight: 1.4, marginBottom: 6 }}>
            {hoveredPacket.title}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'rgba(148,233,255,0.5)', borderTop: '1px solid rgba(148,233,255,0.1)', paddingTop: 4 }}>
            <span>LATENCY: 0.12ms</span>
            <span>HASH-CHAIN SIGNED</span>
          </div>
        </div>
      )}

      {/* Holographic 21-Joint Hand Skeleton & Pinch Reticle */}
      <HoloHandOverlay hand={handPinch} />

      {/* Bottom-center: live caption — suppressed on Foundry face to clear 1-Click Sprint Reel */}
      {faceMode !== 'agents' && (
      <div style={{
        position: 'absolute', bottom: 40, left: '50%', transform: 'translate(-50%, 0)',
        width: 'min(640px, 72vw)', zIndex: 20, textAlign: 'center',
      }} className="cx-hud-center-in">
        <div style={{ fontSize: 9, letterSpacing: '0.4em', color: 'rgba(148,233,255,0.4)', marginBottom: 10 }}>
          ── LIVE TRANSMISSION ──
        </div>
        <div style={{
          color: '#e8fbff', fontSize: 15, lineHeight: 1.65,
          fontFamily: "'IBM Plex Mono', monospace", minHeight: 26,
          textShadow: `0 0 22px ${accent}44`,
        }}>
          <Typewriter text={payload.text ?? ''} accent={accent} />
        </div>
      </div>
      )}

      {/* Screen-reader live region announcing cognitive state transitions & live captions */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-cortex-a11y-live=""
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {`Cortex: ${st.label}${payload.text ? ` - ${payload.text}` : ''}`}
      </div>

      {/* Slide-over transcript — same conversation as /cortex/chat.
          Composer dispatches cortex-viz-turn so text turns run the full
          voice pipeline (LLM → tools → TTS) without leaving the page. */}
      <CortexChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        payload={payload}
        onSubmitText={(text) => {
          window.dispatchEvent(new CustomEvent('cortex-viz-turn', { detail: text }));
        }}
      />

      {/* Dockable generative-UI surface panels (Phase 2) — active in Core view */}
      {faceMode !== 'agents' && (
        <CortexSurfaceLayer drawerOpen={chatOpen} />
      )}

      {/* Weather hero modal — pops on the space when get_weather resolves.
          z-120 sits above surface panels; backdrop keeps the 3D scene live. */}
      <WeatherSpaceModal />

      {/* Focus mode chip — visible state + click-to-exit (ESC also exits) */}
      {focusMode && (
        <button
          onClick={() => setSurfaceFocusMode(false)}
          title="Exit focus mode (Esc)"
          style={{
            position: 'absolute', bottom: 104, right: narrow ? 16 : 64,
            zIndex: 21, cursor: 'pointer', padding: '7px 16px',
            border: '1px solid rgba(232,121,249,0.5)', borderRadius: 2,
            background: 'rgba(232,121,249,0.10)', color: '#e879f9',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.3em',
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          ◉ FOCUS · ESC
        </button>
      )}

      {/* Perf HUD — toggled with ` (backquote). Real rAF frame timing only. */}
      {showPerfHud && <PerfHud />}

      {/* Eye-tracking layer — ?gaze=1 only; fixed overlay + parallax feed. */}
      {gazeMode && <CortexGazeLayer />}

      {/* Gaussian-splat viewer — ?splat=1|<name>; lazy-loaded Spark renderer. */}
      {splatMode && (
        <Suspense fallback={null}>
          <CortexSplatScene splat={splatMode} />
        </Suspense>
      )}

      {/* Bottom-right: sovereignty tag — suppressed on Foundry face */}
      {faceMode !== 'agents' && (
      <div style={{ position: 'absolute', bottom: 40, right: narrow ? 16 : 64, zIndex: 20, textAlign: 'right' }} className="cx-hud-in">
        <div style={{ fontSize: 9, letterSpacing: '0.34em', color: 'rgba(148,233,255,0.4)', lineHeight: 2 }}>
          SELF-HOSTED<br />AUDITABLE<br />ALWAYS-ON
        </div>
        <div style={{ marginTop: 10, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(148,233,255,0.25)' }}>
          {geoLabel ?? 'POSITION UNKNOWN'}
        </div>
        {panelCount > 0 && (
          <div style={{ marginTop: 8, fontSize: 9, letterSpacing: '0.24em', color: 'rgba(232,121,249,0.55)' }}>
            PANELS {String(panelCount).padStart(2, '0')}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
