<template>
  <v-modal size="lg" @close="emit('close')">
    <loading-spinner v-if="loading" class="self-center" />
    <movie-search-prompt
      v-else
      default-list-title="From your lists"
      :default-list="combinedListSearchIndex"
      @close="emit('close')"
      @select-from-default="selectFromDefault"
      @select-from-search="selectFromSearch"
    />
  </v-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { WorkType } from "../../../../lib/types/generated/db";
import { MovieSearchIndex } from "../../../../lib/types/movie";
import MovieSearchPrompt from "../../../common/components/MovieSearchPrompt.vue";

import { useClubSlug } from "@/service/useClub";
import {
  BASE_IMAGE_URL,
  useAddToReviewsList,
  useAllUserListItems,
  useQueueReview,
} from "@/service/useList";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const clubId = useClubSlug();

const { data: listItems, isLoading: listsLoading } =
  useAllUserListItems(clubId);

const combinedListSearchIndex = computed(
  () =>
    listItems.value?.map((item) => ({
      title: item.title,
      release_date: item.externalData?.release_date ?? "",
      id: parseInt(item.externalId ?? "-1"),
      poster_path: item.imageUrl ?? "",
    })) ?? [],
);

const { mutateAsync: queueReview, isLoading: queueLoading } =
  useQueueReview(clubId);
const { mutateAsync: addFromSearch, isLoading: addLoading } =
  useAddToReviewsList(clubId);

const selectFromDefault = async (movie: MovieSearchIndex) => {
  const sourceItem = listItems.value?.find(
    (item) => item.externalId === movie.id.toString(),
  );
  if (!sourceItem) return;
  await queueReview(
    { workId: sourceItem.id, sourceListId: sourceItem.sourceListId },
    { onSuccess: () => emit("close") },
  );
};

const selectFromSearch = async (movie: MovieSearchIndex) => {
  await addFromSearch(
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
  () => listsLoading.value || queueLoading.value || addLoading.value,
);
</script>
