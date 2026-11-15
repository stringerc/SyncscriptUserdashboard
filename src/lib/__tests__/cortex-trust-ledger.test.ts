import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCortexTrustLedger,
  isTrustEnabled,
  setTrustEnabled,
  GRADUATION_CLEAN_REQUIRED,
  GRADUATION_TOTAL_REQUIRED,
} from '../cortex-trust-ledger';

const ledger = () => getCortexTrustLedger();

beforeEach(() => {
  ledger().clear();
  setTrustEnabled(false);
});

function runSuccesses(domain: string, n: number, tier: 0 | 1 | 2 = 1) {
  for (let i = 0; i < n; i++) ledger().recordExecution(domain, tier, true, `run ${i}`);
}

describe('trust ledger graduation math', () => {
  it('does not graduate below clean threshold', () => {
    runSuccesses('git_checkpoint', GRADUATION_CLEAN_REQUIRED - 1);
    // total >= 15 needed too — push total up with failures resetting clean
    const e = ledger().getDomain('git_checkpoint')!;
    expect(e.cleanExecutes).toBe(GRADUATION_CLEAN_REQUIRED - 1);
    expect(ledger().isDomainGraduated(e)).toBe(false);
  });

  it('graduates at exactly 10 clean / 15 total with no recent failure', () => {
    // 5 failures interleaved early, then 10 consecutive clean = 15 total
    for (let i = 0; i < 5; i++) ledger().recordExecution('email_draft', 1, false, 'early failure');
    runSuccesses('email_draft', GRADUATION_CLEAN_REQUIRED);
    const e = ledger().getDomain('email_draft')!;
    expect(e.totalExecutes).toBe(GRADUATION_TOTAL_REQUIRED);
    expect(e.cleanExecutes).toBe(GRADUATION_CLEAN_REQUIRED);
    // lastFailure is within 30d → NOT graduated yet per spec
    expect(ledger().isDomainGraduated(e)).toBe(false);
  });

  it('failure resets cleanExecutes to zero', () => {
    runSuccesses('domain_x', 8);
    ledger().recordExecution('domain_x', 1, false, 'boom');
    const e = ledger().getDomain('domain_x')!;
    expect(e.cleanExecutes).toBe(0);
    expect(e.lastFailure?.reason).toBe('boom');
    expect(e.totalExecutes).toBe(9);
  });

  it('tier-2 domains never auto-execute even with perfect record', () => {
    setTrustEnabled(true);
    runSuccesses('gmail_send', 20, 2);
    const e = ledger().getDomain('gmail_send')!;
    expect(e.tier).toBe(2);
    expect(ledger().isAutoAllowed('gmail_send', 2)).toBe(false);
    expect(ledger().isDomainGraduated(e)).toBe(false);
  });

  it('isAutoAllowed requires the feature flag', () => {
    // Build a graduated-looking entry manually via many successes + aged failure
    runSuccesses('calendar_hold', 15);
    const e = ledger().getDomain('calendar_hold')!;
    // no failures → graduated
    expect(ledger().isDomainGraduated(e)).toBe(true);
    expect(isTrustEnabled()).toBe(false);
    expect(ledger().isAutoAllowed('calendar_hold', 1)).toBe(false);
    setTrustEnabled(true);
    expect(ledger().isAutoAllowed('calendar_hold', 1)).toBe(true);
  });

  it('revocation is instant and blocks auto-execution', () => {
    setTrustEnabled(true);
    runSuccesses('git_checkpoint', 15);
    expect(ledger().isAutoAllowed('git_checkpoint', 1)).toBe(true);
    expect(ledger().revoke('git_checkpoint', 'user said stop')).toBe(true);
    expect(ledger().isAutoAllowed('git_checkpoint', 1)).toBe(false);
    const audit = ledger().getAudit(10);
    expect(audit.some(a => a.outcome === 'revoked' && a.domain === 'git_checkpoint')).toBe(true);
    expect(ledger().reinstate('git_checkpoint')).toBe(true);
    // reinstate clears revokedAt but cleanExecutes was reset → not graduated
    expect(ledger().isAutoAllowed('git_checkpoint', 1)).toBe(false);
  });

  it('writes audit entries for every outcome', () => {
    runSuccesses('web_search', 3);
    ledger().recordExecution('web_search', 1, false, 'timeout');
    const audit = ledger().getAudit(20);
    expect(audit.filter(a => a.outcome === 'success')).toHaveLength(3);
    expect(audit.some(a => a.outcome === 'failure')).toBe(true);
  });
});
