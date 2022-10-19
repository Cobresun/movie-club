<template>
  <v-modal>
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
import MovieSearchPrompt from "./MovieSearchPrompt.vue";
import { MovieSearchIndex, WatchListItem } from "@/models";
import { useTrending } from "@/data/useTMDB";
import { useAddBacklogItem } from "@/data/useWatchList";

const emit = defineEmits<{
  (e: "close", item?: WatchListItem): void;
}>();

const route = useRoute();

const { loading: loadingTrending, data: trending } = useTrending();

const { loading: loadingBacklog, addBacklogItem } = useAddBacklogItem(
  route.params.clubId as string
);

const selectFromSearch = async (movie: MovieSearchIndex) => {
  await addBacklogItem(movie.id);
  emit("close");
};

const loading = computed(() => loadingTrending.value || loadingBacklog.value);
</script>
