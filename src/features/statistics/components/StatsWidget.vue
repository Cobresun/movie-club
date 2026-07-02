<template>
  <div class="mx-auto flex w-11/12 gap-3 pt-4">
    <div
      class="flex flex-1 flex-col items-center rounded-xl border border-slate-700 bg-lowBackground py-5"
    >
      <mdicon :name="countIcon" class="mb-2 text-primary" :size="20" />
      <p class="text-3xl font-bold text-white">{{ totalWorks }}</p>
      <p class="text-xs tracking-wide text-slate-400">{{ countLabel }}</p>
    </div>
    <div
      v-if="isMovieClub"
      class="flex flex-1 flex-col items-center rounded-xl border border-slate-700 bg-lowBackground py-5"
    >
      <mdicon name="clock-outline" class="mb-2 text-primary" :size="20" />
      <p class="text-3xl font-bold text-white">{{ formattedTime }}</p>
      <p class="text-xs tracking-wide text-slate-400">
        watch time<template v-if="totalDays > 0">
          ({{ totalDays }} {{ totalDays === 1 ? "day" : "days" }})</template
        >
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { ClubType } from "../../../../lib/types/generated/db";
import { isMovieStats, type WorkStatsData } from "../types";

const props = defineProps<{
  workData: WorkStatsData[];
  clubType: ClubType;
}>();

const isMovieClub = computed(() => props.clubType === ClubType.movie);

const totalWorks = computed(() => props.workData.length);

const countLabel = computed(() =>
  isMovieClub.value ? "movies watched" : "books read",
);

const countIcon = computed(() =>
  isMovieClub.value ? "filmstrip" : "book-open-page-variant-outline",
);

const totalRuntimeMinutes = computed(() =>
  props.workData.filter(isMovieStats).reduce((sum, movie) => {
    const runtime = Number(movie.externalData.runtime);
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
