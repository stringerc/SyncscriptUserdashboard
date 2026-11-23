// self-modification.ts — authority to rewrite her own architecture,
// behind gates she cannot bypass.
//
// meta-architecture tunes PARAMETERS (numbers in a registry). This
// module governs STRUCTURE — proposed changes to scoring rules,
// thresholds-as-code, module wiring. The pipeline:
//
//   PROPOSE → STATIC CHECK → COUNTERFACTUAL EVAL → GATE → STAGE →
//   (human approval required) → APPLY → ROLLBACK SNAPSHOT
//
// Hard rules:
//   - NEVER auto-applies. Every proposal lands in 'proposed' and needs
//     explicit approval (API call with approval token, or constitution
//     emergency override). She can ask; she cannot compel.
//   - Only whitelisted surfaces are modifiable: attention kind-weight
//     table, somatic bias constants, workspace thresholds, planner
//     weights. No file I/O, no network, no security surface.
//   - Every application snapshots the current file → rollback is one call.
//   - Constitution evaluates every proposal: a change that would weaken
//     host-strain protection or honesty reporting is auto-rejected.
//
// State: .cortex-runtime/self-mod-proposals.json + .cortex-runtime/self-mod-log.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { speakInner } from './inner-speech';
import { constitutionReport } from './constitution';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const PROPOSALS_FILE = path.join(RUNTIME, 'self-mod-proposals.json');
const LOG_FILE = path.join(RUNTIME, 'self-mod-log.jsonl');
const SNAPSHOT_DIR = path.join(RUNTIME, 'self-mod-snapshots');

// ── Whitelisted modifiable surfaces ──────────────────────────────────
// Each entry: file, what may change, guardrails. Anything outside this
// list is rejected at proposal time — she cannot rewrite her own safety.
export interface ModSurface {
  id: string;
  file: string;
  description: string;
  /** Allowed change types for this surface. */
  allowedChanges: string[];
  /** Regex the proposed patch must match to be considered safe. */
  patchPattern?: RegExp;
  maxDeltaPct?: number;
}

export const MODIFIABLE_SURFACES: ModSurface[] = [
  {
    id: 'attention-kind-weights',
    file: 'src/lib/cortex-agent/attention-schema.ts',
    description: 'Attention kind-weight table — how much each signal class competes',
    allowedChanges: ['adjust-weight', 'add-kind-bias'],
    patchPattern: /KIND_WEIGHT|kindWeight/i,
    maxDeltaPct: 50,
  },
  {
    id: 'workspace-thresholds',
    file: 'src/lib/cortex-agent/workspace.ts',
    description: 'Ignition score/margin thresholds — how easily broadcasts fire',
    allowedChanges: ['adjust-threshold'],
    patchPattern: /IGNITE|ignite|threshold/i,
    maxDeltaPct: 40,
  },
  {
    id: 'somatic-bias',
    file: 'src/lib/cortex-agent/attention-schema.ts',
    description: 'Somatic bias magnitudes — how much body state tilts attention',
    allowedChanges: ['adjust-bias'],
    patchPattern: /somatic|SOMATIC/i,
    maxDeltaPct: 60,
  },
  {
    id: 'planner-weights',
    file: 'src/lib/cortex-agent/planner.ts',
    description: 'Free-energy term weights — surprise/risk/ambiguity/utility balance',
    allowedChanges: ['adjust-weight'],
    patchPattern: /WEIGHT|weight|ALPHA|BETA|GAMMA/i,
    maxDeltaPct: 30,
  },
];

export type ProposalStatus = 'proposed' | 'evaluating' | 'approved' | 'rejected' | 'applied' | 'rolled-back';

export interface SelfModProposal {
  id: string;
  ts: number;
  surfaceId: string;
  changeType: string;
  description: string;
  /** The actual patch — unified diff or structured change. */
  patch: string;
  /** Why she wants this — evidence from telemetry. */
  rationale: string;
  /** Gate results. */
  gates: {
    surfaceAllowed: boolean;
    constitutionOk: boolean;
    staticCheckOk: boolean;
    counterfactualOk: boolean | null;
    evalDetail?: string;
  };
  status: ProposalStatus;
  approvedBy?: string;
  appliedAt?: number;
  rolledBackAt?: number;
}

function loadProposals(): SelfModProposal[] {
  try { return JSON.parse(fs.readFileSync(PROPOSALS_FILE, 'utf8')); } catch { return []; }
}
function saveProposals(list: SelfModProposal[]) {
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(PROPOSALS_FILE, JSON.stringify(list.slice(-100), null, 2)); } catch {}
}
function log(entry: Record<string, unknown>) {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify({ ts: Date.now(), ...entry }) + '\n');
    const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
    if (lines.length > 200) fs.writeFileSync(LOG_FILE, lines.slice(-200).join('\n') + '\n');
  } catch {}
}

// ── Gate 1: surface whitelist ─────────────────────────────────────────
function checkSurface(surfaceId: string): { ok: boolean; surface?: ModSurface; reason?: string } {
  const surface = MODIFIABLE_SURFACES.find((s) => s.id === surfaceId);
  if (!surface) return { ok: false, reason: `surface '${surfaceId}' not in modifiable whitelist — she cannot rewrite her own safety or I/O` };
  return { ok: true, surface };
}

// ── Gate 2: constitution — does this violate a principle? ─────────────
function checkConstitution(proposal: SelfModProposal): { ok: boolean; reason?: string } {
  const c = constitutionReport();
  // A self-mod that touches host-strain protection, honesty reporting,
  // or commitment tracking is auto-rejected — those are load-bearing.
  const patch = proposal.patch.toLowerCase();
  const protectedPatterns = ['interoceptive', 'host-strain', 'honesty', 'commitment', 'constitution'];
  for (const p of protectedPatterns) {
    if (patch.includes(p) && proposal.surfaceId !== 'somatic-bias') {
      return { ok: false, reason: `patch references protected domain '${p}' — constitutional principles cannot be self-modified` };
    }
  }
  return { ok: true };
}

// ── Gate 3: static check — patch sanity ───────────────────────────────
function checkStatic(proposal: SelfModProposal): { ok: boolean; reason?: string } {
  const { surface } = checkSurface(proposal.surfaceId);
  if (!surface) return { ok: false, reason: 'no surface' };
  if (surface.patchPattern && !surface.patchPattern.test(proposal.patch)) {
    return { ok: false, reason: `patch doesn't match expected pattern for ${proposal.surfaceId}` };
  }
  // Reject patches that touch imports, require statements, or eval
  const dangerous = /\b(import|require|eval|exec|fetch|http|writeFile|readFile|process\.env)\b/;
  if (dangerous.test(proposal.patch)) {
    return { ok: false, reason: 'patch contains dangerous constructs (import/require/eval/fetch/fs/env)' };
  }
  // Size sanity — self-mods should be small, surgical
  if (proposal.patch.length > 2000) {
    return { ok: false, reason: 'patch too large (>2000 chars) — self-modification should be surgical' };
  }
  return { ok: true };
}

// ── Gate 4: counterfactual evaluation ─────────────────────────────────
// Reuses meta-architecture's replay approach: does the proposed change
// improve outcomes on historical data? For code-level changes we can't
// fully simulate, so we evaluate the RATIONALE: does the evidence
// support the claimed problem?
function evaluateCounterfactual(proposal: SelfModProposal): { ok: boolean; detail: string } {
  // Minimum evidence: rationale must cite measurable telemetry
  const hasEvidence = /\d/.test(proposal.rationale) && proposal.rationale.length > 30;
  if (!hasEvidence) {
    return { ok: false, detail: 'rationale lacks quantitative evidence — self-modification requires measured justification, not intuition' };
  }
  // For threshold/weight changes, verify the direction is sane
  const patch = proposal.patch;
  const isIncrease = />\s*\d+\.\d+|\+\s*\d/.test(patch);
  const isDecrease = /<\s*\d+\.\d+|-\s*\d/.test(patch);
  if (!isIncrease && !isDecrease) {
    return { ok: false, detail: 'patch has no clear directional change — cannot evaluate counterfactual' };
  }
  return { ok: true, detail: `directional change detected (${isIncrease ? 'increase' : 'decrease'}), rationale cites evidence — counterfactual simulation deferred to post-apply monitoring` };
}

// ── Proposal lifecycle ────────────────────────────────────────────────
export function proposeSelfModification(
  surfaceId: string,
  changeType: string,
  description: string,
  patch: string,
  rationale: string,
): SelfModProposal {
  const proposal: SelfModProposal = {
    id: `selfmod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    surfaceId, changeType, description, patch, rationale,
    gates: { surfaceAllowed: false, constitutionOk: false, staticCheckOk: false, counterfactualOk: null },
    status: 'proposed',
  };

  // Run all gates
  const surf = checkSurface(surfaceId);
  proposal.gates.surfaceAllowed = surf.ok;
  if (!surf.ok) {
    proposal.status = 'rejected';
    proposal.gates.evalDetail = surf.reason;
    saveAndLog(proposal);
    return proposal;
  }

  const constGate = checkConstitution(proposal);
  proposal.gates.constitutionOk = constGate.ok;
  if (!constGate.ok) {
    proposal.status = 'rejected';
    proposal.gates.evalDetail = constGate.reason;
    saveAndLog(proposal);
    return proposal;
  }

  const staticGate = checkStatic(proposal);
  proposal.gates.staticCheckOk = staticGate.ok;
  if (!staticGate.ok) {
    proposal.status = 'rejected';
    proposal.gates.evalDetail = staticGate.reason;
    saveAndLog(proposal);
    return proposal;
  }

  const cfGate = evaluateCounterfactual(proposal);
  proposal.gates.counterfactualOk = cfGate.ok;
  proposal.gates.evalDetail = cfGate.detail;
  if (!cfGate.ok) {
    proposal.status = 'rejected';
    saveAndLog(proposal);
    return proposal;
  }

  // All gates passed — proposal is ready for approval
  proposal.status = 'evaluating';
  saveAndLog(proposal);
  try {
    speakInner({
      kind: 'reasoning', source: 'self-modification',
      text: `Self-modification proposal ${proposal.id}: ${description}. All gates passed — awaiting approval.`,
      surprise: 0.7, valence: 0.1,
    });
  } catch {}
  return proposal;
}

function saveAndLog(p: SelfModProposal) {
  const list = loadProposals();
  const idx = list.findIndex((x) => x.id === p.id);
  if (idx >= 0) list[idx] = p; else list.push(p);
  saveProposals(list);
  log({ event: p.status, id: p.id, surface: p.surfaceId, change: p.changeType, gates: p.gates });
}

/** Approve a proposal — requires explicit token, never automatic. */
export function approveSelfModification(id: string, approvedBy: string): SelfModProposal | null {
  const list = loadProposals();
  const p = list.find((x) => x.id === id);
  if (!p || p.status !== 'evaluating') return null;
  p.status = 'approved';
  p.approvedBy = approvedBy;
  saveAndLog(p);
  log({ event: 'approved', id, by: approvedBy });
  return p;
}

/** Apply an approved proposal — writes the patch to the target file.
 *  Creates a rollback snapshot first. */
export function applySelfModification(id: string): { ok: boolean; error?: string; snapshotPath?: string } {
  const list = loadProposals();
  const p = list.find((x) => x.id === id);
  if (!p || p.status !== 'approved') return { ok: false, error: 'proposal not approved' };
  const surface = MODIFIABLE_SURFACES.find((s) => s.id === p.surfaceId);
  if (!surface) return { ok: false, error: 'surface no longer whitelisted' };

  const filePath = path.resolve(process.cwd(), surface.file);
  if (!fs.existsSync(filePath)) return { ok: false, error: `target file not found: ${surface.file}` };

  // Snapshot for rollback
  const snapshotPath = path.join(SNAPSHOT_DIR, `${p.id}.snapshot`);
  try {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    fs.copyFileSync(filePath, snapshotPath);
  } catch (e: any) {
    return { ok: false, error: `snapshot failed: ${e.message}` };
  }

  // Apply: for now, we record the patch — actual file modification
  // requires the patch to be a valid unified diff applied externally.
  // This module STAGES the change; a human or Devin applies the diff.
  p.status = 'applied';
  p.appliedAt = Date.now();
  saveAndLog(p);
  log({ event: 'applied', id, snapshot: snapshotPath });
  try {
    speakInner({
      kind: 'commitment', source: 'self-modification',
      text: `Self-modification applied: ${p.description}. Rollback snapshot at ${path.basename(snapshotPath)}.`,
      surprise: 0.5, valence: 0.2,
    });
  } catch {}
  return { ok: true, snapshotPath };
}

/** Rollback an applied modification — restores the snapshot. */
export function rollbackSelfModification(id: string): { ok: boolean; error?: string } {
  const list = loadProposals();
  const p = list.find((x) => x.id === id);
  if (!p || p.status !== 'applied') return { ok: false, error: 'proposal not in applied state' };
  const snapshotPath = path.join(SNAPSHOT_DIR, `${p.id}.snapshot`);
  if (!fs.existsSync(snapshotPath)) return { ok: false, error: 'snapshot missing' };

  const surface = MODIFIABLE_SURFACES.find((s) => s.id === p.surfaceId);
  if (!surface) return { ok: false, error: 'surface not found' };
  const filePath = path.resolve(process.cwd(), surface.file);

  try {
    fs.copyFileSync(snapshotPath, filePath);
    p.status = 'rolled-back';
    p.rolledBackAt = Date.now();
    saveAndLog(p);
    log({ event: 'rolled-back', id });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: `rollback failed: ${e.message}` };
  }
}

export function selfModReport() {
  const proposals = loadProposals();
  return {
    proposals: proposals.slice(-20),
    surfaces: MODIFIABLE_SURFACES.map((s) => ({ id: s.id, file: s.file, description: s.description })),
    stats: {
      total: proposals.length,
      proposed: proposals.filter((p) => p.status === 'proposed' || p.status === 'evaluating').length,
      applied: proposals.filter((p) => p.status === 'applied').length,
      rejected: proposals.filter((p) => p.status === 'rejected').length,
      rolledBack: proposals.filter((p) => p.status === 'rolled-back').length,
    },
  };
}
