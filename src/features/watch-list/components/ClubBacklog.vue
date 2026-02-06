<template>
  <add-movie-to-list-modal
    v-if="modalOpen"
    :list-type="WorkListType.backlog"
    @close="closePrompt"
  />
  <RandomPickerModal
    v-if="randomPickerOpen"
    :items="filteredBacklog"
    confirm-label="Add to Watch List"
    @close="randomPickerOpen = false"
    @selected="onRandomSelected"
  />
  <h1 class="m-4 text-2xl font-bold">Backlog</h1>
  <div class="ml-2 flex items-start gap-2">
    <v-btn @click="openPrompt">
      Add Movie
      <mdicon name="plus" />
    </v-btn>
    <v-btn v-if="filteredBacklog.length > 1" @click="selectRandom">
      Random
      <mdicon name="dice-multiple-outline" />
    </v-btn>
    <v-btn
      :class="reorderMode ? 'ring-2 ring-highlightBackground' : ''"
      @click="reorderMode = !reorderMode"
    >
      Reorder
      <mdicon name="swap-vertical" />
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
    component="TransitionGroup"
    :component-data="{
      props: {
        moveClass: 'transition ease-in-out duration-300',
        tag: 'div',
      },
      attrs: {
        class: 'my-4 grid grid-cols-auto justify-items-center',
      },
    }"
    :delay="150"
    :delay-on-touch-only="true"
    :animation="200"
    handle=".drag-handle"
    @end="onDragEnd"
  >
    <MoviePosterCard
      v-for="movie in draggableList"
      :key="movie.id"
      class="z-10 bg-background"
      :show-drag-handle="reorderMode"
      :movie-title="movie.title"
      :movie-poster-url="movie.imageUrl ?? ''"
      :highlighted="false"
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
import RandomPickerModal from "./RandomPickerModal.vue";
import { isTrue } from "../../../../lib/checks/checks.js";
import { WorkListType } from "../../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../../lib/types/lists";

import EmptyState from "@/common/components/EmptyState.vue";
import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { filterMovies } from "@/common/searchMovies";
import { useClubSlug } from "@/service/useClub";
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

const clubSlug = useClubSlug();
const { data: watchList } = useList(clubSlug, WorkListType.watchlist);
const { data: backlog } = useList(clubSlug, WorkListType.backlog);

const { mutateAsync: deleteBacklogItem } = useDeleteListItem(
  clubSlug,
  WorkListType.backlog,
);
const { mutateAsync: addToWatchlist } = useAddListItem(
  clubSlug,
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

const { mutate: reorderList } = useReorderList(clubSlug, WorkListType.backlog);

const filteredBacklog = computed(() => {
  return filterMovies(backlog.value ?? [], searchTerm);
});

const hasSearchTerm = computed(() => searchTerm.trim().length > 0);
const showEmptyState = computed(() => filteredBacklog.value.length === 0);

const modalOpen = ref(false);
const openPrompt = () => {
  modalOpen.value = true;
};
const closePrompt = () => {
  modalOpen.value = false;
};

const reorderMode = ref(false);
const randomPickerOpen = ref(false);

const draggableList = ref<DetailedWorkListItem[]>([]);
watch(
  filteredBacklog,
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
  clearSearch();
  randomPickerOpen.value = true;
};

const onRandomSelected = (item: DetailedWorkListItem) => {
  void moveBacklogItemToWatchlist(item);
  randomPickerOpen.value = false;
};
</script>
