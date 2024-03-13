<template>
  <add-movie-to-watchlist-prompt v-if="modalOpen" @close="closePrompt" />
  <h1 class="text-2xl font-bold m-4">Backlog</h1>
  <div class="flex items-start gap-2 ml-2">
    <v-btn @click="openPrompt">
      Add Movie
      <mdicon name="plus" />
    </v-btn>
    <v-btn @click="selectRandom">
      Random
      <mdicon name="dice-multiple-outline" />
    </v-btn>
  </div>

  <transition-group
    tag="div"
    move-class="transition ease-in-out duration-300"
    leave-active-class="absolute hidden"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
    class="grid grid-cols-auto justify-items-center my-4"
  >
    <MoviePosterCard
      v-for="(movie, index) in sortedBacklog"
      :key="movie.id"
      :class="[index == 0 ? 'z-0' : 'z-10']"
      class="bg-background"
      :movie-title="movie.title"
      :movie-poster-url="movie.imageUrl ?? ''"
      :highlighted="movie === selectedMovie"
    >
      <div class="grid grid-cols-2 gap-2">
        <v-btn
          class="flex justify-center"
          @click="() => moveBacklogItemToWatchlist(movie)"
        >
          <mdicon name="arrow-collapse-up" />
        </v-btn>
        <v-btn
          class="flex justify-center"
          @click="() => deleteBacklogItem(movie.id)"
        >
          <mdicon name="delete" />
        </v-btn>
      </div>
    </MoviePosterCard>
  </transition-group>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";

import AddMovieToWatchlistPrompt from "./AddMovieToWatchlistPrompt.vue";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { filterMovies } from "@/common/searchMovies";
import { DetailedWorkListItem } from "@/common/types/lists";
import { TMDBMovieData } from "@/common/types/movie";
import { WatchListItem } from "@/common/types/watchlist";
import { useClubId } from "@/service/useClub";
import { useDeleteListItem, useList } from "@/service/useList";
import { useAddMovie, useWatchList } from "@/service/useWatchList";

const { searchTerm, clearSearch } = defineProps<{
  searchTerm: string;
  clearSearch: () => void;
}>();

const route = useRoute();

const clubId = useClubId();
const { data } = useWatchList(route.params.clubId as string);
const { data: backlog } = useList(clubId, "backlog");
const watchList = computed(() => (data.value ? data.value.watchList : []));

const { mutate: deleteBacklogItem } = useDeleteListItem(clubId, "backlog");
const { mutate: addMovie } = useAddMovie(route.params.clubId as string);

const toast = useToast();
const moveBacklogItemToWatchlist = (movie: DetailedWorkListItem) => {
  if (
    watchList.value.some((item) => item.movieId.toString() === movie.externalId)
  ) {
    toast.error("That movie is already in your watchlist");
    return;
  }
  deleteBacklogItem(movie.id);
  addMovie(toDetailedMovie(movie));
};

const toDetailedMovie = (item: DetailedWorkListItem): WatchListItem => ({
  movieId: parseInt(item.externalId ?? "-1"),
  movieTitle: item.title,
  posterUrl: item.imageUrl ?? "",
  movieData: item.externalData as TMDBMovieData,
  timeAdded: {
    ["@ts"]: item.createdDate,
  },
});

const filteredBacklog = computed(() => {
  const filtered = filterMovies(
    backlog.value?.map((item) => toDetailedMovie(item)) ?? [],
    searchTerm
  );
  return (
    backlog.value?.filter((item) =>
      filtered.some((movie) => movie.movieId.toString() === item.externalId)
    ) ?? []
  );
});

const modalOpen = ref(false);
const openPrompt = () => {
  modalOpen.value = true;
};
const closePrompt = () => {
  modalOpen.value = false;
};

const selectedMovie = ref<DetailedWorkListItem>();

const sortedBacklog = computed(() => {
  const selectedIndex = filteredBacklog.value.findIndex(
    (item) => item === selectedMovie.value
  );
  if (selectedIndex === -1) return filteredBacklog.value;
  return [
    ...filteredBacklog.value.slice(selectedIndex),
    ...filteredBacklog.value.slice(0, selectedIndex),
  ];
});

const selectRandom = () => {
  if (!backlog.value) return;
  clearSearch();
  const selectedIndex = Math.floor(Math.random() * backlog.value?.length);
  const randomMovie = backlog.value[selectedIndex];
  selectedMovie.value = randomMovie;
};
</script>
