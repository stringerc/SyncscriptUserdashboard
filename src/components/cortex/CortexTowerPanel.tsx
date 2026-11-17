/**
 * CortexTowerPanel — "Mission Control" command board for the Nexus Foundry.
 *
 * 2D overlay on the agents deck showing the counsel/hierarchy layer:
 * Flight Director status, console positions (counsel roster), Go/No-Go
 * polls awaiting human clearance, and the proposals clearance queue.
 * Data: GET /api/cortex/tower (composed read-only board model).
 * Mutations: only through existing counsel/proposal endpoints.
 */

import React, { useEffect, useState } from 'react';

const MONO = "'IBM Plex Mono', monospace";
const INK = '#e0f2fe';
const DIM = 'rgba(148,163,184,0.55)';

interface TowerData {
  ok: boolean;
  checkedAt: string;
  worldState?: { header: string; topology?: { instance: string }; fleet?: { oracleAlive: boolean } };
  flightDirector?: { status: string; header: string };
  consoles?: { id: string; callSign: string; role: string; lamp: string; agentStatus?: string; counselSessions: number }[];
  polls?: { id: string; question: string; lane: string; ageMinutes: number; poll: { counts: any; stances: any[] }; synthesis?: any }[];
  activeSessions?: { id: string; question: string; status: string; lane: string; members: string[]; positionsFiled: number; ageMinutes: number }[];
  clearanceQueue?: { id: string; title: string; agentId: string; waitMinutes: number }[];
  missions?: { name: string; status: string; count: number }[];
  incidents?: { open: number };
}

const LAMP_COLOR: Record<string, string> = {
  working: '#34d399', busy: '#34d399', active: '#34d399',
  idle: 'rgba(148,163,184,0.5)', offline: 'rgba(100,116,139,0.6)',
  error: '#f87171', manual: '#fbbf24',
};

async function post(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export const CortexTowerPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [data, setData] = useState<TowerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [lane, setLane] = useState<'contained' | 'reversible' | 'hard'>('reversible');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const res = await fetch('/api/cortex/tower', { cache: 'no-store' });
      const j = await res.json();
      if (j.ok) { setData(j); setError(null); }
      else setError(j.error || 'tower read failed');
    } catch (e: any) {
      setError(e?.message || 'tower unreachable');
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const convene = async () => {
    if (!question.trim() || busy) return;
    setBusy(true);
    try {
      await post('/api/cortex/counsel/sessions', { question: question.trim(), lane });
      setQuestion('');
      refresh();
    } finally { setBusy(false); }
  };

  const decide = async (sessionId: string, decision: 'go' | 'no-go') => {
    await post('/api/cortex/counsel/action', { action: 'decide', sessionId, decision, by: 'foundry-board' });
    refresh();
  };

  const Section: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, right, children }) => (
    <div style={{ borderTop: '1px solid rgba(103,232,249,0.14)', padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 8, letterSpacing: '0.3em', color: 'rgba(165,243,252,0.7)', fontFamily: MONO, fontWeight: 700 }}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  );

  const stanceColor = (s: string) => s === 'go' ? '#34d399' : s === 'no-go' ? '#f87171' : s === 'conditional' ? '#fbbf24' : 'rgba(148,163,184,0.5)';

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      background: 'rgba(2,3,8,0.92)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO,
    }}>
      <div style={{
        width: 'min(860px, 92vw)', maxHeight: '88vh', overflowY: 'auto',
        background: 'linear-gradient(170deg, rgba(8,14,26,0.97), rgba(4,7,14,0.97))',
        border: '1px solid rgba(103,232,249,0.25)', borderRadius: 4,
        boxShadow: '0 0 60px rgba(103,232,249,0.12), inset 0 0 40px rgba(103,232,249,0.03)',
        padding: '18px 22px', color: INK,
      }} className="ambient-scrollbar">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 14, letterSpacing: '0.4em', fontWeight: 700, color: 'rgba(224,242,254,0.95)', textShadow: '0 0 14px rgba(103,232,249,0.5)' }}>
              MISSION CONTROL
            </div>
            <div style={{ fontSize: 8, letterSpacing: '0.25em', color: DIM, marginTop: 3 }}>
              {data?.worldState?.header || 'ACQUIRING TELEMETRY…'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid rgba(103,232,249,0.3)', color: DIM,
            fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', padding: '4px 10px',
            cursor: 'pointer', borderRadius: 2,
          }}>✕ CLOSE</button>
        </div>
        {error && <div style={{ fontSize: 9, color: '#f87171', margin: '6px 0' }}>TELEMETRY ERROR: {error}</div>}

        {/* Flight Director */}
        <Section title="FLIGHT DIRECTOR">
          <div style={{ display: 'flex', gap: 18, fontSize: 9, color: DIM, flexWrap: 'wrap' }}>
            <span>CORTEX CORE — <span style={{ color: '#34d399' }}>● NOMINAL</span></span>
            <span>INSTANCE — {data?.worldState?.topology?.instance?.toUpperCase() || '—'}</span>
            <span>ORACLE — {data?.worldState?.fleet?.oracleAlive ? '● UP' : '○ DOWN'}</span>
            <span>OPEN INCIDENTS — {data?.incidents?.open ?? '—'}</span>
          </div>
        </Section>

        {/* Console positions */}
        <Section title="CONSOLE POSITIONS — THE COUNSEL ROSTER">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 6 }}>
            {(data?.consoles || []).map(c => (
              <div key={c.id} style={{
                border: '1px solid rgba(103,232,249,0.12)', borderRadius: 3,
                padding: '6px 9px', background: 'rgba(103,232,249,0.03)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 8, letterSpacing: '0.15em', color: 'rgba(165,243,252,0.8)', fontWeight: 700 }}>{c.callSign}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 7, color: DIM }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: LAMP_COLOR[c.lamp] || LAMP_COLOR.idle, boxShadow: c.lamp === 'working' ? '0 0 6px #34d399' : 'none' }} />
                    {(c.agentStatus || c.lamp).toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 7, color: DIM, marginTop: 3 }}>{c.id.toUpperCase()} — {c.role}</div>
                {c.counselSessions > 0 && <div style={{ fontSize: 7, color: '#fbbf24', marginTop: 2 }}>{c.counselSessions} SESSION{c.counselSessions > 1 ? 'S' : ''}</div>}
              </div>
            ))}
          </div>
        </Section>

        {/* GO/NO-GO polls */}
        <Section title="GO / NO-GO — AWAITING YOUR CLEARANCE" right={<span style={{ fontSize: 7, color: DIM }}>{(data?.polls || []).length} OPEN</span>}>
          {(data?.polls || []).length === 0 && <div style={{ fontSize: 8, color: DIM }}>No polls awaiting decision.</div>}
          {(data?.polls || []).map(p => (
            <div key={p.id} style={{ border: '1px solid rgba(251,191,36,0.25)', borderRadius: 3, padding: '8px 10px', marginBottom: 6, background: 'rgba(251,191,36,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 9, color: INK }}>{p.question}</span>
                <span style={{ fontSize: 7, color: DIM, whiteSpace: 'nowrap' }}>{p.id} · {p.lane.toUpperCase()} · {p.ageMinutes}m</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {p.poll.stances.map((s: any) => (
                  <span key={s.member} style={{ fontSize: 8, color: stanceColor(s.stance) }}>
                    {s.member.toUpperCase()}: {s.stance.toUpperCase()}{typeof s.confidence === 'number' ? ` ${Math.round(s.confidence * 100)}%` : ''}
                  </span>
                ))}
                <span style={{ fontSize: 8, color: DIM }}>
                  [{p.poll.counts.go} GO · {p.poll.counts.noGo} NO-GO · {p.poll.counts.conditional} COND · {p.poll.counts.noResponse} NR]
                </span>
              </div>
              {p.synthesis?.text && <div style={{ fontSize: 8, color: 'rgba(203,213,225,0.8)', marginTop: 6, lineHeight: 1.5 }}>{p.synthesis.text}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => decide(p.id, 'go')} style={btnStyle('#34d399')}>● GO</button>
                <button onClick={() => decide(p.id, 'no-go')} style={btnStyle('#f87171')}>● NO-GO</button>
              </div>
            </div>
          ))}
        </Section>

        {/* Active counsel sessions */}
        {(data?.activeSessions || []).length > 0 && (
          <Section title="COUNSEL IN SESSION">
            {(data?.activeSessions || []).map(s => (
              <div key={s.id} style={{ fontSize: 8, color: DIM, padding: '3px 0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(203,213,225,0.85)' }}>{s.question}</span>
                <span>{s.id} · {s.status.toUpperCase()} · {s.positionsFiled}/{s.members.length} POSITIONS · {s.ageMinutes}m</span>
              </div>
            ))}
          </Section>
        )}

        {/* Clearance queue (proposals) */}
        <Section title="CLEARANCE QUEUE — PROPOSALS" right={<span style={{ fontSize: 7, color: DIM }}>{(data?.clearanceQueue || []).length} PENDING</span>}>
          {(data?.clearanceQueue || []).length === 0 && <div style={{ fontSize: 8, color: DIM }}>Queue clear.</div>}
          {(data?.clearanceQueue || []).map(p => (
            <div key={p.id} style={{ fontSize: 8, color: DIM, padding: '3px 0', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: 'rgba(203,213,225,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
              <span style={{ whiteSpace: 'nowrap', color: p.waitMinutes > 120 ? '#f87171' : DIM }}>WAITING {p.waitMinutes}m</span>
            </div>
          ))}
        </Section>

        {/* Convene form */}
        <Section title="CONVENE COUNSEL">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && convene()}
              placeholder="Decision for the council…"
              style={{
                flex: 1, minWidth: 220, background: 'rgba(103,232,249,0.05)',
                border: '1px solid rgba(103,232,249,0.2)', borderRadius: 2,
                color: INK, fontFamily: MONO, fontSize: 9, padding: '6px 8px', outline: 'none',
              }}
            />
            <select value={lane} onChange={e => setLane(e.target.value as any)} style={{
              background: 'rgba(103,232,249,0.05)', border: '1px solid rgba(103,232,249,0.2)',
              borderRadius: 2, color: DIM, fontFamily: MONO, fontSize: 8, padding: '6px 6px',
            }}>
              <option value="contained">CONTAINED</option>
              <option value="reversible">REVERSIBLE</option>
              <option value="hard">HARD</option>
            </select>
            <button onClick={convene} disabled={busy || !question.trim()} style={btnStyle('#38bdf8', busy || !question.trim())}>
              {busy ? 'CONVENING…' : 'CONVENE'}
            </button>
          </div>
          <div style={{ fontSize: 7, color: DIM, marginTop: 5 }}>
            Positions file via POST /api/cortex/counsel/action or the positions drop-folder. Counsel advises — it never decides.
          </div>
        </Section>

        {/* Missions */}
        <Section title="MISSIONS — PIPELINE HEALTH">
          {(data?.missions || []).length === 0 && <div style={{ fontSize: 8, color: DIM }}>No pipeline telemetry.</div>}
          {(data?.missions || []).map((m, i) => (
            <div key={i} style={{ fontSize: 8, color: DIM, padding: '2px 0' }}>
              {m.name.toUpperCase()} — {m.status.toUpperCase()} ×{m.count}
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
};

function btnStyle(color: string, disabled = false) {
  return {
    background: disabled ? 'rgba(103,232,249,0.03)' : `${color}18`,
    border: `1px solid ${disabled ? 'rgba(103,232,249,0.12)' : color + '66'}`,
    color: disabled ? DIM : color,
    fontFamily: MONO, fontSize: 8, letterSpacing: '0.15em',
    padding: '4px 12px', cursor: disabled ? 'default' : 'pointer', borderRadius: 2,
  } as React.CSSProperties;
}

export default CortexTowerPanel;
