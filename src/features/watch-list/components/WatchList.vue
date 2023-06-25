<template>
  <div class="flex justify-start ml-2">
    <v-btn class="mr-2" @click="selectRandom()">
      Random
      <mdicon name="dice-multiple-outline" />
    </v-btn>
  </div>
  <transition-group
    tag="div"
    move-class="transition ease-linear duration-300"
    class="grid grid-cols-auto justify-items-center my-4"
  >
    <MoviePosterCard
      v-for="(movie, index) in displayWatchlist"
      :key="movie.movieId"
      :class="[index == 0 ? 'z-0' : 'z-10']"
      class="bg-background"
      :movie-title="movie.movieTitle"
      :movie-poster-url="movie.posterUrl"
      :highlighted="!isAnimating && movie.movieId == nextMovieId"
    >
      <div class="grid grid-cols-2 gap-2">
        <v-btn class="flex justify-center" @click="reviewMovie(movie.movieId)">
          <mdicon name="check" />
        </v-btn>

        <v-btn
          class="flex justify-center"
          @click="makeNextWatch(movie.movieId)"
        >
          <mdicon name="arrow-collapse-up" />
        </v-btn>
      </div>
    </MoviePosterCard>
  </transition-group>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAnimateRandom } from "../composables/useAnimateRandom";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { WatchListItem } from "@/common/types/watchlist";
import { useAddReview } from "@/service/useReview";
import {
  useDeleteMovie,
  useMakeNextWatch,
  useWatchList,
} from "@/service/useWatchList";
import { filterMovies } from "@/common/searchMovies";

const { searchTerm, clearSearch } = defineProps<{
  searchTerm: string;
  clearSearch: () => void;
}>();

const route = useRoute();
const router = useRouter();

const { mutate: deleteMovie } = useDeleteMovie(route.params.clubId as string);
const { mutate: addReview } = useAddReview(route.params.clubId as string);

const reviewMovie = async (movieId: number) => {
  deleteMovie(movieId);
  addReview(movieId, { onSuccess: () => router.push({ name: "Reviews" }) });
};

const { data } = useWatchList(route.params.clubId as string);
const watchList = computed(() => (data.value ? data.value.watchList : []));
const nextMovieId = computed(() => data.value?.nextMovieId);

const sortedWatchList = computed(() => {
  const nextMovieItem: WatchListItem | undefined = watchList.value.find(
    (movie) => movie.movieId === nextMovieId.value
  );
  if (nextMovieItem) {
    const sortedWatchList = watchList.value.filter(
      (movie) => movie.movieId !== nextMovieItem.movieId
    );
    sortedWatchList.unshift(nextMovieItem);
    return sortedWatchList;
  }
  return watchList.value;
});

const filteredWatchList = computed(() => {
  return filterMovies(watchList.value ?? [], searchTerm);
});

const { mutate: makeNextWatch } = useMakeNextWatch(
  route.params.clubId as string
);

const {
  isAnimating,
  animate,
  list: displayWatchlist,
} = useAnimateRandom<WatchListItem>(filteredWatchList);

const nextMovieItem = computed(() =>
  watchList.value.find((movie) => movie.movieId === nextMovieId.value)
);

const selectRandom = () => {
  clearSearch();
  const selectedIndex = Math.floor(Math.random() * watchList.value.length);
  const randomMovie = sortedWatchList.value[selectedIndex];
  makeNextWatch(randomMovie.movieId);
  animate(nextMovieItem);
};
</script>
