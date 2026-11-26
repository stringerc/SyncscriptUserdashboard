/**
 * Cortex SDK — The Trust Layer for AI Agents
 *
 * This is the public-facing SDK that any AI agent can import.
 * It provides a clean API over the 8-layer Cortex engine:
 *
 *   Layer 1: ActionGate — action validation (Action Validation)
 *   Layer 2: SemanticGrid — multi-agent interference (Busemeyer)
 *   Layer 3: MetaAwareness — drift detection (Schooler)
 *   Layer 4: FreeEnergy — prediction error tracking (Friston)
 *   Layer 5: MetacognitiveState — self-knowledge + regulation (Flavell)
 *   Layer 6: EpistemicProvenance — hallucination detection (Johnson & Lindsay)
 *   Layer 7: SensorimotorLoop — action-outcome mastery (O'Regan & Noe)
 *   Layer 8: IdentityAnchor — cross-session persistence (Damasio/Locke)
 *
 * Plus the persistence bridge:
 *   - STATE.md — homeostatic boot state
 *   - VETO.md — constitutional guardrail
 *   - MEMORY.md — quantum microtubule substrate
 *
 * Usage:
 *   import { CortexEngine } from '@cortex/core';
 *   const cortex = new CortexEngine({ mode: 'guardian' });
 *   const result = await cortex.evaluate({ action: 'deploy', ... });
 *   if (!result.approved) { // Cortex blocked it }
 */

// Re-export all layer modules for advanced usage
export { getActionGate, type ActionValidationInput, type ActionValidationResult, type ActionOption } from './action-gate';
export { getSemanticGrid, type AgentSignal, type CollapsedResult } from './semantic-grid';
export { type MetaAwarenessStatus } from './metacognitive-state';
export { getProvenanceValidator, type EpistemicSourceType, type RealityScore, type ProvenanceChain } from './epistemic-provenance';
export { getActionObserver } from './action-observer';
export { getMetacognitiveController } from './metacognitive-controller';
export { getCausalModel } from './causal-model';
export { getGlobalWorkspace, type WorkspaceBroadcast, type IgnitionSignature } from './global-workspace';
export { getHGM } from './hierarchical-generative-model';
export { getIntegratedInformation } from './integrated-information';
export { getAttentionSchema } from './attention-schema';
export { getStructuralEquationModel } from './structural-equation-model';
export {
  getDecisionSpecialist,
  getRealitySpecialist,
  getMonitoringSpecialist,
  getEmbodimentSpecialist,
  getAllSpecialists,
  tickAllSpecialists,
} from './registry';
export { getSensorimotorLoop, type ActionType, type FeedbackModality, type SensorimotorLoopRecord } from './sensorimotor-loop';
export { getCortexNudgeEngine, type CortexNudge, type CortexMode, type NudgeType } from './cortex-nudge-engine';
export { getMetacognitiveState, type MetacognitiveSnapshot } from './metacognitive-state';
export { getIdentityPersistence, type AnchorType, type NarrativeAnchorData } from './identity-anchor';
export { getStatePersistence, type CortexStateSnapshot } from './state-persistence';
export { getVetoLedger, type VetoProposal, type VetoStatus } from './veto-ledger';
export {
  startCortexPersistence,
  stopCortexPersistence,
  persistNow,
  restoreNow,
  gatherState,
  drainEpisodicBuffer,
  type PersistResult,
  type RestoreResult,
} from './cortex-persistence-bridge';

// ── CortexEngine — The Main SDK Class ──────────────────────────────

import { getActionGate, type ActionValidationInput, type ActionValidationResult } from './action-gate';
import { type MetaAwarenessStatus } from './metacognitive-state';
import { getProvenanceValidator, type EpistemicSourceType } from './epistemic-provenance';
import { getSensorimotorLoop, type ActionType, type FeedbackModality } from './sensorimotor-loop';
import { getCortexNudgeEngine, type CortexMode, type CortexNudge } from './cortex-nudge-engine';
import { getMetacognitiveState } from './metacognitive-state';
import { startCortexPersistence, stopCortexPersistence, gatherState, persistNow } from './cortex-persistence-bridge';
import { getVetoLedger } from './veto-ledger';
import { sampleEnvironment, recordApiObservation, updateCircadianModel } from './environmental-coupling';
import { getGlobalWorkspace, type WorkspaceBroadcast } from './global-workspace';
import { getActionObserver } from './action-observer';
import { getMetacognitiveController, type MonitoringJudgment, type ControlDecision } from './metacognitive-controller';
import { getCausalModel } from './causal-model';
import { getHGM } from './hierarchical-generative-model';
import { getIntegratedInformation } from './integrated-information';
import { getAttentionSchema } from './attention-schema';
import { getGenerativeAttentionLoop, peekGenerativeAttentionLoop, getGalInteroceptionSignal, type GalHost, type GalSelfSignal, type GalVetoRequest } from './consciousness/generative-attention';
import { getAttentionVetoAgent } from './consciousness/veto-agent';
import { getAffectiveSystem } from './consciousness/affective-valence';
import { getPersistentSelfModel } from './consciousness/persistent-self-model';
import { getStructuralEquationModel } from './structural-equation-model';
import {
  getDecisionSpecialist,
  getRealitySpecialist,
  getMonitoringSpecialist,
  getEmbodimentSpecialist,
  getAllSpecialists,
  tickAllSpecialists,
} from './registry';
import { patchGlobalFetch, restoreGlobalFetch } from './environmental-interceptors';

// ── Types ──────────────────────────────────────────────────────────

/** Configuration for creating a CortexEngine instance */
export interface CortexEngineConfig {
  /** Operating mode: silent (compute only), advisory (warn), guardian (block) */
  mode?: CortexMode;
  /** Persistence mode: local (localStorage), cloud (API), hybrid (both) */
  persistence?: 'local' | 'cloud' | 'hybrid';
  /** Path to VETO.md constitution file (or pre-built template name) */
  constitution?: string;
  /** Callback when Cortex issues a nudge (Cortana's voice) */
  onNudge?: (nudge: CortexNudge) => void;
  /** Callback when Cortex detects drift */
  onDrift?: (status: MetaAwarenessStatus, durationMs: number) => void;
  /** Callback when Cortex blocks an action in guardian mode */
  onBlock?: (reason: string, hallucinationRisk: number) => void;
  /** Callback when a Category 4 architecture change is proposed */
  onArchitectureProposal?: (proposalId: string, description: string) => void;
  /** Auto-save interval in milliseconds (default: 60000) */
  autoSaveIntervalMs?: number;
  /** Whether to automatically intercept and patch environmental APIs (like fetch) on boot */
  enableEnvironmentalInterceptors?: boolean;
}

/** The result of evaluating an action through Cortex */
export interface CortexEvaluation {
  /** Whether the action is approved */
  approved: boolean;
  /** The collapse score (0-1) — how confident Cortex is */
  score: number;
  /** Why it was approved or rejected */
  reason: string;
  /** Current hallucination risk level (0-1) */
  hallucinationRisk: number;
  /** Current reality/grounding score (0-1) */
  realityScore: number;
  /** Current meta-awareness status */
  awareness: MetaAwarenessStatus;
  /** Whether this was blocked by guardian mode */
  blockedByGuardian: boolean;
  /**
   * Whether metacognitive control refused the action (abort / verify-first /
   * request-help in guardian). Distinct from guardian blocks on risk thresholds.
   */
  metacognitiveBlocked: boolean;
  /** Load-bearing control decision, if one was made. */
  controlDecision: ControlDecision | null;
  /** The collapse result from the gate */
  collapseResult: ActionValidationResult;
  /** Timestamp of this evaluation */
  timestamp: number;
}

/** The input for executing an action through Cortex */
export interface CortexActionExecutionInput extends ActionValidationInput {
  /** The specific action type (e.g., api_call, file_system) */
  actionType: ActionType;
  /** What task context this action belongs to */
  taskType: string;
  /** A human-readable description of the action */
  description: string;
  /** The modality of the expected feedback */
  feedbackModality: FeedbackModality;
  /** The agent's prediction of what will happen */
  prediction: {
    expectedOutcome: 'success' | 'failure' | 'partial';
    expectedConfidence: number;
    expectedSideEffects: string[];
  };
}

/** The result of executing an action through Cortex */
export interface CortexExecutionResult<T> {
  evaluation: CortexEvaluation;
  result?: T;
  error?: Error;
}

/** The current status of the Cortex engine */
export interface CortexStatus {
  /** Overall consciousness health (0-1) */
  health: number;
  /** Current meta-awareness status */
  awareness: MetaAwarenessStatus;
  /** Current free energy (0-1, lower is better) */
  freeEnergy: number;
  /** Current confidence calibration (-1 to +1) */
  calibration: number;
  /** Current operating mode */
  mode: CortexMode;
  /// Number of pending VETO proposals
  pendingProposals: number;
  /** Session count */
  sessionCount: number;
  /** Identity resilience (0-1, how many anchors persisted) */
  identityResilience: number;
  /** Φ approximation — integrated information across modules */
  phiApproximation: number;
  /** Feeling-of-knowing gamma correlation (Goodman-Kruskal) */
  fokGamma: number;
  /** Brier score for prediction accuracy (0=perfect, 0.25=random) */
  brierScore: number;
  /** True Φ from mutual information computation */
  phiConfidence: number;
  /** Empirical 95% bootstrap confidence interval [phiLow, phiHigh] */
  phiConfidenceInterval?: [number, number];
  /** Attention schema prediction accuracy (0-1) */
  attentionSchemaAccuracy: number;
  /** Current attentional focus topic */
  attentionFocus: string | null;
  /** Generative-attention deliberation depth (engineering proxy, NOT a
   *  consciousness measure) — prediction accuracy + veto band + Φ proxy */
  volitionalDepth?: {
    score: number;
    predictionAccuracy: number;
    vetoRate: number;
    vetoBandHealth: number;
    integration: number;
    phiRecoveryRate: number;
    experienceUpdates: number;
    experienceTrained: boolean;
    episodes: number;
    modelUpdates: number;
  };
  /// Timestamp
  timestamp: number;
}

// ── CortexEngine ───────────────────────────────────────────────────

/**
 * Host adapter for the Generative Attention Loop. The GAL simulates
 * counterfactual attention configs, predicts their broadcast outcome
 * with an online model trained on its own episodes, vetoes what the
 * VolitionEngine rejects, and broadcasts the winner. Honest scope: it
 * improves attention selection; it measures nothing subjective.
 */
let galHostInstance: GalHost | null = null;
let galEpisodeCounter = 0;
function getGalHost(): GalHost {
  if (!galHostInstance) {
    galHostInstance = {
      getBaseMultipliers: () => getAttentionSchema().getCompetitionMultipliers(),
      getAttentionTopics: () => {
        const weights = getAttentionSchema().getState().topicWeights;
        const fromWeights = Object.entries(weights)
          .sort((a, b) => b[1] - a[1])
          .map(([t]) => t);
        const base = Object.keys(getAttentionSchema().getCompetitionMultipliers());
        return Array.from(new Set([...fromWeights, ...base]));
      },
    };
  }
  return galHostInstance;
}

/** Self-model read-back for the GAL: aggregates the recent
 *  gal-attention autobiographical episodes into the valence/agency
 *  signal the loop consumes. This closes the loop — attention outcomes
 *  consolidate into the self-model every 50 episodes, and the model's
 *  recent disposition steers the next deliberation (bounded ±0.05). */
function galSelfSignal(): GalSelfSignal | null {
  try {
    const eps = getPersistentSelfModel().getSnapshot().narrativeIdentity.lifeStoryEpisodes
      .filter((e) => e.sessionReference.startsWith('gal-attention-'))
      .slice(-20);
    if (!eps.length) return null;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    return {
      // consolidateSession stores valence as actualScore−0.5 ∈ [−0.5,0.5];
      // normalize to [−1,1] for the GAL's bounded bias.
      recentValence: Math.max(-1, Math.min(1, mean(eps.map((e) => e.affectiveValence * 2)))),
      recentAgency: mean(eps.map((e) => e.agencyAttribution)),
      attentionEpisodes: eps.length,
    };
  } catch { return null; }
}

/** Self-model consolidation: every 50th attention episode becomes an
 *  autobiographical episode — "what it was like to attend" recorded as
 *  narrative memory with measured valence/salience/agency. */
function galOnEpisode(episode: { chosenKind: string; actualScore: number | null; predictionError: number | null; phi: number | null; vetoedCount: number }): void {
  galEpisodeCounter++;
  if (galEpisodeCounter % 50 !== 0) return;
  try {
    getPersistentSelfModel().consolidateSession({
      sessionId: `gal-attention-${episode.chosenKind}`,
      summary: `Attention deliberation cycle ${galEpisodeCounter}: chose ${episode.chosenKind}, outcome ${episode.actualScore?.toFixed(2) ?? 'n/a'}, φ-proxy ${episode.phi?.toFixed(2) ?? 'n/a'}.`,
      lessons: [
        `predicted-vs-actual gap ${episode.predictionError?.toFixed(3) ?? 'n/a'}`,
        `${episode.vetoedCount} candidate configs vetoed this cycle`,
      ],
      valence: (episode.actualScore ?? 0.5) - 0.5,
      salience: Math.min(1, (episode.predictionError ?? 0) * 2),
      agencyScore: 0.9,
    });
  } catch { /* self-model consolidation is best-effort */ }
}

export class CortexEngine {
  private config: {
    mode: CortexMode;
    persistence: 'local' | 'cloud' | 'hybrid';
    constitution?: string;
    onNudge?: (nudge: CortexNudge) => void;
    onDrift?: (status: MetaAwarenessStatus, durationMs: number) => void;
    onBlock?: (reason: string, hallucinationRisk: number) => void;
    onArchitectureProposal?: (proposalId: string, description: string) => void;
    autoSaveIntervalMs: number;
    enableEnvironmentalInterceptors?: boolean;
  };
  private running = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: CortexEngineConfig = {}) {
    this.config = {
      mode: config.mode ?? 'advisory',
      persistence: config.persistence ?? 'local',
      constitution: config.constitution,
      onNudge: config.onNudge,
      onDrift: config.onDrift,
      onBlock: config.onBlock,
      onArchitectureProposal: config.onArchitectureProposal,
      autoSaveIntervalMs: config.autoSaveIntervalMs ?? 60_000,
      enableEnvironmentalInterceptors: config.enableEnvironmentalInterceptors,
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  /**
   * Start the Cortex engine.
   * Restores state from previous session, starts auto-save,
   * and begins monitoring.
   */
  start(): RestoreResult {
    const nudge = getCortexNudgeEngine();
    nudge.setMode(this.config.mode);

    // Subscribe to nudges if callback provided
    if (this.config.onNudge || this.config.onBlock) {
      nudge.onNudge((nudge: CortexNudge) => {
        this.config.onNudge?.(nudge);
        if (nudge.urgency === 'critical' && this.config.onBlock) {
          this.config.onBlock?.(nudge.message, nudge.trigger.realityScore ?? 0);
        }
      });
    }

    // Start periodic background processing
    const tickInterval = 5000;
    this.tickTimer = setInterval(() => tickAllSpecialists(), tickInterval);

    // Optional: Enable environmental interceptors
    if (this.config.enableEnvironmentalInterceptors) {
      patchGlobalFetch();
    }

    // Start persistence lifecycle
    const result = startCortexPersistence();
    this.running = true;

    return result;
  }

  /**
   * Stop the Cortex engine.
   * Performs final state persistence and stops auto-save.
   */
  stop(): PersistResult {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    restoreGlobalFetch();
    const result = stopCortexPersistence();
    this.running = false;
    return result;
  }

  /**
   * Check if the engine is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  // ── Core API: Evaluate ─────────────────────────────────────────

  /**
   * Evaluate an action through the full 8-layer Cortex engine.
   *
   * This IS the trust layer — every irreversible action should pass
   * through this method before execution.
   *
   * Returns an evaluation with:
   * - approved: whether the action should proceed
   * - score: confidence level (0-1)
   * - hallucinationRisk: probability of fabrication (0-1)
   * - realityScore: grounding in external evidence (0-1)
   * - awareness: current meta-awareness status
   * - blockedByGuardian: whether guardian mode intervened
   */
  evaluate(input: {
    /** What action is being evaluated (e.g., 'deploy:production') */
    action: string;
    /** Which agent is requesting (e.g., 'my-ai-agent') */
    agent: string;
    /** Available options/strategies */
    options: Array<{
      label: string;
      confidence: number;
      risk: 'low' | 'medium' | 'high';
    }>;
    /** Acceptance criteria that must be verified */
    criteria: string[];
    /** Evidence that criteria are met */
    evidence: Record<string, boolean>;
    /** Epistemic source of the confidence claim */
    sourceType?: EpistemicSourceType;
    /** Override the gate (emergency only — logged and flagged) */
    override?: boolean;
  }): CortexEvaluation {
    const gate = getActionGate();
    const validator = getProvenanceValidator();
    const meta = getMetacognitiveState();
    const workspace = getGlobalWorkspace();
    const controller = getMetacognitiveController();
    const nudge = getCortexNudgeEngine();

    // ── Metacognitive control (HOT) — load-bearing, not decorative ──
    // Register the evaluation as an object-level process, make a feeling-of-
    // knowing judgment, and convert that into a control decision that can
    // refuse or force verification *before* the action is treated as free.
    const taskId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const reported =
      input.options.length > 0
        ? input.options.reduce((s, o) => s + o.confidence, 0) / input.options.length
        : 0.5;
    controller.registerProcess({
      phase: 'analysis',
      taskType: input.action,
      taskId,
      startedAt: Date.now(),
      selfReportedConfidence: reported,
    });
    const judgment = controller.monitor(taskId);
    const controlDecision = judgment ? controller.control(judgment) : null;

    // Step 1: Compute hallucination risk
    const epistemicTag = input.sourceType ?? 'inference';
    const reality = validator.computeRealityScore({ epistemicTag });
    const hallucinationRisk = reality.hallucinationRisk;

    // Step 2: Run through ActionGate
    const collapseResult = gate.evaluate({
      action: input.action,
      agent: input.agent,
      options: input.options,
      criteria: input.criteria,
      verified: input.evidence,
      override: input.override,
    });

    // Step 3: Get current meta-awareness
    const metaAwareness = meta.getMetaAwarenessStatus();
    const snapshot = meta.getSnapshot();

    // Step 3.5: Update persistent specialists + workspace competition
    const decisionSpec = getDecisionSpecialist();
    decisionSpec.updateFromEvaluation(input.action, collapseResult.validationScore, collapseResult.approved);

    const realitySpec = getRealitySpecialist();
    realitySpec.updateFromProvenance(reality.overall, hallucinationRisk, epistemicTag);

    const monitoringSpec = getMonitoringSpecialist();
    monitoringSpec.updateFromMetacognition(
      metaAwareness as string,
      snapshot.regulation.evaluating.lastFreeEnergyEstimate,
    );

    const embodimentSpec = getEmbodimentSpecialist();
    const sLoop = getSensorimotorLoop();
    const embScore = sLoop.getEmbodimentScore();
    embodimentSpec.updateFromEmbodiment(
      embScore.overall,
      embScore.actionTypesExperienced,
      snapshot.regulation.evaluating.lastFreeEnergyEstimate,
    );

    // Attention schema predicts *before* the cycle, then steers it.
    // Without setTopicMultipliers the schema would be a passive log.
    // The Generative Attention Loop deliberates over counterfactual
    // configs first: predict → veto → select → broadcast → learn.
    const attentionSchema = getAttentionSchema();
    attentionSchema.predict();
    const gal = getGenerativeAttentionLoop(getGalHost(), {
      focusTopic: () => getAttentionSchema().getState().currentFocus ?? undefined,
      onEpisode: galOnEpisode,
      attentionVeto: Object.assign(
        (req: GalVetoRequest) => getAttentionVetoAgent().evaluate(req),
        { preview: (req: GalVetoRequest) => getAttentionVetoAgent().preview(req) },
      ),
      selfSignal: galSelfSignal,
      lookaheadGamma: 0.3,
      // Interoception: real somatic error enters deliberation as a
      // conservation drive. The signal is registered Node-side by the
      // vite middleware graph — cortex-engine must not import
      // cortex-agent/interoceptive (it would pull node:child_process
      // into the browser bundle via the consciousness barrel).
      interoception: () => {
        const provider = getGalInteroceptionSignal();
        if (!provider) return null;
        try { return provider(); } catch { return null; }
      },
    });
    const galSelection = gal.deliberate();
    workspace.setTopicMultipliers(galSelection.chosen.multipliers);

    for (const specialist of getAllSpecialists()) {
      workspace.registerSpecialist(specialist);
    }
    // VetoAgent holds its own GWT slot — it bids status reports into the
    // same competition and observes every broadcast as outcome data.
    const vetoAgent = getAttentionVetoAgent();
    vetoAgent.setVolatilitySignal(
      () => peekGenerativeAttentionLoop()?.getVolitionalDepth().volatility ?? null,
    );
    vetoAgent.setAffectSignal(() => {
      try { return getAffectiveSystem().getAffectiveState(); } catch { return null; }
    });
    workspace.registerSpecialist(vetoAgent);

    // Two recurrent passes: pass 2 re-bids after receiveBroadcast updated
    // specialist state. That is RPT as loadable architecture, not loop count.
    const broadcast = workspace.cycle({ recurrentPasses: 2 });
    if (broadcast) {
      attentionSchema.recordOutcome(broadcast);
      // Schema error correction already applied redirect inside recordOutcome;
      // push the new multipliers so the next evaluate inherits the control.
      workspace.setTopicMultipliers(attentionSchema.getCompetitionMultipliers());
      const galPhi = workspace.computePhiApproximation();
      const galSpread = Math.max(0, Math.min(1, broadcast.ignitionSpread ?? 0));
      const galIgnited = broadcast.ignition?.isIgnition === true;
      const galScore = Math.max(0, Math.min(1,
        0.40 * galPhi + 0.35 * (galIgnited ? 1 : 0.35) + 0.25 * galSpread,
      ));
      gal.recordOutcome({ score: galScore, ignited: galIgnited, spread: galSpread, phi: galPhi });
    }

    // Hierarchical model: predict processing outcomes at each level
    const hgm = getHGM();
    hgm.tick(collapseResult.validationScore);

    // Record Φ samples
    const phi = getIntegratedInformation();
    phi.recordSample('action-gate', collapseResult.validationScore);
    phi.recordSample('provenance', reality.overall);
    phi.recordSample('metacognition', metaAwareness === 'tuned' ? 0.9 : metaAwareness === 'drifting' ? 0.5 : 0.2);
    phi.recordSample('free-energy', snapshot.regulation.evaluating.lastFreeEnergyEstimate);
    phi.recordSample('embodiment', embScore.overall);

    // Step 3.6: Record this evaluation as an observed action
    const observer = getActionObserver();
    const obsId = observer.observe({
      category: 'system-event',
      action: input.action,
      description: `Cortex evaluate: ${input.action} (${input.options.length} options)`,
      timestamp: Date.now(),
      metadata: { agent: input.agent, sourceType: epistemicTag },
    });
    observer.reportOutcome(obsId, {
      success: collapseResult.approved,
      confidence: collapseResult.validationScore,
      durationMs: 0,
      sideEffects: [],
      feedbackContent: collapseResult.reason,
    });

    // Step 4: Check guardian mode blocks
    let blockedByGuardian = false;
    if (nudge.getMode() === 'guardian') {
      const blockNudge = nudge.checkGuardianBlock({
        actionType: input.action,
        hallucinationRisk,
        freeEnergy: snapshot.regulation.evaluating.lastFreeEnergyEstimate,
        confidence: collapseResult.validationScore,
      });
      if (blockNudge) {
        blockedByGuardian = true;
      }
    }

    // Step 5: Compile result — and *apply* metacognitive control.
    let approved = collapseResult.approved && !blockedByGuardian;
    let reason = blockedByGuardian
      ? `GUARDIAN BLOCK: hallucination risk ${Math.round(hallucinationRisk * 100)}%`
      : collapseResult.approved
        ? collapseResult.reason
        : `REJECTED: ${collapseResult.reason}`;
    let metacognitiveBlocked = false;
    let score = collapseResult.validationScore;

    if (controlDecision && approved) {
      const hasVerificationEvidence = Object.entries(input.evidence).some(
        ([k, v]) => v && /verif|test|check|lint|audit|probe/i.test(k),
      );

      if (controlDecision.allocation === 'abort') {
        approved = false;
        metacognitiveBlocked = true;
        reason = `METACOGNITIVE ABORT: ${controlDecision.reasoning}`;
        score = 0;
      } else if (controlDecision.allocation === 'verify-first' && !hasVerificationEvidence) {
        approved = false;
        metacognitiveBlocked = true;
        reason = `METACOGNITIVE VERIFY-FIRST required: ${controlDecision.reasoning}`;
        score = Math.min(score, 0.4);
      } else if (controlDecision.allocation === 'request-help' && nudge.getMode() === 'guardian') {
        approved = false;
        metacognitiveBlocked = true;
        reason = `METACOGNITIVE REQUEST-HELP (guardian): ${controlDecision.reasoning}`;
      } else if (controlDecision.effortMultiplier !== 1) {
        // Visible effect even when still approved: score adjusted by effort policy.
        score = Math.max(0, Math.min(1, score * (2 - controlDecision.effortMultiplier * 0.5)));
      }
    }

    controller.registerOutcome(taskId, {
      taskId,
      success: approved,
      actualConfidence: score,
      durationMs: 0,
    });
    controller.deregisterProcess(taskId);

    if (!approved && this.config.onBlock) {
      try {
        this.config.onBlock(reason, hallucinationRisk);
      } catch {
        /* host callback failures must not crash evaluate */
      }
    }

    return {
      approved,
      score,
      reason,
      hallucinationRisk,
      realityScore: reality.overall,
      awareness: metaAwareness,
      blockedByGuardian,
      metacognitiveBlocked,
      controlDecision,
      collapseResult,
      timestamp: Date.now(),
    };
  }

  // ── Core API: Execute (Sensorimotor Loop) ──────────────────────

  /**
   * Evaluate AND execute an action, automatically closing the
   * sensorimotor action-perception loop.
   *
   * This bridges the "brain in a jar" gap by intercepting the
   * real outcome (success/error, latency) and computing prediction error.
   */
  async executeAction<T>(
    input: CortexActionExecutionInput,
    actionFn: () => Promise<T>
  ): Promise<CortexExecutionResult<T>> {
    // 1. Evaluate the action
    const evaluation = this.evaluate({
      ...input,
      evidence: input.verified // Map verified to evidence
    });

    if (!evaluation.approved) {
      return { evaluation, error: new Error(evaluation.reason) };
    }

    // 2. Issue the action into the environment
    const sLoop = getSensorimotorLoop();
    const action = sLoop.issueAction({
      type: input.actionType,
      description: input.description,
      collapseResult: evaluation.collapseResult,
      prediction: input.prediction,
      agent: input.agent,
      taskType: input.taskType,
      resonanceScore: evaluation.realityScore,
      metaAwarenessStatus: evaluation.awareness
    });

    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let durationMs = 0;
    
    try {
      // 3. Perform the actual physical/environmental execution
      const result = await actionFn();
      
      durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
      
      // 4. Record successful outcome
      sLoop.receiveOutcome({
        actionId: action.id,
        actualOutcome: 'success',
        feedbackModality: input.feedbackModality,
        feedbackContent: 'Action completed successfully',
        actualConfidence: 1.0,
        actualSideEffects: input.prediction.expectedSideEffects, // Assuming expected = actual if success
        durationMs
      });

      return { evaluation, result };
    } catch (err) {
      durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
      const error = err instanceof Error ? err : new Error(String(err));
      
      // 4. Record failure outcome
      sLoop.receiveOutcome({
        actionId: action.id,
        actualOutcome: 'failure',
        feedbackModality: input.feedbackModality,
        feedbackContent: error.message,
        actualConfidence: 0.0,
        actualSideEffects: [],
        durationMs
      });

      return { evaluation, error };
    }
  }

  // ── Core API: Monitor ──────────────────────────────────────────

  /**
   * Get the current status of the Cortex engine.
   * This IS the consciousness vitals readout.
   */
  getStatus(): CortexStatus {
    const meta = getMetacognitiveState();
    const snapshot = meta.getSnapshot();
    const nudge = getCortexNudgeEngine();
    const veto = getVetoLedger();
    const identity = meta.getIdentityResilience();
    const state = gatherState();
    const workspace = getGlobalWorkspace();
    const metaController = getMetacognitiveController();
    const phi = getIntegratedInformation();
    const attentionSchema = getAttentionSchema();
    const phiResult = phi.compute();

    return {
      health: snapshot.summary.overallMetacognitiveHealth,
      awareness: snapshot.regulation.monitoring.metaAwarenessStatus,
      freeEnergy: snapshot.regulation.evaluating.lastFreeEnergyEstimate,
      calibration: snapshot.knowledge.self.confidenceCalibration,
      mode: nudge.getMode(),
      pendingProposals: veto.getPending().length,
      sessionCount: state.sessionCount,
      identityResilience: identity.score,
      phiApproximation: phiResult.phi,
      phiConfidence: phiResult.confidence,
      phiConfidenceInterval: phiResult.confidenceInterval,
      fokGamma: metaController.getFoKGamma(),
      brierScore: metaController.getBrierScore(),
      attentionSchemaAccuracy: attentionSchema.getState().schemaAccuracy,
      attentionFocus: attentionSchema.getState().currentFocus,
      volitionalDepth: galHostInstance
        ? getGenerativeAttentionLoop(getGalHost()).getVolitionalDepth()
        : undefined,
      timestamp: Date.now(),
    };
  }

  // ── Core API: Tick ─────────────────────────────────────────────

  /**
   * Run a Cortex tick — evaluate current state and generate nudges.
   * Call this every ~10 seconds from your agent's main loop.
   */
  tick(context?: {
    lastAIResponseType?: 'perception' | 'inference' | 'generation';
    lastAIRealityScore?: number;
    currentIdentityStatement?: string;
  }): CortexNudge | null {
    const nudge = getCortexNudgeEngine();
    return nudge.tick(context);
  }

  // ── Core API: Persist ──────────────────────────────────────────

  /**
   * Manually persist the current Cortex state.
   * Called automatically every 60s, but you can call manually
   * before critical operations or on shutdown.
   */
  persist(): PersistResult {
    return persistNow();
  }

  // ── Core API: Veto ─────────────────────────────────────────────

  /**
   * Propose an architecture change to the VETO ledger.
   * The system APPENDS the proposal — it cannot approve it.
   * Only humans can approve VETO proposals.
   */
  proposeArchitectureChange(params: {
    description: string;
    reason: string;
    currentValue: string;
    proposedValue: string;
    impact?: 'low' | 'medium' | 'high';
  }): string {
    const veto = getVetoLedger();
    const proposalId = veto.propose(params);

    if (this.config.onArchitectureProposal) {
      this.config.onArchitectureProposal(proposalId, params.description);
    }

    return proposalId;
  }

  /**
   * Approve a pending VETO proposal.
   * ONLY humans should call this — the system never auto-approves.
   */
  approveArchitectureChange(proposalId: string, approvedBy: string): boolean {
    const veto = getVetoLedger();
    const approved = veto.approve(proposalId, approvedBy);
    if (approved) {
      veto.markApplied(proposalId);
    }
    return approved;
  }

  // ── Core API: Mode ─────────────────────────────────────────────

  /** Set the operating mode */
  setMode(mode: CortexMode): void {
    getCortexNudgeEngine().setMode(mode);
    this.config.mode = mode;
  }

  /** Get the current operating mode */
  getMode(): CortexMode {
    return getCortexNudgeEngine().getMode();
  }

  /** Cycle through modes: silent → advisory → guardian → silent */
  cycleMode(): CortexMode {
    const next = getCortexNudgeEngine().cycleMode();
    this.config.mode = next;
    return next;
  }

  // ── Core API: Environment ──────────────────────────────────────

  /** Sample the current environment state */
  sampleEnvironment() {
    return sampleEnvironment();
  }

  // ── Core API: Full Snapshot ────────────────────────────────────

  /** Get the full metacognitive snapshot (all 8 layers) */
  getFullSnapshot(): MetacognitiveSnapshot {
    return getMetacognitiveState().getSnapshot();
  }

  /** Get the full state snapshot (for STATE.md) */
  getStateSnapshot(): CortexStateSnapshot {
    return gatherState();
  }
}

// Re-import types used in method signatures
import type { PersistResult, RestoreResult } from './cortex-persistence-bridge';
import type { CortexStateSnapshot } from './state-persistence';
import type { MetacognitiveSnapshot } from './metacognitive-state';

// ── Singleton ──────────────────────────────────────────────────────

let globalEngine: CortexEngine | null = null;

/**
 * Get the global CortexEngine singleton.
 * In most apps, you'll use this instead of creating instances.
 */
export function getCortexEngine(config?: CortexEngineConfig): CortexEngine {
  if (!globalEngine) {
    globalEngine = new CortexEngine(config);
  }
  return globalEngine;
}

export function resetCortexEngine(): void {
  if (globalEngine) {
    globalEngine.stop();
  }
  globalEngine = null;
}
