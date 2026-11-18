import { describe, it, expect } from 'vitest';
import {
  getEventsForDay,
  getEventsForWeek,
  getEventsForMonth,
  getMonthMatrix,
  formatTimeRange,
  getRelativeDayLabel,
  type CalendarEventItem,
} from '../cortex-calendar-utils';

const SAMPLE_EVENTS: CalendarEventItem[] = [
  // Wednesday Nov 18, 2026 09:00 - 10:00 (1795010400000 = 2026-11-18T14:00:00Z)
  {
    id: 'e1',
    title: 'Morning Standup',
    start: new Date(2026, 10, 18, 9, 0).getTime(),
    end: new Date(2026, 10, 18, 9, 30).getTime(),
  },
  // Wednesday Nov 18, 2026 14:00 - 15:30
  {
    id: 'e2',
    title: 'Architecture Review',
    start: new Date(2026, 10, 18, 14, 0).getTime(),
    end: new Date(2026, 10, 18, 15, 30).getTime(),
  },
  // Thursday Nov 19, 2026 11:00
  {
    id: 'e3',
    title: 'Customer Demo',
    start: new Date(2026, 10, 19, 11, 0).getTime(),
  },
  // Previous week: Friday Nov 13, 2026
  {
    id: 'e4',
    title: 'Sprint Retrospective',
    start: new Date(2026, 10, 13, 16, 0).getTime(),
  },
  // Next month: Dec 2, 2026
  {
    id: 'e5',
    title: 'Quarterly Planning',
    start: new Date(2026, 11, 2, 10, 0).getTime(),
  },
];

describe('cortex-calendar-utils', () => {
  it('getEventsForDay filters events specifically on target day', () => {
    const target = new Date(2026, 10, 18, 12, 0).getTime();
    const dayEvents = getEventsForDay(SAMPLE_EVENTS, target);
    expect(dayEvents.length).toBe(2);
    expect(dayEvents[0].id).toBe('e1');
    expect(dayEvents[1].id).toBe('e2');
  });

  it('getEventsForWeek returns all events within the target week (Monday-Sunday)', () => {
    // Wed Nov 18 is part of week Mon Nov 16 to Sun Nov 22
    const target = new Date(2026, 10, 18).getTime();
    const weekEvents = getEventsForWeek(SAMPLE_EVENTS, target);
    expect(weekEvents.length).toBe(3);
    const ids = weekEvents.map((e) => e.id);
    expect(ids).toContain('e1');
    expect(ids).toContain('e2');
    expect(ids).toContain('e3');
    expect(ids).not.toContain('e4');
    expect(ids).not.toContain('e5');
  });

  it('getEventsForMonth returns events for the given calendar month', () => {
    // Nov 2026 (month index 10)
    const target = new Date(2026, 10, 1).getTime();
    const monthEvents = getEventsForMonth(SAMPLE_EVENTS, target);
    expect(monthEvents.length).toBe(4);
    const ids = monthEvents.map((e) => e.id);
    expect(ids).not.toContain('e5'); // Dec 2 is excluded
  });

  it('getMonthMatrix returns 7-column calendar matrix', () => {
    // Nov 2026 has 30 days. Nov 1 is Sunday.
    const matrix = getMonthMatrix(2026, 10);
    expect(matrix.length).toBeGreaterThanOrEqual(4);
    expect(matrix.length).toBeLessThanOrEqual(6);
    // Each row has 7 days
    for (const week of matrix) {
      expect(week.length).toBe(7);
    }
    // Find Nov 18
    const nov18 = matrix.flat().find((d) => d.isCurrentMonth && d.dayNumber === 18);
    expect(nov18).toBeDefined();
    expect(nov18?.year).toBe(2026);
    expect(nov18?.month).toBe(10);
  });

  it('formatTimeRange formats single times and ranges gracefully', () => {
    const start = new Date(2026, 10, 18, 9, 0).getTime();
    const end = new Date(2026, 10, 18, 10, 30).getTime();
    const range = formatTimeRange(start, end);
    expect(range).toMatch(/9:00.*-.*10:30/i);

    const single = formatTimeRange(start);
    expect(single).toMatch(/9:00/i);
  });

  it('getRelativeDayLabel returns TODAY, TOMORROW, YESTERDAY, and offset day strings', () => {
    const base = new Date(2026, 10, 18, 14, 0).getTime();
    const today = new Date(2026, 10, 18, 8, 0).getTime();
    const tomorrow = new Date(2026, 10, 19, 9, 0).getTime();
    const yesterday = new Date(2026, 10, 17, 23, 0).getTime();
    const in3Days = new Date(2026, 10, 21, 10, 0).getTime();
    const daysAgo = new Date(2026, 10, 14, 10, 0).getTime();

    expect(getRelativeDayLabel(today, base)).toBe('TODAY');
    expect(getRelativeDayLabel(tomorrow, base)).toBe('TOMORROW');
    expect(getRelativeDayLabel(yesterday, base)).toBe('YESTERDAY');
    expect(getRelativeDayLabel(in3Days, base)).toBe('IN 3 DAYS');
    expect(getRelativeDayLabel(daysAgo, base)).toBe('4 DAYS AGO');
  });
});
