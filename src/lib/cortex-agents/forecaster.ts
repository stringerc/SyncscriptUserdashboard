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
  base: string;
}

export interface ForecastCalendarEvent {
  id: string;
  title: string;
  start: number; // epoch ms
  end?: number;
  attendees?: number;
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

/** Probe registry — v1 ships fleet + calendar; remaining domains register
 *  as their sensors come online (spec §Probe registry). */
export const FORECAST_PROBES: ForecastProbe[] = [fleetProbe, calendarProbe];

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
