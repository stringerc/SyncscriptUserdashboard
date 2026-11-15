// Agent Coordination Utility for Shared Intentionality Protocol
// Provides functions to declare work intentions, check for conflicts, and update status

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const INTENTS_FILE = join(process.cwd(), 'memory', 'agent_intents.md');

/**
 * Reads the current agent intentions file
 */
export function readAgentIntentions(): string {
  if (!existsSync(INTENTS_FILE)) {
    return '# Agent Intentions Registry\n\n## Active Intentions (Updated: [timestamp])\n\n*No active intentions logged yet.*\n\n## Archived Intentions\n\n*Completed or expired intentions move here for historical reference*';
  }

  return readFileSync(INTENTS_FILE, 'utf8');
}

/**
 * Writes content to the agent intentions file
 */
export function writeAgentIntentions(content: string): void {
  writeFileSync(INTENTS_FILE, content, 'utf8');
}

/**
 * Declares an agent's work intention before starting work
 * @param sessionId Unique identifier for this agent session
 * @param description What the agent intends to work on
 * @param files Array of file paths that will be modified
 * @param estimatedDuration Estimated time to complete (e.g., "30m", "2h")
 */
export function declareWorkIntention(
  sessionId: string,
  description: string,
  files: string[],
  estimatedDuration: string = "unknown"
): void {
  const currentIntentions = readAgentIntentions();
  const timestamp = new Date().toISOString();

  // Parse the current intentions to find the Active Intentions section
  const sections = currentIntentions.split('\n## ');
  let updatedContent = currentIntentions;

  // Create the intention entry
  const intentionEntry = `
### Agent: ${sessionId}
- **Working On**: ${description}
- **Files**: ${files.join(', ')}
- **Estimated Duration**: ${estimatedDuration}
- **Started**: ${timestamp}
- **Last Update**: ${timestamp}
- **Status**: in_progress
- **Dependencies**: None specified
- **Blocking Others**: None specified`;

  // Insert into Active Intentions section
  if (currentIntentions.includes('## Active Intentions')) {
    const activeSectionPattern = /(## Active Intentions.*?\n)([\s\S]*?)(?=\n## |$)/;
    const match = currentIntentions.match(activeSectionPattern);

    if (match) {
      const [fullMatch, header, content] = match;
      const newContent = `${header}${content.trim()}\n${intentionEntry}\n\n`;
      updatedContent = currentIntentions.replace(fullMatch, newContent);
    }
  } else {
    // Fallback: append to end if section not found
    updatedContent = currentIntentions.replace(
      '*No active intentions logged yet.*',
      `*No active intentions logged yet.*${intentionEntry}\n\n`
    );
  }

  // Update timestamp
  updatedContent = updatedContent.replace(
    /Updated: \[timestamp\]/g,
    `Updated: ${timestamp}`
  );

  writeAgentIntentions(updatedContent);
}

/**
 * Updates an agent's intention status
 * @param sessionId Unique identifier for this agent session
 * @param updates Object containing fields to update (status, lastUpdate, etc.)
 */
export function updateWorkIntention(
  sessionId: string,
  updates: Partial<{
    status: string;
    lastUpdate: string;
    dependencies: string;
    blockingOthers: string;
  }>
): void {
  const currentIntentions = readAgentIntentions();
  const timestamp = new Date().toISOString();

  // Update the specific agent's section
  const agentSectionPattern = new RegExp(
    `(### Agent: ${sessionId}[\\s\\S]*?)(?=\\n### Agent:|\\n## |$)`,
    'g'
  );

  let updatedContent = currentIntentions.replace(agentSectionPattern, (match) => {
    let updatedMatch = match;

    // Apply updates
    if (updates.status) {
      updatedMatch = updatedMatch.replace(
        /- \*\*Status\*\*: [^\n]*/,
        `- **Status**: ${updates.status}`
      );
    }

    if (updates.lastUpdate || updates.status) {
      updatedMatch = updatedMatch.replace(
        /- \*\*Last Update\*\*: [^\n]*/,
        `- **Last Update**: ${updates.lastUpdate || timestamp}`
      );
    }

    if (updates.dependencies !== undefined) {
      updatedMatch = updatedMatch.replace(
        /- \*\*Dependencies\*\*: [^\n]*/,
        `- **Dependencies**: ${updates.dependencies}`
      );
    }

    if (updates.blockingOthers !== undefined) {
      updatedMatch = updatedMatch.replace(
        /- \*\*Blocking Others\*\*: [^\n]*/,
        `- **Blocking Others**: ${updates.blockingOthers}`
      );
    }

    return updatedMatch;
  });

  // Update timestamp in header
  updatedContent = updatedContent.replace(
    /Updated: \[timestamp\]/g,
    `Updated: ${timestamp}`
  );

  writeAgentIntentions(updatedContent);
}

/**
 * Marks an agent's work as complete and moves it to archive
 * @param sessionId Unique identifier for this agent session
 * @param verificationEvidence Links or description of verification completed
 */
export function completeWorkIntention(
  sessionId: string,
  verificationEvidence: string = "Work completed and verified"
): void {
  const currentIntentions = readAgentIntentions();
  const timestamp = new Date().toISOString();

  // Extract the agent's section and move it to archived
  const agentSectionPattern = new RegExp(
    `(### Agent: ${sessionId}[\\s\\S]*?)(?=\\n### Agent:|\\n## |$)`,
    'g'
  );

  let updatedContent = currentIntentions;
  let agentSectionMatch = currentIntentions.match(agentSectionPattern);

  if (agentSectionMatch) {
    let agentSection = agentSectionMatch[1];

    // Update the section to show completion
    let completedSection = agentSection.replace(
      /- \*\*Status\*\*: [^\n]*/,
      `- **Status**: completed`
    ).replace(
      /- \*\*Last Update\*\*: [^\n]*/,
      `- **Last Update**: ${timestamp}`
    ).replace(
      /- \*\*Blocking Others\*\*: [^\n]*/,
      `- **Blocking Others**: None (work completed)`
    );

    // Add verification evidence
    completedSection += `\n- **Verification Evidence**: ${verificationEvidence}\n`;

    // Remove from active intentions
    updatedContent = currentIntentions.replace(agentSectionPattern, '');

    // Add to archived intentions
    if (updatedContent.includes('## Archived Intentions')) {
      updatedContent = updatedContent.replace(
        '(## Archived Intentions[\\s\\S]*?)',
        `$1\n\n${completedSection}`
      );
    } else {
      // If no archived section, add it
      updatedContent += `\n\n## Archived Intentions\n\n${completedSection}`;
    }
  }

  // Update timestamp in header
  updatedContent = updatedContent.replace(
    /Updated: \[timestamp\]/g,
    `Updated: ${timestamp}`
  );

  writeAgentIntentions(updatedContent);
}

/**
 * Checks for conflicts with other agents' work intentions
 * @param files Array of file paths you intend to work on
 * @returns Object containing any conflicts found
 */
export function checkForConflicts(files: string[]): {
  hasConflicts: boolean;
  conflicts: Array<{
    agent: string;
    conflictingFiles: string[];
    status: string;
  }>;
} {
  const currentIntentions = readAgentIntentions();

  // Extract all active agent sections
  const agentSections = currentIntentions.match(
    /### Agent: [^\n]+[\\s\\S]*?(?=\n### Agent:|\n## |$)/g
  ) || [];

  const conflicts: Array<{
    agent: string;
    conflictingFiles: string[];
    status: string;
  }> = [];

  for (const section of agentSections) {
    // Extract agent ID
    const agentMatch = section.match(/### Agent: ([^\n]+)/);
    if (!agentMatch) continue;
    const agentId = agentMatch[1];

    // Extract files from this agent's section
    const filesMatch = section.match(/-\ \*\*Files\*\*: ([^\n]+)/);
    if (!filesMatch) continue;

    const agentFiles = filesMatch[1]
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    // Check for overlap
    const conflictingFiles = files.filter(file =>
      agentFiles.some(agentFile =>
        file.includes(agentFile) || agentFile.includes(file)
      )
    );

    if (conflictingFiles.length > 0) {
      // Extract status
      const statusMatch = section.match(/-\ \*\*Status\*\*: ([^\n]+)/);
      const status = statusMatch ? statusMatch[1] : 'unknown';

      conflicts.push({
        agent: agentId,
        conflictingFiles,
        status
      });
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  };
}

/**
 * Gets a summary of all active work for display
 */
export function getActiveWorkSummary(): string {
  const currentIntentions = readAgentIntentions();

  // Extract Active Intentions section
  const activeMatch = currentIntentions.match(
    /## Active Intentions[\\s\\S]*?(?=\n## |$)/
  );

  return activeMatch ? activeMatch[0] : "## Active Intentions\n\n*No active intentions logged yet.*";
}
