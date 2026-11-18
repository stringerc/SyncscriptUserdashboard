/**
 * CortexFoundryCalendar
 * Multi-horizon mission calendar view for the Foundry left-rail navigation.
 * Supports:
 *   - 48H: Immediate next 48-hour tactical agenda
 *   - DAY: Hourly breakdown and time-blocked timeline for selected day
 *   - WEEK: 7-day strategic strip (Mon-Sun) with event density
 *   - MONTH: 7-column calendar grid matrix with day inspection
 */

import React, { useState, useRef } from 'react';
import {
  CalendarEventItem,
  getEventsForDay,
  getEventsForWeek,
  getEventsForMonth,
  getMonthMatrix,
  formatTimeRange,
  getRelativeDayLabel,
  isSameDay,
} from '../../lib/cortex-calendar-utils';

const MONO = "'IBM Plex Mono', monospace";
const INK = '#e0f2fe';
const DIM = 'rgba(148,163,184,0.55)';
const CYAN = '#38bdf8';
const AMBER = '#fbbf24';

export type CalendarHorizon = '48h' | 'day' | 'multi' | 'week' | 'month';

interface Props {
  events: CalendarEventItem[];
  loading?: boolean;
}

export function CortexFoundryCalendar({ events, loading }: Props) {
  const [horizon, setHorizon] = useState<CalendarHorizon>('48h');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [selectedDayTimestamp, setSelectedDayTimestamp] = useState<number>(Date.now());

  // Date Navigation step handlers
  const stepNav = (direction: -1 | 1) => {
    const next = new Date(anchorDate);
    if (horizon === 'day' || horizon === 'multi') {
      next.setDate(next.getDate() + direction);
    } else if (horizon === 'week') {
      next.setDate(next.getDate() + direction * 7);
    } else if (horizon === 'month') {
      next.setMonth(next.getMonth() + direction);
    }
    setAnchorDate(next);
  };

  const jumpToToday = () => {
    const today = new Date();
    setAnchorDate(today);
    setSelectedDayTimestamp(today.getTime());
  };

  // Header Title derivation
  const getNavTitle = () => {
    if (horizon === '48h') return 'NEXT 48 HOURS (TACTICAL AGENDA)';
    if (horizon === 'multi') return `MULTI-DAY FEED (${getRelativeDayLabel(anchorDate)})`;
    if (horizon === 'day') {
      return anchorDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).toUpperCase();
    }
    if (horizon === 'week') {
      const d = new Date(anchorDate);
      const day = d.getDay();
      const diff = (day + 6) % 7;
      const mon = new Date(d); mon.setDate(d.getDate() - diff);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return `WEEK: ${mon.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`.toUpperCase();
    }
    if (horizon === 'month') {
      return anchorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase();
    }
    return '';
  };

  // 1. Next 48 Hours Horizon Data
  const now = Date.now();
  const next48hEvents = (events || [])
    .filter((e) => Number(e.start) >= now - 3600_000 && Number(e.start) <= now + 48 * 3600_000)
    .sort((a, b) => a.start - b.start);

  // 2. Day Horizon Data
  const dayEvents = getEventsForDay(events, anchorDate);

  // 2b. Multi-Day Horizon Data (Truly infinite Instagram-style strip)
  const [multiDays, setMultiDays] = useState<Date[]>(() => {
    const list: Date[] = [];
    const base = new Date(anchorDate);
    for (let i = -10; i <= 30; i++) {
      const cur = new Date(base);
      cur.setDate(base.getDate() + i);
      list.push(cur);
    }
    return list;
  });

  const isMultiExtendingRef = useRef(false);
  const handleMultiScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!el || isMultiExtendingRef.current) return;
    const cardH = 372;
    // Append future days towards 2048+
    if (el.scrollTop + el.clientHeight > el.scrollHeight - cardH * 4) {
      isMultiExtendingRef.current = true;
      setMultiDays((prev) => {
        const last = prev[prev.length - 1];
        const next: Date[] = [];
        for (let i = 1; i <= 20; i++) {
          const d = new Date(last);
          d.setDate(d.getDate() + i);
          next.push(d);
        }
        return [...prev, ...next];
      });
      setTimeout(() => { isMultiExtendingRef.current = false; }, 150);
    }
    // Prepend past days
    if (el.scrollTop < cardH * 2 && multiDays.length > 0) {
      isMultiExtendingRef.current = true;
      setMultiDays((prev) => {
        const first = prev[0];
        const next: Date[] = [];
        for (let i = 20; i >= 1; i--) {
          const d = new Date(first);
          d.setDate(d.getDate() - i);
          next.push(d);
        }
        requestAnimationFrame(() => {
          if (el) el.scrollTop += 20 * cardH;
        });
        return [...next, ...prev];
      });
      setTimeout(() => { isMultiExtendingRef.current = false; }, 150);
    }
  };

  // 3. Week Horizon Data
  const weekEvents = getEventsForWeek(events, anchorDate);
  const weekDays = (() => {
    const d = new Date(anchorDate);
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(d);
      cur.setDate(d.getDate() + i);
      days.push(cur);
    }
    return days;
  })();

  // 4. Month Horizon Data
  const monthMatrix = getMonthMatrix(anchorDate.getFullYear(), anchorDate.getMonth());
  const selectedDayEvents = getEventsForDay(events, selectedDayTimestamp);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: MONO }}>
      {/* Top Controls: Horizon Tabs & Date Navigator */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(103,232,249,0.18)',
      }}>
        {/* Horizon Switcher Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['48h', 'day', 'multi', 'week', 'month'] as CalendarHorizon[]).map((h) => {
            const active = horizon === h;
            return (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                style={{
                  background: active ? 'rgba(56,189,248,0.22)' : 'rgba(8,14,24,0.6)',
                  border: `1px solid ${active ? CYAN : 'rgba(103,232,249,0.18)'}`,
                  color: active ? '#7dd3fc' : DIM,
                  fontFamily: MONO,
                  fontSize: 9.5,
                  fontWeight: active ? 700 : 500,
                  padding: '2px 8px',
                  borderRadius: 2,
                  cursor: 'pointer',
                  letterSpacing: '0.12em',
                  transition: 'all 0.15s ease',
                }}
              >
                {h.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Step Navigation controls (for Day, Week, Month) */}
        {horizon !== '48h' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => stepNav(-1)}
              title="Previous"
              style={{
                background: 'rgba(8,14,24,0.6)',
                border: '1px solid rgba(103,232,249,0.18)',
                color: INK,
                fontFamily: MONO,
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 2,
                cursor: 'pointer',
              }}
            >
              ◀
            </button>
            <button
              onClick={jumpToToday}
              title="Jump to Today"
              style={{
                background: 'rgba(56,189,248,0.12)',
                border: '1px solid rgba(56,189,248,0.35)',
                color: '#7dd3fc',
                fontFamily: MONO,
                fontSize: 8.5,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 2,
                cursor: 'pointer',
                letterSpacing: '0.08em',
              }}
            >
              TODAY
            </button>
            <button
              onClick={() => stepNav(1)}
              title="Next"
              style={{
                background: 'rgba(8,14,24,0.6)',
                border: '1px solid rgba(103,232,249,0.18)',
                color: INK,
                fontFamily: MONO,
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 2,
                cursor: 'pointer',
              }}
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* Horizon Context Subtitle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 9,
        letterSpacing: '0.16em',
        color: CYAN,
        fontWeight: 700,
      }}>
        <span>{getNavTitle()}</span>
        {loading && <span style={{ color: AMBER, fontSize: 8 }}>SYNCING…</span>}
      </div>

      {/* ────────────────── VIEW 1: NEXT 48H HORIZON ────────────────── */}
      {horizon === '48h' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {next48hEvents.map((e, idx) => (
            <div
              key={e.id || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 4px',
                borderBottom: '1px solid rgba(148,163,184,0.08)',
                fontSize: 10,
              }}
            >
              <span style={{ color: AMBER, minWidth: 84, fontSize: 8.5, flexShrink: 0 }}>
                {e.start ? new Date(e.start).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: INK }}>
                {e.title || '(untitled)'}
              </span>
              {e.attendees && e.attendees > 0 ? (
                <span style={{ fontSize: 8, color: DIM, border: '1px solid rgba(148,163,184,0.2)', padding: '0 4px', borderRadius: 2 }}>
                  {e.attendees} att
                </span>
              ) : null}
            </div>
          ))}
          {!loading && next48hEvents.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: DIM, fontSize: 9.5 }}>
              NO EVENTS SCHEDULED IN THE NEXT 48 HOURS
            </div>
          )}
        </div>
      )}

      {/* ────────────────── VIEW 2: DAY HORIZON ────────────────── */}
      {horizon === 'day' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Day Summary Bar */}
          <div style={{
            fontSize: 9,
            color: DIM,
            padding: '3px 0',
            borderBottom: '1px dashed rgba(103,232,249,0.15)',
          }}>
            {dayEvents.length} EVENT{dayEvents.length === 1 ? '' : 'S'} SCHEDULED ON THIS DAY
          </div>

          {/* Chronological hourly list */}
          {dayEvents.length > 0 ? (
            dayEvents.map((e, idx) => (
              <div
                key={e.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 4px',
                  background: 'rgba(8,14,24,0.4)',
                  borderLeft: `2px solid ${AMBER}`,
                  borderBottom: '1px solid rgba(148,163,184,0.08)',
                  borderRadius: '0 2px 2px 0',
                }}
              >
                <span style={{ color: AMBER, fontSize: 9, minWidth: 92, fontWeight: 700 }}>
                  {formatTimeRange(e.start, e.end)}
                </span>
                <span style={{ flex: 1, color: INK, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.title}
                </span>
                {e.attendees && e.attendees > 0 ? (
                  <span style={{ fontSize: 8, color: '#38bdf8' }}>{e.attendees} attendees</span>
                ) : null}
              </div>
            ))
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: DIM, fontSize: 9.5 }}>
              NO EVENTS SCHEDULED FOR THIS DAY — SCHEDULE CLEAR
            </div>
          )}
        </div>
      )}

      {/* ────────────────── VIEW 2b: MULTI-DAY INSTAGRAM FEED (INFINITE SCROLL) ────────────────── */}
      {horizon === 'multi' && (
        <div
          onScroll={handleMultiScroll}
          style={{
            maxHeight: 460,
            overflowY: 'auto',
            scrollSnapType: 'y mandatory',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            paddingRight: 4,
          }}
        >
          {multiDays.map((d) => {
            const isCurToday = isSameDay(d, new Date());
            const dEvents = getEventsForDay(events, d);
            const relLabel = getRelativeDayLabel(d);
            const nowMs = Date.now();
            let greenLineRendered = false;

            return (
              <div
                key={d.toISOString()}
                style={{
                  height: 360,
                  minHeight: 360,
                  scrollSnapAlign: 'start',
                  scrollSnapStop: 'always',
                  display: 'flex',
                  flexDirection: 'column',
                  background: isCurToday ? 'rgba(56,189,248,0.06)' : 'rgba(8,14,24,0.6)',
                  border: `1px solid ${isCurToday ? 'rgba(56,189,248,0.45)' : 'rgba(103,232,249,0.18)'}`,
                  borderRadius: 6,
                  overflow: 'hidden',
                  boxShadow: isCurToday ? '0 0 16px rgba(56,189,248,0.15)' : 'none',
                }}
              >
                {/* Card Header Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: isCurToday ? 'rgba(56,189,248,0.14)' : 'rgba(15,23,42,0.6)',
                  borderBottom: `1px solid ${isCurToday ? 'rgba(56,189,248,0.3)' : 'rgba(103,232,249,0.12)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: isCurToday ? '#38bdf8' : INK }}>
                      {d.getDate()}
                    </span>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: isCurToday ? '#7dd3fc' : INK }}>
                        {d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}
                      </div>
                      <div style={{ fontSize: 8.5, color: DIM }}>
                        {d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: isCurToday ? '#38bdf8' : DIM,
                      border: `1px solid ${isCurToday ? 'rgba(56,189,248,0.4)' : 'rgba(148,163,184,0.2)'}`,
                      padding: '1px 6px',
                      borderRadius: 2,
                      letterSpacing: '0.1em',
                    }}>
                      {relLabel}
                    </span>
                    <span style={{ fontSize: 8, color: DIM }}>
                      {dEvents.length} EVT{dEvents.length === 1 ? '' : 'S'}
                    </span>
                  </div>
                </div>

                {/* Card Event Feed */}
                <div style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  {/* Green line if today has NO events */}
                  {isCurToday && dEvents.length === 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981', flexShrink: 0 }} />
                      <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #10b981, #34d399, #10b981)', boxShadow: '0 0 8px rgba(16,185,129,0.8)' }} />
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', padding: '1px 5px', borderRadius: 2, fontFamily: MONO, flexShrink: 0 }}>
                        NOW · {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                  )}

                  {dEvents.length > 0 ? (
                    dEvents.map((e, eIdx) => {
                      const eStart = Number(e.start || 0);
                      const shouldInsertGreenLine = isCurToday && !greenLineRendered && eStart > nowMs;
                      if (shouldInsertGreenLine) greenLineRendered = true;

                      return (
                        <React.Fragment key={e.id || eIdx}>
                          {shouldInsertGreenLine && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981', flexShrink: 0 }} />
                              <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #10b981, #34d399, #10b981)', boxShadow: '0 0 8px rgba(16,185,129,0.8)' }} />
                              <span style={{ fontSize: 8, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', padding: '1px 5px', borderRadius: 2, fontFamily: MONO, flexShrink: 0 }}>
                                NOW · {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </div>
                          )}

                          <div
                            style={{
                              padding: '6px 8px',
                              background: 'rgba(15,23,42,0.7)',
                              borderLeft: `2px solid ${AMBER}`,
                              border: '1px solid rgba(103,232,249,0.12)',
                              borderRadius: 3,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span style={{ fontSize: 8.5, color: AMBER, fontWeight: 700 }}>
                                {formatTimeRange(e.start, e.end)}
                              </span>
                              {e.attendees && e.attendees > 0 && (
                                <span style={{ fontSize: 7.5, color: CYAN }}>{e.attendees} att</span>
                              )}
                            </div>
                            <div style={{ fontSize: 9.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {e.title}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: 16,
                      color: DIM,
                    }}>
                      <div style={{ fontSize: 16, marginBottom: 4, opacity: 0.6 }}>✦</div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: INK }}>NO EVENTS SCHEDULED</div>
                      <div style={{ fontSize: 8.5, color: DIM, marginTop: 2 }}>Open horizon for focus and mission work</div>
                    </div>
                  )}

                  {/* Green line if all events today were in the past */}
                  {isCurToday && dEvents.length > 0 && !greenLineRendered && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981', flexShrink: 0 }} />
                      <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #10b981, #34d399, #10b981)', boxShadow: '0 0 8px rgba(16,185,129,0.8)' }} />
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', padding: '1px 5px', borderRadius: 2, fontFamily: MONO, flexShrink: 0 }}>
                        NOW · {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Snap Footer */}
                <div style={{
                  padding: '4px 10px',
                  background: 'rgba(8,14,24,0.8)',
                  borderTop: '1px solid rgba(103,232,249,0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 8,
                  color: DIM,
                }}>
                  <span>{dEvents.length > 0 ? `${dEvents.length} items on schedule` : 'Free day'}</span>
                  <span>↕ INFINITE SNAP SCROLL</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ────────────────── VIEW 3: WEEK HORIZON ────────────────── */}
      {horizon === 'week' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {weekDays.map((date) => {
            const dayTs = date.getTime();
            const isToday = isSameDay(date, new Date());
            const daysEvents = getEventsForDay(events, dayTs);

            return (
              <div
                key={dayTs}
                style={{
                  background: isToday ? 'rgba(56,189,248,0.07)' : 'rgba(8,14,24,0.3)',
                  border: `1px solid ${isToday ? 'rgba(56,189,248,0.4)' : 'rgba(103,232,249,0.1)'}`,
                  borderRadius: 2,
                  padding: '6px 8px',
                }}
              >
                {/* Day Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 4,
                  borderBottom: '1px solid rgba(148,163,184,0.08)',
                  paddingBottom: 2,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      color: isToday ? '#38bdf8' : INK,
                    }}>
                      {date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}
                    </span>
                    <span style={{ fontSize: 9, color: isToday ? '#38bdf8' : DIM }}>
                      {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    {isToday && (
                      <span style={{
                        fontSize: 7.5,
                        background: '#38bdf8',
                        color: '#040812',
                        fontWeight: 900,
                        padding: '0 4px',
                        borderRadius: 2,
                        letterSpacing: '0.06em',
                      }}>
                        TODAY
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 8, color: daysEvents.length ? AMBER : DIM }}>
                    {daysEvents.length ? `${daysEvents.length} EVENT${daysEvents.length === 1 ? '' : 'S'}` : 'QUIET'}
                  </span>
                </div>

                {/* Day Events list */}
                {daysEvents.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {daysEvents.map((ev, i) => (
                      <div key={ev.id || i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9 }}>
                        <span style={{ color: AMBER, fontSize: 8, minWidth: 54 }}>
                          {new Date(ev.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span style={{ flex: 1, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.title}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.3)', fontStyle: 'italic' }}>
                    No scheduled commitments
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ────────────────── VIEW 4: MONTH HORIZON ────────────────── */}
      {horizon === 'month' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Weekday headers: MON, TUE, WED, THU, FRI, SAT, SUN */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, textAlign: 'center' }}>
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((wd) => (
              <span key={wd} style={{ fontSize: 8, color: CYAN, fontWeight: 700, letterSpacing: '0.06em' }}>
                {wd}
              </span>
            ))}
          </div>

          {/* 7-column calendar grid matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {monthMatrix.map((week, wIdx) => (
              <div key={wIdx} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {week.map((cell) => {
                  const dayEventsCount = getEventsForDay(events, cell.timestamp).length;
                  const isSelected = isSameDay(cell.timestamp, selectedDayTimestamp);

                  return (
                    <button
                      key={cell.timestamp}
                      onClick={() => setSelectedDayTimestamp(cell.timestamp)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 38,
                        padding: 2,
                        cursor: 'pointer',
                        background: isSelected
                          ? 'rgba(56,189,248,0.22)'
                          : cell.isToday
                            ? 'rgba(56,189,248,0.1)'
                            : cell.isCurrentMonth
                              ? 'rgba(8,14,24,0.45)'
                              : 'rgba(4,8,16,0.25)',
                        border: `1px solid ${
                          isSelected
                            ? '#38bdf8'
                            : cell.isToday
                              ? 'rgba(56,189,248,0.6)'
                              : 'rgba(103,232,249,0.1)'
                        }`,
                        borderRadius: 2,
                        color: cell.isCurrentMonth ? (cell.isToday ? '#7dd3fc' : INK) : 'rgba(148,163,184,0.28)',
                        fontFamily: MONO,
                        position: 'relative',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <span style={{ fontSize: 9.5, fontWeight: cell.isToday || isSelected ? 800 : 500 }}>
                        {cell.dayNumber}
                      </span>
                      {/* Density indicator dots */}
                      {dayEventsCount > 0 && (
                        <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                          <span style={{
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            background: AMBER,
                            boxShadow: `0 0 4px ${AMBER}`,
                          }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Selected Day Agenda Drawer */}
          <div style={{
            marginTop: 4,
            padding: '8px',
            background: 'rgba(8,14,24,0.7)',
            border: '1px solid rgba(56,189,248,0.25)',
            borderLeft: '2px solid #38bdf8',
            borderRadius: 2,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
              borderBottom: '1px solid rgba(148,163,184,0.1)',
              paddingBottom: 2,
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#38bdf8' }}>
                {new Date(selectedDayTimestamp).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                }).toUpperCase()}
              </span>
              <span style={{ fontSize: 8, color: DIM }}>
                {selectedDayEvents.length} EVENT{selectedDayEvents.length === 1 ? '' : 'S'}
              </span>
            </div>

            {selectedDayEvents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {selectedDayEvents.map((e, idx) => (
                  <div key={e.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9 }}>
                    <span style={{ color: AMBER, fontSize: 8, minWidth: 84 }}>
                      {formatTimeRange(e.start, e.end)}
                    </span>
                    <span style={{ color: INK, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.title}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 8.5, color: DIM, fontStyle: 'italic', padding: '4px 0' }}>
                No events on this date
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
