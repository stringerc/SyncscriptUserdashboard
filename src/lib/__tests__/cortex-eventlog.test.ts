import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  initEventLog,
  appendEvent,
  readEvents,
  recoverNextSeq,
  getEventLogStats,
  getDayFileName,
  _resetEventLogForTest,
} from '../cortex-agents/eventlog';
import type { AgentEvent } from '../cortex-agents/types';

describe('Cortex EventLog (Persistent Event Sourcing)', () => {
  const testStateDir = path.join(process.cwd(), '.cortex-runtime', 'test-eventlog');
  const testLogDir = path.join(testStateDir, 'eventlog');
  const originalEnv = process.env.CORTEX_AGENTS_STATE_DIR;

  beforeEach(() => {
    process.env.CORTEX_AGENTS_STATE_DIR = testStateDir;
    fs.rmSync(testStateDir, { recursive: true, force: true });
    _resetEventLogForTest();
  });

  afterEach(() => {
    _resetEventLogForTest();
    fs.rmSync(testStateDir, { recursive: true, force: true });
    if (originalEnv) {
      process.env.CORTEX_AGENTS_STATE_DIR = originalEnv;
    } else {
      delete process.env.CORTEX_AGENTS_STATE_DIR;
    }
  });

  it('assigns monotonic seq numbers and writes JSONL records', () => {
    const ev1: AgentEvent = {
      type: 'agent.status',
      agentId: 'sentinel',
      status: 'working',
      at: Date.now(),
    };
    const ev2: AgentEvent = {
      type: 'agent.status',
      agentId: 'scout',
      status: 'idle',
      at: Date.now() + 10,
    };

    const p1 = appendEvent(ev1);
    const p2 = appendEvent(ev2);

    expect(p1).not.toBeNull();
    expect(p2).not.toBeNull();
    expect(p1!.seq).toBe(1);
    expect(p2!.seq).toBe(2);

    const stats = getEventLogStats();
    expect(stats.nextSeq).toBe(3);
    expect(stats.fileCount).toBeGreaterThanOrEqual(1);

    const events = readEvents();
    expect(events.length).toBe(2);
    expect(events[0].seq).toBe(1);
    expect(events[0].type).toBe('agent.status');
    expect(events[0].agentId).toBe('sentinel');
    expect(events[1].seq).toBe(2);
    expect(events[1].agentId).toBe('scout');
  });

  it('supports filtering by since, until, and limit', () => {
    for (let i = 1; i <= 10; i++) {
      appendEvent({
        type: 'task.progress',
        taskId: `task-${i}`,
        progress: i / 10,
        at: 1000 + i * 100,
      } as AgentEvent);
    }

    // Filter since seq 4
    const since4 = readEvents({ since: 4 });
    expect(since4.length).toBe(7);
    expect(since4[0].seq).toBe(4);
    expect(since4[since4.length - 1].seq).toBe(10);

    // Filter until seq 6
    const until6 = readEvents({ until: 6 });
    expect(until6.length).toBe(6);
    expect(until6[until6.length - 1].seq).toBe(6);

    // Range [3, 7]
    const range = readEvents({ since: 3, until: 7 });
    expect(range.length).toBe(5);
    expect(range.map((r) => r.seq)).toEqual([3, 4, 5, 6, 7]);

    // Limit
    const limited = readEvents({ limit: 3 });
    expect(limited.length).toBe(3);
    expect(limited.map((r) => r.seq)).toEqual([1, 2, 3]);
  });

  it('supports filtering by type and agentId', () => {
    appendEvent({
      type: 'agent.status',
      agentId: 'devin',
      status: 'working',
      at: 1000,
    });
    appendEvent({
      type: 'agent.comm',
      from: 'antigravity',
      to: 'devin',
      channel: 'directive',
      message: 'Relay baton',
      at: 1010,
    });
    appendEvent({
      type: 'task.transition',
      task: { id: 't-1', agentId: 'builder', kind: 'code', title: 'test', input: {}, status: 'running', progress: null, createdAt: 1020 },
      at: 1020,
    });

    // Filter by type
    const comms = readEvents({ types: ['agent.comm'] });
    expect(comms.length).toBe(1);
    expect(comms[0].type).toBe('agent.comm');

    // Filter by agent involvement (devin as recipient/actor)
    const devinEvents = readEvents({ agentId: 'devin' });
    expect(devinEvents.length).toBe(2);
    expect(devinEvents[0].type).toBe('agent.status');
    expect(devinEvents[1].type).toBe('agent.comm');

    // Filter builder
    const builderEvents = readEvents({ agentId: 'builder' });
    expect(builderEvents.length).toBe(1);
    expect(builderEvents[0].type).toBe('task.transition');
  });

  it('recovers nextSeq correctly after reboot', () => {
    appendEvent({ type: 'agent.status', agentId: 'sentinel', status: 'idle', at: 1000 });
    appendEvent({ type: 'agent.status', agentId: 'builder', status: 'idle', at: 1010 });
    appendEvent({ type: 'agent.status', agentId: 'devin', status: 'working', at: 1020 });

    // Simulate restart
    _resetEventLogForTest();
    expect(recoverNextSeq()).toBe(4);

    const recovered = appendEvent({ type: 'agent.status', agentId: 'antigravity', status: 'working', at: 1030 });
    expect(recovered!.seq).toBe(4);
  });

  it('subscribes seamlessly to runtime via initEventLog', () => {
    const fakeRuntime: any = {
      listeners: new Set<any>(),
      subscribe(fn: any) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
      },
      emit(e: any) {
        for (const l of this.listeners) l(e);
      },
    };

    const unsub = initEventLog(fakeRuntime);

    fakeRuntime.emit({ type: 'agent.status', agentId: 'hermes', status: 'working', at: Date.now() });
    fakeRuntime.emit({ type: 'agent.status', agentId: 'curator', status: 'idle', at: Date.now() });

    const events = readEvents();
    expect(events.length).toBe(2);
    expect(events[0].agentId).toBe('hermes');
    expect(events[1].agentId).toBe('curator');

    unsub();
    fakeRuntime.emit({ type: 'agent.status', agentId: 'warden', status: 'idle', at: Date.now() });

    const eventsAfter = readEvents();
    expect(eventsAfter.length).toBe(2); // no new events captured
  });
});
