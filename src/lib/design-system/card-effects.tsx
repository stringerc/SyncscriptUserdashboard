/**
 * SyncScript Elite 3D Card Effects
 * Advanced hover interactions, magnetic attraction, tilt effects, and expandable cards
 * Awwwards-level card interactions
 */

'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, useMotionValue, useTransform, useSpring, useReducedMotion } from 'framer-motion';

// ============================================
// 3D TILT CARD
// ============================================

interface TiltCardProps {
  children: React.ReactNode;
  maxTilt?: number; // degrees
  perspective?: number;
  scale?: number;
  glare?: boolean;
  glareOpacity?: number;
  disableAxis?: 'x' | 'y' | 'none';
  reset?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function TiltCard({
  children,
  maxTilt = 12,
  perspective = 1000,
  scale = 1.02,
  glare = true,
  glareOpacity = 0.15,
  disableAxis = 'none',
  reset = true,
  className = '',
  style,
  onMouseEnter,
  onMouseLeave,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const reduceMotion = useReducedMotion();
  
  // Motion values for smooth animation
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const scaleX = useMotionValue(1);
  const scaleY = useMotionValue(1);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  
  // Spring animations for smooth return
  const springConfig = { stiffness: 400, damping: 30, mass: 1 };
  const rotateXSpring = useSpring(rotateX, springConfig);
  const rotateYSpring = useSpring(rotateY, springConfig);
  const scaleSpring = useSpring(scaleX, { stiffness: 300, damping: 25 });
  const glareXSpring = useSpring(glareX, { stiffness: 200, damping: 20 });
  const glareYSpring = useSpring(glareY, { stiffness: 200, damping: 20 });
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (reduceMotion || !ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) / (rect.width / 2);
    const deltaY = (e.clientY - centerY) / (rect.height / 2);
    
    // Clamp to max tilt
    const tiltX = disableAxis !== 'x' ? Math.max(-maxTilt, Math.min(maxTilt, -deltaY * maxTilt)) : 0;
    const tiltY = disableAxis !== 'y' ? Math.max(-maxTilt, Math.min(maxTilt, deltaX * maxTilt)) : 0;
    
    rotateX.set(tiltX);
    rotateY.set(tiltY);
    scaleX.set(scale);
    scaleY.set(scale);
    
    // Glare position (0-100%)
    glareX.set(50 + deltaX * 30);
    glareY.set(50 + deltaY * 30);
  }, [maxTilt, scale, disableAxis, reduceMotion]);
  
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    onMouseEnter?.();
  }, [onMouseEnter]);
  
  const handleMouseLeave = useCallback(() => {
    if (reset) {
      rotateX.set(0);
      rotateY.set(0);
      scaleX.set(1);
      scaleY.set(1);
      glareX.set(50);
      glareY.set(50);
    }
    setIsHovering(false);
    onMouseLeave?.();
  }, [reset, onMouseLeave]);
  
  // Transform style
  const transformStyle = useMemo(() => ({
    transform: `perspective(${perspective}px) rotateX(${rotateXSpring}deg) rotateY(${rotateYSpring}deg) scale(${scaleSpring})`,
    transformStyle: 'preserve-3d',
    willChange: 'transform',
  }), [perspective, rotateXSpring, rotateYSpring, scaleSpring]);
  
  // Glare style
  const glareStyle = useMemo(() => ({
    position: 'absolute',
    inset: 0,
    borderRadius: 'inherit',
    background: `radial-gradient(ellipse at ${glareXSpring}% ${glareYSpring}%, rgba(255,255,255,${glareOpacity}) 0%, transparent 60%)`,
    opacity: isHovering && glare ? 1 : 0,
    pointerEvents: 'none',
    transition: 'opacity 0.3s ease',
  }), [glare, glareOpacity, isHovering, glareXSpring, glareYSpring]);
  
  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: 'relative',
        transformStyle: 'preserve-3d',
        transition: reduceMotion ? 'none' : 'transform 0.1s ease-out',
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {glare && <div style={glareStyle} aria-hidden="true" />}
      <div style={{ transformStyle: 'preserve-3d', ...transformStyle }}>
        {children}
      </div>
    </div>
  );
}

// ============================================
// MAGNETIC CARD
// ============================================

interface MagneticCardProps {
  children: React.ReactNode;
  strength?: number;
  radius?: number;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function MagneticCard({
  children,
  strength = 0.15,
  radius = 150,
  scale = 1.03,
  className = '',
  style,
  onClick,
}: MagneticCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const reduceMotion = useReducedMotion();
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scaleX = useMotionValue(1);
  const scaleY = useMotionValue(1);
  
  const springConfig = { stiffness: 400, damping: 35 };
  const xSpring = useSpring(x, springConfig);
  const ySpring = useSpring(y, springConfig);
  const scaleSpring = useSpring(scaleX, { stiffness: 300, damping: 25 });
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (reduceMotion || !ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = e.clientX - centerX;
    const deltaY = e.clientY - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance < radius) {
      const force = (1 - distance / radius) * strength;
      x.set(deltaX * force);
      y.set(deltaY * force);
      scaleX.set(scale);
      scaleY.set(scale);
    }
  }, [strength, radius, scale, reduceMotion]);
  
  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
    scaleX.set(1);
    scaleY.set(1);
    setIsHovering(false);
  }, []);
  
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);
  
  const transformStyle = useMemo(() => ({
    transform: `translate(${xSpring}px, ${ySpring}px) scale(${scaleSpring})`,
    willChange: 'transform',
  }), [xSpring, ySpring, scaleSpring]);
  
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        position: 'relative',
        cursor: 'pointer',
        ...style,
        ...transformStyle,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// EXPANDABLE CARD
// ============================================

interface ExpandableCardProps {
  children: React.ReactNode;
  preview?: React.ReactNode;
  expandedContent: React.ReactNode;
  trigger?: 'hover' | 'click' | 'both';
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  easing?: number[];
  className?: string;
  style?: React.CSSProperties;
  onExpand?: (expanded: boolean) => void;
}

export function ExpandableCard({
  children,
  preview,
  expandedContent,
  trigger = 'hover',
  direction = 'up',
  duration = 400,
  easing = [0.4, 0, 0.2, 1],
  className = '',
  style,
  onExpand,
}: ExpandableCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [height, setHeight] = useState('auto');
  const reduceMotion = useReducedMotion();
  
  const expand = useCallback(() => {
    setIsExpanded(true);
    onExpand?.(true);
  }, [onExpand]);
  
  const collapse = useCallback(() => {
    setIsExpanded(false);
    onExpand?.(false);
  }, [onExpand]);
  
  const handleMouseEnter = useCallback(() => {
    if (trigger === 'hover' || trigger === 'both') expand();
  }, [trigger, expand]);
  
  const handleMouseLeave = useCallback(() => {
    if (trigger === 'hover') collapse();
  }, [trigger, collapse]);
  
  const handleClick = useCallback(() => {
    if (trigger === 'click' || trigger === 'both') {
      if (isExpanded) collapse();
      else expand();
    }
  }, [trigger, isExpanded, expand, collapse]);
  
  // Measure expanded height
  useEffect(() => {
    if (isExpanded && ref.current) {
      const expandedEl = ref.current.querySelector('[data-expanded-content]') as HTMLElement;
      if (expandedEl) {
        setHeight(`${expandedEl.scrollHeight}px`);
      }
    } else {
      setHeight('auto');
    }
  }, [isExpanded]);
  
  const containerVariants = {
    collapsed: { height: 'auto' },
    expanded: { height: height },
  };
  
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'inherit',
        ...style,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={trigger === 'click' || trigger === 'both' ? handleClick : undefined}
      initial="collapsed"
      animate={isExpanded ? 'expanded' : 'collapsed'}
      variants={containerVariants}
      transition={{
        duration: reduceMotion ? 0 : duration / 1000,
        ease: easing,
      }}
    >
      <div data-preview style={{ position: 'relative', zIndex: 1 }}>
        {children}
        {preview && <div style={{ opacity: isExpanded ? 0 : 1, transition: 'opacity 0.2s' }}>{preview}</div>}
      </div>
      <motion.div
        data-expanded-content
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 2,
        }}
        initial={{ opacity: 0, y: direction === 'up' ? 20 : direction === 'down' ? -20 : 0, x: direction === 'left' ? 20 : direction === 'right' ? -20 : 0 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ duration: reduceMotion ? 0 : duration / 1000, ease: easing }}
      >
        {expandedContent}
      </motion.div>
    </motion.div>
  );
}

// ============================================
// FLIP CARD
// ============================================

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  trigger?: 'hover' | 'click';
  direction?: 'horizontal' | 'vertical';
  duration?: number;
  easing?: number[];
  className?: string;
  style?: React.CSSProperties;
  onFlip?: (flipped: boolean) => void;
}

export function FlipCard({
  front,
  back,
  trigger = 'hover',
  direction = 'horizontal',
  duration = 600,
  easing = [0.4, 0, 0.2, 1],
  className = '',
  style,
  onFlip,
}: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const reduceMotion = useReducedMotion();
  
  const handleToggle = useCallback(() => {
    const next = !isFlipped;
    setIsFlipped(next);
    onFlip?.(next);
  }, [isFlipped, onFlip]);
  
  const rotateAxis = direction === 'horizontal' ? 'rotateY' : 'rotateX';
  
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        perspective: 1000,
        cursor: trigger === 'click' ? 'pointer' : undefined,
        ...style,
      }}
      onMouseEnter={trigger === 'hover' ? () => setIsFlipped(true) : undefined}
      onMouseLeave={trigger === 'hover' ? () => setIsFlipped(false) : undefined}
      onClick={trigger === 'click' ? handleToggle : undefined}
    >
      <motion.div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: reduceMotion ? 'none' : `transform ${duration}ms cubic-bezier(${easing.join(',')})`,
        }}
        animate={{
          [rotateAxis]: isFlipped ? 180 : 0,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 'inherit' }}>
          {front}
        </div>
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 'inherit', [rotateAxis]: '180deg' }}>
          {back}
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// STACKED CARDS (CAROUSEL-LIKE)
// ============================================

interface StackedCardsProps {
  children: React.ReactNode;
  visibleCount?: number;
  spread?: number; // pixels between cards
  scaleStep?: number; // scale reduction per card
  rotateStep?: number; // rotation per card
  className?: string;
  style?: React.CSSProperties;
  onCardClick?: (index: number) => void;
}

export function StackedCards({
  children,
  visibleCount = 3,
  spread = 20,
  scaleStep = 0.92,
  rotateStep = 3,
  className = '',
  style,
  onCardClick,
}: StackedCardsProps) {
  const reduceMotion = useReducedMotion();
  
  const cards = React.Children.toArray(children).filter(React.isValidElement);
  
  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      {cards.map((card, index) => {
        const isTop = index === cards.length - 1;
        const visibleIndex = cards.length - 1 - index;
        const shouldShow = visibleIndex < visibleCount;
        
        if (!shouldShow) return null;
        
        const zIndex = cards.length - index;
        const yOffset = visibleIndex * spread;
        const scale = Math.pow(scaleStep, visibleIndex);
        const rotation = (Math.random() - 0.5) * rotateStep * visibleIndex;
        
        return (
          <motion.div
            key={card.key || index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex,
              transformOrigin: 'center bottom',
              cursor: isTop && onCardClick ? 'pointer' : 'default',
            }}
            initial={reduceMotion ? { opacity: 1, y: 0, scale: 1, rotate: 0 } : { opacity: 0, y: 50, scale: 0.8 }}
            animate={{ opacity: 1, y: yOffset, scale, rotate: rotation }}
            transition={{ delay: index * 0.05, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            whileHover={isTop && onCardClick ? { scale: scale * 1.02, y: yOffset - 8 } : undefined}
            onClick={isTop && onCardClick ? () => onCardClick(cards.length - 1 - index) : undefined}
          >
            {React.cloneElement(card as React.ReactElement, {
              style: { ...(card.props.style as any), width: '100%' },
            })}
          </motion.div>
        );
      })}
    </div>
  );
}

// ============================================
// SHIMMER / SKELETON LOADING
// ============================================

interface ShimmerProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Shimmer({
  width = '100%',
  height = '1rem',
  borderRadius = '8px',
  className = '',
  style,
}: ShimmerProps) {
  const reduceMotion = useReducedMotion();
  
  return (
    <motion.div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '200% 100%',
        ...style,
      }}
      animate={reduceMotion ? {} : { backgroundPosition: ['200% 0', '-200% 0'] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
    />
  );
}

interface SkeletonCardProps {
  variant?: 'product' | 'article' | 'profile' | 'custom';
  className?: string;
  style?: React.CSSProperties;
}

export function SkeletonCard({ variant = 'product', className = '', style }: SkeletonCardProps) {
  return (
    <div className={className} style={{ ...style }}>
      {variant === 'product' && (
        <>
          <Shimmer width="100%" height="200px" borderRadius="16px 16px 0 0" style={{ marginBottom: '1.5rem' }} />
          <Shimmer width="80px" height="24px" borderRadius="9999px" style={{ marginBottom: '1rem' }} />
          <Shimmer width="100%" height="32px" borderRadius="8px" style={{ marginBottom: '0.75rem' }} />
          <Shimmer width="60%" height="16px" borderRadius="8px" style={{ marginBottom: '1rem' }} />
          <Shimmer width="40%" height="16px" borderRadius="8px" style={{ marginBottom: '1.5rem' }} />
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Shimmer width="60px" height="24px" borderRadius="9999px" />
            <Shimmer width="80px" height="24px" borderRadius="9999px" />
            <Shimmer width="70px" height="24px" borderRadius="9999px" />
            <Shimmer width="100px" height="24px" borderRadius="9999px" />
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Shimmer width="80px" height="32px" borderRadius="8px" />
            <Shimmer width="100%" height="48px" borderRadius="12px" />
          </div>
        </>
      )}
      {variant === 'article' && (
        <>
          <Shimmer width="100%" height="200px" borderRadius="16px" style={{ marginBottom: '1.5rem' }} />
          <Shimmer width="60%" height="32px" borderRadius="8px" style={{ marginBottom: '1rem' }} />
          <Shimmer width="100%" height="16px" borderRadius="8px" style={{ marginBottom: '0.5rem' }} />
          <Shimmer width="100%" height="16px" borderRadius="8px" style={{ marginBottom: '0.5rem' }} />
          <Shimmer width="80%" height="16px" borderRadius="8px" />
        </>
      )}
      {variant === 'profile' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <Shimmer width="64px" height="64px" borderRadius="50%" />
            <div>
              <Shimmer width="150px" height="24px" borderRadius="8px" style={{ marginBottom: '0.5rem' }} />
              <Shimmer width="100px" height="16px" borderRadius="8px" />
            </div>
          </div>
          <Shimmer width="100%" height="16px" borderRadius="8px" style={{ marginBottom: '0.5rem' }} />
          <Shimmer width="80%" height="16px" borderRadius="8px" />
        </>
      )}
    </div>
  );
}

// ============================================
// GLASSMORPHISM CARD WRAPPER
// ============================================

interface GlassCardProps {
  children: React.ReactNode;
  blur?: number;
  saturation?: number;
  opacity?: number;
  borderOpacity?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function GlassCard({
  children,
  blur = 20,
  saturation = 180,
  opacity = 0.08,
  borderOpacity = 0.06,
  className = '',
  style,
}: GlassCardProps) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        background: `rgba(10, 10, 12, ${opacity})`,
        backdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
        border: `1px solid rgba(255, 255, 255, ${borderOpacity})`,
        borderRadius: '16px',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}