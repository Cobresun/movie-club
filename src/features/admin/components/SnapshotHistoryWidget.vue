<template>
  <WidgetShell
    title="Activity over time"
    subtitle="From the daily snapshot job — the only record of numbers that expire from the live tables"
  >
    <ag-charts v-if="points.length > 1" :options="options" />
    <p v-else class="py-8 text-center text-sm text-slate-500">
      {{
        points.length === 0
          ? "No snapshots yet. The first one lands after the daily job next runs."
          : "Only one snapshot so far — a trend needs at least two days."
      }}
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import type { AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-vue3";
import { computed } from "vue";

import { SnapshotHistoryPoint } from "../../../../lib/types/metrics";
import {
  axisLabelFontSize,
  baseChartOptions,
  baseLegendOptions,
  MEMBER_SERIES_COLORS,
} from "@/common/chartPalette";
import WidgetShell from "@/common/components/WidgetShell.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

const props = defineProps<{
  history: SnapshotHistoryPoint[];
}>();

const isDesktop = useIsDesktop();
const compact = computed(() => !isDesktop.value);

const points = computed(() =>
  props.history.map((point) => ({
    date: point.capturedOn,
    engaged: point.metrics.engagedUsers.last30Days,
    signedIn: point.metrics.loggedInUsers.last30Days,
    activeClubs: point.metrics.activeClubs.last30Days,
  })),
);

// Same first-three identity slots the growth chart draws from, so a series keeps
// one colour across the dashboard rather than per-widget.
const [engagedColor, signedInColor, clubsColor] = MEMBER_SERIES_COLORS;

const options = computed<AgCartesianChartOptions>(() => ({
  ...baseChartOptions(compact.value),
  data: points.value,
  series: [
    { type: "line", xKey: "date", yKey: "engaged", yName: "Engaged users", stroke: engagedColor },
    { type: "line", xKey: "date", yKey: "signedIn", yName: "Signed in", stroke: signedInColor },
    { type: "line", xKey: "date", yKey: "activeClubs", yName: "Active clubs", stroke: clubsColor },
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
      label: { fontSize: axisLabelFontSize(compact.value) },
    },
  ],
}));
</script>
