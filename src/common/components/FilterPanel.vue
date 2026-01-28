<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-bold text-text">Filters</h3>
      <button
        type="button"
        class="text-gray-400 hover:text-text"
        @click="emit('close')"
      >
        <mdicon name="close" size="24" />
      </button>
    </div>

    <!-- Genre Select -->
    <GenreSelect v-model="localFilters.genres" />

    <!-- Company Search -->
    <CompanySearch v-model="localFilters.companies" />

    <!-- Release Year Range -->
    <div>
      <label class="mb-2 block text-sm font-medium text-text"
        >Release Year</label
      >
      <div class="flex items-center gap-2">
        <input
          v-model.number="yearStart"
          type="number"
          min="1900"
          :max="currentYear"
          placeholder="From"
          class="w-24 rounded-md border-2 border-gray-600 bg-gray-800 p-2 text-sm text-text outline-none focus:border-primary"
        />
        <span class="text-gray-400">to</span>
        <input
          v-model.number="yearEnd"
          type="number"
          min="1900"
          :max="currentYear"
          placeholder="To"
          class="w-24 rounded-md border-2 border-gray-600 bg-gray-800 p-2 text-sm text-text outline-none focus:border-primary"
        />
      </div>
    </div>

    <!-- Minimum Rating Slider -->
    <div>
      <label class="mb-2 block text-sm font-medium text-text">
        Minimum Rating: {{ localFilters.minRating ?? "Any" }}
      </label>
      <div class="flex items-center gap-3">
        <input
          v-model.number="ratingValue"
          type="range"
          min="0"
          max="10"
          step="0.5"
          class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-primary"
        />
        <button
          v-if="localFilters.minRating !== undefined"
          type="button"
          class="text-xs text-gray-400 hover:text-text"
          @click="localFilters.minRating = undefined"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Sort By -->
    <div>
      <label class="mb-2 block text-sm font-medium text-text">Sort By</label>
      <select
        v-model="localFilters.sortBy"
        class="w-full rounded-md border-2 border-gray-600 bg-gray-800 p-2 text-sm text-text outline-none focus:border-primary"
      >
        <option
          v-for="option in SORT_OPTIONS"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>

    <!-- Action Buttons -->
    <div class="flex justify-end gap-3 border-t border-gray-700 pt-4">
      <v-btn @click="handleClear">Clear</v-btn>
      <v-btn @click="handleApply">Apply</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";

import CompanySearch from "./CompanySearch.vue";
import GenreSelect from "./GenreSelect.vue";
import {
  CompanyFilter,
  MovieFilters,
  SORT_OPTIONS,
} from "../composables/useMovieFilters";

const props = defineProps<{
  filters: MovieFilters;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "apply", filters: MovieFilters): void;
  (e: "clear"): void;
}>();

const currentYear = new Date().getFullYear();

// Local copy of filters for editing
const localFilters = reactive<MovieFilters>({
  genres: [...props.filters.genres],
  companies: [...props.filters.companies],
  yearRange: { ...props.filters.yearRange },
  minRating: props.filters.minRating,
  sortBy: props.filters.sortBy,
});

// Sync with props when they change
watch(
  () => props.filters,
  (newFilters) => {
    localFilters.genres = [...newFilters.genres];
    localFilters.companies = [...newFilters.companies];
    localFilters.yearRange = { ...newFilters.yearRange };
    localFilters.minRating = newFilters.minRating;
    localFilters.sortBy = newFilters.sortBy;
  },
  { deep: true },
);

// Year range helpers
const yearStart = computed({
  get: () => localFilters.yearRange.start,
  set: (val) => {
    localFilters.yearRange.start =
      val !== undefined && val !== 0 ? val : undefined;
  },
});

const yearEnd = computed({
  get: () => localFilters.yearRange.end,
  set: (val) => {
    localFilters.yearRange.end =
      val !== undefined && val !== 0 ? val : undefined;
  },
});

// Rating helper - set to undefined when at 0
const ratingValue = computed({
  get: () => localFilters.minRating ?? 0,
  set: (val) => {
    localFilters.minRating = val > 0 ? val : undefined;
  },
});

const handleApply = () => {
  emit("apply", {
    genres: [...localFilters.genres],
    companies: [...localFilters.companies] as CompanyFilter[],
    yearRange: { ...localFilters.yearRange },
    minRating: localFilters.minRating,
    sortBy: localFilters.sortBy,
  });
  emit("close");
};

const handleClear = () => {
  localFilters.genres = [];
  localFilters.companies = [];
  localFilters.yearRange = {};
  localFilters.minRating = undefined;
  localFilters.sortBy = "popularity.desc";
  emit("clear");
};
</script>
