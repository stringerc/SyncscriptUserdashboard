import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

function slugToTier(slug) {
  if (slug.includes('mastery')) return 'tier-1';
  if (slug.includes('toolkit')) return 'tier-2';
  if (slug.includes('pack') && (slug.includes('platform') || slug.includes('fintech') || slug.includes('health') || slug.includes('gov') || slug.includes('e-commerce') || slug.includes('saas') || slug.includes('iot') || slug.includes('gaming') || slug.includes('media') || slug.includes('crypto') || slug.includes('model-serving'))) return 'tier-3';
  if (slug.includes('aws') || slug.includes('gcp') || slug.includes('azure') || slug.includes('multi-cloud') || slug.includes('hybrid')) return 'tier-4';
  if (slug.includes('github-actions') || slug.includes('argocd') || slug.includes('terraform') || slug.includes('prometheus') || slug.includes('istio') || slug.includes('cilium') || slug.includes('kubevirt') || slug.includes('knative') || slug.includes('backstage') || slug.includes('crossplane')) return 'tier-5';
  return 'tier-1';
}

function slugToCategory(slug) {
  if (slug.includes('kubernetes') || slug.includes('k8s')) return 'Kubernetes';
  if (slug.includes('postgresql') || slug.includes('postgres')) return 'PostgreSQL';
  if (slug.includes('redis')) return 'Redis';
  if (slug.includes('linux')) return 'Linux';
  if (slug.includes('docker') || slug.includes('container')) return 'Docker';
  if (slug.includes('ci-cd') || slug.includes('cicd') || slug.includes('pipeline')) return 'CI/CD';
  if (slug.includes('infrastructure') || slug.includes('iac') || slug.includes('code')) return 'Infrastructure as Code';
  if (slug.includes('observability')) return 'Observability';
  if (slug.includes('security') || slug.includes('hardening')) return 'Security';
  if (slug.includes('ai-ml') || slug.includes('aiml') || slug.includes('ml')) return 'AI/ML';
  if (slug.includes('senior') || slug.includes('platform') || slug.includes('engineer')) return 'Platform Engineering';
  if (slug.includes('sre') || slug.includes('production')) return 'SRE';
  if (slug.includes('devops')) return 'DevOps';
  if (slug.includes('cloud')) return 'Cloud Engineering';
  if (slug.includes('data')) return 'Data Platform';
  if (slug.includes('startup') || slug.includes('cto')) return 'Leadership';
  if (slug.includes('contractor') || slug.includes('freelancer')) return 'Freelance';
  if (slug.includes('fintech') || slug.includes('fedramp')) return 'FinTech';
  if (slug.includes('health') || slug.includes('hipaa')) return 'HealthTech';
  if (slug.includes('gov') || slug.includes('dod') || slug.includes('cmc') || slug.includes('stig')) return 'GovCloud';
  if (slug.includes('e-commerce') || slug.includes('pci')) return 'E-Commerce';
  if (slug.includes('saas') || slug.includes('multi-tenant')) return 'SaaS';
  if (slug.includes('iot') || slug.includes('edge')) return 'IoT/Edge';
  if (slug.includes('gaming') || slug.includes('real-time')) return 'Gaming';
  if (slug.includes('media') || slug.includes('streaming')) return 'Media';
  if (slug.includes('crypto') || slug.includes('blockchain')) return 'Crypto';
  if (slug.includes('model-serving')) return 'ML Serving';
  if (slug.includes('eks') || slug.includes('aws')) return 'AWS';
  if (slug.includes('gke') || slug.includes('gcp')) return 'GCP';
  if (slug.includes('aks') || slug.includes('azure')) return 'Azure';
  if (slug.includes('multi-cloud') || slug.includes('cloud-agnostic')) return 'Multi-Cloud';
  if (slug.includes('hybrid') || slug.includes('on-prem')) return 'Hybrid';
  if (slug.includes('github-actions')) return 'GitHub Actions';
  if (slug.includes('argocd')) return 'ArgoCD';
  if (slug.includes('terraform') || slug.includes('opentofu')) return 'Terraform';
  if (slug.includes('prometheus') || slug.includes('grafana')) return 'Prometheus/Grafana';
  if (slug.includes('istio') || slug.includes('service-mesh')) return 'Istio';
  if (slug.includes('cilium') || slug.includes('ebpf')) return 'Cilium';
  if (slug.includes('kubevirt')) return 'KubeVirt';
  if (slug.includes('knative')) return 'Knative';
  if (slug.includes('backstage')) return 'Backstage';
  if (slug.includes('crossplane')) return 'Crossplane';
  return 'General';
}

function buildDescription(name, scriptCount, tier) {
  const tierNames = {
    'tier-1': 'Deep Dive mastery pack',
    'tier-2': 'Role-based bundle',
    'tier-3': 'Industry vertical pack',
    'tier-4': 'Cloud specialization pack',
    'tier-5': 'Tool ecosystem pack'
  };
  return `${tierNames[tier] || 'Automation pack'} — ${scriptCount} production-ready terminal automation scripts for ${name}. Includes verifiers (PASS/FAIL), debug scripts (root cause analysis), provisioning tests (full lifecycle), Action Gate safety validation, MIT License.`;
}

function buildTags(name, tier) {
  const baseTags = ['automation', 'scripts', 'terminal', 'production-ready', 'devops', 'infrastructure'];
  const tierTags = {
    'tier-1': ['mastery', 'deep-dive', 'single-category'],
    'tier-2': ['bundle', 'role-based', 'cross-category'],
    'tier-3': ['vertical', 'compliance', 'industry'],
    'tier-4': ['cloud', 'specialization', 'provider-native'],
    'tier-5': ['toolchain', 'ecosystem', 'deep-dive']
  };
  return [...baseTags, ...(tierTags[tier] || [])];
}

async function main() {
  const summaryPath = join('/Users/Apple/projects/income/first-dollar/production/products_500', 'generation_summary_500.json');
  const outputPath = join('/Users/Apple/syncscript/src/lib/storefront', 'generated-catalog.ts');
  
  const raw = await readFile(summaryPath, 'utf-8');
  const data = JSON.parse(raw);
  
  const products = data.products.map((p, i) => {
    const tier = slugToTier(p.slug);
    const category = slugToCategory(p.slug);
    const name = p.product.replace(/\*+/g, '').trim();
    
    return {
      id: `prod_${p.slug}`,
      slug: p.slug,
      name,
      description: buildDescription(name, p.script_count, tier),
      tagline: `Master ${name} with ${p.script_count} production-ready automation scripts`,
      tier,
      price_cents: p.price * 100,
      price_usd: p.price,
      currency: 'USD',
      script_count: p.script_count,
      category_count: 4,
      verifier_count: 3,
      debug_count: 2,
      provisioning_count: 1,
      categories: [
        { name: `${name} Core`, slug: category.toLowerCase().replace(/[^a-z0-9]+/g, '-'), count: p.script_count - 6, scripts: [] },
        { name: 'Verifiers', slug: 'verifiers', count: 3, scripts: [`verify_${category.toLowerCase()}_health`, `verify_${category.toLowerCase()}_replication`, `verify_${category.toLowerCase()}_security`] },
        { name: 'Debug', slug: 'debug', count: 2, scripts: [`debug_${category.toLowerCase()}_failure`, `debug_${category.toLowerCase()}_performance`] },
        { name: 'Provisioning', slug: 'provisioning', count: 1, scripts: [`provision_${category.toLowerCase()}_verify_teardown`] }
      ],
      verifiers: [`verify_${category.toLowerCase()}_health`, `verify_${category.toLowerCase()}_replication`, `verify_${category.toLowerCase()}_security`],
      debug_scripts: [`debug_${category.toLowerCase()}_failure`, `debug_${category.toLowerCase()}_performance`],
      provisioning_scripts: [`provision_${category.toLowerCase()}_verify_teardown`],
      requirements: ['bash 4.0+', 'python3 3.8+', 'kubectl', 'psql', 'redis-cli', 'helm 3+', 'kind', 'shellcheck (optional)'],
      license: 'MIT',
      author: 'Chris Stringer',
      support_email: 'chris@syncscript.io',
      refund_policy: '30-day money-back guarantee',
      zip_url: `/downloads/${p.slug}.zip`,
      active: true,
      featured: i < 10,
      tags: buildTags(name, tier)
    };
  });
  
  const output = `/**
 * SyncScript Storefront — Generated Product Catalog
 * AUTO-GENERATED from production factory — DO NOT EDIT MANUALLY
 * Generated: ${new Date().toISOString()}
 * Source: generation_summary_500.json
 * Total Products: ${products.length}
 */

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
  zip_url: string;
  stripe_price_id?: string;
  stripe_product_id?: string;
  active: boolean;
  featured: boolean;
  tags: string[];
}

export const PRODUCT_CATALOG: Product[] = ${JSON.stringify(products, null, 2)};
`;

  await writeFile(outputPath, output);
  console.log(`✅ Catalog written to ${outputPath}`);
  console.log(`   Products: ${products.length}`);
  
  const tiers = {};
  for (const p of products) {
    tiers[p.tier] = (tiers[p.tier] || 0) + 1;
  }
  for (const [tier, count] of Object.entries(tiers)) {
    console.log(`   ${tier}: ${count}`);
  }
}

main().catch(console.error);
