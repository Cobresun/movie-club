<template>
  <WidgetShell
    v-if="monthlyPoints.length > 0"
    title="Club Activity"
    :subtitle="subtitle"
  >
    <template #controls>
      <SegmentedToggle v-model="mode" :options="MODE_OPTIONS" />
    </template>

    <div v-if="mode === 'years'" class="space-y-2">
      <div
        v-for="entry in yearlyBest"
        :key="entry.year"
        class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2.5"
      >
        <span class="w-12 shrink-0 text-lg font-bold text-primary">
          {{ entry.year }}
        </span>
        <img
          v-if="entry.imageUrl"
          :src="entry.imageUrl"
          :alt="entry.title"
          class="h-14 w-10 shrink-0 rounded object-cover"
        />
        <div
          v-else
          class="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-slate-700/50 text-xs text-slate-500"
        >
          ?
        </div>
        <div class="min-w-0 flex-1 text-left">
          <p
            class="w-fit max-w-full truncate text-sm font-medium text-white"
            :title="entry.title"
          >
            {{ entry.title }}
          </p>
          <p class="mt-1 text-xs text-slate-400">
            {{ entry.workCount }}
            {{ entry.workCount === 1 ? noun : `${noun}s` }} reviewed
          </p>
        </div>
        <span
          class="shrink-0 rounded-full bg-emerald-900/30 px-2.5 py-1 text-sm font-bold text-emerald-400"
        >
          {{ entry.average.toFixed(1) }}
        </span>
      </div>
    </div>
    <ag-charts v-else :options="chartOptions" />
  </WidgetShell>
</template>

<script setup lang="ts">
import { AgCharts } from "ag-charts-vue3";
import { computed, ref } from "vue";

import SegmentedToggle from "./SegmentedToggle.vue";
import WidgetShell from "./WidgetShell.vue";
import { ClubType } from "../../../../lib/types/generated/db";
import {
  createCumulativeCountChartOptions,
  createMonthlyActivityChartOptions,
} from "../scoring";
import {
  computeCumulativeCounts,
  computeHighestRatedByYear,
  computeMonthlyActivity,
} from "../statsComputers";
import type { WorkStatsData } from "../types";

import { clubTypeConfig, clubTypeStats } from "@/common/clubType";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

type Mode = "monthly" | "total" | "years";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "total", label: "All Time" },
  { value: "years", label: "Best of Year" },
];

const props = defineProps<{
  workData: WorkStatsData[];
  clubType: ClubType;
}>();

const isDesktop = useIsDesktop();
const compact = computed(() => !isDesktop.value);

const mode = ref<Mode>("monthly");

const noun = computed(() => clubTypeConfig(props.clubType).noun);
const pluralNoun = computed(() => clubTypeStats(props.clubType).pluralNoun);

const subtitle = computed(() => {
  if (mode.value === "monthly") return `${pluralNoun.value} reviewed per month`;
  if (mode.value === "total")
    return `Total ${pluralNoun.value.toLowerCase()} reviewed over time`;
  return `The top-rated ${noun.value} from each year your club reviewed`;
});

const monthlyPoints = computed(() => computeMonthlyActivity(props.workData));
const cumulativePoints = computed(() =>
  computeCumulativeCounts(props.workData),
);
const yearlyBest = computed(() => computeHighestRatedByYear(props.workData));

const chartOptions = computed(() =>
  mode.value === "monthly"
    ? createMonthlyActivityChartOptions(
        monthlyPoints.value,
        pluralNoun.value,
        compact.value,
      )
    : createCumulativeCountChartOptions(
        cumulativePoints.value,
        pluralNoun.value,
        compact.value,
      ),
);
</script>
