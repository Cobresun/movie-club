<template>
  <WidgetShell
    title="Growth and activity"
    subtitle="Per week. Clubs created before 29 Jul 2026 are dated from their first review, so early weeks are approximate."
  >
    <VChart v-if="weeks.length > 0" :options="options" />
    <p v-else class="py-8 text-center text-sm text-slate-500">
      No signups, new clubs, or reviews in the last 26 weeks.
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import type { AgCartesianChartOptions } from "ag-charts-community";
import { computed } from "vue";

import { TimeSeriesPoint } from "../../../../lib/types/metrics";
import { integerTickStep, mergeWeekly, thinLabels } from "../formatMetrics";
import {
  axisLabelFontSize,
  baseChartOptions,
  baseLegendOptions,
  CLUB_SERIES_COLOR,
  MEMBER_SERIES_COLORS,
} from "@/common/chartPalette";
import VChart from "@/common/components/VChart.vue";
import WidgetShell from "@/common/components/WidgetShell.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

const props = defineProps<{
  users: TimeSeriesPoint[];
  clubs: TimeSeriesPoint[];
  reviews: TimeSeriesPoint[];
}>();

/** Roughly how many week labels the axis can carry at each breakpoint. */
const LABEL_TARGET_COMPACT = 6;
const LABEL_TARGET_WIDE = 13;

const isDesktop = useIsDesktop();
const compact = computed(() => !isDesktop.value);

const weeks = computed(() => mergeWeekly(props.users, props.clubs, props.reviews));

// Signups and new clubs share a scale; review volume is an order of magnitude
// larger and would flatten both to nothing on a shared axis. Hence two number
// axes — the point of putting these on one chart is reading acquisition against
// usage week by week, which needs each series legible in its own range.
const growthTickStep = computed(() =>
  integerTickStep(Math.max(0, ...weeks.value.flatMap((week) => [week.users, week.clubs]))),
);
const reviewTickStep = computed(() =>
  integerTickStep(Math.max(0, ...weeks.value.map((week) => week.reviews))),
);

const showLabel = computed(() =>
  thinLabels(weeks.value.length, compact.value ? LABEL_TARGET_COMPACT : LABEL_TARGET_WIDE),
);

// Two categorical series, so they take the first two identity slots of the
// shared palette — those are the pair validated for adjacent-colour separation
// against this widget surface. Reviews use the club-aggregate brand primary,
// which also separates the line from the bars.
const [usersColor, clubsColor] = MEMBER_SERIES_COLORS;

const options = computed<AgCartesianChartOptions>(() => ({
  ...baseChartOptions(compact.value),
  data: weeks.value,
  series: [
    { type: "bar", xKey: "weekStart", yKey: "users", yName: "New users", fill: usersColor },
    { type: "bar", xKey: "weekStart", yKey: "clubs", yName: "New clubs", fill: clubsColor },
    {
      type: "line",
      xKey: "weekStart",
      yKey: "reviews",
      yName: "Reviews",
      stroke: CLUB_SERIES_COLOR,
      marker: { enabled: !compact.value, size: 5, fill: CLUB_SERIES_COLOR },
    },
  ],
  legend: baseLegendOptions(compact.value),
  axes: [
    {
      type: "category",
      position: "bottom",
      label: {
        fontSize: axisLabelFontSize(compact.value),
        rotation: compact.value ? 45 : 0,
        // Every category still gets a tick; the thinned ones just carry no
        // text. ag-charts draws all categories on a category axis, so there is
        // no option to drop them — the formatter is the only lever.
        formatter: ({ value, index }: { value: string; index: number }) =>
          showLabel.value(index) ? value : "",
      },
    },
    {
      type: "number",
      position: "left",
      keys: ["users", "clubs"],
      // Counts are whole people and whole clubs; without an explicit step the
      // axis invents fractional ticks like 0.4 whenever the range is small.
      interval: { step: growthTickStep.value },
      label: { fontSize: axisLabelFontSize(compact.value) },
    },
    {
      type: "number",
      position: "right",
      keys: ["reviews"],
      interval: { step: reviewTickStep.value },
      label: { fontSize: axisLabelFontSize(compact.value), color: CLUB_SERIES_COLOR },
    },
  ],
}));
</script>
