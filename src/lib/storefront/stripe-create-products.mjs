/**
 * Create all 500 products in Stripe as one-time purchase products
 * Run: STRIPE_SECRET_KEY=sk_test_... node stripe-create-products.mjs
 */

import Stripe from "stripe";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

async function loadCatalog() {
  const catalogPath = join(join(process.env.SYNCSPACE_ROOT || process.cwd(), 'src/lib/storefront'), 'generated-catalog.ts');
  const content = await readFile(catalogPath, 'utf-8');
  const match = content.match(/export const PRODUCT_CATALOG: Product\[\] = (\[[\s\S]*?\]);/);
  if (!match) throw new Error('Could not extract catalog');
  return JSON.parse(match[1]);
}

async function createProduct(product) {
  try {
    // Check if product already exists
    try {
      const existing = await stripe.products.retrieve(product.id);
      console.log(`  ⏭️  Exists: ${product.name} (${existing.id})`);
      
      // Get existing price
      const prices = await stripe.prices.list({ product: product.id, limit: 1 });
      return {
        ...product,
        stripe_product_id: existing.id,
        stripe_price_id: prices.data[0]?.id,
      };
    } catch (e) {
      // Not found, create new
    }
    
    const stripeProduct = await stripe.products.create({
      id: product.id,
      name: product.name,
      description: product.description,
      metadata: {
        slug: product.slug,
        tier: product.tier,
        script_count: product.script_count.toString(),
        price_usd: product.price_usd.toString(),
      },
      active: product.active,
    });
    
    const price = await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: product.price_cents,
      currency: 'usd',
      // No recurring = one-time purchase
    });
    
    console.log(`  ✅ Created: ${product.name} ($${product.price_usd})`);
    
    return {
      ...product,
      stripe_product_id: stripeProduct.id,
      stripe_price_id: price.id,
    };
    
  } catch (error) {
    console.error(`  ❌ Failed: ${product.name}`, error.message);
    return { ...product, error: error.message };
  }
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Set STRIPE_SECRET_KEY environment variable');
    process.exit(1);
  }
  
  console.log('📦 Loading catalog...');
  const products = await loadCatalog();
  const activeProducts = products.filter(p => p.active);
  
  console.log(`🔄 Creating ${activeProducts.length} products in Stripe...\n`);
  
  const results = [];
  let created = 0;
  let existing = 0;
  let errors = 0;
  
  for (const product of activeProducts) {
    const result = await createProduct(product);
    results.push(result);
    
    if (result.error) errors++;
    else if (result.stripe_product_id?.startsWith('prod_')) created++;
    else existing++;
    
    // Rate limit
    await new Promise(r => setTimeout(r, 50));
  }
  
  // Update catalog with Stripe IDs
  const catalogPath = join(join(process.env.SYNCSPACE_ROOT || process.cwd(), 'src/lib/storefront'), 'generated-catalog.ts');
  const content = await readFile(catalogPath, 'utf-8');
  const updatedContent = content.replace(
    /export const PRODUCT_CATALOG: Product\[\] = \[[\s\S]*?\];/,
    `export const PRODUCT_CATALOG: Product[] = ${JSON.stringify(results, null, 2)};`
  );
  
  const { writeFile } = await import("node:fs/promises");
  await writeFile(catalogPath, updatedContent);
  
  console.log(`\n✅ Stripe product creation complete:`);
  console.log(`   Created: ${created}`);
  console.log(`   Already existed: ${existing}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total: ${activeProducts.length}`);
}

main().catch(console.error);
