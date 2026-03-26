<template>
  <div class="flex gap-3 pt-1">
    <div
      class="flex flex-1 flex-col items-center rounded-xl border border-slate-700 bg-lowBackground py-6"
    >
      <mdicon name="filmstrip" class="mb-2 text-primary" :size="22" />
      <p class="text-5xl font-black text-white">{{ totalMovies }}</p>
      <p class="mt-1 text-xs tracking-wide text-slate-400">movies watched</p>
    </div>
    <div
      class="flex flex-1 flex-col items-center rounded-xl border border-slate-700 bg-lowBackground py-6"
    >
      <mdicon name="clock-outline" class="mb-2 text-primary" :size="22" />
      <p class="text-5xl font-black text-white">{{ formattedTime }}</p>
      <p class="mt-1 text-xs tracking-wide text-slate-400">
        watch time<template v-if="totalDays > 0">
          ({{ totalDays }} {{ totalDays === 1 ? "day" : "days" }})</template
        >
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { MovieData } from "../types";

const props = defineProps<{
  movieData: MovieData[];
}>();

const totalMovies = computed(() => props.movieData.length);

const totalRuntimeMinutes = computed(() =>
  props.movieData.reduce((sum, movie) => {
    const runtime = Number(movie.externalData?.runtime);
    return sum + (isNaN(runtime) ? 0 : runtime);
  }, 0),
);

const totalHours = computed(() => Math.floor(totalRuntimeMinutes.value / 60));

const formattedTime = computed(() => {
  const minutes = totalRuntimeMinutes.value % 60;
  return `${totalHours.value}h ${minutes}m`;
});

const totalDays = computed(() =>
  totalHours.value > 24 ? Math.round(totalHours.value / 24) : 0,
);
</script>
