<template>
  <!-- Stacked label-over-value facts; the parent supplies the grid so these
       items flow into whatever column layout the drawer uses. -->
  <div v-if="releaseDate">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase">Released</span>
    <span class="text-sm text-gray-200">{{ formatDate(releaseDate) }}</span>
  </div>
  <div v-if="runtime">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase">Runtime</span>
    <span class="text-sm text-gray-200">{{ formatRuntime(runtime) }}</span>
  </div>
  <div v-if="hasElements(directors)">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase">{{
      directors.length > 1 ? "Directors" : "Director"
    }}</span>
    <span class="text-sm text-gray-200">{{ directors.map((d) => d.name).join(", ") }}</span>
  </div>
  <div v-if="voteAverage">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase">TMDB rating</span>
    <span class="text-sm text-gray-200"
      >{{ roundedVote }}<span class="text-gray-500">/10</span></span
    >
  </div>
  <div v-if="hasElements(genres)" class="col-span-full">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase">Genres</span>
    <div class="mt-1.5 flex flex-wrap gap-1.5">
      <span
        v-for="genre in genres"
        :key="genre"
        class="bg-lowBackground rounded-full px-2.5 py-0.5 text-xs text-gray-300"
        >{{ genre }}</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { isDefined, hasElements } from "../../../lib/checks/checks.js";
import { formatDate, formatRuntime } from "@/common/workDisplay";

const {
  releaseDate = "",
  runtime = 0,
  genres = [],
  directors = [],
  voteAverage = undefined,
} = defineProps<{
  releaseDate?: string;
  runtime?: number;
  genres?: string[];
  directors?: { name: string }[];
  voteAverage?: number;
}>();

const roundedVote = computed(() =>
  isDefined(voteAverage) ? Math.round(voteAverage * 10) / 10 : undefined,
);
</script>
