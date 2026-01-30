<template>
  <add-movie-to-list-modal
    v-if="modalOpen"
    :list-type="WorkListType.backlog"
    @close="closePrompt"
  />
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

  <EmptyState
    v-if="showEmptyState"
    :title="hasSearchTerm ? 'No Movies Found' : 'Your Backlog is Empty'"
    :description="
      hasSearchTerm
        ? 'Try a different search term'
        : 'Add movies to your backlog to keep track of future watch list candidates'
    "
    :action-label="hasSearchTerm ? 'Clear Search' : undefined"
    @action="clearSearch"
  />
  <VueDraggableNext
    v-if="!showEmptyState"
    v-model="draggableList"
    tag="transition-group"
    :component-data="{
      moveClass: 'transition ease-in-out duration-300',
    }"
    class="my-4 grid grid-cols-auto justify-items-center"
    :delay="150"
    :delay-on-touch-only="true"
    :animation="200"
    filter=".no-drag"
    :prevent-on-filter="true"
    @end="onDragEnd"
  >
    <MoviePosterCard
      v-for="(movie, index) in draggableList"
      :key="movie.id"
      :class="[
        index == 0 && selectedMovie
          ? 'no-drag z-0'
          : index == 0
            ? 'z-0'
            : 'z-10',
        index != 0 || !selectedMovie
          ? 'cursor-grab active:cursor-grabbing'
          : '',
      ]"
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
  </VueDraggableNext>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { VueDraggableNext } from "vue-draggable-next";
import { useToast } from "vue-toastification";

import AddMovieToListModal from "./AddMovieToListModal.vue";
import { isTrue } from "../../../../lib/checks/checks.js";
import { WorkListType } from "../../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../../lib/types/lists";

import EmptyState from "@/common/components/EmptyState.vue";
import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { filterMovies } from "@/common/searchMovies";
import { useClubId } from "@/service/useClub";
import {
  useAddListItem,
  useDeleteListItem,
  useList,
  useReorderList,
} from "@/service/useList";

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

const { mutate: reorderList } = useReorderList(clubId, WorkListType.backlog);

const filteredBacklog = computed(() => {
  return filterMovies(backlog.value ?? [], searchTerm);
});

const hasBacklog = computed(() => (backlog.value?.length ?? 0) > 0);
const hasSearchTerm = computed(() => searchTerm.trim().length > 0);
const showEmptyState = computed(() => sortedBacklog.value.length === 0);

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

const draggableList = ref<DetailedWorkListItem[]>([]);
watch(
  sortedBacklog,
  (newList) => {
    draggableList.value = [...newList];
  },
  { immediate: true },
);

const onDragEnd = () => {
  const workIds = draggableList.value.map((item) => item.id);
  reorderList(workIds);
};

const selectRandom = () => {
  if (!backlog.value) return;
  clearSearch();
  const selectedIndex = Math.floor(Math.random() * backlog.value?.length);
  const randomMovie = backlog.value[selectedIndex];
  selectedMovie.value = randomMovie;
};
</script>
