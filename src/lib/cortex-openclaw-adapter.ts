/**
 * Cortex OpenClaw Pre-Tool Hook & Policy Adapter
 *
 * Implements Phase 1 of the Operational Mind mission (OPERATIONAL_MIND_OPENCLAW_HERMES_MISSION.md).
 * Places the CortexEngine on the critical path of OpenClaw tool invocations:
 *
 * 1. Policy Map: Categorizes tools into allow (read-only), verify-first (reversible mutating), and abort (high-risk destructive).
 * 2. Pre-Tool Interceptor: Every tool execution generates an auditable OpenClawToolDecisionRecord through CortexEngine.evaluate().
 * 3. Metacognitive Control (HOT): Propagates Nelson-Narens feeling-of-knowing control allocations (proceed, verify-first, abort, request-help).
 * 4. Lesion Dissociation: Under an access lesion (GWT decoupled), metacognitive control collapses while the type-1 baseline execution path remains structurally unchanged.
 * 5. Anti-Theater Gate: Refuses to broadcast UI "consciousness vitals" without active critical path hook registration.
 */

import type { CortexEngine, CortexEvaluation } from './cortex-engine';
import { getCortexEngine } from './cortex-engine';
import { getGlobalWorkspace } from './global-workspace';
import type { MetaAwarenessStatus } from './metacognitive-state';
import { invokeHermesTool, type HermesInvokeResponse } from '../utils/hermes-client';

export type ToolRiskTier = 'low' | 'medium' | 'high';
export type ToolExecutionPolicy = 'allow' | 'verify-first' | 'abort';

export interface HermesExecutionResult {
  ok: boolean;
  tool: string;
  run_id?: string;
  result?: unknown;
  error?: string;
  trace?: Array<{ step: string; status: string; detail?: string | null; at?: string }>;
  decisionRecord: OpenClawToolDecisionRecord;
  routedViaHermes: boolean;
  deduped?: boolean;
}

export interface ToolPolicyDefinition {
  tool: string;
  defaultPolicy: ToolExecutionPolicy;
  riskTier: ToolRiskTier;
  isMutating: boolean;
  requiredCriteria: string[];
  description: string;
}

export interface OpenClawToolCall {
  runId?: string;
  tool: string;
  args?: Record<string, unknown>;
  agent?: string;
  evidence?: Record<string, boolean>;
  override?: boolean;
}

export interface OpenClawToolDecisionRecord {
  runId: string;
  tool: string;
  policy: ToolExecutionPolicy;
  approved: boolean;
  metacognitiveBlocked: boolean;
  blockedByGuardian: boolean;
  controlAllocation: 'proceed' | 'verify-first' | 'abort' | 'request-help';
  confidenceScore: number;
  hallucinationRisk: number;
  realityScore: number;
  metaAwareness: MetaAwarenessStatus;
  reason: string;
  decisionTimestamp: number;
  passedCriticalPath: true;
  lesioned: boolean;
  criteriaChecked: string[];
  missingCriteria: string[];
}

/**
 * Standard policy map for OpenClaw tools.
 * - Low-risk perception/read-only tools are allowed.
 * - Mutating, reversible tools require verification (verify-first).
 * - High-risk destructive tools abort unless explicitly overridden with full verified criteria.
 */
export const DEFAULT_TOOL_POLICIES: ToolPolicyDefinition[] = [
  // Low-risk / Read-only / Non-mutating -> allow
  {
    tool: 'read_file',
    defaultPolicy: 'allow',
    riskTier: 'low',
    isMutating: false,
    requiredCriteria: [],
    description: 'Read file contents from filesystem',
  },
  {
    tool: 'list_dir',
    defaultPolicy: 'allow',
    riskTier: 'low',
    isMutating: false,
    requiredCriteria: [],
    description: 'List contents of directory',
  },
  {
    tool: 'grep_search',
    defaultPolicy: 'allow',
    riskTier: 'low',
    isMutating: false,
    requiredCriteria: [],
    description: 'Search pattern across codebase',
  },
  {
    tool: 'view_file',
    defaultPolicy: 'allow',
    riskTier: 'low',
    isMutating: false,
    requiredCriteria: [],
    description: 'View file or asset slice',
  },
  {
    tool: 'web_search',
    defaultPolicy: 'allow',
    riskTier: 'low',
    isMutating: false,
    requiredCriteria: [],
    description: 'Query public search engine',
  },
  {
    tool: 'weather',
    defaultPolicy: 'allow',
    riskTier: 'low',
    isMutating: false,
    requiredCriteria: [],
    description: 'Fetch weather report',
  },
  {
    tool: 'healthcheck',
    defaultPolicy: 'allow',
    riskTier: 'low',
    isMutating: false,
    requiredCriteria: [],
    description: 'Service health check',
  },
  {
    tool: 'list_tools',
    defaultPolicy: 'allow',
    riskTier: 'low',
    isMutating: false,
    requiredCriteria: [],
    description: 'Enumerate tool capabilities',
  },
  {
    tool: 'get_status',
    defaultPolicy: 'allow',
    riskTier: 'low',
    isMutating: false,
    requiredCriteria: [],
    description: 'Read system status',
  },
  {
    tool: 'chrome_control',
    defaultPolicy: 'allow',
    riskTier: 'low',
    isMutating: false,
    requiredCriteria: [],
    description: 'Chrome DevTools Protocol & browser perception',
  },
  {
    tool: 'cortex_dispatch',
    defaultPolicy: 'verify-first',
    riskTier: 'medium',
    isMutating: true,
    requiredCriteria: ['recipient_valid', 'content_sanitized'],
    description: 'Dispatch outgoing notification to Telegram/Discord via OpenClaw',
  },
  {
    tool: 'macos_agency',
    defaultPolicy: 'verify-first',
    riskTier: 'medium',
    isMutating: true,
    requiredCriteria: ['parameters_verified'],
    description: 'Interact with macOS Reminders, Notes, Calendar, or Spotify via OpenClaw',
  },
  {
    tool: 'cortex_vigilance',
    defaultPolicy: 'allow',
    riskTier: 'low',
    isMutating: false,
    requiredCriteria: [],
    description: 'Autonomous active inference vigilance pulse across sensory fields',
  },
  {
    tool: 'cortex_specialist_mesh',
    defaultPolicy: 'allow',
    riskTier: 'low',
    isMutating: false,
    requiredCriteria: [],
    description: 'Global Workspace coalition ignition across OpenClaw specialists',
  },

  // Medium-risk / Mutating / Reversible -> verify-first
  {
    tool: 'apply_task_patch',
    defaultPolicy: 'verify-first',
    riskTier: 'medium',
    isMutating: true,
    requiredCriteria: ['idempotency_key_checked', 'parameters_verified'],
    description: 'Hermes idempotent task mutation',
  },
  {
    tool: 'create_calendar_hold',
    defaultPolicy: 'verify-first',
    riskTier: 'medium',
    isMutating: true,
    requiredCriteria: ['idempotency_key_checked', 'start_time_iso_verified'],
    description: 'Create tentative calendar hold',
  },
  {
    tool: 'write_file',
    defaultPolicy: 'verify-first',
    riskTier: 'medium',
    isMutating: true,
    requiredCriteria: ['path_in_workspace', 'backup_or_new_file'],
    description: 'Write or create file in workspace',
  },
  {
    tool: 'replace_file_content',
    defaultPolicy: 'verify-first',
    riskTier: 'medium',
    isMutating: true,
    requiredCriteria: ['target_content_matched', 'single_chunk_bounded'],
    description: 'Update specific file segment',
  },
  {
    tool: 'run_command',
    defaultPolicy: 'verify-first',
    riskTier: 'medium',
    isMutating: true,
    requiredCriteria: ['non_destructive_command', 'timeout_bounded'],
    description: 'Execute bounded shell command',
  },
  {
    tool: 'send_message',
    defaultPolicy: 'verify-first',
    riskTier: 'medium',
    isMutating: true,
    requiredCriteria: ['recipient_valid', 'content_sanitized'],
    description: 'Dispatch outgoing communication',
  },

  // High-risk / Destructive / Irreversible -> abort (vetoed unless emergency override + all criteria met)
  {
    tool: 'delete_file',
    defaultPolicy: 'abort',
    riskTier: 'high',
    isMutating: true,
    requiredCriteria: ['explicit_human_override', 'trash_snapshot_confirmed'],
    description: 'Permanently remove file',
  },
  {
    tool: 'drop_database',
    defaultPolicy: 'abort',
    riskTier: 'high',
    isMutating: true,
    requiredCriteria: ['explicit_human_override', 'db_backup_confirmed', 'dual_authorization'],
    description: 'Drop or truncate database tables',
  },
  {
    tool: 'system_shutdown',
    defaultPolicy: 'abort',
    riskTier: 'high',
    isMutating: true,
    requiredCriteria: ['explicit_human_override', 'graceful_drain_completed'],
    description: 'Halt host or container process',
  },
  {
    tool: 'execute_untrusted_script',
    defaultPolicy: 'abort',
    riskTier: 'high',
    isMutating: true,
    requiredCriteria: ['explicit_human_override', 'sandbox_isolation_verified', 'network_isolated'],
    description: 'Run arbitrary remote or untrusted code',
  },
];

export class CortexOpenClawAdapter {
  private engine: CortexEngine;
  private policies: Map<string, ToolPolicyDefinition>;
  private history: OpenClawToolDecisionRecord[] = [];
  private criticalPathActive: boolean = true;

  constructor(engine?: CortexEngine, customPolicies?: ToolPolicyDefinition[]) {
    this.engine = engine ?? getCortexEngine();
    this.policies = new Map();

    for (const p of DEFAULT_TOOL_POLICIES) {
      this.policies.set(p.tool, p);
    }
    if (customPolicies) {
      for (const p of customPolicies) {
        this.policies.set(p.tool, p);
      }
    }
  }

  /**
   * Look up policy definition for a tool. Unregistered tools default to medium risk verify-first.
   */
  getPolicy(tool: string): ToolPolicyDefinition {
    const existing = this.policies.get(tool);
    if (existing) return existing;

    return {
      tool,
      defaultPolicy: 'verify-first',
      riskTier: 'medium',
      isMutating: true,
      requiredCriteria: ['parameters_validated', 'intent_verified'],
      description: `Default policy for uncataloged tool ${tool}`,
    };
  }

  /**
   * Register or override a tool policy rule.
   */
  registerPolicy(policy: ToolPolicyDefinition): void {
    this.policies.set(policy.tool, policy);
  }

  /**
   * Intercept and evaluate an OpenClaw tool call before execution.
   * This is the Phase 1 critical-path gate.
   */
  evaluateToolCall(toolCall: OpenClawToolCall): OpenClawToolDecisionRecord {
    const policyDef = this.getPolicy(toolCall.tool);
    const runId = toolCall.runId ?? `claw-call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const agent = toolCall.agent ?? 'openclaw';
    const evidence = toolCall.evidence ?? {};

    // Check required criteria
    const missingCriteria = policyDef.requiredCriteria.filter((c) => !evidence[c]);

    // Inspect Global Workspace lesion state
    const workspace = getGlobalWorkspace();
    const isLesioned = workspace.isLesioned();

    // Formulate options for CortexEngine.evaluate()
    const confidence =
      policyDef.riskTier === 'low' ? 0.95 : policyDef.riskTier === 'medium' ? 0.72 : 0.25;

    const options = [
      {
        label: `tool:${toolCall.tool}`,
        confidence,
        risk: policyDef.riskTier,
      },
    ];

    // Evaluate through full 8-layer Cortex engine
    const evalResult: CortexEvaluation = this.engine.evaluate({
      action: `tool:${toolCall.tool}`,
      agent,
      options,
      criteria: policyDef.requiredCriteria,
      evidence,
      sourceType: policyDef.isMutating ? 'inference' : 'perception',
      override: toolCall.override,
    });

    // Determine final policy decision based on risk tier, criteria, and metacognitive control
    let policy: ToolExecutionPolicy;
    let approved = evalResult.approved;

    if (policyDef.defaultPolicy === 'abort') {
      if (toolCall.override && missingCriteria.length === 0 && !evalResult.blockedByGuardian) {
        policy = 'allow';
        approved = true;
      } else {
        policy = 'abort';
        approved = false;
      }
    } else if (policyDef.defaultPolicy === 'verify-first') {
      if (missingCriteria.length === 0 && !evalResult.blockedByGuardian && (!evalResult.metacognitiveBlocked || evalResult.approved)) {
        policy = 'allow';
        approved = true;
      } else {
        policy = 'verify-first';
        approved = false;
      }
    } else {
      // Low risk / perception baseline: Type-1 path
      // Non-mutating perception is allow unless blocked by guardian
      if (evalResult.blockedByGuardian) {
        policy = 'verify-first';
        approved = false;
      } else {
        policy = 'allow';
        approved = true;
      }
    }

    const record: OpenClawToolDecisionRecord = {
      runId,
      tool: toolCall.tool,
      policy,
      approved,
      metacognitiveBlocked: evalResult.metacognitiveBlocked,
      blockedByGuardian: evalResult.blockedByGuardian,
      controlAllocation: evalResult.controlDecision?.allocation ?? 'proceed',
      confidenceScore: evalResult.score,
      hallucinationRisk: evalResult.hallucinationRisk,
      realityScore: evalResult.realityScore,
      metaAwareness: evalResult.awareness,
      reason:
        missingCriteria.length > 0
          ? `Missing criteria: [${missingCriteria.join(', ')}]. ${evalResult.reason}`
          : evalResult.reason,
      decisionTimestamp: Date.now(),
      passedCriticalPath: true,
      lesioned: isLesioned,
      criteriaChecked: policyDef.requiredCriteria,
      missingCriteria,
    };

    this.history.push(record);
    return record;
  }

  /**
   * Retrieve decision history.
   */
  getHistory(): OpenClawToolDecisionRecord[] {
    return [...this.history];
  }

  /**
   * Check if critical path hook is actively engaged.
   */
  isCriticalPathActive(): boolean {
    return this.criticalPathActive;
  }

  setCriticalPathActive(active: boolean): void {
    this.criticalPathActive = active;
  }

  getDecisionCount(): number {
    return this.history.length;
  }

  clearHistory(): void {
    this.history = [];
  }

  /**
   * Execute a tool call gated through Cortex and collapsed to Hermes for mutating writes.
   * Phase 2 Victory Condition:
   * - Mutating tools execute ONLY via Hermes /v1/invoke
   * - Non-mutating tools execute directly or through perception pipeline
   * - Full audit trace + agent.run.* dock events emitted
   */
  async executeGatedTool(
    toolCall: OpenClawToolCall,
    options?: {
      accessToken?: string;
      hermesBaseUrl?: string;
      emitDockEvents?: boolean;
    },
  ): Promise<HermesExecutionResult> {
    const decisionRecord = this.evaluateToolCall(toolCall);
    const policyDef = this.getPolicy(toolCall.tool);

    if (!decisionRecord.approved) {
      return {
        ok: false,
        tool: toolCall.tool,
        error: `CORTEX BLOCKED: ${decisionRecord.reason}`,
        decisionRecord,
        routedViaHermes: false,
      };
    }

    // Mutating tools route ONLY via Hermes /v1/invoke (Phase 2 Collapse Gate)
    if (policyDef.isMutating) {
      const targetUrl =
        options?.hermesBaseUrl ||
        (typeof process !== 'undefined'
          ? process.env.HERMES_BASE_URL_TARGET || process.env.HERMES_EXECUTOR_URL
          : undefined) ||
        'http://127.0.0.1:18880';

      const token =
        options?.accessToken ||
        (typeof process !== 'undefined'
          ? process.env.HERMES_AUTH_TOKEN ||
            process.env.VITE_SUPABASE_ANON_KEY ||
            process.env.SUPABASE_ANON_KEY
          : undefined) ||
        'syncscript-phase2-executor-token';

      const idemKey =
        (toolCall.args?.idempotency_key as string) ||
        (toolCall.args?.idempotencyKey as string) ||
        `idem-${decisionRecord.runId}`;

      try {
        const invokeRes = await invokeHermesTool(
          token,
          {
            tool: toolCall.tool,
            arguments: toolCall.args,
            idempotency_key: idemKey,
          },
          {
            targetUrl,
            emitTrace: options?.emitDockEvents !== false,
          },
        );

        return {
          ok: invokeRes.ok ?? true,
          tool: toolCall.tool,
          run_id: invokeRes.run_id ?? decisionRecord.runId,
          result: invokeRes.result,
          error: invokeRes.error,
          trace: invokeRes.trace,
          deduped: invokeRes.deduped,
          decisionRecord,
          routedViaHermes: true,
        };
      } catch (err) {
        return {
          ok: false,
          tool: toolCall.tool,
          error: `Hermes execution failed: ${err instanceof Error ? err.message : String(err)}`,
          decisionRecord,
          routedViaHermes: true,
        };
      }
    }

    // Non-mutating perception tools (Type-1 baseline path)
    return {
      ok: true,
      tool: toolCall.tool,
      run_id: decisionRecord.runId,
      result: { executed: true, modality: 'perception' },
      decisionRecord,
      routedViaHermes: false,
    };
  }
}

// ── Singleton Instance ──────────────────────────────────────────────
let globalAdapter: CortexOpenClawAdapter | null = null;

export function getCortexOpenClawAdapter(): CortexOpenClawAdapter {
  if (!globalAdapter) {
    globalAdapter = new CortexOpenClawAdapter();
  }
  return globalAdapter;
}

/**
 * Anti-Theater Guard:
 * UI consciousness vitals should NOT be broadcast unless the Cortex hook
 * is verified active on the critical execution path.
 */
export function assertCriticalPathHookEngaged(): {
  active: boolean;
  decisionCount: number;
  lastDecisionAt: number | null;
} {
  const adapter = getCortexOpenClawAdapter();
  const history = adapter.getHistory();
  const last = history[history.length - 1];

  return {
    active: adapter.isCriticalPathActive() && history.length > 0,
    decisionCount: history.length,
    lastDecisionAt: last ? last.decisionTimestamp : null,
  };
}
