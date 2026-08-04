<template>
  <WidgetShell
    title="Activity over time"
    subtitle="From the daily snapshot job — the only record of numbers that expire from the live tables"
  >
    <template #controls>
      <SegmentedToggle
        :options="HISTORY_WINDOW_OPTIONS"
        :model-value="days"
        @update:model-value="emit('update:days', $event)"
      />
    </template>

    <ag-charts v-if="points.length > 1" :options="options" />
    <p v-else class="py-8 text-center text-sm text-slate-500">
      {{
        points.length === 0
          ? "No snapshots yet. The first one lands after the daily job next runs."
          : "Only one snapshot so far — a trend needs at least two days."
      }}
    </p>

    <p v-if="hasPartialHealth" class="mt-4 text-xs text-slate-500">
      The activation line starts where it does because snapshots taken before that metric existed
      don't carry it. It fills in from here.
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import type { AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-vue3";
import { computed } from "vue";

import { SnapshotHistoryPoint } from "../../../../lib/types/metrics";
import { percentOf, thinLabels } from "../formatMetrics";
import { HISTORY_WINDOW_OPTIONS, type HistoryWindow } from "../historyWindow";
import {
  axisLabelFontSize,
  baseChartOptions,
  baseLegendOptions,
  MEMBER_SERIES_COLORS,
} from "@/common/chartPalette";
import WidgetShell from "@/common/components/WidgetShell.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";
import SegmentedToggle from "@/features/statistics/components/SegmentedToggle.vue";

const LABEL_TARGET_COMPACT = 5;
const LABEL_TARGET_WIDE = 12;

const props = defineProps<{
  history: SnapshotHistoryPoint[];
  days: HistoryWindow;
}>();

const emit = defineEmits<{
  (e: "update:days", value: HistoryWindow): void;
}>();

const isDesktop = useIsDesktop();
const compact = computed(() => !isDesktop.value);

const points = computed(() =>
  props.history.map((point) => ({
    date: point.capturedOn,
    engaged: point.metrics.engagedUsers.last30Days,
    signedIn: point.metrics.loggedInUsers.last30Days,
    activeClubs: point.metrics.activeClubs.last30Days,
    // `health` is optional on the snapshot schema so older captures still parse.
    // ag-charts renders a gap for undefined rather than dropping to zero, which
    // is the honest rendering of "not recorded".
    activation:
      point.metrics.health === undefined
        ? undefined
        : percentOf(
            point.metrics.health.newUserActivation.numerator,
            point.metrics.health.newUserActivation.denominator,
          ),
  })),
);

/** Some snapshots predate the health metrics, so one series starts mid-chart. */
const hasPartialHealth = computed(
  () =>
    points.value.some((point) => point.activation === undefined) &&
    points.value.some((point) => point.activation !== undefined),
);

const showLabel = computed(() =>
  thinLabels(points.value.length, compact.value ? LABEL_TARGET_COMPACT : LABEL_TARGET_WIDE),
);

// Same first identity slots the growth chart draws from, so a series keeps one
// colour across the dashboard rather than per-widget.
const [engagedColor, signedInColor, clubsColor, activationColor] = MEMBER_SERIES_COLORS;

const options = computed<AgCartesianChartOptions>(() => ({
  ...baseChartOptions(compact.value),
  data: points.value,
  series: [
    { type: "line", xKey: "date", yKey: "engaged", yName: "Engaged users", stroke: engagedColor },
    { type: "line", xKey: "date", yKey: "signedIn", yName: "Signed in", stroke: signedInColor },
    { type: "line", xKey: "date", yKey: "activeClubs", yName: "Active clubs", stroke: clubsColor },
    {
      type: "line",
      xKey: "date",
      yKey: "activation",
      yName: "New-user activation %",
      stroke: activationColor,
      strokeWidth: 2,
      lineDash: [4, 3],
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
        formatter: ({ value, index }: { value: string; index: number }) =>
          showLabel.value(index) ? value : "",
      },
    },
    {
      type: "number",
      position: "left",
      keys: ["engaged", "signedIn", "activeClubs"],
      label: { fontSize: axisLabelFontSize(compact.value) },
    },
    {
      // Activation is a percentage; pinning it to 0–100 keeps it readable
      // against the counts instead of being rescaled by them.
      type: "number",
      position: "right",
      keys: ["activation"],
      min: 0,
      max: 100,
      label: { fontSize: axisLabelFontSize(compact.value), formatter: ({ value }) => `${value}%` },
    },
  ],
}));
</script>
