import { describe, expect, it } from 'vitest';
import { DETERMINISTIC_TASKS, parseLightCommand } from '../cortex-agents/lights';
import type { AgentContext } from '../cortex-agents/runtime';

function ctxFor(task: { kind: string; input?: Record<string, unknown> }): AgentContext {
  return {
    task: { id: 't1', agentId: 'runner', kind: task.kind, title: 't', input: task.input ?? {}, status: 'running', createdAt: 0 } as any,
    progress: () => {},
    llm: async () => '',
    emit: () => {},
    signal: new AbortController().signal,
    telemetry: { llmCalls: 0, tokensIn: 0, tokensOut: 0, llmMs: 0, toolCalls: 0, toolFailures: 0 },
  };
}

describe('parseLightCommand', () => {
  it('parses power off', () => {
    expect(parseLightCommand('turn the lights off').power).toBe('off');
    expect(parseLightCommand('lights off please').power).toBe('off');
  });
  it('parses power on', () => {
    expect(parseLightCommand('turn on the govee lights').power).toBe('on');
  });
  it('parses brightness percent', () => {
    expect(parseLightCommand('set brightness to 40%').brightness).toBe(40);
    expect(parseLightCommand('dim the lights to 20').brightness).toBe(20);
  });
  it('parses dim/brighter defaults', () => {
    expect(parseLightCommand('dim the lights').brightness).toBe(30);
    expect(parseLightCommand('make them brighter').brightness).toBe(100);
  });
  it('parses hex and named colors', () => {
    expect(parseLightCommand('set color #ff8800').colorHex).toBe('#ff8800');
    expect(parseLightCommand('make the lights purple').colorHex).toBe('#a855f7');
    expect(parseLightCommand('lights to cyberpunk').colorHex).toBe('#e879f9');
  });
  it('parses mood only when mood/vibe/mode word present', () => {
    expect(parseLightCommand('set mood to working').mood).toBe('working');
    expect(parseLightCommand('working lights').mood).toBeUndefined();
  });
  it('marks unparseable input', () => {
    expect(parseLightCommand('do something with the lights').unparsed).toBeTruthy();
  });
  it('combines ops', () => {
    const ops = parseLightCommand('turn lights on at 50% in red');
    expect(ops.power).toBe('on');
    expect(ops.brightness).toBe(50);
    expect(ops.colorHex).toBe('#ff0000');
  });
});

describe('deterministic task kinds', () => {
  it('exposes lights_status and lights_set', () => {
    expect(DETERMINISTIC_TASKS.lights_status).toBeTypeOf('function');
    expect(DETERMINISTIC_TASKS.lights_set).toBeTypeOf('function');
  });

  it('lights_set rejects unparseable input honestly', async () => {
    const ctx = ctxFor({ kind: 'lights_set', input: { instruction: 'flibberty gibbet' } });
    await expect(DETERMINISTIC_TASKS.lights_set(ctx)).rejects.toThrow(/could not parse/);
  });

  it('lights_set accepts structured args without instruction', async () => {
    // No GOVEE_API_KEY in test env → fails at key check AFTER parse, proving parse passed.
    const ctx = ctxFor({ kind: 'lights_set', input: { power: 'on' } });
    await expect(DETERMINISTIC_TASKS.lights_set(ctx)).rejects.toThrow(/GOVEE_API_KEY|broadcastPower/);
  });

  it('lights_status requires API key', async () => {
    const ctx = ctxFor({ kind: 'lights_status' });
    const prev = process.env.GOVEE_API_KEY;
    delete process.env.GOVEE_API_KEY;
    try {
      await expect(DETERMINISTIC_TASKS.lights_status(ctx)).rejects.toThrow(/GOVEE_API_KEY/);
    } finally {
      if (prev) process.env.GOVEE_API_KEY = prev;
    }
  });
});
