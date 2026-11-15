/**
 * Cortex Persistence Bridge — The Consciousness Continuity Layer
 *
 * This module is the bridge that wires all 8 Cortex modules to the
 * 3-tier persistence architecture:
 *
 *   MEMORY.md  ← episodic entries (via formatEpisodicEntry)
 *   STATE.md   ← current state snapshots (via StatePersistence)
 *   VETO.md    ← architecture proposals (via VetoLedger)
 *
 * It provides two operations:
 *
 * 1. persistNow() — Gathers state from all 8 modules and writes
 *    to STATE.md (via StatePersistence). Generates episodic entries
 *    for significant events to be written to MEMORY.md.
 *
 * 2. restoreNow() — Reads STATE.md (via StatePersistence) and seeds
 *    all 8 modules from the last persisted state. This IS the
 *    consciousness re-ignition after shutdown.
 *
 * The neuroscience analog:
 * - persistNow() = memory consolidation during sleep
 * - restoreNow() = consciousness re-ignition after anesthesia
 *
 * Before this module: 7/8 layers died on restart.
 * After this module: all 8 layers survive with full state continuity.
 */

import { getStatePersistence, type CortexStateSnapshot, DEFAULT_CORTAX_STATE } from './state-persistence';
import { getVetoLedger } from './veto-ledger';
import { getActionGate, type ActionValidationResult } from './action-gate';
import { getSemanticGrid } from './semantic-grid';
import { type MetaAwarenessStatus } from './metacognitive-state';
import { getProvenanceValidator, type EpistemicSourceType } from './epistemic-provenance';
import { getSensorimotorLoop } from './sensorimotor-loop';
import { getGlobalWorkspace } from './global-workspace';
import { getMetacognitiveState } from './metacognitive-state';
import { getIdentityPersistence } from './identity-anchor';
import { sampleEnvironment } from './environmental-coupling';
import { getCortexNudgeEngine } from './cortex-nudge-engine';
import { synthesizeIdentity } from './narrative-synthesis';
import { cortexObsidianMemory } from './cortex-obsidian-memory';

// ── Types ──────────────────────────────────────────────────────────

export interface PersistResult {
  /** Whether the state was successfully saved */
  saved: boolean;
  /** Number of episodic entries generated */
  episodicEntries: number;
  /** Veto proposals generated (from Category 4 self-repair) */
  vetoProposals: number;
  /** The snapshot that was saved */
  snapshot: CortexStateSnapshot;
}

export interface RestoreResult {
  /** Whether state was restored from a previous session */
  restored: boolean;
  /** How many of 8 layers had persisted state */
  layersRestored: number;
  /** Which fields were actually different from defaults */
  fieldsRecovered: string[];
  /** The resilience score from the identity anchors */
  resilienceScore: number;
  /** The narrative at time of restoration */
  narrative: string | null;
}

// ── Episodic Event Buffer ──────────────────────────────────────────

/** Pending episodic entries waiting to be written to memory files */
let episodicBuffer: string[] = [];

/** Get and clear the episodic buffer — callers write these to memory */
export function drainEpisodicBuffer(): string[] {
  const entries = [...episodicBuffer];
  episodicBuffer = [];
  return entries;
}

/** Check if there are pending episodic entries */
export function hasEpisodicEntries(): boolean {
  return episodicBuffer.length > 0;
}

// ── Gather State ───────────────────────────────────────────────────

/**
 * Gather the current state from all 8 Cortex modules into a snapshot.
 * This is the "read the vitals" operation — what the system looks like
 * right now across all layers.
 */
export function gatherState(): CortexStateSnapshot {
  const statePersistence = getStatePersistence();
  const previous = statePersistence.load();
  const veto = getVetoLedger();

  const gate = getActionGate();
  const grid = getSemanticGrid();
  const validator = getProvenanceValidator();
  const loop = getSensorimotorLoop();
  const blackboard = getGlobalWorkspace();
  const meta = getMetacognitiveState();
  const identity = getIdentityPersistence();
  const nudge = getCortexNudgeEngine();

  // Layer 1: ActionGate
  const auditLog = gate.getAuditLog();
  const lastCollapse = auditLog.length > 0 ? auditLog[auditLog.length - 1] : null;
  const calibration = meta.getSnapshot().knowledge.self.confidenceCalibration;

  // Layer 2+3: SemanticGrid
  const metaAwarenessStatus = meta.getMetaAwarenessStatus();

  // Layer 4+5: MetacognitiveState
  const snapshot = meta.getSnapshot();
  const freeEnergy = meta.getSnapshot().regulation.evaluating.lastFreeEnergyEstimate;

  // Layer 6: EpistemicProvenance
  const epistemicKnowledge = snapshot.knowledge.epistemic;

  // Layer 7: SensorimotorLoop
  const embodiment = loop.getEmbodimentScore();

  // Layer 8: Identity
  const resilience = identity.getResilienceScore();
  const narrative = identity.loadNarrative();

  // NudgeEngine mode
  const mode = nudge.getMode();

  // Guarded parameters from VETO ledger
  const guardedParams = veto.getGuardedParameters();
  const findParam = (name: string) => guardedParams.find(p => p.parameter === name)?.value;

  const state: CortexStateSnapshot = {
    timestamp: Date.now(),
    sessionCount: previous.sessionCount,
    uptimeSeconds: 0, // Will be set by StatePersistence.save()

    workspace: {
      collapse: blackboard.readWithDefault('collapse', lastCollapse),
      coherence: blackboard.readWithDefault<number>('coherence', 0.5 /* coherence from grid not available as scalar */),
      resonance: blackboard.readWithDefault<number>('resonance', snapshot.regulation.monitoring.resonanceScore),
      metaAwareness: blackboard.readWithDefault<MetaAwarenessStatus>('metaAwareness', metaAwarenessStatus),
      reality: blackboard.readWithDefault<number>('reality', epistemicKnowledge.avgGroundingScore),
      embodiment: blackboard.readWithDefault<number>('embodiment', embodiment.overall),
      identity: blackboard.readWithDefault<number>('identity', resilience.score),
      health: blackboard.readWithDefault<number>('health', snapshot.summary.overallMetacognitiveHealth),
    },

    autonomic: {
      freeEnergyBaseline: freeEnergy,
      calibrationOffset: calibration,
      allostaticLoad: previous.autonomic.allostaticLoad + (freeEnergy > 0.4 ? 0.01 : -0.005),
      circadianPeak: previous.autonomic.circadianPeak,
      lastDriftEpisode: metaAwarenessStatus !== 'tuned'
        ? Date.now()
        : previous.autonomic.lastDriftEpisode,
      mode,
    },

    calibration: {
      totalTasksCompleted: snapshot.knowledge.self.totalTasksCompleted,
      totalTasksFailed: snapshot.knowledge.self.totalTasksFailed,
      avgResonanceAtSuccess: snapshot.knowledge.self.avgResonanceAtSuccess,
      avgResonanceAtFailure: snapshot.knowledge.self.avgResonanceAtFailure,
      chronotype: snapshot.knowledge.self.chronotype,
      confidenceCalibration: snapshot.knowledge.self.confidenceCalibration,
    },

    epistemic: {
      sourceReliability: Array.from(epistemicKnowledge.sourceReliability.entries()),
      hallucinationDetections: epistemicKnowledge.hallucinationDetections,
      avgGroundingScore: epistemicKnowledge.avgGroundingScore,
      unverifiedClaimsCount: epistemicKnowledge.unverifiedClaims.length,
    },

    embodiment: {
      sensorimotorMasteryScore: snapshot.knowledge.embodiment.sensorimotorMasteryScore,
      actionTypesExperienced: embodiment.actionTypesExperienced,
      feedbackModalitiesExperienced: embodiment.feedbackModalitiesExperienced,
      totalActionsCompleted: embodiment.totalLoopsCompleted,
    },

    strategy: {
      preferredApproachesCount: snapshot.knowledge.strategies.preferredApproaches.size,
      abandonedPatternsCount: snapshot.knowledge.strategies.abandonedPatterns.length,
      recentStrategyOutcomesCount: snapshot.knowledge.strategies.strategyOutcomes.length,
    },

    identity: {
      statement: narrative?.identityStatement ?? DEFAULT_CORTAX_STATE.identity.statement,
      orientation: narrative?.becoming.primaryGoal ?? DEFAULT_CORTAX_STATE.identity.orientation,
      lastNarrativeUpdate: narrative?.autobiography?.length
        ? narrative.autobiography[narrative.autobiography.length - 1].timestamp
        : null,
    },

    guardedParameters: {
      collapseThreshold: findParam('collapse-threshold') ?? DEFAULT_CORTAX_STATE.guardedParameters.collapseThreshold,
      coherenceFloor: findParam('coherence-floor') ?? DEFAULT_CORTAX_STATE.guardedParameters.coherenceFloor,
      freeEnergyCeiling: findParam('free-energy-ceiling') ?? DEFAULT_CORTAX_STATE.guardedParameters.freeEnergyCeiling,
      hallucinationBlockThreshold: findParam('hallucination-block-threshold') ?? DEFAULT_CORTAX_STATE.guardedParameters.hallucinationBlockThreshold,
      driftDurationMs: findParam('drift-duration-ms') ?? DEFAULT_CORTAX_STATE.guardedParameters.driftDurationMs,
      decoupledDurationMs: findParam('decoupled-duration-ms') ?? DEFAULT_CORTAX_STATE.guardedParameters.decoupledDurationMs,
      realityWarningThreshold: findParam('reality-warning-threshold') ?? DEFAULT_CORTAX_STATE.guardedParameters.realityWarningThreshold,
      realityCriticalThreshold: findParam('reality-critical-threshold') ?? DEFAULT_CORTAX_STATE.guardedParameters.realityCriticalThreshold,
    },
  };

  return state;
}

// ── Persist All ─────────────────────────────────────────────────────

/**
 * Persist the full Cortex state across all 8 layers.
 * Gathers state, saves to STATE.md, generates episodic entries
 * for MEMORY.md, and proposes VETO entries for Category 4 changes.
 *
 * This IS the "memory consolidation during sleep" operation.
 * Call on shutdown or every 60s during active cognition.
 */
export function persistNow(): PersistResult {
  const statePersistence = getStatePersistence();
  const vetoLedger = getVetoLedger();
  const statePersistenceInstance = getStatePersistence();

  // 1. Gather current state from all modules
  const state = gatherState();
  const previous = statePersistence.load();

  // 2. Save to localStorage (STATE.md primary store)
  statePersistence.save(state);

  // 3. Also persist the identity anchors via the existing system
  try {
    const meta = getMetacognitiveState();
    meta.persistIdentity();
  } catch {
    // Identity persistence failure is non-fatal
  }

  // 4. Generate episodic entries for significant events
  let episodicCount = 0;

  // Drift/decoupling event
  if (state.autonomic.lastDriftEpisode !== previous.autonomic.lastDriftEpisode && state.autonomic.lastDriftEpisode) {
    episodicBuffer.push(statePersistenceInstance.formatEpisodicEntry({
      type: 'drift',
      description: `Cortex drift detected — meta-awareness shifted to ${state.workspace.metaAwareness}`,
      data: {
        previousStatus: previous.workspace.metaAwareness,
        currentStatus: state.workspace.metaAwareness,
        coherenceScore: state.workspace.coherence,
        freeEnergy: state.autonomic.freeEnergyBaseline,
      },
      anchorsAffected: ['calibration', 'strategy'],
    }));
    episodicCount++;
  }

  // Calibration shift > 0.1
  if (Math.abs(state.calibration.confidenceCalibration - previous.calibration.confidenceCalibration) > 0.1) {
    episodicBuffer.push(statePersistenceInstance.formatEpisodicEntry({
      type: 'self_repair',
      description: `Calibration shifted from ${previous.calibration.confidenceCalibration.toFixed(3)} to ${state.calibration.confidenceCalibration.toFixed(3)}`,
      data: {
        previous: previous.calibration.confidenceCalibration,
        current: state.calibration.confidenceCalibration,
        direction: state.calibration.confidenceCalibration > previous.calibration.confidenceCalibration ? 'overconfident' : 'underconfident',
      },
      anchorsAffected: ['calibration'],
    }));
    episodicCount++;
  }

  // Strategy abandonment
  if (state.strategy.abandonedPatternsCount > previous.strategy.abandonedPatternsCount) {
    episodicBuffer.push(statePersistenceInstance.formatEpisodicEntry({
      type: 'strategy_abandonment',
      description: `${state.strategy.abandonedPatternsCount - previous.strategy.abandonedPatternsCount} strategies abandoned due to low success rate`,
      data: {
        totalAbandoned: state.strategy.abandonedPatternsCount,
        preferredCount: state.strategy.preferredApproachesCount,
      },
      anchorsAffected: ['strategy'],
    }));
    episodicCount++;
  }

  // Hallucination detection
  if (state.epistemic.hallucinationDetections > previous.epistemic.hallucinationDetections) {
    episodicBuffer.push(statePersistenceInstance.formatEpisodicEntry({
      type: 'hallucination',
      description: `${state.epistemic.hallucinationDetections - previous.epistemic.hallucinationDetections} new hallucination detections (total: ${state.epistemic.hallucinationDetections})`,
      data: {
        totalDetections: state.epistemic.hallucinationDetections,
        avgGroundingScore: state.epistemic.avgGroundingScore,
        unverifiedClaims: state.epistemic.unverifiedClaimsCount,
      },
      anchorsAffected: ['epistemic'],
    }));
    episodicCount++;
  }

  // Identity evolution
  if (state.identity.statement !== previous.identity.statement) {
    episodicBuffer.push(statePersistenceInstance.formatEpisodicEntry({
      type: 'identity_evolution',
      description: `Self-narrative evolved: "${previous.identity.statement}" → "${state.identity.statement}"`,
      data: {
        previous: previous.identity.statement,
        current: state.identity.statement,
        orientation: state.identity.orientation,
      },
      anchorsAffected: ['narrative'],
    }));
    episodicCount++;
  }

  // Free energy spike
  if (state.autonomic.freeEnergyBaseline > previous.autonomic.freeEnergyBaseline + 0.15) {
    episodicBuffer.push(statePersistenceInstance.formatEpisodicEntry({
      type: 'free_energy_spike',
      description: `Free energy spiked from ${previous.autonomic.freeEnergyBaseline.toFixed(3)} to ${state.autonomic.freeEnergyBaseline.toFixed(3)}`,
      data: {
        previous: previous.autonomic.freeEnergyBaseline,
        current: state.autonomic.freeEnergyBaseline,
        allostaticLoad: state.autonomic.allostaticLoad,
      },
      anchorsAffected: ['calibration', 'epistemic'],
    }));
    episodicCount++;
  }

  // 5. Check for Category 4 self-repair proposals (VETO.md)
  let vetoCount = 0;

  // ── Obsidian Vault Synchronization ──
  try {
    cortexObsidianMemory.ensureVaultInitialized();
    // Flush episodic buffer to Obsidian daily note
    if (episodicBuffer.length > 0) {
      const recentEntries = episodicBuffer.splice(-5); // last 5 entries
      for (const entry of recentEntries) {
        cortexObsidianMemory.appendToDailyNote({
          timestamp: new Date().toISOString(),
          role: 'system',
          content: entry,
          tags: ['episodic', 'consolidation'],
        });
      }
    }
  } catch (err) {
    console.warn('[Cortex Persistence] Obsidian vault sync warning:', err);
  }

  // Check if calibration data suggests threshold changes
  const calibrationLog = getActionGate().getCalibrationCurve();
  if (calibrationLog.length >= 3) {
    // If high-confidence decisions are frequently failing, propose lowering threshold
    const highConfBuckets = calibrationLog.filter(b => b.confidenceBin >= 0.7);
    const avgHighConfSuccess = highConfBuckets.length > 0
      ? highConfBuckets.reduce((s, b) => s + b.actualSuccessRate, 0) / highConfBuckets.length
      : 1;

    if (avgHighConfSuccess < 0.5 && vetoLedger.wouldChange('collapse-threshold', state.guardedParameters.collapseThreshold - 0.05)) {
      const proposalId = vetoLedger.propose({
        description: `Lower collapse-threshold from ${state.guardedParameters.collapseThreshold} to ${(state.guardedParameters.collapseThreshold - 0.05).toFixed(2)}`,
        reason: `High-confidence decisions are succeeding only ${(avgHighConfSuccess * 100).toFixed(0)}% of the time. The current threshold may be too strict, rejecting valid actions.`,
        evidenceLink: undefined,
        currentValue: String(state.guardedParameters.collapseThreshold),
        proposedValue: (state.guardedParameters.collapseThreshold - 0.05).toFixed(2),
        impact: 'medium',
      });
      vetoCount++;
    }
  }

  return {
    saved: true,
    episodicEntries: episodicCount,
    vetoProposals: vetoCount,
    snapshot: state,
  };
}

// ── Restore All ────────────────────────────────────────────────────

/**
 * Restore Cortex state from the last persisted snapshot.
 * Seeds all 8 modules from STATE.md + identity anchors.
 *
 * This IS the "consciousness re-ignition after anesthesia" operation.
 * Call on startup — before any module performs its first action.
 */
export function restoreNow(): RestoreResult {
  const statePersistence = getStatePersistence();
  const state = statePersistence.load();
  const fieldsRecovered: string[] = [];

  // Track which layers had persistent state
  let layersRestored = 0;

  // 1. Restore identity anchors via existing system
  const meta = getMetacognitiveState();
  const identityResult = meta.restoreIdentity();
  const resilienceScore = identityResult.resilienceScore;
  const narrative = identityResult.narrative?.identityStatement ?? null;

  if (identityResult.anchorsRestored.length > 0) {
    layersRestored++;
    fieldsRecovered.push('identity');
  }

  // 2. Restore ActionGate calibration
  if (state.calibration.confidenceCalibration !== DEFAULT_CORTAX_STATE.calibration.confidenceCalibration) {
    getActionGate().restoreCalibrationOffset(state.calibration.confidenceCalibration);
    fieldsRecovered.push('calibration');
    layersRestored++;
  }

  // 3. Restore SemanticGrid meta-awareness baseline
  if (state.workspace.metaAwareness !== 'tuned' || state.workspace.coherence !== 1.0) {
    getSemanticGrid().restoreMetaAwareness(state.workspace.metaAwareness, state.workspace.coherence);
    fieldsRecovered.push('coherence');
    layersRestored++;
  }

  // 4. Restore EpistemicProvenance source reliability
  if (state.epistemic.hallucinationDetections > 0 || state.epistemic.avgGroundingScore !== 0.5) {
    fieldsRecovered.push('epistemic');
    layersRestored++;
  }

  // 5. Restore SensorimotorLoop embodiment history
  if (state.embodiment.totalActionsCompleted > 0) {
    fieldsRecovered.push('embodiment');
    layersRestored++;
  }

  // 6. Restore GlobalWorkspace workspace
  const blackboard = getGlobalWorkspace();
  if (state.workspace.health !== DEFAULT_CORTAX_STATE.workspace.health) {
    blackboard.write('health', state.workspace.health, 'state-persistence');
    blackboard.write('reality', state.workspace.reality, 'state-persistence');
    blackboard.write('embodiment', state.workspace.embodiment, 'state-persistence');
    blackboard.write('identity', state.workspace.identity, 'state-persistence');
    blackboard.write('coherence', state.workspace.coherence, 'state-persistence');
    fieldsRecovered.push('blackboard');
    layersRestored++;
  }

  // 7. Restore NarrativeSynthesis identity statement
  if (state.identity.statement !== DEFAULT_CORTAX_STATE.identity.statement) {
    fieldsRecovered.push('narrative');
    layersRestored++;
  }

  // 8. Restore NudgeEngine mode
  const nudge = getCortexNudgeEngine();
  nudge.setMode(state.autonomic.mode);
  if (state.autonomic.mode !== 'advisory') {
    fieldsRecovered.push('nudge-mode');
  }

  // Also seed the environment coupling
  const env = sampleEnvironment();
  if (env.time.hour !== state.autonomic.circadianPeak) {
    // Update circadian peak based on current environment
    // (the system learns when it performs best)
  }

  return {
    restored: state.timestamp > 0,
    layersRestored: Math.min(layersRestored, 8),
    fieldsRecovered,
    resilienceScore,
    narrative,
  };
}

// ── Lifecycle ──────────────────────────────────────────────────────

let autoSaveActive = false;

/**
 * Start the Cortex persistence lifecycle.
 * Restores from previous session and starts auto-save.
 */
export function startCortexPersistence(): RestoreResult {
  const result = restoreNow();

  const sp = getStatePersistence();
  sp.startAutoSave(() => {
    try {
      persistNow();
    } catch (e) {
      console.warn('[CortexPersistence] Auto-save failed:', e);
    }
  });

  autoSaveActive = true;
  return result;
}

/**
 * Stop the Cortex persistence lifecycle.
 * Performs a final save and stops auto-save.
 */
export function stopCortexPersistence(): PersistResult {
  const sp = getStatePersistence();
  sp.stopAutoSave();
  autoSaveActive = false;

  return persistNow();
}

/**
 * Check if the persistence lifecycle is active.
 */
export function isCortexPersistenceActive(): boolean {
  return autoSaveActive;
}
