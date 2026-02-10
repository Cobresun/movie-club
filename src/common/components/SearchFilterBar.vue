<template>
  <div
    ref="componentContainer"
    class="flex flex-col items-center justify-center"
    :class="className"
  >
    <!-- Search + Filters Row -->
    <div class="flex w-full items-center justify-center gap-2">
      <!-- Main search input (free text only) -->
      <div class="relative order-2 w-[min(720px,90%)]">
        <mdicon
          name="magnify"
          class="absolute left-3 top-1/2 -translate-y-1/2 transform text-slate-200"
        />

        <input
          ref="searchInput"
          v-model="searchTerm"
          type="text"
          class="w-full rounded-md border-2 border-slate-600 bg-background p-2 pl-10 text-base text-white outline-none focus:border-primary"
          :placeholder="searchPlaceholder"
        />
      </div>

      <!-- Action button slot -->
      <div class="order-3 ml-1">
        <slot name="action-button" />
      </div>
    </div>

    <!-- Available filter options as pills -->
    <div
      class="scrollbar-hide relative mt-2 flex w-full flex-nowrap gap-2 overflow-x-auto md:flex-wrap md:justify-center"
    >
      <div
        v-for="opt in FILTER_OPTIONS"
        :key="opt.key"
        :ref="(el) => setPillRef(el as HTMLElement, opt.key)"
        :data-pill-key="opt.key"
        :class="[
          'relative shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 py-1 text-sm hover:bg-lowBackground',
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

    <!-- Popover for filter input (teleported to avoid overflow clipping) -->
    <Teleport to="body">
      <div
        v-if="selectedPillKey && selectedFilter && popoverPosition"
        ref="popoverRef"
        :style="{
          position: 'fixed',
          left: `${popoverPosition.left}px`,
          top: `${popoverPosition.top}px`,
          zIndex: 9999,
        }"
        class="min-w-[280px] rounded-lg border border-slate-600 bg-background p-4 shadow-2xl"
        @click.stop
      >
        <div class="flex flex-col gap-3">
          <!-- Date picker -->
          <div
            v-if="selectedFilter.type === 'date'"
            class="flex flex-col gap-2"
          >
            <label class="text-xs text-slate-400">{{
              selectedFilter.label
            }}</label>
            <input
              ref="popoverInput"
              v-model="filterValueInput"
              type="date"
              class="rounded-md border border-slate-600 bg-lowBackground p-2 text-sm text-white outline-none focus:border-primary"
            />
          </div>

          <!-- Number input -->
          <div
            v-else-if="selectedFilter.type === 'number'"
            class="flex flex-col gap-2"
          >
            <label class="text-xs text-slate-400">{{
              selectedFilter.label
            }}</label>
            <input
              ref="popoverInput"
              v-model="filterValueInput"
              type="number"
              class="rounded-md border border-slate-600 bg-lowBackground p-2 text-sm text-white outline-none focus:border-primary"
              :placeholder="selectedFilter.placeholder"
            />
          </div>

          <!-- Enum with suggestions -->
          <div
            v-else-if="selectedFilter.type === 'enum'"
            class="flex flex-col gap-2"
          >
            <label class="text-xs text-slate-400">{{
              selectedFilter.label
            }}</label>
            <input
              ref="popoverInput"
              v-model="filterValueInput"
              type="text"
              class="rounded-md border border-slate-600 bg-lowBackground p-2 text-sm text-white outline-none focus:border-primary"
              :placeholder="selectedFilter.placeholder"
            />
            <!-- Suggestions list -->
            <div
              v-if="filteredValueSuggestions.length > 0"
              class="max-h-48 overflow-y-auto rounded-md border border-slate-700 bg-lowBackground"
            >
              <div
                v-for="s in filteredValueSuggestions"
                :key="s"
                class="cursor-pointer px-3 py-2 text-sm hover:bg-background"
                @click="selectValueSuggestion(s)"
              >
                {{ s }}
              </div>
            </div>
          </div>

          <!-- Comparator buttons for number/date -->
          <div
            v-if="
              selectedFilter.type === 'number' || selectedFilter.type === 'date'
            "
            class="flex gap-1"
          >
            <button
              v-for="op in ['>', '=', '<']"
              :key="op"
              :class="[
                'flex-1 rounded-md border px-3 py-1 text-sm transition-colors',
                comparator === op
                  ? 'border-primary bg-primary/20 text-white'
                  : 'border-slate-600 bg-lowBackground/60 text-slate-400 hover:border-slate-500 hover:text-white',
              ]"
              @click="comparator = op as Comparator"
            >
              {{ op }}
            </button>
          </div>

          <!-- Action buttons -->
          <div class="flex gap-2">
            <button
              class="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/80 disabled:opacity-50"
              :disabled="
                !filterValueInput ||
                String(filterValueInput).trim().length === 0
              "
              @click="applyActiveFilter"
            >
              Apply
            </button>
            <button
              class="rounded-md border border-slate-600 bg-lowBackground/60 px-3 py-2 text-sm text-slate-400 hover:bg-lowBackground hover:text-white"
              @click="closePopover"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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
  company: companyCounts.value.map(
    ([company, count]) => `${company} (${count})`,
  ),
}));

// Search and Filters state
const searchTerm = ref("");

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

// Popover state for filter input
const selectedPillKey = ref<string | null>(null);
const filterValueInput = ref("");
const comparator = ref<Comparator>(">");

const selectedFilter = computed<FilterOption | null>(() => {
  if (selectedPillKey.value === null) return null;
  return FILTER_OPTIONS.find((f) => f.key === selectedPillKey.value) ?? null;
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

const selectFilterOption = (key: string) => {
  // If filter is already applied, remove it
  const existingIdx = appliedFilters.value.findIndex((p) => p.key === key);
  if (existingIdx >= 0) {
    appliedFilters.value.splice(existingIdx, 1);
    selectedPillKey.value = null;
    popoverPosition.value = null;
  } else {
    // Open popover for this filter
    selectedPillKey.value = key;
    filterValueInput.value = "";
    comparator.value = ">";

    // Calculate and set popover position
    popoverPosition.value = calculatePopoverPosition(key);

    // Focus input in popover
    requestAnimationFrame(() => {
      const input = popoverInput.value;
      if (!input) return;

      const inputElement: HTMLInputElement | undefined = Array.isArray(input)
        ? (input[0] ?? undefined)
        : input;
      if (inputElement === undefined) return;

      inputElement.focus();
      // Auto-open date picker
      if (
        selectedFilter.value?.type === "date" &&
        typeof inputElement.showPicker === "function"
      ) {
        setTimeout(() => {
          inputElement.showPicker();
        }, 100);
      }
    });
  }
};

const valueSuggestions = computed(() => {
  const key = selectedFilter.value?.key;
  if (key === null || key === undefined) return [];
  if (key.trim().length === 0) return [];
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
};

// Compose search query from pills + free text
const composedSearchQuery = computed(() => {
  const tokens = appliedFilters.value.map((f) => {
    // Convert value to string and quote if it contains spaces
    const valueStr = String(f.value);
    const value = valueStr.includes(" ") ? `"${valueStr}"` : valueStr;
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
const popoverInput = ref<HTMLInputElement | HTMLInputElement[] | null>(null);
const popoverRef = ref<HTMLElement | null>(null);
const pillRefs = new Map<string, HTMLElement>();

const setPillRef = (el: HTMLElement | null, key: string) => {
  if (el) {
    pillRefs.set(key, el);
  } else {
    pillRefs.delete(key);
  }
};

interface PopoverPosition {
  left: number;
  top: number;
}
const popoverPosition = ref<PopoverPosition | null>(null);

const calculatePopoverPosition = (key: string) => {
  const pillElement = pillRefs.get(key);
  if (!pillElement) return null;

  const rect = pillElement.getBoundingClientRect();
  const popoverWidth = 280; // min-w-[280px]

  // Position below the pill
  let left = rect.left;
  let top = rect.bottom + 8; // 8px gap (mt-2)

  // Ensure popover doesn't go off-screen to the right
  if (left + popoverWidth > window.innerWidth) {
    left = window.innerWidth - popoverWidth - 16; // 16px margin
  }

  // Ensure popover doesn't go off-screen to the left
  if (left < 16) {
    left = 16;
  }

  // Check if there's enough space below, otherwise position above
  const popoverEstimatedHeight = 250;
  if (top + popoverEstimatedHeight > window.innerHeight) {
    top = rect.top - popoverEstimatedHeight - 8;
  }

  return { left, top };
};

const applyActiveFilter = () => {
  const f = selectedFilter.value;
  const v = filterValueInput.value;
  // Convert to string and check if empty
  const valueStr = String(v).trim();
  if (!f || valueStr.length === 0) return;

  const newPill: AppliedFilter = {
    key: f.key,
    label: f.label,
    type: f.type,
    operator:
      f.type === "number" || f.type === "date" ? comparator.value : undefined,
    value: valueStr,
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

  // Close popover
  closePopover();
};

const closePopover = () => {
  selectedPillKey.value = null;
  filterValueInput.value = "";
  comparator.value = ">";
  popoverPosition.value = null;
};

const mdicon = resolveComponent("mdicon");

const handleClickOutside = (event: MouseEvent) => {
  const container = componentContainer.value;
  const popover = popoverRef.value;
  const target = event.target as Node;

  // Check if click is outside both the main container and the popover
  if (
    container &&
    !container.contains(target) &&
    popover &&
    !popover.contains(target)
  ) {
    // Close popover when clicking outside
    if (selectedPillKey.value !== null) {
      closePopover();
    }
  }
};

const updatePopoverPosition = () => {
  if (selectedPillKey.value !== null) {
    popoverPosition.value = calculatePopoverPosition(selectedPillKey.value);
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
  window.addEventListener("scroll", updatePopoverPosition, true);
  window.addEventListener("resize", updatePopoverPosition);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  window.removeEventListener("scroll", updatePopoverPosition, true);
  window.removeEventListener("resize", updatePopoverPosition);
});
</script>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
.scrollbar-hide::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}
</style>
