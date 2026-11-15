/**
 * Cortex Design Tokens
 * Single source of truth for the sovereign cybernetic visualizer theme.
 *
 * Enforces visual harmony across:
 * - CortexVisualizer (2D procedural canvas faces)
 * - CortexCoreScene (R3F 3D WebGL sphere & particles)
 * - CortexVisualizerPage (HUD chrome, telemetry & panels)
 * - CortexSurfaceLayer (3x3 grid & draggable artifacts)
 */

export const CORTEX_COLORS = {
  // Core Neon Spectrum
  cyan: {
    base: '#67e8f9',
    neon: '#00e5ff',
    bright: '#22d3ee',
    deep: '#0891b2',
    glow: 'rgba(0, 229, 255, 0.45)',
    dim: 'rgba(103, 232, 249, 0.12)',
    border: 'rgba(103, 232, 249, 0.28)',
  },
  magenta: {
    base: '#e879f9',
    neon: '#ff007f',
    bright: '#f472b6',
    deep: '#c026d3',
    glow: 'rgba(255, 0, 127, 0.45)',
    dim: 'rgba(232, 121, 249, 0.12)',
    border: 'rgba(232, 121, 249, 0.28)',
  },
  violet: {
    base: '#a78bfa',
    neon: '#bd00ff',
    bright: '#c084fc',
    deep: '#7c3aed',
    glow: 'rgba(189, 0, 255, 0.45)',
    dim: 'rgba(167, 139, 250, 0.12)',
    border: 'rgba(167, 139, 250, 0.28)',
  },
  emerald: {
    base: '#34d399',
    neon: '#00ffaa',
    bright: '#4ade80',
    deep: '#059669',
    glow: 'rgba(0, 255, 170, 0.45)',
    dim: 'rgba(52, 211, 153, 0.12)',
    border: 'rgba(52, 211, 153, 0.28)',
  },
  amber: {
    base: '#fbbf24',
    neon: '#ffaa00',
    bright: '#fcd34d',
    deep: '#d97706',
    glow: 'rgba(255, 170, 0, 0.45)',
    dim: 'rgba(251, 191, 36, 0.12)',
    border: 'rgba(251, 191, 36, 0.28)',
  },
  crimson: {
    base: '#f43f5e',
    neon: '#ff1744',
    glow: 'rgba(244, 63, 94, 0.45)',
    dim: 'rgba(244, 63, 94, 0.12)',
    border: 'rgba(244, 63, 94, 0.35)',
  },

  // Obsidian Backgrounds
  obsidian: {
    void: '#000003',
    canvas: '#05060a',
    surface: '#07070d',
    card: '#0b0c14',
    cardElevated: '#10101a',
    cardActive: '#141424',
  },

  // Structural Lines & Overlays
  chrome: {
    wireframe: 'rgba(255, 255, 255, 0.06)',
    subtleBorder: 'rgba(255, 255, 255, 0.10)',
    focusBorder: 'rgba(103, 232, 249, 0.65)',
    scanline: 'rgba(255, 255, 255, 0.014)',
    vignette: 'radial-gradient(ellipse at center, transparent 52%, rgba(0, 0, 5, 0.55) 100%)',
  },
} as const;

export const CORTEX_STATE_THEME = {
  idle: {
    color: CORTEX_COLORS.cyan.base,
    glow: CORTEX_COLORS.cyan.glow,
    label: 'STANDBY',
    subLabel: 'Awaiting signal',
  },
  listening: {
    color: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.5)',
    label: 'LISTENING',
    subLabel: 'Capturing audio stream',
  },
  thinking: {
    color: CORTEX_COLORS.violet.base,
    glow: CORTEX_COLORS.violet.glow,
    label: 'REASONING',
    subLabel: 'Synthesizing neural model',
  },
  speaking: {
    color: CORTEX_COLORS.emerald.base,
    glow: CORTEX_COLORS.emerald.glow,
    label: 'TRANSMITTING',
    subLabel: 'Neural voice stream live',
  },
  working: {
    color: CORTEX_COLORS.magenta.base,
    glow: CORTEX_COLORS.magenta.glow,
    label: 'WORKING',
    subLabel: 'Executing host operations',
  },
} as const;

export const CORTEX_TYPOGRAPHY = {
  fontMono: "'IBM Plex Mono', monospace",
  fontSans: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontDisplay: "'Orbitron', 'IBM Plex Mono', sans-serif",
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  letterSpacing: {
    tight: '0.05em',
    widest: '0.3em',
    hero: '0.45em',
  },
} as const;

export const CORTEX_SPACING = {
  hudTopInset: 34,
  hudSideInset: 64,
  cornerTickSize: 16,
  cornerTickThickness: 1.5,
  borderRadiusSmall: 2,
  borderRadiusCard: 6,
} as const;

export const CORTEX_ANIMATION = {
  faceTransitionDurationMs: 320,
  faceTransitionTiming: 'cubic-bezier(0.16, 1, 0.3, 1)',
  caretBlinkDuration: '1s',
  scanDriftDuration: '9s',
} as const;

