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
import MovieSearchPrompt from "../../../common/components/MovieSearchPrompt.vue";
import { MovieSearchIndex, WatchListItem } from "@/common/types/models";
import { useTrending } from "@/service/useTMDB";
import { useAddBacklogItem } from "@/service/useWatchList";

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
