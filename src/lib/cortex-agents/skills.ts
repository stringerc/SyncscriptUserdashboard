/**
 * Skill Marketplace — runtime capability registry (fleet spec §4).
 *
 * A catalog of capability manifests persisted in the shared workspace under
 * skill:{name} namespaces. Agents acquire skills at runtime: acquire validates
 * the manifest, enforces a trust floor, and records the holder; release drops
 * it. Composition chains acquired skills and returns the union capability set.
 *
 * Honest scope: "install" here means registry-level acquisition — the skill's
 * actual execution surface is whatever tools/workers already expose. Sandbox
 * profiles and cost-per-invocation billing are manifest fields reserved for
 * the execution layer; trustScore is real (starts at manifest value, moves
 * with verification outcomes recorded via recordSkillOutcome).
 *
 * Storage: agent-workspace skill:{name}/manifest + skill:{name}/stats.
 */

import { wsRead, wsWrite, wsNamespaces } from './agent-workspace';

export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  /** Optional model pin hint for tasks using this skill. */
  modelPin?: { tier?: string };
  sandboxProfile?: string;
  trustScore?: number;
  costPerInvocation?: number;
}

const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const MIN_TRUST = 0.4;

function manifestNs(name: string) { return `skill:${name}`; }

export function registerSkill(agentId: string, manifest: SkillManifest): { ok: boolean; error?: string } {
  if (!NAME_RE.test(manifest.name)) return { ok: false, error: 'invalid skill name' };
  if (!manifest.version || !manifest.description || !Array.isArray(manifest.capabilities)) {
    return { ok: false, error: 'manifest requires version, description, capabilities[]' };
  }
  const score = typeof manifest.trustScore === 'number' ? Math.max(0, Math.min(1, manifest.trustScore)) : 0.5;
  return wsWrite(agentId, manifestNs(manifest.name), 'manifest', { ...manifest, trustScore: score })
    .ok ? { ok: true } : { ok: false, error: 'write failed' };
}

export function getSkill(name: string) {
  const m = wsRead(manifestNs(name), 'manifest');
  if (!m.ok) return null;
  const stats = wsRead(manifestNs(name), 'stats');
  const holders = wsRead(manifestNs(name), 'holders');
  return {
    manifest: m.value as SkillManifest,
    version: m.version,
    stats: (stats.ok ? stats.value : null) as { uses?: number; successes?: number; failures?: number } | null,
    holders: (holders.ok ? holders.value : []) as string[],
  };
}

export function listSkills(): { name: string; version: string; trustScore: number; capabilities: string[] }[] {
  const out: { name: string; version: string; trustScore: number; capabilities: string[] }[] = [];
  for (const ns of wsNamespaces()) {
    if (!ns.startsWith('skill:')) continue;
    const name = ns.slice(6);
    const s = getSkill(name);
    if (s) out.push({ name, version: s.manifest.version, trustScore: s.manifest.trustScore ?? 0.5, capabilities: s.manifest.capabilities });
  }
  return out.sort((a, b) => b.trustScore - a.trustScore);
}

/** Acquire: validate trust floor, record holder under the agent's own state
 *  namespace, bump usage stats. Returns the manifest on success. */
export function acquireSkill(agentId: string, name: string, version?: string): { ok: boolean; manifest?: SkillManifest; error?: string } {
  const s = getSkill(name);
  if (!s) return { ok: false, error: `unknown skill: ${name}` };
  if (version && s.manifest.version !== version) return { ok: false, error: `version mismatch: want ${version}, have ${s.manifest.version}` };
  if ((s.manifest.trustScore ?? 0.5) < MIN_TRUST) return { ok: false, error: `trust score ${(s.manifest.trustScore ?? 0).toFixed(2)} below floor ${MIN_TRUST}` };

  const holders = s.holders ?? [];
  if (!holders.includes(agentId)) {
    wsWrite('cortex', manifestNs(name), 'holders', [...holders, agentId]);
  }
  // Per-agent active set lives in the agent's own namespace.
  const ownNs = `agent:${agentId}:state`;
  const cur = wsRead(ownNs, 'skills');
  const active = new Set<string>((cur.ok ? (cur.value as string[]) : []));
  active.add(name);
  wsWrite(agentId, ownNs, 'skills', [...active]);
  // Usage stats (best-effort, non-CAS — stats are approximate by design).
  const stats = { ...(s.stats ?? {}), uses: (s.stats?.uses ?? 0) + 1 };
  wsWrite('cortex', manifestNs(name), 'stats', stats);
  return { ok: true, manifest: s.manifest };
}

export function releaseSkill(agentId: string, name: string): { ok: boolean; error?: string } {
  const s = getSkill(name);
  if (!s) return { ok: false, error: `unknown skill: ${name}` };
  const holders = (s.holders ?? []).filter((h) => h !== agentId);
  wsWrite('cortex', manifestNs(name), 'holders', holders);
  const ownNs = `agent:${agentId}:state`;
  const cur = wsRead(ownNs, 'skills');
  if (cur.ok) {
    const active = ((cur.value as string[]) ?? []).filter((n) => n !== name);
    wsWrite(agentId, ownNs, 'skills', active);
  }
  return { ok: true };
}

/** Compose: union capabilities of acquired skills; fails if any isn't held. */
export function composeSkills(agentId: string, names: string[]): { ok: boolean; capabilities?: string[]; skills?: SkillManifest[]; error?: string } {
  const manifests: SkillManifest[] = [];
  const caps = new Set<string>();
  for (const n of names) {
    const s = getSkill(n);
    if (!s) return { ok: false, error: `unknown skill: ${n}` };
    if (!(s.holders ?? []).includes(agentId)) return { ok: false, error: `skill not acquired: ${n}` };
    manifests.push(s.manifest);
    for (const c of s.manifest.capabilities) caps.add(c);
  }
  return { ok: true, capabilities: [...caps], skills: manifests };
}

/** Feed an outcome back into trustScore — the marketplace's reputation loop. */
export function recordSkillOutcome(name: string, success: boolean) {
  const s = getSkill(name);
  if (!s) return;
  const stats = s.stats ?? { uses: 0, successes: 0, failures: 0 };
  const updated = {
    ...stats,
    successes: (stats.successes ?? 0) + (success ? 1 : 0),
    failures: (stats.failures ?? 0) + (success ? 0 : 1),
  };
  wsWrite('cortex', manifestNs(name), 'stats', updated);
  const total = (updated.successes ?? 0) + (updated.failures ?? 0);
  if (total >= 3) {
    const trust = Math.max(0, Math.min(1, (updated.successes ?? 0) / total));
    const m = wsRead(manifestNs(name), 'manifest');
    if (m.ok) wsWrite('cortex', manifestNs(name), 'manifest', { ...(m.value as SkillManifest), trustScore: trust });
  }
}

export function skillStats() {
  const skills = listSkills();
  return {
    total: skills.length,
    avgTrust: skills.length ? skills.reduce((a, s) => a + s.trustScore, 0) / skills.length : 0,
    namespaces: wsNamespaces().filter((n) => n.startsWith('skill:')).length,
  };
}
