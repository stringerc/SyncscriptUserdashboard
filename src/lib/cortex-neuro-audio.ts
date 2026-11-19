/**
 * cortex-neuro-audio.ts — Procedural Neuro-Acoustic Sonification Engine
 *
 * Zero external audio files or MP3 dependencies. Generates spatialized,
 * harmonic frequencies and sub-bass transients directly through the
 * native Web Audio API (AudioContext) in response to agent telemetry,
 * in-flight packet arrivals, and cognitive load shifts.
 */

class NeuroAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = false;
  private initialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cortex_neuro_audio_enabled');
        this.enabled = saved === 'true';
      } catch {
        this.enabled = false;
      }
    }
  }

  private initContext() {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.enabled ? 0.35 : 0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch {
      // AudioContext unavailable or restricted
    }
  }

  public enable() {
    this.enabled = true;
    try { localStorage.setItem('cortex_neuro_audio_enabled', 'true'); } catch {}
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0.35, this.ctx.currentTime, 0.05);
    }
  }

  public disable() {
    this.enabled = false;
    try { localStorage.setItem('cortex_neuro_audio_enabled', 'false'); } catch {}
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  public toggle(): boolean {
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Translates an agent hex color or ID into a celestial harmonic pitch (Hz).
   */
  private colorToFreq(hex: string): number {
    let hash = 0;
    for (let i = 0; i < hex.length; i++) hash = (hash * 31 + hex.charCodeAt(i)) >>> 0;
    // Pentatonic scale degrees based on A=432Hz harmonic tuning
    const notes = [432, 486, 540, 648, 720, 864, 972, 1080];
    return notes[hash % notes.length];
  }

  /**
   * Plays a spatialized, crystal harmonic chime when a packet lands or agent communicates.
   */
  public playPacketChime(hexColor: string = '#38bdf8', panNorm: number = 0) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;

    try {
      const now = this.ctx.currentTime;
      const freq = this.colorToFreq(hexColor);

      // Primary sine oscillator + subtle overtone
      const osc = this.ctx.createOscillator();
      const overtone = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2, now);

      // Delicate micro-envelope (10ms attack, 90ms exponential decay)
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

      osc.connect(gain);
      overtone.connect(gain);

      if (panner) {
        panner.pan.setValueAtTime(Math.max(-0.9, Math.min(0.9, panNorm)), now);
        gain.connect(panner);
        panner.connect(this.masterGain);
      } else {
        gain.connect(this.masterGain);
      }

      osc.start(now);
      overtone.start(now);
      osc.stop(now + 0.12);
      overtone.stop(now + 0.12);
    } catch {
      // Audio playback safely ignored if context is suspended
    }
  }

  /**
   * Sub-bass 55Hz impact transient when a major mission converges on the Sovereign Core.
   */
  public playCoreImpact() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Pitch envelope: drops from 95Hz down to 42Hz for punch
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.22);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Ignore
    }
  }
}

export const neuroAudio = new NeuroAudioEngine();
