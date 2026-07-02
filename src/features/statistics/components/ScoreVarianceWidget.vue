<template>
  <WidgetShell v-if="hasVarianceData" title="Club Variance Over Time">
    <p class="mb-4 text-sm text-slate-400">
      Rolling spread of member scores — lower means more agreement.
    </p>
    <ag-charts :options="chartOptions" />
  </WidgetShell>
</template>

<script setup lang="ts">
import { AgCharts } from "ag-charts-vue3";
import { computed } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { createScoreVarianceChartOptions } from "../scoring";
import { computeScoreVariance } from "../statsComputers";
import type { WorkStatsData } from "../types";

const props = defineProps<{
  workData: WorkStatsData[];
}>();

const variancePoints = computed(() => computeScoreVariance(props.workData));

const hasVarianceData = computed(() => variancePoints.value.length > 0);

const chartOptions = computed(() =>
  createScoreVarianceChartOptions(variancePoints.value),
);
</script>
