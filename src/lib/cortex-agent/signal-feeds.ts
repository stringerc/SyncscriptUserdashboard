/**
 * Signal Feeds — the measurement half of the life-goals engine.
 *
 * cortex-goals declares observable proxy signals ("sales_per_week",
 * "commits_per_week") but nothing populated them — drift detection and
 * forecasting were armed but unfed. This module computes REAL current-
 * period values from durable runtime state and maps user-declared
 * signal names onto them.
 *
 * Honesty contract: only signals we can actually measure get values.
 * Unknown signal names resolve to null — never fabricated.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface SignalFeedResult {
  /** signal name as declared on the goal → numeric value this period */
  values: Record<string, number>;
  /** which feed produced each value — audit trail */
  sources: Record<string, string>;
}

function readJsonSafe<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function countLastDays(file: string, tsField: string, days = 7, filter?: (row: any) => boolean): number {
  try {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let n = 0;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        const ts = Number(row?.[tsField] || row?.finishedAt || row?.createdAt || 0);
        if (ts >= cutoff && (!filter || filter(row))) n++;
      } catch {}
    }
    return n;
  } catch { return 0; }
}

/** All measurable signals for the current 7-day window. */
export function computeSignalFeeds(): Record<string, number> {
  const feeds: Record<string, number> = {};

  // Agent tasks completed this week (task-archive.jsonl).
  feeds.tasks_completed_week = countLastDays(
    path.join(RUNTIME, 'task-archive.jsonl'), 'finishedAt', 7,
    (row) => row?.status === 'completed' || row?.status === 'done',
  );

  // Mission ops items verified-done this week.
  try {
    const mission = readJsonSafe<any>(path.join(RUNTIME, 'mission.json'), { opsItems: [] });
    const cutoff = Date.now() - WEEK_MS;
    feeds.ops_completed_week = (mission?.opsItems || []).filter((o: any) =>
      o?.done === true && Number(o?.verifiedAt || 0) >= cutoff,
    ).length;
  } catch { feeds.ops_completed_week = 0; }

  // Conversational turns exchanged this week (continuity ledger).
  try {
    const cont = readJsonSafe<any>(path.join(RUNTIME, 'continuity.json'), { sessions: {} });
    const cutoff = Date.now() - WEEK_MS;
    let n = 0;
    for (const s of Object.values<any>(cont?.sessions || {})) {
      for (const t of s?.turns || []) if (Number(t?.ts || 0) >= cutoff) n++;
    }
    feeds.turns_exchanged_week = n;
  } catch { feeds.turns_exchanged_week = 0; }

  // Life events on the horizon (next 14 days, approved/proposed).
  try {
    const life = readJsonSafe<any>(path.join(RUNTIME, 'life-events.json'), { events: [] });
    const now = Date.now();
    const horizon = now + 14 * 24 * 60 * 60 * 1000;
    feeds.life_events_next_14d = (life?.events || []).filter((e: any) =>
      e?.status !== 'dismissed' && e?.status !== 'expired' &&
      typeof e?.dateStart === 'number' && e.dateStart >= now && e.dateStart <= horizon,
    ).length;
  } catch { feeds.life_events_next_14d = 0; }

  // Git commits this week — real work output, read-only command.
  try {
    const out = execSync('git rev-list --count --since="7 days ago" HEAD', {
      cwd: process.cwd(), encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    feeds.git_commits_week = parseInt(out, 10) || 0;
  } catch { feeds.git_commits_week = 0; }

  // Active venture cycles today.
  try {
    const ventures = readJsonSafe<any[]>(path.join(RUNTIME, 'ventures.json'), []);
    feeds.venture_cycles_today = (ventures || []).reduce((s: number, v: any) => s + (Number(v?.cyclesToday) || 0), 0);
  } catch { feeds.venture_cycles_today = 0; }

  return feeds;
}

/**
 * Map a goal-declared signal name onto a measurable feed.
 * Exact match first, then keyword aliases. Unknown → null (honest:
 * we don't fabricate metrics we can't measure).
 */
const SIGNAL_ALIASES: Record<string, string> = {
  sales_per_week: 'ops_completed_week',       // closest real proxy: shipped work
  commits_per_week: 'git_commits_week',
  commits_per_day: 'git_commits_week',
  tasks_per_week: 'tasks_completed_week',
  tasks_completed: 'tasks_completed_week',
  ops_per_week: 'ops_completed_week',
  conversations_per_week: 'turns_exchanged_week',
  messages_per_week: 'turns_exchanged_week',
  events_upcoming: 'life_events_next_14d',
  deadlines_upcoming: 'life_events_next_14d',
  venture_cycles: 'venture_cycles_today',
};

export function resolveSignalFeed(name: string, feeds: Record<string, number>): { feed: string; value: number } | null {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  if (key in feeds) return { feed: key, value: feeds[key] };
  if (key in SIGNAL_ALIASES) {
    const feed = SIGNAL_ALIASES[key];
    return feed in feeds ? { feed, value: feeds[feed] } : null;
  }
  // Fuzzy: 'weekly_commits', 'tasks done per week', etc.
  for (const [alias, feed] of Object.entries(SIGNAL_ALIASES)) {
    if (key.includes(alias) || alias.includes(key)) {
      return feed in feeds ? { feed, value: feeds[feed] } : null;
    }
  }
  return null;
}

export function resolveSignal(name: string, feeds: Record<string, number>): number | null {
  return resolveSignalFeed(name, feeds)?.value ?? null;
}

/** Resolve ALL declared signals across active goals into feed values. */
export function resolveGoalSignals(
  goals: Array<{ id: string; signals: string[] }>,
  feeds: Record<string, number>,
): { perGoal: Record<string, Record<string, number>>; allValues: Record<string, number>; sources: Record<string, string>; unresolved: string[] } {
  const perGoal: Record<string, Record<string, number>> = {};
  const allValues: Record<string, number> = {};
  const sources: Record<string, string> = {};
  const unresolved = new Set<string>();
  for (const g of goals) {
    const vals: Record<string, number> = {};
    for (const sig of g.signals || []) {
      const r = resolveSignalFeed(sig, feeds);
      if (!r) { unresolved.add(sig); continue; }
      vals[sig] = r.value;
      allValues[sig] = r.value;
      // Audit trail: which real feed produced this declared signal —
      // a proxy must be labeled a proxy downstream.
      sources[sig] = r.feed;
    }
    if (Object.keys(vals).length) perGoal[g.id] = vals;
  }
  return { perGoal, allValues, sources, unresolved: [...unresolved] };
}
