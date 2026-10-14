<template>
  <WidgetShell
    title="What people are reviewing"
    outer-class="w-full"
    inner-class="h-full rounded-xl bg-lowBackground p-4 sm:p-5"
  >
    <template #controls>
      <SegmentedToggle v-model="board" :options="BOARD_OPTIONS" />
    </template>

    <ol v-if="rows.length > 0" :aria-label="boardLabel" class="divide-y divide-slate-700/40">
      <li v-for="(row, index) in rows" :key="row.key" class="flex items-center gap-3 py-2">
        <span class="w-4 shrink-0 text-right text-xs tabular-nums text-slate-500">
          {{ index + 1 }}
        </span>
        <img
          v-if="hasValue(row.imageUrl)"
          :src="row.imageUrl"
          alt=""
          loading="lazy"
          class="aspect-[2/3] w-9 shrink-0 rounded bg-background/60 object-cover"
        />
        <div v-else class="aspect-[2/3] w-9 shrink-0 rounded bg-background/60" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-white">{{ row.title }}</p>
          <p class="truncate text-xs text-slate-400">{{ row.detail }}</p>
        </div>
        <span
          class="shrink-0 rounded-full bg-background/60 px-2.5 py-1 text-sm font-semibold tabular-nums text-white"
          :aria-label="row.valueLabel"
        >
          {{ row.value }}
        </span>
      </li>
    </ol>
    <p v-else class="py-10 text-center text-sm text-slate-500">{{ emptyMessage }}</p>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasValue } from "../../../../lib/checks/checks.js";
import { MetricsRange, ReviewedWork, WorkLeaderboards } from "../../../../lib/types/metrics";
import { pluralize } from "../formatMetrics";
import { rangeWithin } from "../ranges";
import WidgetShell from "@/common/components/WidgetShell.vue";
import SegmentedToggle from "@/features/statistics/components/SegmentedToggle.vue";

const BOARD_OPTIONS = [
  { value: "mostReviewed", label: "Popular" },
  { value: "highestRated", label: "Top rated" },
  { value: "mostDivisive", label: "Divisive" },
  { value: "mostWanted", label: "Wanted" },
] as const;

type Board = (typeof BOARD_OPTIONS)[number]["value"];

const props = defineProps<{
  works: WorkLeaderboards;
  range: MetricsRange;
}>();

const board = ref<Board>("mostReviewed");

const boardLabel = computed(
  () => BOARD_OPTIONS.find((option) => option.value === board.value)?.label ?? "",
);

function reviewDetail(work: ReviewedWork): string {
  return `${pluralize(work.reviews, "review")} · ${pluralize(work.clubs, "club")}`;
}

const rows = computed(() => {
  if (board.value === "mostWanted") {
    return props.works.mostWanted.map((work) => ({
      key: work.key,
      title: work.title,
      imageUrl: work.imageUrl,
      detail: `Queued by ${pluralize(work.clubs, "club")}`,
      value: String(work.adds),
      valueLabel: pluralize(work.adds, "add"),
    }));
  }
  if (board.value === "mostDivisive") {
    return props.works.mostDivisive.map((work) => ({
      key: work.key,
      title: work.title,
      imageUrl: work.imageUrl,
      detail: `${reviewDetail(work)} · avg ${work.averageScore.toFixed(1)}`,
      value: `±${work.spread.toFixed(1)}`,
      valueLabel: `Scores spread ±${work.spread.toFixed(1)}`,
    }));
  }
  return props.works[board.value].map((work) => ({
    key: work.key,
    title: work.title,
    imageUrl: work.imageUrl,
    detail: reviewDetail(work),
    value: work.averageScore.toFixed(1),
    valueLabel: `Average score ${work.averageScore.toFixed(1)}`,
  }));
});

const emptyMessage = computed(() => {
  const within = rangeWithin(props.range);
  if (board.value === "mostWanted") return `Nothing was added to a list ${within}.`;
  if (board.value === "mostReviewed") return `Nothing was reviewed ${within}.`;
  return `No title has three or more reviews ${within}.`;
});
</script>
