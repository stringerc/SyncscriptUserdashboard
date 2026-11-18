import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEventsForDay,
  getEventsForWeek,
  getEventsForMonth,
  getMonthMatrix,
  formatTimeRange,
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

test('getEventsForDay filters events specifically on target day', () => {
  const target = new Date(2026, 10, 18, 12, 0).getTime();
  const dayEvents = getEventsForDay(SAMPLE_EVENTS, target);
  assert.equal(dayEvents.length, 2);
  assert.equal(dayEvents[0].id, 'e1');
  assert.equal(dayEvents[1].id, 'e2');
});

test('getEventsForWeek returns all events within the target week (Monday-Sunday)', () => {
  // Wed Nov 18 is part of week Mon Nov 16 to Sun Nov 22
  const target = new Date(2026, 10, 18).getTime();
  const weekEvents = getEventsForWeek(SAMPLE_EVENTS, target);
  assert.equal(weekEvents.length, 3);
  const ids = weekEvents.map((e) => e.id);
  assert.ok(ids.includes('e1'));
  assert.ok(ids.includes('e2'));
  assert.ok(ids.includes('e3'));
  assert.ok(!ids.includes('e4'));
  assert.ok(!ids.includes('e5'));
});

test('getEventsForMonth returns events for the given calendar month', () => {
  // Nov 2026 (month index 10)
  const target = new Date(2026, 10, 1).getTime();
  const monthEvents = getEventsForMonth(SAMPLE_EVENTS, target);
  assert.equal(monthEvents.length, 4);
  const ids = monthEvents.map((e) => e.id);
  assert.ok(!ids.includes('e5')); // Dec 2 is excluded
});

test('getMonthMatrix returns 7-column calendar matrix', () => {
  // Nov 2026 has 30 days. Nov 1 is Sunday.
  const matrix = getMonthMatrix(2026, 10);
  assert.ok(matrix.length >= 4 && matrix.length <= 6);
  // Each row has 7 days
  for (const week of matrix) {
    assert.equal(week.length, 7);
  }
  // Find Nov 18
  const nov18 = matrix.flat().find((d) => d.isCurrentMonth && d.dayNumber === 18);
  assert.ok(nov18, 'Nov 18 must be present in current month cells');
  assert.equal(nov18?.year, 2026);
  assert.equal(nov18?.month, 10);
});

test('formatTimeRange formats single times and ranges gracefully', () => {
  const start = new Date(2026, 10, 18, 9, 0).getTime();
  const end = new Date(2026, 10, 18, 10, 30).getTime();
  const range = formatTimeRange(start, end);
  assert.match(range, /9:00.*-.*10:30/i);

  const single = formatTimeRange(start);
  assert.match(single, /9:00/i);
});
