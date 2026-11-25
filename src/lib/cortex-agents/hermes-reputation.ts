/**
 * hermes-reputation — tool-level reliability scoring from the executor
 * invoke journal. The journal is the fleet's execution immune system:
 * every mutation flows through it, so its outcomes are the ground truth
 * for which tools actually work.
 *
 * Aggregates GET /v1/runs (via Edge bridge or direct executor) into
 * per-tool stats: invokes, failures, failure rate, avg duration, last
 * error, dry-run share. Used by /api/cortex/hermes/reputation and
 * surfaced in agents/state so routing/proposals can weight reliability.
 */

export interface HermesToolStat {
  tool: string;
  cls: string;
  invokes: number;
  failures: number;
  failureRate: number;
  avgMs: number;
  p95Ms: number;
  dryRuns: number;
  lastError: string | null;
  lastRunAt: string | null;
  callers: Record<string, number>;
}

export interface HermesReputation {
  ok: boolean;
  source: 'edge' | 'direct' | 'unavailable';
  scanned: number;
  tools: HermesToolStat[];
  worst: HermesToolStat[];
  computedAt: number;
  error?: string;
}

const BRIDGE_RUNS = (base: string) => `${base}/functions/v1/make-server-57781ad9/hermes/runs`;

async function fetchRuns(token: string, limit = 500): Promise<{ runs: any[]; source: 'edge' | 'direct' } | null> {
  const env = typeof process !== 'undefined' ? process.env : {};
  const base = (env.VITE_SUPABASE_URL || 'https://kwhnrlzibgfedtxpkbgb.supabase.co').replace(/\/$/, '');
  const anon = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(anon ? { apikey: anon } : {}),
    Authorization: `Bearer ${token}`,
  };

  // Prefer Edge bridge (production path).
  try {
    const r = await fetch(`${BRIDGE_RUNS(base)}?limit=${limit}`, {
      headers,
      signal: AbortSignal.timeout(12000),
    });
    if (r.ok) {
      const j: any = await r.json().catch(() => ({}));
      if (Array.isArray(j?.runs)) return { runs: j.runs, source: 'edge' };
    }
  } catch { /* fall through to direct */ }

  // Direct executor escape hatch (local dev / HERMES_EXECUTOR_URL).
  const direct = env.HERMES_EXECUTOR_URL || env.HERMES_BASE_URL_TARGET || 'http://127.0.0.1:18880';
  try {
    const r = await fetch(`${direct.replace(/\/$/, '')}/v1/runs?limit=${limit}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) {
      const j: any = await r.json().catch(() => ({}));
      if (Array.isArray(j?.runs)) return { runs: j.runs, source: 'direct' };
    }
  } catch { /* unavailable */ }
  return null;
}

function pct(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

export async function computeHermesReputation(opts?: { limit?: number }): Promise<HermesReputation> {
  const env = typeof process !== 'undefined' ? process.env : {};
  const token = env.HERMES_SERVICE_TOKEN || env.HERMES_TOKEN || '';
  if (!token) {
    return { ok: false, source: 'unavailable', scanned: 0, tools: [], worst: [], computedAt: Date.now(), error: 'HERMES_SERVICE_TOKEN unset' };
  }
  const data = await fetchRuns(token, opts?.limit ?? 500);
  if (!data) {
    return { ok: false, source: 'unavailable', scanned: 0, tools: [], worst: [], computedAt: Date.now(), error: 'journal unreachable via edge and direct' };
  }

  const byTool = new Map<string, { invokes: number; failures: number; durs: number[]; dryRuns: number; lastError: string | null; lastRunAt: string | null; cls: string; callers: Record<string, number> }>();
  for (const e of data.runs) {
    const t = String(e?.tool || 'unknown');
    const cur = byTool.get(t) || { invokes: 0, failures: 0, durs: [], dryRuns: 0, lastError: null, lastRunAt: null, cls: String(e?.cls || ''), callers: {} };
    cur.invokes++;
    if (e?.ok === false) {
      cur.failures++;
      cur.lastError = String(e?.error || 'unknown').slice(0, 200);
    }
    if (typeof e?.duration_ms === 'number') cur.durs.push(e.duration_ms);
    if (e?.dry_run) cur.dryRuns++;
    if (!cur.lastRunAt || String(e?.ts || '') > cur.lastRunAt) cur.lastRunAt = String(e?.ts || null);
    const caller = String(e?.caller || 'unknown');
    cur.callers[caller] = (cur.callers[caller] || 0) + 1;
    byTool.set(t, cur);
  }

  const tools: HermesToolStat[] = [...byTool.entries()].map(([tool, s]) => ({
    tool,
    cls: s.cls,
    invokes: s.invokes,
    failures: s.failures,
    failureRate: s.invokes ? s.failures / s.invokes : 0,
    avgMs: s.durs.length ? Math.round(s.durs.reduce((a, b) => a + b, 0) / s.durs.length) : 0,
    p95Ms: Math.round(pct(s.durs, 95)),
    dryRuns: s.dryRuns,
    lastError: s.lastError,
    lastRunAt: s.lastRunAt,
    callers: s.callers,
  })).sort((a, b) => b.failureRate - a.failureRate || b.invokes - a.invokes);

  return {
    ok: true,
    source: data.source,
    scanned: data.runs.length,
    tools,
    worst: tools.filter((t) => t.invokes >= 3 && t.failureRate > 0.2).slice(0, 5),
    computedAt: Date.now(),
  };
}
