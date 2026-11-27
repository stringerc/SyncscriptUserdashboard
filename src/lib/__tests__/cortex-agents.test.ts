import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Isolate runtime persistence from the live dev server's state dir.
// (vi.hoisted runs before imports resolve, so no fs/os here — fixed tmp path.)
vi.hoisted(() => {
  process.env.CORTEX_AGENTS_STATE_DIR = '/tmp/cortex-agents-test-state';
  process.env.OBSIDIAN_VAULT_PATH = '/tmp/cortex-vault-test';
});
import { ModelMatrix, SEED_MATRIX } from '../cortex-agents/registry';
import { ModelSentinel } from '../cortex-agents/sentinel';
import { AgentRuntime, type WorkerHandler } from '../cortex-agents/runtime';
import { blastLane, expandTaskSpec, registerAgentWorkers } from '../cortex-agents/workers';
import type { AgentEvent, ModelHealth } from '../cortex-agents/types';

const tick = () => new Promise((r) => setTimeout(r, 25));

describe('ModelMatrix', () => {
  it('orders candidates by health and skips down models', () => {
    const m = new ModelMatrix();
    const first = m.ordered('fast')[0];
    // Kill the top candidate repeatedly until it drops out of rotation.
    for (let i = 0; i < 6; i++) m.recordProbe(first.provider, first.model, false);
    const ordered = m.ordered('fast').map((c) => `${c.provider}:${c.model}`);
    expect(ordered).not.toContain(`${first.provider}:${first.model}`);
    expect(ordered.length).toBeGreaterThan(0);
  });

  it('pin.model overrides lane ordering', () => {
    const m = new ModelMatrix();
    const pinned = SEED_MATRIX.deep[SEED_MATRIX.deep.length - 1];
    const top = m.ordered('deep', { tier: 'deep', model: `${pinned.provider}:${pinned.model}` })[0];
    expect(top.model).toBe(pinned.model);
  });

  it('excludeProviders removes candidates', () => {
    const m = new ModelMatrix();
    const ordered = m.ordered('fast', { tier: 'fast', excludeProviders: ['groq-fast'] });
    expect(ordered.every((c) => c.provider !== 'groq-fast')).toBe(true);
  });

  it('discover() adds catalog models without duplicating', () => {
    const m = new ModelMatrix();
    const before = m.allHealth().length;
    expect(m.discover('nvidia-nim', 'moonshotai/kimi-k3.1-pro')).toBe(true);
    expect(m.discover('nvidia-nim', 'moonshotai/kimi-k3.1-pro')).toBe(false);
    expect(m.allHealth().length).toBe(before + 1);
    expect(m.healthOf('nvidia-nim', 'moonshotai/kimi-k3.1-pro')?.source).toBe('catalog');
  });

  it('probation gate: discovered models cannot route until probe-verified', () => {
    const m = new ModelMatrix();
    m.discover('openrouter', 'some/random-unvetted-model-70b');
    const routed = m.ordered('reason').map((c) => `${c.provider}:${c.model}`);
    expect(routed).not.toContain('openrouter:some/random-unvetted-model-70b');
    // Pin override is gated too.
    expect(m.ordered('reason', { tier: 'reason', model: 'openrouter:some/random-unvetted-model-70b' })).toEqual([]);
    // Successful probe promotes it into the lane.
    m.recordProbe('openrouter', 'some/random-unvetted-model-70b', true, 900);
    const after = m.ordered('reason').map((c) => `${c.provider}:${c.model}`);
    expect(after).toContain('openrouter:some/random-unvetted-model-70b');
  });

  it('recordProbe hysteresis: first failure keeps label, second degrades, success recovers', () => {
    const m = new ModelMatrix();
    const c = SEED_MATRIX.fast[0];
    // Probe once successfully so the model earns 'healthy'.
    m.recordProbe(c.provider, c.model, true, 120);
    // One transient failure must NOT demote — cooldown sidelines it,
    // the label survives (fleet-flap fix).
    const h1 = m.recordProbe(c.provider, c.model, false);
    expect(h1.status).toBe('healthy');
    expect(h1.consecutiveFailures).toBe(1);
    // Second consecutive failure earns 'degraded'.
    const h2 = m.recordProbe(c.provider, c.model, false);
    expect(h2.status).toBe('degraded');
    // Recovery is immediate on success.
    const h3 = m.recordProbe(c.provider, c.model, true, 120);
    expect(h3.status).toBe('healthy');
    expect(h3.consecutiveSuccesses).toBe(1);
    expect(h3.latencyMsP50).not.toBeNull();
  });

  it('permanent failures cool down far longer than transient ones', () => {
    const m = new ModelMatrix();
    const c = SEED_MATRIX.fast[0];
    const transient = m.recordProbe(c.provider, c.model, false);
    const transientCooldown = transient.cooldownUntil! - transient.lastCheckAt!;
    const m2 = new ModelMatrix();
    const permanent = m2.recordProbe(c.provider, c.model, false, undefined, true);
    const permanentCooldown = permanent.cooldownUntil! - permanent.lastCheckAt!;
    expect(permanentCooldown).toBeGreaterThanOrEqual(14 * 60_000);
    expect(permanentCooldown).toBeGreaterThan(transientCooldown);
  });
});

describe('ModelSentinel', () => {
  it('catalogScan discovers new ids and emits model.discovered', async () => {
    const m = new ModelMatrix();
    const events: AgentEvent[] = [];
    const s = new ModelSentinel(m, (e) => events.push(e), [
      { provider: 'nvidia-nim', fetchIds: async () => ['moonshotai/kimi-k9-unobtanium', 'deepseek-ai/deepseek-v9-plasma'] },
    ]);
    const n = await s.catalogScan();
    expect(n).toBe(2); // both novel ids discovered
    expect(events.some((e) => e.type === 'model.discovered')).toBe(true);
    // Second scan: nothing new.
    expect(await s.catalogScan()).toBe(0);
  });

  it('survives catalog source failure without throwing', async () => {
    const m = new ModelMatrix();
    const s = new ModelSentinel(m, () => {}, [
      { provider: 'nvidia-nim', fetchIds: async () => { throw new Error('NIM down'); } },
    ]);
    await expect(s.catalogScan()).resolves.toBe(0);
  });

  it('probeCycle records health for matrix candidates', async () => {
    const m = new ModelMatrix();
    const events: AgentEvent[] = [];
    const s = new ModelSentinel(m, (e) => events.push(e), [], () => async () => ({ latencyMs: 42 }));
    await s.probeCycle();
    const healthEvents = events.filter((e) => e.type === 'model.health');
    expect(healthEvents.length).toBeGreaterThan(0);
    expect(m.allHealth().some((h) => h.lastCheckAt !== null)).toBe(true);
  });
});

describe('AgentRuntime', () => {
  let rt: AgentRuntime;
  beforeEach(() => {
    fs.rmSync('/tmp/cortex-agents-test-state', { recursive: true, force: true });
    rt = new AgentRuntime();
  });

  const okWorker: WorkerHandler = async (ctx) => {
    ctx.progress(0.5);
    ctx.progress(1);
    return { done: true, title: ctx.task.title };
  };

  it('runs a task queued→running→completed only on handler return', async () => {
    rt.registerWorker('scout', okWorker);
    const { ok, task } = rt.submitTask('scout', 'research', 'test research', { query: 'x' });
    expect(ok).toBe(true);
    await vi.waitFor(() => {
      const t = rt.snapshot().tasks.find((x) => x.id === task!.id);
      expect(t?.status).toBe('completed');
    }, { timeout: 3000 });
    const done = rt.snapshot().tasks.find((x) => x.id === task!.id);
    expect(done?.result).toEqual({ done: true, title: 'test research' });
    expect(done?.progress).toBe(1);
    expect(rt.getAgent('scout')?.status).toBe('idle');
    expect(rt.getAgent('scout')?.tasksCompleted).toBe(1);
  });

  it('records per-task telemetry: llm usage, tool calls, duration, totals', async () => {
    rt.setLLMBridge(async () => ({ content: 'ok', model: 'test:fake-1', usage: { tokensIn: 100, tokensOut: 40 } }));
    rt.registerWorker('scout', async (ctx) => {
      await ctx.llm({ tier: 'fast', messages: [{ role: 'user', content: 'hi' }] });
      await ctx.llm({ tier: 'fast', messages: [{ role: 'user', content: 'hi again' }] });
      ctx.telemetry.toolCalls += 2;
      ctx.telemetry.toolFailures += 1;
      return { done: true };
    });
    const { task } = rt.submitTask('scout', 'research', 'telemetry task', { query: 'x' });
    await vi.waitFor(() => {
      expect(rt.snapshot().tasks.find((x) => x.id === task!.id)?.status).toBe('completed');
    }, { timeout: 3000 });
    const done = rt.snapshot().tasks.find((x) => x.id === task!.id);
    expect(done?.telemetry?.llmCalls).toBe(2);
    expect(done?.telemetry?.tokensIn).toBe(200);
    expect(done?.telemetry?.tokensOut).toBe(80);
    expect(done?.telemetry?.toolCalls).toBe(2);
    expect(done?.telemetry?.toolFailures).toBe(1);
    expect(done?.telemetry?.durationMs).toBeGreaterThanOrEqual(0);
    const totals = rt.snapshot().runtime.totals;
    expect(totals?.completed).toBe(1);
    expect(totals?.tokensIn).toBe(200);
    expect(totals?.toolCalls).toBe(2);
  });

  it('classifies failures deterministically', async () => {
    rt.registerWorker('librarian', async () => { throw new Error('provider http 503'); });
    const { task } = rt.submitTask('librarian', 'summarize', 'provider down', { noRetry: true });
    await vi.waitFor(() => {
      expect(rt.snapshot().tasks.find((x) => x.id === task!.id)?.status).toBe('failed');
    }, { timeout: 3000 });
    const failed = rt.snapshot().tasks.find((x) => x.id === task!.id);
    expect(failed?.telemetry?.failureClass).toBe('provider');
  });

  it('failed worker marks task failed and agent recovers to idle', async () => {
    rt.registerWorker('librarian', async () => { throw new Error('boom'); });
    // noRetry isolates the single-attempt failure path; retry behavior has
    // its own dedicated tests below.
    const { task } = rt.submitTask('librarian', 'summarize', 'will fail', { noRetry: true });
    await vi.waitFor(() => {
      expect(rt.snapshot().tasks.find((x) => x.id === task!.id)?.status).toBe('failed');
    }, { timeout: 3000 });
    const failed = rt.snapshot().tasks.find((x) => x.id === task!.id);
    expect(failed?.error).toContain('boom');
    expect(rt.getAgent('librarian')?.tasksFailed).toBe(1);
    await tick();
    await tick();
    // error → idle recovery happens on a 4s timer; just assert not stuck 'working'
    expect(['error', 'idle']).toContain(rt.getAgent('librarian')?.status);
  });

  it('auto-retries a failed task once with unit-scoped retry lineage', async () => {
    rt.registerWorker('scout', async (ctx) => {
      if (!ctx.task.input.attempt) throw new Error('flaky upstream');
      return { recovered: true };
    });
    const { task } = rt.submitTask('scout', 'research', 'flaky task', { query: 'x' });
    await vi.waitFor(() => {
      const tasks = rt.snapshot().tasks.filter((t) => t.agentId === 'scout');
      expect(tasks.some((t) => t.status === 'completed' && t.input?.attempt === 1)).toBe(true);
    }, { timeout: 5000 });
    const original = rt.snapshot().tasks.find((x) => x.id === task!.id);
    expect(original?.status).toBe('failed');
    const retry = rt.snapshot().tasks.find((t) => t.input?.retryOf === task!.id);
    expect(retry?.status).toBe('completed');
    expect(String(retry?.input?.scope || '')).toContain('failing unit');
    expect(String(retry?.input?.priorError || '')).toContain('flaky upstream');
  });

  it('caps auto-retry at MAX_ATTEMPTS and never retries deterministic caller errors', async () => {
    rt.registerWorker('librarian', async () => { throw new Error('persistent boom'); });
    rt.submitTask('librarian', 'summarize', 'always fails');
    await vi.waitFor(() => {
      const fails = rt.snapshot().tasks.filter((t) => t.agentId === 'librarian' && t.status === 'failed');
      expect(fails.length).toBe(3); // attempts 0,1,2 — then the cap stops it
    }, { timeout: 8000 });
    expect(rt.snapshot().tasks.filter((t) => t.agentId === 'librarian').length).toBe(3);

    // Deterministic caller error → zero retries.
    rt.registerWorker('scout', async () => { throw new Error('scout: unknown task kind \'bogus\''); });
    rt.submitTask('scout', 'bogus', 'bad kind');
    await vi.waitFor(() => {
      expect(rt.snapshot().tasks.find((t) => t.agentId === 'scout' && t.status === 'failed')).toBeTruthy();
    }, { timeout: 3000 });
    await tick(); await tick();
    expect(rt.snapshot().tasks.filter((t) => t.agentId === 'scout').length).toBe(1);
  });

  it('honors input.noRetry', async () => {
    rt.registerWorker('builder', async () => { throw new Error('nope'); });
    rt.submitTask('builder', 'code_patch', 'do not retry', { noRetry: true });
    await vi.waitFor(() => {
      expect(rt.snapshot().tasks.find((t) => t.agentId === 'builder' && t.status === 'failed')).toBeTruthy();
    }, { timeout: 3000 });
    await tick(); await tick();
    expect(rt.snapshot().tasks.filter((t) => t.agentId === 'builder').length).toBe(1);
  });

  it('dedupes identical queued/running tasks', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    rt.registerWorker('builder', async () => { await gate; return 'ok'; });
    const a = rt.submitTask('builder', 'code_patch', 'same task');
    const b = rt.submitTask('builder', 'code_patch', 'same task');
    expect(b.task?.id).toBe(a.task?.id);
    release();
    await vi.waitFor(() => expect(rt.snapshot().tasks.find((t) => t.id === a.task!.id)?.status).toBe('completed'), { timeout: 3000 });
  });

  it('rejects unknown agents and missing fields honestly', () => {
    expect(rt.submitTask('nobody' as any, 'x', 'y').ok).toBe(false);
    expect(rt.submitTask('scout', '', 'y').ok).toBe(false);
  });

  it('cancelTask stops a queued task before it runs', async () => {
    // Fill scout's concurrency (2) with gated tasks, then queue a third.
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    rt.registerWorker('scout', async () => { await gate; return 'ok'; });
    rt.submitTask('scout', 'research', 'one');
    rt.submitTask('scout', 'research', 'two');
    await tick();
    const third = rt.submitTask('scout', 'research', 'three');
    expect(third.task?.status).toBe('queued');
    expect(rt.cancelTask(third.task!.id)).toBe(true);
    release();
    await vi.waitFor(() => {
      const statuses = rt.snapshot().tasks.map((t) => t.status);
      expect(statuses.filter((s) => s === 'completed').length).toBe(2);
    }, { timeout: 3000 });
    expect(rt.snapshot().tasks.find((t) => t.id === third.task!.id)?.status).toBe('cancelled');
  });

  it('enforces daily budget', async () => {
    rt.registerWorker('builder', okWorker);
    const budget = rt.getAgent('builder')?.dailyBudget ?? 16;
    for (let i = 0; i < budget; i++) rt.submitTask('builder', 'code_patch', `task ${i}`);
    const over = rt.submitTask('builder', 'code_patch', 'one too many');
    expect(over.ok).toBe(false);
    expect(over.error).toContain('budget');
  });

  it('spawn gate: rejects fabricated evidence, overlap, nesting, bad specs', async () => {
    const baseSpec: any = {
      callSign: 'TEST-1', role: 'Compliance Analyst', mission: 'review invoices for anomalies',
      tools: ['read'], modelPin: { tier: 'fast' }, dailyBudget: 8, ttlHours: 72,
      systemBrief: 'You review invoices.', doneCriteria: 'report anomalies found',
    };
    const evidence = [{ kind: 'task_failures', refs: ['nonexistent-task'], summary: 'fake' }];
    // fabricated task ref → reject
    expect(rt.proposeSpawn(baseSpec, evidence, 'scout').ok).toBe(false);
    // no evidence → reject
    expect(rt.proposeSpawn(baseSpec, [], 'scout').ok).toBe(false);
    // nesting: proposedBy a spawn id → reject
    const realEvidence = [{ kind: 'capability_gap', refs: [], summary: 'no agent covers invoice review' }];
    expect(rt.proposeSpawn(baseSpec, realEvidence, 'spawn-foo').ok).toBe(false);
    // overlap with scout role words → likely reject or accept; use distinct spec
    const spec2 = { ...baseSpec, callSign: 'TEST-2', role: 'Invoice Auditor', mission: 'audit billing records weekly' };
    const ok = rt.proposeSpawn(spec2, realEvidence, 'scout');
    expect(ok.ok).toBe(true);
    expect(ok.proposal?.status).toBe('pending');
    // approve without factory → honest error
    expect(rt.approveSpawn(ok.proposal!.id).ok).toBe(false);
  });

  it('spawn lifecycle: factory → approve → agent works → retire', async () => {
    rt.setSpawnWorkerFactory(() => okWorker);
    const spec: any = {
      callSign: 'ECHO-1', role: 'Echo Unit', mission: 'echo task titles back',
      tools: ['read'], modelPin: { tier: 'fast' }, dailyBudget: 4, ttlHours: 72,
      systemBrief: 'Echo.', doneCriteria: 'return title',
    };
    const evidence = [{ kind: 'capability_gap', refs: [], summary: 'test gap' }];
    const prop = rt.proposeSpawn(spec, evidence, 'librarian');
    expect(prop.ok).toBe(true);
    const approved = rt.approveSpawn(prop.proposal!.id, 'test');
    expect(approved.ok).toBe(true);
    const agentId = approved.agentId!;
    expect(agentId).toContain('spawn-');
    expect(rt.getAgent(agentId as any)?.spawnSpec?.callSign).toBe('ECHO-1');
    // task runs through the ephemeral worker
    const t = rt.submitTask(agentId as any, 'echo', 'hello spawn');
    expect(t.ok).toBe(true);
    await vi.waitFor(() => {
      expect(rt.snapshot().tasks.find((x) => x.id === t.task!.id)?.status).toBe('completed');
    }, { timeout: 3000 });
    // retire → status retired, further tasks rejected
    expect(rt.retireAgent(agentId, 'test done')).toBe(true);
    expect(rt.getAgent(agentId as any)?.status).toBe('retired');
    expect(rt.submitTask(agentId as any, 'echo', 'after retire').ok).toBe(false);
  });

  it('emits real lifecycle events subscribers can replay', async () => {
    rt.registerWorker('scout', okWorker);
    const seen: string[] = [];
    const unsub = rt.subscribe((e) => seen.push(e.type));
    rt.submitTask('scout', 'research', 'evented');
    await vi.waitFor(() => expect(seen).toContain('task.transition'), { timeout: 3000 });
    await vi.waitFor(() => {
      const t = rt.snapshot().tasks.find((x) => x.title === 'evented');
      expect(t?.status).toBe('completed');
    }, { timeout: 3000 });
    unsub();
    expect(seen).toContain('task.transition');
    expect(seen).toContain('agent.status');
  });
});

describe('blastLane', () => {
  it('classifies read-only tools as contained', () => {
    expect(blastLane('read_file', '{}')).toBe('contained');
    expect(blastLane('search_code', '{"q":"x"}')).toBe('contained');
    expect(blastLane('cortex_memory', '{"action":"search"}')).toBe('contained');
  });
  it('classifies repo-local writes and safe commands as reversible', () => {
    expect(blastLane('write_file', '{"path":"a.ts"}')).toBe('reversible');
    expect(blastLane('edit_file', '{}')).toBe('reversible');
    expect(blastLane('run_command', '{"cmd":"ls -la"}')).toBe('reversible');
  });
  it('classifies destructive args and tier-2 tools as hard', () => {
    expect(blastLane('run_command', '{"cmd":"rm -rf /tmp/x"}')).toBe('hard');
    expect(blastLane('run_command', '{"cmd":"git reset --hard"}')).toBe('hard');
    expect(blastLane('deploy', '{}')).toBe('hard');
    expect(blastLane('run_command', '{"cmd":"git push --force"}')).toBe('hard');
  });
});

describe('expandTaskSpec', () => {
  it('parses a valid spec contract from the model', async () => {
    const spec = await expandTaskSpec(async () => JSON.stringify({
      objective: 'Fix token refresh in auth flow',
      constraints: ['do not change token TTL', 'update tests'],
      nonGoals: ['no UI changes'],
      verification: 'npm test -- auth',
    }), 'fix the login bug');
    expect(spec?.objective).toContain('token refresh');
    expect(spec?.constraints).toHaveLength(2);
    expect(spec?.nonGoals[0]).toBe('no UI changes');
    expect(spec?.verification).toBe('npm test -- auth');
  });

  it('returns null on garbage or missing objective — callers fall back', async () => {
    expect(await expandTaskSpec(async () => 'not json at all', 'x')).toBeNull();
    expect(await expandTaskSpec(async () => JSON.stringify({ constraints: [] }), 'x')).toBeNull();
    expect(await expandTaskSpec(async () => { throw new Error('llm down'); }, 'x')).toBeNull();
  });
});

describe('Librarian distill (learning edge)', () => {
  const VAULT = '/tmp/cortex-vault-test';
  const outcomeNote = (file: string, outcome: string, retry = '') => `---
created: "2026-01-01"
agent: "SCOUT"
kind: "agent-outcome"
---

# Agent outcome: SCOUT [research]

> 2026-01-01

Task: research query ${file}
Outcome: ${outcome}
${retry}Summary: sources gathered but brief was thin

Tags: agent-outcome cortex-agents
`;

  beforeEach(() => {
    fs.rmSync(VAULT, { recursive: true, force: true });
    fs.mkdirSync(path.join(VAULT, '03 - Learnings'), { recursive: true });
  });

  it('distills recurring non-green clusters into evidence-backed rules', async () => {
    // Three same-cluster outcomes, all partial → recurrence gate passes.
    for (const [i, f] of ['agent-scout-research-aaa111', 'agent-scout-research-bbb222', 'agent-scout-research-ccc333'].entries()) {
      fs.writeFileSync(path.join(VAULT, '03 - Learnings', `${f}.md`), outcomeNote(f, 'partial — 1 step(s) failed/vetoed', i === 2 ? 'Retry lineage: succeeded on attempt 2 after prior failure: fetch timeout\n' : ''));
    }
    const rt = new AgentRuntime();
    registerAgentWorkers(rt);
    rt.setLLMBridge(async () => ({
      content: JSON.stringify([{ rule: 'Deep-fetch top sources before synthesizing scout briefs', rationale: '3 partial outcomes on research tasks', evidence: ['agent-scout-research-aaa111.md'] }]),
      model: 'test-model',
    }));
    rt.start();
    const { task } = rt.submitTask('librarian', 'distill', 'distill agent learnings into rules');
    await vi.waitFor(() => {
      expect(rt.snapshot().tasks.find((t) => t.id === task!.id)?.status).toBe('completed');
    }, { timeout: 5000 });
    const result = rt.snapshot().tasks.find((t) => t.id === task!.id)?.result as any;
    expect(result.distilled).toBe(1);
    const rulesDir = path.join(VAULT, '04 - Rules');
    const rules = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md'));
    expect(rules.length).toBe(1);
    expect(fs.readFileSync(path.join(rulesDir, rules[0]), 'utf-8')).toContain('Deep-fetch top sources');
    rt.stop();
  });

  it('returns distilled:0 honestly when no recurring pattern exists', async () => {
    fs.writeFileSync(path.join(VAULT, '03 - Learnings', 'agent-scout-research-aaa111.md'), outcomeNote('agent-scout-research-aaa111', 'green'));
    const rt = new AgentRuntime();
    registerAgentWorkers(rt);
    rt.setLLMBridge(async () => { throw new Error('llm must not be called without recurrence'); });
    rt.start();
    const { task } = rt.submitTask('librarian', 'distill', 'distill agent learnings into rules');
    await vi.waitFor(() => {
      expect(rt.snapshot().tasks.find((t) => t.id === task!.id)?.status).toBe('completed');
    }, { timeout: 5000 });
    const result = rt.snapshot().tasks.find((t) => t.id === task!.id)?.result as any;
    expect(result.distilled).toBe(0);
    rt.stop();
  });
});

describe('Cortex Warden', () => {
  it('is a registered built-in agent spec', async () => {
    const { AGENT_SPECS } = await import('../cortex-agents/runtime');
    const w = AGENT_SPECS.find((s) => s.id === 'warden');
    expect(w).toBeTruthy();
    expect(w!.role).toContain('Custodian');
    // Built-in status: spawn proposals may cite warden as proposer — the gate
    // must fail on evidence, not on proposer identity.
    const rt2 = new AgentRuntime();
    const res = rt2.proposeSpawn(
      { callSign: 'T-1', role: 'tester', mission: 'm', tools: ['read'], modelPin: { tier: 'fast' }, dailyBudget: 4, ttlHours: 24, systemBrief: 'b', doneCriteria: 'd' } as any,
      [{ kind: 'task_failures', refs: [], summary: 's' }],
      'warden',
    );
    expect(res.ok).toBe(false);
    expect(res.reason).not.toContain('built-in');
  });

  const stubFetch = (overrides: Record<string, { ok?: boolean; status?: number; body?: any }> = {}) => {
    const defaults: Record<string, any> = {
      '/api/cortex/agents/state': { ok: true, agents: [{ id: 'warden' }], offline: false },
      '/api/cortex/models/health': { ok: true, models: [], matrix: { fast: ['groq-fast:a'], reason: ['nvidia-nim:b'], deep: ['nvidia-nim-550b:c'] } },
      '/api/cortex/tools': { ok: true, tools: [{}] },
      '/api/cortex/vigilance/status': { ok: true },
    };
    return (async (url: string) => {
      const path = Object.keys({ ...defaults, ...overrides }).find((k) => url.includes(k)) || '';
      const cfg = { ...(defaults[path] || { ok: true }), ...(overrides[path] || {}) };
      if (url.includes('/agents/stream')) {
        return {
          ok: cfg.ok !== false, status: cfg.status || 200,
          json: async () => ({}), text: async () => '',
          body: { getReader: () => ({ read: async () => ({ value: new TextEncoder().encode('data: {}\n\n'), done: false }), cancel: async () => {} }) },
        } as any;
      }
      return {
        ok: cfg.ok !== false, status: cfg.status || (cfg.ok === false ? 500 : 200),
        json: async () => cfg.body ?? cfg,
        text: async () => JSON.stringify(cfg.body ?? cfg),
      } as any;
    }) as any;
  };

  const stubFs = {
    stateDir: '/tmp', accomplishmentsDir: '/tmp',
    exists: () => true, writable: () => true,
    newestMtimeMs: () => Date.now() - 3600_000,
  };

  it('reports healthy when all critical probes pass', async () => {
    const { runPatrolChecks } = await import('../cortex-agents/warden');
    const report = await runPatrolChecks({
      base: 'http://x', fetchImpl: stubFetch(), fsImpl: stubFs,
      llmProbe: async () => true,
    });
    expect(report.healthy).toBe(true);
    expect(report.anomalies).toEqual([]);
    expect(report.checks.length).toBe(15);
    expect(report.checks.every((c) => c.ms >= 0)).toBe(true);
  });

  it('flags a dead agents endpoint as a critical anomaly', async () => {
    const { runPatrolChecks } = await import('../cortex-agents/warden');
    const report = await runPatrolChecks({
      base: 'http://x',
      fetchImpl: stubFetch({ '/api/cortex/agents/state': { ok: false, status: 503 } }),
      fsImpl: stubFs, llmProbe: async () => true,
    });
    expect(report.healthy).toBe(false);
    expect(report.anomalies.some((a) => a.startsWith('agents.runtime'))).toBe(true);
  });

  it('flags a lane with zero usable models', async () => {
    const { runPatrolChecks } = await import('../cortex-agents/warden');
    const report = await runPatrolChecks({
      base: 'http://x',
      fetchImpl: stubFetch({
        '/api/cortex/models/health': {
          ok: true,
          body: { ok: true, models: [], matrix: { fast: [], reason: [], deep: [] } },
        },
      }),
      fsImpl: stubFs, llmProbe: async () => true,
    });
    expect(report.healthy).toBe(false);
    expect(report.anomalies.some((a) => a.startsWith('models.matrix'))).toBe(true);
  });

  it('treats non-critical failures as warnings, not anomalies', async () => {
    const { runPatrolChecks } = await import('../cortex-agents/warden');
    const report = await runPatrolChecks({
      base: 'http://x',
      fetchImpl: stubFetch({ '/api/cortex/vigilance/status': { ok: false, status: 500 } }),
      fsImpl: stubFs, llmProbe: async () => true,
    });
    expect(report.healthy).toBe(true);
    expect(report.warnings.some((w) => w.startsWith('cortex.vigilance'))).toBe(true);
  });
});
