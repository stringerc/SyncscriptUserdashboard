/**
 * Cortex Efference Copy & Acoustic Echo Cancellation (AEC) Engine
 * 
 * In cognitive neuroscience (IIT / GWT / predictive processing), when the brain
 * sends a motor command to speak (efference), it creates an internal prediction
 * (efference copy) that subtracts self-generated sensory feedback from the auditory cortex.
 * 
 * In full-duplex conversational voice AI (mirroring OpenAI Advanced Voice Mode):
 * 1. Computer speakers output the AI's vocalized speech.
 * 2. The microphone inevitably captures acoustic bleed from the room and speakers.
 * 3. The efference copy engine compares the incoming microphone transcript against
 *    the active AI utterance and recent speech history (last 12 seconds).
 * 4. If the incoming speech matches the efference copy:
 *    → Classified as ACOUSTIC ECHO (`isEcho: true`)
 *    → AI continues vocalizing smoothly without false self-interruption or feedback loops.
 * 5. If the incoming speech diverges (user asks a question, objects, or speaks new words):
 *    → Classified as GENUINE USER BARGE-IN (`isEcho: false`)
 *    → AI immediately cuts audio playback (<20ms latency) and listens to the user.
 */

/**
 * Normalizes text into cleaned lowercase alphanumeric tokens.
 */
export function tokenizeText(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/** Explicit interrupt commands that always trigger instant user barge-in */
export const INTERRUPT_COMMANDS = new Set([
  'stop', 'wait', 'hold', 'pause', 'quiet', 'shut', 'hush', 'cancel',
  'nevermind', 'never', 'enough', 'silence', 'halt', 'abort'
]);

/** Common conversational stop-words used for content-word weighting */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'so', 'as', 'at', 'by',
  'for', 'from', 'in', 'into', 'of', 'off', 'on', 'onto', 'out', 'over', 'to',
  'up', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
  'has', 'had', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'shall',
  'should', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
  'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'our'
]);

export interface EfferenceCheckResult {
  isEcho: boolean;
  matchRatio: number;
  reason: 'explicit_interrupt' | 'corpus_substring' | 'token_overlap' | 'divergent_speech' | 'empty';
}

/**
 * Determines whether an incoming transcript is acoustic echo of the AI speaking
 * through computer speakers, or genuine user speech/barge-in.
 * 
 * @param transcript Incoming microphone transcript (interim or final)
 * @param activeAiSpeech Text currently being vocalized by the TTS engine
 * @param recentHistory Array of recently spoken AI sentences (last 10-15s)
 * @param options Configurable matching thresholds
 */
export function isAcousticEcho(
  transcript: string,
  activeAiSpeech: string,
  recentHistory: string[] = [],
  options: { threshold?: number } = {}
): EfferenceCheckResult {
  if (!transcript || !transcript.trim()) {
    return { isEcho: false, matchRatio: 0, reason: 'empty' };
  }

  const transTokens = tokenizeText(transcript);
  if (transTokens.length === 0) {
    return { isEcho: false, matchRatio: 0, reason: 'empty' };
  }

  // 1. Explicit interrupt commands always count as genuine user barge-in (never suppressed)
  const hasInterruptKeyword = transTokens.some(t => INTERRUPT_COMMANDS.has(t));
  if (hasInterruptKeyword) {
    return { isEcho: false, matchRatio: 0, reason: 'explicit_interrupt' };
  }

  // Combine active speech and recent speech history
  const activeTokens = tokenizeText(activeAiSpeech);
  const historyTokens = tokenizeText(recentHistory.join(' '));
  const allCorpusTokens = [...activeTokens, ...historyTokens];

  if (allCorpusTokens.length === 0) {
    return { isEcho: false, matchRatio: 0, reason: 'divergent_speech' };
  }

  const cleanTrans = transTokens.join(' ');
  const cleanActive = activeTokens.join(' ');
  const cleanCorpus = allCorpusTokens.join(' ');

  // 2. Exact or multi-word substring match against active speech or recent history
  // If the transcribed phrase is a contiguous substring of what the AI is speaking/spoke,
  // it is unmistakably acoustic speaker bleed.
  if (cleanActive.includes(cleanTrans) || cleanCorpus.includes(cleanTrans)) {
    return { isEcho: true, matchRatio: 1.0, reason: 'corpus_substring' };
  }

  // 3. Token-level overlap ratio with content-word weighting
  const corpusSet = new Set(allCorpusTokens);
  let matchCount = 0;
  let novelContentWords = 0;

  for (const token of transTokens) {
    if (corpusSet.has(token)) {
      matchCount++;
    } else if (!STOP_WORDS.has(token)) {
      // User introduced a novel content word that the AI never uttered!
      novelContentWords++;
    }
  }

  const matchRatio = matchCount / transTokens.length;
  const threshold = options.threshold ?? 0.4;

  // If user introduces multiple novel content words, it is genuine user input
  if (novelContentWords >= 2 && matchRatio < 0.7) {
    return { isEcho: false, matchRatio, reason: 'divergent_speech' };
  }

  // If >= threshold of transcribed tokens match the AI's vocalized words,
  // it is acoustic feedback from speakers into the microphone!
  const isEcho = matchRatio >= threshold;
  return {
    isEcho,
    matchRatio,
    reason: isEcho ? 'token_overlap' : 'divergent_speech'
  };
}

/**
 * Stateful Efference Copy Manager
 * Manages active AI vocalization state and decaying history for conversational voice.
 */
export class EfferenceCopyManager {
  private activeUtterance: string = '';
  private history: Array<{ text: string; timestamp: number }> = [];
  private readonly historyTtlMs: number;

  constructor(historyTtlMs = 12000) {
    this.historyTtlMs = historyTtlMs;
  }

  /** Sets the text the AI is currently vocalizing through speakers */
  setActiveUtterance(text: string): void {
    this.activeUtterance = text;
  }

  /** Clears the active vocalization and records it to recent history */
  finishUtterance(): void {
    if (this.activeUtterance.trim()) {
      this.history.unshift({
        text: this.activeUtterance,
        timestamp: Date.now()
      });
      this.activeUtterance = '';
      this.pruneHistory();
    }
  }

  /** Clears all vocalization state immediately (e.g. on user barge-in) */
  interrupt(): void {
    this.activeUtterance = '';
  }

  /** Evaluates incoming transcript against current efference copy */
  evaluate(transcript: string, threshold = 0.4): EfferenceCheckResult {
    this.pruneHistory();
    const recentTexts = this.history.map(h => h.text);
    return isAcousticEcho(transcript, this.activeUtterance, recentTexts, { threshold });
  }

  /** Prunes speech history entries older than TTL */
  private pruneHistory(): void {
    const cutoff = Date.now() - this.historyTtlMs;
    this.history = this.history.filter(h => h.timestamp >= cutoff).slice(0, 5);
  }

  /** Resets all history and active state */
  reset(): void {
    this.activeUtterance = '';
    this.history = [];
  }
}

