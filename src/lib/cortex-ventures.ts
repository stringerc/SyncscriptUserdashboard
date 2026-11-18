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

/** Derive venture from a distribution-queue item type prefix. */
export function ventureFromQueueType(type: string | undefined | null): string {
  const t = String(type || '');
  if (t.startsWith('omni')) return 'omni';
  if (t.startsWith('govtech') || t.startsWith('sam_gov')) return 'govtech';
  return 'cortex';
}
