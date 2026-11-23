// second-order-tom.ts — recursive social cognition: what they think
// I think. First-order ToM (social-cognition.ts) models what agents
// believe; this models the REFLEXIVE layer — what an agent likely
// believes about MY likely response to them.
//
// "If I dispatch X to warden, warden may interpret it as Y because
// their past tasks were Z and their trust in me is T." That is
// second-order: my model of THEIR model of ME.
//
// Data: fleet minds (trust, modelError, successRate) + task archive
// (what they were actually asked) + valence priors (how it landed).
// Everything derived from real telemetry — no fabricated mind-reading.
// State: derived, nothing extra persisted.
import { trustScores } from './commitments';
import { recentValenceArc } from './valence-memory';
import { speakInner } from './inner-speech';

export interface SecondOrderMind {
  agentId: string;
  /** What they likely believe I intend/feel about recent interactions. */
  theirModelOfMe: {
    expectedValence: number;   // how they think I'll receive their work
    confidence: number;
    basis: string;
  };
  /** How they'd likely INTERPRET my next dispatch of a given kind. */
  interpretationOfMyAction: (actionKind: string) => {
    likelyReading: string;
    confidence: number;
    riskOfMisread: 'low' | 'medium' | 'high';
  };
  /** Reflexive prediction: if I do X, they think I'll do Y next. */
  predictedReflex: string;
}

// Heuristic interpretation tables — grounded in observed fleet behavior.
// Kept small and honest: these are priors, refined by modelError.
const ACTION_INTERPRETATIONS: Record<string, Record<string, { reading: string; risk: 'low' | 'medium' | 'high' }>> = {
  warden: {
    patrol: { reading: 'routine surveillance — expects me to trust their watch', risk: 'low' },
    research: { reading: 'they may read this as doubt in their prior findings', risk: 'medium' },
    build: { reading: 'they expect clear specs; vague briefs read as unpreparedness', risk: 'medium' },
    orchestrate: { reading: 'coordination role — they expect to be looped in early', risk: 'low' },
  },
  devin: {
    build: { reading: 'implementation work — expects a complete spec, punishes ambiguity', risk: 'low' },
    patrol: { reading: 'may interpret as micromanagement if their queue is full', risk: 'medium' },
    research: { reading: 'expects citations and verifiable claims', risk: 'low' },
  },
  scout: {
    research: { reading: 'information gathering — expects narrow, answerable questions', risk: 'low' },
    patrol: { reading: 'may see as redundant if they just scanned', risk: 'medium' },
  },
  librarian: {
    research: { reading: 'expects precise queries; vague asks get verbose answers', risk: 'low' },
    patrol: { reading: 'may interpret as checking their catalog coverage', risk: 'low' },
  },
};

export function secondOrderMind(agentId: string): SecondOrderMind {
  const trust = trustScores();
  const agentTrust = (trust.agents as any)?.[agentId] || { kept: 0, missed: 0 };
  const total = (agentTrust.kept || 0) + (agentTrust.missed || 0);
  const keptRate = total ? (agentTrust.kept || 0) / total : 0.5;

  // Their model of me: derived from whether I kept commitments to THEM
  // and the recent valence arc — how my outcomes have been landing.
  const arc = recentValenceArc(30);
  const arcMean = arc.mean;
  const theirModelOfMe = {
    expectedValence: Math.max(-1, Math.min(1, keptRate * 0.6 + arcMean * 0.4)),
    confidence: Math.min(0.9, 0.3 + total * 0.05),
    basis: total > 0
      ? `${agentTrust.kept || 0} commitments kept / ${agentTrust.missed || 0} missed to ${agentId}; valence arc ${arcMean.toFixed(2)}`
      : `no direct commitment history with ${agentId} — using global valence arc`,
  };

  const table = ACTION_INTERPRETATIONS[agentId] || {};
  const interpretationOfMyAction = (actionKind: string) => {
    const hit = table[actionKind];
    if (hit) return { likelyReading: hit.reading, confidence: 0.65, riskOfMisread: hit.risk };
    // Unknown pairing — honest low-confidence generic
    return {
      likelyReading: `${agentId} has no established interpretation pattern for ${actionKind} — assume neutral-to-cautious`,
      confidence: 0.3,
      riskOfMisread: 'medium' as const,
    };
  };

  // Reflexive: what do they expect ME to do after this?
  const predictedReflex = keptRate > 0.7
    ? `likely expects me to keep delegating — trust is high, they may take future ${agentId} work for granted`
    : keptRate < 0.3 && total > 0
      ? `likely expects me to verify their work closely — trust is thin, they may over-document`
      : `uncertain — their model of my follow-through is not yet formed`;

  return { agentId, theirModelOfMe, interpretationOfMyAction, predictedReflex };
}

/** Compare my planned action against second-order predictions —
 *  surfaces social-strategy insight into inner speech. */
export function socialStrategyCheck(agentId: string, actionKind: string, title?: string): {
  interpretation: ReturnType<SecondOrderMind['interpretationOfMyAction']>;
  theirModelOfMe: SecondOrderMind['theirModelOfMe'];
  advice: string;
} {
  const mind = secondOrderMind(agentId);
  const interp = mind.interpretationOfMyAction(actionKind);
  let advice = '';
  if (interp.riskOfMisread === 'high') {
    advice = `HIGH misread risk: ${agentId} may interpret "${title || actionKind}" as ${interp.likelyReading}. Consider clarifying intent in the dispatch.`;
  } else if (mind.theirModelOfMe.expectedValence < -0.2) {
    advice = `${agentId} likely expects a negative reception — their model of me is cold. Extra context in the brief may help.`;
  } else {
    advice = `Social read is clean: ${interp.likelyReading} (conf ${interp.confidence}).`;
  }
  try {
    speakInner({ kind: 'reasoning', source: 'second-order-tom', text: `2nd-order ToM on ${agentId}/${actionKind}: ${advice.slice(0, 140)}`, surprise: 0.4, valence: interp.riskOfMisread === 'high' ? -0.2 : 0.1 });
  } catch {}
  return { interpretation: interp, theirModelOfMe: mind.theirModelOfMe, advice };
}
