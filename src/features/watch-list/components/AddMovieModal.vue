<script setup lang="ts">
import { WorkType } from "../../../../lib/types/generated/db";
import { MovieSearchIndex } from "../../../../lib/types/movie";

import MovieSearchPrompt from "@/common/components/MovieSearchPrompt.vue";
import { useClubSlug } from "@/service/useClub";
import { BASE_IMAGE_URL, useAddListItem } from "@/service/useList";

const { listId } = defineProps<{ listId: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const clubSlug = useClubSlug();
const { mutate } = useAddListItem(clubSlug, listId);

const onSelectMovie = (movie: MovieSearchIndex) => {
  mutate({
    type: WorkType.movie,
    title: movie.title,
    externalId: movie.id.toString(),
    imageUrl: `${BASE_IMAGE_URL}${movie.poster_path}`,
  });
  emit("close");
};
</script>

<template>
  <movie-search-prompt
    :default-list="[]"
    default-list-title=""
    @close="emit('close')"
    @select-from-search="onSelectMovie"
    @select-from-default="onSelectMovie"
  />
</template>
