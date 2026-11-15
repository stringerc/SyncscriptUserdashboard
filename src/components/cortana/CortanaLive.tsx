import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { CortanaOrb } from './CortanaOrb';
import { useCortanaMood } from './CortanaMoodContext';
import { bridgeFetch } from './bridge-client';

// CortanaLive — full-screen holographic display at /cortana only

function DashboardOverlay({
  systemStatus,
  mood,
}: {
  systemStatus: {
    cpu: string;
    ram: string;
    netUp: string;
    netDown: string;
    battery: number | null;
    charging: boolean;
    status: string;
    uptime: string;
  };
  mood: string;
}) {
  const moodAccent: Record<string, string> = {
    idle: '#00ccff',
    listening: '#00eeff',
    speaking: '#00ffcc',
    thinking: '#cc44ff',
    alert: '#ff6644',
    urgent: '#ff3322',
  };
  const accentColor = moodAccent[mood] || '#00ccff';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: 24,
        color: accentColor,
        fontFamily: '"SF Mono", "Fira Code", monospace',
        fontSize: '13px',
        textShadow: `0 0 8px ${accentColor}55`,
        pointerEvents: 'none',
        userSelect: 'none',
        letterSpacing: '0.05em',
      }}
    >
      <div style={{ opacity: 0.6, marginBottom: 6 }}>/// SYSTEM STATUS ///</div>
      <div>
        CPU {systemStatus.cpu} &nbsp;│&nbsp; RAM {systemStatus.ram}
      </div>
      <div>
        NET ↑{systemStatus.netUp} ↓{systemStatus.netDown}
      </div>
      {systemStatus.battery != null && (
        <div>
          BAT {systemStatus.battery}%{systemStatus.charging ? ' charging' : ''}
        </div>
      )}
      <div style={{ marginTop: 4 }}>CORTANA &nbsp;{systemStatus.status}</div>
      <div style={{ opacity: 0.5, fontSize: '11px' }}>UP {systemStatus.uptime}</div>
    </div>
  );
}

const CortanaLive: React.FC = () => {
  const { mood } = useCortanaMood();
  const [systemStatus, setSystemStatus] = useState({
    cpu: '—',
    ram: '—',
    netUp: '—',
    netDown: '—',
    battery: null as number | null,
    charging: false,
    status: 'INITIALIZING',
    uptime: '—',
  });
  const [bridgeOnline, setBridgeOnline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delayMs = 3000;

    const pull = async () => {
      if (cancelled) return;
      try {
        const res = await bridgeFetch('/api/cortana/stats', { method: 'GET', timeoutMs: 3000 });
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          delayMs = 3000;
          setBridgeOnline(true);
          setSystemStatus({
            cpu: `${data.cpu.load1m.toFixed(1)} (${data.cpu.cores}C)`,
            ram: `${data.memory.usedGB}/${data.memory.totalGB}GB (${data.memory.usedPct}%)`,
            netUp: data.network.bytesOut,
            netDown: data.network.bytesIn,
            battery: data.battery?.percent ?? null,
            charging: data.battery?.charging ?? false,
            status: 'ONLINE',
            uptime: data.uptime,
          });
        } else {
          delayMs = Math.min(delayMs * 2, 30000);
          setBridgeOnline(false);
          setSystemStatus((prev) => ({ ...prev, status: 'BRIDGE ERROR' }));
        }
      } catch {
        delayMs = Math.min(delayMs * 2, 30000);
        if (!cancelled) {
          setBridgeOnline(false);
          setSystemStatus((prev) => ({
            ...prev,
            cpu: '—',
            ram: '—',
            netUp: '—',
            netDown: '—',
            status: 'BRIDGE OFFLINE',
            uptime: '—',
          }));
        }
      }
      if (!cancelled) {
        timer = setTimeout(() => {
          void pull();
        }, delayMs);
      }
    };

    void pull();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const moodAccent: Record<string, string> = {
    idle: '#00ccff',
    listening: '#00eeff',
    speaking: '#00ffcc',
    thinking: '#cc44ff',
    alert: '#ff6644',
    urgent: '#ff3322',
  };
  const c = moodAccent[mood] || '#00ccff';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 50%, #000a14 0%, #000408 50%, #000000 100%)',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <CortanaOrb mood={mood} />
      </Canvas>

      <DashboardOverlay systemStatus={systemStatus} mood={mood} />

      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: '"SF Mono", monospace',
          fontSize: '11px',
          color: bridgeOnline ? '#00ff88' : '#ff4444',
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: bridgeOnline ? '#00ff88' : '#ff4444',
            boxShadow: `0 0 6px ${bridgeOnline ? '#00ff88' : '#ff4444'}`,
          }}
        />
        {bridgeOnline ? 'BRIDGE' : 'OFFLINE'}
      </div>

      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          fontFamily: '"SF Mono", monospace',
          fontSize: '11px',
          color: c,
          opacity: 0.7,
          pointerEvents: 'none',
          userSelect: 'none',
          textShadow: `0 0 8px ${c}`,
          letterSpacing: '0.1em',
        }}
      >
        ◆ {mood.toUpperCase()}
      </div>
    </div>
  );
};

export default CortanaLive;
