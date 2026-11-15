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
  return async (ctx) => {
    const input = (ctx.task.input || {}) as any;
    const meeting = {
      title: String(input.title || input.query || input.meeting || '').trim(),
      attendees: Array.isArray(input.attendees) ? input.attendees.map(String) : [],
      start: Number.isFinite(Number(input.start)) ? Number(input.start) : undefined,
    };
    if (!meeting.title && !meeting.attendees.length) {
      throw new Error('prep requires input.title|query|meeting and/or input.attendees');
    }
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
          ].join('\n'),
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
  };
}
