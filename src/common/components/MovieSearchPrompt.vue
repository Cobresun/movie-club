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
        <div
          class="mt-2 grid justify-items-center"
          style="grid-template-columns: repeat(auto-fill, minmax(136px, 1fr))"
        >
          <MovieSearchCard
            v-for="item in filteredDefaultList"
            :key="item.id"
            :title="item.title"
            :year="getReleaseYear(item.release_date)"
            :poster-url="getPosterUrl(item.poster_path)"
            @select="selectFromDefaultList(item)"
          />
        </div>
        <div v-if="showLoadMore" class="mt-3 flex justify-center">
          <v-btn :disabled="loadingMore" @click="onLoadMore?.()">
            {{ loadingMore ? "Loading..." : "Load More" }}
          </v-btn>
        </div>
      </div>
      <div
        v-if="
          includeSearch &&
          searchData?.results.length &&
          searchData.results.length > 0
        "
      >
        <h5 class="text-left font-bold">Search</h5>
        <div
          class="mt-2 grid justify-items-center"
          style="grid-template-columns: repeat(auto-fill, minmax(136px, 1fr))"
        >
          <MovieSearchCard
            v-for="item in searchData.results"
            :key="item.id"
            :title="item.title"
            :year="getReleaseYear(item.release_date)"
            :poster-url="getPosterUrl(item.poster_path)"
            @select="selectFromSearch(item)"
          />
        </div>
      </div>
      <loading-spinner
        v-if="includeSearch && loadingSearch"
        class="mt-3 self-center"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

import MovieSearchCard from "./MovieSearchCard.vue";
import { hasValue, isDefined } from "../../../lib/checks/checks";
import { MovieSearchIndex } from "../../../lib/types/movie";

import { BASE_IMAGE_URL } from "@/service/useList";
import { useSearch } from "@/service/useTMDB";

const {
  defaultList,
  defaultListTitle,
  includeSearch = true,
  onLoadMore,
  loadingMore = false,
  hasMore = false,
} = defineProps<{
  defaultList: MovieSearchIndex[];
  defaultListTitle: string;
  includeSearch?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  hasMore?: boolean;
}>();

const emit = defineEmits<{
  (e: "select-from-default", movie: MovieSearchIndex): void;
  (e: "select-from-search", movie: MovieSearchIndex): void;
}>();

const getPosterUrl = (posterPath: string): string => {
  if (!hasValue(posterPath)) return "";
  if (posterPath.startsWith("http")) return posterPath;
  return `${BASE_IMAGE_URL}${posterPath}`;
};

const getReleaseYear = (date: string) => {
  if (hasValue(date) && date.length > 4) {
    return date.substring(0, 4);
  } else {
    return "";
  }
};

const searchText = ref("");

const filteredDefaultList = computed(() => {
  const lower = searchText.value.toLowerCase();
  return defaultList.filter((item) => item.title.toLowerCase().includes(lower));
});

const { data: searchData, isLoading: loadingSearch } = useSearch(
  searchText,
  includeSearch,
);

const showLoadMore = computed(() => {
  const hasNoSearchText = searchText.value.trim().length === 0;
  return isDefined(onLoadMore) && hasMore && hasNoSearchText;
});

const noResults = computed(() => {
  // Don't show "no results" if the user hasn't typed anything
  const hasSearched = searchText.value.trim().length > 0;

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
