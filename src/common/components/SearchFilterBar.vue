<template>
  <div class="flex flex-col items-center justify-center" :class="className">
    <!-- Search + Filters Row -->
    <div class="flex w-full items-center justify-center gap-2">
      <!-- Filter toggle and inline panel -->
      <div class="relative order-1 flex items-center gap-2">
        <v-btn
          class="flex h-11 items-center justify-center whitespace-nowrap"
          title="Filters"
          @click="toggleFilterMode"
        >
          <mdicon :name="filterMode ? 'filter-check' : 'filter-variant'" />
        </v-btn>

        <!-- Filters label / dropdown -->
        <div v-if="filterMode" class="relative">
          <div
            class="flex cursor-pointer items-center gap-2 rounded-full border border-white px-3 py-1 text-sm"
            @click="showFilterOptions = !showFilterOptions"
          >
            <span class="font-semibold">Filters</span>
            <mdicon :name="showFilterOptions ? 'chevron-up' : 'chevron-down'" />
          </div>
          <!-- Options popover -->
          <div
            v-if="showFilterOptions"
            class="absolute z-20 mt-2 w-64 rounded-md border border-white bg-background p-2 shadow-xl"
          >
            <input
              v-model="filterOptionSearch"
              type="text"
              placeholder="Search filters"
              class="mb-2 w-full rounded-md border-2 border-slate-600 bg-lowBackground p-2 text-sm text-white outline-none focus:border-primary"
            />
            <div class="max-h-56 overflow-y-auto">
              <div
                v-for="opt in visibleFilterOptions"
                :key="opt.key"
                class="cursor-pointer rounded-md px-2 py-1 text-sm hover:bg-lowBackground"
                @click="selectFilterOption(opt.key)"
              >
                {{ opt.label }}
              </div>
            </div>
          </div>
        </div>
      </div>

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

    <!-- Applied filter pills -->
    <div
      v-if="appliedFilters.length > 0"
      class="mt-2 flex flex-wrap justify-center gap-2"
    >
      <div
        v-for="(pill, idx) in appliedFilters"
        :key="pill.key + idx + pill.value"
        class="flex items-center gap-2 rounded-full border border-white px-3 py-1 text-sm"
      >
        <span class="opacity-80">{{ pill.label }}:</span>
        <span v-if="pill.operator" class="opacity-80">{{ pill.operator }}</span>
        <span class="font-semibold">{{ pill.value }}</span>
        <button
          class="ml-1 rounded-full hover:bg-lowBackground"
          title="Edit"
          @click="editPill(idx)"
        >
          <mdicon name="pencil" />
        </button>
        <button
          class="rounded-full hover:bg-lowBackground"
          title="Remove"
          @click="removePill(idx)"
        >
          <mdicon name="close" />
        </button>
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
import VBtn from "./VBtn.vue";

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
    key: "title",
    label: "Title",
    type: "string" as const,
    placeholder: "Search by title",
  },
  {
    key: "description",
    label: "Description",
    type: "string" as const,
    placeholder: "Search description",
  },
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
  {
    key: "budget",
    label: "Budget",
    type: "number" as const,
    placeholder: "Enter amount",
  },
  {
    key: "revenue",
    label: "Revenue",
    type: "number" as const,
    placeholder: "Enter amount",
  },
  {
    key: "popularity",
    label: "Popularity",
    type: "number" as const,
    placeholder: "Enter value",
  },
  {
    key: "production_country",
    label: "Production Country",
    type: "enum" as const,
    placeholder: "Select a country",
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

const countryCounts = computed(() => {
  const counts = new Map<string, number>();
  props.data.forEach((item) =>
    item.externalData?.production_countries?.forEach((c) => {
      const currentCount = counts.get(c);
      counts.set(c, currentCount !== undefined ? currentCount + 1 : 1);
    }),
  );
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]); // Sort by frequency (descending)
});

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
  production_country: countryCounts.value.map(
    ([country, count]) => `${country} (${count})`,
  ),
  company: companyCounts.value.map(
    ([company, count]) => `${company} (${count})`,
  ),
}));

// Search and Filters state
const searchTerm = ref("");
const filterMode = ref(false);
const showFilterOptions = ref(false);
const filterOptionSearch = ref("");

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

const visibleFilterOptions = computed(() => {
  const q = filterOptionSearch.value.trim().toLowerCase();
  if (!q) return FILTER_OPTIONS;
  return FILTER_OPTIONS.filter(
    (o) => o.label.toLowerCase().includes(q) || o.key.toLowerCase().includes(q),
  );
});

const comparatorSymbol = computed(() => comparator.value);
const cycleComparator = () => {
  comparator.value =
    comparator.value === ">" ? "<" : comparator.value === "<" ? "=" : ">";
};

const toggleFilterMode = () => {
  filterMode.value = !filterMode.value;
  if (filterMode.value) {
    // Default to first option when activated
    if (selectedFilterKey.value === null && FILTER_OPTIONS.length > 0) {
      selectedFilterKey.value = FILTER_OPTIONS[0].key;
    }
  } else {
    showFilterOptions.value = false;
  }
};

const selectFilterOption = (key: string) => {
  selectedFilterKey.value = key;
  filterValueInput.value = "";
  comparator.value = ">" as Comparator;
  showFilterOptions.value = false;
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
    const value = f.value;
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
};

const exitFilterEntryMode = () => {
  // Return to default search entry while keeping filter pills applied
  filterMode.value = false;
  showFilterOptions.value = false;
  selectedFilterKey.value = null;
  // focus back to search
  requestAnimationFrame(() => searchInput.value?.focus());
};

const removePill = (idx: number) => {
  appliedFilters.value.splice(idx, 1);
};

const editPill = (idx: number) => {
  const pill = appliedFilters.value[idx];
  // Pull back into editor
  selectedFilterKey.value = pill.key;
  comparator.value = pill.operator ?? ">";
  filterValueInput.value = pill.value;
  filterMode.value = true;
  // Remove and focus input for editing
  appliedFilters.value.splice(idx, 1);
  requestAnimationFrame(() => searchInput.value?.focus());
};

const mdicon = resolveComponent("mdicon");

const handleClickOutside = (event: MouseEvent) => {
  const container = searchInput.value;
  if (container)
    if (!container.contains(event.target as Node)) {
      disableValueSuggestions.value = true;
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
