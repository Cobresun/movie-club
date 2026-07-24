<script setup lang="ts">
import { computed, ref } from "vue";
import { useToast } from "vue-toastification";

import { isDefined } from "../../../../lib/checks/checks";
import { ClubType } from "../../../../lib/types/generated/db";
import { workTypeForClub } from "@/common/clubType";
import WorkSearchPrompt from "@/common/components/WorkSearchPrompt.vue";
import { useClub, useClubSlug } from "@/service/useClub";
import { BASE_IMAGE_URL, useAddListItem } from "@/service/useList";
import {
  BOOK_BROWSE_SUBJECTS,
  BookBrowseSubject,
  useBookBrowse,
  WorkSearchResult,
} from "@/service/useMediaSearch";
import { TMDBCollection, useInfiniteCollection } from "@/service/useTMDB";

const { listId } = defineProps<{ listId: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const clubSlug = useClubSlug();
const { data: club } = useClub(clubSlug);
const clubType = computed(() => club.value?.type ?? ClubType.movie);
const isMovieClub = computed(() => clubType.value === ClubType.movie);

const { mutate } = useAddListItem(clubSlug, listId);
const toast = useToast();

// -- Movie clubs: TMDB collections (paginated) --
const movieTabs: { key: TMDBCollection; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "now_playing", label: "Now Playing" },
  { key: "upcoming", label: "Upcoming" },
  { key: "top_rated", label: "Top Rated" },
];
const activeCollection = ref<TMDBCollection>("popular");
const activeMovieTabLabel = computed(
  () => movieTabs.find((t) => t.key === activeCollection.value)?.label ?? "Popular",
);

const {
  data: collectionData,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteCollection(activeCollection);

const movieResults = computed<WorkSearchResult[]>(() => {
  if (!isMovieClub.value || !isDefined(collectionData.value)) return [];
  return collectionData.value.pages.flatMap((page) =>
    page.results.map((movie) => ({
      externalId: String(movie.id),
      title: movie.title,
      subtitle: movie.release_date ? movie.release_date.slice(0, 4) : undefined,
      imageUrl: movie.poster_path ? `${BASE_IMAGE_URL}${movie.poster_path}` : undefined,
    })),
  );
});

// -- Book clubs: Google Books subject browse --
const bookTabs = BOOK_BROWSE_SUBJECTS;
const activeBookSubject = ref<BookBrowseSubject>("fiction");
const activeBookTabLabel = computed(
  () => bookTabs.find((t) => t.key === activeBookSubject.value)?.label ?? "Fiction",
);
const { data: bookBrowse } = useBookBrowse(activeBookSubject);
const bookResults = computed<WorkSearchResult[]>(() =>
  isMovieClub.value ? [] : (bookBrowse.value ?? []),
);

// -- Shared --
const defaultList = computed(() => (isMovieClub.value ? movieResults.value : bookResults.value));
const defaultListTitle = computed(() =>
  isMovieClub.value ? activeMovieTabLabel.value : activeBookTabLabel.value,
);

const onSelectWork = (work: WorkSearchResult) => {
  mutate(
    {
      type: workTypeForClub(clubType.value),
      title: work.title,
      externalId: work.externalId,
      imageUrl: work.imageUrl,
    },
    {
      onSuccess: () => toast.success(`Added "${work.title}" to the list`),
      onError: () => toast.error(`Failed to add "${work.title}". Please try again.`),
    },
  );
  emit("close");
};
</script>

<template>
  <loading-spinner v-if="!club" class="self-center" />
  <div v-else class="flex h-full flex-col">
    <div class="mb-2 flex gap-1 overflow-x-auto">
      <template v-if="isMovieClub">
        <button
          v-for="tab in movieTabs"
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
      </template>
      <template v-else>
        <button
          v-for="tab in bookTabs"
          :key="tab.key"
          class="shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors"
          :class="
            activeBookSubject === tab.key
              ? 'bg-primary text-white'
              : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
          "
          @click="activeBookSubject = tab.key"
        >
          {{ tab.label }}
        </button>
      </template>
    </div>
    <WorkSearchPrompt
      class="min-h-0 flex-1"
      :club-type="clubType"
      :default-list-title="defaultListTitle"
      :default-list="defaultList"
      :on-load-more="isMovieClub ? () => fetchNextPage() : undefined"
      :loading-more="isFetchingNextPage"
      :has-more="isMovieClub && hasNextPage === true"
      @select-from-default="onSelectWork"
      @select-from-search="onSelectWork"
    />
  </div>
</template>
