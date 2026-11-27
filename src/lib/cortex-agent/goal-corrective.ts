/**
 * goal-corrective.ts — closes the detection→action loop.
 *
 * The drift watch tells us WHAT is wrong; this module drafts WHAT TO DO
 * about it: a bounded corrective mission with clear done criteria,
 * assigned to the right agent, filed as a governed initiative proposal
 * the human accepts or vetoes. Nothing executes autonomously — fleet
 * tasking is tier-2 authority, so the proposal waits in the Initiative
 * Inbox until ACCEPT runs execTool('cortex_agents', …) → submitTask.
 *
 * Agent mapping (by mission nature):
 *   stall     → antigravity (orchestration: sequence ops, decompose,
 *               dispatch the corrective sequence)
 *   diversion → scout (research: is the diversion intentional dependency
 *               work or drift? deliverable = a prioritization brief)
 *   (future code-shaped findings → devin)
 *
 * Every corrective task carries input.goalId (the drifting goal) and
 * notifyOnFinish:true, so the resolution notice reports back with goal
 * progress — the loop closes in both directions.
 */

import { syncProposals as ledgerSyncProposals } from '../cortex-initiative-ledger';
import { forecastOutcome } from '../consciousness/social-tom';
import type { DriftFinding } from './goal-drift';

export interface CorrectiveDraft {
  agentId: 'antigravity' | 'scout' | 'devin';
  kind: string;
  title: string;
  input: Record<string, unknown>;
  doneCriteria: string;
  rationale: string;
  /** ToM layer's prediction for this agent+kind at draft time —
   *  weights the proposal's confidence and annotates the human's
   *  ACCEPT decision. Null when the agent is unmodeled. */
  forecast?: {
    successProb: number; expectedDurationMs: number;
    confidence: number; trained: boolean; updates: number;
  } | null;
}

function clip(s: string, n: number): string {
  const clean = (s || '').replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}

/**
 * Draft the bounded corrective mission for a drift finding. Returns null
 * for finding kinds without a corrective mapping (decay stays advisory).
 */
export function draftCorrectiveMission(f: DriftFinding): CorrectiveDraft | null {
  const goalTitle = clip(f.goalTitle, 70);
  let draft: CorrectiveDraft | null = null;
  if (f.kind === 'stall') {
    draft = {
      agentId: 'antigravity',
      kind: 'orchestrate',
      title: `Corrective: break the stall on "${goalTitle}"`,
      input: {
        goalId: f.goalId,
        notifyOnFinish: true,
        instruction: [
          `Goal "${f.goalTitle}" is stalled: ${f.detail}`,
          `Mission: sequence and kick off ONE bounded corrective sequence for this goal.`,
          `Constraints: one goal only, no scope expansion, done within 24h.`,
          `Suggested corrective from the detector: ${f.suggestion}`,
          `Done criteria: (a) at least one goal-linked ops item or agent task is dispatched, AND (b) its resolution notice is received, OR (c) a deliberate descope/re-prioritize decision is recorded in episodic memory.`,
        ].join(' '),
        correctiveFor: { kind: f.kind, detail: f.detail, severity: f.severity },
        correctiveForTitle: f.goalTitle,
      },
      doneCriteria: 'one goal-linked dispatch landed + resolution noticed, or a recorded descope decision',
      rationale: 'stall is an orchestration failure — work exists but nothing is sequenced; Antigravity decomposes and dispatches the corrective',
    };
  }
  if (f.kind === 'diversion') {
    draft = {
      agentId: 'scout',
      kind: 'research',
      title: `Corrective: audit effort diversion from "${goalTitle}"`,
      input: {
        goalId: f.goalId,
        notifyOnFinish: true,
        depth: 1,
        query: [
          `Effort-diversion audit for a declared goal that received zero attributed work in 24h while competing workstreams absorbed all activity.`,
          `Goal: "${f.goalTitle}". Finding: ${clip(f.detail, 180)}`,
          `Determine whether this pattern indicates intentional dependency work (e.g. a blocking security or launch prerequisite) or unplanned drift,`,
          `and recommend the single most effective corrective: rebalance effort, re-scope the goal, or explicitly log the diversion as intentional.`,
          `Deliverable: a short prioritization brief with a concrete recommendation.`,
        ].join(' '),
        correctiveFor: { kind: f.kind, detail: f.detail, severity: f.severity },
        correctiveForTitle: f.goalTitle,
      },
      doneCriteria: 'prioritization brief delivered + recommendation logged to episodic memory',
      rationale: 'diversion needs diagnosis before action — Scout researches whether the absorbing work is justified; Devin stays reserved for code-shaped findings',
    };
  }
  // ToM weighting: stamp the breath's forecast for the chosen agent+kind
  // so proposal confidence and the human's ACCEPT decision see it.
  if (draft) draft.forecast = forecastOutcome(draft.agentId, draft.kind) ?? null;
  return draft; // decay is advisory-only by design
}

/**
 * File the corrective mission as a governed initiative proposal. Tier-2 /
 * requiresApproval — it waits in the Initiative Inbox for ACCEPT/VETO;
 * the ledger's pending dedupe (by dedupeKey) prevents floods on repeated
 * drift episodes.
 */
export function proposeCorrectiveMission(f: DriftFinding): { proposed: boolean } {
  const draft = draftCorrectiveMission(f);
  if (!draft) return { proposed: false };
  // Forecast-weighted confidence: the ToM layer's predicted success for
  // this agent+kind scales the proposal's confidence toward its forecast
  // (untrained/absent forecasts keep the base 0.75). High-risk trained
  // forecasts also get an explicit caution line for the ACCEPT decision.
  const fc = draft.forecast;
  const risk = fc?.trained ? (fc.successProb < 0.35 ? 'high' : fc.successProb < 0.6 ? 'moderate' : 'low') : 'untrained';
  const confidence = fc?.trained
    ? Number(Math.min(0.9, Math.max(0.3, 0.75 * (0.6 + 0.4 * fc.successProb))).toFixed(2))
    : 0.75;
  const forecastLine = fc
    ? `ToM forecast: ${Math.round(fc.successProb * 100)}% predicted success${fc.trained ? '' : ' (untrained)'} (~${Math.round(fc.expectedDurationMs / 60000)}min expected, ${fc.updates} updates) — risk: ${risk}.`
    : 'ToM forecast: no model for this agent yet.';
  try {
    ledgerSyncProposals([{
      id: `goalcorrective:${f.goalId}:${f.kind}`,
      title: draft.title,
      description: [
        `${f.detail}`,
        `Corrective mission drafted → ${draft.agentId} (${draft.kind}).`,
        `Done criteria: ${draft.doneCriteria}.`,
        `Why this agent: ${draft.rationale}.`,
        forecastLine + (risk === 'high' ? ' Caution: the breath expects this agent to likely fail — weigh an alternate assignment or descope before ACCEPT.' : ''),
        `Accept dispatches the task with goal attribution + finish notification; veto logs the deviation only.`,
      ].join(' '),
      category: 'goal_drift_corrective',
      urgency: f.severity === 'high' ? 'high' : 'medium',
      confidence,
      rationale: `auto-drafted by the drift watch (${f.kind} finding on "${clip(f.goalTitle, 50)}")`,
      suggestedTool: 'cortex_agents',
      suggestedArgs: {
        action: 'task',
        agentId: draft.agentId,
        kind: draft.kind,
        title: draft.title,
        input: draft.input,
      },
      requiresApproval: true,
      autonomyTier: 2,
      source: 'goal-drift-corrective',
      dedupeKey: `goalcorrective:${f.goalId}:${f.kind}`,
      createdAtMs: Date.now(),
    }]);
    return { proposed: true };
  } catch {
    return { proposed: false };
  }
}
