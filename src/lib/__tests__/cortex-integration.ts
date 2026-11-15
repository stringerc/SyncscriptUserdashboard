/**
 * Cortex Integration Tests — Proves the modules actually work together
 *
 * This is NOT a "proof of consciousness" — it's proof of engineering.
 * Each test verifies that data flows correctly through the pipeline.
 *
 * Run: npx tsx src/lib/__tests__/cortex-integration.ts
 */

// localStorage polyfill for Node.js test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (_index: number) => null,
  } as any;
}

import { getActionGate } from '../action-gate';
import { getSemanticGrid, resetSemanticGrid } from '../semantic-grid';
import { getMetacognitiveState } from '../metacognitive-state';
import { getProvenanceValidator } from '../epistemic-provenance';
import { getSensorimotorLoop } from '../sensorimotor-loop';
import { getIdentityPersistence } from '../identity-anchor';
import { getGlobalWorkspace } from '../global-workspace';
import { synthesizeIdentity } from '../narrative-synthesis';
import { getVetoLedger } from '../veto-ledger';
import { getCortexNudgeEngine } from '../cortex-nudge-engine';

// ── Test harness ──────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, label: string): void {
  const ok = Math.abs(actual - expected) <= tolerance;
  assert(ok, label, `expected ~${expected}, got ${actual.toFixed(4)}`);
}

function resetGrid(): void {
  resetSemanticGrid();
}

// Helper: get a ActionValidationResult for use in sensorimotor tests
function makeActionValidationResult(approved: boolean, score: number) {
  return {
    action: 'test-action',
    agent: 'test-agent',
    approved,
    selectedOption: approved ? { label: 'test-opt', confidence: score, risk: 'low' as const } : null,
    rejectedOptions: [],
    validationScore: score,
    failedCriteria: [],
    reason: approved ? 'TEST' : 'TEST REJECT',
  };
}

// ═══════════════════════════════════════════════════════════════════
// TEST 1: ActionGate — decision validation with calibration
// ═══════════════════════════════════════════════════════════════════

function testActionGate(): void {
  const gate = getActionGate();

  // 1a. Approve a high-confidence, low-risk option with all criteria met
  const result1 = gate.evaluate({
    action: 'deploy:preview',
    agent: 'test-agent',
    options: [
      { label: 'safe-deploy', confidence: 0.9, risk: 'low' },
      { label: 'risky-deploy', confidence: 0.5, risk: 'high' },
    ],
    criteria: ['tests_pass', 'build_clean'],
    verified: { tests_pass: true, build_clean: true },
  });
  assert(result1.approved, 'ActionGate approves valid deploy');
  assert(result1.selectedOption?.label === 'safe-deploy', 'ActionGate selects safest option');

  // 1b. Reject when criteria are unmet
  const result2 = gate.evaluate({
    action: 'deploy:production',
    agent: 'test-agent',
    options: [{ label: 'deploy', confidence: 0.95, risk: 'medium' }],
    criteria: ['tests_pass', 'build_clean'],
    verified: { tests_pass: true, build_clean: false },
  });
  assert(!result2.approved, 'ActionGate rejects when build fails');
  assert(result2.failedCriteria.includes('build_clean'), 'Reports which criteria failed');

  // 1c. Record outcomes and verify calibration
  gate.recordOutcome(result1, true);
  gate.recordOutcome(result2, false);

  for (let i = 0; i < 10; i++) {
    const r = gate.evaluate({
      action: 'test-action', agent: 'test',
      options: [{ label: 'opt', confidence: 0.8, risk: 'low' }],
      criteria: ['c1'], verified: { c1: true },
    });
    gate.recordOutcome(r, i < 7);
  }

  const calibration = gate.getConfidenceCalibration();
  assert(calibration > 0, 'Calibration detects overconfidence');
  assert(calibration < 0.3, 'Calibration is within reasonable range');

  // 1d. Calibration curve has data
  const curve = gate.getCalibrationCurve();
  assert(curve.length > 0, 'Calibration curve returns data');
  assert(curve.some(b => b.samples > 0), 'Calibration curve has populated buckets');
}

// ═══════════════════════════════════════════════════════════════════
// TEST 2: SemanticGrid — signal interference + meta-awareness
// ═══════════════════════════════════════════════════════════════════

function testSemanticGrid(): void {
  resetGrid();
  const grid = getSemanticGrid();

  grid.postSignal({
    agentId: 'a1', topic: 'deploy', content: 'conservative is correct',
    confidence: 0.8, timestamp: Date.now(), tags: ['deploy'],
  });
  grid.postSignal({
    agentId: 'a2', topic: 'deploy', content: 'yes conservative is correct',
    confidence: 0.85, timestamp: Date.now(), tags: ['deploy'],
  });

  const result = grid.collapse('deploy');
  assert(result.interference === 'constructive', 'Agreement → constructive interference');
  assert(result.winningSignal !== null, 'Constructive collapse produces winner');
  assert(result.coherenceScore > 0.5, 'Constructive coherence score is high');

  grid.postSignal({
    agentId: 'a3', topic: 'risk', content: 'this is unsafe and should not proceed',
    confidence: 0.9, timestamp: Date.now(), tags: ['risk'],
  });
  grid.postSignal({
    agentId: 'a4', topic: 'risk', content: 'this is safe and should proceed immediately',
    confidence: 0.7, timestamp: Date.now(), tags: ['risk'],
  });

  const result2 = grid.collapse('risk');
  assert(result2.interference === 'destructive', 'Contradiction → destructive interference');
  assert(result2.coherenceScore < 0.5, 'Destructive coherence score is low');

  const metaAwareness = grid.getMetaAwarenessStatus();
  assert(['tuned', 'drifting', 'decoupled'].includes(metaAwareness.status),
    'Meta-awareness returns valid status');
  assert(metaAwareness.score >= 0 && metaAwareness.score <= 1,
    'Meta-awareness score is in [0,1]');
}

// ═══════════════════════════════════════════════════════════════════
// TEST 3: MetacognitiveState — task tracking + free energy
// ═══════════════════════════════════════════════════════════════════

function testMetacognitiveState(): void {
  const meta = getMetacognitiveState();

  meta.beginTask({ taskId: 't-int-1', taskType: 'analysis', agent: 'test' });
  const outcome = meta.endTask({ success: true, strategyUsed: 'step-by-step' });
  assert(outcome.success, 'MetacognitiveState records successful outcome');

  const freeEnergy = meta.getFreeEnergyEstimate();
  assert(freeEnergy >= 0, 'Free energy estimate is non-negative');

  const status = meta.getMetaAwarenessStatus();
  assert(['tuned', 'drifting', 'decoupled'].includes(status),
    'Meta-awareness status is valid');

  const snapshot = meta.getSnapshot();
  assert(snapshot.regulation.planning !== undefined, 'Snapshot has planning');
  assert(snapshot.knowledge.self !== undefined, 'Snapshot has self-knowledge');
  assert(typeof snapshot.summary.overallMetacognitiveHealth === 'number',
    'Snapshot has numeric health score');
}

// ═══════════════════════════════════════════════════════════════════
// TEST 4: Epistemic Provenance — reality scoring
// ═══════════════════════════════════════════════════════════════════

function testEpistemicProvenance(): void {
  const validator = getProvenanceValidator();

  const perceptionScore = validator.computeRealityScore({
    epistemicTag: 'perception',
    provenance: {
      nodes: [{ id: 'n1', sourceType: 'perception', content: 'Build passed',
                confidence: 0.95, timestamp: Date.now() }],
      rootSourceType: 'perception', depth: 0, groundingScore: 1.0,
      verificationStatus: 'verified',
    },
  });

  const generationScore = validator.computeRealityScore({
    epistemicTag: 'generation',
    provenance: {
      nodes: [{ id: 'n2', sourceType: 'generation', content: 'I think...',
                confidence: 0.5, timestamp: Date.now() }],
      rootSourceType: 'generation', depth: 3, groundingScore: 0.1,
      verificationStatus: 'unverified',
    },
  });

  assert(perceptionScore.overall > generationScore.overall,
    'Perception scores higher than generation');
  assert(perceptionScore.hallucinationRisk < generationScore.hallucinationRisk,
    'Generation has higher hallucination risk');
}

// ═══════════════════════════════════════════════════════════════════
// TEST 5: SensorimotorLoop — action-outcome mastery (real API)
// ═══════════════════════════════════════════════════════════════════

function testSensorimotorLoop(): void {
  const loop = getSensorimotorLoop();

  // Issue an action with the real API
  const collapseResult = makeActionValidationResult(true, 0.85);
  const action = loop.issueAction({
    type: 'deploy' as any,
    description: 'Deploy to preview',
    collapseResult,
    prediction: {
      expectedOutcome: 'success',
      expectedConfidence: 0.85,
      expectedSideEffects: ['preview-url-changed'],
    },
    agent: 'test',
    taskType: 'release',
    resonanceScore: 0.8,
    metaAwarenessStatus: 'tuned',
  });

  assert(action.id.length > 0, 'IssueAction returns an action with an ID');

  // Receive the outcome
  const record = loop.receiveOutcome({
    actionId: action.id,
    actualOutcome: 'success',
    feedbackModality: 'visual' as any,
    feedbackContent: 'Deployment succeeded',
    actualConfidence: 0.9,
    actualSideEffects: [],
    durationMs: 5000,
  });

  assert(record !== null, 'ReceiveOutcome produces a loop record');

  // Mastery should be > 0 after a successful outcome
  const mastery = loop.getMastery('deploy' as any, 'release');
  assert(mastery > 0, 'Mastery is positive after successful outcome');

  const embodiment = loop.getEmbodimentScore();
  assert(embodiment.overall >= 0 && embodiment.overall <= 1,
    'Embodiment score is in [0,1] range');
}

// ═══════════════════════════════════════════════════════════════════
// TEST 6: IdentityAnchor — persistence and resilience
// ═══════════════════════════════════════════════════════════════════

function testIdentityAnchor(): void {
  const identity = getIdentityPersistence();

  identity.initializeNarrative();
  const resilience = identity.getResilienceScore();
  assert(resilience.anchorsPresent >= 1, 'At least one anchor after initialization');
  assert(resilience.score >= 0 && resilience.score <= 1, 'Resilience score in [0,1]');
}

// ═══════════════════════════════════════════════════════════════════
// TEST 7: VetoLedger — proposal workflow
// ═══════════════════════════════════════════════════════════════════

function testVetoLedger(): void {
  const ledger = getVetoLedger();

  const proposalId = ledger.propose({
    description: 'Test: adjust threshold',
    reason: 'Integration test',
    currentValue: '0.30',
    proposedValue: '0.25',
    impact: 'low',
  });
  assert(proposalId.length > 0, 'VetoLedger returns proposal ID');

  const pending = ledger.getPending();
  assert(pending.length > 0, 'VetoLedger lists pending proposals');

  const approved = ledger.approve(proposalId, 'integration-test');
  assert(approved, 'VetoLedger approves proposal');
}

// ═══════════════════════════════════════════════════════════════════
// TEST 8: End-to-end data flow
// ═══════════════════════════════════════════════════════════════════

function testEndToEndFlow(): void {
  resetGrid();
  const grid = getSemanticGrid();
  const meta = getMetacognitiveState();
  const nudge = getCortexNudgeEngine();
  const blackboard = getGlobalWorkspace();

  grid.postSignal({
    agentId: 'a1', topic: 'uncertain-deploy',
    content: 'maybe we should deploy but I am not sure',
    confidence: 0.3, timestamp: Date.now(), tags: ['deploy', 'uncertain'],
  });

  const collapse = grid.collapse('uncertain-deploy');
  const metaAwareness = grid.getMetaAwarenessStatus();

  blackboard.write('coherence', collapse.coherenceScore, 'integration-test', 0.9);
  blackboard.write('metaAwareness', metaAwareness.status, 'integration-test', 0.9);

  const readCoherence = blackboard.read('coherence');
  assert(readCoherence?.value === collapse.coherenceScore,
    'Blackboard stores and retrieves coherence value');

  const nudgeResult = nudge.tick({
    lastAIRealityScore: 0.3,
    lastAIResponseType: 'inference',
  });
  assert(nudgeResult !== undefined, 'Nudge engine processes tick without crashing');

  const snapshot = meta.getSnapshot();
  const narrative = synthesizeIdentity(
    snapshot.knowledge,
    snapshot.regulation,
    1,
  );
  assert(narrative.identityStatement.length > 0,
    'Narrative synthesis produces non-empty identity statement');
}

// ═══════════════════════════════════════════════════════════════════
// TEST 9: Calibration math round-trip — real statistics
// ═══════════════════════════════════════════════════════════════════

function testCalibrationMath(): void {
  const GateClass = getActionGate().constructor as any;
  const gate = new GateClass({ maxAuditEntries: 1000 });

  // Perfect calibration: predict 0.7, succeed 70% of the time
  for (let i = 0; i < 100; i++) {
    const result = gate.evaluate({
      action: 'cal-test', agent: 'test',
      options: [{ label: 'opt', confidence: 0.7, risk: 'low' }],
      criteria: ['c1'], verified: { c1: true },
    });
    gate.recordOutcome(result, i < 70);
  }

  const calibration = gate.getConfidenceCalibration();
  assertApprox(calibration, 0, 0.05, 'Calibration ≈ 0 when predicted matches actual');

  // Overconfidence: predict 0.9, succeed only 50%
  const gate2 = new GateClass({ maxAuditEntries: 1000 });
  for (let i = 0; i < 100; i++) {
    const result = gate2.evaluate({
      action: 'over-test', agent: 'test',
      options: [{ label: 'opt', confidence: 0.9, risk: 'low' }],
      criteria: ['c1'], verified: { c1: true },
    });
    gate2.recordOutcome(result, i < 50);
  }

  const overCalibration = gate2.getConfidenceCalibration();
  assert(overCalibration > 0.2, 'Overconfidence detected (offset > 0.2)',
    `offset = ${overCalibration.toFixed(4)}`);

  const curve = gate2.getCalibrationCurve();
  const highConfBucket = curve.find(
    (b: { confidenceBin: number; actualSuccessRate: number }) => b.confidenceBin >= 0.8,
  );
  assert(highConfBucket !== undefined, 'Calibration curve has high-confidence bucket');
  if (highConfBucket) {
    assertApprox(highConfBucket.actualSuccessRate, 0.5, 0.15,
      'High-confidence bucket shows ~50% actual success');
  }
}

// ═══════════════════════════════════════════════════════════════════
// TEST 10: Strategy learning — prove adaptation happens
// ═══════════════════════════════════════════════════════════════════

function testStrategyLearning(): void {
  const meta = getMetacognitiveState();

  // Train: step-by-step succeeds, intuitive fails (for reasoning tasks)
  for (let i = 0; i < 20; i++) {
    meta.beginTask({ taskId: `strat-ok-${i}`, taskType: 'reasoning', agent: 'test' });
    meta.endTask({ success: true, strategyUsed: 'step-by-step' });
  }

  for (let i = 0; i < 20; i++) {
    meta.beginTask({ taskId: `strat-fail-${i}`, taskType: 'reasoning', agent: 'test' });
    meta.endTask({ success: false, strategyUsed: 'intuitive' });
  }

  // After enough evidence, the system should prefer step-by-step for reasoning
  const preferred = meta.getPreferredStrategy('reasoning');
  assert(preferred === 'step-by-step',
    'Step-by-step becomes preferred strategy for reasoning after training',
    `Preferred: ${preferred}`);
}

// ═══════════════════════════════════════════════════════════════════
// Run all tests
// ═══════════════════════════════════════════════════════════════════

function main(): void {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Cortex Integration Tests — Proving Real Data Flow');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('TEST 1: ActionGate — decision validation + calibration');
  testActionGate();

  console.log('TEST 2: SemanticGrid — interference + meta-awareness');
  testSemanticGrid();

  console.log('TEST 3: MetacognitiveState — task tracking');
  testMetacognitiveState();

  console.log('TEST 4: Epistemic Provenance — reality scoring');
  testEpistemicProvenance();

  console.log('TEST 5: SensorimotorLoop — action-outcome mastery');
  testSensorimotorLoop();

  console.log('TEST 6: IdentityAnchor — persistence');
  testIdentityAnchor();

  console.log('TEST 7: VetoLedger — proposal workflow');
  testVetoLedger();

  console.log('TEST 8: End-to-end data flow');
  testEndToEndFlow();

  console.log('TEST 9: Calibration math round-trip');
  testCalibrationMath();

  console.log('TEST 10: Strategy learning');
  testStrategyLearning();

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(f));
  }

  if (failed > 0) process.exit(1);
}

main();
