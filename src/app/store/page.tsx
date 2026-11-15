'use client';

import { EliteHero, EliteSection, EliteNavbar } from '@/lib/design-system';
import { PremiumProductGrid } from '@/components/storefront/PremiumProductGrid';
import { getCatalogSummary } from '@/lib/storefront/product-catalog';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { colors, typography, transitions, borderRadius, styleUtils } from '@/lib/design-system/tokens';

export default function StorePage() {
  const summary = getCatalogSummary();
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: colors.background.primary,
      color: colors.text.primary,
      fontFamily: typography.fontFamilies.body,
    }}>
      {/* Magnetic cursor initialization */}
      <EliteNavbar />
      
      {/* Premium Navbar */}
      <PremiumNavbar />
      
      <main style={{ paddingTop: '64px' }}>
        {/* Elite Hero Section */}
        <EliteHero
          title="Terminal Automation"
          accentText="Script Packs"
          subtitle="500 production-ready script packs for AI/ML engineers. Verifiers, debug tools, provisioning tests, and Action Gate safety — all MIT licensed."
          ctaText="Browse All Packs"
          ctaHref="/store/all"
          secondaryCtaText="Explore Tiers"
          secondaryCtaHref="/store/all?tier=tier-1"
          stats={[
            { value: summary.total_products, label: "Products" },
            { value: summary.total_scripts.toLocaleString(), label: "Total Scripts" },
            { value: `$${(summary.total_revenue_potential_cents / 100).toLocaleString()}`, label: "Revenue Potential" },
            { value: "5", label: "Tiers" },
          ]}
        />
        
        {/* Tier Overview Section */}
        <EliteSection
          background="secondary"
          padding="xl"
          reveal
          revealVariant="slide-up"
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <motion.div
              style={{ textAlign: 'center', marginBottom: '4rem' }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
            >
              <span style={{
                display: 'inline-block',
                padding: '0.5rem 1.25rem',
                borderRadius: borderRadius.full,
                fontSize: '0.75rem',
                fontWeight: 600,
                fontFamily: typography.fontFamilies.mono,
                color: '#00D6FF',
                background: 'rgba(0, 214, 255, 0.1)',
                border: '1px solid rgba(0, 214, 255, 0.2)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '1rem',
              }}>
                Product Tiers
              </span>
              <h2 style={{
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 700,
                fontFamily: typography.fontFamilies.display,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: colors.text.primary,
                marginBottom: '1rem',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(0,214,255,0.8) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Choose Your Tier
              </h2>
              <p style={{
                fontSize: '1.125rem',
                fontWeight: 400,
                fontFamily: typography.fontFamilies.body,
                lineHeight: 1.6,
                color: colors.text.secondary,
                maxWidth: '600px',
                margin: '0 auto',
              }}>
                Five specialized tiers — from deep technical dives to cloud-native specializations. Every pack includes verifiers, debug scripts, and provisioning tests.
              </p>
            </motion.div>
            
            <PremiumProductGrid featured limit={5} />
            
            <motion.div
              style={{ textAlign: 'center', marginTop: '3rem' }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Link
                href="/store/all"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.875rem 2rem',
                  borderRadius: borderRadius.xl,
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  fontFamily: typography.fontFamilies.body,
                  color: colors.text.primary,
                  textDecoration: 'none',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  transition: `all ${transitions.normal}`,
                }}
              >
                View All 500 Products →
              </Link>
            </motion.div>
          </div>
        </EliteSection>
        
        {/* Trust Indicators */}
        <EliteSection
          background="primary"
          padding="lg"
          reveal
          revealVariant="slide-up"
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.5rem',
            }}>
              {trustItems.map((item, index) => (
                <motion.div
                  key={item.title}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '2rem 1.5rem',
                    background: 'linear-gradient(145deg, rgba(10, 10, 12, 0.8) 0%, rgba(15, 15, 18, 0.9) 100%)',
                    border: `1px solid ${colors.borders.subtle}`,
                    borderRadius: borderRadius['2xl'],
                    transition: `all ${transitions.normal}`,
                  }}
                  whileHover={{
                    borderColor: colors.borders.default,
                    boxShadow: colors.shadows.md,
                    transform: 'translateY(-4px)',
                  }}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ delay: 0.1 + index * 0.1, duration: 0.5 }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: 'rgba(0, 80, 255, 0.1)',
                    border: '1px solid rgba(0, 80, 255, 0.15)',
                    marginBottom: '1rem',
                    fontSize: '1.5rem',
                  }}>
                    {item.icon}
                  </div>
                  <h4 style={{
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    fontFamily: typography.fontFamilies.display,
                    color: colors.text.primary,
                    marginBottom: '0.5rem',
                  }}>
                    {item.title}
                  </h4>
                  <p style={{
                    fontSize: '0.9375rem',
                    fontWeight: 400,
                    fontFamily: typography.fontFamilies.body,
                    lineHeight: 1.5,
                    color: colors.text.tertiary,
                  }}>
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </EliteSection>
        
        {/* Final CTA */}
        <EliteSection
          background="gradient"
          padding="xl"
          reveal
          revealVariant="fade"
        >
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
            >
              <h2 style={{
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 700,
                fontFamily: typography.fontFamilies.display,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: colors.text.primary,
                marginBottom: '1.5rem',
              }}>
                Ready to Automate?
              </h2>
              <p style={{
                fontSize: '1.125rem',
                fontWeight: 400,
                fontFamily: typography.fontFamilies.body,
                lineHeight: 1.6,
                color: colors.text.secondary,
                maxWidth: '600px',
                margin: '0 auto 2.5rem',
              }}>
                Browse all 500 packs, filter by tier or category, and get instant access to production-ready automation.
              </p>
              <Link
                href="/store/all"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 2.5rem',
                  borderRadius: borderRadius['2xl'],
                  fontSize: '1.0625rem',
                  fontWeight: 600,
                  fontFamily: typography.fontFamilies.body,
                  color: '#fff',
                  textDecoration: 'none',
                  background: 'linear-gradient(135deg, #0050FF 0%, #00D6FF 100%)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 8px 32px rgba(0, 80, 255, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                  transition: `all ${transitions.normal}`,
                }}
              >
                Browse All Products
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </motion.div>
          </div>
        </EliteSection>
      </main>
      
      {/* Footer */}
      <footer style={{
        padding: '3rem 1.5rem',
        borderTop: `1px solid ${colors.borders.subtle}`,
        background: 'rgba(5, 5, 5, 0.5)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{
            fontSize: '0.875rem',
            fontWeight: 400,
            fontFamily: typography.fontFamilies.body,
            color: colors.text.tertiary,
          }}>
            © 2025 SyncScript. All script packs MIT licensed. Built for engineers who automate.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Import PremiumNavbar for the existing one
import { PremiumNavbar } from '@/components/storefront/PremiumNavbar';

const trustItems = [
  { icon: '🛡️', title: 'Action Gate Safety', desc: '5-layer validation on every script' },
  { icon: '✅', title: 'PASS/FAIL Verifiers', desc: 'CI/CD ready exit codes' },
  { icon: '🔍', title: 'Root Cause Debug', desc: 'Automated crash analysis' },
  { icon: '📄', title: 'MIT Licensed', desc: 'Use anywhere, commercially' },
];