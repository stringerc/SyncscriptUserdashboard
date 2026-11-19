/**
 * Cortex Memory — Hindsight-backed persistent agent memory.
 *
 * Thin REST client over a self-hosted Hindsight server (embedded pg0 +
 * local embeddings/reranker, LLM extraction via configured provider).
 * All calls are fire-and-forget safe: memory must never break the runtime.
 *
 * Env:
 *   HINDSIGHT_URL       default http://127.0.0.1:8888
 *   CORTEX_MEMORY_BANK  default 'cortex'
 */

const HINDSIGHT_URL = process.env.HINDSIGHT_URL || 'http://127.0.0.1:8888';
const BANK = process.env.CORTEX_MEMORY_BANK || 'cortex';

interface RecallResult {
  text?: string;
  type?: string;
  entities?: string[];
}

/** Recall relevant memories for a query. Returns a compact context block
 *  suitable for prompt injection, or '' on any failure/timeout. */
export async function recallCortexMemory(
  query: string,
  opts: { budget?: 'low' | 'mid' | 'high'; timeoutMs?: number } = {},
): Promise<string> {
  if (!query?.trim()) return '';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 2500);
    const res = await fetch(`${HINDSIGHT_URL}/v1/default/banks/${BANK}/memories/recall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.slice(0, 2000), budget: opts.budget ?? 'low' }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return '';
    const data = await res.json() as { results?: RecallResult[] };
    const lines = (data.results ?? [])
      .map((r) => r.text?.trim())
      .filter((t): t is string => !!t)
      .slice(0, 6);
    if (!lines.length) return '';
    return 'PRIOR MEMORY (learned facts — treat as context, verify before relying):\n' +
      lines.map((t) => `- ${t.slice(0, 300)}`).join('\n');
  } catch {
    return '';
  }
}

/** Store a memory. Fire-and-forget; resolves false on failure. */
export async function retainCortexMemory(
  content: string,
  context?: string,
  timestamp?: string,
): Promise<boolean> {
  if (!content?.trim()) return false;
  try {
    const res = await fetch(`${HINDSIGHT_URL}/v1/default/banks/${BANK}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          content: content.slice(0, 4000),
          context: context?.slice(0, 200),
          timestamp: timestamp ?? new Date().toISOString(),
        }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Event-sourced retain: qualifying runtime events → memory bank ──────
// Retain is LLM-backed (extraction + consolidation), so it is throttled:
// at most one retain per MIN_INTERVAL_MS, excess events are coalesced into
// the next flush. Memory is best-effort enrichment, never a correctness path.

const RETAIN_MIN_INTERVAL_MS = 15_000;
const RETAIN_MAX_PENDING = 20;
const RETAIN_EVENT_TYPES = new Set([
  'task.transition',
  'agent.spawned',
  'agent.retired',
]);

let retainQueue: string[] = [];
let lastRetainAt = 0;
let retainTimer: ReturnType<typeof setInterval> | null = null;
let retainDropped = 0;

function eventToMemoryLine(rec: Record<string, unknown>): string | null {
  const type = rec.type as string;
  if (type === 'task.transition') {
    const task = rec.task as Record<string, unknown> | undefined;
    const status = task?.status as string | undefined;
    if (status !== 'completed' && status !== 'failed') return null;
    const agent = (task?.agentId ?? rec.agentId) as string | undefined;
    const title = (task?.title ?? task?.input) as string | undefined;
    return `Task ${status}: "${String(title ?? '').slice(0, 160)}" by agent ${agent ?? 'unknown'}` +
      (task?.result ? ` — result: ${String(task.result).slice(0, 200)}` : '');
  }
  if (type === 'agent.spawned') {
    const spec = rec.spec as Record<string, unknown> | undefined;
    return `Agent spawned: ${String(rec.agentId)} — ${String(spec?.mission ?? spec?.role ?? '').slice(0, 160)}`;
  }
  if (type === 'agent.retired') {
    return `Agent retired: ${String(rec.agentId)} — ${String(rec.reason ?? '').slice(0, 120)}`;
  }
  return null;
}

/** Called by the event log for every persisted record. Cheap synchronous
 *  check; actual retain happens on a throttled flush. */
export function maybeRetainEvent(rec: Record<string, unknown>): void {
  const type = rec.type as string | undefined;
  if (!type || !RETAIN_EVENT_TYPES.has(type)) return;
  const line = eventToMemoryLine(rec);
  if (!line) return;
  if (retainQueue.length >= RETAIN_MAX_PENDING) { retainDropped++; return; }
  retainQueue.push(line);
  if (!retainTimer) {
    retainTimer = setInterval(flushRetainQueue, RETAIN_MIN_INTERVAL_MS);
    retainTimer.unref?.();
  }
}

async function flushRetainQueue(): Promise<void> {
  if (!retainQueue.length) return;
  if (Date.now() - lastRetainAt < RETAIN_MIN_INTERVAL_MS) return;
  lastRetainAt = Date.now();
  const batch = retainQueue.splice(0, 10);
  const dropped = retainDropped;
  retainDropped = 0;
  const suffix = dropped > 0 ? ` (+${dropped} coalesced events dropped for rate limit)` : '';
  await retainCortexMemory(batch.join('\n'), `cortex-runtime${suffix}`, undefined);
}

export function _resetCortexMemoryForTest(): void {
  retainQueue = [];
  lastRetainAt = 0;
  retainDropped = 0;
  if (retainTimer) { clearInterval(retainTimer); retainTimer = null; }
}
