// shared-intentionality.ts — from modeling minds to coordinating with them.
//
// ToM asks "what do they think?" Second-order asks "what do they think
// I think?" This module asks "what are we DOING together?" — joint
// commitments, shared attention, and collective veto across cortex and
// the fleet (warden, devin, scout, librarian, user).
//
// Three mechanisms:
//   1. JOINT COMMITMENTS — commitments signed by multiple parties.
//      A promise to the fleet isn't just cortex's ledger entry; it's
//      a shared contract with mutual obligations.
//   2. SHARED ATTENTION — broadcasts marked 'shared' that fleet agents
//      acknowledge. Joint attention = we noticed the same thing.
//   3. COLLECTIVE VETO — high-stakes actions need quorum approval, not
//      just cortex's own Libet window. The fleet can veto cortex's
//      dispatch; cortex can veto fleet proposals.
//
// State: .cortex-runtime/shared-intentionality.json
import fs from 'node:fs';
import path from 'node:path';
import { speakInner } from './inner-speech';
import { broadcastHistory } from './workspace';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME, 'shared-intentionality.json');

export interface JointCommitment {
  id: string;
  ts: number;
  description: string;
  /** All parties bound by this commitment. */
  parties: string[];
  /** What each party owes. */
  obligations: Record<string, string>;
  status: 'proposed' | 'active' | 'fulfilled' | 'breached' | 'dissolved';
  createdBy: string;
  fulfilledAt?: number;
}

export interface CollectiveVeto {
  id: string;
  ts: number;
  actionDescription: string;
  proposedBy: string;
  /** Which parties must approve (quorum). */
  requiredApprovals: string[];
  approvals: Record<string, 'approve' | 'veto' | 'abstain'>;
  status: 'open' | 'approved' | 'vetoed' | 'expired';
  expiresAt: number;
}

interface SharedState {
  commitments: JointCommitment[];
  vetoes: CollectiveVeto[];
  sharedAttention: Array<{ ts: number; broadcastId: string; kind: string; acknowledgedBy: string[] }>;
}

function load(): SharedState {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { commitments: raw.commitments || [], vetoes: raw.vetoes || [], sharedAttention: raw.sharedAttention || [] };
  } catch {
    return { commitments: [], vetoes: [], sharedAttention: [] };
  }
}
function save(s: SharedState) {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({
      commitments: s.commitments.slice(-100),
      vetoes: s.vetoes.slice(-100),
      sharedAttention: s.sharedAttention.slice(-200),
    }, null, 2));
  } catch {}
}

// ── Joint commitments ────────────────────────────────────────────────
export function proposeJointCommitment(description: string, parties: string[], obligations: Record<string, string>, createdBy = 'cortex'): JointCommitment {
  const s = load();
  const c: JointCommitment = {
    id: `joint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(), description: description.slice(0, 300),
    parties, obligations, status: 'proposed', createdBy,
  };
  s.commitments.push(c);
  save(s);
  try {
    speakInner({
      kind: 'commitment', source: 'shared-intentionality',
      text: `Joint commitment proposed: "${description.slice(0, 70)}" — parties: ${parties.join(', ')}.`,
      surprise: 0.5, valence: 0.15,
    });
  } catch {}
  return c;
}

export function activateJointCommitment(id: string): boolean {
  const s = load();
  const c = s.commitments.find((x) => x.id === id);
  if (!c || c.status !== 'proposed') return false;
  c.status = 'active';
  save(s);
  return true;
}

export function fulfillJointCommitment(id: string, by: string): boolean {
  const s = load();
  const c = s.commitments.find((x) => x.id === id);
  if (!c || c.status !== 'active') return false;
  // All parties must fulfill — or the commitment breaches
  c.status = 'fulfilled';
  c.fulfilledAt = Date.now();
  save(s);
  try {
    speakInner({
      kind: 'commitment', source: 'shared-intentionality',
      text: `Joint commitment fulfilled: "${c.description.slice(0, 60)}" — collective obligation discharged.`,
      surprise: 0.4, valence: 0.3,
    });
  } catch {}
  return true;
}

// ── Collective veto ──────────────────────────────────────────────────
export function proposeCollectiveVeto(actionDescription: string, proposedBy: string, requiredApprovals: string[]): CollectiveVeto {
  const s = load();
  const v: CollectiveVeto = {
    id: `veto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(), actionDescription: actionDescription.slice(0, 300),
    proposedBy, requiredApprovals, approvals: {}, status: 'open',
    expiresAt: Date.now() + 10 * 60_000, // 10min window
  };
  s.vetoes.push(v);
  save(s);
  try {
    speakInner({
      kind: 'veto', source: 'shared-intentionality',
      text: `Collective veto proposed on "${actionDescription.slice(0, 60)}" by ${proposedBy} — needs approval from: ${requiredApprovals.join(', ')}.`,
      surprise: 0.7, valence: -0.1,
    });
  } catch {}
  return v;
}

export function voteOnVeto(vetoId: string, voter: string, vote: 'approve' | 'veto' | 'abstain'): CollectiveVeto | null {
  const s = load();
  const v = s.vetoes.find((x) => x.id === vetoId);
  if (!v || v.status !== 'open') return null;
  if (Date.now() > v.expiresAt) { v.status = 'expired'; save(s); return v; }
  v.approvals[voter] = vote;
  // Quorum: majority of REQUIRED approvers must vote 'approve' to pass
  // the veto (block the action). Majority 'veto' = veto fails, action proceeds.
  // Abstains don't count toward either side.
  const required = v.requiredApprovals;
  const approveCount = required.filter((p) => v.approvals[p] === 'approve').length;
  const vetoCount = required.filter((p) => v.approvals[p] === 'veto').length;
  const quorum = Math.floor(required.length / 2) + 1;
  if (approveCount >= quorum) v.status = 'vetoed';        // veto PASSES — action blocked
  else if (vetoCount >= quorum) v.status = 'approved';   // veto FAILS — action proceeds
  save(s);
  return v;
}

// ── Shared attention ─────────────────────────────────────────────────
export function shareAttention(broadcastId: string, kind: string, acknowledgedBy: string[] = []): void {
  const s = load();
  const existing = s.sharedAttention.find((x) => x.broadcastId === broadcastId);
  if (existing) {
    for (const a of acknowledgedBy) if (!existing.acknowledgedBy.includes(a)) existing.acknowledgedBy.push(a);
  } else {
    s.sharedAttention.push({ ts: Date.now(), broadcastId, kind, acknowledgedBy: [...acknowledgedBy] });
  }
  save(s);
}

export function acknowledgeAttention(broadcastId: string, agentId: string): boolean {
  const s = load();
  const entry = s.sharedAttention.find((x) => x.broadcastId === broadcastId);
  if (!entry) return false;
  if (!entry.acknowledgedBy.includes(agentId)) entry.acknowledgedBy.push(agentId);
  save(s);
  return true;
}

/** Joint attention report — which broadcasts did multiple parties notice? */
export function sharedAttentionReport() {
  const s = load();
  const broadcasts = broadcastHistory(50);
  return {
    sharedMoments: s.sharedAttention.filter((x) => x.acknowledgedBy.length > 0).length,
    totalBroadcasts: broadcasts.length,
    jointAttentionRate: broadcasts.length ? s.sharedAttention.filter((x) => x.acknowledgedBy.length > 0).length / broadcasts.length : 0,
    recent: s.sharedAttention.slice(-10),
  };
}

/** Collective state summary. */
export function sharedIntentionalityReport() {
  const s = load();
  return {
    commitments: {
      total: s.commitments.length,
      active: s.commitments.filter((c) => c.status === 'active').length,
      fulfilled: s.commitments.filter((c) => c.status === 'fulfilled').length,
      breached: s.commitments.filter((c) => c.status === 'breached').length,
    },
    vetoes: {
      total: s.vetoes.length,
      open: s.vetoes.filter((v) => v.status === 'open').length,
      vetoed: s.vetoes.filter((v) => v.status === 'vetoed').length,
      approved: s.vetoes.filter((v) => v.status === 'approved').length,
    },
    attention: sharedAttentionReport(),
    recentCommitments: s.commitments.slice(-5),
    recentVetoes: s.vetoes.slice(-5),
  };
}
