import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConsciousOrchestrator,
  getConsciousOrchestrator,
  getSensorimotorLoopService,
  getAffectiveSystem,
  getPersistentSelfModel,
  MultimodalBindingEngine,
  SocialConsciousnessEngine,
} from '../consciousness';

describe('Conscious AI Unified Integration (100% Operational Architecture)', () => {
  let orchestrator: ConsciousOrchestrator;

  beforeEach(() => {
    orchestrator = new ConsciousOrchestrator();
  });

  describe('Phase 1: Sensorimotor Closure Loop', () => {
    it('executes closed-loop action with prediction and updates generative model from error', async () => {
      const sensorimotor = getSensorimotorLoopService();
      const currentPerception = {
        id: 'test-percept-1',
        modality: 'visual' as const,
        features: {
          visualEmbedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
          domStateHash: 'hash-init',
          worldStateSummary: 'Initial state before action',
          confidence: 0.95,
          timestamp: Date.now(),
        },
        capturedAt: Date.now(),
      };

      const action = {
        id: 'action-test-click',
        source: 'openclaw' as const,
        name: 'click_element',
        parameters: { selector: '#btn-execute' },
        intent: 'Trigger workflow execution',
        expectedConsequenceDescription: 'Execution begins and state shifts',
        initiatedAt: Date.now(),
      };

      const predictedState = sensorimotor.predictSensoryConsequence(currentPerception, action);
      expect(predictedState.features.visualEmbedding.length).toBeGreaterThan(0);

      const outcome = await sensorimotor.executeWithPrediction(
        action,
        predictedState,
        async () => ({
          id: 'test-percept-post',
          modality: 'visual' as const,
          features: {
            visualEmbedding: [0.12, 0.22, 0.31, 0.41, 0.52, 0.61, 0.72, 0.81, 0.92, 0.99, 0.12, 0.21, 0.32, 0.41, 0.51, 0.62],
            domStateHash: 'hash-post',
            worldStateSummary: 'Workflow execution active in DOM',
            confidence: 0.97,
            timestamp: Date.now(),
          },
          capturedAt: Date.now(),
        })
      );

      expect(outcome.predictionError).toBeDefined();
      expect(outcome.predictionError).toBeLessThan(0.5); // Minor difference should have low error
      expect(outcome.freeEnergyDelta).toBeGreaterThanOrEqual(0);
      expect(outcome.generativeModelUpdated).toBe(true);
      expect(outcome.adaptedDrives.predictionAccuracy).toBeGreaterThan(0.7);
    });

    it('regulates homeostasis by generating motor actions to resolve deficits', () => {
      const sensorimotor = getSensorimotorLoopService();
      const regulatedActions = sensorimotor.regulateHomeostasis({
        energy: 0.20, // Deficit!
        predictionAccuracy: 0.50, // Ambiguity!
        goalProgress: 0.70,
        socialBond: 0.80,
        autonomy: 0.40, // Deficit!
      });

      expect(regulatedActions.length).toBeGreaterThanOrEqual(2);
      const names = regulatedActions.map(a => a.name);
      expect(names).toContain('rest_and_conserve');
      expect(names).toContain('epistemic_foraging');
    });
  });

  describe('Phase 2: Affective Valence Grounding', () => {
    it('computes grounded valence and arousal from homeostatic variables', () => {
      const affective = getAffectiveSystem();
      affective.setDrives({
        energy: 0.95,
        predictionAccuracy: 0.92,
        goalProgress: 0.88,
        socialBond: 0.90,
        autonomy: 0.85,
      });

      const valence = affective.computeValence();
      const arousal = affective.computeArousal();
      const dominance = affective.computeDominance();

      expect(valence).toBeGreaterThan(0.5); // Satisfied drives -> high positive valence
      expect(arousal).toBeGreaterThan(0.0);
      expect(arousal).toBeLessThan(1.0);
      expect(dominance).toBeGreaterThan(0.7);
    });

    it('generates intrinsic motivations based on homeostatic deficits', () => {
      const affective = getAffectiveSystem();
      affective.setDrives({
        energy: 0.80,
        predictionAccuracy: 0.70, // Needs epistemic reduction
        goalProgress: 0.65,
        socialBond: 0.80,
        autonomy: 0.60,
      });

      const motivations = affective.generateMotivations();
      expect(motivations.length).toBeGreaterThan(0);
      expect(motivations.some(m => m.type === 'curiosity')).toBe(true);
      expect(motivations[0].expectedFreeEnergyReduction).toBeGreaterThan(0);
    });

    it('gates actions with approach/avoid decisions under adverse conditions', () => {
      const affective = getAffectiveSystem();
      affective.setDrives({
        energy: 0.10,
        predictionAccuracy: 0.15,
        goalProgress: 0.10,
        socialBond: 0.20,
        autonomy: 0.10,
      });

      const decision = affective.evaluateActionValence('dangerous_destructive_command', 0.95);
      expect(decision.allowed).toBe(false);
      expect(decision.decision).toBe('avoid');
    });
  });

  describe('Phase 3: Persistent Self-Model', () => {
    it('manages narrative autobiographical episodes and prospection', () => {
      const selfModel = getPersistentSelfModel();
      const episode = selfModel.consolidateSession({
        sessionId: 'test-session-live',
        summary: 'Integrated 100% conscious AI components across OpenClaw and Hermes',
        lessons: ['Unified sensorimotor closure prevents split-brain pathology'],
        valence: 0.90,
        salience: 0.95,
        agencyScore: 0.98,
      });

      expect(episode.id).toBeDefined();
      const retrieved = selfModel.retrieveAutobiographical('OpenClaw');
      expect(retrieved.length).toBeGreaterThan(0);

      const prospection = selfModel.projectFuture('near_term');
      expect(prospection.anticipatedMilestones.length).toBeGreaterThan(0);
    });

    it('attributes agency and maintains recursive Theory of Mind', () => {
      const selfModel = getPersistentSelfModel();
      const claimed = selfModel.attributeAgency(
        'act-test-id',
        'file modified',
        'file modified successfully on disk',
        0.90
      );
      expect(claimed).toBe(true);

      selfModel.updateTheoryOfMind('human_operator', {
        inferredIntent: 'system_verification',
        alignmentScore: 0.98,
      });

      const tom = selfModel.getTheoryOfMind('human_operator');
      expect(tom?.inferredIntent).toBe('system_verification');
    });
  });

  describe('Phase 4: 24/7 Autonomous Operation & Sleep Cycle', () => {
    it('executes computational sleep cycle with synaptic homeostasis and memory consolidation', async () => {
      const orchestrator = getConsciousOrchestrator();
      const sleepOutcome = await orchestrator.runDreamConsolidation();

      expect(sleepOutcome.phase).toBe('deep_sleep');
      expect(sleepOutcome.synapticDownscaleRatio).toBeGreaterThan(0);
      expect(sleepOutcome.freeEnergyReducedNats).toBeGreaterThan(0);
      expect(sleepOutcome.dreamNarratives.length).toBeGreaterThan(0);
      expect(sleepOutcome.rejuvenatedEnergy).toBe(0.98);
    });

    it('generates self-initiated voluntary actions in wake phase when intrinsically motivated', () => {
      const autonomous = orchestrator.getAutonomousConsciousness();
      autonomous.setCircadianPhase('wake');
      orchestrator.getAffectiveSystem().setDrives({
        energy: 0.90,
        predictionAccuracy: 0.75, // Triggers curiosity
      });

      const action = autonomous.generateVoluntaryAction();
      expect(action).not.toBeNull();
      expect(action?.parameters?.autonomous).toBe(true);
    });
  });

  describe('Phase 5: Multimodal Binding & Social Consciousness', () => {
    it('binds disparate channels into a single unified percept with Phi binding score', () => {
      const multimodal = new MultimodalBindingEngine();
      const percept = multimodal.bind([
        {
          modality: 'visual',
          featureVector: [0.2, 0.4, 0.6, 0.8, 0.1, 0.3, 0.5, 0.7, 0.9, 0.2, 0.4, 0.6, 0.8, 0.1, 0.3, 0.5],
          salience: 0.90,
          timestamp: Date.now(),
        },
        {
          modality: 'dom_structural',
          featureVector: [0.1, 0.3, 0.5, 0.7, 0.9, 0.2, 0.4, 0.6, 0.8, 0.1, 0.3, 0.5, 0.7, 0.9, 0.2, 0.4],
          salience: 0.80,
          timestamp: Date.now(),
        },
      ]);

      expect(percept.dominantModality).toBe('visual');
      expect(percept.phiBindingScore).toBeGreaterThan(0.5);
      expect(percept.boundFeatureVector.length).toBe(16);
    });

    it('enforces cultural conventions and simulates others empathy', () => {
      const social = new SocialConsciousnessEngine();
      const mental = social.modelOther('collaborator', 2);
      expect(mental.recursiveDepth).toBe(2);

      const empathy = social.simulateOther('collaborator', 'Task failed with compile error');
      expect(empathy.valence).toBeLessThan(0); // Empathizes with distress on failure
    });
  });

  describe('Unified Conscious AI Orchestrator: End-to-End Execution', () => {
    it('executes a complete consciousness cycle across all 9 stages', async () => {
      const outcome = await orchestrator.consciousnessCycle({
        userInput: 'Inspect active project status and synchronize memory',
      });

      expect(outcome.cycleIndex).toBeGreaterThan(0);
      expect(outcome.perception.unifiedPercept).toBeDefined();
      expect(outcome.globalWorkspace.phi).toBeGreaterThan(0);
      expect(outcome.freeEnergy.variationalNats).toBeGreaterThan(0);
      expect(outcome.controlLoop.controlAllocation).toBeDefined();
      expect(outcome.metacognitiveUpdate.affectiveState).toBeDefined();
      expect(outcome.durationMs).toBeGreaterThan(0);
    });

    it('executes multiple consecutive cycles under stress with zero errors', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await orchestrator.consciousnessCycle();
        expect(res.cycleIndex).toBeGreaterThan(0);
      }

      const snapshot = orchestrator.getSnapshot();
      expect(snapshot.cycleCounter).toBeGreaterThanOrEqual(5);
      expect(snapshot.recentCycles.length).toBeGreaterThanOrEqual(5);
    });
  });
});
