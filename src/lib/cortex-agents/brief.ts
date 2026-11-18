/**
 * Cortex BRIEF — Chief's Brief worker (spec: CORTEX_MORNING_PROTOCOL_SPEC.md).
 *
 * Assembles the daily morning brief from real runtime state only:
 * task archive, forecasts ledger, proposals, incidents, calendar feed,
 * model health, Gmail summary. Composes via cortex-morning-brief.ts,
 * writes artifacts to .cortex-runtime/briefs/, pushes Discord.
 *
 * iMessage + print delivery happen Mac-side via
 * scripts/cortex-morning-deliver.mjs (launchd) — this worker never
 * claims delivery it didn't perform; it records artifact paths and the
 * deliver script writes delivery-status.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { WorkerHandler } from './runtime';
import {
  composeBrief, pickGreeting, pickSpotlight,
  type BriefData, type BriefDecision, type BriefEvent, type BriefWatchItem,
} from '../cortex-morning-brief';
import { discordApi } from '../cortex-discord';
import { listStrategyProposals } from './strategy-proposals';
import { getCortexEnergySpineBridge } from '../cortex-energy-spine';
import { ensureMorningFleetStandup } from './standup';

const RUNTIME_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const BRIEFS_DIR = path.join(RUNTIME_DIR, 'briefs');
const BASE = `http://127.0.0.1:${process.env.PORT ? parseInt(process.env.PORT) : 5173}`;

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return fallback; }
}
function readJsonl<T>(file: string, limit = 500): T[] {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-limit)
      .map((l) => { try { return JSON.parse(l) as T; } catch { return null; } })
      .filter((x): x is T => x !== null);
  } catch { return []; }
}

const DAY_MS = 86_400_000;
const MAX_FAILED_NAMED = 3;

interface TaskRow { agentId?: string; kind?: string; title?: string; status?: string; createdAt?: number; finishedAt?: number; result?: any; }

function todayBounds(now: number): { start: number; end: number; dayKey: string } {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  // Local day key — toISOString() would roll to tomorrow every evening UTC.
  const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start, end: start + DAY_MS, dayKey };
}

function isPersonalEvent(title: string): boolean {
  return /daughter|son|kid|child|family|birthday|anniversary|doctor|dentist|school|pickup|pick-up|call with/i.test(title);
}

function classifyEvent(e: any): 'work' | 'personal' | 'legal' | 'family' | 'health' {
  const t = String(e?.title || '').toLowerCase();
  if (/court|legal|attorney|lawyer|lampros|appeal|hearing|deposition/i.test(t)) return 'legal';
  if (/doctor|dentist|therapy|appointment|checkup/i.test(t)) return 'health';
  if (isPersonalEvent(t)) return /daughter|son|kid|child/i.test(t) ? 'family' : 'personal';
  return 'work';
}

async function gatherBriefData(now: number): Promise<{ data: BriefData; raw: Record<string, unknown> }> {
  const { start, end, dayKey } = todayBounds(now);
  const coverage: BriefData['coverage'] = [];

  // ── Tasks: today's archive stats ──
  const tasks = readJsonl<TaskRow>(path.join(RUNTIME_DIR, 'task-archive.jsonl'));
  const todayTasks = tasks.filter((t) => (t.createdAt ?? 0) >= start && (t.createdAt ?? 0) < end);
  const completed = todayTasks.filter((t) => t.status === 'completed');
  const verified = completed.filter((t) => t.result?.status === 'verified' || t.result?.verified === true);
  const failed = todayTasks.filter((t) => t.status === 'failed');
  const stats = {
    completed: completed.length,
    verified: verified.length,
    failed: failed.length,
    failedTitles: failed.slice(-MAX_FAILED_NAMED).map((t) => `${t.agentId || '?'}: ${(t.title || t.kind || 'task').slice(0, 60)}`),
  };
  coverage.push({ source: 'task-archive', ok: tasks.length > 0 });

  // ── Forecasts: today's routed signals → watch items ──
  const forecasts = readJsonl<any>(path.join(RUNTIME_DIR, 'forecasts.jsonl'), 200)
    .filter((f) => (f?.at ?? 0) >= start - DAY_MS && (f?.at ?? 0) <= now);
  const watchItems: BriefWatchItem[] = [];
  for (const f of forecasts.slice(-30)) {
    const claim = String(f?.claim || f?.signal?.claim || '');
    if (!claim) continue;
    const urg = String(f?.urgency || f?.signal?.urgency || 'ambient');
    watchItems.push({
      text: claim.slice(0, 110),
      severity: urg === 'interrupt' ? 'crit' : urg === 'proposal' ? 'warn' : 'info',
    });
  }
  coverage.push({ source: 'forecasts', ok: forecasts.length > 0 });

  // ── Incidents: open tickets → watch items ──
  const incidents = readJson<{ incidents?: any[] }>(path.join(RUNTIME_DIR, 'incidents.json'), { incidents: [] });
  const openInc = (incidents.incidents || []).filter((i: any) => i?.status === 'open' || !i?.resolvedAt);
  for (const inc of openInc.slice(0, 4)) {
    watchItems.push({
      text: `Incident open ${Math.round(((now - (inc.firstSeenAt ?? inc.createdAt ?? now)) / 60000))}min: ${String(inc.kind || inc.title || 'unknown').slice(0, 80)}`,
      severity: 'warn',
    });
  }
  coverage.push({ source: 'incidents', ok: true });

  // ── Proposals: pending = decisions + count ──
  const proposals = listStrategyProposals('pending');
  const proactive = readJson<{ proposals?: any[] }>(path.join(RUNTIME_DIR, 'proactive-proposals.json'), { proposals: [] });
  const pendingProp = proposals.length + (proactive.proposals || []).filter((p: any) => p.status === 'pending').length;
  const decisions: BriefDecision[] = proposals.slice(0, 5).map((p: any) => ({
    id: p.id,
    text: String(p.title || p.instruction || 'proposal').slice(0, 120),
    deadline: p.action?.type === 'budgetRaise' ? 'today' : undefined,
    source: `proposal:${p.id}`,
  }));
  coverage.push({ source: 'proposals', ok: true });

  // ── Calendar: today's events ──
  const calFeed = readJson<{ events?: any[] }>(path.join(RUNTIME_DIR, 'calendar-upcoming.json'), { events: [] });
  const events: BriefEvent[] = (calFeed.events || [])
    .map((e: any) => ({
      id: String(e?.id ?? ''),
      title: String(e?.title ?? e?.summary ?? ''),
      start: Number(e?.start ?? e?.startTime ?? 0),
      end: Number.isFinite(Number(e?.end ?? e?.endTime)) ? Number(e?.end ?? e?.endTime) : undefined,
      attendees: Array.isArray(e?.attendees) ? e.attendees.length : Number(e?.attendees) || 0,
      attendeeNames: Array.isArray(e?.attendees)
        ? e.attendees.map((a: any) => String(a?.email ?? a?.name ?? a)).filter(Boolean)
        : Array.isArray(e?.attendeeNames) ? e.attendeeNames.map(String) : undefined,
      hasPrepBrief: e?.hasPrepBrief === true,
      kind: classifyEvent(e),
    }))
    .filter((e) => e.title && e.start >= start && e.start < end)
    .sort((a, b) => a.start - b.start);
  coverage.push({ source: 'calendar', ok: (calFeed.events || []).length > 0, note: (calFeed.events || []).length ? undefined : 'feed empty — client may not have pushed' });

  const personalEvents = events.filter((e) => e.kind === 'personal' || e.kind === 'family' || e.kind === 'legal' || e.kind === 'health');
  const workEvents = events.filter((e) => !personalEvents.includes(e));

  // ── Prep status: briefs written today ──
  const briefsDir = path.join(RUNTIME_DIR, 'prep-briefs');
  let prepReady = 0; const prepTitles: string[] = [];
  try {
    for (const f of fs.readdirSync(briefsDir).filter((x) => x.endsWith('.md'))) {
      const stat = fs.statSync(path.join(briefsDir, f));
      if (stat.mtimeMs >= start) { prepReady++; prepTitles.push(f.replace(/^prep-/, '').replace(/\.md$/, '')); }
    }
  } catch {}
  const prepStatus = { ready: prepReady, pending: Math.max(0, workEvents.filter((e) => (e.attendees ?? 0) > 0 && !e.hasPrepBrief).length), titles: prepTitles.slice(0, 4) };
  coverage.push({ source: 'prep-briefs', ok: true });

  // ── Model health watch ──
  const registry = readJson<{ models?: any[]; candidates?: any[] }>(path.join(RUNTIME_DIR, 'model-registry.json'), {});
  const models = registry.models || registry.candidates || [];
  const down = models.filter((m: any) => m?.status === 'down' || m?.health === 'down' || (m?.cooldownUntil ?? 0) > now).slice(0, 3);
  for (const m of down) {
    watchItems.push({ text: `Model lane degraded: ${m.provider || m.id || 'unknown'} (${m.model || ''})`, severity: 'warn' });
  }

  // ── Gmail: waiting-on-you ──
  let gmailNote: string | undefined;
  try {
    const res = await fetch(`${BASE}/api/cortex/gmail/live-inbox`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const inbox: any = await res.json();
      const unread = Number(inbox?.unreadCount ?? 0);
      if (unread > 0) watchItems.push({ text: `${unread} unread in Gmail inbox`, severity: 'info' });
      coverage.push({ source: 'gmail', ok: true });
    } else { coverage.push({ source: 'gmail', ok: false, note: `HTTP ${res.status}` }); }
  } catch (e: any) {
    coverage.push({ source: 'gmail', ok: false, note: String(e?.message || 'unreachable').slice(0, 60) });
  }

  // ── Fleet Standup Roll Call (06:00 AM) ──
  try {
    const standup = await ensureMorningFleetStandup(dayKey);
    if (standup) {
      const degradedText = standup.degradedCount > 0 ? ` (${standup.degradedCount} degraded)` : '';
      watchItems.unshift({
        text: `Fleet Roll Call: ${standup.healthyCount}/${standup.totalAgents} operational${degradedText} · ${standup.filedProposals} high-leverage initiatives queued`,
        severity: standup.degradedCount > 0 ? 'warn' : 'info',
      });
      coverage.push({ source: 'fleet-standup', ok: true });
    }
  } catch (err: any) {
    coverage.push({ source: 'fleet-standup', ok: false, note: String(err?.message || 'failed') });
  }

  // ── Radar hits (life-events ledger) ──
  const radarLedger = readJson<{ events?: any[] }>(path.join(RUNTIME_DIR, 'life-events.json'), { events: [] });
  const radarHits = (radarLedger.events || [])
    .filter((r: any) => r.status === 'proposed' || r.status === 'candidate')
    .slice(0, 5)
    .map((r: any) => ({
      id: r.id,
      text: `${r.kind || 'event'}: ${String(r.title || '').slice(0, 70)} — ${r.dateStart ? new Date(r.dateStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'date TBD'}${r.needsApproval === false ? '' : ' [approve in Inbox]'}`,
      needsApproval: true,
    }));
  coverage.push({ source: 'life-radar', ok: true });

  // ── Greeting: anti-repeat via state file ──
  const greetState = readJson<{ recent: string[] }>(path.join(BRIEFS_DIR, 'greeting-state.json'), { recent: [] });
  const greeting = pickGreeting(dayKey, greetState.recent || []);

  // ── Spotlight: oldest pending proposal or stalest task ──
  const oldestProp = proposals.length
    ? proposals.reduce((a, b) => (a.createdAt ?? 0) < (b.createdAt ?? 0) ? a : b)
    : undefined;
  const openTasks = tasks.filter((t) => t.status === 'queued' || t.status === 'running');
  const stalest = openTasks.length
    ? openTasks.reduce((a, b) => (a.createdAt ?? 0) < (b.createdAt ?? 0) ? a : b)
    : undefined;
  const spotlight = pickSpotlight({
    dayKey,
    oldestPendingProposal: oldestProp ? { title: String(oldestProp.title || ''), ageDays: Math.floor((now - (oldestProp.createdAt ?? now)) / DAY_MS) } : undefined,
    stalestTask: stalest ? { title: String(stalest.title || stalest.kind || ''), ageDays: Math.floor((now - (stalest.createdAt ?? now)) / DAY_MS) } : undefined,
  });

  const longDate = new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Circadian peak window — honest absence if the bridge can't compute one.
  let energyPeak: BriefData['energyPeak'];
  try {
    const peak = getCortexEnergySpineBridge().getNextPeakEnergyWindow(new Date(now));
    if (peak.startTime.getTime() < end) {
      energyPeak = {
        start: peak.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        end: peak.endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        label: `${peak.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}–${peak.endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} (bio-energy ${Math.round(peak.energyScore * 100)}%)`,
      };
    }
  } catch {}

  const data: BriefData = {
    dayKey,
    longDate,
    greeting,
    decisions,
    events: workEvents,
    energyPeak,
    stats,
    watchItems: watchItems.slice(0, 12),
    personalEvents,
    radarHits,
    spotlight,
    prepStatus,
    pendingProposalCount: pendingProp,
    coverage,
    generatedAt: now,
  };

  return { data, raw: { tasks: todayTasks.length, forecasts: forecasts.length, proposals: proposals.length, events: events.length } };
}

export function makeBriefWorker(deps: {
  fetchJson?: (url: string) => Promise<any>;
  sendDiscord?: (content: string, embeds?: any[]) => Promise<boolean>;
  now?: () => number;
} = {}): WorkerHandler {
  return async (ctx) => {
    const now = deps.now?.() ?? Date.now();
    ctx.progress(0.15);
    const { data, raw } = await gatherBriefData(now);
    ctx.progress(0.55);

    const brief = composeBrief(data);
    ctx.progress(0.75);

    // Persist greeting for anti-repeat
    try {
      fs.mkdirSync(BRIEFS_DIR, { recursive: true });
      const gs = readJson<{ recent: string[] }>(path.join(BRIEFS_DIR, 'greeting-state.json'), { recent: [] });
      const recent = [brief.greeting, ...(gs.recent || [])].slice(0, 14);
      fs.writeFileSync(path.join(BRIEFS_DIR, 'greeting-state.json'), JSON.stringify({ recent }));
    } catch {}

    const dayKey = data.dayKey;
    const jsonPath = path.join(BRIEFS_DIR, `${dayKey}.json`);
    const mdPath = path.join(BRIEFS_DIR, `${dayKey}.md`);
    const htmlPath = path.join(BRIEFS_DIR, `${dayKey}.html`);
    fs.mkdirSync(BRIEFS_DIR, { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify({ data, brief: { phoneText: brief.phoneText, sections: brief.sections.map(s => s.key) } }, null, 1));
    fs.writeFileSync(mdPath, brief.markdown);
    fs.writeFileSync(htmlPath, brief.printHtml);
    fs.writeFileSync(path.join(BRIEFS_DIR, 'latest.json'), JSON.stringify({ dayKey, jsonPath, mdPath, htmlPath, generatedAt: now }));
    ctx.progress(0.9);

    // Discord push — server-side, best-effort, honestly reported
    let discordSent = false; let discordError: string | undefined;
    const token = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_CHANNEL_BRIEFS || process.env.DISCORD_CHANNEL_ID;
    if (deps.sendDiscord) {
      discordSent = await deps.sendDiscord(brief.phoneText.slice(0, 1900)).catch(() => false);
    } else if (token && channelId) {
      try {
        // Discord messages cap at 2000 chars — split if needed
        const chunks: string[] = [];
        let rest = brief.phoneText;
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
    ctx.progress(1);

    return {
      ok: true,
      dayKey,
      greeting: brief.greeting,
      artifacts: { json: jsonPath, markdown: mdPath, printHtml: htmlPath },
      phoneChars: brief.phoneText.length,
      trimmedForCap: brief.stats.droppedForCap,
      sections: brief.sections.map((s) => `${s.title}(${s.lines.length})`),
      decisions: data.decisions.length,
      eventsToday: data.events.length + data.personalEvents.length,
      discordSent,
      ...(discordError ? { discordError } : {}),
      inputs: raw,
      note: 'iMessage + print delivery runs Mac-side via scripts/cortex-morning-deliver.mjs — check delivery-status.json',
    };
  };
}
