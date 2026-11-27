import { describe, it, expect } from 'vitest';
import { createProvenanceStripper } from './provenance-tags';

describe('createProvenanceStripper', () => {
  it('passes through prose untouched', () => {
    const s = createProvenanceStripper('test');
    expect(s.push('The fleet looks ') + s.push('healthy today.') + s.flush()).toBe('The fleet looks healthy today.');
  });

  it('strips a complete tag', () => {
    const s = createProvenanceStripper('test');
    const out = s.push('Memory free is 31% [measured:system_vitals]. ') + s.flush();
    expect(out).toBe('Memory free is 31% . ');
    expect(s.tags()).toEqual(['[measured:system_vitals]']);
  });

  it('handles a tag split across chunks', () => {
    const s = createProvenanceStripper('test');
    let out = s.push('Port 3000 is up [meas');
    out += s.push('ured:cortex_health] per the probe.');
    out += s.flush();
    expect(out).toBe('Port 3000 is up  per the probe.');
    expect(s.tags()).toEqual(['[measured:cortex_health]']);
  });

  it('handles [memory] and [unverified] variants', () => {
    const s = createProvenanceStripper('test');
    const out = s.push('I recall [memory:3d] that we discussed this [unverified] guess.') + s.flush();
    expect(out).toBe('I recall  that we discussed this  guess.');
    expect(s.tags()).toEqual(['[memory:3d]', '[unverified]']);
  });

  it('leaves non-tag brackets alone', () => {
    const s = createProvenanceStripper('test');
    const out = s.push('See [WORLD-STATE] and [sic] for details.') + s.flush();
    expect(out).toBe('See [WORLD-STATE] and [sic] for details.');
    expect(s.tags()).toEqual([]);
  });

  it('releases an unterminated bracket at flush', () => {
    const s = createProvenanceStripper('test');
    const out = s.push('Text ending with [incomplete') + s.flush();
    expect(out).toBe('Text ending with [incomplete');
  });

  it('strips multiple tags in one stream', () => {
    const s = createProvenanceStripper('test');
    const out = s.push('A [measured:exec] B [memory] C [unverified] D') + s.flush();
    expect(out).toBe('A  B  C  D');
    expect(s.tags()).toHaveLength(3);
  });
});
