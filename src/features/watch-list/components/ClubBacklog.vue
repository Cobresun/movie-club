<template>
  <add-movie-to-watchlist-prompt v-if="modalOpen" @close="closePrompt" />
  <h1 class="m-4 text-2xl font-bold">Backlog</h1>
  <div class="ml-2 flex items-start gap-2">
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
    class="my-4 grid grid-cols-auto justify-items-center"
  >
    <MoviePosterCard
      v-for="(movie, index) in sortedBacklog"
      :key="movie.id"
      :class="[index == 0 ? 'z-0' : 'z-10']"
      class="bg-background"
      :movie-title="movie.title"
      :movie-poster-url="movie.imageUrl ?? ''"
      :highlighted="movie === selectedMovie"
      show-delete
      @delete="() => deleteBacklogItem(movie.id)"
    >
      <v-btn
        class="flex justify-center"
        @click="() => moveBacklogItemToWatchlist(movie)"
      >
        <mdicon name="arrow-collapse-up" />
      </v-btn>
    </MoviePosterCard>
  </transition-group>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { useToast } from "vue-toastification";

import AddMovieToWatchlistPrompt from "./AddMovieToWatchlistPrompt.vue";
import { isTrue } from "../../../../lib/checks/checks.js";
import { WorkListType } from "../../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../../lib/types/lists";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { filterMovies } from "@/common/searchMovies";
import { useClubId } from "@/service/useClub";
import { useAddListItem, useDeleteListItem, useList } from "@/service/useList";

const { searchTerm, clearSearch } = defineProps<{
  searchTerm: string;
  clearSearch: () => void;
}>();

const clubId = useClubId();
const { data: watchList } = useList(clubId, WorkListType.watchlist);
const { data: backlog } = useList(clubId, WorkListType.backlog);

const { mutateAsync: deleteBacklogItem } = useDeleteListItem(
  clubId,
  WorkListType.backlog,
);
const { mutateAsync: addToWatchlist } = useAddListItem(
  clubId,
  WorkListType.watchlist,
);

const toast = useToast();
const moveBacklogItemToWatchlist = async (movie: DetailedWorkListItem) => {
  if (
    isTrue(
      watchList.value?.some((item) => item.externalId === movie.externalId),
    )
  ) {
    toast.error("That movie is already in your watchlist");
    return;
  }
  await addToWatchlist(movie);
  await deleteBacklogItem(movie.id);
};

const filteredBacklog = computed(() => {
  return filterMovies(backlog.value ?? [], searchTerm);
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
    (item) => item === selectedMovie.value,
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
