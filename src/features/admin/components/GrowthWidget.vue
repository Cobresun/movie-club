<template>
  <WidgetShell
    title="Signups and new clubs"
    subtitle="Per week. Clubs created before 29 Jul 2026 are dated from their first review, so early weeks are approximate."
  >
    <ag-charts v-if="weeks.length > 0" :options="options" />
    <p v-else class="py-8 text-center text-sm text-slate-500">
      No signups or new clubs in the last 26 weeks.
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import type { AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-vue3";
import { computed } from "vue";

import { TimeSeriesPoint } from "../../../../lib/types/metrics";
import { integerTickStep, mergeWeekly } from "../formatMetrics";
import {
  axisLabelFontSize,
  baseChartOptions,
  baseLegendOptions,
  MEMBER_SERIES_COLORS,
} from "@/common/chartPalette";
import WidgetShell from "@/common/components/WidgetShell.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

const props = defineProps<{
  users: TimeSeriesPoint[];
  clubs: TimeSeriesPoint[];
}>();

const isDesktop = useIsDesktop();
const compact = computed(() => !isDesktop.value);

const weeks = computed(() => mergeWeekly(props.users, props.clubs));

const tickStep = computed(() =>
  integerTickStep(Math.max(0, ...weeks.value.flatMap((week) => [week.users, week.clubs]))),
);

// Two categorical series, so they take the first two identity slots of the
// shared palette — those are the pair validated for adjacent-colour separation
// against this widget surface. Single-series charts use CLUB_SERIES_COLOR instead.
const [usersColor, clubsColor] = MEMBER_SERIES_COLORS;

const options = computed<AgCartesianChartOptions>(() => ({
  ...baseChartOptions(compact.value),
  data: weeks.value,
  series: [
    { type: "bar", xKey: "weekStart", yKey: "users", yName: "New users", fill: usersColor },
    { type: "bar", xKey: "weekStart", yKey: "clubs", yName: "New clubs", fill: clubsColor },
  ],
  legend: baseLegendOptions(compact.value),
  axes: [
    {
      type: "category",
      position: "bottom",
      label: { fontSize: axisLabelFontSize(compact.value), rotation: compact.value ? 45 : 0 },
    },
    {
      type: "number",
      position: "left",
      // Counts are whole people and whole clubs; without an explicit step the
      // axis invents fractional ticks like 0.4 whenever the range is small.
      interval: { step: tickStep.value },
      label: { fontSize: axisLabelFontSize(compact.value) },
    },
  ],
}));
</script>
