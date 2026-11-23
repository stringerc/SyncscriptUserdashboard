/**
 * Reflex Arc — deterministic intent pre-compilation.
 *
 * Cortex's wish: zero cognitive friction between intent and execution.
 * The agentic loop normally spends a full LLM generation just to *emit*
 * the tool_call before execution can start. For unambiguous commands —
 * "search for X", "read file Y", "what's the system status" — that
 * generative step is pure latency with no decision value.
 *
 * This module is the spinal cord: pattern-match the raw utterance to a
 * tool+args with HIGH PRECISION, and the caller seeds it as
 * initialToolCall — the governed tool executes immediately and the
 * model's first (and only required) job is to speak the answer.
 *
 * Precision over recall is the contract: a false positive fires the
 * wrong tool autonomously. Every pattern is anchored to the whole
 * message, length-capped, and single-intent. Anything ambiguous falls
 * through to the model — reflexes handle reflexes, cortex handles
 * everything else.
 */

export interface ReflexResult {
  name: string;
  args: Record<string, unknown>;
  /** Which pattern fired — for telemetry/audit. */
  pattern: string;
}

const MAX_LEN = 400;

function clip(s: string, n = 200): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) : t;
}

/** Strip a single layer of wrapping quotes/punctuation from an extracted arg. */
function unquote(s: string): string {
  return s.trim().replace(/^["'“”‘’`]+|["'“”‘’`.!?]+$/g, '').trim();
}

export function precompileReflex(raw: string): ReflexResult | null {
  const text = String(raw || '').trim();
  if (!text || text.length > MAX_LEN || text.includes('\n')) return null;
  const t = text;

  // ── 1. Explicit shell command in backticks ──────────────────────
  // "run `ls -la`" — the backtick delimiter makes intent unambiguous.
  let m = t.match(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:run|execute)\s+(?:(?:this|the|following)\s+)?(?:command\s+)?[:\s]*`([^`\n]{1,300})`\s*[.!?]?$/i);
  if (m) return { name: 'run_command', args: { command: m[1].trim() }, pattern: 'backtick-command' };

  // ── 2. Weather ──────────────────────────────────────────────────
  m = t.match(/^(?:what'?s|what is|how'?s|check|tell me|give me|get me|whats)\s+(?:the\s+|current\s+)?(?:weather|forecast|temperature)(?:\s+(?:in|at|for|near)\s+(.+?))?\s*[?.!]?$/i);
  if (m) {
    const loc = m[1] ? unquote(m[1]) : '';
    const args: Record<string, unknown> = {};
    if (loc && !/^(here|local|current|outside)\b/i.test(loc)) args.location = loc;
    else if (/^(here|local|current)\b/i.test(loc) || /\b(here|local)\b/i.test(t)) args.location = 'here';
    return { name: 'get_weather', args, pattern: 'weather' };
  }

  // ── 3. System info / host status ────────────────────────────────
  m = t.match(/^(?:what'?s|what is|check|show|get|run|give me|tell me|how'?s)\s+(?:the\s+|me\s+(?:the\s+)?)?(?:system|host|machine|mac|server)\s*(?:info|status|health|stats|specs|diagnostics?|report)?\s*[?.!]?$/i);
  if (m) return { name: 'system_info', args: {}, pattern: 'system-info' };
  m = t.match(/^how'?s\s+(?:the\s+)?(?:fleet|cortex|resonance|coherence)\b.*$/i);
  if (m) return { name: 'resonance_status', args: {}, pattern: 'resonance' };

  // ── 4. Clipboard ────────────────────────────────────────────────
  m = t.match(/^(?:what'?s|what is|read|get|show|tell me)\s+(?:in\s+)?(?:the\s+)?clipboard\s*[?.!]?$/i);
  if (m) return { name: 'get_clipboard', args: {}, pattern: 'clipboard' };

  // ── 5. Code search — BEFORE web_search so "search the codebase"
  // doesn't get swallowed as a web query. ──────────────────────────
  m = t.match(/^(?:please\s+)?(?:search|grep|find|look)\s+(?:the\s+)?(?:code(?:base)?|source|repo(?:sitory)?|files?)\s+(?:for\s+|containing\s+)?["'“”]?(.+?)["'“”]?\s*[?.!]?$/i);
  if (m) {
    const q = unquote(m[1]);
    if (q.length >= 2) return { name: 'search_code', args: { query: clip(q) }, pattern: 'code-search' };
  }

  // ── 6. Web search — explicit search verbs only ──────────────────
  // "find out X" deliberately excluded (that's a question, not a command).
  // Code/repo terms excluded — those belong to search_code above.
  if (!/\b(?:codebase|source\s+code|repo(?:sitory)?|the\s+code|files?)\b/i.test(t)) {
    m = t.match(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:search(?:\s+(?:the\s+)?(?:web|online|google|internet|net))?(?:\s+for)?|google|look\s+up)\s+["'“”]?(.+?)["'“”]?\s*[?.!]?$/i);
    if (m) {
      const q = unquote(m[1]);
      if (q.length >= 3) return { name: 'web_search', args: { query: clip(q) }, pattern: 'web-search' };
    }
  }

  // ── 7. File read — token with an extension ──────────────────────
  // URLs excluded; bare filenames OK (PLAN.md) but the end anchor keeps
  // prose like "read the report." or "show me version 2.0" from firing.
  m = t.match(/^(?:please\s+)?(?:(?:can|could)\s+you\s+)?(?:read|open|show(?:\s+me)?|cat|display|print)\s+(?:the\s+|me\s+the\s+)?(?:file\s+|contents\s+of\s+|content\s+of\s+)?[`'"]?([~\w.\-/]*\w+\.\w{1,10})[`'"]?\s*[?.!]?$/i);
  if (m && !/^https?:/i.test(m[1]) && /[a-zA-Z]/.test(m[1])) {
    return { name: 'read_file', args: { path: m[1].trim() }, pattern: 'read-file' };
  }

  // ── 8. Directory listing ────────────────────────────────────────
  m = t.match(/^(?:please\s+)?(?:list|show)\s+(?:me\s+)?(?:the\s+)?(?:files|contents|directory|dir|folder)(?:\s+(?:in|of|at|inside)\s+[`'"]?([./~\w][\w./\-]*?)[`'"]?)?\s*[?.!]?$/i);
  if (m) return { name: 'list_dir', args: { path: (m[1] || '.').trim() }, pattern: 'list-dir' };

  // ── 9. URL fetch/read — content verbs + explicit URL ────────────
  // Trailing clauses are safe: the model still sees the full user
  // message after the tool result, so "fetch URL and tell me the title"
  // reflexes the fetch and the model handles the rest.
  const urlM = t.match(/^(?:please\s+)?(?:fetch|pull\s+up|read|check(?:\s+out)?|look\s+at|summari[sz]e|browse|get|open|go\s+to)\s+<?(https?:\/\/[^\s>]+)>?(?:\s+.{3,})?\s*[?.!]?$/i);
  if (urlM) {
    const url = urlM[1].replace(/'/g, '');
    if (/^(?:please\s+)?(?:open|go\s+to)\b/i.test(t.trim())) {
      return { name: 'open_app', args: { name: 'Google Chrome', target: url }, pattern: 'open-url' };
    }
    // Content verbs → curl through the governed run_command path.
    return { name: 'run_command', args: { command: `curl -sL --max-time 25 '${url}'` }, pattern: 'fetch-url' };
  }

  // ── 10. Bare URL paste — informational intent dominates ─────────
  m = t.match(/^(https?:\/\/\S{4,300})(?:\s+.{3,})?\s*[?.!]?$/);
  if (m) {
    const url = m[1].replace(/'/g, '');
    return { name: 'run_command', args: { command: `curl -sL --max-time 25 '${url}'` }, pattern: 'bare-url' };
  }

  return null;
}
