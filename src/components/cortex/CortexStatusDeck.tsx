import React, { useEffect, useRef, useState } from 'react';
import { getCortexObservabilityHUD, type ObservabilityMetrics } from '../../lib/cortex-observability-hud';

/**
 * CortexStatusDeck — frosted-glass systems dashboard for /cortex.
 * Live telemetry: LLM lane leader, voice time-to-audio, API latency,
 * agent fleet activity, storage pressure — each card with a glowing
 * SVG sigil and a latency sparkline where history exists.
 */

interface LaneLeader {
  provider: string;
  model: string;
  latencyMs: number | null;
  healthy: number;
  total: number;
}

interface AgentSummary {
  total: number;
  busy: number;
}

const ACCENT = '#3ddc84';
const CYAN = '#38e1ff';
const AMBER = '#e7c368';
const RED = '#ff6b6b';

const GLASS: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(10,26,18,0.62), rgba(4,12,9,0.55))',
  backdropFilter: 'blur(22px) saturate(1.5)',
  WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
  border: '1px solid rgba(61,220,132,0.16)',
  borderRadius: 16,
  boxShadow: '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 24px rgba(61,220,132,0.05)',
};

function Sigil({ children, color = ACCENT }: { children: React.ReactNode; color?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" style={{ filter: `drop-shadow(0 0 5px ${color}66)` }}>
      {children}
    </svg>
  );
}

const ICONS = {
  chip: (
    <Sigil>
      <rect x="5" y="5" width="16" height="16" rx="3" stroke={ACCENT} strokeWidth="1.4" />
      <rect x="10" y="10" width="6" height="6" rx="1.5" stroke={ACCENT} strokeWidth="1.2" />
      <path d="M9 2v3M17 2v3M9 21v3M17 21v3M2 9h3M2 17h3M21 9h3M21 17h3" stroke={ACCENT} strokeWidth="1.2" strokeLinecap="round" />
    </Sigil>
  ),
  wave: (
    <Sigil color={CYAN}>
      <path d="M2 13h3l2-6 3 12 3-9 2 4 2-1h7" stroke={CYAN} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Sigil>
  ),
  pulse: (
    <Sigil color={AMBER}>
      <path d="M2 13h5l3-8 4 16 3-8h7" stroke={AMBER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Sigil>
  ),
  nodes: (
    <Sigil>
      <circle cx="6" cy="6" r="2.4" stroke={ACCENT} strokeWidth="1.3" />
      <circle cx="20" cy="9" r="2.4" stroke={ACCENT} strokeWidth="1.3" />
      <circle cx="11" cy="20" r="2.4" stroke={ACCENT} strokeWidth="1.3" />
      <path d="M8 7.5l9.5 1M7 8l3.5 9.5M18.5 11l-6 7" stroke={ACCENT} strokeWidth="1" opacity="0.6" />
    </Sigil>
  ),
  db: (
    <Sigil color={CYAN}>
      <ellipse cx="13" cy="6" rx="8" ry="3" stroke={CYAN} strokeWidth="1.3" />
      <path d="M5 6v7c0 1.7 3.6 3 8 3s8-1.3 8-3V6" stroke={CYAN} strokeWidth="1.3" />
      <path d="M5 13v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" stroke={CYAN} strokeWidth="1.3" opacity="0.55" />
    </Sigil>
  ),
};

function Sparkline({ points, color, height = 22 }: { points: { timestamp: number; value: number }[]; color: string; height?: number }) {
  if (points.length < 2) return <div style={{ height, opacity: 0.25 }} />;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const w = 100;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - 2 - ((p.value - min) / span) * (height - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" opacity="0.9" />
      <path d={`${d} L${w},${height} L0,${height} Z`} fill={color} opacity="0.08" />
    </svg>
  );
}

function Card({
  icon, title, value, sub, accent = ACCENT, children,
}: {
  icon: React.ReactNode; title: string; value: React.ReactNode; sub?: React.ReactNode;
  accent?: string; children?: React.ReactNode;
}) {
  return (
    <div style={{
      ...GLASS,
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {icon}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'rgba(232,240,242,0.5)', textTransform: 'uppercase' }}>{title}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#e8f0f2', fontFamily: '"SF Mono", Menlo, monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value}
          </div>
        </div>
      </div>
      {children}
      {sub && <div style={{ fontSize: 10, color: 'rgba(159,180,172,0.75)', letterSpacing: '0.04em' }}>{sub}</div>}
    </div>
  );
}

export default function CortexStatusDeck({ speaking }: { speaking: boolean }) {
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<ObservabilityMetrics | null>(null);
  const [lane, setLane] = useState<LaneLeader | null>(null);
  const [agents, setAgents] = useState<AgentSummary | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    const hud = getCortexObservabilityHUD();
    const unsub = hud.subscribe((m) => setMetrics(m));
    return unsub;
  }, []);

  useEffect(() => {
    let dead = false;
    const poll = async () => {
      try {
        const [mh, ag] = await Promise.all([
          fetch('/api/cortex/models/health', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch('/api/cortex/agents/state', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (dead) return;
        const models = mh?.models || [];
        const fast = models.filter((m: any) => (m.tierFit || []).includes('fast'));
        const usable = fast
          .filter((m: any) => m.status !== 'down' && !(m.cooldownUntil && m.cooldownUntil > Date.now()))
          .sort((a: any, b: any) => (a.latencyMsP50 ?? 60000) - (b.latencyMsP50 ?? 60000));
        const top = usable[0];
        setLane(top ? {
          provider: top.provider, model: String(top.id || '').split('/').pop() || top.id,
          latencyMs: top.latencyMsP50 ?? null, healthy: usable.length, total: fast.length,
        } : null);
        const list = ag?.agents || [];
        setAgents({
          total: list.length,
          busy: list.filter((a: any) => a.status && a.status !== 'idle' && a.status !== 'offline').length,
        });
      } catch { }
    };
    void poll();
    pollRef.current = window.setInterval(poll, 15000);
    return () => { dead = true; if (pollRef.current) window.clearInterval(pollRef.current); };
  }, []);

  const voiceMs = metrics?.voiceLatencyMs ?? null;
  const apiMs = metrics?.apiLatencyMs ?? null;
  const storagePct = metrics?.storageUsagePercent ?? null;
  const pressure = metrics?.indexedDbPressure;
  const vfe = metrics?.variationalFreeEnergy ?? null;

  const pressureColor = pressure === 'critical' ? RED : pressure === 'warning' ? AMBER : ACCENT;

  return (
    <div style={{ position: 'absolute', top: 18, right: 18, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{
          ...GLASS,
          padding: '9px 16px', cursor: 'pointer',
          color: ACCENT, fontSize: 11, letterSpacing: '0.24em',
          fontFamily: '"SF Mono", Menlo, monospace',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
        title="Systems deck"
      >
        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: speaking ? CYAN : ACCENT, boxShadow: `0 0 8px ${speaking ? CYAN : ACCENT}`, animation: speaking ? 'cortexPulse 1s ease-in-out infinite' : 'none' }} />
        {open ? 'CLOSE SYSTEMS' : 'SYSTEMS'}
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            ...GLASS,
            padding: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
            width: 'min(560px, calc(100vw - 140px))',
          }}
        >
          <Card
            icon={ICONS.chip}
            title="LLM Lane"
            value={lane ? lane.model : '—'}
            sub={lane ? `${lane.provider} · p50 ${lane.latencyMs ?? '?'}ms · ${lane.healthy}/${lane.total} healthy` : 'matrix offline'}
            accent={lane ? ACCENT : 'rgba(159,180,172,0.5)'}
          >
            {metrics?.apiLatencyHistory?.length ? (
              <Sparkline points={metrics.apiLatencyHistory.slice(-20)} color={CYAN} />
            ) : null}
          </Card>

          <Card
            icon={ICONS.wave}
            title="Voice TTF"
            value={voiceMs != null ? `${voiceMs}ms` : '—'}
            sub={speaking ? 'speaking now' : 'streaming PCM · pocket-clone'}
            accent={voiceMs != null && voiceMs < 1500 ? ACCENT : voiceMs != null && voiceMs < 3500 ? AMBER : voiceMs != null ? RED : 'rgba(159,180,172,0.5)'}
          >
            {metrics?.voiceLatencyHistory?.length ? (
              <Sparkline points={metrics.voiceLatencyHistory.slice(-20)} color={CYAN} />
            ) : null}
          </Card>

          <Card
            icon={ICONS.pulse}
            title="API Latency"
            value={apiMs != null ? `${apiMs}ms` : '—'}
            sub={metrics?.healthStatus?.api ? `status: ${metrics.healthStatus.api}` : undefined}
            accent={apiMs != null && apiMs < 2000 ? ACCENT : apiMs != null && apiMs < 6000 ? AMBER : apiMs != null ? RED : 'rgba(159,180,172,0.5)'}
          >
            {metrics?.apiLatencyHistory?.length ? (
              <Sparkline points={metrics.apiLatencyHistory.slice(-20)} color={AMBER} />
            ) : null}
          </Card>

          <Card
            icon={ICONS.nodes}
            title="Agent Fleet"
            value={agents ? `${agents.busy} busy / ${agents.total}` : '—'}
            sub={agents && agents.busy > 0 ? 'missions in flight' : 'all hands idle'}
          />

          <Card
            icon={ICONS.db}
            title="Storage"
            value={storagePct != null ? `${storagePct}%` : '—'}
            sub={pressure ? `IDB pressure: ${pressure}` : undefined}
            accent={pressureColor}
          />

          {vfe != null && (
            <Card
              icon={
                <Sigil color={AMBER}>
                  <path d="M13 3l8 14H5l8-14z" stroke={AMBER} strokeWidth="1.3" strokeLinejoin="round" fill="none" />
                  <circle cx="13" cy="14" r="1.6" fill={AMBER} />
                </Sigil>
              }
              title="Free Energy"
              value={vfe.toFixed(2)}
              sub="variational surprise"
              accent={AMBER}
            />
          )}
        </div>
      )}

      <style>{`@keyframes cortexPulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: 0.4; transform: scale(0.75);} }`}</style>
    </div>
  );
}
