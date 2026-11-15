import { describe, expect, it, afterEach } from 'vitest';
import {
  extractCalendarDate,
  getLocalCalendarDateString,
  getTodayCompletedQueryLowerBound,
  isSessionOnLocalToday,
} from './date';

describe('date utilities (UTC rollover & timezone safety)', () => {
  const originalTemporal = (globalThis as { Temporal?: unknown }).Temporal;

  afterEach(() => {
    (globalThis as { Temporal?: unknown }).Temporal = originalTemporal;
  });

  it('formats reference dates using local calendar components instead of UTC', () => {
    // 11:45 PM local time on Nov 14 is Nov 15 in UTC for all Western Hemisphere zones
    const lateLocalEvening = new Date(2026, 10, 14, 23, 45, 0);
    expect(getLocalCalendarDateString(lateLocalEvening)).toBe('2026-11-14');

    const earlyJan = new Date(2026, 0, 5, 0, 5, 0);
    expect(getLocalCalendarDateString(earlyJan)).toBe('2026-01-05');
  });

  it('uses Temporal.Now.plainDateISO() when available and falls back cleanly on error', () => {
    (globalThis as { Temporal?: unknown }).Temporal = {
      Now: {
        plainDateISO: () => ({ toString: () => '2026-11-14' }),
      },
    };
    expect(getLocalCalendarDateString()).toBe('2026-11-14');

    (globalThis as { Temporal?: unknown }).Temporal = {
      Now: {
        plainDateISO: () => {
          throw new Error('Temporal unavailable');
        },
      },
    };
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(getLocalCalendarDateString()).toBe(expected);
  });

  it('extracts YYYY-MM-DD without shifting UTC midnight backwards a day', () => {
    expect(extractCalendarDate('2026-11-15T00:00:00Z')).toBe('2026-11-15');
    expect(extractCalendarDate('2026-11-15T04:30:00.000Z')).toBe('2026-11-15');
    expect(extractCalendarDate('2026-11-14')).toBe('2026-11-14');
    expect(extractCalendarDate(null)).toBe('');
    expect(extractCalendarDate(undefined)).toBe('');
  });

  it('computes completed-session query lower bound covering both local midnight and bare date strings', () => {
    const lateEvening = new Date(2026, 10, 14, 22, 30, 0);
    const lowerBound = getTodayCompletedQueryLowerBound(lateEvening);
    const lowerBoundMs = new Date(lowerBound).getTime();

    const localMidnightMs = new Date(2026, 10, 14, 0, 0, 0).getTime();
    const utcMidnightSameDateMs = new Date('2026-11-14T00:00:00.000Z').getTime();

    expect(lowerBoundMs).toBeLessThanOrEqual(localMidnightMs);
    expect(lowerBoundMs).toBeLessThanOrEqual(utcMidnightSameDateMs);
  });

  it('keeps a completed session active throughout the local calendar evening', () => {
    const refEvening = new Date(2026, 10, 14, 22, 30, 0);

    // Session stored as bare calendar date (normalized by Postgres to 00:00:00Z)
    expect(
      isSessionOnLocalToday({ date: '2026-11-14T00:00:00Z', created_at: null }, refEvening)
    ).toBe(true);

    // Session whose created_at falls on the local calendar day even if date text differed
    const createdSameLocalEvening = new Date(2026, 10, 14, 20, 15, 0).toISOString();
    expect(
      isSessionOnLocalToday({ date: '2026-11-13', created_at: createdSameLocalEvening }, refEvening)
    ).toBe(true);

    // Session from yesterday in both date and created_at
    const yesterdayLocal = new Date(2026, 10, 13, 18, 0, 0).toISOString();
    expect(
      isSessionOnLocalToday({ date: '2026-11-13T00:00:00Z', created_at: yesterdayLocal }, refEvening)
    ).toBe(false);
  });
});
