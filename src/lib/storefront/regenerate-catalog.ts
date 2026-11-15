/**
 * Catalog Regeneration Script
 * Transforms 500 products (50 topics × 10 variants) → 150 products (50 topics × 3 editions)
 * Run with: npx tsx src/lib/storefront/regenerate-catalog.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EDITIONS, EDITION_ORDER, calculateEditionPrice, getEditionPriceCents, EditionId, TIER_BASE_PRICES } from './edition-definitions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Types from existing catalog
interface Category {
  slug: string;
  name: string;
  script_count: number;
  scripts: string[];
}

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  tagline: string;
  tier: string;
  price_cents: number;
  price_usd: number;
  currency: string;
  script_count: number;
  category_count: number;
  verifier_count: number;
  debug_count: number;
  provisioning_count: number;
  categories: Category[];
  verifiers: string[];
  debug_scripts: string[];
  provisioning_scripts: string[];
  requirements: string[];
  license: string;
  author: string;
  support_email: string;
  refund_policy: string;
  zip_url: string;
  active: boolean;
  featured: boolean;
  tags: string[];
  stripe_product_id: string;
  stripe_price_id: string;
}

// ─── 1. LOAD EXISTING CATALOG ──────────────────────────────────────────────
const catalogPath = join(__dirname, 'generated-catalog.ts');
const content = readFileSync(catalogPath, 'utf8');
const match = content.match(/PRODUCT_CATALOG:\s*Product\[\]\s*=\s*(\[[\s\S]*?\]);/);
if (!match) throw new Error('Could not parse catalog');
const PRODUCT_CATALOG: Product[] = eval(match[1]);

console.log(`Loaded ${PRODUCT_CATALOG.length} products`);

// ─── 2. GROUP BY BASE TOPIC ────────────────────────────────────────────────
function getBaseTopic(name: string): string {
  return name
    .replace(/\s+(Essentials|Pro|Advanced|Enterprise|Complete|Mastery|Ultimate|Premium|Expert)$/, '')
    .replace(/\s+Mastery$/, '');
}

const topicGroups = new Map<string, Product[]>();
for (const product of PRODUCT_CATALOG) {
  const base = getBaseTopic(product.name);
  if (!topicGroups.has(base)) topicGroups.set(base, []);
  topicGroups.get(base)!.push(product);
}

console.log(`Found ${topicGroups.size} base topics`);

// ─── 3. PICK REPRESENTATIVE PRODUCT PER TOPIC ──────────────────────────────
// Use the "Complete" or "Mastery" variant as the full-content reference
function pickRepresentative(products: Product[]): Product {
  const priority = ['Complete', 'Mastery', 'Ultimate', 'Premium', 'Expert', 'Enterprise', 'Advanced', 'Pro', 'Essentials'];
  for (const suffix of priority) {
    const found = products.find(p => p.name.endsWith(` ${suffix}`));
    if (found) return found;
  }
  return products[0]; // fallback
}

// ─── 4. EDITION CONTENT CALCULATION ────────────────────────────────────────
function calculateEditionCounts(
  rep: Product,
  editionId: EditionId
): { scripts: number; verifiers: number; debug: number; provisioning: number } {
  const ed = EDITIONS[editionId];
  return {
    scripts: Math.max(1, Math.round(rep.script_count * ed.scriptRatio)),
    verifiers: Math.max(0, Math.round(rep.verifier_count * ed.verifierRatio)),
    debug: Math.max(0, Math.round(rep.debug_count * ed.debugRatio)),
    provisioning: Math.max(0, Math.round(rep.provisioning_count * ed.provisioningRatio)),
  };
}

function sliceCategories(categories: Category[], editionId: EditionId): Category[] {
  const ed = EDITIONS[editionId];
  return categories.map(cat => ({
    ...cat,
    script_count: Math.max(1, Math.round(cat.script_count * ed.scriptRatio)),
    scripts: cat.scripts.slice(0, Math.max(1, Math.round(cat.scripts.length * ed.scriptRatio))),
  }));
}

function sliceArray<T>(arr: T[], ratio: number, min: number = 0): T[] {
  const count = Math.max(min, Math.round(arr.length * ratio));
  return arr.slice(0, count);
}

// ─── 5. GENERATE EDITION-SPECIFIC CONTENT ──────────────────────────────────
function generateTagline(baseTopic: string, editionId: EditionId): string {
  const ed = EDITIONS[editionId];
  const topic = baseTopic.replace(/ Pack$/, '').replace(/ Toolkit$/, '');
  
  const taglines: Record<EditionId, (topic: string) => string> = {
    essentials: (t) => `Essential ${t} scripts — get unblocked in minutes`,
    professional: (t) => `Production-grade ${t} — verified, debugged, ready to deploy`,
    enterprise: (t) => `Enterprise ${t} platform — fleet-wide reliability, team-ready`,
  };
  
  return taglines[editionId](topic);
}

function generateDescription(baseTopic: string, editionId: EditionId, counts: ReturnType<typeof calculateEditionCounts>): string {
  const ed = EDITIONS[editionId];
  const topic = baseTopic.replace(/ Pack$/, '').replace(/ Toolkit$/, '');
  
  const templates: Record<EditionId, (topic: string, c: typeof counts) => string> = {
    essentials: (t, c) => 
      `Essential ${t} toolkit — ${c.scripts} production-ready terminal automation scripts. ` +
      `Includes ${c.verifiers} verifiers (PASS/FAIL) for instant validation. ` +
      `No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. ` +
      `MIT licensed. 30-day money-back guarantee.`,

    professional: (t, c) =>
      `Professional ${t} pack — ${c.scripts} production-ready automation scripts with ${c.verifiers} verifiers ` +
      `and ${c.debug} debug analyzers for root-cause analysis. Includes ${c.provisioning} provisioning smoke tests ` +
      `and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. ` +
      `MIT licensed. 30-day money-back guarantee.`,

    enterprise: (t, c) =>
      `Enterprise ${t} platform — the complete ${c.scripts}-script library with ${c.verifiers} verifiers, ` +
      `${c.debug} debug analyzers, and ${c.provisioning} full-lifecycle provisioning tests. ` +
      `Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, ` +
      `policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. ` +
      `Priority email support included. MIT licensed. 30-day money-back guarantee.`,
  };
  
  return templates[editionId](topic, counts);
}

function generateTags(baseTags: string[], editionId: EditionId): string[] {
  const ed = EDITIONS[editionId];
  // Keep core topic tags, add edition-specific tags
  const coreTags = baseTags.filter(t => 
    !['automation', 'scripts', 'terminal', 'production-ready', 'devops', 'infrastructure'].includes(t)
  );
  return [...coreTags, ...ed.tags];
}

function generateRequirements(baseReqs: string[], editionId: EditionId): string[] {
  const ed = EDITIONS[editionId];
  return [...new Set([...baseReqs, ...ed.requirements])];
}

// ─── 6. BUILD NEW CATALOG ──────────────────────────────────────────────────
const newProducts: Product[] = [];
let idCounter = 1;

for (const [baseTopic, products] of topicGroups) {
  const rep = pickRepresentative(products);
  const tier = rep.tier;
  
  for (const editionId of EDITION_ORDER) {
    const ed = EDITIONS[editionId];
    const counts = calculateEditionCounts(rep, editionId);
    const price = calculateEditionPrice(tier, editionId);
    
    // Generate edition-specific slug
    const baseSlug = rep.slug.replace(/-(essentials|pro|advanced|enterprise|complete|mastery|ultimate|premium|expert)$/, '');
    const editionSlug = `${baseSlug}-${editionId}`;
    
    // Generate edition-specific name
    const editionName = `${baseTopic} ${ed.name}`;
    
    const newProduct: Product = {
      id: `prod_${String(idCounter++).padStart(6, '0')}`,
      slug: editionSlug,
      name: editionName,
      description: generateDescription(baseTopic, editionId, counts),
      tagline: generateTagline(baseTopic, editionId),
      tier,
      price_cents: price * 100,
      price_usd: price,
      currency: 'usd',
      script_count: counts.scripts,
      category_count: rep.category_count,
      verifier_count: counts.verifiers,
      debug_count: counts.debug,
      provisioning_count: counts.provisioning,
      categories: sliceCategories(rep.categories, editionId),
      verifiers: sliceArray(rep.verifiers, ed.verifierRatio),
      debug_scripts: sliceArray(rep.debug_scripts, ed.debugRatio),
      provisioning_scripts: sliceArray(rep.provisioning_scripts, ed.provisioningRatio),
      requirements: generateRequirements(rep.requirements, editionId),
      license: rep.license,
      author: rep.author,
      support_email: rep.support_email,
      refund_policy: rep.refund_policy,
      zip_url: rep.zip_url, // Same ZIP for now; could split later
      active: true,
      featured: editionId === 'professional', // Feature the middle tier
      tags: generateTags(rep.tags, editionId),
      stripe_product_id: '', // Will be created on Stripe sync
      stripe_price_id: '',
    };
    
    newProducts.push(newProduct);
  }
}

console.log(`\nGenerated ${newProducts.length} products (${topicGroups.size} topics × 3 editions)`);

// ─── 7. PRINT SUMMARY ──────────────────────────────────────────────────────
console.log('\n--- Summary by Tier ---');
const tierCounts: Record<string, number> = {};
for (const p of newProducts) {
  tierCounts[p.tier] = (tierCounts[p.tier] || 0) + 1;
}
for (const [tier, count] of Object.entries(tierCounts).sort()) {
  console.log(`  ${tier}: ${count}`);
}

console.log('\n--- Summary by Edition ---');
const editionCounts: Record<string, number> = {};
for (const p of newProducts) {
  const ed = p.name.match(/\s+(Essentials|Professional|Enterprise)$/)?.[1]?.toLowerCase() || 'unknown';
  editionCounts[ed] = (editionCounts[ed] || 0) + 1;
}
for (const [ed, count] of Object.entries(editionCounts)) {
  console.log(`  ${ed}: ${count}`);
}

console.log('\n--- Price Check ---');
for (const tier of ['tier-1', 'tier-2', 'tier-3', 'tier-4', 'tier-5']) {
  const prices = EDITION_ORDER.map(ed => `${ed}: $${calculateEditionPrice(tier, ed)}`);
  console.log(`  ${tier}: ${prices.join(' | ')}`);
}

// ─── 8. OUTPUT NEW CATALOG FILE ────────────────────────────────────────────
const output = `// AUTO-GENERATED — DO NOT EDIT MANUALLY
// Run: npx tsx src/lib/storefront/regenerate-catalog.ts
// Generated: ${new Date().toISOString()}

import type { Product, Category } from './product-catalog';

export const PRODUCT_CATALOG: Product[] = ${JSON.stringify(newProducts, null, 2)};

export const TIERS = {
  'tier-1': { name: 'Deep Dives', icon: '🎯', description: 'Single-topic mastery packs' },
  'tier-2': { name: 'Role Bundles', icon: '👨‍💼', description: 'Role-based toolkits' },
  'tier-3': { name: 'Vertical Packs', icon: '🏢', description: 'Industry-specific platforms' },
  'tier-4': { name: 'Cloud Specs', icon: '☁️', description: 'Cloud provider specializations' },
  'tier-5': { name: 'Tool Ecosystem', icon: '🔧', description: 'Tool-specific deep dives' },
} as const;

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCT_CATALOG.find(p => p.slug === slug);
}

export function getProductsByTier(tier: string): Product[] {
  return PRODUCT_CATALOG.filter(p => p.tier === tier);
}

export function getFeaturedProducts(): Product[] {
  return PRODUCT_CATALOG.filter(p => p.featured);
}

export function getAllProducts(): Product[] {
  return PRODUCT_CATALOG;
}
`;

const outputPath = join(__dirname, 'generated-catalog.ts');
writeFileSync(outputPath, output);
console.log(`\n✅ Written to ${outputPath}`);