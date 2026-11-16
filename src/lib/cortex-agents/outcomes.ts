/**
 * Universal agent-outcome capture.
 *
 * Every task outcome — runtime completions, manual dispatches, A/B arms,
 * external agent sessions — should land in '03 - Learnings' as an
 * agent-outcome note so LIBRARIAN's distill pass can cluster recurring
 * patterns into rules. This helper is the single write path; the runtime
 * completion hook and the /api/cortex/agents/outcome endpoint both use it.
 *
 * Notes stay parse-compatible with parseOutcomeNote in workers.ts:
 * fields Task / Outcome / Retry lineage / Summary must keep their names.
 */

import path from 'node:path';
import { cortexObsidianMemory } from '../cortex-obsidian-memory';

export const LEARNINGS_DIR = '03 - Learnings';

export interface AgentOutcomeTelemetry {
  llmCalls?: number;
  tokensIn?: number;
  tokensOut?: number;
  llmMs?: number;
  toolCalls?: number;
  toolFailures?: number;
  durationMs?: number;
  failureClass?: string;
}

export interface AgentOutcomeRecord {
  agentId: string;
  agentName?: string;
  kind: string;
  title: string;
  /** 'green' | 'partial' | 'failed' | free-form — non-green feeds distillation. */
  outcome: string;
  summary?: string;
  model?: string;
  retryLine?: string;
  telemetry?: AgentOutcomeTelemetry | null;
  /** Where the outcome came from: 'runtime' | 'manual' | 'ab-arm' | agent name. */
  source?: string;
}

function slug(s: string, max = 40): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max) || 'unknown';
}

/** Sanitize filename parts. The filename is agent-<agentId>-<kind>-<ts> and
 *  parseOutcomeNote takes kind as the LAST dash-segment before the timestamp,
 *  so agentId may keep dashes (spawn-ledger-7-1) but kind must not contain
 *  them — underscores are safe. */
function fileParts(agentId: string, kind: string): { agentSlug: string; kindSlug: string } {
  return {
    agentSlug: slug(agentId, 48),
    kindSlug: slug(kind, 30).replace(/-/g, '_').replace(/_+/g, '_'),
  };
}

/**
 * Write an agent-outcome note. Returns the vault-relative path on success,
 * null on failure (learning capture must never break the caller).
 */
export function recordAgentOutcome(rec: AgentOutcomeRecord): string | null {
  try {
    const { agentSlug, kindSlug } = fileParts(rec.agentId, rec.kind);
    const t = rec.telemetry || {};
    const telemBits: string[] = [];
    if (t.durationMs != null) telemBits.push(`duration ${t.durationMs}ms`);
    if (t.llmCalls != null) telemBits.push(`llm ${t.llmCalls} call(s), ${t.tokensIn ?? 0}in/${t.tokensOut ?? 0}tok, ${t.llmMs ?? 0}ms`);
    if (t.toolCalls != null) telemBits.push(`tools ${t.toolCalls} call(s), ${t.toolFailures ?? 0} failure(s)`);
    if (t.failureClass) telemBits.push(`failure class: ${t.failureClass}`);
    const telemLine = telemBits.length ? `Telemetry: ${telemBits.join(' | ')}\n` : '';
    const body =
      `# Agent outcome: ${rec.agentName || rec.agentId} [${rec.kind}]\n\n` +
      `> ${new Date().toISOString().slice(0, 10)}\n\n` +
      `Task: ${String(rec.title).slice(0, 200)}\n` +
      `Outcome: ${rec.outcome} via ${rec.model || 'matrix'}${rec.source ? ` [${rec.source}]` : ''}${rec.retryLine ? `\n${rec.retryLine}` : ''}\n` +
      telemLine +
      `Summary: ${String(rec.summary || '').slice(0, 300)}\n\n` +
      `Tags: agent-outcome cortex-agents\n`;
    cortexObsidianMemory.ensureVaultInitialized();
    const file = `agent-${agentSlug}-${kindSlug}-${Date.now().toString(36)}`;
    const ok = cortexObsidianMemory.writeNote(
      LEARNINGS_DIR,
      file,
      body,
      { created: new Date().toISOString(), agent: rec.agentName || rec.agentId, kind: 'agent-outcome' },
    );
    return ok ? `${LEARNINGS_DIR}/${file}.md` : null;
  } catch {
    return null;
  }
}
