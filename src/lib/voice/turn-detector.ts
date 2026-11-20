/**
 * Smart-turn detector — semantic end-of-turn via pipecat-ai smart-turn v3.2
 * ONNX, running inside a dedicated worker (turn-detector.worker.ts).
 *
 * The worker scores the last ≤8s of 16kHz mono PCM for "is the speaker
 * finished?" — prosody + grammar, so a mid-thought pause scores LOW (keep
 * listening) while a completed clause scores HIGH (commit the turn early,
 * before the fixed 850ms finish window).
 *
 * Everything is lazy + best-effort: preload() fetches the model from the
 * HuggingFace CDN (Cache API persisted) only when voice actually starts.
 * smartTurnSupported() returns false — making the detector a zero-overhead
 * no-op — when localStorage.cortexSmartTurn === 'off', WebAssembly is
 * missing, or neither WebGPU nor cross-origin isolation (threaded WASM) is
 * available. Callers must always keep the timer fallback.
 */

export type SmartTurnDetectorState = 'off' | 'idle' | 'loading' | 'ready' | 'unavailable';

/** Turn-end commit threshold — biased slightly conservative so borderline
 *  cases keep listening rather than cut the user off mid-thought. */
export const SMART_TURN_COMMIT_THRESHOLD = 0.6;

const SCORE_TIMEOUT_MS = 1500;
const BOOT_TIMEOUT_MS = 30000;

export function smartTurnFlagOff(): boolean {
  try { return localStorage.getItem('cortexSmartTurn') === 'off'; } catch { return false; }
}

export function smartTurnSupported(): boolean {
  if (typeof window === 'undefined' || smartTurnFlagOff()) return false;
  if (typeof WebAssembly === 'undefined') return false;
  const hasGpu = 'gpu' in navigator;
  const isolated = typeof window.crossOriginIsolated === 'boolean' && window.crossOriginIsolated;
  return hasGpu || isolated;
}

export class SmartTurnDetector {
  state: SmartTurnDetectorState = 'idle';
  /** Fired after every completed score with the turn-end probability —
   *  the caller applies SMART_TURN_COMMIT_THRESHOLD (or its own). */
  onTurnEnd: ((probability: number) => void) | null = null;
  onStateChange: ((state: SmartTurnDetectorState) => void) | null = null;

  private worker: Worker | null = null;
  private boot: Promise<boolean> | null = null;
  private scoreSeq = 0;
  private pending = new Map<number, {
    resolve: (p: number | null) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  private setState(s: SmartTurnDetectorState): void {
    if (this.state === s) return;
    this.state = s;
    this.onStateChange?.(s);
  }

  /** Spawn the worker and load model + feature extractor. Idempotent. */
  preload(): Promise<boolean> {
    if (!smartTurnSupported()) {
      this.setState(smartTurnFlagOff() ? 'off' : 'unavailable');
      return Promise.resolve(false);
    }
    if (this.boot) return this.boot;
    this.setState('loading');
    this.boot = new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (!settled) { settled = true; resolve(ok); }
      };
      try {
        this.worker = new Worker(new URL('./turn-detector.worker.ts', import.meta.url), { type: 'module' });
      } catch {
        this.setState('unavailable');
        done(false);
        return;
      }
      const w = this.worker;
      const bootTimer = setTimeout(() => {
        this.setState('unavailable');
        done(false);
      }, BOOT_TIMEOUT_MS);
      w.onmessage = (event: MessageEvent) => {
        const msg = event.data as {
          type?: string;
          id?: number;
          probability?: number | null;
        } | null;
        if (!msg) return;
        if (msg.type === 'ready') {
          clearTimeout(bootTimer);
          this.setState('ready');
          done(true);
        } else if (msg.type === 'error') {
          clearTimeout(bootTimer);
          this.setState('unavailable');
          done(false);
        } else if (msg.type === 'score') {
          const id = typeof msg.id === 'number' ? msg.id : -1;
          const p = this.pending.get(id);
          if (p) {
            this.pending.delete(id);
            clearTimeout(p.timer);
            p.resolve(typeof msg.probability === 'number' ? msg.probability : null);
          }
          if (typeof msg.probability === 'number') this.onTurnEnd?.(msg.probability);
        }
      };
      w.onerror = () => {
        clearTimeout(bootTimer);
        this.setState('unavailable');
        done(false);
      };
      w.postMessage({ type: 'init' });
    });
    return this.boot;
  }

  /** Feed 16kHz mono PCM (same frames the VAD consumes). Transferable —
   *  the caller must not reuse the buffer. */
  pushAudio(samples: Float32Array): void {
    const w = this.worker;
    if (!w || this.state === 'off' || this.state === 'unavailable' || this.state === 'idle') return;
    try {
      const buf = samples.byteOffset === 0 && samples.byteLength === samples.buffer.byteLength
        ? samples.buffer as ArrayBuffer
        : samples.slice().buffer as ArrayBuffer;
      w.postMessage({ type: 'pcm', samples }, [buf]);
    } catch { /* audio feed is best-effort */ }
  }

  /** Score the buffered audio window. Null = no verdict (not ready, busy,
   *  timeout, or inference error) — callers fall back to the timer path. */
  score(): Promise<number | null> {
    const w = this.worker;
    if (!w || this.state !== 'ready') return Promise.resolve(null);
    const id = ++this.scoreSeq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve(null);
      }, SCORE_TIMEOUT_MS);
      this.pending.set(id, { resolve, timer });
      try {
        w.postMessage({ type: 'score', id });
      } catch {
        this.pending.delete(id);
        clearTimeout(timer);
        resolve(null);
      }
    });
  }

  reset(): void {
    try { this.worker?.postMessage({ type: 'reset' }); } catch { /* best-effort */ }
  }

  dispose(): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.resolve(null);
    }
    this.pending.clear();
    try { this.worker?.terminate(); } catch { /* best-effort */ }
    this.worker = null;
    this.boot = null;
    this.setState('idle');
  }
}

let shared: SmartTurnDetector | null = null;

/** Session singleton — the model stays warm across listen sessions. */
export function getSmartTurnDetector(): SmartTurnDetector | null {
  if (!smartTurnSupported()) return null;
  if (!shared) shared = new SmartTurnDetector();
  return shared;
}
