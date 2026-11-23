/**
 * Technical-token → spoken-English normalizer for TTS.
 *
 * Kokoro pronounces identifiers literally: "dotenvx" comes out mangled,
 * "vite.config.ts" becomes "vite dot config dot ts"-ish noise, and
 * ALL_CAPS env vars are spelled as garbage. This module rewrites
 * technical tokens into speakable forms BEFORE the sentence-level
 * sanitizer runs its punctuation/abbreviation passes.
 *
 * Shared by NexusVoiceCallContext.sanitizeForTTS (voice path) and
 * nexus-tts-prosody.sanitizeForNexusTTS (landing/visualizer path) —
 * keep both call sites in sync.
 */

/** Exact-match dictionary, applied with word boundaries (case-insensitive). */
const LEXICON: ReadonlyArray<readonly [RegExp, string]> = [
  // Product / project names
  [/\bdotenvx\b/gi, 'dotenv x'],
  [/\bopenclaw\b/gi, 'open claw'],
  [/\bwebhook(s)?\b/gi, 'web hook$1'],
  [/\bregex\b/gi, 'reg ex'],
  [/\blocalhost\b/gi, 'local host'],
  // File formats / data names
  [/\bjsonl\b/gi, 'jay son line'],
  [/\bjson\b/gi, 'jay son'],
  [/\byaml\b/gi, 'yamel'],
  [/\btoml\b/gi, 'tommel'],
  // Common acronyms — spelled so TTS says the letters, not a mangled word
  [/\bAPI(s)?\b/g, 'A P I$1'],
  [/\bURL(s)?\b/g, 'U R L$1'],
  [/\bURI(s)?\b/g, 'U R I$1'],
  [/\bHTTP(s)?\b/g, 'H T T P$1'],
  [/\bJSON\b/g, 'J S O N'],
  [/\bSQL\b/g, 'S Q L'],
  [/\bCLI\b/g, 'C L I'],
  [/\bSDK(s)?\b/g, 'S D K$1'],
  [/\bTTS\b/g, 'T T S'],
  [/\bLLM(s)?\b/g, 'L L M$1'],
  [/\bGPU(s)?\b/g, 'G P U$1'],
  [/\bCPU(s)?\b/g, 'C P U$1'],
  [/\bRAM\b/g, 'R A M'],
  [/\bSSH\b/g, 'S S H'],
  [/\bDNS\b/g, 'D N S'],
  [/\bTLS\b/g, 'T L S'],
  [/\bSSL\b/g, 'S S L'],
  [/\bHTML?\b/g, 'H T M L'],
  [/\bCSS\b/g, 'C S S'],
  [/\bXML\b/g, 'X M L'],
  [/\bPDF(s)?\b/g, 'P D F$1'],
  [/\bCSV(s)?\b/g, 'C S V$1'],
  [/\bJWT(s)?\b/g, 'J W T$1'],
  [/\bID(s)?\b/g, 'I D$1'],
  [/\bUI\b/g, 'U I'],
  [/\bUX\b/g, 'U X'],
  [/\bSLA\b/g, 'S L A'],
  [/\bSLO(s)?\b/g, 'S L O$1'],
  [/\bETA\b/g, 'E T A'],
  [/\bDB(s)?\b/g, 'D B$1'],
  [/\bCRM\b/g, 'C R M'],
  [/\bERP\b/g, 'E R P'],
  [/\bKPI(s)?\b/g, 'K P I$1'],
  [/\bROI\b/g, 'R O I'],
  [/\bVPN\b/g, 'V P N'],
  [/\bAWS\b/g, 'A W S'],
  [/\bGCP\b/g, 'G C P'],
  [/\bNIM\b/g, 'N I M'],
];

/** camelCase / PascalCase → spaced lowercase-ish words. */
function splitCamel(token: string): string {
  return token
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase();
}

/**
 * Rewrite technical tokens into speakable English. Safe to run on
 * already-partially-sanitized text; idempotent for plain prose.
 */
export function normalizeTechnicalTokensForSpeech(input: string): string {
  let s = input;

  // Protect common abbreviations from the dotted-identifier rule —
  // "e.g." would otherwise become "e dot g". Restored verbatim at the
  // end so the caller's own abbreviation passes still handle them.
  const PROTECTED: Record<string, string> = {
    'e.g.': 'EG', 'i.e.': 'IE', 'a.m.': 'AM',
    'p.m.': 'PM', 'etc.': 'ETC', 'vs.': 'VS',
  };
  const restore: Record<string, string> = {};
  for (const [abbr, placeholder] of Object.entries(PROTECTED)) {
    const re = new RegExp(abbr.replace(/\./g, '\\.').replace(/[()]/g, '\\$&'), 'gi');
    s = s.replace(re, () => { restore[placeholder] = abbr; return placeholder; });
  }

  // IPv4 addresses → "one two seven dot zero dot zero dot one"
  s = s.replace(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g,
    (_m, a, b, c, d) => `${a} ${b} ${c} ${d}`.replace(/\s+/g, ' dot '));

  // Dotted version triples (2026.11.7, v1.2.3) → "2026 dot 11 dot 7".
  // Two-segment decimals (3.5) are left alone — those read fine.
  s = s.replace(/\bv?(\d+)\.(\d+)\.(\d+)\b/g, '$1 dot $2 dot $3');

  // Path-like tokens → "slash"-joined spoken form. A token qualifies only
  // with a leading path prefix (./ ../ ~/ /), two or more slashes, or a
  // file extension — so "and/or", "w/", and "AC/DC" survive untouched.
  // http(s) tokens are skipped (the URL rule in the caller handles them,
  // or they are spoken acceptably as-is).
  s = s.replace(/[^\s"'`()\[\]{}<>]+/g, (tok) => {
    if (!tok.includes('/') || /^https?:/i.test(tok)) return tok;
    const slashes = (tok.match(/\//g) || []).length;
    const isPath = /^(?:\.{1,2}\/|~\/|\/)/.test(tok)
      || slashes >= 2
      || /\.[a-z]{1,6}(?:\/|$)/i.test(tok)
      || (/\d/.test(tok) || tok.includes('-')) && /[a-zA-Z]/.test(tok.split('/')[0] || '');
    if (!isPath) return tok;
    return tok
      .replace(/\.\./g, ' dot dot ')
      .replace(/~/g, ' home ')
      .replace(/\//g, ' slash ');
  });

  // Leading-dot filenames (.env.keys, .gitignore) — the dot is silent
  // to TTS unless spoken, so make it explicit before the filename rule.
  s = s.replace(/(^|[\s([{"'`])\.(?=[A-Za-z])/g, '$1dot ');

  // Filename / dotted-identifier tokens: vite.config.ts, package.json,
  // model-registry.json, agent_runtime.ts → "vite config dot ts" etc.
  // Requires a letter-led token so decimals and version numbers survive.
  s = s.replace(/\b[a-zA-Z][\w-]*(?:\.[a-zA-Z][\w-]*)+\b/g, (tok) => {
    return tok
      .split('.')
      .map((seg) => splitCamel(seg).replace(/-/g, ' '))
      .join(' dot ');
  });

  // snake_case / SCREAMING_SNAKE_CASE env vars and identifiers → spaces.
  s = s.replace(/\b[a-zA-Z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+\b/g, (tok) =>
    tok.split('_').map((w) => w.toLowerCase()).join(' '));

  // kebab-case technical ids (nemotron-3-ultra-550b) → spaces. Plain
  // English hyphenations ("real-time", "well-known") become two words,
  // which TTS reads identically.
  s = s.replace(/\b[a-zA-Z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)+\b/g, (tok) =>
    tok.split('-').map((w) => splitCamel(w)).join(' '));

  // Remaining camelCase identifiers (runAgenticTurn, isAffirmation).
  s = s.replace(/\b[a-z]+(?:[A-Z][a-z0-9]*){2,}\b/g, (tok) => splitCamel(tok));

  // Identifier colons (verify:cortex) and ports (host:5173).
  s = s.replace(/([a-zA-Z]):([a-zA-Z])/g, '$1 $2');
  s = s.replace(/:(\d{4,5})\b/g, ' port $1');

  // Negative numbers keep their sign; leftover hyphens are punctuation.
  s = s.replace(/(^|\s)-(?=\d)/g, '$1minus ');
  s = s.replace(/-/g, ' ');

  // Exact-match lexicon last so compound tokens are already spaced —
  // entries still match because \b boundaries survive spacing.
  for (const [re, rep] of LEXICON) s = s.replace(re, rep);

  // Collapse spacing artifacts introduced by slash/dot expansion.
  s = s.replace(/\s{2,}/g, ' ');
  s = s.replace(/\s+([.,!?;:])/g, '$1');

  // Restore protected abbreviations verbatim — the caller's own
  // abbreviation passes (e.g. → "for example") still get their shot.
  for (const [placeholder, abbr] of Object.entries(restore)) {
    s = s.split(placeholder).join(abbr);
  }
  return s;
}
