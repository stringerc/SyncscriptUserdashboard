/**
 * Cortex Analytics — SQL over the JSONL telemetry substrates.
 *
 * llm-traces.jsonl and the cortex-agents event log are append-only JSONL.
 * DuckDB reads them natively (read_json_auto) so latency, token spend and
 * agent activity become queryable without a database server.
 *
 * Persistence model: a file-backed DuckDB at .cortex-runtime/analytics.duckdb
 * holds materialized snapshot tables (traces, events) rebuilt only when a
 * source file's mtime advances — repeated analytics queries stop rescanning
 * the full JSONL corpus. The JSONL remains the source of truth; the
 * snapshot is a rebuildable cache.
 *
 * Real schemas (verified against .cortex-runtime/):
 *   traces: {ts, provider, model, tier?, agentId?, kind, status, latencyMs, tokensIn?, tokensOut?}
 *   events: {seq, at, type, ...payload}  (one file per day: events-YYYY-MM-DD.jsonl)
 *
 * Everything is fail-soft: if @duckdb/node-api is missing or a dataset is
 * absent, callers get { ok:false } — analytics must never break the runtime.
 */

import path from 'path';
import { existsSync, statSync, readdirSync } from 'fs';

const RUNTIME_DIR = path.resolve(process.cwd(), '.cortex-runtime');
const TRACES_FILE = path.join(RUNTIME_DIR, 'llm-traces.jsonl');
const EVENTLOG_DIR = path.join(RUNTIME_DIR, 'eventlog');
const ANALYTICS_DB = path.join(RUNTIME_DIR, 'analytics.duckdb');

export interface AnalyticsResult {
  ok: boolean;
  dataset?: string;
  rows?: Record<string, unknown>[];
  error?: string;
}

// ── Persisted snapshot state (module-singleton; vite dev server is long-lived) ──
let dbPromise: Promise<any> | null = null;
let lastSnapshotMtime = 0;

async function getConnection() {
  if (!dbPromise) {
    dbPromise = (async () => {
      // Lazy native import — keeps vite.config bundling and cold start cheap.
      const mod = await import('@duckdb/node-api');
      const duckdb = mod.default ?? mod;
      const instance = await duckdb.DuckDBInstance.create(ANALYTICS_DB);
      return instance.connect();
    })();
  }
  return dbPromise;
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error('non-finite number');
  return String(value);
}

async function runJsonl(conn: any, source: string, sqlBody: string): Promise<Record<string, unknown>[]> {
  const result = await conn.run(sqlBody);
  return (await result.getRowObjects()) as Record<string, unknown>[];
}

/** Newest mtime across the telemetry sources the snapshot depends on. */
function sourcesMtime(): number {
  let newest = 0;
  try { if (existsSync(TRACES_FILE)) newest = Math.max(newest, statSync(TRACES_FILE).mtimeMs); } catch {}
  try {
    if (existsSync(EVENTLOG_DIR)) {
      for (const f of readdirSync(EVENTLOG_DIR)) {
        if (!f.startsWith('events-') || !f.endsWith('.jsonl')) continue;
        try { newest = Math.max(newest, statSync(path.join(EVENTLOG_DIR, f)).mtimeMs); } catch {}
      }
    }
  } catch {}
  return newest;
}

/**
 * Rebuild snapshot tables when any source JSONL is newer than the last
 * snapshot. Traces and events refresh independently so a quiet eventlog
 * doesn't force a traces rescan.
 */
async function ensureSnapshot(conn: any): Promise<void> {
  const newest = sourcesMtime();
  if (newest <= lastSnapshotMtime) return;

  if (existsSync(TRACES_FILE)) {
    await conn.run(`
      CREATE OR REPLACE TABLE traces AS
      SELECT * FROM read_json_auto(${sqlLiteral(TRACES_FILE)}, format='newline_delimited', union_by_name=true)
    `);
  } else {
    await conn.run(`CREATE OR REPLACE TABLE traces (ts BIGINT, provider VARCHAR, model VARCHAR, tier VARCHAR, agentId VARCHAR, kind VARCHAR, status VARCHAR, latencyMs DOUBLE, tokensIn BIGINT, tokensOut BIGINT)`);
  }

  if (existsSync(EVENTLOG_DIR)) {
    const glob = `${EVENTLOG_DIR.replace(/'/g, "''")}/events-*.jsonl`;
    await conn.run(`
      CREATE OR REPLACE TABLE events AS
      SELECT * FROM read_json_auto('${glob}', format='newline_delimited', union_by_name=true, filename=false)
    `);
  } else {
    await conn.run(`CREATE OR REPLACE TABLE events (seq BIGINT, "at" BIGINT, "type" VARCHAR)`);
  }

  lastSnapshotMtime = newest;
}

/** Aggregate LLM trace stats: volume + latency percentiles grouped by provider/model. */
export async function traceSummary(sinceMs?: number, limit = 50): Promise<AnalyticsResult> {
  try {
    if (!existsSync(TRACES_FILE)) return { ok: true, dataset: 'traces', rows: [] };
    const since = sinceMs != null ? `WHERE ts >= ${sqlNumber(sinceMs)}` : '';
    const lim = sqlNumber(Math.min(Math.max(limit, 1), 500));
    const conn = await getConnection();
    await ensureSnapshot(conn);
    const rows = await runJsonl(conn, TRACES_FILE, `
      SELECT provider, model, tier,
             count(*) AS calls,
             round(avg(latencyMs), 1) AS avg_latency_ms,
             round(quantile_cont(latencyMs, 0.5), 1) AS p50_latency_ms,
             round(quantile_cont(latencyMs, 0.95), 1) AS p95_latency_ms,
             sum(coalesce(tokensIn, 0) + coalesce(tokensOut, 0)) AS total_tokens,
             sum(CASE WHEN try_cast(status AS INTEGER) IS NULL OR try_cast(status AS INTEGER) >= 400 THEN 1 ELSE 0 END) AS errors
      FROM traces
      ${since}
      GROUP BY provider, model, tier
      ORDER BY calls DESC
      LIMIT ${lim}
    `);
    return { ok: true, dataset: 'traces', rows };
  } catch (err: any) {
    return { ok: false, dataset: 'traces', error: err?.message || String(err) };
  }
}

/** Raw recent trace rows for drill-down. */
export async function traceRows(sinceMs?: number, limit = 100): Promise<AnalyticsResult> {
  try {
    if (!existsSync(TRACES_FILE)) return { ok: true, dataset: 'traces', rows: [] };
    const since = sinceMs != null ? `WHERE ts >= ${sqlNumber(sinceMs)}` : '';
    const lim = sqlNumber(Math.min(Math.max(limit, 1), 1000));
    const conn = await getConnection();
    await ensureSnapshot(conn);
    const rows = await runJsonl(conn, TRACES_FILE, `
      SELECT ts, provider, model, tier, agentId, kind, status, latencyMs, tokensIn, tokensOut
      FROM traces
      ${since}
      ORDER BY ts DESC
      LIMIT ${lim}
    `);
    return { ok: true, dataset: 'traces', rows };
  } catch (err: any) {
    return { ok: false, dataset: 'traces', error: err?.message || String(err) };
  }
}

/** Agent event-log aggregates: throughput and failure-ish types per event type. */
export async function eventSummary(sinceMs?: number, limit = 50): Promise<AnalyticsResult> {
  try {
    if (!existsSync(EVENTLOG_DIR)) return { ok: true, dataset: 'events', rows: [] };
    const since = sinceMs != null ? `WHERE "at" >= ${sqlNumber(sinceMs)}` : '';
    const lim = sqlNumber(Math.min(Math.max(limit, 1), 500));
    const conn = await getConnection();
    await ensureSnapshot(conn);
    const rows = await runJsonl(conn, EVENTLOG_DIR, `
      SELECT "type",
             count(*) AS events,
             min("at") AS first_seen,
             max("at") AS last_seen
      FROM events
      ${since}
      GROUP BY "type"
      ORDER BY events DESC
      LIMIT ${lim}
    `);
    return { ok: true, dataset: 'events', rows };
  } catch (err: any) {
    return { ok: false, dataset: 'events', error: err?.message || String(err) };
  }
}
