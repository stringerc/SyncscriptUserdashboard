/**
 * Cortex Wake Word — client-side keyword spotting + conversation gate.
 *
 * Zero dependencies, zero audio leaves the machine beyond what the STT
 * engine already sends. Fed with interim/final transcript strings from
 * whatever STT is running (Web Speech API today; could later be fed by
 * a local whisper.cpp keyword spotter).
 *
 * Model:
 *   asleep  — only wake phrases pass. "cortex" / "hey cortex" / "ok cortex"
 *   awake   — conversation window (default 20s). All utterances pass
 *             through to the agent. Window refreshes on each utterance;
 *             saying the wake word again re-arms without an utterance.
 *
 * Phrase handling: "cortex what's the time" wakes AND carries the
 * remainder ("what's the time") as the first utterance — one utterance,
 * zero dead air. Wake word alone triggers an optional spoken ack.
 */

export interface WakeGateOptions {
  /** Wake phrase, matched case-insensitively on word boundaries. Default 'cortex'. */
  wakeWord?: string;
  /** How long the conversation window stays open after wake/activity. Default 20s. */
  windowMs?: number;
  /** Minimum gap between wake detections (anti double-fire). Default 1500ms. */
  refractoryMs?: number;
}

export type WakeFeedResult =
  | { action: 'wake'; remainder: string }        // transitioned asleep -> awake; remainder may be ''
  | { action: 'pass'; text: string }             // awake window — utterance for agent
  | { action: 'rearm' }                          // already awake; extended window silently without re-awakening
  | { action: 'sleep' }                          // user requested standby / sleep
  | { action: 'drop' };                          // asleep, not a wake phrase

const WAKE_PREFIXES = ['hey', 'ok', 'okay', 'yo', 'hi', 'hello', 'cortana'];
const SLEEP_RE = /\b(?:go to sleep|enter standby|standby|goodbye cortex|goodbye|good night cortex|good night|stop listening|mute voice|turn off voice|exit voice|close voice|sleep cortex|sleep mode)\b/i;

export class WakeWordGate {
  private wakeWord: string;
  private windowMs: number;
  private refractoryMs: number;
  private awakeUntil = 0;
  private lastWakeAt = 0;

  constructor(opts: WakeGateOptions = {}) {
    this.wakeWord = (opts.wakeWord || 'cortex').toLowerCase().trim();
    this.windowMs = opts.windowMs ?? 25_000;
    this.refractoryMs = opts.refractoryMs ?? 3_500;
  }

  isAwake(): boolean {
    return Date.now() < this.awakeUntil;
  }

  msUntilSleep(): number {
    return Math.max(0, this.awakeUntil - Date.now());
  }

  reset(): void {
    this.awakeUntil = 0;
  }

  sleep(): void {
    this.awakeUntil = 0;
  }

  /** Normalize for matching: lowercase, punctuation→space, collapse ws. */
  private normalize(text: string): string {
    return text.toLowerCase().replace(/[.,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Find the wake word as a whole word/phrase; return end index in normalized text. */
  private findWake(norm: string): number | null {
    const re = new RegExp(`\\b(?:${WAKE_PREFIXES.join('|')})?\\s*${this.escapeRe(this.wakeWord)}\\b`);
    const m = norm.match(re);
    return m && m.index !== undefined ? m.index + m[0].length : null;
  }

  private escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Feed a transcript fragment. Interim results are safe to feed —
   * the gate is idempotent and the refractory period prevents
   * double-wake on repeated interim snapshots of the same phrase.
   */
  feed(rawText: string): WakeFeedResult {
    const text = rawText.trim();
    if (!text) return { action: 'drop' };
    const now = Date.now();
    const norm = this.normalize(text);
    const wakeEnd = this.findWake(norm);

    if (this.isAwake()) {
      // User commanded sleep / standby
      if (SLEEP_RE.test(norm)) {
        this.sleep();
        return { action: 'sleep' };
      }
      // Inside the window: wake word alone re-arms; otherwise pass through.
      if (wakeEnd !== null) {
        const remainder = norm.slice(wakeEnd).replace(/^[\s,]+/, '');
        if (remainder && SLEEP_RE.test(remainder)) {
          this.sleep();
          return { action: 'sleep' };
        }
        this.awakeUntil = now + this.windowMs;
        return remainder
          ? { action: 'pass', text: remainder }
          : { action: 'rearm' }; // Silently re-arm conversation window; NEVER re-awaken when already awake!
      }
      this.awakeUntil = now + this.windowMs; // activity extends the window
      return { action: 'pass', text };
    }

    // Asleep: only a wake phrase gets through.
    if (wakeEnd === null) return { action: 'drop' };
    if (now - this.lastWakeAt < this.refractoryMs) return { action: 'drop' };

    this.lastWakeAt = now;
    this.awakeUntil = now + this.windowMs;
    const remainder = norm.slice(wakeEnd).replace(/^[\s,]+/, '');
    return { action: 'wake', remainder };
  }
}

import { getVoicePolicy } from './cortex-voice-policy';

let sharedGate: WakeWordGate | null = null;
let sharedWakeWord = '';

/** Shared gate instance — one conversation window per page. */
export function getWakeWordGate(): WakeWordGate {
  const p = getVoicePolicy();
  if (!sharedGate || sharedWakeWord !== p.wakeWord) {
    sharedGate = new WakeWordGate({ wakeWord: p.wakeWord });
    sharedWakeWord = p.wakeWord;
  }
  return sharedGate;
}
