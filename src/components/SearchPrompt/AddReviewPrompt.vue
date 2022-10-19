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
import { MovieSearchIndex } from "@/models";
import MovieSearchPrompt from "./MovieSearchPrompt.vue";
import { useRoute } from "vue-router";
import { useDeleteMovie, useWatchList } from "@/data/useWatchList";
import { useAddReview } from "@/data/useReview";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const route = useRoute();

const { data: watchList, loading: watchListLoading } = useWatchList(
  route.params.clubId as string
);

const watchlistSearchIndex = computed(() =>
  watchList.value
    ? watchList.value.watchList.map((item) => ({
        id: item.movieId,
        title: item.movieTitle,
        release_date: item.releaseDate,
      }))
    : []
);

const { deleteMovie, loading: deleteLoading } = useDeleteMovie(
  route.params.clubId as string
);
const { addReview, loading: reviewLoading } = useAddReview(
  route.params.clubId as string
);

const selectFromWatchList = async (movie: MovieSearchIndex) => {
  await deleteMovie(movie.id);
  await addReview(movie.id);
  emit("close");
};

const selectFromSearch = async (movie: MovieSearchIndex) => {
  await addReview(movie.id);
  emit("close");
};

const loading = computed(
  () => watchListLoading.value || deleteLoading.value || reviewLoading.value
);
</script>
