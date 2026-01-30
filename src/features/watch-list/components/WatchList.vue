<template>
  <add-movie-to-list-modal
    v-if="modalOpen"
    :list-type="WorkListType.watchlist"
    @close="closePrompt"
  />
  <RandomPickerModal
    v-if="randomPickerOpen"
    :items="filteredWatchList"
    @close="randomPickerOpen = false"
    @selected="onRandomSelected"
  />
  <EmptyState
    v-if="showEmptyState"
    :title="hasSearchTerm ? 'No Movies Found' : 'Your Watch List is Empty'"
    :description="
      hasSearchTerm
        ? 'Try a different search term'
        : 'Add movies you\'re planning to watch with your club'
    "
    :action-label="hasSearchTerm ? 'Clear Search' : 'Add Movie'"
    @action="hasSearchTerm ? clearSearch() : openPrompt()"
  />
  <template v-else>
    <div class="ml-2 flex justify-start gap-2">
      <v-btn @click="openPrompt">
        Add Movie
        <mdicon name="plus" />
      </v-btn>
      <v-btn @click="selectRandom()">
        Random
        <mdicon name="dice-multiple-outline" />
      </v-btn>
    </div>
    <VueDraggableNext
      v-model="draggableList"
      tag="div"
      class="my-4 grid grid-cols-auto justify-items-center"
      :delay="150"
      :delay-on-touch-only="true"
      :animation="200"
      filter=".no-drag"
      :prevent-on-filter="true"
      :move="onMove"
      @end="onDragEnd"
    >
      <MoviePosterCard
        v-for="work in draggableList"
        :key="work.id"
        :class="[
          work.id === nextWorkId ? 'no-drag z-0' : 'z-10',
          work.id !== nextWorkId ? 'cursor-grab active:cursor-grabbing' : '',
        ]"
        class="bg-background"
        :movie-title="work.title"
        :movie-poster-url="work.imageUrl ?? ''"
        :highlighted="work.id == nextWorkId"
        :loading="
          work.id === OPTIMISTIC_WORK_ID ||
          (loadingAddReview && reviewedWork?.toString() === work.externalId)
        "
        :show-delete="work.id !== OPTIMISTIC_WORK_ID"
        @delete="() => deleteWatchlistItem(work.id)"
      >
        <div class="grid grid-cols-2 gap-2">
          <v-btn class="flex justify-center" @click="reviewMovie(work)">
            <mdicon name="check" />
          </v-btn>
          <v-btn class="flex justify-center" @click="setNextWork(work.id)">
            <mdicon name="arrow-collapse-up" />
          </v-btn>
        </div>
      </MoviePosterCard>
    </VueDraggableNext>
  </template>
</template>
<script setup lang="ts">
import { AxiosError } from "axios";
import { computed, ref, watch } from "vue";
import { VueDraggableNext } from "vue-draggable-next";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";

import AddMovieToListModal from "./AddMovieToListModal.vue";
import RandomPickerModal from "./RandomPickerModal.vue";
import { WorkListType, WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../../lib/types/lists";

import EmptyState from "@/common/components/EmptyState.vue";
import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { BadRequest } from "@/common/errorCodes";
import { filterMovies } from "@/common/searchMovies";
import { useClubId } from "@/service/useClub";
import {
  useDeleteListItem,
  useList,
  useNextWork,
  useSetNextWork,
  useReorderList,
  OPTIMISTIC_WORK_ID,
  useAddListItem,
} from "@/service/useList";

const { searchTerm, clearSearch } = defineProps<{
  searchTerm: string;
  clearSearch: () => void;
}>();

const router = useRouter();

const clubId = useClubId();
const { mutateAsync: deleteWatchlistItem } = useDeleteListItem(
  clubId,
  WorkListType.watchlist,
);
const {
  mutateAsync: addReview,
  isLoading: loadingAddReview,
  variables: reviewedWork,
} = useAddListItem(clubId, WorkListType.reviews);

const toast = useToast();
const reviewMovie = async (work: DetailedWorkListItem) => {
  await addReview(
    {
      type: WorkType.movie,
      title: work.title,
      externalId: work.externalId,
      imageUrl: work.imageUrl,
    },
    {
      onSuccess: () => {
        router.push({ name: "Reviews" }).catch(console.error);
      },
      onError: (e) => {
        const error = e as AxiosError;
        if (error.response?.data === BadRequest.ItemInList) {
          toast.error("You've already reviewed this movie");
        }
      },
    },
  );
  await deleteWatchlistItem(work.id);
};

const { data: watchList } = useList(clubId, WorkListType.watchlist);
const { data: nextWorkId } = useNextWork(clubId);

const filteredWatchList = computed(() => {
  return filterMovies(watchList.value ?? [], searchTerm);
});

const hasSearchTerm = computed(() => searchTerm.trim().length > 0);
const showEmptyState = computed(() => sortedWatchList.value.length === 0);

const modalOpen = ref(false);
const openPrompt = () => {
  modalOpen.value = true;
};
const closePrompt = () => {
  modalOpen.value = false;
};

const { mutate: setNextWork } = useSetNextWork(clubId);
const { mutate: reorderList } = useReorderList(clubId, WorkListType.watchlist);

const randomPickerOpen = ref(false);

const sortedWatchList = computed(() => {
  const list = filteredWatchList.value;
  const nextItem = list.find((item) => item.id === nextWorkId.value);
  if (nextItem) {
    const rest = list.filter((item) => item.id !== nextItem.id);
    rest.unshift(nextItem);
    return rest;
  }
  return list;
});

const draggableList = ref<DetailedWorkListItem[]>([]);
watch(
  sortedWatchList,
  (newList) => {
    draggableList.value = [...newList];
  },
  { immediate: true },
);

const onMove = (evt: { relatedContext: { index: number } }) => {
  if (nextWorkId.value && evt.relatedContext.index === 0) return false;
};

const onDragEnd = () => {
  // Safety: ensure next watch item stays at index 0
  if (nextWorkId.value) {
    const nextIndex = draggableList.value.findIndex(
      (item) => item.id === nextWorkId.value,
    );
    if (nextIndex > 0) {
      const [nextItem] = draggableList.value.splice(nextIndex, 1);
      draggableList.value.unshift(nextItem);
    }
  }
  const workIds = draggableList.value.map((item) => item.id);
  reorderList(workIds);
};

const selectRandom = () => {
  clearSearch();
  if (filteredWatchList.value.length <= 1) {
    const single = filteredWatchList.value[0];
    if (single) setNextWork(single.id);
    return;
  }
  randomPickerOpen.value = true;
};

const onRandomSelected = (item: DetailedWorkListItem) => {
  const newOrder = [
    item,
    ...sortedWatchList.value.filter((w) => w.id !== item.id),
  ];
  setNextWork(item.id);
  reorderList(newOrder.map((w) => w.id));
  randomPickerOpen.value = false;
};
</script>
