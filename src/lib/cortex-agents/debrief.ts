/**
 * Cortex DEBRIEF — Evening Shutdown Brief worker
 * (spec: CORTEX_EVENING_DEBRIEF_SPEC.md).
 *
 * Reconciles the day plan-vs-verified, asks up to 3 evidence-attached gap
 * questions, offloads tomorrow's loops as if-then intentions, and ends
 * with a closing signal. Read → compose → deliver; never mutates state,
 * never claims operator attention it can't verify.
 *
 * Delivery: Discord inline + iMessage via imsg (Mac-local, honest status).
 * No print — the morning packet carries prep.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { WorkerHandler } from './runtime';
import {
  composeDebrief, pickShutdown, pickOneThing,
  type DebriefData, type DebriefGap, type DebriefPriority, type DebriefTomorrowEvent,
} from '../cortex-debrief';
import { discordApi } from '../cortex-discord';
import { listStrategyProposals } from './strategy-proposals';
import { runEveningFleetDebrief } from './standup';

const RUNTIME_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const DEBRIEFS_DIR = path.join(RUNTIME_DIR, 'debriefs');
const DAY_MS = 86_400_000;
const GAP_MIN_AGE_MS = 3 * 3600_000;
function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return fallback; }
}
function readJsonl<T>(file: string, limit = 800): T[] {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-limit)
      .map((l) => { try { return JSON.parse(l) as T; } catch { return null; } })
      .filter((x): x is T => x !== null);
  } catch { return []; }
}
function localDayBounds(now: number): { start: number; end: number; dayKey: string } {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start, end: start + DAY_MS, dayKey };
}
function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

interface TaskRow { agentId?: string; kind?: string; title?: string; status?: string; createdAt?: number; finishedAt?: number; result?: any; }

async function gatherDebriefData(now: number): Promise<{ data: DebriefData; raw: Record<string, unknown> }> {
  const { start, end, dayKey } = localDayBounds(now);
  const degradedSources: string[] = [];

  // ── §1 LEDGER: today's verified vs attempted ──
  const tasks = readJsonl<TaskRow>(path.join(RUNTIME_DIR, 'task-archive.jsonl'));
  const todayTasks = tasks.filter((t) => (t.createdAt ?? 0) >= start && (t.createdAt ?? 0) < end);
  const completed = todayTasks.filter((t) => t.status === 'completed');
  const verifiedRows = completed.filter((t) => t.result?.status === 'verified' || t.result?.verified === true);
  const failed = todayTasks.filter((t) => t.status === 'failed');
  const verified = verifiedRows.slice(0, 3).map((t) => `${t.agentId || '?'}: ${String(t.title || t.kind || 'task').slice(0, 60)}`);
  const failedTitles = failed.slice(0, 3).map((t) => `${t.agentId || '?'}: ${String(t.title || t.kind || 'task').slice(0, 50)}`);

  // ── Fleet Retrospective (20:00 PM) ──
  try {
    const standup = await runEveningFleetDebrief({ dateKey: dayKey, dryRun: true });
    if (standup) {
      verified.push(`Fleet Retrospective: ${standup.healthyCount}/${standup.totalAgents} operational (${standup.degradedCount} degraded)`);
    }
  } catch { }

  // ── §2 GAP: plan-vs-outcome questions (max 3, evidence-attached) ──
  const gaps: DebriefGap[] = [];

  // 2a. Stale proposals — sat >3h unanswered
  const pending = listStrategyProposals('pending');
  const staleProps = pending
    .filter((p: any) => now - (p.createdAt ?? now) > GAP_MIN_AGE_MS)
    .sort((a: any, b: any) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  for (const p of staleProps.slice(0, 2)) {
    const ageH = Math.round((now - (p.createdAt ?? now)) / 3600_000);
    gaps.push({
      question: `"${String(p.title || 'proposal').slice(0, 60)}" waited ${ageH}h for an answer — what got in the way?`,
      evidence: `proposal ${p.id} · filed ${new Date(p.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
    });
  }

  // 2b. Incidents that fired today
  const incidents = readJson<{ incidents?: any[] }>(path.join(RUNTIME_DIR, 'incidents.json'), { incidents: [] });
  const todayInc = (incidents.incidents || []).filter((i: any) => {
    const t = i?.firstSeenAt ?? i?.createdAt ?? 0;
    return t >= start && t < end;
  });
  for (const inc of todayInc.slice(0, 1)) {
    const at = new Date(inc.firstSeenAt ?? inc.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    gaps.push({
      question: `Incident fired at ${at} (${String(inc.kind || inc.title || 'unknown').slice(0, 50)}) — did the alert reach you in time?`,
      evidence: `incident ${inc.id || '?'} · status ${inc.status || 'open'}`,
    });
  }

  // 2c. Task failures today
  if (failed.length && gaps.length < 3) {
    gaps.push({
      question: `${failed.length} task${failed.length > 1 ? 's' : ''} failed today — want the failure list, or was it expected churn?`,
      evidence: failedTitles.slice(0, 2).join('; '),
    });
  }

  // 2d. Tomorrow events lacking prep (computed below, merged after)

  // ── §3 TOMORROW: events + prep status ──
  const calFeed = readJson<{ events?: any[] }>(path.join(RUNTIME_DIR, 'calendar-upcoming.json'), { events: [] });
  const tomorrowStart = start + DAY_MS;
  const tomorrowEnd = start + 2 * DAY_MS;
  const prepDir = path.join(RUNTIME_DIR, 'prep-briefs');
  let prepFiles: string[] = [];
  try { prepFiles = fs.readdirSync(prepDir).filter((f) => f.endsWith('.md')); } catch {}
  const prepFor = (title: string) => {
    const n = normTitle(title);
    const hit = prepFiles.find((f) => f.includes(n) || n.includes(f.replace(/\.(md)$/, '').replace(/^(prep|engage)-/, '').slice(0, 30)));
    if (!hit) return 'none' as const;
    return hit.startsWith('engage-') ? 'plan' as const : 'ready' as const;
  };
  const tomorrowEvents: DebriefTomorrowEvent[] = (calFeed.events || [])
    .map((e: any) => ({
      title: String(e?.title ?? ''),
      start: Number(e?.start ?? e?.startTime ?? 0),
      end: Number(e?.end ?? e?.endTime) || undefined,
    }))
    .filter((e) => e.title && e.start >= tomorrowStart && e.start < tomorrowEnd)
    .sort((a, b) => a.start - b.start)
    .slice(0, 6)
    .map((e) => ({
      title: e.title,
      time: new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      prep: prepFor(e.title),
    }));

  // 2d continued: no-prep events become gap questions if room remains
  const noPrep = tomorrowEvents.filter((e) => e.prep === 'none');
  if (noPrep.length && gaps.length < 3) {
    gaps.push({
      question: `${noPrep.length} event${noPrep.length > 1 ? 's' : ''} tomorrow ha${noPrep.length > 1 ? 've' : 's'} no prep yet (${noPrep.slice(0, 2).map((e) => e.title.slice(0, 30)).join(', ')}${noPrep.length > 2 ? '…' : ''}) — want me to flag prep gaps louder?`,
      evidence: 'prep_sweep runs 21:00 · briefs dir checked',
    });
  }

  // ── §3 priorities: open loops rendered as if-then intentions ──
  const priorities: DebriefPriority[] = [];
  const openInc = (incidents.incidents || []).filter((i: any) => i?.status === 'open' || !i?.resolvedAt).slice(0, 2);
  for (const inc of openInc) {
    priorities.push({
      text: `Resolve open incident: ${String(inc.kind || inc.title || 'unknown').slice(0, 60)}`,
      firstAction: `open Inbox → check incident ${inc.id || '?'} → approve or dismiss`,
    });
  }
  for (const p of pending.slice(0, 3 - priorities.length)) {
    priorities.push({
      text: `Decide: ${String(p.title || 'proposal').slice(0, 70)}`,
      firstAction: `Inbox → ${String(p.id).slice(0, 24)} → approve/dismiss (2 min)`,
    });
  }

  // ── Open loops offload (Scullin mechanism) ──
  const openLoops: string[] = [];
  for (const p of pending.slice(0, 3)) openLoops.push(`decide: ${String(p.title || '').slice(0, 40)}`);
  for (const inc of openInc.slice(0, 2)) openLoops.push(`incident: ${String(inc.kind || '').slice(0, 40)}`);
  for (const t of failed.slice(0, 2)) openLoops.push(`failed: ${String(t.title || t.kind || '').slice(0, 40)}`);

  // ── One-thing + shutdown: anti-repeat via state files ──
  fs.mkdirSync(DEBRIEFS_DIR, { recursive: true });
  const qState = readJson<{ recent: string[] }>(path.join(DEBRIEFS_DIR, 'one-thing-state.json'), { recent: [] });
  const oneThing = pickOneThing(dayKey, qState.recent || []);
  fs.writeFileSync(path.join(DEBRIEFS_DIR, 'one-thing-state.json'), JSON.stringify({ recent: [oneThing, ...(qState.recent || [])].slice(0, 14) }));

  const sState = readJson<{ recent: string[] }>(path.join(DEBRIEFS_DIR, 'shutdown-state.json'), { recent: [] });
  const shutdown = pickShutdown(dayKey, sState.recent || []);
  fs.writeFileSync(path.join(DEBRIEFS_DIR, 'shutdown-state.json'), JSON.stringify({ recent: [shutdown, ...(sState.recent || [])].slice(0, 14) }));

  // ── Yesterday's answers (Discord reply capture → answers.jsonl) ──
  const answers: string[] = [];
  try {
    const lines = fs.readFileSync(path.join(DEBRIEFS_DIR, 'answers.jsonl'), 'utf8').split('\n').filter(Boolean).slice(-40);
    for (const l of lines) {
      try {
        const a = JSON.parse(l);
        if (now - (a.at ?? 0) < DAY_MS && a.text) answers.push(String(a.text).slice(0, 140));
      } catch {}
    }
  } catch {}

  // ── Degraded sources: last radar sweep coverage ──
  const radarLedger = readJson<{ coverage?: { source: string; ok: boolean; note?: string }[] }>(path.join(RUNTIME_DIR, 'life-events.json'), {});
  for (const c of radarLedger.coverage || []) {
    if (!c.ok) degradedSources.push(`${c.source}${c.note ? ` (${c.note.slice(0, 40)})` : ''}`);
  }

  const longDate = new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const data: DebriefData = {
    dayKey, longDate,
    verified, attempted: completed.length, failedCount: failed.length, failedTitles,
    gaps, tomorrowEvents, priorities, openLoops,
    oneThing, shutdown, degradedSources, answers: answers.slice(0, 4),
    generatedAt: now,
  };
  return {
    data,
    raw: { tasksToday: todayTasks.length, verified: verifiedRows.length, failed: failed.length, gaps: gaps.length, tomorrowEvents: tomorrowEvents.length, pendingProposals: pending.length },
  };
}

export function makeDebriefWorker(deps: {
  sendDiscord?: (content: string) => Promise<boolean>;
  sendIMessage?: (text: string) => Promise<{ ok: boolean; error?: string }>;
  now?: () => number;
} = {}): WorkerHandler {
  return async (ctx) => {
    const now = deps.now?.() ?? Date.now();
    ctx.progress(0.15);
    const { data, raw } = await gatherDebriefData(now);
    ctx.progress(0.6);

    const debrief = composeDebrief(data);
    ctx.progress(0.8);

    // Persist artifacts
    const dayKey = data.dayKey;
    const jsonPath = path.join(DEBRIEFS_DIR, `${dayKey}.json`);
    const mdPath = path.join(DEBRIEFS_DIR, `${dayKey}.md`);
    fs.mkdirSync(DEBRIEFS_DIR, { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify({ data, phoneText: debrief.phoneText }, null, 1));
    fs.writeFileSync(mdPath, debrief.markdown);
    fs.writeFileSync(path.join(DEBRIEFS_DIR, 'latest.json'), JSON.stringify({ dayKey, jsonPath, mdPath, generatedAt: now }));
    ctx.progress(0.9);

    // Discord push
    let discordSent = false; let discordError: string | undefined;
    const token = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_CHANNEL_BRIEFS || process.env.DISCORD_CHANNEL_ID;
    if (deps.sendDiscord) {
      discordSent = await deps.sendDiscord(debrief.phoneText.slice(0, 1900)).catch(() => false);
    } else if (token && channelId) {
      try {
        const chunks: string[] = [];
        let rest = debrief.phoneText;
        while (rest.length > 1900) { chunks.push(rest.slice(0, 1900)); rest = rest.slice(1900); }
        chunks.push(rest);
        for (const c of chunks.slice(0, 2)) {
          await discordApi('POST', `/channels/${channelId}/messages`, { token, body: { content: c.slice(0, 1990) } });
        }
        discordSent = true;
      } catch (e: any) { discordError = String(e?.message || e).slice(0, 120); }
    } else {
      discordError = 'DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID not set';
    }

    // iMessage — imsg hangs when spawned inside the long-lived vite process
    // (verified: standalone node/launchd sends complete in ~10-25s, in-process
    // calls hit the 60s execFile timeout). Proven path: queue the payload and
    // let scripts/cortex-debrief-deliver.mjs (launchd, Mac-side) send it —
    // same architecture as the morning brief. Status is 'queued', never 'sent'.
    let imessage: { ok: boolean; status?: string; error?: string } = { ok: false, status: 'queued' };
    if (deps.sendIMessage) {
      const r = await deps.sendIMessage(debrief.phoneText).catch((e: any) => ({ ok: false, error: String(e?.message || e).slice(0, 120) }));
      imessage = { ok: r.ok, ...(r.ok ? {} : { error: r.error }) };
    } else {
      try {
        fs.writeFileSync(path.join(DEBRIEFS_DIR, 'imessage-pending.txt'), debrief.phoneText);
      } catch (e: any) {
        imessage = { ok: false, error: `queue write failed: ${String(e?.message || e).slice(0, 80)}` };
      }
    }
    ctx.progress(1);

    return {
      ok: true,
      dayKey,
      artifacts: { json: jsonPath, markdown: mdPath },
      phoneChars: debrief.phoneText.length,
      trimmedForCap: debrief.stats.droppedForCap,
      sections: debrief.sections.map((s) => `${s.title}(${s.lines.length})`),
      gaps: data.gaps.length,
      tomorrowEvents: data.tomorrowEvents.length,
      discordSent,
      ...(discordError ? { discordError } : {}),
      imessage,
      degradedSources: data.degradedSources,
      inputs: raw,
    };
  };
}
