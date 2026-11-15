/**
 * Edition Definitions for SyncScript Catalog
 * 3 editions × 50 topics = 150 products
 * Each edition has distinct value proposition, pricing, and content
 */

export const EDITIONS = {
  essentials: {
    id: 'essentials',
    name: 'Essentials',
    tagline: 'Core scripts to get unblocked fast',
    description: 'The essential toolkit — battle-tested scripts for immediate productivity. No fluff, just the commands you need today.',
    priceMultiplier: 0.7,      // 70% of base price
    scriptRatio: 0.4,          // 40% of total scripts
    verifierRatio: 0.2,        // 20% of verifiers
    debugRatio: 0.2,           // 20% of debug scripts
    provisioningRatio: 0,      // No provisioning
    features: [
      'Core automation scripts',
      'Essential verifiers (PASS/FAIL)',
      'Quick-start guide',
      'MIT license — use anywhere',
      '30-day money-back guarantee',
    ],
    excludes: [
      'Debug analyzers',
      'Provisioning tests',
      'CI/CD templates',
      'Team onboarding docs',
    ],
    tags: ['quick-start', 'core-scripts', 'individual-contributor'],
    requirements: ['bash 4.0+', 'python3 3.8+'],
    badgeColor: '#10B981', // emerald
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    icon: '⚡',
    sortOrder: 1,
  },

  professional: {
    id: 'professional',
    name: 'Professional',
    tagline: 'Production confidence with verifiers + debug',
    description: 'The professional standard — core scripts plus verification gates and root-cause debug analyzers. Built for engineers who own reliability.',
    priceMultiplier: 1.0,      // 100% of base price
    scriptRatio: 0.7,          // 70% of total scripts
    verifierRatio: 0.8,        // 80% of verifiers
    debugRatio: 0.8,           // 80% of debug scripts
    provisioningRatio: 0.5,    // 50% of provisioning
    features: [
      'Extended script library',
      'Full verifier suite (PASS/FAIL)',
      'Debug analyzers (root cause)',
      'Provisioning smoke tests',
      'CI/CD pipeline snippets',
      'MIT license — use anywhere',
      '30-day money-back guarantee',
    ],
    excludes: [
      'Full provisioning lifecycle',
      'Team onboarding pack',
      'Enterprise runbooks',
    ],
    tags: ['production-ready', 'verifiers', 'debug', 'ci-cd-snippets'],
    requirements: ['bash 4.0+', 'python3 3.8+', 'kubectl', 'git'],
    badgeColor: '#0050FF', // blue
    gradient: 'linear-gradient(135deg, #0050FF 0%, #00D6FF 100%)',
    icon: '🎯',
    sortOrder: 2,
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Fleet-wide reliability + team adoption pack',
    description: 'The complete platform — every script, full provisioning lifecycle, CI/CD gates, team onboarding, and enterprise runbooks. For teams that standardize on excellence.',
    priceMultiplier: 1.8,      // 180% of base price
    scriptRatio: 1.0,          // 100% of total scripts
    verifierRatio: 1.0,        // 100% of verifiers
    debugRatio: 1.0,           // 100% of debug scripts
    provisioningRatio: 1.0,    // 100% of provisioning
    features: [
      'Complete script library (all scripts)',
      'Full verifier suite',
      'Complete debug analyzers',
      'Full provisioning lifecycle tests',
      'CI/CD gate templates (GitHub, GitLab, Argo)',
      'Team onboarding documentation',
      'Enterprise runbooks (incident response)',
      'Slack/Teams notification webhooks',
      'Policy-as-code templates (OPA/Gatekeeper)',
      'MIT license — use anywhere',
      '30-day money-back guarantee',
      'Priority email support',
    ],
    excludes: [],
    tags: ['fleet-wide', 'team-adoption', 'ci-cd-gates', 'enterprise-runbooks', 'policy-as-code'],
    requirements: [
      'bash 4.0+', 'python3 3.8+', 'kubectl', 'git',
      'helm 3+', 'argocd or flux', 'opa', 'slack-webhook (optional)'
    ],
    badgeColor: '#A855F7', // purple
    gradient: 'linear-gradient(135deg, #A855F7 0%, #D946EF 100%)',
    icon: '🏢',
    sortOrder: 3,
  },
} as const;

export type EditionId = keyof typeof EDITIONS;
export type EditionDef = typeof EDITIONS[EditionId];

export const EDITION_ORDER: EditionId[] = ['essentials', 'professional', 'enterprise'];

export function getEdition(id: EditionId): EditionDef {
  return EDITIONS[id];
}

export function getAllEditions(): EditionDef[] {
  return EDITION_ORDER.map(id => EDITIONS[id]);
}

/**
 * Base prices per tier (for the Professional edition)
 * Essentials = 70%, Enterprise = 180%
 */
export const TIER_BASE_PRICES: Record<string, number> = {
  'tier-1': 37,  // Deep Dives - was $27, now $37 for Professional
  'tier-2': 47,  // Role Bundles - was $37
  'tier-3': 57,  // Vertical Packs - was $47
  'tier-4': 47,  // Cloud Specs - was $37
  'tier-5': 37,  // Tool Ecosystem - was $27
};

export function calculateEditionPrice(tier: string, editionId: EditionId): number {
  const basePrice = TIER_BASE_PRICES[tier] || 37;
  const multiplier = EDITIONS[editionId].priceMultiplier;
  return Math.round(basePrice * multiplier);
}

export function getEditionPriceCents(tier: string, editionId: EditionId): number {
  return calculateEditionPrice(tier, editionId) * 100;
}

/**
 * Edition comparison data for product detail pages
 */
export const EDITION_COMPARISON = [
  { feature: 'Core Scripts', essentials: '✓', professional: '✓', enterprise: '✓' },
  { feature: 'Verifiers (PASS/FAIL)', essentials: 'Basic', professional: 'Full', enterprise: 'Full' },
  { feature: 'Debug Analyzers', essentials: '✗', professional: '✓', enterprise: '✓' },
  { feature: 'Provisioning Tests', essentials: '✗', professional: 'Partial', enterprise: 'Full' },
  { feature: 'CI/CD Templates', essentials: '✗', professional: 'Snippets', enterprise: 'Full Gates' },
  { feature: 'Team Onboarding', essentials: '✗', professional: '✗', enterprise: '✓' },
  { feature: 'Enterprise Runbooks', essentials: '✗', professional: '✗', enterprise: '✓' },
  { feature: 'Policy-as-Code', essentials: '✗', professional: '✗', enterprise: '✓' },
  { feature: 'Slack/Teams Webhooks', essentials: '✗', professional: '✗', enterprise: '✓' },
  { feature: 'Priority Support', essentials: '✗', professional: '✗', enterprise: '✓' },
];