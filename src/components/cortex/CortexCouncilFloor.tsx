/**
 * CortexCouncilFloor — the deliberation chamber. Living visualization of a
 * counsel session computed entirely from the live payload:
 *
 *   - council ring: member nodes colored by latest stance, sized by
 *     confidence, glowing on fresh filings; outer ring = round-2 (rebuttal)
 *     positions, inner = round-1 — you can see who revised and who held
 *   - stance drift: SHIFTED / HELD / NEW badges from round-1→round-2 diff
 *   - consensus projection: confidence-weighted verdict lean (go=1,
 *     conditional=0.5, no-go=0) — where the chamber is heading, not just
 *     where it stands
 *   - tension: normalized Shannon entropy of the stance split
 *   - tempo + filing timeline: positions/min and a stance-colored strip
 *     of every filing across the session's lifetime
 *   - THE RECORD: per-member dossiers — reasoning, risks, required
 *     conditions, key evidence — the actual deliberation, expandable
 *   - RISK SURFACE: risks[] aggregated across positions, deduped by prefix
 *
 * No decorative data. Every number traces to a filed position.
 */

import React, { useMemo, useState } from 'react';

const MONO = "'IBM Plex Mono', monospace";
const INK = '#e0f2fe';
const DIM = 'rgba(148,163,184,0.55)';

const STANCE_COLOR: Record<string, string> = {
  go: '#34d399',
  conditional: '#fbbf24',
  'no-go': '#f87171',
  'no-response': 'rgba(148,163,184,0.35)',
};
const STANCE_W: Record<string, number> = { go: 1, conditional: 0.5, 'no-go': 0 };
const PHASES = ['positions', 'rebuttal', 'poll', 'verdict', 'decided'] as const;
const PHASE_LABEL: Record<string, string> = { positions: 'POSITIONS', rebuttal: 'REBUTTAL', poll: 'POLL', verdict: 'VERDICT', cleared: 'VERDICT', decided: 'DECIDED' };

interface FloorProps { session: any }

function latestByRound(positions: any[], member: string, round: number) {
  return [...positions].reverse().find((p: any) => p.member === member && (p.round ?? 1) === round);
}

export function CortexCouncilFloor({ session: s }: FloorProps) {
  const positions: any[] = s.positions || [];
  const members: string[] = s.members || [];
  const [openMember, setOpenMember] = useState<string | null>(null);

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

  // Stance drift: round-1 → latest stance per member.
  const drift = useMemo(() => {
    const d = new Map<string, 'shifted' | 'held' | 'new'>();
    for (const mem of members) {
      const r1 = latestByRound(positions, mem, 1);
      const latest = latestByMember.get(mem);
      if (!latest) continue;
      if (!r1) { d.set(mem, 'new'); continue; }
      d.set(mem, latest.stance === r1.stance ? 'held' : 'shifted');
    }
    return d;
  }, [positions, members, latestByMember]);

  // Consensus projection: confidence-weighted stance lean.
  const projection = useMemo(() => {
    let wsum = 0, acc = 0;
    for (const t of stanceTable) {
      if (t.stance === 'no-response') continue;
      const w = (t.confidence ?? 0.5);
      acc += STANCE_W[t.stance] * w;
      wsum += w;
    }
    return wsum ? acc / wsum : null; // 0..1, >0.66 leans GO
  }, [stanceTable]);

  const tension = useMemo(() => {
    if (responded < 2) return null;
    const probs = [counts.go, counts.conditional, counts.noGo].filter(n => n > 0).map(n => n / responded);
    const H = -probs.reduce((a, p) => a + p * Math.log2(p), 0);
    const Hmax = Math.log2(Math.min(3, responded));
    return Hmax > 0 ? H / Hmax : 0;
  }, [counts.go, counts.conditional, counts.noGo, responded]);

  const tempo = positions.length / Math.max(1, (Date.now() - (s.createdAt || Date.now())) / 60000);

  // Filing timeline: every position as a tick on the session's time axis.
  const timeline = useMemo(() => {
    if (positions.length < 2) return null;
    const t0 = Math.min(...positions.map((p: any) => p.filedAt || s.createdAt));
    const t1 = Math.max(...positions.map((p: any) => p.filedAt || s.createdAt));
    const span = Math.max(1, t1 - t0);
    return positions.map((p: any) => ({
      ...p,
      x: ((p.filedAt || t0) - t0) / span,
    }));
  }, [positions, s.createdAt]);

  // Risk surface: aggregate risks[] across latest positions, dedupe by first 40 chars.
  const riskSurface = useMemo(() => {
    const seen = new Map<string, number>();
    for (const p of positions) {
      for (const r of (p.risks || [])) {
        const k = String(r).slice(0, 40).toLowerCase();
        seen.set(k, (seen.get(k) || 0) + 1);
      }
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [positions]);

  const R = 62, CX = 80, CY = 80;
  const now = Date.now();
  const freshWindow = 90_000;
  const statusKey = PHASE_LABEL[s.status] ? s.status : (s.status === 'cleared' ? 'verdict' : s.status);
  const phaseIdx = PHASES.indexOf(statusKey as any);
  const hasR2 = positions.some((p: any) => (p.round ?? 1) === 2);

  return (
    <div style={{ border: '1px solid rgba(192,132,252,0.3)', borderRadius: 4, padding: '10px 12px', marginBottom: 8, background: 'linear-gradient(160deg, rgba(192,132,252,0.07), rgba(15,23,42,0.5))' }}>
      <style>{`@keyframes councilPulse{0%,100%{opacity:1}50%{opacity:.35}}@keyframes councilGlow{0%,100%{filter:drop-shadow(0 0 2px currentColor)}50%{filter:drop-shadow(0 0 7px currentColor)}}@keyframes councilShift{0%,100%{opacity:.6}50%{opacity:1}}`}</style>

      {/* Phase rail + meta */}
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
              }}>{PHASE_LABEL[ph] || ph.toUpperCase()}</span>
            </React.Fragment>
          );
        })}
        {hasR2 && <span style={{ fontSize: 7.5, color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.4)', borderRadius: 2, padding: '0 4px', fontFamily: MONO }}>R2 REBUTTAL</span>}
        {s.mode === 'premortem' && <span style={{ fontSize: 7.5, color: '#f87171', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 2, padding: '0 4px', fontFamily: MONO }}>PREMORTEM</span>}
        <span style={{ marginLeft: 'auto', fontSize: 8, color: DIM, fontFamily: MONO }}>{responded}/{members.length} SEATED · {tempo.toFixed(1)}/min</span>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Council ring — inner = round 1, outer = round 2 */}
        <svg width={160} height={160} viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(192,132,252,0.15)" strokeWidth="1" strokeDasharray="3 4" />
          <circle cx={CX} cy={CY} r={R + 12} fill="none" stroke="rgba(56,189,248,0.12)" strokeWidth="1" strokeDasharray="2 5" />
          {members.map((mem, i) => {
            const ang = (i / Math.max(1, members.length)) * Math.PI * 2 - Math.PI / 2;
            const latest = latestByMember.get(mem);
            const stance = latest?.stance || 'no-response';
            const r1 = latestByRound(positions, mem, 1);
            const isR2 = (latest?.round ?? 1) === 2;
            const ringR = isR2 ? R + 12 : R;
            const x = CX + ringR * Math.cos(ang), y = CY + ringR * Math.sin(ang);
            const conf = typeof latest?.confidence === 'number' ? latest.confidence : 0.5;
            const fresh = latest?.filedAt && now - latest.filedAt < freshWindow;
            const rad = 4 + conf * 4;
            const color = STANCE_COLOR[stance] || STANCE_COLOR['no-response'];
            const driftState = drift.get(mem);
            return (
              <g key={mem}>
                {fresh && <circle cx={x} cy={y} r={rad + 5} fill="none" stroke={color} strokeWidth="1" opacity="0.5" style={{ animation: 'councilPulse 0.9s ease-in-out infinite' }} />}
                <circle cx={x} cy={y} r={rad} fill={color} opacity={stance === 'no-response' ? 0.4 : 0.9}
                  style={{ animation: fresh ? 'councilGlow 1.2s ease-in-out infinite' : 'none', color }} />
                {driftState === 'shifted' && (
                  <circle cx={x + rad * 0.7} cy={y - rad * 0.7} r={3} fill="#38bdf8" style={{ animation: 'councilShift 1s ease-in-out infinite' }}>
                    <title>stance shifted from round 1</title>
                  </circle>
                )}
                <text x={x} y={y + rad + 10} textAnchor="middle" fontSize="6.5" fontFamily={MONO} fill={DIM} letterSpacing="0.08em">
                  {String(mem).slice(0, 8).toUpperCase()}
                </text>
              </g>
            );
          })}
          {/* Center: tension over projection */}
          <text x={CX} y={CY - 6} textAnchor="middle" fontSize="14" fontFamily={MONO} fontWeight="800" fill={INK}>
            {tension == null ? '—' : `${Math.round(tension * 100)}`}
          </text>
          <text x={CX} y={CY + 4} textAnchor="middle" fontSize="6" fontFamily={MONO} fill={DIM} letterSpacing="0.14em">TENSION</text>
          <text x={CX} y={CY + 16} textAnchor="middle" fontSize="8" fontFamily={MONO} fontWeight="700"
            fill={projection == null ? DIM : projection >= 0.66 ? '#34d399' : projection >= 0.4 ? '#fbbf24' : '#f87171'}>
            {projection == null ? '—' : `${Math.round(projection * 100)}% GO`}
          </text>
        </svg>

        {/* Right column */}
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
          <div style={{ display: 'flex', gap: 10, fontSize: 8.5, fontFamily: MONO, color: DIM, marginBottom: 6 }}>
            <span style={{ color: STANCE_COLOR.go }}>■ GO {counts.go}</span>
            <span style={{ color: STANCE_COLOR.conditional }}>■ COND {counts.conditional}</span>
            <span style={{ color: STANCE_COLOR['no-go'] }}>■ NO-GO {counts.noGo}</span>
            {counts.noResponse > 0 && <span>□ SILENT {counts.noResponse}</span>}
            {hasR2 && <span style={{ color: '#7dd3fc' }}>⟳ R2 LIVE</span>}
          </div>

          {/* Filing timeline */}
          {timeline && (
            <div style={{ position: 'relative', height: 16, borderBottom: '1px solid rgba(148,163,184,0.2)', marginBottom: 8 }}>
              <span style={{ position: 'absolute', left: 0, bottom: -14, fontSize: 7, color: DIM, fontFamily: MONO }}>R1</span>
              <span style={{ position: 'absolute', right: 0, bottom: -14, fontSize: 7, color: DIM, fontFamily: MONO }}>NOW</span>
              {timeline.map((p: any, i: number) => (
                <div key={i} title={`${p.member} · ${p.stance} · R${p.round ?? 1}`}
                  style={{
                    position: 'absolute', left: `${p.x * 100}%`, bottom: 6, width: 6, height: 6, borderRadius: '50%',
                    background: STANCE_COLOR[p.stance] || DIM, transform: 'translateX(-50%)',
                    boxShadow: `0 0 5px ${STANCE_COLOR[p.stance] || DIM}`,
                    border: (p.round ?? 1) === 2 ? '1px solid #38bdf8' : 'none',
                  }} />
              ))}
            </div>
          )}

          {/* Risk surface */}
          {riskSurface.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '0.2em', color: '#f87171', marginBottom: 2 }}>RISK SURFACE</div>
              {riskSurface.map(([k, n]) => (
                <div key={k} style={{ fontSize: 8.5, color: 'rgba(252,165,165,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  • {String(k)}{n > 1 ? ` ×${n}` : ''}
                </div>
              ))}
            </div>
          )}

          {/* Member dossier toggles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {members.map((mem) => {
              const p = latestByMember.get(mem);
              const st = p?.stance || 'no-response';
              const active = openMember === mem;
              return (
                <button key={mem} onClick={() => setOpenMember(active ? null : mem)}
                  style={{
                    background: active ? 'rgba(192,132,252,0.18)' : 'rgba(8,14,24,0.6)',
                    border: `1px solid ${active ? '#c084fc' : 'rgba(103,232,249,0.18)'}`,
                    color: active ? '#e9d5ff' : DIM, fontFamily: MONO, fontSize: 8, padding: '2px 7px', borderRadius: 2,
                    cursor: 'pointer', letterSpacing: '0.08em',
                  }}>
                  {String(mem).slice(0, 10).toUpperCase()} <span style={{ color: STANCE_COLOR[st] }}>●</span>
                </button>
              );
            })}
          </div>

          {/* Expanded dossier — the actual reasoning */}
          {openMember && latestByMember.get(openMember) && (() => {
            const p = latestByMember.get(openMember);
            return (
              <div style={{ marginTop: 6, border: '1px solid rgba(192,132,252,0.2)', borderRadius: 3, padding: '7px 9px', background: 'rgba(15,23,42,0.6)', fontSize: 9, lineHeight: 1.55 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4, fontFamily: MONO, fontSize: 8 }}>
                  <span style={{ color: STANCE_COLOR[p.stance], fontWeight: 800 }}>{p.stance?.toUpperCase()}</span>
                  <span style={{ color: DIM }}>conf {Math.round((p.confidence ?? 0) * 100)}%</span>
                  <span style={{ color: DIM }}>R{p.round ?? 1}</span>
                  {drift.get(openMember) === 'shifted' && <span style={{ color: '#38bdf8' }}>SHIFTED</span>}
                </div>
                {p.reasoning && <div style={{ color: 'rgba(224,242,254,0.75)', marginBottom: 4 }}>{String(p.reasoning).slice(0, 400)}</div>}
                {(p.requiredConditions || []).length > 0 && (
                  <div style={{ marginBottom: 3 }}>
                    <span style={{ color: '#34d399', fontWeight: 800, fontSize: 7.5, letterSpacing: '0.15em' }}>CONDITIONS </span>
                    {p.requiredConditions.slice(0, 3).map((c: string, i: number) => <div key={i} style={{ color: 'rgba(110,231,183,0.7)' }}>▸ {String(c).slice(0, 120)}</div>)}
                  </div>
                )}
                {(p.risks || []).length > 0 && (
                  <div style={{ marginBottom: 3 }}>
                    <span style={{ color: '#f87171', fontWeight: 800, fontSize: 7.5, letterSpacing: '0.15em' }}>RISKS </span>
                    {p.risks.slice(0, 3).map((r: string, i: number) => <div key={i} style={{ color: 'rgba(252,165,165,0.7)' }}>▸ {String(r).slice(0, 120)}</div>)}
                  </div>
                )}
                {(p.keyEvidence || []).length > 0 && (
                  <div>
                    <span style={{ color: '#7dd3fc', fontWeight: 800, fontSize: 7.5, letterSpacing: '0.15em' }}>EVIDENCE </span>
                    {p.keyEvidence.slice(0, 4).map((e: string, i: number) => <div key={i} style={{ color: 'rgba(125,211,252,0.65)' }}>· {String(e).slice(0, 110)}</div>)}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
