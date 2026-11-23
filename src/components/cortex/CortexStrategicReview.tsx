/**
 * CortexStrategicReview — live Strategic Review surface.
 *
 * One dashboard joining every goal-health source: declarations + steps
 * (goals engine), 30-day effort trends (task archive + commit
 * attributions + verified ops), drift findings, pre-mortems, corrective
 * verification outcomes, and initiative-ledger proposals. Data comes
 * from GET /api/cortex/strategic/dashboard, polled every 30s — the
 * quarterly review as a live glance, not a manual compilation.
 */
import React, { useEffect, useState } from 'react';
import { C } from './cortex-demo-helpers';
import type { GoalHealth, StrategicDashboard } from '../../lib/cortex-strategic-dashboard-types';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

const STATUS_META: Record<GoalHealth['status'], { label: string; color: string }> = {
  'on-track': { label: 'ON TRACK', color: C.green },
  'drifting': { label: 'DRIFTING', color: C.amber },
  'escalated': { label: 'ESCALATED', color: C.red },
};

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function TrendBars({ trend, max }: { trend: GoalHealth['trend']; max: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 44 }}>
      {trend.map((t, i) => (
        <div
          key={i}
          title={`${t.day}: ${t.count} effort event${t.count === 1 ? '' : 's'}`}
          style={{
            flex: 1,
            height: `${Math.max(6, (t.count / max) * 100)}%`,
            background: t.count > 0 ? C.cyan : 'rgba(148,233,255,0.08)',
            opacity: t.count > 0 ? 0.85 : 1,
            borderRadius: '1px 1px 0 0',
            minWidth: 2,
          }}
        />
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, color: C.dim, textTransform: 'uppercase', marginBottom: 4 }}>
      {children}
    </div>
  );
}

function GoalCard({ g }: { g: GoalHealth }) {
  const meta = STATUS_META[g.status];
  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: 6,
      background: C.surface,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontFamily: MONO, fontSize: 12, color: C.text, fontWeight: 600, lineHeight: 1.3 }}>
          {g.title}
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: meta.color,
          border: `1px solid ${meta.color}`, borderRadius: 3, padding: '2px 6px',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {meta.label}
        </div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: C.dim }}>
        {g.horizon}{g.targetDate ? ` · target ${g.targetDate}` : ''}
        {g.daysLeft != null ? ` · ${g.daysLeft}d left` : ''}
        {g.driftScore > 0 ? ` · drift ${Math.round(g.driftScore * 100)}%` : ''}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, fontFamily: MONO, fontSize: 10, color: C.dim }}>
        <span>OPS <b style={{ color: C.text }}>{g.ops.done}/{g.ops.total}</b></span>
        <span>COMMITS 7D <b style={{ color: C.text }}>{g.commits7d}</b></span>
        <span>EFFORT 7D <b style={{ color: C.text }}>{g.effort7d}</b></span>
      </div>

      {/* Forecast — trajectory projection */}
      {g.forecast && (
        <div style={{ fontFamily: MONO, fontSize: 10 }}>
          {g.forecast.probability != null ? (
            <div style={{ color: g.forecast.probability < 0.5 ? C.red : g.forecast.probability < 0.75 ? C.amber : C.green }}>
              🎯 P(hit {g.forecast.targetDate}) = <b>{Math.round(g.forecast.probability * 100)}%</b>
              {g.forecast.calibrated && g.forecast.rawProbability != null && Math.abs(g.forecast.rawProbability - g.forecast.probability) > 0.01 && (
                <span style={{ color: C.dim }}> (raw {Math.round(g.forecast.rawProbability * 100)}%, calibrated n={g.forecast.calibrationN})</span>
              )}
              {' '}· pace {g.forecast.paceRatio}× · ETA {g.forecast.projectedFinish}
              {g.forecast.momentum === 'down' ? ' · momentum ↓' : g.forecast.momentum === 'up' ? ' · momentum ↑' : ''}
            </div>
          ) : (
            <div style={{ color: C.dim }}>🎯 forecast: insufficient data ({g.forecast.remainingOps} ops, {g.forecast.observations} observations)</div>
          )}
        </div>
      )}

      {/* 30-day effort trend */}
      <div>
        <SectionLabel>EFFORT · 30D</SectionLabel>
        <TrendBars trend={g.trend} max={g.trendMax} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 8, color: C.dim, marginTop: 2 }}>
          <span>-30d</span><span>today</span>
        </div>
      </div>

      {/* Live pace watch — accepted trajectory vs actuals */}
      {g.paceWatch && (
        <div style={{ fontFamily: MONO, fontSize: 10 }}>
          <span style={{ color: g.paceWatch.onPace ? C.green : C.red }}>
            {g.paceWatch.onPace ? '▶' : '⚠'} PACE {g.paceWatch.ratio != null ? `${Math.round(g.paceWatch.ratio * 100)}% of trajectory` : 'warming up'}
          </span>
          <span style={{ color: C.dim }}> · {g.paceWatch.actual}/{g.paceWatch.expected} ops · day {g.paceWatch.elapsedDays}</span>
        </div>
      )}

      {/* Verification status */}
      {(g.pendingVerification || g.lastVerification) && (
        <div style={{ fontFamily: MONO, fontSize: 10 }}>
          {g.pendingVerification && (
            <div style={{ color: C.amber }}>
              ⏳ verifying {g.pendingVerification.kind} corrective — "{g.pendingVerification.correctiveTitle.slice(0, 60)}"
            </div>
          )}
          {g.lastVerification && (
            <div style={{ color: g.lastVerification.outcome === 'resolved' ? C.green : C.red }}>
              {g.lastVerification.outcome === 'resolved' ? '✅' : '⚠️'} last verification: {g.lastVerification.outcome}
              {g.lastVerification.correctiveKind ? ` (${g.lastVerification.correctiveKind})` : ''} · {timeAgo(g.lastVerification.ts)}
            </div>
          )}
        </div>
      )}

      {/* Correctives + escalations */}
      {(g.correctives.length > 0 || g.escalations.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <SectionLabel>CORRECTIVES</SectionLabel>
          {g.correctives.slice(-3).map((c) => (
            <div key={c.id} style={{ fontFamily: MONO, fontSize: 9, color: c.status === 'pending' ? C.amber : C.dim, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
              <span style={{ flexShrink: 0 }}>{c.status}{c.agentId ? ` · ${c.agentId}` : ''}</span>
            </div>
          ))}
          {g.escalations.map((e) => (
            <div key={e.id} style={{ fontFamily: MONO, fontSize: 9, color: C.red }}>
              🚨 {e.title} <span style={{ color: C.dim }}>({e.status})</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent findings */}
      {g.findings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <SectionLabel>RECENT FINDINGS</SectionLabel>
          {g.findings.slice(0, 3).map((f, i) => (
            <div key={i} style={{ fontFamily: MONO, fontSize: 9, color: f.severity === 'high' ? C.red : C.amber, lineHeight: 1.4 }}>
              {f.kind}: {f.detail.slice(0, 110)}{f.detail.length > 110 ? '…' : ''}
              <span style={{ color: C.dim }}> · {timeAgo(f.ts)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pre-mortems */}
      {g.premortems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <SectionLabel>PRE-MORTEMS</SectionLabel>
          {g.premortems.map((p, i) => (
            <div key={i} style={{ fontFamily: MONO, fontSize: 9, color: C.purple, lineHeight: 1.4 }}>
              {p.headline.slice(0, 120)}{p.headline.length > 120 ? '…' : ''}
              <span style={{ color: C.dim }}> · {p.engine} · {timeAgo(p.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CortexStrategicReview() {
  const [data, setData] = useState<StrategicDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/cortex/strategic/dashboard', { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        if (j.ok) { setData(j); setError(null); }
        else setError(j.error || 'dashboard unavailable');
      } catch (e: any) {
        if (alive) setError(String(e?.message || e));
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const hostMax = Math.max(1, ...(data?.hostEffort30d.map((d) => d.count) || [1]));

  return (
    <div style={{
      height: '100%', overflowY: 'auto', padding: '12px 14px',
      fontFamily: MONO, color: C.text, background: C.bg,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: C.cyan }}>STRATEGIC REVIEW</div>
        <div style={{ fontSize: 9, color: C.dim }}>
          {data?.generatedAt ? `updated ${timeAgo(data.generatedAt)}` : ''}
          {error ? ` · ${error}` : ''}
        </div>
      </div>

      {/* Calibration strip */}
      {data?.calibration && (
        <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
          <span style={{ color: C.cyan, letterSpacing: 1 }}>CALIBRATION </span>
          {data.calibration.resolvedGoals === 0 ? (
            <span>no resolved outcomes yet — forecasts shipping uncalibrated ({data.calibration.claims} claims logged)</span>
          ) : (
            <span>
              {data.calibration.resolvedGoals} resolved · bias {data.calibration.overallBias != null ? `${data.calibration.overallBias > 0 ? '+' : ''}${Math.round(data.calibration.overallBias * 100)}%` : '—'}
              {data.calibration.buckets.map((b) => ` · ${b.band}: pred ${Math.round(b.predicted * 100)}% → hit ${Math.round(b.observed * 100)}% (n=${b.n})`).join('')}
            </span>
          )}
        </div>
      )}

      {/* Interoceptive state — somatic free-energy term */}
      {data?.interoceptive && (
        <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, border: `1px solid ${data.interoceptive.level === 'nominal' ? C.border : data.interoceptive.level === 'strained' ? C.amber : C.red}55`, borderRadius: 4, padding: '6px 8px' }}>
          <span style={{ color: C.cyan, letterSpacing: 1 }}>INTEROCEPTIVE </span>
          <span style={{ color: data.interoceptive.level === 'nominal' ? C.green : data.interoceptive.level === 'strained' ? C.amber : C.red, fontWeight: 700 }}>
            {data.interoceptive.level.toUpperCase()}
          </span>
          {' '}· error {Math.round(data.interoceptive.error * 100)}% · capacity {Math.round(data.interoceptive.capacity * 100)}%
          {data.interoceptive.surprise != null ? ` · surprise ${Math.round(data.interoceptive.surprise * 100)}%` : ''}
          {' '}· rss {data.interoceptive.vitals.rssMB}MB · heap {data.interoceptive.vitals.heapUsedMB}MB · load {data.interoceptive.vitals.loadAvg1m}/{data.interoceptive.vitals.cores}
          {data.interoceptive.vitals.memFreePct != null ? ` · mem free ${data.interoceptive.vitals.memFreePct}%` : ''}
          {data.interoceptive.vitals.lagP99Ms != null ? ` · lag p99 ${data.interoceptive.vitals.lagP99Ms}ms` : ''}
        </div>
      )}

      {/* Body schema — proprioceptive limb states */}
      {data?.body && (
        <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 8px' }}>
          <span style={{ color: C.cyan, letterSpacing: 1 }}>BODY </span>
          <span style={{ color: C.green }}>{data.body.readyCount}/{data.body.totalCount} limbs ready</span>
          {' · '}{data.body.limbs.map((l) => `${l.name.split(' ')[0].toLowerCase()}:${l.state === 'ready' ? '●' : l.state === 'degraded' ? '◐' : '○'}`).join(' ')}
        </div>
      )}

      {/* Host effort context */}
      {data && (
        <div>
          <SectionLabel>HOST EFFORT · 30D (all sources)</SectionLabel>
          <TrendBars trend={data.hostEffort30d} max={hostMax} />
        </div>
      )}

      {data && data.goals.length === 0 && (
        <div style={{ fontSize: 10, color: C.dim }}>No active goals declared — the goals engine is the source of truth.</div>
      )}

      {data?.goals.map((g) => <GoalCard key={g.id} g={g} />)}
    </div>
  );
}
