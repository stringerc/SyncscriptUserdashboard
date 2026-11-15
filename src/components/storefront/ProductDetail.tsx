'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getProductBySlug, Product, TIERS } from '../../lib/storefront/product-catalog';
import Link from 'next/link';

export default function ProductDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // In a real app, this would fetch from an API
    // For now, we'll use the imported catalog (client-side bundle)
    const p = getProductBySlug(slug);
    if (p) {
      setProduct(p);
    } else {
      setError('Product not found');
    }
    setLoading(false);
  }, [slug]);
  
  if (loading) {
    return <div className="animate-pulse space-y-4 max-w-4xl mx-auto px-4 py-16">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
    </div>;
  }
  
  if (error || !product) {
    return (
      <div className="text-center py-16 max-w-2xl mx-auto px-4">
        <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Product Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">The product you're looking for doesn't exist or has been removed.</p>
        <Link href="/store" className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          ← Back to Store
        </Link>
      </div>
    );
  }
  
  const tier = TIERS[product.tier];
  
  const handlePurchase = () => {
    window.location.href = `/api/checkout?product=${product.slug}`;
  };
  
  return (
    <article className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/store" className="hover:text-primary-600 dark:hover:text-primary-400">Store</Link>
        <span>/</span>
        <Link href={`/store?tier=${product.tier}`} className="hover:text-primary-600 dark:hover:text-primary-400">{tier.name}</Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white truncate max-w-xs">{product.name}</span>
      </nav>
      
      {/* Header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${tierBadgeClasses[product.tier]}`}>
            {tier.icon} {tier.name}
          </span>
          {product.featured && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              ⭐ Featured
            </span>
          )}
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
          {product.name}
        </h1>
        
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl">
          {product.tagline}
        </p>
        
        {/* Price & CTA */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">${product.price_usd}</span>
            <span className="text-gray-500 dark:text-gray-400">one-time purchase</span>
          </div>
          <button
            onClick={handlePurchase}
            className="flex-1 sm:flex-none bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors shadow-lg hover:shadow-xl"
          >
            Buy Now — Get Instant Access
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Description & Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Description */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">What You Get</h2>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{product.description}</p>
            </div>
            
            {/* Key Features */}
            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              <FeatureItem icon="📜" label="Scripts" value={`${product.script_count} production-ready`} />
              <FeatureItem icon="✅" label="Verifiers" value={`${product.verifier_count} PASS/FAIL checks`} />
              <FeatureItem icon="🔍" label="Debug Scripts" value={`${product.debug_count} root cause analysis`} />
              <FeatureItem icon="🚀" label="Provisioning" value={`${product.provisioning_count} full lifecycle test`} />
              <FeatureItem icon="🛡️" label="Safety" value="Action Gate 5-layer validation" />
              <FeatureItem icon="📄" label="License" value="MIT — use anywhere" />
            </div>
          </section>
          
          {/* Categories */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Included Categories</h2>
            <div className="space-y-3">
              {product.categories.map((cat, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{categoryIcons[cat.slug] || '📁'}</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{cat.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{cat.script_count} scripts</p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {cat.scripts.slice(0, 3).join(', ')}{cat.scripts.length > 3 ? '...' : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
          
          {/* Requirements */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Requirements</h2>
            <ul className="space-y-2">
              {product.requirements.map((req, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  {req}
                </li>
              ))}
            </ul>
          </section>
          
          {/* Guarantee */}
          <section className="p-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">30-Day Money-Back Guarantee</h3>
                <p className="text-emerald-700 dark:text-emerald-300 mt-1">
                  Not satisfied? Email {product.support_email} within 30 days for a full refund. No questions asked.
                </p>
              </div>
            </div>
          </section>
        </div>
        
        {/* Right: Sidebar */}
        <aside className="space-y-6">
          {/* Quick Specs */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Quick Specs</h3>
            <dl className="space-y-3 text-sm">
              <SpecRow label="Tier" value={tier.name} />
              <SpecRow label="Price" value={`$${product.price_usd} USD`} />
              <SpecRow label="Total Scripts" value={product.script_count.toString()} />
              <SpecRow label="Categories" value={product.category_count.toString()} />
              <SpecRow label="Verifiers" value={product.verifier_count.toString()} />
              <SpecRow label="Debug Scripts" value={product.debug_count.toString()} />
              <SpecRow label="Provisioning" value={product.provisioning_count.toString()} />
              <SpecRow label="License" value={product.license} />
              <SpecRow label="Author" value={product.author} />
            </dl>
          </div>
          
          {/* What's Inside */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">What's Inside</h3>
            <ul className="space-y-2 text-sm">
              {product.verifiers.map((v, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0"></span>
                  {v}
                </li>
              ))}
              {product.debug_scripts.map((d, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                  {d}
                </li>
              ))}
              {product.provisioning_scripts.map((p, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          
          {/* Support */}
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-6 text-center">
            <h3 className="font-semibold text-primary-900 dark:text-primary-100 mb-2">Questions?</h3>
            <p className="text-primary-700 dark:text-primary-300 text-sm mb-4">
              Email us at <a href={`mailto:${product.support_email}`} className="underline hover:no-underline">{product.support_email}</a>
            </p>
            <p className="text-primary-600 dark:text-primary-400 text-xs">
              We typically respond within 24 hours.
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}

function FeatureItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="font-medium text-gray-900 dark:text-white text-sm">{label}</p>
        <p className="text-gray-600 dark:text-gray-400 text-sm">{value}</p>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="font-medium text-gray-900 dark:text-white text-right max-w-[60%] truncate">{value}</dd>
    </div>
  );
}

const tierBadgeClasses: Record<string, string> = {
  'tier-1': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  'tier-2': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'tier-3': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'tier-4': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'tier-5': 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
};

const categoryIcons: Record<string, string> = {
  'kubernetes': '☸️',
  'postgresql': '🐘',
  'redis': '🔴',
  'linux': '🐧',
  'docker': '🐳',
  'ci-cd': '🔄',
  'infrastructure-as-code': '📝',
  'observability': '📊',
  'security': '🔒',
  'ai-ml': '🤖',
  'platform-engineering': '🏗️',
  'sre': '🎯',
  'devops': '⚙️',
  'cloud-engineering': '☁️',
  'data-platform': '📈',
  'leadership': '👑',
  'freelance': '💼',
  'fintech': '💳',
  'healthtech': '🏥',
  'govcloud': '🏛️',
  'e-commerce': '🛒',
  'saas': '🌐',
  'iot-edge': '📡',
  'gaming': '🎮',
  'media': '🎬',
  'crypto': '⛓️',
  'ml-serving': '🧠',
  'aws': '☁️',
  'gcp': '☁️',
  'azure': '☁️',
  'multi-cloud': '☁️☁️',
  'hybrid': '🔗',
  'github-actions': '🐙',
  'argocd': '📦',
  'terraform': '🏗️',
  'prometheus-grafana': '📊',
  'istio': '🕸️',
  'cilium': '🐝',
  'kubevirt': '🖥️',
  'knative': '☁️',
  'backstage': '🎭',
  'crossplane': '✈️',
  'verifiers': '✅',
  'debug': '🔍',
  'provisioning': '🚀',
};
