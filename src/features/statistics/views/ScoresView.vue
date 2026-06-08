<template>
  <div>
    <search-filter-bar
      v-model:filtered-data="filteredMovieData"
      v-model:has-active-filters="hasActiveFilters"
      :data="movieData"
      search-placeholder="Search movies"
      class-name="py-4"
    />

    <div class="mb-4 flex flex-wrap items-center gap-4 px-2">
      <div class="flex items-center gap-2">
        <v-switch
          :model-value="showScoreContext"
          color="primary"
          @update:model-value="toggleScoreContext"
        />
        <span class="text-sm text-gray-300">Show Score Context</span>
      </div>
      <div
        v-if="showScoreContext"
        class="flex items-center gap-2 text-xs text-gray-400"
      >
        <span>Below their usual</span>
        <div class="flex h-5 overflow-hidden rounded">
          <div
            class="w-6"
            :style="{ background: 'rgba(239, 68, 68, 0.45)' }"
          ></div>
          <div
            class="w-6"
            :style="{ background: 'rgba(239, 68, 68, 0.22)' }"
          ></div>
          <div
            class="w-6 border border-gray-600"
            :style="{ background: 'transparent' }"
          ></div>
          <div
            class="w-6"
            :style="{ background: 'rgba(34, 197, 94, 0.22)' }"
          ></div>
          <div
            class="w-6"
            :style="{ background: 'rgba(34, 197, 94, 0.45)' }"
          ></div>
        </div>
        <span>Above their usual</span>
      </div>
    </div>

    <EmptyState
      v-if="hasActiveFilters && filteredMovieData.length === 0"
      title="No Movies Found"
      description="Try adjusting your search or filters. You can search by title, genre, company, director, or release year"
    />
    <table-view v-else :review-table="table" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { Member } from "../../../../lib/types/club";
import { useScoresTable } from "../composables/useScoresTable";
import type { MovieData } from "../types";

import EmptyState from "@/common/components/EmptyState.vue";
import SearchFilterBar from "@/common/components/SearchFilterBar.vue";
import TableView from "@/features/reviews/components/TableView.vue";

const props = defineProps<{
  movieData: MovieData[];
  members: Member[];
  showScoreContext: boolean;
}>();

const emit = defineEmits<{
  "update:showScoreContext": [];
}>();

const showScoreContext = computed(() => props.showScoreContext);

const toggleScoreContext = () => {
  emit("update:showScoreContext");
};

const filteredMovieData = ref<MovieData[]>([]);
const hasActiveFilters = ref(false);

const members = computed(() => props.members);

const { table } = useScoresTable(filteredMovieData, members, showScoreContext);
</script>
