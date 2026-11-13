/**
 * The date operations the app needs, on the platform's own `Date` and `Intl`.
 * These are on every page's first load, which is why they are not a library.
 */

/** Which wall clock a date's calendar fields are read on. */
export type DateZone = "local" | "utc";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;
const HAS_UTC_OFFSET = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/u;

/**
 * Parses an ISO 8601 date or date-time. A string that names no offset is read
 * in `zone`, and that includes a bare calendar date: `new Date("2024-05-01")`
 * alone means midnight UTC, which is the evening of April 30th for anyone west
 * of Greenwich. An unparseable string gives an invalid `Date`.
 */
export function parseIsoDate(iso: string, zone: DateZone = "local"): Date {
  if (DATE_ONLY.test(iso)) {
    return new Date(zone === "utc" ? `${iso}T00:00:00Z` : `${iso}T00:00:00`);
  }
  if (zone === "utc" && iso.includes("T") && !HAS_UTC_OFFSET.test(iso)) {
    return new Date(`${iso}Z`);
  }
  return new Date(iso);
}

const isValid = (date: Date) => !Number.isNaN(date.getTime());

const DATE_STYLES = {
  /** 1/5/2024 */
  short: { year: "numeric", month: "numeric", day: "numeric" },
  /** Jan 5, 2024 */
  medium: { year: "numeric", month: "short", day: "numeric" },
  /** January 5, 2024 */
  full: { year: "numeric", month: "long", day: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateStyle = keyof typeof DATE_STYLES;

/**
 * An ISO date in the reader's locale, or undefined when it does not parse.
 * `zone` is both how an offset-less string is read and the clock the calendar
 * day is taken from.
 */
export function formatIsoDate(
  iso: string,
  style: DateStyle,
  zone: DateZone = "local",
): string | undefined {
  const date = parseIsoDate(iso, zone);
  if (!isValid(date)) return undefined;
  return new Intl.DateTimeFormat(undefined, {
    ...DATE_STYLES[style],
    ...(zone === "utc" ? { timeZone: "UTC" } : {}),
  }).format(date);
}

/** The calendar year an ISO date falls in on the UTC clock. */
export function utcYear(iso: string): number {
  return parseIsoDate(iso, "utc").getUTCFullYear();
}

/** A date as the `yyyy-MM-dd` an `<input type="date">` holds, on the local clock. */
export function toDateInputValue(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The instant a `yyyy-MM-dd` from a date input starts at on the local clock,
 * as an ISO string, or undefined when the value is not a date.
 */
export function dateInputValueToIso(value: string): string | undefined {
  if (!DATE_ONLY.test(value)) return undefined;
  const date = parseIsoDate(value);
  return isValid(date) ? date.toISOString() : undefined;
}

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** `date` moved by whole calendar months, keeping to the month's last day
 * rather than spilling into the next (January 31st + 1 month is February 28th). */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const daysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, daysInMonth));
  return result;
}

/** Whole calendar months from `earlier` to `later`. */
function wholeMonthsBetween(earlier: Date, later: Date): number {
  const months =
    (later.getFullYear() - earlier.getFullYear()) * 12 + (later.getMonth() - earlier.getMonth());
  return addMonths(earlier, months) > later ? months - 1 : months;
}

/** Whole calendar days from `earlier` to `later`: a day the clocks change on
 * still counts as one day, whether it lasted 23 hours or 25. */
function wholeDaysBetween(earlier: Date, later: Date): number {
  const calendarDay = (date: Date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY;
  const days = calendarDay(later) - calendarDay(earlier);
  const cursor = new Date(earlier);
  cursor.setDate(cursor.getDate() + days);
  return cursor > later ? days - 1 : days;
}

/**
 * How long ago (or how far ahead) an ISO timestamp is, in the largest unit
 * that has fully elapsed: "3 days ago", "in 2 hours". Undefined when the
 * timestamp does not parse.
 */
export function relativeTime(iso: string, now: Date = new Date()): string | undefined {
  const then = parseIsoDate(iso);
  if (!isValid(then)) return undefined;

  const isPast = then < now;
  const [earlier, later] = isPast ? [then, now] : [now, then];
  const elapsed = later.getTime() - earlier.getTime();
  const months = wholeMonthsBetween(earlier, later);

  const counts: [Intl.RelativeTimeFormatUnit, number][] = [
    ["years", Math.trunc(months / 12)],
    ["months", months],
    ["days", wholeDaysBetween(earlier, later)],
    ["hours", Math.trunc(elapsed / MS_PER_HOUR)],
    ["minutes", Math.trunc(elapsed / MS_PER_MINUTE)],
    ["seconds", Math.trunc(elapsed / MS_PER_SECOND)],
  ];
  const [unit, count] = counts.find(([, value]) => value >= 1) ?? ["seconds", 0];

  // `numeric: "always"` keeps it to counts ("1 day ago", never "yesterday").
  // Under a second ago the count is negative zero, which is what makes the
  // formatter say "0 seconds ago" rather than "in 0 seconds".
  return new Intl.RelativeTimeFormat(undefined, { numeric: "always" }).format(
    isPast ? -count : count,
    unit,
  );
}
