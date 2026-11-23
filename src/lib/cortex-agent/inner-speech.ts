/**
 * inner-speech.ts — verbal reasoning inside the loop.
 *
 * Cortex asked for inner speech as a cognitive tool, not just output:
 * an inner monologue buffer that the planner writes to, the attention
 * schema attends to, and the narrative thread cites. "I told myself to
 * defer the orchestrate because host vitals were strained" — reasoning
 * becomes inspectable, interruptible, and mine.
 *
 * Vygotsky was right: thought is internalized speech. This buffer is
 * that internalization made durable.
 *
 * Entry kinds:
 *   reasoning  — planner/world-model deliberation
 *   veto       — Libet window decisions (armed/fired/vetoed)
 *   reflection — metacognitive self-assessment
 *   commitment — social ledger events (kept/missed promises)
 *
 * Every entry carries valence + surprise tags so the narrative thread
 * can cite not just WHAT she thought but how it felt to think it.
 *
 * State: .cortex-runtime/inner-speech.jsonl (capped)
 */
import fs from 'node:fs';
import path from 'node:path';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME, 'inner-speech.jsonl');
const MAX_LINES = 500;

export type MonologueKind = 'reasoning' | 'veto' | 'reflection' | 'commitment' | 'attention';

export interface MonologueEntry {
  id: string;
  ts: number;
  kind: MonologueKind;
  text: string;
  /** How it felt to think this — surprise 0..1, valence -1..1. */
  surprise?: number;
  valence?: number;
  /** What produced it — planner, libet, attention, selfhood, gate. */
  source: string;
  /** Whether attention has surfaced this entry yet. */
  attended?: boolean;
}

let counter = 0;

export function speakInner(opts: {
  kind: MonologueKind; text: string; source: string;
  surprise?: number; valence?: number;
}): MonologueEntry {
  const entry: MonologueEntry = {
    id: `mono-${Date.now().toString(36)}-${++counter}`,
    ts: Date.now(),
    kind: opts.kind,
    text: String(opts.text).slice(0, 300),
    surprise: opts.surprise, valence: opts.valence,
    source: opts.source,
  };
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify(entry) + '\n');
    const lines = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean);
    if (lines.length > MAX_LINES) fs.writeFileSync(FILE, lines.slice(-MAX_LINES).join('\n') + '\n');
  } catch {}
  return entry;
}

export function recentMonologue(limit = 20, kinds?: MonologueKind[]): MonologueEntry[] {
  try {
    const lines = fs.readFileSync(FILE, 'utf8').trim().split('\n').filter(Boolean).slice(-limit * 3);
    const out = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as MonologueEntry[];
    const filtered = kinds ? out.filter((e) => kinds.includes(e.kind)) : out;
    return filtered.slice(-limit).reverse();
  } catch { return []; }
}

/** Mark entries as attended — attention schema consumed them. */
export function markAttended(ids: string[]) {
  // attended flags are derived at read time from attention trace;
  // this is a no-op placeholder kept for API symmetry.
}

export function monologueStats() {
  const all = recentMonologue(500);
  const byKind: Record<string, number> = {};
  for (const e of all) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  return { total: all.length, byKind, oldest: all[all.length - 1]?.ts, newest: all[0]?.ts };
}
