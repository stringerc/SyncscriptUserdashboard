/**
 * INSTAGRAM-STYLE MULTI-DAY CALENDAR VIEW
 *
 * Designed to provide a sleek, mobile/feed-style vertical snap scroll experience
 * through calendar days, contained to the calendar tab height.
 *
 * ARCHITECTURE:
 * - Each day is an "Instagram Card" sized to 100% of the viewport container (no 2940px overflow).
 * - Vertical snap-scroll: flick/scroll smoothly snaps from day to day (snap-y snap-mandatory).
 * - Full event list per day with interactive modals, empty states, and "+ Add Event" actions.
 * - Floating navigation dock (Jump to Today, Previous Day, Next Day, Active Day pill).
 * - Retains full backwards compatibility with parent retry/RAF hooks and SimpleMultiDayCalendarRef.
 */

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronUp,
  ChevronDown,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Users,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Event } from '../utils/event-task-types';
import { useCalendarDrag } from '../hooks/useCalendarDrag';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { getCurrentDate } from '../utils/app-date';
import { shouldRenderEventOnDate } from '../utils/multi-day-event-utils';
import { getRelativeDayLabel } from '../lib/cortex-calendar-utils';

export interface SimpleMultiDayCalendarProps {
  centerDate: Date;
  events: Event[];
  onEventClick: (event: Event) => void;
  getParentEventName?: (event: Event) => string | undefined;
  onUnschedule?: (event: Event, itemType: 'event' | 'task' | 'goal') => void;
  onDropTask?: (task: any, hour: number, minute?: number, xPosition?: number, width?: number, date?: Date) => void;
  onMoveEvent?: (event: Event, newHour: number, newMinute?: number, xPosition?: number, width?: number, date?: Date) => void;
  onResetPosition?: (event: Event) => void;
  onHorizontalResizeEnd?: (event: Event, xPosition: number, width: number, edge: 'left' | 'right') => void;
  dragHook?: ReturnType<typeof useCalendarDrag>;
  onDateChange?: (newDate: Date) => void;
  expandedEvents?: Set<string>;
  onToggleExpand?: (eventId: string) => void;
  pixelsPerHour?: number;
  minutesPerSlot?: number;
  onCreateEvent?: (date: Date) => void;
}

export interface SimpleMultiDayCalendarRef {
  jumpToToday: () => void;
  jumpToTodayInstant: () => void;
  jumpToDay: (dayOffset: number) => void;
  readonly scrollContainer: HTMLDivElement | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const SimpleMultiDayCalendar = forwardRef<SimpleMultiDayCalendarRef, SimpleMultiDayCalendarProps>((props, ref) => {
  const {
    centerDate,
    events,
    onEventClick,
    onDateChange,
    onCreateEvent,
  } = props;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeDateIndex, setActiveDateIndex] = useState<number>(14);
  const [showFloatingIndicator, setShowFloatingIndicator] = useState(false);
  const indicatorTimeoutRef = useRef<NodeJS.Timeout>();

  // Generates 45 days centered around centerDate (-14 to +30 days)
  const [daysToRender, setDaysToRender] = useState<Date[]>(() => {
    const list: Date[] = [];
    for (let i = -14; i <= 30; i++) {
      const d = new Date(centerDate);
      d.setDate(d.getDate() + i);
      list.push(d);
    }
    return list;
  });

  // Re-generate days when centerDate changes significantly
  useEffect(() => {
    const list: Date[] = [];
    for (let i = -14; i <= 30; i++) {
      const d = new Date(centerDate);
      d.setDate(d.getDate() + i);
      list.push(d);
    }
    setDaysToRender(list);
  }, [centerDate]);

  const isToday = useCallback((date: Date) => {
    const today = getCurrentDate();
    return date.toDateString() === today.toDateString();
  }, []);

  const getDayEvents = useCallback((date: Date) => {
    return (events || [])
      .filter((e) => shouldRenderEventOnDate(e, date))
      .sort((a, b) => {
        const aTime = a.startTime instanceof Date ? a.startTime.getTime() : new Date(a.startTime).getTime();
        const bTime = b.startTime instanceof Date ? b.startTime.getTime() : new Date(b.startTime).getTime();
        return aTime - bTime;
      });
  }, [events]);

  const formatEventTime = (e: Event) => {
    const s = e.startTime instanceof Date ? e.startTime : new Date(e.startTime);
    const startStr = s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (!e.endTime) return startStr;
    const end = e.endTime instanceof Date ? e.endTime : new Date(e.endTime);
    const endStr = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${startStr} – ${endStr}`;
  };

  const getEventDurationMinutes = (e: Event): number => {
    const s = e.startTime instanceof Date ? e.startTime.getTime() : new Date(e.startTime).getTime();
    if (!e.endTime) return 60;
    const end = e.endTime instanceof Date ? e.endTime.getTime() : new Date(e.endTime).getTime();
    return Math.max(15, Math.round((end - s) / 60_000));
  };

  // Scroll Actions
  const scrollToDayIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const cardHeight = container.clientHeight;
    container.scrollTo({
      top: index * cardHeight,
      behavior,
    });
    setActiveDateIndex(index);
    if (daysToRender[index]) {
      onDateChange?.(daysToRender[index]);
    }
  }, [daysToRender, onDateChange]);

  const jumpToToday = useCallback(() => {
    const today = getCurrentDate();
    const idx = daysToRender.findIndex((d) => d.toDateString() === today.toDateString());
    if (idx !== -1) {
      scrollToDayIndex(idx, 'smooth');
    }
  }, [daysToRender, scrollToDayIndex]);

  const jumpToTodayInstant = useCallback(() => {
    const today = getCurrentDate();
    const idx = daysToRender.findIndex((d) => d.toDateString() === today.toDateString());
    if (idx !== -1) {
      scrollToDayIndex(idx, 'auto');
    }
  }, [daysToRender, scrollToDayIndex]);

  const jumpToDay = useCallback((offset: number) => {
    const nextIdx = Math.max(0, Math.min(daysToRender.length - 1, activeDateIndex + offset));
    scrollToDayIndex(nextIdx, 'smooth');
  }, [activeDateIndex, daysToRender.length, scrollToDayIndex]);

  // Imperative handle for parent
  useImperativeHandle(ref, () => ({
    jumpToToday,
    jumpToTodayInstant,
    jumpToDay,
    get scrollContainer() {
      return scrollContainerRef.current;
    },
  }), [jumpToToday, jumpToTodayInstant, jumpToDay]);

  // Handle scroll events & active card tracking
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const cardHeight = container.clientHeight || 1;
    const currentIdx = Math.round(container.scrollTop / cardHeight);

    if (currentIdx !== activeDateIndex && currentIdx >= 0 && currentIdx < daysToRender.length) {
      setActiveDateIndex(currentIdx);
      onDateChange?.(daysToRender[currentIdx]);
    }

    // Floating pill flash
    setShowFloatingIndicator(true);
    if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
    indicatorTimeoutRef.current = setTimeout(() => {
      setShowFloatingIndicator(false);
    }, 1400);
  };

  // Initial scroll to today on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      jumpToTodayInstant();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard navigation inside the feed
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      jumpToDay(1);
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      jumpToDay(-1);
    } else if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      jumpToToday();
    }
  };

  const activeDate = daysToRender[activeDateIndex] || centerDate;

  return (
    <div
      className="relative w-full h-full min-h-0 flex flex-col overflow-hidden bg-[#0d1017] border border-gray-800/80 rounded-2xl shadow-2xl focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid="instagram-multiday-calendar"
    >
      {/* Floating Active Date Header (Instagram Stories / Reels Pill) */}
      <AnimatePresence>
        {showFloatingIndicator && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gray-900/90 border border-teal-500/40 shadow-xl backdrop-blur-md text-xs font-mono text-teal-300">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              <span>{DAY_NAMES[activeDate.getDay()].toUpperCase()}, {MONTH_NAMES[activeDate.getMonth()].slice(0, 3).toUpperCase()} {activeDate.getDate()}</span>
              <span className="text-gray-400">·</span>
              <span className="text-amber-300 font-bold">{getRelativeDayLabel(activeDate)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Instagram Navigation Dock (Right Rail) */}
      <div className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => jumpToDay(-1)}
          title="Previous day (or press Up/K)"
          className="w-9 h-9 p-0 rounded-full bg-gray-900/85 border-gray-700 hover:border-teal-400 hover:bg-gray-800 text-gray-200 shadow-lg backdrop-blur-sm transition-all"
        >
          <ChevronUp className="w-4 h-4" />
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={jumpToToday}
          title="Jump to today (or press T)"
          className="w-10 h-10 p-0 rounded-full bg-teal-600/90 border-teal-400 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20 backdrop-blur-sm transition-all flex flex-col items-center justify-center"
        >
          <span className="text-[9px] font-mono leading-none tracking-tight">TODAY</span>
          <span className="text-xs font-bold leading-none">{getCurrentDate().getDate()}</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => jumpToDay(1)}
          title="Next day (or press Down/J)"
          className="w-9 h-9 p-0 rounded-full bg-gray-900/85 border-gray-700 hover:border-teal-400 hover:bg-gray-800 text-gray-200 shadow-lg backdrop-blur-sm transition-all"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>

      {/* The Instagram Feed Container: snap-y snap-mandatory bounded to 100% height */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 w-full h-full min-h-0 overflow-y-auto snap-y snap-mandatory scroll-smooth hide-scrollbar relative"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {daysToRender.map((date, idx) => {
          const dayEvents = getDayEvents(date);
          const isCurrentToday = isToday(date);
          const relativeLabel = getRelativeDayLabel(date);
          const totalScheduledMinutes = dayEvents.reduce((acc, e) => acc + getEventDurationMinutes(e), 0);
          const hours = Math.floor(totalScheduledMinutes / 60);
          const mins = totalScheduledMinutes % 60;
          const durationStr = hours > 0 ? `${hours}h ${mins > 0 ? `${mins}m` : ''}` : `${mins}m`;

          return (
            <div
              key={date.toISOString()}
              className="w-full h-full min-h-full max-h-full snap-start snap-always flex items-center justify-center p-2 sm:p-4 box-border"
            >
              {/* Instagram Card — Cut to phone/tab size */}
              <div className={`w-full max-w-xl h-full max-h-full flex flex-col rounded-2xl sm:rounded-3xl border transition-all duration-300 shadow-2xl relative overflow-hidden backdrop-blur-md ${
                isCurrentToday
                  ? 'bg-[#151922] border-teal-500/40 shadow-teal-950/30 ring-1 ring-teal-500/20'
                  : 'bg-[#13161f] border-gray-800/80 hover:border-gray-700'
              }`}>
                {/* Card Header Bar */}
                <div className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between shrink-0 transition-colors ${
                  isCurrentToday
                    ? 'bg-gradient-to-r from-teal-950/40 via-gray-900/60 to-gray-900/80 border-teal-500/30'
                    : 'bg-gray-900/60 border-gray-800/80'
                }`}>
                  <div className="flex items-center gap-3">
                    {/* Big Date Number */}
                    <div className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight leading-none ${
                      isCurrentToday ? 'text-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.4)]' : 'text-gray-200'
                    }`}>
                      {date.getDate()}
                    </div>
                    {/* Day & Month */}
                    <div>
                      <div className={`text-sm sm:text-base font-semibold leading-tight ${
                        isCurrentToday ? 'text-teal-200' : 'text-gray-300'
                      }`}>
                        {DAY_NAMES[date.getDay()]}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {MONTH_NAMES[date.getMonth()]} {date.getFullYear()}
                      </div>
                    </div>
                  </div>

                  {/* Header Badges & Actions */}
                  <div className="flex items-center gap-2">
                    {isCurrentToday ? (
                      <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/40 text-[10px] font-bold px-2 py-0.5 tracking-wider">
                        ● TODAY
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-gray-700 text-gray-400 text-[10px] font-mono px-2 py-0.5">
                        {relativeLabel}
                      </Badge>
                    )}

                    <Badge variant="outline" className="border-gray-800 bg-gray-900/80 text-gray-400 text-[10px] font-mono">
                      {dayEvents.length > 0 ? `${dayEvents.length} EVENT${dayEvents.length > 1 ? 'S' : ''}` : 'FREE'}
                    </Badge>

                    {onCreateEvent && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCreateEvent(date)}
                        title={`Add event to ${DAY_NAMES[date.getDay()]} ${date.getDate()}`}
                        className="h-7 w-7 p-0 rounded-full hover:bg-teal-500/20 text-gray-300 hover:text-teal-300"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Card Body — Feed of Scheduled Events for this Day */}
                <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-3 hide-scrollbar">
                  {dayEvents.length > 0 ? (
                    dayEvents.map((event) => {
                      const dur = getEventDurationMinutes(event);
                      const isCompleted = Boolean(event.completed);

                      return (
                        <div
                          key={event.id}
                          onClick={() => onEventClick(event)}
                          className={`group p-3.5 rounded-xl border transition-all duration-200 cursor-pointer shadow-md flex flex-col gap-2 relative overflow-hidden ${
                            isCompleted
                              ? 'bg-gray-900/40 border-gray-800/60 opacity-60'
                              : 'bg-gray-900/80 border-gray-700/60 hover:border-teal-500/50 hover:bg-gray-800/90 hover:scale-[1.01]'
                          }`}
                        >
                          {/* Accent line on left */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                            isCurrentToday ? 'bg-teal-400' : 'bg-cyan-500/60'
                          }`} />

                          {/* Time & Duration Row */}
                          <div className="flex items-center justify-between text-xs font-mono pl-1.5">
                            <div className="flex items-center gap-1.5 text-teal-300 font-semibold">
                              <Clock className="w-3.5 h-3.5 text-teal-400" />
                              <span>{formatEventTime(event)}</span>
                            </div>
                            <span className="text-gray-400 text-[11px]">
                              {dur >= 60 ? `${Math.floor(dur / 60)}h ${dur % 60 ? `${dur % 60}m` : ''}` : `${dur}m`}
                            </span>
                          </div>

                          {/* Title & Description */}
                          <div className="pl-1.5">
                            <h4 className={`text-sm sm:text-base font-semibold leading-snug transition-colors ${
                              isCompleted
                                ? 'line-through text-gray-400'
                                : 'text-gray-100 group-hover:text-teal-200'
                            }`}>
                              {event.title || '(Untitled Event)'}
                            </h4>
                            {event.description && (
                              <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                                {event.description}
                              </p>
                            )}
                          </div>

                          {/* Footer Meta Row: Team avatars / Tasks */}
                          <div className="flex items-center justify-between pt-1 pl-1.5 text-xs text-gray-400 border-t border-gray-800/60">
                            {event.teamMembers && event.teamMembers.length > 0 ? (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <Users className="w-3 h-3 text-cyan-400" />
                                <span>{event.teamMembers.length} member{event.teamMembers.length > 1 ? 's' : ''}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400 font-mono">Personal block</span>
                            )}

                            {event.tasks && event.tasks.length > 0 && (
                              <div className="flex items-center gap-1 text-[11px] text-amber-400/90">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{event.tasks.filter((t) => t.completed).length}/{event.tasks.length} tasks</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    /* Instagram Empty State Card */
                    <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 bg-gray-900/30 rounded-2xl border border-dashed border-gray-800/80 my-auto">
                      <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-3 shadow-inner">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm sm:text-base font-semibold text-gray-200">
                        No Events Scheduled
                      </h4>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
                        Your calendar is open for deep focus, creative flow, or rest on {DAY_NAMES[date.getDay()]}.
                      </p>
                      {onCreateEvent && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onCreateEvent(date)}
                          className="mt-4 text-xs bg-gray-800/80 border-gray-700 hover:border-teal-400 hover:bg-gray-800 text-teal-300"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Schedule Event
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer Bar */}
                <div className="px-4 sm:px-6 py-2.5 bg-gray-950/60 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400 font-mono shrink-0">
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span>{dayEvents.length > 0 ? `${durationStr} planned` : '0h planned'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400 text-[10px]">
                    <span>↕ Scroll to swipe days</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

SimpleMultiDayCalendar.displayName = 'SimpleMultiDayCalendar';
export default SimpleMultiDayCalendar;
