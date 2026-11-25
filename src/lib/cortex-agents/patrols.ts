/**
 * Patrols + Autonomous Initiative (fleet spec §3).
 *
 * Two layers:
 *
 * 1. Verification-gated remediation. WARDEN's patrol already detects anomalies
 *    and auto-dispatches heal_anomaly — but unilaterally. This module subscribes
 *    to `warden.patrol` events: an unhealthy report opens a peer review
 *    (verification.ts) instead of healing immediately. Unanimous approve →
 *    the heal dispatch fires (same endpoint/cooldown warden used). Contest,
 *    split, or timeout → the verification pipeline's escalation path files
 *    the evidence packet into the Initiative Inbox. Warden skips its own
 *    dispatch while the gate is active (patrolHealGateEnabled).
 *
 * 2. Patrol specs. JSON definitions — built-ins plus .cortex/patrols/*.json —
 *    register as runtime routines. On completion, a ```patrol_finding fenced
 *    block in the result opens a verification; approval dispatches the spec's
 *    remediation task. Clean runs (no block) cost nothing.
 *
 * State: .cortex-runtime/patrols-state.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { openVerification, setOnVerificationResolvedHook, type Verification } from './verification';
import type { AgentEvent, AgentTask } from './types';

const STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const STATE_PATH = path.join(STATE_DIR, 'patrols-state.json');
const PATROL_DIR = path.join(process.cwd(), '.cortex', 'patrols');
const PORT = process.env.PORT || '5173';
const BASE = `http://127.0.0.1:${PORT}`;
const HEAL_DISPATCH_COOLDOWN_MS = 30 * 60_000;
const HEAL_INFLIGHT_KIND = 'heal_anomaly';

interface PatrolState {
  pendingHeals: Record<string, { anomalies: string[]; warnings: string[]; subject: string; at: number; remediate?: { agentId: string; kind: string; title: string } }>;
  lastHealDispatchAt: number;
  findings: { patrolId: string; verificationId: string; at: number }[];
}

function loadState(): PatrolState {
  try {
    if (!fs.existsSync(STATE_PATH)) return { pendingHeals: {}, lastHealDispatchAt: 0, findings: [] };
    const d = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
    return { pendingHeals: d.pendingHeals ?? {}, lastHealDispatchAt: d.lastHealDispatchAt ?? 0, findings: (d.findings ?? []).slice(-100) };
  } catch { return { pendingHeals: {}, lastHealDispatchAt: 0, findings: [] }; }
}

function saveState(s: PatrolState) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
  } catch { /* best-effort */ }
}

let gateActive = false;
/** Warden checks this: while true, heal dispatch is owned by the patrol gate. */
export function patrolHealGateEnabled(): boolean { return gateActive; }

interface RuntimeLike {
  subscribe(fn: (e: AgentEvent) => void): () => void;
  addRoutine(raw: { agentId: any; kind: string; title: string; input?: Record<string, unknown>; everyMinutes?: number; enabled?: boolean }): { ok: boolean; reason?: string };
  submitTask(agentId: any, kind: string, title: string, input?: Record<string, unknown>): { ok: boolean; error?: string };
}

async function healInFlight(): Promise<boolean> {
  try {
    const st: any = await fetch(`${BASE}/api/cortex/agents/state`, { signal: AbortSignal.timeout(3000) }).then((r) => r.json());
    return (st?.tasks || []).some((t: any) => t.kind === HEAL_INFLIGHT_KIND && (t.status === 'queued' || t.status === 'running'));
  } catch { return false; }
}

/** Dispatch the remediation task — same contract warden used. */
async function dispatchHeal(anomalies: string[], warnings: string[], subject: string) {
  const state = loadState();
  const now = Date.now();
  if (await healInFlight()) return { dispatched: false, reason: 'heal already in flight' };
  if (now - state.lastHealDispatchAt < HEAL_DISPATCH_COOLDOWN_MS) {
    return { dispatched: false, reason: 'heal cooldown active' };
  }
  state.lastHealDispatchAt = now;
  saveState(state);
  const anomalySummary = anomalies[0]?.slice(0, 72) ?? subject.slice(0, 72);
  try {
    const r = await fetch(`${BASE}/api/cortex/agents/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'antigravity',
        kind: HEAL_INFLIGHT_KIND,
        title: `Patrol-Gated Anomaly Repair: ${anomalySummary}`,
        input: {
          anomalies, warnings,
          instruction: `Peer review approved this anomaly report (${subject}). Analyze and resolve it. Verify with npm run verify:cortex before completing.`,
          autoHeal: true,
          patrolVerification: true,
        },
      }),
    });
    return { dispatched: r.ok, reason: r.ok ? undefined : `http ${r.status}` };
  } catch (e: any) {
    return { dispatched: false, reason: String(e?.message || e).slice(0, 120) };
  }
}

let activeRuntime: RuntimeLike | null = null;

function onVerificationResolved(v: Verification) {
  const state = loadState();
  const pending = state.pendingHeals[v.id];
  if (!pending) return;
  delete state.pendingHeals[v.id];

  if (v.status === 'approved') {
    if (pending.remediate && activeRuntime) {
      // Spec-defined remediation task (patrol specs), not the warden heal path.
      activeRuntime.submitTask(pending.remediate.agentId as any, pending.remediate.kind, pending.remediate.title, {
        anomalies: pending.anomalies, warnings: pending.warnings, patrolVerification: v.id, autoHeal: true,
      });
      state.findings.push({ patrolId: pending.subject, verificationId: v.id, at: Date.now() });
      saveState(state);
      return;
    }
    void dispatchHeal(pending.anomalies, pending.warnings, pending.subject)
      .then((r) => { state.findings.push({ patrolId: pending.subject, verificationId: v.id, at: Date.now() }); saveState(state); });
  } else if (v.status === 'contested') {
    // Peers say it is not a real anomaly — recorded, no heal, no proposal.
    state.findings.push({ patrolId: pending.subject, verificationId: v.id, at: Date.now() });
    saveState(state);
  }
  // 'escalated'/'expired': verification.escalate already filed the evidence
  // packet into the Initiative Inbox — nothing more to do here.
}

// ── Patrol specs ──────────────────────────────────────────────────────────

export interface PatrolSpec {
  id: string;
  name: string;
  agentId: string;
  kind: string;
  title: string;
  input?: Record<string, unknown>;
  everyMinutes: number;
  enabled?: boolean;
  verify?: { verifierIds?: string[]; windowMs?: number };
  remediate?: { agentId?: string; kind?: string; title?: string };
}

// No built-in routine specs: warden's patrol is already dispatched by the
// veto-gated interval in vite.config — registering a routine here would
// double-run it. The warden.patrol EVENT path below is the verification
// gate for that existing patrol. File-based specs in .cortex/patrols/*.json
// define additional patrols.
const DEFAULT_PATROLS: PatrolSpec[] = [];

const PATROL_FINDING_RE = /```patrol_finding\s*\n([\s\S]*?)```/g;

function parseFindings(resultText: string): { claim: string; evidence: string; severity?: string }[] {
  const out: { claim: string; evidence: string; severity?: string }[] = [];
  let m: RegExpExecArray | null;
  PATROL_FINDING_RE.lastIndex = 0;
  while ((m = PATROL_FINDING_RE.exec(resultText))) {
    try {
      const o = JSON.parse(m[1].trim());
      if (o?.claim) out.push({ claim: String(o.claim).slice(0, 500), evidence: String(o.evidence ?? '').slice(0, 2000), severity: o.severity ? String(o.severity) : undefined });
    } catch { /* malformed block — skip */ }
  }
  return out;
}

function loadSpecs(): PatrolSpec[] {
  const specs = [...DEFAULT_PATROLS];
  try {
    if (fs.existsSync(PATROL_DIR)) {
      for (const f of fs.readdirSync(PATROL_DIR).filter((n) => n.endsWith('.json')).sort()) {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(PATROL_DIR, f), 'utf-8'));
          const list = Array.isArray(d) ? d : [d];
          for (const s of list) {
            if (s?.id && s?.agentId && s?.kind && s?.title && s?.everyMinutes) {
              specs.push({ enabled: true, ...s } as PatrolSpec);
            }
          }
        } catch { /* skip malformed spec file */ }
      }
    }
  } catch { /* dir absent */ }
  return specs;
}

/** Wire patrols into a live runtime. Idempotent-ish: routines dedupe by
 *  agentId+kind+title inside addRoutine, so re-arming is safe. */
export function startPatrolMesh(runtime: RuntimeLike): { armed: number; specs: PatrolSpec[] } {
  gateActive = true;
  activeRuntime = runtime;
  setOnVerificationResolvedHook(onVerificationResolved);

  const specs = loadSpecs();
  let armed = 0;
  for (const spec of specs) {
    if (spec.enabled === false) continue;
    const r = runtime.addRoutine({
      agentId: spec.agentId, kind: spec.kind, title: spec.title,
      input: { ...(spec.input ?? {}), patrolId: spec.id },
      everyMinutes: spec.everyMinutes, enabled: true,
    });
    // Dedupe returns the existing routine with ok:false — still counts as armed.
    if (r.ok || (r as any).routine) armed++;
  }

  runtime.subscribe((e) => {
    try {
      if (e.type === 'warden.patrol' && !e.report.healthy && e.report.anomalies.length) {
        const subject = `warden-patrol:${e.report.checks.filter((c) => !c.ok).map((c) => c.name).join(',') || 'anomaly'}`;
        const claim = e.report.anomalies.join(' | ').slice(0, 800);
        const evidence = JSON.stringify({ anomalies: e.report.anomalies, warnings: e.report.warnings, checks: e.report.checks }, null, 2).slice(0, 3500);
        const opened = openVerification({
          subject, claim, evidence, requestedBy: 'warden',
          verifierIds: ['reviewer', 'sentinel'], windowMs: 5 * 60_000,
        });
        if (opened.ok && opened.verification) {
          const state = loadState();
          state.pendingHeals[opened.verification.id] = {
            anomalies: e.report.anomalies, warnings: e.report.warnings, subject, at: Date.now(),
          };
          saveState(state);
        }
        return;
      }
      if (e.type === 'task.transition' && e.task.status === 'completed') {
        const task = e.task as AgentTask;
        const patrolId = String(task.input?.patrolId || '');
        if (!patrolId) return;
        const spec = specs.find((s) => s.id === patrolId);
        if (!spec) return;
        const text = typeof task.result === 'string' ? task.result : JSON.stringify(task.result ?? '');
        const findings = parseFindings(text);
        for (const f of findings.slice(0, 3)) {
          const opened = openVerification({
            subject: `patrol:${spec.id}`, claim: f.claim,
            evidence: `${f.evidence}\nseverity: ${f.severity ?? 'unknown'}\nsource task: ${task.id}`,
            requestedBy: spec.agentId,
            verifierIds: spec.verify?.verifierIds, windowMs: spec.verify?.windowMs,
          });
          if (opened.ok && opened.verification) {
            const state = loadState();
            state.pendingHeals[opened.verification.id] = {
              anomalies: [f.claim], warnings: [], subject: `patrol:${spec.id}`, at: Date.now(),
              remediate: spec.remediate
                ? { agentId: spec.remediate.agentId ?? spec.agentId, kind: spec.remediate.kind ?? 'heal_anomaly', title: spec.remediate.title ?? `Patrol remediation: ${spec.name}` }
                : undefined,
            };
            state.findings.push({ patrolId: spec.id, verificationId: opened.verification.id, at: Date.now() });
            saveState(state);
          }
        }
      }
    } catch { /* event handlers must never break the runtime */ }
  });

  return { armed, specs };
}

export function patrolState() {
  const s = loadState();
  return {
    pendingHeals: Object.keys(s.pendingHeals).length,
    lastHealDispatchAt: s.lastHealDispatchAt || null,
    recentFindings: s.findings.slice(-20),
  };
}

export function listPatrolSpecs(): PatrolSpec[] { return loadSpecs(); }
