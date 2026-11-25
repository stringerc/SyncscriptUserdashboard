/**
 * Cortex Agents client — live state feed for the Agents tab.
 *
 * Initial GET /api/cortex/agents/state, then SSE /stream with a 3s poll
 * fallback. Honest empty state: when the runtime is offline the snapshot
 * simply reports zero agents — the UI renders that truthfully.
 */

export interface AgentTaskClient {
  id: string; agentId: string; kind: string; title: string;
  status: string; progress: number | null; model?: string;
  result?: unknown; error?: string;
  telemetry?: {
    llmCalls?: number; tokensIn?: number; tokensOut?: number; llmMs?: number;
    toolCalls?: number; toolFailures?: number; durationMs?: number;
    failureClass?: string;
  } | null;
  createdAt: number; startedAt?: number; finishedAt?: number;
  /** Task input payload — carries ventureId scope when stamped. */
  input?: Record<string, unknown>;
}
export interface AgentClient {
  id: string; name: string; role: string; blurb: string;
  status: string; currentTaskId: string | null;
  concurrency: number; dailyBudget: number;
  modelPin?: { tier?: string; excludeProviders?: string[] } | null;
  lastHeartbeatAt: number | null;
  tasksCompleted: number; tasksFailed: number;
  spawnSpec?: { callSign?: string; role?: string; mission?: string; ttlHours?: number; dailyBudget?: number; tools?: string[]; parentAgentId?: string } | null;
  spawnedAt?: number | null;
  /** 'enterprise' agents render as satellites; absent/'standard' render as moons. */
  tier?: 'standard' | 'enterprise' | null;
}
export interface ModelClient {
  id: string; provider: string; tierFit: string[];
  status: string; latencyMsP50: number | null;
  lastCheckAt: number | null; consecutiveFailures: number;
}
export interface AgentsSnapshotClient {
  ok?: boolean;
  agents: AgentClient[];
  models: ModelClient[];
  tasks: AgentTaskClient[];
  matrix: Record<string, string[]>;
  proposals?: { id: string; status: string; spec: { callSign: string; role: string; mission: string; ttlHours: number; dailyBudget: number; tools: string[] }; proposedBy: string; createdAt: number }[];
  runtime?: { startedAt: number; eventCount: number };
  /** Mission-loop summary (CORTEX_MISSION_LOOP_SPEC.md) — goals, ops, experiments. */
  mission?: {
    goals: { id: string; title: string; progress: number; orphaned: boolean }[];
    ops: { total: number; done: number; stale: number; pending: number };
    plannedBlocks: number;
    upcomingBlocks?: { id: string; title: string; start: number; end: number; agentId?: string; kind?: string; goalId?: string; taskId?: string; ventureId?: string }[];
    experiments: { id: string; routineId: string; kind: string; variantMin: number }[];
  } | null;
  /** Hermes executor journal reputation — per-tool reliability stats. */
  hermesReputation?: {
    ok: boolean;
    source?: string;
    scanned?: number;
    tools?: { tool: string; cls: string; invokes: number; failures: number; failureRate: number; avgMs: number; lastError: string | null }[];
    worst?: { tool: string; failureRate: number; invokes: number }[];
  } | null;
  offline?: boolean;
}

type Listener = () => void;

class AgentsClientStore {
  snapshot: AgentsSnapshotClient = { agents: [], models: [], tasks: [], matrix: {}, offline: true };
  /** Ring buffer of raw runtime events from the SSE feed — newest last. */
  events: { type: string; at: number; [k: string]: unknown }[] = [];
  private listeners = new Set<Listener>();
  private es: EventSource | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private static EVENT_MAX = 40;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() { for (const fn of this.listeners) { try { fn(); } catch {} } }

  async refresh() {
    try {
      const r = await fetch('/api/cortex/agents/state', { cache: 'no-store' });
      const j: any = await r.json();
      if (j?.ok) {
        this.snapshot = { agents: j.agents || [], models: j.models || [], tasks: j.tasks || [], matrix: j.matrix || {}, runtime: j.runtime, mission: j.mission ?? null, offline: false };
      } else {
        this.snapshot = { ...this.snapshot, offline: true };
      }
    } catch {
      this.snapshot = { ...this.snapshot, offline: true };
    }
    this.emit();
  }

  start() {
    if (this.started) return;
    this.started = true;
    void this.refresh();
    try {
      this.es = new EventSource('/api/cortex/agents/stream');
      this.es.onmessage = (ev) => {
        try {
          const e = JSON.parse(ev.data);
          this.events.push(e);
          if (this.events.length > AgentsClientStore.EVENT_MAX) this.events.splice(0, this.events.length - AgentsClientStore.EVENT_MAX);
        } catch {}
        // Event bursts → trailing-edge debounced snapshot refresh instead of
        // one GET per SSE message.
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => { this.refreshTimer = null; void this.refresh(); }, 300);
      };
      this.es.onerror = () => { /* SSE drops → poll fallback covers it */ };
    } catch { this.es = null; }
    this.pollTimer = setInterval(() => void this.refresh(), 4000);
  }

  stop() {
    this.es?.close(); this.es = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    if (this.refreshTimer) { clearTimeout(this.refreshTimer); this.refreshTimer = null; }
    this.started = false;
  }

  async submitTask(agentId: string, kind: string, title: string, input: Record<string, unknown> = {}) {
    const r = await fetch('/api/cortex/agents/task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, kind, title, input }),
    });
    const j: any = await r.json().catch(() => null);
    await this.refresh();
    return j;
  }

  async cancelTask(taskId: string) {
    const r = await fetch('/api/cortex/agents/task/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    });
    await this.refresh();
    return r.json().catch(() => null);
  }
}

export const agentsClient = new AgentsClientStore();
