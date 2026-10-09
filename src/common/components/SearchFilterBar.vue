<template>
  <div class="flex flex-col items-center gap-2" :class="className">
    <div class="flex w-full items-center justify-center gap-2">
      <div class="relative min-w-0 max-w-[720px] flex-1">
        <mdicon
          name="magnify"
          class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-200"
        />
        <input
          v-model="searchTerm"
          type="text"
          class="w-full rounded-md border-2 border-slate-600 bg-background p-2 pl-10 text-base text-white outline-none focus:border-primary"
          :class="{ 'pr-10': hasValue(searchTerm) }"
          :placeholder="searchPlaceholder"
          :aria-label="searchPlaceholder"
        />
        <button
          v-if="hasValue(searchTerm)"
          type="button"
          aria-label="Clear search"
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-white"
          @click="searchTerm = ''"
        >
          <mdicon name="close" :size="18" />
        </button>
      </div>

      <button
        v-if="hasElements(availableOptions)"
        type="button"
        :aria-label="filtersLabel"
        :aria-expanded="panelOpen"
        class="relative flex h-11 shrink-0 items-center gap-2 rounded-md border-2 px-2.5 transition-colors duration-fast md:px-3"
        :class="
          hasElements(activeChips)
            ? 'border-primary bg-primary/15 text-white'
            : 'border-slate-600 text-slate-200 hover:border-slate-400 hover:text-white'
        "
        @click="panelOpen = true"
      >
        <mdicon name="tune-variant" />
        <span class="hidden md:inline">Filters</span>
        <span
          v-if="hasElements(activeChips)"
          aria-hidden="true"
          class="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white"
        >
          {{ activeChips.length }}
        </span>
      </button>

      <slot name="action-button" />
    </div>

    <div
      v-if="hasElements(activeChips)"
      class="scrollbar-hide flex w-full flex-nowrap items-center gap-2 overflow-x-auto md:flex-wrap md:justify-center"
    >
      <button
        v-for="chip in activeChips"
        :key="chip.id"
        type="button"
        :aria-label="`Remove ${chip.label}: ${chip.text}`"
        class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-primary bg-primary/20 py-1 pl-2.5 pr-2 text-sm text-white hover:bg-primary/30"
        @click="chip.remove()"
      >
        <mdicon :name="chip.icon" :size="16" class="text-highlight" />
        {{ chip.text }}
        <mdicon name="close" :size="14" class="opacity-70" />
      </button>
      <button
        type="button"
        class="shrink-0 whitespace-nowrap px-1 text-sm text-slate-400 hover:text-white"
        @click="clearFilters"
      >
        Clear all
      </button>
    </div>

    <template v-if="panelOpen">
      <v-side-drawer v-if="isDesktop" @close="panelOpen = false">
        <div role="dialog" aria-modal="true" aria-label="Filters" class="h-full">
          <FilterPanel
            class="min-h-full"
            :options="availableOptions"
            :all-works="works"
            :facets="facets"
            :selections="selections"
            :result-label="resultLabel"
            @update="setSelection"
            @clear="clearFilters"
            @close="panelOpen = false"
          />
        </div>
      </v-side-drawer>
      <v-bottom-sheet v-else content-class="px-4" @close="panelOpen = false">
        <FilterPanel
          :options="availableOptions"
          :all-works="works"
          :facets="facets"
          :selections="selections"
          :result-label="resultLabel"
          @update="setSelection"
          @clear="clearFilters"
          @close="panelOpen = false"
        />
      </v-bottom-sheet>
    </template>
  </div>
</template>

<script setup lang="ts" generic="T extends DetailedWorkListItem">
import { computed, ref, watchEffect } from "vue";

import { hasElements, hasValue } from "../../../lib/checks/checks";
import { ClubType } from "../../../lib/types/generated/db";
import type { DetailedWorkListItem } from "../../../lib/types/lists";
import { clubTypeConfig, type FilterOption } from "../clubType";
import { useIsDesktop } from "../composables/useIsDesktop.js";
import { describeRange } from "../filterMatchers";
import { filterWorks } from "../filterWorks";
import FilterPanel from "./FilterPanel.vue";
import type { FilterSelection } from "./filterTypes";
import VBottomSheet from "./VBottomSheet.vue";
import VSideDrawer from "./VSideDrawer.vue";

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

const isDesktop = useIsDesktop();
const panelOpen = ref(false);
const searchTerm = ref("");
const selections = ref<Partial<Record<string, FilterSelection>>>({});

const config = computed(() => clubTypeConfig(props.clubType));

// The same work can sit on several watchlists; count and filter it once.
const works = computed(() => [...new Map(props.data.map((work) => [work.id, work])).values()]);

// Filter options come from the club-type registry (movie/book have different
// fields); excludeFilterKeys lets a view drop options that don't apply (e.g.
// score-based filters on the watchlist). An option no work has a value for
// would be an empty section, so it is left out.
const availableOptions = computed(() =>
  config.value.filterOptions.filter(
    (option) =>
      !props.excludeFilterKeys.includes(option.key) &&
      works.value.some((work) =>
        option.kind === "choice"
          ? hasElements(option.values(work))
          : option.value(work) !== undefined,
      ),
  ),
);

function setSelection(key: string, selection: FilterSelection | undefined) {
  const next = { ...selections.value };
  if (selection === undefined) delete next[key];
  else next[key] = selection;
  selections.value = next;
}

function clearFilters() {
  selections.value = {};
}

const freeText = computed(() => searchTerm.value.trim());

const filtered = computed(() =>
  filterWorks(
    works.value,
    { selections: selections.value, freeText: freeText.value },
    props.clubType,
  ),
);

// What each filter's section counts and plots: the works that every *other*
// filter leaves, so a value that would lead nowhere shows up as zero.
const facets = computed(() => {
  const result: Partial<Record<string, T[]>> = {};
  for (const option of availableOptions.value) {
    const { [option.key]: _own, ...others } = selections.value;
    result[option.key] = filterWorks(
      works.value,
      { selections: others, freeText: freeText.value },
      props.clubType,
    );
  }
  return result;
});

interface ActiveChip {
  id: string;
  icon: string;
  label: string;
  text: string;
  remove: () => void;
}

function chipsFor(option: FilterOption, selection: FilterSelection): ActiveChip[] {
  if (option.kind === "range" && selection.kind === "range") {
    return [
      {
        id: option.key,
        icon: option.icon,
        label: option.label,
        text: describeRange(selection, option.format),
        remove: () => setSelection(option.key, undefined),
      },
    ];
  }
  if (selection.kind !== "choice") return [];
  return selection.values.map((value) => ({
    id: `${option.key}:${value}`,
    icon: option.icon,
    label: option.label,
    text: value,
    remove: () => {
      const values = selection.values.filter((kept) => kept !== value);
      setSelection(option.key, hasElements(values) ? { kind: "choice", values } : undefined);
    },
  }));
}

const activeChips = computed(() =>
  config.value.filterOptions.flatMap((option) => {
    const selection = selections.value[option.key];
    return selection === undefined ? [] : chipsFor(option, selection);
  }),
);

const filtersLabel = computed(() =>
  hasElements(activeChips.value) ? `Filters, ${activeChips.value.length} active` : "Filters",
);

const resultLabel = computed(() => {
  const count = filtered.value.length;
  const { noun, stats } = config.value;
  if (count === 0) return `No ${stats.pluralNoun.toLowerCase()} match`;
  return `Show ${count} ${count === 1 ? noun : stats.pluralNoun.toLowerCase()}`;
});

watchEffect(() => {
  filteredData.value = filtered.value;
  hasActiveFilters.value = hasElements(activeChips.value) || hasValue(freeText.value);
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
