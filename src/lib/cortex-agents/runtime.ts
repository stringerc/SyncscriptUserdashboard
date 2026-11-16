/**
 * Cortex Agent Runtime — singleton workforce manager.
 *
 * Owns: agent registry, per-agent task queues, global concurrency cap,
 * daily task budgets (restraint), heartbeat/staleness tracking, the
 * event ring buffer that feeds the SSE stream and Agents tab snapshot.
 *
 * Workers are plain async handlers registered by workers.ts. A task is
 * 'completed' only when its handler returns — status is never inferred.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ModelMatrix, type AgentPin } from './registry';
import { ModelSentinel } from './sentinel';
import type {
  AgentEvent, AgentId, AgentRoutine, AgentState, AgentStatus, AgentTask, AgentsSnapshot, SpawnProposal, SpawnSpec, TaskFailureClass, TaskStatus, TaskTelemetry,
} from './types';

export interface AgentContext {
  task: AgentTask;
  /** Report 0-1 progress; emits task.progress events. */
  progress(p: number): void;
  /** Matrix-routed LLM completion (calls the /api/cortex/agents/llm endpoint). */
  llm(opts: { tier?: 'fast' | 'reason' | 'deep'; model?: string; messages: { role: string; content: string }[]; maxTokens?: number }): Promise<string>;
  /** Emit a custom event onto the bus (e.g. worker-specific telemetry). */
  emit(e: AgentEvent): void;
  signal: AbortSignal;
  /** Live instrumentation counters — workers pass this to toolExecute. */
  telemetry: TaskTelemetry;
}

export type WorkerHandler = (ctx: AgentContext) => Promise<unknown>;

export interface AgentSpec {
  id: AgentId;
  name: string;
  role: string;
  blurb: string;
  concurrency: number;
  dailyBudget: number;
  modelPin: AgentPin | null;
  /** 'enterprise' = revenue/production fleet — satellite visuals, stricter review. */
  tier?: 'standard' | 'enterprise';
}

export const AGENT_SPECS: AgentSpec[] = [
  {
    id: 'sentinel',
    name: 'SENTINEL',
    role: 'Model Warden',
    blurb: 'Watches every provider catalog and probes model health so routing never dies on a stale model.',
    concurrency: 1,
    dailyBudget: 96, // mostly probe cycles, cheap
    // Bootstrap safety: sentinel's own LLM work never routes through NIM —
    // the models it monitors must not be able to silence the monitor.
    modelPin: { tier: 'fast', excludeProviders: ['nvidia-nim', 'nvidia-nim-550b'] },
  },
  {
    id: 'scout',
    name: 'SCOUT',
    role: 'Research Operative',
    blurb: 'Web research, docs, competitive scans — deep-work parallel investigations.',
    concurrency: 2,
    dailyBudget: 24,
    modelPin: { tier: 'reason' },
  },
  {
    id: 'librarian',
    name: 'LIBRARIAN',
    role: 'Memory Keeper',
    blurb: 'Recall, knowledge-graph queries, vault sync, episodic continuity.',
    concurrency: 1,
    dailyBudget: 48,
    modelPin: { tier: 'fast' },
  },
  {
    id: 'builder',
    name: 'BUILDER',
    role: 'Engineering Operative',
    blurb: 'Code tasks through governed tools only — tier-2 actions become proposals, never silent execution.',
    concurrency: 1,
    dailyBudget: 16,
    modelPin: { tier: 'reason' },
  },
  {
    id: 'reviewer',
    name: 'REVIEWER',
    role: 'Code Critic',
    blurb: 'Read-only diff and file review — returns prioritized findings, never edits. The context firewall for verbose code.',
    concurrency: 1,
    dailyBudget: 24,
    modelPin: { tier: 'reason' },
  },
  {
    id: 'runner',
    name: 'RUNNER',
    role: 'Exec Operative',
    blurb: 'Runs commands and tests, returns distilled results — verbose output stays quarantined server-side.',
    concurrency: 2,
    dailyBudget: 48,
    modelPin: { tier: 'fast' },
  },
  {
    id: 'distributor',
    name: 'DISTRIBUTOR',
    role: 'Revenue Operative',
    blurb: 'Runs the Gumroad distribution engine — Pinterest pins, Reddit participation, Dreamina assets, calendar cadence — every action verified before it counts.',
    concurrency: 1,
    dailyBudget: 64,
    modelPin: { tier: 'fast' },
    tier: 'enterprise',
  },
  {
    id: 'prep',
    name: 'PREP',
    role: 'Meeting Ready-Writer',
    blurb: 'Builds cited prep briefs before meetings — attendee history, open items, suggested agenda — local artifacts only, every claim sourced.',
    concurrency: 1,
    dailyBudget: 16,
    modelPin: { tier: 'reason' },
  },
  {
    id: 'forecaster',
    name: 'FORECASTER',
    role: 'Anticipator',
    blurb: 'Predicts forming states across calendar, weather, build, fleet, comms and distribution — evidence-cited, tiered alerts, silence over vibes.',
    concurrency: 1,
    dailyBudget: 32,
    modelPin: { tier: 'reason' },
  },
  {
    id: 'strategist',
    name: 'STRATEGIST',
    role: 'Fleet Synthesist',
    blurb: 'Consumes the task archive, outcomes and rules inventory — clusters failures, ranks interventions, files governed proposals. Proposes; never applies.',
    concurrency: 1,
    dailyBudget: 24,
    modelPin: { tier: 'reason' },
  },
  {
    id: 'warden',
    name: 'WARDEN',
    role: 'Systems Custodian',
    blurb: 'Read-only patrol of Cortex itself — probes runtime, SSE, model matrix, tools, persistence, and ledger; reports anomalies, never repairs.',
    concurrency: 1,
    dailyBudget: 160, // ~10-min patrol cadence + manual runs
    modelPin: { tier: 'fast' },
  },
  {
    id: 'devin',
    name: 'DEVIN',
    role: 'Principal Architect',
    blurb: 'The deep-tier pair-programmer — plans, executes through governed tools, then verifies its own work and repairs failures before reporting. Claims only what evidence shows.',
    concurrency: 1,
    dailyBudget: 12, // deep lane is the expensive tier — small cap, high signal
    modelPin: { tier: 'deep' },
    tier: 'enterprise',
  },
];

const GLOBAL_CONCURRENCY = 4;
const EVENT_BUFFER_MAX = 500;
const TASK_HISTORY_MAX = 8;
const RUNTIME_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const STATE_FILE = path.join(RUNTIME_DIR, 'agents-state.json');
const REGISTRY_FILE = path.join(RUNTIME_DIR, 'model-registry.json');

let taskCounter = 0;
const newTaskId = () => `task-${Date.now().toString(36)}-${(++taskCounter).toString(36)}`;

/**
 * Deterministic failure taxonomy — turns raw error strings into classes the
 * learning loop and eval metrics can aggregate. Order matters: specific
 * patterns before the generic 'worker' catch-all.
 */
function classifyFailure(msg: string): TaskFailureClass {
  if (/cancel|abort/i.test(msg)) return 'unknown'; // cancellations never reach 'failed'
  if (/budget|daily limit/i.test(msg)) return 'budget';
  if (/timed?\s?out|timeout|deadline/i.test(msg)) return 'timeout';
  if (/http \d|provider|empty content|no usable|bridge|econn|enotfound|fetch failed|rate.?limit/i.test(msg)) return 'provider';
  if (/veto|scope|not allowed|permission|forbidden|policy/i.test(msg)) return 'policy';
  return 'worker';
}

export class AgentRuntime {
  readonly matrix = new ModelMatrix();
  private agents = new Map<AgentId, AgentState>();
  private tasks = new Map<string, AgentTask>();
  private queues = new Map<AgentId, AgentTask[]>();
  private running = new Map<string, AbortController>();
  private handlers = new Map<AgentId, WorkerHandler>();
  private events: AgentEvent[] = [];
  private listeners = new Set<(e: AgentEvent) => void>();
  private sentinel: ModelSentinel | null = null;
  private sweeper: ReturnType<typeof setInterval> | null = null;
  private startedAt = Date.now();
  private llmBridge: ((opts: { tier?: 'fast' | 'reason' | 'deep'; agentId?: AgentId; model?: string; messages: { role: string; content: string }[]; maxTokens?: number }) => Promise<{ content: string; model?: string; usage?: { tokensIn?: number; tokensOut?: number } }>) | null = null;
  private spawnWorkerFactory: ((spec: SpawnSpec) => WorkerHandler) | null = null;
  private onTaskCompleted: ((task: AgentTask, agent: AgentState) => void) | null = null;
  private onTaskFinished: ((task: AgentTask, agent: AgentState | undefined) => void) | null = null;
  private proposals = new Map<string, SpawnProposal>();
  private spawnCounter = 0;
  private routines = new Map<string, AgentRoutine>();
  private routineCounter = 0;
  private stopped = false;

  constructor() {
    for (const spec of AGENT_SPECS) {
      this.agents.set(spec.id, {
        id: spec.id,
        name: spec.name,
        role: spec.role,
        blurb: spec.blurb,
        status: 'offline',
        currentTaskId: null,
        concurrency: spec.concurrency,
        dailyBudget: spec.dailyBudget,
        modelPin: spec.modelPin,
        tier: spec.tier || 'standard',
        lastHeartbeatAt: null,
        tasksCompleted: 0,
        tasksFailed: 0,
        recentTaskIds: [],
      });
      this.queues.set(spec.id, []);
    }
    this.loadSnapshot();
  }

  /** vite.config wires the actual LLM endpoint here once middleware mounts. */
  setLLMBridge(fn: (opts: { tier?: 'fast' | 'reason' | 'deep'; agentId?: AgentId; model?: string; messages: { role: string; content: string }[]; maxTokens?: number }) => Promise<{ content: string; model?: string; usage?: { tokensIn?: number; tokensOut?: number } }>) { this.llmBridge = fn; }

  /** vite.config wires the ephemeral worker factory (workers.ts). */
  setSpawnWorkerFactory(fn: (spec: SpawnSpec) => WorkerHandler) {
    this.spawnWorkerFactory = fn;
    // Restored spawned agents get their worker handlers here — the factory
    // arrives after loadSnapshot ran in the constructor.
    for (const agent of this.agents.values()) {
      if (agent.spawnSpec && !this.handlers.has(agent.id))
        this.handlers.set(agent.id, fn(agent.spawnSpec));
    }
  }

  registerWorker(agentId: AgentId, handler: WorkerHandler) {
    this.handlers.set(agentId, handler);
  }

  /** Completion hook — vite wires accomplishment logging here. */
  setTaskCompletedHook(fn: (task: AgentTask, agent: AgentState) => void) {
    this.onTaskCompleted = fn;
  }

  /** Terminal-state hook (completed/failed/vetoed/cancelled) — archive,
   *  outcome capture, and observability wire here. */
  setTaskFinishedHook(fn: (task: AgentTask, agent: AgentState | undefined) => void) {
    this.onTaskFinished = fn;
  }

  attachSentinel(sources: ConstructorParameters<typeof ModelSentinel>[2], probeFactory: ConstructorParameters<typeof ModelSentinel>[3]) {
    this.sentinel = new ModelSentinel(this.matrix, (e) => this.emit(e), sources, probeFactory);
    this.sentinel.start();
  }

  start() {
    this.stopped = false;
    if (this.sweeper) return;
    this.sweeper = setInterval(() => this.sweep(), 15_000);
    this.sweeper.unref?.();
    // A running runtime means its agents are alive — 'offline' is reserved
    // for stale heartbeats, not "hasn't worked yet".
    for (const agent of this.agents.values())
      if (agent.status === 'offline') this.setStatus(agent.id, 'idle');
    for (const id of this.agents.keys()) this.pump(id);
  }

  stop() {
    this.stopped = true;
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
    this.sentinel?.stop();
    for (const ac of this.running.values()) ac.abort();
    this.persist();
  }

  // ── Events ──────────────────────────────────────────────────────

  emit(e: AgentEvent) {
    this.events.push(e);
    if (this.events.length > EVENT_BUFFER_MAX) this.events.splice(0, this.events.length - EVENT_BUFFER_MAX);
    for (const l of this.listeners) {
      try { l(e); } catch { /* listener faults never kill the bus */ }
    }
  }

  subscribe(fn: (e: AgentEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  recentEvents(since = 0): AgentEvent[] {
    return this.events.filter((e) => (e.at ?? 0) >= since);
  }

  getAgent(agentId: AgentId): AgentState | undefined {
    return this.agents.get(agentId);
  }

  pinFor(agentId?: AgentId | null) {
    return agentId ? this.agents.get(agentId)?.modelPin ?? null : null;
  }

  // ── Tasks ───────────────────────────────────────────────────────

  submitTask(agentId: AgentId, kind: string, title: string, input: Record<string, unknown> = {}): { ok: boolean; task?: AgentTask; error?: string } {
    const agent = this.agents.get(agentId);
    if (!agent) return { ok: false, error: `unknown agent: ${agentId}` };
    if (agent.status === 'retired') return { ok: false, error: `${agent.name} is retired` };
    if (!kind || !title) return { ok: false, error: 'kind and title required' };
    if (this.dailyCount(agentId) >= agent.dailyBudget)
      return { ok: false, error: `${agent.name} daily budget exhausted (${agent.dailyBudget} tasks)` };
    // Dedupe: identical queued/running task → return the existing one.
    for (const t of this.tasks.values()) {
      if (t.agentId === agentId && t.kind === kind && t.title === title && (t.status === 'queued' || t.status === 'running'))
        return { ok: true, task: t };
    }
    const task: AgentTask = {
      id: newTaskId(), agentId, kind, title, input,
      status: 'queued', progress: null, createdAt: Date.now(),
    };
    this.tasks.set(task.id, task);
    agent.recentTaskIds.push(task.id);
    if (agent.recentTaskIds.length > TASK_HISTORY_MAX) agent.recentTaskIds.shift();
    this.queues.get(agentId)!.push(task);
    this.setStatus(agentId, 'idle');
    this.emit({ type: 'task.transition', task: { ...task }, at: Date.now() });
    this.persist();
    this.pump(agentId);
    return { ok: true, task };
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || (task.status !== 'queued' && task.status !== 'running')) return false;
    const q = this.queues.get(task.agentId);
    if (q) {
      const i = q.findIndex((t) => t.id === taskId);
      if (i >= 0) q.splice(i, 1);
    }
    this.running.get(taskId)?.abort();
    this.transition(task, 'cancelled');
    return true;
  }

  // ── Self-creating agents (spec: CORTEX_AGENTS_SELF.md) ──────────
  // Creation is a proposal, never an action. The gate below is
  // deterministic: it re-derives evidence from real task history and
  // rejects fabricated or duplicative requests before they reach a human.

  private static BUILT_INS: ReadonlySet<string> = new Set(['sentinel', 'scout', 'librarian', 'builder', 'reviewer', 'runner', 'distributor', 'forecaster', 'prep', 'warden', 'strategist']);
  private static MAX_SPAWNED = 4;
  private static MAX_PENDING_PROPOSALS = 10;
  private static SPAWN_PROPOSAL_TTL_MS = 72 * 3600_000;

  get proposalsList(): SpawnProposal[] {
    return [...this.proposals.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Word-set Jaccard for capability-overlap detection. */
  private static words(s: string): Set<string> {
    return new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
  }
  private static jaccard(a: Set<string>, b: Set<string>): number {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const w of a) if (b.has(w)) inter++;
    return inter / (a.size + b.size - inter);
  }

  /**
   * Validate + register a spawn proposal. Returns the proposal (pending) or
   * throws with the rejection reason. Deterministic gate — no LLM judgment.
   */
  proposeSpawn(rawSpec: SpawnSpec, evidence: SpawnProposal['evidence'], proposedBy: string): { ok: boolean; proposal?: SpawnProposal; reason?: string } {
    const fail = (reason: string) => ({ ok: false as const, reason });

    // ── Structural sanity ──
    const spec = rawSpec;
    if (!spec || typeof spec !== 'object') return fail('spec required');
    if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(String(spec.callSign || ''))) return fail('callSign must be UPPER-DASH, 2-24 chars');
    if (!String(spec.role || '').trim() || !String(spec.mission || '').trim()) return fail('role and mission required');
    if (!Array.isArray(spec.tools) || !spec.tools.length || spec.tools.some((t) => !['read', 'write', 'exec', 'surface'].includes(t)))
      return fail('tools must be a non-empty subset of read|write|exec|surface');
    if (!['fast', 'reason', 'deep'].includes(spec.modelPin?.tier)) return fail('modelPin.tier must be fast|reason|deep');
    if (!(spec.dailyBudget >= 1 && spec.dailyBudget <= 32)) return fail('dailyBudget must be 1-32');
    if (!(spec.ttlHours >= 1 && spec.ttlHours <= 168)) return fail('ttlHours must be 1-168');
    if (String(spec.systemBrief || '').length > 4000 || String(spec.doneCriteria || '').length > 1000) return fail('brief/criteria too long');

    // ── Anti-nesting: spawned agents cannot spawn agents (depth-1 only) ──
    if (!AgentRuntime.BUILT_INS.has(proposedBy))
      return fail(`agent_spawn proposals must come from a built-in agent (got '${proposedBy}')`);

    // ── Fleet caps ──
    const spawnedCount = [...this.agents.values()].filter((a) => a.spawnSpec).length;
    if (spawnedCount >= AgentRuntime.MAX_SPAWNED) return fail(`spawn cap reached (${AgentRuntime.MAX_SPAWNED} concurrent spawned agents)`);
    const pending = this.proposalsList.filter((p) => p.status === 'pending').length;
    if (pending >= AgentRuntime.MAX_PENDING_PROPOSALS) return fail('too many pending spawn proposals');
    if ([...this.agents.values()].some((a) => a.spawnSpec?.callSign === spec.callSign))
      return fail(`callSign '${spec.callSign}' already active`);

    // ── Evidence gate: must cite verifiable runtime history ──
    if (!Array.isArray(evidence) || !evidence.length) return fail('evidence required — a spawn must cite real task history');
    for (const ev of evidence) {
      if (!ev || typeof ev.kind !== 'string' || !Array.isArray(ev.refs) || !String(ev.summary || '').trim())
        return fail('each evidence item needs {kind, refs[], summary}');
      // Re-derive: at least one cited ref must resolve to a real task unless
      // the evidence kind is explicitly capability_gap (no task refs exist).
      if (ev.kind !== 'capability_gap' && ev.refs.length) {
        const hits = ev.refs.filter((r) => this.tasks.has(String(r)));
        if (!hits.length) return fail(`evidence cites unknown task ids: ${ev.refs.slice(0, 3).join(', ')}`);
      } else if (ev.kind !== 'capability_gap' && !ev.refs.length) {
        return fail(`evidence kind '${ev.kind}' requires task refs`);
      }
    }

    // ── Capability-overlap check vs built-ins AND active spawns ──
    const proposalWords = AgentRuntime.words(`${spec.role} ${spec.mission} ${spec.systemBrief}`);
    for (const builtin of AGENT_SPECS) {
      const overlap = AgentRuntime.jaccard(proposalWords, AgentRuntime.words(`${builtin.role} ${builtin.blurb}`));
      if (overlap >= 0.6) return fail(`capability overlap with ${builtin.id} (jaccard ${overlap.toFixed(2)}) — extend it instead of spawning`);
    }
    for (const a of this.agents.values()) {
      if (a.spawnSpec) {
        const overlap = AgentRuntime.jaccard(proposalWords, AgentRuntime.words(`${a.spawnSpec.role} ${a.spawnSpec.mission}`));
        if (overlap >= 0.6) return fail(`capability overlap with spawned agent ${a.id} (jaccard ${overlap.toFixed(2)})`);
      }
    }

    const proposal: SpawnProposal = {
      id: `spawn-${Date.now().toString(36)}-${++this.spawnCounter}`,
      spec: { ...spec, parentAgentId: spec.parentAgentId || proposedBy },
      evidence,
      proposedBy,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.proposals.set(proposal.id, proposal);
    this.emit({ type: 'agent.spawn_proposed', proposal: { ...proposal, spec: { ...proposal.spec } }, at: Date.now() });
    this.persist();
    return { ok: true, proposal };
  }

  /** Human approval path — called by the Inbox accept flow. */
  approveSpawn(proposalId: string, decidedBy = 'user'): { ok: boolean; agentId?: string; reason?: string } {
    const p = this.proposals.get(proposalId);
    if (!p) return { ok: false, reason: 'unknown proposal' };
    if (p.status !== 'pending') return { ok: false, reason: `proposal already ${p.status}` };
    if (Date.now() - p.createdAt > AgentRuntime.SPAWN_PROPOSAL_TTL_MS) {
      p.status = 'expired'; p.decidedAt = Date.now();
      this.persist();
      return { ok: false, reason: 'proposal expired (72h)' };
    }
    if (!this.spawnWorkerFactory) return { ok: false, reason: 'spawn worker factory not wired' };

    const agentId = `spawn-${p.spec.callSign.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${this.spawnCounter}` as AgentId;
    const spec = p.spec;
    this.agents.set(agentId, {
      id: agentId,
      name: spec.callSign,
      role: spec.role,
      blurb: `${spec.role} — ephemeral agent (TTL ${spec.ttlHours}h, budget ${spec.dailyBudget}/day)`,
      status: 'idle',
      currentTaskId: null,
      concurrency: 1,
      dailyBudget: spec.dailyBudget,
      modelPin: { tier: spec.modelPin.tier, excludeProviders: spec.modelPin.excludeProviders },
      tier: 'enterprise', // self-created agents always fly the satellite deck
      spawnSpec: spec,
      spawnedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
      tasksCompleted: 0,
      tasksFailed: 0,
      recentTaskIds: [],
    });
    this.queues.set(agentId, []);
    this.handlers.set(agentId, this.spawnWorkerFactory(spec));
    p.status = 'spawned';
    p.decidedAt = Date.now();
    p.decidedBy = decidedBy;
    p.agentId = agentId;
    this.setStatus(agentId, 'idle');
    this.emit({ type: 'agent.spawned', agentId, spec: { ...spec }, at: Date.now() });
    this.persist();
    this.pump(agentId);
    return { ok: true, agentId };
  }

  /** Reject a pending proposal (human or gate). */
  rejectSpawn(proposalId: string, reason: string, decidedBy = 'user') {
    const p = this.proposals.get(proposalId);
    if (!p || p.status !== 'pending') return false;
    p.status = 'rejected';
    p.decidedAt = Date.now();
    p.decidedBy = decidedBy;
    p.rejectionReason = reason.slice(0, 200);
    this.persist();
    return true;
  }

  /** Retire a spawned agent: drain queue, keep audit record. */
  retireAgent(agentId: string, reason: string) {
    const agent = this.agents.get(agentId as AgentId);
    if (!agent || !agent.spawnSpec || agent.status === 'retired') return false;
    const q = this.queues.get(agentId as AgentId);
    if (q) {
      for (const t of q.splice(0)) this.transition(t, 'cancelled');
    }
    agent.status = 'retired';
    agent.currentTaskId = null;
    for (const [tid, ac] of this.running) {
      if (this.tasks.get(tid)?.agentId === agentId) ac.abort();
    }
    this.emit({ type: 'agent.retired', agentId, reason, at: Date.now() });
    this.persist();
    return true;
  }

  // ── Routines: recurring agent assignments ───────────────────────
  // Interval-based scheduler. Each fire goes through submitTask(), so
  // budgets, dedupe, telemetry, and governance apply unchanged. Routines
  // on retired/unknown agents are skipped, not errors.

  private static ROUTINE_MIN_MINUTES = 15;

  listRoutines(): AgentRoutine[] {
    return [...this.routines.values()].sort((a, b) => a.nextRunAt - b.nextRunAt);
  }

  addRoutine(raw: { agentId: AgentId; kind: string; title: string; input?: Record<string, unknown>; everyMinutes?: number; enabled?: boolean }): { ok: boolean; routine?: AgentRoutine; reason?: string } {
    const agent = this.agents.get(raw.agentId);
    if (!agent) return { ok: false, reason: `unknown agent: ${raw.agentId}` };
    if (agent.status === 'retired') return { ok: false, reason: `${agent.name} is retired` };
    if (!raw.kind || !raw.title) return { ok: false, reason: 'kind and title required' };
    const every = Math.max(AgentRuntime.ROUTINE_MIN_MINUTES, Math.floor(Number(raw.everyMinutes) || 0));
    if (!every) return { ok: false, reason: `everyMinutes required (min ${AgentRuntime.ROUTINE_MIN_MINUTES})` };
    // Dedupe: same agent+kind+title routine already exists.
    for (const r of this.routines.values()) {
      if (r.agentId === raw.agentId && r.kind === raw.kind && r.title === raw.title)
        return { ok: false, reason: 'identical routine already exists', routine: r };
    }
    const now = Date.now();
    const routine: AgentRoutine = {
      id: `routine-${now.toString(36)}-${++this.routineCounter}`,
      agentId: raw.agentId,
      kind: raw.kind,
      title: raw.title,
      input: raw.input && typeof raw.input === 'object' ? raw.input : {},
      everyMinutes: every,
      enabled: raw.enabled !== false,
      createdAt: now,
      lastRunAt: null,
      nextRunAt: now + every * 60_000,
      runCount: 0,
    };
    this.routines.set(routine.id, routine);
    this.persist();
    return { ok: true, routine };
  }

  removeRoutine(routineId: string): boolean {
    const ok = this.routines.delete(routineId);
    if (ok) this.persist();
    return ok;
  }

  private fireRoutine(r: AgentRoutine) {
    r.lastRunAt = Date.now();
    r.nextRunAt = r.lastRunAt + r.everyMinutes * 60_000;
    r.runCount++;
    // submitTask enforces budgets/dedupe — a 'budget exhausted' result is
    // fine; the routine stays scheduled and retries next interval.
    this.submitTask(r.agentId, r.kind, r.title, { ...r.input, routineId: r.id });
  }

  private dailyCount(agentId: AgentId): number {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    let n = 0;
    for (const t of this.tasks.values())
      if (t.agentId === agentId && t.createdAt >= dayStart.getTime()) n++;
    return n;
  }

  private transition(task: AgentTask, status: TaskStatus, patch: Partial<AgentTask> = {}) {
    Object.assign(task, patch, { status });
    if (status === 'running' && !task.startedAt) task.startedAt = Date.now();
    if (['completed', 'failed', 'vetoed', 'cancelled'].includes(status)) {
      task.finishedAt = Date.now();
      if (task.telemetry && task.startedAt)
        task.telemetry.durationMs = task.finishedAt - task.startedAt;
    }
    const agent = this.agents.get(task.agentId);
    if (agent) {
      if (status === 'completed') agent.tasksCompleted++;
      if (status === 'failed') agent.tasksFailed++;
      if (agent.currentTaskId === task.id) {
        agent.currentTaskId = [...this.tasks.values()]
          .find((t) => t.agentId === task.agentId && t.status === 'running')?.id ?? null;
      }
    }
    this.emit({ type: 'task.transition', task: { ...task }, at: Date.now() });
    if (status === 'completed' && agent && this.onTaskCompleted) {
      try { this.onTaskCompleted(task, agent); } catch { /* hook must never break runtime */ }
    }
    if (['completed', 'failed', 'vetoed', 'cancelled'].includes(status) && this.onTaskFinished) {
      try { this.onTaskFinished(task, agent); } catch { /* hook must never break runtime */ }
    }
    this.persist();
  }

  private setStatus(agentId: AgentId, status: AgentStatus) {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status === status) return;
    agent.status = status;
    agent.lastHeartbeatAt = Date.now();
    this.emit({ type: 'agent.status', agentId, status, at: Date.now() });
  }

  private activeCount(agentId: AgentId): number {
    let n = 0;
    for (const t of this.tasks.values())
      if (t.agentId === agentId && t.status === 'running') n++;
    return n;
  }

  private pump(agentId: AgentId) {
    const agent = this.agents.get(agentId);
    const queue = this.queues.get(agentId);
    const handler = this.handlers.get(agentId);
    if (!agent || !queue || !handler) return;
    while (queue.length && this.activeCount(agentId) < agent.concurrency && this.running.size < GLOBAL_CONCURRENCY) {
      const task = queue.shift()!;
      agent.currentTaskId = task.id;
      this.setStatus(agentId, 'working');
      this.transition(task, 'running');
      const ac = new AbortController();
      this.running.set(task.id, ac);
      const telemetry: TaskTelemetry = { llmCalls: 0, tokensIn: 0, tokensOut: 0, llmMs: 0, toolCalls: 0, toolFailures: 0 };
      task.telemetry = telemetry;
      const ctx: AgentContext = {
        task,
        signal: ac.signal,
        telemetry,
        progress: (p) => {
          const clamped = Math.max(0, Math.min(1, p));
          task.progress = clamped;
          this.emit({ type: 'task.progress', taskId: task.id, progress: clamped, at: Date.now() });
        },
        llm: async (opts) => {
          if (!this.llmBridge) throw new Error('llm bridge not wired');
          const llmT0 = Date.now();
          const r = await this.llmBridge({ ...opts, agentId });
          telemetry.llmCalls++;
          telemetry.llmMs += Date.now() - llmT0;
          telemetry.tokensIn += r?.usage?.tokensIn ?? 0;
          telemetry.tokensOut += r?.usage?.tokensOut ?? 0;
          // Record the model that actually served — the task window badge
          // must name the real model, not the intended one.
          if (r?.model && r.model !== task.model) {
            task.model = r.model;
            this.emit({ type: 'task.transition', task: { ...task }, at: Date.now() });
          }
          return r?.content ?? '';
        },
        emit: (e) => this.emit(e),
      };
      handler(ctx)
        .then((result) => {
          this.transition(task, 'completed', { result, progress: task.progress ?? 1 });
          this.setStatus(agentId, queue.length ? 'working' : 'idle');
        })
        .catch((err: any) => {
          if (ac.signal.aborted || task.status === 'cancelled') return;
          const msg = String(err?.message || err).slice(0, 300);
          if (task.telemetry) task.telemetry.failureClass = classifyFailure(msg);
          this.transition(task, 'failed', { error: msg });
          this.setStatus(agentId, 'error');
          this.maybeRetry(task, msg);
          // Error is not terminal — next pump returns to idle if queue empty.
          setTimeout(() => { if (!this.activeCount(agentId)) this.setStatus(agentId, 'idle'); }, 4000);
        })
        .finally(() => {
          this.running.delete(task.id);
          this.persist();
          // Global cap is shared across agents: a task queued behind
          // GLOBAL_CONCURRENCY only gets pumped when ITS agent finishes —
          // other agents' completions must drain every queue.
          this.pumpAll();
        });
    }
    if (!queue.length && !this.activeCount(agentId) && agent.status === 'working')
      this.setStatus(agentId, 'idle');
  }

  private pumpAll() {
    for (const agentId of this.queues.keys()) this.pump(agentId);
  }

  /**
   * Bounded unit-scoped retry (loops-and-graphs discipline): a failed task
   * is resubmitted at most twice, carrying {retryOf, priorError, scope} so
   * the worker fixes only the failing unit instead of regrowing the diff.
   * Deterministic caller errors (bad kind, missing input) never retry —
   * they'd just burn budget reproducing the same failure.
   */
  private static MAX_ATTEMPTS = 3;
  /** Transient infra failures (provider/timeout) get a longer fuse — delayed
   *  retries survive brownouts that instant retries can't. Every retry still
   *  consumes daily budget at submitTask, so governance is unchanged. */
  private static MAX_TRANSIENT_ATTEMPTS = 6;
  private static NON_RETRYABLE_RE = /unknown task kind|requires input|cancelled|daily budget/i;

  private maybeRetry(task: AgentTask, error: string) {
    const attempt = Number(task.input?.attempt ?? 0);
    const cls = task.telemetry?.failureClass;
    const transient = cls === 'provider' || cls === 'timeout';
    const maxAttempts = transient ? AgentRuntime.MAX_TRANSIENT_ATTEMPTS : AgentRuntime.MAX_ATTEMPTS;
    if (attempt + 1 >= maxAttempts) return;
    if (task.input?.noRetry === true) return;
    if (AgentRuntime.NON_RETRYABLE_RE.test(error)) return;
    const agent = this.agents.get(task.agentId);
    if (!agent || agent.status === 'retired') return;
    const input = {
      ...task.input,
      attempt: attempt + 1,
      retryOf: task.id,
      priorError: error,
      scope: 'Fix only the failing unit described in priorError; do not expand beyond the original instruction.',
    };
    if (!transient) {
      this.submitTask(task.agentId, task.kind, task.title, input);
      return;
    }
    // Exponential backoff for infra failures: ~90s, 3m, 6m, 12m, 15m(cap).
    // The delay lets provider cooldowns recover before the next attempt;
    // submitTask re-checks budget at fire time, so a raised/lowered budget
    // during the wait is honored honestly.
    const delayMs = Math.min(90_000 * Math.pow(2, attempt), 15 * 60_000);
    const timer = setTimeout(() => {
      if (this.stopped) return;
      this.submitTask(task.agentId, task.kind, task.title, input);
    }, delayMs);
    timer.unref?.();
  }

  /** Human-approved daily budget override — persisted via agents-state,
   *  clamped to a sane range. Used by budgetRaise strategy proposals. */
  setDailyBudget(agentId: AgentId, budget: number): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    agent.dailyBudget = Math.max(1, Math.min(200, Math.floor(budget)));
    this.persist();
    this.emit({ type: 'agent.status', agentId, status: agent.status, at: Date.now() });
    return true;
  }

  private sweep() {
    const now = Date.now();
    // Fire due routines — runs inside the existing 15s sweeper.
    for (const r of this.routines.values()) {
      if (!r.enabled || r.nextRunAt > now) continue;
      const agent = this.agents.get(r.agentId);
      if (!agent || agent.status === 'retired') { r.enabled = false; continue; }
      try { this.fireRoutine(r); } catch { /* a bad routine never kills the sweep */ }
    }
    for (const agent of this.agents.values()) {
      // Agents are in-process workers: while the runtime sweeps, they are
      // alive. 'offline' is reserved for restored state before start() and
      // for a dead runtime (which the client detects via fetch failure).
      if (agent.status === 'idle' || agent.status === 'working' || agent.status === 'error')
        agent.lastHeartbeatAt = now;
      // TTL retirement for spawned agents — ephemeral by design.
      if (agent.spawnSpec && agent.spawnedAt && agent.status !== 'retired') {
        const ttlMs = agent.spawnSpec.ttlHours * 3600_000;
        if (now - agent.spawnedAt > ttlMs) this.retireAgent(agent.id, `TTL expired (${agent.spawnSpec.ttlHours}h)`);
      }
    }
    // Expire stale pending spawn proposals.
    for (const p of this.proposals.values()) {
      if (p.status === 'pending' && now - p.createdAt > AgentRuntime.SPAWN_PROPOSAL_TTL_MS) {
        p.status = 'expired';
        p.decidedAt = now;
      }
    }
  }

  // ── Snapshot / persistence ──────────────────────────────────────

  snapshot(): AgentsSnapshot {
    const tasks = [...this.tasks.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100);
    return {
      agents: [...this.agents.values()],
      models: this.matrix.allHealth(),
      tasks,
      matrix: this.matrix.snapshot(),
      proposals: this.proposalsList.filter((p) => p.status === 'pending' || p.status === 'spawned'),
      routines: this.listRoutines(),
      runtime: {
        startedAt: this.startedAt,
        eventCount: this.events.length,
        totals: (() => {
          const t = { tasks: 0, completed: 0, failed: 0, tokensIn: 0, tokensOut: 0, toolCalls: 0 };
          for (const task of this.tasks.values()) {
            t.tasks++;
            if (task.status === 'completed') t.completed++;
            if (task.status === 'failed') t.failed++;
            t.tokensIn += task.telemetry?.tokensIn ?? 0;
            t.tokensOut += task.telemetry?.tokensOut ?? 0;
            t.toolCalls += task.telemetry?.toolCalls ?? 0;
          }
          return t;
        })(),
      },
    };
  }

  private persist() {
    try {
      fs.mkdirSync(RUNTIME_DIR, { recursive: true });
      const data = {
        savedAt: Date.now(),
        agents: [...this.agents.values()].map((a) => ({ ...a, status: a.status === 'working' ? 'idle' : a.status })),
        tasks: [...this.tasks.values()].slice(-200),
        proposals: [...this.proposals.values()],
        routines: [...this.routines.values()],
        spawnCounter: this.spawnCounter,
        routineCounter: this.routineCounter,
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(data));
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify({ savedAt: Date.now(), models: this.matrix.allHealth(), matrix: this.matrix.snapshot() }));
    } catch { /* persistence is best-effort; runtime continues */ }
  }

  private loadSnapshot() {
    try {
      if (!fs.existsSync(STATE_FILE)) return;
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      for (const saved of data.agents ?? []) {
        const existing = this.agents.get(saved.id);
        if (existing) {
          existing.tasksCompleted = saved.tasksCompleted ?? 0;
          existing.tasksFailed = saved.tasksFailed ?? 0;
          existing.recentTaskIds = saved.recentTaskIds ?? [];
          existing.status = 'offline'; // never trust persisted liveness
          if (saved.spawnSpec) {
            existing.spawnSpec = saved.spawnSpec;
            existing.spawnedAt = saved.spawnedAt;
            existing.modelPin = saved.modelPin ?? existing.modelPin;
          }
        } else if (saved.spawnSpec) {
          // Restore a self-created agent — handler attaches when the
          // spawn worker factory is wired (setSpawnWorkerFactory).
          this.agents.set(saved.id, {
            ...saved,
            status: 'offline',
            currentTaskId: null,
            lastHeartbeatAt: null,
          });
          this.queues.set(saved.id, []);
        }
      }
      for (const p of data.proposals ?? []) {
        if (p && typeof p.id === 'string') this.proposals.set(p.id, p);
      }
      if (typeof data.spawnCounter === 'number') this.spawnCounter = data.spawnCounter;
      if (typeof data.routineCounter === 'number') this.routineCounter = data.routineCounter;
      for (const r of data.routines ?? []) {
        if (r && typeof r.id === 'string' && typeof r.everyMinutes === 'number') {
          // Catch up missed runs: if nextRunAt is far in the past, fire once
          // now-ish rather than replaying every missed interval.
          if (r.nextRunAt < Date.now() - r.everyMinutes * 60_000) r.nextRunAt = Date.now() + 60_000;
          this.routines.set(r.id, r);
        }
      }
      for (const t of data.tasks ?? []) {
        // Only restore terminal tasks — queued/running died with the process.
        if (['completed', 'failed', 'vetoed', 'cancelled'].includes(t.status)) {
          this.tasks.set(t.id, t);
        }
      }
    } catch { /* corrupt snapshot → start clean */ }
  }
}

let runtime: AgentRuntime | null = null;
export function getAgentRuntime(): AgentRuntime {
  if (!runtime) runtime = new AgentRuntime();
  return runtime;
}
