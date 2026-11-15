'use client';

import { useState, useMemo } from 'react';
import { Product, TIERS, TIER_ORDER, getAllProducts, getProductsByTier, searchProducts, getTierStats } from '../../lib/storefront/product-catalog';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  initialTier?: string;
  featured?: boolean;
  limit?: number;
}

export function ProductGrid({ initialTier, featured, limit }: ProductGridProps) {
  const [activeTier, setActiveTier] = useState(initialTier || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const allProducts = featured ? getAllProducts().filter(p => p.featured).slice(0, limit) : getAllProducts();
  
  const products = useMemo(() => {
    let filtered = allProducts;
    
    if (activeTier !== 'all') {
      filtered = filtered.filter(p => p.tier === activeTier);
    }
    
    if (searchQuery) {
      filtered = searchProducts(searchQuery);
      // Filter search results by active tier if needed
      if (activeTier !== 'all') {
        filtered = filtered.filter(p => p.tier === activeTier);
      }
    }
    
    return limit ? filtered.slice(0, limit) : filtered;
  }, [allProducts, activeTier, searchQuery, limit]);
  
  const stats = useMemo(() => getTierStats(), []);
  
  return (
    <div className="space-y-8">
      {/* Tier Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTier('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeTier === 'all'
              ? 'bg-primary-600 text-white shadow-lg'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All Tiers ({allProducts.length})
        </button>
        {TIER_ORDER.map(tierId => {
          const tier = TIERS[tierId];
          const count = stats[tierId]?.count || 0;
          return (
            <button
              key={tierId}
              onClick={() => setActiveTier(tierId)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                activeTier === tierId
                  ? `${tierColorClasses[tierId]} shadow-lg`
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span>{tier.icon}</span>
              <span>{tier.name}</span>
              <span className="px-2 py-0.5 text-xs bg-white/50 dark:bg-black/30 rounded-full">
                {count}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Search */}
      <div className="relative max-w-md">
        <input
          type="search"
          placeholder="Search products... (name, tags, description)"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 pl-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing {products.length} of {allProducts.length} products
        </p>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}
            aria-label="Grid view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}
            aria-label="List view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </div>
      
      {/* Products */}
      {products.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No products found</h3>
          <p className="text-gray-600 dark:text-gray-400">Try adjusting your filters or search query</p>
        </div>
      ) : (
        <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-4'}`}>
          {products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onPurchase={slug => window.location.href = `/checkout?product=${slug}`}
            />
          ))}
        </div>
      )}
      
      {/* Pagination would go here for large catalogs */}
    </div>
  );
}

const tierColorClasses: Record<string, string> = {
  'tier-1': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'tier-2': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'tier-3': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'tier-4': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'tier-5': 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
};
