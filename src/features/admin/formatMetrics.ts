import { BucketUnit, PeriodCount, Rate } from "../../../lib/types/metrics";

const numberFormatter = new Intl.NumberFormat("en-US");

/** Thousands-separated count, e.g. `1186` → `"1,186"`. */
export function formatCount(value: number): string {
  return numberFormatter.format(value);
}

/** `value` as a whole percentage of `total`; 0 when `total` is 0. */
export function percentOf(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

/** A {@link Rate} as a whole percentage, or null when there is no denominator to take one of. */
export function ratePercent(rate: Rate): number | null {
  return rate.denominator === 0 ? null : percentOf(rate.numerator, rate.denominator);
}

/** A rate's raw parts, e.g. `"5 of 8"` — the context a bare percentage hides. */
export function rateFraction(rate: Rate): string {
  return `${formatCount(rate.numerator)} of ${formatCount(rate.denominator)}`;
}

export interface Change {
  label: string;
  direction: "up" | "down" | "flat";
}

/**
 * How a count moved against the period before it, or null when there is no
 * period before (the all-time range).
 *
 * A percentage when there is a base to take one of; from zero, the absolute
 * change instead, since "+∞%" says nothing and "+3" says exactly what happened.
 */
export function formatChange({ current, previous }: PeriodCount): Change | null {
  if (previous === null) {
    return null;
  }
  if (current === previous) {
    return { label: "No change", direction: "flat" };
  }
  const direction = current > previous ? "up" : "down";
  const sign = direction === "up" ? "+" : "−";
  if (previous === 0) {
    return { label: `${sign}${formatCount(Math.abs(current - previous))}`, direction };
  }
  const percent = Math.round((Math.abs(current - previous) / previous) * 100);
  return { label: `${sign}${percent}%`, direction };
}

const relativeFormatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

/**
 * An ISO timestamp as "4 minutes ago". Scales up through days to months and
 * years, because "412 days ago" makes the reader do the division.
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
  if (magnitude < 86400 * 45) return relativeFormatter.format(Math.round(seconds / 86400), "day");
  if (magnitude < 86400 * 365) {
    return relativeFormatter.format(Math.round(seconds / (86400 * 30)), "month");
  }
  return relativeFormatter.format(Math.round(seconds / (86400 * 365)), "year");
}

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** A bucket's start date as an axis label: "Sep 21" for days and weeks, "Sep 2026" for months. */
export function formatBucket(bucket: string, unit: BucketUnit): string {
  const date = new Date(`${bucket}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return bucket;
  }
  return unit === "month" ? monthFormatter.format(date) : dayFormatter.format(date);
}

/** Names shown inline before the rest collapse into a "+N" tail. */
const MAX_NAMES = 3;

/**
 * Member names, truncated so a large club can't blow out the row. The names
 * are the point — a count of four says nothing about whether it's four
 * strangers or four people you know — but a long list would wrap the row.
 */
export function memberSummary(names: string[]): string {
  if (names.length === 0) {
    return "No members";
  }
  if (names.length <= MAX_NAMES) {
    return names.join(", ");
  }
  return `${names.slice(0, MAX_NAMES).join(", ")} +${names.length - MAX_NAMES}`;
}

/** "1 review", "3 reviews" — a count with its noun agreeing. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

/**
 * Keeps roughly `target` labels on a category axis, blanking the rest.
 *
 * Thirty day buckets produce thirty ticks, which collide into an unreadable
 * band on a phone. ag-charts has no "thin these out" option for a category
 * axis — it draws every category — so the axis keeps all its ticks and the
 * formatter returns an empty string for the ones between. Anchored to the end
 * so the most recent bucket is always labelled.
 */
export function thinLabels(count: number, target: number): (index: number) => boolean {
  const step = Math.max(1, Math.ceil(count / target));
  return (index) => (count - 1 - index) % step === 0;
}

/**
 * A tick step that keeps a count axis on whole numbers. ag-charts subdivides
 * freely when the range is small, which is exactly when a quiet week leaves
 * the maximum at 1 and the axis invents "0.4 reviews".
 */
export function integerTickStep(max: number, targetTicks = 5): number {
  return Math.max(1, Math.ceil(max / targetTicks));
}
