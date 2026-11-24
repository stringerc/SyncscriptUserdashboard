/**
 * answer-cache.ts — semantic-ish cache for pure-model agentic turns.
 *
 * The video's promise, with honest boundaries: "same question, different
 * words → serve the saved answer, skip the model bill." Cortex only
 * caches turns that used ZERO tools — once a turn touches the host
 * (files, goals, dispatches, memory) its answer is context-bound and
 * caching it would serve stale lies. Pure-model answers to repeated
 * informational questions are safe to replay within a short TTL.
 *
 * Matching is deterministic, no embeddings needed: normalized exact
 * match first, then token-Jaccard ≥ SIM_THRESHOLD across the bounded
 * map — covers "what's the status" vs "what is the status" cheaply.
 *
 * Store: .cortex-runtime/answer-cache.json — {key: {reply, ts, hits}}
 * Bounded at MAX_ENTRIES with oldest-first eviction.
 */
import fs from 'node:fs';
import path from 'node:path';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME, 'answer-cache.json');
const TTL_MS = 15 * 60_000;
const MAX_ENTRIES = 500;
const SIM_THRESHOLD = 0.85;

interface CacheEntry { reply: string; ts: number; hits: number; }
type CacheMap = Record<string, CacheEntry>;

let cache: CacheMap | null = null;
let dirty = false;

function load(): CacheMap {
  if (cache) return cache;
  let parsed: CacheMap = {};
  try { parsed = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
  // Drop expired entries on load so the map stays honest across restarts.
  const cutoff = Date.now() - TTL_MS;
  for (const k of Object.keys(parsed)) if (parsed[k].ts < cutoff) delete parsed[k];
  cache = parsed;
  return cache;
}

function persist(): void {
  if (!dirty || !cache) return;
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    const keys = Object.keys(cache);
    if (keys.length > MAX_ENTRIES) {
      const sorted = keys.sort((a, b) => cache![a].ts - cache![b].ts);
      for (const k of sorted.slice(0, keys.length - MAX_ENTRIES)) delete cache[k];
    }
    fs.writeFileSync(FILE, JSON.stringify(cache));
    dirty = false;
  } catch {}
}

/** Normalize a question into a stable cache key: lowercase, alphanumeric
 *  tokens only, capped length. Punctuation/casing differences collapse. */
export function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
}

function tokenSet(norm: string): Set<string> {
  return new Set(norm.split(' ').filter((t) => t.length >= 3));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface CacheHit { reply: string; ageMs: number; exact: boolean; key: string; }

/** Look up a cached answer. scope isolates senders/sessions so one
 *  user's answer never leaks into another's context. */
export function lookupAnswer(question: string, scope: string): CacheHit | null {
  const norm = normalizeQuestion(question);
  if (norm.length < 8) return null; // too short to be a meaningful question
  const map = load();
  const cutoff = Date.now() - TTL_MS;
  const scoped = Object.entries(map).filter(([k]) => k.startsWith(`${scope}|`));

  const exactKey = `${scope}|${norm}`;
  const exact = map[exactKey];
  if (exact && exact.ts >= cutoff) {
    exact.hits++; dirty = true; persist();
    return { reply: exact.reply, ageMs: Date.now() - exact.ts, exact: true, key: exactKey };
  }

  // Near-duplicate pass: compare token sets against live entries only.
  const qTokens = tokenSet(norm);
  let best: { key: string; entry: CacheEntry; sim: number } | null = null;
  for (const [key, entry] of scoped) {
    if (entry.ts < cutoff) continue;
    const sim = jaccard(qTokens, tokenSet(key.slice(scope.length + 1)));
    if (sim >= SIM_THRESHOLD && (!best || sim > best.sim)) best = { key, entry, sim };
  }
  if (best) {
    best.entry.hits++; dirty = true; persist();
    return { reply: best.entry.reply, ageMs: Date.now() - best.entry.ts, exact: false, key: best.key };
  }
  return null;
}

/** Store a reply. Caller MUST only pass tool-free, error-free turns —
 *  this function trusts that contract (it can't see the turn record). */
export function storeAnswer(question: string, scope: string, reply: string): void {
  const norm = normalizeQuestion(question);
  if (norm.length < 8 || !reply?.trim() || reply.length > 8000) return;
  const map = load();
  const key = `${scope}|${norm}`;
  map[key] = { reply, ts: Date.now(), hits: 0 };
  dirty = true;
  persist();
}

/** Stats for observability surfaces. */
export function cacheStats(): { entries: number; live: number; hits: number } {
  const map = load();
  const cutoff = Date.now() - TTL_MS;
  const vals = Object.values(map);
  return {
    entries: vals.length,
    live: vals.filter((e) => e.ts >= cutoff).length,
    hits: vals.reduce((n, e) => n + e.hits, 0),
  };
}
