/**
 * WeatherSpaceModal — focused weather overlay for the Cortex space.
 *
 * Opens when a get_weather turn resolves (see cortex-weather-modal store).
 * Dribbble-style glass card: location pill, oversized temp, animated
 * condition glyph, stat chips, hourly strip, 7-day hi/lo range bars.
 * Condition-reactive accent tint; Esc / ✕ / backdrop click dismiss.
 * The 3D scene keeps rendering behind the frosted backdrop — voice
 * barge-in is unaffected.
 */

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MapPin, Wind, Droplets, CloudRain, X, Pin } from 'lucide-react';
import type { WeatherArtifact, WxDayPoint, WxHourPoint } from '../../lib/cortex-artifacts';
import { closeWeatherModal, useWeatherModal } from '../../lib/cortex-weather-modal';
import { openSurfacePanel } from '../../lib/cortex-surfaces';
import { WxIcon, wxCondKey } from './artifacts/ArtifactRenderer';

const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

/** Condition family → accent color (single --wx-accent equivalent). */
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

export function WeatherSpaceModal() {
  const artifact = useWeatherModal();

  useEffect(() => {
    if (!artifact) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeWeatherModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [artifact]);

  const a = artifact;
  const accent = accentFor(a?.condition);
  const { num: tempNum, unit: tempUnit } = parseTemp(a?.temp);
  const hours = (a?.hourly || []).slice(0, 12);
  const days = (a?.days || []).slice(0, 7);
  const hiLo = days.flatMap((d) => [d.hi, d.lo].filter((v): v is number => Number.isFinite(v)));
  const rangeMin = hiLo.length ? Math.min(...hiLo) : 0;
  const rangeMax = hiLo.length ? Math.max(...hiLo) : 1;
  const span = Math.max(1, rangeMax - rangeMin);

  return (
    <AnimatePresence>
      {a && (
        <motion.div
          key="weather-space-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={closeWeatherModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 120,
            background: 'rgba(30,80,160,0.28)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, cursor: 'pointer',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(400px, 94vw)', maxHeight: '88vh', overflowY: 'auto',
              borderRadius: 22, cursor: 'default',
              background: 'linear-gradient(165deg, rgba(165,220,252,0.42) 0%, rgba(96,165,250,0.30) 45%, rgba(59,130,246,0.34) 100%)',
              border: '1px solid rgba(224,242,254,0.55)',
              boxShadow: '0 30px 80px rgba(2,20,60,0.5), 0 0 0 1px rgba(255,255,255,0.25) inset, 0 1px 0 rgba(255,255,255,0.65) inset, 0 -1px 0 rgba(30,80,160,0.25) inset',
              backdropFilter: 'blur(30px) saturate(1.5)', WebkitBackdropFilter: 'blur(30px) saturate(1.5)',
              padding: '18px 18px 14px',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            {/* Header — location pill + close */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 999,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)',
                fontSize: 11, fontWeight: 600, color: '#e8f1ff', letterSpacing: '0.02em',
              }}>
                <MapPin size={11} style={{ color: accent }} />
                <span style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.city || 'Current location'}{a.period ? ` · ${a.period}` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => {
                    // Pin = dock the artifact as a persistent surface panel
                    // (renders the full WeatherBody: sky scene + radar +
                    // hourly chart). Modal closes — the panel is the keep.
                    try {
                      openSurfacePanel({
                        kind: 'artifact',
                        title: a.title || 'Weather',
                        artifact: a,
                        pinned: true,
                      });
                    } catch { }
                    closeWeatherModal();
                  }}
                  aria-label="Pin weather to space"
                  title="Pin to space"
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.28)',
                    background: 'rgba(255,255,255,0.16)', color: '#f0f7ff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Pin size={13} />
                </button>
                <button
                  onClick={closeWeatherModal}
                  aria-label="Close weather"
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.28)',
                    background: 'rgba(255,255,255,0.16)', color: '#f0f7ff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Hero — glyph + temp + condition */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
              <div style={{ filter: `drop-shadow(0 6px 24px ${accent}55)`, flexShrink: 0 }}>
                <WxIcon k={heroIconKey(a)} size={92} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, lineHeight: 0.95 }}>
                  <span style={{
                    fontSize: 58, fontWeight: 200, color: '#f4f9ff',
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em',
                    textShadow: '0 4px 30px rgba(0,0,0,0.5)',
                  }}>{tempNum}</span>
                  <span style={{ fontSize: 22, fontWeight: 300, color: '#cfe0f5' }}>{tempUnit}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#eaf2ff', marginTop: 4 }}>
                  {a.condition || a.summary || '—'}
                </div>
                {a.summary && a.condition && (
                  <div style={{ fontSize: 10.5, color: 'rgba(190,215,240,0.65)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
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
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, letterSpacing: '0.18em', color: 'rgba(170,200,230,0.6)', fontFamily: MONO, marginBottom: 3 }}>
                    <span style={{ color: accent }}>{s.icon}</span>{s.label}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#eaf2ff', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Hourly strip */}
            {hours.length >= 2 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 8.5, letterSpacing: '0.22em', color: 'rgba(160,200,235,0.55)', fontFamily: MONO, textTransform: 'uppercase', marginBottom: 6 }}>
                  Next {hours.length}h
                </div>
                <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'thin' }}>
                  {hours.map((h, i) => (
                    <div key={i} style={{
                      flex: '0 0 auto', width: 52, padding: '7px 4px 6px', borderRadius: 10,
                      background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}>
                      <span style={{ fontSize: 9, color: 'rgba(190,215,240,0.7)', fontFamily: MONO }}>{h.t}</span>
                      <WxIcon k={iconKeyFor(h.cond, hourIsDay(h))} size={26} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#eaf2ff', fontVariantNumeric: 'tabular-nums' }}>{h.temp}°</span>
                      <span style={{ fontSize: 8.5, color: h.precip && h.precip > 20 ? '#7dd3fc' : 'rgba(160,190,220,0.45)', fontFamily: MONO }}>
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
                <div style={{ fontSize: 8.5, letterSpacing: '0.22em', color: 'rgba(160,200,235,0.55)', fontFamily: MONO, textTransform: 'uppercase', marginBottom: 6 }}>
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
                        background: i === 0 ? 'rgba(255,255,255,0.06)' : 'transparent',
                      }}>
                        <span style={{ width: 52, fontSize: 11, color: i === 0 ? '#eaf2ff' : 'rgba(200,220,245,0.75)', fontWeight: i === 0 ? 600 : 400, flexShrink: 0 }}>
                          {i === 0 ? 'Today' : d.d}
                        </span>
                        <WxIcon k={iconKeyFor(d.cond, true)} size={22} />
                        <span style={{ width: 30, fontSize: 9.5, color: d.precip && d.precip > 20 ? '#7dd3fc' : 'rgba(160,190,220,0.45)', fontFamily: MONO, textAlign: 'right', flexShrink: 0 }}>
                          {d.precip != null ? `${d.precip}%` : ''}
                        </span>
                        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', position: 'relative', minWidth: 40 }}>
                          {hasRange && (
                            <div style={{
                              position: 'absolute', top: 0, bottom: 0, borderRadius: 2,
                              left: `${loPct}%`, width: `${Math.max(4, hiPct - loPct)}%`,
                              background: `linear-gradient(90deg, #60a5fa, ${accent})`,
                              opacity: 0.85,
                            }} />
                          )}
                        </div>
                        <span style={{ width: 56, fontSize: 11, color: '#eaf2ff', fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0, fontFamily: MONO }}>
                          {Number.isFinite(d.hi) ? `${Math.round(d.hi!)}°` : '—'}
                          <span style={{ color: 'rgba(170,200,230,0.6)' }}> / {Number.isFinite(d.lo) ? `${Math.round(d.lo!)}°` : '—'}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 14, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 8.5, letterSpacing: '0.18em', color: 'rgba(150,180,210,0.45)', fontFamily: MONO }}>NWS · api.weather.gov · LIVE</span>
              <span style={{ fontSize: 8.5, color: 'rgba(150,180,210,0.45)', fontFamily: MONO }}>
                {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default WeatherSpaceModal;
