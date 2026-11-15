import { Product, TIERS } from '../../lib/storefront/product-catalog';

interface ProductCardProps {
  product: Product;
  onPurchase: (slug: string) => void;
}

export function ProductCard({ product, onPurchase }: ProductCardProps) {
  const tier = TIERS[product.tier];
  
  return (
    <article className="group relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-primary-500/50 transition-all duration-300">
      {/* Tier badge */}
      <div className="absolute top-3 left-3 z-10">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${tierColorClasses[tier.id]}`}>
          {tier.icon} {tier.name}
        </span>
      </div>
      
      {/* Featured badge */}
      {product.featured && (
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            ⭐ Featured
          </span>
        </div>
      )}
      
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {product.name}
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
          {product.tagline}
        </p>
        
        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500 mb-4">
          <span className="flex items-center gap-1">📜 {product.script_count} scripts</span>
          <span className="flex items-center gap-1">✅ {product.verifier_count} verifiers</span>
          <span className="flex items-center gap-1">🔍 {product.debug_count} debug</span>
          <span className="flex items-center gap-1">🚀 {product.provisioning_count} provisioning</span>
        </div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {product.tags.slice(0, 4).map(tag => (
            <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
              {tag}
            </span>
          ))}
          {product.tags.length > 4 && (
            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 rounded">
              +{product.tags.length - 4}
            </span>
          )}
        </div>
        
        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
          <div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              ${product.price_usd}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-500 ml-2">one-time</span>
          </div>
          <button
            onClick={() => onPurchase(product.slug)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            Buy Now
          </button>
        </div>
      </div>
    </article>
  );
}

const tierColorClasses: Record<string, string> = {
  'tier-1': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'tier-2': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'tier-3': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'tier-4': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'tier-5': 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
};
