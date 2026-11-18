/**
 * Adoption follow-through — closes the trend-scan → INBOX last mile.
 *
 * Repo scans file "[research] Evaluate adopting <repo>" strategy proposals;
 * on approval a builder task gathers evidence but emits no explicit
 * verdict. This module watches completed builder research tasks, runs ONE
 * fast-tier judge over the gathered evidence, and — only on an adopt
 * verdict — files a follow-up strategy proposal whose instruction is the
 * executable install/eval step. The Crew approves in the INBOX; an agent
 * executes. Rejected/inconclusive research stays silent — the archive
 * already records it honestly.
 *
 * Dedupe: one follow-up per repo (planNote = adoption-<owner>-<repo>).
 */

import type { AgentTask } from './types';

const PORT = () => process.env.PORT ? parseInt(process.env.PORT) : 5173;
const REPO_RE = /(?:github\.com\/)?([A-Za-z0-9][A-Za-z0-9_.-]{0,38}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99})/;
const ADOPTION_RE = /\[research\][^\n]*adopt/i;

interface JudgeVerdict {
  verdict: 'adopt' | 'reject' | 'inconclusive';
  kind: 'skill' | 'agent' | 'library' | 'process';
  reason: string;
}

function extractRepo(instruction: string): string | null {
  // Prefer the 'evidence:' segment — it carries the canonical repo name;
  // fall back to the first owner/repo-shaped token in the instruction.
  const ev = instruction.match(/evidence:\s*([^—\n]+)/i)?.[1] || '';
  const m = ev.match(REPO_RE) || instruction.match(REPO_RE);
  return m ? m[1] : null;
}

function resultEvidenceOk(result: any): boolean {
  const steps = Number(result?.stepsExecuted ?? 0);
  const results = Array.isArray(result?.results) ? result.results : [];
  const okSteps = results.filter((r: any) => r?.ok === true).length;
  return steps >= 3 || okSteps >= 3;
}

function condenseResult(result: any): string {
  const parts: string[] = [];
  if (result?.spec?.objective) parts.push(`OBJECTIVE: ${result.spec.objective}`);
  if (result?.verification?.required) parts.push(`VERIFICATION REQUIRED: ${result.verification.required} (ran: ${result.verification.ran})`);
  const results = Array.isArray(result?.results) ? result.results : [];
  for (const r of results.slice(-8)) {
    const out = String(r?.output || '');
    // Keep content-bearing outputs; skip empty/veto noise.
    if (out.length > 40) parts.push(`STEP ${r?.step} ${r?.tool}: ${out.slice(0, 700)}`);
  }
  return parts.join('\n').slice(0, 6000);
}

async function judgeAdoption(repo: string, instruction: string, evidence: string): Promise<JudgeVerdict | null> {
  const r = await fetch(`http://127.0.0.1:${PORT()}/api/cortex/agents/llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tier: 'fast',
      agentId: 'trainer',
      maxTokens: 300,
      messages: [
        {
          role: 'system',
          content: 'You are TRAINER\'s adoption judge. A builder research task evaluated whether Cortex should adopt an external repo/library/skill. Read the evidence and decide: adopt (clear concrete gap it fills), reject (no real gap / poor fit / redundant), or inconclusive (evidence too thin to decide). Also classify what adoption would look like: skill (markdown procedure/prompt pack), agent (needs a running service/daemon), library (code dependency), process (workflow change). Output STRICT JSON: {"verdict":"adopt|reject|inconclusive","kind":"skill|agent|library|process","reason":"<=160 chars"}. No prose outside JSON.',
        },
        {
          role: 'user',
          content: `REPO: ${repo}\nTASK: ${instruction.slice(0, 400)}\n\nEVIDENCE GATHERED:\n${evidence}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const j: any = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) return null;
  try {
    const m = String(j.content || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    const v = JSON.parse(m[0]);
    if (!['adopt', 'reject', 'inconclusive'].includes(v?.verdict)) return null;
    return {
      verdict: v.verdict,
      kind: ['skill', 'agent', 'library', 'process'].includes(v?.kind) ? v.kind : 'process',
      reason: String(v.reason || '').slice(0, 200),
    };
  } catch { return null; }
}

/** Fire-and-forget from the task-completed hook. Never throws. */
export async function maybeFileAdoptionFollowup(task: AgentTask): Promise<void> {
  try {
    if (task.status !== 'completed') return;
    if (task.agentId !== 'builder' || task.kind !== 'task') return;
    const instruction = String(task.input?.instruction || '');
    if (!ADOPTION_RE.test(instruction)) return;
    const repo = extractRepo(instruction);
    if (!repo) return;
    if (!resultEvidenceOk(task.result)) return;

    const verdict = await judgeAdoption(repo, instruction, condenseResult(task.result));
    if (!verdict || verdict.verdict !== 'adopt') return;

    const { fileStrategyProposals } = await import('./strategy-proposals');
    const repoSlug = repo.replace(/[^a-z0-9]+/gi, '-').slice(-50);
    const gapMatch = instruction.match(/—\s*([^—]+?)\s*—\s*evidence:/);
    const gap = gapMatch ? gapMatch[1].trim().slice(0, 160) : '';
    const actionText = verdict.kind === 'skill'
      ? `[skill] Install agent skill from github.com/${repo} — clone the repo, copy its skill folder (SKILL.md + references + scripts) into ~/.claude/skills/<skill-name>/, verify SKILL.md frontmatter parses, and report the installed path — evidence: builder research task ${task.id} judge verdict=adopt (${verdict.reason}); gap: ${gap || repo}`
      : verdict.kind === 'agent'
        ? `[process] Evaluate dedicating an agent to the ${repo} capability — review builder research task ${task.id} findings and decide whether a spawned agent or service integration closes gap: ${gap || repo} — evidence: judge verdict=adopt (${verdict.reason})`
        : `[eval] Evaluate integrating library github.com/${repo} — review builder research task ${task.id} findings, pick integration point, and file implementation steps — evidence: judge verdict=adopt (${verdict.reason}); gap: ${gap || repo}`;

    const res = fileStrategyProposals({
      planNote: `adoption-${repoSlug}`,
      planTaskId: task.id,
      actions: [actionText],
    });
    if (res.filed > 0) {
      console.log(`[adoption] filed follow-up for ${repo} (verdict=adopt, kind=${verdict.kind})`);
    }
  } catch (e) {
    console.warn('[adoption] follow-up check failed:', e instanceof Error ? e.message : e);
  }
}
