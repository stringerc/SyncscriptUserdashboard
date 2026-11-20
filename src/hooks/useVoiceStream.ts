/**
 * useVoiceStream Hook
 * 
 * Manages real-time voice capture via browser microphone,
 * speech-to-text transcription (Web Speech API + Groq Whisper fallback),
 * and text-to-speech audio output.
 * 
 * Architecture:
 * - Primary STT: Web Speech API (free, zero-cost, works in Chrome/Edge/Safari)
 * - Fallback STT: Groq Whisper API (free tier, higher accuracy)
 * - Primary TTS: Kokoro via /api/ai/tts (chunked landing pipeline for `cortana`, then monolithic proxy + direct).
 * - Direct: GET /api/ai/tts exposes primary + optional `kokoroFallbackDirectOrigin` (e.g. Oracle backup).
 * - Cortana preset: **no** browser SpeechSynthesis — neural-only or error (avoids robotic fallback).
 * - Other presets: Web Speech API last resort.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { disableTtsProxyForSession, isTtsProxyDisabled } from '../utils/tts-proxy-session';
import { NEXUS_LANDING_KOKORO_VOICE_ID } from '../utils/nexus-tts-prosody';
import { playNexusLandingKokoroTTS } from '../utils/nexus-kokoro-landing-playback';
import { ensureKokoroOriginsLoaded, getKokoroDirectBases, fetchKokoroBufferForNexusSegment } from '../utils/nexus-kokoro-tts-fetch';
import { sentenceToNexusProsodySegment } from '../utils/nexus-tts-prosody';
import { PcmQueue, pumpWavToPcm } from '../utils/wav-pcm-stream';
import { reportTtsRum } from '../utils/tts-rum-beacon';
import { stepVuEnvelope } from '../utils/audio-vu-envelope';
import { voiceLatencyMark, voiceLatencyMeasure } from '../utils/voice-latency-debug';
import { createPcmFeeder, getEouEngine } from '../lib/voice/semantic-eou';
import {
  getSmartTurnDetector,
  smartTurnFlagOff,
  SMART_TURN_COMMIT_THRESHOLD,
  type SmartTurnDetector,
  type SmartTurnDetectorState,
} from '../lib/voice/turn-detector';
import { MicVAD } from '@ricky0123/vad-web';
import type {
  VoiceEngineState,
  VoiceEngineStatus,
  STTResult,
  TTSRequest,
  TTSModel,
  EmotionState,
} from '../types/voice-engine';

// ============================================================================
// WEB SPEECH API TYPE AUGMENTATION
// ============================================================================

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TTS_PROXY_ATTEMPTS = 3;
/** Max concurrent sentence-synthesis requests — prefetch stays gapless
 *  without bursting the TTS server on long replies. */
const TTS_PREFETCH_AHEAD = 3;

/** Monolithic Kokoro via Vercel proxy with transient 502/503/504 retries (cold ONNX / tunnel blips). */
async function fetchTtsProxyAudio(text: string, voice: string, speed: number): Promise<Blob | null> {
  if (isTtsProxyDisabled()) return null;
  for (let attempt = 0; attempt < TTS_PROXY_ATTEMPTS; attempt += 1) {
    try {
      // Hard timeout — a stalled proxy must never wedge a voice turn (the
      // queue can't drain while isSpeaking/turnInFlight stays stuck).
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, speed }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.startsWith('audio/')) {
          const blob = await res.blob();
          if (blob.size > 100) return blob;
        }
        return null;
      }
      const errData = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
      if (errData.code === 'NO_TTS_URL') {
        disableTtsProxyForSession();
        return null;
      }
      if (res.status === 503 || res.status === 502 || res.status === 504) {
        await delayMs(400 * (attempt + 1));
        continue;
      }
      break;
    } catch {
      if (attempt < TTS_PROXY_ATTEMPTS - 1) await delayMs(400 * (attempt + 1));
    }
  }
  return null;
}

// ============================================================================
// HOOK OPTIONS
// ============================================================================

export interface UseVoiceStreamOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  /** Fired when local energy-VAD detects ~650ms of silence while interim
   *  transcript text exists — lets callers commit the turn before Chrome's
   *  endpointing lag (~0.5-1.5s). Caller must dedupe the later final. */
  onSpeechPause?: (interimText: string) => void;
  ttsModel?: TTSModel;
  ttsVoice?: string;
  ttsRate?: number;
  ttsPitch?: number;
  onTranscript?: (result: STTResult) => void;
  onStatusChange?: (status: VoiceEngineStatus) => void;
  onError?: (error: string) => void;
  onSpeechEnd?: () => void;
  /**
   * When fullDuplex is true (default), speech recognition is NOT suppressed during TTS playback.
   * This allows real-time user barge-in and efference copy evaluation mirroring OpenAI Voice Mode.
   */
  fullDuplex?: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useVoiceStream(options: UseVoiceStreamOptions = {}) {
  const {
    language = 'en-US',
    continuous = true,
    interimResults = true,
    onSpeechPause,
    fullDuplex = true,
    ttsModel = 'web-speech-api',
    ttsVoice,
    ttsRate = 1.0,
    ttsPitch = 1.0,
    onTranscript,
    onStatusChange,
    onError,
    onSpeechEnd,
  } = options;

  /** STT is wired once on mount; always invoke latest parent callbacks (avoid stale closures). */
  const onTranscriptRef = useRef(onTranscript);
  const onStatusChangeRef = useRef(onStatusChange);
  const onSpeechEndRef = useRef(onSpeechEnd);
  const onErrorRef = useRef(onError);
  onTranscriptRef.current = onTranscript;
  onStatusChangeRef.current = onStatusChange;
  onSpeechEndRef.current = onSpeechEnd;
  onErrorRef.current = onError;

  // State
  const [state, setState] = useState<VoiceEngineState>({
    status: 'idle',
    isFullDuplex: fullDuplex,
    sttReady: false,
    ttsReady: false,
    emotionDetectionReady: false,
    interimTranscript: '',
  });

  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [turnDetectorState, setTurnDetectorState] = useState<SmartTurnDetectorState>(() =>
    smartTurnFlagOff() ? 'off' : 'idle');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const latestInterimRef = useRef('');
  const vadPauseFiredRef = useRef(false);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vadAudioCtxRef = useRef<AudioContext | null>(null);
  const vadFeederStopRef = useRef<(() => void) | null>(null);
  const vadNeuralRef = useRef<MicVAD | null>(null);
  const smartTurnRef = useRef<SmartTurnDetector | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isListeningRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const lastSpeechEndTimeRef = useRef<number>(0);
  const speechEpochRef = useRef<number>(0);
  const inFlightFetchAbortRef = useRef<AbortController | null>(null);

  // Streaming Sentence Audio Queue (for sub-600ms progressive speech playback)
  interface StreamSentenceItem {
    id: number;
    text: string;
    isFinal: boolean;
    /** Lazy fetch starter — invoked by prefetch/drain, not at enqueue time,
     *  so a long reply can't burst N concurrent synthesis requests. */
    startFetch: () => Promise<Blob | null>;
    fetchPromise?: Promise<Blob | null>;
    /** Streaming path — pocket-tts emits WAV PCM progressively, so audio can
     *  be scheduled the moment the first frames arrive instead of after the
     *  whole utterance synthesizes. Null when the proxy can't stream. */
    streamPromise?: Promise<PcmQueue | null>;
    queuedAt: number;
    voice?: string;
    speed?: number;
  }
  const streamSentenceQueueRef = useRef<StreamSentenceItem[]>([]);
  const isDrainingStreamRef = useRef(false);
  const streamEpochRef = useRef<number>(0);
  const streamTtsAbortRef = useRef<AbortController | null>(null);
  const streamFetchesActiveRef = useRef(0);

  // Gapless stream playback: decoded buffers are scheduled back-to-back on a
  // shared AudioContext (72ms inter-chunk tail trim, same as the landing
  // player) — eliminates the ~100-400ms dead air per sentence boundary that
  // per-sentence <audio> elements caused.
  const gaplessCtxRef = useRef<AudioContext | null>(null);
  const gaplessAnalyserRef = useRef<AnalyserNode | null>(null);
  const gaplessSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const gaplessNextStartRef = useRef(0);
  const gaplessVuRafRef = useRef<number | null>(null);

  // ==========================================================================
  // INITIALIZE SPEECH RECOGNITION (STT)
  // ==========================================================================

  const initSTT = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      setState(prev => ({ ...prev, sttReady: false, lastError: 'Speech recognition not supported in this browser' }));
      onErrorRef.current?.('Speech recognition not supported. Please use Chrome, Edge, or Safari.');
      return false;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // If fullDuplex is disabled (legacy half-duplex walkie-talkie mode),
      // drop microphone events while AI is vocalizing or in the reverb tail.
      if (!fullDuplex) {
        const now = Date.now();
        const inReverbWindow = (now - lastSpeechEndTimeRef.current) < 2200;
        if (isSpeakingRef.current || inReverbWindow) {
          return;
        }
      }

      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) {
        latestInterimRef.current = interim.trim();
        setInterimText(interim);
        setState(prev => ({ ...prev, interimTranscript: interim }));
        // Emit interim transcript for real-time barge-in and VAD silence endpointing
        onTranscriptRef.current?.({
          text: interim.trim(),
          confidence: 0.8,
          isFinal: false,
          language,
        });
      }

      if (finalTranscript) {
        latestInterimRef.current = '';
        vadPauseFiredRef.current = true; // suppress VAD re-fire for this utterance
        setTranscript(prev => prev + (prev ? ' ' : '') + finalTranscript);
        setInterimText('');
        setState(prev => ({ ...prev, interimTranscript: '' }));
        
        const sttResult: STTResult = {
          text: finalTranscript.trim(),
          confidence: event.results[event.results.length - 1]?.[0]?.confidence || 0.9,
          isFinal: true,
          language,
        };
        onTranscriptRef.current?.(sttResult);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      if (event.error === 'not-allowed') {
        shouldRestartRef.current = false;
        isListeningRef.current = false;
      }
      const errorMsg = `Speech recognition error: ${event.error}`;
      setState(prev => ({ ...prev, lastError: errorMsg }));
      onErrorRef.current?.(errorMsg);
    };

    recognition.onend = () => {
      if (shouldRestartRef.current && isListeningRef.current) {
        try {
          recognition.start();
        } catch {
          isListeningRef.current = false;
          setState(prev => ({ ...prev, status: 'idle' }));
          onStatusChangeRef.current?.('idle');
        }
      } else {
        isListeningRef.current = false;
        setState(prev => ({ ...prev, status: 'idle' }));
        onStatusChangeRef.current?.('idle');
        onSpeechEndRef.current?.();
      }
    };

    recognition.onstart = () => {
      isListeningRef.current = true;
      setState(prev => ({ ...prev, status: 'listening' }));
      onStatusChangeRef.current?.('listening');
    };

    recognitionRef.current = recognition;
    setState(prev => ({ ...prev, sttReady: true }));
    return true;
  }, [language, continuous, interimResults]);

  // ==========================================================================
  // INITIALIZE TEXT-TO-SPEECH (TTS)
  // ==========================================================================

  const initTTS = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setState(prev => ({ ...prev, ttsReady: false }));
      return false;
    }

    synthRef.current = window.speechSynthesis;

    const loadVoices = () => {
      const voices = synthRef.current?.getVoices() || [];
      setAvailableVoices(voices);
      setState(prev => ({ ...prev, ttsReady: voices.length > 0 }));
    };

    loadVoices();
    if (synthRef.current) {
      synthRef.current.onvoiceschanged = loadVoices;
    }

    return true;
  }, []);

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  useEffect(() => {
    initSTT();
    initTTS();

    return () => {
      stopListening();
      stopSpeaking();
      stopEnergyVAD();
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        } catch {}
        mediaStreamRef.current = null;
      }
      // Clean up SpeechSynthesis event handler
      if (synthRef.current) {
        synthRef.current.onvoiceschanged = null;
      }
      // Abort any active recognition
      try {
        recognitionRef.current?.abort();
      } catch {
        // Already stopped
      }
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================================
  // STT CONTROLS
  // ==========================================================================

  const startListening = useCallback(() => {
    // Acquire WebRTC audio track with hardware AEC / noise suppression / AGC
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      if (!mediaStreamRef.current) {
        navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
          },
        }).then((stream) => {
          mediaStreamRef.current = stream;
          startEnergyVAD(stream);
        }).catch((aecErr) => {
          console.warn('[useVoiceStream] WebRTC AEC stream init fallback:', aecErr);
        });
      }
    }

    if (!recognitionRef.current) {
      const initialized = initSTT();
      if (!initialized) return;
    }

    try {
      shouldRestartRef.current = continuous;
      setTranscript('');
      setInterimText('');
      recognitionRef.current?.start();
    } catch (err) {
      if (isListeningRef.current) return;
      onErrorRef.current?.('Failed to start speech recognition');
    }
  }, [initSTT, continuous]);

  const stopEnergyVAD = useCallback(() => {
    if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null; }
    try { vadFeederStopRef.current?.(); } catch {}
    vadFeederStopRef.current = null;
    try { vadAudioCtxRef.current?.close(); } catch {}
    vadAudioCtxRef.current = null;
    const neural = vadNeuralRef.current;
    vadNeuralRef.current = null;
    if (neural) void neural.destroy().catch(() => {});
    smartTurnRef.current = null;
  }, []);

  const startEnergyVAD = useCallback((stream: MediaStream) => {
    if (!onSpeechPause || vadTimerRef.current) return;
    try {
      // Smart-turn detector (worker ONNX): preload lazily once the mic stream
      // exists; shares the feeder's 16kHz PCM — no second audio graph.
      const smartTurn = getSmartTurnDetector();
      smartTurnRef.current = smartTurn;
      if (smartTurn) {
        smartTurn.onStateChange = (s) => setTurnDetectorState(s);
        void smartTurn.preload();
        setTurnDetectorState(smartTurn.state);
      } else {
        setTurnDetectorState(smartTurnFlagOff() ? 'off' : 'unavailable');
      }
      // Semantic EOU: feed 16kHz PCM into the smart-turn ring buffer so the
      // silence path can ask "is the speaker actually done?" instead of
      // committing on a fixed timer. Best-effort — null engine → legacy path.
      const eouFeederStop = createPcmFeeder(stream, (_eng, samples) => {
        try { smartTurn?.pushAudio(samples); } catch { /* best-effort */ }
      });
      vadFeederStopRef.current = eouFeederStop;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      vadAudioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2;
      src.connect(analyser);
      const floatBuf = new Float32Array(analyser.fftSize);
      let silenceMs = 0;
      let ambientFloor = 0.008;
      let eouScoring = false;
      let eouExtended = false;
      // Smart-turn (worker ONNX) early-commit state: judged once per pause,
      // speechRunMs = duration of the speech run that just ended (min-speech
      // gate so sub-500ms blips can't trigger a semantic verdict).
      let smartTurnJudged = false;
      let smartTurnScoring = false;
      let speechRunMs = 0;
      // Neural VAD (Silero v5, AudioWorklet) — once frames flow it becomes the
      // authoritative speech/silence clock; the RMS analyser above remains as
      // the automatic fallback if the model/worklet never comes up.
      let neuralLive = false;
      let neuralLastSpeechAt = 0;
      const NEURAL_SPEECH_ON = 0.25;
      void MicVAD.new({
        model: 'v5',
        baseAssetPath: '/vad/',
        onnxWASMBasePath: '/vad/wasm/',
        startOnLoad: false,
        onSpeechStart: () => {
          neuralLastSpeechAt = performance.now();
          eouExtended = false;
          vadPauseFiredRef.current = false;
          smartTurnJudged = false;
          void getEouEngine().then((eng) => eng?.reset());
          smartTurnRef.current?.reset();
        },
        onFrameProcessed: (probs) => {
          neuralLive = true;
          if (probs.isSpeech > NEURAL_SPEECH_ON) {
            neuralLastSpeechAt = performance.now();
          }
        },
      }).then(async (vad) => {
        vadNeuralRef.current = vad;
        await vad.start();
      }).catch(() => { /* neural VAD unavailable — RMS path continues */ });
      vadTimerRef.current = setInterval(() => {
        if (neuralLive) {
          // Neural clock: silence = ms since last speech-probable frame.
          silenceMs = performance.now() - neuralLastSpeechAt;
          if (silenceMs < 300) {
            // Fresh speech — cancel a pending semantic extension and
            // unsuppress commits, mirroring the RMS speech branch.
            eouExtended = false;
            vadPauseFiredRef.current = false;
          }
        } else {
          analyser.getFloatTimeDomainData(floatBuf);
          let sum = 0;
          for (let i = 0; i < floatBuf.length; i++) {
            const v = floatBuf[i];
            sum += v * v;
          }
          const rms = Math.sqrt(sum / floatBuf.length);

          // Adaptive noise floor tracking during quiet windows
          if (rms < 0.02) {
            ambientFloor = ambientFloor * 0.95 + rms * 0.05;
          }
          const speechThreshold = Math.max(0.012, ambientFloor * 2.0);

          // Speech energy detected: reset silence counter + EOU state.
          // After a real pause, clear the smart-turn window so stale audio
          // from the previous utterance can't bias the next score.
          if (rms > speechThreshold) {
            if (silenceMs >= 250) {
              void getEouEngine().then((eng) => eng?.reset());
              smartTurnRef.current?.reset();
            }
            silenceMs = 0;
            speechRunMs += 50;
            smartTurnJudged = false;
            eouExtended = false;
            vadPauseFiredRef.current = false;
            return;
          }

          silenceMs += 50;
        }
        // Speech-run accounting: neural path reaches here every tick; the
        // RMS path returns early on speech ticks (handled above), so only
        // silence-side bookkeeping lives here. speechRunMs freezes during a
        // pause (it measured the run that just ended) and resets at 600ms.
        if (silenceMs < 300) {
          speechRunMs += 50;
          smartTurnJudged = false;
        } else if (silenceMs >= 600) {
          speechRunMs = 0;
        }
        const t = latestInterimRef.current;
        const hasText = t && t.length >= 3;
        // Smart-turn early verdict: ~400ms into a pause, score the audio
        // window directly — a confident "done" commits before the 850ms
        // finish window; "not done" buys the same single extension the
        // semantic-EOU path uses. Silent no-op until the worker is ready.
        if (
          silenceMs >= 400 && silenceMs < 2000 && !smartTurnJudged &&
          !smartTurnScoring && !eouScoring && !eouExtended &&
          !vadPauseFiredRef.current && !isSpeakingRef.current && hasText &&
          speechRunMs >= 450
        ) {
          const det = smartTurnRef.current;
          if (det && det.state === 'ready') {
            smartTurnJudged = true;
            smartTurnScoring = true;
            void det.score().then((prob) => {
              smartTurnScoring = false;
              // silenceMs < 300 means the user already resumed — the verdict
              // is stale and must not cut them off.
              if (prob === null || vadPauseFiredRef.current || isSpeakingRef.current || silenceMs < 300) return;
              if (prob >= SMART_TURN_COMMIT_THRESHOLD) {
                const latest = latestInterimRef.current;
                const finalText = latest && latest.length >= 3 ? latest : t;
                if (!vadPauseFiredRef.current && !isSpeakingRef.current) {
                  vadPauseFiredRef.current = true;
                  onSpeechPause(finalText);
                }
              } else {
                // Model says the turn is NOT complete — extend once.
                eouExtended = true;
                silenceMs = Math.min(silenceMs, 400);
              }
            });
          }
        }
        // Semantic gate: at ~600ms silence ask smart-turn whether the turn is
        // actually complete. "Still speaking" (thinking pause) buys one
        // extension to ~1.6s, then a final score; hard cap ~2.4s regardless.
        if (silenceMs >= 600 && !vadPauseFiredRef.current && !isSpeakingRef.current && hasText) {
          const scoreAt = eouExtended ? 1600 : 600;
          if (silenceMs >= scoreAt && !eouScoring && !smartTurnScoring) {
            eouScoring = true;
            void getEouEngine().then(async (eng) => {
              eouScoring = false;
              const res = eng ? await eng.score() : null;
              if (res && res.commit === false && !eouExtended) {
                // Model says turn is NOT complete — extend once.
                eouExtended = true;
                silenceMs = Math.min(silenceMs, 400);
                return;
              }
              const latest = latestInterimRef.current;
              const finalText = latest && latest.length >= 3 ? latest : t;
              if (!vadPauseFiredRef.current && !isSpeakingRef.current) {
                vadPauseFiredRef.current = true;
                onSpeechPause(finalText);
              }
            });
            return; // wait for async verdict this tick
          }
          // Never commit while a verdict is in flight — but the 2.4s hard
          // cap below must still fire even if a score promise is stuck.
          if ((eouScoring || smartTurnScoring) && silenceMs < 2400) return;
          // Hard cap — no path may listen past ~2.4s of silence.
          if (silenceMs >= 2400) {
            vadPauseFiredRef.current = true;
            onSpeechPause(t);
          }
        }
      }, 50);
    } catch { /* VAD is best-effort */ }
  }, [onSpeechPause]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    isListeningRef.current = false;
    stopEnergyVAD();
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      mediaStreamRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped
    }
    setState(prev => ({ ...prev, status: 'idle' }));
    onStatusChangeRef.current?.('idle');
  }, []);

  // ==========================================================================
  // TTS CONTROLS — Server proxy (primary) → Kokoro direct → browser fallback
  // ==========================================================================

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeUrlRef = useRef<string | null>(null);
  const activeSpokenTextRef = useRef<string>('');

  /** Kokoro blob playback — Web Audio analyser for immersive blob reactivity */
  const ttsAudioCtxRef = useRef<AudioContext | null>(null);
  const ttsSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const ttsAnalyserNodeRef = useRef<AnalyserNode | null>(null);
  const ttsRafRef = useRef<number | null>(null);
  /** VU peak follower state for `playAudioBlob` path (persists across RAF ticks; reset in cleanup). */
  const ttsVuEnvelopeRef = useRef(0);
  const [ttsOutputLevel, setTtsOutputLevel] = useState(0);
  /** Aborts chunked landing Kokoro playback when `speak`/`stopSpeaking` interrupts. */
  const landingKokoroAbortRef = useRef<AbortController | null>(null);

  const cleanupTtsAnalyzer = useCallback(() => {
    if (ttsRafRef.current != null) {
      cancelAnimationFrame(ttsRafRef.current);
      ttsRafRef.current = null;
    }
    try {
      ttsSourceNodeRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    ttsSourceNodeRef.current = null;
    ttsAnalyserNodeRef.current = null;
    ttsVuEnvelopeRef.current = 0;
    setTtsOutputLevel(0);
  }, []);

  const selectVoice = useCallback((voiceName?: string): SpeechSynthesisVoice | null => {
    if (!availableVoices.length) return null;

    if (voiceName) {
      const match = availableVoices.find(v => v.name.toLowerCase().includes(voiceName.toLowerCase()));
      if (match) return match;
    }

    // Prioritize high-fidelity neural and natural voices per platform (avoid robotic legacy synthesizers like Samantha)
    const preferred = [
      'Google US English', 'Google UK English Female', 'Google UK English Male', // Chrome neural cloud voices (natural, human inflection)
      'Microsoft Jenny Online (Natural)', 'Microsoft Aria Online (Natural)',   // Edge/Windows natural neural voices
      'Microsoft Jenny', 'Microsoft Aria',
      'Ava (Premium)', 'Ava (Enhanced)', 'Ava',                               // macOS Siri / premium neural voices
      'Allison (Enhanced)', 'Allison',
      'Zoe (Enhanced)', 'Zoe',
      'Daniel', 'Karen',                                                       // macOS crisp natural voices
      'Samantha',                                                              // Legacy macOS fallback
    ];

    for (const name of preferred) {
      const match = availableVoices.find(v => v.name.includes(name));
      if (match) return match;
    }

    return availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
  }, [availableVoices]);

  /** Play an audio blob, resolving when playback completes. Routes through AnalyserNode for `ttsOutputLevel`. */
  const playAudioBlob = useCallback(
    (blob: Blob, keepSpeakingState = false): Promise<void> => {
      const url = URL.createObjectURL(blob);
      activeUrlRef.current = url;

      return new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audio.preload = 'auto';
        activeAudioRef.current = audio;

        let alive = true;

        const finish = () => {
          if (!alive) return;
          alive = false;
          cleanupTtsAnalyzer();
          if (activeUrlRef.current === url) {
            URL.revokeObjectURL(url);
            activeUrlRef.current = null;
          }
          if (activeAudioRef.current === audio) {
            activeAudioRef.current = null;
          }
          if (!keepSpeakingState) {
            activeSpokenTextRef.current = '';
            lastSpeechEndTimeRef.current = Date.now();
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            setState(prev => ({ ...prev, status: 'idle' }));
            onStatusChangeRef.current?.('idle');
          }
          resolve();
        };

        const tryWebAudio = (): boolean => {
          try {
            const AC =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AC) return false;

            let ctx = ttsAudioCtxRef.current;
            if (!ctx || ctx.state === 'closed') {
              ctx = new AC();
              ttsAudioCtxRef.current = ctx;
            }

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            /** Higher = less jitter in RMS (smoother orb; tiny tradeoff in peak “snap”). */
            analyser.smoothingTimeConstant = 0.93;

            const source = ctx.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(ctx.destination);

            ttsSourceNodeRef.current = source;
            ttsAnalyserNodeRef.current = analyser;

            const data = new Uint8Array(analyser.fftSize);
            let lastSet = 0;

            const tick = () => {
              const node = ttsAnalyserNodeRef.current;
              if (!alive || !node) return;
              node.getByteTimeDomainData(data);
              let sum = 0;
              for (let i = 0; i < data.length; i++) {
                const v = (data[i] - 128) / 128;
                sum += v * v;
              }
              const rms = Math.sqrt(sum / data.length);
              const level = Math.min(1, rms * 6.2);
              ttsVuEnvelopeRef.current = stepVuEnvelope(level, ttsVuEnvelopeRef.current);

              const now = performance.now();
              if (now - lastSet > 52) {
                lastSet = now;
                setTtsOutputLevel(ttsVuEnvelopeRef.current);
              }

              ttsRafRef.current = requestAnimationFrame(tick);
            };

            ttsRafRef.current = requestAnimationFrame(tick);
            return true;
          } catch (err) {
            console.warn('[TTS] Web Audio routing failed, using built-in output', err);
            return false;
          }
        };

        const webOk = tryWebAudio();

        const startPlayback = async () => {
          if (webOk && ttsAudioCtxRef.current) {
            await ttsAudioCtxRef.current.resume().catch(() => {});
          }
          try {
            await audio.play();
          } catch {
            finish();
          }
        };

        audio.onended = finish;
        audio.onerror = () => finish();

        void startPlayback();
      });
    },
    [cleanupTtsAnalyzer],
  );

  /** Speak using browser SpeechSynthesis as a last resort */
  const speakBrowserFallback = useCallback((request: TTSRequest, epoch?: number): Promise<void> => {
    if (!synthRef.current) {
      lastSpeechEndTimeRef.current = Date.now();
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      setState(prev => ({ ...prev, status: 'idle' }));
      onStatusChangeRef.current?.('idle');
      return Promise.resolve();
    }

    if (epoch !== undefined && speechEpochRef.current !== epoch) {
      return Promise.resolve();
    }

    console.warn('[TTS] Using browser speechSynthesis fallback — voice will sound robotic');

    return new Promise<void>((resolve) => {
      synthRef.current!.cancel();
      const utterance = new SpeechSynthesisUtterance(request.text);
      const voice = selectVoice(request.config?.voice || ttsVoice);
      if (voice) {
        utterance.voice = voice;
        console.info(`[TTS] Browser voice: ${voice.name}`);
      }
      utterance.rate = request.config?.speed || ttsRate;
      utterance.pitch = request.config?.pitch || ttsPitch;
      utterance.volume = 1.0;

      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        activeSpokenTextRef.current = '';
        lastSpeechEndTimeRef.current = Date.now();
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        setState(prev => ({ ...prev, status: 'idle' }));
        onStatusChangeRef.current?.('idle');
        resolve();
      };

      utterance.onend = done;
      utterance.onerror = done;
      currentUtteranceRef.current = utterance;
      synthRef.current!.speak(utterance);
    });
  }, [selectVoice, ttsVoice, ttsRate, ttsPitch]);

  /**
   * Speak text using the best available TTS engine.
   * Chain: /api/ai/tts proxy (works in both dev + prod) → direct Kokoro → browser fallback.
   * Single-Speaker Audio Mutex: Cancels all previous in-flight requests and audio playback.
   */
  const speak = useCallback(async (request: TTSRequest): Promise<void> => {
    speechEpochRef.current += 1;
    const currentEpoch = speechEpochRef.current;

    // Mutex: Abort any in-flight TTS fetches immediately
    if (inFlightFetchAbortRef.current) {
      inFlightFetchAbortRef.current.abort();
      inFlightFetchAbortRef.current = null;
    }
    const fetchAbort = new AbortController();
    inFlightFetchAbortRef.current = fetchAbort;

    cleanupTtsAnalyzer();
    // Gapless stream sources — stop() fires onended; the set-membership
    // guard in onended prevents a spurious finalize after abort.
    for (const src of gaplessSourcesRef.current) {
      gaplessSourcesRef.current.delete(src);
      try { src.stop(); } catch {}
    }
    gaplessNextStartRef.current = 0;
    if (gaplessVuRafRef.current != null) {
      cancelAnimationFrame(gaplessVuRafRef.current);
      gaplessVuRafRef.current = null;
    }
    setTtsOutputLevel(0);
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }
    synthRef.current?.cancel();
    landingKokoroAbortRef.current?.abort();
    landingKokoroAbortRef.current = null;

    if (!request.text?.trim()) return;

    activeSpokenTextRef.current = request.text;
    voiceLatencyMark('tts_speak_enter');
    voiceLatencyMeasure('tts_precall_to_speak_enter', 'tts_precall', 'tts_speak_enter');

    const rumStart = typeof performance !== 'undefined' ? performance.now() : 0;

    isSpeakingRef.current = true;
    setIsSpeaking(true);
    setState(prev => ({ ...prev, status: 'speaking' }));
    onStatusChangeRef.current?.('speaking');

    const resolveVoice = (): string => {
      if (request.config?.voice) return request.config.voice;
      const emotion = request.emotion?.primary;
      if (emotion === 'stressed' || emotion === 'sad') return 'gentle';
      if (emotion === 'excited' || emotion === 'happy') return 'playful';
      /** Match Nexus + desktop companion Kokoro preset (`cortana` custom voice). */
      return 'cortana';
    };

    const voicePreset = resolveVoice();
    const speed = request.config?.speed || 1.0;
    const preferCartesia = Boolean(request.config?.preferCartesia);
    if (preferCartesia) {
      console.info('[TTS] preferCartesia requested — prioritizing ultra-low-latency neural synthesis');
    }
    // --- Kokoro-82M Local Neural Synthesis via /api/ai/tts (Primary Engine — 100% Free, Zero External Credits) ---
    // If text has multiple sentences (> 80 chars or sentence punctuation), use progressive chunked player for immediate speech onset
    const isMultiSentence = /[.!?]\s+[A-Z0-9]/.test(request.text) || request.text.length > 100;
    if (isMultiSentence) {
      try {
        console.info(`[TTS] Requesting progressive chunked Kokoro-82M (/api/ai/tts, text length: ${request.text.length})…`);
        const ac = new AbortController();
        landingKokoroAbortRef.current = ac;
        const played = await playNexusLandingKokoroTTS(request.text, ac.signal, setTtsOutputLevel);
        if (speechEpochRef.current === currentEpoch && played) {
          reportTtsRum({
            outcome: 'ok',
            path: 'kokoro_progressive',
            voicePreset,
            durationMs: typeof performance !== 'undefined' ? performance.now() - rumStart : 0,
          });
          lastSpeechEndTimeRef.current = Date.now();
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          setState(prev => ({ ...prev, status: 'idle' }));
          onStatusChangeRef.current?.('idle');
          return;
        }
      } catch (progErr) {
        console.warn('[TTS] Progressive Kokoro playback error — falling back to monolithic…', progErr);
      } finally {
        landingKokoroAbortRef.current = null;
      }
    }

    try {
      console.info(`[TTS] Requesting local Kokoro-82M (/api/ai/tts, voice: ${voicePreset}, speed: ${speed})…`);
      const kokoroBlob = await fetchTtsProxyAudio(request.text, voicePreset, speed);
      if (speechEpochRef.current !== currentEpoch || fetchAbort.signal.aborted) {
        console.info('[TTS Mutex] Discarded superseded Kokoro synthesis');
        return;
      }
      if (kokoroBlob && kokoroBlob.size > 100) {
        console.info(`[TTS] ✅ Kokoro-82M Local — ${kokoroBlob.size} bytes`);
        reportTtsRum({
          outcome: 'ok',
          path: 'kokoro_local',
          voicePreset,
          durationMs: typeof performance !== 'undefined' ? performance.now() - rumStart : 0,
        });
        return playAudioBlob(kokoroBlob);
      }
    } catch (kErr) {
      console.warn('[TTS] Kokoro proxy synthesis error — falling back to landing/browser', kErr);
    }

    if (speechEpochRef.current !== currentEpoch || fetchAbort.signal.aborted) return;

    // --- Landing-identical Nexus: chunked prosody + voice fallbacks + trimmed Web Audio (+ cold replay) ---
    if (voicePreset === NEXUS_LANDING_KOKORO_VOICE_ID) {
      const runLanding = async (): Promise<boolean> => {
        const ac = new AbortController();
        landingKokoroAbortRef.current = ac;
        try {
          console.info('[TTS] Nexus landing pipeline (chunked prosody + cortana→natural→nexus→professional)…');
          return await playNexusLandingKokoroTTS(request.text, ac.signal, setTtsOutputLevel);
        } catch (err) {
          console.warn('[TTS] Landing Kokoro pipeline error — will retry or fall back', err);
          return false;
        } finally {
          landingKokoroAbortRef.current = null;
        }
      };

      let played = await runLanding();
      if (!played && speechEpochRef.current === currentEpoch) {
        console.warn('[TTS] Landing pipeline produced no audio — cold replay after 450ms (ONNX warm-up)');
        await delayMs(450);
        if (speechEpochRef.current === currentEpoch) {
          played = await runLanding();
        }
      }
      if (speechEpochRef.current !== currentEpoch) return;
      if (played) {
        reportTtsRum({
          outcome: 'ok',
          path: 'landing',
          voicePreset,
          durationMs: typeof performance !== 'undefined' ? performance.now() - rumStart : 0,
        });
        lastSpeechEndTimeRef.current = Date.now();
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        setState(prev => ({ ...prev, status: 'idle' }));
        onStatusChangeRef.current?.('idle');
        return;
      }
      console.warn('[TTS] Landing Kokoro pipeline produced no audio — trying monolithic proxy');
    }

    if (speechEpochRef.current !== currentEpoch || fetchAbort.signal.aborted) return;

    // --- Monolithic /api/ai/tts proxy with transient retries (primary + server-side fallback Kokoro) ---
    console.info(`[TTS] Trying /api/ai/tts proxy (voice: ${voicePreset}, speed: ${speed})…`);
    const proxyBlob = await fetchTtsProxyAudio(request.text, voicePreset, speed);
    if (speechEpochRef.current !== currentEpoch || fetchAbort.signal.aborted) return;
    if (proxyBlob) {
      console.info(`[TTS] ✅ Kokoro via proxy — ${proxyBlob.size} bytes`);
      reportTtsRum({
        outcome: 'ok',
        path: 'proxy',
        voicePreset,
        durationMs: typeof performance !== 'undefined' ? performance.now() - rumStart : 0,
      });
      return playAudioBlob(proxyBlob);
    }

    if (speechEpochRef.current !== currentEpoch || fetchAbort.signal.aborted) return;

    // --- Direct Kokoro: primary + optional fallback origin from GET /api/ai/tts (Oracle / second tunnel) ---
    await ensureKokoroOriginsLoaded();
    const kokoroBases = getKokoroDirectBases();
    if (kokoroBases.length > 0) {
      for (let bi = 0; bi < kokoroBases.length; bi += 1) {
        if (speechEpochRef.current !== currentEpoch || fetchAbort.signal.aborted) return;
        const base = kokoroBases[bi];
        try {
          console.info(`[TTS] Trying direct Kokoro at ${base} (voice: ${voicePreset})…`);
          const res = await fetch(`${base}/v1/audio/speech`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'kokoro-onnx',
              input: request.text,
              voice: voicePreset === 'cortana' ? 'bm_lewis' : voicePreset,
              speed,
            }),
            signal: fetchAbort.signal,
          });
          if (speechEpochRef.current !== currentEpoch) return;
          if (res.ok) {
            const blob = await res.blob();
            if (blob.size > 100) {
              console.info(`[TTS] ✅ Direct Kokoro — ${blob.size} bytes`);
              reportTtsRum({
                outcome: 'ok',
                path: bi === 0 ? 'direct_0' : 'direct_1',
                voicePreset,
                durationMs: typeof performance !== 'undefined' ? performance.now() - rumStart : 0,
              });
              return playAudioBlob(blob);
            }
          }
          console.warn(`[TTS] Direct Kokoro failed: HTTP ${res.status} (${base})`);
        } catch (err: unknown) {
          console.warn(`[TTS] Direct Kokoro error (${base}):`, err);
        }
      }
    }

    if (speechEpochRef.current !== currentEpoch || fetchAbort.signal.aborted) return;

    // --- Cortana / Nexus neural preset fallback ---
    if (voicePreset === NEXUS_LANDING_KOKORO_VOICE_ID) {
      console.warn('[TTS] Kokoro neural server unreachable — falling back to browser SpeechSynthesis voice');
    }

    console.warn('[TTS] ⚠️ Kokoro unavailable — playing via browser SpeechSynthesis');
    reportTtsRum({
      outcome: 'ok',
      path: 'browser',
      voicePreset,
      durationMs: typeof performance !== 'undefined' ? performance.now() - rumStart : 0,
    });
    return speakBrowserFallback(request, currentEpoch);
  }, [cleanupTtsAnalyzer, playAudioBlob, speakBrowserFallback]);

  /** RMS → orb level while gapless sources are alive. */
  const startGaplessVu = useCallback((ctx: AudioContext, analyser: AnalyserNode) => {
    if (gaplessVuRafRef.current != null) return;
    const data = new Uint8Array(analyser.fftSize);
    let lastSet = 0;
    const tick = () => {
      if (gaplessSourcesRef.current.size === 0) {
        gaplessVuRafRef.current = null;
        setTtsOutputLevel(0);
        return;
      }
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const level = Math.min(1, rms * 6.2);
      ttsVuEnvelopeRef.current = stepVuEnvelope(level, ttsVuEnvelopeRef.current);
      const now = performance.now();
      if (now - lastSet > 52) {
        lastSet = now;
        setTtsOutputLevel(ttsVuEnvelopeRef.current);
      }
      gaplessVuRafRef.current = requestAnimationFrame(tick);
    };
    gaplessVuRafRef.current = requestAnimationFrame(tick);
    void ctx;
  }, []);

  /** Flip to idle only when queue drained AND every scheduled source ended. */
  const finalizeStreamSpeech = useCallback(() => {
    if (isDrainingStreamRef.current) return;
    if (streamSentenceQueueRef.current.length > 0) return;
    if (gaplessSourcesRef.current.size > 0) return;
    lastSpeechEndTimeRef.current = Date.now();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    setState(prev => ({ ...prev, status: 'idle' }));
    onStatusChangeRef.current?.('idle');
  }, []);

  /** Shared gapless AudioContext + analyser for stream/blob scheduling. */
  const ensureGaplessGraph = useCallback(async (): Promise<{ ctx: AudioContext; analyser: AnalyserNode } | null> => {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      let ctx = gaplessCtxRef.current;
      if (!ctx || ctx.state === 'closed') {
        ctx = new AC();
        gaplessCtxRef.current = ctx;
      }
      await ctx.resume().catch(() => {});
      // Suspended/interrupted contexts never advance currentTime — scheduled
      // sources would never fire onended and isSpeaking would stick true
      // forever, deadlocking the whole turn queue. Fall back to <audio>.
      if (ctx.state !== 'running') return null;

      let analyser = gaplessAnalyserRef.current;
      if (!analyser || analyser.context !== ctx) {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.93;
        analyser.connect(ctx.destination);
        gaplessAnalyserRef.current = analyser;
      }
      startGaplessVu(ctx, analyser);
      return { ctx, analyser };
    } catch {
      return null;
    }
  }, [startGaplessVu]);

  /** Decode + schedule one blob gaplessly. Resolves after scheduling (not
   *  after playback) so the drain loop can run ahead — true gapless. */
  const scheduleStreamBlob = useCallback(async (blob: Blob): Promise<boolean> => {
    try {
      const graph = await ensureGaplessGraph();
      if (!graph) return false;
      const { ctx, analyser } = graph;

      const audioBuf = await ctx.decodeAudioData(await blob.arrayBuffer());
      if (!audioBuf.duration) return false;

      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(analyser);
      const when = Math.max(ctx.currentTime + 0.03, gaplessNextStartRef.current);
      src.start(when);
      // 72ms tail trim — same as the landing player, kills inter-chunk echo.
      // Floor at 20ms advance so a sub-72ms buffer can't schedule backwards.
      gaplessNextStartRef.current = when + Math.max(0.02, audioBuf.duration - 0.072);
      gaplessSourcesRef.current.add(src);
      src.onended = () => {
        gaplessSourcesRef.current.delete(src);
        if (gaplessSourcesRef.current.size === 0) setTtsOutputLevel(0);
        finalizeStreamSpeech();
      };
      return true;
    } catch {
      return false;
    }
  }, [finalizeStreamSpeech, ensureGaplessGraph]);

  /** Open the proxy TTS stream for one sentence. Resolves to a PcmQueue fed
   *  by the WAV pump, or null when the proxy can't stream (caller falls back
   *  to the buffered blob path). The pump holds a prefetch slot until the
   *  stream ends so concurrent synthesis stays capped. */
  const startStreamFetch = useCallback((item: StreamSentenceItem): Promise<PcmQueue | null> => {
    if (item.streamPromise) return item.streamPromise;
    item.streamPromise = (async () => {
      streamFetchesActiveRef.current += 1;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        streamFetchesActiveRef.current = Math.max(0, streamFetchesActiveRef.current - 1);
      };
      try {
        const res = await fetch('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: item.text, voice: item.voice || 'cortana', speed: item.speed || 1.0 }),
          signal: streamTtsAbortRef.current?.signal,
        });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !res.body || !ct.includes('audio')) {
          release();
          return null;
        }
        const queue = new PcmQueue();
        void pumpWavToPcm(res.body, queue, streamTtsAbortRef.current?.signal)
          .catch(() => queue.fail(new Error('pcm pump failed')))
          .finally(release);
        return queue;
      } catch {
        release();
        return null;
      }
    })();
    return item.streamPromise;
  }, []);

  /** Consume a PcmQueue: each arriving Float32 chunk becomes an AudioBuffer
   *  scheduled on the shared gapless timeline. Resolves true once at least
   *  one buffer was scheduled — first audio lands ~300ms into synthesis. */
  const schedulePcmQueue = useCallback(async (queue: PcmQueue, epoch: number): Promise<boolean> => {
    const graph = await ensureGaplessGraph();
    if (!graph) return false;
    const { ctx, analyser } = graph;
    let scheduled = 0;
    try {
      for await (const chunk of queue.iterate()) {
        if (streamEpochRef.current !== epoch) return scheduled > 0;
        const audioBuf = ctx.createBuffer(1, chunk.samples.length, chunk.sampleRate);
        audioBuf.getChannelData(0).set(chunk.samples);
        const src = ctx.createBufferSource();
        src.buffer = audioBuf;
        src.connect(analyser);
        const when = Math.max(ctx.currentTime + 0.03, gaplessNextStartRef.current);
        src.start(when);
        gaplessNextStartRef.current = when + Math.max(0.02, audioBuf.duration - 0.072);
        gaplessSourcesRef.current.add(src);
        src.onended = () => {
          gaplessSourcesRef.current.delete(src);
          if (gaplessSourcesRef.current.size === 0) setTtsOutputLevel(0);
          finalizeStreamSpeech();
        };
        scheduled += 1;
      }
      return scheduled > 0;
    } catch {
      return scheduled > 0;
    }
  }, [ensureGaplessGraph, finalizeStreamSpeech]);

  /** Start synthesis for queued sentences while fewer than
   *  TTS_PREFETCH_AHEAD requests are in flight — keeps audio buffered
   *  ahead of playback without flooding the TTS server. */
  const prefetchStreamTts = useCallback(() => {
    for (const item of streamSentenceQueueRef.current) {
      if (streamFetchesActiveRef.current >= TTS_PREFETCH_AHEAD) break;
      if (item.fetchPromise || item.streamPromise) continue;
      // Prefer the streaming path — the WAV pump buffers PCM client-side so
      // playback starts on the first frames, not the full utterance. On
      // stream-open failure the item lazily falls back to blob prefetch.
      void startStreamFetch(item).then((queue) => {
        if (!queue && !item.fetchPromise) {
          item.fetchPromise = item.startFetch();
        }
      });
    }
  }, [startStreamFetch]);

  const drainStreamQueue = useCallback(async () => {
    if (isDrainingStreamRef.current) return;
    isDrainingStreamRef.current = true;
    const currentEpoch = streamEpochRef.current;

    while (streamSentenceQueueRef.current.length > 0) {
      if (streamEpochRef.current !== currentEpoch) break;
      const item = streamSentenceQueueRef.current.shift()!;
      activeSpokenTextRef.current = item.text;
      prefetchStreamTts();

      // Streaming path: the proxy pipes pocket-tts's chunked WAV straight
      // through, so PCM frames schedule on the gapless timeline as they are
      // generated — first audio ~300ms into synthesis, not after it.
      if (!item.streamPromise && !item.fetchPromise) {
        void startStreamFetch(item);
      }
      const streamQueue = item.streamPromise
        ? await item.streamPromise.catch(() => null)
        : null;
      let streamed = false;
      if (streamQueue) {
        streamed = await schedulePcmQueue(streamQueue, currentEpoch);
      }
      if (streamed) continue;
      if (streamEpochRef.current !== currentEpoch) break;

      let blob: Blob | null = null;
      try {
        blob = await (item.fetchPromise ?? (item.fetchPromise = item.startFetch()));
      } catch (err) {
        console.warn('[Streaming TTS] Fetch failed for chunk:', err);
      }

      if (streamEpochRef.current !== currentEpoch) break;

      if (blob && blob.size > 100) {
        try {
          const { getCortexObservabilityHUD } = await import('../lib/cortex-observability-hud');
          getCortexObservabilityHUD().recordVoiceLatency(Date.now() - item.queuedAt);
        } catch {}
        const scheduled = await scheduleStreamBlob(blob);
        if (!scheduled) {
          // No WebAudio — fall back to per-blob <audio> playback (slightly
          // gappy but still speaks).
          const hasMore = streamSentenceQueueRef.current.length > 0 || !item.isFinal;
          await playAudioBlob(blob, hasMore);
        }
      } else if (item.isFinal || streamSentenceQueueRef.current.length === 0) {
        // Neural TTS produced nothing — never leave Cortex mute. Browser
        // SpeechSynthesis is robotic but honest audio beats silence.
        // Kill any gapless neural sources first: otherwise the browser voice
        // talks over still-playing neural audio = two voices at once.
        for (const src of gaplessSourcesRef.current) {
          gaplessSourcesRef.current.delete(src);
          try { src.stop(); } catch {}
        }
        gaplessNextStartRef.current = 0;
        setTtsOutputLevel(0);
        try {
          await speakBrowserFallback(
            { text: item.text, config: { voice: item.voice, speed: item.speed } },
            speechEpochRef.current,
          );
        } catch {}
      }
    }

    isDrainingStreamRef.current = false;
    finalizeStreamSpeech();
  }, [playAudioBlob, scheduleStreamBlob, schedulePcmQueue, speakBrowserFallback, finalizeStreamSpeech, prefetchStreamTts, startStreamFetch]);

  /** Progressive streaming sentence playback: queues sentence chunks and starts playing in sub-600ms */
  const speakStreamSentence = useCallback((sentence: string, isFinal = false, config?: { voice?: string; speed?: number; skipCartesia?: boolean }) => {
    if (!sentence?.trim()) return;
    const clean = sentence.trim();
    const voicePreset = config?.voice || ttsVoice || 'cortana';
    const speed = config?.speed || ttsRate || 1.0;

    // Mutex check: if idle or starting new stream
    if (!isSpeakingRef.current) {
      streamEpochRef.current += 1;
      streamSentenceQueueRef.current = [];
      streamTtsAbortRef.current = new AbortController();
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      setState(prev => ({ ...prev, status: 'speaking' }));
      onStatusChangeRef.current?.('speaking');
    }

    // Neural chain: /api/ai/tts proxy (Kokoro → Pocket TTS) → direct Kokoro
    // origins → voice fallbacks (cortana→natural→nexus→professional).
    // Prosody speed varies by sentence kind (question/exclaim/statement).
    // Null result → drainStreamQueue falls back to browser SpeechSynthesis,
    // so Cortex never goes mute on a full neural outage.
    // Fetch is lazy (startFetch) — prefetchStreamTts caps concurrency.
    const seg = sentenceToNexusProsodySegment(clean);
    const item: StreamSentenceItem = {
      id: Date.now(),
      text: clean,
      isFinal,
      queuedAt: Date.now(),
      voice: voicePreset,
      speed,
      startFetch: () => {
        streamFetchesActiveRef.current += 1;
        return fetchKokoroBufferForNexusSegment(
          { ...seg, voice: voicePreset },
          streamTtsAbortRef.current?.signal,
        )
          .then((buf) => (buf && buf.byteLength > 100 ? new Blob([buf], { type: 'audio/wav' }) : null))
          .catch(() => null)
          .finally(() => {
            streamFetchesActiveRef.current = Math.max(0, streamFetchesActiveRef.current - 1);
          });
      },
    };

    streamSentenceQueueRef.current.push(item);
    prefetchStreamTts();
    void drainStreamQueue();
  }, [drainStreamQueue, prefetchStreamTts, ttsVoice, ttsRate]);

  const finishStreaming = useCallback(() => {
    if (streamSentenceQueueRef.current.length === 0 && !isDrainingStreamRef.current) {
      lastSpeechEndTimeRef.current = Date.now();
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      setState(prev => ({ ...prev, status: 'idle' }));
      onStatusChangeRef.current?.('idle');
    } else if (streamSentenceQueueRef.current.length > 0) {
      streamSentenceQueueRef.current[streamSentenceQueueRef.current.length - 1].isFinal = true;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    speechEpochRef.current += 1;
    streamEpochRef.current += 1;
    streamSentenceQueueRef.current = [];
    isDrainingStreamRef.current = false;
    if (inFlightFetchAbortRef.current) {
      inFlightFetchAbortRef.current.abort();
      inFlightFetchAbortRef.current = null;
    }
    landingKokoroAbortRef.current?.abort();
    landingKokoroAbortRef.current = null;
    // Barge-in must also cancel queued sentence synthesis — otherwise
    // prefetch keeps burning TTS requests for audio nobody will hear.
    streamTtsAbortRef.current?.abort();
    streamTtsAbortRef.current = null;
    cleanupTtsAnalyzer();
    // Barge-in must also kill already-scheduled gapless buffers — otherwise
    // queued sentences keep playing after stopSpeaking returns.
    for (const src of gaplessSourcesRef.current) {
      try { src.stop(); } catch {}
      gaplessSourcesRef.current.delete(src);
    }
    gaplessNextStartRef.current = 0;
    setTtsOutputLevel(0);
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    activeSpokenTextRef.current = '';
    lastSpeechEndTimeRef.current = Date.now();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    currentUtteranceRef.current = null;
    if (state.status === 'speaking') {
      setState(prev => ({ ...prev, status: 'idle' }));
      onStatusChangeRef.current?.('idle');
    }
  }, [cleanupTtsAnalyzer, state.status]);

  // ==========================================================================
  // FULL CONVERSATION TURN
  // ==========================================================================

  const getFullTranscript = useCallback(() => {
    return (transcript + (interimText ? ' ' + interimText : '')).trim();
  }, [transcript, interimText]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimText('');
    setState(prev => ({ ...prev, interimTranscript: '' }));
  }, []);

  /** Clears live STT interim only — use after committing a final utterance so UI can show “thinking” without stale partial text. */
  const clearInterimTranscript = useCallback(() => {
    setInterimText('');
    setState(prev => ({ ...prev, interimTranscript: '' }));
  }, []);

  useEffect(() => {
    return () => {
      const ctx = ttsAudioCtxRef.current;
      ttsAudioCtxRef.current = null;
      const gctx = gaplessCtxRef.current;
      gaplessCtxRef.current = null;
      streamTtsAbortRef.current?.abort();
      if (gctx && gctx.state !== 'closed') {
        void gctx.close().catch(() => {});
      }
      if (!ctx) return;
      void (async () => {
        try {
          if (ctx.state !== 'closed') await ctx.close();
        } catch {
          /* InvalidStateError: already closed (Strict Mode / race) */
        }
      })().catch(() => {
        /* Some browsers reject close() promise if already closed */
      });
    };
  }, []);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // State
    state,
    status: state.status,
    isListening: state.status === 'listening',
    isSpeaking,
    /** 0–1 RMS envelope while Kokoro blob audio is playing (Web Audio). 0 for browser SpeechSynthesis fallback. */
    ttsOutputLevel,
    sttReady: state.sttReady,
    ttsReady: state.ttsReady,
    /** Smart-turn detector lifecycle: off | idle | loading | ready | unavailable. */
    turnDetectorState,
    
    // Transcript
    transcript,
    interimText,
    getFullTranscript,
    clearTranscript,
    clearInterimTranscript,

    // STT Controls
    startListening,
    stopListening,

    // TTS Controls
    speak,
    speakStreamSentence,
    /** One-shot utterance through the same gapless sentence queue — used by
     *  proactive voice announcements so they share the single TTS mutex
     *  instead of racing a parallel playback path. */
    speakText: (text: string) => {
      speakStreamSentence(text, true);
      finishStreaming();
    },
    finishStreaming,
    stopSpeaking,
    activeSpokenText: activeSpokenTextRef.current,
    availableVoices,

    // Emotion (placeholder for Phase 3)
    currentEmotion: state.currentEmotion,
  };
}
