<template>
  <WidgetShell title="Activity" subtitle="Rolling windows, measured from right now">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <div v-for="row in rows" :key="row.label" class="rounded-lg bg-background/50 p-3 text-left">
        <p class="text-xs uppercase tracking-wide text-slate-400">{{ row.label }}</p>
        <p class="mt-1 text-xl font-bold text-white">
          {{ formatCount(row.counts.last30Days) }}
          <span class="text-sm font-normal text-slate-500">in 30d</span>
        </p>
        <p class="text-sm text-slate-400">{{ formatCount(row.counts.last7Days) }} in 7d</p>
        <p class="mt-1 text-xs text-slate-500">{{ row.hint }}</p>
      </div>
    </div>

    <p class="mt-4 text-xs text-slate-500">
      Engagement counts people who wrote a review, comment, or list item — it can always be
      recomputed from scratch. Sign-ins are read from live sessions, which expire and are deleted,
      so only the daily snapshots preserve that number over time.
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { ActivityCounts } from "../../../../lib/types/metrics";
import { formatCount } from "../formatMetrics";
import WidgetShell from "@/common/components/WidgetShell.vue";

const props = defineProps<{
  engagedUsers: ActivityCounts;
  loggedInUsers: ActivityCounts;
  activeClubs: ActivityCounts;
  newUsers: ActivityCounts;
  newClubs: ActivityCounts;
}>();

// New users and new clubs live here rather than in their own tile grid: they
// are the same "a count, over two windows" shape as the rest, and rendering
// them as four separate KPI tiles said the same thing in a second visual
// language while taking twice the space.
const rows = computed(() => [
  {
    label: "Engaged users",
    counts: props.engagedUsers,
    hint: "Created a review, comment, or list item",
  },
  { label: "Signed in", counts: props.loggedInUsers, hint: "Started at least one session" },
  { label: "Active clubs", counts: props.activeClubs, hint: "Had at least one of those events" },
  { label: "New users", counts: props.newUsers, hint: "Signed up in the window" },
  { label: "New clubs", counts: props.newClubs, hint: "Created in the window" },
]);
</script>
