<template>
  <div v-if="watchCounts.mostWatched.length > 0" class="mx-auto w-11/12">
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <WidgetShell title="Most Watched Genres" outer-class="w-full">
        <ul class="space-y-3">
          <li
            v-for="(genre, index) in watchCounts.mostWatched"
            :key="genre.genre"
            class="flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl font-bold text-green-400">
                {{ index + 1 }}
              </span>
              <div class="flex flex-col">
                <span class="text-white">{{ genre.genre }}</span>
                <div
                  class="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-gray-700"
                >
                  <div
                    class="h-full rounded-full bg-green-400"
                    :style="{ width: barWidth(genre.count) }"
                  />
                </div>
              </div>
            </div>
            <span
              class="min-w-[3rem] rounded bg-green-900/50 px-2 py-1 text-center text-sm font-semibold text-green-300"
            >
              {{ genre.count }}
            </span>
          </li>
        </ul>
      </WidgetShell>

      <WidgetShell
        v-if="watchCounts.leastWatched.length > 0"
        title="Least Watched Genres"
        outer-class="w-full"
      >
        <ul class="space-y-3">
          <li
            v-for="(genre, index) in watchCounts.leastWatched"
            :key="genre.genre"
            class="flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl font-bold text-red-400">
                {{ index + 1 }}
              </span>
              <div class="flex flex-col">
                <span class="text-white">{{ genre.genre }}</span>
                <div
                  class="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-gray-700"
                >
                  <div
                    class="h-full rounded-full bg-red-400"
                    :style="{ width: barWidth(genre.count) }"
                  />
                </div>
              </div>
            </div>
            <span
              class="min-w-[3rem] rounded bg-red-900/50 px-2 py-1 text-center text-sm font-semibold text-red-300"
            >
              {{ genre.count }}
            </span>
          </li>
        </ul>
      </WidgetShell>
    </div>
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
