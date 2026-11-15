'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { colors, typography, styleUtils, transitions, motion as motionTokens } from '@/lib/design-system/tokens';

const navLinks = [
  { href: '/store', label: 'Overview' },
  { href: '/store/all', label: 'All Products' },
  { href: '/store/all?tier=tier-3', label: 'Vertical Packs' },
  { href: '/store/all?tier=tier-4', label: 'Cloud Specs' },
  { href: '/store/all?tier=tier-1', label: 'Deep Dives' },
];

const tierColors = {
  'tier-1': '#10B981',
  'tier-2': '#0050FF',
  'tier-3': '#A855F7',
  'tier-4': '#F97316',
  'tier-5': '#F43F5E',
};

export function PremiumNavbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Framer Motion scroll detection for nav appearance
  const { scrollY } = useScroll();
  const navOpacity = useTransform(scrollY, [0, 100], [0, 1]);
  const navBlur = useTransform(scrollY, [0, 50], ['0px', '20px']);
  const navBg = useTransform(scrollY, [0, 100], ['rgba(5,5,5,0)', 'rgba(5,5,5,0.95)']);
  const navBorder = useTransform(scrollY, [0, 100], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.06)']);
  
  // Sync local state with scroll for mobile menu behavior
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const isActive = (href: string) => {
    if (href === '/store') return pathname === '/store';
    return pathname.startsWith(href);
  };
  
  return (
    <>
      {/* Background glow that appears on scroll */}
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '200px',
          background: 'linear-gradient(180deg, rgba(0,80,255,0.06) 0%, transparent 100%)',
          zIndex: 40,
          pointerEvents: 'none',
        }}
        animate={{ opacity: scrolled ? 1 : 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      />
      
      {/* Main Navbar */}
      <motion.nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          height: '64px',
          background: scrolled ? 'rgba(5, 5, 5, 0.95)' : 'rgba(5, 5, 5, 0.6)',
          backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'blur(10px) saturate(150%)',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
        animate={{
          background: navBg,
          backdropFilter: navBlur,
          borderBottomColor: navBorder,
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Left: Logo */}
        <Link
          href="/store"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none',
            color: colors.text.primary,
            fontFamily: typography.fontFamilies.display,
            fontWeight: 600,
            fontSize: '1.125rem',
            letterSpacing: '-0.02em',
          }}
          aria-label="SyncScript Home"
        >
          <span style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: colors.gradients.accentPrimary,
            fontWeight: 700,
            fontSize: '0.875rem',
            color: '#fff',
            boxShadow: '0 4px 16px rgba(0, 80, 255, 0.3)',
          }}>
            ⟲
          </span>
          <span style={{ fontFeatureSettings: '"ss01" on' }}>SyncScript</span>
        </Link>
        
        {/* Center: Navigation Links (Desktop) */}
        <div style={{
          display: 'none',
          alignItems: 'center',
          gap: '0.5rem',
        }} className="hidden md:flex">
          {navLinks.map((link, index) => (
            <motion.button
              key={link.href}
              onClick={() => window.location.href = link.href}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 500,
                fontFamily: typography.fontFamilies.body,
                color: isActive(link.href) ? colors.text.primary : colors.text.tertiary,
                background: isActive(link.href) ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: `all ${transitions.fast}`,
                position: 'relative',
              }}
              whileHover={{ 
                color: colors.text.primary,
                background: 'rgba(255,255,255,0.08)',
              }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              {link.label}
              {isActive(link.href) && (
                <motion.span
                  layoutId="activeIndicator"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '24px',
                    height: '2px',
                    background: colors.gradients.accentPrimary,
                    borderRadius: '2px',
                  }}
                />
              )}
            </motion.button>
          ))}
        </div>
        
        {/* Right: CTA Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <motion.a
            href="/store/all"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: 600,
              fontFamily: typography.fontFamilies.body,
              color: '#fff',
              textDecoration: 'none',
              background: colors.gradients.accentPrimary,
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 20px rgba(0, 80, 255, 0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
              transition: `all ${transitions.normal}`,
              position: 'relative',
              overflow: 'hidden',
            }}
            whileHover={{
              boxShadow: '0 8px 32px rgba(0, 80, 255, 0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              transform: 'translateY(-1px)',
            }}
            whileTap={{ scale: 0.98 }}
          >
            <span style={{ position: 'relative', zIndex: 1 }}>Browse Packs</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'relative', zIndex: 1 }}>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            {/* Shine effect */}
            <motion.div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                transform: 'translateX(-100%)',
              }}
              animate={{ transform: ['translateX(-100%)', 'translateX(100%)'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
          </motion.a>
          
          {/* Mobile Menu Button */}
          <motion.button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: colors.text.primary,
              cursor: 'pointer',
              transition: `all ${transitions.fast}`,
            }}
            className="md:hidden"
            whileHover={{ background: 'rgba(255,255,255,0.08)' }}
            whileTap={{ scale: 0.95 }}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            )}
          </motion.button>
        </div>
      </motion.nav>
      
      {/* Mobile Menu */}
      <motion.div
        initial={false}
        animate={{ 
          opacity: mobileMenuOpen ? 1 : 0,
          height: mobileMenuOpen ? 'auto' : 0,
          paddingTop: mobileMenuOpen ? '1rem' : 0,
          paddingBottom: mobileMenuOpen ? '1.5rem' : 0,
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        style={{
          position: 'fixed',
          top: '64px',
          left: 0,
          right: 0,
          background: 'rgba(5, 5, 5, 0.98)',
          backdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          zIndex: 49,
          overflow: 'hidden',
          paddingLeft: '1.5rem',
          paddingRight: '1.5rem',
        }}
        className="md:hidden"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {navLinks.map((link, index) => (
            <motion.a
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                padding: '0.875rem 1rem',
                borderRadius: '10px',
                fontSize: '1rem',
                fontWeight: 500,
                fontFamily: typography.fontFamilies.body,
                color: isActive(link.href) ? colors.text.primary : colors.text.secondary,
                background: isActive(link.href) ? 'rgba(255,255,255,0.06)' : 'transparent',
                textDecoration: 'none',
                border: isActive(link.href) ? `1px solid ${colors.borders.accent}` : 'none',
                transition: `all ${transitions.fast}`,
              }}
              whileHover={{ 
                color: colors.text.primary,
                background: 'rgba(255,255,255,0.08)',
              }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              {link.label}
            </motion.a>
          ))}
          
          <motion.div
            style={{
              marginTop: '0.5rem',
              paddingTop: '1rem',
              borderTop: `1px solid ${colors.borders.subtle}`,
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Link
              href="/store/all"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.875rem 1.5rem',
                borderRadius: '10px',
                fontSize: '1rem',
                fontWeight: 600,
                fontFamily: typography.fontFamilies.body,
                color: '#fff',
                textDecoration: 'none',
                background: colors.gradients.accentPrimary,
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 4px 20px rgba(0, 80, 255, 0.25)',
              }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Browse All Packs
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}