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
  <div v-if="hasElements(actors)" class="col-span-full">
    <span class="text-gray-400">Cast: </span>
    <span>{{ displayedActors.join(", ") }}</span>
    <button
      v-if="hasMoreActors"
      class="ml-1 text-xs text-primary"
      @click="showAllActors = !showAllActors"
    >
      {{ showAllActors ? "Show less" : `+${remainingActorsCount} more` }}
    </button>
  </div>
  <div v-if="voteAverage">
    <span class="text-gray-400">TMDB Rating: </span>
    <span>{{ voteAverage }}/10</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasElements, hasValue } from "../../../lib/checks/checks.js";

const props = defineProps<{
  releaseDate?: string;
  runtime?: number;
  genres?: string[];
  directors?: { name: string }[];
  actors?: { name: string }[];
  voteAverage?: number;
}>();

const VISIBLE_ACTORS_COUNT = 5;
const showAllActors = ref(false);

const formattedReleaseDate = computed(() => {
  if (!hasValue(props.releaseDate)) return "";
  const date = new Date(props.releaseDate);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
});

const allActors = computed(() => (props.actors ?? []).map((a) => a.name));
const displayedActors = computed(() =>
  showAllActors.value
    ? allActors.value
    : allActors.value.slice(0, VISIBLE_ACTORS_COUNT),
);
const hasMoreActors = computed(
  () => allActors.value.length > VISIBLE_ACTORS_COUNT,
);
const remainingActorsCount = computed(
  () => allActors.value.length - VISIBLE_ACTORS_COUNT,
);
</script>
