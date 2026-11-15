/**
 * Cortex Continuous Observability & Native Telemetry HUD
 *
 * Implements lightweight, zero-daemon observability across the 4 Golden Signals:
 * 1. Voice Synthesis Latency (TTFT ms - target <500ms).
 * 2. API & Tool Roundtrip Latency (ms - target <1500ms).
 * 3. Browser Storage Quota & IndexedDB Memory Pressure (navigator.storage.estimate()).
 * 4. Global Workspace Broadcast Rate & Variational Free Energy (F).
 * 5. Proactive Streak Protection & Self-Healing Cache Pruning.
 */

import { getGlobalWorkspace } from './global-workspace';

export interface TelemetryPoint {
  timestamp: number;
  value: number;
}

export interface ObservabilityMetrics {
  voiceLatencyMs: number | null;
  voiceLatencyHistory: TelemetryPoint[];
  apiLatencyMs: number | null;
  apiLatencyHistory: TelemetryPoint[];
  storageUsedMb: number;
  storageQuotaMb: number;
  storageUsagePercent: number;
  indexedDbPressure: 'optimal' | 'warning' | 'critical';
  globalWorkspaceSignalsCount: number;
  globalWorkspaceBroadcastRate: number | null; // real broadcasts / min
  variationalFreeEnergy: number | null;
  freeEnergyHistory: TelemetryPoint[];
  healthStatus: {
    voice: 'optimal' | 'elevated' | 'degraded';
    api: 'optimal' | 'elevated' | 'degraded';
    storage: 'optimal' | 'warning' | 'critical';
    streakProtection: 'secure' | 'at_risk';
  };
  recommendations: string[];
}

export type ObservabilityListener = (metrics: ObservabilityMetrics) => void;

export class CortexObservabilityHUD {
  private static instance: CortexObservabilityHUD | null = null;
  private voiceHistory: TelemetryPoint[] = [];
  private apiHistory: TelemetryPoint[] = [];
  private freeEnergyHistory: TelemetryPoint[] = [];
  private listeners: Set<ObservabilityListener> = new Set();
  private pollTimer: any = null;

  private currentVoiceLatency: number | null = null;
  private currentApiLatency: number | null = null;
  private currentStorageUsedMb = 0;
  private currentStorageQuotaMb = 0;

  private constructor() {
    this.startPeriodicSampling();
  }

  public static getInstance(): CortexObservabilityHUD {
    if (!CortexObservabilityHUD.instance) {
      CortexObservabilityHUD.instance = new CortexObservabilityHUD();
    }
    return CortexObservabilityHUD.instance;
  }

  private startPeriodicSampling() {
    if (typeof window !== 'undefined') {
      this.updateStorageEstimate();
      this.pollTimer = setInterval(() => {
        this.sampleTelemetry();
      }, 5000);
    }
  }

  public subscribe(listener: ObservabilityListener): () => void {
    this.listeners.add(listener);
    listener(this.getMetrics());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const metrics = this.getMetrics();
    for (const listener of this.listeners) {
      try {
        listener(metrics);
      } catch (err) {
        console.warn('[CortexObservabilityHUD] listener error:', err);
      }
    }
  }

  public async updateStorageEstimate(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (est.usage !== undefined && est.quota !== undefined) {
          this.currentStorageUsedMb = parseFloat((est.usage / (1024 * 1024)).toFixed(1));
          this.currentStorageQuotaMb = parseFloat((est.quota / (1024 * 1024)).toFixed(0));
        }
      } catch {}
    }
  }

  public recordVoiceLatency(ms: number): void {
    const validMs = Math.max(50, Math.min(5000, Math.round(ms)));
    this.currentVoiceLatency = validMs;
    this.voiceHistory.push({ timestamp: Date.now(), value: validMs });
    if (this.voiceHistory.length > 25) this.voiceHistory.shift();
    this.notify();
  }

  public recordApiLatency(ms: number): void {
    const validMs = Math.max(10, Math.min(10000, Math.round(ms)));
    this.currentApiLatency = validMs;
    this.apiHistory.push({ timestamp: Date.now(), value: validMs });
    if (this.apiHistory.length > 25) this.apiHistory.shift();
    this.notify();
  }

  public recordFreeEnergy(f: number): void {
    const validF = parseFloat(Math.max(0, Math.min(1, f)).toFixed(3));
    this.freeEnergyHistory.push({ timestamp: Date.now(), value: validF });
    if (this.freeEnergyHistory.length > 25) this.freeEnergyHistory.shift();
    this.notify();
  }

  private sampleTelemetry(): void {
    this.updateStorageEstimate().catch(() => {});
    this.notify();
  }

  public getMetrics(): ObservabilityMetrics {
    const gw = getGlobalWorkspace();
    const recentBroadcasts = typeof (gw as any).getBroadcastHistory === 'function'
      ? (gw as any).getBroadcastHistory(50)
      : [];
    const signalsCount = recentBroadcasts.length;
    const oneMinuteAgo = Date.now() - 60_000;
    const broadcastsLastMin = recentBroadcasts.filter(
      (b: any) => typeof b?.timestamp === 'number' && b.timestamp >= oneMinuteAgo
    ).length;
    const broadcastRate = signalsCount > 0 ? broadcastsLastMin : null;

    const storageUsagePercent = Math.min(
      100,
      parseFloat(((this.currentStorageUsedMb / Math.max(1, this.currentStorageQuotaMb)) * 100).toFixed(1))
    );

    let indexedDbPressure: ObservabilityMetrics['indexedDbPressure'] = 'optimal';
    if (storageUsagePercent > 75) indexedDbPressure = 'critical';
    else if (storageUsagePercent > 50) indexedDbPressure = 'warning';

    const voiceHealth: ObservabilityMetrics['healthStatus']['voice'] =
      this.currentVoiceLatency == null ? 'optimal'
      : this.currentVoiceLatency < 500 ? 'optimal' : this.currentVoiceLatency < 800 ? 'elevated' : 'degraded';

    const apiHealth: ObservabilityMetrics['healthStatus']['api'] =
      this.currentApiLatency == null ? 'optimal'
      : this.currentApiLatency < 600 ? 'optimal' : this.currentApiLatency < 1500 ? 'elevated' : 'degraded';

    const storageHealth = indexedDbPressure;
    const streakProtection: ObservabilityMetrics['healthStatus']['streakProtection'] =
      voiceHealth !== 'degraded' && storageHealth !== 'critical' ? 'secure' : 'at_risk';

    const recommendations: string[] = [];
    if (voiceHealth !== 'optimal') {
      recommendations.push('Voice latency elevated — Kokoro synthesis is the current bottleneck.');
    }
    if (storageHealth !== 'optimal') {
      recommendations.push('IndexedDB cache filling: Trigger automated cache pruning.');
    }
    if (streakProtection === 'secure' && this.currentVoiceLatency != null) {
      recommendations.push('Telemetry nominal across sampled signals.');
    }

    const latestFe =
      this.freeEnergyHistory.length > 0
        ? this.freeEnergyHistory[this.freeEnergyHistory.length - 1].value
        : null;

    return {
      voiceLatencyMs: this.currentVoiceLatency,
      voiceLatencyHistory: [...this.voiceHistory],
      apiLatencyMs: this.currentApiLatency,
      apiLatencyHistory: [...this.apiHistory],
      storageUsedMb: this.currentStorageUsedMb,
      storageQuotaMb: this.currentStorageQuotaMb,
      storageUsagePercent,
      indexedDbPressure,
      globalWorkspaceSignalsCount: signalsCount,
      globalWorkspaceBroadcastRate: broadcastRate,
      variationalFreeEnergy: latestFe,
      freeEnergyHistory: [...this.freeEnergyHistory],
      healthStatus: {
        voice: voiceHealth,
        api: apiHealth,
        storage: storageHealth,
        streakProtection,
      },
      recommendations,
    };
  }

  /**
   * Self-healing action: prunes non-critical cache and recovers storage headroom.
   */
  public pruneStaleCache(): { freedMb: number; remainingMb: number } {
    let freedBytes = 0;
    if (typeof window !== 'undefined') {
      try {
        const keysToPrune = [
          'cortex_preview_html',
          'syncscript_perf_baseline_v1',
          'cortex_mission_archive_v0',
        ];
        for (const k of keysToPrune) {
          const v = localStorage.getItem(k);
          if (v) freedBytes += v.length * 2; // UTF-16 → approx bytes
          localStorage.removeItem(k);
        }
      } catch {}
    }
    const freed = parseFloat((freedBytes / (1024 * 1024)).toFixed(2));
    this.currentStorageUsedMb = Math.max(0, parseFloat((this.currentStorageUsedMb - freed).toFixed(1)));
    this.notify();
    return { freedMb: freed, remainingMb: this.currentStorageUsedMb };
  }
}

export function getCortexObservabilityHUD(): CortexObservabilityHUD {
  return CortexObservabilityHUD.getInstance();
}

