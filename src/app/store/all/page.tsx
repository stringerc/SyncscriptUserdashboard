'use client';

import { EliteSection, EliteNavbar } from '@/lib/design-system';
import { PremiumNavbar } from '@/components/storefront/PremiumNavbar';
import { PremiumProductGrid } from '@/components/storefront/PremiumProductGrid';
import { getCatalogSummary } from '@/lib/storefront/product-catalog';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { colors, typography, transitions, borderRadius } from '@/lib/design-system/tokens';

export default function StoreAllPage() {
  const searchParams = useSearchParams();
  const initialTier = searchParams.get('tier') || 'all';
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
        {/* Header */}
        <EliteSection
          background="secondary"
          padding="lg"
          reveal
          revealVariant="slide-down"
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <motion.div
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            >
              <div>
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
                  Product Catalog
                </span>
                <h1 style={{
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                  fontWeight: 700,
                  fontFamily: typography.fontFamilies.display,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  color: colors.text.primary,
                  marginBottom: '0.5rem',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(0,214,255,0.8) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  All Products
                </h1>
                <p style={{
                  fontSize: '1.125rem',
                  fontWeight: 400,
                  fontFamily: typography.fontFamilies.body,
                  lineHeight: 1.6,
                  color: colors.text.secondary,
                }}>
                  {summary.total_products} production-ready packs · {summary.total_scripts.toLocaleString()} total scripts
                </p>
              </div>
            </motion.div>
          </div>
        </EliteSection>
        
        {/* Main Content */}
        <EliteSection
          background="primary"
          padding="md"
          reveal
          revealVariant="fade"
        >
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem 3rem' }}>
            <PremiumProductGrid initialTier={initialTier} />
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