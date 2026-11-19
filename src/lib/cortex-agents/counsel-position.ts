/**
 * Counsel position worker — internal consoles (SENTINEL, FORECASTER,
 * WARDEN) file structured Go/No-Go positions on counsel sessions.
 *
 * Round 1: independent position (member sees only the brief).
 * Round 2 (rebuttal): member sees ANONYMIZED round-1 positions
 * (Delphi-style — no member names, just stance/evidence/reasoning)
 * and may revise or hold.
 *
 * Evidence-or-Silence is enforced twice: the LLM is instructed to cite,
 * and filePosition() rejects uncited positions at intake.
 */

import type { AgentContext } from './runtime';
import { getCounselSession, filePosition, type CounselSession } from '../cortex-counsel';

const MAX_POSITIONS_PER_TASK = 1;

function extractJson(text: string): any | null {
  // Brace-match the first complete object — greedy regex breaks on
  // trailing prose and truncation.
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function anonymizedRound1(s: CounselSession): string {
  const r1 = s.positions.filter((p) => p.round === 1);
  if (!r1.length) return 'No round-1 positions on record.'
  return r1.map((p, i) =>
    `POSITION ${String.fromCharCode(65 + i)}: stance=${p.stance} confidence=${p.confidence}\n` +
    `evidence: ${p.keyEvidence.join('; ')}\n` +
    `risks: ${p.risks.join('; ') || 'none'}\n` +
    `conditions: ${p.requiredConditions.join('; ') || 'none'}\n` +
    `reasoning: ${p.reasoning}`
  ).join('\n\n');
}

/**
 * Shared handler invoked from each console's worker on kind
 * 'counsel_position'. memberId must match a COUNSEL_CONSOLES id.
 */
export async function runCounselPosition(ctx: AgentContext, memberId: string, roleNote: string) {
  const sessionId = typeof ctx.task.input.sessionId === 'string' ? ctx.task.input.sessionId : '';
  const s = getCounselSession(sessionId);
  if (!s) return { error: `counsel session ${sessionId} not found` };
  if (!['positions', 'rebuttal'].includes(s.status)) {
    return { error: `session ${sessionId} is ${s.status} — not collecting positions`, sessionStatus: s.status };
  }
  if (!s.members.includes(memberId)) {
    return { error: `${memberId} is not a member of session ${sessionId}` };
  }

  const round: 1 | 2 = s.status === 'rebuttal' ? 2 : 1;
  if (s.positions.filter((p) => p.member === memberId && p.round === round).length >= MAX_POSITIONS_PER_TASK) {
    return { error: `${memberId} already filed round-${round}` };
  }

  ctx.progress(0.2);
  const isRebuttal = round === 2;

  const prompt = [
    `You are ${memberId.toUpperCase()} — ${roleNote} — sitting on a Go/No-Go counsel poll.`,
    `Decision under deliberation: "${s.question}"`,
    s.context ? `BRIEF (auto-assembled evidence):\n${s.context.slice(0, 2000)}` : '',
    `Lane: ${s.lane}.`,
    isRebuttal
      ? `REBUTTAL ROUND: anonymized round-1 positions are below. You may revise your stance ONLY if new evidence warrants it; otherwise hold. Duplicating the majority without new evidence is a failure.\n\n${anonymizedRound1(s)}`
      : `ROUND 1: file your independent position. Do NOT assume what others will say.`,
    ``,
    `Output JSON ONLY: {"stance":"go|no-go|conditional","confidence":0..1,"keyEvidence":["<cited fact>",...],"risks":["..."],"requiredConditions":["..."],"reasoning":"<max 400 chars>"}`,
    `Rules: keyEvidence MUST cite real, checkable facts from the brief or your domain knowledge — never invent. If evidence is thin, say so and vote conditional or no-go. reasoning ≤400 chars.`,
  ].filter(Boolean).join('\n');

  ctx.progress(0.5);
  const text = await ctx.llm({
    tier: 'reason',
    maxTokens: 1400,
    messages: [
      { role: 'system', content: 'You are a specialist council member filing a structured position. JSON only, evidence-cited.' },
      { role: 'user', content: prompt },
    ],
  });
  ctx.progress(0.85);

  const parsed = extractJson(text);
  if (!parsed) return { error: 'LLM returned no JSON position', raw: text.slice(0, 300) };

  const res = filePosition(sessionId, {
    member: memberId,
    stance: parsed.stance,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    keyEvidence: Array.isArray(parsed.keyEvidence) ? parsed.keyEvidence.map(String) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
    requiredConditions: Array.isArray(parsed.requiredConditions) ? parsed.requiredConditions.map(String) : [],
    reasoning: String(parsed.reasoning || ''),
  });

  ctx.progress(1);
  if (!res.ok) return { error: res.error };
  return {
    filed: true,
    sessionId,
    round,
    member: memberId,
    stance: parsed.stance,
    confidence: parsed.confidence,
    next: round === 1
      ? 'round 1 filed — session advances to rebuttal when all expected positions are in or timeout hits'
      : 'rebuttal filed — session ready for STRATEGIST synthesis',
  };
}
