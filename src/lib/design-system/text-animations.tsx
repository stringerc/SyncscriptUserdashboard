/**
 * SyncScript Elite Text Animation System
 * Split text, letter reveals, scramble effects, typewriter, and more
 * Awwwards-level typography animations
 */

'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, useAnimation, useReducedMotion } from 'framer-motion';

// ============================================
// TEXT SPLITTING UTILITIES
// ============================================

export type SplitType = 'chars' | 'words' | 'lines';

export interface SplitTextResult {
  elements: HTMLElement[];
  originalText: string;
  type: SplitType;
}

export function splitText(
  element: HTMLElement, 
  type: SplitType = 'chars',
  options: { 
    className?: string; 
    wrapperClassName?: string;
    ariaHidden?: boolean;
  } = {}
): SplitTextResult {
  const { className = '', wrapperClassName = '', ariaHidden = true } = options;
  const text = element.textContent || '';
  
  // Clear element
  element.innerHTML = '';
  element.style.display = 'inline-block';
  
  let splitUnits: string[];
  switch (type) {
    case 'words':
      splitUnits = text.split(/(\s+)/).filter(s => s.length > 0);
      break;
    case 'lines':
      // For lines, we need to measure - fallback to words for now
      splitUnits = text.split(/(\s+)/).filter(s => s.length > 0);
      break;
    case 'chars':
    default:
      splitUnits = Array.from(text);
      break;
  }
  
  const elements: HTMLElement[] = [];
  const wrapper = document.createElement('span');
  wrapper.className = wrapperClassName;
  wrapper.style.display = 'inline-block';
  
  splitUnits.forEach((unit, index) => {
    const span = document.createElement('span');
    span.className = `split-${type} ${className}`.trim();
    span.textContent = unit;
    span.style.display = type === 'chars' ? 'inline-block' : 'inline';
    span.style.willChange = 'transform, opacity';
    
    if (ariaHidden) {
      span.setAttribute('aria-hidden', 'true');
    }
    
    if (type === 'chars' && unit === ' ') {
      span.style.width = '0.25em';
    }
    
    wrapper.appendChild(span);
    elements.push(span);
  });
  
  element.appendChild(wrapper);
  
  // Hide original text for screen readers
  if (ariaHidden) {
    element.setAttribute('aria-label', text);
  }
  
  return { elements, originalText: text, type };
}

// ============================================
// ANIMATION VARIANTS
// ============================================

export const textVariants = {
  // Fade in up - classic
  fadeInUp: {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        delay: i * 0.03,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    }),
  },
  
  // Fade in down
  fadeInDown: {
    hidden: { opacity: 0, y: -30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        delay: i * 0.03,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    }),
  },
  
  // Scale in
  scaleIn: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: (i: number) => ({
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        delay: i * 0.02,
        ease: [0.34, 1.56, 0.64, 1] as const,
      },
    }),
  },
  
  // Rotate X (3D flip)
  flipIn: {
    hidden: { opacity: 0, rotateX: -90, transformOrigin: 'center bottom' },
    visible: (i: number) => ({
      opacity: 1,
      rotateX: 0,
      transition: {
        duration: 0.7,
        delay: i * 0.04,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    }),
  },
  
  // Slide from right
  slideRight: {
    hidden: { opacity: 0, x: 50 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.6,
        delay: i * 0.03,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    }),
  },
  
  // Slide from left
  slideLeft: {
    hidden: { opacity: 0, x: -50 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.6,
        delay: i * 0.03,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    }),
  },
  
  // Blur to sharp
  blurIn: {
    hidden: { opacity: 0, filter: 'blur(20px)' },
    visible: (i: number) => ({
      opacity: 1,
      filter: 'blur(0px)',
      transition: {
        duration: 0.7,
        delay: i * 0.03,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    }),
  },
  
  // Color wave
  colorWave: {
    hidden: { opacity: 0, color: 'rgba(255,255,255,0)' },
    visible: (i: number) => ({
      opacity: 1,
      color: 'rgba(255,255,255,0.95)',
      transition: {
        duration: 0.5,
        delay: i * 0.02,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    }),
  },
  
  // Gradient reveal (mask)
  gradientReveal: {
    hidden: { opacity: 0, backgroundPosition: '200% center' },
    visible: (i: number) => ({
      opacity: 1,
      backgroundPosition: '0% center',
      transition: {
        duration: 0.8,
        delay: i * 0.02,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    }),
  },
};

// ============================================
// SCRAMBLE EFFECT
// ============================================

const scrambleChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';

export interface ScrambleOptions {
  text: string;
  duration?: number;
  delay?: number;
  charset?: string;
  onComplete?: () => void;
}

export function useScrambleText(
  targetText: string, 
  options: { 
    duration?: number; 
    delay?: number; 
    charset?: string; 
    trigger?: boolean;
    loop?: boolean;
  } = {}
) {
  const { 
    duration = 1500, 
    delay = 0, 
    charset = scrambleChars, 
    trigger = true,
    loop = false 
  } = options;
  
  const [displayText, setDisplayText] = useState(targetText);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();
  const reduceMotion = useReducedMotion();
  
  const scramble = useCallback(() => {
    if (reduceMotion) {
      setDisplayText(targetText);
      return;
    }
    
    setIsAnimating(true);
    startTimeRef.current = performance.now();
    
    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current!;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing
      const eased = 1 - Math.pow(1 - progress, 3);
      
      let result = '';
      for (let i = 0; i < targetText.length; i++) {
        const charProgress = (progress * targetText.length - i) / targetText.length;
        if (charProgress > 0) {
          result += targetText[i];
        } else if (charProgress > -0.3) {
          // Transition zone - mix
          result += Math.random() > 0.5 ? targetText[i] : charset[Math.floor(Math.random() * charset.length)];
        } else {
          result += charset[Math.floor(Math.random() * charset.length)];
        }
      }
      
      setDisplayText(result);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayText(targetText);
        setIsAnimating(false);
        if (loop) {
          setTimeout(scramble, 3000);
        }
      }
    };
    
    if (delay > 0) {
      setTimeout(() => { animationRef.current = requestAnimationFrame(animate); }, delay);
    } else {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [targetText, duration, delay, charset, loop, reduceMotion]);
  
  useEffect(() => {
    if (trigger) {
      scramble();
    }
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [trigger, scramble]);
  
  return { displayText, isAnimating, scramble };
}

// ============================================
// TYPEWRITER EFFECT
// ============================================

export interface TypewriterOptions {
  text: string;
  speed?: number; // ms per character
  startDelay?: number;
  cursor?: boolean;
  cursorChar?: string;
  cursorBlinkSpeed?: number;
  onComplete?: () => void;
}

export function useTypewriter(
  text: string, 
  options: TypewriterOptions = {}
) {
  const { 
    speed = 30, 
    startDelay = 0, 
    cursor = true, 
    cursorChar = '|',
    cursorBlinkSpeed = 530,
    onComplete 
  } = options;
  
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const timeoutRef = useRef<number>();
  const reduceMotion = useReducedMotion();
  
  useEffect(() => {
    if (reduceMotion) {
      setDisplayText(text);
      setIsComplete(true);
      setShowCursor(false);
      onComplete?.();
      return;
    }
    
    setDisplayText('');
    setIsComplete(false);
    
    const start = () => {
      let i = 0;
      const type = () => {
        if (i <= text.length) {
          setDisplayText(text.slice(0, i));
          i++;
          timeoutRef.current = window.setTimeout(type, speed + Math.random() * 50);
        } else {
          setIsComplete(true);
          onComplete?.();
        }
      };
      
      if (startDelay > 0) {
        timeoutRef.current = window.setTimeout(type, startDelay);
      } else {
        type();
      }
    };
    
    start();
    
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [text, speed, startDelay, reduceMotion, onComplete]);
  
  // Cursor blink
  useEffect(() => {
    if (!cursor || isComplete || reduceMotion) {
      setShowCursor(false);
      return;
    }
    
    const interval = setInterval(() => setShowCursor(prev => !prev), cursorBlinkSpeed);
    return () => clearInterval(interval);
  }, [cursor, isComplete, cursorBlinkSpeed, reduceMotion]);
  
  const finalText = cursor && !isComplete && showCursor ? displayText + cursorChar : displayText;
  
  return { text: finalText, isComplete };
}

// ============================================
// REACT COMPONENTS
// ============================================

interface SplitTextProps {
  children: React.ReactNode;
  type?: SplitType;
  variant?: keyof typeof textVariants;
  delay?: number;
  stagger?: number;
  className?: string;
  wrapperClassName?: string;
  triggerOnce?: boolean;
  viewportMargin?: string;
}

export function SplitText({
  children,
  type = 'chars',
  variant = 'fadeInUp',
  delay = 0,
  stagger = 0.03,
  className = '',
  wrapperClassName = '',
  triggerOnce = true,
  viewportMargin = '-50px',
}: SplitTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const reduceMotion = useReducedMotion();
  const controls = useAnimation();
  
  const variantConfig = textVariants[variant];
  
  useEffect(() => {
    if (!ref.current || hasAnimated || reduceMotion) {
      if (reduceMotion) setHasAnimated(true);
      return;
    }
    
    const element = ref.current;
    const result = splitText(element, type, { className, wrapperClassName });
    
    // Animate with Framer Motion
    const animateElements = async () => {
      await controls.start({
        opacity: 1,
        transition: { staggerChildren: stagger, delayChildren: delay },
      });
      setHasAnimated(true);
    };
    
    // Intersection Observer for scroll trigger
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animateElements();
          if (triggerOnce) observer.unobserve(element);
        } else if (!triggerOnce) {
          controls.start({ opacity: 0 });
          setHasAnimated(false);
        }
      },
      { rootMargin: viewportMargin, threshold: 0.1 }
    );
    
    observer.observe(element);
    
    return () => observer.disconnect();
  }, [children, type, variant, delay, stagger, className, wrapperClassName, triggerOnce, viewportMargin, hasAnimated, reduceMotion, controls]);
  
  const initialVariants = variantConfig.hidden || { opacity: 0 };
  
  return (
    <motion.span
      ref={ref}
      style={{ display: 'inline-block', opacity: reduceMotion || hasAnimated ? 1 : 0 }}
      initial={reduceMotion ? { opacity: 1 } : initialVariants}
      animate={controls}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
      custom={reduceMotion ? 0 : 1}
    >
      {children}
    </motion.span>
  );
}

interface ScrambleTextProps {
  text: string;
  duration?: number;
  delay?: number;
  charset?: string;
  trigger?: boolean;
  loop?: boolean;
  className?: string;
  onComplete?: () => void;
}

export function ScrambleText({
  text,
  duration = 1500,
  delay = 0,
  charset = scrambleChars,
  trigger = true,
  loop = false,
  className = '',
  onComplete,
}: ScrambleTextProps) {
  const { displayText, isAnimating, scramble } = useScrambleText(text, { duration, delay, charset, trigger, loop });
  
  useEffect(() => {
    if (!isAnimating && displayText === text) {
      onComplete?.();
    }
  }, [isAnimating, displayText, text, onComplete]);
  
  return <span className={className}>{displayText}</span>;
}

interface TypewriterTextProps {
  text: string;
  speed?: number;
  startDelay?: number;
  cursor?: boolean;
  cursorChar?: string;
  cursorBlinkSpeed?: number;
  className?: string;
  onComplete?: () => void;
}

export function TypewriterText({
  text,
  speed = 30,
  startDelay = 0,
  cursor = true,
  cursorChar = '|',
  cursorBlinkSpeed = 530,
  className = '',
  onComplete,
}: TypewriterTextProps) {
  const { text: displayText, isComplete } = useTypewriter(text, { speed, startDelay, cursor, cursorChar, cursorBlinkSpeed, onComplete });
  
  return <span className={className}>{displayText}</span>;
}

// ============================================
// ADVANCED: GRADIENT TEXT ANIMATION
// ============================================

export function useGradientTextAnimation(
  colors: string[] = ['#0050FF', '#00D6FF', '#10B981'],
  speed: number = 3000
) {
  const [backgroundPosition, setBackgroundPosition] = useState('0% 50%');
  const reduceMotion = useReducedMotion();
  
  useEffect(() => {
    if (reduceMotion) return;
    
    let start: number;
    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = ((timestamp - start) % speed) / speed;
      setBackgroundPosition(`${progress * 200}% 50%`);
      requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  }, [speed, reduceMotion]);
  
  const gradient = `linear-gradient(90deg, ${colors.join(', ')}, ${colors[0]})`;
  
  return {
    style: {
      background: gradient,
      backgroundSize: '200% 100%',
      backgroundPosition,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    },
  };
}

// ============================================
// MORPHING TEXT (SMOOTH TRANSITIONS BETWEEN TEXTS)
// ============================================

export function useMorphingText(
  texts: string[],
  duration: number = 3000,
  transitionDuration: number = 800
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayText, setDisplayText] = useState(texts[0]);
  const reduceMotion = useReducedMotion();
  
  useEffect(() => {
    if (reduceMotion || texts.length <= 1) return;
    
    const cycle = () => {
      const nextIndex = (currentIndex + 1) % texts.length;
      
      setIsTransitioning(true);
      
      // Scramble out
      const scrambleOut = (progress: number) => {
        const currentText = texts[currentIndex];
        let result = '';
        for (let i = 0; i < currentText.length; i++) {
          if (progress > i / currentText.length * 0.5) {
            result += scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
          } else {
            result += currentText[i];
          }
        }
        setDisplayText(result);
      };
      
      // Scramble in
      const scrambleIn = (progress: number) => {
        const nextText = texts[nextIndex];
        let result = '';
        for (let i = 0; i < nextText.length; i++) {
          if (progress > 0.5 + i / nextText.length * 0.5) {
            result += nextText[i];
          } else {
            result += scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
          }
        }
        setDisplayText(result);
      };
      
      // Animate transition
      const startTime = performance.now();
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / transitionDuration, 1);
        
        if (progress < 0.5) {
          scrambleOut(progress * 2);
        } else {
          scrambleIn((progress - 0.5) * 2);
        }
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayText(texts[nextIndex]);
          setCurrentIndex(nextIndex);
          setIsTransitioning(false);
          
          setTimeout(cycle, duration);
        }
      };
      
      requestAnimationFrame(animate);
    };
    
    const timeout = setTimeout(cycle, duration);
    return () => clearTimeout(timeout);
  }, [texts, duration, transitionDuration, currentIndex, reduceMotion]);
  
  return displayText;
}

// ============================================
// STAGGERED REVEAL FOR CHILDREN
// ============================================

interface StaggerRevealProps {
  children: React.ReactNode;
  stagger?: number;
  delay?: number;
  variant?: keyof typeof textVariants;
  triggerOnce?: boolean;
  viewportMargin?: string;
  className?: string;
}

export function StaggerReveal({
  children,
  stagger = 0.08,
  delay = 0,
  variant = 'fadeInUp',
  triggerOnce = true,
  viewportMargin = '-50px',
  className = '',
}: StaggerRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const [hasAnimated, setHasAnimated] = useState(false);
  const reduceMotion = useReducedMotion();
  
  const variantConfig = textVariants[variant];
  
  useEffect(() => {
    if (!ref.current || hasAnimated || reduceMotion) {
      if (reduceMotion) setHasAnimated(true);
      return;
    }
    
    const element = ref.current;
    const childElements = Array.from(element.children);
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          controls.start({
            opacity: 1,
            transition: { staggerChildren: stagger, delayChildren: delay },
          });
          setHasAnimated(true);
          if (triggerOnce) observer.unobserve(element);
        } else if (!triggerOnce) {
          controls.start({ opacity: 0 });
          setHasAnimated(false);
        }
      },
      { rootMargin: viewportMargin, threshold: 0.1 }
    );
    
    observer.observe(element);
    return () => observer.disconnect();
  }, [stagger, delay, triggerOnce, viewportMargin, hasAnimated, reduceMotion, controls]);
  
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={controls}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
    >
      {React.Children.map(children, (child, index) => 
        React.isValidElement(child) ? (
          React.cloneElement(child as React.ReactElement, {
            initial: variantConfig.hidden,
            animate: variantConfig.visible(index),
            transition: variantConfig.visible(index).transition,
          })
        ) : child
      )}
    </motion.div>
  );
}