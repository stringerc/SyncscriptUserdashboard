/**
 * Counsel persona panel — the MiroFish-pattern adoption.
 *
 * MiroFish's adoptable DNA is not its OASIS/Zep simulation engine — it is
 * the move from a fixed committee to a *generated* panel: seed material
 * in, diverse motivated personas out, independent positions in, synthesis
 * on top. Cortex already owns every primitive that pattern needs:
 *
 *   seed brief        → CounselSession.question + context
 *   knowledge anchor  → Hindsight recall (:8888, 'cortex' bank) — the
 *                       local equivalent of MiroFish's Zep graph
 *   persona roster    → LLM-generated CounselPersona specs (this file)
 *   independent pos.  → filePosition() — Evidence-or-Silence, same gate
 *   synthesis/verdict → existing counsel_synthesize + human GO/NO-GO
 *
 * Two worker kinds live here:
 *   counsel_personas          (STRATEGIST) — generate panel, attach, dispatch
 *   counsel_persona_position  (SCOUT host) — one persona files one position
 *
 * Premortem mode (session.mode === 'premortem') reframes every position
 * prompt: assume the decision shipped and failed; reconstruct why. This
 * is the "which video will do great" use-case — run it on a launch asset
 * before distribution spend.
 *
 * TIER BOUNDARY (vs cortex-simulation.ts arena):
 *   Persona panels here are the TIER-2 governed path — generated personas,
 *   rebuttal rounds, synthesis, human GO/NO-GO. The simulation arena is the
 *   TIER-1 quick dial for fast what-if intuition. Same idea, different
 *   weight class — do not merge them.
 */

import type { AgentContext, AgentRuntime } from './runtime';
import type { AgentId } from './types';
import {
  attachPersonas,
  filePosition,
  getCounselSession,
  memberLabel,
  type CounselSession,
} from '../cortex-counsel';

const HINDSIGHT_URL = (process.env.CORTEX_HINDSIGHT_URL || 'http://127.0.0.1:8888').replace(/\/$/, '');
const HINDSIGHT_BANK = process.env.CORTEX_HINDSIGHT_BANK || 'cortex';
const HINDSIGHT_BUDGET = process.env.CORTEX_HINDSIGHT_BUDGET || 'low';
const MAX_PERSONAS = 5;

// ── Hindsight grounding ─────────────────────────────────────────────────────

/** Bounded recall against the local Hindsight engine. Returns [] on any
 *  failure — grounding is additive, never a hard dependency. */
export async function hindsightRecall(query: string, maxChars = 1200): Promise<string[]> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(`${HINDSIGHT_URL}/v1/default/banks/${HINDSIGHT_BANK}/memories/recall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.slice(0, 400), budget: HINDSIGHT_BUDGET }),
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const data: any = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return results
      .map((r: any) => String(r?.text || '').trim())
      .filter(Boolean)
      .slice(0, 6)
      .map((t: string) => t.slice(0, 300));
  } catch {
    return [];
  }
}

// ── Persona generation (STRATEGIST: counsel_personas) ───────────────────────

function extractJsonArray(text: string): any[] | null {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try {
    const arr = JSON.parse(m[0]);
    return Array.isArray(arr) ? arr : null;
  } catch { return null; }
}

const PERSONA_GEN_SYSTEM =
  'You generate diverse, motivated advisor personas for a structured decision poll. ' +
  'Each persona must see the problem through a genuinely different lens — not five ' +
  'rephrasings of the same view. JSON array only.';

function personaGenPrompt(s: CounselSession, count: number): string {
  return [
    `Generate exactly ${count} advisor personas for this deliberation.`,
    `Decision under deliberation: "${s.question}"`,
    s.context ? `Brief context:\n${s.context.slice(0, 2500)}` : '',
    `Lane: ${s.lane}. Mode: ${s.mode || 'standard'}.`,
    s.mode === 'premortem'
      ? `PREMORTEM FRAMING: the decision already shipped and failed. Personas should be the people who would have seen it coming — the skeptic who churned, the attacker who exploited it, the user who bounced, the analyst who flagged the metric.`
      : `STANDARD FRAMING: personas should stress-test the decision from orthogonal risk angles.`,
    `Output JSON array ONLY — no prose. Each element:`,
    `{"id":"<snake_case slug>","callSign":"<SHORT CAPS LABEL>","persona":"<one-line identity + what they care about>","axis":"<the specific lens they evaluate through>"}`,
    `Rules: ids unique snake_case; personas must be concretely motivated (a persona with no stake produces noise); cover genuinely different axes — never duplicate a lens.`,
  ].filter(Boolean).join('\n');
}

/** STRATEGIST worker kind 'counsel_personas': generate the panel for a
 *  session that requested personas at convene, attach it, then dispatch
 *  one counsel_persona_position task per persona to the SCOUT host. */
export async function runCounselPersonas(ctx: AgentContext, runtime: AgentRuntime) {
  const sessionId = String(ctx.task.input.sessionId || '');
  const s = getCounselSession(sessionId);
  if (!s) return { error: `counsel session ${sessionId} not found` };
  if (s.personas?.length) return { skipped: true, reason: 'panel already attached', personas: s.personas.length };
  const count = Math.min(MAX_PERSONAS, Math.max(1, Number(s.personaCount) || 3));
  if (!['positions', 'rebuttal'].includes(s.status)) {
    return { error: `session ${sessionId} is ${s.status} — cannot attach personas` };
  }

  ctx.progress(0.2);
  // Ground the panel in real project memory when Hindsight is reachable.
  const memories = await hindsightRecall(`${s.question} ${s.context || ''}`.slice(0, 300));
  const grounded = memories.length
    ? { ...s, context: `${s.context || ''}\n\nPROJECT MEMORY (Hindsight recall):\n${memories.map((m) => `- ${m}`).join('\n')}`.slice(0, 3900) }
    : s;

  const text = await ctx.llm({
    tier: 'reason',
    maxTokens: 1200,
    messages: [
      { role: 'system', content: PERSONA_GEN_SYSTEM },
      { role: 'user', content: personaGenPrompt(grounded, count) },
    ],
  });
  ctx.progress(0.6);

  const raw = extractJsonArray(text);
  if (!raw?.length) return { error: 'LLM returned no persona array', raw: text.slice(0, 300) };

  const attached = attachPersonas(sessionId, raw);
  if (!attached.ok || !attached.session) return { error: attached.error || 'attach failed' };

  // Dispatch one position task per persona — SCOUT hosts ephemeral
  // personas (recon/investigation is the natural console for synthetic
  // advisors; standing agent budgets govern the spend).
  const round = attached.session.status === 'rebuttal' ? 2 : 1;
  let dispatched = 0;
  for (const p of attached.session.personas || []) {
    const already = attached.session.positions.some((x) => x.member === p.id && x.round === round);
    if (already) continue;
    const sub = runtime.submitTask('scout' as AgentId, 'counsel_persona_position',
      `Persona ${p.callSign} on ${sessionId}: ${s.question.slice(0, 70)}`,
      { sessionId, personaId: p.id });
    if (sub.ok) dispatched++;
  }

  ctx.progress(1);
  return {
    sessionId,
    personas: attached.session.personas,
    dispatched,
    hindsightGrounded: memories.length,
    next: 'personas file positions via counsel_persona_position tasks; session advances normally',
  };
}

// ── Persona position (SCOUT: counsel_persona_position) ──────────────────────

function anonymizedRound1(s: CounselSession): string {
  const r1 = s.positions.filter((p) => p.round === 1);
  if (!r1.length) return 'No round-1 positions on record.';
  return r1.map((p, i) =>
    `POSITION ${String.fromCharCode(65 + i)}: stance=${p.stance} confidence=${p.confidence}\n` +
    `evidence: ${p.keyEvidence.join('; ')}\n` +
    `risks: ${p.risks.join('; ') || 'none'}\n` +
    `conditions: ${p.requiredConditions.join('; ') || 'none'}\n` +
    `reasoning: ${p.reasoning}`
  ).join('\n\n');
}

function extractJson(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/** SCOUT worker kind 'counsel_persona_position': one ephemeral persona
 *  files one Evidence-or-Silence position. Round semantics identical to
 *  runCounselPosition — independent R1, anonymized rebuttal R2. */
export async function runPersonaPosition(ctx: AgentContext) {
  const sessionId = String(ctx.task.input.sessionId || '');
  const personaId = String(ctx.task.input.personaId || '');
  const s = getCounselSession(sessionId);
  if (!s) return { error: `counsel session ${sessionId} not found` };
  if (!['positions', 'rebuttal'].includes(s.status)) {
    return { error: `session ${sessionId} is ${s.status} — not collecting positions`, sessionStatus: s.status };
  }
  const persona = (s.personas || []).find((p) => p.id === personaId);
  if (!persona) return { error: `persona ${personaId} not attached to session ${sessionId}` };
  if (!s.members.includes(personaId)) return { error: `${personaId} is not a member of session ${sessionId}` };

  const round: 1 | 2 = s.status === 'rebuttal' ? 2 : 1;
  if (s.positions.filter((p) => p.member === personaId && p.round === round).length >= 1) {
    return { error: `${personaId} already filed round-${round}` };
  }

  ctx.progress(0.2);
  const isRebuttal = round === 2;
  const premortem = s.mode === 'premortem';

  // Per-persona grounding: recall memories relevant to THIS lens so each
  // advisor cites real project state, not generic worry.
  const memories = await hindsightRecall(`${persona.axis} ${s.question}`.slice(0, 300), 4);
  const memoryBlock = memories.length
    ? `PROJECT MEMORY relevant to your lens:\n${memories.map((m) => `- ${m}`).join('\n')}`
    : '';

  const stanceGuide = premortem
    ? `STANCE SEMANTICS (premortem): 'go' = this survives the failure scenario you fear most; 'no-go' = your feared failure is probable and unmitigated; 'conditional' = survivable only if named conditions hold.`
    : `STANCE SEMANTICS: 'go' = approve, 'no-go' = block, 'conditional' = approve only if conditions met.`;

  const prompt = [
    `You are ${persona.callSign} — ${persona.persona}`,
    `Your evaluation axis: ${persona.axis}`,
    `You are an ephemeral advisor on a Go/No-Go counsel poll — NOT a Cortex staff agent. Stay in persona; do not cite staff-agent authority.`,
    `Decision under deliberation: "${s.question}"`,
    s.context ? `BRIEF (auto-assembled evidence):\n${s.context.slice(0, 2000)}` : '',
    memoryBlock,
    `Lane: ${s.lane}. Mode: ${s.mode || 'standard'}.`,
    stanceGuide,
    premortem
      ? `PREMORTEM: assume this already shipped and FAILED. Reconstruct the single most likely failure path through your lens. Your position defends or condemns the decision on that basis.`
      : '',
    isRebuttal
      ? `REBUTTAL ROUND: anonymized round-1 positions are below. Revise only if new evidence warrants it; otherwise hold. Duplicating the majority without new evidence is a failure.\n\n${anonymizedRound1(s)}`
      : `ROUND 1: file your independent position. Do NOT assume what others will say.`,
    ``,
    `Output JSON ONLY: {"stance":"go|no-go|conditional","confidence":0..1,"keyEvidence":["<cited fact>",...],"risks":["..."],"requiredConditions":["..."],"reasoning":"<max 400 chars>"}`,
    `Rules: keyEvidence MUST cite real, checkable facts from the brief, project memory, or your persona's domain knowledge — never invent. If evidence is thin, vote conditional or no-go. reasoning ≤400 chars.`,
  ].filter(Boolean).join('\n');

  ctx.progress(0.5);
  const text = await ctx.llm({
    tier: 'reason',
    maxTokens: 800,
    messages: [
      { role: 'system', content: `You are ${persona.callSign}, an ephemeral advisor persona on a structured decision poll. Stay in persona. JSON only, evidence-cited.` },
      { role: 'user', content: prompt },
    ],
  });
  ctx.progress(0.85);

  const parsed = extractJson(text);
  if (!parsed) return { error: 'LLM returned no JSON position', raw: text.slice(0, 300) };

  const res = filePosition(sessionId, {
    member: personaId,
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
    member: personaId,
    persona: memberLabel(s, personaId),
    stance: parsed.stance,
    confidence: parsed.confidence,
    premortem,
    next: round === 1
      ? 'round 1 filed — session advances to rebuttal when standing positions are in or timeout hits'
      : 'rebuttal filed — session ready for STRATEGIST synthesis',
  };
}
