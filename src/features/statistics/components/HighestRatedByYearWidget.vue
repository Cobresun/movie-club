<template>
  <WidgetShell v-if="entries.length > 0" title="Highest Rated by Year">
    <p class="-mt-2 mb-4 text-sm text-slate-400">
      The top-rated movie your club watched each year.
    </p>
    <div class="space-y-2">
      <div
        v-for="entry in entries"
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
        <div class="min-w-0 flex-1">
          <p
            class="w-fit max-w-full truncate text-sm font-medium text-white"
            :title="entry.title"
          >
            {{ entry.title }}
          </p>
          <p class="mt-1 text-xs text-slate-400">
            {{ entry.movieCount }}
            {{ entry.movieCount === 1 ? "movie" : "movies" }} watched
          </p>
        </div>
        <span
          class="shrink-0 rounded-full bg-green-900/30 px-2.5 py-1 text-sm font-bold text-green-400"
        >
          {{ entry.average.toFixed(1) }}
        </span>
      </div>
    </div>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { computeHighestRatedByYear } from "../statsComputers";
import type { MovieData } from "../types";

const props = defineProps<{
  movieData: MovieData[];
}>();

const entries = computed(() => computeHighestRatedByYear(props.movieData));
</script>
