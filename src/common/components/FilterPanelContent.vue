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

    <!-- Year picker: one year, or an inclusive span of them -->
    <div v-else-if="opt.type === 'year'" class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-2">
        <label class="text-xs text-slate-400">{{ opt.label }}</label>
        <div class="flex gap-1">
          <button
            type="button"
            :aria-pressed="yearMode === 'exact'"
            :class="[
              'rounded-full border px-3 py-1 text-xs transition-colors',
              yearMode === 'exact'
                ? 'border-primary bg-primary/20 text-white'
                : 'border-slate-600 bg-lowBackground/60 text-slate-400 hover:text-white',
            ]"
            @click="setYearMode('exact')"
          >
            One year
          </button>
          <button
            type="button"
            :aria-pressed="yearMode === 'range'"
            :class="[
              'rounded-full border px-3 py-1 text-xs transition-colors',
              yearMode === 'range'
                ? 'border-primary bg-primary/20 text-white'
                : 'border-slate-600 bg-lowBackground/60 text-slate-400 hover:text-white',
            ]"
            @click="setYearMode('range')"
          >
            Range
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <input
          ref="inputEl"
          v-model="fromYear"
          type="number"
          inputmode="numeric"
          :aria-label="yearMode === 'range' ? 'From year' : 'Year'"
          class="h-11 min-w-0 flex-1 rounded-md border border-slate-600 bg-lowBackground text-center text-lg font-medium text-white outline-none focus:border-primary"
        />
        <template v-if="yearMode === 'range'">
          <span class="text-sm text-slate-400">to</span>
          <input
            v-model="toYear"
            type="number"
            inputmode="numeric"
            aria-label="To year"
            class="h-11 min-w-0 flex-1 rounded-md border border-slate-600 bg-lowBackground text-center text-lg font-medium text-white outline-none focus:border-primary"
          />
        </template>
      </div>

      <div aria-hidden="true" class="flex h-14 items-end gap-[3px]">
        <div
          v-for="bucket in yearBuckets"
          :key="bucket.start"
          class="flex-1 rounded-t-sm"
          :class="bucket.selected ? 'bg-primary' : 'bg-slate-600/50'"
          :style="{ height: `${bucket.height}px` }"
        ></div>
      </div>

      <div class="year-scrubber relative">
        <div class="absolute inset-x-0 top-3 h-1 rounded-full bg-slate-600"></div>
        <div class="absolute top-3 h-1 rounded-full bg-primary" :style="selectedTrackStyle"></div>
        <input
          v-model.number="fromYear"
          type="range"
          :min="yearBounds.start"
          :max="yearBounds.end"
          :aria-label="yearMode === 'range' ? 'From year slider' : 'Year slider'"
          @input="clampToFrom"
        />
        <input
          v-if="yearMode === 'range'"
          v-model.number="toYear"
          type="range"
          :min="yearBounds.start"
          :max="yearBounds.end"
          aria-label="To year slider"
          @input="clampFromTo"
        />
      </div>

      <div class="flex justify-between text-[11px] text-slate-500">
        <span>{{ yearBounds.start }}</span>
        <span>{{ yearBounds.end }}</span>
      </div>
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
        :disabled="!canApply"
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

import { hasElements, hasValue } from "../../../lib/checks/checks";
import type { Comparator, FilterOption, YearRange } from "./filterTypes";

const props = withDefaults(
  defineProps<{
    opt: FilterOption;
    /** Full, pre-formatted suggestion list (e.g. "Action (12)") for this option. */
    valueSuggestions: string[];
    /** Year filters only: every year present in the data, one entry per work. */
    years?: number[];
  }>(),
  { years: () => [] },
);

const emit = defineEmits<{
  (e: "apply", value: string, operator?: Comparator, range?: YearRange): void;
  (e: "cancel"): void;
}>();

const COMPARATORS: Comparator[] = [">", "=", "<"];

const YEAR_BUCKET = 5;
const BAR_MIN_HEIGHT = 4;
const BAR_MAX_HEIGHT = 52;
const FALLBACK_YEAR_SPAN = 50;

// Form state — owned here so it is fresh on every mount (each popover/sheet open).
// v-model on a number input yields a number, so normalize to a trimmed string.
const inputValue = ref<string | number>("");
const comparator = ref<Comparator>(">");
const inputEl = ref<HTMLInputElement | null>(null);

const inputText = computed(() => String(inputValue.value).trim());

// Year form state. `fromYear` doubles as the single year in "exact" mode, so
// one range — `{ from, to }` with both ends included — covers both modes.
const yearMode = ref<"exact" | "range">("exact");

const yearBounds = computed(() => {
  const currentYear = new Date().getFullYear();
  const earliest = hasElements(props.years)
    ? Math.min(...props.years)
    : currentYear - FALLBACK_YEAR_SPAN;
  const latest = hasElements(props.years) ? Math.max(...props.years) : currentYear;
  return {
    start: Math.floor(earliest / YEAR_BUCKET) * YEAR_BUCKET,
    end: Math.ceil((latest + 1) / YEAR_BUCKET) * YEAR_BUCKET - 1,
  };
});

// The scrubber writes numbers, the typed field writes whatever is in it —
// including "" once cleared, which must read as "no year yet", not year 0.
const fromYear = ref<number | string>(yearBounds.value.end);
const toYear = ref<number | string>(yearBounds.value.end);

function parseYear(value: number | string): number | undefined {
  const year = typeof value === "number" ? value : Number(value.trim());
  return hasValue(String(value).trim()) && Number.isInteger(year) ? year : undefined;
}

const yearRange = computed<YearRange | undefined>(() => {
  const from = parseYear(fromYear.value);
  const to = yearMode.value === "exact" ? from : parseYear(toYear.value);
  if (from === undefined || to === undefined) return undefined;
  return { from: Math.min(from, to), to: Math.max(from, to) };
});

const yearBuckets = computed(() => {
  const { start, end } = yearBounds.value;
  const range = yearRange.value;
  const counts: { start: number; count: number }[] = [];
  for (let bucketStart = start; bucketStart <= end; bucketStart += YEAR_BUCKET) {
    const bucketEnd = bucketStart + YEAR_BUCKET - 1;
    counts.push({
      start: bucketStart,
      count: props.years.filter((year) => year >= bucketStart && year <= bucketEnd).length,
    });
  }
  const busiest = Math.max(1, ...counts.map((bucket) => bucket.count));
  return counts.map((bucket) => ({
    start: bucket.start,
    height: BAR_MIN_HEIGHT + (bucket.count / busiest) * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT),
    selected:
      range !== undefined &&
      bucket.start + YEAR_BUCKET - 1 >= range.from &&
      bucket.start <= range.to,
  }));
});

// The scrubber's thumbs are 20px wide, so their centres travel between 10px and
// (width - 10px); the fill has to inset by the same amount to line up.
const selectedTrackStyle = computed(() => {
  const range = yearRange.value;
  if (range === undefined) return { display: "none" };
  const { start, end } = yearBounds.value;
  const span = Math.max(1, end - start);
  const fromFraction = (range.from - start) / span;
  const toFraction = (range.to - start) / span;
  return {
    left: `calc(10px + (100% - 20px) * ${fromFraction})`,
    width: `calc((100% - 20px) * ${toFraction - fromFraction} + 4px)`,
  };
});

const yearLabel = computed(() => {
  const range = yearRange.value;
  if (range === undefined) return "";
  return range.from === range.to ? String(range.from) : `${range.from} – ${range.to}`;
});

const canApply = computed(() =>
  props.opt.type === "year" ? yearRange.value !== undefined : hasValue(inputText.value),
);

// Two thumbs parked on the same year read as one, so a range always opens on a
// real span: a bucket above the anchor year, or below it when the anchor is
// already at the upper bound (which it is by default).
function spreadFrom(anchor: number): YearRange {
  const { start, end } = yearBounds.value;
  const to = Math.min(anchor + YEAR_BUCKET, end);
  return { from: Math.max(start, Math.min(anchor, to - YEAR_BUCKET)), to };
}

function setYearMode(mode: "exact" | "range") {
  yearMode.value = mode;
  const from = parseYear(fromYear.value);
  const to = parseYear(toYear.value);
  if (mode === "range" && from !== undefined && (to === undefined || to <= from)) {
    const span = spreadFrom(from);
    fromYear.value = span.from;
    toYear.value = span.to;
  }
}

// The two scrubber handles share one rail, so neither may cross the other.
function clampToFrom() {
  const from = parseYear(fromYear.value);
  const to = parseYear(toYear.value);
  if (yearMode.value === "range" && from !== undefined && (to === undefined || to < from)) {
    toYear.value = from;
  }
}

function clampFromTo() {
  const from = parseYear(fromYear.value);
  const to = parseYear(toYear.value);
  if (to !== undefined && (from === undefined || to < from)) fromYear.value = to;
}

const filteredSuggestions = computed(() => {
  const q = inputText.value.toLowerCase();
  if (!hasValue(q)) return props.valueSuggestions.slice(0, 20);
  return props.valueSuggestions.filter((v) => v.toLowerCase().includes(q)).slice(0, 20);
});

// Comparators only apply to number/date filters; enum/string filters omit one.
const operatorForApply = (): Comparator | undefined =>
  props.opt.type === "number" || props.opt.type === "date" ? comparator.value : undefined;

function apply() {
  if (props.opt.type === "year") {
    const range = yearRange.value;
    if (range === undefined) return;
    emit("apply", yearLabel.value, undefined, range);
    return;
  }
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
        if (props.opt.type === "date" && typeof inputElement.showPicker === "function") {
          setTimeout(() => {
            inputElement.showPicker();
          }, 100);
        }
      });
    });
  });
});
</script>

<style scoped>
/* Stacked range inputs: the tracks are transparent so the shared rail below
   shows through, and only the thumbs take pointer events so both stay grabbable. */
.year-scrubber input[type="range"] {
  @apply absolute inset-x-0 top-0 m-0 h-7 w-full appearance-none bg-transparent;
  pointer-events: none;
}

.year-scrubber input[type="range"]::-webkit-slider-thumb {
  @apply h-5 w-5 appearance-none rounded-full border-[3px] border-primary bg-white;
  margin-top: 4px;
  pointer-events: auto;
}

.year-scrubber input[type="range"]::-moz-range-thumb {
  @apply h-5 w-5 rounded-full border-[3px] border-primary bg-white;
  pointer-events: auto;
}

.year-scrubber {
  height: 28px;
}
</style>
