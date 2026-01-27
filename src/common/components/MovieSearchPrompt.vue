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
        <h5 class="float-left font-bold">
          {{ defaultListTitle }}
        </h5>
        <movie-table
          :data="filteredDefaultList"
          :headers="defaultListHeaders"
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
      <div
        v-if="
          includeSearch &&
          searchData?.results.length &&
          searchData.results.length > 0
        "
      >
        <h5 class="float-left font-bold">Search</h5>
        <movie-table
          :data="searchData.results"
          :headers="searchHeaders"
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
        v-if="includeSearch && loadingSearch"
        class="mt-3 self-center"
      />
    </div>
    <div class="mt-auto flex justify-between pt-2">
      <v-btn @click="emit('close')"> Cancel </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

import { MovieSearchIndex } from "../../../lib/types/movie";

import { useSearch } from "@/service/useTMDB";

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

const defaultListHeaders = [
  {
    value: "title",
    style: "text-left pl-4",
  },
];

const searchHeaders = [
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

const filteredDefaultList = computed(() => {
  const lower = searchText.value.toLowerCase();
  return defaultList.filter((item) => item.title.toLowerCase().includes(lower));
});

const { data: searchData, isLoading: loadingSearch } = useSearch(
  searchText,
  includeSearch,
);

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
