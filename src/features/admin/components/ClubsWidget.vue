<template>
  <WidgetShell
    title="Clubs"
    outer-class="w-full"
    inner-class="h-full rounded-xl bg-lowBackground p-4 sm:p-5"
  >
    <template #controls>
      <SegmentedToggle v-model="board" :options="BOARD_OPTIONS" />
    </template>

    <ol
      v-if="rows.length > 0"
      :aria-label="board === 'busiest' ? 'Busiest clubs' : 'New clubs'"
      class="divide-y divide-slate-700/40"
    >
      <li v-for="club in rows" :key="club.clubId" class="flex items-center gap-3 py-2.5">
        <!-- Club type is read through the registry; its icon is covered by
             icons.test.ts's CLUB_TYPE_CONFIG check. -->
        <mdicon
          :name="clubTypeIcon(club.type)"
          size="20"
          class="shrink-0 text-slate-500"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1">
          <router-link
            :to="{ name: 'ClubHome', params: { clubSlug: club.slug } }"
            class="block truncate text-sm font-medium text-primary hover:underline"
          >
            {{ club.name }}
            <span class="sr-only">({{ clubTypeLabel(club.type) }})</span>
          </router-link>
          <p class="truncate text-xs text-slate-400">
            {{ memberSummary(club.memberNames) }} · {{ subline(club) }}
          </p>
        </div>
        <span
          v-if="club.events === 0"
          class="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300"
        >
          Not started
        </span>
        <div v-else class="shrink-0 text-right">
          <p class="text-sm font-semibold tabular-nums text-white">
            {{ formatCount(club.reviews) }}
          </p>
          <p class="text-xs text-slate-500">{{ club.reviews === 1 ? "review" : "reviews" }}</p>
        </div>
      </li>
    </ol>
    <p v-else class="py-10 text-center text-sm text-slate-500">
      {{
        board === "busiest"
          ? `No club did anything ${rangeWithin(range)}.`
          : `No clubs were created ${rangeWithin(range)}.`
      }}
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasValue } from "../../../../lib/checks/checks.js";
import { ClubRow, MetricsRange } from "../../../../lib/types/metrics";
import { formatCount, formatRelativeTime, memberSummary } from "../formatMetrics";
import { rangeWithin } from "../ranges";
import { clubTypeIcon, clubTypeLabel } from "@/common/clubType";
import WidgetShell from "@/common/components/WidgetShell.vue";
import SegmentedToggle from "@/features/statistics/components/SegmentedToggle.vue";

const BOARD_OPTIONS = [
  { value: "busiest", label: "Busiest" },
  { value: "newest", label: "New" },
] as const;

const props = defineProps<{
  busiest: ClubRow[];
  newest: ClubRow[];
  range: MetricsRange;
}>();

const board = ref<(typeof BOARD_OPTIONS)[number]["value"]>("busiest");

const rows = computed(() => (board.value === "busiest" ? props.busiest : props.newest));

function subline(club: ClubRow): string {
  if (board.value === "newest" && hasValue(club.createdAt)) {
    return `created ${formatRelativeTime(club.createdAt)}`;
  }
  return hasValue(club.lastActiveAt)
    ? `active ${formatRelativeTime(club.lastActiveAt)}`
    : "never active";
}
</script>
