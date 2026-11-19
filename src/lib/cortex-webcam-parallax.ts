/**
 * cortex-webcam-parallax.ts
 *
 * Client-side zero-dependency optical head tracking & spatial hand gesture
 * manipulation for the Cortex "Holographic Window" and spatial UI.
 *
 * Runs 100% locally in browser memory via MediaDevices & OffscreenCanvas.
 * No external neural packages required; zero telemetry leaves the machine.
 *
 * Capabilities:
 *  1. Cockpit Motion Parallax: Tracks head position for 3D camera depth.
 *  2. Spatial Pinch-to-Grab: Tracks hand position and detects index+thumb
 *     pinch gestures to directly grab and drag UI panels (e.g. Today's Ops).
 */

export interface HeadCoords {
  x: number; // [-1.0, 1.0] left to right
  y: number; // [-1.0, 1.0] down to up
  active: boolean;
}

export interface HandPinchState {
  detected: boolean;
  x: number; // screen pixel X
  y: number; // screen pixel Y
  normX: number; // [0, 1]
  normY: number; // [0, 1]
  pinching: boolean;
  pinchDist: number;
}

type HeadListener = (coords: HeadCoords) => void;
type HandListener = (hand: HandPinchState) => void;

class CortexWebcamParallax {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number = 0;
  private running: boolean = false;
  private headListeners: Set<HeadListener> = new Set();
  private handListeners: Set<HandListener> = new Set();

  private curX: number = 0;
  private curY: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;

  // Hand gesture state
  private curHandX: number = 0.5;
  private curHandY: number = 0.5;
  private handDetected: boolean = false;
  private isPinching: boolean = false;
  private pinchDistance: number = 1.0;

  private faceDetector: any = null;

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
      try {
        cb(coords);
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('cortex-holo-head', { detail: coords })
      );
    }
  }

  private emitHand(hand: HandPinchState) {
    for (const cb of this.handListeners) {
      try {
        cb(hand);
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('cortex-hand-pinch', { detail: hand })
      );
    }
  }

  public async start(): Promise<boolean> {
    if (this.running) return true;
    if (!this.isSupported()) return false;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
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

      this.running = true;
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

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        try {
          track.stop();
        } catch {}
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
    this.curX = 0;
    this.curY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.handDetected = false;
    this.isPinching = false;

    this.emitHead({ x: 0, y: 0, active: false });
    this.emitHand({
      detected: false,
      x: 0,
      y: 0,
      normX: 0,
      normY: 0,
      pinching: false,
      pinchDist: 1.0,
    });
  }

  private loop = async () => {
    if (!this.running || !this.video || !this.ctx || !this.canvas) return;

    if (this.video.readyState >= 2) {
      // 1. Process Head Position for Parallax
      if (this.faceDetector) {
        try {
          const faces = await this.faceDetector.detect(this.video);
          if (faces && faces.length > 0) {
            const bb = faces[0].boundingBox;
            const vw = this.video.videoWidth || 320;
            const vh = this.video.videoHeight || 240;
            const cx = bb.x + bb.width / 2;
            const cy = bb.y + bb.height / 2;
            // Inverted for natural mirror parallax
            this.targetX = -((cx / vw) * 2 - 1);
            this.targetY = -((cy / vh) * 2 - 1);
          }
        } catch {
          this.fallbackCentroid();
        }
      } else {
        this.fallbackCentroid();
      }

      this.curX += (this.targetX - this.curX) * 0.14;
      this.curY += (this.targetY - this.curY) * 0.14;

      this.emitHead({
        x: Math.max(-1.5, Math.min(1.5, this.curX)),
        y: Math.max(-1.5, Math.min(1.5, this.curY)),
        active: true,
      });

      // 2. Optical Hand & Pinch Detection
      this.detectHandAndPinch();
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  /**
   * Fast optical luminance centroid fallback for head tracking.
   */
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
        const r = d[idx];
        const g = d[idx + 1];
        const b = d[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > 60) {
          totalWeight += lum;
          sumX += x * lum;
          sumY += y * lum;
        }
      }
    }

    if (totalWeight > 100) {
      const avgX = sumX / totalWeight;
      const avgY = sumY / totalWeight;
      this.targetX = -((avgX / w) * 2 - 1) * 1.3;
      this.targetY = -((avgY / scanRows) * 2 - 1) * 1.1;
    }
  }

  /**
   * Optical Skin-Chroma & Contour Pinch Detector.
   * Tracks foreground hand position and computes finger spread between
   * index and thumb tips. When distance drops below threshold, activates PINCH.
   */
  private detectHandAndPinch(): void {
    if (!this.video || !this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const imgData = this.ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    let skinCount = 0;
    let handSumX = 0;
    let handSumY = 0;

    // Detect skin pixels using standard YCbCr boundaries
    // Scan middle and bottom region where hands typically operate
    const startY = Math.floor(h * 0.2);
    let minX = w, maxX = 0;
    let minY = h, maxY = 0;

    const upperPoints: { x: number; y: number }[] = [];

    for (let y = startY; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = d[idx];
        const g = d[idx + 1];
        const b = d[idx + 2];

        // Fast YCbCr skin tone threshold
        const cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
        const cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;
        const isSkin = cb >= 77 && cb <= 130 && cr >= 132 && cr <= 175 && r > g && r > b && (r - g) > 12;

        if (isSkin) {
          skinCount++;
          handSumX += x;
          handSumY += y;

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;

          // Collect top 25% of hand cluster to check fingertip spread
          if (y < minY + (maxY - minY) * 0.3 + 3) {
            upperPoints.push({ x, y });
          }
        }
      }
    }

    if (skinCount > 35 && maxY - minY >= 5) {
      this.handDetected = true;
      const targetNormX = 1.0 - (handSumX / skinCount) / w; // Mirror horizontally
      const targetNormY = (handSumY / skinCount) / h;

      // Smooth tracking
      this.curHandX += (targetNormX - this.curHandX) * 0.22;
      this.curHandY += (targetNormY - this.curHandY) * 0.22;

      // Measure horizontal spread in upper fingertips
      let topSpan = 0;
      if (upperPoints.length >= 4) {
        let topMin = w, topMax = 0;
        for (const pt of upperPoints) {
          if (pt.x < topMin) topMin = pt.x;
          if (pt.x > topMax) topMax = pt.x;
        }
        topSpan = (topMax - topMin) / w;
      }

      this.pinchDistance = topSpan;
      // When index and thumb meet, top span converges into a single peak (< 0.14)
      const prevPinch = this.isPinching;
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
        pinchDist: this.pinchDistance,
      });
    } else {
      if (this.handDetected) {
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
        });
      }
    }
  }
}

export const cortexWebcamParallax = new CortexWebcamParallax();
