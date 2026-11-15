// Location-agnostic calendar date helpers (avoids Date.toISOString().split('T')[0] UTC rollover bugs)

interface TemporalPlainDateLike {
  toString(): string;
}

interface TemporalNamespaceLike {
  Now?: {
    plainDateISO(): TemporalPlainDateLike;
  };
}

/**
 * Returns the user's local calendar date in ISO `YYYY-MM-DD` format.
 * Uses native `Temporal.Now.plainDateISO()` when available and falls back cleanly
 * to local Date fields without converting instants to UTC.
 */
export const getLocalCalendarDateString = (referenceDate?: Date): string => {
  if (!referenceDate) {
    const temporal = (globalThis as { Temporal?: TemporalNamespaceLike }).Temporal;
    if (temporal?.Now && typeof temporal.Now.plainDateISO === 'function') {
      try {
        return temporal.Now.plainDateISO().toString();
      } catch {
        // Fall through to local Date fields
      }
    }
  }

  const d = referenceDate || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns the lower bound timestamp to find completed sessions from "today" in the
 * user's local calendar.
 *
 * Because `sessions.date` is a `timestamptz` column that has historically stored bare
 * `YYYY-MM-DD` values (interpreted by Postgres as `YYYY-MM-DDT00:00:00Z`), querying
 * from the earlier of today's local calendar string (`YYYY-MM-DD`) and local midnight
 * ISO instant guarantees sessions completed during local evening hours remain active.
 */
export const getTodayCompletedQueryLowerBound = (referenceDate?: Date): string => {
  const d = referenceDate || new Date();
  const localCalendar = getLocalCalendarDateString(d);
  const utcMidnightForLocalDay = new Date(`${localCalendar}T00:00:00.000Z`).getTime();
  const localMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const earliest = Math.min(utcMidnightForLocalDay, localMidnight);
  return new Date(earliest).toISOString();
};

/**
 * Extracts a bare `YYYY-MM-DD` calendar date string without performing a UTC->local
 * timezone shift that moves midnight UTC back one day in Western Hemisphere zones.
 */
export const extractCalendarDate = (raw?: string | null): string => {
  if (!raw) return '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw.split('T')[0] || '';
};

/**
 * Returns true if a session's stored calendar date matches today's local calendar date
 * OR if it was created on the current local calendar day.
 */
export const isSessionOnLocalToday = (
  session: { date?: string | null; created_at?: string | null },
  referenceDate?: Date
): boolean => {
  const todayLocal = getLocalCalendarDateString(referenceDate);
  const sessionDateOnly = extractCalendarDate(session.date);
  if (sessionDateOnly === todayLocal) return true;

  if (session.created_at) {
    const created = new Date(session.created_at);
    if (!Number.isNaN(created.getTime())) {
      return getLocalCalendarDateString(created) === todayLocal;
    }
  }
  return false;
};
