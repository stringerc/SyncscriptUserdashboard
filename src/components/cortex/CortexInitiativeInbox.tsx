/**
 * CortexInitiativeInbox — proactive proposal review surface.
 *
 * Renders ProactiveProposals from CortexProactiveInitiativeEngine as
 * accept/snooze/dismiss cards. Tier-2 proposals require typed "ACCEPT"
 * confirmation. Execution is delegated to the host via the
 * 'cortex-initiative-accept' window event (volition governor stays in
 * execTool). Activity tab shows executed/failed outcomes.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock, X, ShieldAlert, Zap, ShieldCheck, ShieldOff } from 'lucide-react';
import { C } from './cortex-demo-helpers';
import {
  getCortexProactiveInitiative,
  type ProactiveProposal,
} from '../../lib/cortex-proactive-initiative';
import {
  getCortexTrustLedger,
  isTrustEnabled,
  setTrustEnabled,
  GRADUATION_CLEAN_REQUIRED,
  GRADUATION_TOTAL_REQUIRED,
} from '../../lib/cortex-trust-ledger';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

const TIER_META: Record<number, { label: string; color: string }> = {
  0: { label: 'AUTO', color: C.green },
  1: { label: 'REVIEW', color: C.cyan },
  2: { label: 'CONFIRM', color: C.amber },
};

const URGENCY_COLOR: Record<string, string> = {
  high: C.red,
  medium: C.amber,
  low: C.dim,
};

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ProposalCard({ p }: { p: ProactiveProposal }) {
  const engine = getCortexProactiveInitiative();
  const [confirmText, setConfirmText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const tier = p.autonomyTier ?? (p.requiresApproval ? 2 : 1);
  const meta = TIER_META[tier];
  const isTier2 = tier === 2;
  const confirmed = confirmText.trim().toUpperCase() === 'ACCEPT';

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${URGENCY_COLOR[p.urgency] || C.dim}`,
        borderRadius: 8,
        padding: '10px 12px',
        background: C.surface,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: MONO }}>
              {p.title}
            </span>
            <span style={{ fontSize: 9, fontFamily: MONO, color: meta.color, border: `1px solid ${meta.color}55`, borderRadius: 3, padding: '0 4px' }}>
              {meta.label}
            </span>
            <span style={{ fontSize: 9, fontFamily: MONO, color: C.dim }}>
              {Math.round((p.epistemicConfidence ?? 0) * 100)}%
            </span>
          </div>
          <div style={{ fontSize: 11, color: C.dim, fontFamily: MONO, marginTop: 4, lineHeight: 1.5 }}>
            {p.summary}
          </div>
          {p.why && (
            <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, marginTop: 4, opacity: 0.7 }}>
              why: {p.why}
            </div>
          )}
          <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, marginTop: 4 }}>
            {p.category} · {p.suggestedTool} · {timeAgo(p.createdAt)}
          </div>
        </div>
        <button
          onClick={() => engine.dismissProposal(p.id)}
          title="Dismiss"
          style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', padding: 4 }}
        ><X size={13} /></button>
      </div>

      {isTier2 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ background: 'none', border: 'none', color: C.amber, fontSize: 10, fontFamily: MONO, cursor: 'pointer', padding: 0 }}
          >
            {expanded ? '▾ hide args' : '▸ review args'}
          </button>
          {expanded && (
            <pre style={{ fontSize: 9, color: C.dim, fontFamily: MONO, background: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 4, overflow: 'auto', maxHeight: 100, marginTop: 4 }}>
              {JSON.stringify(p.suggestedArgs, null, 2)}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder='type ACCEPT'
              style={{
                flex: 1, background: 'rgba(0,0,0,0.3)', border: `1px solid ${confirmed ? C.green : C.border}`,
                borderRadius: 4, color: C.text, fontSize: 10, fontFamily: MONO, padding: '4px 8px', outline: 'none',
              }}
            />
            <button
              disabled={!confirmed}
              onClick={() => { engine.acceptProposal(p.id); setConfirmText(''); }}
              style={{
                background: confirmed ? C.amber : 'transparent', color: confirmed ? C.bg : C.dim,
                border: `1px solid ${C.amber}`, borderRadius: 4, fontSize: 10, fontFamily: MONO,
                padding: '4px 10px', cursor: confirmed ? 'pointer' : 'not-allowed',
              }}
            >Confirm</button>
          </div>
        </div>
      )}

      {!isTier2 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            onClick={() => engine.acceptProposal(p.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(52,211,153,0.12)', color: C.green, border: `1px solid ${C.green}55`,
              borderRadius: 4, fontSize: 10, fontFamily: MONO, padding: '4px 10px', cursor: 'pointer',
            }}
          ><Check size={11} /> Accept</button>
          <button
            onClick={() => engine.snoozeProposal(p.id, Date.now() + 60 * 60 * 1000)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'transparent', color: C.dim, border: `1px solid ${C.border}`,
              borderRadius: 4, fontSize: 10, fontFamily: MONO, padding: '4px 10px', cursor: 'pointer',
            }}
          ><Clock size={11} /> 1h</button>
          <button
            onClick={() => engine.snoozeProposal(p.id, Date.now() + 24 * 60 * 60 * 1000)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'transparent', color: C.dim, border: `1px solid ${C.border}`,
              borderRadius: 4, fontSize: 10, fontFamily: MONO, padding: '4px 10px', cursor: 'pointer',
            }}
          >Tomorrow</button>
        </div>
      )}
    </div>
  );
}

const OUTCOME_META: Record<string, { icon: 'check' | 'x' | 'clock'; color: string; label: string }> = {
  success: { icon: 'check', color: C.green, label: 'ok' },
  failure: { icon: 'x', color: C.red, label: 'failed' },
  auto_executed: { icon: 'check', color: C.cyan, label: 'auto' },
  manual_accepted: { icon: 'clock', color: C.amber, label: 'accepted' },
  revoked: { icon: 'x', color: C.red, label: 'revoked' },
  reinstate: { icon: 'check', color: C.green, label: 'reinstate' },
  graduated: { icon: 'check', color: C.green, label: 'graduated' },
};

function AuditRow({ entry }: { entry: { at: number; domain: string; tier: number; outcome: string; summary?: string } }) {
  const meta = OUTCOME_META[entry.outcome] || OUTCOME_META.manual_accepted;
  const Icon = meta.icon === 'check' ? Check : meta.icon === 'x' ? X : Clock;
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', marginBottom: 6, background: C.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={11} color={meta.color} />
        <span style={{ fontSize: 11, color: C.text, fontFamily: MONO }}>{entry.domain}</span>
        <span style={{ fontSize: 9, fontFamily: MONO, color: meta.color, border: `1px solid ${meta.color}55`, borderRadius: 3, padding: '0 4px' }}>
          {meta.label}
        </span>
        <span style={{ fontSize: 9, fontFamily: MONO, color: C.dim }}>T{entry.tier}</span>
      </div>
      <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, marginTop: 4 }}>
        {entry.summary || entry.outcome} · {timeAgo(entry.at)}
      </div>
    </div>
  );
}

function AutonomyPanel() {
  const ledger = getCortexTrustLedger();
  const [, setTick] = useState(0);
  const enabled = isTrustEnabled();
  const domains = ledger.listDomains().sort((a, b) => b.totalExecutes - a.totalExecutes);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => { setTrustEnabled(!enabled); setTick(t => t + 1); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: enabled ? 'rgba(52,211,153,0.12)' : 'transparent',
            color: enabled ? C.green : C.dim,
            border: `1px solid ${enabled ? C.green : C.border}`,
            borderRadius: 4, fontSize: 10, fontFamily: MONO, padding: '5px 10px', cursor: 'pointer',
          }}
        >
          {enabled ? <ShieldCheck size={11} /> : <ShieldOff size={11} />}
          Trust ladder {enabled ? 'ON' : 'OFF'}
        </button>
        <span style={{ fontSize: 9, color: C.dim, fontFamily: MONO }}>
          graduates at {GRADUATION_CLEAN_REQUIRED} clean / {GRADUATION_TOTAL_REQUIRED} total · tier-2 never auto
        </span>
      </div>
      {!enabled && (
        <div style={{ fontSize: 10, color: C.dim, fontFamily: MONO, marginBottom: 10, lineHeight: 1.6 }}>
          Autonomous execution is disabled. Enable to let graduated domains run without a card — every action is still audited below.
        </div>
      )}
      {domains.length === 0 ? (
        <div style={{ padding: '16px 8px', textAlign: 'center', color: C.dim, fontSize: 11 }}>
          No tracked domains yet. Accept and execute proposals to build trust records.
        </div>
      ) : domains.map(d => {
        const graduated = ledger.isDomainGraduated(d);
        const revoked = !!d.revokedAt;
        return (
          <div key={d.domain} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', marginBottom: 6, background: C.surface }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: C.text, fontFamily: MONO, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.domain}</span>
              {graduated && !revoked && (
                <span style={{ fontSize: 9, fontFamily: MONO, color: C.green, border: `1px solid ${C.green}55`, borderRadius: 3, padding: '0 4px' }}>GRADUATED</span>
              )}
              {revoked && (
                <span style={{ fontSize: 9, fontFamily: MONO, color: C.red, border: `1px solid ${C.red}55`, borderRadius: 3, padding: '0 4px' }}>REVOKED</span>
              )}
              <span style={{ fontSize: 9, fontFamily: MONO, color: C.dim }}>T{d.tier}</span>
              <button
                onClick={() => { revoked ? ledger.reinstate(d.domain) : ledger.revoke(d.domain, 'user revocation from inbox'); setTick(t => t + 1); }}
                style={{
                  background: 'transparent', color: revoked ? C.green : C.red,
                  border: `1px solid ${revoked ? C.green : C.red}55`, borderRadius: 4,
                  fontSize: 9, fontFamily: MONO, padding: '2px 8px', cursor: 'pointer',
                }}
              >{revoked ? 'reinstate' : 'revoke'}</button>
            </div>
            <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, marginTop: 4 }}>
              {d.cleanExecutes} clean / {d.totalExecutes} total
              {d.lastFailure ? ` · last failure ${timeAgo(d.lastFailure.at)}` : ''}
              {d.graduatedAt ? ` · graduated ${timeAgo(d.graduatedAt)}` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface StrategyProposal {
  id: string;
  planNote: string;
  title: string;
  actionClass: string;
  agentId: string;
  kind: string;
  instruction: string;
  evidence: string[];
  status: string;
  createdAt: number;
  decisionNote?: string;
  action?: { type: 'budgetRaise'; agentId: string; budget: number };
  taskInput?: Record<string, unknown>;
}

interface IncidentTicket {
  id: string;
  agentId: string;
  agentName?: string;
  kind: string;
  failureClass: string;
  title: string;
  status: string;
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastError?: string;
  evidence: string[];
  ageHours?: number;
}

const CLASS_COLOR: Record<string, string> = {
  infra: C.red, code: C.amber, eval: C.cyan, config: C.amber,
  process: C.dim, prompt: C.cyan, skill: C.green, rule: C.green,
};

function StrategyProposalCard({ p, onDecided }: { p: StrategyProposal; onDecided: () => void }) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');

  const decide = async (decision: 'approved' | 'dismissed', dispatchTask = false) => {
    setBusy(true);
    try {
      if (p.action?.type === 'budgetRaise' && decision === 'approved') {
        // Deterministic governance action — no agent dispatch.
        const b = await fetch('/api/cortex/agents/budget', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: p.action.agentId, budget: p.action.budget }),
        }).then(r => r.json()).catch(() => null);
        await fetch('/api/cortex/agents/proposals', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: p.id, decision: b?.ok ? 'executed' : 'approved',
            note: b?.ok ? `budget ${p.action.agentId} → ${p.action.budget}/day` : `budget raise failed: ${b?.error || 'unknown'}`,
          }),
        });
        setNote(b?.ok ? `budget raised: ${p.action.agentId} → ${p.action.budget}/day` : `raise failed: ${b?.error || 'unknown'}`);
      } else if (dispatchTask) {
        let tid: string | undefined;
        if (p.kind === 'devin_task' && decision === 'approved') {
          // Flip to approved BEFORE dispatch — the devin worker verifies
          // the proposal is actually approved before launching a session.
          await fetch('/api/cortex/agents/proposals', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: p.id, decision: 'approved', note: 'pre-dispatch approval' }),
          });
          const t = await fetch('/api/cortex/agents/task', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: p.agentId, kind: p.kind, title: p.title.slice(0, 120),
              input: { instruction: p.instruction, ...(p.taskInput || {}), approvedProposalId: p.id },
            }),
          }).then(r => r.json()).catch(() => null);
          tid = t?.task?.id ? String(t.task.id) : undefined;
          await fetch('/api/cortex/agents/proposals', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: p.id, decision: 'approved', taskId: tid, note: tid ? `dispatched ${tid}` : 'dispatch failed' }),
          });
          setNote(t?.ok === false ? `dispatch rejected: ${t.error}` : `devin session launching${tid ? ` (${tid})` : ''}`);
          onDecided();
          return;
        }
        const t = await fetch('/api/cortex/agents/task', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: p.agentId, kind: p.kind, title: p.title.slice(0, 120), input: { instruction: p.instruction } }),
        }).then(r => r.json()).catch(() => null);
        tid = t?.task?.id ? String(t.task.id) : undefined;
        await fetch('/api/cortex/agents/proposals', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: p.id, decision, taskId: tid, note: tid ? `dispatched ${tid}` : 'dispatch failed' }),
        });
        setNote(t?.ok === false ? `dispatch rejected: ${t.error}` : `dispatched to ${p.agentId}${tid ? ` (${tid})` : ''}`);
      } else {
        await fetch('/api/cortex/agents/proposals', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: p.id, decision }),
        });
      }
      onDecided();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      border: `1px solid ${C.border}`, borderLeft: `3px solid ${CLASS_COLOR[p.actionClass] || C.dim}`,
      borderRadius: 8, padding: '10px 12px', background: C.surface, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontFamily: MONO, color: CLASS_COLOR[p.actionClass] || C.dim, border: `1px solid ${(CLASS_COLOR[p.actionClass] || C.dim)}55`, borderRadius: 3, padding: '0 4px' }}>
              {p.actionClass.toUpperCase()}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: MONO }}>{p.title}</span>
          </div>
          <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, marginTop: 4 }}>
            STRATEGIST plan · → {p.action?.type === 'budgetRaise' ? `${p.action.agentId} budget` : p.agentId} · {timeAgo(p.createdAt)}
            {p.planNote ? ` · ${p.planNote.split('/').pop()}` : ''}
          </div>
          {p.evidence?.length > 0 && (
            <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, marginTop: 4, opacity: 0.75 }}>
              evidence: {p.evidence.join(', ').slice(0, 160)}
            </div>
          )}
          {note && <div style={{ fontSize: 9, color: C.cyan, fontFamily: MONO, marginTop: 4 }}>{note}</div>}
        </div>
        <button onClick={() => decide('dismissed')} disabled={busy} title="Dismiss"
          style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', padding: 4 }}><X size={13} /></button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
        <button onClick={() => setExpanded(v => !v)}
          style={{ background: 'none', border: 'none', color: C.amber, fontSize: 10, fontFamily: MONO, cursor: 'pointer', padding: 0 }}>
          {expanded ? '▾ hide instruction' : '▸ review instruction'}
        </button>
        <span style={{ flex: 1 }} />
        <button onClick={() => decide('approved', true)} disabled={busy}
          style={{
            background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}55`, borderRadius: 4,
            fontSize: 10, fontFamily: MONO, padding: '3px 10px', cursor: busy ? 'wait' : 'pointer',
          }}>
          {busy ? '…' : p.action?.type === 'budgetRaise' ? `Approve → ${p.action.budget}/day` : `Approve → ${p.agentId}`}
        </button>
      </div>
      {expanded && (
        <pre style={{ fontSize: 9, color: C.dim, fontFamily: MONO, background: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 4, overflow: 'auto', maxHeight: 120, marginTop: 6, whiteSpace: 'pre-wrap' }}>
          {p.instruction}
        </pre>
      )}
    </div>
  );
}

export function CortexInitiativeInbox() {
  const engine = getCortexProactiveInitiative();
  const ledger = getCortexTrustLedger();
  const [tab, setTab] = useState<'proposals' | 'activity' | 'autonomy'>('proposals');
  const [tick, setTick] = useState(0);
  const [strategyProps, setStrategyProps] = useState<StrategyProposal[]>([]);
  const [incidents, setIncidents] = useState<IncidentTicket[]>([]);
  const [fastDraining, setFastDraining] = useState(false);
  const [healingAll, setHealingAll] = useState(false);
  const [incidentLoading, setIncidentLoading] = useState<Record<string, string>>({});

  const handleHealIncident = async (id: string) => {
    setIncidentLoading(prev => ({ ...prev, [id]: 'verifying...' }));
    try {
      const res = await fetch('/api/cortex/agents/incidents/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok && data?.taskId) {
        setIncidentLoading(prev => ({ ...prev, [id]: `Dispatched ${data.taskId}` }));
      } else {
        setIncidentLoading(prev => ({ ...prev, [id]: data?.error || 'failed' }));
      }
    } catch {
      setIncidentLoading(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  const handleDismissIncident = async (id: string) => {
    try {
      await fetch('/api/cortex/agents/incidents/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setIncidents(prev => prev.filter(x => x.id !== id));
    } catch {}
  };

  const handleDismissAllIncidents = async () => {
    try {
      await fetch('/api/cortex/agents/incidents/dismiss-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: incidents.map(i => i.id) }),
      });
      setIncidents([]);
    } catch {}
  };

  const handleHealAllIncidents = async () => {
    setHealingAll(true);
    try {
      for (const inc of incidents) {
        await fetch('/api/cortex/agents/incidents/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: inc.id }),
        }).catch(() => {});
      }
      const r = await fetch('/api/cortex/agents/incidents?status=open', { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (j?.ok) setIncidents(j.incidents || []);
    } finally {
      setHealingAll(false);
    }
  };

  useEffect(() => {
    const u1 = engine.subscribe(() => setTick(t => t + 1));
    const u2 = ledger.subscribe(() => setTick(t => t + 1));
    return () => { u1(); u2(); };
  }, []);

  // STRATEGIST action plans — the fleet's proposal queue. Polled because
  // plans are filed server-side by agent tasks, outside the client engine.
  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/cortex/agents/proposals?status=pending', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (alive && j?.ok) setStrategyProps(j.proposals || []); })
      .catch(() => {});
    load();
    const iv = setInterval(load, 8_000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  // Incident tickets — open failure signatures awaiting a verified fix.
  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/cortex/agents/incidents?status=open', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (alive && j?.ok) setIncidents(j.incidents || []); })
      .catch(() => {});
    load();
    const iv = setInterval(load, 15_000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const proposals = useMemo(() => engine.getPendingProposals(), [tick]);
  const auditTrail = useMemo(() => ledger.getAudit(60), [tick]);
  // In-flight + recent receipts: accepted proposals show live status instead
  // of vanishing; finished ones linger ~10min with their outcome summary.
  const inFlight = useMemo(() => engine.getActiveProposals()
    .filter(p => p.status === 'accepted'
      || ((p.status === 'executed' || p.status === 'failed') && (p.executionResult?.at ?? 0) > Date.now() - 10 * 60 * 1000))
    .sort((a, b) => (b.executionResult?.at ?? b.createdAt) - (a.executionResult?.at ?? a.createdAt))
    .slice(0, 5), [tick]);
  const proposalCount = proposals.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: MONO, padding: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 12, borderBottom: `1px solid ${C.border}`, paddingBottom: 6, marginBottom: 8 }}>
        {(['proposals', 'activity', 'autonomy'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: MONO,
              color: tab === t ? C.cyan : C.dim, textTransform: 'uppercase', letterSpacing: 1,
              borderBottom: tab === t ? `1px solid ${C.cyan}` : '1px solid transparent', paddingBottom: 2,
            }}
          >{t}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: C.dim }}>
            <Zap size={9} style={{ display: 'inline', marginRight: 3 }} />
            {proposalCount + strategyProps.length} pending
            {(() => {
              const rm = engine.getRestraintMetrics();
              const held = rm.today.suppressedDedupe + rm.today.suppressedBudget;
              return held > 0 ? ` · ${held} held back` : '';
            })()}
          </span>
          {(proposalCount > 0 || strategyProps.length > 0) && (
            <button
              onClick={async () => {
                setFastDraining(true);
                try {
                  // 1. Server-side ledger & strategy auto-drain
                  await fetch('/api/cortex/initiative/drain', { method: 'POST' }).catch(() => {});
                  // 2. Client-side drain any safe non-tier2 proposals
                  for (const p of proposals) {
                    const tier = p.autonomyTier ?? (p.requiresApproval ? 2 : 1);
                    if (tier <= 1 && !p.requiresApproval) {
                      engine.acceptProposal(p.id);
                    }
                  }
                  // 3. Batch approve pending strategy proposals
                  if (strategyProps.length > 0) {
                    await fetch('/api/cortex/agents/proposals/batch-approve', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ all: true }),
                    }).catch(() => {});
                  }
                  // 4. Force pickup & reload
                  await engine.pickupApprovedProposals().catch(() => {});
                  setTick(t => t + 1);
                  fetch('/api/cortex/agents/proposals?status=pending', { cache: 'no-store' })
                    .then(r => r.json())
                    .then(j => { if (j?.ok) setStrategyProps(j.proposals || []); })
                    .catch(() => {});
                } finally {
                  setFastDraining(false);
                }
              }}
              disabled={fastDraining}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(52,211,153,0.18)', color: C.green,
                border: `1px solid ${C.green}77`, borderRadius: 4,
                fontSize: 9, fontFamily: MONO, fontWeight: 600, padding: '2px 8px',
                cursor: fastDraining ? 'wait' : 'pointer',
              }}
              title="Fast-drain & auto-approve all safe proposals immediately"
            >
              <Zap size={9} />
              {fastDraining ? 'DRAINING…' : '⚡ FAST-DRAIN ALL SAFE'}
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'proposals' && (
          <>
            {incidents.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 9, color: C.red, fontFamily: MONO, letterSpacing: 1, textTransform: 'uppercase' }}>
                    Incidents — {incidents.length} open
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={handleHealAllIncidents}
                      disabled={healingAll}
                      style={{
                        background: 'rgba(239,68,68,0.15)',
                        border: '1px solid #ef444466',
                        color: '#f87171',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 9,
                        fontFamily: MONO,
                        fontWeight: 600,
                        cursor: 'pointer',
                        letterSpacing: 0.5,
                      }}
                    >
                      {healingAll ? '⚡ HEALING...' : '⚡ HEAL ALL INCIDENTS'}
                    </button>
                    <button
                      onClick={handleDismissAllIncidents}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.border}`,
                        color: C.dim,
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: 9,
                        fontFamily: MONO,
                        cursor: 'pointer',
                      }}
                    >
                      Dismiss All
                    </button>
                  </div>
                </div>
                {incidents.map(inc => {
                  const ageH = inc.ageHours ?? Math.floor((Date.now() - inc.firstSeenAt) / 3600_000);
                  const stale = ageH >= 24;
                  const aging = !stale && ageH >= 0.25;
                  return (
                  <div key={inc.id} style={{
                    border: `1px solid ${C.border}`, borderLeft: `3px solid ${stale ? '#ef4444' : aging ? '#f59e0b' : '#f87171'}`,
                    borderRadius: 8, padding: '8px 12px', background: C.surface, marginBottom: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, fontFamily: MONO, color: '#f87171', border: '1px solid #f8717155', borderRadius: 3, padding: '0 4px' }}>
                        {inc.failureClass.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.text, fontFamily: MONO }}>
                        {inc.agentName || inc.agentId} · {inc.kind}
                      </span>
                      <span style={{ fontSize: 9, color: C.dim, fontFamily: MONO }}>×{inc.count}</span>
                      {stale && (
                        <span style={{ fontSize: 9, fontFamily: MONO, color: '#ef4444', border: '1px solid #ef444455', borderRadius: 3, padding: '0 4px' }}>
                          STALE {ageH}h — fix unverified
                        </span>
                      )}
                      {aging && (
                        <span style={{ fontSize: 9, fontFamily: MONO, color: '#f59e0b', border: '1px solid #f59e0b55', borderRadius: 3, padding: '0 4px' }}>
                          AGING {ageH >= 1 ? `${Math.floor(ageH)}h` : `${Math.floor(ageH * 60)}m`}
                        </span>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: 9, color: C.dim, fontFamily: MONO }}>{timeAgo(inc.lastSeenAt)}</span>
                    </div>
                    <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inc.title}{inc.lastError ? ` — ${inc.lastError}` : ''}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, paddingTop: 4, borderTop: `1px solid ${C.border}22` }}>
                      <button
                        onClick={() => handleHealIncident(inc.id)}
                        disabled={incidentLoading[inc.id] === 'verifying...'}
                        style={{
                          background: 'rgba(239,68,68,0.12)',
                          border: '1px solid #ef444455',
                          color: '#f87171',
                          borderRadius: 4,
                          padding: '2px 8px',
                          fontSize: 9,
                          fontFamily: MONO,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {incidentLoading[inc.id] ? incidentLoading[inc.id] : '⚡ Heal & Verify'}
                      </button>
                      <button
                        onClick={() => handleDismissIncident(inc.id)}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${C.border}`,
                          color: C.dim,
                          borderRadius: 4,
                          padding: '2px 6px',
                          fontSize: 9,
                          fontFamily: MONO,
                          cursor: 'pointer',
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
            {strategyProps.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: C.cyan, fontFamily: MONO, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
                  Strategist action plans
                </div>
                {strategyProps.map(p => (
                  <StrategyProposalCard key={p.id} p={p}
                    onDecided={() => setStrategyProps(prev => prev.filter(x => x.id !== p.id))} />
                ))}
              </div>
            )}
            {inFlight.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
                  In flight / recent
                </div>
                {inFlight.map(p => {
                  const executing = p.status === 'accepted';
                  const ok = p.executionResult?.ok;
                  const statusColor = executing ? C.amber : ok ? C.green : C.red;
                  const statusLabel = executing ? 'executing…' : ok ? 'done' : 'failed';
                  return (
                    <div key={p.id} style={{
                      border: `1px solid ${C.border}`, borderLeft: `3px solid ${statusColor}`,
                      borderRadius: 8, padding: '8px 10px', marginBottom: 6, background: C.surface,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: C.text, fontFamily: MONO, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span>
                        <span style={{
                          fontSize: 9, fontFamily: MONO, color: statusColor,
                          border: `1px solid ${statusColor}55`, borderRadius: 3, padding: '0 4px',
                        }}>{statusLabel}</span>
                      </div>
                      {p.executionResult?.summary && (
                        <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, marginTop: 4, lineHeight: 1.5 }}>
                          {p.executionResult.summary}
                        </div>
                      )}
                      <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, marginTop: 4 }}>
                        {p.suggestedTool} · {timeAgo(p.executionResult?.at ?? p.createdAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {proposals.length === 0 ? (
            <div style={{ padding: '24px 8px', textAlign: 'center', color: C.dim, fontSize: 11, lineHeight: 1.7 }}>
              <ShieldAlert size={18} style={{ color: C.cyan, marginBottom: 8 }} />
              <div>All clear — Cortex is watching.</div>
              <div style={{ fontSize: 9, marginTop: 6, opacity: 0.7 }}>
                Proposals appear here when sensors detect something worth your attention.
              </div>
            </div>
          ) : proposals.map(p => <ProposalCard key={p.id} p={p} />)}
          </>
        )}

        {tab === 'activity' && (
          auditTrail.length === 0 ? (
            <div style={{ padding: '24px 8px', textAlign: 'center', color: C.dim, fontSize: 11 }}>
              No autonomous actions yet.
            </div>
          ) : auditTrail.map((e, i) => <AuditRow key={`${e.at}-${i}`} entry={e} />)
        )}

        {tab === 'autonomy' && <AutonomyPanel />}
      </div>
    </div>
  );
}
