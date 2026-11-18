/**
 * Instincts — Cortex-native continuous learning (ECC continuous-learning-v2
 * adaptation). Atomic learned behaviors with Beta-posterior confidence
 * (alpha=hits, beta=misses), mandatory venture/agent scoping, time decay,
 * and governed promotion: candidates file strategy proposals, never write
 * active rules silently.
 *
 * Storage: .cortex-runtime/instincts.json (bounded, single-file like rules).
 * Injection: instinctsBlock() renders top active instincts for an agent +
 * venture scope; the /api/cortex/agents/llm endpoint appends it so every
 * worker gets scoped instincts without per-worker edits.
 */

import fs from 'node:fs';
import path from 'node:path';

const RUNTIME_DIR = process.env.CORTEX_AGENTS_STATE_DIR || path.join(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME_DIR, 'instincts.json');
const CURSOR_FILE = path.join(RUNTIME_DIR, 'instincts-cursor.json');
const MAX_INSTINCTS = 500;

/** Beta posterior: confidence = alpha/(alpha+beta). Prior Beta(1,1) uniform. */
export interface Instinct {
  id: string;
  /** What to do when triggered — one atomic imperative sentence. */
  action: string;
  /** Human-readable trigger condition / observation that produced it. */
  trigger: string;
  /** Scope — '' means global; otherwise venture id or agent id tag. */
  ventureId?: string;
  agentId?: string;
  /** Beta posterior parameters. */
  alpha: number;
  beta: number;
  /** Evidence trail — task ids, incident keys, file refs. */
  evidence: string[];
  /** Origin: which routine/task kind produced the candidate. */
  source: string;
  /** Lifecycle: candidate → active → promoted | retired | contradicted. */
  status: 'candidate' | 'active' | 'promoted' | 'retired' | 'contradicted';
  /** Times this instinct's advice was followed by a successful outcome. */
  appliedHits: number;
  /** Times it was applied and the outcome failed/contradicted. */
  appliedMisses: number;
  createdAt: number;
  updatedAt: number;
  lastAppliedAt?: number;
  /** Promotion target once approved: rule text for rules.ts promotion. */
  ruleText?: string;
}

function ensureDir() {
  if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

function readAll(): Instinct[] {
  try {
    ensureDir();
    if (!fs.existsSync(FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeAll(list: Instinct[]) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(list.slice(-MAX_INSTINCTS), null, 2));
}

/** Beta mean with a weak prior toward 0.5 — honest uncertainty. */
export function instinctConfidence(i: Pick<Instinct, 'alpha' | 'beta'>): number {
  return i.alpha / (i.alpha + i.beta);
}

/** Time decay: confidence erodes ~5%/week of disuse, floor at prior. */
export function decayedConfidence(i: Instinct, now = Date.now()): number {
  const weeks = Math.max(0, (now - i.updatedAt) / (7 * 24 * 3600_000));
  const base = instinctConfidence(i);
  const decayed = base + (0.5 - base) * Math.min(0.5, weeks * 0.05);
  return Math.max(0.05, Math.min(0.95, decayed));
}

/** Upsert an instinct candidate/observation. Matching: same action+scope. */
export function upsertInstinct(input: {
  action: string;
  trigger: string;
  ventureId?: string;
  agentId?: string;
  source: string;
  evidence?: string[];
  ruleText?: string;
}): Instinct {
  const all = readAll();
  const norm = input.action.trim().toLowerCase().slice(0, 300);
  const existing = all.find((i) =>
    i.action.trim().toLowerCase() === norm &&
    (i.ventureId || '') === (input.ventureId || '') &&
    (i.agentId || '') === (input.agentId || '') &&
    i.status !== 'retired');
  const now = Date.now();
  if (existing) {
    existing.updatedAt = now;
    existing.trigger = input.trigger || existing.trigger;
    existing.source = input.source || existing.source;
    if (input.evidence?.length) existing.evidence = [...new Set([...existing.evidence, ...input.evidence])].slice(-20);
    if (input.ruleText) existing.ruleText = input.ruleText;
    writeAll(all);
    return existing;
  }
  const inst: Instinct = {
    id: `inst-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    action: input.action.trim().slice(0, 300),
    trigger: input.trigger.trim().slice(0, 300),
    ventureId: input.ventureId || undefined,
    agentId: input.agentId || undefined,
    alpha: 1, beta: 1,
    evidence: (input.evidence || []).slice(0, 20),
    source: input.source,
    status: 'candidate',
    appliedHits: 0, appliedMisses: 0,
    createdAt: now, updatedAt: now,
    ruleText: input.ruleText,
  };
  all.push(inst);
  writeAll(all);
  return inst;
}

/** Record an outcome against an instinct: hit (success) or miss (failure). */
export function applyOutcome(instinctId: string, hit: boolean): boolean {
  const all = readAll();
  const i = all.find((x) => x.id === instinctId);
  if (!i) return false;
  if (hit) { i.alpha += 1; i.appliedHits += 1; }
  else { i.beta += 1; i.appliedMisses += 1; i.status = i.status === 'active' ? 'contradicted' : i.status; }
  i.updatedAt = Date.now();
  i.lastAppliedAt = Date.now();
  // Auto-retire instincts decisively contradicted (posterior < 0.2 with n≥5).
  if (i.alpha + i.beta >= 5 && instinctConfidence(i) < 0.2 && i.status !== 'retired') {
    i.status = 'retired';
  }
  writeAll(all);
  return true;
}

/** Activate a candidate instinct (post-promotion approval path). */
export function activateInstinct(id: string): boolean {
  const all = readAll();
  const i = all.find((x) => x.id === id);
  if (!i) return false;
  i.status = 'active';
  i.updatedAt = Date.now();
  writeAll(all);
  return true;
}

export function retireInstinct(id: string): boolean {
  const all = readAll();
  const i = all.find((x) => x.id === id);
  if (!i) return false;
  i.status = 'retired';
  i.updatedAt = Date.now();
  writeAll(all);
  return true;
}

export function listInstincts(opts: { status?: Instinct['status']; ventureId?: string; agentId?: string } = {}): Instinct[] {
  return readAll()
    .filter((i) => (!opts.status || i.status === opts.status))
    .filter((i) => (!opts.ventureId || !i.ventureId || i.ventureId === opts.ventureId))
    .filter((i) => (!opts.agentId || !i.agentId || i.agentId === opts.agentId))
    .sort((a, b) => decayedConfidence(b) - decayedConfidence(a));
}

/**
 * Render active instincts for prompt injection. Scope rule: a venture-
 * tagged instinct only renders for that venture; untagged (global)
 * instincts render everywhere; agent-tagged only for that agent.
 * This is the ECC v2.1 cross-contamination fix made structural.
 */
export function instinctsBlock(opts: { agentId?: string; ventureId?: string; instruction?: string } = {}): string {
  const candidates = listInstincts({ status: 'active' })
    .filter((i) => {
      if (i.agentId && opts.agentId && i.agentId !== opts.agentId) return false;
      if (i.agentId && !opts.agentId) return false; // agent-scoped needs the agent
      if (i.ventureId && opts.ventureId !== i.ventureId) return false; // venture-scoped never leaks
      return true;
    })
    .slice(0, 8);
  if (!candidates.length) return '';
  const lines = candidates.map((i) => {
    const conf = Math.round(decayedConfidence(i) * 100);
    const scope = [i.ventureId && `venture:${i.ventureId}`, i.agentId && `agent:${i.agentId}`].filter(Boolean).join(' ');
    return `- [${conf}%] ${i.action}${scope ? ` (${scope})` : ''}`;
  });
  return `LEARNED INSTINCTS (evidence-backed, scoped — follow unless they conflict with the task):\n${lines.join('\n')}`;
}

/** Candidates ready for governed promotion: active + confident + enough evidence. */
export function promotableInstincts(minEvidence = 3, minConfidence = 0.65): Instinct[] {
  return listInstincts({ status: 'active' })
    .filter((i) => i.evidence.length >= minEvidence && decayedConfidence(i) >= minConfidence && !i.ruleText?.includes('[promoted]'));
}

/** Mark an instinct as promoted into the rules store. */
export function markPromoted(id: string, proposalId: string): boolean {
  const all = readAll();
  const i = all.find((x) => x.id === id);
  if (!i) return false;
  i.status = 'promoted';
  i.ruleText = `[promoted:${proposalId}] ${i.ruleText || i.action}`;
  i.updatedAt = Date.now();
  writeAll(all);
  return true;
}

/** Observation → candidate extraction cursor for the librarian routine. */
export function instinctCursor(): { lastScanAt: number; scannedOutcomes: number } {
  try {
    ensureDir();
    if (!fs.existsSync(CURSOR_FILE)) return { lastScanAt: 0, scannedOutcomes: 0 };
    return JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf8'));
  } catch { return { lastScanAt: 0, scannedOutcomes: 0 }; }
}

export function saveInstinctCursor(c: { lastScanAt: number; scannedOutcomes: number }) {
  ensureDir();
  fs.writeFileSync(CURSOR_FILE, JSON.stringify(c));
}

/** Token overlap helper for trigger matching against task text. */
export function triggerMatches(trigger: string, text: string): boolean {
  const toks = trigger.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3);
  if (!toks.length) return false;
  const hay = text.toLowerCase();
  const hits = toks.filter((t) => hay.includes(t)).length;
  return hits >= Math.min(2, toks.length);
}

/** Record an observation outcome against matching active instincts. */
export function reconcileOutcomes(agentId: string | undefined, ventureId: string | undefined, instruction: string, success: boolean, taskId: string): number {
  const active = listInstincts({ status: 'active' })
    .filter((i) => (!i.agentId || i.agentId === agentId) && (!i.ventureId || i.ventureId === ventureId))
    .filter((i) => triggerMatches(i.trigger, instruction));
  for (const i of active.slice(0, 5)) applyOutcome(i.id, success);
  return active.length;
}
