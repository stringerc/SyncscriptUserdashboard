/**
 * SyncScript Elite Design System - Main Export
 * Awwwards-level design system with WebGL, magnetic cursor, scroll animations, 3D cards, and text effects
 */

// Core tokens
export * from './tokens';

// WebGL Effects
export * from './webgl-effects';

// Magnetic Cursor
export * from './magnetic-cursor';

// Text Animations
export * from './text-animations';

// Scroll Animations
export * from './scroll-animations';

// Card Effects
export * from './card-effects';

// ============================================
// COMPOSITE COMPONENTS - Pre-built combinations
// ============================================

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  useParticleField, 
  useNoiseBackground, 
  useReducedMotion 
} from './webgl-effects';
import { 
  useMagneticCursor, 
  autoRegisterMagneticElements 
} from './magnetic-cursor';
import { 
  SplitText, 
  TypewriterText, 
  StaggerReveal,
  useGradientTextAnimation 
} from './text-animations';
import { 
  RevealOnScroll, 
  ScrollProgressIndicator,
  useParallax,
  useScrollProgress 
} from './scroll-animations';
import { 
  TiltCard, 
  MagneticCard,
  GlassCard 
} from './card-effects';
import { NoiseBackground } from './webgl-effects';
import { colors, typography, transitions, borderRadius, styleUtils, motion as motionTokens } from './tokens';

// ============================================
// ELITE HERO SECTION
// ============================================

interface EliteHeroProps {
  title: string;
  subtitle: string;
  accentText?: string;
  ctaText: string;
  ctaHref: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  stats?: Array<{ value: string | number; label: string }>;
  className?: string;
  style?: React.CSSProperties;
}

export function EliteHero({
  title,
  subtitle,
  accentText,
  ctaText,
  ctaHref,
  secondaryCtaText,
  secondaryCtaHref,
  stats,
  className = '',
  style,
}: EliteHeroProps) {
  const reduceMotion = useReducedMotion();
  const { canvasRef: particleCanvas } = useParticleField({ 
    count: 80, 
    colors: ['#0050FF', '#00D6FF', '#10B981', '#A855F7'],
    sizeRange: [0.3, 2],
    opacityRange: [0.1, 0.35],
  });
  const { canvasRef: noiseCanvas } = useNoiseBackground({
    intensity: 0.4,
    color1: '#0050FF',
    color2: '#00D6FF',
    color3: '#10B981',
  });
  const { style: gradientStyle } = useGradientTextAnimation(['#0050FF', '#00D6FF', '#10B981'], 4000);
  
  return (
    <section
      className={className}
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 1.5rem',
        overflow: 'hidden',
        background: colors.background.primary,
        ...style,
      }}
    >
      {/* Noise background */}
      <canvas
        ref={noiseCanvas}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
        aria-hidden="true"
      />
      
      {/* Particle field */}
      <canvas
        ref={particleCanvas}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
        }}
        aria-hidden="true"
      />
      
      {/* Radial glows */}
      <motion.div
        style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '800px',
          height: '400px',
          background: 'radial-gradient(ellipse at center, rgba(0,80,255,0.12) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
      />
      
      <motion.div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: '600px',
          height: '300px',
          background: 'radial-gradient(ellipse at center, rgba(0,214,255,0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
      />
      
      {/* Grid pattern overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z' fill='%23ffffff' fillOpacity='0.015'/%3E%3C/g%3E%3C/svg%3E")`,
        opacity: 0.4,
        zIndex: 3,
      }} />
      
      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        maxWidth: '900px',
        textAlign: 'center',
        width: '100%',
      }}>
        {/* Logo */}
        <motion.div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '88px',
            height: '88px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, rgba(0,80,255,0.15) 0%, rgba(0,214,255,0.08) 100%)',
            border: '1px solid rgba(0,80,255,0.15)',
            marginBottom: '2rem',
            backdropFilter: 'blur(20px)',
          }}
          initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <span style={{ fontSize: '2.75rem' }}>⟲</span>
        </motion.div>
        
        {/* Main Headline with SplitText */}
        <motion.h1
          style={{
            fontSize: 'clamp(2.75rem, 7vw, 5.5rem)',
            fontWeight: 700,
            fontFamily: typography.fontFamilies.display,
            lineHeight: 1.02,
            letterSpacing: '-0.035em',
            color: colors.text.primary,
            marginBottom: '1.5rem',
            ...gradientStyle,
          }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          {title.split(' ').map((word, i) => (
            <span key={i} style={{ display: 'inline-block' }}>
              {word} {i < title.split(' ').length - 1 ? '\u00A0' : ''}
            </span>
          ))}
          {accentText && (
            <span style={{ 
              background: 'linear-gradient(180deg, #10B981 0%, #00D6FF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {' '}{accentText}
            </span>
          )}
        </motion.h1>
        
        {/* Subheadline */}
        <motion.p
          style={{
            fontSize: 'clamp(1.125rem, 2.5vw, 1.5rem)',
            fontWeight: 400,
            fontFamily: typography.fontFamilies.body,
            lineHeight: 1.65,
            color: colors.text.secondary,
            maxWidth: '720px',
            margin: '0 auto 3rem',
            letterSpacing: '-0.01em',
          }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          {subtitle}
        </motion.p>
        
        {/* Stats Bar */}
        {stats && stats.length > 0 && (
          <motion.div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'clamp(1.5rem, 4vw, 3rem)',
              marginBottom: '3rem',
              padding: '1.5rem 2rem',
              background: 'rgba(10, 10, 12, 0.6)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: borderRadius['2xl'],
              backdropFilter: 'blur(20px)',
            }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          >
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                style={{ textAlign: 'center', minWidth: '100px' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + i * 0.08 }}
              >
                <div style={{
                  fontSize: 'clamp(1.875rem, 3.5vw, 2.75rem)',
                  fontWeight: 700,
                  fontFamily: typography.fontFamilies.display,
                  color: colors.text.primary,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  marginBottom: '0.25rem',
                }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  fontFamily: typography.fontFamilies.mono,
                  color: '#00D6FF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
        
        {/* CTAs */}
        <motion.div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
          }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.a
            href={ctaHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1.125rem 2.75rem',
              borderRadius: borderRadius['2xl'],
              fontSize: '1.0625rem',
              fontWeight: 600,
              fontFamily: typography.fontFamilies.body,
              color: '#fff',
              textDecoration: 'none',
              background: colors.gradients.accentPrimary,
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0, 80, 255, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              transition: `all ${transitions.normal}`,
              position: 'relative',
              overflow: 'hidden',
            }}
            whileHover={{
              boxShadow: '0 12px 48px rgba(0, 80, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
              transform: 'translateY(-2px)',
            }}
            whileTap={{ scale: 0.98 }}
          >
            <span style={{ position: 'relative', zIndex: 1 }}>{ctaText}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'relative', zIndex: 1 }}>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <motion.div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                transform: 'translateX(-100%)',
              }}
              animate={{ transform: ['translateX(-100%)', 'translateX(100%)'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
          </motion.a>
          
          {secondaryCtaText && secondaryCtaHref && (
            <motion.a
              href={secondaryCtaHref}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1.125rem 2.25rem',
                borderRadius: borderRadius['2xl'],
                fontSize: '1.0625rem',
                fontWeight: 500,
                fontFamily: typography.fontFamilies.body,
                color: colors.text.primary,
                textDecoration: 'none',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                transition: `all ${transitions.normal}`,
              }}
              whileHover={{
                background: 'rgba(255,255,255,0.08)',
                borderColor: 'rgba(255,255,255,0.15)',
                transform: 'translateY(-2px)',
              }}
              whileTap={{ scale: 0.98 }}
            >
              {secondaryCtaText}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </motion.a>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================
// ELITE PRODUCT GRID
// ============================================

interface EliteProductGridProps {
  products: any[];
  featured?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function EliteProductGrid({ products, featured = false, className = '', style }: EliteProductGridProps) {
  const reduceMotion = useReducedMotion();
  
  return (
    <div className={className} style={{ width: '100%', ...style }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {products.map((product, index) => (
          <TiltCard
            key={product.id}
            maxTilt={8}
            scale={1.015}
            glare={true}
            glareOpacity={0.12}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: index * 0.06, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <GlassCard style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Product content would go here */}
              {product.name}
            </GlassCard>
          </TiltCard>
        ))}
      </div>
    </div>
  );
}

// ============================================
// ELITE NAVBAR WITH MAGNETIC CURSOR
// ============================================

export function EliteNavbar() {
  const { manager } = useMagneticCursor({
    enabled: true,
    cursorSize: 28,
    trailLength: 10,
    magneticStrength: 0.12,
    magneticRadius: 140,
  });
  
  useEffect(() => {
    if (manager) {
      autoRegisterMagneticElements(manager);
    }
  }, [manager]);
  
  return null; // Renders cursor globally
}

// ============================================
// ELITE SECTION WRAPPER
// ============================================

interface EliteSectionProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  background?: 'primary' | 'secondary' | 'gradient' | 'noise';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  reveal?: boolean;
  revealVariant?: 'fade' | 'slide-up' | 'slide-down' | 'scale';
}

export function EliteSection({
  children,
  id,
  className = '',
  style,
  background = 'primary',
  padding = 'lg',
  reveal = true,
  revealVariant = 'slide-up',
}: EliteSectionProps) {
  const reduceMotion = useReducedMotion();
  
  const backgrounds = {
    primary: colors.background.primary,
    secondary: colors.background.secondary,
    gradient: colors.gradients.hero,
    noise: 'transparent',
  };
  
  const paddings = {
    none: '0',
    sm: '2rem 1.5rem',
    md: '4rem 1.5rem',
    lg: '6rem 1.5rem',
    xl: '8rem 1.5rem',
  };
  
  return (
    <section
      id={id}
      className={className}
      style={{
        position: 'relative',
        background: backgrounds[background],
        padding: paddings[padding],
        ...style,
      }}
    >
      {background === 'noise' && (
        <NoiseBackground style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      )}
      
      {reveal ? (
        <RevealOnScroll config={{ variant: revealVariant, once: true }}>
          <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
        </RevealOnScroll>
      ) : (
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      )}
    </section>
  );
}