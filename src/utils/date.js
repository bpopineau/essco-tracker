// src/utils/date.js
// ---- Date helpers used by multiple exports ---------------------------------
/** @param {unknown} input */ const toDate = (input) => {
  if (input instanceof Date) return input;
  if (typeof input === 'string' || typeof input === 'number') return new Date(input);
  return new Date(NaN);
};
/** @param {Date} d */ const isValidDate = (d) => !Number.isNaN(d.getTime());


const MS_DAY = 24 * 60 * 60 * 1000;

/** Pad to 2 digits */
/** @param {number} n */ const p2 = (n) => (n < 10 ? '0' + n : '' + n);

/** @param {string|number|Date|null|undefined} input */
export function parseDate(input) {
  if (input == null || input === '') return null;
  const d = toDate(input);
  return isValidDate(d) ? d : null;
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

/** @param {string|number|Date|null|undefined} d
 *  @param {Intl.DateTimeFormatOptions} [options]
 */
export function fmtDate(d, options) {
  const dd = toDate(d);
  if (!isValidDate(dd)) return '—';
  return dd.toLocaleDateString(undefined, options);
}

/** Today's date string (LOCAL, no UTC drift) — 'YYYY-MM-DD' */
export const todayStr = () => toISODate();

/**
 * Days until a given date string (LOCAL, ignores time-of-day).
 *  0 = today, 1 = tomorrow, -1 = yesterday.
 *  Returns NaN if input is empty/invalid.
 */
/** Compute whole days from `from` until `dateStr` (negative if in the past).
 * @param {string|number|Date|null|undefined} dateStr
 * @param {Date} [from=new Date()]
 * @returns {number}
 */
export function daysUntil(dateStr, from = new Date()) {
  const target = toDate(dateStr);
  const base   = toDate(from);
  if (!isValidDate(target) || !isValidDate(base)) return NaN;
  return Math.floor((target.getTime() - base.getTime()) / MS_DAY);
}

/** Absolute day difference between two dates (LOCAL, |a-b|) */
/** Absolute whole days between two dates.
 * @param {string|number|Date|null|undefined} a
 * @param {string|number|Date|null|undefined} b
 */
export function daysBetween(a, b) {
  const da = toDate(a);
  const db = toDate(b);
  if (!isValidDate(da) || !isValidDate(db)) return NaN;
  return Math.abs(Math.floor((da.getTime() - db.getTime()) / MS_DAY));
}

/** Add N days (returns a new Date) */
/** Add N days to a date-like input.
 * @param {string|number|Date|null|undefined} input
 * @param {number} [n=0]
 * @returns {Date|null}
 */
export function addDays(input, n = 0) {
  const d = toDate(input);
  if (!isValidDate(d)) return null;
  const out = new Date(d);
  out.setDate(out.getDate() + Number(n || 0));
  return out;
}

/** Compare two date-like values by day (returns -1,0,1; invalids sort last) */
/** Sort helper: earlier < later.
 * @param {string|number|Date|null|undefined} a
 * @param {string|number|Date|null|undefined} b
 * @returns {number}
 */
export function compareDates(a, b) {
  const da = toDate(a);
  const db = toDate(b);
  const va = isValidDate(da), vb = isValidDate(db);
  if (!va && !vb) return 0;
  if (!va) return 1;
  if (!vb) return -1;
  return Math.sign(da.getTime() - db.getTime());
}

/** Convenience flags */
/** @param {string|number|Date|null|undefined} d @param {Date} [ref] */
export const isToday = (d, ref = new Date()) => daysUntil(d, ref) === 0;
/** @param {string|number|Date|null|undefined} d @param {Date} [ref] */
export const isOverdue = (d, ref = new Date()) => {
  const diff = daysUntil(d, ref);
  return Number.isFinite(diff) && diff < 0;
};
/** @param {string|number|Date|null|undefined} d
 *  @param {number} [n=7] @param {Date} [ref]
 */
export const isWithinNextNDays = (d, n = 7, ref = new Date()) => {
  const diff = daysUntil(d, ref);
  return Number.isFinite(diff) && diff >= 0 && diff <= n;
};

/**
 * Relative label for due dates:
 *  - "Today", "Tomorrow", "Yesterday"
 *  - "in 3 days", "3 days ago"
 *  - Falls back to fmtDate when |days| > 30 (keeps UI calm)
 */
/** @param {string|number|Date|null|undefined} d @param {Date} [ref] */
export function formatRelative(d, ref = new Date()) {
  const k = daysUntil(d, ref);
  if (!Number.isFinite(k)) return '—';
  if (k === 0) return 'today';
  if (k === 1) return 'tomorrow';
  if (k === -1) return 'yesterday';
  return (k < 0 ? `${Math.abs(k)}d overdue` : `due in ${k}d`);
}
