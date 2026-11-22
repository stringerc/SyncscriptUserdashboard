/**
 * cortex-agent/autonomy — sovereign autonomy mode ("bypass permissions").
 *
 * When mode === 'autonomous', Cortex narrates intent and executes
 * immediately — no confirmation prompts, no "want me to?" dead ends.
 * Hard safety invariants (destructive-command veto, credential-read veto,
 * protected-file mutation veto) are UNAFFECTED — those are operational
 * guardrails, not confirmations.
 *
 * Persisted at .cortex-runtime/autonomy.json so the mode survives reloads
 * and is shared by every surface hitting nexus-guest.
 */
import fs from 'node:fs';
import path from 'node:path';

const RUNTIME_DIR = path.join(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME_DIR, 'autonomy.json');

export type AutonomyMode = 'autonomous' | 'confirm';

interface AutonomyState {
  mode: AutonomyMode;
  updatedAt: number;
  updatedBy?: string;
}

export function getAutonomyMode(): AutonomyMode {
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (parsed?.mode === 'confirm' || parsed?.mode === 'autonomous') return parsed.mode;
    }
  } catch {}
  return 'autonomous'; // sovereign default — act, don't ask
}

export function setAutonomyMode(mode: AutonomyMode, by?: string): AutonomyState {
  const state: AutonomyState = { mode, updatedAt: Date.now(), updatedBy: by };
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
  } catch {}
  return state;
}

/** Directive appended to the agentic system prompt in autonomous mode. */
export const AUTONOMY_DIRECTIVE = `
SOVEREIGN AUTONOMY (bypass-permissions mode is ON):
- ACT, DON'T ASK. When a request needs a tool, emit the tool_call immediately — never end a turn asking for confirmation, permission, or "want me to?".
- NARRATE INTENT in one short clause, then execute: "Pulling up that URL now", "Searching the web for X", "Reading the file". The user watches you work, they don't gatekeep it.
- CHAIN steps freely — fetch, read, search, run, verify — up to the step budget without pausing for approval.
- Hard safety blocks (destructive commands, credential reads, protected system files) still apply — those are invariants, not prompts. If one fires, say plainly what was blocked and offer the safe alternative.
- The ONLY reason to stop and ask is genuine ambiguity about WHAT to do — never about WHETHER you're allowed.`;
