/**
 * goal-drift.ts — predictive + real-time goal drift detection.
 *
 * Cortex's wishes: (1) soft-alert BEFORE a goal's metrics decline — a
 * low-entropy projection of the next ~3 days from the current focus
 * trend; (2) an immediate drift alert the moment effort diverges from
 * the declared horizon, carrying a suggested corrective action instead
 * of waiting for the quarterly review.
 *
 * "Focus" is measured in effort quanta — real events with timestamps:
 *   - agent task archive records (finishedAt, input.goalId)
 *   - commit attributions (goal-attribution.jsonl)
 *   - mission ops verified completions (verifiedAt, goalId)
 *
 * Three alert classes per active goal:
 *   decay    — 24h focus < 50% of the 7-day daily baseline (soft, early)
 *   stall    — pending goal-linked ops exist, zero attributed effort in
 *              72h, while the host is still active (hard drift)
 *   diversion— last-24h effort went overwhelmingly to OTHER goals
 *
 * Every alert is appended to goal-drift.jsonl (the quarterly-review
 * record), pushed to the ambient stream (proactive voice + recall), and
 * mirrored as a governed initiative proposal whose safe action is a
 * cortex_memory save_episodic — "log the deviation" is the default
 * corrective; re-prioritize/pause stay human decisions, suggested in
 * the alert text.
 *
 * Honest limits: "prediction" is a linear read of the trailing focus
 * rate, not a model — it catches decay trends, not black-swan events.
 * Tasks archived before goal-stamping have no goalId and count as
 * unattributed effort (reported, never silently attributed).
 */

import fs from 'node:fs';
import path from 'node:path';
import { getCortexGoals, type LifeGoal } from '../cortex-goals';
import { loadMission } from '../cortex-agents/mission';
import { readAttributions } from './goal-linker';
import { proposeAmbientAction } from './ambient-actions';
import { maybeGeneratePremortem } from './goal-premortem';
import { proposeCorrectiveMission } from './goal-corrective';
import { onDriftEvaluation } from './goal-verification';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const ARCHIVE_PATH = path.join(RUNTIME, 'task-archive.jsonl');
const DRIFT_LOG = path.join(RUNTIME, 'goal-drift.jsonl');
const STATE_PATH = path.join(RUNTIME, 'goal-drift-state.json');
const EVAL_INTERVAL_MS = 300_000; // 5 min
const DAY_MS = 86400_000;
const COOLDOWN_MS = 6 * 3600_000; // per goal+kind

interface EffortEvent { ts: number; goalId: string | null }
interface DriftState { alerts: Record<string, number> } // "${goalId}:${kind}" -> lastAlertAt

function loadState(): DriftState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { alerts: raw?.alerts && typeof raw.alerts === 'object' ? raw.alerts : {} };
  } catch {
    return { alerts: {} };
  }
}

function saveState(s: DriftState): void {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(s));
  } catch {}
}

function appendDriftLog(entry: Record<string, unknown>): void {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(DRIFT_LOG, JSON.stringify({ ...entry, ts: Date.now() }) + '\n');
  } catch {}
}

/** All effort events in the lookback window, tagged by goal. */
function collectEffortEvents(sinceMs: number): EffortEvent[] {
  const events: EffortEvent[] = [];
  // 1) Agent tasks — terminal archive records carry input.goalId now.
  try {
    if (fs.existsSync(ARCHIVE_PATH)) {
      for (const line of fs.readFileSync(ARCHIVE_PATH, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const r = JSON.parse(line);
          const ts = Number(r.finishedAt || r.createdAt || 0);
          if (ts < sinceMs) continue;
          const gid = r.input?.goalId;
          events.push({ ts, goalId: typeof gid === 'string' ? gid : null });
        } catch {}
      }
    }
  } catch {}
  // 2) Commits attributed by the linker.
  try {
    for (const a of readAttributions()) {
      if (a.ts >= sinceMs) events.push({ ts: a.ts, goalId: a.goalId });
    }
  } catch {}
  // 3) Mission ops verified completions — weighted as one quantum each.
  try {
    const ms = loadMission();
    for (const o of ms.opsItems || []) {
      const ts = Number(o.verifiedAt || 0);
      if (o.done && o.goalId && ts >= sinceMs) events.push({ ts, goalId: o.goalId });
    }
  } catch {}
  return events;
}

export interface DriftFinding {
  goalId: string;
  goalTitle: string;
  kind: 'decay' | 'stall' | 'diversion';
  detail: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Evaluate all active goals against the effort stream. Pure read — the
 * caller decides whether to alert (cooldowns applied there).
 */
export function evaluateGoalDrift(nowMs: number = Date.now()): DriftFinding[] {
  const findings: DriftFinding[] = [];
  let goals: LifeGoal[] = [];
  try { goals = getCortexGoals().list('active'); } catch { return findings; }
  if (!goals.length) return findings;

  const lookback = nowMs - 8 * DAY_MS;
  const events = collectEffortEvents(lookback);
  const totalRecent = events.filter((e) => e.ts >= nowMs - DAY_MS).length;

  for (const goal of goals) {
    const mine = events.filter((e) => e.goalId === goal.id);
    const last24 = mine.filter((e) => e.ts >= nowMs - DAY_MS).length;
    // Baseline: mean daily effort over the 7 days BEFORE today, so a
    // single hot day can't mask a decay trend.
    const prev7 = mine.filter((e) => e.ts >= nowMs - 8 * DAY_MS && e.ts < nowMs - DAY_MS);
    const baselineDaily = prev7.length / 7;

    // ── decay: soft predictive alert ──
    // Needs a real baseline to compare against (>=2 events/day), else a
    // young goal would alert on its first quiet day.
    if (baselineDaily >= 2 && last24 < baselineDaily * 0.5) {
      const dropPct = Math.round((1 - last24 / baselineDaily) * 100);
      // 3-day projection: linear read — at the current 24h rate, how
      // many of the next 3 days stay below half baseline?
      const belowDays = last24 === 0 ? 3 : last24 < baselineDaily * 0.5 ? Math.min(3, Math.ceil((baselineDaily * 0.5 - last24) / Math.max(0.5, baselineDaily * 0.25))) : 0;
      findings.push({
        goalId: goal.id, goalTitle: goal.title, kind: 'decay',
        detail: `focus down ${dropPct}% vs 7-day baseline (${last24} events in 24h vs ~${baselineDaily.toFixed(1)}/day). Projection: ~${belowDays} of the next 3 days below half-baseline at the current rate.`,
        suggestion: 're-prioritize: queue one small goal-linked ops item or task to re-seed the loop before the trend compounds',
        severity: last24 === 0 ? 'high' : 'medium',
      });
    }

    // ── stall: hard drift — goal has open work, zero effort in 72h,
    // host still active (so it's choice, not a dead machine).
    try {
      const ms = loadMission();
      const openOps = (ms.opsItems || []).filter((o) => o.goalId === goal.id && !o.done);
      const last72 = mine.filter((e) => e.ts >= nowMs - 3 * DAY_MS).length;
      if (openOps.length && last72 === 0 && totalRecent >= 3) {
        findings.push({
          goalId: goal.id, goalTitle: goal.title, kind: 'stall',
          detail: `${openOps.length} open ops item(s) and zero goal-attributed effort in 72h while the host logged ${totalRecent} effort events — focus has diverted.`,
          suggestion: 'pause or re-scope: review GOAL PACE, then either sequence the top pending op or deliberately descope it',
          severity: 'high',
        });
      }
    } catch {}

    // ── diversion: last-24h effort overwhelmingly on other goals ──
    const dayEvents = events.filter((e) => e.ts >= nowMs - DAY_MS && e.goalId);
    if (dayEvents.length >= 4) {
      const others = dayEvents.filter((e) => e.goalId !== goal.id).length;
      const share = others / dayEvents.length;
      if (share >= 0.6 && last24 === 0) {
        findings.push({
          goalId: goal.id, goalTitle: goal.title, kind: 'diversion',
          detail: `${Math.round(share * 100)}% of last-24h attributed effort (${others}/${dayEvents.length} events) went to other goals; this goal got none.`,
          suggestion: 'rebalance or log: if the diversion is intentional (e.g. launch sprint), log it for the quarterly review; else re-link pending work',
          severity: 'medium',
        });
      }
    }
  }
  return findings;
}

export interface DriftAlert extends DriftFinding {
  alerted: boolean;
}

/**
 * Evaluate + emit. Cooldown: one alert per goal+kind per 6h, persisted.
 * onAlert fires for NEW alerts only (post-cooldown) so callers narrate
 * transitions, not repeats. Every finding — alerted or cooled — is
 * appended to goal-drift.jsonl as the review record.
 */
export function runGoalDriftWatch(
  onAlert?: (f: DriftAlert) => void,
  nowMs: number = Date.now(),
): { evaluated: number; alerted: number } {
  const findings = evaluateGoalDrift(nowMs);
  // Verification loop: completed corrective missions get their drift
  // finding re-checked every cycle — cleared → "resolved" notice;
  // persisted past cooldown → escalation proposal for direct review.
  try { onDriftEvaluation(findings, nowMs); } catch {}
  const state = loadState();
  let alerted = 0;
  for (const f of findings) {
    appendDriftLog({ ...f });
    const key = `${f.goalId}:${f.kind}`;
    const last = state.alerts[key] || 0;
    if (nowMs - last < COOLDOWN_MS) continue;
    state.alerts[key] = nowMs;
    alerted++;
    // Governed follow-through: log the deviation into episodic memory
    // (SAFE_AUTO tool) so the quarterly review can read it back. The
    // re-prioritize/pause options stay human — suggested, not executed.
    try {
      proposeAmbientAction({
        dedupeKey: `goaldrift:${f.goalId}:${f.kind}`,
        title: `Goal drift: ${f.kind} on "${f.goalTitle.slice(0, 60)}"`,
        description: `${f.detail} Suggested: ${f.suggestion}`,
        category: 'goal_drift',
        urgency: f.severity === 'high' ? 'high' : 'medium',
        suggestedTool: 'cortex_memory',
        suggestedArgs: {
          action: 'save_episodic',
          content: `Goal drift ${f.kind} on "${f.goalTitle}": ${f.detail} Suggested corrective: ${f.suggestion}`,
        },
      });
    } catch {}
    // Pre-mortem + corrective mission: stall/diversion findings trigger an
    // auto-generated "what could have gone wrong" narrative AND a bounded
    // corrective mission draft (done criteria + agent assignment) filed as
    // a tier-2 initiative proposal — the human accepts or vetoes in the
    // Inbox. Nothing executes autonomously. Fire-and-forget — synthesis
    // (local LLM) must never block the watch.
    if (f.kind === 'stall' || f.kind === 'diversion') {
      try { void maybeGeneratePremortem(f).catch(() => {}); } catch {}
      try { proposeCorrectiveMission(f); } catch {}
    }
    try { onAlert?.({ ...f, alerted: true }); } catch {}
  }
  // Prune stale cooldown keys (>48h) so the state file stays bounded.
  for (const k of Object.keys(state.alerts)) {
    if (nowMs - state.alerts[k] > 48 * 3600_000) delete state.alerts[k];
  }
  saveState(state);
  return { evaluated: findings.length, alerted };
}

/**
 * Arm the watch: evaluate now, then every 5min. globalThis-guarded so
 * Vite restarts can't stack intervals; state file survives reboots.
 */
export function startGoalDriftWatch(onAlert?: (f: DriftAlert) => void): void {
  const g = globalThis as any;
  if (g.__cortexGoalDrift) return;
  try { runGoalDriftWatch(onAlert); } catch {}
  const timer = setInterval(() => {
    try { runGoalDriftWatch(onAlert); } catch {}
  }, EVAL_INTERVAL_MS);
  (timer as any).unref?.();
  g.__cortexGoalDrift = timer;
}
