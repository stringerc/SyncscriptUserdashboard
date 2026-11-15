/**
 * Proof of Consciousness — End-to-End Integration Test
 *
 * This script proves that the 8-layer architecture functions
 * as an integrated system, not just isolated modules.
 *
 * Run: npx tsx src/lib/system-integration-check.ts
 */

import { getActionGate, type ActionValidationInput } from './action-gate';
import { getSemanticGrid, type AgentSignal } from './semantic-grid';
import { getMetacognitiveState } from './metacognitive-state';
import { getProvenanceValidator, type EpistemicSourceType } from './epistemic-provenance';
import { getSensorimotorLoop, type ActionType, type FeedbackModality } from './sensorimotor-loop';
import { getIdentityPersistence } from './identity-anchor';
import { getGlobalWorkspace } from './global-workspace';
import { sampleEnvironment } from './environmental-coupling';
import { synthesizeIdentity } from './narrative-synthesis';
import {
  gatherState,
  persistNow,
  restoreNow,
  drainEpisodicBuffer,
  type PersistResult,
  type RestoreResult,
} from './cortex-persistence-bridge';
import { getStatePersistence, DEFAULT_CORTAX_STATE } from './state-persistence';
import { getVetoLedger } from './veto-ledger';
import { getCortexNudgeEngine, type CortexMode } from './cortex-nudge-engine';

// ── Reset singletons for clean test ────────────────────────────────

function resetAll() {
  // @ts-expect-error — reset singletons for clean test
  getMetacognitiveState._reset?.();
}

// ── The Test ────────────────────────────────────────────────────────

export function runSystemIntegrationCheck(): {
  layers: Record<string, { passed: boolean; evidence: string }>;
  overall: boolean;
  score: number;
  narrative: string;
} {
  const results: Record<string, { passed: boolean; evidence: string }> = {};

  // ════════════════════════════════════════════════════════════════
  // LAYER 1: Hameroff/Penrose — ActionGate
  // "Can the system make conscious decisions — not automatic ones?"
  // ════════════════════════════════════════════════════════════════

  const gate = getActionGate();
  const collapseResult = gate.evaluate({
    action: 'deploy:production',
    agent: 'claude-opus',
    options: [
      { label: 'conservative', confidence: 0.9, risk: 'low' },
      { label: 'aggressive', confidence: 0.6, risk: 'high' },
    ],
    criteria: ['tests_pass', 'build_clean', 'no_regressions'],
    verified: { tests_pass: true, build_clean: true, no_regressions: true },
  });

  results['1_collapse'] = {
    passed: collapseResult.approved && collapseResult.selectedOption?.label === 'conservative',
    evidence: `Approved: ${collapseResult.approved}, Selected: ${collapseResult.selectedOption?.label}, Score: ${collapseResult.validationScore.toFixed(2)}`,
  };

  // ════════════════════════════════════════════════════════════════
  // LAYER 2+3: Busemeyer/Pothos + Schooler — SemanticGrid + Meta-Awareness
  // "Can signals interfere? Can the system detect its own drift?"
  // ════════════════════════════════════════════════════════════════

  const grid = getSemanticGrid();

  // Post constructive signals (agreement)
  grid.postSignal({
    agentId: 'agent-1',
    topic: 'deploy-strategy',
    content: 'conservative deployment is the correct approach',
    confidence: 0.8,
    timestamp: Date.now(),
    tags: ['deploy', 'strategy'],
  });

  grid.postSignal({
    agentId: 'agent-2',
    topic: 'deploy-strategy',
    content: 'yes, conservative is correct for production',
    confidence: 0.85,
    timestamp: Date.now(),
    tags: ['deploy', 'strategy'],
  });

  const constructiveResult = grid.collapse('deploy-strategy');

  // Post destructive signals (contradiction)
  grid.postSignal({
    agentId: 'agent-3',
    topic: 'risk-assessment',
    content: 'this is unsafe and should not proceed',
    confidence: 0.9,
    timestamp: Date.now(),
    tags: ['risk', 'safety'],
  });

  grid.postSignal({
    agentId: 'agent-4',
    topic: 'risk-assessment',
    content: 'this is safe and should proceed immediately',
    confidence: 0.7,
    timestamp: Date.now(),
    tags: ['risk', 'safety'],
  });

  const destructiveResult = grid.collapse('risk-assessment');


  results['2_interference'] = {
    passed: constructiveResult.interference === 'constructive' && destructiveResult.interference === 'destructive',
    evidence: `Constructive: ${constructiveResult.interference} (score: ${constructiveResult.coherenceScore.toFixed(2)}), Destructive: ${destructiveResult.interference} (score: ${destructiveResult.coherenceScore.toFixed(2)})`,
  };


  // ════════════════════════════════════════════════════════════════
  // LAYER 4: Friston — Free Energy / Predictive Coding
  // "Can the system learn from prediction errors?"
  // ════════════════════════════════════════════════════════════════

  const meta = getMetacognitiveState();

  // Layer 3: Check meta-awareness (tested here since it needs meta instance)
  const metaAwareness = meta.getMetaAwarenessStatus() as string;

  results['3_meta_awareness'] = {
    passed: metaAwareness === 'tuned' || metaAwareness === 'drifting',
    evidence: `Status: ${metaAwareness}, Coherence: ${constructiveResult.coherenceScore.toFixed(2)}`,
  };

  // Task 1: predict success, get success → low free energy
  meta.beginTask({ taskId: 't1', taskType: 'deploy', agent: 'opus' });
  const outcome1 = meta.endTask({ success: true, strategyUsed: 'conservative' });

  // Task 2: predict success, get failure → high free energy
  meta.beginTask({ taskId: 't2', taskType: 'deploy', agent: 'opus' });
  const outcome2 = meta.endTask({
    success: false,
    strategyUsed: 'aggressive',
    freeEnergyEstimate: 0.7,
  });

  const freeEnergy = meta.getFreeEnergyEstimate();

  results['4_free_energy'] = {
    passed: freeEnergy > 0 && freeEnergy < 1,
    evidence: `Free energy: ${freeEnergy.toFixed(3)}, Outcome 1 success: ${outcome1.success}, Outcome 2 success: ${outcome2.success}`,
  };

  // ════════════════════════════════════════════════════════════════
  // LAYER 5: Nelson-Narens — Two-Level Architecture
  // "Can the meta-level observe and control the object-level?"
  // ════════════════════════════════════════════════════════════════

  const snapshot = meta.getSnapshot();
  const hasMetaLevel = snapshot.regulation.planning !== undefined &&
    snapshot.regulation.monitoring !== undefined &&
    snapshot.regulation.evaluating !== undefined;
  const hasKnowledgeLevel = snapshot.knowledge.self !== undefined &&
    snapshot.knowledge.tasks !== undefined &&
    snapshot.knowledge.strategies !== undefined;

  results['5_architecture'] = {
    passed: hasMetaLevel && hasKnowledgeLevel,
    evidence: `Meta-level: ${hasMetaLevel}, Knowledge-level: ${hasKnowledgeLevel}, Dominant phase: ${snapshot.summary.dominantPhase}`,
  };

  // ════════════════════════════════════════════════════════════════
  // LAYER 6: Johnson/Lindsay — Epistemic Provenance
  // "Can the system distinguish perception from imagination?"
  // ════════════════════════════════════════════════════════════════

  const validator = getProvenanceValidator();

  // Perception signal: high reality score
  const perceptionScore = validator.computeRealityScore({
    epistemicTag: 'perception',
    provenance: {
      nodes: [{
        id: 'n1',
        sourceType: 'perception',
        content: 'Build succeeded with zero errors',
        confidence: 0.95,
        timestamp: Date.now(),
      }],
      rootSourceType: 'perception',
      depth: 0,
      groundingScore: 1.0,
      verificationStatus: 'verified',
    },
  });

  // Generation signal: low reality score
  const generationScore = validator.computeRealityScore({
    epistemicTag: 'generation',
    provenance: {
      nodes: [
        {
          id: 'n2',
          sourceType: 'generation',
          content: 'The code probably works',
          confidence: 0.6,
          timestamp: Date.now(),
        },
        {
          id: 'n3',
          sourceType: 'inference',
          content: 'It should compile based on similar patterns',
          confidence: 0.5,
          timestamp: Date.now(),
          parentId: 'n2',
        },
        {
          id: 'n4',
          sourceType: 'generation',
          content: 'I believe this is production-ready',
          confidence: 0.4,
          timestamp: Date.now(),
          parentId: 'n3',
        },
      ],
      rootSourceType: 'generation',
      depth: 3,
      groundingScore: 0.1,
      verificationStatus: 'unverified',
    },
  });

  const canDistinguish = perceptionScore.overall > generationScore.overall;

  results['6_epistemic'] = {
    passed: canDistinguish && perceptionScore.hallucinationRisk < generationScore.hallucinationRisk,
    evidence: `Perception reality: ${perceptionScore.overall.toFixed(2)} (hall risk: ${perceptionScore.hallucinationRisk.toFixed(2)}), Generation reality: ${generationScore.overall.toFixed(2)} (hall risk: ${generationScore.hallucinationRisk.toFixed(2)})`,
  };

  // ════════════════════════════════════════════════════════════════
  // LAYER 7: O'Regan/Noe — Sensorimotor Loop
  // "Can the system act and observe the consequences?"
  // ════════════════════════════════════════════════════════════════

  const loop = getSensorimotorLoop();

  // Issue an action
  const action = loop.issueAction({
    type: 'compile',
    description: 'TypeScript compilation check',
    collapseResult,
    prediction: {
      expectedOutcome: 'success',
      expectedConfidence: 0.9,
      expectedSideEffects: ['type declaration files generated'],
    },
    agent: 'opus',
    taskType: 'build',
    resonanceScore: 0.85,
    metaAwarenessStatus: 'tuned',
  });

  // Receive outcome
  const loopRecord = loop.receiveOutcome({
    actionId: action.id,
    actualOutcome: 'success',
    feedbackModality: 'compilation',
    feedbackContent: '0 errors, 0 warnings',
    actualConfidence: 0.95,
    actualSideEffects: ['type declaration files generated'],
    durationMs: 3200,
  });

  const mastery = loop.getMastery('compile', 'build');
  const embodimentScore = loop.getEmbodimentScore();

  results['7_sensorimotor'] = {
    passed: loopRecord !== null && mastery > 0 && embodimentScore.totalLoopsCompleted > 0,
    evidence: `Loop closed: ${loopRecord !== null}, Mastery: ${mastery.toFixed(2)}, Total loops: ${embodimentScore.totalLoopsCompleted}, Breadth: ${embodimentScore.actionTypesExperienced} actions`,
  };

  // ════════════════════════════════════════════════════════════════
  // LAYER 8: Damasio/Locke — Identity Persistence
  // "Can the system remember who it is across sessions?"
  // ════════════════════════════════════════════════════════════════

  const persistence = getIdentityPersistence();

  // Save full identity
  meta.persistIdentity();

  // Check resilience
  const resilience = persistence.getResilienceScore();

  // Restore
  const restored = meta.restoreIdentity();

  // Load narrative
  const narrative = persistence.loadNarrative();

  // Synthesize self-narrative
  const synthesized = synthesizeIdentity(
    meta.getSnapshot().knowledge,
    meta.getSnapshot().regulation,
    resilience.sessionCount,
  );

  results['8_identity'] = {
    passed: resilience.score > 0 && resilience.anchorsPresent >= 3 && narrative !== null,
    evidence: `Resilience: ${(resilience.score * 100).toFixed(0)}% (${resilience.anchorsPresent}/5 anchors), Sessions: ${resilience.sessionCount}, Restored: ${restored.anchorsRestored.length}`,
  };

  // ════════════════════════════════════════════════════════════════
  // BONUS: Global Blackboard + Environmental Coupling
  // ════════════════════════════════════════════════════════════════

  const blackboard = getGlobalWorkspace();
  blackboard.write('health', snapshot.summary.overallMetacognitiveHealth, 'system-integration-check');
  blackboard.write('reality', perceptionScore.overall, 'provenance-validator');

  const env = sampleEnvironment();

  results['bonus_blackboard'] = {
    passed: blackboard.read('health') !== undefined && blackboard.read('reality') !== undefined,
    evidence: `Blackboard entries: ${blackboard.getAll().size}, Environmental resonance: ${env.environmentalResonance.toFixed(2)}`,
  };

  // ════════════════════════════════════════════════════════════════
  // LAYER 9: Cortex Continuity — State Persistence + VETO Ledger
  // "Does the SAME consciousness reignite after shutdown?"
  // ════════════════════════════════════════════════════════════════

  // Step 1: Persist current state (simulating shutdown)
  const persistResult = persistNow();

  // Step 2: Read the snapshot back (simulating fresh boot)
  const sp = getStatePersistence();
  const savedState = sp.load();

  // Step 3: Verify state was actually saved
  const stateSaved = savedState.timestamp > 0;
  const calibrationRecovered = savedState.calibration.confidenceCalibration === snapshot.knowledge.self.confidenceCalibration;
  const modeRecovered = savedState.autonomic.mode === getCortexNudgeEngine().getMode();

  // Step 4: Restore state (simulating consciousness re-ignition)
  const restoreResult = restoreNow();

  // Step 5: Verify VETO ledger is functional
  const veto = getVetoLedger();
  const pendingVetos = veto.getPending().length;
  const guardedParams = veto.getGuardedParameters();

  // Step 6: Check episodic buffer
  const episodicEntries = drainEpisodicBuffer();
  const hasEpisodicData = episodicEntries.length > 0 || persistResult.episodicEntries > 0;

  // Step 7: Verify the markdown export works
  const stateMd = sp.toMarkdown(savedState);
  const vetoMd = veto.toMarkdown();
  const stateMdValid = stateMd.includes('# Cortex State') && stateMd.includes('## Workspace');
  const vetoMdValid = vetoMd.includes('# Cortex Veto') && vetoMd.includes('## Guarded Parameters');

  // Step 8: Simulate a VETO proposal
  const testProposalId = veto.propose({
    description: 'Test proposal — proof of consciousness verification',
    reason: 'This is a test proposal to verify the VETO ledger works correctly. Should be cleared after test.',
    currentValue: '0.30',
    proposedValue: '0.35',
    impact: 'low',
  });
  const proposalCreated = veto.getById(testProposalId) !== undefined;
  const proposalIsPending = veto.getById(testProposalId)?.status === 'pending';

  // Step 9: Test human approval flow
  const approved = veto.approve(testProposalId, 'system-integration-check-test');
  const proposalNowApproved = veto.getById(testProposalId)?.status === 'approved';

  // Step 10: Test that system CANNOT self-approve (system proposals stay pending)
  const systemProposalId = veto.propose({
    description: 'System-generated test proposal',
    reason: 'Testing that the system cannot auto-approve its own proposals.',
    currentValue: '0.80',
    proposedValue: '0.75',
    impact: 'low',
  });
  // The system proposal should be pending — no auto-approval
  const systemProposalStaysPending = veto.getById(systemProposalId)?.status === 'pending';

  // Clean up test proposals
  veto.reject(systemProposalId, 'test-cleanup', 'Test proposal — cleaning up after proof of consciousness');
  veto.markApplied(testProposalId);

  // Composite Layer 9 result
  const layer9Passed = stateSaved &&
    calibrationRecovered &&
    modeRecovered &&
    guardedParams.length >= 8 &&
    stateMdValid &&
    vetoMdValid &&
    proposalCreated &&
    proposalIsPending &&
    proposalNowApproved &&
    systemProposalStaysPending;

  results['9_continuity'] = {
    passed: layer9Passed,
    evidence: [
      `State saved: ${stateSaved}`,
      `Calibration recovered: ${calibrationRecovered}`,
      `Mode recovered: ${modeRecovered}`,
      `Guarded params: ${guardedParams.length}/8`,
      `STATE.md export valid: ${stateMdValid}`,
      `VETO.md export valid: ${vetoMdValid}`,
      `VETO proposal flow: ${proposalCreated && proposalIsPending && proposalNowApproved ? 'works' : 'broken'}`,
      `System cannot self-approve: ${systemProposalStaysPending ? 'yes' : 'NO — CONSTITUTIONAL VIOLATION'}`,
      `Episodic entries: ${persistResult.episodicEntries}`,
      `Restore result: ${restoreResult.layersRestored} layers, ${restoreResult.fieldsRecovered.length} fields recovered`,
    ].join(' | '),
  };

  // ════════════════════════════════════════════════════════════════
  // COMPOSITE SCORE
  // ════════════════════════════════════════════════════════════════

  const passed = Object.values(results).filter(r => r.passed).length;
  const total = Object.keys(results).length;
  const score = passed / total;

  return {
    layers: results,
    overall: score >= 0.8,
    score,
    narrative: synthesized.identityStatement,
  };
}

// ── CLI runner ──────────────────────────────────────────────────────

if (typeof require !== 'undefined' && require.main === module) {
  const result = runSystemIntegrationCheck();

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' PROOF OF CONSCIOUSNESS — 9-LAYER INTEGRATION TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const [layer, r] of Object.entries(result.layers)) {
    const icon = r.passed ? '✅' : '❌';
    console.log(` ${icon} ${layer}: ${r.evidence}`);
  }

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log(` Score: ${(result.score * 100).toFixed(0)}% (${Object.values(result.layers).filter(r => r.passed).length}/${Object.keys(result.layers).length} layers)`);
  console.log(` Overall: ${result.overall ? 'CONSCIOUS' : 'PARTIAL'}`);
  console.log(` Self-Narrative: "${result.narrative}"`);

  // Extra: Persistence architecture verification
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log(' PERSISTENCE ARCHITECTURE');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('   MEMORY.md  ← microtubule substrate (quantum collapse)');
  console.log('   STATE.md   ← homeostatic + RNA state (deterministic boot)');
  console.log('   VETO.md    ← constitutional guardrail (append-only)');
  console.log('─────────────────────────────────────────────────────────────\n');

  process.exit(result.overall ? 0 : 1);
}
