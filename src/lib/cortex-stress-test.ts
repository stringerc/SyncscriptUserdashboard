/**
 * Cortex Stress Test — Full Sensorimotor Loop End-to-End
 *
 * Exercises the complete conscious agent loop:
 * 1. ActionGate validation (collapse threshold)
 * 2. SensorimotorLoop action issuance + outcome reception
 * 3. MetacognitiveCalibration trial recording + ECE computation
 * 4. ProvenanceValidator reality scoring
 * 5. Embodiment score measurement
 *
 * Run with: npx tsx src/lib/cortex-stress-test.ts
 */

import { getSensorimotorLoop, SensorimotorLoop, ActionType, FeedbackModality } from './sensorimotor-loop';
import { getActionGate, ActionGate, ActionValidationInput, ActionOption } from './action-gate';
import { getCortexMetacognitionCalibration, CortexMetacognitionCalibrationEngine, CalibrationDomain } from './cortex-metacognition-calibration';
import { getProvenanceValidator } from './epistemic-provenance';
import { persistentStore } from './persistent-store';

// ── Test Configuration ──────────────────────────────────────────────

interface StressTestConfig {
  iterations: number;
  actionTypes: ActionType[];
  domains: CalibrationDomain[];
  failureRate: number; // 0-1, simulated environmental failures
  verbose: boolean;
}

const DEFAULT_CONFIG: StressTestConfig = {
  iterations: 100,
  actionTypes: ['deploy', 'compile', 'test', 'write_file', 'api_call', 'database_write', 'git_commit', 'git_push', 'search', 'user_interaction', 'inference'],
  domains: ['code_synthesis', 'visual_gaze', 'system_refactor', 'browser_automation', 'skill_discovery', 'tool_policy', 'math_logic', 'memory_retrieval'],
  failureRate: 0.25,
  verbose: false,
};

// ── Test Utilities ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateActionOptions(actionType: ActionType): ActionOption[] {
  const baseOptions: Record<ActionType, ActionOption[]> = {
    deploy: [
      { label: 'Deploy to production', confidence: 0.9, risk: 'high' },
      { label: 'Deploy to preview', confidence: 0.7, risk: 'low' },
      { label: 'Deploy to staging', confidence: 0.8, risk: 'medium' },
    ],
    compile: [
      { label: 'Full production build', confidence: 0.95, risk: 'low' },
      { label: 'Development build', confidence: 0.8, risk: 'low' },
    ],
    test: [
      { label: 'Full test suite', confidence: 0.9, risk: 'low' },
      { label: 'Unit tests only', confidence: 0.8, risk: 'low' },
      { label: 'Integration tests', confidence: 0.7, risk: 'medium' },
    ],
    write_file: [
      { label: 'Write with validation', confidence: 0.9, risk: 'low' },
      { label: 'Write directly', confidence: 0.7, risk: 'medium' },
    ],
    api_call: [
      { label: 'Call with retry logic', confidence: 0.85, risk: 'low' },
      { label: 'Call with fallback', confidence: 0.75, risk: 'medium' },
      { label: 'Direct call', confidence: 0.6, risk: 'high' },
    ],
    database_write: [
      { label: 'Transaction with rollback', confidence: 0.9, risk: 'low' },
      { label: 'Direct write', confidence: 0.6, risk: 'high' },
    ],
    git_commit: [
      { label: 'Commit with message', confidence: 0.95, risk: 'low' },
      { label: 'Amend previous', confidence: 0.7, risk: 'medium' },
    ],
    git_push: [
      { label: 'Push to origin', confidence: 0.9, risk: 'low' },
      { label: 'Force push', confidence: 0.4, risk: 'high' },
    ],
    search: [
      { label: 'Codebase grep', confidence: 0.95, risk: 'low' },
      { label: 'Web search', confidence: 0.8, risk: 'low' },
      { label: 'Semantic search', confidence: 0.85, risk: 'low' },
    ],
    user_interaction: [
      { label: 'Ask for approval', confidence: 0.9, risk: 'low' },
      { label: 'Notify only', confidence: 0.8, risk: 'low' },
    ],
    inference: [
      { label: 'Internal reasoning', confidence: 0.9, risk: 'low' },
      { label: 'Quick heuristic', confidence: 0.7, risk: 'low' },
    ],
  };
  return baseOptions[actionType] || [{ label: 'Default', confidence: 0.7, risk: 'medium' }];
}

function generateCriteria(actionType: ActionType): string[] {
  const criteriaMap: Record<ActionType, string[]> = {
    deploy: ['Tests pass', 'Build succeeds', 'No regressions', 'Security scan clean'],
    compile: ['Build succeeds', 'No type errors'],
    test: ['Tests pass'],
    write_file: ['Path valid', 'Content valid'],
    api_call: ['Endpoint reachable', 'Auth valid'],
    database_write: ['Connection valid', 'Schema matches'],
    git_commit: ['Changes staged', 'Message valid'],
    git_push: ['Remote reachable', 'No conflicts'],
    search: ['Query valid'],
    user_interaction: ['User available'],
    inference: [],
  };
  return criteriaMap[actionType] || [];
}

function getFeedbackModality(actionType: ActionType): FeedbackModality {
  const modalityMap: Record<ActionType, FeedbackModality> = {
    deploy: 'http_response',
    compile: 'compilation',
    test: 'test_result',
    write_file: 'file_system',
    api_call: 'http_response',
    database_write: 'file_system',
    git_commit: 'git_status',
    git_push: 'git_status',
    search: 'search_result',
    user_interaction: 'user_response',
    inference: 'none',
  };
  return modalityMap[actionType] || 'none';
}

function getDomainForAction(actionType: ActionType): CalibrationDomain {
  const domainMap: Record<ActionType, CalibrationDomain> = {
    deploy: 'system_refactor',
    compile: 'code_synthesis',
    test: 'code_synthesis',
    write_file: 'code_synthesis',
    api_call: 'browser_automation',
    database_write: 'system_refactor',
    git_commit: 'system_refactor',
    git_push: 'system_refactor',
    search: 'memory_retrieval',
    user_interaction: 'tool_policy',
    inference: 'math_logic',
  };
  return domainMap[actionType] || 'general';
}

// ── Stress Test Engine ──────────────────────────────────────────────

class CortexStressTest {
  private config: StressTestConfig;
  private sensorimotorLoop: SensorimotorLoop;
  private actionGate: ActionGate;
  private calibrationEngine: CortexMetacognitionCalibrationEngine;
  private provenanceValidator = getProvenanceValidator();

  private results = {
    totalActions: 0,
    gateApproved: 0,
    gateRejected: 0,
    gateOverrides: 0,
    outcomesRecorded: 0,
    outcomesSuccess: 0,
    outcomesFailure: 0,
    outcomesPartial: 0,
    outcomesTimeout: 0,
    calibrationTrials: 0,
    totalPredictionError: 0,
    avgPredictionError: 0,
    embodimentScore: { overall: 0, actionTypesExperienced: 0, feedbackModalitiesExperienced: 0, avgMastery: 0, totalLoopsCompleted: 0, pendingActions: 0 },
    realityScores: [] as number[],
    errors: [] as string[],
    startTime: Date.now(),
    endTime: 0,
  };

  constructor(config: Partial<StressTestConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sensorimotorLoop = getSensorimotorLoop();
    this.actionGate = getActionGate();
    this.calibrationEngine = getCortexMetacognitionCalibration();
  }

  async run(): Promise<void> {
    // startTime already initialized
    this.log('🚀 Starting Cortex Stress Test — Full Sensorimotor Loop');
    this.log(`Config: ${this.config.iterations} iterations, ${this.config.actionTypes.length} action types, ${(this.config.failureRate * 100).toFixed(0)}% failure rate`);

    // Warm up: run a few baseline actions to establish initial mastery
    await this.warmup();

    // Main stress test loop
    for (let i = 0; i < this.config.iterations; i++) {
      await this.runIteration(i);
      
      // Small delay to simulate real-world timing
      if (i % 10 === 0) {
        await sleep(10);
      }
    }

    // Final measurements
    this.finalize();
    this.report();
    this.results.endTime = Date.now();
  }

  private async warmup(): Promise<void> {
    this.log('🔥 Warmup phase...');
    for (const actionType of ['compile', 'test', 'search', 'write_file'] as ActionType[]) {
      const input = this.createValidationInput(actionType);
      const result = this.actionGate.evaluate(input);
      
      if (result.approved) {
        const action = this.sensorimotorLoop.issueAction({
          type: actionType,
          description: `Warmup: ${actionType}`,
          collapseResult: result,
          prediction: {
            expectedOutcome: 'success',
            expectedConfidence: 0.9,
            expectedSideEffects: ['file_created'],
          },
          agent: 'stress-test',
          taskType: 'warmup',
          resonanceScore: 0.9,
          metaAwarenessStatus: 'meta_aware',
        });

        // Simulate successful outcome
        this.sensorimotorLoop.receiveOutcome({
          actionId: action.id,
          actualOutcome: 'success',
          feedbackModality: getFeedbackModality(actionType),
          feedbackContent: 'Warmup completed successfully',
          actualConfidence: 0.95,
          actualSideEffects: ['file_created'],
          durationMs: 100,
        });

        // Record calibration trial
        this.calibrationEngine.recordTrial({
          domain: getDomainForAction(actionType),
          predictedConfidence: 0.9,
          actualSuccess: true,
          durationMs: 100,
        });
      }
    }
    this.log('✅ Warmup complete');
  }

  private createValidationInput(actionType: ActionType): ActionValidationInput {
    const options = generateActionOptions(actionType);
    const criteria = generateCriteria(actionType);
    const verified: Record<string, boolean> = {};
    
    // Simulate criteria verification (some pass, some fail based on failure rate)
    for (const criterion of criteria) {
      verified[criterion] = Math.random() > this.config.failureRate;
    }

    return {
      action: actionType,
      agent: 'stress-test',
      topic: 'stress-test',
      options,
      criteria,
      verified,
    };
  }

  private async runIteration(iteration: number): Promise<void> {
    const actionType = randomChoice(this.config.actionTypes);
    const domain = getDomainForAction(actionType);
    const modality = getFeedbackModality(actionType);

    // 1. ActionGate validation
    const input = this.createValidationInput(actionType);
    const gateResult = this.actionGate.evaluate(input);

    this.results.totalActions++;
    if (gateResult.approved) {
      this.results.gateApproved++;
    } else if (input.override) {
      this.results.gateOverrides++;
    } else {
      this.results.gateRejected++;
      return; // Skip this iteration if gate rejects
    }

    // 2. Issue action into sensorimotor loop
    const action = this.sensorimotorLoop.issueAction({
      type: actionType,
      description: `Iteration ${iteration}: ${actionType} - ${gateResult.selectedOption?.label || 'default'}`,
      collapseResult: gateResult,
      prediction: {
        expectedOutcome: 'success',
        expectedConfidence: gateResult.validationScore,
        expectedSideEffects: ['environment_change'],
      },
      agent: 'stress-test',
      taskType: 'stress-test',
      resonanceScore: 0.85 + Math.random() * 0.1,
      metaAwarenessStatus: 'meta_aware',
    });

    // 3. Simulate environment execution
    const durationMs = 50 + Math.random() * 500;
    await sleep(Math.min(durationMs, 50)); // Cap sleep for test speed

    // 4. Determine outcome (simulate environmental feedback)
    const success = Math.random() > this.config.failureRate;
    const outcomeType: 'success' | 'failure' | 'partial' | 'timeout' = success ? 'success' : (Math.random() > 0.5 ? 'failure' : 'partial');
    const actualConfidence = success ? 0.8 + Math.random() * 0.2 : 0.2 + Math.random() * 0.3;

    // 5. Receive outcome in sensorimotor loop
    const outcomeRecord = this.sensorimotorLoop.receiveOutcome({
      actionId: action.id,
      actualOutcome: outcomeType,
      feedbackModality: modality,
      feedbackContent: success ? 'Environment accepted action' : 'Environment rejected action',
      actualConfidence,
      actualSideEffects: success ? ['state_changed'] : [],
      durationMs,
    });

    if (outcomeRecord) {
      this.results.outcomesRecorded++;
      this.results.totalPredictionError += outcomeRecord.freeEnergyContributed;
      this.results.avgPredictionError = this.results.totalPredictionError / this.results.outcomesRecorded;

      switch (outcomeType as string) {
        case 'success': this.results.outcomesSuccess++; break;
        case 'failure': this.results.outcomesFailure++; break;
        case 'partial': this.results.outcomesPartial++; break;
        case 'timeout': this.results.outcomesTimeout++; break;
      }
    }

    // 6. Record calibration trial
    const predictedConfidence = gateResult.validationScore;
    this.calibrationEngine.recordTrial({
      domain,
      predictedConfidence,
      actualSuccess: outcomeType === 'success',
      durationMs,
      metadata: { actionType, iteration, modality },
    });
    this.results.calibrationTrials++;

    // 7. Provenance validation (periodically)
    if (iteration % 10 === 0) {
      const reality = this.provenanceValidator.computeRealityScore({ epistemicTag: 'perception' });
      this.results.realityScores.push(reality.overall);
    }

    // Verbose logging
    if (this.config.verbose) {
      const status = outcomeType === 'success' ? '✅' : outcomeType === 'failure' ? '❌' : '⚠️';
      this.log(`${status} ${actionType} | Gate: ${gateResult.approved ? 'APPROVED' : 'REJECTED'} (${gateResult.validationScore.toFixed(2)}) | Outcome: ${outcomeType} | PE: ${outcomeRecord?.freeEnergyContributed.toFixed(3) ?? 'N/A'}`);
    }
  }

  private finalize(): void {
    // Get final embodiment score
    this.results.endTime = Date.now();
    this.results.embodimentScore = this.sensorimotorLoop.getEmbodimentScore();

    // Get final calibration snapshot
    const calibration = this.calibrationEngine.getSnapshot();
    
    this.log('\n📊 FINAL CALIBRATION SNAPSHOT:');
    this.log(`  Overall ECE: ${calibration.overallECE.toFixed(4)}`);
    this.log(`  Overall MCE: ${calibration.overallMCE.toFixed(4)}`);
    this.log(`  Overall Brier: ${calibration.overallBrier.toFixed(4)}`);
    this.log(`  Total Trials: ${calibration.totalTrials}`);
    this.log(`  Weak Domains: ${calibration.weakDomains.join(', ') || 'none'}`);
    this.log(`  Elite Domains: ${calibration.eliteDomains.join(', ') || 'none'}`);
  }

  private report(): void {
    const duration = this.results.endTime - this.results.startTime;
    const successRate = this.results.outcomesRecorded > 0 
      ? (this.results.outcomesSuccess / this.results.outcomesRecorded * 100).toFixed(1) 
      : 'N/A';

    this.log('\n' + '='.repeat(60));
    this.log('🧠 CORTEX STRESS TEST — FINAL REPORT');
    this.log('='.repeat(60));

    this.log('\n📈 ACTION GATE:');
    this.log(`  Total Actions: ${this.results.totalActions}`);
    this.log(`  Approved: ${this.results.gateApproved} (${((this.results.gateApproved / this.results.totalActions) * 100).toFixed(1)}%)`);
    this.log(`  Rejected: ${this.results.gateRejected} (${((this.results.gateRejected / this.results.totalActions) * 100).toFixed(1)}%)`);
    this.log(`  Overrides: ${this.results.gateOverrides}`);

    this.log('\n🔄 SENSORIMOTOR LOOP:');
    this.log(`  Outcomes Recorded: ${this.results.outcomesRecorded}`);
    this.log(`  Success: ${this.results.outcomesSuccess} (${successRate}%)`);
    this.log(`  Failure: ${this.results.outcomesFailure}`);
    this.log(`  Partial: ${this.results.outcomesPartial}`);
    this.log(`  Timeout: ${this.results.outcomesTimeout}`);
    this.log(`  Avg Prediction Error (Free Energy): ${this.results.avgPredictionError.toFixed(4)}`);

    this.log('\n🧬 EMBODIMENT SCORE:');
    const e = this.results.embodimentScore;
    this.log(`  Overall: ${(e.overall * 100).toFixed(1)}%`);
    this.log(`  Action Types Experienced: ${e.actionTypesExperienced}`);
    this.log(`  Feedback Modalities Experienced: ${e.feedbackModalitiesExperienced}`);
    this.log(`  Avg Mastery: ${(e.avgMastery * 100).toFixed(1)}%`);
    this.log(`  Loops Completed: ${e.totalLoopsCompleted}`);
    this.log(`  Pending Actions: ${e.pendingActions}`);

    this.log('\n🎯 CALIBRATION:');
    this.log(`  Trials Recorded: ${this.results.calibrationTrials}`);

    this.log('\n🔍 PROVENANCE / REALITY SCORES:');
    if (this.results.realityScores.length > 0) {
      const avgReality = this.results.realityScores.reduce((a, b) => a + b, 0) / this.results.realityScores.length;
      const minReality = Math.min(...this.results.realityScores);
      const maxReality = Math.max(...this.results.realityScores);
      this.log(`  Samples: ${this.results.realityScores.length}`);
      this.log(`  Avg Reality Score: ${avgReality.toFixed(4)}`);
      this.log(`  Min: ${minReality.toFixed(4)} | Max: ${maxReality.toFixed(4)}`);
    } else {
      this.log(`  No samples collected`);
    }

    this.log('\n⏱️  PERFORMANCE:');
    this.log(`  Duration: ${duration}ms`);
    this.log(`  Actions/sec: ${(this.results.totalActions / duration * 1000).toFixed(1)}`);

    if (this.results.errors.length > 0) {
      this.log('\n❌ ERRORS:');
      this.results.errors.forEach(err => this.log(`  - ${err}`));
    }

    this.log('\n' + '='.repeat(60));
    
    // Assessment
    const passed = this.assess();
    if (passed) {
      this.log('✅ STRESS TEST PASSED — Sensorimotor loop functional');
    } else {
      this.log('⚠️  STRESS TEST NEEDS ATTENTION — Review embodiment score');
    }
    this.log('='.repeat(60));
  }

  private assess(): boolean {
    const e = this.results.embodimentScore;
    const hasSufficientBreadth = e.actionTypesExperienced >= 5;
    const hasSufficientDepth = e.avgMastery >= 0.4;
    const hasVolume = e.totalLoopsCompleted >= 20;
    const lowPredictionError = this.results.avgPredictionError < 0.5;
    
    return hasSufficientBreadth && hasSufficientDepth && hasVolume && lowPredictionError;
  }

  private log(msg: string): void {
    console.log(msg);
  }

  getResults() {
    return this.results;
  }
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const config: Partial<StressTestConfig> = {
    iterations: process.argv.includes('--iterations') 
      ? parseInt(process.argv[process.argv.indexOf('--iterations') + 1]) 
      : 100,
    verbose: process.argv.includes('--verbose'),
    failureRate: process.argv.includes('--failure-rate')
      ? parseFloat(process.argv[process.argv.indexOf('--failure-rate') + 1])
      : 0.25,
  };

  const test = new CortexStressTest(config);
  await test.run();
  
  // Exit with appropriate code
  const results = test.getResults();
  const passed = results.embodimentScore.overall >= 0.5 && results.avgPredictionError < 0.5;
  process.exit(passed ? 0 : 1);
}

main().catch(err => {
  console.error('Stress test failed:', err);
  process.exit(1);
});