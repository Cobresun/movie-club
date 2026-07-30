/**
 * The statistics feature's single source of chart color truth.
 *
 * Three color roles, used the same way in every widget and chart:
 *
 * 1. **Member identity** — each member takes {@link memberSeriesColor} at their
 *    index in the club member list, so a member wears the same color in every
 *    chart on the page. The eight slots are a fixed-order categorical palette
 *    validated with the dataviz six-checks validator against the widget
 *    surface (#393E46): all slots sit in the dark lightness band with chroma
 *    ≥ 0.10; worst adjacent CVD ΔE is 10.3 (floor band), which is legal here
 *    because every multi-member chart also ships a legend naming each series,
 *    per-series tooltips, and surface-colored gaps between stacked segments.
 * 2. **Club aggregate** — single-series charts about the club as a whole
 *    (decade averages, activity, score spread) use {@link CLUB_SERIES_COLOR},
 *    the brand primary.
 * 3. **Sentiment** — "high/loved/above" vs "low/hated/below" accents in
 *    templates use Tailwind emerald/rose classes; charts that need the same
 *    semantics use {@link POSITIVE_COLOR} / {@link NEGATIVE_COLOR}.
 */
import type { AgCartesianChartOptions, AgChartLegendOptions } from "ag-charts-community";

/** Fixed-order categorical slots for member series. Never reordered. */
export const MEMBER_SERIES_COLORS = [
  "#3f97ee", // blue
  "#19ac77", // aqua
  "#c98500", // yellow
  "#008300", // green
  "#9085e9", // violet
  "#e66767", // red
  "#db5f8d", // magenta
  "#de6330", // orange
] as const;

/**
 * Color for the member at `index` in the club member list. Beyond eight
 * members the slots repeat; identity past that point leans on the legend and
 * tooltips (clubs that size are rare enough that we don't grow the palette).
 */
export function memberSeriesColor(index: number): string {
  return MEMBER_SERIES_COLORS[index % MEMBER_SERIES_COLORS.length];
}

/** Brand primary — every single-series "club as a whole" chart uses this. */
export const CLUB_SERIES_COLOR = "#2196F3";

/** Chart-side equivalents of the emerald/rose Tailwind sentiment classes. */
export const POSITIVE_COLOR = "#34d399"; // emerald-400
export const NEGATIVE_COLOR = "#fb7185"; // rose-400

/** The surface charts render on (Tailwind `lowBackground`). Used as the
 * spacer stroke between stacked segments so touching fills stay separable. */
export const CHART_SURFACE = "#393E46";

/**
 * Shared frame for every ag-chart on the statistics page. `compact` is the
 * phone rendering: shorter plot, smaller axis labels, no padding overhead —
 * the charts previously overflowed or squeezed their plot area on mobile.
 */
export function baseChartOptions(compact: boolean): AgCartesianChartOptions {
  return {
    theme: "ag-default-dark",
    background: { visible: false },
    height: compact ? 260 : 330,
    padding: compact
      ? { top: 8, right: 8, bottom: 0, left: 0 }
      : { top: 16, right: 16, bottom: 8, left: 8 },
  };
}

/** Compact bottom legend that doesn't eat the plot on small screens. */
export function baseLegendOptions(compact: boolean): AgChartLegendOptions {
  return {
    position: "bottom",
    item: {
      marker: { shape: "circle", size: compact ? 10 : 12 },
      paddingX: compact ? 12 : 16,
      paddingY: compact ? 4 : 8,
      label: { fontSize: compact ? 11 : 12 },
    },
  };
}

/** Axis label sizing for the two breakpoints; titles only when there's room. */
export function axisLabelFontSize(compact: boolean): number {
  return compact ? 10 : 12;
}
