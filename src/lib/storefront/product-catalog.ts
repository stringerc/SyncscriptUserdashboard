/**
 * SyncScript Storefront — Product Catalog
 * 
 * 500 Terminal Automation Script Packs for AI/ML Engineers
 * Generated from production factory, synced to Stripe
 */

import { PRODUCT_CATALOG } from './generated-catalog';

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  tagline: string;
  tier: string;
  price_cents: number;
  price_usd: number;
  currency: 'USD';
  script_count: number;
  category_count: number;
  verifier_count: number;
  debug_count: number;
  provisioning_count: number;
  categories: Array<{
    name: string;
    slug: string;
    script_count: number;
    scripts: string[];
  }>;
  verifiers: string[];
  debug_scripts: string[];
  provisioning_scripts: string[];
  requirements: string[];
  license: string;
  author: string;
  support_email: string;
  refund_policy: string;
  zip_url?: string;
  stripe_price_id?: string;
  stripe_product_id?: string;
  active: boolean;
  featured: boolean;
  tags: string[];
}

export interface TierInfo {
  id: string;
  name: string;
  description: string;
  price_range: string;
  product_count: number;
  color: string;
  icon: string;
}

// Tier definitions
export const TIERS: Record<string, TierInfo> = {
  'tier-1': {
    id: 'tier-1',
    name: 'Deep Dives',
    description: 'Single-category mastery packs',
    price_range: '$27',
    product_count: 100,
    color: 'emerald',
    icon: '🎯'
  },
  'tier-2': {
    id: 'tier-2',
    name: 'Role Bundles',
    description: 'Cross-category packs for specific job titles',
    price_range: '$37',
    product_count: 120,
    color: 'blue',
    icon: '👨‍💼'
  },
  'tier-3': {
    id: 'tier-3',
    name: 'Vertical Packs',
    description: 'Compliance + tooling for regulated industries',
    price_range: '$47',
    product_count: 100,
    color: 'purple',
    icon: '🏢'
  },
  'tier-4': {
    id: 'tier-4',
    name: 'Cloud Specializations',
    description: 'Native tooling + automation for each cloud',
    price_range: '$37',
    product_count: 80,
    color: 'orange',
    icon: '☁️'
  },
  'tier-5': {
    id: 'tier-5',
    name: 'Tool Ecosystem Packs',
    description: 'Deep automation for specific toolchains',
    price_range: '$27',
    product_count: 100,
    color: 'rose',
    icon: '🔧'
  }
};

// Get all products
export function getAllProducts(): Product[] {
  return PRODUCT_CATALOG.filter(p => p.active);
}

// Get products by tier
export function getProductsByTier(tierId: string): Product[] {
  return PRODUCT_CATALOG.filter(p => p.active && p.tier === tierId);
}

// Get product by slug
export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCT_CATALOG.find(p => p.slug === slug && p.active);
}

// Get product by ID
export function getProductById(id: string): Product | undefined {
  return PRODUCT_CATALOG.find(p => p.id === id && p.active);
}

// Get featured products
export function getFeaturedProducts(limit: number = 10): Product[] {
  return PRODUCT_CATALOG.filter(p => p.active && p.featured).slice(0, limit);
}

// Search products
export function searchProducts(query: string): Product[] {
  const lower = query.toLowerCase();
  return PRODUCT_CATALOG.filter(p => 
    p.active && (
      p.name.toLowerCase().includes(lower) ||
      p.description.toLowerCase().includes(lower) ||
      p.tagline.toLowerCase().includes(lower) ||
      p.tags.some(t => t.toLowerCase().includes(lower))
    )
  );
}

// Get tier stats
export function getTierStats(): Record<string, { count: number; total_revenue: number; avg_price: number }> {
  const stats: Record<string, { count: number; total_revenue: number; avg_price: number }> = {};
  
  for (const product of PRODUCT_CATALOG) {
    if (!product.active) continue;
    if (!stats[product.tier]) {
      stats[product.tier] = { count: 0, total_revenue: 0, avg_price: 0 };
    }
    stats[product.tier].count++;
    stats[product.tier].total_revenue += product.price_cents;
  }
  
  for (const tier of Object.keys(stats)) {
    stats[tier].avg_price = Math.round(stats[tier].total_revenue / stats[tier].count);
  }
  
  return stats;
}

// Get catalog summary
export function getCatalogSummary(): {
  total_products: number;
  total_scripts: number;
  total_revenue_potential_cents: number;
  by_tier: Record<string, number>;
  price_range: { min: number; max: number };
} {
  const active = PRODUCT_CATALOG.filter(p => p.active);
  const prices = active.map(p => p.price_cents);
  const by_tier: Record<string, number> = {};
  
  for (const p of active) {
    by_tier[p.tier] = (by_tier[p.tier] || 0) + 1;
  }
  
  return {
    total_products: active.length,
    total_scripts: active.reduce((sum, p) => sum + p.script_count, 0),
    total_revenue_potential_cents: active.reduce((sum, p) => sum + p.price_cents, 0),
    by_tier,
    price_range: { min: Math.min(...prices), max: Math.max(...prices) }
  };
}

// Tier order for display
export const TIER_ORDER = ['tier-1', 'tier-2', 'tier-3', 'tier-4', 'tier-5'];