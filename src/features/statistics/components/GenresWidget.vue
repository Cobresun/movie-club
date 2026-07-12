<template>
  <WidgetShell v-if="hasData" title="Genres">
    <template #controls>
      <SegmentedToggle v-model="mode" :options="MODE_OPTIONS" />
    </template>

    <template v-if="mode === 'rated'">
      <MemberFilterChips
        v-model="selectedMemberId"
        :members="members"
        class="mb-4"
      />
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div v-if="genreStats.mostLoved.length > 0" class="text-left">
          <h4 class="mb-3 text-sm font-semibold text-emerald-400">
            Most Loved
          </h4>
          <ul class="space-y-3">
            <li
              v-for="(genre, index) in genreStats.mostLoved"
              :key="genre.genre"
              class="flex items-center justify-between"
            >
              <div class="flex items-center gap-3">
                <span class="text-2xl font-bold text-emerald-400">
                  {{ index + 1 }}
                </span>
                <span class="text-white">{{ genre.genre }}</span>
              </div>
              <div class="flex items-center gap-3 text-sm">
                <span class="text-gray-400">{{ genre.count }} movies</span>
                <span
                  class="min-w-[3rem] rounded bg-emerald-900/40 px-2 py-1 text-center font-semibold text-emerald-300"
                >
                  {{ genre.averageScore }}
                </span>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="genreStats.leastLoved.length > 0" class="text-left">
          <h4 class="mb-3 text-sm font-semibold text-rose-400">Least Loved</h4>
          <ul class="space-y-3">
            <li
              v-for="(genre, index) in genreStats.leastLoved"
              :key="genre.genre"
              class="flex items-center justify-between"
            >
              <div class="flex items-center gap-3">
                <span class="text-2xl font-bold text-rose-400">
                  {{ index + 1 }}
                </span>
                <span class="text-white">{{ genre.genre }}</span>
              </div>
              <div class="flex items-center gap-3 text-sm">
                <span class="text-gray-400">{{ genre.count }} movies</span>
                <span
                  class="min-w-[3rem] rounded bg-rose-900/40 px-2 py-1 text-center font-semibold text-rose-300"
                >
                  {{ genre.averageScore }}
                </span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div v-if="watchCounts.mostWatched.length > 0" class="text-left">
          <h4 class="mb-3 text-sm font-semibold text-emerald-400">
            Most Watched
          </h4>
          <ul class="space-y-3">
            <li
              v-for="(genre, index) in watchCounts.mostWatched"
              :key="genre.genre"
              class="flex items-center justify-between"
            >
              <div class="flex items-center gap-3">
                <span class="text-2xl font-bold text-emerald-400">
                  {{ index + 1 }}
                </span>
                <div class="flex flex-col">
                  <span class="text-white">{{ genre.genre }}</span>
                  <div
                    class="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-gray-700"
                  >
                    <div
                      class="h-full rounded-full bg-emerald-400"
                      :style="{ width: barWidth(genre.count) }"
                    />
                  </div>
                </div>
              </div>
              <span
                class="min-w-[3rem] rounded bg-emerald-900/40 px-2 py-1 text-center text-sm font-semibold text-emerald-300"
              >
                {{ genre.count }}
              </span>
            </li>
          </ul>
        </div>

        <div v-if="watchCounts.leastWatched.length > 0" class="text-left">
          <h4 class="mb-3 text-sm font-semibold text-rose-400">
            Least Watched
          </h4>
          <ul class="space-y-3">
            <li
              v-for="(genre, index) in watchCounts.leastWatched"
              :key="genre.genre"
              class="flex items-center justify-between"
            >
              <div class="flex items-center gap-3">
                <span class="text-2xl font-bold text-rose-400">
                  {{ index + 1 }}
                </span>
                <div class="flex flex-col">
                  <span class="text-white">{{ genre.genre }}</span>
                  <div
                    class="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-gray-700"
                  >
                    <div
                      class="h-full rounded-full bg-rose-400"
                      :style="{ width: barWidth(genre.count) }"
                    />
                  </div>
                </div>
              </div>
              <span
                class="min-w-[3rem] rounded bg-rose-900/40 px-2 py-1 text-center text-sm font-semibold text-rose-300"
              >
                {{ genre.count }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import MemberFilterChips from "./MemberFilterChips.vue";
import SegmentedToggle from "./SegmentedToggle.vue";
import WidgetShell from "./WidgetShell.vue";
import { type Member } from "../../../../lib/types/club.js";
import { computeGenreStats, computeGenreWatchCounts } from "../statsComputers";
import type { MovieData } from "../types";

type Mode = "rated" | "watched";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "rated", label: "Top Rated" },
  { value: "watched", label: "Most Watched" },
];

const props = defineProps<{
  members: Member[];
  movieData: MovieData[];
}>();

const mode = ref<Mode>("rated");
const selectedMemberId = ref<string | undefined>(undefined);

const genreStats = computed(() =>
  computeGenreStats(props.movieData, selectedMemberId.value),
);

const watchCounts = computed(() => computeGenreWatchCounts(props.movieData));

const hasData = computed(
  () =>
    genreStats.value.mostLoved.length > 0 ||
    genreStats.value.leastLoved.length > 0 ||
    watchCounts.value.mostWatched.length > 0,
);

const maxCount = computed(() =>
  watchCounts.value.mostWatched.length > 0
    ? watchCounts.value.mostWatched[0].count
    : 1,
);

function barWidth(count: number): string {
  return `${Math.round((count / maxCount.value) * 100)}%`;
}
</script>
