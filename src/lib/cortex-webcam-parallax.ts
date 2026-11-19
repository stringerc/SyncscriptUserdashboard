/**
 * cortex-webcam-parallax.ts
 *
 * Client-side zero-dependency optical head & eye tracking for the
 * Cortex "Holographic Window" cockpit parallax effect.
 *
 * Runs 100% locally in browser memory via MediaDevices & OffscreenCanvas.
 * No external neural packages required; zero telemetry leaves the machine.
 *
 * Detects head position via window.FaceDetector (when supported) or
 * real-time luminance-centroid tracking over a downscaled 32x24 matrix.
 */

export interface HeadCoords {
  x: number; // [-1.0, 1.0] left to right
  y: number; // [-1.0, 1.0] down to up
  active: boolean;
}

type HeadListener = (coords: HeadCoords) => void;

class CortexWebcamParallax {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number = 0;
  private running: boolean = false;
  private listeners: Set<HeadListener> = new Set();

  private curX: number = 0;
  private curY: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;

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
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit(coords: HeadCoords) {
    for (const cb of this.listeners) {
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
      this.canvas.width = 32;
      this.canvas.height = 24;
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

    this.emit({ x: 0, y: 0, active: false });
  }

  private loop = async () => {
    if (!this.running || !this.video || !this.ctx || !this.canvas) return;

    if (this.video.readyState >= 2) {
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

      // Smooth lerp (exponential decay) for cinematic camera tracking
      this.curX += (this.targetX - this.curX) * 0.14;
      this.curY += (this.targetY - this.curY) * 0.14;

      this.emit({
        x: Math.max(-1.5, Math.min(1.5, this.curX)),
        y: Math.max(-1.5, Math.min(1.5, this.curY)),
        active: true,
      });
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  /**
   * Fast 32x24 pixel optical luminance centroid fallback.
   * Tracks upper-frame skin/face highlight shifts relative to center.
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

    // Scan top 75% where user face sits in viewport
    const scanRows = Math.floor(h * 0.75);
    for (let y = 0; y < scanRows; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = d[idx];
        const g = d[idx + 1];
        const b = d[idx + 2];
        // Luminance
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
      // Invert X for mirror parallax
      this.targetX = -((avgX / w) * 2 - 1) * 1.3;
      this.targetY = -((avgY / scanRows) * 2 - 1) * 1.1;
    }
  }
}

export const cortexWebcamParallax = new CortexWebcamParallax();
