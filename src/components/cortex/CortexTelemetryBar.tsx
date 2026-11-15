import React, { useState } from 'react';
import { C } from './cortex-demo-helpers';

interface CortexTelemetryBarProps {
  proactiveAuditData: any;
  iitPhi: number;
  sendMessage: (overrideText?: string) => void;
}

export function CortexTelemetryBar({ proactiveAuditData, iitPhi, sendMessage }: CortexTelemetryBarProps) {
  const [expanded, setExpanded] = useState(false);

  const sysWarn = proactiveAuditData?.system?.status === 'warning';
  const prodWarn = (proactiveAuditData?.productivity?.duplicateCount > 0 || proactiveAuditData?.productivity?.unreadEmails > 1000);
  const phiLabel = iitPhi && (iitPhi as any).sampleCount >= 10
    ? `Φ ${(iitPhi as any).phi.toFixed(2)}`
    : (proactiveAuditData?.metacognitive ? `Φ ${proactiveAuditData.metacognitive.phi}` : 'Φ —');

  const wrapStyle: React.CSSProperties = {
    margin: '2px 16px',
    padding: '4px 10px',
    display: 'flex', gap: 8, flexWrap: 'wrap',
    alignItems: 'center',
    background: C.glass,
    border: `1px solid ${C.border}`,
    borderRadius: 2,
    backdropFilter: 'blur(10px)',
    fontSize: 10,
    fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
    flexShrink: 0,
  };

  // Collapsed: one quiet status line — expands on click into the 4 stream pills.
  if (!expanded) {
    return (
      <div style={wrapStyle}>
        <button
          onClick={() => setExpanded(true)}
          title="Expand proactive streams"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.dim, fontSize: 10, fontFamily: '"IBM Plex Mono", "SF Mono", monospace', padding: 0,
          }}
        >
          <span style={{ display: 'inline-flex', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sysWarn ? '#ef4444' : '#3b82f6' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: prodWarn ? '#eab308' : '#10b981' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#06b6d4' }} />
          </span>
          <span>
            {proactiveAuditData?.system ? `${proactiveAuditData.system.usedPercent}% RAM` : 'Host'}
            {' · '}
            {proactiveAuditData?.productivity ? `${proactiveAuditData.productivity.tabCount} tabs` : 'tabs'}
            {' · '}
            {proactiveAuditData?.codebase ? proactiveAuditData.codebase.branch : 'git'}
            {' · '}
            {phiLabel}
          </span>
          <span style={{ color: 'rgba(148,233,255,0.25)' }}>▸</span>
        </button>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <button
        onClick={() => setExpanded(false)}
        title="Collapse streams"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.text, fontWeight: 600, fontSize: 10, fontFamily: '"IBM Plex Mono", "SF Mono", monospace', padding: 0,
        }}
      >
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
        4 STREAMS ▾
      </button>

      {/* Stream 1: Host OS */}
      <button
        id="pill-stream-system"
        onClick={() => sendMessage("Give me a live breakdown of my host computer memory, load, and battery health.")}
        title="Stream 1: Host OS & Hardware Hygiene"
        style={{
          background: sysWarn ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.12)',
          border: `1px solid ${sysWarn ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.3)'}`,
          borderRadius: 4,
          padding: '2px 7px',
          color: sysWarn ? '#fca5a5' : '#93c5fd',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <span>🖥️ Host:</span>
        <strong style={{ fontWeight: 600 }}>
          {proactiveAuditData?.system ? `${proactiveAuditData.system.usedPercent}% RAM (${proactiveAuditData.system.freeGB}GB free)` : 'Active'}
        </strong>
      </button>

      {/* Stream 2: Productivity */}
      <button
        id="pill-stream-productivity"
        onClick={() => sendMessage("Audit my open Chrome tabs, active windows, and unread notifications.")}
        title="Stream 2: Productivity & Context Awareness"
        style={{
          background: prodWarn ? 'rgba(234, 179, 8, 0.15)' : 'rgba(16, 185, 129, 0.12)',
          border: `1px solid ${prodWarn ? 'rgba(234, 179, 8, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
          borderRadius: 4,
          padding: '2px 7px',
          color: prodWarn ? '#fde047' : '#6ee7b7',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <span>📑 Productivity:</span>
        <strong style={{ fontWeight: 600 }}>
          {proactiveAuditData?.productivity ? `${proactiveAuditData.productivity.tabCount} Tabs${proactiveAuditData.productivity.unreadEmails ? ` · ${(proactiveAuditData.productivity.unreadEmails).toLocaleString()} Unreads` : ''}` : 'Tracking'}
        </strong>
      </button>

      {/* Stream 3: Codebase */}
      <button
        id="pill-stream-codebase"
        onClick={() => sendMessage("Check our git working tree, modified files, and test readiness.")}
        title="Stream 3: Codebase & Git Self-Healing"
        style={{
          background: 'rgba(168, 85, 247, 0.12)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: 4,
          padding: '2px 7px',
          color: '#d8b4fe',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <span>🌿 Git:</span>
        <strong style={{ fontWeight: 600 }}>
          {proactiveAuditData?.codebase ? `${proactiveAuditData.codebase.branch} (${proactiveAuditData.codebase.totalChanges} WIP)` : 'Synced'}
        </strong>
      </button>

      {/* Stream 4: Metacognitive */}
      <button
        id="pill-stream-metacognitive"
        onClick={() => sendMessage("Evaluate your internal metacognitive state, IIT Phi, and prompt tuning.")}
        title="Stream 4: Metacognitive Self-Tuning"
        style={{
          background: 'rgba(6, 182, 212, 0.12)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          borderRadius: 4,
          padding: '2px 7px',
          color: '#67e8f9',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <span>🔮 Metacognitive:</span>
        <strong style={{ fontWeight: 600 }}
          title={iitPhi && (iitPhi as any).sampleCount >= 10
            ? `IIT-Φ ${(iitPhi as any).phi.toFixed(3)} · 95% CI [${(iitPhi as any).confidenceInterval[0].toFixed(3)}, ${(iitPhi as any).confidenceInterval[1].toFixed(3)}] · ${(iitPhi as any).moduleCount} modules · confidence ${(iitPhi as any).confidence}`
            : 'IIT-Φ accumulating samples (needs ≥10 turns)'}>
          {iitPhi && (iitPhi as any).sampleCount >= 10
            ? `Φ ${(iitPhi as any).phi.toFixed(2)} · ${(iitPhi as any).confidence >= 0.5 ? 'Integrated' : 'Estimating'}`
            : phiLabel}
        </strong>
      </button>
    </div>
  );
}
