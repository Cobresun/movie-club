<template>
  <WidgetShell title="Scores" :subtitle="subtitle">
    <template #controls>
      <SegmentedToggle v-model="mode" :options="modeOptions" />
    </template>
    <ag-charts :options="chartOptions" />
  </WidgetShell>
</template>

<script setup lang="ts">
import { AgCharts } from "ag-charts-vue3";
import { computed, ref } from "vue";

import SegmentedToggle from "./SegmentedToggle.vue";
import WidgetShell from "./WidgetShell.vue";
import { Member } from "../../../../lib/types/club";
import {
  createHistogramOptions,
  createScoreTrendChartOptions,
  createScoreVarianceChartOptions,
} from "../scoring";
import { computeScoreTrend, computeScoreVariance } from "../statsComputers";
import type { HistogramData, WorkStatsData } from "../types";

import { useIsDesktop } from "@/common/composables/useIsDesktop";

type Mode = "distribution" | "trend" | "spread";

const props = defineProps<{
  workData: WorkStatsData[];
  members: Member[];
  histogramData: HistogramData[];
}>();

const isDesktop = useIsDesktop();
const compact = computed(() => !isDesktop.value);

const trendData = computed(() =>
  computeScoreTrend(props.workData, props.members),
);
const variancePoints = computed(() => computeScoreVariance(props.workData));

const modeOptions = computed(() => {
  const options: { value: Mode; label: string }[] = [
    { value: "distribution", label: "Distribution" },
  ];
  if (trendData.value.size > 0) {
    options.push({ value: "trend", label: "Trend" });
  }
  if (variancePoints.value.length > 0) {
    options.push({ value: "spread", label: "Agreement" });
  }
  return options;
});

// Fall back to the always-available tab if the selected one loses its data,
// instead of watching for changes (see code-quality.md on avoiding watch()).
const selectedMode = ref<Mode>("distribution");
const mode = computed<Mode>({
  get: () =>
    modeOptions.value.some((option) => option.value === selectedMode.value)
      ? selectedMode.value
      : "distribution",
  set: (value) => {
    selectedMode.value = value;
  },
});

const SUBTITLES: Record<Mode, string> = {
  distribution: "How often each score gets handed out, by member",
  trend: "Rolling average score per member over time",
  spread: "Rolling score spread — lower means more agreement",
};

const subtitle = computed(() => SUBTITLES[mode.value]);

const chartOptions = computed(() => {
  if (mode.value === "trend") {
    return createScoreTrendChartOptions(
      trendData.value,
      props.members,
      compact.value,
    );
  }
  if (mode.value === "spread") {
    return createScoreVarianceChartOptions(variancePoints.value, compact.value);
  }
  return createHistogramOptions({
    filteredWorkData: props.workData,
    histogramData: props.histogramData,
    members: props.members,
    compact: compact.value,
  });
});
</script>
