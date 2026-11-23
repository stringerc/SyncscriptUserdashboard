/**
 * ambient-actions.ts — closes the loop between host telemetry and governed
 * action. Push events (world-state diffs, process watch, memory pressure)
 * used to only NARRATE: she felt the host change but nothing acted on it.
 * This module gives each event class a deterministic response:
 *
 *   1. Initiative proposals — injected straight into the server-side
 *      ledger (source: 'ambient-event'), then drainSafePending() approves
 *      every safe-auto one. The client engine's existing pickup loop
 *      (/initiative/ledger/approved → acceptProposal → execTool →
 *      /executed) runs them with the volition governor in the path.
 *      Non-safe proposals stay pending for the Crew — governed autonomy,
 *      not a free-for-all.
 *
 *   2. Sidecar reconciliation — lazy fleet sidecars are dark BY DESIGN,
 *      but one we spawned that then crashed is a different thing: it was
 *      expected up. The reconciler spots spawned→dead transitions and
 *      relaunches via ensureSidecar, narrating the resurrection.
 *
 * Dedupe/cooldowns live in the callers (wsPush/process-watch already
 * rate-limit event emission); the ledger additionally dedupes pending
 * proposals by dedupeKey so a flapping condition can't flood the Inbox.
 */

import {
  syncProposals as ledgerSyncProposals,
  drainSafePending as ledgerDrainSafe,
} from '../cortex-initiative-ledger';
import { sidecarStatus, ensureSidecar } from './sidecars';

export interface AmbientActionSpec {
  /** Stable per-event-kind key — ledger dedupes pending proposals on it. */
  dedupeKey: string;
  title: string;
  description: string;
  category?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  suggestedTool: string;
  suggestedArgs?: Record<string, unknown>;
}

export interface AmbientReaction {
  proposed: boolean;
  approved: string[];
}

/**
 * Inject an ambient-sourced proposal into the initiative ledger and
 * auto-approve whatever the safety gate allows. Returns what happened so
 * callers can narrate honestly ("queued for the Crew" vs "already running").
 */
export function proposeAmbientAction(spec: AmbientActionSpec): AmbientReaction {
  try {
    const res = ledgerSyncProposals([{
      id: spec.dedupeKey,
      title: spec.title,
      description: spec.description,
      category: spec.category || 'system_resonance',
      urgency: spec.urgency || 'medium',
      confidence: 0.7,
      rationale: 'raised autonomously by the ambient host-event bridge',
      suggestedTool: spec.suggestedTool,
      suggestedArgs: spec.suggestedArgs,
      requiresApproval: false,
      autonomyTier: 1,
      source: 'ambient-event',
      dedupeKey: spec.dedupeKey,
      createdAtMs: Date.now(),
    }]);
    const drained = ledgerDrainSafe('ambient:bridge');
    const approved = drained.approved
      .filter((p) => p.id === spec.dedupeKey || p.source === 'ambient-event')
      .map((p) => p.id);
    return { proposed: res.upserted > 0, approved };
  } catch {
    return { proposed: false, approved: [] };
  }
}

/**
 * Event-kind → action mapping. Only tools that genuinely execute AND sit
 * inside SAFE_AUTO_TOOLS are used for auto-approved work; anything that
 * needs bigger authority (fleet tasking, spawn decisions) is proposed at
 * tier-2/requiresApproval so it waits for the Crew instead of pretending.
 */
export function ambientReact(kind: string, detail: Record<string, unknown> = {}): AmbientReaction {
  const text = String(detail.text || '');
  switch (kind) {
    case 'memjump':
      return proposeAmbientAction({
        dedupeKey: 'ambient:memjump',
        title: 'Memory jumped between samples',
        description: `World-state telemetry saw a sharp memory swing. Verify host vitals and identify the consumer. ${text}`,
        urgency: 'medium',
        suggestedTool: 'system_info',
        suggestedArgs: {},
      });
    case 'load':
      return proposeAmbientAction({
        dedupeKey: 'ambient:load',
        title: 'Host load spiked',
        description: `Load average crossed the spike threshold. Identify what is consuming CPU before it cascades. ${text}`,
        urgency: 'medium',
        suggestedTool: 'system_info',
        suggestedArgs: {},
      });
    case 'repoBurst':
      return proposeAmbientAction({
        dedupeKey: 'ambient:repoBurst',
        title: 'Heavy repo edit burst detected',
        description: `Many source files changed within a minute — a large change is landing. Record it in episodic memory so future turns know the working tree just shifted. ${text}`,
        urgency: 'low',
        suggestedTool: 'cortex_memory',
        suggestedArgs: {
          action: 'save_episodic',
          content: JSON.stringify({ ts: new Date().toISOString(), kind: 'host_event', event: 'repo_edit_burst', detail: text.slice(0, 400) }),
        },
      });
    case 'branch':
      return proposeAmbientAction({
        dedupeKey: 'ambient:branch',
        title: 'Repo branch switched',
        description: `The working tree moved to a different branch mid-session. Record the transition in episodic memory. ${text}`,
        urgency: 'low',
        suggestedTool: 'cortex_memory',
        suggestedArgs: {
          action: 'save_episodic',
          content: JSON.stringify({ ts: new Date().toISOString(), kind: 'host_event', event: 'branch_switch', detail: text.slice(0, 400) }),
        },
      });
    case 'oracle':
      // Oracle death affects the cloud fleet — bigger authority than a
      // local read, so it waits for the Crew rather than auto-running.
      return proposeAmbientAction({
        dedupeKey: 'ambient:oracle',
        title: 'Oracle runtime unreachable',
        description: `The cloud-side runtime stopped responding — cloud agents and the Oracle Cortex instance may be stalled. A fleet status check is queued. ${text}`,
        urgency: 'high',
        suggestedTool: 'cortex_agents',
        suggestedArgs: { action: 'status' },
      });
    case 'agents':
      return proposeAmbientAction({
        dedupeKey: 'ambient:agents',
        title: 'Agent fleet dropped',
        description: `Multiple agents went inactive between checks. Fleet status check queued. ${text}`,
        urgency: 'medium',
        suggestedTool: 'cortex_agents',
        suggestedArgs: { action: 'status' },
      });
    case 'procwatch': {
      const cluster = /exited together/i.test(text);
      return proposeAmbientAction({
        dedupeKey: `ambient:procwatch:${cluster ? 'cluster' : 'batch'}`,
        title: cluster ? 'Process cluster died' : 'Significant process events',
        description: `Process watcher observed host-level changes. Correlate with vitals to see if memory or CPU pressure caused them. ${text}`,
        urgency: cluster ? 'high' : 'medium',
        suggestedTool: 'system_info',
        suggestedArgs: {},
      });
    }
    case 'mempressure':
      return proposeAmbientAction({
        dedupeKey: 'ambient:mempressure',
        title: 'Host memory pressure event',
        description: `Memory pressure governor fired after sweeping idle sidecars. Verify the host recovered headroom. ${text}`,
        urgency: 'high',
        suggestedTool: 'system_info',
        suggestedArgs: {},
      });
    default:
      return { proposed: false, approved: [] };
  }
}

/**
 * Sidecar crash reconciler. Lazy sidecars are dark by design — but one
 * THIS manager spawned (spawnCount>0) that is now dead AND was used
 * recently (inside the idle-reap window, so it wasn't intentionally
 * reaped) crashed while expected up. Relaunch it in the background and
 * let the caller narrate.
 *
 * globalThis-guarded: vite.config re-evaluates on restart; the interval
 * must exist exactly once per process.
 */
export function startSidecarReconciler(onRevive?: (name: string) => void): void {
  const g = globalThis as any;
  if (g.__cortexSidecarReconciler) return;
  const IDLE_REAP_MS = 30 * 60 * 1000;
  const RECENT_MS = IDLE_REAP_MS + 5 * 60 * 1000; // grace past reap window
  const timer = setInterval(() => {
    void (async () => {
      try {
        const status = sidecarStatus();
        for (const [name, s] of Object.entries(status) as any) {
          if (!s?.spawnCount || s.spawned) continue;
          const idle = Date.now() - (s.lastUsedAt || 0);
          if (idle > RECENT_MS) continue; // legitimately asleep — leave dark
          const before = s.spawnCount;
          await ensureSidecar(name, 0);
          const after = sidecarStatus()[name]?.spawnCount || 0;
          if (after > before) onRevive?.(name);
        }
      } catch {}
    })();
  }, 60_000);
  (timer as any).unref?.();
  g.__cortexSidecarReconciler = timer;
}
