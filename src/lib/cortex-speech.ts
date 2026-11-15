/**
 * cortex-speech.ts — One-line Cortana TTS channel for UI-initiated actions.
 *
 * Voice turns already speak their replies; this covers the other half —
 * clicks. Dispatches 'cortex-viz-speak', which useVisualizerVoice listens
 * for and routes through speakStreamSentence (Cartesia → Kokoro).
 * Works with the mic off: TTS doesn't need the microphone.
 */

export function cortexSpeak(text: string): void {
  if (typeof window === 'undefined' || !text?.trim()) return;
  window.dispatchEvent(new CustomEvent('cortex-viz-speak', { detail: text.trim() }));
}
