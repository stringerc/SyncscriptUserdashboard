/**
 * Semantic End-of-Turn (EOU) — pipecat-ai smart-turn v3.2 ONNX in-browser.
 *
 * Replaces silence-duration heuristics with a neural model that scores the
 * last ≤8s of 16kHz PCM for "is the speaker finished?" — prosody + grammar,
 * so a mid-sentence thinking pause scores LOW (keep listening) while a
 * completed clause scores HIGH (commit the turn).
 *
 * Model: pipecat-ai/smart-turn-v3 (Apache-2.0), smart-turn-v3.2-cpu.onnx
 * served from /public/models/. Feature extraction via transformers.js
 * WhisperFeatureExtractor (same pipeline as the reference inference.py).
 *
 * Everything is lazy + best-effort: if the model or WASM fails to load the
 * caller falls back to the legacy timer path. Never blocks the voice loop.
 */

const MODEL_URL = '/models/smart-turn-v3.2-cpu.onnx';
const SAMPLE_RATE = 16000;
const WINDOW_SECONDS = 8;
const WINDOW_SAMPLES = SAMPLE_RATE * WINDOW_SECONDS;
/** Commit threshold — smart-turn's own default is 0.5; we bias slightly
 *  conservative so borderline cases keep listening rather than cut off. */
export const EOU_COMMIT_THRESHOLD = 0.55;

export interface EouResult {
  probability: number;
  commit: boolean;
  latencyMs: number;
}

interface EouEngine {
  push(samples: Float32Array): void;
  /** Score the buffered window. Returns null when the engine isn't ready. */
  score(): Promise<EouResult | null>;
  reset(): void;
}

let enginePromise: Promise<EouEngine | null> | null = null;

async function createEngine(): Promise<EouEngine | null> {
  if (typeof window === 'undefined') return null;
  try {
    const [ort, tf] = await Promise.all([
      import('onnxruntime-web'),
      import('@huggingface/transformers'),
    ]);
    // Local WASM served from public/vad/wasm — version-matched to the
    // installed onnxruntime-web, no CDN dependency.
    ort.env.wasm.wasmPaths = '/vad/wasm/';
    const session = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    // Whisper config matching smart-turn's reference feature extractor.
    // Downloads a small preprocessor JSON from HF hub once, then caches.
    const extractor = await tf.WhisperFeatureExtractor.from_pretrained('openai/whisper-tiny');

    // Ring buffer of the last WINDOW_SAMPLES at 16kHz.
    let buf = new Float32Array(WINDOW_SAMPLES);
    let writeIdx = 0;
    let filled = 0;

    const push = (samples: Float32Array) => {
      for (let i = 0; i < samples.length; i++) {
        buf[writeIdx] = samples[i];
        writeIdx = (writeIdx + 1) % WINDOW_SAMPLES;
        if (filled < WINDOW_SAMPLES) filled++;
      }
    };

    const ordered = (): Float32Array => {
      if (filled < WINDOW_SAMPLES) {
        // Return what we have, zero-padded at the front (model pads anyway).
        const out = new Float32Array(WINDOW_SAMPLES);
        // oldest→newest: buf holds last `filled` samples ending at writeIdx
        const start = (writeIdx - filled + WINDOW_SAMPLES) % WINDOW_SAMPLES;
        for (let i = 0; i < filled; i++) out[i] = buf[(start + i) % WINDOW_SAMPLES];
        return out;
      }
      const out = new Float32Array(WINDOW_SAMPLES);
      for (let i = 0; i < WINDOW_SAMPLES; i++) out[i] = buf[(writeIdx + i) % WINDOW_SAMPLES];
      return out;
    };

    const score = async (): Promise<EouResult | null> => {
      const t0 = performance.now();
      try {
        const audio = ordered();
        // Whisper hop = 160 samples @16kHz → 100 fps → 8s window = 800 frames.
        const feats = await (extractor as unknown as {
          _call(
            a: Float32Array,
            opts?: { max_length?: number },
          ): Promise<{ input_features: { dims: number[]; data: Float32Array } }>;
        })._call(audio, { max_length: WINDOW_SAMPLES / 160 });
        const inputFeatures = feats.input_features;
        const feeds = {
          input_features: new ort.Tensor('float32', inputFeatures.data, inputFeatures.dims),
        };
        const out = await session.run(feeds);
        const prob = (out[Object.keys(out)[0]].data as Float32Array)[0];
        return {
          probability: prob,
          commit: prob >= EOU_COMMIT_THRESHOLD,
          latencyMs: performance.now() - t0,
        };
      } catch {
        return null;
      }
    };

    return {
      push,
      score,
      reset: () => { buf = new Float32Array(WINDOW_SAMPLES); writeIdx = 0; filled = 0; },
    };
  } catch {
    return null;
  }
}

/** Lazily create the engine once; returns null if WASM/ONNX unavailable. */
export function getEouEngine(): Promise<EouEngine | null> {
  if (!enginePromise) enginePromise = createEngine();
  return enginePromise;
}

/** Feed audio from any MediaStream at native rate — resamples to 16kHz mono. */
export function createPcmFeeder(stream: MediaStream, onPcm?: (engine: EouEngine) => void): () => void {
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctx();
  const src = ctx.createMediaStreamSource(stream);
  // ScriptProcessor is deprecated but universally supported and simplest for
  // a fire-and-forget feeder; the audio graph stays tiny.
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  proc.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    const ratio = ctx.sampleRate / SAMPLE_RATE;
    const outLen = Math.floor(input.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      out[i] = input[Math.min(input.length - 1, Math.floor(i * ratio))];
    }
    void getEouEngine().then((eng) => {
      if (eng) { eng.push(out); onPcm?.(eng); }
    });
  };
  src.connect(proc);
  // ScriptProcessor must reach destination to fire, but mic audio must NOT
  // be audible — route through a zero-gain node or we get speaker feedback.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  proc.connect(mute);
  mute.connect(ctx.destination);
  return () => { try { proc.disconnect(); src.disconnect(); ctx.close(); } catch { /* best-effort */ } };
}
