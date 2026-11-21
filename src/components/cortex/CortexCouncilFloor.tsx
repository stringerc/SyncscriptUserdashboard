/**
 * CortexCouncilFloor — living deliberation visualization for THE COUNSEL.
 *
 * Every element is computed from the live session payload — positions,
 * stances, confidence, phases, deadline. No decorative fake data:
 *   - council ring: one node per member, colored by latest stance,
 *     sized by confidence, pulsing while a fresh position is landing
 *   - stance bar: GO / CONDITIONAL / NO-GO segments from the poll board
 *   - tension: normalized entropy of the stance distribution — the
 *     council's real disagreement, not a mood ring
 *   - tempo: positions filed per minute since convening
 *   - phase rail: POSITIONS → REBUTTAL → POLL → VERDICT progression
 */

import React, { useMemo } from 'react';

const MONO = "'IBM Plex Mono', monospace";
const INK = '#e0f2fe';
const DIM = 'rgba(148,163,184,0.55)';

const STANCE_COLOR: Record<string, string> = {
  go: '#34d399',
  conditional: '#fbbf24',
  'no-go': '#f87171',
  'no-response': 'rgba(148,163,184,0.35)',
};
const PHASES = ['positions', 'rebuttal', 'poll', 'verdict'] as const;

interface FloorProps { session: any }

export function CortexCouncilFloor({ session: s }: FloorProps) {
  const positions: any[] = s.positions || [];
  const members: string[] = s.members || [];

  // Latest position per member (positions append chronologically).
  const latestByMember = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of positions) if (p?.member) m.set(p.member, p);
    return m;
  }, [positions]);

  const stanceTable = members.map((mem) => {
    const p = latestByMember.get(mem);
    return { member: mem, stance: p?.stance || 'no-response', confidence: p?.confidence };
  });
  const counts = {
    go: stanceTable.filter(x => x.stance === 'go').length,
    conditional: stanceTable.filter(x => x.stance === 'conditional').length,
    noGo: stanceTable.filter(x => x.stance === 'no-go').length,
    noResponse: stanceTable.filter(x => x.stance === 'no-response').length,
  };
  const responded = members.length - counts.noResponse;

  // Tension = normalized Shannon entropy over the responded stance split.
  // 0 = unanimous, 1 = maximally divided. Real math on real votes.
  const tension = useMemo(() => {
    if (responded < 2) return null;
    const probs = [counts.go, counts.conditional, counts.noGo]
      .filter(n => n > 0).map(n => n / responded);
    const H = -probs.reduce((a, p) => a + p * Math.log2(p), 0);
    const Hmax = Math.log2(Math.min(3, responded));
    return Hmax > 0 ? H / Hmax : 0;
  }, [counts.go, counts.conditional, counts.noGo, responded]);

  // Tempo: positions per minute since convening.
  const tempo = useMemo(() => {
    const elapsedMin = Math.max(1, (Date.now() - (s.createdAt || Date.now())) / 60000);
    return positions.length / elapsedMin;
  }, [positions.length, s.createdAt]);

  // Ring geometry
  const R = 62, CX = 80, CY = 80;
  const now = Date.now();
  const freshWindow = 90_000; // position considered "landing" for 90s

  const phaseIdx = PHASES.indexOf(s.status as any);
  const deadlinePct = s.positionDeadline
    ? Math.max(0, Math.min(100, 100 - ((s.positionDeadline - now) / (s.positionDeadline - (s.createdAt || now))) * 100))
    : null;

  return (
    <div style={{ border: '1px solid rgba(192,132,252,0.3)', borderRadius: 4, padding: '10px 12px', marginBottom: 8, background: 'linear-gradient(160deg, rgba(192,132,252,0.07), rgba(15,23,42,0.5))' }}>
      <style>{`@keyframes councilPulse{0%,100%{opacity:1}50%{opacity:.35}}@keyframes councilGlow{0%,100%{filter:drop-shadow(0 0 2px currentColor)}50%{filter:drop-shadow(0 0 7px currentColor)}}`}</style>

      {/* Phase rail + deadline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {PHASES.map((ph, i) => {
          const active = i === phaseIdx;
          const done = phaseIdx > i;
          return (
            <React.Fragment key={ph}>
              {i > 0 && <span style={{ color: 'rgba(148,163,184,0.3)', fontSize: 9 }}>→</span>}
              <span style={{
                fontSize: 8, fontWeight: 800, letterSpacing: '0.16em', fontFamily: MONO,
                color: active ? '#c084fc' : done ? '#34d399' : DIM,
                textShadow: active ? '0 0 8px rgba(192,132,252,0.8)' : 'none',
                animation: active ? 'councilPulse 1.6s ease-in-out infinite' : 'none',
              }}>{ph.toUpperCase()}</span>
            </React.Fragment>
          );
        })}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {deadlinePct != null && (
            <span style={{ width: 60, height: 3, background: 'rgba(148,163,184,0.15)', borderRadius: 2, display: 'inline-block', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${deadlinePct}%`, background: '#c084fc', transition: 'width 1s linear' }} />
            </span>
          )}
          <span style={{ fontSize: 8, color: DIM, fontFamily: MONO }}>{responded}/{members.length} SEATED</span>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {/* Council ring */}
        <svg width={160} height={160} viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(192,132,252,0.15)" strokeWidth="1" strokeDasharray="3 4" />
          {members.map((mem, i) => {
            const ang = (i / Math.max(1, members.length)) * Math.PI * 2 - Math.PI / 2;
            const x = CX + R * Math.cos(ang), y = CY + R * Math.sin(ang);
            const p = latestByMember.get(mem);
            const stance = p?.stance || 'no-response';
            const conf = typeof p?.confidence === 'number' ? p.confidence : 0.5;
            const fresh = p?.createdAt && now - p.createdAt < freshWindow;
            const rad = 4 + conf * 4;
            const color = STANCE_COLOR[stance] || STANCE_COLOR['no-response'];
            return (
              <g key={mem}>
                {fresh && <circle cx={x} cy={y} r={rad + 5} fill="none" stroke={color} strokeWidth="1" opacity="0.5" style={{ animation: 'councilPulse 0.9s ease-in-out infinite', transformOrigin: `${x}px ${y}px` }} />}
                <circle cx={x} cy={y} r={rad} fill={color} opacity={stance === 'no-response' ? 0.4 : 0.9}
                  style={{ animation: fresh ? 'councilGlow 1.2s ease-in-out infinite' : 'none', color }} />
                <text x={x} y={y + rad + 9} textAnchor="middle" fontSize="6.5" fontFamily={MONO} fill={DIM} letterSpacing="0.08em">
                  {String(mem).slice(0, 8).toUpperCase()}
                </text>
              </g>
            );
          })}
          {/* Tension readout at center */}
          <text x={CX} y={CY - 2} textAnchor="middle" fontSize="13" fontFamily={MONO} fontWeight="800" fill={INK}>
            {tension == null ? '—' : `${Math.round(tension * 100)}`}
          </text>
          <text x={CX} y={CY + 9} textAnchor="middle" fontSize="6" fontFamily={MONO} fill={DIM} letterSpacing="0.14em">TENSION</text>
        </svg>

        {/* Right column: stance bar + tempo + latest positions */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Stance bar */}
          <div style={{ display: 'flex', height: 14, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.2)', marginBottom: 4 }}>
            {([['go', counts.go], ['conditional', counts.conditional], ['no-go', counts.noGo]] as const).map(([k, n]) => (
              <div key={k} title={`${k}: ${n}`} style={{
                width: `${responded ? (n / responded) * 100 : 0}%`,
                background: STANCE_COLOR[k], opacity: n ? 0.85 : 0.08,
                transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 8.5, fontFamily: MONO, color: DIM, marginBottom: 8 }}>
            <span style={{ color: STANCE_COLOR.go }}>■ GO {counts.go}</span>
            <span style={{ color: STANCE_COLOR.conditional }}>■ COND {counts.conditional}</span>
            <span style={{ color: STANCE_COLOR['no-go'] }}>■ NO-GO {counts.noGo}</span>
            {counts.noResponse > 0 && <span>□ SILENT {counts.noResponse}</span>}
            <span style={{ marginLeft: 'auto' }}>{tempo.toFixed(1)}/min</span>
          </div>

          {/* Latest positions stream */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 90, overflow: 'hidden' }}>
            {[...positions].slice(-3).reverse().map((p: any, i: number) => (
              <div key={`${p.member}-${i}`} style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 9 }}>
                <span style={{ color: STANCE_COLOR[p.stance] || DIM, fontWeight: 800, fontFamily: MONO, minWidth: 58 }}>{String(p.member).slice(0, 10).toUpperCase()}</span>
                <span style={{ color: DIM, fontFamily: MONO, fontSize: 8 }}>{p.stance?.toUpperCase()}{typeof p.confidence === 'number' ? ` ${Math.round(p.confidence * 100)}%` : ''}</span>
                <span style={{ color: 'rgba(224,242,254,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {(p.keyEvidence?.[0] || p.rationale || p.text || '').slice(0, 90)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
