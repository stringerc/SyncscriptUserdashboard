/**
 * CortexForecastSimulator — what-if lever cockpit for goal_forecast
 * proposals in the Initiative Inbox.
 *
 * Toggles the three corrective levers (cadence, parallel sprint, descope)
 * and live-recomputes hit probability + projected finish via
 * POST /api/cortex/strategic/forecast-simulate — the SAME model that
 * produced the baseline, not a client-side approximation. The chosen
 * levers are reported upward so the accept path can stamp them into the
 * dispatched task input (the mission executes what you simulated).
 */
import React, { useEffect, useRef, useState } from 'react';
import { C } from './cortex-demo-helpers';
import type { ForecastLevers } from '../../lib/cortex-agent/goal-forecast';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

interface SimResult {
  probability: number | null;
  projectedFinish: string | null;
  weeklyRate: number;
  requiredWeekly: number;
  paceRatio: number | null;
  remainingOps: number;
  basis: string;
  portfolioImpact?: {
    effortBudgetDaily: number;
    leverCostDaily: number;
    goals: Array<{ goalId: string; title: string; shareBefore: number; shareAfter: number }>;
  };
}

interface Props {
  goalId: string;
  /** Baseline forecast numbers from the proposal (current pace). */
  baseline: {
    probability: number | null;
    targetDate: string | null;
    projectedFinish: string | null;
    remainingOps: number;
    weeklyRate: number;
    requiredWeekly: number;
    paceRatio: number | null;
  };
  /** Called with the active levers (defaults omitted) on every change. */
  onLevers?: (levers: ForecastLevers) => void;
}

const CADENCE_OPTIONS = [0.5, 1, 1.5, 2, 3, 4];

export function CortexForecastSimulator({ goalId, baseline, onLevers }: Props) {
  const [cadence, setCadence] = useState<number>(baseline.weeklyRate || 1);
  const [sprint, setSprint] = useState(false);
  const [descope, setDescope] = useState(0);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLeversRef = useRef(onLevers);
  onLeversRef.current = onLevers;

  const maxDescope = Math.max(0, baseline.remainingOps - 1);

  const levers: ForecastLevers = {
    ...(cadence !== baseline.weeklyRate ? { weeklyRate: cadence } : {}),
    ...(sprint ? { sprintBoostWeekly: 1, sprintWeeks: 4 } : {}),
    ...(descope > 0 ? { descopeOps: descope } : {}),
  };
  const hasLevers = Object.keys(levers).length > 0;

  // Report levers upward (for stamping into the accepted task input).
  useEffect(() => {
    onLeversRef.current?.(levers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadence, sprint, descope]);

  // Debounced recompute.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/cortex/strategic/forecast-simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goalId,
            weeklyRate: cadence !== baseline.weeklyRate ? cadence : undefined,
            descopeOps: descope > 0 ? descope : undefined,
            sprintBoostWeekly: sprint ? 1 : undefined,
            sprintWeeks: sprint ? 4 : undefined,
          }),
        });
        const j = await r.json();
        if (j?.ok && j.forecast) {
          setSim({
            probability: j.forecast.probability,
            projectedFinish: j.forecast.projectedFinish,
            weeklyRate: j.forecast.weeklyRate,
            requiredWeekly: j.forecast.requiredWeekly,
            paceRatio: j.forecast.paceRatio,
            remainingOps: j.forecast.remainingOps,
            basis: j.forecast.basis,
            portfolioImpact: j.forecast.portfolioImpact,
          });
        }
      } catch {} finally { setLoading(false); }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadence, sprint, descope, goalId]);

  const shown = sim || {
    probability: baseline.probability,
    projectedFinish: baseline.projectedFinish,
    weeklyRate: baseline.weeklyRate,
    requiredWeekly: baseline.requiredWeekly,
    paceRatio: baseline.paceRatio,
    remainingOps: baseline.remainingOps,
    basis: 'baseline',
  };
  const p = shown.probability;
  const pColor = p == null ? C.dim : p < 0.5 ? C.red : p < 0.75 ? C.amber : C.green;
  const baseP = baseline.probability;
  const delta = p != null && baseP != null ? Math.round((p - baseP) * 100) : null;

  const chip = (active: boolean, color: string) => ({
    background: active ? `${color}22` : 'transparent',
    color: active ? color : C.dim,
    border: `1px solid ${active ? color : C.border}`,
    borderRadius: 3, fontFamily: MONO, fontSize: 9, padding: '2px 7px',
    cursor: 'pointer' as const,
  });

  return (
    <div style={{
      marginTop: 8, border: `1px solid ${C.border}`, borderRadius: 4,
      padding: '8px 10px', background: 'rgba(0,0,0,0.25)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, color: C.cyan }}>WHAT-IF SIMULATOR</span>
        {hasLevers && <span style={{ fontFamily: MONO, fontSize: 8, color: C.amber }}>● levers active</span>}
      </div>

      {/* Readout */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: pColor }}>
          {p == null ? '—' : `${Math.round(p * 100)}%`}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.dim }}>
          P(hit {baseline.targetDate || 'target'})
          {delta != null && delta !== 0 && (
            <span style={{ color: delta > 0 ? C.green : C.red }}> ({delta > 0 ? '+' : ''}{delta}%)</span>
          )}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.dim }}>
          ETA {shown.projectedFinish || '—'}
        </span>
        {loading && <span style={{ fontFamily: MONO, fontSize: 8, color: C.dim }}>…</span>}
      </div>

      {/* Lever 1: cadence */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontFamily: MONO, fontSize: 8, color: C.dim, marginBottom: 3 }}>
          CADENCE — {shown.weeklyRate}/wk now · need {shown.requiredWeekly}/wk
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CADENCE_OPTIONS.map((r) => (
            <button key={r} style={chip(cadence === r, C.cyan)} onClick={() => setCadence(r)}>
              {r}/wk{r === baseline.weeklyRate ? ' •' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Lever 2: parallel sprint */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontFamily: MONO, fontSize: 8, color: C.dim, marginBottom: 3 }}>PARALLEL SPRINT</div>
        <button style={chip(sprint, C.purple)} onClick={() => setSprint((v) => !v)}>
          +1 op/wk × 4wk{sprint ? ' ✓' : ''}
        </button>
      </div>

      {/* Lever 3: descope */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontFamily: MONO, fontSize: 8, color: C.dim, marginBottom: 3 }}>
          DESCOPE — cut {descope} of {maxDescope} remaining ops
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button style={chip(false, C.red)} onClick={() => setDescope((d) => Math.max(0, d - 1))} disabled={descope === 0}>−</button>
          <span style={{ fontFamily: MONO, fontSize: 10, color: descope > 0 ? C.red : C.dim, minWidth: 24, textAlign: 'center' }}>{descope}</span>
          <button style={chip(false, C.red)} onClick={() => setDescope((d) => Math.min(maxDescope, d + 1))} disabled={descope >= maxDescope}>+</button>
          {descope > 0 && (
            <button style={{ ...chip(false, C.dim), marginLeft: 4 }} onClick={() => setDescope(0)}>reset</button>
          )}
        </div>
      </div>

      {shown.portfolioImpact && shown.portfolioImpact.leverCostDaily > 0 && (
        <div style={{ marginTop: 6, borderTop: `1px solid ${C.border}`, paddingTop: 5 }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: C.dim, marginBottom: 3 }}>
            PORTFOLIO COST — +{shown.portfolioImpact.leverCostDaily}/day effort (budget ~{shown.portfolioImpact.effortBudgetDaily}/day)
          </div>
          {shown.portfolioImpact.goals.filter((g) => g.shareBefore > 0 || g.shareAfter !== g.shareBefore).map((g) => (
            <div key={g.goalId} style={{ fontFamily: MONO, fontSize: 8.5, color: g.shareAfter < g.shareBefore ? C.amber : C.dim }}>
              {g.title.slice(0, 34)}: effort share {g.shareBefore}% → {g.shareAfter}%
            </div>
          ))}
        </div>
      )}

      <div style={{ fontFamily: MONO, fontSize: 8, color: C.dim, marginTop: 4 }}>
        Baseline {baseP != null ? `${Math.round(baseP * 100)}%` : '—'} → simulated {p != null ? `${Math.round(p * 100)}%` : '—'} · accept stamps these levers into the mission
      </div>
    </div>
  );
}
