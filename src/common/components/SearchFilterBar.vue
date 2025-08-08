<template>
  <div
    ref="componentContainer"
    class="flex flex-col items-center justify-center"
    :class="className"
  >
    <!-- Search + Filters Row -->
    <div class="flex w-full items-center justify-center gap-2">
      <!-- Filter toggle removed: pills are shown below the search input -->

      <!-- Main search/value input -->
      <div class="relative order-2 w-[min(720px,90%)]">
        <mdicon
          name="magnify"
          class="absolute left-3 top-1/2 -translate-y-1/2 transform text-slate-200"
        />

        <!-- Operator toggle when numeric/date -->
        <div
          v-if="
            filterMode &&
            selectedFilter &&
            (selectedFilter.type === 'number' || selectedFilter.type === 'date')
          "
          class="absolute right-20 top-1/2 -translate-y-1/2 transform"
        >
          <button
            class="rounded-md border border-slate-600 bg-lowBackground/60 px-2 py-0.5 text-xs hover:bg-lowBackground"
            :aria-label="'Comparator: ' + comparatorSymbol"
            :title="'Comparator: ' + comparatorSymbol"
            @click="cycleComparator"
          >
            {{ comparatorSymbol }}
          </button>
        </div>

        <!-- Date picker if date -->
        <input
          v-if="filterMode && selectedFilter?.type === 'date'"
          ref="searchInput"
          v-model="filterValueInput"
          type="date"
          class="w-full rounded-md border-2 border-slate-600 bg-background p-2 pl-10 text-base text-white outline-none focus:border-primary"
          placeholder="Search"
          @keydown.enter.prevent="applyActiveFilter"
        />

        <!-- Text/number input -->
        <input
          v-else
          ref="searchInput"
          v-model="activeInput"
          :type="
            filterMode && selectedFilter?.type === 'number' ? 'number' : 'text'
          "
          :class="
            filterMode && selectedFilter
              ? 'w-full rounded-md border-2 border-slate-600 bg-background p-2 pl-10 pr-8 text-base text-white outline-none focus:border-primary'
              : 'w-full rounded-md border-2 border-slate-600 bg-background p-2 pl-10 text-base text-white outline-none focus:border-primary'
          "
          :placeholder="
            filterMode && selectedFilter
              ? selectedFilter.placeholder
              : searchPlaceholder
          "
          @keydown.enter.prevent="onEnter"
        />

        <!-- Apply filter button (only show when in filter mode) -->
        <button
          v-if="filterMode && selectedFilter"
          class="absolute right-2 top-1/2 -translate-y-1/2 transform rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary/80 disabled:opacity-50"
          :disabled="!filterValueInput || filterValueInput.length === 0"
          title="Apply filter"
          @click="applyActiveFilter"
        >
          Apply
        </button>

        <!-- Suggestions dropdown for enumerable fields -->
        <div
          v-if="showValueSuggestions && filteredValueSuggestions.length > 0"
          class="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-md border border-white bg-background p-1 shadow-xl"
        >
          <div
            v-for="s in filteredValueSuggestions"
            :key="s"
            class="cursor-pointer rounded-md px-2 py-1 text-sm hover:bg-lowBackground"
            @click="selectValueSuggestion(s)"
          >
            {{ s }}
          </div>
        </div>
      </div>

      <!-- Action button slot -->
      <div class="order-3 ml-1">
        <slot name="action-button" />
      </div>
    </div>

    <!-- Available filter options as pills -->
    <div class="mt-2 flex flex-wrap justify-center gap-2">
      <div
        v-for="opt in FILTER_OPTIONS"
        :key="opt.key"
        :class="[
          'cursor-pointer rounded-full border px-3 py-1 text-sm hover:bg-lowBackground',
          isFilterApplied(opt.key)
            ? 'border-primary bg-primary/20 text-white'
            : 'border-white opacity-80',
        ]"
        @click="selectFilterOption(opt.key)"
      >
        <span>{{ opt.label }}</span>
        <span v-if="isFilterApplied(opt.key)" class="ml-1 opacity-80">
          {{ getAppliedFilterDisplay(opt.key) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  watch,
  resolveComponent,
  onMounted,
  onUnmounted,
} from "vue";

import { DetailedReviewListItem } from "../../../lib/types/lists";
import { filterMovies } from "../searchMovies";

// Component props
interface Props {
  data: DetailedReviewListItem[];
  searchPlaceholder?: string;
  className?: string;
}

const props = withDefaults(defineProps<Props>(), {
  searchPlaceholder: "Search",
  className: "mb-4",
});

// Component events
interface Emits {
  (e: "update:searchQuery", value: string): void;
  (e: "update:filteredData", value: DetailedReviewListItem[]): void;
}

const emit = defineEmits<Emits>();

// Filter options configuration
const FILTER_OPTIONS = [
  {
    key: "genre",
    label: "Genre",
    type: "enum" as const,
    placeholder: "Select a genre",
  },
  {
    key: "average_score",
    label: "Average Score",
    type: "number" as const,
    placeholder: "Enter score",
  },
  {
    key: "company",
    label: "Production Company",
    type: "enum" as const,
    placeholder: "Select a company",
  },
  {
    key: "review_date",
    label: "Review Date",
    type: "date" as const,
    placeholder: "Enter a year",
  },
  {
    key: "release_date",
    label: "Release Date",
    type: "date" as const,
    placeholder: "Enter a year",
  },
  {
    key: "runtime",
    label: "Runtime (min)",
    type: "number" as const,
    placeholder: "Enter minutes",
  },
  {
    key: "original_language",
    label: "Original Language",
    type: "enum" as const,
    placeholder: "Select a language code",
  },
];

type FilterOption = (typeof FILTER_OPTIONS)[number];

// Value suggestions derived from current data with frequency counts
const genreCounts = computed(() => {
  const counts = new Map<string, number>();
  props.data.forEach((item) =>
    item.externalData?.genres?.forEach((g) => {
      const currentCount = counts.get(g);
      counts.set(g, currentCount !== undefined ? currentCount + 1 : 1);
    }),
  );
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]); // Sort by frequency (descending)
});

const languageCounts = computed(() => {
  const counts = new Map<string, number>();
  props.data.forEach((item) => {
    const code = item.externalData?.original_language;
    if (code !== null && code !== undefined && code.trim().length > 0) {
      const currentCount = counts.get(code);
      counts.set(code, currentCount !== undefined ? currentCount + 1 : 1);
    }
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]); // Sort by frequency (descending)
});

// removed production country suggestions since the filter was removed

const companyCounts = computed(() => {
  const counts = new Map<string, number>();
  props.data.forEach((item) =>
    item.externalData?.production_companies?.forEach((c) => {
      const currentCount = counts.get(c);
      counts.set(c, currentCount !== undefined ? currentCount + 1 : 1);
    }),
  );
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]); // Sort by frequency (descending)
});

const computedValueSuggestions = computed(() => ({
  genre: genreCounts.value.map(([genre, count]) => `${genre} (${count})`),
  original_language: languageCounts.value.map(
    ([language, count]) => `${language} (${count})`,
  ),
  company: companyCounts.value.map(
    ([company, count]) => `${company} (${count})`,
  ),
}));

// Search and Filters state
const searchTerm = ref("");
const filterMode = ref(false);

// Applied filters pills
type Comparator = ">" | "=" | "<";
interface AppliedFilter {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "enum";
  operator?: Comparator;
  value: string;
}
const appliedFilters = ref<AppliedFilter[]>([]);

// Selected filter to input value
const selectedFilterKey = ref<string | null>(null);
const filterValueInput = ref("");
const comparator = ref<Comparator>(">");

const selectedFilter = computed<FilterOption | null>(() => {
  if (selectedFilterKey.value === null) return null;
  return FILTER_OPTIONS.find((f) => f.key === selectedFilterKey.value) ?? null;
});

// Helper functions for pill display
const isFilterApplied = (key: string) => {
  return appliedFilters.value.some((p) => p.key === key);
};

const getAppliedFilterDisplay = (key: string) => {
  const filter = appliedFilters.value.find((p) => p.key === key);
  if (!filter) return "";
  const operator = filter.operator ? filter.operator : "";
  return `${operator}${filter.value}`;
};

const comparatorSymbol = computed(() => comparator.value);
const cycleComparator = () => {
  comparator.value =
    comparator.value === ">" ? "<" : comparator.value === "<" ? "=" : ">";
};

const selectFilterOption = (key: string) => {
  // If filter is already applied, remove it
  const existingIdx = appliedFilters.value.findIndex((p) => p.key === key);
  if (existingIdx >= 0) {
    appliedFilters.value.splice(existingIdx, 1);
  } else {
    // Enter edit mode for this filter
    selectedFilterKey.value = key;
    filterValueInput.value = "";
    comparator.value = ">" as Comparator;
    filterMode.value = true;
    // Focus main input for value entry
    requestAnimationFrame(() => searchInput.value?.focus());
    setTimeout(() => {
      disableValueSuggestions.value = false;
      if (selectedFilter.value?.type === "date") {
        const input = document.querySelector("input[type='date']");
        if (input) {
          (input as HTMLInputElement).showPicker?.();
        }
      }
    }, 10);
  }
};

const disableValueSuggestions = ref(false);
const showValueSuggestions = computed(() => {
  const f = selectedFilter.value;
  if (!filterMode.value || !f) return false;
  return f.type === "enum" && !disableValueSuggestions.value;
});

const valueSuggestions = computed(() => {
  const key = selectedFilter.value?.key;
  if (key === null || key === undefined || key.trim().length === 0) return [];
  const suggestions =
    computedValueSuggestions.value[
      key as keyof typeof computedValueSuggestions.value
    ];
  return suggestions ?? [];
});

const filteredValueSuggestions = computed(() => {
  const q = filterValueInput.value.trim().toLowerCase();
  const list = valueSuggestions.value;
  if (!q) return list.slice(0, 20);
  return list.filter((v) => v.toLowerCase().includes(q)).slice(0, 20);
});

const selectValueSuggestion = (s: string) => {
  // Extract the value part (remove frequency in brackets)
  const value = s.replace(/ \(\d+\)$/, "");
  filterValueInput.value = value;
  applyActiveFilter();
  // After selecting an enum value, return to default search mode
  exitFilterEntryMode();
};

// Compose search query from pills + free text
const composedSearchQuery = computed(() => {
  const tokens = appliedFilters.value.map((f) => {
    // Quote values that contain spaces
    const value = f.value.includes(" ") ? `"${f.value}"` : f.value;
    const op = f.operator ? f.operator : "";
    return `${f.key}:${op}${value}`;
  });
  const free = searchTerm.value.trim();
  const hasTokens = tokens.length > 0;
  const hasFreeText = free.length > 0;
  return `${tokens.join(" ")}${hasTokens && hasFreeText ? " " : ""}${free}`.trim();
});

// Apply filtering internally and emit results
const filteredData = computed(() => {
  return filterMovies(props.data, composedSearchQuery.value);
});

// Watch for changes and emit to parent
watch(composedSearchQuery, (newQuery) => {
  emit("update:searchQuery", newQuery);
});

watch(
  filteredData,
  (newData) => {
    emit("update:filteredData", newData);
  },
  { immediate: true },
);

// Also emit initial filtered data when data prop changes
watch(
  () => props.data,
  () => {
    emit("update:filteredData", filteredData.value);
  },
  { immediate: true },
);

const componentContainer = ref<HTMLElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);

// Input binding when in filter mode versus free search
const activeInput = computed({
  get() {
    return filterMode.value && selectedFilter.value
      ? filterValueInput.value
      : searchTerm.value;
  },
  set(v: string) {
    if (filterMode.value && selectedFilter.value) {
      filterValueInput.value = v;
    } else {
      searchTerm.value = v;
    }
  },
});

const onEnter = () => {
  if (filterMode.value && selectedFilter.value) {
    applyActiveFilter();
    exitFilterEntryMode();
  }
};

const applyActiveFilter = () => {
  const f = selectedFilter.value;
  const v = filterValueInput.value;
  if (!f || v.length === 0) return;

  const newPill: AppliedFilter = {
    key: f.key,
    label: f.label,
    type: f.type,
    operator:
      f.type === "number" || f.type === "date" ? comparator.value : undefined,
    value: v,
  };

  // Replace existing pill with same key, otherwise add
  const existingIdx = appliedFilters.value.findIndex(
    (p) => p.key === newPill.key,
  );
  if (existingIdx >= 0) {
    appliedFilters.value.splice(existingIdx, 1, newPill);
  } else {
    appliedFilters.value.push(newPill);
  }

  // Clear value for next entry
  filterValueInput.value = "";
  if (f.type === "number" || f.type === "date") comparator.value = ">";
  // Return to search mode after applying filter
  exitFilterEntryMode();
};

const exitFilterEntryMode = () => {
  // Return to default search entry while keeping filter pills applied
  filterMode.value = false;
  selectedFilterKey.value = null;
  // focus back to search
  requestAnimationFrame(() => searchInput.value?.focus());
};

const mdicon = resolveComponent("mdicon");

const handleClickOutside = (event: MouseEvent) => {
  const container = componentContainer.value;
  const target = event.target as Node;

  if (container && !container.contains(target)) {
    disableValueSuggestions.value = true;
    // If we're in filter mode and clicked outside, exit filter mode
    if (filterMode.value) {
      exitFilterEntryMode();
    }
  } else {
    disableValueSuggestions.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>
