import { describe, it, expect } from 'vitest';
import { normalizeForSpeech } from '../tts-speech-normalize';

describe('normalizeForSpeech', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeForSpeech('')).toBe('');
    expect(normalizeForSpeech(null as any)).toBe('');
  });

  it('expands snake_case identifiers', () => {
    expect(normalizeForSpeech('checking cortex_observability_hud now'))
      .toBe('checking cortex observability hud now');
  });

  it('splits camelCase identifiers but leaves normal words alone', () => {
    expect(normalizeForSpeech('running fetchKokoroBufferForNexusSegment'))
      .toBe('running fetch Kokoro Buffer For Nexus Segment');
    expect(normalizeForSpeech('the quick brown fox')).toBe('the quick brown fox');
  });

  it('spells out known acronyms', () => {
    expect(normalizeForSpeech('the API and TTS are live'))
      .toBe('the A P I and T T S are live');
    expect(normalizeForSpeech('OK then')).toBe('okay then');
    expect(normalizeForSpeech('use JSON output')).toBe('use J son output');
  });

  it('lowercases unknown ALLCAPS words so TTS reads them, not spells them', () => {
    // Uppercase passthrough made TTS spell tokens letter-by-letter
    // ("IS" → "I… S"). Lowercase reads as a natural word.
    expect(normalizeForSpeech('NASA launched')).toBe('nasa launched');
    expect(normalizeForSpeech('this IS important')).toBe('this is important');
  });

  it('handles percentages, currency, versions, phi', () => {
    expect(normalizeForSpeech('progress is 35% at Φ=1.15, costs $5, v1.2.3'))
      .toBe('progress is 35 percent at phi=1.15, costs 5 dollars, version 1.2.3');
  });

  it('strips emoji and markdown, keeps link labels', () => {
    expect(normalizeForSpeech('Done ✅ see [the docs](https://x.com) and `some_code` **bold**'))
      .toBe('Done see the docs and some code bold');
  });

  it('expands e.g. and i.e.', () => {
    expect(normalizeForSpeech('tools, e.g. scout and builder, i.e. the fleet'))
      .toBe('tools, for example scout and builder, that is the fleet');
  });

  it('collapses whitespace and orphan punctuation', () => {
    expect(normalizeForSpeech('hello   world ,  test')).toBe('hello world, test');
  });

  it('handles multi-word jargon phrases', () => {
    expect(normalizeForSpeech('websocket reconnect failed')).toBe('web socket reconnect failed');
  });
});
