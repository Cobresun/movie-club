<template>
  <div class="flex flex-col gap-3">
    <div v-if="isLong" class="relative">
      <mdicon
        name="magnify"
        :size="18"
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        v-model="query"
        type="search"
        :aria-label="option.searchPlaceholder"
        :placeholder="option.searchPlaceholder"
        class="w-full rounded-full border border-slate-600 bg-lowBackground/60 py-1.5 pl-9 pr-3 text-base text-white outline-none focus:border-primary md:text-sm"
      />
    </div>

    <div v-if="hasElements(visibleValues)" class="flex flex-wrap gap-2">
      <button
        v-for="value in visibleValues"
        :key="value"
        type="button"
        :aria-pressed="isSelected(value)"
        :disabled="!isSelected(value) && countOf(value) === 0"
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-35"
        :class="
          isSelected(value)
            ? 'border-primary bg-primary text-white'
            : 'border-slate-600 text-slate-200 enabled:hover:border-slate-400 enabled:hover:text-white'
        "
        @click="toggle(value)"
      >
        <mdicon v-if="isSelected(value)" name="check" :size="14" />
        {{ value }}
        <span class="text-xs opacity-60">{{ countOf(value) }}</span>
      </button>
    </div>
    <p v-else class="text-sm text-slate-400">Nothing matches “{{ query.trim() }}”</p>

    <button
      v-if="isLong && !hasValue(query.trim())"
      type="button"
      class="self-start text-sm font-medium text-primary hover:underline"
      @click="expanded = !expanded"
    >
      {{ expanded ? "Show fewer" : `Show all ${orderedValues.length}` }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasElements, hasValue } from "../../../lib/checks/checks";
import type { DetailedWorkListItem } from "../../../lib/types/lists";
import type { ChoiceFilterOption } from "../clubType";
import { includesCaseInsensitive } from "../filterMatchers";
import type { ChoiceSelection } from "./filterTypes";

const props = defineProps<{
  option: ChoiceFilterOption;
  /** Every work in the club: which values exist, and their order. */
  allWorks: DetailedWorkListItem[];
  /** Works left by the other filters: the count beside each value. */
  works: DetailedWorkListItem[];
  selection: ChoiceSelection | undefined;
}>();

const emit = defineEmits<{
  (e: "update:selection", selection: ChoiceSelection | undefined): void;
}>();

const COLLAPSED_COUNT = 12;
// Short lists (a club's genres) show in full; a search box only earns its
// place once scanning the chips stops being quicker.
const LONG_LIST = 20;

const query = ref("");
const expanded = ref(false);

function tally(works: DetailedWorkListItem[]) {
  const counts = new Map<string, number>();
  for (const work of works) {
    for (const value of new Set(props.option.values(work))) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

const overallCounts = computed(() => tally(props.allWorks));
const counts = computed(() => tally(props.works));

// Ordered by the whole club rather than the narrowed counts, so chips hold
// still while other filters change around them.
const orderedValues = computed(() => {
  const values = [...overallCounts.value.keys()];
  if (props.option.order === "newest") return values.sort((a, b) => b.localeCompare(a));
  const overall = overallCounts.value;
  return values.sort((a, b) => (overall.get(b) ?? 0) - (overall.get(a) ?? 0) || a.localeCompare(b));
});

const isLong = computed(() => orderedValues.value.length > LONG_LIST);

const selectedValues = computed(() => props.selection?.values ?? []);

const visibleValues = computed(() => {
  const search = query.value.trim();
  if (hasValue(search)) {
    return orderedValues.value.filter((value) => includesCaseInsensitive(value, search));
  }
  if (!isLong.value || expanded.value) return orderedValues.value;
  const top = orderedValues.value.slice(0, COLLAPSED_COUNT);
  // A pick from further down the list stays in view once the list folds.
  const pinned = selectedValues.value.filter((value) => !top.includes(value));
  return [...pinned, ...top];
});

const isSelected = (value: string) => selectedValues.value.includes(value);
const countOf = (value: string) => counts.value.get(value) ?? 0;

function toggle(value: string) {
  const values = isSelected(value)
    ? selectedValues.value.filter((selected) => selected !== value)
    : [...selectedValues.value, value];
  emit("update:selection", hasElements(values) ? { kind: "choice", values } : undefined);
}
</script>
