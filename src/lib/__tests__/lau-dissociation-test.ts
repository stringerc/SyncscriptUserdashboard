/**
 * Workspace dissociation experiment — type-1 performance vs type-2 access.
 *
 * WHAT THIS IS NOT: this is not "the Lau test," and passing it is not evidence
 * of consciousness. Taschereau-Dumouchel, Hwang, Lau & LeDoux (Neuron 2026,
 * DOI 10.1016/j.neuron.2026.04.007) argue that current paradigms conflate
 * consciousness with general information processing, and propose
 * neuropsychological dissociations as the standard. In blindsight the
 * dissociation runs between information processing and *phenomenal
 * experience*, with the second term supplied by a report that is
 * independently trusted as being about experience. Nothing here can supply
 * that term: this system's "report" is more information processing, which is
 * precisely the conflation the paper names.
 *
 * WHAT THIS IS: a quantified, capacity-matched demonstration that this
 * architecture's metacognitive sensitivity depends on global broadcast access
 * while its task performance does not. That is a functional dependency claim
 * about this bus — the same *form* as blindsight (type-1 performance
 * preserved, type-2 sensitivity destroyed), measured with meta-d′ and the
 * M-ratio, which are the instruments Maniscalco & Lau built for exactly this
 * separation. It is publishable as cognitive architecture. It is silent on
 * experience.
 *
 * DESIGN
 *
 *   Four specialists each observe a noisy sample of a latent binary signal.
 *
 *   Type-1 route (workspace-independent): the decision sums ALL evidence
 *   directly. It never reads the broadcast, so d′ should be invariant across
 *   every arm that leaves this route alone.
 *
 *   Type-2 route (workspace-dependent): confidence is read off the broadcast
 *   content. Its only access to aggregated evidence is what wins the
 *   competition, so damaging broadcast access should damage meta-d′.
 *
 * ARMS
 *
 *   intact          capacity 3, no lesion
 *   access-lesion   capacity-matched: every step of the cycle still runs
 *                   (bid collection, scoring, coalition selection, dispatch),
 *                   but the delivered content comes from the previous trial.
 *                   Compute is equal, so a difference cannot be attributed to
 *                   "the lesioned arm did less work."
 *   capacity-lesion 1 broadcast slot instead of 3. Graded prediction: partial
 *                   loss, because less of the evidence reaches the read-out.
 *   type1-via-workspace  POSITIVE CONTROL. The decision is also routed
 *                   through the decoupled broadcast, so d′ must fall. This is
 *                   what makes d′-invariance in `access-lesion` informative
 *                   rather than tautological: it proves the harness can see
 *                   type-1 damage when type-1 damage is present.
 *
 * All arms replay an identical pre-generated evidence matrix, so bootstrap
 * comparisons are paired on trial index. Seeded throughout; every number this
 * file prints is reproducible from the seed it reports.
 *
 * Run: npx tsx src/lib/__tests__/lau-dissociation-test.ts
 */

import {
  GlobalWorkspace,
  type WorkspaceBid,
  type WorkspaceBroadcast,
  type WorkspaceSpecialist,
} from '../global-workspace';
import {
  type Trial,
  fitMetaDPrime,
  gaussian,
  mulberry32,
  trialsToCounts,
  validateEstimator,
} from '../metacognitive-sdt';

// ── Parameters ─────────────────────────────────────────────────────

const SEED = 20260804;
const N_TRIALS = 1200;
const N_SPECIALISTS = 4;
const CAPACITY = 3;
const N_RATINGS = 4;
const BOOTSTRAP_ITERATIONS = 400;
/** Per-specialist evidence separation. Total d′ ≈ SEPARATION·√K / 1. */
const SEPARATION = 0.9;

// ── Stimulus generation ────────────────────────────────────────────

interface GeneratedTrial {
  signal: 0 | 1;
  /** One noisy observation per specialist. */
  evidence: number[];
}

function generateTrials(seed: number): GeneratedTrial[] {
  const rng = mulberry32(seed);
  const trials: GeneratedTrial[] = [];
  for (let i = 0; i < N_TRIALS; i++) {
    const signal: 0 | 1 = rng() < 0.5 ? 0 : 1;
    const mean = signal === 1 ? SEPARATION / 2 : -SEPARATION / 2;
    const evidence: number[] = [];
    for (let k = 0; k < N_SPECIALISTS; k++) {
      evidence.push(mean + gaussian(rng));
    }
    trials.push({ signal, evidence });
  }
  return trials;
}

// ── Specialists ────────────────────────────────────────────────────

/** Shared cursor so all specialists read the trial currently being replayed. */
interface ReplayContext {
  evidence: number[];
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/**
 * Each specialist bids its own observation. Salience rises with the absolute
 * evidence, so the strongest observations win the limited slots — which is
 * what makes broadcast content informative about the decision in the intact
 * arm.
 */
class EvidenceSpecialist implements WorkspaceSpecialist {
  readonly id: string;
  readonly name: string;
  private received = 0;

  constructor(
    private readonly index: number,
    private readonly ctx: ReplayContext,
  ) {
    this.id = `ev-${index}`;
    this.name = `Evidence channel ${index}`;
  }

  submitBid(): WorkspaceBid | null {
    const e = this.ctx.evidence[this.index];
    return {
      specialistId: this.id,
      content: { evidence: e },
      confidence: clamp01(Math.abs(e) / 2.5),
      relevance: 0.6,
      urgency: clamp01(Math.abs(e) / 3),
      topic: this.id,
      timestamp: Date.now(),
    };
  }

  receiveBroadcast(_broadcast: WorkspaceBroadcast): void {
    this.received++;
  }

  isActive(): boolean {
    return true;
  }

  getReceivedCount(): number {
    return this.received;
  }
}

// ── Read-outs ──────────────────────────────────────────────────────

/** Sum the evidence that actually reached the workspace. */
function broadcastAggregate(broadcast: WorkspaceBroadcast | null): number {
  if (!broadcast) return 0;
  let total = 0;
  for (const value of Object.values(broadcast.content)) {
    const e = (value as { evidence?: number } | undefined)?.evidence;
    if (typeof e === 'number') total += e;
  }
  return total;
}

type ArmName = 'intact' | 'access-lesion' | 'capacity-lesion' | 'type1-via-workspace';

interface RawObservation {
  stimulus: 0 | 1;
  response: 0 | 1;
  /** Evidence in favour of the response, before binning. */
  rawConfidence: number;
}

interface ArmDiagnostics {
  cycles: number;
  broadcastsDelivered: number;
  ignitions: number;
  meanCoalitionSize: number;
  decoupledBroadcasts: number;
}

function runArm(
  arm: ArmName,
  trials: GeneratedTrial[],
): { observations: RawObservation[]; diagnostics: ArmDiagnostics } {
  const ctx: ReplayContext = { evidence: trials[0].evidence };
  const workspace = new GlobalWorkspace();
  workspace.setCapacity(CAPACITY);

  for (let k = 0; k < N_SPECIALISTS; k++) {
    workspace.registerSpecialist(new EvidenceSpecialist(k, ctx));
  }

  if (arm === 'access-lesion' || arm === 'type1-via-workspace') {
    workspace.setLesioned('access');
  } else if (arm === 'capacity-lesion') {
    workspace.setLesioned('capacity');
  }

  const observations: RawObservation[] = [];
  let broadcastsDelivered = 0;
  let coalitionTotal = 0;
  let decoupled = 0;

  for (const trial of trials) {
    ctx.evidence = trial.evidence;

    const broadcast = workspace.cycle();
    if (broadcast) {
      broadcastsDelivered++;
      coalitionTotal += broadcast.winningBids.length;
      if (broadcast.decoupled) decoupled++;
    }

    const aggregate = broadcastAggregate(broadcast);

    // Type-1 decision.
    const directEvidence = trial.evidence.reduce((a, b) => a + b, 0);
    const decisionEvidence =
      arm === 'type1-via-workspace' ? aggregate : directEvidence;
    const response: 0 | 1 = decisionEvidence > 0 ? 1 : 0;

    // Type-2 read-out: evidence favouring the response, via the broadcast.
    const rawConfidence = aggregate * (response === 1 ? 1 : -1);

    observations.push({ stimulus: trial.signal, response, rawConfidence });
  }

  return {
    observations,
    diagnostics: {
      cycles: workspace.getCycleCount(),
      broadcastsDelivered,
      ignitions: workspace.getIgnitionHistory(N_TRIALS).filter((i) => i.isIgnition).length,
      meanCoalitionSize: broadcastsDelivered > 0 ? coalitionTotal / broadcastsDelivered : 0,
      decoupledBroadcasts: decoupled,
    },
  };
}

/**
 * Bin raw confidence into equally-populated ratings *within each arm*. Using
 * each arm's own quantiles removes bin-placement as a confound: a lesioned arm
 * still uses all four ratings, it just uses them uninformatively.
 */
function binByQuantile(observations: RawObservation[]): Trial[] {
  const sorted = observations.map((o) => o.rawConfidence).sort((a, b) => a - b);
  const cut = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const q = [cut(0.25), cut(0.5), cut(0.75)];

  return observations.map((o) => {
    let confidence = 1;
    if (o.rawConfidence > q[2]) confidence = 4;
    else if (o.rawConfidence > q[1]) confidence = 3;
    else if (o.rawConfidence > q[0]) confidence = 2;
    return { stimulus: o.stimulus, response: o.response, confidence };
  });
}

// ── Statistics ─────────────────────────────────────────────────────

interface ArmResult {
  arm: ArmName;
  dPrime: number;
  metaDPrime: number;
  mRatio: number;
  type2AUC: number;
  accuracy: number;
  diagnostics: ArmDiagnostics;
}

interface PairedDelta {
  /** Point estimate of intact − other. */
  estimate: number;
  lower: number;
  upper: number;
  /** True when the 95% interval excludes zero. */
  significant: boolean;
  /** True when the interval contains zero (used for equivalence claims). */
  containsZero: boolean;
  /**
   * False when either arm's estimate was degenerate. An interval around a
   * NaN point estimate is not a result, so it must not be reported as one.
   */
  applicable: boolean;
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
}

/**
 * Paired bootstrap. Both arms are resampled on the same trial indices, which
 * removes trial-level variance from the comparison.
 */
function pairedDelta(
  a: Trial[],
  b: Trial[],
  metric: (t: Trial[]) => number,
  rng: () => number,
): PairedDelta {
  const point = metric(a) - metric(b);
  const deltas: number[] = [];

  for (let it = 0; it < BOOTSTRAP_ITERATIONS; it++) {
    const idx = new Array<number>(a.length);
    for (let i = 0; i < a.length; i++) idx[i] = (rng() * a.length) | 0;
    const ra = idx.map((i) => a[i]);
    const rb = idx.map((i) => b[i]);
    const d = metric(ra) - metric(rb);
    if (Number.isFinite(d)) deltas.push(d);
  }

  const applicable = Number.isFinite(point);
  const lower = applicable ? percentile(deltas, 0.025) : NaN;
  const upper = applicable ? percentile(deltas, 0.975) : NaN;
  return {
    estimate: point,
    lower,
    upper,
    significant: applicable && ((lower > 0 && upper > 0) || (lower < 0 && upper < 0)),
    containsZero: applicable && lower <= 0 && upper >= 0,
    applicable,
  };
}

const dPrimeOf = (trials: Trial[]): number => {
  const c = trialsToCounts(trials, N_RATINGS);
  return fitMetaDPrime(c.nR_S1, c.nR_S2).dPrime;
};

const mRatioOf = (trials: Trial[]): number => {
  const c = trialsToCounts(trials, N_RATINGS);
  return fitMetaDPrime(c.nR_S1, c.nR_S2).mRatio;
};

// ── Experiment ─────────────────────────────────────────────────────

export interface DissociationReport {
  seed: number;
  trials: number;
  arms: ArmResult[];
  deltas: Record<string, { dPrime: PairedDelta; mRatio: PairedDelta }>;
  assertions: Array<{ name: string; pass: boolean; evidence: string }>;
  passed: number;
  failed: number;
  interpretation: string;
}

export function runWorkspaceDissociationExperiment(seed = SEED): DissociationReport {
  const generated = generateTrials(seed);
  const armNames: ArmName[] = ['intact', 'access-lesion', 'capacity-lesion', 'type1-via-workspace'];

  const binned = new Map<ArmName, Trial[]>();
  const arms: ArmResult[] = [];

  for (const arm of armNames) {
    const { observations, diagnostics } = runArm(arm, generated);
    const trials = binByQuantile(observations);
    binned.set(arm, trials);

    const counts = trialsToCounts(trials, N_RATINGS);
    const fit = fitMetaDPrime(counts.nR_S1, counts.nR_S2);
    const correct = trials.filter((t) => t.stimulus === t.response).length;

    arms.push({
      arm,
      dPrime: fit.dPrime,
      metaDPrime: fit.metaDPrime,
      mRatio: fit.mRatio,
      type2AUC: fit.observedType2AUC,
      accuracy: correct / trials.length,
      diagnostics,
    });
  }

  const intact = binned.get('intact')!;
  const rng = mulberry32(seed + 7);
  const deltas: DissociationReport['deltas'] = {};
  for (const arm of armNames.slice(1)) {
    deltas[arm] = {
      dPrime: pairedDelta(intact, binned.get(arm)!, dPrimeOf, rng),
      mRatio: pairedDelta(intact, binned.get(arm)!, mRatioOf, rng),
    };
  }

  // ── Assertions ───────────────────────────────────────────────────

  const assertions: DissociationReport['assertions'] = [];
  const add = (name: string, pass: boolean, evidence: string): void => {
    assertions.push({ name, pass, evidence });
  };

  for (const check of validateEstimator(seed)) {
    add(`estimator:${check.name}`, check.pass, check.detail);
  }

  const byName = (n: ArmName): ArmResult => arms.find((a) => a.arm === n)!;
  const intactArm = byName('intact');
  const accessArm = byName('access-lesion');
  const capacityArm = byName('capacity-lesion');
  const controlArm = byName('type1-via-workspace');

  add(
    'intact-type1-above-chance',
    intactArm.dPrime > 1.0,
    `d′=${intactArm.dPrime.toFixed(3)} (expect >1.0)`,
  );

  add(
    'intact-metacognition-informative',
    intactArm.mRatio > 0.3,
    `M-ratio=${intactArm.mRatio.toFixed(3)}, type-2 AUC=${intactArm.type2AUC.toFixed(3)} (expect M-ratio >0.3)`,
  );

  add(
    'access-lesion-is-compute-matched',
    accessArm.diagnostics.cycles === intactArm.diagnostics.cycles &&
      accessArm.diagnostics.decoupledBroadcasts > 0,
    `cycles ${accessArm.diagnostics.cycles} vs ${intactArm.diagnostics.cycles}, decoupled=${accessArm.diagnostics.decoupledBroadcasts}`,
  );

  // This is a design invariant being verified, not an empirical null. The
  // type-1 route is identical code in both arms, so the responses are
  // bit-identical and Δd′ is exactly 0. Its role is to guarantee that any
  // M-ratio difference cannot be attributed to a change in task performance.
  // Read it as "the isolation held," never as "the lesion spared performance."
  add(
    'access-lesion-preserves-type1-by-construction',
    deltas['access-lesion'].dPrime.containsZero,
    `Δd′=${deltas['access-lesion'].dPrime.estimate.toFixed(3)} [${deltas['access-lesion'].dPrime.lower.toFixed(3)}, ${deltas['access-lesion'].dPrime.upper.toFixed(3)}] — structural: the type-1 route never reads the broadcast, so exact zero confirms isolation rather than measuring an effect`,
  );

  add(
    'access-lesion-destroys-type2',
    deltas['access-lesion'].mRatio.lower > 0,
    `ΔM-ratio=${deltas['access-lesion'].mRatio.estimate.toFixed(3)} [${deltas['access-lesion'].mRatio.lower.toFixed(3)}, ${deltas['access-lesion'].mRatio.upper.toFixed(3)}] (expect lower bound >0)`,
  );

  add(
    'capacity-lesion-graded',
    capacityArm.mRatio > accessArm.mRatio && capacityArm.mRatio < intactArm.mRatio,
    `M-ratio: access=${accessArm.mRatio.toFixed(3)} < capacity=${capacityArm.mRatio.toFixed(3)} < intact=${intactArm.mRatio.toFixed(3)}`,
  );

  add(
    'positive-control-detects-type1-damage',
    deltas['type1-via-workspace'].dPrime.lower > 0,
    `Δd′=${deltas['type1-via-workspace'].dPrime.estimate.toFixed(3)} [${deltas['type1-via-workspace'].dPrime.lower.toFixed(3)}, ${deltas['type1-via-workspace'].dPrime.upper.toFixed(3)}] (expect lower bound >0, proving d′ CAN fall)`,
  );

  const passed = assertions.filter((a) => a.pass).length;
  const failed = assertions.length - passed;

  const dissociationHolds =
    deltas['access-lesion'].dPrime.containsZero &&
    deltas['access-lesion'].mRatio.lower > 0 &&
    deltas['type1-via-workspace'].dPrime.lower > 0;

  const interpretation = dissociationHolds
    ? [
        'DISSOCIATION OBSERVED (functional, not phenomenal).',
        `Removing broadcast correspondence left type-1 sensitivity unchanged (Δd′=${deltas['access-lesion'].dPrime.estimate.toFixed(3)}, interval spans 0)`,
        `while metacognitive sensitivity fell (ΔM-ratio=${deltas['access-lesion'].mRatio.estimate.toFixed(3)}, interval excludes 0).`,
        'Compute was matched: the lesioned arm ran the same number of cycles, collected the same bids and dispatched the same broadcasts.',
        `The positive control confirms the harness can detect type-1 damage (Δd′=${deltas['type1-via-workspace'].dPrime.estimate.toFixed(3)}), so the null result above is informative rather than insensitive.`,
        '',
        'This licenses one claim: in this architecture, metacognitive sensitivity depends on global broadcast access and task performance does not.',
        'It does not license any claim about experience. The read-out is dissociated from performance, not from phenomenality, and no available',
        'method distinguishes the two in a non-biological system (Neuron 2026).',
      ].join(' ')
    : [
        'NO DISSOCIATION.',
        `Δd′(access)=${deltas['access-lesion'].dPrime.estimate.toFixed(3)} [${deltas['access-lesion'].dPrime.lower.toFixed(3)}, ${deltas['access-lesion'].dPrime.upper.toFixed(3)}],`,
        `ΔM-ratio(access)=${deltas['access-lesion'].mRatio.estimate.toFixed(3)} [${deltas['access-lesion'].mRatio.lower.toFixed(3)}, ${deltas['access-lesion'].mRatio.upper.toFixed(3)}].`,
        'Either the lesion also damaged type-1 performance (in which case the effect reduces to less processing),',
        'or metacognitive sensitivity survived the lesion (in which case the read-out is not workspace-dependent).',
        'Report this as-is; do not tune the arms until it passes.',
      ].join(' ');

  return {
    seed,
    trials: N_TRIALS,
    arms,
    deltas,
    assertions,
    passed,
    failed,
    interpretation,
  };
}

/** Retained for older callers; delegates to the redesigned experiment. */
export function runLauDissociationTest(): DissociationReport {
  return runWorkspaceDissociationExperiment();
}

// ── CLI ────────────────────────────────────────────────────────────

const invokedDirectly = /lau-dissociation-test\.[tj]sx?$/.test(process.argv[1] ?? '');

if (invokedDirectly) {
  const r = runWorkspaceDissociationExperiment();

  console.log('════════════════════════════════════════════════════════════════');
  console.log('Workspace dissociation — type-1 performance vs type-2 access');
  console.log(`seed=${r.seed}  trials=${r.trials}  specialists=${N_SPECIALISTS}  capacity=${CAPACITY}`);
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log('Arm                    d′     meta-d′  M-ratio  type2AUC  acc    coalition  ignitions');
  for (const a of r.arms) {
    console.log(
      `${a.arm.padEnd(22)}${a.dPrime.toFixed(3).padStart(6)}${a.metaDPrime.toFixed(3).padStart(9)}` +
        `${(Number.isFinite(a.mRatio) ? a.mRatio.toFixed(3) : 'n/a').padStart(9)}` +
        `${a.type2AUC.toFixed(3).padStart(10)}${a.accuracy.toFixed(3).padStart(7)}` +
        `${a.diagnostics.meanCoalitionSize.toFixed(2).padStart(11)}${String(a.diagnostics.ignitions).padStart(11)}`,
    );
  }

  console.log('\nPaired contrasts vs intact (95% bootstrap interval):');
  for (const [arm, d] of Object.entries(r.deltas)) {
    const mRatioText = d.mRatio.applicable
      ? `ΔM-ratio=${d.mRatio.estimate.toFixed(3)} [${d.mRatio.lower.toFixed(3)}, ${d.mRatio.upper.toFixed(3)}]`
      : 'ΔM-ratio=n/a (d′ too small for a ratio in this arm)';
    console.log(
      `  ${arm.padEnd(22)} Δd′=${d.dPrime.estimate.toFixed(3)} [${d.dPrime.lower.toFixed(3)}, ${d.dPrime.upper.toFixed(3)}]   ${mRatioText}`,
    );
  }

  console.log('\nAssertions:');
  for (const a of r.assertions) {
    console.log(`  ${a.pass ? '✅' : '❌'} ${a.name}`);
    console.log(`      ${a.evidence}`);
  }

  console.log(`\n${r.passed} passed, ${r.failed} failed`);
  console.log('\n────────────────────────────────────────────────────────────────');
  console.log(r.interpretation);
  console.log('────────────────────────────────────────────────────────────────');

  process.exitCode = r.failed === 0 ? 0 : 1;
}
