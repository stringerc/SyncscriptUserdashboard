#!/usr/bin/env node
/**
 * guard-consciousness-gates — engineering invariants over the
 * Generative Attention Loop's episode memory.
 *
 * These are DELIBERATION-QUALITY gates, not consciousness proofs:
 * they assert the attention-selection loop is engaged, calibrated,
 * and not paralyzed. A pass means "the mechanism works as designed,"
 * nothing more.
 *
 *   node scripts/guard-consciousness-gates.mjs [--file <path>] [--json]
 *
 * Exit 0 = all gates pass (or insufficient data → SKIP), 1 = a gate failed.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');
const FILE = fileIdx >= 0
  ? args[fileIdx + 1]
  : path.join(process.cwd(), '.cortex-runtime', 'attention-memory.jsonl');
const JSON_OUT = args.includes('--json');

const GATES = [
  {
    id: 'episodes-present',
    desc: 'GAL has recorded deliberation episodes',
    check: (eps) => eps.length >= 1,
    detail: (eps) => `${eps.length} episodes`,
  },
  {
    id: 'veto-engaged',
    desc: 'veto mechanism is live but not paralyzing selection',
    // Vetoed candidates / total candidates. >50% means the system
    // rejects most of its own attention proposals — deliberation is stuck.
    check: (eps) => {
      const cand = eps.reduce((a, e) => a + (e.candidateCount || 0), 0);
      const vetoed = eps.reduce((a, e) => a + (e.vetoedCount || 0), 0);
      if (!cand) return true;
      const rate = vetoed / cand;
      return rate <= 0.5;
    },
    detail: (eps) => {
      const cand = eps.reduce((a, e) => a + (e.candidateCount || 0), 0);
      const vetoed = eps.reduce((a, e) => a + (e.vetoedCount || 0), 0);
      return cand ? `${(100 * vetoed / cand).toFixed(1)}% of candidates vetoed` : 'no candidates';
    },
  },
  {
    id: 'prediction-calibrated',
    desc: 'mean |predicted − actual| below 0.35 (better than prior noise)',
    check: (eps) => {
      const scored = eps.filter((e) => e.predictionError != null);
      if (!scored.length) return true;
      const mean = scored.reduce((a, e) => a + e.predictionError, 0) / scored.length;
      return mean < 0.35;
    },
    detail: (eps) => {
      const scored = eps.filter((e) => e.predictionError != null);
      if (!scored.length) return 'no scored episodes';
      const mean = scored.reduce((a, e) => a + e.predictionError, 0) / scored.length;
      return `mean abs error ${mean.toFixed(3)}`;
    },
  },
  {
    id: 'phi-recovery-bounded',
    desc: 'Φ-recovery bias fires on ≤25% of episodes (integration is stable)',
    check: (eps) => {
      if (!eps.length) return true;
      const rate = eps.filter((e) => e.phiRecovery).length / eps.length;
      return rate <= 0.25;
    },
    detail: (eps) => eps.length
      ? `${(100 * eps.filter((e) => e.phiRecovery).length / eps.length).toFixed(1)}% recovery rate`
      : 'no episodes',
  },
];

let episodes = [];
try {
  if (fs.existsSync(FILE)) {
    episodes = fs.readFileSync(FILE, 'utf8')
      .trim().split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  }
} catch (e) {
  console.error(`guard-consciousness-gates: cannot read ${FILE}: ${e.message}`);
  process.exit(1);
}

const results = GATES.map((g) => {
  let pass = false;
  let detail = '';
  try {
    pass = g.check(episodes);
    detail = g.detail(episodes);
  } catch (e) {
    detail = `gate error: ${e.message}`;
  }
  return { id: g.id, desc: g.desc, pass, detail };
});

const insufficient = episodes.length === 0;
const failed = results.filter((r) => !r.pass);

if (JSON_OUT) {
  console.log(JSON.stringify({ ok: failed.length === 0, insufficient, episodes: episodes.length, results }, null, 2));
} else {
  console.log('== guard-consciousness-gates ==');
  console.log(`episodes: ${episodes.length}${insufficient ? ' (insufficient data — gates report SKIP/pass)' : ''}`);
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}: ${r.id} — ${r.detail}`);
  }
  console.log(failed.length ? `\nFAILED: ${failed.map((f) => f.id).join(', ')}` : '\nAll gates passed.');
}

process.exit(failed.length ? 1 : 0);
