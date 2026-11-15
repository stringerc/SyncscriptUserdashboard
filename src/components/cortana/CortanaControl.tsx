import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVoiceStream } from '../../hooks/useVoiceStream';
import { useCortanaMood } from './CortanaMoodContext';
import { bridgeFetch } from './bridge-client';
import { playCortanaMp3, stopCortanaAudio, unlockCortanaAudio } from './cortana-audio';

// CortanaControl — voice panel for /cortana only.
// Bridge (127.0.0.1:5212): AI + allowlisted tools + neural TTS (no speechSynthesis).
// Dev: Vite proxies same-origin /api/cortana → bridge.

const WAKE_COOLDOWN_MS = 4000;
const RESUME_LISTEN_MS = 800;

function cleanTTS(text: string): string {
  return text
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\["']/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/-\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/<function=[^>]+>[\s\S]*?<\/function>/g, '')
    // Smart punctuation → ASCII (edge-tts handles these but they break JSON embedding
    // and plain-ASCII consumers). Apostrophe/quotes/dashes/ellipsis.
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Neural TTS only — no browser speechSynthesis (product rule for cortana identity). */
async function cortanaSpeak(
  text: string,
  onSpeakStart?: () => void,
  onSpeakEnd?: () => void,
): Promise<{ ok: boolean; reason?: string }> {
  stopCortanaAudio();
  const cleaned = cleanTTS(text);
  if (!cleaned) {
    onSpeakEnd?.();
    return { ok: false, reason: 'empty' };
  }

  try {
    const res = await bridgeFetch('/api/cortana/tts', {
      method: 'POST',
      timeoutMs: 60000,
      body: JSON.stringify({ input: cleaned, voice: 'cortana', speed: 1.0 }),
    });

    if (!res.ok) {
      onSpeakEnd?.();
      return { ok: false, reason: res.status === 503 ? 'tts_providers_down' : `tts_http_${res.status}` };
    }

    const data = await res.arrayBuffer();
    return playCortanaMp3(data, onSpeakStart, onSpeakEnd);
  } catch {
    onSpeakEnd?.();
    return { ok: false, reason: 'bridge_unreachable' };
  }
}

function ttsFailureHint(reason?: string): string {
  switch (reason) {
    case 'bridge_unreachable':
      return 'No audio — bridge offline. Run: npm run cortana:bridge';
    case 'tts_providers_down':
      return 'No audio — neural TTS unavailable (edge-tts / Kokoro).';
    case 'autoplay_blocked':
      return 'No audio — browser blocked autoplay. Click Listen once, then try again.';
    case 'play_failed':
    case 'empty_audio':
      return 'No audio — playback failed.';
    default:
      return 'No audio — check bridge on port 5212.';
  }
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

  const accentColor = MOOD_COLORS[mood] || MOOD_COLORS.idle;

  const {
    isListening,
    interimText,
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
    void cortanaSpeak(
      'Yes?',
      () => {
        setMood('speaking');
        isSpeakingRef.current = true;
      },
      () => {
        isSpeakingRef.current = false;
        setMood('idle');
        setTimeout(() => {
          wakeArmedRef.current = true;
          void startListening();
        }, RESUME_LISTEN_MS);
      },
    ).then((result) => {
      if (!result.ok) {
        setResponseText(ttsFailureHint(result.reason));
        isSpeakingRef.current = false;
        setMood('idle');
        wakeArmedRef.current = true;
      }
    });
  }, [interimText, startListening, setMood]);

  const handleCommand = useCallback(
    async (text: string) => {
      const cmd = text.toLowerCase().trim();
      if (!cmd || cmd === 'cortana' || cmd === 'hey cortana') return;

      processingRef.current = true;
      setMood('thinking');

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
        const res = await bridgeFetch('/api/cortana/ask', {
          method: 'POST',
          timeoutMs: 30000,
          body: JSON.stringify({ message: text }),
        });

        if (res.ok) {
          const data = (await res.json()) as { reply?: string; response?: string; text?: string };
          const reply = data.reply || data.response || data.text || "I couldn't process that.";
          setResponseText(reply);

          isSpeakingRef.current = true;
          stopListening();
          setMood('speaking');

          const spoken = await cortanaSpeak(reply, undefined, () => {
            isSpeakingRef.current = false;
            setTimeout(() => {
              void startListening();
              setMood('idle');
              wakeArmedRef.current = true;
              processingRef.current = false;
            }, RESUME_LISTEN_MS);
          });

          if (!spoken.ok) {
            setResponseText(`${reply}\n\n(${ttsFailureHint(spoken.reason)})`);
            isSpeakingRef.current = false;
            setTimeout(() => {
              void startListening();
              setMood('idle');
              wakeArmedRef.current = true;
              processingRef.current = false;
            }, RESUME_LISTEN_MS);
          }
          return;
        }
      } catch (err) {
        console.warn('[cortana] AI request failed:', err);
      }

      // Bridge down — local only (time/date), neural TTS if bridge TTS still up
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
        localResponse =
          'Bridge offline. Start it with npm run cortana:bridge, then try again.';
      }

      setResponseText(localResponse);
      setMood('speaking');
      isSpeakingRef.current = true;
      stopListening();

      await cortanaSpeak(localResponse, undefined, () => {
        isSpeakingRef.current = false;
        setTimeout(() => {
          void startListening();
          setMood('idle');
          wakeArmedRef.current = true;
          processingRef.current = false;
        }, RESUME_LISTEN_MS);
      });
    },
    [setMood, stopListening, startListening],
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
    unlockCortanaAudio();
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
    // Wait for AudioContext resume so the first word is audible after gesture
    await new Promise((r) => setTimeout(r, 50));
    setResponseText('Testing neural voice…');
    isSpeakingRef.current = true;
    setMood('speaking');
    const result = await cortanaSpeak(
      'Audio systems online.',
      undefined,
      () => {
        isSpeakingRef.current = false;
        setMood('idle');
      },
    );
    if (!result.ok) {
      setResponseText(ttsFailureHint(result.reason));
      isSpeakingRef.current = false;
      setMood('idle');
    } else {
      setResponseText('Audio systems online.');
    }
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
          ? 'Bridge live · click Listen first (unlocks audio) · neural TTS'
          : 'Bridge offline — run npm run cortana:bridge'}
      </div>
    </div>
  );
};

export default CortanaControl;
