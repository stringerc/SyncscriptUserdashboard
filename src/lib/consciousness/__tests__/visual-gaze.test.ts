import { describe, it, expect } from 'vitest';
import {
  evaluateVisualExpectation,
  runAppleVisionOcr,
  performVisualGaze,
} from '../../../utils/cortex-visual-gaze';
import fs from 'fs';

describe('Cortex Visual Gaze Subsystem', () => {
  it('confirms positive visual active inference expectations', () => {
    const observed = ['The Matrix Res', '127.0.0.1:5173/cortex', 'SyncScript', 'LISTENING...', 'ADVISORY'];
    const result = evaluateVisualExpectation(observed, 'SyncScript cortex listening');
    expect(result.verified).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.matchedExpectations.length).toBeGreaterThan(0);
  });

  it('rejects visual expectation when error overlay is detected', () => {
    const observed = ['SyntaxError', 'Failed to compile', 'useVoiceStream'];
    const result = evaluateVisualExpectation(observed, 'SyncScript listening', true);
    expect(result.verified).toBe(false);
    expect(result.confidence).toBe(0.1);
    expect(result.message).toContain('Visual regression detected');
  });

  it('detects missing expectations when prediction error occurs', () => {
    const observed = ['Button', 'Cancel', 'Close'];
    const result = evaluateVisualExpectation(observed, 'Salvation Army emergency relief form');
    expect(result.verified).toBe(false);
    expect(result.missingExpectations).toContain('salvation');
  });

  it('executes native Apple Silicon Vision OCR on local screenshot if present', async () => {
    if (fs.existsSync('/tmp/chrome_window.png')) {
      const items = await runAppleVisionOcr('/tmp/chrome_window.png');
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]).toHaveProperty('text');
      expect(items[0]).toHaveProperty('confidence');
    }
  });

  it('executes performVisualGaze unified dispatcher', async () => {
    const result = await performVisualGaze({
      target: 'canvas',
      expectation: 'SyncScript'
    });
    expect(result.ok).toBe(true);
    expect(result.screenshotPath).toBeDefined();
    expect(result.elementsSummary).toBeDefined();
    expect(result.verification).toBeDefined();
  });
});

