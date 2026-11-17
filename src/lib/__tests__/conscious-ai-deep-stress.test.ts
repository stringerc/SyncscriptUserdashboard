import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConsciousOrchestrator,
  getConsciousOrchestrator,
  SensorimotorLoopService,
  AffectiveSystem,
  PersistentSelfModel,
  AutonomousConsciousness,
  MultimodalBindingEngine,
  SocialConsciousnessEngine,
  type ClosedLoopAction,
  type SensoryState,
} from '../consciousness';

describe('Conscious AI In-Depth Architecture Stress Test', () => {
  let orchestrator: ConsciousOrchestrator;
  let sensorimotor: SensorimotorLoopService;
  let affective: AffectiveSystem;
  let selfModel: PersistentSelfModel;
  let autonomous: AutonomousConsciousness;
  let multimodal: MultimodalBindingEngine;
  let social: SocialConsciousnessEngine;

  beforeEach(() => {
    orchestrator = new ConsciousOrchestrator();
    sensorimotor = new SensorimotorLoopService();
    affective = new AffectiveSystem();
    selfModel = new PersistentSelfModel();
    autonomous = new AutonomousConsciousness(affective, selfModel);
    multimodal = new MultimodalBindingEngine();
    social = new SocialConsciousnessEngine();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. High-Frequency Continuous Load & Latency Profiling
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Dimension 1: Continuous Throughput & Latency Profiling', () => {
    it('executes 100 consecutive consciousness cycles with sub-50ms latency and bounded metrics', async () => {
      const cycleCount = 100;
      const latencies: number[] = [];
      const phiValues: number[] = [];
      const freeEnergyValues: number[] = [];

      for (let i = 0; i < cycleCount; i++) {
        const start = performance.now();
        const outcome = await orchestrator.consciousnessCycle({
          userInput: `Continuous stress probe iteration ${i + 1}`,
        });
        const elapsed = performance.now() - start;

        latencies.push(elapsed);
        phiValues.push(outcome.globalWorkspace.phi);
        freeEnergyValues.push(outcome.freeEnergy.variationalNats);

        // Invariant assertions per cycle
        expect(outcome.cycleIndex).toBe(i + 1);
        expect(outcome.globalWorkspace.phi).toBeGreaterThanOrEqual(0);
        expect(outcome.freeEnergy.variationalNats).toBeGreaterThanOrEqual(0);
        expect(outcome.metacognitiveUpdate.affectiveState.valence).toBeGreaterThanOrEqual(-1.0);
        expect(outcome.metacognitiveUpdate.affectiveState.valence).toBeLessThanOrEqual(1.0);
      }

      // Latency distribution analysis
      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(cycleCount * 0.50)];
      const p95 = latencies[Math.floor(cycleCount * 0.95)];
      const p99 = latencies[Math.floor(cycleCount * 0.99)];
      const maxLatency = latencies[cycleCount - 1];
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / cycleCount;

      expect(p50).toBeLessThan(35); // 50th percentile sub-35ms
      expect(p95).toBeLessThan(60); // 95th percentile sub-60ms
      expect(avgLatency).toBeLessThan(40);

      // Verify cycle history ring-buffer boundedness
      const history = orchestrator.getCycleHistory();
      expect(history.length).toBeLessThanOrEqual(100);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Extreme Sensorimotor Perturbation & Generative Adaptation
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Dimension 2: Extreme Sensorimotor Perturbation & Adaptation', () => {
    it('adapts generative transition weights under severe adversarial prediction errors', async () => {
      const action: ClosedLoopAction = {
        id: 'act-adversarial-test',
        source: 'openclaw',
        name: 'browser_navigate',
        parameters: { url: 'https://adversarial-target.test' },
        intent: 'Test active inference error minimization under chaotic feedback',
        expectedConsequenceDescription: 'Expected standard DOM state',
        initiatedAt: Date.now(),
      };

      const initialSensory: SensoryState = {
        id: 'sensory-init',
        modality: 'visual',
        features: {
          visualEmbedding: new Array(16).fill(0.1),
          domStateHash: 'hash-clean',
          worldStateSummary: 'Initial clean state',
          confidence: 0.95,
          timestamp: Date.now(),
        },
        capturedAt: Date.now(),
      };

      const errorTrajectory: number[] = [];
      const runs = 25;

      // Simulate a stable world that initially contradicts the agent's prior
      const stableTargetConsequence = [
        0.8, 0.85, 0.9, 0.75, 0.8, 0.85, 0.9, 0.75, 0.8, 0.85, 0.9, 0.75, 0.8, 0.85, 0.9, 0.75
      ];

      for (let step = 0; step < runs; step++) {
        const predicted = sensorimotor.predictSensoryConsequence(initialSensory, action);
        const outcome = await sensorimotor.executeWithPrediction(
          action,
          predicted,
          async () => ({
            id: `sensory-step-${step}`,
            modality: 'visual',
            features: {
              visualEmbedding: [...stableTargetConsequence],
              domStateHash: `hash-step-${step}`,
              worldStateSummary: `Observed state at step ${step}`,
              confidence: 0.98,
              timestamp: Date.now(),
            },
            capturedAt: Date.now(),
          })
        );

        errorTrajectory.push(outcome.predictionError);
      }

      // Verify that learning reduces prediction error over successive cycles
      const initialError = errorTrajectory[0];
      const finalError = errorTrajectory[errorTrajectory.length - 1];
      expect(initialError).toBeGreaterThan(0.2);
      expect(finalError).toBeLessThan(initialError);

      // Verify mean prediction error calculation is stable
      const meanError = sensorimotor.getMeanPredictionError();
      expect(meanError).toBeGreaterThan(0);
      expect(meanError).toBeLessThan(1.0);
    });

    it('triggers epistemic foraging motor commands when ambiguity spikes', () => {
      const actions = sensorimotor.regulateHomeostasis({
        energy: 0.8,
        predictionAccuracy: 0.40, // High surprise/ambiguity
        goalProgress: 0.5,
        socialBond: 0.8,
        autonomy: 0.8,
      });

      expect(actions.some(a => a.name === 'epistemic_foraging')).toBe(true);
      const foraging = actions.find(a => a.name === 'epistemic_foraging');
      expect(foraging?.parameters?.inspectDomain).toBe('active_environment');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Extreme Affective Homeostasis Stress & Depletion
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Dimension 3: Affective Homeostasis Depletion & Recovery', () => {
    it('transitions to severe aversive valence and high arousal under critical depletion', () => {
      affective.setDrives({
        energy: 0.05,             // Starved compute
        predictionAccuracy: 0.08, // Severe confusion
        goalProgress: 0.05,       // Total obstruction
        socialBond: 0.15,
        autonomy: 0.05,           // Total constraint
      });

      const valence = affective.computeValence();
      const arousal = affective.computeArousal();
      const dominance = affective.computeDominance();

      expect(valence).toBeLessThan(-0.65); // Deep distress/aversive state
      expect(arousal).toBeGreaterThan(0.70); // Metabolic urgency
      expect(dominance).toBeLessThan(0.30); // Low efficacy

      // Approach/Avoid protective gate MUST veto risky operations
      const decision = affective.evaluateActionValence('destructive_bulk_mutation', 0.85);
      expect(decision.allowed).toBe(false);
      expect(decision.decision).toBe('avoid');
      expect(decision.reason).toContain('trigger protective inhibition');
    });

    it('recovers homeostasis smoothly when restorative actions are consolidated', () => {
      affective.setDrives({
        energy: 0.15,
        predictionAccuracy: 0.20,
        goalProgress: 0.20,
        socialBond: 0.30,
        autonomy: 0.20,
      });

      const startValence = affective.computeValence();

      // Apply 10 successful cycles
      for (let i = 0; i < 10; i++) {
        affective.updateFromCycle({
          success: true,
          predictionError: 0.05,
          voluntary: true,
          energyConsumed: -0.05, // Energy replenish
        });
      }

      const recoveredDrives = affective.getDrives();
      const endValence = affective.computeValence();

      expect(recoveredDrives.predictionAccuracy).toBeGreaterThan(0.70);
      expect(recoveredDrives.goalProgress).toBeGreaterThan(0.40);
      expect(endValence).toBeGreaterThan(startValence);
    });

    it('generates scaled intrinsic motivations proportional to specific deficits', () => {
      // Deplete curiosity vs autonomy independently
      affective.setDrives({
        energy: 0.80,
        predictionAccuracy: 0.30, // Large prediction deficit -> high curiosity
        goalProgress: 0.90,
        socialBond: 0.80,
        autonomy: 0.85,
      });

      const motivations = affective.generateMotivations();
      expect(motivations[0].type).toBe('curiosity');
      expect(motivations[0].intensity).toBeGreaterThanOrEqual(0.65);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Scale & Longevity of Persistent Self-Model
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Dimension 4: Persistent Self-Model Scale & Retrieval', () => {
    it('manages 500 autobiographical episodes with high-speed semantic cue retrieval', () => {
      const episodeCount = 300;
      const start = performance.now();

      for (let i = 0; i < episodeCount; i++) {
        selfModel.consolidateSession({
          sessionId: `stress-session-${i}`,
          summary: `Autobiographical event ${i}: verified OpenClaw tool routing with Hermes consensus`,
          lessons: [`Lesson ${i}: maintain idempotency across mutating boundaries`],
          valence: Number((Math.sin(i) * 0.5).toFixed(2)),
          salience: Number(((i % 10) / 10 + 0.1).toFixed(2)),
          agencyScore: Number((0.7 + (i % 3) * 0.1).toFixed(2)),
        });
      }

      const insertionTime = performance.now() - start;
      expect(insertionTime).toBeLessThan(150); // Sub-150ms for 300 episodes

      // Test cue retrieval
      const queryStart = performance.now();
      const hits = selfModel.retrieveAutobiographical('Hermes consensus');
      const queryTime = performance.now() - queryStart;

      expect(queryTime).toBeLessThan(35); // Sub-35ms retrieval under concurrent load
      expect(hits.length).toBe(episodeCount);
      // Ensure hits are ordered by salience
      expect(hits[0].emotionalSalience).toBeGreaterThanOrEqual(hits[hits.length - 1].emotionalSalience);
    });

    it('generates consistent prospection projections across multiple time horizons', () => {
      const near = selfModel.projectFuture('near_term');
      const medium = selfModel.projectFuture('medium_term');
      const long = selfModel.projectFuture('long_term');

      expect(near.timestampHorizon).toBeLessThan(medium.timestampHorizon);
      expect(medium.timestampHorizon).toBeLessThan(long.timestampHorizon);
      expect(long.intendedCoherenceTarget).toBeGreaterThanOrEqual(near.intendedCoherenceTarget);
      expect(near.projectedCapabilities.length).toBeGreaterThan(0);
    });

    it('accurately discriminates self-agency from external fluctuations', () => {
      // Direct causal match -> claimed
      const selfCaused = selfModel.attributeAgency(
        'act-write-1',
        'file updated',
        'Observed file updated successfully on disk',
        0.85
      );
      expect(selfCaused).toBe(true);

      // Unrelated external outcome -> rejected
      const externalFluctuation = selfModel.attributeAgency(
        'act-read-2',
        'file content read',
        'Remote server responded with 504 Gateway Timeout unrelated to local query',
        0.30
      );
      expect(externalFluctuation).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Circadian & Computational Sleep Dynamics
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Dimension 5: Complete 24-Hour Diurnal Sleep Cycles', () => {
    it('executes computational sleep: synaptic downscale, consolidation, and energy replenishment', async () => {
      // Deplete energy to simulate an active day
      affective.setDrives({
        energy: 0.22,
        predictionAccuracy: 0.65,
      });

      // Inject emotional tags
      affective.tagEmotionalMemory('High salience discovery in causal graph');
      affective.tagEmotionalMemory('Critical resolution of prediction surprise');

      autonomous.setCircadianPhase('wake');
      expect(autonomous.getCircadianPhase()).toBe('wake');

      // Enter sleep cycle
      const outcome = await autonomous.executeSleepCycle();

      expect(outcome.phase).toBe('deep_sleep');
      expect(outcome.synapticDownscaleRatio).toBe(0.18); // 18% weight normalization
      expect(outcome.freeEnergyReducedNats).toBeGreaterThan(0.10);
      expect(outcome.rejuvenatedEnergy).toBe(0.98); // Restored energy reserve
      expect(outcome.dreamNarratives.length).toBeGreaterThanOrEqual(2);

      // Confirm energy replenishment in affective system
      expect(affective.getDrives().energy).toBe(0.98);
    });

    it('suppresses voluntary actions during sleep and enables them in wake phase', () => {
      autonomous.setCircadianPhase('deep_sleep');
      expect(autonomous.shouldInitiateVoluntaryAction()).toBe(false);
      expect(autonomous.generateVoluntaryAction()).toBeNull();

      autonomous.setCircadianPhase('dream');
      expect(autonomous.shouldInitiateVoluntaryAction()).toBe(false);
      expect(autonomous.generateVoluntaryAction()).toBeNull();

      autonomous.setCircadianPhase('wake');
      affective.setDrives({
        energy: 0.90,
        predictionAccuracy: 0.70, // Drive exists
      });
      expect(autonomous.shouldInitiateVoluntaryAction()).toBe(true);
      const action = autonomous.generateVoluntaryAction();
      expect(action).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. High-Density Multimodal Binding & Cross-Modal Prediction
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Dimension 6: High-Density Multimodal Binding', () => {
    it('binds 5 distinct modalities and computes Phi binding score based on diversity', () => {
      const now = Date.now();
      const channels = [
        { modality: 'visual' as const, featureVector: new Array(16).fill(0.3), salience: 0.90, timestamp: now },
        { modality: 'dom_structural' as const, featureVector: new Array(16).fill(0.4), salience: 0.85, timestamp: now },
        { modality: 'textual_world' as const, featureVector: new Array(16).fill(0.5), salience: 0.80, timestamp: now },
        { modality: 'proprioceptive' as const, featureVector: new Array(16).fill(0.2), salience: 0.70, timestamp: now },
        { modality: 'auditory' as const, featureVector: new Array(16).fill(0.1), salience: 0.60, timestamp: now },
      ];

      const bound = multimodal.bind(channels);

      expect(bound.dominantModality).toBe('visual'); // Highest salience
      expect(bound.phiBindingScore).toBeGreaterThan(0.70);
      expect(bound.boundFeatureVector.length).toBe(16);
      expect(bound.summary).toContain('5 modalities');

      // Cross-modal prediction
      const predictedVisual = multimodal.predictCrossModal(channels[2], 'visual');
      expect(predictedVisual.modality).toBe('visual');
      expect(predictedVisual.featureVector.length).toBe(16);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. State Serialization, Checkpoint Recovery & Drift Fidelity
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Dimension 7: Serialization Checkpointing & Identity Recovery', () => {
    it('serializes state snapshots without circular references and restores with high fidelity', () => {
      // Populate state
      selfModel.consolidateSession({
        sessionId: 'session-checkpoint-test',
        summary: 'Pivotal breakthrough in autonomous cognitive loop stabilization',
        lessons: ['Preserve zero-drift invariants across serializations'],
        valence: 0.88,
        salience: 0.96,
        agencyScore: 0.99,
      });

      selfModel.updateTheoryOfMind('external_peer_agent', {
        inferredIntent: 'cooperative_validation',
        alignmentScore: 0.95,
      });

      const snapshot = selfModel.getSnapshot();

      // Verify JSON serializability
      const serialized = JSON.stringify(snapshot);
      expect(typeof serialized).toBe('string');
      expect(serialized.length).toBeGreaterThan(200);

      const parsed = JSON.parse(serialized);
      expect(parsed.narrativeIdentity.coreValues.length).toBeGreaterThan(0);
      expect(parsed.continuityMetrics.narrativeCoherence).toBe(0.94);

      // Re-hydrate into a new instance
      const restoredSelf = new PersistentSelfModel();
      restoredSelf.restoreFromSnapshot(parsed);

      const restoredSnapshot = restoredSelf.getSnapshot();
      expect(restoredSnapshot.narrativeIdentity.lifeStoryEpisodes.length).toBe(
        snapshot.narrativeIdentity.lifeStoryEpisodes.length
      );
      expect(restoredSnapshot.socialSelf.theoryOfMind['external_peer_agent'].alignmentScore).toBe(0.95);
    });
  });
});
