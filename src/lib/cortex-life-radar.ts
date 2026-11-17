/**
 * Cortex Life Radar — date & commitment discovery (spec: CORTEX_MORNING_PROTOCOL_SPEC.md §2).
 *
 * Sweeps approved sources for dates, deadlines, birthdays, commitments,
 * and logistics; normalizes them into LifeEvent records; emits approve-each
 * calendar proposals. Read-only on every source. Every extracted item must
 * carry a verbatim quote found in the source text — evidence-or-silence,
 * same contract as FORECASTER/PREP.
 *
 * Sources (user-approved): Gmail, iMessage (imsg CLI — permission-gated,
 * honest degrade), Memory/Obsidian, Apple Notes, bounded file scan.
 */

import fs from 'node:fs';
import path from 'node:path';

const RUNTIME_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
export const LIFE_EVENTS_FILE = path.join(RUNTIME_DIR, 'life-events.json');
const CAL_FEED_FILE = path.join(RUNTIME_DIR, 'calendar-upcoming.json');

export type LifeEventKind = 'hard_date' | 'deadline' | 'birthday' | 'commitment' | 'logistics';
export type LifeEventStatus = 'candidate' | 'proposed' | 'approved' | 'dismissed' | 'expired' | 'added';

export interface LifeEvent {
  id: string;
  kind: LifeEventKind;
  title: string;
  dateStart?: number;          // epoch ms — undefined = floating/date-TBD
  dateEnd?: number;
  dateText?: string;           // verbatim date phrase from source
  confidence: number;          // 0..1
  people: string[];
  recurrence?: 'yearly';
  evidence: { source: string; ref: string; quote: string }[];
  status: LifeEventStatus;
  proposalId?: string;
  createdAt: number;
  updatedAt: number;
}

interface Ledger { events: LifeEvent[]; lastSweepAt?: number; coverage?: { source: string; ok: boolean; note?: string; scannedAt: number }[] }

export function loadLedger(): Ledger {
  try { return JSON.parse(fs.readFileSync(LIFE_EVENTS_FILE, 'utf8')) as Ledger; } catch { return { events: [] }; }
}
export function saveLedger(l: Ledger): void {
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(LIFE_EVENTS_FILE, JSON.stringify(l, null, 1));
  } catch {}
}

const CONFIDENCE_FLOOR = 0.6;
const MAX_EVENTS_PER_SWEEP = 12;
const DEDUPE_WINDOW_MS = 30 * DAY();
function DAY() { return 86_400_000; }

function eventId(kind: string, title: string, dateStart?: number): string {
  const norm = `${kind}:${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  const d = dateStart ? new Date(dateStart).toISOString().slice(0, 10) : 'tbd';
  return `life-${norm}-${d}`;
}

/** Normalize raw LLM-extracted mentions into validated LifeEvents.
 *  Drops: low confidence, missing/invalid evidence quote, duplicates. */
export function normalizeMentions(
  raw: any[],
  source: string,
  sourceText: string,
  existing: LifeEvent[],
  calendarTitles: { title: string; start: number }[],
  now: number,
): { events: LifeEvent[]; dropped: { reason: string; item: any }[] } {
  const out: LifeEvent[] = [];
  const dropped: { reason: string; item: any }[] = [];
  const text = sourceText.toLowerCase();

  for (const m of raw.slice(0, MAX_EVENTS_PER_SWEEP * 2)) {
    const kind = String(m?.kind || '') as LifeEventKind;
    if (!['hard_date', 'deadline', 'birthday', 'commitment', 'logistics'].includes(kind)) {
      dropped.push({ reason: 'bad-kind', item: m }); continue;
    }
    const title = String(m?.title || '').trim().slice(0, 140);
    if (title.length < 4) { dropped.push({ reason: 'empty-title', item: m }); continue; }
    const confidence = Math.max(0, Math.min(1, Number(m?.confidence ?? 0.5)));
    if (confidence < CONFIDENCE_FLOOR) { dropped.push({ reason: 'low-confidence', item: m }); continue; }

    // Evidence contract: quote must appear verbatim (case-insensitive) in source.
    const quote = String(m?.quote || m?.evidence || '').trim();
    if (!quote || quote.length < 8 || !text.includes(quote.toLowerCase())) {
      dropped.push({ reason: 'uncited', item: m }); continue;
    }

    const dateStart = Number.isFinite(Number(m?.dateStart)) ? Number(m.dateStart) : undefined;
    // Reject absurd dates (>2y out for non-recurring, >10y for birthdays ok via recurrence)
    if (dateStart && dateStart > now + 370 * DAY() && kind !== 'birthday') {
      dropped.push({ reason: 'date-too-far', item: m }); continue;
    }

    const id = eventId(kind, title, dateStart);
    // Dedupe vs ledger (any status within window) and vs calendar feed.
    const dupLedger = existing.some((e) => e.id === id ||
      (e.title.toLowerCase() === title.toLowerCase() &&
        (e.dateStart === dateStart || (!e.dateStart && !dateStart))));
    if (dupLedger) { dropped.push({ reason: 'dup-ledger', item: m }); continue; }
    const dupCal = dateStart && calendarTitles.some((c) =>
      c.title.toLowerCase().includes(title.toLowerCase().slice(0, 20)) &&
      Math.abs(c.start - dateStart) < DAY());
    if (dupCal) { dropped.push({ reason: 'dup-calendar', item: m }); continue; }

    out.push({
      id,
      kind,
      title,
      dateStart,
      dateEnd: Number.isFinite(Number(m?.dateEnd)) ? Number(m.dateEnd) : undefined,
      dateText: String(m?.dateText || '').slice(0, 60) || undefined,
      confidence,
      people: Array.isArray(m?.people) ? m.people.map(String).slice(0, 6) : [],
      recurrence: m?.recurrence === 'yearly' ? 'yearly' : undefined,
      evidence: [{ source, ref: String(m?.ref || 'extract').slice(0, 80), quote: quote.slice(0, 200) }],
      status: 'candidate',
      createdAt: now,
      updatedAt: now,
    });
  }
  return { events: out.slice(0, MAX_EVENTS_PER_SWEEP), dropped };
}

/** Mark candidates as 'proposed' once a calendar proposal exists. */
export function markProposed(eventIdValue: string, proposalId: string): void {
  const l = loadLedger();
  const e = l.events.find((x) => x.id === eventIdValue);
  if (e) { e.status = 'proposed'; e.proposalId = proposalId; e.updatedAt = Date.now(); saveLedger(l); }
}

export function expireStale(now = Date.now()): number {
  const l = loadLedger();
  let n = 0;
  for (const e of l.events) {
    if ((e.status === 'candidate' || e.status === 'proposed') && e.dateStart && e.dateStart < now - DAY()) {
      e.status = 'expired'; e.updatedAt = now; n++;
    }
  }
  if (n) saveLedger(l);
  return n;
}

/** Extraction prompt — strict JSON, quote-or-drop. */
export function buildExtractionPrompt(sourceLabel: string, text: string, todayISO: string): { system: string; user: string } {
  return {
    system: [
      'You are LIFE RADAR, Cortex\'s date-and-commitment extractor.',
      'Extract ONLY concrete, dated or datable items a personal chief-of-staff should track:',
      'court dates, filing deadlines, appointments, birthdays, anniversaries, promises the user made, calls to make, events with times.',
      'Return STRICT JSON array. Each item:',
      '{"kind":"hard_date|deadline|birthday|commitment|logistics","title":"short label","dateStart":epochMs|null,"dateEnd":epochMs|null,"dateText":"verbatim date phrase","confidence":0..1,"people":["names"],"recurrence":"yearly"|null,"quote":"VERBATIM span from the source text","ref":"source pointer"}',
      'RULES: every item MUST include "quote" copied EXACTLY from the source (it will be verified).',
      'No quote = item discarded. No dates = use dateStart null and say so in dateText.',
      'confidence: 0.9 explicit date+event, 0.7 implied soon, 0.5 vague — below 0.6 is wasted output.',
      'Ignore newsletters, promos, automated notices, and anything without a real-world date or commitment.',
      `Today is ${todayISO}. Resolve relative dates ("tomorrow","Friday","next week") against it.`,
    ].join('\n'),
    user: `SOURCE: ${sourceLabel}\n\n${text.slice(0, 12000)}`,
  };
}

export function parseExtractionResponse(text: string): any[] {
  const m = String(text || '').match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
