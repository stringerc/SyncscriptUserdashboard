import {
  declareWorkIntention,
  updateWorkIntention,
  completeWorkIntention,
  checkForConflicts,
  getActiveWorkSummary,
  readAgentIntentions,
  writeAgentIntentions
} from './src/utils/agentCoordination.ts';

// Backup the current intentions file
const fs = require('fs');
const path = require('path');

const INTENTS_FILE = path.join(process.cwd(), 'memory', 'agent_intents.md');
let backupContent = '';

try {
  backupContent = fs.readFileSync(INTENTS_FILE, 'utf8');
} catch (e) {
  backupContent = '# Agent Intentions Registry\n\nThis file tracks active work intentions across all agent sessions to prevent conflicts and enable coordination.\n\n## Format Guidelines\n- Each agent declares intentions BEFORE starting work\n- Update status at natural breakpoints\n- Move completed intentions to the archive section\n- Include verification links/evidence when marking complete\n\n## Active Intentions (Updated: [timestamp]\n\n*No active intentions logged yet. First agent to work should declare intentions here.*\n\n## Archived Intentions\n\n*Completed or expired intentions move here for historical reference*\n\n---\n*Last cleaned: [date] - Older than 24h intentions moved to archive unless marked long-running*';
}

// Reset to a known state
const resetContent = `# Agent Intentions Registry

This file tracks active work intentions across all agent sessions to prevent conflicts and enable coordination.

## Format Guidelines
- Each agent declares intentions BEFORE starting work
- Update status at natural breakpoints
- Move completed intentions to the archive section
- Include verification links/evidence when marking complete

## Active Intentions (Updated: 2026-06-04T00:00:00.000Z)

*No active intentions logged yet. First agent to work should declare intentions here.*

## Archived Intentions

*Completed or expired intentions move here for historical reference*

---
*Last cleaned: 2026-06-04 - Older than 24h intentions moved to archive unless marked long-running*`;

fs.writeFileSync(INTENTS_FILE, resetContent, 'utf8');

console.log('=== Testing Agent Coordination System ===\n');

// Simulate Agent A: starts working on a file
console.log('1. Agent A declares intention to work on src/components/auth/LoginPage.tsx');
declareWorkIntention(
  'agent-A-001',
  'Implementing new login form validation',
  ['src/components/auth/LoginPage.tsx', 'src/contexts/AuthContext.tsx'],
  '2h'
);

console.log('   Active intentions after Agent A declaration:');
console.log(getActiveWorkSummary());

// Agent B wants to work on the same file
console.log('\n2. Agent B checks for conflicts before working on src/components/auth/LoginPage.tsx');
const conflictsB = checkForConflicts(['src/components/auth/LoginPage.tsx']);
console.log(`   Conflicts detected: ${conflictsB.hasConflicts}`);
if (conflictsB.hasConflicts) {
  console.log('   Conflict details:');
  conflictsB.conflicts.forEach(c => {
    console.log(`     - Agent ${c.agent} (status: ${c.status}) is working on: ${c.conflictingFiles.join(', ')}`);
  });
  console.log('   Agent B should wait or negotiate.');
} else {
  console.log('   No conflicts - Agent B can proceed.');
}

// Agent B decides to work on a different file instead
console.log('\n3. Agent B decides to work on a non-conflicting file: src/components/energy/EnergyRing.tsx');
declareWorkIntention(
  'agent-B-002',
  'Adding new animation to energy ring component',
  ['src/components/energy/EnergyRing.tsx', 'src/components/energy/EnergyTimeline.tsx'],
  '1h'
);

console.log('   Active intentions after Agent B declaration:');
console.log(getActiveWorkSummary());

// Agent A updates progress
console.log('\n4. Agent A updates progress on their work');
updateWorkIntention('agent-A-001', {
  status: 'in_progress',
  lastUpdate: new Date().toISOString(),
  dependencies: 'Waiting on design approval for error messages',
  blockingOthers: 'None'
});

console.log('   Active intentions after Agent A update:');
console.log(getActiveWorkSummary());

// Agent A completes work
console.log('\n5. Agent A completes work and verifies');
completeWorkIntention(
  'agent-A-001',
  'Verified: Login form validation works, all tests pass, no regressions. See commit abc123.'
);

console.log('   Active intentions after Agent A completion:');
console.log(getActiveWorkSummary());

// Now Agent B checks again for the same file Agent A was working on
console.log('\n6. Agent B checks again for conflicts on src/components/auth/LoginPage.tsx (should be clear now)');
const conflictsB2 = checkForConflicts(['src/components/auth/LoginPage.tsx']);
console.log(`   Conflicts detected: ${conflictsB2.hasConflicts}`);
if (conflictsB2.hasConflicts) {
  console.log('   Conflict details:');
  conflictsB2.conflicts.forEach(c => {
    console.log(`     - Agent ${c.agent} (status: ${c.status}) is working on: ${c.conflictingFiles.join(', ')}`);
  });
} else {
  console.log('   No conflicts - Agent B can now safely work on this file.');
}

// Show final state including archived intentions
console.log('\n7. Final state of agent intentions file:');
console.log(readAgentIntentions());

// Restore original content
fs.writeFileSync(INTENTS_FILE, backupContent, 'utf8');
console.log('\n=== Test completed. Original intentions file restored. ===');