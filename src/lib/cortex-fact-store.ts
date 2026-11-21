/**
 * cortex-fact-store — Graphiti-lite bi-temporal fact memory for Cortex.
 *
 * Steals the valuable semantics from Graphiti without its infrastructure:
 *   - valid_from / valid_to windows ("what was true last Tuesday")
 *   - immutable supersession (old facts are never deleted, only closed)
 *   - entity keys (subject + predicate) for canonical resolution
 *   - provenance (source event/tool that asserted the fact)
 *
 * Backed by node:sqlite (built into Node 22+, zero deps) at
 * .cortex-runtime/facts.db. Complements Hindsight: Hindsight is the
 * semantic recall engine; this store is the *authoritative temporal*
 * ledger for facts Cortex asserts about the user/world.
 *
 * Usage:
 *   assertFact({ subject: 'user', predicate: 'prefers', object: 'dark mode', source: 'chat' })
 *   factsAsOf('2026-01-01')        → facts valid at that instant
 *   activeFacts({ subject })       → currently-valid facts
 *   recallFacts('dark mode')       → substring search over object text
 *   memoryBlock('persona')         → Letta-style labelled block get/set
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

// node:sqlite ships in Node 22.5+ but @types/node here predates its typings —
// load it through createRequire with a minimal structural type instead.
interface SqliteStatement {
  all(...args: unknown[]): unknown[];
  get(...args: unknown[]): unknown;
  run(...args: unknown[]): unknown;
}
interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDb;
};

const DB_PATH = process.env.CORTEX_FACTS_DB || join(process.cwd(), '.cortex-runtime', 'facts.db');

export interface Fact {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  valid_from: string;   // ISO — when the fact became true in the world
  valid_to: string | null; // ISO — when it stopped being true (superseded)
  recorded_at: string;  // ISO — when Cortex learned it
  source: string;       // provenance: 'chat' | 'tool:<name>' | 'event:<id>'
  confidence: number;
}

export interface MemoryBlock {
  name: string;
  content: string;
  updated_at: string;
}

let _db: SqliteDb | null = null;

function db(): SqliteDb {
  if (_db) return _db;
  mkdirSync(join(process.cwd(), '.cortex-runtime'), { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object TEXT NOT NULL,
      valid_from TEXT NOT NULL,
      valid_to TEXT,
      recorded_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'unknown',
      confidence REAL NOT NULL DEFAULT 1.0,
      superseded_by TEXT,
      UNIQUE(subject, predicate, valid_from)
    );
    CREATE INDEX IF NOT EXISTS idx_facts_sp ON facts(subject, predicate);
    CREATE INDEX IF NOT EXISTS idx_facts_valid ON facts(valid_from, valid_to);
    CREATE TABLE IF NOT EXISTS memory_blocks (
      name TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
  `);
  // Semantic-recall column (sqlite-vec-lite): Float32LE embedding blob,
  // populated lazily by semanticRecallFacts' bounded backfill. Added via
  // ALTER so existing facts.db files migrate in place.
  const cols = _db.prepare(`PRAGMA table_info(facts)`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'embedding')) {
    _db.exec(`ALTER TABLE facts ADD COLUMN embedding BLOB`);
  }
  return _db;
}

function factId(subject: string, predicate: string, object: string, validFrom: string): string {
  return createHash('sha256')
    .update(`${subject}|${predicate}|${object}|${validFrom}`)
    .digest('hex')
    .slice(0, 24);
}

/**
 * Assert a fact. If an active fact exists for the same (subject, predicate)
 * with a *different* object, close it (set valid_to = now) and link the
 * supersession chain — never delete.
 *
 * `validFrom` defaults to now; callers may pass an earlier instant for
 * backfilled knowledge.
 */
export function assertFact(input: {
  subject: string;
  predicate: string;
  object: string;
  source?: string;
  confidence?: number;
  validFrom?: string;
  validTo?: string | null;
}): Fact {
  const d = db();
  const now = new Date().toISOString();
  const subject = input.subject.trim().toLowerCase();
  const predicate = input.predicate.trim().toLowerCase();
  const object = input.object.trim();
  const validFrom = input.validFrom || now;

  // Supersede any currently-active fact for this (subject, predicate) whose
  // object differs. Idempotent: same object re-asserted just refreshes nothing.
  const active = d.prepare(
    `SELECT id, object FROM facts
     WHERE subject = ? AND predicate = ? AND valid_to IS NULL
     ORDER BY recorded_at DESC`
  ).all(subject, predicate) as Array<{ id: string; object: string }>;

  const newId = factId(subject, predicate, object, validFrom);
  let supersededId: string | null = null;

  for (const row of active) {
    if (row.object === object) {
      // Same fact re-asserted — keep the existing row (no duplicate).
      const existing = d.prepare(`SELECT * FROM facts WHERE id = ?`).get(row.id) as any;
      if (existing) return rowToFact(existing);
      continue;
    }
    // Close the old fact at this instant and record the chain link.
    d.prepare(`UPDATE facts SET valid_to = ?, superseded_by = ? WHERE id = ?`)
      .run(validFrom, newId, row.id);
    supersededId = row.id;
  }

  d.prepare(
    `INSERT OR IGNORE INTO facts
     (id, subject, predicate, object, valid_from, valid_to, recorded_at, source, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(newId, subject, predicate, object, validFrom, input.validTo ?? null, now,
        input.source || 'unknown', input.confidence ?? 1.0);

  const row = d.prepare(`SELECT * FROM facts WHERE id = ?`).get(newId) as any;
  const fact = rowToFact(row);
  // Fire-and-forget embedding so semantic recall covers new facts without
  // blocking the sync write path. embedFactRow fails soft to null.
  void embedFactRow(newId, `${subject} ${predicate} ${object}`);
  return fact;
}

/** Embed one fact's text and store the blob. Dynamic import keeps
 *  transformers.js out of the module graph until first use. */
async function embedFactRow(id: string, text: string): Promise<void> {
  try {
    const { embedText, vecToBlob } = await import('./cortex-embeddings');
    const v = await embedText(text);
    if (!v) return;
    db().prepare(`UPDATE facts SET embedding = ? WHERE id = ?`)
      .run(vecToBlob(v) as any, id);
  } catch { /* fail-soft: substring recall still works */ }
}

/** Bounded backfill — embed up to `limit` active facts missing embeddings.
 *  Called lazily from semanticRecallFacts so cost amortises over queries. */
async function backfillFactEmbeddings(limit = 20): Promise<void> {
  const rows = db().prepare(
    `SELECT id, subject, predicate, object FROM facts
     WHERE valid_to IS NULL AND embedding IS NULL LIMIT ?`
  ).all(limit) as Array<{ id: string; subject: string; predicate: string; object: string }>;
  if (!rows.length) return;
  const { embedText, vecToBlob } = await import('./cortex-embeddings');
  // Batches of 8 — MiniLM is fast but keeps the event loop responsive.
  for (let i = 0; i < rows.length; i += 8) {
    await Promise.all(rows.slice(i, i + 8).map(async (r) => {
      const v = await embedText(`${r.subject} ${r.predicate} ${r.object}`);
      if (v) {
        db().prepare(`UPDATE facts SET embedding = ? WHERE id = ?`)
          .run(vecToBlob(v) as any, r.id);
      }
    }));
  }
}

/** Semantic recall over active facts via local embeddings (cosine over
 *  Float32 blobs — brute force is fine at personal-memory scale).
 *  Returns null when embeddings are unavailable so callers can fall back
 *  to substring recallFacts. */
export async function semanticRecallFacts(query: string, limit = 10): Promise<Fact[] | null> {
  const q = String(query || '').trim();
  if (!q) return [];
  try {
    await backfillFactEmbeddings(20);
    const { embedText, blobToVec, cosineSim } = await import('./cortex-embeddings');
    const qv = await embedText(q);
    if (!qv) return null;
    const rows = db().prepare(
      `SELECT * FROM facts WHERE valid_to IS NULL AND embedding IS NOT NULL`
    ).all() as any[];
    const scored = rows
      .map((r) => ({ r, s: cosineSim(qv, blobToVec(r.embedding)!) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit);
    return scored.map((x) => rowToFact(x.r));
  } catch {
    return null;
  }
}

/** Facts valid at a specific instant (bi-temporal "as of" query). */
export function factsAsOf(isoInstant: string): Fact[] {
  // Stored timestamps are always `new Date().toISOString()` (millis). A
  // caller-supplied instant like "...T10:51:55Z" (no millis) compares
  // lexically WRONG against "...T10:51:55.830Z" — normalise through Date.
  const parsed = new Date(isoInstant);
  const t = Number.isNaN(parsed.getTime()) ? isoInstant : parsed.toISOString();
  const rows = db().prepare(
    `SELECT * FROM facts
     WHERE valid_from <= ? AND (valid_to IS NULL OR valid_to > ?)
     ORDER BY subject, predicate`
  ).all(t, t) as any[];
  return rows.map(rowToFact);
}

/** Currently-active facts, optionally filtered by subject. */
export function activeFacts(filter?: { subject?: string; predicate?: string }): Fact[] {
  let sql = `SELECT * FROM facts WHERE valid_to IS NULL`;
  const args: string[] = [];
  if (filter?.subject) { sql += ` AND subject = ?`; args.push(filter.subject.trim().toLowerCase()); }
  if (filter?.predicate) { sql += ` AND predicate = ?`; args.push(filter.predicate.trim().toLowerCase()); }
  sql += ` ORDER BY subject, predicate`;
  return (db().prepare(sql).all(...args) as any[]).map(rowToFact);
}

/** Substring recall over fact objects (pre-vec semantic search comes later). */
export function recallFacts(query: string, limit = 20): Fact[] {
  const q = `%${query.trim().toLowerCase()}%`;
  const rows = db().prepare(
    `SELECT * FROM facts
     WHERE valid_to IS NULL AND (
       lower(object) LIKE ? OR lower(subject) LIKE ? OR lower(predicate) LIKE ?
     )
     ORDER BY recorded_at DESC LIMIT ?`
  ).all(q, q, q, limit) as any[];
  return rows.map(rowToFact);
}

/** Full supersession history for a (subject, predicate) pair — newest first. */
export function factHistory(subject: string, predicate: string): Fact[] {
  const rows = db().prepare(
    `SELECT * FROM facts WHERE subject = ? AND predicate = ?
     ORDER BY valid_from DESC`
  ).all(subject.trim().toLowerCase(), predicate.trim().toLowerCase()) as any[];
  return rows.map(rowToFact);
}

// ── Letta-style labelled memory blocks ──────────────────────────────────────

const BLOCK_MAX_CHARS = 32_000; // size bound per research: keep blocks small

export function getMemoryBlock(name: string): MemoryBlock | null {
  const row = db().prepare(`SELECT * FROM memory_blocks WHERE name = ?`)
    .get(name.trim().toLowerCase()) as any;
  return row ? { name: row.name, content: row.content, updated_at: row.updated_at } : null;
}

export function setMemoryBlock(name: string, content: string): MemoryBlock {
  const clipped = content.slice(0, BLOCK_MAX_CHARS);
  const now = new Date().toISOString();
  const key = name.trim().toLowerCase();
  db().prepare(
    `INSERT INTO memory_blocks (name, content, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`
  ).run(key, clipped, now);
  return { name: key, content: clipped, updated_at: now };
}

export function listMemoryBlocks(): MemoryBlock[] {
  return (db().prepare(`SELECT * FROM memory_blocks ORDER BY name`).all() as any[])
    .map(r => ({ name: r.name, content: r.content, updated_at: r.updated_at }));
}

function rowToFact(r: any): Fact {
  return {
    id: r.id, subject: r.subject, predicate: r.predicate, object: r.object,
    valid_from: r.valid_from, valid_to: r.valid_to, recorded_at: r.recorded_at,
    source: r.source, confidence: r.confidence,
  };
}
