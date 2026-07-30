<template>
  <WidgetShell title="Active users and clubs" subtitle="Rolling windows, measured from right now">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
}>();

const rows = computed(() => [
  {
    label: "Engaged users",
    counts: props.engagedUsers,
    hint: "Created a review, comment, or list item",
  },
  { label: "Signed in", counts: props.loggedInUsers, hint: "Started at least one session" },
  { label: "Active clubs", counts: props.activeClubs, hint: "Had at least one of those events" },
]);
</script>
