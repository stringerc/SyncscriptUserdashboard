/**
 * cortex-trust-ledger.ts — Per-domain autonomy trust ledger (Trust Ladder v1)
 *
 * Tracks execution outcomes per action domain (e.g. 'run_command',
 * 'cortex_gmail_triage') and graduates domains to autonomous execution after
 * a conservative clean-record threshold. Every outcome is written to an
 * append-only audit trail — legibility is a first-class invariant.
 *
 * Invariants:
 * - Tier-2 (external/irreversible) actions NEVER auto-graduate in v1.
 * - Any failure resets cleanExecutes to 0.
 * - Graduation requires cleanExecutes >= 10 AND totalExecutes >= 15 AND no
 *   failure within the last 30 days.
 * - The whole ladder is gated behind cortex.trust.enabled (default OFF).
 */

import { persistentStore } from './persistent-store';

export const TRUST_STORAGE_KEY = 'cortex:trust:v1';
export const TRUST_FLAG_KEY = 'cortex:trust:enabled';
export const GRADUATION_CLEAN_REQUIRED = 10;
export const GRADUATION_TOTAL_REQUIRED = 15;
export const GRADUATION_FAILURE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_AUDIT_ENTRIES = 200;

export interface TrustEntry {
  domain: string;
  tier: 0 | 1 | 2;
  cleanExecutes: number;
  totalExecutes: number;
  lastFailure?: { at: number; reason: string };
  graduatedAt?: number;
  revokedAt?: number;
}

export type TrustAuditOutcome =
  | 'success'
  | 'failure'
  | 'auto_executed'
  | 'manual_accepted'
  | 'revoked'
  | 'reinstate'
  | 'graduated';

export interface TrustAuditEntry {
  at: number;
  domain: string;
  tier: 0 | 1 | 2;
  outcome: TrustAuditOutcome;
  summary?: string;
}

interface TrustLedgerState {
  domains: Record<string, TrustEntry>;
  audit: TrustAuditEntry[];
}

function emptyState(): TrustLedgerState {
  return { domains: {}, audit: [] };
}

let flagOverride: boolean | null = null;

/** Feature flag: local override OR build-time env. Default OFF. */
export function isTrustEnabled(): boolean {
  if (flagOverride !== null) return flagOverride;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(TRUST_FLAG_KEY) === '1') return true;
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env?.VITE_CORTEX_TRUST === '1') return true;
    if (typeof process !== 'undefined' && process.env?.CORTEX_TRUST_ENABLED === '1') return true;
  } catch {}
  return false;
}

export function setTrustEnabled(on: boolean): void {
  flagOverride = on;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TRUST_FLAG_KEY, on ? '1' : '0');
  } catch {}
}

function loadState(): TrustLedgerState {
  try {
    const raw = persistentStore.getItem(TRUST_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      domains: parsed?.domains && typeof parsed.domains === 'object' ? parsed.domains : {},
      audit: Array.isArray(parsed?.audit) ? parsed.audit.slice(-MAX_AUDIT_ENTRIES) : [],
    };
  } catch {
    return emptyState();
  }
}

export class CortexTrustLedger {
  private state: TrustLedgerState = emptyState();
  private listeners = new Set<() => void>();

  constructor() {
    this.state = loadState();
  }

  public subscribe(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private notify(): void {
    for (const l of this.listeners) {
      try { l(); } catch {}
    }
  }

  private save(): void {
    try {
      persistentStore.setItem(TRUST_STORAGE_KEY, JSON.stringify(this.state));
    } catch {}
  }

  private audit(entry: Omit<TrustAuditEntry, 'at'>): void {
    this.state.audit.push({ ...entry, at: Date.now() });
    if (this.state.audit.length > MAX_AUDIT_ENTRIES) {
      this.state.audit = this.state.audit.slice(-MAX_AUDIT_ENTRIES);
    }
  }

  private entryFor(domain: string): TrustEntry {
    let e = this.state.domains[domain];
    if (!e) {
      e = { domain, tier: 1, cleanExecutes: 0, totalExecutes: 0 };
      this.state.domains[domain] = e;
    }
    return e;
  }

  /** Append an audit event without touching execution counters. */
  public logEvent(domain: string, tier: 0 | 1 | 2, outcome: TrustAuditOutcome, summary?: string): void {
    this.audit({ domain, tier, outcome, summary: summary?.slice(0, 200) });
    this.save();
    this.notify();
  }

  /** Record one execution outcome for a domain. */
  public recordExecution(domain: string, tier: 0 | 1 | 2, ok: boolean, summary?: string): TrustEntry {
    const e = this.entryFor(domain);
    e.tier = tier;
    e.totalExecutes += 1;
    if (ok) {
      e.cleanExecutes += 1;
      this.audit({ domain, tier, outcome: 'success', summary });
      if (!e.graduatedAt && this.isDomainGraduated(e)) {
        e.graduatedAt = Date.now();
        this.audit({ domain, tier, outcome: 'graduated', summary: 'Domain graduated to autonomous tier' });
      }
    } else {
      e.cleanExecutes = 0;
      e.lastFailure = { at: Date.now(), reason: (summary || 'unknown').slice(0, 200) };
      this.audit({ domain, tier, outcome: 'failure', summary });
    }
    this.save();
    this.notify();
    return { ...e };
  }

  public isDomainGraduated(e: TrustEntry): boolean {
    if (e.tier === 2 || e.revokedAt) return false;
    if (e.cleanExecutes < GRADUATION_CLEAN_REQUIRED) return false;
    if (e.totalExecutes < GRADUATION_TOTAL_REQUIRED) return false;
    if (e.lastFailure && Date.now() - e.lastFailure.at < GRADUATION_FAILURE_WINDOW_MS) return false;
    return true;
  }

  /** May this domain execute without a user card? Tier-2 never. */
  public isAutoAllowed(domain: string, tier: 0 | 1 | 2): boolean {
    if (!isTrustEnabled()) return false;
    if (tier === 2) return false;
    const e = this.state.domains[domain];
    return !!e && this.isDomainGraduated(e) && !e.revokedAt;
  }

  public getDomain(domain: string): TrustEntry | null {
    const e = this.state.domains[domain];
    return e ? { ...e } : null;
  }

  public listDomains(): TrustEntry[] {
    return Object.values(this.state.domains).map((e) => ({ ...e }));
  }

  public getAudit(limit = 100): TrustAuditEntry[] {
    return this.state.audit.slice(-limit).reverse();
  }

  /** Instant, auditable revocation — the user always wins. */
  public revoke(domain: string, reason?: string): boolean {
    const e = this.state.domains[domain];
    if (!e) return false;
    e.revokedAt = Date.now();
    e.cleanExecutes = 0;
    this.audit({ domain, tier: e.tier, outcome: 'revoked', summary: reason });
    this.save();
    this.notify();
    return true;
  }

  public reinstate(domain: string): boolean {
    const e = this.state.domains[domain];
    if (!e) return false;
    e.revokedAt = undefined;
    this.audit({ domain, tier: e.tier, outcome: 'reinstate' });
    this.save();
    this.notify();
    return true;
  }

  /** Test/reset hook — wipes domains and audit trail. */
  public clear(): void {
    this.state = emptyState();
    this.save();
    this.notify();
  }
}

let globalLedger: CortexTrustLedger | null = null;

export function getCortexTrustLedger(): CortexTrustLedger {
  if (!globalLedger) globalLedger = new CortexTrustLedger();
  return globalLedger;
}
