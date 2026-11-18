/**
 * Cortex Agent Runtime — shared contracts.
 *
 * Server-side multi-agent workforce: specialized workers (Model Sentinel,
 * Scout, Librarian, Builder) running inside the vite dev process, routed
 * through the model matrix, surfaced live on the visualizer Agents tab.
 *
 * Honesty invariant: every status field traces to a real runtime event.
 * A task is 'completed' only when the worker returns a result object —
 * never inferred from elapsed time.
 */

// Widened: spawned agents get dynamic ids (`spawn-<n>`).
// The literals remain the built-ins; `(string & {})` keeps autocomplete for them.
export type AgentId = 'antigravity' | 'sentinel' | 'scout' | 'librarian' | 'builder' | 'devin' | 'claudecode' | 'openclaw' | 'hermes' | 'curator' | 'reviewer' | 'runner' | 'distributor' | 'warden' | 'prep' | 'forecaster' | 'strategist' | 'brief' | 'debrief' | (string & {});

export type { AgentContext, WorkerHandler } from './runtime';

export type AgentStatus =
  | 'offline'   // never heartbeated or heartbeat stale
  | 'idle'      // alive, no active task
  | 'working'   // executing a task
  | 'error'     // last task failed / internal fault
  | 'cooldown'  // self-throttled (budget, backoff)
  | 'retired';  // spawned agent past TTL / revoked — audit record only

export type TaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'vetoed'    // governor/initiative gate refused execution
  | 'cancelled';

export type RouteTier = 'fast' | 'reason' | 'deep';

export type TaskFailureClass = 'provider' | 'timeout' | 'budget' | 'policy' | 'worker' | 'unknown';

/**
 * Per-task instrumentation (agent-eval discipline): every completed or
 * failed task carries enough telemetry to compute success rate, token
 * cost, tool-call volume, and failure class — not just a status string.
 * All fields are counts/ms observed at runtime; nothing is estimated.
 */
export interface TaskTelemetry {
  llmCalls: number;
  tokensIn: number;
  tokensOut: number;
  /** Total wall-clock ms spent inside LLM bridge calls. */
  llmMs: number;
  toolCalls: number;
  toolFailures: number;
  /** startedAt→finishedAt, set when the task reaches a terminal state. */
  durationMs?: number;
  /** Deterministic classification of the failure, set on 'failed'. */
  failureClass?: TaskFailureClass;
}

export interface AgentTask {
  id: string;
  agentId: AgentId;
  kind: string;
  title: string;
  input: Record<string, unknown>;
  status: TaskStatus;
  /** 0-1 worker-reported progress; null until the worker reports one. */
  progress: number | null;
  /** Model actually used, once the worker's LLM call resolves. */
  model?: string;
  result?: unknown;
  error?: string;
  telemetry?: TaskTelemetry;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

/** Fleet tier: 'standard' agents render as moons on the inner orbit;
 *  'enterprise' agents render as satellites on the outer orbital deck. */
export type AgentTier = 'standard' | 'enterprise';

export interface AgentState {
  id: AgentId;
  name: string;
  role: string;
  /** Fleet tier — visual + governance class. Absent = 'standard'. */
  tier?: AgentTier;
  /** Short role descriptor shown on task windows. */
  blurb: string;
  status: AgentStatus;
  currentTaskId: string | null;
  /** Tasks this agent may run concurrently (default 1). */
  concurrency: number;
  /** Max tasks per UTC day — restraint budget. */
  dailyBudget: number;
  modelPin: { tier: RouteTier; excludeProviders?: string[] } | null;
  /** Present only on self-created agents — the birth certificate. */
  spawnSpec?: SpawnSpec;
  spawnedAt?: number;
  lastHeartbeatAt: number | null;
  tasksCompleted: number;
  tasksFailed: number;
  /** Recent task ids, newest last (bounded). */
  recentTaskIds: string[];
}

export type ModelHealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface ModelHealth {
  /** Provider-native model id, e.g. 'nvidia/nemotron-3-ultra-550b-a55b'. */
  id: string;
  provider: string;
  /** Which route tiers this model is nominated for. */
  tierFit: RouteTier[];
  status: ModelHealthStatus;
  /** Smoothed probe latency; null until first successful probe. */
  latencyMsP50: number | null;
  lastCheckAt: number | null;
  consecutiveFailures: number;
  cooldownUntil: number | null;
  /** Where this entry came from: seed matrix, NIM catalog, or probe discovery. */
  source: 'matrix' | 'catalog' | 'probe';
}

// ── Self-creating agents (CORTEX_AGENTS_SELF.md) ──────────────────

export type ToolScope = 'read' | 'write' | 'exec' | 'surface';

export interface SpawnSpec {
  callSign: string;
  role: string;
  mission: string;
  parentAgentId?: string;
  tools: ToolScope[];
  modelPin: { tier: RouteTier; excludeProviders?: string[] };
  dataScopes: string[];
  dailyBudget: number;
  ttlHours: number;
  maxTasksTotal?: number;
  systemBrief: string;
  doneCriteria: string;
}

export interface SpawnProposal {
  id: string;
  spec: SpawnSpec;
  /** Evidence refs the gate re-derives: task ids / counts it claims. */
  evidence: { kind: string; refs: string[]; summary: string }[];
  proposedBy: string;
  status: 'pending' | 'approved' | 'rejected' | 'spawned' | 'expired';
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
  agentId?: string; // set once spawned
  rejectionReason?: string;
}

export type AgentEvent =
  | { type: 'agent.status'; agentId: AgentId; status: AgentStatus; at: number }
  | { type: 'task.transition'; task: AgentTask; at: number }
  | { type: 'task.progress'; taskId: string; progress: number; at: number }
  | { type: 'model.health'; model: ModelHealth; at: number }
  | { type: 'model.discovered'; model: ModelHealth; at: number }
  | { type: 'matrix.changed'; tier: RouteTier; candidates: string[]; at: number }
  | { type: 'agent.spawn_proposed'; proposal: SpawnProposal; at: number }
  | { type: 'agent.spawned'; agentId: string; spec: SpawnSpec; at: number }
  | { type: 'agent.retired'; agentId: string; reason: string; at: number }
  | {
      type: 'warden.patrol';
      report: {
        at: number; healthy: boolean;
        anomalies: string[]; warnings: string[];
        checks: { name: string; ok: boolean; ms: number }[];
      };
      at: number;
    }
  | {
      type: 'agent.comm';
      from: AgentId;
      to: AgentId | 'cortex' | 'all';
      channel: 'directive' | 'telemetry' | 'quantum_resonance' | 'consensus';
      message: string;
      at: number;
    }
  | { type: 'runtime.snapshot'; at: number };

/**
 * A recurring agent assignment — the Paperclip "routines" primitive.
 * Interval-based (every N minutes) rather than cron: covers scan cycles,
 * daily reports, and patrols without a cron parser. Each fire submits a
 * normal AgentTask, so budgets, telemetry, and governance all apply.
 */
export interface AgentRoutine {
  id: string;
  agentId: AgentId;
  kind: string;
  title: string;
  input: Record<string, unknown>;
  /** Fire interval in minutes (min 15 — routines are not hot loops). */
  everyMinutes: number;
  enabled: boolean;
  createdAt: number;
  lastRunAt: number | null;
  nextRunAt: number;
  runCount: number;
}

export interface AgentsSnapshot {
  agents: AgentState[];
  models: ModelHealth[];
  tasks: AgentTask[];
  matrix: Record<RouteTier, string[]>;
  /** Pending/spawned self-creation proposals (spec: CORTEX_AGENTS_SELF.md). */
  proposals?: SpawnProposal[];
  routines?: AgentRoutine[];
  runtime: {
    startedAt: number;
    eventCount: number;
    /** Aggregate telemetry across retained tasks — TSR/cost at a glance. */
    totals?: {
      tasks: number; completed: number; failed: number;
      tokensIn: number; tokensOut: number; toolCalls: number;
    };
  };
}
