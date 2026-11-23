/**
 * goal-verification.ts — closes the corrective feedback loop.
 *
 * When an accepted corrective mission reaches a terminal state, the
 * intervention is not "done" — it's a hypothesis. This module verifies
 * whether the drift it targeted actually cleared:
 *
 *   corrective completes → mark goal+kind "under verification"
 *   next drift-watch cycle → re-evaluate:
 *     finding gone      → ambient "drift resolved" + verification record
 *     finding persists  → escalate: high-urgency proposal flagged for
 *                         DIRECT human review + ambient alert (the next
 *                         tier: widened orchestration with descope
 *                         authority — accepting it dispatches that)
 *   corrective failed/vetoed/cancelled → escalate immediately (the
 *     intervention never landed; no point waiting for metrics)
 *
 * Honesty note: stall/diversion metrics are effort-window based, so a
 * completed corrective's own goal-attributed archive record clears them
 * mechanically. "Resolved" therefore means "goal-linked effort resumed"
 * — outcome depth (ops verified, commits landed) stays visible in
 * GOAL PACE. Persisted findings are the signal that matters: they mean
 * effort stopped again or never resumed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { syncProposals as ledgerSyncProposals } from '../cortex-initiative-ledger';
import { draftCorrectiveMission } from './goal-corrective';
import type { DriftFinding } from './goal-drift';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const DRIFT_LOG = path.join(RUNTIME, 'goal-drift.jsonl');
const STATE_PATH = path.join(RUNTIME, 'goal-verification.json');

interface PendingVerification {
  goalId: string;
  goalTitle: string;
  kind: string;
  correctiveTaskId: string;
  correctiveTitle: string;
  finishedAt: number;
  escalated: boolean;
}

interface VerificationState { pending: Record<string, PendingVerification> }

function loadState(): VerificationState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { pending: raw?.pending && typeof raw.pending === 'object' ? raw.pending : {} };
  } catch {
    return { pending: {} };
  }
}

function saveState(s: VerificationState): void {
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

let notifier: ((msg: string) => void) | null = null;
/** vite.config wires this to ambientPush so verification gets a voice. */
export function setVerificationNotifier(fn: (msg: string) => void): void {
  notifier = fn;
}

function notify(msg: string): void {
  try { notifier?.(msg); } catch {}
}

/** Terminal-state hook: a corrective mission (task.input.correctiveFor)
 *  just resolved. Completed → mark for verification; anything else →
 *  the intervention never landed, escalate for direct review now. */
export function handleCorrectiveResolution(task: { id?: string; title?: string; status?: string; input?: Record<string, unknown> }): void {
  const input = task.input || {};
  const cf = input.correctiveFor as { kind?: string } | undefined;
  const goalId = String(input.goalId || '');
  if (!cf?.kind || !goalId) return;
  const kind = String(cf.kind);
  const key = `${goalId}:${kind}`;
  const state = loadState();
  const status = String(task.status || '');

  if (status === 'completed') {
    state.pending[key] = {
      goalId,
      goalTitle: String(input.correctiveForTitle || input.title || 'goal'),
      kind,
      correctiveTaskId: String(task.id || ''),
      correctiveTitle: String(task.title || ''),
      finishedAt: Date.now(),
      escalated: false,
    };
    saveState(state);
    appendDriftLog({ kind: 'verification_pending', goalId, correctiveKind: kind, taskId: task.id, taskTitle: task.title });
    return;
  }

  // failed / vetoed / cancelled — the corrective never produced its
  // effect. Escalate immediately; do not wait for metrics to notice.
  if (state.pending[key]) delete state.pending[key];
  saveState(state);
  appendDriftLog({ kind: 'verification_escalated', goalId, correctiveKind: kind, taskId: task.id, taskTitle: task.title, reason: `corrective ${status}` });
  fileEscalation({
    goalId,
    goalTitle: String(input.correctiveForTitle || input.title || 'goal'),
    kind,
    correctiveTitle: String(task.title || ''),
    reason: `corrective mission ended ${status.toUpperCase()} — the intervention never landed`,
  });
  notify(`⚠️ Corrective for "${String(input.correctiveForTitle || 'a drifting goal').slice(0, 50)}" ended ${status.toUpperCase()} — escalated for your review.`);
}

/** Called by runGoalDriftWatch every cycle with the fresh findings. */
export function onDriftEvaluation(findings: DriftFinding[], nowMs: number = Date.now()): void {
  const state = loadState();
  const keys = Object.keys(state.pending);
  if (!keys.length) return;
  let changed = false;
  for (const key of keys) {
    const p = state.pending[key];
    const stillDrifting = findings.some((f) => f.goalId === p.goalId && f.kind === p.kind);
    if (!stillDrifting) {
      // Metric cleared — goal-linked effort resumed (or the episode ended).
      delete state.pending[key];
      changed = true;
      appendDriftLog({
        kind: 'verification_resolved',
        goalId: p.goalId,
        goalTitle: p.goalTitle,
        correctiveKind: p.kind,
        taskId: p.correctiveTaskId,
        taskTitle: p.correctiveTitle,
        finishedAt: p.finishedAt,
        verifiedAt: nowMs,
      });
      notify(`✅ Drift resolved on "${p.goalTitle.slice(0, 55)}" — the corrective worked; goal-linked effort resumed.`);
      continue;
    }
    // Finding persists. Only escalate once the drift watch's own 6h
    // cooldown has expired — a re-fire after cooldown is the honest
    // "the intervention did not hold" signal, not the same episode's
    // tail. Before that, the watch suppresses alerts anyway.
    if (!p.escalated && nowMs - p.finishedAt > 6 * 3600_000) {
      p.escalated = true;
      changed = true;
      appendDriftLog({ kind: 'verification_escalated', goalId: p.goalId, goalTitle: p.goalTitle, correctiveKind: p.kind, taskId: p.correctiveTaskId, taskTitle: p.correctiveTitle, reason: 'finding re-fired after cooldown' });
      fileEscalation({
        goalId: p.goalId,
        goalTitle: p.goalTitle,
        kind: p.kind,
        correctiveTitle: p.correctiveTitle,
        reason: 'the drift finding re-fired after the corrective mission completed — the intervention did not hold',
      });
      notify(`⚠️ Corrective did not hold on "${p.goalTitle.slice(0, 50)}" — drift re-fired; escalated for your direct review.`);
    }
  }
  if (changed) saveState(state);
}

/** Tier-2 escalation proposal: flagged for DIRECT human review, carrying
 *  the next-tier corrective draft (widened orchestration with descope
 *  authority). Accepting it dispatches that mission. */
function fileEscalation(p: { goalId: string; goalTitle: string; kind: string; correctiveTitle: string; reason: string }): void {
  const finding: DriftFinding = {
    goalId: p.goalId,
    goalTitle: p.goalTitle,
    kind: p.kind as DriftFinding['kind'],
    detail: p.reason,
    suggestion: 'direct human review — the first corrective did not resolve the drift',
    severity: 'high',
  };
  // Escalation tier: diversion's first corrective was research (Scout) —
  // if it didn't hold, the next tier is orchestration (Antigravity) with
  // widened scope + descope authority. Stall re-drafts orchestration with
  // the failure reason embedded.
  const draft = draftCorrectiveMission({ ...finding, kind: (p.kind === 'diversion' ? 'stall' : p.kind) as DriftFinding['kind'] });
  try {
    ledgerSyncProposals([{
      id: `goalescalation:${p.goalId}:${p.kind}`,
      title: `ESCALATION: drift persists on "${p.goalTitle.slice(0, 55)}" after corrective`,
      description: [
        p.reason,
        `First corrective: "${p.correctiveTitle.slice(0, 80)}".`,
        draft ? `Next tier drafted → ${draft.agentId} (${draft.kind}): ${draft.doneCriteria}.` : 'No automated next tier — human decision required.',
        `Accept dispatches the escalated mission; veto means deliberate descope — either way, this needs YOU, not another silent retry.`,
      ].join(' '),
      category: 'goal_drift_escalation',
      urgency: 'critical',
      confidence: 0.9,
      rationale: 'corrective verification failed — governance escalation, not another automated attempt',
      suggestedTool: draft ? 'cortex_agents' : 'cortex_memory',
      suggestedArgs: draft
        ? { action: 'task', agentId: draft.agentId, kind: draft.kind, title: `ESCALATED corrective: ${draft.title}`, input: { ...draft.input, escalated: true, reason: p.reason } }
        : { action: 'save_episodic', content: `Goal drift escalation on "${p.goalTitle}": ${p.reason}. Human review required.` },
      requiresApproval: true,
      autonomyTier: 2,
      source: 'goal-verification',
      dedupeKey: `goalescalation:${p.goalId}:${p.kind}`,
      createdAtMs: Date.now(),
    }]);
  } catch {}
}
