/**
 * Distilled-rules retrieval — shared by all agent workers.
 *
 * Outcome notes accumulate in '03 - Learnings'; LIBRARIAN's distill task
 * compresses recurring patterns into rules in '04 - Rules'. Every worker
 * that makes an LLM call can pull the top-matching rules for its task
 * context and inject them as constraints. Extracted from workers.ts so
 * warden/prep/distribution workers share the same retrieval path.
 */

import fs from 'node:fs';
import path from 'node:path';
import { cortexObsidianMemory } from '../cortex-obsidian-memory';

export const RULES_DIR = '04 - Rules';

export function vaultFolder(folder: string): string | null {
  try {
    const p = path.join(cortexObsidianMemory.getVaultPath(), folder);
    return fs.existsSync(p) ? p : null;
  } catch { return null; }
}

export function listMd(dir: string | null): string[] {
  if (!dir) return [];
  try { return fs.readdirSync(dir).filter((f) => f.endsWith('.md')); }
  catch { return []; }
}

/** Extract the rule text from a distilled-rule note (first heading or line). */
function ruleText(content: string): string {
  const heading = content.match(/^#\s*(?:Rule|DISTILLED RULE):?\s*(.+)$/im)?.[1];
  if (heading) return heading.trim().slice(0, 220);
  const firstLine = content.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('---'));
  return (firstLine || '').slice(0, 220);
}

/** Deterministic token-overlap scorer — no LLM, no network. */
function tokenScore(text: string, tokens: Set<string>): number {
  let n = 0;
  for (const t of tokens) if (text.toLowerCase().includes(t)) n++;
  return n;
}

/** Rules relevant to a task instruction, formatted for a system prompt. */
export function relevantRules(instruction: string, limit = 3): string {
  const dir = vaultFolder(RULES_DIR);
  const files = listMd(dir).slice(-40);
  if (!files.length) return '';
  const tokens = new Set(instruction.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3));
  const scored = files
    .map((f) => {
      try {
        const content = fs.readFileSync(path.join(dir!, f), 'utf-8');
        return { file: f, text: ruleText(content), score: tokenScore(content, tokens) };
      } catch { return { file: f, text: '', score: 0 }; }
    })
    .filter((r) => r.text && r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((r) => `- ${r.text}`).join('\n');
}

/** Append the DISTILLED RULES block to a system prompt when rules match. */
export function rulesBlock(instruction: string, scopeNote = 'constraints learned from accepted agent outcomes — follow unless they conflict with governance'): string {
  const rules = relevantRules(instruction);
  return rules ? `\n\nDISTILLED RULES (${scopeNote}):\n${rules}` : '';
}
