/**
 * Full System Validation — All 6 New Modules + Rewired CortexEngine
 *
 * Tests:
 * 1. Hierarchical Generative Model — multi-level predictions + free energy
 * 2. True Φ Computation — mutual information + partition analysis
 * 3. Persistent Specialist Modules — continuous state + learning
 * 4. Attention Schema — prediction + accuracy + redirect
 * 5. FoK gamma > 0.3 — 200+ judgments with improved model
 * 6. Structural Equation Model — OLS fitting + intervention + counterfactual
 * 7. Full CortexEngine wiring — all new modules integrated
 * 8. Production build verification
 */

// Reset all singletons for clean test
import { resetGlobalWorkspace, getGlobalWorkspace } from '../global-workspace';
import { resetActionObserver } from '../action-observer';
import { resetMetacognitiveController } from '../metacognitive-controller';
import { resetCausalModel } from '../causal-model';
import { resetIntegratedInformation } from '../integrated-information';
import { resetAttentionSchema } from '../attention-schema';
import { resetStructuralEquationModel } from '../structural-equation-model';
import { resetAllSpecialists, getDecisionSpecialist, getRealitySpecialist, getMonitoringSpecialist, getEmbodimentSpecialist } from '../registry';

import { getHGM } from '../hierarchical-generative-model';
import { getIntegratedInformation } from '../integrated-information';
import { getAttentionSchema } from '../attention-schema';
import { getStructuralEquationModel, type StructuralEquation } from '../structural-equation-model';
import { getMetacognitiveController } from '../metacognitive-controller';
import { getCortexEngine } from '../cortex-engine';
import { mulberry32 } from '../metacognitive-sdt';
import { getActionGate } from '../action-gate';
import { getMetacognitiveState } from '../metacognitive-state';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail = ''): void {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ── TEST 1: Hierarchical Generative Model ──────────────────────────

function testHGM(): void {
  console.log('\nTEST 1: Hierarchical Generative Model');
  const hgm = getHGM();

  // Feed it observations with a trend
  for (let i = 0; i < 100; i++) {
    const observation = 0.5 + Math.sin(i * 0.1) * 0.3 + Math.random() * 0.05;
    hgm.tick(observation);
  }

  const state = hgm.getState();
  assert(state !== undefined, 'hgm-returns-state');
  assert(hgm.getTickCount() === 100, 'hgm-has-100-ticks', `count=${hgm.getTickCount()}`);

  // Test predictive capability
  const predictive = hgm.isPredictive();
  assert(typeof predictive.value === 'boolean', 'hgm-is-predictive-valid');
  assert(typeof predictive.rmse === 'number', 'hgm-rmse-is-numeric');
  assert(predictive.rmse >= 0, 'hgm-rmse-non-negative', `rmse=${predictive.rmse.toFixed(4)}`);

  // Key test: hierarchical model should produce different free energy at each level
  const totalFE = hgm.getTotalFreeEnergy();
  assert(totalFE >= 0, 'hgm-total-free-energy-valid', `fe=${totalFE.toFixed(4)}`);

  const dominant = hgm.getDominantErrorLevel();
  assert(dominant.level >= 0 && dominant.level <= 3,
    'hgm-dominant-error-level-valid',
    `level=${dominant.level}, name=${dominant.name}`);

  // Prediction confidence should be trackable
  const confidence = hgm.getConfidence();
  assert(confidence >= 0 && confidence <= 1,
    'hgm-confidence-in-range',
    `conf=${confidence.toFixed(3)}`);
}

// ── TEST 2: True Φ Computation ──────────────────────────────────────

function testPhi(): void {
  console.log('\nTEST 2: True Φ Computation');
  resetIntegratedInformation();
  const phi = getIntegratedInformation();

  // Record correlated samples across modules (simulating integrated system)
  for (let i = 0; i < 100; i++) {
    const baseSignal = Math.sin(i * 0.1); // Shared signal → creates integration
    phi.recordSample('action-gate', 0.5 + baseSignal * 0.3 + Math.random() * 0.05);
    phi.recordSample('provenance', 0.5 + baseSignal * 0.25 + Math.random() * 0.05);
    phi.recordSample('metacognition', 0.5 + baseSignal * 0.2 + Math.random() * 0.05);
    phi.recordSample('free-energy', 0.5 - baseSignal * 0.2 + Math.random() * 0.05);
    phi.recordSample('embodiment', 0.5 + baseSignal * 0.15 + Math.random() * 0.05);
  }

  const result = phi.compute();
  assert(result.phi >= 0, 'phi-is-non-negative', `phi=${result.phi.toFixed(4)}`);
  assert(result.moduleCount === 5, 'phi-has-5-modules', `count=${result.moduleCount}`);
  assert(result.sampleCount >= 50, 'phi-has-sufficient-samples', `count=${result.sampleCount}`);
  assert(result.confidence > 0, 'phi-has-confidence', `conf=${result.confidence.toFixed(3)}`);

  // Key test: Φ with correlated modules should be > 0
  assert(result.phi > 0.001,
    'phi-integrated-modules-positive',
    `phi=${result.phi.toFixed(4)} (correlated signals should produce Φ > 0)`);

  // MIP should identify a partition
  assert(result.minimumInformationPartition.partitionA.length > 0,
    'phi-mip-has-partition-a');

  // Per-module entropies
  const entropyKeys = Object.keys(result.moduleEntropies);
  assert(entropyKeys.length === 5, 'phi-has-per-module-entropies', `count=${entropyKeys.length}`);

  // Now test with INDEPENDENT modules — Φ should be lower
  resetIntegratedInformation();
  const phiIndep = getIntegratedInformation();

  for (let i = 0; i < 100; i++) {
    phiIndep.recordSample('module-a', Math.random()); // Independent
    phiIndep.recordSample('module-b', Math.random()); // Independent
    phiIndep.recordSample('module-c', Math.random()); // Independent
  }

  const indepResult = phiIndep.compute();
  assert(indepResult.phi < result.phi,
    'phi-independent-lower-than-correlated',
    `independent=${indepResult.phi.toFixed(4)}, correlated=${result.phi.toFixed(4)}`);
}

// ── TEST 3: Persistent Specialist Modules ───────────────────────────

function testPersistentSpecialists(): void {
  console.log('\nTEST 3: Persistent Specialist Modules');
  resetAllSpecialists();

  const decisionSpec = getDecisionSpecialist();
  const realitySpec = getRealitySpecialist();
  const monitoringSpec = getMonitoringSpecialist();
  const embodimentSpec = getEmbodimentSpecialist();

  // Feed them data over multiple rounds
  for (let round = 0; round < 10; round++) {
    decisionSpec.updateFromEvaluation(`action-${round}`, 0.5 + round * 0.05, round > 5);
    realitySpec.updateFromProvenance(0.7 + round * 0.02, 0.3 - round * 0.02, 'inference');
    monitoringSpec.updateFromMetacognition(round > 7 ? 'drifting' : 'tuned', 0.3 - round * 0.02);
    embodimentSpec.updateFromEmbodiment(0.5 + round * 0.04, round + 1, 0.2);
  }

  // Check internal state persistence
  decisionSpec.submitBid(); // Generate a bid to increment totalBids
  const decisionState = decisionSpec.getInternalState();
  assert(decisionState.totalBids > 0, 'decision-specialist-has-bids');
  assert(decisionState.competenceScore !== 0.5, // Should have changed from default
    'decision-specialist-competence-evolved',
    `competence=${decisionState.competenceScore.toFixed(3)}`);

  // Submit bid should reflect learned state
  const decisionBid = decisionSpec.submitBid();
  assert(decisionBid !== null, 'decision-specialist-produces-bid');
  assert(decisionBid!.confidence > 0, 'decision-bid-has-confidence');

  // Reality specialist should learn from broadcasts
  const realityBid = realitySpec.submitBid();
  assert(realityBid !== null, 'reality-specialist-produces-bid');
  assert(realityBid!.content !== null, 'reality-bid-has-content');

  // Monitoring specialist
  const monitoringBid = monitoringSpec.submitBid();
  assert(monitoringBid !== null, 'monitoring-specialist-produces-bid');

  // Embodiment specialist
  const embodimentBid = embodimentSpec.submitBid();
  assert(embodimentBid !== null, 'embodiment-specialist-produces-bid');
  const embContent = embodimentBid!.content as { masteryScore: number };
  assert(embContent.masteryScore > 0.5,
    'embodiment-reflects-trained-mastery',
    `mastery=${embContent.masteryScore.toFixed(2)}`);

  // Actually run the workspace with these specialists.
  //
  // This suite previously imported `resetGlobalWorkspace` and never called it,
  // so it passed 50/50 while the global workspace was a keyed Map missing five
  // exports. A suite that stays green by not touching the subsystem is worse
  // than a failing one, because it certifies the breakage.
  resetGlobalWorkspace();
  const workspace = getGlobalWorkspace();
  workspace.setCapacity(3);
  for (const specialist of [decisionSpec, realitySpec, monitoringSpec, embodimentSpec]) {
    workspace.registerSpecialist(specialist);
  }

  assert(workspace.getSpecialists().length === 4,
    'workspace-registers-all-specialists',
    `registered=${workspace.getSpecialists().length}`);

  const broadcasts = [];
  for (let cycle = 0; cycle < 5; cycle++) {
    const b = workspace.cycle();
    if (b) broadcasts.push(b);
  }

  assert(broadcasts.length > 0,
    'workspace-broadcasts-when-cycled',
    `broadcasts=${broadcasts.length}/5 cycles`);

  const respectedCapacity = broadcasts.every((b) => b.winningBids.length <= 3);
  assert(respectedCapacity,
    'workspace-respects-capacity-bottleneck',
    `max coalition=${Math.max(...broadcasts.map((b) => b.winningBids.length))} with 4 bidders, capacity 3`);

  assert(broadcasts.every((b) => b.recipientCount === 4),
    'workspace-broadcasts-to-all-specialists',
    `recipients=${broadcasts[0]?.recipientCount}`);

  const received = decisionSpec.getInternalState().totalBroadcastsReceived;
  assert(received > 0,
    'specialists-receive-broadcasts',
    `decision specialist received ${received}`);

  const phi = workspace.computePhiApproximation();
  assert(phi > 0 && phi <= 1,
    'workspace-integration-proxy-in-range',
    `participation-weighted proxy=${phi.toFixed(3)} (not IIT Φ)`);
}

// ── TEST 4: Attention Schema ────────────────────────────────────────

function testAttentionSchema(): void {
  console.log('\nTEST 4: Attention Schema');
  resetAttentionSchema();
  const schema = getAttentionSchema();

  // Simulate multiple workspace outcomes (need 3+ distinct topics for redirect capability)
  for (let round = 0; round < 20; round++) {
    // Predict
    const prediction = schema.predict();

    // Simulate outcome with 3+ topics for canRedirectAttention check
    const topics = ['deploy', 'risk-assessment', 'embodiment'];
    const dominantTopic = topics[round % 3];
    const mockBroadcast = {
      id: `bc-${round}`,
      winningBids: [{
        specialistId: 'decision',
        content: { action: dominantTopic },
        confidence: 0.7 + round * 0.01,
        relevance: 0.8,
        urgency: 0.5,
        topic: dominantTopic,
        timestamp: Date.now(),
      }],
      content: {},
      recipientCount: 4,
      ignitionLatencyMs: 5,
      ignitionSpread: 4,
      timestamp: Date.now(),
    };

    schema.recordOutcome(mockBroadcast as any);
  }

  // Check attention schema state
  const state = schema.getState();
  assert(state.totalPredictions > 0, 'attention-has-predictions');
  assert(state.currentFocus !== null, 'attention-has-current-focus', `focus=${state.currentFocus}`);
  assert(state.breadth > 0, 'attention-has-breadth', `breadth=${state.breadth}`);
  assert(typeof state.schemaAccuracy === 'number',
    'attention-schema-accuracy-is-numeric');

  // Test attention redirect
  const multipliers = schema.redirectAttention('emergency');
  assert(multipliers['emergency'] === 2.0,
    'attention-redirect-boosts-target');
  assert(state.canRedirectAttention === true,
    'attention-can-redirect');

  // Topic weights should reflect learning
  const weights = schema.getTopicWeights();
  assert(Object.keys(weights).length > 0,
    'attention-has-learned-topic-weights',
    `topics=${Object.keys(weights).join(',')}`);
}

// ── TEST 5: FoK gamma > 0.3 ────────────────────────────────────────

function testFoKGammaHigh(): void {
  console.log('\nTEST 5: FoK gamma > 0.3 (200+ judgments)');
  resetMetacognitiveController();
  const controller = getMetacognitiveController();
  const gate = getActionGate();
  const meta = getMetacognitiveState();

  // Generate 200+ calibrated judgments with a deterministic pattern
  // The key: make FoK predictions correlate with outcomes
  // by giving clear signal that the controller can learn from
  const rng = mulberry32(20260804);
  for (let i = 0; i < 220; i++) {
    const taskId = `fok-task-${i}`;

    // Two types of tasks: "easy" (high confidence → success) and "hard" (low confidence → failure)
    const isEasyTask = i % 3 !== 2; // 2/3 easy, 1/3 hard

    const selfConfidence = isEasyTask ? 0.85 : 0.3;

    controller.registerProcess({
      phase: 'analysis',
      taskType: isEasyTask ? 'easy' : 'hard',
      taskId,
      startedAt: Date.now(),
      selfReportedConfidence: selfConfidence,
    });

    const judgment = controller.monitor(taskId);
    if (judgment) {
      const control = controller.control(judgment);

      // Outcome based on task type — easy tasks usually succeed, hard usually fail
      // This creates the correlation that makes FoK predictions accurate
      const success = isEasyTask ? rng() > 0.05 : rng() > 0.9;

      controller.registerOutcome(taskId, {
        taskId,
        success,
        actualConfidence: success ? 0.8 : 0.3,
        durationMs: 100 + rng() * 500,
      });

      // Also train the metacognitive state
      meta.beginTask({ taskId, taskType: isEasyTask ? 'easy' : 'hard', agent: 'test' });
      meta.endTask({ success, strategyUsed: isEasyTask ? 'step-by-step' : 'intuitive' });
    }

    controller.deregisterProcess(taskId);
  }

  const gamma = controller.getFoKGamma();
  const brier = controller.getBrierScore();
  const metaStatus = controller.isMetacognitive();

  assert(gamma > 0.3,
    'fok-gamma-above-0.3',
    `gamma=${gamma.toFixed(3)}`);
  assert(brier < 0.25,
    'brier-below-random',
    `brier=${brier.toFixed(3)}`);
  assert(metaStatus.value === true,
    'system-is-metacognitive',
    `evidence="${metaStatus.evidence}"`);

  console.log(`  FoK gamma: ${gamma.toFixed(3)}, Brier: ${brier.toFixed(3)}`);
}

// ── TEST 6: Structural Equation Model ───────────────────────────────

function testSEM(): void {
  console.log('\nTEST 6: Structural Equation Model');
  resetStructuralEquationModel();
  const sem = getStructuralEquationModel();

  // Add structural equations with known relationships
  // strategyQuality → taskSuccess (β=0.7)
  // strategyQuality → predictionError (β=-0.5)
  // predictionError → hallucinationRisk (β=0.6)
  // hallucinationRisk → freeEnergy (β=0.4)
  sem.addEquation({
    variable: 'task-success',
    alpha: 0.1,
    coefficients: { 'strategy-quality': 0.7 },
    exogenousMean: 0,
    exogenousVariance: 0.05,
    active: true,
  });
  sem.addEquation({
    variable: 'prediction-error',
    alpha: 0.3,
    coefficients: { 'strategy-quality': -0.5 },
    exogenousMean: 0,
    exogenousVariance: 0.05,
    active: true,
  });
  sem.addEquation({
    variable: 'hallucination-risk',
    alpha: 0.15,
    coefficients: { 'prediction-error': 0.6 },
    exogenousMean: 0,
    exogenousVariance: 0.05,
    active: true,
  });
  sem.addEquation({
    variable: 'free-energy',
    alpha: 0.05,
    coefficients: { 'hallucination-risk': 0.4 },
    exogenousMean: 0,
    exogenousVariance: 0.05,
    active: true,
  });

  // Record 100 observations from the true structural equations
  for (let i = 0; i < 100; i++) {
    const strategyQuality = i < 50 ? 0.9 : 0.2;
    const taskSuccess = 0.1 + 0.7 * strategyQuality + (Math.random() - 0.5) * 0.1;
    const predictionError = 0.3 + (-0.5) * strategyQuality + (Math.random() - 0.5) * 0.1;
    const hallucinationRisk = 0.15 + 0.6 * predictionError + (Math.random() - 0.5) * 0.05;
    const freeEnergy = 0.05 + 0.4 * hallucinationRisk + (Math.random() - 0.5) * 0.05;

    sem.recordObservation({
      values: {
        'strategy-quality': strategyQuality,
        'task-success': taskSuccess,
        'prediction-error': predictionError,
        'hallucination-risk': hallucinationRisk,
        'free-energy': freeEnergy,
      },
      timestamp: Date.now(),
    });
  }

  assert(sem.getObservationCount() === 100,
    'sem-has-100-observations',
    `count=${sem.getObservationCount()}`);

  // Fit the model from observations
  const fit = sem.fitFromObservations();
  assert(fit.nObservations === 100, 'sem-fit-uses-all-data');
  // R² for task-success (which has strong β=0.7) should be high
  assert((fit.rSquared['task-success'] ?? 0) > 0.5,
    'sem-task-success-high-r2',
    `R²=${(fit.rSquared['task-success'] ?? 0).toFixed(3)}`);

  // Intervention query: do(strategy-quality=0.9)
  const intervention = sem.queryIntervention('strategy-quality', 0.9);
  const taskSuccessAt90 = intervention.predictedValues['task-success'] ?? 0;
  const interventionLow = sem.queryIntervention('strategy-quality', 0.2);
  const taskSuccessAt20 = interventionLow.predictedValues['task-success'] ?? 0;
  assert(taskSuccessAt90 > taskSuccessAt20,
    'sem-intervention-high-strategy-higher-success',
    `at 0.9: ${taskSuccessAt90.toFixed(3)}, at 0.2: ${taskSuccessAt20.toFixed(3)}`);

  // Counterfactual query: observed bad strategy, what if good?
  const observed = {
    'strategy-quality': 0.2,
    'task-success': 0.25,
    'prediction-error': 0.7,
    'hallucination-risk': 0.5,
    'free-energy': 0.3,
  };
  const counterfactual = sem.queryCounterfactual(observed, 'strategy-quality', 0.9);
  assert(counterfactual.counterfactualValues['task-success'] !== undefined,
    'sem-counterfactual-has-result');
  assert((counterfactual.counterfactualValues['task-success'] ?? 0) > observed['task-success'],
    'sem-counterfactual-better-than-observed',
    `observed=${observed['task-success']}, counterfactual=${counterfactual.counterfactualValues['task-success']?.toFixed(3)}`);
  assert(Object.keys(counterfactual.inferredU).length > 0,
    'sem-counterfactual-has-inferred-U');
}

// ── TEST 7: Full CortexEngine Wiring ────────────────────────────────

function testFullWiring(): void {
  console.log('\nTEST 7: Full CortexEngine Wiring');
  const engine = getCortexEngine();

  // Run evaluate() which should now exercise all 6 new modules
  const result = engine.evaluate({
    action: 'deploy:production',
    agent: 'test-agent',
    options: [
      { label: 'conservative', confidence: 0.9, risk: 'low' },
      { label: 'aggressive', confidence: 0.6, risk: 'high' },
    ],
    criteria: ['tests_pass'],
    evidence: { tests_pass: true },
  });

  assert(result.approved === true, 'engine-approves-valid-action');
  assert(result.score > 0, 'engine-returns-score');

  // Check that all new modules have been exercised
  const status = engine.getStatus();
  assert(typeof status.phiApproximation === 'number',
    'status-has-phi-approximately',
    `phi=${status.phiApproximation}`);
  assert(typeof status.phiConfidence === 'number',
    'status-has-phi-confidence');
  assert(typeof status.fokGamma === 'number',
    'status-has-fok-gamma');
  assert(typeof status.brierScore === 'number',
    'status-has-brier-score');
  assert(typeof status.attentionSchemaAccuracy === 'number',
    'status-has-attention-schema-accuracy');
  assert(status.attentionFocus !== undefined,
    'status-has-attention-focus');
}

// ── MAIN ────────────────────────────────────────────────────────────

function main(): void {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('Full System Validation — 6 New Modules + Rewired CortexEngine');
  console.log('════════════════════════════════════════════════════════════════');

  testHGM();
  testPhi();
  testPersistentSpecialists();
  testAttentionSchema();
  testFoKGammaHigh();
  testSEM();
  testFullWiring();

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════════');

  // No score is printed here on purpose.
  //
  // This file used to declare six constants (GWT 0.65 … AVG 0.53) and print
  // them as measurements. They could not fall when the code regressed, and
  // they did not: the average survived the global workspace being overwritten
  // by a keyed Map, because this suite never touched the workspace.
  //
  // Mechanism coverage is now derived from assertions in exactly one place:
  //   npx tsx src/lib/__tests__/cortex-70-validation.ts
  // Two suites printing two different scores for the same system is how the
  // contradiction went unnoticed for months, so this one no longer competes.
  console.log('\n--- Scoring ---');
  console.log('  Not scored here. Mechanism coverage is derived from assertions in');
  console.log('  cortex-70-validation.ts. Butlin et al. (arXiv:2308.08708) publish');
  console.log('  indicator properties and decline to aggregate them; any aggregate');
  console.log('  is repo-local and must be derived, never declared.');

  if (failed > 0) {
    console.log(`\n⚠️  ${failed} tests FAILED — see details above`);
    // A suite that reports failures and exits 0 cannot gate anything: `npm run verify:cortex`
    // and any CI step would treat a red run as success.
    process.exitCode = 1;
  } else {
    console.log('\n✅ ALL TESTS PASSED');
  }
}

main();
