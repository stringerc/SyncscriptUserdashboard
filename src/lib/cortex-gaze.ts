/**
 * cortex-gaze.ts — WebGazer eye-tracking layer for the Cortex visualizer.
 *
 * Lazy-loads webgazer (TF.js + MediaPipe facemesh, ~several MB) ONLY when the
 * user opts in via ?gaze=1 or the gaze toggle. Runs entirely client-side;
 * no gaze data leaves the machine.
 *
 * Flow: begin() → 9-point calibration (recordScreenPosition per point) →
 * setGazeListener streams smoothed client-pixel gaze coords to subscribers.
 * Consumers: gaze reticle UI + camera parallax fallback in the visualizer.
 */

export interface GazePoint {
  x: number; // client px
  y: number; // client px
  nx: number; // normalized 0..1 across viewport
  ny: number;
  ts: number;
}

type GazeListener = (g: GazePoint | null) => void;

const CALIBRATION_POINTS: [number, number][] = [
  [0.12, 0.15], [0.5, 0.12], [0.88, 0.15],
  [0.1, 0.5], [0.5, 0.5], [0.9, 0.5],
  [0.12, 0.85], [0.5, 0.88], [0.88, 0.85],
];

class CortexGaze {
  private wg: any = null;
  private loading: Promise<any> | null = null;
  private listeners = new Set<GazeListener>();
  private last: GazePoint | null = null;
  private smoothing: { x: number; y: number }[] = [];

  get calibrationPoints(): [number, number][] { return CALIBRATION_POINTS; }

  private async load(): Promise<any> {
    if (this.wg) return this.wg;
    if (!this.loading) {
      this.loading = (async () => {
        const mod: any = await import('webgazer');
        const wg = mod?.default ?? mod;
        if (!wg?.begin) throw new Error('webgazer module has no begin()');
        wg.params.faceMeshSolutionPath = '/mediapipe/face_mesh';
        wg.params.showVideo = false;
        wg.params.showVideoPreview = false;
        wg.params.showFaceOverlay = false;
        wg.params.showFaceFeedbackBox = false;
        wg.params.showGazeDot = false;
        wg.params.videoViewerWidth = 2;
        wg.params.videoViewerHeight = 2;
        wg.params.saveDataAcrossSessions = true;
        wg.setGazeListener((data: any) => {
          if (!data || typeof data.x !== 'number') { this.emit(null); return; }
          this.smoothing.push({ x: data.x, y: data.y });
          if (this.smoothing.length > 5) this.smoothing.shift();
          const n = this.smoothing.length;
          const sx = this.smoothing.reduce((a, p) => a + p.x, 0) / n;
          const sy = this.smoothing.reduce((a, p) => a + p.y, 0) / n;
          this.last = {
            x: sx, y: sy,
            nx: Math.min(1, Math.max(0, sx / window.innerWidth)),
            ny: Math.min(1, Math.max(0, sy / window.innerHeight)),
            ts: Date.now(),
          };
          this.emit(this.last);
        });
        this.wg = wg;
        return wg;
      })();
    }
    return this.loading;
  }

  private emit(g: GazePoint | null) {
    this.listeners.forEach((fn) => { try { fn(g); } catch {} });
  }

  subscribe(fn: GazeListener): () => void {
    this.listeners.add(fn);
    if (this.last) fn(this.last);
    return () => this.listeners.delete(fn);
  }

  /** Latest smoothed gaze point, or null if tracking is cold. */
  current(): GazePoint | null {
    return this.last && Date.now() - this.last.ts < 2000 ? this.last : null;
  }

  async begin(): Promise<void> {
    const wg = await this.load();
    await wg.begin();
  }

  async end(): Promise<void> {
    try { this.wg?.end?.(); } catch {}
    this.last = null;
    this.emit(null);
  }

  isReady(): boolean {
    try { return !!this.wg?.isReady?.(); } catch { return false; }
  }

  /** Record one calibration sample at viewport-fraction coords. */
  async calibrateAt(fx: number, fy: number): Promise<void> {
    const wg = await this.load();
    if (!wg.isReady?.()) return;
    wg.recordScreenPosition(fx * window.innerWidth, fy * window.innerHeight);
  }

  async clearCalibration(): Promise<void> {
    try { await this.wg?.clearData?.(); } catch {}
  }
}

export const cortexGaze = new CortexGaze();
