/**
 * Model Sentinel — autonomous model availability watchdog.
 *
 * Two duties:
 *  1. Catalog watch: poll provider model listings (NIM /v1/models today),
 *     diff against known models, emit model.discovered for newcomers.
 *  2. Health probes: minimal chat-completion probes against every model the
 *     matrix actually routes to, plus spot checks on catalog entries.
 *
 * Critical-path honesty: catalog fetches and probes are raw HTTPS calls.
 * The Sentinel's own optional analysis NEVER depends on the models it
 * monitors — it keeps reporting even in a total provider outage.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ModelMatrix } from './registry';
import type { AgentEvent, ModelHealth } from './types';

export interface CatalogSource {
  provider: string;
  /** Returns raw model id list, or throws. */
  fetchIds(): Promise<string[]>;
}

export interface ProbeResult {
  latencyMs: number;
  /** Index into the provider's key pool that served the probe, when known. */
  keyIndex?: number;
}

export interface ProbeTarget {
  provider: string;
  model: string;
  /** Sends a minimal completion; resolves latency/keyIndex or throws. */
  probe(): Promise<ProbeResult>;
}

const HEALTH_HISTORY_FILE = path.join(
  process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime'),
  'model-health-history.jsonl',
);
const HEALTH_HISTORY_MAX_BYTES = 2_000_000;

function healthHistoryPath(): string {
  return HEALTH_HISTORY_FILE;
}

/** Append one probe outcome. Failures and status transitions always land;
 *  callers decide what to log so healthy probes stay silent. */
function appendHealthHistory(rec: Record<string, unknown>): void {
  try {
    try {
      const st = fs.statSync(HEALTH_HISTORY_FILE);
      if (st.size > HEALTH_HISTORY_MAX_BYTES) {
        const tail = fs.readFileSync(HEALTH_HISTORY_FILE, 'utf8').split('\n').slice(-4000).join('\n');
        fs.writeFileSync(HEALTH_HISTORY_FILE, tail, 'utf8');
      }
    } catch { /* first write */ }
    fs.appendFileSync(HEALTH_HISTORY_FILE, JSON.stringify({ ts: Date.now(), ...rec }) + '\n', 'utf8');
  } catch { /* telemetry must never break probing */ }
}

/** Tail the durable health history — newest last. Used by status surfaces. */
export function tailModelHealthHistory(limit = 100): Record<string, unknown>[] {
  try {
    const lines = fs.readFileSync(HEALTH_HISTORY_FILE, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((x): x is Record<string, unknown> => !!x);
  } catch { return []; }
}

const CATALOG_INTERVAL_MS = 5 * 60_000;
const PROBE_INTERVAL_MS = 60_000;
const PROBE_TIMEOUT_MS = 8_000;
const MAX_PROBE_MODELS = 24; // bound spend: only matrix-relevant + sample

export class ModelSentinel {
  private timerCatalog: ReturnType<typeof setInterval> | null = null;
  private timerProbe: ReturnType<typeof setInterval> | null = null;
  private probing = false;
  private knownCatalogIds = new Set<string>();
  private lastLoggedStatus = new Map<string, string>();

  constructor(
    private matrix: ModelMatrix,
    private emit: (e: AgentEvent) => void,
    private catalogSources: CatalogSource[] = [],
    private probeFactory?: (provider: string, model: string) => ProbeTarget['probe'],
  ) {}

  start() {
    if (this.timerCatalog || this.timerProbe) return;
    void this.catalogScan();
    void this.probeCycle();
    this.timerCatalog = setInterval(() => void this.catalogScan(), CATALOG_INTERVAL_MS);
    this.timerProbe = setInterval(() => void this.probeCycle(), PROBE_INTERVAL_MS);
    this.timerCatalog.unref?.();
    this.timerProbe.unref?.();
  }

  stop() {
    if (this.timerCatalog) clearInterval(this.timerCatalog);
    if (this.timerProbe) clearInterval(this.timerProbe);
    this.timerCatalog = this.timerProbe = null;
  }

  /** One catalog poll — exported for tests and manual scans. */
  async catalogScan(): Promise<number> {
    let discovered = 0;
    for (const src of this.catalogSources) {
      try {
        const ids = await src.fetchIds();
        for (const id of ids) {
          const isNew = !this.knownCatalogIds.has(`${src.provider}:${id}`);
          this.knownCatalogIds.add(`${src.provider}:${id}`);
          if (isNew && this.matrix.discover(src.provider, id)) {
            const h = this.matrix.healthOf(src.provider, id);
            if (h) {
              this.emit({ type: 'model.discovered', model: h, at: Date.now() });
              discovered++;
            }
          }
        }
      } catch {
        // Catalog source down — recorded nowhere fatal; health probes carry
        // the actual routing signal. Sentinel must not die with its sources.
      }
    }
    return discovered;
  }

  /** One health-probe cycle over matrix-relevant models. */
  async probeCycle(): Promise<void> {
    if (this.probing || !this.probeFactory) return;
    this.probing = true;
    try {
      // Probe every candidate the matrix could route to, capped for spend.
      const targets: { provider: string; model: string }[] = [];
      const seen = new Set<string>();
      for (const tier of ['fast', 'reason', 'deep'] as const) {
        for (const c of this.matrix.laneMembers(tier)) {
          const k = `${c.provider}:${c.model}`;
          if (!seen.has(k)) { seen.add(k); targets.push(c); }
        }
      }
      // Probation: catalog-discovered models get a rotating random sample
      // each cycle so the whole catalog is eventually vetted without ever
      // letting an unprobed model route.
      const probation = (['fast', 'reason', 'deep'] as const)
        .flatMap((t) => this.matrix.probationCandidates(t));
      for (let i = probation.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [probation[i], probation[j]] = [probation[j], probation[i]];
      }
      for (const c of probation.slice(0, 8)) {
        const k = `${c.provider}:${c.model}`;
        if (!seen.has(k)) { seen.add(k); targets.push(c); }
      }
      const batch = targets.slice(0, MAX_PROBE_MODELS);
      // Serial probes: gentle on rate limits, and each result lands fast.
      for (const t of batch) {
        const probe = this.probeFactory(t.provider, t.model);
        const started = Date.now();
        const key = `${t.provider}:${t.model}`;
        try {
          const res = await Promise.race([
            probe(),
            new Promise<never>((_, rej) =>
              setTimeout(() => rej(new Error('probe timeout')), PROBE_TIMEOUT_MS)),
          ]);
          const latencyMs = res?.latencyMs ?? Date.now() - started;
          const h = this.matrix.recordProbe(t.provider, t.model, true, latencyMs);
          this.emit({ type: 'model.health', model: h, at: Date.now() });
          const prev = this.lastLoggedStatus.get(key);
          if (prev !== h.status) {
            this.lastLoggedStatus.set(key, h.status);
            appendHealthHistory({
              provider: t.provider, model: t.model, ok: true, latencyMs,
              keyIndex: res?.keyIndex, health: h.status,
              consecutiveFailures: h.consecutiveFailures, cooldownUntil: h.cooldownUntil,
            });
          }
        } catch (e: any) {
          // Auth/billing failures (401/402/403) can't self-heal in seconds —
          // mark permanent so the matrix cools the model down hard instead
          // of retrying every minute against a dead key tier.
          const httpStatus = typeof e?.status === 'number' ? e.status : undefined;
          const permanent = httpStatus != null && [401, 402, 403].includes(httpStatus);
          const h = this.matrix.recordProbe(t.provider, t.model, false, undefined, permanent);
          this.emit({ type: 'model.health', model: h, at: Date.now() });
          this.lastLoggedStatus.set(key, h.status);
          appendHealthHistory({
            provider: t.provider, model: t.model, ok: false,
            httpStatus, permanent, error: String(e?.message || e).slice(0, 160),
            health: h.status, consecutiveFailures: h.consecutiveFailures,
            cooldownUntil: h.cooldownUntil,
          });
        }
      }
    } finally {
      this.probing = false;
    }
  }
}
