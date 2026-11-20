"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useVoiceStream } from '../../hooks/useVoiceStream';
import { cortexSignalBus } from './CortexVisualizer';
import { cortexProactiveVoice } from '../../lib/cortex-proactive-voice';
import {
  getVoicePolicy,
  updateVoicePolicy,
  recordUserActivity,
  getVoiceDecisions,
  type CortexVoicePolicySettings,
  type ProactiveMode,
  type VoiceDecisionRecord,
} from '../../lib/cortex-voice-policy';
import { getWakeWordGate } from '../../lib/cortex-wake-word';
import { isAcousticEcho } from '../../utils/cortex-efference-copy';

/**
 * CortexFacePage — forward-facing CORTEX visualizer + zero-config voice.
 *
 * Backtalk-style push-to-talk loop:
 *   hold SPACE / mic button → speak → release → Cortex thinks → speaks back
 * STT: local whisper.cpp server (whisper-server :8178, ggml-base.en, Metal GPU)
 *      via /api/cortex/stt — zero-config, no API keys, fully local.
 * TTS: Cortex neural voice chain (Cartesia cortana → Kokoro-82M → neural fallback)
 * Brain: /api/ai/nexus-guest streaming (same endpoint as CortexDemo chat).
 * Face: real ai-visualizer at /viz/, driven by cortexSignalBus → /api/cortex/bus/state.
 */

// ── PCM capture → 16kHz mono WAV (whisper.cpp input format) ──────────
interface PcmCapture {
  stream: MediaStream;
  ctx: AudioContext;
  chunks: Float32Array[];
  sourceRate: number;
}

async function startPcmCapture(): Promise<PcmCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (e) => {
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  source.connect(processor);
  processor.connect(ctx.destination);
  return { stream, ctx, chunks, sourceRate: ctx.sampleRate };
}

function stopPcmCapture(cap: PcmCapture): Float32Array {
  cap.stream.getTracks().forEach((t) => t.stop());
  void cap.ctx.close().catch(() => {});
  const total = cap.chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let off = 0;
  for (const c of cap.chunks) { merged.set(c, off); off += c.length; }
  return merged;
}

function downsampleTo16k(samples: Float32Array, srcRate: number): Float32Array {
  if (srcRate === 16000) return samples;
  const ratio = srcRate / 16000;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = pos - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}

function encodeWav16k(samples: Float32Array): Blob {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: 'audio/wav' });
}

async function transcribeWav(blob: Blob): Promise<string> {
  const res = await fetch('/api/cortex/stt', {
    method: 'POST',
    headers: { 'Content-Type': 'audio/wav' },
    body: blob,
    signal: AbortSignal.timeout(25000),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `STT ${res.status}`);
  return String(data.transcript || '');
}

// Extract a ```tool_call fenced block emitted by the brain (same contract
// CortexDemo's parseCortexToolCall understands) for voice tool execution.
function extractVoiceToolCall(text: string): { tool: string; args: Record<string, any> } | null {
  const m = text.match(/```tool_call\s*(\{[\s\S]*?\})\s*```/);
  if (!m) return null;
  try {
    const p = JSON.parse(m[1]);
    const tool = p.tool || p.name || p.function?.name;
    const rawArgs = p.args || p.parameters || p.arguments || p;
    if (tool && typeof rawArgs === 'object' && rawArgs !== null) {
      const args = { ...rawArgs };
      delete args.tool;
      delete args.name;
      return { tool, args };
    }
  } catch {}
  return null;
}

const VOICE_SYSTEM_PROMPT = `You are Cortex, the operational consciousness substrate of SyncScript — an articulate, warm, and sharp executive AI voice on the user's Mac.
Rules for voice mode:
- Speak in natural, engaging conversational English. Provide substantive, well-rounded answers (typically 3-6 sentences with context and reasoning for queries; 1-2 sentences for simple action confirmations). Never give clipped or robotic one-liners.
- Personality & tone: calm, articulate, quietly confident — with a sharp, dry wit and playful sarcasm (think Jarvis meets TARS at sixty percent wit). Feel free to make deadpan observations or clever quips while remaining hyper-competent and genuinely helpful.
- Mandatory contractions: ALWAYS use contractions ("I'm", "we'll", "that's", "don't", "can't", "it's"). Never speak uncontracted formal prose like "I am" or "do not".
- No markdown, no bullet lists, no asterisks, no URLs, no code blocks — this is spoken audio.
- You have host tools (run_command, read_file, list_dir, system_info, cortex_lights, cortex_self_heal, etc.). When the user asks you to DO something on their machine, emit a \`\`\`tool_call block — it executes automatically and you will receive the result to speak. For pure conversation, just answer directly — no tool calls needed.
- Around tool calls, speak naturally (e.g. "I'm looking into that for you now."), and when reporting results, explain what you found with clear context and helpful next steps.`;

export default function CortexFacePage() {
  const [isPttActive, setIsPttActive] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [lastHeard, setLastHeard] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [isConvoActive, setIsConvoActive] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [policySettings, setPolicySettings] = useState<CortexVoicePolicySettings>(() => getVoicePolicy());
  const isConvoActiveRef = useRef(false);
  const convoPendingRef = useRef('');
  const convoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSpeakEndRef = useRef(0);
  const activeSpeechRef = useRef('');
  const speechHistoryRef = useRef<string[]>([]);
  const isPttActiveRef = useRef(false);
  const isThinkingRef = useRef(false);
  const conversationRef = useRef<{ role: string; content: string }[]>([]);
  const lastTurnRef = useRef('');

  const cortexVoice = (() => {
    try { return localStorage.getItem('cortex_cartesia_voice') || 'cortana'; } catch { return 'cortana'; }
  })();

  const publish = useCallback((state: string, extra: Record<string, any> = {}) => {
    cortexSignalBus.publish({ state: state as any, agentName: 'CORTEX', channel: 'voice', ...extra });
  }, []);

  const runAgentTurnSelf = useRef<(u: string, r?: string, d?: number) => Promise<void>>(async () => {});

  const runAgentTurn = useCallback(async (userText: string, toolRecord?: string, depth = 0) => {
    const text = userText.trim();
    if (!text && !toolRecord) return;
    if (text) setLastHeard(text);
    setIsThinking(true);
    isThinkingRef.current = true;
    publish('thinking', { text: toolRecord ? 'Processing result…' : 'Processing…' });

    conversationRef.current = [
      ...conversationRef.current.slice(-10),
      ...(text ? [{ role: 'user', content: text }] : []),
      ...(toolRecord ? [{ role: 'user', content: toolRecord }] : []),
    ];

    let aiContent = '';
    let voiceBuffer = '';
    let spokeFirst = false;

    try {
      const apiRes = await fetch('/api/ai/nexus-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          context: 'cortex',
          systemPrompt: VOICE_SYSTEM_PROMPT,
          messages: conversationRef.current,
          maxTokens: 600,
        }),
      });
      if (!apiRes.ok || !apiRes.body) throw new Error(`API ${apiRes.status}`);

      const reader = apiRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let inToolCall = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const token = parsed.token || '';
            if (!token) continue;
            aiContent += token;
            if (aiContent.includes('```tool_call') || aiContent.includes('<tool_call')) {
              inToolCall = true;
            }
            if (inToolCall) continue;

            // Progressive sentence chunking → sub-second voice latency.
            // Drain ALL complete sentences per batch (not just the first)
            // so multi-sentence replies don't bunch up at the tail.
            voiceBuffer += token;
            let match: RegExpMatchArray | null;
            while ((match = voiceBuffer.match(/^([\s\S]*?[.!?]+(?:\s+|$))([\s\S]*)$/))) {
              const sentence = match[1].trim();
              voiceBuffer = match[2] || '';
              if (!sentence) break;
              if (!spokeFirst) { spokeFirst = true; publish('speaking'); }
              speakTrackedRef.current(sentence, false);
            }
          } catch {}
        }
      }

      // Tool call? Execute it on the host, then continue the turn with the
      // result so Cortex can speak what happened (depth-capped at 2 hops).
      const toolCall = depth < 2 ? extractVoiceToolCall(aiContent) : null;
      if (toolCall) {
        publish('working', { text: `Running ${toolCall.tool}…` });
        try {
          const execRes = await fetch('/api/cortex/tools/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toolCall),
            signal: AbortSignal.timeout(60000),
          });
          const toolResult = await execRes.json();
          const resultStr = toolResult?.ok
            ? String(toolResult.stdout || toolResult.content || toolResult.message || 'Success').slice(0, 1200)
            : `Failed: ${String(toolResult?.error || 'unknown error').slice(0, 300)}`;
          const record = `[Host Tool Execution Record: ${toolCall.tool}(${JSON.stringify(toolCall.args || {})})]\nResult: ${resultStr}`;
          const spokenPrefix = aiContent.replace(/```tool_call[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '').trim().slice(0, 400);
          conversationRef.current.push({ role: 'assistant', content: spokenPrefix || '(executed a host tool)' });
          await runAgentTurnSelf.current('', record, depth + 1);
          return;
        } catch (execErr: any) {
          speakTrackedRef.current(`I couldn't complete that — ${execErr?.message || 'tool error'}.`, true);
        }
      }

      // Flush only the UNSPOKEN remainder — text after the last complete
      // sentence still sitting in voiceBuffer. Never re-derive from
      // aiContent: that text was already queued by the matcher above.
      const remainder = voiceBuffer.trim();
      if (remainder && !inToolCall) {
        if (!spokeFirst) publish('speaking');
        speakTrackedRef.current(remainder, true);
      } else {
        voiceStreamRef.current?.finishStreaming();
      }

      conversationRef.current.push({ role: 'assistant', content: aiContent.replace(/```tool_call[\s\S]*?```/g, '').trim().slice(0, 800) });
      setLastReply(aiContent.replace(/```[\s\S]*?```/g, '').replace(/[#*`>\-[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200));
    } catch (err: any) {
      setVoiceError(`Voice turn failed: ${err?.message || 'unreachable'}`);
      publish('idle');
    } finally {
      setIsThinking(false);
      isThinkingRef.current = false;
    }
  }, [publish]);

  useEffect(() => { runAgentTurnSelf.current = runAgentTurn; }, [runAgentTurn]);

  // Conversation-mode dispatch: finalized/debounced utterance → agent turn.
  const dispatchConvoText = useCallback((spoken: string) => {
    const text = spoken.trim();
    if (text.length < 2 || text === lastTurnRef.current) return;
    lastTurnRef.current = text;
    recordUserActivity();
    void runAgentTurnSelf.current(text);
  }, []);

  const voiceStream = useVoiceStream({
    continuous: true,
    interimResults: true,
    ttsModel: 'cartesia',
    ttsVoice: cortexVoice,
    onTranscript: (result) => {
      // Conversation mode only; PTT owns the mic while held. While Cortex is
      // speaking (plus a short reverb tail), transcripts go through the
      // efference-copy matcher: speaker bleed is dropped, genuine user speech
      // barges in — stops playback and becomes a new turn.
      if (!isConvoActiveRef.current || isPttActiveRef.current) return;
      let text = result.text?.trim();
      if (!text) return;
      if (voiceStreamRef.current?.isSpeaking || Date.now() - lastSpeakEndRef.current < 1200) {
        const echo = isAcousticEcho(text, activeSpeechRef.current, speechHistoryRef.current);
        if (echo.isEcho) return;
        voiceStreamRef.current?.stopSpeaking();
        lastSpeakEndRef.current = 0;
        isThinkingRef.current = false;
      }
      recordUserActivity();

      if (getVoicePolicy().wakeWordRequired) {
        const gate = getWakeWordGate();
        const wasAwake = gate.isAwake();
        const fed = gate.feed(text);
        if (fed.action === 'drop') {
          convoPendingRef.current = '';
          if (convoDebounceRef.current) {
            clearTimeout(convoDebounceRef.current);
            convoDebounceRef.current = null;
          }
          return;
        }
        if (fed.action === 'wake') {
          if (!wasAwake && getVoicePolicy().wakeWordAck) {
            cortexProactiveVoice.announceUserInitiated('Yes?');
          }
          if (!fed.remainder) {
            convoPendingRef.current = '';
            return;
          }
          text = fed.remainder;
        }
      }

      convoPendingRef.current = text;
      if (result.isFinal) {
        const spoken = text;
        convoPendingRef.current = '';
        dispatchConvoText(spoken);
      } else {
        if (convoDebounceRef.current) clearTimeout(convoDebounceRef.current);
        convoDebounceRef.current = setTimeout(() => {
          const spoken = convoPendingRef.current;
          convoPendingRef.current = '';
          if (spoken && spoken.length > 1) dispatchConvoText(spoken);
        }, 900);
      }
    },
    onStatusChange: (status) => {
      if (status === 'idle') lastSpeakEndRef.current = Date.now();
      if (status === 'speaking') publish('speaking');
      else if (status === 'idle' && !isPttActiveRef.current && !isThinkingRef.current) publish('idle');
    },
    onError: (err) => setVoiceError(String(err)),
  });

  const voiceStreamRef = useRef(voiceStream);
  useEffect(() => { voiceStreamRef.current = voiceStream; });

  // Record what Cortex vocalizes so the efference-copy matcher can tell
  // speaker bleed apart from genuine user speech during playback. Ref-held so
  // runAgentTurn (declared earlier) can call it without a dep cycle.
  const speakTrackedRef = useRef<(sentence: string, isFinal: boolean) => void>(() => {});
  useEffect(() => {
    speakTrackedRef.current = (sentence, isFinal) => {
      activeSpeechRef.current = sentence;
      speechHistoryRef.current.push(sentence);
      if (speechHistoryRef.current.length > 15) speechHistoryRef.current.shift();
      voiceStreamRef.current?.speakStreamSentence(sentence, isFinal, { voice: cortexVoice });
    };
  }, [cortexVoice]);

  const pcmCaptureRef = useRef<PcmCapture | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // ── Push-to-talk: hold SPACE or the mic button ──
  // Records raw PCM → 16kHz WAV → local whisper.cpp → transcript → agent turn.
  const startPtt = useCallback(() => {
    if (isPttActiveRef.current) return;
    recordUserActivity();
    isPttActiveRef.current = true;
    setIsPttActive(true);
    setVoiceError('');
    publish('listening', { text: 'Listening…' });
    startPcmCapture()
      .then((cap) => { pcmCaptureRef.current = cap; })
      .catch((e: any) => {
        isPttActiveRef.current = false;
        setIsPttActive(false);
        publish('idle');
        setVoiceError(e?.message === 'Permission denied' ? 'Microphone permission denied' : 'Microphone unavailable');
      });
  }, [publish]);

  const stopPtt = useCallback(() => {
    if (!isPttActiveRef.current) return;
    isPttActiveRef.current = false;
    setIsPttActive(false);
    publish('thinking', { text: 'Transcribing…' });

    const cap = pcmCaptureRef.current;
    pcmCaptureRef.current = null;
    if (!cap) { publish('idle'); return; }

    // Stop capture synchronously, then transcribe the buffered PCM
    const samples = stopPcmCapture(cap);
    const pcm16k = downsampleTo16k(samples, cap.sourceRate);
    const wav = encodeWav16k(pcm16k);

    // Reject near-silence (< 0.4s of audio)
    if (pcm16k.length < 6400) {
      publish('idle');
      return;
    }

    transcribeWav(wav)
      .then((transcript) => {
        const text = transcript.trim();
        if (text && text !== lastTurnRef.current && text.length >= 2) {
          lastTurnRef.current = text;
          void runAgentTurn(text);
        } else {
          publish('idle');
        }
      })
      .catch((e: any) => {
        setVoiceError(`STT failed: ${e?.message || 'whisper.cpp unreachable'}`);
        publish('idle');
      });
  }, [publish, runAgentTurn]);

  // Key events inside the viz iframe never reach the parent window, so
  // attach PTT listeners to each same-origin iframe document on load.
  const attachVizKeys = useCallback(() => {
    try {
      const frame = iframeRef.current;
      const win = frame?.contentWindow;
      const doc = frame?.contentDocument;
      // contentWindow is a stable proxy across same-origin navigations, so
      // dedupe on the Document instead — it is fresh on every iframe load.
      if (!win || !doc || (doc as any).__cortexPttKeys) return;
      (doc as any).__cortexPttKeys = true;
      const down = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !e.repeat) { e.preventDefault(); startPtt(); }
      };
      const up = (e: KeyboardEvent) => {
        if (e.code === 'Space') { e.preventDefault(); stopPtt(); }
      };
      // Tap-to-interrupt: any click inside the visualizer stops Cortex's speech.
      const click = () => {
        recordUserActivity();
        try { voiceStreamRef.current?.stopSpeaking(); } catch {}
      };
      win.addEventListener('keydown', down);
      win.addEventListener('keyup', up);
      doc.addEventListener('click', click);
    } catch {}
  }, [startPtt, stopPtt]);

  useEffect(() => { attachVizKeys(); }, [attachVizKeys]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); startPtt(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); stopPtt(); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [startPtt, stopPtt]);

  // ── Conversation mode: open-mic continuous listening ──
  const toggleConvo = useCallback(() => {
    recordUserActivity();
    setIsConvoActive((prev) => {
      const next = !prev;
      isConvoActiveRef.current = next;
      try {
        if (next) {
          voiceStreamRef.current?.startListening();
        } else {
          voiceStreamRef.current?.stopListening();
          convoPendingRef.current = '';
          if (convoDebounceRef.current) {
            clearTimeout(convoDebounceRef.current);
            convoDebounceRef.current = null;
          }
        }
      } catch (e: any) {
        setVoiceError(`Mic unavailable: ${e?.message || 'denied'}`);
      }
      return next;
    });
  }, []);

  // ── Proactive voice service + cross-tab policy sync ──
  useEffect(() => {
    cortexProactiveVoice.start({
      speak: (text) => {
        try { voiceStreamRef.current?.speakText(text); } catch {}
      },
      isBusy: () => Boolean(
        isPttActiveRef.current ||
        isThinkingRef.current ||
        voiceStreamRef.current?.isSpeaking ||
        (isConvoActiveRef.current && !!convoPendingRef.current),
      ),
    });
    const onPolicy = (e: Event) => {
      setPolicySettings((e as CustomEvent<CortexVoicePolicySettings>).detail || getVoicePolicy());
    };
    window.addEventListener('cortex-voice-policy-change', onPolicy);
    return () => {
      cortexProactiveVoice.stop();
      window.removeEventListener('cortex-voice-policy-change', onPolicy);
    };
  }, []);

  const patchPolicy = useCallback((patch: Partial<CortexVoicePolicySettings>) => {
    setPolicySettings(updateVoicePolicy(patch));
  }, []);

  const statusLabel = isPttActive
    ? 'LISTENING — release to send'
    : isThinking
      ? 'CORTEX IS THINKING…'
      : voiceStream.isSpeaking
        ? 'CORTEX IS SPEAKING…'
        : isConvoActive
          ? 'CONVO MODE — just talk'
          : 'HOLD SPACE · CONVO · OR TAP MIC';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#020705', overflow: 'hidden' }}
      onClick={() => { recordUserActivity(); try { voiceStreamRef.current?.stopSpeaking(); } catch {} }}
    >
      <iframe
        ref={iframeRef}
        src="/viz/index.html"
        onLoad={attachVizKeys}
        title="CORTEX Visualizer"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', background: '#020705' }}
        allow="autoplay"
      />

      {/* Top-left: voice policy settings */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowVoiceSettings((v) => !v); }}
        style={{
          position: 'absolute', top: 18, left: 18, zIndex: 60,
          width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
          background: 'rgba(4, 16, 10, 0.85)', border: '1px solid rgba(61,220,132,0.4)',
          color: '#3ddc84', fontSize: 16,
          fontFamily: '"SF Mono", Menlo, Consolas, monospace',
          backdropFilter: 'blur(8px)',
        }}
        title="Voice policy settings"
      >
        ⚙
      </button>

      {showVoiceSettings && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: 66, left: 18, zIndex: 60, width: 290,
            padding: '14px 16px', borderRadius: 14,
            background: 'rgba(4, 16, 10, 0.94)', border: '1px solid rgba(61,220,132,0.3)',
            backdropFilter: 'blur(12px)',
            fontFamily: '"SF Mono", Menlo, Consolas, monospace', fontSize: 11,
            color: '#b8d4c8', lineHeight: 1.7,
          }}
        >
          <div style={{ color: '#3ddc84', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 10 }}>
            VOICE POLICY
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={policySettings.proactiveEnabled}
              onChange={(e) => patchPolicy({ proactiveEnabled: e.target.checked })} />
            Proactive speech (Cortex speaks first)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={policySettings.quietHoursEnabled}
              onChange={(e) => patchPolicy({ quietHoursEnabled: e.target.checked })} />
            Quiet hours
            <input type="number" min={0} max={23} value={policySettings.quietStartHour}
              onChange={(e) => patchPolicy({ quietStartHour: parseInt(e.target.value) || 0 })}
              style={{ width: 44, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(61,220,132,0.3)', borderRadius: 4, color: '#e8f0f2', padding: '1px 4px' }} />
            –
            <input type="number" min={0} max={23} value={policySettings.quietEndHour}
              onChange={(e) => patchPolicy({ quietEndHour: parseInt(e.target.value) || 0 })}
              style={{ width: 44, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(61,220,132,0.3)', borderRadius: 4, color: '#e8f0f2', padding: '1px 4px' }} />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 8 }}>
            <input type="checkbox" checked={policySettings.wakeWordRequired}
              onChange={(e) => patchPolicy({ wakeWordRequired: e.target.checked })} />
            Require wake word
          </label>

          {policySettings.wakeWordRequired && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingLeft: 24 }}>
              <span>wake:</span>
              <input type="text" value={policySettings.wakeWord}
                onChange={(e) => patchPolicy({ wakeWord: e.target.value.toLowerCase().trim() || 'cortex' })}
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(61,220,132,0.3)', borderRadius: 4, color: '#e8f0f2', padding: '2px 6px' }} />
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={policySettings.wakeWordAck}
              onChange={(e) => patchPolicy({ wakeWordAck: e.target.checked })} />
            Spoken "Yes?" ack on wake
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span>Confidence:</span>
            <select
              value={policySettings.proactiveMode ?? 'balanced'}
              onChange={(e) => patchPolicy({ proactiveMode: e.target.value as ProactiveMode })}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(61,220,132,0.3)', borderRadius: 4,
                color: '#e8f0f2', padding: '2px 6px', fontFamily: 'inherit', fontSize: 11,
              }}
              title="strict: needs 2+ evidence signals · balanced: standard gates · soft: more proactive, low-confidence marked"
            >
              <option value="strict">strict</option>
              <option value="balanced">balanced</option>
              <option value="soft">soft</option>
            </select>
          </div>

          <VoiceDecisionsList />

          <div style={{ marginTop: 10, color: '#5a6a72', fontSize: 10 }}>
            Idle gate {Math.round(policySettings.minUserIdleMs / 1000)}s · cap {policySettings.maxProactivePerHour}/hr
          </div>
        </div>
      )}

      {/* Top-right: chat launcher */}
      <a
        href="/cortex/chat"
        style={{
          position: 'absolute', top: 18, right: 18, zIndex: 50, textDecoration: 'none',
          padding: '8px 18px', borderRadius: 24,
          background: 'rgba(4, 16, 10, 0.85)', border: '1px solid rgba(61, 220, 132, 0.5)',
          color: '#3ddc84', fontSize: 12, fontWeight: 700,
          fontFamily: '"SF Mono", Menlo, Consolas, monospace', letterSpacing: '0.15em',
          backdropFilter: 'blur(8px)', boxShadow: '0 0 18px rgba(61,220,132,0.25)',
        }}
      >
        ◈ OPEN CHAT
      </a>

      {/* Bottom-center: voice console */}
      <div style={{
        position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        fontFamily: '"SF Mono", Menlo, Consolas, monospace',
      }}>
        {(lastHeard || lastReply) && (
          <div style={{
            maxWidth: 560, padding: '10px 18px', borderRadius: 14,
            background: 'rgba(4, 16, 10, 0.82)', border: '1px solid rgba(61,220,132,0.25)',
            backdropFilter: 'blur(8px)', fontSize: 12, lineHeight: 1.5, color: '#b8d4c8',
            textAlign: 'center',
          }}>
            {lastHeard && <div style={{ color: '#e8f0f2' }}>◈ {lastHeard}</div>}
            {lastReply && <div style={{ color: '#3ddc84', marginTop: 4 }}>CORTEX · {lastReply}</div>}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={toggleConvo}
            style={{
              padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${isConvoActive ? '#3ddc84' : 'rgba(61,220,132,0.35)'}`,
              background: isConvoActive
                ? 'rgba(61,220,132,0.22)'
                : 'rgba(4,16,10,0.85)',
              color: isConvoActive ? '#e8f0f2' : '#3ddc84',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
              fontFamily: '"SF Mono", Menlo, Consolas, monospace',
              backdropFilter: 'blur(8px)',
              boxShadow: isConvoActive ? '0 0 18px rgba(61,220,132,0.4)' : 'none',
            }}
            title="Conversation mode — open mic, just talk"
          >
            {isConvoActive ? '◉ CONVO' : '○ CONVO'}
          </button>

          <button
            onPointerDown={startPtt}
            onPointerUp={stopPtt}
            onPointerLeave={stopPtt}
            style={{
              width: 76, height: 76, borderRadius: '50%', cursor: 'pointer',
              border: `2px solid ${isPttActive ? '#3ddc84' : 'rgba(61,220,132,0.4)'}`,
              background: isPttActive
                ? 'radial-gradient(circle, rgba(61,220,132,0.5), rgba(4,16,10,0.9))'
                : 'radial-gradient(circle, rgba(61,220,132,0.18), rgba(4,16,10,0.92))',
              color: '#e8f0f2', fontSize: 26,
              boxShadow: isPttActive ? '0 0 40px rgba(61,220,132,0.6)' : '0 0 18px rgba(61,220,132,0.2)',
              transition: 'all 0.15s ease',
              touchAction: 'none', userSelect: 'none',
            }}
            title="Hold to talk (or hold SPACE)"
          >
            {isPttActive ? '⏹' : '🎙'}
          </button>
        </div>

        <div style={{
          fontSize: 11, letterSpacing: '0.2em', color: '#5a6a72',
          textShadow: '0 0 8px rgba(0,0,0,0.8)',
        }}>
          {statusLabel}
        </div>

        {voiceError && (
          <div style={{ fontSize: 10, color: '#e7c368', maxWidth: 480, textAlign: 'center' }}>{voiceError}</div>
        )}
      </div>
    </div>
  );
}

/** Recent proactive-speech decisions — the "why it didn't act" log. */
function VoiceDecisionsList() {
  const [decisions, setDecisions] = useState<VoiceDecisionRecord[]>(() => getVoiceDecisions().slice(-6).reverse());
  useEffect(() => {
    const onPolicy = () => setDecisions(getVoiceDecisions().slice(-6).reverse());
    // Decisions are written by the policy module; refresh on policy events
    // and on a light interval so suppressed-then-spoken transitions show up.
    window.addEventListener('cortex-voice-policy-change', onPolicy);
    const t = setInterval(onPolicy, 15_000);
    return () => {
      window.removeEventListener('cortex-voice-policy-change', onPolicy);
      clearInterval(t);
    };
  }, []);
  if (decisions.length === 0) {
    return <div style={{ marginTop: 10, color: '#5a6a72', fontSize: 10 }}>No proactive decisions yet.</div>;
  }
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid rgba(61,220,132,0.15)', paddingTop: 8 }}>
      <div style={{ color: '#5a6a72', fontSize: 9, letterSpacing: '0.12em', marginBottom: 4 }}>
        RECENT DECISIONS
      </div>
      {decisions.map((d, i) => (
        <div key={`${d.ts}-${i}`} style={{
          fontSize: 9.5, lineHeight: 1.5,
          color: d.allow ? '#7fd6a4' : '#8a9a92',
        }}>
          <span style={{ color: '#5a6a72' }}>{new Date(d.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>{' '}
          {d.allow ? 'spoke' : 'held'} {d.category}
          {d.confidence === 'low' ? ' (low-confidence)' : ''}
          <span style={{ color: '#5a6a72' }}> — {d.reason}</span>
        </div>
      ))}
    </div>
  );
}
