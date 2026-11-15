// Simple test of the coordination system using Node.js fs directly
const fs = require('fs');
const path = require('path');

const INTENTS_FILE = path.join(process.cwd(), 'memory', 'agent_intents.md');

// Initialize the file
let initContent = `# Agent Intentions Registry

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

fs.writeFileSync(INTENTS_FILE, initContent);
console.log('Initialized agent intentions file\n');

// Function to read current intentions
function readIntentions() {
  return fs.readFileSync(INTENTS_FILE, 'utf8');
}

// Function to add an intention
function addIntention(agentId, description, files, duration) {
  const content = readIntentions();
  const timestamp = new Date().toISOString();

  const intentionBlock = `
### Agent: ${agentId}
- **Working On**: ${description}
- **Files**: ${files.join(', ')}
- **Estimated Duration**: ${duration}
- **Started**: ${timestamp}
- **Last Update**: ${timestamp}
- **Status**: in_progress
- **Dependencies**: None specified
- **Blocking Others**: None specified`;

  let newContent = content.replace(
    '*No active intentions logged yet.*',
    `*No active intentions logged yet.*${intentionBlock}\n\n`
  ).replace(
    /Updated: \[timestamp\]/g,
    `Updated: ${timestamp}`
  );

  fs.writeFileSync(INTENTS_FILE, newContent);
  console.log(`Added intention for ${agentId}`);
}

// Function to check conflicts
function checkConflicts(targetFiles) {
  const content = readIntentions();

  // Simple regex to extract agent sections
  const agentRegex = /### Agent: ([^\n]+)[\s\S]*?(?=\n### Agent:|\n## |$)/g;
  let match;
  const conflicts = [];

  while ((match = agentRegex.exec(content)) !== null) {
    const agentSection = match[0];
    const agentNameMatch = agentSection.match(/### Agent: ([^\n]+)/);
    if (!agentNameMatch) continue;

    const agentName = agentNameMatch[1];
    const filesMatch = agentSection.match(/-\s*\*\*Files\*\*: ([^\n]+)/);
    if (!filesMatch) continue;

    const agentFiles = filesMatch[1].split(',').map(f => f.trim());

    // Check for overlap
    const conflictingFiles = targetFiles.filter(targetFile =>
      agentFiles.some(agentFile =>
        targetFile.includes(agentFile) || agentFile.includes(targetFile)
      )
    );

    if (conflictingFiles.length > 0) {
      const statusMatch = agentSection.match(/-\s*\*\*Status\*\*: ([^\n]+)/);
      const status = statusMatch ? statusMatch[1] : 'unknown';

      conflicts.push({
        agent: agentName,
        conflictingFiles,
        status
      });
    }
  }

  return conflicts;
}

console.log('=== Testing Agent Coordination System ===\n');

// Test 1: Agent A declares work
console.log('1. Agent A declares intention to work on authentication files');
addIntention(
  'agent-A-001',
  'Implementing new login form validation',
  ['src/components/auth/LoginPage.tsx', 'src/contexts/AuthContext.tsx'],
  '2h'
);

console.log('Current active intentions:');
console.log(readIntentions().split('## Active Intentions')[1].split('## Archived Intentions')[0]);
console.log();

// Test 2: Agent B checks for conflicts on same file
console.log('2. Agent B checks for conflicts before working on LoginPage.tsx');
const conflicts1 = checkConflicts(['src/components/auth/LoginPage.tsx']);
console.log(`Conflicts found: ${conflicts1.length > 0}`);
if (conflicts1.length > 0) {
  console.log('Conflict details:');
  conflicts1.forEach(c => {
    console.log(`  - Agent ${c.agent} (${c.status}) working on: ${c.conflictingFiles.join(', ')}`);
  });
  console.log('Agent B should wait or negotiate.\n');
} else {
  console.log('No conflicts - Agent B can proceed.\n');
}

// Test 3: Agent B works on different file
console.log('3. Agent B decides to work on energy component instead');
addIntention(
  'agent-B-002',
  'Adding new animation to energy ring component',
  ['src/components/energy/EnergyRing.tsx', 'src/components/energy/EnergyTimeline.tsx'],
  '1h'
);

console.log('Current active intentions:');
console.log(readIntentions().split('## Active Intentions')[1].split('## Archived Intentions')[0]);
console.log();

// Test 4: Agent A updates progress
console.log('4. Agent A updates progress on their work');
// We'll simulate this by just showing the current state
console.log('Current active intentions:');
console.log(readIntentions().split('## Active Intentions')[1].split('## Archived Intentions')[0]);
console.log();

// Test 5: Agent A completes work
console.log('5. Agent A completes work');
// Simulate completion by noting it would be moved to archived
console.log('Current active intentions (would show Agent A as completed):');
console.log(readIntentions().split('## Active Intentions')[1].split('## Archived Intentions')[0]);
console.log();

// Test 6: Agent B checks again after Agent A finishes
console.log('6. Agent B checks again for conflicts on LoginPage.tsx');
const conflicts2 = checkConflicts(['src/components/auth/LoginPage.tsx']);
console.log(`Conflicts found: ${conflicts2.length > 0}`);
if (conflicts2.length > 0) {
  console.log('Still has conflicts:');
  conflicts2.forEach(c => {
    console.log(`  - Agent ${c.agent} (${c.status}) working on: ${c.conflictingFiles.join(', ')}`);
  });
} else {
  console.log('No conflicts - Agent B can now safely work on this file.\n');
}

console.log('=== Test Complete ===');
console.log('Final state:');
console.log(readIntentions());