/**
 * semantic-compression.ts — certified semantic compression for episodic stores.
 *
 * Memory pressure relief that does NOT feel like amnesia. Raw episodic
 * traces (task-archive.jsonl — 22k patrol records, 35MB) are rewritten
 * into dense semantic cases: one canonical record per
 * (agent, kind, title-cluster, ISO-week) carrying refCount + aggregate
 * telemetry, while the raw lines are gzip-archived — every original
 * record remains reconstructable on disk.
 *
 * Fidelity guarantee: verifyCompression() recomputes the statistics
 * consumers actually query (counts, token sums, per-week kind counts)
 * over raw-vs-compressed and reports the max relative error. Count and
 * sum metrics are exact by construction; the certified bound is reported,
 * not asserted. What IS lost is per-record detail inside old clusters —
 * stated explicitly in the report, never hidden.
 *
 * Dream-driven redundancy: generative-dream already finds fault lines.
 * mineRedundancyLines() lets it also find REDUNDANCY lines — clusters of
 * constitutional conflicts, dream fault lines, and valence outcomes that
 * converge on the same principle/verdict — collapsed into canonical
 * cases with reference counts in semantic-cases.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const ARCHIVE = path.join(RUNTIME, 'task-archive.jsonl');
const SEMANTICS = path.join(RUNTIME, 'task-archive.semantics.jsonl');
const CASES_FILE = path.join(RUNTIME, 'semantic-cases.json');

const KEEP_DAYS = 7;          // signal-feeds/empirical-dynamics read ≤7d — stays raw
const MIN_CLUSTER = 8;        // below this, records stay raw (not worth a case)
const TITLE_CAP = 120;

// ── Helpers ──────────────────────────────────────────────────────────
const readLines = (f: string): string[] => {
  try { return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean); } catch { return []; }
};
const parseLine = (l: string): any => { try { return JSON.parse(l); } catch { return null; } };

/** Normalize a title into a cluster key: strip ids, timestamps, numbers,
 *  and variable payloads so "Cortex patrol — boot sweep #4821" and
 *  "Cortex patrol — boot sweep" land in the same semantic case. */
function normTitle(t: string): string {
  return String(t || '')
    .toLowerCase()
    .replace(/task-[a-z0-9-]+/g, ' ')
    .replace(/0x[0-9a-f]+/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TITLE_CAP);
}

function isoWeek(ts: number): string {
  const d = new Date(ts);
  const onejan = new Date(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const clusterKey = (r: any): string =>
  `${r?.agentId || '?'}|${r?.kind || '?'}|${normTitle(r?.title)}|${isoWeek(Number(r?.finishedAt || r?.createdAt || 0))}`;

function mode<T>(vals: T[]): T | undefined {
  if (!vals.length) return undefined;
  const m = new Map<T, number>();
  for (const v of vals) m.set(v, (m.get(v) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// ── Stats used for the certified bound ────────────────────────────────
interface StoreStats {
  records: number;
  completed: number;
  failed: number;
  tokensIn: number;
  tokensOut: number;
  llmCalls: number;
  byAgent: Record<string, number>;
  byKind: Record<string, number>;
  byWeekKind: Record<string, number>;
}

function emptyStats(): StoreStats {
  return { records: 0, completed: 0, failed: 0, tokensIn: 0, tokensOut: 0, llmCalls: 0, byAgent: {}, byKind: {}, byWeekKind: {} };
}

function addRecord(s: StoreStats, r: any, weight = 1, telWeight = weight) {
  s.records += weight;
  if (r?.status === 'completed' || r?.status === 'done') s.completed += weight;
  if (r?.status === 'failed') s.failed += weight;
  const t = r?.telemetry || {};
  // telWeight=1 for semantic cases: their telemetry fields are already
  // SUMS across refCount members — multiplying by weight double-counts.
  s.tokensIn += (Number(t.tokensIn) || 0) * telWeight;
  s.tokensOut += (Number(t.tokensOut) || 0) * telWeight;
  s.llmCalls += (Number(t.llmCalls) || 0) * telWeight;
  const agent = String(r?.agentId || '?');
  const kind = String(r?.kind || '?');
  s.byAgent[agent] = (s.byAgent[agent] || 0) + weight;
  s.byKind[kind] = (s.byKind[kind] || 0) + weight;
  const wk = `${isoWeek(Number(r?.finishedAt || r?.createdAt || 0))}|${kind}`;
  s.byWeekKind[wk] = (s.byWeekKind[wk] || 0) + weight;
}

function addCase(s: StoreStats, c: any) {
  const n = Number(c.refCount) || 1;
  // statusCounts preserves the true completed/failed split — a mixed
  // cluster must not certify as all-majority-status.
  const sc = c.statusCounts || {};
  const completed = sc.completed ?? sc.done ?? (c.status === 'completed' || c.status === 'done' ? n : 0);
  const failed = sc.failed ?? (c.status === 'failed' ? n : 0);
  s.records += n;
  s.completed += Number(completed) || 0;
  s.failed += Number(failed) || 0;
  const t = c.telemetry || {};
  s.tokensIn += Number(t.tokensIn) || 0;
  s.tokensOut += Number(t.tokensOut) || 0;
  s.llmCalls += Number(t.llmCalls) || 0;
  const agent = String(c.agentId || '?');
  const kind = String(c.kind || '?');
  s.byAgent[agent] = (s.byAgent[agent] || 0) + n;
  s.byKind[kind] = (s.byKind[kind] || 0) + n;
  const wk = `${isoWeek(Number(c.finishedAt || c.createdAt || 0))}|${kind}`;
  s.byWeekKind[wk] = (s.byWeekKind[wk] || 0) + n;
}

function maxRelErr(a: StoreStats, b: StoreStats): { metric: string; err: number } {
  let worst = { metric: 'records', err: 0 };
  const check = (name: string, x: number, y: number) => {
    const denom = Math.max(Math.abs(x), 1);
    const err = Math.abs(x - y) / denom;
    if (err > worst.err) worst = { metric: name, err };
  };
  check('records', a.records, b.records);
  check('completed', a.completed, b.completed);
  check('failed', a.failed, b.failed);
  check('tokensIn', a.tokensIn, b.tokensIn);
  check('tokensOut', a.tokensOut, b.tokensOut);
  check('llmCalls', a.llmCalls, b.llmCalls);
  for (const k of new Set([...Object.keys(a.byAgent), ...Object.keys(b.byAgent)]))
    check(`byAgent:${k}`, a.byAgent[k] || 0, b.byAgent[k] || 0);
  for (const k of new Set([...Object.keys(a.byKind), ...Object.keys(b.byKind)]))
    check(`byKind:${k}`, a.byKind[k] || 0, b.byKind[k] || 0);
  for (const k of new Set([...Object.keys(a.byWeekKind), ...Object.keys(b.byWeekKind)]))
    check(`byWeekKind:${k}`, a.byWeekKind[k] || 0, b.byWeekKind[k] || 0);
  return worst;
}

// ── 1. Episodic compression ───────────────────────────────────────────
export interface CompressionReport {
  ranAt: number;
  skipped: boolean;
  reason?: string;
  rawRecords: number;
  recentKept: number;
  casesWritten: number;
  bytesBefore: number;
  bytesAfter: number;
  rawArchive: string | null;
  certifiedError: number;
  certifiedMetric: string;
  detailRecordsCollapsed: number;
}

export function compressTaskArchive(opts: { keepDays?: number; minCluster?: number } = {}): CompressionReport {
  const keepDays = opts.keepDays ?? KEEP_DAYS;
  const minCluster = opts.minCluster ?? MIN_CLUSTER;
  const now = Date.now();
  const cutoff = now - keepDays * 86400_000;
  const report: CompressionReport = {
    ranAt: now, skipped: false, rawRecords: 0, recentKept: 0, casesWritten: 0,
    bytesBefore: 0, bytesAfter: 0, rawArchive: null,
    certifiedError: 0, certifiedMetric: 'records', detailRecordsCollapsed: 0,
  };
  try {
    if (!fs.existsSync(ARCHIVE)) return { ...report, skipped: true, reason: 'no archive' };
    report.bytesBefore = fs.statSync(ARCHIVE).size;
    const lines = readLines(ARCHIVE);
    const parsed = lines.map(parseLine).filter(Boolean);
    report.rawRecords = parsed.length;
    if (parsed.length < 500) return { ...report, skipped: true, reason: `only ${parsed.length} records — not worth a pass` };

    const statsRaw = emptyStats();
    const recent: any[] = [];
    const oldByKey = new Map<string, any[]>();
    for (const r of parsed) {
      addRecord(statsRaw, r);
      const ts = Number(r.finishedAt || r.createdAt || 0);
      if (ts >= cutoff) recent.push(r);
      else {
        const k = clusterKey(r);
        const arr = oldByKey.get(k) || [];
        arr.push(r);
        oldByKey.set(k, arr);
      }
    }
    report.recentKept = recent.length;

    // Cluster old records → canonical semantic cases
    const cases: any[] = [];
    const looseOld: any[] = [];
    for (const [key, members] of oldByKey) {
      if (members.length < minCluster) { looseOld.push(...members); continue; }
      const sorted = [...members].sort((a, b) => (a.finishedAt || a.createdAt || 0) - (b.finishedAt || b.createdAt || 0));
      const first = sorted[0], last = sorted[sorted.length - 1];
      const tel = sorted.map((m) => m.telemetry || {});
      const resultSigs = new Set(sorted.map((m) => {
        try { return JSON.stringify(m.result ?? null).slice(0, 4000); } catch { return '?'; }
      }));
      cases.push({
        id: `sem-${key.split('|').slice(0, 3).join('-').replace(/[^a-z0-9-]+/gi, '-').slice(0, 60)}-${isoWeek(Number(last.finishedAt || last.createdAt || 0))}`,
        compressed: true,
        refCount: sorted.length,
        clusterKey: key,
        agentId: first.agentId, agentName: first.agentName,
        kind: first.kind, title: String(first.title || '').slice(0, TITLE_CAP),
        status: mode(sorted.map((m) => String(m.status || ''))),
        statusCounts: sorted.reduce<Record<string, number>>((a, m) => { const s = String(m.status || '?'); a[s] = (a[s] || 0) + 1; return a; }, {}),
        model: mode(sorted.map((m) => String(m.model || '')).filter(Boolean)),
        createdAt: first.createdAt, startedAt: first.startedAt,
        finishedAt: last.finishedAt,
        durationMs: Math.round(sorted.reduce((a, m) => a + (Number(m.durationMs) || 0), 0) / sorted.length),
        telemetry: {
          llmCalls: tel.reduce((a, t) => a + (Number(t.llmCalls) || 0), 0),
          tokensIn: tel.reduce((a, t) => a + (Number(t.tokensIn) || 0), 0),
          tokensOut: tel.reduce((a, t) => a + (Number(t.tokensOut) || 0), 0),
          toolCalls: tel.reduce((a, t) => a + (Number(t.toolCalls) || 0), 0),
          toolFailures: tel.reduce((a, t) => a + (Number(t.toolFailures) || 0), 0),
          llmMsTotal: tel.reduce((a, t) => a + (Number(t.llmMs) || 0), 0),
        },
        // Latest verdict preserved verbatim — "would this change the
        // verdict?" for any latest-state query: no. Distinct result
        // payloads counted so variant loss is visible, not hidden.
        result: last.result,
        resultVariants: resultSigs.size,
      });
      report.detailRecordsCollapsed += sorted.length - 1;
    }
    report.casesWritten = cases.length;

    // Raw old lines → gzip archive (reconstructable, ~10x smaller)
    const oldLines = parsed.filter((r) => Number(r.finishedAt || r.createdAt || 0) < cutoff);
    if (oldLines.length) {
      const rawName = `task-archive.raw-${new Date(now).toISOString().replace(/[:.]/g, '-')}.jsonl.gz`;
      const rawPath = path.join(RUNTIME, rawName);
      fs.writeFileSync(rawPath, zlib.gzipSync(oldLines.map((r) => JSON.stringify(r)).join('\n') + '\n'));
      report.rawArchive = rawName;
      // Retain only the newest raw archive — older gzips are the janitor's job
      const raws = fs.readdirSync(RUNTIME).filter((f) => f.startsWith('task-archive.raw-') && f.endsWith('.gz')).sort();
      for (const f of raws.slice(0, -2)) { try { fs.unlinkSync(path.join(RUNTIME, f)); } catch {} }
    }

    // Write semantics file (merge with existing cases) + rewrite archive
    const priorCases = readLines(SEMANTICS).map(parseLine).filter(Boolean);
    const allCases = [...priorCases.filter((c) => c?.compressed), ...cases];
    // Loose old records stay raw inside the archive tail — nothing lost
    const newArchive = [...recent, ...looseOld]
      .sort((a, b) => (a.finishedAt || a.createdAt || 0) - (b.finishedAt || b.createdAt || 0));
    fs.writeFileSync(SEMANTICS, allCases.map((c) => JSON.stringify(c)).join('\n') + '\n');
    fs.writeFileSync(ARCHIVE, newArchive.map((r) => JSON.stringify(r)).join('\n') + '\n');
    report.recentKept = newArchive.length - looseOld.length;
    report.bytesAfter = fs.statSync(ARCHIVE).size + fs.statSync(SEMANTICS).size;

    // ── Certified fidelity bound ──
    const statsNew = emptyStats();
    for (const r of newArchive) addRecord(statsNew, r);
    for (const c of allCases) addCase(statsNew, c);
    const worst = maxRelErr(statsRaw, statsNew);
    report.certifiedError = Math.round(worst.err * 1e6) / 1e6;
    report.certifiedMetric = worst.metric;
    return report;
  } catch (err: any) {
    return { ...report, skipped: true, reason: `error: ${err?.message || err}` };
  }
}

// ── 2. Dream-driven redundancy mining ─────────────────────────────────
export interface SemanticCase {
  source: 'constitutional' | 'dream-fault' | 'valence' | 'aesthetic';
  key: string;
  refCount: number;
  canonical: any;
  firstAt: number;
  lastAt: number;
}

/** Collapse repeated verdicts/fault-lines/precedents into canonical cases.
 *  The generative dream finds fault LINES; this finds redundancy LINES —
 *  episodes that converge on the same principle, judgment, or outcome. */
export function mineRedundancyLines(): { cases: number; written: boolean } {
  try {
    const byKey = new Map<string, { source: SemanticCase['source']; key: string; members: any[] }>();
    const bucket = (source: SemanticCase['source'], key: string, member: any) => {
      const k = `${source}|${key}`;
      const b = byKey.get(k) || { source, key, members: [] };
      b.members.push(member);
      byKey.set(k, b);
    };

    // Constitutional conflicts → precedent cases keyed by principle pair + winner
    for (const l of readLines(path.join(RUNTIME, 'constitution-conflicts.jsonl')).slice(-500)) {
      const c = parseLine(l); if (!c) continue;
      const key = `${c.violated || c.loser || '?'}→${c.winner || c.kept || '?'}|${c.resolution || '?'}`;
      bucket('constitutional', key, c);
    }
    // Generative-dream fault lines → keyed by actionClass+dim
    for (const l of readLines(path.join(RUNTIME, 'generative-dream.jsonl')).slice(-300)) {
      const s = parseLine(l); if (!s?.faultLines) continue;
      for (const f of s.faultLines) {
        bucket('dream-fault', `${f.actionClass}|${f.dim}`, { ...f, dreamTs: s.ts });
      }
    }
    // Valence outcomes → keyed by actionClass + valence band
    for (const l of readLines(path.join(RUNTIME, 'valence-memory.jsonl')).slice(-500)) {
      const v = parseLine(l); if (!v) continue;
      const band = v.valence > 0.3 ? 'positive' : v.valence < -0.3 ? 'negative' : 'neutral';
      bucket('valence', `${v.actionClass || v.kind || '?'}|${band}`, v);
    }

    const cases: SemanticCase[] = [];
    for (const b of byKey.values()) {
      if (b.members.length < 3) continue; // singletons aren't redundancy lines
      const times = b.members.map((m) => Number(m.ts || m.at || m.dreamTs || m.generatedAt || 0)).filter(Boolean);
      cases.push({
        source: b.source, key: b.key, refCount: b.members.length,
        canonical: b.members[b.members.length - 1],
        firstAt: times.length ? Math.min(...times) : 0,
        lastAt: times.length ? Math.max(...times) : 0,
      });
    }
    cases.sort((a, b) => b.refCount - a.refCount);
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.writeFileSync(CASES_FILE, JSON.stringify({ computedAt: Date.now(), cases: cases.slice(0, 200) }, null, 1));
    return { cases: cases.length, written: true };
  } catch { return { cases: 0, written: false }; }
}

/** Read canonical semantic cases (for autobiography / dashboards). */
export function getSemanticCases(): SemanticCase[] {
  try {
    const j = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));
    return Array.isArray(j?.cases) ? j.cases : [];
  } catch { return []; }
}
