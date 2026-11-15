import { describe, it, expect, beforeEach } from 'vitest';
import { WakeWordGate } from '../cortex-wake-word';

describe('WakeWordGate', () => {
  let gate: WakeWordGate;

  beforeEach(() => {
    gate = new WakeWordGate({
      wakeWord: 'cortex',
      windowMs: 20_000,
      refractoryMs: 1_000,
    });
  });

  it('starts in asleep state', () => {
    expect(gate.isAwake()).toBe(false);
  });

  it('drops ambient speech when asleep', () => {
    const res = gate.feed('can you pass the salt please');
    expect(res.action).toBe('drop');
    expect(gate.isAwake()).toBe(false);
  });

  it('wakes on "hey cortex" alone', () => {
    const res = gate.feed('hey cortex');
    expect(res.action).toBe('wake');
    if (res.action === 'wake') {
      expect(res.remainder).toBe('');
    }
    expect(gate.isAwake()).toBe(true);
  });

  it('wakes on "cortex" alone', () => {
    const res = gate.feed('cortex');
    expect(res.action).toBe('wake');
    if (res.action === 'wake') {
      expect(res.remainder).toBe('');
    }
    expect(gate.isAwake()).toBe(true);
  });

  it('wakes and extracts command in one breath: "hey cortex open the map"', () => {
    const res = gate.feed('hey cortex open the map');
    expect(res.action).toBe('wake');
    if (res.action === 'wake') {
      expect(res.remainder).toBe('open the map');
    }
    expect(gate.isAwake()).toBe(true);
  });

  it('wakes and extracts command in one breath: "cortex close the pinned items"', () => {
    const res = gate.feed('cortex close the pinned items');
    expect(res.action).toBe('wake');
    if (res.action === 'wake') {
      expect(res.remainder).toBe('close the pinned items');
    }
    expect(gate.isAwake()).toBe(true);
  });

  it('passes follow-up utterances while inside active conversation window', () => {
    // Wake up
    gate.feed('hey cortex');
    expect(gate.isAwake()).toBe(true);

    // Follow up without wake word
    const res = gate.feed('what is the system status');
    expect(res.action).toBe('pass');
    if (res.action === 'pass') {
      expect(res.text).toBe('what is the system status');
    }
    expect(gate.isAwake()).toBe(true);
  });

  it('resets back to asleep when reset() or sleep() is called', () => {
    gate.feed('hey cortex');
    expect(gate.isAwake()).toBe(true);
    gate.sleep();
    expect(gate.isAwake()).toBe(false);
  });

  it('enters standby when user says "go to sleep" while awake', () => {
    gate.feed('hey cortex');
    expect(gate.isAwake()).toBe(true);
    const res = gate.feed('go to sleep');
    expect(res.action).toBe('sleep');
    expect(gate.isAwake()).toBe(false);
  });

  it('enters standby when user says "goodbye cortex"', () => {
    gate.feed('hey cortex');
    expect(gate.isAwake()).toBe(true);
    const res = gate.feed('goodbye cortex');
    expect(res.action).toBe('sleep');
    expect(gate.isAwake()).toBe(false);
  });

  it('silently re-arms without re-awakening when already awake and hearing "hey cortex"', () => {
    // First wake
    const first = gate.feed('hey cortex');
    expect(first.action).toBe('wake');
    expect(gate.isAwake()).toBe(true);

    // Second "hey cortex" while already awake must NOT return 'wake'
    const second = gate.feed('hey cortex');
    expect(second.action).toBe('rearm');
    expect(gate.isAwake()).toBe(true);
  });
});

