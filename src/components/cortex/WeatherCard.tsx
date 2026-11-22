/**
 * WeatherCard — the shared weather card surface.
 *
 * Single source of truth for the weather look: frosted light-blue glass,
 * location pill, animated WxIcon hero, oversized temp, stat chips,
 * hourly strip, 7-day hi/lo range bars. Used by BOTH:
 *  - WeatherSpaceModal (wrapped in the dimmed overlay + spring motion)
 *  - WeatherBody in ArtifactRenderer (inside the pinned surface panel)
 * so the modal glance and the pinned panel can never drift apart.
 */

import type { ReactNode } from 'react';
import { MapPin, Wind, Droplets, CloudRain } from 'lucide-react';
import type { WeatherArtifact, WxDayPoint, WxHourPoint } from '../../lib/cortex-artifacts';
import { WxIcon, wxCondKey, WX_ICON_CSS } from './wx-icon';

const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

/** Condition family → accent color (single accent per card). */
function accentFor(cond?: string): string {
  switch (wxCondKey(cond)) {
    case 'sun': return '#fbbf24';
    case 'partly': return '#7dd3fc';
    case 'cloud': return '#94a3b8';
    case 'rain': return '#38bdf8';
    case 'storm': return '#a78bfa';
    case 'snow': return '#bae6fd';
    case 'fog': return '#cbd5e1';
    default: return '#7dd3fc';
  }
}

/** WxIcon key for an arbitrary condition + day/night flag. */
function iconKeyFor(cond: string | undefined, isDay: boolean): string {
  const k = wxCondKey(cond);
  const night = !isDay;
  if (k === 'partly') return night ? 'partly-night' : 'partly-day';
  if (k === 'sun') return night ? 'moon' : 'sun';
  return k;
}

function heroIconKey(a: WeatherArtifact): string {
  const periodNight = /night|tonight|evening/i.test(String(a.period || ''));
  const isDay = a.isDay === true ? true : a.isDay === false ? false : !periodNight;
  return iconKeyFor(a.condition, isDay);
}

/** "53°F" → { num: '53', unit: '°F' } */
function parseTemp(t?: string): { num: string; unit: string } {
  const m = String(t || '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return { num: '—', unit: '' };
  const unit = String(t).replace(m[0], '').trim() || '°';
  return { num: m[0], unit };
}

function hourIsDay(h: WxHourPoint): boolean {
  return h.day !== false;
}

export function WeatherCard({ a, actions }: { a: WeatherArtifact; actions?: ReactNode }) {
  const accent = accentFor(a.condition);
  const { num: tempNum, unit: tempUnit } = parseTemp(a.temp);
  const hours = (a.hourly || []).slice(0, 12);
  const days = (a.days || []).slice(0, 7);
  const hiLo = days.flatMap((d) => [d.hi, d.lo].filter((v): v is number => Number.isFinite(v)));
  const rangeMin = hiLo.length ? Math.min(...hiLo) : 0;
  const rangeMax = hiLo.length ? Math.max(...hiLo) : 1;
  const span = Math.max(1, rangeMax - rangeMin);

  return (
    <div style={{
      width: '100%',
      borderRadius: 22, cursor: 'default',
      background: 'linear-gradient(165deg, rgba(165,220,252,0.42) 0%, rgba(96,165,250,0.30) 45%, rgba(59,130,246,0.34) 100%)',
      border: '1px solid rgba(224,242,254,0.55)',
      boxShadow: '0 30px 80px rgba(2,20,60,0.5), 0 0 0 1px rgba(255,255,255,0.25) inset, 0 1px 0 rgba(255,255,255,0.65) inset, 0 -1px 0 rgba(30,80,160,0.25) inset',
      backdropFilter: 'blur(30px) saturate(1.5)', WebkitBackdropFilter: 'blur(30px) saturate(1.5)',
      padding: '18px 18px 14px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header — location pill + optional actions (modal pin/close) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999,
          background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.5)',
          fontSize: 11, fontWeight: 600, color: '#12335c', letterSpacing: '0.02em',
        }}>
          <MapPin size={11} style={{ color: '#1d4ed8' }} />
          <span style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.city || 'Current location'}{a.period ? ` · ${a.period}` : ''}
          </span>
        </div>
        {actions}
      </div>

      {/* Hero — glyph + temp + condition */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <div style={{ filter: `drop-shadow(0 6px 24px ${accent}66)`, flexShrink: 0 }}>
          <WxIcon k={heroIconKey(a)} size={92} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, lineHeight: 0.95 }}>
            <span style={{
              fontSize: 58, fontWeight: 200, color: '#0b2545',
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em',
              textShadow: '0 1px 0 rgba(255,255,255,0.4)',
            }}>{tempNum}</span>
            <span style={{ fontSize: 22, fontWeight: 300, color: '#1e4976' }}>{tempUnit}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#123a63', marginTop: 4 }}>
            {a.condition || a.summary || '—'}
          </div>
          {a.summary && a.condition && (
            <div style={{ fontSize: 10.5, color: 'rgba(18,58,99,0.7)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
              {a.summary}
            </div>
          )}
        </div>
      </div>

      {/* Stat chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { icon: <Wind size={12} />, label: 'WIND', value: a.wind || '—' },
          { icon: <Droplets size={12} />, label: 'HUMIDITY', value: a.humidity != null ? `${a.humidity}%` : '—' },
          { icon: <CloudRain size={12} />, label: 'PRECIP', value: a.precipNow != null ? `${a.precipNow}%` : '—' },
        ].map((s) => (
          <div key={s.label} style={{
            padding: '7px 9px', borderRadius: 10,
            background: 'rgba(255,255,255,0.38)', border: '1px solid rgba(255,255,255,0.5)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.4) inset',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, letterSpacing: '0.18em', color: 'rgba(30,73,118,0.75)', fontFamily: MONO, marginBottom: 3 }}>
              <span style={{ color: '#1d4ed8' }}>{s.icon}</span>{s.label}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0b2545', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Hourly strip */}
      {hours.length >= 2 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 8.5, letterSpacing: '0.22em', color: 'rgba(30,73,118,0.6)', fontFamily: MONO, textTransform: 'uppercase', marginBottom: 6 }}>
            Next {hours.length}h
          </div>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'thin' }}>
            {hours.map((h, i) => (
              <div key={i} style={{
                flex: '0 0 auto', width: 52, padding: '7px 4px 6px', borderRadius: 10,
                background: 'rgba(255,255,255,0.32)', border: '1px solid rgba(255,255,255,0.45)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}>
                <span style={{ fontSize: 9, color: 'rgba(30,73,118,0.8)', fontFamily: MONO }}>{h.t}</span>
                <WxIcon k={iconKeyFor(h.cond, hourIsDay(h))} size={26} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#0b2545', fontVariantNumeric: 'tabular-nums' }}>{h.temp}°</span>
                <span style={{ fontSize: 8.5, color: h.precip && h.precip > 20 ? '#0369a1' : 'rgba(30,73,118,0.5)', fontFamily: MONO }}>
                  {h.precip != null ? `${h.precip}%` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7-day forecast */}
      {days.length > 1 && (
        <div>
          <div style={{ fontSize: 8.5, letterSpacing: '0.22em', color: 'rgba(30,73,118,0.6)', fontFamily: MONO, textTransform: 'uppercase', marginBottom: 6 }}>
            {days.length}-Day Forecast
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {days.map((d: WxDayPoint, i: number) => {
              const hasRange = Number.isFinite(d.hi) && Number.isFinite(d.lo);
              const loPct = hasRange ? ((d.lo! - rangeMin) / span) * 100 : 0;
              const hiPct = hasRange ? ((d.hi! - rangeMin) / span) * 100 : 0;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '5px 8px', borderRadius: 9,
                  background: i === 0 ? 'rgba(255,255,255,0.4)' : 'transparent',
                }}>
                  <span style={{ width: 52, fontSize: 11, color: i === 0 ? '#0b2545' : 'rgba(18,58,99,0.8)', fontWeight: i === 0 ? 600 : 400, flexShrink: 0 }}>
                    {i === 0 ? 'Today' : d.d}
                  </span>
                  <WxIcon k={iconKeyFor(d.cond, true)} size={22} />
                  <span style={{ width: 30, fontSize: 9.5, color: d.precip && d.precip > 20 ? '#0369a1' : 'rgba(30,73,118,0.55)', fontFamily: MONO, textAlign: 'right', flexShrink: 0 }}>
                    {d.precip != null ? `${d.precip}%` : ''}
                  </span>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(30,73,118,0.15)', position: 'relative', minWidth: 40 }}>
                    {hasRange && (
                      <div style={{
                        position: 'absolute', top: 0, bottom: 0, borderRadius: 2,
                        left: `${loPct}%`, width: `${Math.max(4, hiPct - loPct)}%`,
                        background: `linear-gradient(90deg, #60a5fa, ${accent})`,
                        opacity: 0.9,
                      }} />
                    )}
                  </div>
                  <span style={{ width: 56, fontSize: 11, color: '#0b2545', fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0, fontFamily: MONO }}>
                    {Number.isFinite(d.hi) ? `${Math.round(d.hi!)}°` : '—'}
                    <span style={{ color: 'rgba(30,73,118,0.6)' }}> / {Number.isFinite(d.lo) ? `${Math.round(d.lo!)}°` : '—'}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 14, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 8.5, letterSpacing: '0.18em', color: 'rgba(30,73,118,0.6)', fontFamily: MONO }}>NWS · api.weather.gov · LIVE</span>
        <span style={{ fontSize: 8.5, color: 'rgba(30,73,118,0.6)', fontFamily: MONO }}>
          {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
      <style>{WX_ICON_CSS}</style>
    </div>
  );
}

export default WeatherCard;
