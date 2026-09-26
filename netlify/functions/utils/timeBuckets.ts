import { BucketUnit } from "../../../lib/types/metrics.js";

/** Guards against a malformed range sending the fill loop unbounded. */
const MAX_BUCKETS = 1000;

/** UTC calendar date, `YYYY-MM-DD`. */
function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * The UTC start of the bucket containing `at`, matching what the database's
 * `date_trunc` produces in a UTC session: midnight, the ISO-week Monday, or
 * the first of the month.
 */
export function bucketStart(unit: BucketUnit, at: Date): Date {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  if (unit === "day") {
    return day;
  }
  if (unit === "week") {
    const sinceMonday = (day.getUTCDay() + 6) % 7;
    day.setUTCDate(day.getUTCDate() - sinceMonday);
    return day;
  }
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

function nextBucket(unit: BucketUnit, start: Date): Date {
  const next = new Date(start);
  if (unit === "day") {
    next.setUTCDate(next.getUTCDate() + 1);
  } else if (unit === "week") {
    next.setUTCDate(next.getUTCDate() + 7);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

/**
 * Every bucket from the one containing `from` to the one containing `to`, with
 * `rows` placed where they fall and `empty()` everywhere else.
 *
 * `GROUP BY date_trunc(…)` omits buckets that had nothing in them, so charting
 * the raw rows would compress a quiet fortnight out of existence rather than
 * draw the lull.
 */
export function fillBuckets<T extends { bucket: string }>(
  unit: BucketUnit,
  from: Date,
  to: Date,
  rows: T[],
  empty: (bucket: string) => T,
): T[] {
  const byBucket = new Map(rows.map((row) => [row.bucket, row]));
  const filled: T[] = [];

  let cursor = bucketStart(unit, from);
  const end = bucketStart(unit, to).getTime();
  while (cursor.getTime() <= end && filled.length < MAX_BUCKETS) {
    const key = toIsoDate(cursor);
    filled.push(byBucket.get(key) ?? empty(key));
    cursor = nextBucket(unit, cursor);
  }

  return filled;
}
