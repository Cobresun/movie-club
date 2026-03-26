<template>
  <div v-if="watchCounts.mostWatched.length > 0" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <WidgetShell title="Most Watched Genres" icon="eye" outer-class="w-full">
      <ul class="space-y-3">
        <li
          v-for="(genre, index) in watchCounts.mostWatched"
          :key="genre.genre"
        >
          <div class="mb-1.5 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="h-5 w-1 shrink-0 rounded-full bg-green-400" />
              <div>
                <span class="text-sm text-white">{{ genre.genre }}</span>
                <span class="ml-2 text-xs text-slate-500">#{{ index + 1 }}</span>
              </div>
            </div>
            <span
              class="min-w-[3rem] rounded bg-green-900/50 px-2 py-0.5 text-center text-xs font-semibold text-green-300"
            >
              {{ genre.count }}
            </span>
          </div>
          <div class="h-1 w-full overflow-hidden rounded-full bg-slate-700/50">
            <div
              class="h-full rounded-full bg-green-400/60"
              :style="{ width: barWidth(genre.count) }"
            />
          </div>
        </li>
      </ul>
    </WidgetShell>

    <WidgetShell
      v-if="watchCounts.leastWatched.length > 0"
      title="Least Watched Genres"
      icon="eye-off"
      outer-class="w-full"
    >
      <ul class="space-y-3">
        <li
          v-for="(genre, index) in watchCounts.leastWatched"
          :key="genre.genre"
        >
          <div class="mb-1.5 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="h-5 w-1 shrink-0 rounded-full bg-red-400" />
              <div>
                <span class="text-sm text-white">{{ genre.genre }}</span>
                <span class="ml-2 text-xs text-slate-500">#{{ index + 1 }}</span>
              </div>
            </div>
            <span
              class="min-w-[3rem] rounded bg-red-900/50 px-2 py-0.5 text-center text-xs font-semibold text-red-300"
            >
              {{ genre.count }}
            </span>
          </div>
          <div class="h-1 w-full overflow-hidden rounded-full bg-slate-700/50">
            <div
              class="h-full rounded-full bg-red-400/60"
              :style="{ width: barWidth(genre.count) }"
            />
          </div>
        </li>
      </ul>
    </WidgetShell>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { computeGenreWatchCounts } from "../statsComputers";
import type { MovieData } from "../types";

const props = defineProps<{
  movieData: MovieData[];
}>();

const watchCounts = computed(() => computeGenreWatchCounts(props.movieData));

const maxCount = computed(() =>
  watchCounts.value.mostWatched.length > 0
    ? watchCounts.value.mostWatched[0].count
    : 1,
);

function barWidth(count: number): string {
  return `${Math.round((count / maxCount.value) * 100)}%`;
}
</script>
