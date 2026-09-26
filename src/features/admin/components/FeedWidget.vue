<template>
  <WidgetShell
    title="Latest activity"
    outer-class="w-full"
    inner-class="h-full rounded-xl bg-lowBackground p-4 sm:p-5"
  >
    <ol v-if="events.length > 0" aria-label="Latest activity" class="divide-y divide-slate-700/40">
      <li
        v-for="(event, index) in events"
        :key="`${event.kind}-${event.at}-${index}`"
        class="flex items-center gap-3 py-2.5"
      >
        <v-avatar :src="event.userImage ?? undefined" :name="event.userName" :size="32" />
        <div class="min-w-0 flex-1">
          <p class="text-sm text-slate-300">
            <span class="font-semibold text-white">{{ event.userName }}</span>
            {{ event.kind === "review" ? "scored" : "commented on" }}
            <span class="font-medium text-white">{{ event.workTitle }}</span>
          </p>
          <p class="truncate text-xs text-slate-500">
            <router-link
              :to="{ name: 'ClubHome', params: { clubSlug: event.clubSlug } }"
              class="text-slate-400 hover:text-primary hover:underline"
            >
              {{ event.clubName }}
            </router-link>
            · {{ formatRelativeTime(event.at) }}
          </p>
        </div>
        <span
          v-if="event.score !== null"
          class="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-sm font-semibold tabular-nums text-highlight"
        >
          {{ formatScore(event.score) }}
        </span>
        <mdicon
          v-else
          name="message-outline"
          size="18"
          class="shrink-0 px-2.5 text-slate-500"
          aria-hidden="true"
        />
      </li>
    </ol>
    <p v-else class="py-10 text-center text-sm text-slate-500">Nobody has reviewed anything yet.</p>
  </WidgetShell>
</template>

<script setup lang="ts">
import { FeedEvent } from "../../../../lib/types/metrics";
import { formatRelativeTime } from "../formatMetrics";
import WidgetShell from "@/common/components/WidgetShell.vue";

defineProps<{
  events: FeedEvent[];
}>();

/** Whole scores stay whole; halves keep their decimal. */
function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
</script>
