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

const stanceColor = (s: string) => s === 'go' ? '#34d399' : s === 'no-go' ? '#f87171' : s === 'conditional' ? '#fbbf24' : 'rgba(148,163,184,0.5)';

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

        {/* The Crew */}
        <Section title="THE CREW (YOU, CHRIS)" right={<span style={{ fontSize: 7, color: '#fbbf24', letterSpacing: '0.15em' }}>● FINAL GO / NO-GO AUTHORITY</span>}>
          <div style={{ display: 'flex', gap: 18, fontSize: 8, color: DIM, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>AUTHORITY — <span style={{ color: '#fbbf24', fontWeight: 700 }}>HOLDS VETO</span></span>
            <span>CLEARANCE LANE — <span style={{ color: '#a5f3fc' }}>APPROVES HARD-LANE ONLY</span></span>
            <span>STATUS — <span style={{ color: '#34d399' }}>● COCKPIT COMMAND ACTIVE</span></span>
          </div>
        </Section>

        {/* Flight Director */}
        <Section title="FLIGHT DIRECTOR — CORTEX CORE">
          <div style={{ display: 'flex', gap: 18, fontSize: 8, color: DIM, flexWrap: 'wrap' }}>
            <span>CONSOLE — <span style={{ color: '#34d399' }}>● NOMINAL</span></span>
            <span>MANDATE — Owns the console. Decides, never flies the mission herself.</span>
            <span>INSTANCE — {data?.worldState?.topology?.instance?.toUpperCase() || 'MAC'}</span>
            <span>ORACLE (TDRS) — {data?.worldState?.fleet?.oracleAlive ? '● LINKED' : '○ DOWN'}</span>
            <span>OPEN INCIDENTS — {data?.incidents?.open ?? 0}</span>
          </div>
        </Section>

        {/* Console positions */}
        <Section title="CONSOLE POSITIONS — THE COUNSEL ROSTER" right={<span style={{ fontSize: 7, color: 'rgba(165,243,252,0.6)' }}>APOLLO MISSION CONTROL MAPPING</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6 }}>
            {(data?.consoles || []).map(c => (
              <div key={c.id} style={{
                border: '1px solid rgba(103,232,249,0.14)', borderRadius: 3,
                padding: '7px 10px', background: 'rgba(103,232,249,0.03)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 8, letterSpacing: '0.15em', color: 'rgba(165,243,252,0.9)', fontWeight: 700 }}>{c.callSign}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 7, color: DIM }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: LAMP_COLOR[c.lamp] || LAMP_COLOR.idle, boxShadow: c.lamp === 'working' ? '0 0 6px #34d399' : 'none' }} />
                    {(c.agentStatus || c.lamp).toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 7, color: 'rgba(203,213,225,0.7)', marginTop: 3 }}>{c.id.toUpperCase()} — {c.role}</div>
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

        {/* Active counsel sessions — expandable with full lifecycle controls */}
        <Section title="COUNSEL IN SESSION" right={<span style={{ fontSize: 7, color: DIM }}>{(data?.activeSessions || []).length} OPEN</span>}>
          {(data?.activeSessions || []).length === 0 && <div style={{ fontSize: 8, color: DIM }}>No sessions in session. Convene one below.</div>}
          {(data?.activeSessions || []).map(s => (
            <SessionCard key={s.id} session={s} onAction={async (action, extra) => {
              await post('/api/cortex/counsel/action', { action, sessionId: s.id, ...extra });
              refresh();
            }} onSynthesize={async () => {
              await post('/api/cortex/agents/task', {
                agentId: 'strategist', kind: 'counsel_synthesize',
                title: `Synthesize counsel ${s.id}`,
                input: { sessionId: s.id },
              });
              refresh();
            }} />
          ))}
        </Section>

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
            <button
              disabled={busy || !question.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await post('/api/cortex/agents/task', {
                    agentId: 'strategist', kind: 'counsel_convene',
                    title: `Convene counsel: ${question.trim().slice(0, 80)}`,
                    input: { question: question.trim(), lane },
                  });
                  setQuestion(''); refresh();
                } finally { setBusy(false); }
              }}
              style={btnStyle('#a78bfa', busy || !question.trim())}
              title="STRATEGIST convenes with auto world-state brief"
            >VIA STRATEGIST</button>
          </div>
          <div style={{ fontSize: 7, color: DIM, marginTop: 5 }}>
            Positions file via POST /api/cortex/counsel/action or the positions drop-folder. Counsel advises — it never decides.
          </div>
        </Section>

        {/* Missions (Pipelines = Products) */}
        <Section title="MISSIONS — PIPELINES = PRODUCTS (SHYNED, LAWBOT, STORES)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
            <div style={{ border: '1px solid rgba(251,191,36,0.18)', borderRadius: 3, padding: '6px 9px', background: 'rgba(251,191,36,0.03)' }}>
              <div style={{ fontSize: 8, color: '#fbbf24', fontWeight: 700 }}>SHYNED PRODUCT LINE</div>
              <div style={{ fontSize: 7, color: DIM, marginTop: 2 }}>High-velocity automated venture pipeline</div>
            </div>
            <div style={{ border: '1px solid rgba(56,189,248,0.18)', borderRadius: 3, padding: '6px 9px', background: 'rgba(56,189,248,0.03)' }}>
              <div style={{ fontSize: 8, color: '#38bdf8', fontWeight: 700 }}>LAWBOT COMPLIANCE</div>
              <div style={{ fontSize: 7, color: DIM, marginTop: 2 }}>Audit & legal verification pipeline</div>
            </div>
            <div style={{ border: '1px solid rgba(52,211,153,0.18)', borderRadius: 3, padding: '6px 9px', background: 'rgba(52,211,153,0.03)' }}>
              <div style={{ fontSize: 8, color: '#34d399', fontWeight: 700 }}>OMNI STORE SYNDICATION</div>
              <div style={{ fontSize: 7, color: DIM, marginTop: 2 }}>Chrome · Edge · Firefox · WebStores</div>
            </div>
          </div>
          {(data?.missions || []).length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 7, color: DIM, flexWrap: 'wrap' }}>
              {(data?.missions || []).map((m, i) => (
                <span key={i}>{m.name.toUpperCase()} [{m.status.toUpperCase()} ×{m.count}]</span>
              ))}
            </div>
          )}
        </Section>

        {/* Ground Segment (Mac + Oracle = TDRS Satellite + Local Tower) */}
        <Section title="GROUND SEGMENT (MAC + ORACLE = TDRS SATELLITE + LOCAL TOWER)" right={<span style={{ fontSize: 7, color: data?.worldState?.fleet?.oracleAlive ? '#34d399' : '#fbbf24' }}>● DUAL-TOPOLOGY</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ border: '1px solid rgba(103,232,249,0.14)', borderRadius: 3, padding: '7px 10px', background: 'rgba(103,232,249,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#a5f3fc' }}>LOCAL TOWER — MAC HOST</span>
                <span style={{ fontSize: 7, color: '#34d399' }}>● LOCAL PRIMARY</span>
              </div>
              <div style={{ fontSize: 7, color: DIM, marginTop: 3 }}>Desktop runtime · Local files & workspace · Voice loop</div>
            </div>
            <div style={{ border: '1px solid rgba(103,232,249,0.14)', borderRadius: 3, padding: '7px 10px', background: 'rgba(103,232,249,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#a5f3fc' }}>TDRS SATELLITE — ORACLE CLOUD</span>
                <span style={{ fontSize: 7, color: data?.worldState?.fleet?.oracleAlive ? '#34d399' : '#f87171' }}>
                  {data?.worldState?.fleet?.oracleAlive ? '● ORBIT LINKED' : '○ DEGRADED'}
                </span>
              </div>
              <div style={{ fontSize: 7, color: DIM, marginTop: 3 }}>Remote autonomous compute node · SWR telemetry sync</div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};

// ── Session card: expandable lifecycle controls ─────────────────────────────

interface SessionSummary {
  id: string; question: string; status: string; lane: string;
  members: string[]; positionsFiled: number; ageMinutes: number;
}
interface FullSession {
  id: string; question: string; status: string; lane: string; members: string[];
  positions: { member: string; stance: string; confidence: number; round: number; keyEvidence: string[]; reasoning: string }[];
}

const SessionCard: React.FC<{
  session: SessionSummary;
  onAction: (action: string, extra?: any) => Promise<void>;
  onSynthesize: () => Promise<void>;
}> = ({ session, onAction, onSynthesize }) => {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState<FullSession | null>(null);
  const [member, setMember] = useState(session.members[0] || '');
  const [stance, setStance] = useState<'go' | 'no-go' | 'conditional'>('go');
  const [confidence, setConfidence] = useState('0.7');
  const [evidence, setEvidence] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await fetch(`/api/cortex/counsel/session?id=${session.id}`, { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setFull(j.session);
    } catch {}
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !full) load();
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await load(); } finally { setBusy(false); }
  };

  const filePos = () => run(async () => {
    await onAction('position', {
      position: {
        member, stance, confidence: parseFloat(confidence) || 0.5,
        keyEvidence: evidence.split('\n').map((s) => s.trim()).filter(Boolean),
        reasoning,
      },
    });
    setEvidence(''); setReasoning('');
  });

  const statusColor = session.status === 'poll' ? '#fbbf24' : session.status === 'positions' ? '#38bdf8' : '#34d399';
  const canFile = ['positions', 'rebuttal'].includes(session.status);

  return (
    <div style={{ border: '1px solid rgba(103,232,249,0.15)', borderRadius: 3, marginBottom: 5, background: 'rgba(103,232,249,0.02)' }}>
      <div onClick={toggle} style={{ padding: '7px 10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 9, color: 'rgba(226,232,240,0.9)' }}>{session.question}</span>
        <span style={{ fontSize: 7, color: statusColor, whiteSpace: 'nowrap' }}>
          {session.id} · {session.status.toUpperCase()} · {session.positionsFiled}/{session.members.length} POS · {session.ageMinutes}m {open ? '▾' : '▸'}
        </span>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid rgba(103,232,249,0.12)', padding: '8px 10px' }}>
          {/* Positions filed */}
          {(full?.positions || []).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {(full!.positions).map((p, i) => (
                <div key={i} style={{ fontSize: 8, color: DIM, padding: '2px 0', display: 'flex', gap: 8 }}>
                  <span style={{ color: stanceColor(p.stance), minWidth: 62 }}>{p.member.toUpperCase()} R{p.round}</span>
                  <span style={{ color: 'rgba(203,213,225,0.85)' }}>{p.stance.toUpperCase()} {Math.round(p.confidence * 100)}%</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8 }}>{p.reasoning}</span>
                </div>
              ))}
            </div>
          )}

          {/* Lifecycle controls */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {session.status === 'positions' && (
              <button disabled={busy} onClick={() => run(() => onAction('rebuttal_open'))} style={btnStyle('#38bdf8', busy)}>OPEN REBUTTAL</button>
            )}
            {session.status === 'rebuttal' && (
              <button disabled={busy} onClick={() => run(() => onAction('rebuttal_close'))} style={btnStyle('#38bdf8', busy)}>CLOSE REBUTTAL → SYNTHESIS</button>
            )}
            {session.status === 'synthesis' && (
              <button disabled={busy} onClick={() => run(onSynthesize)} style={btnStyle('#a78bfa', busy)}>▶ REQUEST SYNTHESIS (STRATEGIST)</button>
            )}
            {['positions', 'rebuttal', 'synthesis'].includes(session.status) && (
              <button disabled={busy} onClick={() => run(() => onAction('cancel'))} style={btnStyle('#f87171', busy)}>CANCEL</button>
            )}
          </div>

          {/* File position form */}
          {canFile && (
            <div style={{ borderTop: '1px dashed rgba(103,232,249,0.15)', paddingTop: 8 }}>
              <div style={{ fontSize: 7, letterSpacing: '0.2em', color: 'rgba(165,243,252,0.6)', marginBottom: 5 }}>FILE POSITION</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
                <select value={member} onChange={e => setMember(e.target.value)} style={inputStyle}>
                  {session.members.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
                <select value={stance} onChange={e => setStance(e.target.value as any)} style={inputStyle}>
                  <option value="go">GO</option>
                  <option value="no-go">NO-GO</option>
                  <option value="conditional">CONDITIONAL</option>
                </select>
                <input value={confidence} onChange={e => setConfidence(e.target.value)} placeholder="conf" style={{ ...inputStyle, width: 52 }} />
              </div>
              <textarea value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="key evidence (one per line — required)" rows={2}
                style={{ ...inputStyle, width: '100%', resize: 'vertical', marginBottom: 5 }} />
              <input value={reasoning} onChange={e => setReasoning(e.target.value)} placeholder="reasoning (≤400 chars)" style={{ ...inputStyle, width: '100%', marginBottom: 5 }} />
              <button disabled={busy || !evidence.trim() || !reasoning.trim()} onClick={filePos} style={btnStyle('#34d399', busy || !evidence.trim() || !reasoning.trim())}>
                FILE POSITION
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(103,232,249,0.05)', border: '1px solid rgba(103,232,249,0.2)',
  borderRadius: 2, color: INK, fontFamily: MONO, fontSize: 8, padding: '4px 6px', outline: 'none',
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
