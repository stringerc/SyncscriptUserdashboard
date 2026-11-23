/**
 * goal-premortem.ts — auto-generated pre-mortems for drifting goals.
 *
 * Cortex's wish: when a goal shows stall or diversion, don't just log
 * metrics — synthesize a brief "what could have gone wrong" narrative
 * from three REAL sources:
 *   1. the deviation record (goal-drift.jsonl findings for this goal)
 *   2. the ambient context (recent .cache/cortex-ambient.jsonl events)
 *   3. the last 30 days of episodic memory (.cache/cortex-episodic-memory.json)
 *
 * Synthesis tries the local mlx-lm sidecar (Qwen2.5-1.5B, OpenAI-compatible)
 * with a strict grounding prompt — facts only, no invention. If the
 * sidecar is unavailable or the call fails, a deterministic template
 * narrative is built from the same facts (quality floor, never silence).
 *
 * Every pre-mortem is appended to goal-premortems.jsonl (the review
 * record), surfaced in the strategic review, and announced ambiently.
 * Cooldown: one pre-mortem per goal+kind per 24h, persisted.
 *
 * Honest limits: the narrative is only as good as the retrieved context.
 * Episodic episodes are voice-turn summaries (cap 50); thin memory means
 * a thinner pre-mortem — the template fallback says so explicitly rather
 * than padding with generic risk boilerplate.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ensureSidecar } from './sidecars';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const CACHE = path.resolve(process.cwd(), '.cache');
const DRIFT_LOG = path.join(RUNTIME, 'goal-drift.jsonl');
const PREMORTEM_LOG = path.join(RUNTIME, 'goal-premortems.jsonl');
const STATE_PATH = path.join(RUNTIME, 'goal-premortem-state.json');
const AMBIENT_PATH = path.join(CACHE, 'cortex-ambient.jsonl');
const EPISODIC_PATH = path.join(CACHE, 'cortex-episodic-memory.json');
const COOLDOWN_MS = 24 * 3600_000; // per goal+kind
const LOOKBACK_DAYS = 30;

export interface PremortemFinding {
  goalId: string;
  goalTitle: string;
  kind: string;
  detail: string;
  suggestion: string;
  severity: string;
}

interface PremortemState { generated: Record<string, number> }

function loadState(): PremortemState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { generated: raw?.generated && typeof raw.generated === 'object' ? raw.generated : {} };
  } catch {
    return { generated: {} };
  }
}

function saveState(s: PremortemState): void {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(s));
  } catch {}
}

function appendPremortemLog(entry: Record<string, unknown>): void {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(PREMORTEM_LOG, JSON.stringify({ ...entry, ts: Date.now() }) + '\n');
  } catch {}
}

// ── Context collection (the three real sources) ────────────────────────

interface PremortemContext {
  driftFindings: Array<{ kind: string; detail: string; ts: number }>;
  ambientEvents: Array<{ text: string; ts: number }>;
  episodes: Array<{ user: string; reply: string; ts: string }>;
}

function clip(s: string, n: number): string {
  const clean = (s || '').replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}

function collectPremortemContext(goalId: string, nowMs: number): PremortemContext {
  const since = nowMs - LOOKBACK_DAYS * 86400_000;
  const ctx: PremortemContext = { driftFindings: [], ambientEvents: [], episodes: [] };

  // 1) Deviation record — this goal's drift findings, newest last.
  try {
    if (fs.existsSync(DRIFT_LOG)) {
      for (const line of fs.readFileSync(DRIFT_LOG, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const r = JSON.parse(line);
          if (r.goalId !== goalId) continue;
          const ts = Number(r.ts || 0);
          if (ts < since) continue;
          ctx.driftFindings.push({ kind: String(r.kind || ''), detail: clip(String(r.detail || ''), 240), ts });
        } catch {}
      }
      ctx.driftFindings = ctx.driftFindings.slice(-10);
    }
  } catch {}

  // 2) Ambient context — last 72h of host events (proc-watch chatter
  // excluded unless it reports a memory spike; those are the signal).
  try {
    if (fs.existsSync(AMBIENT_PATH)) {
      const lines = fs.readFileSync(AMBIENT_PATH, 'utf8').split('\n');
      for (let i = lines.length - 1; i >= 0 && ctx.ambientEvents.length < 12; i--) {
        if (!lines[i].trim()) continue;
        try {
          const r = JSON.parse(lines[i]);
          const ts = Number(r.ts || 0);
          if (ts < nowMs - 3 * 86400_000) break; // file is time-ordered; stop at 72h
          const text = String(r.text || '');
          if (/^Process watch:/.test(text) && !/spiked/.test(text)) continue;
          ctx.ambientEvents.unshift({ text: clip(text, 160), ts });
        } catch {}
      }
    }
  } catch {}

  // 3) Episodic memory — last 30 days, newest last, capped.
  try {
    if (fs.existsSync(EPISODIC_PATH)) {
      const raw = JSON.parse(fs.readFileSync(EPISODIC_PATH, 'utf8'));
      const eps = Array.isArray(raw?.episodes) ? raw.episodes : [];
      for (const e of eps) {
        const tsMs = Date.parse(String(e?.ts || ''));
        if (!Number.isFinite(tsMs) || tsMs < since) continue;
        const user = clip(String(e?.user || e?.content || ''), 220);
        const reply = clip(String(e?.reply || ''), 220);
        if (!user && !reply) continue;
        ctx.episodes.push({ user, reply, ts: String(e?.ts || '') });
      }
      ctx.episodes = ctx.episodes.slice(-15);
    }
  } catch {}

  return ctx;
}

// ── Synthesis: local mlx-lm first, deterministic template fallback ─────

const PREMORTEM_SYSTEM =
  'You are Cortex\'s pre-mortem engine. Write a brief "what could have gone wrong" narrative (3-5 sentences) for a goal that is showing drift. ' +
  'Use ONLY the facts provided in the user message — the drift findings, ambient host events, and episodic memory excerpts. ' +
  'Name concrete failure modes grounded in that evidence (e.g. which workstream starved, which host event coincided, which conversation pattern repeated). ' +
  'If the evidence is thin, say exactly what is missing instead of inventing risks. No bullet lists, no advice, no filler — a narrative a strategist can read in ten seconds.';

async function synthesizeWithMlxLm(finding: PremortemFinding, ctx: PremortemContext): Promise<string | null> {
  const up = await ensureSidecar('mlx-lm', 20000).catch(() => false);
  if (!up) return null;
  const payload = {
    model: process.env.MLX_LM_MODEL || 'mlx-community/Qwen2.5-1.5B-Instruct-4bit',
    messages: [
      { role: 'system', content: PREMORTEM_SYSTEM },
      {
        role: 'user',
        content: [
          `GOAL: "${finding.goalTitle}"`,
          `DRIFT FINDING (${finding.kind}, ${finding.severity}): ${finding.detail}`,
          `SUGGESTED CORRECTIVE (from detector): ${finding.suggestion}`,
          '',
          'DEVIATION RECORD (goal-drift.jsonl, last 30d):',
          ctx.driftFindings.length ? ctx.driftFindings.map((d) => `- [${d.kind}] ${d.detail}`).join('\n') : '(none)',
          '',
          'AMBIENT HOST CONTEXT (last 72h):',
          ctx.ambientEvents.length ? ctx.ambientEvents.map((a) => `- ${a.text}`).join('\n') : '(none)',
          '',
          'EPISODIC MEMORY (last 30d excerpts):',
          ctx.episodes.length
            ? ctx.episodes.map((e) => `- user: ${e.user || '(empty)'} | cortex: ${e.reply || '(empty)'}`).join('\n')
            : '(none)',
        ].join('\n'),
      },
    ],
    max_tokens: 260,
    temperature: 0.4,
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch('http://127.0.0.1:8931/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    const text = String(j?.choices?.[0]?.message?.content || '').trim();
    return text.length >= 40 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Deterministic quality floor — same facts, structured narrative. */
function synthesizeTemplate(finding: PremortemFinding, ctx: PremortemContext): string {
  const parts: string[] = [];
  parts.push(`Pre-mortem for "${finding.goalTitle}" (${finding.kind}): ${finding.detail}`);
  if (ctx.driftFindings.length > 1) {
    const kinds = [...new Set(ctx.driftFindings.map((d) => d.kind))];
    parts.push(`This is not the first drift signal — ${ctx.driftFindings.length} findings in 30 days across ${kinds.join('/')} suggests a recurring pattern, not a one-off.`);
  }
  if (ctx.ambientEvents.length) {
    const notable = ctx.ambientEvents.filter((a) => /spiked|crash|exit|pressure|branch/i.test(a.text)).slice(-3);
    if (notable.length) parts.push(`Host context that may have contributed: ${notable.map((a) => clip(a.text, 100)).join(' · ')}`);
  }
  if (ctx.episodes.length) {
    const last = ctx.episodes[ctx.episodes.length - 1];
    if (last?.user) parts.push(`Most recent goal-adjacent conversation ended with: "${clip(last.user, 120)}" — check whether that thread was abandoned mid-flight.`);
  } else {
    parts.push('Episodic memory returned no excerpts for this window — the "why" here is underdetermined; treat this as a hypothesis to verify, not a diagnosis.');
  }
  parts.push(`Most likely failure shape: attention fragmented across competing workstreams while ${finding.kind === 'stall' ? 'the declared ops items waited without a forcing function' : 'effort flowed to whichever goal was loudest in the moment'}.`);
  return parts.join(' ');
}

// ── Public API ─────────────────────────────────────────────────────────

let notifier: ((msg: string) => void) | null = null;
/** vite.config wires this to ambientPush so the pre-mortem gets a voice. */
export function setPremortemNotifier(fn: (msg: string) => void): void {
  notifier = fn;
}

/**
 * Generate a pre-mortem for a drift finding. Cooldown: one per goal+kind
 * per 24h. Fire-and-forget safe — never throws, never blocks the watch.
 */
export async function maybeGeneratePremortem(f: PremortemFinding): Promise<{ generated: boolean; reason?: string; narrative?: string }> {
  const key = `${f.goalId}:${f.kind}`;
  const state = loadState();
  const last = state.generated[key] || 0;
  if (Date.now() - last < COOLDOWN_MS) return { generated: false, reason: 'cooldown' };
  state.generated[key] = Date.now();
  // Prune stale keys (>7d).
  for (const k of Object.keys(state.generated)) {
    if (Date.now() - state.generated[k] > 7 * 86400_000) delete state.generated[k];
  }
  saveState(state);

  const ctx = collectPremortemContext(f.goalId, Date.now());
  const llmNarrative = await synthesizeWithMlxLm(f, ctx).catch(() => null);
  const narrative = llmNarrative || synthesizeTemplate(f, ctx);
  const engine = llmNarrative ? 'mlx-lm' : 'template';
  const record = {
    goalId: f.goalId,
    goalTitle: f.goalTitle,
    kind: f.kind,
    severity: f.severity,
    findingDetail: f.detail,
    suggestion: f.suggestion,
    narrative,
    engine,
    contextStats: {
      driftFindings: ctx.driftFindings.length,
      ambientEvents: ctx.ambientEvents.length,
      episodes: ctx.episodes.length,
    },
  };
  appendPremortemLog(record);
  try {
    notifier?.(`🧠 Pre-mortem for "${f.goalTitle.slice(0, 50)}" (${f.kind}): ${clip(narrative, 220)}`);
  } catch {}
  return { generated: true, narrative };
}

export interface LatestPremortem {
  goalId: string;
  goalTitle: string;
  kind: string;
  narrative: string;
  engine: string;
  ts: number;
}

/** Latest pre-mortem per goal — for the strategic review. */
export function getLatestPremortems(): LatestPremortem[] {
  const byGoal = new Map<string, LatestPremortem>();
  try {
    if (!fs.existsSync(PREMORTEM_LOG)) return [];
    for (const line of fs.readFileSync(PREMORTEM_LOG, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        if (!r?.goalId || !r?.narrative) continue;
        const cur = byGoal.get(r.goalId);
        if (!cur || Number(r.ts || 0) > cur.ts) {
          byGoal.set(r.goalId, {
            goalId: r.goalId,
            goalTitle: String(r.goalTitle || ''),
            kind: String(r.kind || ''),
            narrative: String(r.narrative || ''),
            engine: String(r.engine || ''),
            ts: Number(r.ts || 0),
          });
        }
      } catch {}
    }
  } catch {}
  return [...byGoal.values()];
}
