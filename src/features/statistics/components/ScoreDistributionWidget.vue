<template>
  <div class="mx-auto w-11/12">
    <div class="rounded-lg bg-lowBackground p-5">
      <h3 class="mb-4 text-lg font-bold text-white">Score Distribution</h3>
      <ag-charts :options="options" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-vue3";

defineProps<{
  options: AgCartesianChartOptions;
}>();
</script>
