<template>
  <div ref="host">
    <ag-charts :options="options" />
  </div>
</template>

<script setup lang="ts">
import type { AgChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-vue3";
import { onMounted, onUnmounted, ref } from "vue";

defineProps<{ options: AgChartOptions }>();

const host = ref<HTMLElement | null>(null);

// A tooltip opened by tapping a series has nothing to close it on a touch
// screen: AG Charts drops one when the pointer leaves the series area, and
// otherwise only once the whole chart has scrolled out of the viewport, so a
// tapped tooltip hangs over the chart for the rest of the page. Scrolling means
// the reader is done with that point — send the mouseleave the browser never
// will.
const dismissTooltip = () => {
  host.value?.querySelector(".ag-charts-series-area")?.dispatchEvent(new MouseEvent("mouseleave"));
};

onMounted(() => window.addEventListener("scroll", dismissTooltip, { passive: true }));
onUnmounted(() => window.removeEventListener("scroll", dismissTooltip));
</script>
