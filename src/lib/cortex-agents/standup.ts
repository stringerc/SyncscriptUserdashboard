/**
 * Cortex Autonomous Fleet Standup Protocol & Comparative Benchmark
 * (spec: docs/superpowers/specs/2026-11-18-cortex-fleet-standup-protocol-design.md).
 *
 * Implements:
 * 1. Deterministic host & agent pre-probes (anti-theater).
 * 2. Parallel fan-out standup (Arm A) and curator-triaged standup (Arm B).
 * 3. Morning roll call & evening retrospective persistence and brief hooks.
 * 4. Governed proposal bridge (strategy-proposals.json).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { AgentId } from './types';
import type { AgentRuntime } from './runtime';

export type StandupPhase = 'morning' | 'evening';
export type StandupArm = 'A' | 'B';

export interface AgentCheckIn {
  agentId: string;
  agentName: string;
  timestamp: number;
  phase: StandupPhase;
  status: 'ready' | 'degraded' | 'offline' | 'idle_standby';
  healthNotes?: string;
  dailyBid?: {
    title: string;
    priority: 'high' | 'normal' | 'low';
    rationale: string;
    targetProposalId?: string;
  };
  eveningRetro?: {
    tasksCompleted: number;
    verifiedOutputs: string[];
    blockers: string[];
    tomorrowHandoff?: string;
  };
  latencyMs: number;
}

export interface FleetStandupReport {
  id: string;
  dateKey: string;
  phase: StandupPhase;
  arm: StandupArm;
  timestamp: number;
  totalAgents: number;
  healthyCount: number;
  degradedCount: number;
  offlineCount: number;
  checkIns: Record<string, AgentCheckIn>;
  filedProposals: number;
  wallClockDurationMs: number;
}

export interface ProbeTelemetry {
  status: 'healthy' | 'degraded' | 'offline';
  evidence: string;
}

const RUNTIME_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const STANDUP_DIR = path.join(RUNTIME_DIR, 'standup');

/**
 * Deterministic probe of Hermes local sovereign tool host.
 */
export async function probeHermesDaemon(
  url = 'http://127.0.0.1:18880/health',
  timeoutMs = 800,
): Promise<ProbeTelemetry> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) {
      return {
        status: 'healthy',
        evidence: `Sovereign tool host on ${url} responsive (HTTP ${res.status}).`,
      };
    }
    return {
      status: 'degraded',
      evidence: `Sovereign tool host on ${url} returned HTTP ${res.status}.`,
    };
  } catch (err: any) {
    return {
      status: 'degraded',
      evidence: `Sovereign tool host offline on ${url} (${err?.message || 'connection failed'}). Daemon ready to spawn.`,
    };
  }
}

/**
 * Deterministic probe of external CLI binary presence.
 */
export function probeCliBinary(candidates: string[]): ProbeTelemetry {
  for (const c of candidates) {
    try {
      if (c.startsWith('/') && fs.existsSync(c)) {
        return {
          status: 'healthy',
          evidence: `Binary found at verified path: ${c}`,
        };
      }
      const out = execSync(`which "${c}" 2>/dev/null`, { timeout: 1000 }).toString().trim();
      if (out) {
        return {
          status: 'healthy',
          evidence: `Binary found via PATH at: ${out}`,
        };
      }
    } catch { }
  }
  return {
    status: 'degraded',
    evidence: `Binary not found across candidates: ${candidates.join(', ')}`,
  };
}

/**
 * Deterministic probe of in-process AgentRuntime worker handler registration.
 */
export function probeAgentWorker(runtime: AgentRuntime, agentId: string): ProbeTelemetry {
  const agent = runtime.getAgent(agentId as AgentId);
  const hasHandler = (runtime as any).handlers?.has(agentId);

  if (!agent && !hasHandler) {
    return {
      status: 'degraded',
      evidence: `Agent ${agentId} has no handler and is not registered in runtime.`,
    };
  }

  if (agent && !hasHandler) {
    return {
      status: 'degraded',
      evidence: `Agent ${agentId} spec exists in runtime, but worker handler is unregistered.`,
    };
  }

  const status = agent?.status;
  if (status === 'offline' || status === 'retired') {
    return {
      status: 'offline',
      evidence: `Handler registered · agent state is ${status}`,
    };
  }

  return {
    status: 'healthy',
    evidence: `Handler registered in runtime · agent status: ${status || 'ready'}`,
  };
}
