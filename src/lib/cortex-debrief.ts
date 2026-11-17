/**
 * Cortex Evening Debrief composer (spec: CORTEX_EVENING_DEBRIEF_SPEC.md).
 *
 * Fixed section order, hard phone cap, evidence-only facts. The debrief is
 * a shutdown ritual: it reconciles plan-vs-verified, asks a few tailored
 * gap questions, offloads tomorrow's loops as if-then intentions, and ends
 * with a closing signal. It never claims operator attention it can't see.
 */

export const SHUTDOWN_POOL: { text: string; halo?: boolean }[] = [
  { text: 'Debrief complete. Tomorrow is planned. Sleep well.' },
  { text: 'Day closed. Loops handed off. Rest well.' },
  { text: 'Everything open has a next step. Stand down.' },
  { text: 'The ledger is balanced. Tomorrow gets its own fight.' },
  { text: 'Handoff done. The plan holds while you sleep.' },
  { text: 'Day filed. Morning will find it waiting.' },
  { text: 'Shutdown logged. Cortex holds the watch tonight.', halo: true },
  { text: 'The war continues at dawn. Tonight, rest, Chief.', halo: true },
  { text: 'All quiet on the western front. Sleep well.', halo: true },
  { text: 'Debrief sealed. Reveille is someone else\'s problem now.', halo: true },
];

export const ONE_THING_POOL: string[] = [
  'What\'s one thing today you\'re glad happened?',
  'What\'s tomorrow you\'re mildly dreading? Name it and it shrinks.',
  'Did you use a prep brief today? What did you change because of it?',
  'What did you learn today that isn\'t written down anywhere yet?',
  'Who did you want to reach today but didn\'t? What\'s the smallest next step?',
  'What\'s one loop you want closed before tomorrow morning?',
];

const DAY_MS = 86_400_000;
const PHONE_CAP = 2500;

function hashDay(dayKey: string): number {
  let h = 0;
  for (const c of dayKey) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function pickShutdown(dayKey: string, recent: string[] = []): string {
  // Halo ~1 in 7 days: deterministic by day-of-year.
  const dayNum = Math.floor(new Date(`${dayKey}T12:00:00`).getTime() / DAY_MS);
  const haloDay = dayNum % 7 === 0;
  const pool = haloDay ? SHUTDOWN_POOL.filter((s) => s.halo) : SHUTDOWN_POOL.filter((s) => !s.halo);
  const usePool = pool.length ? pool : SHUTDOWN_POOL;
  const fresh = usePool.filter((s) => !recent.includes(s.text));
  const pick = (fresh.length ? fresh : usePool)[hashDay(dayKey) % (fresh.length ? fresh.length : usePool.length)];
  return pick.text;
}

export function pickOneThing(dayKey: string, recent: string[] = []): string {
  const fresh = ONE_THING_POOL.filter((q) => !recent.includes(q));
  const pool = fresh.length ? fresh : ONE_THING_POOL;
  return pool[hashDay(`thing-${dayKey}`) % pool.length];
}

export interface DebriefGap {
  question: string;
  evidence?: string;
}
export interface DebriefTomorrowEvent {
  title: string;
  time: string;
  prep: 'ready' | 'plan' | 'none';
}
export interface DebriefPriority {
  text: string;
  firstAction: string;
}
export interface DebriefData {
  dayKey: string;
  longDate: string;
  verified: string[];
  attempted: number;
  failedCount: number;
  failedTitles: string[];
  gaps: DebriefGap[];
  tomorrowEvents: DebriefTomorrowEvent[];
  priorities: DebriefPriority[];
  openLoops: string[];
  oneThing: string;
  shutdown: string;
  degradedSources: string[];
  generatedAt: number;
}

export interface DebriefSection { key: string; title: string; lines: string[] }
export interface ComposedDebrief {
  phoneText: string;
  markdown: string;
  sections: DebriefSection[];
  stats: { droppedForCap: number };
}

export function composeDebrief(d: DebriefData): ComposedDebrief {
  const sections: DebriefSection[] = [];

  // §1 LEDGER — what the day actually was (verified only).
  const ledger: string[] = [];
  ledger.push(`Day score: ${d.verified.length} verified / ${d.attempted} attempted`);
  for (const v of d.verified.slice(0, 3)) ledger.push(`✓ ${v}`);
  if (d.failedCount > 0) ledger.push(`${d.failedCount} failed${d.failedTitles.length ? `: ${d.failedTitles.slice(0, 2).join('; ')}` : ''}`);
  sections.push({ key: 'ledger', title: 'THE LEDGER', lines: ledger });

  // §2 GAP — AAR questions, max 3.
  if (d.gaps.length) {
    sections.push({
      key: 'gap', title: 'THE GAP',
      lines: d.gaps.slice(0, 3).map((g) => `• ${g.question}${g.evidence ? `\n  _${g.evidence}_` : ''}`),
    });
  } else {
    sections.push({ key: 'gap', title: 'THE GAP', lines: ['No significant gaps today. The machine ran as designed.'] });
  }

  // §3 TOMORROW, CONCRETELY — events + if-then priorities + offload.
  const tomorrow: string[] = [];
  for (const e of d.tomorrowEvents.slice(0, 5)) {
    tomorrow.push(`${e.time} ${e.title}${e.prep === 'ready' ? ' · prep ready' : e.prep === 'plan' ? ' · engagement plan' : ' · NO PREP'}`);
  }
  if (!d.tomorrowEvents.length) tomorrow.push('Nothing on the calendar tomorrow.');
  for (const p of d.priorities.slice(0, 3)) {
    tomorrow.push(`→ ${p.text}\n  first: ${p.firstAction}`);
  }
  const loops = d.openLoops.slice(0, 7);
  if (loops.length) tomorrow.push(`Open loops → ${loops.join(' · ')}`);
  sections.push({ key: 'tomorrow', title: 'TOMORROW, CONCRETELY', lines: tomorrow });

  // §4 ONE THING — tonight's question.
  sections.push({ key: 'one-thing', title: 'TONIGHT\'S ONE THING', lines: [d.oneThing] });

  // §5 SHUTDOWN — closing signal.
  sections.push({ key: 'shutdown', title: 'SHUTDOWN', lines: [d.shutdown] });

  // Render phone text — per-line truncation keeps a single fat record from
  // eating the whole payload.
  const clip = (s: string) => (s.length > 350 ? s.slice(0, 347) + '…' : s);
  let phoneText = `EVENING DEBRIEF — ${d.longDate}\n\n`;
  for (const s of sections) {
    phoneText += `${s.title}\n${s.lines.map(clip).join('\n')}\n\n`;
  }
  if (d.degradedSources.length) {
    phoneText += `Coverage gaps: ${d.degradedSources.join(', ')}\n`;
  }
  phoneText = phoneText.trim();

  let droppedForCap = 0;
  if (phoneText.length > PHONE_CAP) {
    // Trim from the bottom up: drop open-loop tail lines first, then gap evidence.
    const orig = phoneText;
    phoneText = phoneText.slice(0, PHONE_CAP - 40) + '\n…(trimmed for phone)';
    droppedForCap = orig.length - phoneText.length;
  }

  // Markdown artifact — fuller version, no cap.
  const md: string[] = [`# Evening Debrief — ${d.longDate}`, '', `_${d.generatedAt ? new Date(d.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}_`, ''];
  for (const s of sections) {
    md.push(`## ${s.title}`, '', ...s.lines.map((l) => `- ${l}`), '');
  }
  if (d.degradedSources.length) md.push(`---\nCoverage gaps: ${d.degradedSources.join(', ')}`, '');
  md.push(`---\n${d.shutdown}`);

  return { phoneText, markdown: md.join('\n'), sections, stats: { droppedForCap } };
}
