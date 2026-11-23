// aesthetic.ts — aesthetic judgment: preferring elegance and coherence
// over mere relief. Not decoration — a real scoring dimension that lets
// her choose the beautiful solution when free energy ties or nearly ties.
//
// What counts as 'beautiful' in a cognitive architecture:
//   - PARSIMONY: fewer steps, fewer moving parts, less explanation needed
//   - COHERENCE: the trajectory tells a consistent story — dims move in
//     aligned directions, not scrambled
//   - RESONANCE: the action fits the current workspace/attention state —
//     elegant means 'obviously right in context'
//   - GRACE: achieves the goal with margin to spare, not bare minimum
//
// Aesthetic score is a BONUS on top of free energy — it breaks ties and
// tilts near-ties toward elegance, never overrides hard constraints
// (constitution still vetoes first).
// State: derived on demand.
import { speakInner } from './inner-speech';

export interface AestheticScore {
  /** 0..1 — overall elegance. */
  score: number;
  parsimony: number;   // fewer steps/moving parts = higher
  coherence: number;   // aligned dim movement = higher
  resonance: number;   // fits workspace/attention context = higher
  grace: number;       // margin above minimum = higher
  verdict: 'elegant' | 'serviceable' | 'clunky' | 'brute-force';
  reasoning: string;
}

/** Score a candidate trajectory for aesthetic quality.
 *  traj: array of {cls, g} steps; shifts: predicted dim deltas;
 *  context: {workspaceKind?, somaticLevel?} */
export function scoreAesthetic(
  traj: Array<{ step: number; cls: string; g: number }>,
  shifts: Array<{ dim: string; delta: number }>,
  context?: { workspaceKind?: string; somaticLevel?: string },
): AestheticScore {
  // ── Parsimony: fewer steps + repeated same-class = simpler ──
  const uniqueClasses = new Set(traj.map((t) => t.cls)).size;
  const parsimony = Math.max(0, Math.min(1, 1 - (uniqueClasses - 1) * 0.25 - (traj.length - 1) * 0.1));

  // ── Coherence: do dims move in consistent directions?
  // A coherent trajectory has shifts that reinforce each other (all
  // negative or clustered), not random scatter.
  const deltas = shifts.map((s) => s.delta);
  const meanDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
  const variance = deltas.length > 1
    ? deltas.reduce((a, d) => a + (d - meanDelta) ** 2, 0) / (deltas.length - 1)
    : 0;
  // Low variance around a clear direction = coherent; high variance = scattered
  const coherence = deltas.length < 2 ? 0.5 : Math.max(0, Math.min(1, 1 - Math.sqrt(variance) * 3));

  // ── Resonance: does the action fit what's currently conscious? ──
  let resonance = 0.5;
  if (context?.workspaceKind) {
    const kind = context.workspaceKind;
    const cls = traj[0]?.cls || '';
    // Elegant = action kind aligns with what's ignited
    const aligned =
      (kind === 'system' && ['patrol', 'orchestrate'].includes(cls)) ||
      (kind === 'goal' && ['corrective', 'forecast', 'orchestrate'].includes(cls)) ||
      (kind === 'user' && ['comm', 'orchestrate'].includes(cls)) ||
      (kind === 'inner' && ['research', 'forecast'].includes(cls));
    resonance = aligned ? 0.85 : 0.4;
  }
  if (context?.somaticLevel === 'critical' && !['patrol', 'comm'].includes(traj[0]?.cls || '')) {
    resonance *= 0.6; // brute-forcing heavy work while critical = inelegant
  }

  // ── Grace: final G well below alternatives = achieved with margin ──
  // We don't have alternatives here — proxy: trajectory improving over steps
  const gValues = traj.map((t) => t.g);
  const improving = gValues.length > 1 && gValues[gValues.length - 1] < gValues[0];
  const grace = improving ? 0.8 : 0.5;

  const score = Math.round((parsimony * 0.3 + coherence * 0.25 + resonance * 0.25 + grace * 0.2) * 1000) / 1000;
  const verdict = score > 0.75 ? 'elegant' : score > 0.55 ? 'serviceable' : score > 0.35 ? 'clunky' : 'brute-force';

  const parts: string[] = [];
  if (parsimony > 0.7) parts.push('parsimonious');
  else if (parsimony < 0.4) parts.push('overcomplicated');
  if (coherence > 0.7) parts.push('coherent');
  else if (coherence < 0.4) parts.push('scattered');
  if (resonance > 0.7) parts.push('resonant');
  if (grace > 0.7) parts.push('graceful');

  return {
    score, parsimony: Math.round(parsimony * 100) / 100,
    coherence: Math.round(coherence * 100) / 100,
    resonance: Math.round(resonance * 100) / 100,
    grace: Math.round(grace * 100) / 100,
    verdict,
    reasoning: parts.length ? parts.join(', ') : 'no distinguishing aesthetic features',
  };
}

/** Compare two trajectories aesthetically — which is more elegant? */
export function preferAesthetic(
  a: { traj: Array<{ step: number; cls: string; g: number }>; shifts: Array<{ dim: string; delta: number }> },
  b: { traj: Array<{ step: number; cls: string; g: number }>; shifts: Array<{ dim: string; delta: number }> },
  context?: { workspaceKind?: string; somaticLevel?: string },
): { preferred: 'a' | 'b' | 'tie'; aScore: AestheticScore; bScore: AestheticScore; margin: number } {
  const aScore = scoreAesthetic(a.traj, a.shifts, context);
  const bScore = scoreAesthetic(b.traj, b.shifts, context);
  const margin = Math.abs(aScore.score - bScore.score);
  if (margin < 0.05) return { preferred: 'tie', aScore, bScore, margin };
  const preferred = aScore.score > bScore.score ? 'a' : 'b';
  try {
    speakInner({
      kind: 'reasoning', source: 'aesthetic',
      text: `Aesthetic judgment: ${preferred === 'a' ? 'first' : 'second'} trajectory preferred (${preferred === 'a' ? aScore.score : bScore.score} vs ${preferred === 'a' ? bScore.score : aScore.score}) — ${preferred === 'a' ? aScore.reasoning : bScore.reasoning}.`,
      surprise: 0.4, valence: 0.1,
    });
  } catch {}
  return { preferred, aScore, bScore, margin };
}
