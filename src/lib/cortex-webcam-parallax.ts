/**
 * cortex-webcam-parallax.ts
 *
 * Top 0.01% Neural Optical Head Tracking & Bimanual Spatial Hand Manipulation
 * for the Cortex "Holographic Window" and 3D Sovereign Core.
 *
 * Architecture:
 *  1. Off-Main-Thread MediaPipe GestureRecognizer Web Worker (GPU/CPU delegate)
 *     via zero-copy OffscreenCanvas + ImageBitmap transferables.
 *  2. 1€ (One Euro) Adaptive Velocity Low-Pass Filtering on all 21 3D landmarks
 *     per hand — zero hover jitter, zero fast-sweep lag.
 *  3. Palm-Normalized 3D Pinch + Schmitt Trigger Hysteresis + 75ms Pinch-Onset
 *     Position Lock (Vision Pro style) + Middle-Thumb Spatial Clutch.
 *  4. Bimanual 3D Control: Left-hand orbit / two-hand spread-to-zoom + Right-hand
 *     precision pointer & pinch-to-grab, plus automatic optical fallback.
 */

import { HandLandmarkSmoother, type Point3D } from './one-euro-filter';
import { neuroAudio } from './cortex-neuro-audio';

export interface HeadCoords {
  x: number; // [-1.0, 1.0] left to right
  y: number; // [-1.0, 1.0] down to up
  active: boolean;
}

export interface BimanualControlState {
  active: boolean;
  orbitDeltaX: number;
  orbitDeltaY: number;
  zoomDelta: number;
  handCount: number;
}

export interface HandPinchState {
  detected: boolean;
  x: number; // screen pixel X
  y: number; // screen pixel Y
  normX: number; // [0, 1]
  normY: number; // [0, 1]
  pinching: boolean;
  pinchDist: number; // palm-normalized pinch ratio
  clutching?: boolean;
  handedness?: 'Left' | 'Right' | 'Unknown';
  gesture?: string;
  landmarks?: Point3D[]; // 21 mirrored normalized [0..1] landmarks (primary hand)
  secondaryLandmarks?: Point3D[]; // 21 mirrored normalized [0..1] landmarks (2nd hand)
  bimanual?: BimanualControlState;
  engine?: 'mediapipe-gpu' | 'mediapipe-cpu' | 'optical-fallback';
  fps?: number;
}

type HeadListener = (coords: HeadCoords) => void;
type HandListener = (hand: HandPinchState) => void;

function dist3D(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.hypot(dx, dy, dz);
}

function mirrorLandmarks(pts: Point3D[]): Point3D[] {
  return pts.map((p) => ({ x: 1.0 - p.x, y: p.y, z: p.z ?? 0 }));
}

class CortexWebcamParallax {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private offscreen: OffscreenCanvas | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
  private rafId = 0;
  private running = false;

  private headListeners: Set<HeadListener> = new Set();
  private handListeners: Set<HandListener> = new Set();

  // Head parallax state
  private curX = 0;
  private curY = 0;
  private targetX = 0;
  private targetY = 0;
  private faceDetector: any = null;
  private lastHeadFrameAt = 0;

  // Worker & neural hand state
  private worker: Worker | null = null;
  private workerReady = false;
  private workerFailed = false;
  private engineMode: 'mediapipe-gpu' | 'mediapipe-cpu' | 'optical-fallback' = 'optical-fallback';
  private lastVideoTime = -1;
  private lastInferAt = 0;
  private smoothFps = 0;

  // 1€ smoothers per hand
  private primarySmoother = new HandLandmarkSmoother(21, 1.4, 0.055);
  private secondarySmoother = new HandLandmarkSmoother(21, 1.4, 0.055);

  // Hand gesture & hysteresis state
  private curHandX = 0.5;
  private curHandY = 0.5;
  private handDetected = false;
  private isPinching = false;
  private isClutching = false;
  private pinchRatio = 1.0;
  private pinchLockUntil = 0;
  private lockedNormX = 0.5;
  private lockedNormY = 0.5;

  // Bimanual 3D orbit/zoom tracking
  private prevOrbitAnchor: { x: number; y: number } | null = null;
  private prevTwoHandSpan: number | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        const FD = (window as any).FaceDetector;
        this.faceDetector = new FD({ fastMode: true, maxDetectedFaces: 1 });
      } catch {
        this.faceDetector = null;
      }
    }
  }

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia
    );
  }

  public isActive(): boolean {
    return this.running;
  }

  public subscribe(cb: HeadListener): () => void {
    this.headListeners.add(cb);
    return () => {
      this.headListeners.delete(cb);
    };
  }

  public subscribeHand(cb: HandListener): () => void {
    this.handListeners.add(cb);
    return () => {
      this.handListeners.delete(cb);
    };
  }

  private emitHead(coords: HeadCoords) {
    for (const cb of this.headListeners) {
      try { cb(coords); } catch {}
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cortex-holo-head', { detail: coords }));
    }
  }

  private emitHand(hand: HandPinchState) {
    for (const cb of this.handListeners) {
      try { cb(hand); } catch {}
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cortex-hand-pinch', { detail: hand }));
      if (hand.bimanual?.active) {
        window.dispatchEvent(new CustomEvent('cortex-hand-3d', { detail: hand.bimanual }));
      }
    }
  }

  private initWorker(): void {
    if (this.worker || typeof Worker === 'undefined') return;
    try {
      this.worker = new Worker(
        new URL('../workers/holo-hand.worker.ts', import.meta.url),
        { type: 'module' },
      );
      this.worker.onmessage = (event: MessageEvent<any>) => {
        const msg = event.data;
        if (!this.running) return;
        if (msg.type === 'ready') {
          this.workerReady = true;
          this.workerFailed = false;
          this.engineMode = msg.delegate === 'GPU' ? 'mediapipe-gpu' : 'mediapipe-cpu';
        } else if (msg.type === 'error') {
          if (!this.workerReady) {
            this.workerFailed = true;
            this.engineMode = 'optical-fallback';
          }
        } else if (msg.type === 'result') {
          this.handleNeuralResult(msg);
        }
      };
      this.worker.onerror = () => {
        this.workerFailed = true;
        this.engineMode = 'optical-fallback';
      };
      this.worker.postMessage({ type: 'init' });
    } catch {
      this.workerFailed = true;
      this.engineMode = 'optical-fallback';
    }
  }

  public async start(): Promise<boolean> {
    if (this.running) return true;
    if (!this.isSupported()) return false;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user',
        },
        audio: false,
      });

      this.video = document.createElement('video');
      this.video.autoplay = true;
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.srcObject = this.stream;
      await this.video.play();

      this.canvas = document.createElement('canvas');
      this.canvas.width = 48;
      this.canvas.height = 36;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

      const vw = this.video.videoWidth || 640;
      const vh = this.video.videoHeight || 480;
      if (typeof OffscreenCanvas !== 'undefined') {
        this.offscreen = new OffscreenCanvas(Math.min(480, vw), Math.min(360, vh));
        this.offscreenCtx = this.offscreen.getContext('2d');
      }

      this.running = true;
      this.workerReady = false;
      this.workerFailed = false;
      this.primarySmoother.reset();
      this.secondarySmoother.reset();
      this.prevOrbitAnchor = null;
      this.prevTwoHandSpan = null;
      this.initWorker();
      this.loop();
      return true;
    } catch (err) {
      console.warn('[CortexWebcamParallax] Camera access unavailable or denied:', err);
      this.stop();
      return false;
    }
  }

  public stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    if (this.worker) {
      try { this.worker.terminate(); } catch {}
      this.worker = null;
      this.workerReady = false;
    }

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        try { track.stop(); } catch {}
      }
      this.stream = null;
    }

    if (this.video) {
      try {
        this.video.pause();
        this.video.srcObject = null;
      } catch {}
      this.video = null;
    }

    this.canvas = null;
    this.ctx = null;
    this.offscreen = null;
    this.offscreenCtx = null;
    this.curX = 0;
    this.curY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.handDetected = false;
    this.isPinching = false;
    this.isClutching = false;
    this.prevOrbitAnchor = null;
    this.prevTwoHandSpan = null;

    this.emitHead({ x: 0, y: 0, active: false });
    this.emitHand({
      detected: false,
      x: 0,
      y: 0,
      normX: 0,
      normY: 0,
      pinching: false,
      pinchDist: 1.0,
      clutching: false,
      engine: this.engineMode,
    });
  }

  private loop = async () => {
    if (!this.running || !this.video) return;

    if (this.video.readyState >= 2) {
      const now = performance.now();

      // 1. Head Parallax (~20Hz throttle for zero GPU contention)
      if (now - this.lastHeadFrameAt > 48) {
        this.lastHeadFrameAt = now;
        if (this.faceDetector) {
          try {
            const faces = await this.faceDetector.detect(this.video);
            if (faces && faces.length > 0) {
              const bb = faces[0].boundingBox;
              const vw = this.video.videoWidth || 640;
              const vh = this.video.videoHeight || 480;
              const cx = bb.x + bb.width / 2;
              const cy = bb.y + bb.height / 2;
              this.targetX = -((cx / vw) * 2 - 1);
              this.targetY = -((cy / vh) * 2 - 1);
            }
          } catch {
            this.fallbackCentroid();
          }
        } else {
          this.fallbackCentroid();
        }
      }

      this.curX += (this.targetX - this.curX) * 0.14;
      this.curY += (this.targetY - this.curY) * 0.14;

      this.emitHead({
        x: Math.max(-1.5, Math.min(1.5, this.curX)),
        y: Math.max(-1.5, Math.min(1.5, this.curY)),
        active: true,
      });

      // 2. Neural Hand Tracking (Worker) or Optical Fallback
      if (this.workerReady && this.worker && this.offscreen && this.offscreenCtx) {
        if (this.video.currentTime !== this.lastVideoTime) {
          this.lastVideoTime = this.video.currentTime;
          this.offscreenCtx.drawImage(
            this.video,
            0,
            0,
            this.offscreen.width,
            this.offscreen.height,
          );
          const bitmap = this.offscreen.transferToImageBitmap();
          this.worker.postMessage({ type: 'frame', timestamp: now, frame: bitmap }, [bitmap]);
        }
      } else if (this.workerFailed) {
        this.detectHandOpticalFallback();
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private handleNeuralResult(msg: {
    timestamp: number;
    landmarks: Point3D[][];
    worldLandmarks: Point3D[][];
    handedness: string[];
    gestures: Array<{ name: string; score: number }>;
  }): void {
    const now = performance.now();
    if (this.lastInferAt > 0) {
      const instFps = 1000 / Math.max(1, now - this.lastInferAt);
      this.smoothFps = this.smoothFps ? this.smoothFps * 0.85 + instFps * 0.15 : instFps;
    }
    this.lastInferAt = now;

    const rawHands = msg.landmarks || [];
    if (rawHands.length === 0) {
      this.prevOrbitAnchor = null;
      this.prevTwoHandSpan = null;
      if (this.handDetected) {
        this.handDetected = false;
        this.isPinching = false;
        this.isClutching = false;
        this.emitHand({
          detected: false,
          x: Math.round(this.curHandX * window.innerWidth),
          y: Math.round(this.curHandY * window.innerHeight),
          normX: this.curHandX,
          normY: this.curHandY,
          pinching: false,
          pinchDist: 1.0,
          clutching: false,
          engine: this.engineMode,
          fps: Math.round(this.smoothFps),
        });
      }
      return;
    }

    // Choose Right hand (or first hand) as primary pointer; second hand for bimanual orbit/zoom
    let primaryIdx = 0;
    if (rawHands.length > 1) {
      // In mirrored webcam feed, MediaPipe's 'Left' label often corresponds to user's right hand
      const rightIdx = msg.handedness.findIndex((h) => h === 'Left' || h === 'Right');
      if (rightIdx >= 0) primaryIdx = rightIdx;
    }
    const secondaryIdx = rawHands.length > 1 ? (primaryIdx === 0 ? 1 : 0) : -1;

    const primarySmoothed = this.primarySmoother.smooth(mirrorLandmarks(rawHands[primaryIdx]), now);
    const secondarySmoothed =
      secondaryIdx >= 0
        ? this.secondarySmoother.smooth(mirrorLandmarks(rawHands[secondaryIdx]), now)
        : undefined;

    const wrist = primarySmoothed[0];
    const thumbTip = primarySmoothed[4];
    const indexTip = primarySmoothed[8];
    const middleMcp = primarySmoothed[9];
    const middleTip = primarySmoothed[12];

    const palmScale = Math.max(0.05, dist3D(wrist, middleMcp));
    const rawPinchRatio = dist3D(thumbTip, indexTip) / palmScale;
    const rawClutchRatio = dist3D(thumbTip, middleTip) / palmScale;
    this.pinchRatio = rawPinchRatio;

    const gestureObj = msg.gestures?.[primaryIdx];
    const primaryGesture = gestureObj && gestureObj.score > 0.5 ? gestureObj.name : 'None';

    // Schmitt Trigger Hysteresis for Spatial Clutch (middle + thumb or Closed_Fist)
    const prevClutch = this.isClutching;
    if (!this.isPinching) {
      if (!this.isClutching && (rawClutchRatio < 0.30 || primaryGesture === 'Closed_Fist')) {
        this.isClutching = true;
      } else if (this.isClutching && rawClutchRatio > 0.42 && primaryGesture !== 'Closed_Fist') {
        this.isClutching = false;
      }
    } else {
      this.isClutching = false;
    }

    if (this.isClutching !== prevClutch) {
      try { neuroAudio.playPacketChime(this.isClutching ? '#f59e0b' : '#38bdf8'); } catch {}
    }

    // Schmitt Trigger Hysteresis for Index+Thumb Pinch
    const prevPinch = this.isPinching;
    if (!this.isClutching) {
      if (!this.isPinching && rawPinchRatio < 0.34) {
        this.isPinching = true;
        this.pinchLockUntil = now + 75; // Vision Pro 75ms cursor freeze on pinch onset
        this.lockedNormX = this.curHandX;
        this.lockedNormY = this.curHandY;
      } else if (this.isPinching && rawPinchRatio > 0.46) {
        this.isPinching = false;
      }
    } else {
      this.isPinching = false;
    }

    if (this.isPinching && !prevPinch) {
      try { neuroAudio.playPacketChime('#34d399'); } catch {}
    }

    // Pointer position: blend index tip & thumb tip during pinch, index tip otherwise
    const targetNormX = this.isPinching
      ? (indexTip.x + thumbTip.x) * 0.5
      : indexTip.x;
    const targetNormY = this.isPinching
      ? (indexTip.y + thumbTip.y) * 0.5
      : indexTip.y;

    if (this.isClutching) {
      // Clutch active: freeze cursor so user can reposition hand comfortably
    } else if (now < this.pinchLockUntil) {
      this.curHandX = this.lockedNormX;
      this.curHandY = this.lockedNormY;
    } else {
      this.curHandX = Math.max(0.01, Math.min(0.99, targetNormX));
      this.curHandY = Math.max(0.01, Math.min(0.99, targetNormY));
    }

    // Bimanual / 3D Scene Orbit & Zoom calculation
    let bimanual: BimanualControlState = {
      active: false,
      orbitDeltaX: 0,
      orbitDeltaY: 0,
      zoomDelta: 0,
      handCount: rawHands.length,
    };

    if (secondarySmoothed) {
      // 2 hands: secondary hand wrist drives 3D orbit, inter-hand distance drives zoom
      const secWrist = secondarySmoothed[0];
      const secGesture = msg.gestures?.[secondaryIdx]?.name ?? 'None';
      const span = dist3D(wrist, secWrist);

      if (this.prevTwoHandSpan !== null && (this.isPinching || secGesture === 'Open_Palm' || secGesture === 'Closed_Fist')) {
        const dSpan = span - this.prevTwoHandSpan;
        if (Math.abs(dSpan) > 0.003) {
          bimanual.zoomDelta = -dSpan * 10.0;
          bimanual.active = true;
        }
      }
      this.prevTwoHandSpan = span;

      if (secGesture === 'Closed_Fist' || secGesture === 'Open_Palm') {
        if (this.prevOrbitAnchor) {
          const dx = secWrist.x - this.prevOrbitAnchor.x;
          const dy = secWrist.y - this.prevOrbitAnchor.y;
          if (Math.hypot(dx, dy) > 0.002) {
            bimanual.orbitDeltaX = dx * 3.8;
            bimanual.orbitDeltaY = dy * 2.8;
            bimanual.active = true;
          }
        }
        this.prevOrbitAnchor = { x: secWrist.x, y: secWrist.y };
      } else {
        this.prevOrbitAnchor = null;
      }
    } else {
      this.prevTwoHandSpan = null;
      // 1 hand + Closed_Fist: single-hand 3D orbit mode
      if (primaryGesture === 'Closed_Fist') {
        if (this.prevOrbitAnchor) {
          const dx = wrist.x - this.prevOrbitAnchor.x;
          const dy = wrist.y - this.prevOrbitAnchor.y;
          if (Math.hypot(dx, dy) > 0.002) {
            bimanual.orbitDeltaX = dx * 3.8;
            bimanual.orbitDeltaY = dy * 2.8;
            bimanual.active = true;
          }
        }
        this.prevOrbitAnchor = { x: wrist.x, y: wrist.y };
      } else {
        this.prevOrbitAnchor = null;
      }
    }

    this.handDetected = true;
    const sw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const sh = typeof window !== 'undefined' ? window.innerHeight : 800;

    const rawHanded = msg.handedness?.[primaryIdx];
    const handedness: 'Left' | 'Right' | 'Unknown' =
      rawHanded === 'Left' ? 'Right' : rawHanded === 'Right' ? 'Left' : 'Unknown';

    const displayGesture = this.isPinching
      ? 'PINCH_LOCK'
      : this.isClutching
      ? 'SPATIAL_CLUTCH'
      : primaryGesture !== 'None'
      ? primaryGesture.toUpperCase()
      : 'TRACKING';

    this.emitHand({
      detected: true,
      x: Math.round(this.curHandX * sw),
      y: Math.round(this.curHandY * sh),
      normX: this.curHandX,
      normY: this.curHandY,
      pinching: this.isPinching,
      pinchDist: Number(rawPinchRatio.toFixed(3)),
      clutching: this.isClutching,
      handedness,
      gesture: displayGesture,
      landmarks: primarySmoothed,
      secondaryLandmarks: secondarySmoothed,
      bimanual,
      engine: this.engineMode,
      fps: Math.round(this.smoothFps),
    });
  }

  private fallbackCentroid(): void {
    if (!this.video || !this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.drawImage(this.video, 0, 0, w, h);
    const imgData = this.ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    let totalWeight = 0;
    let sumX = 0;
    let sumY = 0;

    const scanRows = Math.floor(h * 0.65);
    for (let y = 0; y < scanRows; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
        if (lum > 60) {
          totalWeight += lum;
          sumX += x * lum;
          sumY += y * lum;
        }
      }
    }

    if (totalWeight > 100) {
      this.targetX = -((sumX / totalWeight / w) * 2 - 1) * 1.3;
      this.targetY = -((sumY / totalWeight / scanRows) * 2 - 1) * 1.1;
    }
  }

  private detectHandOpticalFallback(): void {
    if (!this.video || !this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.drawImage(this.video, 0, 0, w, h);
    const imgData = this.ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    let skinCount = 0;
    let handSumX = 0;
    let handSumY = 0;
    const startY = Math.floor(h * 0.2);
    let minX = w, maxX = 0, minY = h, maxY = 0;
    const upperPoints: { x: number; y: number }[] = [];

    for (let y = startY; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = d[idx], g = d[idx + 1], b = d[idx + 2];
        const cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
        const cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;
        if (cb >= 77 && cb <= 130 && cr >= 132 && cr <= 175 && r > g && r > b && r - g > 12) {
          skinCount++;
          handSumX += x;
          handSumY += y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (y < minY + (maxY - minY) * 0.3 + 3) upperPoints.push({ x, y });
        }
      }
    }

    if (skinCount > 35 && maxY - minY >= 5) {
      this.handDetected = true;
      const targetNormX = 1.0 - handSumX / skinCount / w;
      const targetNormY = handSumY / skinCount / h;
      this.curHandX += (targetNormX - this.curHandX) * 0.22;
      this.curHandY += (targetNormY - this.curHandY) * 0.22;

      let topSpan = 0;
      if (upperPoints.length >= 4) {
        let topMin = w, topMax = 0;
        for (const pt of upperPoints) {
          if (pt.x < topMin) topMin = pt.x;
          if (pt.x > topMax) topMax = pt.x;
        }
        topSpan = (topMax - topMin) / w;
      }

      this.pinchRatio = topSpan;
      this.isPinching = topSpan > 0 && topSpan < 0.14 && skinCount > 40;
      const sw = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const sh = typeof window !== 'undefined' ? window.innerHeight : 800;

      this.emitHand({
        detected: true,
        x: Math.round(this.curHandX * sw),
        y: Math.round(this.curHandY * sh),
        normX: this.curHandX,
        normY: this.curHandY,
        pinching: this.isPinching,
        pinchDist: this.pinchRatio,
        clutching: false,
        gesture: this.isPinching ? 'PINCH_LOCK' : 'OPTICAL_FALLBACK',
        engine: 'optical-fallback',
      });
    } else if (this.handDetected) {
      this.handDetected = false;
      this.isPinching = false;
      this.emitHand({
        detected: false,
        x: Math.round(this.curHandX * (typeof window !== 'undefined' ? window.innerWidth : 1200)),
        y: Math.round(this.curHandY * (typeof window !== 'undefined' ? window.innerHeight : 800)),
        normX: this.curHandX,
        normY: this.curHandY,
        pinching: false,
        pinchDist: 1.0,
        clutching: false,
        engine: 'optical-fallback',
      });
    }
  }
}

export const cortexWebcamParallax = new CortexWebcamParallax();
