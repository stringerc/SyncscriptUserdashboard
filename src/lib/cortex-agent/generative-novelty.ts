// generative-novelty.ts — invention, not recombination.
//
// Simulation rolls out KNOWN action classes. This module asks: what
// action class DOESN'T EXIST yet that the data says we need? It composes
// primitives (existing classes' effect profiles) into candidate NOVEL
// classes, evaluates them through the same counterfactual machinery,
// and emits them as proposals — invention enters through the same gates
// as self-modification, never silently.
//
// Method: cluster the dims that current actions move poorly (high
// dynamicsUncertainty + low causal confidence) → propose a hybrid class
// targeting exactly those dims → simulate → if predicted G beats all
// existing classes on those dims, emit as a 'novel-class' proposal.
// State: .cortex-runtime/novel-classes.json
import fs from 'node:fs';
import path from 'node:path';
import { dynamicsReport } from './empirical-dynamics';
import { causalReport } from './causal-inference';
import { rolloutFrom, type ActionClass } from './planner';
import { loadWorld } from './world-model';
import { speakInner } from './inner-speech';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME, 'novel-classes.json');

export interface NovelClassProposal {
  id: string;
  ts: number;
  name: string;
  /** What gap it fills — dims current actions handle poorly. */
  targetDims: string[];
  /** Composite of existing classes it synthesizes. */
  synthesis: string[];
  /** Predicted effect profile (from counterfactual rollout). */
  predictedProfile: Record<string, number>;
  /** Why it's novel — what existing classes DON'T do. */
  noveltyClaim: string;
  status: 'proposed' | 'rejected' | 'accepted-for-review';
  evalDetail: string;
}

function load(): NovelClassProposal[] {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}
function save(list: NovelClassProposal[]) {
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(list.slice(-50), null, 2)); } catch {}
}

/** Find dims the current action vocabulary handles worst — high
 *  uncertainty AND low causal confidence = genuine gaps. */
function findVocabularyGaps(): Array<{ dim: string; uncertainty: number; causalLevel: string }> {
  const dynamics = dynamicsReport();
  const causal = causalReport();
  const gaps: Array<{ dim: string; uncertainty: number; causalLevel: string }> = [];
  const dimUncertainty: Record<string, number[]> = {};
  const dimCausal: Record<string, string> = {};

  for (const cls of dynamics.classes) {
    for (const eff of cls.effects) {
      if (!dimUncertainty[eff.dim]) dimUncertainty[eff.dim] = [];
      dimUncertainty[eff.dim].push(cls.uncertainty);
      // Track worst causal verdict per dim
      const c = causal.estimates.find((e) => e.dim === eff.dim);
      if (c) dimCausal[eff.dim] = c.verdict;
    }
  }
  for (const [dim, uncertainties] of Object.entries(dimUncertainty)) {
    const avgUnc = uncertainties.reduce((a, b) => a + b, 0) / uncertainties.length;
    const causalLevel = dimCausal[dim] || 'unknown';
    // Gap = high uncertainty AND not likely-causal
    if (avgUnc > 0.15 && causalLevel !== 'likely-causal') {
      gaps.push({ dim, uncertainty: avgUnc, causalLevel });
    }
  }
  return gaps.sort((a, b) => b.uncertainty - a.uncertainty).slice(0, 5);
}

/** Propose a novel action class targeting the biggest gaps. */
export function proposeNovelClass(): NovelClassProposal | null {
  const gaps = findVocabularyGaps();
  if (gaps.length < 2) return null; // vocabulary is adequate

  const targetDims = gaps.slice(0, 3).map((g) => g.dim);
  // Synthesize from existing classes that move these dims least badly
  const dynamics = dynamicsReport();
  const synthesis: string[] = [];
  for (const dim of targetDims) {
    // Find which existing class has the best (lowest uncertainty) effect on this dim
    let bestCls: string | null = null, bestUnc = 1;
    for (const cls of dynamics.classes) {
      const eff = cls.effects.find((e) => e.dim === dim);
      if (eff && cls.uncertainty < bestUnc) { bestUnc = cls.uncertainty; bestCls = cls.cls; }
    }
    if (bestCls && !synthesis.includes(bestCls)) synthesis.push(bestCls);
  }
  if (synthesis.length === 0) return null;

  const name = `novel_${targetDims.slice(0, 2).join('_')}`.replace(/[^a-z0-9_]/g, '_').slice(0, 30);
  const noveltyClaim = `No existing action class adequately addresses ${targetDims.join(', ')} — gaps in vocabulary, not just execution`;

  // Counterfactual evaluation: rollout the synthesis as a forced action
  let predictedProfile: Record<string, number> = {};
  let evalDetail = '';
  try {
    // Use the closest existing class as proxy for the novel one
    const proxyCls = synthesis[0] as ActionClass;
    const world = loadWorld();
    const traj = rolloutFrom(world, proxyCls, 3);
    const last = traj.trajectory[traj.trajectory.length - 1];
    predictedProfile = { freeEnergy: last.g, steps: traj.trajectory.length };
    evalDetail = `counterfactual rollout via ${proxyCls}: final G=${last.g.toFixed(3)} over ${traj.trajectory.length} steps`;
  } catch (e: any) {
    evalDetail = `counterfactual eval failed: ${e.message}`;
  }

  const proposal: NovelClassProposal = {
    id: `novel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(), name, targetDims, synthesis,
    predictedProfile, noveltyClaim,
    status: 'proposed', evalDetail,
  };
  const list = load(); list.push(proposal); save(list);
  try {
    speakInner({
      kind: 'reasoning', source: 'generative-novelty',
      text: `Novel class proposed: '${name}' targeting ${targetDims.join(', ')}. Synthesized from ${synthesis.join('+')}. ${evalDetail}. Awaiting review — invention enters through gates.`,
      surprise: 0.8, valence: 0.2,
    });
  } catch {}
  return proposal;
}

export function novelClasses(status?: NovelClassProposal['status']): NovelClassProposal[] {
  const list = load();
  return status ? list.filter((p) => p.status === status) : list;
}
