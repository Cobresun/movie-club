<template>
  <WidgetShell v-if="hasTrendData" title="Score Trend Over Time">
    <p class="mb-4 text-sm text-slate-400">Rolling average score</p>
    <ag-charts :options="chartOptions" />
  </WidgetShell>
</template>

<script setup lang="ts">
import { AgCharts } from "ag-charts-vue3";
import { computed } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { type Member } from "../../../../lib/types/club.js";
import { createScoreTrendChartOptions } from "../scoring";
import { computeScoreTrend } from "../statsComputers";
import type { MovieData } from "../types";

const props = defineProps<{
  movieData: MovieData[];
  members: Member[];
}>();

const trendData = computed(() =>
  computeScoreTrend(props.movieData, props.members),
);

const hasTrendData = computed(() => trendData.value.size > 0);

const chartOptions = computed(() =>
  createScoreTrendChartOptions(trendData.value, props.members),
);
</script>
