<template>
  <WidgetShell
    title="People"
    outer-class="w-full"
    inner-class="h-full rounded-xl bg-lowBackground p-4 sm:p-5"
  >
    <template #controls>
      <SegmentedToggle v-model="board" :options="BOARD_OPTIONS" />
    </template>

    <ol
      v-if="rows.length > 0"
      :aria-label="board === 'mostActive' ? 'Most active people' : 'Newcomers'"
      class="divide-y divide-slate-700/40"
    >
      <li v-for="person in rows" :key="person.userId" class="flex items-center gap-3 py-2.5">
        <v-avatar :src="person.image ?? undefined" :name="person.name" :size="32" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-white">{{ person.name }}</p>
          <!-- Broken down by kind on purpose: forty comments and no reviews is
               a different person from the reverse, and a total hides that. -->
          <p class="truncate text-xs text-slate-400">{{ breakdown(person) }}</p>
        </div>
        <span
          v-if="!hasValue(person.lastActiveAt)"
          class="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300"
        >
          No activity yet
        </span>
        <p v-else class="shrink-0 text-right text-xs text-slate-500">
          {{ board === "newest" ? "joined" : "active" }}<br />
          {{ formatRelativeTime(board === "newest" ? person.joinedAt : person.lastActiveAt) }}
        </p>
      </li>
    </ol>
    <p v-else class="py-10 text-center text-sm text-slate-500">
      {{
        board === "mostActive"
          ? `Nobody did anything ${rangeWithin(range)}.`
          : `Nobody signed up ${rangeWithin(range)}.`
      }}
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasValue } from "../../../../lib/checks/checks.js";
import { MetricsRange, PersonRow } from "../../../../lib/types/metrics";
import { formatRelativeTime, pluralize } from "../formatMetrics";
import { rangeWithin } from "../ranges";
import WidgetShell from "@/common/components/WidgetShell.vue";
import SegmentedToggle from "@/features/statistics/components/SegmentedToggle.vue";

const BOARD_OPTIONS = [
  { value: "mostActive", label: "Most active" },
  { value: "newest", label: "Newcomers" },
] as const;

const props = defineProps<{
  mostActive: PersonRow[];
  newest: PersonRow[];
  range: MetricsRange;
}>();

const board = ref<(typeof BOARD_OPTIONS)[number]["value"]>("mostActive");

const rows = computed(() => (board.value === "mostActive" ? props.mostActive : props.newest));

function breakdown(person: PersonRow): string {
  const parts = [
    [person.reviews, "review"] as const,
    [person.comments, "comment"] as const,
    [person.listAdds, "list add"] as const,
  ]
    .filter(([count]) => count > 0)
    .map(([count, noun]) => pluralize(count, noun));
  return [...parts, pluralize(person.clubs, "club")].join(" · ");
}
</script>
