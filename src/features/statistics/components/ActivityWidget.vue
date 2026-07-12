<template>
  <WidgetShell
    v-if="monthlyPoints.length > 0"
    title="Club Activity"
    :subtitle="subtitle"
  >
    <template #controls>
      <SegmentedToggle v-model="mode" :options="MODE_OPTIONS" />
    </template>
    <ag-charts :options="chartOptions" />
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
  computeMonthlyActivity,
} from "../statsComputers";
import type { WorkStatsData } from "../types";

import { clubTypeStats } from "@/common/clubType";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

type Mode = "monthly" | "total";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "total", label: "All Time" },
];

const props = defineProps<{
  workData: WorkStatsData[];
  clubType: ClubType;
}>();

const isDesktop = useIsDesktop();
const compact = computed(() => !isDesktop.value);

const mode = ref<Mode>("monthly");

const pluralNoun = computed(() => clubTypeStats(props.clubType).pluralNoun);

const subtitle = computed(() =>
  mode.value === "monthly"
    ? `${pluralNoun.value} reviewed per month`
    : `Total ${pluralNoun.value.toLowerCase()} reviewed over time`,
);

const monthlyPoints = computed(() => computeMonthlyActivity(props.workData));
const cumulativePoints = computed(() =>
  computeCumulativeCounts(props.workData),
);

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
