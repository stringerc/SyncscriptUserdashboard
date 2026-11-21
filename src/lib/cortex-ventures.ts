/**
 * Venture registry — the enterprise scope dimension (CORTEX_ENTERPRISE_CONSOLE_SPEC).
 *
 * Ventures are first-class scopes (omni / govtech / cortex-internal) that
 * tasks, goals, blocks, directives, and messages can carry via `ventureId`.
 * Absent ventureId = unscoped → lands in the CORTEX bucket (honest-empty:
 * nothing silently dropped, nothing invented).
 *
 * Derivation beats migration: distribution-queue item types self-tag
 * (`omni_publish-*`, `govtech-*`/`sam_gov_*`), so queue venture is derived
 * from the type prefix until items carry explicit ventureId.
 *
 * Persistence: .cortex-runtime/ventures.json — seeded on first read,
 * Crew-editable, evidencePaths must point at real paths.
 */

import fs from 'node:fs';
import path from 'node:path';

const STATE_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const VENTURES_PATH = path.join(STATE_DIR, 'ventures.json');

export interface Venture {
  id: string;
  name: string;
  callSign: string;
  status: 'active' | 'dormant' | 'archived';
  /** Real paths proving the venture exists — never invented. */
  evidencePaths: string[];
  /** Kill switch — paused ventures get no scheduled cycles and their
   *  proposals are suppressed at the scheduler boundary. */
  paused?: boolean;
  /** Autonomous cadence: fire a governed proposal every N minutes.
   *  Min 60. Absent = manual/event-driven only. */
  scheduleMinutes?: number;
  /** Epoch ms of next scheduled cycle — managed by the scheduler. */
  nextRunAt?: number;
  /** Max governed proposals admitted per venture per 24h. Absent = global cap only. */
  budgetPerDay?: number;
  /** Scheduler bookkeeping — admitted cycle count for the current UTC day. */
  cyclesToday?: number;
  cycleDay?: string;
}

const SEED: Venture[] = [
  {
    id: 'omni', name: 'OMNI', callSign: 'OMNI', status: 'active',
    evidencePaths: ['storefront/', 'storefront/distribution-queue.json', 'storefront/GUMROAD_LAUNCH_LOG.md'],
  },
  {
    id: 'govtech', name: 'GOVTECH', callSign: 'GOVTECH', status: 'active',
    evidencePaths: ['src/lib/govtech/', '.cortex/reports/govtech/'],
  },
  {
    id: 'cortex', name: 'CORTEX INTERNAL', callSign: 'CORTEX', status: 'active',
    evidencePaths: ['src/lib/cortex-agents/', '.cortex-runtime/'],
  },
];

export function listVentures(): Venture[] {
  try {
    if (!fs.existsSync(VENTURES_PATH)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
      fs.writeFileSync(VENTURES_PATH, JSON.stringify(SEED, null, 2));
      return SEED;
    }
    const data = JSON.parse(fs.readFileSync(VENTURES_PATH, 'utf-8'));
    const list = Array.isArray(data?.ventures) ? data.ventures : Array.isArray(data) ? data : [];
    return list.filter((v: any) => v && typeof v.id === 'string');
  } catch {
    return SEED;
  }
}

export function getVenture(id: string): Venture | null {
  return listVentures().find((v) => v.id === id) || null;
}

/** Strict validation — same style as messages.ts unknown-recipient. */
export function isValidVenture(id: unknown): id is string {
  return typeof id === 'string' && listVentures().some((v) => v.id === id);
}

function writeVentures(list: Venture[]): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(VENTURES_PATH, JSON.stringify(list, null, 2));
}

/** Patch a venture's governance fields. Returns the updated venture or null. */
export function updateVenture(id: string, patch: Partial<Pick<Venture, 'paused' | 'scheduleMinutes' | 'budgetPerDay' | 'status'>>): Venture | null {
  const list = listVentures();
  const v = list.find((x) => x.id === id);
  if (!v) return null;
  if (patch.paused !== undefined) v.paused = !!patch.paused;
  if (patch.status !== undefined && ['active', 'dormant', 'archived'].includes(patch.status)) v.status = patch.status;
  if (patch.scheduleMinutes !== undefined) {
    const m = Math.floor(Number(patch.scheduleMinutes));
    if (!Number.isFinite(m) || m < 0) return null;
    v.scheduleMinutes = m === 0 ? undefined : Math.max(60, m);
    // (Re)schedule from now when a cadence is set; clearing leaves nextRunAt stale-but-unused.
    v.nextRunAt = v.scheduleMinutes ? Date.now() + v.scheduleMinutes * 60_000 : undefined;
  }
  if (patch.budgetPerDay !== undefined) {
    const b = Math.floor(Number(patch.budgetPerDay));
    v.budgetPerDay = Number.isFinite(b) && b > 0 ? b : undefined;
  }
  writeVentures(list);
  return v;
}

/** Ventures whose autonomous cycle is due right now. */
export function dueVentures(now: number = Date.now()): Venture[] {
  return listVentures().filter((v) =>
    v.status === 'active' && !v.paused &&
    typeof v.scheduleMinutes === 'number' && v.scheduleMinutes >= 60 &&
    typeof v.nextRunAt === 'number' && v.nextRunAt <= now
  );
}

/** Advance a venture's nextRunAt after a cycle fires. */
export function markVentureRan(id: string, ranAt: number = Date.now()): void {
  const list = listVentures();
  const v = list.find((x) => x.id === id);
  if (v?.scheduleMinutes) {
    v.nextRunAt = ranAt + v.scheduleMinutes * 60_000;
    writeVentures(list);
  }
}

/** Count + record an admitted autonomous cycle against the venture's daily budget. */
export function recordVentureCycle(id: string, at: number = Date.now()): number {
  const list = listVentures();
  const v = list.find((x) => x.id === id);
  if (!v) return 0;
  const day = new Date(at).toISOString().slice(0, 10);
  v.cyclesToday = v.cycleDay === day ? (v.cyclesToday || 0) + 1 : 1;
  v.cycleDay = day;
  writeVentures(list);
  return v.cyclesToday;
}

/** Cycles already admitted today (before recording a new one). */
export function ventureCyclesToday(id: string, at: number = Date.now()): number {
  const v = listVentures().find((x) => x.id === id);
  const day = new Date(at).toISOString().slice(0, 10);
  return v?.cycleDay === day ? (v.cyclesToday || 0) : 0;
}

/** Derive venture from a distribution-queue item type prefix. */
export function ventureFromQueueType(type: string | undefined | null): string {
  const t = String(type || '');
  if (t.startsWith('omni')) return 'omni';
  if (t.startsWith('govtech') || t.startsWith('sam_gov')) return 'govtech';
  return 'cortex';
}
