<template>
  <div class="flex flex-col gap-2">
    <!-- Search input and filter button row -->
    <div class="flex gap-2">
      <input
        :value="searchText"
        class="flex-1 rounded-md border-2 border-gray-300 p-1 text-base font-bold text-black outline-none focus:border-primary"
        placeholder="Search movies..."
        @input="
          emit('update:searchText', ($event.target as HTMLInputElement).value)
        "
      />
      <button
        type="button"
        class="relative flex items-center gap-1 rounded-md bg-gray-700 px-3 py-1 text-sm text-text hover:bg-gray-600"
        @click="emit('toggle-panel')"
      >
        <mdicon name="filter-variant" size="18" />
        <span class="hidden sm:inline">Filters</span>
        <span
          v-if="filterCount > 0"
          class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-text"
        >
          {{ filterCount }}
        </span>
      </button>
    </div>

    <!-- Active filter chips -->
    <div
      v-if="filterChips.length > 0"
      class="flex flex-wrap items-center gap-2"
    >
      <FilterChip
        v-for="chip in filterChips"
        :key="chip.key"
        :label="chip.label"
        :value="chip.value"
        @remove="emit('remove-filter', chip.key)"
      />
      <button
        type="button"
        class="text-sm text-gray-400 hover:text-text"
        @click="emit('clear-all')"
      >
        Clear all
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import FilterChip from "./FilterChip.vue";
import { FilterChipData } from "../composables/useMovieFilters";

defineProps<{
  searchText: string;
  filterCount: number;
  filterChips: FilterChipData[];
}>();

const emit = defineEmits<{
  (e: "update:searchText", value: string): void;
  (e: "toggle-panel"): void;
  (e: "remove-filter", key: string): void;
  (e: "clear-all"): void;
}>();
</script>
