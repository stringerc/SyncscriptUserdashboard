/**
 * Cortex Calendar Date Utilities
 * Pure TypeScript date mathematics for day, week, and month calendar horizon views.
 */

export interface CalendarEventItem {
  id: string;
  title: string;
  start: number;
  end?: number;
  attendees?: number;
  attendeeNames?: string[];
  location?: string;
  category?: string;
}

export interface CalendarMatrixDay {
  date: Date;
  dayNumber: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  timestamp: number;
}

/** Check if two timestamps/dates fall on the same local calendar day */
export function isSameDay(t1: number | Date, t2: number | Date): boolean {
  const d1 = new Date(t1);
  const d2 = new Date(t2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/** Get start and end of day in local time */
export function getDayBounds(timestamp: number | Date): { start: number; end: number } {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  const start = d.getTime();
  d.setHours(23, 59, 59, 999);
  const end = d.getTime();
  return { start, end };
}

/** Get events falling on target calendar day */
export function getEventsForDay(events: CalendarEventItem[], targetDate: number | Date): CalendarEventItem[] {
  const { start, end } = getDayBounds(targetDate);
  return (events || [])
    .filter((e) => {
      const eStart = Number(e.start || 0);
      return eStart >= start && eStart <= end;
    })
    .sort((a, b) => a.start - b.start);
}

/**
 * Get start of week (Monday 00:00:00.000) and end of week (Sunday 23:59:59.999).
 */
export function getWeekBounds(targetDate: number | Date): { start: number; end: number; days: Date[] } {
  const d = new Date(targetDate);
  const day = d.getDay(); // 0 is Sun, 1 is Mon, ..., 6 is Sat
  // Convert so Monday is 0: (day + 6) % 7
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  d.setHours(0, 0, 0, 0);
  const start = d.getTime();

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(d);
    cur.setDate(d.getDate() + i);
    days.push(cur);
  }

  const endD = new Date(d);
  endD.setDate(d.getDate() + 6);
  endD.setHours(23, 59, 59, 999);
  const end = endD.getTime();

  return { start, end, days };
}

/** Get events falling in the week containing targetDate (Monday to Sunday) */
export function getEventsForWeek(events: CalendarEventItem[], targetDate: number | Date): CalendarEventItem[] {
  const { start, end } = getWeekBounds(targetDate);
  return (events || [])
    .filter((e) => {
      const eStart = Number(e.start || 0);
      return eStart >= start && eStart <= end;
    })
    .sort((a, b) => a.start - b.start);
}

/** Get events for the calendar month containing targetDate */
export function getEventsForMonth(events: CalendarEventItem[], targetDate: number | Date): CalendarEventItem[] {
  const d = new Date(targetDate);
  const year = d.getFullYear();
  const month = d.getMonth();

  const start = new Date(year, month, 1, 0, 0, 0, 0).getTime();
  const nextMonth = new Date(year, month + 1, 1, 0, 0, 0, 0);
  const end = nextMonth.getTime() - 1;

  return (events || [])
    .filter((e) => {
      const eStart = Number(e.start || 0);
      return eStart >= start && eStart <= end;
    })
    .sort((a, b) => a.start - b.start);
}

/**
 * Generate 7-column calendar matrix for year and month (0-11).
 * Columns represent Mon, Tue, Wed, Thu, Fri, Sat, Sun.
 */
export function getMonthMatrix(year: number, month: number): CalendarMatrixDay[][] {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  // Monday-based index: 0 is Mon, 6 is Sun
  const firstDayIndex = (firstOfMonth.getDay() + 6) % 7;
  const totalDays = lastOfMonth.getDate();

  const now = new Date();
  const weeks: CalendarMatrixDay[][] = [];
  let currentWeek: CalendarMatrixDay[] = [];

  // 1. Previous month trailing days
  const prevMonthLastDate = new Date(year, month, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dNum = prevMonthLastDate - i;
    const date = new Date(year, month - 1, dNum);
    currentWeek.push({
      date,
      dayNumber: dNum,
      month: (month + 11) % 12,
      year: month === 0 ? year - 1 : year,
      isCurrentMonth: false,
      isToday: isSameDay(date, now),
      timestamp: date.getTime(),
    });
  }

  // 2. Current month days
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month, d);
    currentWeek.push({
      date,
      dayNumber: d,
      month,
      year,
      isCurrentMonth: true,
      isToday: isSameDay(date, now),
      timestamp: date.getTime(),
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // 3. Next month leading days to complete final row
  if (currentWeek.length > 0) {
    let nextDay = 1;
    while (currentWeek.length < 7) {
      const date = new Date(year, month + 1, nextDay);
      currentWeek.push({
        date,
        dayNumber: nextDay,
        month: (month + 1) % 12,
        year: month === 11 ? year + 1 : year,
        isCurrentMonth: false,
        isToday: isSameDay(date, now),
        timestamp: date.getTime(),
      });
      nextDay++;
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

/** Format start and optional end time nicely */
export function formatTimeRange(start: number, end?: number): string {
  const s = new Date(start);
  const sStr = s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (!end || end <= start) return sStr;
  const e = new Date(end);
  const eStr = e.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${sStr} - ${eStr}`;
}
