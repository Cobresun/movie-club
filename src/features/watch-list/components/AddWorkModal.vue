<script setup lang="ts">
import { computed, ref } from "vue";

import { hasElements, isDefined } from "../../../../lib/checks/checks";
import { ClubType } from "../../../../lib/types/generated/db";
import { clubTypeStats, clubTypeSupportsRecommendations, workTypeForClub } from "@/common/clubType";
import WorkSearchPrompt from "@/common/components/WorkSearchPrompt.vue";
import WorkSearchSkeleton from "@/common/components/WorkSearchSkeleton.vue";
import { useClub, useClubSlug } from "@/service/useClub";
import { BASE_IMAGE_URL, useAddListItem } from "@/service/useList";
import {
  BOOK_BROWSE_SUBJECTS,
  BookBrowseSubject,
  useBookBrowse,
  WorkSearchResult,
} from "@/service/useMediaSearch";
import { useRecommendations } from "@/service/useRecommendations";
import { TMDBCollection, useInfiniteCollection } from "@/service/useTMDB";

const { listId } = defineProps<{ listId: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const clubSlug = useClubSlug();
const { data: club } = useClub(clubSlug);
const clubType = computed(() => club.value?.type ?? ClubType.movie);
const isMovieClub = computed(() => clubType.value === ClubType.movie);

const { mutate } = useAddListItem(clubSlug, listId);

// -- Recommendations, for club types with a source of similar works --
const offersRecommendations = computed(
  () => isDefined(club.value) && clubTypeSupportsRecommendations(club.value.type),
);
const recommendedSelected = ref(true);
const showingRecommendations = computed(
  () => offersRecommendations.value && recommendedSelected.value,
);

const {
  data: recommendations,
  isLoading: recommendationsLoading,
  isError: recommendationsFailed,
} = useRecommendations(clubSlug, showingRecommendations);

const recommendationResults = computed<WorkSearchResult[]>(() =>
  (recommendations.value ?? []).map(({ similarTo, ...work }) => ({
    ...work,
    reason: hasElements(similarTo) ? `Similar to ${similarTo.join(" and ")}` : undefined,
  })),
);

const recommendationsHint = computed(() => {
  if (!showingRecommendations.value) return undefined;
  if (recommendationsFailed.value) return "Recommendations couldn't be loaded. Try again later.";
  const plural = clubTypeStats(clubType.value).pluralNoun.toLowerCase();
  return `No recommendations yet. They're drawn from the ${plural} your members have scored.`;
});

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
interface BrowseTab {
  key: string;
  label: string;
  active: boolean;
  select: () => void;
}

const tabs = computed<BrowseTab[]>(() => [
  ...(offersRecommendations.value
    ? [
        {
          key: "recommended",
          label: "Recommended",
          active: showingRecommendations.value,
          select: () => (recommendedSelected.value = true),
        },
      ]
    : []),
  ...(isMovieClub.value
    ? movieTabs.map((tab) => ({
        ...tab,
        active: !showingRecommendations.value && activeCollection.value === tab.key,
        select: () => {
          recommendedSelected.value = false;
          activeCollection.value = tab.key;
        },
      }))
    : bookTabs.map((tab) => ({
        ...tab,
        active: !showingRecommendations.value && activeBookSubject.value === tab.key,
        select: () => {
          recommendedSelected.value = false;
          activeBookSubject.value = tab.key;
        },
      }))),
]);

const browsingMovies = computed(() => isMovieClub.value && !showingRecommendations.value);

const defaultList = computed(() => {
  if (showingRecommendations.value) return recommendationResults.value;
  return isMovieClub.value ? movieResults.value : bookResults.value;
});
const defaultListTitle = computed(() => {
  if (showingRecommendations.value) return "Recommended for your club";
  return isMovieClub.value ? activeMovieTabLabel.value : activeBookTabLabel.value;
});

const onSelectWork = (work: WorkSearchResult) => {
  mutate({
    type: workTypeForClub(clubType.value),
    title: work.title,
    externalId: work.externalId,
    imageUrl: work.imageUrl,
  });
  emit("close");
};
</script>

<template>
  <WorkSearchSkeleton v-if="!club" />
  <div v-else class="flex h-full flex-col">
    <div class="mb-2 flex gap-1 overflow-x-auto">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors"
        :class="
          tab.active ? 'bg-primary text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
        "
        :aria-pressed="tab.active"
        @click="tab.select()"
      >
        {{ tab.label }}
      </button>
    </div>
    <WorkSearchPrompt
      class="min-h-0 flex-1"
      :club-type="clubType"
      :default-list-title="defaultListTitle"
      :default-list="defaultList"
      :loading-default="showingRecommendations && recommendationsLoading"
      :empty-hint="recommendationsHint"
      :on-load-more="browsingMovies ? () => fetchNextPage() : undefined"
      :loading-more="isFetchingNextPage"
      :has-more="browsingMovies && hasNextPage === true"
      @select-from-default="onSelectWork"
      @select-from-search="onSelectWork"
    />
  </div>
</template>
