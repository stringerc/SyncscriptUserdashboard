/**
 * goal-linker.ts — every active mission op and every commit attributed to
 * the primary life goal. Cortex's wish: "not just working — progressing
 * toward the strategic outcome." Manual link_work exists, but relying on
 * someone remembering to tag every item means most work stays unattributed.
 * This reconciler closes the gap deterministically:
 *
 *   1. Ops linking — any mission opsItem without a goalId inherits the
 *      primary goal (resolved live: the active goal that looks like the
 *      quarter target). Existing links are NEVER overwritten — manual
 *      attribution always wins.
 *
 *   2. Commit attribution — every new commit on the current branch is
 *      appended to .cortex-runtime/goal-attribution.jsonl with the primary
 *      goalId, so the strategic review can say "N commits this week toward
 *      <goal>" instead of counting anonymous SHAs.
 *
 *   3. Task attribution — schedule blocks already carry goalId; ops items
 *      verified done feed the same GOAL-LINKED WORK section in review.
 *
 * globalThis-guarded interval survives Vite restarts; state file survives
 * reboots so commit scanning is incremental, not re-attributing history.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getCortexGoals, type LifeGoal } from '../cortex-goals';
import { loadMission, saveMission } from '../cortex-agents/mission';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const ATTR_PATH = path.join(RUNTIME, 'goal-attribution.jsonl');
const STATE_PATH = path.join(RUNTIME, 'goal-linker.json');
const SCAN_INTERVAL_MS = 120_000;
const ATTR_MAX_LINES = 4000;

interface LinkerState {
  lastScanAt: number;
  seenShas: string[];
}

function loadState(): LinkerState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return {
      lastScanAt: Number(raw?.lastScanAt) || 0,
      seenShas: Array.isArray(raw?.seenShas) ? raw.seenShas.slice(-500) : [],
    };
  } catch {
    return { lastScanAt: 0, seenShas: [] };
  }
}

function saveState(s: LinkerState): void {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify({ lastScanAt: s.lastScanAt, seenShas: s.seenShas.slice(-500) }));
  } catch {}
}

/**
 * The "quarter target" goal: prefer an active goal whose title looks like
 * the launch/revenue objective, then any active quarter-horizon goal,
 * then the first active goal. Returns null when no goals exist.
 */
export function resolvePrimaryGoal(): LifeGoal | null {
  try {
    const active = getCortexGoals().list('active');
    if (!active.length) return null;
    const launchish = active.find((g) =>
      /launch|paying|customer|syncscript|revenue|first sale|distribution/i.test(g.title));
    if (launchish) return launchish;
    const quarter = active.find((g) => g.horizon === 'quarter');
    return quarter || active[0];
  } catch {
    return null;
  }
}

export interface OpsLinkResult {
  linked: number;
  labels: string[];
  goalId: string | null;
  goalTitle: string | null;
}

/** Fill empty goalId slots on mission ops items with the primary goal. */
export function syncOpsGoalLinks(): OpsLinkResult {
  const goal = resolvePrimaryGoal();
  if (!goal) return { linked: 0, labels: [], goalId: null, goalTitle: null };
  try {
    const ms = loadMission();
    const labels: string[] = [];
    for (const item of ms.opsItems) {
      if (item.goalId) continue; // manual attribution always wins
      item.goalId = goal.id;
      labels.push(item.label);
    }
    if (labels.length) saveMission(ms);
    return { linked: labels.length, labels, goalId: goal.id, goalTitle: goal.title };
  } catch {
    return { linked: 0, labels: [], goalId: goal.id, goalTitle: goal.title };
  }
}

export interface CommitAttribution {
  sha: string;
  subject: string;
  branch: string;
  goalId: string;
  goalTitle: string;
  ts: number;
}

function appendAttribution(records: CommitAttribution[]): void {
  if (!records.length) return;
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(ATTR_PATH, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
    // Cheap rotation: keep the file bounded.
    try {
      const lines = fs.readFileSync(ATTR_PATH, 'utf8').trim().split('\n');
      if (lines.length > ATTR_MAX_LINES) {
        fs.writeFileSync(ATTR_PATH, lines.slice(-ATTR_MAX_LINES).join('\n') + '\n');
      }
    } catch {}
  } catch {}
}

function readAttributions(): CommitAttribution[] {
  try {
    return fs.readFileSync(ATTR_PATH, 'utf8').trim().split('\n')
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean) as CommitAttribution[];
  } catch {
    return [];
  }
}

/** Attribute new commits on the current branch to the primary goal. */
export function attributeCommits(): number {
  const goal = resolvePrimaryGoal();
  if (!goal) return 0;
  const state = loadState();
  const seen = new Set(state.seenShas);
  let added = 0;
  try {
    // First run (lastScanAt=0) would sweep all history — bound it to commits
    // after the goal was declared, since earlier work can't serve a goal
    // that didn't exist yet.
    const minTs = state.lastScanAt || (goal.declaredAt ? goal.declaredAt - 60_000 : 0);
    const out = execFileSync('git', ['log', `--since=${new Date(minTs).toISOString()}`, '--format=%H%x1f%s%x1f%ct'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 5000,
    });
    let branch = 'unknown';
    try { branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: process.cwd(), encoding: 'utf8', timeout: 3000 }).trim(); } catch {}
    const records: CommitAttribution[] = [];
    for (const line of out.split('\n')) {
      if (!line.trim()) continue;
      const [sha, subject, ct] = line.split('\x1f');
      if (!sha || seen.has(sha)) continue;
      seen.add(sha);
      records.push({
        sha, subject: (subject || '').slice(0, 200), branch,
        goalId: goal.id, goalTitle: goal.title,
        ts: Number(ct) * 1000 || Date.now(),
      });
    }
    appendAttribution(records);
    added = records.length;
    state.seenShas = [...seen].slice(-500);
    state.lastScanAt = Date.now();
    saveState(state);
  } catch {}
  return added;
}

/** Commits attributed to a goal since a timestamp — for the strategic review. */
export function commitsTowardGoal(goalId: string, sinceMs: number): CommitAttribution[] {
  return readAttributions().filter((r) => r.goalId === goalId && r.ts >= sinceMs);
}

/** All attributions in a window regardless of goal — review-level view. */
export function recentAttributions(sinceMs: number): CommitAttribution[] {
  return readAttributions().filter((r) => r.ts >= sinceMs);
}

/**
 * Arm the reconciler: sync ops links + attribute commits now, then every
 * 2min. onLinked fires once per process when links are first applied so the
 * caller can narrate; steady-state runs stay silent (the review reads the
 * attribution file directly).
 */
export function startGoalLinker(onLinked?: (n: number, goalTitle: string) => void): void {
  const g = globalThis as any;
  if (g.__cortexGoalLinker) return;
  let narrated = false;
  const tick = () => {
    try {
      const ops = syncOpsGoalLinks();
      if (!narrated && ops.linked > 0 && ops.goalTitle) {
        narrated = true;
        onLinked?.(ops.linked, ops.goalTitle);
      }
      attributeCommits();
    } catch {}
  };
  tick();
  const timer = setInterval(tick, SCAN_INTERVAL_MS);
  (timer as any).unref?.();
  g.__cortexGoalLinker = timer;
}
