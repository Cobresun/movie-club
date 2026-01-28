<template>
  <div>
    <label class="mb-2 block text-sm font-medium text-text"
      >Production Company</label
    >

    <!-- Selected companies as chips -->
    <div v-if="selectedCompanies.length > 0" class="mb-2 flex flex-wrap gap-2">
      <span
        v-for="company in selectedCompanies"
        :key="company.id"
        class="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm text-text"
      >
        {{ company.name }}
        <button
          type="button"
          class="ml-1 rounded-full p-0.5 hover:bg-primary/70"
          @click="removeCompany(company.id)"
        >
          <mdicon name="close" size="14" />
        </button>
      </span>
    </div>

    <!-- Search input -->
    <div class="relative">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search companies..."
        class="w-full rounded-md border-2 border-gray-600 bg-gray-800 p-2 text-sm text-text outline-none focus:border-primary"
        @focus="showResults = true"
      />

      <!-- Search results dropdown -->
      <div
        v-if="showResults && searchQuery.trim().length >= 2"
        class="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-600 bg-gray-800 shadow-lg"
      >
        <div v-if="isLoading" class="p-3 text-center text-sm text-gray-400">
          Searching...
        </div>
        <div
          v-else-if="searchResults?.results.length === 0"
          class="p-3 text-center text-sm text-gray-400"
        >
          No companies found
        </div>
        <button
          v-for="company in filteredResults"
          v-else
          :key="company.id"
          type="button"
          class="w-full px-3 py-2 text-left text-sm text-text hover:bg-gray-700"
          @click="selectCompany(company)"
        >
          {{ company.name }}
          <span v-if="company.origin_country" class="text-gray-400">
            ({{ company.origin_country }})
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { TMDBCompanySearchResult } from "../../../lib/types/movie";
import { CompanyFilter } from "../composables/useMovieFilters";

import { useCompanySearch } from "@/service/useTMDB";

const selectedCompanies = defineModel<CompanyFilter[]>({ required: true });

const searchQuery = ref("");
const showResults = ref(false);

const { data: searchResults, isLoading } = useCompanySearch(searchQuery);

// Filter out already selected companies from results
const filteredResults = computed(() => {
  if (!searchResults.value?.results) return [];
  const selectedIds = new Set(selectedCompanies.value.map((c) => c.id));
  return searchResults.value.results.filter((c) => !selectedIds.has(c.id));
});

const selectCompany = (company: TMDBCompanySearchResult) => {
  selectedCompanies.value = [
    ...selectedCompanies.value,
    { id: company.id, name: company.name },
  ];
  searchQuery.value = "";
  showResults.value = false;
};

const removeCompany = (companyId: number) => {
  selectedCompanies.value = selectedCompanies.value.filter(
    (c) => c.id !== companyId,
  );
};

// Close dropdown when clicking outside
watch(showResults, (isShowing) => {
  if (isShowing) {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-company-search]")) {
        showResults.value = false;
        document.removeEventListener("click", handleClickOutside);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);
  }
});
</script>
