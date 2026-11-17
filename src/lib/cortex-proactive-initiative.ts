/**
 * Cortex Proactive Initiative Engine (cortex-proactive-initiative.ts)
 *
 * Provides autonomous, ambient evaluation of workspace health, git hygiene, memory allostasis,
 * and metacognitive calibration without requiring explicit operator prompting.
 *
 * Core Capabilities:
 * 1. Ambient Sensorimotor Probing: Gathers background telemetry on uncommitted git changes,
 *    stale scratch artifacts, memory allostasis, and variational free energy.
 * 2. VETO.md Compliant Proposals: Structures every proactive recommendation with an epistemic
 *    rationale and Libet approval requirements.
 * 3. Autonomous Nudge Dispatch: Seamlessly connects with CortexNudgeEngine to render non-intrusive alerts.
 */

import { persistentStore } from './persistent-store';
import { getCortexMetacognitionCalibration } from './cortex-metacognition-calibration';
import { getCortexTrustLedger } from './cortex-trust-ledger';

// ── Types ──────────────────────────────────────────────────────────

export type InitiativeCategory =
  | 'git_hygiene'
  | 'memory_allostasis'
  | 'calibration_audit'
  | 'scratch_hygiene'
  | 'system_resonance'
  | 'forecast';

export interface ProactiveProposal {
  id: string;
  category: InitiativeCategory;
  title: string;
  summary: string;
  urgency: 'high' | 'medium' | 'low';
  suggestedTool: string;
  suggestedArgs: Record<string, any>;
  requiresApproval: boolean;
  epistemicConfidence: number;
  createdAt: number;
  dismissed?: boolean;
  autonomyTier?: 0 | 1 | 2;
  status?: 'pending' | 'accepted' | 'dismissed' | 'snoozed' | 'executed' | 'failed';
  acceptedAt?: number;
  snoozedUntil?: number;
  executionResult?: { ok: boolean; summary: string; at: number };
  source?: 'engine' | 'sensor' | 'llm' | 'voice';
  dedupeKey?: string;
  why?: string;
}

/** Options the sensor bus can feed into evaluateInitiatives. All optional. */
export interface InitiativeSensorOptions {
  freeEnergy?: number;
  uncommittedFileCount?: number;
  freeMemMB?: number;
  unansweredEmailCount?: number;
  urgentEmailCount?: number;
  staleTaskCount?: number;
  tasksDueToday?: number;
  nextMeetingInMin?: number;
  anomalousChargeCount?: number;
  pendingInvoiceCount?: number;
  // Somatic/interoceptive signals (Phase 5.1 spike)
  hrvDeltaPct?: number;
  consecutiveLateNights?: number;
  somaticStressScore?: number;
  sleepDebtHours?: number;
}

export interface ProactiveAuditResult {
  proposals: ProactiveProposal[];
  totalAudited: number;
  healthySignals: string[];
  anomaliesDetected: number;
  timestamp: number;
}

const STORAGE_KEY = 'cortex:proactive_initiative:proposals:v1';
const MAX_PROPOSALS_PER_DAY = 8;
const METRICS_KEY = 'cortex:initiative:metrics:v1';

// ── Restraint metrics (Phase 6): calibrated silence, measured ─────
export interface RestraintCounters {
  proposed: number;
  admitted: number;
  suppressedDedupe: number;
  suppressedBudget: number;
  dismissed: number;
  snoozed: number;
  accepted: number;
}
export interface RestraintMetrics {
  day: string;
  today: RestraintCounters;
  lifetime: RestraintCounters;
}

function emptyCounters(): RestraintCounters {
  return { proposed: 0, admitted: 0, suppressedDedupe: 0, suppressedBudget: 0, dismissed: 0, snoozed: 0, accepted: 0 };
}
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function tierFor(p: { requiresApproval?: boolean; autonomyTier?: 0 | 1 | 2 }): 0 | 1 | 2 {
  if (p.autonomyTier === 0 || p.autonomyTier === 1 || p.autonomyTier === 2) return p.autonomyTier;
  return p.requiresApproval ? 2 : 1;
}

// ── Safe auto-allow (Part B) ───────────────────────────────────────
// Tier<=1 proposals on whitelisted read/announce tools may self-accept
// without trust graduation. Mirrors SAFE_AUTO_TOOLS in
// cortex-initiative-ledger.ts — keep the two sets in sync.
const SAFE_AUTO_TOOLS = new Set([
  'cortex_goals',
  'cortex_metacognition',
  'cortex_accomplishments',
]);
function isSafeAutoClient(tool: string, tier: number, requiresApproval: boolean): boolean {
  return tier <= 1 && !requiresApproval && SAFE_AUTO_TOOLS.has(tool);
}

// ── Server ledger sync ─────────────────────────────────────────────
// Pushes proposal state to /api/cortex/initiative/ledger/* so console
// agents can see/approve while this tab is closed. Fire-and-forget;
// the server ledger never executes anything itself.
let ledgerSyncTimer: ReturnType<typeof setTimeout> | null = null;

function ledgerPost(path: string, body: unknown): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  try {
    void fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {}
}

function scheduleLedgerSync(engine: CortexProactiveInitiativeEngine): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  if (ledgerSyncTimer) return;
  ledgerSyncTimer = setTimeout(() => {
    ledgerSyncTimer = null;
    engine.pushLedgerSync();
  }, 2000);
}

function reportLedgerExecuted(id: string, ok: boolean, summary: string): void {
  ledgerPost('/api/cortex/initiative/ledger/executed', { id, ok, summary });
}

// ── Proactive Initiative Engine ────────────────────────────────────

export class CortexProactiveInitiativeEngine {
  private activeProposals: Map<string, ProactiveProposal> = new Map();
  private listeners = new Set<() => void>();
  private metrics: RestraintMetrics | null = null;

  constructor() {
    this.loadState();
  }

  private freshMetrics(): RestraintMetrics {
    return { day: todayKey(), today: emptyCounters(), lifetime: emptyCounters() };
  }

  private getMetrics(): RestraintMetrics {
    if (!this.metrics) {
      try {
        const raw = persistentStore.getItem(METRICS_KEY);
        this.metrics = raw ? JSON.parse(raw) : this.freshMetrics();
      } catch {
        this.metrics = this.freshMetrics();
      }
      const m = this.metrics as RestraintMetrics;
      if (!m.today || !m.lifetime) this.metrics = this.freshMetrics();
    }
    const cur = this.metrics as RestraintMetrics;
    if (cur.day !== todayKey()) {
      this.metrics = { day: todayKey(), today: emptyCounters(), lifetime: cur.lifetime };
    }
    return this.metrics as RestraintMetrics;
  }

  private bump(field: keyof RestraintCounters, n = 1): void {
    const m = this.getMetrics();
    m.today[field] += n;
    m.lifetime[field] += n;
    try { persistentStore.setItem(METRICS_KEY, JSON.stringify(m)); } catch {}
  }

  /** Restraint metric: proposals generated vs. admitted vs. suppressed. */
  public getRestraintMetrics(): RestraintMetrics {
    const m = this.getMetrics();
    return {
      day: m.day,
      today: { ...m.today },
      lifetime: { ...m.lifetime },
    };
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

  private loadState(): void {
    try {
      const raw = persistentStore.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const p of arr) {
            const migrated: ProactiveProposal = {
              ...p,
              autonomyTier: tierFor(p),
              status: p.status ?? (p.dismissed ? 'dismissed' : 'pending'),
              source: p.source ?? 'engine',
            };
            this.activeProposals.set(migrated.id, migrated);
          }
        }
      }
    } catch {}
  }

  private saveState(): void {
    try {
      const arr = Array.from(this.activeProposals.values()).slice(-50);
      persistentStore.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {}
    scheduleLedgerSync(this);
  }

  /** Push the full proposal set to the server-side initiative ledger. */
  public pushLedgerSync(): void {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;
    const proposals = Array.from(this.activeProposals.values()).map((p) => ({
      id: p.id,
      title: p.title,
      description: p.summary,
      category: p.category,
      urgency: p.urgency,
      confidence: p.epistemicConfidence,
      rationale: p.why || '',
      suggestedTool: p.suggestedTool,
      suggestedArgs: p.suggestedArgs,
      requiresApproval: p.requiresApproval,
      autonomyTier: p.autonomyTier ?? tierFor(p),
      source: p.source || 'engine',
      dedupeKey: p.dedupeKey,
      status: p.status || 'pending',
      createdAtMs: p.createdAt,
      snoozedUntilMs: p.snoozedUntil,
      executionResult: p.executionResult
        ? { ok: p.executionResult.ok, summary: p.executionResult.summary, atMs: p.executionResult.at }
        : undefined,
    }));
    ledgerPost('/api/cortex/initiative/ledger/sync', { proposals });
  }

  /**
   * Poll the server ledger for agent-approved proposals and run them through
   * the normal accept→execTool path. Called by the initiative sensor each tick.
   */
  public async pickupApprovedProposals(): Promise<number> {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return 0;
    try {
      const res = await fetch('/api/cortex/initiative/ledger/approved', { cache: 'no-store' });
      const data = await res.json();
      const approved: Array<Record<string, any>> = Array.isArray(data?.proposals) ? data.proposals : [];
      let picked = 0;
      for (const ap of approved) {
        // Stale approvals (>24h) are left for the Crew — firing an ancient
        // intent is worse than asking again.
        if (Number(ap.approvedAtMs) && Date.now() - Number(ap.approvedAtMs) > 24 * 3600_000) continue;
        let local = this.activeProposals.get(ap.id);
        if (!local) {
          // Approved server-side but unknown locally (evicted from the
          // localStorage window or approved while this tab was closed).
          // Materialize it so the governed execTool path can run it.
          const materialized: ProactiveProposal = {
            id: String(ap.id),
            category: (ap.category as InitiativeCategory) || 'system_resonance',
            title: String(ap.title || ap.id),
            summary: String(ap.description || ap.summary || ''),
            urgency: (ap.urgency as ProactiveProposal['urgency']) || 'medium',
            suggestedTool: String(ap.suggestedTool || ''),
            suggestedArgs: ap.suggestedArgs && typeof ap.suggestedArgs === 'object' ? ap.suggestedArgs : {},
            requiresApproval: Boolean(ap.requiresApproval),
            epistemicConfidence: Number(ap.confidence ?? ap.epistemicConfidence) || 0,
            createdAt: Number(ap.createdAtMs) || Date.now(),
            autonomyTier: (ap.autonomyTier as 0 | 1 | 2) ?? tierFor(ap),
            status: 'pending',
            source: (ap.source as ProactiveProposal['source']) || 'sensor',
            dedupeKey: ap.dedupeKey ? String(ap.dedupeKey) : undefined,
            why: ap.rationale ? String(ap.rationale) : undefined,
          };
          if (!materialized.suggestedTool) continue;
          this.activeProposals.set(materialized.id, materialized);
          local = materialized;
          this.saveState();
        }
        if (local.status === 'executed' || local.status === 'failed' || local.status === 'dismissed') continue;
        // 'accepted' with no result means execTool never reported back (page
        // reload mid-flight). Re-dispatch only if it's been stuck >90s so we
        // don't double-run an in-flight execution.
        if (local.status === 'accepted' && !local.executionResult) {
          const stuckMs = Date.now() - (local.acceptedAt || local.createdAt || 0);
          if (stuckMs < 90_000) continue;
        } else if (local.status === 'accepted') {
          continue;
        }
        if (this.acceptProposal(ap.id)) picked++;
      }
      return picked;
    } catch {
      return 0;
    }
  }

  private upsert(proposal: ProactiveProposal): void {
    const existing = this.activeProposals.get(proposal.id);
    this.activeProposals.set(proposal.id, { ...existing, ...proposal });
    this.saveState();
    this.notify();
  }

  /**
   * Conducts an ambient evaluation of workspace and cognitive state, generating
   * prioritized proactive proposals.
   */
  public async evaluateInitiatives(options?: InitiativeSensorOptions): Promise<ProactiveAuditResult> {
    const proposals: ProactiveProposal[] = [];
    const healthySignals: string[] = [];

    // 1. Audit Metacognitive Calibration Curves
    const calEngine = getCortexMetacognitionCalibration();
    const snapshot = calEngine.getSnapshot();

    if (snapshot.weakDomains && snapshot.weakDomains.length > 0) {
      proposals.push({
        id: `init-cal-${Date.now()}`,
        category: 'calibration_audit',
        title: `Calibrate Weak Cognitive Domain (${snapshot.weakDomains.join(', ')})`,
        summary: `Domains [${snapshot.weakDomains.join(', ')}] exhibit elevated Expected Calibration Error (>0.20) or low empirical accuracy. Proactive verification runs recommended.`,
        urgency: 'medium',
        suggestedTool: 'cortex_metacognition',
        suggestedArgs: { action: 'assess_domain', domain: snapshot.weakDomains[0] },
        requiresApproval: false,
        epistemicConfidence: 0.92,
        dedupeKey: `calibration:${snapshot.weakDomains.join(',')}`,
        createdAt: Date.now(),
      });
    } else {
      healthySignals.push('metacognitive_calibration_optimal');
    }

    // 2. Audit Git & Working Tree State
    const uncommitted = options?.uncommittedFileCount ?? 0;
    if (uncommitted > 50) {
      proposals.push({
        id: `init-git-${Date.now()}`,
        category: 'git_hygiene',
        title: 'Review Git Working Tree Drift',
        summary: `${uncommitted} modified/untracked files detected. Consider creating a clean checkpoint commit to prevent epistemic confusion.`,
        urgency: 'low',
        suggestedTool: 'run_command',
        suggestedArgs: { command: 'git status --short' },
        requiresApproval: true,
        epistemicConfidence: 0.88,
        dedupeKey: 'git_drift',
        createdAt: Date.now(),
      });
    } else {
      healthySignals.push('git_hygiene_stable');
    }

    // 3. Audit Free Energy / Cognitive Entropy
    const freeEnergy = options?.freeEnergy ?? 0.12;
    if (freeEnergy > 0.45) {
      proposals.push({
        id: `init-fe-${Date.now()}`,
        category: 'system_resonance',
        title: 'Epistemic Homeostasis Rebalancing Required',
        summary: `Variational free energy F=${freeEnergy.toFixed(2)} exceeds critical ceiling (0.40). Synaptic downscaling and dream consolidation recommended.`,
        urgency: 'high',
        suggestedTool: 'cortex_accomplishments',
        suggestedArgs: { action: 'daily_brief' },
        requiresApproval: false,
        epistemicConfidence: 0.95,
        dedupeKey: 'free_energy',
        createdAt: Date.now(),
      });
    } else {
      healthySignals.push('variational_free_energy_low');
    }

    // 4. Audit unanswered email backlog
    const unanswered = options?.unansweredEmailCount ?? 0;
    if (unanswered > 3) {
      const urgent = options?.urgentEmailCount ?? 0;
      proposals.push({
        id: `init-email-${Date.now()}`,
        category: 'system_resonance',
        title: `${unanswered} emails awaiting reply${urgent > 0 ? ` (${urgent} urgent)` : ''}`,
        summary: `Your inbox has ${unanswered} unanswered threads${urgent > 0 ? `, ${urgent} flagged urgent` : ''}. Accept opens your live inbox panel with the real threads — replies are yours to send.`,
        urgency: urgent > 0 ? 'high' : 'medium',
        suggestedTool: 'cortex_surface',
        suggestedArgs: { action: 'open', kind: 'inbox' },
        requiresApproval: false,
        autonomyTier: 1,
        status: 'pending',
        source: 'sensor',
        dedupeKey: 'email_backlog',
        why: `gmail.live_inbox.unanswered=${unanswered}, urgent=${urgent}`,
        epistemicConfidence: 0.9,
        createdAt: Date.now(),
      });
    } else {
      healthySignals.push('email_backlog_clear');
    }

    // 5. Audit stale tasks
    const staleTasks = options?.staleTaskCount ?? 0;
    if (staleTasks > 0) {
      proposals.push({
        id: `init-tasks-${Date.now()}`,
        category: 'memory_allostasis',
        title: `${staleTasks} stale task${staleTasks === 1 ? '' : 's'} need triage`,
        summary: `${staleTasks} open task${staleTasks === 1 ? ' has' : 's have'} gone untouched past their expected cadence. Accept tracks triage as a weekly goal so it doesn't get lost.`,
        urgency: 'medium',
        suggestedTool: 'cortex_goals',
        suggestedArgs: { action: 'declare', title: `Triage ${staleTasks} stale task${staleTasks === 1 ? '' : 's'}`, horizon: 'week' },
        requiresApproval: false,
        autonomyTier: 1,
        status: 'pending',
        source: 'sensor',
        dedupeKey: 'stale_tasks',
        why: `tasks.stale=${staleTasks}, dueToday=${options?.tasksDueToday ?? 0}`,
        epistemicConfidence: 0.85,
        createdAt: Date.now(),
      });
    }

    // 6. Meeting prep window
    const meetingIn = options?.nextMeetingInMin;
    if (meetingIn !== undefined && meetingIn > 0 && meetingIn <= 30) {
      proposals.push({
        id: `init-meeting-${Date.now()}`,
        category: 'system_resonance',
        title: `Meeting in ${meetingIn} min — prep brief ready`,
        summary: `Your next meeting starts in ${meetingIn} minutes. Accept tracks prep as a goal — Cortex will keep it on your radar.`,
        urgency: 'medium',
        suggestedTool: 'cortex_goals',
        suggestedArgs: { action: 'declare', title: 'Prep for upcoming meeting', horizon: 'week' },
        requiresApproval: false,
        autonomyTier: 1,
        status: 'pending',
        source: 'sensor',
        dedupeKey: 'meeting_prep',
        why: `calendar.nextMeetingInMin=${meetingIn}`,
        epistemicConfidence: 0.8,
        createdAt: Date.now(),
      });
    }

    // 7. Financial anomalies
    const anomalies = options?.anomalousChargeCount ?? 0;
    const invoices = options?.pendingInvoiceCount ?? 0;
    if (anomalies > 0 || invoices > 2) {
      proposals.push({
        id: `init-finance-${Date.now()}`,
        category: 'system_resonance',
        title: anomalies > 0 ? `${anomalies} unusual charge${anomalies === 1 ? '' : 's'} detected` : `${invoices} invoices pending`,
        summary: anomalies > 0
          ? `${anomalies} transaction${anomalies === 1 ? '' : 's'} fell outside your normal spending pattern. Review before they settle.`
          : `${invoices} invoices are awaiting payment.`,
        urgency: anomalies > 0 ? 'high' : 'medium',
        suggestedTool: 'cortex_goals',
        suggestedArgs: { action: 'declare', title: anomalies > 0 ? `Review ${anomalies} unusual charge${anomalies === 1 ? '' : 's'}` : `Pay ${invoices} pending invoices`, horizon: 'week' },
        requiresApproval: true,
        autonomyTier: 2,
        status: 'pending',
        source: 'sensor',
        dedupeKey: 'finance_anomaly',
        why: `finance.anomalies=${anomalies}, pendingInvoices=${invoices}`,
        epistemicConfidence: 0.75,
        createdAt: Date.now(),
      });
    }

    // 8. Somatic/interoceptive load (Phase 5.1 spike — kill criterion in spec)
    const hrvDelta = options?.hrvDeltaPct;
    const lateNights = options?.consecutiveLateNights ?? 0;
    const somaticStress = options?.somaticStressScore ?? 0;
    const sleepDebt = options?.sleepDebtHours ?? 0;
    if ((hrvDelta !== undefined && hrvDelta < -0.20 && lateNights >= 3) || somaticStress > 0.7) {
      proposals.push({
        id: `init-somatic-${Date.now()}`,
        category: 'system_resonance',
        title: 'Recovery load detected — protect tomorrow\u2019s deep block',
        summary: `Interoceptive signals show elevated allostatic load${hrvDelta !== undefined ? ` (HRV ${Math.round(hrvDelta * 100)}% vs baseline` : ''}${lateNights > 0 ? `, ${lateNights} consecutive late nights` : ''}${sleepDebt > 0 ? `, ${sleepDebt}h sleep debt` : ''}). Accept tracks a recovery window as a goal.`,
        urgency: 'medium',
        suggestedTool: 'cortex_goals',
        suggestedArgs: { action: 'declare', title: 'Protect recovery window — ease cognitive load', horizon: 'week' },
        requiresApproval: false,
        autonomyTier: 1,
        status: 'pending',
        source: 'sensor',
        dedupeKey: 'somatic_recovery',
        why: `somatic.hrvDelta=${hrvDelta?.toFixed(2) ?? 'n/a'}, lateNights=${lateNights}, stress=${somaticStress}, sleepDebt=${sleepDebt}`,
        epistemicConfidence: 0.65,
        createdAt: Date.now(),
      });
    } else {
      healthySignals.push('somatic_load_nominal');
    }

    // Dedupe against active proposals + daily nudge budget (restraint).
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const todayCount = Array.from(this.activeProposals.values())
      .filter(p => p.createdAt > dayAgo && p.status !== 'dismissed').length;
    const budgetLeft = Math.max(0, MAX_PROPOSALS_PER_DAY - todayCount);

    const fresh: ProactiveProposal[] = [];
    let dupes = 0;
    for (const p of proposals) {
      const key = p.dedupeKey || p.id;
      const dupe = Array.from(this.activeProposals.values()).some((a) => {
        if ((a.dedupeKey || a.id) !== key) return false;
        // Answered proposals suppress re-filing — dismissed for 24h,
        // executed for 72h (work was done; a persistent condition does not
        // deserve a fresh card every day). An answered one must not nag on
        // every evaluation cycle.
        if (a.status === 'executed') {
          return Date.now() - (a.createdAt || 0) < 72 * 3600_000;
        }
        if (a.status === 'dismissed') {
          return Date.now() - (a.createdAt || 0) < 24 * 3600_000;
        }
        return true;
      });
      if (dupe) { dupes++; continue; }
      const normalized: ProactiveProposal = {
        ...p,
        autonomyTier: tierFor(p),
        status: 'pending',
        source: p.source ?? 'engine',
      };
      fresh.push(normalized);
    }
    const admitted = fresh.slice(0, budgetLeft);

    this.bump('proposed', proposals.length);
    this.bump('admitted', admitted.length);
    this.bump('suppressedDedupe', dupes);
    this.bump('suppressedBudget', fresh.length - admitted.length);

    for (const p of admitted) {
      this.upsert(p);
    }

    // Trust Ladder: graduated domains execute without a card (still audited).
    // Gated behind cortex.trust.enabled — default OFF until server-side policy lands.
    try {
      const ledger = getCortexTrustLedger();
      for (const p of admitted) {
        const tier = p.autonomyTier ?? (p.requiresApproval ? 2 : 1);
        if (ledger.isAutoAllowed(p.suggestedTool, tier) || isSafeAutoClient(p.suggestedTool, tier, p.requiresApproval)) {
          ledger.logEvent(p.suggestedTool, tier, 'auto_executed', p.title);
          this.acceptProposal(p.id);
        }
      }
    } catch {}

    this.saveState();
    this.notify();

    return {
      proposals,
      totalAudited: proposals.length + healthySignals.length,
      healthySignals,
      anomaliesDetected: proposals.length,
      timestamp: Date.now(),
    };
  }

  /** All non-dismissed proposals, including executed/failed (activity history). */
  public getActiveProposals(): ProactiveProposal[] {
    const now = Date.now();
    return Array.from(this.activeProposals.values()).filter(p => {
      if (p.dismissed || p.status === 'dismissed') return false;
      if (p.status === 'snoozed' && p.snoozedUntil && p.snoozedUntil > now) return false;
      return true;
    });
  }

  /** Actionable proposals awaiting a decision (pending/accepted, snooze-expired). */
  public getPendingProposals(): ProactiveProposal[] {
    const now = Date.now();
    return this.getActiveProposals()
      .filter(p => {
        if (p.status === 'executed' || p.status === 'failed') return false;
        if (p.status === 'snoozed' && p.snoozedUntil && p.snoozedUntil <= now) return true;
        return p.status === 'pending' || p.status === 'accepted' || p.status === 'snoozed';
      })
      .sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 } as const;
        return rank[a.urgency] - rank[b.urgency] || b.createdAt - a.createdAt;
      });
  }

  public dismissProposal(id: string): boolean {
    const p = this.activeProposals.get(id);
    if (!p) return false;
    p.dismissed = true;
    p.status = 'dismissed';
    this.bump('dismissed');
    this.saveState();
    this.notify();
    return true;
  }

  public snoozeProposal(id: string, untilMs: number): boolean {
    const p = this.activeProposals.get(id);
    if (!p) return false;
    p.status = 'snoozed';
    p.snoozedUntil = untilMs;
    this.bump('snoozed');
    this.saveState();
    this.notify();
    return true;
  }

  /**
   * Marks a proposal accepted and emits the execution event. The host layer
   * (CortexVisualizerPage) listens for 'cortex-initiative-accept' and runs
   * execTool — keeping the volition governor in one place.
   */
  /**
   * External proposers (goals drift, forecasts, diplomacy) inject proposals
   * here. Applies the same dedupe + daily budget rules as evaluateInitiatives.
   * Returns the admitted proposal or null if deduped/budget-exhausted.
   */
  public submitProposal(input: Omit<ProactiveProposal, 'id' | 'createdAt'> & { id?: string }): ProactiveProposal | null {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const todayCount = Array.from(this.activeProposals.values())
      .filter(p => p.createdAt > dayAgo && p.status !== 'dismissed').length;
    if (todayCount >= MAX_PROPOSALS_PER_DAY) {
      this.bump('proposed');
      this.bump('suppressedBudget');
      return null;
    }

    const key = input.dedupeKey || input.id || '';
    const dupe = key && Array.from(this.activeProposals.values()).some((a) => {
      if ((a.dedupeKey || a.id) !== key) return false;
      if (a.status === 'executed') {
        return Date.now() - (a.createdAt || 0) < 72 * 3600_000;
      }
      if (a.status === 'dismissed') {
        return Date.now() - (a.createdAt || 0) < 24 * 3600_000;
      }
      return true;
    });
    if (dupe) {
      this.bump('proposed');
      this.bump('suppressedDedupe');
      return null;
    }
    this.bump('proposed');
    this.bump('admitted');

    const proposal: ProactiveProposal = {
      ...input,
      id: input.id || `init-ext-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      autonomyTier: tierFor(input),
      status: 'pending',
      source: input.source ?? 'sensor',
    };
    this.upsert(proposal);
    // Trust Ladder: graduated domains execute without a card (still audited).
    try {
      const ledger = getCortexTrustLedger();
      const tier = proposal.autonomyTier ?? tierFor(proposal);
      if (ledger.isAutoAllowed(proposal.suggestedTool, tier) || isSafeAutoClient(proposal.suggestedTool, tier, proposal.requiresApproval)) {
        ledger.logEvent(proposal.suggestedTool, tier, 'auto_executed', proposal.title);
        this.acceptProposal(proposal.id);
      }
    } catch {}
    return proposal;
  }

  public acceptProposal(id: string): boolean {
    const p = this.activeProposals.get(id);
    if (!p || p.status === 'executed' || p.status === 'dismissed') return false;
    p.status = 'accepted';
    p.acceptedAt = Date.now();
    this.bump('accepted');
    this.saveState();
    this.notify();
    try {
      getCortexTrustLedger().logEvent(
        p.suggestedTool,
        p.autonomyTier ?? (p.requiresApproval ? 2 : 1),
        'manual_accepted',
        p.title,
      );
    } catch {}
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cortex-initiative-accept', {
        detail: { proposal: { ...p } },
      }));
    }
    return true;
  }

  public markExecuted(id: string, result: { ok: boolean; summary: string }): void {
    const p = this.activeProposals.get(id);
    if (!p) return;
    p.status = result.ok ? 'executed' : 'failed';
    p.executionResult = { ok: result.ok, summary: result.summary.slice(0, 300), at: Date.now() };
    try {
      getCortexTrustLedger().recordExecution(
        p.suggestedTool,
        p.autonomyTier ?? (p.requiresApproval ? 2 : 1),
        result.ok,
        result.summary,
      );
    } catch {}
    reportLedgerExecuted(id, result.ok, result.summary);
    this.saveState();
    this.notify();
  }

  public clear(): void {
    this.activeProposals.clear();
    this.saveState();
    this.notify();
  }
}

// ── Global Singleton ───────────────────────────────────────────────

let globalInitiativeEngine: CortexProactiveInitiativeEngine | null = null;

export function getCortexProactiveInitiative(): CortexProactiveInitiativeEngine {
  if (!globalInitiativeEngine) {
    globalInitiativeEngine = new CortexProactiveInitiativeEngine();
  }
  return globalInitiativeEngine;
}

