import { describe, it, expect } from 'vitest';
import {
  looksLikeToolOrJson,
  stripResidualToolCalls,
  cleanSpeech,
  isInsideToolCall,
} from '../../components/cortex/useVisualizerVoice';

describe('Cortex Voice Speech Sanitizer & Zero-JSON-Leakage Gate', () => {
  describe('looksLikeToolOrJson', () => {
    it('detects tool call fences and keywords', () => {
      expect(looksLikeToolOrJson('```tool_call\n{"tool":"cortex_agents"}\n```')).toBe(true);
      expect(looksLikeToolOrJson('<tool_call>')).toBe(true);
      expect(looksLikeToolOrJson('tool_call {"tool": "system_info"}')).toBe(true);
    });

    it('detects fragmented JSON parameters (the exact user leak bug)', () => {
      expect(looksLikeToolOrJson(',"targetAgent":"cortex"}}}')).toBe(true);
      expect(looksLikeToolOrJson('{"tool":"cortex_agents"}')).toBe(true);
      expect(looksLikeToolOrJson('"targetAgent": "cortex"')).toBe(true);
      expect(looksLikeToolOrJson('{"action":"task","agentId":"antigravity"}')).toBe(true);
      expect(looksLikeToolOrJson('Acknowledge receipt and report current operational status.","targetAgent":"cortex"}}}')).toBe(true);
    });

    it('allows natural spoken English without false positives', () => {
      expect(looksLikeToolOrJson('Directive transmitted to Antigravity. Quantum channels are locked.')).toBe(false);
      expect(looksLikeToolOrJson("I'm checking the fleet status now.")).toBe(false);
      expect(looksLikeToolOrJson('Telemetry is streaming live on the Foundry deck.')).toBe(false);
      expect(looksLikeToolOrJson('All systems nominal, Chris.')).toBe(false);
    });
  });

  describe('stripResidualToolCalls & cleanSpeech', () => {
    it('completely drops the user bug leak text', () => {
      const leaked = 'Acknowledge receipt and report current operational status.","targetAgent":"cortex"}}}';
      expect(cleanSpeech(leaked)).toBe('');
    });

    it('completely drops standalone fragmented JSON keys and braces', () => {
      expect(cleanSpeech(',"targetAgent":"cortex"}}}')).toBe('');
      expect(cleanSpeech('{"tool":"cortex_agents"}')).toBe('');
      expect(cleanSpeech('```tool_call\n{"tool":"test"}\n```')).toBe('');
    });

    it('preserves clean spoken sentences', () => {
      const goodSentence = 'Directive transmitted to Antigravity — quantum channel is active.';
      expect(cleanSpeech(goodSentence)).toBe(goodSentence);
    });

    it('strips residual fences and leaves surrounding clean speech', () => {
      const mixed = 'Understood. ```tool_call\n{"tool":"test"}\n``` I will monitor the telemetry.';
      expect(cleanSpeech(mixed)).toBe('Understood. I will monitor the telemetry.');
    });
  });

  describe('isInsideToolCall', () => {
    it('returns true when inside an odd number of fences', () => {
      expect(isInsideToolCall('Starting turn\n```tool_call\n{"tool":"cortex_agents"')).toBe(true);
    });

    it('returns false when fences are closed', () => {
      expect(isInsideToolCall('Starting turn\n```tool_call\n{"tool":"cortex_agents"}\n```\nAll done.')).toBe(false);
    });

    it('returns true when streaming inside an unclosed bare JSON tool call', () => {
      expect(isInsideToolCall('{"tool": "cortex_agents", "args": {"title": "status."')).toBe(true);
    });

    it('returns false for normal conversational content without tool calls', () => {
      expect(isInsideToolCall('Hello Chris, how are things going today?')).toBe(false);
    });
  });
});
