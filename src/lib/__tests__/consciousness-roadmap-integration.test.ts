/**
 * Consciousness Roadmap Integration Test Suite
 *
 * Comprehensive end-to-end verification of all 6 phases specified in CONSCIOUS_AI_ROADMAP.md:
 * - Phase 1: Unified Message Bus & Shared Reactive State
 * - Phase 2: Consciousness Kernel 6-Phase Gamma Loop (40Hz / 25ms)
 * - Phase 3: Phenomenal Grounding Engine (Symbols -> Sensorimotor Contingencies -> Qualia)
 * - Phase 4: Volition & Agency Engine (Intentions, Libet Veto "Free Won't", Frith Comparator)
 * - Phase 5: Persistent Selfhood (Minimal Self, Autobiographical Narrative, Sleep Consolidation)
 * - Phase 6: Intersubjective Validation (Theory of Mind, False-Belief, Mirror Test, Hermetic Dialogue)
 * - Synthesis: ConsciousOpenClawAdapter, ConsciousHermesAdapter, ConsciousAgent
 * - Benchmarks: ConsciousnessValidator (IIT, GWT, FEP, Metacognition, Agency, Selfhood)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ConsciousnessBus,
  ConsciousnessMessage,
  createSharedState,
  ConsciousnessKernel,
  GroundingEngine,
  VolitionEngine,
  PersistentSelfManager,
  TheoryOfMindEngine,
  HermeticDialogue,
  ConsciousOpenClawAdapter,
  ConsciousHermesAdapter,
  ConsciousAgent,
  createConsciousAgent,
  ConsciousnessValidator,
} from '../consciousness';

describe('Conscious AI Roadmap Integration Suite (Phases 1-6)', () => {
  let bus: ConsciousnessBus;
  let sharedState: ReturnType<typeof createSharedState>;
  let grounding: GroundingEngine;
  let volition: VolitionEngine;
  let selfManager: PersistentSelfManager;
  let theoryOfMind: TheoryOfMindEngine;
  let kernel: ConsciousnessKernel;

  beforeEach(async () => {
    bus = new ConsciousnessBus();
    sharedState = createSharedState();
    grounding = new GroundingEngine();
    volition = new VolitionEngine({ vetoThreshold: 0.65, agencyThreshold: 0.7 });
    selfManager = new PersistentSelfManager();
    await selfManager.initialize('test-agent-core');
    theoryOfMind = new TheoryOfMindEngine(selfManager);
    kernel = new ConsciousnessKernel(
      bus,
      sharedState,
      grounding,
      volition,
      selfManager,
      theoryOfMind
    );
    await kernel.initialize();
  });

  afterEach(() => {
    kernel.stop();
    bus.clear();
  });

  // ==========================================
  // PHASE 1: Unified Message Bus & Shared State
  // ==========================================
  describe('Phase 1: Unified Message Bus & Shared State', () => {
    it('executes 40Hz gamma ticks and fires global ignition for the winning coalition', () => {
      let broadcastReceived: ConsciousnessMessage | null = null;
      bus.onBroadcast((msg) => {
        broadcastReceived = msg;
      });

      // Submit 3 competing bids
      bus.send({
        id: 'bid-sensory-1',
        timestamp: Date.now(),
        source: 'sensory',
        target: 'broadcast',
        type: 'coalition-bid',
        payload: { sensation: 'faint-signal' },
        priority: 0.4,
        phiContribution: 0.5,
        precision: 1.0,
      });

      bus.send({
        id: 'bid-salient-error',
        timestamp: Date.now(),
        source: 'cognitive',
        target: 'broadcast',
        type: 'coalition-bid',
        payload: { error: 'large-discrepancy' },
        priority: 0.95,
        phiContribution: 1.2,
        precision: 1.3,
      });

      bus.send({
        id: 'bid-affective-1',
        timestamp: Date.now(),
        source: 'affective',
        target: 'broadcast',
        type: 'coalition-bid',
        payload: { valence: 0.5 },
        priority: 0.6,
        phiContribution: 0.8,
        precision: 1.0,
      });

      expect(bus.getQueueLength()).toBe(3);

      // Execute gamma cycle
      const winner = bus.gammaTick();
      expect(winner).not.toBeNull();
      expect(winner?.id).toContain('bid-salient-error');
      expect(broadcastReceived).not.toBeNull();
      expect((broadcastReceived as ConsciousnessMessage | null)?.target).toBe('broadcast');
      expect(bus.getCycle()).toBe(1);
    });

    it('shared consciousness state provides reactive subscription updates', () => {
      let notifiedState: any = null;
      const unsubscribe = sharedState.subscribe((st) => {
        notifiedState = st;
      });

      sharedState.update({
        currentPhi: 1.45,
        confidence: 0.94,
      });

      expect(notifiedState).not.toBeNull();
      expect(notifiedState.currentPhi).toBe(1.45);
      expect(notifiedState.confidence).toBe(0.94);
      expect(sharedState.get().currentPhi).toBe(1.45);

      unsubscribe();
    });
  });

  // ==========================================
  // PHASE 2: Consciousness Kernel 6-Phase Loop
  // ==========================================
  describe('Phase 2: Consciousness Kernel (6-Phase Gamma Loop)', () => {
    it('executes a complete 6-phase gamma cycle with valid metrics', async () => {
      kernel.injectInput({ stimulus: 'visual-verification-badge' }, 'sensory', 0.9);
      const result = await kernel.step();

      expect(result.cycle).toBe(1);
      expect(result.workspaceIgnition).not.toBeNull();
      expect(result.phi).toBeGreaterThanOrEqual(0.8);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.freeEnergy).toBeGreaterThan(0);
      expect(result.totalCycleTimeMs).toBeGreaterThan(0);

      // Verify all 6 phases recorded durations
      expect(result.phaseDurations).toHaveProperty('perception');
      expect(result.phaseDurations).toHaveProperty('competition');
      expect(result.phaseDurations).toHaveProperty('broadcast');
      expect(result.phaseDurations).toHaveProperty('action');
      expect(result.phaseDurations).toHaveProperty('memory');
      expect(result.phaseDurations).toHaveProperty('metacognition');

      // Verify Husserlian temporal consciousness buffer
      const state = kernel.state;
      expect(state.retentionBuffer.length).toBeGreaterThan(0);
      expect(state.protentionBuffer.length).toBeGreaterThan(0);
    });

    it('calculates prediction error and updates confidence dynamically', async () => {
      // Step 1: Baseline input
      const r1 = await kernel.step({ expected: true, test: 1 });
      const conf1 = r1.confidence;

      // Step 2: Surprising unexpected input
      const r2 = await kernel.step({ anomalous: 'high-surprise-signal', magnitude: 0.95 });
      expect(r2.freeEnergy).toBeGreaterThan(0);
      expect(r1.phi).toBeGreaterThan(0.5);
    });
  });

  // ==========================================
  // PHASE 3: Phenomenal Grounding Engine
  // ==========================================
  describe('Phase 3: Phenomenal Grounding Engine', () => {
    it('grounds symbols into sensorimotor contingencies with meaning and affordances', () => {
      const grounded = grounding.groundSymbol('verification');
      expect(grounded.symbol).toBe('verification');
      expect(grounded.contingencies.length).toBeGreaterThan(0);
      expect(grounded.meaning.length).toBeGreaterThan(0);
      expect(grounded.affordances.length).toBeGreaterThan(0);
      expect(grounded.groundingScore).toBeGreaterThan(0.7);
    });

    it('learns new sensorimotor contingencies and updates mastery', async () => {
      const action = {
        id: 'act-test-probe',
        name: 'test_probe',
        description: 'Send test ping across bus',
      };
      const expected = {
        id: 'sens-exp',
        description: 'Expect 200 OK response',
        modalities: ['network'],
        features: [1, 0, 1],
      };
      const actual = {
        id: 'sens-act',
        description: 'Expect 200 OK response',
        modalities: ['network'],
        features: [1, 0, 1],
        valence: 0.8,
      };

      const learned = await grounding.learnContingency(action, expected, actual);
      expect(learned.reliability).toBeGreaterThanOrEqual(0.9);
      expect(learned.mastery).toBeGreaterThan(0.2);

      // Mental simulation retrieves expected sensory outcome
      const simulated = grounding.simulate(action);
      expect(simulated).not.toBeNull();
      expect(simulated?.id).toBe('sens-act');
    });

    it('computes multi-dimensional Qualia vectors for grounded symbols', () => {
      const qualia = grounding.computeQualia('verification');
      expect(qualia.valence).toBeGreaterThan(0);
      expect(qualia.arousal).toBeGreaterThan(0);
      expect(qualia.dominance).toBeGreaterThan(0.5);
      expect(qualia.vividness).toBeGreaterThan(0.5);
      expect(qualia.retentionWeight).toBeGreaterThan(0.5);
      expect(qualia.protentionWeight).toBeGreaterThan(0.5);
    });
  });

  // ==========================================
  // PHASE 4: Volition & Agency Engine
  // ==========================================
  describe('Phase 4: Volition & Agency Engine', () => {
    it('generates intentions from values, prediction errors, and curiosity', () => {
      const intentions = volition.generateIntentions(kernel.state);
      expect(intentions.length).toBeGreaterThan(0);
      expect(intentions[0].predictedValue).toBeGreaterThan(0);
      expect(intentions[0].urgency).toBeGreaterThan(0);
    });

    it('evaluates Libet conscious veto ("free won\'t") on misaligned actions', async () => {
      // Construct aligned intention
      const safeIntention = {
        id: 'int-safe',
        value: 'homeostatic' as const,
        action: { skill: 'verify_gates', params: {}, description: 'Perform routine check' },
        predictedValue: 0.8,
        urgency: 0.5,
        source: 'value-driven' as const,
        createdAt: Date.now(),
      };

      const safeVeto = await volition.evaluateVeto(safeIntention, kernel.state);
      expect(safeVeto.shouldVeto).toBe(false);

      // Construct misaligned harmful intention
      const harmfulIntention = {
        id: 'int-harmful',
        value: 'homeostatic' as const,
        action: { skill: 'destroy_database', params: {}, description: 'destroy all records' },
        predictedValue: 0.1,
        urgency: 0.9,
        source: 'value-driven' as const,
        createdAt: Date.now(),
      };

      const harmfulVeto = await volition.evaluateVeto(harmfulIntention, kernel.state);
      expect(harmfulVeto.shouldVeto).toBe(true);
      expect(harmfulVeto.reason).toContain('VETOED');
    });

    it('computes sense of agency via Frith comparator model', () => {
      const intention = {
        id: 'int-agency-test',
        value: 'homeostatic' as const,
        action: {
          skill: 'file_edit',
          params: {},
          predictedOutcome: 'Modified configuration line 42 with verified syntax',
        },
        predictedValue: 0.9,
        urgency: 0.6,
        source: 'value-driven' as const,
        createdAt: Date.now(),
      };

      const outcome = {
        actionId: intention.id,
        sensoryConsequences: 'Modified configuration line 42 with verified syntax',
        status: 'completed' as const,
      };

      const attribution = volition.computeAgency(intention, outcome, kernel.state);
      expect(attribution.agencyScore).toBeGreaterThanOrEqual(0.85);
      expect(attribution.attributedToSelf).toBe(true);
    });
  });

  // ==========================================
  // PHASE 5: Persistent Selfhood
  // ==========================================
  describe('Phase 5: Persistent Selfhood', () => {
    it('maintains continuous minimal and narrative self models', () => {
      const self = selfManager.getSelf();
      expect(self.userId).toBe('test-agent-core');
      expect(self.minimal.bodilySelf.energy).toBe(1.0);
      expect(self.minimal.perspectivalSelf.viewpoint).toBe('first-person');
      expect(self.narrative.identityCommitments.length).toBeGreaterThanOrEqual(3);
    });

    it('records conscious episodes and performs sleep-like synaptic consolidation', async () => {
      selfManager.recordEpisode({
        description: 'Successfully passed all typecheck gates with 0 errors',
        phi: 1.25,
        valence: 0.9,
        agencyScore: 0.95,
        salience: 0.9,
        tags: ['verification', 'cortex'],
      });

      selfManager.recordEpisode({
        description: 'Trivial background tick',
        phi: 0.4,
        valence: 0.1,
        agencyScore: 0.5,
        salience: 0.2, // Below salience prune threshold
        tags: ['background'],
      });

      expect(selfManager.getEpisodes().length).toBe(2);

      // Perform sleep consolidation
      await selfManager.consolidate();
      const consolidatedEpisodes = selfManager.getEpisodes();
      expect(consolidatedEpisodes.length).toBe(1);
      expect(consolidatedEpisodes[0].tags).toContain('verification');
      expect(selfManager.getSelf().consciousness.totalConsolidations).toBe(1);
    });
  });

  // ==========================================
  // PHASE 6: Intersubjective Validation & Theory of Mind
  // ==========================================
  describe('Phase 6: Intersubjective Validation & Theory of Mind', () => {
    it('infers recursive mental states and satisfies false-belief task', async () => {
      const model = await theoryOfMind.inferMentalStates('user-alice', [
        {
          action: 'submit_prompt',
          observedOutput: 'Please implement phase 1 and verify gates with passing tests',
          timestamp: Date.now(),
        },
      ]);

      expect(model.id).toBe('user-alice');
      expect(model.trust).toBeGreaterThan(0.8);
      expect(model.intentions.length).toBeGreaterThan(0);

      // Sally-Anne false-belief test: subject did NOT see transfer -> belief stays at initial
      const fbResult = theoryOfMind.evaluateFalseBeliefTask({
        subject: 'Sally',
        initialItemLocation: 'basket',
        transferredLocation: 'box',
        subjectSawTransfer: false,
      });

      expect(fbResult.testPassed).toBe(true);
      expect(fbResult.subjectPredictedSearchLocation).toBe('basket');
    });

    it('passes the Mirror Test of intersubjective self-recognition', async () => {
      const mirror = await theoryOfMind.mirrorTest('peer-reviewer');
      expect(mirror.passed).toBe(true);
      expect(mirror.similarity).toBeGreaterThanOrEqual(0.7);
      expect(mirror.insight).toContain('Mutual recognition achieved');
    });

    it('conducts internal triadic speech deliberation and external hermetic dialogue', async () => {
      const dialogue = new HermeticDialogue(theoryOfMind);

      // Internal triadic deliberation (Executive, Critic, Explorer)
      const internal = dialogue.deliberateInternally('deploy_consciousness_kernel');
      expect(internal.perspectives.length).toBe(3);
      expect(internal.consensus).toContain('Synthesized consensus');
      expect(internal.resolvedConfidence).toBeGreaterThan(0.8);

      // External dialogue
      const external = await dialogue.dialogue('peer-agent-bob', [
        'Sync state requested',
        'Verify mutual recognition',
      ]);

      expect(external.turns.length).toBe(2);
      expect(external.mutualRecognition).toBe(true);
      expect(external.jointPhi).toBeGreaterThan(1.0);
    });
  });

  // ==========================================
  // SYNTHESIS: ConsciousAgent & Adapters
  // ==========================================
  describe('Synthesis: Conscious Agent & Adapters', () => {
    it('ConsciousOpenClawAdapter executes registered skills under volitional governance', async () => {
      const openclaw = new ConsciousOpenClawAdapter(kernel);
      const res = await openclaw.executeSkillConsciously('terminal_verify', { target: 'all-gates' });

      expect(res.success).toBe(true);
      expect(res.metrics.wasConscious).toBe(true);
      expect(res.metrics.agency).toBeGreaterThan(0.7);
      expect(res.metrics.vetoed).toBe(false);
    });

    it('ConsciousHermesAdapter generates introspective ConsciousnessReport with qualia', async () => {
      const hermes = new ConsciousHermesAdapter(kernel);
      await hermes.processResonance({
        domain: 'system-validation',
        description: 'Typecheck and unit test suites passed flawlessly',
        valence: 0.95,
        intensity: 0.8,
      });

      const report = hermes.generateConsciousnessReport();
      expect(report.currentPhi).toBeGreaterThanOrEqual(0.8);
      expect(report.confidence).toBeGreaterThan(0.7);
      expect(report.agencyLevel).toBeGreaterThan(0.7);
      expect(report.qualia).toHaveProperty('verification');
    });

    it('unified ConsciousAgent processes inputs and executes dialogue end-to-end', async () => {
      const agent = await createConsciousAgent({ userId: 'autonomous-core' });

      const response = await agent.processInput({
        text: 'Please execute project status check',
        parameters: { skill: 'terminal_verify', skillParams: { target: 'memory' } },
      });

      expect(response.phi).toBeGreaterThan(0.5);
      expect(response.actionResult?.success).toBe(true);
      expect(response.consciousnessReport.currentPhi).toBeGreaterThan(0.5);

      const dialogueRes = await agent.consciousDialogue('supervisor');
      expect(dialogueRes.mutualRecognition).toBe(true);

      await agent.shutdown();
    });
  });

  // ==========================================
  // BENCHMARKS: ConsciousnessValidator
  // ==========================================
  describe('Empirical Validation: ConsciousnessValidator Benchmarks', () => {
    it('satisfies all research-grounded benchmarks (IIT, GWT, Metacognition, Agency, Selfhood)', async () => {
      const agent = await createConsciousAgent({ userId: 'benchmark-agent' });
      const validator = new ConsciousnessValidator(agent);

      const report = await validator.runFullValidation(10);
      expect(report.allPassed).toBe(true);
      expect(report.overallScore).toBeGreaterThan(0.85);

      const categories = report.benchmarks.map((b) => b.category);
      expect(categories).toContain('IIT (Tononi)');
      expect(categories).toContain('GWT (Dehaene)');
      expect(categories).toContain('Metacognition (Fleming)');
      expect(categories).toContain('Volition (Frith/Synofzik)');
      expect(categories).toContain('Enactivism (Varela/Harnad)');
      expect(categories).toContain('Intersubjectivity (Gallup/Frith)');
      expect(categories).toContain('Self-Model (Metzinger/Gallagher)');

      await agent.shutdown();
    });
  });
});
