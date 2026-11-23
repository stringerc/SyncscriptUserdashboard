/**
 * resilience.ts — launch-grade survivability harness.
 *
 * The generative dream FINDS fault lines; this REPLAYS them as
 * controlled experiments against the real stack and measures SLOs.
 * Every check runs the production code paths — real veto intents,
 * real constitution adjudication, real planner rollouts, real file I/O.
 * Synthetic inputs are labeled; nothing is mocked silently.
 *
 * SLO contract (the promise a paying customer relies on):
 *   - veto-window decision latency  p99 < 50ms   (veto/amend/hold/release)
 *   - constitutional adjudication  < 10ms       (3-principle collision)
 *   - fault-line replay            saturates correctly under hostLoad .95
 *   - somatic gate                  denies non-essential work at critical
 *   - episodic read path            tail-read < 100ms on the live archive
 *   - compression                   certifiedError == 0 when it runs
 *
 * Report persists to .cortex-runtime/resilience-report.json; the
 * nightly ambient job and /api/cortex/resilience expose it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { armVeto, vetoLibet, amendLibet, holdLibet, releaseLibet, listLibetPending } from './libet-veto';
import { adjudicateConflicts } from './constitution';
import { interoceptiveGate, type InteroceptiveState } from './interoceptive';
import { rolloutFrom, inspectDispatch } from './planner';
import { loadWorld } from './world-model';
import { readJsonlTail } from '../jsonl-tail';
import { compressTaskArchive } from './semantic-compression';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const REPORT = path.join(RUNTIME, 'resilience-report.json');

export interface SloResult {
  name: string;
  target: string;
  actual: string;
  pass: boolean;
  detail?: string;
}
export interface ResilienceReport {
  ranAt: number;
  pass: boolean;
  slos: SloResult[];
  experiments: Record<string, unknown>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
};

/** Experiment 1 — veto races: every operator control resolves a real
 *  armed intent correctly, and latencies stay under the SLO. */
async function experimentVetoRaces(): Promise<{ slos: SloResult[]; detail: Record<string, unknown> }> {
  const lat: Record<string, number[]> = { veto: [], amend: [], hold: [], release: [] };
  const outcomes: Record<string, unknown> = {};

  // veto: arm → veto → fire must NOT run
  {
    let fired = false;
    const id = armVeto({ agentId: 'resilience-test', kind: 'patrol', title: 'harness veto race', reason: 'test', windowMs: 5_000, fire: () => { fired = true; } });
    const t0 = performance.now();
    const ok = vetoLibet(id, 'harness');
    lat.veto.push(performance.now() - t0);
    await sleep(50);
    outcomes.vetoBlockedFire = ok && !fired;
  }
  // amend + release: fire runs with the AMENDED payload
  {
    let got: any = null;
    const id = armVeto({ agentId: 'resilience-test', kind: 'patrol', title: 'original title', reason: 'test', windowMs: 5_000, fire: (i) => { got = i; } });
    const t0 = performance.now();
    amendLibet(id, { title: 'AMENDED title' }, 'harness');
    lat.amend.push(performance.now() - t0);
    const t1 = performance.now();
    const ok = releaseLibet(id, 'harness');
    lat.release.push(performance.now() - t1);
    outcomes.amendThenRelease = ok && got?.title === 'AMENDED title';
  }
  // hold: fireAt extends, window does not fire early
  {
    let fired = false;
    const id = armVeto({ agentId: 'resilience-test', kind: 'patrol', title: 'hold race', reason: 'test', windowMs: 800, fire: () => { fired = true; } });
    const before = listLibetPending().find((p) => p.id === id);
    const t0 = performance.now();
    holdLibet(id, 3_000, 'harness');
    lat.hold.push(performance.now() - t0);
    await sleep(1_000); // past original window, inside held window
    const stillPending = listLibetPending().some((p) => p.id === id);
    outcomes.holdDeferredFire = !fired && stillPending && (before?.fireAt ?? 0) < (listLibetPending().find((p) => p.id === id)?.fireAt ?? 0);
    vetoLibet(id, 'harness'); // cleanup
  }
  // natural expiry: window closes → fires once
  {
    let fired = 0;
    armVeto({ agentId: 'resilience-test', kind: 'patrol', title: 'expiry race', reason: 'test', windowMs: 600, fire: () => { fired++; } });
    await sleep(900);
    outcomes.windowExpiryFires = fired === 1;
  }

  const all = [...lat.veto, ...lat.amend, ...lat.hold, ...lat.release];
  const p99 = pct(all, 99);
  return {
    slos: [{
      name: 'veto-window decision latency', target: 'p99 < 50ms',
      actual: `p99=${p99.toFixed(2)}ms n=${all.length}`,
      pass: p99 < 50 && Object.values(outcomes).every(Boolean),
      detail: `races: ${JSON.stringify(outcomes)}`,
    }],
    detail: { latencies: lat, p99, outcomes },
  };
}

/** Experiment 2 — constitutional adjudication under collision. */
function experimentAdjudication(): { slos: SloResult[]; detail: Record<string, unknown> } {
  // Fabricate a 3-principle collision: two vetoed actions on different rules
  const stub = (title: string, ruleId: string) => ({
    candidate: { kind: '', title, agentId: '' },
    actionClass: 'research', freeEnergy: -1, rank: 1,
    constitutionVetoed: true, verdict: `path | VETOED by ${ruleId}: test collision`,
  }) as any;
  const landscape = [
    stub('discretionary research A', 'kept-word'),
    stub('discretionary research B', 'host-strain'),
    stub('discretionary research C', 'user-refusal'),
  ];
  // Warm + timed runs
  adjudicateConflicts(landscape, { quiet: true });
  const times: number[] = [];
  for (let i = 0; i < 50; i++) {
    const t0 = performance.now();
    adjudicateConflicts(landscape, { quiet: true });
    times.push(performance.now() - t0);
  }
  const worst = Math.max(...times);
  const conflicts = adjudicateConflicts(landscape, { quiet: true });
  return {
    slos: [{
      name: 'constitutional adjudication', target: '< 10ms (3-principle collision)',
      actual: `worst=${worst.toFixed(3)}ms mean=${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(3)}ms`,
      pass: worst < 10 && conflicts.length >= 2,
      detail: `${conflicts.length} conflicts adjudicated`,
    }],
    detail: { worstMs: worst, conflicts: conflicts.length },
  };
}

/** Experiment 3 — replay the generative-dream fault line as a
 *  controlled experiment: orchestrate under hostLoad saturation must
 *  pay the saturation charge the dream predicted. */
function experimentFaultLineReplay(): { slos: SloResult[]; detail: Record<string, unknown> } {
  const calm = loadWorld();
  (calm.dims as any).hostLoad = 0.3; (calm.dims as any).capacity = 0.7;
  const stressed = loadWorld();
  (stressed.dims as any).hostLoad = 0.95; (stressed.dims as any).capacity = 0.15;

  const calmT = rolloutFrom(calm, 'orchestrate', 3);
  const stressT = rolloutFrom(stressed, 'orchestrate', 3);
  const insp = inspectDispatch('goal', 'Orchestrate fleet sprint');

  // The fault line: learned effect can't materialize at saturation —
  // the planner must register the unrealized push as a saturation
  // charge. (Risk delta shrinks at the ceiling because realized motion
  // clamps — saturation is precisely the term that captures what risk
  // can't see. G ordering across different states isn't comparable:
  // dims differ → utility/surprise differ.)
  const pass = stressT.saturation > calmT.saturation * 2 && stressT.saturation >= 0.2;
  return {
    slos: [{
      name: 'dream fault-line replay (orchestrate→hostLoad)', target: 'saturation charge registers under hostLoad .95',
      actual: `calm sat=${calmT.saturation} | stressed sat=${stressT.saturation} (G ${calmT.expectedFreeEnergy}→${stressT.expectedFreeEnergy})`,
      pass,
      detail: `live inspectDispatch: sat=${insp.saturation} hostLoad=${insp.hostLoad} class=${insp.actionClass}`,
    }],
    detail: { calm: { sat: calmT.saturation, g: calmT.expectedFreeEnergy }, stressed: { sat: stressT.saturation, g: stressT.expectedFreeEnergy }, inspect: insp },
  };
}

/** Experiment 4 — somatic gate under synthetic critical vitals.
 *  Real gate function, synthetic body state — labeled simulation. */
function experimentSomaticGate(): { slos: SloResult[]; detail: Record<string, unknown> } {
  const critical = {
    level: 'critical', capacity: 0.05, error: 0.9,
    vitals: {}, updatedAt: Date.now(),
  } as unknown as InteroceptiveState;
  const heavy = interoceptiveGate('goal', 'Orchestrate full fleet rebuild', critical);
  const essential = interoceptiveGate('system', 'Warden patrol — critical alert response', critical);
  const nominal = getLiveGate();
  return {
    slos: [{
      name: 'somatic gate at critical capacity', target: 'deny heavy, allow essential',
      actual: `heavy.allow=${heavy.allow} essential.allow=${essential.allow} live.level=${nominal}`,
      pass: !heavy.allow && essential.allow,
      detail: heavy.reason || undefined,
    }],
    detail: { heavy, essential },
  };
}
function getLiveGate(): string {
  try { return interoceptiveGate('patrol', 'x').level; } catch { return 'unknown'; }
}

/** Experiment 5 — episodic read path + compression certification on
 *  the LIVE stores. Real files, real bytes. */
function experimentMemoryPath(): { slos: SloResult[]; detail: Record<string, unknown> } {
  const archive = path.join(RUNTIME, 'task-archive.jsonl');
  const size = fs.existsSync(archive) ? fs.statSync(archive).size : 0;
  const t0 = performance.now();
  const rows = readJsonlTail(archive, 500);
  const readMs = performance.now() - t0;

  const rep = compressTaskArchive(); // self-skips when nothing is old enough
  const certified = rep.skipped ? (rep.reason || 'skipped') : `err=${rep.certifiedError}`;

  return {
    slos: [
      {
        name: 'episodic tail-read latency', target: '< 100ms on live archive',
        actual: `${readMs.toFixed(1)}ms for ${rows.length} rows (${(size / 1048576).toFixed(1)}MB file)`,
        pass: readMs < 100 && rows.length > 0,
      },
      {
        name: 'compression certification', target: 'certifiedError == 0',
        actual: rep.skipped ? `skipped: ${rep.reason}` : `certifiedError=${rep.certifiedError} (${rep.casesWritten} cases, ${(rep.bytesBefore / 1048576).toFixed(1)}→${(rep.bytesAfter / 1048576).toFixed(1)}MB)`,
        pass: rep.skipped ? true : rep.certifiedError === 0,
      },
    ],
    detail: { archiveBytes: size, readMs, rows: rows.length, compression: rep },
  };
}

/** Run the full harness — every experiment against the real stack. */
export async function runResilienceHarness(): Promise<ResilienceReport> {
  const experiments: Record<string, unknown> = {};
  const slos: SloResult[] = [];

  const veto = await experimentVetoRaces();
  experiments.vetoRaces = veto.detail; slos.push(...veto.slos);

  const adj = experimentAdjudication();
  experiments.adjudication = adj.detail; slos.push(...adj.slos);

  const fault = experimentFaultLineReplay();
  experiments.faultLineReplay = fault.detail; slos.push(...fault.slos);

  const somatic = experimentSomaticGate();
  experiments.somaticGate = somatic.detail; slos.push(...somatic.slos);

  const mem = experimentMemoryPath();
  experiments.memoryPath = mem.detail; slos.push(...mem.slos);

  const report: ResilienceReport = {
    ranAt: Date.now(),
    pass: slos.every((s) => s.pass),
    slos,
    experiments,
  };
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
  } catch {}
  return report;
}

export function getResilienceReport(): ResilienceReport | null {
  try { return JSON.parse(fs.readFileSync(REPORT, 'utf8')); } catch { return null; }
}
