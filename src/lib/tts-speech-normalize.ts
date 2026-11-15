/**
 * normalizeForSpeech — deterministic text→speakable-text pass applied once
 * in /api/cortex/tts before fan-out to Pocket TTS / Kokoro / F5-RVC.
 *
 * Fixes the highest-frequency sources of "suddenly robotic" delivery:
 * identifiers, abbreviations, acronyms, symbols, and markup that TTS models
 * mispronounce or spell out awkwardly. Pure function — no model, no network.
 * Conservative by design: when unsure, leave the text alone.
 */

/** Spelled-out forms for tokens TTS consistently mangles. */
const ACRONYM_MAP: Record<string, string> = {
  API: 'A P I', SDK: 'S D K', URL: 'U R L', URI: 'U R I',
  JSON: 'J son', HTML: 'H T M L', CSS: 'C S S', DOM: 'D O M',
  UI: 'U I', UX: 'U X', GPU: 'G P U', CPU: 'C P U', RAM: 'R A M',
  TTS: 'T T S', STT: 'S T T', VAD: 'V A D', SSE: 'S S E',
  LLM: 'L L M', SQL: 'S Q L', DB: 'D B', ID: 'I D',
  AI: 'A I', ML: 'M L', RAG: 'R A G',
  OK: 'okay', VS: 'versus', ETC: 'et cetera',
};

/** Cortex-domain jargon that generic TTS misreads. */
const JARGON_MAP: Record<string, string> = {
  'free energy': 'free energy', // already speakable — kept for clarity
  'cortex-signal-bus': 'cortex signal bus',
  'webgl': 'web G L',
  'websocket': 'web socket',
  'e.g.': 'for example',
  'i.e.': 'that is',
  'vs.': 'versus',
  'etc.': 'et cetera',
};

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
const MD_LINK_RE = /\[([^\]]*)\]\(([^)]*)\)/g;
const MD_BOLD_RE = /\*\*([^*]+)\*\*/g;
const MD_CODE_RE = /`([^`]+)`/g;
const SNAKE_RE = /\b([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+)\b/g;
const CAMEL_RE = /\b([a-z][a-z0-9]*(?:[A-Z][a-z0-9]*){2,})\b/g;
const KEBAB_IDENT_RE = /\b([a-z][a-z0-9]*(?:-[a-z0-9]+){2,})\b/g;
const PERCENT_RE = /(\d+(?:\.\d+)?)\s*%/g;
const DOLLAR_RE = /\$(\d+(?:\.\d+)?)/g;
const VERSION_RE = /\bv(\d+\.\d+(?:\.\d+)?)\b/g;
const PHI_RE = /[Φφ]/g;
const NEWLINE_RE = /\n+/g;

export function normalizeForSpeech(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let t = input;

  // 1. Markdown → spoken text: links keep label, code/bold keep content.
  t = t.replace(MD_LINK_RE, '$1');
  t = t.replace(MD_CODE_RE, '$1');
  t = t.replace(MD_BOLD_RE, '$1');

  // 2. Strip emoji — TTS reads them as "grinning face" etc.
  t = t.replace(EMOJI_RE, ' ');

  // 3. Identifiers → speakable words.
  t = t.replace(SNAKE_RE, (_m, w: string) => w.replace(/_/g, ' '));
  t = t.replace(CAMEL_RE, (_m, w: string) =>
    w.replace(/([a-z0-9])([A-Z])/g, '$1 $2'));
  t = t.replace(KEBAB_IDENT_RE, (_m, w: string) => w.replace(/-/g, ' '));

  // 4. Symbols & formatting.
  t = t.replace(PERCENT_RE, '$1 percent');
  t = t.replace(DOLLAR_RE, '$1 dollars');
  t = t.replace(VERSION_RE, 'version $1');
  t = t.replace(PHI_RE, 'phi');
  t = t.replace(NEWLINE_RE, '. ');

  // 5. Phrase-level jargon, then word-level acronyms (longest first so
  //    'e.g.' is consumed before the acronym pass sees 'g').
  for (const [k, v] of Object.entries(JARGON_MAP)) {
    t = t.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), v);
  }
  t = t.replace(/\b[A-Z]{2,5}\b/g, (m) => ACRONYM_MAP[m] ?? m);

  // 6. Cleanup: collapse whitespace, orphan punctuation, stray dots.
  t = t.replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:]){2,}/g, '$1')
    .replace(/\.\s*\.\s*\./g, '…')
    .trim();

  return t;
}
