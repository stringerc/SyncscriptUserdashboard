/**
 * verify-cortex-resilience — build gate for the resilience SLOs.
 * Runs the real harness (veto races, adjudication timing, fault-line
 * replay, somatic gate, memory path, compression certification) and
 * exits non-zero on any regression. This is the "teeth" in the SLO
 * contract: verify:cortex fails if survivability slips.
 */
import { runResilienceHarness } from '../src/lib/cortex-agent/resilience';

const report = await runResilienceHarness();
console.log(`\n== resilience SLOs ==  ${report.pass ? 'ALL PASS' : 'REGRESSION'}`);
for (const s of report.slos) {
  console.log(`  ${s.pass ? 'PASS' : 'FAIL'}  ${s.name} — ${s.actual}${s.detail ? ` (${s.detail})` : ''}`);
}
if (!report.pass) {
  const failed = report.slos.filter((s) => !s.pass).map((s) => s.name).join(', ');
  console.error(`FAIL: resilience SLO regression — ${failed}`);
  process.exit(1);
}
