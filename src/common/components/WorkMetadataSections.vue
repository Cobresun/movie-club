<template>
  <div>
    <!-- Synopsis -->
    <section v-if="hasValue(overview)" class="mt-6">
      <SectionHeader title="Synopsis" />
      <WorkDescription :key="externalId ?? ''" :overview="overview" />
    </section>

    <CastList v-if="movieData" :actors="movieData.actors" class="mt-6" />

    <!-- Details: factual metadata, external ratings and links -->
    <section v-if="hasDetails" class="mt-6">
      <SectionHeader title="Details" />
      <div class="grid grid-cols-2 gap-x-4 gap-y-3">
        <MovieMetadataGrid
          v-if="movieData"
          :release-date="movieData.release_date"
          :directors="movieData.directors"
        />
        <BookMetadataGrid
          v-else-if="bookData"
          :first-publish-year="bookData.firstPublishYear"
          :subjects="bookData.subjects"
        />
        <div
          v-if="isDefined(tmdbScore)"
          :class="{ 'cursor-pointer hover:opacity-80': shouldBlurTmdbScore }"
          @click="revealTmdb"
        >
          <span
            class="block text-xs font-medium uppercase tracking-wide text-gray-500"
            >TMDB rating</span
          >
          <span class="inline-flex items-center gap-1.5 text-sm text-gray-200">
            <span
              class="transition-[filter] duration-500 ease-standard"
              :class="
                shouldBlurTmdbScore
                  ? 'select-none blur'
                  : 'select-auto blur-none'
              "
              >{{ tmdbScore }}<span class="text-gray-500">/10</span></span
            >
            <mdicon
              v-if="shouldBlurTmdbScore"
              name="eye-outline"
              size="14"
              class="text-gray-400"
            />
          </span>
        </div>
      </div>

      <div v-if="movieData" class="mt-4 flex flex-wrap gap-2">
        <ExternalLink label="Letterboxd" :href="letterboxdUrl" />
        <ExternalLink label="IMDb" :href="imdbUrl" />
        <ExternalLink label="Rotten Tomatoes" :href="rottenTomatoesUrl" />
      </div>

      <WatchProviders
        v-if="movieData"
        :external-id="externalId ?? undefined"
        class="mt-4"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import BookMetadataGrid from "./BookMetadataGrid.vue";
import CastList from "./CastList.vue";
import ExternalLink from "./ExternalLink.vue";
import MovieMetadataGrid from "./MovieMetadataGrid.vue";
import SectionHeader from "./SectionHeader.vue";
import WatchProviders from "./WatchProviders.vue";
import WorkDescription from "./WorkDescription.vue";
import { hasValue, isDefined } from "../../../lib/checks/checks.js";
import { DetailedWorkData } from "../../../lib/types/lists";

import { workOverview } from "@/common/clubType";
import { asBook, asMovie } from "@/common/workDisplay";

const props = withDefaults(
  defineProps<{
    externalData?: DetailedWorkData;
    externalId?: string | null;
    /** RT has no ids, so it searches by title; pass the work's title. */
    title?: string | null;
    /**
     * Hide the TMDB score behind a blur until revealed. The club reviews drawer
     * sets this so members can't peek at TMDB before rating; the solo library
     * leaves it false (there's no score to spoil against your own log).
     */
    tmdbBlurred?: boolean;
  }>(),
  {
    externalData: undefined,
    externalId: null,
    title: null,
    tmdbBlurred: false,
  },
);

const movieData = computed(() => asMovie(props.externalData));
const bookData = computed(() => asBook(props.externalData));

const overview = computed(() => workOverview(props.externalData));

// TMDB publishes ratings with three decimals (7.783); one is plenty here.
const tmdbScore = computed(() =>
  movieData.value?.vote_average === undefined
    ? undefined
    : Math.round(movieData.value.vote_average * 10) / 10,
);

// Movies always have external links (Rotten Tomatoes is a title search);
// books only warrant the section when they have any facts to show.
const hasDetails = computed(() => {
  if (isDefined(movieData.value)) return true;
  const book = bookData.value;
  return (
    isDefined(book) &&
    (book.firstPublishYear !== undefined || book.subjects.length > 0)
  );
});

const letterboxdUrl = computed(() =>
  hasValue(props.externalId)
    ? `https://letterboxd.com/tmdb/${props.externalId}/`
    : undefined,
);

const imdbUrl = computed(() => {
  const imdbId = movieData.value?.imdb_id;
  return hasValue(imdbId) ? `https://www.imdb.com/title/${imdbId}/` : undefined;
});

const rottenTomatoesUrl = computed(() =>
  hasValue(props.title)
    ? `https://www.rottentomatoes.com/search?search=${encodeURIComponent(props.title)}`
    : undefined,
);

// Reveal is local: once clicked (or when the parent never blurred) the score
// shows plainly for the rest of the drawer's life.
const tmdbRevealed = ref(false);
const shouldBlurTmdbScore = computed(
  () => props.tmdbBlurred && !tmdbRevealed.value,
);
const revealTmdb = () => {
  if (shouldBlurTmdbScore.value) tmdbRevealed.value = true;
};
</script>
