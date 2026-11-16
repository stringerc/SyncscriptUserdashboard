/**
 * Cortex Agent Workers — DISTRIBUTOR: the Gumroad revenue engine.
 *
 * Runs the storefront distribution pipeline through the governed
 * run_command tool so every Pinterest pin, Reddit comment, Dreamina
 * generation, and calendar event is a real executed action with honest
 * telemetry — never a claimed success.
 *
 * Work items live in storefront/distribution-queue.json. The
 * 'queue_process' kind drains pending items (bounded per run) so a single
 * routine can carry the whole daily cadence. Item handlers verify their
 * own output markers (POSTED:, PUBLISHED:, CALENDAR_EVENT:) before the
 * queue item is marked done.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { AgentContext, AgentRuntime, WorkerHandler } from './runtime';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5173;
const BASE = `http://127.0.0.1:${PORT}`;
const SOVEREIGN_KEY = 'sovereign-local';
const STOREFRONT = path.join(process.cwd(), 'storefront');
const TOOLS = path.join(STOREFRONT, 'tools');
const QUEUE_FILE = path.join(STOREFRONT, 'distribution-queue.json');
const BROWSER_DIR = path.join(STOREFRONT, 'browser');
const DREAMINA_JOBS = path.join(STOREFRONT, 'assets', 'dreamina', '.jobs');
const MAX_ITEMS_PER_RUN = 3;
const CMD_TIMEOUT_MS = 110_000; // run_command caps at 120s server-side

interface QueueItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'running' | 'done' | 'failed';
  createdAt: number;
  /** Earliest time this item may run (used by deferred collectors). */
  notBefore?: number;
  result?: unknown;
  error?: string;
  attempts?: number;
}

interface QueueFile { items: QueueItem[] }

async function toolExecute(name: string, args: Record<string, unknown>, timeoutMs = 30_000, telemetry?: { toolCalls: number; toolFailures: number }): Promise<{ ok: boolean; [k: string]: unknown }> {
  telemetry && telemetry.toolCalls++;
  try {
    const res = await fetch(`${BASE}/api/cortex/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cortex-key': SOVEREIGN_KEY },
      body: JSON.stringify({ tool: name, args }),
      signal: AbortSignal.timeout(timeoutMs + 10_000),
    });
    const out = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (telemetry && out?.ok === false) telemetry.toolFailures++;
    return out;
  } catch (e) {
    if (telemetry) telemetry.toolFailures++;
    throw e;
  }
}

function loadQueue(): QueueFile {
  try {
    const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) return parsed as QueueFile;
  } catch { /* missing/corrupt → start empty */ }
  return { items: [] };
}

function saveQueue(q: QueueFile) {
  const tmp = QUEUE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(q, null, 2));
  fs.renameSync(tmp, QUEUE_FILE);
}

/** Append a pending work item — the producer side of the pipeline.
 *  Deduped on type+payload fingerprint so agents can't double-enqueue. */
export function enqueueDistributionItem(type: string, payload: Record<string, unknown>, notBefore?: number): { ok: boolean; item?: QueueItem; reason?: string } {
  if (!ITEM_HANDLERS[type]) return { ok: false, reason: `unknown queue type '${type}'` };
  const queue = loadQueue();
  const fp = JSON.stringify(payload);
  const dup = queue.items.find((i) =>
    i.type === type && i.status !== 'failed' && JSON.stringify(i.payload || {}) === fp);
  if (dup) return { ok: true, item: dup, reason: 'duplicate — already queued' };
  const item: QueueItem = {
    id: `${type}-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`,
    type, payload, status: 'pending', createdAt: Date.now(), attempts: 0,
    ...(notBefore ? { notBefore } : {}),
  };
  queue.items.push(item);
  saveQueue(queue);
  return { ok: true, item };
}

// ITEM_TYPES exported below, after ITEM_HANDLERS is defined.

function sh(cmd: string, telemetry?: { toolCalls: number; toolFailures: number }, timeoutMs = CMD_TIMEOUT_MS) {
  return toolExecute('run_command', { command: cmd, cwd: STOREFRONT, timeout: timeoutMs }, timeoutMs + 15_000, telemetry);
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

// ── Item handlers — each verifies its own success marker ──────────

async function runRedditScan(ctx: AgentContext, payload: Record<string, unknown>) {
  const subs = Array.isArray(payload.subs) ? payload.subs.map(String) : [];
  if (!subs.length) throw new Error('reddit_scan requires payload.subs[]');
  ctx.progress(0.3);
  const out = await sh(`node tools/reddit-scan.mjs ${subs.map((s) => `'${s.replace(/'/g, '')}'`).join(' ')}`, ctx.telemetry);
  const stdout = String(out?.stdout || '');
  ctx.progress(1);
  const threads = stdout.split('\n').filter((l) => /^\d+c \|/.test(l)).length;
  if (!threads) throw new Error(`reddit_scan returned no threads (chrome on :9222 reachable? logged into reddit?)`);
  return { subs, threads, output: stdout.slice(0, 4000) };
}

async function runRedditComment(ctx: AgentContext, payload: Record<string, unknown>) {
  const permalink = str(payload.permalink);
  const text = str(payload.text);
  if (!permalink || !text) throw new Error('reddit_comment requires payload.permalink + payload.text');
  ctx.progress(0.2);
  const draftFile = path.join(TOOLS, '.reddit-draft.txt');
  fs.writeFileSync(draftFile, text);
  const out = await sh(`node tools/reddit-old-comment.mjs '${permalink.replace(/'/g, '')}' '${draftFile}'`, ctx.telemetry);
  const stdout = String(out?.stdout || '');
  ctx.progress(0.9);
  if (!/POSTED:\s*true/i.test(stdout)) {
    throw new Error(`reddit comment not confirmed: ${stdout.slice(0, 200)}`);
  }
  ctx.progress(1);
  return { permalink, posted: true, output: stdout.slice(0, 500) };
}

async function runPinterestPin(ctx: AgentContext, payload: Record<string, unknown>) {
  const image = str(payload.image);
  const title = str(payload.title);
  const link = str(payload.link);
  const description = str(payload.description, title);
  if (!image || !title || !link) throw new Error('pinterest_pin requires payload.image + title + link');
  const imgPath = path.isAbsolute(image) ? image : path.join(STOREFRONT, image);
  if (!fs.existsSync(imgPath)) throw new Error(`pin image not found: ${imgPath}`);
  ctx.progress(0.2);
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  const out = await sh(`node tools/pin-create2.mjs ${q(imgPath)} ${q(title)} ${q(description)} ${q(link)}`, ctx.telemetry, 115_000);
  const stdout = String(out?.stdout || '');
  ctx.progress(0.9);
  if (!/PUBLISHED:\s*true/i.test(stdout)) {
    throw new Error(`pin not confirmed published: ${stdout.slice(0, 200)}`);
  }
  ctx.progress(1);
  return { title, link, image: imgPath, published: true, output: stdout.slice(0, 500) };
}

async function runCalendarEvent(ctx: AgentContext, payload: Record<string, unknown>) {
  const title = str(payload.title);
  const startISO = str(payload.startISO || payload.start);
  const endISO = str(payload.endISO || payload.end);
  if (!title || !startISO || !endISO) throw new Error('calendar_event requires payload.title + startISO + endISO');
  const desc = str(payload.description);
  const allday = payload.allDay === true ? ' --allday' : '';
  ctx.progress(0.3);
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  const out = await sh(`node tools/gcal-create.mjs ${q(title)} ${q(startISO)} ${q(endISO)} ${q(desc)}${allday}`, ctx.telemetry, 90_000);
  const stdout = String(out?.stdout || '');
  ctx.progress(0.9);
  if (!/CALENDAR_EVENT:\s*(CREATED|UNCERTAIN)/i.test(stdout)) {
    throw new Error(`calendar event not confirmed: ${stdout.slice(0, 200)}`);
  }
  ctx.progress(1);
  return { title, startISO, endISO, output: stdout.slice(0, 400) };
}

async function runBrowserShot(ctx: AgentContext, payload: Record<string, unknown>) {
  const match = str(payload.match);
  ctx.progress(0.3);
  // Preflight: the shot needs the automation Chrome's CDP endpoint. Fail
  // with a diagnosable reason instead of a blank stderr-empty error.
  try {
    const ping = await fetch('http://localhost:9222/json/version', { signal: AbortSignal.timeout(3000) });
    if (!ping.ok) throw new Error(`CDP HTTP ${ping.status}`);
  } catch (e: any) {
    throw new Error(`automation Chrome offline — CDP :9222 unreachable (${String(e?.message || e).slice(0, 120)}). Chrome runs on Oracle (cortex-chrome.service); check the com.cortex.cdp-tunnel launchd job on this Mac`);
  }
  const out = await sh(`node tools/browser-shot.mjs ${match ? `'${match}'` : ''}`, ctx.telemetry, 60_000);
  const stdout = String(out?.stdout || '');
  const stderr = String(out?.stderr || '');
  ctx.progress(1);
  if (!/SHOT:/.test(stdout)) {
    const detail = (stderr || stdout).trim().slice(0, 300) || `exit=${out?.exitCode ?? '?'} ok=${out?.ok}`;
    throw new Error(`browser shot failed: ${detail}`);
  }
  return { shot: true, output: stdout.slice(0, 400) };
}

async function runDreaminaGenerate(ctx: AgentContext, payload: Record<string, unknown>) {
  const prompt = str(payload.prompt);
  const outName = str(payload.outName, `dreamina-${Date.now().toString(36)}`);
  const ratio = str(payload.ratio, '2:3');
  const resolution = str(payload.resolution, '2K');
  if (!prompt) throw new Error('dreamina_generate requires payload.prompt');
  const jobId = `job-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  fs.mkdirSync(DREAMINA_JOBS, { recursive: true });
  // Detached: generation + poll can exceed the 120s run_command cap.
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  const script = `nohup bash tools/dreamina-run.sh ${q(jobId)} ${q(prompt)} ${q(ratio)} ${q(resolution)} ${q(outName)} > /dev/null 2>&1 &`;
  ctx.progress(0.4);
  await sh(script, ctx.telemetry, 15_000);
  ctx.progress(1);
  return { jobId, launched: true, note: 'collect via dreamina_collect queue item or job status file' };
}

async function runDreaminaCollect(ctx: AgentContext, payload: Record<string, unknown>) {
  const jobId = str(payload.jobId);
  if (!jobId) throw new Error('dreamina_collect requires payload.jobId');
  const statusFile = path.join(DREAMINA_JOBS, `${jobId}.json`);
  // Poll in-process (fs reads aren't bound by the run_command cap) for up to
  // ~100s; Dreamina generations typically land inside that window.
  const deadline = Date.now() + 100_000;
  let status: any = null;
  while (Date.now() < deadline) {
    if (fs.existsSync(statusFile)) {
      try { status = JSON.parse(fs.readFileSync(statusFile, 'utf8')); } catch { status = null; }
      if (status && status.state !== 'running') break;
    }
    ctx.progress(0.5);
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (!status) throw new Error(`no job status for ${jobId}`);
  if (status.state === 'running') throw new Error(`dreamina job ${jobId} still running — will retry next drain`);
  if (status.state === 'failed') throw new Error(`dreamina job failed: ${status.message || 'unknown'}`);
  return { jobId, ...status };
}

async function runDistributionStatus(ctx: AgentContext, _payload: Record<string, unknown>) {
  ctx.progress(0.3);
  const read = (p: string, max = 4000) => {
    try { return fs.readFileSync(p, 'utf8').slice(-max); } catch { return null; }
  };
  const queue = loadQueue();
  const counts: Record<string, number> = { pending: 0, done: 0, failed: 0 };
  for (const i of queue.items) counts[i.status] = (counts[i.status] ?? 0) + 1;
  const gumroadState = read(path.join(STOREFRONT, '.gumroad-state.json'), 2000);
  const launchLog = read(path.join(STOREFRONT, 'GUMROAD_LAUNCH_LOG.md'), 3000);
  const shotTs = read(path.join(BROWSER_DIR, 'latest.txt'), 200);
  const catalog = read(path.join(STOREFRONT, 'products', 'catalog-v2.json'), 6000);
  let productCount = 0, publishedCount = 0;
  try {
    const cat = JSON.parse(catalog || '{}');
    const products = cat.products || cat;
    if (Array.isArray(products)) {
      productCount = products.length;
      publishedCount = products.filter((p: any) => p.published || p.gumroadId || p.live).length;
    }
  } catch { /* catalog parse best-effort */ }
  ctx.progress(1);
  return {
    queue: counts,
    queueItems: queue.items.slice(-10).map((i) => ({ id: i.id, type: i.type, status: i.status, createdAt: i.createdAt })),
    products: { total: productCount, published: publishedCount },
    gumroadState: gumroadState ? JSON.parse(gumroadState) : null,
    launchLogTail: launchLog,
    browserShotAt: shotTs,
    checkedAt: new Date().toISOString(),
  };
}

/** reddit_draft — the content half of the last mile. Given a thread
 *  permalink (+ optional product context), the fast lane drafts a
 *  value-first comment and enqueues a reddit_comment item; the next
 *  queue_process drain posts it through the governed browser path.
 *  Drafting and posting stay separate steps so bad drafts never ship. */
async function runRedditDraft(ctx: AgentContext, payload: Record<string, unknown>) {
  const permalink = str(payload.permalink);
  const context = str(payload.context, '');
  const product = str(payload.product, '');
  if (!permalink) throw new Error('reddit_draft requires payload.permalink');
  const threadHint = str(payload.threadHint, '');
  ctx.progress(0.2);
  const draft = await ctx.llm({
    tier: 'fast',
    maxTokens: 400,
    messages: [
      {
        role: 'system',
        content: 'You write Reddit comments for a solo founder who sells AI workflow products on Gumroad. Rules: lead with genuine help, never pitch in the first comment, no links unless the thread explicitly asks for tools, sound like a practitioner not a marketer, 2-4 sentences max, no em-dash, no corporate tone. Output ONLY the comment text.',
      },
      {
        role: 'user',
        content: `THREAD: ${permalink}${threadHint ? `\nTHREAD CONTEXT: ${threadHint.slice(0, 1500)}` : ''}${context ? `\nPRODUCT TO WEAVE IN NATURALLY (only if it fits): ${context}` : ''}${product ? `\nPRODUCT: ${product}` : ''}\n\nDraft the comment.`,
      },
    ],
  });
  const text = String(draft || '').trim().replace(/^"|"$/g, '');
  if (text.length < 20) throw new Error('reddit_draft produced empty/too-short comment');
  ctx.progress(0.7);
  const enq = enqueueDistributionItem('reddit_comment', { permalink, text });
  ctx.progress(1);
  return { permalink, drafted: text, queued: enq.ok, queueId: enq.item?.id, queueNote: enq.reason };
}

const ITEM_HANDLERS: Record<string, (ctx: AgentContext, p: Record<string, unknown>) => Promise<unknown>> = {
  reddit_scan: runRedditScan,
  reddit_comment: runRedditComment,
  pinterest_pin: runPinterestPin,
  calendar_event: runCalendarEvent,
  browser_shot: runBrowserShot,
  dreamina_generate: runDreaminaGenerate,
  dreamina_collect: runDreaminaCollect,
};

export const DISTRIBUTION_ITEM_TYPES = Object.keys(ITEM_HANDLERS);

// ── Worker ────────────────────────────────────────────────────────

const distributorWorker: WorkerHandler = async (ctx) => {
  const kind = ctx.task.kind;

  // Direct kinds (single action, also usable as routine payloads).
  if (kind !== 'queue_process' && ITEM_HANDLERS[kind]) {
    ctx.progress(0.1);
    const result = await ITEM_HANDLERS[kind](ctx, ctx.task.input);
    return { kind, ...(result && typeof result === 'object' ? result as Record<string, unknown> : {}) };
  }

  if (kind === 'distribution_status') {
    return runDistributionStatus(ctx, ctx.task.input);
  }

  if (kind === 'reddit_draft') {
    return runRedditDraft(ctx, ctx.task.input);
  }

  if (kind !== 'queue_process') {
    throw new Error(`distributor: unknown task kind '${kind}'`);
  }

  // queue_process: drain up to MAX_ITEMS_PER_RUN pending items.
  const queue = loadQueue();
  const now = Date.now();
  const pending = queue.items
    .filter((i) => i.status === 'pending' && (!i.notBefore || i.notBefore <= now))
    .slice(0, MAX_ITEMS_PER_RUN);
  if (!pending.length) {
    ctx.progress(1);
    return { drained: 0, note: 'queue empty', pendingTotal: queue.items.filter((i) => i.status === 'pending').length };
  }

  const results: Array<{ id: string; type: string; ok: boolean; result?: unknown; error?: string }> = [];
  let done = 0;
  for (const item of pending) {
    if (ctx.signal.aborted) throw new Error('cancelled');
    item.status = 'running';
    item.attempts = (item.attempts ?? 0) + 1;
    saveQueue(queue);
    ctx.progress(done / pending.length);
    try {
      const handler = ITEM_HANDLERS[item.type];
      if (!handler) throw new Error(`no handler for queue type '${item.type}'`);
      const result = await handler(ctx, item.payload || {});
      item.status = 'done';
      item.result = result;
      results.push({ id: item.id, type: item.type, ok: true, result });
      // dreamina_generate launches async work — auto-enqueue its collector.
      if (item.type === 'dreamina_generate' && (result as any)?.jobId) {
        queue.items.push({
          id: `collect-${(result as any).jobId}`,
          type: 'dreamina_collect',
          payload: { jobId: (result as any).jobId },
          status: 'pending',
          createdAt: Date.now(),
          notBefore: Date.now() + 90_000, // collector waits ~90s before first check
          attempts: 0,
        } as QueueItem);
        // defer: collector becomes eligible on next drain after its createdAt
      }
    } catch (e: any) {
      // Collectors poll async jobs — allow many more attempts than one-shot items.
      const maxAttempts = item.type === 'dreamina_collect' ? 40 : 3;
      item.status = item.attempts! >= maxAttempts ? 'failed' : 'pending';
      item.error = String(e?.message || e).slice(0, 300);
      results.push({ id: item.id, type: item.type, ok: false, error: item.error });
    }
    done++;
    saveQueue(queue);
    ctx.progress(done / pending.length);
  }
  ctx.progress(1);
  return { drained: done, results };
};

export function registerDistributorWorker(runtime: AgentRuntime) {
  runtime.registerWorker('distributor', distributorWorker);
}
