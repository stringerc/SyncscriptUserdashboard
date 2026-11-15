import { describe, it, expect, beforeEach } from 'vitest';
import {
  isAcousticEcho,
  tokenizeText,
  EfferenceCopyManager,
  INTERRUPT_COMMANDS,
} from '../../../utils/cortex-efference-copy';

describe('Efference Copy & Acoustic Echo Cancellation Filter', () => {
  const activeAiSpeech = 'Hello! I am Cortex, monitoring your cognitive workload and energy rhythms in real time.';
  const recentHistory = ['Your phi consciousness score is currently one point two four.'];

  it('detects exact phrase echo as self-speech', () => {
    const micInput = 'Hello I am Cortex monitoring your cognitive workload';
    const result = isAcousticEcho(micInput, activeAiSpeech);
    expect(result.isEcho).toBe(true);
    expect(result.matchRatio).toBeGreaterThanOrEqual(0.8);
  });

  it('detects fragmented audio bleed as self-speech', () => {
    const micInput = 'monitoring your cognitive workload';
    const result = isAcousticEcho(micInput, activeAiSpeech);
    expect(result.isEcho).toBe(true);
  });

  it('detects speech reverberation from recent history', () => {
    const micInput = 'phi consciousness score';
    const result = isAcousticEcho(micInput, activeAiSpeech, recentHistory);
    expect(result.isEcho).toBe(true);
  });

  it('permits genuine barge-in with explicit interrupt keyword', () => {
    const micInput = 'wait stop talking';
    const result = isAcousticEcho(micInput, activeAiSpeech);
    expect(result.isEcho).toBe(false);
    expect(result.reason).toBe('explicit_interrupt');
  });

  it('permits genuine user question with divergent vocabulary', () => {
    const micInput = 'Can you schedule my dentist appointment for Thursday afternoon?';
    const result = isAcousticEcho(micInput, activeAiSpeech);
    expect(result.isEcho).toBe(false);
    expect(result.matchRatio).toBeLessThan(0.4);
    expect(result.reason).toBe('divergent_speech');
  });

  it('permits natural conversational interruption without explicit interrupt keywords', () => {
    // User interrupts mid-sentence to steer topic to Salvation Army Atlanta
    const micInput = 'What assistance programs exist for electric bills in Atlanta?';
    const result = isAcousticEcho(micInput, activeAiSpeech);
    expect(result.isEcho).toBe(false);
    expect(result.reason).toBe('divergent_speech');
  });

  it('permits terse conversational objections', () => {
    const micInput = 'No not that one';
    const result = isAcousticEcho(micInput, activeAiSpeech);
    expect(result.isEcho).toBe(false);
  });

  describe('EfferenceCopyManager', () => {
    let manager: EfferenceCopyManager;

    beforeEach(() => {
      manager = new EfferenceCopyManager(10000);
    });

    it('tracks active vocalization and suppresses speaker bleed', () => {
      manager.setActiveUtterance('Scanning your browser tabs for Salvation Army resources.');
      const echo = manager.evaluate('Scanning your browser tabs');
      expect(echo.isEcho).toBe(true);

      const bargeIn = manager.evaluate('Close the duplicate tabs please');
      expect(bargeIn.isEcho).toBe(false);
    });

    it('retains recent utterances in decaying history for reverberation suppression', () => {
      manager.setActiveUtterance('Initial sentence about cognitive load.');
      manager.finishUtterance();

      // Utterance is now in history
      const echo = manager.evaluate('cognitive load');
      expect(echo.isEcho).toBe(true);

      // Divergent user query still allowed
      const userQuery = manager.evaluate('What is my energy score today?');
      expect(userQuery.isEcho).toBe(false);
    });

    it('clears active utterance immediately on barge-in interrupt', () => {
      manager.setActiveUtterance('Very long explanation that is interrupted...');
      manager.interrupt();
      // After interrupt, active is cleared
      const test = manager.evaluate('Very long explanation');
      expect(test.isEcho).toBe(false);
    });
  });
});
