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

import { MovieSearchIndex } from "@/common/types/movie";
import { useAddReview } from "@/service/useReview";
import { useDeleteMovie, useWatchList } from "@/service/useWatchList";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const route = useRoute();

const { data: watchList, isLoading: watchListLoading } = useWatchList(
  route.params.clubId as string
);

const watchlistSearchIndex = computed(() =>
  watchList.value ? watchList.value.watchList.map((item) => item.movieData) : []
);

const { mutate: deleteMovie, isLoading: deleteLoading } = useDeleteMovie(
  route.params.clubId as string
);
const { mutate: addReview, isLoading: reviewLoading } = useAddReview(
  route.params.clubId as string
);

const selectFromWatchList = async (movie: MovieSearchIndex) => {
  deleteMovie(movie.id);
  addReview(movie.id, { onSuccess: () => emit("close") });
};

const selectFromSearch = async (movie: MovieSearchIndex) => {
  addReview(movie.id, { onSuccess: () => emit("close") });
};

const loading = computed(
  () => watchListLoading.value || deleteLoading.value || reviewLoading.value
);
</script>
