/**
 * Fetch Kokoro audio for one prosody segment — **same strategy as landing**:
 * try voice id fallbacks (cortana → natural → nexus → professional), then optional direct Kokoro.
 */
import { disableTtsProxyForSession, isTtsProxyDisabled } from './tts-proxy-session';
import type { NexusProsodySegment } from './nexus-tts-prosody';
import { nexusKokoroVoiceCandidates, NEXUS_EMOTION_TTS_VOICES } from './nexus-tts-prosody';

const TTS_REQUEST_TIMEOUT_MS = 24_000;
const TTS_MAX_RETRIES = 1;
const TTS_RETRY_BACKOFF_MS = 450;

// Sticky served-voice: the proxy tags each response with X-TTS-Voice (the
// voice id that ACTUALLY produced the audio — e.g. 'af_sky' when Pocket
// clone timed out and Kokoro served the 'cortana' request). Pinning that id
// for ~90s keeps a multi-sentence reply on ONE voice and routes follow-up
// sentences straight to the working engine instead of re-rolling the whole
// candidate chain per sentence (the mid-reply voice-switch bug).
const STICKY_VOICE_MS = 90_000;
let stickyTtsVoice: string | null = null;
let stickyTtsVoiceUntil = 0;

function pinServedVoice(voiceId: string | null | undefined) {
  if (voiceId && /^[a-z]{2}_[a-z]+$|^cortana/.test(voiceId)) {
    stickyTtsVoice = voiceId;
    stickyTtsVoiceUntil = Date.now() + STICKY_VOICE_MS;
  } else {
    stickyTtsVoice = null;
    stickyTtsVoiceUntil = 0;
  }
}

function orderedVoiceCandidates(primary: string): string[] {
  const base = nexusKokoroVoiceCandidates(primary);
  if (!stickyTtsVoice || Date.now() >= stickyTtsVoiceUntil) return base;
  // Emotion personas are per-utterance choices — never let a pinned
  // emotional voice leak into a normal request (or vice versa).
  if (NEXUS_EMOTION_TTS_VOICES.has(stickyTtsVoice) !== NEXUS_EMOTION_TTS_VOICES.has(primary)) return base;
  return [stickyTtsVoice, ...base.filter((v) => v !== stickyTtsVoice)];
}

function isTransientTTSStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isVoiceOrClientError(status: number): boolean {
  return status === 400 || status === 404 || status === 422;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const KOKORO_TTS_URL = (import.meta.env.VITE_KOKORO_TTS_URL || '').trim().replace(/\/$/, '');
const allowClientDirectKokoro =
  import.meta.env.DEV || import.meta.env.VITE_ALLOW_CLIENT_DIRECT_KOKORO === 'true';

let serverKokoroOrigin: string | null = null;
let serverKokoroFallbackOrigin: string | null = null;
let serverKokoroOriginPromise: Promise<void> | null = null;

/** Load primary + fallback Kokoro bases from GET /api/ai/tts (matches Vercel proxy chain). */
export function ensureKokoroOriginsLoaded(): Promise<void> {
  if (serverKokoroOriginPromise) return serverKokoroOriginPromise;
  serverKokoroOriginPromise = (async () => {
    try {
      const r = await fetch('/api/ai/tts', { method: 'GET' });
      if (!r.ok) return;
      const j = (await r.json()) as {
        kokoroDirectOrigin?: string | null;
        kokoroFallbackDirectOrigin?: string | null;
      };
      if (typeof j.kokoroDirectOrigin === 'string' && j.kokoroDirectOrigin.trim()) {
        serverKokoroOrigin = j.kokoroDirectOrigin.trim().replace(/\/$/, '');
      }
      if (typeof j.kokoroFallbackDirectOrigin === 'string' && j.kokoroFallbackDirectOrigin.trim()) {
        serverKokoroFallbackOrigin = j.kokoroFallbackDirectOrigin.trim().replace(/\/$/, '');
      }
    } catch {
      /* keep null */
    }
  })();
  return serverKokoroOriginPromise;
}

/** Unique ordered list: API primary → API fallback → VITE (dev). */
export function getKokoroDirectBases(): string[] {
  const env = KOKORO_TTS_URL.trim().replace(/\/$/, '');
  const raw = [serverKokoroOrigin, serverKokoroFallbackOrigin, env].filter(Boolean) as string[];
  return [...new Set(raw.map((s) => s.trim().replace(/\/$/, '')))];
}

function mayCallKokoroDirectly(): boolean {
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_ALLOW_CLIENT_DIRECT_KOKORO === 'true' && KOKORO_TTS_URL) return true;
  if (serverKokoroOrigin || serverKokoroFallbackOrigin) return true;
  return false;
}

async function fetchDirectKokoroBuffer(
  seg: NexusProsodySegment,
  voice: string,
  signal: AbortSignal | undefined,
): Promise<ArrayBuffer | null> {
  if (!mayCallKokoroDirectly()) return null;
  const bases = getKokoroDirectBases();
  if (!bases.length) return null;

  for (const base of bases) {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), TTS_REQUEST_TIMEOUT_MS);
    const onAbort = () => timeoutController.abort();
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    try {
      const res = await fetch(`${base}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'kokoro-onnx',
          input: seg.text,
          voice: voice === 'cortana' ? 'af_sky' : voice,
          speed: seg.speed,
        }),
        signal: timeoutController.signal,
      });
      if (!res.ok) continue;
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > 0) {
        // Direct path bypasses the proxy — pin the voice id actually sent
        // (cortana maps to af_sky here) so the next segment stays consistent.
        pinServedVoice(voice === 'cortana' ? 'af_sky' : voice);
        lastTtsMeta = { engine: 'kokoro-direct', voice: voice === 'cortana' ? 'af_sky' : voice, via: 'direct' };
        return buffer;
      }
    } catch {
      /* try next base */
    } finally {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }
  return null;
}

// Last proxy/direct response metadata — the drain loop reads this to log
// which engine+voice actually produced each spoken sentence.
export interface TtsResponseMeta { engine: string | null; voice: string | null; via: 'proxy' | 'direct' | null }
let lastTtsMeta: TtsResponseMeta = { engine: null, voice: null, via: null };
export function getLastTtsMeta(): TtsResponseMeta { return lastTtsMeta; }

/**
 * One segment, landing-style voice fallbacks + proxy retries + optional direct Kokoro.
 */
export async function fetchKokoroBufferForNexusSegment(
  seg: NexusProsodySegment,
  signal?: AbortSignal,
): Promise<ArrayBuffer | null> {
  await ensureKokoroOriginsLoaded();
  const voices = orderedVoiceCandidates(seg.voice);

  for (const voice of voices) {
    const canTryProxy = !isTtsProxyDisabled();

    if (canTryProxy) {
      for (let attempt = 0; attempt <= TTS_MAX_RETRIES; attempt += 1) {
        if (signal?.aborted) return null;
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), TTS_REQUEST_TIMEOUT_MS);
        const onAbort = () => timeoutController.abort();
        if (signal) signal.addEventListener('abort', onAbort, { once: true });
        try {
          const response = await fetch('/api/ai/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: seg.text, voice, speed: seg.speed }),
            signal: timeoutController.signal,
          });
          if (response.ok) {
            const servedVoice = response.headers.get('x-tts-voice');
            const buffer = await response.arrayBuffer();
            if (buffer.byteLength > 0) {
              pinServedVoice(servedVoice);
              lastTtsMeta = {
                engine: response.headers.get('x-tts-engine'),
                voice: servedVoice || voice,
                via: 'proxy',
              };
              return buffer;
            }
            break;
          }
          const errData = (await response.json().catch(() => ({}))) as { code?: string };
          if (errData.code === 'NO_TTS_URL' || errData.code === 'UNREACHABLE') {
            disableTtsProxyForSession();
            break;
          }
          if (isVoiceOrClientError(response.status)) {
            break;
          }
          if (!isTransientTTSStatus(response.status) || attempt >= TTS_MAX_RETRIES) {
            break;
          }
        } catch {
          if (signal?.aborted) return null;
          if (attempt >= TTS_MAX_RETRIES) break;
        } finally {
          clearTimeout(timeoutId);
          if (signal) signal.removeEventListener('abort', onAbort);
        }
        await delay(TTS_RETRY_BACKOFF_MS * (attempt + 1));
      }
    }

    const direct = await fetchDirectKokoroBuffer({ ...seg, voice }, voice, signal);
    if (direct) return direct;
  }

  return null;
}
