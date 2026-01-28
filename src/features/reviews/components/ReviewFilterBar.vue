<template>
  <div class="flex flex-col gap-2">
    <!-- Search input and filter button row -->
    <div class="flex items-center justify-center gap-2">
      <div class="relative">
        <mdicon
          name="magnify"
          class="absolute left-3 top-1/2 -translate-y-1/2 transform text-slate-200"
        />
        <input
          ref="searchInput"
          :value="searchText"
          class="w-full rounded-md border-2 border-slate-600 bg-background p-2 pl-10 pr-10 text-base text-white outline-none focus:border-primary"
          placeholder="Search by title..."
          @input="
            emit('update:searchText', ($event.target as HTMLInputElement).value)
          "
          @focusin="searchInputFocusIn"
          @focusout="searchInputFocusOut"
        />
        <div
          ref="searchInputSlash"
          class="absolute right-3 top-1/2 -translate-y-1/2 transform rounded-md border-2 border-slate-600 px-2 py-1"
        >
          <p class="text-xs text-slate-200">/</p>
        </div>
      </div>
      <button
        type="button"
        class="relative flex h-11 w-11 items-center justify-center rounded-md bg-gray-700 text-text hover:bg-gray-600"
        @click="emit('toggle-panel')"
      >
        <mdicon name="filter-variant" size="20" />
        <span
          v-if="filterCount > 0"
          class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-text"
        >
          {{ filterCount }}
        </span>
      </button>
      <slot name="actions" />
    </div>

    <!-- Active filter chips -->
    <div
      v-if="filterChips.length > 0"
      class="flex flex-wrap items-center justify-center gap-2"
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
import { ref } from "vue";

import FilterChip from "@/common/components/FilterChip.vue";
import {
  ReviewFilterChipData,
  ReviewFilters,
} from "@/common/composables/useReviewFilters";

defineProps<{
  searchText: string;
  filterCount: number;
  filterChips: ReviewFilterChipData[];
}>();

const emit = defineEmits<{
  (e: "update:searchText", value: string): void;
  (e: "toggle-panel"): void;
  (e: "remove-filter", key: keyof ReviewFilters): void;
  (e: "clear-all"): void;
}>();

const searchInput = ref<HTMLInputElement | null>(null);
const searchInputSlash = ref<HTMLElement | null>(null);

const searchInputFocusIn = () => {
  searchInputSlash.value?.setAttribute("hidden", "true");
};

const searchInputFocusOut = () => {
  searchInputSlash.value?.removeAttribute("hidden");
};

defineExpose({
  focus: () => searchInput.value?.focus(),
});
</script>
