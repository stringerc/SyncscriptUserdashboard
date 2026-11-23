/**
 * capability-map.ts — goal-driven coverage model.
 *
 * Skills are a supply chain, not a list: every active life-goal implies
 * a set of required capabilities, and coverage is only real if a
 * verifiable asset backs it — a Cortex agent lane, a native tool, or an
 * installed skill (OpenClaw managed/personal/bundled or Cortex-proposed).
 *
 * assessCoverage() is deterministic and cheap: goal text → capability
 * inference (rules, no LLM) → coverage check against live registries.
 * fileCapabilityGaps() turns missing coverage into strategy proposals —
 * the same approve-each ledger every other governed change uses.
 *
 * Honest boundaries:
 *  - "covered" means an asset EXISTS, not that it has been exercised for
 *    this goal. Utilization tracking is a later iteration.
 *  - Skill matching is keyword-based on name+description; a semantic
 *    matcher would be better but requires an embedding call per scan.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getCortexGoals, type LifeGoal } from '../cortex-goals';
import { AGENT_KINDS, KNOWN_AGENTS } from './tenants';
import { fileStrategyProposals } from '../cortex-agents/strategy-proposals';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const SNAPSHOT = path.join(RUNTIME, 'capability-map.jsonl');

export interface CapabilityDef {
  id: string;
  label: string;
  /** Tested against goal title + horizon + signals + step titles. */
  infer: RegExp;
  /** Cortex agent lanes that satisfy it: 'agentId:kind' (kind optional for dynamic agents). */
  cortexAssets?: string[];
  /** Native Cortex tools that satisfy it (built-in, always present). */
  nativeTools?: string[];
  /** Keywords matched against skill name+description. */
  skillTerms?: string[];
}

export const CAPABILITY_CATALOG: CapabilityDef[] = [
  {
    id: 'goal-strategy', label: 'Goal decomposition & review',
    infer: /./, // every goal needs this
    cortexAssets: ['strategist:goal_plan', 'strategist:goal_review', 'forecaster:forecast_cycle'],
    nativeTools: ['cortex_goals'],
  },
  {
    id: 'legal-research', label: 'Legal / case research',
    infer: /custody|legal|law|attorney|court|case|lawsuit|divorce|gojf|lawbot|filing|docket/i,
    cortexAssets: ['brief:legal', 'scout:repo_scan'],
    nativeTools: ['fetch_url', 'read_document'],
    skillTerms: ['legal', 'court', 'case law', 'statute', 'custody'],
  },
  {
    id: 'deadline-ops', label: 'Deadline & calendar tracking',
    infer: /deadline|court date|filing|docket|appeal|statute|schedule|calendar|hearing/i,
    cortexAssets: ['runner:calendar_create', 'prep:meeting_brief'],
    nativeTools: ['calendar'],
    skillTerms: ['calendar', 'reminder', 'deadline', 'schedule'],
  },
  {
    id: 'document-assembly', label: 'Document production',
    infer: /document|petition|motion|brief|contract|invoice|report|write|draft/i,
    cortexAssets: ['builder:verify_gate'],
    nativeTools: ['create_document', 'create_spreadsheet', 'read_document', 'apply_patch'],
    skillTerms: ['pdf', 'document', 'libreoffice', 'writing'],
  },
  {
    id: 'external-comms', label: 'Outbound communication',
    infer: /email|message|send|outreach|contact|attorney|client|reply|respond/i,
    cortexAssets: ['openclaw:gateway_task', 'distributor:reddit_draft'],
    nativeTools: ['imessage_send', 'notify', 'fetch_url'],
    skillTerms: ['email', 'himalaya', 'message', 'channel'],
  },
  {
    id: 'financial-ops', label: 'Revenue & billing ops',
    infer: /revenue|invoice|billing|payment|sales|pricing|deal|customer|tenant|launch/i,
    cortexAssets: ['distributor:distribution_status'],
    nativeTools: ['cortex_goals'],
    skillTerms: ['stripe', 'payment', 'invoice', 'billing', 'gumroad'],
  },
  {
    id: 'health-fitness', label: 'Health & fitness tracking',
    infer: /health|fitness|gym|run|diet|sleep|workout|medical/i,
    cortexAssets: ['brief:health'],
    nativeTools: ['get_weather'],
    skillTerms: ['health', 'fitness', 'workout', 'medical'],
  },
  {
    id: 'creative-media', label: 'Media & content production',
    infer: /video|image|design|brand|marketing|launch|content|promo|thumbnail/i,
    cortexAssets: ['distributor:reddit_draft'],
    nativeTools: ['render_video', 'generate_image', 'postprocess_video', 'emit_artifact'],
    skillTerms: ['video', 'image', 'design', 'marketing', 'canvas', 'brag'],
  },
  {
    id: 'software-dev', label: 'Software development',
    infer: /build|ship|deploy|feature|code|app|saas|mvp|refactor|bug|test/i,
    cortexAssets: ['builder:verify_gate', 'devin:devin_task', 'claudecode:cli_exec', 'reviewer:verify_gate'],
    nativeTools: ['exec', 'read_file', 'edit_file', 'grep', 'glob', 'apply_patch'],
    skillTerms: ['playwright', 'debug', 'test', 'git', 'typescript', 'build'],
  },
  {
    id: 'research-intel', label: 'Research & intelligence',
    infer: /research|learn|study|market|competitor|investigate|analyz|trend/i,
    cortexAssets: ['scout:repo_scan', 'scout:social_scan', 'scout:github_trend_scan', 'librarian:graph_query'],
    nativeTools: ['fetch_url', 'recall_facts', 'remember_fact'],
    skillTerms: ['research', 'search', 'agent-reach', 'marketing', 'reddit'],
  },
  {
    id: 'security-ops', label: 'Security & audit',
    infer: /security|audit|pentest|bug|vuln|exploit|harden|incident/i,
    cortexAssets: ['warden:patrol', 'curator:audit_self', 'sentinel:probe_model'],
    nativeTools: ['grep', 'read_file', 'exec'],
    skillTerms: ['security', 'hunt', 'audit', 'evidence', 'report'],
  },
  {
    id: 'customer-ops', label: 'Customer & tenant operations',
    infer: /customer|tenant|client|support|onboard|user|dashboard/i,
    cortexAssets: ['distributor:distribution_status', 'strategist:plan'],
    nativeTools: ['cortex_agents'],
    skillTerms: ['customer', 'tenant', 'support', 'crm'],
  },
  {
    id: 'data-analysis', label: 'Data & metrics analysis',
    infer: /data|analytic|metric|report|dashboard|measure|kpi/i,
    cortexAssets: ['forecaster:forecast_cycle', 'librarian:graph_query'],
    nativeTools: ['read_file', 'create_spreadsheet', 'cortex_observability'],
    skillTerms: ['data', 'analytics', 'chart', 'visualize', 'dashboard'],
  },
  {
    id: 'longform-writing', label: 'Long-form authoring',
    infer: /book|novel|author|chapter|manuscript|publish|write.*book/i,
    cortexAssets: ['librarian:distill'],
    nativeTools: ['create_document'],
    skillTerms: ['book', 'writing', 'author', 'publish'],
  },
];

// ── Skill corpus ──────────────────────────────────────────────────────

interface SkillRecord { name: string; description: string; source: string; }

let skillCache: { at: number; skills: SkillRecord[] } | null = null;
const SKILL_CACHE_MS = 60_000;

function skillDirs(): string[] {
  return [
    path.join(os.homedir(), '.openclaw', 'skills'),
    path.join(os.homedir(), '.agents', 'skills'),
    path.join(process.cwd(), 'skills'),
    path.join(RUNTIME, 'skills', 'proposed'),
    path.join(RUNTIME, 'skills', 'active'),
  ];
}

function parseSkillFile(file: string, source: string): SkillRecord | null {
  try {
    const raw = fs.readFileSync(file, 'utf8').slice(0, 4000);
    const fm = raw.match(/^---\s*\n([\s\S]*?)\n---/);
    const head = fm ? fm[1] : raw.slice(0, 800);
    const name = (head.match(/^name:\s*(.+)$/m)?.[1] || path.basename(path.dirname(file))).trim().replace(/^['"]|['"]$/g, '');
    const description = (head.match(/^description:\s*(.+)$/m)?.[1] || '').trim().replace(/^['"]|['"]$/g, '');
    return { name, description, source };
  } catch { return null; }
}

/** All installed/proposed skills across OpenClaw + Cortex stores. */
export function loadSkillCorpus(force = false): SkillRecord[] {
  if (!force && skillCache && Date.now() - skillCache.at < SKILL_CACHE_MS) return skillCache.skills;
  const skills: SkillRecord[] = [];
  for (const dir of skillDirs()) {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      const candidates = ent.isDirectory()
        ? [path.join(dir, ent.name, 'SKILL.md')]
        : ent.name.endsWith('.md') ? [path.join(dir, ent.name)] : [];
      for (const f of candidates) {
        if (!fs.existsSync(f)) continue;
        const rec = parseSkillFile(f, path.relative(os.homedir(), dir) || dir);
        if (rec) skills.push(rec);
      }
    }
  }
  skillCache = { at: Date.now(), skills };
  return skills;
}

// ── Assessment ────────────────────────────────────────────────────────

export interface CapabilityStatus {
  id: string;
  label: string;
  /** covered = agent lane or real skill backs it; thin = only generic
   *  native tools (fetch_url, read_file) — exists but shallow;
   *  missing = nothing backs it. */
  status: 'covered' | 'thin' | 'missing';
  via: string[];
}

function goalText(g: LifeGoal): string {
  return [g.title, g.horizon, ...(g.signals || []), ...(g.steps || []).map((s: any) => s.title || '')]
    .filter(Boolean).join(' ');
}

function agentAssetCovered(spec: string): string | null {
  const [agentId, kind] = spec.split(':');
  if (!KNOWN_AGENTS.has(agentId)) return null;
  const kinds = AGENT_KINDS[agentId];
  // Dynamic agents (no whitelist, e.g. antigravity orchestrator) accept
  // arbitrary kinds — count as covered via their orchestration lane.
  if (!kinds) return `${agentId}:orchestrate(dynamic)`;
  if (!kind || kinds.includes(kind)) return spec;
  return null;
}

function skillMatches(terms: string[] | undefined, corpus: SkillRecord[]): string[] {
  if (!terms?.length) return [];
  const hits: string[] = [];
  for (const t of terms) {
    const tl = t.toLowerCase();
    for (const sk of corpus) {
      const hay = `${sk.name} ${sk.description}`.toLowerCase();
      if (hay.includes(tl)) { hits.push(`skill:${sk.name}`); break; }
    }
  }
  return [...new Set(hits)];
}

export function inferCapabilities(goal: LifeGoal): CapabilityDef[] {
  const text = goalText(goal);
  return CAPABILITY_CATALOG.filter((c) => c.infer.test(text));
}

export function assessGoal(goal: LifeGoal, corpus = loadSkillCorpus()): {
  goalId: string; title: string; horizon: string;
  capabilities: CapabilityStatus[]; missing: string[];
} {
  const capabilities: CapabilityStatus[] = inferCapabilities(goal).map((def) => {
    const strong: string[] = [];
    const thin: string[] = [];
    for (const a of def.cortexAssets || []) {
      const hit = agentAssetCovered(a);
      if (hit) strong.push(`agent:${hit}`);
    }
    strong.push(...skillMatches(def.skillTerms, corpus));
    for (const t of def.nativeTools || []) thin.push(`tool:${t}`);
    const via = [...new Set([...strong, ...thin])];
    const status = strong.length ? 'covered' : thin.length ? 'thin' : 'missing';
    return { id: def.id, label: def.label, status, via };
  });
  return {
    goalId: goal.id, title: goal.title, horizon: goal.horizon || '',
    capabilities,
    missing: capabilities.filter((c) => c.status !== 'covered').map((c) => c.id),
  };
}

export interface GoalAssessment {
  goalId: string; title: string; horizon: string;
  capabilities: CapabilityStatus[]; missing: string[];
}
export interface CoverageAssessment {
  assessedAt: number;
  goals: GoalAssessment[];
  summary: { goals: number; covered: number; thin: number; missing: number; missingByCapability: Record<string, number> };
  proposalsFiled?: number;
}

export function assessCoverage(opts?: { fileGaps?: boolean }): CoverageAssessment {
  const corpus = loadSkillCorpus();
  const goals = getCortexGoals().list('active').map((g) => assessGoal(g, corpus));
  const missingByCapability: Record<string, number> = {};
  let covered = 0, thin = 0, missing = 0;
  for (const g of goals) {
    for (const c of g.capabilities) {
      if (c.status === 'covered') covered++;
      else if (c.status === 'thin') thin++;
      else missing++;
      if (c.status !== 'covered') missingByCapability[c.id] = (missingByCapability[c.id] || 0) + 1;
    }
  }
  const result: CoverageAssessment = {
    assessedAt: Date.now(), goals,
    summary: { goals: goals.length, covered, thin, missing, missingByCapability },
  };
  // Durable snapshot — coverage history is queryable across restarts.
  // Bounded: rotate at ~512KB so the audit log can't grow forever.
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    try {
      if (fs.statSync(SNAPSHOT).size > 512 * 1024) fs.renameSync(SNAPSHOT, `${SNAPSHOT}.1`);
    } catch {}
    fs.appendFileSync(SNAPSHOT, JSON.stringify({
      ts: result.assessedAt,
      goals: goals.map((g) => ({ id: g.goalId, missing: g.missing })),
      summary: result.summary,
    }) + '\n', 'utf8');
  } catch {}
  if (opts?.fileGaps) {
    result.proposalsFiled = fileCapabilityGaps(goals);
  }
  return result;
}

/** File one strategy proposal per goal that has missing capabilities.
 *  planNote is goal-scoped and actions[0] is the only slot used, so the
 *  ledger's planNote+index dedupe makes repeat runs idempotent. */
export function fileCapabilityGaps(goals?: ReturnType<typeof assessGoal>[]): number {
  const assessed = goals || assessCoverage().goals;
  let filed = 0;
  for (const g of assessed) {
    if (!g.missing.length) continue;
    const caps = g.capabilities
      .filter((c) => c.status !== 'covered')
      .map((c) => {
        const def = CAPABILITY_CATALOG.find((d) => d.id === c.id);
        const depth = c.status === 'thin' ? 'thin coverage' : 'no coverage';
        return `${def?.label || c.id} [${depth}]${def?.skillTerms?.length ? ` (search skills for: ${def.skillTerms.slice(0, 3).join(', ')})` : ''}`;
      }).join('; ');
    const res = fileStrategyProposals({
      planNote: `capability-gap-${g.goalId}`,
      planTaskId: `capmap-${g.goalId}`,
      actions: [`[process] Close capability gaps for goal "${g.title.slice(0, 80)}": ${caps} — acquire via cortex_skill_discovery install, strategist propose_skill, or a new agent lane; verify coverage with GET /api/cortex/capabilities`],
    });
    filed += res.filed;
  }
  return filed;
}
