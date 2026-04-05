<template>
  <v-modal size="lg" @close="emit('close')">
    <loading-spinner v-if="loading" class="self-center" />
    <div v-else class="flex h-full flex-col">
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
        @close="$emit('close')"
        @select-from-default="selectFromSearch"
        @select-from-search="selectFromSearch"
      />
    </div>
  </v-modal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useToast } from "vue-toastification";

import { isDefined, isTrue } from "../../../../lib/checks/checks.js";
import { WorkListType, WorkType } from "../../../../lib/types/generated/db";
import { MovieSearchIndex } from "../../../../lib/types/movie";
import { WatchListItem } from "../../../../lib/types/watchlist";
import MovieSearchPrompt from "../../../common/components/MovieSearchPrompt.vue";

import { useClubSlug } from "@/service/useClub";
import { BASE_IMAGE_URL, useList } from "@/service/useList";
import { useAddListItem } from "@/service/useList";
import { TMDBCollection, useInfiniteCollection } from "@/service/useTMDB";

const collectionTabs: { key: TMDBCollection; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "now_playing", label: "Now Playing" },
  { key: "upcoming", label: "Upcoming" },
  { key: "top_rated", label: "Top Rated" },
];

const { listType } = defineProps<{
  listType: WorkListType.backlog | WorkListType.watchlist;
}>();

const emit = defineEmits<{
  (e: "close", item?: WatchListItem): void;
}>();

const listLabel = computed(() =>
  listType === WorkListType.watchlist ? "watch list" : "backlog",
);

const clubSlug = useClubSlug();

const activeCollection = ref<TMDBCollection>("popular");
const activeTabLabel = computed(
  () =>
    collectionTabs.find((t) => t.key === activeCollection.value)?.label ??
    "Popular",
);

const {
  isLoading: loadingCollection,
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

const { isPending: loadingAdd, mutate: addListItem } = useAddListItem(
  clubSlug,
  listType,
);

const { data: list, isLoading: loadingList } = useList(clubSlug, listType);

const toast = useToast();
const selectFromSearch = (movie: MovieSearchIndex) => {
  if (
    isTrue(
      list.value?.some(
        (item) => parseInt(item.externalId ?? "-1") === movie.id,
      ),
    )
  ) {
    toast.error(`That movie is already in your ${listLabel.value}`);
    return;
  }
  addListItem(
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
  () => loadingCollection.value || loadingList.value || loadingAdd.value,
);
</script>
