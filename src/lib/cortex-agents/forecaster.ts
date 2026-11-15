/**
 * Cortex Forecaster — anticipator engine (spec: CORTEX_FORECASTER_SPEC.md,
 * research: CORTEX_AGENTS_RESEARCH.md).
 *
 * FORECASTER is a router, not a monolith: domain probes emit evidence-cited
 * ForecastSignals, the router dedupes/scores/routes them into three tiers
 * (ambient visual → initiative proposal → rationed spoken), and every
 * emitted signal carries ≥1 EvidenceRef or it is dropped at emit time.
 *
 * Honesty invariant: a probe with no evidence emits nothing. "Scanned N
 * domains, 0 actionable" is a valid result.
 */

import fs from 'node:fs';
import path from 'node:path';

// ── Contracts ──────────────────────────────────────────────────────

export type ForecastDomain =
  | 'calendar' | 'weather' | 'build' | 'fleet'
  | 'comms' | 'distribution' | 'energy';

export type ForecastUrgency = 'ambient' | 'proposal' | 'interrupt';

export interface EvidenceRef {
  /** Where the claim came from: 'agent-state', 'gmail:<id>', 'doc:<path>',
   *  'gev-layer', 'ci:<run>', 'calendar:<eventId>', 'file:<path>'. */
  kind: string;
  ref: string;
  label?: string;
}

export interface ForecastSignal {
  /** Dedupe key: domain + subject + horizon bucket. */
  id: string;
  domain: ForecastDomain;
  /** One sentence, human-readable. */
  claim: string;
  /** REQUIRED — a signal with zero evidence is dropped before routing. */
  evidence: EvidenceRef[];
  /** Root-cause attachment (Tellius pattern): why this is forming. */
  why?: string;
  /** 0-1, probe-assigned with stated basis. */
  confidence: number;
  /** Personal relevance 0-1 — does it touch the user's calendar, assets,
   *  or goals? Probe-assigned; defaults to 0.7 when absent. */
  personalRelevance?: number;
  horizon: { notBefore: number; notAfter: number };
  trigger?: string;
  suggestedAction?: string;
  urgency: ForecastUrgency;
  topic?: string;
  /** Downstream agent handoff — e.g. a calendar noprep signal dispatches a
   *  PREP task. Executed by the worker after routing, budget-gated by the
   *  target agent's own daily budget and submitTask dedupe. */
  handoff?: { agent: string; kind: string; title: string; input: Record<string, unknown> };
}

export interface ForecastProbe {
  id: string;
  domain: ForecastDomain;
  description: string;
  run(deps: ProbeDeps): Promise<ForecastSignal[]>;
}

export interface ProbeDeps {
  now: number;
  fetchImpl: typeof fetch;
  /** Agent fleet snapshot — injected so probes stay unit-testable. */
  getAgentSnapshot?: () => Promise<unknown> | unknown;
  /** Upcoming calendar events — injected; default impl may be absent. */
  listUpcomingEvents?: () => Promise<ForecastCalendarEvent[]>;
  /** Gmail live-inbox summary — injected; absent = probe stays silent. */
  getInboxSummary?: () => Promise<{
    found?: boolean; unreadCount?: number; threads?: any[];
  } | null>;
  /** Initiative sense snapshot (git/memory/free-energy signals). */
  getSenseSnapshot?: () => Promise<Record<string, any> | null>;
  /** Distribution queue status. */
  getDistributionStatus?: () => Promise<Record<string, any> | null>;
  /** Severe weather alerts near watched regions (NWS CAP feed). */
  getWeatherAlerts?: () => Promise<{ count: number; maxSeverity: string; regions: string[] } | null>;
  base: string;
}

export interface ForecastCalendarEvent {
  id: string;
  title: string;
  start: number; // epoch ms
  end?: number;
  attendees?: number;
  /** Attendee display names/emails when the calendar source provides them —
   *  forwarded to PREP handoffs. */
  attendeeNames?: string[];
  hasPrepBrief?: boolean;
}

// ── Router ─────────────────────────────────────────────────────────

export type ForecastTier = 1 | 2 | 3;

export interface RoutedForecast extends ForecastSignal {
  tier: ForecastTier;
  routeScore: number;
  /** True when a Tier-3 signal was pushed down by the daily budget. */
  demoted?: boolean;
}

/** Research-grounded ceiling: ~3–5 unsolicited AI updates/day across ALL
 *  sources; Cortex enforces 3 spoken/day system-wide (CORTEX_AGENTS_RESEARCH §C). */
export const SPOKEN_DAILY_BUDGET = 3;

const URGENCY_WEIGHT: Record<ForecastUrgency, number> = {
  ambient: 0.4,
  proposal: 0.7,
  interrupt: 1.0,
};

const TIER_BY_URGENCY: Record<ForecastUrgency, ForecastTier> = {
  ambient: 1,
  proposal: 2,
  interrupt: 3,
};

export interface RouterState {
  /** Spoken forecasts already fired today (persisted). */
  spokenToday: number;
  /** yyyy-mm-dd the counter belongs to. */
  spokenDay: string;
}

export function freshRouterState(now = Date.now()): RouterState {
  return { spokenToday: 0, spokenDay: new Date(now).toISOString().slice(0, 10) };
}

/**
 * Validate → dedupe → score → tier. Pure function: budget state is passed
 * in, never mutated here (the caller persists it after dispatch).
 */
export function routeSignals(
  signals: ForecastSignal[],
  state: RouterState,
  now = Date.now(),
): { routed: RoutedForecast[]; dropped: number; spokenRemaining: number } {
  const day = new Date(now).toISOString().slice(0, 10);
  const spokenUsed = state.spokenDay === day ? state.spokenToday : 0;
  let spokenRemaining = Math.max(0, SPOKEN_DAILY_BUDGET - spokenUsed);

  // Evidence-or-silence: drop anything uncited before it can route.
  const valid = signals.filter((s) => Array.isArray(s.evidence) && s.evidence.length > 0);
  const dropped = signals.length - valid.length;

  // Dedupe by id — keep the highest-confidence instance.
  const byId = new Map<string, ForecastSignal>();
  for (const s of valid) {
    const prev = byId.get(s.id);
    if (!prev || s.confidence > prev.confidence) byId.set(s.id, s);
  }

  const routed: RoutedForecast[] = [];
  for (const s of byId.values()) {
    const relevance = s.personalRelevance ?? 0.7;
    const routeScore = Math.min(1, s.confidence * relevance * URGENCY_WEIGHT[s.urgency]);
    let tier = TIER_BY_URGENCY[s.urgency];
    let demoted = false;
    // Tier-3 requires confidence ≥0.8 AND remaining spoken budget.
    if (tier === 3) {
      if (s.confidence < 0.8 || spokenRemaining <= 0) {
        tier = 2;
        demoted = true;
      } else {
        spokenRemaining--;
      }
    }
    routed.push({ ...s, tier, routeScore, ...(demoted ? { demoted: true } : {}) });
  }
  routed.sort((a, b) => b.routeScore - a.routeScore);
  return { routed, dropped, spokenRemaining };
}

// ── Persistence (router state + forecast ledger) ───────────────────

const RUNTIME_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const ROUTER_STATE_FILE = path.join(RUNTIME_DIR, 'forecaster-state.json');
const LEDGER_FILE = path.join(RUNTIME_DIR, 'forecasts.jsonl');

export function loadRouterState(): RouterState {
  try {
    const raw = JSON.parse(fs.readFileSync(ROUTER_STATE_FILE, 'utf8'));
    if (typeof raw?.spokenToday === 'number' && typeof raw?.spokenDay === 'string') {
      return { spokenToday: raw.spokenToday, spokenDay: raw.spokenDay };
    }
  } catch {}
  return freshRouterState();
}

export function saveRouterState(state: RouterState): void {
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(ROUTER_STATE_FILE, JSON.stringify(state));
  } catch {}
}

/** Append-only forecast ledger — outcome calibration reads this later. */
export function appendForecastLedger(entry: Record<string, unknown>): void {
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.appendFileSync(LEDGER_FILE, JSON.stringify({ at: Date.now(), ...entry }) + '\n');
  } catch {}
}

// ── v1 probes ──────────────────────────────────────────────────────

/** Fleet probe: agent failure-rate climbs, offline agents, budget burn. */
export const fleetProbe: ForecastProbe = {
  id: 'fleet',
  domain: 'fleet',
  description: 'Agent runtime health — failure streaks, offline workers, stalls.',
  async run(deps) {
    if (!deps.getAgentSnapshot) return [];
    const snap: any = await deps.getAgentSnapshot();
    const agents: any[] = Array.isArray(snap?.agents) ? snap.agents : [];
    const tasks: any[] = Array.isArray(snap?.tasks) ? snap.tasks : [];
    const out: ForecastSignal[] = [];
    const now = deps.now;

    for (const a of agents) {
      const id = String(a?.id || 'unknown');
      const status = String(a?.status || '');
      const agentTasks = tasks.filter((t) => t?.agentId === id || t?.agentId === a?.id);
      const queued = agentTasks.filter((t) => t?.status === 'queued').length;

      // Offline/error agent with queued work = stalled pipeline.
      if ((status === 'offline' || status === 'error') && queued > 0) {
        out.push({
          id: `fleet:${id}:stalled`,
          domain: 'fleet',
          claim: `${id.toUpperCase()} is ${status} with ${queued} queued task(s) — work is piling up.`,
          evidence: [{ kind: 'agent-state', ref: id, label: `status=${status} queued=${queued}` }],
          confidence: 0.85,
          personalRelevance: 0.6,
          horizon: { notBefore: now, notAfter: now + 6 * 3600_000 },
          suggestedAction: `Check ${id} worker health or reassign its queue.`,
          urgency: 'proposal',
        });
      }

      // Failure streak: ≥3 of the agent's 5 most recent tasks failed.
      const recent = agentTasks
        .slice()
        .sort((x, y) => (y?.createdAt ?? 0) - (x?.createdAt ?? 0))
        .slice(0, 5);
      const fails = recent.filter((t) => t?.status === 'failed').length;
      if (recent.length >= 3 && fails >= 3) {
        out.push({
          id: `fleet:${id}:failstreak`,
          domain: 'fleet',
          claim: `${id.toUpperCase()} failed ${fails} of its last ${recent.length} tasks — likely a stuck provider or bad input pattern.`,
          evidence: [{ kind: 'agent-state', ref: id, label: `${fails}/${recent.length} recent failures` }],
          why: 'Repeated terminal failures usually mean provider outage or malformed recurring input, not bad luck.',
          confidence: 0.8,
          personalRelevance: 0.6,
          horizon: { notBefore: now, notAfter: now + 12 * 3600_000 },
          suggestedAction: `Inspect ${id} task inputs and provider health.`,
          urgency: 'proposal',
        });
      }

      // Stale heartbeat while claiming alive: lastHeartbeatAt >10min old.
      const hb = typeof a?.lastHeartbeatAt === 'number' ? a.lastHeartbeatAt : null;
      if (hb && now - hb > 10 * 60_000 && (status === 'idle' || status === 'working')) {
        out.push({
          id: `fleet:${id}:stalehb`,
          domain: 'fleet',
          claim: `${id.toUpperCase()} hasn't heartbeated in ${Math.round((now - hb) / 60_000)}min but reports ${status}.`,
          evidence: [{ kind: 'agent-state', ref: id, label: `heartbeat age ${Math.round((now - hb) / 60_000)}min` }],
          confidence: 0.7,
          personalRelevance: 0.5,
          horizon: { notBefore: now, notAfter: now + 2 * 3600_000 },
          urgency: 'ambient',
        });
      }
    }
    return out;
  },
};

/** Calendar probe: meetings approaching with no prep artifact. */
export const calendarProbe: ForecastProbe = {
  id: 'calendar',
  domain: 'calendar',
  description: 'Upcoming events lacking prep windows or briefs.',
  async run(deps) {
    if (!deps.listUpcomingEvents) return [];
    const events = await deps.listUpcomingEvents();
    const now = deps.now;
    const out: ForecastSignal[] = [];
    for (const ev of events) {
      const inHours = (ev.start - now) / 3600_000;
      // Meeting within ~3h, external-sized, no brief → prep-window forecast.
      if (inHours > 0 && inHours <= 3 && (ev.attendees ?? 0) >= 1 && !ev.hasPrepBrief) {
        out.push({
          id: `calendar:${ev.id}:noprep`,
          domain: 'calendar',
          claim: `"${ev.title}" starts in ~${Math.max(1, Math.round(inHours))}h with no prep brief.`,
          evidence: [{ kind: 'calendar', ref: ev.id, label: ev.title }],
          confidence: 0.9,
          personalRelevance: 1.0,
          horizon: { notBefore: now, notAfter: ev.start },
          suggestedAction: 'Have PREP build a cited brief.',
          urgency: inHours <= 1 ? 'interrupt' : 'proposal',
          handoff: {
            agent: 'prep',
            kind: 'prep_brief',
            title: `Prep brief: ${ev.title}`.slice(0, 140),
            input: {
              title: ev.title,
              start: ev.start,
              attendees: ev.attendeeNames || [],
              forecastSignal: `calendar:${ev.id}:noprep`,
            },
          },
        });
      }
      // Back-to-back: next event starts <15min after this one ends.
      const gap = ev.end ? ev.start - ev.end : 0;
      if (gap > 0 && gap < 15 * 60_000) {
        out.push({
          id: `calendar:${ev.id}:backtoback`,
          domain: 'calendar',
          claim: `Only ${Math.round(gap / 60_000)}min between "${ev.title}" and the next commitment.`,
          evidence: [{ kind: 'calendar', ref: ev.id, label: `${Math.round(gap / 60_000)}min gap` }],
          confidence: 0.75,
          personalRelevance: 0.8,
          horizon: { notBefore: now, notAfter: ev.start },
          urgency: 'ambient',
        });
      }
    }
    return out;
  },
};

/** Comms probe: Gmail backlog growth — unread volume is a leading indicator
 *  of dropped threads before they become missed commitments. */
export const commsProbe: ForecastProbe = {
  id: 'comms',
  domain: 'comms',
  description: 'Inbox backlog and thread decay signals.',
  async run(deps) {
    if (!deps.getInboxSummary) return [];
    const inbox = await deps.getInboxSummary();
    if (!inbox?.found) return [];
    const unread = Number(inbox.unreadCount) || 0;
    const threads: any[] = Array.isArray(inbox.threads) ? inbox.threads : [];
    const out: ForecastSignal[] = [];
    const now = deps.now;

    if (unread >= 1000) {
      out.push({
        id: 'comms:backlog',
        domain: 'comms',
        claim: `${unread.toLocaleString()} unread threads in the live inbox — backlog is deep enough that replies are likely being missed.`,
        evidence: [{ kind: 'gmail-live-inbox', ref: 'unread', label: `${unread} unread` }],
        why: 'Unread volume at this scale means triage cadence has fallen behind arrival rate; important threads age out of view.',
        confidence: 0.75,
        personalRelevance: 0.8,
        horizon: { notBefore: now, notAfter: now + 24 * 3600_000 },
        suggestedAction: 'Run a gmail triage pass or delegate backlog reduction to an agent.',
        urgency: 'proposal',
      });
    }
    // Unread threads older than ~14d are likely dead conversations.
    const staleUnread = threads.filter((t) => {
      const age = t?.date ? now - new Date(t.date).getTime() : NaN;
      return t?.unread === true && Number.isFinite(age) && age > 14 * 24 * 3600_000;
    }).length;
    if (staleUnread >= 10) {
      out.push({
        id: 'comms:stale-threads',
        domain: 'comms',
        claim: `${staleUnread} unread threads are older than two weeks — likely dead conversations or missed replies.`,
        evidence: [{ kind: 'gmail-live-inbox', ref: 'threads', label: `${staleUnread} stale unread` }],
        confidence: 0.7,
        personalRelevance: 0.6,
        horizon: { notBefore: now, notAfter: now + 72 * 3600_000 },
        suggestedAction: 'Review stale unread for commitments that went unanswered.',
        urgency: 'ambient',
      });
    }
    return out;
  },
};

/** Build probe: repo hygiene debt from the initiative sense bus — uncommitted
 *  work and commit cadence are leading indicators of stalled builds. */
export const buildProbe: ForecastProbe = {
  id: 'build',
  domain: 'build',
  description: 'Git/CI hygiene signals from the sense snapshot.',
  async run(deps) {
    if (!deps.getSenseSnapshot) return [];
    const snap = await deps.getSenseSnapshot();
    if (!snap) return [];
    const uncommitted = Number(snap.uncommittedFileCount) || 0;
    const commits7d = Number(snap.commitsLast7d) || 0;
    const out: ForecastSignal[] = [];
    const now = deps.now;

    if (uncommitted >= 50) {
      out.push({
        id: 'build:uncommitted-debt',
        domain: 'build',
        claim: `${uncommitted} uncommitted files — change debt is accumulating faster than it can be reviewed.`,
        evidence: [{ kind: 'sense', ref: 'uncommittedFileCount', label: `${uncommitted} files` }],
        why: 'Large uncommitted surfaces hide regressions and make every subsequent diff unauditable.',
        confidence: 0.8,
        personalRelevance: 0.7,
        horizon: { notBefore: now, notAfter: now + 48 * 3600_000 },
        suggestedAction: 'Have BUILDER/REVIEWER triage the dirty tree into commits or reverts.',
        urgency: 'proposal',
      });
    }
    if (uncommitted > 0 && commits7d === 0) {
      out.push({
        id: 'build:no-commits',
        domain: 'build',
        claim: `Zero commits in 7 days with ${uncommitted} uncommitted files — active work is not landing.`,
        evidence: [
          { kind: 'sense', ref: 'commitsLast7d', label: '0 commits/7d' },
          { kind: 'sense', ref: 'uncommittedFileCount', label: `${uncommitted} files` },
        ],
        confidence: 0.85,
        personalRelevance: 0.7,
        horizon: { notBefore: now, notAfter: now + 72 * 3600_000 },
        suggestedAction: 'Commit or stash outstanding work; check whether agents are blocked.',
        urgency: 'proposal',
      });
    }
    return out;
  },
};

/** Distribution probe: queue health for the revenue engine — failed or
 *  stalled distribution items are forecasts of lost launch windows. */
export const distributionProbe: ForecastProbe = {
  id: 'distribution',
  domain: 'distribution',
  description: 'Gumroad/Pinterest/Reddit queue health signals.',
  async run(deps) {
    if (!deps.getDistributionStatus) return [];
    const status = await deps.getDistributionStatus();
    if (!status) return [];
    const counts: Record<string, number> = status?.queue?.counts || status?.counts || {};
    const failed = Number(counts.failed) || 0;
    const pending = Number(counts.pending) || 0;
    const out: ForecastSignal[] = [];
    const now = deps.now;

    if (failed > 0) {
      out.push({
        id: 'distribution:failed-items',
        domain: 'distribution',
        claim: `${failed} distribution queue item(s) failed — launch assets are not reaching their channels.`,
        evidence: [{ kind: 'distribution-status', ref: 'queue', label: `${failed} failed of ${pending + failed + (Number(counts.done) || 0)} total` }],
        why: 'Failed queue items usually mean a provider auth, format, or rate-limit problem that will recur until fixed.',
        confidence: 0.8,
        personalRelevance: 0.7,
        horizon: { notBefore: now, notAfter: now + 24 * 3600_000 },
        suggestedAction: 'Inspect the failed items and requeue after fixing the cause.',
        urgency: 'proposal',
      });
    }
    if (pending >= 20) {
      out.push({
        id: 'distribution:backlog',
        domain: 'distribution',
        claim: `${pending} distribution items are queued — at current cadence the launch window is slipping.`,
        evidence: [{ kind: 'distribution-status', ref: 'queue', label: `${pending} pending` }],
        confidence: 0.65,
        personalRelevance: 0.6,
        horizon: { notBefore: now, notAfter: now + 72 * 3600_000 },
        urgency: 'ambient',
      });
    }
    return out;
  },
};

/** Weather probe: severe-alert watch. Silent unless a watched region has
 *  active alerts — national noise is not a forecast. */
export const weatherProbe: ForecastProbe = {
  id: 'weather',
  domain: 'weather',
  description: 'Severe weather alerts overlapping watched regions.',
  async run(deps) {
    if (!deps.getWeatherAlerts) return [];
    const alerts = await deps.getWeatherAlerts();
    if (!alerts || !alerts.count) return [];
    const severe = ['Extreme', 'Severe'].includes(String(alerts.maxSeverity));
    if (!severe) return [];
    return [{
      id: `weather:${alerts.regions.join(',') || 'watched'}:severe`,
      domain: 'weather',
      claim: `Severe weather alert active (${alerts.maxSeverity}) for ${alerts.regions.join(', ') || 'watched region'}.`,
      evidence: [{ kind: 'nws-alerts', ref: alerts.regions.join(','), label: `${alerts.count} alerts, max ${alerts.maxSeverity}` }],
      confidence: 0.9,
      personalRelevance: 1.0,
      horizon: { notBefore: deps.now, notAfter: deps.now + 12 * 3600_000 },
      suggestedAction: 'Check the globe weather layers and defer outdoor-dependent plans.',
      urgency: 'interrupt',
    }];
  },
};

/** Energy probe: resonance-calculus timing — surfaces when the user's
 *  circadian window makes a forecast actionable vs. noise. */
export const energyProbe: ForecastProbe = {
  id: 'energy',
  domain: 'energy',
  description: 'Circadian/coherence timing advisories for forecast actions.',
  async run(deps) {
    // Minimal v1: flag when a high-urgency window (proposal-heavy hour)
    // collides with typical low-circadian hours — defer non-urgent items.
    const hour = new Date(deps.now).getHours();
    const out: ForecastSignal[] = [];
    // Circadian trough ~13-15h post-lunch and late night; peak ~9-11h.
    const trough = (hour >= 13 && hour <= 15) || hour >= 22 || hour < 6;
    if (trough) {
      out.push({
        id: `energy:trough:${new Date(deps.now).toISOString().slice(0, 10)}`,
        domain: 'energy',
        claim: `Low circadian window right now (~${hour}:00) — non-urgent forecast actions will land better after peak hours.`,
        evidence: [{ kind: 'resonance', ref: `hour=${hour}`, label: 'circadian trough' }],
        confidence: 0.6,
        personalRelevance: 0.5,
        horizon: { notBefore: deps.now, notAfter: deps.now + 4 * 3600_000 },
        urgency: 'ambient',
      });
    }
    return out;
  },
};

/** Probe registry — v1 ships fleet + calendar + comms + build +
 *  distribution + weather + energy; coverage grows by adding probes. */
export const FORECAST_PROBES: ForecastProbe[] = [
  fleetProbe, calendarProbe, commsProbe, buildProbe,
  distributionProbe, weatherProbe, energyProbe,
];

// ── Runner ─────────────────────────────────────────────────────────

export interface ForecastRunResult {
  at: number;
  signalsFound: number;
  routed: RoutedForecast[];
  droppedNoEvidence: number;
  spokenUsed: number;
  spokenRemaining: number;
  probeErrors: { probe: string; error: string }[];
  proposalsFiled: number;
}

/**
 * Run all probes → route → dispatch. Dispatch side-effects:
 *  - every routed signal appended to the forecast ledger
 *  - Tier-2 signals submitted to the initiative engine (caller-injected)
 *  - Tier-3 spoken budget consumed in persisted router state
 * Returns the full run report for the task result + ledger.
 */
export async function runForecastCycle(
  deps: ProbeDeps,
  opts: {
    submitProposal?: (signal: RoutedForecast) => unknown;
    state?: RouterState;
  } = {},
): Promise<ForecastRunResult> {
  const state = opts.state ?? loadRouterState();
  const signals: ForecastSignal[] = [];
  const probeErrors: { probe: string; error: string }[] = [];

  for (const probe of FORECAST_PROBES) {
    try {
      signals.push(...(await probe.run(deps)));
    } catch (e: any) {
      probeErrors.push({ probe: probe.id, error: String(e?.message || e).slice(0, 140) });
    }
  }

  const { routed, dropped, spokenRemaining } = routeSignals(signals, state, deps.now);

  // Persist spoken consumption: count Tier-3 signals that survived routing.
  const spokenNow = routed.filter((r) => r.tier === 3).length;
  const day = new Date(deps.now).toISOString().slice(0, 10);
  const usedToday = (state.spokenDay === day ? state.spokenToday : 0) + spokenNow;
  saveRouterState({ spokenToday: usedToday, spokenDay: day });

  let proposalsFiled = 0;
  for (const r of routed) {
    appendForecastLedger({
      id: r.id, domain: r.domain, claim: r.claim, tier: r.tier,
      confidence: r.confidence, routeScore: r.routeScore,
      demoted: r.demoted === true, evidence: r.evidence,
    });
    if (r.tier === 2 && opts.submitProposal) {
      try {
        const admitted = opts.submitProposal(r);
        if (admitted) proposalsFiled++;
      } catch {}
    }
  }

  return {
    at: deps.now,
    signalsFound: signals.length,
    routed,
    droppedNoEvidence: dropped,
    spokenUsed: usedToday,
    spokenRemaining,
    probeErrors,
    proposalsFiled,
  };
}
