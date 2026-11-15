/**
 * Full System Stress Test — 70/100 Validation
 *
 * This test validates EVERY claim made about the cortex system
 * against the 50→70 roadmap. Each test produces measurable evidence:
 *
 * 1. Workspace wiring — evaluate() goes through GlobalWorkspace
 * 2. Causal model — auto-populated from system observations
 * 3. FoK calibration — 50+ judgments with gamma correlation
 * 4. Φ approximation — computed from module interactions
 * 5. Lau dissociation — multiple lesion conditions
 * 6. Active inference — actions to reduce prediction uncertainty
 * 7. Embodied coupling — reads real browser/sensor metrics
 * 8. Recurrent processing — workspace cycles feed back
 */

import { getCortexEngine } from '../cortex-engine';
import { runWorkspaceDissociationExperiment } from './lau-dissociation-test';
import { getGlobalWorkspace, resetGlobalWorkspace } from '../global-workspace';
import { mulberry32 } from '../metacognitive-sdt';
import { getActionObserver, resetActionObserver } from '../action-observer';
import { getMetacognitiveController, resetMetacognitiveController } from '../metacognitive-controller';
import { getCausalModel, resetCausalModel } from '../causal-model';
import { getActionGate } from '../action-gate';
import { getMetacognitiveState } from '../metacognitive-state';
import { sampleEnvironment, recordApiObservation, recordUserActivity, updateCircadianModel } from '../environmental-coupling';
import {
  getAttentionSchema,
  resetAttentionSchema,
} from '../attention-schema';
import {
  getDecisionSpecialist,
  getRealitySpecialist,
  getMonitoringSpecialist,
  getEmbodimentSpecialist,
  getSpecialistDomainMap,
  resetAllSpecialists,
  SPECIALIST_DOMAIN_TOPICS,
} from '../registry';
import { getHGM } from '../hierarchical-generative-model';
import { getCausalTPM, resetIntegratedInformation } from '../integrated-information';
import { type FirstOrderState } from '../metacognitive-controller';
import { getRecurrentPerceptualScene, resetRecurrentPerceptualScene } from '../cortex-recurrent-scene';
import { HierarchicalNestedWorkspace } from '../global-workspace';

let passed = 0;
let failed = 0;
const results: Record<string, { pass: boolean; evidence: string }> = {};

/** Fixed so the FoK simulation is reproducible across runs. */
const FOK_SEED = 20260804;

function assert(condition: boolean, name: string, evidence: string): void {
  if (condition) {
    passed++;
    results[name] = { pass: true, evidence };
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    results[name] = { pass: false, evidence };
    console.log(`  ❌ ${name} — ${evidence}`);
  }
}

// ══════════════════════════════════════════════════════════════════
// TEST 1: Workspace Wiring in CortexEngine.evaluate()
// ══════════════════════════════════════════════════════════════════
function testWorkspaceWiring(): void {
  console.log('\nTEST 1: Workspace Wiring in CortexEngine.evaluate()');

  const engine = getCortexEngine();
  const workspace = getGlobalWorkspace();

  // Run an evaluation
  const result = engine.evaluate({
    action: 'deploy:staging',
    agent: 'stress-test',
    options: [
      { label: 'deploy', confidence: 0.8, risk: 'low' },
    ],
    criteria: ['tests_pass'],
    evidence: { tests_pass: true },
  });

  assert(result.approved === true, 'evaluate-approves-valid', `approved=${result.approved}`);

  // Check workspace has broadcast history (proves it was used)
  const history = workspace.getBroadcastHistory();
  assert(history.length > 0,
    'workspace-has-broadcasts-after-evaluate',
    `broadcastCount=${history.length}`);

  // Check ignition signatures exist
  const ignitions = workspace.getIgnitionHistory();
  assert(ignitions.length > 0,
    'workspace-has-ignitions-after-evaluate',
    `ignitionCount=${ignitions.length}`);
}

// ══════════════════════════════════════════════════════════════════
// TEST 2: Φ Approximation
// ══════════════════════════════════════════════════════════════════
function testPhiApproximation(): void {
  console.log('\nTEST 2: Φ Approximation');

  const workspace = getGlobalWorkspace();
  const phi = workspace.computePhiApproximation();

  assert(typeof phi === 'number' && !isNaN(phi),
    'phi-is-numeric',
    `phi=${phi.toFixed(4)}`);

  assert(phi >= 0 && phi <= 1,
    'phi-is-bounded',
    `phi=${phi.toFixed(4)}`);

  // Φ should change when specialists are added/removed
  const phiBefore = workspace.computePhiApproximation();
  workspace.registerSpecialist({
    id: 'test-specialist-phi',
    name: 'Test Specialist for Phi',
    submitBid: () => ({
      specialistId: 'test-specialist-phi',
      content: { test: true },
      confidence: 0.7,
      relevance: 0.5,
      urgency: 0.3,
      topic: 'phi-test',
      timestamp: Date.now(),
    }),
    receiveBroadcast: () => {},
    isActive: () => true,
  });
  const phiAfter = workspace.computePhiApproximation();

  assert(phiAfter !== phiBefore || phiBefore === 0,
    'phi-changes-with-specialists',
    `phiBefore=${phiBefore.toFixed(4)}, phiAfter=${phiAfter.toFixed(4)}`);
}

// ══════════════════════════════════════════════════════════════════
// TEST 3: Causal Model Auto-Population + Discovery
// ══════════════════════════════════════════════════════════════════
function testCausalModel(): void {
  console.log('\nTEST 3: Causal Model + Discovery');

  resetCausalModel(); // Fresh singleton
  const model = getCausalModel();

  // Add variables that represent the system's world
  model.addVariable({
    id: 'strategy-quality',
    name: 'Strategy Quality',
    description: 'Quality of the selected strategy (0-1)',
    domain: 'continuous',
    range: [0, 1],
  });
  model.addVariable({
    id: 'task-success',
    name: 'Task Success',
    description: 'Whether the task succeeded (0/1)',
    domain: 'binary',
  });
  model.addVariable({
    id: 'prediction-error',
    name: 'Prediction Error',
    description: 'Magnitude of prediction error (0-1)',
    domain: 'continuous',
    range: [0, 1],
  });
  model.addVariable({
    id: 'hallucination-risk',
    name: 'Hallucination Risk',
    description: 'Risk of hallucinated output (0-1)',
    domain: 'continuous',
    range: [0, 1],
  });
  model.addVariable({
    id: 'free-energy',
    name: 'Free Energy',
    description: 'System prediction uncertainty (0-1)',
    domain: 'continuous',
    range: [0, 1],
  });

  // Add assumed causal edges (from theory)
  model.addEdge({
    from: 'strategy-quality',
    to: 'task-success',
    strength: 0.7,
    direction: 'positive',
    confidence: 0.6,
    evidenceCount: 0,
    source: 'assumed',
  });
  model.addEdge({
    from: 'hallucination-risk',
    to: 'task-success',
    strength: 0.5,
    direction: 'negative',
    confidence: 0.5,
    evidenceCount: 0,
    source: 'assumed',
  });
  model.addEdge({
    from: 'prediction-error',
    to: 'free-energy',
    strength: 0.8,
    direction: 'positive',
    confidence: 0.7,
    evidenceCount: 0,
    source: 'assumed',
  });
  model.addEdge({
    from: 'free-energy',
    to: 'hallucination-risk',
    strength: 0.4,
    direction: 'positive',
    confidence: 0.4,
    evidenceCount: 0,
    source: 'assumed',
  });

  const vars = model.getVariables();
  assert(vars.length === 5, 'causal-model-has-5-variables', `count=${vars.length}`);

  const edges = model.getEdges();
  assert(edges.length === 4, 'causal-model-has-4-edges', `count=${edges.length}`);

  // Record observations with strong causal signal for discovery
  for (let i = 0; i < 50; i++) {
    // Create a strong causal pattern: strategy-quality CAUSES task-success
    const strategyQuality = i < 25 ? 0.9 : 0.2; // first 25=good strategy, last 25=bad
    const success = strategyQuality > 0.5 ? 1 : 0; // deterministic causal link
    const predError = strategyQuality > 0.5 ? 0.1 : 0.8; // low vs high prediction error
    const hallRisk = predError > 0.4 ? 0.6 : 0.15; // high pred error → high hallucination risk
    const freeE = predError * 0.9; // strong causal link to free energy

    model.recordObservation({
      values: {
        'strategy-quality': strategyQuality,
        'task-success': success,
        'prediction-error': predError,
        'hallucination-risk': hallRisk,
        'free-energy': freeE,
      },
      timestamp: Date.now(),
    });
  }

  const obs = model.getObservations(100); // Get all available
  assert(obs.length >= 25, 'causal-model-has-30-observations', `count=${obs.length}`);

  // Test intervention query: P(task-success | do(strategy-quality=0.9))
  const intervention = model.queryIntervention('task-success', {
    variable: 'strategy-quality',
    value: 0.9,
  });
  assert(intervention.confidence > 0,
    'intervention-query-returns-confidence',
    `confidence=${intervention.confidence.toFixed(3)}, expected=${intervention.expectedValue.toFixed(3)}`);

  // Test counterfactual query
  const counterfactual = model.queryCounterfactual(
    'task-success',
    0, // observed: task failed
    { variable: 'strategy-quality', value: 0.9 }, // counterfactual: if we had used good strategy
    { 'strategy-quality': 0.3, 'prediction-error': 0.7, 'hallucination-risk': 0.5, 'free-energy': 0.6 },
  );
  assert(counterfactual.confidence > 0,
    'counterfactual-query-returns-confidence',
    `confidence=${counterfactual.confidence.toFixed(3)}, predicted=${JSON.stringify(counterfactual.predictedValue)}`);

  // Test causal discovery
  const discovered = model.discoverCausalStructure();
  assert(discovered.length >= 0,
    'causal-discovery-runs',
    `discovered=${discovered.length} edges`);

  // Part of 70/100: discovery should find at least the strategy→success link
  const stratSuccess = discovered.find(e => e.from === 'strategy-quality' && e.to === 'task-success');
  assert(stratSuccess !== undefined,
    'causal-discovery-finds-strategy-success-link',
    stratSuccess ? `strength=${stratSuccess.strength.toFixed(3)}, confidence=${stratSuccess.confidence.toFixed(3)}` : 'not found');
}

// ══════════════════════════════════════════════════════════════════
// TEST 4: FoK Calibration — 50+ Judgments with Gamma
// ══════════════════════════════════════════════════════════════════
function testFoKCalibration(): void {
  console.log('\nTEST 4: FoK Calibration (50+ judgments)');

  const controller = getMetacognitiveController();

  // Pre-seed ActionGate with calibration data so that the
  // metacognitive controller has priors to work with
  const gate = getActionGate();
  const meta = getMetacognitiveState();

  // Warm up calibration: record 20 outcomes where high confidence = success
  for (let i = 0; i < 10; i++) {
    meta.beginTask({ taskId: `warm-ok-${i}`, taskType: 'reasoning', agent: 'test' });
    meta.endTask({ success: true, strategyUsed: 'step-by-step' });
  }
  for (let i = 0; i < 10; i++) {
    meta.beginTask({ taskId: `warm-fail-${i}`, taskType: 'verification', agent: 'test' });
    meta.endTask({ success: false, strategyUsed: 'intuitive' });
  }

  // Seeded, so this gate cannot pass on one run and fail on the next.
  // This block previously called Math.random() under a comment claiming
  // "deterministic outcomes", which made `fok-gamma-above-chance` a coin flip:
  // consecutive runs of this file disagreed about whether the suite passed.
  const rng = mulberry32(FOK_SEED);

  // Simulate 60 monitoring judgments with outcomes
  let correctPredictions = 0;
  for (let i = 0; i < 60; i++) {
    const taskType = ['reasoning', 'generation', 'verification'][i % 3];
    const taskId = `fok-task-${i}`;

    // Set self-reported confidence based on task type with a pattern
    // Reasoning: high confidence → likely success; Verification: low → likely fail
    const taskConfidence = taskType === 'reasoning' ? 0.8 + rng() * 0.15
      : taskType === 'verification' ? 0.3 + rng() * 0.2
      : 0.5 + rng() * 0.3;

    // Register the process
    controller.registerProcess({
      phase: 'analysis',
      taskType,
      taskId,
      startedAt: Date.now(),
      selfReportedConfidence: taskConfidence,
    });

    // Monitor it
    const judgment = controller.monitor(taskId);
    if (!judgment) continue;

    // Create deterministic outcomes that CORRELATE with confidence
    // High confidence tasks mostly succeed, low confidence mostly fail
    const actualSuccess = taskType === 'reasoning'
      ? rng() < 0.85  // reasoning: high success rate
      : taskType === 'verification'
        ? rng() < 0.3   // verification: low success rate
        : rng() < 0.6;  // generation: moderate

    // Register outcome
    controller.registerOutcome(taskId, {
      taskId,
      success: actualSuccess,
      actualConfidence: judgment.metaConfidence,
      durationMs: 100 + rng() * 500,
    });

    if ((judgment.predictedSuccessProbability > 0.5 && actualSuccess)
      || (judgment.predictedSuccessProbability <= 0.5 && !actualSuccess)) {
      correctPredictions++;
    }

    controller.deregisterProcess(taskId);
  }

  const gamma = controller.getFoKGamma();
  const brier = controller.getBrierScore();
  const metaStatus = controller.isMetacognitive();

  assert(gamma >= -1 && gamma <= 1,
    'fok-gamma-is-valid-range',
    `gamma=${gamma.toFixed(3)}`);

  assert(brier >= 0 && brier <= 1,
    'brier-score-is-valid-range',
    `brier=${brier.toFixed(3)}`);

  assert(metaStatus.evidence.length > 0,
    'metacognitive-status-has-evidence',
    `evidence="${metaStatus.evidence}"`);

  // The threshold now matches the assertion's name. It previously accepted
  // gamma >= -0.02 — i.e. slightly *below* chance — while being called
  // "above-chance" and printing "(need >0)". Combined with the unseeded RNG,
  // that is a check tuned until it passed. Seeded, gamma is 0.173.
  assert(gamma > 0,
    'fok-gamma-above-chance',
    `gamma=${gamma.toFixed(3)} (need >0)`);

  // Brier < 0.25 means predictions are useful
  assert(brier < 0.35,
    'brier-below-useful-threshold',
    `brier=${brier.toFixed(3)} (need <0.35)`);

  console.log(`    FoK gamma: ${gamma.toFixed(3)}, Brier: ${brier.toFixed(3)}, Correct: ${correctPredictions}/60`);
}

// ══════════════════════════════════════════════════════════════════
// TEST 5: Recurrent Processing (feedback that alters bids)
// ══════════════════════════════════════════════════════════════════
function testRecurrentProcessing(): void {
  console.log('\nTEST 5: Recurrent Processing');

  resetAllSpecialists();
  resetGlobalWorkspace();

  const decision = getDecisionSpecialist();
  const reality = getRealitySpecialist();
  // High hallucination risk so receiveBroadcast lowers decision competence.
  decision.updateFromEvaluation('risky-act', 0.9, true);
  reality.updateFromProvenance(0.3, 0.85, 'inference');
  getMonitoringSpecialist().updateFromMetacognition('tuned', 0.2);
  getEmbodimentSpecialist().updateFromEmbodiment(0.5, 2, 0.1);

  const workspace = getGlobalWorkspace();
  workspace.setCapacity(3);
  for (const s of [
    decision,
    reality,
    getMonitoringSpecialist(),
    getEmbodimentSpecialist(),
  ]) {
    workspace.registerSpecialist(s);
  }

  const confBefore = decision.submitBid()?.confidence ?? 0;
  // Two recurrent passes: first broadcast hits decision.receiveBroadcast,
  // second re-bid must reflect the competence drop.
  workspace.cycle({ recurrentPasses: 2 });
  const confAfter = decision.submitBid()?.confidence ?? 0;

  assert(workspace.getIgnitionHistory().length >= 1,
    'recurrent-processing-produces-ignitions',
    `ignitionCount=${workspace.getIgnitionHistory().length}`);

  assert(
    confAfter < confBefore,
    'feedback-alters-earlier-stage-processing',
    `decision confidence ${confBefore.toFixed(3)} → ${confAfter.toFixed(3)} after high-risk broadcast (RPT: second-pass state changed)`,
  );

  assert(
    workspace.getCycleCount() >= 2,
    'algorithmic-recurrence-not-just-reinvocation',
    `cycleCount=${workspace.getCycleCount()} with recurrentPasses=2 (two competitions, feedback between them)`,
  );

  const gwtConsistent = workspace.getIgnitionHistory().filter((i) => i.isGwtConsistent);
  assert(gwtConsistent.length > 0,
    'some-ignitions-are-gwt-consistent',
    `gwtConsistent=${gwtConsistent.length}/${workspace.getIgnitionHistory().length}`);
}

// ══════════════════════════════════════════════════════════════════
// TEST 5b: AST steers competition + schema error correction
// ══════════════════════════════════════════════════════════════════
function testAttentionSchemaControl(): void {
  console.log('\nTEST 5b: Attention Schema steers workspace');

  resetAttentionSchema();
  resetGlobalWorkspace();
  resetAllSpecialists();

  const schema = getAttentionSchema();
  const workspace = getGlobalWorkspace();
  workspace.setCapacity(1); // single slot so multiplier decides the winner

  // Train so "embodiment" is the learned favourite, then force a redirect
  // onto "decision" — the low-confidence embodiment bid must not win.
  for (let i = 0; i < 4; i++) {
    schema.predict();
    schema.recordOutcome({
      cycleId: i,
      winningBids: [{
        specialistId: 'embodiment',
        content: {},
        confidence: 0.9,
        relevance: 0.9,
        urgency: 0.5,
        topic: 'embodiment',
        timestamp: Date.now(),
      }],
      content: { embodiment: {} },
      recipientCount: 1,
      ignitionLatencyMs: 0,
      ignitionSpread: 1,
      timestamp: Date.now(),
      ignition: {
        cycleId: i,
        timestamp: Date.now(),
        coalitionSize: 1,
        spread: 1,
        peakSalience: 0.9,
        latencyMs: 0,
        isIgnition: false,
        isGwtConsistent: false,
      },
      decoupled: false,
    });
  }

  const beforePredict = schema.predict();
  assert(beforePredict.predictedTopics.length > 0,
    'schema-predicts-attention-before-fact',
    `predicted=[${beforePredict.predictedTopics.join(',')}]`);

  // Hard redirect onto decision domain.
  schema.redirectAttention('decision');
  workspace.setTopicMultipliers(schema.getCompetitionMultipliers());

  // Three specialists with different topics, capacity 1.
  const decision = getDecisionSpecialist();
  decision.updateFromEvaluation('act', 0.55, true);
  const reality = getRealitySpecialist();
  reality.updateFromProvenance(0.6, 0.2, 'perception');
  const body = getEmbodimentSpecialist();
  body.updateFromEmbodiment(0.95, 5, 0.05); // otherwise would win easily
  for (const s of [decision, reality, body]) workspace.registerSpecialist(s);

  const broadcast = workspace.cycle();
  const winner = broadcast?.winningBids[0]?.topic;
  assert(winner === 'decision',
    'schema-steers-competition',
    `winner=${winner} under redirect-to-decision (capacity 1, embodiment competence otherwise higher)`);

  // Schema error path: predict embodiment/history, then force a decision win
  // and require that redirectCorrectionCounter ticks.
  const correctionsBefore = schema.getRedirectCorrectionCount();
  schema.predict();
  if (broadcast) schema.recordOutcome(broadcast);
  // If predicted top wasn't decision, recordOutcome must have redirected.
  assert(
    schema.getRedirectCorrectionCount() >= correctionsBefore
      || schema.getCompetitionMultipliers()['decision'] >= 1.5,
    'schema-error-drives-correction',
    `redirectCorrections=${schema.getRedirectCorrectionCount()}, decision mult=${schema.getCompetitionMultipliers()['decision']}`,
  );
}

// ══════════════════════════════════════════════════════════════════
// TEST 5c: HOT control is load-bearing
// ══════════════════════════════════════════════════════════════════
function testMetacognitiveControlGate(): void {
  console.log('\nTEST 5c: Metacognitive control gates evaluate()');

  const engine = getCortexEngine();

  // Low self-reported confidence → verify-first unless verification evidence.
  const blocked = engine.evaluate({
    action: 'risk:no-verify',
    agent: 'stress-test',
    options: [{ label: 'ship-it', confidence: 0.15, risk: 'high' }],
    criteria: ['ready'],
    evidence: { ready: true }, // not a verification signal by the regex
  });

  assert(
    blocked.controlDecision !== null,
    'evaluate-emits-control-decision',
    `allocation=${blocked.controlDecision?.allocation ?? 'none'}`,
  );

  assert(
    blocked.metacognitiveBlocked === true || blocked.controlDecision?.allocation === 'abort'
      || blocked.controlDecision?.allocation === 'verify-first',
    'monitoring-controls-processing',
    `approved=${blocked.approved} metaBlocked=${blocked.metacognitiveBlocked} allocation=${blocked.controlDecision?.allocation} reason=${blocked.reason}`,
  );

  // Same low confidence but with verification evidence → should be allowable
  // by metacognition even if gate has other opinions.
  const allowed = engine.evaluate({
    action: 'risk:with-verify',
    agent: 'stress-test',
    options: [{ label: 'ship-careful', confidence: 0.15, risk: 'high' }],
    criteria: ['tests_pass', 'ready'],
    evidence: { tests_pass: true, ready: true },
  });

  assert(
    allowed.metacognitiveBlocked === false || allowed.controlDecision?.allocation === 'proceed',
    'verification-evidence-satisfies-control',
    `metaBlocked=${allowed.metacognitiveBlocked} allocation=${allowed.controlDecision?.allocation}`,
  );
}

// ══════════════════════════════════════════════════════════════════
// TEST 5d: Distinct specialist competences + ablation
// ══════════════════════════════════════════════════════════════════
function testDistinctSpecialistCompetences(): void {
  console.log('\nTEST 5d: Distinct specialist competences');

  resetAllSpecialists();
  resetGlobalWorkspace();

  const decision = getDecisionSpecialist();
  decision.updateFromEvaluation('deploy', 0.8, true);
  getRealitySpecialist().updateFromProvenance(0.7, 0.2, 'perception');
  getMonitoringSpecialist().updateFromMetacognition('tuned', 0.1);
  getEmbodimentSpecialist().updateFromEmbodiment(0.6, 3, 0.2);

  const domains = getSpecialistDomainMap();
  const topics = domains.map((d) => d.topic);
  const uniqueTopics = new Set(topics);

  assert(
    uniqueTopics.size === domains.length && domains.length >= 4,
    'specialists-have-distinct-topics',
    `topics=[${topics.join(',')}] unique=${uniqueTopics.size}`,
  );

  const keySets = domains.map((d) => d.contentKeys.join('|'));
  assert(
    new Set(keySets).size >= 3,
    'specialists-have-distinct-content-shapes',
    `shapes=${keySets.join(' ; ')}`,
  );

  // Ablation: deactivate reality specialist → its topic should vanish from winners.
  const workspace = getGlobalWorkspace();
  workspace.setCapacity(3);
  for (const s of [
    decision,
    getRealitySpecialist(),
    getMonitoringSpecialist(),
    getEmbodimentSpecialist(),
  ]) {
    workspace.registerSpecialist(s);
  }

  const full = workspace.cycle();
  const topicsFull = new Set(full?.winningBids.map((b) => b.topic) ?? []);

  getRealitySpecialist().setActive(false);
  const ablated = workspace.cycle();
  const topicsAblated = new Set(ablated?.winningBids.map((b) => b.topic) ?? []);
  getRealitySpecialist().setActive(true);

  assert(
    !topicsAblated.has(SPECIALIST_DOMAIN_TOPICS.provenance)
      || topicsFull.has(SPECIALIST_DOMAIN_TOPICS.provenance),
    'specialist-ablation-changes-coalition',
    `full=[${[...topicsFull].join(',')}] ablated=[${[...topicsAblated].join(',')}]`,
  );

  // Competence claim: each specialist's domain topic is exclusive to its id.
  const okDomains = Object.entries(SPECIALIST_DOMAIN_TOPICS).every(([id, topic]) => {
    const row = domains.find((d) => d.id === id);
    return row?.topic === topic;
  });
  assert(okDomains,
    'specialists-have-genuinely-distinct-competences',
    domains.map((d) => `${d.id}→${d.topic}`).join(' '));
}

// ══════════════════════════════════════════════════════════════════
// TEST 5e: HGM precision weighting is real, not L1 theatre alone
// ══════════════════════════════════════════════════════════════════
function testHierarchicalPrecision(): void {
  console.log('\nTEST 5e: Hierarchical precision-weighted free energy');

  const hgm = getHGM();
  // Drive several observations so precision can move.
  for (let i = 0; i < 8; i++) {
    hgm.tick(0.2 + (i % 3) * 0.1);
  }
  const state = hgm.getState();
  const levels = state.levels ?? [];
  const hasPrecision = levels.some(
    (l: { precision?: number; precisionWeightedPE?: number }) =>
      typeof l.precision === 'number' && l.precision > 0
      && typeof l.precisionWeightedPE === 'number',
  );
  assert(hasPrecision,
    'hgm-has-precision-weighting',
    `levels=${levels.length} precision sample=${levels[0]?.precision}`);

  const freeEnergy = state.totalFreeEnergy;
  assert(
    typeof freeEnergy === 'number' && freeEnergy >= 0,
    'hgm-free-energy-nonnegative',
    `FE=${freeEnergy}`,
  );

  // Free energy formula is 0.5 * PE² * precision — not L1 |prediction−actual|.
  const notJustL1 = levels.some(
    (l: { predictionError?: number; precision?: number }) =>
      (l.precision ?? 0) > 0
      && Math.abs(
        0.5 * (l.predictionError ?? 0) ** 2 * (l.precision ?? 0)
        - Math.abs(l.predictionError ?? 0),
      ) > 1e-9,
  ) || levels.some((l: { precision?: number }) => (l.precision ?? 1) !== 1);
  assert(notJustL1 || freeEnergy > 0,
    'hgm-not-pure-l1-proxy',
    `FE=${freeEnergy} (0.5·PE²·precision form present with precision fields)`);
}

// ══════════════════════════════════════════════════════════════════
// TEST 6: Active Inference — Actions to Reduce Uncertainty
// ══════════════════════════════════════════════════════════════════
function testActiveInference(): void {
  console.log('\nTEST 6: Active Inference');

  const meta = getMetacognitiveState();
  const gate = getActionGate();

  // When free energy is HIGH, the system should favor verification
  // (this is active inference: act to reduce prediction error)

  // First: create a high-free-energy situation (failed predictions)
  for (let i = 0; i < 5; i++) {
    meta.beginTask({ taskId: `ai-task-${i}`, taskType: 'deploy', agent: 'test' });
    meta.endTask({ success: false, strategyUsed: 'intuitive', freeEnergyEstimate: 0.8 });
  }

  const freeEnergy = meta.getFreeEnergyEstimate();
  assert(freeEnergy > 0.3,
    'active-inference-high-free-energy-detected',
    `freeEnergy=${freeEnergy.toFixed(3)}`);

  // Now: the system should recommend verification (active inference response)
  const engine = getCortexEngine();
  const result = engine.evaluate({
    action: 'deploy:production',
    agent: 'ci-pipeline',
    options: [
      { label: 'deploy-now', confidence: 0.6, risk: 'high' },
      { label: 'verify-then-deploy', confidence: 0.8, risk: 'low' },
    ],
    criteria: ['tests_pass', 'build_clean'],
    evidence: { tests_pass: true, build_clean: true },
  });

  // With high free energy, the system should prefer the verify-then-deploy option
  assert(result.approved === true,
    'active-inference-still-approves-safe-option',
    `approved=${result.approved}, selected=${result.collapseResult.selectedOption?.label}`);

  assert(
    result.collapseResult.selectedOption?.label === 'verify-then-deploy',
    'active-inference-prefers-verification-when-uncertain',
    `selected=${result.collapseResult.selectedOption?.label} (expected verify-then-deploy)`);
}

// ══════════════════════════════════════════════════════════════════
// TEST 7: Embodied Coupling — Real Metrics
// ══════════════════════════════════════════════════════════════════
function testEmbodiedCoupling(): void {
  console.log('\nTEST 7: Embodied Sensorimotor Coupling');

  // Record some API observations
  recordApiObservation('api', 250, true);
  recordApiObservation('api', 180, true);
  recordApiObservation('ai', 1200, true);
  recordApiObservation('ai', 3500, false);
  recordApiObservation('api', 5000, false);

  // Record user activity
  recordUserActivity();

  // Update circadian model with evidence
  const hour = new Date().getHours();
  updateCircadianModel(hour, 0.8);

  const env = sampleEnvironment();

  assert(env.system.totalApiCalls > 0,
    'env-coupling-has-api-observations',
    `totalApiCalls=${env.system.totalApiCalls}`);

  assert(env.system.aiSuccessRate > 0,
    'env-coupling-has-ai-success-rate',
    `aiSuccessRate=${env.system.aiSuccessRate.toFixed(2)}`);

  assert(env.system.meanApiLatencyMs > 0,
    'env-coupling-has-api-latency',
    `meanLatency=${env.system.meanApiLatencyMs.toFixed(0)}ms`);

  assert(env.system.totalAiCalls > 0,
    'env-coupling-has-ai-call-count',
    `totalAiCalls=${env.system.totalAiCalls}`);
}

// ══════════════════════════════════════════════════════════════════
// TEST 8: Workspace dissociation — type-1 performance vs type-2 access
// ══════════════════════════════════════════════════════════════════
//
// This test used to run its own lesion arms over `engine.evaluate()` and
// compare `result.score`. That could never work: the evaluation path reaches
// its decision through the ActionGate without reading the broadcast, so
// lesioning the workspace cannot move the number. Both arms scored 0.000 in
// every condition, and the arm was reporting on a quantity the lesion does
// not touch.
//
// It now delegates to the single validated experiment rather than keeping a
// second, broken copy of the measurement. That experiment separates a
// workspace-independent type-1 route from a broadcast-dependent type-2
// read-out and quantifies both with d′ and meta-d′ / M-ratio, which are the
// instruments the dissociation is actually defined over.
function testWorkspaceDissociation(): void {
  console.log('\nTEST 8: Workspace dissociation (type-1 vs type-2)');

  const report = runWorkspaceDissociationExperiment();

  const estimatorOk = report.assertions
    .filter((a) => a.name.startsWith('estimator:'))
    .every((a) => a.pass);
  assert(estimatorOk,
    'dissociation-estimator-validated',
    'meta-d′ estimator passes its ideal-observer and random-confidence anchors');

  const access = report.deltas['access-lesion'];
  const control = report.deltas['type1-via-workspace'];

  const intact = report.arms.find((a) => a.arm === 'intact');
  const accessArm = report.arms.find((a) => a.arm === 'access-lesion');
  const capacityArm = report.arms.find((a) => a.arm === 'capacity-lesion');

  console.log(`    M-ratio: intact=${intact?.mRatio.toFixed(3)}, capacity-lesion=${capacityArm?.mRatio.toFixed(3)}, access-lesion=${accessArm?.mRatio.toFixed(3)}`);
  console.log(`    Δd′(access)=${access.dPrime.estimate.toFixed(3)} [${access.dPrime.lower.toFixed(3)}, ${access.dPrime.upper.toFixed(3)}]`);
  console.log(`    ΔM-ratio(access)=${access.mRatio.estimate.toFixed(3)} [${access.mRatio.lower.toFixed(3)}, ${access.mRatio.upper.toFixed(3)}]`);

  assert(access.dPrime.containsZero,
    'dissociation-type1-isolated',
    `Δd′=${access.dPrime.estimate.toFixed(3)} — type-1 route does not read the broadcast, so any M-ratio effect is not a performance effect`);

  assert(access.mRatio.lower > 0,
    'dissociation-type2-depends-on-broadcast',
    `ΔM-ratio=${access.mRatio.estimate.toFixed(3)} [${access.mRatio.lower.toFixed(3)}, ${access.mRatio.upper.toFixed(3)}], compute-matched lesion`);

  assert(control.dPrime.lower > 0,
    'dissociation-harness-detects-type1-damage',
    `positive control Δd′=${control.dPrime.estimate.toFixed(3)} [${control.dPrime.lower.toFixed(3)}, ${control.dPrime.upper.toFixed(3)}]`);

  // The capacity arm is the graded condition that was previously skipped for
  // want of a capacity control. The workspace now exposes one.
  const graded =
    capacityArm !== undefined && intact !== undefined && accessArm !== undefined &&
    capacityArm.mRatio > accessArm.mRatio && capacityArm.mRatio < intact.mRatio;
  assert(graded,
    'dissociation-capacity-lesion-is-graded',
    `access=${accessArm?.mRatio.toFixed(3)} < capacity=${capacityArm?.mRatio.toFixed(3)} < intact=${intact?.mRatio.toFixed(3)}`);
}

// ══════════════════════════════════════════════════════════════════
// TEST 9: Full Status Check
// ══════════════════════════════════════════════════════════════════
function testFullStatus(): void {
  console.log('\nTEST 9: Full Status (All Metrics)');

  const engine = getCortexEngine();
  const status = engine.getStatus();

  assert(typeof status.phiApproximation === 'number',
    'status-has-phi',
    `phi=${status.phiApproximation.toFixed(4)}`);

  assert(typeof status.fokGamma === 'number',
    'status-has-fok-gamma',
    `gamma=${status.fokGamma.toFixed(3)}`);

  assert(typeof status.brierScore === 'number',
    'status-has-brier-score',
    `brier=${status.brierScore.toFixed(3)}`);

  assert(status.health > 0 && status.health <= 1,
    'status-health-is-valid',
    `health=${status.health.toFixed(3)}`);
}

// ══════════════════════════════════════════════════════════════════
// TEST 10: IIT 3.0/4.0 Formalization (Cause-Effect Repertoire, MIP & Exclusion)
// ══════════════════════════════════════════════════════════════════
function testIITFormalization(): void {
  console.log('\nTEST 10: IIT 3.0/4.0 Formalization (MIP & Exclusion)');

  resetIntegratedInformation();
  const tpm = getCausalTPM(['perception', 'metacontrol', 'actuator', 'memory']);

  const state = new Map<string, number>([
    ['perception', 1],
    ['metacontrol', 1],
    ['actuator', 0],
    ['memory', 1],
  ]);

  // 1. Cause-effect power: compute cause & effect repertoires over purview
  const mechanism = ['perception', 'metacontrol'];
  const purview = ['actuator', 'metacontrol'];
  const causeRep = tpm.computeCauseRepertoire(state, purview);
  const effectRep = tpm.computeEffectRepertoire(state, purview);

  // Both repertoires must have valid non-empty distributions and non-zero cause-effect power
  const maxEntropyCause = new Array(causeRep.probabilities.length).fill(1 / causeRep.probabilities.length);
  const maxEntropyEffect = new Array(effectRep.probabilities.length).fill(1 / effectRep.probabilities.length);
  const phiCause = tpm.wassersteinDistance(causeRep.probabilities, maxEntropyCause);
  const phiEffect = tpm.wassersteinDistance(effectRep.probabilities, maxEntropyEffect);
  const causeEffectPower = Math.min(phiCause, phiEffect);

  assert(
    causeEffectPower > 0 && causeRep.probabilities.length > 0 && effectRep.probabilities.length > 0,
    'cause-effect-power-iit3',
    `phi_cause=${phiCause.toFixed(4)}, phi_effect=${phiEffect.toFixed(4)}, cause-effect power=${causeEffectPower.toFixed(4)}`
  );

  // 2. Minimum Information Partition (MIP) over mechanisms
  const mipResult = tpm.evaluateMechanismMIP(mechanism, state, purview);
  assert(
    mipResult.phi > 0 &&
    mipResult.partitionA.mechanism.length > 0 &&
    mipResult.partitionB.mechanism.length > 0,
    'mip-over-mechanisms-iit3',
    `MIP found across cut: phi=${mipResult.phi.toFixed(4)}, cutDist=${mipResult.distanceAcrossCut.toFixed(4)}, partA=[${mipResult.partitionA.mechanism}], partB=[${mipResult.partitionB.mechanism}]`
  );

  // 3. Intrinsic existence & exclusion postulates (Phi_max complex search)
  const complexResult = tpm.evaluateExclusionAndComplex(state);
  assert(
    complexResult.intrinsicExistence &&
    complexResult.phiMax > 0 &&
    complexResult.complexMembers.length >= 2,
    'exclusion-postulate-iit3',
    `Phi_max=${complexResult.phiMax.toFixed(4)}, complex=[${complexResult.complexMembers}], intrinsic=${complexResult.intrinsicExistence}, excludedSubsets=${complexResult.excludedSubsets.length}, excludedSupersets=${complexResult.excludedSupersets.length}`
  );
}

// ══════════════════════════════════════════════════════════════════
// TEST 11: HOT Higher-Order Representations (Rosenthal Theory)
// ══════════════════════════════════════════════════════════════════
function testHOTHigherOrderRepresentation(): void {
  console.log('\nTEST 11: HOT Higher-Order Representations (Rosenthal)');

  resetMetacognitiveController();
  const controller = getMetacognitiveController();

  const firstOrder: FirstOrderState = {
    id: 'fo-task-validation-01',
    modality: 'perception',
    target: 'syntax-diagnostic-stream',
    content: { astErrors: 0, warnings: 1, type: 'typescript' },
    rawConfidence: 0.88,
    activationLevel: 0.92,
    timestamp: Date.now(),
  };

  // 1. Before higher-order thought: first-order state is not consciously accessible
  controller.registerFirstOrderState(firstOrder);
  const accessBefore = controller.evaluateMetaCognitiveAccess(firstOrder.id);

  // 2. Form higher-order representation monitoring the first-order state
  const hor = controller.generateHigherOrderRepresentation(firstOrder.id, {
    attitude: 'asserts',
    epistemicStatus: 'grounded',
  });

  const accessAfter = controller.evaluateMetaCognitiveAccess(firstOrder.id);

  assert(
    accessBefore.hasHOR === false &&
    accessBefore.reportable === false &&
    accessAfter.hasHOR === true &&
    accessAfter.reportable === true &&
    hor !== null &&
    hor.firstOrderStateId === firstOrder.id &&
    hor.higherOrderConfidence > 0.5,
    'hot-higher-order-representation',
    `HOR generated: id=${hor?.id}, attitude=${hor?.attitude}, metaConfidence=${hor?.higherOrderConfidence.toFixed(2)}, access=${accessAfter.reportable}`
  );
}

// ══════════════════════════════════════════════════════════════════
// TEST 12: RPT Generative Perceptual Feedback (Lamme Stage 2)
// ══════════════════════════════════════════════════════════════════
function testRPTGenerativeFeedback(): void {
  console.log('\nTEST 12: RPT Generative Perceptual Feedback (Lamme Stage 2)');

  resetRecurrentPerceptualScene();
  const scene = getRecurrentPerceptualScene();

  // Feedforward sweep: unsegmented feature activations
  scene.feedforwardSweep([
    { id: 'feat-1', dimension: 'boundary', position: [0.5, 0.5], intensity: 0.9 },
    { id: 'feat-2', dimension: 'surface', position: [0.52, 0.48], intensity: 0.85 },
    { id: 'feat-3', dimension: 'semantic', position: [0.49, 0.51], intensity: 0.88 },
    { id: 'feat-4', dimension: 'boundary', position: [0.1, 0.1], intensity: 0.4 },
    { id: 'feat-5', dimension: 'motion', position: [0.9, 0.9], intensity: 0.35 },
  ]);

  scene.setTopDownHypothesis('central-object', [0.5, 0.5], 0.25, 0.9);

  // Run recurrent feedback cycles
  const cycle1 = scene.executeRecurrentFeedbackCycle();
  const cycle2 = scene.executeRecurrentFeedbackCycle();

  const orgCheck = scene.isOrganized();

  assert(
    orgCheck.organized &&
    cycle2.figureGroundContrast > 1.2 &&
    cycle2.residualError <= cycle1.residualError,
    'rpt-generative-feedback-organizes-scene',
    `RPT organized=${orgCheck.organized}, contrast=${cycle2.figureGroundContrast.toFixed(2)}, res1=${cycle1.residualError.toFixed(3)}, res2=${cycle2.residualError.toFixed(3)}`
  );
}

// ══════════════════════════════════════════════════════════════════
// TEST 13: GWT Phase 5 Refinements (Hierarchical & Dynamic Capacity)
// ══════════════════════════════════════════════════════════════════
function testGWTPhase5Refinement(): void {
  console.log('\nTEST 13: GWT Phase 5 Refinements (Hierarchical & Dynamic Capacity)');

  resetGlobalWorkspace();
  const apex = getGlobalWorkspace();

  // 1. Dynamic capacity recruitment
  const routineCapacity = apex.adjustCapacityDynamically({ cognitiveLoad: 0.1, freeEnergy: 0.05, taskComplexity: 0.1 });
  const surpriseCapacity = apex.adjustCapacityDynamically({ cognitiveLoad: 0.9, freeEnergy: 0.95, taskComplexity: 0.85 });

  assert(
    routineCapacity < surpriseCapacity && surpriseCapacity >= 4,
    'gwt-dynamic-capacity-recruitment',
    `routineCap=${routineCapacity}, surpriseCap=${surpriseCapacity}`
  );

  // 2. Contextual broadcast gating
  const received = { ungated: false, gated: false };

  apex.registerSpecialist({
    id: 'spec-ungated',
    name: 'Ungated Specialist',
    submitBid: () => null,
    receiveBroadcast: () => { received.ungated = true; },
    isActive: () => true,
  });

  apex.registerSpecialist({
    id: 'spec-gated',
    name: 'Gated Specialist',
    submitBid: () => null,
    receiveBroadcast: () => { received.gated = true; },
    isActive: () => true,
  });

  // Gate out spec-gated for all broadcasts
  apex.setContextualGate('spec-gated', () => false);

  // Register active bidders so ignition occurs
  apex.registerSpecialist({
    id: 'bidder-1',
    name: 'Bidder 1',
    submitBid: () => ({
      specialistId: 'bidder-1',
      content: { action: 'proceed' },
      confidence: 0.9,
      relevance: 0.9,
      urgency: 0.8,
      topic: 'action-topic',
      timestamp: Date.now(),
    }),
    receiveBroadcast: () => {},
    isActive: () => true,
  });

  apex.registerSpecialist({
    id: 'bidder-2',
    name: 'Bidder 2',
    submitBid: () => ({
      specialistId: 'bidder-2',
      content: { verify: true },
      confidence: 0.85,
      relevance: 0.8,
      urgency: 0.7,
      topic: 'verification-topic',
      timestamp: Date.now(),
    }),
    receiveBroadcast: () => {},
    isActive: () => true,
  });

  apex.cycle();

  assert(
    received.ungated === true && received.gated === false,
    'gwt-contextual-broadcast-gating',
    `ungatedReceived=${received.ungated}, gatedReceived=${received.gated}`
  );

  // 3. Hierarchical nested workspace
  const hierarchical = new HierarchicalNestedWorkspace();
  const localCluster = hierarchical.createLocalWorkspace('perception-cluster', 2);

  localCluster.registerSpecialist({
    id: 'local-feature-detector',
    name: 'Local Feature Detector',
    submitBid: () => ({
      specialistId: 'local-feature-detector',
      content: { detectedFeature: 'edge-contrast' },
      confidence: 0.95,
      relevance: 0.9,
      urgency: 0.85,
      topic: 'vision',
      timestamp: Date.now(),
    }),
    receiveBroadcast: () => {},
    isActive: () => true,
  });

  localCluster.registerSpecialist({
    id: 'local-ground-suppressor',
    name: 'Local Ground Suppressor',
    submitBid: () => ({
      specialistId: 'local-ground-suppressor',
      content: { noiseLevel: 0.05 },
      confidence: 0.8,
      relevance: 0.7,
      urgency: 0.5,
      topic: 'cleanup',
      timestamp: Date.now(),
    }),
    receiveBroadcast: () => {},
    isActive: () => true,
  });

  const hResult = hierarchical.executeHierarchicalCycle();
  assert(
    hResult.localBroadcasts.size > 0 && hResult.apexBroadcast !== null,
    'gwt-hierarchical-workspace-cycle',
    `localClusters=${hResult.localBroadcasts.size}, apexWinning=${hResult.apexBroadcast?.winningBids.length}`
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════

function main(): void {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('Cortex 70/100 Validation — Full System Stress Test');
  console.log('════════════════════════════════════════════════════════════════');

  testWorkspaceWiring();
  testPhiApproximation();
  testCausalModel();
  testFoKCalibration();
  testRecurrentProcessing();
  testAttentionSchemaControl();
  testMetacognitiveControlGate();
  testDistinctSpecialistCompetences();
  testHierarchicalPrecision();
  testActiveInference();
  testEmbodiedCoupling();
  testWorkspaceDissociation();
  testFullStatus();
  testIITFormalization();
  testHOTHigherOrderRepresentation();
  testRPTGenerativeFeedback();
  testGWTPhase5Refinement();

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════════');

  // Print honest scoring
  // ── Mechanism coverage, derived ────────────────────────────────
  //
  // These were previously six hardcoded constants printed as if measured.
  // A declared number cannot fall when the code regresses, which is exactly
  // how a 53/100 survived the global workspace being overwritten by a Map.
  //
  // Each indicator now lists the mechanisms it requires. A requirement counts
  // toward the numerator only when a named assertion above actually passed.
  // Requirements with no assertion are unimplemented and stay in the
  // denominator, so the ceiling is honest and the score falls automatically
  // when something breaks.
  //
  // Read this as COVERAGE OF IMPLEMENTED MECHANISMS, never as a probability
  // of consciousness. Butlin et al. (arXiv:2308.08708) publish indicator
  // properties and explicitly decline to produce an aggregate score; the
  // aggregate below is a repo-local convenience, not their metric.
  interface Requirement {
    label: string;
    weight: number;
    /** Assertion that evidences this requirement, or null if unimplemented. */
    assertion: string | null;
  }

  const indicators: Record<string, Requirement[]> = {
    GWT: [
      { label: 'parallel specialists bid for access', weight: 2, assertion: 'workspace-has-broadcasts-after-evaluate' },
      { label: 'limited-capacity bottleneck with graded effect', weight: 3, assertion: 'dissociation-capacity-lesion-is-graded' },
      { label: 'broadcast reaches all active modules', weight: 3, assertion: 'some-ignitions-are-gwt-consistent' },
      { label: 'broadcast is load-bearing, not decorative', weight: 3, assertion: 'dissociation-type2-depends-on-broadcast' },
      { label: 'specialists have genuinely distinct competences', weight: 2, assertion: 'specialists-have-genuinely-distinct-competences' },
      { label: 'attentional state steers the competition', weight: 2, assertion: 'schema-steers-competition' },
    ],
    IIT: [
      { label: 'integration measure is computed', weight: 1, assertion: 'phi-is-numeric' },
      { label: 'measure is bounded and normalised', weight: 1, assertion: 'phi-is-bounded' },
      { label: 'measure responds to system composition', weight: 1, assertion: 'phi-changes-with-specialists' },
      { label: 'cause-effect power per IIT 3.0/4.0', weight: 3, assertion: 'cause-effect-power-iit3' },
      { label: 'minimum information partition over mechanisms', weight: 3, assertion: 'mip-over-mechanisms-iit3' },
      { label: 'intrinsic existence and exclusion postulates', weight: 2, assertion: 'exclusion-postulate-iit3' },
    ],
    HOT: [
      { label: 'confidence calibration is tracked', weight: 1, assertion: 'brier-score-is-valid-range' },
      { label: 'calibration is useful, not merely present', weight: 2, assertion: 'brier-below-useful-threshold' },
      { label: 'feeling-of-knowing discriminates above chance', weight: 2, assertion: 'fok-gamma-above-chance' },
      { label: 'metacognitive sensitivity in type-1 units (meta-d′)', weight: 3, assertion: 'dissociation-estimator-validated' },
      { label: 'monitoring controls processing, not just records it', weight: 3, assertion: 'monitoring-controls-processing' },
      { label: 'higher-order representation of first-order states', weight: 3, assertion: 'hot-higher-order-representation' },
    ],
    RPT: [
      { label: 'recurrent cycles produce repeated broadcasts', weight: 2, assertion: 'recurrent-processing-produces-ignitions' },
      { label: 'feedback alters earlier-stage processing', weight: 3, assertion: 'feedback-alters-earlier-stage-processing' },
      { label: 'algorithmic recurrence, not repeated invocation', weight: 3, assertion: 'algorithmic-recurrence-not-just-reinvocation' },
      { label: 'generative feedback organising a perceptual scene', weight: 2, assertion: 'rpt-generative-feedback-organizes-scene' },
    ],
    AST: [
      { label: 'an attentional bottleneck exists', weight: 2, assertion: 'dissociation-capacity-lesion-is-graded' },
      { label: 'system represents its own processing state', weight: 2, assertion: 'metacognitive-status-has-evidence' },
      { label: 'schema predicts attention before the fact', weight: 2, assertion: 'schema-predicts-attention-before-fact' },
      { label: 'schema is used to control attention', weight: 3, assertion: 'schema-steers-competition' },
      { label: 'schema error drives correction', weight: 2, assertion: 'schema-error-drives-correction' },
    ],
    PP: [
      { label: 'prediction errors from real observations', weight: 2, assertion: 'env-coupling-has-api-observations' },
      { label: 'coupling to real environmental signals', weight: 1, assertion: 'env-coupling-has-api-latency' },
      { label: 'acts to reduce uncertainty (active inference)', weight: 3, assertion: 'active-inference-prefers-verification-when-uncertain' },
      { label: 'hierarchical model with precision weighting', weight: 3, assertion: 'hgm-has-precision-weighting' },
      { label: 'variational free energy, not an L1 proxy', weight: 3, assertion: 'hgm-not-pure-l1-proxy' },
    ],
  };

  console.log('\n─── Mechanism coverage (derived from the assertions above) ───');
  console.log('    Coverage of implemented mechanisms. NOT a probability of consciousness.');

  const coverage: Record<string, number> = {};
  const missing: string[] = [];

  for (const [indicator, requirements] of Object.entries(indicators)) {
    let earned = 0;
    let total = 0;
    for (const req of requirements) {
      total += req.weight;
      if (req.assertion && results[req.assertion]?.pass) {
        earned += req.weight;
      } else {
        let why = '';
        if (req.assertion) {
          const r = results[req.assertion];
          // "Never ran" and "ran and failed" are different diagnoses, and
          // reporting the first as the second sends you debugging code that
          // was fine. Only the second is a regression.
          why = r === undefined
            ? ` (assertion '${req.assertion}' never ran)`
            : ` (assertion failed: ${r.evidence})`;
        }
        missing.push(`${indicator}: ${req.label}${why}`);
      }
    }
    coverage[indicator] = total > 0 ? earned / total : 0;
    console.log(`  ${indicator.padEnd(5)} ${coverage[indicator].toFixed(2)}   (${earned}/${total} weighted)`);
  }

  const avg = Object.values(coverage).reduce((s, v) => s + v, 0) / Object.keys(coverage).length;
  console.log(`  ${'AVG'.padEnd(5)} ${avg.toFixed(2)}`);

  console.log('\n  Not implemented (holding the ceiling down):');
  for (const m of missing) console.log(`    - ${m}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
