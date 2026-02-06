<template>
  <v-modal @close="emit('close')">
    <loading-spinner v-if="loading" class="self-center" />
    <movie-search-prompt
      v-else
      default-list-title="From Watch List"
      :default-list="watchlistSearchIndex"
      @close="emit('close')"
      @select-from-default="selectFromWatchList"
      @select-from-search="selectFromSearch"
    />
  </v-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { WorkListType, WorkType } from "../../../../lib/types/generated/db";
import { MovieSearchIndex } from "../../../../lib/types/movie";
import MovieSearchPrompt from "../../../common/components/MovieSearchPrompt.vue";

import { useClubSlug } from "@/service/useClub";
import {
  BASE_IMAGE_URL,
  useAddListItem,
  useDeleteListItem,
  useList,
} from "@/service/useList";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const clubId = useClubSlug();
const { data: watchList, isLoading: watchListLoading } = useList(
  clubId,
  WorkListType.watchlist,
);

const watchlistSearchIndex = computed(
  () =>
    watchList.value?.map((item) => ({
      title: item.title,
      release_date: item.externalData?.release_date ?? "",
      id: parseInt(item.externalId ?? "-1"),
      poster_path: item.imageUrl ?? "",
    })) ?? [],
);

const { mutateAsync: deleteWatchlistItem, isLoading: deleteLoading } =
  useDeleteListItem(clubId, WorkListType.watchlist);
const { mutateAsync: addReview, isLoading: reviewLoading } = useAddListItem(
  clubId,
  WorkListType.reviews,
);

const selectFromWatchList = async (movie: MovieSearchIndex) => {
  const watchlistItem = watchList.value?.find(
    (item) => item.externalId === movie.id.toString(),
  );
  if (!watchlistItem) return;
  await addReview(
    {
      type: WorkType.movie,
      title: movie.title,
      externalId: movie.id.toString(),
      imageUrl: movie.poster_path,
    },
    { onSuccess: () => emit("close") },
  );
  await deleteWatchlistItem(watchlistItem.id);
};

const selectFromSearch = async (movie: MovieSearchIndex) => {
  await addReview(
    {
      type: WorkType.movie,
      title: movie.title,
      externalId: movie.id.toString(),
      imageUrl: `${BASE_IMAGE_URL}${movie.poster_path}`,
    },
    { onSuccess: () => emit("close") },
  );
};

const loading = computed(
  () => watchListLoading.value || deleteLoading.value || reviewLoading.value,
);
</script>
