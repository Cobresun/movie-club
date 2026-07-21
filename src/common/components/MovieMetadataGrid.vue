<template>
  <!-- Stacked label-over-value facts; the parent supplies the grid so these
       items flow into whatever column layout the drawer uses. -->
  <div v-if="releaseDate">
    <span class="block text-xs font-medium uppercase tracking-wide text-gray-500">Released</span>
    <span class="text-sm text-gray-200">{{ formattedReleaseDate }}</span>
  </div>
  <div v-if="runtime">
    <span class="block text-xs font-medium uppercase tracking-wide text-gray-500">Runtime</span>
    <span class="text-sm text-gray-200">{{ formatRuntime(runtime) }}</span>
  </div>
  <div v-if="hasElements(directors)">
    <span class="block text-xs font-medium uppercase tracking-wide text-gray-500">{{
      directors.length > 1 ? "Directors" : "Director"
    }}</span>
    <span class="text-sm text-gray-200">{{ directors.map((d) => d.name).join(", ") }}</span>
  </div>
  <div v-if="voteAverage">
    <span class="block text-xs font-medium uppercase tracking-wide text-gray-500">TMDB rating</span>
    <span class="text-sm text-gray-200"
      >{{ roundedVote }}<span class="text-gray-500">/10</span></span
    >
  </div>
  <div v-if="hasElements(genres)" class="col-span-full">
    <span class="block text-xs font-medium uppercase tracking-wide text-gray-500">Genres</span>
    <div class="mt-1.5 flex flex-wrap gap-1.5">
      <span
        v-for="genre in genres"
        :key="genre"
        class="rounded-full bg-lowBackground px-2.5 py-0.5 text-xs text-gray-300"
        >{{ genre }}</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasElements, hasValue } from "../../../lib/checks/checks.js";
import { formatRuntime } from "@/common/workDisplay";

const props = defineProps<{
  releaseDate?: string;
  runtime?: number;
  genres?: string[];
  directors?: { name: string }[];
  voteAverage?: number;
}>();

const formattedReleaseDate = computed(() => {
  if (!hasValue(props.releaseDate)) return "";
  const date = new Date(props.releaseDate);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
});

const roundedVote = computed(() =>
  props.voteAverage === undefined ? undefined : Math.round(props.voteAverage * 10) / 10,
);
</script>
