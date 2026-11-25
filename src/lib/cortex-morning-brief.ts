/**
 * Cortex Morning Protocol — Chief's Brief composer (spec: CORTEX_MORNING_PROTOCOL_SPEC.md).
 *
 * Pure module: takes gathered runtime state, emits the fixed-section brief
 * in three renderings — phone text (≤4k chars), markdown, and print HTML.
 *
 * Design contracts (research-grounded):
 *  - BLUF: decisions needed first, never a summary of what happened.
 *  - Fixed section order every day; empty sections are omitted.
 *  - Hard caps: phone ≤ ~3800 chars, print ≤ ~2 pages of content.
 *  - Evidence-or-silence: only verified accomplishments count as wins;
 *    failures are named, never buried.
 *  - Personal blocks get equal billing — family is not a footnote.
 */

// ── Greeting engine ────────────────────────────────────────────────
// ~40 entries across registers. Halo-flavored entries rotate ~1 in 7.
// pickGreeting() guarantees no repeat within the last 7 days.

export const GREETING_POOL: { text: string; halo?: boolean }[] = [
  { text: 'Good morning, Chief.' },
  { text: 'Morning. The fleet ran while you slept — here is what needs you.' },
  { text: 'Wake window open. Brief inside.' },
  { text: 'Good morning. Systems nominal — decisions pending.' },
  { text: 'Morning brief. Read top-down; the first block is the one that matters.' },
  { text: 'Good morning. Yesterday is accounted for; today is yours.' },
  { text: 'Rise and grind is optional. This brief is not.' },
  { text: 'Good morning. Coffee first, decisions second, everything else third.' },
  { text: 'Morning. Cortex kept the watch — here is the sitrep.' },
  { text: 'Good morning. The day is loaded; so is this page.' },
  { text: 'Sir, your morning sitrep.' , halo: true },
  { text: 'Chief, systems nominal. Over to you.' , halo: true },
  { text: 'Good morning. Another day, another clean sweep — mostly.' },
  { text: 'Morning. Short version: you have decisions, and they are below.' },
  { text: 'Good morning. The machines did their shift; now yours.' },
  { text: 'Wake up, chief. The brief is already printed.' , halo: true },
  { text: 'Good morning. No alarms were ignored. Several were prevented.' },
  { text: 'Morning brief — filed under: things that cannot wait.' },
  { text: 'Good morning. Your calendar, your calls, your calls to make.' },
  { text: 'Rise and file. Today\u2019s docket is inside.' },
  { text: 'Good morning. Cortana-flavored day ahead — brief follows.', halo: true },
  { text: 'Morning. We watched the store so you could watch the sunrise.' },
  { text: 'Good morning. The inbox is tamed; the day is not.' },
  { text: 'Another orbit, another brief. Good morning.' },
  { text: 'Good morning. Paperwork exists so mornings don\u2019t have to.' },
  { text: 'Morning, Chief — the day\u2019s first decision is already waiting.' , halo: true },
  { text: 'Good morning. Everything below was verified before it was printed.' },
  { text: 'Wake sequence complete. Briefing follows.' },
  { text: 'Good morning. The fleet sends its regards and its receipts.' },
  { text: 'Morning. Today\u2019s shape: read section two first.' },
  { text: 'Good morning. Some days the brief writes itself; today it wrote yours.' },
  { text: 'Up and at it. Cortex stood watch — verdict inside.' },
  { text: 'Good morning. The printers are warm and so is the coffee.' },
  { text: 'Morning, commander. Your day\u2019s operation order is attached.' , halo: true },
  { text: 'Good morning. Yesterday\u2019s receipts are below; today\u2019s asks are above.' },
  { text: 'Rise and shine is a suggestion. This is a brief.' },
  { text: 'Good morning. The calendar does not negotiate; this brief does.' },
  { text: 'Morning. Three things need you — everything else is handled.' },
  { text: 'Good morning. The fleet kept the peace; now collect your orders.' },
  { text: 'Another sunrise, another sitrep. Good morning.' },
];

const HALO_EVERY = 7;

/** Deterministic daily pick: no repeat within `recent` days; Halo entries
 *  appear roughly every HALO_EVERY-th day, position rotating by week. */
export function pickGreeting(dayKey: string, recent: string[] = []): string {
  // dayKey like '2026-11-17' → stable seed
  const seed = [...dayKey].reduce((a, c) => a + c.charCodeAt(0), 0);
  const haloDay = seed % HALO_EVERY === 0;
  const pool = haloDay ? GREETING_POOL.filter((g) => g.halo) : GREETING_POOL.filter((g) => !g.halo);
  const usePool = pool.length ? pool : GREETING_POOL;
  const recentSet = new Set(recent.slice(-7));
  // Walk forward from seed until we find a greeting not used recently.
  for (let i = 0; i < usePool.length; i++) {
    const g = usePool[(seed + i) % usePool.length];
    if (!recentSet.has(g.text)) return g.text;
  }
  return usePool[seed % usePool.length].text;
}

// ── Brief data contract ────────────────────────────────────────────

export interface BriefEvent {
  id: string;
  title: string;
  start: number;
  end?: number;
  attendees?: number;
  attendeeNames?: string[];
  hasPrepBrief?: boolean;
  kind?: 'work' | 'personal' | 'legal' | 'family' | 'health';
}

export interface BriefDecision {
  id: string;
  text: string;          // framed as a decision, not a topic
  deadline?: string;
  source: string;        // evidence ref
}

export interface BriefTaskStat {
  completed: number;
  verified: number;
  failed: number;
  failedTitles: string[];
}

export interface BriefWatchItem {
  text: string;
  severity: 'info' | 'warn' | 'crit';
}

export interface BriefRadarHit {
  id: string;
  text: string;          // e.g. "Birthday: Justin White — Sat"
  needsApproval: boolean;
}

export interface BriefSpotlight {
  text: string;
  ageDays: number;
}

export interface BriefData {
  dayKey: string;               // '2026-11-17'
  longDate: string;             // 'Tuesday, November 17'
  greeting: string;
  decisions: BriefDecision[];   // ≤5
  events: BriefEvent[];         // today, time-ordered
  energyPeak?: { start: string; end: string; label: string };
  stats: BriefTaskStat;
  watchItems: BriefWatchItem[];
  personalEvents: BriefEvent[]; // family/personal — equal billing
  radarHits: BriefRadarHit[];
  spotlight?: BriefSpotlight;
  prepStatus: { ready: number; pending: number; titles: string[] };
  pendingProposalCount: number;
  coverage: { source: string; ok: boolean; note?: string }[];
  generatedAt: number;
}

export interface ComposedBrief {
  greeting: string;
  dayKey: string;
  longDate: string;
  sections: { key: string; title: string; lines: string[] }[];
  phoneText: string;
  markdown: string;
  printHtml: string;
  stats: { chars: number; droppedForCap: number };
}

const PHONE_CAP = 3800;
const MAX_DECISIONS = 5;
const MAX_WATCH = 6;
const MAX_RADAR = 5;
const MAX_EVENTS = 8;
const MAX_FAILED_NAMED = 3;

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function eventLine(e: BriefEvent): string {
  const time = fmtTime(e.start);
  const prep = e.hasPrepBrief ? ' [prep✓]' : '';
  const att = e.attendees && e.attendees > 0 ? ` (${e.attendees + 1} ppl)` : '';
  return `${time} — ${e.title}${att}${prep}`;
}

function normalizeWatchText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function dedupeWatchItems(items: BriefWatchItem[]): BriefWatchItem[] {
  const seen = new Set<string>();
  const out: BriefWatchItem[] = [];
  for (const item of items) {
    const key = `${item.severity}:${normalizeWatchText(item.text)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function formatPhoneLine(sectionKey: string, line: string, index: number): string {
  const trimmed = line.trim();
  if (!trimmed) return '';
  if (sectionKey === 'signoff') return trimmed;
  if (sectionKey === 'shape' && trimmed === 'PERSONAL / FAMILY (equal billing):') return trimmed;
  if (sectionKey === 'accomplishments' && !trimmed.startsWith('✗')) return trimmed;

  let text = trimmed.replace(/^•\s+/, '');
  let prefix = '';
  const severity = text.match(/^\[(info|warn|crit)\]\s+/i);
  if (severity) {
    prefix = `${severity[1]?.toUpperCase() ?? 'INFO'} — `;
    text = text.slice(severity[0].length);
  }
  if (text.startsWith('✗')) {
    text = `FAILED — ${text.slice(1).trim()}`;
    prefix = '';
  }
  text = text
    .replace(/_\((.*?)\)_/g, '($1)')
    .replace(/\[prep✓\]/g, '· prep')
    .replace(/\s+/g, ' ')
    .trim();

  if (sectionKey === 'accomplishments') return text;
  if (sectionKey === 'watch' || sectionKey === 'radar') return `${index + 1}. ${prefix}${text}`;
  return `- ${prefix}${text}`;
}

function renderPhoneText(header: string, sections: ComposedBrief['sections'], footer: string): { text: string; dropped: number } {
  const protectedKeys = new Set(['decisions', 'shape', 'accomplishments', 'signoff']);
  const blocks = sections.map((sec) => ({
    key: sec.key,
    text: [sec.title, ...sec.lines.map((line, i) => formatPhoneLine(sec.key, line, i)).filter(Boolean)].join('\n'),
  }));
  const assemble = (list: typeof blocks) => `${header}\n\n${list.map((b) => b.text).join('\n\n')}${footer}`;
  const full = assemble(blocks);
  let kept = blocks.slice();
  let text = full;

  if (text.length > PHONE_CAP) {
    for (let i = kept.length - 1; i >= 0 && text.length > PHONE_CAP; i--) {
      const block = kept[i];
      if (!block || protectedKeys.has(block.key)) continue;
      kept.splice(i, 1);
      text = assemble(kept);
    }
  }

  if (text.length > PHONE_CAP) {
    const limit = Math.max(header.length + 40, PHONE_CAP - footer.length - 120);
    const cut = text.lastIndexOf('\n', limit);
    const trimmed = cut > header.length ? text.slice(0, cut) : text.slice(0, limit);
    const removed = Math.max(0, text.length - trimmed.length - footer.length);
    text = `${trimmed}\n\n…(+${removed} chars trimmed — full edition in print)${footer}`;
  }

  return { text, dropped: Math.max(0, full.length - text.length) };
}

/** Compose the fixed-order brief. Sections render only when non-empty. */
export function composeBrief(d: BriefData): ComposedBrief {
  const sections: ComposedBrief['sections'] = [];

  // 2. DECISIONS NEEDED — BLUF
  const decisions = d.decisions.slice(0, MAX_DECISIONS);
  if (decisions.length) {
    sections.push({
      key: 'decisions',
      title: 'DECISIONS NEEDED',
      lines: decisions.map((x) =>
        `• ${x.text}${x.deadline ? ` — ${x.deadline}` : ''} _(${x.source})_`),
    });
  }

  // 3. TODAY'S SHAPE
  const dayEvents = d.events
    .filter((e) => e.kind !== 'personal' && e.kind !== 'family')
    .slice(0, MAX_EVENTS);
  const personal = d.personalEvents.slice(0, MAX_EVENTS);
  const shapeLines: string[] = [];
  if (d.energyPeak) shapeLines.push(`Peak focus window: ${d.energyPeak.label}`);
  for (const e of dayEvents) shapeLines.push(eventLine(e));
  if (dayEvents.length === 0 && personal.length === 0) shapeLines.push('No events on the calendar today.');
  if (personal.length) {
    shapeLines.push('', 'PERSONAL / FAMILY (equal billing):');
    for (const e of personal) shapeLines.push(`• ${eventLine(e)}`);
  }
  if (shapeLines.length) {
    sections.push({ key: 'shape', title: "TODAY'S SHAPE", lines: shapeLines });
  }

  // 4. PREP STATUS
  if (d.prepStatus.ready + d.prepStatus.pending > 0) {
    const lines = [
      `${d.prepStatus.ready} brief(s) ready · ${d.prepStatus.pending} pending`,
      ...d.prepStatus.titles.slice(0, 4).map((t) => `• ${t}`),
    ];
    sections.push({ key: 'prep', title: 'PREP STATUS', lines });
  }

  // 5. OVERNIGHT ACCOMPLISHMENTS — verified only, failures named
  const s = d.stats;
  const accLines = [
    `${s.completed} task(s) completed · ${s.verified} verified · ${s.failed} failed`,
  ];
  for (const t of s.failedTitles.slice(0, MAX_FAILED_NAMED)) accLines.push(`✗ ${t}`);
  if (s.failed > MAX_FAILED_NAMED) accLines.push(`✗ +${s.failed - MAX_FAILED_NAMED} more`);
  sections.push({ key: 'accomplishments', title: 'OVERNIGHT ACCOMPLISHMENTS', lines: accLines });

  // 6. WATCH ITEMS
  const watchItems = dedupeWatchItems(d.watchItems);
  if (watchItems.length) {
    sections.push({
      key: 'watch',
      title: 'WATCH ITEMS',
      lines: watchItems.slice(0, MAX_WATCH).map((w) => `• [${w.severity}] ${w.text}`),
    });
  }

  // 7. RADAR HITS
  if (d.radarHits.length) {
    sections.push({
      key: 'radar',
      title: 'RADAR — NEEDS YOUR CALL',
      lines: d.radarHits.slice(0, MAX_RADAR).map((r) => `• ${r.text}`),
    });
  }

  // 8. SPOTLIGHT
  if (d.spotlight) {
    sections.push({
      key: 'spotlight',
      title: 'SPOTLIGHT',
      lines: [`• ${d.spotlight.text} — quiet for ${d.spotlight.ageDays}d. One honest look today.`],
    });
  }

  // 9. SIGN-OFF
  const signoff = d.pendingProposalCount > 0
    ? `${d.pendingProposalCount} proposal(s) waiting in Inbox — approve or dismiss.`
    : 'Inbox clear. Nothing needs your signature but today itself.';
  sections.push({ key: 'signoff', title: 'SIGN-OFF', lines: [signoff] });

  // ── Renderings ──────────────────────────────────────────────────
  const header = `${d.greeting}\n${d.longDate} — CORTEX CHIEF'S BRIEF`;
  const okSources = d.coverage.filter((c) => c.ok).map((c) => c.source).join(', ') || 'none';
  const badSources = d.coverage.filter((c) => !c.ok).map((c) => c.source).join(', ');
  const footerNote = `Generated ${new Date(d.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · sources OK: ${okSources}${badSources ? ` · degraded: ${badSources}` : ''}`;
  const footer = `\n—\n${footerNote}`;
  const phoneHeader = `CORTEX GAZETTE — ${d.longDate}\n${d.greeting}`;
  const phone = renderPhoneText(phoneHeader, sections, `\n\n${footerNote}`);
  const phoneText = phone.text;
  const droppedForCap = phone.dropped;

  const markdown = [
    `# ${header.replace(/\n/g, ' — ')}`,
    '',
    ...sections.flatMap((sec) => [`## ${sec.title}`, '', ...sec.lines.map((l) => l.startsWith('•') || l.startsWith('✗') ? l : `- ${l}`), '']),
    footer,
  ].join('\n');

  const printHtml = renderPrintHtml(d, sections, footer);

  return {
    greeting: d.greeting,
    dayKey: d.dayKey,
    longDate: d.longDate,
    sections,
    phoneText,
    markdown,
    printHtml,
    stats: { chars: phoneText.length, droppedForCap },
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderPrintHtml(d: BriefData, sections: ComposedBrief['sections'], footer: string): string {
  const secHtml = sections.map((sec) => `
    <section class="sec">
      <h2>${esc(sec.title)}</h2>
      <ul>${sec.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    </section>`).join('');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Cortex Brief — ${esc(d.longDate)}</title>
<style>
  @page { size: letter; margin: 0.65in; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'SF Pro Text', Helvetica, sans-serif; color: #1a1a1a; margin: 0; padding: 0; font-size: 10.5pt; line-height: 1.45; }
  header { border-bottom: 3px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
  .greeting { font-size: 15pt; font-weight: 700; letter-spacing: -0.02em; }
  .dateline { font-size: 9pt; color: #666; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 4px; }
  .sec { margin-bottom: 12px; page-break-inside: avoid; }
  h2 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.14em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin: 0 0 6px; }
  ul { margin: 0; padding-left: 16px; }
  li { margin-bottom: 3px; }
  .decisions li { font-weight: 600; }
  footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 7.5pt; color: #888; }
</style></head><body>
<header>
  <div class="greeting">${esc(d.greeting)}</div>
  <div class="dateline">${esc(d.longDate)} · Cortex Chief's Brief</div>
</header>
${secHtml}
<footer>${esc(footer)}</footer>
</body></html>`;
}

// ── Spotlight rotation ─────────────────────────────────────────────
// Pick one aged item deterministically: oldest pending proposal or
// stalest open task, rotated by day so the long tail gets one honest
// look daily without swamping the brief.

export function pickSpotlight(input: {
  dayKey: string;
  oldestPendingProposal?: { title: string; ageDays: number };
  stalestTask?: { title: string; ageDays: number };
}): BriefSpotlight | undefined {
  const candidates = [input.oldestPendingProposal, input.stalestTask]
    .filter((c): c is { title: string; ageDays: number } => Boolean(c && c.ageDays >= 3));
  if (!candidates.length) return undefined;
  candidates.sort((a, b) => b.ageDays - a.ageDays);
  const seed = [...input.dayKey].reduce((a, c) => a + c.charCodeAt(0), 0);
  const pick = candidates[seed % Math.min(candidates.length, 2)];
  return { text: pick.title.slice(0, 90), ageDays: pick.ageDays };
}
