<template>
  <div class="flex flex-col text-left">
    <div class="flex items-center gap-3 pb-3">
      <h2 :id="headingId" class="text-xl font-bold">Filters</h2>
      <button
        v-if="hasActiveFilters"
        type="button"
        class="ml-auto text-sm font-medium text-primary hover:underline"
        @click="emit('clear')"
      >
        Clear all
      </button>
      <button
        ref="closeButton"
        type="button"
        aria-label="Close filters"
        class="rounded-full p-1 text-slate-300 hover:bg-lowBackground hover:text-white"
        :class="{ 'ml-auto': !hasActiveFilters }"
        @click="emit('close')"
      >
        <mdicon name="close" />
      </button>
    </div>

    <section
      v-for="option in options"
      :key="option.key"
      :aria-labelledby="`${headingId}-${option.key}`"
      class="border-t border-slate-700 py-4"
    >
      <div class="mb-3 flex items-center gap-2">
        <mdicon :name="option.icon" :size="20" class="text-primary" />
        <h3 :id="`${headingId}-${option.key}`" class="font-semibold">{{ option.label }}</h3>
        <span
          v-if="option.kind === 'range'"
          class="text-sm"
          :class="isDefined(selections[option.key]) ? 'text-primary' : 'text-slate-400'"
        >
          {{ rangeSummary(option) }}
        </span>
        <button
          v-if="isDefined(selections[option.key])"
          type="button"
          class="ml-auto text-sm text-slate-400 hover:text-white"
          :aria-label="`Clear ${option.label.toLowerCase()}`"
          @click="emit('update', option.key, undefined)"
        >
          Clear
        </button>
      </div>

      <ChoiceFilterSection
        v-if="option.kind === 'choice'"
        :option="option"
        :all-works="allWorks"
        :works="facets[option.key] ?? []"
        :selection="choiceSelection(option.key)"
        @update:selection="(selection) => emit('update', option.key, selection)"
      />
      <RangeFilterSection
        v-else
        :option="option"
        :all-works="allWorks"
        :works="facets[option.key] ?? []"
        :selection="rangeSelection(option.key)"
        @update:selection="(selection) => emit('update', option.key, selection)"
      />
    </section>

    <div class="sticky bottom-0 -mx-4 mt-auto border-t border-slate-700 bg-background px-4 py-3">
      <v-btn class="w-full py-1.5" @click="emit('close')">{{ resultLabel }}</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useId } from "vue";

import { isDefined } from "../../../lib/checks/checks";
import type { DetailedWorkListItem } from "../../../lib/types/lists";
import type { FilterOption, RangeFilterOption } from "../clubType";
import { describeRange } from "../filterMatchers";
import ChoiceFilterSection from "./ChoiceFilterSection.vue";
import type { ChoiceSelection, FilterSelection, RangeSelection } from "./filterTypes";
import RangeFilterSection from "./RangeFilterSection.vue";

const props = defineProps<{
  options: FilterOption[];
  allWorks: DetailedWorkListItem[];
  /** Per filter key: the works every *other* filter leaves. */
  facets: Partial<Record<string, DetailedWorkListItem[]>>;
  selections: Partial<Record<string, FilterSelection>>;
  /** "Show 12 movies" — what closing the panel will reveal. */
  resultLabel: string;
}>();

const emit = defineEmits<{
  (e: "update", key: string, selection: FilterSelection | undefined): void;
  (e: "clear"): void;
  (e: "close"): void;
}>();

const headingId = useId();
const closeButton = ref<HTMLButtonElement | null>(null);

const hasActiveFilters = computed(() => Object.values(props.selections).some(isDefined));

function choiceSelection(key: string): ChoiceSelection | undefined {
  const selection = props.selections[key];
  return selection?.kind === "choice" ? selection : undefined;
}

function rangeSelection(key: string): RangeSelection | undefined {
  const selection = props.selections[key];
  return selection?.kind === "range" ? selection : undefined;
}

function rangeSummary(option: RangeFilterOption) {
  const selection = rangeSelection(option.key);
  return selection === undefined ? "Any" : describeRange(selection, option.format);
}

onMounted(() => {
  closeButton.value?.focus({ preventScroll: true });
});
</script>
