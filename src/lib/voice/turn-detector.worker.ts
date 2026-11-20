/**
 * Smart-turn worker — pipecat-ai smart-turn v3.2 ONNX end-of-turn classifier.
 *
 * Runs entirely off the main thread so inference never janks the voice loop.
 * Input: 16kHz mono Float32 PCM pushed as transferable ring frames; the last
 * ≤8s window is scored on demand. Output: turn-end probability in [0,1]
 * (sigmoid applied here so both logit and probability graph outputs work).
 *
 * Model + whisper feature extractor load lazily on 'init'. Model bytes come
 * from the HuggingFace CDN with Cache API persistence, falling back to the
 * same-origin /models/ copy. Everything fails soft — a null probability just
 * means "no verdict", never a voice outage.
 */

const SAMPLE_RATE = 16000;
const WINDOW_SECONDS = 8;
const WINDOW_SAMPLES = SAMPLE_RATE * WINDOW_SECONDS;
const MODEL_URLS = [
  'https://huggingface.co/pipecat-ai/smart-turn-v3/resolve/main/smart-turn-v3.2-cpu.onnx',
  '/models/smart-turn-v3.2-cpu.onnx',
];
const CACHE_NAME = 'cortex-smart-turn-v1';

let ort: any = null;
let session: any = null;
let extractor: any = null;
let buf = new Float32Array(WINDOW_SAMPLES);
let writeIdx = 0;
let filled = 0;
let scoring = false;

const post = (msg: Record<string, unknown>) =>
  (self as unknown as Worker).postMessage(msg);

async function fetchModel(): Promise<ArrayBuffer> {
  let cache: Cache | null = null;
  try { cache = await caches.open(CACHE_NAME); } catch { /* Cache API unavailable */ }
  for (const url of MODEL_URLS) {
    try {
      const hit = cache ? await cache.match(url) : null;
      if (hit) return await hit.arrayBuffer();
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.arrayBuffer();
      if (data.byteLength < 1000) continue;
      if (cache) {
        try {
          await cache.put(url, new Response(data.slice(0), {
            headers: { 'Content-Type': 'application/octet-stream' },
          }));
        } catch { /* cache write is best-effort */ }
      }
      return data;
    } catch { /* try next source */ }
  }
  throw new Error('smart-turn model unavailable');
}

async function init(): Promise<void> {
  ort = await import('onnxruntime-web');
  const tf = await import('@huggingface/transformers');
  const model = await fetchModel();
  session = await ort.InferenceSession.create(model, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  // Whisper config matching smart-turn's reference feature extractor —
  // downloads a small preprocessor JSON from HF hub once, then caches.
  extractor = await tf.WhisperFeatureExtractor.from_pretrained('openai/whisper-tiny');
}

function push(samples: Float32Array): void {
  for (let i = 0; i < samples.length; i++) {
    buf[writeIdx] = samples[i];
    writeIdx = (writeIdx + 1) % WINDOW_SAMPLES;
    if (filled < WINDOW_SAMPLES) filled++;
  }
}

function ordered(): Float32Array {
  const out = new Float32Array(WINDOW_SAMPLES);
  if (filled < WINDOW_SAMPLES) {
    const start = (writeIdx - filled + WINDOW_SAMPLES) % WINDOW_SAMPLES;
    for (let i = 0; i < filled; i++) out[i] = buf[(start + i) % WINDOW_SAMPLES];
    return out;
  }
  for (let i = 0; i < WINDOW_SAMPLES; i++) out[i] = buf[(writeIdx + i) % WINDOW_SAMPLES];
  return out;
}

async function score(): Promise<number | null> {
  if (!session || !extractor || scoring) return null;
  scoring = true;
  try {
    const audio = ordered();
    // Whisper hop = 160 samples @16kHz → 100 fps → 8s window = 800 frames.
    const feats = await extractor._call(audio, { max_length: WINDOW_SAMPLES / 160 });
    const inputFeatures = feats.input_features;
    const feeds = {
      input_features: new ort.Tensor('float32', inputFeatures.data, inputFeatures.dims),
    };
    const out = await session.run(feeds);
    const raw = Number((out[Object.keys(out)[0]].data as Float32Array)[0]);
    if (!Number.isFinite(raw)) return null;
    // Model card output is a probability; accept a raw logit too.
    return raw >= 0 && raw <= 1 ? raw : 1 / (1 + Math.exp(-raw));
  } catch {
    return null;
  } finally {
    scoring = false;
  }
}

self.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as {
    type?: string;
    id?: number;
    samples?: Float32Array | ArrayLike<number>;
  } | null;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'init') {
    void init()
      .then(() => post({ type: 'ready' }))
      .catch((err) => post({ type: 'error', message: String(err) }));
  } else if (msg.type === 'pcm' && msg.samples) {
    push(msg.samples instanceof Float32Array ? msg.samples : new Float32Array(msg.samples));
  } else if (msg.type === 'score') {
    void score().then((probability) => post({ type: 'score', id: msg.id, probability }));
  } else if (msg.type === 'reset') {
    buf = new Float32Array(WINDOW_SAMPLES);
    writeIdx = 0;
    filled = 0;
  }
});
