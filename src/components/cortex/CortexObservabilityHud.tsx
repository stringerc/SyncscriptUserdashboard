import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  HardDrive,
  Mic,
  Zap,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  Gauge,
  Cpu
} from 'lucide-react';
import {
  getCortexObservabilityHUD,
  type ObservabilityMetrics,
  type TelemetryPoint,
} from '../../lib/cortex-observability-hud';

interface SparklineProps {
  data: TelemetryPoint[];
  color: string;
  gradientId: string;
  width?: number;
  height?: number;
}

const Sparkline: React.FC<SparklineProps> = ({
  data,
  color,
  gradientId,
  width = 110,
  height = 28,
}) => {
  if (!data || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[9px] text-slate-500 font-mono"
        style={{ width, height }}
      >
        collecting...
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;
  const h = height - padding * 2;

  const points = values.map((val, idx) => {
    const x = padding + (idx / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const CortexObservabilityHud: React.FC = () => {
  const [metrics, setMetrics] = useState<ObservabilityMetrics>(() =>
    getCortexObservabilityHUD().getMetrics()
  );
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [pruneResult, setPruneResult] = useState<string | null>(null);
  const [isPruning, setIsPruning] = useState<boolean>(false);

  useEffect(() => {
    const hud = getCortexObservabilityHUD();
    const unsubscribe = hud.subscribe((latest) => {
      setMetrics({ ...latest });
    });
    return () => unsubscribe();
  }, []);

  const handlePruneCache = useCallback(() => {
    setIsPruning(true);
    try {
      const hud = getCortexObservabilityHUD();
      const res = hud.pruneStaleCache();
      setPruneResult(`Freed ${res.freedMb} MB non-critical cache. Current usage: ${res.remainingMb} MB.`);
      setTimeout(() => setPruneResult(null), 4000);
    } finally {
      setIsPruning(false);
    }
  }, []);

  const voiceHealthColor =
    metrics.healthStatus.voice === 'optimal'
      ? 'text-emerald-400'
      : metrics.healthStatus.voice === 'elevated'
      ? 'text-amber-400'
      : 'text-rose-400';

  const apiHealthColor =
    metrics.healthStatus.api === 'optimal'
      ? 'text-emerald-400'
      : metrics.healthStatus.api === 'elevated'
      ? 'text-amber-400'
      : 'text-rose-400';

  const storageHealthColor =
    metrics.healthStatus.storage === 'optimal'
      ? 'bg-emerald-400'
      : metrics.healthStatus.storage === 'warning'
      ? 'bg-amber-400'
      : 'bg-rose-500';

  const isStreakSecure = metrics.healthStatus.streakProtection === 'secure';

  return (
    <div
      id="cortex-observability-hud"
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg space-y-3.5 transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
          <div>
            <div className="text-xs font-semibold text-white flex items-center gap-1.5 font-mono">
              Continuous Observability HUD
            </div>
            <div className="text-[10px] text-slate-400">
              Live latency, storage & signal telemetry
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            id="cortex-streak-protection-badge"
            className={`text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold flex items-center gap-1 ${
              isStreakSecure
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
            }`}
          >
            {isStreakSecure ? (
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3 h-3 text-amber-400" />
            )}
            {isStreakSecure ? 'TELEMETRY NOMINAL' : 'TELEMETRY ELEVATED'}
          </span>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            id="cortex-hud-expand-toggle"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse HUD' : 'Expand HUD'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3 pt-1">
          {/* Top 2 Gauges: Voice Latency + API Latency */}
          <div className="grid grid-cols-2 gap-2">
            {/* Voice Synthesis Latency Card */}
            <div
              id="cortex-gauge-voice"
              className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-1 font-semibold">
                  <Mic className="w-3 h-3 text-cyan-400" />
                  Voice TTFT
                </span>
                <span className={`text-[10px] font-mono font-bold ${metrics.voiceLatencyMs == null ? 'text-slate-500' : voiceHealthColor}`}>
                  {metrics.voiceLatencyMs == null ? '—' : `${metrics.voiceLatencyMs}ms`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <Sparkline
                  data={metrics.voiceLatencyHistory}
                  color="#22d3ee"
                  gradientId="grad-voice"
                  width={90}
                  height={24}
                />
                <div className="text-right font-mono text-[9px] text-slate-400">
                  <div className="text-emerald-400 font-semibold">&lt;500ms</div>
                  <div>Kokoro-82M</div>
                </div>
              </div>
            </div>

            {/* API & Tool Latency Card */}
            <div
              id="cortex-gauge-api"
              className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider flex items-center gap-1 font-semibold">
                  <Zap className="w-3 h-3 text-purple-400" />
                  API / Host
                </span>
                <span className={`text-[10px] font-mono font-bold ${metrics.apiLatencyMs == null ? 'text-slate-500' : apiHealthColor}`}>
                  {metrics.apiLatencyMs == null ? '—' : `${metrics.apiLatencyMs}ms`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <Sparkline
                  data={metrics.apiLatencyHistory}
                  color="#a855f7"
                  gradientId="grad-api"
                  width={90}
                  height={24}
                />
                <div className="text-right font-mono text-[9px] text-slate-400">
                  <div className="text-emerald-400 font-semibold">&lt;600ms</div>
                  <div>Host Tools</div>
                </div>
              </div>
            </div>
          </div>

          {/* Browser Storage & IndexedDB Pressure Bar */}
          <div
            id="cortex-gauge-storage"
            className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2"
          >
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-semibold">
                <HardDrive className="w-3 h-3 text-teal-400" />
                IndexedDB & Quota Pressure
              </span>
              <span className="text-slate-300">
                {metrics.storageQuotaMb > 0 ? (
                  <><strong className="text-teal-300 font-mono">{metrics.storageUsedMb} MB</strong> / {metrics.storageQuotaMb} MB ({metrics.storageUsagePercent}%)</>
                ) : 'measuring…'}
              </span>
            </div>

            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${storageHealthColor}`}
                style={{ width: `${Math.min(100, Math.max(2, metrics.storageUsagePercent))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                Status:{' '}
                <strong className={metrics.indexedDbPressure === 'optimal' ? 'text-emerald-400' : 'text-amber-400'}>
                  {metrics.indexedDbPressure.toUpperCase()}
                </strong>
              </span>
              <span className="text-slate-500">Auto-prune threshold: 75%</span>
            </div>
          </div>

          {/* Global Workspace Signals & Free Energy ($F$) */}
          <div
            id="cortex-gauge-gw"
            className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5"
          >
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-semibold">
                <Cpu className="w-3 h-3 text-amber-400" />
                Global Workspace Signals
              </span>
              <span className="text-teal-300 font-bold">
                {metrics.globalWorkspaceSignalsCount} Signals
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Broadcast Rate: <strong className="text-slate-200">{metrics.globalWorkspaceBroadcastRate == null ? '—' : `${metrics.globalWorkspaceBroadcastRate} / min`}</strong></span>
              <span>Variational F: <strong className="text-emerald-400">{metrics.variationalFreeEnergy == null ? '—' : metrics.variationalFreeEnergy.toFixed(2)}</strong></span>
            </div>
          </div>

          {/* Self-Healing Actions & Streak Shield */}
          <div className="pt-1 flex items-center justify-between gap-2">
            <button
              type="button"
              id="cortex-prune-cache-btn"
              onClick={handlePruneCache}
              disabled={isPruning}
              className="flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-medium bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-teal-300 border border-teal-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isPruning ? 'animate-spin' : ''}`} />
              <span>⚡ Prune Cache & Free Quota</span>
            </button>
          </div>

          {/* Self-healing notification feedback */}
          {pruneResult && (
            <div
              id="cortex-prune-feedback"
              className="text-[10px] text-teal-300 bg-teal-950/70 p-2 rounded-lg border border-teal-800/60 font-mono animate-in fade-in"
            >
              ✔ {pruneResult}
            </div>
          )}

          {/* Recommendations Banner */}
          {metrics.recommendations.length > 0 && (
            <div className="rounded-lg bg-slate-950/40 p-2 border border-slate-800/60 space-y-1">
              {metrics.recommendations.map((rec, i) => (
                <div key={i} className="text-[10px] text-slate-400 flex items-start gap-1.5 font-mono">
                  <span className="text-emerald-400 font-bold">›</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

