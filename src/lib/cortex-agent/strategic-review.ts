/**
 * Strategic Review — Cortex's weekly strategic-partner ritual.
 *
 * Everything else Cortex does is reactive or threshold-triggered. This
 * is the deliberate cadence: once a week, compile the full strategic
 * state (life goals, constraints, mission ops, ventures, life events,
 * fleet health, measured signal feeds, recent conversational digests),
 * run it through the deep-tier model, and persist a written brief —
 * where you stand vs. each goal, the real tension, recommended
 * priorities. Then narrate the headline into chat.
 *
 * The review also FEEDS the goals engine: resolved signal values are
 * recorded as this week's observations (recordSignal) and drift is
 * recomputed (reviewGoals) — so drift detection and forecasting run on
 * real measurements, not declarations.
 *
 * Triggered from self-regulation's 5-minute tick behind a 6-day gate
 * (timestamp persisted in .cortex-runtime/strategic-review.json so the
 * cadence survives restarts). Also runnable on demand via
 * POST /api/cortex/strategic/review.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getCortexGoals } from '../cortex-goals';
import { listConstraints, constraintDigest } from './constraints';
import { computeSignalFeeds, resolveGoalSignals } from './signal-feeds';
import { recentAttributions } from './goal-linker';
import { getLatestPremortems } from './goal-premortem';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const BRIEFS_DIR = path.join(RUNTIME, 'briefs');
const STATE_FILE = path.join(RUNTIME, 'strategic-review.json');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface StrategicReviewState {
  lastRunAt: number;
  lastBriefPath: string | null;
  lastHeadline: string | null;
  runCount: number;
}

function loadState(): StrategicReviewState {
  try {
    return { lastRunAt: 0, lastBriefPath: null, lastHeadline: null, runCount: 0, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
  } catch {
    return { lastRunAt: 0, lastBriefPath: null, lastHeadline: null, runCount: 0 };
  }
}

function saveState(s: StrategicReviewState): void {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } catch {}
}

function readJsonSafe<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function isoWeek(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return `${date.getUTCFullYear()}-W${String(Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)).padStart(2, '0')}`;
}

/** Keywords worth matching in conversational digests — fuzzy but honest. */
function goalKeywords(title: string): string[] {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'have', 'will', 'goal', 'quarter', 'month', 'year'].includes(w))
    .slice(0, 4);
}

/**
 * Record this week's measured signal values into each goal's history
 * and recompute drift. Idempotent per ISO week — safe to call from
 * every review run and from the weekly pulse.
 */
export function feedGoalSignals(): { goalsFed: number; unresolved: string[] } {
  const goalsEngine = getCortexGoals();
  const active = goalsEngine.list('active').filter(g => (g.signals || []).length > 0);
  if (!active.length) return { goalsFed: 0, unresolved: [] };

  const feeds = computeSignalFeeds();
  const { perGoal, allValues, unresolved } = resolveGoalSignals(active, feeds);
  const week = isoWeek();
  let fed = 0;

  for (const g of active) {
    const vals = perGoal[g.id];
    if (!vals || !Object.keys(vals).length) continue;
    // Skip if this week already recorded (review may run twice).
    const already = (g.history || []).some(h => h.period === week);
    if (!already) {
      goalsEngine.recordSignal(g.id, vals, week);
      fed++;
    }
  }
  // Drift recompute uses this period's resolved values.
  if (Object.keys(allValues).length) {
    try { goalsEngine.reviewGoals(allValues); } catch {}
  }
  return { goalsFed: fed, unresolved };
}

/** Compile the full strategic state digest for the review prompt. */
export function compileStrategicState(): string {
  const goalsEngine = getCortexGoals();
  const allGoals = goalsEngine.list();
  const activeGoals = allGoals.filter(g => g.status === 'active');
  const feeds = computeSignalFeeds();
  const { perGoal, unresolved, sources } = resolveGoalSignals(activeGoals, feeds);
  const sections: string[] = [];

  // ── Life goals ──
  if (activeGoals.length) {
    const lines = activeGoals.map(g => {
      const steps = g.steps || [];
      const open = steps.filter(s => !s.completed);
      const parts = [`- "${g.title}" (${g.horizon}${g.targetDate ? `, target ${new Date(g.targetDate).toISOString().slice(0, 10)}` : ''}, declared ${new Date(g.declaredAt).toISOString().slice(0, 10)})`];
      if (steps.length) parts.push(`  steps: ${steps.length - open.length}/${steps.length} done${open.length ? ` — next: "${open[0].title}"` : ' — all complete'}`);
      if (g.driftScore && g.driftScore > 0) parts.push(`  drift: ${Math.round(g.driftScore * 100)}% over ${g.driftWeeks || 0}wk`);
      const sigVals = perGoal[g.id];
      if (sigVals && Object.keys(sigVals).length) {
        parts.push(`  measured signals: ${Object.entries(sigVals).map(([k, v]) => {
          const feed = sources[k];
          const proxy = feed && feed !== k ? ` (proxy feed: ${feed})` : '';
          return `${k}=${v}${proxy}`;
        }).join(', ')}`);
      } else if ((g.signals || []).length) {
        parts.push(`  declared signals (unmeasured): ${(g.signals || []).join(', ')}`);
      }
      return parts.join('\n');
    });
    sections.push(`## ACTIVE LIFE GOALS\n${lines.join('\n')}`);
  } else {
    sections.push('## ACTIVE LIFE GOALS\n(none declared — the user has not set life goals yet; recommending goal-setting is itself a valid strategic output)');
  }

  const otherGoals = allGoals.filter(g => g.status !== 'active');
  if (otherGoals.length) {
    sections.push(`## OTHER GOALS\n${otherGoals.map(g => `- "${g.title}" (${g.status})`).join('\n')}`);
  }

  // ── Constraints ──
  const cDigest = constraintDigest();
  if (cDigest) sections.push(`## CONSTRAINTS\n${cDigest.replace('CONSTRAINTS (strategy must respect these):\n', '')}`);

  // ── Mission ops ──
  try {
    const mission = readJsonSafe<any>(path.join(RUNTIME, 'mission.json'), { goals: [], opsItems: [] });
    const ops = mission?.opsItems || [];
    const done = ops.filter((o: any) => o.done).length;
    const cutoff = Date.now() - WEEK_MS;
    const recentDone = ops.filter((o: any) => o.done && Number(o.verifiedAt || 0) >= cutoff).length;
    const pending = ops.filter((o: any) => !o.done).slice(0, 10);
    const goalTitle = (gid?: string) => gid ? (allGoals.find(g => g.id === gid)?.title || gid) : null;
    sections.push(`## MISSION OPS (${done}/${ops.length} done, ${recentDone} verified this week)\n${pending.map((o: any) => `- [${o.lastStatus || 'pending'}] ${o.label}${o.goalId ? ` → goal: ${goalTitle(o.goalId)}` : ''}`).join('\n') || '(none pending)'}`);
    // Effort attribution: ops items explicitly linked to life goals.
    const linked = ops.filter((o: any) => o.goalId);
    if (linked.length) {
      const byGoal = new Map<string, { total: number; done: number }>();
      for (const o of linked) {
        const g = goalTitle(o.goalId)!;
        const cur = byGoal.get(g) || { total: 0, done: 0 };
        cur.total++; if (o.done) cur.done++;
        byGoal.set(g, cur);
      }
      sections.push(`## GOAL-LINKED WORK (ops items tagged to life goals)\n${[...byGoal.entries()].map(([g, c]) => `- "${g}": ${c.done}/${c.total} ops items done`).join('\n')}`);
    }
    // Commit attribution — every commit on the branch counts toward the
    // primary goal (goal-linker reconciler). This is the "every commit
    // contributes to the quarter target" ledger.
    let attr: ReturnType<typeof recentAttributions> = [];
    try {
      const cutoffMs = Date.now() - WEEK_MS;
      attr = recentAttributions(cutoffMs);
      if (attr.length) {
        const byGoal = new Map<string, number>();
        for (const a of attr) byGoal.set(a.goalTitle, (byGoal.get(a.goalTitle) || 0) + 1);
        sections.push(`## COMMIT ATTRIBUTION (this week)\n${[...byGoal.entries()].map(([g, n]) => `- "${g}": ${n} commit${n === 1 ? '' : 's'}`).join('\n')}`);
      }
    } catch {}
    // Goal pace — the "accelerating toward the deadline or spinning"
    // readout. Per active goal: ops completion, this week's commits,
    // days remaining, and a linear pace verdict.
    try {
      const paceLines: string[] = [];
      for (const g of allGoals.filter((x: any) => x.status === 'active')) {
        const gOps = ops.filter((o: any) => o.goalId === g.id);
        const gDone = gOps.filter((o: any) => o.done).length;
        const gCommits = attr.filter((a: any) => a.goalId === g.id).length;
        const daysLeft = g.targetDate ? Math.max(0, Math.ceil((g.targetDate - Date.now()) / 86400_000)) : null;
        let verdict = '';
        if (daysLeft !== null && gOps.length) {
          const neededPerDay = (gOps.length - gDone) / Math.max(1, daysLeft);
          // Rough pace proxy: ops completed per day over the last 7 days
          // vs ops still needed per day to hit target.
          const recentDone = gOps.filter((o: any) => o.done && Number(o.verifiedAt || 0) >= cutoff).length;
          const pace = recentDone / 7;
          verdict = pace >= neededPerDay * 0.8 ? 'on-pace' : pace > 0 ? 'behind-pace' : 'stalled';
        }
        const dl = daysLeft !== null ? `${daysLeft}d left` : 'no deadline';
        paceLines.push(`- "${g.title}": ${gDone}/${gOps.length} ops done, ${gCommits} commits this wk, ${dl}${verdict ? ` — ${verdict}` : ''}`);
      }
      if (paceLines.length) sections.push(`## GOAL PACE (drift check vs horizon)\n${paceLines.join('\n')}`);
      // Pre-mortems — the "why" behind stall/diversion findings, synthesized
      // from the deviation record + ambient context + 30d episodic memory.
      try {
        const pms = getLatestPremortems();
        if (pms.length) {
          sections.push(`## PRE-MORTEMS (auto-generated failure narratives for drifting goals)\n${pms.map((p) => `- "${p.goalTitle}" [${p.kind}, ${p.engine}] — ${p.narrative}`).join('\n')}`);
        }
      } catch {}
    } catch {}
    const mGoals = (mission?.goals || []).filter((g: any) => g.status === 'active');
    if (mGoals.length) {
      sections.push(`## MISSION GOALS\n${mGoals.map((g: any) => `- ${g.title} (${g.horizon || 'ongoing'})`).join('\n')}`);
    }
  } catch {}

  // ── Ventures ──
  try {
    const ventures = readJsonSafe<any[]>(path.join(RUNTIME, 'ventures.json'), []);
    if (ventures.length) {
      sections.push(`## VENTURES\n${ventures.map(v => `- ${v.name} (${v.status}${v.paused ? ', PAUSED' : ''}) — ${v.cyclesToday ?? 0} cycles today, budget ${v.budgetPerDay ?? '?'}/day`).join('\n')}`);
    }
  } catch {}

  // ── Life events horizon ──
  try {
    const life = readJsonSafe<any>(path.join(RUNTIME, 'life-events.json'), { events: [] });
    const now = Date.now();
    const horizon = now + 30 * 24 * 60 * 60 * 1000;
    const upcoming = (life?.events || []).filter((e: any) =>
      e?.status !== 'dismissed' && e?.status !== 'expired' &&
      typeof e?.dateStart === 'number' && e.dateStart >= now && e.dateStart <= horizon,
    ).slice(0, 10);
    if (upcoming.length) {
      sections.push(`## LIFE EVENTS (next 30d)\n${upcoming.map((e: any) => `- ${new Date(e.dateStart).toISOString().slice(0, 10)}: ${e.title} (${e.kind})`).join('\n')}`);
    }
  } catch {}

  // ── Fleet health ──
  try {
    const res = readJsonSafe<any>(path.join(RUNTIME, 'resonance', 'latest.json'), {});
    if (res?.fleetSize) {
      sections.push(`## FLEET\n- nodes up: ${res.nodesUp ?? '?'}/${res.fleetSize} (infra ${res.infraUp ?? '?'}/${res.infraTotal ?? '?'}) — lazy voice sidecars wake on demand`);
    }
  } catch {}

  // ── Measured signal feeds ──
  sections.push(`## MEASURED FEEDS (last 7 days)\n${Object.entries(feeds).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`);
  if (unresolved.length) {
    sections.push(`## UNMEASURED DECLARED SIGNALS (no feed exists — do not fabricate)\n${unresolved.map(s => `- ${s}`).join('\n')}`);
  }

  // ── Recent conversational digests + per-goal effort attribution ──
  try {
    const cont = readJsonSafe<any>(path.join(RUNTIME, 'continuity.json'), { sessions: {} });
    const allTurns: { ts: number; user: string; ai: string }[] = [];
    for (const s of Object.values<any>(cont?.sessions || {})) {
      for (const t of s?.turns || []) allTurns.push(t);
    }
    allTurns.sort((a, b) => a.ts - b.ts);
    const recent = allTurns.slice(-12);
    if (recent.length) {
      sections.push(`## RECENT CONVERSATION (digests)\n${recent.map(t => `- user: "${t.user}" → cortex: "${t.ai}"`).join('\n')}`);
      // Effort attribution: fuzzy keyword mentions per active goal —
      // labeled honestly as mentions, not verified work.
      const attrLines = activeGoals.map(g => {
        const kws = goalKeywords(g.title);
        if (!kws.length) return null;
        const hits = recent.filter(t => {
          const hay = `${t.user} ${t.ai}`.toLowerCase();
          return kws.filter(k => hay.includes(k)).length >= 1;
        }).length;
        return hits > 0 ? `- "${g.title}": ${hits} recent exchange(s) mention related terms` : null;
      }).filter(Boolean);
      if (attrLines.length) {
        sections.push(`## GOAL ACTIVITY (fuzzy mention counts — indicative, not verified effort)\n${attrLines.join('\n')}`);
      }
    }
  } catch {}

  return sections.join('\n\n');
}

const REVIEW_PROMPT = `You are Cortex conducting the weekly STRATEGIC REVIEW — the ritual that turns execution into partnership.

Using ONLY the state below (do not ask for more data, do not use tools), write a strategic brief with this structure:

# Strategic Review — <ISO week>

## Where you stand
Per active goal: progress read (steps, measured signals vs. expectation, drift), one honest sentence each.

## The real tension
The single most important trade-off or risk visible in the state — be specific and factual, not motivational.

## Recommended priorities (top 3)
Concrete, ordered, feasible within the stated constraints. Each: what to do, which goal/mission item it serves, roughly what it costs.

## What to ignore
Anything consuming attention that the state suggests should be dropped, paused, or delegated.

## One question for the user
The single most useful clarifying question a strategic partner would ask.

Rules: cite the data (numbers, dates, names). If a goal has no measured signals, say so — never invent metrics. Keep it under 500 words. Write for a busy founder, not a consultant.`;

/**
 * Run the full review: feed signals → compile state → deep-tier call →
 * persist brief → narrate headline. Returns the outcome for callers.
 */
export async function runStrategicReview(port: number): Promise<{ ok: boolean; briefPath?: string; headline?: string; error?: string }> {
  const started = Date.now();
  try {
    // 1. Feed this week's measured signals into the goals engine.
    const fed = feedGoalSignals();

    // 2. Compile state.
    const stateDigest = compileStrategicState();

    // 3. Deep-tier review call through nexus-guest (matrix 'deep' lane).
    const selfPort = port || (process.env.PORT ? parseInt(process.env.PORT, 10) : 5173);
    const res = await fetch(`http://127.0.0.1:${selfPort}/api/ai/nexus-guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: 'cortex',
        tier: 'deep',
        internal: true,               // don't record as a user turn
        systemPrompt: `You are Cortex, the executive operational consciousness of SyncScript. ${REVIEW_PROMPT}\n\n=== CURRENT STRATEGIC STATE ===\n${stateDigest}\n=== END STATE ===`,
        messages: [{ role: 'user', content: 'Run the weekly strategic review now.' }],
        stream: true,
      }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!res.ok || !res.body) {
      return { ok: false, error: `nexus-guest HTTP ${res.status}` };
    }

    // 4. Collect streamed tokens.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let brief = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;
        try {
          const ev = JSON.parse(payload);
          if (ev?.type === 'TEXT_MESSAGE_CONTENT' && typeof ev.token === 'string') brief += ev.token;
          else if (typeof ev?.token === 'string' && !ev.type) brief += ev.token;
        } catch {}
      }
    }
    brief = brief.trim();
    if (!brief || brief.length < 100) {
      return { ok: false, error: 'review produced empty/too-short output', headline: brief.slice(0, 120) };
    }

    // 5. Persist brief.
    fs.mkdirSync(BRIEFS_DIR, { recursive: true });
    const week = isoWeek();
    const briefPath = path.join(BRIEFS_DIR, `strategic-${week}.md`);
    const header = `<!-- Cortex Strategic Review · ${week} · generated ${new Date().toISOString()} · goalsFed=${fed.goalsFed} · ${Math.round((Date.now() - started) / 1000)}s -->\n\n`;
    fs.writeFileSync(briefPath, header + brief + '\n');

    // 6. Headline for narration — first section heading + opening line.
    const headline = brief.split('\n').find(l => l.startsWith('#') || l.startsWith('##'))?.replace(/^#+\s*/, '')
      || brief.slice(0, 80);
    const firstPara = brief.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('|'))[0] || '';

    // 7. Narrate into chat (respecting that this is Cortex-initiated).
    try {
      await fetch(`http://127.0.0.1:${selfPort}/api/cortex/chat-append`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            id: `strategic-${Date.now()}`,
            role: 'assistant',
            content: `📋 **Strategic Review — ${week}**\n\n${firstPara.slice(0, 400)}\n\n*Full brief: .cortex-runtime/briefs/strategic-${week}.md — ask me "strategic review" anytime for the latest.*`,
            timestamp: Date.now(),
            meta: { source: 'strategic-review', briefPath },
          }],
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {}

    // 8. Persist run state.
    const st = loadState();
    saveState({ lastRunAt: Date.now(), lastBriefPath: briefPath, lastHeadline: headline, runCount: st.runCount + 1 });

    return { ok: true, briefPath, headline };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 300) };
  }
}

/** 6-day cadence gate — called from self-regulation's tick. */
export function strategicReviewDue(now = Date.now()): boolean {
  return now - loadState().lastRunAt > 6 * 24 * 60 * 60 * 1000;
}
