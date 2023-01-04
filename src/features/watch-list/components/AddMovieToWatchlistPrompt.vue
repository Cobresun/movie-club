<template>
  <v-modal @close="emit('close')">
    <loading-spinner v-if="loading" class="self-center" />
    <movie-search-prompt
      v-else
      default-list-title="Trending"
      :default-list="trending ? trending.results : []"
      @close="$emit('close')"
      @select-from-default="selectFromSearch"
      @select-from-search="selectFromSearch"
    />
  </v-modal>
</template>

<script setup lang="ts">
import { computed, defineEmits } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";

import MovieSearchPrompt from "../../../common/components/MovieSearchPrompt.vue";

import { MovieSearchIndex, WatchListItem } from "@/common/types/models";
import { useTrending } from "@/service/useTMDB";
import { useAddBacklogItem, useWatchList } from "@/service/useWatchList";

const emit = defineEmits<{
  (e: "close", item?: WatchListItem): void;
}>();

const route = useRoute();
const clubId = route.params.clubId as string;

const { loading: loadingTrending, data: trending } = useTrending();

const { loading: loadingAdd, addBacklogItem } = useAddBacklogItem(clubId);

const { loading: loadingBacklog, data } = useWatchList(clubId);
const backlog = computed(() => (data.value ? data.value.backlog : []));

const toast = useToast();
const selectFromSearch = async (movie: MovieSearchIndex) => {
  if (backlog.value.some((item) => item.movieId === movie.id)) {
    toast.error("That movie is already in your backlog");
    return;
  }
  await addBacklogItem(movie.id);
  emit("close");
};

const loading = computed(
  () => loadingTrending.value || loadingBacklog.value || loadingAdd.value
);
</script>
