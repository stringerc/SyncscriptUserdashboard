/**
 * SyncScript Elite Scroll Animation System
 * GSAP ScrollTrigger-like functionality using Framer Motion + IntersectionObserver
 * Parallax, reveal animations, scroll-linked effects, and more
 */

'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, useTransform, useScroll, useAnimation, useReducedMotion } from 'framer-motion';

// ============================================
// TYPES
// ============================================

export interface ScrollTriggerConfig {
  trigger: HTMLElement | string;
  start?: string; // 'top bottom', 'center center', etc.
  end?: string;
  scrub?: boolean | number;
  pin?: boolean;
  pinSpacing?: boolean;
  markers?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  onEnterBack?: () => void;
  onLeaveBack?: () => void;
  onUpdate?: (progress: number) => void;
}

export interface ParallaxConfig {
  speed?: number; // 0.5 = half speed, 2 = double speed
  direction?: 'vertical' | 'horizontal' | 'both';
  offset?: number;
}

export interface RevealConfig {
  once?: boolean;
  rootMargin?: string;
  threshold?: number | number[];
  delay?: number;
  stagger?: number;
  variant?: 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'scale' | 'flip' | 'blur';
}

// ============================================
// SCROLL PROGRESS HOOKS
// ============================================

export function useScrollProgress(
  target?: HTMLElement | null,
  options: { offset?: number[] } = {}
): number {
  const [progress, setProgress] = useState(0);
  const { offset = [0, 1] } = options;
  
  useEffect(() => {
    const element = target || document.documentElement;
    const handleScroll = () => {
      const scrollTop = element.scrollTop || window.scrollY;
      const scrollHeight = element.scrollHeight - element.clientHeight;
      const rawProgress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      setProgress(Math.max(offset[0], Math.min(offset[1], rawProgress)));
    };
    
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [target, offset[0], offset[1]]);
  
  return progress;
}

export function useElementScrollProgress(
  elementRef: React.RefObject<HTMLElement>,
  options: { 
    start?: string; 
    end?: string; 
    once?: boolean;
  } = {}
): number {
  const { start = 'top bottom', end = 'bottom top', once = false } = options;
  const [progress, setProgress] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const reduceMotion = useReducedMotion();
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element || reduceMotion) {
      if (reduceMotion) setProgress(1);
      return;
    }
    
    const parsePosition = (pos: string): { reference: 'top' | 'center' | 'bottom'; target: 'top' | 'center' | 'bottom' } => {
      const [ref, tgt] = pos.split(' ');
      return { reference: (ref as any) || 'top', target: (tgt as any) || 'bottom' };
    };
    
    const getOffset = (reference: string, target: string, el: HTMLElement): number => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      
      const refMap = { top: 0, center: vh / 2, bottom: vh };
      const tgtMap = { top: rect.top, center: rect.top + rect.height / 2, bottom: rect.top + rect.height };
      
      return refMap[reference as keyof typeof refMap] - tgtMap[target as keyof typeof tgtMap];
    };
    
    const startParsed = parsePosition(start);
    const endParsed = parsePosition(end);
    
    let startOffset = 0;
    let endOffset = 0;
    let initialized = false;
    
    const handleScroll = () => {
      if (!initialized) {
        startOffset = getOffset(startParsed.reference, startParsed.target, element);
        endOffset = getOffset(endParsed.reference, endParsed.target, element);
        initialized = true;
      }
      
      const scrollY = window.scrollY;
      const rawProgress = (scrollY - startOffset) / (endOffset - startOffset);
      const clamped = Math.max(0, Math.min(1, rawProgress));
      
      setProgress(clamped);
      
      if (once && clamped >= 1 && !hasCompleted) {
        setHasCompleted(true);
      }
    };
    
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [elementRef, start, end, once, hasCompleted, reduceMotion]);
  
  return progress;
}

// ============================================
// PARALLAX HOOK
// ============================================

export function useParallax(
  elementRef: React.RefObject<HTMLElement>,
  config: ParallaxConfig = {}
): { transform: string } {
  const { speed = 0.5, direction = 'vertical', offset = 0 } = config;
  const [transform, setTransform] = useState('translate3d(0, 0, 0)');
  const reduceMotion = useReducedMotion();
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element || reduceMotion) return;
    
    const handleScroll = () => {
      const rect = element.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      const distance = (elementCenter - viewportCenter) * speed + offset;
      
      let x = 0, y = 0;
      if (direction === 'vertical' || direction === 'both') y = distance;
      if (direction === 'horizontal' || direction === 'both') x = distance;
      
      setTransform(`translate3d(${x}px, ${y}px, 0)`);
    };
    
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [elementRef, speed, direction, offset, reduceMotion]);
  
  return { transform };
}

// ============================================
// SCROLL-LINKED ANIMATION HOOK (FRAMER MOTION)
// ============================================

export function useScrollAnimation(
  elementRef: React.RefObject<HTMLElement>,
  options: {
    start?: string;
    end?: string;
    scrub?: number;
  } = {}
) {
  const { start = 'top bottom', end = 'bottom top', scrub = 1 } = options;
  const { scrollY } = useScroll({ 
    target: elementRef, 
    offset: [start, end] 
  });
  
  return scrollY;
}

// ============================================
// REVEAL ON SCROLL COMPONENT
// ============================================

const revealVariants = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } },
  },
  'slide-up': {
    hidden: { opacity: 0, y: 60 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } },
  },
  'slide-down': {
    hidden: { opacity: 0, y: -60 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } },
  },
  'slide-left': {
    hidden: { opacity: 0, x: 60 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } },
  },
  'slide-right': {
    hidden: { opacity: 0, x: -60 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] } },
  },
  flip: {
    hidden: { opacity: 0, rotateX: -60, transformOrigin: 'center bottom' },
    visible: { opacity: 1, rotateX: 0, transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] } },
  },
  blur: {
    hidden: { opacity: 0, filter: 'blur(20px)' },
    visible: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } },
  },
};

interface RevealOnScrollProps {
  children: React.ReactNode;
  config?: RevealConfig;
  className?: string;
  style?: React.CSSProperties;
}

export function RevealOnScroll({
  children,
  config = {},
  className = '',
  style,
}: RevealOnScrollProps) {
  const {
    once = true,
    rootMargin = '-50px',
    threshold = 0.1,
    delay = 0,
    stagger = 0,
    variant = 'slide-up',
  } = config;
  
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const controls = useAnimation();
  const reduceMotion = useReducedMotion();
  
  const variantConfig = revealVariants[variant];
  
  useEffect(() => {
    if (!ref.current || hasAnimated || reduceMotion) {
      if (reduceMotion) {
        setIsVisible(true);
        setHasAnimated(true);
      }
      return;
    }
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) setHasAnimated(true);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin, threshold }
    );
    
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [once, rootMargin, threshold, hasAnimated, reduceMotion]);
  
  useEffect(() => {
    if (isVisible && !hasAnimated) {
      const timer = setTimeout(() => {
        controls.start({
          ...variantConfig.visible,
          transition: { ...variantConfig.visible.transition, delay },
        });
      }, delay * 1000);
      return () => clearTimeout(timer);
    } else if (!isVisible && !once) {
      controls.start(variantConfig.hidden);
    }
  }, [isVisible, hasAnimated, once, delay, variantConfig, controls]);
  
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={reduceMotion ? variantConfig.visible : variantConfig.hidden}
      animate={controls}
      variants={{
        hidden: variantConfig.hidden,
        visible: variantConfig.visible,
      }}
    >
      {React.Children.map(children, (child, index) => 
        React.isValidElement(child) && stagger > 0 ? (
          React.cloneElement(child as React.ReactElement, {
            initial: variantConfig.hidden,
            animate: {
              ...variantConfig.visible,
              transition: { ...variantConfig.visible.transition, delay: delay + index * stagger },
            },
          })
        ) : child
      )}
    </motion.div>
  );
}

// ============================================
// PINNED SECTION COMPONENT
// ============================================

interface PinnedSectionProps {
  children: React.ReactNode;
  height?: string | number; // viewport heights
  start?: string;
  end?: string;
  pinSpacing?: boolean;
  className?: string;
  onProgress?: (progress: number) => void;
}

export function PinnedSection({
  children,
  height = 3,
  start = 'top top',
  end = 'bottom top',
  pinSpacing = true,
  className = '',
  onProgress,
}: PinnedSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [isPinned, setIsPinned] = useState(false);
  const reduceMotion = useReducedMotion();
  
  useEffect(() => {
    const element = ref.current;
    if (!element || reduceMotion) return;
    
    const parsePosition = (pos: string) => {
      const [ref, target] = pos.split(' ');
      return { ref: ref || 'top', target: target || 'top' };
    };
    
    const startParsed = parsePosition(start);
    const endParsed = parsePosition(end);
    
    const getPosition = (parsed: ReturnType<typeof parsePosition>, el: HTMLElement): number => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      
      const refMap = { top: 0, center: vh / 2, bottom: vh };
      const targetMap = { top: rect.top, center: rect.top + rect.height / 2, bottom: rect.top + rect.height };
      
      return window.scrollY + refMap[parsed.ref as keyof typeof refMap] - targetMap[parsed.target as keyof typeof targetMap];
    };
    
    let startPos = 0;
    let endPos = 0;
    let initialized = false;
    
    const handleScroll = () => {
      if (!initialized) {
        startPos = getPosition(startParsed, element);
        endPos = getPosition(endParsed, element);
        initialized = true;
      }
      
      const scrollY = window.scrollY;
      
      if (scrollY >= startPos && scrollY <= endPos) {
        const p = (scrollY - startPos) / (endPos - startPos);
        setProgress(Math.max(0, Math.min(1, p)));
        setIsPinned(true);
        onProgress?.(Math.max(0, Math.min(1, p)));
      } else if (scrollY < startPos) {
        setProgress(0);
        setIsPinned(false);
        onProgress?.(0);
      } else {
        setProgress(1);
        setIsPinned(true);
        onProgress?.(1);
      }
    };
    
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [start, end, onProgress, reduceMotion]);
  
  const pinHeight = typeof height === 'number' ? `${height * 100}vh` : height;
  
  return (
    <div className={className} style={{ position: 'relative' }}>
      <div style={{ height: pinHeight }} aria-hidden="true" />
      <div
        ref={ref}
        style={{
          position: isPinned ? 'sticky' : 'relative',
          top: 0,
          width: '100%',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================
// SCROLL INDICATOR / PROGRESS BAR
// ============================================

export function ScrollProgressIndicator({
  color = '#0050FF',
  height = 3,
  position = 'top',
  zIndex = 9999,
  className = '',
}: {
  color?: string;
  height?: number;
  position?: 'top' | 'bottom';
  zIndex?: number;
  className?: string;
}) {
  const progress = useScrollProgress();
  
  return (
    <motion.div
      className={className}
      style={{
        position: 'fixed',
        [position]: 0,
        left: 0,
        width: '100%',
        height: `${height}px`,
        background: `linear-gradient(90deg, ${color}, ${color}CC)`,
        transformOrigin: 'left center',
        zIndex,
        pointerEvents: 'none',
      }}
      animate={{ scaleX: progress }}
      initial={{ scaleX: 0 }}
      transition={{ duration: 0.1, ease: 'linear' }}
    />
  );
}

// ============================================
// SCROLL-DEPENDENT VALUE TRANSFORMERS
// ============================================

export function useScrollTransform<T>(
  inputRange: number[],
  outputRange: T[],
  scrollProgress: number
): T {
  return useMemo(() => {
    // Clamp progress
    const progress = Math.max(0, Math.min(1, scrollProgress));
    
    // Find the segment
    for (let i = 0; i < inputRange.length - 1; i++) {
      if (progress >= inputRange[i] && progress <= inputRange[i + 1]) {
        const localProgress = (progress - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
        // Linear interpolation for numbers, return first for others
        if (typeof outputRange[i] === 'number' && typeof outputRange[i + 1] === 'number') {
          return outputRange[i] + (outputRange[i + 1] - outputRange[i]) * localProgress as unknown as T;
        }
        return localProgress < 0.5 ? outputRange[i] : outputRange[i + 1];
      }
    }
    
    // Return first or last
    return progress <= inputRange[0] ? outputRange[0] : outputRange[outputRange.length - 1];
  }, [inputRange, outputRange, scrollProgress]);
}

// ============================================
// HORIZONTAL SCROLL SECTION
// ============================================

interface HorizontalScrollProps {
  children: React.ReactNode;
  speed?: number; // multiplier for scroll speed
  className?: string;
  style?: React.CSSProperties;
}

export function HorizontalScroll({
  children,
  speed = 1,
  className = '',
  style,
}: HorizontalScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollX, setScrollX] = useState(0);
  const reduceMotion = useReducedMotion();
  
  useEffect(() => {
    const element = ref.current;
    if (!element || reduceMotion) return;
    
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // Let horizontal scroll through
      
      e.preventDefault();
      element.scrollLeft += e.deltaY * speed;
    };
    
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [speed, reduceMotion]);
  
  return (
    <div
      ref={ref}
      className={className}
      style={{
        display: 'flex',
        gap: '1.5rem',
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        scrollBehavior: 'smooth',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        ...style,
      }}
    >
      <style jsx>{`
        &::-webkit-scrollbar { display: none; }
      `}</style>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as React.ReactElement, {
          style: { 
            ...(child.props.style as any), 
            flexShrink: 0, 
            scrollSnapAlign: 'start',
            minWidth: '300px',
          }
        }) : child
      )}
    </div>
  );
}

// ============================================
// INFINITE MARQUEE
// ============================================

interface MarqueeProps {
  children: React.ReactNode;
  speed?: number; // pixels per second
  direction?: 'left' | 'right';
  pauseOnHover?: boolean;
  className?: string;
  gap?: string;
}

export function Marquee({
  children,
  speed = 50,
  direction = 'left',
  pauseOnHover = true,
  className = '',
  gap = '3rem',
}: MarqueeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [animationState, setAnimationState] = useState<'running' | 'paused'>('running');
  const reduceMotion = useReducedMotion();
  
  useEffect(() => {
    if (reduceMotion) return;
    
    const element = ref.current;
    if (!element) return;
    
    let animationId: number;
    let lastTime = 0;
    let translateX = 0;
    const childWidth = element.children[0]?.clientWidth || 0;
    const totalWidth = Array.from(element.children).reduce((sum, child) => sum + child.clientWidth, 0) + parseFloat(gap) * (element.children.length - 1);
    
    const animate = (time: number) => {
      if (animationState === 'paused') {
        animationId = requestAnimationFrame(animate);
        return;
      }
      
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      
      translateX += direction === 'left' ? -speed * dt : speed * dt;
      
      // Loop seamlessly
      if (direction === 'left' && Math.abs(translateX) >= totalWidth) {
        translateX += totalWidth;
      } else if (direction === 'right' && translateX >= 0) {
        translateX -= totalWidth;
      }
      
      element.style.transform = `translateX(${translateX}px)`;
      animationId = requestAnimationFrame(animate);
    };
    
    // Clone children for seamless loop
    const childrenArray = Array.from(element.children);
    childrenArray.forEach(child => {
      const clone = child.cloneNode(true) as HTMLElement;
      element.appendChild(clone);
    });
    
    animationId = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationId);
  }, [speed, direction, gap, animationState, reduceMotion]);
  
  const handleMouseEnter = () => setAnimationState('paused');
  const handleMouseLeave = () => setAnimationState('running');
  
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        overflow: 'hidden',
        position: 'relative',
      }}
      onMouseEnter={pauseOnHover ? handleMouseEnter : undefined}
      onMouseLeave={pauseOnHover ? handleMouseLeave : undefined}
    >
      <div
        ref={ref}
        style={{
          display: 'flex',
          gap,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================
// SCROLL SNAP SECTIONS
// ============================================

interface ScrollSnapSectionProps {
  children: React.ReactNode;
  className?: string;
  onSectionChange?: (index: number) => void;
}

export function ScrollSnapSections({
  children,
  className = '',
  onSectionChange,
}: ScrollSnapSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container || reduceMotion) return;
    
    const sections = Array.from(container.children);
    if (sections.length === 0) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = sections.indexOf(entry.target as HTMLElement);
            if (index !== -1 && index !== activeIndex) {
              setActiveIndex(index);
              onSectionChange?.(index);
            }
          }
        });
      },
      { root: container, threshold: 0.5, rootMargin: '0px' }
    );
    
    sections.forEach(section => observer.observe(section));
    return () => sections.forEach(section => observer.unobserve(section));
  }, [onSectionChange, activeIndex, reduceMotion]);
  
  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        height: '100vh',
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        scrollBehavior: reduceMotion ? 'auto' : 'smooth',
      }}
    >
      {React.Children.map(children, (child, index) =>
        React.isValidElement(child) ? React.cloneElement(child as React.ReactElement, {
          style: {
            ...(child.props.style as any),
            height: '100vh',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
            display: 'flex',
            flexDirection: 'column',
          },
        }) : child
      )}
    </div>
  );
}