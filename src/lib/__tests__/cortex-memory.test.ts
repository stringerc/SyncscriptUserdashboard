import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  recallCortexMemory,
  retainCortexMemory,
  maybeRetainEvent,
  _resetCortexMemoryForTest,
} from '../cortex-memory';

describe('Cortex Memory (Hindsight client)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    _resetCortexMemoryForTest();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    _resetCortexMemoryForTest();
    vi.unstubAllGlobals();
  });

  it('recall returns formatted context block on success', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      results: [{ text: 'fact one' }, { text: 'fact two' }],
    }), { status: 200 }));
    const ctx = await recallCortexMemory('what happened');
    expect(ctx).toContain('PRIOR MEMORY');
    expect(ctx).toContain('- fact one');
    expect(ctx).toContain('- fact two');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/default/banks/cortex/memories/recall');
    expect(JSON.parse(init.body).query).toBe('what happened');
  });

  it('recall returns empty string on HTTP error', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 503 }));
    expect(await recallCortexMemory('q')).toBe('');
  });

  it('recall returns empty string on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await recallCortexMemory('q')).toBe('');
  });

  it('recall returns empty string for empty query without fetching', async () => {
    expect(await recallCortexMemory('   ')).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('recall truncates results and caps lines', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      results: Array.from({ length: 10 }, (_, i) => ({ text: `fact-${i} ` + 'x'.repeat(400) })),
    }), { status: 200 }));
    const ctx = await recallCortexMemory('q');
    expect(ctx).toContain('- fact-0');
    expect(ctx).not.toContain('- fact-9');
    for (const line of ctx.split('\n').filter((l) => l.startsWith('- '))) {
      expect(line.length).toBeLessThanOrEqual(304);
    }
  });

  it('retain posts items payload and returns true on 200', async () => {
    fetchMock.mockResolvedValue(new Response('{"success":true}', { status: 200 }));
    expect(await retainCortexMemory('hello', 'ctx', '2026-01-01T00:00:00Z')).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/v1/default/banks/cortex/memories');
    const body = JSON.parse(init.body);
    expect(body.items[0].content).toBe('hello');
    expect(body.items[0].context).toBe('ctx');
    expect(body.items[0].timestamp).toBe('2026-01-01T00:00:00Z');
  });

  it('retain returns false on failure and rejects empty content', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    expect(await retainCortexMemory('x')).toBe(false);
    expect(await retainCortexMemory('')).toBe(false);
    expect(await retainCortexMemory('   ')).toBe(false);
  });

  it('retain truncates oversized content', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await retainCortexMemory('y'.repeat(10_000));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.items[0].content.length).toBe(4000);
  });

  it('maybeRetainEvent ignores non-qualifying event types', () => {
    maybeRetainEvent({ type: 'agent.comm', agentId: 'a' });
    maybeRetainEvent({ type: 'task.progress', task: { status: 'running' } });
    // No timer started, no fetch
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maybeRetainEvent queues completed task transitions', async () => {
    vi.useFakeTimers();
    try {
      maybeRetainEvent({
        type: 'task.transition',
        task: { status: 'completed', title: 'build feature', agentId: 'builder-1' },
      });
      // flush fires on interval; advance past throttle window
      await vi.advanceTimersByTimeAsync(16_000);
      expect(fetchMock).toHaveBeenCalled();
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.items[0].content).toContain('Task completed');
      expect(body.items[0].content).toContain('build feature');
    } finally {
      vi.useRealTimers();
    }
  });
});
