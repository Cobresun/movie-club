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
import { computed } from "vue";
import { useToast } from "vue-toastification";

import { isTrue } from "../../../../lib/checks/checks.js";
import { WorkListType, WorkType } from "../../../../lib/types/generated/db";
import { MovieSearchIndex } from "../../../../lib/types/movie";
import { WatchListItem } from "../../../../lib/types/watchlist";
import MovieSearchPrompt from "../../../common/components/MovieSearchPrompt.vue";

import { useClubId } from "@/service/useClub";
import { BASE_IMAGE_URL, useList } from "@/service/useList";
import { useAddListItem } from "@/service/useList";
import { useTrending } from "@/service/useTMDB";

const emit = defineEmits<{
  (e: "close", item?: WatchListItem): void;
}>();

const clubId = useClubId();

const { isLoading: loadingTrending, data: trending } = useTrending();

const { isLoading: loadingAdd, mutate: addBacklogItem } = useAddListItem(
  clubId,
  WorkListType.backlog,
);

const { data: backlog, isLoading: loadingBacklog } = useList(
  clubId,
  WorkListType.backlog,
);

const toast = useToast();
const selectFromSearch = (movie: MovieSearchIndex) => {
  if (
    isTrue(
      backlog.value?.some(
        (item) => parseInt(item.externalId ?? "-1") === movie.id,
      ),
    )
  ) {
    toast.error("That movie is already in your backlog");
    return;
  }
  addBacklogItem(
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
  () => loadingTrending.value || loadingBacklog.value || loadingAdd.value,
);
</script>
