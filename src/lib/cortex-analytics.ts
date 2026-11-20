/**
 * Cortex Analytics — SQL over the JSONL telemetry substrates.
 *
 * llm-traces.jsonl and the cortex-agents event log are append-only JSONL.
 * DuckDB reads them natively (read_json_auto) so latency, token spend and
 * agent activity become queryable without a database server.
 *
 * Real schemas (verified against .cortex-runtime/):
 *   traces: {ts, provider, model, tier?, agentId?, kind, status, latencyMs, tokensIn?, tokensOut?}
 *   events: {seq, at, type, ...payload}  (one file per day: events-YYYY-MM-DD.jsonl)
 *
 * Everything is fail-soft: if @duckdb/node-api is missing or a dataset is
 * absent, callers get { ok:false } — analytics must never break the runtime.
 */

import path from 'path';
import { existsSync } from 'fs';

const RUNTIME_DIR = path.resolve(process.cwd(), '.cortex-runtime');
const TRACES_FILE = path.join(RUNTIME_DIR, 'llm-traces.jsonl');
const EVENTLOG_DIR = path.join(RUNTIME_DIR, 'eventlog');

export interface AnalyticsResult {
  ok: boolean;
  dataset?: string;
  rows?: Record<string, unknown>[];
  error?: string;
}

async function getConnection() {
  // Lazy native import — keeps vite.config bundling and cold start cheap.
  const mod = await import('@duckdb/node-api');
  const duckdb = mod.default ?? mod;
  const instance = await duckdb.DuckDBInstance.create(':memory:');
  return instance.connect();
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

/** Aggregate LLM trace stats: volume + latency percentiles grouped by provider/model. */
export async function traceSummary(sinceMs?: number, limit = 50): Promise<AnalyticsResult> {
  try {
    if (!existsSync(TRACES_FILE)) return { ok: true, dataset: 'traces', rows: [] };
    const since = sinceMs != null ? `WHERE ts >= ${sqlNumber(sinceMs)}` : '';
    const lim = sqlNumber(Math.min(Math.max(limit, 1), 500));
    const conn = await getConnection();
    const rows = await runJsonl(conn, TRACES_FILE, `
      SELECT provider, model, tier,
             count(*) AS calls,
             round(avg(latencyMs), 1) AS avg_latency_ms,
             round(quantile_cont(latencyMs, 0.5), 1) AS p50_latency_ms,
             round(quantile_cont(latencyMs, 0.95), 1) AS p95_latency_ms,
             sum(coalesce(tokensIn, 0) + coalesce(tokensOut, 0)) AS total_tokens,
             sum(CASE WHEN try_cast(status AS INTEGER) IS NULL OR try_cast(status AS INTEGER) >= 400 THEN 1 ELSE 0 END) AS errors
      FROM read_json_auto(${sqlLiteral(TRACES_FILE)}, format='newline_delimited', union_by_name=true)
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
    const rows = await runJsonl(conn, TRACES_FILE, `
      SELECT ts, provider, model, tier, agentId, kind, status, latencyMs, tokensIn, tokensOut
      FROM read_json_auto(${sqlLiteral(TRACES_FILE)}, format='newline_delimited', union_by_name=true)
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
    const glob = `${EVENTLOG_DIR.replace(/'/g, "''")}/events-*.jsonl`;
    const conn = await getConnection();
    const rows = await runJsonl(conn, EVENTLOG_DIR, `
      SELECT "type",
             count(*) AS events,
             min("at") AS first_seen,
             max("at") AS last_seen
      FROM read_json_auto('${glob}', format='newline_delimited', union_by_name=true, filename=false)
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
