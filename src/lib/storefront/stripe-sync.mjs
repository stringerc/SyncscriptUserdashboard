import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Stripe from "stripe";

// Load generated catalog
const catalogPath = join('/Users/Apple/syncscript/src/lib/storefront', 'generated-catalog.ts');
const catalogContent = await readFile(catalogPath, 'utf-8');

// Extract PRODUCT_CATALOG array from the generated file
const match = catalogContent.match(/export const PRODUCT_CATALOG: Product\[\] = (\[[\s\S]*?\]);/);
if (!match) {
  console.error('Could not extract PRODUCT_CATALOG from generated-catalog.ts');
  process.exit(1);
}
const PRODUCT_CATALOG = JSON.parse(match[1]);

// Stripe configuration - requires STRIPE_SECRET_KEY env var
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
  typescript: true,
});

async function createStripeProduct(product) {
  try {
    const stripeProduct = await stripe.products.create({
      id: product.id,
      name: product.name,
      description: product.description,
      metadata: {
        slug: product.slug,
        tier: product.tier,
        script_count: product.script_count.toString(),
        price_usd: product.price_usd.toString(),
        tags: product.tags.join(','),
      },
      active: product.active,
      images: [],
      default_price_data: {
        currency: 'usd',
        unit_amount: product.price_cents,
        // No recurring = one-time purchase
      },
    });
    
    return {
      stripe_product_id: stripeProduct.id,
      stripe_price_id: stripeProduct.default_price,
    };
  } catch (error) {
    if (error.code === 'resource_already_exists') {
      // Try to retrieve existing
      const existing = await stripe.products.retrieve(product.id);
      const prices = await stripe.prices.list({ product: product.id, limit: 1 });
      return {
        stripe_product_id: existing.id,
        stripe_price_id: prices.data[0]?.id,
      };
    }
    throw error;
  }
}

async function syncAllProducts() {
  console.log(`🔄 Syncing ${PRODUCT_CATALOG.length} products to Stripe...`);
  
  const results = [];
  let created = 0;
  let updated = 0;
  let errors = 0;
  
  for (const product of PRODUCT_CATALOG) {
    if (!product.active) continue;
    
    try {
      const result = await createStripeProduct(product);
      results.push({
        ...product,
        stripe_product_id: result.stripe_product_id,
        stripe_price_id: result.stripe_price_id,
      });
      created++;
      
      if (created % 50 === 0) {
        console.log(`   Progress: ${created}/${PRODUCT_CATALOG.filter(p => p.active).length}`);
      }
    } catch (error) {
      console.error(`❌ Failed to sync ${product.slug}:`, error.message);
      results.push({ ...product, error: error.message });
      errors++;
    }
    
    // Rate limit: 100 req/s max, be conservative
    await new Promise(r => setTimeout(r, 100));
  }
  
  // Write updated catalog with Stripe IDs
  const updatedCatalog = catalogContent.replace(
    /export const PRODUCT_CATALOG: Product\[\] = \[[\s\S]*?\];/,
    `export const PRODUCT_CATALOG: Product[] = ${JSON.stringify(results, null, 2)};`
  );
  
  await writeFile(catalogPath, updatedCatalog);
  
  console.log(`\n✅ Stripe sync complete:`);
  console.log(`   Created/Updated: ${created}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total active products: ${PRODUCT_CATALOG.filter(p => p.active).length}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ STRIPE_SECRET_KEY environment variable required');
    console.log('Run: STRIPE_SECRET_KEY=sk_... node stripe-sync.mjs');
    process.exit(1);
  }
  
  syncAllProducts().catch(console.error);
}

export { syncAllProducts, createStripeProduct };
