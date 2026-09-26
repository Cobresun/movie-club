<template>
  <WidgetShell
    title="Where clubs stand"
    :subtitle="`${formatCount(total)} clubs, by their most recent review, comment, or list add`"
    outer-class="w-full"
  >
    <div
      v-if="total > 0"
      class="flex h-3 gap-0.5 overflow-hidden rounded-full bg-background/60"
      aria-hidden="true"
    >
      <div
        v-for="segment in visibleSegments"
        :key="segment.key"
        class="h-full first:rounded-l-full last:rounded-r-full"
        :class="segment.barClass"
        :style="{ width: `${segment.percent}%` }"
      />
    </div>

    <ul class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
      <li v-for="segment in segments" :key="segment.key" class="flex items-start gap-2">
        <span class="mt-1.5 size-2.5 shrink-0 rounded-full" :class="segment.barClass" />
        <div>
          <p class="text-sm text-white">
            <span class="font-semibold tabular-nums">{{ formatCount(segment.count) }}</span>
            {{ segment.label }}
            <span class="text-slate-500">({{ segment.percent }}%)</span>
          </p>
          <p class="text-xs text-slate-500">{{ segment.hint }}</p>
        </div>
      </li>
    </ul>

    <p v-if="status.empty > 0" class="mt-4 text-sm text-slate-400">
      <span class="font-semibold text-white">{{ formatCount(status.empty) }}</span>
      {{ status.empty === 1 ? "club has" : "clubs have" }} no members left at all.
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { ClubStatus } from "../../../../lib/types/metrics";
import { formatCount, percentOf } from "../formatMetrics";
import WidgetShell from "@/common/components/WidgetShell.vue";

const props = defineProps<{
  status: ClubStatus;
}>();

const total = computed(
  () => props.status.active + props.status.quiet + props.status.dormant + props.status.neverStarted,
);

// Status colours carry meaning here, so each one is paired with its label and
// count in the legend below — the bar itself is decorative.
const segments = computed(() =>
  [
    {
      key: "active",
      label: "active",
      hint: "In the last 30 days",
      count: props.status.active,
      barClass: "bg-emerald-400",
    },
    {
      key: "quiet",
      label: "quiet",
      hint: "30–90 days ago",
      count: props.status.quiet,
      barClass: "bg-amber-400",
    },
    {
      key: "dormant",
      label: "dormant",
      hint: "Over 90 days ago",
      count: props.status.dormant,
      barClass: "bg-rose-400",
    },
    {
      key: "never",
      label: "never started",
      hint: "Nothing, ever",
      count: props.status.neverStarted,
      barClass: "bg-slate-500",
    },
  ].map((segment) => ({ ...segment, percent: percentOf(segment.count, total.value) })),
);

const visibleSegments = computed(() => segments.value.filter((segment) => segment.count > 0));
</script>
