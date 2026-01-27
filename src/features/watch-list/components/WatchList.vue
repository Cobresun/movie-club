<template>
  <EmptyState
    v-if="showEmptyState"
    :icon="hasSearchTerm ? 'magnify-close' : 'playlist-star'"
    :title="hasSearchTerm ? 'No Movies Found' : 'Your Watch List is Empty'"
    :description="
      hasSearchTerm
        ? 'Try a different search term'
        : 'Add movies you\'re planning to watch with your club'
    "
    :action-label="hasSearchTerm ? 'Clear Search' : undefined"
    :variant="hasSearchTerm ? 'search' : 'default'"
    @action="clearSearch"
  />
  <template v-else>
    <div class="ml-2 flex justify-start">
      <v-btn class="mr-2" @click="selectRandom()">
        Random
        <mdicon name="dice-multiple-outline" />
      </v-btn>
    </div>
    <transition-group
      tag="div"
      move-class="transition ease-linear duration-300"
      class="my-4 grid grid-cols-auto justify-items-center"
    >
      <MoviePosterCard
        v-for="(work, index) in sortedWatchList"
        :key="work.id"
        :class="[index == 0 ? 'z-0' : 'z-10']"
        class="bg-background"
        :movie-title="work.title"
        :movie-poster-url="work.imageUrl ?? ''"
        :highlighted="!isAnimating && work.id == nextWorkId"
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
    </transition-group>
  </template>
</template>
<script setup lang="ts">
import { AxiosError } from "axios";
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";

import { WorkListType, WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../../lib/types/lists";
import { useAnimateRandom } from "../composables/useAnimateRandom";

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

const hasWatchList = computed(() => (watchList.value?.length ?? 0) > 0);
const hasSearchTerm = computed(() => searchTerm.trim().length > 0);
const showEmptyState = computed(() => sortedWatchList.value.length === 0);

const { mutate: setNextWork } = useSetNextWork(clubId);

const {
  isAnimating,
  animate,
  list: displayWatchlist,
} = useAnimateRandom<DetailedWorkListItem>(filteredWatchList);

const sortedWatchList = computed(() => {
  const nextItem = displayWatchlist.value?.find(
    (item) => item.id === nextWorkId.value,
  );
  if (nextItem && !isAnimating.value) {
    const sortedWatchList = displayWatchlist.value.filter(
      (item) => item.id !== nextItem.id,
    );
    sortedWatchList.unshift(nextItem);
    return sortedWatchList;
  }
  return displayWatchlist.value;
});

const nextMovieItem = computed(() =>
  watchList.value?.find((work) => work.id === nextWorkId.value),
);

const selectRandom = () => {
  clearSearch();
  const selectedIndex = Math.floor(
    Math.random() * sortedWatchList.value.length,
  );
  const randomWork = sortedWatchList.value[selectedIndex];
  setNextWork(randomWork.id);
  animate(nextMovieItem);
};
</script>
