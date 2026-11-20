import { useCallback, useState } from 'react';
import {
  speakUtteranceArbitrated,
  stopArbitratedUtterance,
  releaseSpeech,
} from '../lib/cortex-tts-arbiter';

/**
 * Shared briefing speech control — one implementation for every
 * "listen to this briefing" button (dashboard, daily ops, proactive).
 * Routes through the cross-tab speech mutex with barge priority so a
 * manual listen interrupts politely and never overlaps another voice.
 */
export function useBriefingSpeech(
  text: string | undefined,
  opts: { rate?: number; pitch?: number } = {},
) {
  const [speaking, setSpeaking] = useState(false);

  const toggle = useCallback(() => {
    if (!text) return;
    if (speaking) {
      stopArbitratedUtterance();
      releaseSpeech();
      setSpeaking(false);
      return;
    }
    const voices =
      typeof window !== 'undefined' && window.speechSynthesis
        ? window.speechSynthesis.getVoices()
        : [];
    const premium = voices.find((v) =>
      /Google|Natural|Samantha/.test(v.name),
    );
    const started = speakUtteranceArbitrated(text, {
      priority: 'barge',
      rate: opts.rate ?? 1.05,
      pitch: opts.pitch,
      voice: premium,
      onDone: () => setSpeaking(false),
    });
    if (started) setSpeaking(true);
  }, [text, speaking, opts.rate, opts.pitch]);

  return { speaking, toggle };
}
