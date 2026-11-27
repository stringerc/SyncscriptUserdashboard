import { describe, it, expect, beforeEach } from 'vitest';
import { stampTaskGoal, matchGoalForTaskText } from './goal-linker';
import { getCortexGoals } from '../cortex-goals';

const goals = () => getCortexGoals();

beforeEach(() => {
  goals().clear();
  goals().declare({ title: 'Get custody of my daughter back', horizon: 'life' });
  goals().declare({ title: 'Launch SyncScript to paying customers', horizon: 'quarter' });
});

const custodyGoal = () => goals().list('active').find((g) => /custody/i.test(g.title))!;
const launchGoal = () => goals().list('active').find((g) => /launch/i.test(g.title))!;

describe('stampTaskGoal topic attribution', () => {
  it('routes custody-topic work to the custody goal, not the primary', () => {
    const out = stampTaskGoal({ kind: 'research', title: 'Gather continuance case law for bench trial hearing' });
    expect(out.goalId).toBe(custodyGoal().id);
  });

  it('routes legal-filing work to custody', () => {
    const out = stampTaskGoal({ kind: 'orchestrate', title: 'Draft affidavit for custody hearing exhibit list' });
    expect(out.goalId).toBe(custodyGoal().id);
  });

  it('routes launch-topic work to the launch goal', () => {
    const out = stampTaskGoal({ kind: 'build', title: 'Publish products #1-3 on Gumroad' });
    expect(out.goalId).toBe(launchGoal().id);
  });

  it('falls back to the primary goal for neutral work', () => {
    const out = stampTaskGoal({ kind: 'patrol', title: 'Cortex patrol — boot sweep' });
    expect(out.goalId).toBe(launchGoal().id); // launchish = primary
  });

  it('never overwrites an explicit goalId', () => {
    const out = stampTaskGoal({ kind: 'research', title: 'custody hearing prep', goalId: 'goal-explicit' });
    expect(out.goalId).toBe('goal-explicit');
  });

  it('matchGoalForTaskText returns null on no topic match', () => {
    expect(matchGoalForTaskText('take out the trash')).toBeNull();
  });
});
