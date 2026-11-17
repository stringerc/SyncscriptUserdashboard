/**
 * Cortex PREP — meeting ready-writer (spec: CORTEX_PREP_SPEC.md).
 *
 * Builds cited prep briefs before meetings: attendee history, open items,
 * suggested agenda. Every claim carries an EvidenceRef or it is dropped at
 * validation time — a brief line without a source never ships.
 *
 * Local-only by design: briefs are files under .cortex-runtime/prep-briefs/
 * plus an initiative proposal. Nothing is ever sent externally without an
 * explicit user action (the Fireflies all-participants leak is the
 * cautionary tale this contract exists to prevent).
 */

import fs from 'node:fs';
import path from 'node:path';
import type { WorkerHandler } from './runtime';
import { rulesBlock } from './rules';
import { drainSafePending, listProposals, isSafeAutoProposal } from '../cortex-initiative-ledger';

const RUNTIME_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const BRIEFS_DIR = path.join(RUNTIME_DIR, 'prep-briefs');

export interface PrepSource {
  kind: 'gmail' | 'memory' | 'calendar' | 'brief' | 'web';
  ref: string;
  label: string;
  text: string;
}

export interface PrepBrief {
  id: string;
  meetingTitle: string;
  meetingStart?: number;
  attendees: string[];
  sections: {
    history: string[];
    openItems: string[];
    agenda: string[];
    watchFor: string[];
  };
  sources: PrepSource[];
  droppedUncited: number;
  createdAt: number;
}

/** Citation contract: every content line must end with `— src: <kind>:<ref>`.
 *  Lines failing the check are dropped and counted, never softened. */
const SRC_RE = /—\s*src:\s*([a-z]+):([^\s|]+)/i;

export function validateCitedLines(
  lines: string[],
  knownSources: Map<string, PrepSource>,
): { kept: string[]; dropped: number } {
  const kept: string[] = [];
  let dropped = 0;
  for (const raw of lines) {
    const line = String(raw || '').trim();
    if (!line || line.startsWith('#')) { if (line) kept.push(line); continue; }
    const m = line.match(SRC_RE);
    if (!m) { dropped++; continue; }
    const key = `${m[1].toLowerCase()}:${m[2]}`;
    if (!knownSources.has(key)) { dropped++; continue; }
    kept.push(line);
  }
  return { kept, dropped };
}

function sourcesFromContext(contexts: { kind: PrepSource['kind']; ref: string; label: string; text: string }[]): {
  sources: PrepSource[];
  digest: string;
  known: Map<string, PrepSource>;
} {
  const sources: PrepSource[] = [];
  const known = new Map<string, PrepSource>();
  const digestParts: string[] = [];
  for (const c of contexts) {
    const src: PrepSource = { kind: c.kind, ref: c.ref, label: c.label, text: c.text.slice(0, 1200) };
    sources.push(src);
    known.set(`${src.kind}:${src.ref}`, src);
    digestParts.push(`[${src.kind}:${src.ref}] ${src.label}\n${src.text.slice(0, 1200)}`);
  }
  return { sources, digest: digestParts.join('\n\n---\n\n'), known };
}

/** Gather attendee context from real channels only. Each channel returns
 *  PrepSource entries; empty channels contribute nothing (honest silence). */
async function gatherContext(
  meeting: { title: string; attendees: string[]; start?: number },
  deps: {
    searchMemory: (query: string) => Promise<unknown>;
    fetchInbox: () => Promise<{ threads?: any[] } | null>;
  },
): Promise<ReturnType<typeof sourcesFromContext>> {
  const contexts: { kind: PrepSource['kind']; ref: string; label: string; text: string }[] = [];

  // Memory recall per attendee + meeting title.
  const queries = [...meeting.attendees.slice(0, 4), meeting.title].filter(Boolean);
  for (const q of queries) {
    try {
      const mem: any = await deps.searchMemory(q);
      const items = Array.isArray(mem) ? mem : Array.isArray(mem?.results) ? mem.results : mem?.memories || [];
      const text = JSON.stringify(items).slice(0, 2000);
      if (text && text !== '[]' && text !== '{}') {
        contexts.push({ kind: 'memory', ref: q.slice(0, 60), label: `memory: ${q}`, text });
      }
    } catch {}
  }

  // Gmail threads mentioning attendee names.
  try {
    const inbox = await deps.fetchInbox();
    const threads: any[] = Array.isArray(inbox?.threads) ? inbox.threads : [];
    for (const t of threads.slice(0, 30)) {
      const hay = `${t?.sender || t?.from || ''} ${t?.subject || ''}`.toLowerCase();
      const hit = meeting.attendees.find((a) => a && hay.includes(String(a).toLowerCase().split(' ')[0] || ''));
      if (hit) {
        contexts.push({
          kind: 'gmail',
          ref: String(t?.id || t?.threadId || t?.subject || 'thread').slice(0, 80),
          label: `gmail: ${t?.subject || 'thread'}`,
          text: `${t?.sender || t?.from || ''} — ${t?.subject || ''} (${t?.date || 'unknown date'})`,
        });
      }
    }
  } catch {}

  if (meeting.start) {
    contexts.push({
      kind: 'calendar',
      ref: String(meeting.start),
      label: 'calendar event',
      text: `Meeting "${meeting.title}" at ${new Date(meeting.start).toISOString()} with ${meeting.attendees.length} attendee(s).`,
    });
  }

  return sourcesFromContext(contexts);
}

/** Parse the model's brief into sections. The model is instructed to emit
 *  `SECTION:` headers and `- ` bullets ending in `— src: kind:ref`. */
export function parseBriefSections(text: string): PrepBrief['sections'] & { raw: string } {
  const sections = { history: [] as string[], openItems: [] as string[], agenda: [] as string[], watchFor: [] as string[] };
  let current: keyof typeof sections | null = null;
  for (const line of String(text || '').split('\n')) {
    const h = line.match(/^\s*(?:#{1,3}\s*)?(history|open\s*items?|agenda|watch\s*for|watchouts?)\s*:?\s*$/i);
    if (h) {
      const key = h[1].toLowerCase().startsWith('open') ? 'openItems'
        : h[1].toLowerCase().startsWith('agenda') ? 'agenda'
        : h[1].toLowerCase().startsWith('watch') ? 'watchFor' : 'history';
      current = key;
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet && current) sections[current].push(bullet[1].trim());
  }
  return { ...sections, raw: text };
}

export function renderBriefMarkdown(brief: PrepBrief): string {
  const sec = (title: string, lines: string[]) =>
    lines.length ? `\n## ${title}\n${lines.map((l) => `- ${l}`).join('\n')}\n` : '';
  return [
    `# Prep — ${brief.meetingTitle}`,
    brief.meetingStart ? `_ ${new Date(brief.meetingStart).toISOString()} · attendees: ${brief.attendees.join(', ') || 'unknown'}_` : '',
    sec('History', brief.sections.history),
    sec('Open items', brief.sections.openItems),
    sec('Suggested agenda', brief.sections.agenda),
    sec('Watch for', brief.sections.watchFor),
    brief.droppedUncited ? `\n_(${brief.droppedUncited} uncited claim(s) dropped — evidence contract)_` : '',
    `\n---\nSources: ${brief.sources.map((s) => `${s.kind}:${s.ref}`).join(', ') || 'none'}\n`,
  ].filter(Boolean).join('\n');
}

export function writeBriefFile(brief: PrepBrief): string {
  fs.mkdirSync(BRIEFS_DIR, { recursive: true });
  const file = path.join(BRIEFS_DIR, `${brief.id}.md`);
  fs.writeFileSync(file, renderBriefMarkdown(brief));
  return file;
}

// ── Worker ─────────────────────────────────────────────────────────

export function makePrepWorker(deps: {
  toolExecute: (name: string, args: Record<string, unknown>, timeoutMs?: number, telemetry?: any) => Promise<{ ok: boolean; [k: string]: unknown }>;
  fetchInbox: () => Promise<{ threads?: any[] } | null>;
}): WorkerHandler {
  const searchMem = (q: string, telemetry?: any) =>
    deps.toolExecute('cortex_memory', { action: 'search', query: q, limit: 6 }, 20_000, telemetry);

  /** Build a cited meeting brief for one event — the original PREP path. */
  async function buildMeetingBrief(ctx: any, meeting: { title: string; attendees: string[]; start?: number }) {
    ctx.progress(0.15);

    const gathered = await gatherContext(meeting, {
      searchMemory: (q) => deps.toolExecute('cortex_memory', { action: 'search', query: q, limit: 6 }, 20_000, ctx.telemetry),
      fetchInbox: deps.fetchInbox,
    });
    ctx.progress(0.45);

    if (!gathered.sources.length) {
      // Honest empty: no sources means no brief — say so, don't invent one.
      return {
        ok: true,
        brief: null,
        note: `No memory or mail context found for "${meeting.title || meeting.attendees.join(', ')}" — nothing to cite, so no brief was written.`,
        sources: 0,
      };
    }

    const llmText = await ctx.llm({
      tier: 'reason',
      maxTokens: 1200,
      messages: [
        {
          role: 'system',
          content: [
            'You are PREP, Cortex\'s meeting ready-writer. Write a prep brief using ONLY the provided sources.',
            'Format: section headers HISTORY, OPEN ITEMS, AGENDA, WATCH FOR on their own lines.',
            'Every bullet MUST end with " — src: <kind>:<ref>" where kind/ref exactly matches a [kind:ref] tag in the sources.',
            'Never invent facts, names, or history. If sources are thin, write fewer bullets — an honest short brief beats a padded one.',
            'AGENDA bullets may be recommendations (no src needed only if purely logistical like "confirm agenda"), but prefer cited items.',
          ].join('\n') + rulesBlock(`meeting prep brief ${meeting.title || ''} cited sources`, 'constraints learned from accepted agent outcomes — follow unless they conflict with the prep task'),
        },
        {
          role: 'user',
          content: `MEETING: ${meeting.title}\nATTENDEES: ${meeting.attendees.join(', ') || 'unknown'}\nWHEN: ${meeting.start ? new Date(meeting.start).toISOString() : 'unknown'}\n\nSOURCES:\n${gathered.digest}`,
        },
      ],
    });
    ctx.progress(0.75);

    const parsed = parseBriefSections(llmText);
    // Validate every section's bullets against known sources.
    let droppedUncited = 0;
    const clean = (lines: string[]) => {
      const r = validateCitedLines(lines, gathered.known);
      droppedUncited += r.dropped;
      return r.kept;
    };
    const brief: PrepBrief = {
      id: `prep-${Date.now().toString(36)}`,
      meetingTitle: meeting.title || meeting.attendees.join(', '),
      meetingStart: meeting.start,
      attendees: meeting.attendees,
      sections: {
        history: clean(parsed.history),
        openItems: clean(parsed.openItems),
        agenda: clean(parsed.agenda),
        watchFor: clean(parsed.watchFor),
      },
      sources: gathered.sources,
      droppedUncited,
      createdAt: Date.now(),
    };
    const file = writeBriefFile(brief);
    ctx.progress(1);
    return {
      ok: true,
      briefId: brief.id,
      file,
      meeting: brief.meetingTitle,
      sections: Object.fromEntries(Object.entries(brief.sections).map(([k, v]) => [k, v.length])),
      sources: brief.sources.length,
      droppedUncited,
    };
  }

  // ── P3: engagement_plan + prep_sweep (CORTEX_MORNING_PROTOCOL_SPEC §3) ──

  const SWEEP_MAX_EVENTS = 4;
  const PERSONAL_RE = /daughter|son|kid|child|family|birthday|anniversary|doctor|dentist|school|pickup|pick-up|call with|therapy/i;
  const isPersonalTitle = (t: string) => PERSONAL_RE.test(t);

  function existingBriefFor(title: string): boolean {
    try {
      const norm = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      return fs.readdirSync(BRIEFS_DIR).some((f) => f.includes(norm));
    } catch { return false; }
  }

  /** engagement_plan — generative personal plan (daughter-call spec §3.3).
   *  Facts about the person stay cited; plan steps are recommendations. */
  async function buildEngagementPlan(ctx: any, input: any) {
    const title = String(input.title || input.event || '').trim();
    const person = String(input.person || input.with || '').trim();
    const start = Number.isFinite(Number(input.start)) ? Number(input.start) : undefined;
    const durationMin = Math.min(120, Math.max(5, Number(input.durationMin) || 30));
    if (!title) throw new Error('engagement_plan requires input.title|event');

    const queries = [person, title].filter(Boolean).slice(0, 3);
    const contexts: { kind: PrepSource['kind']; ref: string; label: string; text: string }[] = [];
    for (const q of queries) {
      try {
        const mem: any = await searchMem(q, ctx.telemetry);
        const items = Array.isArray(mem) ? mem : Array.isArray(mem?.results) ? mem.results : mem?.memories || [];
        const text = JSON.stringify(items).slice(0, 2500);
        if (text && text !== '[]' && text !== '{}') {
          contexts.push({ kind: 'memory', ref: q.slice(0, 60), label: `memory: ${q}`, text });
        }
      } catch {}
    }
    try {
      const inbox = await deps.fetchInbox();
      const threads: any[] = Array.isArray(inbox?.threads) ? inbox.threads : [];
      for (const t of threads.slice(0, 40)) {
        const th = `${t?.sender || t?.from || ''} ${t?.subject || ''} ${t?.snippet || ''}`.toLowerCase();
        if ((person && th.includes(person.toLowerCase().split(' ')[0])) || th.includes(title.toLowerCase().slice(0, 20))) {
          contexts.push({
            kind: 'gmail', ref: String(t?.id || t?.subject || 'thread').slice(0, 80),
            label: `gmail: ${t?.subject || 'thread'}`,
            text: `${t?.sender || t?.from || ''} — ${t?.subject || ''} (${t?.date || 'unknown'})`,
          });
        }
      }
    } catch {}

    const { sources, digest, known } = sourcesFromContext(contexts);
    ctx.progress(0.4);

    const llmText = await ctx.llm({
      tier: 'reason',
      maxTokens: 1400,
      messages: [
        {
          role: 'system',
          content: [
            'You are PREP, Cortex\'s personal engagement planner. Write a practical engagement plan for a personal call/visit using ONLY the provided sources for facts about the person.',
            'Format sections on their own lines: OPENING, BLOCKS, PROPS, FALLBACKS, CLOSE.',
            'BLOCKS = time-boxed activity segments filling the duration (e.g. for a 2-year-old: songs, peekaboo prompts, show-and-tell).',
            'PROPS = concrete things to have ready BEFORE the call.',
            'FALLBACKS = what to do if they fade/disengage/technical issues.',
            'CLOSE = how to end warmly so the next call is easy.',
            'Every FACT about the person (age, interests, history, dynamics) MUST end with " — src: <kind>:<ref>" matching a [kind:ref] source tag.',
            'Plan steps themselves are recommendations — no citation needed. Never invent facts about the person; thin sources = shorter plan.',
          ].join('\n') + rulesBlock(`engagement plan ${title}`, 'constraints learned from accepted agent outcomes — follow unless they conflict'),
        },
        {
          role: 'user',
          content: `EVENT: ${title}\nWITH: ${person || 'unknown'}\nWHEN: ${start ? new Date(start).toISOString() : 'unknown'}\nDURATION: ${durationMin}min\n\nSOURCES:\n${digest || '(none found — plan generically; uncited facts will be dropped)'}`,
        },
      ],
    });
    ctx.progress(0.8);

    const planSections: Record<string, string[]> = { opening: [], blocks: [], props: [], fallbacks: [], close: [] };
    let current: keyof typeof planSections | null = null;
    const secMap: Record<string, keyof typeof planSections> = {
      opening: 'opening', blocks: 'blocks', props: 'props', fallbacks: 'fallbacks', close: 'close',
    };
    for (const line of String(llmText || '').split('\n')) {
      const h = line.match(/^\s*(?:#{1,3}\s*)?(opening|blocks?|props?|fallbacks?|close|closing)\s*:?\s*$/i);
      if (h) {
        const k = h[1].toLowerCase();
        current = k.startsWith('block') ? 'blocks' : k.startsWith('prop') ? 'props' : k.startsWith('fallback') ? 'fallbacks' : k.startsWith('clos') ? 'close' : 'opening';
        continue;
      }
      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      if (bullet && current) planSections[current].push(bullet[1].trim());
    }

    // Fallback: model didn't follow section headers — salvage content rather
    // than ship an empty plan. Unsectioned bullets go to BLOCKS; if the model
    // emitted plain lines, keep the first 40 as plan text.
    if (Object.values(planSections).every((v) => v.length === 0)) {
      const looseBullets = String(llmText || '').split('\n')
        .map((l) => l.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim())
        .filter((x): x is string => Boolean(x));
      if (looseBullets.length) {
        planSections.blocks = looseBullets;
      } else {
        planSections.blocks = String(llmText || '').split('\n')
          .map((l) => l.trim()).filter(Boolean).slice(0, 40);
      }
    }

    let droppedUncited = 0;
    const clean = (lines: string[]) => lines.map((l) => {
      if (SRC_RE.test(l)) {
        const r = validateCitedLines([l], known);
        if (r.dropped) { droppedUncited++; return null; }
      }
      return l;
    }).filter((x): x is string => x !== null);

    const plan = {
      id: `engage-${Date.now().toString(36)}`,
      title, person,
      when: start, durationMin,
      sections: Object.fromEntries(Object.entries(planSections).map(([k, v]) => [k, clean(v)])),
      sources, droppedUncited, createdAt: Date.now(),
    };

    fs.mkdirSync(BRIEFS_DIR, { recursive: true });
    const file = path.join(BRIEFS_DIR, `${plan.id}.md`);
    const md = [
      `# Engagement Plan — ${title}`,
      `_ ${person ? `with ${person} · ` : ''}${start ? new Date(start).toLocaleString() : 'unscheduled'} · ${durationMin}min_`,
      '',
      ...Object.entries(plan.sections).filter(([, v]) => v.length).flatMap(([k, v]) => [
        `## ${k.toUpperCase()}`, '', ...v.map((l) => `- ${l}`), '',
      ]),
      `---\nSources: ${sources.map((s) => `${s.kind}:${s.ref}`).join(', ') || 'none'}${droppedUncited ? ` · ${droppedUncited} uncited fact(s) dropped` : ''}`,
    ].join('\n');
    fs.writeFileSync(file, md);
    ctx.progress(1);
    return { ok: true, planId: plan.id, file, event: title, person, durationMin, sections: Object.fromEntries(Object.entries(plan.sections).map(([k, v]) => [k, v.length])), sources: sources.length, droppedUncited };
  }

  /** prep_sweep — night-before pass over upcoming calendar events.
   *  Personal events → engagement plans; others → cited meeting briefs. */
  async function runSweep(ctx: any) {
    const feedPath = path.join(RUNTIME_DIR, 'calendar-upcoming.json');
    let events: any[] = [];
    try {
      const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
      events = Array.isArray(feed?.events) ? feed.events : [];
    } catch {
      return { ok: true, note: 'calendar-upcoming.json missing or unreadable — nothing to prep', briefs: 0, plans: 0 };
    }
    const now = Date.now();
    const horizon = now + 30 * 3600_000;
    const upcoming = events
      .map((e: any) => ({
        id: String(e?.id ?? ''), title: String(e?.title ?? ''),
        start: Number(e?.start ?? e?.startTime ?? 0), end: Number(e?.end ?? e?.endTime) || undefined,
        attendees: Array.isArray(e?.attendees) ? e.attendees.length : Number(e?.attendees) || 0,
        attendeeNames: Array.isArray(e?.attendees) ? e.attendees.map((a: any) => String(a?.email ?? a?.name ?? a)).filter(Boolean) : Array.isArray(e?.attendeeNames) ? e.attendeeNames.map(String) : undefined,
        hasPrepBrief: e?.hasPrepBrief === true,
      }))
      .filter((e) => e.title && e.start > now && e.start <= horizon)
      .sort((a, b) => a.start - b.start)
      .slice(0, SWEEP_MAX_EVENTS);

    if (!upcoming.length) {
      return { ok: true, note: 'no events in next 30h — nothing to prep', briefs: 0, plans: 0 };
    }

    const results: any[] = [];
    for (const ev of upcoming) {
      if (ev.hasPrepBrief || existingBriefFor(ev.title)) {
        results.push({ event: ev.title, skipped: 'brief exists' });
        continue;
      }
      if (isPersonalTitle(ev.title)) {
        const r = await buildEngagementPlan(ctx, {
          title: ev.title, start: ev.start,
          durationMin: ev.end ? Math.round((ev.end - ev.start) / 60000) : 30,
          person: (ev.attendeeNames || [])[0],
        });
        results.push({ kind: 'engagement_plan', ...r });
      } else {
        const r = await buildMeetingBrief(ctx, {
          title: ev.title, start: ev.start,
          attendees: ev.attendeeNames || [],
        });
        results.push({ kind: 'meeting_brief', ...r });
      }
      ctx.progress(0.3 + 0.6 * (results.length / upcoming.length));
    }
    ctx.progress(1);
    return {
      ok: true,
      swept: upcoming.length,
      results,
      briefs: results.filter((r) => r.kind === 'meeting_brief' && r.briefId).length,
      plans: results.filter((r) => r.kind === 'engagement_plan' && r.planId).length,
    };
  }

  return async (ctx) => {
    const input = (ctx.task.input || {}) as any;
    const kind = String(ctx.task.kind || '');

    if (kind === 'prep_sweep') return runSweep(ctx);
    if (kind === 'engagement_plan') return buildEngagementPlan(ctx, input);
    if (kind === 'initiative_drain') {
      // Drain the server-side initiative ledger: approve safe tier-1
      // proposals so the client picks them up on its next poll. Tier-2 and
      // non-whitelisted tools stay pending for the Crew — never auto-approved.
      const drain = drainSafePending('agent:prep');
      const pending = listProposals({ status: 'pending' });
      const awaitingCrew = pending.filter((p) => !isSafeAutoProposal(p));
      return {
        ok: true,
        approved: drain.approved.map((p) => ({ id: p.id, title: p.title, tool: p.suggestedTool })),
        approvedCount: drain.approved.length,
        awaitingCrew: awaitingCrew.slice(0, 20).map((p) => ({
          id: p.id, title: p.title, tool: p.suggestedTool, tier: p.autonomyTier,
        })),
        awaitingCrewCount: awaitingCrew.length,
      };
    }

    const meeting = {
      title: String(input.title || input.query || input.meeting || '').trim(),
      attendees: Array.isArray(input.attendees) ? input.attendees.map(String) : [],
      start: Number.isFinite(Number(input.start)) ? Number(input.start) : undefined,
    };
    if (!meeting.title && !meeting.attendees.length) {
      throw new Error('prep requires input.title|query|meeting and/or input.attendees');
    }
    ctx.progress(0.15);
    return buildMeetingBrief(ctx, meeting);
  };
}
