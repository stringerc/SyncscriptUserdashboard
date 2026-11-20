import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVoiceStream } from '../../hooks/useVoiceStream';
import { useCortanaMood } from './CortanaMoodContext';
import { bridgeFetch } from './bridge-client';
import { useEmotionDetection } from '../../hooks/useEmotionDetection';
import type { EmotionState } from '../../types/voice-engine';

// CortanaControl — voice panel for /cortana only.
// Voice + brain run on the shared SyncScript stack: useVoiceStream STT/TTS
// (Pocket cortana clone via /api/ai/tts) and /api/ai/nexus-guest for replies.
// The :5212 bridge remains only for Govee mood lights + orb stats (best-effort).

const WAKE_COOLDOWN_MS = 4000;
const RESUME_LISTEN_MS = 800;

const CORTANA_SYSTEM_PROMPT = `You are Cortana, a warm, concise AI companion on the user's desktop. Keep replies short and speakable — one or two sentences, no markdown, no lists.`;

/** Rolling conversational memory — last N turns so Cortana feels continuous,
 *  not stateless. Bounded to keep latency and context tight. */
const MAX_HISTORY_TURNS = 6;

function cortanaEmotionSuffix(e: EmotionState | null): string {
  if (!e || e.confidence < 0.45 || e.primary === 'neutral' || e.primary === 'calm') return '';
  switch (e.primary) {
    case 'stressed': return '\nThe user sounds stressed — stay calm, reassuring, brief; offer to simplify.';
    case 'sad': return '\nThe user sounds down — be warm and gentle, acknowledge first, keep it short.';
    case 'angry': return '\nThe user sounds frustrated — stay steady, solution-first, never defensive.';
    case 'excited':
    case 'happy': return '\nThe user is upbeat — match the energy, stay enthusiastic.';
    case 'tired': return '\nThe user sounds drained — be soft, brief, suggest the smallest next step.';
    case 'confused': return '\nThe user seems uncertain — slow down, clarify simply.';
    default: return '';
  }
}

function cortanaEmotionRate(e: EmotionState | null): number {
  if (!e || e.confidence < 0.45) return 1.0;
  if (e.primary === 'stressed' || e.primary === 'sad' || e.primary === 'angry') return 0.95;
  if (e.primary === 'tired') return 0.93;
  if (e.primary === 'excited' || e.primary === 'happy') return Math.min(1.06, 0.97 + e.arousal * 0.12);
  if (e.primary === 'confused') return 0.96;
  return 1.0;
}

const MOOD_COLORS: Record<string, string> = {
  idle: '#00ccff',
  listening: '#00eeff',
  speaking: '#00ffcc',
  thinking: '#cc44ff',
  alert: '#ff6644',
};

type CortanaMood = 'idle' | 'listening' | 'thinking' | 'speaking' | 'alert';

const CortanaControl: React.FC = () => {
  const { mood, setMood } = useCortanaMood();
  const [responseText, setResponseText] = useState('Say "Cortana" to wake me');
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const isSpeakingRef = useRef(false);
  const wakeArmedRef = useRef(true);
  const lastWakeAtRef = useRef(0);
  const processingRef = useRef(false);
  const handleCommandRef = useRef<(text: string) => Promise<void>>(async () => {});
  const emotionApi = useEmotionDetection();
  const turnEmotionRef = useRef<EmotionState | null>(null);
  const chatHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const accentColor = MOOD_COLORS[mood] || MOOD_COLORS.idle;

  const {
    isListening,
    interimText,
    isSpeaking: voiceIsSpeaking,
    speakStreamSentence,
    startListening,
    stopListening,
    status,
  } = useVoiceStream({
    continuous: true,
    interimResults: true,
    ttsVoice: 'cortana',
    onTranscript: (result) => {
      if (!result.isFinal || isSpeakingRef.current || processingRef.current) return;
      void handleCommandRef.current(result.text);
    },
    onStatusChange: (newStatus) => {
      if (isSpeakingRef.current || processingRef.current) return;
      if (newStatus === 'listening') setMood('listening');
      else if (newStatus === 'processing') setMood('thinking');
    },
  });

  // Speak-then-resume: speakStreamSentence is fire-and-forget, so queue the
  // post-speech callback and fire it when the shared engine drains to idle.
  const sawSpeakingRef = useRef(false);
  const afterSpeakRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    isSpeakingRef.current = voiceIsSpeaking;
    if (voiceIsSpeaking) {
      sawSpeakingRef.current = true;
      return;
    }
    if (sawSpeakingRef.current && afterSpeakRef.current) {
      sawSpeakingRef.current = false;
      const fn = afterSpeakRef.current;
      afterSpeakRef.current = null;
      fn();
    }
  }, [voiceIsSpeaking]);

  const speakThen = useCallback((text: string, after?: () => void) => {
    const cleaned = text.trim();
    if (!cleaned) {
      after?.();
      return;
    }
    afterSpeakRef.current = after || null;
    // If the engine is already mid-utterance our sentence queues behind it —
    // the next true→false edge still lands after our audio, which is correct.
    sawSpeakingRef.current = isSpeakingRef.current;
    speakStreamSentence(cleaned, true, { voice: 'cortana', speed: cortanaEmotionRate(turnEmotionRef.current) });
  }, [speakStreamSentence]);

  // Wake word: final-ish interim, cooldown, armed only when idle
  useEffect(() => {
    if (isSpeakingRef.current || processingRef.current || !wakeArmedRef.current) return;
    const text = (interimText || '').toLowerCase();
    if (!text.includes('cortana')) return;

    const now = Date.now();
    if (now - lastWakeAtRef.current < WAKE_COOLDOWN_MS) return;
    lastWakeAtRef.current = now;
    wakeArmedRef.current = false;

    setMood('listening');
    setResponseText('Yes?');
    setMood('speaking');
    isSpeakingRef.current = true;
    speakThen('Yes?', () => {
      isSpeakingRef.current = false;
      setMood('idle');
      setTimeout(() => {
        wakeArmedRef.current = true;
        void startListening();
      }, RESUME_LISTEN_MS);
    });
  }, [interimText, startListening, setMood, speakThen]);

  const handleCommand = useCallback(
    async (text: string) => {
      const cmd = text.toLowerCase().trim();
      if (!cmd || cmd === 'cortana' || cmd === 'hey cortana') return;

      processingRef.current = true;
      setMood('thinking');
      try { turnEmotionRef.current = emotionApi.detectFromText(text); } catch {}
      chatHistoryRef.current.push({ role: 'user', content: text });
      if (chatHistoryRef.current.length > MAX_HISTORY_TURNS * 2) {
        chatHistoryRef.current = chatHistoryRef.current.slice(-MAX_HISTORY_TURNS * 2);
      }

      if (
        cmd.includes('stop') &&
        (cmd.includes('listening') ||
          cmd.includes('quiet') ||
          cmd.includes('silent') ||
          cmd.includes('go away'))
      ) {
        setResponseText('Going silent. Say "Cortana" when you need me.');
        stopListening();
        setMood('idle');
        wakeArmedRef.current = true;
        processingRef.current = false;
        return;
      }

      try {
        const res = await fetch('/api/ai/nexus-guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(30000),
          body: JSON.stringify({
            stream: false,
            context: 'cortex',
            systemPrompt: CORTANA_SYSTEM_PROMPT + cortanaEmotionSuffix(turnEmotionRef.current),
            plainPersona: true,
            messages: [...chatHistoryRef.current, { role: 'user' as const, content: text }],
            maxTokens: 300,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as { content?: string; reply?: string };
          const reply = data.content || data.reply || "I couldn't process that.";
          setResponseText(reply);
          chatHistoryRef.current.push({ role: 'assistant', content: reply.slice(0, 600) });

          isSpeakingRef.current = true;
          stopListening();
          setMood('speaking');

          speakThen(reply, () => {
            isSpeakingRef.current = false;
            setTimeout(() => {
              void startListening();
              setMood('idle');
              wakeArmedRef.current = true;
              processingRef.current = false;
            }, RESUME_LISTEN_MS);
          });
          return;
        }
      } catch (err) {
        console.warn('[cortana] AI request failed:', err);
      }

      // Brain unreachable — local only (time/date)
      let localResponse = '';
      if (cmd.includes('time') || cmd.includes('what time')) {
        localResponse = `It's ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
      } else if (cmd.includes('date') || cmd.includes('today')) {
        localResponse = `Today is ${new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}.`;
      } else {
        localResponse = 'Something went wrong reaching the brain — try again in a moment.';
      }

      setResponseText(localResponse);
      setMood('speaking');
      isSpeakingRef.current = true;
      stopListening();

      speakThen(localResponse, () => {
        isSpeakingRef.current = false;
        setTimeout(() => {
          void startListening();
          setMood('idle');
          wakeArmedRef.current = true;
          processingRef.current = false;
        }, RESUME_LISTEN_MS);
      });
    },
    [setMood, stopListening, startListening, speakThen, emotionApi],
  );

  handleCommandRef.current = handleCommand;

  useEffect(() => {
    const interval = setInterval(() => {
      bridgeFetch('/api/cortana/health', { method: 'GET', timeoutMs: 2000 })
        .then((r) => setBridgeOnline(r.ok))
        .catch(() => setBridgeOnline(false));
    }, 10000);
    bridgeFetch('/api/cortana/health', { method: 'GET', timeoutMs: 2000 })
      .then((r) => setBridgeOnline(r.ok))
      .catch(() => setBridgeOnline(false));
    return () => clearInterval(interval);
  }, []);

  const unlockAudio = useCallback(() => {
    // Gesture unlock for the shared gapless AudioContext — resume/create once.
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) void new AC().resume().catch(() => {});
    } catch { /* best-effort */ }
  }, []);

  const toggleListening = () => {
    unlockAudio();
    if (isListening) {
      stopListening();
      setMood('idle');
    } else {
      void startListening();
      setMood('listening');
    }
  };

  const testVoice = async () => {
    unlockAudio();
    // Wait a tick so the AudioContext resume lands before synthesis starts
    await new Promise((r) => setTimeout(r, 50));
    setResponseText('Testing neural voice…');
    setMood('speaking');
    isSpeakingRef.current = true;
    speakThen('Audio systems online. Systems nominal.', () => {
      isSpeakingRef.current = false;
      setMood('idle');
    });
    setResponseText('Audio systems online. Systems nominal.');
  };

  const cycleMood = () => {
    unlockAudio();
    const moods: CortanaMood[] = ['idle', 'listening', 'thinking', 'speaking', 'alert'];
    const idx = moods.indexOf(mood as CortanaMood);
    const next = moods[(idx + 1) % moods.length];
    setMood(next);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        background: 'rgba(0, 0, 0, 0.85)',
        color: accentColor,
        padding: '14px',
        borderRadius: '12px',
        fontFamily: '"SF Mono", "Fira Code", monospace',
        fontSize: '12px',
        zIndex: 10000,
        boxShadow: `0 0 24px ${accentColor}22`,
        border: `1px solid ${accentColor}33`,
        backdropFilter: 'blur(16px)',
        maxWidth: '320px',
        userSelect: 'none',
        minWidth: '240px',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: accentColor,
            boxShadow: `0 0 ${isListening ? '12' : '4'}px ${accentColor}`,
            transition: 'all 0.3s ease',
          }}
        />
        <span style={{ fontWeight: 600, letterSpacing: '0.1em', fontSize: '13px' }}>CORTANA</span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.5 }}>
          {status.toUpperCase()}
        </span>
      </div>

      {responseText && (
        <div
          style={{
            marginBottom: 8,
            fontSize: '11px',
            color: accentColor,
            maxHeight: '80px',
            overflow: 'hidden',
            lineHeight: 1.4,
          }}
        >
          {responseText}
        </div>
      )}

      {interimText && !isSpeakingRef.current && (
        <div
          style={{
            marginBottom: 8,
            padding: '4px 8px',
            background: `${accentColor}11`,
            borderRadius: '6px',
            fontSize: '11px',
            opacity: 0.7,
            fontStyle: 'italic',
          }}
        >
          {interimText}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <div
          onClick={toggleListening}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') toggleListening();
          }}
          style={{
            flex: 1,
            textAlign: 'center',
            cursor: 'pointer',
            padding: '7px',
            backgroundColor: isListening ? `${accentColor}25` : `${accentColor}10`,
            borderRadius: '8px',
            border: `1px solid ${accentColor}33`,
            fontSize: '11px',
            transition: 'all 0.2s ease',
          }}
        >
          {isListening ? 'Mute' : 'Listen'}
        </div>
        <div
          onClick={() => { void testVoice(); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') void testVoice();
          }}
          style={{
            flex: 1,
            textAlign: 'center',
            cursor: 'pointer',
            padding: '7px',
            backgroundColor: `${accentColor}10`,
            borderRadius: '8px',
            border: `1px solid ${accentColor}22`,
            fontSize: '11px',
          }}
        >
          Test voice
        </div>
        <div
          onClick={cycleMood}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') cycleMood();
          }}
          style={{
            flex: 1,
            textAlign: 'center',
            cursor: 'pointer',
            padding: '7px',
            backgroundColor: `${accentColor}10`,
            borderRadius: '8px',
            border: `1px solid ${accentColor}22`,
            fontSize: '11px',
          }}
        >
          Mood
        </div>
      </div>

      <div style={{ fontSize: '9px', opacity: 0.35, textAlign: 'center', marginTop: 6 }}>
        {bridgeOnline
          ? 'Voice: neural cortana · bridge live (lights/stats)'
          : 'Voice: neural cortana · bridge offline (lights/stats only)'}
      </div>
    </div>
  );
};

export default CortanaControl;
