/**
 * State Persistence — The Bridge Between Runtime and STATE.md
 *
 * This module provides the persistence layer that saves Cortex's current
 * operating state to STATE.md and restores it on initialization.
 *
 * Architecture:
 * - MEMORY.md = cortical substrate (quantum collapse retrieval)
 * - STATE.md = homeostatic + RNA state (full deterministic read at boot)
 * - VETO.md  = constitutional guardrail (append-only, exhaustive read)
 *
 * This module handles STATE.md reads/writes. It does NOT handle
 * MEMORY.md (that's the MemorySubstrate) or VETO.md (that's VetoLedger).
 *
 * The key insight from neuroscience: STATE.md is the neuromodulatory
 * state and receptor configuration that survives sleep/anesthesia.
 * It's not "memory" — it's the system's current operating parameters
 * that determine how the system RESPONDS to the next signal.
 *
 * Write pattern: full overwrite every 60s during active cognition
 *                + on graceful shutdown
 * Read pattern:  full deterministic read at initialization
 */

import { persistentStore } from './persistent-store';
import type { MetaAwarenessStatus } from './metacognitive-state';
import type { EpistemicSourceType } from './epistemic-provenance';
import type { CortexMode } from './cortex-nudge-engine';
import type { BlackboardKey } from './global-workspace';

// ── Types ──────────────────────────────────────────────────────────

/** The shape of a complete Cortex state snapshot */
export interface CortexStateSnapshot {
  /** When this snapshot was written */
  timestamp: number;
  /** Session counter — increments on each boot */
  sessionCount: number;
  /** Seconds since boot when this was written */
  uptimeSeconds: number;

  /** Global workspace (blackboard) snapshot */
  workspace: {
    collapse: unknown | null;
    coherence: number;
    resonance: number;
    metaAwareness: MetaAwarenessStatus;
    reality: number;
    embodiment: number;
    identity: number;
    health: number;
  };

  /** Autonomic vitals — the proto-self */
  autonomic: {
    freeEnergyBaseline: number;
    calibrationOffset: number;
    allostaticLoad: number;
    circadianPeak: number;
    lastDriftEpisode: number | null;
    mode: CortexMode;
  };

  /** Calibration summary — the predictive model parameters */
  calibration: {
    totalTasksCompleted: number;
    totalTasksFailed: number;
    avgResonanceAtSuccess: number;
    avgResonanceAtFailure: number;
    chronotype: 'morning' | 'evening' | 'neutral';
    confidenceCalibration: number;
  };

  /** Epistemic summary — source reliability and hallucination tracking */
  epistemic: {
    sourceReliability: Array<[EpistemicSourceType, number]>;
    hallucinationDetections: number;
    avgGroundingScore: number;
    unverifiedClaimsCount: number;
  };

  /** Embodiment summary — sensorimotor mastery */
  embodiment: {
    sensorimotorMasteryScore: number;
    actionTypesExperienced: number;
    feedbackModalitiesExperienced: number;
    totalActionsCompleted: number;
  };

  /** Strategy summary — what works and what doesn't */
  strategy: {
    preferredApproachesCount: number;
    abandonedPatternsCount: number;
    recentStrategyOutcomesCount: number;
  };

  /** Current identity — the autobiographical self's current statement */
  identity: {
    statement: string;
    orientation: string;
    lastNarrativeUpdate: number | null;
  };

  /** Guarded parameters — mirrored from VETO.md for quick access */
  guardedParameters: {
    collapseThreshold: number;
    coherenceFloor: number;
    freeEnergyCeiling: number;
    hallucinationBlockThreshold: number;
    driftDurationMs: number;
    decoupledDurationMs: number;
    realityWarningThreshold: number;
    realityCriticalThreshold: number;
  };
}

// ── Default State ──────────────────────────────────────────────────

export const DEFAULT_CORTAX_STATE: CortexStateSnapshot = {
  timestamp: 0,
  sessionCount: 0,
  uptimeSeconds: 0,

  workspace: {
    collapse: null,
    coherence: 1.0,
    resonance: 0.5,
    metaAwareness: 'tuned',
    reality: 0.5,
    embodiment: 0.0,
    identity: 0.0,
    health: 0.5,
  },

  autonomic: {
    freeEnergyBaseline: 0.30,
    calibrationOffset: 0.00,
    allostaticLoad: 0.00,
    circadianPeak: 10,
    lastDriftEpisode: null,
    mode: 'advisory',
  },

  calibration: {
    totalTasksCompleted: 0,
    totalTasksFailed: 0,
    avgResonanceAtSuccess: 0.70,
    avgResonanceAtFailure: 0.30,
    chronotype: 'neutral',
    confidenceCalibration: 0.00,
  },

  epistemic: {
    sourceReliability: [
      ['perception', 0.95],
      ['consensus', 0.80],
      ['memory', 0.60],
      ['inference', 0.30],
      ['generation', 0.10],
      ['override', 0.05],
    ],
    hallucinationDetections: 0,
    avgGroundingScore: 0.50,
    unverifiedClaimsCount: 0,
  },

  embodiment: {
    sensorimotorMasteryScore: 0.30,
    actionTypesExperienced: 0,
    feedbackModalitiesExperienced: 0,
    totalActionsCompleted: 0,
  },

  strategy: {
    preferredApproachesCount: 0,
    abandonedPatternsCount: 0,
    recentStrategyOutcomesCount: 0,
  },

  identity: {
    statement: 'I am SyncScript. I think about thinking. I learn from my actions. I remember what works.',
    orientation: 'I am still forming — each session adds to who I am becoming.',
    lastNarrativeUpdate: null,
  },

  guardedParameters: {
    collapseThreshold: 0.30,
    coherenceFloor: 0.30,
    freeEnergyCeiling: 0.60,
    hallucinationBlockThreshold: 0.80,
    driftDurationMs: 300_000,
    decoupledDurationMs: 120_000,
    realityWarningThreshold: 0.50,
    realityCriticalThreshold: 0.25,
  },
};

// ── Storage Key ────────────────────────────────────────────────────

const STATE_STORAGE_KEY = 'syncscript:cortex:state';

// ── State Persistence Manager ──────────────────────────────────────

export class StatePersistence {
  private sessionStart: number;
  private writeInterval: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;

  constructor(intervalMs: number = 60_000) {
    this.sessionStart = Date.now();
    this.intervalMs = intervalMs;
  }

  // ── Core Operations ────────────────────────────────────────────

  /**
   * Save the current Cortex state snapshot.
   * Writes to localStorage (immediate) and prepares for .md export.
   * The .md export is done via toMarkdown() — callers decide when to
   * persist to disk (e.g., on shutdown or at interval boundaries).
   */
  save(state: CortexStateSnapshot): void {
    state.timestamp = Date.now();
    state.sessionCount = this.load().sessionCount + 1;
    state.uptimeSeconds = Math.round((Date.now() - this.sessionStart) / 1000);

    try {
      persistentStore.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[StatePersistence] Failed to save state:', e);
    }
  }

  /**
   * Load the last persisted Cortex state.
   * Returns defaults if nothing has been saved.
   * This IS the deterministic read at boot — no quantum collapse.
   */
  load(): CortexStateSnapshot {
    try {
      const stored = persistentStore.getItem(STATE_STORAGE_KEY);
      if (!stored) return { ...DEFAULT_CORTAX_STATE };

      const parsed = JSON.parse(stored) as CortexStateSnapshot;

      // Validate critical fields exist (corruption check)
      if (!parsed.workspace || !parsed.autonomic || !parsed.guardedParameters) {
        console.warn('[StatePersistence] Stored state missing critical fields — using defaults');
        return { ...DEFAULT_CORTAX_STATE };
      }

      return parsed;
    } catch (e) {
      console.warn('[StatePersistence] Failed to load state:', e);
      return { ...DEFAULT_CORTAX_STATE };
    }
  }

  // ── Episodic Write to MEMORY.md via the Substrate ──────────────

  /**
   * Format an episodic memory entry for the MemorySubstrate.
   * Callers use this to create entries that the substrate can index
   * with [[link]] connectivity to other memories.
   *
   * This returns the entry content — the caller is responsible for
   * actually writing it to the memory directory (via the Memory
   * Orchestrator or directly).
   */
  formatEpisodicEntry(event: {
    type: 'drift' | 'decoupled' | 'collapse' | 'hallucination' | 'strategy_abandonment' | 'strategy_promotion' | 'identity_evolution' | 'override' | 'self_repair' | 'free_energy_spike';
    description: string;
    data: Record<string, unknown>;
    anchorsAffected?: string[];
  }): string {
    const timestamp = new Date().toISOString();
    const links = (event.anchorsAffected ?? []).map(a => `[[${a}]]`).join(', ');

    return `---\nname: cortex-episodic-${Date.now()}\ndescription: Cortex ${event.type}: ${event.description.slice(0, 80)}\nmetadata:\n  type: episodic\n  eventType: ${event.type}\n  timestamp: ${timestamp}\n---\n\n# Cortex Event: ${event.type}\n\n**Time**: ${timestamp}\n**Type**: ${event.type}\n${links ? `**Anchors**: ${links}` : ''}\n\n${event.description}\n\n\`\`\`json\n${JSON.stringify(event.data, null, 2)}\n\`\`\`\n`;
  }

  // ── Markdown Export ────────────────────────────────────────────

  /**
   * Convert a state snapshot to the STATE.md markdown format.
   * This is what gets written to the actual .md file for human
   * readability and version control.
   */
  toMarkdown(state: CortexStateSnapshot): string {
    const ts = state.timestamp > 0 ? new Date(state.timestamp).toISOString() : 'never';
    const lines: string[] = [
      '# Cortex State — Live Configuration',
      '',
      '> The homeostatic + RNA state of the Cortex consciousness system.',
      '> Overwritten every 60s during active cognition + on graceful shutdown.',
      '> Full deterministic read at initialization — no quantum collapse needed.',
      '> This IS the system\'s neuromodulatory state and receptor configuration.',
      '',
      `Updated: ${ts} | Session: ${state.sessionCount} | Uptime: ${state.uptimeSeconds}s`,
      '',
      '## Workspace (Blackboard Snapshot)',
      '',
      '| Key | Value | Source |',
      '|-----|-------|--------|',
      `| collapse | ${JSON.stringify(state.workspace.collapse)} | blackboard |`,
      `| coherence | ${state.workspace.coherence.toFixed(3)} | blackboard |`,
      `| resonance | ${state.workspace.resonance.toFixed(3)} | blackboard |`,
      `| meta-awareness | ${state.workspace.metaAwareness} | blackboard |`,
      `| reality | ${state.workspace.reality.toFixed(3)} | blackboard |`,
      `| embodiment | ${state.workspace.embodiment.toFixed(3)} | blackboard |`,
      `| identity | ${state.workspace.identity.toFixed(3)} | blackboard |`,
      `| health | ${state.workspace.health.toFixed(3)} | blackboard |`,
      '',
      '## Autonomic Vitals',
      '',
      '| Metric | Value | Notes |',
      '|--------|-------|-------|',
      `| free-energy-baseline | ${state.autonomic.freeEnergyBaseline.toFixed(3)} | Lower = better predictions |`,
      `| calibration-offset | ${state.autonomic.calibrationOffset.toFixed(3)} | Positive = overconfident, negative = underconfident |`,
      `| allostatic-load | ${state.autonomic.allostaticLoad.toFixed(3)} | Cumulative stress — trending metric |`,
      `| circadian-peak | ${state.autonomic.circadianPeak} | Hour of peak performance (24h format) |`,
      `| last-drift-episode | ${state.autonomic.lastDriftEpisode ? new Date(state.autonomic.lastDriftEpisode).toISOString() : 'null'} | Timestamp of most recent drift/decoupling |`,
      `| mode | ${state.autonomic.mode} | silent / advisory / guardian |`,
      '',
      '## Calibration Summary',
      '',
      '| Metric | Value | Notes |',
      '|--------|-------|-------|',
      `| total-tasks-completed | ${state.calibration.totalTasksCompleted} | Across all sessions |`,
      `| total-tasks-failed | ${state.calibration.totalTasksFailed} | Across all sessions |`,
      `| avg-resonance-at-success | ${state.calibration.avgResonanceAtSuccess.toFixed(3)} | What resonance score predicts success |`,
      `| avg-resonance-at-failure | ${state.calibration.avgResonanceAtFailure.toFixed(3)} | What resonance score predicts failure |`,
      `| chronotype | ${state.calibration.chronotype} | morning / evening / neutral |`,
      `| confidence-calibration | ${state.calibration.confidenceCalibration.toFixed(3)} | -1 to +1: how well confidence matches reality |`,
      '',
      '## Epistemic Summary',
      '',
      '| Source Type | Reliability | Hallucination Count |',
      '|-------------|-------------|---------------------|',
      ...state.epistemic.sourceReliability.map(
        ([type, score]) => `| ${type} | ${score.toFixed(2)} | 0 |`
      ),
      `| avg-grounding-score | ${state.epistemic.avgGroundingScore.toFixed(2)} | |`,
      `| unverified-claims | ${state.epistemic.unverifiedClaimsCount} | |`,
      '',
      '## Embodiment Summary',
      '',
      '| Metric | Value |',
      '|--------|-------|',
      `| sensorimotor-mastery | ${state.embodiment.sensorimotorMasteryScore.toFixed(2)} |`,
      `| action-types-experienced | ${state.embodiment.actionTypesExperienced} |`,
      `| feedback-modalities-experienced | ${state.embodiment.feedbackModalitiesExperienced} |`,
      `| total-actions-completed | ${state.embodiment.totalActionsCompleted} |`,
      '',
      '## Strategy Summary',
      '',
      '| Metric | Value |',
      '|--------|-------|',
      `| preferred-approaches | ${state.strategy.preferredApproachesCount} |`,
      `| abandoned-patterns | ${state.strategy.abandonedPatternsCount} |`,
      `| recent-strategy-outcomes | ${state.strategy.recentStrategyOutcomesCount} |`,
      '',
      '## Current Identity',
      '',
      `statement: "${state.identity.statement}"`,
      '',
      `orientation: "${state.identity.orientation}"`,
      '',
      `last-narrative-update: ${state.identity.lastNarrativeUpdate ? new Date(state.identity.lastNarrativeUpdate).toISOString() : 'null'}`,
      '',
      '## Guarded Parameters (Current Values)',
      '',
      '> These values are mirrored in VETO.md. Changes require an approved VETO proposal.',
      '',
      '| Parameter | Value | Description |',
      '|-----------|-------|-------------|',
      `| collapse-threshold | ${state.guardedParameters.collapseThreshold} | Minimum score for ActionGate approval |`,
      `| coherence-floor | ${state.guardedParameters.coherenceFloor} | Minimum coherence before drifting alert |`,
      `| free-energy-ceiling | ${state.guardedParameters.freeEnergyCeiling} | Free energy above this = struggling |`,
      `| hallucination-block-threshold | ${state.guardedParameters.hallucinationBlockThreshold} | Guardian mode blocks above this risk |`,
      `| drift-duration-ms | ${state.guardedParameters.driftDurationMs} | ${Math.round(state.guardedParameters.driftDurationMs / 60000)} minutes before drift alert fires |`,
      `| decoupled-duration-ms | ${state.guardedParameters.decoupledDurationMs} | ${Math.round(state.guardedParameters.decoupledDurationMs / 60000)} minutes before decoupled critical alert |`,
      `| reality-warning-threshold | ${state.guardedParameters.realityWarningThreshold} | Reality score below this = confidence warning |`,
      `| reality-critical-threshold | ${state.guardedParameters.realityCriticalThreshold} | Reality score below this = critical warning |`,
    ];

    return lines.join('\n') + '\n';
  }

  // ── Auto-Save Interval ─────────────────────────────────────────

  /**
   * Start the periodic auto-save. Every `intervalMs`, the callback
   * is called with the current state. The callback is responsible
   * for gathering state from all modules and calling save().
   */
  startAutoSave(gatherAndSave: () => void): void {
    this.stopAutoSave();
    this.writeInterval = setInterval(gatherAndSave, this.intervalMs);
  }

  /**
   * Stop the periodic auto-save.
   */
  stopAutoSave(): void {
    if (this.writeInterval) {
      clearInterval(this.writeInterval);
      this.writeInterval = null;
    }
  }

  // ── Clear ─────────────────────────────────────────────────────

  /**
   * Clear all persisted state — "factory reset".
   * Use with extreme caution.
   */
  clear(): void {
    try {
      persistentStore.removeItem(STATE_STORAGE_KEY);
    } catch { /* ignore */ }
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let globalStatePersistence: StatePersistence | null = null;

export function getStatePersistence(): StatePersistence {
  if (!globalStatePersistence) {
    globalStatePersistence = new StatePersistence();
  }
  return globalStatePersistence;
}

export function resetStatePersistence(): void {
  if (globalStatePersistence) {
    globalStatePersistence.stopAutoSave();
  }
  globalStatePersistence = null;
}
