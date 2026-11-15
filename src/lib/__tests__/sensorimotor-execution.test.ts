import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getCortexEngine, resetCortexEngine } from '../cortex-engine';
import { getSensorimotorLoop, resetSensorimotorLoop } from '../sensorimotor-loop';
import { getActionGate } from '../action-gate';
import { patchGlobalFetch, restoreGlobalFetch } from '../environmental-interceptors';
import { sampleEnvironment } from '../environmental-coupling';

describe('Sensorimotor Execution Loop & Environmental Coupling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetCortexEngine();
    resetSensorimotorLoop();
    
    // Clear the ActionGate outcome log by re-instantiating or restoring 0
    const gate = getActionGate();
    gate.restoreCalibrationOffset(0);
  });

  afterEach(() => {
    restoreGlobalFetch();
    vi.useRealTimers();
  });

  it('closes the action-perception loop on successful execution', async () => {
    const cortex = getCortexEngine({ mode: 'silent' });
    const sLoop = getSensorimotorLoop();
    
    // Initially, embodiment score should be very low
    expect(sLoop.getEmbodimentScore().totalLoopsCompleted).toBe(0);

    let actionResult: any;

    for (let i = 0; i < 3; i++) {
      actionResult = await cortex.executeAction(
        {
          actionType: 'api_call',
          taskType: 'data-fetch',
          description: 'Fetch user data',
          feedbackModality: 'http_response',
          action: 'api_call',
          agent: 'test-agent',
          options: [{ label: 'Call API', confidence: 0.9, risk: 'low' }],
          criteria: ['endpoint-verified'],
          verified: { 'endpoint-verified': true },
          prediction: {
            expectedOutcome: 'success',
            expectedConfidence: 0.9,
            expectedSideEffects: []
          }
        },
        async () => {
          // Simulate network delay
          vi.advanceTimersByTime(150);
          return { data: 'ok' };
        }
      );
    }

    expect(actionResult.evaluation.approved).toBe(true);
    expect(actionResult.result).toEqual({ data: 'ok' });
    
    // Verify the sensorimotor loop recorded the outcomes automatically
    // 3 loops for the internal 'evaluate' cognitive action, 3 for the physical action.
    const embodiment = sLoop.getEmbodimentScore();
    expect(embodiment.totalLoopsCompleted).toBe(6);
    expect(embodiment.actionTypesExperienced).toBe(2);
    expect(embodiment.feedbackModalitiesExperienced).toBe(2); // 'internal' from observer, and whatever we passed ('text' by default maybe, wait we passed 'api_response' -> 'internal'?)
    
    // Mastery should now be established for this action
    expect(sLoop.getMastery('api_call', 'data-fetch')).toBeGreaterThan(0.5);
  });

  it('records failures and actively avoids them in the future (Active Inference)', async () => {
    const cortex = getCortexEngine({ mode: 'silent' });
    const sLoop = getSensorimotorLoop();
    
    // 1. Force failures to tank the mastery score
    for (let i = 0; i < 3; i++) {
      try {
        await cortex.executeAction(
          {
            actionType: 'deploy',
            taskType: 'production',
            description: 'Bad deploy',
            feedbackModality: 'runtime_error',
            action: 'deploy',
            agent: 'test-agent',
            options: [{ label: 'Deploy now', confidence: 0.9, risk: 'medium' }],
            criteria: ['verified'],
            verified: { 'verified': true },
            prediction: { expectedOutcome: 'success', expectedConfidence: 0.9, expectedSideEffects: [] }
          },
          async () => {
            throw new Error('Deployment crashed');
          }
        );
      } catch (e) {
        // Expected
      }
    }

    // 2. Mastery for deploy should be very low now
    const mastery = sLoop.getMastery('deploy', 'production');
    expect(mastery).toBeLessThan(0.4);

    // 3. Try to do it again with moderate confidence (0.5).
    // Normally 0.5 > 0.3 threshold, so it would pass.
    // BUT Active Inference should raise the threshold to 0.7 because mastery is < 0.4.
    const result2 = cortex.evaluate({
      action: 'deploy',
      agent: 'test-agent',
      options: [{ label: 'Deploy again', confidence: 0.6, risk: 'low' }], // 0.6 score
      criteria: ['verified'],
      evidence: { 'verified': true }
    });

    expect(result2.approved).toBe(false);
    expect(result2.reason).toContain('ACTIVE INFERENCE REJECTION');
    expect(result2.reason).toContain('Required confidence raised to 0.7');
  });

  it('intercepts global fetch and updates environmental resonance', async () => {
    // 1. Patch fetch
    patchGlobalFetch();
    
    // 2. Mock the actual window.fetch implementation (which we just wrapped)
    // Wait, patchGlobalFetch wraps globalThis.fetch. In vitest, we need to ensure the inner fetch works or is mocked.
    // Since we don't have a real fetch in node by default (unless Node 18+), let's mock it on globalThis first.
    const mockInnerFetch = vi.fn().mockResolvedValue({ ok: true });
    // We have to unpatch, set mock, then repatch
    restoreGlobalFetch();
    globalThis.fetch = mockInnerFetch;
    patchGlobalFetch();

    // 3. Make some fetch calls
    await globalThis.fetch('https://api.openai.com/v1/chat/completions');
    await globalThis.fetch('https://api.anthropic.com/v1/messages');
    
    // 4. Verify environmental metrics picked it up
    const env = sampleEnvironment();
    expect(env.system.totalAiCalls).toBeGreaterThanOrEqual(2);
    expect(env.system.aiSuccessRate).toBe(1.0);
    
    // Make a failing call
    mockInnerFetch.mockRejectedValueOnce(new Error('Network error'));
    try {
      await globalThis.fetch('https://api.openai.com/v1/chat/completions');
    } catch (e) {
      // Expected
    }
    
    const env2 = sampleEnvironment();
    expect(env2.system.totalAiCalls).toBeGreaterThanOrEqual(3);
    // Our interceptor logs these specifically as AI category.
    expect(env2.system.aiSuccessRate).toBeLessThan(1.0);
  });
});
