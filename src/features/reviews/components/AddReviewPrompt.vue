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
import { useRoute } from "vue-router";

import MovieSearchPrompt from "../../../common/components/MovieSearchPrompt.vue";

import { WorkListType } from "@/common/types/generated/db";
import { MovieSearchIndex } from "@/common/types/movie";
import { useClubId } from "@/service/useClub";
import { useDeleteListItem, useList } from "@/service/useList";
import { useAddReview } from "@/service/useReview";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const route = useRoute();
const clubId = useClubId();
const { data: watchList, isLoading: watchListLoading } = useList(
  clubId,
  WorkListType.watchlist
);

const watchlistSearchIndex = computed(
  () =>
    watchList.value?.map(
      (item) =>
        item.externalData ?? {
          title: item.title,
          release_date: "",
          id: parseInt(item.externalId ?? "-1"),
          poster_path: item.imageUrl ?? "",
        }
    ) ?? []
);

const { mutate: deleteWatchlistItem, isLoading: deleteLoading } =
  useDeleteListItem(clubId, WorkListType.watchlist);
const { mutate: addReview, isLoading: reviewLoading } = useAddReview(
  route.params.clubId as string
);

const selectFromWatchList = async (movie: MovieSearchIndex) => {
  const watchlistItem = watchList.value?.find(
    (item) => item.externalId === movie.id.toString()
  );
  if (!watchlistItem) return;
  deleteWatchlistItem(watchlistItem.id);
  addReview(movie.id, { onSuccess: () => emit("close") });
};

const selectFromSearch = async (movie: MovieSearchIndex) => {
  addReview(movie.id, { onSuccess: () => emit("close") });
};

const loading = computed(
  () => watchListLoading.value || deleteLoading.value || reviewLoading.value
);
</script>
