/**
 * Learning / Adaptation Layer (fleet spec §6).
 *
 * A lightweight bandit per (agent, task-class) choosing among parameter arms
 * (model tier + temperature presets). Rewards come from real task outcomes —
 * completed=1.0, partial=0.5, failed=0.0 — recorded automatically off the
 * runtime's task.transition stream. Policies persist in the shared workspace
 * under agent:{id}:policy/bandit:{kind} so they survive restarts and are
 * visible to the agent itself via workspaceBlock.
 *
 * Honest scope: this is the statistics layer. selectPolicy() is exported for
 * workers to consult; arms currently influence reported preference, and the
 * reward loop is live. Wiring arm selection into every worker's modelPin is
 * the follow-on — until then the bandit learns from 'default' arm pulls.
 *
 * Safety: policy changes never touch riskScore>5 actions — this layer only
 * advises generation parameters, it cannot authorize anything.
 */

import { wsRead, wsWrite, wsList } from './agent-workspace';
import type { AgentEvent } from './types';

export interface PolicyArm {
  id: string;
  tier: 'fast' | 'reason' | 'deep';
  temperature: number;
  description: string;
}

/** Arm presets — deliberately small so pulls accumulate fast. */
export const POLICY_ARMS: PolicyArm[] = [
  { id: 'cheap-fast', tier: 'fast', temperature: 0.2, description: 'fast tier, low temp — cheap, deterministic' },
  { id: 'balanced', tier: 'reason', temperature: 0.5, description: 'reason tier, medium temp — default workhorse' },
  { id: 'deep-careful', tier: 'deep', temperature: 0.3, description: 'deep tier, low temp — hard reasoning, costly' },
];

const EPSILON = 0.15; // explore rate
const MIN_PULLS_CONFIDENT = 5;

interface BanditState {
  arms: Record<string, { pulls: number; rewardSum: number }>;
  lastArm?: string;
  updatedAt: number;
}

function policyNs(agentId: string) { return `agent:${agentId}:policy`; }
function banditKey(kind: string) { return `bandit:${kind}`; }

function loadBandit(agentId: string, kind: string): BanditState {
  const r = wsRead(policyNs(agentId), banditKey(kind));
  if (r.ok && r.value && typeof r.value === 'object') return r.value as BanditState;
  return { arms: {}, updatedAt: Date.now() };
}

function saveBandit(agentId: string, kind: string, state: BanditState, expectVersion?: number) {
  state.updatedAt = Date.now();
  wsWrite(agentId, policyNs(agentId), banditKey(kind), state, { expectVersion });
}

/** Epsilon-greedy arm selection. Returns the arm + whether it was exploratory. */
export function selectPolicy(agentId: string, kind: string): { arm: PolicyArm; exploratory: boolean } {
  const state = loadBandit(agentId, kind);
  const explore = Math.random() < EPSILON || !Object.keys(state.arms).length;
  if (explore) {
    const arm = POLICY_ARMS[Math.floor(Math.random() * POLICY_ARMS.length)];
    state.lastArm = arm.id;
    saveBandit(agentId, kind, state);
    return { arm, exploratory: true };
  }
  // Exploit: highest empirical mean reward; ties → fewer pulls wins (optimism
  // for under-sampled arms is handled by epsilon, keep exploit simple).
  let best = POLICY_ARMS[0];
  let bestScore = -1;
  for (const arm of POLICY_ARMS) {
    const s = state.arms[arm.id];
    const mean = s && s.pulls > 0 ? s.rewardSum / s.pulls : 0;
    // UCB-lite: mean + small bonus for under-sampled arms.
    const score = mean + ((s?.pulls ?? 0) < MIN_PULLS_CONFIDENT ? 0.05 : 0);
    if (score > bestScore) { bestScore = score; best = arm; }
  }
  state.lastArm = best.id;
  saveBandit(agentId, kind, state);
  return { arm: best, exploratory: false };
}

/** Record a task outcome against the arm that produced it (task.input.policyArm
 *  when workers adopt selectPolicy; 'default' otherwise maps to balanced). */
export function recordPolicyReward(agentId: string, kind: string, armId: string | undefined, reward: number) {
  const state = loadBandit(agentId, kind);
  const arm = POLICY_ARMS.find((a) => a.id === armId) ?? POLICY_ARMS[1]; // default → balanced
  const cur = state.arms[arm.id] ?? { pulls: 0, rewardSum: 0 };
  cur.pulls += 1;
  cur.rewardSum += Math.max(0, Math.min(1, reward));
  state.arms[arm.id] = cur;
  saveBandit(agentId, kind, state);
}

export function policyStats(agentId?: string) {
  // Stats are per-agent; without an id we can't enumerate other agents'
  // namespaces cheaply — callers pass agentId or use workspaceStats.
  if (!agentId) return { note: 'pass agentId for per-agent bandit stats' };
  const ns = policyNs(agentId);
  const out: Record<string, BanditState> = {};
  const list = wsList(ns);
  if (list.ok && list.keys) {
    for (const k of list.keys) {
      if (!k.key.startsWith('bandit:')) continue;
      const r = wsRead(ns, k.key);
      if (r.ok) out[k.key] = r.value as BanditState;
    }
  }
  return out;
}

/** Auto-reward off the runtime event stream. Reward: completed=1, failed=0,
 *  cancelled/vetoed ignored, partial (failedSteps>0) ≈ 0.5. */
export function startLearningLayer(runtime: { subscribe(fn: (e: AgentEvent) => void): () => void }) {
  runtime.subscribe((e) => {
    try {
      if (e.type !== 'task.transition') return;
      const t = e.task;
      if (t.status === 'completed') {
        const failedSteps = Number((t.result as any)?.failedSteps ?? 0);
        recordPolicyReward(String(t.agentId), t.kind, String(t.input?.policyArm || ''), failedSteps > 0 ? 0.5 : 1);
      } else if (t.status === 'failed') {
        recordPolicyReward(String(t.agentId), t.kind, String(t.input?.policyArm || ''), 0);
      }
    } catch { /* learning must never break the runtime */ }
  });
}
