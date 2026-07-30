import {
  ActivityCounts,
  Rate,
  SnapshotHistoryPoint,
  TimeSeriesPoint,
} from "../../../lib/types/metrics";

const numberFormatter = new Intl.NumberFormat("en-US");

/** Thousands-separated count, e.g. `1186` → `"1,186"`. */
export function formatCount(value: number): string {
  return numberFormatter.format(value);
}

/** `value` as a whole percentage of `total`; 0 when `total` is 0. */
export function percentOf(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

/** A {@link Rate} as a whole percentage; 0 when the denominator is 0. */
export function ratePercent(rate: Rate): number {
  return percentOf(rate.numerator, rate.denominator);
}

/** A rate's raw parts, e.g. `"5 of 8"` — the context a bare percentage hides. */
export function rateFraction(rate: Rate): string {
  return `${formatCount(rate.numerator)} of ${formatCount(rate.denominator)}`;
}

/**
 * Weekly-active over monthly-active, as a whole percentage.
 *
 * The standard stickiness ratio: of everyone who did something this month, what
 * share did something this week. Higher means people come back rather than
 * visiting once. Meaningless when nobody was active at all, hence the null.
 */
export function stickiness(engaged: ActivityCounts): number | null {
  return engaged.last30Days === 0
    ? null
    : Math.round((engaged.last7Days / engaged.last30Days) * 100);
}

/**
 * Rounds a day count to something a human reads at a glance: whole days once
 * past one, otherwise hours, because "0.3 days to first review" is not a
 * sentence anyone says.
 */
export function formatDuration(days: number): string {
  if (days < 1) {
    const hours = Math.max(1, Math.round(days * 24));
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  const whole = Math.round(days);
  return `${whole} ${whole === 1 ? "day" : "days"}`;
}

const relativeFormatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

/**
 * An ISO timestamp as "4 minutes ago".
 *
 * The dashboard previously printed `generatedAt` raw, which is precise and
 * unreadable — the only question anyone asks of it is whether the numbers are
 * stale, and a relative phrasing answers that without arithmetic.
 */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return "unknown";
  }

  const seconds = Math.round((timestamp - now) / 1000);
  const magnitude = Math.abs(seconds);

  if (magnitude < 60) return "just now";
  if (magnitude < 3600) return relativeFormatter.format(Math.round(seconds / 60), "minute");
  if (magnitude < 86400) return relativeFormatter.format(Math.round(seconds / 3600), "hour");
  return relativeFormatter.format(Math.round(seconds / 86400), "day");
}

/** Which running totals the snapshot history can produce a delta for. */
export type DeltaKey = "users" | "clubs" | "reviews";

/**
 * Change in a running total over the last `days`, or null when history doesn't
 * reach back that far.
 *
 * Read from the accumulated snapshots rather than a second query: the daily job
 * already stores these totals, so "1,186 users" can become "1,186, +34 this
 * week" for free. Returns null rather than 0 when there is no baseline — no
 * snapshot and no change look identical as a number but mean opposite things.
 */
export function deltaOverDays(
  history: SnapshotHistoryPoint[],
  key: DeltaKey,
  current: number,
  days: number,
  now: number = Date.now(),
): number | null {
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  // The newest snapshot at or before the cutoff — the closest thing to "what
  // this number was `days` ago". History is oldest-first, so scan backwards.
  const baseline = [...history]
    .reverse()
    .find((point) => Date.parse(`${point.capturedOn}T00:00:00Z`) <= cutoff);

  return baseline === undefined ? null : current - baseline.metrics.totals[key];
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

/**
 * Keeps roughly `target` labels on a category axis, blanking the rest.
 *
 * Twenty-six week buckets produce twenty-six ticks, which collide into an
 * unreadable band on a phone even rotated 45°. ag-charts has no "thin these
 * out" option for a category axis — it draws every category — so the axis keeps
 * all its ticks and the formatter returns an empty string for the ones between.
 * Anchored to the end so the most recent bucket is always labelled.
 */
export function thinLabels(count: number, target: number): (index: number) => boolean {
  const step = Math.max(1, Math.ceil(count / target));
  return (index) => (count - 1 - index) % step === 0;
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

export interface MergedWeek {
  weekStart: string;
  users: number;
  clubs: number;
  reviews: number;
}

/**
 * Puts the three weekly series on one shared week axis, zero-filling all of them.
 *
 * A grouped chart needs one row per category with a value for every series;
 * feeding it independently-bucketed arrays would silently misalign the bars
 * whenever one series had a week another didn't. The zero-filling matters for
 * the same reason it does anywhere here — `GROUP BY date_trunc` omits empty
 * weeks entirely, so an unfilled series compresses a quiet fortnight out of
 * existence rather than drawing the lull.
 */
export function mergeWeekly(
  users: TimeSeriesPoint[],
  clubs: TimeSeriesPoint[],
  reviews: TimeSeriesPoint[],
): MergedWeek[] {
  const all = [...users, ...clubs, ...reviews];
  const weeks = all.map((point) => parseWeek(point.weekStart));
  if (weeks.length === 0) {
    return [];
  }

  const userCounts = new Map(users.map((point) => [point.weekStart, point.count]));
  const clubCounts = new Map(clubs.map((point) => [point.weekStart, point.count]));
  const reviewCounts = new Map(reviews.map((point) => [point.weekStart, point.count]));

  const end = Math.max(...weeks);
  const merged: MergedWeek[] = [];

  let cursor = Math.min(...weeks);
  while (cursor <= end && merged.length < MAX_FILLED_WEEKS) {
    const weekStart = formatWeek(cursor);
    merged.push({
      weekStart,
      users: userCounts.get(weekStart) ?? 0,
      clubs: clubCounts.get(weekStart) ?? 0,
      reviews: reviewCounts.get(weekStart) ?? 0,
    });
    cursor += WEEK_MS;
  }

  return merged;
}
