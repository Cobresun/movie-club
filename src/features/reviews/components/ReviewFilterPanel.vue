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

    <!-- Genre Multi-select -->
    <div v-if="availableGenres.length > 0">
      <label class="mb-2 block text-sm font-medium text-text">Genre</label>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="genre in availableGenres"
          :key="genre"
          type="button"
          class="rounded-full px-3 py-1 text-sm transition-colors"
          :class="
            localFilters.genres.includes(genre)
              ? 'bg-primary text-text'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          "
          @click="toggleGenre(genre)"
        >
          {{ genre }}
        </button>
      </div>
    </div>

    <!-- Company Multi-select -->
    <div v-if="availableCompanies.length > 0">
      <label class="mb-2 block text-sm font-medium text-text"
        >Production Company</label
      >
      <div class="flex flex-wrap gap-2">
        <button
          v-for="company in availableCompanies"
          :key="company"
          type="button"
          class="rounded-full px-3 py-1 text-sm transition-colors"
          :class="
            localFilters.companies.includes(company)
              ? 'bg-primary text-text'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          "
          @click="toggleCompany(company)"
        >
          {{ company }}
        </button>
      </div>
    </div>

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

    <!-- Reviewed In Year Dropdown -->
    <div v-if="availableReviewYears.length > 0">
      <label class="mb-2 block text-sm font-medium text-text"
        >Reviewed In Year</label
      >
      <select
        v-model.number="localFilters.reviewedInYear"
        class="w-full rounded-md border-2 border-gray-600 bg-gray-800 p-2 text-sm text-text outline-none focus:border-primary"
      >
        <option :value="undefined">Any year</option>
        <option v-for="year in availableReviewYears" :key="year" :value="year">
          {{ year }}
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

import { ReviewFilters } from "@/common/composables/useReviewFilters";

const props = defineProps<{
  filters: ReviewFilters;
  availableGenres: string[];
  availableCompanies: string[];
  availableReviewYears: number[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "apply", filters: ReviewFilters): void;
  (e: "clear"): void;
}>();

const currentYear = new Date().getFullYear();

// Local copy of filters for editing
const localFilters = reactive<ReviewFilters>({
  genres: [...props.filters.genres],
  companies: [...props.filters.companies],
  releaseYearRange: { ...props.filters.releaseYearRange },
  reviewedInYear: props.filters.reviewedInYear,
});

// Sync with props when they change
watch(
  () => props.filters,
  (newFilters) => {
    localFilters.genres = [...newFilters.genres];
    localFilters.companies = [...newFilters.companies];
    localFilters.releaseYearRange = { ...newFilters.releaseYearRange };
    localFilters.reviewedInYear = newFilters.reviewedInYear;
  },
  { deep: true },
);

// Year range helpers
const yearStart = computed({
  get: () => localFilters.releaseYearRange.start,
  set: (val) => {
    localFilters.releaseYearRange.start =
      val !== undefined && val !== 0 ? val : undefined;
  },
});

const yearEnd = computed({
  get: () => localFilters.releaseYearRange.end,
  set: (val) => {
    localFilters.releaseYearRange.end =
      val !== undefined && val !== 0 ? val : undefined;
  },
});

const toggleGenre = (genre: string) => {
  const index = localFilters.genres.indexOf(genre);
  if (index === -1) {
    localFilters.genres.push(genre);
  } else {
    localFilters.genres.splice(index, 1);
  }
};

const toggleCompany = (company: string) => {
  const index = localFilters.companies.indexOf(company);
  if (index === -1) {
    localFilters.companies.push(company);
  } else {
    localFilters.companies.splice(index, 1);
  }
};

const handleApply = () => {
  emit("apply", {
    genres: [...localFilters.genres],
    companies: [...localFilters.companies],
    releaseYearRange: { ...localFilters.releaseYearRange },
    reviewedInYear: localFilters.reviewedInYear,
  });
  emit("close");
};

const handleClear = () => {
  localFilters.genres = [];
  localFilters.companies = [];
  localFilters.releaseYearRange = {};
  localFilters.reviewedInYear = undefined;
  emit("clear");
};
</script>
