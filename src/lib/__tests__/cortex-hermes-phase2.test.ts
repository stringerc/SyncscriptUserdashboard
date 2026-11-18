/**
 * Operational Mind Phase 2 — Hermes Collapse Gate Validation Suite
 *
 * Verifies all victory conditions for Phase 2 of OPERATIONAL_MIND_OPENCLAW_HERMES_MISSION.md:
 * 1. Mutating tools route ONLY via Hermes /v1/invoke.
 * 2. Unapproved / blocked tools NEVER touch Hermes.
 * 3. Every Hermes invoke generates run_id + audit trace[] + idempotency verification.
 * 4. Contract runtime dispatches `agent.run.*` dock events for dock visibility.
 * 5. In-process and HTTP adapter endpoints (POST /cortex/openclaw/invoke) enforce the collapse gate.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import {
  CortexOpenClawAdapter,
  type OpenClawToolCall,
} from '../cortex-openclaw-adapter';
import { getGlobalWorkspace } from '../global-workspace';
import { createCortexRoutes } from '../cortex-api-routes';
import { listRecentContractEvents } from '../../contracts/runtime/contract-runtime';

describe('Operational Mind Phase 2 — Hermes Collapse Gate', () => {
  let adapter: CortexOpenClawAdapter;
  let hermesMockServer: http.Server;
  const seenIdempotencyKeys = new Set<string>();
  const LOCAL_HERMES_URL = 'http://127.0.0.1:18880';
  const MOCK_JWT = 'Bearer test-jwt-token-operational-mind-phase2';

  beforeAll(async () => {
    hermesMockServer = http.createServer((req, res) => {
      if (req.method === 'POST' && (req.url === '/v1/invoke' || req.url === '/v1/invoke/')) {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          let parsed: any = {};
          try {
            parsed = JSON.parse(body || '{}');
          } catch {
            parsed = {};
          }

          const idemKey = parsed.idempotency_key;
          const isDeduped = Boolean(idemKey && seenIdempotencyKeys.has(idemKey));
          if (idemKey) {
            seenIdempotencyKeys.add(idemKey);
          }

          const run_id = `hermes-run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const trace = [
            { step: 'parse', status: 'ok', at: new Date().toISOString() },
            ...(isDeduped
              ? [{ step: 'idempotency', status: 'ok', detail: 'duplicate key found', at: new Date().toISOString() }]
              : []),
            { step: 'execute', status: 'ok', detail: `Tool ${parsed.tool} dispatched`, at: new Date().toISOString() },
          ];

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              ok: true,
              tool: parsed.tool,
              run_id,
              result: { executed: true, calendarHoldId: 'hold-123' },
              trace,
              deduped: isDeduped ? true : undefined,
            }),
          );
        });
        return;
      }
      res.writeHead(404).end();
    });

    await new Promise<void>((resolve, reject) => {
      hermesMockServer.listen(18880, '127.0.0.1', () => resolve());
      hermesMockServer.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // Port 18880 already running Hermes mock/executor — reuse existing server
          resolve();
        } else {
          reject(err);
        }
      });
    });
  });

  afterAll(async () => {
    if (hermesMockServer && hermesMockServer.listening) {
      await new Promise<void>((resolve) => {
        hermesMockServer.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    const workspace = getGlobalWorkspace();
    workspace.setLesioned('none');
    adapter = new CortexOpenClawAdapter();
  });

  // ── 1. Gated Routing Verification ──────────────────────────────────────

  describe('Mutating Tools Route Exclusively Through Hermes', () => {
    it('routes approved mutating tool (create_calendar_hold) via Hermes /v1/invoke', async () => {
      const toolCall: OpenClawToolCall = {
        tool: 'create_calendar_hold',
        args: {
          title: 'Deep Work Session',
          start_iso: '2026-10-30T14:00:00Z',
          idempotency_key: `test-hold-${Date.now()}`,
        },
        evidence: {
          idempotency_key_checked: true,
          start_time_iso_verified: true,
        },
      };

      const result = await adapter.executeGatedTool(toolCall, {
        accessToken: MOCK_JWT,
        hermesBaseUrl: LOCAL_HERMES_URL,
      });

      expect(result.decisionRecord.approved).toBe(true);
      expect(result.routedViaHermes).toBe(true);
      expect(result.run_id).toBeDefined();
      expect(Array.isArray(result.trace)).toBe(true);
      expect(result.trace?.length).toBeGreaterThan(0);
      expect(result.trace?.some((t) => t.step === 'parse')).toBe(true);
    });

    it('routes non-mutating perception tools (read_file) directly without invoking Hermes', async () => {
      const toolCall: OpenClawToolCall = {
        tool: 'read_file',
        args: { path: '/Users/Apple/syncscript/package.json' },
      };

      const result = await adapter.executeGatedTool(toolCall, {
        accessToken: MOCK_JWT,
        hermesBaseUrl: LOCAL_HERMES_URL,
      });

      expect(result.ok).toBe(true);
      expect(result.decisionRecord.approved).toBe(true);
      expect(result.routedViaHermes).toBe(false);
      expect(result.result).toEqual({ executed: true, modality: 'perception' });
    });
  });

  // ── 2. Blocked Actions Never Reach Hermes ──────────────────────────────

  describe('Blocked Actions Never Touch Hermes', () => {
    it('refuses unverified mutating tool before Hermes invocation', async () => {
      const toolCall: OpenClawToolCall = {
        tool: 'apply_task_patch',
        args: { task_id: 'task-unverified-1', patch: { status: 'done' } },
        evidence: {}, // Missing criteria
      };

      const result = await adapter.executeGatedTool(toolCall, {
        accessToken: MOCK_JWT,
        hermesBaseUrl: LOCAL_HERMES_URL,
      });

      expect(result.ok).toBe(false);
      expect(result.decisionRecord.approved).toBe(false);
      expect(result.routedViaHermes).toBe(false);
      expect(result.error).toContain('CORTEX BLOCKED');
    });

    it('blocks high-risk destructive actions without reaching Hermes', async () => {
      const toolCall: OpenClawToolCall = {
        tool: 'drop_database',
        args: { database: 'production' },
        evidence: {},
      };

      const result = await adapter.executeGatedTool(toolCall, {
        accessToken: MOCK_JWT,
        hermesBaseUrl: LOCAL_HERMES_URL,
      });

      expect(result.ok).toBe(false);
      expect(result.decisionRecord.policy).toBe('abort');
      expect(result.routedViaHermes).toBe(false);
    });
  });

  // ── 3. Idempotency & Audit Trail ───────────────────────────────────────

  describe('Idempotency & Trace Preservation', () => {
    it('detects duplicate idempotency key and marks deduped', async () => {
      const idemKey = `idem-dedupe-test-${Date.now()}`;
      const toolCall: OpenClawToolCall = {
        tool: 'create_calendar_hold',
        args: {
          title: 'Idempotency Verification',
          start_iso: '2026-10-30T15:00:00Z',
          idempotency_key: idemKey,
        },
        evidence: {
          idempotency_key_checked: true,
          start_time_iso_verified: true,
        },
      };

      // First invoke
      const first = await adapter.executeGatedTool(toolCall, {
        accessToken: MOCK_JWT,
        hermesBaseUrl: LOCAL_HERMES_URL,
      });
      expect(first.routedViaHermes).toBe(true);

      // Duplicate invoke with same key
      const duplicate = await adapter.executeGatedTool(toolCall, {
        accessToken: MOCK_JWT,
        hermesBaseUrl: LOCAL_HERMES_URL,
      });

      expect(duplicate.routedViaHermes).toBe(true);
      expect(duplicate.deduped).toBe(true);
      expect(duplicate.trace?.some((t) => t.step === 'idempotency')).toBe(true);
    });
  });

  // ── 4. Dock Event Emission (agent.run.*) ────────────────────────────────

  describe('Contract Dock Events Emission', () => {
    it('emits agent.run.started, agent.run.step, agent.run.completed events', async () => {
      const toolCall: OpenClawToolCall = {
        tool: 'create_calendar_hold',
        args: {
          title: 'Dock Event Trace Test',
          start_iso: '2026-10-30T16:00:00Z',
          idempotency_key: `dock-test-${Date.now()}`,
        },
        evidence: {
          idempotency_key_checked: true,
          start_time_iso_verified: true,
        },
      };

      await adapter.executeGatedTool(toolCall, {
        accessToken: MOCK_JWT,
        hermesBaseUrl: LOCAL_HERMES_URL,
        emitDockEvents: true,
      });

      const events = listRecentContractEvents(50);
      const eventTypes = events.map((e) => e.eventType);

      expect(eventTypes).toContain('agent.run.started');
      expect(eventTypes).toContain('agent.run.step');
      expect(eventTypes).toContain('agent.run.completed');
    });
  });

  // ── 5. HTTP Endpoint (POST /cortex/openclaw/invoke) ─────────────────────

  describe('HTTP Route POST /cortex/openclaw/invoke', () => {
    it('executes gated Hermes invocation via HTTP route handler', async () => {
      const routes = createCortexRoutes();

      const fakeRequest = {
        json: async () => ({
          tool: 'create_calendar_hold',
          args: {
            title: 'HTTP Gated Hold',
            start_iso: '2026-10-30T17:00:00Z',
            idempotency_key: `http-hold-${Date.now()}`,
          },
          evidence: {
            idempotency_key_checked: true,
            start_time_iso_verified: true,
          },
        }),
        header: (name: string) => {
          if (name.toLowerCase() === 'authorization') return MOCK_JWT;
          if (name.toLowerCase() === 'x-hermes-base-url') return LOCAL_HERMES_URL;
          return undefined;
        },
      };

      const res = await routes.openclawInvoke(fakeRequest);
      expect(res.success).toBe(true);
      expect(res.data?.routedViaHermes).toBe(true);
      expect(res.data?.run_id).toBeDefined();
      expect(res.data?.trace?.length).toBeGreaterThan(0);
    });
  });
});
