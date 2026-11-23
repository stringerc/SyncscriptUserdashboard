// intersubjective.ts — joint truth-seeking: "do we agree this is real?"
//
// ToM models their beliefs; second-order models their model of me.
// This is the intersubjective layer: SHARED epistemic commitments where
// cortex, the user, and fleet agents converge on mutually calibrated
// ground truth. Not prediction — AGREEMENT with receipts.
//
// Protocol: proposeClaim → collectPositions → measure divergence →
// converge or log honest disagreement. Positions are real records —
// a claim is 'shared' only when multiple parties affirm it.
// State: .cortex-runtime/intersubjective.json
import fs from 'node:fs';
import path from 'node:path';
import { speakInner } from './inner-speech';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME, 'intersubjective.json');

export interface EpistemicClaim {
  id: string;
  claim: string;
  /** Who is party to this claim. */
  parties: string[];
  /** Positions: agentId → {stance, confidence, evidence, ts}. */
  positions: Record<string, { stance: 'agree' | 'disagree' | 'unsure'; confidence: number; evidence?: string; ts: number }>;
  status: 'open' | 'converged' | 'contested' | 'dissolved';
  createdAt: number;
  resolvedAt?: number;
}

function load(): EpistemicClaim[] {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}
function save(list: EpistemicClaim[]) {
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(list.slice(-100), null, 2)); } catch {}
}

/** Propose a claim for intersubjective validation. */
export function proposeClaim(claim: string, parties: string[] = ['cortex', 'user']): EpistemicClaim {
  const c: EpistemicClaim = {
    id: `claim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    claim: claim.slice(0, 300),
    parties,
    positions: {},
    status: 'open',
    createdAt: Date.now(),
  };
  // Cortex's own position — she must stake a claim to seek agreement
  c.positions['cortex'] = { stance: 'agree', confidence: 0.7, evidence: 'self-assessment', ts: Date.now() };
  const list = load(); list.push(c); save(list);
  try { speakInner({ kind: 'reasoning', source: 'intersubjective', text: `Proposed epistemic claim for validation: "${claim.slice(0, 80)}" — seeking agreement with ${parties.filter(p=>p!=='cortex').join(', ')}.`, surprise: 0.4, valence: 0.1 }); } catch {}
  return c;
}

/** Record a party's position on a claim. */
export function recordPosition(claimId: string, party: string, stance: 'agree' | 'disagree' | 'unsure', confidence: number, evidence?: string): EpistemicClaim | null {
  const list = load();
  const c = list.find((x) => x.id === claimId);
  if (!c) return null;
  c.positions[party] = { stance, confidence: Math.max(0, Math.min(1, confidence)), evidence: evidence?.slice(0, 200), ts: Date.now() };
  // Re-evaluate convergence
  const stances = Object.values(c.positions);
  const agrees = stances.filter((p) => p.stance === 'agree').length;
  const disagrees = stances.filter((p) => p.stance === 'disagree').length;
  const unsure = stances.filter((p) => p.stance === 'unsure').length;
  const total = stances.length;
  if (disagrees > 0 && agrees === 0) c.status = 'contested';
  else if (agrees === total && total >= 2) { c.status = 'converged'; c.resolvedAt = Date.now(); }
  else if (unsure === total) c.status = 'dissolved';
  save(list);
  // Narrate resolution
  if (c.status === 'converged' || c.status === 'contested') {
    try {
      speakInner({
        kind: 'reflection', source: 'intersubjective',
        text: `Epistemic claim ${c.status}: "${c.claim.slice(0, 70)}" — ${agrees} agree, ${disagrees} disagree, ${unsure} unsure across ${total} parties.`,
        surprise: 0.5, valence: c.status === 'converged' ? 0.2 : -0.1,
      });
    } catch {}
  }
  return c;
}

/** Mutual calibration score — how well do our confidences align?
 *  Returns divergence: 0 = perfectly calibrated agreement, 1 = maximal. */
export function calibrationDivergence(claimId: string): { divergence: number; detail: string } {
  const list = load();
  const c = list.find((x) => x.id === claimId);
  if (!c) return { divergence: 1, detail: 'claim not found' };
  const positions = Object.entries(c.positions);
  if (positions.length < 2) return { divergence: 0.5, detail: 'insufficient positions' };
  // Divergence = weighted stancel + confidence disagreement
  const stances = positions.map(([, p]) => p.stance);
  const unanimous = stances.every((s) => s === stances[0]);
  const confSpread = Math.max(...positions.map(([, p]) => p.confidence)) - Math.min(...positions.map(([, p]) => p.confidence));
  const divergence = unanimous ? confSpread * 0.5 : 0.5 + confSpread * 0.5;
  return {
    divergence: Math.round(divergence * 1000) / 1000,
    detail: unanimous
      ? `all parties ${stances[0]} — divergence is confidence spread only (${confSpread.toFixed(2)})`
      : `stances split: ${stances.join(', ')} — genuine disagreement, not just confidence gap`,
  };
}

export function epistemicClaims(status?: EpistemicClaim['status']): EpistemicClaim[] {
  const list = load();
  return status ? list.filter((c) => c.status === status) : list;
}
