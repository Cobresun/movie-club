import { TimeSeriesPoint } from "../../../lib/types/metrics";

const numberFormatter = new Intl.NumberFormat("en-US");

/** Thousands-separated count, e.g. `1186` → `"1,186"`. */
export function formatCount(value: number): string {
  return numberFormatter.format(value);
}

/** `value` as a whole percentage of `total`; 0 when `total` is 0. */
export function percentOf(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

/**
 * A tick step that keeps a count axis on whole numbers.
 *
 * These axes count people, clubs, and reviews, so "0.4 new users" is meaningless
 * — but ag-charts subdivides freely when the range is small, which is exactly
 * when a quiet week leaves the maximum at 1. (`interval.minSpacing` does not help:
 * it constrains pixel spacing, not the value step.)
 */
export function integerTickStep(max: number, targetTicks = 6): number {
  return Math.max(1, Math.ceil(max / targetTicks));
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Guards against a malformed bucket sending the fill loop unbounded. */
const MAX_FILLED_WEEKS = 520;

function parseWeek(weekStart: string): number {
  return Date.parse(`${weekStart}T00:00:00Z`);
}

function formatWeek(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * Inserts zero-count buckets for weeks absent from the series.
 *
 * `GROUP BY date_trunc('week', …)` only emits weeks that had at least one row,
 * so a quiet fortnight simply vanishes from the result. Plotted as-is, the gap
 * closes up and two weeks of silence render identically to two busy weeks
 * side by side — the chart compresses time instead of showing the lull.
 *
 * Dates are handled in UTC throughout: the buckets are produced by Postgres in
 * UTC, and parsing `YYYY-MM-DD` as local time would drift the week boundary for
 * anyone west of Greenwich.
 */
export function fillMissingWeeks(points: TimeSeriesPoint[]): TimeSeriesPoint[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) {
    return [];
  }

  const byWeek = new Map(points.map((point) => [point.weekStart, point.count]));
  const filled: TimeSeriesPoint[] = [];

  const end = parseWeek(last.weekStart);
  let cursor = parseWeek(first.weekStart);

  while (cursor <= end && filled.length < MAX_FILLED_WEEKS) {
    const weekStart = formatWeek(cursor);
    filled.push({ weekStart, count: byWeek.get(weekStart) ?? 0 });
    cursor += WEEK_MS;
  }

  return filled;
}

export interface MergedWeek {
  weekStart: string;
  users: number;
  clubs: number;
}

/**
 * Puts two weekly series on one shared week axis, zero-filling both.
 *
 * A grouped bar chart needs one row per category with a value for every series;
 * feeding it two independently-bucketed arrays would silently misalign the bars
 * whenever one series had a week the other didn't.
 */
export function mergeWeekly(users: TimeSeriesPoint[], clubs: TimeSeriesPoint[]): MergedWeek[] {
  const weeks = [...users, ...clubs].map((point) => parseWeek(point.weekStart));
  if (weeks.length === 0) {
    return [];
  }

  const userCounts = new Map(users.map((point) => [point.weekStart, point.count]));
  const clubCounts = new Map(clubs.map((point) => [point.weekStart, point.count]));

  const end = Math.max(...weeks);
  const merged: MergedWeek[] = [];

  let cursor = Math.min(...weeks);
  while (cursor <= end && merged.length < MAX_FILLED_WEEKS) {
    const weekStart = formatWeek(cursor);
    merged.push({
      weekStart,
      users: userCounts.get(weekStart) ?? 0,
      clubs: clubCounts.get(weekStart) ?? 0,
    });
    cursor += WEEK_MS;
  }

  return merged;
}
