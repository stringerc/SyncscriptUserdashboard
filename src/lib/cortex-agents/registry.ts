/**
 * Cortex Model Matrix — health-aware tier routing.
 *
 * Three lanes (fast / reason / deep) hold ordered provider+model candidates.
 * The Model Sentinel feeds health into this registry; pickModel() filters
 * dead/cooled-down candidates and prefers healthy, low-latency models.
 * Per-agent pins can force a tier or exclude providers entirely.
 *
 * Pure module — no I/O, fully unit-testable. The runtime owns the singleton.
 */

import type { ModelHealth, RouteTier } from './types';

export interface ModelCandidate {
  provider: string;
  model: string;
  /** Capability prior (higher = stronger model). Deep lane sorts by this
   *  before latency — the lane exists for quality, not speed. */
  weight?: number;
}

export interface AgentPin {
  tier: RouteTier;
  /** Exact model override (provider:model). Wins over lane ordering. */
  model?: string;
  excludeProviders?: string[];
}

/** Seed matrix — ordered by preference within each lane. */
export const SEED_MATRIX: Record<RouteTier, ModelCandidate[]> = {
  fast: [
    { provider: 'magpie', model: 'group/cortex-fast' },
    { provider: 'groq-fast', model: 'openai/gpt-oss-20b' },
    { provider: 'groq-oss', model: 'openai/gpt-oss-120b' },
    { provider: 'nvidia-nim', model: 'nvidia/nemotron-3.5-lightning-30b-a3b' },
    { provider: 'nvidia-nim', model: 'nvidia/nemotron-3.5-bolt-e4b' },
    // Billing-dead candidates removed (Nov 26): openrouter llama-3.3-70b
    // (402 — account overdrawn, no top-up planned), deepseek-chat (402),
    // gpt-4o-mini (OPENAI_DIRECT_API_KEY unset). Re-add only with funding.
  ],
  reason: [
    { provider: 'magpie', model: 'group/cortex-reason' },
    { provider: 'nvidia-nim-550b', model: 'nvidia/nemotron-3-ultra-550b-a55b' },
    { provider: 'nvidia-nim', model: 'nvidia/nemotron-3.5-super-vl-120b-a12b' },
    { provider: 'nvidia-nim', model: 'stepfun-ai/step-5-preview' },
  ],
  deep: [
    { provider: 'magpie', model: 'group/cortex-deep', weight: 5 },
    { provider: 'nvidia-nim-550b', model: 'nvidia/nemotron-3-ultra-550b-a55b', weight: 6 },
    { provider: 'nvidia-nim', model: 'mistralai/mistral-large-4-1t-a52b', weight: 6 },
    // deepseek-chat (402 billing-dead) and deepseek-v4.1-flash (410 EOL
    // upstream) removed — both permanently dead, stopped pinging.
    // Redundancy: same working NVIDIA provider, different model family —
    // the lane previously had only ~3 live candidates and a single
    // provider cooldown could zero it out (heal_anomaly storm, Oct 2025).
    { provider: 'nvidia-nim', model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', weight: 2 },
  ],
};

/** Capability prior inferred from the model id — used for catalog-
 *  promoted candidates that carry no explicit weight. Size markers
 *  dominate; 'reasoning' is a small bonus (thinking models punch above
 *  their parameter count on analysis tasks). */
export function inferWeight(modelId: string): number {
  const m = modelId.toLowerCase();
  if (NON_CHAT_RE.test(m)) return 0;
  if (/ultra|1t\b|405b|253b|480b|235b/.test(m)) return 6;
  if (/large|120b|110b|104b|72b|70b|671b/.test(m)) return 4;
  if (/32b|30b|reasoning|think|qwq|r1\b/.test(m)) return 3;
  if (/20b|14b|8b|7b|4b|nano|mini|lite|flash|small|bolt|edge|tiny/.test(m)) return 1;
  return 3; // unknown mid-size default
}

const key = (c: ModelCandidate) => `${c.provider}:${c.model}`;

/** Models that answer HTTP 200 but cannot do chat completion — safety
 *  guards, translation/rerank/embedding utilities, media models. Catalog
 *  discovery promotes anything that answers a probe, so these leak into
 *  lanes and then serve garbage (a translate model once "answered" a
 *  synthesis call by echoing the prompt). Filtered at ordered(), the
 *  single routing chokepoint — pins cannot override this either. */
const NON_CHAT_RE = /guard|safety|reward|translate|rerank|embed|moderation|whisper|tts|speech|image|video|ocr|caption|detect|segment|sentiment|classifier|nsfw|content.?filter/i;
export function isChatModel(modelId: string): boolean {
  return !NON_CHAT_RE.test(modelId);
}

/** Heuristic tier fit for catalog-discovered models. */
export function inferTierFit(modelId: string): RouteTier[] {
  const m = modelId.toLowerCase();
  if (NON_CHAT_RE.test(m)) return [];
  const fast = /flash|lite|mini|nano|bolt|20b|30b|7b|8b|small/.test(m);
  const deep = /ultra|253b|1t|deepseek-v4(?!\.1-flash)|reasoning|think/.test(m) && !/embed|guard|safety|reward/.test(m);
  if (deep) return ['reason', 'deep'];
  if (fast) return ['fast'];
  return ['reason'];
}

export class ModelMatrix {
  private lanes: Record<RouteTier, ModelCandidate[]>;
  private health = new Map<string, ModelHealth>();

  constructor(seed: Record<RouteTier, ModelCandidate[]> = SEED_MATRIX) {
    this.lanes = {
      fast: [...seed.fast],
      reason: [...seed.reason],
      deep: [...seed.deep],
    };
    for (const tier of ['fast', 'reason', 'deep'] as RouteTier[]) {
      for (const c of this.lanes[tier]) this.ensureHealth(c, 'matrix');
    }
  }

  private ensureHealth(c: ModelCandidate, source: ModelHealth['source']): ModelHealth {
    const k = key(c);
    let h = this.health.get(k);
    if (!h) {
      h = {
        id: c.model,
        provider: c.provider,
        tierFit: this.laneFitFor(c),
        status: 'unknown',
        latencyMsP50: null,
        lastCheckAt: null,
        consecutiveFailures: 0,
        cooldownUntil: null,
        source,
      };
      this.health.set(k, h);
    }
    return h;
  }

  private laneFitFor(c: ModelCandidate): RouteTier[] {
    for (const tier of ['fast', 'reason', 'deep'] as RouteTier[]) {
      if (this.lanes[tier].some((x) => key(x) === key(c))) return [tier];
    }
    return inferTierFit(c.model);
  }

  /** Register a catalog-discovered model; returns true if it was new.
   *  Discovered models enter PROBATION — tracked in health, visible to the
   *  sentinel's probe rotation, but NOT routable. Promotion into a lane
   *  happens only after a successful probe (see recordProbe). This is the
   *  gate that keeps failover from ever wandering into unvetted models. */
  discover(provider: string, modelId: string): boolean {
    const c = { provider, model: modelId };
    if (this.health.has(key(c))) return false;
    this.ensureHealth(c, 'catalog');
    return true;
  }

  private inLane(c: ModelCandidate): boolean {
    const k = key(c);
    return (['fast', 'reason', 'deep'] as RouteTier[]).some((t) => this.lanes[t].some((x) => key(x) === k));
  }

  /** Best-fit lane for a candidate, mirroring discover()'s old placement. */
  private laneFor(c: ModelCandidate): RouteTier {
    const fit = this.health.get(key(c))?.tierFit ?? inferTierFit(c.model);
    return fit.includes('deep') ? 'deep' : fit.includes('reason') ? 'reason' : 'fast';
  }

  healthOf(provider: string, model: string): ModelHealth | undefined {
    return this.health.get(`${provider}:${model}`);
  }

  allHealth(): ModelHealth[] {
    return [...this.health.values()];
  }

  isUsable(h: ModelHealth | undefined, now = Date.now()): boolean {
    if (!h) return true; // unprobed config candidates are allowed once
    if (h.status === 'down') return false;
    if (h.cooldownUntil && h.cooldownUntil > now) return false;
    return true;
  }

  recordProbe(provider: string, model: string, ok: boolean, latencyMs?: number, permanent = false): ModelHealth {
    const h = this.ensureHealth({ provider, model }, 'probe');
    h.lastCheckAt = Date.now();
    if (ok) {
      h.consecutiveFailures = 0;
      h.cooldownUntil = null;
      h.status = 'healthy';
      if (typeof latencyMs === 'number' && latencyMs >= 0) {
        h.latencyMsP50 = h.latencyMsP50 == null
          ? latencyMs
          : Math.round(h.latencyMsP50 * 0.7 + latencyMs * 0.3);
      }
      // Promotion: a catalog model that just answered a real probe earns a
      // lane seat. Until then it was probation-only and could not route.
      const c = { provider, model };
      if (h.source === 'catalog' && isChatModel(model) && !this.inLane(c)) {
        this.lanes[this.laneFor(c)].push(c);
      }
    } else {
      h.consecutiveFailures += 1;
      h.status = h.consecutiveFailures >= 3 ? 'down' : 'degraded';
      // Permanent failures (auth/billing: 401/402/403) can't self-heal in
      // seconds — cool down hard so the lane stops hammering a dead key.
      // Transient failures (429/5xx/timeouts) keep the short backoff.
      const backoff = permanent
        ? Math.min(60 * 60_000, 15 * 60_000)
        : Math.min(10 * 60_000, 30_000 * 2 ** Math.min(h.consecutiveFailures - 1, 4));
      h.cooldownUntil = Date.now() + backoff;
    }
    return h;
  }

  /**
   * Pick a model for a tier. Pin.model wins outright (still health-checked).
   * Otherwise lane order is preserved but unhealthy candidates are skipped,
   * and among usable candidates healthy+low-latency wins over raw order —
   * a fast healthy model beats a slow healthy one regardless of seed rank.
   */
  /** All usable lane candidates, best first (healthy+fast beats raw order). */
  ordered(tier: RouteTier, pin?: AgentPin | null, now = Date.now()): ModelCandidate[] {
    const excluded = new Set(pin?.excludeProviders ?? []);
    if (pin?.model) {
      const [provider, ...rest] = pin.model.split(':');
      const model = rest.join(':') || pin.model;
      const c = { provider, model };
      const h = this.healthOf(provider, model);
      // Pins are an operator override but still obey the honesty gate: the
      // model must be lane-seated (seed/promoted) or probe-verified healthy.
      const proven = this.inLane(c) || h?.status === 'healthy';
      return !excluded.has(provider) && isChatModel(model) && proven && this.isUsable(h, now) ? [c] : [];
    }
    const usable = this.lanes[tier].filter((c) => {
      if (excluded.has(c.provider)) return false;
      if (!isChatModel(c.model)) return false;
      return this.isUsable(this.healthOf(c.provider, c.model), now);
    });
    const statusPenalty = (c: ModelCandidate) => {
      const s = this.healthOf(c.provider, c.model)?.status;
      return s === 'healthy' ? 0 : s === 'unknown' ? 1 : 2;
    };
    const latency = (c: ModelCandidate) => this.healthOf(c.provider, c.model)?.latencyMsP50 ?? 60_000;
    const weight = (c: ModelCandidate) => c.weight ?? inferWeight(c.model);
    if (tier === 'deep') {
      // Deep lane = quality lane: healthy beats degraded, then strongest
      // model wins, latency only breaks ties. A fast 30B reasoner must
      // never outrank a healthy 500B+ on analysis work — that was the
      // consult-truncation bug (nano-omni serving deep-tier replies).
      return usable.sort((a, b) =>
        statusPenalty(a) - statusPenalty(b) ||
        weight(b) - weight(a) ||
        latency(a) - latency(b),
      );
    }
    const score = (c: ModelCandidate) => statusPenalty(c) * 1_000_000 + latency(c);
    return usable.sort((a, b) => score(a) - score(b));
  }

  pick(tier: RouteTier, pin?: AgentPin | null, now = Date.now()): ModelCandidate | null {
    return this.ordered(tier, pin, now)[0] ?? null;
  }

  /** Seed + promoted lane members only — the routable set. */
  laneMembers(tier: RouteTier): ModelCandidate[] {
    return [...this.lanes[tier]];
  }

  /** Probation candidates: discovered, tier-matched, never yet probe-verified. */
  probationCandidates(tier: RouteTier): ModelCandidate[] {
    const out: ModelCandidate[] = [];
    const seen = new Set(this.lanes[tier].map(key));
    for (const h of this.health.values()) {
      if (h.source === 'catalog' && h.tierFit.includes(tier) && !seen.has(`${h.provider}:${h.id}`)) {
        out.push({ provider: h.provider, model: h.id });
        seen.add(`${h.provider}:${h.id}`);
      }
    }
    return out;
  }

  /** Lane members PLUS probation candidates — what the sentinel should probe. */
  laneCandidates(tier: RouteTier): ModelCandidate[] {
    return [...this.laneMembers(tier), ...this.probationCandidates(tier)];
  }

  snapshot(): Record<RouteTier, string[]> {
    return {
      fast: this.lanes.fast.map(key),
      reason: this.lanes.reason.map(key),
      deep: this.lanes.deep.map(key),
    };
  }
}
