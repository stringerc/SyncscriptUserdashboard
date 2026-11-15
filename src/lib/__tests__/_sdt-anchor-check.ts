import { validateEstimator } from '../metacognitive-sdt';
let bad = 0;
for (const c of validateEstimator()) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}\n      ${c.detail}`);
  if (!c.pass) bad++;
}
console.log(bad === 0 ? '\nEstimator validated.' : `\n${bad} anchor(s) failed.`);
process.exitCode = bad === 0 ? 0 : 1;
