'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product, TIERS, TIER_ORDER, getAllProducts, getProductsByTier, searchProducts, getTierStats } from '@/lib/storefront/product-catalog';
import { PremiumProductCard } from './PremiumProductCard';
import { colors, typography, transitions, borderRadius, motion as motionTokens } from '@/lib/design-system/tokens';

interface PremiumProductGridProps {
  initialTier?: string;
  featured?: boolean;
  limit?: number;
  className?: string;
}

export function PremiumProductGrid({ initialTier, featured, limit, className }: PremiumProductGridProps) {
  const [activeTier, setActiveTier] = useState(initialTier || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mounted, setMounted] = useState(false);
  
  useMemo(() => {
    setMounted(true);
  }, []);
  
  const allProducts = useMemo(() => 
    featured ? getAllProducts().filter(p => p.featured).slice(0, limit) : getAllProducts()
  , [featured, limit]);
  
  const products = useMemo(() => {
    let filtered = allProducts;
    
    if (activeTier !== 'all') {
      filtered = filtered.filter(p => p.tier === activeTier);
    }
    
    if (searchQuery) {
      filtered = searchProducts(searchQuery);
      if (activeTier !== 'all') {
        filtered = filtered.filter(p => p.tier === activeTier);
      }
    }
    
    return limit ? filtered.slice(0, limit) : filtered;
  }, [allProducts, activeTier, searchQuery, limit]);
  
  const stats = useMemo(() => getTierStats(), []);
  
  // Tier filter click handler with animation
  const handleTierChange = useCallback((tier: string) => {
    setActiveTier(tier);
    setSearchQuery('');
  }, []);
  
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);
  
  const tierColors: Record<string, string> = {
    'tier-1': '#10B981',
    'tier-2': '#0050FF',
    'tier-3': '#A855F7',
    'tier-4': '#F97316',
    'tier-5': '#F43F5E',
  };
  
  const tierIcons: Record<string, string> = {
    'tier-1': '🎯',
    'tier-2': '👨‍💼',
    'tier-3': '🏢',
    'tier-4': '☁️',
    'tier-5': '🔧',
  };
  
  const tierNames: Record<string, string> = {
    'tier-1': 'Deep Dives',
    'tier-2': 'Role Bundles',
    'tier-3': 'Vertical Packs',
    'tier-4': 'Cloud Specs',
    'tier-5': 'Tool Ecosystem',
  };
  
  if (!mounted) {
    return (
      <div style={{ 
        minHeight: '400px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#0050FF',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
      </div>
    );
  }
  
  return (
    <div className={className} style={{ width: '100%' }}>
      {/* Tier Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        style={{ marginBottom: '2rem' }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <motion.button
            onClick={() => handleTierChange('all')}
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: borderRadius.full,
              fontSize: '0.8125rem',
              fontWeight: 500,
              fontFamily: typography.fontFamilies.body,
              color: activeTier === 'all' ? '#fff' : colors.text.secondary,
              background: activeTier === 'all' 
                ? 'linear-gradient(135deg, #0050FF 0%, #00D6FF 100%)'
                : 'rgba(255,255,255,0.04)',
              border: activeTier === 'all' 
                ? '1px solid rgba(255,255,255,0.1)' 
                : '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              transition: `all ${transitions.fast}`,
              whiteSpace: 'nowrap',
              boxShadow: activeTier === 'all' ? '0 4px 20px rgba(0, 80, 255, 0.3)' : 'none',
            }}
            whileHover={{
              background: activeTier === 'all' 
                ? 'linear-gradient(135deg, #0066FF 0%, #33DEFF 100%)'
                : 'rgba(255,255,255,0.08)',
              transform: 'translateY(-1px)',
            }}
            whileTap={{ scale: 0.98 }}
            layoutId="tierFilter"
          >
            All Tiers <span style={{ opacity: 0.6 }}>({allProducts.length})</span>
          </motion.button>
          {TIER_ORDER.map((tierId, i) => {
            const tierColor = tierColors[tierId];
            const count = stats[tierId]?.count || 0;
            return (
              <motion.button
                key={tierId}
                onClick={() => handleTierChange(tierId)}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: borderRadius.full,
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  fontFamily: typography.fontFamilies.body,
                  color: activeTier === tierId ? '#fff' : colors.text.secondary,
                  background: activeTier === tierId 
                    ? `linear-gradient(135deg, ${tierColor} 0%, ${tierColor}CC 100%)`
                    : 'rgba(255,255,255,0.04)',
                  border: activeTier === tierId 
                    ? '1px solid rgba(255,255,255,0.1)' 
                    : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  transition: `all ${transitions.fast}`,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: activeTier === tierId ? `0 4px 20px ${tierColor}30` : 'none',
                }}
                whileHover={{
                  background: activeTier === tierId 
                    ? `linear-gradient(135deg, ${tierColor}DD 0%, ${tierColor} 100%)`
                    : 'rgba(255,255,255,0.08)',
                  transform: 'translateY(-1px)',
                }}
                whileTap={{ scale: 0.98 }}
                layoutId="tierFilter"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.03 }}
              >
                <span style={{ fontSize: '1rem' }}>{tierIcons[tierId]}</span>
                <span>{tierNames[tierId]}</span>
                <motion.span
                  style={{
                    padding: '0.125rem 0.5rem',
                    borderRadius: borderRadius.full,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    fontFamily: typography.fontFamilies.mono,
                    background: activeTier === tierId ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                    color: activeTier === tierId ? '#fff' : colors.text.tertiary,
                  }}
                  layoutId="tierCount"
                >
                  {count}
                </motion.span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
      
      {/* Search & View Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <motion.div
          style={{ 
            position: 'relative', 
            flex: 1, 
            maxWidth: '400px',
            minWidth: '280px',
          }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          <svg
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '20px',
              height: '20px',
              color: colors.text.tertiary,
              pointerEvents: 'none',
            }}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search products... (name, tags, description)"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem 0.75rem 3rem',
              borderRadius: borderRadius.xl,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.03)',
              fontSize: '0.875rem',
              fontFamily: typography.fontFamilies.body,
              color: colors.text.primary,
              outline: 'none',
              transition: `all ${transitions.fast}`,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(0, 80, 255, 0.4)';
              e.target.style.background = 'rgba(255,255,255,0.05)';
              e.target.style.boxShadow = '0 0 0 3px rgba(0, 80, 255, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255,255,255,0.06)';
              e.target.style.background = 'rgba(255,255,255,0.03)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </motion.div>
        
        <motion.div
          style={{ display: 'flex', gap: '0.375rem', background: 'rgba(255,255,255,0.03)', padding: '0.375rem', borderRadius: borderRadius.xl, border: '1px solid rgba(255,255,255,0.06)' }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.button
            onClick={() => setViewMode('grid')}
            style={{
              padding: '0.5rem',
              borderRadius: borderRadius.lg,
              background: viewMode === 'grid' ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: viewMode === 'grid' ? colors.text.primary : colors.text.tertiary,
              transition: `all ${transitions.fast}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            whileHover={{ color: colors.text.primary }}
            whileTap={{ scale: 0.95 }}
            aria-label="Grid view"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </motion.button>
          <motion.button
            onClick={() => setViewMode('list')}
            style={{
              padding: '0.5rem',
              borderRadius: borderRadius.lg,
              background: viewMode === 'list' ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: viewMode === 'list' ? colors.text.primary : colors.text.tertiary,
              transition: `all ${transitions.fast}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            whileHover={{ color: colors.text.primary }}
            whileTap={{ scale: 0.95 }}
            aria-label="List view"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </motion.button>
        </motion.div>
      </motion.div>
      
      {/* Results Count */}
      <motion.p
        style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          fontFamily: typography.fontFamilies.body,
          color: colors.text.tertiary,
          marginBottom: '1.5rem',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        Showing <strong style={{ color: colors.text.primary }}>{products.length}</strong> of <strong style={{ color: colors.text.primary }}>{allProducts.length}</strong> products
        {searchQuery && (
          <> matching <strong style={{ color: '#00D6FF' }}>"{searchQuery}"</strong></>
        )}
        {activeTier !== 'all' && (
          <> in <strong style={{ color: tierColors[activeTier] }}>{tierNames[activeTier]}</strong></>
        )}
      </motion.p>
      
      {/* Products Grid/List */}
      <AnimatePresence mode="popLayout">
        {products.length === 0 ? (
          <motion.div
            key="empty"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4rem 2rem',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: borderRadius['2xl'],
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <svg 
              style={{ 
                width: '64px', 
                height: '64px', 
                color: colors.text.tertiary,
                marginBottom: '1.5rem',
              }} 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1" 
              viewBox="0 0 24 24"
            >
              <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              fontFamily: typography.fontFamilies.display,
              color: colors.text.primary,
              marginBottom: '0.5rem',
            }}>
              No products found
            </h3>
            <p style={{
              fontSize: '0.9375rem',
              fontWeight: 400,
              fontFamily: typography.fontFamilies.body,
              color: colors.text.tertiary,
            }}>
              Try adjusting your filters or search query
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={viewMode}
            style={{
              display: viewMode === 'grid' 
                ? 'grid' 
                : 'flex',
              flexDirection: viewMode === 'grid' ? undefined : 'column',
              gridTemplateColumns: viewMode === 'grid' 
                ? 'repeat(auto-fill, minmax(320px, 1fr))' 
                : undefined,
              gap: viewMode === 'grid' ? '1.5rem' : '1rem',
            }}
            layout
          >
            {products.map((product, index) => (
              <PremiumProductCard
                key={product.id}
                product={product}
                onPurchase={slug => window.location.href = `/api/checkout?product=${slug}`}
                index={index}
                variant={viewMode}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Add keyframes for spinner
if (typeof window !== 'undefined' && !document.getElementById('premium-grid-styles')) {
  const style = document.createElement('style');
  style.id = 'premium-grid-styles';
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}