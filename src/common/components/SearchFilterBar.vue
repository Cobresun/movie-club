<template>
  <div class="flex flex-col items-center justify-center" :class="className">
    <!-- Search + Filters Row -->
    <div class="flex w-full items-center justify-center gap-2">
      <!-- Main search input (free text only) -->
      <div class="relative order-2 w-[min(720px,90%)]">
        <mdicon
          name="magnify"
          class="absolute left-3 top-1/2 -translate-y-1/2 transform text-slate-200"
        />

        <input
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
    <PopoverGroup
      as="div"
      class="scrollbar-hide relative mt-2 flex w-full flex-nowrap gap-2 overflow-x-auto md:flex-wrap md:justify-center"
    >
      <template v-for="opt in FILTER_OPTIONS" :key="opt.key">
        <button
          v-if="isFilterApplied(opt.key)"
          type="button"
          :class="[
            'relative shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 py-1 text-sm hover:bg-lowBackground',
            'border-primary bg-primary/20 text-white',
          ]"
          @click="removeAppliedFilter(opt.key)"
        >
          <span>{{ opt.label }}</span>
          <span v-if="isFilterApplied(opt.key)" class="ml-1 opacity-80">
            {{ getAppliedFilterDisplay(opt.key) }}
          </span>
        </button>

        <Popover v-else v-slot="{ close }" class="relative shrink-0">
          <PopoverButton
            :class="[
              'relative shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 py-1 text-sm hover:bg-lowBackground',
              'border-white opacity-80',
            ]"
            @click="prepareFilterPopover(opt, $event)"
          >
            <span>{{ opt.label }}</span>
          </PopoverButton>

          <!-- Body teleport + fixed: escapes ancestor stacking contexts and overflow so
               the panel stays above the reviews table (sticky headers, etc.). -->
          <Teleport to="body">
            <PopoverPanel
              :focus="true"
              class="fixed min-w-[280px] rounded-lg border border-slate-600 bg-background p-4 shadow-2xl"
              :style="teleportedPanelStyle"
            >
              <div class="flex flex-col gap-3">
                <!-- Date picker -->
                <div v-if="opt.type === 'date'" class="flex flex-col gap-2">
                  <label class="text-xs text-slate-400">{{ opt.label }}</label>
                  <input
                    :ref="bindPopoverInput"
                    v-model="filterValueInput"
                    type="date"
                    class="rounded-md border border-slate-600 bg-lowBackground p-2 text-sm text-white outline-none focus:border-primary"
                  />
                </div>

                <!-- Number input -->
                <div
                  v-else-if="opt.type === 'number'"
                  class="flex flex-col gap-2"
                >
                  <label class="text-xs text-slate-400">{{ opt.label }}</label>
                  <input
                    :ref="bindPopoverInput"
                    v-model="filterValueInput"
                    type="number"
                    class="rounded-md border border-slate-600 bg-lowBackground p-2 text-sm text-white outline-none focus:border-primary"
                    :placeholder="opt.placeholder"
                  />
                </div>

                <!-- Enum with suggestions -->
                <div
                  v-else-if="opt.type === 'enum'"
                  class="flex flex-col gap-2"
                >
                  <label class="text-xs text-slate-400">{{ opt.label }}</label>
                  <input
                    :ref="bindPopoverInput"
                    v-model="filterValueInput"
                    type="text"
                    class="rounded-md border border-slate-600 bg-lowBackground p-2 text-sm text-white outline-none focus:border-primary"
                    :placeholder="opt.placeholder"
                  />
                  <!-- Suggestions list -->
                  <div
                    v-if="getFilteredValueSuggestions(opt.key).length > 0"
                    class="max-h-48 overflow-y-auto rounded-md border border-slate-700 bg-lowBackground"
                  >
                    <div
                      v-for="s in getFilteredValueSuggestions(opt.key)"
                      :key="s"
                      class="cursor-pointer px-3 py-2 text-sm hover:bg-background"
                      @click="selectValueSuggestion(s, opt, close)"
                    >
                      {{ s }}
                    </div>
                  </div>
                </div>

                <!-- Comparator buttons for number/date -->
                <div
                  v-if="opt.type === 'number' || opt.type === 'date'"
                  class="flex gap-1"
                >
                  <button
                    v-for="op in ['>', '=', '<']"
                    :key="op"
                    type="button"
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
                    type="button"
                    class="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/80 disabled:opacity-50"
                    :disabled="
                      !filterValueInput ||
                      String(filterValueInput).trim().length === 0
                    "
                    @click="applyActiveFilter(opt, close)"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    class="rounded-md border border-slate-600 bg-lowBackground/60 px-3 py-2 text-sm text-slate-400 hover:bg-lowBackground hover:text-white"
                    @click="closeFilterPopover(close)"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </PopoverPanel>
          </Teleport>
        </Popover>
      </template>
    </PopoverGroup>
  </div>
</template>

<script setup lang="ts">
import {
  Popover,
  PopoverButton,
  PopoverGroup,
  PopoverPanel,
} from "@headlessui/vue";
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watchEffect,
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

const filteredData = defineModel<DetailedReviewListItem[]>("filteredData", {
  required: true,
});
const hasActiveFilters = defineModel<boolean>("hasActiveFilters", {
  required: true,
});

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
    key: "director",
    label: "Director",
    type: "enum" as const,
    placeholder: "Select a director",
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

const directorCounts = computed(() => {
  const counts = new Map<string, number>();
  props.data.forEach((item) =>
    item.externalData?.directors?.forEach((d) => {
      const name = d.name;
      const currentCount = counts.get(name);
      counts.set(name, currentCount !== undefined ? currentCount + 1 : 1);
    }),
  );
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]); // Sort by frequency (descending)
});

const computedValueSuggestions = computed(() => ({
  genre: genreCounts.value.map(([genre, count]) => `${genre} (${count})`),
  company: companyCounts.value.map(
    ([company, count]) => `${company} (${count})`,
  ),
  director: directorCounts.value.map(
    ([director, count]) => `${director} (${count})`,
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

// Popover form state (one filter panel open at a time via PopoverGroup)
const filterValueInput = ref("");
const comparator = ref<Comparator>(">");
const popoverInput = ref<HTMLInputElement | null>(null);

/** Anchor for the teleported panel (viewport / fixed positioning). */
const teleportedPanelAnchor = ref<HTMLElement | null>(null);
const teleportedPanelStyle = ref({
  top: "0px",
  left: "0px",
  zIndex: "9999",
});

function fixedPopoverCoords(anchor: HTMLElement) {
  const popoverWidth = 280;
  const rect = anchor.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 8;

  if (left + popoverWidth > window.innerWidth) {
    left = window.innerWidth - popoverWidth - 16;
  }
  if (left < 16) {
    left = 16;
  }

  const estimatedHeight = 250;
  if (top + estimatedHeight > window.innerHeight) {
    top = rect.top - estimatedHeight - 8;
  }

  return { top, left };
}

function updateTeleportedPanelStyle() {
  const el = teleportedPanelAnchor.value;
  if (!el) return;
  const { top, left } = fixedPopoverCoords(el);
  teleportedPanelStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    zIndex: "9999",
  };
}

function syncTeleportedPanelPosition() {
  updateTeleportedPanelStyle();
}

function bindPopoverInput(el: unknown) {
  popoverInput.value = el instanceof HTMLInputElement ? el : null;
}

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

function removeAppliedFilter(key: string) {
  const existingIdx = appliedFilters.value.findIndex((p) => p.key === key);
  if (existingIdx >= 0) {
    appliedFilters.value.splice(existingIdx, 1);
  }
}

function prepareFilterPopover(opt: FilterOption, event: Event) {
  filterValueInput.value = "";
  comparator.value = ">";

  const btn = event.currentTarget;
  teleportedPanelAnchor.value = btn instanceof HTMLElement ? btn : null;
  updateTeleportedPanelStyle();

  // Wait for PopoverPanel to mount (button click opens on same tick).
  void nextTick(() => {
    void nextTick(() => {
      requestAnimationFrame(() => {
        const inputElement = popoverInput.value;
        if (!inputElement) return;

        inputElement.focus();
        if (
          opt.type === "date" &&
          typeof inputElement.showPicker === "function"
        ) {
          setTimeout(() => {
            inputElement.showPicker();
          }, 100);
        }
      });
    });
  });
}

function getFilteredValueSuggestions(optKey: string) {
  const q = filterValueInput.value.trim().toLowerCase();
  const list =
    computedValueSuggestions.value[
      optKey as keyof typeof computedValueSuggestions.value
    ] ?? [];
  if (!q) return list.slice(0, 20);
  return list.filter((v) => v.toLowerCase().includes(q)).slice(0, 20);
}

function closeFilterPopover(close: () => void) {
  teleportedPanelAnchor.value = null;
  close();
}

function selectValueSuggestion(
  suggestion: string,
  opt: FilterOption,
  close: () => void,
) {
  const value = suggestion.replace(/ \(\d+\)$/, "");
  filterValueInput.value = value;
  applyActiveFilter(opt, close);
}

// Build filters object from pills
const filtersObject = computed(() => {
  return appliedFilters.value.reduce(
    (acc, f) => {
      acc[f.key] = {
        operator: f.operator,
        value: f.value,
      };
      return acc;
    },
    {} as Record<string, { operator?: Comparator; value: string }>,
  );
});

// Check if any filters or search are active
const derivedHasActiveFilters = computed(() => {
  return appliedFilters.value.length > 0 || searchTerm.value.trim().length > 0;
});

// Apply filtering internally and sync to parent via v-model
const derivedFiltered = computed(() => {
  return filterMovies(props.data, {
    filters: filtersObject.value,
    freeText: searchTerm.value.trim(),
  });
});

watchEffect(() => {
  filteredData.value = derivedFiltered.value;
  hasActiveFilters.value = derivedHasActiveFilters.value;
});

function applyActiveFilter(opt: FilterOption, close: () => void) {
  const v = filterValueInput.value;
  const valueStr = String(v).trim();
  if (valueStr.length === 0) return;

  const newPill: AppliedFilter = {
    key: opt.key,
    label: opt.label,
    type: opt.type,
    operator:
      opt.type === "number" || opt.type === "date"
        ? comparator.value
        : undefined,
    value: valueStr,
  };

  const existingIdx = appliedFilters.value.findIndex(
    (p) => p.key === newPill.key,
  );
  if (existingIdx >= 0) {
    appliedFilters.value.splice(existingIdx, 1, newPill);
  } else {
    appliedFilters.value.push(newPill);
  }

  filterValueInput.value = "";
  comparator.value = ">";
  teleportedPanelAnchor.value = null;
  close();
}

onMounted(() => {
  window.addEventListener("scroll", syncTeleportedPanelPosition, true);
  window.addEventListener("resize", syncTeleportedPanelPosition);
});

onUnmounted(() => {
  window.removeEventListener("scroll", syncTeleportedPanelPosition, true);
  window.removeEventListener("resize", syncTeleportedPanelPosition);
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
