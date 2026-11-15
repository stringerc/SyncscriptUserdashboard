/**
 * SyncScript Premium Design System Tokens
 * Awwwards-level, Sony/Apple-inspired luxury tech aesthetic
 */

export const colors = {
  // Primary Background - Deep Charcoal Void
  background: {
    primary: '#050505',      // Main void background
    secondary: '#0A0A0C',    // Section backgrounds
    tertiary: '#0F0F12',     // Card backgrounds
    elevated: '#141418',     // Hover/active states
    overlay: 'rgba(5, 5, 5, 0.85)', // Modal/nav overlay
  },
  
  // Text Colors
  text: {
    primary: 'rgba(255, 255, 255, 0.95)',  // Headings
    secondary: 'rgba(255, 255, 255, 0.7)', // Body text
    tertiary: 'rgba(255, 255, 255, 0.45)', // Muted/disabled
    inverse: '#050505',                     // On accent backgrounds
  },
  
  // Accent Colors - Sony-inspired
  accent: {
    blue: {
      primary: '#0050FF',    // Sony deep blue
      light: '#0066FF',
      dark: '#003DBF',
      glow: 'rgba(0, 80, 255, 0.3)',
    },
    cyan: {
      primary: '#00D6FF',    // Electric cyan
      light: '#33DEFF',
      dark: '#00ABCC',
      glow: 'rgba(0, 214, 255, 0.25)',
    },
    // Tier-specific accents
    tier: {
      'tier-1': { primary: '#10B981', glow: 'rgba(16, 185, 129, 0.25)' },  // Emerald
      'tier-2': { primary: '#0050FF', glow: 'rgba(0, 80, 255, 0.25)' },    // Sony Blue
      'tier-3': { primary: '#A855F7', glow: 'rgba(168, 85, 247, 0.25)' },  // Purple
      'tier-4': { primary: '#F97316', glow: 'rgba(249, 115, 22, 0.25)' },  // Orange
      'tier-5': { primary: '#F43F5E', glow: 'rgba(244, 63, 94, 0.25)' },   // Rose
    }
  },
  
  // Gradients
  gradients: {
    hero: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(0, 80, 255, 0.08) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(0, 214, 255, 0.05) 0%, transparent 60%), #050505',
    heroInset: 'radial-gradient(ellipse 100% 80% at 50% 0%, rgba(0, 80, 255, 0.12) 0%, transparent 60%), #050505',
    card: 'linear-gradient(145deg, rgba(10, 10, 12, 0.8) 0%, rgba(15, 15, 18, 0.9) 100%)',
    cardHover: 'linear-gradient(145deg, rgba(15, 15, 18, 0.95) 0%, rgba(20, 20, 24, 0.95) 100%)',
    accentPrimary: 'linear-gradient(135deg, #0050FF 0%, #00D6FF 100%)',
    accentSubtle: 'linear-gradient(135deg, rgba(0, 80, 255, 0.1) 0%, rgba(0, 214, 255, 0.05) 100%)',
    textPremium: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(0,214,255,0.8) 100%)',
    navBlur: 'linear-gradient(180deg, rgba(5,5,5,0.95) 0%, rgba(5,5,5,0.7) 50%, rgba(5,5,5,0) 100%)',
    tier: {
      'tier-1': 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
      'tier-2': 'linear-gradient(135deg, #0050FF 0%, #00D6FF 100%)',
      'tier-3': 'linear-gradient(135deg, #A855F7 0%, #D8B4FE 100%)',
      'tier-4': 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
      'tier-5': 'linear-gradient(135deg, #F43F5E 0%, #FB7185 100%)',
    }
  },
  
  // Borders
  borders: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.1)',
    accent: 'rgba(0, 80, 255, 0.3)',
    accentHover: 'rgba(0, 80, 255, 0.5)',
  },
  
  // Shadows
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.3)',
    sm: '0 2px 8px rgba(0, 0, 0, 0.4)',
    md: '0 8px 24px rgba(0, 0, 0, 0.5)',
    lg: '0 16px 48px rgba(0, 0, 0, 0.6)',
    xl: '0 32px 96px rgba(0, 0, 0, 0.7)',
    glow: '0 0 40px rgba(0, 80, 255, 0.15)',
    glowCyan: '0 0 40px rgba(0, 214, 255, 0.1)',
    glowTier: (color: string) => `0 0 40px ${color}`,
  }
};

export const typography = {
  fontFamilies: {
    display: '"SF Pro Display", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    body: '"SF Pro Text", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    mono: '"SF Mono", "JetBrains Mono", "Fira Code", monospace',
  },
  
  fontSizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
    '6xl': '3.75rem', // 60px
    '7xl': '4.5rem',  // 72px
    '8xl': '6rem',    // 96px
  },
  
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  lineHeights: {
    tight: 1.1,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.65,
  },
  
  letterSpacing: {
    tight: '-0.03em',
    normal: '0',
    wide: '0.02em',
    wider: '0.05em',
  }
};

export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
  32: '8rem',     // 128px
};

export const borderRadius = {
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',
};

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
  slower: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  modal: 300,
  popover: 400,
  toast: 500,
  tooltip: 600,
};

export const motion = {
  // Framer Motion variants
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] } },
  },
  fadeInUp: {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } },
  },
  fadeInDown: {
    hidden: { opacity: 0, y: -30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } },
  },
  slideInLeft: {
    hidden: { opacity: 0, x: -40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } },
  },
  slideInRight: {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
  },
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  },
  staggerItem: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
  },
};

// Utility function for tier colors
export function getTierColors(tierId: string) {
  return colors.accent.tier[tierId as keyof typeof colors.accent.tier] || colors.accent.tier['tier-1'];
}

export function getTierGradient(tierId: string) {
  return colors.gradients.tier[tierId as keyof typeof colors.gradients.tier] || colors.gradients.tier['tier-1'];
}

// CSS-in-JS style object helpers
export const styleUtils = {
  // Glassmorphism nav background
  glassNav: {
    background: 'rgba(5, 5, 5, 0.75)',
    backdropFilter: 'blur(20px) saturate(180%)',
    borderBottom: `1px solid ${colors.borders.subtle}`,
  },
  
  // Premium card
  premiumCard: {
    background: colors.gradients.card,
    border: `1px solid ${colors.borders.subtle}`,
    borderRadius: borderRadius.xl,
    transition: `all ${transitions.normal}`,
  },
  
  premiumCardHover: {
    background: colors.gradients.cardHover,
    borderColor: colors.borders.default,
    boxShadow: colors.shadows.lg,
    transform: 'translateY(-4px)',
  },
  
  // Gradient text
  gradientText: (gradient = colors.gradients.textPremium) => ({
    background: gradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  }),
  
  // Glow effect
  glow: (color = colors.accent.blue.glow) => ({
    boxShadow: `0 0 60px ${color}, 0 0 120px ${color}40`,
  }),
  
  // Focus ring
  focusRing: {
    outline: 'none',
    ring: '2px',
    ringColor: colors.accent.blue.primary,
    ringOffset: '2px',
    ringOffsetColor: colors.background.primary,
  },
};

// Animation durations for scroll-linked animations
export const scrollAnimation = {
  // Scroll progress 0-1 mappings
  hero: { start: 0, end: 0.15 },
  engineeringReveal: { start: 0.15, end: 0.4 },
  noiseCancelling: { start: 0.4, end: 0.65 },
  soundUpscaling: { start: 0.65, end: 0.85 },
  reassembly: { start: 0.85, end: 1 },
};

export default { colors, typography, spacing, borderRadius, transitions, breakpoints, zIndex, motion, scrollAnimation };