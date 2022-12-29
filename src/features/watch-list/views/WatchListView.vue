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
        <div class="flex items-start gap-2">
          <v-btn @click="selectRandom()">
            Random
            <mdicon name="dice-multiple-outline" />
          </v-btn>
        </div>

        <input
          v-model="searchTerm"
          class="mb-4 p-2 text-base text-black outline-none rounded-md border-2 border-gray-300 focus:border-primary w-11/12 max-w-md"
          placeholder="Search"
        >
        <transition-group
          tag="div"
          move-class="transition ease-linear duration-300"
          class="grid grid-cols-auto my-4"
        >
          <MoviePosterCard
            v-for="(movie, index) in filteredWatchList"
            :key="movie.movieId"
            :class="[index == 0 ? 'z-0' : 'z-10']"
            class="bg-background"
            :movie-title="movie.movieTitle"
            :movie-poster-url="movie.poster_url"
            :highlighted="!animate && movie.movieId == nextMovieId"
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
          class="grid grid-cols-auto my-4"
        >
          <MoviePosterCard
            v-for="(movie, index) in filteredBacklog"
            :key="movie.movieId"
            :class="[index == 0 ? 'z-0' : 'z-10']"
            class="bg-background"
            :movie-title="movie.movieTitle"
            :movie-poster-url="movie.poster_url"
            :highlighted="!animate && movie.movieId == nextMovieId"
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
import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { WatchListItem } from "@/common/types/models";
import AddMovieToWatchlistPrompt from "@/features/watch-list/components/AddMovieToWatchlistPrompt.vue";
import {
  useAddMovie,
  useDeleteBacklogItem,
  useDeleteMovie,
  useMakeNextWatch,
  useWatchList,
} from "@/service/useWatchList";
import { useAddReview } from "@/service/useReview";

const router = useRouter();
const route = useRoute();

const ROTATE_ITERATIONS = 6;
const rotateReps = ref(ROTATE_ITERATIONS);
const animate = ref(false);
const animateInterval = ref<number | undefined>();
const searchTerm = ref<string>("");

const { loading, data } = useWatchList(route.params.clubId as string);
const watchList = computed(() => (data.value ? data.value.watchList : []));
const backlog = computed(() => (data.value ? data.value.backlog : []));
const nextMovieId = computed(() => data.value?.nextMovieId);

const sortedWatchList = computed(() => {
  let sortedWatchList = watchList.value.slice(0);
  if (!animate.value) {
    const nextMovieItem: WatchListItem | undefined = watchList.value.find(
      (movie) => movie.movieId === nextMovieId.value
    );
    if (nextMovieItem) {
      sortedWatchList = watchList.value.filter(
        (movie) => movie.movieId !== nextMovieItem.movieId
      );
      sortedWatchList.unshift(nextMovieItem);
    }
  }
  return sortedWatchList;
});

const { deleteMovie } = useDeleteMovie(route.params.clubId as string);
const { addReview } = useAddReview(route.params.clubId as string);

const reviewMovie = async (movieId: number) => {
  await deleteMovie(movieId);
  await addReview(movieId);
  router.push({ name: "Reviews" });
};

const { makeNextWatch } = useMakeNextWatch(route.params.clubId as string);

const selectRandom = () => {
  const randomMovie = watchList.value[Math.floor(Math.random() * watchList.value.length)];
  makeNextWatch(randomMovie.movieId);
  rotateReps.value = ROTATE_ITERATIONS;
  animateInterval.value = window.setInterval(animateRotate, 300);
  animate.value = true;
};

const animateRotate = () => {
  if (
    rotateReps.value > 0 ||
    watchList.value[0].movieId !== nextMovieId.value
  ) {
    watchList.value.unshift(watchList.value[watchList.value.length - 1]);
    watchList.value.pop();
    rotateReps.value -= 1;
  } else {
    window.clearInterval(animateInterval.value);
    animate.value = false;
  }
};

const modalOpen = ref(false);
const openPrompt = () => {
  modalOpen.value = true;
};
const closePrompt = (movie?: WatchListItem) => {
  modalOpen.value = false;
  if (movie) {
    backlog.value.push(movie);
  }
};

const { deleteBacklogItem } = useDeleteBacklogItem(
  route.params.clubId as string
);
const { addMovie } = useAddMovie(route.params.clubId as string);

const moveBacklogItemToWatchlist = (id: number) => {
  deleteBacklogItem(id);
  addMovie(id);
};

const filteredWatchList = computed(() => {
  return sortedWatchList.value.filter(review =>
      review.movieTitle.toLowerCase().includes(searchTerm.value.toLowerCase())
    );
});

const filteredBacklog = computed(() => {
  return backlog.value.filter(review =>
      review.movieTitle.toLowerCase().includes(searchTerm.value.toLowerCase())
    );
});
</script>
