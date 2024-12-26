<template>
  <div class="font-bold hover:relative group cursor-help">
    {{ title }}
    <div
      v-if="movie"
      class="
        absolute left-0 top-full z-50
        hidden group-hover:block
        w-[calc(100vw)] md:w-96
        p-4 rounded-lg
        text-base text-slate-200
        shadow-lg
        backdrop-blur-lg
        mx-auto
      "
    >
      <div class="flex gap-4 mb-4">
        <img
          v-if="posterUrl"
          :src="posterUrl"
          class="w-[calc(5vw)] h-auto rounded-lg"
        />
        <div class="flex flex-col items-center justify-center flex-1">
          <h3 class="font-bold text-lg mb-1 text-white text-center">
            {{ title }}
          </h3>
          <p v-if="movie.tagline" class="text-sm text-slate-400 italic text-center">
            {{ movie.tagline }}
          </p>
        </div>
      </div>
      <p v-if="movie.overview" class="mb-4 text-sm leading-relaxed text-slate-300 text-left">
        {{ movie.overview }}
      </p>
      <div class="grid grid-cols-1 gap-y-3 gap-x-4 text-sm text-left">
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
import { computed } from 'vue';
import { DateTime } from "luxon";

interface MovieProps {
  poster_path?: string;
  tagline?: string;
  overview?: string;
  release_date?: string;
  runtime?: number;
  genres?: string[];
  vote_average?: number;
  production_companies?: string[];
}

const props = defineProps<{
  title: string;
  imageUrl?: string;
  movie?: MovieProps;
}>();

const posterUrl = computed(() => 
  props.imageUrl ? props.imageUrl : null
);

const formattedReleaseDate = computed(() => 
  props.movie?.release_date ? DateTime.fromISO(props.movie.release_date).toLocaleString() : null
);

const formattedGenres = computed(() => 
  props.movie?.genres?.length ? props.movie.genres.join(", ") : null
);

const formattedRating = computed(() => 
  props.movie?.vote_average ? `${Number(props.movie.vote_average).toFixed(1)}/10` : null
);

const formattedStudios = computed(() => 
  props.movie?.production_companies?.length ? props.movie.production_companies.join(", ") : null
);
</script>