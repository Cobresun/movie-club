<template>
  <WidgetShell title="Reviews logged" subtitle="Per week, across every club">
    <ag-charts v-if="weeks.length > 0" :options="options" />
    <p v-else class="py-8 text-center text-sm text-slate-500">
      No reviews logged in the last 26 weeks.
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import type { AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-vue3";
import { computed } from "vue";

import { TimeSeriesPoint } from "../../../../lib/types/metrics";
import { fillMissingWeeks, integerTickStep } from "../formatMetrics";
import { axisLabelFontSize, baseChartOptions, CLUB_SERIES_COLOR } from "@/common/chartPalette";
import WidgetShell from "@/common/components/WidgetShell.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

const props = defineProps<{
  reviews: TimeSeriesPoint[];
}>();

const isDesktop = useIsDesktop();
const compact = computed(() => !isDesktop.value);

// Zero-filled so a quiet fortnight reads as a gap rather than closing up.
const weeks = computed(() => fillMissingWeeks(props.reviews));

const tickStep = computed(() =>
  integerTickStep(Math.max(0, ...weeks.value.map((week) => week.count))),
);

const options = computed<AgCartesianChartOptions>(() => ({
  ...baseChartOptions(compact.value),
  data: weeks.value,
  series: [
    {
      type: "bar",
      xKey: "weekStart",
      yKey: "count",
      yName: "Reviews",
      fill: CLUB_SERIES_COLOR,
    },
  ],
  axes: [
    {
      type: "category",
      position: "bottom",
      label: { fontSize: axisLabelFontSize(compact.value), rotation: compact.value ? 45 : 0 },
    },
    {
      type: "number",
      position: "left",
      // Whole reviews only — see integerTickStep.
      interval: { step: tickStep.value },
      label: { fontSize: axisLabelFontSize(compact.value) },
    },
  ],
}));
</script>
