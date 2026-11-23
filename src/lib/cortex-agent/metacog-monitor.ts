// metacog-monitor.ts — the watcher for the watcher.
//
// Every other metacognitive layer measures confidence; this one checks
// whether the confidence itself is CALIBRATED. It tracks prediction→
// outcome pairs across the whole system and flags when her inference
// is systematically overconfident or misattributed.
//
// What it watches:
//   - Simulator predictions vs actual dim deltas (was the forecast right?)
//   - Valence priors vs actual outcomes (did 'positive' actions land positive?)
//   - Attention margins vs subsequent stability (was 'decisive' actually decisive?)
//   - Self-mod/meta-arch proposals vs measured results (did changes help?)
//
// Output: calibrationDrift per domain + plain-language 'I might be wrong'
// signals with evidence. Not self-doubt — MEASURED doubt.
// State: .cortex-runtime/metacog-monitor.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { speakInner } from './inner-speech';
import { causalReport } from './causal-inference';
import { quantumCalibrationReport } from './quantum-calibration';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const LOG = path.join(RUNTIME, 'metacog-monitor.jsonl');

export interface CalibrationRecord {
  ts: number;
  domain: string;
  /** What was predicted/confident about. */
  prediction: string;
  /** What actually happened (or measurement of accuracy). */
  outcome: string;
  /** Confidence at prediction time (0..1). */
  confidence: number;
  /** Was the prediction directionally correct? */
  correct: boolean;
}

function log(entry: CalibrationRecord) {
  try {
    fs.mkdirSync(RUNTIME, { recursive: true });
    fs.appendFileSync(LOG, JSON.stringify(entry) + '\n');
    const lines = fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean);
    if (lines.length > 500) fs.writeFileSync(LOG, lines.slice(-500).join('\n') + '\n');
  } catch {}
}

export function recordCalibration(rec: Omit<CalibrationRecord, 'ts'>) {
  log({ ...rec, ts: Date.now() });
}

function readAll(): CalibrationRecord[] {
  try {
    return fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/** Calibration drift per domain: are we overconfident? Underconfident?
 *  Brier-score-style: for each confidence bucket, what fraction correct? */
export function calibrationDrift() {
  const recs = readAll();
  const byDomain: Record<string, CalibrationRecord[]> = {};
  for (const r of recs) {
    if (!byDomain[r.domain]) byDomain[r.domain] = [];
    byDomain[r.domain].push(r);
  }
  const domains: Record<string, { n: number; accuracy: number; avgConfidence: number; overconfidence: number; verdict: string }> = {};
  for (const [domain, rs] of Object.entries(byDomain)) {
    if (rs.length < 3) continue; // need minimum evidence
    const accuracy = rs.filter((r) => r.correct).length / rs.length;
    const avgConfidence = rs.reduce((a, r) => a + r.confidence, 0) / rs.length;
    const overconfidence = avgConfidence - accuracy; // positive = overconfident
    let verdict: string;
    if (overconfidence > 0.3) verdict = 'OVERCONFIDENT — predictions exceed accuracy by >30%';
    else if (overconfidence > 0.15) verdict = 'somewhat overconfident';
    else if (overconfidence < -0.2) verdict = 'UNDERCONFIDENT — could trust predictions more';
    else verdict = 'well-calibrated';
    domains[domain] = { n: rs.length, accuracy: Math.round(accuracy * 100) / 100, avgConfidence: Math.round(avgConfidence * 100) / 100, overconfidence: Math.round(overconfidence * 100) / 100, verdict };
  }
  return domains;
}

/** Active inference check: run all monitors, return what needs attention. */
export function monitorNow(): {
  drift: ReturnType<typeof calibrationDrift>;
  warnings: string[];
  quantumSummary: { avgFidelity: number; poorlyCalibrated: number } | null;
  causalSummary: { likelyCausal: number; confounded: number } | null;
} {
  const drift = calibrationDrift();
  const warnings: string[] = [];

  // Check each domain for overconfidence
  for (const [domain, d] of Object.entries(drift)) {
    if (d.overconfidence > 0.3) {
      warnings.push(`${domain}: overconfident by ${Math.round(d.overconfidence * 100)}% — accuracy ${Math.round(d.accuracy * 100)}% vs confidence ${Math.round(d.avgConfidence * 100)}%`);
    }
  }

  // Cross-check with quantum calibration — poorly calibrated beliefs
  let quantumSummary = null;
  try {
    const q = quantumCalibrationReport();
    quantumSummary = { avgFidelity: q.summary.avgFidelity, poorlyCalibrated: q.summary.poorlyCalibrated };
    if (q.summary.poorlyCalibrated > q.summary.wellGrounded) {
      warnings.push(`quantum calibration: ${q.summary.poorlyCalibrated} poorly-calibrated beliefs vs ${q.summary.wellGrounded} well-grounded`);
    }
  } catch {}

  // Cross-check with causal inference — if everything is confounded,
  // her 'learning' claims are weaker than they appear
  let causalSummary = null;
  try {
    const c = causalReport();
    causalSummary = { likelyCausal: c.summary.likelyCausal, confounded: c.summary.confounded };
    if (c.summary.confounded > c.summary.likelyCausal * 2) {
      warnings.push(`causal inference: ${c.summary.confounded} confounded vs ${c.summary.likelyCausal} likely-causal — most 'learning' is correlation`);
    }
  } catch {}

  // Narrate warnings
  if (warnings.length > 0) {
    try {
      speakInner({
        kind: 'reflection', source: 'metacog-monitor',
        text: `Metacognitive warning (${warnings.length}): ${warnings[0].slice(0, 120)}`,
        surprise: 0.7, valence: -0.15,
      });
    } catch {}
  }

  return { drift, warnings, quantumSummary, causalSummary };
}

/** Record a prediction for later calibration checking.
 *  Called by simulator/planner when they make forecasts. */
export function predictAndTrack(domain: string, prediction: string, confidence: number) {
  log({ ts: Date.now(), domain, prediction, outcome: 'pending', confidence, correct: false });
}

/** Resolve a pending prediction with the actual outcome. */
export function resolvePrediction(domain: string, prediction: string, outcome: string, wasCorrect: boolean) {
  // Find the most recent pending record for this domain+prediction
  const recs = readAll();
  const pending = [...recs].reverse().find((r) => r.domain === domain && r.prediction === prediction && r.outcome === 'pending');
  if (pending) {
    pending.outcome = outcome;
    pending.correct = wasCorrect;
    // Rewrite the log with the resolved record
    const all = recs.map((r) => r === pending ? pending : r);
    try {
      fs.writeFileSync(LOG, all.map((r) => JSON.stringify(r)).join('\n') + '\n');
    } catch {}
  }
}
