/**
 * Cortex API Routes — Hosted Trust Layer for AI Agents
 *
 * These routes expose the CortexEngine as a REST API so that
 * any AI agent (in any language) can call POST /cortex/evaluate
 * before taking an irreversible action.
 *
 * Endpoints:
 *   POST /cortex/evaluate   — Evaluate an action through the 8-layer engine
 *   GET  /cortex/status     — Get current consciousness vitals
 *   POST /cortex/veto       — Propose an architecture change
 *   POST /cortex/veto/approve — Approve a pending proposal (human only)
 *   GET  /cortex/veto       — List pending proposals
 *   GET  /cortex/constitution — Get current guarded parameters
 *
 * Pricing tiers (enforced via API key):
 *   Free:    100 evaluations/day
 *   Starter: 10,000 evaluations/day ($49/month)
 *   Pro:     Unlimited ($499/month)
 *   Enterprise: Custom ($5K-50K/month)
 */

import type { CortexEngine, CortexEvaluation, CortexStatus, CortexEngineConfig } from './cortex-engine';
import { getCortexEngine } from './cortex-engine';
import { getVetoLedger, type VetoProposal } from './veto-ledger';
import {
  getCortexOpenClawAdapter,
  assertCriticalPathHookEngaged,
  type OpenClawToolCall,
  type OpenClawToolDecisionRecord,
  type HermesExecutionResult,
} from './cortex-openclaw-adapter';

// ── Types ──────────────────────────────────────────────────────────

/** Request body for POST /cortex/evaluate */
export interface EvaluateRequest {
  /** What action is being evaluated */
  action: string;
  /** Which agent is requesting */
  agent: string;
  /** Available options/strategies */
  options: Array<{
    label: string;
    confidence: number;
    risk: 'low' | 'medium' | 'high';
  }>;
  /** Acceptance criteria */
  criteria: string[];
  /** Evidence that criteria are met */
  evidence: Record<string, boolean>;
  /** Epistemic source type */
  sourceType?: 'perception' | 'inference' | 'memory' | 'generation' | 'consensus' | 'override';
  /** Emergency override */
  override?: boolean;
}

/** Request body for POST /cortex/veto */
export interface VetoProposalRequest {
  description: string;
  reason: string;
  currentValue: string;
  proposedValue: string;
  impact?: 'low' | 'medium' | 'high';
}

/** Request body for POST /cortex/veto/approve */
export interface VetoApprovalRequest {
  proposalId: string;
  approvedBy: string;
}

/** Standard API response wrapper */
export interface CortexApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// ── Rate Limiting ──────────────────────────────────────────────────

const DAILY_LIMITS: Record<string, number> = {
  free: 100,
  starter: 10_000,
  pro: Infinity,
  enterprise: Infinity,
};

const usageCounts = new Map<string, { date: string; count: number }>();

function checkRateLimit(apiKey: string, tier: string): { allowed: boolean; remaining: number } {
  const limit = DAILY_LIMITS[tier] ?? 100;
  const today = new Date().toISOString().split('T')[0];
  const usage = usageCounts.get(apiKey);

  if (!usage || usage.date !== today) {
    usageCounts.set(apiKey, { date: today, count: 1 });
    return { allowed: true, remaining: limit - 1 };
  }

  if (usage.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  usage.count++;
  return { allowed: true, remaining: limit - usage.count };
}

// ── API Key Resolution ─────────────────────────────────────────────

function resolveTier(apiKey: string | undefined): string {
  if (!apiKey) return 'free';
  // In production, this would look up the API key in a database
  // For now, use a simple prefix convention
  if (apiKey.startsWith('cortex_pro_')) return 'pro';
  if (apiKey.startsWith('cortex_starter_')) return 'starter';
  if (apiKey.startsWith('cortex_enterprise_')) return 'enterprise';
  return 'free';
}

// ── Route Handler Factory ──────────────────────────────────────────

/**
 * Create Cortex API route handlers.
 * Designed to work with Hono but can be adapted to any framework.
 *
 * Usage with Hono:
 *   const cortexRoutes = createCortexRoutes();
 *   app.post('/cortex/evaluate', cortexRoutes.evaluate);
 *   app.get('/cortex/status', cortexRoutes.status);
 */
export function createCortexRoutes(engine?: CortexEngine) {
  const cortex = engine ?? getCortexEngine();

  return {
    /**
     * POST /cortex/evaluate
     * Evaluate an action through the 8-layer Cortex engine.
     * This IS the trust layer — the core product.
     */
    async evaluate(request: { json: () => Promise<unknown>; header: (name: string) => string | undefined }): Promise<CortexApiResponse<CortexEvaluation>> {
      try {
        const apiKey = request.header('x-cortex-api-key') ?? request.header('authorization')?.replace('Bearer ', '');
        const tier = resolveTier(apiKey);
        const { allowed, remaining } = checkRateLimit(apiKey ?? 'anonymous', tier);

        if (!allowed) {
          return {
            success: false,
            error: `Rate limit exceeded (${tier} tier). Upgrade at cortex.sh/pricing`,
            timestamp: Date.now(),
          };
        }

        const body = await request.json() as EvaluateRequest;

        // Validate required fields
        if (!body.action || !body.agent || !body.options || !body.criteria) {
          return {
            success: false,
            error: 'Missing required fields: action, agent, options, criteria',
            timestamp: Date.now(),
          };
        }

        const result = cortex.evaluate({
          action: body.action,
          agent: body.agent,
          options: body.options,
          criteria: body.criteria,
          evidence: body.evidence ?? {},
          sourceType: body.sourceType,
          override: body.override,
        });

        return {
          success: true,
          data: result,
          timestamp: Date.now(),
        };
      } catch (e) {
        return {
          success: false,
          error: `Internal error: ${e instanceof Error ? e.message : 'unknown'}`,
          timestamp: Date.now(),
        };
      }
    },

    /**
     * POST /cortex/openclaw/pre-tool
     * Phase 1 Critical Path Hook: Intercept and gate OpenClaw tool execution.
     * Evaluates tool against policy map, GWT salience, and HOT metacognitive control.
     */
    async openclawPreTool(request: { json: () => Promise<unknown>; header: (name: string) => string | undefined }): Promise<CortexApiResponse<OpenClawToolDecisionRecord>> {
      try {
        const body = (await request.json()) as OpenClawToolCall;
        if (!body.tool) {
          return {
            success: false,
            error: 'Missing required field: tool',
            timestamp: Date.now(),
          };
        }

        const adapter = getCortexOpenClawAdapter();
        const record = adapter.evaluateToolCall(body);

        return {
          success: true,
          data: record,
          timestamp: Date.now(),
        };
      } catch (e) {
        return {
          success: false,
          error: `OpenClaw pre-tool evaluation error: ${e instanceof Error ? e.message : 'unknown'}`,
          timestamp: Date.now(),
        };
      }
    },

    /**
     * POST /cortex/openclaw/invoke
     * Phase 2 Hermes Collapse Gate: Gated execution that collapses mutating tool
     * invocations through Hermes /v1/invoke with full audit trace and dock events.
     */
    async openclawInvoke(request: { json: () => Promise<unknown>; header: (name: string) => string | undefined }): Promise<CortexApiResponse<HermesExecutionResult>> {
      try {
        const body = (await request.json()) as OpenClawToolCall;
        if (!body.tool) {
          return {
            success: false,
            error: 'Missing required field: tool',
            timestamp: Date.now(),
          };
        }

        const authHeader = request.header('authorization') || request.header('x-hermes-token');
        const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : undefined;
        const targetUrl = request.header('x-hermes-base-url');

        const adapter = getCortexOpenClawAdapter();
        const result = await adapter.executeGatedTool(body, {
          accessToken: token,
          hermesBaseUrl: targetUrl,
        });

        return {
          success: result.routedViaHermes ? Boolean(result.run_id) : result.ok,
          data: result,
          error: result.ok ? undefined : result.error,
          timestamp: Date.now(),
        };
      } catch (e) {
        return {
          success: false,
          error: `OpenClaw invoke execution error: ${e instanceof Error ? e.message : 'unknown'}`,
          timestamp: Date.now(),
        };
      }
    },

    /**
     * GET /cortex/status
     * Get the current consciousness vitals.
     * Stamped with critical-path hook verification (anti-theater standard).
     */
    status(): CortexApiResponse<CortexStatus & { criticalPathActive: boolean; criticalPathDecisions: number }> {
      const hook = assertCriticalPathHookEngaged();
      const status = cortex.getStatus();
      return {
        success: true,
        data: {
          ...status,
          criticalPathActive: hook.active,
          criticalPathDecisions: hook.decisionCount,
        },
        timestamp: Date.now(),
      };
    },

    /**
     * POST /cortex/veto
     * Propose an architecture change.
     * The system appends — it cannot approve.
     */
    async veto(request: { json: () => Promise<unknown> }): Promise<CortexApiResponse<{ proposalId: string }>> {
      try {
        const body = await request.json() as VetoProposalRequest;

        if (!body.description || !body.reason || !body.currentValue || !body.proposedValue) {
          return {
            success: false,
            error: 'Missing required fields: description, reason, currentValue, proposedValue',
            timestamp: Date.now(),
          };
        }

        const proposalId = cortex.proposeArchitectureChange({
          description: body.description,
          reason: body.reason,
          currentValue: body.currentValue,
          proposedValue: body.proposedValue,
          impact: body.impact,
        });

        return {
          success: true,
          data: { proposalId },
          timestamp: Date.now(),
        };
      } catch (e) {
        return {
          success: false,
          error: `Internal error: ${e instanceof Error ? e.message : 'unknown'}`,
          timestamp: Date.now(),
        };
      }
    },

    /**
     * POST /cortex/veto/approve
     * Approve a pending VETO proposal. HUMANS ONLY.
     */
    async vetoApprove(request: { json: () => Promise<unknown> }): Promise<CortexApiResponse<{ approved: boolean }>> {
      try {
        const body = await request.json() as VetoApprovalRequest;

        if (!body.proposalId || !body.approvedBy) {
          return {
            success: false,
            error: 'Missing required fields: proposalId, approvedBy',
            timestamp: Date.now(),
          };
        }

        const approved = cortex.approveArchitectureChange(body.proposalId, body.approvedBy);

        return {
          success: true,
          data: { approved },
          timestamp: Date.now(),
        };
      } catch (e) {
        return {
          success: false,
          error: `Internal error: ${e instanceof Error ? e.message : 'unknown'}`,
          timestamp: Date.now(),
        };
      }
    },

    /**
     * GET /cortex/veto
     * List pending proposals.
     */
    vetoList(): CortexApiResponse<VetoProposal[]> {
      const veto = getVetoLedger();
      return {
        success: true,
        data: veto.getPending(),
        timestamp: Date.now(),
      };
    },

    /**
     * GET /cortex/constitution
     * Get current guarded parameters.
     */
    constitution(): CortexApiResponse<Array<{ parameter: string; value: number }>> {
      const veto = getVetoLedger();
      return {
        success: true,
        data: veto.getGuardedParameters(),
        timestamp: Date.now(),
      };
    },
  };
}
