<template>
  <div class="flex h-full flex-col text-center">
    <input
      v-model="searchText"
      class="rounded-md border-2 border-gray-300 p-1 text-base font-bold text-black outline-none focus:border-primary"
      placeholder="Type to filter or search"
    />
    <div class="mt-3 overflow-y-auto">
      <p v-if="noResults">Sorry, your search did not return any results</p>
      <div v-if="filteredDefaultList.length > 0">
        <h5 class="text-left font-bold">
          {{ defaultListTitle }}
        </h5>
        <TransitionGroup
          tag="div"
          name="result"
          appear
          class="mt-2 grid justify-items-center"
          style="grid-template-columns: repeat(auto-fill, minmax(136px, 1fr))"
        >
          <WorkSearchCard
            v-for="(item, index) in filteredDefaultList"
            :key="item.externalId"
            :style="{ '--stagger': Math.min(index, 8) }"
            :title="item.title"
            :subtitle="item.subtitle"
            :poster-url="item.imageUrl"
            :fallback-icon="fallbackIcon"
            @select="emit('select-from-default', item)"
          />
        </TransitionGroup>
        <div v-if="showLoadMore" class="mt-3 flex justify-center">
          <v-btn :disabled="loadingMore" @click="onLoadMore?.()">
            {{ loadingMore ? "Loading..." : "Load More" }}
          </v-btn>
        </div>
      </div>
      <div v-if="includeSearch && searchResults.length > 0">
        <h5 class="text-left font-bold">Search</h5>
        <TransitionGroup
          tag="div"
          name="result"
          appear
          class="mt-2 grid justify-items-center"
          style="grid-template-columns: repeat(auto-fill, minmax(136px, 1fr))"
        >
          <WorkSearchCard
            v-for="(item, index) in searchResults"
            :key="item.externalId"
            :style="{ '--stagger': Math.min(index, 8) }"
            :title="item.title"
            :subtitle="item.subtitle"
            :poster-url="item.imageUrl"
            :fallback-icon="fallbackIcon"
            @select="emit('select-from-search', item)"
          />
        </TransitionGroup>
      </div>
      <loading-spinner v-if="includeSearch && loadingSearch" class="mt-3 self-center" />
      <div v-if="showHint" class="mt-10 flex flex-col items-center gap-2 text-gray-400">
        <mdicon :name="fallbackIcon" :size="48" class="opacity-50" />
        <p>{{ hintMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

import { isDefined } from "../../../lib/checks/checks";
import { ClubType } from "../../../lib/types/generated/db";
import WorkSearchCard from "./WorkSearchCard.vue";
import { clubTypeConfig } from "@/common/clubType";
import { useMediaSearch, WorkSearchResult } from "@/service/useMediaSearch";

const {
  clubType,
  defaultList,
  defaultListTitle,
  includeSearch = true,
  onLoadMore,
  loadingMore = false,
  hasMore = false,
} = defineProps<{
  clubType: ClubType;
  defaultList: WorkSearchResult[];
  defaultListTitle: string;
  includeSearch?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  hasMore?: boolean;
}>();

const emit = defineEmits<{
  (e: "select-from-default", work: WorkSearchResult): void;
  (e: "select-from-search", work: WorkSearchResult): void;
}>();

const searchText = ref("");

const config = computed(() => clubTypeConfig(clubType));
const fallbackIcon = computed(() => config.value.icon);

const filteredDefaultList = computed(() => {
  const lower = searchText.value.toLowerCase();
  return defaultList.filter((item) => item.title.toLowerCase().includes(lower));
});

const { data: searchData, isLoading: loadingSearch } = useMediaSearch(
  clubType,
  searchText,
  includeSearch,
);

const searchResults = computed(() => searchData.value ?? []);

const showLoadMore = computed(() => {
  const hasNoSearchText = searchText.value.trim().length === 0;
  return isDefined(onLoadMore) && hasMore && hasNoSearchText;
});

const noResults = computed(() => {
  const hasSearched = searchText.value.trim().length > 0;

  if (includeSearch) {
    return (
      hasSearched &&
      !loadingSearch.value &&
      filteredDefaultList.value.length === 0 &&
      searchResults.value.length === 0
    );
  } else {
    return hasSearched && filteredDefaultList.value.length === 0;
  }
});

// Hint shown when nothing is on screen yet (no default items, nothing typed).
const showHint = computed(
  () =>
    !loadingSearch.value &&
    searchText.value.trim().length === 0 &&
    filteredDefaultList.value.length === 0 &&
    searchResults.value.length === 0,
);

const hintMessage = computed(() => config.value.searchHint);
</script>

<style scoped>
.result-enter-active {
  transition:
    opacity var(--motion-base) var(--ease-standard),
    transform var(--motion-base) var(--ease-standard);
  /* Capped stagger (set inline per card): at most 8 * 25ms of added delay. */
  transition-delay: calc(var(--stagger, 0) * 25ms);
}

.result-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

/* Removal is instant on purpose: while the user types, stale cards must
   clear immediately instead of lagging behind the filter. */
.result-leave-active {
  display: none;
}

.result-move {
  transition: transform var(--motion-base) var(--ease-emphasized);
}
</style>
