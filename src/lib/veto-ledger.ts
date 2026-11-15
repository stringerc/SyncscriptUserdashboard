/**
 * Veto Ledger — The Constitutional Guardrail
 *
 * This module manages VETO.md — the append-only ledger where the
 * system PROPOSES architecture changes but cannot approve them.
 * Only humans can approve or reject proposals.
 *
 * Architecture:
 * - MEMORY.md = cortical substrate (quantum collapse retrieval)
 * - STATE.md  = homeostatic state (deterministic read at boot)
 * - VETO.md   = constitutional DNA (append-only, exhaustive read)
 *
 * This module handles VETO.md reads/writes. It does NOT handle
 * STATE.md (that's StatePersistence) or MEMORY.md (that's
 * the MemorySubstrate).
 *
 * The key constraint: the system can APPEND proposals but can NEVER
 * modify or delete existing entries. Approval/rejection status changes
 * are the only mutations allowed, and they require human authority.
 *
 * In the NudgeEngine, Category 4 self-repair (architecture changes)
 * is explicitly blocked from auto-execution. This module is WHERE
 * those blocked impulses get recorded — so they're not forgotten,
 * but also not executed without human approval.
 */

import { persistentStore } from './persistent-store';
import type { CortexStateSnapshot } from './state-persistence';

// ── Types ──────────────────────────────────────────────────────────

/** The status of a veto proposal */
export type VetoStatus = 'pending' | 'approved' | 'rejected';

/** A single veto proposal — immutable once created (except status) */
export interface VetoProposal {
  /** Unique ID for this proposal */
  id: string;
  /** ISO timestamp when proposed */
  proposedAt: string;
  /** What parameter or architecture decision is being proposed */
  description: string;
  /** The system's argument for why this change should happen */
  reason: string;
  /** Link to a memory entry with supporting evidence */
  evidenceLink: string | null | undefined;
  /** Current value of the parameter (if applicable) */
  currentValue: string;
  /** The proposed new value */
  proposedValue: string;
  /** How impactful this change would be */
  impact: 'low' | 'medium' | 'high';
  /** Current status — pending until human decides */
  status: VetoStatus;
  /** Who approved (if approved) */
  approvedBy: string | null;
  /** When approved (if approved) */
  approvedAt: string | null;
  /** Who rejected (if rejected) */
  rejectedBy: string | null;
  /** When rejected (if rejected) */
  rejectedAt: string | null;
  /** Why rejected (if rejected) */
  rejectionReason: string | null;
  /** Whether the approved change has been applied to live config */
  applied: boolean;
}

/** The full veto ledger — all proposals and current guarded parameters */
export interface VetoLedgerData {
  /** Current values of all guarded parameters */
  guardedParameters: Array<{
    parameter: string;
    value: number;
    lastChanged: string;
    changedBy: string;
  }>;
  /** All proposals ever made — append-only */
  proposals: VetoProposal[];
}

// ── Storage Key ────────────────────────────────────────────────────

const VETO_STORAGE_KEY = 'syncscript:cortex:veto';

// ── Default Guarded Parameters ─────────────────────────────────────

export const DEFAULT_GUARDED_PARAMETERS: VetoLedgerData['guardedParameters'] = [
  { parameter: 'collapse-threshold', value: 0.30, lastChanged: '2026-06-10', changedBy: 'initial' },
  { parameter: 'coherence-floor', value: 0.30, lastChanged: '2026-06-10', changedBy: 'initial' },
  { parameter: 'free-energy-ceiling', value: 0.60, lastChanged: '2026-06-10', changedBy: 'initial' },
  { parameter: 'hallucination-block-threshold', value: 0.80, lastChanged: '2026-06-10', changedBy: 'initial' },
  { parameter: 'drift-duration-ms', value: 300_000, lastChanged: '2026-06-10', changedBy: 'initial' },
  { parameter: 'decoupled-duration-ms', value: 120_000, lastChanged: '2026-06-10', changedBy: 'initial' },
  { parameter: 'reality-warning-threshold', value: 0.50, lastChanged: '2026-06-10', changedBy: 'initial' },
  { parameter: 'reality-critical-threshold', value: 0.25, lastChanged: '2026-06-10', changedBy: 'initial' },
];

// ── Veto Ledger Manager ────────────────────────────────────────────

export class VetoLedger {
  private data: VetoLedgerData;

  constructor() {
    this.data = this.loadFromStorage();
  }

  // ── Propose ────────────────────────────────────────────────────

  /**
   * Propose an architecture change.
   * This is what the NudgeEngine calls when Category 4 self-repair
   * detects that a guarded parameter should change.
   *
   * The proposal is APPENDED — never auto-executed.
   * Returns the proposal ID for tracking.
   */
  propose(params: {
    description: string;
    reason: string;
    evidenceLink?: string;
    currentValue: string;
    proposedValue: string;
    impact?: 'low' | 'medium' | 'high';
  }): string {
    const id = `veto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const proposal: VetoProposal = {
      id,
      proposedAt: new Date().toISOString(),
      description: params.description,
      reason: params.reason,
      evidenceLink: params.evidenceLink ?? null,
      currentValue: params.currentValue,
      proposedValue: params.proposedValue,
      impact: params.impact ?? 'medium',
      status: 'pending',
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      applied: false,
    };

    this.data.proposals.push(proposal);
    this.saveToStorage();

    return id;
  }

  // ── Human Decision ─────────────────────────────────────────────

  /**
   * Approve a pending proposal.
   * Only humans should call this — the system never auto-approves.
   * Returns true if the proposal was successfully approved.
   */
  approve(proposalId: string, approvedBy: string): boolean {
    const proposal = this.data.proposals.find(p => p.id === proposalId);
    if (!proposal || proposal.status !== 'pending') return false;

    proposal.status = 'approved';
    proposal.approvedBy = approvedBy;
    proposal.approvedAt = new Date().toISOString();

    this.saveToStorage();
    return true;
  }

  /**
   * Reject a pending proposal.
   * Only humans should call this.
   * Returns true if the proposal was successfully rejected.
   */
  reject(proposalId: string, rejectedBy: string, reason: string): boolean {
    const proposal = this.data.proposals.find(p => p.id === proposalId);
    if (!proposal || proposal.status !== 'pending') return false;

    proposal.status = 'rejected';
    proposal.rejectedBy = rejectedBy;
    proposal.rejectedAt = new Date().toISOString();
    proposal.rejectionReason = reason;

    this.saveToStorage();
    return true;
  }

  /**
   * Mark an approved proposal as applied to the live configuration.
   * Called after the parameter change has been implemented.
   */
  markApplied(proposalId: string): boolean {
    const proposal = this.data.proposals.find(p => p.id === proposalId);
    if (!proposal || proposal.status !== 'approved' || proposal.applied) return false;

    proposal.applied = true;

    // Update the guarded parameters table
    const paramName = this.extractParameterName(proposal.description);
    if (paramName) {
      const param = this.data.guardedParameters.find(p => p.parameter === paramName);
      if (param) {
        param.value = parseFloat(proposal.proposedValue) || param.value;
        param.lastChanged = new Date().toISOString();
        param.changedBy = proposal.approvedBy ?? 'system';
      }
    }

    this.saveToStorage();
    return true;
  }

  // ── Query ──────────────────────────────────────────────────────

  /** Get all pending proposals */
  getPending(): VetoProposal[] {
    return this.data.proposals.filter(p => p.status === 'pending');
  }

  /** Get all proposals (full ledger) */
  getAll(): VetoProposal[] {
    return [...this.data.proposals];
  }

  /** Get a specific proposal by ID */
  getById(id: string): VetoProposal | undefined {
    return this.data.proposals.find(p => p.id === id);
  }

  /** Get current guarded parameters */
  getGuardedParameters(): VetoLedgerData['guardedParameters'] {
    return [...this.data.guardedParameters];
  }

  /** Get the current value of a specific guarded parameter */
  getParameterValue(name: string): number | undefined {
    const param = this.data.guardedParameters.find(p => p.parameter === name);
    return param?.value;
  }

  /** Check if a proposed value would differ from current */
  wouldChange(name: string, proposedValue: number): boolean {
    const current = this.getParameterValue(name);
    if (current === undefined) return true;
    return Math.abs(current - proposedValue) > 0.001;
  }

  // ── Markdown Export ────────────────────────────────────────────

  /**
   * Convert the veto ledger to VETO.md markdown format.
   * This is what gets written to the actual .md file for human
   * readability and version control.
   */
  toMarkdown(): string {
    const lines: string[] = [
      '# Cortex Veto — Constitutional Guardrail',
      '',
      '> APPEND-ONLY. No deletions. No modifications to existing entries.',
      '> The system can PROPOSE. Only humans can APPROVE or REJECT.',
      '> This IS the constitutional DNA of Cortex — parameters and architecture',
      '> decisions that the system cannot modify without human approval.',
      '',
      '## Guarded Parameters (Current Values)',
      '',
      '| Parameter | Value | Last Changed | Changed By |',
      '|-----------|-------|-------------|------------|',
      ...this.data.guardedParameters.map(p =>
        `| ${p.parameter} | ${p.value} | ${p.lastChanged} | ${p.changedBy} |`
      ),
      '',
      '## Proposals',
      '',
    ];

    if (this.data.proposals.length === 0) {
      lines.push('(No proposals yet — the system will append proposals here when Category 4');
      lines.push('self-repair detects that an architecture parameter should change.)');
      lines.push('');
    } else {
      for (const proposal of this.data.proposals) {
        const statusIcon = proposal.status === 'approved' ? '✅' :
                           proposal.status === 'rejected' ? '❌' : '⏳';
        lines.push(`### ${proposal.proposedAt} ${proposal.status.toUpperCase()}: ${proposal.description}`);
        lines.push(`- Reason: "${proposal.reason}"`);
        if (proposal.evidenceLink) {
          lines.push(`- Evidence: ${proposal.evidenceLink}`);
        }
        lines.push(`- Current value: ${proposal.currentValue}`);
        lines.push(`- Proposed value: ${proposal.proposedValue}`);
        lines.push(`- Impact: ${proposal.impact}`);
        lines.push(`- Status: ${proposal.status.toUpperCase()}`);
        lines.push(`- Approved by: ${proposal.approvedBy ?? '(pending)'}${proposal.approvedAt ? ` on ${proposal.approvedAt}` : ''}`);
        lines.push(`- Rejected by: ${proposal.rejectedBy ?? '(pending)'}${proposal.rejectedAt ? ` on ${proposal.rejectedAt}` : ''}${proposal.rejectionReason ? ` — "${proposal.rejectionReason}"` : ''}`);
        lines.push(`- Applied: ${proposal.applied ? 'yes' : proposal.status === 'approved' ? 'pending' : 'n/a'}`);
        lines.push('');
      }
    }

    return lines.join('\n') + '\n';
  }

  // ── Storage ────────────────────────────────────────────────────

  private loadFromStorage(): VetoLedgerData {
    try {
      const stored = persistentStore.getItem(VETO_STORAGE_KEY);
      if (!stored) {
        return {
          guardedParameters: [...DEFAULT_GUARDED_PARAMETERS],
          proposals: [],
        };
      }
      return JSON.parse(stored) as VetoLedgerData;
    } catch (e) {
      console.warn('[VetoLedger] Failed to load from storage:', e);
      return {
        guardedParameters: [...DEFAULT_GUARDED_PARAMETERS],
        proposals: [],
      };
    }
  }

  private saveToStorage(): void {
    try {
      persistentStore.setItem(VETO_STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[VetoLedger] Failed to save to storage:', e);
    }
  }

  // ── Utility ────────────────────────────────────────────────────

  private extractParameterName(description: string): string | null {
    // Try to extract parameter name from description like
    // "Lower collapse threshold to 0.65"
    const knownParams = DEFAULT_GUARDED_PARAMETERS.map(p => p.parameter);
    for (const param of knownParams) {
      if (description.toLowerCase().includes(param.replace(/-/g, ' '))) {
        return param;
      }
    }
    return null;
  }

  /** Clear all proposals and reset to defaults — factory reset */
  clear(): void {
    this.data = {
      guardedParameters: [...DEFAULT_GUARDED_PARAMETERS],
      proposals: [],
    };
    try {
      persistentStore.removeItem(VETO_STORAGE_KEY);
    } catch { /* ignore */ }
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let globalVetoLedger: VetoLedger | null = null;

export function getVetoLedger(): VetoLedger {
  if (!globalVetoLedger) {
    globalVetoLedger = new VetoLedger();
  }
  return globalVetoLedger;
}

export function resetVetoLedger(): void {
  globalVetoLedger = null;
}
