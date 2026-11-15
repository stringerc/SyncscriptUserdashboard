/**
 * SyncScript Elite Magnetic Cursor System
 * Custom cursor with magnetic attraction, trail effects, and interactive states
 * Awwwards-level micro-interactions
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ============================================
// TYPES
// ============================================

export interface MagneticCursorConfig {
  enabled?: boolean;
  cursorSize?: number;
  trailLength?: number;
  magneticStrength?: number;
  magneticRadius?: number;
  clickScale?: number;
  hideNativeCursor?: boolean;
  zIndex?: number;
}

export interface CursorState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  scale: number;
  isHovering: boolean;
  isClicking: boolean;
  isMagnetic: boolean;
  elementType: 'default' | 'link' | 'button' | 'card' | 'input' | 'custom';
  customCursor?: string;
}

export interface MagneticElement {
  element: HTMLElement;
  strength: number;
  radius: number;
  type: CursorState['elementType'];
  customCursor?: string;
}

// ============================================
// CURSOR MANAGER CLASS
// ============================================

class MagneticCursorManager {
  private config: Required<MagneticCursorConfig>;
  private state: CursorState;
  private elements: Map<HTMLElement, MagneticElement> = new Map();
  private trail: Array<{ x: number; y: number; timestamp: number; scale: number }> = [];
  private animationId: number = 0;
  private cursorEl: HTMLDivElement | null = null;
  private trailEls: HTMLDivElement[] = [];
  private containerEl: HTMLDivElement | null = null;
  private reduceMotion: boolean = false;
  private lastTimestamp: number = 0;
  
  constructor(config: MagneticCursorConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      cursorSize: config.cursorSize ?? 24,
      trailLength: config.trailLength ?? 8,
      magneticStrength: config.magneticStrength ?? 0.15,
      magneticRadius: config.magneticRadius ?? 120,
      clickScale: config.clickScale ?? 0.85,
      hideNativeCursor: config.hideNativeCursor ?? true,
      zIndex: config.zIndex ?? 9999,
    };
    
    this.state = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
      scale: 1,
      isHovering: false,
      isClicking: false,
      isMagnetic: false,
      elementType: 'default',
    };
    
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.init();
  }
  
  private init(): void {
    if (!this.config.enabled || this.reduceMotion) return;
    
    this.createCursorElements();
    this.bindEvents();
    this.animate();
  }
  
  private createCursorElements(): void {
    // Container
    this.containerEl = document.createElement('div');
    this.containerEl.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: ${this.config.zIndex};
      contain: layout style paint;
    `;
    document.body.appendChild(this.containerEl);
    
    // Trail elements
    for (let i = 0; i < this.config.trailLength; i++) {
      const trailEl = document.createElement('div');
      const progress = i / (this.config.trailLength - 1);
      const size = this.config.cursorSize * (0.3 + progress * 0.7);
      const opacity = 0.15 * progress;
      
      trailEl.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 1px solid rgba(0, 80, 255, ${opacity});
        background: radial-gradient(circle at 30% 30%, rgba(0, 214, 255, ${opacity * 0.5}), transparent 70%);
        transform: translate(-50%, -50%) scale(0);
        transition: transform 0.05s linear, opacity 0.1s linear;
        will-change: transform, opacity;
        pointer-events: none;
      `;
      this.containerEl.appendChild(trailEl);
      this.trailEls.push(trailEl);
      this.trail.push({ x: this.state.x, y: this.state.y, timestamp: 0, scale: 0 });
    }
    
    // Main cursor
    this.cursorEl = document.createElement('div');
    this.cursorEl.style.cssText = `
      position: absolute;
      width: ${this.config.cursorSize}px;
      height: ${this.config.cursorSize}px;
      border-radius: 50%;
      border: 2px solid #0050FF;
      background: radial-gradient(circle at 30% 30%, rgba(0, 214, 255, 0.15), transparent 70%);
      transform: translate(-50%, -50%) scale(1);
      transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), 
                  border-color 0.2s ease, 
                  background 0.2s ease,
                  width 0.2s ease,
                  height 0.2s ease;
      will-change: transform, border-color, background, width, height;
      pointer-events: none;
      box-shadow: 
        0 0 20px rgba(0, 80, 255, 0.3),
        0 0 40px rgba(0, 214, 255, 0.15),
        inset 0 0 20px rgba(0, 214, 255, 0.1);
    `;
    this.containerEl.appendChild(this.cursorEl);
    
    // Hide native cursor
    if (this.config.hideNativeCursor) {
      document.documentElement.style.cursor = 'none';
    }
  }
  
  private bindEvents(): void {
    // Mouse move
    const handleMouseMove = (e: MouseEvent) => {
      this.state.targetX = e.clientX;
      this.state.targetY = e.clientY;
    };
    
    // Mouse down/up
    const handleMouseDown = () => {
      this.state.isClicking = true;
      this.updateCursorStyle();
    };
    
    const handleMouseUp = () => {
      this.state.isClicking = false;
      this.updateCursorStyle();
    };
    
    // Magnetic element detection
    const handleMouseOver = (e: Event) => {
      const target = e.target as HTMLElement;
      const magneticEl = this.findMagneticAncestor(target);
      if (magneticEl) {
        this.state.isHovering = true;
        this.state.isMagnetic = true;
        this.state.elementType = magneticEl.type;
        if (magneticEl.customCursor) {
          this.state.customCursor = magneticEl.customCursor;
        }
        this.updateCursorStyle();
      }
    };
    
    const handleMouseOut = (e: Event) => {
      const target = e.target as HTMLElement;
      const magneticEl = this.findMagneticAncestor(target);
      if (magneticEl && !this.isOverMagneticElement(e)) {
        this.state.isHovering = false;
        this.state.isMagnetic = false;
        this.state.elementType = 'default';
        this.state.customCursor = undefined;
        this.updateCursorStyle();
      }
    };
    
    // Touch support
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        this.state.targetX = e.touches[0].clientX;
        this.state.targetY = e.touches[0].clientY;
      }
    };
    
    const handleTouchStart = () => {
      this.state.isClicking = true;
      this.updateCursorStyle();
    };
    
    const handleTouchEnd = () => {
      this.state.isClicking = false;
      this.updateCursorStyle();
    };
    
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    document.addEventListener('mouseover', handleMouseOver, { passive: true });
    document.addEventListener('mouseout', handleMouseOut, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Cleanup
    this.cleanup = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }
  
  private findMagneticAncestor(el: HTMLElement | null): MagneticElement | null {
    while (el && el !== document.body) {
      if (this.elements.has(el)) {
        return this.elements.get(el)!;
      }
      el = el.parentElement;
    }
    return null;
  }
  
  private isOverMagneticElement(e: Event): boolean {
    const target = e.relatedTarget as HTMLElement;
    return this.findMagneticAncestor(target) !== null;
  }
  
  private animate = (timestamp: number): void => {
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 1/30);
    this.lastTimestamp = timestamp;
    
    // Smooth cursor following with spring physics
    const stiffness = 35;
    const damping = 8;
    
    const dx = this.state.targetX - this.state.x;
    const dy = this.state.targetY - this.state.y;
    
    // Apply magnetic attraction from hovered element
    if (this.state.isMagnetic && this.state.isHovering) {
      const magneticEl = this.findMagneticAncestor(document.elementFromPoint(this.state.x, this.state.y) as HTMLElement);
      if (magneticEl) {
        const rect = magneticEl.element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distX = centerX - this.state.x;
        const distY = centerY - this.state.y;
        const dist = Math.sqrt(distX * distX + distY * distY);
        
        if (dist < this.config.magneticRadius) {
          const force = (1 - dist / this.config.magneticRadius) * magneticEl.strength * this.config.magneticStrength;
          this.state.targetX += distX * force;
          this.state.targetY += distY * force;
        }
      }
    }
    
    // Spring physics
    this.state.x += dx * stiffness * dt;
    this.state.y += dy * stiffness * dt;
    
    // Update trail
    this.trail.unshift({ 
      x: this.state.x, 
      y: this.state.y, 
      timestamp: timestamp,
      scale: this.state.scale
    });
    this.trail = this.trail.slice(0, this.config.trailLength);
    
    // Render cursor
    this.renderCursor();
    
    this.animationId = requestAnimationFrame(this.animate);
  };
  
  private renderCursor(): void {
    if (!this.cursorEl || !this.containerEl) return;
    
    // Main cursor
    this.cursorEl.style.transform = `translate(${this.state.x - this.config.cursorSize/2}px, ${this.state.y - this.config.cursorSize/2}px) scale(${this.state.scale})`;
    
    // Trail elements with stagger
    this.trailEls.forEach((trailEl, i) => {
      const point = this.trail[i];
      if (point) {
        const progress = i / (this.config.trailLength - 1);
        const delay = progress * 0.03;
        trailEl.style.transform = `translate(${point.x - trailEl.offsetWidth/2}px, ${point.y - trailEl.offsetHeight/2}px) scale(${point.scale * (1 - progress * 0.5)})`;
        trailEl.style.opacity = `${0.6 * (1 - progress) * point.scale}`;
      }
    });
  }
  
  private updateCursorStyle(): void {
    if (!this.cursorEl) return;
    
    let borderColor = '#0050FF';
    let bgGradient = 'radial-gradient(circle at 30% 30%, rgba(0, 214, 255, 0.15), transparent 70%)';
    let boxShadow = '0 0 20px rgba(0, 80, 255, 0.3), 0 0 40px rgba(0, 214, 255, 0.15), inset 0 0 20px rgba(0, 214, 255, 0.1)';
    let size = this.config.cursorSize;
    let scale = this.state.isClicking ? this.config.clickScale : 1;
    
    switch (this.state.elementType) {
      case 'link':
        borderColor = '#00D6FF';
        bgGradient = 'radial-gradient(circle at 30% 30%, rgba(0, 214, 255, 0.2), transparent 70%)';
        boxShadow = '0 0 25px rgba(0, 214, 255, 0.4), 0 0 50px rgba(0, 80, 255, 0.2), inset 0 0 20px rgba(0, 214, 255, 0.15)';
        size = this.config.cursorSize * 1.3;
        break;
      case 'button':
        borderColor = '#10B981';
        bgGradient = 'radial-gradient(circle at 30% 30%, rgba(16, 185, 129, 0.2), transparent 70%)';
        boxShadow = '0 0 25px rgba(16, 185, 129, 0.4), 0 0 50px rgba(0, 80, 255, 0.15), inset 0 0 20px rgba(16, 185, 129, 0.15)';
        size = this.config.cursorSize * 1.2;
        break;
      case 'card':
        borderColor = '#A855F7';
        bgGradient = 'radial-gradient(circle at 30% 30%, rgba(168, 85, 247, 0.2), transparent 70%)';
        boxShadow = '0 0 30px rgba(168, 85, 247, 0.35), 0 0 60px rgba(0, 80, 255, 0.1), inset 0 0 20px rgba(168, 85, 247, 0.1)';
        size = this.config.cursorSize * 1.4;
        break;
      case 'input':
        borderColor = '#F97316';
        bgGradient = 'radial-gradient(circle at 30% 30%, rgba(249, 115, 22, 0.2), transparent 70%)';
        boxShadow = '0 0 20px rgba(249, 115, 22, 0.3), inset 0 0 20px rgba(249, 115, 22, 0.1)';
        size = this.config.cursorSize * 1.1;
        break;
      case 'custom':
        if (this.state.customCursor) {
          this.cursorEl.style.backgroundImage = this.state.customCursor;
        }
        break;
    }
    
    this.state.scale = scale;
    this.cursorEl.style.borderColor = borderColor;
    this.cursorEl.style.background = bgGradient;
    this.cursorEl.style.boxShadow = boxShadow;
    this.cursorEl.style.width = `${size}px`;
    this.cursorEl.style.height = `${size}px`;
  }
  
  private cleanup: () => void = () => {};
  
  // Public API
  public registerElement(element: HTMLElement, options: Partial<MagneticElement> = {}): void {
    if (!this.config.enabled) return;
    
    this.elements.set(element, {
      element,
      strength: options.strength ?? 1,
      radius: options.radius ?? this.config.magneticRadius,
      type: options.type ?? 'custom',
      customCursor: options.customCursor,
    });
  }
  
  public unregisterElement(element: HTMLElement): void {
    this.elements.delete(element);
  }
  
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (this.containerEl) {
      this.containerEl.style.display = enabled ? 'block' : 'none';
    }
    if (enabled && !this.reduceMotion) {
      document.documentElement.style.cursor = 'none';
    } else {
      document.documentElement.style.cursor = '';
    }
  }
  
  public destroy(): void {
    cancelAnimationFrame(this.animationId);
    this.cleanup();
    
    this.trailEls.forEach(el => el.remove());
    this.cursorEl?.remove();
    this.containerEl?.remove();
    
    this.trailEls = [];
    this.cursorEl = null;
    this.containerEl = null;
    this.elements.clear();
    
    document.documentElement.style.cursor = '';
  }
}

// Singleton instance
let cursorManagerInstance: MagneticCursorManager | null = null;

export function initMagneticCursor(config?: MagneticCursorConfig): MagneticCursorManager {
  if (cursorManagerInstance) {
    cursorManagerInstance.destroy();
  }
  cursorManagerInstance = new MagneticCursorManager(config);
  return cursorManagerInstance;
}

export function getMagneticCursor(): MagneticCursorManager | null {
  return cursorManagerInstance;
}

export function destroyMagneticCursor(): void {
  cursorManagerInstance?.destroy();
  cursorManagerInstance = null;
}

// ============================================
// REACT HOOK
// ============================================

export function useMagneticCursor(config: MagneticCursorConfig = {}) {
  const [manager, setManager] = useState<MagneticCursorManager | null>(null);
  
  useEffect(() => {
    const mgr = initMagneticCursor(config);
    setManager(mgr);
    
    return () => {
      destroyMagneticCursor();
      setManager(null);
    };
  }, []);
  
  const register = useCallback((element: HTMLElement, options?: Partial<MagneticElement>) => {
    manager?.registerElement(element, options);
  }, [manager]);
  
  const unregister = useCallback((element: HTMLElement) => {
    manager?.unregisterElement(element);
  }, [manager]);
  
  return { manager, register, unregister };
}

// ============================================
// AUTO-REGISTRATION FOR COMMON ELEMENTS
// ============================================

export function autoRegisterMagneticElements(manager: MagneticCursorManager): void {
  if (!manager) return;
  
  // Links
  document.querySelectorAll('a[href], button, [role="button"]').forEach(el => {
    if (el.tagName === 'A') {
      manager.registerElement(el as HTMLElement, { type: 'link', strength: 1.2 });
    } else {
      manager.registerElement(el as HTMLElement, { type: 'button', strength: 1 });
    }
  });
  
  // Cards with data-magnetic attribute
  document.querySelectorAll('[data-magnetic="card"]').forEach(el => {
    manager.registerElement(el as HTMLElement, { type: 'card', strength: 0.8, radius: 150 });
  });
  
  // Inputs
  document.querySelectorAll('input, textarea, select').forEach(el => {
    manager.registerElement(el as HTMLElement, { type: 'input', strength: 0.5 });
  });
  
  // Custom magnetic elements
  document.querySelectorAll('[data-magnetic]').forEach(el => {
    const type = el.getAttribute('data-magnetic') as CursorState['elementType'] || 'custom';
    const strength = parseFloat(el.getAttribute('data-magnetic-strength') || '1');
    const radius = parseFloat(el.getAttribute('data-magnetic-radius') || '120');
    manager.registerElement(el as HTMLElement, { type, strength, radius });
  });
}

// ============================================
// RIPPLE EFFECT UTILITY
// ============================================

export function createRippleEffect(
  element: HTMLElement, 
  x: number, 
  y: number, 
  color: string = 'rgba(0, 80, 255, 0.3)'
): void {
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.5;
  
  const ripple = document.createElement('div');
  ripple.style.cssText = `
    position: absolute;
    top: ${y - rect.top - size/2}px;
    left: ${x - rect.left - size/2}px;
    width: ${size}px;
    height: ${size}px;
    border-radius: 50%;
    background: ${color};
    transform: scale(0);
    opacity: 0.4;
    pointer-events: none;
    animation: magnetic-ripple 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    z-index: 1000;
  `;
  
  // Ensure parent has relative positioning
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.position === 'static') {
    element.style.position = 'relative';
  }
  element.style.overflow = 'hidden';
  
  element.appendChild(ripple);
  
  ripple.addEventListener('animationend', () => ripple.remove());
  
  // Add keyframes if not exists
  if (!document.getElementById('magnetic-ripple-styles')) {
    const style = document.createElement('style');
    style.id = 'magnetic-ripple-styles';
    style.textContent = `
      @keyframes magnetic-ripple {
        to {
          transform: scale(1);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// ============================================
// MAGNETIC BUTTON COMPONENT HELPER
// ============================================

export function useMagneticButton(
  options: { 
    strength?: number; 
    radius?: number; 
    onClick?: (e: MouseEvent) => void;
    rippleColor?: string;
  } = {}
) {
  const ref = useRef<HTMLButtonElement>(null);
  const { manager, register, unregister } = useMagneticCursor();
  
  useEffect(() => {
    if (ref.current) {
      register(ref.current, { 
        type: 'button', 
        strength: options.strength ?? 1, 
        radius: options.radius ?? 120 
      });
      
      const handleClick = (e: MouseEvent) => {
        createRippleEffect(ref.current!, e.clientX, e.clientY, options.rippleColor);
        options.onClick?.(e);
      };
      
      ref.current.addEventListener('click', handleClick);
      return () => {
        ref.current?.removeEventListener('click', handleClick);
        unregister(ref.current!);
      };
    }
  }, [register, unregister, options.strength, options.radius, options.rippleColor, options.onClick]);
  
  return ref;
}