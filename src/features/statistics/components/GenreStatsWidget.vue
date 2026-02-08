<template>
  <div
    v-if="mostLoved.length > 0 || leastLoved.length > 0"
    class="mx-auto grid w-11/12 grid-cols-1 gap-6 md:grid-cols-2"
  >
    <div v-if="mostLoved.length > 0" class="rounded-lg bg-lowBackground p-5">
      <h3 class="mb-4 text-lg font-bold text-white">Most Loved Genres</h3>
      <ul class="space-y-3">
        <li
          v-for="(genre, index) in mostLoved"
          :key="genre.genre"
          class="flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <span class="text-2xl font-bold text-green-400">
              {{ index + 1 }}
            </span>
            <span class="text-white">{{ genre.genre }}</span>
          </div>
          <div class="flex items-center gap-3 text-sm">
            <span class="text-gray-400">{{ genre.count }} movies</span>
            <span
              class="min-w-[3rem] rounded bg-green-900/50 px-2 py-1 text-center font-semibold text-green-300"
            >
              {{ genre.averageScore }}
            </span>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="leastLoved.length > 0" class="rounded-lg bg-lowBackground p-5">
      <h3 class="mb-4 text-lg font-bold text-white">Least Loved Genres</h3>
      <ul class="space-y-3">
        <li
          v-for="(genre, index) in leastLoved"
          :key="genre.genre"
          class="flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <span class="text-2xl font-bold text-red-400">
              {{ index + 1 }}
            </span>
            <span class="text-white">{{ genre.genre }}</span>
          </div>
          <div class="flex items-center gap-3 text-sm">
            <span class="text-gray-400">{{ genre.count }} movies</span>
            <span
              class="min-w-[3rem] rounded bg-red-900/50 px-2 py-1 text-center font-semibold text-red-300"
            >
              {{ genre.averageScore }}
            </span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type GenreStats } from "../StatisticsUtils";

defineProps<{
  mostLoved: GenreStats[];
  leastLoved: GenreStats[];
}>();
</script>
