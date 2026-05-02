<script setup lang="ts">
import { computed, ref } from "vue";

import { isDefined } from "../../../../lib/checks/checks";
import { WorkType } from "../../../../lib/types/generated/db";
import { MovieSearchIndex } from "../../../../lib/types/movie";

import MovieSearchPrompt from "@/common/components/MovieSearchPrompt.vue";
import { useClubSlug } from "@/service/useClub";
import { BASE_IMAGE_URL, useAddListItem } from "@/service/useList";
import { TMDBCollection, useInfiniteCollection } from "@/service/useTMDB";

const { listId } = defineProps<{ listId: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const clubSlug = useClubSlug();
const { mutate } = useAddListItem(clubSlug, listId);

const collectionTabs: { key: TMDBCollection; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "now_playing", label: "Now Playing" },
  { key: "upcoming", label: "Upcoming" },
  { key: "top_rated", label: "Top Rated" },
];

const activeCollection = ref<TMDBCollection>("popular");
const activeTabLabel = computed(
  () =>
    collectionTabs.find((t) => t.key === activeCollection.value)?.label ??
    "Popular",
);

const {
  data: collectionData,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteCollection(activeCollection);

const collectionResults = computed<MovieSearchIndex[]>(() => {
  if (!isDefined(collectionData.value)) return [];
  return collectionData.value.pages.flatMap((page) =>
    page.results.map((movie) => ({
      title: movie.title,
      release_date: movie.release_date,
      id: movie.id,
      poster_path: movie.poster_path,
    })),
  );
});

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
  <div class="flex h-full flex-col">
    <div class="mb-2 flex gap-1 overflow-x-auto">
      <button
        v-for="tab in collectionTabs"
        :key="tab.key"
        class="shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors"
        :class="
          activeCollection === tab.key
            ? 'bg-primary text-white'
            : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
        "
        @click="activeCollection = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>
    <movie-search-prompt
      class="min-h-0 flex-1"
      :default-list-title="activeTabLabel"
      :default-list="collectionResults"
      :on-load-more="() => fetchNextPage()"
      :loading-more="isFetchingNextPage"
      :has-more="hasNextPage === true"
      @select-from-default="onSelectMovie"
      @select-from-search="onSelectMovie"
    />
  </div>
</template>
