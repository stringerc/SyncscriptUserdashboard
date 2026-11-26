/**
 * holo-hand.worker.ts — Off-main-thread neural 21-landmark hand & gesture
 * tracker powered by @mediapipe/tasks-vision (GestureRecognizer).
 *
 * Pre-loads vision_wasm_module_internal.js via Blob ES module import so it
 * works cleanly inside Vite dev/prod module Web Workers without importScripts
 * or Vite /public import errors.
 */

import { GestureRecognizer } from '@mediapipe/tasks-vision';

let recognizer: GestureRecognizer | null = null;
let initPromise: Promise<void> | null = null;
let busy = false;

interface InitMessage {
  type: 'init';
  wasmPath?: string;
  modelPath?: string;
}

interface FrameMessage {
  type: 'frame';
  timestamp: number;
  frame: ImageBitmap;
}

type WorkerInbound = InitMessage | FrameMessage;

const DEFAULT_WASM = '/mediapipe/tasks-vision/wasm';
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm';
const DEFAULT_MODEL = '/mediapipe/models/gesture_recognizer.task';
const CDN_MODEL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

async function assetExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function loadVisionModuleWasm(baseDir: string): Promise<{
  wasmLoaderPath: string;
  wasmBinaryPath: string;
}> {
  const origin = self.location?.origin || '';
  const absBase = baseDir.startsWith('http') ? baseDir : `${origin}${baseDir}`;
  const loaderUrl = `${absBase}/vision_wasm_module_internal.js`;
  const binaryUrl = `${absBase}/vision_wasm_module_internal.wasm`;

  if (typeof (self as any).ModuleFactory !== 'function') {
    const res = await fetch(loaderUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${loaderUrl}: ${res.status}`);
    }
    const code = await res.text();
    const blob = new Blob([code], { type: 'text/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    try {
      const mod: any = await import(/* @vite-ignore */ blobUrl);
      if (!(self as any).ModuleFactory && typeof mod?.default === 'function') {
        (self as any).ModuleFactory = mod.default;
      }
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }

  return {
    wasmLoaderPath: '',
    wasmBinaryPath: binaryUrl,
  };
}

async function initRecognizer(wasmPath?: string, modelPath?: string): Promise<void> {
  if (recognizer) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const origin = self.location?.origin || '';
    const resolvedWasm =
      wasmPath ||
      ((await assetExists(`${DEFAULT_WASM}/vision_wasm_module_internal.js`))
        ? DEFAULT_WASM
        : CDN_WASM);
    const rawModel =
      modelPath || ((await assetExists(DEFAULT_MODEL)) ? DEFAULT_MODEL : CDN_MODEL);
    const resolvedModel = rawModel.startsWith('http') ? rawModel : `${origin}${rawModel}`;

    const vision = await loadVisionModuleWasm(resolvedWasm);

    // Run SIMD WASM CPU inference off-main-thread so it initializes
    // deterministically (~2.5s) and never contends with Three.js WebGL2 on GPU.
    recognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: resolvedModel,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
    self.postMessage({ type: 'ready', delegate: 'CPU' });
  })();

  return initPromise;
}

self.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data;

  if (msg.type === 'init') {
    try {
      await initRecognizer(msg.wasmPath, msg.modelPath);
    } catch (err: any) {
      self.postMessage({ type: 'error', message: err?.message || 'MediaPipe init failed' });
    }
    return;
  }

  if (msg.type === 'frame') {
    const bitmap = msg.frame;
    if (!recognizer || busy) {
      try { bitmap.close(); } catch {}
      return;
    }

    busy = true;
    try {
      const result = recognizer.recognizeForVideo(bitmap, msg.timestamp);
      self.postMessage({
        type: 'result',
        timestamp: msg.timestamp,
        landmarks: result.landmarks ?? [],
        worldLandmarks: result.worldLandmarks ?? [],
        handedness: (result.handedness ?? []).map((h) => h[0]?.categoryName ?? 'Unknown'),
        gestures: (result.gestures ?? []).map((g) => ({
          name: g[0]?.categoryName ?? 'None',
          score: g[0]?.score ?? 0,
        })),
      });
    } catch (err: any) {
      self.postMessage({ type: 'error', message: err?.message || 'Inference error' });
    } finally {
      try { bitmap.close(); } catch {}
      busy = false;
    }
  }
};
