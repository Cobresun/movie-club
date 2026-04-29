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
  <div v-else class="flex">
    <div :class="['w-full', { 'md:pr-[35vw]': isDefined(selectedMovie) }]">
      <div class="ml-2 flex flex-wrap justify-start gap-2">
        <v-btn @click="openPrompt">
          Add Movie
          <mdicon name="plus" />
        </v-btn>
        <v-btn v-if="filteredWatchList.length > 1" @click="selectRandom()">
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
        <v-btn @click="shareWatchlist">
          Share
          <mdicon name="share-variant" />
        </v-btn>
      </div>
      <VueDraggableNext
        v-model="draggableList"
        tag="div"
        class="my-4 grid grid-cols-auto justify-items-center"
        :delay="150"
        :delay-on-touch-only="true"
        :animation="200"
        handle=".drag-handle"
        filter=".no-drag"
        :prevent-on-filter="false"
        :move="onMove"
        @end="onDragEnd"
      >
        <MoviePosterCard
          v-for="work in draggableList"
          :key="work.id"
          :data-movie-id="work.id"
          :class="work.id === nextWorkId ? 'no-drag z-0' : 'z-10'"
          :show-drag-handle="reorderMode && work.id !== nextWorkId"
          class="bg-background md:cursor-pointer"
          :movie-title="work.title"
          :movie-poster-url="work.imageUrl ?? ''"
          :highlighted="work.id === nextWorkId || selectedMovieId === work.id"
          :loading="
            work.id === OPTIMISTIC_WORK_ID ||
            (loadingAddReview && reviewedWork?.toString() === work.externalId)
          "
          @click="openMovieDetails(work.id)"
        >
          <div class="grid grid-cols-2 gap-2">
            <v-btn class="flex justify-center" @click.stop="reviewMovie(work)">
              <mdicon name="check" />
            </v-btn>

            <v-btn
              class="flex justify-center"
              @click.stop="
                work.id === nextWorkId ? clearNextWork() : setNextWork(work.id)
              "
            >
              <mdicon
                :name="
                  work.id === nextWorkId
                    ? 'arrow-collapse-down'
                    : 'arrow-collapse-up'
                "
              />
            </v-btn>
          </div>
        </MoviePosterCard>
      </VueDraggableNext>
    </div>

    <!-- Movie Details Drawer -->
    <WatchlistDetailsDrawer
      v-if="selectedMovie"
      :key="selectedMovie.id"
      :movie="selectedMovie"
      :is-next-work="selectedMovie.id === nextWorkId"
      @close="selectedMovieId = undefined"
      @review="reviewSelectedMovie"
      @set-next-work="setNextWork(selectedMovie.id)"
      @clear-next-work="clearNextWork()"
      @delete="deleteSelectedMovie"
    />
  </div>
</template>
<script setup lang="ts">
import { AxiosError } from "axios";
import { computed, nextTick, ref, watch } from "vue";
import { VueDraggableNext } from "vue-draggable-next";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";

import AddMovieToListModal from "./AddMovieToListModal.vue";
import RandomPickerModal from "./RandomPickerModal.vue";
import WatchlistDetailsDrawer from "./WatchlistDetailsDrawer.vue";
import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { WorkListType, WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../../lib/types/lists";

import EmptyState from "@/common/components/EmptyState.vue";
import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { BadRequest } from "@/common/errorCodes";
import { filterMovies } from "@/common/searchMovies";
import { useClubSlug } from "@/service/useClub";
import {
  useClearNextWork,
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

const clubSlug = useClubSlug();
const { mutateAsync: deleteWatchlistItem } = useDeleteListItem(
  clubSlug,
  WorkListType.watchlist,
);
const {
  mutateAsync: addReview,
  isPending: loadingAddReview,
  variables: reviewedWork,
} = useAddListItem(clubSlug, WorkListType.reviews);

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

const { data: watchList } = useList(clubSlug, WorkListType.watchlist);
const { data: nextWorkId } = useNextWork(clubSlug);

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

const { mutate: setNextWork } = useSetNextWork(clubSlug);
const { mutate: reorderList } = useReorderList(
  clubSlug,
  WorkListType.watchlist,
);
const { mutate: clearNextWork } = useClearNextWork(clubSlug);

const reorderMode = ref(false);
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
  if (hasValue(nextWorkId.value) && evt.relatedContext.index === 0)
    return false;
  return true;
};

const onDragEnd = () => {
  // Safety: ensure next watch item stays at index 0
  if (hasValue(nextWorkId.value)) {
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

// Movie details drawer
const selectedMovieId = ref<string | undefined>(undefined);

const selectedMovie = computed(() => {
  if (!isDefined(selectedMovieId.value)) return undefined;
  return draggableList.value.find((w) => w.id === selectedMovieId.value);
});

const openMovieDetails = async (movieId: string) => {
  if (selectedMovieId.value !== movieId) {
    selectedMovieId.value = movieId;

    await nextTick();
    const clickedElement = document.querySelector(
      `[data-movie-id="${movieId}"]`,
    );
    if (clickedElement) {
      clickedElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }
  }
};

const reviewSelectedMovie = () => {
  const movie = selectedMovie.value;
  if (isDefined(movie)) {
    selectedMovieId.value = undefined;
    void reviewMovie(movie);
  }
};

const deleteSelectedMovie = async () => {
  const movie = selectedMovie.value;
  if (isDefined(movie)) {
    selectedMovieId.value = undefined;
    await deleteWatchlistItem(movie.id);
  }
};

const shareWatchlist = async () => {
  const url = `${window.location.origin}/share/club/${clubSlug}/watchlist`;
  await navigator.clipboard.writeText(url);
  toast.success("Watchlist link copied to clipboard!");
};
</script>
