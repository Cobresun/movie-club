<template>
  <div class="flex flex-col gap-3">
    <!-- Date picker -->
    <div v-if="opt.type === 'date'" class="flex flex-col gap-2">
      <label class="text-xs text-slate-400">{{ opt.label }}</label>
      <input
        ref="inputEl"
        v-model="inputValue"
        type="date"
        class="rounded-md border border-slate-600 bg-lowBackground p-2 text-sm text-white outline-none focus:border-primary"
      />
    </div>

    <!-- Number input -->
    <div v-else-if="opt.type === 'number'" class="flex flex-col gap-2">
      <label class="text-xs text-slate-400">{{ opt.label }}</label>
      <input
        ref="inputEl"
        v-model="inputValue"
        type="number"
        class="rounded-md border border-slate-600 bg-lowBackground p-2 text-sm text-white outline-none focus:border-primary"
        :placeholder="opt.placeholder"
      />
    </div>

    <!-- Enum with suggestions -->
    <div v-else-if="opt.type === 'enum'" class="flex flex-col gap-2">
      <label class="text-xs text-slate-400">{{ opt.label }}</label>
      <input
        ref="inputEl"
        v-model="inputValue"
        type="text"
        class="rounded-md border border-slate-600 bg-lowBackground p-2 text-sm text-white outline-none focus:border-primary"
        :placeholder="opt.placeholder"
      />
      <!-- Suggestions list -->
      <div
        v-if="filteredSuggestions.length > 0"
        class="max-h-48 overflow-y-auto rounded-md border border-slate-700 bg-lowBackground"
      >
        <div
          v-for="s in filteredSuggestions"
          :key="s"
          class="cursor-pointer px-3 py-2 text-sm hover:bg-background"
          @click="selectSuggestion(s)"
        >
          {{ s }}
        </div>
      </div>
    </div>

    <!-- Comparator buttons for number/date -->
    <div v-if="opt.type === 'number' || opt.type === 'date'" class="flex gap-1">
      <button
        v-for="op in COMPARATORS"
        :key="op"
        type="button"
        :class="[
          'flex-1 rounded-md border px-3 py-1 text-sm transition-colors',
          comparator === op
            ? 'border-primary bg-primary/20 text-white'
            : 'border-slate-600 bg-lowBackground/60 text-slate-400 hover:border-slate-500 hover:text-white',
        ]"
        @click="comparator = op"
      >
        {{ op }}
      </button>
    </div>

    <!-- Action buttons -->
    <div class="flex gap-2">
      <button
        type="button"
        class="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/80 disabled:opacity-50"
        :disabled="!hasValue(inputText)"
        @click="apply"
      >
        Apply
      </button>
      <button
        type="button"
        class="rounded-md border border-slate-600 bg-lowBackground/60 px-3 py-2 text-sm text-slate-400 hover:bg-lowBackground hover:text-white"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";

import type { Comparator, FilterOption } from "./filterTypes";
import { hasValue } from "../../../lib/checks/checks";

const props = defineProps<{
  opt: FilterOption;
  /** Full, pre-formatted suggestion list (e.g. "Action (12)") for this option. */
  valueSuggestions: string[];
}>();

const emit = defineEmits<{
  (e: "apply", value: string, operator?: Comparator): void;
  (e: "cancel"): void;
}>();

const COMPARATORS: Comparator[] = [">", "=", "<"];

// Form state — owned here so it is fresh on every mount (each popover/sheet open).
// v-model on a number input yields a number, so normalize to a trimmed string.
const inputValue = ref<string | number>("");
const comparator = ref<Comparator>(">");
const inputEl = ref<HTMLInputElement | null>(null);

const inputText = computed(() => String(inputValue.value).trim());

const filteredSuggestions = computed(() => {
  const q = inputText.value.toLowerCase();
  if (!hasValue(q)) return props.valueSuggestions.slice(0, 20);
  return props.valueSuggestions
    .filter((v) => v.toLowerCase().includes(q))
    .slice(0, 20);
});

// Comparators only apply to number/date filters; enum/string filters omit one.
const operatorForApply = (): Comparator | undefined =>
  props.opt.type === "number" || props.opt.type === "date"
    ? comparator.value
    : undefined;

function apply() {
  if (!hasValue(inputText.value)) return;
  emit("apply", inputText.value, operatorForApply());
}

function selectSuggestion(suggestion: string) {
  // Strip the trailing " (12)" frequency count before applying.
  const value = suggestion.replace(/ \(\d+\)$/, "");
  emit("apply", value, operatorForApply());
}

onMounted(() => {
  // Wait for the panel/sheet to finish mounting before focusing the input.
  void nextTick(() => {
    void nextTick(() => {
      requestAnimationFrame(() => {
        const inputElement = inputEl.value;
        if (!inputElement) return;

        inputElement.focus();
        if (
          props.opt.type === "date" &&
          typeof inputElement.showPicker === "function"
        ) {
          setTimeout(() => {
            inputElement.showPicker();
          }, 100);
        }
      });
    });
  });
});
</script>
