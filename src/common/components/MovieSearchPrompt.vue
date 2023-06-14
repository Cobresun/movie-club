<template>
  <div class="flex flex-col text-center h-full">
    <input
      v-model="searchText"
      class="p-1 font-bold text-base text-black outline-none rounded-md border-2 border-gray-300 focus:border-primary"
      placeholder="Type to filter or search"
    />
    <div class="overflow-y-auto mt-3">
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
        class="self-center mt-3"
      />
    </div>
    <div class="pt-2 flex justify-between mt-auto">
      <v-btn @click="emit('close')"> Cancel </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

import { MovieSearchIndex } from "../types/movie";

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
  includeSearch
);

const noResults = computed(() => {
  if (includeSearch) {
    return (
      !loadingSearch.value &&
      filteredDefaultList.value.length === 0 &&
      searchData.value?.results.length === 0
    );
  } else {
    return filteredDefaultList.value.length === 0;
  }
});

const selectFromDefaultList = (movie: MovieSearchIndex) => {
  emit("select-from-default", movie);
};

const selectFromSearch = (movie: MovieSearchIndex) => {
  emit("select-from-search", movie);
};
</script>
