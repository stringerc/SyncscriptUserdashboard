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
 *
 * Context-binding contract (the amnesia guard): a tool-free turn is NOT
 * automatically context-free — the model sees chat history, the
 * continuity brief, and the LIFE GOALS digest, so "what's the status"
 * or "move it to the syncscript goal" can be answered with zero tools
 * yet be meaningless in any other context. Therefore:
 *  - isCacheableQuestion() rejects anaphora/deixis ("it", "that step",
 *    "just now") and imperative action-intent without interrogatives;
 *  - callers scope keys with stateEpoch() so goal mutations retire
 *    every cached answer that could have depended on them;
 *  - voice scopes per-session so one conversation's answer can't
 *    replay inside another's.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getCortexGoals } from '../cortex-goals';

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

/** Anaphora + discourse deixis: the message only makes sense relative to
 *  prior conversation, so its answer can never be safely replayed. */
const CONTEXT_BOUND_RE = /\b(it|that|this|they|them|those|these|he|she|we|us|our|just now|earlier|previously|above|already|yet|still|yesterday|today|tonight|last night|last week|last month|ago|the step|the goal|the status|the progress|the result|the outcome|same one|instead|actually|wait|previous message|last answer|what i said|what you said)\b/i;
/** Imperative/action intent — caching a tool-free reply to "please update
 *  X" replays an answer that belonged to a specific moment. Only blocks
 *  when no interrogative is present ("how do I update X" stays cacheable). */
const ACTION_INTENT_RE = /\b(move|add|delete|remove|change|update|rename|reschedule|schedule|send|mark|complete|finish|put|set|create|file|call|text|email|publish|deploy|commit|merge|cancel|approve|reject|submit|sign)\b/i;
const INTERROGATIVE_RE = /\b(what|why|how|when|where|which|who|whose|whom|is|are|was|were|does|do|did|can|could|should|would|may|might|explain|define|difference|versus|vs|mean|tell me about)\b/i;

/** True when a message is self-contained enough that its answer can be
 *  replayed in a different conversational context. Conservative by
 *  design — false negatives just miss the cache; false positives serve
 *  context-bound answers as if they were universal. */
export function isCacheableQuestion(q: string): boolean {
  const s = String(q || '').trim();
  if (s.length < 8) return false;
  if (CONTEXT_BOUND_RE.test(s)) return false;
  if (ACTION_INTENT_RE.test(s) && !INTERROGATIVE_RE.test(s)) return false;
  return true;
}

/** Fingerprint of mutable goal state. Any declare/update/step-completion
 *  changes the signature, so callers can fold it into the cache scope
 *  and context-sensitive answers expire the moment the world moves —
 *  without waiting out the TTL. */
export function stateEpoch(): string {
  try {
    const goals = getCortexGoals().list('active');
    const sig = goals
      .map((g) => `${g.id}:${g.declaredAt}:${(g.steps || []).filter((s) => s.completed).length}/${(g.steps || []).length}:${Math.round(g.driftScore || 0)}`)
      .join('|');
    // Cheap non-crypto hash — this is a cache key, not a security boundary.
    let h = 5381;
    for (let i = 0; i < sig.length; i++) h = ((h << 5) + h + sig.charCodeAt(i)) >>> 0;
    return `g${goals.length.toString(36)}${h.toString(36)}`;
  } catch {
    return 'g0';
  }
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
