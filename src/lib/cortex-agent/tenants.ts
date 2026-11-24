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

/** Rotate a tenant's API key — old key dies immediately, new plaintext
 *  returned ONCE (only its hash persists). Use on suspected exposure. */
export function rotateTenantKey(id: string): { tenant: Tenant; apiKey: string } | null {
  const s = load();
  const t = s.tenants.find((x) => x.id === id);
  if (!t) return null;
  const apiKey = `cxk_${crypto.randomBytes(24).toString('hex')}`;
  t.keyHash = hashKey(apiKey);
  t.keyPrefix = apiKey.slice(0, 12);
  save(s);
  return { tenant: t, apiKey };
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

/** Registered worker ids — mirrors registerWorker calls in
 *  cortex-agents. Agents absent from AGENT_KINDS accept dynamic kinds. */
export const KNOWN_AGENTS = new Set([
  'antigravity', 'sentinel', 'scout', 'librarian', 'builder', 'devin',
  'claudecode', 'openclaw', 'hermes', 'curator', 'reviewer', 'runner',
  'forecaster', 'prep', 'strategist', 'brief', 'debrief', 'trainer',
  'warden', 'distributor', 'radar',
]);

/** Verified kind whitelists per agent, extracted from each worker's
 *  kind dispatch. Agents not listed handle kinds dynamically — the
 *  runtime remains the final arbiter for those. */
export const AGENT_KINDS: Record<string, string[]> = {
  warden: ['patrol', 'counsel_position', 'file_integrity', 'heal_anomaly', 'repo_hygiene'],
  sentinel: ['catalog_scan', 'counsel_position', 'probe_model'],
  scout: ['agent_ideas', 'counsel_persona_position', 'github_trend_scan', 'radar_sweep', 'repo_scan', 'social_scan'],
  librarian: ['distill', 'graph_query', 'instinct_cycle', 'recall', 'skill_audit', 'vault_sync'],
  builder: ['verify_gate'],
  reviewer: ['verify_gate'],
  runner: ['calendar_create', 'test'],
  forecaster: ['forecast_cycle', 'forecast_status', 'counsel_position'],
  devin: ['devin_ask', 'devin_task', 'pickup'],
  // antigravity intentionally absent: its worker decomposes arbitrary
  // kinds (comm/handoff are fast paths, everything else orchestrates).
  claudecode: ['cli_exec'],
  openclaw: ['browser_navigate', 'dom_inspect', 'portal_submit', 'gateway_task'],
  curator: ['audit_self', 'optimize_agent', 'radar_agents', 'radar_sweep'],
  distributor: ['distribution_status', 'reddit_draft'],
  prep: ['engagement_plan', 'initiative_drain', 'meeting_brief', 'mission_plan', 'prep_sweep'],
  strategist: ['cluster', 'plan', 'manifest', 'regress', 'propose_skill', 'propose_agent', 'counsel_convene', 'counsel_synthesize', 'counsel_personas', 'counsel_persona_position', 'counsel_persona_positions', 'counsel_position', 'goal_plan', 'goal_review', 'tune_cycle'],
  brief: ['family', 'health', 'legal', 'personal'],
};

/** Pre-flight dispatch validation — reject kinds the target agent
 *  cannot execute BEFORE arming, so tenants never burn quota or wait
 *  through a veto window for a guaranteed runtime failure. */
export function validateDispatchTarget(agentId: string, kind: string): { ok: boolean; error?: string; validKinds?: string[]; validAgents?: string[] } {
  if (!KNOWN_AGENTS.has(agentId)) {
    return { ok: false, error: `unknown agent '${agentId}'`, validAgents: [...KNOWN_AGENTS].sort() };
  }
  const kinds = AGENT_KINDS[agentId];
  if (kinds && !kinds.includes(kind)) {
    return { ok: false, error: `agent '${agentId}' does not accept kind '${kind}'`, validKinds: kinds };
  }
  return { ok: true };
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
