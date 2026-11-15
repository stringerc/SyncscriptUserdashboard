import { describe, expect, it } from 'vitest';
import {
  multiScaleGeometry,
  freeEnergyEscapeTime,
  forecastEscapeUnderLoad,
} from '../epistemic-fractal-scale';
import {
  buildClaimGraph,
  contradictionDensityFromCounts,
  evaluateLyapunovWindow,
  maxUpwardDeltaF,
  parseLyapunovExceptions,
  sensorFailRate,
} from '../epistemic-claim-graph';
import {
  buildEpistemicSnapshot,
  clamp01,
  computeFreeEnergy,
  computeHarmony,
  epistemicCircadianProxy,
  estimateRepairSeconds,
  gradeHarmony,
  rate,
  scoreAmbiguityMarkers,
  verifyGapFromCoverage,
} from '../epistemic-homeostasis';

describe('epistemic-homeostasis pure math', () => {
  it('clamps and forms honest rates', () => {
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
    expect(rate(0, 10)).toBe(0);
    expect(rate(5, 10)).toBe(0.5);
    expect(rate(1, 0)).toBe(0);
  });

  it('perfect plant has near-zero free energy and high harmony', () => {
    const snap = buildEpistemicSnapshot(
      {
        deadCommandRate: 0,
        missingPathRate: 0,
        unresolvedSectionRate: 0,
        plantGapRate: 0,
        ambiguityRate: 0,
        verifyCoverage: 1,
        contradictionDensity: 0,
        sensorFailRate: 0,
      },
      { circadianProxy: 1 },
    );
    expect(snap.freeEnergy).toBe(0);
    expect(snap.harmony).toBe(1);
    expect(snap.graded).toBe('harmony');
  });

  it('dead commands dominate free energy (wrong-instruction toxicity)', () => {
    const deadHeavy = computeFreeEnergy({
      deadCommandRate: 1,
      missingPathRate: 0,
      unresolvedSectionRate: 0,
      plantGapRate: 0,
      ambiguityRate: 0,
      verifyCoverage: 1,
    });
    const mildAmbiguity = computeFreeEnergy({
      deadCommandRate: 0,
      missingPathRate: 0,
      unresolvedSectionRate: 0,
      plantGapRate: 0,
      ambiguityRate: 1,
      verifyCoverage: 1,
    });
    expect(deadHeavy).toBeGreaterThan(mildAmbiguity);
    expect(deadHeavy).toBeGreaterThan(0.2);
  });

  it('contradiction and sensor fail increase free energy', () => {
    const base = computeFreeEnergy({
      deadCommandRate: 0,
      missingPathRate: 0,
      unresolvedSectionRate: 0,
      plantGapRate: 0,
      ambiguityRate: 0,
      verifyCoverage: 1,
      contradictionDensity: 0,
      sensorFailRate: 0,
    });
    const withConflict = computeFreeEnergy({
      deadCommandRate: 0,
      missingPathRate: 0,
      unresolvedSectionRate: 0,
      plantGapRate: 0,
      ambiguityRate: 0,
      verifyCoverage: 1,
      contradictionDensity: 1,
      sensorFailRate: 0,
    });
    const withSensor = computeFreeEnergy({
      deadCommandRate: 0,
      missingPathRate: 0,
      unresolvedSectionRate: 0,
      plantGapRate: 0,
      ambiguityRate: 0,
      verifyCoverage: 1,
      contradictionDensity: 0,
      sensorFailRate: 1,
    });
    expect(withConflict).toBeGreaterThan(base);
    expect(withSensor).toBeGreaterThan(base);
  });

  it('verify coverage reduces free energy', () => {
    const noVerify = computeFreeEnergy({
      deadCommandRate: 0,
      missingPathRate: 0,
      unresolvedSectionRate: 0,
      plantGapRate: 0,
      ambiguityRate: 0,
      verifyCoverage: 0,
    });
    const fullVerify = computeFreeEnergy({
      deadCommandRate: 0,
      missingPathRate: 0,
      unresolvedSectionRate: 0,
      plantGapRate: 0,
      ambiguityRate: 0,
      verifyCoverage: 1,
    });
    expect(noVerify).toBeGreaterThan(fullVerify);
    expect(verifyGapFromCoverage(0)).toBe(1);
    expect(verifyGapFromCoverage(1)).toBe(0);
  });

  it('harmony multiplies (1-F) by circadian proxy — no parallel harmonic algebra', () => {
    expect(computeHarmony(0, 1)).toBe(1);
    expect(computeHarmony(0.5, 1)).toBe(0.5);
    expect(computeHarmony(0, 0.5)).toBe(0.5);
    expect(gradeHarmony(0.9)).toBe('harmony');
    expect(gradeHarmony(0.4)).toBe('entropic');
  });

  it('circadian proxy is bounded and higher by day than deep night', () => {
    const day = epistemicCircadianProxy(14);
    const night = epistemicCircadianProxy(3);
    expect(day).toBeGreaterThan(night);
    expect(day).toBeLessThanOrEqual(1);
    expect(night).toBeGreaterThan(0.5);
  });

  it('ambiguity markers are soft, not total free energy', () => {
    const text = [
      '- operators must restart the proxy without any date',
      '- this contradicts that other note',
      '- TODO finish this',
    ].join('\n');
    const a = scoreAmbiguityMarkers(text);
    expect(a.conflictHits).toBeGreaterThan(0);
    expect(a.openLoopHits).toBeGreaterThan(0);
    expect(a.ambiguityRate).toBeGreaterThan(0);
    expect(a.ambiguityRate).toBeLessThan(1);
  });

  it('repair estimate only when free energy fell', () => {
    expect(estimateRepairSeconds(0.1, 0.4, 1000)).toBe(300);
    expect(estimateRepairSeconds(0.4, 0.1)).toBeNull();
  });
});

describe('epistemic claim graph', () => {
  it('detects assert vs forbid on same proxy subject', () => {
    const text = [
      '- The canonical free-claude-code proxy port must be 8082 under launchd ownership.',
      '- Do not point Claude Code ANTHROPIC_BASE_URL at free-claude-code proxy port 8082 under launchd.',
    ].join('\n');
    const g = buildClaimGraph([{ source: 't', text }]);
    expect(g.claimCount).toBeGreaterThanOrEqual(2);
    expect(g.conflictCount).toBeGreaterThanOrEqual(1);
    expect(g.contradictionDensity).toBeGreaterThan(0);
  });

  it('does not invent conflicts across unrelated topics', () => {
    const text = [
      '- Nexus phone Twilio must return TwiML HTTP 200 for the primary webhook.',
      '- Dashboard calendar infinite strip must keep centerDate refreshed on range change.',
    ].join('\n');
    const g = buildClaimGraph([{ source: 't', text }]);
    expect(g.conflictCount).toBe(0);
  });

  it('density scales with conflict / claim ratio', () => {
    expect(contradictionDensityFromCounts(0, 100)).toBe(0);
    expect(contradictionDensityFromCounts(5, 100)).toBe(0.1);
    expect(contradictionDensityFromCounts(50, 100)).toBe(1);
  });

  it('historical lines do not form conflicts', () => {
    const text = [
      '- (historical) Never use port 8085 as canonical after migration — superseded.',
      '- The canonical free-claude-code proxy port must be 8082 under launchd.',
    ].join('\n');
    const g = buildClaimGraph([{ source: 't', text }]);
    // historical node excluded from edge formation
    expect(g.conflictCount).toBe(0);
  });

  it('resolved forensics and complementary ownership do not count as conflicts', () => {
    const text = [
      '- Prefer launchd ownership of free-claude-code on port 8082 — do not spawn a rival process.',
      '- Lane vars must match free-claude-code proxy .env on port 8082 under launchd.',
      '- NIM stream hang root-caused and fixed: do not set that broken model as sole primary for Claude stream.',
      '- **Fixed:** reliability may demote a provider; it must not rewrite operator intent for proxy+fcc quota.',
    ].join('\n');
    const g = buildClaimGraph([{ source: 't', text }]);
    expect(g.conflictCount).toBe(0);
  });

  it('strips outcome English so "do not crash" is not a forbid', () => {
    const text = [
      '- Proxy SSE ping was added so NIM quiet streams do not crash mid-stream during Claude tools.',
      '- Claude lanes must always point ANTHROPIC_BASE_URL at the free-claude-code proxy port 8082.',
    ].join('\n');
    const g = buildClaimGraph([{ source: 't', text }]);
    expect(g.conflictCount).toBe(0);
  });

  it('does not treat "not always" or "no deploy required" as assert force', () => {
    const text = [
      '- Calendar index 7 is centerDate, not always today, and scrollHeight clamped scrollTop to 0; npm run deploy:vercel:prod was unrelated.',
      '- Client tts_rum uses /api/ai/tts; Vercel Hobby cannot schedule sub-daily crons so use GH workflows; npm run deploy:vercel:prod ships the handler.',
      '- Keep 8880 on loopback for Kokoro TTS; do not expose raw :8880 publicly when Vercel uses KOKORO_TTS_URL.',
      '- Production should use named tunnel EC2 for Kokoro — Quick Tunnel breaks without a redeploy (no code deploy required for it to fail).',
    ].join('\n');
    const g = buildClaimGraph([{ source: 't', text }]);
    expect(g.conflictCount).toBe(0);
  });
});

describe('lyapunov window + sensors', () => {
  it('computes max upward ΔF in window', () => {
    const t0 = 1_000_000;
    const samples = [
      { t: t0, F: 0.05 },
      { t: t0 + 3600_000, F: 0.06 },
      { t: t0 + 7200_000, F: 0.2 },
    ];
    const { maxUp, pair } = maxUpwardDeltaF(samples, 24 * 3600_000);
    expect(maxUp).toBeCloseTo(0.15, 5);
    expect(pair?.dF).toBeCloseTo(0.15, 5);
  });

  it('breach when ΔF exceeds limit without exception', () => {
    const t0 = Date.now() - 3600_000;
    const hist = [{ t: t0, F: 0.01 }];
    const r = evaluateLyapunovWindow(hist, 0.15, Date.now(), {
      maxUpDelta: 0.08,
      exceptionActive: false,
    });
    expect(r.breach).toBe(true);
    expect(r.maxUpDelta).toBeGreaterThan(0.08);
  });

  it('exception suppresses Lyapunov breach', () => {
    const t0 = Date.now() - 3600_000;
    const hist = [{ t: t0, F: 0.01 }];
    const r = evaluateLyapunovWindow(hist, 0.2, Date.now(), {
      maxUpDelta: 0.08,
      exceptionActive: true,
    });
    expect(r.breach).toBe(false);
    expect(r.exceptionActive).toBe(true);
  });

  it('parses HTML exception comments', () => {
    const until = new Date(Date.now() + 86400_000).toISOString();
    const md = `<!-- epistemic-lyapunov-exception until=${until} reason="seeded measurement" -->`;
    const p = parseLyapunovExceptions(md, Date.now());
    expect(p.active).toBe(true);
  });

  it('sensor fail rate ignores unknown; counts fail', () => {
    expect(sensorFailRate([{ id: 'a', status: 'unknown' }])).toBe(0);
    expect(
      sensorFailRate([
        { id: 'a', status: 'pass' },
        { id: 'b', status: 'fail' },
      ]),
    ).toBe(0.5);
  });
});

describe('multi-scale fractal geometry (Mandelbrot-boundary analogue)', () => {
  it('identical scales ⇒ high self-similarity, interior regime', () => {
    const g = multiScaleGeometry([
      { name: 'hot', freeEnergy: 0.02 },
      { name: 'spine', freeEnergy: 0.02 },
      { name: 'full', freeEnergy: 0.02 },
      { name: 'receipts', freeEnergy: 0.02 },
    ]);
    expect(g.selfSimilarity).toBeGreaterThan(0.95);
    expect(g.boundaryIndex).toBeLessThan(0.1);
    expect(g.regime).toBe('interior');
  });

  it('scale mismatch ⇒ boundary regime', () => {
    const g = multiScaleGeometry([
      { name: 'hot', freeEnergy: 0.02 },
      { name: 'spine', freeEnergy: 0.03 },
      { name: 'full', freeEnergy: 0.04 },
      { name: 'receipts', freeEnergy: 0.2 },
    ]);
    expect(g.regime).toBe('boundary');
    expect(g.criticalScale).toBe('receipts');
    expect(g.boundaryIndex).toBeGreaterThan(0.3);
  });

  it('high F on any scale ⇒ escape regime', () => {
    const g = multiScaleGeometry([
      { name: 'hot', freeEnergy: 0.3 },
      { name: 'full', freeEnergy: 0.05 },
    ]);
    expect(g.regime).toBe('escape');
    expect(g.criticalScale).toBe('hot');
  });

  it('escape-time counts bounded history', () => {
    const e = freeEnergyEscapeTime([0.01, 0.02, 0.03], 0.04, { escapeThreshold: 0.25 });
    expect(e.escaped).toBe(false);
    expect(e.iterations).toBe(4);
  });

  it('escape-time resets after crossing threshold', () => {
    const e = freeEnergyEscapeTime([0.01, 0.3, 0.02], 0.03, { escapeThreshold: 0.25 });
    expect(e.iterations).toBe(2);
  });

  it('load forecast toy recurrence can escape under heavy c', () => {
    const light = forecastEscapeUnderLoad(0.05, 0.1);
    const heavy = forecastEscapeUnderLoad(0.85, 1);
    expect(light.escaped).toBe(false);
    expect(heavy.escaped).toBe(true);
  });
});
