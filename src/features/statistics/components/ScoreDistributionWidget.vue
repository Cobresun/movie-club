<template>
  <WidgetShell title="Score Distribution">
    <ag-charts :options="chartOptions" />
  </WidgetShell>
</template>

<script setup lang="ts">
import { AgCharts } from "ag-charts-vue3";
import { computed } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { Member } from "../../../../lib/types/club";
import { createHistogramOptions } from "../scoring";
import type { HistogramData, WorkStatsData } from "../types";

const props = defineProps<{
  workData: WorkStatsData[];
  members: Member[];
  histogramData: HistogramData[];
}>();

const chartOptions = computed(() =>
  createHistogramOptions({
    filteredWorkData: props.workData,
    histogramData: props.histogramData,
    members: props.members,
  }),
);
</script>
