'use client';

import { motion } from 'framer-motion';
import { Product, TIERS } from '@/lib/storefront/product-catalog';
import { colors, typography, transitions, borderRadius, getTierGradient, motion as motionTokens } from '@/lib/design-system/tokens';

interface PremiumProductCardProps {
  product: Product;
  onPurchase: (slug: string) => void;
  index?: number;
  variant?: 'grid' | 'list' | 'featured';
}

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

const statIcons = {
  scripts: '📜',
  verifiers: '✅',
  debug: '🔍',
  provisioning: '🚀',
};

export function PremiumProductCard({ 
  product, 
  onPurchase, 
  index = 0,
  variant = 'grid' 
}: PremiumProductCardProps) {
  const tier = TIERS[product.tier];
  const tierColor = tierColors[product.tier as keyof typeof tierColors] || tierColors['tier-1'];
  const tierGradient = getTierGradient(product.tier);
  
  const isFeatured = variant === 'featured';
  const cardPadding = isFeatured ? '2rem' : '1.5rem';
  const cardGap = isFeatured ? '1.5rem' : '1rem';
  
  return (
    <motion.article
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: variant === 'list' ? 'row' : 'column',
        alignItems: variant === 'list' ? 'center' : 'flex-start',
        gap: cardGap,
        padding: cardPadding,
        background: colors.gradients.card,
        border: `1px solid ${colors.borders.subtle}`,
        borderRadius: borderRadius['2xl'],
        overflow: 'hidden',
        transition: `all ${transitions.normal}`,
        width: variant === 'list' ? '100%' : undefined,
        minHeight: isFeatured ? '320px' : variant === 'list' ? '140px' : undefined,
      }}
      whileHover={{
        background: colors.gradients.cardHover,
        borderColor: colors.borders.default,
        boxShadow: `${colors.shadows.lg}, 0 0 60px ${tierColor}20`,
        transform: variant === 'list' ? 'translateX(4px)' : 'translateY(-6px)',
      }}
      whileTap={{ scale: 0.99 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      layout
    >
      {/* Tier accent bar - top for grid, left for list */}
      <motion.div
        style={{
          position: 'absolute',
          ...(variant === 'list' 
            ? { top: 0, bottom: 0, left: 0, width: '4px' }
            : { top: 0, left: 0, right: 0, height: '4px' }),
          background: tierGradient,
          opacity: 0.8,
        }}
        initial={{ scaleX: variant === 'list' ? 1 : 0, scaleY: variant === 'list' ? 0 : 1 }}
        animate={{ scaleX: 1, scaleY: 1 }}
        transition={{ delay: 0.3, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      />
      
      {/* Featured badge */}
      {product.featured && (
        <motion.div
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.25rem 0.625rem',
            borderRadius: borderRadius.full,
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#FBBF24',
            fontSize: '0.6875rem',
            fontWeight: 600,
            fontFamily: typography.fontFamilies.body,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            backdropFilter: 'blur(10px)',
          }}
          initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.4, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <span>⭐</span>
          Featured
        </motion.div>
      )}
      
      {/* Tier Badge */}
      <motion.div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.375rem 0.75rem',
          borderRadius: borderRadius.full,
          background: `rgba(${hexToRgb(tierColor).join(', ')}, 0.12)`,
          border: `1px solid rgba(${hexToRgb(tierColor).join(', ')}, 0.25)`,
          color: tierColor,
          fontSize: '0.6875rem',
          fontWeight: 600,
          fontFamily: typography.fontFamilies.body,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 + index * 0.06 }}
      >
        <span style={{ fontSize: '0.875rem' }}>{tierIcons[product.tier]}</span>
        {tierNames[product.tier]}
      </motion.div>
      
      {/* Main Content */}
      <div style={{
        display: 'flex',
        flexDirection: variant === 'list' ? 'row' : 'column',
        flex: 1,
        gap: variant === 'list' ? '2rem' : '1rem',
        width: '100%',
        alignItems: variant === 'list' ? 'center' : 'flex-start',
      }}>
        {/* Product Info */}
        <div style={{
          flex: variant === 'list' ? '1 1 50%' : 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          minWidth: 0,
        }}>
          <motion.h3
            style={{
              fontSize: isFeatured ? '1.375rem' : variant === 'list' ? '1.125rem' : '1.125rem',
              fontWeight: 700,
              fontFamily: typography.fontFamilies.display,
              color: colors.text.primary,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + index * 0.06 }}
          >
            {product.name}
          </motion.h3>
          
          <motion.p
            style={{
              fontSize: isFeatured ? '1rem' : '0.875rem',
              fontWeight: 400,
              fontFamily: typography.fontFamilies.body,
              color: colors.text.secondary,
              lineHeight: 1.5,
              margin: 0,
              display: variant === 'list' ? '-webkit-box' : 'block',
              WebkitLineClamp: variant === 'list' ? 2 : undefined,
              WebkitBoxOrient: variant === 'list' ? 'vertical' : undefined,
              overflow: variant === 'list' ? 'hidden' : 'visible',
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.06 }}
          >
            {product.tagline}
          </motion.p>
          
          {/* Stats */}
          <motion.div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: variant === 'list' ? '1.5rem' : '1rem',
              marginTop: variant === 'list' ? 0 : '0.5rem',
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + index * 0.06 }}
          >
            {[
              { icon: statIcons.scripts, value: product.script_count, label: 'Scripts' },
              { icon: statIcons.verifiers, value: product.verifier_count, label: 'Verifiers' },
              { icon: statIcons.debug, value: product.debug_count, label: 'Debug' },
              { icon: statIcons.provisioning, value: product.provisioning_count, label: 'Provisioning' },
            ].map((stat, i) => (
              <span
                key={stat.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: variant === 'list' ? '0.8125rem' : '0.75rem',
                  fontWeight: 500,
                  fontFamily: typography.fontFamilies.body,
                  color: colors.text.tertiary,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: variant === 'list' ? '1rem' : '0.875rem' }}>{stat.icon}</span>
                <span>{stat.value}</span>
              </span>
            ))}
          </motion.div>
          
          {/* Tags - only for grid/featured */}
          {variant !== 'list' && product.tags.length > 0 && (
            <motion.div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.375rem',
                marginTop: '0.25rem',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.06 }}
            >
              {product.tags.slice(0, isFeatured ? 6 : 4).map((tag, i) => (
                <span
                  key={tag}
                  style={{
                    padding: '0.25rem 0.625rem',
                    borderRadius: borderRadius.md,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    fontFamily: typography.fontFamilies.mono,
                    color: colors.text.tertiary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    transition: `all ${transitions.fast}`,
                  }}
                >
                  {tag}
                </span>
              ))}
              {product.tags.length > (isFeatured ? 6 : 4) && (
                <span style={{
                  padding: '0.25rem 0.625rem',
                  borderRadius: borderRadius.md,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  fontFamily: typography.fontFamilies.mono,
                  color: colors.text.tertiary,
                }}>
                  +{product.tags.length - (isFeatured ? 6 : 4)}
                </span>
              )}
            </motion.div>
          )}
        </div>
        
        {/* Price & CTA - Right side for list, bottom for grid */}
        <motion.div
          style={{
            display: 'flex',
            flexDirection: variant === 'list' ? 'row' : 'column',
            alignItems: variant === 'list' ? 'flex-end' : 'stretch',
            gap: '1rem',
            flexShrink: 0,
            width: variant === 'list' ? 'auto' : '100%',
            marginLeft: variant === 'list' ? 'auto' : 0,
          }}
          initial={{ opacity: 0, x: variant === 'list' ? 20 : 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 + index * 0.06 }}
        >
          <div style={{
            display: 'flex',
            flexDirection: variant === 'list' ? 'column' : 'row',
            alignItems: variant === 'list' ? 'flex-end' : 'center',
            gap: '0.5rem',
            textAlign: variant === 'list' ? 'right' : 'left',
          }}>
            <span
              style={{
                fontSize: isFeatured ? '2rem' : variant === 'list' ? '1.5rem' : '1.75rem',
                fontWeight: 700,
                fontFamily: typography.fontFamilies.display,
                color: colors.text.primary,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              ${product.price_usd}
            </span>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              fontFamily: typography.fontFamilies.body,
              color: colors.text.tertiary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginTop: variant === 'list' ? '0.125rem' : 0,
            }}>
              one-time
            </span>
          </div>
          
          <motion.button
            onClick={() => onPurchase(product.slug)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: `${variant === 'list' ? '0.625rem 1.25rem' : '0.875rem 1.5rem'}`,
              borderRadius: borderRadius.xl,
              fontSize: variant === 'list' ? '0.8125rem' : '0.9375rem',
              fontWeight: 600,
              fontFamily: typography.fontFamilies.body,
              color: '#fff',
              background: colors.gradients.accentPrimary,
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              boxShadow: `0 4px 20px ${tierColor}30, inset 0 1px 0 rgba(255,255,255,0.1)`,
              transition: `all ${transitions.fast}`,
              whiteSpace: 'nowrap',
              position: 'relative',
              overflow: 'hidden',
              width: variant === 'list' ? 'auto' : '100%',
            }}
            whileHover={{
              boxShadow: `0 8px 32px ${tierColor}40, inset 0 1px 0 rgba(255,255,255,0.15)`,
              transform: 'translateY(-1px)',
            }}
            whileTap={{ scale: 0.98 }}
          >
            <span style={{ position: 'relative', zIndex: 1 }}>
              {variant === 'list' ? 'Buy Now' : 'Get Instant Access'}
            </span>
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
          </motion.button>
        </motion.div>
      </div>
      
      {/* Subtle glow on hover - decorative */}
      <motion.div
        style={{
          position: 'absolute',
          inset: '-50%',
          background: `radial-gradient(ellipse at center, ${tierColor}10 0%, transparent 70%)`,
          opacity: 0,
          pointerEvents: 'none',
          borderRadius: 'inherit',
        }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      />
    </motion.article>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 80, 255];
}

const tierColors: Record<string, string> = {
  'tier-1': '#10B981',
  'tier-2': '#0050FF',
  'tier-3': '#A855F7',
  'tier-4': '#F97316',
  'tier-5': '#F43F5E',
};