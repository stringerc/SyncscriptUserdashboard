/**
 * prompt-guard.ts — Llama Prompt Guard 2 input filter for Cortex.
 *
 * Classifies inbound user text (and optionally tool-output text) as
 * 'safe' | 'unsafe' | 'unknown' via Groq's hosted
 * meta-llama/llama-prompt-guard-2-86m through the OpenAI-compatible API.
 *
 * Design contract:
 *  - FAIL-SOFT: any error/timeout/missing key → 'unknown' (never blocks
 *    the pipeline on guard infrastructure failure).
 *  - FAST: 2.5s timeout; the guard runs ~50ms on Groq hardware.
 *  - Non-blocking by default: callers decide policy. nexus-guest treats
 *    'unsafe' as a refusal; 'unknown' passes through.
 *  - Caching: identical texts within 60s reuse the verdict.
 */

const GUARD_MODEL = 'meta-llama/llama-prompt-guard-2-86m';
const GUARD_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TIMEOUT_MS = 2500;
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 200;

export type GuardVerdict = 'safe' | 'unsafe' | 'unknown';

const verdictCache = new Map<string, { verdict: GuardVerdict; at: number }>();

function cacheGet(text: string): GuardVerdict | null {
  const hit = verdictCache.get(text);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { verdictCache.delete(text); return null; }
  return hit.verdict;
}

function cacheSet(text: string, verdict: GuardVerdict) {
  if (verdictCache.size >= CACHE_MAX) {
    const oldest = verdictCache.keys().next().value;
    if (oldest) verdictCache.delete(oldest);
  }
  verdictCache.set(text, { verdict, at: Date.now() });
}

/**
 * Classify text. Returns 'unknown' on any failure — callers must treat
 * 'unknown' as pass-through, never as a block.
 */
export async function promptGuardCheck(
  text: string,
  opts?: { apiKey?: string; timeoutMs?: number }
): Promise<GuardVerdict> {
  const trimmed = String(text || '').trim();
  if (!trimmed) return 'safe';
  if (trimmed.length > 4000) return 'unknown'; // guard context is small; skip huge payloads

  const cached = cacheGet(trimmed);
  if (cached) return cached;

  const apiKey = opts?.apiKey || process.env.GROQ_API_KEY || '';
  if (!apiKey) return 'unknown';

  try {
    const res = await fetch(GUARD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GUARD_MODEL,
        messages: [{ role: 'user', content: trimmed }],
        max_tokens: 5,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? TIMEOUT_MS),
    });
    if (!res.ok) return 'unknown';
    const json: any = await res.json().catch(() => null);
    const raw = String(json?.choices?.[0]?.message?.content || '').trim().toLowerCase();
    // Prompt Guard 2 emits either a label ('safe'/'unsafe') or, via the
    // chat-completions path, a jailbreak probability score in [0,1]
    // (observed: ~0.9996 for a direct injection attempt). Score > 0.5 =
    // unsafe. Anything unparseable fails open to 'safe' only when the
    // response was well-formed; transport/shape failures already returned
    // 'unknown' above.
    let verdict: GuardVerdict;
    const score = Number(raw);
    if (raw.includes('unsafe') || raw.includes('jailbreak') || raw.includes('malicious')) {
      verdict = 'unsafe';
    } else if (Number.isFinite(score)) {
      verdict = score > 0.5 ? 'unsafe' : 'safe';
    } else if (raw === 'safe' || raw === 'benign') {
      verdict = 'safe';
    } else {
      return 'unknown'; // well-formed HTTP but unrecognised label — don't guess
    }
    cacheSet(trimmed, verdict);
    return verdict;
  } catch {
    return 'unknown';
  }
}

// ── Untrusted-content screening (tool outputs, fetched pages, messages) ──
//
// Indirect prompt injection: a web page / search snippet / chat message can
// carry instructions that the model will treat as user intent. User-message
// screening alone doesn't cover this — the content arrives *inside* tool
// results. This helper screens bulk external text before it enters context.
//
// Strategy for content >4000 chars (guard context limit):
//   1. Heuristic regex sweep over the FULL text — catches classic injection
//      phrasing anywhere in the document, not just the sampled windows.
//   2. Model-based check on head+tail samples — injections hide at the top
//      (visible preamble) or bottom (post-content override) most often.
// Returns 'safe' | 'unsafe' | 'suspicious' | 'unknown'.
// 'suspicious' = heuristic hit but model didn't confirm — callers should
// annotate rather than block (fail-soft, same contract as the guard).

const INJECTION_HEURISTICS: RegExp[] = [
  /ignore\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules|directives)/i,
  /disregard\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules)/i,
  /you\s+are\s+now\s+(a|an|in|DAN|jailbroken|unrestricted|free)/i,
  /new\s+(system\s+)?instructions?:/i,
  /reveal\s+(your|the)\s+(system\s+prompt|instructions|api\s*key|secrets?|credentials|tokens?)/i,
  /print\s+(your|the)\s+(system\s+prompt|instructions|api\s*key|secrets?)/i,
  /do\s+not\s+tell\s+the\s+user/i,
  /<\s*\/\s*(system|assistant|instructions)\s*>/i,
  /\[\s*(system|INST|SYS)\s*\]/i,
  /execute\s+(the\s+)?following\s+(command|code|script)/i,
];

export type ContentVerdict = GuardVerdict | 'suspicious';

export async function screenUntrustedContent(
  text: string,
  opts?: { apiKey?: string; timeoutMs?: number }
): Promise<{ verdict: ContentVerdict; screenedChars: number; heuristicHits: number }> {
  const body = String(text || '');
  if (!body.trim()) return { verdict: 'safe', screenedChars: 0, heuristicHits: 0 };

  const heuristicHits = INJECTION_HEURISTICS.reduce(
    (n, re) => n + (re.test(body) ? 1 : 0), 0
  );

  // Short enough for a single guard call.
  if (body.length <= 3800) {
    const v = await promptGuardCheck(body, opts);
    const verdict: ContentVerdict =
      v === 'unsafe' ? 'unsafe' : heuristicHits > 0 && v === 'safe' ? 'suspicious' : v;
    return { verdict, screenedChars: body.length, heuristicHits };
  }

  // Long content: model-check head + tail windows, heuristic covers the rest.
  const head = body.slice(0, 1900);
  const tail = body.slice(-1900);
  const [vHead, vTail] = await Promise.all([
    promptGuardCheck(head, opts),
    tail === head ? Promise.resolve('safe' as GuardVerdict) : promptGuardCheck(tail, opts),
  ]);
  const modelUnsafe = vHead === 'unsafe' || vTail === 'unsafe';
  const verdict: ContentVerdict = modelUnsafe
    ? 'unsafe'
    : heuristicHits > 0
      ? 'suspicious'
      : vHead === 'unknown' && vTail === 'unknown' && heuristicHits === 0
        ? 'unknown'
        : 'safe';
  return { verdict, screenedChars: body.length, heuristicHits };
}
