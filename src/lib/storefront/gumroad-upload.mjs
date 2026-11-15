/**
 * Gumroad Upload Automation
 * Uploads products to Gumroad for discoverability (10/day limit)
 * Uses browser automation via Puppeteer
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import puppeteer from "puppeteer";

async function uploadToGumroad(products, credentials) {
  const browser = await puppeteer.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();
  
  try {
    // Login
    await page.goto('https://gumroad.com/login', { waitUntil: 'networkidle2' });
    await page.type('input[name="email"]', credentials.email);
    await page.type('input[name="password"]', credentials.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    console.log('✅ Logged into Gumroad');
    
    const results = [];
    
    for (const product of products) {
      console.log(`\n📤 Uploading: ${product.name} ($${product.price})`);
      
      try {
        await page.goto('https://gumroad.com/products/new', { waitUntil: 'networkidle2' });
        
        // Select "Digital product"
        await page.waitForSelector('input[value="digital"]');
        await page.click('input[value="digital"]');
        await page.click('button[type="submit"]');
        
        // Fill product details
        await page.waitForSelector('input[name="product[name]"]');
        await page.type('input[name="product[name]"]', product.name);
        
        await page.waitForSelector('textarea[name="product[description]"]');
        await page.type('textarea[name="product[description]"]', product.description);
        
        // Price
        await page.waitForSelector('input[name="product[price]"]');
        await page.click('input[name="product[price]"]', { clickCount: 3 });
        await page.type('input[name="product[price]"]', product.price.toString());
        
        // Upload ZIP
        await page.waitForSelector('input[type="file"][accept*="zip"]');
        const fileInput = await page.$('input[type="file"][accept*="zip"]');
        await fileInput?.uploadFile(product.zipPath);
        
        // Wait for upload
        await page.waitForFunction(() => !document.querySelector('.uploading'), { timeout: 60000 });
        
        // Tags
        if (product.tags.length > 0) {
          await page.waitForSelector('input[name="product[tag_list]"]');
          await page.type('input[name="product[tag_list]"]', product.tags.join(', '));
        }
        
        // Publish
        await page.click('button:has-text("Publish")');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        // Extract product URL
        const url = page.url();
        const productId = url.match(/\/products\/([a-z0-9]+)/)?.[1];
        
        results.push({ ...product, gumroad_id: productId, gumroad_url: url, status: 'published' });
        console.log(`✅ Published: ${url}`);
        
      } catch (error) {
        console.error(`❌ Failed: ${product.name}`, error.message);
        results.push({ ...product, status: 'failed', error: error.message });
      }
      
      // Rate limit between uploads
      await new Promise(r => setTimeout(r, 5000));
    }
    
    return results;
    
  } finally {
    await browser.close();
  }
}

// Main execution
async function main() {
  if (!process.env.GUMROAD_EMAIL || !process.env.GUMROAD_PASSWORD) {
    console.error('Set GUMROAD_EMAIL and GUMROAD_PASSWORD env vars');
    process.exit(1);
  }
  
  // Load products from generation summary
  const summaryPath = join('/Users/Apple/projects/income/first-dollar/production/products_500', 'generation_summary_500.json');
  const data = JSON.parse(await readFile(summaryPath, 'utf-8'));
  
  const products = data.products.map(p => ({
    name: p.product.replace(/\*+/g, '').trim(),
    description: `${p.script_count} production-ready automation scripts. Verifiers, debug, provisioning, Action Gate safety. MIT License.`,
    price: p.price,
    zipPath: join('/Users/Apple/projects/income/first-dollar/production/products_500', p.zip),
    slug: p.slug,
    tags: ['automation', 'scripts', 'devops', 'terminal', 'production-ready'],
  }));
  
  // Filter to only products not yet uploaded (check log)
  const logPath = '/Users/Apple/projects/income/first-dollar/GUMROAD_UPLOAD_LOG.md';
  let uploadedSlugs = new Set();
  try {
    const log = await readFile(logPath, 'utf-8');
    const matches = log.matchAll(/slug: ([a-z0-9-]+)/g);
    for (const m of matches) uploadedSlugs.add(m[1]);
  } catch {}
  
  const toUpload = products.filter(p => !uploadedSlugs.has(p.slug)).slice(0, 10); // 10/day limit
  
  console.log(`📦 Uploading ${toUpload.length} products to Gumroad (10/day limit)`);
  
  const results = await uploadToGumroad(toUpload, {
    email: process.env.GUMROAD_EMAIL,
    password: process.env.GUMROAD_PASSWORD,
  });
  
  // Append to log
  const logEntries = results.map(r => 
    `- ${new Date().toISOString()} | ${r.name} | $${r.price} | ${r.status} | ${r.gumroad_url || 'FAILED'} | slug: ${r.slug}`
  ).join('\n');
  
  await writeFile(logPath, (await readFile(logPath, 'utf-8').catch(() => '')) + '\n' + logEntries + '\n', { flag: 'a' });
  
  console.log('\n✅ Gumroad upload batch complete');
  console.log(`   Published: ${results.filter(r => r.status === 'published').length}`);
  console.log(`   Failed: ${results.filter(r => r.status === 'failed').length}`);
}

main().catch(console.error);
