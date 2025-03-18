<template>
  <div
    class="group !flex cursor-help items-center justify-center font-bold hover:relative"
  >
    <div class="max-md:line-clamp-2 max-md:text-sm">{{ title }}</div>
    <div
      v-if="movie"
      class="absolute left-full top-full z-50 mx-auto hidden w-[calc(100vw)] rounded-lg p-4 text-base text-slate-200 shadow-lg backdrop-blur-lg max-md:hidden md:w-96 md:group-hover:block"
    >
      <div class="mb-4 flex gap-4">
        <img
          v-if="imageUrl"
          :src="imageUrl"
          class="h-auto w-[calc(5vw)] rounded-lg"
        />
        <div class="flex flex-1 flex-col items-center justify-center">
          <h3 class="mb-1 text-center text-lg font-bold text-white">
            {{ title }}
          </h3>
          <p
            v-if="movie.tagline"
            class="text-center text-sm italic text-slate-400"
          >
            {{ movie.tagline }}
          </p>
        </div>
      </div>
      <p
        v-if="movie.overview"
        class="mb-4 text-left text-sm leading-relaxed text-slate-300"
      >
        {{ movie.overview }}
      </p>
      <div class="grid grid-cols-1 gap-x-4 gap-y-3 text-left text-sm">
        <div v-if="formattedReleaseDate">
          <span class="text-slate-400">Release Date: </span>
          <span class="text-slate-200">{{ formattedReleaseDate }}</span>
        </div>
        <div v-if="movie.runtime">
          <span class="text-slate-400">Runtime: </span>
          <span class="text-slate-200">{{ movie.runtime }} minutes</span>
        </div>
        <div v-if="formattedGenres">
          <span class="text-slate-400">Genres: </span>
          <span class="text-slate-200">{{ formattedGenres }}</span>
        </div>
        <div v-if="formattedRating">
          <span class="text-slate-400">Rating: </span>
          <span class="text-slate-200">{{ formattedRating }}</span>
        </div>
        <div v-if="formattedStudios" class="col-span-1">
          <span class="text-slate-400">Studios: </span>
          <span class="text-slate-200">{{ formattedStudios }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DateTime } from "luxon";
import { computed } from "vue";

import { hasElements, isDefined } from "../../../../lib/checks/checks.js";
import { DetailedMovieData } from "../../../../lib/types/movie.js";

const props = defineProps<{
  title: string;
  imageUrl?: string;
  movie?: DetailedMovieData;
}>();

const formattedReleaseDate = computed(() => {
  const releaseDate = props.movie?.release_date;
  return isDefined(releaseDate)
    ? DateTime.fromISO(releaseDate).toLocaleString()
    : undefined;
});

const formattedGenres = computed(() => {
  const genres = props.movie?.genres;
  return hasElements(genres) ? genres.join(", ") : undefined;
});

const formattedRating = computed(() => {
  const rating = props.movie?.vote_average;
  return isDefined(rating) ? `${Number(rating).toFixed(1)}/10` : undefined;
});

const formattedStudios = computed(() => {
  const studios = props.movie?.production_companies;
  return hasElements(studios) ? studios.join(", ") : undefined;
});
</script>
