/**
 * Cortex RADAR sweep — Life Radar worker (spec: CORTEX_MORNING_PROTOCOL_SPEC.md §2).
 *
 * Gathers text from approved sources, LLM-extracts date/commitment
 * mentions, validates quotes verbatim, dedupes, and files approve-each
 * calendar proposals. Read-only everywhere; honest per-source coverage.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { WorkerHandler } from './runtime';
import {
  loadLedger, saveLedger, normalizeMentions, markProposed, expireStale,
  buildExtractionPrompt, parseExtractionResponse,
  type LifeEvent,
} from '../cortex-life-radar';
import { fileCalendarProposal } from './strategy-proposals';

const execFileAsync = promisify(execFile);
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5173;
const BASE = `http://127.0.0.1:${PORT}`;

async function sh(cmd: string, args: string[], timeoutMs = 20000): Promise<{ ok: boolean; out: string; err: string }> {
  try {
    const r = await execFileAsync(cmd, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 });
    return { ok: true, out: String(r.stdout || ''), err: String(r.stderr || '') };
  } catch (e: any) {
    return { ok: false, out: String(e.stdout || ''), err: String(e.stderr || e.message || '') };
  }
}

interface SourceResult {
  source: string;
  label: string;
  text: string;
  ok: boolean;
  note?: string;
  ref?: string;
}

/** Gather source texts. Each failure is honest coverage, not a crash. */
async function gatherSources(deps: {
  fetchInbox: () => Promise<any>;
  searchMemory: (q: string) => Promise<any>;
  toolExecute: (name: string, args: Record<string, unknown>, timeoutMs?: number, telemetry?: any) => Promise<any>;
}): Promise<SourceResult[]> {
  const out: SourceResult[] = [];

  // ── Gmail: inbox threads (sent-mail extraction is a later phase) ──
  try {
    const inbox = await deps.fetchInbox();
    const threads: any[] = Array.isArray(inbox?.threads) ? inbox.threads : [];
    const text = threads.slice(0, 40).map((t: any) =>
      `${t?.sender || t?.from || ''} | ${t?.subject || ''} | ${t?.date || ''}\n${String(t?.snippet || t?.body || '').slice(0, 800)}`
    ).join('\n---\n');
    out.push({
      source: 'gmail', label: 'gmail inbox threads', ok: text.length > 0,
      note: text.length ? undefined : 'no threads', text, ref: 'live-inbox',
    });
  } catch (e: any) {
    out.push({ source: 'gmail', label: 'gmail', ok: false, note: String(e?.message || 'fetch failed').slice(0, 80), text: '' });
  }

  // ── iMessage via imsg CLI (permission-gated — honest degrade) ──
  try {
    const chats = await sh('/opt/homebrew/bin/imsg', ['chats', '--limit', '15', '--json'], 15000);
    if (!chats.ok) {
      out.push({ source: 'imessage', label: 'imessage', ok: false, note: (chats.err || 'imsg failed').slice(0, 100), text: '' });
    } else {
      let items: any = [];
      try { items = JSON.parse(chats.out); } catch { items = []; }
      const arr: any[] = Array.isArray(items) ? items : (items?.chats || []);
      const text = arr.slice(0, 15).map((c: any) =>
        `${c?.displayName || c?.chatIdentifier || c?.identifier || ''} | ${c?.lastMessage?.text || c?.lastMessage || ''}`
      ).join('\n');
      out.push({ source: 'imessage', label: 'imessage recent chats', ok: text.length > 0, note: text.length ? undefined : 'no chats', text: text.slice(0, 8000), ref: 'imsg-chats' });
    }
  } catch (e: any) {
    out.push({ source: 'imessage', label: 'imessage', ok: false, note: String(e?.message || 'error').slice(0, 80), text: '' });
  }

  // ── Memory / Obsidian ──
  try {
    const mem = await deps.searchMemory('upcoming dates deadlines appointments birthdays calls');
    const text = JSON.stringify(mem ?? '').slice(0, 8000);
    out.push({ source: 'memory', label: 'memory recall', ok: text.length > 2 && text !== '[]' && text !== '{}', note: text.length > 2 ? undefined : 'empty', text, ref: 'cortex_memory' });
  } catch (e: any) {
    out.push({ source: 'memory', label: 'memory', ok: false, note: String(e?.message || 'error').slice(0, 80), text: '' });
  }

  // ── Apple Notes (osascript — Mac only, honest degrade) ──
  try {
    const notes = await sh('osascript', ['-e',
      'tell application "Notes" to get name of every note'], 15000);
    if (notes.ok) {
      const names = notes.out.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 60);
      out.push({ source: 'apple-notes', label: 'apple notes index', ok: names.length > 0, note: names.length ? undefined : 'no notes', text: names.join('\n'), ref: 'notes-names' });
    } else {
      out.push({ source: 'apple-notes', label: 'apple notes', ok: false, note: (notes.err || 'osascript failed').slice(0, 100), text: '' });
    }
  } catch (e: any) {
    out.push({ source: 'apple-notes', label: 'apple notes', ok: false, note: String(e?.message || 'error').slice(0, 80), text: '' });
  }

  return out;
}

function whenLabel(e: { dateStart?: number; dateText?: string; recurrence?: string }): string {
  if (e.recurrence === 'yearly') return `yearly on ${e.dateText || 'date'}`;
  if (e.dateStart) return new Date(e.dateStart).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return e.dateText || 'date TBD';
}

export function makeRadarSweepWorker(deps: {
  toolExecute: (name: string, args: Record<string, unknown>, timeoutMs?: number, telemetry?: any) => Promise<any>;
  fetchInbox: () => Promise<any>;
}): WorkerHandler {
  return async (ctx) => {
    const now = Date.now();
    ctx.progress(0.1);

    expireStale(now);
    const ledger = loadLedger();
    const sources = await gatherSources({
      fetchInbox: deps.fetchInbox,
      searchMemory: async (q) => {
        const r = await deps.toolExecute('cortex_memory', { action: 'search', query: q, limit: 8 }, 20_000, ctx.telemetry);
        return r;
      },
      toolExecute: deps.toolExecute,
    });
    ctx.progress(0.4);

    const coverage = sources.map((s) => ({ source: s.source, ok: s.ok, note: s.note, scannedAt: now }));
    const calFeed = (() => { try { return JSON.parse(fs.readFileSync(path.join(process.env.CORTEX_AGENTS_STATE_DIR || '.cortex-runtime', 'calendar-upcoming.json'), 'utf8')); } catch { return { events: [] }; } })();
    const calTitles = (calFeed.events || []).map((e: any) => ({ title: String(e?.title || ''), start: Number(e?.start || 0) }));

    const todayISO = new Date(now).toISOString().slice(0, 10);
    const allNew: LifeEvent[] = [];
    const drops: Record<string, number> = {};
    let proposalsFiled = 0;

    for (const src of sources) {
      if (!src.ok || !src.text || src.text.length < 30) continue;
      try {
        const prompt = buildExtractionPrompt(src.label, src.text, todayISO);
        const llmText = await ctx.llm({
          tier: 'reason',
          maxTokens: 1500,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
        });
        const raw = parseExtractionResponse(llmText);
        const { events, dropped } = normalizeMentions(raw, src.source, src.text, ledger.events, calTitles, now);
        for (const d of dropped) drops[d.reason] = (drops[d.reason] || 0) + 1;
        for (const ev of events) {
          // Confidence gate for proposals: ≥0.75 auto-proposes; 0.6-0.74 stays candidate
          if (ev.confidence >= 0.75 && ev.dateStart) {
            const startISO = new Date(ev.dateStart).toISOString();
            const endISO = ev.dateEnd ? new Date(ev.dateEnd).toISOString() : undefined;
            const filed = fileCalendarProposal({
              lifeEventId: ev.id,
              title: ev.title,
              whenLabel: whenLabel(ev),
              event: {
                title: ev.title,
                startISO,
                endISO,
                allDay: !ev.dateText?.match(/\d{1,2}:\d{2}/) && !/\d{1,2}(am|pm)/i.test(ev.dateText || ''),
                notes: `Life Radar · confidence ${ev.confidence} · ${ev.evidence[0]?.quote?.slice(0, 120) || ''}`,
                calendars: ['apple', 'google'],
              },
              evidence: [`${src.source}:${src.ref || ''}`, ev.evidence[0]?.quote || ''],
            });
            if (filed) { ev.status = 'proposed'; proposalsFiled++; }
          }
          allNew.push(ev);
        }
      } catch (e: any) {
        coverage.find((c) => c.source === src.source)!.ok = false;
        coverage.find((c) => c.source === src.source)!.note = `extract failed: ${String(e?.message || e).slice(0, 80)}`;
      }
      ctx.progress(0.4 + 0.5 * (sources.indexOf(src) + 1) / sources.length);
    }

    // Merge new events into ledger (dedupe by id — normalize already checked, belt-and-suspenders)
    const existingIds = new Set(ledger.events.map((e) => e.id));
    for (const ev of allNew) {
      if (!existingIds.has(ev.id)) { ledger.events.push(ev); existingIds.add(ev.id); }
    }
    ledger.events = ledger.events.slice(-300);
    ledger.lastSweepAt = now;
    ledger.coverage = coverage;
    saveLedger(ledger);
    ctx.progress(1);

    return {
      ok: true,
      sourcesScanned: sources.filter((s) => s.ok).map((s) => s.source),
      sourcesDegraded: sources.filter((s) => !s.ok).map((s) => `${s.source}: ${s.note}`),
      rawMentions: allNew.length,
      newEvents: allNew.length,
      proposalsFiled,
      drops,
      ledgerSize: ledger.events.length,
      coverage,
    };
  };
}
