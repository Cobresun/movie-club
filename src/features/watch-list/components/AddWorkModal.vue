<script setup lang="ts">
import { computed, ref } from "vue";

import { hasElements, isDefined } from "../../../../lib/checks/checks";
import { ClubType } from "../../../../lib/types/generated/db";
import { clubTypeConfig, clubTypeStats, workTypeForClub } from "@/common/clubType";
import WorkSearchPrompt from "@/common/components/WorkSearchPrompt.vue";
import WorkSearchSkeleton from "@/common/components/WorkSearchSkeleton.vue";
import { useClub, useClubSlug } from "@/service/useClub";
import { useAddListItem } from "@/service/useList";
import { useBrowse, WorkSearchResult } from "@/service/useMediaSearch";
import { useRecommendations } from "@/service/useRecommendations";

const { listId } = defineProps<{ listId: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const clubSlug = useClubSlug();
const { data: club } = useClub(clubSlug);
const clubType = computed(() => club.value?.type ?? ClubType.movie);
const config = computed(() => clubTypeConfig(clubType.value));

const { mutate } = useAddListItem(clubSlug, listId);

// -- Recommendations, for club types with a source of similar works --
const offersRecommendations = computed(
  () => isDefined(club.value) && config.value.supportsRecommendations,
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

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

const recommendationResults = computed<WorkSearchResult[]>(() =>
  (recommendations.value ?? []).map(({ similarTo, ...work }) => ({
    ...work,
    reason: hasElements(similarTo) ? `Similar to ${listFormat.format(similarTo)}` : undefined,
  })),
);

const recommendationsHint = computed(() => {
  if (!showingRecommendations.value) return undefined;
  if (recommendationsFailed.value) return "Recommendations couldn't be loaded. Try again later.";
  const plural = clubTypeStats(clubType.value).pluralNoun.toLowerCase();
  return `No recommendations yet. They're drawn from the ${plural} your club has scored.`;
});

// -- Browsing the club type's external source --
const selectedBrowseKey = ref<string>();
const activeBrowseTab = computed(
  () =>
    config.value.browseTabs.find((tab) => tab.key === selectedBrowseKey.value) ??
    config.value.browseTabs[0],
);

const {
  data: browseData,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useBrowse(
  clubType,
  computed(() => activeBrowseTab.value.key),
  computed(() => isDefined(club.value)),
);

const browseResults = computed<WorkSearchResult[]>(
  () => browseData.value?.pages.flatMap((page) => page.results) ?? [],
);

// -- Shared --
interface Tab {
  key: string;
  label: string;
  active: boolean;
  select: () => void;
}

const tabs = computed<Tab[]>(() => [
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
  ...config.value.browseTabs.map((tab) => ({
    ...tab,
    active: !showingRecommendations.value && activeBrowseTab.value.key === tab.key,
    select: () => {
      recommendedSelected.value = false;
      selectedBrowseKey.value = tab.key;
    },
  })),
]);

const defaultList = computed(() =>
  showingRecommendations.value ? recommendationResults.value : browseResults.value,
);
const defaultListTitle = computed(() =>
  showingRecommendations.value ? "Recommended for your club" : activeBrowseTab.value.label,
);
const browsing = computed(() => !showingRecommendations.value);

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
      :on-load-more="browsing ? () => fetchNextPage() : undefined"
      :loading-more="isFetchingNextPage"
      :has-more="browsing && hasNextPage === true"
      @select-from-default="onSelectWork"
      @select-from-search="onSelectWork"
    />
  </div>
</template>
