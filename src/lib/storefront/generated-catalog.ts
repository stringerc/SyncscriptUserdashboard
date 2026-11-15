// AUTO-GENERATED — DO NOT EDIT MANUALLY
// Run: npx tsx src/lib/storefront/regenerate-catalog.ts
// Generated: 2026-11-07T16:30:45.021Z

import type { Product, Category } from './product-catalog';

export const PRODUCT_CATALOG: Product[] = [
  {
    "id": "prod_000001",
    "slug": "kubernetes-debugging-mastery-essentials",
    "name": "Kubernetes Debugging Essentials",
    "description": "Essential Kubernetes Debugging toolkit — 13 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Kubernetes Debugging scripts — get unblocked in minutes",
    "tier": "tier-1",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 13,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Kubernetes Debugging Mastery Complete Core",
        "slug": "kubernetes",
        "count": 26,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_kubernetes_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_kubernetes_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_kubernetes_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_kubernetes_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/kubernetes-debugging-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000001",
    "stripe_price_id": "price_1UZCYIGnuF7uNW2ktHNk7M2U"
  },
  {
    "id": "prod_000002",
    "slug": "kubernetes-debugging-mastery-professional",
    "name": "Kubernetes Debugging Professional",
    "description": "Professional Kubernetes Debugging pack — 22 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Kubernetes Debugging — verified, debugged, ready to deploy",
    "tier": "tier-1",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 22,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Kubernetes Debugging Mastery Complete Core",
        "slug": "kubernetes",
        "count": 26,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_kubernetes_health",
          "verify_kubernetes_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_kubernetes_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_kubernetes_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_kubernetes_health",
      "verify_kubernetes_replication"
    ],
    "debug_scripts": [
      "debug_kubernetes_failure",
      "debug_kubernetes_performance"
    ],
    "provisioning_scripts": [
      "provision_kubernetes_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/kubernetes-debugging-mastery-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000002",
    "stripe_price_id": "price_1UZCYIGnuF7uNW2kuSge7XfT"
  },
  {
    "id": "prod_000003",
    "slug": "kubernetes-debugging-mastery-enterprise",
    "name": "Kubernetes Debugging Enterprise",
    "description": "Enterprise Kubernetes Debugging platform — the complete 32-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Kubernetes Debugging platform — fleet-wide reliability, team-ready",
    "tier": "tier-1",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 32,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Kubernetes Debugging Mastery Complete Core",
        "slug": "kubernetes",
        "count": 26,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_kubernetes_health",
          "verify_kubernetes_replication",
          "verify_kubernetes_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_kubernetes_failure",
          "debug_kubernetes_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_kubernetes_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_kubernetes_health",
      "verify_kubernetes_replication",
      "verify_kubernetes_security"
    ],
    "debug_scripts": [
      "debug_kubernetes_failure",
      "debug_kubernetes_performance"
    ],
    "provisioning_scripts": [
      "provision_kubernetes_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/kubernetes-debugging-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000003",
    "stripe_price_id": "price_1UZCYJGnuF7uNW2kM32XJIN2"
  },
  {
    "id": "prod_000004",
    "slug": "postgresql-operations-mastery-essentials",
    "name": "PostgreSQL Operations Essentials",
    "description": "Essential PostgreSQL Operations toolkit — 12 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential PostgreSQL Operations scripts — get unblocked in minutes",
    "tier": "tier-1",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 12,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "PostgreSQL Operations Mastery Complete Core",
        "slug": "postgresql",
        "count": 24,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_postgresql_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_postgresql_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_postgresql_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_postgresql_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/postgresql-operations-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000004",
    "stripe_price_id": "price_1UZCYJGnuF7uNW2kFv3iYG0K"
  },
  {
    "id": "prod_000005",
    "slug": "postgresql-operations-mastery-professional",
    "name": "PostgreSQL Operations Professional",
    "description": "Professional PostgreSQL Operations pack — 21 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade PostgreSQL Operations — verified, debugged, ready to deploy",
    "tier": "tier-1",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 21,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "PostgreSQL Operations Mastery Complete Core",
        "slug": "postgresql",
        "count": 24,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_postgresql_health",
          "verify_postgresql_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_postgresql_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_postgresql_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_postgresql_health",
      "verify_postgresql_replication"
    ],
    "debug_scripts": [
      "debug_postgresql_failure",
      "debug_postgresql_performance"
    ],
    "provisioning_scripts": [
      "provision_postgresql_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/postgresql-operations-mastery-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000005",
    "stripe_price_id": "price_1UZCYJGnuF7uNW2kkVO3Cixb"
  },
  {
    "id": "prod_000006",
    "slug": "postgresql-operations-mastery-enterprise",
    "name": "PostgreSQL Operations Enterprise",
    "description": "Enterprise PostgreSQL Operations platform — the complete 30-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise PostgreSQL Operations platform — fleet-wide reliability, team-ready",
    "tier": "tier-1",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 30,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "PostgreSQL Operations Mastery Complete Core",
        "slug": "postgresql",
        "count": 24,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_postgresql_health",
          "verify_postgresql_replication",
          "verify_postgresql_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_postgresql_failure",
          "debug_postgresql_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_postgresql_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_postgresql_health",
      "verify_postgresql_replication",
      "verify_postgresql_security"
    ],
    "debug_scripts": [
      "debug_postgresql_failure",
      "debug_postgresql_performance"
    ],
    "provisioning_scripts": [
      "provision_postgresql_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/postgresql-operations-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000006",
    "stripe_price_id": "price_1UZCYKGnuF7uNW2k74Xw2Ghz"
  },
  {
    "id": "prod_000007",
    "slug": "redis-mastery-essentials",
    "name": "Redis Essentials",
    "description": "Essential Redis toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Redis scripts — get unblocked in minutes",
    "tier": "tier-1",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Redis Mastery Complete Core",
        "slug": "redis",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_redis_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_redis_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_redis_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_redis_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/redis-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000007",
    "stripe_price_id": "price_1UZCYKGnuF7uNW2kAx2umVnn"
  },
  {
    "id": "prod_000008",
    "slug": "redis-mastery-professional",
    "name": "Redis Professional",
    "description": "Professional Redis pack — 19 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Redis — verified, debugged, ready to deploy",
    "tier": "tier-1",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 19,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Redis Mastery Complete Core",
        "slug": "redis",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_redis_health",
          "verify_redis_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_redis_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_redis_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_redis_health",
      "verify_redis_replication"
    ],
    "debug_scripts": [
      "debug_redis_failure",
      "debug_redis_performance"
    ],
    "provisioning_scripts": [
      "provision_redis_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/redis-mastery-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000008",
    "stripe_price_id": "price_1UZCYKGnuF7uNW2kyhk7PkO2"
  },
  {
    "id": "prod_000009",
    "slug": "redis-mastery-enterprise",
    "name": "Redis Enterprise",
    "description": "Enterprise Redis platform — the complete 27-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Redis platform — fleet-wide reliability, team-ready",
    "tier": "tier-1",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 27,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Redis Mastery Complete Core",
        "slug": "redis",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_redis_health",
          "verify_redis_replication",
          "verify_redis_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_redis_failure",
          "debug_redis_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_redis_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_redis_health",
      "verify_redis_replication",
      "verify_redis_security"
    ],
    "debug_scripts": [
      "debug_redis_failure",
      "debug_redis_performance"
    ],
    "provisioning_scripts": [
      "provision_redis_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/redis-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000009",
    "stripe_price_id": "price_1UZCYLGnuF7uNW2kqkvAXHQ7"
  },
  {
    "id": "prod_000010",
    "slug": "linux-system-mastery-essentials",
    "name": "Linux System Essentials",
    "description": "Essential Linux System toolkit — 13 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Linux System scripts — get unblocked in minutes",
    "tier": "tier-1",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 13,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Linux System Mastery Complete Core",
        "slug": "linux",
        "count": 26,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_linux_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_linux_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_linux_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_linux_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/linux-system-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000010",
    "stripe_price_id": "price_1UZCYLGnuF7uNW2k926NOjEj"
  },
  {
    "id": "prod_000011",
    "slug": "linux-system-mastery-professional",
    "name": "Linux System Professional",
    "description": "Professional Linux System pack — 22 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Linux System — verified, debugged, ready to deploy",
    "tier": "tier-1",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 22,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Linux System Mastery Complete Core",
        "slug": "linux",
        "count": 26,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_linux_health",
          "verify_linux_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_linux_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_linux_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_linux_health",
      "verify_linux_replication"
    ],
    "debug_scripts": [
      "debug_linux_failure",
      "debug_linux_performance"
    ],
    "provisioning_scripts": [
      "provision_linux_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/linux-system-mastery-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000011",
    "stripe_price_id": "price_1UZCYLGnuF7uNW2kD9cC5Afb"
  },
  {
    "id": "prod_000012",
    "slug": "linux-system-mastery-enterprise",
    "name": "Linux System Enterprise",
    "description": "Enterprise Linux System platform — the complete 32-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Linux System platform — fleet-wide reliability, team-ready",
    "tier": "tier-1",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 32,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Linux System Mastery Complete Core",
        "slug": "linux",
        "count": 26,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_linux_health",
          "verify_linux_replication",
          "verify_linux_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_linux_failure",
          "debug_linux_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_linux_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_linux_health",
      "verify_linux_replication",
      "verify_linux_security"
    ],
    "debug_scripts": [
      "debug_linux_failure",
      "debug_linux_performance"
    ],
    "provisioning_scripts": [
      "provision_linux_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/linux-system-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000012",
    "stripe_price_id": "price_1UZCYMGnuF7uNW2kJq75FGpY"
  },
  {
    "id": "prod_000013",
    "slug": "docker-container-mastery-essentials",
    "name": "Docker/Container Essentials",
    "description": "Essential Docker/Container toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Docker/Container scripts — get unblocked in minutes",
    "tier": "tier-1",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Docker/Container Mastery Complete Core",
        "slug": "docker",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_docker_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_docker_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_docker_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_docker_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/docker-container-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000013",
    "stripe_price_id": "price_1UZCYMGnuF7uNW2kkcouB7sg"
  },
  {
    "id": "prod_000014",
    "slug": "docker-container-mastery-professional",
    "name": "Docker/Container Professional",
    "description": "Professional Docker/Container pack — 19 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Docker/Container — verified, debugged, ready to deploy",
    "tier": "tier-1",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 19,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Docker/Container Mastery Complete Core",
        "slug": "docker",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_docker_health",
          "verify_docker_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_docker_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_docker_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_docker_health",
      "verify_docker_replication"
    ],
    "debug_scripts": [
      "debug_docker_failure",
      "debug_docker_performance"
    ],
    "provisioning_scripts": [
      "provision_docker_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/docker-container-mastery-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000014",
    "stripe_price_id": "price_1UZCYMGnuF7uNW2kXQ3URBxu"
  },
  {
    "id": "prod_000015",
    "slug": "docker-container-mastery-enterprise",
    "name": "Docker/Container Enterprise",
    "description": "Enterprise Docker/Container platform — the complete 27-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Docker/Container platform — fleet-wide reliability, team-ready",
    "tier": "tier-1",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 27,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Docker/Container Mastery Complete Core",
        "slug": "docker",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_docker_health",
          "verify_docker_replication",
          "verify_docker_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_docker_failure",
          "debug_docker_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_docker_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_docker_health",
      "verify_docker_replication",
      "verify_docker_security"
    ],
    "debug_scripts": [
      "debug_docker_failure",
      "debug_docker_performance"
    ],
    "provisioning_scripts": [
      "provision_docker_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/docker-container-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000015",
    "stripe_price_id": "price_1UZCYNGnuF7uNW2kWvpVwCiH"
  },
  {
    "id": "prod_000016",
    "slug": "ci-cd-pipeline-mastery-essentials",
    "name": "CI/CD Pipeline Essentials",
    "description": "Essential CI/CD Pipeline toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential CI/CD Pipeline scripts — get unblocked in minutes",
    "tier": "tier-1",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "CI/CD Pipeline Mastery Complete Core",
        "slug": "ci-cd",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ci/cd_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ci/cd_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ci/cd_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ci/cd_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/ci-cd-pipeline-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000016",
    "stripe_price_id": "price_1UZCYNGnuF7uNW2k4fKryXMe"
  },
  {
    "id": "prod_000017",
    "slug": "ci-cd-pipeline-mastery-professional",
    "name": "CI/CD Pipeline Professional",
    "description": "Professional CI/CD Pipeline pack — 19 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade CI/CD Pipeline — verified, debugged, ready to deploy",
    "tier": "tier-1",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 19,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "CI/CD Pipeline Mastery Complete Core",
        "slug": "ci-cd",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ci/cd_health",
          "verify_ci/cd_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ci/cd_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ci/cd_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ci/cd_health",
      "verify_ci/cd_replication"
    ],
    "debug_scripts": [
      "debug_ci/cd_failure",
      "debug_ci/cd_performance"
    ],
    "provisioning_scripts": [
      "provision_ci/cd_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/ci-cd-pipeline-mastery-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000017",
    "stripe_price_id": "price_1UZCYNGnuF7uNW2kcWnHp7TM"
  },
  {
    "id": "prod_000018",
    "slug": "ci-cd-pipeline-mastery-enterprise",
    "name": "CI/CD Pipeline Enterprise",
    "description": "Enterprise CI/CD Pipeline platform — the complete 27-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise CI/CD Pipeline platform — fleet-wide reliability, team-ready",
    "tier": "tier-1",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 27,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "CI/CD Pipeline Mastery Complete Core",
        "slug": "ci-cd",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ci/cd_health",
          "verify_ci/cd_replication",
          "verify_ci/cd_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ci/cd_failure",
          "debug_ci/cd_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ci/cd_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ci/cd_health",
      "verify_ci/cd_replication",
      "verify_ci/cd_security"
    ],
    "debug_scripts": [
      "debug_ci/cd_failure",
      "debug_ci/cd_performance"
    ],
    "provisioning_scripts": [
      "provision_ci/cd_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/ci-cd-pipeline-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000018",
    "stripe_price_id": "price_1UZCYOGnuF7uNW2k54CSx4Dw"
  },
  {
    "id": "prod_000019",
    "slug": "infrastructure-as-code-mastery-essentials",
    "name": "Infrastructure as Code Essentials",
    "description": "Essential Infrastructure as Code toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Infrastructure as Code scripts — get unblocked in minutes",
    "tier": "tier-1",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Infrastructure as Code Mastery Complete Core",
        "slug": "infrastructure-as-code",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_infrastructure as code_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_infrastructure as code_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_infrastructure as code_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_infrastructure as code_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/infrastructure-as-code-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000019",
    "stripe_price_id": "price_1UZCYOGnuF7uNW2kYuuOyYPf"
  },
  {
    "id": "prod_000020",
    "slug": "infrastructure-as-code-mastery-professional",
    "name": "Infrastructure as Code Professional",
    "description": "Professional Infrastructure as Code pack — 19 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Infrastructure as Code — verified, debugged, ready to deploy",
    "tier": "tier-1",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 19,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Infrastructure as Code Mastery Complete Core",
        "slug": "infrastructure-as-code",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_infrastructure as code_health",
          "verify_infrastructure as code_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_infrastructure as code_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_infrastructure as code_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_infrastructure as code_health",
      "verify_infrastructure as code_replication"
    ],
    "debug_scripts": [
      "debug_infrastructure as code_failure",
      "debug_infrastructure as code_performance"
    ],
    "provisioning_scripts": [
      "provision_infrastructure as code_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/infrastructure-as-code-mastery-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000020",
    "stripe_price_id": "price_1UZCYOGnuF7uNW2kz8MaFTdC"
  },
  {
    "id": "prod_000021",
    "slug": "infrastructure-as-code-mastery-enterprise",
    "name": "Infrastructure as Code Enterprise",
    "description": "Enterprise Infrastructure as Code platform — the complete 27-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Infrastructure as Code platform — fleet-wide reliability, team-ready",
    "tier": "tier-1",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 27,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Infrastructure as Code Mastery Complete Core",
        "slug": "infrastructure-as-code",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_infrastructure as code_health",
          "verify_infrastructure as code_replication",
          "verify_infrastructure as code_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_infrastructure as code_failure",
          "debug_infrastructure as code_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_infrastructure as code_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_infrastructure as code_health",
      "verify_infrastructure as code_replication",
      "verify_infrastructure as code_security"
    ],
    "debug_scripts": [
      "debug_infrastructure as code_failure",
      "debug_infrastructure as code_performance"
    ],
    "provisioning_scripts": [
      "provision_infrastructure as code_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/infrastructure-as-code-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000021",
    "stripe_price_id": "price_1UZCYPGnuF7uNW2k6YsxXt6R"
  },
  {
    "id": "prod_000022",
    "slug": "observability-mastery-essentials",
    "name": "Observability Essentials",
    "description": "Essential Observability toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Observability scripts — get unblocked in minutes",
    "tier": "tier-1",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Observability Mastery Complete Core",
        "slug": "observability",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_observability_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_observability_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_observability_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_observability_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/observability-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000022",
    "stripe_price_id": "price_1UZCYPGnuF7uNW2kPzNEOJiu"
  },
  {
    "id": "prod_000023",
    "slug": "observability-mastery-professional",
    "name": "Observability Professional",
    "description": "Professional Observability pack — 19 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Observability — verified, debugged, ready to deploy",
    "tier": "tier-1",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 19,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Observability Mastery Complete Core",
        "slug": "observability",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_observability_health",
          "verify_observability_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_observability_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_observability_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_observability_health",
      "verify_observability_replication"
    ],
    "debug_scripts": [
      "debug_observability_failure",
      "debug_observability_performance"
    ],
    "provisioning_scripts": [
      "provision_observability_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/observability-mastery-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000023",
    "stripe_price_id": "price_1UZCYPGnuF7uNW2kGmqXMDtK"
  },
  {
    "id": "prod_000024",
    "slug": "observability-mastery-enterprise",
    "name": "Observability Enterprise",
    "description": "Enterprise Observability platform — the complete 27-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Observability platform — fleet-wide reliability, team-ready",
    "tier": "tier-1",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 27,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Observability Mastery Complete Core",
        "slug": "observability",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_observability_health",
          "verify_observability_replication",
          "verify_observability_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_observability_failure",
          "debug_observability_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_observability_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_observability_health",
      "verify_observability_replication",
      "verify_observability_security"
    ],
    "debug_scripts": [
      "debug_observability_failure",
      "debug_observability_performance"
    ],
    "provisioning_scripts": [
      "provision_observability_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/observability-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000024",
    "stripe_price_id": "price_1UZCYPGnuF7uNW2kQ212gd89"
  },
  {
    "id": "prod_000025",
    "slug": "security-hardening-mastery-essentials",
    "name": "Security Hardening Essentials",
    "description": "Essential Security Hardening toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Security Hardening scripts — get unblocked in minutes",
    "tier": "tier-1",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Security Hardening Mastery Complete Core",
        "slug": "security",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_security_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_security_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_security_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_security_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/security-hardening-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000025",
    "stripe_price_id": "price_1UZCYQGnuF7uNW2kh8NKdyaX"
  },
  {
    "id": "prod_000026",
    "slug": "security-hardening-mastery-professional",
    "name": "Security Hardening Professional",
    "description": "Professional Security Hardening pack — 19 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Security Hardening — verified, debugged, ready to deploy",
    "tier": "tier-1",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 19,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Security Hardening Mastery Complete Core",
        "slug": "security",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_security_health",
          "verify_security_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_security_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_security_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_security_health",
      "verify_security_replication"
    ],
    "debug_scripts": [
      "debug_security_failure",
      "debug_security_performance"
    ],
    "provisioning_scripts": [
      "provision_security_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/security-hardening-mastery-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000026",
    "stripe_price_id": "price_1UZCYQGnuF7uNW2kPJvKQA8x"
  },
  {
    "id": "prod_000027",
    "slug": "security-hardening-mastery-enterprise",
    "name": "Security Hardening Enterprise",
    "description": "Enterprise Security Hardening platform — the complete 27-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Security Hardening platform — fleet-wide reliability, team-ready",
    "tier": "tier-1",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 27,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Security Hardening Mastery Complete Core",
        "slug": "security",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_security_health",
          "verify_security_replication",
          "verify_security_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_security_failure",
          "debug_security_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_security_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_security_health",
      "verify_security_replication",
      "verify_security_security"
    ],
    "debug_scripts": [
      "debug_security_failure",
      "debug_security_performance"
    ],
    "provisioning_scripts": [
      "provision_security_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/security-hardening-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000027",
    "stripe_price_id": "price_1UZCYQGnuF7uNW2kotI0NJHe"
  },
  {
    "id": "prod_000028",
    "slug": "ai-ml-platform-mastery-essentials",
    "name": "AI/ML Platform Essentials",
    "description": "Essential AI/ML Platform toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential AI/ML Platform scripts — get unblocked in minutes",
    "tier": "tier-1",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "AI/ML Platform Mastery Complete Core",
        "slug": "ai-ml",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ai/ml_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ai/ml_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ai/ml_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ai/ml_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/ai-ml-platform-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000028",
    "stripe_price_id": "price_1UZCYRGnuF7uNW2kHHKOwvri"
  },
  {
    "id": "prod_000029",
    "slug": "ai-ml-platform-mastery-professional",
    "name": "AI/ML Platform Professional",
    "description": "Professional AI/ML Platform pack — 19 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade AI/ML Platform — verified, debugged, ready to deploy",
    "tier": "tier-1",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 19,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "AI/ML Platform Mastery Complete Core",
        "slug": "ai-ml",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ai/ml_health",
          "verify_ai/ml_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ai/ml_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ai/ml_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ai/ml_health",
      "verify_ai/ml_replication"
    ],
    "debug_scripts": [
      "debug_ai/ml_failure",
      "debug_ai/ml_performance"
    ],
    "provisioning_scripts": [
      "provision_ai/ml_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/ai-ml-platform-mastery-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000029",
    "stripe_price_id": "price_1UZCYRGnuF7uNW2keyPvvzKP"
  },
  {
    "id": "prod_000030",
    "slug": "ai-ml-platform-mastery-enterprise",
    "name": "AI/ML Platform Enterprise",
    "description": "Enterprise AI/ML Platform platform — the complete 27-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise AI/ML Platform platform — fleet-wide reliability, team-ready",
    "tier": "tier-1",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 27,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "AI/ML Platform Mastery Complete Core",
        "slug": "ai-ml",
        "count": 21,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ai/ml_health",
          "verify_ai/ml_replication",
          "verify_ai/ml_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ai/ml_failure",
          "debug_ai/ml_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ai/ml_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ai/ml_health",
      "verify_ai/ml_replication",
      "verify_ai/ml_security"
    ],
    "debug_scripts": [
      "debug_ai/ml_failure",
      "debug_ai/ml_performance"
    ],
    "provisioning_scripts": [
      "provision_ai/ml_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/ai-ml-platform-mastery-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "mastery",
      "deep-dive",
      "single-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000030",
    "stripe_price_id": "price_1UZCYRGnuF7uNW2ksMp9x0hm"
  },
  {
    "id": "prod_000031",
    "slug": "senior-platform-engineer-toolkit-essentials",
    "name": "Senior Platform Engineer Toolkit Essentials",
    "description": "Essential Senior Platform Engineer toolkit — 18 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Senior Platform Engineer scripts — get unblocked in minutes",
    "tier": "tier-2",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 18,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Senior Platform Engineer Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/senior-platform-engineer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000031",
    "stripe_price_id": "price_1UZCYSGnuF7uNW2kC5oVqA6G"
  },
  {
    "id": "prod_000032",
    "slug": "senior-platform-engineer-toolkit-professional",
    "name": "Senior Platform Engineer Toolkit Professional",
    "description": "Professional Senior Platform Engineer pack — 31 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Senior Platform Engineer — verified, debugged, ready to deploy",
    "tier": "tier-2",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 31,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Senior Platform Engineer Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/senior-platform-engineer-toolkit-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000032",
    "stripe_price_id": "price_1UZCYSGnuF7uNW2k296vd7dk"
  },
  {
    "id": "prod_000033",
    "slug": "senior-platform-engineer-toolkit-enterprise",
    "name": "Senior Platform Engineer Toolkit Enterprise",
    "description": "Enterprise Senior Platform Engineer platform — the complete 45-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Senior Platform Engineer platform — fleet-wide reliability, team-ready",
    "tier": "tier-2",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 45,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Senior Platform Engineer Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/senior-platform-engineer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000033",
    "stripe_price_id": "price_1UZCYSGnuF7uNW2kpMAoRAYX"
  },
  {
    "id": "prod_000034",
    "slug": "sre-production-engineer-toolkit-essentials",
    "name": "SRE/Production Engineer Toolkit Essentials",
    "description": "Essential SRE/Production Engineer toolkit — 18 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential SRE/Production Engineer scripts — get unblocked in minutes",
    "tier": "tier-2",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 18,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "SRE/Production Engineer Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/sre-production-engineer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000034",
    "stripe_price_id": "price_1UZCYTGnuF7uNW2kTr1uKmkn"
  },
  {
    "id": "prod_000035",
    "slug": "sre-production-engineer-toolkit-professional",
    "name": "SRE/Production Engineer Toolkit Professional",
    "description": "Professional SRE/Production Engineer pack — 31 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade SRE/Production Engineer — verified, debugged, ready to deploy",
    "tier": "tier-2",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 31,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "SRE/Production Engineer Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/sre-production-engineer-toolkit-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000035",
    "stripe_price_id": "price_1UZCYTGnuF7uNW2kjpT9A9ua"
  },
  {
    "id": "prod_000036",
    "slug": "sre-production-engineer-toolkit-enterprise",
    "name": "SRE/Production Engineer Toolkit Enterprise",
    "description": "Enterprise SRE/Production Engineer platform — the complete 45-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise SRE/Production Engineer platform — fleet-wide reliability, team-ready",
    "tier": "tier-2",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 45,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "SRE/Production Engineer Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/sre-production-engineer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000036",
    "stripe_price_id": "price_1UZCYTGnuF7uNW2kxSYLXzjC"
  },
  {
    "id": "prod_000037",
    "slug": "devops-engineer-toolkit-essentials",
    "name": "DevOps Engineer Toolkit Essentials",
    "description": "Essential DevOps Engineer toolkit — 18 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential DevOps Engineer scripts — get unblocked in minutes",
    "tier": "tier-2",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 18,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "DevOps Engineer Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/devops-engineer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000037",
    "stripe_price_id": "price_1UZCYUGnuF7uNW2kbvpgI1KW"
  },
  {
    "id": "prod_000038",
    "slug": "devops-engineer-toolkit-professional",
    "name": "DevOps Engineer Toolkit Professional",
    "description": "Professional DevOps Engineer pack — 31 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade DevOps Engineer — verified, debugged, ready to deploy",
    "tier": "tier-2",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 31,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "DevOps Engineer Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/devops-engineer-toolkit-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000038",
    "stripe_price_id": "price_1UZCYUGnuF7uNW2k9ucHCaHb"
  },
  {
    "id": "prod_000039",
    "slug": "devops-engineer-toolkit-enterprise",
    "name": "DevOps Engineer Toolkit Enterprise",
    "description": "Enterprise DevOps Engineer platform — the complete 45-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise DevOps Engineer platform — fleet-wide reliability, team-ready",
    "tier": "tier-2",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 45,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "DevOps Engineer Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/devops-engineer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000039",
    "stripe_price_id": "price_1UZCYUGnuF7uNW2kzbLiLnFw"
  },
  {
    "id": "prod_000040",
    "slug": "cloud-engineer-toolkit-aws-essentials",
    "name": "Cloud Engineer Toolkit (AWS) Essentials",
    "description": "Essential Cloud Engineer Toolkit (AWS) toolkit — 18 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Cloud Engineer Toolkit (AWS) scripts — get unblocked in minutes",
    "tier": "tier-2",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 18,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Cloud Engineer Toolkit (AWS) Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/cloud-engineer-toolkit-aws-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000040",
    "stripe_price_id": "price_1UZCYVGnuF7uNW2k3R557wfG"
  },
  {
    "id": "prod_000041",
    "slug": "cloud-engineer-toolkit-aws-professional",
    "name": "Cloud Engineer Toolkit (AWS) Professional",
    "description": "Professional Cloud Engineer Toolkit (AWS) pack — 31 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Cloud Engineer Toolkit (AWS) — verified, debugged, ready to deploy",
    "tier": "tier-2",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 31,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Cloud Engineer Toolkit (AWS) Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/cloud-engineer-toolkit-aws-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000041",
    "stripe_price_id": "price_1UZCYVGnuF7uNW2kqySvW072"
  },
  {
    "id": "prod_000042",
    "slug": "cloud-engineer-toolkit-aws-enterprise",
    "name": "Cloud Engineer Toolkit (AWS) Enterprise",
    "description": "Enterprise Cloud Engineer Toolkit (AWS) platform — the complete 45-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Cloud Engineer Toolkit (AWS) platform — fleet-wide reliability, team-ready",
    "tier": "tier-2",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 45,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Cloud Engineer Toolkit (AWS) Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/cloud-engineer-toolkit-aws-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000042",
    "stripe_price_id": "price_1UZCYVGnuF7uNW2kkaErZAmw"
  },
  {
    "id": "prod_000043",
    "slug": "cloud-engineer-toolkit-gcp-essentials",
    "name": "Cloud Engineer Toolkit (GCP) Essentials",
    "description": "Essential Cloud Engineer Toolkit (GCP) toolkit — 18 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Cloud Engineer Toolkit (GCP) scripts — get unblocked in minutes",
    "tier": "tier-2",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 18,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Cloud Engineer Toolkit (GCP) Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/cloud-engineer-toolkit-gcp-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000043",
    "stripe_price_id": "price_1UZCYWGnuF7uNW2kSssukGBZ"
  },
  {
    "id": "prod_000044",
    "slug": "cloud-engineer-toolkit-gcp-professional",
    "name": "Cloud Engineer Toolkit (GCP) Professional",
    "description": "Professional Cloud Engineer Toolkit (GCP) pack — 31 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Cloud Engineer Toolkit (GCP) — verified, debugged, ready to deploy",
    "tier": "tier-2",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 31,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Cloud Engineer Toolkit (GCP) Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/cloud-engineer-toolkit-gcp-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000044",
    "stripe_price_id": "price_1UZCYWGnuF7uNW2k54sX3KgZ"
  },
  {
    "id": "prod_000045",
    "slug": "cloud-engineer-toolkit-gcp-enterprise",
    "name": "Cloud Engineer Toolkit (GCP) Enterprise",
    "description": "Enterprise Cloud Engineer Toolkit (GCP) platform — the complete 45-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Cloud Engineer Toolkit (GCP) platform — fleet-wide reliability, team-ready",
    "tier": "tier-2",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 45,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Cloud Engineer Toolkit (GCP) Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/cloud-engineer-toolkit-gcp-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000045",
    "stripe_price_id": "price_1UZCYWGnuF7uNW2kPNsbqRAq"
  },
  {
    "id": "prod_000046",
    "slug": "cloud-engineer-toolkit-azure-essentials",
    "name": "Cloud Engineer Toolkit (Azure) Essentials",
    "description": "Essential Cloud Engineer Toolkit (Azure) toolkit — 18 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Cloud Engineer Toolkit (Azure) scripts — get unblocked in minutes",
    "tier": "tier-2",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 18,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Cloud Engineer Toolkit (Azure) Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/cloud-engineer-toolkit-azure-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000046",
    "stripe_price_id": "price_1UZCYXGnuF7uNW2ko53it2pv"
  },
  {
    "id": "prod_000047",
    "slug": "cloud-engineer-toolkit-azure-professional",
    "name": "Cloud Engineer Toolkit (Azure) Professional",
    "description": "Professional Cloud Engineer Toolkit (Azure) pack — 31 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Cloud Engineer Toolkit (Azure) — verified, debugged, ready to deploy",
    "tier": "tier-2",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 31,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Cloud Engineer Toolkit (Azure) Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/cloud-engineer-toolkit-azure-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000047",
    "stripe_price_id": "price_1UZCYXGnuF7uNW2kOFDas9zR"
  },
  {
    "id": "prod_000048",
    "slug": "cloud-engineer-toolkit-azure-enterprise",
    "name": "Cloud Engineer Toolkit (Azure) Enterprise",
    "description": "Enterprise Cloud Engineer Toolkit (Azure) platform — the complete 45-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Cloud Engineer Toolkit (Azure) platform — fleet-wide reliability, team-ready",
    "tier": "tier-2",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 45,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Cloud Engineer Toolkit (Azure) Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/cloud-engineer-toolkit-azure-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000048",
    "stripe_price_id": "price_1UZCYXGnuF7uNW2kTryT5GKG"
  },
  {
    "id": "prod_000049",
    "slug": "ai-ml-platform-engineer-toolkit-essentials",
    "name": "AI/ML Platform Engineer Toolkit Essentials",
    "description": "Essential AI/ML Platform Engineer toolkit — 18 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential AI/ML Platform Engineer scripts — get unblocked in minutes",
    "tier": "tier-2",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 18,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "AI/ML Platform Engineer Toolkit Complete Core",
        "slug": "ai-ml",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ai/ml_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ai/ml_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ai/ml_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ai/ml_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/ai-ml-platform-engineer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000049",
    "stripe_price_id": "price_1UZCYYGnuF7uNW2khPTRexWy"
  },
  {
    "id": "prod_000050",
    "slug": "ai-ml-platform-engineer-toolkit-professional",
    "name": "AI/ML Platform Engineer Toolkit Professional",
    "description": "Professional AI/ML Platform Engineer pack — 31 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade AI/ML Platform Engineer — verified, debugged, ready to deploy",
    "tier": "tier-2",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 31,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "AI/ML Platform Engineer Toolkit Complete Core",
        "slug": "ai-ml",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ai/ml_health",
          "verify_ai/ml_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ai/ml_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ai/ml_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ai/ml_health",
      "verify_ai/ml_replication"
    ],
    "debug_scripts": [
      "debug_ai/ml_failure",
      "debug_ai/ml_performance"
    ],
    "provisioning_scripts": [
      "provision_ai/ml_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/ai-ml-platform-engineer-toolkit-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000050",
    "stripe_price_id": "price_1UZCYYGnuF7uNW2kcFCvc9Rr"
  },
  {
    "id": "prod_000051",
    "slug": "ai-ml-platform-engineer-toolkit-enterprise",
    "name": "AI/ML Platform Engineer Toolkit Enterprise",
    "description": "Enterprise AI/ML Platform Engineer platform — the complete 45-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise AI/ML Platform Engineer platform — fleet-wide reliability, team-ready",
    "tier": "tier-2",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 45,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "AI/ML Platform Engineer Toolkit Complete Core",
        "slug": "ai-ml",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ai/ml_health",
          "verify_ai/ml_replication",
          "verify_ai/ml_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ai/ml_failure",
          "debug_ai/ml_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ai/ml_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ai/ml_health",
      "verify_ai/ml_replication",
      "verify_ai/ml_security"
    ],
    "debug_scripts": [
      "debug_ai/ml_failure",
      "debug_ai/ml_performance"
    ],
    "provisioning_scripts": [
      "provision_ai/ml_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/ai-ml-platform-engineer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000051",
    "stripe_price_id": "price_1UZCYYGnuF7uNW2kyqJ4krFR"
  },
  {
    "id": "prod_000052",
    "slug": "data-platform-engineer-toolkit-essentials",
    "name": "Data Platform Engineer Toolkit Essentials",
    "description": "Essential Data Platform Engineer toolkit — 18 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Data Platform Engineer scripts — get unblocked in minutes",
    "tier": "tier-2",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 18,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Data Platform Engineer Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/data-platform-engineer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000052",
    "stripe_price_id": "price_1UZCYZGnuF7uNW2kxjUdBxty"
  },
  {
    "id": "prod_000053",
    "slug": "data-platform-engineer-toolkit-professional",
    "name": "Data Platform Engineer Toolkit Professional",
    "description": "Professional Data Platform Engineer pack — 31 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Data Platform Engineer — verified, debugged, ready to deploy",
    "tier": "tier-2",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 31,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Data Platform Engineer Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/data-platform-engineer-toolkit-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000053",
    "stripe_price_id": "price_1UZCYZGnuF7uNW2kH3h6YYF2"
  },
  {
    "id": "prod_000054",
    "slug": "data-platform-engineer-toolkit-enterprise",
    "name": "Data Platform Engineer Toolkit Enterprise",
    "description": "Enterprise Data Platform Engineer platform — the complete 45-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Data Platform Engineer platform — fleet-wide reliability, team-ready",
    "tier": "tier-2",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 45,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Data Platform Engineer Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/data-platform-engineer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000054",
    "stripe_price_id": "price_1UZCYZGnuF7uNW2kohpfdoSH"
  },
  {
    "id": "prod_000055",
    "slug": "security-engineer-toolkit-essentials",
    "name": "Security Engineer Toolkit Essentials",
    "description": "Essential Security Engineer toolkit — 18 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Security Engineer scripts — get unblocked in minutes",
    "tier": "tier-2",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 18,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Security Engineer Toolkit Complete Core",
        "slug": "security",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_security_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_security_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_security_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_security_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/security-engineer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000055",
    "stripe_price_id": "price_1UZCYaGnuF7uNW2kCaVE6ZQI"
  },
  {
    "id": "prod_000056",
    "slug": "security-engineer-toolkit-professional",
    "name": "Security Engineer Toolkit Professional",
    "description": "Professional Security Engineer pack — 31 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Security Engineer — verified, debugged, ready to deploy",
    "tier": "tier-2",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 31,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Security Engineer Toolkit Complete Core",
        "slug": "security",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_security_health",
          "verify_security_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_security_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_security_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_security_health",
      "verify_security_replication"
    ],
    "debug_scripts": [
      "debug_security_failure",
      "debug_security_performance"
    ],
    "provisioning_scripts": [
      "provision_security_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/security-engineer-toolkit-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000056",
    "stripe_price_id": "price_1UZCYaGnuF7uNW2kz4NVSeC2"
  },
  {
    "id": "prod_000057",
    "slug": "security-engineer-toolkit-enterprise",
    "name": "Security Engineer Toolkit Enterprise",
    "description": "Enterprise Security Engineer platform — the complete 45-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Security Engineer platform — fleet-wide reliability, team-ready",
    "tier": "tier-2",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 45,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Security Engineer Toolkit Complete Core",
        "slug": "security",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_security_health",
          "verify_security_replication",
          "verify_security_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_security_failure",
          "debug_security_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_security_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_security_health",
      "verify_security_replication",
      "verify_security_security"
    ],
    "debug_scripts": [
      "debug_security_failure",
      "debug_security_performance"
    ],
    "provisioning_scripts": [
      "provision_security_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/security-engineer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000057",
    "stripe_price_id": "price_1UZCYaGnuF7uNW2kgndI4EGZ"
  },
  {
    "id": "prod_000058",
    "slug": "platform-team-lead-toolkit-essentials",
    "name": "Platform Team Lead Toolkit Essentials",
    "description": "Essential Platform Team Lead toolkit — 18 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Platform Team Lead scripts — get unblocked in minutes",
    "tier": "tier-2",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 18,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Platform Team Lead Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/platform-team-lead-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000058",
    "stripe_price_id": "price_1UZCYbGnuF7uNW2klHiTEWfR"
  },
  {
    "id": "prod_000059",
    "slug": "platform-team-lead-toolkit-professional",
    "name": "Platform Team Lead Toolkit Professional",
    "description": "Professional Platform Team Lead pack — 31 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Platform Team Lead — verified, debugged, ready to deploy",
    "tier": "tier-2",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 31,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Platform Team Lead Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/platform-team-lead-toolkit-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000059",
    "stripe_price_id": "price_1UZCYbGnuF7uNW2kcGNvWnhK"
  },
  {
    "id": "prod_000060",
    "slug": "platform-team-lead-toolkit-enterprise",
    "name": "Platform Team Lead Toolkit Enterprise",
    "description": "Enterprise Platform Team Lead platform — the complete 45-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Platform Team Lead platform — fleet-wide reliability, team-ready",
    "tier": "tier-2",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 45,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Platform Team Lead Toolkit Complete Core",
        "slug": "platform-engineering",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/platform-team-lead-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000060",
    "stripe_price_id": "price_1UZCYbGnuF7uNW2kJ18NwSD2"
  },
  {
    "id": "prod_000061",
    "slug": "startup-cto-toolkit-essentials",
    "name": "Startup CTO Toolkit Essentials",
    "description": "Essential Startup CTO toolkit — 18 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Startup CTO scripts — get unblocked in minutes",
    "tier": "tier-2",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 18,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Startup CTO Toolkit Complete Core",
        "slug": "leadership",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_leadership_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_leadership_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_leadership_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_leadership_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/startup-cto-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000061",
    "stripe_price_id": "price_1UZCYcGnuF7uNW2kQ77hqFiG"
  },
  {
    "id": "prod_000062",
    "slug": "startup-cto-toolkit-professional",
    "name": "Startup CTO Toolkit Professional",
    "description": "Professional Startup CTO pack — 31 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Startup CTO — verified, debugged, ready to deploy",
    "tier": "tier-2",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 31,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Startup CTO Toolkit Complete Core",
        "slug": "leadership",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_leadership_health",
          "verify_leadership_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_leadership_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_leadership_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_leadership_health",
      "verify_leadership_replication"
    ],
    "debug_scripts": [
      "debug_leadership_failure",
      "debug_leadership_performance"
    ],
    "provisioning_scripts": [
      "provision_leadership_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/startup-cto-toolkit-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000062",
    "stripe_price_id": "price_1UZCYcGnuF7uNW2kHSgD5lbD"
  },
  {
    "id": "prod_000063",
    "slug": "startup-cto-toolkit-enterprise",
    "name": "Startup CTO Toolkit Enterprise",
    "description": "Enterprise Startup CTO platform — the complete 45-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Startup CTO platform — fleet-wide reliability, team-ready",
    "tier": "tier-2",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 45,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Startup CTO Toolkit Complete Core",
        "slug": "leadership",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_leadership_health",
          "verify_leadership_replication",
          "verify_leadership_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_leadership_failure",
          "debug_leadership_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_leadership_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_leadership_health",
      "verify_leadership_replication",
      "verify_leadership_security"
    ],
    "debug_scripts": [
      "debug_leadership_failure",
      "debug_leadership_performance"
    ],
    "provisioning_scripts": [
      "provision_leadership_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/startup-cto-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000063",
    "stripe_price_id": "price_1UZCYcGnuF7uNW2kDNLLsuVf"
  },
  {
    "id": "prod_000064",
    "slug": "contractor-freelancer-toolkit-essentials",
    "name": "Contractor/Freelancer Toolkit Essentials",
    "description": "Essential Contractor/Freelancer toolkit — 18 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Contractor/Freelancer scripts — get unblocked in minutes",
    "tier": "tier-2",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 18,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Contractor/Freelancer Toolkit Complete Core",
        "slug": "leadership",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_leadership_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_leadership_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_leadership_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_leadership_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/contractor-freelancer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000064",
    "stripe_price_id": "price_1UZCYdGnuF7uNW2k20tCciR0"
  },
  {
    "id": "prod_000065",
    "slug": "contractor-freelancer-toolkit-professional",
    "name": "Contractor/Freelancer Toolkit Professional",
    "description": "Professional Contractor/Freelancer pack — 31 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Contractor/Freelancer — verified, debugged, ready to deploy",
    "tier": "tier-2",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 31,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Contractor/Freelancer Toolkit Complete Core",
        "slug": "leadership",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_leadership_health",
          "verify_leadership_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_leadership_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_leadership_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_leadership_health",
      "verify_leadership_replication"
    ],
    "debug_scripts": [
      "debug_leadership_failure",
      "debug_leadership_performance"
    ],
    "provisioning_scripts": [
      "provision_leadership_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/contractor-freelancer-toolkit-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000065",
    "stripe_price_id": "price_1UZCYdGnuF7uNW2kJVon45OB"
  },
  {
    "id": "prod_000066",
    "slug": "contractor-freelancer-toolkit-enterprise",
    "name": "Contractor/Freelancer Toolkit Enterprise",
    "description": "Enterprise Contractor/Freelancer platform — the complete 45-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Contractor/Freelancer platform — fleet-wide reliability, team-ready",
    "tier": "tier-2",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 45,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Contractor/Freelancer Toolkit Complete Core",
        "slug": "leadership",
        "count": 39,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_leadership_health",
          "verify_leadership_replication",
          "verify_leadership_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_leadership_failure",
          "debug_leadership_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_leadership_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_leadership_health",
      "verify_leadership_replication",
      "verify_leadership_security"
    ],
    "debug_scripts": [
      "debug_leadership_failure",
      "debug_leadership_performance"
    ],
    "provisioning_scripts": [
      "provision_leadership_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/contractor-freelancer-toolkit-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "bundle",
      "role-based",
      "cross-category",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000066",
    "stripe_price_id": "price_1UZCYdGnuF7uNW2kB29wYCwt"
  },
  {
    "id": "prod_000067",
    "slug": "fintech-fedramp-platform-pack-essentials",
    "name": "FinTech/FedRAMP Platform Pack Essentials",
    "description": "Essential FinTech/FedRAMP Platform toolkit — 16 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential FinTech/FedRAMP Platform scripts — get unblocked in minutes",
    "tier": "tier-3",
    "price_cents": 4000,
    "price_usd": 40,
    "currency": "usd",
    "script_count": 16,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "FinTech/FedRAMP Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/fintech-fedramp-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000067",
    "stripe_price_id": "price_1UZCYeGnuF7uNW2kf7qtRflg"
  },
  {
    "id": "prod_000068",
    "slug": "fintech-fedramp-platform-pack-professional",
    "name": "FinTech/FedRAMP Platform Pack Professional",
    "description": "Professional FinTech/FedRAMP Platform pack — 28 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade FinTech/FedRAMP Platform — verified, debugged, ready to deploy",
    "tier": "tier-3",
    "price_cents": 5700,
    "price_usd": 57,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "FinTech/FedRAMP Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/fintech-fedramp-platform-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000068",
    "stripe_price_id": "price_1UZCYeGnuF7uNW2kLnXcDrjg"
  },
  {
    "id": "prod_000069",
    "slug": "fintech-fedramp-platform-pack-enterprise",
    "name": "FinTech/FedRAMP Platform Pack Enterprise",
    "description": "Enterprise FinTech/FedRAMP Platform platform — the complete 40-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise FinTech/FedRAMP Platform platform — fleet-wide reliability, team-ready",
    "tier": "tier-3",
    "price_cents": 10300,
    "price_usd": 103,
    "currency": "usd",
    "script_count": 40,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "FinTech/FedRAMP Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/fintech-fedramp-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000069",
    "stripe_price_id": "price_1UZCYeGnuF7uNW2kERnsLzPm"
  },
  {
    "id": "prod_000070",
    "slug": "healthtech-hipaa-platform-pack-essentials",
    "name": "HealthTech/HIPAA Platform Pack Essentials",
    "description": "Essential HealthTech/HIPAA Platform toolkit — 16 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential HealthTech/HIPAA Platform scripts — get unblocked in minutes",
    "tier": "tier-3",
    "price_cents": 4000,
    "price_usd": 40,
    "currency": "usd",
    "script_count": 16,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "HealthTech/HIPAA Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/healthtech-hipaa-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000070",
    "stripe_price_id": "price_1UZCYfGnuF7uNW2kEgmvnJAk"
  },
  {
    "id": "prod_000071",
    "slug": "healthtech-hipaa-platform-pack-professional",
    "name": "HealthTech/HIPAA Platform Pack Professional",
    "description": "Professional HealthTech/HIPAA Platform pack — 28 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade HealthTech/HIPAA Platform — verified, debugged, ready to deploy",
    "tier": "tier-3",
    "price_cents": 5700,
    "price_usd": 57,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "HealthTech/HIPAA Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/healthtech-hipaa-platform-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000071",
    "stripe_price_id": "price_1UZCYfGnuF7uNW2kypvoNIHQ"
  },
  {
    "id": "prod_000072",
    "slug": "healthtech-hipaa-platform-pack-enterprise",
    "name": "HealthTech/HIPAA Platform Pack Enterprise",
    "description": "Enterprise HealthTech/HIPAA Platform platform — the complete 40-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise HealthTech/HIPAA Platform platform — fleet-wide reliability, team-ready",
    "tier": "tier-3",
    "price_cents": 10300,
    "price_usd": 103,
    "currency": "usd",
    "script_count": 40,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "HealthTech/HIPAA Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/healthtech-hipaa-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000072",
    "stripe_price_id": "price_1UZCYfGnuF7uNW2kn68r2lrq"
  },
  {
    "id": "prod_000073",
    "slug": "govcloud-dod-platform-pack-essentials",
    "name": "GovCloud/DoD Platform Pack Essentials",
    "description": "Essential GovCloud/DoD Platform toolkit — 16 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential GovCloud/DoD Platform scripts — get unblocked in minutes",
    "tier": "tier-3",
    "price_cents": 4000,
    "price_usd": 40,
    "currency": "usd",
    "script_count": 16,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "GovCloud/DoD Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/govcloud-dod-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000073",
    "stripe_price_id": "price_1UZCYgGnuF7uNW2kHFO0shzz"
  },
  {
    "id": "prod_000074",
    "slug": "govcloud-dod-platform-pack-professional",
    "name": "GovCloud/DoD Platform Pack Professional",
    "description": "Professional GovCloud/DoD Platform pack — 28 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade GovCloud/DoD Platform — verified, debugged, ready to deploy",
    "tier": "tier-3",
    "price_cents": 5700,
    "price_usd": 57,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "GovCloud/DoD Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/govcloud-dod-platform-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000074",
    "stripe_price_id": "price_1UZCYgGnuF7uNW2kgQbvp6Ut"
  },
  {
    "id": "prod_000075",
    "slug": "govcloud-dod-platform-pack-enterprise",
    "name": "GovCloud/DoD Platform Pack Enterprise",
    "description": "Enterprise GovCloud/DoD Platform platform — the complete 40-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise GovCloud/DoD Platform platform — fleet-wide reliability, team-ready",
    "tier": "tier-3",
    "price_cents": 10300,
    "price_usd": 103,
    "currency": "usd",
    "script_count": 40,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "GovCloud/DoD Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/govcloud-dod-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000075",
    "stripe_price_id": "price_1UZCYgGnuF7uNW2k5uqScWjX"
  },
  {
    "id": "prod_000076",
    "slug": "e-commerce-pci-platform-pack-essentials",
    "name": "E-Commerce/PCI Platform Pack Essentials",
    "description": "Essential E-Commerce/PCI Platform toolkit — 16 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential E-Commerce/PCI Platform scripts — get unblocked in minutes",
    "tier": "tier-3",
    "price_cents": 4000,
    "price_usd": 40,
    "currency": "usd",
    "script_count": 16,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "E-Commerce/PCI Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/e-commerce-pci-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000076",
    "stripe_price_id": "price_1UZCYhGnuF7uNW2keJyE0P8x"
  },
  {
    "id": "prod_000077",
    "slug": "e-commerce-pci-platform-pack-professional",
    "name": "E-Commerce/PCI Platform Pack Professional",
    "description": "Professional E-Commerce/PCI Platform pack — 28 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade E-Commerce/PCI Platform — verified, debugged, ready to deploy",
    "tier": "tier-3",
    "price_cents": 5700,
    "price_usd": 57,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "E-Commerce/PCI Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/e-commerce-pci-platform-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000077",
    "stripe_price_id": "price_1UZCYhGnuF7uNW2kcVrJz6ST"
  },
  {
    "id": "prod_000078",
    "slug": "e-commerce-pci-platform-pack-enterprise",
    "name": "E-Commerce/PCI Platform Pack Enterprise",
    "description": "Enterprise E-Commerce/PCI Platform platform — the complete 40-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise E-Commerce/PCI Platform platform — fleet-wide reliability, team-ready",
    "tier": "tier-3",
    "price_cents": 10300,
    "price_usd": 103,
    "currency": "usd",
    "script_count": 40,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "E-Commerce/PCI Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/e-commerce-pci-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000078",
    "stripe_price_id": "price_1UZCYhGnuF7uNW2k7r3IJFBp"
  },
  {
    "id": "prod_000079",
    "slug": "saas-multi-tenant-platform-pack-essentials",
    "name": "SaaS Multi-Tenant Platform Pack Essentials",
    "description": "Essential SaaS Multi-Tenant Platform toolkit — 16 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential SaaS Multi-Tenant Platform scripts — get unblocked in minutes",
    "tier": "tier-3",
    "price_cents": 4000,
    "price_usd": 40,
    "currency": "usd",
    "script_count": 16,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "SaaS Multi-Tenant Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/saas-multi-tenant-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000079",
    "stripe_price_id": "price_1UZCYhGnuF7uNW2kjQIRp4vG"
  },
  {
    "id": "prod_000080",
    "slug": "saas-multi-tenant-platform-pack-professional",
    "name": "SaaS Multi-Tenant Platform Pack Professional",
    "description": "Professional SaaS Multi-Tenant Platform pack — 28 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade SaaS Multi-Tenant Platform — verified, debugged, ready to deploy",
    "tier": "tier-3",
    "price_cents": 5700,
    "price_usd": 57,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "SaaS Multi-Tenant Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/saas-multi-tenant-platform-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000080",
    "stripe_price_id": "price_1UZCYiGnuF7uNW2kMwgKvQCf"
  },
  {
    "id": "prod_000081",
    "slug": "saas-multi-tenant-platform-pack-enterprise",
    "name": "SaaS Multi-Tenant Platform Pack Enterprise",
    "description": "Enterprise SaaS Multi-Tenant Platform platform — the complete 40-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise SaaS Multi-Tenant Platform platform — fleet-wide reliability, team-ready",
    "tier": "tier-3",
    "price_cents": 10300,
    "price_usd": 103,
    "currency": "usd",
    "script_count": 40,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "SaaS Multi-Tenant Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/saas-multi-tenant-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000081",
    "stripe_price_id": "price_1UZCYiGnuF7uNW2kNjjPNfMD"
  },
  {
    "id": "prod_000082",
    "slug": "iot-edge-platform-pack-essentials",
    "name": "IoT/Edge Platform Pack Essentials",
    "description": "Essential IoT/Edge Platform toolkit — 16 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential IoT/Edge Platform scripts — get unblocked in minutes",
    "tier": "tier-3",
    "price_cents": 4000,
    "price_usd": 40,
    "currency": "usd",
    "script_count": 16,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "IoT/Edge Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/iot-edge-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000082",
    "stripe_price_id": "price_1UZCYjGnuF7uNW2kXvTO0w8x"
  },
  {
    "id": "prod_000083",
    "slug": "iot-edge-platform-pack-professional",
    "name": "IoT/Edge Platform Pack Professional",
    "description": "Professional IoT/Edge Platform pack — 28 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade IoT/Edge Platform — verified, debugged, ready to deploy",
    "tier": "tier-3",
    "price_cents": 5700,
    "price_usd": 57,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "IoT/Edge Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/iot-edge-platform-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000083",
    "stripe_price_id": "price_1UZCYjGnuF7uNW2kjskBWRSn"
  },
  {
    "id": "prod_000084",
    "slug": "iot-edge-platform-pack-enterprise",
    "name": "IoT/Edge Platform Pack Enterprise",
    "description": "Enterprise IoT/Edge Platform platform — the complete 40-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise IoT/Edge Platform platform — fleet-wide reliability, team-ready",
    "tier": "tier-3",
    "price_cents": 10300,
    "price_usd": 103,
    "currency": "usd",
    "script_count": 40,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "IoT/Edge Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/iot-edge-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000084",
    "stripe_price_id": "price_1UZCYjGnuF7uNW2kVormIQTB"
  },
  {
    "id": "prod_000085",
    "slug": "gaming-real-time-platform-pack-essentials",
    "name": "Gaming/Real-Time Platform Pack Essentials",
    "description": "Essential Gaming/Real-Time Platform toolkit — 16 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Gaming/Real-Time Platform scripts — get unblocked in minutes",
    "tier": "tier-3",
    "price_cents": 4000,
    "price_usd": 40,
    "currency": "usd",
    "script_count": 16,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Gaming/Real-Time Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/gaming-real-time-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000085",
    "stripe_price_id": "price_1UZCYkGnuF7uNW2kww4osHmc"
  },
  {
    "id": "prod_000086",
    "slug": "gaming-real-time-platform-pack-professional",
    "name": "Gaming/Real-Time Platform Pack Professional",
    "description": "Professional Gaming/Real-Time Platform pack — 28 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Gaming/Real-Time Platform — verified, debugged, ready to deploy",
    "tier": "tier-3",
    "price_cents": 5700,
    "price_usd": 57,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Gaming/Real-Time Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/gaming-real-time-platform-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000086",
    "stripe_price_id": "price_1UZCYkGnuF7uNW2k7ql0ILax"
  },
  {
    "id": "prod_000087",
    "slug": "gaming-real-time-platform-pack-enterprise",
    "name": "Gaming/Real-Time Platform Pack Enterprise",
    "description": "Enterprise Gaming/Real-Time Platform platform — the complete 40-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Gaming/Real-Time Platform platform — fleet-wide reliability, team-ready",
    "tier": "tier-3",
    "price_cents": 10300,
    "price_usd": 103,
    "currency": "usd",
    "script_count": 40,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Gaming/Real-Time Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/gaming-real-time-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000087",
    "stripe_price_id": "price_1UZCYkGnuF7uNW2kYYyQ09aS"
  },
  {
    "id": "prod_000088",
    "slug": "media-streaming-platform-pack-essentials",
    "name": "Media/Streaming Platform Pack Essentials",
    "description": "Essential Media/Streaming Platform toolkit — 16 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Media/Streaming Platform scripts — get unblocked in minutes",
    "tier": "tier-3",
    "price_cents": 4000,
    "price_usd": 40,
    "currency": "usd",
    "script_count": 16,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Media/Streaming Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/media-streaming-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000088",
    "stripe_price_id": "price_1UZCYlGnuF7uNW2kfBEBOSrD"
  },
  {
    "id": "prod_000089",
    "slug": "media-streaming-platform-pack-professional",
    "name": "Media/Streaming Platform Pack Professional",
    "description": "Professional Media/Streaming Platform pack — 28 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Media/Streaming Platform — verified, debugged, ready to deploy",
    "tier": "tier-3",
    "price_cents": 5700,
    "price_usd": 57,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Media/Streaming Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/media-streaming-platform-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000089",
    "stripe_price_id": "price_1UZCYlGnuF7uNW2knBeYROTn"
  },
  {
    "id": "prod_000090",
    "slug": "media-streaming-platform-pack-enterprise",
    "name": "Media/Streaming Platform Pack Enterprise",
    "description": "Enterprise Media/Streaming Platform platform — the complete 40-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Media/Streaming Platform platform — fleet-wide reliability, team-ready",
    "tier": "tier-3",
    "price_cents": 10300,
    "price_usd": 103,
    "currency": "usd",
    "script_count": 40,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Media/Streaming Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/media-streaming-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000090",
    "stripe_price_id": "price_1UZCYlGnuF7uNW2kLUNmjaKy"
  },
  {
    "id": "prod_000091",
    "slug": "crypto-blockchain-platform-pack-essentials",
    "name": "Crypto/Blockchain Platform Pack Essentials",
    "description": "Essential Crypto/Blockchain Platform toolkit — 16 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Crypto/Blockchain Platform scripts — get unblocked in minutes",
    "tier": "tier-3",
    "price_cents": 4000,
    "price_usd": 40,
    "currency": "usd",
    "script_count": 16,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Crypto/Blockchain Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/crypto-blockchain-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000091",
    "stripe_price_id": "price_1UZCYmGnuF7uNW2kUFpBDkEC"
  },
  {
    "id": "prod_000092",
    "slug": "crypto-blockchain-platform-pack-professional",
    "name": "Crypto/Blockchain Platform Pack Professional",
    "description": "Professional Crypto/Blockchain Platform pack — 28 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Crypto/Blockchain Platform — verified, debugged, ready to deploy",
    "tier": "tier-3",
    "price_cents": 5700,
    "price_usd": 57,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Crypto/Blockchain Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/crypto-blockchain-platform-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000092",
    "stripe_price_id": "price_1UZCYmGnuF7uNW2krsymxOqQ"
  },
  {
    "id": "prod_000093",
    "slug": "crypto-blockchain-platform-pack-enterprise",
    "name": "Crypto/Blockchain Platform Pack Enterprise",
    "description": "Enterprise Crypto/Blockchain Platform platform — the complete 40-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Crypto/Blockchain Platform platform — fleet-wide reliability, team-ready",
    "tier": "tier-3",
    "price_cents": 10300,
    "price_usd": 103,
    "currency": "usd",
    "script_count": 40,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Crypto/Blockchain Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/crypto-blockchain-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000093",
    "stripe_price_id": "price_1UZCYmGnuF7uNW2keodbURfr"
  },
  {
    "id": "prod_000094",
    "slug": "ai-ml-model-serving-at-scale-pack-essentials",
    "name": "AI/ML Model Serving at Scale Pack Essentials",
    "description": "Essential AI/ML Model Serving at Scale toolkit — 16 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential AI/ML Model Serving at Scale scripts — get unblocked in minutes",
    "tier": "tier-3",
    "price_cents": 4000,
    "price_usd": 40,
    "currency": "usd",
    "script_count": 16,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "AI/ML Model Serving at Scale Pack Complete Core",
        "slug": "ai-ml",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ai/ml_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ai/ml_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ai/ml_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ai/ml_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/ai-ml-model-serving-at-scale-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000094",
    "stripe_price_id": "price_1UZCYnGnuF7uNW2kPAE3YI0Y"
  },
  {
    "id": "prod_000095",
    "slug": "ai-ml-model-serving-at-scale-pack-professional",
    "name": "AI/ML Model Serving at Scale Pack Professional",
    "description": "Professional AI/ML Model Serving at Scale pack — 28 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade AI/ML Model Serving at Scale — verified, debugged, ready to deploy",
    "tier": "tier-3",
    "price_cents": 5700,
    "price_usd": 57,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "AI/ML Model Serving at Scale Pack Complete Core",
        "slug": "ai-ml",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ai/ml_health",
          "verify_ai/ml_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ai/ml_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ai/ml_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ai/ml_health",
      "verify_ai/ml_replication"
    ],
    "debug_scripts": [
      "debug_ai/ml_failure",
      "debug_ai/ml_performance"
    ],
    "provisioning_scripts": [
      "provision_ai/ml_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/ai-ml-model-serving-at-scale-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000095",
    "stripe_price_id": "price_1UZCYnGnuF7uNW2kkfzyL4FE"
  },
  {
    "id": "prod_000096",
    "slug": "ai-ml-model-serving-at-scale-pack-enterprise",
    "name": "AI/ML Model Serving at Scale Pack Enterprise",
    "description": "Enterprise AI/ML Model Serving at Scale platform — the complete 40-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise AI/ML Model Serving at Scale platform — fleet-wide reliability, team-ready",
    "tier": "tier-3",
    "price_cents": 10300,
    "price_usd": 103,
    "currency": "usd",
    "script_count": 40,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "AI/ML Model Serving at Scale Pack Complete Core",
        "slug": "ai-ml",
        "count": 34,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ai/ml_health",
          "verify_ai/ml_replication",
          "verify_ai/ml_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ai/ml_failure",
          "debug_ai/ml_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ai/ml_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ai/ml_health",
      "verify_ai/ml_replication",
      "verify_ai/ml_security"
    ],
    "debug_scripts": [
      "debug_ai/ml_failure",
      "debug_ai/ml_performance"
    ],
    "provisioning_scripts": [
      "provision_ai/ml_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/ai-ml-model-serving-at-scale-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000096",
    "stripe_price_id": "price_1UZCYnGnuF7uNW2kDCNzdtmA"
  },
  {
    "id": "prod_000097",
    "slug": "aws-eks-production-pack-essentials",
    "name": "AWS EKS Production Pack Essentials",
    "description": "Essential AWS EKS Production toolkit — 14 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential AWS EKS Production scripts — get unblocked in minutes",
    "tier": "tier-4",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 14,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "AWS EKS Production Pack Complete Core",
        "slug": "sre",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_sre_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_sre_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_sre_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_sre_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/aws-eks-production-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000097",
    "stripe_price_id": "price_1UZCYoGnuF7uNW2kJYWT2gF3"
  },
  {
    "id": "prod_000098",
    "slug": "aws-eks-production-pack-professional",
    "name": "AWS EKS Production Pack Professional",
    "description": "Professional AWS EKS Production pack — 25 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade AWS EKS Production — verified, debugged, ready to deploy",
    "tier": "tier-4",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 25,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "AWS EKS Production Pack Complete Core",
        "slug": "sre",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_sre_health",
          "verify_sre_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_sre_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_sre_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_sre_health",
      "verify_sre_replication"
    ],
    "debug_scripts": [
      "debug_sre_failure",
      "debug_sre_performance"
    ],
    "provisioning_scripts": [
      "provision_sre_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/aws-eks-production-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000098",
    "stripe_price_id": "price_1UZCYoGnuF7uNW2k7b7Oxmq4"
  },
  {
    "id": "prod_000099",
    "slug": "aws-eks-production-pack-enterprise",
    "name": "AWS EKS Production Pack Enterprise",
    "description": "Enterprise AWS EKS Production platform — the complete 35-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise AWS EKS Production platform — fleet-wide reliability, team-ready",
    "tier": "tier-4",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 35,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "AWS EKS Production Pack Complete Core",
        "slug": "sre",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_sre_health",
          "verify_sre_replication",
          "verify_sre_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_sre_failure",
          "debug_sre_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_sre_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_sre_health",
      "verify_sre_replication",
      "verify_sre_security"
    ],
    "debug_scripts": [
      "debug_sre_failure",
      "debug_sre_performance"
    ],
    "provisioning_scripts": [
      "provision_sre_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/aws-eks-production-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000099",
    "stripe_price_id": "price_1UZCYoGnuF7uNW2kZyTd0Tl4"
  },
  {
    "id": "prod_000100",
    "slug": "aws-serverless-platform-pack-essentials",
    "name": "AWS Serverless Platform Pack Essentials",
    "description": "Essential AWS Serverless Platform toolkit — 14 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential AWS Serverless Platform scripts — get unblocked in minutes",
    "tier": "tier-3",
    "price_cents": 4000,
    "price_usd": 40,
    "currency": "usd",
    "script_count": 14,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "AWS Serverless Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/aws-serverless-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000100",
    "stripe_price_id": "price_1UZCYpGnuF7uNW2k3xLYPX88"
  },
  {
    "id": "prod_000101",
    "slug": "aws-serverless-platform-pack-professional",
    "name": "AWS Serverless Platform Pack Professional",
    "description": "Professional AWS Serverless Platform pack — 25 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade AWS Serverless Platform — verified, debugged, ready to deploy",
    "tier": "tier-3",
    "price_cents": 5700,
    "price_usd": 57,
    "currency": "usd",
    "script_count": 25,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "AWS Serverless Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/aws-serverless-platform-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000101",
    "stripe_price_id": "price_1UZCYpGnuF7uNW2kJsTMbsVW"
  },
  {
    "id": "prod_000102",
    "slug": "aws-serverless-platform-pack-enterprise",
    "name": "AWS Serverless Platform Pack Enterprise",
    "description": "Enterprise AWS Serverless Platform platform — the complete 35-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise AWS Serverless Platform platform — fleet-wide reliability, team-ready",
    "tier": "tier-3",
    "price_cents": 10300,
    "price_usd": 103,
    "currency": "usd",
    "script_count": 35,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "AWS Serverless Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/aws-serverless-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000102",
    "stripe_price_id": "price_1UZCYqGnuF7uNW2kjLYBIEhV"
  },
  {
    "id": "prod_000103",
    "slug": "gcp-gke-production-pack-essentials",
    "name": "GCP GKE Production Pack Essentials",
    "description": "Essential GCP GKE Production toolkit — 14 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential GCP GKE Production scripts — get unblocked in minutes",
    "tier": "tier-4",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 14,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "GCP GKE Production Pack Complete Core",
        "slug": "sre",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_sre_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_sre_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_sre_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_sre_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/gcp-gke-production-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000103",
    "stripe_price_id": "price_1UZCYqGnuF7uNW2k8vjz5fE1"
  },
  {
    "id": "prod_000104",
    "slug": "gcp-gke-production-pack-professional",
    "name": "GCP GKE Production Pack Professional",
    "description": "Professional GCP GKE Production pack — 25 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade GCP GKE Production — verified, debugged, ready to deploy",
    "tier": "tier-4",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 25,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "GCP GKE Production Pack Complete Core",
        "slug": "sre",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_sre_health",
          "verify_sre_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_sre_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_sre_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_sre_health",
      "verify_sre_replication"
    ],
    "debug_scripts": [
      "debug_sre_failure",
      "debug_sre_performance"
    ],
    "provisioning_scripts": [
      "provision_sre_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/gcp-gke-production-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000104",
    "stripe_price_id": "price_1UZCYqGnuF7uNW2kkmkMDJi7"
  },
  {
    "id": "prod_000105",
    "slug": "gcp-gke-production-pack-enterprise",
    "name": "GCP GKE Production Pack Enterprise",
    "description": "Enterprise GCP GKE Production platform — the complete 35-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise GCP GKE Production platform — fleet-wide reliability, team-ready",
    "tier": "tier-4",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 35,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "GCP GKE Production Pack Complete Core",
        "slug": "sre",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_sre_health",
          "verify_sre_replication",
          "verify_sre_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_sre_failure",
          "debug_sre_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_sre_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_sre_health",
      "verify_sre_replication",
      "verify_sre_security"
    ],
    "debug_scripts": [
      "debug_sre_failure",
      "debug_sre_performance"
    ],
    "provisioning_scripts": [
      "provision_sre_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/gcp-gke-production-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000105",
    "stripe_price_id": "price_1UZCYrGnuF7uNW2kQRmhh1wr"
  },
  {
    "id": "prod_000106",
    "slug": "gcp-data-ml-platform-pack-essentials",
    "name": "GCP Data/ML Platform Pack Essentials",
    "description": "Essential GCP Data/ML Platform toolkit — 14 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential GCP Data/ML Platform scripts — get unblocked in minutes",
    "tier": "tier-3",
    "price_cents": 4000,
    "price_usd": 40,
    "currency": "usd",
    "script_count": 14,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "GCP Data/ML Platform Pack Complete Core",
        "slug": "ai-ml",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ai/ml_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ai/ml_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ai/ml_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ai/ml_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/gcp-data-ml-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000106",
    "stripe_price_id": "price_1UZCYrGnuF7uNW2k4rYhrnp5"
  },
  {
    "id": "prod_000107",
    "slug": "gcp-data-ml-platform-pack-professional",
    "name": "GCP Data/ML Platform Pack Professional",
    "description": "Professional GCP Data/ML Platform pack — 25 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade GCP Data/ML Platform — verified, debugged, ready to deploy",
    "tier": "tier-3",
    "price_cents": 5700,
    "price_usd": 57,
    "currency": "usd",
    "script_count": 25,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "GCP Data/ML Platform Pack Complete Core",
        "slug": "ai-ml",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ai/ml_health",
          "verify_ai/ml_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ai/ml_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ai/ml_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ai/ml_health",
      "verify_ai/ml_replication"
    ],
    "debug_scripts": [
      "debug_ai/ml_failure",
      "debug_ai/ml_performance"
    ],
    "provisioning_scripts": [
      "provision_ai/ml_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/gcp-data-ml-platform-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000107",
    "stripe_price_id": "price_1UZCYrGnuF7uNW2kYcxDJsHG"
  },
  {
    "id": "prod_000108",
    "slug": "gcp-data-ml-platform-pack-enterprise",
    "name": "GCP Data/ML Platform Pack Enterprise",
    "description": "Enterprise GCP Data/ML Platform platform — the complete 35-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise GCP Data/ML Platform platform — fleet-wide reliability, team-ready",
    "tier": "tier-3",
    "price_cents": 10300,
    "price_usd": 103,
    "currency": "usd",
    "script_count": 35,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "GCP Data/ML Platform Pack Complete Core",
        "slug": "ai-ml",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_ai/ml_health",
          "verify_ai/ml_replication",
          "verify_ai/ml_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_ai/ml_failure",
          "debug_ai/ml_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_ai/ml_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_ai/ml_health",
      "verify_ai/ml_replication",
      "verify_ai/ml_security"
    ],
    "debug_scripts": [
      "debug_ai/ml_failure",
      "debug_ai/ml_performance"
    ],
    "provisioning_scripts": [
      "provision_ai/ml_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/gcp-data-ml-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000108",
    "stripe_price_id": "price_1UZCYsGnuF7uNW2kd1ImDuPH"
  },
  {
    "id": "prod_000109",
    "slug": "azure-aks-production-pack-essentials",
    "name": "Azure AKS Production Pack Essentials",
    "description": "Essential Azure AKS Production toolkit — 14 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Azure AKS Production scripts — get unblocked in minutes",
    "tier": "tier-4",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 14,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Azure AKS Production Pack Complete Core",
        "slug": "sre",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_sre_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_sre_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_sre_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_sre_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/azure-aks-production-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000109",
    "stripe_price_id": "price_1UZCYsGnuF7uNW2kl2fckwoa"
  },
  {
    "id": "prod_000110",
    "slug": "azure-aks-production-pack-professional",
    "name": "Azure AKS Production Pack Professional",
    "description": "Professional Azure AKS Production pack — 25 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Azure AKS Production — verified, debugged, ready to deploy",
    "tier": "tier-4",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 25,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Azure AKS Production Pack Complete Core",
        "slug": "sre",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_sre_health",
          "verify_sre_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_sre_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_sre_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_sre_health",
      "verify_sre_replication"
    ],
    "debug_scripts": [
      "debug_sre_failure",
      "debug_sre_performance"
    ],
    "provisioning_scripts": [
      "provision_sre_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/azure-aks-production-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000110",
    "stripe_price_id": "price_1UZCYsGnuF7uNW2kMCjtvKue"
  },
  {
    "id": "prod_000111",
    "slug": "azure-aks-production-pack-enterprise",
    "name": "Azure AKS Production Pack Enterprise",
    "description": "Enterprise Azure AKS Production platform — the complete 35-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Azure AKS Production platform — fleet-wide reliability, team-ready",
    "tier": "tier-4",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 35,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Azure AKS Production Pack Complete Core",
        "slug": "sre",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_sre_health",
          "verify_sre_replication",
          "verify_sre_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_sre_failure",
          "debug_sre_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_sre_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_sre_health",
      "verify_sre_replication",
      "verify_sre_security"
    ],
    "debug_scripts": [
      "debug_sre_failure",
      "debug_sre_performance"
    ],
    "provisioning_scripts": [
      "provision_sre_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/azure-aks-production-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000111",
    "stripe_price_id": "price_1UZCYtGnuF7uNW2knjIJ0k4l"
  },
  {
    "id": "prod_000112",
    "slug": "azure-ai-platform-pack-essentials",
    "name": "Azure AI Platform Pack Essentials",
    "description": "Essential Azure AI Platform toolkit — 14 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Azure AI Platform scripts — get unblocked in minutes",
    "tier": "tier-3",
    "price_cents": 4000,
    "price_usd": 40,
    "currency": "usd",
    "script_count": 14,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Azure AI Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/azure-ai-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000112",
    "stripe_price_id": "price_1UZCYtGnuF7uNW2kg6Gb9ic8"
  },
  {
    "id": "prod_000113",
    "slug": "azure-ai-platform-pack-professional",
    "name": "Azure AI Platform Pack Professional",
    "description": "Professional Azure AI Platform pack — 25 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Azure AI Platform — verified, debugged, ready to deploy",
    "tier": "tier-3",
    "price_cents": 5700,
    "price_usd": 57,
    "currency": "usd",
    "script_count": 25,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Azure AI Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/azure-ai-platform-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000113",
    "stripe_price_id": "price_1UZCYtGnuF7uNW2k6pgbx3wg"
  },
  {
    "id": "prod_000114",
    "slug": "azure-ai-platform-pack-enterprise",
    "name": "Azure AI Platform Pack Enterprise",
    "description": "Enterprise Azure AI Platform platform — the complete 35-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Azure AI Platform platform — fleet-wide reliability, team-ready",
    "tier": "tier-3",
    "price_cents": 10300,
    "price_usd": 103,
    "currency": "usd",
    "script_count": 35,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Azure AI Platform Pack Complete Core",
        "slug": "platform-engineering",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_platform engineering_health",
          "verify_platform engineering_replication",
          "verify_platform engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_platform engineering_failure",
          "debug_platform engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_platform engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_platform engineering_health",
      "verify_platform engineering_replication",
      "verify_platform engineering_security"
    ],
    "debug_scripts": [
      "debug_platform engineering_failure",
      "debug_platform engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_platform engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/azure-ai-platform-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "vertical",
      "compliance",
      "industry",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000114",
    "stripe_price_id": "price_1UZCYuGnuF7uNW2kQnwuXCpm"
  },
  {
    "id": "prod_000115",
    "slug": "multi-cloud-cloud-agnostic-pack-essentials",
    "name": "Multi-Cloud/Cloud-Agnostic Pack Essentials",
    "description": "Essential Multi-Cloud/Cloud-Agnostic toolkit — 14 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Multi-Cloud/Cloud-Agnostic scripts — get unblocked in minutes",
    "tier": "tier-4",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 14,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Multi-Cloud/Cloud-Agnostic Pack Complete Core",
        "slug": "cloud-engineering",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_cloud engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_cloud engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_cloud engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_cloud engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/multi-cloud-cloud-agnostic-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000115",
    "stripe_price_id": "price_1UZCYuGnuF7uNW2kJqxgREE3"
  },
  {
    "id": "prod_000116",
    "slug": "multi-cloud-cloud-agnostic-pack-professional",
    "name": "Multi-Cloud/Cloud-Agnostic Pack Professional",
    "description": "Professional Multi-Cloud/Cloud-Agnostic pack — 25 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Multi-Cloud/Cloud-Agnostic — verified, debugged, ready to deploy",
    "tier": "tier-4",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 25,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Multi-Cloud/Cloud-Agnostic Pack Complete Core",
        "slug": "cloud-engineering",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_cloud engineering_health",
          "verify_cloud engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_cloud engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_cloud engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_cloud engineering_health",
      "verify_cloud engineering_replication"
    ],
    "debug_scripts": [
      "debug_cloud engineering_failure",
      "debug_cloud engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_cloud engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/multi-cloud-cloud-agnostic-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000116",
    "stripe_price_id": "price_1UZCYvGnuF7uNW2kxRfU5gbX"
  },
  {
    "id": "prod_000117",
    "slug": "multi-cloud-cloud-agnostic-pack-enterprise",
    "name": "Multi-Cloud/Cloud-Agnostic Pack Enterprise",
    "description": "Enterprise Multi-Cloud/Cloud-Agnostic platform — the complete 35-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Multi-Cloud/Cloud-Agnostic platform — fleet-wide reliability, team-ready",
    "tier": "tier-4",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 35,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Multi-Cloud/Cloud-Agnostic Pack Complete Core",
        "slug": "cloud-engineering",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_cloud engineering_health",
          "verify_cloud engineering_replication",
          "verify_cloud engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_cloud engineering_failure",
          "debug_cloud engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_cloud engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_cloud engineering_health",
      "verify_cloud engineering_replication",
      "verify_cloud engineering_security"
    ],
    "debug_scripts": [
      "debug_cloud engineering_failure",
      "debug_cloud engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_cloud engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/multi-cloud-cloud-agnostic-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000117",
    "stripe_price_id": "price_1UZCYvGnuF7uNW2kyRSKJ4HE"
  },
  {
    "id": "prod_000118",
    "slug": "hybrid-on-prem-cloud-burst-pack-essentials",
    "name": "Hybrid/On-Prem + Cloud Burst Pack Essentials",
    "description": "Essential Hybrid/On-Prem + Cloud Burst toolkit — 14 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Hybrid/On-Prem + Cloud Burst scripts — get unblocked in minutes",
    "tier": "tier-4",
    "price_cents": 3300,
    "price_usd": 33,
    "currency": "usd",
    "script_count": 14,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Hybrid/On-Prem + Cloud Burst Pack Complete Core",
        "slug": "cloud-engineering",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_cloud engineering_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_cloud engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_cloud engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_cloud engineering_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/hybrid-on-prem-cloud-burst-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000118",
    "stripe_price_id": "price_1UZCYvGnuF7uNW2kh8IrCRLL"
  },
  {
    "id": "prod_000119",
    "slug": "hybrid-on-prem-cloud-burst-pack-professional",
    "name": "Hybrid/On-Prem + Cloud Burst Pack Professional",
    "description": "Professional Hybrid/On-Prem + Cloud Burst pack — 25 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Hybrid/On-Prem + Cloud Burst — verified, debugged, ready to deploy",
    "tier": "tier-4",
    "price_cents": 4700,
    "price_usd": 47,
    "currency": "usd",
    "script_count": 25,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Hybrid/On-Prem + Cloud Burst Pack Complete Core",
        "slug": "cloud-engineering",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_cloud engineering_health",
          "verify_cloud engineering_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_cloud engineering_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_cloud engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_cloud engineering_health",
      "verify_cloud engineering_replication"
    ],
    "debug_scripts": [
      "debug_cloud engineering_failure",
      "debug_cloud engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_cloud engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/hybrid-on-prem-cloud-burst-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000119",
    "stripe_price_id": "price_1UZCYwGnuF7uNW2kAWFZp3rq"
  },
  {
    "id": "prod_000120",
    "slug": "hybrid-on-prem-cloud-burst-pack-enterprise",
    "name": "Hybrid/On-Prem + Cloud Burst Pack Enterprise",
    "description": "Enterprise Hybrid/On-Prem + Cloud Burst platform — the complete 35-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Hybrid/On-Prem + Cloud Burst platform — fleet-wide reliability, team-ready",
    "tier": "tier-4",
    "price_cents": 8500,
    "price_usd": 85,
    "currency": "usd",
    "script_count": 35,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Hybrid/On-Prem + Cloud Burst Pack Complete Core",
        "slug": "cloud-engineering",
        "count": 29,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_cloud engineering_health",
          "verify_cloud engineering_replication",
          "verify_cloud engineering_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_cloud engineering_failure",
          "debug_cloud engineering_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_cloud engineering_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_cloud engineering_health",
      "verify_cloud engineering_replication",
      "verify_cloud engineering_security"
    ],
    "debug_scripts": [
      "debug_cloud engineering_failure",
      "debug_cloud engineering_performance"
    ],
    "provisioning_scripts": [
      "provision_cloud engineering_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/hybrid-on-prem-cloud-burst-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "cloud",
      "specialization",
      "provider-native",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000120",
    "stripe_price_id": "price_1UZCYwGnuF7uNW2kiOuKei8U"
  },
  {
    "id": "prod_000121",
    "slug": "github-actions-enterprise-pack-essentials",
    "name": "GitHub Actions Enterprise Pack Essentials",
    "description": "Essential GitHub Actions Enterprise toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential GitHub Actions Enterprise scripts — get unblocked in minutes",
    "tier": "tier-5",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "GitHub Actions Enterprise Pack Complete Core",
        "slug": "github-actions",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_github actions_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_github actions_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_github actions_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_github actions_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/github-actions-enterprise-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000121",
    "stripe_price_id": "price_1UZCYwGnuF7uNW2kX1CelFNm"
  },
  {
    "id": "prod_000122",
    "slug": "github-actions-enterprise-pack-professional",
    "name": "GitHub Actions Enterprise Pack Professional",
    "description": "Professional GitHub Actions Enterprise pack — 20 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade GitHub Actions Enterprise — verified, debugged, ready to deploy",
    "tier": "tier-5",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 20,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "GitHub Actions Enterprise Pack Complete Core",
        "slug": "github-actions",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_github actions_health",
          "verify_github actions_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_github actions_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_github actions_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_github actions_health",
      "verify_github actions_replication"
    ],
    "debug_scripts": [
      "debug_github actions_failure",
      "debug_github actions_performance"
    ],
    "provisioning_scripts": [
      "provision_github actions_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/github-actions-enterprise-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000122",
    "stripe_price_id": "price_1UZCYxGnuF7uNW2kv7hi6IGp"
  },
  {
    "id": "prod_000123",
    "slug": "github-actions-enterprise-pack-enterprise",
    "name": "GitHub Actions Enterprise Pack Enterprise",
    "description": "Enterprise GitHub Actions Enterprise platform — the complete 28-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise GitHub Actions Enterprise platform — fleet-wide reliability, team-ready",
    "tier": "tier-5",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "GitHub Actions Enterprise Pack Complete Core",
        "slug": "github-actions",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_github actions_health",
          "verify_github actions_replication",
          "verify_github actions_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_github actions_failure",
          "debug_github actions_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_github actions_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_github actions_health",
      "verify_github actions_replication",
      "verify_github actions_security"
    ],
    "debug_scripts": [
      "debug_github actions_failure",
      "debug_github actions_performance"
    ],
    "provisioning_scripts": [
      "provision_github actions_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/github-actions-enterprise-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000123",
    "stripe_price_id": "price_1UZCYxGnuF7uNW2kum1p2rtW"
  },
  {
    "id": "prod_000124",
    "slug": "argocd-app-of-apps-pack-essentials",
    "name": "ArgoCD + App of Apps Pack Essentials",
    "description": "Essential ArgoCD + App of Apps toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential ArgoCD + App of Apps scripts — get unblocked in minutes",
    "tier": "tier-5",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "ArgoCD + App of Apps Pack Complete Core",
        "slug": "argocd",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_argocd_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_argocd_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_argocd_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_argocd_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/argocd-app-of-apps-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000124",
    "stripe_price_id": "price_1UZCYxGnuF7uNW2kuhSh15Y5"
  },
  {
    "id": "prod_000125",
    "slug": "argocd-app-of-apps-pack-professional",
    "name": "ArgoCD + App of Apps Pack Professional",
    "description": "Professional ArgoCD + App of Apps pack — 20 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade ArgoCD + App of Apps — verified, debugged, ready to deploy",
    "tier": "tier-5",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 20,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "ArgoCD + App of Apps Pack Complete Core",
        "slug": "argocd",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_argocd_health",
          "verify_argocd_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_argocd_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_argocd_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_argocd_health",
      "verify_argocd_replication"
    ],
    "debug_scripts": [
      "debug_argocd_failure",
      "debug_argocd_performance"
    ],
    "provisioning_scripts": [
      "provision_argocd_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/argocd-app-of-apps-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000125",
    "stripe_price_id": "price_1UZCYyGnuF7uNW2kvjcArHWN"
  },
  {
    "id": "prod_000126",
    "slug": "argocd-app-of-apps-pack-enterprise",
    "name": "ArgoCD + App of Apps Pack Enterprise",
    "description": "Enterprise ArgoCD + App of Apps platform — the complete 28-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise ArgoCD + App of Apps platform — fleet-wide reliability, team-ready",
    "tier": "tier-5",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "ArgoCD + App of Apps Pack Complete Core",
        "slug": "argocd",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_argocd_health",
          "verify_argocd_replication",
          "verify_argocd_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_argocd_failure",
          "debug_argocd_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_argocd_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_argocd_health",
      "verify_argocd_replication",
      "verify_argocd_security"
    ],
    "debug_scripts": [
      "debug_argocd_failure",
      "debug_argocd_performance"
    ],
    "provisioning_scripts": [
      "provision_argocd_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/argocd-app-of-apps-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000126",
    "stripe_price_id": "price_1UZCYyGnuF7uNW2kcMKzeZOE"
  },
  {
    "id": "prod_000127",
    "slug": "terraform-opentofu-enterprise-pack-essentials",
    "name": "Terraform/OpenTofu Enterprise Pack Essentials",
    "description": "Essential Terraform/OpenTofu Enterprise toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Terraform/OpenTofu Enterprise scripts — get unblocked in minutes",
    "tier": "tier-5",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Terraform/OpenTofu Enterprise Pack Complete Core",
        "slug": "terraform",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_terraform_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_terraform_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_terraform_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_terraform_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/terraform-opentofu-enterprise-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000127",
    "stripe_price_id": "price_1UZCYyGnuF7uNW2keyN1ZBtQ"
  },
  {
    "id": "prod_000128",
    "slug": "terraform-opentofu-enterprise-pack-professional",
    "name": "Terraform/OpenTofu Enterprise Pack Professional",
    "description": "Professional Terraform/OpenTofu Enterprise pack — 20 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Terraform/OpenTofu Enterprise — verified, debugged, ready to deploy",
    "tier": "tier-5",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 20,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Terraform/OpenTofu Enterprise Pack Complete Core",
        "slug": "terraform",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_terraform_health",
          "verify_terraform_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_terraform_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_terraform_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_terraform_health",
      "verify_terraform_replication"
    ],
    "debug_scripts": [
      "debug_terraform_failure",
      "debug_terraform_performance"
    ],
    "provisioning_scripts": [
      "provision_terraform_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/terraform-opentofu-enterprise-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000128",
    "stripe_price_id": "price_1UZCYzGnuF7uNW2kndem2pp5"
  },
  {
    "id": "prod_000129",
    "slug": "terraform-opentofu-enterprise-pack-enterprise",
    "name": "Terraform/OpenTofu Enterprise Pack Enterprise",
    "description": "Enterprise Terraform/OpenTofu Enterprise platform — the complete 28-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Terraform/OpenTofu Enterprise platform — fleet-wide reliability, team-ready",
    "tier": "tier-5",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Terraform/OpenTofu Enterprise Pack Complete Core",
        "slug": "terraform",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_terraform_health",
          "verify_terraform_replication",
          "verify_terraform_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_terraform_failure",
          "debug_terraform_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_terraform_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_terraform_health",
      "verify_terraform_replication",
      "verify_terraform_security"
    ],
    "debug_scripts": [
      "debug_terraform_failure",
      "debug_terraform_performance"
    ],
    "provisioning_scripts": [
      "provision_terraform_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/terraform-opentofu-enterprise-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000129",
    "stripe_price_id": "price_1UZCYzGnuF7uNW2kLRcE1jCW"
  },
  {
    "id": "prod_000130",
    "slug": "prometheus-grafana-stack-pack-essentials",
    "name": "Prometheus/Grafana Stack Pack Essentials",
    "description": "Essential Prometheus/Grafana Stack toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Prometheus/Grafana Stack scripts — get unblocked in minutes",
    "tier": "tier-5",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Prometheus/Grafana Stack Pack Complete Core",
        "slug": "prometheus-grafana",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_prometheus/grafana_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_prometheus/grafana_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_prometheus/grafana_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_prometheus/grafana_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/prometheus-grafana-stack-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000130",
    "stripe_price_id": "price_1UZCYzGnuF7uNW2kgRWKrJK8"
  },
  {
    "id": "prod_000131",
    "slug": "prometheus-grafana-stack-pack-professional",
    "name": "Prometheus/Grafana Stack Pack Professional",
    "description": "Professional Prometheus/Grafana Stack pack — 20 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Prometheus/Grafana Stack — verified, debugged, ready to deploy",
    "tier": "tier-5",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 20,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Prometheus/Grafana Stack Pack Complete Core",
        "slug": "prometheus-grafana",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_prometheus/grafana_health",
          "verify_prometheus/grafana_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_prometheus/grafana_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_prometheus/grafana_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_prometheus/grafana_health",
      "verify_prometheus/grafana_replication"
    ],
    "debug_scripts": [
      "debug_prometheus/grafana_failure",
      "debug_prometheus/grafana_performance"
    ],
    "provisioning_scripts": [
      "provision_prometheus/grafana_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/prometheus-grafana-stack-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000131",
    "stripe_price_id": "price_1UZCZ0GnuF7uNW2kiAceNEr0"
  },
  {
    "id": "prod_000132",
    "slug": "prometheus-grafana-stack-pack-enterprise",
    "name": "Prometheus/Grafana Stack Pack Enterprise",
    "description": "Enterprise Prometheus/Grafana Stack platform — the complete 28-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Prometheus/Grafana Stack platform — fleet-wide reliability, team-ready",
    "tier": "tier-5",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Prometheus/Grafana Stack Pack Complete Core",
        "slug": "prometheus-grafana",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_prometheus/grafana_health",
          "verify_prometheus/grafana_replication",
          "verify_prometheus/grafana_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_prometheus/grafana_failure",
          "debug_prometheus/grafana_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_prometheus/grafana_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_prometheus/grafana_health",
      "verify_prometheus/grafana_replication",
      "verify_prometheus/grafana_security"
    ],
    "debug_scripts": [
      "debug_prometheus/grafana_failure",
      "debug_prometheus/grafana_performance"
    ],
    "provisioning_scripts": [
      "provision_prometheus/grafana_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/prometheus-grafana-stack-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000132",
    "stripe_price_id": "price_1UZCZ0GnuF7uNW2kgHKADmoJ"
  },
  {
    "id": "prod_000133",
    "slug": "istio-service-mesh-pack-essentials",
    "name": "Istio/Service Mesh Pack Essentials",
    "description": "Essential Istio/Service Mesh toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Istio/Service Mesh scripts — get unblocked in minutes",
    "tier": "tier-5",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Istio/Service Mesh Pack Complete Core",
        "slug": "istio",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_istio_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_istio_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_istio_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_istio_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/istio-service-mesh-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000133",
    "stripe_price_id": "price_1UZCZ0GnuF7uNW2k18hyS6TL"
  },
  {
    "id": "prod_000134",
    "slug": "istio-service-mesh-pack-professional",
    "name": "Istio/Service Mesh Pack Professional",
    "description": "Professional Istio/Service Mesh pack — 20 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Istio/Service Mesh — verified, debugged, ready to deploy",
    "tier": "tier-5",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 20,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Istio/Service Mesh Pack Complete Core",
        "slug": "istio",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_istio_health",
          "verify_istio_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_istio_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_istio_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_istio_health",
      "verify_istio_replication"
    ],
    "debug_scripts": [
      "debug_istio_failure",
      "debug_istio_performance"
    ],
    "provisioning_scripts": [
      "provision_istio_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/istio-service-mesh-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000134",
    "stripe_price_id": "price_1UZCZ1GnuF7uNW2kFnsCSfRc"
  },
  {
    "id": "prod_000135",
    "slug": "istio-service-mesh-pack-enterprise",
    "name": "Istio/Service Mesh Pack Enterprise",
    "description": "Enterprise Istio/Service Mesh platform — the complete 28-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Istio/Service Mesh platform — fleet-wide reliability, team-ready",
    "tier": "tier-5",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Istio/Service Mesh Pack Complete Core",
        "slug": "istio",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_istio_health",
          "verify_istio_replication",
          "verify_istio_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_istio_failure",
          "debug_istio_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_istio_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_istio_health",
      "verify_istio_replication",
      "verify_istio_security"
    ],
    "debug_scripts": [
      "debug_istio_failure",
      "debug_istio_performance"
    ],
    "provisioning_scripts": [
      "provision_istio_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/istio-service-mesh-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000135",
    "stripe_price_id": "price_1UZCZ1GnuF7uNW2klIzVnRR8"
  },
  {
    "id": "prod_000136",
    "slug": "cilium-ebpf-networking-pack-essentials",
    "name": "Cilium/eBPF Networking Pack Essentials",
    "description": "Essential Cilium/eBPF Networking toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Cilium/eBPF Networking scripts — get unblocked in minutes",
    "tier": "tier-5",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Cilium/eBPF Networking Pack Complete Core",
        "slug": "cilium",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_cilium_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_cilium_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_cilium_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_cilium_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/cilium-ebpf-networking-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000136",
    "stripe_price_id": "price_1UZCZ1GnuF7uNW2kZvelVDkP"
  },
  {
    "id": "prod_000137",
    "slug": "cilium-ebpf-networking-pack-professional",
    "name": "Cilium/eBPF Networking Pack Professional",
    "description": "Professional Cilium/eBPF Networking pack — 20 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Cilium/eBPF Networking — verified, debugged, ready to deploy",
    "tier": "tier-5",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 20,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Cilium/eBPF Networking Pack Complete Core",
        "slug": "cilium",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_cilium_health",
          "verify_cilium_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_cilium_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_cilium_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_cilium_health",
      "verify_cilium_replication"
    ],
    "debug_scripts": [
      "debug_cilium_failure",
      "debug_cilium_performance"
    ],
    "provisioning_scripts": [
      "provision_cilium_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/cilium-ebpf-networking-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000137",
    "stripe_price_id": "price_1UZCZ2GnuF7uNW2kAHZRTUKG"
  },
  {
    "id": "prod_000138",
    "slug": "cilium-ebpf-networking-pack-enterprise",
    "name": "Cilium/eBPF Networking Pack Enterprise",
    "description": "Enterprise Cilium/eBPF Networking platform — the complete 28-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Cilium/eBPF Networking platform — fleet-wide reliability, team-ready",
    "tier": "tier-5",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Cilium/eBPF Networking Pack Complete Core",
        "slug": "cilium",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_cilium_health",
          "verify_cilium_replication",
          "verify_cilium_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_cilium_failure",
          "debug_cilium_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_cilium_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_cilium_health",
      "verify_cilium_replication",
      "verify_cilium_security"
    ],
    "debug_scripts": [
      "debug_cilium_failure",
      "debug_cilium_performance"
    ],
    "provisioning_scripts": [
      "provision_cilium_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/cilium-ebpf-networking-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000138",
    "stripe_price_id": "price_1UZCZ2GnuF7uNW2k0CA3GJ9w"
  },
  {
    "id": "prod_000139",
    "slug": "kubevirt-virtualization-pack-essentials",
    "name": "KubeVirt/Virtualization Pack Essentials",
    "description": "Essential KubeVirt/Virtualization toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential KubeVirt/Virtualization scripts — get unblocked in minutes",
    "tier": "tier-5",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "KubeVirt/Virtualization Pack Complete Core",
        "slug": "kubevirt",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_kubevirt_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_kubevirt_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_kubevirt_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_kubevirt_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/kubevirt-virtualization-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000139",
    "stripe_price_id": "price_1UZCZ2GnuF7uNW2k01gCZWo5"
  },
  {
    "id": "prod_000140",
    "slug": "kubevirt-virtualization-pack-professional",
    "name": "KubeVirt/Virtualization Pack Professional",
    "description": "Professional KubeVirt/Virtualization pack — 20 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade KubeVirt/Virtualization — verified, debugged, ready to deploy",
    "tier": "tier-5",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 20,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "KubeVirt/Virtualization Pack Complete Core",
        "slug": "kubevirt",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_kubevirt_health",
          "verify_kubevirt_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_kubevirt_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_kubevirt_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_kubevirt_health",
      "verify_kubevirt_replication"
    ],
    "debug_scripts": [
      "debug_kubevirt_failure",
      "debug_kubevirt_performance"
    ],
    "provisioning_scripts": [
      "provision_kubevirt_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/kubevirt-virtualization-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000140",
    "stripe_price_id": "price_1UZCZ3GnuF7uNW2kNl64zHHH"
  },
  {
    "id": "prod_000141",
    "slug": "kubevirt-virtualization-pack-enterprise",
    "name": "KubeVirt/Virtualization Pack Enterprise",
    "description": "Enterprise KubeVirt/Virtualization platform — the complete 28-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise KubeVirt/Virtualization platform — fleet-wide reliability, team-ready",
    "tier": "tier-5",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "KubeVirt/Virtualization Pack Complete Core",
        "slug": "kubevirt",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_kubevirt_health",
          "verify_kubevirt_replication",
          "verify_kubevirt_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_kubevirt_failure",
          "debug_kubevirt_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_kubevirt_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_kubevirt_health",
      "verify_kubevirt_replication",
      "verify_kubevirt_security"
    ],
    "debug_scripts": [
      "debug_kubevirt_failure",
      "debug_kubevirt_performance"
    ],
    "provisioning_scripts": [
      "provision_kubevirt_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/kubevirt-virtualization-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000141",
    "stripe_price_id": "price_1UZCZ3GnuF7uNW2kLYjmEAVl"
  },
  {
    "id": "prod_000142",
    "slug": "knative-serverless-k8s-pack-essentials",
    "name": "Knative/Serverless K8s Pack Essentials",
    "description": "Essential Knative/Serverless K8s toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Knative/Serverless K8s scripts — get unblocked in minutes",
    "tier": "tier-5",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Knative/Serverless K8s Pack Complete Core",
        "slug": "kubernetes",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_kubernetes_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_kubernetes_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_kubernetes_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_kubernetes_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/knative-serverless-k8s-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000142",
    "stripe_price_id": "price_1UZCZ3GnuF7uNW2kKsy1lQX4"
  },
  {
    "id": "prod_000143",
    "slug": "knative-serverless-k8s-pack-professional",
    "name": "Knative/Serverless K8s Pack Professional",
    "description": "Professional Knative/Serverless K8s pack — 20 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Knative/Serverless K8s — verified, debugged, ready to deploy",
    "tier": "tier-5",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 20,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Knative/Serverless K8s Pack Complete Core",
        "slug": "kubernetes",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_kubernetes_health",
          "verify_kubernetes_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_kubernetes_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_kubernetes_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_kubernetes_health",
      "verify_kubernetes_replication"
    ],
    "debug_scripts": [
      "debug_kubernetes_failure",
      "debug_kubernetes_performance"
    ],
    "provisioning_scripts": [
      "provision_kubernetes_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/knative-serverless-k8s-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000143",
    "stripe_price_id": "price_1UZCZ4GnuF7uNW2knxF6AI8e"
  },
  {
    "id": "prod_000144",
    "slug": "knative-serverless-k8s-pack-enterprise",
    "name": "Knative/Serverless K8s Pack Enterprise",
    "description": "Enterprise Knative/Serverless K8s platform — the complete 28-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Knative/Serverless K8s platform — fleet-wide reliability, team-ready",
    "tier": "tier-5",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Knative/Serverless K8s Pack Complete Core",
        "slug": "kubernetes",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_kubernetes_health",
          "verify_kubernetes_replication",
          "verify_kubernetes_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_kubernetes_failure",
          "debug_kubernetes_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_kubernetes_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_kubernetes_health",
      "verify_kubernetes_replication",
      "verify_kubernetes_security"
    ],
    "debug_scripts": [
      "debug_kubernetes_failure",
      "debug_kubernetes_performance"
    ],
    "provisioning_scripts": [
      "provision_kubernetes_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/knative-serverless-k8s-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000144",
    "stripe_price_id": "price_1UZCZ4GnuF7uNW2kNSAalqpf"
  },
  {
    "id": "prod_000145",
    "slug": "backstage-developer-portal-pack-essentials",
    "name": "Backstage/Developer Portal Pack Essentials",
    "description": "Essential Backstage/Developer Portal toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Backstage/Developer Portal scripts — get unblocked in minutes",
    "tier": "tier-5",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Backstage/Developer Portal Pack Complete Core",
        "slug": "backstage",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_backstage_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_backstage_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_backstage_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_backstage_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/backstage-developer-portal-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000145",
    "stripe_price_id": "price_1UZCZ4GnuF7uNW2kGuqa3rgS"
  },
  {
    "id": "prod_000146",
    "slug": "backstage-developer-portal-pack-professional",
    "name": "Backstage/Developer Portal Pack Professional",
    "description": "Professional Backstage/Developer Portal pack — 20 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Backstage/Developer Portal — verified, debugged, ready to deploy",
    "tier": "tier-5",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 20,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Backstage/Developer Portal Pack Complete Core",
        "slug": "backstage",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_backstage_health",
          "verify_backstage_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_backstage_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_backstage_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_backstage_health",
      "verify_backstage_replication"
    ],
    "debug_scripts": [
      "debug_backstage_failure",
      "debug_backstage_performance"
    ],
    "provisioning_scripts": [
      "provision_backstage_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/backstage-developer-portal-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000146",
    "stripe_price_id": "price_1UZCZ5GnuF7uNW2khOymVOqQ"
  },
  {
    "id": "prod_000147",
    "slug": "backstage-developer-portal-pack-enterprise",
    "name": "Backstage/Developer Portal Pack Enterprise",
    "description": "Enterprise Backstage/Developer Portal platform — the complete 28-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Backstage/Developer Portal platform — fleet-wide reliability, team-ready",
    "tier": "tier-5",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Backstage/Developer Portal Pack Complete Core",
        "slug": "backstage",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_backstage_health",
          "verify_backstage_replication",
          "verify_backstage_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_backstage_failure",
          "debug_backstage_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_backstage_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_backstage_health",
      "verify_backstage_replication",
      "verify_backstage_security"
    ],
    "debug_scripts": [
      "debug_backstage_failure",
      "debug_backstage_performance"
    ],
    "provisioning_scripts": [
      "provision_backstage_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/backstage-developer-portal-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000147",
    "stripe_price_id": "price_1UZCZ5GnuF7uNW2kkfTR7UgZ"
  },
  {
    "id": "prod_000148",
    "slug": "crossplane-control-plane-pack-essentials",
    "name": "Crossplane/Control Plane Pack Essentials",
    "description": "Essential Crossplane/Control Plane toolkit — 11 production-ready terminal automation scripts. Includes 1 verifiers (PASS/FAIL) for instant validation. No debug analyzers, no provisioning — just the core scripts you need to get unblocked today. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Essential Crossplane/Control Plane scripts — get unblocked in minutes",
    "tier": "tier-5",
    "price_cents": 2600,
    "price_usd": 26,
    "currency": "usd",
    "script_count": 11,
    "category_count": 4,
    "verifier_count": 1,
    "debug_count": 0,
    "provisioning_count": 0,
    "categories": [
      {
        "name": "Crossplane/Control Plane Pack Complete Core",
        "slug": "crossplane",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_crossplane_health"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_crossplane_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_crossplane_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_crossplane_health"
    ],
    "debug_scripts": [],
    "provisioning_scripts": [],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/crossplane-control-plane-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "quick-start",
      "core-scripts",
      "individual-contributor"
    ],
    "stripe_product_id": "prod_000148",
    "stripe_price_id": "price_1UZCZ5GnuF7uNW2kosyS54JK"
  },
  {
    "id": "prod_000149",
    "slug": "crossplane-control-plane-pack-professional",
    "name": "Crossplane/Control Plane Pack Professional",
    "description": "Professional Crossplane/Control Plane pack — 20 production-ready automation scripts with 2 verifiers and 2 debug analyzers for root-cause analysis. Includes 1 provisioning smoke tests and CI/CD pipeline snippets (GitHub Actions, GitLab CI). Built for engineers who own reliability in production. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Production-grade Crossplane/Control Plane — verified, debugged, ready to deploy",
    "tier": "tier-5",
    "price_cents": 3700,
    "price_usd": 37,
    "currency": "usd",
    "script_count": 20,
    "category_count": 4,
    "verifier_count": 2,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Crossplane/Control Plane Pack Complete Core",
        "slug": "crossplane",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_crossplane_health",
          "verify_crossplane_replication"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_crossplane_failure"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_crossplane_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_crossplane_health",
      "verify_crossplane_replication"
    ],
    "debug_scripts": [
      "debug_crossplane_failure",
      "debug_crossplane_performance"
    ],
    "provisioning_scripts": [
      "provision_crossplane_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/crossplane-control-plane-pack-complete.zip",
    "active": true,
    "featured": true,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "production-ready",
      "verifiers",
      "debug",
      "ci-cd-snippets"
    ],
    "stripe_product_id": "prod_000149",
    "stripe_price_id": "price_1UZCZ6GnuF7uNW2kdTNziL9t"
  },
  {
    "id": "prod_000150",
    "slug": "crossplane-control-plane-pack-enterprise",
    "name": "Crossplane/Control Plane Pack Enterprise",
    "description": "Enterprise Crossplane/Control Plane platform — the complete 28-script library with 3 verifiers, 2 debug analyzers, and 1 full-lifecycle provisioning tests. Includes CI/CD gate templates (GitHub, GitLab, ArgoCD), team onboarding docs, enterprise runbooks, policy-as-code (OPA/Gatekeeper), and Slack/Teams webhook integrations. Priority email support included. MIT licensed. 30-day money-back guarantee.",
    "tagline": "Enterprise Crossplane/Control Plane platform — fleet-wide reliability, team-ready",
    "tier": "tier-5",
    "price_cents": 6700,
    "price_usd": 67,
    "currency": "usd",
    "script_count": 28,
    "category_count": 4,
    "verifier_count": 3,
    "debug_count": 2,
    "provisioning_count": 1,
    "categories": [
      {
        "name": "Crossplane/Control Plane Pack Complete Core",
        "slug": "crossplane",
        "count": 22,
        "scripts": [],
        "script_count": null
      },
      {
        "name": "Verifiers",
        "slug": "verifiers",
        "count": 3,
        "scripts": [
          "verify_crossplane_health",
          "verify_crossplane_replication",
          "verify_crossplane_security"
        ],
        "script_count": null
      },
      {
        "name": "Debug",
        "slug": "debug",
        "count": 2,
        "scripts": [
          "debug_crossplane_failure",
          "debug_crossplane_performance"
        ],
        "script_count": null
      },
      {
        "name": "Provisioning",
        "slug": "provisioning",
        "count": 1,
        "scripts": [
          "provision_crossplane_verify_teardown"
        ],
        "script_count": null
      }
    ],
    "verifiers": [
      "verify_crossplane_health",
      "verify_crossplane_replication",
      "verify_crossplane_security"
    ],
    "debug_scripts": [
      "debug_crossplane_failure",
      "debug_crossplane_performance"
    ],
    "provisioning_scripts": [
      "provision_crossplane_verify_teardown"
    ],
    "requirements": [
      "bash 4.0+",
      "python3 3.8+",
      "kubectl",
      "psql",
      "redis-cli",
      "helm 3+",
      "kind",
      "shellcheck (optional)",
      "git",
      "argocd or flux",
      "opa",
      "slack-webhook (optional)"
    ],
    "license": "MIT",
    "author": "Chris Stringer",
    "support_email": "chris@syncscript.io",
    "refund_policy": "30-day money-back guarantee",
    "zip_url": "/downloads/crossplane-control-plane-pack-complete.zip",
    "active": true,
    "featured": false,
    "tags": [
      "toolchain",
      "ecosystem",
      "deep-dive",
      "fleet-wide",
      "team-adoption",
      "ci-cd-gates",
      "enterprise-runbooks",
      "policy-as-code"
    ],
    "stripe_product_id": "prod_000150",
    "stripe_price_id": "price_1UZCZ6GnuF7uNW2kNTMt0GnM"
  }
];

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
