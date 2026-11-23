/**
 * Landing Nexus TTS prosody — duplicated from `NexusVoiceCallContext` logic (do not import context here).
 * Keeps Voice Resonance / `useVoiceStream` aligned with marketing guest voice without touching protected files.
 */

import { normalizeTechnicalTokensForSpeech } from './tts-lexicon';

export const NEXUS_LANDING_KOKORO_VOICE_ID = 'cortana';

type SentenceKind = 'exclamation' | 'question' | 'statement';

export interface NexusProsodySegment {
  text: string;
  kind: SentenceKind;
  voice: string;
  speed: number;
}

const PROSODY_MAP: Record<SentenceKind, { voice: string; speed: number }> = {
  exclamation: { voice: NEXUS_LANDING_KOKORO_VOICE_ID, speed: 1.04 },
  question: { voice: NEXUS_LANDING_KOKORO_VOICE_ID, speed: 1.02 },
  statement: { voice: NEXUS_LANDING_KOKORO_VOICE_ID, speed: 0.97 },
};

/** Same order as `NexusVoiceCallContext.ttsVoiceCandidates`. */
export function nexusKokoroVoiceCandidates(primary: string): string[] {
  const rest = ['natural', 'nexus', 'professional'].filter((v) => v !== primary);
  return [primary, ...rest];
}

/** Markdown / UI → spoken English (matches landing). */
export function sanitizeForNexusTTS(raw: string): string {
  let s = raw;
  // URLs → spoken domain form; emoji/symbols → dropped (Kokoro speaks them
  // as garbage or silence). Bare domains keep their name, path dropped.
  s = s.replace(/https?:\/\/[^\s)]+/gi, (u) => {
    try { return new URL(u).hostname.replace(/^www\./, '') + '.'; } catch { return ''; }
  });
  s = s.replace(/\b(?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|dev|app|co|edu|gov)(?:\/[^\s)]*)?/gi, (d) => d.split('/')[0] + '.');
  // Emoji & pictographs (Supplemental Symbols, Emoticons, Transport, Dingbats)
  s = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, '');
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
  s = s.replace(/\*\*(.+?)\*\*/g, '$1');
  s = s.replace(/\*(.+?)\*/g, '$1');
  s = s.replace(/__(.+?)__/g, '$1');
  // Technical tokens (dotenvx, vite.config.ts, snake_case, env vars)
  // must be spoken-form BEFORE the single-underscore italic rule, which
  // would otherwise fuse snake_case identifiers into one mangled word.
  s = normalizeTechnicalTokensForSpeech(s);
  s = s.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '$1');
  s = s.replace(/~~(.+?)~~/g, '$1');
  s = s.replace(/`([^`]+?)`/g, '$1');
  s = s.replace(/\[([^\]]+?)\]\([^)]+?\)/g, '$1');
  s = s.replace(/^#{1,6}\s+/gm, '');
  s = s.replace(/^[*•\-]\s+/gm, '');
  s = s.replace(/^\d+[.)]\s+/gm, '');
  s = s.replace(/^>\s+/gm, '');
  s = s.replace(/(\d+)\s*[-–—]\s*(\d+)/g, '$1 to $2');
  s = s.replace(/(\d+)-(minute|hour|day|week|month|year|step|star|point|page|item|person|seat)/gi, '$1 $2');
  s = s.replace(/\$(\d+(?:,\d{3})*(?:\.\d+)?)\s*\/(\w+)/g, '$1 dollars per $2');
  s = s.replace(/\$(\d+(?:,\d{3})*(?:\.\d+)?)/g, '$1 dollars');
  s = s.replace(/\/month/gi, ' per month');
  s = s.replace(/\/year/gi, ' per year');
  s = s.replace(/\/user/gi, ' per user');
  s = s.replace(/\/day/gi, ' per day');
  s = s.replace(/\/hour/gi, ' per hour');
  s = s.replace(/\/week/gi, ' per week');
  s = s.replace(/(\d+)\s*%/g, '$1 percent');
  s = s.replace(/\s*&\s*/g, ' and ');
  s = s.replace(/\s*\+\s*/g, ' and ');
  s = s.replace(/#(\d+)/g, 'number $1');
  s = s.replace(/\be\.g\.\s*/gi, 'for example, ');
  s = s.replace(/\bi\.e\.\s*/gi, 'that is, ');
  s = s.replace(/\betc\.\s*/gi, 'and so on. ');
  s = s.replace(/\bvs\.?\s/gi, 'versus ');
  s = s.replace(/\bw\/o\b/gi, 'without');
  s = s.replace(/(?<!\w)w\/(?!\w)/gi, 'with');
  s = s.replace(/\bhr\b(?!e)/gi, 'hour');
  s = s.replace(/\bhrs\b/gi, 'hours');
  s = s.replace(/\bmin\b(?![\w])/gi, 'minute');
  s = s.replace(/\bmins\b/gi, 'minutes');
  s = s.replace(/\binfo\b/gi, 'information');
  s = s.replace(/\basap\b/gi, 'as soon as possible');
  s = s.replace(/\b24\/7\b/g, 'twenty-four seven');
  s = s.replace(/([A-Z]{2,})\/([A-Z]{2,})/g, '$1 or $2');

  // Conversational dialogue contractions (guarantees spoken warmth even if written formal)
  s = s.replace(/\bI am\b/g, "I'm");
  s = s.replace(/\bi am\b/g, "I'm");
  s = s.replace(/\bdo not\b/gi, "don't");
  s = s.replace(/\bcannot\b/gi, "can't");
  s = s.replace(/\bcan not\b/gi, "can't");
  s = s.replace(/\bit is\b/gi, "it's");
  s = s.replace(/\bthat is\b/gi, "that's");
  s = s.replace(/\bthere is\b/gi, "there's");
  s = s.replace(/\bwe will\b/gi, "we'll");
  s = s.replace(/\bwe are\b/gi, "we're");
  s = s.replace(/\byou will\b/gi, "you'll");
  s = s.replace(/\byou are\b/gi, "you're");
  s = s.replace(/\bwhat is\b/gi, "what's");
  s = s.replace(/\blet us\b/gi, "let's");
  s = s.replace(/\bwould not\b/gi, "wouldn't");
  s = s.replace(/\bcould not\b/gi, "couldn't");
  s = s.replace(/\bshould not\b/gi, "shouldn't");
  s = s.replace(/\bhas not\b/gi, "hasn't");
  s = s.replace(/\bhave not\b/gi, "haven't");
  s = s.replace(/\bis not\b/gi, "isn't");
  s = s.replace(/\bare not\b/gi, "aren't");

  s = s.replace(/\s*[—–]\s*/g, ', ');
  s = s.replace(/\s*--\s*/g, ', ');
  s = s.replace(/\.{2,}/g, '.');
  s = s.replace(/…/g, '.');
  s = s.replace(/;/g, '.');
  s = s.replace(/\(([^)]{1,80})\)/g, ', $1,');
  s = s.replace(/,\s*,/g, ',');
  s = s.replace(/,([.!?])/g, '$1');
  s = s.replace(/([.!?])\s*\./g, '$1');
  s = s.replace(/!\./g, '!');
  s = s.replace(/\?\./g, '?');
  s = s.replace(/\.\s*\./g, '.');
  s = s.replace(/\s+([.,!?])/g, '$1');
  s = s.replace(/([.,!?])\1+/g, '$1');
  s = s.replace(/\bSyncScript's\b/gi, 'SyncScript');
  s = s.replace(/\bSyncScripts\b/gi, 'SyncScript');
  s = s.replace(/\bSync Script\b/gi, 'SyncScript');
  s = s.replace(/\bSyncScript\b/gi, 'SyncScript');
  s = s.replace(/\s{2,}/g, ' ');
  s = s.trim();
  return s;
}

function classifySentence(text: string): SentenceKind {
  const t = text.trim();
  if (t.endsWith('!')) return 'exclamation';
  if (t.endsWith('?')) return 'question';
  return 'statement';
}

function splitToSentences(text: string): string[] {
  const parts = text.match(/[^.!?]*[.!?]+[\s]*/g);
  if (!parts) return text.trim() ? [text.trim()] : [];
  const consumed = parts.join('');
  const remainder = text.slice(consumed.length).trim();
  const out = parts.map((s) => s.trim()).filter(Boolean);
  if (remainder) out.push(remainder);
  return out;
}

/** Merge short sentences so Kokoro does not receive comically tiny clips (matches landing). */
export function buildNexusSpeechChunks(text: string): string[] {
  const sentences = splitToSentences(text);
  if (sentences.length <= 1) return sentences;

  const chunks: string[] = [];
  let buffer = '';

  const flush = () => {
    if (!buffer.trim()) return;
    chunks.push(buffer.trim());
    buffer = '';
  };

  for (let i = 0; i < sentences.length; i++) {
    const current = sentences[i].trim();
    const candidate = buffer ? `${buffer.replace(/[.!?]+$/, ',')} ${current}` : current;

    const wordCount = candidate.split(/\s+/).filter(Boolean).length;
    const tooLong = wordCount > 22 || candidate.length > 140;

    if (tooLong) {
      flush();
      buffer = current;
      continue;
    }

    buffer = candidate;
  }

  flush();
  return chunks.length ? chunks : sentences;
}

export function sentenceToNexusProsodySegment(sentence: string): NexusProsodySegment {
  const base = sanitizeForNexusTTS(sentence);
  const sanitized = /[.!?]$/.test(base) ? base : `${base}.`;
  const kind = classifySentence(sanitized);
  const { voice, speed } = PROSODY_MAP[kind];
  return { text: sanitized, kind, voice, speed };
}

/** Full reply → per-chunk segments with landing prosody. */
export function buildNexusProsodySegmentsForSpeech(fullText: string): NexusProsodySegment[] {
  const cleaned = sanitizeForNexusTTS(fullText);
  if (!cleaned.trim()) return [];
  return buildNexusSpeechChunks(cleaned).map((chunk) => sentenceToNexusProsodySegment(chunk));
}
