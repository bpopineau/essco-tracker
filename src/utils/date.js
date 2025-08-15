
// src/utils/date.js

const MS_DAY = 86_400_000;

/** Pad to 2 digits */
const p2 = (n) => (n < 10 ? '0' + n : '' + n);

/**
 * Parse various date inputs to a Date in local time.
 * - 'YYYY-MM-DD' is parsed as LOCAL midnight (avoids UTC off-by-one).
 * - Date/number are passed through.
 * - Other strings fall back to Date's parser.
 */
export function parseDate(input) {
  if (input == null || input === '') return null;
  if (input instanceof Date) return new Date(input.getTime());
  if (typeof input === 'number') return new Date(input);

  if (typeof input === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
    if (m) {
      const [, y, mo, d] = m;
      return new Date(Number(y), Number(mo) - 1, Number(d));
    }
    const d = new Date(input);
    return isNaN(d) ? null : d;
  }
  return null;
}

/** Start-of-day (local) */
export function startOfDay(input = new Date()) {
  const d = parseDate(input) ?? new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Return 'YYYY-MM-DD' in LOCAL time for a date-like input */
export function toISODate(input = new Date()) {
  const d = parseDate(input) ?? new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Human-readable date (keeps prior API, adds optional Intl options) */
export function fmtDate(d, options) {
  const date = parseDate(d);
  if (!date) return '';
  try {
    return date.toLocaleDateString(undefined, options);
  } catch {
    // Very old engines: fall back
    return `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
  }
}

/** Today's date string (LOCAL, no UTC drift) — 'YYYY-MM-DD' */
export const todayStr = () => toISODate();

/**
 * Days until a given date string (LOCAL, ignores time-of-day).
 *  0 = today, 1 = tomorrow, -1 = yesterday.
 *  Returns NaN if input is empty/invalid.
 */
export function daysUntil(dateStr, from = new Date()) {
  if (!dateStr) return NaN;
  const target = startOfDay(dateStr);
  if (isNaN(target)) return NaN;
  const base = startOfDay(from);
  return Math.floor((target - base) / MS_DAY);
}

/** Absolute day difference between two dates (LOCAL, |a-b|) */
export function daysBetween(a, b) {
  const da = startOfDay(a);
  const db = startOfDay(b);
  if (isNaN(da) || isNaN(db)) return NaN;
  return Math.abs(Math.floor((da - db) / MS_DAY));
}

/** Add N days (returns a new Date) */
export function addDays(input, n = 0) {
  const d = startOfDay(input);
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + Number(n || 0));
  return d;
}

/** Compare two date-like values by day (returns -1,0,1; invalids sort last) */
export function compareDates(a, b) {
  const da = startOfDay(a);
  const db = startOfDay(b);
  if (isNaN(da) && isNaN(db)) return 0;
  if (isNaN(da)) return 1;
  if (isNaN(db)) return -1;
  return Math.sign(da - db);
}

/** Convenience flags */
export const isToday = (d, ref = new Date()) => daysUntil(d, ref) === 0;
export const isOverdue = (d, ref = new Date()) => {
  const n = daysUntil(d, ref);
  return !isNaN(n) && n < 0;
};
export const isWithinNextNDays = (d, n = 7, ref = new Date()) => {
  const k = daysUntil(d, ref);
  return !isNaN(k) && k >= 0 && k <= n;
};

/**
 * Relative label for due dates:
 *  - "Today", "Tomorrow", "Yesterday"
 *  - "in 3 days", "3 days ago"
 *  - Falls back to fmtDate when |days| > 30 (keeps UI calm)
 */
export function formatRelative(d, ref = new Date()) {
  const n = daysUntil(d, ref);
  if (isNaN(n)) return '';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (Math.abs(n) <= 30) return n > 0 ? `in ${n} days` : `${Math.abs(n)} days ago`;
  return fmtDate(d, { year: 'numeric', month: 'short', day: 'numeric' });
}
