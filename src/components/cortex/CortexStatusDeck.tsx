import React, { useEffect, useRef, useState } from 'react';
import { getCortexObservabilityHUD, type ObservabilityMetrics } from '../../lib/cortex-observability-hud';

/**
 * CortexStatusDeck — frosted-glass systems dashboard for /cortex.
 * Each subsystem card carries real Cortex key-art imagery with a duotone
 * grade + accent glow, live metric, and status pip. Polls the sentinel
 * matrix + agent fleet; subscribes to the observability HUD.
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

const GLASS: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(10,26,18,0.66), rgba(4,12,9,0.6))',
  backdropFilter: 'blur(24px) saturate(1.6)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
  border: '1px solid rgba(120,255,190,0.18)',
  borderRadius: 18,
  boxShadow: '0 18px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 32px rgba(61,220,132,0.06)',
};

const CARD_ART: Record<string, { img: string; hue: string; label: string }> = {
  llm:     { img: '/images/cortex_satc_nexus_foundry.jpg',        hue: '#38e1ff', label: 'LLM LANE' },
  voice:   { img: '/viz/assets/face.png',                          hue: '#3ddc84', label: 'VOICE TTF' },
  api:     { img: '/cortex_foundry_command_holodeck.jpg',          hue: '#e7c368', label: 'API' },
  agents:  { img: '/cortex_foundry_strategic_command_deck.jpg',    hue: '#c084fc', label: 'FLEET' },
  storage: { img: '/cortex_memory_bank_live.png',                  hue: '#ff8f6b', label: 'STORAGE' },
  vfe:     { img: '/cortex_foundry_panoramic_holodeck_live.png',   hue: '#ff6bcb', label: 'FREE ENERGY' },
  breath:  { img: '/cortex_foundry_strategic_command_deck.jpg',    hue: '#7ef0c8', label: 'BREATH' },
};

function StatusPip({ tone }: { tone: 'good' | 'warn' | 'bad' | 'idle' }) {
  const color = tone === 'good' ? '#3ddc84' : tone === 'warn' ? '#e7c368' : tone === 'bad' ? '#ff6b6b' : 'rgba(159,180,172,0.5)';
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%', background: color,
      boxShadow: `0 0 10px ${color}`,
      display: 'inline-block', flexShrink: 0,
    }} />
  );
}

function ArtCard({
  artKey, title, value, sub, tone,
}: {
  artKey: keyof typeof CARD_ART; title: string; value: React.ReactNode;
  sub?: React.ReactNode; tone: 'good' | 'warn' | 'bad' | 'idle';
}) {
  const art = CARD_ART[artKey];
  const hue = art.hue;
  return (
    <div style={{
      ...GLASS,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
    >
      {/* Art header — image graded into the card's accent hue */}
      <div style={{ position: 'relative', height: 74, overflow: 'hidden', flexShrink: 0 }}>
        <img
          src={art.img}
          alt=""
          draggable={false}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            filter: `saturate(1.35) contrast(1.15) hue-rotate(${hue === '#38e1ff' ? '-8deg' : hue === '#ff6bcb' ? '18deg' : '0deg'}) brightness(0.85)`,
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(180deg, ${hue}22 0%, rgba(4,12,9,0.35) 55%, rgba(4,12,9,0.92) 100%)`,
        }} />
        <div style={{
          position: 'absolute', left: 10, top: 8,
          fontSize: 8.5, letterSpacing: '0.3em', fontWeight: 600,
          color: hue, textShadow: `0 0 12px ${hue}88`,
          fontFamily: '"SF Mono", Menlo, monospace',
        }}>
          {art.label}
        </div>
        <div style={{ position: 'absolute', right: 10, top: 8 }}><StatusPip tone={tone} /></div>
      </div>

      {/* Metric body */}
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(232,240,242,0.45)', textTransform: 'uppercase' }}>{title}</div>
        <div style={{
          fontSize: 16, fontWeight: 700, color: '#f2fbf6',
          fontFamily: '"SF Mono", Menlo, monospace',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textShadow: `0 0 18px ${hue}33`,
        }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 9.5, color: 'rgba(159,180,172,0.8)', letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function CortexStatusDeck({ speaking }: { speaking: boolean }) {
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<ObservabilityMetrics | null>(null);
  const [lane, setLane] = useState<LaneLeader | null>(null);
  const [agents, setAgents] = useState<AgentSummary | null>(null);
  const [breath, setBreath] = useState<any>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    const unsub = getCortexObservabilityHUD().subscribe((m) => setMetrics(m));
    return unsub;
  }, []);

  useEffect(() => {
    let dead = false;
    const poll = async () => {
      try {
        const [mh, ag, br] = await Promise.all([
          fetch('/api/cortex/models/health', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch('/api/cortex/agents/state', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch('/api/cortex/breath', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (dead) return;
        const fast = (mh?.models || []).filter((m: any) => (m.tierFit || []).includes('fast'));
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
        setBreath(br?.active ? br : null);
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
  const health = metrics?.healthStatus;

  const tone = (ms: number | null, good: number, warn: number): 'good' | 'warn' | 'bad' | 'idle' =>
    ms == null ? 'idle' : ms < good ? 'good' : ms < warn ? 'warn' : 'bad';

  return (
    <div style={{ position: 'absolute', top: 62, right: 18, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{
          ...GLASS,
          padding: '10px 18px', cursor: 'pointer',
          color: '#3ddc84', fontSize: 11, letterSpacing: '0.26em', fontWeight: 600,
          fontFamily: '"SF Mono", Menlo, monospace',
          display: 'flex', alignItems: 'center', gap: 9,
        }}
        title="Systems deck"
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: speaking ? '#38e1ff' : '#3ddc84',
          boxShadow: `0 0 10px ${speaking ? '#38e1ff' : '#3ddc84'}`,
          animation: speaking ? 'cortexPulse 1s ease-in-out infinite' : 'none',
        }} />
        {open ? 'CLOSE' : 'SYSTEMS'}
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            ...GLASS,
            padding: 12,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: 10,
            width: 'min(680px, calc(100vw - 120px))',
            maxHeight: 'calc(100vh - 90px)',
            overflowY: 'auto',
          }}
        >
          <ArtCard
            artKey="llm" title="LLM Lane"
            value={lane ? lane.model : '—'}
            sub={lane ? `${lane.provider} · p50 ${lane.latencyMs ?? '?'}ms · ${lane.healthy}/${lane.total} healthy` : 'matrix offline'}
            tone={lane ? 'good' : 'idle'}
          />
          <ArtCard
            artKey="voice" title="Voice TTF"
            value={voiceMs != null ? `${voiceMs}ms` : '—'}
            sub={speaking ? 'speaking now · streaming PCM' : 'pocket-clone · oracle'}
            tone={tone(voiceMs, 1500, 3500)}
          />
          <ArtCard
            artKey="api" title="API Latency"
            value={apiMs != null ? `${apiMs}ms` : '—'}
            sub={health?.api ? `health: ${health.api}` : 'nexus-guest chain'}
            tone={tone(apiMs, 2000, 6000)}
          />
          <ArtCard
            artKey="agents" title="Agent Fleet"
            value={agents ? `${agents.busy}/${agents.total}` : '—'}
            sub={agents && agents.busy > 0 ? 'missions in flight' : 'all hands idle'}
            tone={agents && agents.busy > 0 ? 'good' : 'idle'}
          />
          <ArtCard
            artKey="storage" title="Storage"
            value={storagePct != null ? `${storagePct}%` : '—'}
            sub={pressure ? `IDB: ${pressure}` : 'indexeddb'}
            tone={pressure === 'critical' ? 'bad' : pressure === 'warning' ? 'warn' : 'good'}
          />
          {vfe != null && (
            <ArtCard
              artKey="vfe" title="Free Energy"
              value={vfe.toFixed(2)}
              sub="variational surprise"
              tone="idle"
            />
          )}
          {breath && (
            <ArtCard
              artKey="breath" title="Breath"
              value={breath.depth?.score != null ? breath.depth.score.toFixed(2) : '—'}
              sub={breath.alerts?.length
                ? breath.alerts[0]
                : `pred ${breath.depth?.predictionAccuracy?.toFixed(2) ?? '—'} · veto ${(100 * (breath.depth?.vetoRate ?? 0)).toFixed(0)}% · φ ${breath.depth?.integration?.toFixed(2) ?? '—'} · ${breath.depth?.episodes ?? 0} cycles`}
              tone={breath.alerts?.length ? 'warn' : breath.depth?.score >= 0.6 ? 'good' : 'idle'}
            />
          )}
        </div>
      )}

      <style>{`@keyframes cortexPulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: 0.4; transform: scale(0.75);} }`}</style>
    </div>
  );
}
