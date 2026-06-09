<template>
  <div v-if="releaseDate">
    <span class="text-gray-400">Release Date: </span>
    <span>{{ formattedReleaseDate }}</span>
  </div>
  <div v-if="runtime">
    <span class="text-gray-400">Runtime: </span>
    <span>{{ runtime }} minutes</span>
  </div>
  <div v-if="hasElements(genres)">
    <span class="text-gray-400">Genres: </span>
    <span>{{ genres.join(", ") }}</span>
  </div>
  <div v-if="hasElements(directors)">
    <span class="text-gray-400">Director: </span>
    <span>{{ directors.map((d) => d.name).join(", ") }}</span>
  </div>
  <div v-if="voteAverage">
    <span class="text-gray-400">TMDB Rating: </span>
    <span>{{ voteAverage }}/10</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasElements, hasValue } from "../../../lib/checks/checks.js";

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
</script>
