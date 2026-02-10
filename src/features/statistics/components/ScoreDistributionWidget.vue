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
import type { HistogramData, MovieData } from "../types";

const props = defineProps<{
  movieData: MovieData[];
  members: Member[];
  histogramData: HistogramData[];
}>();

const chartOptions = computed(() =>
  createHistogramOptions({
    filteredMovieData: props.movieData,
    histogramData: props.histogramData,
    members: props.members,
  }),
);
</script>
