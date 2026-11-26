/**
 * one-euro-filter.ts — Adaptive velocity-dependent low-pass filter
 * (Casiez, Roussel, Vogel — CHI 2012).
 *
 * Eliminates high-frequency jitter when a hand is hovering still (low cutoff)
 * while preserving instantaneous responsiveness during fast spatial sweeps
 * (cutoff scales linearly with velocity via `beta`).
 */

class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;
  private a: number;

  constructor(alpha: number, initVal?: number) {
    this.a = this.clampAlpha(alpha);
    if (initVal !== undefined) {
      this.y = initVal;
      this.s = initVal;
    }
  }

  private clampAlpha(alpha: number): number {
    if (!Number.isFinite(alpha) || alpha <= 0) return 0.001;
    if (alpha > 1) return 1.0;
    return alpha;
  }

  public filterWithAlpha(value: number, alpha: number): number {
    this.a = this.clampAlpha(alpha);
    if (this.s === null || this.y === null) {
      this.s = value;
    } else {
      this.s = this.a * value + (1.0 - this.a) * this.s;
    }
    this.y = value;
    return this.s;
  }

  public lastRawValue(): number | null {
    return this.y;
  }

  public reset(): void {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter {
  private freq: number;
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private lastTimeMs: number | null = null;

  constructor(
    freq = 60,
    minCutoff = 1.2,
    beta = 0.035,
    dCutoff = 1.0,
  ) {
    this.freq = freq;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xFilter = new LowPassFilter(this.alpha(this.minCutoff));
    this.dxFilter = new LowPassFilter(this.alpha(this.dCutoff));
  }

  private alpha(cutoff: number): number {
    const te = 1.0 / Math.max(1e-3, this.freq);
    const tau = 1.0 / (2.0 * Math.PI * Math.max(1e-3, cutoff));
    return 1.0 / (1.0 + tau / te);
  }

  public filter(value: number, timestampMs?: number): number {
    if (timestampMs !== undefined && this.lastTimeMs !== null) {
      const dt = (timestampMs - this.lastTimeMs) / 1000;
      if (dt > 1e-4 && dt < 1.0) {
        this.freq = 1.0 / dt;
      }
    }
    if (timestampMs !== undefined) {
      this.lastTimeMs = timestampMs;
    }

    const prevX = this.xFilter.lastRawValue();
    const dValue = prevX === null ? 0.0 : (value - prevX) * this.freq;
    const edValue = this.dxFilter.filterWithAlpha(dValue, this.alpha(this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edValue);
    return this.xFilter.filterWithAlpha(value, this.alpha(cutoff));
  }

  public reset(): void {
    this.lastTimeMs = null;
    this.xFilter.reset();
    this.dxFilter.reset();
  }
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export class Point3DOneEuroFilter {
  private fx: OneEuroFilter;
  private fy: OneEuroFilter;
  private fz: OneEuroFilter;

  constructor(freq = 60, minCutoff = 1.2, beta = 0.035, dCutoff = 1.0) {
    this.fx = new OneEuroFilter(freq, minCutoff, beta, dCutoff);
    this.fy = new OneEuroFilter(freq, minCutoff, beta, dCutoff);
    this.fz = new OneEuroFilter(freq, minCutoff, beta, dCutoff);
  }

  public filter(pt: Point3D, timestampMs?: number): Point3D {
    return {
      x: this.fx.filter(pt.x, timestampMs),
      y: this.fy.filter(pt.y, timestampMs),
      z: this.fz.filter(pt.z, timestampMs),
    };
  }

  public reset(): void {
    this.fx.reset();
    this.fy.reset();
    this.fz.reset();
  }
}

/**
 * Smooths all 21 MediaPipe hand landmarks simultaneously.
 * Automatically resets if a hand was absent for >250ms to prevent teleport trails.
 */
export class HandLandmarkSmoother {
  private filters: Point3DOneEuroFilter[];
  private lastSeenMs = 0;

  constructor(numLandmarks = 21, minCutoff = 1.4, beta = 0.045) {
    this.filters = Array.from(
      { length: numLandmarks },
      () => new Point3DOneEuroFilter(60, minCutoff, beta, 1.0),
    );
  }

  public smooth(landmarks: Point3D[], timestampMs: number): Point3D[] {
    if (this.lastSeenMs > 0 && timestampMs - this.lastSeenMs > 250) {
      this.reset();
    }
    this.lastSeenMs = timestampMs;
    return landmarks.map((pt, i) => {
      const f = this.filters[i];
      return f ? f.filter(pt, timestampMs) : pt;
    });
  }

  public reset(): void {
    this.lastSeenMs = 0;
    for (const f of this.filters) f.reset();
  }
}
