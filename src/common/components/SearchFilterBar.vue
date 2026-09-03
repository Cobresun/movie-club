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
        <!-- Applied filter pill (clickable to remove) -->
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

        <!-- Desktop: anchored popover tooltip near the pill -->
        <Popover v-else-if="isDesktop" v-slot="{ close }" class="relative shrink-0">
          <PopoverButton
            :class="[
              'relative shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 py-1 text-sm hover:bg-lowBackground',
              'border-white opacity-80',
            ]"
            @click="prepareFilterPopover($event)"
          >
            <span>{{ opt.label }}</span>
          </PopoverButton>

          <!-- Body teleport + fixed: escapes ancestor stacking contexts and overflow so
               the panel stays above the reviews table (sticky headers, etc.). -->
          <Teleport to="body">
            <PopoverPanel
              :focus="true"
              class="fixed w-80 rounded-lg border border-slate-600 bg-background p-4 shadow-2xl"
              :style="teleportedPanelStyle"
            >
              <FilterPanelContent
                :opt="opt"
                :value-suggestions="suggestionsFor(opt.key)"
                :years="yearsFor(opt.key)"
                @apply="
                  (value, operator, range) => {
                    applyFilter(opt, value, operator, range);
                    close();
                  }
                "
                @cancel="close()"
              />
            </PopoverPanel>
          </Teleport>
        </Popover>

        <!-- Mobile: pill opens a bottom sheet instead of the desktop tooltip -->
        <button
          v-else
          type="button"
          :class="[
            'relative shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 py-1 text-sm hover:bg-lowBackground',
            'border-white opacity-80',
          ]"
          @click="activeMobileFilter = opt"
        >
          <span>{{ opt.label }}</span>
        </button>
      </template>
    </PopoverGroup>

    <!-- Mobile filter bottom sheet (replaces the desktop tooltip on < 768px) -->
    <v-bottom-sheet v-if="!isDesktop && activeMobileFilter" @close="activeMobileFilter = null">
      <FilterPanelContent
        :opt="activeMobileFilter"
        :value-suggestions="suggestionsFor(activeMobileFilter.key)"
        :years="yearsFor(activeMobileFilter.key)"
        @apply="applyMobileFilter"
        @cancel="activeMobileFilter = null"
      />
    </v-bottom-sheet>
  </div>
</template>

<script setup lang="ts" generic="T extends DetailedWorkListItem">
import { Popover, PopoverButton, PopoverGroup, PopoverPanel } from "@headlessui/vue";
import { computed, onMounted, onUnmounted, ref, watchEffect } from "vue";

import { hasValue, isDefined } from "../../../lib/checks/checks";
import { ClubType } from "../../../lib/types/generated/db";
import type { DetailedWorkListItem } from "../../../lib/types/lists";
import { clubTypeConfig, type FilterOption } from "../clubType";
import { useIsDesktop } from "../composables/useIsDesktop.js";
import { filterWorks } from "../filterWorks";
import FilterPanelContent from "./FilterPanelContent.vue";
import type { Comparator, YearRange } from "./filterTypes";
import VBottomSheet from "./VBottomSheet.vue";

// Component props
interface Props {
  data: T[];
  clubType: ClubType;
  searchPlaceholder?: string;
  className?: string;
  excludeFilterKeys?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  searchPlaceholder: "Search",
  className: "mb-4",
  excludeFilterKeys: () => [],
});

const filteredData = defineModel<T[]>("filteredData", {
  required: true,
});
const hasActiveFilters = defineModel<boolean>("hasActiveFilters", {
  required: true,
});

// Filter options come from the club-type registry (movie/book have different
// fields); excludeFilterKeys lets a view drop options that don't apply (e.g.
// score-based filters on the watchlist).
const FILTER_OPTIONS = computed(() =>
  clubTypeConfig(props.clubType).filterOptions.filter(
    (o) => !props.excludeFilterKeys.includes(o.key),
  ),
);

// Frequency-ranked value suggestions for each enum filter, derived from the
// current data via the option's `suggestions` selector. Keyed by filter key.
const computedValueSuggestions = computed<Record<string, string[]>>(() => {
  const result: Record<string, string[]> = {};
  for (const opt of FILTER_OPTIONS.value) {
    if (opt.suggestions === undefined) continue;
    const select = opt.suggestions;
    const counts = new Map<string, number>();
    props.data.forEach((item) =>
      select(item.externalData).forEach((value) => {
        const currentCount = counts.get(value);
        counts.set(value, currentCount !== undefined ? currentCount + 1 : 1);
      }),
    );
    result[opt.key] = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by frequency (descending)
      .map(([value, count]) => `${value} (${count})`);
  }
  return result;
});

// Years present in the data for each year filter, feeding that filter's
// distribution chart. Keyed by filter key, from the option's `year` selector.
const computedYears = computed<Record<string, number[]>>(() => {
  const result: Record<string, number[]> = {};
  for (const opt of FILTER_OPTIONS.value) {
    if (opt.year === undefined) continue;
    const select = opt.year;
    result[opt.key] = props.data.map(select).filter(isDefined);
  }
  return result;
});

// Search and Filters state
const searchTerm = ref("");

// Applied filters pills
interface AppliedFilter {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "enum" | "year";
  operator?: Comparator;
  value: string;
  range?: YearRange;
}
const appliedFilters = ref<AppliedFilter[]>([]);

// Viewport: desktop shows the anchored popover, mobile opens a bottom sheet.
const isDesktop = useIsDesktop();
const activeMobileFilter = ref<FilterOption | null>(null);

/** Anchor for the teleported panel (viewport / fixed positioning). */
const teleportedPanelAnchor = ref<HTMLElement | null>(null);
const teleportedPanelStyle = ref<Record<string, string>>({
  top: "0px",
  left: "0px",
  zIndex: "9999",
});

const PANEL_WIDTH = 320;
const PANEL_GAP = 8;
const VIEWPORT_MARGIN = 16;
const MIN_PANEL_HEIGHT = 200;

/**
 * Panels vary in height — the year picker is roughly twice the number one — and
 * the panel is not measurable before it paints, so the space it may occupy is
 * bounded instead: hang it off whichever edge of the pill has more room and cap
 * it at that room, leaving a tall panel to scroll rather than run off screen.
 */
function fixedPopoverStyle(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(rect.left, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN),
  );
  const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - PANEL_GAP - VIEWPORT_MARGIN;
  const shared = {
    left: `${left}px`,
    zIndex: "9999",
    overflowY: "auto",
  };

  if (spaceBelow >= MIN_PANEL_HEIGHT || spaceBelow >= spaceAbove) {
    return { ...shared, top: `${rect.bottom + PANEL_GAP}px`, maxHeight: `${spaceBelow}px` };
  }
  // Anchored by its bottom edge, so it grows upwards without being measured.
  return {
    ...shared,
    bottom: `${window.innerHeight - rect.top + PANEL_GAP}px`,
    maxHeight: `${spaceAbove}px`,
  };
}

function updateTeleportedPanelStyle() {
  const anchor = teleportedPanelAnchor.value;
  if (!anchor) return;
  teleportedPanelStyle.value = fixedPopoverStyle(anchor);
}

function syncTeleportedPanelPosition() {
  updateTeleportedPanelStyle();
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

// Desktop only: position the teleported panel before it opens. The form's own
// focus/showPicker handling lives in FilterPanelContent's onMounted.
function prepareFilterPopover(event: Event) {
  const btn = event.currentTarget;
  teleportedPanelAnchor.value = btn instanceof HTMLElement ? btn : null;
  updateTeleportedPanelStyle();
}

function suggestionsFor(key: string): string[] {
  return computedValueSuggestions.value[key] ?? [];
}

function yearsFor(key: string): number[] {
  return computedYears.value[key] ?? [];
}

// Build filters object from pills
const filtersObject = computed(() => {
  return appliedFilters.value.reduce(
    (acc, f) => {
      acc[f.key] = {
        operator: f.operator,
        value: f.value,
        range: f.range,
      };
      return acc;
    },
    {} as Record<string, { operator?: Comparator; value: string; range?: YearRange }>,
  );
});

// Check if any filters or search are active
const derivedHasActiveFilters = computed(() => {
  return appliedFilters.value.length > 0 || searchTerm.value.trim().length > 0;
});

// Apply filtering internally and sync to parent via v-model
const derivedFiltered = computed(() => {
  return filterWorks(
    props.data,
    {
      filters: filtersObject.value,
      freeText: searchTerm.value.trim(),
    },
    props.clubType,
  );
});

watchEffect(() => {
  filteredData.value = derivedFiltered.value;
  hasActiveFilters.value = derivedHasActiveFilters.value;
});

function applyFilter(opt: FilterOption, value: string, operator?: Comparator, range?: YearRange) {
  const valueStr = value.trim();
  if (!hasValue(valueStr)) return;

  const newPill: AppliedFilter = {
    key: opt.key,
    label: opt.label,
    type: opt.type,
    operator,
    value: valueStr,
    range,
  };

  const existingIdx = appliedFilters.value.findIndex((p) => p.key === newPill.key);
  if (existingIdx >= 0) {
    appliedFilters.value.splice(existingIdx, 1, newPill);
  } else {
    appliedFilters.value.push(newPill);
  }
}

// Bottom-sheet apply: reads the active option, then closes the sheet.
function applyMobileFilter(value: string, operator?: Comparator, range?: YearRange) {
  const opt = activeMobileFilter.value;
  if (!opt) return;
  applyFilter(opt, value, operator, range);
  activeMobileFilter.value = null;
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
