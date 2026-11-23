/**
 * tenants.ts — customer-facing dispatch API with a contract the system
 * can actually honor.
 *
 * A paying tenant gets an API key, a daily dispatch quota, and the same
 * Libet cockpit the operator uses: every dispatch returns its evidence
 * packet (free energy, saturation, aesthetic, constitutional weight)
 * BEFORE it fires, and the tenant can veto/amend/hold/release their own
 * intents — participation, not blind trust.
 *
 * The contract, enforced in code:
 *   - quota: max dispatches per rolling 24h per tenant
 *   - kinds: whitelist of dispatch kinds a plan may use
 *   - inspection: every accepted dispatch carries the cockpit card
 *   - control: tenants govern only their own intents (tenantId stamped)
 *   - honesty: fired intents report real agentRuntime task ids; a
 *     dispatch that fails to arm is an error, never a silent success
 *
 * Storage: .cortex-runtime/tenants.json — keys stored as SHA-256, the
 * plaintext key is returned exactly once at creation.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME, 'tenants.json');
const DISPATCH_LOG = path.join(RUNTIME, 'tenant-dispatches.jsonl');

export interface Tenant {
  id: string;
  name: string;
  /** SHA-256 of the API key — plaintext never stored. */
  keyHash: string;
  keyPrefix: string;
  plan: 'launch' | 'growth';
  /** Dispatches allowed per rolling 24h. */
  dailyQuota: number;
  /** Allowed dispatch kinds (empty = all). */
  allowedKinds: string[];
  status: 'active' | 'suspended';
  createdAt: number;
}

interface TenantState { tenants: Tenant[] }

const PLANS: Record<Tenant['plan'], { dailyQuota: number; priceNote: string }> = {
  launch: { dailyQuota: 50, priceNote: 'Launch tier — 50 dispatches/day' },
  growth: { dailyQuota: 500, priceNote: 'Growth tier — 500 dispatches/day' },
};

function load(): TenantState {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { tenants: [] }; }
}
function save(s: TenantState) {
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s, null, 1)); } catch {}
}
const hashKey = (k: string) => crypto.createHash('sha256').update(k).digest('hex');

/** Authenticate a request: `Authorization: Bearer <key>` or `x-cortex-key`. */
export function authenticateTenant(req: { headers?: Record<string, any> }): Tenant | null {
  const h = req.headers || {};
  const raw = String(h['x-cortex-key'] || h['authorization'] || '');
  const key = raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : raw.trim();
  if (!key || !key.startsWith('cxk_')) return null;
  const hash = hashKey(key);
  return load().tenants.find((t) => t.keyHash === hash && t.status === 'active') || null;
}

/** Admin surface: create a tenant. Returns the plaintext key ONCE. */
export function createTenant(opts: { name: string; plan?: Tenant['plan']; allowedKinds?: string[]; dailyQuota?: number }): { tenant: Tenant; apiKey: string } {
  const apiKey = `cxk_${crypto.randomBytes(24).toString('hex')}`;
  const tenant: Tenant = {
    id: `tenant-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    name: String(opts.name || 'unnamed').slice(0, 80),
    keyHash: hashKey(apiKey),
    keyPrefix: apiKey.slice(0, 12),
    plan: opts.plan === 'growth' ? 'growth' : 'launch',
    dailyQuota: Math.max(1, Math.min(10_000, opts.dailyQuota ?? PLANS[opts.plan === 'growth' ? 'growth' : 'launch'].dailyQuota)),
    allowedKinds: Array.isArray(opts.allowedKinds) ? opts.allowedKinds.map(String).slice(0, 20) : [],
    status: 'active',
    createdAt: Date.now(),
  };
  const s = load();
  s.tenants.push(tenant);
  save(s);
  return { tenant, apiKey };
}

export function listTenants(): Array<Omit<Tenant, 'keyHash'>> {
  return load().tenants.map(({ keyHash, ...t }) => t);
}

/** Admin plan management — upgrade/suspend without touching keys. */
export function updateTenant(id: string, patch: { plan?: Tenant['plan']; status?: Tenant['status']; dailyQuota?: number }): Tenant | null {
  const s = load();
  const t = s.tenants.find((x) => x.id === id);
  if (!t) return null;
  if (patch.plan === 'launch' || patch.plan === 'growth') t.plan = patch.plan;
  if (patch.status === 'active' || patch.status === 'suspended') t.status = patch.status;
  if (patch.dailyQuota) t.dailyQuota = Math.max(1, Math.min(10_000, Number(patch.dailyQuota)));
  save(s);
  return t;
}

function logDispatch(entry: Record<string, unknown>) {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(DISPATCH_LOG, JSON.stringify({ ts: Date.now(), ...entry }) + '\n');
  } catch {}
}

function dispatchesInWindow(tenantId: string, windowMs: number): number {
  try {
    const cutoff = Date.now() - windowMs;
    return fs.readFileSync(DISPATCH_LOG, 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((e) => e && e.tenantId === tenantId && e.event === 'accepted' && Number(e.ts) >= cutoff)
      .length;
  } catch { return 0; }
}

/** Contract check before arming: quota + kind whitelist. Returns the
 *  rejection reason or null when the dispatch is inside the contract. */
export function contractCheck(tenant: Tenant, kind: string): { ok: boolean; reason?: string; quotaUsed: number; quotaLimit: number } {
  const used = dispatchesInWindow(tenant.id, 24 * 3600_000);
  if (used >= tenant.dailyQuota) {
    return { ok: false, reason: `daily quota exhausted (${used}/${tenant.dailyQuota}) — contract limit, resets on rolling 24h window`, quotaUsed: used, quotaLimit: tenant.dailyQuota };
  }
  if (tenant.allowedKinds.length && !tenant.allowedKinds.includes(kind)) {
    return { ok: false, reason: `kind '${kind}' not in plan whitelist [${tenant.allowedKinds.join(', ')}]`, quotaUsed: used, quotaLimit: tenant.dailyQuota };
  }
  return { ok: true, quotaUsed: used, quotaLimit: tenant.dailyQuota };
}

export function recordDispatch(tenantId: string, entry: Record<string, unknown>) {
  logDispatch({ tenantId, ...entry });
}

/** Tenant-scoped control: only intents this tenant armed. */
export function tenantIntentLookup(tenantId: string, vetoId: string) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(RUNTIME, 'libet-veto.json'), 'utf8'));
    const all = [...(s.pending || []), ...(s.fired || [])];
    const intent = all.find((i: any) => i.id === vetoId && i.tenantId === tenantId);
    return intent || null;
  } catch { return null; }
}

export function contractSummary(tenant: Tenant) {
  const used = dispatchesInWindow(tenant.id, 24 * 3600_000);
  return {
    tenant: { id: tenant.id, name: tenant.name, plan: tenant.plan, status: tenant.status },
    quota: { used, limit: tenant.dailyQuota, planNote: PLANS[tenant.plan].priceNote, resetsIn: 'rolling 24h' },
    allowedKinds: tenant.allowedKinds.length ? tenant.allowedKinds : 'all',
    dispatchesToday: used,
    // Honest billing: launch customers are invoiced manually — no payment
    // rail is wired, so the contract reports billing as manual rather
    // than pretending a subscription exists.
    billing: { rail: 'manual-invoice', status: 'current', note: 'Launch tier billed monthly by invoice; payment does not gate API access until a rail is configured' },
  };
}
