<template>
  <div class="p-2">
    <add-movie-to-watchlist-prompt v-if="modalOpen" @close="closePrompt" />
    <div>
      <page-header
        :has-back="true"
        back-route="ClubHome"
        page-name="Watch List"
      />

      <loading-spinner v-if="loading" />

      <div v-if="!loading">
        <div class="flex justify-between items-center">
          <v-btn class="mr-2" @click="selectRandom()">
            Random
            <mdicon name="dice-multiple-outline" />
          </v-btn>
          <input
            v-model="searchTerm"
            class="flex-grow h-8 p-2 text-base outline-none rounded-md border-2 text-white border-slate-600 focus:border-primary w-full bg-background"
            placeholder="Search"
          />
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
            :movie-poster-url="movie.poster_url"
            :highlighted="!isAnimating && movie.movieId == nextMovieId"
          >
            <div class="grid grid-cols-2 gap-2">
              <v-btn
                class="flex justify-center"
                @click="reviewMovie(movie.movieId)"
              >
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

        <h1 class="text-2xl font-bold m-4">Backlog</h1>
        <div class="flex items-start gap-2">
          <v-btn @click="openPrompt">
            Add Movie
            <mdicon name="plus" />
          </v-btn>
        </div>

        <transition-group
          tag="div"
          move-class="transition ease-linear duration-300"
          leave-active-class="absolute hidden"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
          class="grid grid-cols-auto justify-items-center my-4"
        >
          <MoviePosterCard
            v-for="(movie, index) in filteredBacklog"
            :key="movie.movieId"
            :class="[index == 0 ? 'z-0' : 'z-10']"
            class="bg-background"
            :movie-title="movie.movieTitle"
            :movie-poster-url="movie.poster_url"
            :highlighted="!isAnimating && movie.movieId == nextMovieId"
          >
            <div class="grid grid-cols-2 gap-2">
              <v-btn
                class="flex justify-center"
                @click="() => moveBacklogItemToWatchlist(movie.movieId)"
              >
                <mdicon name="arrow-collapse-up" />
              </v-btn>
              <v-btn
                class="flex justify-center"
                @click="() => deleteBacklogItem(movie.movieId)"
              >
                <mdicon name="delete" />
              </v-btn>
            </div>
          </MoviePosterCard>
        </transition-group>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useToast } from "vue-toastification";

import { useAnimateRandom } from "../composables/useAnimateRandom";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { WatchListItem } from "@/common/types/models";
import AddMovieToWatchlistPrompt from "@/features/watch-list/components/AddMovieToWatchlistPrompt.vue";
import { useAddReview } from "@/service/useReview";
import {
  useAddMovie,
  useDeleteBacklogItem,
  useDeleteMovie,
  useMakeNextWatch,
  useWatchList,
} from "@/service/useWatchList";

const router = useRouter();
const route = useRoute();

const searchTerm = ref<string>("");

const { loading, data } = useWatchList(route.params.clubId as string);
const watchList = computed(() => (data.value ? data.value.watchList : []));
const backlog = computed(() => (data.value ? data.value.backlog : []));
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

const { deleteMovie } = useDeleteMovie(route.params.clubId as string);
const { addReview } = useAddReview(route.params.clubId as string);

const reviewMovie = async (movieId: number) => {
  await deleteMovie(movieId);
  await addReview(movieId);
  router.push({ name: "Reviews" });
};

const modalOpen = ref(false);
const openPrompt = () => {
  modalOpen.value = true;
};
const closePrompt = () => {
  modalOpen.value = false;
};

const { deleteBacklogItem } = useDeleteBacklogItem(
  route.params.clubId as string
);
const { addMovie } = useAddMovie(route.params.clubId as string);

const toast = useToast();
const moveBacklogItemToWatchlist = (id: number) => {
  if (watchList.value.some((item) => item.movieId === id)) {
    toast.error("That movie is already in your watchlist");
    return;
  }
  deleteBacklogItem(id);
  addMovie(id);
};

const filteredWatchList = computed(() => {
  return sortedWatchList.value.filter((review) =>
    review.movieTitle.toLowerCase().includes(searchTerm.value.toLowerCase())
  );
});

const filteredBacklog = computed(() => {
  return backlog.value.filter((review) =>
    review.movieTitle.toLowerCase().includes(searchTerm.value.toLowerCase())
  );
});

const { makeNextWatch } = useMakeNextWatch(route.params.clubId as string);

const {
  isAnimating,
  animate,
  list: displayWatchlist,
} = useAnimateRandom<WatchListItem>(filteredWatchList);

const nextMovieItem = computed(() =>
  watchList.value.find((movie) => movie.movieId === nextMovieId.value)
);

const selectRandom = () => {
  searchTerm.value = "";
  const selectedIndex = Math.floor(Math.random() * watchList.value.length);
  const randomMovie = sortedWatchList.value[selectedIndex];
  makeNextWatch(randomMovie.movieId);
  animate(nextMovieItem);
};
</script>
