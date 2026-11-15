import {
  declareWorkIntention,
  updateWorkIntention,
  completeWorkIntention,
  checkForConflicts,
  getActiveWorkSummary
} from './src/utils/agentCoordination.ts';

// Test the agent coordination system
console.log('Testing Agent Coordination System...\n');

// Test 1: Declare work intention
console.log('Test 1: Declaring work intention');
declareWorkIntention(
  'test-session-001',
  'Implementing user authentication system',
  [
    'src/components/auth/LoginPage.tsx',
    'src/components/auth/SignupPage.tsx',
    'src/contexts/AuthContext.tsx'
  ],
  '2h'
);
console.log('✓ Work intention declared\n');

// Test 2: Check for conflicts (should be none)
console.log('Test 2: Checking for conflicts');
const conflicts = checkForConflicts(['src/components/auth/LoginPage.tsx']);
console.log(`Conflicts found: ${conflicts.hasConflicts}`);
if (conflicts.hasConflicts) {
  console.log('Conflict details:', conflicts.conflicts);
} else {
  console.log('✓ No conflicts detected\n');
}

// Test 3: Update work intention
console.log('Test 3: Updating work intention');
updateWorkIntention('test-session-001', {
  status: 'in_progress',
  lastUpdate: new Date().toISOString(),
  dependencies: 'Waiting on API endpoint design',
  blockingOthers: 'None'
});
console.log('✓ Work intention updated\n');

// Test 4: Declare another intention that should conflict
console.log('Test 4: Declaring conflicting work intention');
declareWorkIntention(
  'test-session-002',
  'Updating login form styling',
  [
    'src/components/auth/LoginPage.tsx', // This conflicts with session 001
    'src/components/auth/SignupPage.tsx'
  ],
  '1h'
);
console.log('✓ Second work intention declared\n');

// Test 5: Check for conflicts again (should find conflicts now)
console.log('Test 5: Checking for conflicts after second declaration');
const conflicts2 = checkForConflicts(['src/components/auth/LoginPage.tsx']);
console.log(`Conflicts found: ${conflicts2.hasConflicts}`);
if (conflicts2.hasConflicts) {
  console.log('Conflict details:');
  conflicts2.conflicts.forEach(c => {
    console.log(`  - Agent ${c.agent} (status: ${c.status}) conflicting on: ${c.conflictingFiles.join(', ')}`);
  });
} else {
  console.log('✓ No conflicts detected\n');
}

// Test 6: Complete work intention
console.log('Test 6: Completing work intention');
completeWorkIntention(
  'test-session-001',
  'Verified: Login page works, tests pass, no regressions'
);
console.log('✓ Work intention marked as complete\n');

// Test 7: Show final summary
console.log('Test 7: Final active work summary');
console.log(getActiveWorkSummary());

console.log('\n✅ All tests completed!');