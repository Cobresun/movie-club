import { MetricsRange } from "../../../lib/types/metrics";

/**
 * The time frames the dashboard's picker offers, and how each reads in a
 * sentence. A plain module rather than exports from a component: a
 * `<script setup>` block cannot contain ES module exports.
 */
export const RANGE_OPTIONS: readonly { value: MetricsRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

const RANGE_PHRASES: Record<MetricsRange, { within: string; previous: string }> = {
  "7d": { within: "in the last 7 days", previous: "vs prior 7 days" },
  "30d": { within: "in the last 30 days", previous: "vs prior 30 days" },
  "90d": { within: "in the last 90 days", previous: "vs prior 90 days" },
  "1y": { within: "in the last year", previous: "vs prior year" },
  all: { within: "yet", previous: "" },
};

/** "in the last 7 days" — completes "No reviews …". */
export function rangeWithin(range: MetricsRange): string {
  return RANGE_PHRASES[range].within;
}

/** "vs prior 7 days" — the caption under a period-over-period change. */
export function rangePrevious(range: MetricsRange): string {
  return RANGE_PHRASES[range].previous;
}
