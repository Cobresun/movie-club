<template>
  <WidgetShell
    title="Club health"
    subtitle="How big clubs get, how fast they start, and how many have gone quiet"
  >
    <div class="grid gap-5 lg:grid-cols-[3fr_2fr]">
      <div>
        <p class="mb-2 text-xs uppercase tracking-wide text-slate-400">Members per club</p>
        <VChart v-if="hasClubs" :options="options" />
        <p v-else class="py-8 text-center text-sm text-slate-500">No clubs yet.</p>
      </div>

      <div class="space-y-3">
        <div class="rounded-lg bg-background/50 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">Dormant clubs</p>
          <p class="mt-1 text-xl font-bold" :class="dormantTone">
            {{ formatCount(dormantClubs.numerator) }}
          </p>
          <p class="text-sm text-slate-400">
            of {{ formatCount(dormantClubs.denominator) }} that were ever active
          </p>
          <p class="mt-1 text-xs text-slate-500">
            No review, comment, or list item in {{ DORMANCY_DAYS }} days. Clubs that never did
            anything aren't counted — they never lapsed.
          </p>
        </div>

        <div class="rounded-lg bg-background/50 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">Time to first review</p>
          <p v-if="medianDaysToFirstReview !== null" class="mt-1 text-xl font-bold text-white">
            {{ formatDuration(medianDaysToFirstReview) }}
          </p>
          <p v-else class="mt-1 text-xl font-bold text-slate-600">—</p>
          <p class="mt-1 text-xs text-slate-500">
            Median, from club creation. Only clubs created since 29 Jul 2026 count — earlier ones
            were dated from their first review, so they'd all measure zero.
            <template v-if="medianDaysToFirstReview === null">
              {{ daysToFirstReviewSample }} so far; needs a few more to mean anything.
            </template>
            <template v-else> Across {{ daysToFirstReviewSample }} clubs. </template>
          </p>
        </div>
      </div>
    </div>
  </WidgetShell>
</template>

<script setup lang="ts">
import type { AgCartesianChartOptions } from "ag-charts-community";
import { computed } from "vue";

import { ClubSizeBucket, Rate } from "../../../../lib/types/metrics";
import { formatCount, formatDuration, integerTickStep } from "../formatMetrics";
import { axisLabelFontSize, baseChartOptions, CLUB_SERIES_COLOR } from "@/common/chartPalette";
import VChart from "@/common/components/VChart.vue";
import WidgetShell from "@/common/components/WidgetShell.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

/** Mirrors DORMANCY_DAYS in MetricsRepository, for the explanatory copy. */
const DORMANCY_DAYS = 90;

/** Above this share of ever-active clubs having lapsed, the number reads as a problem. */
const DORMANT_ALARM_PERCENT = 50;

const props = defineProps<{
  clubSizes: ClubSizeBucket[];
  dormantClubs: Rate;
  medianDaysToFirstReview: number | null;
  daysToFirstReviewSample: number;
}>();

const isDesktop = useIsDesktop();
const compact = computed(() => !isDesktop.value);

const hasClubs = computed(() => props.clubSizes.some((bucket) => bucket.clubs > 0));

const dormantTone = computed(() => {
  const { numerator, denominator } = props.dormantClubs;
  if (denominator === 0) return "text-slate-600";
  return (numerator / denominator) * 100 >= DORMANT_ALARM_PERCENT ? "text-rose-400" : "text-white";
});

const tickStep = computed(() =>
  integerTickStep(Math.max(0, ...props.clubSizes.map((bucket) => bucket.clubs))),
);

// Single-series chart about the club population as a whole, so it takes the
// brand primary rather than a categorical identity slot.
const options = computed<AgCartesianChartOptions>(() => ({
  ...baseChartOptions(compact.value),
  height: compact.value ? 200 : 240,
  data: props.clubSizes,
  series: [{ type: "bar", xKey: "label", yKey: "clubs", yName: "Clubs", fill: CLUB_SERIES_COLOR }],
  axes: [
    {
      type: "category",
      position: "bottom",
      label: { fontSize: axisLabelFontSize(compact.value) },
    },
    {
      type: "number",
      position: "left",
      // Whole clubs only — see integerTickStep.
      interval: { step: tickStep.value },
      label: { fontSize: axisLabelFontSize(compact.value) },
    },
  ],
}));
</script>
