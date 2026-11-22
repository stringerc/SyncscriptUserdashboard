/**
 * cortex-agent/intentions — the Intention Kernel ledger.
 *
 * Cortex's declared intents ("I can pull the docs", "want me to check…")
 * become first-class, governed, resumable objects instead of dangling prose.
 * When the user affirms ("go ahead", "yes", "do it"), the pending intention
 * is consumed deterministically — the agentic loop executes it without
 * relying on the model re-emitting a correctly-formatted tool call.
 *
 * Persisted at .cortex-runtime/intentions.json so intent survives reloads
 * and works across surfaces sharing a sessionId.
 */
import fs from 'node:fs';
import path from 'node:path';

const RUNTIME_DIR = path.join(process.cwd(), '.cortex-runtime');
const LEDGER_FILE = path.join(RUNTIME_DIR, 'intentions.json');
const TTL_MS = 15 * 60 * 1000;

export interface PendingIntention {
  id: string;
  sessionId: string;
  /** Tool the assistant offered to run. */
  tool: string;
  /** Best-effort args extracted from the offer text; {} when unclear —
   *  the agentic loop's first LLM step completes them. */
  args: Record<string, unknown>;
  /** The assistant text that created the offer (audit trail). */
  offerText: string;
  status: 'pending' | 'consumed' | 'expired' | 'declined';
  createdAt: number;
  consumedAt?: number;
}

interface LedgerFile {
  intentions: PendingIntention[];
}

function loadLedger(): LedgerFile {
  try {
    if (fs.existsSync(LEDGER_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
      if (parsed && Array.isArray(parsed.intentions)) return parsed;
    }
  } catch {}
  return { intentions: [] };
}

function saveLedger(ledger: LedgerFile): void {
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
  } catch {}
}

function sweep(ledger: LedgerFile, now = Date.now()): void {
  for (const i of ledger.intentions) {
    if (i.status === 'pending' && now - i.createdAt > TTL_MS) i.status = 'expired';
  }
}

// ── Affirmation detection ─────────────────────────────────────────

const AFFIRMATION_RE = new RegExp(
  '^\\s*(?:' +
    'yes|yeah|yep|yup|sure|ok(?:ay)?|go ahead|go for it|do it|proceed|please do|confirm(?:ed)?|' +
    'sounds good|let\'s do it|lets do it|absolutely|affirmative|why not|please proceed|' +
    'go ahead and (?:do|run|search|check|fetch|pull|look|find|execute|try)[^.?!]*|' +
    'do (?:it|that|the|this)[^.?!]*' +
  ')\\s*[.!?]*\\s*$',
  'i'
);

/** True when the user turn is a bare affirmation of a pending offer.
 *  Conservative: only short turns — a long message is a new instruction. */
export function isAffirmation(text: string): boolean {
  const t = String(text || '').trim();
  if (!t || t.length > 120) return false;
  return AFFIRMATION_RE.test(t);
}

// ── Offer / intention detection ───────────────────────────────────

/** Tools the model is known to name in prose. Order matters — longer /
 *  more specific names first so "cortex_memory" beats "memory". */
const KNOWN_TOOLS = [
  'cortex_skill_discovery', 'inspect_visual_canvas', 'get_somatic_homeostasis',
  'cortex_dream_consolidate', 'cortex_phone_call', 'generate_splat',
  'compose_dashboard', 'cortex_surface', 'cortex_map', 'emit_artifact',
  'emit_surface', 'fetch_url', 'web_search', 'search_code', 'run_command',
  'read_file', 'write_file', 'edit_file', 'list_dir', 'chrome_control',
  'cortex_memory', 'cortex_agents', 'remember_fact', 'recall_facts',
  'system_info', 'resonance_status', 'create_document', 'create_spreadsheet',
  'scaffold_web_project', 'sandbox_status', 'run_sandboxed',
];

/** Frames that mark a statement as an OFFER/INTENTION rather than a report. */
const OFFER_FRAME_RE = new RegExp(
  '(?:' +
    'i(?:\'ll| will| can| could| am going to|\'d be happy to| should probably| need to| must)|' +
    'let me|i suggest (?:you |that you )?(?:use|try|let me|i can)|' +
    'want me to|shall i|should i|if you(?:\'d| would) like|just let me know|' +
    'i can (?:immediately |go ahead and |now )?(?:pull|fetch|search|check|look up|run|read|inspect|verify|grab|retrieve|get|open|navigate|compile|generate|draft)|' +
    'i\'ll (?:immediately |now |go ahead and |run |search |fetch |check |pull |look |read |inspect |verify |open |navigate |compile |generate |draft )' +
  ')',
  'i'
);

/** Extract the first URL from text (for fetch_url / open_url args). */
function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s"'`)<>)\]]+/i);
  return m ? m[0].replace(/[.,;:!?)\]]+$/, '') : null;
}

/** Extract a quoted or bare shell-ish command. */
function extractCommand(text: string): string | null {
  const q = text.match(/["'`]([^"'`\n]{4,200})["'`]/);
  if (q && /[\s/&|;]/.test(q[1])) return q[1].trim();
  const bare = text.match(/\b(?:run|execute)\s+(?:the\s+)?(?:command\s+)?[`'"]?([a-zA-Z0-9_./~-]+(?:\s+[a-zA-Z0-9_./~:-]+){0,8})[`'"]?/i);
  return bare ? bare[1].trim() : null;
}

/** Extract a file path mention. */
function extractPath(text: string): string | null {
  const m = text.match(/[`'"]?((?:[\w.-]+\/)+[\w.-]+\.[a-zA-Z0-9]{1,8}|[\w.-]+\.(?:ts|tsx|js|jsx|py|md|json|css|html|sh|mjs|toml|yaml|yml))[`'"]?/);
  return m ? m[1] : null;
}

export interface DetectedOffer {
  tool: string;
  args: Record<string, unknown>;
  /** Which tool-name matched, for audit. */
  matchedTool: string;
}

/**
 * Inspect assistant text for an unfulfilled tool intention.
 * Returns the implied tool call, or null when the text is a report/answer
 * or contains no recognizable offer.
 */
export function detectOffer(text: string): DetectedOffer | null {
  const t = String(text || '');
  if (!t.trim()) return null;
  // Never treat an actual emitted tool_call block as an offer.
  if (/```tool_call|<tool_call|function_call/i.test(t)) return null;
  if (!OFFER_FRAME_RE.test(t)) return null;

  // Prefer explicit tool names; else infer from verbs.
  let tool: string | null = null;
  const lower = t.toLowerCase();
  for (const name of KNOWN_TOOLS) {
    if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t)) {
      tool = name;
      break;
    }
  }
  if (!tool) {
    if (/\b(?:web[\s_-]?search|search the web|look\s?up|google)\b/i.test(t)) tool = 'web_search';
    else if (/\bfetch\b/i.test(t) && extractUrl(t)) tool = 'fetch_url';
    else if (/\b(?:run|execute)\b/i.test(t) && /command|script|terminal|shell/i.test(t)) tool = 'run_command';
    else if (/\b(?:read|inspect|check|open)\b/i.test(t) && extractPath(t)) tool = 'read_file';
    else if (/\bsearch(?:ing)?\s+(?:the\s+)?(?:code|codebase|repo|files)\b/i.test(t)) tool = 'search_code';
  }
  if (!tool) return null;

  const args: Record<string, unknown> = {};
  const url = extractUrl(t);
  if (url && (tool === 'fetch_url' || tool === 'chrome_control')) {
    if (tool === 'fetch_url') args.url = url;
    else { args.action = 'open_url'; args.url = url; }
  }
  if (tool === 'run_command') {
    const cmd = extractCommand(t);
    if (cmd) args.command = cmd;
  }
  if (tool === 'read_file' || tool === 'write_file' || tool === 'edit_file') {
    const p = extractPath(t);
    if (p) args.path = p;
  }
  if (tool === 'web_search' || tool === 'search_code') {
    // Best-effort query: the noun phrase after search/fetch/look up for.
    const q = t.match(/(?:search(?:ing)?|look\s?up|fetch|pull|find|check)(?:\s+the\s+web|\s+online|\s+for|\s+about|\s+on)?\s*["'`]?([^"'`.\n!?]{4,160})["'`]?/i);
    if (q) args.query = q[1].replace(/\s+(?:tool|page|docs?|documentation|site|website|information|info)\b.*$/i, '').trim();
  }

  return { tool, args, matchedTool: tool };
}

// ── Ledger operations ──────────────────────────────────────────────

export function recordOffer(sessionId: string, offer: DetectedOffer, offerText: string): PendingIntention {
  const ledger = loadLedger();
  sweep(ledger);
  // One pending intention per session — a newer offer supersedes the old.
  for (const i of ledger.intentions) {
    if (i.sessionId === sessionId && i.status === 'pending') i.status = 'consumed';
  }
  const intention: PendingIntention = {
    id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    tool: offer.tool,
    args: offer.args,
    offerText: offerText.slice(0, 500),
    status: 'pending',
    createdAt: Date.now(),
  };
  ledger.intentions.push(intention);
  // Bound ledger size.
  ledger.intentions = ledger.intentions.slice(-200);
  saveLedger(ledger);
  return intention;
}

/** Consume the pending intention for a session on affirmation.
 *  Returns the intention (status → consumed) or null. */
export function takeAffirmed(sessionId: string): PendingIntention | null {
  const ledger = loadLedger();
  sweep(ledger);
  const pending = [...ledger.intentions].reverse().find(
    i => i.sessionId === sessionId && i.status === 'pending'
  );
  if (!pending) { saveLedger(ledger); return null; }
  pending.status = 'consumed';
  pending.consumedAt = Date.now();
  saveLedger(ledger);
  return pending;
}

/** Peek without consuming (for status surfaces). */
export function peekPending(sessionId: string): PendingIntention | null {
  const ledger = loadLedger();
  sweep(ledger);
  const pending = [...ledger.intentions].reverse().find(
    i => i.sessionId === sessionId && i.status === 'pending'
  );
  return pending || null;
}

export function declineIntention(sessionId: string): boolean {
  const ledger = loadLedger();
  sweep(ledger);
  const pending = [...ledger.intentions].reverse().find(
    i => i.sessionId === sessionId && i.status === 'pending'
  );
  if (!pending) return false;
  pending.status = 'declined';
  saveLedger(ledger);
  return true;
}
