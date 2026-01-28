<template>
  <div class="flex h-full flex-col text-center">
    <MovieFilterBar
      :search-text="searchText"
      :filter-count="activeFilterCount"
      :filter-chips="activeFilterChips"
      @update:search-text="searchText = $event"
      @toggle-panel="showFilterPanel = !showFilterPanel"
      @remove-filter="clearFilter($event as keyof MovieFilters)"
      @clear-all="clearAllFilters"
    />

    <!-- Filter Panel (mobile: bottom sheet, desktop: dropdown) -->
    <VBottomSheet
      v-if="showFilterPanel && isMobile"
      content-class="px-4 pb-8"
      @close="showFilterPanel = false"
    >
      <FilterPanel
        :filters="filters"
        @close="showFilterPanel = false"
        @apply="applyFilters"
        @clear="clearAllFilters"
      />
    </VBottomSheet>

    <div
      v-if="showFilterPanel && !isMobile"
      class="relative z-20 mt-2 rounded-lg border border-gray-600 bg-gray-800 p-4 shadow-lg"
    >
      <FilterPanel
        :filters="filters"
        @close="showFilterPanel = false"
        @apply="applyFilters"
        @clear="clearAllFilters"
      />
    </div>

    <div class="mt-3 overflow-y-auto">
      <p v-if="noResults">Sorry, your search did not return any results</p>

      <!-- Default List (watch list or trending) - shown when no filters active -->
      <div v-if="!hasActiveFilters && filteredDefaultList.length > 0">
        <h5 class="float-left font-bold">
          {{ defaultListTitle }}
        </h5>
        <movie-table
          :data="filteredDefaultList"
          :headers="tableHeaders"
          :header="false"
          :selectable="true"
          @click-row="selectFromDefaultList"
        >
          <template #item-title="{ item, head }">
            <p>
              <b>{{ item[head.value] }}</b
              ><i> ({{ getReleaseYear(item.release_date) }})</i>
            </p>
          </template>
          <template #item-add>
            <mdicon name="plus" />
          </template>
        </movie-table>
      </div>

      <!-- Discover Results (shown when filters are active) -->
      <div v-if="hasActiveFilters">
        <h5 class="float-left font-bold">
          Discover Results
          <span
            v-if="discoverData?.total_results"
            class="font-normal text-gray-400"
          >
            ({{ discoverData.total_results }} movies)
          </span>
        </h5>
        <loading-spinner v-if="loadingDiscover" class="mt-3 self-center" />
        <movie-table
          v-else-if="filteredDiscoverResults.length > 0"
          :data="filteredDiscoverResults"
          :headers="tableHeaders"
          :header="false"
          :selectable="true"
          @click-row="selectFromSearch"
        >
          <template #item-title="{ item, head }">
            <p>
              <b>{{ item[head.value] }}</b
              ><i> ({{ getReleaseYear(item.release_date) }})</i>
            </p>
          </template>
          <template #item-add>
            <mdicon name="plus" />
          </template>
        </movie-table>
      </div>

      <!-- Search Results (shown when typing without filters) -->
      <div
        v-if="
          !hasActiveFilters &&
          includeSearch &&
          searchData?.results.length &&
          searchData.results.length > 0
        "
      >
        <h5 class="float-left font-bold">Search</h5>
        <movie-table
          :data="searchData.results"
          :headers="tableHeaders"
          :header="false"
          :selectable="true"
          @click-row="selectFromSearch"
        >
          <template #item-title="{ item, head }">
            <p>
              <b>{{ item[head.value] }}</b
              ><i> ({{ getReleaseYear(item.release_date) }})</i>
            </p>
          </template>
          <template #item-add>
            <mdicon name="plus" />
          </template>
        </movie-table>
      </div>

      <loading-spinner
        v-if="includeSearch && !hasActiveFilters && loadingSearch"
        class="mt-3 self-center"
      />
    </div>

    <div class="mt-auto flex justify-between pt-2">
      <v-btn @click="emit('close')"> Cancel </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";

import FilterPanel from "./FilterPanel.vue";
import MovieFilterBar from "./MovieFilterBar.vue";
import VBottomSheet from "./VBottomSheet.vue";
import { MovieSearchIndex } from "../../../lib/types/movie";
import { MovieFilters, useMovieFilters } from "../composables/useMovieFilters";

import { useDiscover, useSearch } from "@/service/useTMDB";

const {
  defaultList,
  defaultListTitle,
  includeSearch = true,
} = defineProps<{
  defaultList: MovieSearchIndex[];
  defaultListTitle: string;
  includeSearch?: boolean;
}>();

const emit = defineEmits<{
  (e: "select-from-default", movie: MovieSearchIndex): void;
  (e: "select-from-search", movie: MovieSearchIndex): void;
  (e: "close"): void;
}>();

const tableHeaders = [
  {
    value: "title",
    style: "text-left pl-4",
  },
];

const getReleaseYear = (date: string) => {
  if (date !== undefined && date.length > 4) {
    return date.substring(0, 4);
  } else {
    return "";
  }
};

const searchText = ref("");
const showFilterPanel = ref(false);

// Responsive detection
const isMobile = ref(false);
const checkMobile = () => {
  isMobile.value = window.innerWidth < 640; // sm breakpoint
};

onMounted(() => {
  checkMobile();
  window.addEventListener("resize", checkMobile);
});

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
});

// Filter state
const {
  filters,
  hasActiveFilters,
  activeFilterCount,
  activeFilterChips,
  clearFilter,
  clearAllFilters,
  filtersToDiscoverParams,
} = useMovieFilters();

const applyFilters = (newFilters: MovieFilters) => {
  Object.assign(filters, newFilters);
};

// Text search (used when no filters active)
const filteredDefaultList = computed(() => {
  const lower = searchText.value.toLowerCase();
  return defaultList.filter((item) => item.title.toLowerCase().includes(lower));
});

const { data: searchData, isLoading: loadingSearch } = useSearch(
  searchText,
  includeSearch,
);

// Discover API (used when filters are active)
const discoverParams = computed(() => filtersToDiscoverParams());
const discoverEnabled = computed(() => hasActiveFilters.value);

const { data: discoverData, isLoading: loadingDiscover } = useDiscover(
  discoverParams,
  discoverEnabled,
);

// Filter discover results by text search (client-side)
const filteredDiscoverResults = computed(() => {
  if (!discoverData.value?.results) return [];
  if (!searchText.value.trim()) return discoverData.value.results;

  const lower = searchText.value.toLowerCase();
  return discoverData.value.results.filter((movie) =>
    movie.title.toLowerCase().includes(lower),
  );
});

const noResults = computed(() => {
  const hasSearched = searchText.value.trim().length > 0;

  if (hasActiveFilters.value) {
    return !loadingDiscover.value && filteredDiscoverResults.value.length === 0;
  }

  if (includeSearch) {
    return (
      hasSearched &&
      !loadingSearch.value &&
      filteredDefaultList.value.length === 0 &&
      searchData.value?.results.length === 0
    );
  } else {
    return hasSearched && filteredDefaultList.value.length === 0;
  }
});

const selectFromDefaultList = (movie: MovieSearchIndex) => {
  emit("select-from-default", movie);
};

const selectFromSearch = (movie: MovieSearchIndex) => {
  emit("select-from-search", movie);
};
</script>
