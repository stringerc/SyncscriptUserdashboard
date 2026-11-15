import { writeFileSync } from 'fs';

const content = `# Test Intentions

## Active Intentions (Updated: $(new Date().toISOString()))

### Agent: test-agent-001
- **Working On**: Testing file write
- **Files**: [simpleTest.ts]
- **Estimated Duration**: 5m
- **Started**: $(new Date().toISOString())
- **Last Update**: $(new Date().toISOString())
- **Status**: in_progress
- **Dependencies**: None
- **Blocking Others**: None

## Archived Intentions

*Completed or expired intentions move here for historical reference*

---
*Last cleaned: $(new Date().toISOString()) - Older than 24h intentions moved to archive unless marked long-running`
;

writeFileSync('/Users/Apple/.claude/projects/-Users-Apple-syncscript/memory/agent_intents.md', content);
console.log('File written successfully');